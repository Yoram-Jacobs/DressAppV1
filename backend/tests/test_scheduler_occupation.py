import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.stylist_scheduler_brain import (
    calculate_garment_style_score,
    generate_scheduled_proposals,
)
from app.services.scheduler import _generate_fallback_advice


def test_occupation_scoring_lawyer():
    blazer = {
        "id": "item_blazer",
        "title": "Tailored Navy Blazer",
        "category": "outerwear",
        "sub_category": "blazer",
        "tags": ["work"],
    }
    sweatpants = {
        "id": "item_sweatpants",
        "title": "Casual Grey Sweatpants",
        "category": "bottom",
        "sub_category": "sweatpants",
        "tags": ["work"],
    }

    # When respect_occupation is True and occupation is lawyer
    blazer_score = calculate_garment_style_score(
        blazer,
        style_dress_for="work",
        is_tags_mode=False,
        occupation="Lawyer",
        respect_occupation=True,
    )
    sweatpants_score = calculate_garment_style_score(
        sweatpants,
        style_dress_for="work",
        is_tags_mode=False,
        occupation="Lawyer",
        respect_occupation=True,
    )

    assert blazer_score > sweatpants_score
    # Blazer should receive formal boost
    assert blazer_score > 60
    # Sweatpants should be penalized heavily for a lawyer
    assert sweatpants_score < 0


def test_occupation_scoring_construction_builder():
    work_boots = {
        "id": "item_boots",
        "title": "Steel Toe Safety Boots",
        "category": "shoes",
        "sub_category": "work boots",
        "tags": ["work"],
    }
    cargo_pants = {
        "id": "item_cargo",
        "title": "Rugged Cargo Utility Work Pants",
        "category": "bottom",
        "sub_category": "pants",
        "tags": ["work"],
    }
    formal_suit = {
        "id": "item_suit",
        "title": "Italian Silk Suit Blazer",
        "category": "outerwear",
        "sub_category": "suit",
        "tags": ["work"],
    }

    # For an electrician or construction builder
    boots_score = calculate_garment_style_score(
        work_boots,
        style_dress_for="work",
        is_tags_mode=True,
        occupation="construction builder",
        respect_occupation=True,
    )
    cargo_score = calculate_garment_style_score(
        cargo_pants,
        style_dress_for="work",
        is_tags_mode=True,
        occupation="electrician",
        respect_occupation=True,
    )
    suit_score = calculate_garment_style_score(
        formal_suit,
        style_dress_for="work",
        is_tags_mode=True,
        occupation="electrician",
        respect_occupation=True,
    )

    assert boots_score > suit_score
    assert cargo_score > suit_score
    # In tags mode, cargo pants with tag 'work' + electrician boost should be very high
    assert cargo_score >= 140
    # Formal suit is heavily penalized compared to utility wear
    assert suit_score < cargo_score - 40


def test_respect_occupation_disabled():
    blazer = {
        "id": "item_blazer",
        "title": "Tailored Navy Blazer",
        "category": "outerwear",
        "sub_category": "blazer",
        "tags": ["everyday"],
    }

    score_enabled = calculate_garment_style_score(
        blazer,
        style_dress_for="casual",
        is_tags_mode=False,
        occupation="Lawyer",
        respect_occupation=True,
    )
    score_disabled = calculate_garment_style_score(
        blazer,
        style_dress_for="casual",
        is_tags_mode=False,
        occupation="Lawyer",
        respect_occupation=False,
    )

    assert score_enabled > score_disabled


@pytest.mark.anyio
async def test_generate_scheduled_proposals_prompt_contains_occupation():
    user = {
        "id": "user_occ_123",
        "occupation": "Corporate Attorney",
        "scheduler_settings": {
            "enabled": True,
            "respect_occupation": True,
            "style_option": "formal",
        },
    }

    mock_service = MagicMock()
    mock_service.advise = AsyncMock(return_value={
        "reasoning_summary": "Tailored formal suit for attorney.",
        "outfit_recommendations": [{
            "name": "Attorney Power Suit",
            "why": "Professional legal courtroom attire.",
            "items": [
                {"closet_item_id": "item_1", "role": "top", "title": "Dress Shirt"},
                {"closet_item_id": "item_2", "role": "bottom", "title": "Tailored Trousers"},
                {"closet_item_id": "item_3", "role": "shoes", "title": "Oxfords"}
            ]
        }]
    })

    closet = [
        {"id": "item_1", "title": "Dress Shirt", "category": "top", "role": "top"},
        {"id": "item_2", "title": "Tailored Trousers", "category": "bottom", "role": "bottom"},
        {"id": "item_3", "title": "Oxfords", "category": "shoes", "role": "shoes"},
    ]

    with patch("app.services.stylist_scheduler_brain._get_scheduler_stylist_service", return_value=mock_service), \
         patch("app.services.stylist_scheduler_brain.get_rotation_prioritized_closet", new_callable=AsyncMock, return_value=closet):
        res = await generate_scheduled_proposals(user, style_dress_for="formal")
        assert len(res.get("outfit_recommendations", [])) == 1

        # Check call args to verify prompt contained occupation
        call_kwargs = mock_service.advise.call_args.kwargs
        prompt_text = call_kwargs.get("user_text", "")
        assert "Corporate Attorney" in prompt_text
        assert "Match to Occupation: ACTIVE" in prompt_text
        assert "USER OCCUPATION & PROFESSIONAL DRESS CODE DEMANDS" in prompt_text


def test_fallback_advice_with_occupation():
    closet = [
        {"id": "top1", "title": "Safety Work Tee", "category": "top"},
        {"id": "bot1", "title": "Heavy Duty Cargo Work Pants", "category": "bottom"},
        {"id": "bot2", "title": "Delicate Silk Slacks", "category": "bottom"},
        {"id": "sh1", "title": "Steel Toe Work Boots", "category": "shoes"},
    ]

    res = _generate_fallback_advice(
        closet,
        style_dress_for="work",
        occupation="Electrician",
        respect_occupation=True,
    )
    recs = res.get("outfit_recommendations", [])
    assert len(recs) >= 1
    items = recs[0].get("items", [])
    item_ids = [it.get("closet_item_id") for it in items]
    # Heavy duty cargo pants should be selected over delicate silk slacks
    assert "bot1" in item_ids
    assert "bot2" not in item_ids
