"""Avatar routing."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.avatar_service import calculate_shape_parameters

router = APIRouter(prefix="/avatar", tags=["avatar"])


@router.get("/params")
async def get_avatar_params(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Get the current shape parameters based on the user's body measurements."""
    db = get_db()
    full_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found")

    measurements = full_user.get("body_measurements") or {}
    shape_params = calculate_shape_parameters(measurements)
    
    # Store it in the DB since we added it to schema
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "avatar_shape_params": shape_params,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"shape_params": shape_params}
