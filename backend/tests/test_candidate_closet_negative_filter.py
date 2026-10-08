import asyncio
import pytest
from app.services.stylist_qa_engine import (
    validate_garment_against_negative_constraints,
    filter_candidate_closet_by_axioms,
    evaluate_and_authorize_outfit,
    find_best_garment_replacement,
)
from app.services.fashion_rules_rag import (
    retrieve_fashion_axioms,
    initialize_rules_cache,
)
from app.services.gemini_stylist import prepare_stylist_prompt


@pytest.fixture(autouse=True)
def ensure_rules_loaded():
    initialize_rules_cache()


def test_validate_hindu_antyeshti_negative_constraints():
    axioms = retrieve_fashion_axioms(user_text="Hindu funeral ceremony antyeshti", top_k=2)
    funeral_rule = next(r for r in axioms if r.id == "rule_cultural_hindu_antyeshti")

    # Black pants -> strictly forbidden
    black_pants = {"id": "p1", "title": "Black Tailored Trousers", "category": "Bottom", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(black_pants, funeral_rule, role="bottom")
    assert not is_valid
    assert "Black" in reason

    # Red silk shirt -> forbidden (vibrant celebratory color)
    red_shirt = {"id": "s1", "title": "Red Festive Silk Shirt", "category": "Top", "colors": ["red"]}
    is_valid, reason = validate_garment_against_negative_constraints(red_shirt, funeral_rule, role="top")
    assert not is_valid
    assert "red" in reason.lower()

    # Leather shoes -> forbidden in sacred cremation rituals
    leather_shoes = {"id": "sh1", "title": "Black Leather Oxford Shoes", "category": "Shoes", "material": "leather", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(leather_shoes, funeral_rule, role="shoes")
    assert not is_valid

    # Plain white cotton kurta -> strictly compliant!
    white_kurta = {"id": "k1", "title": "Plain White Cotton Kurta", "category": "Top", "colors": ["white"], "material": "cotton"}
    is_valid, reason = validate_garment_against_negative_constraints(white_kurta, funeral_rule, role="top")
    assert is_valid
    assert reason is None


def test_validate_hindu_vivaha_negative_constraints():
    axioms = retrieve_fashion_axioms(user_text="Hindu wedding guest vivaha", top_k=2)
    wedding_rule = next(r for r in axioms if r.id == "rule_cultural_hindu_vivaha")

    # Solid black suit -> forbidden (inauspicious)
    black_suit = {"id": "b1", "title": "Solid Black Evening Suit", "category": "Top", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(black_suit, wedding_rule, role="top")
    assert not is_valid
    assert "black" in reason.lower()

    # Plain unadorned white shirt -> forbidden (mourning/widowhood connotation)
    plain_white = {"id": "w1", "title": "Plain White Office Shirt", "category": "Top", "colors": ["white"]}
    is_valid, reason = validate_garment_against_negative_constraints(plain_white, wedding_rule, role="top")
    assert not is_valid
    assert "white" in reason.lower()

    # Auspicious maroon embroidered kurta -> strictly compliant!
    festive_kurta = {
        "id": "m1",
        "title": "Maroon Silk Kurta with Gold Embroidery",
        "category": "Top",
        "colors": ["red", "gold"],
        "tags": ["silk", "festive", "embroidered"],
    }
    is_valid, reason = validate_garment_against_negative_constraints(festive_kurta, wedding_rule, role="top")
    assert is_valid


def test_validate_east_asian_funeral_negative_constraints():
    axioms = retrieve_fashion_axioms(user_text="Chinese funeral memorial service", top_k=2)
    funeral_rule = next(r for r in axioms if r.id == "rule_cultural_east_asian_funeral")

    # Red tie or red jacket -> strictly forbidden
    red_jacket = {"id": "rj1", "title": "Crimson Red Velvet Blazer", "category": "Outerwear", "colors": ["red"]}
    is_valid, reason = validate_garment_against_negative_constraints(red_jacket, funeral_rule, role="outerwear")
    assert not is_valid
    assert "Red and gold" in reason

    # Gold necktie -> strictly forbidden
    gold_tie = {"id": "gt1", "title": "Metallic Gold Silk Tie", "category": "Accessory", "colors": ["gold"]}
    is_valid, reason = validate_garment_against_negative_constraints(gold_tie, funeral_rule, role="accessory")
    assert not is_valid

    # Plain black suit jacket -> compliant!
    black_suit = {"id": "bs1", "title": "Matte Black Tailored Suit Jacket", "category": "Outerwear", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(black_suit, funeral_rule, role="outerwear")
    assert is_valid


def test_validate_wedding_guest_dress_negative_constraints():
    axioms = retrieve_fashion_axioms(user_text="Western church wedding guest attire", top_k=2)
    ceremony_rule = next(r for r in axioms if r.id == "rule_cultural_ceremony_etiquette")

    # Solid white lace dress -> strictly forbidden for non-bride guests
    white_dress = {"id": "wd1", "title": "Solid White Floral Lace Maxi Dress", "category": "Dress", "colors": ["white"]}
    is_valid, reason = validate_garment_against_negative_constraints(white_dress, ceremony_rule, role="dress")
    assert not is_valid
    assert "bride" in reason.lower()

    # Emerald cocktail dress -> compliant!
    emerald_dress = {"id": "ed1", "title": "Emerald Green Pleated Midi Dress", "category": "Dress", "colors": ["green"]}
    is_valid, reason = validate_garment_against_negative_constraints(emerald_dress, ceremony_rule, role="dress")
    assert is_valid


def test_filter_candidate_closet_by_axioms_purges_before_inference():
    closet = [
        {"id": "b-pant", "title": "Black Slim Trousers", "category": "Bottom", "colors": ["black"]},
        {"id": "w-pant", "title": "White Linen Chino Pants", "category": "Bottom", "colors": ["white"]},
        {"id": "r-shirt", "title": "Bright Red Graphic Tee", "category": "Top", "colors": ["red"], "tags": ["graphic"]},
        {"id": "w-shirt", "title": "Plain White Cotton Button Down", "category": "Top", "colors": ["white"]},
        {"id": "sh-leather", "title": "Black Leather Oxford Shoes", "category": "Shoes", "material": "leather", "colors": ["black"]},
        {"id": "sh-canvas", "title": "White Canvas Slip-On Shoes", "category": "Shoes", "material": "canvas", "colors": ["white"]},
    ]

    # Test under Hindu Funeral context
    hindu_axioms = retrieve_fashion_axioms(user_text="attending Hindu funeral ceremony antyeshti", top_k=2)
    compliant, purged = filter_candidate_closet_by_axioms(closet, hindu_axioms)

    purged_ids = [it["id"] for it in purged]
    compliant_ids = [it["id"] for it in compliant]

    # Black pants, red shirt, and black leather shoes must all be purged!
    assert "b-pant" in purged_ids
    assert "r-shirt" in purged_ids
    assert "sh-leather" in purged_ids

    # White pants, white shirt, and canvas shoes must remain compliant!
    assert "w-pant" in compliant_ids
    assert "w-shirt" in compliant_ids
    assert "sh-canvas" in compliant_ids


@pytest.mark.asyncio
async def test_build_stylist_prompt_purges_prohibited_closet_items():
    closet = [
        {"id": "top-black", "title": "Black Cashmere Sweater", "category": "Top", "colors": ["black"]},
        {"id": "top-white", "title": "White Linen Tunic Shirt", "category": "Top", "colors": ["white"]},
        {"id": "bottom-black", "title": "Black Tailored Trousers", "category": "Bottom", "colors": ["black"]},
        {"id": "bottom-white", "title": "White Cotton Chino Pants", "category": "Bottom", "colors": ["white"]},
    ]

    # Generate prompt for Hindu funeral
    sys_msg, prompt_text = await prepare_stylist_prompt(
        session_id="test-cultural-filter",
        user_text="What should I wear to a Hindu cremation ceremony (Antyeshti)?",
        closet_summary=closet,
    )

    # In the prompt context sent to the LLM:
    # White items must be present
    assert "White Linen Tunic Shirt" in prompt_text or "top-white" in prompt_text
    assert "White Cotton Chino Pants" in prompt_text or "bottom-white" in prompt_text

    # Black items must have been PURGED before the LLM prompt was built!
    assert "Black Cashmere Sweater" not in prompt_text
    assert "Black Tailored Trousers" not in prompt_text


@pytest.mark.asyncio
async def test_evaluate_and_authorize_outfit_enforces_axioms_and_emits_audit():
    all_closet = [
        {"id": "w-top", "title": "White Cotton Long-Sleeve Shirt", "category": "Top", "colors": ["white"]},
        {"id": "w-bot", "title": "White Linen Pants", "category": "Bottom", "colors": ["white"]},
        {"id": "w-sho", "title": "Light Beige Cotton Slip-ons", "category": "Shoes", "colors": ["beige"]},
        {"id": "b-top", "title": "Black Formal Shirt", "category": "Top", "colors": ["black"]},
    ]

    # Simulate an LLM hallucinating a black shirt for a Hindu funeral
    simulated_advice = {
        "reasoning_summary": "Here is an outfit for the funeral.",
        "spoken_reply": "Here is what you should wear to the ceremony.",
        "outfit_recommendations": [
            {
                "name": "Funeral Look",
                "items": [
                    {"role": "top", "closet_item_id": "b-top", "name": "Black Formal Shirt"},
                    {"role": "bottom", "closet_item_id": "w-bot", "name": "White Linen Pants"},
                    {"role": "shoes", "closet_item_id": "w-sho", "name": "Light Beige Cotton Slip-ons"},
                ],
                "why": "Wearing a black formal shirt and white pants for the funeral.",
            }
        ],
    }

    reviewed = await evaluate_and_authorize_outfit(
        user_text="attending Hindu cremation ceremony antyeshti",
        advice_payload=simulated_advice,
        all_closet_items=all_closet,
    )

    # Verify QA dropped the black shirt and replaced it with compliant white shirt
    outfit_items = reviewed["outfit_recommendations"][0]["items"]
    top_item = next(it for it in outfit_items if it["role"] == "top")
    assert top_item["closet_item_id"] == "w-top"
    assert "White Cotton" in top_item["name"]

    # Verify cultural_audit block was emitted
    assert "cultural_audit" in reviewed
    assert reviewed["cultural_audit"]["status"] == "authorized"
    assert "rule_cultural_hindu_antyeshti" in reviewed["cultural_audit"]["active_axioms"]
    assert any("Replaced top" in note for note in reviewed["cultural_audit"]["qa_replacements"])
