"""Unified Daily Suggestions & Scheduled Proposals across all interfaces."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.sync_service import broadcast_sync_event

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


@router.get("/daily-proposal")
async def get_daily_proposal(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Get today's shared daily outfit proposal for the user across all devices."""
    db = get_db()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": today_str},
        {"_id": 0},
    )
    
    if doc:
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
    res = await _generate_and_save_daily_proposal(user, today_str, force=body.force)
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
        raise HTTPException(status_code=404, detail="Proposal not found")

    # If worn, purge unselected intermediate daily proposals for this user & date
    if body.action == "wear":
        try:
            await db.daily_proposals.delete_many({
                "user_id": user["id"],
                "date": today_str,
                "id": {"$ne": res.get("id")},
                "worn": {"$ne": True}
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
    occasion: str = "daily"
) -> dict[str, Any]:
    """Helper to pick or generate a smart, diverse outfit from closet and store it in daily_proposals."""
    import random
    from app.services.stylist_scheduler_brain import generate_scheduled_proposals
    db = get_db()
    
    # Check if valid existing exists unless force=True
    if not force:
        existing = await db.daily_proposals.find_one(
            {"user_id": user["id"], "date": date_str},
            {"_id": 0},
        )
        if existing and len(existing.get("items") or []) > 0:
            return existing
            
    # Fetch user's closet items
    cursor = db.closet_items.find({"user_id": user["id"]}).limit(100)
    items = [doc async for doc in cursor]

    def _cat(i: dict) -> str:
        return (i.get("category") or "").strip().lower()

    def _subcat(i: dict) -> str:
        return (i.get("sub_category") or i.get("subcategory") or "").strip().lower()

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
        scheduler_res = await generate_scheduled_proposals(user, style_dress_for=occasion)
        recs = scheduler_res.get("outfit_recommendations") or []
        if recs:
            # Pick a random recommendation if multiple exist for diversity
            chosen_rec = random.choice(recs)
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
        # Categorize items robustly
        tops = [i for i in items if _cat(i) in ("top", "tops", "shirt", "t-shirt", "sweater", "blouse", "polo", "hoodie")]
        bottoms = [i for i in items if _cat(i) in ("bottom", "bottoms", "pants", "jeans", "skirt", "shorts", "trousers", "leggings")]
        shoes = [i for i in items if _cat(i) in ("shoes", "sneakers", "boots", "sandals", "footwear", "heels", "loafers")]
        dresses = [i for i in items if _cat(i) in ("dress", "one-piece", "jumpsuit", "romper")]
        outerwear = [i for i in items if _cat(i) in ("outerwear", "jacket", "coat", "blazer", "cardigan", "vest")]
        accessories = [i for i in items if _cat(i) in ("accessory", "accessories", "bag", "belt", "hat", "scarf")]

        # Shuffle for diverse combination on every click
        random.shuffle(tops)
        random.shuffle(bottoms)
        random.shuffle(shoes)
        random.shuffle(dresses)
        random.shuffle(outerwear)
        random.shuffle(accessories)

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

        # Optionally add outerwear (50% chance if available)
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

        # Optionally add accessory (40% chance if available)
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

        # Generate vibrant title based on selected items
        color_names = [i.get("color") for i in items if i.get("id") in [x["id"] for x in selected_items] and i.get("color")]
        style_adjectives = ["Effortless", "Crisp", "Polished", "Modern", "Refined", "Relaxed", "Vibrant", "Chic", "Smart"]
        adj = random.choice(style_adjectives)
        if color_names:
            proposal_title = f"{adj} {color_names[0].title()} Look"
        else:
            proposal_title = f"{adj} Everyday Look"
        proposal_desc = "Curated based on your style profile, weather conditions, and closet harmony."
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
    
    await db.daily_proposals.update_one(
        {"user_id": user["id"], "date": date_str},
        {"$set": proposal},
        upsert=True,
    )
    
    return {k: v for k, v in proposal.items() if k != "_id"}
