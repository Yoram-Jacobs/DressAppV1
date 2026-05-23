from __future__ import annotations
import logging
logger = logging.getLogger(__name__)
from .geometry import _resolve_bbox_pad_trbl_for_category, _MIN_CROP_AREA_PCT, _resolve_min_short_edge_pct_for_category

import io
from PIL import Image



def _shrink_for_vision(image_bytes: bytes, *, max_side: int = 1280, q: int = 82) -> bytes:
    """Keep the API payload light; Gemini vision is happy with ~1280px long side."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        has_alpha = (
            img.mode in ("RGBA", "LA")
            or (img.mode == "P" and "transparency" in img.info)
        )
        if has_alpha:
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img)
            img = bg
        else:
            img = img.convert("RGB")
        img.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=q, optimize=True)
        return buf.getvalue()
    except Exception:  # noqa: BLE001
        return image_bytes


def _crop_to_bbox(
    image_bytes: bytes,
    bbox_norm: list[int],
    *,
    category: str | None = None,
) -> tuple[bytes, tuple[int, int, int, int]] | None:
    """Return (cropped_jpeg_bytes, (x1,y1,x2,y2)) for a 0\u20131000 bbox.

    ``bbox_norm`` is ``[ymin, xmin, ymax, xmax]`` on a 0\u20131000 scale.
    Adds a small padding and clamps to the image bounds.

    Patch 12j (May 2026) — ``category`` selects the per-edge padding
    budget from :data:`_BBOX_PAD_TRBL_BY_CATEGORY`. Without a category
    we use the symmetric 4 % default (the Patch 12 budget) for
    backward compat. With a category, tight torso boundaries (top's
    bottom edge = waistline; bottom's top edge = waistline) shrink to
    0.5 % so the adjacent garment never enters the frame.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:  # noqa: BLE001
        return None
    w, h = img.size
    try:
        ymin, xmin, ymax, xmax = [int(v) for v in bbox_norm]
    except Exception:  # noqa: BLE001
        return None
    # Validate scale \u2014 expect 0..1000
    if not (0 <= xmin < xmax <= 1000 and 0 <= ymin < ymax <= 1000):
        return None
    pad_t, pad_r, pad_b, pad_l = _resolve_bbox_pad_trbl_for_category(category)
    x1 = max(0, int(xmin / 1000.0 * w - w * pad_l))
    y1 = max(0, int(ymin / 1000.0 * h - h * pad_t))
    x2 = min(w, int(xmax / 1000.0 * w + w * pad_r))
    y2 = min(h, int(ymax / 1000.0 * h + h * pad_b))
    if x2 - x1 <= 4 or y2 - y1 <= 4:
        return None
    area_pct = ((x2 - x1) * (y2 - y1)) / float(max(1, w * h))
    if area_pct < _MIN_CROP_AREA_PCT:
        return None
    # Per-category short-edge floor (purely percent-based). The
    # threshold scales with the source's short edge so the floor is
    # aspect-ratio invariant and resolution-invariant: a shoe at
    # 8 % of frame short edge passes whether the upload is 550 px
    # or 4000 px. Each category has its own percent because a
    # legitimate top occupies far more frame than a legitimate
    # accessory — using one global percent either dropped real
    # accessories (when set high enough to filter top phantoms) or
    # let through phantom slivers (when set low enough to keep
    # real accessories).
    cur_short = min(x2 - x1, y2 - y1)
    src_short = min(w, h)
    pct = _resolve_min_short_edge_pct_for_category(category)
    floor_px = int(pct * src_short)
    if cur_short < floor_px:
        logger.info(
            "_crop_to_bbox: dropping tiny crop short_edge=%d px "
            "(floor=%d px = %.1f%% of %d×%d source, "
            "category=%s) — likely SegFormer sliver of an "
            "adjacent garment",
            cur_short, floor_px, pct * 100, w, h, category,
        )
        return None
    crop = img.crop((x1, y1, x2, y2))
    buf = io.BytesIO()
    crop.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue(), (x1, y1, x2, y2)


# Minimum fraction of the crop that must be "solid" garment pixels
# (alpha >= 128, perceptually opaque) for the matte to ship to the UI.
# Below this threshold the cutout is empirically empty/near-empty —
# rembg failure on tiny crops, SegFormer phantom detections, or a
# crop where rembg only kept the background by mistake. Dropping
# these cards is preferable to shipping a blank white tile.
_PHANTOM_DROP_PCT = 0.05


def _solid_alpha_coverage(png_bytes: bytes) -> float | None:
    """Fraction of an RGBA PNG whose alpha channel is >= 128.

    Returns ``None`` when the bytes can't be decoded or the image
    is not RGBA (so the caller can skip the check without dropping
    the detection). The 128 threshold is the perceptual midpoint —
    pixels below it look translucent, above it look opaque.
    """
    try:
        img = Image.open(io.BytesIO(png_bytes))
        has_alpha = (
            img.mode in ("RGBA", "LA")
            or (img.mode == "P" and "transparency" in img.info)
        )
        if not has_alpha:
            return None
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        import numpy as _np
        arr = _np.asarray(img)
        if arr.ndim != 3 or arr.shape[2] != 4:
            return None
        return float((arr[:, :, 3] >= 128).mean())
    except Exception:  # noqa: BLE001
        return None


# Frontend card window aspect (`aspect-[3/4]` in AddItem.jsx). The
# canvas dimensions below preserve that 3:4 portrait ratio at a
# resolution that's large enough to look crisp on retina displays
# yet small enough to keep the streamed `items_meta` payload light.
_CARD_CANVAS_W = 900
_CARD_CANVAS_H = 1200


def _fit_crop_to_card(
    crop_bytes: bytes,
    *,
    crop_mime: str = "image/jpeg",
    canvas_w: int = _CARD_CANVAS_W,
    canvas_h: int = _CARD_CANVAS_H,
) -> tuple[bytes, str]:
    """Rescale a per-item crop and center it on a fixed-aspect canvas.

    The frontend renders each garment card inside an
    ``aspect-[3/4]`` portrait window with ``object-cover``. Without
    normalisation, crop bytes coming out of the pipeline span a wide
    range of aspect ratios:

      * wide footwear / belt crops → ``object-cover`` clips the heel
        and toe out of view;
      * narrow earring / strap crops → the item shrinks to a thin
        sliver inside the card;
      * the rembg matte from a tiny-bbox accessory can come back at
        full source resolution (rembg composites alpha onto the
        original full-res RGB), so the card receives a multi-MB
        image where the visible garment occupies only a fraction of
        the frame.

    This helper produces a uniform 3:4 portrait canvas containing
    the crop, scaled to fit (either up OR down) so the longer side
    of the garment touches the canvas edge, then centered. Aspect
    ratio is always preserved so the item never gets squished or
    clipped. RGBA inputs preserve their alpha on a fully transparent
    canvas; RGB inputs are pasted onto a neutral white canvas and
    stay JPEG. Returns ``(out_bytes, out_mime)``.

    Example: a 25x120 shoe matte → upscaled to 250x1200 (the larger
    side hits the canvas height), then centered horizontally on the
    900x1200 canvas with ~325px of transparent padding on each side.

    On any decode / re-encode failure we fall back to the original
    bytes + mime so a single bad crop can never break the response.
    """
    try:
        img = Image.open(io.BytesIO(crop_bytes))
        img.load()
    except Exception:  # noqa: BLE001
        return crop_bytes, crop_mime

    has_alpha = (
        img.mode in ("RGBA", "LA")
        or (img.mode == "P" and "transparency" in img.info)
    )
    try:
        if has_alpha:
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
    except Exception:  # noqa: BLE001
        return crop_bytes, crop_mime

    iw, ih = img.size
    if iw <= 0 or ih <= 0:
        return crop_bytes, crop_mime

    # Scale-to-fit the canvas: choose the smaller of the two ratios so
    # the entire crop is visible (no clipping) and the longer side
    # touches the canvas edge. **No upper cap of 1.0** — small bbox
    # crops (a 25x120 shoe matte from a far-away product photo) get
    # upscaled to fill the card window (e.g. 250x1200) instead of
    # rendering as a tiny dot on a mostly-empty canvas. LANCZOS keeps
    # the upscale acceptably smooth on the modest 5-10x factors we
    # see in practice.
    scale = min(canvas_w / float(iw), canvas_h / float(ih))
    new_w = max(1, int(round(iw * scale)))
    new_h = max(1, int(round(ih * scale)))
    if (new_w, new_h) != (iw, ih):
        try:
            img = img.resize((new_w, new_h), Image.LANCZOS)
        except Exception:  # noqa: BLE001
            return crop_bytes, crop_mime

    ox = (canvas_w - new_w) // 2
    oy = (canvas_h - new_h) // 2

    try:
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        # Support pasting both RGB and RGBA correctly
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        canvas.paste(img, (ox, oy))
        buf = io.BytesIO()
        canvas.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), "image/png"
    except Exception:  # noqa: BLE001
        return crop_bytes, crop_mime
