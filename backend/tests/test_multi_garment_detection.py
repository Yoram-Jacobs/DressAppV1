"""Tests for multi-garment detection, SegFormer NMS suppression rules, and category anchoring."""

import numpy as np
import pytest
from app.services.clothing_parser import _suppress_overlapping_garments
from app.services.vision.validation import _enforce_segformer_category
from app.services.vision.service import GarmentVisionService


def test_suppress_overlapping_garments_human_wearer_preserves_skirt():
    """When a human wearer is present, top (Upper-clothes) and bottom (Skirt) must NEVER be merged."""
    H, W = 500, 300
    
    # Upper-clothes mask (top half of torso, y: 100..250, x: 80..220)
    top_mask = np.zeros((H, W), dtype=np.uint8)
    top_mask[100:250, 80:220] = 1
    
    # Skirt mask (bottom half, touching the waist at y: 248..420, x: 75..225)
    # Slight 2-pixel touch/overlap at waist
    skirt_mask = np.zeros((H, W), dtype=np.uint8)
    skirt_mask[248:420, 75:225] = 1
    
    by_label = {
        "Upper-clothes": {
            "label": "Upper-clothes",
            "category": "top",
            "score": 0.95,
            "mask": top_mask,
        },
        "Skirt": {
            "label": "Skirt",
            "category": "bottom",
            "score": 0.92,
            "mask": skirt_mask,
        },
    }
    
    # Even if count_hint is 1 (from an unreliable gatekeeper), has_human=True MUST prevent merging
    result = _suppress_overlapping_garments(
        by_label,
        has_human=True,
        count_hint=1,
    )
    
    assert "Upper-clothes" in result, "Upper-clothes should be preserved"
    assert "Skirt" in result, "Skirt MUST NOT be suppressed into Upper-clothes on a human wearer"
    assert len(result) == 2, f"Expected 2 garments, got {len(result)}: {list(result.keys())}"


def test_suppress_overlapping_garments_flatlay_merges_when_count_hint_1():
    """When has_human=False and count_hint=1, touching flatlay garments merge into a single item."""
    H, W = 500, 300
    top_mask = np.zeros((H, W), dtype=np.uint8)
    top_mask[100:250, 80:220] = 1
    
    bottom_mask = np.zeros((H, W), dtype=np.uint8)
    bottom_mask[250:420, 80:220] = 1
    
    by_label = {
        "Upper-clothes": {
            "label": "Upper-clothes",
            "category": "top",
            "score": 0.95,
            "mask": top_mask,
        },
        "Dress": {
            "label": "Dress",
            "category": "bottom",
            "score": 0.85,
            "mask": bottom_mask,
        },
    }
    
    result = _suppress_overlapping_garments(
        by_label,
        has_human=False,
        count_hint=1,
    )
    
    assert len(result) == 1, f"Expected 1 merged garment for flatlay single-item, got {len(result)}"


def test_enforce_segformer_category_footwear_overrides_sweater():
    """When Gemma/Gemini hallucinates 'White Knit Sweater' / 'Top' on shoes, category is corrected to Footwear."""
    hallucinated_analysis = {
        "name": "White Knit Sweater",
        "title": "White Knit Sweater",
        "category": "Top",
        "sub_category": "Sweater",
        "item_type": "crew_neck_sweater",
        "colors": ["white"],
    }
    
    fixed = _enforce_segformer_category(
        hallucinated_analysis,
        segformer_kind="footwear",
        label="shoes",
        is_single_item=False,
    )
    
    assert fixed["category"] == "Footwear"
    assert fixed["sub_category"] == "Shoes"
    assert fixed["item_type"] == "shoes"
    assert "Shoes" in fixed["name"]
    assert "Sweater" not in fixed["name"]
    assert fixed["_category_overridden_by"] == "segformer"


def test_enforce_segformer_category_footwear_protected_even_if_single_item():
    """Footwear must NEVER be left as a Top/Sweater even if is_single_item was set."""
    hallucinated_analysis = {
        "name": "White Knit Sweater",
        "title": "White Knit Sweater",
        "category": "Top",
        "sub_category": "Sweater",
        "item_type": "crew_neck_sweater",
        "colors": ["white"],
    }
    
    fixed = _enforce_segformer_category(
        hallucinated_analysis,
        segformer_kind="footwear",
        label="shoes",
        is_single_item=True,
    )
    
    assert fixed["category"] == "Footwear"
    assert fixed["sub_category"] == "Shoes"
    assert fixed["item_type"] == "shoes"


def test_enforce_segformer_category_bottom_skirt():
    """When SegFormer detects a skirt, enforce Bottom category and Skirt sub_category."""
    analysis = {
        "name": "Black Long Item",
        "title": "Black Long Item",
        "category": "Full Body",
        "sub_category": "Dress",
        "item_type": "maxi_dress",
        "colors": ["black"],
    }
    
    fixed = _enforce_segformer_category(
        analysis,
        segformer_kind="bottom",
        label="skirt",
        is_single_item=False,
    )
    
    assert fixed["category"] == "Bottom"
    assert fixed["sub_category"] == "Skirt"
    assert fixed["item_type"] == "skirt"


@pytest.mark.anyio
async def test_gatekeep_image_returns_none_for_gemma_provider():
    """Gemma provider operates without Gemini gatekeeper and must return None (unknown count)."""
    service = GarmentVisionService(provider="gemma")
    count = await service._gatekeep_image(b"fake_image_bytes")
    assert count is None
