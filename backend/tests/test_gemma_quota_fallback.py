"""
backend/tests/test_gemma_quota_fallback.py

Comprehensive tests verifying:
1. FallbackBrain catches 429, RESOURCE_EXHAUSTED, and quota limits on primary,
   cascading gracefully to on-prem Gemma-4-E4B and annotating fallback_from_quota.
2. Free-tier / non-BYOK users default directly to Gemma without requiring custom API keys.
3. VisionService.analyze falls back from Gemini to Gemma when quota is exhausted.
4. End-to-end API stylist endpoint seamlessly returns 200 OK with fallback_from_quota flag.
"""

import pytest
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Any

from app.services.stylist_brain import (
    FallbackBrain,
    GemmaStylistBrain,
    GeminiStylistBrain,
    stylist_brain_service,
    reset_stylist_brain_service,
)
from app.services.vision.service import GarmentVisionService


class MockPrimaryBrain:
    provider_name = "gemini"

    def __init__(self, exc: Exception | None = None, return_val: dict[str, Any] | None = None):
        self.exc = exc
        self.return_val = return_val or {"outfit_recommendations": [], "reasoning_summary": "Primary advice"}

    async def advise(self, **kwargs: Any) -> dict[str, Any]:
        if self.exc:
            raise self.exc
        return dict(self.return_val)


class MockGemmaBrain:
    provider_name = "gemma"

    async def advise(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "outfit_recommendations": [{"name": "Gemma Casual Look"}],
            "reasoning_summary": "Curated by on-prem Gemma-4-E4B",
            "spoken_reply": "Here is your outfit from Gemma",
        }


@pytest.mark.anyio
async def test_fallback_brain_success_no_fallback():
    primary = MockPrimaryBrain(return_val={"reasoning_summary": "Gemini OK"})
    fallback = MockGemmaBrain()
    brain = FallbackBrain(primary=primary, fallback=fallback)

    res = await brain.advise()
    assert res["reasoning_summary"] == "Gemini OK"
    assert "provider_fallback" not in res
    assert "fallback_from_quota" not in res


@pytest.mark.anyio
@pytest.mark.parametrize(
    "exc_msg",
    [
        "429 Resource has been exhausted (e.g. check quota)",
        "RESOURCE_EXHAUSTED: Quota exceeded for quota metric",
        "Google API Error: spending cap reached",
        "Client Error: 429 Too Many Requests",
    ],
)
async def test_fallback_brain_catches_quota_and_falls_back_to_gemma(exc_msg: str):
    primary = MockPrimaryBrain(exc=RuntimeError(exc_msg))
    fallback = MockGemmaBrain()
    brain = FallbackBrain(primary=primary, fallback=fallback)

    res = await brain.advise()
    assert res["reasoning_summary"] == "Curated by on-prem Gemma-4-E4B"
    assert res.get("fallback_from_quota") is True
    assert "provider_fallback" in res
    fb = res["provider_fallback"]
    assert fb["from"] == "gemini"
    assert fb["to"] == "gemma"
    assert fb["quota_exhausted"] is True
    assert exc_msg in fb["reason"]


@pytest.mark.anyio
async def test_fallback_brain_raises_on_unhandled_non_transient_error():
    primary = MockPrimaryBrain(exc=ValueError("Invalid argument in prompt"))
    fallback = MockGemmaBrain()
    brain = FallbackBrain(primary=primary, fallback=fallback)

    with pytest.raises(ValueError, match="Invalid argument in prompt"):
        await brain.advise()


def test_stylist_brain_service_resolution():
    reset_stylist_brain_service()

    # 1. Non-BYOK / Free Tier (no api key):
    brain_free = stylist_brain_service(api_key=None)
    # Primary is gemma (from settings STYLIST_PROVIDER)
    assert "gemma" in brain_free.provider_name

    # 2. BYOK user with custom Gemini key:
    with patch("app.services.gemini_stylist.GeminiStylistService") as mock_gemini:
        mock_gemini.return_value = MagicMock()
        brain_custom = stylist_brain_service(api_key="test_user_gemini_key", model="gemini-3.5-flash")
        assert isinstance(brain_custom, FallbackBrain)
        assert brain_custom.primary.provider_name == "gemini"
        assert brain_custom.fallback.provider_name == "gemma"


@pytest.mark.anyio
async def test_vision_service_quota_fallback_to_gemma():
    """Verify GarmentVisionService falls back to Gemma on 429 / RESOURCE_EXHAUSTED."""
    vision = GarmentVisionService(api_key="fake_key", provider="gemini")

    # Mock _get_gemini().vision raising 429
    mock_gem = MagicMock()
    mock_gem.vision = AsyncMock(side_effect=RuntimeError("429 RESOURCE_EXHAUSTED: Rate limit exceeded"))
    vision._get_gemini = MagicMock(return_value=mock_gem)

    # Mock _call_gemma_space returning valid garment JSON
    dummy_gemma_json = (
        '{"category": "Top", "sub_category": "T-shirt", "item_type": "T-shirt", '
        '"primary_color": "Black", "name": "Classic Black Tee"}'
    )

    with patch("app.services.vision.service._call_gemma_space", new_callable=AsyncMock) as mock_space:
        mock_space.return_value = dummy_gemma_json
        with patch("app.config.settings.EYES_GEMMA_SPACE_URL", "http://eyes:7860"):
            res = await vision.analyze(b"fake_image_bytes")

            assert res["category"] == "Top"
            assert res["sub_category"] == "T-shirt"
            assert res["provider_used"] == "gemma"
            assert res.get("fallback_from_quota") is True
            assert "provider_fallback" in res
            assert res["provider_fallback"]["from"] == "gemini"
            assert res["provider_fallback"]["to"] == "gemma"
            assert res["provider_fallback"]["quota_exhausted"] is True


@pytest.mark.anyio
async def test_get_styling_advice_surfaces_fallback_flags():
    from app.services.logic import get_styling_advice

    mock_fallback_brain = FallbackBrain(
        primary=MockPrimaryBrain(exc=RuntimeError("429 RESOURCE_EXHAUSTED")),
        fallback=MockGemmaBrain(),
    )

    with patch("app.services.logic.stylist_brain_service", return_value=mock_fallback_brain):
        advice = await get_styling_advice(
            session_id="test_sess",
            image_bytes=None,
            user_text="What should I wear today?",
            synthesize_tts=False,
        )

        assert advice["reasoning_summary"] == "Curated by on-prem Gemma-4-E4B"
        assert advice.get("fallback_from_quota") is True
        assert advice.get("provider_fallback", {}).get("from") == "gemini"
        assert advice.get("provider_fallback", {}).get("to") == "gemma"


def test_stylist_endpoint_free_user_routed_to_gemma_without_gemini_key():
    """Verify non-BYOK / free tier user calls /stylist without being blocked by 400 'Gemini key required'."""
    from server import app
    from app.services.auth import get_current_user

    free_user = {
        "id": "u_free_123",
        "email": "free@dressapp.test",
        "subscription": {"tier": "free", "is_active": True},
        "ai_configuration": {},  # no custom keys
    }
    app.dependency_overrides[get_current_user] = lambda: free_user

    mock_advice = {
        "transcript": "Recommend an outfit",
        "reasoning_summary": "Here is a stylish combo powered by Gemma-4-E4B",
        "spoken_reply": "Here is your outfit",
        "outfit_recommendations": [],
        "shopping_suggestions": [],
        "do_dont": [],
    }

    with patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
         patch("app.api.v1.stylist.get_styling_advice", new_callable=AsyncMock) as mock_stylist, \
         patch("app.api.v1.stylist.get_or_create_active_session", new_callable=AsyncMock) as mock_sess, \
         patch("app.api.v1.stylist.recent_messages", new_callable=AsyncMock) as mock_hist, \
         patch("app.api.v1.stylist.closet_summary_for", new_callable=AsyncMock) as mock_closet, \
         patch("app.api.v1.stylist.append_message", new_callable=AsyncMock) as mock_app_msg, \
         patch("app.api.v1.stylist.get_session", new_callable=AsyncMock) as mock_get_sess, \
         patch("app.services.sync_service.broadcast_sync_event", new_callable=AsyncMock):

        mock_billing.return_value = True
        mock_stylist.return_value = mock_advice
        mock_sess.return_value = {"id": "sess_123", "user_id": free_user["id"], "title": "New conversation", "turns": 0}
        mock_hist.return_value = []
        mock_closet.return_value = []
        mock_app_msg.return_value = {"id": "msg_user_1"}
        mock_get_sess.return_value = {"id": "sess_123", "user_id": free_user["id"], "title": "New conversation", "turns": 1}

        from fastapi.testclient import TestClient
        client = TestClient(app)

        resp = client.post(
            "/api/v1/stylist",
            data={"text": "Recommend an outfit", "language": "en"},
        )
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["advice"]["reasoning_summary"] == "Here is a stylish combo powered by Gemma-4-E4B"


def test_stylist_endpoint_quota_fallback_surfaces_flag_in_assistant_payload():
    """Verify quota exhausted fallback surfaces fallback_from_quota in assistant_payload and advice."""
    from server import app
    from app.services.auth import get_current_user

    byok_user = {
        "id": "u_byok_123",
        "email": "byok@dressapp.test",
        "subscription": {"tier": "pro", "is_active": True},
        "ai_configuration": {
            "provider_mode": "custom_keys",
            "selected_provider": "google_ai",
            "custom_keys": {"google_ai": "expired_quota_key"},
        },
    }
    app.dependency_overrides[get_current_user] = lambda: byok_user

    mock_advice = {
        "transcript": "Recommend an outfit",
        "reasoning_summary": "Here is your outfit curated by Gemma fallback",
        "spoken_reply": "Here is your outfit",
        "outfit_recommendations": [],
        "shopping_suggestions": [],
        "do_dont": [],
        "fallback_from_quota": True,
        "provider_fallback": {
            "from": "gemini",
            "to": "gemma",
            "reason": "429 RESOURCE_EXHAUSTED",
            "quota_exhausted": True,
        },
    }

    with patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_billing, \
         patch("app.api.v1.stylist.get_styling_advice", new_callable=AsyncMock) as mock_stylist, \
         patch("app.api.v1.stylist.get_or_create_active_session", new_callable=AsyncMock) as mock_sess, \
         patch("app.api.v1.stylist.recent_messages", new_callable=AsyncMock) as mock_hist, \
         patch("app.api.v1.stylist.closet_summary_for", new_callable=AsyncMock) as mock_closet, \
         patch("app.api.v1.stylist.append_message", new_callable=AsyncMock) as mock_app_msg, \
         patch("app.api.v1.stylist.get_session", new_callable=AsyncMock) as mock_get_sess, \
         patch("app.services.sync_service.broadcast_sync_event", new_callable=AsyncMock):

        mock_billing.return_value = True
        mock_stylist.return_value = mock_advice
        mock_sess.return_value = {"id": "sess_123", "user_id": byok_user["id"], "title": "New conversation", "turns": 0}
        mock_hist.return_value = []
        mock_closet.return_value = []
        mock_app_msg.return_value = {"id": "msg_user_1"}
        mock_get_sess.return_value = {"id": "sess_123", "user_id": byok_user["id"], "title": "New conversation", "turns": 1}

        from fastapi.testclient import TestClient
        client = TestClient(app)

        resp = client.post(
            "/api/v1/stylist",
            data={"text": "Recommend an outfit", "language": "en"},
        )
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["advice"]["fallback_from_quota"] is True
        assert data["advice"]["provider_fallback"]["quota_exhausted"] is True

        # Verify append_message recorded fallback_from_quota in assistant_payload
        calls = mock_app_msg.call_args_list
        assistant_call = [c for c in calls if c.kwargs.get("role") == "assistant"][0]
        payload = assistant_call.kwargs.get("assistant_payload", {})
        assert payload.get("fallback_from_quota") is True
        assert payload.get("provider_fallback", {}).get("quota_exhausted") is True
