import pytest
from app.api.v1.suitcase import get_safety_knowledge
from app.services.keyed_prompts import PROMPT_SUITCASE


def test_safety_knowledge_retrieval_morocco_marrakech():
    """Verify that RAG safety retrieval for Marrakech contains both modesty guidelines and safety warnings."""
    sec = get_safety_knowledge(query_text="טיול למרקש מרוקו", max_chars=1800)
    assert sec, "Safety knowledge for Marrakech must not be empty"
    sec_low = sec.lower()

    # Modesty keywords
    assert any(k in sec_low for k in ("shoulders", "knees", "cleavage", "scarf", "mosque", "modesty", "צניעות", "כתפיים", "ברכיים")), (
        f"Expected modesty guidelines in Marrakech safety knowledge, got: {sec}"
    )

    # Security / pickpocket keywords
    assert any(k in sec_low for k in ("pickpocket", "safety", "security", "alleys", "theft", "caution", "כיוס", "זהירות", "סמטאות")), (
        f"Expected security/pickpocket warnings in Marrakech safety knowledge, got: {sec}"
    )


def test_prompt_suitcase_rules():
    """Verify that PROMPT_SUITCASE explicitly instructs modesty and safety precautions."""
    assert "cultural_guidelines" in PROMPT_SUITCASE
    assert "danger_zones_info" in PROMPT_SUITCASE
    assert "modesty" in PROMPT_SUITCASE.lower()
    assert "safety" in PROMPT_SUITCASE.lower()


def test_find_closet_match():
    """Verify find_closet_match correctly identifies closet items by ID, alias, and name."""
    from app.api.v1.suitcase import find_closet_match

    closet = [
        {"id": "item-101", "title": "חולצת כפתורים לבנה", "category": "top"},
        {"id": "item-102", "title": "מכנסיים מחויטים בז'", "category": "bottom"},
    ]
    # By ID
    m1 = find_closet_match({"closet_item_id": "item-101"}, closet)
    assert m1 and m1["id"] == "item-101"

    # By alias
    alias_map = {"c1": closet[0], "c2": closet[1]}
    m2 = find_closet_match({"closet_item_id": "c2"}, closet, alias_map=alias_map)
    assert m2 and m2["id"] == "item-102"

    # By title substring
    m3 = find_closet_match({"description": "חולצת כפתורים לבנה ארוכה"}, closet)
    assert m3 and m3["id"] == "item-101"


def test_normalize_suitcase_item_role():
    """Verify role normalizer maps synonyms to canonical taxonomy roles."""
    from app.api.v1.suitcase import _normalize_suitcase_item_role

    assert _normalize_suitcase_item_role("tunic") == "top"
    assert _normalize_suitcase_item_role("tops") == "top"
    assert _normalize_suitcase_item_role("shirt") == "top"
    assert _normalize_suitcase_item_role("bottoms") == "bottom"
    assert _normalize_suitcase_item_role("pants") == "bottom"
    assert _normalize_suitcase_item_role("belt") == "accessory"
    assert _normalize_suitcase_item_role("accessories") == "accessory"
    assert _normalize_suitcase_item_role("boots") == "shoes"
    assert _normalize_suitcase_item_role("jacket") == "outerwear"
    assert _normalize_suitcase_item_role("dress") == "dress"


def test_default_missing_desc_for_role():
    """Verify missing item descriptions are specific and context-aware, never generic."""
    from app.api.v1.suitcase import _get_default_missing_desc_for_role

    desc_acc = _get_default_missing_desc_for_role("accessory", "Marrakech, Morocco")
    assert "scarf" in desc_acc.lower() or "accessory" in desc_acc.lower()
    assert "missing garment" not in desc_acc.lower()

    desc_shoes = _get_default_missing_desc_for_role("shoes", "Marrakech, Morocco")
    assert "walking shoes" in desc_shoes.lower()

    desc_top = _get_default_missing_desc_for_role("top", "Marrakech, Morocco")
    assert "top" in desc_top.lower()


