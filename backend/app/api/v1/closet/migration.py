from __future__ import annotations

import asyncio
import base64
import io
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.schemas import ClosetItem
from app.services import repos
from app.services.auth import get_current_user
from app.services.vision import get_garment_vision_service
from app.services import closet_service
from app.services.sync_service import broadcast_sync_event
from app.services.image_hash import average_hash, color_signature, hamming_distance
from app.services.migration.grid_slicer import extract_tiles_opencv, extract_tiles_grid_geometry
from app.services.migration.scroller_engine import compute_frame_difference
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
    from app.services.vision import resolve_garment_gender
    user_gender = resolve_garment_gender(user)
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
                    parsed = await active_vision.analyze(raw, language=user_lang, user_gender=user_gender)
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


def _normalize_crop_bytes_to_jpeg_b64(raw_bytes: bytes) -> tuple[bytes, str] | None:
    """Normalize arbitrary image bytes to a bounded RGB JPEG (max 640px) and return (jpeg_bytes, base64_str)."""
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode != "RGB":
            # Composite transparent PNGs onto a clean white background
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                rgba = img.convert("RGBA")
                bg = Image.new("RGB", rgba.size, (255, 255, 255))
                bg.paste(rgba, mask=rgba.split()[3])
                img = bg
            else:
                img = img.convert("RGB")
        max_dim = 640
        if max(img.width, img.height) > max_dim:
            ratio = max_dim / float(max(img.width, img.height))
            img = img.resize((max(1, int(img.width * ratio)), max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        jpeg_bytes = buf.getvalue()
        return jpeg_bytes, base64.b64encode(jpeg_bytes).decode("ascii")
    except Exception:
        return None


async def _load_existing_user_phashes(db, user_id: str) -> list[str]:
    """Fetch existing perceptual hashes for a user to prevent duplicate imports across batches."""
    try:
        existing_docs = await repos.find_many(
            db.closet_items,
            {"user_id": user_id},
            limit=1000,
        )
        return [
            d["source_phash"]
            for d in existing_docs
            if isinstance(d, dict) and isinstance(d.get("source_phash"), str) and d.get("source_phash")
        ]
    except Exception:
        return []


def _is_near_duplicate_phash(ph: str | None, known_phashes: list[str], threshold: int = 5) -> bool:
    if not ph:
        return False
    for existing_ph in known_phashes:
        if hamming_distance(ph, existing_ph) <= threshold:
            return True
    return False


class MigrationSaveCropsIn(BaseModel):
    app_name: str = "Competitor App"
    cards: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/migration/save-crops")
async def save_migration_crops(
    payload: MigrationSaveCropsIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Save bookmarklet-captured or WebView-harvested garment crops directly to the closet DB.

    Each card can provide either:
      - ``crop_base64`` (raw base64 JPEG or data URL), OR
      - ``image_url`` (remote HTTP/HTTPS image URL fetched server-side when CORS blocks canvas tainting).
    Items are saved with ``brand=<app_name>`` so the re-analyze worker
    can later find and enrich them via The Eyes / Stylist.
    """
    check_migration_access(user)
    db = get_db()
    saved = 0
    skipped = 0
    item_ids: list[str] = []
    known_phashes = await _load_existing_user_phashes(db, user["id"])

    for card in payload.cards:
        crop_b64 = card.get("crop_base64")
        remote_url = card.get("image_url")
        crop_raw: bytes | None = None

        if crop_b64 and isinstance(crop_b64, str):
            try:
                if crop_b64.startswith("data:"):
                    _, encoded = crop_b64.split(",", 1)
                    crop_raw = base64.b64decode(encoded)
                else:
                    crop_raw = base64.b64decode(crop_b64, validate=False)
            except Exception:
                crop_raw = None

        if (not crop_raw or len(crop_raw) < 100) and remote_url and isinstance(remote_url, str):
            try:
                fetched = await _read_image_bytes_from_url(remote_url)
                if fetched and len(fetched) >= 100:
                    normalized = _normalize_crop_bytes_to_jpeg_b64(fetched)
                    if normalized:
                        crop_raw, crop_b64 = normalized
            except Exception as exc:
                logger.debug("[migration] Failed to fetch remote card URL %s: %s", remote_url, exc)

        if not crop_raw or len(crop_raw) < 100:
            skipped += 1
            continue

        if not crop_b64 or crop_b64.startswith("data:"):
            crop_b64 = base64.b64encode(crop_raw).decode("ascii")

        crop_data_url = f"data:image/jpeg;base64,{crop_b64}"

        item = ClosetItem(
            user_id=user["id"],
            source="Private",
            title=card.get("title") or "Imported garment",
            category="Top",
            brand=payload.app_name,
            clean_image_status="ready",
        )
        doc = item.model_dump()
        doc["clean_image_url"] = crop_data_url
        doc["clean_image_status"] = "ready"

        ph: str | None = None
        try:
            ph = average_hash(crop_raw)
            if ph:
                doc["source_phash"] = ph
            cs = color_signature(crop_raw)
            if cs:
                doc["source_color_sig"] = cs
        except Exception:
            pass

        if _is_near_duplicate_phash(ph, known_phashes, threshold=5):
            skipped += 1
            continue

        query_conditions = [{"user_id": user["id"], "clean_image_url": crop_data_url}]
        if ph:
            query_conditions.append({"user_id": user["id"], "source_phash": ph})

        existing = await repos.find_one(db.closet_items, {"$or": query_conditions})
        if existing:
            skipped += 1
            continue

        await repos.insert(db.closet_items, doc)
        if ph:
            known_phashes.append(ph)
        item_ids.append(doc["id"])
        saved += 1

    if saved > 0 and user.get("id"):
        try:
            await broadcast_sync_event(user["id"], "closet_updated", {"saved_count": saved})
        except Exception as exc:
            logger.warning("[migration] Failed to broadcast closet_updated event: %s", exc)

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


def _extract_frames_from_video_base64(video_b64: str, max_frames: int = 36) -> list[Image.Image]:
    """Decode a base64 screen-recording video and extract keyframes every ~0.75s using OpenCV."""
    import cv2

    if video_b64.startswith("data:"):
        _, video_b64 = video_b64.split(",", 1)
    raw_video = base64.b64decode(video_b64, validate=False)
    if len(raw_video) < 256:
        return []

    frames: list[Image.Image] = []
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(raw_video)
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        step = max(1, int(round(fps * 0.75)))
        idx = 0
        while cap.isOpened() and len(frames) < max_frames:
            ret, bgr = cap.read()
            if not ret:
                break
            if idx % step == 0:
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                frames.append(Image.fromarray(rgb))
            idx += 1
        cap.release()
    except Exception as exc:
        logger.warning("[migration] Video frame extraction failed: %s", exc)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    return frames


def _slice_screenshot_into_tiles(frame: Image.Image) -> list[Image.Image]:
    """Slice a mobile or desktop closet grid screenshot into garment card tiles."""
    work = frame.convert("RGB")
    w, h = work.size

    # Trim mobile status bar (top 7%) and bottom tab/gesture bar (bottom 7%) on tall portrait screens
    if h > w * 1.45 and h > 400:
        top_trim = int(h * 0.07)
        bottom_trim = int(h * 0.93)
        work = work.crop((0, top_trim, w, bottom_trim))

    tiles = extract_tiles_opencv(work, min_area_ratio=0.025, max_area_ratio=0.48)
    if len(tiles) < 2:
        # Fallback to deterministic grid geometry (2x3 for mobile portrait, 3x3 for wider screens)
        cols = 2 if work.width < 750 else 3
        rows = 3
        tiles = extract_tiles_grid_geometry(work, columns=cols, rows=rows, padding_px=10)

    valid_tiles: list[Image.Image] = []
    for tile in tiles:
        if min(tile.width, tile.height) < 60:
            continue
        arr = np.asarray(tile.convert("L"), dtype=np.float32)
        # Skip solid/blank background cards (low pixel variance)
        if float(np.std(arr)) < 8.5:
            continue
        valid_tiles.append(tile)
    return valid_tiles


class MigrationScreenshotsIn(BaseModel):
    app_name: str = "Competitor App"
    frames_base64: list[str] = Field(default_factory=list)
    video_base64: str | None = None


@router.post("/migration/upload-screenshots")
async def upload_migration_screenshots(
    payload: MigrationScreenshotsIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Slice uploaded closet screenshots or a screen-recording video into garment cards.

    1. Decodes ``frames_base64`` (and optional ``video_base64`` keyframes).
    2. Filters redundant consecutive scroll frames via ``compute_frame_difference``.
    3. Slices each screenshot into individual garment tiles via ``GridSlicer``.
    4. Deduplicates across frames & existing user closet items via perceptual hash.
    5. Saves unique garments to ``db.closet_items`` and starts ``_run_reanalyze_items``.
    """
    check_migration_access(user)
    db = get_db()

    raw_frames: list[Image.Image] = []
    for b64_str in payload.frames_base64[:40]:
        if not b64_str or not isinstance(b64_str, str):
            continue
        try:
            encoded = b64_str.split(",", 1)[1] if b64_str.startswith("data:") else b64_str
            raw = base64.b64decode(encoded, validate=False)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            raw_frames.append(img)
        except Exception as exc:
            logger.debug("[migration] Skipping invalid screenshot frame: %s", exc)

    if payload.video_base64:
        video_frames = await asyncio.to_thread(_extract_frames_from_video_base64, payload.video_base64)
        raw_frames.extend(video_frames)

    if not raw_frames:
        raise HTTPException(400, "No valid screenshots or video frames were provided.")

    # Filter consecutive identical/near-identical scroll frames
    unique_frames: list[Image.Image] = []
    for frame in raw_frames:
        if not unique_frames:
            unique_frames.append(frame)
            continue
        prev = unique_frames[-1]
        if prev.size == frame.size:
            diff = compute_frame_difference(prev, frame)
            if diff < 0.015:
                continue
        unique_frames.append(frame)

    known_phashes = await _load_existing_user_phashes(db, user["id"])
    saved = 0
    skipped = 0
    total_tiles_detected = 0
    item_ids: list[str] = []

    for frame in unique_frames:
        tiles = await asyncio.to_thread(_slice_screenshot_into_tiles, frame)
        total_tiles_detected += len(tiles)
        for tile in tiles:
            buf = io.BytesIO()
            tile.save(buf, format="JPEG", quality=85)
            crop_raw = buf.getvalue()
            if len(crop_raw) < 100:
                skipped += 1
                continue

            ph = average_hash(crop_raw)
            if _is_near_duplicate_phash(ph, known_phashes, threshold=5):
                skipped += 1
                continue

            crop_b64 = base64.b64encode(crop_raw).decode("ascii")
            crop_data_url = f"data:image/jpeg;base64,{crop_b64}"

            item = ClosetItem(
                user_id=user["id"],
                source="Private",
                title="Imported garment",
                category="Top",
                brand=payload.app_name,
                clean_image_status="ready",
            )
            doc = item.model_dump()
            doc["clean_image_url"] = crop_data_url
            doc["clean_image_status"] = "ready"
            if ph:
                doc["source_phash"] = ph

            await repos.insert(db.closet_items, doc)
            if ph:
                known_phashes.append(ph)
            item_ids.append(doc["id"])
            saved += 1

    if saved > 0 and user.get("id"):
        try:
            await broadcast_sync_event(user["id"], "closet_updated", {"saved_count": saved})
        except Exception as exc:
            logger.warning("[migration] Failed to broadcast closet_updated event: %s", exc)

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
        saved_items = await repos.find_many(
            db.closet_items,
            {"user_id": user["id"], "brand": payload.app_name, "id": {"$in": item_ids}},
            limit=500,
        )
        _track_task(asyncio.create_task(_run_reanalyze_items(saved_items, user, job_id, db)))

    return {
        "frames_processed": len(unique_frames),
        "tiles_detected": total_tiles_detected,
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
