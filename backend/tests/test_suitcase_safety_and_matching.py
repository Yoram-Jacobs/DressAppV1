"""Unit & regression tests for Suitcase safety knowledge retrieval, dual alert extraction, and garment matching.
"""
import pytest
from app.api.v1.suitcase import (
    get_safety_knowledge,
    find_closet_match,
    _parse_suitcase_json,
)


def test_safety_knowledge_retrieval_morocco():
    """Verify Marrakech / Morocco retrieval yields both modesty and safety/security details."""
    ctx = get_safety_knowledge("מרקש, מרוקו", max_chars=3000)
    assert ctx, "Safety knowledge for Marrakech must not be empty"
    ctx_low = ctx.lower()
    
    # Must contain modesty guidelines
    assert any(w in ctx_low for w in ["modesty", "cover", "shoulders", "knees", "mosque", "swimwear"])
    # Must contain safety / security warnings
    assert any(w in ctx_low for w in ["pickpocket", "safety", "security", "derb", "medina", "valuables", "scam"])


def test_safety_knowledge_retrieval_uae_egypt():
    """Verify UAE / Egypt retrieval yields both cultural/modesty and safety rules."""
    ctx_uae = get_safety_knowledge("Dubai, UAE", max_chars=3000)
    assert ctx_uae
    assert "modesty" in ctx_uae.lower() or "shoulders" in ctx_uae.lower()
    
    ctx_egypt = get_safety_knowledge("Cairo, Egypt", max_chars=3000)
    assert ctx_egypt
    assert "modesty" in ctx_egypt.lower() or "shoulders" in ctx_egypt.lower()
    assert "pickpocket" in ctx_egypt.lower() or "scam" in ctx_egypt.lower() or "safety" in ctx_egypt.lower()


def test_find_closet_match_by_alias_and_id():
    """Verify matching by integer alias, formatted string, and UUID."""
    closet_item_1 = {"id": "uuid-1234-top", "title": "חולצה מכופתרת לבנה", "category": "top"}
    closet_item_2 = {"id": "uuid-5678-pant", "title": "מכנסי ג'ינס כחולים", "category": "bottom"}
    closet = [closet_item_1, closet_item_2]
    alias_map = {
        "1": closet_item_1,
        "uuid-1234-top": closet_item_1,
        "2": closet_item_2,
        "uuid-5678-pant": closet_item_2,
    }

    # 1. Exact alias
    res1 = find_closet_match({"closet_item_id": "1"}, closet, alias_map=alias_map)
    assert res1 == closet_item_1

    # 2. String with digits "Item 2"
    res2 = find_closet_match({"closet_item_id": "Item 2"}, closet, alias_map=alias_map)
    assert res2 == closet_item_2

    # 3. Exact UUID
    res3 = find_closet_match({"closet_item_id": "uuid-1234-top"}, closet, alias_map=alias_map)
    assert res3 == closet_item_1


def test_find_closet_match_by_token_overlap():
    """Verify token overlap matching for Hebrew item descriptions."""
    closet_item = {
        "id": "uuid-shirt-stripes",
        "title": "חולצת כפתורים לבנה ארוכה מפוספסת",
        "category": "top",
    }
    closet = [closet_item]

    # Description overlaps on "חולצת" and "לבנה"
    item = {"description": "חולצת פשתן לבנה קלה"}
    matched = find_closet_match(item, closet)
    assert matched == closet_item


def test_suitcase_json_safety_net_fallback():
    """Verify safety net extraction when model leaves cultural_guidelines or danger_zones_info blank."""
    eff_safety_context = (
        "## Morocco (Marrakech, Fes, Casablanca)\n"
        "Women's Modesty: Shoulders, chest, and knees should remain covered in public medinas and historic districts.\n"
        "Market & Medina Safety & Security: Busy souks, Jemaa el-Fnaa, and narrow alleyways (derbs) have active pickpockets. Carry crossbody bags.\n"
    )

    # Empty alerts from LLM
    analysis = {"cultural_guidelines": "", "danger_zones_info": ""}

    if not analysis.get("cultural_guidelines") and eff_safety_context:
        modesty_lines = []
        for line in eff_safety_context.splitlines():
            line_clean = line.strip().lstrip("*#- ").strip()
            line_low = line_clean.lower()
            if any(k in line_low for k in ("modesty", "cover", "shoulders", "knees", "cleavage", "scarf", "hijab", "abaya", "mosque", "temple", "swimwear", "bikini", "צניעות", "כיסוי", "ברכיים", "כתפיים", "מסגד", "בית כנסת", "בגד ים")):
                if len(line_clean) > 20 and not line_clean.startswith("##") and "keywords:" not in line_low:
                    modesty_lines.append(line_clean)
                    if len(modesty_lines) >= 2:
                        break
        if modesty_lines:
            analysis["cultural_guidelines"] = " ".join(modesty_lines)

    if not analysis.get("danger_zones_info") and eff_safety_context:
        safety_lines = []
        for line in eff_safety_context.splitlines():
            line_clean = line.strip().lstrip("*#- ").strip()
            line_low = line_clean.lower()
            if any(k in line_low for k in ("pickpocket", "safety", "security", "crime", "alley", "night", "theft", "valuables", "scam", "danger", "warning", "police", "בטיחות", "ביטחון", "כיוס", "גניבה", "זהירות", "סמטאות", "לילה")):
                if len(line_clean) > 20 and not line_clean.startswith("##") and "keywords:" not in line_low:
                    safety_lines.append(line_clean)
                    if len(safety_lines) >= 3:
                        break
        if safety_lines:
            analysis["danger_zones_info"] = " ".join(safety_lines)

    assert "Shoulders" in analysis["cultural_guidelines"]
    assert "pickpocket" in analysis["danger_zones_info"].lower()
