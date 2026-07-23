"""
Step B: Bounding Box Slicing & Region Extraction (grid_slicer.py)

Iterates over captured viewport screenshot frames and extracts raw cropped garment tile bounding boxes.
Uses dynamic OpenCV contour detection (cv2.findContours) with fallback to grid geometry coordinates.
"""

import logging
from typing import List, Tuple, Optional
import numpy as np
from PIL import Image

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    cv2 = None
    HAS_OPENCV = False

from app.services.migration import config

logger = logging.getLogger(__name__)


def extract_tiles_opencv(
    pil_img: Image.Image,
    min_area: int = config.CONTOUR_MIN_AREA,
    max_area_ratio: float = config.CONTOUR_MAX_AREA_RATIO,
    aspect_ratio_range: Tuple[float, float] = config.ASPECT_RATIO_RANGE,
) -> List[Image.Image]:
    """
    Locates distinct garment item regions using OpenCV dynamic contour detection.
    Returns cropped PIL Images for each detected garment bounding box.
    """
    if not HAS_OPENCV:
        return []

    try:
        # Convert PIL to cv2 BGR
        rgb_arr = np.array(pil_img.convert("RGB"))
        bgr_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)

        img_h, img_w = bgr_arr.shape[:2]
        total_area = img_h * img_w
        max_area = total_area * max_area_ratio

        # Grayscale & Gaussian blur
        gray = cv2.cvtColor(bgr_arr, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Morphological gradient / Canny edge + Adaptive Threshold
        edges = cv2.Canny(blurred, 30, 150)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(edges, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        bounding_boxes: List[Tuple[int, int, int, int]] = []

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = w / float(h)

            if aspect_ratio < aspect_ratio_range[0] or aspect_ratio > aspect_ratio_range[1]:
                continue

            bounding_boxes.append((x, y, w, h))

        # Sort bounding boxes top-to-bottom, left-to-right
        bounding_boxes.sort(key=lambda b: (b[1] // 50, b[0]))

        tiles: List[Image.Image] = []
        for x, y, w, h in bounding_boxes:
            crop_tile = pil_img.crop((x, y, x + w, y + h))
            tiles.append(crop_tile)

        return tiles
    except Exception as err:
        logger.warning("OpenCV dynamic contour extraction encountered error: %s", err)
        return []


def extract_tiles_grid_geometry(
    pil_img: Image.Image,
    columns: int = config.GRID_SLICER_COLUMNS,
    rows: int = 3,
) -> List[Image.Image]:
    """
    Fallback grid geometry slicer. Splits a viewport screenshot frame into a uniform grid layout.
    """
    img_w, img_h = pil_img.size
    cell_w = img_w // columns
    cell_h = img_h // rows

    tiles: List[Image.Image] = []
    for r in range(rows):
        for c in range(columns):
            x1 = c * cell_w
            y1 = r * cell_h
            x2 = (c + 1) * cell_w if c < columns - 1 else img_w
            y2 = (r + 1) * cell_h if r < rows - 1 else img_h

            # Padding crop slightly to remove potential cell borders
            pad_x = int(cell_w * 0.05)
            pad_y = int(cell_h * 0.05)

            crop_box = (
                max(0, x1 + pad_x),
                max(0, y1 + pad_y),
                min(img_w, x2 - pad_x),
                min(img_h, y2 - pad_y),
            )
            tile = pil_img.crop(crop_box)
            if tile.width > 20 and tile.height > 20:
                tiles.append(tile)

    return tiles


class GridSlicer:
    """
    Extracts individual garment tile bounding boxes from a list of viewport screenshot images.
    Combines OpenCV dynamic contour extraction with grid geometry fallback.
    """

    def __init__(
        self,
        min_area: int = config.CONTOUR_MIN_AREA,
        max_area_ratio: float = config.CONTOUR_MAX_AREA_RATIO,
        grid_columns: int = config.GRID_SLICER_COLUMNS,
    ):
        self.min_area = min_area
        self.max_area_ratio = max_area_ratio
        self.grid_columns = grid_columns

    def slice_viewport_frames(self, viewport_frames: List[Image.Image]) -> List[Image.Image]:
        """
        Processes viewport screenshot frames and returns a flat list of extracted raw garment tile images.
        """
        all_tiles: List[Image.Image] = []

        for idx, frame in enumerate(viewport_frames):
            logger.debug("GridSlicer processing viewport frame %d (%dx%d)", idx, frame.width, frame.height)

            # Try OpenCV dynamic contour extraction first
            cv_tiles = extract_tiles_opencv(
                frame,
                min_area=self.min_area,
                max_area_ratio=self.max_area_ratio,
            )

            if cv_tiles:
                logger.debug("GridSlicer OpenCV extracted %d garment tiles from frame %d", len(cv_tiles), idx)
                all_tiles.extend(cv_tiles)
            else:
                # Fall back to geometric grid slicing
                grid_tiles = extract_tiles_grid_geometry(frame, columns=self.grid_columns)
                logger.debug("GridSlicer fallback extracted %d grid tiles from frame %d", len(grid_tiles), idx)
                all_tiles.extend(grid_tiles)

        logger.info("GridSlicer extracted total %d raw garment tile bounding boxes", len(all_tiles))
        return all_tiles
