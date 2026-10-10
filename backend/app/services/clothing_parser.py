"""Clothing parser — per-class semantic segmentation for garments.

Phase V (Fix round 2 — April 2026):
HF serverless `api-inference.huggingface.co` has been retired and the new
`router.huggingface.co/hf-inference` provider does not support custom
community models like `sayeed99/segformer_b3_clothes`. We now run the
model locally via `transformers` on CPU — one-time ~180 MB download,
cached in-process. First call warms the model (≈5 s on this pod),
subsequent calls are ≈2-4 s per image.

Execution order (first hit wins):
  1. Self-hosted endpoint (`CLOTHING_PARSER_ENDPOINT_URL`) — future
     `dressapp.co` GPU box; contract: POST multipart `image` → JSON
     `{segments: [{label, mask (PNG b64), bbox[y,x,y,x 0-1000]?}, ...]}`.
  2. Local transformers + torch CPU (primary).

The function never raises on bad inputs — returns `[]` so the caller
(garment_vision) can fall back to the Gemini detector.

Bounding-box convention: `[ymin, xmin, ymax, xmax]` on a 0..1000 scale
(matches the rest of the pipeline / `_crop_to_bbox`). A `mask` field
(full-size numpy uint8 binary) is also returned so callers can build
alpha-cutout crops rather than raw bbox crops.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import threading
import time
from typing import Any

import httpx
import numpy as np
from PIL import Image, ImageFilter

from app.config import settings
from app.services import provider_activity

logger = logging.getLogger(__name__)

# Clean canonical labels for output to client & downstream pipeline
_CANONICAL_LABEL: dict[str, str] = {
    # sayeed99/segformer-b3-fashion (47 classes)
    "shirt, blouse": "shirt",
    "top, t-shirt, sweatshirt": "t-shirt",
    "sweater": "sweater",
    "cardigan": "cardigan",
    "jacket": "jacket",
    "vest": "vest",
    "pants": "pants",
    "shorts": "shorts",
    "skirt": "skirt",
    "coat": "coat",
    "dress": "dress",
    "jumpsuit": "jumpsuit",
    "cape": "cape",
    "glasses": "sunglasses",
    "hat": "hat",
    "headband, head covering, hair accessory": "headwear",
    "tie": "tie",
    "glove": "gloves",
    "watch": "watch",
    "belt": "belt",
    "leg warmer": "leg warmers",
    "tights, stockings": "tights",
    "sock": "socks",
    "shoe": "shoes",
    "bag, wallet": "bag",
    "scarf": "scarf",
    # Legacy ATR (sayeed99/segformer_b3_clothes)
    "Upper-clothes": "upper_clothes",
    "Left-shoe": "shoes",
    "Right-shoe": "shoes",
}

# Sub-parts that belong to a parent garment and should be absorbed into adjacent garments:
_SUBPART_CLASSES = frozenset({
    "sleeve", "collar", "lapel", "epaulette", "pocket", "neckline",
    "buckle", "zipper", "applique", "bead", "bow", "flower", "fringe",
    "ribbon", "rivet", "ruffle", "sequin", "tassel", "hood",
})
_UPPER_SUBPART_CLASSES = frozenset({
    "sleeve", "collar", "lapel", "epaulette", "neckline", "hood",
})
_UPPER_GARMENT_CATEGORIES = frozenset({"top", "outerwear", "dress", "suit", "fullbody"})


# Class label → internal category mapping.
# Handles both ATR dataset (18 classes) and Fashion dataset (47 classes).
_LABEL_MAP: dict[str, str | None] = {
    # ATR dataset classes (sayeed99/segformer_b3_clothes)
    "Background": None,
    "background": None,
    "Hat": "headwear",
    "hat": "headwear",
    "Hair": None,
    "hair": None,
    "Sunglasses": "accessory",
    "sunglasses": "accessory",
    "Upper-clothes": "top",
    "upper-clothes": "top",
    "Skirt": "bottom",
    "skirt": "bottom",
    "Pants": "bottom",
    "pants": "bottom",
    "Dress": "dress",
    "dress": "dress",
    "Belt": "accessory",
    "belt": "accessory",
    "Left-shoe": "footwear",
    "left-shoe": "footwear",
    "Right-shoe": "footwear",
    "right-shoe": "footwear",
    "Face": None,
    "face": None,
    "Left-leg": None,
    "left-leg": None,
    "Right-leg": None,
    "right-leg": None,
    "Left-arm": None,
    "left-arm": None,
    "Right-arm": None,
    "right-arm": None,
    "Bag": "accessory",
    "bag": "accessory",
    "Scarf": "accessory",
    "scarf": "accessory",

    # sayeed99/segformer-b3-fashion (47 classes with layering)
    "unlabelled": None,
    "shirt, blouse": "top",
    "top, t-shirt, sweatshirt": "top",
    "sweater": "top",
    "cardigan": "outerwear",
    "jacket": "outerwear",
    "vest": "top",
    "shorts": "bottom",
    "coat": "outerwear",
    "jumpsuit": "dress",
    "cape": "outerwear",
    "glasses": "accessory",
    "headband, head covering, hair accessory": "headwear",
    "tie": "accessory",
    "glove": "accessory",
    "watch": "accessory",
    "leg warmer": "accessory",
    "tights, stockings": "bottom",
    "sock": "footwear",
    "shoe": "footwear",
    "bag, wallet": "accessory",
    "umbrella": None,
    "hood": None,
    "collar": None,
    "lapel": None,
    "epaulette": None,
    "sleeve": None,
    "pocket": None,
    "neckline": None,
    "buckle": None,
    "zipper": None,
    "applique": None,
    "bead": None,
    "bow": None,
    "flower": None,
    "fringe": None,
    "ribbon": None,
    "rivet": None,
    "ruffle": None,
    "sequin": None,
    "tassel": None,
}


def _get_label_category(label_name: str | None) -> str | None:
    """Return the internal category for a class label in a case-tolerant manner."""
    if not label_name:
        return None
    return _LABEL_MAP.get(label_name) or _LABEL_MAP.get(label_name.strip().lower())

# SegFormer ATR classes that represent the WEARER'S BODY (not clothing).
_HUMAN_CLASS_NAMES = (
    "Face", "Hair",
    "Left-arm", "Right-arm",
    "Left-leg", "Right-leg",
)
# Minimum mask area (as fraction of total image) to consider a detection.
_MIN_AREA_FRAC_DEFAULT = 0.010       # tops, bottoms, dresses, outerwear
_MIN_AREA_FRAC_PER_CATEGORY: dict[str, float] = {
    "outerwear": 0.010,
    "top":       0.010,
    "bottom":    0.010,
    "dress":     0.010,
    "accessory": 0.0015,            # belts, bags, scarves (drops specks)
    "footwear":  0.0008,            # individual shoes/socks at full-body
    "headwear":  0.0010,            # hats in wide shots
}


def _min_area_frac_for(category: str | None, label: str | None = None) -> float:
    """Return the minimum-area fraction threshold for this internal category."""
    if label and any(w in str(label).lower() for w in ("glass", "sunglass", "eyewear")):
        return 0.0005  # sunglasses in full-body shots are legitimately small
    if category is None:
        return _MIN_AREA_FRAC_DEFAULT
    return _MIN_AREA_FRAC_PER_CATEGORY.get(category, _MIN_AREA_FRAC_DEFAULT)



# Max edge of the input fed to the model — 512 matches SegFormer's native resolution
# and keeps CPU memory under 300MB (1024 explodes quadratic attention to multiple GBs).
_MAX_INPUT_EDGE = 512

_HTTP_TIMEOUT = httpx.Timeout(60.0, connect=15.0)

# --- lazy singleton SegFormer model -------------------------------------
_model_lock = threading.Lock()
_model: Any = None
_processor: Any = None
_id2label: dict[int, str] = {}


def _load_model() -> None:
    global _model, _processor, _id2label
    if _model is not None:
        return
    with _model_lock:
        if _model is not None:
            return
        try:
            import torch  # noqa: F401
            from transformers import (
                SegformerForSemanticSegmentation,
                SegformerImageProcessor,
            )
        except (ImportError, Exception) as err:
            logger.warning(
                "clothing_parser: SegFormer / PyTorch dependencies unavailable (%s). "
                "Local inference will be skipped.",
                err,
            )
            raise RuntimeError(f"SegFormer dependencies unavailable: {err}") from err

        model_id = settings.CLOTHING_PARSER_MODEL
        t0 = time.time()
        logger.info(
            "clothing_parser: loading SegFormer %s locally (first call, ~180MB download on first warm-up)",
            model_id,
        )
        _processor = SegformerImageProcessor.from_pretrained(model_id)
        _model = SegformerForSemanticSegmentation.from_pretrained(model_id)
        # NOTE: ``.eval()`` here is PyTorch's nn.Module method that
        # puts the SegFormer into inference mode (disables dropout /
        # freezes batchnorm). It is NOT the Python builtin ``eval()``
        # — static analysers that grep for ``.eval(`` will
        # false-positive on this line. Do NOT "fix" by swapping in
        # ``ast.literal_eval`` (would break the entire clothing-parser
        # pipeline).
        _model.eval()
        _id2label = {int(k): v for k, v in _model.config.id2label.items()}
        logger.info(
            "clothing_parser: SegFormer ready in %.1fs (%d classes)",
            time.time() - t0,
            len(_id2label),
        )


def _resize_for_inference(pil: Image.Image) -> Image.Image:
    """Cap the longest side for faster CPU inference. Original-size masks
    are reconstructed by upsampling so we never lose fidelity at crop time."""
    w, h = pil.size
    m = max(w, h)
    if m <= _MAX_INPUT_EDGE:
        return pil
    scale = _MAX_INPUT_EDGE / float(m)
    return pil.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)


def _run_inference(pil_full: Image.Image) -> np.ndarray:
    """Return a class-id mask at the FULL original resolution with minimal memory usage."""
    _load_model()
    import gc
    import torch
    pil_small = _resize_for_inference(pil_full)
    inputs = _processor(images=pil_small, return_tensors="pt")
    with torch.no_grad():
        outputs = _model(**inputs)
    logits = outputs.logits
    import torch.nn.functional as F
    # Bilinear interpolation of logits up to model input resolution (<= 512x512)
    # before argmax eliminates blocky 128px nearest-neighbor sawtooth staircases.
    logits_up = F.interpolate(
        logits, size=(pil_small.size[1], pil_small.size[0]), mode="bilinear", align_corners=False
    )
    small_pred = logits_up.argmax(dim=1).squeeze(0).cpu().numpy().astype(np.uint8)  # (H', W')
    del inputs, outputs, logits, logits_up

    # Absorb fine-grained sub-parts (sleeves, collars, lapels, pockets, zippers, ruffles, etc.)
    # Upper-body subparts (sleeves, collars, lapels, hoods) must ONLY be absorbed into upper garments
    # (top, outerwear, dress, suit). They must NEVER be absorbed into pants, skirts, or shoes!
    upper_subpart_cids = {
        cid for cid, name in _id2label.items()
        if (name or "").lower() in _UPPER_SUBPART_CLASSES
    }
    other_subpart_cids = {
        cid for cid, name in _id2label.items()
        if (name or "").lower() in _SUBPART_CLASSES and (name or "").lower() not in _UPPER_SUBPART_CLASSES
    }
    all_subpart_cids = upper_subpart_cids | other_subpart_cids
    if all_subpart_cids and np.any(np.isin(small_pred, list(all_subpart_cids))):
        try:
            from scipy import ndimage
            # 1. Upper garment subparts (sleeve, collar, lapel, hood) -> upper garments only!
            if upper_subpart_cids and np.any(np.isin(small_pred, list(upper_subpart_cids))):
                upper_garment_cids = {
                    cid for cid, name in _id2label.items()
                    if _get_label_category(name) in _UPPER_GARMENT_CATEGORIES
                }
                upper_mask = np.isin(small_pred, list(upper_garment_cids))
                upper_sub_mask = np.isin(small_pred, list(upper_subpart_cids))
                if np.any(upper_mask):
                    dist, (ny, nx) = ndimage.distance_transform_edt(~upper_mask, return_indices=True)
                    max_reach = int(0.25 * min(small_pred.shape))
                    valid_dist = dist[upper_sub_mask] <= max_reach
                    sub_coords = np.where(upper_sub_mask)
                    sub_y, sub_x = sub_coords[0][valid_dist], sub_coords[1][valid_dist]
                    small_pred[sub_y, sub_x] = small_pred[ny[sub_y, sub_x], nx[sub_y, sub_x]]
                    unreach_y, unreach_x = sub_coords[0][~valid_dist], sub_coords[1][~valid_dist]
                    if len(unreach_y) > 0:
                        small_pred[unreach_y, unreach_x] = 0
                else:
                    small_pred[upper_sub_mask] = 0

            # 2. Universal subparts (pockets, zippers, ruffles) -> nearest adjacent garment
            if other_subpart_cids and np.any(np.isin(small_pred, list(other_subpart_cids))):
                garment_mask = (small_pred > 0) & (~np.isin(small_pred, list(all_subpart_cids)))
                if np.any(garment_mask):
                    dist, (ny, nx) = ndimage.distance_transform_edt(~garment_mask, return_indices=True)
                    other_sub_mask = np.isin(small_pred, list(other_subpart_cids))
                    small_pred[other_sub_mask] = small_pred[ny[other_sub_mask], nx[other_sub_mask]]
        except Exception as _sub_exc:  # noqa: BLE001
            logger.debug("clothing_parser: sub-part absorption skipped: %s", _sub_exc)

    # Scale single-channel integer mask to original image size with nearest-neighbor
    mask_img = Image.fromarray(small_pred)
    full_mask_img = mask_img.resize((pil_full.size[0], pil_full.size[1]), Image.NEAREST)
    pred = np.array(full_mask_img, dtype=np.uint8)
    del mask_img, full_mask_img, small_pred
    if pil_small is not pil_full:
        del pil_small
    gc.collect()
    return pred


# Patch 12e (May 2026) — pair-recovery thresholds for footwear.
#   * ``_PAIR_ASYMMETRY_THRESHOLD`` — if smaller_half_mass / larger_half_mass
#     is below this, the first-pass mask is suspect for a missing partner.
#   * ``_PAIR_OVERLAP_PCT`` — when re-cropping the source image to the
#     missing half, include this much of the *dominant* side so the
#     SegFormer model has anatomical context for the half it's parsing
#     (a lone leg-only crop often produces a 0-shoe result; a leg + a
#     glimpse of the other shoe usually fires correctly).
_PAIR_ASYMMETRY_THRESHOLD: float = 0.30
_PAIR_OVERLAP_PCT: float = 0.15


def _recover_paired_footwear(
    full_image: Image.Image,
    shoes_mask: np.ndarray,
) -> np.ndarray:
    """Patch 12e (May 2026) — Option B2 second-pass pair recovery.

    Detects whether a unified ``Shoes`` mask is anatomically asymmetric
    (one half of the frame carries < 30 % the mass of the other), and
    if so re-runs SegFormer on the *missing* half of the source image
    to look for the partner boot the first pass missed.

    Fidelity rule
    -------------
    If the second pass also returns nothing in the missing half (e.g.
    the photo is a profile shot, or the partner shoe is occluded by an
    object or the model's pose), the function returns the original
    mask unchanged. We never fabricate a partner the source photo
    doesn't show — staying loyal to the user's upload is explicitly
    required by product spec.

    Why a second SegFormer pass is needed
    -------------------------------------
    SegFormer's per-pixel argmax has a strong global prior: if one
    boot dominates the lower-frame footwear region, the model can
    under-confidently classify the partner boot as "Right-leg" /
    "Skin" / background. Cropping to a half-frame removes that prior
    and forces the model to reconsider; on a clean photo with two
    boots, the second pass routinely recovers the missed partner.

    Cost
    ----
    ~2-4 s of CPU inference per asymmetric footwear detection. Fires
    on a small fraction of uploads (only when symmetry is broken).
    No-op on photos where both boots were detected cleanly.
    """
    if shoes_mask is None or shoes_mask.size == 0:
        return shoes_mask
    H, W = shoes_mask.shape
    if H <= 0 or W <= 0:
        return shoes_mask
    mid = W // 2
    left_mass = int(shoes_mask[:, :mid].sum())
    right_mass = int(shoes_mask[:, mid:].sum())
    total_mass = left_mass + right_mass
    if total_mass == 0:
        return shoes_mask
    smaller = min(left_mass, right_mass)
    larger = max(left_mass, right_mass)
    if larger == 0 or (smaller / larger) >= _PAIR_ASYMMETRY_THRESHOLD:
        # Already balanced — both halves carry comparable mass.
        return shoes_mask

    missing_left = left_mass < right_mass
    overlap_px = int(W * _PAIR_OVERLAP_PCT)
    if missing_left:
        crop_x1, crop_x2 = 0, min(W, mid + overlap_px)
    else:
        crop_x1, crop_x2 = max(0, mid - overlap_px), W
    if crop_x2 - crop_x1 <= 4:
        return shoes_mask

    half_img = full_image.crop((crop_x1, 0, crop_x2, H))
    try:
        half_class_mask = _run_inference(half_img)
    except Exception as exc:  # noqa: BLE001
        logger.info(
            "_recover_paired_footwear: second-pass inference failed: %s",
            repr(exc)[:120],
        )
        return shoes_mask

    # Find every class id whose label looks like a shoe in this model.
    shoes_labels = {"Left-shoe", "Right-shoe", "Shoes"}
    shoes_class_ids = [
        cid for cid, label in _id2label.items() if label in shoes_labels
    ]
    if not shoes_class_ids:
        return shoes_mask
    half_shoes = np.zeros_like(half_class_mask, dtype=np.uint8)
    for cid in shoes_class_ids:
        half_shoes |= (half_class_mask == cid).astype(np.uint8)

    # Translate the half-image mask back to full-image coordinates and
    # restrict the union to the *missing* half only — the overlap zone
    # on the dominant side is already covered by the original mask.
    full_shoes_new = np.zeros_like(shoes_mask)
    full_shoes_new[:, crop_x1:crop_x2] = half_shoes
    if missing_left:
        full_shoes_new[:, mid:] = 0
    else:
        full_shoes_new[:, :mid] = 0

    new_mass = int(full_shoes_new.sum())
    if new_mass < max(64, int(0.0005 * H * W)):
        # Found nothing meaningful on the missing half → faithful to source.
        logger.info(
            "_recover_paired_footwear: second pass found no partner on the "
            "%s half (mass=%d px, threshold=%d px) — keeping single-boot mask "
            "faithful to the original photo",
            "left" if missing_left else "right",
            new_mass, max(64, int(0.0005 * H * W)),
        )
        return shoes_mask

    merged = np.maximum(shoes_mask, full_shoes_new).astype(np.uint8)
    logger.info(
        "_recover_paired_footwear: recovered missing partner on %s half "
        "(added %d px, mass %d → %d on %dx%d frame)",
        "left" if missing_left else "right",
        new_mass, int(shoes_mask.sum()), int(merged.sum()), W, H,
    )
    return merged


# Classes whose mask should be passed through ``_split_into_spatial_groups``:
# nearby fragments of a single object get merged, but two genuinely-
# separate items of the same class still ship as two cards.
#
# Upper-clothes / Dress / Skirt / Pants — anatomically the wearer can
# only have ONE per outfit, but SegFormer fragments their masks at
# high-contrast prints, belts, sashes, etc. (a graphic-print t-shirt
# can split into 2-5 disconnected components). Merging keeps the
# garment whole.
#
# Hat / Sunglasses / Belt / Bag / Scarf — usually ONE per outfit. The
# fragmentation pattern is different (a shoulder-bag strap fragments
# from the bag body because they cross the torso at different
# argmax-favoured colours; a long scarf can split where it drapes
# over the shoulder). Same merge-then-split logic surfaces the
# accessory as one card. Two genuinely-separate accessories (tote
# + handbag, hat + bandana) still ship as two — they're > 5 % of
# the frame's short edge apart and the spatial-groups splitter
# breaks them.
#
# Left-shoe / Right-shoe are intentionally NOT here — they are
# literally two-instance and need to stay split so the post-pass
# pair-collapser can union them into a single "Shoes" card.
_SINGLE_INSTANCE_CLASSES = {
    # ATR classes
    "Upper-clothes",
    "upper-clothes",
    "Dress",
    "dress",
    "Skirt",
    "skirt",
    "Pants",
    "pants",
    # Fashion dataset classes
    "shirt, blouse",
    "top, t-shirt, sweatshirt",
    "sweater",
    "cardigan",
    "jacket",
    "vest",
    "shorts",
    "coat",
    "jumpsuit",
    "cape",
    "tights, stockings",
}


def _bbox_gap(
    a: tuple[int, int, int, int], b: tuple[int, int, int, int]
) -> int:
    """Minimum L-infinity distance between two ``(ymin, xmin, ymax, xmax)``
    bboxes. Returns 0 if they overlap or touch."""
    ay1, ax1, ay2, ax2 = a
    by1, bx1, by2, bx2 = b
    dx = max(0, max(bx1 - ax2, ax1 - bx2))
    dy = max(0, max(by1 - ay2, ay1 - by2))
    return max(dx, dy)


def _is_same_garment_component(
    a: tuple[int, int, int, int],
    b: tuple[int, int, int, int],
    frame_short: int,
) -> bool:
    """Check if two bounding boxes are parts of the same garment.
    
    Handles pants legs (vertical overlap + moderate horizontal gap),
    sleeves/torso, and waistband/legs connections.
    """
    ay1, ax1, ay2, ax2 = a
    by1, bx1, by2, bx2 = b
    dx = max(0, max(bx1 - ax2, ax1 - bx2))
    dy = max(0, max(by1 - ay2, ay1 - by2))

    # General proximity (within 20% of frame short edge)
    if max(dx, dy) <= max(16, int(0.20 * frame_short)):
        return True

    # Vertical overlap (e.g. two legs of pants side-by-side, or sleeves of a top)
    y_overlap = max(0, min(ay2, by2) - max(ay1, by1))
    min_h = min(max(1, ay2 - ay1), max(1, by2 - by1))
    if (y_overlap / float(min_h)) >= 0.20 and dx <= int(0.35 * frame_short):
        return True

    # Horizontal overlap (e.g. waistband and legs, collar and torso)
    x_overlap = max(0, min(ax2, bx2) - max(ax1, bx1))
    min_w = min(max(1, ax2 - ax1), max(1, bx2 - bx1))
    if (x_overlap / float(min_w)) >= 0.20 and dy <= int(0.35 * frame_short):
        return True

    return False


def _split_into_spatial_groups(class_binary: np.ndarray) -> list[np.ndarray]:
    """Split a single-instance class mask into spatially-distinct groups.

    Used for the ``_SINGLE_INSTANCE_CLASSES`` (top, dress, skirt, pants)
    where two truly separate garments of the same class can appear in
    one photo — e.g. a flat-lay with two skirts side by side, two
    models in one frame, or a layered outfit where an open jacket and
    the t-shirt underneath each have visible non-overlapping regions.
    Without this split the previous "treat the whole class as one
    blob" logic merged the two garments and the downstream
    ``_postprocess_mask`` largest-component step silently discarded
    one of them.

    Returns one mask per detected garment group. Small print-fragments
    (high-contrast graphic break-ups of a single garment's mask) are
    absorbed into the nearest surviving group, so a graphic-print
    t-shirt still ships ONE card not many.

    Heuristics:
      * A component is a "major" garment if its area is at least 20 %
        of the largest component's area AND at least 0.1 % of the
        frame.
      * Two major components belong to the same garment if they are
        spatially cohesive via ``_is_same_garment_component`` or their
        gap is within 15 % of the frame short edge.
      * "Minor" components (< 20 % of largest) are absorbed into the
        nearest major group if within 20 % of the short edge; else
        dropped as noise.

    On single-component input returns ``[class_binary]`` unchanged
    (the common case). Empty input returns ``[]``.
    """
    from scipy import ndimage

    if class_binary.sum() < 128:
        return []

    labeled, n = ndimage.label(class_binary)
    if n <= 1:
        return [class_binary.astype(np.uint8)]

    H, W = class_binary.shape
    frame_short = max(1, min(H, W))

    # Per-component area + bbox.
    comps: list[dict[str, Any]] = []
    for inst in range(1, n + 1):
        mask = (labeled == inst).astype(np.uint8)
        area = int(mask.sum())
        if area < 128:
            continue  # speck noise
        ys, xs = np.where(mask)
        bbox = (int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max()))
        comps.append({"mask": mask, "area": area, "bbox": bbox})
    if not comps:
        return []
    if len(comps) == 1:
        return [comps[0]["mask"]]

    comps.sort(key=lambda c: c["area"], reverse=True)
    largest_area = comps[0]["area"]
    min_major_frac = 0.20
    min_major_frame_frac = 0.001  # 0.1 % of frame area
    frame_area = H * W
    min_major_area = max(
        int(min_major_frac * largest_area),
        int(min_major_frame_frac * frame_area),
    )
    majors: list[dict[str, Any]] = []
    minors: list[dict[str, Any]] = []
    for c in comps:
        if c["area"] >= min_major_area:
            majors.append(c)
        else:
            minors.append(c)

    # If only one major survives, everything else is noise / fragment.
    if len(majors) == 1:
        merge_gap = max(8, min(32, int(0.05 * frame_short)))
        main = majors[0]
        for frag in minors:
            if _is_same_garment_component(frag["bbox"], main["bbox"], frame_short) or _bbox_gap(frag["bbox"], main["bbox"]) <= merge_gap:
                main["mask"] = np.maximum(main["mask"], frag["mask"])
        # Bridge disconnected fragments into the main blob
        try:
            from scipy import ndimage as _ndi
            k = max(5, min(25, (merge_gap * 2 + 1) | 1))
            structure = np.ones((k, k), dtype=bool)
            bridged = _ndi.binary_closing(
                main["mask"] > 0, structure=structure, iterations=1,
            )
            return [bridged.astype(np.uint8)]
        except Exception:  # noqa: BLE001
            return [main["mask"]]

    # Multiple majors — group by spatial proximity and garment structure
    merge_gap = max(8, min(32, int(0.05 * frame_short)))
    groups: list[dict[str, Any]] = []
    for major in majors:
        joined = False
        for g in groups:
            if _is_same_garment_component(major["bbox"], g["bbox"], frame_short) or _bbox_gap(major["bbox"], g["bbox"]) <= merge_gap:
                g["mask"] = np.maximum(g["mask"], major["mask"])
                gy1, gx1, gy2, gx2 = g["bbox"]
                my1, mx1, my2, mx2 = major["bbox"]
                g["bbox"] = (
                    min(gy1, my1), min(gx1, mx1),
                    max(gy2, my2), max(gx2, mx2),
                )
                joined = True
                break
        if not joined:
            groups.append({
                "mask": major["mask"].copy(),
                "bbox": major["bbox"],
            })

    # Absorb minor fragments into the nearest group (within 20 % of
    # short edge or garment structure); else drop as noise.
    absorb_gap = max(16, min(48, int(0.08 * frame_short)))
    for frag in minors:
        best = None
        best_gap = None
        for g in groups:
            if _is_same_garment_component(frag["bbox"], g["bbox"], frame_short):
                best = g
                best_gap = 0
                break
            gap = _bbox_gap(frag["bbox"], g["bbox"])
            if best is None or gap < (best_gap or 0):
                best = g
                best_gap = gap
        if best is not None and (best_gap is None or best_gap <= absorb_gap):
            best["mask"] = np.maximum(best["mask"], frag["mask"])

    # Bridge disconnected components within each group
    for g in groups:
        try:
            from scipy import ndimage as _ndi
            k = max(5, min(25, (merge_gap * 2 + 1) | 1))
            structure = np.ones((k, k), dtype=bool)
            bridged = _ndi.binary_closing(
                g["mask"] > 0, structure=structure, iterations=1,
            )
            g["mask"] = bridged.astype(np.uint8)
        except Exception:  # noqa: BLE001
            pass

    return [g["mask"] for g in groups]


def _split_instances(class_mask: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """Split per-class mask into connected-component instances.

    Returns [(label_name, binary_mask_u8), ...]. Mask is same H×W as input.
    Small specks are dropped.

    Classes in ``_SINGLE_INSTANCE_CLASSES`` use
    ``_split_into_spatial_groups`` so two genuinely-separate garments
    of the same class (flat-lay with two skirts, layered outfits with
    visible non-overlapping regions) ship as two cards, while
    print-fragments of a single garment stay merged into one mask.

    Multi-instance classes (Left-shoe / Right-shoe / Hat / Bag /
    Belt / Scarf / Sunglasses) keep the legacy connected-component
    split so a wearer's two distinct shoes or a hat + scarf each
    surface as their own detection.
    """
    from scipy import ndimage

    out: list[tuple[str, np.ndarray]] = []
    unique = np.unique(class_mask)
    for cid in unique:
        cid_i = int(cid)
        if cid_i == 0:
            continue  # background in this model
        label_name = _id2label.get(cid_i)
        if not label_name:
            continue
        if _get_label_category(label_name) is None:
            continue
        class_binary = (class_mask == cid_i).astype(np.uint8)

        if label_name in _SINGLE_INSTANCE_CLASSES:
            for sub in _split_into_spatial_groups(class_binary):
                if int(sub.sum()) >= 128:
                    out.append((label_name, sub))
            continue

        # Multi-instance-allowed classes (shoes, accessories, …):
        # keep the legacy connected-component split so a user wearing
        # two distinct shoes / a hat + a scarf gets one detection
        # per item.
        labeled, n = ndimage.label(class_binary)
        for inst in range(1, n + 1):
            mask = (labeled == inst).astype(np.uint8)
            if mask.sum() >= 128:  # drop tiny noise
                out.append((label_name, mask))
    return out


def _mask_bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    """Return (ymin, xmin, ymax, xmax) of a binary mask in pixel coords."""
    ys, xs = np.where(mask)
    if not len(ys):
        return None
    return int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())


def _postprocess_mask(mask: np.ndarray, keep_top_k: int = 1) -> np.ndarray:
    """Clean up a noisy SegFormer binary mask into a clean garment cutout.

    Raw SegFormer output is per-pixel argmax with no spatial regularisation,
    which produces three artefacts that show up as "colour stains" when the
    mask is used as an alpha channel:

    1. **Holes inside the garment** — shadows / dark folds get misclassified
       as background, leaving see-through pockets in the middle of a shirt.
    2. **Jagged stair-step edges** — neighbouring pixels flip class along
       boundaries, giving a noisy outline.
    3. **Floating specks** — far-from-garment pixels misclassified as the
       same class, scattered around the image.

    Fix:
      * morphological **closing** (dilate→erode) smooths edges and bridges
        thin gaps where the mask broke around belts, straps, etc.
      * `binary_fill_holes` fills any enclosed background blob inside the
        garment — eliminating the see-through "stains".
      * keep only the **top K connected components** so floating specks
        don't drag random crops of the user's couch into the cutout.

    Kernel size scales with image dimensions so it works equally well on
    a 600 px portrait and a 4000 px DSLR shot.
    """
    from scipy import ndimage

    if mask.dtype != np.bool_ and mask.max() > 1:
        # Allow callers to pass uint8 0/1 OR 0/255 — both are common.
        binary = mask > 0
    else:
        binary = mask.astype(bool)
    if not binary.any():
        return mask.astype(np.uint8)

    H, W = binary.shape
    # Kernel size: ~0.4% of the shorter edge, clamped to a sensible range.
    # On a 1024 px image this is ~4 px; on 4000 px ~16 px. Small enough
    # that we don't dissolve thin straps, large enough to smooth noise.
    k = max(3, min(15, int(round(min(H, W) * 0.004)) | 1))  # force odd

    # 1) Closing: dilate then erode → smooths edges, bridges hairline gaps.
    structure = np.ones((k, k), dtype=bool)
    closed = ndimage.binary_closing(binary, structure=structure, iterations=1)

    # 2) Fill enclosed holes (shadows misclassified as background).
    filled = ndimage.binary_fill_holes(closed)
    if filled is None:  # type: ignore[truthy-bool]
        filled = closed

    # 3) Keep only significant connected components. Drops floating specks
    #    far from the main garment which would otherwise pollute the
    #    cutout with random scenery, while preserving both sides of an open jacket,
    #    both sleeves, or both shoes.
    if keep_top_k > 0:
        labeled, n = ndimage.label(filled)
        if n > 1:
            sizes = np.array(ndimage.sum(filled, labeled, range(1, n + 1)))
            max_size = float(sizes.max()) if len(sizes) else 1.0
            # Always keep major components (e.g. >= 15% of the largest component)
            sig_labels = np.where(sizes >= 0.15 * max_size)[0] + 1
            top_k_labels = np.argsort(sizes)[-keep_top_k:] + 1
            keep_labels = np.union1d(sig_labels, top_k_labels)
            filled = np.isin(labeled, keep_labels)

    # 4) Curvature anti-aliasing: smooth out the 8-16px staircase steps from low-res SegFormer
    if filled.any():
        smooth_sigma = max(1.5, min(5.0, float(min(H, W)) * 0.003))
        blurred = ndimage.gaussian_filter(filled.astype(float), sigma=smooth_sigma)
        filled = blurred >= 0.5

    return filled.astype(np.uint8)


async def _call_self_hosted(
    image_bytes: bytes, endpoint_url: str, img_size: tuple[int, int]
) -> list[dict[str, Any]] | None:
    """Self-hosted contract: POST multipart `image` →
    `{segments: [{label, mask_png_b64, score?}, ...]}`.
    Returns normalised entries in the same shape as parse_garments.
    """
    W, H = img_size
    started = time.time()
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as c:
            resp = await c.post(
                endpoint_url.rstrip("/") + "/segment-clothes",
                files={"image": ("input.jpg", image_bytes, "image/jpeg")},
            )
    except Exception as exc:  # noqa: BLE001
        logger.info("clothing_parser self-hosted exception: %s", exc)
        return None
    provider_activity.record(
        "clothing_parser",
        ok=resp.status_code == 200,
        latency_ms=int((time.time() - started) * 1000),
        extra={"provider": "self_hosted", "url": endpoint_url},
    )
    if resp.status_code != 200:
        logger.info("clothing_parser self-hosted non-200: %s", resp.status_code)
        return None
    try:
        body = resp.json()
    except Exception:  # noqa: BLE001
        return None
    segments = body.get("segments") or []
    out: list[dict[str, Any]] = []
    total = max(1, W * H)
    for seg in segments:
        label = seg.get("label") or ""
        category = _get_label_category(label)
        if not category:
            continue
        mask_b64 = seg.get("mask") or seg.get("mask_png_b64")
        if not mask_b64:
            continue
        try:
            data = base64.b64decode(mask_b64.split(",", 1)[-1])
            im = Image.open(io.BytesIO(data)).convert("L")
            if im.size != (W, H):
                im = im.resize((W, H), Image.NEAREST)
            mask = (np.array(im) > 127).astype(np.uint8)
        except Exception:  # noqa: BLE001
            continue
        area = int(mask.sum())
        if area / total < _min_area_frac_for(category):
            continue
        bb = _mask_bbox(mask)
        if bb is None:
            continue
        ymin, xmin, ymax, xmax = bb
        out.append(
            {
                "label": label,
                "category": category,
                "score": float(seg.get("score") or 0.9),
                "bbox": [
                    int(ymin / H * 1000),
                    int(xmin / W * 1000),
                    int(ymax / H * 1000),
                    int(xmax / W * 1000),
                ],
                "mask": mask,
            }
        )
    return out


# Categories that participate in cross-label NMS. Accessories /
# footwear / headwear are deliberately excluded — a belt on pants, a
# bag in front of a dress, shoes overlapping the hem of trousers are
# all legitimate overlaps that the user expects to see as separate
# cards in their closet.
_NMS_CATEGORIES: frozenset[str] = frozenset({"top", "bottom", "dress", "outerwear", "footwear", "accessory", "headwear"})

_NMS_CONTAINMENT_THRESHOLD: float = 0.65
_NMS_IOU_THRESHOLD: float = 0.45


def _suppress_overlapping_garments(
    by_label: dict[str, dict[str, Any]],
    *,
    has_human: bool = False,
    count_hint: int | None = None,
) -> dict[str, dict[str, Any]]:
    """Patch 12h (Aug 2026) — Dilated pixel & Bounding Box NMS.

    Fixes SegFormer per-pixel argmax 0-intersection bug. Because raw SegFormer
    argmax masks are mutually exclusive, raw ``inter`` is always 0. By computing
    bounding box containment + dilated mask intersection, we detect sub-part
    fragments (like phantom Hat/Bag on shoes or split garments) and merge them.
    """
    if not by_label:
        return by_label

    from scipy import ndimage

    nms_items: list[tuple[str, dict[str, Any], int]] = []
    passthrough: dict[str, dict[str, Any]] = {}
    for lbl, item in by_label.items():
        try:
            area = int(item["mask"].sum())
        except Exception:  # noqa: BLE001
            area = 0
        if area > 0:
            nms_items.append((lbl, item, area))
        else:
            passthrough[lbl] = item

    if len(nms_items) < 2:
        for lbl, item, _ in nms_items:
            passthrough[lbl] = item
        return passthrough

    # Sort largest → smallest so we compare candidates against dominant items
    nms_items.sort(key=lambda t: t[2], reverse=True)

    def _bbox(m: np.ndarray) -> tuple[int, int, int, int] | None:
        ys, xs = np.where(m)
        if not len(ys):
            return None
        return int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())

    first_mask = nms_items[0][1]["mask"]
    H, W = first_mask.shape

    kept: list[tuple[str, dict[str, Any], int]] = []
    suppressed: list[tuple[str, str, str, float, float]] = []
    for lbl, item, area in nms_items:
        merged = False
        dropped = False
        item_cat = item.get("category")
        bb_item = _bbox(item["mask"])
        dilated_item = ndimage.binary_dilation(item["mask"], iterations=10)

        for kept_idx, (kept_lbl, kept_item, kept_area) in enumerate(kept):
            kept_cat = kept_item.get("category")
            bb_kept = _bbox(kept_item["mask"])

            # Layering protection: NEVER merge outerwear (jacket/coat/cardigan) with tops (sweater/shirt/t-shirt),
            # or skirts/dresses with tights/pants/stockings, or footwear with tights/socks/pants!
            kept_lbl_l = str(kept_lbl).lower()
            item_lbl_l = str(lbl).lower()
            is_layering = (
                ({kept_cat, item_cat} == {"top", "outerwear"})
                or (has_human and kept_cat == "top" and item_cat == "top" and kept_lbl_l != item_lbl_l)
                or (any(any(k in l for k in ("skirt", "dress")) for l in (kept_lbl_l, item_lbl_l)) and any(any(t in l for t in ("tight", "stocking", "pant", "legging")) for l in (kept_lbl_l, item_lbl_l)))
                or (has_human and any(any(k in l for k in ("shoe", "boot", "footwear")) for l in (kept_lbl_l, item_lbl_l)) and any(any(t in l for t in ("tight", "stocking", "sock", "pant", "legging")) for l in (kept_lbl_l, item_lbl_l)))
            )
            # Top / vest / collar sub-part on outerwear:
            # SegFormer often slices a fur collar, lapel, or throat sliver as 'vest', 'top, t-shirt, sweatshirt',
            # 'shirt, blouse', or 'sweater'. If a top/vest is inside or overlapping outerwear (jacket/coat/blazer/hoodie)
            # and is a fragment (< 18% of outerwear area, or < 25% of width/height, or ends within upper 35% of coat height),
            # it is a collar, lapel, or inner neckline fragment, NOT a separate wearable garment!
            is_top_outer_pair = (
                ({"top", "outerwear"} == {kept_cat, item_cat})
                or (
                    any(k in (kept_lbl_l, item_lbl_l) for k in ("jacket", "coat", "suit", "blazer", "hoodie", "cardigan", "cape"))
                    and any(t in (kept_lbl_l, item_lbl_l) for t in ("vest", "top", "t-shirt", "shirt", "blouse", "sweater"))
                )
            )
            if is_top_outer_pair and bb_item and bb_kept:
                outer_lbl = kept_lbl_l if kept_cat == "outerwear" else item_lbl_l
                top_lbl = item_lbl_l if kept_cat == "outerwear" else kept_lbl_l
                outer_area = kept_area if kept_cat == "outerwear" else area
                top_area = area if kept_cat == "outerwear" else kept_area
                outer_bb = bb_kept if kept_cat == "outerwear" else bb_item
                top_bb = bb_item if kept_cat == "outerwear" else bb_kept
                outer_w = max(1, outer_bb[3] - outer_bb[1])
                outer_h = max(1, outer_bb[2] - outer_bb[0])
                top_w = max(1, top_bb[3] - top_bb[1])
                top_h = max(1, top_bb[2] - top_bb[0])

                is_subpart_fragment = (
                    top_area < 0.18 * max(1, outer_area)
                    or top_w < 0.25 * outer_w
                    or top_h < 0.25 * outer_h
                    or (top_bb[2] <= outer_bb[0] + int(0.35 * outer_h))
                )
                if is_subpart_fragment:
                    if kept_cat == "outerwear":
                        kept_item["mask"] = np.maximum(kept_item["mask"], item["mask"])
                        kept[kept_idx] = (kept_lbl, kept_item, int(kept_item["mask"].sum()))
                        merged = True
                        suppressed.append((lbl, kept_lbl, item_cat or "?", 1.0, 1.0))
                        break
                    else:
                        item["mask"] = np.maximum(item["mask"], kept_item["mask"])
                        kept[kept_idx] = (lbl, item, int(item["mask"].sum()))
                        merged = True
                        suppressed.append((kept_lbl, lbl, kept_cat or "?", 1.0, 1.0))
                        break

            # Multiple outerwear on a human model: a single person never wears two coats/jackets!
            # If two outerwear detections overlap spatially or share the vertical torso corridor, merge into dominant outerwear.
            if has_human and kept_cat == "outerwear" and item_cat == "outerwear" and bb_item and bb_kept:
                y1, x1, y2, x2 = bb_item
                Y1, X1, Y2, X2 = bb_kept
                x_overlap = max(0, min(x2, X2) - max(x1, X1))
                min_w = min(max(1, x2 - x1), max(1, X2 - X1))
                if (x_overlap / float(min_w)) >= 0.25 or _is_same_garment_component(bb_item, bb_kept, min(H, W)):
                    kept_item["mask"] = np.maximum(kept_item["mask"], item["mask"])
                    kept[kept_idx] = (kept_lbl, kept_item, int(kept_item["mask"].sum()))
                    merged = True
                    suppressed.append((lbl, kept_lbl, item_cat or "?", 1.0, 1.0))
                    break

            if is_layering:
                continue

            # Distinct fashion categories (e.g. headwear vs top, top vs bottom, bottom vs footwear, accessory vs garment)
            # must stay separate and not be merged, UNLESS one is footwear and the other is a sub-part fragment of that footwear.
            # Real clothing categories (top, bottom, dress, outerwear, headwear) can NEVER merge with footwear on a human model!
            clothing_cats = {"top", "bottom", "dress", "outerwear", "headwear"}
            has_clothing = bool(clothing_cats & {kept_cat, item_cat})
            has_footwear = "footwear" in {kept_cat, item_cat}

            if has_human and has_footwear and has_clothing:
                continue

            is_flatlay_top_bottom = False
            is_footwear_candidate = (not has_human) and has_footwear
            if kept_cat != item_cat:
                garment_set = {"top", "dress", "outerwear"}
                is_garment_pair = kept_cat in garment_set and item_cat in garment_set
                is_flatlay_top_bottom = (not has_human) and (count_hint is not None and count_hint <= 1) and (
                    {kept_cat, item_cat} == {"top", "bottom"} or {kept_cat, item_cat} == {"top", "dress"}
                )
                if not (is_garment_pair or is_flatlay_top_bottom or is_footwear_candidate):
                    # Attached hood / collar rule: if headwear or scarf meets the upper border/neckline of top/outerwear,
                    # it is an attached hood or collar and MUST be merged into the jacket/top!
                    is_attached_hood = (
                        kept_cat in {"top", "outerwear"}
                        and item_cat in {"headwear", "scarf"}
                        and bb_item and bb_kept
                    )
                    if is_attached_hood:
                        y1, x1, y2, x2 = bb_item
                        Y1, X1, Y2, X2 = bb_kept
                        vert_gap = max(0, Y1 - y2)
                        horiz_inter = max(0, min(x2, X2) - max(x1, X1))
                        item_w = max(1, x2 - x1)
                        if (vert_gap <= 30 or y2 >= Y1 - 10) and (horiz_inter / float(item_w) >= 0.35):
                            kept_item["mask"] = np.maximum(kept_item["mask"], item["mask"])
                            kept[kept_idx] = (
                                kept_lbl,
                                kept_item,
                                int(kept_item["mask"].sum()),
                            )
                            merged = True
                            suppressed.append((lbl, kept_lbl, item_cat or "?", 1.0, 1.0))
                            break

                    # Suppress phantom accessory / shoe speck on a flat-lay garment or footwear
                    if (
                        not has_human
                        and kept_cat in {"top", "bottom", "dress", "outerwear", "footwear"}
                        and item_cat in {"accessory", "bag", "belt", "scarf", "headwear", "footwear"}
                    ):
                        if area <= 0.25 * kept_area:
                            merged = True
                            suppressed.append((lbl, kept_lbl, item_cat or "?", 0.0, 0.0))
                            break
                    continue
            else:
                # Same category in a photo without a human model (e.g. two pieces of pants, or top fragments)
                if not has_human and bb_item and bb_kept:
                    if _is_same_garment_component(bb_item, bb_kept, min(H, W)):
                        kept_item["mask"] = np.maximum(kept_item["mask"], item["mask"])
                        kept[kept_idx] = (
                            kept_lbl,
                            kept_item,
                            int(kept_item["mask"].sum()),
                        )
                        merged = True
                        suppressed.append((lbl, kept_lbl, item_cat or "?", 1.0, 1.0))
                        break

            # 1. Dilated pixel intersection & containment
            dilated_kept = ndimage.binary_dilation(kept_item["mask"], iterations=10)
            pixel_inter = int(np.logical_and(dilated_item, dilated_kept).sum())
            pixel_containment = pixel_inter / float(area) if area > 0 else 0.0

            # 2. Bounding box containment & IoU
            bbox_containment = 0.0
            bbox_iou = 0.0
            if bb_item and bb_kept:
                y1, x1, y2, x2 = bb_item
                Y1, X1, Y2, X2 = bb_kept
                iy = max(0, min(y2, Y2) - max(y1, Y1))
                ix = max(0, min(x2, X2) - max(x1, X1))
                i_area = iy * ix
                a_item = max(1, (y2 - y1) * (x2 - x1))
                a_kept = max(1, (Y2 - Y1) * (X2 - X1))
                bbox_containment = i_area / float(a_item)
                bbox_iou = i_area / float(a_item + a_kept - i_area)

            # Footwear rule: genuine fragments with containment/overlap or spatial connectivity merge
            is_footwear_overlap = is_footwear_candidate and (
                pixel_containment >= 0.20
                or bbox_containment >= 0.30
                or bbox_iou >= 0.15
                or (bb_item and bb_kept and _is_same_garment_component(bb_item, bb_kept, min(H, W)))
            )

            is_general_overlap = (
                pixel_containment >= 0.40 or bbox_containment >= 0.60 or bbox_iou >= 0.45
            )

            is_flatlay_touch = False
            if is_flatlay_top_bottom and bb_item and bb_kept:
                y1, x1, y2, x2 = bb_item
                Y1, X1, Y2, X2 = bb_kept
                vert_gap = max(0, max(y1 - Y2, Y1 - y2))
                horiz_inter = max(0, min(x2, X2) - max(x1, X1))
                min_w = min(max(1, x2 - x1), max(1, X2 - X1))
                if vert_gap <= 25 and min_w > 0 and (horiz_inter / float(min_w)) >= 0.45:
                    is_flatlay_touch = True

            if not (is_footwear_overlap or is_general_overlap or is_flatlay_touch):
                continue

            # Merge smaller into kept_item
            kept_item["mask"] = np.maximum(kept_item["mask"], item["mask"])
            if is_footwear_candidate or kept_cat == "footwear" or item_cat == "footwear":
                kept_lbl = "Shoes"
                kept_item["label"] = "Shoes"
                kept_item["category"] = "footwear"
            elif (kept_lbl == "Dress" and lbl == "Upper-clothes") or (kept_lbl == "Pants" and lbl == "Upper-clothes"):
                kept_lbl = "Upper-clothes"
                kept_item["label"] = "Upper-clothes"
                kept_item["category"] = "top"
            elif kept_cat == "bottom" and item_cat == "top":
                kept_lbl = "Upper-clothes"
                kept_item["label"] = "Upper-clothes"
                kept_item["category"] = "top"
            kept[kept_idx] = (
                kept_lbl,
                kept_item,
                int(kept_item["mask"].sum()),
            )
            merged = True

            suppressed.append(
                (lbl, kept_lbl, item_cat or "?", bbox_iou, bbox_containment)
            )
            dropped = True
            break

        if not (merged or dropped):
            kept.append((lbl, item, area))

    if suppressed:
        logger.info(
            "clothing_parser: NMS suppressed %d overlap(s): %s",
            len(suppressed),
            [
                f"{lbl}(\u2192{tgt}, iou={iou:.2f}, cont={cont:.2f})"
                for lbl, tgt, _cat, iou, cont in suppressed
            ],
        )

    for lbl, item, _ in kept:
        passthrough[lbl] = item
    return passthrough




async def parse_garments(
    image_bytes: bytes,
    *,
    count_hint: int | None = None,
) -> list[dict[str, Any]]:
    """Return [{label, category, score, bbox, mask}] for each garment.

    * `bbox` → `[ymin, xmin, ymax, xmax]` on a 0..1000 scale (matches
      `garment_vision._crop_to_bbox`).
    * `mask` → full-resolution numpy uint8 (1=garment) aligned with the
      original image. Callers use it with `crop_with_mask` to produce
      semantic cutouts instead of bbox squares.

    Empty list means "parser unavailable or found nothing useful"; the
    caller should fall back to the legacy Gemini detector.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        logger.warning("clothing_parser: bad image bytes: %s", exc)
        return []
    orig_W, orig_H = img.size
    if max(orig_W, orig_H) > 512:
        scale = 512.0 / max(orig_W, orig_H)
        img = img.resize((max(1, int(orig_W * scale)), max(1, int(orig_H * scale))), Image.BILINEAR)
    W, H = img.size

    # 1. Self-hosted takes precedence (user's future dressapp.co box).
    if settings.CLOTHING_PARSER_ENDPOINT_URL:
        remote = await _call_self_hosted(
            image_bytes, settings.CLOTHING_PARSER_ENDPOINT_URL, (W, H)
        )
        if remote:
            logger.info(
                "clothing_parser: self-hosted produced %d garment(s)", len(remote)
            )
            return remote

    # 2. Local CPU inference — DISABLED by default because the SegFormer
    #    model peaks at ~2 GB RAM during the first forward pass, which
    #    OOM-kills the backend pod on small memory budgets. Enable by
    #    setting USE_LOCAL_CLOTHING_PARSER=true after confirming your
    #    pod has at least 4 GB of headroom.
    if not settings.USE_LOCAL_CLOTHING_PARSER:
        logger.debug(
            "clothing_parser: local inference disabled (USE_LOCAL_CLOTHING_PARSER=false); "
            "returning empty so caller falls back to Gemini detector."
        )
        return []

    t0 = time.time()
    ok = False
    try:
        class_mask = await asyncio.to_thread(_run_inference, img)
        ok = True
    except RuntimeError as exc:
        logger.info("clothing_parser: local inference skipped: %s", exc)
        return []
    except Exception as exc:  # noqa: BLE001
        logger.warning("clothing_parser: local inference failed: %s", exc)
        provider_activity.record(
            "clothing_parser",
            ok=False,
            latency_ms=int((time.time() - t0) * 1000),
            extra={"provider": "local", "err": repr(exc)[:120]},
        )
        return []
    provider_activity.record(
        "clothing_parser",
        ok=ok,
        latency_ms=int((time.time() - t0) * 1000),
        extra={"provider": "local", "model": settings.CLOTHING_PARSER_MODEL},
    )

    instances = await asyncio.to_thread(_split_instances, class_mask)
    total = max(1, W * H)

    # Build a binary "human body" mask from the same class_mask — the
    # union of Face / Hair / Left-arm / Right-arm / Left-leg /
    # Right-leg pixels. Consumers (`apply_alpha_intersection`)
    # subtract this from the per-garment soft mask AFTER dilation
    # so face / hair / limb pixels can't leak into the final matte
    # even when SegFormer mis-labelled a few skin pixels as garment
    # OR when dilation grew the garment mask outward into adjacent
    # skin. Returned only once; sliced per-bbox downstream.
    human_class_ids = {
        cid for cid, name in _id2label.items()
        if name in _HUMAN_CLASS_NAMES
    }
    head_class_ids = {
        cid for cid, name in _id2label.items()
        if name in {"Face", "Hair", "Neck"}
    }
    arm_class_ids = {
        cid for cid, name in _id2label.items()
        if name in {"Left-arm", "Right-arm"}
    }
    leg_class_ids = {
        cid for cid, name in _id2label.items()
        if name in {"Left-leg", "Right-leg"}
    }
    has_head = bool(np.isin(class_mask, list(head_class_ids)).sum() >= 30) if head_class_ids else False
    has_any_human = bool(np.isin(class_mask, list(human_class_ids)).sum() >= 80) if human_class_ids else False
    if human_class_ids and (has_head or has_any_human):
        human_mask_full = np.isin(class_mask, list(human_class_ids)).astype(np.uint8)
    else:
        # Fashion dataset has no explicit human classes: detect human wearer via skin chrominance
        # outside garment masks, so hands, neck, face, and bare legs are recognized and excised.
        try:
            arr = np.array(img)
            r = arr[:, :, 0].astype(float)
            g = arr[:, :, 1].astype(float)
            b = arr[:, :, 2].astype(float)
            cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
            cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
            is_skin = (
                (cr >= 133.0) & (cr <= 173.0) &
                (cb >= 77.0) & (cb <= 127.0) &
                (r > g) & (g > b) &
                ((r - g) >= 12.0)
            )
            # Only consider skin where SegFormer did not predict a clothing item
            garment_occupied = class_mask > 0
            skin_outside_garments = is_skin & (~garment_occupied)
            skin_px = int(skin_outside_garments.sum())
            skin_frac = skin_px / float(total)
            # A human wearer's exposed skin (face/arms/legs) typically covers 1.5% to 25% of the frame.
            # If > 28%, it is a warm background surface (bedsheet, table, wall, floor), NOT a human!
            if 0.015 <= skin_frac <= 0.28:
                human_mask_full = skin_outside_garments.astype(np.uint8)
                has_any_human = True
            else:
                human_mask_full = None
        except Exception:
            human_mask_full = None

    if human_mask_full is not None:
        if not human_mask_full.any() or int(human_mask_full.sum()) < 80:
            human_mask_full = None
        else:
            from scipy import ndimage
            h_h, h_w = human_mask_full.shape
            smooth_sigma = max(1.5, min(5.0, float(min(h_h, h_w)) * 0.003))
            human_blurred = ndimage.gaussian_filter(human_mask_full.astype(float), sigma=smooth_sigma)
            human_mask_full = (human_blurred >= 0.3).astype(np.uint8)

    # 1) First pass: keep only sufficiently-large instances; index by label.
    by_label: dict[str, dict[str, Any]] = {}
    for label_name, mask in instances:
        # Patch 10a: category-dependent area threshold. Accessories
        # and footwear get a smaller minimum so we don't filter out
        # sunglasses, belts, shoes, etc. in a full-body shot.
        category = _get_label_category(label_name)
        if not category:
            continue
        if int(mask.sum()) / total < _min_area_frac_for(category, label=label_name):
            continue
        if label_name in _SINGLE_INSTANCE_CLASSES or str(label_name).lower() in _SINGLE_INSTANCE_CLASSES:
            key = label_name
            suffix = 0
            while key in by_label:
                suffix += 1
                key = f"{label_name}#{suffix}"
            by_label[key] = {
                "label": label_name,
                "category": category,
                "score": 0.95,
                "mask": mask,
            }
            continue
        if label_name in by_label:
            # Merge disconnected components of the same label into one
            # mask — e.g. a shirt split by a belt, or hair overlapping a
            # sweater — so the UI shows one card per garment.
            # BUT for accessories (bags, belts, scarves, sunglasses, hats),
            # never merge components that are far apart (> 8% of frame short edge)!
            # Disconnected accessory specks on opposite sides of the body are noise.
            if category in ("accessory", "headwear"):
                prev_bb = _mask_bbox(by_label[label_name]["mask"])
                cur_bb = _mask_bbox(mask)
                if prev_bb and cur_bb and _bbox_gap(prev_bb, cur_bb) > int(0.08 * min(H, W)):
                    prev_area = int(by_label[label_name]["mask"].sum())
                    cur_area = int(mask.sum())
                    if cur_area > prev_area:
                        by_label[label_name]["mask"] = mask
                    continue
            by_label[label_name]["mask"] = np.maximum(
                by_label[label_name]["mask"], mask
            )
        else:
            by_label[label_name] = {
                "label": label_name,
                "category": category,
                "score": 0.95,
                "mask": mask,
            }

    # 2) Collapse Left-shoe + Right-shoe / shoe into a single "Shoes" item —
    #    users think of them as one pair, and `_looks_already_cropped`
    #    handles single-item footwear photos more cleanly this way.
    shoe_keys = [k for k in list(by_label.keys()) if k.startswith(("Left-shoe", "Right-shoe", "Shoes", "shoe")) and not k.startswith("sock")]
    if shoe_keys:
        pair_items = [by_label.pop(k) for k in shoe_keys]
        pair_masks = [x["mask"] for x in pair_items if x and x.get("mask") is not None]
        if pair_masks:
            combined = pair_masks[0]
            for m in pair_masks[1:]:
                combined = np.maximum(combined, m)
            by_label["Shoes"] = {
                "label": "Shoes",
                "category": "footwear",
                "score": 0.95,
                "mask": combined,
            }

    # 2a) Footwear Consolidation (when SegFormer fragments footwear into multiple pieces or mislabels shoe parts)
    if "Shoes" in by_label:
        from scipy import ndimage
        while True:
            shoes_mask = by_label["Shoes"]["mask"]
            shoes_bb = _mask_bbox(shoes_mask)
            if not shoes_bb:
                break
            sy1, sx1, sy2, sx2 = shoes_bb
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Shoes" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_cat = (other_it.get("category") or "").lower()

                # If there is a genuine tall upper body garment or full-length pants, do not absorb it
                is_genuine_tall_top = o_cat in ("top", "dress", "outerwear") and oy1 < int(0.20 * H) and (oy2 - oy1) >= int(0.40 * H)
                is_genuine_tall_bottom = o_cat in ("bottom", "dress") and oy1 < int(0.40 * H) and (oy2 - oy1) >= int(0.45 * H)
                if is_genuine_tall_top or is_genuine_tall_bottom:
                    continue

                x_inter = max(0, min(sx2, ox2) - max(sx1, ox1))
                y_inter = max(0, min(sy2, oy2) - max(sy1, oy1))
                o_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_shoes = ndimage.binary_dilation(by_label["Shoes"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_shoes).any()
                is_proximate = _is_same_garment_component(shoes_bb, obb, min(H, W))
                vert_center_diff = abs(((sy1 + sy2) / 2.0) - ((oy1 + oy2) / 2.0))
                is_side_by_side = (vert_center_diff <= int(0.25 * H)) and (oy1 >= int(0.20 * H))

                if touches or is_proximate or box_containment >= 0.20 or is_side_by_side:
                    logger.info("clothing_parser: consolidating footwear fragment '%s' into Shoes", other_key)
                    by_label["Shoes"]["mask"] = np.maximum(by_label["Shoes"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    distinct_cats = {it.get("category") for it in by_label.values()}
    has_torso_clothing = bool(distinct_cats & {"top", "dress", "outerwear"})
    has_human = bool(has_head or (has_torso_clothing and human_mask_full is not None and int(human_mask_full.sum()) >= 150))

    # 2b) Patch 12e (May 2026) — Option B2 pair recovery for footwear.
    #     When the unified Shoes mask is anatomically lopsided (one
    #     half of the frame carries < 30% the mass of the other), the
    #     first SegFormer pass almost certainly missed a partner boot
    #     due to a strong global prior on the dominant side. Re-run
    #     SegFormer on the missing half to give the model a focused
    #     second look. If nothing turns up on the missing half, the
    #     photo genuinely only shows one boot (profile shot / occluded
    #     partner) — leave the mask alone so the saved card stays
    #     faithful to the original photo. See ``_recover_paired_footwear``.
    if "Shoes" in by_label:
        try:
            by_label["Shoes"]["mask"] = await asyncio.to_thread(
                _recover_paired_footwear, img, by_label["Shoes"]["mask"],
            )
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "clothing_parser: pair recovery skipped after error: %s",
                repr(exc)[:120],
            )

    # 2c) Clean up every merged mask: fill shadow-holes, smooth jagged
    #     edges, drop floating specks. Without this step the alpha
    #     channel on cropped PNGs looks like swiss cheese.
    for item in by_label.values():
        item["mask"] = _postprocess_mask(
            item["mask"],
            keep_top_k=2 if item["label"] == "Shoes" else 1,
        )

    # 2d) Patch 12 (May 2026) — inter-label overlap suppression.
    by_label = _suppress_overlapping_garments(
        by_label,
        has_human=has_human,
        count_hint=count_hint,
    )

    # 2e) Footwear Partner Recovery after suppression:
    # If a footwear item survived alongside another side-by-side item at the footwear height tier
    # (e.g. left shoe predicted as Shoes and right shoe mislabeled as pants/cardigan),
    # merge them into a single Shoes pair.
    if "Shoes" in by_label and not has_human and len(by_label) >= 2:
        shoes_mask = by_label["Shoes"]["mask"]
        shoes_bb = _mask_bbox(shoes_mask)
        if shoes_bb:
            y1, x1, y2, x2 = shoes_bb
            h_shoe = max(1, y2 - y1)
            area_shoe = max(1, int(shoes_mask.sum()))
            keys_to_merge = []
            for other_key, other_it in list(by_label.items()):
                if other_key == "Shoes":
                    continue
                other_mask = other_it.get("mask")
                if other_mask is None:
                    continue
                obb = _mask_bbox(other_mask)
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                h_other = max(1, oy2 - oy1)
                area_other = max(1, int(other_mask.sum()))
                vert_center_diff = abs(((y1 + y2) / 2.0) - ((oy1 + oy2) / 2.0))
                ratio_h = float(h_other) / float(h_shoe)
                ratio_area = float(area_other) / float(area_shoe)
                if (
                    vert_center_diff <= int(0.20 * H)
                    and 0.35 <= ratio_h <= 2.8
                    and 0.20 <= ratio_area <= 5.0
                ):
                    logger.info("clothing_parser: merging side-by-side partner shoe detection '%s' into Shoes pair", other_key)
                    by_label["Shoes"]["mask"] = np.maximum(by_label["Shoes"]["mask"], other_mask)
                    shoes_bb = _mask_bbox(by_label["Shoes"]["mask"])
                    if shoes_bb:
                        y1, x1, y2, x2 = shoes_bb
                        h_shoe = max(1, y2 - y1)
                        area_shoe = max(1, int(by_label["Shoes"]["mask"].sum()))
                    keys_to_merge.append(other_key)
            for k in keys_to_merge:
                del by_label[k]

    distinct_categories = {it.get("category") for it in by_label.values()}
    has_top = bool(distinct_categories & {"top", "dress", "outerwear"})
    has_bottom = "bottom" in distinct_categories
    has_shoes = "footwear" in distinct_categories
    is_multi_category_outfit = (has_top and has_bottom) or (has_top and has_shoes) or (has_bottom and has_shoes)

    if count_hint is not None and count_hint <= 1 and not has_human and not is_multi_category_outfit and len(by_label) > 1:
        # Flat-lay or hanger photo of a single garment: any multiple detections are
        # sub-parts or two-tone splits of that single garment.
        items_list = list(by_label.values())
        def _garment_sort_key(it: dict[str, Any]) -> tuple[int, int]:
            cat = it.get("category", "")
            if cat in ("top", "dress", "outerwear"):
                cat_priority = 0
            elif cat == "bottom":
                cat_priority = 1
            elif cat == "footwear":
                cat_priority = 2
            else:
                cat_priority = 3
            area = int(it["mask"].sum()) if it.get("mask") is not None else 0
            return (cat_priority, -area)
        items_list.sort(key=_garment_sort_key)
        primary = items_list[0]
        for other in items_list[1:]:
            if other.get("mask") is not None:
                primary["mask"] = np.maximum(primary["mask"], other["mask"])
        by_label = {primary["label"]: primary}

    # 3) Finalise: compute bboxes from merged masks, emit canonical dict.
    out: list[dict[str, Any]] = []
    for item in by_label.values():
        bb = _mask_bbox(item["mask"])
        if bb is None:
            continue
        ymin, xmin, ymax, xmax = bb
        
        cat = (item.get("category") or "").lower()
        lbl = (item.get("label") or "").lower()

        # Category-appropriate human mask:
        # 1. Accessories and footwear:
        # For sunglasses/eyewear: wearer's face, hair, neck, and arms are NOT the sunglasses and must be subtracted!
        is_eyewear_item = lbl in ("sunglasses", "glasses", "eyewear") or "sunglass" in lbl or cat in ("sunglasses", "glasses", "eyewear")
        is_footwear_item = cat == "footwear" or lbl in ("shoes", "sandals", "sneakers", "boots", "floppers", "clogs", "slides") or "shoe" in lbl
        
        if is_eyewear_item:
            # For sunglasses/eyewear: wearer's face, hair, neck, and arms are NOT the sunglasses and must be subtracted!
            garment_human_mask = human_mask_full
        elif is_footwear_item:
            # For footwear: subtract legs (Left-leg, Right-leg), arms, and head/face!
            footwear_human_ids = leg_class_ids | arm_class_ids | head_class_ids
            garment_human_mask = (
                np.isin(class_mask, list(footwear_human_ids)).astype(np.uint8)
                if footwear_human_ids and np.isin(class_mask, list(footwear_human_ids)).any()
                else None
            )
        elif cat in ("accessory", "headwear") or lbl in ("belt", "bag", "scarf", "hat", "cap", "beanie"):
            # Wearer's arms, legs, face, hair, and torso are NOT the accessory!
            # Subtract human body so hands, fingers, skin, and limbs don't cling to the accessory.
            garment_human_mask = human_mask_full
        # 2. Bottoms (pants, skirt, shorts, chinos): NEVER subtract legs! Pants cover legs. Subtract arms and head/torso.
        elif cat in ("bottom", "pants", "skirt") or lbl in ("pants", "skirt"):
            upper_human_ids = arm_class_ids | head_class_ids
            if upper_human_ids and np.isin(class_mask, list(upper_human_ids)).any():
                arm_m = np.isin(class_mask, list(upper_human_ids)).astype(np.uint8)
                if arm_m.any() and int(arm_m.sum()) >= 80:
                    from scipy import ndimage
                    h_h, h_w = arm_m.shape
                    smooth_sigma = max(1.5, min(5.0, float(min(h_h, h_w)) * 0.003))
                    arm_m = (ndimage.gaussian_filter(arm_m.astype(float), sigma=smooth_sigma) >= 0.5).astype(np.uint8)
                    garment_human_mask = arm_m
                else:
                    garment_human_mask = None
            else:
                garment_human_mask = None
        # 3. Tops, outerwear, dresses: head + arms (never legs)
        elif cat in ("top", "outerwear", "dress") or lbl in ("upper-clothes", "coat", "dress"):
            upper_human_ids = head_class_ids | arm_class_ids
            if upper_human_ids and np.isin(class_mask, list(upper_human_ids)).any():
                up_m = np.isin(class_mask, list(upper_human_ids)).astype(np.uint8)
                if up_m.any() and int(up_m.sum()) >= 80:
                    from scipy import ndimage
                    h_h, h_w = up_m.shape
                    smooth_sigma = max(1.5, min(5.0, float(min(h_h, h_w)) * 0.003))
                    up_m = (ndimage.gaussian_filter(up_m.astype(float), sigma=smooth_sigma) >= 0.5).astype(np.uint8)
                    garment_human_mask = up_m
                else:
                    garment_human_mask = None
            else:
                garment_human_mask = None
        else:
            garment_human_mask = human_mask_full

        raw_lbl = item["label"]
        canonical_lbl = _CANONICAL_LABEL.get(raw_lbl) or _CANONICAL_LABEL.get(str(raw_lbl).strip().lower(), raw_lbl)
        out.append(
            {
                "label": canonical_lbl,
                "category": item["category"],
                "score": float(item["score"]),
                "bbox": [
                    int(ymin / H * 1000),
                    int(xmin / W * 1000),
                    int(ymax / H * 1000),
                    int(xmax / W * 1000),
                ],
                "mask": item["mask"],
                "_human_mask_full": garment_human_mask,
                "_global_human_mask": human_mask_full,
                "has_human_head": bool(has_head),
                "has_human_skin": bool(has_any_human),
            }
        )
    logger.info(
        "clothing_parser: produced %d garment(s) labels=%s",
        len(out),
        [o["label"] for o in out],
    )
    return out


# ---------------------------------------------------------------------
# Helpers used by garment_vision.analyze_outfit to build cutout crops.
# ---------------------------------------------------------------------
def crop_with_mask(
    image_bytes: bytes,
    bbox_norm: list[int] | tuple[int, ...],
    mask: np.ndarray | None,
    *,
    padding_pct: float = 0.04,
) -> tuple[bytes, tuple[int, int, int, int]] | None:
    """Crop image to bbox+padding, optionally apply mask as alpha channel.

    * `bbox_norm` is `[ymin, xmin, ymax, xmax]` on 0..1000 scale.
    * `mask` is full-resolution binary uint8. When `None`, returns a
      plain JPEG crop (compatible with the legacy bbox path).
    * Returns `(image_bytes, (x1, y1, x2, y2))` or `None` on failure.
      Bytes are PNG when a mask is applied (preserves transparency),
      JPEG otherwise.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:  # noqa: BLE001
        return None
    W, H = img.size
    try:
        ymin, xmin, ymax, xmax = [int(v) for v in bbox_norm]
    except Exception:  # noqa: BLE001
        return None
    if not (0 <= xmin < xmax <= 1000 and 0 <= ymin < ymax <= 1000):
        return None
    x1 = max(0, int(xmin / 1000.0 * W - W * padding_pct))
    y1 = max(0, int(ymin / 1000.0 * H - H * padding_pct))
    x2 = min(W, int(xmax / 1000.0 * W + W * padding_pct))
    y2 = min(H, int(ymax / 1000.0 * H + H * padding_pct))
    if x2 - x1 <= 4 or y2 - y1 <= 4:
        return None

    if mask is None:
        out = img.convert("RGB").crop((x1, y1, x2, y2))
        buf = io.BytesIO()
        out.save(buf, format="JPEG", quality=88, optimize=True)
        return buf.getvalue(), (x1, y1, x2, y2)

    # Apply semantic mask as alpha
    rgba = img.convert("RGBA")
    cropped = rgba.crop((x1, y1, x2, y2))
    if mask.shape != (H, W):
        m_resized = np.array(
            Image.fromarray((mask * 255).astype(np.uint8), mode="L").resize(
                (W, H), Image.BILINEAR
            )
        )
    else:
        m_resized = (mask * 255).astype(np.uint8)
    mask_crop = m_resized[y1:y2, x1:x2]

    # Feather the alpha edge so the cutout doesn't look stair-stepped.
    # A 1.2 px gaussian blur softens binary edges into a clean anti-
    # aliased boundary without dissolving thin straps. Skip when Pillow
    # is not available with the filter (extremely rare).
    try:
        alpha_im = Image.fromarray(mask_crop, mode="L").filter(
            ImageFilter.GaussianBlur(radius=1.2)
        )
        # Re-clip to 0/255 range — the blur leaves us in 0..255 already.
        feathered = np.array(alpha_im)
    except Exception:  # noqa: BLE001
        feathered = mask_crop

    # Combine existing alpha with semantic mask (min = union-of-opaque).
    alpha = np.array(cropped.split()[-1])
    new_alpha = np.minimum(alpha, feathered).astype(np.uint8)
    cropped.putalpha(Image.fromarray(new_alpha, mode="L"))
    buf = io.BytesIO()
    cropped.save(buf, format="PNG", optimize=True)
    return buf.getvalue(), (x1, y1, x2, y2)


def bbox_to_pixels(
    image_bytes: bytes,
    bbox_norm: list[int] | tuple[int, ...],
    *,
    padding_pct: float = 0.04,
) -> tuple[int, int, int, int] | None:
    """Translate a 0..1000 bbox into pixel coords for the given image,
    applying the same padding the crop pipeline uses. Returns
    ``(x1, y1, x2, y2)`` or ``None`` if the bbox is degenerate.

    Useful when callers want a JPEG bbox crop AND a matching slice of a
    full-resolution mask (no second image decode needed).
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:  # noqa: BLE001
        return None
    W, H = img.size
    try:
        ymin, xmin, ymax, xmax = [int(v) for v in bbox_norm]
    except Exception:  # noqa: BLE001
        return None
    if not (0 <= xmin < xmax <= 1000 and 0 <= ymin < ymax <= 1000):
        return None
    x1 = max(0, int(xmin / 1000.0 * W - W * padding_pct))
    y1 = max(0, int(ymin / 1000.0 * H - H * padding_pct))
    x2 = min(W, int(xmax / 1000.0 * W + W * padding_pct))
    y2 = min(H, int(ymax / 1000.0 * H + H * padding_pct))
    if x2 - x1 <= 4 or y2 - y1 <= 4:
        return None
    return x1, y1, x2, y2


def _normalize_mask_to_u8(m: np.ndarray) -> np.ndarray:
    """Normalize any mask (bool, 0/1 int, 0.0-1.0 float, or 0/255 u8) to uint8 0/255."""
    if m is None or m.size == 0:
        return np.zeros((0, 0), dtype=np.uint8)
    if m.dtype == bool:
        return (m.astype(np.uint8) * 255)
    max_val = float(m.max())
    if max_val <= 1.0:
        return (m.astype(float) * 255.0).clip(0, 255).astype(np.uint8)
    return np.clip(m, 0, 255).astype(np.uint8)


def slice_mask_to_bbox(
    mask: np.ndarray, image_size: tuple[int, int], box_xyxy: tuple[int, int, int, int]
) -> np.ndarray | None:
    """Return the portion of ``mask`` covering the pixel-coord ``box_xyxy``.

    * ``mask`` is a full-resolution binary uint8 (0/1 or 0/255) array.
    * ``image_size`` is ``(W, H)`` — the original image's dimensions.
    * ``box_xyxy`` is ``(x1, y1, x2, y2)`` in pixel coords (already padded).

    Returns a uint8 binary mask sized ``(y2-y1, x2-x1)`` aligned to the
    bbox crop, or ``None`` on shape mismatch.
    """
    W, H = image_size
    x1, y1, x2, y2 = box_xyxy
    norm_mask = _normalize_mask_to_u8(mask)
    if norm_mask.shape != (H, W):
        # Resize to full resolution with smooth bilinear interpolation
        try:
            norm_mask = np.array(
                Image.fromarray(norm_mask, mode="L").resize(
                    (W, H), Image.BILINEAR
                )
            )
        except Exception:  # noqa: BLE001
            return None
    sliced = (norm_mask[y1:y2, x1:x2] > 127).astype(np.uint8)
    return sliced


def apply_alpha_intersection(
    matted_png_bytes: bytes,
    seg_mask_bbox: np.ndarray | None = None,
    *,
    category: str | None = None,
    label: str | None = None,
    human_mask: np.ndarray | None = None,
    is_padded_canvas: bool = False,
    other_mask: np.ndarray | None = None,
    is_single_item: bool = False,
) -> bytes | None:
    """Refine a rembg-matted PNG by AND-ing its alpha with a SegFormer mask.
    
    If is_single_item is True, returns matted_png_bytes immediately without
    modifying rembg's studio-grade alpha boundary.
    If seg_mask_bbox is None, still subtracts human_mask and other_mask to
    isolate non-SegFormer detections (e.g. Gemini-detected bags/accessories).
    """
    try:
        im = Image.open(io.BytesIO(matted_png_bytes)).convert("RGBA")
    except Exception:  # noqa: BLE001
        if is_single_item:
            return matted_png_bytes
        return None
    arr = np.array(im)
    Hc, Wc = arr.shape[:2]

    # GarmentVision spec: calibrated safety margins (4-16px)
    # SegFormer acts as a coarse semantic envelope; rembg provides studio-grade alpha boundaries.
    norm_cat = (category or "").lower().replace(" ", "").replace("-", "")
    norm_lbl = (label or "").lower().replace(" ", "").replace("-", "")
    is_eyewear = bool(
        norm_cat in {"sunglasses", "glasses", "eyewear"}
        or norm_lbl in {"sunglasses", "glasses", "eyewear"}
        or any(w in str(category).lower() for w in ("sunglass", "glasses", "eyewear", "משקפ"))
        or any(w in str(label).lower() for w in ("sunglass", "glasses", "eyewear", "משקפ"))
    )
    is_footwear = bool(
        norm_cat in {"footwear", "shoes"}
        or any(w in norm_lbl for w in ("shoe", "boot", "sneaker", "sandal", "slipper", "clog", "heel", "flopper", "slides"))
    )
    _dilate_pct = _resolve_dilate_pct_for_category(category, label=label)
    if is_eyewear:
        _dilate_pct = min(_dilate_pct, 0.015)
    _DILATE_MIN_PX = 2 if is_eyewear else 4
    _DILATE_MAX_PX = 4 if is_eyewear else 16
    dilate_px = max(_DILATE_MIN_PX, min(_DILATE_MAX_PX, int(round(_dilate_pct * min(Hc, Wc) * 0.5))))

    mask_resized = None
    garment_core = None
    if seg_mask_bbox is not None:
        norm_seg = _normalize_mask_to_u8(seg_mask_bbox)
        # Resize mask with bilinear interpolation so contours remain continuous (never jagged NEAREST blocks)
        if norm_seg.shape != (Hc, Wc):
            try:
                mask_resized = np.array(
                    Image.fromarray(norm_seg, mode="L").resize((Wc, Hc), Image.BILINEAR)
                )
            except Exception:  # noqa: BLE001
                return None
        else:
            mask_resized = norm_seg

        # Patch 12g (May 2026) — SegFormer mask confidence check.
        # Small items (sunglasses, footwear, accessories) legitimately have small pixel counts.
        mask_pixels = int((mask_resized > 64).sum())
        if mask_pixels < 10 and not is_padded_canvas:
            logger.info(
                "apply_alpha_intersection: SegFormer mask empty (%d px) — keeping rembg-only output (crop %dx%d).",
                mask_pixels, Wc, Hc,
            )
            return matted_png_bytes if is_single_item else None

        is_bottom = norm_cat in {"bottom", "pants", "skirt"} or any(w in norm_lbl for w in ("short", "skirt", "pant", "trouser", "jean"))
        is_multi_segment = is_footwear or is_eyewear
        # Build solid garment core and protection region to protect fabric from false chewing
        try:
            from scipy import ndimage
            mask_bin_core = mask_resized > 64
            closed_core = ndimage.binary_closing(mask_bin_core, structure=np.ones((3 if is_multi_segment else 5, 3 if is_multi_segment else 5), dtype=bool), iterations=1)
            # Fill enclosed holes inside garment body (protects fabric from shadow-dropout chewing).
            # Bottoms (pants, jeans, chinos) are solid opaque fabric; enclosed holes are dark folds/shadows.
            filled_core = closed_core if is_multi_segment else ndimage.binary_fill_holes(closed_core)
            # garment_protect covers the garment interior where mask is confident or filled
            garment_protect = filled_core | (mask_resized > 50)
            core_iter = max(1, min(2, int(round(min(Hc, Wc) * 0.005))))
            garment_core = ndimage.binary_erosion(filled_core, iterations=core_iter)
        except Exception:  # noqa: BLE001
            garment_protect = mask_resized > 50 if mask_resized is not None else None
            garment_core = None

        garment_weight = np.clip((mask_resized.astype(float) - 20.0) / 80.0, 0.0, 1.0)
    else:
        is_bottom = norm_cat in {"bottom", "pants", "skirt"} or any(w in norm_lbl for w in ("short", "skirt", "pant", "trouser", "jean"))
        is_multi_segment = is_footwear or is_eyewear
        garment_weight = None
        garment_protect = None

    # Initialize new_alpha with rembg's studio-grade alpha
    new_alpha = arr[:, :, 3].copy()
    has_human = human_mask is not None and bool(human_mask.any())
    is_acc = (
        norm_cat in {"accessory", "headwear", "bag", "belt", "jewelry"}
        or any(w in norm_lbl for w in ("hat", "cap", "beanie", "bag", "belt", "necklace", "watch", "bracelet"))
    )

    # 1. Smooth, anti-aliased human mask subtraction (face, hair, skin, arms, legs)
    if has_human:
        try:
            norm_human = _normalize_mask_to_u8(human_mask)
            if norm_human.shape != (Hc, Wc):
                human_resized = np.array(
                    Image.fromarray(norm_human, mode="L").resize((Wc, Hc), Image.BILINEAR)
                )
            else:
                human_resized = norm_human

            # Zero out human mask over the target garment interior so garment fabric is NEVER chewed
            if garment_protect is not None and garment_protect.any():
                human_clean = np.where(garment_protect, np.uint8(0), human_resized)
            elif garment_weight is not None:
                human_clean = (human_resized.astype(float) * (1.0 - garment_weight)).round().astype(np.uint8)
            else:
                human_clean = human_resized

            # Anti-aliased Gaussian blur on subtraction mask
            human_blur = Image.fromarray(human_clean, mode="L").filter(ImageFilter.GaussianBlur(radius=1.5))
            human_factor = np.array(human_blur, dtype=float) / 255.0

            # Outside garment_protect, subtract human parts smoothly
            sub_human = np.clip(1.0 - human_factor, 0.0, 1.0)
            if garment_protect is not None and garment_protect.any():
                # Smooth the transition with Gaussian anti-aliasing to eliminate staircase-like edges on shoes and collars
                from scipy import ndimage
                protect_smooth = ndimage.gaussian_filter(garment_protect.astype(float), sigma=1.2)
                sub_human = np.clip(sub_human * (1.0 - protect_smooth) + 1.0 * protect_smooth, 0.0, 1.0)
            new_alpha = (new_alpha.astype(float) * sub_human).round().astype(np.uint8)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "apply_alpha_intersection: human-mask subtraction failed: %s",
                repr(exc)[:120],
            )

    # 2. Human skin chrominance filter outside confident garment body
    # (Excises bare neck skin, hanging hands next to jacket hems, fingers on waistbands, bare legs)
    if not is_single_item or is_eyewear or is_acc:
        try:
            r = arr[:, :, 0].astype(float)
            g = arr[:, :, 1].astype(float)
            b = arr[:, :, 2].astype(float)
            cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
            cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
            is_skin = (
                (cr >= 133.0) & (cr <= 173.0) &
                (cb >= 77.0) & (cb <= 127.0) &
                (r > g) & (g > b) &
                ((r - g) >= 12.0) &
                (new_alpha > 30)
            )
            if is_bottom and mask_resized is not None:
                # Hands/wrists resting on the waistband (top 28% of pants crop)
                y_coords = np.arange(Hc)[:, None]
                is_waist_zone = y_coords <= (0.28 * Hc)
                is_skin = is_skin & ((mask_resized <= 40) | is_waist_zone)
            elif (norm_cat in {"top", "outerwear", "suit", "fullbody", "dress"}) and mask_resized is not None:
                # Hands hanging next to jacket hems (bottom 25% of jacket crop)
                y_coords = np.arange(Hc)[:, None]
                is_hem_zone = y_coords >= (0.75 * Hc)
                is_skin = is_skin & ((mask_resized <= 40) | is_hem_zone)
            if is_skin.any():
                skin_u8 = (is_skin * 255).astype(np.uint8)
                if garment_protect is not None and garment_protect.any():
                    skin_clean = np.where(garment_protect, np.uint8(0), skin_u8)
                elif garment_weight is not None:
                    skin_clean = (skin_u8.astype(float) * (1.0 - garment_weight)).round().astype(np.uint8)
                else:
                    skin_clean = skin_u8

                skin_blur = Image.fromarray(skin_clean, mode="L").filter(ImageFilter.GaussianBlur(radius=1.5))
                skin_factor = np.array(skin_blur, dtype=float) / 255.0
                sub_skin = np.clip(1.0 - skin_factor, 0.0, 1.0)
                if garment_protect is not None and garment_protect.any():
                    from scipy import ndimage
                    protect_smooth = ndimage.gaussian_filter(garment_protect.astype(float), sigma=1.2)
                    sub_skin = np.clip(sub_skin * (1.0 - protect_smooth) + 1.0 * protect_smooth, 0.0, 1.0)
                new_alpha = (new_alpha.astype(float) * sub_skin).round().astype(np.uint8)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "apply_alpha_intersection: skin-chrominance subtraction failed: %s",
                repr(exc)[:120],
            )

    # 2b. Upper garment neck/head trimming:
    # A human head, neck, chin, or throat must NEVER float above collars or lapels of tops/outerwear/suits!
    if norm_cat in {"top", "outerwear", "suit", "dress", "fullbody"} and not is_single_item and mask_resized is not None:
        try:
            garment_pts = np.where(mask_resized > 40)
            if len(garment_pts[0]) > 0:
                ys, xs = garment_pts
                apex_y = int(ys.min())
                # Anything above the garment apex is strictly head / neck / background
                if apex_y > 2:
                    new_alpha[:max(0, apex_y - 2), :] = 0

                # Column-wise contour trimming along the central neckline/collar notch
                col_min_y = np.full(Wc, Hc, dtype=int)
                np.minimum.at(col_min_y, xs, ys)
                # Bounding: a neckline curve never dips deeper than 18% of crop height from apex.
                # Deeper dips are occlusions (hair, jewelry, scarves, hands) and must NOT slice the garment!
                max_neck_dip = min(Hc - 1, apex_y + max(12, int(0.18 * Hc)))
                col_min_y = np.minimum(col_min_y, max_neck_dip)

                # Restrict column trimming to the central neck/throat corridor (20% to 80% of width)
                # so shoulders, lapels, and fur collars on either side are never truncated.
                neck_cols = np.zeros(Wc, dtype=bool)
                neck_cols[int(0.20 * Wc):int(0.80 * Wc)] = True
                valid_cols = (col_min_y < Hc) & neck_cols
                if valid_cols.any():
                    y_indices = np.arange(Hc)[:, None]
                    # Pixels above the collar in the central neck zone are neck/face/background
                    above_collar = (y_indices < (col_min_y[None, :] - 3)) & valid_cols[None, :]
                    new_alpha = np.where(above_collar, np.uint8(0), new_alpha)
        except Exception as _neck_exc:
            logger.debug("apply_alpha_intersection collar neck trim: %s", _neck_exc)

    # 3. Soft envelope boundary containment (multi-garment separation handled by dilated soft envelope below)
    pass

    # 3b. Suppress adjacent garments (pants over shoes, shirts under jackets, straps) using other_mask
    if other_mask is not None and bool(other_mask.any()) and not is_single_item:
        try:
            norm_other = _normalize_mask_to_u8(other_mask)
            if norm_other.shape != (Hc, Wc):
                other_resized = np.array(
                    Image.fromarray(norm_other, mode="L").resize((Wc, Hc), Image.BILINEAR)
                )
            else:
                other_resized = norm_other

            # Protect garment body so adjacent items never bite into or chew the target garment's fabric
            protect_zone = garment_protect if (garment_protect is not None and garment_protect.any()) else garment_core
            if protect_zone is not None and protect_zone.any():
                other_clean = np.where(protect_zone, np.uint8(0), other_resized)
            elif garment_weight is not None:
                other_clean = (other_resized.astype(float) * (1.0 - garment_weight)).round().astype(np.uint8)
            else:
                other_clean = other_resized

            other_blur = Image.fromarray(other_clean, mode="L").filter(ImageFilter.GaussianBlur(radius=1.5))
            other_factor = np.array(other_blur, dtype=float) / 255.0
            sub_other = np.clip(1.0 - other_factor, 0.0, 1.0)
            if protect_zone is not None and protect_zone.any():
                from scipy import ndimage
                protect_smooth = ndimage.gaussian_filter(protect_zone.astype(float), sigma=1.2)
                sub_other = np.clip(sub_other * (1.0 - protect_smooth) + 1.0 * protect_smooth, 0.0, 1.0)
            new_alpha = (new_alpha.astype(float) * sub_other).round().astype(np.uint8)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "apply_alpha_intersection: other_mask subtraction failed: %s",
                repr(exc)[:120],
            )

    # 4. Intersect with the smooth, dilated soft envelope of the target garment.
    # On single items, envelope truncation is skipped so rembg's outer garment contours
    # (collars, cuffs, hoods) are never truncated if SegFormer is slightly undersized.
    if mask_resized is not None and not is_single_item:
        try:
            from scipy import ndimage
            mask_bin = mask_resized > 50
            closed = ndimage.binary_closing(mask_bin, structure=np.ones((3 if (is_eyewear or is_footwear or is_acc) else 5, 3 if (is_eyewear or is_footwear or is_acc) else 5), dtype=bool), iterations=1)
            filled = closed if is_multi_segment else ndimage.binary_fill_holes(closed)
            
            filled_im = Image.fromarray((filled * 255).astype(np.uint8), mode="L")
            env_dilate = 2 if (is_eyewear or is_footwear or is_acc) else dilate_px
            if env_dilate > 0:
                filled_im = filled_im.filter(ImageFilter.MaxFilter(2 * env_dilate + 1))
            blur_r = 1.5 if (is_eyewear or is_footwear or is_acc) else 3.0
            filled_im = filled_im.filter(ImageFilter.GaussianBlur(radius=blur_r))
            soft_envelope = np.array(filled_im).astype(float) / 255.0
            
            # RULE: SegFormer envelope must ONLY exclude far-away background debris (where envelope <= 0.01).
            # It must NEVER multiply or truncate rembg's anti-aliased alpha boundary inside the garment!
            new_alpha = np.where(soft_envelope <= 0.01, np.uint8(0), new_alpha)

            # Footwear pavement smear cleanup: outside the two shoes (where mask_resized < 25), wipe any pavement/asphalt smear left by rembg
            if is_footwear:
                pavement_smear = (mask_resized < 25) & (soft_envelope < 0.25)
                new_alpha = np.where(pavement_smear, np.uint8(0), new_alpha)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "apply_alpha_intersection: soft-mask intersection failed: %s",
                repr(exc)[:120],
            )

    # Enforce solid fabric interior: garments are opaque. White/light garments must never become
    # semi-transparent (X-ray-like) against the card background, and light fabric folds or sleeves
    # must never be bitten away by background matting salience dropouts!
    # To prevent staircases and sharp cliffs, we smoothly feather the interior core mask with Gaussian blur.
    if garment_core is not None and garment_core.any():
        core_u8 = (garment_core * 255).astype(np.uint8)
        if norm_cat in {"top", "outerwear", "dress"}:
            # Preserve crew-neck collar opening at top-center of tops if transparent in input
            non_zero_rows = np.where(mask_resized > 50)[0]
            non_zero_cols = np.where(mask_resized > 50)[1]
            if len(non_zero_rows) > 0 and len(non_zero_cols) > 0:
                t_y, b_y = int(non_zero_rows.min()), int(non_zero_rows.max())
                l_x, r_x = int(non_zero_cols.min()), int(non_zero_cols.max())
                g_h = max(1, b_y - t_y)
                g_w = max(1, r_x - l_x)
                c_x = (l_x + r_x) / 2.0
                y_idx, x_idx = np.indices((Hc, Wc))
                is_collar_zone = (
                    (y_idx >= t_y) & (y_idx <= t_y + 0.35 * g_h) &
                    (np.abs(x_idx - c_x) <= 0.25 * g_w)
                )
                core_u8 = np.where(is_collar_zone & (new_alpha == 0), np.uint8(0), core_u8)

        feather_im = Image.fromarray(core_u8, mode="L").filter(ImageFilter.GaussianBlur(radius=2.0))
        feather_factor = np.array(feather_im, dtype=float) / 255.0
        target_core_alpha = 250.0 if (norm_cat in {"bottom", "pants", "skirt", "fullbody", "suit"} or not is_multi_segment) else 235.0
        healed_alpha = np.maximum(new_alpha.astype(float), feather_factor * target_core_alpha)
        new_alpha = np.clip(healed_alpha, 0, 255).astype(np.uint8)

    # Note: SegFormer's coarse mask must NEVER force transparent background pixels (alpha < 128)
    # to 255. Rembg provides studio-grade alpha boundaries; forcing opaque holes creates
    # jagged staircases, sawtooth edges, and opaque blocks between legs or in necklines.

    # Phantom guard: if subtraction wiped out solid alpha, recover from SegFormer mask or preserve rembg.
    # For small items (sunglasses, footwear, accessories), keep isolated cutouts even if pixel count is small.
    # NEVER revert to un-matted face/head or feet on asphalt when valid item pixels exist!
    solid_count = int((new_alpha >= 128).sum())
    if is_eyewear or is_acc or is_footwear:
        if solid_count < 20:
            if mask_resized is not None and int((mask_resized > 50).sum()) >= 10:
                logger.info("apply_alpha_intersection: small item recovering alpha from SegFormer mask")
                seg_alpha = mask_resized.copy()
                if has_human and 'human_resized' in locals() and human_resized is not None:
                    seg_alpha = np.where(human_resized > 120, np.uint8(0), seg_alpha)
                new_alpha = np.where(seg_alpha > 50, np.uint8(255), np.uint8(0))
                alpha_im = Image.fromarray(new_alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=1.2))
                new_alpha = np.array(alpha_im)
            elif solid_count < 5:
                logger.info(
                    "apply_alpha_intersection: small item empty (count=%d) — returning None.",
                    solid_count,
                )
                return None
    else:
        if solid_count < 40:
            if mask_resized is not None and int((mask_resized > 50).sum()) >= 40:
                logger.info(
                    "apply_alpha_intersection: solid_count=%d < 40, recovering alpha from SegFormer mask (mask_pixels=%d)",
                    solid_count, int((mask_resized > 50).sum()),
                )
                seg_alpha = mask_resized.copy()
                if has_human and 'human_resized' in locals() and human_resized is not None:
                    seg_alpha = np.where(human_resized > 120, np.uint8(0), seg_alpha)
                new_alpha = np.where(seg_alpha > 50, np.uint8(255), np.uint8(0))
                alpha_im = Image.fromarray(new_alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=1.2))
                new_alpha = np.array(alpha_im)
            elif float((new_alpha >= 128).mean()) < 0.003:
                logger.info(
                    "apply_alpha_intersection: intersection wiped out solid "
                    "alpha (count=%d) — returning None to preserve rembg-only output.",
                    solid_count,
                )
                return None

    arr[:, :, 3] = new_alpha
    out = Image.fromarray(arr, mode="RGBA")
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Per-category dilation budget table (GarmentVision spec).
# ---------------------------------------------------------------------------
# Keyed by normalized category string (lowercase, spaces removed).
# Provides safe 4-6% dilation margins so SegFormer envelopes encapsulate
# the garment without clipping rembg's smooth subpixel edges.
_DILATE_PCT_BY_CATEGORY: dict[str, float] = {
    "top": 0.04,
    "bottom": 0.04,
    "dress": 0.04,
    "fullbody": 0.04,
    "full body": 0.04,
    "accessory": 0.04,
    "accessories": 0.04,
    "sunglasses": 0.02,
    "glasses": 0.02,
    "eyewear": 0.02,
    "underwear": 0.04,
    "outerwear": 0.04,
    "footwear": 0.06,
    "shoes": 0.06,
    "sneakers": 0.06,
    "boots": 0.06,
    "headwear": 0.05,
    "hat": 0.05,
    "unknown": 0.04,
}
_DILATE_PCT_DEFAULT = 0.04


def _resolve_dilate_pct_for_category(category: str | None, label: str | None = None) -> float:
    """Look up the per-category dilation budget.

    Case-insensitive, whitespace-insensitive. Falls back to
    ``_DILATE_PCT_DEFAULT`` (4.0 %) when the category is missing or not in table.
    """
    for candidate in (label, category):
        if not candidate:
            continue
        key = str(candidate).strip().lower()
        if not key:
            continue
        if key in _DILATE_PCT_BY_CATEGORY:
            return _DILATE_PCT_BY_CATEGORY[key]
        key_collapsed = key.replace(" ", "")
        if key_collapsed in _DILATE_PCT_BY_CATEGORY:
            return _DILATE_PCT_BY_CATEGORY[key_collapsed]
        if any(w in key for w in ("sunglass", "glasses", "eyewear", "משקפ")):
            return 0.015
    return _DILATE_PCT_DEFAULT
