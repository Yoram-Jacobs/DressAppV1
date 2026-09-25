"""Unit and integration tests for FLUX.2 Klein 4B image generation provider suite."""
from __future__ import annotations

import asyncio
import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

from app.api.v1.image_generation import router
from app.services.image_generation.base import ImageGenerationProvider, ImageGenerationResult
from app.services.image_generation.factory import get_image_provider
from app.services.image_generation.gemini_provider import GeminiImageProvider
from app.services.image_generation.mock_provider import DUMMY_PNG_BYTES, MockImageProvider
from app.services.image_generation.runpod_provider import (
    RunpodFluxProvider,
    _build_flux_prompt,
    _clamp_strength,
)
from server import app

client = TestClient(app)

DUMMY_BASE64_IMAGE = base64.b64encode(DUMMY_PNG_BYTES).decode("ascii")


# =========================================================================
# 1. MockImageProvider Tests
# =========================================================================

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_mock_image_provider_edit():
    provider = MockImageProvider(model_name="test-mock")
    res = await provider.edit_image(
        image_bytes=DUMMY_PNG_BYTES,
        prompt="Remove buttons and repair seams",
        strength=0.5,
        garment_metadata={"category": "top", "primary_color": "navy blue"},
    )
    assert isinstance(res, ImageGenerationResult)
    assert res.provider == "mock"
    assert res.model_name == "test-mock"
    assert res.image_bytes == DUMMY_PNG_BYTES
    assert res.metadata["prompt"] == "Remove buttons and repair seams"
    assert res.metadata["garment_metadata"]["category"] == "top"


@pytest.mark.anyio
async def test_mock_image_provider_generate():
    provider = MockImageProvider()
    res = await provider.generate_image("A linen summer shirt", aspect_ratio="1:1")
    assert isinstance(res, ImageGenerationResult)
    assert res.provider == "mock"
    assert res.image_bytes == DUMMY_PNG_BYTES
    assert res.metadata["prompt"] == "A linen summer shirt"


@pytest.mark.anyio
async def test_mock_image_provider_health():
    provider = MockImageProvider()
    assert await provider.health_check() is True


# =========================================================================
# 2. RunpodFluxProvider Helper & Construction Tests
# =========================================================================

def test_runpod_strength_clamping():
    assert _clamp_strength(0.1) == 0.35
    assert _clamp_strength(0.9) == 0.65
    assert _clamp_strength(0.48) == 0.48


def test_build_flux_prompt():
    pos, neg = _build_flux_prompt(
        "Remove zipper and smooth fabric",
        garment_metadata={
            "category": "jacket",
            "primary_color": "charcoal grey",
            "pattern": "houndstooth",
            "fabric": "wool blend",
        },
    )
    assert "jacket" in pos
    assert "charcoal grey" in pos
    assert "houndstooth" in pos
    assert "wool blend" in pos
    assert "Remove zipper and smooth fabric" in pos
    assert "#F5F2EB" in pos
    assert "blurry" in neg


def test_runpod_provider_init_validation():
    with pytest.raises(ValueError, match="api_key is required"):
        RunpodFluxProvider(api_key="", endpoint_id="ep123")

    with pytest.raises(ValueError, match="endpoint_id is required"):
        RunpodFluxProvider(api_key="key123", endpoint_id="")


# =========================================================================
# 3. RunpodFluxProvider Mocked Execution Tests
# =========================================================================

@pytest.mark.anyio
async def test_runpod_flux_provider_edit_success():
    provider = RunpodFluxProvider(api_key="test_key", endpoint_id="test_ep")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "COMPLETED",
        "id": "job-12345",
        "executionTime": 1200,
        "delayTime": 300,
        "output": {
            "image": DUMMY_BASE64_IMAGE,
            "seed": 42,
        },
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = await provider.edit_image(
            image_bytes=DUMMY_PNG_BYTES,
            prompt="Repair hem line",
            strength=0.45,
            garment_metadata={"category": "skirt"},
        )

        assert res.provider == "runpod"
        assert res.model_name == "flux.2-klein-4b"
        assert res.image_bytes == DUMMY_PNG_BYTES
        assert res.metadata["runpod_job_id"] == "job-12345"
        assert res.metadata["execution_time_ms"] == 1200

        # Verify payload sent to RunPod
        call_args, call_kwargs = mock_post.call_args
        assert call_args[0] == "https://api.runpod.ai/v2/test_ep/runsync"
        payload = call_kwargs["json"]
        assert payload["input"]["task"] == "image_to_image"
        assert payload["input"]["strength"] == 0.45
        assert "skirt" in payload["input"]["prompt"]


@pytest.mark.anyio
async def test_runpod_flux_provider_async_polling_fallback():
    provider = RunpodFluxProvider(api_key="test_key", endpoint_id="test_ep")

    # Initial runsync returns IN_PROGRESS
    mock_sync_response = MagicMock()
    mock_sync_response.status_code = 200
    mock_sync_response.json.return_value = {
        "status": "IN_PROGRESS",
        "id": "async-job-999",
    }

    # Status check returns COMPLETED
    mock_status_response = MagicMock()
    mock_status_response.status_code = 200
    mock_status_response.json.return_value = {
        "status": "COMPLETED",
        "id": "async-job-999",
        "output": DUMMY_BASE64_IMAGE,
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_sync_response
        mock_get.return_value = mock_status_response

        res = await provider.edit_image(
            image_bytes=DUMMY_PNG_BYTES,
            prompt="Smooth wrinkles",
        )

        assert res.provider == "runpod"
        assert res.image_bytes == DUMMY_PNG_BYTES
        assert res.metadata["runpod_job_id"] == "async-job-999"


@pytest.mark.anyio
async def test_runpod_retry_with_backoff_on_transient_error():
    provider = RunpodFluxProvider(api_key="test_key", endpoint_id="test_ep", max_retries=3)

    mock_res_429 = MagicMock()
    mock_res_429.status_code = 429
    mock_res_429.text = "Too Many Requests"

    mock_res_200 = MagicMock()
    mock_res_200.status_code = 200
    mock_res_200.json.return_value = {
        "status": "COMPLETED",
        "id": "retry-job-123",
        "output": DUMMY_BASE64_IMAGE,
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_post.side_effect = [mock_res_429, mock_res_200]

        res = await provider.edit_image(
            image_bytes=DUMMY_PNG_BYTES,
            prompt="Remove stains",
        )

        assert res.provider == "runpod"
        assert res.image_bytes == DUMMY_PNG_BYTES
        assert res.metadata["runpod_job_id"] == "retry-job-123"
        assert mock_post.call_count == 2
        assert mock_sleep.call_count == 1


@pytest.mark.anyio
async def test_runpod_fallback_provider_activation():
    mock_fallback = MockImageProvider()
    provider = RunpodFluxProvider(
        api_key="test_key",
        endpoint_id="test_ep",
        max_retries=2,
        fallback_provider=mock_fallback,
    )

    mock_res_500 = MagicMock()
    mock_res_500.status_code = 500
    mock_res_500.text = "Internal Server Error"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("asyncio.sleep", new_callable=AsyncMock):
        mock_post.return_value = mock_res_500

        res = await provider.edit_image(
            image_bytes=DUMMY_PNG_BYTES,
            prompt="Repair hem",
        )

        assert res.provider == "mock"
        assert res.model_name == "mock-flux-model"
        assert len(res.image_bytes) > 0


@pytest.mark.anyio
async def test_runpod_concurrency_limiter():
    provider = RunpodFluxProvider(
        api_key="test_key",
        endpoint_id="test_ep",
        max_concurrency=2,
        max_retries=1,
    )

    concurrent_active = 0
    max_concurrent_seen = 0

    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {
        "status": "COMPLETED",
        "id": "job-concurrent",
        "output": DUMMY_BASE64_IMAGE,
    }

    async def fake_post(*args, **kwargs):
        nonlocal concurrent_active, max_concurrent_seen
        concurrent_active += 1
        max_concurrent_seen = max(max_concurrent_seen, concurrent_active)
        await asyncio.sleep(0.01)
        concurrent_active -= 1
        return mock_res

    with patch("httpx.AsyncClient.post", side_effect=fake_post):
        tasks = [
            provider.edit_image(image_bytes=DUMMY_PNG_BYTES, prompt=f"Prompt {i}")
            for i in range(6)
        ]
        results = await asyncio.gather(*tasks)

        assert len(results) == 6
        assert max_concurrent_seen <= 2


# =========================================================================
# 4. Factory Resolution Tests
# =========================================================================

def test_factory_mock_override():
    provider = get_image_provider(provider_override="mock")
    assert isinstance(provider, MockImageProvider)


def test_factory_runpod_instantiation():
    with patch("app.config.settings.RUNPOD_API_KEY", "r_key"), \
         patch("app.config.settings.RUNPOD_FLUX_ENDPOINT_ID", "r_ep"):
        provider = get_image_provider(provider_override="runpod")
        assert isinstance(provider, RunpodFluxProvider)
        assert provider.api_key == "r_key"
        assert provider.endpoint_id == "r_ep"


# =========================================================================
# 5. Isolated Test Endpoint Tests (`POST /api/v1/image-generation/test`)
# =========================================================================

def test_api_provider_health():
    response = client.get("/api/v1/image-generation/health?provider=mock")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["class"] == "MockImageProvider"


def test_api_image_generation_test_text():
    response = client.post(
        "/api/v1/image-generation/test",
        data={
            "prompt": "Tailored linen blazer on studio background",
            "provider": "mock",
            "strength": "0.45",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["provider"] == "mock"
    assert "image_url" in data
    assert data["image_url"].startswith(("/static/uploads/", "http"))


def test_api_image_generation_test_with_image_upload():
    response = client.post(
        "/api/v1/image-generation/test",
        data={
            "prompt": "Remove cuff stain",
            "provider": "mock",
            "strength": "0.40",
        },
        files={
            "image": ("input_garment.png", DUMMY_PNG_BYTES, "image/png"),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["provider"] == "mock"
    assert data["metadata"]["has_mask"] is False
    assert data["metadata"]["input_length"] == len(DUMMY_PNG_BYTES)
