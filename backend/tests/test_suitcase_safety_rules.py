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


def test_deduplicate_sentences():
    """Verify deduplication removes duplicate prefixes and sentences while preserving unique text."""
    from app.api.v1.suitcase import _deduplicate_sentences

    raw = (
        "הנחיות צניעות וקוד לבוש: הנחיות צניעות וקוד לבוש: מומלץ ללבוש בגדים צנועים ומכובדים במקומות ציבוריים.\n\n"
        "הנחיות צניעות וקוד לבוש: מומלץ ללבוש בגדים צנועים ומכובדים במקומות ציבוריים.\n\n"
        "אזהרות בטיחות וביטחון: יש להיזהר מכייסים בשווקים."
    )
    cleaned = _deduplicate_sentences(raw)
    assert "מומלץ ללבוש בגדים צנועים ומכובדים במקומות ציבוריים." in cleaned
    assert "יש להיזהר מכייסים בשווקים." in cleaned
    # Ensure no duplicate sentence
    assert cleaned.count("מומלץ ללבוש בגדים צנועים") == 1
    assert cleaned.count("הנחיות צניעות") == 0  # Prefixes stripped


def test_separate_modesty_and_safety():
    """Verify combined text is cleanly divided into modesty rules vs safety alerts."""
    from app.api.v1.suitcase import _separate_modesty_and_safety

    combined = (
        "הנחיות צניעות וקוד לבוש: מומלץ ללבוש בגדים צנועים ומכובדים במקומות ציבוריים, במסגדים ובאתרי קודש.\n\n"
        "אזהרות בטיחות וביטחון: יש לנקוט במשנה זהירות מפני כייסים בשווקים ולהימנע מסמטאות חשוכות בלילה.\n\n"
        "הנחיות צניעות וקוד לבוש: מומלץ ללבוש בגדים צנועים ומכובדים במקומות ציבוריים, במסגדים ובאתרי קודש."
    )

    cult, dang = _separate_modesty_and_safety(None, None, fallback_notes=combined)

    # Modesty must have dress/mosque rules, NOT pickpocket warnings
    assert "בגדים צנועים" in cult
    assert "מסגדים" in cult
    assert "כייסים" not in cult
    assert "סמטאות" not in cult
    assert cult.count("בגדים צנועים") == 1

    # Safety must have pickpocket/alley warnings, NOT dress rules
    assert "כייסים" in dang
    assert "סמטאות" in dang
    assert "בגדים צנועים" not in dang
    assert "מסגדים" not in dang
    assert dang.count("כייסים") == 1

    # Idempotence check: running again on the output produces identical clean output
    cult2, dang2 = _separate_modesty_and_safety(cult, dang)
    assert cult2 == cult
    assert dang2 == dang



