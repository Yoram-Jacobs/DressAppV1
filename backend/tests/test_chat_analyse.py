import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.services.auth import get_current_user
from app.services.image_generation.base import ImageGenerationResult
from server import app

client = TestClient(app)


@pytest.fixture
def mock_user():
    return {
        "id": "user_123",
        "email": "test@example.com",
        "preferred_language": "en",
        "subscription": {
            "tier": "professional",
            "plan_type": "professional",
            "is_active": True,
        },
    }


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
             patch("app.services.llm_gateway.call_main_llm", new_callable=AsyncMock) as mock_llm, \
             patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
             patch("app.api.v1.closet.ingestion.get_image_provider") as mock_get_provider:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png
            mock_billing.return_value = True

            mock_llm.return_value = json.dumps({
                "action": "image_edit",
                "reply": "I'm removing the shoes and cleaning up the trousers crop.",
                "image_edit_prompt": "Full clean burgundy trousers isolated on white studio background without shoes",
            })

            mock_provider = MagicMock()
            mock_provider.edit_image = AsyncMock(
                return_value=ImageGenerationResult(
                    image_bytes=fake_png,
                    mime_type="image/png",
                    provider="runpod",
                    model_name="flux.2-klein-4b",
                )
            )
            mock_get_provider.return_value = mock_provider

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
             patch("app.services.llm_gateway.call_main_llm", new_callable=AsyncMock) as mock_llm:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png

            mock_llm.return_value = json.dumps({
                "action": "metadata_update",
                "reply": "Updated fabric to 100% Cashmere.",
                "metadata_updates": {
                    "material": "Cashmere",
                    "fabric_materials": [{"name": "Cashmere", "percentage": 100}],
                },
            })

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
             patch("app.services.llm_gateway.call_main_llm", new_callable=AsyncMock) as mock_llm:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png

            mock_llm.return_value = json.dumps({
                "action": "clarification",
                "reply": "Would you like me to remove the entire pattern or just alter the sleeves?",
                "image_edit_prompt": None,
            })

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


@pytest.mark.anyio
async def test_chat_analyse_hebrew_image_edit(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        mock_item = {
            "id": "item_he_123",
            "user_id": "user_123",
            "title": "Cargo Pants",
            "category": "bottom",
            "image_url": "https://example.com/pants.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.llm_gateway.call_main_llm", new_callable=AsyncMock) as mock_llm, \
             patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
             patch("app.api.v1.closet.ingestion.get_image_provider") as mock_get_provider:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png
            mock_billing.return_value = True

            mock_llm.return_value = json.dumps({
                "action": "image_edit",
                "reply": "מבצע עריכת תמונה: מסיר את הנעליים.",
                "image_edit_prompt": "Remove the shoes and isolate cargo pants on neutral background",
            })

            mock_provider = MagicMock()
            mock_provider.edit_image = AsyncMock(
                return_value=ImageGenerationResult(
                    image_bytes=fake_png,
                    mime_type="image/png",
                    provider="runpod",
                    model_name="flux.2-klein-4b",
                )
            )
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/api/v1/closet/item_he_123/chat-analyse",
                json={"message": "הסר את הנעליים", "language": "he", "history": []}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["action_taken"] == "image_edit"
            assert "מסיר את הנעליים" in data["reply"]
            assert data["image_url"].startswith("data:image/png;base64,")
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_chat_analyse_hebrew_reconstruct_overrides_clarification_hallucination(mock_user):
    """Verify that when user clicks 'שחזר את הבגד' (Reconstruct the garment),
    even if Gemini hallucinated 'clarification' ('מה הבגד שלך צריך להחזיר? מה הכוונה?'),
    the deterministic guardrail overrides it to 'image_edit' and executes garment restoration.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        mock_item = {
            "id": "item_he_coat",
            "user_id": "user_123",
            "title": "Wool Coat",
            "category": "outerwear",
            "image_url": "https://example.com/coat.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.llm_gateway.call_main_llm", new_callable=AsyncMock) as mock_llm, \
             patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
             patch("app.api.v1.closet.ingestion.get_image_provider") as mock_get_provider:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png
            mock_billing.return_value = True

            # Simulate Gemini's Hebrew root hallucination
            mock_llm.return_value = json.dumps({
                "action": "clarification",
                "reply": "מה הבגד שלך צריך להחזיר? מה הכוונה?",
            })

            mock_provider = MagicMock()
            mock_provider.edit_image = AsyncMock(
                return_value=ImageGenerationResult(
                    image_bytes=fake_png,
                    mime_type="image/png",
                    provider="runpod",
                    model_name="flux.2-klein-4b",
                )
            )
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/api/v1/closet/item_he_coat/chat-analyse",
                json={"message": "שחזר את הבגד", "language": "he", "history": []}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["action_taken"] == "image_edit"
            assert "להחזיר" not in data["reply"]
            assert "משחזר את הבגד" in data["reply"]
            assert data["image_url"].startswith("data:image/png;base64,")

            # Check that provider was called with an English reconstruction prompt
            call_kwargs = mock_provider.edit_image.call_args.kwargs
            prompt_called = call_kwargs.get("prompt", "")
            assert "restored Wool Coat" in prompt_called or "Reconstruct" in prompt_called
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_free_user_with_credits():
    return {
        "id": "user_free_credits",
        "email": "free_credits@example.com",
        "preferred_language": "he",
        "credit_buckets": [
            {
                "id": "b1",
                "amount": 5,
                "type": "free",
                "created_at": "2026-10-01T00:00:00Z",
                "expires_at": "2026-11-01T00:00:00Z",
            }
        ],
        "subscription": {
            "tier": "free",
            "plan_type": "free",
            "is_active": True,
        },
    }


@pytest.fixture
def mock_free_user_exhausted():
    return {
        "id": "user_free_exhausted",
        "email": "free_exhausted@example.com",
        "preferred_language": "he",
        "credit_buckets": [],
        "subscription": {
            "tier": "free",
            "plan_type": "free",
            "is_active": True,
        },
    }


@pytest.mark.anyio
async def test_chat_analyse_free_user_with_credits_success(mock_free_user_with_credits):
    """Free user with onboarding credits successfully runs Nano Banana image reconstruction."""
    app.dependency_overrides[get_current_user] = lambda: mock_free_user_with_credits
    try:
        mock_item = {
            "id": "item_free_1",
            "user_id": "user_free_credits",
            "title": "White Linen Shirt",
            "category": "top",
            "image_url": "https://example.com/shirt.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
             patch("app.api.v1.closet.ingestion.get_image_provider") as mock_get_provider:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png
            mock_billing.return_value = True

            mock_provider = MagicMock()
            mock_provider.edit_image = AsyncMock(
                return_value=ImageGenerationResult(
                    image_bytes=fake_png,
                    mime_type="image/png",
                    provider="gemini",
                    model_name="gemini-3.1-flash-lite-image",
                )
            )
            mock_get_provider.return_value = mock_provider

            response = client.post(
                "/api/v1/closet/item_free_1/chat-analyse",
                json={"message": "שחזר את הבגד", "language": "he", "history": []}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["action_taken"] == "image_edit"
            assert "משחזר את הבגד" in data["reply"]
            assert data["model_used"] == "gemini-3.1-flash-lite-image"
            assert mock_billing.called
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_chat_analyse_free_user_exhausted_returns_402_no_gemini_calls(mock_free_user_exhausted):
    """Free user with 0 credits receives 402 with upgrade prompt and NO Gemini calls are made."""
    app.dependency_overrides[get_current_user] = lambda: mock_free_user_exhausted
    try:
        mock_item = {
            "id": "item_free_0",
            "user_id": "user_free_exhausted",
            "title": "White Linen Shirt",
            "category": "top",
            "image_url": "https://example.com/shirt.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.llm_gateway.call_main_llm", new_callable=AsyncMock) as mock_llm, \
             patch("app.api.v1.closet.ingestion.get_image_provider") as mock_get_provider:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png

            response = client.post(
                "/api/v1/closet/item_free_0/chat-analyse",
                json={"message": "שחזר את הבגד", "language": "he", "history": []}
            )

            assert response.status_code == 402
            data = response.json()
            assert data["detail"]["code"] == "credits_exhausted"
            assert "שדרג" in data["detail"]["message"] or "קרדיטים" in data["detail"]["message"]
            # Ensure NO Gemini calls were made
            assert not mock_llm.called
            assert not mock_get_provider.called
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_1click_reanalyze_unlocked_for_free_users(mock_free_user_exhausted):
    """Free users can use the 1-Click Full Re-analyse button powered by DressApp Eyes."""
    app.dependency_overrides[get_current_user] = lambda: mock_free_user_exhausted
    try:
        mock_item = {
            "id": "item_reanalyze_free",
            "user_id": "user_free_exhausted",
            "title": "Old Analysis",
            "category": "top",
            "image_url": "https://example.com/item.png",
        }
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"

        with patch("app.services.repos.find_one", new_callable=AsyncMock) as mock_find, \
             patch("app.api.v1.closet._read_image_bytes_from_url", new_callable=AsyncMock) as mock_read_bytes, \
             patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
             patch("app.services.vision_service.analyze", new_callable=AsyncMock) as mock_eyes, \
             patch("app.services.repos.find_one_and_update", new_callable=AsyncMock) as mock_update:

            mock_find.return_value = mock_item
            mock_read_bytes.return_value = fake_png
            mock_billing.return_value = True
            mock_eyes.return_value = {
                "title": "Fresh Eyes Analysis",
                "category": "top",
                "sub_category": "t-shirt",
                "colors": ["white"],
                "color": "white",
                "fabric_materials": [{"name": "Cotton", "percentage": 100}],
                "confidence": 0.95,
            }
            mock_update.return_value = {**mock_item, "title": "Fresh Eyes Analysis"}

            response = client.post("/api/v1/closet/item_reanalyze_free/reanalyze")
            assert response.status_code == 200
            data = response.json()
            assert data["item"]["title"] == "Fresh Eyes Analysis"
            assert mock_eyes.called
    finally:
        app.dependency_overrides.pop(get_current_user, None)


