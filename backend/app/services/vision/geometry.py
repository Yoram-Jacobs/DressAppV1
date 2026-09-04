from __future__ import annotations
import logging
logger = logging.getLogger(__name__)

from typing import Any



_BBOX_PADDING_PCT = 0.04  # relative padding around each detected bbox
# Patch 12j (May 2026) — per-category asymmetric bbox padding. The
# flat 4 % budget above is now the BACKWARD-COMPAT default for callers
# that don't pass a category. When category is known we use a
# per-edge ``(top, right, bottom, left)`` tuple so:
#
#   * The torso boundary (waistline = top's bottom edge + bottom's top
#     edge) gets 0.5 % padding — just enough to avoid Pillow rounding
#     glitches but tight enough that the adjacent garment never makes
#     it into the crop frame.
#   * The ankle boundary (bottom's bottom edge + footwear's top edge)
#     gets the same 0.5 % treatment.
#   * "Free" edges (top's collar/face, dress's neckline, footwear's
#     ground side, hat's free top) keep a generous 3-4 % so puffy
#     cuffs / boot heels / floppy brims aren't clipped.
#
# This is the second half of the "tighten the margin" fix. Patch 12i
# tightened the SegFormer alpha dilation per-category; this patch
# tightens the BBOX CROP itself per-category, which is the more
# important defence because the dilation can only work with pixels
# that survived the bbox crop. On the May 2026 outfit screenshot
# (blouse + skirt + thigh-high boots) the previous 4 % bottom padding
# on the blouse bbox dragged 4 % × ~1500 px = 60 px of skirt into the
# blouse crop; SegFormer flagged those pixels as "not Upper-clothes"
# and the dilated intersection still admitted them because rembg
# kept them as foreground (it was after all part of the original
# matte). Tightening the bottom edge to 0.5 % (≈ 7 px) makes the
# bbox stop AT the waistline; the skirt never enters the frame.
_BBOX_PAD_TRBL_BY_CATEGORY: dict[str, tuple[float, float, float, float]] = {
    # Top / Outerwear-like upper garment: face-side loose, waistline
    # tight. Sides slightly tight too (avoid pulling in adjacent
    # hands / bags).
    #
    # Patch 12k (May 2026, "one more twink") — bottom edge bumped
    # from +0.5 % to **-1.5 %**, i.e. the crop now ends 1.5 % INSIDE
    # the SegFormer-derived bbox at the waistline. The 0.5 % positive
    # margin from Patch 12j wasn't enough on the May 2026 test photo:
    # the SegFormer mask itself was over-claiming a few percent of
    # waistband/skirt-top pixels as "Upper-clothes", so the bbox was
    # already too tall before any padding was added. Negative padding
    # bites INTO the bbox and trims that over-claim. The real blouse
    # body still survives because morphological closing in
    # ``_postprocess_mask`` is uniform — the outer 1.5 % of mask
    # pixels are the noisy/uncertain ones; the dominant garment body
    # is well inside.
    #
    # Patch 12l (May 2026, "delicate borderline") — bottom edge
    # dialled another 1.0 pp to **-2.5 %**. The 12k value left a
    # faint dark rim of skirt-waistband on the blouse card in the
    # May 2026 test photo because the SegFormer over-claim there
    # was ~2 % of frame height (turtleneck blouse with a fitted
    # bottom hem worn over a high-waisted skirt — the
    # blouse-skirt transition was a single high-contrast pixel
    # line that SegFormer happily classified either way). Going
    # from -1.5 % to -2.5 % erases the rim without cropping into
    # the actual blouse hem (the garment body has another ~5 %+
    # of vertical breathing room below before the SegFormer
    # confidence drops). Skirt + footwear cards untouched —
    # they were already clean per the user screenshot.
    "top":        (0.04, 0.03, -0.025, 0.03),
    "bottom":     (-0.015, 0.03, -0.015, 0.03),
    "dress":      (0.03, 0.03, 0.01, 0.03),
    "fullbody":   (0.03, 0.03, 0.03, 0.03),
    "full body":  (0.03, 0.03, 0.03, 0.03),
    "outerwear":  (0.03, 0.03, -0.015, 0.03),
    "footwear":   (-0.01, 0.03, 0.03, 0.03),
    "headwear":   (0.04, 0.04, 0.01, 0.04),
    "accessory":  (0.03, 0.03, 0.03, 0.03),
    "accessories": (0.03, 0.03, 0.03, 0.03),
    "underwear":  (0.02, 0.02, 0.02, 0.02),
}
_BBOX_PAD_TRBL_DEFAULT = (
    _BBOX_PADDING_PCT, _BBOX_PADDING_PCT,
    _BBOX_PADDING_PCT, _BBOX_PADDING_PCT,
)


def _resolve_bbox_pad_trbl_for_category(
    category: str | None,
) -> tuple[float, float, float, float]:
    """Look up the per-category bbox padding as ``(top, right, bottom, left)``.

    Case-insensitive, whitespace-insensitive. Falls back to
    ``_BBOX_PAD_TRBL_DEFAULT`` (4 % all-around — the original Patch 12
    budget) when the category is missing or not in the table.
    """
    if not category:
        return _BBOX_PAD_TRBL_DEFAULT
    key = str(category).strip().lower()
    if not key:
        return _BBOX_PAD_TRBL_DEFAULT
    if key in _BBOX_PAD_TRBL_BY_CATEGORY:
        return _BBOX_PAD_TRBL_BY_CATEGORY[key]
    key_collapsed = key.replace(" ", "")
    return _BBOX_PAD_TRBL_BY_CATEGORY.get(key_collapsed, _BBOX_PAD_TRBL_DEFAULT)


_MIN_CROP_AREA_PCT = 0.008  # ignore detections smaller than ~1% of the frame
# Short-edge floor for crop output, expressed as a PER-CATEGORY
# percentage of the source image's short edge. Pixel-based floors
# (the old 96 px hard minimum) silently dropped legitimate small
# garments on low-resolution phone uploads (footwear on a 550 px
# photo has a short edge of ~50-80 px, well below 96 px), AND were
# blind to aspect ratio. Percent-only thresholds adapt cleanly to
# any source resolution and orientation.
#
# Calibration: on a typical full-body editorial photo at 550-832 px
# short edge, the natural in-frame short edge of each category is:
#   * top / bottom / outerwear / dress / fullbody : 30-50 % (huge)
#   * footwear                                     :  8-12 % (shoe height)
#   * headwear                                     :  8-12 % (hat height)
#   * accessory (sunglasses, belt, scarf, bag)    :  3-10 % (varies)
# The thresholds below sit comfortably below those natural sizes so
# real garments pass and only hallucinated slivers (1-2 % short
# edges with no spatial structure) get dropped.
_MIN_CROP_SHORT_EDGE_PCT_DEFAULT = 0.03
_MIN_CROP_SHORT_EDGE_PCT_BY_CATEGORY: dict[str, float] = {
    "top":        0.04,
    "bottom":     0.04,
    "dress":      0.04,
    "fullbody":   0.04,
    "full body":  0.04,
    "outerwear":  0.04,
    "footwear":   0.03,
    "headwear":   0.03,
    "accessory":  0.02,
}


def _resolve_min_short_edge_pct_for_category(
    category: str | None,
) -> float:
    """Look up the per-category short-edge percent floor.

    Defaults to ``_MIN_CROP_SHORT_EDGE_PCT_DEFAULT`` when the
    category is unknown / empty. Category strings are case-folded
    and stripped before lookup.
    """
    if not category:
        return _MIN_CROP_SHORT_EDGE_PCT_DEFAULT
    key = str(category).strip().lower()
    return _MIN_CROP_SHORT_EDGE_PCT_BY_CATEGORY.get(
        key, _MIN_CROP_SHORT_EDGE_PCT_DEFAULT,
    )


_NMS_IOU_THRESHOLD = 0.35  # two boxes with IoU above this are considered duplicates
# A single bbox covering at least this fraction of the frame means the
# user uploaded an already-tight garment shot; cropping further would
# chop the item in half. We skip the crop step in that case.
# 0.45 captures the common "single garment on clean background with
# surrounding whitespace" product-shot pattern.
_SINGLE_ITEM_AREA_FRAC = 0.45
# When multiple detections all have the same "kind" AND their combined
# union bbox covers less than this fraction of the frame, they are
# almost certainly sub-parts of one already-cropped garment (collar,
# sleeve, hem, etc.). We collapse them into one whole-frame item.
_SUBPART_UNION_FRAC = 0.55


def _iou_norm(a: list[int], b: list[int]) -> float:
    """Intersection-over-union of two ``[ymin, xmin, ymax, xmax]`` boxes."""
    ay1, ax1, ay2, ax2 = a
    by1, bx1, by2, bx2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0, (ax2 - ax1)) * max(0, (ay2 - ay1))
    area_b = max(0, (bx2 - bx1)) * max(0, (by2 - by1))
    union = area_a + area_b - inter
    return float(inter) / float(union) if union > 0 else 0.0


def _containment(a: list[int], b: list[int]) -> float:
    """Fraction of the smaller box contained inside the other.

    Catches the case where the detector returns a fine-grained part box
    (e.g. a sleeve) nested inside a full-item box (e.g. the shirt).
    """
    ay1, ax1, ay2, ax2 = a
    by1, bx1, by2, bx2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(1, (ax2 - ax1) * (ay2 - ay1))
    area_b = max(1, (bx2 - bx1) * (by2 - by1))
    smaller = min(area_a, area_b)
    return inter / float(smaller)


# Kind affinities so NMS still collapses near-duplicates even when the
# detector hands back slightly different labels (e.g. "shirt" + "top").
_SIMILAR_KINDS = {
    "garment": {"garment", "outerwear"},
    "outerwear": {"outerwear", "garment"},
    "footwear": {"footwear"},
    "bag": {"bag"},
    "accessory": {"accessory", "jewelry"},
    "jewelry": {"jewelry", "accessory"},
}


def _same_thing(a: dict[str, Any], b: dict[str, Any], has_human: bool = False) -> bool:
    """Heuristic — are two detections the same physical item?"""
    bbox_a, bbox_b = a.get("bbox"), b.get("bbox")
    if not (isinstance(bbox_a, list) and isinstance(bbox_b, list)):
        return False
    iou = _iou_norm(bbox_a, bbox_b)
    contain = _containment(bbox_a, bbox_b)
    kind_a = (a.get("kind") or "garment").lower()
    kind_b = (b.get("kind") or "garment").lower()
    compatible_kind = kind_b in _SIMILAR_KINDS.get(kind_a, {kind_a})
    # Strong overlap -> duplicate, regardless of kind.
    if iou >= _NMS_IOU_THRESHOLD:
        return True
    # One clearly nested inside the other -> duplicate.
    # We require compatible kinds only when there's an actual human wearer
    # (to preserve nested accessories like belts on pants).
    # In flat lays or single-item contexts (no human), nested items are
    # always duplicate hallucinations of the same physical item.
    if contain >= 0.8:
        if compatible_kind or not has_human:
            return True
    return False


def _nms_detections(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Non-max-suppression over detector output.

    Keeps the larger bbox when two detections describe the same item,
    so one physical garment can only ever yield a single card.
    """
    def _area(it: dict[str, Any]) -> int:
        y1, x1, y2, x2 = it["bbox"]
        return max(0, (x2 - x1)) * max(0, (y2 - y1))

    # Determine if a wearer is present
    frame_area = 1000 * 1000
    has_head = any(d.get("has_human_head", False) for d in items)
    garment_kinds = {
        d.get("kind", "garment").lower()
        for d in items
        if _area(d) >= frame_area * 0.03
    }
    has_human = False
    if has_head or len(garment_kinds) > 1:
        for d in items:
            hm = d.get("_human_mask_full")
            if hm is not None and hm.sum() >= 30000:
                has_human = True
                break

    # Sort by area DESC so the dominant (larger) box wins.
    sorted_items = sorted(items, key=_area, reverse=True)
    kept: list[dict[str, Any]] = []
    for it in sorted_items:
        if any(_same_thing(it, k, has_human) for k in kept):
            continue
        kept.append(it)
    return kept


def _is_unidentifiable(analysis: dict[str, Any] | None) -> bool:
    """Return True when the LLM analysis indicates it couldn't make sense
    of the crop — used to drop noise crops from the closet rather
    than save useless "Unidentifiable Garment" cards.

    Triggers on three signals (any of them is enough):

    1. Title contains a give-up phrase ("unidentifiable", "obscured",
       "unknown", "cannot identify", "not visible").
    2. Caption contains a give-up phrase or starts with the LLM's
       boilerplate refusal pattern ("the item in this photo is not...").
    3. Both ``item_type`` *and* ``sub_category`` are empty/missing \u2014
       a sign the LLM gave up on classifying the garment.
    """
    if not analysis:
        return True
    GIVE_UP_PHRASES = (
        "unidentifiable",
        "obscured",
        "cannot identify",
        "can't identify",
        "not clearly visible",
        "not identifiable",
        "unable to identify",
        "no garment",
        "no clothing",
        "unknown garment",
        "unknown item",
    )
    title = (analysis.get("title") or "").lower()
    caption = (analysis.get("caption") or "").lower()
    if any(p in title for p in GIVE_UP_PHRASES):
        return True
    if any(p in caption for p in GIVE_UP_PHRASES):
        return True
    item_type = (analysis.get("item_type") or "").strip()
    sub_category = (analysis.get("sub_category") or "").strip()
    if not item_type and not sub_category:
        return True
    return False


def _looks_already_cropped(detections: list[dict[str, Any]]) -> bool:
    """Return True when the photo is already a tight single-item shot.

    This includes single-item product shots, standalone footwear/accessory
    photos with no human present, or any photo containing only one category
    of garment.
    """
    if not detections:
        return True  # nothing detectable — safer to analyse whole frame
    frame_area = 1000 * 1000

    def _area(bbox: list[int]) -> int:
        y1, x1, y2, x2 = bbox
        return max(0, (x2 - x1)) * max(0, (y2 - y1))

    has_human = False
    has_head = any(d.get("has_human_head", False) for d in detections)
    garment_kinds = {
        (d.get("category") or d.get("kind") or "garment").lower()
        for d in detections
        if _area(d["bbox"]) >= frame_area * 0.03
    }
    if has_head or len(garment_kinds) > 1:
        for d in detections:
            hm = d.get("_human_mask_full")
            if hm is not None and hm.sum() >= 30000:
                has_human = True
                break

    if not has_human and len(garment_kinds) <= 1:
        return True

    areas = [_area(d["bbox"]) for d in detections]
    largest_area = max(areas) if areas else 0

    # Signal 0: single category detection covering >= single-item threshold
    if len(garment_kinds) <= 1 and largest_area >= frame_area * _SINGLE_ITEM_AREA_FRAC:
        return True

    # Signal 1: one dominant detection (only triggers when nothing crossed
    # the threshold above — kept for the ``len == 1`` corner cases).
    if len(detections) == 1:
        if largest_area >= frame_area * _SINGLE_ITEM_AREA_FRAC:
            return True
        # A single tiny detection on a clean-looking frame also hints at
        # an over-zealous sub-part crop.
        if largest_area <= frame_area * 0.25:
            return True
        return False

    # Signal 3: heavily-overlapping detections imply one garment with
    # conflicting class labels.
    sum_areas = sum(areas)
    ymins = [d["bbox"][0] for d in detections]
    xmins = [d["bbox"][1] for d in detections]
    ymaxs = [d["bbox"][2] for d in detections]
    xmaxs = [d["bbox"][3] for d in detections]
    union = max(1, (max(ymaxs) - min(ymins)) * (max(xmaxs) - min(xmins)))
    overlap_ratio = sum_areas / float(union)
    if overlap_ratio >= 1.4:
        return True

    # Signal 2: several detections of the same kind, all clustered inside
    # a small area (collar / sleeve / hem hallucinations).
    kinds = {(d.get("category") or d.get("kind") or "garment").lower() for d in detections}
    if len(kinds) > 1:
        return False
    return union <= frame_area * _SUBPART_UNION_FRAC

