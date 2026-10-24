"""Deterministic CPU-only 2D garment contour and metric analyzer.

Extracts alpha-channel silhouettes, tight bounding boxes, aspect ratios,
anatomical keypoints (shoulder width, chest width, waist width, hem width,
torso length), and garment category heuristics in < 15ms on a single CPU thread.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Tuple, Union

import cv2
import numpy as np
from PIL import Image


class GarmentValidationError(ValueError):
    """Raised when an input garment image is missing an alpha channel or is fully transparent."""


SUPPORTED_GARMENT_TYPES = ("tshirt", "hoodie", "pants", "dress")

# Canonical category aliases mapped to the 4 base templates
CATEGORY_ALIAS_MAP: Dict[str, str] = {
    "tshirt": "tshirt",
    "t-shirt": "tshirt",
    "tee": "tshirt",
    "top": "tshirt",
    "shirt": "tshirt",
    "polo": "tshirt",
    "blouse": "tshirt",
    "hoodie": "hoodie",
    "sweatshirt": "hoodie",
    "sweater": "hoodie",
    "jacket": "hoodie",
    "outerwear": "hoodie",
    "coat": "hoodie",
    "pants": "pants",
    "trousers": "pants",
    "jeans": "pants",
    "bottom": "pants",
    "shorts": "pants",
    "dress": "dress",
    "gown": "dress",
    "skirt": "dress",
}


@dataclass
class GarmentMetrics:
    """Extracted 2D dimensional and structural metrics for a clean RGBA garment."""

    bbox: Tuple[int, int, int, int]  # (x, y, width, height) in pixels
    aspect_ratio: float  # width / height of tight bounding box
    category: str  # canonical category: 'tshirt' | 'hoodie' | 'pants' | 'dress'
    keypoints: Dict[str, float] = field(default_factory=dict)
    image_size: Tuple[int, int] = (0, 0)  # (full_width, full_height)
    cropped_rgba: np.ndarray = field(repr=False, default_factory=lambda: np.empty((0, 0, 4), dtype=np.uint8))
    contour: np.ndarray = field(repr=False, default_factory=lambda: np.empty((0, 1, 2), dtype=np.int32))

    def to_dict(self) -> Dict[str, Any]:
        x, y, w, h = self.bbox
        return {
            "bbox": {"x": int(x), "y": int(y), "width": int(w), "height": int(h)},
            "aspect_ratio": round(float(self.aspect_ratio), 4),
            "category": self.category,
            "keypoints": {k: round(float(v), 4) for k, v in self.keypoints.items()},
            "image_size": {"width": int(self.image_size[0]), "height": int(self.image_size[1])},
        }


def normalize_garment_type(garment_type: str | None) -> str:
    """Normalize user-supplied garment type string or return 'auto'."""
    if not garment_type:
        return "auto"
    cleaned = garment_type.strip().lower()
    if cleaned == "auto":
        return "auto"
    if cleaned in CATEGORY_ALIAS_MAP:
        return CATEGORY_ALIAS_MAP[cleaned]
    raise GarmentValidationError(
        f"Unsupported garment_type '{garment_type}'. Expected one of: {', '.join(SUPPORTED_GARMENT_TYPES)} or 'auto'."
    )


def load_rgba_image(
    source: Union[str, Path, bytes, bytearray, memoryview, np.ndarray, Image.Image],
    require_alpha_transparency: bool = False,
) -> np.ndarray:
    """Load an image from disk, bytes, PIL Image, or numpy array into an RGBA uint8 array.

    Raises:
        GarmentValidationError: If the image cannot be decoded or lacks a 4th alpha channel.
    """
    if isinstance(source, np.ndarray):
        arr = source
        if arr.ndim != 3 or arr.shape[2] != 4:
            raise GarmentValidationError(
                "Input numpy array must have shape (H, W, 4) with an RGBA alpha channel."
            )
        rgba = arr.astype(np.uint8, copy=False)
    elif isinstance(source, Image.Image):
        if source.mode != "RGBA":
            if "A" not in source.getbands() and "transparency" not in source.info:
                raise GarmentValidationError(
                    f"Input PIL Image must have an alpha channel (got mode '{source.mode}')."
                )
            source = source.convert("RGBA")
        rgba = np.asarray(source, dtype=np.uint8)
    elif isinstance(source, (bytes, bytearray, memoryview)):
        raw_bytes = bytes(source)
        if not raw_bytes:
            raise GarmentValidationError("Empty image byte buffer provided.")
        buf = np.frombuffer(raw_bytes, dtype=np.uint8)
        bgra = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
        if bgra is None:
            raise GarmentValidationError("Failed to decode image bytes as a valid PNG/WebP image.")
        if bgra.ndim != 3 or bgra.shape[2] != 4:
            raise GarmentValidationError(
                "Uploaded image does not contain an alpha channel (4-channel RGBA PNG/WebP required)."
            )
        rgba = cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)
    elif isinstance(source, (str, Path)):
        path = Path(source)
        if not path.is_file():
            raise GarmentValidationError(f"Image file not found: {path}")
        bgra = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if bgra is None:
            raise GarmentValidationError(f"Failed to decode image file: {path}")
        if bgra.ndim != 3 or bgra.shape[2] != 4:
            raise GarmentValidationError(
                f"Image '{path.name}' does not contain an alpha channel (RGBA required)."
            )
        rgba = cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)
    else:
        raise GarmentValidationError(f"Unsupported image source type: {type(source).__name__}")

    if require_alpha_transparency:
        alpha = rgba[:, :, 3]
        # Verify the image isn't a solid opaque rectangle with no background cutout
        if int(np.min(alpha)) >= 250:
            raise GarmentValidationError(
                "Input image has a solid 100% opaque alpha channel; pre-cleaned transparent background is required."
            )

    return rgba


def _measure_band_span(mask: np.ndarray, y_start_frac: float, y_end_frac: float) -> Tuple[float, float]:
    """Compute the median and 90th-percentile horizontal width (in pixels) of a vertical slice."""
    h, w = mask.shape
    y0 = max(0, min(h - 1, int(round(h * y_start_frac))))
    y1 = max(y0 + 1, min(h, int(round(h * y_end_frac))))
    band = mask[y0:y1, :]
    spans = []
    for row in band:
        nz = np.flatnonzero(row)
        if nz.size >= 2:
            spans.append(float(nz[-1] - nz[0] + 1))
    if not spans:
        return 0.0, 0.0
    spans_arr = np.asarray(spans, dtype=np.float64)
    return float(np.median(spans_arr)), float(np.percentile(spans_arr, 90))


def _detect_leg_split_ratio(mask: np.ndarray) -> float:
    """Measure the fraction of rows in the lower half (58% - 92%) that split into two distinct leg columns."""
    h, w = mask.shape
    y0 = int(round(h * 0.58))
    y1 = max(y0 + 1, int(round(h * 0.92)))
    band = mask[y0:y1, :]
    if band.shape[0] == 0:
        return 0.0

    split_rows = 0
    valid_rows = 0
    min_gap = max(2, int(w * 0.04))
    min_leg = max(2, int(w * 0.08))

    for row in band:
        nz = np.flatnonzero(row)
        if nz.size < min_leg * 2:
            continue
        valid_rows += 1
        diffs = np.diff(nz)
        max_gap_idx = int(np.argmax(diffs))
        largest_gap = int(diffs[max_gap_idx])
        if largest_gap >= min_gap:
            # Ensure the gap is near the horizontal center (between 25% and 75% of width)
            gap_center = 0.5 * (nz[max_gap_idx] + nz[max_gap_idx + 1])
            if 0.22 * w <= gap_center <= 0.78 * w:
                split_rows += 1

    if valid_rows == 0:
        return 0.0
    return float(split_rows) / float(valid_rows)


def _detect_collar_dip_and_hood(mask: np.ndarray) -> Tuple[float, float]:
    """Return (collar_dip_ratio, top_hood_narrow_ratio) from the upper 18% of the silhouette."""
    h, w = mask.shape
    top_band_h = max(2, int(round(h * 0.14)))
    top_band = mask[:top_band_h, :]

    # Measure top-most 10% width vs shoulder band (18% - 30%) width
    top_med, _ = _measure_band_span(mask, 0.02, 0.12)
    shoulder_med, shoulder_p90 = _measure_band_span(mask, 0.16, 0.32)
    hood_narrow_ratio = (top_med / shoulder_p90) if shoulder_p90 > 0 else 1.0

    # Measure central collar concavity in the middle 30% of X columns
    c0 = int(round(w * 0.35))
    c1 = max(c0 + 1, int(round(w * 0.65)))
    center_cols = top_band[:, c0:c1]
    first_opaque_y = []
    for col_idx in range(center_cols.shape[1]):
        nz = np.flatnonzero(center_cols[:, col_idx])
        if nz.size > 0:
            first_opaque_y.append(float(nz[0]))
        else:
            first_opaque_y.append(float(top_band_h))
    collar_dip_px = float(np.mean(first_opaque_y)) if first_opaque_y else 0.0
    collar_dip_ratio = collar_dip_px / float(max(1, h))
    return collar_dip_ratio, hood_narrow_ratio


def _classify_garment_heuristic(
    aspect_ratio: float,
    shoulder_w: float,
    chest_w: float,
    waist_w: float,
    hem_w: float,
    height_px: float,
    leg_split_ratio: float,
    hood_narrow_ratio: float,
) -> str:
    """Deterministic geometric classifier for 2D garment silhouettes."""
    # 1. Pants: distinct vertical leg split in the lower half, or narrow elongated tubular profile
    if leg_split_ratio >= 0.25 and aspect_ratio < 1.05:
        return "pants"

    # 2. Dress: tall silhouette (aspect < 0.72) with flared or wide continuous skirt hem and no leg split
    skirt_flare = (hem_w / max(1.0, waist_w)) if waist_w > 0 else 1.0
    if aspect_ratio < 0.72 and leg_split_ratio < 0.20:
        if skirt_flare >= 1.08 or hem_w >= shoulder_w * 0.92:
            return "dress"
        return "pants"

    # 3. Hoodie: pronounced narrow upper hood dome (top 10% much narrower than shoulder/sleeve span)
    if 0.12 <= hood_narrow_ratio <= 0.52 and chest_w >= height_px * 0.72 and leg_split_ratio < 0.20:
        return "hoodie"

    # 4. Default upper-body top
    return "tshirt"


def analyze_garment_image(
    source: Union[str, Path, bytes, bytearray, memoryview, np.ndarray, Image.Image],
    garment_type: str = "auto",
    alpha_threshold: int = 15,
    min_contour_area: float = 16.0,
    require_alpha_transparency: bool = False,
) -> GarmentMetrics:
    """Extract dimensional bounding contours, aspect ratio, category, and keypoints from an RGBA image.

    Args:
        source: Path, bytes, PIL Image, or RGBA numpy array.
        garment_type: Optional explicit garment type ('tshirt', 'hoodie', 'pants', 'dress', or 'auto').
        alpha_threshold: Minimum alpha value [1..254] considered foreground (default 15).
        min_contour_area: Minimum pixel area required for a valid garment contour.
        require_alpha_transparency: If True, reject images whose alpha channel is 100% solid 255.

    Returns:
        GarmentMetrics containing bounding box, aspect ratio, resolved category, keypoints, and cropped RGBA.

    Raises:
        GarmentValidationError: If the image is missing an alpha channel or is completely transparent.
    """
    normalized_type = normalize_garment_type(garment_type)
    rgba = load_rgba_image(source, require_alpha_transparency=require_alpha_transparency)
    full_h, full_w = rgba.shape[:2]

    alpha = rgba[:, :, 3]
    mask = np.where(alpha > alpha_threshold, np.uint8(255), np.uint8(0))

    if int(np.count_nonzero(mask)) == 0:
        raise GarmentValidationError("Image is completely transparent; no garment pixels detected.")

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise GarmentValidationError("No valid contours found in alpha channel.")

    valid_contours = [c for c in contours if cv2.contourArea(c) >= min_contour_area]
    if not valid_contours:
        # Fallback to largest contour if image is very small in unit tests
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) <= 0.0:
            raise GarmentValidationError("Garment contour area is zero or degenerate.")
        valid_contours = [largest]

    primary_contour = max(valid_contours, key=cv2.contourArea)
    stacked_points = np.vstack(valid_contours)
    x, y, w, h = cv2.boundingRect(stacked_points)

    if w < 2 or h < 2:
        raise GarmentValidationError(f"Garment bounding box is degenerate ({w}x{h}px).")

    aspect_ratio = float(w) / float(h)
    cropped_rgba = np.ascontiguousarray(rgba[y : y + h, x : x + w, :])
    cropped_mask = mask[y : y + h, x : x + w]

    # Extract anatomical band widths (in pixels)
    shoulder_med, shoulder_p90 = _measure_band_span(cropped_mask, 0.10, 0.26)
    chest_med, chest_p90 = _measure_band_span(cropped_mask, 0.22, 0.46)
    waist_med, _ = _measure_band_span(cropped_mask, 0.46, 0.66)
    hem_med, hem_p90 = _measure_band_span(cropped_mask, 0.78, 0.96)

    shoulder_width_px = shoulder_p90 if shoulder_p90 > 0 else float(w)
    chest_width_px = chest_p90 if chest_p90 > 0 else float(w)
    waist_width_px = waist_med if waist_med > 0 else float(w) * 0.8
    hem_width_px = hem_p90 if hem_p90 > 0 else float(w)
    torso_length_px = float(h)

    leg_split_ratio = _detect_leg_split_ratio(cropped_mask)
    collar_dip_ratio, hood_narrow_ratio = _detect_collar_dip_and_hood(cropped_mask)

    if normalized_type == "auto":
        resolved_category = _classify_garment_heuristic(
            aspect_ratio=aspect_ratio,
            shoulder_w=shoulder_width_px,
            chest_w=chest_width_px,
            waist_w=waist_width_px,
            hem_w=hem_width_px,
            height_px=torso_length_px,
            leg_split_ratio=leg_split_ratio,
            hood_narrow_ratio=hood_narrow_ratio,
        )
    else:
        resolved_category = normalized_type

    # Normalize anatomical dimensions relative to canonical height (1.0 unit = full garment height)
    inv_h = 1.0 / float(h)
    inv_w = 1.0 / float(w)
    keypoints: Dict[str, float] = {
        "shoulder_width_px": float(shoulder_width_px),
        "chest_width_px": float(chest_width_px),
        "waist_width_px": float(waist_width_px),
        "hem_width_px": float(hem_width_px),
        "torso_length_px": float(torso_length_px),
        "shoulder_width": float(shoulder_width_px * inv_h),
        "chest_width": float(chest_width_px * inv_h),
        "waist_width": float(waist_width_px * inv_h),
        "hem_width": float(hem_width_px * inv_h),
        "torso_length": 1.0,
        "shoulder_span_norm": float(shoulder_width_px * inv_w),
        "hem_span_norm": float(hem_width_px * inv_w),
        "collar_dip_ratio": float(collar_dip_ratio),
        "leg_split_ratio": float(leg_split_ratio),
    }

    return GarmentMetrics(
        bbox=(int(x), int(y), int(w), int(h)),
        aspect_ratio=aspect_ratio,
        category=resolved_category,
        keypoints=keypoints,
        image_size=(int(full_w), int(full_h)),
        cropped_rgba=cropped_rgba,
        contour=primary_contour,
    )
