"""
backend/tests/test_tester_provider_switch.py

Verifies that Tester group users switching their AI supplier (DressApp Eyes vs Google Gemini)
force-switch to Gemma on-prem (http://eyes:7860) across all workflows for that user, while
general non-tester users remain on the platform default (Gemini).
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.auth import is_tester_user, resolve_effective_provider
from app.services.llm_gateway import call_main_llm
from app.services.vision.service import get_garment_vision_service
from app.services.stylist_brain import stylist_brain_service, reset_stylist_brain_service, GemmaStylistBrain, GeminiStylistBrain, FallbackBrain


@pytest.fixture
def tester_user_dressapp():
    return {
        "id": "tester-123",
        "email": "tester@dressapp.co",
        "roles": ["user", "tester"],
        "subscription": {
            "is_active": True,
            "tier": "professional",
            "plan_type": "tester",
            "is_tester": True,
        },
        "ai_configuration": {
            "provider_mode": "dressapp",
            "selected_provider": "dressapp",
            "selected_model": "Eyes v1",
            "custom_keys": {},
        },
    }


@pytest.fixture
def tester_user_gemini():
    return {
        "id": "tester-123",
        "email": "tester@dressapp.co",
        "roles": ["user", "tester"],
        "subscription": {
            "is_active": True,
            "tier": "professional",
            "plan_type": "tester",
            "is_tester": True,
        },
        "ai_configuration": {
            "provider_mode": "custom_keys",
            "selected_provider": "google_ai",
            "selected_model": "gemini-3.5-flash",
            "custom_keys": {},
        },
    }


@pytest.fixture
def regular_user():
    return {
        "id": "regular-456",
        "email": "regular@example.com",
        "roles": ["user"],
        "subscription": {
            "is_active": False,
            "tier": "free",
            "plan_type": "free",
            "is_tester": False,
        },
        "ai_configuration": {
            "provider_mode": "dressapp",
            "selected_provider": "dressapp",
            "selected_model": "Eyes v1",
            "custom_keys": {},
        },
    }


@pytest.fixture
def manager_user():
    return {
        "id": "manager-789",
        "email": "manager@example.com",
        "roles": ["user"],
        "subscription": {
            "is_active": True,
            "tier": "manager",
            "plan_type": "monthly",
            "is_tester": False,
        },
        "ai_configuration": {
            "provider_mode": "dressapp",
            "selected_provider": "dressapp",
            "selected_model": "Eyes v1",
            "custom_keys": {},
        },
    }


def test_is_tester_user(tester_user_dressapp, regular_user, manager_user):
    assert is_tester_user(tester_user_dressapp) is True
    assert is_tester_user(regular_user) is False
    assert is_tester_user(manager_user) is False
    assert is_tester_user(None) is False


def test_resolve_effective_provider_tester_and_tiers(
    tester_user_dressapp, tester_user_gemini, regular_user, manager_user
):
    # 1. Tester selects DressApp Eyes -> routes to gemma
    assert resolve_effective_provider(tester_user_dressapp) == "gemma"

    # 2. Tester switches to Google Gemini -> routes to gemini
    assert resolve_effective_provider(tester_user_gemini) == "gemini"

    # 3. Free non-tester user defaults to cloud Gemini (gemini-2.5-flash-lite primary + on-prem Eyes fallback)
    assert resolve_effective_provider(regular_user) == "gemini"

    # 4. Manager / Professional non-tester user defaults to cloud Eyes (gemini)
    assert resolve_effective_provider(manager_user) == "gemini"


@pytest.mark.anyio
async def test_llm_gateway_routes_tester_to_gemma(tester_user_dressapp):
    with patch("app.services.llm_gateway._call_gemma_space", new_callable=AsyncMock) as mock_gemma, \
         patch("app.config.settings.EYES_GEMMA_SPACE_URL", "http://eyes:7860"):
        mock_gemma.return_value = '{"result": "gemma output"}'
        res = await call_main_llm(
            user_text="Suggest outfit",
            user=tester_user_dressapp,
        )
        assert res == '{"result": "gemma output"}'
        mock_gemma.assert_awaited_once()


@pytest.mark.anyio
async def test_llm_gateway_routes_tester_gemini_switch(tester_user_gemini):
    with patch("app.services.gemini_client.GeminiClient.text", new_callable=AsyncMock) as mock_gemini, \
         patch("app.config.settings.GEMINI_API_KEY", "test_key"):
        mock_gemini.return_value = '{"result": "gemini output"}'
        res = await call_main_llm(
            user_text="Suggest outfit",
            user=tester_user_gemini,
        )
        assert res == '{"result": "gemini output"}'
        mock_gemini.assert_awaited_once()


@pytest.mark.anyio
async def test_llm_gateway_free_user_defaults_to_gemini_25_flash_lite(regular_user):
    with patch("app.services.gemini_client.GeminiClient.text", new_callable=AsyncMock) as mock_gemini, \
         patch("app.config.settings.GEMINI_API_KEY", "test_key"), \
         patch("app.services.llm_gateway._call_gemma_space", new_callable=AsyncMock) as mock_gemma:
        mock_gemini.return_value = '{"result": "gemini 2.5 flash lite output"}'
        res = await call_main_llm(
            user_text="Suggest outfit",
            user=regular_user,
        )
        assert res == '{"result": "gemini 2.5 flash lite output"}'
        mock_gemini.assert_awaited_once()
        assert mock_gemini.await_args.kwargs["model"] == "gemini-2.5-flash-lite"
        mock_gemma.assert_not_awaited()


@pytest.mark.anyio
async def test_llm_gateway_manager_user_defaults_to_cloud_gemini(manager_user):
    with patch("app.services.gemini_client.GeminiClient.text", new_callable=AsyncMock) as mock_gemini, \
         patch("app.config.settings.GEMINI_API_KEY", "test_key"), \
         patch("app.services.llm_gateway._call_gemma_space", new_callable=AsyncMock) as mock_gemma:
        mock_gemini.return_value = '{"result": "gemini manager output"}'
        res = await call_main_llm(
            user_text="Suggest outfit",
            user=manager_user,
        )
        assert res == '{"result": "gemini manager output"}'
        mock_gemini.assert_awaited_once()
        assert mock_gemini.await_args.kwargs["model"] == "gemini-3.5-flash-lite"
        mock_gemma.assert_not_awaited()


def test_vision_service_tester_and_tiers(tester_user_dressapp, tester_user_gemini, regular_user, manager_user):
    # 1. Tester with DressApp Eyes selection gets Gemma GarmentVisionService
    v_tester = get_garment_vision_service(user=tester_user_dressapp)
    assert v_tester.provider == "gemma"
    assert v_tester.model == "Eyes v1"

    # 2. Tester switching to Google Gemini gets Gemini GarmentVisionService
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"):
        v_tester_gem = get_garment_vision_service(user=tester_user_gemini)
        assert v_tester_gem.provider == "gemini"

    # 3. Free non-tester user gets Gemini 2.5 Flash-Lite (with fallback to on-prem Eyes if GEMINI_API_KEY unset)
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"):
        v_reg = get_garment_vision_service(user=regular_user)
        assert v_reg.provider == "gemini"
        assert v_reg.model == "gemini-2.5-flash-lite"
        assert v_reg.crop_model == "gemini-2.5-flash-lite"
        assert v_reg.detect_model == "gemini-2.5-flash-lite"

    # 4. Manager / Professional non-tester user gets Hybrid Setup (gemini-2.5-flash crop/single + gemini-3.5-flash-lite detect)
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"):
        v_mgr = get_garment_vision_service(user=manager_user)
        assert v_mgr.provider == "gemini"
        assert v_mgr.model == "gemini-2.5-flash"
        assert v_mgr.crop_model == "gemini-2.5-flash"
        assert v_mgr.detect_model == "gemini-3.5-flash-lite"

    # 5. Developer / tester user without explicit Gemma selection respects active platform provider (Gemini)
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"), \
         patch("app.config.settings.EYES_PROVIDER", "gemini"):
        dev_user = {"id": "dev-1", "email": "dressappdeveloper@gmail.com"}
        v_dev = get_garment_vision_service(user=dev_user)
        assert v_dev.provider == "gemini"


def test_stylist_brain_tester_and_tiers(tester_user_dressapp, tester_user_gemini, regular_user, manager_user):
    reset_stylist_brain_service()

    # 1. Tester with DressApp Eyes gets primary GemmaStylistBrain
    brain_tester = stylist_brain_service(user=tester_user_dressapp)
    if isinstance(brain_tester, FallbackBrain):
        assert brain_tester.primary.provider_name == "gemma"
    else:
        assert brain_tester.provider_name == "gemma"

    # 2. Tester switching to Google Gemini gets primary GeminiStylistBrain
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"):
        brain_tester_gem = stylist_brain_service(user=tester_user_gemini)
        if isinstance(brain_tester_gem, FallbackBrain):
            assert brain_tester_gem.primary.provider_name == "gemini"
        else:
            assert brain_tester_gem.provider_name == "gemini"

    # 3. Free user gets primary GeminiStylistBrain (gemini-2.5-flash-lite) with GemmaStylistBrain fallback
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"):
        brain_free = stylist_brain_service(user=regular_user)
        assert isinstance(brain_free, FallbackBrain)
        assert brain_free.primary.provider_name == "gemini"
        assert brain_free.primary._svc.model == "gemini-2.5-flash-lite"
        assert brain_free.fallback.provider_name == "gemma"

    # 4. Manager user gets primary GeminiStylistBrain (gemini-3.5-flash-lite) with GemmaStylistBrain fallback
    with patch("app.config.settings.GEMINI_API_KEY", "test_gemini_key"):
        brain_mgr = stylist_brain_service(user=manager_user)
        assert isinstance(brain_mgr, FallbackBrain)
        assert brain_mgr.primary.provider_name == "gemini"
        assert brain_mgr.primary._svc.model == "gemini-3.5-flash-lite"
        assert brain_mgr.fallback.provider_name == "gemma"

