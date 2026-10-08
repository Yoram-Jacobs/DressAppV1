import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.services.auth import get_current_user
from server import app

client = TestClient(app)

@pytest.mark.anyio
async def test_stylist_speak_unauthenticated():
    app.dependency_overrides.pop(get_current_user, None)
    res = client.post("/api/v1/stylist/speak", json={"text": "שלום עולם"})
    assert res.status_code == 401


@pytest.mark.anyio
async def test_stylist_speak_success():
    mock_user = {"id": "user123", "email": "user@dressapp.co", "roles": ["user"]}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    fake_wav_bytes = b"RIFFfake_wav_audio_bytes_data"
    with patch("app.services.tts_service.tts_service.speak_to_bytes", new_callable=AsyncMock) as mock_speak:
        mock_speak.return_value = fake_wav_bytes

        res = client.post(
            "/api/v1/stylist/speak",
            json={"text": "שלום, הרכבתי לך לוק נהדר!", "voice_id": "Puck", "language": "he"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "audio_base64" in data
        assert data["mime_type"] == "audio/wav"
        import base64
        decoded = base64.b64decode(data["audio_base64"])
        assert decoded == fake_wav_bytes
        mock_speak.assert_awaited_once_with("שלום, הרכבתי לך לוק נהדר!", voice="Puck")
