"""Internal management and dataset pipeline routes for automated training & sync."""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.config import settings
from app.db.database import get_db

logger = logging.getLogger("dressapp.internal.api")

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_internal_token(
    authorization: str | None = Header(default=None),
) -> bool:
    """Verify internal Bearer token matching EYES_API_TOKEN or settings secret."""
    expected_token = settings.EYES_API_TOKEN
    if not expected_token:
        # If no internal token is configured, allow in dev or log security warning
        logger.warning("EYES_API_TOKEN is not configured in backend settings")
        return True

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required for internal API",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format (expected 'Bearer <token>')",
        )

    client_token = parts[1]
    if not secrets.compare_digest(client_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: invalid internal service token",
        )

    return True


class WatermarkUpdateIn(BaseModel):
    item_count: int = Field(..., ge=0, description="Total items trained in this cycle")
    run_id: str | None = Field(default=None, description="GitHub Actions run ID or tag")
    metrics: dict[str, Any] | None = Field(default=None, description="Evaluation metrics")


@router.get("/training-status")
async def get_training_status(
    min_items: int = Query(default=500, ge=1),
    _: bool = Depends(verify_internal_token),
) -> dict[str, Any]:
    """Check whether the database contains >= min_items new approved items for training."""
    db = get_db()

    # Read current watermark from config
    watermark_doc = await db.config.find_one({"_id": "eyes_finetune_state"})
    last_finetuned_at = watermark_doc.get("last_finetuned_at") if watermark_doc else None

    # Base query for approved, non-duplicate items with an image
    base_filter: dict[str, Any] = {
        "is_duplicate": {"$ne": True},
        "$or": [
            {"thumbnail_data_url": {"$exists": True, "$ne": None}},
            {"reconstructed_image_url": {"$exists": True, "$ne": None}},
        ],
    }

    total_approved = await db.closet_items.count_documents(base_filter)

    new_filter = dict(base_filter)
    if last_finetuned_at:
        new_filter["created_at"] = {"$gt": last_finetuned_at}

    new_count = await db.closet_items.count_documents(new_filter)
    eligible = new_count >= min_items

    return {
        "eligible": eligible,
        "new_items_count": new_count,
        "total_approved_count": total_approved,
        "min_items_threshold": min_items,
        "last_finetuned_at": last_finetuned_at,
        "last_item_count": watermark_doc.get("last_item_count") if watermark_doc else 0,
        "recommendation": "PROCEED" if eligible else f"SKIP (Need {min_items - new_count} more new items)",
    }


@router.get("/training-items")
async def get_training_items(
    since: str | None = Query(default=None, description="ISO timestamp watermark"),
    min_items: int = Query(default=500, ge=1, description="Minimum new items threshold"),
    force: bool = Query(default=False, description="Bypass the min_items threshold check"),
    limit: int = Query(default=5000, ge=1, le=10000),
    _: bool = Depends(verify_internal_token),
) -> dict[str, Any]:
    """
    Fetch approved, non-duplicate items for Eyes fine-tuning dataset generation.
    Enforces the scheduling rule: requires >= min_items (default 500) newly added items,
    unless explicitly forced.
    """
    db = get_db()

    # Determine effective since timestamp
    effective_since = since
    watermark_doc = await db.config.find_one({"_id": "eyes_finetune_state"})
    if not effective_since and watermark_doc:
        effective_since = watermark_doc.get("last_finetuned_at")

    base_filter: dict[str, Any] = {
        "is_duplicate": {"$ne": True},
        "$or": [
            {"thumbnail_data_url": {"$exists": True, "$ne": None}},
            {"reconstructed_image_url": {"$exists": True, "$ne": None}},
        ],
    }

    total_approved = await db.closet_items.count_documents(base_filter)

    new_filter = dict(base_filter)
    if effective_since:
        new_filter["created_at"] = {"$gt": effective_since}

    new_count = await db.closet_items.count_documents(new_filter)
    eligible = (new_count >= min_items) or force

    if not eligible:
        logger.info(
            "Training skipped: %d new items found (< %d threshold, force=%s)",
            new_count,
            min_items,
            force,
        )
        return {
            "status": "skipped",
            "eligible": False,
            "new_count": new_count,
            "total_count": total_approved,
            "min_items": min_items,
            "forced": force,
            "effective_since": effective_since,
            "reason": (
                f"Found {new_count} new and approved items in DressApp database, "
                f"which is below the minimum threshold of {min_items}. "
                "Skipping fine-tuning to prevent model weight distortion."
            ),
            "items": [],
        }

    # Fetch eligible items
    cursor = db.closet_items.find(
        new_filter if effective_since else base_filter,
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "title": 1,
            "category": 1,
            "sub_category": 1,
            "color": 1,
            "colors": 1,
            "material": 1,
            "fabric_materials": 1,
            "pattern": 1,
            "formality": 1,
            "dress_code": 1,
            "gender": 1,
            "season": 1,
            "tags": 1,
            "thumbnail_data_url": 1,
            "reconstructed_image_url": 1,
            "created_at": 1,
        },
    ).limit(limit)

    raw_items = await cursor.to_list(length=limit)
    formatted_items = []

    base_cdn_url = "https://dressapp.co"

    for it in raw_items:
        # Resolve image URL: reconstructed > thumbnail
        img_path = it.get("reconstructed_image_url") or it.get("thumbnail_data_url")
        if not img_path:
            continue

        if img_path.startswith("/"):
            full_img_url = f"{base_cdn_url}{img_path}"
        else:
            full_img_url = img_path

        formatted_items.append(
            {
                "id": it.get("id"),
                "title": it.get("name") or it.get("title") or "Garment Item",
                "category": it.get("category"),
                "sub_category": it.get("sub_category"),
                "color": it.get("color"),
                "colors": it.get("colors") or [],
                "material": it.get("material"),
                "fabric_materials": it.get("fabric_materials") or [],
                "pattern": it.get("pattern"),
                "formality": it.get("formality") or it.get("dress_code"),
                "gender": it.get("gender"),
                "season": it.get("season"),
                "tags": it.get("tags") or [],
                "image_url": full_img_url,
                "created_at": it.get("created_at"),
            }
        )

    logger.info(
        "Exported %d items for training (new_count=%d, total=%d, force=%s)",
        len(formatted_items),
        new_count,
        total_approved,
        force,
    )

    return {
        "status": "success",
        "eligible": True,
        "new_count": new_count,
        "total_count": total_approved,
        "min_items": min_items,
        "forced": force,
        "effective_since": effective_since,
        "count": len(formatted_items),
        "items": formatted_items,
    }


@router.post("/training-watermark")
async def update_training_watermark(
    body: WatermarkUpdateIn,
    _: bool = Depends(verify_internal_token),
) -> dict[str, Any]:
    """Update the fine-tuning state watermark upon successful training completion."""
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "last_finetuned_at": now_iso,
        "last_item_count": body.item_count,
        "last_run_id": body.run_id,
        "last_metrics": body.metrics,
        "updated_at": now_iso,
    }

    await db.config.update_one(
        {"_id": "eyes_finetune_state"},
        {"$set": update_payload},
        upsert=True,
    )

    logger.info("Updated eyes_finetune_state watermark: %s", update_payload)
    return {"status": "ok", "watermark": update_payload}
