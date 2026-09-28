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


def test_arabic_straw_basket_bag_sanitization():
    analysis = {
        "name": "سترة صوفية بيج",
        "title": "سترة صوفية بيج",
        "caption": "سترة أنيقة ومريحة منسوجة بلمسة بيج",
        "category": "Top",
        "sub_category": "كنزة",
        "item_type": "كنزة",
        "fabric_materials": [{"name": "صوف", "pct": 100}],
        "tags": ["سترة", "أنيق"],
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="bag", language="ar")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "سترة" not in res["name"]
    assert "كنزة" not in res["name"]
    assert res["name"] == "حقيبة سلة قش"
    assert res["item_type"] == "حقيبة سلة قش"
    assert res["fabric_materials"][0]["name"] == "قش"
    assert "سترة" not in res.get("tags", [])


def test_german_straw_basket_bag_sanitization():
    analysis = {
        "name": "Beige Strickjacke",
        "title": "Beige Strickjacke",
        "caption": "Eine weiche beige Strickjacke aus Wolle für den Übergang",
        "category": "Top",
        "sub_category": "Strickjacke",
        "item_type": "Strickjacke",
        "fabric_materials": [{"name": "Wolle", "pct": 100}],
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="tasche", language="de")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "strickjacke" not in res["name"].lower()
    assert res["name"] == "Geflochtene Korbtasche"
    assert res["item_type"] == "Korbtasche"
    assert res["fabric_materials"][0]["name"] == "Stroh"


def test_french_straw_basket_bag_sanitization():
    analysis = {
        "name": "Gilet Beige en Maille",
        "title": "Gilet Beige",
        "caption": "Un élégant gilet beige en maille pour la mi-saison",
        "category": "Top",
        "sub_category": "Gilet",
        "item_type": "Gilet",
        "fabric_materials": [{"name": "Laine", "pct": 100}],
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="panier", language="fr")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "gilet" not in res["name"].lower()
    assert res["name"] == "Sac Panier Tressé"
    assert res["item_type"] == "Sac panier"
    assert res["fabric_materials"][0]["name"] == "Paille"


def test_spanish_classic_handbag_sanitization():
    analysis = {
        "name": "Camisa Elegante",
        "title": "Camisa Elegante",
        "caption": "Una camisa de vestir con botones",
        "category": "Top",
        "sub_category": "Camisa",
        "item_type": "Camisa",
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="bolso", language="es")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "camisa" not in res["name"].lower()
    assert res["name"] == "Bolso Clásico"
    assert res["item_type"] == "Bolso de mano"


def test_russian_straw_basket_bag_sanitization():
    analysis = {
        "name": "Бежевый кардиган",
        "title": "Бежевый кардиган",
        "caption": "Теплый вязаный кардиган бежевого цвета",
        "category": "Top",
        "sub_category": "Кардиган",
        "item_type": "Кардиган",
        "fabric_materials": [{"name": "Шерсть", "pct": 100}],
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="сумка", language="ru")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "кардиган" not in res["name"].lower()
    assert res["name"] == "Плетеная сумка-корзина"
    assert res["item_type"] == "Сумка-корзина"
    assert res["fabric_materials"][0]["name"] == "Солома"


def test_japanese_classic_handbag_sanitization():
    analysis = {
        "name": "ニットカーディガン",
        "title": "ニットカーディガン",
        "caption": "上質なニットで作られたエレガントなカーディガン",
        "category": "Top",
        "sub_category": "カーディガン",
        "item_type": "カーディガン",
    }
    res = _enforce_segformer_category(analysis, segformer_kind="bag", label="バッグ", language="ja")
    assert res is not None
    assert res["category"] == "Accessories"
    assert res["sub_category"] == "Bag"
    assert "カーディガン" not in res["name"]
    assert res["name"] == "クラシックハンドバッグ"
    assert res["item_type"] == "ハンドバッグ"

