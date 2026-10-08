import pytest
from app.services.stylist_qa_engine import (
    evaluate_and_authorize_outfit,
    find_best_garment_replacement,
    sanitize_spoken_reply_and_notes,
)
from app.services.fashion_rules_rag import filter_gender_closet_items
from app.services.stylist_scheduler_brain import (
    calculate_garment_style_score,
    get_rotation_prioritized_closet,
)


@pytest.fixture
def sample_user_closet():
    return [
        {
            "id": "pant-dress-1",
            "title": "Men's Charcoal Gray Dress Pants",
            "category": "Bottom",
            "sub_category": "Pants",
            "tags": ["trousers", "menswear", "formal", "tailored", "charcoal", "gray"],
            "dress_code": "business",
        },
        {
            "id": "pant-shorts-1",
            "title": "Cargo Pocketed Shorts",
            "category": "Bottom",
            "sub_category": "Shorts",
            "tags": ["shorts", "casual", "summer"],
            "dress_code": "casual",
        },
        {
            "id": "shirt-btn-1",
            "title": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
            "category": "Top",
            "sub_category": "Shirt",
            "tags": ["button down", "blue", "short sleeve"],
            "dress_code": "smart casual",
        },
        {
            "id": "boots-blk-1",
            "title": "Sturdy Black Leather Australian Pull-On Boots",
            "category": "Footwear",
            "sub_category": "Boots",
            "tags": ["boots", "leather", "black"],
            "dress_code": "casual",
        },
        {
            "id": "tie-blk-1",
            "title": "Solid Black Textured Necktie",
            "category": "Accessories",
            "sub_category": "Tie",
            "tags": ["necktie", "black", "silk"],
            "dress_code": "formal",
        },
    ]


def test_male_dress_pants_and_shirts_not_disqualified():
    dress_pants = {
        "id": "p-1",
        "title": "Men's Charcoal Gray Dress Pants",
        "category": "Bottom",
        "sub_category": "Pants",
        "tags": ["formal", "dress code", "menswear"],
    }
    dress_shirt = {
        "id": "s-1",
        "title": "Solid Lavender Long-Sleeve Dress Shirt",
        "category": "Top",
        "sub_category": "Shirt",
        "tags": ["formal", "dress shirt"],
    }
    # 1. Neither should be pruned by gender filter for male users
    filtered = filter_gender_closet_items([dress_pants, dress_shirt], "male")
    assert len(filtered) == 2

    # 2. Both should receive positive or zero scores, NEVER -100
    score_p = calculate_garment_style_score(dress_pants, "לבוש הולם לשבעה", user_gender="male")
    assert score_p > 0  # Mourning dark pants boost
    score_s = calculate_garment_style_score(dress_shirt, "לבוש לעבודה", user_gender="male")
    assert score_s >= 0


def test_qa_replaces_unmapped_bottom_and_prevents_naked_mannequin(sample_user_closet):
    import asyncio
    # Simulates the bug where LLM recommended shirt with adfa ID, but bottom had id: None
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "תלבושת מכובדת לשבעה",
                "items": [
                    {
                        "role": "top",
                        "name": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
                        "closet_item_id": "shirt-btn-1",
                    },
                    {
                        "role": "bottom",
                        "name": "מכנסיים מחויטים בצבע כהה, נוחים ורגליים",
                        "closet_item_id": None,
                    },
                    {
                        "role": "shoes",
                        "name": "נעליים דובון עם סוליה שחורה",
                        "closet_item_id": None,
                    },
                ],
            }
        ]
    }

    user_profile = {"sex": "male", "preferred_language": "he"}
    prompt = "לבוש הולם לביקור משפחה של חבר בשבעה"

    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text=prompt,
        advice_payload=raw_advice,
        all_closet_items=sample_user_closet,
        user_profile=user_profile,
    ))

    rec = reviewed["outfit_recommendations"][0]
    assert rec["qa_status"] == "authorized"

    items_by_role = {it["role"]: it for it in rec["items"]}
    # Bottom must be replaced by Men's Charcoal Gray Dress Pants
    assert "bottom" in items_by_role
    assert items_by_role["bottom"]["closet_item_id"] == "pant-dress-1"
    assert "Dress Pants" in items_by_role["bottom"]["name"]

    # Shoes must be replaced by Sturdy Black Leather Boots
    assert "shoes" in items_by_role
    assert items_by_role["shoes"]["closet_item_id"] == "boots-blk-1"


def test_qa_replaces_mourning_violating_shorts(sample_user_closet):
    import asyncio
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "שילוב קיצי",
                "items": [
                    {
                        "role": "top",
                        "name": "חולצת כפתורים",
                        "closet_item_id": "shirt-btn-1",
                    },
                    {
                        "role": "bottom",
                        "name": "Cargo Pocketed Shorts",
                        "closet_item_id": "pant-shorts-1",  # Forbidden for Shiva!
                    },
                ],
            }
        ]
    }

    user_profile = {"sex": "male", "preferred_language": "he"}
    prompt = "לבוש הולם לביקור משפחה של חבר בשבעה"

    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text=prompt,
        advice_payload=raw_advice,
        all_closet_items=sample_user_closet,
        user_profile=user_profile,
    ))

    rec = reviewed["outfit_recommendations"][0]
    items_by_role = {it["role"]: it for it in rec["items"]}
    # Shorts must have been replaced with dress pants
    assert items_by_role["bottom"]["closet_item_id"] == "pant-dress-1"



def test_sanitize_spoken_reply_and_notes():
    payload = {
        "spoken_reply": "הו, ללבוש הולם לביקור משפחה בשבעה, אני ממליץ על תלבושת שמתאימה לשעות החמה והרמדונות. הכוונה היא לביקור משפחה או, המבוססת על נוחות ושמרניות.",
        "outfit_recommendations": [
            {
                "designer_notes": {
                    "color_harmony": "60-30-10 כחול אדום, אפור בהיר וסגול",
                    "texture_balance": "Ratio 1:2 שרוול קצר ושרוול קצרים, מטוטל ורגליים",
                    "silhouette": "כפתורים קצרים עם חגורת גב",
                }
            }
        ],
        "do_dont": [
            "אין ללבוש ללבוש צבעים חמים או מפוחים, כמו אדום או זהב",
            "אין ללבוש ללבוש מזון או מפרים",
        ],
    }

    sanitize_spoken_reply_and_notes(payload, user_text="לבוש הולם לשבעה", lang="he")

    # Ramadan and broken sentence removed
    assert "והרמדונות" not in payload["spoken_reply"]
    assert "לשעות היום" in payload["spoken_reply"]

    # Red removed from mourning color harmony
    notes = payload["outfit_recommendations"][0]["designer_notes"]
    assert "אדום" not in notes["color_harmony"]

    # Garbled texture & silhouette cleaned
    assert "מטוטל" not in notes["texture_balance"]
    assert "כפתורים קצרים" not in notes["silhouette"]

    # Double prefix fixed and food entry pruned
    assert len(payload["do_dont"]) == 1
    assert "אין ללבוש ללבוש" not in payload["do_dont"][0]
    assert payload["do_dont"][0].startswith("אין ללבוש צבעים")


def test_full_closet_metadata_search_performance():
    import time
    # Simulate a full wardrobe of 150 items
    large_closet = []
    for i in range(50):
        large_closet.append({
            "id": f"top-{i}",
            "title": f"Casual T-Shirt {i}",
            "category": "Top",
            "tags": ["casual", "tee"],
        })
        large_closet.append({
            "id": f"bottom-{i}",
            "title": f"Casual Shorts {i}",
            "category": "Bottom",
            "tags": ["shorts", "casual"],
        })
        large_closet.append({
            "id": f"shoes-{i}",
            "title": f"Casual Sneakers {i}",
            "category": "Footwear",
            "tags": ["sneakers"],
        })
    # Add one formal mourning compliant dress pants
    large_closet.append({
        "id": "target-dress-pants",
        "title": "Men's Charcoal Gray Dress Pants",
        "category": "Bottom",
        "sub_category": "Pants",
        "tags": ["formal", "trousers", "charcoal", "gray"],
        "dress_code": "business",
    })

    t0 = time.perf_counter()
    best_bottom = find_best_garment_replacement(
        role="bottom",
        all_closet_items=large_closet,
        user_text="לבוש הולם לביקור משפחה של חבר בשבעה",
        user_gender="male",
        exclude_item_ids=set(),
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000

    # Must accurately find the dress pants
    assert best_bottom is not None
    assert best_bottom["id"] == "target-dress-pants"
    # Must be lightning fast (under 25ms for 150 items)
    assert elapsed_ms < 25.0


def test_qa_drops_pants_mistakenly_tagged_as_top():
    import asyncio
    closet = [
        {
            "id": "cargo-pants-1",
            "title": "grid-patterned utility cargo pants",
            "category": "Top",  # Mistakenly tagged as Top
            "tags": ["חלק עליון", "אפור", "משובץ"],
        },
        {
            "id": "brown-jeans-1",
            "title": "Vintage Washed Brown Jeans",
            "category": "Bottom",
            "sub_category": "Jeans",
            "tags": ["brown", "jeans", "denim"],
        },
        {
            "id": "white-tee-1",
            "title": "Classic White Cotton Crewneck T-Shirt",
            "category": "Top",
            "sub_category": "T-Shirt",
            "tags": ["t-shirt", "white", "tee", "top"],
        },
        {
            "id": "shoes-1",
            "title": "Brown Leather Loafers",
            "category": "Footwear",
            "sub_category": "Loafers",
            "tags": ["brown", "loafers", "shoes"],
        },
    ]

    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Casual Streetwear",
                "items": [
                    {
                        "role": "top",
                        "name": "grid-patterned utility cargo pants",
                        "closet_item_id": "cargo-pants-1",
                    },
                    {
                        "role": "bottom",
                        "name": "Vintage Washed Brown Jeans",
                        "closet_item_id": "brown-jeans-1",
                    },
                    {
                        "role": "shoes",
                        "name": "Brown Leather Loafers",
                        "closet_item_id": "shoes-1",
                    },
                ],
            }
        ]
    }

    user_profile = {"sex": "male", "preferred_language": "he"}
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="תרכיב לי לוק יומיומי מגניב",
        advice_payload=raw_advice,
        all_closet_items=closet,
        user_profile=user_profile,
    ))

    rec = reviewed["outfit_recommendations"][0]
    assert rec["qa_status"] == "authorized"

    items_by_role = {it["role"]: it for it in rec["items"]}
    # 1. Top MUST NOT be the cargo pants!
    assert items_by_role["top"]["closet_item_id"] != "cargo-pants-1"
    # 2. Top must be replaced by the authentic top from the closet
    assert items_by_role["top"]["closet_item_id"] == "white-tee-1"
    assert "T-Shirt" in items_by_role["top"]["name"]

    # 3. Bottom remains the brown jeans
    assert items_by_role["bottom"]["closet_item_id"] == "brown-jeans-1"

    # 4. Outfit must NOT contain multiple bottoms
    assert len(rec["items"]) == 3
    assert "cargo" not in items_by_role["top"]["name"].lower()


def test_qa_drops_pants_from_top_when_no_replacement_available():
    import asyncio
    # Closet has ONLY pants and shoes, NO tops
    closet = [
        {
            "id": "cargo-pants-1",
            "title": "grid-patterned utility cargo pants",
            "category": "Top",  # Mistakenly tagged as Top!
            "tags": ["חלק עליון", "אפור", "משובץ"],
        },
        {
            "id": "brown-jeans-1",
            "title": "Vintage Washed Brown Jeans",
            "category": "Bottom",
        },
        {
            "id": "shoes-1",
            "title": "Brown Leather Loafers",
            "category": "Footwear",
        },
    ]

    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Casual Streetwear",
                "items": [
                    {
                        "role": "top",
                        "name": "grid-patterned utility cargo pants",
                        "closet_item_id": "cargo-pants-1",
                    },
                    {
                        "role": "bottom",
                        "name": "Vintage Washed Brown Jeans",
                        "closet_item_id": "brown-jeans-1",
                    },
                    {
                        "role": "shoes",
                        "name": "Brown Leather Loafers",
                        "closet_item_id": "shoes-1",
                    },
                ],
            }
        ]
    }

    user_profile = {"sex": "male", "preferred_language": "he"}
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="לוק יומיומי",
        advice_payload=raw_advice,
        all_closet_items=closet,
        user_profile=user_profile,
    ))

    rec = reviewed["outfit_recommendations"][0]
    # Cargo pants MUST be dropped from top role!
    items_by_role = {it["role"]: it for it in rec["items"]}
    assert "top" not in items_by_role
    assert "bottom" in items_by_role
    assert items_by_role["bottom"]["closet_item_id"] == "brown-jeans-1"


def test_check_garment_role_mismatch_all_categories():
    from app.services.stylist_qa_engine import check_garment_role_mismatch

    # 1. Outerwear in bottom/shoes/accessories
    coat = {"title": "Wool Trench Coat", "category": "Outerwear"}
    assert check_garment_role_mismatch(coat, "bottom") is not None
    assert check_garment_role_mismatch(coat, "shoes") is not None
    assert check_garment_role_mismatch(coat, "accessory") is not None
    assert check_garment_role_mismatch(coat, "outerwear") is None

    # 2. Dress in bottom/shoes/accessories
    dress = {"title": "Summer Floral Maxi Dress", "category": "Dress"}
    assert check_garment_role_mismatch(dress, "bottom") is not None
    assert check_garment_role_mismatch(dress, "shoes") is not None
    assert check_garment_role_mismatch(dress, "top") is not None
    assert check_garment_role_mismatch(dress, "dress") is None

    # 3. Top in bottom/shoes/accessories
    shirt = {"title": "Classic Oxford Cotton Shirt", "category": "Top"}
    assert check_garment_role_mismatch(shirt, "bottom") is not None
    assert check_garment_role_mismatch(shirt, "shoes") is not None
    assert check_garment_role_mismatch(shirt, "accessory") is not None
    assert check_garment_role_mismatch(shirt, "top") is None

    # 4. Footwear in top/bottom/outerwear/accessories
    boots = {"title": "Chelsea Leather Boots", "category": "Footwear"}
    assert check_garment_role_mismatch(boots, "top") is not None
    assert check_garment_role_mismatch(boots, "bottom") is not None
    assert check_garment_role_mismatch(boots, "outerwear") is not None
    assert check_garment_role_mismatch(boots, "accessory") is not None
    assert check_garment_role_mismatch(boots, "shoes") is None

    # 5. Accessories in clothing/footwear slots
    hat = {"title": "Wool Fedora Hat", "category": "Accessories"}
    assert check_garment_role_mismatch(hat, "top") is not None
    assert check_garment_role_mismatch(hat, "bottom") is not None
    assert check_garment_role_mismatch(hat, "shoes") is not None
    assert check_garment_role_mismatch(hat, "belt") is not None
    assert check_garment_role_mismatch(hat, "headwear") is None


def test_qa_multi_outerwear_conflict_resolution():
    import asyncio
    closet = [
        {"id": "coat-1", "title": "Heavy Winter Trench Coat", "category": "Outerwear"},
        {"id": "jacket-1", "title": "Biker Leather Jacket", "category": "Outerwear"},
        {"id": "shirt-1", "title": "White T-Shirt", "category": "Top"},
        {"id": "pants-1", "title": "Blue Jeans", "category": "Bottom"},
        {"id": "shoes-1", "title": "White Sneakers", "category": "Footwear"},
    ]
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Layered Winter Look",
                "items": [
                    {"role": "top", "name": "White T-Shirt", "closet_item_id": "shirt-1"},
                    {"role": "bottom", "name": "Blue Jeans", "closet_item_id": "pants-1"},
                    {"role": "shoes", "name": "White Sneakers", "closet_item_id": "shoes-1"},
                    {"role": "outerwear", "name": "Heavy Winter Trench Coat", "closet_item_id": "coat-1"},
                    {"role": "outerwear", "name": "Biker Leather Jacket", "closet_item_id": "jacket-1"},
                ],
            }
        ]
    }
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="מעיל לחורף",
        advice_payload=raw_advice,
        all_closet_items=closet,
    ))
    rec = reviewed["outfit_recommendations"][0]
    outerwear_items = [it for it in rec["items"] if it.get("role") == "outerwear"]
    assert len(outerwear_items) == 1
    assert "Pruned duplicate outerwear" in rec["qa_notes"]


def test_qa_full_body_dress_colliding_with_bottom_separates():
    import asyncio
    closet = [
        {"id": "dress-1", "title": "Summer Floral Evening Dress", "category": "Dress"},
        {"id": "pants-1", "title": "Blue Jeans", "category": "Bottom"},
        {"id": "shoes-1", "title": "Strappy Heels", "category": "Footwear"},
    ]
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Summer Evening Look",
                "items": [
                    {"role": "dress", "name": "Summer Floral Evening Dress", "closet_item_id": "dress-1"},
                    {"role": "bottom", "name": "Blue Jeans", "closet_item_id": "pants-1"},  # Collision!
                    {"role": "shoes", "name": "Strappy Heels", "closet_item_id": "shoes-1"},
                ],
            }
        ]
    }
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="שמלת ערב לקיץ",
        advice_payload=raw_advice,
        all_closet_items=closet,
    ))
    rec = reviewed["outfit_recommendations"][0]
    roles = [it.get("role") for it in rec["items"]]
    assert "dress" in roles
    # Pants MUST be dropped when dress is active!
    assert "bottom" not in roles
    assert "Dropped colliding bottom" in rec["qa_notes"]


def test_qa_multi_top_conflict_resolution():
    import asyncio
    closet = [
        {"id": "tee-1", "title": "Plain White Crewneck Tee", "category": "Top"},
        {"id": "shirt-2", "title": "Black Graphic Tee", "category": "Top"},
        {"id": "pants-1", "title": "Chino Pants", "category": "Bottom"},
        {"id": "shoes-1", "title": "Loafers", "category": "Footwear"},
    ]
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Casual Day",
                "items": [
                    {"role": "top", "name": "Plain White Crewneck Tee", "closet_item_id": "tee-1"},
                    {"role": "top", "name": "Black Graphic Tee", "closet_item_id": "shirt-2"},
                    {"role": "bottom", "name": "Chino Pants", "closet_item_id": "pants-1"},
                    {"role": "shoes", "name": "Loafers", "closet_item_id": "shoes-1"},
                ],
            }
        ]
    }
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="חולצה יומיומית",
        advice_payload=raw_advice,
        all_closet_items=closet,
    ))
    rec = reviewed["outfit_recommendations"][0]
    top_items = [it for it in rec["items"] if it.get("role") == "top"]
    assert len(top_items) == 1
    assert "Pruned duplicate tops" in rec["qa_notes"]


def test_qa_multi_footwear_conflict_resolution():
    import asyncio
    closet = [
        {"id": "shirt-1", "title": "Classic Polo", "category": "Top"},
        {"id": "pants-1", "title": "Slim Jeans", "category": "Bottom"},
        {"id": "shoes-1", "title": "White Leather Sneakers", "category": "Footwear"},
        {"id": "shoes-2", "title": "Brown Leather Boots", "category": "Footwear"},
    ]
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Weekend Vibe",
                "items": [
                    {"role": "top", "name": "Classic Polo", "closet_item_id": "shirt-1"},
                    {"role": "bottom", "name": "Slim Jeans", "closet_item_id": "pants-1"},
                    {"role": "shoes", "name": "White Leather Sneakers", "closet_item_id": "shoes-1"},
                    {"role": "shoes", "name": "Brown Leather Boots", "closet_item_id": "shoes-2"},
                ],
            }
        ]
    }
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="סניקרס לסופש",
        advice_payload=raw_advice,
        all_closet_items=closet,
    ))
    rec = reviewed["outfit_recommendations"][0]
    shoe_items = [it for it in rec["items"] if it.get("role") in ("shoes", "footwear")]
    assert len(shoe_items) == 1
    assert "Pruned duplicate shoes" in rec["qa_notes"]


def test_qa_multi_accessory_sub_slots_conflict_resolution():
    import asyncio
    closet = [
        {"id": "shirt-1", "title": "Linen Shirt", "category": "Top"},
        {"id": "pants-1", "title": "Linen Shorts", "category": "Bottom"},
        {"id": "shoes-1", "title": "Espadrilles", "category": "Footwear"},
        {"id": "hat-1", "title": "Panama Straw Hat", "category": "Accessories"},
        {"id": "hat-2", "title": "Bucket Hat", "category": "Accessories"},
        {"id": "belt-1", "title": "Brown Braided Belt", "category": "Accessories"},
        {"id": "belt-2", "title": "Black Leather Belt", "category": "Accessories"},
    ]
    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Resort Style",
                "items": [
                    {"role": "top", "name": "Linen Shirt", "closet_item_id": "shirt-1"},
                    {"role": "bottom", "name": "Linen Shorts", "closet_item_id": "pants-1"},
                    {"role": "shoes", "name": "Espadrilles", "closet_item_id": "shoes-1"},
                    {"role": "headwear", "name": "Panama Straw Hat", "closet_item_id": "hat-1"},
                    {"role": "headwear", "name": "Bucket Hat", "closet_item_id": "hat-2"},
                    {"role": "belt", "name": "Brown Braided Belt", "closet_item_id": "belt-1"},
                    {"role": "belt", "name": "Black Leather Belt", "closet_item_id": "belt-2"},
                ],
            }
        ]
    }
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="לוק חופשה",
        advice_payload=raw_advice,
        all_closet_items=closet,
    ))
    rec = reviewed["outfit_recommendations"][0]
    headwear_items = [it for it in rec["items"] if "hat" in it.get("name", "").lower()]
    belt_items = [it for it in rec["items"] if "belt" in it.get("name", "").lower()]
    assert len(headwear_items) == 1
    assert len(belt_items) == 1
    assert "Pruned duplicate headwear" in rec["qa_notes"]
    assert "Pruned duplicate belt" in rec["qa_notes"]


def test_qa_handles_string_recommendations_and_notes():
    import asyncio
    closet = [
        {"id": "shirt-1", "title": "White T-Shirt", "category": "Top"},
        {"id": "pants-1", "title": "Blue Jeans", "category": "Bottom"},
        {"id": "shoes-1", "title": "White Sneakers", "category": "Footwear"},
    ]
    # Simulates LLM returning strings in outfit_recommendations and a string for designer_notes
    raw_advice = {
        "spoken_reply": "הנה המלצה נהדרת",
        "outfit_recommendations": [
            "Casual string note emitted by LLM",
            {
                "name": "Proper Look",
                "items": [
                    {"role": "top", "name": "White T-Shirt", "closet_item_id": "shirt-1"},
                    {"role": "bottom", "name": "Blue Jeans", "closet_item_id": "pants-1"},
                    {"role": "shoes", "name": "White Sneakers", "closet_item_id": "shoes-1"},
                ],
                "designer_notes": "Clean balanced silhouette",
            },
            "Another trailing string",
        ],
    }
    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text="לוק יפה",
        advice_payload=raw_advice,
        all_closet_items=closet,
    ))
    assert reviewed["qa_authorized"] is True
    # Non-dict recommendations must be safely pruned without AttributeError
    assert len(reviewed["outfit_recommendations"]) == 1
    assert reviewed["outfit_recommendations"][0]["name"] == "Proper Look"
    assert isinstance(reviewed["outfit_recommendations"][0]["designer_notes"], dict)


def test_qa_disqualifies_geometric_mesh_top_and_selects_blue_striped_shirt():
    import asyncio
    closet = [
        {
            "id": "mesh-top-1",
            "title": "Geometric Patterned Mesh Top",
            "category": "Top",
            "sub_category": "Top",
            "tags": ["mesh", "geometric", "patterned", "rave"],
            "pattern": "geometric",
            "material": "mesh",
        },
        {
            "id": "shirt-btn-1",
            "title": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
            "category": "Top",
            "sub_category": "Shirt",
            "tags": ["חולצה", "כפתורים", "כחולה", "פסים", "כחול"],
            "pattern": "striped",
            "dress_code": "smart casual",
        },
        {
            "id": "faded-cargo-1",
            "title": "Faded Olive Cargo Pants",
            "category": "Bottom",
            "sub_category": "Pants",
            "tags": ["cargo", "faded", "olive", "pants"],
            "dress_code": "casual",
        },
        {
            "id": "pant-dress-1",
            "title": "Men's Charcoal Gray Dress Pants",
            "category": "Bottom",
            "sub_category": "Pants",
            "tags": ["trousers", "formal", "tailored", "charcoal", "gray", "מחויט", "כהה"],
            "dress_code": "business",
        },
        {
            "id": "boots-blk-1",
            "title": "Sturdy Black Leather Boots",
            "category": "Footwear",
            "sub_category": "Boots",
            "tags": ["boots", "leather", "black"],
            "dress_code": "casual",
        },
    ]

    prompt = "לביקור משפחה בשבעה, המבוסס על אופנה מודרנית ומשובחת, כולל חולצה כחולה עם פסים, חולצת טי לבנה, ומכנסיים מחויטים בצבע כהה."

    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "Look 1",
                "items": [
                    {
                        "role": "top",
                        "name": "Geometric Patterned Mesh Top",
                        "closet_item_id": "mesh-top-1",
                    },
                    {
                        "role": "bottom",
                        "name": "Faded Olive Cargo Pants",
                        "closet_item_id": "faded-cargo-1",
                    },
                    {
                        "role": "shoes",
                        "name": "Sturdy Black Leather Boots",
                        "closet_item_id": "boots-blk-1",
                    },
                ],
            }
        ]
    }

    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text=prompt,
        advice_payload=raw_advice,
        all_closet_items=closet,
        user_profile={"sex": "male", "preferred_language": "he"},
    ))

    rec = reviewed["outfit_recommendations"][0]
    assert rec["qa_status"] == "authorized"

    items_by_role = {it["role"]: it for it in rec["items"]}
    # Top: Geometric Mesh Top MUST be disqualified and replaced by blue striped shirt!
    assert items_by_role["top"]["closet_item_id"] == "shirt-btn-1"
    assert "חולצת כפתורים כחולה עם פסים" in items_by_role["top"]["name"]

    # Bottom: Faded cargo pants MUST be disqualified and replaced by charcoal tailored dress pants!
    assert items_by_role["bottom"]["closet_item_id"] == "pant-dress-1"
    assert "Dress Pants" in items_by_role["bottom"]["name"]

    # Shoes remain black leather boots
    assert items_by_role["shoes"]["closet_item_id"] == "boots-blk-1"


def test_qa_localization_all_13_languages():
    import re
    from app.services.stylist_qa_engine import (
        LOCALIZED_SILHOUETTE_MOURNING,
        LOCALIZED_TEXTURE_MOURNING,
        LOCALIZED_PALETTE_MOURNING,
        LOCALIZED_DAYTIME_CONDOLENCE,
    )

    languages = ["en", "he", "ar", "es", "fr", "de", "it", "pt", "nl", "ru", "zh", "ja", "hi"]

    for lang in languages:
        payload = {
            "spoken_reply": "הו, המלצה לשעות החמה והרמדונות, הכוונה היא לביקור משפחה או,",
            "outfit_recommendations": [
                {
                    "designer_notes": {
                        "color_harmony": "כחול אדום, שחור",
                        "texture_balance": "Ratio 1:2 שרוול קצר ושרוול קצרים, מטוטל ורגליים",
                        "silhouette": "כפתורים קצרים עם חגורת גב",
                    }
                }
            ],
            "do_dont": [
                "אין ללבוש ללבוש בגדים צבעוניים",
                "אין ללבוש מזון או אוכל",
            ],
        }

        sanitize_spoken_reply_and_notes(payload, user_text="לבוש הולם לשבעה", lang=lang)

        notes = payload["outfit_recommendations"][0]["designer_notes"]
        expected_sil = LOCALIZED_SILHOUETTE_MOURNING[lang]
        expected_tex = LOCALIZED_TEXTURE_MOURNING[lang]
        expected_pal = LOCALIZED_PALETTE_MOURNING[lang]
        expected_condolence = LOCALIZED_DAYTIME_CONDOLENCE[lang]

        # Verify silhouette is localized exactly
        assert notes["silhouette"] == expected_sil, f"Silhouette mismatch for lang {lang}"
        # Verify texture balance is localized exactly
        assert notes["texture_balance"] == expected_tex, f"Texture balance mismatch for lang {lang}"
        # Verify mourning palette contains expected localized translation
        assert expected_pal in notes["color_harmony"], f"Palette mismatch for lang {lang}"

        # If non-Hebrew, verify NO Hebrew strings leaked into silhouette or texture balance
        if lang != "he":
            assert not re.search(r"[\u0590-\u05fe]", notes["silhouette"]), f"Hebrew leaked into silhouette for {lang}"
            assert not re.search(r"[\u0590-\u05fe]", notes["texture_balance"]), f"Hebrew leaked into texture balance for {lang}"
            assert "גזרה קלאסית" not in notes["silhouette"]
            assert "איזון בדים" not in notes["texture_balance"]

        # Verify spoken reply scrubbed Ramadan
        assert "והרמדונות" not in payload["spoken_reply"]
        assert expected_condolence in payload["spoken_reply"]

        # Verify do_dont pruned food and cleaned duplicate words
        assert len(payload["do_dont"]) == 1
        assert "אין ללבוש ללבוש" not in payload["do_dont"][0]


def test_scrubbing_exhibition_and_garment_name_hallucinations():
    payload = {
        "spoken_reply": "השילוב הזהב של תצוגה ותאורה, עם אביזר מזדמן מודרני ותאורה מודרנית, מתאימים ללבוש הולם לביקור משפחה בשבעה.",
        "outfit_recommendations": [
            {
                "name": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
                "items": [
                    {"role": "top", "description": "חולצת כפתורים כחולה עם פסים ושרוול קצר", "closet_item_id": "c1"},
                    {"role": "bottom", "description": "מכנסיים שחורים מחויטים", "closet_item_id": "c2"},
                ],
                "designer_notes": {
                    "color_harmony": "60-30-10 כחול כהה, אפור בהיר וסגול",
                    "texture_balance": "שרוול קצרים מודרנ, מחוטים ימיומיים, חורים ימיומיים, אביזר מזדמן מודרני",
                    "silhouette": "שרוול קצרים מודרנ עם חורים",
                },
            }
        ],
    }

    sanitize_spoken_reply_and_notes(payload, user_text="לבוש הולם לביקור משפחה בשבעה", lang="he")

    # Spoken reply should not have exhibition or casual accessory hallucinations
    assert "תצוגה ותאורה" not in payload["spoken_reply"]
    assert "אביזר מזדמן" not in payload["spoken_reply"]
    assert "השילוב המכובד והמאופק" in payload["spoken_reply"]

    rec = payload["outfit_recommendations"][0]
    # Outfit name should be replaced with dignified title instead of shirt name
    assert rec["name"] == "לבוש מכובד וצנוע לביקור אבלים"

    # Designer notes should have garbled phrases replaced
    assert "חורים ימיומיים" not in rec["designer_notes"]["texture_balance"]
    assert "אביזר מזדמן" not in rec["designer_notes"]["texture_balance"]
    assert "שרוול קצרים" not in rec["designer_notes"]["silhouette"]


def test_shiva_grammar_and_why_narrative_synchronization():
    """Verify that 'להולך בישיבה שבעה' is cleaned and why narrative is synchronized with valid items."""
    import asyncio
    from app.services.stylist_qa_engine import evaluate_and_authorize_outfit

    closet = [
        {
            "id": "top-striped-1",
            "name": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
            "category": "top",
            "color": "blue",
            "dress_code": "smart_casual",
        },
        {
            "id": "coat-1",
            "name": "Tailored Overcoat",
            "category": "outerwear",
            "color": "black",
            "dress_code": "formal",
        },
        {
            "id": "pant-blk-1",
            "name": "מכנסיים מחויטים שחורים",
            "category": "bottom",
            "color": "black",
            "dress_code": "formal",
        },
        {
            "id": "shoes-loaf-1",
            "name": "נעלי לואפרס עור חומות",
            "category": "shoes",
            "color": "brown",
            "dress_code": "formal",
        },
        {
            "id": "watch-brn-1",
            "name": "שעון יד עור חום",
            "category": "accessory",
            "color": "brown",
            "dress_code": "formal",
        },
    ]

    prompt = "לביקור משפחה בשבעה"

    raw_advice = {
        "outfit_recommendations": [
            {
                "name": "לבוש מודרני להולך בישיבה שבעה",
                "why": "לבוש מודרני וקז'ואל להולך בישיבה שבעה כולל חולצה כחולה עם פסים ושרוול קצר, וחולצת טי לבנה ומכנסיים מחויטים בצבע כחול כהה",
                "items": [
                    {"role": "top", "name": "חולצת כפתורים כחולה עם פסים ושרוול קצר", "closet_item_id": "top-striped-1"},
                    {"role": "outerwear", "name": "Tailored Overcoat", "closet_item_id": "coat-1"},
                    {"role": "bottom", "name": "מכנסיים מחויטים שחורים", "closet_item_id": "pant-blk-1"},
                    {"role": "shoes", "name": "נעלי לואפרס עור חומות", "closet_item_id": "shoes-loaf-1"},
                    {"role": "accessory", "name": "שעון יד עור חום", "closet_item_id": "watch-brn-1"},
                ],
            }
        ]
    }

    reviewed = asyncio.run(evaluate_and_authorize_outfit(
        user_text=prompt,
        advice_payload=raw_advice,
        all_closet_items=closet,
        user_profile={"sex": "male", "preferred_language": "he"},
    ))

    rec = reviewed["outfit_recommendations"][0]

    # 1. Outfit name must have broken grammar cleaned
    assert "להולך בישיבה" not in rec["name"]
    assert "לביקור שבעה" in rec["name"] or "לשבעה" in rec["name"]

    # 2. Why narrative must NOT contain hallucinated white tee or wrong dark blue pants
    assert "להולך בישיבה" not in rec["why"]
    assert "וחולצת טי לבנה" not in rec["why"]
    assert "חולצת טי" not in rec["why"]
    assert "מכנסיים מחויטים בצבע כחול כהה" not in rec["why"]

    # 3. Why narrative MUST contain actual items in the look
    assert "חולצת כפתורים כחולה עם פסים ושרוול קצר" in rec["why"]
    assert "מכנסיים מחויטים שחורים" in rec["why"]
    assert "Tailored Overcoat" in rec["why"] or "מעיל מחויט" in rec["why"]
    assert "שעון יד עור חום" in rec["why"]


def test_hebrew_mourning_text_and_garment_sanitization():
    """Verify that 'סינר' -> 'וסט', Cyrillic/hybrid tokens are cleaned, and mourning tone is moderated."""
    from app.services.gemini_stylist import sanitize_stylist_text

    # 1. 'סינר' mistranslation for vest
    raw_desc = "וחליפות כחולה וסינר אפור בהיר"
    cleaned = sanitize_stylist_text(raw_desc, lang="he")
    assert "סינר" not in cleaned
    assert "וסט אפור בהיר" in cleaned
    assert "חולצה כחולה" in cleaned

    # 2. Multilingual bleed: Cyrillic 'правило', mixed Latin 'מתאistes', corrupted 'ותאוםשת האורודת'
    raw_mixed = "המבנה מתאistes את 10–30–60 правило, ותאוםשת האורודת מושלמת עם צבעי כחול כהה ולבן."
    cleaned_mixed = sanitize_stylist_text(raw_mixed, lang="he")
    assert "правило" not in cleaned_mixed
    assert "מתאistes" not in cleaned_mixed
    assert "מתאים" in cleaned_mixed
    assert "ותאוםשת" not in cleaned_mixed
    assert "10–30–60" not in cleaned_mixed

    # 3. Typo: 'לניקום' -> 'לניחום' and inappropriate celebratory wording in shiva context
    raw_shiva = "לבוש יומיומי מושלם לניקום משפחה בשבעה"
    cleaned_shiva = sanitize_stylist_text(raw_shiva, lang="he")
    assert "לניקום" not in cleaned_shiva
    assert "לניחום" in cleaned_shiva
    assert "מושלם" not in cleaned_shiva
    assert "מאופק ומכובד" in cleaned_shiva or "מכובד" in cleaned_shiva

    # 4. Do/Don't corrupted token: 'התאוםשתאור אפור בהיר כותנה'
    raw_dd = "אין ללבוש התאוםשתאור אפור בהיר כותנה, או מכנסיים מחויטים כחולים עם כפתורים"
    cleaned_dd = sanitize_stylist_text(raw_dd, lang="he")
    assert "התאוםשתאור" not in cleaned_dd
    assert "וסט" in cleaned_dd

    # 5. English vest title in Hebrew
    raw_vest = "notched lapel tailored + vest"
    cleaned_vest = sanitize_stylist_text(raw_vest, lang="he")
    assert "notched lapel" not in cleaned_vest
    assert "וסט מחויט עם צווארון דש" in cleaned_vest


def test_wardrobe_rotation_deprioritizes_recent_items():
    """Verify that find_best_garment_replacement deprioritizes recent_item_ids."""
    from app.services.stylist_qa_engine import find_best_garment_replacement

    closet = [
        {
            "id": "polo-blue-1",
            "title": "חולצת כפתורים כחולה עם פסים ושרוול קצר",
            "category": "top",
            "last_suggested_at": "2026-10-08T12:00:00Z",
        },
        {
            "id": "polo-white-2",
            "title": "חולצת פולו לבנה קלאסית",
            "category": "top",
            "last_suggested_at": "",
        },
    ]

    # Without recent_item_ids, both are candidates, but polo-white-2 has last_suggested_at="" (sug_val="0000-00-00")
    # while polo-blue-1 was suggested today.
    picked_fresh = find_best_garment_replacement(
        role="top",
        all_closet_items=closet,
        user_text="חולצה יומיומית",
        user_gender="male",
        exclude_item_ids=set(),
    )
    assert picked_fresh is not None
    assert picked_fresh["id"] == "polo-white-2"

    # When polo-white-2 was recently suggested in this session, polo-blue-1 is chosen instead
    picked_rotated = find_best_garment_replacement(
        role="top",
        all_closet_items=closet,
        user_text="חולצה יומיומית",
        user_gender="male",
        exclude_item_ids=set(),
        recent_item_ids={"polo-white-2"},
    )
    assert picked_rotated is not None
    assert picked_rotated["id"] == "polo-blue-1"


def test_qa_evaluate_and_authorize_extracts_recent_from_conversation_history():
    """Verify evaluate_and_authorize_outfit extracts recent item IDs from conversation history and rotates."""
    import asyncio
    from app.services.stylist_qa_engine import evaluate_and_authorize_outfit

    closet = [
        {"id": "pants-black", "title": "מכנסיים מחויטים שחורים", "category": "bottom"},
        {"id": "pants-navy", "title": "מכנסיים מחויטים כחולים", "category": "bottom"},
        {"id": "shirt-1", "title": "חולצה מכופתרת לבנה", "category": "top"},
        {"id": "shoes-1", "title": "נעלי אוקספורד שחורות", "category": "shoes"},
    ]

    # Conversation history shows pants-black was already recommended in turn 1
    user_profile = {
        "preferred_language": "he",
        "sex": "male",
        "conversation_history": [
            {
                "role": "assistant",
                "payload": {
                    "outfit_recommendations": [
                        {
                            "name": "Look 1",
                            "items": [
                                {"role": "top", "closet_item_id": "shirt-1"},
                                {"role": "bottom", "closet_item_id": "pants-black"},
                                {"role": "shoes", "closet_item_id": "shoes-1"},
                            ],
                        }
                    ]
                },
            }
        ],
    }

    # Now LLM returns an incomplete outfit missing a bottom
    incomplete_advice = {
        "outfit_recommendations": [
            {
                "name": "Look 2",
                "items": [
                    {"role": "top", "name": "חולצה מכופתרת לבנה", "closet_item_id": "shirt-1"},
                    {"role": "shoes", "name": "נעלי אוקספורד שחורות", "closet_item_id": "shoes-1"},
                ],
            }
        ]
    }

    reviewed = asyncio.run(
        evaluate_and_authorize_outfit(
            user_text="חליפה אלגנטית לעבודה",
            advice_payload=incomplete_advice,
            all_closet_items=closet,
            user_profile=user_profile,
        )
    )

    rec = reviewed["outfit_recommendations"][0]
    bottom_item = next(it for it in rec["items"] if it.get("role") == "bottom")
    # Must pick pants-navy, NOT the recently used pants-black!
    assert bottom_item["closet_item_id"] == "pants-navy"








