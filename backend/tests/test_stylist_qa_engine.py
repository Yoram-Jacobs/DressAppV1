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

