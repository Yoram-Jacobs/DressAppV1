import asyncio
import base64
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
import sys
import os

# Append paths
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.api.v1.closet import reanalyze_group_helper

async def run_test():
    print("Starting reanalyze_group_helper test...")

    # Mock items in the group
    item1 = {
        "id": "item1",
        "group_id": "group123",
        "user_id": "user123",
        "group_role": "host",
        "segmented_image_url": "data:image/jpeg;base64," + base64.b64encode(b"dummy1").decode(),
        "tags": []
    }
    item2 = {
        "id": "item2",
        "group_id": "group123",
        "user_id": "user123",
        "group_role": "member",
        "segmented_image_url": "data:image/jpeg;base64," + base64.b64encode(b"dummy2").decode(),
        "tags": []
    }
    group_items = [item1, item2]

    # Vision service mock response
    vision_result = {
        "items": [
            {
                "id": "item1",
                "updates": {
                    "title": "Refined Front T-Shirt",
                    "category": "Top",
                    "colors": [{"name": "black", "pct": 100}]
                },
                "view_tag": "Front"
            },
            {
                "id": "item2",
                "updates": {
                    "brand": "Adidas"
                },
                "view_tag": "Back"
            }
        ]
    }

    # Setup database mocks
    mock_db = MagicMock()
    mock_db.closet_items = MagicMock()
    mock_db.users = AsyncMock()
    mock_db.users.find_one.return_return = {"id": "user123", "preferred_language": "en"}

    # Track updates
    updates_sent = {}
    async def mock_update_one(filter_doc, update_doc):
        item_id = filter_doc["id"]
        updates_sent[item_id] = update_doc["$set"]
        return MagicMock()

    mock_db.closet_items.update_one = mock_update_one

    # Mock vision service
    mock_service = AsyncMock()
    mock_service.analyze_group.return_value = vision_result

    # Mocks for endpoints and services
    with patch("app.api.v1.closet.get_db", return_value=mock_db), \
         patch("app.api.v1.closet.repos.find_many", AsyncMock(return_value=group_items)), \
         patch("app.api.v1.closet.garment_vision_service", mock_service):

        await reanalyze_group_helper("group123", "user123")

    # Assertions
    assert "item1" in updates_sent, "item1 was not updated"
    assert "item2" in updates_sent, "item2 was not updated"

    # item1 assertions
    up1 = updates_sent["item1"]
    assert up1["group_analysis_status"] == "ready"
    assert up1["title"] == "Refined Front T-Shirt"
    assert up1["category"] == "Top"
    assert "Front" in up1["tags"]
    assert up1["color"] == "black"

    # item2 assertions
    up2 = updates_sent["item2"]
    assert up2["group_analysis_status"] == "ready"
    assert up2["brand"] == "Adidas"
    assert "Back" in up2["tags"]

    print("✅ reanalyze_group_helper test PASSED successfully!")

if __name__ == "__main__":
    asyncio.run(run_test())
