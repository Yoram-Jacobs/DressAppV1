import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.services.auth import get_current_user
from server import app

client = TestClient(app)

@pytest.mark.anyio
async def test_stylist_transcribe_unauthenticated():
    # Calling without auth token should return 401
    app.dependency_overrides.pop(get_current_user, None)
    res = client.post("/api/v1/stylist/transcribe", files={"file": ("audio.webm", b"dummy_audio", "audio/webm")})
    assert res.status_code == 401

@pytest.mark.anyio
async def test_stylist_transcribe_success():
    mock_user = {"id": "user123", "email": "user@dressapp.co", "roles": ["user"]}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_stt_result = {"text": "Hello, find me a nice outfit for tonight.", "language": "en"}
    with patch("app.services.stt_service.stt_service.transcribe", new_callable=AsyncMock) as mock_transcribe:
        mock_transcribe.return_value = mock_stt_result

        res = client.post(
            "/api/v1/stylist/transcribe",
            files={"file": ("audio.webm", b"fake_audio_bytes_12345", "audio/webm")},
            data={"language": "en"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["text"] == "Hello, find me a nice outfit for tonight."
        assert data["language"] == "en"
        assert mock_transcribe.await_count == 1


@pytest.mark.anyio
async def test_stylist_transcribe_eyes_v1_model_routes_to_gemma():
    mock_user = {
        "id": "user123",
        "email": "user@dressapp.co",
        "roles": ["user"],
        "ai_configuration": {
            "selected_provider": "dressapp",
            "selected_model": "Eyes v1"
        }
    }
    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_stt_result = {"text": "חליפה אלגנטית לערב", "language": "he"}
    with patch("app.services.stt_service.stt_service.transcribe", new_callable=AsyncMock) as mock_transcribe:
        mock_transcribe.return_value = mock_stt_result

        res = client.post(
            "/api/v1/stylist/transcribe",
            files={"file": ("audio.webm", b"fake_audio_bytes_12345", "audio/webm")},
            data={"language": "he"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["text"] == "חליפה אלגנטית לערב"
        assert data["language"] == "he"
        assert mock_transcribe.await_count == 1
        # Verify provider="gemma" was routed for Eyes v1
        _, kwargs = mock_transcribe.call_args
        assert kwargs.get("provider") == "gemma"

