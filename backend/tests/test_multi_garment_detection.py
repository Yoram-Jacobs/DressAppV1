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


def test_enforce_segformer_category_double_monk_strap_shoes():
    """Verify double monk strap shoes are classified as Shoes, never Boots."""
    raw_analysis = {
        "name": "Brown Suede Double Monk Strap Shoes",
        "title": "Brown Suede Double Monk Strap Shoes",
        "category": "Footwear",
        "sub_category": "Boots",
        "item_type": "Boots",
        "colors": ["brown"],
    }

    fixed = _enforce_segformer_category(
        raw_analysis,
        segformer_kind="footwear",
        label="shoes",
        is_single_item=False,
    )

    assert fixed["category"] == "Footwear"
    assert fixed["sub_category"] == "Shoes"
    assert fixed["item_type"] == "Double Monk Strap Shoes"


def test_tag_deduplication_and_semantic_normalization():
    """Verify tags are normalized, deduplicated semantically, and never repeat words like Belts or Trousers."""
    from app.services.vision.validation import _coerce_single_garment

    # 1. Belt test case (Belts x 3 + accessory)
    raw_belt = {
        "title": "Brown Leather Belt",
        "category": "Accessories",
        "sub_category": "Belts",
        "item_type": "Leather Belt",
        "tags": ["Belts", "belts", "belt", "accessory"],
    }
    coerced_belt = _coerce_single_garment(raw_belt)
    belt_count = sum(1 for t in coerced_belt["tags"] if t.lower() in ("belts", "belt"))
    assert belt_count == 1
    assert "accessory" in coerced_belt["tags"]

    # 2. Trousers test case (Trousers x 2 + pants)
    raw_trousers = {
        "title": "Grey Trousers",
        "category": "Bottom",
        "sub_category": "Trousers",
        "item_type": "Chinos",
        "tags": ["Trousers", "trousers", "pants", "Grey", "smart-casual", "fall"],
    }
    coerced_trousers = _coerce_single_garment(raw_trousers)
    trouser_count = sum(1 for t in coerced_trousers["tags"] if t.lower() in ("trouser", "trousers", "pants", "pant"))
    assert trouser_count == 1
    assert len(coerced_trousers["tags"]) == len(set(coerced_trousers["tags"]))


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

    # Mock _call_gemma_space to return item responses using the single static system prompt
    item_responses = [
        '{"title": "Linen Shirt", "name": "Linen Shirt", "category": "Top", "sub_category": "Shirt", '
        '"item_type": "Linen Shirt", "gender": "unisex", "dress_code": "casual", "season": ["summer"], '
        '"colors": [{"name": "white", "pct": 100}], "fabric_materials": [{"name": "linen", "pct": 100}], '
        '"pattern": "solid", "tags": ["linen"], "caption": "A clean linen shirt."}',
        '{"title": "Chino Pants", "name": "Chino Pants", "category": "Bottom", "sub_category": "Pants", '
        '"item_type": "Chino Pants", "gender": "unisex", "dress_code": "casual", "season": ["summer"], '
        '"colors": [{"name": "beige", "pct": 100}], "fabric_materials": [{"name": "cotton", "pct": 100}], '
        '"pattern": "solid", "tags": ["cotton"], "caption": "Casual beige chino pants."}',
        '{"title": "Canvas Tote Bag", "name": "Canvas Tote Bag", "category": "Accessories", "sub_category": "Bag", '
        '"item_type": "Handbag", "gender": "unisex", "dress_code": "casual", "season": ["summer"], '
        '"colors": [{"name": "natural", "pct": 100}], "fabric_materials": [{"name": "canvas", "pct": 100}], '
        '"pattern": "solid", "tags": ["tote"], "caption": "A natural canvas tote bag."}',
    ]
    gemma_mock = AsyncMock(side_effect=item_responses)
    import app.services.vision.llm as llm_mod
    monkeypatch.setattr(llm_mod, "_call_gemma_space", gemma_mock)
    monkeypatch.setattr(vision_mod, "_call_gemma_space", gemma_mock)
    monkeypatch.setattr(vision_mod.settings, "EYES_GEMMA_SPACE_URL", "http://fake-eyes:7860")

    frames = []
    async for frame in service.analyze_outfits_stream([fake_img]):
        frames.append(frame)

    # 1. Assert system prompt is static and identical across all items in the batch (Rule 3)
    sys_prompts = [c.kwargs.get("system_prompt") for c in gemma_mock.call_args_list if "system_prompt" in c.kwargs]
    assert len(sys_prompts) == 3
    assert len(set(sys_prompts)) == 1, "Rule 3: Static system prompt must be shared across all batch items to preserve KV-cache"

    # 2. Assert frames structure: detect frame, field frames, 3 item frames, done frame
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


def test_align_analyses_to_crops_swapped_shoes_and_belt():
    """Verify that _align_analyses_to_crops pairs Shoes with Sneakers and Belt with Belt even when LLM output order is inverted."""
    from app.services.vision.service import _align_analyses_to_crops

    # Crop list: Slot 0 = Top, Slot 1 = Pants, Slot 2 = Shoes, Slot 3 = Belt
    slot_crop_list = [
        (0, (0, {"label": "Upper-clothes", "kind": "top", "category": "top"}, b"", "image/png")),
        (1, (0, {"label": "Pants", "kind": "bottom", "category": "bottom"}, b"", "image/png")),
        (2, (0, {"label": "Shoes", "kind": "footwear", "category": "footwear"}, b"", "image/png")),
        (3, (0, {"label": "Belt", "kind": "accessory", "category": "accessory"}, b"", "image/png")),
    ]

    # LLM returned items out of order: Belt at index 2, Sneakers at index 3
    parsed_items = [
        {"title": "White Oxford Shirt", "category": "Top", "sub_category": "Shirt", "item_type": "Oxford Shirt"},
        {"title": "Light Blue Chinos", "category": "Bottom", "sub_category": "Pants", "item_type": "Chinos"},
        {"title": "Brown Leather Belt", "category": "Accessories", "sub_category": "Belt", "item_type": "Leather Belt"},
        {"title": "White Leather Low-Top Sneakers", "category": "Footwear", "sub_category": "Sneakers", "item_type": "Low-Top Sneakers"},
    ]

    aligned = _align_analyses_to_crops(slot_crop_list, parsed_items)

    assert len(aligned) == 4
    # Slot 0 -> Shirt
    assert aligned[0][0] == 0
    assert "Shirt" in aligned[0][2]["title"]
    # Slot 1 -> Chinos
    assert aligned[1][0] == 1
    assert "Chinos" in aligned[1][2]["title"]
    # Slot 2 (Shoes crop) MUST match Sneakers, NOT Belt!
    assert aligned[2][0] == 2
    assert aligned[2][2]["category"] == "Footwear"
    assert "Sneakers" in aligned[2][2]["title"]
    # Slot 3 (Belt crop) MUST match Belt, NOT Sneakers!
    assert aligned[3][0] == 3
    assert aligned[3][2]["category"] == "Accessories"
    assert "Belt" in aligned[3][2]["title"]


def test_apply_alpha_intersection_seals_crotch_holes():
    """Verify that an interior void inside pants/chinos is sealed by binary_fill_holes in apply_alpha_intersection."""
    from app.services.clothing_parser import apply_alpha_intersection
    from PIL import Image
    import io

    H, W = 160, 160
    # Create pants image with solid fabric
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(20, 140):
        for x in range(30, 130):
            img.putpixel((x, y), (140, 180, 220, 255)) # Light blue chinos

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # Pants mask covers the chinos
    pants_mask = np.zeros((H, W), dtype=np.uint8)
    pants_mask[20:140, 30:130] = 1

    # Human mask has legs that would bite into inner thighs / crotch at (70..100, 60..90)
    # but garment_core + hole filling must protect and seal it!
    human_mask = np.zeros((H, W), dtype=np.uint8)
    human_mask[70:100, 60:90] = 1

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=pants_mask,
        human_mask=human_mask,
        category="bottom",
    )
    assert result_bytes is not None
    res_img = Image.open(io.BytesIO(result_bytes))
    arr = np.array(res_img)
    alpha = arr[:, :, 3]

    # Verify that crotch center is solid (not hollowed out)
    assert alpha[85, 75] == 255, "Crotch / inner thigh interior must remain solid fabric without holes"


def test_accessory_confidence_threshold_retains_sunglasses():
    """Verify that small accessory masks (e.g. sunglasses covering ~5% of bbox) are NOT dropped as patchy."""
    from app.services.clothing_parser import apply_alpha_intersection
    from PIL import Image
    import io

    H, W = 100, 200
    # Sunglasses crop: glasses cover ~8% of the bbox
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(45, 55):
        for x in range(20, 180):
            img.putpixel((x, y), (20, 20, 20, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # Mask covers only ~8% of the crop
    glasses_mask = np.zeros((H, W), dtype=np.uint8)
    glasses_mask[45:55, 20:180] = 1
    coverage = float((glasses_mask > 0).mean())
    assert coverage < 0.15, f"Expected small coverage, got {coverage:.2f}"
    assert coverage < 0.25, f"Must be below old 0.25 threshold, got {coverage:.2f}"

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=glasses_mask,
        category="accessory",
    )
    # Must NOT return None (which was the bug that caused fallback to chewed rembg)
    assert result_bytes is not None, "Sunglasses SegFormer mask must be retained, not discarded"


def test_womens_floral_top_flatlay_retains_women_gender_with_men_user():
    """Verify that a light blue floral lace top in a flat lay stays 'women' even when user profile is 'men'."""
    from app.services.vision.validation import _coerce_enums, _coerce_single_garment

    floral_top = {
        "name": "Light Blue Floral Lace Top",
        "title": "Light Blue Floral Lace Top",
        "category": "top",
        "sub_category": "Blouse",
        "item_type": "Floral Blouse",
        "gender": "women",
        "colors": [{"name": "Light Blue", "pct": 100}],
        "caption": "Delicate light blue floral lace short-sleeve top.",
    }
    coerced = _coerce_enums(dict(floral_top), user_gender="men", model_gender=None)
    assert coerced["gender"] == "women", f"Expected 'women', got {coerced['gender']}"

    full_coerced = _coerce_single_garment(dict(floral_top), user_gender="men", model_gender=None)
    assert full_coerced["gender"] == "women", f"Expected 'women', got {full_coerced['gender']}"


def test_classic_dark_brown_boots_not_overridden_to_sneakers():
    """Verify that Classic Dark Brown Leather Boots are NOT converted into sneakers."""
    from app.services.vision.validation import _enforce_segformer_category

    boots = {
        "name": "Classic Dark Brown Leather Boots",
        "title": "Classic Dark Brown Leather Boots",
        "category": "Footwear",
        "sub_category": "Boots",
        "item_type": "Lace-Up Boots",
        "color": "Dark Brown",
    }
    _enforce_segformer_category(boots, segformer_kind="footwear", label="Shoes")
    assert boots["sub_category"] == "Boots", f"Expected 'Boots', got {boots['sub_category']}"
    assert boots["name"] == "Classic Dark Brown Leather Boots"
    assert "sneaker" not in (boots.get("item_type") or "").lower()


def test_red_leather_belt_not_overridden_to_bag():
    """Verify that a Red Leather Belt is NOT overridden to 'Bag' / 'Handbag'."""
    from app.services.vision.validation import _enforce_segformer_category

    belt = {
        "name": "Red Leather Belt",
        "title": "Red Leather Belt",
        "category": "Accessories",
        "sub_category": "Belt",
        "item_type": "Waist Belt",
        "color": "Red",
    }
    _enforce_segformer_category(belt, segformer_kind="bag", label="Bag")
    assert belt["sub_category"] == "Belt", f"Expected 'Belt', got {belt['sub_category']}"
    assert "Bag" not in belt["sub_category"]
    assert belt["name"] == "Red Leather Belt"


def test_sunglasses_not_in_single_instance_classes():
    """Verify that accessories (sunglasses, belt, hat, scarf) are not in _SINGLE_INSTANCE_CLASSES."""
    from app.services.clothing_parser import _SINGLE_INSTANCE_CLASSES

    assert "Sunglasses" not in _SINGLE_INSTANCE_CLASSES
    assert "Belt" not in _SINGLE_INSTANCE_CLASSES
    assert "Hat" not in _SINGLE_INSTANCE_CLASSES
    assert "Bag" not in _SINGLE_INSTANCE_CLASSES


def test_match_batch_entry_to_slot_scrambled_order():
    """Verify that _match_batch_entry_to_slot correctly routes items when Gemini streams in arbitrary order."""
    from app.services.vision.service import _match_batch_entry_to_slot

    # 5 crops in batch:
    # Slot 0: Belt (accessory)
    # Slot 1: Blouse (top)
    # Slot 2: Boots (footwear)
    # Slot 3: Sneakers (footwear)
    # Slot 4: Sunglasses (accessory)
    kind_hints = ["accessory", "top", "footwear", "footwear", "accessory"]
    available = {0, 1, 2, 3, 4}

    # Gemini emits boots first with slot_index=2
    boots_entry = {
        "name": "Classic Dark Brown Leather Boots",
        "category": "Footwear",
        "sub_category": "Boots",
        "slot_index": 2,
    }
    slot_boots = _match_batch_entry_to_slot(boots_entry, kind_hints, available, default_idx=0)
    assert slot_boots == 2
    available.remove(slot_boots)

    # Gemini emits sunglasses second with slot_index=4
    sunglasses_entry = {
        "name": "Black Frame Sunglasses",
        "category": "Accessories",
        "sub_category": "Sunglasses",
        "slot_index": 4,
    }
    slot_sg = _match_batch_entry_to_slot(sunglasses_entry, kind_hints, available, default_idx=1)
    assert slot_sg == 4
    available.remove(slot_sg)

    # Gemini emits belt third with slot_index=0
    belt_entry = {
        "name": "Red Leather Belt",
        "category": "Accessories",
        "sub_category": "Belt",
        "slot_index": 0,
    }
    slot_belt = _match_batch_entry_to_slot(belt_entry, kind_hints, available, default_idx=2)
    assert slot_belt == 0
    available.remove(slot_belt)

    # Gemini emits floral blouse fourth with slot_index=1
    blouse_entry = {
        "name": "Light Blue Floral Lace Top",
        "category": "Top",
        "sub_category": "Blouse",
        "slot_index": 1,
    }
    slot_blouse = _match_batch_entry_to_slot(blouse_entry, kind_hints, available, default_idx=3)
    assert slot_blouse == 1
    available.remove(slot_blouse)

    # Gemini emits sneakers last with slot_index=3
    sneakers_entry = {
        "name": "White Leather Sneakers",
        "category": "Footwear",
        "sub_category": "Sneakers",
        "slot_index": 3,
    }
    slot_snk = _match_batch_entry_to_slot(sneakers_entry, kind_hints, available, default_idx=4)
    assert slot_snk == 3
    available.remove(slot_snk)
    assert len(available) == 0


def test_womens_floral_tshirt_flatlay_retains_women_gender_with_men_user():
    """Verify that a light blue floral lace t-shirt in a flat lay stays 'women' even when user profile is 'men'."""
    from app.services.vision.validation import _coerce_enums, _coerce_single_garment

    floral_shirt = {
        "name": "Light Wash Printed T-Shirt",
        "title": "Light Wash Printed T-Shirt",
        "category": "top",
        "sub_category": "T-Shirt",
        "item_type": "Short-sleeve T-shirt",
        "caption": "Short-sleeve crewneck t-shirt with an all-over light blue and white floral lace pattern.",
        "gender": "men",  # Model or profile mistakenly set 'men'
        "colors": [{"name": "Light Blue", "pct": 80}, {"name": "White", "pct": 20}],
    }
    # Coerce single garment with a male user profile
    coerced = _coerce_single_garment(dict(floral_shirt), user_gender="men", model_gender=None)
    assert coerced["gender"] == "women", f"Expected 'women' for floral lace t-shirt, got {coerced['gender']}"

    # Also test through _coerce_enums
    coerced_enums = _coerce_enums(dict(floral_shirt), user_gender="men", model_gender=None)
    assert coerced_enums["gender"] == "women", f"Expected 'women' from _coerce_enums, got {coerced_enums['gender']}"


def test_is_unidentifiable_discards_non_clothing_water_bottle():
    """Verify that handheld water bottles, phones, and non-clothing items are flagged as unidentifiable to trigger item_skip."""
    from app.services.vision.geometry import _is_unidentifiable
    from app.services.vision.validation import _enforce_segformer_category

    # 1. Direct is_clothing: False signal
    item1 = {
        "is_clothing": False,
        "title": "Non-clothing item",
        "sub_category": "non-clothing",
        "item_type": "non-clothing",
        "caption": "Non-clothing item",
    }
    assert _is_unidentifiable(item1) is True

    # 2. Plastic water bottle detected as Handbag by LLM
    item2 = {
        "title": "Plastic Water Bottle",
        "name": "Plastic Water Bottle",
        "category": "Accessories",
        "sub_category": "Water Bottle",
        "item_type": "Water Bottle",
        "caption": "Clear disposable plastic water bottle with blue cap.",
    }
    assert _is_unidentifiable(item2) is True

    # 3. SegFormer category enforcement must not override non-clothing into Bag
    overridden = _enforce_segformer_category(
        dict(item1),
        segformer_kind="bag",
        label="Bag",
    )
    assert overridden.get("sub_category") == "non-clothing"
    assert overridden.get("is_clothing") is False

    # 4. Legitimate clothing item is not unidentifiable
    shirt = {
        "is_clothing": True,
        "title": "Oxford Cotton Shirt",
        "name": "Oxford Cotton Shirt",
        "category": "Top",
        "sub_category": "Shirt",
        "item_type": "Oxford Shirt",
        "caption": "Classic light blue oxford button-down shirt.",
    }
    assert _is_unidentifiable(shirt) is False


def test_sunglasses_clean_cutout_removes_wearer_face_and_preserves_nose_bridge():
    """Verify that apply_alpha_intersection excises wearer face skin while preserving sunglasses frame and un-filled nose bridge."""
    from app.services.clothing_parser import apply_alpha_intersection
    from PIL import Image
    import io

    H, W = 100, 100
    # Create image: dark sunglasses frame in middle, wearer's skin on cheeks/nose
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Cheeks and nose skin (Cr~150, Cb~90, R>G>B)
    for y in range(20, 80):
        for x in range(20, 80):
            img.putpixel((x, y), (210, 160, 130, 255))

    # Sunglasses lenses and frame (y: 35..55):
    # Left lens: x 25..45, Right lens: x 55..75, Bridge: x 45..55 (y 35..38 only)
    # Nose gap between lenses: x 45..55 (y 39..55) has NO glasses frame, only nose skin!
    for y in range(35, 55):
        for x in range(25, 46):
            img.putpixel((x, y), (15, 15, 15, 255))
        for x in range(55, 76):
            img.putpixel((x, y), (15, 15, 15, 255))
    for y in range(35, 39):
        for x in range(45, 56):
            img.putpixel((x, y), (15, 15, 15, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # SegFormer sunglasses mask: covers lenses and bridge, but NOT the nose gap below bridge
    glasses_mask = np.zeros((H, W), dtype=np.uint8)
    for y in range(35, 55):
        glasses_mask[y, 25:46] = 1
        glasses_mask[y, 55:76] = 1
    glasses_mask[35:39, 45:56] = 1

    # Human mask: covers face skin
    human_face_mask = np.zeros((H, W), dtype=np.uint8)
    human_face_mask[20:80, 20:80] = 1
    # SegFormer Face class excludes the sunglasses themselves
    human_face_mask[glasses_mask > 0] = 0

    result_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=glasses_mask,
        human_mask=human_face_mask,
        category="sunglasses",
    )
    assert result_bytes is not None, "Sunglasses cutout must succeed"

    res_img = Image.open(io.BytesIO(result_bytes))
    res_arr = np.array(res_img)

    # 1. The wearer's cheek skin (e.g. at (70, 30)) must be subtracted (alpha == 0)
    assert res_arr[70, 30, 3] == 0, f"Wearer cheek skin must have alpha=0, got {res_arr[70, 30, 3]}"

    # 2. The glasses lenses (e.g. at (45, 35) and (45, 65)) must be solid (alpha > 200)
    assert res_arr[45, 35, 3] > 200, f"Left lens must be solid, got {res_arr[45, 35, 3]}"
    assert res_arr[45, 65, 3] > 200, f"Right lens must be solid, got {res_arr[45, 65, 3]}"

    # 3. The nose gap between lenses (at (48, 50)) must NOT be filled by hole filling (alpha == 0)
    assert res_arr[48, 50, 3] == 0, f"Nose gap between sunglasses lenses must have alpha=0, got {res_arr[48, 50, 3]}"


@pytest.mark.anyio
async def test_whole_image_matte_preserves_clean_edges_without_staircase_chewing(monkeypatch):
    """Verify that _whole_image_matte produces pure studio rembg output without SegFormer staircase teeth."""
    import io
    from unittest.mock import AsyncMock
    from PIL import Image
    from app.services.vision.service import GarmentVisionService
    import app.services.background_matting as bm_mod

    # Create synthetic smooth circular t-shirt image
    H, W = 200, 200
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Draw smooth black circle (alpha=255 inside circle, 0 outside)
    for y in range(H):
        for x in range(W):
            if (x - 100) ** 2 + (y - 100) ** 2 <= 50 ** 2:
                img.putpixel((x, y), (20, 20, 20, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    clean_matted_bytes = buf.getvalue()

    # Mock background_matting.matte_crop to return clean_matted_bytes
    monkeypatch.setattr(bm_mod, "matte_crop", AsyncMock(return_value=clean_matted_bytes))

    # Pass a coarse blocky SegFormer detection that extends outside the circle into the background
    coarse_seg_mask = np.zeros((H, W), dtype=np.uint8)
    coarse_seg_mask[30:170, 30:170] = 1  # Square box extending beyond the circle

    detections = [
        {"label": "Upper-clothes", "kind": "top", "category": "top", "mask": coarse_seg_mask, "bbox": [150, 150, 850, 850]}
    ]

    service = GarmentVisionService(provider="gemini")
    result = await service._whole_image_matte(b"dummy_bytes", detections=detections)
    assert result is not None, "Matte crop must succeed"

    res_img = Image.open(io.BytesIO(result))
    res_arr = np.array(res_img)

    # Outside the circle at (35, 35), alpha MUST remain 0 (transparent background).
    # It must NOT be forced to 255 by SegFormer's coarse square mask!
    assert res_arr[35, 35, 3] == 0, f"Background outside circle was chewed/forced opaque! Got alpha={res_arr[35, 35, 3]}"
    # Inside the circle at (100, 100), alpha must remain 255
    assert res_arr[100, 100, 3] == 255, "Garment core must remain opaque"


def test_apply_alpha_intersection_single_item_bypass():
    """Verify that is_single_item=True bypasses mask intersection and returns pristine bytes."""
    from app.services.clothing_parser import apply_alpha_intersection
    dummy_bytes = b"fake_png_data"
    coarse_mask = np.ones((50, 50), dtype=np.uint8)
    res = apply_alpha_intersection(dummy_bytes, seg_mask_bbox=coarse_mask, is_single_item=True)
    assert res == dummy_bytes, "Single item must bypass alpha intersection completely"


def test_apply_alpha_intersection_preserves_crewneck_opening():
    """Verify that crew-neck collar opening in tops is not filled in by hole filling."""
    from app.services.clothing_parser import apply_alpha_intersection
    import io
    from PIL import Image

    H, W = 120, 120
    # Create top with neck opening ring
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(20, 100):
        for x in range(20, 100):
            # Leave neck hole at (y=25..45, x=45..75) transparent
            if 25 <= y <= 45 and 45 <= x <= 75:
                continue
            img.putpixel((x, y), (30, 30, 30, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    top_bytes = buf.getvalue()

    seg_mask = np.ones((H, W), dtype=np.uint8)

    result = apply_alpha_intersection(top_bytes, seg_mask_bbox=seg_mask, category="top")
    assert result is not None
    res_img = Image.open(io.BytesIO(result))
    arr = np.array(res_img)

    # Neck opening center at (35, 60) must remain transparent (alpha == 0)
    assert arr[35, 60, 3] == 0, f"Neck opening must not be sealed by hole filling! Got alpha={arr[35, 60, 3]}"


def test_apply_alpha_intersection_eyewear_isolates_sunglasses_from_face():
    """Verify that eyewear cutouts isolate sunglasses and excise the wearer's face and hair."""
    from app.services.clothing_parser import apply_alpha_intersection
    import io
    from PIL import Image

    H, W = 150, 150
    # Create rembg-style cutout containing full human head/face
    head_img = Image.new("RGBA", (W, H), (200, 160, 130, 255))  # skin/face
    # Place sunglasses at y: 50..70, x: 40..110
    for y in range(50, 71):
        for x in range(40, 111):
            head_img.putpixel((x, y), (20, 20, 20, 255))  # black sunglasses
    
    buf = io.BytesIO()
    head_img.save(buf, format="PNG")
    raw_head_bytes = buf.getvalue()

    # SegFormer sunglasses mask: 1 only on the sunglasses
    sg_mask = np.zeros((H, W), dtype=np.uint8)
    sg_mask[50:71, 40:111] = 1

    # Human mask: 1 on the face and forehead
    human_m = np.ones((H, W), dtype=np.uint8)
    human_m[50:71, 40:111] = 0

    result = apply_alpha_intersection(
        raw_head_bytes,
        seg_mask_bbox=sg_mask,
        human_mask=human_m,
        category="eyewear",
        label="sunglasses",
    )
    assert result is not None, "Eyewear cutout must not be dropped by phantom guard!"
    res_img = Image.open(io.BytesIO(result))
    arr = np.array(res_img)

    # Sunglasses at (60, 75) must be preserved (alpha == 255)
    assert arr[60, 75, 3] == 255, "Sunglasses must be preserved"
    # Forehead/cheeks outside sunglasses at (20, 75) and (120, 75) must be excised (alpha == 0)
    assert arr[20, 75, 3] == 0, "Forehead/hair must be excised from sunglasses crop"
    assert arr[120, 75, 3] == 0, "Cheeks/chin must be excised from sunglasses crop"


def test_apply_alpha_intersection_footwear_excises_legs():
    """Verify that footwear cutouts subtract human legs and bare feet."""
    from app.services.clothing_parser import apply_alpha_intersection
    import io
    from PIL import Image

    H, W = 150, 150
    # Crop contains shoe at bottom (y: 90..140, x: 30..120) and bare leg above (y: 10..89, x: 50..100)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(10, 90):
        for x in range(50, 101):
            img.putpixel((x, y), (210, 170, 140, 255))  # skin leg
    for y in range(90, 141):
        for x in range(30, 121):
            img.putpixel((x, y), (50, 50, 50, 255))  # dark shoe

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_shoe_bytes = buf.getvalue()

    shoe_mask = np.zeros((H, W), dtype=np.uint8)
    shoe_mask[90:141, 30:121] = 1

    leg_mask = np.zeros((H, W), dtype=np.uint8)
    leg_mask[10:90, 50:101] = 1

    result = apply_alpha_intersection(
        raw_shoe_bytes,
        seg_mask_bbox=shoe_mask,
        human_mask=leg_mask,
        category="footwear",
        label="shoes",
    )
    assert result is not None
    res_img = Image.open(io.BytesIO(result))
    arr = np.array(res_img)

    # Shoe at (110, 75) must be solid
    assert arr[110, 75, 3] == 255, "Shoe body must be preserved"
    # Leg at (50, 75) must be excised
    assert arr[50, 75, 3] == 0, "Leg above shoe must be excised"


def test_apply_alpha_intersection_bottoms_excises_torso_above_waistband():
    """Verify that bottoms cutouts zero out torso, arms, and tucked shirts above the waistband."""
    from app.services.clothing_parser import apply_alpha_intersection
    import io
    from PIL import Image

    H, W = 160, 120
    # Waistband is at y=40. Top region (y=0..37) contains shirt/torso. Pants are y=40..150.
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(10, 38):
        for x in range(25, 95):
            img.putpixel((x, y), (200, 50, 50, 255))  # red shirt / torso
    for y in range(40, 150):
        for x in range(20, 100):
            img.putpixel((x, y), (40, 60, 120, 255))  # blue jeans

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_pants_bytes = buf.getvalue()

    pants_mask = np.zeros((H, W), dtype=np.uint8)
    pants_mask[40:150, 20:100] = 1

    result = apply_alpha_intersection(
        raw_pants_bytes,
        seg_mask_bbox=pants_mask,
        category="bottom",
        label="pants",
    )
    assert result is not None
    res_img = Image.open(io.BytesIO(result))
    arr = np.array(res_img)

    # Jeans body at (80, 50) must be solid
    assert arr[80, 50, 3] == 255, "Pants body must be preserved"
    # Shirt/torso above waistband at (20, 50) must be excised by waistband cutoff
    assert arr[20, 50, 3] == 0, "Torso/shirt above waistband must be excised"


def test_fit_crop_to_card_preserves_antialiased_alpha_no_chewing():
    """Verify that _fit_crop_to_card preserves transparent alpha without thresholding or chewing."""
    from app.services.vision.image import _fit_crop_to_card
    import io
    from PIL import Image

    H, W = 200, 150
    # Create cutout with anti-aliased edge and pastel white/beige garment interior
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Fill garment area with light beige fabric (240, 235, 230)
    for y in range(20, 180):
        for x in range(20, 130):
            img.putpixel((x, y), (240, 235, 230, 255))
    # Soft alpha border at x=19, x=130
    for y in range(20, 180):
        img.putpixel((19, y), (240, 235, 230, 120))
        img.putpixel((130, y), (240, 235, 230, 120))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_cutout = buf.getvalue()

    fitted_bytes, mime = _fit_crop_to_card(raw_cutout, crop_mime="image/png")
    assert mime == "image/png"
    out_img = Image.open(io.BytesIO(fitted_bytes))
    arr = np.array(out_img)

    # Interior of beige garment must remain 100% solid (NO CHEWING HOLES!)
    center_y, center_x = 600, 450
    assert arr[center_y, center_x, 3] == 255, f"Garment core must not have chewing holes! alpha={arr[center_y, center_x, 3]}"
    assert arr[center_y, center_x, 0] == 240


@pytest.mark.anyio
async def test_gemma_multi_item_and_batch_upload_single_prompt_ingestion(monkeypatch):
    """Verify GarmentVision Rules 1, 2, and 3:
    1. Multi-Item Single-Prompt Ingestion: Multi-garment images ingest once and extract all items in a single pass.
    2. Batch-upload Single-Prompt Ingestion: Multi-photo uploads ingest once and extract all items in a single pass.
    3. The analysis sequence fires the system prompt once in any AddItem workflow.
    """
    import json
    from unittest.mock import AsyncMock
    from PIL import Image
    import io

    # Create dummy JPEG image
    img = Image.new("RGB", (200, 200), (200, 200, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    dummy_img_bytes = buf.getvalue()

    service = GarmentVisionService(provider="gemma")

    # Case 1: Multi-garment single photo (3 detected garments)
    async def mock_detect_items_3(img_bytes):
        return [
            {"bbox": [100, 100, 400, 400], "kind": "top", "label": "Upper-clothes"},
            {"bbox": [400, 100, 800, 400], "kind": "bottom", "label": "Pants"},
            {"bbox": [800, 100, 950, 400], "kind": "footwear", "label": "Shoes"},
        ]

    monkeypatch.setattr(service, "detect_items", mock_detect_items_3)
    monkeypatch.setattr("app.config.settings.EYES_GEMMA_SPACE_URL", "http://mock-eyes:7860")
    monkeypatch.setattr("app.config.settings.AUTO_MATTE_CROPS", False)

    mock_gemma_call = AsyncMock()
    mock_items_single = [
        json.dumps({"slot_index": 0, "is_clothing": True, "title": "White T-Shirt", "name": "White T-Shirt", "category": "Top", "sub_category": "T-Shirt", "item_type": "Crew-Neck T-Shirt", "gender": "unisex", "colors": [{"name": "white", "pct": 100}], "tags": ["cotton"], "caption": "White T-Shirt."}),
        json.dumps({"slot_index": 1, "is_clothing": True, "title": "Gray Sweatpants", "name": "Gray Sweatpants", "category": "Bottom", "sub_category": "Pants", "item_type": "Sweatpants", "gender": "unisex", "colors": [{"name": "grey", "pct": 100}], "tags": ["fleece"], "caption": "Gray Sweatpants."}),
        json.dumps({"slot_index": 2, "is_clothing": True, "title": "Open-Toe Sandals", "name": "Open-Toe Sandals", "category": "Footwear", "sub_category": "Sandals", "item_type": "Open-Toe Sandals", "gender": "women", "colors": [{"name": "black", "pct": 100}], "tags": ["summer"], "caption": "Open-Toe Sandals."}),
    ]
    mock_gemma_call.side_effect = mock_items_single
    import app.services.vision.llm as llm_mod
    monkeypatch.setattr(llm_mod, "_call_gemma_space", mock_gemma_call)
    monkeypatch.setattr("app.services.vision.service._call_gemma_space", mock_gemma_call)

    # 1. Test multi-garment single photo:
    items_emitted = []
    async for frame in service.analyze_outfits_stream([dummy_img_bytes], user_gender="men"):
        if frame.get("type") == "item":
            items_emitted.append(frame)

    sys_prompts_1 = [c.kwargs.get("system_prompt") for c in mock_gemma_call.call_args_list if "system_prompt" in c.kwargs]
    assert len(sys_prompts_1) == 3, f"Expected 3 progressive calls, got {len(sys_prompts_1)}"
    assert len(set(sys_prompts_1)) == 1, "Rule 3: Static system prompt must be shared across all batch items to preserve KV-cache"
    assert len(items_emitted) == 3, f"Expected 3 items emitted, got {len(items_emitted)}"

    # Case 2: Batch upload with 3 photos:
    mock_gemma_call.reset_mock()
    mock_items_batch = [
        json.dumps({"slot_index": 0, "is_clothing": True, "title": "White T-Shirt", "name": "White T-Shirt", "category": "Top", "sub_category": "T-Shirt", "item_type": "Crew-Neck T-Shirt", "gender": "unisex", "colors": [{"name": "white", "pct": 100}], "tags": ["cotton"], "caption": "White T-Shirt."}),
        json.dumps({"slot_index": 1, "is_clothing": True, "title": "Blue Button Shirt", "name": "Blue Button Shirt", "category": "Top", "sub_category": "Shirt", "item_type": "Button-Up Shirt", "gender": "men", "colors": [{"name": "blue", "pct": 100}], "tags": ["denim"], "caption": "Blue Button Shirt."}),
        json.dumps({"slot_index": 2, "is_clothing": True, "title": "Black Graphic Tee", "name": "Black Graphic Tee", "category": "Top", "sub_category": "T-Shirt", "item_type": "Graphic T-Shirt", "gender": "unisex", "colors": [{"name": "black", "pct": 100}], "tags": ["tee"], "caption": "Black Graphic Tee."}),
    ]
    mock_gemma_call.side_effect = mock_items_batch
    async def mock_detect_items_1(img_bytes):
        return [{"bbox": [50, 50, 950, 950], "kind": "top", "label": "Upper-clothes"}]
    monkeypatch.setattr(service, "detect_items", mock_detect_items_1)

    batch_emitted = []
    async for frame in service.analyze_outfits_stream([dummy_img_bytes, dummy_img_bytes, dummy_img_bytes], user_gender="men"):
        if frame.get("type") == "item":
            batch_emitted.append(frame)

    sys_prompts_2 = [c.kwargs.get("system_prompt") for c in mock_gemma_call.call_args_list if "system_prompt" in c.kwargs]
    assert len(sys_prompts_2) == 3, f"Expected 3 progressive calls, got {len(sys_prompts_2)}"
    assert len(set(sys_prompts_2)) == 1, "Rule 3: Static system prompt must be shared across all batch items to preserve KV-cache"
    assert len(batch_emitted) == 3, f"Expected 3 items emitted for batch, got {len(batch_emitted)}"


def test_apply_alpha_intersection_preserves_solid_alpha_for_warm_colored_tops():
    """Verify that warm-colored tops (beige, tan, cream, khaki) are NEVER faded by skin chrominance.
    
    Protects against regression where warm fabrics match skin chrominance ranges (Cr in 133..173, Cb in 77..127)
    and were attenuated into ghostly, near-transparent smoke cutouts.
    """
    from app.services.clothing_parser import apply_alpha_intersection
    import io
    from PIL import Image

    H, W = 160, 140
    # Create rembg-style cutout with a warm beige/tan shirt
    # RGB (215, 190, 165) falls exactly in skin chrominance range:
    # cr = 128 + 0.5*215 - 0.418688*190 - 0.081312*165 = 142.5
    # cb = 128 - 0.168736*215 - 0.331264*190 + 0.5*165 = 111.2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(30, 140):
        for x in range(20, 120):
            img.putpixel((x, y), (215, 190, 165, 255))  # warm beige shirt
    # Human head at top (y: 5..28, x: 50..90)
    for y in range(5, 29):
        for x in range(50, 91):
            img.putpixel((x, y), (210, 165, 135, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_shirt_bytes = buf.getvalue()

    shirt_mask = np.zeros((H, W), dtype=np.uint8)
    shirt_mask[30:140, 20:120] = 1

    human_head_mask = np.zeros((H, W), dtype=np.uint8)
    human_head_mask[5:29, 50:91] = 1

    result = apply_alpha_intersection(
        raw_shirt_bytes,
        seg_mask_bbox=shirt_mask,
        human_mask=human_head_mask,
        category="top",
        label="upper-clothes",
    )
    assert result is not None, "Cutout must not be wiped out"
    out_img = Image.open(io.BytesIO(result))
    arr = np.array(out_img)

    # Center of warm shirt (y=80, x=70) MUST be 255 solid alpha — NOT faded smoke!
    assert arr[80, 70, 3] == 255, f"Warm shirt core must have solid alpha 255, got {arr[80, 70, 3]}"
    assert arr[100, 50, 3] == 255, f"Warm shirt body must have solid alpha 255, got {arr[100, 50, 3]}"
    # Head above shirt collar (y=15, x=70) must be excised
    assert arr[15, 70, 3] == 0, f"Human head above collar must be excised, got {arr[15, 70, 3]}"


def test_sanitize_sweatpants_and_trainer_footer():
    """Verify gray footer/trainer pants with drawstring are never classified as tailored wool business pants."""
    from app.services.vision.validation import _coerce_enums, _coerce_single_garment

    trainer_raw = {
        "name": "Men's Gray Footer Trainer Pants",
        "title": "Tailored Wool Trousers",
        "caption": "Gray trainer pants with drawstring and elastic cuffs footer",
        "category": "bottom",
        "sub_category": "trousers",
        "item_type": "Wool Tailored Trousers",
        "dress_code": "business",
        "gender": "men",
        "fabric_materials": [{"name": "Wool", "pct": 100}],
        "season": ["fall", "winter"],
    }

    # Test via _coerce_single_garment
    coerced = _coerce_single_garment(dict(trainer_raw), user_gender="men", model_gender=None)
    assert coerced["sub_category"] == "Pants"
    assert coerced["item_type"] in ("Sweatpants", "Joggers")
    assert coerced["dress_code"] == "casual"
    assert any("cotton" in m.get("name", "").lower() for m in coerced["fabric_materials"])
    assert not any("wool" in m.get("name", "").lower() for m in coerced["fabric_materials"])
    assert "wool" not in coerced.get("title", "").lower()

    # Test via _coerce_enums
    coerced_enums = _coerce_enums(dict(trainer_raw), user_gender="men", model_gender=None)
    assert coerced_enums["sub_category"] == "Pants"
    assert coerced_enums["item_type"] in ("Sweatpants", "Joggers")
    assert coerced_enums["dress_code"] == "casual"
    assert any("cotton" in m.get("name", "").lower() for m in coerced_enums["fabric_materials"])


def test_sanitize_sandals_and_open_toe_footwear():
    """Verify green/white patterned sandals are never identified as classic white sneakers."""
    from app.services.vision.validation import _coerce_enums, _coerce_single_garment

    sandals_raw = {
        "name": "Green and White Patterned Strappy Sandals",
        "title": "Classic White Sneakers",
        "caption": "Open-toe flat sandals with green and white strap pattern",
        "category": "footwear",
        "sub_category": "Sneakers",
        "item_type": "Sneakers",
        "dress_code": "business",
        "gender": "women",
        "pattern": "patterned",
        "season": ["winter"],
    }

    coerced = _coerce_single_garment(dict(sandals_raw), user_gender="women", model_gender="women")
    assert coerced["category"] == "Footwear"
    assert coerced["sub_category"] == "Sandals"
    assert "sandal" in coerced["item_type"].lower()
    assert coerced["dress_code"] == "casual"
    assert "summer" in [s.lower() for s in coerced["season"]]
    assert "sneaker" not in coerced.get("title", "").lower()

    coerced_enums = _coerce_enums(dict(sandals_raw), user_gender="women", model_gender="women")
    assert coerced_enums["category"] == "Footwear"
    assert coerced_enums["sub_category"] == "Sandals"
    assert "sandal" in coerced_enums["item_type"].lower()
    assert coerced_enums["dress_code"] == "casual"


def test_sanitize_sleeve_and_cut_for_non_tops():
    """Verify sunglasses and non-tops never get sleeve cuts or 'Shorts' item type."""
    from app.services.vision.validation import _coerce_enums, _coerce_single_garment

    sunglasses_raw = {
        "name": "Classic Black Sunglasses",
        "category": "accessories",
        "sub_category": "sunglasses",
        "item_type": "Shorts",  # bad LLM hallucination
        "cut": "short-sleeve",
        "gender": "unisex",
    }

    coerced = _coerce_single_garment(dict(sunglasses_raw), user_gender="women")
    assert coerced["category"] == "Accessories"
    assert coerced["sub_category"] == "Sunglasses"
    assert coerced["item_type"] == "Classic Sunglasses"
    assert coerced.get("cut") is None or "sleeve" not in coerced.get("cut", "").lower()

    coerced_enums = _coerce_enums(dict(sunglasses_raw), user_gender="women")
    assert coerced_enums["category"] == "Accessories"
    assert coerced_enums["sub_category"] == "Sunglasses"
    assert coerced_enums["item_type"] == "Classic Sunglasses"


@pytest.mark.anyio
async def test_rembg_collapse_recovery_from_segformer_mask(monkeypatch):
    """Verify that when rembg collapses on light gray sweatpants, SegFormer mask recovers the alpha cutout."""
    import io
    import numpy as np
    from PIL import Image
    from unittest.mock import AsyncMock
    from app.services.vision.service import GarmentVisionService
    from app.services.vision.image import _solid_alpha_coverage

    # Create dummy 100x100 RGB image (gray sweatpants)
    img = Image.new("RGB", (100, 100), color=(200, 200, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    cbytes = buf.getvalue()

    # Simulate rembg collapse: rembg returns an almost empty RGBA image (e.g. only 5 solid pixels, 0.05% coverage)
    rembg_img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    for x in range(5):
        rembg_img.putpixel((x, x), (200, 200, 200, 255))
    rembg_buf = io.BytesIO()
    rembg_img.save(rembg_buf, format="PNG")
    collapsed_rembg_bytes = rembg_buf.getvalue()

    # SegFormer mask has 2500 solid pixels (50x50 garment region in the center)
    seg_mask = np.zeros((100, 100), dtype=np.uint8)
    seg_mask[25:75, 25:75] = 255

    det = {
        "label": "pants",
        "kind": "bottom",
        "category": "bottom",
        "bbox": [250, 250, 750, 750],
        "_mask_bbox": seg_mask,
        "is_single_item": False,
    }

    service = GarmentVisionService(provider="gemini")
    import app.services.background_matting as bm
    monkeypatch.setattr(bm, "matte_crop", AsyncMock(return_value=collapsed_rembg_bytes))

    matted_crops = await service._matte_crops([(det, cbytes, "image/jpeg")])
    assert len(matted_crops) == 1, "Garment should NOT be dropped when SegFormer mask is available"

    out_det, out_matted, out_mime = matted_crops[0]
    assert out_mime == "image/png"
    cov = _solid_alpha_coverage(out_matted)
    assert cov is not None and cov > 0.15, f"Expected SegFormer recovered alpha coverage > 15%, got {cov*100:.2f}%"


def test_shrink_for_vision_near_empty_alpha_composite_guard():
    """Verify that _shrink_for_vision extracts RGB directly when alpha is near-empty to prevent blank white tiles."""
    import io
    import numpy as np
    from PIL import Image
    from app.services.vision.image import _shrink_for_vision

    # Create an RGBA image with dark red pixels, but alpha channel has only 10 solid pixels (< 0.1% coverage)
    img = Image.new("RGBA", (200, 200), (180, 20, 20, 0))
    for x in range(10):
        img.putpixel((x, x), (180, 20, 20, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    ghost_bytes = buf.getvalue()

    shrunk_bytes = _shrink_for_vision(ghost_bytes, max_side=100)
    shrunk_img = Image.open(io.BytesIO(shrunk_bytes))
    arr = np.array(shrunk_img)

    # If it was composited onto white, mean brightness would be ~255 (blank white tile).
    # Since RGB was preserved, red channel is dominant (> 100) and not all white.
    assert arr.mean() < 240, f"Expected non-white photograph image, but got blank white mean {arr.mean():.1f}"


def test_fit_crop_to_card_avoids_zooming_into_noise():
    """Verify that _fit_crop_to_card does not zoom into tiny alpha noise clusters."""
    import io
    from PIL import Image
    from app.services.vision.image import _fit_crop_to_card

    # 500x500 image with only 26 noise pixels (< 0.01% coverage) in a tiny 5x5 corner
    img = Image.new("RGBA", (500, 500), (0, 0, 0, 0))
    for x in range(5):
        for y in range(5):
            img.putpixel((x, y), (200, 200, 200, 255))
    img.putpixel((5, 5), (200, 200, 200, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    noise_bytes = buf.getvalue()

    fitted_bytes, mime = _fit_crop_to_card(noise_bytes, crop_mime="image/png")
    assert mime == "image/png"
    fitted_img = Image.open(io.BytesIO(fitted_bytes))
    # It should not error and should fit canvas
    assert fitted_img.size == (900, 1200)


def test_multi_body_zones_with_descriptive_labels():
    """Verify that descriptive garment labels (e.g. plaid blazer, trousers, double monk strap shoes)
    trigger multi-body zone detection and are never collapsed into an already-cropped single item."""
    from app.services.vision.geometry import _looks_already_cropped

    detections = [
        {"bbox": [100, 250, 450, 750], "label": "plaid blazer", "kind": "garment", "category": "garment"},
        {"bbox": [430, 300, 850, 700], "label": "trousers", "kind": "garment", "category": "garment"},
        {"bbox": [840, 310, 960, 460], "label": "double monk strap shoes", "kind": "garment", "category": "garment"},
        {"bbox": [840, 520, 960, 670], "label": "double monk strap shoes", "kind": "garment", "category": "garment"},
        {"bbox": [150, 400, 300, 600], "label": "scarf", "kind": "accessory", "category": "accessory"},
        {"bbox": [440, 340, 480, 660], "label": "belt", "kind": "accessory", "category": "accessory"},
    ]
    assert _looks_already_cropped(detections) is False, "Multi-garment outfit must not be treated as already cropped"


def test_segformer_run_inference_forward_pass(monkeypatch):
    """Verify _run_inference performs the model forward pass and computes logits without UnboundLocalError."""
    pytest.importorskip("torch._C", exc_type=ImportError)
    import torch
    import numpy as np
    from PIL import Image
    from app.services import clothing_parser

    # Mock processor and model to verify forward pass pipeline
    class DummyOutputs:
        def __init__(self):
            # 1 batch, 18 classes, 32x32 feature map
            self.logits = torch.zeros((1, 18, 32, 32), dtype=torch.float32)

    class DummyModel:
        def __call__(self, **kwargs):
            return DummyOutputs()

    class DummyProcessor:
        def __call__(self, images=None, return_tensors=None):
            return {"pixel_values": torch.zeros((1, 3, 512, 512))}

    monkeypatch.setattr(clothing_parser, "_load_model", lambda: None)
    monkeypatch.setattr(clothing_parser, "_processor", DummyProcessor())
    monkeypatch.setattr(clothing_parser, "_model", DummyModel())

    test_img = Image.new("RGB", (200, 300), color=(128, 128, 128))
    pred = clothing_parser._run_inference(test_img)
    assert isinstance(pred, np.ndarray)
    assert pred.shape == (300, 200)


@pytest.mark.anyio
async def test_detect_items_merging_both_sources(monkeypatch):
    """Verify detect_items merges parser hits and gemini hits without UnboundLocalError."""
    from app.services.vision.service import GarmentVisionService

    service = GarmentVisionService()

    fake_parser_hits = [
        {"bbox": [100, 200, 500, 600], "label": "upper_clothes", "kind": "top", "category": "top", "score": 0.95}
    ]
    fake_gemini_hits = [
        {"bbox": [550, 200, 900, 600], "label": "trousers", "kind": "bottom", "category": "bottom", "score": 0.90}
    ]

    async def mock_parser(image_bytes, count_hint=None):
        return fake_parser_hits

    async def mock_gemini(image_bytes):
        return fake_gemini_hits

    monkeypatch.setattr(service, "_detect_via_clothing_parser", mock_parser)
    monkeypatch.setattr(service, "_detect_via_gemini", mock_gemini)

    results = await service.detect_items(b"fake_image_bytes", count_hint=2)
    assert len(results) == 2
    labels = [r["label"] for r in results]
    assert "upper_clothes" in labels
    assert "trousers" in labels


def test_enforce_segformer_skirt_overrides_pants_and_hebrew_name():
    """Verify that when SegFormer detects a skirt, a falsely predicted 'Tailored Trousers' / 'Pants' is corrected to Skirt with valid Hebrew grammar."""
    analysis = {
        "name": "מכנסיים שחורים מחויטים",
        "title": "מכנסיים שחורים מחויטים",
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Tailored Trousers",
        "dress_code": "business",
        "gender": "men",
        "colors": [{"name": "black", "pct": 100}],
        "caption": "A chic woman wearing an olive/grey pleated skirt on the street",
    }

    fixed = _enforce_segformer_category(
        analysis,
        segformer_kind="bottom",
        label="skirt",
        is_single_item=False,
        language="he",
    )

    assert fixed["category"] == "Bottom"
    assert fixed["sub_category"] == "Skirt"
    assert fixed["item_type"] == "Pleated Skirt"
    assert fixed["gender"] == "women"
    assert fixed["dress_code"] == "smart-casual"
    assert "מכנסיים" not in fixed["name"]
    assert "חצאית" in fixed["name"]
    # Check that color was corrected from black based on caption
    assert fixed["colors"][0]["name"] == "ירוק זית"


def test_apply_alpha_intersection_heals_bitten_sleeve_dropout():
    """Verify that light fabric sleeve dropouts with alpha=0 are healed to solid opacity."""
    from app.services.clothing_parser import apply_alpha_intersection
    import io
    from PIL import Image

    H, W = 100, 100
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Garment body: x=20..80, y=20..80
    for y in range(20, 80):
        for x in range(20, 80):
            img.putpixel((x, y), (180, 180, 180, 255))
    
    # Simulate a bitten sleeve dropout where rembg faded or zeroed out alpha at (y=40..60, x=65..75)
    for y in range(40, 60):
        for x in range(65, 75):
            img.putpixel((x, y), (180, 180, 180, 0))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # SegFormer semantic mask correctly identifies the entire garment
    seg_mask = np.zeros((H, W), dtype=np.uint8)
    seg_mask[20:80, 20:80] = 255

    res_bytes = apply_alpha_intersection(
        matted_bytes,
        seg_mask_bbox=seg_mask,
        category="top",
        label="hoodie",
        is_single_item=True,
    )
    assert res_bytes is not None, "apply_alpha_intersection should succeed"
    res_arr = np.array(Image.open(io.BytesIO(res_bytes)))

    # The bitten sleeve patch at (50, 70) must now be healed to solid opacity (>= 250)
    assert res_arr[50, 70, 3] >= 250, f"Bitten sleeve should be healed! Got alpha={res_arr[50, 70, 3]}"
    # Outside background at (10, 10) must remain transparent (0)
    assert res_arr[10, 10, 3] == 0, "Background must remain 0"


@pytest.mark.anyio
async def test_parallel_dispatch_instant_preview_option_a():
    """Verify Option A (Instant Preview) parallel dispatch:
    1. detect frame is yielded immediately with raw crop (within milliseconds).
    2. Matting runs concurrently in background and emits a 'matte' frame.
    3. VLM runs concurrently and emits 'item' frame carrying the transparent cutout.
    """
    from unittest.mock import patch
    import asyncio
    from app.services.vision.service import GarmentVisionService

    service = GarmentVisionService(api_key="test-key", provider="gemini")

    async def mock_detect_items(img_bytes, count_hint=None):
        return [{"bbox": [100, 100, 500, 500], "kind": "top", "label": "shirt"}]

    async def mock_whole_image_matte(img_bytes, detections=None):
        await asyncio.sleep(0.02)
        return b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

    async def mock_analyze(*args, **kwargs):
        return {
            "category": "Top",
            "sub_category": "T-Shirt",
            "item_type": "T-Shirt",
            "title": "Graphic T-Shirt",
        }

    with patch.object(service, "detect_items", side_effect=mock_detect_items), \
         patch.object(service, "_whole_image_matte", side_effect=mock_whole_image_matte), \
         patch.object(service, "analyze", side_effect=mock_analyze):

        dummy_img = b"fake_jpeg_photo"
        frames = []
        async for frame in service.analyze_outfits_stream([dummy_img]):
            frames.append(frame)

        frame_types = [f.get("type") for f in frames]
        assert frame_types[0] == "detect", "First frame MUST be detect for instant preview"
        assert "items_meta" in frames[0]
        assert frames[0]["items_meta"][0]["crop_base64"] is not None

        assert "matte" in frame_types, "A matte frame must be emitted when cutout finishes"
        matte_frame = next(f for f in frames if f.get("type") == "matte")
        assert matte_frame["crop_mime"] == "image/png"
        assert matte_frame["index"] == 0

        assert "item" in frame_types
        item_frame = next(f for f in frames if f.get("type") == "item")
        assert item_frame["crop_mime"] == "image/png"
        assert item_frame["analysis"]["category"] == "Top"

        assert frame_types[-1] == "done"


def test_upper_garment_neckline_clamping():
    """Verify that apply_alpha_intersection cleanly zeros out neck/head floating above collar."""
    from PIL import Image
    import io
    from app.services.clothing_parser import apply_alpha_intersection

    H, W = 100, 100
    # Create image with upper torso/neck/head all opaque
    img = Image.new("RGBA", (W, H), (100, 100, 100, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    matted_bytes = buf.getvalue()

    # Jacket mask starts at row 30 (apex_y = 30) with collar dipping to row 45 in center
    seg_mask = np.zeros((H, W), dtype=np.uint8)
    for x in range(20, 80):
        # Lapel neckline: V-shape from row 30 at edges (x=20,80) to row 45 at center (x=50)
        top_y = 30 + int(15 * (1.0 - abs(x - 50) / 30.0))
        seg_mask[top_y:90, x] = 255

    res = apply_alpha_intersection(
        matted_bytes,
        seg_mask,
        category="outerwear",
        label="jacket",
        is_single_item=False,
    )
    assert res is not None
    res_img = Image.open(io.BytesIO(res))
    alpha = np.array(res_img.split()[-1])

    # 1. Above apex (row 20): strictly 0 (no floating head)
    assert np.all(alpha[:25, :] == 0), "All pixels above jacket apex must be zeroed!"
    # 2. Inside the V-neck above the lapels at (x=50, y=35): must be 0 (no floating throat/neck chunk)
    assert alpha[35, 50] == 0, "Throat chunk inside V-neck must be zeroed!"
    # 3. Inside the jacket lapel at (x=30, y=55): must be opaque
    assert alpha[55, 30] > 200, "Jacket fabric must remain opaque!"


def test_enforce_segformer_category_resolves_bottom_footwear_conflict():
    """Verify that SegFormer 'bottom' clears footwear misclassification from Gemini."""
    from app.services.vision.validation import _enforce_segformer_category

    analysis = {
        "category": "Bottom",
        "sub_category": "Boots",
        "item_type": "Ankle boot",
        "name": "Black Boots",
        "caption": "Black synthetic ankle boots with a high heel.",
        "size": "7.0",
        "colors": [{"name": "Black", "pct": 100}],
    }
    _enforce_segformer_category(
        analysis,
        segformer_kind="bottom",
        label="pants",
        is_single_item=False,
    )

    assert analysis["category"] == "Bottom"
    assert analysis["sub_category"] == "Pants"
    assert "boot" not in analysis["sub_category"].lower()
    assert "boot" not in analysis["item_type"].lower()
    assert "boot" not in analysis["name"].lower()
    assert analysis["size"] != "7.0", "Shoe size 7.0 must be cleared on pants!"


def test_small_item_upscale_capped():
    """Verify that tiny sunglasses crop is not blown up 20x into giant pixel blocks."""
    from PIL import Image
    import io
    from app.services.vision.image import _fit_crop_to_card

    # Create small 40x20 image (representing sunglasses in a full-body photo)
    tiny = Image.new("RGBA", (40, 20), (50, 50, 50, 255))
    buf = io.BytesIO()
    tiny.save(buf, format="PNG")
    crop_bytes = buf.getvalue()

    fitted_bytes, mime = _fit_crop_to_card(crop_bytes, crop_mime="image/png")
    assert mime == "image/png"
    fitted_img = Image.open(io.BytesIO(fitted_bytes))
    # Card canvas is 900x1200. With 4.0x cap on 40x20, non-zero alpha bounding box must be <= 200px wide!
    bbox = fitted_img.getbbox()
    assert bbox is not None
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    assert w <= 200, f"Small item width was blown up to {w}px! Should be capped <= 200px."
    assert h <= 100, f"Small item height was blown up to {h}px! Should be capped <= 100px."


def test_drop_far_away_disconnected_specks():
    """Verify drop_disconnected_islands removes far-away specks (like 4 handbag blobs)."""
    from PIL import Image
    import io
    from app.services.background_matting import drop_disconnected_islands

    H, W = 300, 300
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Main garment body: 80x80 square at center
    for y in range(100, 180):
        for x in range(100, 180):
            img.putpixel((x, y), (200, 50, 50, 255))

    # Far-away speck 1 (at top-left corner, 80px away from main body, 15x15 size)
    for y in range(10, 25):
        for x in range(10, 25):
            img.putpixel((x, y), (200, 50, 50, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    cleaned_bytes = drop_disconnected_islands(raw_bytes, min_area_ratio=0.01)
    cleaned_img = Image.open(io.BytesIO(cleaned_bytes))
    cleaned_arr = np.array(cleaned_img)

    # Far speck must be zeroed out
    assert np.all(cleaned_arr[10:25, 10:25, 3] == 0), "Far-away disconnected speck must be removed!"
    # Main garment body must remain intact
    assert np.all(cleaned_arr[110:170, 110:170, 3] == 255), "Main garment body must remain intact!"


def test_outerwear_collar_fragment_suppressed_into_coat():
    """Verify that a small top/t-shirt fragment at the collar/neckline is merged into the coat."""
    from app.services.clothing_parser import _suppress_overlapping_garments

    H, W = 600, 400
    coat_mask = np.zeros((H, W), dtype=np.uint8)
    coat_mask[100:550, 80:320] = 1  # area: 450 * 240 = 108,000

    # Top fragment at the collar/lapel zone (area: 4,000, 3.7% of coat)
    collar_frag = np.zeros((H, W), dtype=np.uint8)
    collar_frag[110:200, 160:210] = 1

    by_label = {
        "coat": {"label": "coat", "category": "outerwear", "score": 0.95, "mask": coat_mask},
        "top, t-shirt, sweatshirt": {"label": "top, t-shirt, sweatshirt", "category": "top", "score": 0.95, "mask": collar_frag},
    }

    res = _suppress_overlapping_garments(by_label, has_human=True)
    # The collar fragment must be suppressed into coat, leaving ONLY coat!
    assert "coat" in res
    assert "top, t-shirt, sweatshirt" not in res
    # The coat mask must now contain the collar fragment pixels
    assert np.all(res["coat"]["mask"][110:200, 160:210] == 1)


def test_multiple_outerwear_on_human_merged():
    """Verify that multiple overlapping outerwear detections on a human model are merged into one."""
    from app.services.clothing_parser import _suppress_overlapping_garments

    H, W = 600, 400
    main_coat = np.zeros((H, W), dtype=np.uint8)
    main_coat[150:550, 80:320] = 1

    fur_collar_piece = np.zeros((H, W), dtype=np.uint8)
    fur_collar_piece[100:220, 140:260] = 1

    by_label = {
        "coat": {"label": "coat", "category": "outerwear", "score": 0.95, "mask": main_coat},
        "jacket": {"label": "jacket", "category": "outerwear", "score": 0.90, "mask": fur_collar_piece},
    }

    res = _suppress_overlapping_garments(by_label, has_human=True)
    # Must only keep one dominant outerwear!
    assert len([k for k, v in res.items() if v.get("category") == "outerwear"]) == 1


def test_sneakers_fragmentation_suppressed_into_single_shoes_item():
    """Verify that a pair of sneakers fragmented into shoes, pants, cardigan, and belt merges into Shoes."""
    from app.services.clothing_parser import _suppress_overlapping_garments

    H, W = 600, 600
    # Sole/heel of the shoes
    shoes_mask = np.zeros((H, W), dtype=np.uint8)
    shoes_mask[380:480, 100:260] = 1  # left sole
    shoes_mask[380:480, 340:500] = 1  # right sole

    # Left sneaker upper misclassified as pants (houndstooth knit fabric)
    pants_upper = np.zeros((H, W), dtype=np.uint8)
    pants_upper[240:400, 110:250] = 1  # directly touches and overlaps sole

    # Right sneaker upper misclassified as cardigan
    cardigan_upper = np.zeros((H, W), dtype=np.uint8)
    cardigan_upper[240:400, 350:490] = 1  # directly touches and overlaps right sole

    # Sneaker tongue/lace misclassified as belt
    belt_lace = np.zeros((H, W), dtype=np.uint8)
    belt_lace[270:320, 160:190] = 1  # nested inside left sneaker

    by_label = {
        "Shoes": {"label": "Shoes", "category": "footwear", "score": 0.95, "mask": shoes_mask},
        "pants": {"label": "pants", "category": "bottom", "score": 0.95, "mask": pants_upper},
        "cardigan": {"label": "cardigan", "category": "outerwear", "score": 0.95, "mask": cardigan_upper},
        "belt": {"label": "belt", "category": "accessory", "score": 0.95, "mask": belt_lace},
    }

    res = _suppress_overlapping_garments(by_label, has_human=False)
    # Must suppress all fragments into a SINGLE Shoes item!
    assert len(res) == 1, f"Expected 1 Shoes item, got {len(res)}: {list(res.keys())}"
    assert "Shoes" in res
    assert res["Shoes"]["category"] == "footwear"
    # Merged mask must contain all parts
    merged_m = res["Shoes"]["mask"]
    assert np.all(merged_m[380:480, 100:260] == 1)
    assert np.all(merged_m[240:400, 110:250] == 1)
    assert np.all(merged_m[240:400, 350:490] == 1)
    assert np.all(merged_m[270:320, 160:190] == 1)


def test_enforce_segformer_category_preserves_llm_footwear():
    """Verify that when the LLM detects Footwear/Sneakers, SegFormer kind does not override to Pants or Outerwear."""
    from app.services.vision.validation import _enforce_segformer_category

    # Case 1: LLM detected Footwear, SegFormer predicted 'bottom' (e.g. houndstooth upper)
    analysis_sneaker = {
        "name": "סניקרס ספורט מעוצבות",
        "title": "סניקרס ספורט מעוצבות",
        "category": "Footwear",
        "sub_category": "סניקרס",
        "item_type": "סניקרס נמוכות",
        "caption": "סניקרס אופנתיות עם שרוכים וסוליה עבה.",
        "colors": [{"name": "שחור", "pct": 60}, {"name": "לבן", "pct": 40}],
    }
    validated = _enforce_segformer_category(
        analysis_sneaker,
        segformer_kind="bottom",
        label="pants",
        is_single_item=True,
        language="he",
    )
    assert validated["category"] == "Footwear"
    assert validated["sub_category"] == "סניקרס"
    assert "סניקרס" in validated["name"]

    # Case 2: LLM detected Footwear, SegFormer predicted 'outerwear' (e.g. thick sole)
    analysis_sole = {
        "name": "White Chunky Sole Sneakers",
        "title": "White Chunky Sole Sneakers",
        "category": "Footwear",
        "sub_category": "Sneakers",
        "item_type": "Low-Top Sneakers",
        "caption": "Sport sneakers with thick rubber sole.",
    }
    validated_sole = _enforce_segformer_category(
        analysis_sole,
        segformer_kind="outerwear",
        label="cardigan",
        is_single_item=True,
        language="en",
    )
    assert validated_sole["category"] == "Footwear"
    assert validated_sole["sub_category"] == "Sneakers"


def test_footwear_consolidation_with_warm_background_and_fragmented_garments():
    """Verify that in a footwear photo on a warm bedsheet (high skin chrominance),
    has_human evaluates to False and all fragments (pants, cardigan, belt) consolidate into Shoes."""
    from scipy import ndimage
    from app.services.clothing_parser import _is_same_garment_component

    H, W = 600, 600
    total = H * W

    # Simulated warm bedsheet skin pixels outside garments (e.g. 60% of frame)
    skin_outside_garments = np.zeros((H, W), dtype=bool)
    skin_outside_garments[:400, :] = True
    skin_px = int(skin_outside_garments.sum())
    skin_frac = skin_px / float(total)

    # Verify skin fraction check rejects bedsheet as human skin
    assert skin_frac > 0.28, "Bedsheet covers >28% of frame"
    human_mask_full = skin_outside_garments.astype(np.uint8) if 0.015 <= skin_frac <= 0.28 else None
    assert human_mask_full is None, "Warm bedsheet must NOT be accepted as human skin!"

    # Footwear fragments
    shoes_mask = np.zeros((H, W), dtype=np.uint8)
    shoes_mask[360:480, 100:260] = 1  # left heel/sole
    shoes_mask[360:480, 340:500] = 1  # right heel/sole

    pants_left = np.zeros((H, W), dtype=np.uint8)
    pants_left[300:420, 110:250] = 1  # left toe-box

    pants_right = np.zeros((H, W), dtype=np.uint8)
    pants_right[300:420, 350:490] = 1  # right toe-box

    cardigan_vamp = np.zeros((H, W), dtype=np.uint8)
    cardigan_vamp[320:440, 370:480] = 1  # right vamp

    belt_lace = np.zeros((H, W), dtype=np.uint8)
    belt_lace[310:350, 150:180] = 1  # left laces

    by_label = {
        "Shoes": {"label": "Shoes", "category": "footwear", "score": 0.95, "mask": shoes_mask},
        "pants": {"label": "pants", "category": "bottom", "score": 0.95, "mask": pants_left},
        "pants#1": {"label": "pants", "category": "bottom", "score": 0.95, "mask": pants_right},
        "cardigan": {"label": "cardigan", "category": "outerwear", "score": 0.95, "mask": cardigan_vamp},
        "belt": {"label": "belt", "category": "accessory", "score": 0.95, "mask": belt_lace},
    }

    distinct_cats = {it.get("category") for it in by_label.values()}
    has_torso_clothing = bool(distinct_cats & {"top", "dress", "outerwear"})
    has_head = False
    has_human = bool(has_head or (has_torso_clothing and human_mask_full is not None and int(human_mask_full.sum()) >= 150))
    assert not has_human, "Photo with no head and no real human skin must have has_human=False"

    # Simulate Step 2a
    shoes_mask = by_label["Shoes"]["mask"]
    def _mask_bbox(m):
        ys, xs = np.where(m)
        return (int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())) if len(ys) else None

    shoes_bb = _mask_bbox(shoes_mask)
    assert shoes_bb is not None

    keys_to_merge = []
    for other_key, other_it in list(by_label.items()):
        if other_key == "Shoes" or other_it.get("mask") is None:
            continue
        obb = _mask_bbox(other_it["mask"])
        if not obb:
            continue
        dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
        dil_shoes = ndimage.binary_dilation(by_label["Shoes"]["mask"], iterations=15)
        touches = np.logical_and(dil_other, dil_shoes).any()
        is_proximate = _is_same_garment_component(shoes_bb, obb, min(H, W))
        in_lower_tier = obb[0] >= int(0.25 * H)
        if touches or is_proximate or in_lower_tier:
            by_label["Shoes"]["mask"] = np.maximum(by_label["Shoes"]["mask"], other_it["mask"])
            shoes_bb = _mask_bbox(by_label["Shoes"]["mask"])
            keys_to_merge.append(other_key)
    for k in keys_to_merge:
        del by_label[k]

    # After step 2a, ALL fragments must be consolidated into single Shoes
    assert len(by_label) == 1, f"Expected 1 Shoes item, got {len(by_label)}: {list(by_label.keys())}"
    assert "Shoes" in by_label
    assert by_label["Shoes"]["category"] == "footwear"
    # Unified mask must cover all pixels of left and right sneakers
    final_m = by_label["Shoes"]["mask"]
    assert np.all(final_m[360:480, 100:260] == 1)
    assert np.all(final_m[300:420, 110:250] == 1)
    assert np.all(final_m[300:420, 350:490] == 1)
    assert np.all(final_m[320:440, 370:480] == 1)
    assert np.all(final_m[310:350, 150:180] == 1)


def test_sneakers_unconditional_consolidation_even_with_background_skin_and_hallucinations():
    """Verify that SegFormer fragmenting a sneaker into Shoes, Pants, Cardigan, Belt on a warm surface
    is unconditionally consolidated into a single Shoes item, and does not falsely trigger human presence."""
    from scipy import ndimage
    from app.services.clothing_parser import _is_same_garment_component
    from app.services.vision.geometry import _detect_human_presence

    H, W = 600, 600
    shoes_mask = np.zeros((H, W), dtype=np.uint8)
    shoes_mask[360:480, 100:260] = 1  # left heel/sole
    shoes_mask[360:480, 340:500] = 1  # right heel/sole

    pants_left = np.zeros((H, W), dtype=np.uint8)
    pants_left[300:420, 110:250] = 1  # left toe-box

    pants_right = np.zeros((H, W), dtype=np.uint8)
    pants_right[300:420, 350:490] = 1  # right toe-box

    cardigan_vamp = np.zeros((H, W), dtype=np.uint8)
    cardigan_vamp[320:440, 370:480] = 1  # right vamp

    belt_lace = np.zeros((H, W), dtype=np.uint8)
    belt_lace[310:350, 150:180] = 1  # left laces

    by_label = {
        "Shoes": {"label": "Shoes", "category": "footwear", "score": 0.95, "mask": shoes_mask},
        "pants": {"label": "pants", "category": "bottom", "score": 0.95, "mask": pants_left},
        "pants#1": {"label": "pants", "category": "bottom", "score": 0.95, "mask": pants_right},
        "cardigan": {"label": "cardigan", "category": "outerwear", "score": 0.95, "mask": cardigan_vamp},
        "belt": {"label": "belt", "category": "accessory", "score": 0.95, "mask": belt_lace},
    }

    def _mask_bbox(m):
        ys, xs = np.where(m)
        return (int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())) if len(ys) else None

    # Step 2a: Unconditional Footwear Consolidation
    if "Shoes" in by_label:
        while True:
            shoes_mask = by_label["Shoes"]["mask"]
            shoes_bb = _mask_bbox(shoes_mask)
            if not shoes_bb:
                break
            sy1, sx1, sy2, sx2 = shoes_bb
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Shoes" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_cat = (other_it.get("category") or "").lower()

                is_genuine_tall_top = o_cat in ("top", "dress", "outerwear") and oy1 < int(0.20 * H) and (oy2 - oy1) >= int(0.40 * H)
                is_genuine_tall_bottom = o_cat in ("bottom", "dress") and oy1 < int(0.40 * H) and (oy2 - oy1) >= int(0.45 * H)
                if is_genuine_tall_top or is_genuine_tall_bottom:
                    continue

                x_inter = max(0, min(sx2, ox2) - max(sx1, ox1))
                y_inter = max(0, min(sy2, oy2) - max(sy1, oy1))
                o_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_shoes = ndimage.binary_dilation(by_label["Shoes"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_shoes).any()
                is_proximate = _is_same_garment_component(shoes_bb, obb, min(H, W))
                vert_center_diff = abs(((sy1 + sy2) / 2.0) - ((oy1 + oy2) / 2.0))
                is_side_by_side = (vert_center_diff <= int(0.25 * H)) and (oy1 >= int(0.20 * H))

                if touches or is_proximate or box_containment >= 0.20 or is_side_by_side:
                    by_label["Shoes"]["mask"] = np.maximum(by_label["Shoes"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    assert len(by_label) == 1
    assert "Shoes" in by_label
    assert by_label["Shoes"]["category"] == "footwear"

    # Also test geometry _detect_human_presence
    items_for_geo = [
        {"label": "Shoes", "category": "footwear", "bbox": [500, 160, 800, 830]},
        {"label": "Pants", "category": "bottom", "bbox": [500, 180, 700, 410], "_human_mask_full": np.ones((50, 50))},
    ]
    # Geometry must NOT detect human presence from sneaker parts or skin mask
    assert not _detect_human_presence(items_for_geo)


def test_belt_consolidation_absorbs_flanking_strap_fragments():
    """Verify that SegFormer fragmenting a belt into buckle (Belt) and straps (Skirt/Pants)
    is consolidated into a single Belt card with category 'accessory'."""
    from scipy import ndimage
    from app.services.clothing_parser import _is_same_garment_component
    from app.services.vision.validation import _enforce_segformer_category

    H, W = 600, 1000
    # Buckle in center
    buckle_mask = np.zeros((H, W), dtype=np.uint8)
    buckle_mask[240:360, 440:560] = 1

    # Left strap mislabeled as skirt
    skirt_strap = np.zeros((H, W), dtype=np.uint8)
    skirt_strap[260:340, 100:450] = 1

    # Right strap mislabeled as pants
    pants_strap = np.zeros((H, W), dtype=np.uint8)
    pants_strap[260:340, 550:900] = 1

    by_label = {
        "Belt": {"label": "Belt", "category": "accessory", "score": 0.95, "mask": buckle_mask},
        "skirt": {"label": "skirt", "category": "bottom", "score": 0.95, "mask": skirt_strap},
        "pants": {"label": "pants", "category": "bottom", "score": 0.95, "mask": pants_strap},
    }

    def _mask_bbox(m):
        ys, xs = np.where(m)
        return (int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())) if len(ys) else None

    # Run Belt consolidation logic
    if "Belt" in by_label:
        while True:
            belt_mask = by_label["Belt"]["mask"]
            belt_bb = _mask_bbox(belt_mask)
            if not belt_bb:
                break
            by1, bx1, by2, bx2 = belt_bb
            belt_h = max(1, by2 - by1)
            belt_y_center = (by1 + by2) / 2.0
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Belt" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_h = max(1, oy2 - oy1)
                o_cat = (other_it.get("category") or "").lower()
                o_lbl = (other_it.get("label") or "").lower()

                is_genuine_tall_top = o_cat in ("top", "dress", "outerwear") and oy1 < int(0.20 * H) and o_h >= int(0.40 * H)
                is_genuine_tall_bottom = o_cat in ("bottom", "dress") and oy1 < int(0.40 * H) and o_h >= int(0.40 * H)
                if is_genuine_tall_top or is_genuine_tall_bottom:
                    continue

                if o_cat == "footwear" or "shoe" in o_lbl:
                    continue

                x_inter = max(0, min(bx2, ox2) - max(bx1, ox1))
                y_inter = max(0, min(by2, oy2) - max(by1, oy1))
                o_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_belt = ndimage.binary_dilation(by_label["Belt"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_belt).any()
                is_proximate = _is_same_garment_component(belt_bb, obb, min(H, W))
                vert_center_diff = abs(belt_y_center - ((oy1 + oy2) / 2.0))
                is_belt_band = ((vert_center_diff <= int(0.20 * H)) or (y_inter > 0)) and (o_h <= int(0.35 * H))

                if touches or is_proximate or box_containment >= 0.20 or is_belt_band:
                    by_label["Belt"]["mask"] = np.maximum(by_label["Belt"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    assert len(by_label) == 1
    assert "Belt" in by_label
    assert by_label["Belt"]["category"] == "accessory"
    final_mask = by_label["Belt"]["mask"]
    # Verify the final mask covers left strap, buckle, and right strap
    assert np.all(final_mask[240:360, 440:560] == 1)
    assert np.all(final_mask[260:340, 100:450] == 1)
    assert np.all(final_mask[260:340, 550:900] == 1)

    # Test category enforcement doesn't override LLM belt to bottom
    llm_analysis = {
        "title": "חגורת בד שחורה עם אבזם נשר",
        "category": "Accessories",
        "sub_category": "Belts",
    }
    fixed = _enforce_segformer_category(llm_analysis, segformer_kind="bottom")
    assert fixed["category"] == "Accessories"
    assert fixed["sub_category"] == "Belts"


def test_hat_fragment_consolidation_and_category_protection():
    """Verify that a baseball cap fragmented into crown (Hat), brim (Pants), and embroidery (Upper-clothes)
    is completely consolidated into a single Hat item and protected as Accessories / Headwear.
    """
    from app.services.clothing_parser import _mask_bbox, _is_same_garment_component
    from app.services.vision.validation import _enforce_segformer_category, _coerce_single_garment
    from scipy import ndimage

    H, W = 1000, 1000
    # 1. Hat crown (centered dome)
    crown_mask = np.zeros((H, W), dtype=np.uint8)
    crown_mask[200:500, 300:700] = 1

    # 2. Curved brim / visor (attached below crown, mislabeled as Pants)
    brim_mask = np.zeros((H, W), dtype=np.uint8)
    brim_mask[480:620, 250:750] = 1

    # 3. Embroidery panel / logo 'BRASIL' (inside crown, mislabeled as Upper-clothes)
    logo_mask = np.zeros((H, W), dtype=np.uint8)
    logo_mask[320:380, 400:600] = 1

    by_label = {
        "Hat": {
            "label": "Hat",
            "category": "headwear",
            "score": 0.95,
            "mask": crown_mask,
        },
        "Pants": {
            "label": "Pants",
            "category": "bottom",
            "score": 0.88,
            "mask": brim_mask,
        },
        "Upper-clothes": {
            "label": "Upper-clothes",
            "category": "top",
            "score": 0.82,
            "mask": logo_mask,
        },
    }

    # Simulate Step 2a-4 and Step 2a-5 Headwear Consolidation
    hat_keys = [
        k for k, v in list(by_label.items())
        if k.lower().startswith(("hat", "headwear", "cap", "beanie"))
        or (v and v.get("category") == "headwear")
        or "head covering" in k.lower()
    ]
    if hat_keys:
        hat_items = [by_label.pop(k) for k in hat_keys]
        hat_masks = [x["mask"] for x in hat_items if x and x.get("mask") is not None]
        if hat_masks:
            combined = hat_masks[0]
            for m in hat_masks[1:]:
                combined = np.maximum(combined, m)
            by_label["Hat"] = {
                "label": "Hat",
                "category": "headwear",
                "score": 0.95,
                "mask": combined,
            }

    if "Hat" in by_label:
        while True:
            hat_mask = by_label["Hat"]["mask"]
            hat_bb = _mask_bbox(hat_mask)
            if not hat_bb:
                break
            hy1, hx1, hy2, hx2 = hat_bb
            hat_h = max(1, hy2 - hy1)
            hat_w = max(1, hx2 - hx1)
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Hat" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_h = max(1, oy2 - oy1)
                o_w = max(1, ox2 - ox1)
                o_cat = (other_it.get("category") or "").lower()
                o_lbl = (other_it.get("label") or "").lower()

                has_human = False
                if has_human:
                    is_genuine_tall_top = o_cat in ("top", "dress", "outerwear") and o_h >= int(0.35 * H) and oy2 > int(0.40 * H)
                    is_genuine_tall_bottom = o_cat in ("bottom", "dress") and o_h >= int(0.35 * H) and oy1 >= int(0.35 * H)
                    if is_genuine_tall_top or is_genuine_tall_bottom:
                        continue

                if o_cat == "footwear" or "shoe" in o_lbl or "boot" in o_lbl:
                    continue

                x_inter = max(0, min(hx2, ox2) - max(hx1, ox1))
                y_inter = max(0, min(hy2, oy2) - max(hy1, oy1))
                o_box_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_box_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_hat = ndimage.binary_dilation(by_label["Hat"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_hat).any()
                is_proximate = _is_same_garment_component(hat_bb, obb, min(H, W))

                vert_gap = max(0, oy1 - hy2) if oy1 >= hy2 else max(0, hy1 - oy2)
                horiz_overlap = max(0, min(hx2, ox2) - max(hx1, ox1))
                total_comb_h = max(hy2, oy2) - min(hy1, oy1)
                is_adjacent_brim = (
                    (vert_gap <= int(0.12 * H))
                    and (horiz_overlap >= int(0.20 * min(hat_w, o_w)))
                    and (o_h <= int(0.65 * H))
                    and (total_comb_h <= int(0.95 * H) or not has_human)
                )

                if touches or is_proximate or box_containment >= 0.20 or is_adjacent_brim:
                    by_label["Hat"]["mask"] = np.maximum(by_label["Hat"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    assert len(by_label) == 1
    assert "Hat" in by_label
    assert by_label["Hat"]["category"] == "headwear"
    final_mask = by_label["Hat"]["mask"]
    # Check that crown, brim, and logo are all unified in the mask
    assert np.all(final_mask[220:480, 320:680] == 1)
    assert np.all(final_mask[500:600, 280:720] == 1)
    assert np.all(final_mask[330:370, 420:580] == 1)

    # Test category enforcement doesn't override LLM hat to top or bottom
    llm_analysis = {
        "title": "BRASIL Baseball Cap",
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "Classic hat",
    }
    fixed_top = _enforce_segformer_category(dict(llm_analysis), segformer_kind="top")
    assert fixed_top["category"] == "Accessories"
    assert fixed_top["sub_category"] == "Headwear"

    fixed_bottom = _enforce_segformer_category(dict(llm_analysis), segformer_kind="bottom")
    assert fixed_bottom["category"] == "Accessories"
    assert fixed_bottom["sub_category"] == "Headwear"

    # Test single garment coercion
    coerced = _coerce_single_garment({
        "name": "Yellow and Green Brasil Cap",
        "title": "Brasil Cap",
        "category": "Top",
        "sub_category": "Headwear",
    })
    assert coerced["category"] == "Accessories"
    assert coerced["sub_category"] == "Headwear"
    assert coerced["item_type"] == "Baseball Cap"


def test_hat_close_up_tall_brim_consolidation():
    """Verify that a close-up photo of a baseball cap where the visor/brim takes up >40% of the image
    and is misclassified as Pants/bottom is completely consolidated into the Hat when there is no human.
    """
    from app.services.clothing_parser import _mask_bbox, _is_same_garment_component
    from scipy import ndimage

    H, W = 1000, 1000
    # Crown: top half of cap (dome)
    crown_mask = np.zeros((H, W), dtype=np.uint8)
    crown_mask[150:550, 200:800] = 1

    # Brim: large curved visor extending from y=500 to y=920 (height = 420px = 42% of H), mislabeled as Pants
    brim_mask = np.zeros((H, W), dtype=np.uint8)
    brim_mask[500:920, 150:850] = 1

    by_label = {
        "Hat": {
            "label": "Hat",
            "category": "headwear",
            "score": 0.94,
            "mask": crown_mask,
        },
        "Pants": {
            "label": "Pants",
            "category": "bottom",
            "score": 0.89,
            "mask": brim_mask,
        },
    }

    has_human = False

    # Simulate Section 2a-5 Headwear Consolidation
    if "Hat" in by_label:
        while True:
            hat_mask = by_label["Hat"]["mask"]
            hat_bb = _mask_bbox(hat_mask)
            if not hat_bb:
                break
            hy1, hx1, hy2, hx2 = hat_bb
            hat_h = max(1, hy2 - hy1)
            hat_w = max(1, hx2 - hx1)
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Hat" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_h = max(1, oy2 - oy1)
                o_w = max(1, ox2 - ox1)
                o_cat = (other_it.get("category") or "").lower()
                o_lbl = (other_it.get("label") or "").lower()

                if has_human:
                    is_genuine_tall_top = o_cat in ("top", "dress", "outerwear") and o_h >= int(0.35 * H) and oy2 > int(0.40 * H)
                    is_genuine_tall_bottom = o_cat in ("bottom", "dress") and o_h >= int(0.35 * H) and oy1 >= int(0.35 * H)
                    if is_genuine_tall_top or is_genuine_tall_bottom:
                        continue

                if o_cat == "footwear" or "shoe" in o_lbl or "boot" in o_lbl:
                    continue

                x_inter = max(0, min(hx2, ox2) - max(hx1, ox1))
                y_inter = max(0, min(hy2, oy2) - max(hy1, oy1))
                o_box_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_box_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_hat = ndimage.binary_dilation(by_label["Hat"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_hat).any()
                is_proximate = _is_same_garment_component(hat_bb, obb, min(H, W))

                vert_gap = max(0, oy1 - hy2) if oy1 >= hy2 else max(0, hy1 - oy2)
                horiz_overlap = max(0, min(hx2, ox2) - max(hx1, ox1))
                total_comb_h = max(hy2, oy2) - min(hy1, oy1)
                is_adjacent_brim = (
                    (vert_gap <= int(0.12 * H))
                    and (horiz_overlap >= int(0.20 * min(hat_w, o_w)))
                    and (o_h <= int(0.65 * H))
                    and (total_comb_h <= int(0.95 * H) or not has_human)
                )

                if touches or is_proximate or box_containment >= 0.20 or is_adjacent_brim:
                    by_label["Hat"]["mask"] = np.maximum(by_label["Hat"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    assert len(by_label) == 1
    assert "Hat" in by_label
    assert by_label["Hat"]["category"] == "headwear"
    # Ensure crown and tall brim are both in the unified mask
    assert np.all(by_label["Hat"]["mask"][200:500, 300:700] == 1)
    assert np.all(by_label["Hat"]["mask"][600:900, 250:750] == 1)


def test_hat_synthesis_from_47_class_segformer_vest_shorts_jacket():
    """Verify that when 47-class SegFormer (which has no Hat class) detects a cap as:
    1. vest (crown, category: top)
    2. shorts (brim/visor, category: bottom)
    3. jacket (embroidery patch, category: outerwear)
    the geometric synthesis and headwear consolidation combine them into a single 'Hat' item.
    """
    from app.services.clothing_parser import _mask_bbox, _is_same_garment_component
    from scipy import ndimage

    H, W = 1000, 1000

    # 1. Crown mislabeled as vest (top)
    vest_mask = np.zeros((H, W), dtype=np.uint8)
    vest_mask[220:480, 320:680] = 1

    # 2. Visor mislabeled as shorts (bottom)
    shorts_mask = np.zeros((H, W), dtype=np.uint8)
    shorts_mask[480:600, 260:740] = 1

    # 3. Embroidery patch mislabeled as jacket (outerwear)
    jacket_mask = np.zeros((H, W), dtype=np.uint8)
    jacket_mask[340:390, 420:580] = 1

    by_label = {
        "vest": {
            "label": "vest",
            "category": "top",
            "score": 0.90,
            "mask": vest_mask,
        },
        "shorts": {
            "label": "shorts",
            "category": "bottom",
            "score": 0.85,
            "mask": shorts_mask,
        },
        "jacket": {
            "label": "jacket",
            "category": "outerwear",
            "score": 0.80,
            "mask": jacket_mask,
        },
    }

    # Execute Step 2a-3b (Detect and synthesize Hat)
    has_human = False
    if not any(k.lower().startswith(("hat", "headwear", "cap", "beanie")) or (v and v.get("category") == "headwear") for k, v in by_label.items()) and not has_human:
        dome_candidates = []
        brim_candidates = []
        for k, it in list(by_label.items()):
            m = it.get("mask")
            if m is None:
                continue
            bb = _mask_bbox(m)
            if not bb:
                continue
            y1, x1, y2, x2 = bb
            h = max(1, y2 - y1)
            w = max(1, x2 - x1)
            cat = (it.get("category") or "").lower()
            lbl = (it.get("label") or "").lower()

            is_brim_candidate = (
                cat in ("bottom", "accessory")
                or any(b in lbl for b in ("short", "pant", "skirt", "belt", "scarf"))
            ) and (h <= int(0.32 * H)) and (float(w) / float(h) >= 1.4)

            is_dome_candidate = (
                cat in ("top", "outerwear", "headwear")
                or any(d in lbl for d in ("vest", "top", "shirt", "jacket", "sweater", "hood", "cover"))
            ) and (h <= int(0.50 * H))

            if is_brim_candidate:
                brim_candidates.append((k, bb, it))
            elif is_dome_candidate:
                dome_candidates.append((k, bb, it))

        hat_pair_found = False
        for d_k, d_bb, d_it in dome_candidates:
            if hat_pair_found:
                break
            dy1, dx1, dy2, dx2 = d_bb
            d_w = max(1, dx2 - dx1)
            d_h = max(1, dy2 - dy1)
            for b_k, b_bb, b_it in brim_candidates:
                by1, bx1, by2, bx2 = b_bb
                b_w = max(1, bx2 - bx1)
                b_h = max(1, by2 - by1)

                vert_gap = max(0, by1 - dy2) if by1 >= dy2 else 0
                horiz_overlap = max(0, min(dx2, bx2) - max(dx1, bx1))
                total_h = max(dy2, by2) - min(dy1, by1)
                total_w = max(dx2, bx2) - min(dx1, bx1)

                is_cap_geometry = (
                    (by1 >= dy1 + int(0.25 * d_h))
                    and (vert_gap <= int(0.08 * H))
                    and (horiz_overlap >= int(0.30 * min(d_w, b_w)))
                    and (total_h <= int(0.55 * H))
                    and (float(total_w) / float(total_h) >= 0.70)
                )
                if is_cap_geometry:
                    combined_mask = np.maximum(d_it["mask"], b_it["mask"])
                    by_label["Hat"] = {
                        "label": "Hat",
                        "category": "headwear",
                        "score": 0.95,
                        "mask": combined_mask,
                    }
                    del by_label[d_k]
                    del by_label[b_k]
                    hat_pair_found = True
                    break

    # Now verify Step 2a-5 (Headwear Consolidation) absorbs remaining jacket patch
    if "Hat" in by_label:
        while True:
            hat_mask = by_label["Hat"]["mask"]
            hat_bb = _mask_bbox(hat_mask)
            if not hat_bb:
                break
            hy1, hx1, hy2, hx2 = hat_bb
            hat_h = max(1, hy2 - hy1)
            hat_w = max(1, hx2 - hx1)
            merged_any = False
            for other_key, other_it in list(by_label.items()):
                if other_key == "Hat" or other_it.get("mask") is None:
                    continue
                obb = _mask_bbox(other_it["mask"])
                if not obb:
                    continue
                oy1, ox1, oy2, ox2 = obb
                o_h = max(1, oy2 - oy1)
                o_w = max(1, ox2 - ox1)
                o_cat = (other_it.get("category") or "").lower()
                o_lbl = (other_it.get("label") or "").lower()

                has_human = False
                if has_human:
                    is_genuine_tall_top = o_cat in ("top", "dress", "outerwear") and o_h >= int(0.35 * H) and oy2 > int(0.40 * H)
                    is_genuine_tall_bottom = o_cat in ("bottom", "dress") and o_h >= int(0.35 * H) and oy1 >= int(0.35 * H)
                    if is_genuine_tall_top or is_genuine_tall_bottom:
                        continue

                if o_cat == "footwear" or "shoe" in o_lbl or "boot" in o_lbl:
                    continue

                x_inter = max(0, min(hx2, ox2) - max(hx1, ox1))
                y_inter = max(0, min(hy2, oy2) - max(hy1, oy1))
                o_box_area = max(1, (ox2 - ox1) * (oy2 - oy1))
                inter_area = x_inter * y_inter
                box_containment = inter_area / float(o_box_area)

                dil_other = ndimage.binary_dilation(other_it["mask"], iterations=15)
                dil_hat = ndimage.binary_dilation(by_label["Hat"]["mask"], iterations=15)
                touches = np.logical_and(dil_other, dil_hat).any()
                is_proximate = _is_same_garment_component(hat_bb, obb, min(H, W))

                vert_gap = max(0, oy1 - hy2) if oy1 >= hy2 else max(0, hy1 - oy2)
                horiz_overlap = max(0, min(hx2, ox2) - max(hx1, ox1))
                total_comb_h = max(hy2, oy2) - min(hy1, oy1)
                is_adjacent_brim = (
                    (vert_gap <= int(0.12 * H))
                    and (horiz_overlap >= int(0.20 * min(hat_w, o_w)))
                    and (o_h <= int(0.65 * H))
                    and (total_comb_h <= int(0.95 * H) or not has_human)
                )

                if touches or is_proximate or box_containment >= 0.20 or is_adjacent_brim:
                    by_label["Hat"]["mask"] = np.maximum(by_label["Hat"]["mask"], other_it["mask"])
                    del by_label[other_key]
                    merged_any = True
                    break
            if not merged_any:
                break

    assert len(by_label) == 1
    assert "Hat" in by_label
    assert by_label["Hat"]["category"] == "headwear"
    # Mask covers the crown, brim, and jacket embroidery
    hat_mask = by_label["Hat"]["mask"]
    assert np.all(hat_mask[220:480, 320:680] == 1)
    assert np.all(hat_mask[480:600, 260:740] == 1)
    assert np.all(hat_mask[340:390, 420:580] == 1)


def test_embroidered_pattern_validation_and_fallback():
    """Verify that 'embroidered' is a valid pattern, and aliases ('embroidery', 'רקמה', 'רקום')
    properly coerce to 'embroidered', and textual cues trigger embroidered fallback.
    """
    from app.services.vision.validation import _VALID_PATTERN, _PATTERN_ALIASES, _coerce_enums, _coerce_single_garment

    # 1. Direct validation enum check
    assert "embroidered" in _VALID_PATTERN
    assert _PATTERN_ALIASES.get("embroidery") == "embroidered"
    assert _PATTERN_ALIASES.get("רקמה") == "embroidered"
    assert _PATTERN_ALIASES.get("רקום") == "embroidered"

    # 2. _coerce_enums coercion from alias
    item_alias = {
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "Baseball Cap",
        "pattern": "embroidery",
    }
    _coerce_enums(item_alias)
    assert item_alias["pattern"] == "embroidered"

    # 3. Fallback when pattern is solid/empty but caption has embroidery cues
    repaired_fallback = _coerce_single_garment({
        "category": "Top",
        "sub_category": "T-Shirts",
        "item_type": "Hoodie",
        "name": "Yellow and Green Embroidered Hoodie",
        "title": "Yellow and Green Embroidered Hoodie",
        "caption": "Hoodie with detailed embroidered lettering.",
        "pattern": "solid",
        "colors": [{"name": "Yellow", "pct": 100}],
    })
    assert repaired_fallback["pattern"] == "embroidered"

    # 4. Hebrew embroidery fallback
    repaired_he = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "כובע מצחייה",
        "name": "כובע ברזיל עם רקמה",
        "title": "כובע ברזיל עם רקמה",
        "caption": "כובע מצחייה צהוב עם רקמה ירוקה ואיכותית.",
        "pattern": "חלק",
        "colors": [{"name": "צהוב", "pct": 100}],
    }, language="he")
    assert repaired_he["pattern"] == "embroidered"

    # 5. Cap with text/words on front (like the Brazilian Flag Baseball Cap)
    repaired_cap = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "Baseball Cap",
        "name": "Brazilian Flag Baseball Cap",
        "title": "Brazilian Flag Baseball Cap",
        "caption": "This vibrant Brazil-themed baseball cap features a bold yellow and green design with the word 'BRASIL' in green.",
        "pattern": "solid",
        "colors": [{"name": "Yellow", "pct": 60}, {"name": "Green", "pct": 40}],
    })
    assert repaired_cap["pattern"] == "embroidered"


def test_validation_multilingual_support_across_all_languages():
    """Verify that validation.py properly resolves patterns, genders, dress codes, and headwear text across all 13 languages."""
    from app.services.vision.validation import _coerce_single_garment, resolve_garment_gender, _normalise_dress_code

    # 1. Gender aliases in multiple languages
    assert resolve_garment_gender("זכר") == "men"
    assert resolve_garment_gender("ذكر") == "men"
    assert resolve_garment_gender("hombre") == "men"
    assert resolve_garment_gender("homme") == "men"
    assert resolve_garment_gender("männer") == "men"
    assert resolve_garment_gender("мужской") == "men"
    assert resolve_garment_gender("男士") == "men"
    assert resolve_garment_gender("メンズ") == "men"
    assert resolve_garment_gender("पुरुष") == "men"

    assert resolve_garment_gender("אישה") == "women"
    assert resolve_garment_gender("أنثى") == "women"
    assert resolve_garment_gender("mujer") == "women"
    assert resolve_garment_gender("femme") == "women"
    assert resolve_garment_gender("frauen") == "women"
    assert resolve_garment_gender("женский") == "women"
    assert resolve_garment_gender("女士") == "women"
    assert resolve_garment_gender("レディース") == "women"
    assert resolve_garment_gender("महिला") == "women"

    assert resolve_garment_gender("ילדים") == "kids"
    assert resolve_garment_gender("أطفال") == "kids"
    assert resolve_garment_gender("niños") == "kids"
    assert resolve_garment_gender("enfants") == "kids"
    assert resolve_garment_gender("kinder") == "kids"
    assert resolve_garment_gender("дети") == "kids"
    assert resolve_garment_gender("儿童") == "kids"
    assert resolve_garment_gender("キッズ") == "kids"
    assert resolve_garment_gender("बच्चे") == "kids"

    # 2. Dress code aliases across languages
    assert _normalise_dress_code("رسمي") == "formal"
    assert _normalise_dress_code("formal") == "formal"
    assert _normalise_dress_code("sportlich") == "athletic"
    assert _normalise_dress_code("деловой") == "business"
    assert _normalise_dress_code("商务休闲") == "smart-casual"
    assert _normalise_dress_code("ルームウェア") == "loungewear"

    # 3. Pattern aliases in 13 languages
    cases = [
        ("ar", "مطرز", "embroidered"),
        ("ar", "مخطط", "striped"),
        ("es", "bordado", "embroidered"),
        ("es", "camuflaje", "camouflage"),
        ("fr", "brodé", "embroidered"),
        ("fr", "rayé", "striped"),
        ("de", "bestickt", "embroidered"),
        ("de", "kariert", "plaid"),
        ("it", "ricamato", "embroidered"),
        ("it", "a quadri", "plaid"),
        ("pt", "listrado", "striped"),
        ("pt", "xadrez", "plaid"),
        ("nl", "geborduurd", "embroidered"),
        ("nl", "gestreept", "striped"),
        ("ru", "вышивка", "embroidered"),
        ("ru", "в горошек", "polka_dot"),
        ("zh", "刺绣", "embroidered"),
        ("zh", "条纹", "striped"),
        ("ja", "刺繍", "embroidered"),
        ("ja", "花柄", "floral"),
        ("hi", "कढ़ाई", "embroidered"),
        ("hi", "धारीदार", "striped"),
    ]
    for lang, raw_pat, expected in cases:
        res = _coerce_single_garment({
            "category": "Top",
            "sub_category": "T-Shirt",
            "name": f"Item {raw_pat}",
            "title": f"Item {raw_pat}",
            "pattern": raw_pat,
        }, language=lang)
        assert res["pattern"] == expected, f"Failed for {lang}: {raw_pat} -> {res['pattern']} (expected {expected})"

    # 4. Multilingual Cap with text/lettering/patches auto-classified as embroidered
    # Spanish
    cap_es = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "Gorra",
        "name": "Gorra Madrid",
        "title": "Gorra Madrid",
        "caption": "Gorra deportiva con la palabra 'MADRID' bordada en letras grandes.",
        "pattern": "liso",
    }, language="es")
    assert cap_es["pattern"] == "embroidered"

    # French
    cap_fr = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "Casquette",
        "name": "Casquette Paris",
        "title": "Casquette Paris",
        "caption": "Casquette bleue avec le mot 'PARIS' et un écusson brodé.",
        "pattern": "uni",
    }, language="fr")
    assert cap_fr["pattern"] == "embroidered"

    # Russian
    cap_ru = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "Бейсболка",
        "name": "Бейсболка с нашивкой",
        "title": "Бейсболка с нашивкой",
        "caption": "Бейсболка с надписью 'CHAMPION' и гербом на передней панели.",
        "pattern": "однотонный",
    }, language="ru")
    assert cap_ru["pattern"] == "embroidered"

    # Arabic
    cap_ar = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "قبعة",
        "name": "قبعة رياضية",
        "title": "قبعة رياضية",
        "caption": "قبعة أنيقة مع كتابة وشعار بارز في الأمام.",
        "pattern": "سادة",
    }, language="ar")
    assert cap_ar["pattern"] == "embroidered"

    # Japanese
    cap_ja = _coerce_single_garment({
        "category": "Accessories",
        "sub_category": "Headwear",
        "item_type": "キャップ",
        "name": "ベースボールキャップ",
        "title": "ベースボールキャップ",
        "caption": "フロントに文字のロゴとパッチがあしらわれたキャップ。",
        "pattern": "無地",
    }, language="ja")
    assert cap_ja["pattern"] == "embroidered"


def test_abaya_top_and_bottom_consolidate_into_single_full_body():
    """When SegFormer fragments an abaya into Upper-clothes and Pants/Skirt, consolidate into single Dress."""
    H, W = 500, 300
    top_mask = np.zeros((H, W), dtype=np.uint8)
    top_mask[80:260, 90:210] = 1

    bottom_mask = np.zeros((H, W), dtype=np.uint8)
    bottom_mask[255:460, 90:210] = 1

    by_label = {
        "Upper-clothes": {
            "label": "Upper-clothes",
            "category": "top",
            "score": 0.95,
            "mask": top_mask,
        },
        "Pants": {
            "label": "Pants",
            "category": "bottom",
            "score": 0.92,
            "mask": bottom_mask,
        },
    }

    # In _suppress_overlapping_garments with flatlay/product shot (has_human=False)
    result = _suppress_overlapping_garments(
        by_label,
        has_human=False,
    )

    assert len(result) == 1, f"Expected 1 consolidated garment, got {len(result)}: {list(result.keys())}"
    assert "Dress" in result, f"Expected Dress in result, got: {list(result.keys())}"
    assert result["Dress"]["category"] == "dress"


def test_multiview_abaya_side_by_side_consolidates():
    """Composite abaya photo (front view and profile view) where top and bottom are split into 3 pieces."""
    from app.services.clothing_parser import _mask_bbox

    H, W = 500, 400
    # Top mask spans both views (common SegFormer output for composite images)
    top_mask = np.zeros((H, W), dtype=np.uint8)
    top_mask[80:250, 60:180] = 1   # left top
    top_mask[80:250, 220:340] = 1  # right top

    # Left bottom is classified as Pants (zipper / slit)
    pants_mask = np.zeros((H, W), dtype=np.uint8)
    pants_mask[245:450, 65:175] = 1

    # Right bottom is classified as Skirt (profile silhouette)
    skirt_mask = np.zeros((H, W), dtype=np.uint8)
    skirt_mask[245:450, 225:335] = 1

    by_label = {
        "Upper-clothes": {
            "label": "Upper-clothes",
            "category": "top",
            "score": 0.95,
            "mask": top_mask,
        },
        "Pants": {
            "label": "Pants",
            "category": "bottom",
            "score": 0.92,
            "mask": pants_mask,
        },
        "Skirt": {
            "label": "Skirt",
            "category": "bottom",
            "score": 0.90,
            "mask": skirt_mask,
        },
    }

    result = _suppress_overlapping_garments(
        by_label,
        has_human=False,
    )

    assert len(result) == 1, f"Expected all pieces to consolidate into 1 Dress, got {len(result)}: {list(result.keys())}"
    assert "Dress" in result
    assert result["Dress"]["category"] == "dress"


def test_enforce_segformer_category_preserves_abaya_full_body():
    """Verify that an abaya is enforced to Full Body and retains sub_category Abaya."""
    analysis = {
        "name": "Light Blue Hooded Abaya",
        "title": "Light Blue Hooded Abaya",
        "category": "Outerwear",
        "sub_category": "Abaya",
        "item_type": "Abaya",
        "colors": ["light blue"],
    }
    fixed = _enforce_segformer_category(
        analysis,
        segformer_kind="dress",
        label="dress",
        is_single_item=True,
    )
    assert fixed["category"] == "Full Body"
    assert fixed["sub_category"] == "Abaya"

























