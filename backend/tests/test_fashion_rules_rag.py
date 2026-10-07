"""Unit tests for Fashion Rules Ground-Truth Knowledge Base & RAG engine."""
import pytest

from app.models.fashion_rule import FashionRule
from app.services.fashion_rules_rag import (
    filter_modesty_closet_items,
    format_rules_for_prompt,
    get_all_rules,
    initialize_rules_cache,
    retrieve_fashion_axioms,
)


def test_fashion_rules_seed_loading():
    """Verify all canonical rules load properly from seed JSON."""
    initialize_rules_cache()
    rules = get_all_rules()
    assert len(rules) >= 15

    categories = {r.category for r in rules}
    assert "color_harmony" in categories
    assert "texture_material" in categories
    assert "silhouette_proportion" in categories
    assert "weather_thermodynamics" in categories
    assert "occasion_dress_code" in categories
    assert "cultural_modesty" in categories

    for r in rules:
        assert r.id
        assert r.title
        assert len(r.rule_statement) > 10
        assert 1 <= r.priority <= 10


def test_retrieve_weather_axioms():
    """Verify dynamic retrieval of weather and thermodynamic rules."""
    # Sub-zero cold test
    cold_rules = retrieve_fashion_axioms(
        weather={"temp_c": 2.0, "condition": "Overcast"},
        top_k=4,
    )
    cold_ids = [r.id for r in cold_rules]
    assert "rule_weather_subzero_layering" in cold_ids

    # Rain precipitation test
    rain_rules = retrieve_fashion_axioms(
        weather={"temp_c": 14.0, "condition": "Heavy rain"},
        top_k=4,
    )
    rain_ids = [r.id for r in rain_rules]
    assert "rule_weather_precipitation_protection" in rain_ids

    # Summer heat test
    summer_rules = retrieve_fashion_axioms(
        weather={"temp_c": 31.0, "condition": "Sunny"},
        top_k=4,
    )
    summer_ids = [r.id for r in summer_rules]
    assert "rule_weather_summer_breathability" in summer_ids


def test_retrieve_cultural_modesty_axioms():
    """Verify cultural and modesty rule activation."""
    modest_rules = retrieve_fashion_axioms(
        user_profile={"modesty_level": "conservative"},
        top_k=4,
    )
    modest_ids = [r.id for r in modest_rules]
    assert "rule_cultural_modesty_conservative" in modest_ids

    wedding_rules = retrieve_fashion_axioms(
        user_text="What should I wear to my friend's wedding ceremony?",
        top_k=4,
    )
    wedding_ids = [r.id for r in wedding_rules]
    assert "rule_cultural_ceremony_etiquette" in wedding_ids


def test_filter_modesty_closet_items():
    """Verify deterministic modesty pruning of revealing garments."""
    closet = [
        {"id": "item1", "title": "Silk Blouse", "sub_category": "Blouse", "tags": ["elegant"]},
        {"id": "item2", "title": "Denim Mini Skirt", "sub_category": "Mini Skirt", "tags": ["mini"]},
        {"id": "item3", "title": "Cotton Crop Top", "sub_category": "Crop Top", "tags": ["crop"]},
        {"id": "item4", "title": "Tailored Maxi Skirt", "sub_category": "Skirt", "tags": ["modest", "long"]},
    ]

    # Non-modest user: leaves all items untouched
    unfiltered = filter_modesty_closet_items(closet, modesty_level="standard")
    assert len(unfiltered) == 4

    # Conservative user: mini skirt and crop top are pruned
    filtered = filter_modesty_closet_items(closet, modesty_level="conservative")
    assert len(filtered) == 2
    filtered_ids = [it["id"] for it in filtered]
    assert "item1" in filtered_ids
    assert "item4" in filtered_ids
    assert "item2" not in filtered_ids
    assert "item3" not in filtered_ids


def test_format_rules_for_prompt():
    """Verify compact prompt formatting under token limits."""
    rules = retrieve_fashion_axioms(
        weather={"temp_c": 12.0, "condition": "Light drizzle"},
        user_profile={"modesty_level": "conservative"},
        top_k=3,
    )
    prompt_str = format_rules_for_prompt(rules)
    assert "GROUND-TRUTH FASHION DESIGN AXIOMS:" in prompt_str
    assert "• [" in prompt_str
    # Token length estimate: ~4 chars per token -> should be well under 800 chars (<200 tokens)
    assert len(prompt_str) < 1000
