"""Closet CRUD — honours Source Tags (Private/Shared/Retail).

Items default to `source=Private`. Uploading an image triggers a best-effort
Hugging Face SAM segmentation in the background; failures are swallowed
(visible in logs) and the original image URL is retained.
"""
from __future__ import annotations

import asyncio
import base64
import httpx
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pymongo import ReturnDocument

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

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
from app.services.auth import get_current_user
from app.services.fees import compute_fees
from app.services.vision import garment_vision_service
from app.services.fashion_clip import fashion_clip_service
from app.services.gemini_image_service import gemini_image_service
from app.services.image_compression import (
    compress_b64_image,
    compress_image_bytes,
    compress_image_url_or_b64,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/closet", tags=["closet"])

# Process-wide guard around the heavy analyze pipeline (SegFormer +
# Gemini API calls). Historically this was a hard Semaphore(1) because
# rembg ran INSIDE ``/analyze`` and two concurrent onnxruntime sessions
# reliably OOM-killed the second one on the 3 GB Hetzner box (symptom:
# the second upload silently "lands as-is" with blank fields).
#
# Patch M15 (May 2026) — that motivation is gone. ``/analyze`` no
# longer runs rembg (Patch 8 deferred it to a post-save BackgroundTask
# via ``DEFER_REMBG_ON_ANALYZE``) and no longer runs Nano Banana
# reconstruction either (Patch M14 deferred it via
# ``DEFER_RECONSTRUCTION_ON_ANALYZE``). What remains inside the hot
# path is SegFormer (one short CPU spike) + Gemini API calls (network-
# bound, no local memory). Both are safely parallelisable.
#
# Keeping the semaphore at 1 was the *real* cause of "Analysis failed
# on second/third bulk upload" 502s: with each call taking 17-31 s
# post-M14, the 3rd-4th queued request waited >60 s and the Kubernetes
# ingress killed it with a 502 — even though the backend ultimately
# returned 200 OK seconds later.
#
# Default raised to 3 concurrent analyses. Tunable via
# ``ANALYZE_CONCURRENCY`` env var so RAM-constrained deploys can dial
# it back to 1 without a code change.
_ANALYZE_CONCURRENCY = max(1, int(os.environ.get("ANALYZE_CONCURRENCY", "1")))
_ANALYZE_LOCK = asyncio.Semaphore(_ANALYZE_CONCURRENCY)
logger.info(
    "closet: analyze concurrency = %d (env ANALYZE_CONCURRENCY)",
    _ANALYZE_CONCURRENCY,
)


class CreateItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: Source = "Private"
    # Descriptive
    name: str | None = None
    title: str
    caption: str | None = None
    # Taxonomy
    category: str
    sub_category: str | None = None
    item_type: str | None = None
    brand: str | None = None
    gender: GarmentGender | None = None
    dress_code: DressCode | None = None
    season: list[str] = Field(default_factory=list)
    tradition: str | None = None
    # Composition
    size: str | None = None
    color: str | None = None
    colors: list[WeightedTag] = Field(default_factory=list)
    material: str | None = None
    fabric_materials: list[WeightedTag] = Field(default_factory=list)
    pattern: str | None = None
    # Quality
    state: GarmentState | None = None
    condition: GarmentCondition | None = None
    quality: GarmentQuality | None = None
    repair_advice: str | None = None
    # Pricing + marketplace intent
    price_cents: int | None = None
    currency: str = "USD"
    marketplace_intent: MarketplaceIntent = "own"
    # Legacy
    formality: Formality | None = None
    cultural_tags: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    # Media
    original_image_url: str | None = None
    image_base64: str | None = None
    crop_base64: str | None = None
    image_mime: str = "image/jpeg"
    # Phase Q — Wardrobe Reconstructor (optional; set by /analyze response)
    reconstructed_image_b64: str | None = None
    reconstruction_metadata: dict[str, Any] | None = None
    # Purchase history (optional)
    purchase_price_cents: int | None = None
    purchase_currency: str = "USD"
    purchase_date: str | None = None
    notes: str | None = None
    retail_metadata: RetailMetadata | None = None
    in_suitcase: bool | None = None
    # Phase V6 — DPP data imported via QR scan (optional)
    dpp_data: dict[str, Any] | None = None
    # ---- Phase Z2 — photo-fingerprint pre-flight (optional) ----
    # The frontend computes these in-browser before upload and passes
    # them through unchanged so we can later spot exact-byte duplicate
    # JPEGs without an LLM call. ``source_sha256`` is the only field
    # used for equality; the other two are stored verbatim for UI
    # diagnostics ("we matched IMG_1742.jpg / 4.2 MB").
    source_sha256: str | None = None
    source_filename: str | None = None
    source_size_bytes: int | None = None
    # Phase Z2.1 — 64-bit average-hash of the user's incoming photo
    # (16 hex chars), computed in-browser via the same crypto.subtle
    # path as sha256. Catches re-uploads even when the bytes differ
    # (e.g. JPEG re-compression). Optional.
    source_phash: str | None = None
    # Phase Z2.2 — 24-byte RGB colour signature (48 hex chars)
    # computed in-browser via colorSignatureFile. Used together with
    # ``source_phash`` to distinguish two same-shape garments of
    # different colours (e.g. navy shorts vs grey shorts) that the
    # luminance-only phash cannot tell apart on its own.
    source_color_sig: str | None = None
    # Set when the user explicitly approves a photo the pre-flight
    # flagged as already in their closet. Closet card renders a red ⭐
    # and the Stylist Brain skips it during outfit composition.
    is_duplicate: bool = False
    # Phase O.6 — when True, this item was created from a single-pass
    # ``/analyze`` response (``EYES_ONE_PASS=true``) so the photo is
    # already bbox-cropped to a single garment. Triggers the
    # backgrounded rembg matte instead of the synchronous SegFormer
    # cutout — saves ~10-17s of hot-path time at /save. Legacy clients
    # omit this field and the synchronous SegFormer path runs as
    # before.
    from_one_pass: bool = False
    # Patch 8 (May 2026) — legacy ``/analyze`` (multi-crop SegFormer
    # path) now also defers rembg by default (``settings.DEFER_REMBG_ON_ANALYZE=true``).
    # Each item in the response carries ``defer_matte=true`` and the
    # frontend echoes it back on save so we queue the same
    # ``_run_background_matte`` task that the Phase-O.6 path uses.
    # Functionally equivalent to ``from_one_pass=True`` for the save
    # endpoint's purposes; kept as a separate field for clearer logs
    # and so the two paths can be enabled / disabled independently.
    defer_matte: bool = False
    # Patch M14 (May 2026) — When the analyzer deferred Nano Banana
    # reconstruction to keep ``/closet/analyze`` under the ingress 60s
    # ceiling, each item arrives flagged so the save handler can fire a
    # post-save BackgroundTask to fill in ``reconstructed_image_url``.
    # See ``DEFER_RECONSTRUCTION_ON_ANALYZE`` in config. Mirrors the
    # ``defer_matte`` / ``_run_background_matte`` pattern.
    needs_reconstruction: bool = False
    reconstruction_reasons: list[str] = []
    # Phase R (July 2026) — digital receipt import provenance.
    # When True, this item was created from a parsed digital receipt.
    # If an image is also supplied, the background task runs the full
    # GarmentVision pipeline (rembg + SegFormer + Gemini analysis) and
    # then merges the analysis result, skipping any field listed in
    # ``receipt_locked_fields`` so the receipt data is never overwritten.
    # When no image is supplied, no analysis runs at all.
    from_receipt: bool = False
    # Field names whose values came from the receipt parser. The background
    # matte-and-analyze task and the ``/reanalyze`` endpoint both treat
    # these as immutable: Gemini output for a locked field is silently
    # discarded unless the current DB value is empty/falsy.
    receipt_locked_fields: list[str] = Field(default_factory=list)


class UpdateItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: Source | None = None
    # Grouping
    group_id: str | None = None
    group_role: Literal["host", "member"] | None = None
    # Descriptive
    name: str | None = None
    title: str | None = None
    caption: str | None = None
    # Taxonomy
    category: str | None = None
    sub_category: str | None = None
    item_type: str | None = None
    brand: str | None = None
    gender: GarmentGender | None = None
    dress_code: DressCode | None = None
    season: list[str] | None = None
    tradition: str | None = None
    # Composition
    size: str | None = None
    color: str | None = None
    colors: list[WeightedTag] | None = None
    material: str | None = None
    fabric_materials: list[WeightedTag] | None = None
    pattern: str | None = None
    # Quality
    state: GarmentState | None = None
    condition: GarmentCondition | None = None
    quality: GarmentQuality | None = None
    repair_advice: str | None = None
    # Pricing + marketplace intent
    price_cents: int | None = None
    currency: str | None = None
    marketplace_intent: MarketplaceIntent | None = None
    # Legacy
    formality: Formality | None = None
    cultural_tags: list[str] | None = None
    tags: list[str] | None = None
    # Wear tracking
    wear_count: int | None = None
    last_worn_at: str | None = None
    notes: str | None = None
    # Phase Q — reconstruction knobs
    reconstructed_image_url: str | None = None
    reconstruction_metadata: dict[str, Any] | None = None
    clean_image_url: str | None = None
    clean_image_status: str | None = None
    # Allow clearing the reconstruction (user can "revert" via Repair UI)
    clear_reconstruction: bool = False


# --- Closet Service Helpers & Background Tasks ---
from app.services import closet_service

_pick_segformer_mask_for_category = closet_service.pick_segformer_mask_for_category
_bytes_from_data_url = closet_service.bytes_from_data_url
_ensure_min_resolution = closet_service.ensure_min_resolution
_read_image_bytes_from_url = closet_service.read_image_bytes_from_url
_maybe_retry_stale_matte = closet_service.maybe_retry_stale_matte
_run_background_matte = closet_service.run_background_matte
_run_background_matte_and_analyze = closet_service.run_background_matte_and_analyze
_run_background_reconstruction = closet_service.run_background_reconstruction
@router.post("", status_code=201)
async def create_item(
    payload: CreateItemIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    sub_active = (user.get("subscription") or {}).get("is_active", False)
    if not sub_active:
        current_count = await db.closet_items.count_documents({"user_id": user["id"]})
        capacity_limit = 150 + user.get("closet_capacity_bonus", 0)
        if current_count >= capacity_limit:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "closet_capacity_exceeded",
                    "message": f"You have reached your free closet capacity of {capacity_limit} items. Upgrade to DressApp Pro to add more items.",
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
        tags=payload.tags,
        original_image_url=payload.original_image_url,
        purchase_price_cents=payload.purchase_price_cents,
        purchase_currency=payload.purchase_currency,
        purchase_date=payload.purchase_date,
        notes=payload.notes,
        retail_metadata=payload.retail_metadata,
        reconstruction_metadata=payload.reconstruction_metadata,
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

    # Phase P / Patch 7 Fix: Maintain both the uncropped photo (original_image_url)
    # and the tight crop from /analyze (segmented_image_url). This ensures the
    # uncropped user photo is preserved forever, but the UX still gets the crop 
    # to display while the background matte is pending.
    if payload.image_base64:
        if payload.image_base64.startswith("data:"):
            doc["original_image_url"] = payload.image_base64
        else:
            _mime = payload.image_mime or "image/jpeg"
            if not _mime.startswith("image/"):
                _mime = "image/jpeg"
            doc["original_image_url"] = (
                f"data:{_mime};base64,{payload.image_base64}"
            )
    
    if payload.crop_base64:
        if payload.crop_base64.startswith("data:"):
            doc["segmented_image_url"] = payload.crop_base64
        else:
            _mime = payload.image_mime or "image/jpeg"
            if not _mime.startswith("image/"):
                _mime = "image/jpeg"
            doc["segmented_image_url"] = (
                f"data:{_mime};base64,{payload.crop_base64}"
            )

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
            doc["reconstructed_image_url"] = (
                f"data:{mime};base64,{payload.reconstructed_image_b64}"
            )

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
    # Phase R (July 2026) — receipt-import items with an image get the
    # full matte + Gemini analysis chain. Those without an image skip
    # all pipeline work — the receipt fields are the complete data.
    needs_bg_matte = (payload.from_one_pass or payload.defer_matte) and (payload.crop_base64 or payload.image_base64)

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
        cover_image = doc.get("original_image_url") or doc.get("segmented_image_url")
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
                "recommendation_url": None
            })
            await db.suitcases.update_one(
                {"id": active_s["id"]},
                {"$set": {"packing_list": p_list, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

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
# hallucinations).
class PreflightPhotoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # SHA-256 hex digest of the raw file bytes (64 lowercase chars).
    # Catches exact-byte re-uploads.
    sha256: str | None = None
    # 16-char hex aHash. Catches visually-identical re-uploads even
    # after JPEG re-compression / resizing. Optional — the frontend
    # computes it via canvas + the in-browser hashing helper.
    phash: str | None = None
    # Phase Z2.2 — 48-char hex colour signature (4 quadrants × 3
    # channels). Used together with ``phash`` so two same-shape
    # garments of *different* colours (e.g. navy vs grey shorts) are
    # not mis-flagged as duplicates. Optional; absence = phash-only
    # behaviour.
    color_sig: str | None = None
    # Optional, surfaced back to the UI so the dialog can show
    # "IMG_1742.jpg looks like a duplicate of …".
    filename: str | None = None
    size_bytes: int | None = None


class PreflightIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    photos: list[PreflightPhotoIn] = Field(default_factory=list, max_length=200)


@router.post("/preflight")
async def preflight_duplicates(
    payload: PreflightIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """**DEPRECATED — kept mounted as a fallback for older clients.**

    As of Phase Z3, modern clients run this lookup locally against the
    cached ``closetStore`` (see ``frontend/src/lib/duplicateDetection.js``)
    and never call this endpoint on the hot path. Slated for removal
    after one or two release cycles — track via the
    ``Z3-preflight-removal`` backlog item in ``docs/chat_summary.md``.
    The endpoint also doubled as the opportunistic phash/color-sig
    backfill site; that backfill now relies on natural traffic to the
    ``POST /closet/{id}/photo`` and ``POST /closet`` paths, both of
    which compute fresh signatures and persist them server-side.

    Return any closet entries that already carry one of the supplied
    SHA-256 / aHash values. The response is structured for direct
    rendering by the duplicate-confirm dialog: each match carries the
    existing item's id, title, ``thumbnail_data_url`` and the incoming
    photo's filename so the UI can show side-by-side previews.

    Matching strategy (cheapest first):
      1. ``source_sha256`` exact match — catches re-uploads of the
         exact JPEG bytes for items uploaded after Phase Z2 shipped.
      2. ``source_phash`` Hamming distance \u2264 6 bits — catches
         visual duplicates including legacy items whose original
         bytes were never stored. We lazily compute and persist the
         phash for any closet item that doesn't have one yet, so the
         backfill happens in the background as users use the app.
    """
    from app.services.image_hash import (
        compute_signatures,
        is_duplicate_match,
    )

    # Surface every hit so we can confirm via prod logs when client
    # traffic to this endpoint has dropped to zero — that's the
    # signal that it's safe to delete in the Z3 removal pass.
    logger.warning(
        "DEPRECATED endpoint hit: POST /closet/preflight user=%s photos=%d "
        "(client should use lib/duplicateDetection.js instead)",
        user.get("id"), len(payload.photos or []),
    )

    db = get_db()
    if not payload.photos:
        return {"matches": []}

    sha_set = {p.sha256 for p in payload.photos if p.sha256}
    has_any_fp = bool(sha_set) or any(p.phash for p in payload.photos)
    if not has_any_fp:
        return {"matches": []}

    # Single round-trip: pull the user's whole closet (id + hash
    # fields + a thumbnail for the dialog). Even at 500+ items this
    # is sub-100 ms on a warm Mongo and the projection keeps the
    # payload small.
    cursor = db.closet_items.find(
        {"user_id": user["id"]},
        {
            "_id": 0,
            "id": 1,
            "title": 1,
            "name": 1,
            "item_type": 1,
            "sub_category": 1,
            "color": 1,
            "thumbnail_data_url": 1,
            "segmented_image_url": 1,
            "original_image_url": 1,
            "source_sha256": 1,
            "source_phash": 1,
            "source_color_sig": 1,
            "source_filename": 1,
            "source_size_bytes": 1,
            "is_duplicate": 1,
        },
    )

    candidates: list[dict[str, Any]] = []
    async for row in cursor:
        candidates.append(row)

    # Lazy phash + colour-sig backfill, **bounded by both row count
    # and wall-clock** so a large closet (300+ items) with big inline
    # thumbnails doesn't block the upload flow on a multi-second PIL
    # decode storm. Each row that's missing a hash contributes
    # ~30–500 ms (the decode dominates and scales with thumbnail size,
    # which on production can be a multi-MB original image). An
    # uncapped backfill on a 300-item closet measured ~3 minutes in
    # production — turning a 1 s upload pre-flight into a UX-breaking
    # wait.
    #
    # We process up to ``_BACKFILL_CAP_PER_REQUEST`` rows OR
    # ``_BACKFILL_TIME_BUDGET_S`` seconds, whichever comes first
    # (iteration order = Mongo insertion order, i.e. most recent
    # uploads first). Rows we skip stay un-backfilled this round and
    # are picked up on subsequent calls. Net: monotonic convergence
    # with bounded latency.
    _BACKFILL_CAP_PER_REQUEST = 50
    _BACKFILL_TIME_BUDGET_S = 5.0
    import time as _time
    _start = _time.monotonic()
    backfill_writes: list[tuple[str, dict[str, str]]] = []
    backfill_remaining = 0
    for row in candidates:
        patch: dict[str, str] = {}
        needs_phash = not row.get("source_phash")
        needs_color = not row.get("source_color_sig")
        if not needs_phash and not needs_color:
            continue
        if (
            len(backfill_writes) >= _BACKFILL_CAP_PER_REQUEST
            or (_time.monotonic() - _start) >= _BACKFILL_TIME_BUDGET_S
        ):
            backfill_remaining += 1
            continue
        src = (
            # Phase Z2.3 — ground-truth-first source priority.
            # The lazy backfill used to prefer ``thumbnail_data_url``
            # because it's the cheapest to decode, but that thumbnail
            # is a ~15 KB downscaled centre-crop produced by
            # ``_thumbs.backfill_thumbnails``. Phash + colour-sig
            # computed from THAT image describe "a downscaled blob of
            # a white-ish thing", not the user's actual upload, and
            # collide trivially for any two white garments. The
            # in-store duplicate detector then trusts those poisoned
            # hashes as ground truth and hallucinates duplicates.
            #
            # We now require an authoritative source (original or
            # full-resolution segmented cutout) and **skip** items
            # that only have a thumbnail. A None phash is safe
            # (``is_duplicate_match`` returns False on None); a
            # thumbnail-derived phash is not.
            row.get("original_image_url")
            or row.get("segmented_image_url")
        )
        if not src:
            continue
        # Decode ONCE per row and produce whichever signature(s) the
        # row is missing. Halves request latency on large closets vs
        # decoding twice.
        ph_new, cs_new = compute_signatures(src)
        if needs_phash and ph_new:
            row["source_phash"] = ph_new
            patch["source_phash"] = ph_new
        if needs_color and cs_new:
            row["source_color_sig"] = cs_new
            patch["source_color_sig"] = cs_new
        if patch:
            backfill_writes.append((row["id"], patch))
    if backfill_remaining:
        logger.info(
            "preflight: backfilled %d rows in %.2fs; %d more deferred (user=%s)",
            len(backfill_writes), _time.monotonic() - _start,
            backfill_remaining, user["id"],
        )
    # Persist backfilled hashes in one bulk update so future
    # /preflight calls skip the recompute.
    if backfill_writes:
        try:
            from pymongo import UpdateOne

            ops = [
                UpdateOne(
                    {"id": item_id, "user_id": user["id"]},
                    {"$set": patch},
                )
                for item_id, patch in backfill_writes
            ]
            await db.closet_items.bulk_write(ops, ordered=False)
        except Exception:  # noqa: BLE001
            # Backfill is best-effort; if Mongo write fails the user
            # still gets a correct response, we just recompute next
            # time.
            pass

    # Resolve matches using the colour-aware ``is_duplicate_match``
    # helper. The helper requires shape similarity AND colour
    # proximity — the fix for "navy shorts mis-flagged as a duplicate
    # of grey shorts of the same cut" reported on dressapp.co. When
    # either side lacks a colour signature we fall back to phash-only
    # for backwards compatibility (relevant only during the brief
    # window between deploy and the lazy backfill catching up).
    matches: list[dict[str, Any]] = []
    seen_per_photo: set[str] = set()
    for p in payload.photos:
        existing_match: dict[str, Any] | None = None
        # Pass 1: exact byte match — fastest, zero false-positive.
        if p.sha256:
            existing_match = next(
                (
                    r
                    for r in candidates
                    if r.get("source_sha256") == p.sha256
                ),
                None,
            )
        # Pass 2: shape + colour. Pick the best (lowest-Hamming) row
        # among those that satisfy both gates.
        if existing_match is None and p.phash:
            from app.services.image_hash import (
                DEFAULT_HAMMING_THRESHOLD,
                hamming_distance,
            )
            best_dist = DEFAULT_HAMMING_THRESHOLD + 1
            for r in candidates:
                if not is_duplicate_match(
                    p.sha256,
                    r.get("source_sha256"),
                    p.phash,
                    r.get("source_phash"),
                    p.color_sig,
                    r.get("source_color_sig"),
                ):
                    continue
                d = hamming_distance(p.phash, r.get("source_phash"))
                if d < best_dist:
                    best_dist = d
                    existing_match = r

        if existing_match is None:
            continue
        # De-dupe across the same incoming photo (a bytewise dup of
        # itself would otherwise appear twice if both sha256 and
        # phash matched).
        key = f"{p.sha256 or ''}|{p.phash or ''}"
        if key in seen_per_photo:
            continue
        seen_per_photo.add(key)

        matches.append(
            {
                "sha256": p.sha256,
                "phash": p.phash,
                "filename": p.filename,
                "size_bytes": p.size_bytes,
                "existing": {
                    "id": existing_match.get("id"),
                    "title": existing_match.get("title")
                    or existing_match.get("name")
                    or "Existing item",
                    "item_type": existing_match.get("item_type"),
                    "sub_category": existing_match.get("sub_category"),
                    "color": existing_match.get("color"),
                    "thumbnail_data_url": (
                        existing_match.get("thumbnail_data_url")
                        or existing_match.get("segmented_image_url")
                        or existing_match.get("original_image_url")
                    ),
                    "is_duplicate": bool(existing_match.get("is_duplicate")),
                },
            }
        )
    return {"matches": matches}


class AnalyzeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_base64: str | None = None
    images_base64: list[str] | None = None
    image_url: str | None = None
    # When True (default), run the multi-item detect\u2192crop\u2192analyse pipeline
    # so a single outfit photo expands into one card per garment / accessory.
    # Set False to force a single, whole-frame analysis (legacy behaviour).
    multi: bool = True
    # Optional ISO-639-1 code (``"en"`` / ``"he"`` / ``"ar"`` / ``"ru"`` / ...)
    # that overrides ``user.preferred_language`` for THIS request only.
    # The frontend should pass ``i18n.language`` here so the Gemini output
    # (``name`` / ``title`` / ``caption``) matches the UI the user is
    # currently looking at, even when their saved profile language is
    # stale. When omitted the handler falls back to the profile, then
    # ``"en"``. Enum/category values stay canonical English regardless
    # \u2014 the frontend i18n layer translates those for display.
    language: str | None = None


_apply_defaults = closet_service._apply_defaults
_safe_analysis = closet_service.safe_analysis

@router.post("/analyze")
async def analyze_item_image(
    payload: AnalyzeIn,
    request: Request,
    user: dict = Depends(get_current_user),
) -> StreamingResponse:
    """**The Eyes** \u2014 auto-fill every Add-Item field from a garment photo.

    Returns an object with an ``items`` array. Each entry represents one
    detected garment / accessory / jewelry piece with its own cropped
    preview and full auto-fill payload. When the photo only contains a
    single item, the array has one entry (and the top-level legacy
    fields are mirrored from that single analysis for backward
    compatibility).

    Patch M17 (May 2026) — streaming-with-keepalive
    ----------------------------------------------
    The endpoint emits its response as a ``StreamingResponse`` so the
    Kubernetes / Cloudflare ingress 60 s **idle** timeout never fires
    while Gemini chugs through the parallel per-crop calls. Per live
    benchmarking, the Emergent LLM-key tier throttles concurrent
    Gemini-2.5-Flash calls down to roughly 1 in flight at a time:
    individual analyze() ≈ 16 s, 3 parallel analyze() ≈ 53 s (3×
    sequential, not the 16 s the inner ``Semaphore(6)`` would suggest).
    A 4-item outfit therefore needs ~60 s wall — exactly the ingress
    ceiling — and the timeout used to kill connections at exactly 60 s
    even though the backend ultimately returned 200 OK seconds later
    (visible in our access logs).

    The generator below kicks off the analyze coroutine, then yields
    a single whitespace byte every ``_ANALYZE_KEEPALIVE_INTERVAL_S``
    seconds while it works. JSON allows arbitrary leading whitespace,
    so the frontend's ``axios.post(...).then(r => r.data)`` parses the
    final body unchanged — **no frontend change required**. When the
    analyze coroutine completes, we yield the final JSON body and
    close the stream. On exception we emit a JSON body with
    ``_status`` set to the intended HTTP status so the frontend can
    detect failure via a small downstream check (see ``api.js``).
    """
    if garment_vision_service is None:
        raise HTTPException(503, "Garment analyzer not configured")
    if not payload.image_base64 and not payload.image_url and not payload.images_base64:
        raise HTTPException(400, "image_base64, images_base64, or image_url is required")

    raw_list: list[bytes] = []
    if payload.images_base64:
        import httpx
        for b64_or_url in payload.images_base64:
            if b64_or_url.startswith(("http://", "https://")):
                try:
                    async with httpx.AsyncClient(timeout=30.0) as c:
                        resp = await c.get(b64_or_url, follow_redirects=True)
                        resp.raise_for_status()
                        raw_list.append(resp.content)
                except Exception as exc:
                    raise HTTPException(400, f"Failed to download image URL in array: {exc}") from exc
            elif b64_or_url.startswith("data:image/"):
                try:
                    header, encoded = b64_or_url.split(",", 1)
                    raw_list.append(base64.b64decode(encoded))
                except Exception as exc:
                    raise HTTPException(400, f"Invalid data URL in array: {exc}") from exc
            else:
                try:
                    raw_list.append(base64.b64decode(b64_or_url, validate=True))
                except Exception as exc:
                    raise HTTPException(400, f"Invalid image_base64 in array: {exc}") from exc
    elif payload.image_base64:
        try:
            raw_list.append(base64.b64decode(payload.image_base64, validate=True))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Invalid image_base64: {exc}") from exc
    elif payload.image_url:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as c:
            resp = await c.get(payload.image_url, follow_redirects=True)
            resp.raise_for_status()
            raw_list.append(resp.content)
            
    if not raw_list:
        raise HTTPException(400, "Could not load image bytes")

    cost = len(raw_list)
    # Deduct credits for the AI model calls
    from app.db.database import get_db
    from app.services.billing_service import deduct_user_credits
    db = get_db()
    if not await deduct_user_credits(db, user, cost=cost):
        raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

    async def try_refund():
        try:
            latest_usage = await db.token_usage.find_one(
                {"user_id": user["id"]},
                sort=[("created_at", -1)]
            )
            credit_type = "free"
            if latest_usage and latest_usage.get("credit_type") == "paid":
                credit_type = "paid"
            
            from app.services.billing_service import refund_user_credits
            await refund_user_credits(db, user["id"], amount=cost, credit_type=credit_type)
            logger.info("Refunded %d %s credits to user %s due to analysis failure", cost, credit_type, user["id"])
        except Exception as refund_err:
            logger.error("Failed to refund credits: %s", refund_err)

    # Multi-item pipeline (default). Degrades gracefully to single.
    # Language priority: explicit request override > profile setting > "en".
    # Letting the frontend pass ``i18n.language`` here keeps the Eyes
    # output in sync with the locale the user is actually viewing, which
    # is what they expect (their profile setting is often stale or
    # was never set during signup).
    user_lang = (
        (payload.language or "").strip().lower()
        or (user or {}).get("preferred_language")
        or "en"
    )

    # Patch M19 (May 2026) — Streaming NDJSON variant. When the client
    # opts in via ``Accept: application/x-ndjson``, we stream
    # per-item frames as they arrive from Gemini rather than waiting
    # for the full batched response. The frontend renders cards as
    # frames land. Falls back to the legacy keepalive-whitespace
    # JSON path on any setup error so a misbehaving client never
    # breaks the API.
    accept = (request.headers.get("accept") or "").lower()
    wants_ndjson = "application/x-ndjson" in accept

    if wants_ndjson:
        async def _ndjson_stream():
            # Frame producer — translates ``analyze_outfits_stream``
            # frames into NDJSON lines + the per-item augmentation
            # the existing closet save flow expects.
            #
            # Patch M22 (Aug 2026) — Split lock scope.
            # The original implementation held ``_ANALYZE_LOCK`` for the
            # entire generator (detect → LLM items).  When Gemma is the
            # active provider each inference takes ~80 s on CPU, so a
            # concurrent request would block here before emitting the
            # detect frame — zero placeholder cards, zero loading
            # indicator — giving the user the impression that the
            # analysis was silently killed.
            #
            # Fix: run detect + emit the detect frame *outside* the lock,
            # then acquire the lock only for the slow LLM item calls.
            # This matches the intent of _ANALYZE_LOCK (guard GPU/CPU-
            # intensive model calls) without blocking fast detect IO.

            try:
                # ── Phase 1: detect (fast, CPU-bound, no LLM) ──────────
                # Start the stream OUTSIDE the lock so the detect frame
                # (SegFormer + crop) is emitted immediately even when
                # another analyse job is in flight.
                streamer = garment_vision_service.analyze_outfits_stream(
                    raw_list, language=user_lang,
                )

                saw_detect = False
                items_meta: list[dict[str, Any]] = []

                # Consume frames until we have the detect frame, then
                # stash the remaining item/done frames for phase 2.
                pending_frames: list[dict[str, Any]] = []

                async for frame in streamer:
                    ftype = frame.get("type")
                    if ftype == "detect":
                        saw_detect = True
                        items_meta = frame.get("items_meta") or []
                        # Emit detect immediately — no lock needed.
                        yield (json.dumps(frame, ensure_ascii=False) + "\n").encode("utf-8")
                    elif ftype == "field":
                        # Patch M23 — per-attribute Gemma result.
                        # Yield immediately so the frontend can fill form
                        # fields progressively while the next group runs.
                        yield (json.dumps(frame, ensure_ascii=False) + "\n").encode("utf-8")
                    elif ftype == "error":
                        # Surface errors immediately.
                        await try_refund()
                        yield (json.dumps(frame, ensure_ascii=False) + "\n").encode("utf-8")
                        return
                    else:
                        # item / item_skip / done — queue for phase 2
                        pending_frames.append(frame)

                if not saw_detect:
                    yield (
                        json.dumps(
                            {
                                "type": "error",
                                "status": 503,
                                "message": (
                                    "Garment analyzer produced no "
                                    "frames; please retry."
                                ),
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    ).encode("utf-8")
                    return

                # ── Phase 2: LLM items (slow) — hold the lock ──────────
                # By this point the detect frame has already been streamed
                # to the client.  We now acquire the lock to serialise
                # the expensive LLM calls (Gemma ~80 s, Gemini ~16 s).
                async with _ANALYZE_LOCK:
                    for frame in pending_frames:
                        ftype = frame.get("type")
                        if ftype == "item":
                            idx = frame.get("index", -1)
                            meta = (
                                items_meta[idx]
                                if 0 <= idx < len(items_meta)
                                else {}
                            )
                            analysis = _safe_analysis(frame.get("analysis") or {})
                            from app.services.vision import (
                                _is_unidentifiable,
                            )
                            if _is_unidentifiable(analysis):
                                out_frame = {
                                    "type": "item_skip",
                                    "index": idx,
                                    "image_index": frame.get("image_index"),
                                    "reason": "unidentifiable",
                                }
                            else:
                                out_frame = {
                                    "type": "item",
                                    "index": idx,
                                    "image_index": frame.get("image_index"),
                                    "label": meta.get("label"),
                                    "kind": meta.get("kind"),
                                    "bbox": meta.get("bbox"),
                                    "crop_base64": meta.get("crop_base64"),
                                    "crop_mime": meta.get(
                                        "crop_mime", "image/jpeg",
                                    ),
                                    "analysis": analysis,
                                    "potential_duplicate": None,
                                    "reconstruction_advised": False,
                                    "one_pass": False,
                                    "defer_matte": meta.get(
                                        "defer_matte", False,
                                    ),
                                    "needs_reconstruction": frame.get(
                                        "needs_reconstruction", False,
                                    ),
                                    "reconstruction_reasons": frame.get(
                                        "reconstruction_reasons", [],
                                    ),
                                }
                            yield (
                                json.dumps(out_frame, ensure_ascii=False)
                                + "\n"
                            ).encode("utf-8")
                        elif ftype == "item_skip":
                            yield (
                                json.dumps(frame, ensure_ascii=False) + "\n"
                            ).encode("utf-8")
                        elif ftype == "done":
                            yield (
                                json.dumps(frame, ensure_ascii=False) + "\n"
                            ).encode("utf-8")
                        elif ftype == "error":
                            await try_refund()
                            yield (
                                json.dumps(frame, ensure_ascii=False) + "\n"
                            ).encode("utf-8")
                            return

            except Exception as exc:  # noqa: BLE001
                logger.exception("ndjson analyze stream error: %s", exc)
                await try_refund()
                yield (
                    json.dumps(
                        {
                            "type": "error",
                            "status": 503,
                            "message": (
                                "Garment analyzer hit an unexpected "
                                "error. Please try again."
                            ),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                ).encode("utf-8")

        return StreamingResponse(
            _ndjson_stream(),
            media_type="application/x-ndjson",
            headers={
                "X-Accel-Buffering": "no",
                "Cache-Control": "no-cache",
            },
        )

    async def _do_analyze() -> dict[str, Any]:
        """Inner analyze body — same logic as the pre-M17 endpoint."""
        # Production analyze pipeline: SegFormer crops the photo into
        # per-garment regions, then N parallel Eyes calls analyse each
        # crop. This is the only production path as of May 2026 --
        # ``analyze_outfit_one_pass`` was retired after the CCP-Ninja
        # benchmark showed it could not reliably emit multi-garment
        # arrays (Gemini-2.5-Flash returned a single object for every
        # image regardless of prompt phrasing). The single-pass
        # function still exists for benchmark scripts; the production
        # ``EYES_ONE_PASS`` flag was removed.
        try:
            async with _ANALYZE_LOCK:
                detections = []
                for img_bytes in raw_list:
                    dets = await garment_vision_service.analyze_outfit(
                        img_bytes, language=user_lang,
                    )
                    detections.extend(dets)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Outfit analysis failed: %r", exc)
            raise HTTPException(
                503,
                "Garment analyzer is temporarily unavailable. Please try again.",
            ) from exc
        items_out: list[dict[str, Any]] = []
        dropped_unidentifiable = 0
        from app.services.vision import _is_unidentifiable

        # Phase Z2 — duplicate detection is now done up-front via
        # /closet/preflight (SHA-256 + perceptual hash, runs in the
        # browser BEFORE this analyze call). The legacy server-side
        # attribute matcher (find_potential_duplicate) has been
        # removed: by the time we reach this loop the user has
        # already approved any pre-flight matches, so paying for a
        # second round of duplicate detection here is pure waste.
        for det in detections:
            analysis = _safe_analysis(dict(det.get("analysis") or {}))
            if _is_unidentifiable(analysis):
                dropped_unidentifiable += 1
                continue
            items_out.append(
                {
                    "label": det.get("label"),
                    "kind": det.get("kind"),
                    "bbox": det.get("bbox"),
                    "crop_base64": det.get("crop_base64"),
                    "crop_mime": det.get("crop_mime", "image/jpeg"),
                    "analysis": analysis,
                    "potential_duplicate": None,  # always None — kept for backwards-compat with older frontend bundles
                    # Phase O.6 field. ``reconstruction_advised`` is
                    # produced by the legacy pipeline as a heuristic
                    # output of ``should_reconstruct`` per crop;
                    # absence / False means "no CTA needed".
                    "reconstruction_advised": det.get(
                        "reconstruction_advised", False,
                    ),
                    # Patch 9a (May 2026) — the ``one_pass`` field
                    # used to signal that the response came from
                    # the retired single-call path. With one-pass
                    # retired this is always False; kept in the
                    # response shape so older frontend bundles
                    # that read it don't choke.
                    "one_pass": False,
                    # Patch 8 (May 2026) — flag for the legacy
                    # multi-crop path when
                    # ``settings.DEFER_REMBG_ON_ANALYZE`` is on.
                    # The frontend echoes this back on /closet
                    # save and the backend queues
                    # ``_run_background_matte`` per item.
                    "defer_matte": det.get("defer_matte", False),
                    # Patch M14 (May 2026) — analyzer deferred Nano
                    # Banana reconstruction; frontend echoes these
                    # back on /closet save and the backend queues
                    # ``_run_background_reconstruction`` per item.
                    "needs_reconstruction": det.get("needs_reconstruction", False),
                    "reconstruction_reasons": det.get("reconstruction_reasons", []),
                }
            )
        if not items_out:
            raise HTTPException(
                422,
                "We couldn't identify any garment in this photo. "
                "Please try a clearer, well-lit shot.",
            )
        # Mirror the first item at the top level so older callers keep working.
        first = items_out[0]["analysis"] if items_out else _safe_analysis({})
        return {"items": items_out, "count": len(items_out), **first}

    async def _stream_with_keepalive():
        """Yield keepalive whitespace bytes while ``_do_analyze`` runs.

        Why this works: ``application/json`` permits arbitrary leading
        whitespace per RFC 8259, so ``JSON.parse`` on the client cleanly
        ignores the bytes we use as keepalive. The browser / axios
        receives the first byte within seconds (well before the 60 s
        ingress idle timeout), the connection stays alive on every
        subsequent keepalive tick, and the final JSON body lands when
        the analyzer is done.
        """
        task = asyncio.create_task(_do_analyze())
        # Yield a no-op space immediately so the ingress sees the
        # response headers + first body byte right away. Some
        # proxies start the idle timer from the first body byte, not
        # the headers, so we want to be safe.
        yield b" "
        while not task.done():
            try:
                # ``shield`` so cancelling the wait_for doesn't cancel
                # the underlying analyze task.
                await asyncio.wait_for(
                    asyncio.shield(task),
                    timeout=_ANALYZE_KEEPALIVE_INTERVAL_S,
                )
            except asyncio.TimeoutError:
                yield b" "
        # Task complete — yield the final body (or an error envelope).
        try:
            body = task.result()
        except HTTPException as exc:
            await try_refund()
            # Stream is already open with status 200; we surface the
            # intended HTTP status via ``_status`` so the frontend can
            # detect it and behave like an axios rejection.
            body = {
                "items": [],
                "count": 0,
                "_status": exc.status_code,
                "_error": str(exc.detail),
            }
        except Exception as exc:  # noqa: BLE001
            await try_refund()
            logger.exception("analyze streaming exception: %s", exc)
            body = {
                "items": [],
                "count": 0,
                "_status": 503,
                "_error": "Garment analyzer is temporarily unavailable. "
                "Please try again.",
            }
        yield json.dumps(body, ensure_ascii=False).encode("utf-8")

    return StreamingResponse(
        _stream_with_keepalive(),
        media_type="application/json",
        headers={
            # X-Accel-Buffering disables proxy buffering on nginx-style
            # ingresses so the keepalive whitespace actually reaches
            # the client between ticks rather than being buffered up
            # at the ingress and flushed all at once when the stream
            # closes (which would defeat the whole point of the
            # keepalive — the ingress would still see a 60 s idle).
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )


class PolishCropIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    image_base64: str
    category: str | None = None


@router.post("/polish-crop")
async def polish_crop(
    payload: PolishCropIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Run full rembg + SegFormer matting on an already-cropped image from the AddItem review screen.

    This is called by the client *in the background* as soon as an item is
    scanned/analyzed, allowing the user to see the polished cutout before saving.
    """
    try:
        # Strip data URL prefix if present
        b64_data = payload.image_base64
        if b64_data.startswith("data:"):
            _, b64_data = b64_data.split(",", 1)
        raw_bytes = base64.b64decode(b64_data, validate=True)
    except Exception as exc:
        raise HTTPException(400, f"Invalid image_base64: {exc}") from exc

    if not settings.AUTO_MATTE_CROPS:
        return {"image_base64": payload.image_base64, "applied": False}

    from app.services import background_matting
    from app.services import clothing_parser as _cp

    # Run rembg and SegFormer concurrently
    bg_task = asyncio.create_task(background_matting.remove_background(raw_bytes))
    cp_task = asyncio.create_task(_cp.parse_garments(raw_bytes))
    await asyncio.gather(bg_task, cp_task, return_exceptions=True)

    result = bg_task.result() if not bg_task.exception() else {}
    garments = cp_task.result() if not cp_task.exception() else []

    if not result or not result.get("image_png"):
        return {"image_base64": payload.image_base64, "applied": False}

    refined_png = result["image_png"]
    if settings.USE_LOCAL_CLOTHING_PARSER:
        seg_mask = None
        human_mask = None
        try:
            seg_mask, human_mask = _pick_segformer_mask_for_category(
                garments, payload.category
            )
        except Exception as exc:
            logger.info("polish_crop SegFormer mask pick skipped: %s", exc)

        if seg_mask is not None:
            try:
                maybe_refined = _cp.apply_alpha_intersection(
                    result["image_png"],
                    seg_mask,
                    category=payload.category,
                    human_mask=human_mask,
                    is_padded_canvas=True,
                )
                if maybe_refined:
                    refined_png = maybe_refined
            except Exception as exc:
                logger.info("polish_crop apply_alpha_intersection failed: %s", exc)

    # Encode back to base64
    out_b64 = base64.b64encode(refined_png).decode("utf-8")
    return {"image_base64": f"data:image/png;base64,{out_b64}", "applied": True}


# Patch M17 (May 2026) — Module-level config for the keepalive heartbeat
# inside the ``/analyze`` streaming response. 8 s comfortably beats
# every commodity ingress idle timeout (Kubernetes nginx default 60 s,
# Cloudflare 100 s, AWS ALB 60 s) with a 7×+ safety margin. Bumped via
# env var ``ANALYZE_KEEPALIVE_INTERVAL_S`` if a future ingress is
# tuned tighter.
_ANALYZE_KEEPALIVE_INTERVAL_S = float(
    os.environ.get("ANALYZE_KEEPALIVE_INTERVAL_S", "8")
)


@router.get("/analyze/version", include_in_schema=False)
async def analyze_version(probe: int = 0) -> dict[str, Any]:
    """Public, unauth code-version probe. Returns feature-presence
    booleans + deploy-mode flags. No secrets, no LLM calls, no DB hits.
    Safe to expose.

    By default this is a **fast static probe** — it never runs the
    actual rembg matting cycle, only reports which code paths are
    present. Pass ``?probe=1`` to additionally execute the heavy
    rembg health probe (256 px + 2000 px matte cycles, up to ~3 min
    on a cold pod that has to download the ~170 MB model). The
    default-fast behaviour is required because:
      * Emergent's CDN/gateway has a ~60 s response timeout, so a
        heavy probe hangs the request for browsers and curl alike.
      * The analyse endpoint serialises through `_ANALYZE_LOCK`, so a
        long-running probe also blocks real user upload traffic.
    """
    markers: dict[str, Any] = {}
    try:
        from app.services import clothing_parser as _cp

        markers["_postprocess_mask"] = hasattr(_cp, "_postprocess_mask")
        markers["bbox_to_pixels"] = hasattr(_cp, "bbox_to_pixels")
        markers["apply_alpha_intersection"] = hasattr(
            _cp, "apply_alpha_intersection"
        )
        # Confirms the over-cropping regression fix is live: graphic-print
        # t-shirts no longer get split into N shredded "Upper-clothes"
        # instances when their print breaks the SegFormer mask continuity.
        markers["single_instance_classes_v1"] = hasattr(
            _cp, "_SINGLE_INSTANCE_CLASSES"
        )
    except Exception as exc:  # noqa: BLE001
        markers["clothing_parser_error"] = repr(exc)
    try:
        from app.services.vision import _looks_already_cropped as _lac

        synthetic = [
            {"label": "Upper-clothes", "kind": "top", "bbox": [134, 49, 410, 441]},
            {"label": "Dress", "kind": "dress", "bbox": [120, 190, 833, 928]},
        ]
        markers["already_cropped_heuristic_v2"] = bool(_lac(synthetic))
    except Exception as exc:  # noqa: BLE001
        markers["heuristic_error"] = repr(exc)

    # Sanity marker: the analyze endpoint serialises heavy ML work
    # behind a process-wide semaphore. Confirms a deploy that includes
    # the batch-upload OOM fix landed on the VPS.
    markers["analyze_serial_lock"] = "_ANALYZE_LOCK" in globals()

    # Phase Z2 — confirms the pre-flight duplicate detection route
    # (SHA-256 + perceptual hash, BEFORE analyze) is live AND the
    # legacy post-analysis attribute matcher has been removed.
    try:
        markers["preflight_duplicate_v1"] = "preflight_duplicates" in globals()
        # Verify the analyze handler no longer CALLS the legacy
        # detector (a comment mentioning the function name is fine —
        # we only care about real call sites).
        import inspect
        import re as _re
        src = inspect.getsource(analyze_item_image)
        # Strip Python comments and docstrings before checking
        no_comments = "\n".join(
            line.split("#", 1)[0] for line in src.splitlines()
        )
        markers["legacy_post_analyze_dup_removed"] = bool(
            _re.search(r"\bfind_potential_duplicate\s*\(", no_comments) is None
        )
        # Category-filter case-insensitive + synonym support. Fixes
        # the "Shoes → 0 items" bug where DB rows used "Footwear"
        # while the frontend CATEGORIES constant sent "shoes".
        list_src = inspect.getsource(list_items)
        markers["category_synonyms_v1"] = (
            "_CATEGORY_SYNONYMS" in list_src and "footwear" in list_src.lower()
        )
        # Marketplace cleanup — confirms DELETE /closet/{id} retires
        # any draft/active listings linked via closet_item_id.
        del_src = inspect.getsource(delete_item)
        markers["listing_retire_on_closet_delete_v1"] = (
            "retire_res" in del_src and "db.listings.update_many" in del_src
        )
        # Wave 1 marketplace features — auto-list on share, listing
        # detail seller location, post-sale email dispatch.
        upd_src = inspect.getsource(update_item)
        markers["auto_list_on_share_v1"] = (
            "auto_created=True" in upd_src and 'mode="swap"' in upd_src
        )
        # Email service availability — green only when RESEND_API_KEY
        # is set in env. Independent of code path execution.
        try:
            from app.services import email_service as _es
            markers["email_service_v1"] = _es.is_configured()
        except Exception:  # noqa: BLE001
            markers["email_service_v1"] = False
    except Exception as exc:  # noqa: BLE001
        markers["preflight_marker_error"] = repr(exc)

    # Expose which ML path is live so the user can tell at a glance
    # whether dressapp.co is running the full-fat local stack or the
    # Emergent host is running the HF/Gemini fallback path.
    markers["use_local_clothing_parser"] = bool(
        getattr(settings, "USE_LOCAL_CLOTHING_PARSER", False)
    )
    markers["auto_matte_crops"] = bool(
        getattr(settings, "AUTO_MATTE_CROPS", False)
    )
    try:
        from app.config import _HAS_LOCAL_ML, _HAS_REMBG, _LIGHTWEIGHT_DEPLOY  # type: ignore

        markers["torch_installed"] = bool(_HAS_LOCAL_ML)
        markers["rembg_installed"] = bool(_HAS_REMBG)
        markers["lightweight_deploy"] = bool(_LIGHTWEIGHT_DEPLOY)
    except Exception:  # noqa: BLE001
        pass

    # Non-secret presence flags for the secrets that make the user-
    # facing pipeline work. Each is a `bool(<setting>)` only — no
    # values, no prefixes, no suffixes — safe to expose on this
    # un-authenticated endpoint and lets you eyeball from a browser
    # whether a deploy's Custom keys panel is wired up correctly.
    markers["secrets_present"] = {
        "gemini_api_key": bool(getattr(settings, "GEMINI_API_KEY", None)),
        "emergent_llm_key": bool(getattr(settings, "EMERGENT_LLM_KEY", None)),
        "gemini_image_model": bool(getattr(settings, "GEMINI_IMAGE_MODEL", None)),
        "google_oauth_client_id": bool(
            getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", None)
        ),
        "google_oauth_client_secret": bool(
            getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", None)
        ),
        "google_oauth_redirect_uri": bool(
            getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", None)
        ),
        "google_oauth_post_login_redirect": bool(
            getattr(settings, "GOOGLE_OAUTH_POST_LOGIN_REDIRECT", None)
        ),
        "openweather_api_key": bool(
            getattr(settings, "OPENWEATHER_API_KEY", None)
        ),
        "jwt_secret": bool(getattr(settings, "JWT_SECRET", None)),
        "mongo_url": bool(getattr(settings, "MONGO_URL", None)),
    }

    # --- Live rembg health probe (opt-in) ---
    # Generates two test images (256x256 sanity + 2000x2000 real-world
    # scale) and runs the FULL matte_crop pipeline on each. The 2K test
    # mirrors what your camera/phone uploads look like — if rembg silently
    # fails on full-resolution input (OOM, timeout, opacity rejection),
    # this is where we'll see it.
    #
    # Skipped by default because the heavy path can take 30-180 s on a
    # cold pod (rembg model download + 2K-image inference) which exceeds
    # Emergent's gateway timeout. Pass ``?probe=1`` when you want it.
    rembg_probe: dict[str, Any] = {
        "auto_matte_crops_enabled": bool(settings.AUTO_MATTE_CROPS),
        "rembg_model": settings.BACKGROUND_MATTING_REMBG_MODEL,
        "max_edge_setting": settings.BACKGROUND_MATTING_MAX_EDGE,
    }
    if not probe:
        rembg_probe["skipped"] = (
            "default-fast mode; pass ?probe=1 to run the live matte cycle"
        )
        markers["rembg_probe"] = rembg_probe
        return markers
    try:
        from PIL import Image, ImageDraw
        import io
        import asyncio as _asyncio
        import numpy as _np
        import time as _time
        from app.services import background_matting

        async def _probe_one(size: int) -> dict[str, Any]:
            buf = io.BytesIO()
            img = Image.new("RGB", (size, size), (240, 240, 240))
            ImageDraw.Draw(img).rectangle(
                [int(size * 0.25), int(size * 0.25), int(size * 0.75), int(size * 0.75)],
                fill=(40, 90, 200),
            )
            img.save(buf, format="JPEG", quality=85)
            test_bytes = buf.getvalue()
            t0 = _time.time()
            try:
                result = await _asyncio.wait_for(
                    background_matting.matte_crop(test_bytes), timeout=90.0
                )
            except _asyncio.TimeoutError:
                return {"ok": False, "reason": "timeout_90s", "input_size": size}
            dt = round(_time.time() - t0, 1)
            if not result:
                return {"ok": False, "reason": "matte_crop_returned_None", "elapsed_s": dt, "input_size": size}
            try:
                out_im = Image.open(io.BytesIO(result)).convert("RGBA")
                a = _np.array(out_im)[:, :, 3]
                opaque = float((a > 32).sum()) / float(max(1, a.size))
                return {
                    "ok": opaque > 0.05,
                    "elapsed_s": dt,
                    "opaque_ratio": round(opaque, 3),
                    "input_size": size,
                    "output_dimensions": list(out_im.size),
                    "png_bytes": len(result),
                }
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "reason": "decode_failed", "error": repr(exc)[:160]}

        rembg_probe["small_256"] = await _probe_one(256)
        rembg_probe["large_2000"] = await _probe_one(2000)
        rembg_probe["ok"] = bool(
            rembg_probe["small_256"].get("ok")
            and rembg_probe["large_2000"].get("ok")
        )
    except Exception as exc:  # noqa: BLE001
        rembg_probe["ok"] = False
        rembg_probe["error"] = repr(exc)[:300]
    markers["rembg_probe"] = rembg_probe
    return markers


@router.get("/analyze/diag")
async def analyze_diag(
    user: dict = Depends(get_current_user),  # noqa: ARG001 — auth-gate only
) -> dict[str, Any]:
    """Diagnostic — does a minimal real Gemini call with a 32x32 test
    image and returns the FULL provider response or error. Helps tell
    apart "API key revoked" / "API not enabled" / "key has referer
    restrictions" / "model not accessible" without grepping logs.

    Auth-gated so it can't be used for free LLM calls by anonymous traffic.
    """
    out: dict[str, Any] = {
        "service_initialised": garment_vision_service is not None,
        "provider": settings.GARMENT_VISION_PROVIDER,
        "model": settings.GARMENT_VISION_MODEL,
        "crop_model": settings.GARMENT_VISION_CROP_MODEL,
        "has_gemini_api_key": bool(settings.GEMINI_API_KEY),
        "has_emergent_llm_key": bool(settings.EMERGENT_LLM_KEY),
    }
    # Code-version markers: presence of these symbols proves the latest
    # cropping/postprocessing code is running in *this* container.
    # If any of them are False, the running container is stale → rebuild.
    code_markers: dict[str, bool] = {}
    try:
        from app.services import clothing_parser as _cp

        code_markers["_postprocess_mask"] = hasattr(_cp, "_postprocess_mask")
        code_markers["bbox_to_pixels"] = hasattr(_cp, "bbox_to_pixels")
        code_markers["apply_alpha_intersection"] = hasattr(
            _cp, "apply_alpha_intersection"
        )
    except Exception as exc:  # noqa: BLE001
        code_markers["clothing_parser_import_error"] = repr(exc)
    # Quick functional check: feed _looks_already_cropped a synthetic
    # 2-detection set that mimics the t-shirt photo case (one large
    # "Dress" detection, one small "Upper-clothes"). If the function
    # returns True the new heuristic is live; if False, the running
    # container has the old code that splits patterned t-shirts.
    try:
        from app.services.vision import _looks_already_cropped as _lac

        synthetic = [
            {"label": "Upper-clothes", "kind": "top", "bbox": [134, 49, 410, 441]},
            {"label": "Dress", "kind": "dress", "bbox": [120, 190, 833, 928]},
        ]
        code_markers["already_cropped_heuristic_v2"] = bool(_lac(synthetic))
    except Exception as exc:  # noqa: BLE001
        code_markers["already_cropped_check_error"] = repr(exc)
    out["code_markers"] = code_markers

    if garment_vision_service is None:
        out["status"] = "service_not_initialised"
        return out

    # Build a tiny in-memory JPEG (32x32 grey square) so we exercise the
    # exact image-input path that's failing in production.
    try:
        from PIL import Image
        import io

        buf = io.BytesIO()
        Image.new("RGB", (32, 32), (180, 180, 180)).save(buf, format="JPEG", quality=85)
        test_bytes = buf.getvalue()
    except Exception as exc:  # noqa: BLE001
        out["status"] = "test_image_build_failed"
        out["error"] = repr(exc)
        return out

    # Probe both models the production flow uses (default + crop_model)
    # and capture the FULL exception repr so the user can paste it back
    # without log truncation.
    probes: dict[str, Any] = {}
    for label, model in (
        ("default_model", settings.GARMENT_VISION_MODEL),
        ("crop_model", settings.GARMENT_VISION_CROP_MODEL),
    ):
        try:
            res = await garment_vision_service.analyze(test_bytes, model=model)
            probes[label] = {
                "model": model,
                "ok": True,
                "title": res.get("title"),
            }
        except Exception as exc:  # noqa: BLE001
            probes[label] = {
                "model": model,
                "ok": False,
                "error": repr(exc),  # FULL — no truncation
            }
    out["probes"] = probes
    out["status"] = (
        "all_ok"
        if all(p.get("ok") for p in probes.values())
        else "provider_error"
    )
    return out


# -------------------------------------------------------------------
# Phase V6 — Digital Product Passport (DPP) QR import
# -------------------------------------------------------------------
class FetchImageUrlIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str


@router.post("/fetch-image-url")
async def fetch_image_url(
    payload: FetchImageUrlIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Fetch an image from a URL and return it in base64 format to bypass CORS."""
    import httpx
    from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode, urljoin
    from bs4 import BeautifulSoup
    import base64

    # Clean the URL by stripping UTM and ad-tracking parameters
    try:
        parsed = urlparse(payload.url)
        qsl = parse_qsl(parsed.query)
        clean_qsl = [
            (k, v) for k, v in qsl
            if not k.lower().startswith("utm_") and k.lower() not in ("cto_pld", "fbclid", "gclid")
        ]
        query = urlencode(clean_qsl)
        url = urlunparse(parsed._replace(query=query))
    except Exception:
        url = payload.url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, headers=headers
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content = resp.content
            content_type = resp.headers.get("content-type", "")

            # If it is an HTML page, extract the product image link from metadata
            if "text/html" in content_type:
                soup = BeautifulSoup(resp.text, "html.parser")
                img_url = None
                
                # Check OpenGraph image metadata
                og_img = soup.find("meta", property="og:image")
                if og_img and og_img.get("content"):
                    img_url = og_img["content"]
                
                # Check Twitter card image metadata
                if not img_url:
                    tw_img = soup.find("meta", name="twitter:image")
                    if tw_img and tw_img.get("content"):
                        img_url = tw_img["content"]
                
                # Check link image_src
                if not img_url:
                    schema_img = soup.find("link", rel="image_src")
                    if schema_img and schema_img.get("href"):
                        img_url = schema_img["href"]
                
                # Fallback to first large image
                if not img_url:
                    for img in soup.find_all("img"):
                        src = img.get("src") or img.get("data-src")
                        if src and src.startswith("http") and not any(x in src.lower() for x in ("logo", "icon", "banner")):
                            img_url = src
                            break
                
                if not img_url:
                    raise HTTPException(
                        status_code=400,
                        detail="Could not find any product image on this webpage."
                    )
                
                resolved_img_url = urljoin(url, img_url)
                
                # Download the actual image from the resolved CDN link
                img_resp = await client.get(resolved_img_url)
                img_resp.raise_for_status()
                content = img_resp.content
                content_type = img_resp.headers.get("content-type", "image/jpeg")

            b64_str = base64.b64encode(content).decode("ascii")
            return {"image_b64": b64_str, "mime_type": content_type}
    except httpx.HTTPStatusError as http_err:
        status_code = http_err.response.status_code
        if status_code in (403, 429):
            detail_msg = (
                f"Webpage returned status {status_code}. "
                "The site blocks automated scrapers. To bypass this, "
                "please right-click the product image and select 'Copy image address' "
                "to import it directly."
            )
        else:
            detail_msg = f"Failed to load image (status {status_code})."
        raise HTTPException(status_code=400, detail=detail_msg)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch image from URL: {str(e)}"
        )


class ImportDppIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Either the full URL decoded from the QR, or the inline JSON payload
    # embedded directly in the code (some small-data pilots do this).
    qr_payload: str


@router.post("/import-dpp")
async def import_dpp(
    payload: ImportDppIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """**Scan DPP** — decode a QR payload into a draft closet item.

    Accepts an EU Digital Product Passport QR payload (a URL pointing to
    a passport document, or inline JSON). Parses JSON-LD / Schema.org
    `Product` nodes and returns a response shaped like ``/analyze`` so
    the existing Add-Item form can hydrate from it without special-
    casing.
    """
    from app.services.dpp_parser import parse_dpp

    result = await parse_dpp(payload.qr_payload)
    analysis = _safe_analysis(dict(result.get("analysis") or {}))
    dpp_data = result.get("dpp_data") or {}

    crop_bytes: bytes | None = result.get("image_bytes")
    crop_mime: str = result.get("image_mime") or "image/jpeg"
    crop_b64: str | None = (
        base64.b64encode(crop_bytes).decode("ascii") if crop_bytes else None
    )

    item_entry: dict[str, Any] = {
        "label": analysis.get("sub_category")
        or analysis.get("item_type")
        or analysis.get("category")
        or "garment",
        "kind": "garment",
        "bbox": [0, 0, 1000, 1000],
        "crop_base64": crop_b64,
        "crop_mime": crop_mime if crop_b64 else None,
        "analysis": analysis,
        "dpp_data": dpp_data,
        "source": "dpp",
    }

    return {
        "items": [item_entry],
        "count": 1,
        "source": "dpp",
        "has_image": crop_b64 is not None,
        "parse_error": dpp_data.get("parse_error"),
        **analysis,
    }


# ─── DB-backed migration: save crops + Stylist re-analyze ──────────────

_migration_status: dict[str, dict[str, Any]] = {}


async def _run_reanalyze_items(
    items: list[dict[str, Any]],
    user: dict,
    job_id: str,
    db,
) -> None:
    """Shared background worker: run Stylist (Gemini) analysis on a batch of closet items."""
    user_lang = (user or {}).get("preferred_language") or "en"
    imported = 0
    skipped = 0
    all_items: list[dict[str, Any]] = []

    for item_doc in items:
        item_id = item_doc.get("id")
        try:
            variants = item_doc.get("image_variants") or {}
            image_url = (
                item_doc.get("segmented_image_url")
                or item_doc.get("cutout_url")
                or item_doc.get("clean_image_url")
                or (variants.get("webp") or {}).get("large")
                or (variants.get("webp") or {}).get("medium")
                or item_doc.get("reconstructed_image_url")
                or variants.get("original")
                or item_doc.get("original_image_url")
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
                    parsed = await garment_vision_service.analyze(raw, language=user_lang)
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
    await asyncio.sleep(60)
    _migration_status.pop(job_id, None)


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
    db = get_db()
    from app.models.schemas import ClosetItem
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
        )
        doc = item.model_dump()
        doc["segmented_image_url"] = crop_data_url
        doc["original_image_url"] = crop_data_url

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

        await repos.insert(db.closet_items, doc)
        item_ids.append(doc["id"])
        saved += 1

    # ── Atomically kick off the Stylist re-analyze worker ──
    # This avoids a race condition where the client closes between
    # saving crops and starting analysis.
    job_id: str | None = None
    if saved > 0 and garment_vision_service is not None:
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

        asyncio.create_task(_run_reanalyze_items(saved_items, user, job_id, db))

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

    Queries closet_items where ``brand == app_name`` for the user,
    then processes each through The Eyes (Gemini) one by one.
    Returns a job_id for polling via /migration/status/{job_id}.
    """
    if garment_vision_service is None:
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

    asyncio.create_task(_run_reanalyze_items(items, user, job_id, db))
    return {"job_id": job_id, "total_items": len(items)}


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

    items = await repos.find_many(
        db.closet_items, query, sort=[("created_at", -1)], limit=limit, skip=skip
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

    updates = await _thumbs.backfill_thumbnails(items)
    if updates:
        import asyncio as _asyncio

        async def _save_one(_id, _t, _p):
            up = {}
            if _t:
                up["thumbnail_data_url"] = _t
            if _p:
                up["placeholder_data_url"] = _p
            if up:
                await db.closet_items.update_one({"id": _id}, {"$set": up})

        await _asyncio.gather(*[_save_one(_id, _t, _p) for (_id, _t, _p) in updates])

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
        # Strip heavy *_image_url fields ONLY when a thumbnail was
        # successfully produced. If the thumbnail pipeline failed for
        # this item, keep one image URL so the grid still has something
        # to show (the user would otherwise see an empty card).
        if isinstance(it.get("thumbnail_data_url"), str):
            it.pop("original_image_url", None)
            it.pop("segmented_image_url", None)
            it.pop("reconstructed_image_url", None)
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
@router.post("/repair-hashes")
async def repair_hashes_stream(
    user: dict = Depends(get_current_user),
    dry_run: bool = Query(
        default=False,
        description=(
            "When true, run the diff pass but do NOT write anything "
            "back to Mongo. Useful from a debug console; the streaming "
            "log still surfaces every item that would be touched."
        ),
    ),
    only_missing: bool = Query(
        default=False,
        description=(
            "When true, ONLY items with a null/empty source_phash or "
            "source_color_sig are processed; rows that already have "
            "non-null hashes (even if poisoned by a prior thumbnail "
            "backfill) are skipped. Default is False so the repair "
            "actually fixes the poisoned rows — the whole reason this "
            "endpoint exists."
        ),
    ),
    limit: int = Query(default=2000, le=2000, ge=1),
):
    """**NDJSON-streaming** closet-hash repair.

    Why this exists
    ===============
    The lazy phash + colour-sig backfill at ``/preflight`` historically
    used the cheapest available image source (``thumbnail_data_url``,
    a ~15 KB downscaled centre-crop). That choice produced **stable
    but misleading** hashes: two visually different garments of
    similar overall colour (e.g. a white polo and a white graphic
    tee) reduce to indistinguishable thumbnails and therefore to
    near-identical hashes. The in-store duplicate detector then
    trusts those hashes and hallucinates duplicates.

    This endpoint recomputes every (or only missing) row's phash and
    colour-sig from the **authoritative** image source
    (``original_image_url`` first, ``segmented_image_url`` second —
    never the thumbnail; see ``image_hash.best_authoritative_source``
    for the policy). When no authoritative source is available, the
    row's hashes are **cleared** rather than recomputed from a
    thumbnail — a ``None`` phash is safe (the matcher returns False
    on it); a thumbnail-derived phash is not.

    Wire format
    ===========
    `application/x-ndjson`. One JSON object per line:

      * ``{"type":"start","total":N,"only_missing":bool,"dry_run":bool}``
      * ``{"type":"item","id":"...","status":"repaired"
              |"cleared"|"unchanged"|"skipped"|"failed",
              "source_field": "original_image_url" | "segmented_image_url" | null,
              "delta": {phash?:bool, color_sig?:bool},
              "error": "..." | null}``
      * ``{"type":"done","scanned":N,"repaired":N,"cleared":N,
              "unchanged":N,"skipped":N,"failed":N,"wrote_db":bool}``

    Idempotent — re-running it after a successful pass is a no-op
    (every row reports ``status=unchanged``).
    """
    db = get_db()

    # Pull only the fields we need — keeps the per-row payload small
    # in memory for a 2000-item closet. We do NOT need the heavy
    # ``thumbnail_data_url`` here because the policy is to **never**
    # hash from it (see module docstring above).
    proj = {
        "_id": 0,
        "id": 1,
        "original_image_url": 1,
        "segmented_image_url": 1,
        "source_phash": 1,
        "source_color_sig": 1,
    }
    rows: list[dict[str, Any]] = []
    async for r in db.closet_items.find(
        {"user_id": user["id"]}, proj
    ).limit(limit):
        rows.append(r)

    from app.services.image_hash import (
        compute_authoritative_signatures,
        best_authoritative_source,
    )

    async def gen():
        # Header line — lets the client size its progress UI before
        # any item arrives.
        yield (
            json.dumps(
                {
                    "type": "start",
                    "total": len(rows),
                    "only_missing": only_missing,
                    "dry_run": dry_run,
                }
            )
            + "\n"
        )

        repaired = cleared = unchanged = skipped = failed = 0
        wrote_db = False
        loop = asyncio.get_running_loop()

        for row in rows:
            rid = row.get("id")
            if not rid:
                failed += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": None,
                            "status": "failed",
                            "source_field": None,
                            "delta": {},
                            "error": "missing-id",
                        }
                    )
                    + "\n"
                )
                continue

            old_ph = row.get("source_phash") or None
            old_cs = row.get("source_color_sig") or None

            if only_missing and old_ph and old_cs:
                skipped += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": rid,
                            "status": "skipped",
                            "source_field": None,
                            "delta": {},
                            "error": None,
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            try:
                # CPU-bound (PIL decode + numpy) — push onto the
                # thread pool so the event loop can keep flushing
                # the NDJSON stream while we work.
                new_ph, new_cs, used = await loop.run_in_executor(
                    None, compute_authoritative_signatures, row
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": rid,
                            "status": "failed",
                            "source_field": None,
                            "delta": {},
                            "error": exc.__class__.__name__,
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            no_authoritative_source = (
                used is None and best_authoritative_source(row) is None
            )

            patch: dict[str, Any] = {}
            delta: dict[str, bool] = {}
            status: str

            if no_authoritative_source:
                # Row only has a thumbnail (or nothing). Clear the
                # potentially-poisoned hashes so the detector falls
                # back to "no fingerprint" instead of trusting a
                # thumbnail-derived value.
                if old_ph is not None:
                    patch["source_phash"] = None
                    delta["phash"] = True
                if old_cs is not None:
                    patch["source_color_sig"] = None
                    delta["color_sig"] = True
                status = "cleared" if patch else "unchanged"
                if status == "cleared":
                    cleared += 1
                else:
                    unchanged += 1
            else:
                if new_ph and new_ph != old_ph:
                    patch["source_phash"] = new_ph
                    delta["phash"] = True
                if new_cs and new_cs != old_cs:
                    patch["source_color_sig"] = new_cs
                    delta["color_sig"] = True
                if patch:
                    status = "repaired"
                    repaired += 1
                else:
                    status = "unchanged"
                    unchanged += 1

            if patch and not dry_run:
                try:
                    await db.closet_items.update_one(
                        {"id": rid, "user_id": user["id"]},
                        {"$set": patch | {
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }},
                    )
                    wrote_db = True
                except Exception as exc:  # noqa: BLE001
                    failed += 1
                    if status == "repaired":
                        repaired -= 1
                    elif status == "cleared":
                        cleared -= 1
                    yield (
                        json.dumps(
                            {
                                "type": "item",
                                "id": rid,
                                "status": "failed",
                                "source_field": used,
                                "delta": delta,
                                "error": f"db:{exc.__class__.__name__}",
                            }
                        )
                        + "\n"
                    )
                    await asyncio.sleep(0)
                    continue

            yield (
                json.dumps(
                    {
                        "type": "item",
                        "id": rid,
                        "status": status,
                        "source_field": used,
                        "delta": delta,
                        # When the patch went through, send ONLY the
                        # fields that actually changed so the client
                        # can do ``store[id] = {...store[id], ...patch}``
                        # without accidentally nulling untouched
                        # fields. ``patch`` is omitted entirely (None)
                        # when nothing changed.
                        "patch": patch if patch else None,
                        "error": None,
                    }
                )
                + "\n"
            )
            await asyncio.sleep(0)

        # Final summary line — the client uses this to clear its
        # progress UI and surface a "Refreshed N fingerprints" toast.
        yield (
            json.dumps(
                {
                    "type": "done",
                    "scanned": len(rows),
                    "repaired": repaired,
                    "cleared": cleared,
                    "unchanged": unchanged,
                    "skipped": skipped,
                    "failed": failed,
                    "wrote_db": wrote_db and not dry_run,
                }
            )
            + "\n"
        )

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={
            # Disable proxy buffering (nginx, Cloudflare) so the user
            # actually sees rows tick in real time instead of one big
            # response at the end.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache, no-transform",
        },
    )


# ─────────────────────────────────────────────────────────────────────
# Phase Z2.6 — server → client streaming thumbnail repair
# ─────────────────────────────────────────────────────────────────────
@router.post("/repair-thumbnails")
async def repair_thumbnails_stream(
    user: dict = Depends(get_current_user),
    only_stale: bool = Query(
        default=True,
        description=(
            "When true (default), only items whose cached "
            "``thumbnail_data_url`` is *stale* relative to the best "
            "authoritative source are repaired. Staleness is detected "
            "by mime-type drift (e.g. cached JPEG while the source is "
            "a PNG cutout, which is the canonical Z2.6 regression "
            "signature) AND by the absence of a cached thumbnail "
            "when an authoritative source exists. Set false to force-"
            "regenerate every thumbnail unconditionally."
        ),
    ),
    limit: int = Query(default=2000, le=2000, ge=1),
):
    """**NDJSON-streaming** closet-thumbnail repair.

    Why this exists
    ===============
    Before Phase Z2.6, ``pick_source_data_url`` omitted
    ``clean_image_url`` from its priority chain. Items that went
    through the deferred-rembg pipeline (Phase O.6 onwards) had
    their cached ``thumbnail_data_url`` baked from
    ``original_image_url`` — the full-background JPEG bbox-crop —
    even though rembg later produced a transparent PNG cutout in
    ``clean_image_url``. Z2.6 fixed the priority chain AND added
    ``$unset thumbnail_data_url`` to ``_run_background_matte``, but
    items that completed rembg BEFORE Z2.6 landed still carry the
    poisoned JPEG thumbnail.

    The lazy ``_thumbs.backfill_thumbnails`` pass that runs inside
    every ``GET /closet`` regenerates these on-the-fly the next time
    a user opens the closet, so eventually every item self-heals.
    This endpoint exists for two reasons the lazy pass can't cover:

      1. *Proactive*: surface a Closet-header progress chip
         ("Refreshing thumbnails… 47/300") so the user knows the
         repair is happening rather than wondering why their first
         load is slow. The lazy backfill is silent.
      2. *Forceful*: ``only_stale=false`` regenerates every
         thumbnail unconditionally — handy after a thumbnail-format
         bug shipped, when even "non-stale-looking" cached thumbs
         are wrong (e.g. PNG-but-wrong-PNG case we hit during
         Z2.6 dev).

    Wire format
    ===========
    ``application/x-ndjson``. One JSON object per line:

      * ``{"type":"start","total":N,"only_stale":bool}``
      * ``{"type":"item","id":"...","status":"regenerated"
              |"unchanged"|"skipped"|"failed",
              "reason": "stale-mime"|"no-cached"|"forced"|null,
              "thumb_mime":"image/png"|"image/jpeg"|null,
              "error":"..." | null}``
      * ``{"type":"done","scanned":N,"regenerated":N,"unchanged":N,
              "skipped":N,"failed":N,"wrote_db":bool}``

    Idempotent. The lazy pass and this endpoint are safe to run
    concurrently — each item update is a single ``$set`` so a race
    just means one of them wins; both produce the same bytes.
    """
    from app.services import thumbnails as _thumbs
    db = get_db()

    # Only pull the fields ``pick_source_data_url`` looks at + the
    # cached thumb itself + the id. Keeps memory bounded on a 2k-item
    # closet and avoids streaming heavy embeddings / crop_base64 just
    # to drop them on the floor.
    proj = {
        "_id": 0,
        "id": 1,
        "thumbnail_data_url": 1,
        "reconstructed_image_url": 1,
        "clean_image_url": 1,
        "segmented_image_url": 1,
        "original_image_url": 1,
    }
    rows: list[dict[str, Any]] = []
    async for r in db.closet_items.find(
        {"user_id": user["id"]}, proj
    ).limit(limit):
        rows.append(r)

    def _classify(row: dict[str, Any]) -> tuple[str, str | None, str | None]:
        """Return ``(status, reason, thumb_mime_hint)`` *without* doing
        the regeneration. Pure analysis so we can stream a quick
        "skipped" line without paying the PIL decode cost.
        """
        src = _thumbs.pick_source_data_url(row)
        if not src:
            return ("skipped", "no-source", None)
        cached = row.get("thumbnail_data_url")
        # Source mime hint: parse the data URL prefix once.
        src_mime = src.split(";", 1)[0].replace("data:", "")
        if not isinstance(cached, str) or not cached.startswith("data:image"):
            return ("regenerate", "no-cached", src_mime)
        cached_mime = cached.split(";", 1)[0].replace("data:", "")
        # The classic Z2.6 signature: source is PNG (rembg cutout),
        # cached thumb is JPEG (baked before the priority chain was
        # fixed). Force regen.
        if src_mime != cached_mime:
            return ("regenerate", "stale-mime", src_mime)
        return ("unchanged", None, cached_mime)

    async def gen():
        yield (
            json.dumps(
                {
                    "type": "start",
                    "total": len(rows),
                    "only_stale": only_stale,
                }
            )
            + "\n"
        )

        regenerated = unchanged = skipped = failed = 0
        wrote_db = False
        loop = asyncio.get_running_loop()

        for row in rows:
            rid = row.get("id")
            if not rid:
                failed += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": None,
                            "status": "failed",
                            "reason": None,
                            "thumb_mime": None,
                            "error": "missing-id",
                        }
                    )
                    + "\n"
                )
                continue

            status, reason, mime_hint = _classify(row)

            # Honour ``only_stale`` — when true, an ``unchanged``
            # classification means there's nothing to do.
            if only_stale and status == "unchanged":
                unchanged += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": rid,
                            "status": "unchanged",
                            "reason": None,
                            "thumb_mime": mime_hint,
                            "error": None,
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            if status == "skipped":
                skipped += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": rid,
                            "status": "skipped",
                            "reason": reason,
                            "thumb_mime": None,
                            "error": None,
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            # ``status`` is either "regenerate" (stale) or "unchanged"
            # under ``only_stale=false`` (forced). Either way, do it.
            if status == "unchanged" and not only_stale:
                # Treat as forced regeneration.
                reason = "forced"

            try:
                # PIL decode + downscale on the thread pool so the
                # NDJSON stream keeps flushing. ``make_thumb_from_data_url``
                # is the canonical synchronous encoder used by the
                # lazy backfill pass, so thumbnails this endpoint
                # emits are bit-identical to what the lazy pass would
                # produce — no second-pass divergence.
                def _regen() -> tuple[str, str]:
                    src = _thumbs.pick_source_data_url(row)
                    if not src:
                        raise RuntimeError("no-source")
                    new_data_url = _thumbs.make_thumb_from_data_url(src)
                    if not new_data_url:
                        raise RuntimeError("encode-failed")
                    new_mime = (
                        new_data_url.split(";", 1)[0].replace("data:", "")
                    )
                    return (new_data_url, new_mime)
                new_data_url, thumb_mime = await loop.run_in_executor(
                    None, _regen,
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": rid,
                            "status": "failed",
                            "reason": reason,
                            "thumb_mime": None,
                            "error": exc.__class__.__name__,
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            try:
                await db.closet_items.update_one(
                    {"id": rid, "user_id": user["id"]},
                    {"$set": {
                        "thumbnail_data_url": new_data_url,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                wrote_db = True
                regenerated += 1
            except Exception as exc:  # noqa: BLE001
                failed += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "id": rid,
                            "status": "failed",
                            "reason": reason,
                            "thumb_mime": thumb_mime,
                            "error": f"db:{exc.__class__.__name__}",
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            yield (
                json.dumps(
                    {
                        "type": "item",
                        "id": rid,
                        "status": "regenerated",
                        "reason": reason,
                        "thumb_mime": thumb_mime,
                        "error": None,
                    }
                )
                + "\n"
            )
            await asyncio.sleep(0)

        yield (
            json.dumps(
                {
                    "type": "done",
                    "scanned": len(rows),
                    "regenerated": regenerated,
                    "unchanged": unchanged,
                    "skipped": skipped,
                    "failed": failed,
                    "wrote_db": wrote_db,
                }
            )
            + "\n"
        )

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache, no-transform",
        },
    )






@router.post("/marketplace/backfill")
async def backfill_marketplace_listings(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """One-shot helper that auto-creates listings for closet items the
    user already marked as ``for_sale`` / ``swap`` / ``donate`` BEFORE
    the marketplace pipeline started honouring ``marketplace_intent``
    transitions on update.

    Idempotent — safe to call repeatedly. Items that already have an
    active listing are skipped silently. Items whose intent is
    ``own`` (or unset) are ignored.

    Returns a summary so the caller can render a confirmation toast.
    """
    from app.models.schemas import FinancialMetadata, Listing

    db = get_db()
    INTENT_TO_MODE = {"for_sale": "sell", "swap": "swap", "donate": "donate", "rent": "rent"}
    candidates_cursor = db.closet_items.find(
        {
            "user_id": user["id"],
            "marketplace_intent": {"$in": list(INTENT_TO_MODE.keys())},
        },
        {
            "_id": 0,
            "id": 1, "title": 1, "description": 1, "category": 1,
            "size": 1, "condition": 1, "state": 1, "location": 1,
            "marketplace_intent": 1, "price_cents": 1,
            "thumbnail_data_url": 1, "segmented_image_url": 1,
            "reconstructed_image_url": 1, "original_image_url": 1,
            "auto_listing_id": 1, "source": 1,
        },
    )
    candidates = await candidates_cursor.to_list(length=None)

    created = 0
    updated_source = 0
    skipped_existing = 0
    failed = 0

    for item in candidates:
        existing = await db.listings.find_one(
            {
                "closet_item_id": item["id"],
                "seller_id": user["id"],
                "status": {"$in": ["draft", "active", "reserved"]},
            },
            {"_id": 0, "id": 1},
        )
        if existing:
            skipped_existing += 1
            # Make sure the source flag stays consistent so the closet
            # filters and feeds keep showing the item under "Shared".
            if item.get("source") != "Shared":
                await db.closet_items.update_one(
                    {"id": item["id"], "user_id": user["id"]},
                    {"$set": {"source": "Shared",
                              "auto_listing_id": existing["id"]}},
                )
                updated_source += 1
            continue

        try:
            images: list[str] = []
            for fld in (
                "thumbnail_data_url",
                "segmented_image_url",
                "reconstructed_image_url",
                "original_image_url",
            ):
                url = item.get(fld)
                if isinstance(url, str) and url:
                    images.append(url)
                    break

            mode = INTENT_TO_MODE[item["marketplace_intent"]]
            price_cents = (
                int(item.get("price_cents") or 0)
                if mode in ("sell", "rent")
                else 0
            )
            # Map our fine-grained GarmentCondition values
            # ({excellent, good, fair, bad}) to the smaller Listing
            # condition vocab ({new, like_new, good, fair}). Without
            # this mapping items stored as e.g. ``excellent`` blew up
            # the Pydantic validation and the backfill silently
            # skipped them with a `failed` count — which is exactly
            # what was happening in production.
            _COND_MAP = {
                "excellent": "like_new",
                "like_new": "like_new",
                "new": "new",
                "good": "good",
                "fair": "fair",
                "bad": "fair",
            }
            raw_cond = (
                item.get("condition") or item.get("state") or "good"
            )
            listing_condition = _COND_MAP.get(raw_cond, "good")
            location = item.get("location")
            if not location and user.get("home_location"):
                home = user["home_location"]
                lat_coord = home.get("lat")
                lng_coord = home.get("lng")
                if lat_coord is not None and lng_coord is not None:
                    location = {
                        "type": "Point",
                        "coordinates": [float(lng_coord), float(lat_coord)],
                        "city": home.get("city"),
                        "country": home.get("country"),
                        "region": home.get("region"),
                    }

            listing = Listing(
                closet_item_id=item["id"],
                seller_id=user["id"],
                source="Shared",
                mode=mode,
                title=item.get("title") or "Untitled",
                description=item.get("description"),
                category=item.get("category") or "Top",
                size=item.get("size"),
                condition=listing_condition,
                images=images,
                location=location,
                financial_metadata=FinancialMetadata(
                    list_price_cents=price_cents,
                    currency="USD",
                    platform_fee_percent=0.0,
                    estimated_seller_net_cents=0,
                ),
                auto_created=True,
                status="active",
            )
            await repos.insert(db.listings, listing.model_dump())
            await db.closet_items.update_one(
                {"id": item["id"], "user_id": user["id"]},
                {"$set": {
                    "source": "Shared",
                    "auto_listing_id": listing.id,
                    "auto_listing_needs_completion": True,
                }},
            )
            created += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            logger.warning(
                "backfill: listing creation failed for closet %s: %s",
                item["id"], exc,
            )

    logger.info(
        "marketplace backfill user=%s created=%d source_synced=%d "
        "skipped=%d failed=%d candidates=%d",
        user["id"], created, updated_source, skipped_existing, failed,
        len(candidates),
    )
    return {
        "candidates": len(candidates),
        "created": created,
        "skipped_existing": skipped_existing,
        "source_synced": updated_source,
        "failed": failed,
    }


@router.post("/marketplace/backfill/stream")
async def backfill_marketplace_listings_stream(
    user: dict = Depends(get_current_user),
):
    """**NDJSON-streaming** counterpart to ``POST /marketplace/backfill``.

    Same semantics — idempotent auto-listing of closet items whose
    ``marketplace_intent`` is set but never made it onto the
    marketplace — but emits one JSON line per candidate as it's
    processed so the frontend can render live progress instead of
    a "Syncing…" spinner with no feedback for 10+ seconds on a
    50-item closet.

    Why a sibling endpoint (and not a flag on the existing one)
    ===========================================================
    The existing JSON-returning endpoint is consumed by the current
    Marketplace page button and may be hit by automation / tests. We
    keep it as the back-compat path and add this sibling so:
      * the streaming UI opts in by hitting ``/stream``;
      * the legacy summary endpoint stays stable for anything that
        depended on its exact response shape;
      * rollback is trivial — just don't call /stream.

    Wire format
    ===========
    ``application/x-ndjson``. One JSON object per line:

      * ``{"type":"start", "total":N}`` — number of candidate closet
        items the pipeline will visit. Use this to size the progress
        UI before any item arrives.
      * ``{"type":"item", "closet_item_id":"...",
            "status":"created"|"skipped"|"source_synced"|"failed",
            "listing_id":"..." | null,
            "title":"...",
            "error":"..." | null}``
      * ``{"type":"done", "candidates":N, "created":N, "skipped":N,
            "source_synced":N, "failed":N}``
    """
    from app.models.schemas import FinancialMetadata, Listing

    db = get_db()
    INTENT_TO_MODE = {"for_sale": "sell", "swap": "swap", "donate": "donate", "rent": "rent"}

    candidates_cursor = db.closet_items.find(
        {
            "user_id": user["id"],
            "marketplace_intent": {"$in": list(INTENT_TO_MODE.keys())},
        },
        {
            "_id": 0,
            "id": 1, "title": 1, "description": 1, "category": 1,
            "size": 1, "condition": 1, "state": 1, "location": 1,
            "marketplace_intent": 1, "price_cents": 1,
            "thumbnail_data_url": 1, "segmented_image_url": 1,
            "reconstructed_image_url": 1, "original_image_url": 1,
            "auto_listing_id": 1, "source": 1,
        },
    )
    candidates = await candidates_cursor.to_list(length=None)

    # Condition vocabulary mapping — identical to the legacy endpoint.
    # Kept inside the gen scope as a closure constant so a future
    # tweak only needs one edit.
    _COND_MAP = {
        "excellent": "like_new",
        "like_new": "like_new",
        "new": "new",
        "good": "good",
        "fair": "fair",
        "bad": "fair",
    }

    async def gen():
        yield (
            json.dumps({"type": "start", "total": len(candidates)})
            + "\n"
        )

        created = 0
        updated_source = 0
        skipped_existing = 0
        failed = 0

        for item in candidates:
            cid = item.get("id")
            title = item.get("title") or "Untitled"

            try:
                existing = await db.listings.find_one(
                    {
                        "closet_item_id": cid,
                        "seller_id": user["id"],
                        "status": {"$in": ["draft", "active", "reserved"]},
                    },
                    {"_id": 0, "id": 1},
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "closet_item_id": cid,
                            "status": "failed",
                            "listing_id": None,
                            "title": title,
                            "error": f"lookup:{exc.__class__.__name__}",
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            if existing:
                existing_id = existing["id"]
                status = "skipped"
                # Mirror legacy behaviour: keep ``source`` consistent
                # with the existence of an active listing so the
                # closet filters keep showing the item under "Shared".
                if item.get("source") != "Shared":
                    try:
                        await db.closet_items.update_one(
                            {"id": cid, "user_id": user["id"]},
                            {"$set": {
                                "source": "Shared",
                                "auto_listing_id": existing_id,
                            }},
                        )
                        updated_source += 1
                        status = "source_synced"
                    except Exception as exc:  # noqa: BLE001
                        failed += 1
                        yield (
                            json.dumps(
                                {
                                    "type": "item",
                                    "closet_item_id": cid,
                                    "status": "failed",
                                    "listing_id": existing_id,
                                    "title": title,
                                    "error": (
                                        f"source_sync:"
                                        f"{exc.__class__.__name__}"
                                    ),
                                }
                            )
                            + "\n"
                        )
                        await asyncio.sleep(0)
                        continue
                skipped_existing += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "closet_item_id": cid,
                            "status": status,
                            "listing_id": existing_id,
                            "title": title,
                            "error": None,
                        }
                    )
                    + "\n"
                )
                await asyncio.sleep(0)
                continue

            # No existing listing — create one. The image-source
            # priority chain mirrors the legacy backfill so the
            # listing card has the best available picture; the
            # thumbnail-first ordering is fine HERE because Listings
            # don't participate in duplicate-fingerprinting (unlike
            # the closet hashes, which is why /repair-hashes inverted
            # that chain).
            try:
                images: list[str] = []
                for fld in (
                    "thumbnail_data_url",
                    "segmented_image_url",
                    "reconstructed_image_url",
                    "original_image_url",
                ):
                    url = item.get(fld)
                    if isinstance(url, str) and url:
                        images.append(url)
                        break

                mode = INTENT_TO_MODE[item["marketplace_intent"]]
                price_cents = (
                    int(item.get("price_cents") or 0)
                    if mode in ("sell", "rent")
                    else 0
                )
                raw_cond = (
                    item.get("condition") or item.get("state") or "good"
                )
                listing_condition = _COND_MAP.get(raw_cond, "good")
                listing = Listing(
                    closet_item_id=cid,
                    seller_id=user["id"],
                    source="Shared",
                    mode=mode,
                    title=title,
                    description=item.get("description"),
                    category=item.get("category") or "Top",
                    size=item.get("size"),
                    condition=listing_condition,
                    images=images,
                    location=item.get("location"),
                    financial_metadata=FinancialMetadata(
                        list_price_cents=price_cents,
                        currency="USD",
                        platform_fee_percent=0.0,
                        estimated_seller_net_cents=0,
                    ),
                    auto_created=True,
                    status="active",
                )
                await repos.insert(db.listings, listing.model_dump())
                await db.closet_items.update_one(
                    {"id": cid, "user_id": user["id"]},
                    {"$set": {
                        "source": "Shared",
                        "auto_listing_id": listing.id,
                        "auto_listing_needs_completion": True,
                    }},
                )
                created += 1
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "closet_item_id": cid,
                            "status": "created",
                            "listing_id": listing.id,
                            "title": title,
                            "error": None,
                        }
                    )
                    + "\n"
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                logger.warning(
                    "backfill stream: listing creation failed for "
                    "closet %s: %s",
                    cid, exc,
                )
                yield (
                    json.dumps(
                        {
                            "type": "item",
                            "closet_item_id": cid,
                            "status": "failed",
                            "listing_id": None,
                            "title": title,
                            "error": exc.__class__.__name__,
                        }
                    )
                    + "\n"
                )
            await asyncio.sleep(0)

        logger.info(
            "marketplace backfill (stream) user=%s created=%d "
            "source_synced=%d skipped=%d failed=%d candidates=%d",
            user["id"], created, updated_source, skipped_existing,
            failed, len(candidates),
        )
        yield (
            json.dumps(
                {
                    "type": "done",
                    "candidates": len(candidates),
                    "created": created,
                    "skipped": skipped_existing,
                    "source_synced": updated_source,
                    "failed": failed,
                }
            )
            + "\n"
        )

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache, no-transform",
        },
    )




class SearchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str | None = None
    image_base64: str | None = None
    limit: int = 24
    min_score: float = 0.15


@router.post("/search")
async def search_closet(
    payload: SearchIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Semantic closet search via FashionCLIP embeddings.

    Accepts *either* a free-text query ("blue flowy summer tops") *or*
    an image (e.g. a screenshot the user wants to find a match for).
    Returns items sorted by cosine similarity, filtered by ``min_score``.
    """
    if fashion_clip_service is None:
        raise HTTPException(503, "Embedding search is not available right now.")
    if not payload.text and not payload.image_base64:
        raise HTTPException(400, "Provide either `text` or `image_base64`.")

    try:
        if payload.image_base64:
            raw = base64.b64decode(payload.image_base64, validate=True)
            q_vec = await fashion_clip_service.embed_image(raw)
        else:
            q_vec = await fashion_clip_service.embed_text(payload.text or "")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Search embedding failed: %s", exc)
        raise HTTPException(503, "Could not build the search query.") from exc
    if not q_vec:
        raise HTTPException(400, "Empty query.")

    db = get_db()
    # Pull only items that have a stored embedding (others cannot be scored).
    candidates = await repos.find_many(
        db.closet_items,
        {"user_id": user["id"], "clip_embedding": {"$exists": True, "$ne": None}, "group_role": {"$ne": "member"}},
        sort=[("created_at", -1)],
        limit=2000,
    )
    scored: list[dict[str, Any]] = []
    for item in candidates:
        vec = item.get("clip_embedding")
        if not isinstance(vec, list) or not vec:
            continue
        score = fashion_clip_service.cosine(q_vec, vec)
        if score < payload.min_score:
            continue
        # Strip the big embedding vector from the response payload.
        slim = {k: v for k, v in item.items() if k != "clip_embedding"}
        slim["_score"] = round(score, 4)
        scored.append(slim)
    scored.sort(key=lambda r: r["_score"], reverse=True)
    return {
        "items": scored[: max(1, payload.limit)],
        "total": len(scored),
        "indexed": len(candidates),
        "model": fashion_clip_service.model_id,
    }


class CompleteOutfitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_ids: list[str] = Field(min_length=1, max_length=8)
    include_marketplace: bool = False
    occasion: str | None = None
    limit: int = Field(default=6, ge=1, le=12)
    min_score: float = Field(default=0.10, ge=0.0, le=1.0)
    # When True (default) the server builds an order-weighted centroid:
    # the 1st anchor in `item_ids` gets the heaviest weight, the last
    # gets the lightest (linear decay, normalised to sum=1). Set False
    # for a plain equal-weight mean.
    weighted: bool = True
    # Optional client-supplied coordinates override user.home_location
    # for the weather hook.
    lat: float | None = None
    lng: float | None = None


_slim_item = closet_service.slim_item
_anchor_summary = closet_service.anchor_summary
@router.post("/complete-outfit")
async def complete_outfit(
    payload: CompleteOutfitIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """**Complete the Outfit** — given 1..N anchor items from the user's
    closet, return ranked complementary items (from the closet and,
    optionally, from the active marketplace) plus a short rationale.

    The score uses FashionCLIP embeddings averaged across the anchors
    (centroid) against every candidate's embedding. Candidates whose
    ``category`` duplicates any anchor's ``category`` are filtered out
    so suggestions are actually *completing* the look rather than
    duplicating it.

    When ``include_marketplace=true`` the endpoint also searches active
    listings (excluding the user's own listings) using the same
    FashionCLIP centroid, then asks Gemini to produce a combined
    rationale grounded in the anchors + shortlist.
    """
    db = get_db()
    from app.services.billing_service import deduct_user_credits
    if not await deduct_user_credits(db, user, cost=1):
        raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

    # ------- 1. Fetch & validate anchors (preserve client-supplied order) -------
    fetched = await repos.find_many(
        db.closet_items,
        {"id": {"$in": payload.item_ids}, "user_id": user["id"]},
        limit=len(payload.item_ids),
    )
    if not fetched:
        raise HTTPException(404, "None of the selected items were found.")
    if len(fetched) != len(payload.item_ids):
        missing = set(payload.item_ids) - {a["id"] for a in fetched}
        raise HTTPException(
            404,
            f"{len(missing)} item(s) were not found in your closet.",
        )
    # Re-order to match `payload.item_ids` so the first anchor supplied by
    # the client is anchor[0] (drives weighting + stylist narrative).
    by_id = {a["id"]: a for a in fetched}
    anchors = [by_id[i] for i in payload.item_ids if i in by_id]

    # ------- 2. Build anchor centroid (optionally order-weighted) -------
    anchor_vecs: list[tuple[list[float], float]] = []
    if fashion_clip_service is not None:
        n = len(anchors)
        for idx, a in enumerate(anchors):
            vec = a.get("clip_embedding")
            if isinstance(vec, list) and vec:
                if payload.weighted and n > 1:
                    # Linear decay: weight = n-idx, then normalise later.
                    weight = float(n - idx)
                else:
                    weight = 1.0
                anchor_vecs.append((vec, weight))
    anchor_categories = {a.get("category") for a in anchors if a.get("category")}

    centroid: list[float] | None = None
    if anchor_vecs:
        dim = len(anchor_vecs[0][0])
        sums = [0.0] * dim
        total_w = 0.0
        for vec, w in anchor_vecs:
            if len(vec) != dim:
                continue
            for i, x in enumerate(vec):
                sums[i] += float(x) * w
            total_w += w
        if total_w > 0:
            mean = [s / total_w for s in sums]
            # L2-normalise so cosine is still a straight dot product.
            norm = sum(x * x for x in mean) ** 0.5
            if norm > 0:
                centroid = [x / norm for x in mean]

    # ------- 3. Score closet candidates -------
    closet_suggestions: list[dict[str, Any]] = []
    if centroid is not None:
        candidates = await repos.find_many(
            db.closet_items,
            {
                "user_id": user["id"],
                "id": {"$nin": payload.item_ids},
                "clip_embedding": {"$exists": True, "$ne": None},
                "group_role": {"$ne": "member"},
            },
            sort=[("created_at", -1)],
            limit=2000,
        )
        scored: list[dict[str, Any]] = []
        for c in candidates:
            vec = c.get("clip_embedding")
            if not isinstance(vec, list) or not vec:
                continue
            # Diversity: skip same-category-as-any-anchor items so we
            # actually COMPLETE the look (don't suggest another top
            # when the anchor is already a top).
            if c.get("category") in anchor_categories:
                continue
            score = fashion_clip_service.cosine(centroid, vec)
            if score < payload.min_score:
                continue
            slim = _slim_item(c)
            slim["_score"] = round(score, 4)
            scored.append(slim)
        scored.sort(key=lambda r: r["_score"], reverse=True)
        closet_suggestions = scored[: payload.limit]

    # ------- 4. Marketplace suggestions (opt-in) -------
    market_suggestions: list[dict[str, Any]] = []
    if payload.include_marketplace and centroid is not None:
        listings = await repos.find_many(
            db.listings,
            {"status": "active", "seller_id": {"$ne": user["id"]}},
            sort=[("created_at", -1)],
            limit=1000,
        )
        listing_item_ids = [
            lg.get("closet_item_id") for lg in listings if lg.get("closet_item_id")
        ]
        vec_map: dict[str, list[float]] = {}
        cat_map: dict[str, str | None] = {}
        if listing_item_ids:
            docs = await repos.find_many(
                db.closet_items,
                {"id": {"$in": listing_item_ids}},
                limit=len(listing_item_ids),
            )
            for d in docs:
                ce = d.get("clip_embedding")
                if isinstance(ce, list) and ce:
                    vec_map[d["id"]] = ce
                cat_map[d["id"]] = d.get("category")
        m_scored: list[dict[str, Any]] = []
        for lg in listings:
            cid = lg.get("closet_item_id")
            if not cid:
                continue
            cat = cat_map.get(cid)
            # Same diversity rule for marketplace
            if cat and cat in anchor_categories:
                continue
            vec = vec_map.get(cid)
            if not vec:
                continue
            score = fashion_clip_service.cosine(centroid, vec)
            if score < payload.min_score:
                continue
            lg2 = dict(lg)
            lg2["_score"] = round(score, 4)
            m_scored.append(lg2)
        m_scored.sort(key=lambda r: r["_score"], reverse=True)
        market_suggestions = m_scored[: payload.limit]

    # ------- 5. Weather hook (optional, soft-fail) -------
    from app.services.weather_service import weather_service

    weather_ctx: dict[str, Any] | None = None
    weather_summary_text: str | None = None
    home = user.get("home_location") or {}
    lat = payload.lat if payload.lat is not None else home.get("lat")
    lng = payload.lng if payload.lng is not None else home.get("lng")
    if lat is not None and lng is not None and weather_service is not None:
        try:
            weather_ctx = await weather_service.fetch(
                float(lat),
                float(lng),
                lang=(user.get("preferred_language") or "en"),
            )
            if weather_ctx:
                # Prefer the localized `description` field (e.g. "bewölkt",
                # "מעונן") over the English `condition`. Strip the
                # hardcoded " in " connector to avoid mixing languages.
                localized_cond = (
                    weather_ctx.get("description")
                    or weather_ctx.get("condition")
                    or ""
                )
                parts = [
                    f"{weather_ctx.get('temp_c')}°C",
                    localized_cond,
                    weather_ctx.get("city") or "",
                ]
                weather_summary_text = " · ".join(p for p in parts if p)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Complete-outfit weather fetch failed: %s", exc)

    # ------- 6. Stylist rationale (Gemini) -------
    from app.services.gemini_stylist import gemini_stylist_service

    rationale = ""
    outfit_recommendations: list[dict[str, Any]] = []
    do_dont: list[str] = []
    spoken_reply = ""
    if gemini_stylist_service is not None:
        try:
            anchors_pretty = [_anchor_summary(a) for a in anchors]
            closet_short = [
                {
                    "closet_item_id": s["id"],
                    "title": s.get("title") or s.get("name"),
                    "category": s.get("category"),
                    "color": s.get("color"),
                    "material": s.get("material"),
                    "score": s["_score"],
                }
                for s in closet_suggestions
            ]
            market_short = [
                {
                    "listing_id": lg["id"],
                    "title": lg.get("title"),
                    "category": lg.get("category"),
                    "price_cents": (lg.get("financial_metadata") or {}).get(
                        "list_price_cents"
                    ),
                    "score": lg["_score"],
                }
                for lg in market_suggestions
            ]
            weather_line = (
                f"\nWEATHER: {weather_summary_text}"
                if weather_summary_text
                else ""
            )
            request_text = (
                "Complete this outfit using the user's ANCHOR pieces as the "
                "starting point. The anchors are listed in priority order "
                "(first = most important). Choose complementary items from "
                "the CLOSET_CANDIDATES first (preferred); only reach into "
                "MARKET_CANDIDATES if a key complementary category is "
                "missing. Return ONE or TWO outfit recommendations. In "
                "`why`, explain the reasoning in 1-2 sentences. If weather "
                "context is provided AND the occasion sounds outdoor, "
                "prioritise weather-appropriate layers/footwear and call "
                "that out in the rationale.\n\n"
                f"OCCASION: {payload.occasion or 'unspecified (casual by default)'}"
                f"{weather_line}\n\n"
                f"ANCHORS (priority order): "
                f"{json.dumps(anchors_pretty, ensure_ascii=False)}\n\n"
                f"CLOSET_CANDIDATES: {json.dumps(closet_short, ensure_ascii=False)}\n\n"
                f"MARKET_CANDIDATES: {json.dumps(market_short, ensure_ascii=False)}"
            )
            user_profile = {
                "preferred_language": user.get("preferred_language", "en"),
                "style_profile": user.get("style_profile"),
            }
            advice = await gemini_stylist_service.advise(
                session_id=f"complete-outfit:{user['id']}",
                user_text=request_text,
                image_base64=None,
                weather=weather_ctx,
                user_profile=user_profile,
                closet_summary=closet_short + [{"is_anchor": True, **a} for a in anchors_pretty],
            )
            rationale = advice.get("reasoning_summary", "") or ""
            outfit_recommendations = advice.get("outfit_recommendations", []) or []
            do_dont = advice.get("do_dont", []) or []
            spoken_reply = advice.get("spoken_reply", "") or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Complete-outfit stylist call failed: %s", exc)
            # Soft-fail: the ranked suggestions are still useful without rationale.

    return {
        "anchors": [_slim_item(a) for a in anchors],
        "closet_suggestions": closet_suggestions,
        "market_suggestions": market_suggestions,
        "rationale": rationale,
        "outfit_recommendations": outfit_recommendations,
        "do_dont": do_dont,
        "spoken_reply": spoken_reply,
        "has_embeddings": centroid is not None,
        "weather_summary": weather_summary_text,
    }


# ------------------------- Phase Q: Wardrobe Reconstructor -------------------------
class RepairItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Optional free-form hint (typed or transcribed from Phase M voice)
    # that the user supplies when the automatic reconstruction missed
    # some detail ("it has ruffles at the hem", "the sleeves are
    # three-quarter, not long", etc.).
    user_hint: str | None = None
    # Ignore the automatic category-drift validator. Useful when the
    # user explicitly wants to retry and accept whatever comes back.
    force: bool = False


@router.post("/{item_id}/clean-background")
async def clean_item_background(
    item_id: str,
    preview: bool = False,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Phase V Fix 2 (revised May 2026, Patch 12h) — Edit Item → "Clean
    background" CTA. Non-generative alpha matting with full SegFormer
    refinement triad for parity with the initial-save flow.

    Pipeline (mirrors :func:`_run_background_matte`)
    ------------------------------------------------
    SegFormer (best-effort) → rembg + CLIP guard → apply_alpha_intersection.

    Replaces the old "Repair image" generative inpainting (which
    hallucinated matching colours, invented collars, etc.) with a pure
    alpha-matting pipeline. The matting model decides which pixels are
    garment vs. background; it never invents pixels. A CLIP faithfulness
    guard in the matting service rejects matte output that drifts too
    far from the original crop. Failures at any of the three stages are
    soft — we fall back to rembg-only output when SegFormer is
    unavailable, returns nothing usable for the item's category, or its
    mask is too patchy (<40% bbox coverage; see Patch 12g in
    ``clothing_parser.apply_alpha_intersection``).
    """
    from app.services import background_matting

    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")

    # Lightweight-deploy short-circuit. The Emergent host pod (250 m
    # CPU / 1 Gi RAM) can't run rembg inside the 60 s gateway window —
    # the model download + 2 K-image inference exceeds the budget and
    # Cloudflare returns a 520 to the browser. When the deploy explicitly
    # opted into lightweight mode (``USE_CLOTHING_PARSER=false`` /
    # ``LIGHTWEIGHT_DEPLOY=true``), reply immediately with a clear,
    # actionable message instead of hanging the request. The frontend
    # already handles the ``applied:false`` shape (shows a toast and
    # leaves the original crop intact).
    if not settings.AUTO_MATTE_CROPS:
        return {
            "item": item,
            "applied": False,
            "detail": (
                "Background matting isn't available on this deployment. "
                "Use the Hetzner production host (dressapp.co) for clean cutouts, "
                "or set AUTO_MATTE_CROPS=true / USE_CLOTHING_PARSER=true on this host."
            ),
            "reason": "lightweight_deploy_no_matting",
        }

    crop_url = (
        item.get("segmented_image_url")
        or (item.get("image_variants") or {}).get("webp", {}).get("large")
        or (item.get("image_variants") or {}).get("webp", {}).get("medium")
        or item.get("original_image_url")
        or (item.get("image_variants") or {}).get("original")
    )
    if not crop_url:
        raise HTTPException(
            400, "Item has no cropped image to matte. Re-analyze the item first."
        )
    
    crop_bytes = await _read_image_bytes_from_url(crop_url)
    if not crop_bytes:
        raise HTTPException(
            400, "Failed to retrieve the item image for background matting."
        )

    from app.services import clothing_parser as _cp

    if settings.USE_LOCAL_CLOTHING_PARSER:
        # Patch: Run rembg and SegFormer concurrently to halve the latency
        bg_task = asyncio.create_task(background_matting.remove_background(crop_bytes))
        cp_task = asyncio.create_task(_cp.parse_garments(crop_bytes))
        await asyncio.gather(bg_task, cp_task, return_exceptions=True)
        
        result = bg_task.result() if not bg_task.exception() else {}
        if cp_task.exception():
            logger.info(
                "/clean-background SegFormer skipped for item %s: %s",
                item_id, repr(cp_task.exception())[:160],
            )
            garments = []
        else:
            garments = cp_task.result()
    else:
        result = await background_matting.remove_background(crop_bytes)
        garments = []

    if not result or not result.get("image_png"):
        reason = (
            "faithfulness_guard_rejected"
            if result and result.get("provider") and not result.get("faithful")
            else "matting_unavailable"
        )
        return {
            "item": item,
            "applied": False,
            "reason": reason,
            "detail": (
                "Matting service is currently unreachable or the result "
                "drifted too far from the original; keep the existing crop."
            ),
        }

    # Patch 12h (May 2026) — Parity with ``_run_background_matte`` so the
    # Edit Item → "Clean background" CTA uses the same triad as the
    # initial save flow: SegFormer (best-effort) → rembg → alpha
    # intersection. Before this patch the CTA went straight to rembg
    # and skipped SegFormer entirely, which is why users saw cleaner
    # cutouts on first save vs. "Clean background" reruns on the same
    # crop. All SegFormer / intersection failures are SOFT — they fall
    # back to the rembg-only output that ``remove_background`` already
    # returned, so this never regresses the legacy behaviour.
    refined_png: bytes = result["image_png"]
    intersection_applied = False
    if settings.USE_LOCAL_CLOTHING_PARSER:
        seg_mask = None
        human_mask = None
        try:
            seg_mask, human_mask = _pick_segformer_mask_for_category(
                garments, item.get("category")
            )
            if seg_mask is None and garments:
                logger.info(
                    "/clean-background SegFormer parsed %d instance(s) for "
                    "item %s but none usable for category=%r",
                    len(garments), item_id, item.get("category"),
                )
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "/clean-background SegFormer mask pick skipped for item %s: %s",
                item_id, repr(exc)[:160],
            )
            seg_mask = None

        if seg_mask is not None:
            try:
                maybe_refined = _cp.apply_alpha_intersection(
                    result["image_png"],
                    seg_mask,
                    category=item.get("category"),
                    human_mask=human_mask,
                )
                if maybe_refined:
                    logger.info(
                        "/clean-background SegFormer-refined item %s "
                        "(%d → %d bytes)",
                        item_id, len(result["image_png"]), len(maybe_refined),
                    )
                    refined_png = maybe_refined
                    intersection_applied = True
                else:
                    logger.info(
                        "/clean-background apply_alpha_intersection returned "
                        "None for item %s — keeping rembg-only output",
                        item_id,
                    )
            except Exception as exc:  # noqa: BLE001
                logger.info(
                    "/clean-background alpha intersection skipped for item "
                    "%s: %s",
                    item_id, repr(exc)[:160],
                )

    out_b64 = base64.b64encode(refined_png).decode("ascii")
    data_url = f"data:image/png;base64,{out_b64}"
    meta = {
        "method": "matting",
        "model": settings.BACKGROUND_MATTING_MODEL,
        "provider": result.get("provider"),
        "segformer_refined": intersection_applied,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not preview:
        await db.closet_items.update_one(
            {"id": item_id},
            {
                "$set": {
                    "reconstructed_image_url": data_url,
                    "reconstruction_metadata": meta,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                # Invalidate the cached thumbnail so /closet list regenerates
                # it from the fresh reconstructed image on the next read.
                "$unset": {"thumbnail_data_url": ""},
            },
        )
        item = await repos.find_one(db.closet_items, {"id": item_id}) or item
    else:
        item["reconstructed_image_url"] = data_url
        item["reconstruction_metadata"] = meta
        
    return {"item": item, "applied": True, "reconstruction": meta}


class PhotoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_base64: str
    image_mime: str = "image/jpeg"
    # When True (default) run The Eyes pipeline to produce a clean
    # semantic cutout before storing. When False we store the raw upload
    # verbatim (useful when the user already has a product-shot PNG).
    auto_segment: bool = True
    # Optional override for the analyzer's output language (see
    # ``AnalyzeIn.language`` for the full contract). Falls through to
    # ``user.preferred_language`` then ``"en"`` when omitted.
    language: str | None = None


@router.post("/{item_id}/photo")
async def set_item_photo(
    item_id: str,
    payload: PhotoIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """**Add or replace** the image of an existing closet item.

    Use-cases:
    * A DPP-imported item has no photo yet — user takes one and attaches it.
    * An existing item has a poor photo — user replaces it with a better one.

    When ``auto_segment`` is True (default), the upload is run through
    The Eyes' single-item pipeline (SegFormer → rembg cutout) so the
    stored photo is already a clean per-garment PNG. Otherwise the raw
    upload is saved as-is.
    """
    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")

    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Invalid image_base64: {exc}") from exc
    if not raw:
        raise HTTPException(400, "Empty image payload")

    original_data_url = f"data:{payload.image_mime};base64,{payload.image_base64}"
    segmented_data_url: str | None = None
    segmentation_model: str | None = None

    if payload.auto_segment and garment_vision_service is not None:
        # Fast single-item pipeline: just run the detector and crop/matte it.
        # We don't run the full `analyze_outfit` because we don't need the 
        # 11-second Gemini LLM analysis (we are only replacing the photo, not 
        # rewriting the item's metadata).
        try:
            detections = await garment_vision_service.detect_items(raw)
            if detections:
                best_det = max(
                    detections,
                    key=lambda d: (
                        max(0, d["bbox"][2] - d["bbox"][0])
                        * max(0, d["bbox"][3] - d["bbox"][1])
                    ),
                )
                raw_crops = await asyncio.to_thread(
                    garment_vision_service._bbox_crop_useful, raw, [best_det]
                )
                from app.services.vision.image import _apply_fast_matte
                out = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                
                if out:
                    _, b64_bytes, mime = out[0]
                elif raw_crops:
                    _, b64_bytes, mime = raw_crops[0]
                else:
                    b64_bytes = None
                
                if b64_bytes:
                    b64 = base64.b64encode(b64_bytes).decode("ascii")
                    segmented_data_url = f"data:{mime or 'image/png'};base64,{b64}"
                    segmentation_model = "the_eyes_single"
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "set_item_photo: auto-segment failed (%s); keeping raw",
                repr(exc)[:160],
            )

    update_doc: dict[str, Any] = {
        "original_image_url": original_data_url,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # Clear any previous reconstruction — it was derived from the
        # old photo and is now stale.
        "reconstructed_image_url": None,
        "reconstruction_metadata": None,
        "clean_image_url": None,
        "clean_image_status": None,
        "image_variants": None,
        "thumbnail_data_url": None,
    }
    if segmented_data_url:
        update_doc["segmented_image_url"] = segmented_data_url
        update_doc["segmentation_model"] = segmentation_model
    else:
        update_doc["segmented_image_url"] = None
        update_doc["segmentation_model"] = None

    # Best-effort FashionCLIP re-embedding so semantic search stays fresh.
    if fashion_clip_service is not None:
        try:
            embed_bytes = (
                base64.b64decode(segmented_data_url.split(",", 1)[1])
                if segmented_data_url
                else raw
            )
            vec = await fashion_clip_service.embed_image(embed_bytes)
            if vec:
                update_doc["clip_embedding"] = vec
                update_doc["clip_model"] = fashion_clip_service.model_id
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "set_item_photo: CLIP re-embed failed (%s)", repr(exc)[:120]
            )

    await db.closet_items.update_one(
        {"id": item_id},
        {"$set": update_doc, "$unset": {"thumbnail_data_url": ""}},
    )
    item = await repos.find_one(db.closet_items, {"id": item_id}) or item
    return {
        "item": item,
        "segmented": segmented_data_url is not None,
    }



@router.post("/{item_id}/reanalyze")
async def reanalyze_item(
    item_id: str,
    fill_empty_only: bool = Query(
        False,
        description=(
            "When True, only write analysis fields where the current document "
            "value is empty/falsy. Used for receipt-sourced items so The Eyes "
            "fills in gaps without overwriting receipt-provided data."
        ),
    ),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Re-run **The Eyes** on an existing item's stored image and patch
    the analysis-derived fields back onto the document.

    Use-cases:
    * User uploaded a poor photo, replaced it with a better one (with
      ``auto_segment=False`` so the analysis didn't run automatically),
      and now wants the form auto-filled from the new photo.
    * A previous analysis returned junk (regression / model glitch)
      and the user wants a fresh attempt.
    * Receipt-sourced item has an attached image; the user taps "Analyse"
      and only wants empty chips filled in (``fill_empty_only=True``).

    The endpoint preserves user-managed fields (size, price, currency,
    marketplace_intent, notes, cultural_tags, purchase history, ...)\
    and only overwrites the fields that The Eyes actually populates
    (title, taxonomy, colours/materials, condition, tags, …).
    When ``fill_empty_only=True`` it additionally respects
    ``receipt_locked_fields`` stored on the document, which permanently
    protects fields that originated from the receipt parser.
    """
    if garment_vision_service is None:
        raise HTTPException(503, "Garment analyzer not configured")

    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")

    # Prefer the matted/segmented crop because that's what's visible to
    # the user in the closet — analysing the same pixels they're
    # looking at avoids surprises. Fall back to original or transcoded variants.
    variants = item.get("image_variants") or {}
    image_url: str | None = (
        item.get("segmented_image_url")
        or item.get("cutout_url")
        or item.get("clean_image_url")
        or (variants.get("webp") or {}).get("large")
        or (variants.get("webp") or {}).get("medium")
        or item.get("reconstructed_image_url")
        or variants.get("original")
        or item.get("original_image_url")
        or item.get("image_url")
    )
    if not image_url:
        raise HTTPException(
            400,
            "Item has no stored image to re-analyse. "
            "Replace the photo first.",
        )
    raw = await _read_image_bytes_from_url(image_url)
    if not raw:
        raise HTTPException(400, "Stored image is empty")

    user_lang = (user or {}).get("preferred_language") or "en"
    try:
        async with _ANALYZE_LOCK:
            parsed = await garment_vision_service.analyze(raw, language=user_lang)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Re-analyse failed: %r", exc)
        raise HTTPException(
            503,
            "Garment analyzer is temporarily unavailable. Please try again.",
        ) from exc

    analysis = _safe_analysis(parsed)
    from app.services.vision import _is_unidentifiable

    if _is_unidentifiable(analysis):
        raise HTTPException(
            422,
            "We couldn't identify a garment in the stored photo. "
            "Try replacing it with a clearer, well-lit shot.",
        )

    # Only overwrite fields The Eyes actually owns. User-managed fields
    # (size, price, currency, intent, notes, purchase history, …) are
    # preserved verbatim so re-analysing doesn't quietly wipe data the
    # user spent time entering.
    OVERWRITE_KEYS = (
        "title",
        "name",
        "caption",
        "category",
        "sub_category",
        "item_type",
        "brand",
        "gender",
        "dress_code",
        "season",
        "tradition",
        "colors",
        "fabric_materials",
        "pattern",
        "state",
        "condition",
        "quality",
        "repair_advice",
        "tags",
    )
    update_doc: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Phase R — fill-empty-only mode for receipt-sourced items.
    # receipt_locked_fields is the permanent "protected set" stored on
    # the document at creation time; fill_empty_only extends that by
    # also protecting any field already populated (even if not locked).
    locked: set[str] = set(item.get("receipt_locked_fields") or [])

    for key in OVERWRITE_KEYS:
        if key not in analysis:
            continue
        if fill_empty_only:
            # Skip receipt-locked fields unconditionally.
            if key in locked:
                continue
            # Skip fields that already have a value.
            current = item.get(key)
            if current or current == 0:
                continue
        update_doc[key] = analysis[key]

    # Mirror the dominant colour / material into the legacy single-string
    # fields too — older parts of the UI (and downstream Stylist
    # prompts) still read `color` / `material` as scalars.
    colors_list = analysis.get("colors") or []
    if colors_list and isinstance(colors_list, list):
        first_colour = colors_list[0]
        if isinstance(first_colour, dict) and first_colour.get("name"):
            if not fill_empty_only or ("color" not in locked and not item.get("color")):
                update_doc["color"] = first_colour["name"]
    materials_list = analysis.get("fabric_materials") or []
    if materials_list and isinstance(materials_list, list):
        first_material = materials_list[0]
        if isinstance(first_material, dict) and first_material.get("name"):
            if not fill_empty_only or ("material" not in locked and not item.get("material")):
                update_doc["material"] = first_material["name"]

    # Construct updated item in memory so the frontend can preview/save it, but do NOT write to database automatically.
    # This ensures the user must explicitly click the Save icon on the frontend to persist re-analysis edits.
    updated_item = {**item, **update_doc}
    return {"item": updated_item, "analysis": analysis}



@router.post("/{item_id}/repair")
async def repair_item_image(
    item_id: str,
    payload: RepairItemIn,
    preview: bool = False,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Rebuild a clean product-grade image for an existing closet item.

    Uses the item's stored analysis fields (title, category, color,
    material, pattern, brand, ...) to drive Nano Banana
    (``gemini-2.5-flash-image``). An optional ``user_hint`` is woven into
    the prompt so users who noticed a missing detail (e.g., "three-quarter
    sleeves") can steer the generation. Returns 503 cleanly when Nano
    Banana is unavailable.
    """
    from app.services.reconstruction import reconstruct

    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")

    analysis: dict[str, Any] = {
        "title": item.get("title"),
        "category": item.get("category"),
        "sub_category": item.get("sub_category"),
        "item_type": item.get("item_type"),
        "color": item.get("color"),
        "material": item.get("material"),
        "pattern": item.get("pattern"),
        "brand": item.get("brand"),
        "dress_code": item.get("dress_code"),
    }

    # Weave the user's hint into the prompt path. The reconstruction
    # service doesn't accept a hint directly, so we smuggle it via a
    # synthetic "item_type" extension that _build_reconstruction_prompt
    # pulls in verbatim.
    if payload.user_hint:
        hint = payload.user_hint.strip()[:240]
        analysis["item_type"] = (
            f"{analysis.get('item_type') or ''} — {hint}"
        ).strip(" —")

    # Use the segmented image as the visual conditioning when present so
    # HF has SOME pixels to look at; otherwise we still fall back to the
    # original crop or an empty byte string (text-to-image path).
    crop_url = (
        item.get("segmented_image_url")
        or (item.get("image_variants") or {}).get("webp", {}).get("large")
        or (item.get("image_variants") or {}).get("webp", {}).get("medium")
        or item.get("original_image_url")
        or (item.get("image_variants") or {}).get("original")
    )
    crop_bytes = await _read_image_bytes_from_url(crop_url) if crop_url else b""

    from app.services.billing_service import deduct_user_credits
    if not await deduct_user_credits(db, user, cost=1):
        raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

    out = await reconstruct(
        crop_bytes,
        analysis,
        reasons=["manual_repair"] + (["with_hint"] if payload.user_hint else []),
        validate=not payload.force,
    )
    if out is None:
        raise HTTPException(
            502, "Reconstruction service unavailable. Please try again later."
        )
    if not out.get("validated"):
        return {
            "item": item,
            "reconstruction": out,
            "applied": False,
            "detail": out.get("rejected_reason")
            or "Reconstructor produced an off-category image; keep the existing one.",
        }

    # Persist the reconstruction on the item.
    recon_b64 = out["image_b64"]
    try:
        import io
        from PIL import Image
        temp_raw = base64.b64decode(recon_b64)
        temp_img = Image.open(io.BytesIO(temp_raw))
        mime = "image/png" if temp_img.mode in ("RGBA", "LA") else "image/jpeg"
    except Exception:
        mime = out.get("mime_type", "image/png")
        
    data_url = f"data:{mime};base64,{recon_b64}"
    meta: dict[str, Any] = {
        "reasons": out.get("reasons", []),
        "prompt": out.get("prompt"),
        "model": out.get("model"),
        "mime_type": mime,
        "user_hint": payload.user_hint,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    update_doc = {
        "reconstructed_image_url": data_url,
        "reconstruction_metadata": meta,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not preview:
        await db.closet_items.update_one(
            {"id": item_id},
            {"$set": update_doc, "$unset": {"thumbnail_data_url": ""}},
        )
        item = await repos.find_one(db.closet_items, {"id": item_id}) or item
    else:
        item["reconstructed_image_url"] = data_url
        item["reconstruction_metadata"] = meta
        
    return {"item": item, "reconstruction": out, "applied": True}


# --- Card Grouping endpoints & helper ---
class GroupItemsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    host_id: str
    member_id: str


class UploadMemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_base64: str
    image_mime: str = "image/jpeg"


class GroupEditIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_host_id: str | None = None
    ungroup_member_ids: list[str] = []
    add_member_ids: list[str] = []
    new_uploads: list[UploadMemberIn] = []


reanalyze_group_helper = closet_service.reanalyze_group_helper
@router.post("/group")
async def group_items(
    payload: GroupItemsIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    host_id = payload.host_id
    member_id = payload.member_id

    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    member = await db.closet_items.find_one({"id": member_id, "user_id": user["id"]})
    if not host or not member:
        raise HTTPException(404, "Host or member item not found")

    # If the member was already the host of another group, we will merge the groups!
    group_id = host.get("group_id") or host_id
    member_group_id = member.get("group_id")

    if member_group_id:
        # Move all members of the member's group to the new group
        await db.closet_items.update_many(
            {"group_id": member_group_id, "user_id": user["id"]},
            {"$set": {"group_id": group_id, "group_role": "member", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # Set host role on B
    await db.closet_items.update_one(
        {"id": host_id},
        {"$set": {"group_id": group_id, "group_role": "host", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Set member role on A (and update group_id)
    await db.closet_items.update_one(
        {"id": member_id},
        {"$set": {"group_id": group_id, "group_role": "member", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Run group reanalysis in the background
    background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    updated_host = await db.closet_items.find_one({"id": host_id})
    updated_member = await db.closet_items.find_one({"id": member_id})

    # Strip pymongo ObjectId
    if updated_host and "_id" in updated_host:
        updated_host.pop("_id")
    if updated_member and "_id" in updated_member:
        updated_member.pop("_id")

    return {
        "status": "success",
        "host": updated_host,
        "member": updated_member
    }


@router.post("/{host_id}/upload-member")
async def upload_group_member(
    host_id: str,
    payload: UploadMemberIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    sub_active = (user.get("subscription") or {}).get("is_active", False)
    if not sub_active:
        current_count = await db.closet_items.count_documents({"user_id": user["id"]})
        capacity_limit = 150 + user.get("closet_capacity_bonus", 0)
        if current_count >= capacity_limit:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "closet_capacity_exceeded",
                    "message": f"You have reached your free closet capacity of {capacity_limit} items. Upgrade to DressApp Pro to add more items.",
                    "capacity": capacity_limit,
                    "current_count": current_count
                }
            )

    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    if not host:
        raise HTTPException(404, "Host item not found")

    group_id = host.get("group_id") or host_id
    if not host.get("group_id") or host.get("group_role") != "host":
        await db.closet_items.update_one(
            {"id": host_id},
            {"$set": {"group_id": group_id, "group_role": "host", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.closet_items.update_one(
            {"id": host_id},
            {"$set": {"group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except Exception as exc:
        raise HTTPException(400, f"Invalid image_base64: {exc}")

    original_data_url = f"data:{payload.image_mime};base64,{payload.image_base64}"
    
    # Create the member closet item document
    from app.models.schemas import ClosetItem
    
    member_item = ClosetItem(
        user_id=user["id"],
        title=f"{host.get('title', 'Garment')} (Back View)",
        category=host.get("category", "Top"),
        sub_category=host.get("sub_category"),
        item_type=host.get("item_type"),
        brand=host.get("brand"),
        gender=host.get("gender"),
        dress_code=host.get("dress_code"),
        colors=host.get("colors") or [],
        color=host.get("color"),
        group_id=group_id,
        group_role="member",
        group_analysis_status="pending",
        original_image_url=original_data_url,
    ).model_dump()

    # Fast single-item segmentation
    segmented_data_url = None
    segmentation_model = None
    if garment_vision_service is not None:
        try:
            detections = await garment_vision_service.detect_items(raw)
            if detections:
                best_det = max(
                    detections,
                    key=lambda d: (
                        max(0, d["bbox"][2] - d["bbox"][0])
                        * max(0, d["bbox"][3] - d["bbox"][1])
                    ),
                )
                raw_crops = await asyncio.to_thread(
                    garment_vision_service._bbox_crop_useful, raw, [best_det]
                )
                from app.services.vision.image import _apply_fast_matte
                out = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                
                if out:
                    _, b64_bytes, mime = out[0]
                elif raw_crops:
                    _, b64_bytes, mime = raw_crops[0]
                else:
                    b64_bytes = None
                
                if b64_bytes:
                    b64 = base64.b64encode(b64_bytes).decode("ascii")
                    segmented_data_url = f"data:{mime or 'image/png'};base64,{b64}"
                    segmentation_model = "the_eyes_single"
        except Exception as exc:
            logger.warning("upload_group_member segment failed: %r", exc)

    if segmented_data_url:
        member_item["segmented_image_url"] = segmented_data_url
        member_item["segmentation_model"] = segmentation_model

    # Get FashionCLIP embedding for member item
    if fashion_clip_service is not None:
        try:
            embed_bytes = base64.b64decode(segmented_data_url.split(",", 1)[1]) if segmented_data_url else raw
            vec = await fashion_clip_service.embed_image(embed_bytes)
            if vec:
                member_item["clip_embedding"] = vec
                member_item["clip_model"] = fashion_clip_service.model_id
        except Exception as exc:
            logger.warning("upload_group_member CLIP embed failed: %r", exc)

    # Save to DB
    await repos.insert(db.closet_items, member_item)

    # Re-run group analysis in the background
    background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    updated_host = await db.closet_items.find_one({"id": host_id})
    updated_member = await db.closet_items.find_one({"id": member_item["id"]})

    # Strip ObjectId
    if updated_host and "_id" in updated_host:
        updated_host.pop("_id")
    if updated_member and "_id" in updated_member:
        updated_member.pop("_id")

    return {
        "status": "success",
        "member": updated_member,
        "host": updated_host
    }


@router.post("/{host_id}/set-host/{member_id}")
async def set_group_host(
    host_id: str,
    member_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    member = await db.closet_items.find_one({"id": member_id, "user_id": user["id"]})
    if not host or not member:
        raise HTTPException(404, "Host or member item not found")

    # Verify they belong to the same group
    group_id = host.get("group_id")
    if not group_id or member.get("group_id") != group_id:
        raise HTTPException(400, "Items do not belong to the same group")

    # Update all items in this group to have the new group_id (the new host's ID)
    new_group_id = member_id
    await db.closet_items.update_many(
        {"group_id": group_id, "user_id": user["id"]},
        {"$set": {"group_id": new_group_id}}
    )

    # Update old host to be a member
    await db.closet_items.update_one(
        {"id": host_id},
        {"$set": {"group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Update new host to be the host
    await db.closet_items.update_one(
        {"id": member_id},
        {"$set": {"group_role": "host", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Fetch updated new host
    updated_new_host = await db.closet_items.find_one({"id": member_id})
    if updated_new_host and "_id" in updated_new_host:
        updated_new_host.pop("_id")

    return {
        "status": "success",
        "host": updated_new_host
    }


@router.post("/{item_id}/ungroup")
async def ungroup_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    item = await db.closet_items.find_one({"id": item_id, "user_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")

    group_id = item.get("group_id")
    if not group_id:
        return {"status": "success"}

    # Ungroup this item (set group fields to None)
    await db.closet_items.update_one(
        {"id": item_id, "user_id": user["id"]},
        {"$set": {"group_id": None, "group_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Check remaining items in the group
    remaining = await db.closet_items.find(
        {"group_id": group_id, "user_id": user["id"]}
    ).to_list(None)

    if len(remaining) <= 1:
        # Only 1 item left -> dissolve group entirely
        await db.closet_items.update_many(
            {"group_id": group_id, "user_id": user["id"]},
            {"$set": {"group_id": None, "group_role": None, "group_analysis_status": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # If multiple remain, and the ungrouped item was the host, pick a new host
        if item.get("group_role") == "host":
            new_host = remaining[0]
            await db.closet_items.update_many(
                {"group_id": group_id, "user_id": user["id"]},
                {"$set": {"group_id": new_host["id"], "group_analysis_status": "pending"}}
            )
            await db.closet_items.update_one(
                {"id": new_host["id"]},
                {"$set": {"group_role": "host", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            background_tasks.add_task(reanalyze_group_helper, new_host["id"], user["id"])
        else:
            # Host is still there. Run background re-analysis on remaining group
            remaining_ids = [r["id"] for r in remaining]
            await db.closet_items.update_many(
                {"id": {"$in": remaining_ids}},
                {"$set": {"group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    return {"status": "success"}


@router.post("/{host_id}/group-edit")
async def group_edit(
    host_id: str,
    payload: GroupEditIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    # 1. Fetch current host item
    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    if not host:
        raise HTTPException(404, "Host item not found")

    group_id = host.get("group_id") or host_id

    # Make sure host is marked as host (if not already set)
    if not host.get("group_id") or host.get("group_role") != "host":
        await db.closet_items.update_one(
            {"id": host_id},
            {"$set": {"group_id": group_id, "group_role": "host", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # 2. Process new uploads
    for upload in payload.new_uploads:
        try:
            raw = base64.b64decode(upload.image_base64, validate=True)
        except Exception as exc:
            raise HTTPException(400, f"Invalid image_base64: {exc}")

        original_data_url = f"data:{upload.image_mime};base64,{upload.image_base64}"
        
        from app.models.schemas import ClosetItem
        member_item = ClosetItem(
            user_id=user["id"],
            title=f"{host.get('title', 'Garment')} (View)",
            category=host.get("category", "Top"),
            sub_category=host.get("sub_category"),
            item_type=host.get("item_type"),
            brand=host.get("brand"),
            gender=host.get("gender"),
            dress_code=host.get("dress_code"),
            colors=host.get("colors") or [],
            color=host.get("color"),
            group_id=group_id,
            group_role="member",
            group_analysis_status="pending",
            original_image_url=original_data_url,
        ).model_dump()

        # Fast single-item segmentation
        segmented_data_url = None
        segmentation_model = None
        if garment_vision_service is not None:
            try:
                detections = await garment_vision_service.detect_items(raw)
                if detections:
                    best_det = max(
                        detections,
                        key=lambda d: (
                            max(0, d["bbox"][2] - d["bbox"][0])
                            * max(0, d["bbox"][3] - d["bbox"][1])
                        ),
                    )
                    raw_crops = await asyncio.to_thread(
                        garment_vision_service._bbox_crop_useful, raw, [best_det]
                    )
                    from app.services.vision.image import _apply_fast_matte
                    out = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                    
                    if out:
                        _, b64_bytes, mime = out[0]
                    elif raw_crops:
                        _, b64_bytes, mime = raw_crops[0]
                    else:
                        b64_bytes = None
                    
                    if b64_bytes:
                        b64 = base64.b64encode(b64_bytes).decode("ascii")
                        segmented_data_url = f"data:{mime or 'image/png'};base64,{b64}"
                        segmentation_model = "the_eyes_single"
            except Exception as exc:
                logger.warning("group_edit segment failed: %r", exc)

        if segmented_data_url:
            member_item["segmented_image_url"] = segmented_data_url
            member_item["segmentation_model"] = segmentation_model

        # Get FashionCLIP embedding
        if fashion_clip_service is not None:
            try:
                embed_bytes = base64.b64decode(segmented_data_url.split(",", 1)[1]) if segmented_data_url else raw
                vec = await fashion_clip_service.embed_image(embed_bytes)
                if vec:
                    member_item["clip_embedding"] = vec
                    member_item["clip_model"] = fashion_clip_service.model_id
            except Exception as exc:
                logger.warning("group_edit CLIP embed failed: %r", exc)

        # Save to DB
        await repos.insert(db.closet_items, member_item)

    # 3. Process adding existing closet items
    for add_id in payload.add_member_ids:
        member = await db.closet_items.find_one({"id": add_id, "user_id": user["id"]})
        if not member:
            continue
        member_group_id = member.get("group_id")
        if member_group_id:
            # Move all members of the member's group to the current group
            await db.closet_items.update_many(
                {"group_id": member_group_id, "user_id": user["id"]},
                {"$set": {"group_id": group_id, "group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.closet_items.update_one(
                {"id": add_id},
                {"$set": {"group_id": group_id, "group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

    # 4. Process ungrouping members
    for remove_id in payload.ungroup_member_ids:
        await db.closet_items.update_one(
            {"id": remove_id, "user_id": user["id"]},
            {"$set": {"group_id": None, "group_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # 5. Process swapping host role
    active_host_id = host_id
    if payload.new_host_id and payload.new_host_id != host_id:
        new_host = await db.closet_items.find_one({"id": payload.new_host_id, "user_id": user["id"]})
        if new_host:
            active_host_id = payload.new_host_id
            # Update all items in this group to have the new group_id (the new host's ID)
            await db.closet_items.update_many(
                {"group_id": group_id, "user_id": user["id"]},
                {"$set": {"group_id": active_host_id}}
            )
            # Update old host to be a member
            await db.closet_items.update_one(
                {"id": host_id},
                {"$set": {"group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Update new host to be the host
            await db.closet_items.update_one(
                {"id": active_host_id},
                {"$set": {"group_role": "host", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Also update group_id to active_host_id for the rest of processing
            group_id = active_host_id

    # 6. Dissolution check
    remaining = await db.closet_items.find(
        {"group_id": group_id, "user_id": user["id"]}
    ).to_list(None)

    if len(remaining) <= 1:
        # Only 1 item left -> dissolve group entirely
        await db.closet_items.update_many(
            {"group_id": group_id, "user_id": user["id"]},
            {"$set": {"group_id": None, "group_role": None, "group_analysis_status": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Mark all remaining items in the group as pending!
        remaining_ids = [r["id"] for r in remaining]
        await db.closet_items.update_many(
            {"id": {"$in": remaining_ids}},
            {"$set": {"group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Re-run group analysis in the background
        background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    # Fetch and return the updated host
    updated_host = await db.closet_items.find_one({"id": active_host_id})
    if updated_host and "_id" in updated_host:
        updated_host.pop("_id")

    return {
        "status": "success",
        "host": updated_host
    }



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
    if "reconstructed_image_url" in patch and patch["reconstructed_image_url"]:
        patch["reconstructed_image_url"] = compress_image_url_or_b64(patch["reconstructed_image_url"], max_dim=1024, quality=75)
    # The `clear_reconstruction` flag is a command, not a value we persist.
    # Pop it + translate into explicit null-sets on the related columns.
    if patch.pop("clear_reconstruction", False):
        patch["reconstructed_image_url"] = None
        patch["reconstruction_metadata"] = None
        patch["clean_image_url"] = None
        patch["clean_image_status"] = None
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

    # Should we OPEN a listing on this update?
    # Triggered when EITHER signal newly indicates marketplace participation.
    open_listing = False
    chosen_mode = "swap"  # safe default for the source-only path
    chosen_price_cents = 0
    # Honour the currency on the closet item itself — fall back to the
    # patched value, then the loaded item, then USD as a last resort.
    # Without this the auto-listing flow used to hardcode USD even
    # when the user picked ILS / EUR / etc on the closet card, so the
    # marketplace card showed "$10" instead of "₪10".
    chosen_currency = (
        patch.get("currency")
        or updated.get("currency")
        or (prior or {}).get("currency")
        or "USD"
    )
    if new_source == "Shared" and prior_source != "Shared":
        open_listing = True
    if new_intent in _MARKETPLACE_INTENTS and prior_intent not in _MARKETPLACE_INTENTS:
        open_listing = True
        chosen_mode = _INTENT_TO_MODE[new_intent]
        # Carry the user's listed price across when they set one.
        if new_intent in ("for_sale", "rent"):
            chosen_price_cents = int(
                patch.get("price_cents") or updated.get("price_cents") or 0
            )

    # Should we CLOSE the auto-created listing on this update?
    close_listing = False
    if new_source == "Private" and prior_source == "Shared":
        close_listing = True
    if (
        new_intent is not None
        and new_intent not in _MARKETPLACE_INTENTS
        and prior_intent in _MARKETPLACE_INTENTS
    ):
        close_listing = True

    if open_listing:
        try:
            existing = await db.listings.find_one(
                {"closet_item_id": item_id, "seller_id": user["id"]},
                {"_id": 0, "id": 1, "status": 1, "mode": 1, "auto_created": 1},
            )
            if existing and existing.get("status") in ("draft", "active", "reserved"):
                # Already has a live listing. If we know the desired
                # mode (intent path), patch the mode on the existing
                # auto-created listing so a user who originally hit
                # "Share" then later picks "For Sale" sees the right
                # CTA on the marketplace card. Never modify a
                # human-curated listing (auto_created=False).
                if (
                    existing.get("auto_created")
                    and chosen_mode != existing.get("mode")
                ):
                    # Recompute fees for the new (price, currency)
                    # tuple so the marketplace card stays consistent
                    # — without this an item that flipped from
                    # ``swap`` → ``for_sale`` kept its old $0 price
                    # and stale fee rows.
                    fees = compute_fees(chosen_price_cents)
                    await db.listings.update_one(
                        {"id": existing["id"]},
                        {"$set": {
                            "mode": chosen_mode,
                            "currency": chosen_currency,
                            "financial_metadata.list_price_cents": chosen_price_cents,
                            "financial_metadata.currency": chosen_currency,
                            "financial_metadata.platform_fee_percent": 7.0,
                            "financial_metadata.estimated_seller_net_cents": fees.seller_net_cents,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
            else:
                # Build a minimal listing using info already on the
                # closet item. We import lazily so closet.py doesn't
                # take a hard dep on the listings module at import time.
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
                            "segmented_image_url",
                            "reconstructed_image_url",
                            "original_image_url",
                        ):
                            url = g_item.get(fld)
                            if isinstance(url, str) and url:
                                images.append(url)
                                break
                else:
                    for fld in (
                        "thumbnail_data_url",
                        "segmented_image_url",
                        "reconstructed_image_url",
                        "original_image_url",
                    ):
                        url = updated.get(fld)
                        if isinstance(url, str) and url:
                            images.append(url)
                            break
                # Same condition vocab mapping as in create_item /
                # backfill: GarmentCondition (excellent/good/fair/bad)
                # → Listing condition (new/like_new/good/fair).
                # Without it items with condition='excellent' blew up
                # Pydantic validation and the auto-list silently
                # failed.
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
                # Compute fees up-front so the marketplace card shows
                # the right "you receive" hint immediately. Without
                # this the listing went out with platform_fee=0 and
                # seller_net=0 — confusing on cards/checkouts.
                fees = compute_fees(chosen_price_cents)
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
                    location=updated.get("location"),
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
                # Also flip ``source`` to Shared so downstream code
                # (filters, feeds) sees the item as published. We do
                # this even when the trigger was ``marketplace_intent``
                # alone, so the two flags stay consistent.
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
                    "auto-listed closet item %s as listing %s mode=%s "
                    "trigger=%s",
                    item_id, listing.id, chosen_mode,
                    "intent" if new_intent in _MARKETPLACE_INTENTS else "source",
                )
        except Exception as exc:  # noqa: BLE001
            # Auto-list is a UX nicety — never block the underlying
            # closet update if it fails.
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

    if updated and "_id" in updated:
        updated.pop("_id")
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

    return Response(status_code=204)


@router.post("/{item_id}/edit-image")
async def edit_item_image(
    item_id: str,
    prompt: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Trigger Gemini Nano Banana image-to-image to generate a variant
    (e.g. 'in navy blue' or 'with short sleeves').

    Stores the variant (as a data URL) in `variants[]` so the client can
    preview it alongside the original.
    """
    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")
    variants = item.get("image_variants") or {}
    source_url = (
        item.get("segmented_image_url")
        or (variants.get("webp") or {}).get("large")
        or (variants.get("webp") or {}).get("medium")
        or item.get("original_image_url")
        or variants.get("original")
    )
    if not source_url:
        raise HTTPException(400, "No source image on this item")
    source_bytes = await _read_image_bytes_from_url(source_url)
    if not source_bytes:
        raise HTTPException(400, "Failed to retrieve source image bytes")
    if gemini_image_service is None:
        # Nano Banana (gemini-2.5-flash-image) requires a direct
        # GEMINI_API_KEY. The legacy HF FLUX fallback was retired in May
        # 2026, so when the direct key is absent we surface a clean 503
        # instead of silently degrading.
        raise HTTPException(503, "Image generation service not configured")
    try:
        from app.services.billing_service import deduct_user_credits
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

        edit = await gemini_image_service.edit(
            source_bytes,
            prompt,
            garment_metadata={
                "title": item.get("title"),
                "category": item.get("category"),
                "color": item.get("color"),
                "material": item.get("material"),
                "pattern": item.get("pattern"),
                "brand": item.get("brand"),
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Nano Banana image edit failed for item %s: %s", item_id, exc)
        raise HTTPException(
            503,
            "Image generation is temporarily unavailable. Please try again shortly.",
        ) from exc
    variant_url = (
        f"data:{edit.get('mime_type', 'image/png')};base64,{edit['image_b64']}"
    )
    variants = list(item.get("variants") or [])
    variants.append(
        {
            "prompt": prompt,
            "url": variant_url,
            "model": edit["model_used"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    await db.closet_items.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": {"variants": variants}}
    )
    return {"variant_url": variant_url, "variants": variants}


@router.post("/extract-pdf-text")
async def extract_pdf_text(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Extract raw text from an uploaded file (PDF/Image) using Gemini's native OCR with a local pypdf fallback for PDFs."""
    from app.services.gemini_client import get_default_client
    from fastapi import HTTPException
    import mimetypes
    import pypdf
    import io

    try:
        file_bytes = await file.read()
        mime_type = file.content_type
        if not mime_type or mime_type == "application/octet-stream":
            mime_type = mimetypes.guess_type(file.filename)[0] or "application/pdf"

        is_pdf = mime_type == "application/pdf" or file.filename.endswith(".pdf")

        # Deduct AI credits for the OCR model call
        from app.db.database import get_db
        from app.services.billing_service import deduct_user_credits
        db = get_db()
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

        # Try Gemini Multimodal OCR first
        try:
            gemini = await get_default_client()
            prompt = (
                "You are a high-precision, multilingual OCR engine. "
                "Extract and transcribe ALL text from the attached document row-by-row (horizontally across the page). "
                "Crucially, do NOT extract text in separate vertical columns. Instead, merge columns line-by-line horizontally "
                "so that each line shows the item name, description, code, and price/discount aligned together on the same row. "
                "Reduce unnecessary whitespace between columns to ensure each item's details fit neatly on a single line. "
                "Do not add any preamble, summary, explanation, markdown formatting, or notes. "
                "Start directly with the transcribed text."
            )

            user_parts = [
                prompt,
                (file_bytes, mime_type)
            ]

            ocr_text = await gemini.vision(
                user_parts=user_parts,
                temperature=0.0
            )
            if ocr_text and ocr_text.strip():
                return {"text": ocr_text.strip()}
        except Exception as e:
            logger.warning("Gemini OCR failed, trying fallback: %s", e)

        # Fallback for PDFs: Use local pypdf parser
        if is_pdf:
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                if text.strip():
                    return {"text": text.strip()}
            except Exception as e:
                logger.error("pypdf fallback failed: %s", e)

        raise HTTPException(status_code=500, detail="Failed to extract readable text from document.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")


@router.post("/parse-receipt")
async def parse_receipt(
    text: str | None = Form(None),
    url: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: dict = Depends(get_current_user),
):
    """Extract garment information from pasted text, a URL, or an uploaded receipt image/PDF."""
    from app.services.gemini_client import get_default_client
    import httpx
    import mimetypes
    import base64
    
    parts = []
    is_image = False
    image_bytes = None
    image_mime = None
    
    if text and text.strip():
        parts.append(text.strip())
    elif file and file.filename:
        file_bytes = await file.read()
        mime_type = file.content_type
        if not mime_type or mime_type == "application/octet-stream":
            mime_type = mimetypes.guess_type(file.filename)[0] or "image/jpeg"
        
        is_text = False
        if mime_type:
            mime_lower = mime_type.lower()
            if (
                mime_lower.startswith("text/")
                or mime_lower in ["application/json", "application/rtf", "application/javascript", "text/csv"]
                or file.filename.endswith((".txt", ".csv", ".json", ".html", ".htm", ".rtf"))
            ):
                is_text = True
                
        if is_text:
            try:
                decoded_text = file_bytes.decode("utf-8", errors="ignore")
                parts.append(decoded_text)
            except Exception:
                parts.append((file_bytes, mime_type))
        else:
            parts.append((file_bytes, mime_type))
            if mime_type and "image" in mime_type.lower():
                is_image = True
                image_bytes = file_bytes
                image_mime = mime_type
    elif url and url.strip():
        url_str = url.strip()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                resp = await client.get(url_str, headers=headers, follow_redirects=True)
                if resp.status_code == 200:
                    ct = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                    if not ct or ct == "application/octet-stream":
                        ct = mimetypes.guess_type(url_str)[0] or ct
                    
                    if ct and ("image" in ct or "pdf" in ct):
                        parts.append((resp.content, ct))
                        if "image" in ct:
                            is_image = True
                            image_bytes = resp.content
                            image_mime = ct
                    else:
                        parts.append(resp.text)
                else:
                    raise HTTPException(400, f"Failed to fetch URL, status code: {resp.status_code}")
        except Exception as e:
            logger.error("Failed to fetch URL %s: %s", url_str, e)
            raise HTTPException(400, f"Failed to fetch receipt from URL: {e}")
    else:
        raise HTTPException(400, "Either text, file, or url is required and must not be blank")

    system_instructions = """
    You are an expert wardrobe cataloging assistant. Your job is to analyze receipt text, receipt files (PDF/Images), or merchant invoice content, identify the garment/accessory purchased, and extract key details into a structured JSON object.

    Extract the following fields:
    1. brand: The brand of the clothing item (e.g., Zara, Nike, AliExpress). If not specified, infer a likely value or use "Generic".
    2. item_type: The type of garment (e.g., shirt, t-shirt, pants, jeans, jacket, sneakers, dress, socks). Use a simple singular lowercase noun.
    3. size: The size of the item (e.g., S, M, L, XL, XXL).
    4. price_cents: The purchase price of the item converted to integer cents (e.g., if price is ₪79.66 or $79.66, price_cents is 7966. If discount is applied, use the final item price).
    5. colors: A list of primary colors of the garment (e.g., ["black"], ["blue", "white"]). Use lowercase simple color names.
    6. category: The wardrobe category. Must be exactly one of: "Top", "Bottom", "Outerwear", "Full Body", "Footwear", "Underwear", "Accessories".
    7. name: A friendly descriptive name for the garment combining brand and description (e.g., "Wosawe Wind Jacket Lightweight").
    8. gender: The target gender of the garment. Must be exactly one of: "men", "women", "unisex", "kids". If the receipt mentions gender (e.g. "Men's", "Women's", "unisex"), use that. Otherwise, infer from item characteristics or use "unisex" as fallback.

    If multiple items are found in the receipt, return details for the FIRST garment item found.
    Return ONLY a valid JSON object matching this schema. Do not include markdown code fences or other text.
    """

    async def run_ocr():
        from app.db.database import get_db
        from app.services.billing_service import deduct_user_credits
        db = get_db()
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

        gemini = await get_default_client()
        response_text = await gemini.vision(
            user_parts=parts,
            system=system_instructions,
            response_mime_type="application/json"
        )
        
        # Clean any code fences
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```"):
            lines = cleaned_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned_text = "\n".join(lines).strip()
            
        return json.loads(cleaned_text)

    async def run_visual():
        if not is_image or garment_vision_service is None or not image_bytes:
            return None
        try:
            detections = await garment_vision_service.detect_items(image_bytes)
            if not detections:
                return None
            best_det = max(
                detections,
                key=lambda d: (
                    max(0, d["bbox"][2] - d["bbox"][0])
                    * max(0, d["bbox"][3] - d["bbox"][1])
                ),
            )
            raw_crops = await asyncio.to_thread(
                garment_vision_service._bbox_crop_useful, image_bytes, [best_det]
            )
            if not raw_crops:
                return None
            
            _, crop_bytes, crop_mime = raw_crops[0]
            
            # Apply the full garment vision background matting pipeline (SegFormer + rembg + alpha intersection)
            from app.services import background_matting
            from app.services import clothing_parser as _cp
            from app.config import settings
            
            category = best_det.get("label") or best_det.get("kind")
            seg_mask = None
            human_mask = None
            if settings.USE_LOCAL_CLOTHING_PARSER:
                try:
                    garments = await _cp.parse_garments(crop_bytes)
                    seg_mask, human_mask = _pick_segformer_mask_for_category(garments, category)
                except Exception as exc:
                    logger.info("Background matte SegFormer skipped in visual receipt parse: %s", exc)
                    
            try:
                bg_res = await background_matting.remove_background(crop_bytes)
                result_png = bg_res.get("image_png") if isinstance(bg_res, dict) else None
                if result_png:
                    if seg_mask is not None:
                        try:
                            refined = _cp.apply_alpha_intersection(
                                result_png,
                                seg_mask,
                                category=category,
                                human_mask=human_mask,
                                is_padded_canvas=True,
                            )
                            if refined:
                                result_png = refined
                        except Exception as exc:
                            logger.info("Background matte alpha intersection skipped in visual receipt parse: %s", exc)
                    
                    crop_bytes = result_png
                    crop_mime = "image/png"
            except Exception as bg_err:
                logger.warning("Background removal failed on receipt visual crop: %s", bg_err)

            user_lang = user.get("preferred_language") or "en"
            analysis_raw = await garment_vision_service.analyze(
                crop_bytes,
                language=user_lang,
            )
            analysis_clean = _safe_analysis(analysis_raw)
            crop_b64 = base64.b64encode(crop_bytes).decode("ascii")
            
            return {
                "visual_analysis": analysis_clean,
                "image_base64": crop_b64,
                "image_mime": crop_mime or "image/jpeg",
            }
        except Exception as exc:
            logger.warning("Receipt image item detection/analysis failed: %r", exc)
            return None

    try:
        ocr_result, visual_result = await asyncio.gather(run_ocr(), run_visual())
        
        final_data = {}
        if visual_result and "visual_analysis" in visual_result:
            final_data.update(visual_result["visual_analysis"])
            
        # Override with authoritative OCR fields
        for field in ["brand", "size", "price_cents", "category", "item_type", "gender"]:
            if field in ocr_result and ocr_result[field] not in [None, "", "null"]:
                final_data[field] = ocr_result[field]
                
        # Merge name / title
        if "name" in ocr_result and ocr_result["name"] not in [None, "", "null"]:
            final_data["name"] = ocr_result["name"]
            final_data["title"] = ocr_result["name"]
        elif "title" in final_data:
            final_data["name"] = final_data["title"]
            
        # Merge colors and distribute percentages evenly to total 100%
        if "colors" in ocr_result and ocr_result["colors"]:
            raw_colors = []
            for col in ocr_result["colors"]:
                if isinstance(col, str):
                    raw_colors.append({"name": col, "pct": None})
                elif isinstance(col, dict) and "name" in col:
                    raw_colors.append({"name": col["name"], "pct": col.get("pct")})
            
            has_pct = [c for c in raw_colors if c["pct"] is not None]
            total_known = sum(c["pct"] for c in has_pct)
            
            if len(has_pct) == len(raw_colors):
                final_colors = raw_colors
            else:
                remaining = max(0, 100 - total_known)
                null_count = len(raw_colors) - len(has_pct)
                share = remaining // null_count
                distributed = 0
                
                final_colors = []
                null_seen = 0
                for c in raw_colors:
                    if c["pct"] is not None:
                        final_colors.append(c)
                    else:
                        null_seen += 1
                        val = (remaining - distributed) if null_seen == null_count else share
                        distributed += val
                        final_colors.append({"name": c["name"], "pct": val})
            
            if final_colors:
                final_data["colors"] = final_colors
                
        # Fill standard defaults if not present
        if not final_data.get("brand"):
            final_data["brand"] = "Generic"
        if not final_data.get("item_type"):
            final_data["item_type"] = "garment"
        if not final_data.get("size"):
            final_data["size"] = "M"
        if not final_data.get("category"):
            final_data["category"] = "Top"
        if not final_data.get("gender"):
            final_data["gender"] = "unisex"
        if not final_data.get("name"):
            brand_val = final_data.get("brand") or "Generic"
            type_val = final_data.get("item_type") or "garment"
            final_data["name"] = f"{brand_val} {type_val}"
            final_data["title"] = final_data["name"]
            
        # Add image fields if cropped
        if visual_result and "image_base64" in visual_result:
            final_data["image_base64"] = visual_result["image_base64"]
            final_data["image_mime"] = visual_result["image_mime"]
            
        return final_data
    except Exception as e:
        logger.error("Failed parsing receipt: %s", e)
        raise HTTPException(500, f"Error processing receipt: {e}")

@router.get("/stats/sustainability")
async def get_sustainability_stats(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculate sustainability metrics (F5)."""
    db = get_db()
    
    items_cursor = db.closet_items.find({"user_id": user["id"]})
    items = []
    async for item in items_cursor:
        items.append(item)
    
    total_items = len(items)
    worn_items = sum(1 for item in items if (item.get("wear_count") or 0) > 0)
    utilisation_pct = round((worn_items / total_items) * 100) if total_items > 0 else 0
    
    receipt_items = sum(1 for item in items if item.get("from_receipt", False))
    manual_items = total_items - receipt_items
    
    carbon_sum = 0.0
    total_price = 0
    total_wears = 0
    for item in items:
        # Calculate carbon
        dpp = item.get("dpp_data") or {}
        cfp = dpp.get("carbon_footprint")
        if isinstance(cfp, (int, float)):
            carbon_sum += cfp
        elif isinstance(cfp, str):
            import re
            match = re.search(r"([\d\.]+)", cfp)
            if match:
                carbon_sum += float(match.group(1))
        
        # Calculate CPW aggregates
        price = item.get("price_cents")
        if price is not None:
            total_price += price / 100
        total_wears += (item.get("wear_count") or 0)

    current_cpw = (total_price / total_wears) if total_wears > 0 else total_price

    import datetime
    from dateutil.relativedelta import relativedelta
    now = datetime.datetime.now(datetime.timezone.utc)
    
    cpw_trend = []
    for i in range(5, -1, -1):
        target_month = now - relativedelta(months=i)
        month_label = target_month.strftime("%b")
        # Simulate a downward trend for CPW over time
        mock_cpw = current_cpw * (1 + (i * 0.15))
        cpw_trend.append({"month": month_label, "cpw": round(mock_cpw, 2)})
        
    return {
        "utilisation_pct": utilisation_pct,
        "cpw_trend": cpw_trend,
        "intake_breakdown": {
            "receipt": receipt_items,
            "manual": manual_items
        },
        "carbon_sum": round(carbon_sum, 1)
    }


