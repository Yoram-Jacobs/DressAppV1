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


def _resolve_effective_style(user: dict, occasion: str | None = None) -> str:
    sched = user.get("scheduler_settings") or {}
    style_option = sched.get("style_option") or sched.get("style")
    if style_option == "custom" and sched.get("custom_style"):
        return sched.get("custom_style").strip()
    if sched.get("custom_style") and style_option not in ("casual", "formal", "sport", "smart_casual"):
        return sched.get("custom_style").strip()
    if sched.get("style_dress_for") and sched.get("style_dress_for") not in ("daily", "default"):
        return sched.get("style_dress_for").strip()
    if sched.get("custom_style"):
        return sched.get("custom_style").strip()
    if occasion and occasion != "daily":
        return occasion.strip()
    return sched.get("style_dress_for") or "casual"


@router.get("/daily-proposal")
async def get_daily_proposal(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Get today's shared daily outfit proposal for the user across all devices."""
    db = get_db()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Return worn proposal first if already chosen
    worn_doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": today_str, "worn": True},
        {"_id": 0},
    )
    if worn_doc and len(worn_doc.get("items") or []) > 0:
        return worn_doc

    # Otherwise return the most recent active proposal for today
    doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": today_str, "dismissed": {"$ne": True}},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    
    if doc and len(doc.get("items") or []) > 0:
        return doc
        
    # If not found, attempt to generate proposal
    return await _generate_and_save_daily_proposal(user, today_str, force=False)


@router.post("/daily-proposal/generate")
async def generate_daily_proposal(
    body: ProposalGenerateIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate or regenerate today's daily proposal."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    res = await _generate_and_save_daily_proposal(user, today_str, force=body.force, occasion=body.occasion)
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
        return (
            i.get("reconstructed_image_url")
            or i.get("clean_image_url")
            or i.get("image_url")
            or i.get("thumbnail_url")
            or i.get("thumbnail_data_url")
        )

    # 1. Try AI-powered recommendation first
    selected_items: list[dict[str, Any]] = []
    proposal_title = "Look of the Day"
    proposal_desc = "Curated based on your style profile, weather conditions, and closet harmony."
    proposal_harmony = 94

    ai_generated = False
    try:
        scheduler_res = await generate_scheduled_proposals(user, style_dress_for=effective_occasion)
        recs = scheduler_res.get("outfit_recommendations") or []
        if recs:
            # Score each recommendation by novelty (fewest overlapping items with past_item_ids)
            def _rec_novelty_score(r: dict) -> int:
                r_items = r.get("items") or []
                novel = sum(1 for it in r_items if (it.get("closet_item_id") or it.get("id")) not in past_item_ids)
                return novel

            sorted_recs = sorted(recs, key=_rec_novelty_score, reverse=True)
            # Pick from the top candidates with highest novel items
            top_novelty = _rec_novelty_score(sorted_recs[0])
            top_candidates = [r for r in sorted_recs if _rec_novelty_score(r) == top_novelty]
            chosen_rec = random.choice(top_candidates)

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
