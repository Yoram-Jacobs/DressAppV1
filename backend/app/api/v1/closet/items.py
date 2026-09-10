from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from app.db.database import get_db
from app.config import settings
from app.models.schemas import (
    ClosetItem,
    DressCode,
    FinancialMetadata,
    Formality,
    GarmentAnalysis,
    GarmentCondition,
    GarmentGender,
    GarmentQuality,
    GarmentState,
    Listing,
    MarketplaceIntent,
    RetailMetadata,
    Source,
    WeightedTag,
)
from app.services import repos
from app.services.auth import (
    get_current_user,
    resolve_user_gemini_api_key,
    resolve_user_gemini_model,
)
from app.services.fees import compute_fees
from app.services.vision import garment_vision_service, get_garment_vision_service
from app.services.fashion_clip import fashion_clip_service
from app.services.gemini_image_service import gemini_image_service, get_gemini_image_service
from app.services.image_compression import (
    compress_b64_image,
    compress_image_bytes,
    compress_image_url_or_b64,
)
from app.services import closet_service
from app.api.v1.closet.common import (
    _active_background_tasks,
    _track_task,
    _ANALYZE_CONCURRENCY,
    _ANALYZE_LOCK,
    _get_item_image_url,
    _pick_segformer_mask_for_category,
    _bytes_from_data_url,
    _ensure_min_resolution,
    _read_image_bytes_from_url,
    _maybe_retry_stale_matte,
    _run_background_matte,
    _run_background_matte_and_analyze,
    _run_background_reconstruction,
    CreateItemIn,
    UpdateItemIn,
    logger,
)

router = APIRouter(prefix="/closet", tags=["closet"])

@router.post("", status_code=201)
async def create_item(
    payload: CreateItemIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
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
        current_count = await db.closet_items.count_documents({"user_id": user["id"]})
        capacity_limit = min(200, 50 + user.get("closet_capacity_bonus", 0))
        if current_count >= capacity_limit:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "closet_capacity_exceeded",
                    "message": f"You have reached your free closet capacity of {capacity_limit} items. Upgrade to Manager or Professional to add more items.",
                    "capacity": capacity_limit,
                    "current_count": current_count
                }
            )

    # Compress input base64 images to avoid bloating MongoDB
    if payload.image_base64:
        payload.image_base64 = compress_b64_image(payload.image_base64, max_dim=1024, quality=75)
        try:
            import io
            from PIL import Image
            temp_raw = base64.b64decode(payload.image_base64)
            temp_img = Image.open(io.BytesIO(temp_raw))
            payload.image_mime = "image/png" if temp_img.mode in ("RGBA", "LA") else "image/jpeg"
        except Exception:
            pass

    if payload.crop_base64:
        payload.crop_base64 = compress_b64_image(payload.crop_base64, max_dim=1024, quality=75)

    if payload.reconstructed_image_b64:
        payload.reconstructed_image_b64 = compress_b64_image(payload.reconstructed_image_b64, max_dim=1024, quality=75)

    raw_bytes: bytes | None = None
    if payload.image_base64:
        try:
            raw_bytes = base64.b64decode(payload.image_base64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Invalid image_base64: {exc}") from exc

    tags_list = list(payload.tags) if payload.tags else []
    if not tags_list:
        auto_tags = set()
        if payload.sub_category:
            auto_tags.add(payload.sub_category.strip().lower())
        elif payload.category:
            auto_tags.add(payload.category.strip().lower())
        if payload.dress_code:
            auto_tags.add(payload.dress_code.strip().lower())
        if payload.color:
            auto_tags.add(payload.color.strip().lower())
        if payload.brand:
            auto_tags.add(payload.brand.strip().lower())
        if payload.pattern and payload.pattern != "solid":
            auto_tags.add(payload.pattern.strip().lower())
        if payload.season and "all" not in payload.season:
            for s in payload.season:
                auto_tags.add(s.strip().lower())
        tags_list = [t for t in auto_tags if t]

    item = ClosetItem(
        user_id=user["id"],
        source=payload.source,
        name=payload.name,
        title=payload.title,
        caption=payload.caption,
        category=payload.category,
        sub_category=payload.sub_category,
        item_type=payload.item_type,
        brand=payload.brand,
        gender=payload.gender,
        dress_code=payload.dress_code,
        season=payload.season,
        tradition=payload.tradition,
        size=payload.size,
        color=payload.color,
        colors=payload.colors,
        material=payload.material,
        fabric_materials=payload.fabric_materials,
        pattern=payload.pattern,
        state=payload.state,
        condition=payload.condition,
        quality=payload.quality,
        repair_advice=payload.repair_advice,
        price_cents=payload.price_cents,
        currency=payload.currency,
        marketplace_intent=payload.marketplace_intent,
        formality=payload.formality,
        cultural_tags=payload.cultural_tags,
        tags=tags_list,
        original_image_url=payload.original_image_url,
        clean_image_url=payload.clean_image_url,
        clean_image_status=payload.clean_image_status,
        purchase_price_cents=payload.purchase_price_cents,
        purchase_currency=payload.purchase_currency,
        purchase_date=payload.purchase_date,
        notes=payload.notes,
        retail_metadata=payload.retail_metadata,
        reconstruction_metadata=payload.reconstruction_metadata,
        image_quality_status=payload.image_quality_status,
        image_quality_reason=payload.image_quality_reason,
        reconstruction_prompt=payload.reconstruction_prompt,
        dpp_data=payload.dpp_data,
        # Phase Z2 — photo fingerprint passthrough (used by the
        # pre-flight duplicate check). All optional; legacy clients
        # that don't send them simply produce items with these fields
        # left as ``None`` / ``False``.
        source_sha256=payload.source_sha256,
        source_filename=payload.source_filename,
        source_size_bytes=payload.source_size_bytes,
        source_phash=payload.source_phash,
        source_color_sig=payload.source_color_sig,
        is_duplicate=payload.is_duplicate,
        in_suitcase=payload.in_suitcase or False,
    )
    doc = item.model_dump()

    # For a cropped garment item, its original source image IS the crop.
    # If no crop is provided, fall back to the uploaded parent image.
    crop_data_url = None
    if payload.crop_base64:
        if payload.crop_base64.startswith("data:"):
            crop_data_url = payload.crop_base64
        else:
            _mime = payload.image_mime or "image/jpeg"
            if not _mime.startswith("image/"):
                _mime = "image/jpeg"
            crop_data_url = f"data:{_mime};base64,{payload.crop_base64}"
        doc["segmented_image_url"] = crop_data_url
        doc["original_image_url"] = crop_data_url

    if payload.image_base64 and not doc.get("original_image_url"):
        if payload.image_base64.startswith("data:"):
            doc["original_image_url"] = payload.image_base64
        else:
            _mime = payload.image_mime or "image/jpeg"
            if not _mime.startswith("image/"):
                _mime = "image/jpeg"
            doc["original_image_url"] = f"data:{_mime};base64,{payload.image_base64}"

    if payload.clean_image_url:
        doc["clean_image_url"] = payload.clean_image_url
        doc["clean_image_status"] = "ready"
    else:
        # If the crop or image is a transparent PNG (e.g. from rembg/SegFormer),
        # treat it as clean_image_url immediately.
        primary_url = doc.get("segmented_image_url") or doc.get("original_image_url")
        if primary_url and ("image/png" in primary_url[:30].lower()):
            doc["clean_image_url"] = primary_url
            doc["clean_image_status"] = "ready"

    # Phase Z2.1 — if the client didn't compute a phash (older client,
    # camera capture, etc.) AND we have raw bytes here, compute one
    # server-side so this item is immediately searchable by /preflight
    # without waiting for the lazy backfill cycle. We compute the
    # colour signature on the same condition for the same reason.
    if raw_bytes:
        try:
            from app.services.image_hash import average_hash, color_signature

            if not doc.get("source_phash"):
                ph = average_hash(raw_bytes)
                if ph:
                    doc["source_phash"] = ph
            if not doc.get("source_color_sig"):
                cs = color_signature(raw_bytes)
                if cs:
                    doc["source_color_sig"] = cs
        except Exception:  # noqa: BLE001
            pass

    # Phase Q — persist the reconstructed image (data URL) when supplied.
    if payload.reconstructed_image_b64:
        if payload.reconstructed_image_b64.startswith("data:"):
            doc["reconstructed_image_url"] = payload.reconstructed_image_b64
        else:
            mime = (payload.reconstruction_metadata or {}).get("mime_type", "image/png")
    # Normalize all image data URLs (deskew upright + 0.90 safety margin on 900x1200 canvas)
    from app.services.vision.image import fit_image_data_url_to_card
    for img_key in ("clean_image_url", "reconstructed_image_url", "segmented_image_url", "cutout_url"):
        if doc.get(img_key) and isinstance(doc[img_key], str) and doc[img_key].startswith("data:image/"):
            doc[img_key] = fit_image_data_url_to_card(doc[img_key]) or doc[img_key]

    # Phase R (July 2026) — receipt-import provenance persistence.
    # Store receipt flags before any background task is queued so the
    # document is complete even if the task fires before the insert
    # completes (unlikely with MongoDB's durability guarantees, but
    # belt-and-braces).
    if payload.from_receipt:
        doc["from_receipt"] = True
        doc["receipt_locked_fields"] = list(payload.receipt_locked_fields or [])
        # Default state to "new" for new receipt purchases
        doc["state"] = "new"

    # Best-effort segmentation (non-blocking for POC latency): try once, soft-fail.
    # Phase O.6 — when the item came from the single-pass /analyze path,
    # the photo is already bbox-cropped to a single garment. Skip the
    # synchronous SegFormer call (~2-4s on the hot path) and instead
    # queue rembg as a fire-and-forget BackgroundTask that populates
    # ``clean_image_url`` a few seconds later. Legacy clients (no
    # ``from_one_pass`` flag) keep the existing synchronous SegFormer
    # path bit-for-bit.
    #
    # Patch 8 (May 2026) — the legacy multi-crop ``/analyze`` path now
    # *also* defers rembg (``settings.DEFER_REMBG_ON_ANALYZE``). The
    # analyzer marks each item with ``defer_matte=true`` and the
    # frontend echoes it here so we queue the same background task as
    # the one-pass path. Either flag triggers the same code.
    #
    # Standard closet uploads already receive their clean crop from
    # the analyzer. We do not run post-save background rembg matting on
    # standard items to prevent unwanted image artifacts/over-cropping.
    needs_bg_matte = bool(
        not doc.get("clean_image_url")
        and (payload.defer_matte or payload.from_one_pass)
    )

    # Resolve the raw bytes for the background task once, shared by all branches.
    raw_for_bg: bytes | None = None
    if payload.crop_base64:
        if payload.crop_base64.startswith("data:"):
            raw_for_bg = _bytes_from_data_url(payload.crop_base64)
        else:
            try:
                raw_for_bg = base64.b64decode(payload.crop_base64, validate=True)
            except Exception:
                pass
    if not raw_for_bg:
        raw_for_bg = raw_bytes

    item_id_for_bg = doc["id"]

    if payload.from_receipt and raw_for_bg:
        # Receipt item WITH image → full pipeline: rembg + SegFormer +
        # Gemini analysis. The task chains the matte step first, then
        # merges the VLM result while honouring receipt_locked_fields.
        doc["clean_image_status"] = "pending"
        background_tasks.add_task(
            _run_background_matte_and_analyze,
            item_id_for_bg,
            raw_for_bg,
            payload.category,
            list(payload.receipt_locked_fields or []),
        )
    elif needs_bg_matte and raw_for_bg:
        # Standard single-pass or deferred-matte path (no Gemini analysis).
        doc["clean_image_status"] = "pending"
        background_tasks.add_task(
            _run_background_matte,
            item_id_for_bg,
            raw_for_bg,
            payload.category,
        )
    elif payload.from_receipt and not raw_for_bg:
        # Receipt item WITHOUT image → no pipeline at all. The receipt
        # fields are the complete data; nothing to matte or analyse.
        logger.info(
            "Receipt import: no image for item %s — skipping pipeline",
            item_id_for_bg,
        )
    elif raw_bytes:
        # Legacy HF Inference API segmentation fallback was removed in May
        # 2026 — the in-pod SegFormer path (``clothing_parser``) above and
        # the deferred rembg matte task cover this case, so a missing
        # ``segmented_image_url`` here is expected when neither was wired.
        pass

    # NEW: Trigger the Dynamic Transcoding Pipeline for BlurHash, WebP, AVIF
    if raw_bytes:
        from app.services.encoder_pipeline import process_image_pipeline
        background_tasks.add_task(
            process_image_pipeline,
            item_id_for_bg,
            user["id"],
            raw_bytes,
            payload.image_mime or "image/jpeg",
            raw_for_bg,
        )

    # Patch M14 (May 2026) — Post-save Nano Banana reconstruction. The
    # analyzer marked this item with ``needs_reconstruction=true`` so
    # the /analyze response could leave inside the ingress 60 s ceiling
    # without paying the ~20-40 s Gemini image-gen cost per crop. Queue
    # the actual generation as a fire-and-forget BackgroundTask now —
    # the saved item gets its ``reconstructed_image_url`` patched in
    # seconds-to-minutes later. Mirrors ``needs_bg_matte`` above.
    if payload.needs_reconstruction and raw_bytes:
        if not doc.get("reconstruction_metadata") or not isinstance(doc.get("reconstruction_metadata"), dict):
            doc["reconstruction_metadata"] = {"deferred": True, "status": "pending"}
        else:
            doc["reconstruction_metadata"]["deferred"] = True
        # We use the item's existing analysis fields as the prompt
        # source. Build the same shape ``reconstruct()`` expects.
        recon_analysis: dict[str, Any] = {
            "category": payload.category,
            "sub_category": payload.sub_category,
            "item_type": payload.item_type,
            "color": payload.color,
            "material": payload.material,
            "pattern": payload.pattern,
            "brand": payload.brand,
            "dress_code": (
                payload.dress_code.value
                if hasattr(payload.dress_code, "value")
                else payload.dress_code
            ),
            "title": payload.title,
            "name": payload.name,
            "image_quality_status": payload.image_quality_status,
            "image_quality_reason": payload.image_quality_reason,
            "reconstruction_prompt": payload.reconstruction_prompt,
        }
        background_tasks.add_task(
            _run_background_reconstruction,
            doc["id"],
            raw_bytes,
            recon_analysis,
            payload.reconstruction_reasons,
        )

    # Best-effort FashionCLIP embedding: persist a 512-d L2-normalised
    # vector so the closet can later be searched by similarity
    # ("/closet/search") and listings can be matched against each other.
    # Failure is soft \u2014 the item still saves without an embedding.
    if raw_bytes and fashion_clip_service is not None:
        try:
            vec = await fashion_clip_service.embed_image(raw_bytes)
            if vec:
                doc["clip_embedding"] = vec
                doc["clip_model"] = fashion_clip_service.model_id
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "FashionCLIP embedding skipped for item %s: %s", item.id, exc
            )

    # If the user tagged this item for the marketplace, auto-create a listing.
    # Modes: for_sale -> sell, donate -> donate, swap -> swap. 'own' stays private.
    listing_id: str | None = None
    if payload.marketplace_intent in ("for_sale", "donate", "swap", "rent"):
        mode_map = {"for_sale": "sell", "donate": "donate", "swap": "swap", "rent": "rent"}
        mode = mode_map[payload.marketplace_intent]
        list_price = (payload.price_cents or 0) if mode in ("sell", "rent") else 0
        fees = compute_fees(list_price)
        financial = FinancialMetadata(
            list_price_cents=list_price,
            currency=payload.currency,
            platform_fee_percent=7.0,
            estimated_seller_net_cents=fees.seller_net_cents,
        )
        # Map our fine-grained GarmentCondition to the simpler Listing condition.
        cond_map = {"excellent": "like_new", "good": "good", "fair": "fair", "bad": "fair"}
        listing_condition = cond_map.get(payload.condition or "", "good")
        cover_image = (
            doc.get("clean_image_url")
            or doc.get("segmented_image_url")
            or doc.get("original_image_url")
        )

        listing = Listing(
            closet_item_id=doc["id"],
            seller_id=user["id"],
            source="Shared",
            mode=mode,
            title=payload.name or payload.title,
            description=payload.notes or payload.caption,
            category=payload.category,
            size=payload.size,
            condition=listing_condition,
            images=[cover_image] if cover_image else [],
            financial_metadata=financial,
            status="active",
            auto_created=True,
        )
        await repos.insert(db.listings, listing.model_dump())
        listing_id = listing.id
        # Use the canonical field names that the rest of the codebase
        # (closet card "Complete listing" CTA, marketplace auto-retire
        # on delete, /admin diag) all key on. Older builds wrote
        # ``listing_id`` here, which the UI never read — those items
        # appeared "stuck on Private" because the auto_listing_id
        # field was missing.
        doc["auto_listing_id"] = listing_id
        doc["auto_listing_needs_completion"] = True
        # Lift privacy so the stylist engine also sees it as Shared.
        doc["source"] = "Shared"

    # Pre-generate thumbnail and placeholder to avoid client-side empty card/grey flashes.
    try:
        from app.services.thumbnails import ensure_thumbnail_and_placeholder
        thumb, place = await ensure_thumbnail_and_placeholder(doc)
        if thumb:
            doc["thumbnail_data_url"] = thumb
        if place:
            doc["placeholder_data_url"] = place
    except Exception as exc:
        logger.warning("Pre-generating thumbnail in create_item failed: %s", exc)

    await repos.insert(db.closet_items, doc)
    # Drop analysis-phase temporaries immediately after save ONLY IF clean_image_url is present.
    # If clean_image_url is not ready yet, keep original_image_url so the item is never left without an image.
    if doc.get("clean_image_url"):
        await db.closet_items.update_one(
            {"id": doc["id"]},
            {"$unset": {"original_image_url": "", "segmented_image_url": ""}},
        )
    else:
        await db.closet_items.update_one(
            {"id": doc["id"]},
            {"$unset": {"segmented_image_url": ""}},
        )

    if payload.in_suitcase:
        active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
        if active_s:
            p_list = active_s.get("packing_list") or []
            p_list.append({
                "id": doc["id"],
                "title": doc.get("title") or doc.get("name") or payload.title,
                "category": payload.category.lower(),
                "checked": True,
                "is_missing": False,
                "recommendation_source": None,
                "recommendation_url": None,
            })
            await db.suitcases.update_one(
                {"id": active_s["id"]},
                {"$set": {"packing_list": p_list, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "closet_updated", {"action": "create", "item_id": doc.get("id")})

    return doc


# ---------------------------------------------------------------------------
# Phase Z2 — photo-fingerprint pre-flight duplicate check
# ---------------------------------------------------------------------------
# The Eyes' very first job is to refuse to spend a Gemini token on a JPEG
# the user has already saved. The frontend hashes each selected file
# in-browser (``crypto.subtle.digest('SHA-256', bytes)`` is built into
# every modern browser, so this is free, instant and local) and POSTs
# the resulting list of {filename, size, sha256} tuples here. We answer
# with whichever entries collide with an existing closet row's
# ``source_sha256``. The frontend then either:
#
#   * shows a scrollable confirm dialog (interactive  \u2264 5 photos)
#     where the user picks Skip / "Add anyway \u2b50" per match;
#   * silently skips them and surfaces a count in the final toast
#     (background batch upload, > 5 photos).
#
# Approved duplicates are saved with ``is_duplicate=True`` so the closet
# card paints a red star and the Stylist Brain leaves them out of
# outfit composition (preventing "wear the same polo twice" style

@router.get("")
async def list_items(
    user: dict = Depends(get_current_user),
    source: Source | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    # Optional filter by the item's ``marketplace_intent``. Powers the
    # closet "For sale / Swap / Donate" filter chips that replaced the
    # generic "Shared" filter — surfacing the user's actual marketplace
    # decision instead of the catch-all source flag.
    marketplace_intent: MarketplaceIntent | None = Query(default=None),
    # Phase Z3 — incremental sync. When the frontend already has a
    # snapshot from a prior call it sends ``updated_after`` (ISO8601)
    # to fetch ONLY items whose ``updated_at`` (or ``created_at`` for
    # rows that pre-date the field) is greater than the supplied
    # timestamp. Lets the closet store stay fresh after a focus event
    # without re-shipping the full 25 MB grid each time. Combine with
    # ``?ids_only=1`` to stream just the IDs of currently-existing
    # items so the client can prune anything deleted.
    updated_after: str | None = Query(default=None, max_length=40),
    ids_only: bool = Query(default=False),
    # Default raised from 100 → 500 → 2000 because mid/large closets
    # (300+ items) would silently truncate to the previous default
    # whenever an older frontend bundle was served from cache without
    # an explicit ``limit`` query param. ``le=2000`` is the absolute
    # cap to bound payload size — closets bigger than that should
    # paginate via ``skip``.
    limit: int = Query(default=2000, le=2000),
    skip: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    db = get_db()
    query: dict[str, Any] = {"user_id": user["id"]}
    if not ids_only:
        query["group_role"] = {"$ne": "member"}
        
    if source:
        query["source"] = source
    if marketplace_intent:
        query["marketplace_intent"] = marketplace_intent
    if updated_after:
        # Match either ``updated_at`` (preferred) or ``created_at``
        # (fallback for legacy rows that never received an
        # ``updated_at`` write). $or so we don't miss either flavour.
        query["$or"] = [
            {"updated_at": {"$gt": updated_after}},
            {
                "updated_at": {"$exists": False},
                "created_at": {"$gt": updated_after},
            },
        ]
    if category:
        # Category filter — case-insensitive + synonym aware. Legacy
        # rows in the DB have a mix of Title Case ("Top"), lowercase
        # ("top"/"tops"), and older canonical labels ("Footwear",
        # "Accessories", "Full Body") while the frontend sends the
        # lowercase short form from CATEGORIES. Without this map, a
        # user with 113 items can filter by "Shoes" and see zero,
        # because the DB rows are stored as "Footwear".
        _CATEGORY_SYNONYMS: dict[str, list[str]] = {
            "top":        ["top", "tops"],
            "bottom":     ["bottom", "bottoms"],
            "outerwear":  ["outerwear"],
            "shoes":      ["shoes", "footwear"],
            "accessory":  ["accessory", "accessories"],
            "dress":      ["dress", "dresses", "full body"],
        }
        requested = (category or "").strip().lower()
        synonyms = _CATEGORY_SYNONYMS.get(requested, [requested])
        # Build a case-insensitive regex that matches any of the
        # accepted variants. Anchored + escaped so partial matches
        # (e.g. "top" matching "topcoat") can't leak through.
        import re as _re
        pattern = "^(" + "|".join(_re.escape(s) for s in synonyms) + ")$"
        query["category"] = {"$regex": pattern, "$options": "i"}
    if search:
        query["$text"] = {"$search": search}

    # ``ids_only`` short-circuit. We just need the IDs of currently
    # existing items so the client store can prune anything deleted
    # remotely. ~50 KB instead of 25 MB for a 300-item closet.
    if ids_only:
        cur = db.closet_items.find(
            query, {"_id": 0, "id": 1, "updated_at": 1}
        ).sort("created_at", -1).limit(limit).skip(skip)
        ids = []
        async for row in cur:
            ids.append(row.get("id"))
        total = await repos.count(db.closet_items, query)
        return {
            "items": [],
            "ids": ids,
            "total": total,
            "limit": limit,
            "skip": skip,
            "ids_only": True,
        }

    _EXCLUDE_LIST_FIELDS = {
        "crop_base64": 0,
        "crop_mime": 0,
        "clip_embedding": 0,
        "variants": 0,
        "reconstruction": 0,
        "raw": 0,
        "dpp_data": 0,
    }
    items = await repos.find_many(
        db.closet_items,
        query,
        sort=[("created_at", -1)],
        limit=limit,
        skip=skip,
        projection=_EXCLUDE_LIST_FIELDS,
    )

    # --- thumbnail backfill + heavy-field strip ---
    # The raw docs carry *_image_url fields that are full-resolution
    # base64 data URLs (~0.8-1.5 MB each). Returning them verbatim makes
    # the list response balloon to 20-60 MB for a modest closet. We:
    #   1. Lazy-generate a ~15 KB thumbnail_data_url on first read and
    #      persist it back to Mongo so subsequent calls skip the work.
    #   2. Strip the heavy fields from the wire response. The detail
    #      endpoint GET /closet/{id} still returns them in full.
    from app.services import thumbnails as _thumbs

    async def _async_backfill():
        try:
            updates = await _thumbs.backfill_thumbnails(items)
            if updates:
                from pymongo import UpdateOne
                ops = []
                for (_id, _t, _p) in updates:
                    up = {}
                    if _t:
                        up["thumbnail_data_url"] = _t
                    if _p:
                        up["placeholder_data_url"] = _p
                    if up:
                        ops.append(UpdateOne({"id": _id}, {"$set": up}))
                if ops:
                    await db.closet_items.bulk_write(ops, ordered=False)
        except Exception as exc:
            logger.debug("Background thumbnail backfill skipped: %s", exc)

    import asyncio as _asyncio
    _track_task(_asyncio.create_task(_async_backfill()))

    _HEAVY_FIELDS = (
        "clip_embedding",
        "crop_base64",
        "crop_mime",
        "variants",
        "reconstruction_metadata",
        "retail_metadata",
        "dpp_data",
    )
    for it in items:
        # Normalize fallback image URLs so frontends always find a valid photo
        fallback_photo = it.get("image_url") or it.get("photo_url") or it.get("cutout_url") or it.get("clean_image_url")
        if fallback_photo and not it.get("original_image_url"):
            it["original_image_url"] = fallback_photo
        if fallback_photo and not it.get("image_url"):
            it["image_url"] = fallback_photo

        for k in _HEAVY_FIELDS:
            it.pop(k, None)
        recon = it.get("reconstruction")
        if isinstance(recon, dict):
            recon.pop("image_b64", None)
        raw = it.get("raw")
        if isinstance(raw, dict):
            raw.pop("preview", None)
        pref = it.get("preferred_image_view") or it.get("preferred_view")
        if pref in ("clean", "original"):
            best_display_img = (
                it.get("clean_image_url")
                or it.get("reconstructed_image_url")
                or it.get("reconstruct_image_url")
            )
        else:
            best_display_img = (
                it.get("reconstructed_image_url")
                or it.get("reconstruct_image_url")
                or it.get("clean_image_url")
            )
        if best_display_img:
            if isinstance(best_display_img, str):
                if not best_display_img.startswith("data:") or len(best_display_img) <= 15000:
                    it["thumbnail_data_url"] = best_display_img
                elif not it.get("thumbnail_data_url") or len(str(it.get("thumbnail_data_url"))) > 15000:
                    # Strip huge data-URL from list response
                    it.pop("thumbnail_data_url", None)
            if isinstance(it.get("reconstructed_image_url"), str) and len(it["reconstructed_image_url"]) > 15000 and it["reconstructed_image_url"].startswith("data:"):
                # Avoid returning full-size data URLs in list response
                it.pop("reconstructed_image_url", None)
            if isinstance(it.get("clean_image_url"), str) and len(it["clean_image_url"]) > 15000 and it["clean_image_url"].startswith("data:"):
                it.pop("clean_image_url", None)
        elif isinstance(it.get("thumbnail_data_url"), str) and it.get("thumbnail_data_url"):
            for img_key in ("original_image_url", "segmented_image_url", "cutout_url"):
                val = it.get(img_key)
                if isinstance(val, str) and val.startswith("data:"):
                    it.pop(img_key, None)
            if isinstance(it.get("image_url"), str) and it["image_url"].startswith("data:"):
                it["image_url"] = it["thumbnail_data_url"]
    total = await repos.count(db.closet_items, query)
    # Surface the response shape in logs so deployment/cache issues are
    # immediately diagnosable. If a user reports "I have 311 items but
    # see only 100", we can grep this line to confirm whether the
    # backend ACTUALLY returned 100 (cap somewhere upstream) vs
    # returned 311 (frontend / browser cache problem).
    logger.info(
        "GET /closet user=%s returning items=%d total=%d limit=%d skip=%d "
        "filters={source=%s category=%s search=%s}",
        user["id"], len(items), total, limit, skip,
        source or "-", category or "-", search or "-",
    )
    return {"items": items, "total": total, "limit": limit, "skip": skip}


# ─────────────────────────────────────────────────────────────────────
# Phase Z2.3 — server → client streaming hash-repair
# ─────────────────────────────────────────────────────────────────────

@router.get("/{item_id}")
async def get_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")
    await _maybe_retry_stale_matte(item, background_tasks)

    # Hydrate group members
    group_id = item.get("group_id")
    members = []
    if group_id:
        cursor = db.closet_items.find({
            "group_id": group_id,
            "id": {"$ne": item_id},
            "user_id": user["id"]
        })
        members = [doc async for doc in cursor]
        for m in members:
            if "_id" in m:
                m.pop("_id")
    item["group_members"] = members
    return item



@router.patch("/{item_id}")
async def update_item(
    item_id: str, payload: UpdateItemIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    patch = payload.model_dump(exclude_none=True)
    if "reconstructed_image_url" in patch:
        if patch["reconstructed_image_url"] in ("None", "null", "undefined", ""):
            patch["reconstructed_image_url"] = None
        elif patch["reconstructed_image_url"]:
            patch["reconstructed_image_url"] = compress_image_url_or_b64(patch["reconstructed_image_url"], max_dim=1024, quality=75)
            from app.services.vision.image import fit_image_data_url_to_card
            patch["reconstructed_image_url"] = fit_image_data_url_to_card(patch["reconstructed_image_url"])
    if "clean_image_url" in patch and patch["clean_image_url"]:
        from app.services.vision.image import fit_image_data_url_to_card
        patch["clean_image_url"] = fit_image_data_url_to_card(patch["clean_image_url"]) or patch["clean_image_url"]
    # The `clear_reconstruction` flag is a command, not a value we persist.
    # Pop it + translate into explicit null-sets on the related columns.
    if patch.pop("clear_reconstruction", False):
        patch["reconstructed_image_url"] = None
        patch["reconstruction_metadata"] = None
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    db = get_db()
    # Snapshot prior values so we can detect transitions AFTER the update
    # commits. We snapshot both ``source`` AND ``marketplace_intent`` —
    # the marketplace pipeline can be triggered by either flipping (the
    # closet card "Share" toggle hits ``source``; the item-detail
    # marketplace dropdown hits ``marketplace_intent``), and we need to
    # honour both entry points.
    prior = await db.closet_items.find_one(
        {"id": item_id, "user_id": user["id"]},
        {"_id": 0, "source": 1, "marketplace_intent": 1},
    )

    # If the patch explicitly provides a new reconstructed_image_url (e.g. from
    # "Clean background" save), we must invalidate the thumbnail so it doesn't mask it.
    unset_doc = {}
    if "reconstructed_image_url" in patch and patch["reconstructed_image_url"]:
        unset_doc = {"thumbnail_data_url": ""}

    if unset_doc:
        updated = await db.closet_items.find_one_and_update(
            {"id": item_id, "user_id": user["id"]},
            {"$set": patch, "$unset": unset_doc},
            return_document=ReturnDocument.AFTER,
        )
    else:
        updated = await repos.update(
            db.closet_items, {"id": item_id, "user_id": user["id"]}, patch
        )
        
    if not updated:
        raise HTTPException(404, "Item not found")

    # ---------------------------------------------------------------
    # Marketplace auto-list / auto-retire pipeline.
    #
    # Two trigger paths land here:
    #
    #   1. ``source`` flips Private → Shared (the closet card "Share"
    #      toggle). Mode defaults to ``swap`` because the toggle has
    #      no other signal — the user can refine via the listing's
    #      "Complete listing" CTA.
    #
    #   2. ``marketplace_intent`` flips ``own`` → one of
    #      ``for_sale`` / ``swap`` / ``donate`` (the item-detail page
    #      dropdown). This is the path users actually take, and the
    #      previous code missed it because it gated on ``source``
    #      alone — leaving items stuck as Private despite the user
    #      explicitly asking to sell/swap/donate.
    #
    # When the user reverses either flip (Shared → Private, OR
    # marketplace_intent → ``own``) we retire the auto-created listing
    # so the item disappears from the marketplace.
    # ---------------------------------------------------------------
    new_source = patch.get("source")
    prior_source = (prior or {}).get("source")
    new_intent = patch.get("marketplace_intent")
    prior_intent = (prior or {}).get("marketplace_intent") or "own"

    _MARKETPLACE_INTENTS = {"for_sale", "swap", "donate", "rent"}
    _INTENT_TO_MODE = {"for_sale": "sell", "swap": "swap", "donate": "donate", "rent": "rent"}

    target_intent = new_intent if new_intent is not None else updated.get("marketplace_intent")
    target_source = new_source if new_source is not None else updated.get("source")

    # Should we OPEN or ENSURE an active listing on this update?
    open_listing = False
    chosen_mode = "swap"  # safe default
    chosen_price_cents = 0

    chosen_currency = (
        patch.get("currency")
        or updated.get("currency")
        or (prior or {}).get("currency")
        or "USD"
    )

    if target_intent in _MARKETPLACE_INTENTS or target_source == "Shared":
        open_listing = True
        if target_intent in _MARKETPLACE_INTENTS:
            chosen_mode = _INTENT_TO_MODE[target_intent]
        else:
            chosen_mode = "swap"
        if chosen_mode in ("sell", "rent"):
            chosen_price_cents = int(
                patch.get("price_cents") or updated.get("price_cents") or 0
            )

    # Should we CLOSE the auto-created listing on this update?
    close_listing = False
    if not open_listing:
        if (new_source == "Private" and prior_source == "Shared") or (
            new_intent is not None
            and new_intent not in _MARKETPLACE_INTENTS
            and prior_intent in _MARKETPLACE_INTENTS
        ):
            close_listing = True

    if open_listing:
        try:
            existing = await db.listings.find_one(
                {"closet_item_id": item_id, "seller_id": user["id"]},
            )
            if existing and existing.get("status") in ("draft", "active", "reserved"):
                fees = compute_fees(chosen_price_cents)
                set_fields: dict[str, Any] = {
                    "mode": chosen_mode,
                    "currency": chosen_currency,
                    "financial_metadata.list_price_cents": chosen_price_cents,
                    "financial_metadata.currency": chosen_currency,
                    "financial_metadata.platform_fee_percent": 7.0,
                    "financial_metadata.estimated_seller_net_cents": fees.seller_net_cents,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                recon = updated.get("reconstructed_image_url") or updated.get("reconstruct_image_url")
                clean = updated.get("clean_image_url")
                best = recon or clean
                if best:
                    set_fields["reconstructed_image_url"] = recon
                    set_fields["clean_image_url"] = clean
                    set_fields["thumbnail_data_url"] = best
                    imgs = existing.get("images") or []
                    if not imgs or (isinstance(imgs, list) and len(imgs) > 0 and imgs[0] != best):
                        set_fields["images"] = [best] + [i for i in imgs if i != best]

                if existing.get("status") != "active":
                    set_fields["status"] = "active"
                await db.listings.update_one(
                    {"id": existing["id"]},
                    {"$set": set_fields},
                )
                if updated.get("source") != "Shared" or not updated.get("auto_listing_id"):
                    await db.closet_items.update_one(
                        {"id": item_id, "user_id": user["id"]},
                        {"$set": {
                            "source": "Shared",
                            "auto_listing_id": existing["id"],
                            "auto_listing_needs_completion": False,
                        }},
                    )
                    updated["source"] = "Shared"
                updated["auto_listing_id"] = existing["id"]
            else:
                from app.models.schemas import (
                    FinancialMetadata,
                    Listing,
                )
                images: list[str] = []
                group_id = updated.get("group_id")
                if group_id:
                    group_items = await repos.find_many(
                        db.closet_items,
                        {"group_id": group_id, "user_id": user["id"]}
                    )
                    group_items.sort(key=lambda x: 0 if x.get("group_role") == "host" else 1)
                    for g_item in group_items:
                        for fld in (
                            "clean_image_url",
                            "reconstructed_image_url",
                            "cutout_url",
                            "thumbnail_data_url",
                            "image_url",
                            "segmented_image_url",
                            "original_image_url",
                        ):
                            url = g_item.get(fld)
                            if isinstance(url, str) and url:
                                images.append(url)
                                break
                else:
                    for fld in (
                        "clean_image_url",
                        "reconstructed_image_url",
                        "cutout_url",
                        "thumbnail_data_url",
                        "image_url",
                        "segmented_image_url",
                        "original_image_url",
                    ):
                        url = updated.get(fld)
                        if isinstance(url, str) and url:
                            images.append(url)
                            break

                _COND_MAP = {
                    "excellent": "like_new",
                    "like_new": "like_new",
                    "new": "new",
                    "good": "good",
                    "fair": "fair",
                    "bad": "fair",
                }
                raw_cond = (
                    updated.get("condition") or updated.get("state") or "good"
                )
                listing_condition = _COND_MAP.get(raw_cond, "good")
                fees = compute_fees(chosen_price_cents)

                # Ensure location is a valid GeoJSON dict or None
                loc = updated.get("location")
                if not isinstance(loc, dict):
                    loc = None
                if not loc and user.get("home_location"):
                    home = user["home_location"]
                    lat_coord = home.get("lat")
                    lng_coord = home.get("lng")
                    if lat_coord is not None and lng_coord is not None:
                        loc = {
                            "type": "Point",
                            "coordinates": [float(lng_coord), float(lat_coord)],
                            "city": home.get("city"),
                            "country": home.get("country"),
                            "region": home.get("region"),
                        }

                clean_img = updated.get("clean_image_url")
                recon_img = updated.get("reconstructed_image_url")
                thumb_img = updated.get("thumbnail_data_url") or (images[0] if images else None)

                listing = Listing(
                    closet_item_id=item_id,
                    seller_id=user["id"],
                    source="Shared",
                    mode=chosen_mode,
                    title=updated.get("title") or "Untitled",
                    description=updated.get("notes") or updated.get("caption"),
                    category=updated.get("category") or "Top",
                    size=updated.get("size"),
                    condition=listing_condition,
                    images=images,
                    clean_image_url=clean_img,
                    reconstructed_image_url=recon_img,
                    thumbnail_data_url=thumb_img,
                    location=loc,
                    currency=chosen_currency,
                    financial_metadata=FinancialMetadata(
                        list_price_cents=chosen_price_cents,
                        currency=chosen_currency,
                        platform_fee_percent=7.0,
                        estimated_seller_net_cents=fees.seller_net_cents,
                    ),
                    auto_created=True,
                    status="active",
                )
                await repos.insert(db.listings, listing.model_dump())
                source_patch: dict[str, Any] = {
                    "auto_listing_id": listing.id,
                    "auto_listing_needs_completion": True,
                }
                if updated.get("source") != "Shared":
                    source_patch["source"] = "Shared"
                await db.closet_items.update_one(
                    {"id": item_id, "user_id": user["id"]},
                    {"$set": source_patch},
                )
                updated["auto_listing_id"] = listing.id
                updated["auto_listing_needs_completion"] = True
                if "source" in source_patch:
                    updated["source"] = "Shared"
                logger.info(
                    "auto-listed closet item %s as listing %s mode=%s trigger=%s",
                    item_id, listing.id, chosen_mode, target_intent,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("auto-list failed for %s: %s", item_id, exc)

    elif close_listing:
        # User reversed the marketplace decision — retire any
        # auto-created listing(s) we previously spawned. We never
        # touch listings the user curated by hand (auto_created
        # missing or False). We also flip the closet item's surface
        # flags (``source``, ``auto_listing_id``,
        # ``auto_listing_needs_completion``) back to "Private" so the
        # closet card reflects the revert immediately — without this
        # secondary patch the badge would still show "Shared" because
        # only the listing changed.
        try:
            retire_res = await db.listings.update_many(
                {
                    "closet_item_id": item_id,
                    "seller_id": user["id"],
                    "auto_created": True,
                    "status": {"$in": ["draft", "active", "reserved"]},
                },
                {"$set": {
                    "status": "removed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            if retire_res.modified_count:
                logger.info(
                    "auto-retired %d listing(s) for closet item %s "
                    "(intent reverted to %s)",
                    retire_res.modified_count, item_id, new_intent or "private",
                )
            # Always reset the closet item's surface flags on revert,
            # even if no listing was active (defensive: covers items
            # that were partially backfilled or where the listing was
            # already retired through another path).
            revert_patch: dict[str, Any] = {
                "auto_listing_id": None,
                "auto_listing_needs_completion": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            # Only flip source if the user didn't explicitly pass a
            # source in this same PATCH — respect their choice.
            if new_source is None:
                revert_patch["source"] = "Private"
            await db.closet_items.update_one(
                {"id": item_id, "user_id": user["id"]},
                {"$set": revert_patch},
            )
            updated.update(revert_patch)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "auto-retire failed for closet item %s: %s", item_id, exc,
            )

    else:
        # No marketplace transition this update — but the user might
        # still have edited price / currency on an item that's
        # already published. Sync those changes onto the linked
        # listing so the marketplace card reflects the new values
        # immediately. Without this, an ILS-priced item created when
        # the listing was first auto-spawned would show "$10" on the
        # marketplace forever even after the user later corrected
        # the currency on the item card.
        price_or_currency_changed = (
            "price_cents" in patch or "currency" in patch
        )
        was_listed = (
            (prior or {}).get("source") == "Shared"
            or ((prior or {}).get("marketplace_intent") or "own")
            in _MARKETPLACE_INTENTS
        )
        if price_or_currency_changed and was_listed:
            try:
                existing = await db.listings.find_one(
                    {
                        "closet_item_id": item_id,
                        "seller_id": user["id"],
                        "auto_created": True,
                        "status": {"$in": ["draft", "active"]},
                    },
                    {"_id": 0, "id": 1, "mode": 1},
                )
                if existing:
                    # ``for_sale`` listings carry a real price; swap /
                    # donate listings stay at 0 regardless of what's
                    # on the closet item, so a user fiddling with
                    # price on a swap listing doesn't accidentally
                    # publish a price for a non-sale item.
                    if existing.get("mode") in ("sell", "rent"):
                        synced_price = int(
                            patch.get("price_cents")
                            or updated.get("price_cents")
                            or 0
                        )
                    else:
                        synced_price = 0
                    fees = compute_fees(synced_price)
                    await db.listings.update_one(
                        {"id": existing["id"]},
                        {"$set": {
                            "currency": chosen_currency,
                            "description": updated.get("notes") or updated.get("caption") or existing.get("description"),
                            "financial_metadata.list_price_cents": synced_price,
                            "financial_metadata.currency": chosen_currency,
                            "financial_metadata.platform_fee_percent": 7.0,
                            "financial_metadata.estimated_seller_net_cents": fees.seller_net_cents,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                    logger.info(
                        "synced listing %s for closet item %s "
                        "(price_cents=%s currency=%s)",
                        existing["id"], item_id, synced_price, chosen_currency,
                    )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "listing sync failed for closet item %s: %s",
                    item_id, exc,
                )

    # Always sync reconstructed_image_url & clean_image_url to all linked listings
    recon_img = updated.get("reconstructed_image_url") or updated.get("reconstruct_image_url")
    clean_img = updated.get("clean_image_url")
    best_img = recon_img or clean_img
    if best_img:
        try:
            async for lst in db.listings.find({"closet_item_id": item_id}):
                l_fields = {
                    "reconstructed_image_url": recon_img,
                    "clean_image_url": clean_img,
                    "thumbnail_data_url": best_img,
                }
                imgs = lst.get("images") or []
                if not imgs or (isinstance(imgs, list) and len(imgs) > 0 and imgs[0] != best_img):
                    l_fields["images"] = [best_img] + [i for i in imgs if i != best_img]
                await db.listings.update_one({"id": lst["id"]}, {"$set": l_fields})
        except Exception as exc:  # noqa: BLE001
            logger.warning("listing image sync failed for closet item %s: %s", item_id, exc)

    if updated and "_id" in updated:
        updated.pop("_id")

    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "closet_updated", {"action": "update", "item_id": item_id})

    return updated



@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
) -> Response:
    db = get_db()
    # Fetch first so we have the item's fingerprint (sha256 / phash)
    # BEFORE it's gone. We need them to find any siblings still
    # carrying a red ⭐ that would become orphaned by this delete.
    item = await db.closet_items.find_one(
        {"id": item_id, "user_id": user["id"]},
        {"_id": 0, "id": 1, "source_sha256": 1, "source_phash": 1, "is_duplicate": 1, "group_id": 1, "group_role": 1},
    )
    if not item:
        raise HTTPException(404, "Item not found")

    deleted = await repos.delete(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not deleted:
        raise HTTPException(404, "Item not found")

    # Phase Grouping: Group cleanup and dissolution
    group_id = item.get("group_id")
    group_role = item.get("group_role")
    if group_id:
        if group_role == "host":
            # Dissolve the group: ungroup all members since host is deleted
            await db.closet_items.update_many(
                {"group_id": group_id, "user_id": user["id"]},
                {"$set": {"group_id": None, "group_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        elif group_role == "member":
            # Check remaining items in the group
            remaining = await db.closet_items.find(
                {"group_id": group_id, "user_id": user["id"]}
            ).to_list(None)
            if len(remaining) <= 1:
                # Only 1 item left -> dissolve group
                await db.closet_items.update_many(
                    {"group_id": group_id, "user_id": user["id"]},
                    {"$set": {"group_id": None, "group_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            else:
                # Re-run group analysis on remaining members in background
                background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    # Phase Outfits cleanup — remove deleted garment references from outfits
    try:
        await db.outfits.update_many(
            {"user_id": user["id"], "garments.closet_item_id": item_id},
            {"$pull": {"garments": {"closet_item_id": item_id}}}
        )
        await db.outfits.update_many(
            {"user_id": user["id"], "items.closet_item_id": item_id},
            {"$pull": {"items": {"closet_item_id": item_id}}}
        )
        await db.outfits.delete_many(
            {"user_id": user["id"], "garments": {"$size": 0}}
        )
    except Exception as exc:
        logger.warning("outfit cleanup failed for closet item %s: %s", item_id, exc)

    # Marketplace cleanup — when a user deletes a closet item that
    # is linked to one or more listings, silently retire the open
    # listings so the item doesn't linger on the marketplace with
    # dead images. We only touch ``draft`` and ``active`` listings:
    #
    #   * ``draft``    — never published, safe to mark ``removed``.
    #   * ``active``   — visible to buyers, flip to ``removed`` so
    #                    the browse grid and direct links render a
    #                    graceful "no longer available" state
    #                    instead of 404'ing on the missing item.
    #   * ``reserved`` — a buyer is mid-transaction; DO NOT touch.
    #                    The seller can still delete their closet
    #                    row (their records are theirs) but the
    #                    listing stays alive until the reservation
    #                    resolves, which is the buyer-protective
    #                    behaviour we want.
    #   * ``sold``     — already exchanged hands; leave as history.
    #   * ``removed``  — already gone; nothing to do.
    try:
        retire_res = await db.listings.update_many(
            {
                "closet_item_id": item_id,
                "seller_id": user["id"],
                "status": {"$in": ["draft", "active"]},
            },
            {
                "$set": {
                    "status": "removed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        if retire_res.modified_count:
            logger.info(
                "closet delete: retired %d listing(s) linked to %s",
                retire_res.modified_count,
                item_id,
            )
    except Exception as exc:  # noqa: BLE001
        # Listing cleanup is a best-effort companion to the delete;
        # never let a listings write failure raise 500 on an already
        # successful closet delete.
        logger.warning(
            "listing retire failed for closet item %s: %s", item_id, exc
        )

    # Phase Z2 — star auto-demotion. Scenario: user uploaded A
    # (is_duplicate=False), then approved B as a duplicate
    # (is_duplicate=True, red ⭐). They now delete A. Without this
    # block, B would be left as the *only* copy in the closet yet
    # still carry its ⭐ and be excluded from Stylist Brain
    # suggestions — a confusing dangling state.
    #
    # Fix: look up every remaining closet item that shares the
    # deleted item's fingerprint (exact SHA-256 match OR phash
    # within the DEFAULT_HAMMING_THRESHOLD bits). If the group is
    # now empty there's nothing to do. Otherwise we promote exactly
    # one survivor to "original" by clearing its is_duplicate flag,
    # preferring the oldest (most likely to be the first upload the
    # user thought of as the "real" one). Any additional survivors
    # beyond that stay starred — they're still duplicates of each
    # other and of the promoted one.
    try:
        sha = item.get("source_sha256")
        ph = item.get("source_phash")
        if not (sha or ph):
            return Response(status_code=204)

        from app.services.image_hash import (
            DEFAULT_HAMMING_THRESHOLD,
            hamming_distance,
        )

        # Pull candidates cheaply — we need id, hashes, is_duplicate,
        # and created_at (for the oldest-first tie-break).
        or_clauses: list[dict[str, Any]] = []
        if sha:
            or_clauses.append({"source_sha256": sha})
        # phash candidates are filtered client-side by Hamming
        # distance because Mongo can't do that in a single query.
        # We over-pull by matching "any non-null phash" + same user,
        # then walk the list. At typical closet sizes (≤ 500) this
        # is a sub-100 ms operation.
        if ph:
            or_clauses.append({"source_phash": {"$type": "string"}})
        cursor = db.closet_items.find(
            {"user_id": user["id"], "$or": or_clauses},
            {
                "_id": 0,
                "id": 1,
                "source_sha256": 1,
                "source_phash": 1,
                "is_duplicate": 1,
                "created_at": 1,
            },
        )
        siblings: list[dict[str, Any]] = []
        async for row in cursor:
            same_sha = sha and row.get("source_sha256") == sha
            close_ph = (
                ph
                and row.get("source_phash")
                and hamming_distance(ph, row.get("source_phash"))
                <= DEFAULT_HAMMING_THRESHOLD
            )
            if same_sha or close_ph:
                siblings.append(row)

        if not siblings:
            return Response(status_code=204)

        # If ANY sibling already has is_duplicate=False, the group
        # still has an "original" — nothing to promote.
        if any(not s.get("is_duplicate") for s in siblings):
            return Response(status_code=204)

        # Otherwise every survivor is starred — promote the oldest
        # one. Fall back to the first we saw if created_at is
        # missing on every row.
        promote = min(
            siblings,
            key=lambda s: s.get("created_at") or "",
        )
        await db.closet_items.update_one(
            {"id": promote["id"], "user_id": user["id"]},
            {"$set": {"is_duplicate": False,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        logger.info(
            "closet delete: promoted %s (group size=%d) after deleting %s",
            promote["id"],
            len(siblings),
            item_id,
        )
    except Exception as exc:  # noqa: BLE001
        # Auto-demotion is a UX nicety — never let a failure here
        # break the delete itself (the item is already gone).
        logger.warning("star auto-demotion failed for %s: %s", item_id, exc)

    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "closet_updated", {"action": "delete", "item_id": item_id})

    return Response(status_code=204)


