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

router = APIRouter()

# hallucinations).
class PreflightPhotoIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    image_base64: str | None = None
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
    model_config = ConfigDict(extra="ignore")
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
        average_hash,
        color_signature,
        compute_signatures,
        is_duplicate_match,
    )

    for p in payload.photos:
        if getattr(p, "image_base64", None):
            try:
                raw_b64 = p.image_base64
                if raw_b64.startswith("data:"):
                    raw_b64 = raw_b64.split(",", 1)[1]
                img_bytes = base64.b64decode(raw_b64)
                if not p.sha256:
                    p.sha256 = hashlib.sha256(img_bytes).hexdigest()
                if not p.phash:
                    p.phash = average_hash(img_bytes)
                if not p.color_sig:
                    p.color_sig = color_signature(img_bytes)
            except Exception as exc:
                logger.warning("Failed to compute hash for preflight photo: %r", exc)

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
            "clean_image_url": 1,
            "image_variants": 1,
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
            # Use clean_image_url as the authoritative single-source ground truth.
            _get_item_image_url(row)
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
                        existing_match.get("clean_image_url")
                        or existing_match.get("thumbnail_data_url")
                        or existing_match.get("cutout_url")
                        or existing_match.get("image_url")
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
    active_vision = get_garment_vision_service(user=user)
    if active_vision is None:
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
                    raw_list.append(base64.b64decode(encoded.strip()))
                except Exception as exc:
                    raise HTTPException(400, f"Invalid data URL in array: {exc}") from exc
            else:
                try:
                    clean_b64 = b64_or_url
                    if "," in clean_b64:
                        clean_b64 = clean_b64.split(",", 1)[1]
                    raw_list.append(base64.b64decode(clean_b64.strip()))
                except Exception as exc:
                    raise HTTPException(400, f"Invalid image_base64 in array: {exc}") from exc
    elif payload.image_base64:
        try:
            clean_b64 = payload.image_base64
            if "," in clean_b64:
                clean_b64 = clean_b64.split(",", 1)[1]
            raw_list.append(base64.b64decode(clean_b64.strip()))
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
    wants_ndjson = "application/x-ndjson" in accept or "text/event-stream" in accept

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
                streamer = active_vision.analyze_outfits_stream(
                    raw_list, language=user_lang,
                )

                items_meta: list[dict[str, Any]] = []

                async for frame in streamer:
                    ftype = frame.get("type")
                    if ftype == "detect":
                        items_meta = frame.get("items_meta") or []
                        yield (json.dumps(frame, ensure_ascii=False) + "\n").encode("utf-8")
                    elif ftype == "field":
                        yield (json.dumps(frame, ensure_ascii=False) + "\n").encode("utf-8")
                    elif ftype == "item":
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
            media_type="text/event-stream",
            headers={
                "X-Accel-Buffering": "no",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    async def _do_analyze() -> dict[str, Any]:
        """Inner analyze body using analyze_outfits_stream."""
        try:
            items_out: list[dict[str, Any]] = []
            items_meta: list[dict[str, Any]] = []
            streamer = active_vision.analyze_outfits_stream(
                raw_list, language=user_lang,
            )
            from app.services.vision import _is_unidentifiable

            async for frame in streamer:
                ftype = frame.get("type")
                if ftype == "detect":
                    items_meta = frame.get("items_meta") or []
                elif ftype == "item":
                    idx = frame.get("index", -1)
                    meta = (
                        items_meta[idx]
                        if 0 <= idx < len(items_meta)
                        else {}
                    )
                    analysis = _safe_analysis(frame.get("analysis") or {})
                    if not _is_unidentifiable(analysis):
                        items_out.append(
                            {
                                "label": meta.get("label"),
                                "kind": meta.get("kind"),
                                "bbox": meta.get("bbox"),
                                "crop_base64": meta.get("crop_base64"),
                                "crop_mime": meta.get("crop_mime", "image/jpeg"),
                                "analysis": analysis,
                                "potential_duplicate": None,
                                "reconstruction_advised": False,
                                "one_pass": False,
                                "defer_matte": meta.get("defer_matte", False),
                                "needs_reconstruction": frame.get(
                                    "needs_reconstruction", False,
                                ),
                                "reconstruction_reasons": frame.get(
                                    "reconstruction_reasons", [],
                                ),
                            }
                        )
                elif ftype == "error":
                    raise HTTPException(
                        frame.get("status", 503),
                        frame.get("message", "Garment analyzer is temporarily unavailable."),
                    )

            if not items_out:
                raise HTTPException(
                    422,
                    "We couldn't identify any garment in this photo. "
                    "Please try a clearer, well-lit shot.",
                )
            first = items_out[0]["analysis"] if items_out else _safe_analysis({})
            return {"items": items_out, "count": len(items_out), **first}
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Outfit analysis failed: %r", exc)
            raise HTTPException(
                503,
                "Garment analyzer is temporarily unavailable. Please try again.",
            ) from exc

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
            except Exception:
                # Underlying task completed with an exception; break out
                # of the loop so task.result() handles it and yields the
                # JSON error envelope instead of abruptly terminating the stream.
                break
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
    """Run Nano Banana image reconstruction and completion on the crop.

    This is called by the client to complete or reconstruct a bad, distorted,
    or low-resolution image using Gemini Nano Banana.
    """
    try:
        # Strip data URL prefix if present
        b64_data = payload.image_base64
        if b64_data.startswith("data:"):
            _, b64_data = b64_data.split(",", 1)
        raw_bytes = base64.b64decode(b64_data, validate=True)
    except Exception as exc:
        raise HTTPException(400, f"Invalid image_base64: {exc}") from exc

    from app.services.reconstruction import reconstruct

    # Call the Nano Banana reconstructor
    try:
        out = await reconstruct(
            raw_bytes,
            {"category": payload.category or "garment"},
            reasons=["polish_crop"],
            validate=False,
        )
        if out and out.get("image_b64"):
            mime = out.get("mime_type", "image/png")
            return {
                "image_base64": f"data:{mime};base64,{out['image_b64']}",
                "applied": True,
            }
    except Exception as exc:
        logger.warning("polish_crop Nano Banana reconstruction failed: %s", exc)

    return {"image_base64": payload.image_base64, "applied": False}


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

    service_to_test = get_garment_vision_service(user=user) or garment_vision_service
    if service_to_test is None:
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
        ("default_model", getattr(service_to_test, "model", settings.GARMENT_VISION_MODEL)),
        ("crop_model", settings.GARMENT_VISION_CROP_MODEL),
    ):
        try:
            res = await service_to_test.analyze(test_bytes, model=model)
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

class ItemChatTurn(BaseModel):
    role: str = "user"
    content: str = ""


class ItemChatAnalyseIn(BaseModel):
    message: str
    history: list[ItemChatTurn] = []
    fill_empty_only: bool = False
    image_url: str | None = None
    language: str | None = None


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

    crop_url = _get_item_image_url(item)
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

    vision_service = get_garment_vision_service(user=user)
    if payload.auto_segment and vision_service is not None:
        # Fast single-item pipeline: just run the detector and crop/matte it.
        # We don't run the full `analyze_outfit` because we don't need the 
        # 11-second Gemini LLM analysis (we are only replacing the photo, not 
        # rewriting the item's metadata).
        try:
            detections = await vision_service.detect_items(raw)
            if detections:
                best_det = max(
                    detections,
                    key=lambda d: (
                        max(0, d["bbox"][2] - d["bbox"][0])
                        * max(0, d["bbox"][3] - d["bbox"][1])
                    ),
                )
                raw_crops = await asyncio.to_thread(
                    vision_service._bbox_crop_useful, raw, [best_det]
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
                    segmented_data_url = f"data:{mime};base64,{base64.b64encode(b64_bytes).decode('ascii')}"
                    segmentation_model = getattr(vision_service, "model", "gemini-3.5-flash")
        except Exception as exc:  # noqa: BLE001
            logger.warning("auto_segment failed on photo replace: %s", exc)

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

    Useful in two real-world flows:
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
    vision_service = get_garment_vision_service(user=user)
    if vision_service is None:
        raise HTTPException(503, "Garment analyzer not configured")

    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")

    image_url: str | None = _get_item_image_url(item)
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
            parsed = await vision_service.analyze(raw, language=user_lang)
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

    return {
        "item": updated_item,
        "updated_fields": update_doc if update_doc else None,
    }



def _get_localized_closet_msg(msg_type: str, lang: str, user_msg: str = "") -> str:
    lang = (lang or "en").lower()
    if lang not in ("he", "ar", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "hi"):
        lang = "en"

    messages = {
        "image_edit_failed": {
            "he": f"ניסיתי לערוך את התמונה ({user_msg}), אך נתקלתי בבעיה בעיבוד התמונה. אנא נסה שוב או נסח את הבקשה בצורה שונה.",
            "ar": f"حاولت تعديل الصورة ({user_msg})، ولكن حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.",
            "en": f"I attempted to modify the image ({user_msg}), but encountered an issue during processing. Please try again or refine your prompt.",
            "es": f"Intenté modificar la imagen ({user_msg}), pero ocurrió un problema durante el procesamiento. Por favor intenta de nuevo.",
            "fr": f"J'ai essayé de modifier l'image ({user_msg}), mais un problème est survenu lors du traitement. Veuillez réessayer.",
            "de": f"Ich habe versucht, das Bild zu bearbeiten ({user_msg}), aber bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuche es erneut.",
            "it": f"Ho provato a modificare l'immagine ({user_msg}), ma si è verificato un problema durante l'elaborazione. Per favore riprova.",
            "pt": f"Tentei modificar a imagem ({user_msg}), mas ocorreu um erro no processamento. Por favor tente novamente.",
            "ru": f"Я попытался изменить изображение ({user_msg}), но произошла ошибка при обработке. Пожалуйста, попробуйте еще раз.",
            "zh": f"我尝试修改图片（{user_msg}），但在处理过程中遇到了问题。请重试或修改提示词。",
            "ja": f"画像の変更を試みました（{user_msg}）が、処理中に問題が発生しました。もう一度お試しください。",
            "hi": f"मैंने छवि को संशोधित करने का प्रयास किया ({user_msg}), लेकिन प्रसंस्करण के दौरान एक समस्या आई। कृपया पुन: प्रयास करें।",
        },
        "image_edit_unavailable": {
            "he": "עריכת תמונות אינה זמינה כעת בשרת. אנא ודא שהמערכת מוגדרת כראוי.",
            "ar": "خدمة تعديل الصور غير متوفرة حالياً على الخادم. يرجى التأكد من تكوين النظام.",
            "en": "Image editing is currently unavailable on this server. Please ensure the service is configured.",
            "es": "La edición de imágenes no está disponible actualmente en este servidor.",
            "fr": "La retouche d'image est actuellement indisponible sur ce serveur.",
            "de": "Die Bildbearbeitung ist auf diesem Server derzeit nicht verfügbar.",
            "it": "La modifica delle immagini non è al momento disponibile su questo server.",
            "pt": "A edição de imagens não está disponível no momento neste servidor.",
            "ru": "Редактирование изображений в настоящее время недоступно на этом сервере.",
            "zh": "该服务器当前无法进行图像编辑。",
            "ja": "現在このサーバーでは画像編集を利用できません。",
            "hi": "इस सर्वर पर वर्तमान में छवि संपादन उपलब्ध नहीं है।",
        },
        "default_chat_reply": {
            "he": "הבנתי. עדכן אותי אם תרצה שאערוך את התמונה או אעדכן את פרטי הפריט.",
            "ar": "مفهوم. أخبرني إذا كنت ترغب في تعديل الصورة أو تحديث تفاصيل القطعة.",
            "en": "Understood. Let me know if you want me to edit the photo or refine the details.",
            "es": "Entendido. Avísame si quieres que edite la foto o ajuste los detalles.",
            "fr": "Compris. Faites-moi savoir si vous souhaitez modifier la photo ou ajuster les détails.",
            "de": "Verstanden. Lass mich wissen, wenn du das Bild bearbeiten oder Details anpassen möchtest.",
            "it": "Ricevuto. Fammi sapere se desideri che modifichi la foto o aggiorni i dettagli.",
            "pt": "Entendido. Avise-me se você quiser que eu edite a foto ou ajuste os detalhes.",
            "ru": "Понятно. Дайте знать, если нужно отредактировать фото или уточнить детали.",
            "zh": "明白了。如果您需要我编辑照片或调整详情，请告诉我。",
            "ja": "了解しました。写真を編集したり詳細を調整したい場合はお知らせください。",
            "hi": "समझ गया। अगर आप चाहते हैं कि मैं फ़ोटो संपादित करूँ या विवरण को परिष्कृत करूँ तो मुझे बताएं।",
        },
        "image_edit_processing": {
            "he": f"מבצע עריכת תמונה: {user_msg}",
            "ar": f"جاري تعديل الصورة: {user_msg}",
            "en": f"Processing image modification: {user_msg}",
            "es": f"Modificando imagen: {user_msg}",
            "fr": f"Modification de l'image : {user_msg}",
            "de": f"Bearbeite Bild: {user_msg}",
            "it": f"Modifica dell'immagine in corso: {user_msg}",
            "pt": f"Processando modificação da imagem: {user_msg}",
            "ru": f"Выполняется редактирование изображения: {user_msg}",
            "zh": f"正在处理图片修改：{user_msg}",
            "ja": f"画像を変更中：{user_msg}",
            "hi": f"छवि संशोधन संसाधित किया जा रहा है: {user_msg}",
        }
    }
    return messages.get(msg_type, {}).get(lang) or messages.get(msg_type, {}).get("en", "")


@router.post("/{item_id}/chat-analyse")
async def chat_analyse_item(
    item_id: str,
    payload: ItemChatAnalyseIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Conversational Re-analyse & AI Eyes Assistant.

    Processes natural language instructions regarding the garment photo or metadata:
    1. Image modification & inpainting (e.g. 'Remove the shoes', 'Complete the hole where the hand was', 'Remove the metal studs from the jacket') -> Invokes Nano Banana (gemini-3.1-flash-lite-image)
    2. Clarifications -> Returns assistant questions if instruction is underspecified
    3. Metadata revision -> Updates form attributes according to instructions
    4. General garment styling/details Q&A
    """
    db = get_db()
    item = await repos.find_one(
        db.closet_items, {"id": item_id, "user_id": user["id"]}
    )
    if not item:
        raise HTTPException(404, "Item not found")

    user_msg = (payload.message or "").strip()
    if not user_msg:
        raise HTTPException(400, "Message cannot be empty")

    image_url: str | None = payload.image_url or _get_item_image_url(item)
    if not image_url:
        raise HTTPException(400, "Item has no stored image. Please attach a photo first.")

    raw = await _read_image_bytes_from_url(image_url)
    if not raw:
        raise HTTPException(400, "Stored image is empty or could not be retrieved.")

    user_lang = payload.language or (user or {}).get("preferred_language")
    if not user_lang or user_lang == "en":
        if any("\u0590" <= c <= "\u05FF" for c in user_msg):
            user_lang = "he"
        elif any("\u0600" <= c <= "\u06FF" for c in user_msg):
            user_lang = "ar"
        else:
            user_lang = "en"

    # Build conversation context for Gemini
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    from app.services.gemini_client import GeminiClient

    gemini_client = None
    try:
        gemini_client = GeminiClient(api_key=user_api_key or settings.GEMINI_API_KEY)
    except Exception as exc:
        logger.warning("Failed to initialize GeminiClient: %s", exc)

    if not gemini_client:
        raise HTTPException(503, "AI Eyes assistant is temporarily unavailable.")

    history_str = ""
    for turn in payload.history[-6:]:
        role = "User" if turn.role == "user" else "The Eyes"
        history_str += f"{role}: {turn.content}\n"

    system_prompt = (
        "You are 'The Eyes', DressApp's intelligent garment vision and wardrobe analysis assistant.\n"
        f"The user is viewing their garment in the wardrobe. The user's active language is '{user_lang}'. "
        "The user's instruction or question may be in Hebrew, Arabic, German, French, Spanish, English, or any other language.\n\n"
        f"Garment Context:\n"
        f"- Title: {item.get('title') or 'Unknown'}\n"
        f"- Category: {item.get('category') or 'Unknown'} / {item.get('sub_category') or ''}\n"
        f"- Colors: {item.get('colors') or item.get('color') or 'Unknown'}\n"
        f"- Materials: {item.get('fabric_materials') or item.get('material') or 'Unknown'}\n"
        f"- Pattern: {item.get('pattern') or 'Unknown'}\n"
        f"- Condition: {item.get('condition') or 'Unknown'}\n"
        f"- Quality: {item.get('quality') or 'Unknown'}\n\n"
        "Your task: Analyze the user's message and determine the correct action from the following 4 options:\n\n"
        "1. 'image_edit': The user is asking to modify, inpaint, remove, or reconstruct elements in the photo.\n"
        "   CRITICAL REQUIREMENTS FOR 'image_edit':\n"
        "   - Set action: 'image_edit'\n"
        "   - Set image_edit_prompt: ALWAYS IN ENGLISH! Translate the user's intent into a concise, highly specific inpainting / outpainting / reconstruction instruction for Gemini Nano Banana (e.g. 'Restore the footwear, clean commercial sneaker photo on solid neutral #F5F2EB off-white background', 'Outpaint and fill the missing area where the hand was, preserving original fabric texture and color').\n"
        f"   - Set reply: Write a brief, friendly confirmation in the user's language ('{user_lang}') describing what you are modifying.\n\n"
        "2. 'clarification': The user's request for image modification or editing is ambiguous or missing crucial specifics.\n"
        "   - Set action: 'clarification'\n"
        f"   - Set reply: A polite, direct question in '{user_lang}' asking for the needed clarification.\n\n"
        "3. 'metadata_update': The user is asking to update or re-classify attributes, materials, colors, brand, or category.\n"
        "   - Set action: 'metadata_update'\n"
        "   - Set metadata_updates: A dict of key-value changes (e.g. title, category, colors, fabric_materials, condition, etc.)\n"
        f"   - Set reply: A brief explanation of the updated fields in '{user_lang}'.\n\n"
        "4. 'answered': The user is asking a general styling, care, matching, or information question.\n"
        "   - Set action: 'answered'\n"
        f"   - Set reply: A helpful, expert styling/garment response in '{user_lang}'.\n\n"
        "IMPORTANT: You MUST respond in valid JSON format with keys:\n"
        "{\n"
        '  "action": "image_edit" | "clarification" | "metadata_update" | "answered",\n'
        '  "reply": "string",\n'
        '  "image_edit_prompt": "string or null",\n'
        '  "metadata_updates": { ... } or null\n'
        "}"
    )

    user_parts = [
        raw,
        f"Conversation History:\n{history_str}\nUser Prompt: {user_msg}\nPlease respond in language: {user_lang} (except JSON keys and image_edit_prompt which MUST be English).",
    ]

    try:
        decision_raw = await gemini_client.vision(
            user_parts=user_parts,
            system=system_prompt,
            response_mime_type="application/json",
            model=user_model,
        )
        clean_json = (decision_raw or "").strip()
        import re as _re
        if "```" in clean_json:
            m = _re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_json)
            if m:
                clean_json = m.group(1).strip()
            else:
                clean_json = _re.sub(r"^```(?:json)?\s*", "", clean_json)
                clean_json = _re.sub(r"\s*```$", "", clean_json).strip()
        decision = json.loads(clean_json)
    except Exception as exc:
        logger.warning("Gemini decision parsing failed in chat_analyse: %s", exc)
        # Fallback heuristic (multilingual)
        low_msg = user_msg.lower()
        item_cat = (item.get("category") or "").strip().lower()
        is_shoes_item = any(k in item_cat for k in ("footwear", "shoes", "sneakers", "boots", "נעל", "נעליים", "חذاء"))

        is_remove = any(k in low_msg for k in [
            "remove", "erase", "cutout", "delete", "crop", "drop", "without",
            "הסר", "הסרה", "הורד", "הורדה", "מחק", "מחיקה", "חתוך", "בלי",
            "ازالة", "إزالة", "حذف", "مسح", "قص", "بدون",
        ])
        is_restore = any(k in low_msg for k in [
            "restore", "reconstruct", "repair", "fix", "complete", "fill", "outpaint", "enhance", "clean",
            "שחזר", "שחזור", "תקן", "תיקון", "השלם", "השלמה", "שפר", "נקה",
            "اصلاح", "إصلاح", "استعادة", "تعديل", "اكمال", "إكمال",
        ])
        image_keywords = [
            # English
            "remove", "complete", "fix", "hole", "stud", "shoe", "sleeve", "hand", "background", "erase", "repair", "clean", "cutout", "isolate", "crop", "inpaint", "restore", "reconstruct",
            # Hebrew
            "הסר", "הסרה", "הורד", "הורדה", "מחק", "מחיקה", "תקן", "תיקון", "השלם", "השלמה", "חור", "רקע", "שרוול", "נעל", "נעליים", "יד", "נקה", "חתוך", "ניטים", "קולב", "שחזר", "שחזור",
            # Arabic
            "ازالة", "إزالة", "حذف", "مسح", "اصلاح", "إصلاح", "تعديل", "خلفية", "حذاء", "قص", "ثقب", "كم", "شماعة", "استعادة", "اكمال",
        ]
        is_edit = any(k in low_msg for k in image_keywords)
        if is_edit:
            prompt_en = user_msg
            if is_shoes_item and (is_restore or not is_remove or "שחזר" in user_msg or "restore" in low_msg):
                prompt_en = f"Commercial product photograph of complete, restored {item.get('title') or 'pair of shoes'}, clean sneakers on solid neutral #F5F2EB off-white background, photorealistic crisp details"
            elif is_remove and ("נעל" in user_msg or "נעליים" in user_msg or "shoe" in low_msg) and not is_shoes_item:
                prompt_en = "Remove the shoes and footwear at the bottom, isolating the garment cleanly on neutral #F5F2EB background"
            elif "חור" in user_msg or "יד" in user_msg or "השלם" in user_msg or "hole" in low_msg or "hand" in low_msg:
                prompt_en = "Outpaint and complete the missing area where the hand or cutout was, preserving original fabric texture and color"
            elif "ניטים" in user_msg or "stud" in low_msg:
                prompt_en = "Remove the metal studs from the garment"
            elif "רקע" in user_msg or "נקה" in user_msg or "background" in low_msg:
                prompt_en = "Clean background and isolate the garment cleanly on neutral #F5F2EB background"
            elif is_restore:
                prompt_en = f"Reconstruct and restore {item.get('title') or item.get('category') or 'garment'}, high-fidelity commercial fashion catalog photograph on neutral #F5F2EB background"

            reply_text = _get_localized_closet_msg("image_edit_processing", user_lang, user_msg=user_msg)
            decision = {
                "action": "image_edit",
                "reply": reply_text,
                "image_edit_prompt": prompt_en,
            }
        else:
            default_reply = _get_localized_closet_msg("default_chat_reply", user_lang)
            decision = {
                "action": "answered",
                "reply": default_reply,
            }

    action = decision.get("action") or "answered"
    if action not in ("image_edit", "metadata_update", "clarification", "answered"):
        action = "answered"
    reply = decision.get("reply") or ""
    image_url_out = None
    clean_image_url_out = None
    updated_doc: dict[str, Any] = {}

    if action == "image_edit":
        import sys
        _closet_mod = sys.modules.get("app.api.v1.closet")
        _active_gemini_service = getattr(_closet_mod, "gemini_image_service", gemini_image_service) if _closet_mod else gemini_image_service
        img_service = (
            get_gemini_image_service(user=user, api_key=user_api_key)
            if (user_api_key and user_api_key != settings.GEMINI_API_KEY)
            else _active_gemini_service
        )
        if img_service is None:
            reply = _get_localized_closet_msg("image_edit_unavailable", user_lang)
            action = "clarification"
        else:
            try:
                from app.services.billing_service import deduct_user_credits
                await deduct_user_credits(db, user, cost=1)

                edit_prompt = decision.get("image_edit_prompt") or user_msg
                edit_res = await img_service.edit(
                    raw,
                    edit_prompt,
                    garment_metadata={
                        "title": item.get("title"),
                        "category": item.get("category"),
                        "color": item.get("color"),
                        "material": item.get("material"),
                        "pattern": item.get("pattern"),
                        "brand": item.get("brand"),
                    },
                )
                mime = edit_res.get("mime_type", "image/png")
                image_url_out = f"data:{mime};base64,{edit_res['image_b64']}"

                # Unbind generated garment from background (transparent clean cutout)
                from app.services.garment_visuals import GarmentVisuals
                clean_image_url_out = await GarmentVisuals.ensure_transparent_cutout(edit_res["image_b64"])

                # Update in-memory reconstructed_image_url & clean_image_url
                # Always prefer the transparent clean cutout so clothes layer perfectly without background boxes
                from app.services.vision.image import fit_image_data_url_to_card
                final_img = fit_image_data_url_to_card(clean_image_url_out or image_url_out)
                updated_doc["reconstructed_image_url"] = final_img
                # Do NOT overwrite clean_image_url (preserving the original cutout)
                image_url_out = final_img
                updated_doc["reconstruction_metadata"] = {
                    "method": "nano_banana_chat",
                    "prompt": edit_prompt,
                    "model": edit_res.get("model_used"),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as edit_exc:
                logger.warning("Nano Banana chat edit failed: %s", edit_exc)
                reply = _get_localized_closet_msg("image_edit_failed", user_lang, user_msg=user_msg)
                action = "clarification"

    elif action == "metadata_update":
        meta_updates = decision.get("metadata_updates") or {}
        for k, v in meta_updates.items():
            if k in (
                "title", "name", "category", "sub_category", "item_type", "brand",
                "gender", "dress_code", "season", "tradition", "colors", "color",
                "fabric_materials", "material", "pattern", "state", "condition",
                "quality", "repair_advice", "tags"
            ):
                updated_doc[k] = v

    # Build preview item in memory (do not overwrite DB until user clicks Save)
    updated_item = {**item, **updated_doc}

    return {
        "reply": reply,
        "action_taken": action,
        "image_url": image_url_out,
        "clean_image_url": clean_image_url_out,
        "updated_fields": updated_doc if updated_doc else None,
        "item": updated_item,
    }




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
    (``gemini-3.1-flash-lite-image``). An optional ``user_hint`` is woven into
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
        "image_quality_status": item.get("image_quality_status"),
        "image_quality_reason": item.get("image_quality_reason"),
        "reconstruction_prompt": item.get("reconstruction_prompt"),
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

    # Use the clean-cut rembg image for visual conditioning (what the user sees
    # in the closet); fall back to other image fields if matte hasn't run yet.
    crop_url = _get_item_image_url(item)
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
    update_doc: dict[str, Any] = {
        "reconstructed_image_url": data_url,
        "reconstruction_metadata": meta,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    from app.services.vision.image import fit_image_data_url_to_card
    data_url = fit_image_data_url_to_card(data_url) or data_url

    if not preview:
        await db.closet_items.update_one(
            {"id": item_id},
            {"$set": update_doc, "$unset": {"thumbnail_data_url": ""}},
        )
        item = await repos.find_one(db.closet_items, {"id": item_id}) or item
        try:
            from app.services.sync_service import broadcast_sync_event
            await broadcast_sync_event(
                user["id"],
                "closet_updated",
                {"action": "update", "item_id": item_id, "reconstructed_image_url": data_url},
            )
        except Exception as sync_exc:
            logger.debug("Repair broadcast_sync_event skipped: %s", sync_exc)
    else:
        item["reconstructed_image_url"] = data_url
        item["reconstruction_metadata"] = meta
        
    return {"item": item, "reconstruction": out, "applied": True}



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
    source_url = _get_item_image_url(item)
    if not source_url:
        raise HTTPException(400, "No source image on this item")
    source_bytes = await _read_image_bytes_from_url(source_url)
    if not source_bytes:
        raise HTTPException(400, "Failed to retrieve source image bytes")
    img_service = get_gemini_image_service(user=user)
    if img_service is None:
        # Nano Banana (gemini-3.1-flash-lite-image) requires a direct
        # GEMINI_API_KEY. The legacy HF FLUX fallback was retired in May
        # 2026, so when the direct key is absent we surface a clean 503
        # instead of silently degrading.
        raise HTTPException(503, "Image generation service not configured")
    try:
        from app.services.billing_service import deduct_user_credits
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

        edit = await img_service.edit(
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
    # Unbind generated clean image from background (transparent clean cutout)
    from app.services.garment_visuals import GarmentVisuals
    clean_variant_url = await GarmentVisuals.ensure_transparent_cutout(edit["image_b64"])

    variants = list(item.get("variants") or [])
    variants.append(
        {
            "prompt": prompt,
            "url": variant_url,
            "clean_url": clean_variant_url,
            "model": edit["model_used"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    final_variant = clean_variant_url or variant_url
    update_doc: dict[str, Any] = {"variants": variants, "reconstructed_image_url": final_variant}
    if clean_variant_url:
        update_doc["clean_image_url"] = clean_variant_url
        update_doc["clean_image_status"] = "ready"

    await db.closet_items.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": update_doc}
    )
    return {"variant_url": variant_url, "clean_url": clean_variant_url, "variants": variants}


