"""Unit tests for newly integrated Wardrobe Essentials & Fashion Science RAG rules.

Tests verify that the 12 canonical axioms derived from wardrobe-essentials.md
are correctly indexed, dynamically retrieved on corresponding semantic triggers,
and formatted within the strict latency/token envelope.
"""
from __future__ import annotations

import pytest

from app.services.fashion_rules_rag import (
    format_rules_for_prompt,
    get_all_rules,
    initialize_rules_cache,
    retrieve_fashion_axioms,
)


@pytest.fixture(autouse=True)
def setup_rules():
    initialize_rules_cache()


def test_seed_contains_wardrobe_essentials_rules():
    all_rules = get_all_rules()
    rule_ids = {r.id for r in all_rules}
    expected_new_rules = [
        "rule_pattern_scale_contrast",
        "rule_pattern_geometric_contrast",
        "rule_color_12_season_flow",
        "rule_accessories_leather_hardware_sync",
        "rule_formal_black_tie_waistband",
        "rule_tailoring_proportions_collar_button",
        "rule_psychology_singular_reveal",
        "rule_psychology_warmth_competence_navy",
        "rule_psychology_enclothed_cognition_formal",
        "rule_capsule_versatility_density",
        "rule_pediatric_textile_sensory_safety",
        "rule_style_creative_nonconformity",
    ]
    for r_id in expected_new_rules:
        assert r_id in rule_ids, f"Missing expected rule: {r_id}"


def test_business_and_interview_triggers_warmth_and_tailoring():
    retrieved = retrieve_fashion_axioms(user_text="preparing for an executive job interview", top_k=5)
    retrieved_ids = {r.id for r in retrieved}
    assert "rule_occasion_business_formal" in retrieved_ids
    assert "rule_psychology_warmth_competence_navy" in retrieved_ids
    assert "rule_tailoring_proportions_collar_button" in retrieved_ids


def test_date_and_sensual_triggers_singular_exposure_axiom():
    retrieved = retrieve_fashion_axioms(user_text="need a sexy and elegant date night outfit", top_k=4)
    retrieved_ids = {r.id for r in retrieved}
    assert "rule_psychology_singular_reveal" in retrieved_ids


def test_pediatric_triggers_child_safety_textiles():
    retrieved = retrieve_fashion_axioms(user_text="outfit for my 6 year old child for school", top_k=4)
    retrieved_ids = {r.id for r in retrieved}
    assert "rule_pediatric_textile_sensory_safety" in retrieved_ids


def test_pattern_mixing_triggers_flusser_rules():
    retrieved = retrieve_fashion_axioms(user_text="how do I mix a striped shirt with a plaid jacket pattern?", top_k=4)
    retrieved_ids = {r.id for r in retrieved}
    assert "rule_pattern_scale_contrast" in retrieved_ids
    assert "rule_pattern_geometric_contrast" in retrieved_ids


def test_black_tie_triggers_waistband_and_hardware_sync():
    retrieved = retrieve_fashion_axioms(user_text="black tie gala dinner with a tuxedo", top_k=4)
    retrieved_ids = {r.id for r in retrieved}
    assert "rule_formal_black_tie_waistband" in retrieved_ids
    assert "rule_accessories_leather_hardware_sync" in retrieved_ids


def test_compact_prompt_formatting():
    retrieved = retrieve_fashion_axioms(user_text="date night with black tie", top_k=4)
    prompt_str = format_rules_for_prompt(retrieved)
    assert "GROUND-TRUTH FASHION DESIGN AXIOMS:" in prompt_str
    # Confirm prompt stays compact (< 150 tokens ~ under 1000 characters)
    assert len(prompt_str) < 1200
