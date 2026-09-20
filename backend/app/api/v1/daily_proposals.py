"""Unified Daily Suggestions & Scheduled Proposals across all interfaces."""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.sync_service import broadcast_sync_event
from app.services.stylist_scheduler_brain import (
    calculate_garment_style_score,
    generate_scheduled_proposals,
    norm_category,
)

logger = logging.getLogger("dressapp.daily_proposals")

router = APIRouter(prefix="/stylist", tags=["stylist"])


class ProposalActionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    action: str  # "wear" | "like" | "dismiss" | "unlike" | "unwear"
    proposal_id: str | None = None
    date: str | None = None


class ProposalGenerateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    occasion: str = "daily"
    force: bool = False
    date: str | None = None


def _resolve_effective_style(user: dict, occasion: str | None = None) -> str:
    sched = user.get("scheduler_settings") or {}
    style_option = sched.get("style_option") or sched.get("style")
    if style_option == "tags":
        selected_tags = sched.get("selected_tags")
        if isinstance(selected_tags, list) and selected_tags:
            return ", ".join(str(t) for t in selected_tags if t).strip()
        if sched.get("custom_style"):
            return sched.get("custom_style").strip()
        return "casual"
    elif style_option == "custom":
        if sched.get("custom_style"):
            return sched.get("custom_style").strip()
        if sched.get("style_dress_for") and sched.get("style_dress_for") not in ("custom", "tags", "daily", "default"):
            return sched.get("style_dress_for").strip()
        return "casual"

    if sched.get("style_dress_for") and sched.get("style_dress_for") not in ("daily", "default", "custom", "tags"):
        return sched.get("style_dress_for").strip()
    if isinstance(sched.get("selected_tags"), list) and sched.get("selected_tags"):
        return ", ".join(str(t) for t in sched.get("selected_tags") if t).strip()
    if sched.get("custom_style"):
        return sched.get("custom_style").strip()
    if occasion and occasion != "daily":
        return occasion.strip()
    return "casual"


@router.get("/daily-proposal")
async def get_daily_proposal(
    date: str | None = None,
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Get the active scheduled daily outfit proposal for the user across all devices.
    
    If date is explicitly requested, returns the proposal for that date.
    Otherwise checks tomorrow's proposal first (the upcoming scheduled look to prepare for),
    then today's proposal, or generates for tomorrow.
    """
    db = get_db()
    sched = user.get("scheduler_settings") or {}
    user_tz = sched.get("timezone") or "UTC"
    try:
        from zoneinfo import ZoneInfo
        from datetime import timedelta
        local_now = datetime.now(timezone.utc).astimezone(ZoneInfo(user_tz))
    except Exception:
        from datetime import timedelta
        local_now = datetime.now(timezone.utc)

    today_str = local_now.strftime("%Y-%m-%d")
    tomorrow_str = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")

    # 1. If explicit date passed, return proposal for that date
    if date:
        doc = await db.daily_proposals.find_one(
            {"user_id": user["id"], "date": date, "dismissed": {"$ne": True}},
            {"_id": 0},
            sort=[("worn", -1), ("created_at", -1)],
        )
        if doc and len(doc.get("items") or []) > 0:
            return doc
        return await _generate_and_save_daily_proposal(user, date, force=False)

    # 2. Check tomorrow's proposal first (pushed the day before for advance prep)
    tom_doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": tomorrow_str, "dismissed": {"$ne": True}},
        {"_id": 0},
        sort=[("worn", -1), ("created_at", -1)],
    )
    if tom_doc and len(tom_doc.get("items") or []) > 0:
        return tom_doc

    # 3. Check today's proposal (e.g. prepared yesterday for today)
    today_doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": today_str, "dismissed": {"$ne": True}},
        {"_id": 0},
        sort=[("worn", -1), ("created_at", -1)],
    )
    if today_doc and len(today_doc.get("items") or []) > 0:
        return today_doc

    # 4. If neither exists, generate for tomorrow
    return await _generate_and_save_daily_proposal(user, tomorrow_str, force=False)


@router.post("/daily-proposal/generate")
async def generate_daily_proposal(
    body: ProposalGenerateIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate or regenerate daily proposal for tomorrow (or specified date)."""
    sched = user.get("scheduler_settings") or {}
    user_tz = sched.get("timezone") or "UTC"
    try:
        from zoneinfo import ZoneInfo
        from datetime import timedelta
        local_now = datetime.now(timezone.utc).astimezone(ZoneInfo(user_tz))
    except Exception:
        from datetime import timedelta
        local_now = datetime.now(timezone.utc)

    tomorrow_str = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")
    target_date = body.date or tomorrow_str

    res = await _generate_and_save_daily_proposal(user, target_date, force=body.force, occasion=body.occasion)
    await broadcast_sync_event(user["id"], "daily_suggestions_updated", {"proposal_id": res.get("id")})
    return res


@router.post("/daily-proposal/action")
async def act_on_daily_proposal(
    body: ProposalActionIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Record an action on today's proposal (worn, liked, dismissed) and sync across all devices."""
    db = get_db()
    today_str = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query: dict[str, Any] = {"user_id": user["id"]}
    if body.proposal_id:
        query["id"] = body.proposal_id
    else:
        query["date"] = today_str
        
    update_data: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.action == "wear":
        update_data["worn"] = True
    elif body.action == "unwear":
        update_data["worn"] = False
    elif body.action == "like":
        update_data["liked"] = True
    elif body.action == "unlike":
        update_data["liked"] = False
    elif body.action == "dismiss":
        update_data["dismissed"] = True
        
    res = await db.daily_proposals.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0},
    )
    
    if not res:
        # Fallback to date query if proposal_id wasn't found
        res = await db.daily_proposals.find_one_and_update(
            {"user_id": user["id"], "date": today_str},
            {"$set": update_data},
            return_document=True,
            projection={"_id": 0},
        )
        if not res:
            raise HTTPException(status_code=404, detail="Proposal not found")

    # If worn, purge unselected intermediate daily proposals for this user & date
    if body.action == "wear":
        try:
            await db.daily_proposals.delete_many({
                "user_id": user["id"],
                "date": today_str,
                "id": {"$ne": res.get("id")},
                "worn": {"$ne": True},
            })
        except Exception as p_err:
            logger.warning("Failed to purge intermediate proposals: %s", p_err)
        
    await broadcast_sync_event(
        user["id"],
        "daily_suggestions_updated",
        {"proposal_id": res.get("id"), "action": body.action},
    )
    return res


async def _generate_and_save_daily_proposal(
    user: dict,
    date_str: str,
    force: bool = False,
    occasion: str = "daily",
) -> dict[str, Any]:
    """Helper to pick or generate a smart, diverse outfit from closet and store it in daily_proposals."""
    db = get_db()
    effective_occasion = _resolve_effective_style(user, occasion)
    
    # Check if valid existing exists unless force=True
    if not force:
        existing = await db.daily_proposals.find_one(
            {"user_id": user["id"], "date": date_str, "dismissed": {"$ne": True}},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if existing and len(existing.get("items") or []) > 0:
            return existing
            
    if force:
        # On 'New Look', mark previous proposals for today as replaced and unwear them
        await db.daily_proposals.update_many(
            {"user_id": user["id"], "date": date_str},
            {"$set": {"worn": False, "replaced": True, "dismissed": True}},
        )

    # Gather items already used in today's proposals to avoid repeats on "New Look"
    past_proposals_cursor = db.daily_proposals.find({"user_id": user["id"], "date": date_str})
    past_proposals = [doc async for doc in past_proposals_cursor]
    past_item_ids: set[str] = set()
    for pdp in past_proposals:
        for it in (pdp.get("items") or []):
            if it.get("id"):
                past_item_ids.add(it["id"])
            if it.get("closet_item_id"):
                past_item_ids.add(it["closet_item_id"])

    # Fetch user's closet items
    cursor = db.closet_items.find({"user_id": user["id"], "is_duplicate": {"$ne": True}}).limit(100)
    items = [doc async for doc in cursor]

    def _cat(i: dict) -> str:
        return norm_category(i.get("category"))

    def _best_img(i: dict) -> str | None:
        pref = i.get("preferred_image_view")
        if pref in ("clean", "original"):
            return (
                i.get("clean_image_url")
                or i.get("reconstructed_image_url")
                or i.get("image_url")
                or i.get("thumbnail_url")
                or i.get("thumbnail_data_url")
            )
        return (
            i.get("reconstructed_image_url")
            or i.get("clean_image_url")
            or i.get("image_url")
            or i.get("thumbnail_url")
            or i.get("thumbnail_data_url")
        )

    # 1. Try AI-powered recommendation first (curates 1 daily outfit)
    selected_items: list[dict[str, Any]] = []
    proposal_title = "Look of the Day"
    proposal_desc = "Curated based on your style profile, weather conditions, and closet harmony."
    proposal_harmony = 94

    ai_generated = False
    try:
        scheduler_res = await generate_scheduled_proposals(
            user,
            style_dress_for=effective_occasion,
            exclude_item_ids=past_item_ids,
            target_date=date_str,
        )
        recs = scheduler_res.get("outfit_recommendations") or []
        if recs:
            chosen_rec = recs[0]
            proposal_title = chosen_rec.get("name") or proposal_title
            proposal_desc = chosen_rec.get("why") or proposal_desc
            confidence = chosen_rec.get("confidence")
            if confidence:
                proposal_harmony = min(99, max(80, int(confidence * 100)))

            item_map = {item["id"]: item for item in items}
            for it in chosen_rec.get("items", []):
                cid = it.get("closet_item_id")
                closet_doc = item_map.get(cid)
                if closet_doc:
                    selected_items.append({
                        "id": closet_doc.get("id"),
                        "closet_item_id": closet_doc.get("id"),
                        "role": it.get("role") or _cat(closet_doc) or "item",
                        "name": closet_doc.get("title") or closet_doc.get("name") or it.get("description") or "Garment",
                        "category": closet_doc.get("category"),
                        "image_url": _best_img(closet_doc),
                    })
            if len(selected_items) >= 2:
                ai_generated = True
    except Exception as ai_exc:
        logger.warning("AI scheduled proposals generation fallback: %s", ai_exc)

    # 2. Smart Diversified Closet Fallback if AI didn't return full outfit
    if not ai_generated or len(selected_items) < 2:
        selected_items = []
        # Categorize items into buckets
        tops = [i for i in items if _cat(i) == "top"]
        bottoms = [i for i in items if _cat(i) == "bottom"]
        shoes = [i for i in items if _cat(i) == "shoes"]
        dresses = [i for i in items if _cat(i) == "dress"]
        outerwear = [i for i in items if _cat(i) == "outerwear"]
        accessories = [i for i in items if _cat(i) == "accessory"]

        # Sort each bucket: unused today first, then matching custom style tag, then lowest wear count, with random jitter
        def _fallback_sort_key(item: dict) -> tuple:
            iid = item.get("id")
            already_used = 1 if (iid in past_item_ids) else 0
            style_score = calculate_garment_style_score(item, effective_occasion)
            wear_count = item.get("wear_count") or 0
            jitter = random.random()
            return (already_used, -style_score, wear_count, jitter)

        tops.sort(key=_fallback_sort_key)
        bottoms.sort(key=_fallback_sort_key)
        shoes.sort(key=_fallback_sort_key)
        dresses.sort(key=_fallback_sort_key)
        outerwear.sort(key=_fallback_sort_key)
        accessories.sort(key=_fallback_sort_key)

        # Decide whether dress or top+bottom
        use_dress = bool(dresses and (not tops or not bottoms or random.random() < 0.25))

        if use_dress and dresses:
            d0 = dresses[0]
            selected_items.append({
                "id": d0.get("id"),
                "closet_item_id": d0.get("id"),
                "role": "dress",
                "name": d0.get("title") or d0.get("name") or "Dress",
                "category": d0.get("category"),
                "image_url": _best_img(d0),
            })
        else:
            if tops:
                t0 = tops[0]
                selected_items.append({
                    "id": t0.get("id"),
                    "closet_item_id": t0.get("id"),
                    "role": "top",
                    "name": t0.get("title") or t0.get("name") or "Top",
                    "category": t0.get("category"),
                    "image_url": _best_img(t0),
                })
            if bottoms:
                b0 = bottoms[0]
                selected_items.append({
                    "id": b0.get("id"),
                    "closet_item_id": b0.get("id"),
                    "role": "bottom",
                    "name": b0.get("title") or b0.get("name") or "Bottom",
                    "category": b0.get("category"),
                    "image_url": _best_img(b0),
                })

        if shoes:
            s0 = shoes[0]
            selected_items.append({
                "id": s0.get("id"),
                "closet_item_id": s0.get("id"),
                "role": "shoes",
                "name": s0.get("title") or s0.get("name") or "Shoes",
                "category": s0.get("category"),
                "image_url": _best_img(s0),
            })

        # Optionally add outerwear
        if outerwear and random.random() < 0.5:
            ow0 = outerwear[0]
            selected_items.append({
                "id": ow0.get("id"),
                "closet_item_id": ow0.get("id"),
                "role": "outerwear",
                "name": ow0.get("title") or ow0.get("name") or "Outerwear",
                "category": ow0.get("category"),
                "image_url": _best_img(ow0),
            })

        # Optionally add accessory
        if accessories and random.random() < 0.4:
            acc0 = accessories[0]
            selected_items.append({
                "id": acc0.get("id"),
                "closet_item_id": acc0.get("id"),
                "role": "accessory",
                "name": acc0.get("title") or acc0.get("name") or "Accessory",
                "category": acc0.get("category"),
                "image_url": _best_img(acc0),
            })

        # Generate vibrant title based on selected items & occasion
        color_names = [i.get("color") for i in items if i.get("id") in [x["id"] for x in selected_items] and i.get("color")]
        style_adjectives = ["Effortless", "Crisp", "Polished", "Modern", "Refined", "Relaxed", "Vibrant", "Chic", "Smart"]
        adj = random.choice(style_adjectives)
        if effective_occasion and effective_occasion not in ("casual", "daily", "default"):
            proposal_title = f"{adj} {effective_occasion.title()} Look"
        elif color_names:
            proposal_title = f"{adj} {color_names[0].title()} Look"
        else:
            proposal_title = f"{adj} Everyday Look"
        proposal_desc = f"Curated based on your '{effective_occasion}' preference, weather conditions, and closet harmony."
        proposal_harmony = random.randint(88, 97) if len(selected_items) >= 2 else 85
        
    proposal = {
        "id": f"prop_{uuid.uuid4().hex[:12]}",
        "user_id": user["id"],
        "date": date_str,
        "title": proposal_title,
        "description": proposal_desc,
        "weather_summary": "Mild & Pleasant",
        "temperature": 22,
        "items": selected_items,
        "harmony_score": proposal_harmony,
        "worn": False,
        "liked": False,
        "dismissed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.daily_proposals.insert_one(proposal)
    
    return {k: v for k, v in proposal.items() if k != "_id"}
