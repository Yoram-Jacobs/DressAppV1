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

