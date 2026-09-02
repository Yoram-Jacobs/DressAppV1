"""backend/app/services/garment_visuals.py

Deep module: Garment Visuals & Cutout Pipeline.

Consolidates all image decoding, background matting (with automatic fallback),
transparent PNG cutout caching, compression, and alpha-preserving thumbnail
generation behind a small, robust 2-method interface.

Interface:
  - process_raw_upload(image_input, *, generate_cutout=True, max_dim=1024) -> ProcessedVisuals
  - ensure_transparent_cutout(image_input) -> str | None
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
from dataclasses import dataclass
from typing import Any

from PIL import Image

from app.services.background_matting import matte_crop, remove_background
from app.services.thumbnails import (
    _downsize_bytes,
    _has_meaningful_alpha,
    make_placeholder_from_data_url,
    make_thumb_from_data_url,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessedVisuals:
    """Standardized visual bundle for any garment."""
    original_image_url: str
    clean_image_url: str | None
    thumbnail_data_url: str | None
    placeholder_data_url: str | None
    clean_image_status: str  # "ready" | "failed" | "skipped"
    raw_bytes: bytes


class GarmentVisuals:
    """Deep module for all garment image processing, matting, and thumbnailing."""

    @staticmethod
    def _extract_bytes(image_input: bytes | str) -> tuple[bytes | None, str | None]:
        """Extract raw bytes and mime type from bytes, base64 string, or data URL."""
        if isinstance(image_input, bytes):
            return image_input, "image/png"
        if not isinstance(image_input, str):
            return None, None
        if image_input.startswith("data:"):
            try:
                header, b64 = image_input.split(",", 1)
                mime = header.split(";")[0].replace("data:", "") or "image/png"
                return base64.b64decode(b64), mime
            except Exception:
                return None, None
        try:
            return base64.b64decode(image_input), "image/png"
        except Exception:
            return None, None

    @classmethod
    async def ensure_transparent_cutout(cls, image_input: bytes | str) -> str | None:
        """Extract an isolated, transparent PNG cutout with alpha channel.

        Tries primary matting (remove_background) and automatically falls back
        to lightweight rembg (matte_crop) if the primary check fails.
        Guarantees that garments layer seamlessly without background boxes.
        """
        raw_bytes, _ = cls._extract_bytes(image_input)
        if not raw_bytes:
            return None

        try:
            # 1. Primary matting
            clean_res = await remove_background(raw_bytes)
            matted_png = clean_res.get("image_png") if isinstance(clean_res, dict) else None

            # 2. Secondary fallback
            if not matted_png:
                matted_png = await matte_crop(raw_bytes)

            if matted_png:
                from app.services.vision.image import _fit_crop_to_card
                fitted_png, _ = _fit_crop_to_card(matted_png, crop_mime="image/png")
                b64 = base64.b64encode(fitted_png).decode("ascii")
                return f"data:image/png;base64,{b64}"
        except Exception as exc:
            logger.warning("GarmentVisuals transparent cutout extraction failed: %s", exc)

        return None

    @classmethod
    async def process_raw_upload(
        cls,
        image_input: bytes | str,
        *,
        generate_cutout: bool = True,
        max_dim: int = 1024,
    ) -> ProcessedVisuals:
        """Process an uploaded photo or bounding-box crop.

        - Decodes and compresses original image
        - Generates clean transparent cutout (if requested)
        - Produces alpha-preserving WebP thumbnail and progressive placeholder
        """
        raw_bytes, mime = cls._extract_bytes(image_input)
        if not raw_bytes:
            raise ValueError("Invalid image input: could not decode bytes")

        # 1. Compress original image to max_dim JPEG/WebP
        compressed_original_b64: str
        try:
            pil_img = Image.open(io.BytesIO(raw_bytes))
            if pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info):
                pil_img = pil_img.convert("RGBA")
                pil_img.thumbnail((max_dim, max_dim), Image.LANCZOS)
                buf = io.BytesIO()
                pil_img.save(buf, format="PNG", optimize=True)
                compressed_original_b64 = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"
            else:
                pil_img = pil_img.convert("RGB")
                pil_img.thumbnail((max_dim, max_dim), Image.LANCZOS)
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG", quality=82, optimize=True)
                compressed_original_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"
        except Exception as e:
            logger.warning("Original image compression failed, using raw: %s", e)
            compressed_original_b64 = (
                image_input
                if isinstance(image_input, str) and image_input.startswith("data:")
                else f"data:image/jpeg;base64,{base64.b64encode(raw_bytes).decode('ascii')}"
            )

        # 2. Transparent Cutout
        clean_url: str | None = None
        status = "skipped"
        if generate_cutout:
            clean_url = await cls.ensure_transparent_cutout(raw_bytes)
            status = "ready" if clean_url else "failed"

        # 3. Alpha-preserving Thumbnail & Placeholder
        source_for_thumb = clean_url or compressed_original_b64
        thumb_url = make_thumb_from_data_url(source_for_thumb)
        place_url = make_placeholder_from_data_url(source_for_thumb)

        return ProcessedVisuals(
            original_image_url=compressed_original_b64,
            clean_image_url=clean_url,
            thumbnail_data_url=thumb_url,
            placeholder_data_url=place_url,
            clean_image_status=status,
            raw_bytes=raw_bytes,
        )


# ─── Garment image URL resolver ───────────────────────────────────────────────
#
# Python twin of resolveGarmentImageUrl in apps/mobile/src/lib/imageUtils.ts.
#
# Selects the best available display URL from any Garment / closet-item dict,
# filtering out Python "None" strings, JSON "null" strings, and empty values.
#
# prefer:
#   "cutout"    (default) — reconstructed → clean_image_url → segmented → variants → original → thumb
#   "original"  — original_image_url → image_url → variants → reconstructed → cutout → thumb
#   "thumbnail" — thumbnail_data_url → placeholder → reconstructed → cutout → original

_SENTINEL_STRINGS: frozenset[str] = frozenset({"None", "null", "undefined", "[object Object]", ""})


def _valid(url: str | None) -> str | None:
    """Return url only if it is a non-empty, non-sentinel string."""
    if not url or not isinstance(url, str):
        return None
    t = url.strip()
    return None if t in _SENTINEL_STRINGS else t


def _variants_url(item: dict) -> str | None:
    variants = item.get("image_variants") or {}
    return (
        _valid(variants.get("webp", {}).get("large"))
        or _valid(variants.get("webp", {}).get("medium"))
        or _valid(variants.get("avif", {}).get("medium"))
        or _valid(variants.get("original"))
        or None
    )


def resolve_garment_image_url(
    item: dict | None,
    prefer: str = "cutout",
) -> str | None:
    """Return the best display URL for a Garment dict, or None if nothing is available."""
    if not isinstance(item, dict):
        return None

    recon   = _valid(item.get("reconstructed_image_url"))
    cutout = (
        _valid(item.get("clean_image_url"))
        or _valid(item.get("segmented_image_url"))
        or _valid(item.get("cutout_url"))
    )
    variant = _variants_url(item)
    orig    = _valid(item.get("original_image_url")) or _valid(item.get("image_url"))
    thumb   = _valid(item.get("thumbnail_data_url")) or _valid(item.get("placeholder_data_url"))

    if prefer == "thumbnail":
        return thumb or recon or cutout or variant or orig
    if prefer == "original":
        return orig or variant or recon or cutout or thumb
    # "cutout" (default)
    return recon or cutout or variant or orig or thumb