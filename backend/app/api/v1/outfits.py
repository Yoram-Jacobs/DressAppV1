"""REST API Routes for User Saved Outfits & Scheduler Triggers (Phase Scheduler)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Body, Response
from pydantic import BaseModel

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.stylist_scheduler_brain import (
    generate_scheduled_proposals,
    generate_event_proposals,
    reject_garment,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/outfits", tags=["outfits"])


class GarmentItemIn(BaseModel):
    closet_item_id: str | None = None
    role: str
    title: str | None = None
    image_url: str | None = None


class OutfitUsageIn(BaseModel):
    date: str
    time: str
    location: str | None = None
    event_name: str | None = None


class SaveOutfitIn(BaseModel):
    name: str
    description: str | None = None
    source_workflow: str  # "scheduled" | "event"
    prompt: str | None = None
    garments: list[GarmentItemIn]
    usage: OutfitUsageIn
    is_fallback: bool | None = None


class EventProposalIn(BaseModel):
    prompt: str
    date: str | None = None
    time: str | None = None
    location: str | None = None
    event_name: str | None = None


def _safe_doc(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_saved_outfits(
    user: dict = Depends(get_current_user),
    limit: int = 50,
) -> dict[str, Any]:
    """Get all saved outfits for the user."""
    db = get_db()
    cursor = db.outfits.find({"user_id": user["id"]}).sort([("created_at", -1)]).limit(limit)
    rows = [doc async for doc in cursor]
    return {"outfits": [_safe_doc(r) for r in rows]}


@router.post("", status_code=201)
async def save_outfit(
    payload: SaveOutfitIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Save an outfit to the user's closet diary, updating worn stats for closet items."""
    db = get_db()
    import uuid

    outfit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Automatically resolve closet item details if missing
    garments = []
    for g in payload.garments:
        g_dict = g.model_dump()
        if g.closet_item_id:
            item = await db.closet_items.find_one({"id": g.closet_item_id})
            if item:
                g_dict["title"] = g_dict.get("title") or item.get("title") or item.get("name") or g.role
                g_dict["image_url"] = g_dict.get("image_url") or item.get("thumbnail_data_url") or item.get("segmented_image_url") or item.get("original_image_url")
        garments.append(g_dict)

    use_count = 1 if (payload.usage and payload.usage.date) else 0
    doc = {
        "id": outfit_id,
        "user_id": user["id"],
        "name": payload.name,
        "description": payload.description,
        "source_workflow": payload.source_workflow,
        "prompt": payload.prompt,
        "garments": garments,
        "usage": payload.usage.model_dump(),
        "use_count": use_count,
        "created_at": now,
        "updated_at": now,
        "is_fallback": payload.is_fallback or False,
    }

    # Insert Saved Outfit
    await db.outfits.insert_one(doc)

    # Update Closet Items: increment wear count and set last_worn_at
    closet_item_ids = [g.closet_item_id for g in payload.garments if g.closet_item_id]
    if closet_item_ids:
        # Update last_worn_at to usage date (or current date as fallback)
        worn_date = payload.usage.date or now.split("T")[0]
        await db.closet_items.update_many(
            {"id": {"$in": closet_item_ids}, "user_id": user["id"]},
            {
                "$inc": {"wear_count": 1},
                "$set": {
                    "last_worn_at": worn_date,
                    "updated_at": now,
                },
            },
        )

    logger.info("Saved outfit id=%s user_id=%s", outfit_id, user["id"])
    return _safe_doc(doc)


@router.delete("/{outfit_id}")
async def delete_saved_outfit(
    outfit_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a saved outfit."""
    db = get_db()
    res = await db.outfits.delete_one({"id": outfit_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outfit not found")
    return {"deleted": True, "id": outfit_id}


@router.post("/proposal/scheduled")
async def trigger_scheduled_proposal(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate 3 scheduled outfit suggestions based on user settings."""
    s_set = user.get("scheduler_settings") or {}
    style_preference = s_set.get("style_dress_for") or "casual/daily dress"
    
    try:
        advice = await generate_scheduled_proposals(user, style_preference)
        return {"advice": advice}
    except Exception as exc:
        logger.warning("Scheduled proposal generation failed, falling back: %s", exc)
        try:
            from app.services.scheduler import _generate_fallback_advice
            from app.services.stylist_scheduler_brain import get_rotation_prioritized_closet
            closet_items = await get_rotation_prioritized_closet(user["id"], limit=20)
            advice = _generate_fallback_advice(closet_items, style_preference)
            return {"advice": advice}
        except Exception as inner_exc:
            logger.error("Failed to generate fallback proposals: %s", inner_exc)
            raise HTTPException(status_code=500, detail=str(exc))


@router.post("/proposal/event")
async def trigger_event_proposal(
    payload: EventProposalIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate 3 event outfit suggestions based on user prompt."""
    try:
        advice = await generate_event_proposals(
            user=user,
            event_prompt=payload.prompt,
            location=payload.location,
            event_name=payload.event_name,
        )
        return {"advice": advice}
    except Exception as exc:
        logger.exception("Event proposal generation failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/reject-item")
async def reject_item_suggestion(
    item_id: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Record a suggestion rejection for a garment, returning if user should share it."""
    try:
        res = await reject_garment(user["id"], item_id)
        return res
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as exc:
        logger.exception("Item rejection tracking failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/notifications")
async def list_simulated_notifications(
    user: dict = Depends(get_current_user),
    limit: int = 50,
) -> dict[str, Any]:
    """List mock notifications sent to the user."""
    db = get_db()
    cursor = db.simulated_notifications.find({"user_id": user["id"]}).sort([("created_at", -1)]).limit(limit)
    rows = [doc async for doc in cursor]
    return {"notifications": [_safe_doc(r) for r in rows]}


@router.post("/notifications/clear")
async def clear_simulated_notifications(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Clear all mock notifications for testing."""
    db = get_db()
    await db.simulated_notifications.delete_many({"user_id": user["id"]})
    return {"cleared": True}


class WebPushSubscriptionIn(BaseModel):
    endpoint: str
    expirationTime: int | None = None
    keys: dict[str, str]


@router.post("/webpush/subscribe")
async def webpush_subscribe(
    payload: WebPushSubscriptionIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Register a Web Push subscription for the current user."""
    db = get_db()
    sub_dict = payload.model_dump()
    
    # Check if subscription already exists to avoid duplicates
    existing = await db.users.find_one({
        "id": user["id"],
        "web_push_subscriptions.endpoint": payload.endpoint
    })
    
    if not existing:
        await db.users.update_one(
            {"id": user["id"]},
            {"$push": {"web_push_subscriptions": sub_dict}}
        )
        logger.info("Registered web push subscription for user_id=%s", user["id"])
    return {"subscribed": True}


@router.post("/webpush/unsubscribe")
async def webpush_unsubscribe(
    endpoint: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Remove a Web Push subscription for the current user."""
    db = get_db()
    await db.users.update_one(
        {"id": user["id"]},
        {"$pull": {"web_push_subscriptions": {"endpoint": endpoint}}}
    )
    logger.info("Unsubscribed web push endpoint for user_id=%s", user["id"])
    return {"unsubscribed": True}


@router.get("/webpush/vapid-key")
async def get_vapid_key(
    user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Get the VAPID public key for frontend push registration."""
    from app.config import settings
    return {"public_key": settings.VAPID_PUBLIC_KEY}


class UpdateOutfitUsageIn(BaseModel):
    date: str | None = None
    time: str | None = None
    location: str | None = None
    event_name: str | None = None


class UpdateOutfitIn(BaseModel):
    name: str | None = None
    description: str | None = None
    usage: UpdateOutfitUsageIn | None = None


@router.patch("/{outfit_id}")
async def update_saved_outfit(
    outfit_id: str,
    payload: UpdateOutfitIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a saved outfit's metadata (e.g. usage date, name)."""
    db = get_db()
    existing = await db.outfits.find_one({"id": outfit_id, "user_id": user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Outfit not found")
        
    update_doc = {}
    if payload.name is not None:
        update_doc["name"] = payload.name

    if payload.description is not None:
        update_doc["description"] = payload.description
        
    if payload.usage is not None:
        usage = existing.get("usage") or {}
        old_date = usage.get("date")
        usage_payload = payload.usage.model_dump(exclude_unset=True)
        new_date = usage_payload.get("date")
        
        # If rescheduled/scheduled to a new date, increment wear count
        if new_date and new_date != old_date:
            update_doc["use_count"] = existing.get("use_count", 0) + 1
            
        usage.update(usage_payload)
        update_doc["usage"] = usage
        
    if update_doc:
        update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.outfits.update_one(
            {"id": outfit_id, "user_id": user["id"]},
            {"$set": update_doc}
        )
        
    res_doc = await db.outfits.find_one({"id": outfit_id, "user_id": user["id"]})
    return _safe_doc(res_doc)


@router.post("/{outfit_id}/share-card")
async def save_outfit_share_card(
    outfit_id: str,
    image_b64: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Store the base64-encoded share card for an outfit."""
    db = get_db()
    existing = await db.outfits.find_one({"id": outfit_id, "user_id": user["id"]})
    if not existing:
        # Fallback to shared_outfits collection if shared
        existing_shared = await db.shared_outfits.find_one({"id": outfit_id})
        if not existing_shared:
            raise HTTPException(status_code=404, detail="Outfit not found")
        await db.shared_outfits.update_one(
            {"id": outfit_id},
            {"$set": {"share_card_b64": image_b64}}
        )
        return {
            "share_card_url": f"/api/v1/outfits/{outfit_id}/share-card/image",
            "share_url": f"/shared/{outfit_id}",
        }
    
    await db.outfits.update_one(
        {"id": outfit_id, "user_id": user["id"]},
        {"$set": {"share_card_b64": image_b64, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {
        "share_card_url": f"/api/v1/outfits/{outfit_id}/share-card/image",
        "share_url": f"/shared/{outfit_id}",
    }


@router.get("/{outfit_id}/share-card/image")
async def get_outfit_share_card_image(outfit_id: str) -> Response:
    """Serve the raw PNG image of the outfit's share card."""
    db = get_db()
    doc = await db.outfits.find_one({"id": outfit_id})
    if not doc or not doc.get("share_card_b64"):
        # Check shared_outfits
        doc = await db.shared_outfits.find_one({"id": outfit_id})
        if not doc or not doc.get("share_card_b64"):
            raise HTTPException(status_code=404, detail="Share card image not found")
            
    import base64
    
    b64_data = doc["share_card_b64"]
    if "," in b64_data:
        b64_data = b64_data.split(",")[1]
    
    img_bytes = base64.b64decode(b64_data)
    return Response(content=img_bytes, media_type="image/png")




