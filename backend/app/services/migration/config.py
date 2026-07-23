"""
Configuration parameters for Competitor Wardrobe Screenshot-Scroller & Deduplication Pipeline.
All values are tunable via this central module.
"""

from typing import Tuple

# Step A: Scroll & Capture Loop Configuration
SCROLL_AMOUNT: int = 300  # Default vertical scroll step in pixels
STABILIZATION_PAUSE_MIN: float = 0.8  # Minimum stabilization delay (seconds)
STABILIZATION_PAUSE_MAX: float = 1.2  # Maximum stabilization delay (seconds)
MAX_SCROLL_ITERATIONS: int = 50  # Hard cutoff for scroll iterations
DIFF_THRESHOLD: float = 0.01  # ImageChops normalized difference threshold below which viewport is deemed unchanged

# Step B: Grid Slicer & Region Extraction Configuration
CONTOUR_MIN_AREA: int = 2500  # Minimum pixel area for valid garment tile bounding box
CONTOUR_MAX_AREA_RATIO: float = 0.85  # Maximum area ratio of total frame to prevent selecting full container
GRID_SLICER_COLUMNS: int = 3  # Fallback grid geometry column count
ASPECT_RATIO_RANGE: Tuple[float, float] = (0.3, 3.0)  # Allowed width/height ratio range for garment tiles

# Step C: Perceptual Deduplication Configuration
PERCEPTUAL_HASH_THRESHOLD: int = 5  # Hamming distance threshold for deduplication (<= 5 is duplicate)
HASH_SIZE: int = 8  # 8x8 matrix = 64 bit hash

# Step D: GarmentVision Ingestion Configuration
DEFAULT_CATEGORY: str = "Top"
BATCH_CONCURRENCY_LIMIT: int = 5
