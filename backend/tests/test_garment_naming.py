"""Tests for specific attribute-rich garment naming and elimination of generic 'בגד'/'Garment' titles."""
import pytest
from app.services.vision.validation import _coerce_single_garment


def test_oxford_shoe_naming_hebrew():
    raw_shoe = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Shoes",
        "item_type": "Solid Shoes",
        "caption": "נעלי אוקספורד אלגנטיות לגברים בצבע חום מעור.",
        "colors": [{"name": "חום", "pct": 100}],
        "fabric_materials": [{"name": "עור", "pct": 100}],
        "name": "בגד חום",
        "title": "בגד חום",
    }
    coerced = _coerce_single_garment(raw_shoe, language="he")
    name = coerced["name"]
    title = coerced["title"]
    assert "בגד" not in name, f"Expected no generic 'בגד' in name, got: {name}"
    assert "אוקספורד" in name, f"Expected 'אוקספורד' in name, got: {name}"
    assert "חומות" in name or "חום" in name, f"Expected brown in name, got: {name}"
    assert name == title


def test_green_loafers_naming_hebrew():
    raw_loafers = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Shoes",
        "item_type": "Loafers",
        "caption": "מוקסינים ירוקים מעוצבים מעור.",
        "colors": [{"name": "ירוק", "pct": 100}],
        "fabric_materials": [{"name": "עור", "pct": 100}],
        "name": "בגד ירוק",
        "title": "בגד ירוק",
    }
    coerced = _coerce_single_garment(raw_loafers, language="he")
    name = coerced["name"]
    assert "בגד" not in name, f"Expected no generic 'בגד' in name, got: {name}"
    assert any(term in name for term in ("לופר", "מוקסין")), f"Expected loafer/moccasin in name, got: {name}"
    assert any(term in name for term in ("ירוקות", "ירוקים")), f"Expected green agreement in name, got: {name}"


def test_green_pleated_skirt_naming_hebrew():
    raw_skirt = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Skirt",
        "item_type": "Pleated Skirt",
        "caption": "חצאית פליסה ירוקה ואלגנטית.",
        "colors": [{"name": "ירוק", "pct": 100}],
        "fabric_materials": [{"name": "פוליאסטר", "pct": 100}],
        "name": "בגד ירוק",
        "title": "בגד ירוק",
    }
    coerced = _coerce_single_garment(raw_skirt, language="he")
    name = coerced["name"]
    assert "בגד" not in name, f"Expected no generic 'בגד' in name, got: {name}"
    assert "חצאית" in name, f"Expected skirt in name, got: {name}"
    assert "ירוקה" in name, f"Expected feminine green agreement 'ירוקה', got: {name}"


def test_english_attribute_rich_naming():
    raw_loafers_en = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Shoes",
        "item_type": "Loafers",
        "caption": "Green round-toe loafers in polished leather.",
        "colors": [{"name": "Green", "pct": 100}],
        "fabric_materials": [{"name": "Leather", "pct": 100}],
        "name": "Green Garment",
        "title": "Green Garment",
    }
    coerced = _coerce_single_garment(raw_loafers_en, language="en")
    name = coerced["name"]
    assert "Garment" not in name, f"Expected no generic 'Garment', got: {name}"
    assert "Green" in name, f"Expected color in name, got: {name}"
    assert "Loafers" in name or "Shoes" in name, f"Expected shoe noun, got: {name}"


def test_camo_cargo_pants_hebrew():
    raw_cargo = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Cargo",
        "caption": "מכנסי דגמ\"ח בצבע חום עם הדפס הסוואה.",
        "pattern": "camo",
        "colors": [{"name": "חום", "pct": 100}],
        "name": "מכנסיים חום",
        "title": "מכנסיים חום",
    }
    coerced = _coerce_single_garment(raw_cargo, language="he")
    name = coerced["name"]
    title = coerced["title"]
    assert "דגמ\"ח" in name, f"Expected 'דגמ\"ח' in name, got: {name}"
    assert "הסוואה" in name, f"Expected 'הסוואה' in name, got: {name}"
    assert "חומים" in name, f"Expected masculine plural 'חומים' in name, got: {name}"
    assert coerced["pattern"] == "camouflage"
    assert name == title


def test_camo_cargo_pants_english():
    raw_cargo_en = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Cargo",
        "caption": "Men's brown camouflage cargo pants with utility pockets.",
        "pattern": "camouflage",
        "colors": [{"name": "Brown", "pct": 100}],
        "name": "Brown Pants",
        "title": "Brown Pants",
    }
    coerced = _coerce_single_garment(raw_cargo_en, language="en")
    name = coerced["name"]
    assert name == "Brown Camouflage Cargo Pants", f"Expected 'Brown Camouflage Cargo Pants', got: {name}"
    assert coerced["pattern"] == "camouflage"


def test_chinos_hebrew():
    raw_chinos = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Chinos",
        "caption": "מכנסי צ'ינו אלגנטיים בצבע נייבי.",
        "colors": [{"name": "navy", "pct": 100}],
        "name": "מכנסיים כחול",
        "title": "מכנסיים כחול",
    }
    coerced = _coerce_single_garment(raw_chinos, language="he")
    name = coerced["name"]
    assert "צ'ינו" in name, f"Expected 'צ'ינו' in name, got: {name}"
    assert "כחול נייבי" in name, f"Expected 'כחול נייבי' in name, got: {name}"


def test_bottom_hole_prevention_flag():
    import inspect
    from app.services import clothing_parser
    src = inspect.getsource(clothing_parser.apply_alpha_intersection)
    assert "is_multi_segment = is_footwear or is_eyewear" in src, "Bottoms must NOT be multi-segment to allow hole filling"


def test_cross_category_jacket_with_pants_caption():
    raw_jacket = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Jacket",
        "item_type": "מכנסיים ארוכים",
        "caption": "מכנסיים אדומים בגזרה ספורטיבית ונוחה.",
        "colors": [{"name": "red", "pct": 100}],
        "name": "ז'קט אדום",
        "title": "ז'קט אדום",
    }
    coerced = _coerce_single_garment(raw_jacket, language="he")
    assert "מכנסיים" not in coerced["caption"], f"Expected pants purged from caption, got: {coerced['caption']}"
    assert "מכנסי" not in coerced["caption"]
    assert "מכנסי" not in coerced["item_type"]
    assert "ז'קט" in coerced["item_type"] or "מעיל" in coerced["item_type"]


def test_cross_category_skirt_with_pants_caption():
    raw_skirt = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Skirt",
        "item_type": "מכנסיים",
        "caption": "מכנסיים גבריים בגזרה מחויטת.",
        "colors": [{"name": "black", "pct": 100}],
        "name": "חצאית שחורה",
        "title": "חצאית שחורה",
    }
    coerced = _coerce_single_garment(raw_skirt, language="he")
    assert "מכנסיים" not in coerced["caption"], f"Expected pants purged from caption, got: {coerced['caption']}"
    assert "חצאית" in coerced["item_type"]


def test_cross_category_footwear_and_bag_sanitization():
    raw_shoe = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "פיקוס",
        "item_type": "נעליים",
        "caption": "נעליים אלגנטיות לגברים.",
        "tags": ["# אופנה", "# פקקים", "# שקר"],
        "name": "נעליים שחורות",
    }
    coerced = _coerce_single_garment(raw_shoe, language="he")
    assert coerced["sub_category"] in ("Shoes", "נעליים")
    assert coerced["sub_category"] != "פיקוס"
    assert "# פקקים" not in coerced["tags"]
    assert "# שקר" not in coerced["tags"]

    raw_bag = {
        "is_clothing": True,
        "category": "Accessories",
        "sub_category": "Handbag",
        "item_type": "נימוציד",
        "caption": "כיסוי קיר שחור ואיכותי.",
        "name": "כיסוי קיר",
        "tags": ["# שקר", "# תיק"],
    }
    coerced_bag = _coerce_single_garment(raw_bag, language="he")
    assert coerced_bag["item_type"] == "תיק יד"
    assert "כיסוי קיר" not in coerced_bag["name"]
    assert "# שקר" not in coerced_bag["tags"]


def test_cross_category_arabic_jacket_sanitization():
    raw = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Jacket",
        "item_type": "بنطال",
        "caption": "بنطال أنيق ومريح للاستخدام اليومي.",
        "name": "جاكيت شتوي أسود",
        "title": "جاكيت شتوي أسود",
    }
    res = _coerce_single_garment(raw, language="ar")
    assert "بنطال" not in res["caption"]
    assert "بنطال" not in res["item_type"]
    assert res["item_type"] == "سترة واقية"


def test_cross_category_french_skirt_sanitization():
    raw = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Skirt",
        "item_type": "pantalon",
        "caption": "Un pantalon élégant pour homme.",
        "name": "Jupe noire",
        "title": "Jupe noire",
    }
    res = _coerce_single_garment(raw, language="fr")
    assert "pantalon" not in res["caption"].lower()
    assert res["item_type"] == "Jupe trapèze"


def test_cross_category_german_jacket_sanitization():
    raw = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Jacket",
        "item_type": "Hose",
        "caption": "Eine klassische Hose aus Baumwolle.",
        "name": "Schwarze Jacke",
        "title": "Schwarze Jacke",
    }
    res = _coerce_single_garment(raw, language="de")
    assert "hose" not in res["caption"].lower()
    assert res["item_type"] == "Windjacke"


def test_chinese_material_normalization():
    raw = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Oxfords",
        "item_type": "Oxford Shoes",
        "caption": "Brown leather shoes.",
        "colors": [{"name": "brown", "pct": 100}],
        "fabric_materials": [{"name": "革", "pct": 100}],
        "name": "Brown Oxford Shoes",
    }
    res = _coerce_single_garment(raw, language="en")
    mats = res.get("fabric_materials")
    assert mats and mats[0]["name"] == "Leather", f"Expected '革' -> 'Leather', got: {mats}"


def test_english_model_output_hebrew_synthesis():
    raw = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Oxfords",
        "item_type": "Oxford Shoes",
        "caption": "Brown leather oxford shoes for formal or business wear.",
        "colors": [{"name": "brown", "pct": 100}],
        "fabric_materials": [{"name": "leather", "pct": 100}],
        "name": "Brown Leather Oxford Shoes",
        "title": "Brown Leather Oxford Shoes",
    }
    res = _coerce_single_garment(raw, language="he")
    name = res["name"]
    title = res["title"]
    assert "אוקספורד" in name, f"Expected 'אוקספורד' in name, got: {name}"
    assert "חומות" in name or "חום" in name, f"Expected brown in name, got: {name}"
    assert "מעור" in name or "עור" in name, f"Expected leather in name, got: {name}"
    assert not any(ord(ch) < 128 and ch.isalpha() for ch in name), f"Expected no Latin chars in name, got: {name}"
    assert name == title


def test_pumps_heels_not_sneakers():
    raw = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Heels",
        "item_type": "High Heel Pumps",
        "caption": "Black high heel pumps for evening wear.",
        "colors": [{"name": "black", "pct": 100}],
        "fabric_materials": [{"name": "leather", "pct": 100}],
        "name": "Black High Heel Pumps",
    }
    res = _coerce_single_garment(raw, language="en")
    assert res["sub_category"].lower() in ("heels", "pumps", "shoes")
    assert "sneaker" not in res["sub_category"].lower()
    assert "sneaker" not in res["item_type"].lower()


def test_red_hooded_jacket_hebrew_caption_and_season():
    raw_jacket = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Jacket",
        "item_type": "Casual Jacket",
        "caption": "Red casual hooded jacket with front zipper and side pockets.",
        "colors": [{"name": "red", "pct": 100}],
        "fabric_materials": [{"name": "polyester", "pct": 100}],
        "season": ["spring", "summer", "fall", "winter"],
        "tags": ["casual", "hooded", "zipper", "outerwear"],
        "name": "Red Jacket",
    }
    res = _coerce_single_garment(raw_jacket, language="he")
    # 1. Season must not contain summer
    assert "summer" not in res["season"], f"Summer must be excluded from heavy jacket, got: {res['season']}"
    assert "winter" in res["season"] and "fall" in res["season"]
    # 2. Caption must not be generic fallback
    cap = res["caption"]
    assert cap != "פריט אופנה איכותי ונוח להשלמת המראה.", f"Generic fallback caption returned: {cap}"
    assert any(term in cap for term in ("ז'קט", "מעיל", "קפוצ'ון")), f"Expected descriptive caption, got: {cap}"
    # 3. Tags must be localized and not contain English
    for t in res["tags"]:
        assert not any(ord(ch) < 128 and ch.isalpha() for ch in str(t)), f"Tag contains English: {t}"


def test_camo_cargo_shorts_hebrew_and_season():
    raw_shorts = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Shorts",
        "item_type": "Cargo Shorts",
        "pattern": "printed",
        "caption": "Men's camouflage cargo shorts with multi-pocket utility styling.",
        "colors": [{"name": "green", "pct": 100}],
        "fabric_materials": [{"name": "cotton", "pct": 100}],
        "season": ["spring", "summer", "fall", "winter"],
        "tags": ["cargo", "utility", "multi-pocket", "casual"],
        "name": "Cargo Shorts",
    }
    res = _coerce_single_garment(raw_shorts, language="he")
    # 1. Pattern upgraded to camouflage
    assert res["pattern"] == "camouflage", f"Expected camouflage pattern, got: {res['pattern']}"
    # 2. Item type localized in Hebrew
    assert "קצרים" in res["item_type"] or "דגמ\"ח" in res["item_type"]
    assert not any(ord(ch) < 128 and ch.isalpha() for ch in res["item_type"]), f"item_type has English: {res['item_type']}"
    # 3. Season must not contain winter
    assert "winter" not in res["season"], f"Winter must be excluded from shorts, got: {res['season']}"
    assert "summer" in res["season"]
    # 4. Tags translated, no raw English
    for t in res["tags"]:
        assert not any(ord(ch) < 128 and ch.isalpha() for ch in str(t)), f"Tag contains English: {t}"


def test_high_heel_pump_no_stripes_or_category_echoes():
    raw_heels = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Heels",
        "item_type": "High Heel Pump",
        "caption": "Black high heel pump with glossy stripe accent on stiletto heel.",
        "colors": [{"name": "black", "pct": 100}],
        "fabric_materials": [{"name": "synthetic", "pct": 100}],
        "season": ["spring", "summer", "fall", "winter"],
        "tags": ["high heel", "Women's Footwear", "striped", "formal"],
        "name": "High Heel Pump",
    }
    res = _coerce_single_garment(raw_heels, language="he")
    # 1. No false positive striped pattern on footwear
    assert res.get("pattern") != "striped"
    # 2. Item type localized
    assert res["item_type"] == "נעלי עקב"
    # 3. No category echoes or English tags
    for t in res["tags"]:
        assert str(t).lower() not in ("women's footwear", "footwear", "striped", "stripe", "פסים")
        assert not any(ord(ch) < 128 and ch.isalpha() for ch in str(t)), f"Tag contains English: {t}"


def test_knit_sweater_hebrew_and_season():
    raw_sweater = {
        "is_clothing": True,
        "category": "Top",
        "sub_category": "Sweater",
        "item_type": "Long Sleeve Sv",
        "caption": "Cream long sleeve knit sweater with textured soft weave.",
        "colors": [{"name": "cream", "pct": 100}],
        "fabric_materials": [{"name": "wool", "pct": 70}, {"name": "synthetic", "pct": 30}],
        "season": ["spring", "summer", "fall", "winter"],
        "tags": ["knitwear", "sweater", "casual wear"],
        "name": "Long Sleeve Sv",
    }
    res = _coerce_single_garment(raw_sweater, language="he")
    # 1. Item type localized in Hebrew
    assert "סוודר" in res["item_type"] or "סריג" in res["item_type"]
    assert not any(ord(ch) < 128 and ch.isalpha() for ch in res["item_type"]), f"item_type has English: {res['item_type']}"
    # 2. Season must not contain summer
    assert "summer" not in res["season"], f"Summer must be excluded from knit sweater, got: {res['season']}"
    # 3. Synthetic material normalized
    mat_names = [m["name"] for m in res["fabric_materials"]]
    assert "Synthetic" in mat_names


def test_heeled_boot_naming_and_material_hebrew():
    """Verify ankle boots with heels are named מגפוני עקב שחורים (not נעלי עקב) and materials default to Leather/Rubber."""
    raw_boot = {
        "is_clothing": True,
        "category": "Footwear",
        "sub_category": "Boots",
        "item_type": "High Heel Ankle Boots",
        "caption": "Black leather ankle boots with high chunky heel and zipper.",
        "colors": [{"name": "שחור", "pct": 100}],
        "fabric_materials": [{"name": "סינתטי", "pct": 100}],
        "name": "נעלי עקב",
        "title": "נעלי עקב",
    }
    res = _coerce_single_garment(raw_boot, language="he")
    name = res["name"]
    # 1. Name must be boots / heeled boots in masculine plural, NOT נעלי עקב שחורות
    assert "נעלי עקב" not in name, f"Boot should not be called 'נעלי עקב', got: {name}"
    assert "מגפונ" in name or "מגפ" in name, f"Expected boot noun in name, got: {name}"
    assert "שחורים" in name, f"Expected masculine plural 'שחורים', got: {name}"
    # 2. Caption must not start with נעלי עקב
    assert not res["caption"].startswith("נעלי עקב"), f"Caption should not start with 'נעלי עקב', got: {res['caption']}"
    # 3. Material must not remain 100% synthetic for formal heeled boots
    mat_names = [m["name"] for m in res["fabric_materials"]]
    assert "Leather" in mat_names or "Suede" in mat_names, f"Expected Leather in materials, got: {res['fabric_materials']}"


def test_hooded_jacket_caption_no_stutter_hebrew():
    """Verify Hebrew caption synthesis does not repeat 'עם קפוצ'ון' when title already has it."""
    raw_jacket = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Jackets",
        "item_type": "Hooded Jacket",
        "title": "ז'קט עם קפוצ'ון אפור",
        "name": "ז'קט עם קפוצ'ון אפור",
        "caption": "ז'קט קז'ואלי עם רוכסן קדמי וקפוצ'ון.",
        "tags": ["hooded", "zipper", "jacket"],
        "colors": [{"name": "אפור", "pct": 100}],
        "fabric_materials": [{"name": "כותנה", "pct": 70}, {"name": "פוליאסטר", "pct": 30}],
    }
    res = _coerce_single_garment(raw_jacket, language="he")
    caption = res["caption"]
    # Ensure "קפוצ'ון" appears only once in the caption
    count_hood = caption.count("קפוצ'ון")
    assert count_hood <= 1, f"Expected at most 1 mention of 'קפוצ'ון' in caption, got {count_hood}: {caption}"
    assert not "עם קפוצ'ון אפור עם קפוצ'ון" in caption, f"Found stutter in caption: {caption}"


def test_peplum_dress_not_misclassified_as_coat():
    """Verify peplum dress or skirt suit is NOT converted to Outerwear/Coat even if caption mentions jacket/blazer silhouette."""
    raw_dress = {
        "is_clothing": True,
        "category": "Full Body",
        "sub_category": "Dresses",
        "item_type": "Peplum Dress",
        "name": "Burgundy Peplum Dress",
        "title": "Burgundy Peplum Dress",
        "caption": "Burgundy tailored peplum dress with a blazer-style jacket collar and pencil skirt.",
        "colors": [{"name": "בורדו", "pct": 100}],
        "fabric_materials": [{"name": "פוליאסטר", "pct": 95}, {"name": "אלסטן", "pct": 5}],
    }
    res = _coerce_single_garment(raw_dress, language="he")
    # 1. Category must remain Full Body (never Outerwear)
    assert res["category"].lower() in ("full body", "dress"), f"Expected Full Body, got: {res['category']}"
    # 2. Subcategory must remain Dresses / Suits (never Coats)
    assert res["sub_category"].lower() not in ("coats", "מעילים"), f"Subcategory should not be Coats, got: {res['sub_category']}"
    # 3. Name must be dress, never 'מעיל בורדו'
    assert "מעיל" not in res["name"], f"Name should be a dress, not a coat, got: {res['name']}"
    assert "שמל" in res["name"] or "חליפ" in res["name"], f"Expected dress/suit in name, got: {res['name']}"


def test_peplum_coat_reclassified_to_peplum_dress_english():
    """Verify when Gemini misclassifies a peplum dress as 'Red Wool Coat' under Outerwear, it is auto-corrected to Full Body Peplum Dress."""
    raw_coat = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Coats",
        "item_type": "Long Wool Coat",
        "name": "Red Wool Coat",
        "title": "Red Wool Coat",
        "caption": "A women's red wool coat with a peplum waist and long sleeves.",
        "colors": [{"name": "Red", "pct": 100}],
        "fabric_materials": [{"name": "Wool", "pct": 100}],
    }
    res = _coerce_single_garment(raw_coat, language="en")
    assert res["category"] == "Full Body", f"Expected Full Body, got: {res['category']}"
    assert res["sub_category"] == "Dresses", f"Expected Dresses, got: {res['sub_category']}"
    assert res["item_type"] == "Peplum Dress", f"Expected Peplum Dress, got: {res['item_type']}"
    assert "Coat" not in res["name"], f"Expected no Coat in name, got: {res['name']}"
    assert "Peplum Dress" in res["name"], f"Expected Peplum Dress in name, got: {res['name']}"


def test_segformer_dress_overrides_gemini_coat():
    """Verify _enforce_segformer_category overrides Gemini Outerwear/Coats to Full Body/Dresses when mask is dress with peplum."""
    from app.services.vision.validation import _enforce_segformer_category
    raw_analysis = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Coats",
        "item_type": "Long Wool Coat",
        "name": "Red Wool Coat",
        "title": "Red Wool Coat",
        "caption": "A women's red wool coat with a peplum waist and long sleeves.",
        "colors": [{"name": "Red", "pct": 100}],
    }
    res = _enforce_segformer_category(raw_analysis, segformer_kind="dress", language="en")
    assert res["category"] == "Full Body", f"Expected Full Body, got: {res['category']}"
    assert res["sub_category"] == "Dresses", f"Expected Dresses, got: {res['sub_category']}"
    assert res["item_type"] == "Peplum Dress", f"Expected Peplum Dress, got: {res['item_type']}"
    assert "Coat" not in res["name"]


def test_segformer_kurta_overrides_qwen_coat_hebrew():
    """Verify SegFormer kurta detection overrides Qwen's hallucinated Coat/מעיל to Top/Kurta/קורטה."""
    from app.services.vision.validation import _enforce_segformer_category
    raw_analysis = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Coat",
        "item_type": "מעיל",
        "name": "מעיל לבן",
        "title": "מעיל לבן",
        "caption": "מעיל לבן מושלם לעונות הקרירות בעיצוב נקי.",
        "colors": [{"name": "לבן", "pct": 100}],
    }
    res = _enforce_segformer_category(raw_analysis, segformer_kind="top", label="kurta", language="he")
    assert res["category"] == "Top", f"Expected Top, got: {res['category']}"
    assert res["sub_category"] == "קורטה", f"Expected קורטה, got: {res['sub_category']}"
    assert res["item_type"] == "קורטה", f"Expected קורטה, got: {res['item_type']}"
    assert "מעיל" not in res["name"], f"Expected no מעיל in name, got: {res['name']}"
    assert "מעיל" not in res["caption"], f"Expected no מעיל in caption, got: {res['caption']}"
    assert "קורטה" in res["name"]
    assert "לבנה" in res["name"]


def test_segformer_bottom_overrides_qwen_shirt_hebrew():
    """Verify SegFormer bottom detection overrides Qwen's hallucinated button-up shirt to Bottom/Pants/מכנסיים."""
    from app.services.vision.validation import _enforce_segformer_category
    raw_analysis = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "מכנסיים",
        "item_type": "חולצה מכופתרת",
        "name": "חולצה מכופתרת לבנה",
        "title": "חולצה מכופתרת לבנה",
        "caption": "חולצה מכופתרת לבנה בעיצוב איכותי וקלאסי.",
        "colors": [{"name": "לבן", "pct": 100}],
    }
    res = _enforce_segformer_category(raw_analysis, segformer_kind="bottom", label="pants", language="he")
    assert res["category"] == "Bottom", f"Expected Bottom, got: {res['category']}"
    assert res["sub_category"] == "מכנסיים", f"Expected מכנסיים, got: {res['sub_category']}"
    assert "חולצה" not in res["item_type"], f"Expected no חולצה in item_type, got: {res['item_type']}"
    assert "חולצה" not in res["name"], f"Expected no חולצה in name, got: {res['name']}"
    assert "חולצה" not in res["caption"], f"Expected no חולצה in caption, got: {res['caption']}"
    assert "מכנסי" in res["name"]
    assert "לבנים" in res["name"]


def test_sanitize_cross_category_bottoms_cleans_shirt_terms():
    """Verify _sanitize_cross_category_contamination purges shirt terms from bottom garments."""
    from app.services.vision.validation import _sanitize_cross_category_contamination
    raw_pants = {
        "is_clothing": True,
        "category": "Bottom",
        "sub_category": "Pants",
        "item_type": "Button-Up Shirt",
        "name": "White Button-Up Shirt",
        "title": "White Button-Up Shirt",
        "caption": "White button-up shirt in crisp cotton.",
    }
    _sanitize_cross_category_contamination(raw_pants, language="en")
    assert raw_pants["item_type"] == "Casual Pants"
    assert "Shirt" not in raw_pants["name"]
    assert "shirt" not in raw_pants["caption"].lower()


def test_sherwani_detection_overrides_blazer_hebrew():
    """Verify Sherwani cues override Qwen's hallucinated blazer to Outerwear/Sherwani/שרוואני."""
    from app.services.vision.validation import _enforce_segformer_category
    raw_analysis = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Blazer",
        "item_type": "Blazer",
        "name": "בלייזר כחול",
        "title": "בלייזר כחול",
        "caption": "בלייזר כחול מחויט ואלגנטי בעיצוב שרוואני עם צווארון סיני.",
        "colors": [{"name": "כחול", "pct": 100}],
    }
    res = _enforce_segformer_category(raw_analysis, segformer_kind="outerwear", label="sherwani", language="he")
    assert res["category"] == "Outerwear", f"Expected Outerwear, got: {res['category']}"
    assert res["sub_category"] == "שרוואני", f"Expected שרוואני, got: {res['sub_category']}"
    assert res["item_type"] == "שרוואני", f"Expected שרוואני, got: {res['item_type']}"
    assert "בלייזר" not in res["name"], f"Expected no בלייזר in name, got: {res['name']}"
    assert "בלייזר" not in res["caption"], f"Expected no בלייזר in caption, got: {res['caption']}"
    assert "שרוואני" in res["name"]
    assert "כחול" in res["name"]


def test_achkan_detection_overrides_blazer_english():
    """Verify Achkan cues override Qwen's hallucinated blazer to Outerwear/Achkan in English."""
    from app.services.vision.validation import _enforce_segformer_category
    raw_analysis = {
        "is_clothing": True,
        "category": "Outerwear",
        "sub_category": "Blazer",
        "item_type": "Blazer",
        "name": "Blue Blazer",
        "title": "Blue Blazer",
        "caption": "Traditional blue silk achkan with standing mandarin collar.",
        "colors": [{"name": "Blue", "pct": 100}],
    }
    res = _enforce_segformer_category(raw_analysis, segformer_kind="top", label="upper-clothes", language="en")
    assert res["category"] == "Outerwear", f"Expected Outerwear, got: {res['category']}"
    assert res["sub_category"] == "Achkan", f"Expected Achkan, got: {res['sub_category']}"
    assert "Blazer" not in res["name"], f"Expected no Blazer in name, got: {res['name']}"
    assert "Achkan" in res["name"]


def test_hand_masking_skin_chrominance_non_nude_coat():
    """Verify apply_alpha_intersection excises human hand skin at cuffs on non-nude garments even when is_single_item=True."""
    import numpy as np
    from PIL import Image
    import io
    from app.services.clothing_parser import apply_alpha_intersection

    # 100x100 RGBA image
    # Background: transparent (0, 0, 0, 0)
    # Garment body: deep blue (20, 40, 150, 255) in center (y=10..90, x=30..70)
    # Model hands at lateral cuffs: skin-tone (200, 140, 110, 255) at (y=60..85, x=15..28 and x=72..85)
    img_arr = np.zeros((100, 100, 4), dtype=np.uint8)
    img_arr[10:90, 30:70] = [20, 40, 150, 255]  # Deep blue garment

    # Skin color: R=200, G=140, B=110 (cr ~ 152, cb ~ 103, r > g > b, r-g = 60)
    img_arr[60:85, 15:28] = [200, 140, 110, 255]  # Left hand protruding from cuff
    img_arr[60:85, 72:85] = [200, 140, 110, 255]  # Right hand protruding from cuff

    buf = io.BytesIO()
    Image.fromarray(img_arr, mode="RGBA").save(buf, format="PNG")
    png_bytes = buf.getvalue()

    # SegFormer coarse mask covers the garment AND erroneously leaks slightly over the hands
    seg_mask = np.zeros((100, 100), dtype=np.uint8)
    seg_mask[10:90, 30:70] = 255
    seg_mask[60:85, 15:28] = 120  # SegFormer leaked over hands
    seg_mask[60:85, 72:85] = 120

    out_png = apply_alpha_intersection(
        png_bytes,
        seg_mask_bbox=seg_mask,
        category="outerwear",
        label="sherwani",
        is_single_item=True,
    )
    assert out_png is not None, "Expected output PNG bytes"
    out_arr = np.array(Image.open(io.BytesIO(out_png)))

    # Verify blue garment body is preserved (alpha == 255)
    assert np.all(out_arr[20:80, 35:65, 3] > 200), "Garment body fabric must be preserved"

    # Verify hands are excised (alpha ~ 0)
    left_hand_alpha = out_arr[65:80, 18:25, 3]
    right_hand_alpha = out_arr[65:80, 75:82, 3]
    assert np.mean(left_hand_alpha) < 40, f"Left hand must be excised, got mean alpha: {np.mean(left_hand_alpha)}"
    assert np.mean(right_hand_alpha) < 40, f"Right hand must be excised, got mean alpha: {np.mean(right_hand_alpha)}"


def test_kurta_female_model_traditional_no_rings_hebrew():
    """Verify Kurta with female model assigns women gender, traditional dress code, Indian tradition, and purges rings/spring tag collision."""
    raw_kurta = {
        "is_clothing": True,
        "category": "Top",
        "sub_category": "kurta",
        "item_type": "קורטה",
        "model_gender": "women",
        "caption": "קורטה צהובה אלגנטית בעיצוב מסורתי ונוח עם רקמה מעודנת.",
        "colors": [{"name": "צהוב", "pct": 100}],
        "fabric_materials": [{"name": "כותנה", "pct": 100}],
        "season": ["spring", "summer"],
        "tags": ["kurta", "traditional", "spring", "embroidered"],
        "name": "קורטה צהובה",
        "title": "קורטה צהובה",
    }
    res = _coerce_single_garment(raw_kurta, language="he")
    # 1. Name must be Kurta (never חולצת טי) and with feminine agreement
    assert "קורטה" in res["name"]
    assert "חולצת טי" not in res["name"]
    assert "צהובה" in res["name"]
    # 2. Gender must be women (model in photo is female)
    assert res.get("gender") == "women"
    # 3. Dress code must be traditional
    assert res.get("dress_code") == "traditional"
    # 4. Tradition must be Indian / South Asian
    assert res.get("tradition") in ("הודית", "South Asian / Indian")
    # 5. Tags must NOT contain rings (טבעות) or category leaks
    for t in res["tags"]:
        assert t not in ("טבעות", "rings", "ring")






