try:
    import pytest
except ImportError:
    pytest = None
from app.services.vision.validation import _enforce_segformer_category, _sanitize_bag_or_accessory


def test_hebrew_straw_basket_bag_sanitization():
    analysis = {
        "name": "קרדיגן סרוג בז'",
        "title": "קרדיגן סרוג בז'",
        "caption": "קרדיגן סרוג ומרקמי בגוון בז' חמים להשלמת המראה",
        "category": "Top",
        "sub_category": "סוודר",
        "item_type": "סוודר",
        "fabric_materials": [{"name": "צמר", "pct": 100}],
    }
    res = _enforce_segformer_category(analysis, segformer_kind="accessory", label="bag")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "קרדיגן" not in res["name"]
    assert "סוודר" not in res["name"]
    assert "קרדיגן" not in res["caption"]
    assert res["name"] == "תיק סל קש"
    assert res["item_type"] == "תיק סל קש"
    assert res["fabric_materials"][0]["name"] == "קש"


def test_english_straw_basket_bag_sanitization():
    analysis = {
        "name": "Beige Knit Cardigan",
        "title": "Beige Knit Cardigan",
        "caption": "A warm textured beige knit cardigan for casual layering",
        "category": "Top",
        "sub_category": "Cardigan",
        "item_type": "Knit Cardigan",
        "fabric_materials": [{"name": "Wool", "pct": 100}],
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="bag")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "cardigan" not in res["name"].lower()
    assert "cardigan" not in res["caption"].lower()
    assert res["name"] == "Textured Basket Bag"
    assert res["item_type"] == "Basket Bag"
    assert res["fabric_materials"][0]["name"] == "Straw"


def test_compatible_accessory_with_apparel_purged():
    analysis = {
        "name": "Woven Sweater",
        "title": "Woven Sweater",
        "caption": "A stylish woven sweater with handles",
        "category": "Accessories",
        "sub_category": "Sweater",
        "item_type": "Sweater",
    }
    res = _enforce_segformer_category(analysis, segformer_kind="accessory", label="bag")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "sweater" not in res["name"].lower()
