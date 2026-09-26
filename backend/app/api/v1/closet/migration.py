from __future__ import annotations

import asyncio
import base64
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.schemas import ClosetItem
from app.services import repos
from app.services.auth import get_current_user
from app.services.vision import get_garment_vision_service
from app.services import closet_service
from app.services.sync_service import broadcast_sync_event
from app.api.v1.closet.common import (
    _track_task,
    _ANALYZE_LOCK,
    _read_image_bytes_from_url,
    logger,
)

router = APIRouter()

_safe_analysis = closet_service.safe_analysis

# ─── DB-backed migration: save crops + Stylist re-analyze ──────────────

_migration_status: dict[str, dict[str, Any]] = {}



async def _run_reanalyze_items(
    items: list[dict[str, Any]],
    user: dict,
    job_id: str,
    db,
) -> None:
    """Shared background worker: run Stylist (Gemini) analysis on a batch of closet items."""
    active_vision = get_garment_vision_service(user=user)
    if active_vision is None:
        logger.warning("[migration] No vision service available for user %s", (user or {}).get("id"))
        return
    user_lang = (user or {}).get("preferred_language") or "en"
    imported = 0
    skipped = 0
    all_items: list[dict[str, Any]] = []

    for item_doc in items:
        item_id = item_doc.get("id")
        try:
            variants = item_doc.get("image_variants") or {}
            image_url = (
                item_doc.get("clean_image_url")
                or item_doc.get("cutout_url")
                or (variants.get("webp") or {}).get("large")
                or (variants.get("webp") or {}).get("medium")
                or item_doc.get("reconstructed_image_url")
                or variants.get("original")
                or item_doc.get("image_url")
            )
            if not image_url:
                skipped += 1
                continue

            raw = await _read_image_bytes_from_url(image_url)
            if not raw:
                skipped += 1
                continue

            try:
                async with _ANALYZE_LOCK:
                    parsed = await active_vision.analyze(raw, language=user_lang)
            except Exception as exc:
                logger.warning("[migration] Re-analyze failed for %s: %s", item_id, exc)
                skipped += 1
                continue

            analysis = _safe_analysis(parsed)
            from app.services.vision import _is_unidentifiable

            if _is_unidentifiable(analysis):
                skipped += 1
                continue

            update_doc: dict[str, Any] = {
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            for key in (
                "title", "name", "caption", "category", "sub_category",
                "item_type", "brand", "gender", "dress_code", "season",
                "tradition", "colors", "fabric_materials", "pattern",
                "state", "condition", "quality", "repair_advice", "tags",
            ):
                val = analysis.get(key)
                if val is not None:
                    update_doc[key] = val

            colours_list = analysis.get("colors") or []
            if colours_list and isinstance(colours_list, list):
                first_colour = colours_list[0]
                if isinstance(first_colour, dict) and first_colour.get("name"):
                    update_doc["color"] = first_colour["name"]
            materials_list = analysis.get("fabric_materials") or []
            if materials_list and isinstance(materials_list, list):
                first_material = materials_list[0]
                if isinstance(first_material, dict) and first_material.get("name"):
                    update_doc["material"] = first_material["name"]

            await repos.update(
                db.closet_items,
                {"id": item_id, "user_id": user["id"]},
                update_doc,
            )

            imported += 1
            all_items.append({"id": item_id, "title": update_doc.get("title")})

        except Exception as exc:
            logger.warning("[migration] Re-analyze error for %s: %s", item_id, exc)
            skipped += 1

        _migration_status[job_id] = {
            "status": "processing",
            "imported": imported,
            "skipped": skipped,
            "total": len(items),
            "items": all_items,
        }

    _migration_status[job_id] = {
        "status": "done",
        "imported": imported,
        "skipped": skipped,
        "total": len(items),
        "items": all_items,
    }
    if imported > 0 and user.get("id"):
        try:
            await broadcast_sync_event(user["id"], "closet_updated", {"reanalyzed": imported, "total": len(items)})
        except Exception:
            pass
    await asyncio.sleep(60)
    _migration_status.pop(job_id, None)



def check_migration_access(user: dict) -> None:
    sub = user.get("subscription") or {}
    is_active = sub.get("is_active", False)
    plan_type = sub.get("plan_type", "free")
    tier = sub.get("tier", "free")
    
    user_tier = "free"
    if is_active and plan_type != "free":
        if tier in ["pro", "manager"]:
            user_tier = "manager"
        elif tier in ["business", "professional"]:
            user_tier = "professional"
            
    if user_tier == "free":
        raise HTTPException(
            status_code=403,
            detail="Wardrobe migration is only available on Manager or Professional tiers. Please upgrade your plan."
        )


class MigrationSaveCropsIn(BaseModel):
    app_name: str = "Competitor App"
    cards: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/migration/save-crops")
async def save_migration_crops(
    payload: MigrationSaveCropsIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Save bookmarklet-captured garment crops directly to the closet DB.

    Each card must have a ``crop_base64`` field (raw base64 JPEG).
    Items are saved with ``brand=<app_name>`` so the re-analyze worker
    can later find and enrich them via The Eyes / Stylist.
    """
    check_migration_access(user)
    db = get_db()
    saved = 0
    skipped = 0
    item_ids: list[str] = []

    for card in payload.cards:
        crop_b64 = card.get("crop_base64")
        if not crop_b64:
            skipped += 1
            continue

        # Decode crop bytes
        try:
            if crop_b64.startswith("data:"):
                _, encoded = crop_b64.split(",", 1)
                crop_raw = base64.b64decode(encoded)
            else:
                crop_raw = base64.b64decode(crop_b64, validate=True)
        except Exception:
            skipped += 1
            continue

        if len(crop_raw) < 100:
            skipped += 1
            continue

        # Build the crop data URL for segmented_image_url
        crop_data_url = f"data:image/jpeg;base64,{crop_b64}"

        # Create a minimal ClosetItem
        item = ClosetItem(
            user_id=user["id"],
            source="Private",
            title=card.get("title") or "Imported garment",
            category="Top",
            brand=payload.app_name,
            clean_image_status="ready",
        )
        doc = item.model_dump()
        # For imported items the crop is the only available image.
        # Store it as clean_image_url (the primary display field) so the
        # item renders immediately in the closet without waiting for rembg.
        doc["clean_image_url"] = crop_data_url
        doc["clean_image_status"] = "ready"

        # Compute phash for future dedup
        try:
            from app.services.image_hash import average_hash, color_signature
            ph = average_hash(crop_raw)
            if ph:
                doc["source_phash"] = ph
            cs = color_signature(crop_raw)
            if cs:
                doc["source_color_sig"] = cs
        except Exception:
            pass

        # Check if an identical crop image or phash already exists for this user
        query_conditions = [{"user_id": user["id"], "clean_image_url": crop_data_url}]
        if doc.get("source_phash"):
            query_conditions.append({"user_id": user["id"], "source_phash": doc["source_phash"]})

        existing = await repos.find_one(db.closet_items, {"$or": query_conditions})
        if existing:
            skipped += 1
            continue

        await repos.insert(db.closet_items, doc)
        item_ids.append(doc["id"])
        saved += 1

    # Broadcast real-time closet sync so open client views refresh immediately
    if saved > 0 and user.get("id"):
        try:
            await broadcast_sync_event(user["id"], "closet_updated", {"saved_count": saved})
        except Exception as exc:
            logger.warning("[migration] Failed to broadcast closet_updated event: %s", exc)

    # ── Atomically kick off the Stylist re-analyze worker ──
    # This avoids a race condition where the client closes between
    # saving crops and starting analysis.
    job_id: str | None = None
    vision_service = get_garment_vision_service(user=user)
    if saved > 0 and vision_service is not None:
        job_id = f"reanalyze_{uuid.uuid4().hex[:12]}"
        _migration_status[job_id] = {
            "status": "processing",
            "imported": 0,
            "skipped": 0,
            "total": saved,
            "items": [],
        }

        # Snapshot the items we just saved so the worker doesn't re-query
        # (avoids a race where the brand hasn't been written yet).
        saved_items = await repos.find_many(
            db.closet_items,
            {"user_id": user["id"], "brand": payload.app_name, "id": {"$in": item_ids}},
            limit=500,
        )

        _track_task(asyncio.create_task(_run_reanalyze_items(saved_items, user, job_id, db)))

    return {
        "items_saved": saved,
        "items_skipped": skipped,
        "item_ids": item_ids,
        "app_name": payload.app_name,
        "job_id": job_id,
    }



class MigrationReanalyzeIn(BaseModel):
    app_name: str = "Competitor App"


@router.post("/migration/reanalyze-by-brand")
async def reanalyze_by_brand(
    payload: MigrationReanalyzeIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Standalone re-analyze endpoint (for manual re-triggering).
    Returns a job_id for polling via /migration/status/{job_id}.
    """
    check_migration_access(user)
    vision_service = get_garment_vision_service(user=user)
    if vision_service is None:
        raise HTTPException(503, "Garment analyzer not configured")

    db = get_db()
    items = await repos.find_many(
        db.closet_items,
        {"user_id": user["id"], "brand": payload.app_name},
        limit=500,
    )
    if not items:
        return {"job_id": None, "message": "No items found for this brand"}

    job_id = f"reanalyze_{uuid.uuid4().hex[:12]}"
    _migration_status[job_id] = {
        "status": "processing",
        "imported": 0,
        "skipped": 0,
        "total": len(items),
        "items": [],
    }

    _track_task(asyncio.create_task(_run_reanalyze_items(items, user, job_id, db)))
    return {"job_id": job_id, "total_items": len(items)}


@router.get("/migration/status/{job_id}")
async def get_migration_status(
    job_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Poll the status of an ongoing wardrobe migration job."""
    check_migration_access(user)
    status_info = _migration_status.get(job_id)
    if not status_info:
        raise HTTPException(404, "Migration job not found")
    return status_info


