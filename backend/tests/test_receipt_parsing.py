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
        "subscription": {"is_tester": True, "tier": "professional", "plan_type": "tester", "is_active": True},
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
        "subscription": {"is_tester": True, "tier": "professional", "plan_type": "tester", "is_active": True},
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
        "subscription": {"is_tester": True, "tier": "professional", "plan_type": "tester", "is_active": True},
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


@pytest.mark.anyio
async def test_receipt_background_wrappers_are_async_and_populate_garment_fields():
    import inspect
    from fastapi import BackgroundTasks
    from PIL import Image
    from starlette._utils import is_async_callable
    from app.api.v1.closet.common import (
        CreateItemIn,
        _run_background_matte,
        _run_background_matte_and_analyze,
        _run_background_reconstruction,
    )
    from app.api.v1.closet.items import save_closet_item_document
    from app.db.database import get_db

    # Starlette BackgroundTasks requires async callables to await coroutines
    for fn in (_run_background_matte, _run_background_matte_and_analyze, _run_background_reconstruction):
        assert inspect.iscoroutinefunction(fn)
        assert is_async_callable(fn)

    img = Image.new("RGB", (64, 64), (120, 120, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    user = {
        "id": "usr-receipt-bg",
        "email": "tester@dressapp.co",
        "roles": ["user", "tester"],
        "subscription": {"is_tester": True, "tier": "professional", "plan_type": "tester", "is_active": True},
    }
    payload = CreateItemIn(
        title="TASAY Bomber Jacket Men Rainproof Wind",
        category="Outerwear",
        brand="TASAY Official Store",
        size="L",
        price_cents=6625,
        purchase_price_cents=6625,
        color="gray",
        colors=[{"name": "gray", "pct": 100}],
        gender="men",
        state="new",
        image_base64=img_b64,
        image_mime="image/jpeg",
        from_receipt=True,
        receipt_locked_fields=[
            "title", "brand", "size", "price_cents", "purchase_price_cents",
            "category", "colors", "color", "gender", "state",
        ],
    )

    fake_vision = MagicMock()
    fake_vision.analyze = AsyncMock(return_value={
        "is_clothing": True,
        "title": "Grey Cotton Stand Collar Jacket",
        "caption": "A grey cotton bomber jacket.",
        "category": "Outerwear",
        "sub_category": "Jacket",
        "item_type": "Bomber Jacket",
        "gender": "unisex",
        "dress_code": "casual",
        "fit": "regular",
        "season": ["spring", "fall"],
        "colors": [{"name": "Grey", "pct": 100}],
        "fabric_materials": [{"name": "Cotton", "pct": 100}],
        "pattern": "solid",
        "state": "used",
        "condition": "good",
        "quality": "mid",
    })

    bg = BackgroundTasks()
    with patch("app.services.closet_service.run_background_matte", new=AsyncMock(return_value=None)), \
         patch("app.services.vision.garment_vision_service", fake_vision), \
         patch("app.services.encoder_pipeline.process_image_pipeline", new=AsyncMock(return_value=None)), \
         patch("app.services.sync_service.broadcast_sync_event", new=AsyncMock(return_value=None)):
        created = await save_closet_item_document(user=user, payload=payload, background_tasks=bg)
        item_id = created["id"]
        # Run Starlette BackgroundTasks exactly as FastAPI does after returning response
        await bg()

    db = get_db()
    saved = await db.closet_items.find_one({"id": item_id})
    assert saved is not None
    # Unlocked fields filled by GarmentVision
    assert saved["sub_category"] == "Jacket"
    assert saved["item_type"] == "Bomber Jacket"
    assert saved["caption"] == "A grey cotton bomber jacket."
    assert saved["dress_code"] == "casual"
    assert saved["fit"] == "regular"
    assert saved["season"] == ["spring", "fall"]
    assert saved["material"] == "Cotton"
    assert saved["fabric_materials"] == [{"name": "Cotton", "pct": 100}]
    assert saved["pattern"] == "solid"
    assert saved["condition"] == "good"
    assert saved["quality"] == "mid"
    # Receipt-locked fields preserved
    assert saved["title"] == "TASAY Bomber Jacket Men Rainproof Wind"
    assert saved["brand"] == "TASAY Official Store"
    assert saved["gender"] == "men"
    assert saved["state"] == "new"
