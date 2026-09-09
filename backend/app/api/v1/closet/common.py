"""backend/app/api/v1/closet/common.py
Shared constants, Pydantic models, locks, and service aliases.
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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/closet", tags=["closet"])

# Retain strong references to background asyncio tasks to prevent premature GC
_active_background_tasks: set[asyncio.Task] = set()


def _track_task(task: asyncio.Task) -> asyncio.Task:
    _active_background_tasks.add(task)
    task.add_done_callback(_active_background_tasks.discard)
    return task

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
    image_quality_status: str | None = None
    image_quality_reason: str | None = None
    reconstruction_prompt: str | None = None
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
    # View preference ('clean' vs 'reconstructed')
    preferred_image_view: str | None = None
    # Phase Q — reconstruction knobs
    reconstructed_image_url: str | None = None
    reconstruction_metadata: dict[str, Any] | None = None
    clean_image_url: str | None = None
    clean_image_status: str | None = None
    # Allow clearing the reconstruction (user can "revert" via Repair UI)
    clear_reconstruction: bool = False



# --- Closet Service Helpers & Background Tasks ---
import sys
from app.services import closet_service


def _get_closet_attr(name: str, fallback: Any) -> Any:
    mod = sys.modules.get("app.api.v1.closet")
    if mod and hasattr(mod, name):
        val = getattr(mod, name)
        # Avoid infinite recursion if mod.name points to this helper function
        if val is not None and not (callable(val) and getattr(val, "__name__", "") == name and getattr(val, "__module__", "") == __name__):
            return val
    return fallback


async def _read_image_bytes_from_url(url: str) -> bytes | None:
    fn = _get_closet_attr("_read_image_bytes_from_url", closet_service.read_image_bytes_from_url)
    return await fn(url)


def _pick_segformer_mask_for_category(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_pick_segformer_mask_for_category", closet_service.pick_segformer_mask_for_category)
    return fn(*args, **kwargs)


def _bytes_from_data_url(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_bytes_from_data_url", closet_service.bytes_from_data_url)
    return fn(*args, **kwargs)


def _ensure_min_resolution(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_ensure_min_resolution", closet_service.ensure_min_resolution)
    return fn(*args, **kwargs)


async def _maybe_retry_stale_matte(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_maybe_retry_stale_matte", closet_service.maybe_retry_stale_matte)
    return await fn(*args, **kwargs)


def _run_background_matte(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_run_background_matte", closet_service.run_background_matte)
    return fn(*args, **kwargs)


def _run_background_matte_and_analyze(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_run_background_matte_and_analyze", closet_service.run_background_matte_and_analyze)
    return fn(*args, **kwargs)


def _run_background_reconstruction(*args: Any, **kwargs: Any) -> Any:
    fn = _get_closet_attr("_run_background_reconstruction", closet_service.run_background_reconstruction)
    return fn(*args, **kwargs)


def _get_item_image_url(item: dict[str, Any]) -> str | None:
    """Extract clean_image_url as the primary image URL from a closet item document with full fallbacks."""
    if not isinstance(item, dict):
        return None
    return (
        item.get("clean_image_url")
        or item.get("reconstructed_image_url")
        or item.get("cutout_url")
        or item.get("image_url")
        or item.get("original_image_url")
        or item.get("thumbnail_data_url")
        or (item.get("image_variants") or {}).get("webp", {}).get("large")
        or (item.get("image_variants") or {}).get("webp", {}).get("medium")
        or (item.get("image_variants") or {}).get("original")
        or None
    )

