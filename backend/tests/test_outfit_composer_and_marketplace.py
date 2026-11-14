"""Unit tests for case-insensitive category matching and marketplace suggestion hydration."""
from __future__ import annotations

import re

from app.services import marketplace_search, outfit_composer


def _matches_mongo_regex(query: dict, value: str) -> bool:
    cat_filter = query.get("category") or {}
    pattern = cat_filter.get("$regex")
    assert pattern is not None
    flags = re.IGNORECASE if "i" in (cat_filter.get("$options") or "") else 0
    return bool(re.match(pattern, value, flags))


def test_slot_category_query_matches_title_and_lower_case():
    shoes_q = outfit_composer._slot_to_category_query("shoes")
    assert shoes_q is not None
    for val in ("Footwear", "footwear", "Shoes", "shoes", "Sneakers", "Boots", "Sandals"):
        assert _matches_mongo_regex(shoes_q, val), f"Expected shoes query to match {val!r}"
    assert not _matches_mongo_regex(shoes_q, "Top")

    top_q = outfit_composer._slot_to_category_query("top")
    assert _matches_mongo_regex(top_q, "Top")
    assert _matches_mongo_regex(top_q, "top")
    assert not _matches_mongo_regex(top_q, "topcoat")

    dress_q = outfit_composer._slot_to_category_query("dress")
    assert _matches_mongo_regex(dress_q, "Full Body")
    assert _matches_mongo_regex(dress_q, "Dresses")

    acc_q = outfit_composer._slot_to_category_query("accessory")
    assert _matches_mongo_regex(acc_q, "Accessories")
    assert _matches_mongo_regex(acc_q, "accessory")


def test_category_to_slot_handles_canonical_title_case():
    assert outfit_composer._category_to_slot("Footwear") == "shoes"
    assert outfit_composer._category_to_slot("Top") == "top"
    assert outfit_composer._category_to_slot("Bottom") == "bottom"
    assert outfit_composer._category_to_slot("Outerwear") == "outerwear"
    assert outfit_composer._category_to_slot("Full Body") == "dress"
    assert outfit_composer._category_to_slot("Accessories") == "accessory"


def test_marketplace_to_suggestion_hydrates_images_and_financial_metadata():
    demo_listing = {
        "id": "demo-1",
        "title": "White Leather Sneakers",
        "category": "shoes",
        "images": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
        "financial_metadata": {
            "list_price_cents": 6500,
            "currency": "USD",
        },
    }
    suggestion = marketplace_search._to_suggestion(demo_listing, role="shoes", score=2.0)
    assert suggestion["image_url"] == "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"
    assert suggestion["price_cents"] == 6500
    assert suggestion["currency"] == "USD"

    user_listing = {
        "id": "user-1",
        "title": "Suede Boots",
        "category": "Footwear",
        "clean_image_url": "/uploads/clean.png",
        "thumbnail_data_url": "data:image/jpeg;base64,abc",
        "financial_metadata": {
            "list_price_cents": 11800,
            "currency": "ILS",
        },
    }
    user_suggestion = marketplace_search._to_suggestion(user_listing, role="shoes", score=2.0)
    assert user_suggestion["image_url"] == "/uploads/clean.png"
    assert user_suggestion["price_cents"] == 11800
    assert user_suggestion["currency"] == "ILS"


def test_marketplace_score_listing_uses_financial_metadata_budget():
    listing = {
        "id": "demo-1",
        "title": "White Leather Sneakers",
        "financial_metadata": {"list_price_cents": 6500, "currency": "USD"},
    }
    score_under = marketplace_search._score_listing(
        listing, role="shoes", keywords=set(), budget=10000
    )
    score_over = marketplace_search._score_listing(
        listing, role="shoes", keywords=set(), budget=4000
    )
    assert score_under > score_over
