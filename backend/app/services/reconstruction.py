"""Wardrobe Reconstructor (Phase Q).

Takes a potentially-bad garment crop (from the multi-item extractor or a
single upload) and decides whether it needs reconstruction. When it does,
we use **Nano Banana** (`gemini-2.5-flash-image`, native Google SDK,
requires ``GEMINI_API_KEY``). The earlier HF FLUX.1-schnell fallback was
removed in May 2026 along with the rest of the HF runtime surface — if
the direct Gemini key is absent, reconstruction returns ``None`` so the
caller keeps the original crop.

Public API
----------
* ``should_reconstruct(analysis, bbox, frame_size) -> (bool, list[str])``
  Fast, local heuristics. Returns ``(needs_repair, reasons)``.
* ``reconstruct(crop_bytes, analysis, *, validate=True) -> dict | None``
  Runs the reconstructor with a composed prompt and (optionally)
  sanity-checks the output by re-analysing the generated image. Returns
  ``{image_b64, mime_type, prompt, validated, rejected_reason}`` or
  ``None`` on unrecoverable failure.

All calls soft-fail so the upstream analyse pipeline never errors because
of a reconstruction hiccup.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.gemini_image_service import gemini_image_service

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------- heuristics

# A bbox side within this many normalised units of the frame edge is
# considered "touching" (the detector couldn't see beyond the frame).
_EDGE_TOUCH_MARGIN = 40  # on the 0..1000 Gemini scale = 4% of frame.

# Category priors for expected crop aspect ratio (height / width).
# Used to catch the "squareish dress crop" case where the detector
# clipped the hem and produced a too-wide bbox.
_CATEGORY_ASPECT_MIN = {
    "dress": 1.15,
    "outerwear": 1.05,
    "top": 0.80,
    "bottom": 1.00,
    "shoes": 0.55,
    "footwear": 0.55,
    "accessory": 0.40,
    "bag": 0.60,
}

# If a crop covers less than this fraction of the frame AND it was
# detected as a large-category piece (dress/outerwear/bottom), we
# consider it under-captured.
_SMALL_CROP_THRESHOLD = 0.12
_LARGE_CATEGORIES = {"dress", "outerwear", "bottom"}


def _norm_category(raw: str | None) -> str:
    return (raw or "").strip().lower()


def should_reconstruct(
    analysis: dict[str, Any],
    bbox_norm: list[int] | None,
    frame_size: tuple[int, int] | None = None,
) -> tuple[bool, list[str]]:
    """Decide whether a crop should be sent to the reconstructor.

    Uses Gemini's visual Quality Checker (``image_quality_status``) as the primary
    decision maker, falling back to geometric bbox heuristics if unpopulated.

    Args:
        analysis: the GarmentAnalysis JSON produced by The Eyes
          (contains ``image_quality_status``, ``image_quality_reason``,
          ``category``, etc.).
        bbox_norm: ``[ymin, xmin, ymax, xmax]`` on the 0..1000 Gemini
          scale.
        frame_size: (w, h) of the original uploaded image.

    Returns:
        ``(needs_repair, reasons)`` — ``reasons`` is a list of short
        string tokens suitable for logging / UI display.
    """
    del frame_size  # reserved for future pixel-level checks
    reasons: list[str] = []

    from app.config import settings as _settings
    if not _settings.ENABLE_RECONSTRUCTION:
        return False, reasons

    # 1. Primary: Visual Quality Checker assessment from Gemini / The Eyes
    quality_status = analysis.get("image_quality_status")
    if quality_status:
        q_norm = quality_status.strip().lower()
        if q_norm in ("needs_completion", "completion"):
            reason_txt = analysis.get("image_quality_reason") or "needs_completion"
            return True, ["quality_checker:needs_completion", f"reason:{reason_txt}"]
        if q_norm in ("needs_reconstruction", "reconstruction", "full_reconstruction"):
            reason_txt = analysis.get("image_quality_reason") or "needs_reconstruction"
            return True, ["quality_checker:needs_reconstruction", f"reason:{reason_txt}"]
        if q_norm == "complete":
            # Safety check: if the bounding box touches an image boundary on a sub-crop (area_frac < 0.85),
            # the crop is physically cut off by the camera frame, so override to needs_completion.
            if bbox_norm and len(bbox_norm) == 4:
                try:
                    ymin, xmin, ymax, xmax = [int(v) for v in bbox_norm]
                    area_frac = (max(1, xmax - xmin) * max(1, ymax - ymin)) / (1000.0 * 1000.0)
                    if area_frac < 0.85 and (
                        ymin <= _EDGE_TOUCH_MARGIN or xmin <= _EDGE_TOUCH_MARGIN or 
                        ymax >= 1000 - _EDGE_TOUCH_MARGIN or xmax >= 1000 - _EDGE_TOUCH_MARGIN
                    ):
                        return True, ["quality_checker:edge_touch_completion", "reason:Frame boundary cut off"]
                except (TypeError, ValueError):
                    pass
            return False, ["quality_checker:complete"]

    # 2. Fallback: Geometric BBox heuristics (when quality checker is absent / legacy)
    if not bbox_norm or len(bbox_norm) != 4:
        return False, reasons

    try:
        ymin, xmin, ymax, xmax = [int(v) for v in bbox_norm]
    except (TypeError, ValueError):
        return False, reasons

    width = max(1, xmax - xmin)
    height = max(1, ymax - ymin)
    area = width * height
    area_frac = area / (1000.0 * 1000.0)
    aspect = height / float(width)
    category = _norm_category(analysis.get("category"))

    # Rule 1: a near-full-frame bbox means the user uploaded an already
    # clean product shot. Per spec: "Neglect item images that show the
    # whole item without bg and without other items."
    if area_frac >= 0.85:
        return False, ["whole_frame_skip"]

    # Rule 2: bbox touching any edge -> garment likely extends off-canvas.
    if ymin <= _EDGE_TOUCH_MARGIN:
        reasons.append("edge_touch_top")
    if xmin <= _EDGE_TOUCH_MARGIN:
        reasons.append("edge_touch_left")
    if ymax >= 1000 - _EDGE_TOUCH_MARGIN:
        reasons.append("edge_touch_bottom")
    if xmax >= 1000 - _EDGE_TOUCH_MARGIN:
        reasons.append("edge_touch_right")

    # Rule 3: aspect-ratio mismatch against the expected category prior.
    if category in _CATEGORY_ASPECT_MIN:
        min_aspect = _CATEGORY_ASPECT_MIN[category]
        # Only flag dresses/outerwear/bottoms when they came back too
        # wide; being TALLER than the prior is always fine.
        if category in _LARGE_CATEGORIES and aspect < min_aspect * 0.85:
            reasons.append(f"aspect_mismatch_{category}")

    # Rule 4: tiny crop of a large-category garment.
    if category in _LARGE_CATEGORIES and area_frac < _SMALL_CROP_THRESHOLD:
        reasons.append("undersized_crop")

    return (len(reasons) > 0), reasons


# --------------------------------------------------------------------- generator

def _build_reconstruction_prompt(analysis: dict[str, Any]) -> str:
    """Compose a high-fidelity product-shot prompt from an analysis."""
    custom_prompt = analysis.get("reconstruction_prompt")
    if custom_prompt and isinstance(custom_prompt, str) and len(custom_prompt.strip()) > 10:
        return custom_prompt.strip()[:1000]

    bits: list[str] = []
    for key in ("color", "material", "pattern", "sub_category", "item_type"):
        v = analysis.get(key)
        if v:
            bits.append(str(v))
    descriptor = " ".join(bits) if bits else (
        analysis.get("category") or "garment"
    )
    extras: list[str] = []
    if analysis.get("dress_code"):
        extras.append(f"{analysis['dress_code']} style")
    extras_str = (", " + ", ".join(extras)) if extras else ""
    prompt = (
        f"High-fidelity editorial product photograph of a complete, "
        f"full-length {descriptor}"
        f"{extras_str}. Studio lighting, plain off-white backdrop, "
        "garment-only product shot, centered composition, sharp focus, "
        "photorealistic, preserve fabric texture and pattern details, "
        "no text, no logos, no watermarks."
    )
    return prompt[:1000]


async def reconstruct(
    crop_bytes: bytes,
    analysis: dict[str, Any],
    *,
    reasons: list[str] | None = None,
    validate: bool = True,
) -> dict[str, Any] | None:
    """Run the Nano Banana reconstructor on a crop and return a data payload.

    Routes between image completion (edit) and full reconstruction (generate)
    based on the Quality Checker status.
    """
    # Reconstruction now runs only on Nano Banana (`gemini-2.5-flash-image`).
    # The legacy HF FLUX.1-schnell fallback was retired in May 2026 — if no
    # direct ``GEMINI_API_KEY`` is configured we return ``None`` and the
    # caller keeps the original crop.
    if gemini_image_service is None:
        return None
    image_service = gemini_image_service
    using = "nano-banana"
    
    # Pre-matte the image to remove people/legs/hands and prevent safety blocks
    try:
        from app.services.background_matting import remove_background
        from PIL import Image
        import io
        bg_res = await remove_background(crop_bytes)
        if bg_res.get("success") and bg_res.get("image_png"):
            matte_img = Image.open(io.BytesIO(bg_res["image_png"]))
            # Ensure it is in RGBA mode for alpha compositing
            if matte_img.mode != "RGBA":
                matte_img = matte_img.convert("RGBA")
            off_white = Image.new("RGBA", matte_img.size, (245, 245, 245, 255))
            composited = Image.alpha_composite(off_white, matte_img).convert("RGB")
            matted_io = io.BytesIO()
            composited.save(matted_io, format="JPEG", quality=95)
            crop_bytes = matted_io.getvalue()
    except Exception as matte_exc:
        logger.warning("Reconstruction pre-matting failed: %s", repr(matte_exc))

    prompt = _build_reconstruction_prompt(analysis)
    quality_status = (analysis.get("image_quality_status") or "").strip().lower()

    # Route: Full reconstruction from scratch vs inpainting completion
    if quality_status in ("needs_reconstruction", "reconstruction", "full_reconstruction"):
        try:
            out = await image_service.generate(prompt)
        except Exception as gen_exc:
            logger.warning(
                "Full reconstruction generate failed, attempting image edit fallback: %s",
                repr(gen_exc)[:200],
            )
            try:
                out = await image_service.edit(
                    crop_bytes,
                    prompt,
                    garment_metadata={
                        "title": analysis.get("title"),
                        "category": analysis.get("category"),
                        "sub_category": analysis.get("sub_category"),
                        "color": analysis.get("color"),
                        "material": analysis.get("material"),
                        "pattern": analysis.get("pattern"),
                        "brand": analysis.get("brand"),
                    },
                )
            except Exception as edit_exc:
                logger.error("Reconstruction edit fallback also failed: %s", repr(edit_exc))
                return None
    else:
        # Default or "needs_completion": inpaint/outpaint missing edges/collars/sleeves
        try:
            out = await image_service.edit(
                crop_bytes,
                prompt,
                garment_metadata={
                    "title": analysis.get("title"),
                    "category": analysis.get("category"),
                    "sub_category": analysis.get("sub_category"),
                    "color": analysis.get("color"),
                    "material": analysis.get("material"),
                    "pattern": analysis.get("pattern"),
                    "brand": analysis.get("brand"),
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Reconstruction edit failed (engine=%s), falling back to text-to-image generation: %s",
                using,
                repr(exc)[:200],
            )
            try:
                out = await image_service.generate(prompt)
            except Exception as gen_exc:
                logger.error("Reconstruction fallback text-to-image generation also failed: %s", repr(gen_exc))
                return None
    image_b64 = out.get("image_b64")
    if not image_b64:
        return None

    validated = True
    rejected_reason: str | None = None
    if validate and not (reasons and "manual_repair" in reasons):
        try:
            import base64 as _b64
            from app.services.vision import garment_vision_service

            if garment_vision_service is not None:
                generated_bytes = _b64.b64decode(image_b64)
                new_analysis = await garment_vision_service.analyze(
                    generated_bytes,
                    model=garment_vision_service.crop_model,
                )
                orig_cat = _norm_category(analysis.get("category"))
                new_cat = _norm_category(new_analysis.get("category"))
                # Accept only when the top-level category still matches.
                # sub_category / item_type drift is OK.
                if orig_cat and new_cat and orig_cat != new_cat:
                    validated = False
                    rejected_reason = (
                        f"category drift {orig_cat!r} -> {new_cat!r}"
                    )
                    logger.info("Reconstruction rejected: %s", rejected_reason)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Reconstruction validation skipped (analyze failed): %s",
                repr(exc)[:160],
            )

    return {
        "image_b64": image_b64,
        "mime_type": out.get("mime_type", "image/png"),
        "prompt": prompt,
        "model": out.get("model_used"),
        "engine": using,
        "reasons": reasons or [],
        "validated": validated,
        "rejected_reason": rejected_reason,
    }
