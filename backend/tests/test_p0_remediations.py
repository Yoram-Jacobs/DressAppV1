"""Comprehensive regression tests for P0 QA remediations (QA-01..QA-11, QA-20)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
EYES_TRAINING_DIR = ROOT / "inference-server" / "eyes" / "training"
for _p in (str(BACKEND_DIR), str(EYES_TRAINING_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _get_nested(doc: dict[str, Any], dotted_key: str, default: Any = None) -> tuple[bool, Any]:
    cur: Any = doc
    for part in dotted_key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return False, default
        cur = cur[part]
    return True, cur


def _set_nested(doc: dict[str, Any], dotted_key: str, value: Any) -> None:
    parts = dotted_key.split(".")
    cur = doc
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = value


def _matches_filter(doc: dict[str, Any], flt: dict[str, Any]) -> bool:
    for key, expected in (flt or {}).items():
        if key == "$or":
            if not any(_matches_filter(doc, branch) for branch in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches_filter(doc, branch) for branch in expected):
                return False
            continue
        exists, actual = _get_nested(doc, key)
        if isinstance(expected, dict):
            if "$exists" in expected and exists != bool(expected["$exists"]):
                return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$lte" in expected and (not exists or actual is None or actual > expected["$lte"]):
                return False
            if "$gte" in expected and (not exists or actual is None or actual < expected["$gte"]):
                return False
        else:
            if not exists or actual != expected:
                return False
    return True


class _FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = list(docs)
        self._idx = 0

    def limit(self, n: int) -> "_FakeCursor":
        self._docs = self._docs[:n]
        return self

    def __aiter__(self) -> "_FakeCursor":
        self._idx = 0
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._idx >= len(self._docs):
            raise StopAsyncIteration
        item = self._docs[self._idx]
        self._idx += 1
        return item


class _FakeCollection:
    def __init__(self, docs: list[dict[str, Any]] | None = None) -> None:
        self.docs: list[dict[str, Any]] = list(docs or [])
        self.calls: list[tuple[str, Any]] = []

    def find(self, flt: dict[str, Any] | None = None, _proj: Any = None) -> _FakeCursor:
        matched = [dict(d) for d in self.docs if _matches_filter(d, flt or {})]
        return _FakeCursor(matched)

    async def find_one(self, flt: dict[str, Any], _proj: Any = None) -> dict[str, Any] | None:
        for d in self.docs:
            if _matches_filter(d, flt):
                return dict(d)
        return None

    async def insert_one(self, doc: dict[str, Any]) -> SimpleNamespace:
        self.docs.append(dict(doc))
        return SimpleNamespace(inserted_id=doc.get("id") or len(self.docs))

    async def update_one(
        self, flt: dict[str, Any], update: dict[str, Any], upsert: bool = False
    ) -> SimpleNamespace:
        self.calls.append(("update_one", (flt, update, upsert)))
        for doc in self.docs:
            if _matches_filter(doc, flt):
                for k, v in (update.get("$set") or {}).items():
                    _set_nested(doc, k, v)
                for k, delta in (update.get("$inc") or {}).items():
                    _, prev = _get_nested(doc, k, 0)
                    _set_nested(doc, k, (prev or 0) + delta)
                for k, item in (update.get("$push") or {}).items():
                    _, arr = _get_nested(doc, k, [])
                    if not isinstance(arr, list):
                        arr = []
                    arr.append(item)
                    _set_nested(doc, k, arr)
                return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)

        if upsert:
            new_doc: dict[str, Any] = {}
            for k, v in (update.get("$setOnInsert") or {}).items():
                _set_nested(new_doc, k, v)
            for k, v in (update.get("$set") or {}).items():
                _set_nested(new_doc, k, v)
            for k, delta in (update.get("$inc") or {}).items():
                _set_nested(new_doc, k, delta)
            self.docs.append(new_doc)
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=new_doc.get("key", "upserted"))

        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)


class _FakeDB:
    def __init__(self) -> None:
        self.users = _FakeCollection()
        self.ai_credit_purchases = _FakeCollection()
        self.credit_topups = _FakeCollection()
        self.user_credits = _FakeCollection()
        self.ad_campaigns = _FakeCollection()
        self.ad_accounts = _FakeCollection()
        self.ad_tracking_events = _FakeCollection()


# ---------------------------------------------------------------------------
# QA-05: JWT secret fail-closed + Single-use SSE ticket auth
# ---------------------------------------------------------------------------


def test_qa05_jwt_secret_fails_closed_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.config as cfg

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delitem(sys.modules, "pytest", raising=False)

    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        cfg._resolve_jwt_secret()

    monkeypatch.setenv("JWT_SECRET", cfg._LEGACY_DEFAULT_JWT_SECRET)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        cfg._resolve_jwt_secret()

    monkeypatch.setenv("JWT_SECRET", "super-strong-prod-secret-value-123456")
    assert cfg._resolve_jwt_secret() == "super-strong-prod-secret-value-123456"


def test_qa05_sse_ticket_single_use_and_master_jwt_rejected() -> None:
    import app.api.v1.sync as sync_api
    import app.config as cfg
    from app.services.auth import get_current_user

    sync_api._sse_tickets.clear()
    app = FastAPI()
    app.include_router(sync_api.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-sse-1", "email": "u@example.com"}

    async def _one_chunk_gen(_uid: str):
        yield "data: {\"ok\": true}\n\n"

    master_jwt = jwt.encode(
        {
            "sub": "user-sse-1",
            "iat": 1_700_000_000,
            "exp": 1_700_086_400,
        },
        cfg.settings.JWT_SECRET,
        algorithm=cfg.settings.JWT_ALGORITHM,
    )

    with patch.object(sync_api, "sync_event_generator", _one_chunk_gen):
        client = TestClient(app)
        # Reject master JWT in query string
        bad_res = client.get(f"/api/v1/sync/stream?token={master_jwt}")
        assert bad_res.status_code == 401

        # Mint opaque ticket
        tkt_res = client.post("/api/v1/sync/ticket")
        assert tkt_res.status_code == 200
        ticket = tkt_res.json()["ticket"]
        assert ticket.startswith("stkt_")
        assert tkt_res.json()["expires_in"] == 60

        # Single use works once
        ok_res = client.get(f"/api/v1/sync/stream?ticket={ticket}")
        assert ok_res.status_code == 200
        assert "data:" in ok_res.text

        # Replay fails closed
        replay_res = client.get(f"/api/v1/sync/stream?ticket={ticket}")
        assert replay_res.status_code == 401


# ---------------------------------------------------------------------------
# QA-06: Redirect-hop SSRF + IPv6-mapped IPv4 + response byte cap
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_qa06_ssrf_blocks_ipv6_mapped_redirect_and_oversized_body() -> None:
    import httpx
    import app.services.security_validator as sv

    assert sv.is_safe_external_url("http://[::ffff:127.0.0.1]/admin") is False
    assert sv.is_safe_external_url("http://metadata/computeMetadata/v1/") is False

    # Redirect hop to internal loopback must raise SafeFetchError before connecting to hop
    def _redirect_handler(request: httpx.Request) -> httpx.Response:
        if "example.com" in str(request.url):
            return httpx.Response(302, headers={"location": "http://127.0.0.1:8000/internal-admin"})
        raise AssertionError(f"Should never have requested redirected target {request.url}")

    with patch.object(sv, "is_safe_external_url", side_effect=lambda u: "example.com" in u):
        async with httpx.AsyncClient(transport=httpx.MockTransport(_redirect_handler)) as client:
            with pytest.raises(sv.SafeFetchError, match="Blocked unsafe external URL"):
                await sv.safe_fetch_external("https://example.com/start", client=client)

    # Oversized streamed body must raise SafeFetchError
    class _ChunkedStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b"A" * 60
            yield b"B" * 60

    def _large_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "image/jpeg"}, stream=_ChunkedStream())

    with patch.object(sv, "is_safe_external_url", return_value=True):
        async with httpx.AsyncClient(transport=httpx.MockTransport(_large_handler)) as client:
            with pytest.raises(sv.SafeFetchError, match="exceeded maximum"):
                await sv.safe_fetch_external(
                    "https://example.com/huge.jpg", client=client, max_bytes=100
                )


@pytest.mark.anyio
async def test_qa06_closet_service_blocks_unsafe_external_url() -> None:
    from app.services.closet_service import read_image_bytes_from_url

    out = await read_image_bytes_from_url("http://[::ffff:127.0.0.1]/secret.png")
    assert out is None


# ---------------------------------------------------------------------------
# QA-04: Ad billing viewer-bound single-use token, self-view bypass, rate limit
# ---------------------------------------------------------------------------


def test_qa04_ad_tracking_requires_valid_single_use_token_and_skips_owner() -> None:
    import app.api.v1.ads as ads_api
    from app.services.auth import get_current_user_optional

    ads_api._consumed_ad_events.clear()
    ads_api._ad_rate_buckets.clear()

    fake_db = _FakeDB()
    fake_db.ad_campaigns.docs.append(
        {
            "id": "camp-1",
            "owner_id": "owner-1",
            "status": "active",
            "bid_cents": 10,
            "daily_budget_cents": 1000,
            "spent_today_cents": 0,
            "spent_cents": 0,
            "impressions": 0,
            "clicks": 0,
            "creative": {"title": "Test Ad"},
        }
    )
    fake_db.user_credits.docs.append({"user_id": "owner-1", "currency": "USD", "balance_cents": 500})

    active_user: dict[str, Any] = {"id": "viewer-1"}
    app = FastAPI()
    app.include_router(ads_api.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_optional] = lambda: active_user

    with patch.object(ads_api, "get_db", return_value=fake_db):
        client = TestClient(app)

        # Missing token -> 403
        no_tok = client.post("/api/v1/promotions/impression/camp-1")
        assert no_tok.status_code == 403

        # Fetch ticker as viewer-1 -> gets tracking_token
        ticker = client.get("/api/v1/promotions/ticker")
        assert ticker.status_code == 200
        tok = ticker.json()["items"][0]["tracking_token"]

        # Valid single-use impression charges 1 cent once
        imp1 = client.post(f"/api/v1/promotions/impression/camp-1?token={tok}")
        assert imp1.status_code == 200
        assert imp1.json() == {"ok": True}

        # Replay of impression is blocked
        imp2 = client.post(f"/api/v1/promotions/impression/camp-1?token={tok}")
        assert imp2.status_code == 200
        assert imp2.json() == {"ok": False, "reason": "duplicate"}

        # Same jti permits one click (5 cents) and blocks replay
        clk1 = client.post(f"/api/v1/promotions/click/camp-1?token={tok}")
        assert clk1.status_code == 200
        assert clk1.json() == {"ok": True}
        clk2 = client.post(f"/api/v1/promotions/click/camp-1?token={tok}")
        assert clk2.json() == {"ok": False, "reason": "duplicate"}

        # Balance reflects only 1 imp (1c) + 1 click (5c) = 6c
        assert fake_db.user_credits.docs[0]["balance_cents"] == 494

        # Owner self-view mints token bound to owner-1, skips billing
        active_user["id"] = "owner-1"
        owner_tok = client.get("/api/v1/promotions/ticker").json()["items"][0]["tracking_token"]
        owner_imp = client.post(f"/api/v1/promotions/impression/camp-1?token={owner_tok}")
        assert owner_imp.status_code == 200
        assert owner_imp.json() == {"ok": False, "reason": "owner_self_view"}
        assert fake_db.user_credits.docs[0]["balance_cents"] == 494

        # Rate limit check
        for _ in range(ads_api._AD_MAX_EVENTS_PER_WINDOW):
            ads_api._check_ad_rate_limit("flood-viewer")
        assert ads_api._check_ad_rate_limit("flood-viewer") is False


# ---------------------------------------------------------------------------
# QA-01, QA-02, QA-20: AI credit packs checkout, capture lock/status, Nano Banana race
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_qa01_qa02_ai_credit_purchase_and_capture_guards() -> None:
    import app.api.v1.ai_credits as ac

    # Payload now accepts return_url & cancel_url (fixing 422 checkout block)
    payload = ac.AiCreditPurchaseIn(
        pack="10",
        return_url="https://dressapp.co/pricing?ok=1",
        cancel_url="https://dressapp.co/pricing?cancel=1",
    )
    assert payload.return_url == "https://dressapp.co/pricing?ok=1"

    fake_db = _FakeDB()
    fake_db.users.docs.append({"id": "buyer-1", "credit_buckets": []})
    user = {"id": "buyer-1"}

    # Untrusted return_url origin rejected with 400
    bad_payload = ac.AiCreditPurchaseIn(pack="10", return_url="https://evil.example/steal")
    with patch.object(ac, "get_db", return_value=fake_db):
        with pytest.raises(HTTPException) as exc_info:
            await ac.create_purchase(bad_payload, user=user)
        assert exc_info.value.status_code == 400

    # Lookup by paypal_order_id + non-COMPLETED rejection + completed capture via atomic lock
    fake_db.ai_credit_purchases.docs.append(
        {
            "id": "ai_pur_123",
            "user_id": "buyer-1",
            "credits": 50,
            "paypal_order_id": "PP-ORDER-999",
            "status": "pending",
        }
    )

    with (
        patch.object(ac, "get_db", return_value=fake_db),
        patch.object(ac.settings, "PAYPAL_MOCK_MODE", False),
        patch.object(ac.paypal_client, "is_configured", return_value=True),
        patch.object(
            ac.paypal_client,
            "capture_order",
            new=AsyncMock(return_value={"status": "PENDING"}),
        ),
    ):
        with pytest.raises(HTTPException) as not_done:
            await ac.capture_purchase("PP-ORDER-999", user=user)
        assert not_done.value.status_code == 402
        assert fake_db.ai_credit_purchases.docs[0]["status"] == "pending"

    add_paid_mock = AsyncMock(return_value=True)
    with (
        patch.object(ac, "get_db", return_value=fake_db),
        patch.object(ac.settings, "PAYPAL_MOCK_MODE", False),
        patch.object(ac.paypal_client, "is_configured", return_value=True),
        patch.object(
            ac.paypal_client,
            "capture_order",
            new=AsyncMock(
                return_value={
                    "purchase_units": [{"payments": {"captures": [{"id": "CAP1", "status": "COMPLETED"}]}}]
                }
            ),
        ),
        patch("app.services.credit_manager.add_paid_credits", add_paid_mock),
    ):
        ok_res = await ac.capture_purchase("PP-ORDER-999", user=user)
        assert ok_res["success"] is True
        assert ok_res["credits_added"] == 50
        assert fake_db.ai_credit_purchases.docs[0]["status"] == "captured"
        add_paid_mock.assert_awaited_once_with("buyer-1", 50)

        # Replay returns already_captured without double-crediting
        replay = await ac.capture_purchase("PP-ORDER-999", user=user)
        assert replay["already_captured"] is True
        assert add_paid_mock.await_count == 1


@pytest.mark.anyio
async def test_qa02_capture_topup_has_db_and_enforces_completed_and_lock() -> None:
    import app.api.v1.payments as pay_api

    fake_db = _FakeDB()
    fake_db.credit_topups.docs.append(
        {
            "id": "topup-1",
            "user_id": "buyer-1",
            "paypal_order_id": "PP-TOP-1",
            "amount_cents": 500,
            "currency": "USD",
            "status": "pending",
        }
    )

    with (
        patch.object(pay_api, "get_db", return_value=fake_db),
        patch.object(
            pay_api.paypal_client,
            "capture_order",
            new=AsyncMock(return_value={"status": "PENDING"}),
        ),
    ):
        res = await pay_api.capture_topup("topup-1", user={"id": "buyer-1"})
        assert res["ok"] is False
        assert fake_db.credit_topups.docs[0]["status"] == "pending"
        assert res["balance"]["balance_cents"] == 0

    # Simulated in-flight capturing state triggers 409 conflict
    fake_db.credit_topups.docs[0]["status"] = "capturing"
    with patch.object(pay_api, "get_db", return_value=fake_db):
        with pytest.raises(HTTPException) as exc_info:
            await pay_api.capture_topup("topup-1", user={"id": "buyer-1"})
        assert exc_info.value.status_code == 409


@pytest.mark.anyio
async def test_qa02_qa20_nano_banana_atomic_cap_and_add_paid_credits_push() -> None:
    from app.services import credit_manager as cm

    fake_db = _FakeDB()
    today_iso = datetime.now(timezone.utc).date().isoformat()
    fake_db.users.docs.append(
        {
            "id": "u-nb",
            "ai_configuration": {
                "nano_banana_cycle_start": today_iso,
                "nano_banana_monthly_used": 99,
            },
            "credit_buckets": [],
        }
    )

    # First increment succeeds cleanly (99 -> 100)
    assert await cm.check_and_increment_nano_banana_monthly(fake_db, "u-nb", cost=1) is True
    # Concurrent/subsequent call fails closed (100 >= 100)
    assert await cm.check_and_increment_nano_banana_monthly(fake_db, "u-nb", cost=1) is False

    # add_paid_credits uses $push rather than read-modify-write $set
    with patch.object(cm, "get_db", return_value=fake_db):
        ok = await cm.add_paid_credits("u-nb", 25)
        assert ok is True
        assert fake_db.users.docs[0]["credit_buckets"][-1]["amount"] == 25
        assert fake_db.users.docs[0]["credit_buckets"][-1]["type"] == "paid"
        last_update_op = fake_db.users.calls[-1][1][1]
        assert "$push" in last_update_op


# ---------------------------------------------------------------------------
# QA-03 & QA-07: Scheduler free credit non-drain + Stylist pre-LLM reservation
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_qa03_scheduler_does_not_drain_credits_before_schedule_match() -> None:
    import app.services.scheduler as sched_mod

    now = datetime.now(timezone.utc)
    # Schedule notification hour far away from current UTC minute/hour
    other_hour = (now.hour + 6) % 24
    fake_db = _FakeDB()
    fake_db.users.docs.append(
        {
            "id": "free-user-1",
            "subscription_tier": "free",
            "scheduler_settings": {
                "enabled": True,
                "timezone": "UTC",
                "notification_time": f"{other_hour:02d}:00",
                "frequency": "everyday",
            },
        }
    )

    deduct_mock = AsyncMock(return_value=True)
    with (
        patch.object(sched_mod, "get_db", return_value=fake_db),
        patch("app.services.billing_service.deduct_user_credits", deduct_mock),
    ):
        await sched_mod.check_scheduler_triggers()
        deduct_mock.assert_not_awaited()


def test_qa07_stylist_reserves_credit_before_llm_and_refunds_on_error() -> None:
    import app.api.v1.stylist as stylist_api
    from app.services.auth import get_current_user

    fake_db = _FakeDB()
    user = {"id": "u-sty", "subscription_tier": "free"}
    app = FastAPI()
    app.include_router(stylist_api.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: user

    get_advice_mock = AsyncMock()
    append_mock = AsyncMock()

    with (
        patch.object(stylist_api, "get_or_create_active_session", AsyncMock(return_value={"id": "sess-1", "turns": 0})),
        patch.object(stylist_api, "recent_messages", AsyncMock(return_value=[])),
        patch.object(stylist_api, "closet_summary_for", AsyncMock(return_value=[])),
        patch("app.services.stylist_scheduler_brain.get_rotation_prioritized_closet", AsyncMock(return_value=[])),
        patch("app.db.database.get_db", return_value=fake_db),
        patch("app.services.billing_service.deduct_user_credits", AsyncMock(return_value=False)),
        patch.object(stylist_api, "append_message", append_mock),
        patch.object(stylist_api, "get_styling_advice", get_advice_mock),
    ):
        client = TestClient(app)
        resp = client.post("/api/v1/stylist", data={"text": "What should I wear?"})
        assert resp.status_code == 402
        append_mock.assert_not_awaited()
        get_advice_mock.assert_not_awaited()

    refund_mock = AsyncMock()
    with (
        patch.object(stylist_api, "get_or_create_active_session", AsyncMock(return_value={"id": "sess-1", "turns": 0})),
        patch.object(stylist_api, "recent_messages", AsyncMock(return_value=[])),
        patch.object(stylist_api, "closet_summary_for", AsyncMock(return_value=[])),
        patch("app.services.stylist_scheduler_brain.get_rotation_prioritized_closet", AsyncMock(return_value=[])),
        patch("app.db.database.get_db", return_value=fake_db),
        patch("app.services.billing_service.deduct_user_credits", AsyncMock(return_value=True)),
        patch("app.services.billing_service.get_user_tier", return_value="free"),
        patch("app.services.billing_service.refund_user_credits", refund_mock),
        patch.object(stylist_api, "append_message", AsyncMock(return_value={"id": "m1"})),
        patch.object(stylist_api, "get_styling_advice", AsyncMock(side_effect=RuntimeError("LLM down"))),
    ):
        client = TestClient(app)
        resp503 = client.post("/api/v1/stylist", data={"text": "What should I wear?"})
        assert resp503.status_code == 503
        refund_mock.assert_awaited_once()


# ---------------------------------------------------------------------------
# QA-08: Google Calendar scope honesty & login-only scope preservation
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_qa08_calendar_scope_truthfulness_and_preservation() -> None:
    import app.api.v1.google_auth as gauth
    from app.services import calendar_service as cal_mod
    from app.services.calendar_service import CalendarService

    svc = CalendarService()
    assert CalendarService.has_calendar_scope({"scope": "openid email profile"}) is False
    assert (
        CalendarService.has_calendar_scope(
            {"scope": "openid https://www.googleapis.com/auth/calendar.events.readonly"}
        )
        is True
    )

    login_only_user = {
        "id": "u-cal",
        "google_calendar_tokens": {
            "refresh_token": "rt-login",
            "scope": "openid email profile",
            "google_email": "u@example.com",
        },
    }
    status_res = await gauth.calendar_status(user=login_only_user)
    assert status_res["connected"] is False
    assert status_res["calendar_scope_granted"] is False
    assert status_res["needs_reconsent"] is True

    with patch.object(gauth.calendar_service, "get_events_for_user", AsyncMock(return_value=[])):
        upcoming_res = await gauth.calendar_upcoming(hours_ahead=48, user=login_only_user)
        assert upcoming_res["connected"] is False
        assert upcoming_res["scope_missing"] is True
        assert upcoming_res["needs_reconsent"] is True

    # Prior granted calendar scope must survive a subsequent login-only token save
    fake_db = _FakeDB()
    fake_db.users.docs.append(
        {
            "id": "u-cal",
            "google_calendar_tokens": {
                "refresh_token": "rt-cal-prev",
                "access_token": "at-cal-prev",
                "scope": "openid email https://www.googleapis.com/auth/calendar.events.readonly",
            },
        }
    )
    with (
        patch.object(cal_mod, "get_db", return_value=fake_db),
        patch.object(svc, "fetch_userinfo", AsyncMock(return_value={"email": "u@example.com"})),
    ):
        saved = await svc.persist_tokens_for_user(
            "u-cal",
            {"access_token": "at-login-only", "scope": "openid email profile"},
        )
        assert CalendarService.has_calendar_scope(saved) is True
        assert saved["refresh_token"] == "rt-cal-prev"


# ---------------------------------------------------------------------------
# QA-10 & QA-11: Eyes evaluation fail-closed & active model/timeout alignment
# ---------------------------------------------------------------------------


def test_qa10_qa11_eyes_eval_fail_closed_and_brain_timeout(tmp_path: Path) -> None:
    import evaluate_eyes
    from app.config import settings
    from app.services.stylist_brain import GemmaStylistBrain

    assert evaluate_eyes.MIN_REQUIRED_LIVE_SAMPLES == 50

    val_file = tmp_path / "val.jsonl"
    sample = {
        "id": "s1",
        "type": "garment",
        "messages": [
            {"role": "user", "content": "Analyze item"},
            {
                "role": "assistant",
                "content": json.dumps(
                    {
                        "title": "Black Jacket",
                        "category": "outerwear",
                        "sub_category": "jacket",
                        "color": "black",
                        "material": "leather",
                    }
                ),
            },
        ],
    }
    val_file.write_text(json.dumps(sample) + "\n", encoding="utf-8")

    # Missing CUDA / adapter must fail closed when mock_eval=False
    with patch.object(evaluate_eyes, "try_load_adapter_model", return_value=None):
        with pytest.raises(RuntimeError, match="Fail closed"):
            evaluate_eyes.run_evaluation(val_dataset=val_file, mock_eval=False)

    # Stale / tampered metrics_out without matching dataset sha must NOT be accepted
    stale_metrics = tmp_path / "metrics.json"
    stale_metrics.write_text(
        json.dumps(
            {
                "eval_schema_version": evaluate_eyes._EVAL_SCHEMA_VERSION,
                "status": "PASSED",
                "dataset_sha256": "deadbeef",
                "adapter_digest": "none",
                "live_samples_evaluated": 50,
                "ground_truth_fallback_count": 0,
                "schema_accuracy": 1.0,
                "category_accuracy": 1.0,
                "shoes_accessory_accuracy": 1.0,
            }
        ),
        encoding="utf-8",
    )
    with patch.object(evaluate_eyes, "try_load_adapter_model", return_value=None):
        with pytest.raises(RuntimeError, match="Fail closed"):
            evaluate_eyes.run_evaluation(
                val_dataset=val_file,
                metrics_out=stale_metrics,
                trust_gpu_metrics=True,
                mock_eval=False,
            )

    # GemmaStylistBrain model alignment
    brain = GemmaStylistBrain()
    assert brain.model == "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"
    assert settings.EYES_GEMMA_TIMEOUT_S >= 300.0
    eyes_main_src = (ROOT / "inference-server" / "eyes" / "main.py").read_text(encoding="utf-8")
    assert "gemini-2.5-flash" not in eyes_main_src
