"""Tests for structured Gemini Vision ``footwear_anatomy`` schema and validation."""

from __future__ import annotations

try:
    import pytest
except ImportError:  # pragma: no cover
    pytest = None

from app.api.v1.closet.common import CreateItemIn, UpdateItemIn
from app.models.schemas import ClosetItem, FootwearAnatomy, GarmentAnalysis
from app.services.vision.llm import MASS_CATALOG_JSON_SCHEMA, _GARMENT_OBJECT_SCHEMA
from app.services.vision.validation import _coerce_enums, _coerce_single_garment, _sanitize_footwear_anatomy


def test_footwear_anatomy_schemas_optional_and_valid():
    assert "footwear_anatomy" in _GARMENT_OBJECT_SCHEMA["properties"]
    assert "footwear_anatomy" not in _GARMENT_OBJECT_SCHEMA["required"]

    mass_props = MASS_CATALOG_JSON_SCHEMA["properties"]["items"]["items"]["properties"]
    mass_req = MASS_CATALOG_JSON_SCHEMA["properties"]["items"]["items"]["required"]
    assert "footwear_anatomy" in mass_props
    assert "footwear_anatomy" not in mass_req

    # Validate OpenAPI 3.0 Schema compatibility with google-genai if available
    try:
        from google.genai import types
        types.Schema.model_validate(MASS_CATALOG_JSON_SCHEMA)
    except ImportError:
        pass


def test_sanitize_footwear_anatomy_strips_non_footwear_and_normalizes_footwear():
    shirt = {
        "name": "White T-Shirt",
        "title": "White T-Shirt",
        "category": "Top",
        "sub_category": "T-Shirt",
        "item_type": "Crewneck T-Shirt",
        "footwear_anatomy": {"silhouette": "t_strap", "hardware": ["metal_ring"]},
    }
    _sanitize_footwear_anatomy(shirt)
    assert shirt["footwear_anatomy"] is None

    sandal = {
        "name": "Brown Flat Leather Sandals",
        "title": "סנדלי עור שטוחים",
        "category": "Footwear",
        "sub_category": "Sandals",
        "item_type": "Flat Sandals",
        "footwear_anatomy": {
            "silhouette": "T-Strap",
            "sole_type": "FLAT_LEATHER",
            "heel_height_cm": 99.0,
            "platform_height_cm": -4.0,
            "toe_style": "thong_post",
            "forefoot_strap": "toe_post_only",
            "instep_strap": "scalloped_v_collar",
            "back_style": "open_heel_cup",
            "strap_width": "unexpected_value",
            "hardware": ["none", "micro_studs", "fake_hardware", "micro_studs"],
        },
    }
    res = _coerce_enums(sandal, language="he")
    fa = res["footwear_anatomy"]
    assert fa is not None
    assert fa["silhouette"] == "t_strap"
    assert fa["sole_type"] == "flat_leather"
    assert fa["heel_height_cm"] == 15.0
    assert fa["platform_height_cm"] == 0.0
    assert fa["strap_width"] is None
    assert fa["hardware"] == ["micro_studs"]

    coerced_single = _coerce_single_garment(dict(sandal), language="he")
    assert coerced_single["footwear_anatomy"]["back_style"] == "open_heel_cup"


def test_pydantic_models_persist_footwear_anatomy():
    fa_payload = {
        "silhouette": "slide_double",
        "sole_type": "contoured_cork",
        "heel_height_cm": 0.0,
        "platform_height_cm": 2.0,
        "toe_style": "open_round",
        "forefoot_strap": "double_band",
        "instep_strap": "buckle_band",
        "back_style": "open_backless",
        "strap_width": "wide",
        "hardware": ["buckle"],
    }
    fa = FootwearAnatomy(**fa_payload)
    assert fa.silhouette == "slide_double"

    ga = GarmentAnalysis(title="Double Buckle Slides", category="Footwear", footwear_anatomy=fa_payload)
    assert ga.footwear_anatomy.hardware == ["buckle"]

    ci = CreateItemIn(title="Double Buckle Slides", category="Footwear", footwear_anatomy=fa_payload)
    assert ci.footwear_anatomy["sole_type"] == "contoured_cork"

    ui = UpdateItemIn(footwear_anatomy=fa_payload)
    assert ui.footwear_anatomy["forefoot_strap"] == "double_band"

    item = ClosetItem(user_id="u1", title="Double Buckle Slides", category="Footwear", footwear_anatomy=fa_payload)
    dumped = item.model_dump()
    assert dumped["footwear_anatomy"]["back_style"] == "open_backless"
