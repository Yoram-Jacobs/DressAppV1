"""Stylist memory helpers — Durable-Object equivalent built on Mongo.

This module now supports *multiple concurrent conversations* per user (the
ChatGPT-style thread list). The previous single-session behavior is preserved
through ``get_or_create_active_session`` which backs the default stylist
endpoint when no explicit ``session_id`` is supplied.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db
from app.models.schemas import StylistMessage, StylistSession
from app.services import repos


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------
async def get_or_create_active_session(user_id: str) -> dict[str, Any]:
    """Return the user's most recently active (non-archived) session,
    creating a fresh one if none exists."""
    db = get_db()
    sess = await repos.find_one(
        db.stylist_sessions,
        {"user_id": user_id, "archived": {"$ne": True}},
        sort=[("last_active_at", -1)],
    )
    if sess:
        return sess
    return await create_session(user_id)


async def create_session(user_id: str, title: str | None = None) -> dict[str, Any]:
    """Create a new conversation session for the user."""
    new = StylistSession(user_id=user_id, title=title).model_dump()
    db = get_db()
    await repos.insert(db.stylist_sessions, new)
    return new


async def list_sessions(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Newest-first list of the user's sessions for the conversation sidebar."""
    db = get_db()
    rows = await repos.find_many(
        db.stylist_sessions,
        {"user_id": user_id, "archived": {"$ne": True}},
        sort=[("last_active_at", -1)],
        limit=limit,
    )
    return rows


async def get_session(session_id: str, user_id: str) -> dict[str, Any] | None:
    """Fetch a session by id with ownership enforcement."""
    db = get_db()
    return await repos.find_one(
        db.stylist_sessions, {"id": session_id, "user_id": user_id}
    )


async def update_session(
    session_id: str,
    user_id: str,
    *,
    title: str | None = None,
    snippet: str | None = None,
) -> dict[str, Any] | None:
    db = get_db()
    patch: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if title is not None:
        patch["title"] = title
    if snippet is not None:
        patch["snippet"] = snippet
    await db.stylist_sessions.update_one(
        {"id": session_id, "user_id": user_id}, {"$set": patch}
    )
    return await get_session(session_id, user_id)


async def delete_session(session_id: str, user_id: str) -> bool:
    """Remove a session (and cascade its messages) — returns True if deleted."""
    db = get_db()
    res = await db.stylist_sessions.delete_one(
        {"id": session_id, "user_id": user_id}
    )
    if res.deleted_count:
        await db.stylist_messages.delete_many({"session_id": session_id})
        return True
    return False


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
async def recent_messages(session_id: str, limit: int = 6) -> list[dict[str, Any]]:
    """Return oldest-first list of recent messages for Gemini context."""
    db = get_db()
    rows = await repos.find_many(
        db.stylist_messages,
        {"session_id": session_id},
        sort=[("created_at", -1)],
        limit=limit,
    )
    return list(reversed(rows))


async def full_history(session_id: str, limit: int = 200) -> list[dict[str, Any]]:
    """Return oldest-first list of messages for rendering in the chat panel."""
    db = get_db()
    rows = await repos.find_many(
        db.stylist_messages,
        {"session_id": session_id},
        sort=[("created_at", 1)],
        limit=limit,
    )
    return rows


async def append_message(
    session_id: str,
    role: str,
    input_modality: str,
    *,
    transcript: str | None = None,
    image_refs: list[str] | None = None,
    context: dict[str, Any] | None = None,
    assistant_payload: dict[str, Any] | None = None,
    tts_audio_ref: str | None = None,
    latency_ms: dict[str, int] | None = None,
) -> dict[str, Any]:
    db = get_db()
    msg = StylistMessage(
        session_id=session_id,
        role=role,  # type: ignore[arg-type]
        input_modality=input_modality,  # type: ignore[arg-type]
        transcript=transcript,
        image_refs=image_refs or [],
        context=context or {},
        assistant_payload=assistant_payload,
        tts_audio_ref=tts_audio_ref,
        latency_ms=latency_ms or {},
    )
    doc = msg.model_dump()
    await repos.insert(db.stylist_messages, doc)
    # bump session counters + snippet (only for user turns so the sidebar
    # preview is meaningful).
    session_patch: dict[str, Any] = {
        "last_active_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if role == "user" and transcript:
        # Truncate to a manageable preview length for the sidebar.
        session_patch["snippet"] = transcript.strip()[:140]
    await db.stylist_sessions.update_one(
        {"id": session_id},
        {"$inc": {"turns": 1}, "$set": session_patch},
    )
    return doc


# ---------------------------------------------------------------------------
# Closet summary (used by the stylist for grounding)
# ---------------------------------------------------------------------------
async def closet_summary_for(user_id: str, limit: int = 40) -> list[dict[str, Any]]:
    db = get_db()
    rows = await repos.find_many(
        db.closet_items,
        {
            "user_id": user_id,
            # Phase Z2 — user-approved duplicates are excluded from
            # the grounding context the Stylist Brain receives, so it
            # cannot reason about an item it shouldn't surface.
            "is_duplicate": {"$ne": True},
            # Phase Grouping — exclude group members
            "group_role": {"$ne": "member"},
        },
        sort=[("updated_at", -1)],
        limit=limit,
    )

    # Collect group_ids of the loaded items to fetch members
    group_ids = [r["group_id"] for r in rows if r.get("group_id")]
    members_by_group = {}
    if group_ids:
        members_cursor = db.closet_items.find({
            "group_id": {"$in": group_ids},
            "group_role": "member",
            "is_duplicate": {"$ne": True},
        })
        members = [doc async for doc in members_cursor]
        from collections import defaultdict
        members_by_group = defaultdict(list)
        for m in members:
            members_by_group[m["group_id"]].append(m)

    def norm_category(cat):
        s = str(cat or "").strip().lower().replace(" ", "_")
        if s in ("top", "tops"): return "top"
        if s in ("bottom", "bottoms"): return "bottom"
        if s in ("footwear", "shoes"): return "footwear"
        if s in ("accessory", "accessories"): return "accessories"
        return s

    final_items = []
    for r in rows:
        final_items.append(r)
        g_id = r.get("group_id")
        if g_id and g_id in members_by_group:
            g_members = members_by_group[g_id]
            # Check if it is a set (different categories)
            all_cats = {norm_category(r.get("category")), *(norm_category(m.get("category")) for m in g_members)}
            if len(all_cats) > 1:
                # It's a set! Append the members of the set as well
                final_items.extend(g_members)

    res = []
    for r in final_items:
        g_id = r.get("group_id")
        is_part_of_set = False
        if g_id and g_id in members_by_group:
            g_members = members_by_group[g_id]
            all_cats = {norm_category(r.get("category")), *(norm_category(m.get("category")) for m in g_members)}
            is_part_of_set = len(all_cats) > 1
        elif g_id:
            # If it's in final_items and is a member, it was added because it's a set!
            is_part_of_set = True

        item_dict = {
            "id": r["id"],
            "title": r.get("title"),
            "category": r.get("category"),
            "sub_category": r.get("sub_category"),
            "color": r.get("color"),
            "material": r.get("material"),
            "pattern": r.get("pattern"),
            "formality": r.get("formality"),
            "season": r.get("season") or [],
            "tags": r.get("tags") or [],
            "source": r.get("source"),
        }
        if is_part_of_set:
            item_dict["group_id"] = g_id
            item_dict["group_role"] = r.get("group_role")
            item_dict["is_set"] = True
        res.append(item_dict)

    return res


# ---------------------------------------------------------------------------
# Backwards-compatibility shim
# ---------------------------------------------------------------------------
get_or_create_session = get_or_create_active_session  # legacy imports
