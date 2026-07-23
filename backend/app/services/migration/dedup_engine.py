"""
Step C: Item-Level Deduplication via Perceptual Hashing (dedup_engine.py)

Filters out overlapping garment row captures caused by viewports scrolling over the competitor feed.
Computes perceptual hash (phash/dhash) for each extracted tile image and compares candidate hashes
against registered unique hashes using Hamming distance threshold (default <= 5).
"""

import logging
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from PIL import Image

from app.services.migration import config
from app.services.image_hash import average_hash, hamming_distance

logger = logging.getLogger(__name__)


def compute_perceptual_hash(pil_img: Image.Image | str | bytes, hash_size: int = config.HASH_SIZE) -> Optional[str]:
    """
    Computes a 64-bit perceptual hash (dHash) for a given garment tile PIL image (or data URL / bytes).
    Returns 16-character hex string or None if uncomputable.
    """
    try:
        if isinstance(pil_img, (str, bytes)):
            return average_hash(pil_img)

        img = pil_img
        if img.mode != "RGB":
            img = img.convert("RGB")

        small = img.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
        arr = np.asarray(small, dtype=np.uint8)
        diff = arr[:, 1:] > arr[:, :-1]
        bits = diff.flatten().astype(np.uint8)
        packed = np.packbits(bits)
        return packed.tobytes().hex()
    except Exception as exc:
        logger.warning("Perceptual hash computation failed: %s", exc)
        return None


def is_duplicate(
    candidate_hash: str,
    registered_hashes: List[str],
    threshold: int = config.PERCEPTUAL_HASH_THRESHOLD,
) -> Tuple[bool, int]:
    """
    Compares candidate hash against registered unique hashes using Hamming distance bit counts.
    Returns (is_dup, min_distance).
    """
    if not candidate_hash or not registered_hashes:
        return False, 65

    min_dist = 65
    for reg in registered_hashes:
        dist = hamming_distance(candidate_hash, reg)
        if dist < min_dist:
            min_dist = dist
        if dist <= threshold:
            return True, dist

    return False, min_dist


class DedupEngine:
    """
    Item-Level Deduplication Engine based on perceptual hashing.
    Filters raw tile lists down to unique garment assets.
    """

    def __init__(self, threshold: int = config.PERCEPTUAL_HASH_THRESHOLD):
        self.threshold = threshold

    def deduplicate_tiles(self, raw_tiles: List[Image.Image]) -> List[Image.Image]:
        """
        Deduplicates a list of raw garment tile PIL images based on perceptual hashing.
        Returns array of unique tile PIL images.
        """
        unique_tiles: List[Image.Image] = []
        registered_hashes: List[str] = []

        discarded_count = 0

        for idx, tile in enumerate(raw_tiles):
            h_str = compute_perceptual_hash(tile)
            if not h_str:
                # If hash calculation fails, keep tile to avoid dropping valid assets
                unique_tiles.append(tile)
                continue

            dup, dist = is_duplicate(h_str, registered_hashes, threshold=self.threshold)
            if dup:
                discarded_count += 1
                logger.debug("DedupEngine discarded duplicate tile %d (Hamming dist=%d <= %d)", idx, dist, self.threshold)
            else:
                registered_hashes.append(h_str)
                unique_tiles.append(tile)

        logger.info(
            "DedupEngine deduplicated %d raw tiles -> %d unique assets (%d duplicate tiles discarded with Hamming threshold <= %d)",
            len(raw_tiles),
            len(unique_tiles),
            discarded_count,
            self.threshold,
        )

        return unique_tiles
