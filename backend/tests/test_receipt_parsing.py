"""Tests for API key decryption safety and digital receipt parsing."""
from __future__ import annotations

import base64
import hashlib
import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException, UploadFile

from app.api.v1.closet.dpp_receipts import parse_receipt
from app.services.auth import (
    decrypt_api_key,
    encrypt_api_key,
    resolve_user_custom_gemini_api_key,
    resolve_user_gemini_api_key,
)


def _encrypt_with_secret(plain: str, secret: str) -> str:
    key = hashlib.sha256(secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key)).encrypt(plain.encode()).decode()


def test_decrypt_api_key_returns_none_on_undecryptable_fernet_token():
    stale_cipher = _encrypt_with_secret("AIzaSyOldSecretKey1234567890", "old-jwt-secret-value")
    assert stale_cipher.startswith("gAAAAA")

    with patch("app.services.auth.settings.JWT_SECRET", "new-jwt-secret-value"):
        assert decrypt_api_key(stale_cipher) is None


def test_decrypt_api_key_handles_valid_and_plain_keys():
    with patch("app.services.auth.settings.JWT_SECRET", "stable-jwt-secret-value"):
        encrypted = encrypt_api_key("AIzaSyValidKey1234567890")
        assert decrypt_api_key(encrypted) == "AIzaSyValidKey1234567890"
        assert decrypt_api_key("AIzaSyPlainKey1234567890") == "AIzaSyPlainKey1234567890"
        assert decrypt_api_key("") is None


def test_resolve_user_gemini_api_key_enforces_zero_byok_and_stale_key_fallback():
    stale_cipher = _encrypt_with_secret("AIzaSyOldSecretKey1234567890", "old-jwt-secret-value")

    regular_user = {
        "id": "usr-reg",
        "email": "regular@example.com",
        "roles": ["user"],
        "ai_configuration": {
            "custom_keys": {"google_ai": "AIzaSyLegacyByokKey12345"},
        },
    }
    tester_with_stale_key = {
        "id": "usr-tester",
        "email": "tester@dressapp.co",
        "roles": ["user", "tester"],
        "subscription": {"is_tester": True, "tier": "professional", "is_active": True},
        "ai_configuration": {
            "custom_keys": {"google_ai": stale_cipher},
        },
    }

    with patch("app.services.auth.settings.JWT_SECRET", "new-jwt-secret-value"), \
         patch("app.services.auth.settings.GEMINI_API_KEY", "platform-gemini-key"):
        # Non-tester never uses legacy BYOK keys
        assert resolve_user_custom_gemini_api_key(regular_user) is None
        assert resolve_user_gemini_api_key(regular_user) == "platform-gemini-key"

        # Tester with undecryptable stale token falls back to platform key
        assert resolve_user_custom_gemini_api_key(tester_with_stale_key) is None
        assert resolve_user_gemini_api_key(tester_with_stale_key) == "platform-gemini-key"


@pytest.mark.anyio
async def test_parse_receipt_succeeds_when_user_has_undecryptable_custom_key():
    stale_cipher = _encrypt_with_secret("AIzaSyOldSecretKey1234567890", "old-jwt-secret-value")
    tester_user = {
        "id": "usr-tester",
        "email": "tester@dressapp.co",
        "roles": ["user", "tester"],
        "subscription": {"is_tester": True, "tier": "professional", "is_active": True},
        "ai_configuration": {
            "selected_provider": "google_ai",
            "selected_model": "gemini-3.5-pro",
            "custom_keys": {"google_ai": stale_cipher},
        },
    }

    ocr_payload = {
        "brand": "TASAY",
        "item_type": "jacket",
        "size": "L",
        "price_cents": 4167,
        "colors": ["gray"],
        "category": "Outerwear",
        "name": "TASAY Bomber Jacket Men Rainproof Wind",
        "gender": "men",
    }

    seen_api_keys: list[str | None] = []

    class FakeGeminiClient:
        def __init__(self, api_key: str | None = None) -> None:
            seen_api_keys.append(api_key)

        async def vision(self, **kwargs) -> str:
            return json.dumps(ocr_payload)

    upload = UploadFile(
        filename="receipt.jpg",
        file=io.BytesIO(b"\xff\xd8\xff\xe0fake-jpeg"),
        headers={"content-type": "image/jpeg"},
    )

    with patch("app.services.auth.settings.JWT_SECRET", "new-jwt-secret-value"), \
         patch("app.config.settings.GEMINI_API_KEY", "platform-gemini-key"), \
         patch("app.services.auth.settings.GEMINI_API_KEY", "platform-gemini-key"), \
         patch("app.services.billing_service.deduct_user_credits", new=AsyncMock(return_value=True)), \
         patch("app.services.gemini_client.GeminiClient", FakeGeminiClient), \
         patch("app.api.v1.closet.dpp_receipts.get_garment_vision_service", return_value=None):
        result = await parse_receipt(text=None, url=None, file=upload, user=tester_user)

    assert seen_api_keys == ["platform-gemini-key"]
    assert result["brand"] == "TASAY"
    assert result["item_type"] == "jacket"
    assert result["size"] == "L"
    assert result["price_cents"] == 4167
    assert result["category"] == "Outerwear"
    assert result["gender"] == "men"
    assert result["colors"] == [{"name": "gray", "pct": 100}]


@pytest.mark.anyio
async def test_parse_receipt_retries_with_platform_key_on_invalid_custom_key():
    with patch("app.services.auth.settings.JWT_SECRET", "stable-secret"):
        revoked_cipher = encrypt_api_key("AIzaSyRevokedTesterKey12345")

    tester_user = {
        "id": "usr-tester",
        "email": "tester@dressapp.co",
        "roles": ["user", "tester"],
        "subscription": {"is_tester": True, "tier": "professional", "is_active": True},
        "ai_configuration": {
            "custom_keys": {"google_ai": revoked_cipher},
        },
    }

    seen_api_keys: list[str | None] = []

    class FakeGeminiClient:
        def __init__(self, api_key: str | None = None) -> None:
            self.api_key = api_key
            seen_api_keys.append(api_key)

        async def vision(self, **kwargs) -> str:
            if self.api_key == "AIzaSyRevokedTesterKey12345":
                raise RuntimeError(
                    "400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. Please pass a valid API key.', 'reason': 'API_KEY_INVALID'}}"
                )
            return json.dumps([
                {
                    "brand": "Zara",
                    "item_type": "shirt",
                    "size": "M",
                    "price_cents": 4990,
                    "colors": [{}],
                    "category": "Top",
                    "name": "Zara Cotton Poplin Shirt",
                    "gender": "men",
                }
            ])

    with patch("app.services.auth.settings.JWT_SECRET", "stable-secret"), \
         patch("app.config.settings.GEMINI_API_KEY", "platform-gemini-key"), \
         patch("app.services.auth.settings.GEMINI_API_KEY", "platform-gemini-key"), \
         patch("app.services.billing_service.deduct_user_credits", new=AsyncMock(return_value=True)), \
         patch("app.services.gemini_client.GeminiClient", FakeGeminiClient), \
         patch("app.api.v1.closet.dpp_receipts.get_garment_vision_service", return_value=None):
        result = await parse_receipt(text="Zara Cotton Poplin Shirt M $49.90", url=None, file=None, user=tester_user)

    assert seen_api_keys == ["AIzaSyRevokedTesterKey12345", "platform-gemini-key"]
    assert result["brand"] == "Zara"
    assert result["price_cents"] == 4990


@pytest.mark.anyio
async def test_parse_receipt_preserves_http_exception_status():
    user = {"id": "usr-1", "email": "u@example.com", "roles": ["user"]}
    with patch("app.services.billing_service.deduct_user_credits", new=AsyncMock(return_value=False)), \
         patch("app.services.credit_manager.make_insufficient_credits_exception", return_value=HTTPException(402, "No credits")):
        with pytest.raises(HTTPException) as exc_info:
            await parse_receipt(text="Receipt text", url=None, file=None, user=user)
    assert exc_info.value.status_code == 402
