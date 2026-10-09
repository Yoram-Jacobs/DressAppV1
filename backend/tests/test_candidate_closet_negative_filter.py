import pytest
from app.services.stylist_qa_engine import (
    validate_garment_against_negative_constraints,
    filter_candidate_closet_by_axioms,
    evaluate_and_authorize_outfit,
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


@pytest.mark.anyio
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


@pytest.mark.anyio
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


def test_church_mass_bethlehem_negative_constraints_purges_graphic_tee_and_shorts():
    axioms = retrieve_fashion_axioms(user_text="השילוב לכנסיית חג המולד בבית לחם", top_k=4)
    church_rule = next((r for r in axioms if r.id == "rule_cultural_christian_church_mass"), None)
    assert church_rule is not None, "Church & sanctuary rule must be retrieved for Bethlehem Church"

    # 1. Red Tribal Graphic Crew-neck Tee -> must be rejected
    red_graphic_tee = {
        "id": "t1",
        "title": "Red Tribal Graphic Crew-neck Tee",
        "category": "Top",
        "pattern": "graphic",
        "tags": ["graphic", "tribal", "eagle"],
        "colors": ["red"],
    }
    is_valid, reason = validate_garment_against_negative_constraints(red_graphic_tee, church_rule, role="top")
    assert not is_valid
    assert "graphic" in reason.lower() or "eagle" in reason.lower()

    # 2. Shorts -> must be rejected
    shorts = {"id": "b1", "title": "Bermuda Cargo Shorts", "category": "Bottom", "colors": ["khaki"]}
    is_valid, reason = validate_garment_against_negative_constraints(shorts, church_rule, role="bottom")
    assert not is_valid
    assert "shorts" in reason.lower()

    # 3. Flip flops -> must be rejected
    flip_flops = {"id": "s1", "title": "Beach Flip Flops", "category": "Shoes", "colors": ["blue"]}
    is_valid, reason = validate_garment_against_negative_constraints(flip_flops, church_rule, role="shoes")
    assert not is_valid
    assert "flip-flop" in reason.lower()

    # 4. Button-down shirt & tailored trousers -> compliant!
    oxford_shirt = {"id": "t2", "title": "Crisp White Oxford Button Down", "category": "Top", "colors": ["white"]}
    tailored_pants = {"id": "b2", "title": "Charcoal Tailored Trousers", "category": "Bottom", "colors": ["charcoal"]}
    loafers = {"id": "s2", "title": "Dark Brown Leather Loafers", "category": "Shoes", "colors": ["brown"]}

    assert validate_garment_against_negative_constraints(oxford_shirt, church_rule, role="top")[0]
    assert validate_garment_against_negative_constraints(tailored_pants, church_rule, role="bottom")[0]
    assert validate_garment_against_negative_constraints(loafers, church_rule, role="shoes")[0]

    # 5. Candidate pre-filter purges non-compliant garments BEFORE LLM inference
    closet = [red_graphic_tee, shorts, flip_flops, oxford_shirt, tailored_pants, loafers]
    compliant, purged = filter_candidate_closet_by_axioms(closet, axioms)
    purged_ids = [it["id"] for it in purged]
    compliant_ids = [it["id"] for it in compliant]

    assert "t1" in purged_ids, "Red Tribal Graphic Crew-neck Tee MUST be purged before inference"
    assert "b1" in purged_ids, "Shorts MUST be purged before inference"
    assert "s1" in purged_ids, "Flip flops MUST be purged before inference"
    assert "t2" in compliant_ids
    assert "b2" in compliant_ids
    assert "s2" in compliant_ids


def test_hebrew_machine_translation_gibberish_sanitization():
    from app.services.gemini_stylist import sanitize_stylist_text

    # 1. "שילוב מונה" cleaning
    raw_title = "שילוב מונה הולם לכנסיית חג המולד"
    clean_title = sanitize_stylist_text(raw_title, lang="he")
    assert "מונה" not in clean_title
    assert "שילוב" in clean_title

    # 2. "השילוב מונה מושלם" and "ועקבות נוחות"
    raw_spoken = "השילוב מונה מושלם לכנסיית חג המולד בבית לחם. הגדולה היא חולצת טי עם הדפס נשר, עם כפתורים כחולים ושרוול קצר, ועקבות נוחות."
    clean_spoken = sanitize_stylist_text(raw_spoken, lang="he")
    assert "מונה" not in clean_spoken
    assert "עקבות נוחות" not in clean_spoken
    assert "ונעליים נוחות" in clean_spoken
    assert "הפריט המרכזי הוא" in clean_spoken

    # 3. Do/Don't machine translation fixes ("מפוחיות פנים", "חולצות קצרים או מכנסיים")
    raw_dd = "אין ללבוש חולצות קצרים או מכנסיים, כובעים, או אביזרים מפוחיות פנים"
    clean_dd = sanitize_stylist_text(raw_dd, lang="he")
    assert "מפוחיות פנים" not in clean_dd
    assert "כיסויי פנים" in clean_dd
    assert "חולצות קצרות או מכנסיים קצרים" in clean_dd


def test_buddhist_temple_saffron_taboo_and_modesty():
    axioms = retrieve_fashion_axioms(user_text="Visiting Wat Phra Kaew Buddhist temple Bangkok", top_k=3)
    buddhist_rule = next((r for r in axioms if r.id == "rule_cultural_buddhist_temple_etiquette"), None)
    assert buddhist_rule is not None, "Buddhist temple rule must be retrieved"

    # Saffron monk robe / orange tunic -> strictly forbidden for lay visitors
    saffron_top = {
        "id": "s-monk",
        "title": "Saffron Orange Linen Tunic Robe",
        "category": "Top",
        "colors": ["orange"],
        "tags": ["saffron", "tunic"],
    }
    is_valid, reason = validate_garment_against_negative_constraints(saffron_top, buddhist_rule, role="top")
    assert not is_valid
    assert "monks" in reason.lower()

    # Tank top -> forbidden (bare shoulders)
    tank_top = {"id": "t-tank", "title": "Summer Sleeveless Tank Top", "category": "Top", "colors": ["white"]}
    is_valid, reason = validate_garment_against_negative_constraints(tank_top, buddhist_rule, role="top")
    assert not is_valid
    assert "sleeveless" in reason.lower()

    # Modest navy linen trousers -> compliant!
    modest_pants = {"id": "b-linen", "title": "Wide Leg Navy Linen Trousers", "category": "Bottom", "colors": ["navy"]}
    is_valid, reason = validate_garment_against_negative_constraints(modest_pants, buddhist_rule, role="bottom")
    assert is_valid


def test_sikh_gurdwara_head_covering_and_no_caps():
    axioms = retrieve_fashion_axioms(user_text="Visiting Golden Temple Sikh Gurdwara Amritsar", top_k=3)
    gurdwara_rule = next((r for r in axioms if r.id == "rule_cultural_sikh_gurdwara_protocol"), None)
    assert gurdwara_rule is not None, "Sikh Gurdwara rule must be retrieved"

    # Baseball cap -> strictly forbidden (must use cloth Rumal or Dastar)
    baseball_cap = {"id": "h-cap", "title": "NY Yankees Baseball Cap", "category": "Accessory", "sub_category": "headwear"}
    is_valid, reason = validate_garment_against_negative_constraints(baseball_cap, gurdwara_rule, role="headwear")
    assert not is_valid
    assert "rumāl" in reason.lower() or "dastar" in reason.lower() or "baseball" in reason.lower()

    # Shorts -> strictly forbidden
    shorts = {"id": "b-shorts", "title": "Khaki Cargo Shorts", "category": "Bottom", "colors": ["khaki"]}
    is_valid, reason = validate_garment_against_negative_constraints(shorts, gurdwara_rule, role="bottom")
    assert not is_valid


def test_hindu_temple_darshan_purges_leather_articles():
    axioms = retrieve_fashion_axioms(user_text="Hindu temple darshan and puja mandir", top_k=3)
    darshan_rule = next((r for r in axioms if r.id == "rule_cultural_hindu_temple_darshan"), None)
    assert darshan_rule is not None, "Hindu temple darshan rule must be retrieved"

    # Leather belt -> strictly purged
    leather_belt = {"id": "a-belt", "title": "Genuine Brown Leather Belt", "category": "Accessory", "material": "leather"}
    is_valid, reason = validate_garment_against_negative_constraints(leather_belt, darshan_rule, role="belt")
    assert not is_valid
    assert "leather" in reason.lower()

    # Leather loafers -> strictly purged
    leather_shoes = {"id": "s-shoes", "title": "Calfskin Leather Loafers", "category": "Shoes", "material": "leather"}
    is_valid, reason = validate_garment_against_negative_constraints(leather_shoes, darshan_rule, role="shoes")
    assert not is_valid


def test_chinese_green_hat_taboo_purged_for_men():
    axioms = retrieve_fashion_axioms(user_text="Styling a Chinese man for autumn street style with a green hat", top_k=3)
    green_hat_rule = next((r for r in axioms if r.id == "rule_cultural_chinese_green_hat_taboo"), None)
    assert green_hat_rule is not None, "Chinese green hat taboo rule must be retrieved"

    # Green beanie / cap -> strictly purged
    green_beanie = {"id": "h-green", "title": "Forest Green Knit Beanie", "category": "Accessory", "colors": ["green"]}
    is_valid, reason = validate_garment_against_negative_constraints(green_beanie, green_hat_rule, role="headwear")
    assert not is_valid
    assert "dài lǜ màozi" in reason.lower() or "green hats" in reason.lower()

    # Black beanie -> compliant!
    black_beanie = {"id": "h-black", "title": "Charcoal Black Knit Beanie", "category": "Accessory", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(black_beanie, green_hat_rule, role="headwear")
    assert is_valid


def test_vatican_papal_audience_purges_white_dress():
    axioms = retrieve_fashion_axioms(user_text="Private papal audience at the Vatican with the Pope", top_k=3)
    vatican_rule = next((r for r in axioms if r.id == "rule_cultural_vatican_papal_audience"), None)
    assert vatican_rule is not None, "Vatican papal audience rule must be retrieved"

    # White cocktail dress -> strictly forbidden (Privilège du blanc reserved for Catholic queens)
    white_dress = {"id": "d-white", "title": "White Silk Crepe Midi Dress", "category": "Dress", "colors": ["white"]}
    is_valid, reason = validate_garment_against_negative_constraints(white_dress, vatican_rule, role="dress")
    assert not is_valid
    assert "privilège du blanc" in reason.lower() or "white dresses" in reason.lower()

    # Black midi dress -> compliant!
    black_dress = {"id": "d-black", "title": "Long-Sleeved Black Crepe Formal Midi Dress", "category": "Dress", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(black_dress, vatican_rule, role="dress")
    assert is_valid


def test_yom_kippur_and_tisha_bav_purges_leather_footwear():
    axioms = retrieve_fashion_axioms(user_text="יום כיפור תפילה נעילת הסנדל", top_k=3)
    yom_kippur_rule = next((r for r in axioms if r.id == "rule_cultural_jewish_tisha_bav_fast"), None)
    assert yom_kippur_rule is not None, "Yom Kippur / Tisha B'Av rule must be retrieved"

    # Leather shoes -> strictly purged
    leather_derby = {"id": "s-leather", "title": "Brown Leather Derby Shoes", "category": "Shoes", "material": "leather"}
    is_valid, reason = validate_garment_against_negative_constraints(leather_derby, yom_kippur_rule, role="shoes")
    assert not is_valid
    assert "leather" in reason.lower()

    # Canvas shoes -> compliant!
    canvas_sneakers = {"id": "s-canvas", "title": "White Canvas Slip-on Shoes", "category": "Shoes", "material": "canvas", "colors": ["white"]}
    is_valid, reason = validate_garment_against_negative_constraints(canvas_sneakers, yom_kippur_rule, role="shoes")
    assert is_valid


def test_sigd_holiday_purges_graphic_eagle_tee_and_black_clothes():
    """Verify that asking for Sigd retrieves rule_cultural_jewish_sigd and purges graphic tees, eagle prints, and black clothes."""
    axioms = retrieve_fashion_axioms(user_text="לבוש לחג הסיגד", top_k=3)
    sigd_rule = next((r for r in axioms if r.id == "rule_cultural_jewish_sigd"), None)
    assert sigd_rule is not None, "Sigd rule must be retrieved for 'לבוש לחג הסיגד'"

    # 1. Red tee with eagle print (as seen in user screenshot) -> strictly purged!
    eagle_tee = {
        "id": "t-eagle",
        "title": "Classic Crew-neck Tee",
        "description": "חולצת טי עם הדפס נשר ותכלית, צבע בורדו",
        "category": "Top",
        "pattern": "graphic",
        "colors": ["red", "burgundy"],
    }
    is_valid, reason = validate_garment_against_negative_constraints(eagle_tee, sigd_rule, role="top")
    assert not is_valid
    assert "graphic" in reason.lower() or "eagle" in reason.lower() or "sigd" in reason.lower()

    # 2. Black pants -> strictly purged (mourning color on Sigd)
    black_pants = {"id": "p-black", "title": "מכנסיים מחויטים שחורים", "category": "Bottom", "colors": ["black"]}
    is_valid, reason = validate_garment_against_negative_constraints(black_pants, sigd_rule, role="bottom")
    assert not is_valid
    assert "black" in reason.lower()

    # 3. Clean white linen shirt -> compliant!
    white_shirt = {"id": "s-white", "title": "חולצת פשתן לבנה חגיגית", "category": "Top", "colors": ["white"], "material": "linen"}
    is_valid, reason = validate_garment_against_negative_constraints(white_shirt, sigd_rule, role="top")
    assert is_valid
    assert reason is None


def test_sinck_tuck_arctic_retrieval_and_validation():
    """Verify that asking for Sinck Tuck retrieves rule_cultural_inuit_sinck_tuck and purges non-insulated footwear/clothes."""
    axioms = retrieve_fashion_axioms(user_text="what to wear to Sinck Tuck", top_k=3)
    sinck_tuck_rule = next((r for r in axioms if r.id == "rule_cultural_inuit_sinck_tuck"), None)
    assert sinck_tuck_rule is not None, "Sinck Tuck rule must be retrieved for 'what to wear to Sinck Tuck'"

    # Canvas sneakers -> strictly purged in Arctic winter conditions
    canvas_shoes = {"id": "sh-canvas", "title": "Low Top Canvas Sneakers", "category": "Shoes", "material": "canvas"}
    is_valid, reason = validate_garment_against_negative_constraints(canvas_shoes, sinck_tuck_rule, role="shoes")
    assert not is_valid
    assert "canvas" in reason.lower() or "sneakers" in reason.lower() or "arctic" in reason.lower()

    # Insulated parka / Kamiks -> compliant!
    kamiks = {"id": "sh-kamik", "title": "Sealskin Kamiks Winter Boots", "category": "Shoes", "material": "shearling"}
    is_valid, reason = validate_garment_against_negative_constraints(kamiks, sinck_tuck_rule, role="shoes")
    assert is_valid


def test_songkran_purges_silk_and_sheer():
    """Verify that Songkran water festival purges delicate silk and sheer garments."""
    axioms = retrieve_fashion_axioms(user_text="Songkran festival in Chiang Mai", top_k=3)
    songkran_rule = next((r for r in axioms if r.id == "rule_cultural_thai_songkran"), None)
    assert songkran_rule is not None, "Songkran rule must be retrieved"

    # Silk shirt -> strictly purged (water ruin)
    silk_shirt = {"id": "s-silk", "title": "Luxury Silk Button-down Shirt", "category": "Top", "material": "silk"}
    is_valid, reason = validate_garment_against_negative_constraints(silk_shirt, songkran_rule, role="top")
    assert not is_valid
    assert "silk" in reason.lower()

    # Floral cotton shirt -> compliant!
    floral_shirt = {"id": "s-floral", "title": "Bright Floral Tropical Cotton Shirt", "category": "Top", "material": "cotton", "colors": ["multi"]}
    is_valid, reason = validate_garment_against_negative_constraints(floral_shirt, songkran_rule, role="top")
    assert is_valid


def test_holi_purges_silk_and_leather():
    """Verify that Holi festival purges expensive silk and leather footwear."""
    axioms = retrieve_fashion_axioms(user_text="outfit for Holi festival celebration", top_k=3)
    holi_rule = next((r for r in axioms if r.id == "rule_cultural_hindu_holi"), None)
    assert holi_rule is not None, "Holi rule must be retrieved"

    # Silk kurta -> strictly purged
    silk_kurta = {"id": "k-silk", "title": "Pure Raw Silk Kurta", "category": "Top", "material": "silk"}
    is_valid, reason = validate_garment_against_negative_constraints(silk_kurta, holi_rule, role="top")
    assert not is_valid
    assert "silk" in reason.lower()

    # Leather loafers -> strictly purged
    leather_loafers = {"id": "sh-leather", "title": "Brown Leather Loafers", "category": "Shoes", "material": "leather"}
    is_valid, reason = validate_garment_against_negative_constraints(leather_loafers, holi_rule, role="shoes")
    assert not is_valid
    assert "leather" in reason.lower()

    # Inexpensive plain white cotton kurta -> compliant!
    white_cotton_kurta = {"id": "k-cotton", "title": "Plain White Cotton Kurta", "category": "Top", "material": "cotton", "colors": ["white"]}
    is_valid, reason = validate_garment_against_negative_constraints(white_cotton_kurta, holi_rule, role="top")
    assert is_valid


def test_qa_evaluates_sigd_replaces_red_eagle_tee_with_white_shirt():
    """Verify that evaluate_and_authorize_outfit strips a red eagle graphic tee when styled for Sigd and replaces it with a compliant white shirt."""
    import asyncio

    closet = [
        {
            "id": "t-eagle",
            "title": "Classic Crew-neck Tee",
            "description": "חולצת טי עם הדפס נשר ותכלית, צבע בורדו",
            "category": "Top",
            "pattern": "graphic",
            "colors": ["red", "burgundy"],
        },
        {
            "id": "s-white",
            "title": "חולצת פשתן לבנה חגיגית",
            "description": "חולצה מכופתרת לבנה קלאסית",
            "category": "Top",
            "pattern": "solid",
            "colors": ["white"],
            "material": "linen",
        },
        {
            "id": "p-light",
            "title": "מכנסי צ'ינו בהירים",
            "category": "Bottom",
            "colors": ["beige"],
        },
        {
            "id": "sh-clean",
            "title": "נעלי מוקסין חומות בהירות",
            "category": "Shoes",
            "colors": ["tan"],
        },
    ]

    # Raw advice payload where LLM hallucinates/selects the red eagle tee
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "מראה לחג הסיגד",
                "items": [
                    {"role": "top", "name": "Classic Crew-neck Tee", "closet_item_id": "t-eagle"},
                    {"role": "bottom", "name": "מכנסי צ'ינו בהירים", "closet_item_id": "p-light"},
                    {"role": "shoes", "name": "נעלי מוקסין חומות בהירות", "closet_item_id": "sh-clean"},
                ],
                "why": "מראה חגיגי ומכובד",
            }
        ]
    }

    reviewed = asyncio.run(
        evaluate_and_authorize_outfit(
            user_text="לבוש לחג הסיגד",
            advice_payload=raw_advice,
            all_closet_items=closet,
            user_profile={"preferred_language": "he", "sex": "male"},
        )
    )

    rec = reviewed["outfit_recommendations"][0]
    top_item = next(it for it in rec["items"] if it.get("role") == "top")
    # Red eagle tee MUST be replaced with white shirt
    assert top_item["closet_item_id"] == "s-white"
    assert "t-eagle" not in [it.get("closet_item_id") for it in rec["items"]]
    assert reviewed.get("qa_authorized") is True


def test_gender_closet_filtering_and_cross_gender_rejection():
    import asyncio
    from app.services.fashion_rules_rag import filter_gender_closet_items
    from app.services.stylist_qa_engine import evaluate_and_authorize_outfit

    closet = [
        {"id": "skirt-1", "title": "Mini Skirt", "category": "skirt", "gender": "women", "colors": ["black"]},
        {"id": "dress-1", "title": "Floral Summer Dress", "category": "dress", "gender": "female", "colors": ["pink"]},
        {"id": "polo-1", "title": "White Pique Polo", "category": "top", "gender": "men", "colors": ["white"]},
        {"id": "jeans-1", "title": "Classic Chino Pants", "category": "bottom", "gender": "men", "colors": ["navy"]},
        {"id": "shoes-1", "title": "Leather Loafers", "category": "shoes", "gender": "men", "colors": ["brown"]},
    ]

    # 1. Male filtering test
    male_filtered = filter_gender_closet_items(closet, "male")
    filtered_ids = {it["id"] for it in male_filtered}
    assert "skirt-1" not in filtered_ids
    assert "dress-1" not in filtered_ids
    assert "polo-1" in filtered_ids
    assert "jeans-1" in filtered_ids

    # 2. Female filtering test
    female_filtered = filter_gender_closet_items(closet, "female")
    female_ids = {it["id"] for it in female_filtered}
    assert "polo-1" not in female_ids
    assert "skirt-1" in female_ids

    # 3. QA Engine cross-gender replacement test for male user given mini skirt
    bad_advice = {
        "outfit_recommendations": [
            {
                "name": "מראה חגיגי",
                "items": [
                    {"role": "top", "name": "White Pique Polo", "closet_item_id": "polo-1"},
                    {"role": "bottom", "name": "Mini Skirt", "closet_item_id": "skirt-1"},
                    {"role": "shoes", "name": "Leather Loafers", "closet_item_id": "shoes-1"},
                ],
                "why": "שילוב נוח",
            }
        ]
    }

    reviewed = asyncio.run(
        evaluate_and_authorize_outfit(
            user_text="אאוטפיט לפגישה עסקית",
            advice_payload=bad_advice,
            all_closet_items=closet,
            user_profile={"preferred_language": "he", "sex": "male", "gender": "male"},
        )
    )

    rec = reviewed["outfit_recommendations"][0]
    bottom_item = next(it for it in rec["items"] if it.get("role") == "bottom")
    # Mini skirt MUST be replaced with male bottoms (chino pants)
    assert bottom_item["closet_item_id"] == "jeans-1"
    assert "skirt-1" not in [it.get("closet_item_id") for it in rec["items"]]
    assert reviewed.get("qa_authorized") is True





