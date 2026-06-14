import sys
import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock

# 1. Set environment variables so server.py import doesn't crash on KeyError
os.environ["MONGO_URL"] = "mongodb://mock:27017"
os.environ["DB_NAME"] = "dressapp"
os.environ["JWT_SECRET"] = "mock_secret"
os.environ["GEMINI_API_KEY"] = "mock_gemini_key"
os.environ["ALLOW_DEV_BYPASS"] = "true"

# 2. Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

# 3. Define database mocks
class MockCursor:
    def __init__(self, docs):
        self.docs = docs
        
    def sort(self, *args, **kwargs):
        return self
        
    def limit(self, limit):
        self.docs = self.docs[:limit]
        return self
        
    def skip(self, skip):
        self.docs = self.docs[skip:]
        return self
        
    def allow_disk_use(self, *args, **kwargs):
        return self
        
    def __aiter__(self):
        self.iter = iter(self.docs)
        return self
        
    async def __anext__(self):
        try:
            return next(self.iter)
        except StopIteration:
            raise StopAsyncIteration
            
    async def to_list(self, length):
        return self.docs[:length]

class MockDeleteResult:
    def __init__(self, count):
        self.deleted_count = count

class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []
        
    async def create_index(self, *args, **kwargs):
        return "index"
        
    async def drop_index(self, *args, **kwargs):
        return "dropped"
        
    async def count_documents(self, filter, *args, **kwargs):
        cursor = self.find(filter)
        return len(cursor.docs)
        
    async def find_one(self, filter, *args, **kwargs):
        for doc in self.docs:
            match = True
            for k, v in filter.items():
                if isinstance(v, dict):
                    if "$ne" in v:
                        if doc.get(k) == v["$ne"]:
                            match = False
                    if "$in" in v:
                        if doc.get(k) not in v["$in"]:
                            match = False
                else:
                    if doc.get(k) != v:
                        match = False
            if match:
                # Return a copy to avoid mutating inside the mock db
                return dict(doc)
        return None
        
    def find(self, filter=None, *args, **kwargs):
        filter = filter or {}
        matched = []
        for doc in self.docs:
            match = True
            for k, v in filter.items():
                if isinstance(v, dict):
                    if "$ne" in v:
                        if doc.get(k) == v["$ne"]:
                            match = False
                    if "$in" in v:
                        if doc.get(k) not in v["$in"]:
                            match = False
                else:
                    if doc.get(k) != v:
                        match = False
            if match:
                matched.append(dict(doc))
        return MockCursor(matched)
        
    async def insert_one(self, doc):
        # Auto-assign an ID if it's not present
        if "id" not in doc:
            doc["id"] = "generated-mock-id"
        self.docs.append(doc)
        return doc
        
    async def update_one(self, filter, update, *args, **kwargs):
        # Find index of doc
        idx = -1
        for i, d in enumerate(self.docs):
            match = True
            for k, v in filter.items():
                if isinstance(v, dict):
                    if "$ne" in v:
                        if d.get(k) == v["$ne"]:
                            match = False
                    if "$in" in v:
                        if d.get(k) not in v["$in"]:
                            match = False
                else:
                    if d.get(k) != v:
                        match = False
            if match:
                idx = i
                break
                
        if idx == -1 and kwargs.get("upsert"):
            doc = {}
            for k, v in filter.items():
                if not isinstance(v, dict):
                    doc[k] = v
            if "id" not in doc:
                doc["id"] = "generated-mock-id"
            self.docs.append(doc)
            idx = len(self.docs) - 1
            
        if idx != -1:
            doc = self.docs[idx]
            if "$set" in update:
                doc.update(update["$set"])
            return doc
        return None
        
    async def update_many(self, filter, update, *args, **kwargs):
        count = 0
        for doc in self.docs:
            match = True
            for k, v in filter.items():
                if isinstance(v, dict):
                    if "$ne" in v:
                        if doc.get(k) == v["$ne"]:
                            match = False
                    if "$in" in v:
                        if doc.get(k) not in v["$in"]:
                            match = False
                else:
                    if doc.get(k) != v:
                        match = False
            if match:
                if "$set" in update:
                    doc.update(update["$set"])
                count += 1
        return count
        
    async def delete_many(self, filter, *args, **kwargs):
        to_remove = []
        for doc in self.docs:
            match = True
            for k, v in filter.items():
                if isinstance(v, dict):
                    if "$ne" in v:
                        if doc.get(k) == v["$ne"]:
                            match = False
                    if "$in" in v:
                        if doc.get(k) not in v["$in"]:
                            match = False
                else:
                    if doc.get(k) != v:
                        match = False
            if match:
                to_remove.append(doc)
        for doc in to_remove:
            self.docs.remove(doc)
        return len(to_remove)
        
    async def delete_one(self, filter, *args, **kwargs):
        to_remove = None
        for doc in self.docs:
            match = True
            for k, v in filter.items():
                if isinstance(v, dict):
                    if "$ne" in v:
                        if doc.get(k) == v["$ne"]:
                            match = False
                    if "$in" in v:
                        if doc.get(k) not in v["$in"]:
                            match = False
                else:
                    if doc.get(k) != v:
                        match = False
            if match:
                to_remove = doc
                break
        if to_remove:
            self.docs.remove(to_remove)
            return MockDeleteResult(1)
        return MockDeleteResult(0)

class MockDatabase:
    def __init__(self):
        self.collections = {}
        
    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection(name)
        return self.collections[name]
        
    def __getattr__(self, name):
        return self[name]

class MockAsyncIOMotorClient:
    def __init__(self, *args, **kwargs):
        self.db = MockDatabase()
        
    def __getitem__(self, name):
        return self.db
        
    def close(self):
        pass

# 4. Inject motor mock into sys.modules BEFORE import
import motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = MockAsyncIOMotorClient

# 5. Import server and app
from server import app

# 6. Monkeypatch suitcase route dependencies after imports
from app.api.v1 import suitcase

# Define MockGeminiClient
class MockGeminiClient:
    def __init__(self, *args, **kwargs):
        pass
        
    async def text(self, *, user_text, system=None, model=None, response_mime_type=None, **kwargs):
        if "approximate latitude" in user_text or "Olson timezone name" in user_text:
            return json.dumps({"lat": 35.6892, "lng": 51.3890, "timezone": "Asia/Tehran"})
        if "danger modesty zone" in user_text or "modesty and safety advisor" in user_text:
            return json.dumps({
                "is_danger_zone": True,
                "is_holy_place": False,
                "alert_title": "Modesty Warning! ⚠️",
                "alert_body": "You have entered a dangerous modesty zone in Iran."
            })
        if "Suitcase Chat Assistant" in user_text or "gathering details" in user_text:
            return json.dumps({
                "destinations": "Tehran, Islamic Republic of Iran",
                "purpose": "business",
                "preferred_style": "casual modesty",
                "departure_time": "2026-06-15T00:00:00",
                "return_time": "2026-06-18T00:00:00",
                "notes": "Need safe outfit guidance.",
                "reply": "Sure! I have updated your travel details to Iran from tomorrow for 3 days."
            })
        if (system and "Traveling AI Stylist" in system) or "Tehran" in user_text:
            return json.dumps({
                "cultural_guidelines": "Modest clothing required in public.",
                "danger_zones_info": "Hijab is legally mandated for women in public in Iran.",
                "outfits": [
                    {
                        "date": "2026-06-15",
                        "location": "Tehran",
                        "time_to_wear": "all_day",
                        "outfit_name": "Modest Business Suit",
                        "items": [
                            {"role": "top", "description": "Long manteau", "closet_item_id": "item-1", "status": "closet"},
                            {"role": "bottom", "description": "Loose trousers", "closet_item_id": "item-2", "status": "closet"},
                            {"role": "accessory", "description": "Hijab headscarf", "closet_item_id": None, "status": "missing"}
                        ],
                        "reasoning": "Fits the modesty laws and trip purpose."
                    }
                ],
                "missing_items": [
                    {"role": "accessory", "description": "Hijab headscarf", "reason_needed": "Mandatory head covering for women in public in Iran."}
                ],
                "local_fashion_stores": [
                    {"name": "Tehran Grand Bazaar Fashion", "address_or_area": "Grand Bazaar", "why": "Traditional clothing and headscarves."}
                ]
            })
        return "{}"

suitcase.GeminiClient = MockGeminiClient

# Define MockWeatherService
class MockWeatherService:
    async def fetch(self, lat, lng):
        return {
            "temp_c": 22.0,
            "description": "Clear sky",
            "forecast_next_24h": "Sunny and pleasant"
        }
suitcase.weather_service = MockWeatherService()

# Define MockCalendarService
class MockCalendarService:
    async def get_events_for_user(self, user, hours_ahead):
        return []
suitcase.calendar_service = MockCalendarService()

# Define suggest_for_gaps mock
async def mock_suggest_for_gaps(user, gaps, brief):
    return [
        {
            "fills_slot": "accessory",
            "listing_id": "listing-123"
        }
    ]
suitcase.suggest_for_gaps = mock_suggest_for_gaps

# Define send_push_notification mock
async def mock_send_push_notification(*args, **kwargs):
    pass
suitcase.send_push_notification = mock_send_push_notification

# 7. Create TestClient
from fastapi.testclient import TestClient
client = TestClient(app)

def test_suitcase_workflow():
    # 1. Dev bypass auth to get token
    print("Getting auth token via dev-bypass...")
    resp = client.post("/api/v1/auth/dev-bypass")
    assert resp.status_code == 200, f"Auth bypass failed: {resp.text}"
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Auth successful!")

    # 2. Get user_id from the database
    from app.db.database import get_db
    db = get_db()
    user_doc = next(u for u in db.users.docs if u["email"] == "dev@dressapp.io")
    user_id = user_doc["id"]

    # Seed mock closet items for the user
    db.closet_items.docs.extend([
        {
            "id": "item-1",
            "user_id": user_id,
            "title": "My Favorite Manteau",
            "category": "top",
            "group_role": "independent"
        },
        {
            "id": "item-2",
            "user_id": user_id,
            "title": "Comfort Trousers",
            "category": "bottom",
            "group_role": "independent"
        }
    ])
    print("Seeded mock closet items.")

    # 3. Test GET /active (should be active: False initially or clean up existing)
    resp = client.get("/api/v1/suitcase/active", headers=headers)
    assert resp.status_code == 200
    if resp.json().get("active"):
        print("Active suitcase found, cleaning up...")
        client.delete("/api/v1/suitcase/active", headers=headers)

    # Verify deleted
    resp = client.get("/api/v1/suitcase/active", headers=headers)
    assert resp.status_code == 200
    assert not resp.json()["active"]
    print("Initial cleanup checked.")

    # 4. Create suitcase info chat message
    print("Testing chat gathering...")
    chat_payload = {
        "message": "Planning a modesty-focused trip to Islamic Republic of Iran starting tomorrow for 3 days for business"
    }
    resp = client.post("/api/v1/suitcase/chat", json=chat_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("reply") is not None
    print("Chat reply:", data["reply"])
    
    # 5. Pack suitcase
    print("Testing Suitcase packing generation...")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    three_days_later = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
    pack_payload = {
        "destinations": "Tehran, Islamic Republic of Iran",
        "purpose": "business",
        "preferred_style": "casual modesty",
        "departure_time": tomorrow,
        "return_time": three_days_later,
        "notes": "Need safe outfit guidance."
    }
    resp = client.post("/api/v1/suitcase/pack", json=pack_payload, headers=headers)
    assert resp.status_code == 200
    pack_data = resp.json()
    assert pack_data["status"] == "success"
    assert "cultural_guidelines" in pack_data
    # Iran warning should be triggered
    assert "danger_zones_info" in pack_data
    assert len(pack_data["outfits"]) > 0
    print("Packing details generated successfully!")
    print("Danger/Modesty alert:", pack_data["danger_zones_info"])

    # 6. Approve suitcase
    print("Testing suitcase approval and active status...")
    approve_payload = {
        "destinations": pack_payload["destinations"],
        "purpose": pack_payload["purpose"],
        "preferred_style": pack_payload["preferred_style"],
        "departure_time": pack_payload["departure_time"],
        "return_time": pack_payload["return_time"],
        "notes": pack_payload["notes"],
        "outfits": pack_data["outfits"],
        "packing_list": pack_data["packing_list"],
        "missing_notes": pack_data["danger_zones_info"]
    }
    resp = client.post("/api/v1/suitcase/approve", json=approve_payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    
    # Check if active is True
    resp = client.get("/api/v1/suitcase/active", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["active"]
    print("Suitcase approved and active!")

    # 7. Test location entry alerts simulator
    print("Testing location entry simulator...")
    loc_payload = {"location": "Islamic Republic of Iran"}
    resp = client.post("/api/v1/suitcase/enter-location", json=loc_payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    analysis = resp.json()["analysis"]
    assert analysis["is_danger_zone"] is True
    print("Location danger analysis succeeded!")

    # 8. Unpack suitcase
    print("Testing suitcase unpacking...")
    resp = client.delete("/api/v1/suitcase/active", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    
    # Check if active is False
    resp = client.get("/api/v1/suitcase/active", headers=headers)
    assert resp.status_code == 200
    assert not resp.json()["active"]
    print("Suitcase unpacked cleanly.")
    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_suitcase_workflow()
