import base64
import logging
import uuid
import io
import os
from datetime import datetime, timezone
from typing import Any, List, Dict, Optional, Tuple
import numpy as np
from PIL import Image
import httpx
import aiofiles
from fastapi import BackgroundTasks

from app.config import settings
from app.db.database import get_db
from app.services import repos
from app.services import background_matting
from app.services import clothing_parser as _cp
from app.services.reconstruction import reconstruct
from app.services.image_compression import (
    compress_image_bytes,
    compress_b64_image,
)
from app.services.upload_manager import BUCKET_DIR
from app.models.schemas import GarmentAnalysis

logger = logging.getLogger(__name__)

# --- SegFormer category mapping --------------------------------------
_CATEGORY_TO_SEGFORMER_KIND: Dict[str, str] = {
    "top": "top",
    "tops": "top",
    "shirt": "top",
    "shirts": "top",
    "blouse": "top",
    "outerwear": "top",
    "jacket": "top",
    "jackets": "top",
    "coat": "top",
    "underwear": "top",
    "bottom": "bottom",
    "bottoms": "bottom",
    "pants": "bottom",
    "trousers": "bottom",
    "jeans": "bottom",
    "skirt": "bottom",
    "skirts": "bottom",
    "shorts": "bottom",
    "dress": "dress",
    "dresses": "dress",
    "full body": "dress",
    "fullbody": "dress",
    "full-body": "dress",
    "footwear": "footwear",
    "shoes": "footwear",
    "sneakers": "footwear",
    "boots": "footwear",
    "accessory": "accessory",
    "accessories": "accessory",
    "bag": "accessory",
    "bags": "accessory",
    "belt": "accessory",
    "scarf": "accessory",
    "sunglasses": "accessory",
    "headwear": "headwear",
    "hat": "headwear",
    "hats": "headwear",
}

def pick_segformer_mask_for_category(
    garments: List[Dict[str, Any]],
    category: Optional[str],
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    if not garments:
        return None, None
    target_kind = (
        _CATEGORY_TO_SEGFORMER_KIND.get((category or "").strip().lower())
        if category
        else None
    )

    def _area(g: Dict[str, Any]) -> int:
        m = g.get("mask")
        if m is None:
            return 0
        try:
            return int(m.sum())
        except Exception:
            return 0

    if target_kind:
        matches = [g for g in garments if g.get("category") == target_kind]
        if matches:
            best = max(matches, key=_area)
            if _area(best) > 0:
                return best.get("mask"), best.get("_human_mask_full")
    # Fallback: largest mask of any garment kind.
    candidates = [g for g in garments if _area(g) > 0]
    if not candidates:
        return None, None
    best_fallback = max(candidates, key=_area)
    return best_fallback.get("mask"), best_fallback.get("_human_mask_full")

def bytes_from_data_url(url: Optional[str]) -> Optional[bytes]:
    if not isinstance(url, str) or not url.startswith("data:"):
        return None
    try:
        _header, b64 = url.split(",", 1)
        return base64.b64decode(b64, validate=True)
    except Exception:
        return None

def ensure_min_resolution(image_bytes: bytes, min_dim: int = 512) -> bytes:
    if not image_bytes:
        return image_bytes
    try:
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size
        if w >= min_dim and h >= min_dim:
            return image_bytes
            
        if w < h:
            new_w = min_dim
            new_h = int(h * (min_dim / w))
        else:
            new_h = min_dim
            new_w = int(w * (min_dim / h))
            
        img_resized = img.resize((new_w, new_h), Image.Resampling.BICUBIC)
        
        out_buf = io.BytesIO()
        fmt = img.format or "JPEG"
        img_resized.save(out_buf, format=fmt)
        return out_buf.getvalue()
    except Exception as e:
        logger.warning("Failed to upscale low-resolution image: %s", e)
        return image_bytes

async def read_image_bytes_from_url(url: Optional[str]) -> Optional[bytes]:
    if not isinstance(url, str):
        return None
    
    result_bytes = None
    if url.startswith("data:"):
        result_bytes = bytes_from_data_url(url)
    
    elif "/static/uploads/" in url:
        idx = url.find("/static/uploads/")
        relative_path = url[idx + len("/static/uploads/"):]
        local_path = os.path.join(BUCKET_DIR, relative_path)
        if os.path.exists(local_path):
            try:
                async with aiofiles.open(local_path, "rb") as f:
                    result_bytes = await f.read()
            except Exception as e:
                logger.error("Failed to read local uploaded file: %s", e)
                
    if not result_bytes:
        try:
            full_url = url
            if url.startswith("/"):
                full_url = f"http://localhost:8001{url}"
                
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(full_url)
                if resp.status_code == 200:
                    result_bytes = resp.content
        except Exception as e:
            logger.error("Failed to download image URL %s: %s", url, e)
        
    if result_bytes:
        return ensure_min_resolution(result_bytes)
    return None

_STALE_MATTE_RETRY_SECONDS = 90
_STALE_MATTE_RETRY_COOLDOWN_SECONDS = 5 * 60

async def maybe_retry_stale_matte(
    item: Dict[str, Any],
    background_tasks: BackgroundTasks,
) -> None:
    if item.get("clean_image_status") != "pending" or item.get("clean_image_url"):
        return
    updated_raw = item.get("updated_at")
    if not updated_raw:
        return
    try:
        updated_at = datetime.fromisoformat(
            str(updated_raw).replace("Z", "+00:00"),
        )
    except Exception:
        return
    age_s = (datetime.now(timezone.utc) - updated_at).total_seconds()
    if age_s < _STALE_MATTE_RETRY_SECONDS:
        return
    last_retry_raw = item.get("matte_last_retry_at")
    if last_retry_raw:
        try:
            last_retry = datetime.fromisoformat(
                str(last_retry_raw).replace("Z", "+00:00"),
            )
            if (
                datetime.now(timezone.utc) - last_retry
            ).total_seconds() < _STALE_MATTE_RETRY_COOLDOWN_SECONDS:
                return
        except Exception:
            pass
    raw_bytes = bytes_from_data_url(item.get("original_image_url"))
    if not raw_bytes:
        return
    item_id = item["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    db = get_db()
    await db.closet_items.update_one(
        {"id": item_id},
        {"$set": {"matte_last_retry_at": now_iso}},
    )
    logger.info(
        "Re-queuing stale background matte for item %s (pending %.0fs)",
        item_id, age_s,
    )
    background_tasks.add_task(
        run_background_matte,
        item_id,
        raw_bytes,
        item.get("category"),
    )

async def run_background_matte(
    item_id: str,
    raw_bytes: bytes,
    category: Optional[str] = None,
) -> None:
    db = get_db()

    seg_mask = None
    human_mask = None
    if settings.USE_LOCAL_CLOTHING_PARSER:
        try:
            garments = await _cp.parse_garments(raw_bytes)
            seg_mask, human_mask = pick_segformer_mask_for_category(garments, category)
            if seg_mask is None and garments:
                logger.info(
                    "Background matte SegFormer: parsed %d instance(s) for item %s "
                    "but none usable for category=%r",
                    len(garments), item_id, category,
                )
        except Exception as exc:
            logger.info(
                "Background matte SegFormer skipped for item %s: %s",
                item_id, repr(exc)[:160],
            )
            seg_mask = None
            human_mask = None

    try:
        out = await background_matting.remove_background(raw_bytes)
    except Exception as exc:
        logger.warning(
            "Background rembg matte FAILED for item %s: %s", item_id, exc,
        )
        await db.closet_items.update_one(
            {"id": item_id},
            {"$set": {
                "clean_image_status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return

    result = out.get("image_png") if isinstance(out, dict) else None
    provider = out.get("provider") if isinstance(out, dict) else None
    faithful = out.get("faithful", True) if isinstance(out, dict) else True

    if result and seg_mask is not None:
        try:
            refined = _cp.apply_alpha_intersection(
                result,
                seg_mask,
                category=category,
                human_mask=human_mask,
                is_padded_canvas=True,
            )
            if refined:
                logger.info(
                    "Background matte SegFormer-refined for item %s "
                    "(%d → %d bytes)",
                    item_id, len(result), len(refined),
                )
                result = refined
            else:
                logger.info(
                    "Background matte apply_alpha_intersection returned None "
                    "for item %s — keeping rembg-only output", item_id,
                )
        except Exception as exc:
            logger.info(
                "Background matte alpha intersection skipped for item %s: %s",
                item_id, repr(exc)[:160],
            )

    if not result:
        reason = (
            "CLIP faithfulness rejected"
            if isinstance(out, dict) and out.get("rejected_reason")
            else "rembg returned no bytes"
        )
        logger.info(
            "Background matte SKIPPED for item %s (%s; provider=%s)",
            item_id, reason, provider,
        )
        await db.closet_items.update_one(
            {"id": item_id},
            {"$set": {
                "clean_image_status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return

    try:
        compressed_result = compress_image_bytes(result, max_dim=1024, quality=75)
        temp_img = Image.open(io.BytesIO(compressed_result))
        mime = "image/png" if temp_img.mode in ("RGBA", "LA") else "image/jpeg"
        data_url = f"data:{mime};base64," + base64.b64encode(compressed_result).decode("ascii")
    except Exception:
        data_url = (
            "data:image/png;base64,"
            + base64.b64encode(result).decode("ascii")
        )
    await db.closet_items.update_one(
        {"id": item_id},
        {
            "$set": {
                "clean_image_url": data_url,
                "clean_image_status": "ready",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "thumbnail_data_url": None,
            },
        },
    )
    logger.info(
        "Background matte READY for item %s "
        "(provider=%s faithful=%s %d bytes png)",
        item_id, provider, faithful, len(result),
    )

def _apply_defaults(parsed: Dict[str, Any]) -> Dict[str, Any]:
    parsed.setdefault("category", "Top")
    parsed.setdefault("pattern", "solid")
    parsed.setdefault("gender", "unisex")
    parsed.setdefault("dress_code", "casual")
    parsed.setdefault("state", "used")
    parsed.setdefault("condition", "good")
    parsed.setdefault("quality", "mid")
    return parsed

def safe_analysis(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Validate through Pydantic; fall back to a minimal shape on error."""
    try:
        return GarmentAnalysis(**_apply_defaults(parsed)).model_dump()
    except Exception:
        return GarmentAnalysis(
            title=parsed.get("title") or "Unnamed garment"
        ).model_dump()

async def run_background_matte_and_analyze(
    item_id: str,
    raw_bytes: bytes,
    category: Optional[str],
    receipt_locked_fields: List[str],
) -> None:
    raw_bytes = ensure_min_resolution(raw_bytes)
    await run_background_matte(item_id, raw_bytes, category)

    from app.services.vision import garment_vision_service
    if garment_vision_service is None:
        logger.info(
            "Receipt matte+analyze: Gemini skipped for item %s "
            "(garment_vision_service not configured)",
            item_id,
        )
        return

    db = get_db()
    try:
        parsed = await garment_vision_service.analyze(raw_bytes)
    except Exception as exc:
        logger.warning(
            "Receipt matte+analyze: Gemini FAILED for item %s: %s",
            item_id, repr(exc)[:200],
        )
        return

    analysis = safe_analysis(parsed)
    try:
        from app.services.vision import _is_unidentifiable
        if _is_unidentifiable(analysis):
            logger.info(
                "Receipt matte+analyze: Gemini returned unidentifiable "
                "result for item %s — skipping merge",
                item_id,
            )
            return
    except Exception:
        pass

    ANALYSIS_KEYS = (
        "title", "name", "caption", "category", "sub_category", "item_type",
        "brand", "gender", "dress_code", "season", "tradition", "colors",
        "fabric_materials", "pattern", "state", "condition", "quality",
        "repair_advice", "tags", "image_quality_status", "image_quality_reason",
        "reconstruction_prompt",
    )

    item_doc = await repos.find_one(db.closet_items, {"id": item_id})
    if not item_doc:
        logger.info(
            "Receipt matte+analyze: item %s no longer exists — aborting merge",
            item_id,
        )
        return

    locked = set(receipt_locked_fields or [])
    update_doc: Dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    for key in ANALYSIS_KEYS:
        if key not in analysis:
            continue
        if key in locked:
            continue
        current = item_doc.get(key)
        if current or current == 0:
            continue
        update_doc[key] = analysis[key]

    if "color" not in locked:
        colors_list = analysis.get("colors") or []
        if colors_list and isinstance(colors_list, list):
            first = colors_list[0]
            if isinstance(first, dict) and first.get("name") and not item_doc.get("color"):
                update_doc["color"] = first["name"]

    if "material" not in locked:
        mats = analysis.get("fabric_materials") or []
        if mats and isinstance(mats, list):
            first = mats[0]
            if isinstance(first, dict) and first.get("name") and not item_doc.get("material"):
                update_doc["material"] = first["name"]

    if len(update_doc) > 1:
        await db.closet_items.update_one(
            {"id": item_id},
            {"$set": update_doc},
        )
        logger.info(
            "Receipt matte+analyze: merged %d analysis field(s) onto item %s",
            len(update_doc) - 1, item_id,
        )
    else:
        logger.info(
            "Receipt matte+analyze: no new fields to merge for item %s "
            "(all analysis fields already populated or locked)",
            item_id,
        )

async def run_background_reconstruction(
    item_id: str,
    crop_bytes: bytes,
    analysis: Dict[str, Any],
    reasons: List[str],
) -> None:
    if not settings.ENABLE_RECONSTRUCTION:
        logger.info(
            "Background reconstruction SKIPPED for item %s "
            "(ENABLE_RECONSTRUCTION=false)",
            item_id,
        )
        return

    db = get_db()
    t0 = datetime.now(timezone.utc)
    try:
        result = await reconstruct(crop_bytes, analysis, reasons=reasons)
    except Exception as exc:
        logger.warning(
            "Background reconstruction FAILED for item %s: %s",
            item_id, repr(exc)[:200],
        )
        return

    if not result or not result.get("image_b64"):
        logger.info(
            "Background reconstruction SKIPPED for item %s "
            "(no image returned; reasons=%s)",
            item_id, reasons,
        )
        return

    recon_b64 = compress_b64_image(result['image_b64'], max_dim=1024, quality=75)
    try:
        temp_raw = base64.b64decode(recon_b64)
        temp_img = Image.open(io.BytesIO(temp_raw))
        mime = "image/png" if temp_img.mode in ("RGBA", "LA") else "image/jpeg"
    except Exception:
        mime = result.get("mime_type", "image/png")
    data_url = f"data:{mime};base64,{recon_b64}"
    meta = {
        "method": "reconstruction",
        "quality_status": analysis.get("image_quality_status"),
        "quality_reason": analysis.get("image_quality_reason"),
        "model": result.get("model"),
        "prompt": result.get("prompt"),
        "reasons": reasons,
        "deferred": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.closet_items.update_one(
        {"id": item_id},
        {
            "$set": {
                "reconstructed_image_url": data_url,
                "reconstruction_metadata": meta,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "thumbnail_data_url": None,
            },
        },
    )
    elapsed = (datetime.now(timezone.utc) - t0).total_seconds()
    logger.info(
        "Background reconstruction READY for item %s "
        "(model=%s in %.1fs reasons=%s)",
        item_id, result.get("model"), elapsed, reasons,
    )

async def reanalyze_group_helper(group_id: str, user_id: str) -> None:
    from app.services.vision import garment_vision_service
    if garment_vision_service is None:
        logger.warning("reanalyze_group_helper: skipped (garment_vision_service not configured)")
        return

    db = get_db()
    cursor = db.closet_items.find(
        {"user_id": user_id, "group_id": group_id},
        {"_id": 0, "id": 1, "original_image_url": 1}
    )
    items = [d async for d in cursor]
    if not items:
        logger.warning(f"reanalyze_group_helper: no items found for group={group_id}")
        return

    logger.info(f"reanalyze_group_helper: starting reanalysis for {len(items)} items in group={group_id}")
    for it in items:
        item_id = it["id"]
        img_url = it.get("original_image_url")
        if not img_url:
            continue
        try:
            raw_bytes = await read_image_bytes_from_url(img_url)
            if not raw_bytes:
                continue
            parsed = await garment_vision_service.analyze(raw_bytes)
            analysis = safe_analysis(parsed)
            if not analysis:
                continue

            update_doc = {
                "category": analysis.get("category"),
                "sub_category": analysis.get("sub_category"),
                "item_type": analysis.get("item_type"),
                "brand": analysis.get("brand"),
                "gender": analysis.get("gender"),
                "dress_code": analysis.get("dress_code"),
                "season": analysis.get("season") or [],
                "colors": analysis.get("colors") or [],
                "fabric_materials": analysis.get("fabric_materials") or [],
                "pattern": analysis.get("pattern"),
                "tags": list(set(analysis.get("tags") or [])),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            # Remove keys that are None
            update_doc = {k: v for k, v in update_doc.items() if v is not None}
            if len(update_doc) > 1:
                await db.closet_items.update_one({"id": item_id}, {"$set": update_doc})
                logger.info(f"reanalyze_group_helper: updated item={item_id}")
        except Exception as e:
            logger.error(f"reanalyze_group_helper: error on item={item_id}: {e}")

async def run_reanalyze_items(
    user_id: str,
    item_ids: List[str],
) -> None:
    from app.services.vision import garment_vision_service
    if garment_vision_service is None:
        logger.warning("run_reanalyze_items: skipped (garment_vision_service not configured)")
        return

    db = get_db()
    for item_id in item_ids:
        doc = await db.closet_items.find_one({"id": item_id, "user_id": user_id})
        if not doc or not doc.get("original_image_url"):
            continue
        try:
            raw_bytes = await read_image_bytes_from_url(doc["original_image_url"])
            if not raw_bytes:
                continue
            parsed = await garment_vision_service.analyze(raw_bytes)
            analysis = safe_analysis(parsed)
            if not analysis:
                continue
            update_doc = {k: v for k, v in analysis.items() if v is not None}
            update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.closet_items.update_one({"id": item_id}, {"$set": update_doc})
            logger.info(f"run_reanalyze_items: reanalyzed item={item_id}")
        except Exception as e:
            logger.error(f"run_reanalyze_items: error on item={item_id}: {e}")

def slim_item(it: Dict[str, Any]) -> Dict[str, Any]:
    """Strip the 512-float embedding + other heavy fields from an item."""
    return {k: v for k, v in it.items() if k not in ("clip_embedding",)}

def anchor_summary(anchor: Dict[str, Any]) -> Dict[str, Any]:
    """Compact anchor description used for stylist prompting."""
    return {
        "id": anchor.get("id"),
        "title": anchor.get("title") or anchor.get("name"),
        "category": anchor.get("category"),
        "sub_category": anchor.get("sub_category"),
        "color": anchor.get("color"),
        "material": anchor.get("material"),
        "pattern": anchor.get("pattern"),
        "dress_code": anchor.get("dress_code"),
        "season": anchor.get("season") or [],
    }
