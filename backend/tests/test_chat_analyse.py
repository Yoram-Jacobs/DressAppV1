import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.services.auth import get_current_user
from server import app

client = TestClient(app)


@pytest.fixture
def mock_user():
    return {"id": "user_123", "email": "test@example.com", "preferred_language": "en"}


def test_chat_analyse_unauthenticated():
    app.dependency_overrides.pop(get_current_user, None)
    response = client.post("/api/v1/closet/item_1/chat-analyse", json={"message": "Remove the shoes"})
    assert response.status_code in (401, 403)


@pytest.mark.anyio
async def test_chat_analyse_item_not_found(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find:
            mock_find.return_value = None
            response = client.post(
                "/api/v1/closet/nonexistent/chat-analyse",
                json={"message": "Remove shoes"}
            )
            assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_chat_analyse_image_edit_success(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        mock_item = {
            "id": "item_123",
            "user_id": "user_123",
            "title": "Burgundy Trousers",
            "category": "bottom",
            "color": "Burgundy",
            "image_url": "https://example.com/item.png",
        }

        # 1x1 base64 png
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.gemini_client.GeminiClient") as MockGeminiClient, \
             patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
             patch("app.api.v1.closet.gemini_image_service") as mock_img_srv:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png
            mock_billing.return_value = True

            mock_gemini_instance = MagicMock()
            mock_gemini_instance.vision = AsyncMock(
                return_value=json.dumps({
                    "action": "image_edit",
                    "reply": "I'm removing the shoes and cleaning up the trousers crop.",
                    "image_edit_prompt": "Full clean burgundy trousers isolated on white studio background without shoes",
                })
            )
            MockGeminiClient.return_value = mock_gemini_instance

            mock_img_srv.edit = AsyncMock(
                return_value={
                    "image_b64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                    "mime_type": "image/png",
                    "model_used": "gemini-2.5-flash-image",
                }
            )

            response = client.post(
                "/api/v1/closet/item_123/chat-analyse",
                json={"message": "Remove the shoes", "history": []}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["action_taken"] == "image_edit"
            assert "removing the shoes" in data["reply"]
            assert data["image_url"].startswith("data:image/png;base64,")
            assert data["item"]["reconstructed_image_url"] == data["image_url"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_chat_analyse_metadata_update(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        mock_item = {
            "id": "item_456",
            "user_id": "user_123",
            "title": "Winter Jacket",
            "category": "outerwear",
            "material": "Polyester",
            "image_url": "https://example.com/jacket.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.gemini_client.GeminiClient") as MockGeminiClient:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png

            mock_gemini_instance = MagicMock()
            mock_gemini_instance.vision = AsyncMock(
                return_value=json.dumps({
                    "action": "metadata_update",
                    "reply": "Updated fabric to 100% Cashmere.",
                    "metadata_updates": {
                        "material": "Cashmere",
                        "fabric_materials": [{"name": "Cashmere", "percentage": 100}],
                    },
                })
            )
            MockGeminiClient.return_value = mock_gemini_instance

            response = client.post(
                "/api/v1/closet/item_456/chat-analyse",
                json={"message": "Actually this jacket is 100% Cashmere", "history": []}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["action_taken"] == "metadata_update"
            assert data["updated_fields"]["material"] == "Cashmere"
            assert data["item"]["material"] == "Cashmere"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_chat_analyse_clarification(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        mock_item = {
            "id": "item_789",
            "user_id": "user_123",
            "title": "Silk Blouse",
            "image_url": "https://example.com/blouse.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.gemini_client.GeminiClient") as MockGeminiClient:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png

            mock_gemini_instance = MagicMock()
            mock_gemini_instance.vision = AsyncMock(
                return_value=json.dumps({
                    "action": "clarification",
                    "reply": "Would you like me to remove the entire pattern or just alter the sleeves?",
                    "image_edit_prompt": None,
                })
            )
            MockGeminiClient.return_value = mock_gemini_instance

            response = client.post(
                "/api/v1/closet/item_789/chat-analyse",
                json={"message": "Change it a bit", "history": []}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["action_taken"] == "clarification"
            assert "alter the sleeves" in data["reply"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
