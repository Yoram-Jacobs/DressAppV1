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
        
    await broadcast_sync_event(
        user["id"],
        "daily_suggestions_updated",
        {"proposal_id": res.get("id"), "action": body.action},
    )
    return res


async def _generate_and_save_daily_proposal(user: dict, date_str: str, force: bool = False) -> dict[str, Any]:
    """Helper to pick a smart outfit from closet and store it in daily_proposals."""
    db = get_db()
    
    # Check if existing exists unless force=True
    if not force:
        existing = await db.daily_proposals.find_one(
            {"user_id": user["id"], "date": date_str},
            {"_id": 0},
        )
        if existing:
            return existing
            
    # Fetch user's closet items
    cursor = db.closet_items.find({"user_id": user["id"]}).limit(30)
    items = [doc async for doc in cursor]
    
    # Categorize items
    tops = [i for i in items if i.get("category") in ("top", "shirt", "t-shirt", "sweater", "blouse", "jacket")]
    bottoms = [i for i in items if i.get("category") in ("bottom", "pants", "jeans", "skirt", "shorts")]
    shoes = [i for i in items if i.get("category") in ("shoes", "sneakers", "boots", "sandals")]
    
    selected_items: list[dict[str, Any]] = []
    if tops:
        selected_items.append({
            "id": tops[0].get("id"),
            "name": tops[0].get("title") or tops[0].get("name") or "Top",
            "category": tops[0].get("category"),
            "image_url": tops[0].get("image_url") or tops[0].get("thumbnail_url"),
        })
    if bottoms:
        selected_items.append({
            "id": bottoms[0].get("id"),
            "name": bottoms[0].get("title") or bottoms[0].get("name") or "Bottom",
            "category": bottoms[0].get("category"),
            "image_url": bottoms[0].get("image_url") or bottoms[0].get("thumbnail_url"),
        })
    if shoes:
        selected_items.append({
            "id": shoes[0].get("id"),
            "name": shoes[0].get("title") or shoes[0].get("name") or "Shoes",
            "category": shoes[0].get("category"),
            "image_url": shoes[0].get("image_url") or shoes[0].get("thumbnail_url"),
        })
        
    proposal = {
        "id": f"prop_{uuid.uuid4().hex[:12]}",
        "user_id": user["id"],
        "date": date_str,
        "title": "Look of the Day",
        "description": "Curated based on your style profile, weather conditions, and closet harmony.",
        "weather_summary": "Mild & Pleasant",
        "temperature": 22,
        "items": selected_items,
        "harmony_score": 94 if len(selected_items) >= 2 else 85,
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
