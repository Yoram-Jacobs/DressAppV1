"""Unit tests for materials prediction prompt, JSON schema, and domain sanitization."""
import pytest
from app.services.vision.llm import (
    _GARMENT_OBJECT_SCHEMA,
    _user_prompt,
    SYSTEM_PROMPT,
    ATTRIBUTE_GROUPS,
)
from app.services.vision.validation import (
    sanitize_fabric_materials,
    _coerce_single_garment,
)


def test_materials_schema_has_canonical_enum():
    """Verify _GARMENT_OBJECT_SCHEMA contains canonical fashion materials enum."""
    props = _GARMENT_OBJECT_SCHEMA["properties"]["fabric_materials"]
    assert props["type"] == "array"
    items_props = props["items"]["properties"]
    assert "name" in items_props
    assert "enum" in items_props["name"]
    enums = items_props["name"]["enum"]
    
    # Critical fashion materials must be present
    for mat in ("Cotton", "Leather", "Faux Leather", "Suede", "Wool", "Cashmere", "Denim", "Silk", "Linen", "Polyester", "Nylon"):
        assert mat in enums, f"Missing material {mat} in schema enum"


def test_footwear_cotton_sanitization():
    """Verify footwear uppers never get Cotton (blue heels/pumps should be Leather or Suede)."""
    # Case 1: Women's blue high heel pumps with 100% Cotton
    raw_materials = [{"name": "Cotton", "pct": 100}]
    sanitized = sanitize_fabric_materials(
        raw_materials,
        category="Footwear",
        sub_category="Heels",
        item_type="High Heel Pumps",
        full_text="Blue high heel pumps נעלי עקב כחולות",
    )
    mat_names = [m["name"].lower() for m in sanitized]
    assert "cotton" not in mat_names
    assert "leather" in mat_names

    # Case 2: Suede boots with 100% Cotton
    sanitized_suede = sanitize_fabric_materials(
        raw_materials,
        category="Footwear",
        sub_category="Boots",
        item_type="Ankle Boots",
        full_text="Suede ankle boots מגפוני זמש",
    )
    assert sanitized_suede[0]["name"] == "Suede"
    assert sanitized_suede[0]["pct"] == 100


def test_bag_polyester_cotton_sanitization():
    """Verify structured handbags never default to 100% generic Polyester or Cotton."""
    # Case 1: Black handbag with 100% Polyester
    raw_materials = [{"name": "Polyester", "pct": 100}]
    sanitized = sanitize_fabric_materials(
        raw_materials,
        category="Accessories",
        sub_category="Handbag",
        item_type="Bag",
        full_text="Black leather tote handbag תיק שחור",
    )
    mat_names = [m["name"].lower() for m in sanitized]
    assert "polyester" not in mat_names
    assert "leather" in mat_names
    assert sanitized[0]["pct"] == 100


def test_sweater_knitwear_cotton_sanitization():
    """Verify knit sweaters never default to flat 100% Cotton."""
    raw_materials = [{"name": "Cotton", "pct": 100}]
    sanitized = sanitize_fabric_materials(
        raw_materials,
        category="Top",
        sub_category="Sweater",
        item_type="Knit Sweater",
        full_text="Gray knit sweater סוודר סריג אפור",
    )
    mat_names = [m["name"] for m in sanitized]
    assert "Wool" in mat_names or "Acrylic" in mat_names
    assert sum(m["pct"] for m in sanitized) == 100


def test_sweater_category_coercion_not_outerwear():
    """Verify sweaters/knits are category Top, never Outerwear (coat)."""
    raw_item = {
        "name": "סוודר סריג אפור",
        "title": "סוודר סריג אפור",
        "category": "Outerwear",
        "sub_category": "Sweater",
        "item_type": "Knit Sweater",
        "colors": [{"name": "Grey", "pct": 100}],
        "fabric_materials": [{"name": "Cotton", "pct": 100}],
        "caption": "סוודר סריג אפור מושלם לעונות הקרירות.",
        "tags": ["סריג", "סוודר"],
    }
    coerced = _coerce_single_garment(raw_item, language="he")
    assert coerced["category"] == "Top", f"Expected Top, got {coerced['category']}"
    # Materials should also be knitwear blend, not 100% Cotton
    mat_names = [m["name"] for m in coerced["fabric_materials"]]
    assert "Wool" in mat_names or "Acrylic" in mat_names


def test_prompts_contain_materials_rules():
    """Verify prompts explicitly state the category-aware materials rules."""
    p = SYSTEM_PROMPT
    assert "Footwear=" in p or "Footwear" in p
    assert "NEVER Cotton" in p
    assert "Knitwear" in p or "Sweaters=" in p

    u = _user_prompt()
    assert "NEVER Cotton" in u
    assert "Knitwear/Sweaters" in u

    # Visual attribute group snippet
    vis_group = [g for g in ATTRIBUTE_GROUPS if g[0] == "visual"][0]
    snippet = vis_group[3]
    assert "NEVER Cotton" in snippet
    assert "Knitwear/Sweaters" in snippet


def test_coat_wool_vs_faux_leather_sanitization():
    """Verify explicit wool coats misidentified as Faux Leather resolve to Wool blend,
    while legitimate leather, faux leather, and suede coats/peacoats/fur-collar coats are preserved.
    """
    raw_materials = [{"name": "Faux Leather", "pct": 100}]

    # Case 1: Explicit wool coat ("wool", "מעיל צמר") misidentified as Faux Leather -> sanitized to Wool
    sanitized_wool = sanitize_fabric_materials(
        raw_materials,
        category="Outerwear",
        sub_category="Coats",
        item_type="Wool Coat",
        full_text="Green wool coat with fur collar מעיל צמר ירוק",
    )
    mat_names_wool = [m["name"] for m in sanitized_wool]
    assert "Wool" in mat_names_wool
    assert "Faux Leather" not in mat_names_wool

    # Case 2: Tailored leather coat with fur collar ("מעיל עור", "leather coat") -> Faux Leather PRESERVED
    sanitized_leather_fur = sanitize_fabric_materials(
        raw_materials,
        category="Outerwear",
        sub_category="Coats",
        item_type="Fur-Trimmed Coat",
        full_text="Tailored faux leather coat with fur collar מעיל דמוי עור עם צווארון פרווה",
    )
    mat_names_leather_fur = [m["name"] for m in sanitized_leather_fur]
    assert "Faux Leather" in mat_names_leather_fur
    assert "Wool" not in mat_names_leather_fur

    # Case 3: Tailored overcoat / peacoat with leather materials and no wool cues -> PRESERVED as Leather
    sanitized_overcoat = sanitize_fabric_materials(
        [{"name": "Leather", "pct": 100}],
        category="Outerwear",
        sub_category="Coats",
        item_type="Tailored Overcoat",
        full_text="Brown tailored leather overcoat",
    )
    assert sanitized_overcoat == [{"name": "Leather", "pct": 100}]

    # Case 4: Suede trench coat -> PRESERVED as Suede
    sanitized_suede = sanitize_fabric_materials(
        [{"name": "Suede", "pct": 100}],
        category="Outerwear",
        sub_category="Coats",
        item_type="Trench Coat",
        full_text="Tan suede trench coat מעיל זמש",
    )
    assert sanitized_suede == [{"name": "Suede", "pct": 100}]

