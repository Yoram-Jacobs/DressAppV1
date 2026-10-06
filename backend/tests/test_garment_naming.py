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


