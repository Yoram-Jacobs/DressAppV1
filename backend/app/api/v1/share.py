"""/api/v1/share — tiny, intentionally minimal read-only snapshot store.

For Phase S we only need to share a single outfit recommendation via a link.
Recipients can open the link without logging in; they see a read-only JSON
payload the frontend renders. Richer features (approval voting, comments,
receiver chat, expiring links) are deferred.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from app.db.database import get_db
from app.services.auth import get_current_user

router = APIRouter(prefix="/share", tags=["share"])


@router.post("/outfit", status_code=201)
async def share_outfit(
    payload: dict[str, Any] = Body(...),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    outfit = payload.get("outfit")
    if not outfit or not isinstance(outfit, dict):
        raise HTTPException(400, "`outfit` (object) is required")
    snapshot = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "session_id": payload.get("session_id"),
        "outfit": outfit,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db = get_db()
    await db.shared_outfits.insert_one({**snapshot})
    # The frontend mints the fully-qualified URL so we don't have to know
    # the origin host server-side — keeps things portable across envs.
    return {
        "id": snapshot["id"],
        "owner_id": snapshot["owner_id"],
        "session_id": snapshot["session_id"],
        "created_at": snapshot["created_at"],
    }


@router.get("/outfit/{share_id}")
async def get_shared_outfit(share_id: str) -> dict[str, Any]:
    db = get_db()
    doc = await db.shared_outfits.find_one({"id": share_id}, {"_id": 0})
    if not doc:
        # Fallback to outfits collection
        outfit_doc = await db.outfits.find_one({"id": share_id}, {"_id": 0})
        if outfit_doc:
            return {
                "id": share_id,
                "owner_id": outfit_doc.get("user_id"),
                "outfit": outfit_doc,
                "created_at": outfit_doc.get("created_at"),
                "share_card_b64": outfit_doc.get("share_card_b64")
            }
        raise HTTPException(404, "Share not found")
    return doc


@router.post("/outfit/{share_id}/share-card")
async def save_shared_outfit_share_card(
    share_id: str,
    image_b64: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Store the base64-encoded share card for a shared outfit."""
    db = get_db()
    existing = await db.shared_outfits.find_one({"id": share_id})
    if not existing:
        existing_outfit = await db.outfits.find_one({"id": share_id, "user_id": user["id"]})
        if not existing_outfit:
            raise HTTPException(status_code=404, detail="Shared outfit not found")
        await db.outfits.update_one(
            {"id": share_id, "user_id": user["id"]},
            {"$set": {"share_card_b64": image_b64}}
        )
        return {
            "share_card_url": f"/api/v1/share/outfit/{share_id}/image",
        }
        
    await db.shared_outfits.update_one(
        {"id": share_id},
        {"$set": {"share_card_b64": image_b64}}
    )
    return {
        "share_card_url": f"/api/v1/share/outfit/{share_id}/image",
    }


@router.get("/outfit/{share_id}/image")
async def get_shared_outfit_image(share_id: str) -> Response:
    """Serve the raw PNG image of the shared outfit's share card."""
    db = get_db()
    doc = await db.shared_outfits.find_one({"id": share_id})
    if not doc or not doc.get("share_card_b64"):
        outfit_doc = await db.outfits.find_one({"id": share_id})
        if outfit_doc and outfit_doc.get("share_card_b64"):
            doc = outfit_doc
        else:
            raise HTTPException(status_code=404, detail="Image not found")
            
    import base64
    
    b64_data = doc["share_card_b64"]
    if "," in b64_data:
        b64_data = b64_data.split(",")[1]
        
    img_bytes = base64.b64decode(b64_data)
    return Response(content=img_bytes, media_type="image/png")

