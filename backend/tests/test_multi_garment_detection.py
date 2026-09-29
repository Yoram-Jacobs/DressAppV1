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
    assert fixed["item_type"] in ("shoes", "Casual Shoes")
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
    assert fixed["item_type"] in ("shoes", "Casual Shoes")


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
    assert fixed["item_type"] in ("skirt", "Classic Skirt")


@pytest.mark.anyio
async def test_gatekeep_image_returns_none_for_gemma_provider():
    """Gemma provider operates without Gemini gatekeeper and must return None (unknown count)."""
    service = GarmentVisionService(provider="gemma")
    count = await service._gatekeep_image(b"fake_image_bytes")
    assert count is None


def test_enforce_segformer_category_bag_overrides_belt():
    """When SegFormer detects label='bag' and model outputs 'Belt' / 'Textured Rope Belt Accessory', override to Bag."""
    hallucinated_analysis = {
        "name": "Textured Rope Belt Accessory",
        "title": "Textured Rope Belt Accessory",
        "category": "Accessories",
        "sub_category": "Belt",
        "item_type": "Belt",
        "colors": ["beige"],
    }
    
    fixed = _enforce_segformer_category(
        hallucinated_analysis,
        segformer_kind="accessory",
        label="bag",
        is_single_item=False,
    )
    
    assert fixed["category"] == "Accessories"
    assert fixed["sub_category"] == "Bag"
    assert fixed["item_type"] == "Handbag"
    assert "Belt" not in fixed["name"]
    assert "Bag" in fixed["name"]
    assert fixed["_subcategory_overridden_by"] == "segformer-bag"


def test_enforce_segformer_category_shoes_overrides_ankle_boots():
    """When SegFormer detects label='shoes' and model outputs 'Boots' / 'White Platform Ankle Boots', override to Sneakers."""
    hallucinated_analysis = {
        "name": "White Platform Ankle Boots",
        "title": "White Platform Ankle Boots",
        "category": "Footwear",
        "sub_category": "Boots",
        "item_type": "Boots",
        "colors": ["white"],
    }
    
    fixed = _enforce_segformer_category(
        hallucinated_analysis,
        segformer_kind="footwear",
        label="shoes",
        is_single_item=False,
    )
    
    assert fixed["category"] == "Footwear"
    assert fixed["sub_category"] == "Sneakers"
    assert fixed["item_type"] == "Low-Top Sneakers"
    assert "Boots" not in fixed["name"]
    assert "Sneakers" in fixed["name"]
    assert fixed["_subcategory_overridden_by"] == "segformer-shoes"


def test_extract_json_truncated_array_recovers_items():
    """Truncated JSON arrays without closing brackets recover all completed garment objects."""
    from app.services.vision.llm import _extract_json

    truncated_raw = (
        '[\n'
        '  {"title": "White T-Shirt", "category": "Top", "sub_category": "T-Shirt"},\n'
        '  {"title": "Blue Jeans", "category": "Bottom", "sub_category": "Jeans"},\n'
        '  {"title": "Canvas Bag", "category": "Accessories", "sub_category": "Bag"},\n'
        '  {"title": "Low-Top Sneakers", "category": "Footwear"'
    )
    extracted = _extract_json(truncated_raw)
    assert isinstance(extracted, list), f"Expected list of objects, got {type(extracted)}"
    assert len(extracted) == 3, f"Expected 3 recovered items, got {len(extracted)}"
    assert extracted[0]["title"] == "White T-Shirt"
    assert extracted[1]["title"] == "Blue Jeans"
    assert extracted[2]["title"] == "Canvas Bag"


@pytest.mark.anyio
async def test_multi_garment_single_prompt_ingestion(monkeypatch):
    """Verify that multi-garment detection runs the vision prompt ONLY ONCE for all items on an image."""
    import io
    from PIL import Image
    from unittest.mock import AsyncMock
    from app.services.vision.service import GarmentVisionService
    import app.services.vision.service as vision_mod

    # Create dummy 100x100 JPEG
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    fake_img = buf.getvalue()

    service = GarmentVisionService(provider="gemma")

    # Mock detect_items to return 3 detected garments on image 0
    fake_detections = [
        {"label": "shirt", "kind": "top", "category": "top", "bbox": [100, 200, 500, 800], "score": 0.95, "has_human_head": True},
        {"label": "pants", "kind": "bottom", "category": "bottom", "bbox": [500, 200, 950, 800], "score": 0.92, "has_human_head": True},
        {"label": "bag", "kind": "accessory", "category": "bag", "bbox": [300, 750, 650, 950], "score": 0.88, "has_human_head": True},
    ]
    monkeypatch.setattr(service, "detect_items", AsyncMock(return_value=fake_detections))

    # Mock _call_gemma_space to return a single multi-item JSON array
    mock_multi_response = (
        '[\n'
        '  {"title": "Linen Shirt", "name": "Linen Shirt", "category": "Top", "sub_category": "Shirt", '
        '   "item_type": "Linen Shirt", "gender": "unisex", "dress_code": "casual", "season": ["summer"], '
        '   "colors": [{"name": "white", "pct": 100}], "fabric_materials": [{"name": "linen", "pct": 100}], '
        '   "pattern": "solid", "state": "new", "condition": "good", "quality": "mid", "price_cents": 5000, "caption": "Shirt"},\n'
        '  {"title": "Chino Pants", "name": "Chino Pants", "category": "Bottom", "sub_category": "Pants", '
        '   "item_type": "Chino Pants", "gender": "unisex", "dress_code": "casual", "season": ["summer"], '
        '   "colors": [{"name": "beige", "pct": 100}], "fabric_materials": [{"name": "cotton", "pct": 100}], '
        '   "pattern": "solid", "state": "new", "condition": "good", "quality": "mid", "price_cents": 6000, "caption": "Pants"},\n'
        '  {"title": "Canvas Tote Bag", "name": "Canvas Tote Bag", "category": "Accessories", "sub_category": "Bag", '
        '   "item_type": "Handbag", "gender": "unisex", "dress_code": "casual", "season": ["all"], '
        '   "colors": [{"name": "natural", "pct": 100}], "fabric_materials": [{"name": "canvas", "pct": 100}], '
        '   "pattern": "solid", "state": "new", "condition": "good", "quality": "mid", "price_cents": 3000, "caption": "Bag"}\n'
        ']'
    )
    gemma_mock = AsyncMock(return_value=mock_multi_response)
    monkeypatch.setattr(vision_mod, "_call_gemma_space", gemma_mock)
    monkeypatch.setattr(vision_mod.settings, "EYES_GEMMA_SPACE_URL", "http://fake-eyes:7860")

    frames = []
    async for frame in service.analyze_outfits_stream([fake_img]):
        frames.append(frame)

    # 1. Assert _call_gemma_space was called EXACTLY ONCE for all 3 items (single prompt ingestion!)
    assert gemma_mock.call_count == 1, f"Expected 1 unified call, got {gemma_mock.call_count}"

    # 2. Assert frames structure: detect frame, 3 item frames, done frame
    types = [f["type"] for f in frames]
    assert "detect" in types
    assert types.count("item") == 3
    assert "done" in types

    # 3. Assert items were classified correctly and bags did not leak cardigan
    item_frames = [f for f in frames if f["type"] == "item"]
    assert item_frames[0]["analysis"]["category"] == "Top"
    assert item_frames[1]["analysis"]["category"] == "Bottom"
    assert item_frames[2]["analysis"]["category"] == "Accessories"
    assert item_frames[2]["analysis"]["sub_category"] == "Bag"
    assert "cardigan" not in item_frames[2]["analysis"]["title"].lower()

