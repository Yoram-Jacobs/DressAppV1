from __future__ import annotations
import logging
logger = logging.getLogger(__name__)
from .geometry import _resolve_bbox_pad_trbl_for_category, _MIN_CROP_AREA_PCT, _resolve_min_short_edge_pct_for_category

from typing import Any
import io
import numpy as np
from PIL import Image, ImageFilter

def _apply_fast_matte(crops: list[tuple[dict[str, Any], bytes, str]]) -> list[tuple[dict[str, Any], bytes, str]]:
    out = []
    for det, cbytes, mime in crops:
        mask_bbox = det.pop("_mask_bbox", None)
        human_bbox = det.pop("_human_mask_bbox", None)
        is_single = det.get("is_single_item", False)
        if is_single:
            # Keep the raw JPEG crop bytes as-is without queueing post-save rembg.
            det["defer_matte"] = False
            out.append((det, cbytes, mime))
            continue

        if mask_bbox is not None and mime == "image/jpeg":
            try:
                im = Image.open(io.BytesIO(cbytes)).convert("RGBA")
                if human_bbox is not None:
                    mask_bbox = np.where(human_bbox > 0, 0, mask_bbox)
                
                alpha = Image.fromarray((mask_bbox * 255).astype(np.uint8), mode="L")
                alpha = alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
                im.putalpha(alpha)
                
                buf = io.BytesIO()
                im.save(buf, format="PNG", optimize=False)
                cbytes = buf.getvalue()
                mime = "image/png"
            except Exception as exc:
                logger.info("fast_matte failed: %s", exc)
        det["defer_matte"] = False
        out.append((det, cbytes, mime))
    return out


def _shrink_for_vision(image_bytes: bytes, *, max_side: int = 768, q: int = 82) -> bytes:
    """Keep the API payload light; Gemini vision is happy with ~768px long side."""
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
    is_single_item: bool = False,
) -> tuple[bytes, tuple[int, int, int, int]] | None:
    """Return (cropped_jpeg_bytes, (x1,y1,x2,y2)) for a 0–1000 bbox.

    ``bbox_norm`` is ``[ymin, xmin, ymax, xmax]`` on a 0–1000 scale.
    Adds a small padding and clamps to the image bounds.

    Patch 12j (May 2026) — ``category`` selects the per-edge padding
    budget from :data:`_BBOX_PAD_TRBL_BY_CATEGORY`. Without a category
    we use the symmetric 4 % default (the Patch 12 budget) for
    backward compat. With a category, tight torso boundaries (top's
    bottom edge = waistline; bottom's top edge = waistline) shrink to
    0.5 % so the adjacent garment never enters the frame.

    If ``is_single_item`` is True, we bypass category asymmetric/negative
    padding and use a flat positive 4% padding all-around to ensure
    no garment edges are cut off.
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
    # Validate scale — expect 0..1000
    if not (0 <= xmin < xmax <= 1000 and 0 <= ymin < ymax <= 1000):
        return None
    if is_single_item:
        # We always want the full item image without any cropping or clipping.
        # Bypass bbox crop and return the full image coordinates.
        crop = img.copy()
        buf = io.BytesIO()
        crop.save(buf, format="JPEG", quality=88, optimize=True)
        return buf.getvalue(), (0, 0, w, h)

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


def _extract_garment_mask(img: Image.Image) -> np.ndarray:
    """Extract binary mask of garment (255 for garment, 0 for background).

    Works for both RGBA cutouts and RGB photos with neutral/solid backgrounds.
    """
    import cv2
    import numpy as np

    has_alpha = (
        img.mode in ("RGBA", "LA")
        or (img.mode == "P" and "transparency" in img.info)
    )
    if has_alpha:
        img_rgba = img.convert("RGBA")
        alpha = np.array(img_rgba.split()[-1])
        coverage = np.mean(alpha > 30)
        if 0.02 < coverage < 0.95:
            return (alpha > 30).astype(np.uint8) * 255

    # RGB fallback: segment by color contrast against corners/borders
    rgb = np.array(img.convert("RGB"))
    h, w = rgb.shape[:2]
    if h < 10 or w < 10:
        return np.ones((h, w), dtype=np.uint8) * 255

    border_pixels = np.concatenate([
        rgb[0, :],
        rgb[h - 1, :],
        rgb[:, 0],
        rgb[:, w - 1],
    ], axis=0).astype(np.float32)

    bg_color = np.median(border_pixels, axis=0)
    diff = rgb.astype(np.float32) - bg_color
    dist = np.sqrt(np.sum(diff ** 2, axis=2))
    mask = (dist > 22).astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    if num_labels > 1:
        min_area = (h * w) * 0.01
        clean_mask = np.zeros_like(mask)
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] >= min_area:
                clean_mask[labels == i] = 255
        if np.any(clean_mask):
            mask = clean_mask

    return mask


def _orient_and_deskew_garment(img: Image.Image, mask: np.ndarray | None = None) -> Image.Image:
    """Detect tilt/skew angle of the garment and rotate it upright.

    Uses bilateral mirror symmetry search. Garments are designed to be
    symmetric along their vertical spine. When rotated upright, the left
    and right halves achieve maximum overlap (IoU).
    """
    try:
        import numpy as np

        if mask is None:
            mask = _extract_garment_mask(img)

        pts = np.column_stack(np.where(mask > 20))
        if len(pts) < 100:
            return img

        mask_img = Image.fromarray(mask, mode="L")
        bbox = mask_img.getbbox()
        if not bbox or (bbox[2] - bbox[0] < 10) or (bbox[3] - bbox[1] < 10):
            return img

        mask_cropped = mask_img.crop(bbox)

        # Coarse search: -45 to +45 deg in steps of 3 deg
        best_angle = 0.0
        max_iou = -1.0

        for deg in range(-45, 48, 3):
            rot = mask_cropped.rotate(deg, resample=Image.NEAREST, expand=True)
            b = rot.getbbox()
            if not b:
                continue
            c = rot.crop(b).resize((100, 100), resample=Image.NEAREST)
            arr = np.array(c) > 0
            flipped = np.fliplr(arr)
            inter = np.sum(arr & flipped)
            union = np.sum(arr | flipped)
            iou = inter / float(max(1, union))
            if iou > max_iou:
                max_iou = iou
                best_angle = float(deg)

        # Fine search: best_angle +/- 2 deg in steps of 0.5 deg
        refined_angle = best_angle
        for offset in [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0]:
            deg = best_angle + offset
            if abs(deg) > 45:
                continue
            rot = mask_cropped.rotate(deg, resample=Image.NEAREST, expand=True)
            b = rot.getbbox()
            if not b:
                continue
            c = rot.crop(b).resize((120, 120), resample=Image.NEAREST)
            arr = np.array(c) > 0
            flipped = np.fliplr(arr)
            inter = np.sum(arr & flipped)
            union = np.sum(arr | flipped)
            iou = inter / float(max(1, union))
            if iou > max_iou:
                max_iou = iou
                refined_angle = deg

        if abs(refined_angle) > 2.0:
            img = img.rotate(refined_angle, resample=Image.BICUBIC, expand=True)
    except Exception as exc:
        logger.debug("_orient_and_deskew_garment failed: %s", exc)

    return img


def _fit_crop_to_card(
    crop_bytes: bytes,
    *,
    crop_mime: str = "image/jpeg",
    canvas_w: int = _CARD_CANVAS_W,
    canvas_h: int = _CARD_CANVAS_H,
) -> tuple[bytes, str]:
    """Rescale a per-item crop, deskew upright, extend to 90% canvas, and center.

    1. Extracts garment mask (works for both RGBA cutouts and RGB studio/phone photos).
    2. Aligns major symmetry axis straight upright.
    3. Crops tight to non-background garment boundaries.
    4. Dynamically scales with a 0.90 safety margin, reaching up to 1080px height.
    5. Centers on fixed 900x1200 portrait canvas.
    """
    try:
        img = Image.open(io.BytesIO(crop_bytes))
        img.load()
    except Exception:  # noqa: BLE001
        return crop_bytes, crop_mime

    try:
        import numpy as np
        mask = _extract_garment_mask(img)
        pts = np.column_stack(np.where(mask > 0))
        if len(pts) > 100:
            rgba = img.convert("RGBA")
            rgba.putalpha(Image.fromarray(mask, mode="L"))
            rgba = _orient_and_deskew_garment(rgba, mask=mask)
            bbox = rgba.getbbox()
            if bbox and (bbox[2] - bbox[0] > 4) and (bbox[3] - bbox[1] > 4):
                img = rgba.crop(bbox)
        else:
            has_alpha = (
                img.mode in ("RGBA", "LA")
                or (img.mode == "P" and "transparency" in img.info)
            )
            if has_alpha:
                img = img.convert("RGBA")
                img = _orient_and_deskew_garment(img)
                bbox = img.getbbox()
                if bbox and (bbox[2] - bbox[0] > 4) and (bbox[3] - bbox[1] > 4):
                    img = img.crop(bbox)
            else:
                img = img.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        logger.debug("_fit_crop_to_card extraction failed: %s", exc)

    iw, ih = img.size
    if iw <= 0 or ih <= 0:
        return crop_bytes, crop_mime

    # Scale-to-fit with a safety margin (0.90) so the item always has breathing room
    # and is never zoomed/stretched to touch the canvas edges, keeping it 100% visible.
    scale = min(canvas_w * 0.90 / float(iw), canvas_h * 0.90 / float(ih))
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
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        canvas.paste(img, (ox, oy), mask=img)
        buf = io.BytesIO()
        canvas.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), "image/png"
    except Exception:  # noqa: BLE001
        return crop_bytes, crop_mime


def fit_image_data_url_to_card(
    data_url: str | None,
    canvas_w: int = _CARD_CANVAS_W,
    canvas_h: int = _CARD_CANVAS_H,
) -> str | None:
    """Normalize a base64 data URL image to fit within a 900x1200 canvas with 0.90 safety margin."""
    if not data_url or not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        return data_url
    try:
        header, encoded = data_url.split(",", 1)
        mime = "image/png" if "png" in header.lower() else "image/jpeg"
        import base64
        raw_bytes = base64.b64decode(encoded.strip())
        fitted_bytes, fitted_mime = _fit_crop_to_card(raw_bytes, crop_mime=mime, canvas_w=canvas_w, canvas_h=canvas_h)
        fitted_b64 = base64.b64encode(fitted_bytes).decode("ascii")
        return f"data:{fitted_mime};base64,{fitted_b64}"
    except Exception:
        return data_url

