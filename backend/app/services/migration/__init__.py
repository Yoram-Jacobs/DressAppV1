"""
Competitor Wardrobe Import Migration Package.

Replaces legacy DOM scraping with Screenshot-Scroller & Deduplication Pipeline integrated into GarmentVision.
"""

from app.services.migration.config import (
    SCROLL_AMOUNT,
    STABILIZATION_PAUSE_MIN,
    STABILIZATION_PAUSE_MAX,
    MAX_SCROLL_ITERATIONS,
    DIFF_THRESHOLD,
    CONTOUR_MIN_AREA,
    PERCEPTUAL_HASH_THRESHOLD,
)
from app.services.migration.scroller_engine import ScrollerEngine, compute_frame_difference
from app.services.migration.grid_slicer import GridSlicer, extract_tiles_opencv, extract_tiles_grid_geometry
from app.services.migration.dedup_engine import DedupEngine, compute_perceptual_hash, is_duplicate
from app.services.migration.garmentvision_adapter import GarmentVisionAdapter

__all__ = [
    "SCROLL_AMOUNT",
    "STABILIZATION_PAUSE_MIN",
    "STABILIZATION_PAUSE_MAX",
    "MAX_SCROLL_ITERATIONS",
    "DIFF_THRESHOLD",
    "CONTOUR_MIN_AREA",
    "PERCEPTUAL_HASH_THRESHOLD",
    "ScrollerEngine",
    "compute_frame_difference",
    "GridSlicer",
    "extract_tiles_opencv",
    "extract_tiles_grid_geometry",
    "DedupEngine",
    "compute_perceptual_hash",
    "is_duplicate",
    "GarmentVisionAdapter",
]
