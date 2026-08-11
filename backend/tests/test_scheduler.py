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
