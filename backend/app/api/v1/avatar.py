"""Avatar routing."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.avatar_service import calculate_shape_parameters, get_default_measurements

router = APIRouter(prefix="/avatar", tags=["avatar"])


@router.get("/params")
async def get_avatar_params(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Get the current shape parameters based on the user's body measurements."""
    db = get_db()
    full_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found")

    sex = full_user.get("sex") or "female"
    user_measurements = full_user.get("body_measurements") or {}
    defaults = get_default_measurements(sex)

    # Merge user measurements with anatomical defaults
    merged_measurements = {
        "height": float(user_measurements.get("height", defaults["height"])),
        "shoulders": float(user_measurements.get("shoulders", defaults["shoulders"])),
        "chest": float(user_measurements.get("chest", defaults["chest"])),
        "waist": float(user_measurements.get("waist", defaults["waist"])),
        "hips": float(user_measurements.get("hips", user_measurements.get("hip", defaults["hips"]))),
        "arm_length": float(user_measurements.get("arm_length", user_measurements.get("armLength", defaults["arm_length"]))),
        "inseam": float(user_measurements.get("inseam", defaults["inseam"])),
        "gender": str(user_measurements.get("gender", sex)).lower()
    }

    shape_params = calculate_shape_parameters(merged_measurements, sex=sex)
    
    # Store it in the DB since we added it to schema
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "avatar_shape_params": shape_params,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "shape_params": shape_params,
        "measurements": merged_measurements,
        "gender": sex,
        "skin_tone": full_user.get("skin_tone") or None
    }

