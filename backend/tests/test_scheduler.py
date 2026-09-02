import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.scheduler import check_scheduler_triggers

@pytest.mark.anyio
async def test_check_scheduler_triggers_processes_user_without_push():
    # 1. Setup mock database
    mock_db = MagicMock()
    
    # Mock users cursor with a user that has enabled=True but no web push subscriptions
    mock_users_cursor = MagicMock()
    mock_user = {
        "id": "test_user_no_push",
        "email": "test_no_push@example.com",
        "scheduler_settings": {
            "enabled": True,
            "time": "08:00",
            "frequency": "everyday",
            "style_option": "casual",
            "timezone": "UTC"
        },
        "web_push_subscriptions": []
    }
    
    async def mock_user_iter(*args, **kwargs):
        yield mock_user
        
    mock_users_cursor.__aiter__ = mock_user_iter
    mock_db.users.find.return_value = mock_users_cursor
    
    # Mock proposals result
    mock_proposals = {
        "outfit_recommendations": [
            {
                "name": "Test Outfit",
                "why": "Test reason",
                "items": [
                    {"closet_item_id": "item1", "role": "Top", "title": "Shirt"}
                ]
            }
        ]
    }
    
    # Mocks for external dependencies called during trigger check
    with patch("app.services.scheduler.get_db", return_value=mock_db), \
         patch("app.services.scheduler.send_push_notification", new_callable=AsyncMock) as mock_send_push, \
         patch("app.services.stylist_scheduler_brain.generate_scheduled_proposals", new_callable=AsyncMock, return_value=mock_proposals), \
         patch("app.services.weather_service.weather_service.fetch", new_callable=AsyncMock, return_value=None):
        
        # We need now.strftime("%H:%M") to match the user's scheduled time "08:00"
        fake_now = datetime(2026, 8, 7, 8, 0, tzinfo=timezone.utc) # 08:00 UTC
        with patch("app.services.scheduler.datetime") as mock_datetime:
            mock_datetime.now.return_value = fake_now
            
            await check_scheduler_triggers()
            
            # Verify the user was queried and send_push_notification was called
            # even though they had no push subscriptions (send_push_notification handles empty subscriptions internally)
            mock_db.users.find.assert_called_once_with({
                "scheduler_settings.enabled": True
            })
            mock_send_push.assert_called_once()
            
            # The first argument should be the user's ID
            assert mock_send_push.call_args[0][0] == "test_user_no_push"
            # Title should contain the style label (Casual)
            assert "Casual" in mock_send_push.call_args[0][1]


@pytest.mark.anyio
async def test_check_scheduler_triggers_skips_disabled_user():
    mock_db = MagicMock()
    mock_users_cursor = MagicMock()
    
    # Empty iter since find query is for {"scheduler_settings.enabled": True}
    async def empty_iter(*args, **kwargs):
        if False:
            yield
            
    mock_users_cursor.__aiter__ = empty_iter
    mock_db.users.find.return_value = mock_users_cursor
    
    with patch("app.services.scheduler.get_db", return_value=mock_db), \
         patch("app.services.scheduler.send_push_notification", new_callable=AsyncMock) as mock_send_push:
         
        fake_now = datetime(2026, 8, 7, 8, 0, tzinfo=timezone.utc)
        with patch("app.services.scheduler.datetime") as mock_datetime:
            mock_datetime.now.return_value = fake_now
            
            await check_scheduler_triggers()
            
            mock_db.users.find.assert_called_once_with({
                "scheduler_settings.enabled": True
            })
            mock_send_push.assert_not_called()


def test_generate_fallback_advice_categorization_and_completeness():
    from app.services.stylist_scheduler_brain import generate_fallback_advice

    closet = [
        {"id": "shoe1", "title": "Adidas Neo Grey Shoes", "category": "footwear", "tags": ["work"]},
        {"id": "pants1", "title": "Men Cargo Pants", "category": "bottoms", "tags": ["work"]},
        {"id": "shirt1", "title": "Milan Black Tee", "category": "tops", "tags": ["work"]},
        {"id": "shoe2", "title": "Dark Grey Sneakers", "category": "shoes", "tags": ["casual"]},
    ]

    res = generate_fallback_advice(closet, style_dress_for="work")
    recs = res.get("outfit_recommendations", [])
    assert len(recs) > 0


    for outfit in recs:
        roles_in_outfit = {item["role"]: item["closet_item_id"] for item in outfit["items"]}
        
        # Check that top is shirt1, not shoe1!
        assert roles_in_outfit.get("top") == "shirt1"
        # Check that bottom is pants1, not shoe1 or shoe2!
        assert roles_in_outfit.get("bottom") == "pants1"
        # Check that shoes is a footwear item
        assert roles_in_outfit.get("shoes") in ("shoe1", "shoe2")


def test_ensure_complete_outfit_fixes_mislabeled_roles_and_hydrates_missing():
    from app.services.stylist_scheduler_brain import _ensure_complete_outfit

    raw_closet = [
        {"id": "shoe1", "title": "Adidas Neo Grey Shoes", "category": "footwear"},
        {"id": "pants1", "title": "Men Cargo Pants", "category": "bottom"},
        {"id": "shirt1", "title": "Milan Black Tee", "category": "top"},
    ]

    # Proposal with shoe mislabeled as top by LLM, and missing bottom
    broken_proposal = {
        "name": "Broken Suggestion",
        "why": "Testing",
        "items": [
            {"role": "top", "description": "Adidas shoes", "closet_item_id": "shoe1"},
        ]
    }

    _ensure_complete_outfit(broken_proposal, raw_closet)

    items = broken_proposal["items"]
    role_map = {it["role"]: it["closet_item_id"] for it in items}

    # shoe1 role must be corrected to shoes, not top
    assert role_map.get("shoes") == "shoe1"
    # top must be hydrated with shirt1
    assert role_map.get("top") == "shirt1"
    # bottom must be hydrated with pants1
    assert role_map.get("bottom") == "pants1"


def test_generate_fallback_advice_overall_and_suit_with_accessories():
    from app.services.scheduler import _generate_fallback_advice

    closet = [
        {"id": "overall1", "title": "Denim Overall", "category": "overall", "tags": ["casual"]},
        {"id": "suit1", "title": "Navy Business Suit", "category": "suit", "tags": ["business"]},
        {"id": "boot1", "title": "Leather Boots", "category": "boots", "tags": ["casual", "business"]},
        {"id": "watch1", "title": "Silver Watch", "category": "accessory", "tags": ["casual", "business"]},
    ]

    # Test casual overall + boots + watch
    res_casual = _generate_fallback_advice(closet, style_dress_for="casual")
    recs_casual = res_casual.get("outfit_recommendations", [])
    assert len(recs_casual) > 0
    casual_outfit = recs_casual[0]
    roles_casual = {item["role"]: item["closet_item_id"] for item in casual_outfit["items"]}
    assert roles_casual.get("dress") in ("overall1", "suit1")
    assert roles_casual.get("shoes") == "boot1"
    assert roles_casual.get("accessory") == "watch1"

    # Test business suit + boots + watch
    res_business = _generate_fallback_advice(closet, style_dress_for="business")
    recs_business = res_business.get("outfit_recommendations", [])
    assert len(recs_business) > 0
    business_outfit = recs_business[0]
    roles_biz = {item["role"]: item["closet_item_id"] for item in business_outfit["items"]}
    assert roles_biz.get("dress") == "suit1"
    assert roles_biz.get("shoes") == "boot1"
    assert roles_biz.get("accessory") == "watch1"


