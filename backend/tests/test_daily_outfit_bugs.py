"""Tests verifying fixes for Daily Outfit bugs:
1. Absence of bogus trekking calendar events on API failures or missing calendar scopes.
2. Wardrobe rotation and closet asset utilization prioritizing unworn/rarely-worn items.
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.calendar_service import CalendarService, calendar_service
from app.services.stylist_scheduler_brain import (
    get_rotation_prioritized_closet,
    generate_scheduled_proposals,
    get_recent_wardrobe_history,
)


# ==========================================
# 1. Bug 1: No Unwanted Trekking Calendar Events
# ==========================================

@pytest.mark.anyio
async def test_calendar_service_returns_empty_when_scope_missing():
    """Users who sign in with Google only have identity scopes. They must not attempt calendar calls."""
    svc = CalendarService()
    svc.client_id = "test_client_id"
    svc.client_secret = "test_client_secret"
    user = {
        "id": "u_google_login",
        "google_calendar_tokens": {
            "access_token": "dummy_access",
            "refresh_token": "dummy_refresh",
            "scope": "openid email profile https://www.googleapis.com/auth/userinfo.profile",
        }
    }
    events = await svc.get_events_for_user(user)
    assert events == []


@pytest.mark.anyio
async def test_calendar_service_returns_empty_on_api_error_never_mock_trekking():
    """If Google Calendar API throws an error (e.g. 403 Forbidden, 401, network), return [] never mock Nepal trekking."""
    svc = CalendarService()
    svc.client_id = "test_client_id"
    svc.client_secret = "test_client_secret"
    user = {
        "id": "u_calendar_user",
        "google_calendar_tokens": {
            "access_token": "dummy_access",
            "refresh_token": "dummy_refresh",
            "scope": "openid email profile https://www.googleapis.com/auth/calendar.events.readonly",
        }
    }
    with patch.object(svc, "_build_service", side_effect=Exception("403 Forbidden: Insufficient scopes")):
        events = await svc.get_events_for_user(user)
        assert events == []
        # Ensure none of the mock trekking titles are present
        titles = [e.get("title", "") for e in events]
        assert not any("טרק" in t or "trekking" in t.lower() for t in titles)


# ==========================================
# 2. Bug 2: Wardrobe Rotation & Asset Utilization
# ==========================================

@pytest.mark.anyio
async def test_rotation_prioritizes_unworn_items_over_worn_items():
    """Unworn garments (wear_count=0) must be prioritized over repeatedly worn items."""
    user_id = "test_user_rot"
    items = [
        {
            "id": "top_worn_often",
            "title": "Frequent Black T-Shirt",
            "category": "top",
            "wear_count": 8,
            "last_worn_at": "2026-11-05",
            "tags": ["casual"],
        },
        {
            "id": "top_unworn",
            "title": "Fresh White Linen Shirt",
            "category": "top",
            "wear_count": 0,
            "last_worn_at": None,
            "tags": ["casual"],
        },
        {
            "id": "bottom_worn",
            "title": "Standard Jeans",
            "category": "bottom",
            "wear_count": 5,
            "last_worn_at": "2026-11-06",
            "tags": ["casual"],
        },
        {
            "id": "bottom_unworn",
            "title": "Crisp Chino Trousers",
            "category": "bottom",
            "wear_count": 0,
            "last_worn_at": None,
            "tags": ["casual"],
        },
        {
            "id": "shoes_1",
            "title": "Casual Sneakers",
            "category": "shoes",
            "wear_count": 0,
            "tags": ["casual"],
        },
    ]

    mock_db = MagicMock()
    # Mock cursor for find
    mock_cursor = MagicMock()
    async def async_iter():
        for it in items:
            yield dict(it)
    mock_cursor.__aiter__ = lambda self: async_iter()
    mock_db.closet_items.find.return_value = mock_cursor

    with patch("app.services.stylist_scheduler_brain.get_db", return_value=mock_db), \
         patch("app.services.stylist_scheduler_brain.get_recent_wardrobe_history", new_callable=AsyncMock, return_value=({}, [])):
        prioritized = await get_rotation_prioritized_closet(
            user_id=user_id,
            limit=10,
            style_dress_for="casual",
            target_date="2026-11-12",
        )

        top_ids = [it["id"] for it in prioritized if it["category"] == "top"]
        bottom_ids = [it["id"] for it in prioritized if it["category"] == "bottom"]

        # Unworn items must precede worn items
        assert top_ids.index("top_unworn") < top_ids.index("top_worn_often")
        assert bottom_ids.index("bottom_unworn") < bottom_ids.index("bottom_worn")


@pytest.mark.anyio
async def test_recently_suggested_items_receive_recency_penalty():
    """Items suggested in recent proposals (last_suggested_at) must receive recency penalty and be pushed back."""
    user_id = "test_user_recency"
    items = [
        {
            "id": "top_just_suggested",
            "title": "Recently Suggested Tee",
            "category": "top",
            "wear_count": 0,
            "last_suggested_at": "2026-11-11",  # yesterday relative to target 2026-11-12
            "tags": ["casual"],
        },
        {
            "id": "top_fresh",
            "title": "Completely Fresh Tee",
            "category": "top",
            "wear_count": 0,
            "last_suggested_at": None,
            "tags": ["casual"],
        },
        {
            "id": "shoes_1",
            "title": "Sneakers",
            "category": "shoes",
            "tags": ["casual"],
        },
    ]

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    async def async_iter():
        for it in items:
            yield dict(it)
    mock_cursor.__aiter__ = lambda self: async_iter()
    mock_db.closet_items.find.return_value = mock_cursor

    with patch("app.services.stylist_scheduler_brain.get_db", return_value=mock_db), \
         patch("app.services.stylist_scheduler_brain.get_recent_wardrobe_history", new_callable=AsyncMock, return_value=({}, [])):
        prioritized = await get_rotation_prioritized_closet(
            user_id=user_id,
            limit=10,
            style_dress_for="casual",
            target_date="2026-11-12",
        )

        top_ids = [it["id"] for it in prioritized if it["category"] == "top"]
        assert top_ids.index("top_fresh") < top_ids.index("top_just_suggested")


@pytest.mark.anyio
async def test_generate_scheduled_proposals_passes_rotation_metadata_to_llm():
    """Verify that wear_count, last_worn, and rotation_priority are included in closet context for Gemini."""
    user = {
        "id": "u_rot_test",
        "preferred_language": "en",
        "scheduler_settings": {"enabled": True, "style_option": "casual"},
    }

    mock_service = MagicMock()
    mock_service.advise = AsyncMock(return_value={
        "reasoning_summary": "Rotated look prioritizing unworn items.",
        "outfit_recommendations": [{
            "name": "Relaxed Daily Casual",
            "why": "Curated using fresh unworn wardrobe pieces.",
            "items": [
                {"closet_item_id": "top_1", "role": "top", "title": "Linen Shirt"},
                {"closet_item_id": "bot_1", "role": "bottom", "title": "Chinos"},
                {"closet_item_id": "sh_1", "role": "shoes", "title": "Loafers"},
            ]
        }]
    })

    raw_closet = [
        {"id": "top_1", "title": "Linen Shirt", "category": "top", "wear_count": 0, "last_worn_at": None},
        {"id": "bot_1", "title": "Chinos", "category": "bottom", "wear_count": 1, "last_worn_at": "2026-10-01"},
        {"id": "sh_1", "title": "Loafers", "category": "shoes", "wear_count": 4, "last_worn_at": "2026-11-01"},
    ]

    with patch("app.services.stylist_scheduler_brain._get_scheduler_stylist_service", return_value=mock_service), \
         patch("app.services.stylist_scheduler_brain.get_recent_wardrobe_history", new_callable=AsyncMock, return_value=({}, [])), \
         patch("app.services.stylist_scheduler_brain.get_rotation_prioritized_closet", new_callable=AsyncMock, return_value=raw_closet), \
         patch("app.services.stylist_scheduler_brain.update_suggested_timestamps", new_callable=AsyncMock):

        await generate_scheduled_proposals(user, style_dress_for="casual", target_date="2026-11-12")

        call_kwargs = mock_service.advise.call_args.kwargs
        closet_summary = call_kwargs.get("closet_summary", [])
        assert len(closet_summary) == 3

        top_item = next(it for it in closet_summary if it["id"] == "top_1")
        assert top_item["wear_count"] == 0
        assert top_item["rotation_priority"] == "high (unworn)"

        prompt_text = call_kwargs.get("user_text", "")
        assert "STRICT WARDROBE ROTATION & DIVERSITY" in prompt_text
        assert "high (unworn)" in prompt_text
