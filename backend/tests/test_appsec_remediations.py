"""Regression tests for Wave 1 & Wave 2 DressApp AppSec remediations."""

from __future__ import annotations

import os
import sys
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "pytest-appsec-remediations-secret-123456")

from tests.test_p0_remediations import _FakeCollection, _FakeDB  # noqa: E402


class _FullFakeCollection(_FakeCollection):
    @staticmethod
    def _match(doc: dict, flt: dict) -> bool:
        import re as _re
        from tests.test_p0_remediations import _get_nested

        for key, expected in (flt or {}).items():
            if key == "$or":
                if not any(_FullFakeCollection._match(doc, branch) for branch in expected):
                    return False
                continue
            if key == "$and":
                if not all(_FullFakeCollection._match(doc, branch) for branch in expected):
                    return False
                continue
            if isinstance(expected, dict) and "$regex" in expected:
                exists, actual = _get_nested(doc, key)
                if not exists or actual is None:
                    return False
                flags = _re.IGNORECASE if "i" in str(expected.get("$options", "")) else 0
                if not _re.search(expected["$regex"], str(actual), flags):
                    return False
                continue
            from tests.test_p0_remediations import _matches_filter

            if not _matches_filter(doc, {key: expected}):
                return False
        return True

    def find(self, flt: dict | None = None, projection: dict | None = None):
        matched = [
            {k: v for k, v in d.items() if k != "_id"}
            for d in self.docs
            if self._match(d, flt or {})
        ]

        class _Cursor:
            def __init__(self, items: list[dict]) -> None:
                self._items = items
                self._idx = 0

            def sort(self, *_args, **_kwargs):
                return self

            def skip(self, n: int):
                self._items = self._items[n:]
                return self

            def limit(self, n: int):
                self._items = self._items[:n]
                return self

            async def to_list(self, _limit: int | None = None):
                return list(self._items)

            def __aiter__(self):
                self._idx = 0
                return self

            async def __anext__(self):
                if self._idx >= len(self._items):
                    raise StopAsyncIteration
                item = self._items[self._idx]
                self._idx += 1
                return item

        return _Cursor(matched)

    async def count_documents(self, flt: dict) -> int:
        return sum(1 for d in self.docs if self._match(d, flt))

    async def update_many(self, flt: dict, update: dict) -> SimpleNamespace:
        mod = 0
        for d in self.docs:
            if self._match(d, flt):
                for k, v in (update.get("$set") or {}).items():
                    d[k] = v
                for k in (update.get("$unset") or {}).keys():
                    d.pop(k, None)
                mod += 1
        return SimpleNamespace(matched_count=mod, modified_count=mod)


# ---------------------------------------------------------------------------
# 1. Fail-closed mock payments, Atzmai, PayPal, and legacy upgrade retirement
# ---------------------------------------------------------------------------
def test_mock_payment_flags_fail_closed_outside_dev() -> None:
    from app.config import settings
    from app.services import atzmai_client, paypal_client

    with (
        patch.object(settings, "APP_ENV", "production"),
        patch.object(settings, "PAYPAL_MOCK_MODE", True),
        patch.object(paypal_client, "has_real_credentials", return_value=False),
    ):
        assert settings.is_prod_like is True
        assert settings.is_dev_or_test is False
        assert settings.allow_mock_payments() is False
        assert atzmai_client.is_mock_mode() is False
        with pytest.raises(paypal_client.PayPalError):
            import asyncio

            asyncio.run(paypal_client.capture_order("MOCK-FORGED-ORDER"))


@pytest.mark.anyio
async def test_legacy_upgrade_retired_and_credit_capture_rejects_mock_outside_dev() -> None:
    from app.api.v1 import ai_credits

    fake_db = _FakeDB()
    fake_db.ai_credit_purchases = _FakeCollection(
        [
            {
                "id": "pur-1",
                "user_id": "u-1",
                "pack": "50",
                "credits": 50,
                "amount_cents": 1200,
                "currency": "USD",
                "paypal_order_id": "mock_pur-1",
                "status": "pending",
            }
        ]
    )

    with pytest.raises(HTTPException) as exc:
        await ai_credits.upgrade_subscription({"plan_type": "business"}, _user={"id": "u-1"})
    assert exc.value.status_code == 410

    with (
        patch.object(ai_credits, "get_db", return_value=fake_db),
        patch.object(ai_credits.settings, "APP_ENV", "production"),
        patch.object(ai_credits.settings, "PAYPAL_MOCK_MODE", True),
    ):
        with pytest.raises(HTTPException) as cap_exc:
            await ai_credits.capture_purchase("pur-1", user={"id": "u-1"})
        assert cap_exc.value.status_code == 403


@pytest.mark.anyio
async def test_subscription_capture_enforces_ownership_and_paypal_verification() -> None:
    from app.api.v1 import payments

    fake_db = _FakeDB()
    fake_db.closet_items = _FullFakeCollection([])
    fake_db.atzmai_topups = _FakeCollection(
        [
            {
                "id": "sub-1",
                "atzmai_payment_id": "ORDER-SUB-REAL-1",
                "paypal_order_id": "ORDER-SUB-REAL-1",
                "user_id": "owner-1",
                "amount_cents": 1500,
                "currency": "USD",
                "type": "subscription",
                "tier": "professional",
                "plan_type": "monthly",
                "status": "pending",
            }
        ]
    )
    fake_db.users.docs.append({"id": "owner-1", "email": "owner@dressapp.co", "credit_buckets": []})

    with (
        patch.object(payments, "get_db", return_value=fake_db),
        patch.object(payments.settings, "APP_ENV", "production"),
        patch.object(payments.settings, "PAYPAL_MOCK_MODE", False),
    ):
        # Attacker cannot capture owner's subscription order
        with pytest.raises(HTTPException) as idor_exc:
            await payments.capture_subscription("ORDER-SUB-REAL-1", user={"id": "attacker-2"})
        assert idor_exc.value.status_code == 404

        # Uncaptured / ncp_ fake tokens rejected in non-mock mode
        fake_db.atzmai_topups.docs.append(
            {
                "id": "sub-ncp",
                "atzmai_payment_id": "ncp_fake_123",
                "user_id": "owner-1",
                "amount_cents": 1500,
                "currency": "USD",
                "type": "subscription",
                "tier": "professional",
                "plan_type": "monthly",
                "status": "pending",
            }
        )
        with pytest.raises(HTTPException) as ncp_exc:
            await payments.capture_subscription("ncp_fake_123", user={"id": "owner-1"})
        assert ncp_exc.value.status_code == 403

        # Incomplete PayPal capture -> 402
        with (
            patch.object(payments.paypal_client, "has_real_credentials", return_value=True),
            patch.object(
                payments.paypal_client,
                "capture_order",
                new=AsyncMock(return_value={"status": "PENDING"}),
            ),
        ):
            with pytest.raises(HTTPException) as pend_exc:
                await payments.capture_subscription("ORDER-SUB-REAL-1", user={"id": "owner-1"})
            assert pend_exc.value.status_code == 402

        # Completed PayPal capture succeeds & provisions tier
        with (
            patch.object(payments.paypal_client, "has_real_credentials", return_value=True),
            patch.object(
                payments.paypal_client,
                "capture_order",
                new=AsyncMock(
                    return_value={
                        "purchase_units": [
                            {
                                "payments": {
                                    "captures": [
                                        {
                                            "id": "CAP-SUB-1",
                                            "status": "COMPLETED",
                                            "amount": {"currency_code": "USD", "value": "15.00"},
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ),
            ),
        ):
            res = await payments.capture_subscription("ORDER-SUB-REAL-1", user={"id": "owner-1"})
        assert res["ok"] is True
        assert res["subscription"]["tier"] == "professional"
        assert fake_db.users.docs[0]["subscription"]["tier"] == "professional"


@pytest.mark.anyio
async def test_campaign_capture_rejects_mock_and_replay_in_production() -> None:
    from app.api.v1 import campaigns

    fake_db = _FakeDB()
    fake_db.experts_campaigns = _FakeCollection(
        [
            {
                "id": "camp-1",
                "expert_id": "exp-1",
                "status": "draft",
                "start_date": "2026-12-01",
                "end_date": "2026-12-05",
                "billing": {
                    "paypal_order_id": "ncp_camp_FAKE",
                    "total_fee_cents": 400,
                    "payment_status": "pending",
                },
            },
            {
                "id": "camp-2",
                "expert_id": "exp-1",
                "status": "pending_approval",
                "billing": {
                    "paypal_order_id": "PP-CAMP-USED",
                    "payment_status": "paid",
                },
            },
        ]
    )

    with (
        patch.object(campaigns, "get_db", return_value=fake_db),
        patch("app.config.settings.APP_ENV", "production"),
        patch("app.config.settings.PAYPAL_MOCK_MODE", False),
    ):
        with pytest.raises(HTTPException) as exc:
            await campaigns.submit_capture(
                "camp-1",
                campaigns.SubmitCaptureIn(order_id="ncp_camp_FAKE"),
                user={"id": "exp-1", "email": "e@dressapp.co"},
            )
        assert exc.value.status_code == 403

        # Order replay across campaigns -> 409
        fake_db.experts_campaigns.docs[0]["billing"]["paypal_order_id"] = "PP-CAMP-USED"
        with pytest.raises(HTTPException) as replay_exc:
            await campaigns.submit_capture(
                "camp-1",
                campaigns.SubmitCaptureIn(order_id="PP-CAMP-USED"),
                user={"id": "exp-1", "email": "e@dressapp.co"},
            )
        assert replay_exc.value.status_code == 409


# ---------------------------------------------------------------------------
# 2. OAuth Origin allowlist & mobile scheme checks
# ---------------------------------------------------------------------------
def test_oauth_origin_header_cannot_inject_evil_redirect_and_prod_blocks_exp() -> None:
    from app.api.v1 import google_auth
    from app.config import settings
    import jwt

    app = FastAPI()
    app.include_router(google_auth.auth_router, prefix="/api/v1")
    client = TestClient(app)

    with (
        patch.object(type(google_auth.calendar_service), "enabled", new_callable=PropertyMock, return_value=True),
        patch.object(
            google_auth.calendar_service,
            "resolve_redirect_uri",
            return_value="https://dressapp.co/api/v1/auth/google/callback",
        ),
        patch.object(
            google_auth.calendar_service,
            "build_authorization_url",
            side_effect=lambda state, **_kw: f"https://accounts.google.com/o/oauth2/auth?state={state}",
        ),
    ):
        resp = client.get(
            "/api/v1/auth/google/login/start",
            headers={"Origin": "https://evil.attacker.example"},
        )
        assert resp.status_code == 200
        auth_url = resp.json()["authorization_url"]
        state_tok = auth_url.split("state=", 1)[1]
        decoded = jwt.decode(state_tok, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert "evil.attacker.example" not in decoded["frontend_origin"]

    with patch.object(settings, "APP_ENV", "production"):
        assert google_auth._validate_return_url("dressapp://auth/callback") == "dressapp://auth/callback"
        assert google_auth._validate_return_url("exp://127.0.0.1:8081") is None
        assert google_auth._validate_return_url("https://evil.com") is None


# ---------------------------------------------------------------------------
# 3. Leakage, Encryption, Mass Assignment & Scoped Migration Tokens
# ---------------------------------------------------------------------------
def test_user_sanitization_and_hkdf_multifernet_migration() -> None:
    import base64
    import hashlib
    from cryptography.fernet import Fernet
    from app.config import settings
    from app.services.auth import decrypt_api_key, encrypt_api_key, sanitize_user_doc

    raw_doc = {
        "_id": "mongo-oid",
        "id": "u-1",
        "email": "u@dressapp.co",
        "password_hash": "hash",
        "google_oauth": {"id": "g1"},
        "google_calendar_tokens": {"refresh_token": "secret-refresh-tok"},
        "migration_details": {
            "app_name": "Whering",
            "credentials": "gAAAAA-secret-competitor-pass",
        },
    }
    safe = sanitize_user_doc(raw_doc)
    assert "google_calendar_tokens" not in safe
    assert "password_hash" not in safe
    assert "google_oauth" not in safe
    assert "credentials" not in safe["migration_details"]
    assert safe["migration_details"]["has_credentials"] is True

    # New encryption decrypts cleanly and also reads legacy SHA256(JWT_SECRET) ciphertext
    enc_new = encrypt_api_key("AIzaNewKey")
    assert decrypt_api_key(enc_new) == "AIzaNewKey"

    legacy_key = base64.urlsafe_b64encode(hashlib.sha256(settings.JWT_SECRET.encode()).digest())
    enc_legacy = Fernet(legacy_key).encrypt(b"AIzaLegacyKey").decode()
    assert decrypt_api_key(enc_legacy) == "AIzaLegacyKey"


@pytest.mark.anyio
async def test_patch_users_me_blocks_credit_and_professional_self_approval() -> None:
    from app.api.v1 import users

    fake_db = _FakeDB()
    user_doc = {
        "id": "u-test",
        "email": "u@dressapp.co",
        "ai_configuration": {"current_credits": 25, "credits_used_this_month": 5},
        "professional": {"is_professional": False, "approval_status": "pending"},
    }
    fake_db.users.docs.append(dict(user_doc))

    payload = users.UpdateUserIn(
        ai_configuration={"current_credits": 999999, "credits_used_this_month": 0},
        professional={
            "is_professional": True,
            "approval_status": "approved",
            "profession": "Stylist",
        },
    )
    with patch.object(users, "get_db", return_value=fake_db):
        res = await users.update_me(payload, user=user_doc)

    assert res["ai_configuration"]["current_credits"] == 25
    assert res["professional"]["approval_status"] == "pending"


def test_scoped_migration_token_blocked_on_general_routes() -> None:
    from app.services.auth import create_scoped_token, get_current_user, get_migration_user
    from app.services import auth as auth_svc

    app = FastAPI()

    @app.get("/general")
    async def general_ep(u: dict = pytest.importorskip("fastapi").Depends(get_current_user)):
        return {"id": u["id"]}

    @app.post("/migration")
    async def mig_ep(u: dict = pytest.importorskip("fastapi").Depends(get_migration_user)):
        return {"id": u["id"]}

    client = TestClient(app)
    scoped = create_scoped_token("u-mig", scope="migration_upload", expires_minutes=15)

    with patch.object(auth_svc, "_fetch_user", new=AsyncMock(return_value={"id": "u-mig", "email": "m@d.co"})):
        assert client.get("/general", headers={"Authorization": f"Bearer {scoped}"}).status_code == 403
        assert client.post("/migration", headers={"Authorization": f"Bearer {scoped}"}).status_code == 200


# ---------------------------------------------------------------------------
# 4. IDORs, Moderation, ReDoS, Inference Auth, Uploads, IP Spoofing, Emails
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_share_outfit_and_professionals_moderation_and_redos() -> None:
    from app.api.v1 import professionals, share, campaigns, outfits

    fake_db = _FakeDB()
    fake_db.users = _FullFakeCollection([])
    fake_db.shared_outfits = _FakeCollection([])
    fake_db.outfits = _FakeCollection(
        [{"id": "priv-1", "user_id": "victim-1", "name": "Private", "share_card_b64": "YWJj"}]
    )
    fake_db.users.docs.extend(
        [
            {
                "id": "pro-pending",
                "phone": "+1-555-0100",
                "professional": {"is_professional": True, "approval_status": "pending", "profession": "Stylist"},
            },
            {
                "id": "pro-approved",
                "phone": "+1-555-0199",
                "home_location": {"city": "Tel Aviv", "country": "IL"},
                "address": {"city": "Tel Aviv", "country": "IL", "line1": "Secret St 5"},
                "professional": {
                    "is_professional": True,
                    "approval_status": "approved",
                    "profession": "Stylist",
                    "public_contact": False,
                    "business": {"name": "Studio", "phone": "+1-555-9999", "email": "hi@studio.co"},
                },
            },
        ]
    )

    with patch.object(share, "get_db", return_value=fake_db):
        with pytest.raises(HTTPException) as exc1:
            await share.get_shared_outfit("priv-1")
        assert exc1.value.status_code == 404
        with pytest.raises(HTTPException) as exc2:
            await share.get_shared_outfit_image("priv-1")
        assert exc2.value.status_code == 404

    pro_app = FastAPI()
    pro_app.include_router(professionals.router, prefix="/api/v1")
    pro_client = TestClient(pro_app)
    with patch.object(professionals, "get_db", return_value=fake_db):
        pro_resp = pro_client.get("/api/v1/professionals", params={"limit": 20, "skip": 0})
        assert pro_resp.status_code == 200
        res = pro_resp.json()
        assert res["total"] == 1
        assert res["items"][0]["id"] == "pro-approved"
        assert "phone" not in res["items"][0]
        assert "home_location" not in res["items"][0]
        assert "phone" not in res["items"][0]["professional"]["business"]
        # Regex metacharacters in q must be escaped cleanly without NameError or ReDoS match
        regex_resp = pro_client.get("/api/v1/professionals", params={"q": "Studio.*(a+)+"})
        assert regex_resp.status_code == 200
        assert regex_resp.json()["total"] == 0
        assert campaigns._is_expert(fake_db.users.docs[0]) is False
        assert campaigns._is_expert(fake_db.users.docs[1]) is True

    # save_outfit must not pull another user's closet item by ID fallback
    fake_db.closet_items = _FullFakeCollection([{"id": "victim-item", "user_id": "victim-1", "title": "Secret Coat"}])
    fake_db.outfits = _FullFakeCollection([])
    with patch.object(outfits, "get_db", return_value=fake_db):
        saved = await outfits.save_outfit(
            outfits.SaveOutfitIn(
                name="My Look",
                garments=[outfits.GarmentItemIn(closet_item_id="victim-item", role="outerwear")],
            ),
            user={"id": "attacker-1"},
        )
        assert saved["garments"][0].get("title") != "Secret Coat"


@pytest.mark.anyio
async def test_upload_cap_client_ip_and_email_escaping() -> None:
    from app.services.upload_manager import read_upload_bounded
    from app.services.security_validator import get_client_ip
    from app.services import email_service

    big_file = UploadFile(filename="big.bin", file=BytesIO(b"A" * 1024))
    with pytest.raises(HTTPException) as exc:
        await read_upload_bounded(big_file, 512)
    assert exc.value.status_code == 413

    fake_req = SimpleNamespace(
        headers={"x-forwarded-for": "1.2.3.4, 198.51.100.22"},
        client=SimpleNamespace(host="172.18.0.5"),
    )
    assert get_client_ip(fake_req) == "198.51.100.22"

    html_block = email_service._contact_block("Buyer <script>", {"display_name": "<img src=x onerror=alert(1)>"})
    assert "<script>" not in html_block
    assert "<img " not in html_block


def test_eyes_adapter_endpoints_require_auth() -> None:
    import importlib

    os.environ.setdefault("EYES_API_TOKEN", "test-eyes-secret")
    eyes_main = importlib.import_module("inference-server.eyes.main") if False else None
    spec_path = ROOT / "inference-server" / "eyes" / "main.py"
    import importlib.util

    spec = importlib.util.spec_from_file_location("eyes_main_test", spec_path)
    eyes_mod = importlib.util.module_from_spec(spec)
    with patch.dict(os.environ, {"EYES_API_TOKEN": "eyes-secret-xyz"}):
        spec.loader.exec_module(eyes_mod)
        client = TestClient(eyes_mod.app)
        assert client.get("/v1/adapters").status_code == 401
        assert client.post("/v1/adapters/reload").status_code == 401
        assert client.get("/lora-adapters").status_code == 401
        assert client.post("/lora-adapters", json=[]).status_code == 401


# ---------------------------------------------------------------------------
# 5. Wave 2: HttpOnly Cookie Sessions, CSRF Enforcement & Extension Token
# ---------------------------------------------------------------------------
def test_cookie_session_csrf_enforcement_and_extension_token() -> None:
    from fastapi import Depends
    from app.api.v1 import auth as auth_api
    from app.services import auth as auth_svc

    app = FastAPI()
    app.include_router(auth_api.router, prefix="/api/v1")

    @app.post("/api/v1/protected-mutation")
    async def protected_mutation(user: dict = Depends(auth_svc.get_current_user)):
        return {"ok": True, "user_id": user["id"]}

    client = TestClient(app)
    jwt_tok = auth_svc.create_access_token("u-cookie", {"email": "c@dressapp.co"})

    with patch.object(auth_svc, "_fetch_user", new=AsyncMock(return_value={"id": "u-cookie", "email": "c@dressapp.co"})):
        # Cookie GET succeeds without CSRF header
        client.cookies.set(auth_svc.SESSION_COOKIE_NAME, jwt_tok)
        client.cookies.set(auth_svc.CSRF_COOKIE_NAME, "csrf-val-123")
        assert client.get("/api/v1/auth/me").status_code == 200

        # Cookie POST without CSRF header fails 403
        assert client.post("/api/v1/protected-mutation").status_code == 403

        # Cookie POST with matching X-CSRF-Token succeeds and can mint extension Bearer token
        assert (
            client.post(
                "/api/v1/protected-mutation",
                headers={"X-CSRF-Token": "csrf-val-123"},
            ).status_code
            == 200
        )
        ext_resp = client.post(
            "/api/v1/auth/extension-token",
            headers={"X-CSRF-Token": "csrf-val-123"},
        )
        assert ext_resp.status_code == 200
        assert ext_resp.json()["token_type"] == "bearer"

        # Logout clears cookies cleanly
        logout_resp = client.post("/api/v1/auth/logout")
        assert logout_resp.status_code == 200
        set_cookies = " ".join(logout_resp.headers.get_list("set-cookie"))
        assert auth_svc.SESSION_COOKIE_NAME in set_cookies
