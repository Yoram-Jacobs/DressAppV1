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
    "Hat": "hat",
    "headband, head covering, hair accessory": "headwear",
    "Headwear": "headwear",
    "headwear": "headwear",
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
    "bottom":    0.0012,           # skirts, pants, palazzo pants in full-body shots
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

    # Guard: Two distinct substantial figures/columns side-by-side with a clear gap between them
    # are two separate bodies/views (e.g. front & side views, or two models), not parts of one single top!
    w_a = max(1, ax2 - ax1)
    w_b = max(1, bx2 - bx1)
    h_a = max(1, ay2 - ay1)
    h_b = max(1, by2 - by1)
    if (
        dx > max(8, int(0.04 * frame_short))
        and min(w_a, w_b) >= int(0.12 * frame_short)
        and min(h_a, h_b) >= int(0.25 * frame_short)
    ):
        return False

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

    if class_binary.sum() < 32:
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
        cat = _get_label_category(label_name)
        if cat is None:
            continue
        class_binary = (class_mask == cid_i).astype(np.uint8)

        min_px = 24 if cat in ("footwear", "accessory", "headwear") else 48

        if label_name in _SINGLE_INSTANCE_CLASSES:
            for sub in _split_into_spatial_groups(class_binary):
                if int(sub.sum()) >= min_px:
                    out.append((label_name, sub))
            continue

        # Multi-instance-allowed classes (shoes, accessories, …):
        # keep the legacy connected-component split so a user wearing
        # two distinct shoes / a hat + a scarf gets one detection
        # per item.
        labeled, n = ndimage.label(class_binary)
        for inst in range(1, n + 1):
            mask = (labeled == inst).astype(np.uint8)
            if mask.sum() >= min_px:  # drop tiny noise
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
                    or (not has_human and outer_area < 0.25 * max(1, top_area))
                    or top_w < 0.25 * outer_w
                    or top_h < 0.25 * outer_h
                    or (not has_human and outer_w < 0.25 * top_w)
                    or (not has_human and outer_h < 0.25 * top_h)
                    or (top_bb[2] <= outer_bb[0] + int(0.35 * outer_h))
                )
                if is_subpart_fragment:
                    if outer_area >= top_area:
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
                    else:
                        if kept_cat == "top":
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
                is_flatlay_top_bottom = (not has_human) and (
                    {kept_cat, item_cat} in ({"top", "bottom"}, {"top", "dress"}, {"bottom", "dress"}, {"outerwear", "bottom"})
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
            elif "dress" in (kept_cat, item_cat) or "dress" in (str(kept_lbl).lower(), str(lbl).lower()):
                kept_lbl = "Dress"
                kept_item["label"] = "Dress"
                kept_item["category"] = "dress"
            elif {kept_cat, item_cat} in ({"top", "bottom"}, {"outerwear", "bottom"}):
                kept_lbl = "Dress"
                kept_item["label"] = "Dress"
                kept_item["category"] = "dress"
            elif (kept_lbl == "Dress" and lbl == "Upper-clothes") or (kept_lbl == "Pants" and lbl == "Upper-clothes"):
                kept_lbl = "Dress"
                kept_item["label"] = "Dress"
                kept_item["category"] = "dress"
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
    img_arr = np.array(img)

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
    # Always compute skin chrominance to catch hands, wrists, neck, and limbs
    # that SegFormer frequently misclassifies as background or outer garment edge.
    skin_mask_found = None
    try:
        arr = np.array(img)
        r = arr[:, :, 0].astype(float)
        g = arr[:, :, 1].astype(float)
        b = arr[:, :, 2].astype(float)
        cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
        cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
        is_skin = (
            (cr >= 133.0) & (cr <= 173.0) &
            (cb >= 88.0) & (cb <= 127.0) &
            (r > g) & (g > b) &
            ((r - g) >= 12.0) &
            ((g - b) <= 42.0)
        )
        garment_occupied = class_mask > 0
        skin_outside = is_skin & (~garment_occupied)
        # Also include skin at the periphery/lower/side areas where hands protrude from cuffs
        y_grid, x_grid = np.ogrid[:H, :W]
        is_hand_zone_full = (y_grid >= 0.50 * H) | ((y_grid >= 0.40 * H) & ((x_grid <= 0.38 * W) | (x_grid >= 0.62 * W)))
        skin_protruding = is_skin & is_hand_zone_full
        skin_combined = skin_outside | skin_protruding
        skin_px = int(skin_combined.sum())
        skin_frac = skin_px / float(total)
        # Relax minimum threshold from 1.5% to 0.2% so cropped model shots with only hands/wrists are detected.
        if 0.002 <= skin_frac <= 0.28:
            skin_mask_found = skin_combined.astype(np.uint8)
            has_any_human = True
            if int(skin_outside[:int(0.35 * H), :].sum()) >= 30:
                has_head = True
    except Exception:
        skin_mask_found = None

    if human_class_ids and (has_head or has_any_human):
        seg_human = np.isin(class_mask, list(human_class_ids)).astype(np.uint8)
        if skin_mask_found is not None:
            human_mask_full = (seg_human | skin_mask_found).astype(np.uint8)
        else:
            human_mask_full = seg_human
    elif skin_mask_found is not None:
        human_mask_full = skin_mask_found
    else:
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

    has_human = bool(has_head or (human_mask_full is not None and int(human_mask_full.sum()) >= 150))

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
            # Disconnected accessory specks on opposite sides of the body are noise (except for belts which span the waist).
            if category in ("accessory", "headwear") and not label_name.lower().startswith("belt"):
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
                o_lbl = (other_it.get("label") or "").lower()

                # Shoes/footwear must NEVER absorb tops, bottoms, dresses, or outerwear!
                if o_cat in ("top", "bottom", "dress", "outerwear") or any(
                    w in o_lbl for w in ("pant", "skirt", "shirt", "jacket", "coat", "dress", "sweater", "hoodie", "top", "trouser", "jean", "chino", "short", "blouse", "t-shirt", "cardigan", "vest")
                ):
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

    # 2a-2) Collapse all Belt pieces into a single "Belt" item
    belt_keys = [k for k in list(by_label.keys()) if k.lower().startswith("belt")]
    if belt_keys:
        belt_items = [by_label.pop(k) for k in belt_keys]
        belt_masks = [x["mask"] for x in belt_items if x and x.get("mask") is not None]
        if belt_masks:
            combined = belt_masks[0]
            for m in belt_masks[1:]:
                combined = np.maximum(combined, m)
            by_label["Belt"] = {
                "label": "Belt",
                "category": "accessory",
                "score": 0.95,
                "mask": combined,
            }

    # 2a-3) Belt Consolidation (when SegFormer fragments a belt into buckle and strap pieces mislabeled as skirt/pants/accessory)
    if "Belt" in by_label:
        from scipy import ndimage
        while True:
            belt_mask = by_label["Belt"]["mask"]
            belt_bb = _mask_bbox(belt_mask)
            if not belt_bb:
                break
            by1, bx1, by2, bx2 = belt_bb
            belt_h = max(1, by2 - by1)
            belt_y_center = (by1 + by2) / 2.0
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Belt" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_h = max(1, oy2 - oy1)
                o_cat = (other_it.get("category") or "").lower()
                o_lbl = (other_it.get("label") or "").lower()

                # Belt must NEVER absorb tops, bottoms, dresses, outerwear, or footwear!
                if o_cat in ("top", "bottom", "dress", "outerwear", "footwear") or any(
                    w in o_lbl for w in ("pant", "skirt", "shirt", "jacket", "coat", "dress", "sweater", "hoodie", "top", "trouser", "jean", "chino", "short", "blouse", "t-shirt", "cardigan", "vest", "shoe", "boot", "sandal")
                ):
                    continue

                x_inter = max(0, min(bx2, ox2) - max(bx1, ox1))
                y_inter = max(0, min(by2, oy2) - max(by1, oy1))
                o_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_belt = ndimage.binary_dilation(by_label["Belt"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_belt).any()
                is_proximate = _is_same_garment_component(belt_bb, obb, min(H, W))
                vert_center_diff = abs(belt_y_center - ((oy1 + oy2) / 2.0))
                # For belts, strap pieces share the same horizontal band and are relatively thin (height <= 35% frame)
                is_belt_band = ((vert_center_diff <= int(0.20 * H)) or (y_inter > 0)) and (o_h <= int(0.35 * H))

                if touches or is_proximate or box_containment >= 0.20 or is_belt_band:
                    logger.info("clothing_parser: consolidating belt fragment '%s' into Belt", other_key)
                    by_label["Belt"]["mask"] = np.maximum(by_label["Belt"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    # 2a-3b) Detect and synthesize Hat when SegFormer (Fashion 47-class) fragments a baseball cap into
    # crown (vest/top/jacket/hood) and brim/visor (shorts/pants/skirt)
    if not any(k.lower().startswith(("hat", "headwear", "cap", "beanie")) or (v and v.get("category") == "headwear") for k, v in by_label.items()) and not has_human:
        from scipy import ndimage
        dome_candidates = []
        brim_candidates = []
        for k, it in list(by_label.items()):
            m = it.get("mask")
            if m is None:
                continue
            bb = _mask_bbox(m)
            if not bb:
                continue
            y1, x1, y2, x2 = bb
            h = max(1, y2 - y1)
            w = max(1, x2 - x1)
            cat = (it.get("category") or "").lower()
            lbl = (it.get("label") or "").lower()

            # Visor/brim candidates: wide, short bottom piece (shorts, pants, skirt)
            is_brim_candidate = (
                cat in ("bottom", "accessory")
                or any(b in lbl for b in ("short", "pant", "skirt", "belt", "scarf"))
            ) and (h <= int(0.65 * H)) and (float(w) / float(h) >= 0.9)

            # Dome candidates: compact upper piece (vest, top, jacket, hoodie)
            is_dome_candidate = (
                cat in ("top", "outerwear", "headwear")
                or any(d in lbl for d in ("vest", "top", "shirt", "jacket", "sweater", "hood", "cover"))
            ) and (h <= int(0.80 * H))

            if is_brim_candidate:
                brim_candidates.append((k, bb, it))
            elif is_dome_candidate:
                dome_candidates.append((k, bb, it))

        hat_pair_found = False
        for d_k, d_bb, d_it in dome_candidates:
            if hat_pair_found:
                break
            dy1, dx1, dy2, dx2 = d_bb
            d_w = max(1, dx2 - dx1)
            d_h = max(1, dy2 - dy1)
            for b_k, b_bb, b_it in brim_candidates:
                by1, bx1, by2, bx2 = b_bb
                b_w = max(1, bx2 - bx1)
                b_h = max(1, by2 - by1)

                vert_gap = max(0, by1 - dy2) if by1 >= dy2 else 0
                horiz_overlap = max(0, min(dx2, bx2) - max(dx1, bx1))
                total_h = max(dy2, by2) - min(dy1, by1)
                total_w = max(dx2, bx2) - min(dx1, bx1)

                is_cap_geometry = (
                    (by1 >= dy1 + int(0.20 * d_h))
                    and (vert_gap <= int(0.12 * H))
                    and (horiz_overlap >= int(0.20 * min(d_w, b_w)))
                    and (total_h <= int(0.95 * H))
                    and (float(total_w) / float(total_h) >= 0.60)
                )
                if is_cap_geometry:
                    logger.info("clothing_parser: synthesized Hat from dome '%s' and brim '%s'", d_k, b_k)
                    combined_mask = np.maximum(d_it["mask"], b_it["mask"])
                    by_label["Hat"] = {
                        "label": "Hat",
                        "category": "headwear",
                        "score": 0.95,
                        "mask": combined_mask,
                    }
                    del by_label[d_k]
                    del by_label[b_k]
                    hat_pair_found = True
                    break

    # 2a-4) Collapse all Hat/Headwear pieces into a single "Hat" item
    hat_keys = [
        k for k, v in list(by_label.items())
        if k.lower().startswith(("hat", "headwear", "cap", "beanie"))
        or (v and v.get("category") == "headwear")
        or "head covering" in k.lower()
    ]
    if hat_keys:
        hat_items = [by_label.pop(k) for k in hat_keys]
        hat_masks = [x["mask"] for x in hat_items if x and x.get("mask") is not None]
        if hat_masks:
            combined = hat_masks[0]
            for m in hat_masks[1:]:
                combined = np.maximum(combined, m)
            by_label["Hat"] = {
                "label": "Hat",
                "category": "headwear",
                "score": 0.95,
                "mask": combined,
            }

    # 2a-5) Headwear Consolidation (when SegFormer fragments a hat/cap into crown, visor/brim, and embroidery patches)
    if "Hat" in by_label:
        from scipy import ndimage
        while True:
            hat_mask = by_label["Hat"]["mask"]
            hat_bb = _mask_bbox(hat_mask)
            if not hat_bb:
                break
            hy1, hx1, hy2, hx2 = hat_bb
            hat_h = max(1, hy2 - hy1)
            hat_w = max(1, hx2 - hx1)
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Hat" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_h = max(1, oy2 - oy1)
                o_w = max(1, ox2 - ox1)
                o_cat = (other_it.get("category") or "").lower()
                o_lbl = (other_it.get("label") or "").lower()

                # Hat must NEVER absorb tops, bottoms, dresses, outerwear, or footwear!
                if o_cat in ("top", "bottom", "dress", "outerwear", "footwear") or any(
                    w in o_lbl for w in ("pant", "skirt", "shirt", "jacket", "coat", "dress", "sweater", "hoodie", "top", "trouser", "jean", "chino", "short", "blouse", "t-shirt", "cardigan", "vest", "shoe", "boot", "sandal")
                ):
                    continue

                x_inter = max(0, min(hx2, ox2) - max(hx1, ox1))
                y_inter = max(0, min(hy2, oy2) - max(hy1, oy1))
                o_box_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_box_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_hat = ndimage.binary_dilation(by_label["Hat"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_hat).any()
                is_proximate = _is_same_garment_component(hat_bb, obb, min(H, W))

                # Visor / brim check:
                vert_gap = max(0, oy1 - hy2) if oy1 >= hy2 else max(0, hy1 - oy2)
                horiz_overlap = max(0, min(hx2, ox2) - max(hx1, ox1))
                total_comb_h = max(hy2, oy2) - min(hy1, oy1)
                is_adjacent_brim = (
                    (vert_gap <= int(0.12 * H))
                    and (horiz_overlap >= int(0.20 * min(hat_w, o_w)))
                    and (o_h <= int(0.65 * H))
                    and (total_comb_h <= int(0.95 * H) or not has_human)
                )

                if touches or is_proximate or box_containment >= 0.20 or is_adjacent_brim:
                    logger.info("clothing_parser: consolidating headwear fragment '%s' into Hat", other_key)
                    by_label["Hat"]["mask"] = np.maximum(by_label["Hat"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    # Drop false-positive Hat on torso/lower body when human model is present
    if "Hat" in by_label and has_human:
        h_bb = _mask_bbox(by_label["Hat"]["mask"])
        if h_bb and h_bb[0] >= int(0.20 * H):
            logger.info("clothing_parser: dropping false-positive Hat on torso (ymin=%d >= 0.20*H)", h_bb[0])
            del by_label["Hat"]

    # 2a-5b) Anatomical human model detection from garment layout:
    # A person wearing an outfit has an upper garment (top/dress/outerwear) above a bottom (pants/skirt)
    # or footwear (shoes) spanning a significant vertical frame height.
    top_candidates_init = [
        it for it in by_label.values()
        if (it.get("category") in ("top", "outerwear", "dress") or any(w in (it.get("label") or "").lower() for w in ("upper", "coat", "jacket", "shirt", "sweater", "dress", "kurta"))) and it.get("mask") is not None
    ]
    bottom_candidates_init = [
        it for it in by_label.values()
        if (it.get("category") == "bottom" or any(p in (it.get("label") or "").lower() for p in ("pant", "skirt", "trouser", "jean", "short", "chino", "legging")))
        and it.get("mask") is not None
    ]
    footwear_candidates_init = [
        it for it in by_label.values()
        if (it.get("category") == "footwear" or "shoe" in (it.get("label") or "").lower() or "boot" in (it.get("label") or "").lower())
        and it.get("mask") is not None
    ]
    if top_candidates_init and bottom_candidates_init:
        min_top_y = min(_mask_bbox(it["mask"])[0] for it in top_candidates_init if _mask_bbox(it["mask"]))
        min_bot_y = min(_mask_bbox(it["mask"])[0] for it in bottom_candidates_init if _mask_bbox(it["mask"]))
        max_bot_y = max(_mask_bbox(it["mask"])[2] for it in bottom_candidates_init if _mask_bbox(it["mask"]))
        if min_top_y < min_bot_y and (max_bot_y - min_top_y) >= int(0.25 * H):
            has_human = True
            has_head = True
            has_any_human = True
    elif (top_candidates_init or bottom_candidates_init) and footwear_candidates_init:
        upper_y = min(
            _mask_bbox(it["mask"])[0]
            for it in (top_candidates_init or bottom_candidates_init)
            if _mask_bbox(it["mask"])
        )
        shoe_y = max(
            _mask_bbox(it["mask"])[2]
            for it in footwear_candidates_init
            if _mask_bbox(it["mask"])
        )
        if (shoe_y - upper_y) >= int(0.35 * H):
            has_human = True
            has_head = True
            has_any_human = True

    # 2a-6) Full-Body / Dress / Abaya / Kaftan / Jumpsuit Consolidation:
    # SegFormer frequently fragments a long continuous garment (e.g. Abaya, Galabiya, Kaftan,
    # Djellaba, long dress, maxi dress, jumpsuit) into separate Upper-clothes (top/outerwear)
    # and Skirt / Pants (bottom).
    # When an upper garment meets a lower garment at the waist/vertical corridor,
    # shares the same color/fabric, and spans torso + legs into a full-body silhouette,
    # consolidate them into a single "Dress" (Full Body) garment!
    #
    # CRITICAL GUARDS:
    # 1. On a human model (has_human=True), a person wearing a top/kurta and pants/trousers
    #    is wearing an outfit of separate wearable pieces. Top and Pants MUST NEVER be consolidated!
    # 2. Pants (pants, trousers, jeans, chinos, joggers) worn with a top or dress must NEVER merge into a dress.
    # 3. Only consolidate when NOT has_human (flat-lays, ghost mannequins, product photos) or
    #    when the bottom is a continuous skirt/robe hem (not pants).
    while True:
        merged_any = False
        top_candidates = []
        bottom_candidates = []
        for k, it in list(by_label.items()):
            m = it.get("mask")
            if m is None:
                continue
            bb = _mask_bbox(m)
            if not bb:
                continue
            cat = (it.get("category") or "").lower()
            lbl = (it.get("label") or "").lower()
            if cat in ("top", "outerwear", "dress"):
                top_candidates.append((k, bb, it))
            if cat in ("bottom", "dress") or any(b in lbl for b in ("skirt", "pant", "chino", "trouser")):
                bottom_candidates.append((k, bb, it))

        for t_k, t_bb, t_it in top_candidates:
            if merged_any:
                break
            ty1, tx1, ty2, tx2 = t_bb
            t_h = max(1, ty2 - ty1)
            t_w = max(1, tx2 - tx1)
            t_lbl = (t_it.get("label") or "").lower()
            t_cat = (t_it.get("category") or "").lower()

            for b_k, b_bb, b_it in bottom_candidates:
                if t_k == b_k:
                    continue
                by1, bx1, by2, bx2 = b_bb
                b_h = max(1, by2 - by1)
                b_w = max(1, bx2 - bx1)
                b_lbl = (b_it.get("label") or "").lower()
                b_cat = (b_it.get("category") or "").lower()

                # Pants must NEVER merge with an upper garment/dress on a human model!
                is_pants_bottom = any(p in b_lbl for p in ("pant", "trouser", "jean", "chino", "short", "legging", "slack"))
                if is_pants_bottom and (has_human or t_cat == "dress" or "kurta" in t_lbl or "shirt" in t_lbl):
                    continue

                # If has_human, an outfit of separate top and bottom must not be fused
                if has_human and (t_cat in ("top", "outerwear") or is_pants_bottom):
                    continue

                vert_gap = max(0, by1 - ty2) if by1 > ty2 else 0
                vert_overlap = max(0, min(ty2, by2) - max(ty1, by1))
                comb_h = max(ty2, by2) - min(ty1, by1)
                x_inter = max(0, min(tx2, bx2) - max(tx1, bx1))
                min_w = min(t_w, b_w)
                x_ratio = x_inter / float(min_w) if min_w > 0 else 0

                is_aligned = (
                    (ty1 <= by1 + int(0.15 * H))
                    and (by2 >= ty2 - int(0.15 * H))
                    and (vert_gap <= max(16, int(0.08 * H)) or vert_overlap > 0)
                    and (x_ratio >= 0.30 or (x_inter >= max(16, int(0.30 * b_w))))
                    and (comb_h >= int(0.38 * H))
                )
                if not is_aligned:
                    continue

                color_ok = True
                if img_arr is not None:
                    t_pix = img_arr[t_it["mask"] > 0]
                    b_pix = img_arr[b_it["mask"] > 0]
                    if len(t_pix) >= 20 and len(b_pix) >= 20:
                        cdiff = float(np.linalg.norm(t_pix.mean(axis=0) - b_pix.mean(axis=0)))
                        max_diff = 65.0 if not has_human else 45.0
                        color_ok = (cdiff <= max_diff)

                if color_ok:
                    logger.info(
                        "clothing_parser: consolidating full-body garment '%s' and '%s' into Dress",
                        t_k, b_k,
                    )
                    comb_mask = np.maximum(t_it["mask"], b_it["mask"])
                    dress_key = "Dress"
                    suffix = 0
                    while dress_key in by_label and dress_key not in (t_k, b_k):
                        suffix += 1
                        dress_key = f"Dress#{suffix}"
                    by_label[dress_key] = {
                        "label": "Dress",
                        "category": "dress",
                        "score": max(float(t_it.get("score", 0.95)), float(b_it.get("score", 0.95))),
                        "mask": comb_mask,
                    }
                    if t_k != dress_key and t_k in by_label:
                        del by_label[t_k]
                    if b_k != dress_key and b_k in by_label:
                        del by_label[b_k]
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
            keep_top_k=2 if item["label"] in ("Shoes", "Belt", "belt", "Hat", "hat", "Headwear", "headwear") else 1,
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

    # 2e-split) Split tunic / kurta over skirt / pants misclassified as a single continuous 'dress':
    # SegFormer models trained on western datasets frequently classify traditional South Asian, Middle Eastern,
    # and layered outfits (e.g. Kurta + Skirt/Palazzo, Kameez + Shalwar) as a single continuous 'dress'.
    # When on a human model (has_human=True or has_any_human=True), scan the lower portion of the 'dress' mask
    # for a sharp horizontal color boundary / hemline. If detected and the lower portion is significant (>= 1.5% of frame),
    # split into a standalone Top (upper garment) and Skirt / Bottom (lower garment).
    if (has_human or has_any_human) and img_arr is not None:
        for k, it in list(by_label.items()):
            cat = (it.get("category") or "").lower()
            mask = it.get("mask")
            if cat == "dress" and mask is not None:
                ys, xs = np.where(mask > 0)
                if len(ys) > 0:
                    ymin, ymax = int(ys.min()), int(ys.max())
                    gh = ymax - ymin
                    if gh >= int(0.35 * H):
                        torso_y1 = ymin + int(0.20 * gh)
                        torso_y2 = ymin + int(0.50 * gh)
                        torso_mask = (mask > 0) & (np.arange(H)[:, None] >= torso_y1) & (np.arange(H)[:, None] <= torso_y2)
                        if torso_mask.sum() >= 40:
                            torso_rgb = img_arr[torso_mask].mean(axis=0)
                            torso_rb = torso_rgb[0] - torso_rgb[2]
                            scan_start_y = ymin + int(0.52 * gh)
                            hem_candidates = []
                            for y in range(scan_start_y, ymax):
                                row_pts = mask[y] > 0
                                if row_pts.sum() >= 15:
                                    row_rgb = img_arr[y, row_pts].mean(axis=0)
                                    diff = float(np.linalg.norm(row_rgb - torso_rgb))
                                    rb = float(row_rgb[0] - row_rgb[2])
                                    if diff >= 48.0 or (torso_rb >= 45.0 and rb <= 35.0):
                                        hem_candidates.append(y)
                            if hem_candidates:
                                first_diff_y = min(hem_candidates)
                                lower_mask = (mask > 0) & (np.arange(H)[:, None] >= first_diff_y)
                                lower_frac = int(lower_mask.sum()) / float(total)
                                if lower_frac >= 0.015:
                                    logger.info(
                                        "clothing_parser: splitting composite outfit '%s' at hemline y=%d into Top and Skirt (lower_frac=%.4f)",
                                        k, first_diff_y, lower_frac,
                                    )
                                    upper_mask = np.where(np.arange(H)[:, None] < first_diff_y, mask, np.uint8(0))
                                    it["category"] = "top"
                                    it["label"] = "Top"
                                    it["mask"] = upper_mask

                                    # Merge into existing skirt if present, or create Skirt item
                                    existing_skirt_keys = [sk for sk in by_label if sk.lower().startswith("skirt")]
                                    if existing_skirt_keys:
                                        target_sk_key = existing_skirt_keys[0]
                                        by_label[target_sk_key]["mask"] = np.maximum(by_label[target_sk_key]["mask"], lower_mask)
                                        by_label[target_sk_key]["label"] = "Skirt"
                                        by_label[target_sk_key]["category"] = "bottom"
                                    else:
                                        by_label["Skirt"] = {
                                            "label": "Skirt",
                                            "category": "bottom",
                                            "score": float(it.get("score", 0.95)),
                                            "mask": lower_mask,
                                        }

    # 2e-skirt) Collapse all Skirt pieces into a single "Skirt" item
    all_skirt_keys = [k for k in list(by_label.keys()) if k.lower().startswith("skirt")]
    if len(all_skirt_keys) > 1:
        primary_sk = max(all_skirt_keys, key=lambda k: int(by_label[k]["mask"].sum()) if by_label[k].get("mask") is not None else 0)
        for other_sk in all_skirt_keys:
            if other_sk != primary_sk and by_label[other_sk].get("mask") is not None:
                by_label[primary_sk]["mask"] = np.maximum(by_label[primary_sk]["mask"], by_label[other_sk]["mask"])
                del by_label[other_sk]
        by_label[primary_sk]["label"] = "Skirt"
        by_label[primary_sk]["category"] = "bottom"

    # 2f) Upper / Bottom Outfit Separation:
    # In an outfit where both an upper garment (top/outerwear or SegFormer 'dress'/tunic)
    # AND a distinct bottom garment (skirt / pants / shorts) are present:
    # 1. A person wearing a skirt or pants is NOT wearing a one-piece dress; any upper garment
    #    detected as 'dress' is an upper garment (top / tunic / kurta / kameez) worn over the bottom!
    #    Demote category to 'top' and label to 'Top'.
    # 2. SegFormer's upper-body mask frequently leaks down into the lower garment's territory
    #    (or was trained to predict 'dress' all the way down to mid-calf).
    #    Excise all bottom garment pixels from the upper garment mask so the upper crop and
    #    alpha matte terminate cleanly at the upper garment's hem!
    bottom_masks = [
        it["mask"] for it in by_label.values()
        if (it.get("category") == "bottom" or any(p in (it.get("label") or "").lower() for p in ("skirt", "pant", "trouser", "jean", "short", "chino", "legging")))
        and it.get("mask") is not None
    ]
    if bottom_masks:
        combined_bottom = np.maximum.reduce(bottom_masks)
        bot_ys = np.where(combined_bottom > 0)[0]
        bot_min_y = int(bot_ys.min()) if len(bot_ys) > 0 else None

        for k, it in list(by_label.items()):
            cat = (it.get("category") or "").lower()
            lbl = (it.get("label") or "").lower()
            if cat in ("top", "outerwear", "dress") and it.get("mask") is not None:
                if cat == "dress" or "dress" in lbl:
                    it["category"] = "top"
                    if "dress" in lbl:
                        it["label"] = "Top"
                it["mask"] = np.where(combined_bottom > 0, np.uint8(0), it["mask"])
                if bot_min_y is not None:
                    # Upper garment must never extend past the top edge of the bottom garment
                    it["mask"] = np.where(np.arange(H)[:, None] > bot_min_y + 3, np.uint8(0), it["mask"])

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
                if skin_mask_found is not None:
                    y_grid = np.arange(H)[:, None]
                    is_waist_or_arm = y_grid <= int(0.55 * H)
                    arm_m = (arm_m | (skin_mask_found & is_waist_or_arm)).astype(np.uint8)
                if arm_m.any() and int(arm_m.sum()) >= 80:
                    from scipy import ndimage
                    h_h, h_w = arm_m.shape
                    smooth_sigma = max(1.5, min(5.0, float(min(h_h, h_w)) * 0.003))
                    arm_m = (ndimage.gaussian_filter(arm_m.astype(float), sigma=smooth_sigma) >= 0.5).astype(np.uint8)
                    garment_human_mask = arm_m
                else:
                    garment_human_mask = None
            elif skin_mask_found is not None:
                y_grid = np.arange(H)[:, None]
                is_waist_or_arm = y_grid <= int(0.55 * H)
                garment_human_mask = (skin_mask_found & is_waist_or_arm).astype(np.uint8)
            else:
                garment_human_mask = None
        # 3. Tops, outerwear, dresses: head + arms (never legs)
        elif cat in ("top", "outerwear", "dress") or lbl in ("upper-clothes", "coat", "dress"):
            upper_human_ids = head_class_ids | arm_class_ids
            if upper_human_ids and np.isin(class_mask, list(upper_human_ids)).any():
                up_m = np.isin(class_mask, list(upper_human_ids)).astype(np.uint8)
                if skin_mask_found is not None:
                    up_m = (up_m | skin_mask_found).astype(np.uint8)
                if up_m.any() and int(up_m.sum()) >= 80:
                    from scipy import ndimage
                    h_h, h_w = up_m.shape
                    smooth_sigma = max(1.5, min(5.0, float(min(h_h, h_w)) * 0.003))
                    up_m = (ndimage.gaussian_filter(up_m.astype(float), sigma=smooth_sigma) >= 0.5).astype(np.uint8)
                    garment_human_mask = up_m
                else:
                    garment_human_mask = skin_mask_found
            elif skin_mask_found is not None:
                garment_human_mask = skin_mask_found.copy()
                if has_head and ymin > int(0.03 * H):
                    head_box = np.zeros((H, W), dtype=np.uint8)
                    head_x1 = max(0, xmin - int(0.15 * (xmax - xmin)))
                    head_x2 = min(W, xmax + int(0.15 * (xmax - xmin)))
                    head_box[0:ymin, head_x1:head_x2] = 1
                    garment_human_mask = (garment_human_mask | (head_box & (class_mask == 0))).astype(np.uint8)
            elif has_head and ymin > int(0.03 * H):
                # When SegFormer model has no human classes (e.g. sayeed99/segformer_b3_clothes),
                # synthesize head mask directly above top collar so the face/beard/hair are excised!
                head_box = np.zeros((H, W), dtype=np.uint8)
                head_x1 = max(0, xmin - int(0.15 * (xmax - xmin)))
                head_x2 = min(W, xmax + int(0.15 * (xmax - xmin)))
                head_box[0:ymin, head_x1:head_x2] = 1
                garment_human_mask = (head_box & (class_mask == 0)).astype(np.uint8)
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
    if not norm_cat and norm_lbl:
        norm_cat = (_get_label_category(norm_lbl) or "").lower().replace(" ", "").replace("-", "")
    is_upper = bool(
        norm_cat in {"top", "outerwear", "suit", "dress", "fullbody"}
        or any(w in norm_lbl for w in ("top", "shirt", "blouse", "kurta", "jacket", "coat", "sweater", "dress", "tunic", "hoodie", "cardigan", "vest"))
    )
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
    is_acc = bool(
        norm_cat in {"accessory", "accessories", "headwear", "bag", "belt", "jewelry"}
        or any(w in norm_lbl for w in ("hat", "cap", "beanie", "bag", "belt", "necklace", "watch", "bracelet", "scarf", "tie", "gloves", "wallet"))
        or any(w in str(category).lower() for w in ("accessory", "accessories", "bag", "belt", "jewelry", "חגור", "תיק", "כובע", "צעיף"))
    )
    if is_acc and not is_eyewear:
        # Accessories (belts, bags, scarves, hats, jewelry, watches) are packshots or flat-lays
        # with no body/limb occlusion. SegFormer human body parsing and skin chrominance filtering
        # must NEVER touch accessories, as rembg provides the complete studio cutout and SegFormer
        # or skin filtering would fracture or chew leather, buckles, and straps.
        return matted_png_bytes

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

            # Footwear protection rule:
            # In footwear crops, the leg/shin is strictly in the upper portion (y <= 0.40 * Hc).
            # Ankle straps, T-straps, buckles, and heels live in the lower portion (y > 0.40 * Hc).
            # Restricting human leg subtraction to y <= 0.40 * Hc prevents delicate straps and buckles from being eaten!
            if is_footwear:
                y_coords_fw = np.arange(Hc)[:, None]
                human_clean = np.where(y_coords_fw <= int(0.40 * Hc), human_clean, np.uint8(0))

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
            if mask_resized is not None and not is_single_item:
                human_outside = (human_clean >= 60) & (mask_resized <= 30)
                if garment_protect is not None and garment_protect.any():
                    human_outside = human_outside & (~garment_protect)
                new_alpha = np.where(human_outside, np.uint8(0), new_alpha)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "apply_alpha_intersection: human-mask subtraction failed: %s",
                repr(exc)[:120],
            )

    # 2. Human skin chrominance filter outside confident garment body
    # (Excises bare neck skin, hanging hands next to jacket hems, fingers on waistbands, bare legs)
    try:
        r = arr[:, :, 0].astype(float)
        g = arr[:, :, 1].astype(float)
        b = arr[:, :, 2].astype(float)
        cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
        cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
        is_skin = (
            (cr >= 133.0) & (cr <= 173.0) &
            (cb >= 88.0) & (cb <= 127.0) &
            (r > g) & (g > b) &
            ((r - g) >= 12.0) &
            ((g - b) <= 42.0) &
            (new_alpha > 30)
        )
        # Check if garment fabric itself is skin/nude toned
        is_garment_nude = False
        if garment_protect is not None and garment_protect.sum() > 50:
            core_pts = garment_protect
            g_r = float(np.median(arr[core_pts, 0]))
            g_g = float(np.median(arr[core_pts, 1]))
            g_b = float(np.median(arr[core_pts, 2]))
            g_cr = 128.0 + 0.5 * g_r - 0.418688 * g_g - 0.081312 * g_b
            g_cb = 128.0 - 0.168736 * g_r - 0.331264 * g_g + 0.5 * g_b
            is_garment_nude = bool(
                (133.0 <= g_cr <= 173.0) and
                (88.0 <= g_cb <= 127.0) and
                (g_r > g_g > g_b) and
                ((g_r - g_g) >= 12.0) and
                ((g_g - g_b) <= 42.0)
            )

        y_coords = np.arange(Hc)[:, None]
        x_coords = np.arange(Wc)[None, :]
        is_lateral = (x_coords <= (0.38 * Wc)) | (x_coords >= (0.62 * Wc))
        is_hand_zone = (y_coords >= (0.55 * Hc)) | ((y_coords >= (0.42 * Hc)) & is_lateral)

        # Footwear protection: skip skin chrominance subtraction below y > 0.40 * Hc for footwear
        if is_footwear:
            is_skin = is_skin & (y_coords <= int(0.40 * Hc))
        elif is_bottom and mask_resized is not None:
            # Hands/wrists resting on the waistband (top 28% of pants crop)
            is_waist_zone = y_coords <= (0.28 * Hc)
            is_skin = is_skin & ((mask_resized <= 40) | is_waist_zone)
        elif (norm_cat in {"top", "outerwear", "suit", "fullbody", "dress"}) and mask_resized is not None:
            # Hands hanging next to jacket hems or protruding from sleeve cuffs
            is_skin = is_skin & ((mask_resized <= 40) | is_hand_zone)
        else:
            is_skin = np.zeros_like(is_skin, dtype=bool)

        # Confident garment fabric must NEVER be classified as skin or excised.
        # On non-nude garments, hands protruding from sleeve cuffs / waistbands are not shielded by garment_protect.
        if garment_protect is not None and garment_protect.any():
            limb_shield = is_hand_zone if norm_cat in {"top", "outerwear", "suit", "fullbody", "dress"} else (is_waist_zone if is_bottom else np.zeros_like(garment_protect, dtype=bool))
            protect_skin = garment_protect if is_garment_nude else (garment_protect & (~limb_shield))
            is_skin = is_skin & (~protect_skin)

        # In hand zone / waistband: any skin detection represents human limbs/hands/wrists/fingers.
        # Morphological dilation fills anti-aliased finger edges, knuckles, nailbeds, and creases,
        # preventing translucent ghost hands from surviving the Gaussian blur.
        hand_excise = None
        if not is_garment_nude and is_skin.any():
            from scipy import ndimage
            target_limb_zone = is_hand_zone if norm_cat in {"top", "outerwear", "suit", "fullbody", "dress"} else (is_waist_zone if is_bottom else is_hand_zone)
            hand_skin_bin = is_skin & target_limb_zone
            if garment_protect is not None and garment_protect.any():
                hand_skin_bin = hand_skin_bin & (~garment_protect)
            if hand_skin_bin.any():
                hand_excise = ndimage.binary_dilation(hand_skin_bin, structure=np.ones((5, 5), dtype=bool), iterations=2) & target_limb_zone
                if garment_protect is not None and garment_protect.any():
                    hand_excise = hand_excise & (~garment_protect)

        if is_skin.any():
            skin_u8 = (is_skin * 255).astype(np.uint8)
            effective_protect = garment_protect
            if effective_protect is not None and effective_protect.any():
                skin_clean = np.where(effective_protect, np.uint8(0), skin_u8)
            elif garment_weight is not None:
                effective_weight = np.where(hand_excise if (hand_excise is not None and hand_excise.any()) else is_skin, 0.0, garment_weight) if not is_garment_nude else garment_weight
                skin_clean = (skin_u8.astype(float) * (1.0 - effective_weight)).round().astype(np.uint8)
            else:
                skin_clean = skin_u8

            skin_blur = Image.fromarray(skin_clean, mode="L").filter(ImageFilter.GaussianBlur(radius=1.5))
            skin_factor = np.array(skin_blur, dtype=float) / 255.0
            sub_skin = np.clip(1.0 - skin_factor, 0.0, 1.0)
            if effective_protect is not None and effective_protect.any():
                from scipy import ndimage
                protect_smooth = ndimage.gaussian_filter(effective_protect.astype(float), sigma=1.2)
                sub_skin = np.clip(sub_skin * (1.0 - protect_smooth) + 1.0 * protect_smooth, 0.0, 1.0)
            new_alpha = (new_alpha.astype(float) * sub_skin).round().astype(np.uint8)
            if hand_excise is not None and hand_excise.any():
                new_alpha = np.where(hand_excise, np.uint8(0), new_alpha)
    except Exception as exc:  # noqa: BLE001
        logger.info(
            "apply_alpha_intersection: skin-chrominance subtraction failed: %s",
            repr(exc)[:120],
        )

    # 2b. Upper garment neck/head trimming:
    # A human head, neck, chin, or throat must NEVER float above collars or lapels of tops/outerwear/suits!
    if norm_cat in {"top", "outerwear", "suit", "dress", "fullbody"} and mask_resized is not None:
        try:
            garment_pts = np.where(mask_resized > 40)
            if len(garment_pts[0]) > 0:
                ys, xs = garment_pts
                apex_y = int(ys.min())
                # Anything above the garment apex is strictly head / neck / background
                if apex_y > 0:
                    new_alpha[:max(0, apex_y + 1), :] = 0

                # Column-wise contour trimming along the central neckline/collar notch
                col_min_y = np.full(Wc, Hc, dtype=int)
                np.minimum.at(col_min_y, xs, ys)

                # Restrict column trimming to the central neck/throat corridor (18% to 82% of width)
                # so shoulders, outer lapels, and sleeves on either side are never truncated.
                neck_cols = np.zeros(Wc, dtype=bool)
                neck_cols[int(0.18 * Wc):int(0.82 * Wc)] = True
                valid_cols = (col_min_y < Hc) & neck_cols
                if valid_cols.any():
                    y_indices = np.arange(Hc)[:, None]
                    # Pixels above the garment in the central neck zone are neck/face/background
                    above_collar = (y_indices < col_min_y[None, :]) & valid_cols[None, :]
                    is_h_part = (human_resized > 25) if ('human_resized' in locals() and human_resized is not None) else False
                    is_s_part = is_skin if ('is_skin' in locals() and is_skin is not None) else False
                    trim_neck = above_collar & ((mask_resized <= 30) | is_h_part | is_s_part)
                    new_alpha = np.where(trim_neck, np.uint8(0), new_alpha)
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

            # Protect target garment body so adjacent items never bite into or chew its fabric.
            effective_protect = garment_protect if (garment_protect is not None and garment_protect.any()) else garment_core
            if effective_protect is not None and effective_protect.any():
                other_clean = np.where(effective_protect, np.uint8(0), other_resized)
            elif garment_weight is not None:
                other_clean = (other_resized.astype(float) * (1.0 - garment_weight)).round().astype(np.uint8)
            else:
                other_clean = other_resized

            other_blur = Image.fromarray(other_clean, mode="L").filter(ImageFilter.GaussianBlur(radius=1.5))
            other_factor = np.array(other_blur, dtype=float) / 255.0
            sub_other = np.clip(1.0 - other_factor, 0.0, 1.0)
            if effective_protect is not None and effective_protect.any():
                from scipy import ndimage
                protect_smooth = ndimage.gaussian_filter(effective_protect.astype(float), sigma=1.2)
                sub_other = np.clip(sub_other * (1.0 - protect_smooth) + 1.0 * protect_smooth, 0.0, 1.0)
            new_alpha = (new_alpha.astype(float) * sub_other).round().astype(np.uint8)

            # Strict non-destructive adjacent garment separation:
            # Where target garment mask is weak/absent (<= 30) and an adjacent garment is confident (>= 45),
            # that region is definitively the adjacent garment (e.g. blazer lapels over white shirt, pants cuff over shoes).
            if mask_resized is not None:
                adjacent_bleed = (mask_resized <= 30) & (other_resized >= 45)
                if effective_protect is not None and effective_protect.any():
                    adjacent_bleed = adjacent_bleed & (~effective_protect)
                new_alpha = np.where(adjacent_bleed, np.uint8(0), new_alpha)
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "apply_alpha_intersection: other_mask subtraction failed: %s",
                repr(exc)[:120],
            )

    # 3c. Footwear pants-cuff & ankle cleanup
    if is_footwear and mask_resized is not None and not is_single_item:
        try:
            shoe_pts = np.where(mask_resized > 40)
            if len(shoe_pts[0]) > 0:
                s_ys, s_xs = shoe_pts
                s_apex_y = int(s_ys.min())
                col_shoe_min = np.full(Wc, Hc, dtype=int)
                np.minimum.at(col_shoe_min, s_xs, s_ys)
                y_idx = np.arange(Hc)[:, None]
                valid_shoe_cols = (col_shoe_min < Hc)[None, :]
                above_shoes = (y_idx < (col_shoe_min[None, :] - 2)) & valid_shoe_cols & (mask_resized <= 30)
                new_alpha = np.where(above_shoes, np.uint8(0), new_alpha)
                if s_apex_y > 2:
                    new_alpha[:max(0, s_apex_y - 2), :] = 0
        except Exception as _fw_exc:
            logger.debug("apply_alpha_intersection footwear cuff trim: %s", _fw_exc)

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
            # Proportional dilation so collars, cuffs, sleeves, and shoe contours are never truncated
            env_dilate = 2 if is_eyewear else max(4, dilate_px)
            if env_dilate > 0:
                filled_im = filled_im.filter(ImageFilter.MaxFilter(2 * env_dilate + 1))
            blur_r = 1.5 if is_eyewear else 2.5
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
        effective_core = garment_core & (~hand_excise) if (not is_garment_nude and 'hand_excise' in locals() and hand_excise is not None and hand_excise.any()) else garment_core
        if other_mask is not None and 'other_resized' in locals() and other_resized is not None and other_resized.any():
            effective_core = effective_core & (other_resized <= 40)
        if is_single_item:
            from scipy import ndimage
            filled_alpha = ndimage.binary_fill_holes(new_alpha > 20)
            effective_core = effective_core & filled_alpha
        core_u8 = (effective_core * 255).astype(np.uint8)
        if 'is_skin' in locals() and is_skin is not None and is_skin.any() and not is_garment_nude:
            core_u8 = np.where(is_skin, np.uint8(0), core_u8)
        if 'hand_excise' in locals() and hand_excise is not None and hand_excise.any() and not is_garment_nude:
            core_u8 = np.where(hand_excise, np.uint8(0), core_u8)
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
        if 'hand_excise' in locals() and hand_excise is not None and hand_excise.any() and not is_garment_nude:
            new_alpha = np.where(hand_excise, np.uint8(0), new_alpha)

    # 2c. Upper garment hemline cutoff (multi-item outfits):
    # Disabled for studio-grade cutouts: blind color distance >= 55 deletes
    # the lower half of patterned, striped, graphic, two-tone, or pocketed garments.
    pass

    # 2c-bottom. Non-destructive top-edge chromatic bleed recoloring on bottom garments:
    # When a bright warm upper garment hem (e.g. mustard-yellow kurta) overlaps the top 16%
    # of a neutral/ivory skirt or pants cutout, recolor ONLY the RGB channels of those bleed
    # pixels from the clean skirt fabric directly below in the same column — NEVER modifying
    # new_alpha so the smooth SegFormer/rembg silhouette remains 100% intact.
    if is_bottom and not is_single_item:
        try:
            from scipy.ndimage import binary_dilation as _bd_bot
            b_zone = (new_alpha[int(0.25 * Hc):int(0.82 * Hc), int(0.18 * Wc):int(0.82 * Wc)] > 150)
            if b_zone.sum() >= 100:
                b_rgb = arr[int(0.25 * Hc):int(0.82 * Hc), int(0.18 * Wc):int(0.82 * Wc), :3][b_zone].astype(np.float32)
                b_r = float(np.median(b_rgb[:, 0]))
                b_g = float(np.median(b_rgb[:, 1]))
                b_b = float(np.median(b_rgb[:, 2]))
                b_rb = b_r - b_b
                b_chroma = float(max(b_r, b_g, b_b) - min(b_r, b_g, b_b))
                if b_chroma <= 35.0 and b_rb <= 32.0:
                    y_lim = max(4, int(0.16 * Hc))
                    top_slice = arr[:y_lim, :, :3].astype(np.float32)
                    px_rb = top_slice[:, :, 0] - top_slice[:, :, 2]
                    bleed_px = (new_alpha[:y_lim, :] > 5) & (px_rb >= max(36.0, b_rb + 10.0))
                    if bleed_px.any():
                        bleed_px = _bd_bot(bleed_px, structure=np.ones((5, 5), dtype=bool)) & (new_alpha[:y_lim, :] > 0)
                        ref_y1, ref_y2 = y_lim, min(Hc, int(0.42 * Hc))
                        for x in range(Wc):
                            bx = np.where(bleed_px[:, x])[0]
                            if len(bx) > 0:
                                r0 = min(Hc - 1, int(bx.max()) + 1)
                                r1 = min(Hc, r0 + 6)
                                rep_rgb = np.median(arr[r0:r1, x, :3], axis=0).astype(np.uint8)
                                arr[bx, x, :3] = rep_rgb
        except Exception as _bot_bleed_exc:
            logger.debug("apply_alpha_intersection bottom top-edge recolor: %s", _bot_bleed_exc)

    # 2d. Lateral hand-excision hook & fingertip-rim cleanup on upper garments:
    # Remove isolated thin lateral hooks left beside an excised hand without EDT bridging.
    if is_upper and not is_single_item:
        try:
            from scipy.ndimage import (
                binary_dilation as _bd_up,
                binary_opening as _bo_up,
                distance_transform_edt as _edt_up,
                gaussian_filter as _gf_up,
                label as _lbl_up,
            )
            y_idx, x_idx = np.indices((Hc, Wc))
            torso_bin = new_alpha > 40
            open_h = max(9, int(0.022 * Hc))
            open_w = max(15, int(0.042 * Wc))
            smooth_torso = _bo_up(torso_bin, structure=np.ones((open_h, open_w), dtype=bool))
            hook_zone = (y_idx >= int(0.64 * Hc)) & (y_idx <= int(0.74 * Hc)) & ((x_idx <= int(0.35 * Wc)) | (x_idx >= int(0.65 * Wc)))
            if 'hem_cutoff_y' in locals() and hem_cutoff_y is not None:
                hook_zone = hook_zone & (y_idx <= hem_cutoff_y - 12)
            # Protrusion wiping disabled: preserves authentic sleeves, flared hemlines, and cuffs.
            pass
            if has_human and 'human_resized' in locals() and human_resized is not None and 't_rb' in locals() and t_rb >= 45.0:
                hand_rim = _bd_up(human_resized > 90, iterations=4) & (y_idx >= int(0.55 * Hc)) & (y_idx <= int(0.78 * Hc))
                px_rb = arr[:, :, 0].astype(np.float32) - arr[:, :, 2].astype(np.float32)
                px_luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
                finger_halo = hand_rim & (new_alpha > 0) & ((px_rb < 38.0) | (px_luma < 95.0))
                if finger_halo.any():
                    new_alpha[_bd_up(finger_halo, iterations=1) & hand_rim] = 0
            # Seamlessly inpaint compact enclosed interior hand islands resting on solid kaftans/dresses
            if has_human and not is_garment_nude and 't_r' in locals():
                r_f = arr[:, :, 0].astype(np.float32)
                g_f = arr[:, :, 1].astype(np.float32)
                b_f = arr[:, :, 2].astype(np.float32)
                luma_f = 0.299 * r_f + 0.587 * g_f + 0.114 * b_f
                cr_f = 128.0 + 0.5 * r_f - 0.418688 * g_f - 0.081312 * b_f
                cb_f = 128.0 - 0.168736 * r_f - 0.331264 * g_f + 0.5 * b_f
                px_diff = np.sqrt((r_f - t_r) ** 2 + (g_f - t_g) ** 2 + (b_f - t_b) ** 2)
                mid_zone = (
                    (y_idx >= int(0.25 * Hc)) & (y_idx <= int(0.55 * Hc))
                    & (x_idx >= int(0.25 * Wc)) & (x_idx <= int(0.75 * Wc))
                )
                hand_cand = (
                    (new_alpha > 200) & mid_zone
                    & (cr_f >= 136.0) & (cr_f <= 172.0)
                    & (cb_f >= 92.0) & (cb_f <= 124.0)
                    & (r_f > g_f) & (g_f > b_f)
                    & ((r_f - g_f) >= 25.0) & ((g_f - b_f) >= 12.0) & ((g_f - b_f) <= 38.0)
                    & (luma_f >= 55.0) & (luma_f <= 145.0)
                    & (px_diff >= 75.0)
                )
                if int(hand_cand.sum()) >= 150:
                    labeled_h, n_h = _lbl_up(hand_cand)
                    interior_hand = np.zeros_like(hand_cand)
                    for cid in range(1, n_h + 1):
                        comp = (labeled_h == cid)
                        csum = int(comp.sum())
                        if 150 <= csum <= 2500:
                            interior_hand |= comp
                    if interior_hand.any():
                        hand_dil = _bd_up(interior_hand, structure=np.ones((9, 9), dtype=bool)) & (new_alpha > 150)
                        clean_garment = (new_alpha > 200) & (~hand_dil) & (px_diff <= 40.0)
                        if clean_garment.any():
                            _, nearest_idx = _edt_up(~clean_garment, return_indices=True)
                            ny, nx = nearest_idx[0], nearest_idx[1]
                            inpainted = arr[:, :, :3].copy().astype(np.float32)
                            for c in range(3):
                                ch = inpainted[:, :, c]
                                ch[hand_dil] = ch[ny[hand_dil], nx[hand_dil]]
                                inpainted[:, :, c] = _gf_up(ch, sigma=2.5)
                            blend_w = _gf_up(hand_dil.astype(np.float32), sigma=2.0)[:, :, None]
                            arr[:, :, :3] = np.clip(
                                arr[:, :, :3].astype(np.float32) * (1.0 - blend_w) + inpainted * blend_w,
                                0, 255,
                            ).astype(np.uint8)
        except Exception as _flank_exc:
            logger.debug("apply_alpha_intersection flank cleanup: %s", _flank_exc)

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
