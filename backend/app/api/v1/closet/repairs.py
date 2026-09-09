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
        "clean_image_url": 1,
        "cutout_url": 1,
        "reconstructed_image_url": 1,
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
            "thumbnail_data_url": 1,
            "clean_image_url": 1,
            "reconstructed_image_url": 1,
            "cutout_url": 1,
            "image_url": 1,
            "image_variants": 1,
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
                "clean_image_url",
                "reconstructed_image_url",
                "cutout_url",
                "thumbnail_data_url",
                "image_url",
                "segmented_image_url",
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
                clean_image_url=item.get("clean_image_url"),
                reconstructed_image_url=item.get("reconstructed_image_url"),
                thumbnail_data_url=item.get("thumbnail_data_url") or (images[0] if images else None),
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
            "thumbnail_data_url": 1,
            "clean_image_url": 1,
            "reconstructed_image_url": 1,
            "cutout_url": 1,
            "image_url": 1,
            "image_variants": 1,
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
                    "clean_image_url",
                    "reconstructed_image_url",
                    "cutout_url",
                    "thumbnail_data_url",
                    "image_url",
                    "segmented_image_url",
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
                    clean_image_url=item.get("clean_image_url"),
                    reconstructed_image_url=item.get("reconstructed_image_url"),
                    thumbnail_data_url=item.get("thumbnail_data_url") or (images[0] if images else None),
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



