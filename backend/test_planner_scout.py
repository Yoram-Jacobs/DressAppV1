import os
import sys
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

_ENV_DEFAULTS = {
    "MONGO_URL": "mongodb://localhost:27017",
    "DB_NAME": "dressapp_test",
    "JWT_SECRET": "test-jwt-secret-not-for-production",
    "GEMINI_API_KEY": "DUMMY_KEY",
    "GOOGLE_AI_API_KEY": "DUMMY_KEY",
    "OPENWEATHER_API_KEY": "DUMMY_WEATHER_KEY",
}
for _k, _v in _ENV_DEFAULTS.items():
    os.environ.setdefault(_k, _v)

import mongomock

class _AsyncCursor:
    def __init__(self, cursor):
        self._cursor = cursor
        self._items = None

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._items is None:
            self._items = iter(list(self._cursor))
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration

class _AsyncCollection:
    def __init__(self, coll):
        self._coll = coll

    def __getattr__(self, name):
        attr = getattr(self._coll, name)
        if callable(attr):
            async def _async_wrapper(*a, **kw):
                import pymongo
                result = attr(*a, **kw)
                if isinstance(result, pymongo.cursor.Cursor):
                    return _AsyncCursor(result)
                return result
            return _async_wrapper
        return attr

    def find(self, *a, **kw):
        sync_coll = self._coll
        class _ChainCursor(_AsyncCursor):
            def __init__(self):
                super().__init__(sync_coll.find(*a, **kw))
        return _ChainCursor()

class _AsyncDB:
    def __init__(self, db):
        self._db = db

    def __getattr__(self, name):
        return _AsyncCollection(self._db[name])

    def __getitem__(self, name):
        return _AsyncCollection(self._db[name])

_SYNC_CLIENT = mongomock.MongoClient()
_MOCK_DB = _AsyncDB(_SYNC_CLIENT["dressapp_test"])

def _mock_get_db():
    return _MOCK_DB

_p = patch("app.db.database.get_db", side_effect=_mock_get_db)
_p.start()

from fastapi.testclient import TestClient
from server import app
from app.services.auth import get_current_user

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)

class TestPlannerScout(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = _MOCK_DB

    @patch("app.services.gemini_stylist.gemini_stylist_service.advise")
    @patch("app.services.weather_service.weather_service.fetch")
    @patch("app.services.calendar_service.calendar_service.get_events_for_user")
    def test_planner_scout_billing_and_generation(self, mock_get_events, mock_weather, mock_advise):
        # 1. Setup mock user and garments
        test_user = {
            "id": "user-planner-test",
            "email": "planner@dressapp.co",
            "preferred_language": "en",
            "ai_configuration": {
                "provider_mode": "standard",
                "current_credits": 100,
                "credits_used_this_month": 5,
            }
        }
        _run(self.db.users.delete_many({"id": test_user["id"]}))
        _run(self.db.users.insert_one(dict(test_user)))

        garments = [
            {"id": "g-top", "user_id": test_user["id"], "category": "Top", "title": "Blue T-shirt", "tags": ["casual"]},
            {"id": "g-bottom", "user_id": test_user["id"], "category": "Bottom", "title": "Black Jeans", "tags": ["casual"]},
            {"id": "g-shoes", "user_id": test_user["id"], "category": "Footwear", "title": "Sneakers", "tags": ["casual"]},
        ]
        _run(self.db.closet_items.delete_many({"user_id": test_user["id"]}))
        for g in garments:
            _run(self.db.closet_items.insert_one(g))

        # 2. Setup service mocks
        mock_weather.return_value = {
            "temp_c": 22.0,
            "condition": "Sunny",
            "city": "Paris",
        }
        mock_get_events.return_value = [{"title": "Meeting", "start": "10:00"}]
        mock_advise.return_value = {
            "top_id": "g-top",
            "bottom_id": "g-bottom",
            "shoes_id": "g-shoes",
            "why": "A perfect casual summer look.",
        }

        # Override user dependency
        app.dependency_overrides[get_current_user] = lambda: test_user

        # 3. Call endpoint
        payload = {
            "lat": 48.8566,
            "lng": 2.3522,
            "dress_code": "all",
            "tag": "casual",
            "include_calendar": True
        }
        response = self.client.post("/api/v1/stylist/planner-scout", json=payload)
        self.assertEqual(response.status_code, 200, response.text)

        data = response.json()
        self.assertEqual(data["top_id"], "g-top")
        self.assertEqual(data["bottom_id"], "g-bottom")
        self.assertEqual(data["shoes_id"], "g-shoes")
        self.assertEqual(data["why"], "A perfect casual summer look.")
        self.assertEqual(data["credits_left"], 99)

        # Verify DB deduction
        updated_user = _run(self.db.users.find_one({"id": test_user["id"]}))
        self.assertEqual(updated_user["ai_configuration"]["current_credits"], 99)
        self.assertEqual(updated_user["ai_configuration"]["credits_used_this_month"], 6)

        # Cleanup
        app.dependency_overrides.pop(get_current_user, None)

if __name__ == "__main__":
    unittest.main()
