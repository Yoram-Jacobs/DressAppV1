"""
Step A: Scroll & Capture Loop (scroller_engine.py)

Captures and stabilizes viewport screenshot frames during vertical scrolling over competitor wardrobe feeds.
Uses PIL.ImageChops.difference to compare consecutive frames and halt execution when zero difference
(bottom of feed reached) or max scroll limit is encountered.
"""

import time
import random
import logging
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
from PIL import Image, ImageChops

from app.services.migration import config

logger = logging.getLogger(__name__)


def compute_frame_difference(img1: Image.Image, img2: Image.Image) -> float:
    """
    Compares two PIL Image viewport frames using ImageChops.difference.
    Returns a normalized mean absolute difference score between 0.0 (identical) and 1.0 (completely distinct).
    """
    if img1.size != img2.size:
        img2 = img2.resize(img1.size, Image.Resampling.BILINEAR)

    # Convert to RGB mode for consistent channel difference calculation
    if img1.mode != "RGB":
        img1 = img1.convert("RGB")
    if img2.mode != "RGB":
        img2 = img2.convert("RGB")

    diff = ImageChops.difference(img1, img2)
    diff_arr = np.array(diff, dtype=np.float32)
    # Mean difference per pixel across channels 0-255 normalized to 0.0-1.0
    normalized_diff = float(np.mean(diff_arr) / 255.0)
    return normalized_diff


def simulate_stabilization_pause(
    min_pause: float = config.STABILIZATION_PAUSE_MIN,
    max_pause: float = config.STABILIZATION_PAUSE_MAX,
) -> float:
    """
    Pauses execution briefly (0.8s - 1.2s default) to allow frame rendering,
    DOM layouts, and image loading to stabilize.
    """
    pause_duration = random.uniform(min_pause, max_pause)
    time.sleep(pause_duration)
    return pause_duration


class ScrollerEngine:
    """
    Automated Screenshot-Scroller Engine.
    Executes frame capture, scroll iteration, stabilization delay, and ImageChops.difference termination check.
    """

    def __init__(
        self,
        scroll_amount: int = config.SCROLL_AMOUNT,
        max_iterations: int = config.MAX_SCROLL_ITERATIONS,
        diff_threshold: float = config.DIFF_THRESHOLD,
    ):
        self.scroll_amount = scroll_amount
        self.max_iterations = max_iterations
        self.diff_threshold = diff_threshold

    def process_frame_sequence(
        self,
        frames: List[Image.Image],
        region: Optional[Tuple[int, int, int, int]] = None,
    ) -> Dict[str, Any]:
        """
        Processes an incoming sequence of raw viewport screenshot frames (e.g. captured during continuous scrolling).
        Applies crop region if specified (x, y, width, height), evaluates frame differences using ImageChops,
        filters out duplicate static captures, and halts when bottom of feed (zero difference) is reached.

        Returns:
            Dict containing:
                - 'captured_frames': List[Image.Image] of unique stabilized viewport screenshots
                - 'total_processed': int
                - 'terminated_reason': str ('zero_difference', 'max_iterations', 'end_of_sequence')
        """
        if not frames:
            return {
                "captured_frames": [],
                "total_processed": 0,
                "terminated_reason": "empty_input",
            }

        cropped_frames = []
        for img in frames:
            if region:
                x, y, w, h = region
                # Ensure region bounds stay within image dimensions
                x2 = min(img.width, x + w)
                y2 = min(img.height, y + h)
                cropped_img = img.crop((x, y, x2, y2))
            else:
                cropped_img = img
            cropped_frames.append(cropped_img)

        stabilized_viewports: List[Image.Image] = []
        prev_frame: Optional[Image.Image] = None
        termination_reason = "end_of_sequence"

        for idx, current_frame in enumerate(cropped_frames):
            if idx >= self.max_iterations:
                logger.info("ScrollerEngine hit maximum scroll iterations (%d)", self.max_iterations)
                termination_reason = "max_iterations"
                break

            if prev_frame is not None:
                diff_score = compute_frame_difference(prev_frame, current_frame)
                logger.debug("ScrollerEngine frame %d diff_score: %.4f", idx, diff_score)

                if diff_score <= self.diff_threshold:
                    logger.info(
                        "ScrollerEngine zero viewport difference detected (diff=%.4f <= %.4f) at frame %d. Bottom of feed reached.",
                        diff_score,
                        self.diff_threshold,
                        idx,
                    )
                    termination_reason = "zero_difference"
                    break

            stabilized_viewports.append(current_frame)
            prev_frame = current_frame

        logger.info(
            "ScrollerEngine completed sequence: %d viewports captured out of %d frames (reason: %s)",
            len(stabilized_viewports),
            len(frames),
            termination_reason,
        )

        return {
            "captured_frames": stabilized_viewports,
            "total_processed": len(stabilized_viewports),
            "terminated_reason": termination_reason,
        }
