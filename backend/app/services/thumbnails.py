"""Tiny, reusable thumbnail generator for closet list responses.

Problem
-------
Closet items persist the full segmented / reconstructed images as
``data:image/...;base64,...`` URLs embedded directly inside the Mongo
document. A single item's ``reconstructed_image_url`` is routinely
800-1500 KB, so a 40-item closet response balloons to 25-60 MB of JSON
— which is exactly why ``GET /api/v1/closet`` takes 30 s even after the
DB sort was fixed.

Solution
--------
For every item, the first time the list endpoint observes it without a
``thumbnail_data_url``, this module:

1. Picks the best source image (reconstructed > segmented > original).
2. Decodes the base64, downsizes to ``MAX_THUMB_SIZE``, re-encodes as
   a JPEG at ``THUMB_QUALITY``.
3. Returns a short ``data:image/jpeg;base64,...`` URL (~10-18 KB).

The caller is expected to persist the result back to the document so
subsequent reads skip the work entirely.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

# Target dimensions for the closet grid card. The frontend renders 3:4
# cards at roughly 220×290 CSS px (and up to 2× on retina), so 320×426
# is a safe upper bound that still keeps file size tiny.
MAX_THUMB_SIZE = (320, 426)
THUMB_QUALITY = 70  # JPEG quality — 70 is visually indistinguishable for thumbnails


def _decode_data_url(data_url: str) -> bytes | None:
    """Extract the raw bytes from a ``data:...;base64,XXX`` URL."""
    if not isinstance(data_url, str):
        return None
    if not data_url.startswith("data:"):
        return None
    try:
        _, b64 = data_url.split(",", 1)
    except ValueError:
        return None
    try:
        return base64.b64decode(b64)
    except Exception:  # noqa: BLE001
        return None


def _has_meaningful_alpha(img: Image.Image) -> bool:
    """Return True when the image has any non-fully-opaque pixels.

    A garment cutout from rembg/SegFormer is RGBA with most pixels
    transparent and the garment opaque. A photo accidentally opened as
    RGBA might also be RGBA but with all alpha == 255 (no actual
    transparency). We only want to keep PNG output for the former.
    """
    if img.mode not in ("RGBA", "LA"):
        return False
    try:
        alpha = img.split()[-1]
        # ``getextrema()`` returns ``(min, max)`` for an L-mode band.
        lo, hi = alpha.getextrema()
        return lo < 255  # any pixel that isn't fully opaque
    except Exception:  # noqa: BLE001
        return False


def _downsize_bytes(raw: bytes, max_size=MAX_THUMB_SIZE, quality=THUMB_QUALITY) -> bytes | None:
    """Decode → shrink → re-encode as WebP. Returns ``None`` on any error.

    Both transparent cutouts (which keep alpha) and fully opaque images
    are compressed as WebP to minimize payload sizes over cellular networks.
    """
    try:
        img = Image.open(io.BytesIO(raw))
        # Flatten palette images so we can inspect their alpha properly.
        if img.mode == "P":
            img = img.convert("RGBA")
    except Exception as exc:  # noqa: BLE001
        logger.info("thumbnail decode failed: %s", repr(exc)[:120])
        return None
    try:
        keep_alpha = _has_meaningful_alpha(img)
        if keep_alpha:
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            img.thumbnail(max_size, Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=quality)
            return buf.getvalue()
        # Opaque image — convert to RGB and save as lossy WebP.
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail(max_size, Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=quality)
        return buf.getvalue()
    except Exception as exc:  # noqa: BLE001
        logger.info("thumbnail resize failed: %s", repr(exc)[:120])
        return None


def make_thumb_from_data_url(data_url: str) -> str | None:
    """Synchronous core — data URL in, WebP data URL out."""
    raw = _decode_data_url(data_url)
    if not raw:
        return None
    small = _downsize_bytes(raw)
    if not small:
        return None
    return "data:image/webp;base64," + base64.b64encode(small).decode("ascii")


def make_placeholder_from_data_url(data_url: str) -> str | None:
    """Generate a super tiny placeholder image (max 32x42) as a WebP data URL."""
    raw = _decode_data_url(data_url)
    if not raw:
        return None
    small = _downsize_bytes(raw, max_size=(32, 42), quality=15)
    if not small:
        return None
    return "data:image/webp;base64," + base64.b64encode(small).decode("ascii")


def pick_source_data_url(item: dict[str, Any]) -> str | None:
    """Return the highest-fidelity data URL we have for ``item``.

    Priority (best to worst):

      1. ``reconstructed_image_url`` — Nano-Banana / studio reshoot.
         Hand-edited, highest quality, opaque PNG.
      2. ``clean_image_url`` — rembg background matte (Phase O.6
         deferred BackgroundTask). Transparent PNG, background
         removed, no semantic refinement. *Added in May 2026 — this
         entry was previously missing, which caused every item that
         went through the deferred-rembg pipeline to keep its
         full-background JPEG bbox thumbnail forever even after
         rembg succeeded.*
      3. ``segmented_image_url`` — legacy synchronous SegFormer
         cutout. Pre-Phase-O.6 path; rare on new items but still
         valid for older ones.
      4. ``original_image_url`` — the raw upload / bbox crop with
         full background. The "we tried our best, here's what we
         got" fallback.

    Only returns values that look like ``data:image/...`` URLs;
    anything already pointing at a CDN is passed through untouched
    elsewhere.
    """
    for key in (
        "reconstructed_image_url",
        "clean_image_url",
        "segmented_image_url",
        "original_image_url",
    ):
        v = item.get(key)
        if isinstance(v, str) and v.startswith("data:image"):
            return v
    return None


async def ensure_thumbnail_and_placeholder(item: dict[str, Any]) -> tuple[str | None, str | None]:
    """Return a WebP thumbnail and WebP placeholder data URL for ``item``, generating them if absent.

    Does **not** touch the database — caller is responsible for persisting the results.
    """
    existing_thumb = item.get("thumbnail_data_url")
    existing_place = item.get("placeholder_data_url")
    source = pick_source_data_url(item)

    thumb = existing_thumb
    place = existing_place

    # Only generate if thumbnail / placeholder is missing
    need_thumb = not isinstance(existing_thumb, str) or not existing_thumb.startswith("data:image")
    need_place = not isinstance(existing_place, str) or not existing_place.startswith("data:image")

    if (need_thumb or need_place) and source:
        if need_thumb:
            thumb = await asyncio.to_thread(make_thumb_from_data_url, source)
        if need_place:
            place = await asyncio.to_thread(make_placeholder_from_data_url, source)

    return thumb, place


async def backfill_thumbnails(
    items: list[dict[str, Any]],
    *,
    concurrency: int = 4,
) -> list[tuple[str, str | None, str | None]]:
    """Generate WebP thumbnails and WebP placeholders for any items missing them.
    Returns ``(item_id, thumb, placeholder)`` triples so the caller can persist them.

    Runs with bounded concurrency to limit CPU usage.
    """
    sem = asyncio.Semaphore(concurrency)

    async def _one(it: dict[str, Any]) -> tuple[str, str | None, str | None] | None:
        async with sem:
            thumb, place = await ensure_thumbnail_and_placeholder(it)
        
        thumb_changed = thumb != it.get("thumbnail_data_url")
        place_changed = place != it.get("placeholder_data_url")

        if not thumb_changed and not place_changed:
            return None

        if thumb:
            it["thumbnail_data_url"] = thumb
        if place:
            it["placeholder_data_url"] = place

        return (it.get("id", ""), thumb, place) if it.get("id") else None

    results = await asyncio.gather(*[_one(it) for it in items], return_exceptions=True)
    updates: list[tuple[str, str | None, str | None]] = []
    for r in results:
        if isinstance(r, tuple):
            updates.append(r)
    return updates
