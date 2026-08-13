import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.services.auth import require_admin
from server import app

client = TestClient(app)

@pytest.mark.anyio
async def test_admin_list_users_request_counts():
    # Override admin authorization check
    mock_admin = {"id": "admin_id", "email": "admin@dressapp.co", "roles": ["admin"]}
    app.dependency_overrides[require_admin] = lambda: mock_admin

    # Mock DB and aggregation cursor behavior
    mock_db = MagicMock()
    mock_db.users = MagicMock()
    mock_db.closet_items = MagicMock()
    mock_db.listings = MagicMock()
    mock_db.credit_topups = MagicMock()
    mock_db.token_usage = MagicMock()
    
    # Mock users list find cursor
    mock_users_cursor = MagicMock()
    mock_users_cursor.sort.return_value = mock_users_cursor
    mock_users_cursor.skip.return_value = mock_users_cursor
    mock_users_cursor.limit.return_value = mock_users_cursor
    
    mock_users = [
        {
            "id": "user1",
            "email": "user1@dressapp.co",
            "display_name": "User One",
            "roles": ["user"],
            "ai_configuration": {
                "selected_model": "gemini-3.5-flash-lite",
                "current_credits": 1000,
                "credits_used_this_month": 0
            }
        }
    ]
    
    async def mock_async_iter(*args, **kwargs):
        for user in mock_users:
            yield user
            
    mock_users_cursor.__aiter__ = mock_async_iter
    mock_db.users.find.return_value = mock_users_cursor
    mock_db.users.count_documents = AsyncMock(return_value=1)
    
    # Mock closet and listing count documents
    mock_db.closet_items.count_documents = AsyncMock(return_value=5)
    mock_db.listings.count_documents = AsyncMock(return_value=2)
    
    mock_topups_cursor = MagicMock()
    async def empty_iter(*args, **kwargs):
        if False:
            yield
    mock_topups_cursor.__aiter__ = empty_iter
    mock_db.credit_topups.find.return_value = mock_topups_cursor
    
    # Mock aggregate results for total and daily request counts
    mock_total_cursor = MagicMock()
    async def mock_total_iter(*args, **kwargs):
        yield {"_id": "user1", "count": 42}
    mock_total_cursor.__aiter__ = mock_total_iter
    
    mock_daily_cursor = MagicMock()
    async def mock_daily_iter(*args, **kwargs):
        yield {"_id": "user1", "count": 7}
    mock_daily_cursor.__aiter__ = mock_daily_iter
    
    # Side effects for token_usage aggregate queries
    mock_db.token_usage.aggregate.side_effect = [
        mock_total_cursor,  # first call is total
        mock_daily_cursor   # second call is daily
    ]

    try:
        with patch("app.api.v1.admin.get_db", return_value=mock_db):
            response = client.get("/api/v1/admin/users", params={"limit": 50})
            assert response.status_code == 200
            
            data = response.json()
            assert "items" in data
            assert len(data["items"]) == 1
            
            user_data = data["items"][0]
            assert user_data["id"] == "user1"
            assert user_data["total_requests"] == 42
            assert user_data["daily_requests"] == 7
            
            # Assert aggregations were called on token_usage
            assert mock_db.token_usage.aggregate.call_count == 2
    finally:
        app.dependency_overrides.clear()
