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
    """Gemma provider operates without Gemini gatekeeper and must return (None, None) (unknown count and model gender)."""
    service = GarmentVisionService(provider="gemma")
    count, model_gender = await service._gatekeep_image(b"fake_image_bytes")
    assert count is None
    assert model_gender is None


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


def test_looks_already_cropped_footwear_pair():
    """Verify that a photo with two shoe detections is recognized as a single footwear pair."""
    from app.services.vision.geometry import _looks_already_cropped
    detections = [
        {"bbox": [300, 200, 550, 800], "kind": "footwear", "category": "footwear", "label": "left_shoe"},
        {"bbox": [530, 200, 800, 800], "kind": "footwear", "category": "footwear", "label": "right_shoe"},
    ]
    # Even if count is 2 (from a gatekeeper that counted 2 shoes), footwear detections must be treated as already cropped / single pair
    assert _looks_already_cropped(detections, count_hint=2) is True


def test_looks_already_cropped_footwear_partner_misclassified():
    """When one shoe is classified as footwear and the other as top, it must still be treated as a single item."""
    from app.services.vision.geometry import _looks_already_cropped
    detections = [
        {"bbox": [150, 250, 520, 750], "kind": "footwear", "category": "footwear", "label": "Shoes"},
        {"bbox": [480, 280, 820, 780], "kind": "garment", "category": "top", "label": "Upper-clothes"},
    ]
    assert _looks_already_cropped(detections, count_hint=None) is True


def test_coerce_single_garment_hebrew_footwear_and_caption():
    """Hebrew output language must translate footwear sub_category, item_type and produce Hebrew caption."""
    from app.services.vision.validation import _coerce_single_garment
    parsed = {
        "name": "שחור גומי כפכפים",
        "title": "כפכפי פלטפורמה",
        "category": "Footwear",
        "sub_category": "Shoes",
        "item_type": "Casual Shoes",
        "gender": "women",
        "caption": "",
    }
    result = _coerce_single_garment(parsed, language="he")
    assert result["sub_category"] == "נעליים"
    assert result["item_type"] == "נעלי קז'ואל"
    assert "A versatile" not in result["caption"]
    assert "נוח לשימוש יומיומי" in result["caption"] or "אופנתי" in result["caption"]


def test_coerce_single_garment_multilingual_captions():
    """Fallback captions must be localized across supported languages without English leaks."""
    from app.services.vision.validation import _coerce_single_garment
    
    # Arabic
    ar_item = {"name": "حذاء أنيق", "category": "Footwear", "sub_category": "Shoes", "caption": ""}
    assert "مريح للاستخدام اليومي" in _coerce_single_garment(ar_item, language="ar")["caption"]

    # French
    fr_item = {"name": "Manteau en laine", "category": "Outerwear", "sub_category": "Coats", "caption": ""}
    assert "coupe structurée" in _coerce_single_garment(fr_item, language="fr")["caption"]

    # German
    de_item = {"name": "Schwarze Schuhe", "category": "Footwear", "sub_category": "Shoes", "caption": ""}
    assert "Tragekomfort" in _coerce_single_garment(de_item, language="de")["caption"]

    # Spanish
    es_item = {"name": "Bolso de cuero", "category": "Accessories", "sub_category": "Bags", "caption": ""}
    assert "sofisticación" in _coerce_single_garment(es_item, language="es")["caption"]

    # Japanese
    ja_item = {"name": "スニーカー", "category": "Footwear", "sub_category": "Sneakers", "caption": ""}
    assert "履き心地" in _coerce_single_garment(ja_item, language="ja")["caption"]


@pytest.mark.anyio
async def test_analyze_outfits_stream_batches_multiple_photos_with_single_system_prompt():
    """Uploading more than one image must run the system prompt ONCE for the whole batch sequence."""
    from unittest.mock import AsyncMock, patch
    from app.services.vision.service import GarmentVisionService

    service = GarmentVisionService(api_key="test-key", provider="gemini")

    async def mock_detect_items(img_bytes, count_hint=None):
        return [{"bbox": [100, 100, 500, 500], "kind": "top", "label": "shirt"}]

    async def mock_gatekeep(img_bytes):
        return 1

    batch_stream_called_with = []
    async def mock_analyze_batch_stream(crops_bytes, *, language=None, kind_hints=None, user_gender=None, **kwargs):
        batch_stream_called_with.append({
            "num_crops": len(crops_bytes),
            "kind_hints": kind_hints,
        })
        for i in range(len(crops_bytes)):
            yield (i, {
                "category": "Top",
                "sub_category": "Shirt",
                "item_type": "Button-down Shirt",
                "title": f"Shirt {i}",
            })

    single_analyze_calls = []
    async def mock_analyze(*args, **kwargs):
        single_analyze_calls.append(args)
        return {
            "category": "Top",
            "sub_category": "Shirt",
            "item_type": "Shirt",
            "title": "Shirt",
        }

    with patch.object(service, "detect_items", side_effect=mock_detect_items), \
         patch.object(service, "_gatekeep_image", side_effect=mock_gatekeep), \
         patch.object(service, "analyze_batch_stream", side_effect=mock_analyze_batch_stream), \
         patch.object(service, "analyze", side_effect=mock_analyze):
        
        dummy_images = [b"fake_image_0", b"fake_image_1", b"fake_image_2"]
        frames = []
        async for frame in service.analyze_outfits_stream(dummy_images):
            frames.append(frame)

        assert len(batch_stream_called_with) == 1, (
            f"Expected analyze_batch_stream to be called once for the batch, got {len(batch_stream_called_with)}"
        )
        assert batch_stream_called_with[0]["num_crops"] == 3
        assert len(single_analyze_calls) == 0, (
            f"Expected 0 per-crop analyze calls, got {len(single_analyze_calls)}"
        )

        item_frames = [f for f in frames if f.get("type") == "item"]
        assert len(item_frames) == 3
        assert [f["image_index"] for f in item_frames] == [0, 1, 2]


def test_coerce_enums_and_single_garment_anchors_to_wearer_gender():
    """Ensure unisex/standard cuts align with known user/model gender, while gender-exclusive cuts stay intact."""
    from app.services.vision.validation import _coerce_enums, _coerce_single_garment

    # Case 1: Male model / user wearing suit jacket, dress pants, and dress shoes
    male_pants = {
        "name": "Light Gray Wool Dress Pants",
        "category": "Bottom",
        "sub_category": "Trousers",
        "item_type": "Chinos",
        "gender": "women",  # AI misclassification on isolated crop
    }
    coerced = _coerce_single_garment(male_pants, user_gender="men")
    assert coerced["gender"] == "men", f"Expected 'men' for trousers worn by a man, got {coerced['gender']}"
    coerced_enums = _coerce_enums(coerced, user_gender="men")
    assert coerced_enums["gender"] == "men"

    male_shoes = {
        "name": "Black Leather Dress Shoes",
        "category": "Footwear",
        "sub_category": "Shoes",
        "item_type": "Dress Shoes",
        "gender": "women",  # AI misclassification on isolated crop
    }
    coerced_shoes = _coerce_single_garment(male_shoes, user_gender="men")
    assert coerced_shoes["gender"] == "men", f"Expected 'men' for dress shoes worn by a man, got {coerced_shoes['gender']}"

    # Feminine cuts must remain 'women' even if user_gender is 'men'
    dress = {
        "name": "Floral Summer Dress",
        "category": "Full Body",
        "sub_category": "Dress",
        "item_type": "Maxi Dress",
        "gender": "women",
    }
    coerced_dress = _coerce_single_garment(dress, user_gender="men")
    assert coerced_dress["gender"] == "women", "Dress must remain 'women' even if user_gender='men'"

    # Case 2: Female model / user wearing trousers and sneakers
    female_trousers = {
        "name": "High-Waist Tailored Trousers",
        "category": "Bottom",
        "sub_category": "Trousers",
        "item_type": "Wide-leg pants",
        "gender": "men",  # AI misclassification
    }
    coerced_fem = _coerce_single_garment(female_trousers, user_gender="women")
    assert coerced_fem["gender"] == "women", f"Expected 'women' for trousers worn by a woman, got {coerced_fem['gender']}"

    # Masculine cuts must remain 'men' even if user_gender is 'women'
    tuxedo = {
        "name": "Classic Black Tuxedo",
        "category": "Outerwear",
        "sub_category": "Tuxedo",
        "item_type": "Tuxedo Jacket",
        "gender": "men",
    }
    coerced_tux = _coerce_single_garment(tuxedo, user_gender="women")
    assert coerced_tux["gender"] == "men", "Tuxedo must remain 'men' even if user_gender='women'"


def test_apply_alpha_intersection_preserves_smooth_edges_and_no_chewing():
    """Verify that apply_alpha_intersection preserves garment edges without chewing waists or fragmentation."""
    import io
    from PIL import Image
    from app.services.clothing_parser import apply_alpha_intersection

    H, W = 200, 150
    # Create synthetic RGBA image with smooth circular/pill shaped garment
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(40, 180):
        for x in range(30, 120):
            img.putpixel((x, y), (120, 120, 130, 255))
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # SegFormer coarse mask (covering the garment with small margin)
    seg_mask = np.zeros((H, W), dtype=np.uint8)
    seg_mask[35:185, 25:125] = 1

    # Human mask (e.g. skin outside the garment at bottom)
    human_mask = np.zeros((H, W), dtype=np.uint8)
    human_mask[185:195, 50:100] = 1

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=seg_mask,
        category="bottom",
        human_mask=human_mask,
    )
    assert result_bytes is not None, "apply_alpha_intersection should succeed"
    res_img = Image.open(io.BytesIO(result_bytes))
    res_arr = np.array(res_img)
    alpha = res_arr[:, :, 3]

    # Verify solid core of garment is 100% preserved (waistband at y=50, x=75)
    assert alpha[50, 75] == 255, "Pants waistband core should be fully opaque (not chewed)"
    assert alpha[100, 75] == 255, "Pants leg core should be fully opaque"
    assert (alpha > 128).sum() > 8000, "Garment area should be well preserved"


def test_other_mask_suppresses_adjacent_garment_without_chewing_target_hem():
    """Verify that other_mask cleanly suppresses an adjacent belt/waistband without chewing the shirt hem."""
    from app.services.clothing_parser import apply_alpha_intersection
    from PIL import Image
    import io

    H, W = 200, 150
    # rembg output: shirt (y: 20..120) + belt/pants (y: 121..180) both opaque
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(20, 180):
        for x in range(30, 120):
            img.putpixel((x, y), (250, 250, 250, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # Shirt mask
    shirt_mask = np.zeros((H, W), dtype=np.uint8)
    shirt_mask[20:120, 30:120] = 1

    # Adjacent belt/pants mask
    belt_mask = np.zeros((H, W), dtype=np.uint8)
    belt_mask[121:180, 30:120] = 1

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=shirt_mask,
        other_mask=belt_mask,
        category="top",
    )
    assert result_bytes is not None
    res_img = Image.open(io.BytesIO(result_bytes))
    arr = np.array(res_img)
    alpha = arr[:, :, 3]

    # Shirt body and hem should remain opaque
    assert alpha[60, 75] >= 240, "Shirt core must be fully opaque"
    assert alpha[115, 75] >= 200, "Shirt hem must be preserved"
    # Adjacent belt area should be cleanly suppressed to 0
    assert alpha[145, 75] == 0, "Adjacent belt/pants must be excised"


def test_collar_and_straps_not_guillotined():
    """Verify narrow shoulder straps (row coverage < 30%) are not sliced off by a horizontal guillotine."""
    from app.services.clothing_parser import apply_alpha_intersection
    from PIL import Image
    import io

    H, W = 200, 150
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Two narrow straps at top (x: 40..50 and 100..110, y: 15..45) -> row coverage is only 20px / 150px = 13%!
    for y in range(15, 45):
        for x in list(range(40, 50)) + list(range(100, 110)):
            img.putpixel((x, y), (30, 30, 30, 255))
    # Main shirt body (y: 45..150, x: 30..120)
    for y in range(45, 150):
        for x in range(30, 120):
            img.putpixel((x, y), (30, 30, 30, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    top_mask = np.zeros((H, W), dtype=np.uint8)
    for y in range(15, 45):
        for x in list(range(40, 50)) + list(range(100, 110)):
            top_mask[y, x] = 1
    top_mask[45:150, 30:120] = 1

    human_mask = np.zeros((H, W), dtype=np.uint8)
    human_mask[0:14, 50:100] = 1  # head/neck above the garment

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=top_mask,
        human_mask=human_mask,
        category="top",
    )
    assert result_bytes is not None
    res_img = Image.open(io.BytesIO(result_bytes))
    arr = np.array(res_img)
    alpha = arr[:, :, 3]

    # Verify shoulder straps are NOT guillotined
    assert alpha[30, 45] > 0, "Left shoulder strap must not be guillotined"
    assert alpha[30, 105] > 0, "Right shoulder strap must not be guillotined"


def test_garment_core_protected_from_skin_chrominance():
    """Verify that a camel/tan colored garment core is protected from false skin chrominance excision."""
    from app.services.clothing_parser import apply_alpha_intersection
    from PIL import Image
    import io

    H, W = 150, 150
    # Camel color: R=195, G=150, B=115 (Cr~150, Cb~90 -> matches raw skin chrominance bucket!)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(30, 120):
        for x in range(30, 120):
            img.putpixel((x, y), (195, 150, 115, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    mask = np.zeros((H, W), dtype=np.uint8)
    mask[30:120, 30:120] = 1

    human_mask = np.zeros((H, W), dtype=np.uint8)
    human_mask[10:28, 50:100] = 1  # neck/head above garment

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=mask,
        human_mask=human_mask,
        category="top",
    )
    assert result_bytes is not None
    res_img = Image.open(io.BytesIO(result_bytes))
    arr = np.array(res_img)
    alpha = arr[:, :, 3]

    # Center of camel top must NOT have swiss-cheese holes
    assert alpha[75, 75] == 255, "Camel garment core must remain fully opaque and protected from skin filter"







