"""Regression tests for P2 QA remediations (fees, canonical data, offload, trends, migration, i18n)."""
from __future__ import annotations

import base64
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "pytest-p2-secret-value-0123456789abcdef")

from tests.test_p0_remediations import _FakeCollection, _FakeDB, _matches_filter  # noqa: E402


class _SortableFakeCursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = list(docs)
        self._idx = 0

    def sort(self, key_or_list, direction: int = 1) -> "_SortableFakeCursor":
        pairs = [(key_or_list, direction)] if isinstance(key_or_list, str) else list(key_or_list)
        for field, order in reversed(pairs):
            self._docs.sort(key=lambda d: str(d.get(field) or ""), reverse=(order == -1))
        return self

    def limit(self, n: int) -> "_SortableFakeCursor":
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        return list(self._docs[:length] if length is not None else self._docs)

    def __aiter__(self) -> "_SortableFakeCursor":
        self._idx = 0
        return self

    async def __anext__(self) -> dict:
        if self._idx >= len(self._docs):
            raise StopAsyncIteration
        item = self._docs[self._idx]
        self._idx += 1
        return item


class _SortableFakeCollection(_FakeCollection):
    def find(self, flt: dict | None = None, _proj=None) -> _SortableFakeCursor:
        matched = [dict(d) for d in self.docs if _matches_filter(d, flt or {})]
        return _SortableFakeCursor(matched)


def test_p2_fees_paypal_schedule_and_fail_closed_mock_mode() -> None:
    from app.services.fees import compute_fees

    # $100.00 -> PayPal 3.49% ($3.49) + $0.49 = $3.98 (398 cents)
    # net after PayPal = 9602 cents; 7% platform fee = 672 cents; seller net = 8930 cents
    b = compute_fees(10000)
    assert b.processing_fee_cents == 398
    assert b.stripe_fee_cents == 398
    assert b.net_after_stripe_cents == 9602
    assert b.platform_fee_cents == 672
    assert b.seller_net_cents == 8930
    assert b.platform_fee_applied_after == "paypal_processing_fee"

    # Zero-value swap/donate must not incur fixed $0.49 fee
    b0 = compute_fees(0)
    assert b0.processing_fee_cents == 0
    assert b0.seller_net_cents == 0

    # Fail-closed PAYPAL_MOCK_MODE when APP_ENV=production in a clean subprocess (no pytest module, no reload side effects)
    env = dict(os.environ)
    env["APP_ENV"] = "production"
    env.pop("PAYPAL_MOCK_MODE", None)
    env.pop("PYTEST_CURRENT_TEST", None)
    out = subprocess.check_output(
        [
            sys.executable,
            "-c",
            "import app.config as c; print(int(c._IS_DEV_OR_TEST), int(c.Settings.PAYPAL_MOCK_MODE))",
        ],
        cwd=str(BACKEND_DIR),
        env=env,
        text=True,
    )
    assert out.strip() == "0 0"


def test_p2_canonicalize_category_and_measurements() -> None:
    from app.api.v1.closet.common import CreateItemIn, UpdateItemIn
    from app.api.v1.listings import CreateListingIn, UpdateListingIn
    from app.services.canonical import canonicalize_category, canonicalize_measurements

    assert canonicalize_category("חלק עליון") == "Top"
    assert canonicalize_category("bottoms") == "Bottom"
    assert canonicalize_category("shoes") == "Footwear"
    assert canonicalize_category("dresses") == "Full Body"
    assert canonicalize_category("outerwear") == "Outerwear"

    ci = CreateItemIn(title="Tee", category="tops")
    assert ci.category == "Top"
    ui = UpdateItemIn(category="חלק עליון")
    assert ui.category == "Top"

    li = CreateListingIn(title="Jeans", category="bottoms", list_price_cents=2500)
    assert li.category == "Bottom"
    ul = UpdateListingIn(category="shoes")
    assert ul.category == "Footwear"

    norm = canonicalize_measurements(
        {"height_cm": 175, "chest_cm": 98, "hips_cm": 99, "waist": 82}
    )
    assert norm == {"height": 175, "chest": 98, "hip": 99, "waist": 82}


@pytest.mark.anyio
async def test_p2_outfit_and_listing_offload_oversized_base64() -> None:
    from app.api.v1.listings import CreateListingIn, create_listing
    from app.api.v1.outfits import GarmentItemIn, SaveOutfitIn, save_outfit

    big_data_url = "data:image/png;base64," + base64.b64encode(b"x" * 20_000).decode("ascii")
    assert len(big_data_url) > 15_000

    fake_db = _FakeDB()
    fake_db.closet_items = _FakeCollection(
        [{"id": "it-1", "user_id": "u-p2", "title": "Blue Shirt", "category": "Top", "clean_image_url": big_data_url}]
    )
    fake_db.outfits = _FakeCollection()
    fake_db.outfits.insert_one = AsyncMock()
    fake_db.closet_items.update_many = AsyncMock()

    user = {
        "id": "u-p2",
        "subscription": {"is_active": True, "tier": "manager", "plan_type": "monthly"},
    }

    with (
        patch("app.api.v1.outfits.get_db", return_value=fake_db),
        patch("app.services.sync_service.broadcast_sync_event", new_callable=AsyncMock),
        patch(
            "app.services.upload_manager.UploadManager.upload_data_url",
            new_callable=AsyncMock,
            return_value="/static/uploads/offloaded.png",
        ) as mock_upload,
    ):
        res = await save_outfit(
            SaveOutfitIn(
                name="Work Look",
                garments=[GarmentItemIn(closet_item_id="it-1", role="top")],
            ),
            user=user,
        )
        assert mock_upload.await_count >= 1
        assert res["garments"][0]["image_url"] == "/static/uploads/offloaded.png"

    fake_db.listings = _FakeCollection()
    fake_repos = SimpleNamespace(
        find_one=AsyncMock(return_value=None),
        insert=AsyncMock(side_effect=lambda col, doc: col.docs.append(doc)),
    )
    with (
        patch("app.api.v1.listings.get_db", return_value=fake_db),
        patch("app.api.v1.listings.repos", fake_repos),
        patch("app.api.v1.listings.attach_listing_clip_embedding", new_callable=AsyncMock, create=True),
        patch("app.services.fashion_clip.attach_listing_clip_embedding", new_callable=AsyncMock),
        patch(
            "app.api.v1.listings.UploadManager.upload_data_url",
            new_callable=AsyncMock,
            return_value="/static/uploads/listing_offloaded.webp",
        ) as mock_l_upload,
    ):
        lst = await create_listing(
            CreateListingIn(
                title="Vintage Coat",
                category="outerwear",
                list_price_cents=5000,
                images=[big_data_url],
            ),
            user=user,
        )
        assert mock_l_upload.await_count >= 1
        assert lst["category"] == "Outerwear"
        assert lst["images"] == ["/static/uploads/listing_offloaded.webp"]


@pytest.mark.anyio
async def test_p2_migration_session_status_and_trend_pt_normalization() -> None:
    from PIL import Image

    from app.services.migration.wardrobe_migration_agent import WardrobeMigrationAgent
    from app.services.trend_scout import fashion_scout_feed, latest_trend_cards

    fake_db = _FakeDB()
    fake_db.users = _FakeCollection([{"id": "u-mig"}])
    fake_db.migration_sessions = _FakeCollection()
    fake_db.migration_sessions.insert_one = AsyncMock(
        side_effect=lambda d: fake_db.migration_sessions.docs.append(dict(d))
    )
    async def _upd(flt, op):
        for d in fake_db.migration_sessions.docs:
            if d.get("id") == flt.get("id"):
                d.update(op.get("$set", {}))
    fake_db.migration_sessions.update_one = AsyncMock(side_effect=_upd)

    agent = WardrobeMigrationAgent(api_key="test-key")
    img = Image.new("RGB", (200, 200), (200, 200, 200))
    with (
        patch("app.services.migration.wardrobe_migration_agent.get_db", return_value=fake_db),
        patch.object(agent.client, "vision", new_callable=AsyncMock, return_value='{"garments": [], "should_scroll": false}'),
    ):
        res = await agent.process_step("sess-p2", "u-mig", "Whering", img)
        assert res["status"] == "completed"
        assert fake_db.migration_sessions.docs[0]["status"] == "completed"

    # Trend reports normalization ('ISRAEL ' -> 'IL') & BCP-47 'pt-BR' -> 'pt'
    from app.services import trend_scout

    trend_scout._trend_feed_cache.clear()
    fake_db.trend_reports = _SortableFakeCollection(
        [
            {
                "id": "card-en-1",
                "origin_id": None,
                "bucket": "local",
                "gender": "female",
                "date": "2026-11-17",
                "language": "en",
                "country_code": "IL",
                "headline": "Linen Suiting",
                "body": "Light relaxed tailoring.",
                "source_url": "https://fashion.walla.co.il/item/12345",
                "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600",
            },
            {
                "id": "card-pt-trans",
                "origin_id": "card-en-1",
                "bucket": "local",
                "gender": "female",
                "date": "2026-11-17",
                "language": "pt",
                "country_code": "IL",
                "headline": "Alfaiataria em linho",
                "body": "Cortes leves e elegantes.",
                "source_url": "https://fashion.walla.co.il/item/12345",
                "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600",
            },
        ]
    )
    with (
        patch("app.services.trend_scout.get_db", return_value=fake_db),
        patch("app.services.trend_scout.ensure_seed_data", new_callable=AsyncMock),
    ):
        latest = await latest_trend_cards(country="ISRAEL ", gender="female")
        assert latest and latest[0]["country_code"] == "IL"

        pt_feed = await fashion_scout_feed(limit=5, language="pt-BR", country="ISRAEL ", gender="female")
        assert len(pt_feed) == 1
        assert pt_feed[0]["language"] == "pt"


def test_p2_i18n_resolver_and_unique_balance_route() -> None:
    from app.api.v1.ai_credits import ai_credits_router
    from app.services import i18n

    resolved = i18n._resolve_locales_dir()
    assert resolved.is_dir()
    en_locale = i18n._load_locale("en")
    assert len(en_locale.get("about", {})) >= 92

    balance_routes = [
        r for r in ai_credits_router.routes
        if getattr(r, "path", "") == "/ai-credits/balance" and "GET" in getattr(r, "methods", set())
    ]
    assert len(balance_routes) == 1


@pytest.mark.anyio
async def test_p2_db_cleanup_script_idempotent_on_fake_db() -> None:
    import scripts.p2_db_cleanup as cleanup_mod

    big_data_url = "data:image/webp;base64," + base64.b64encode(b"y" * 20_000).decode("ascii")
    fake_db = _FakeDB()
    fake_db.closet_items = _FakeCollection([{"id": "c1", "category": "חלק עליון"}])
    fake_db.listings = _FakeCollection([{"id": "l1", "category": "tops", "images": [big_data_url]}])
    fake_db.outfits = _FakeCollection([{"id": "o1", "garments": [{"image_url": big_data_url}]}])
    fake_db.users = _FakeCollection([{"id": "u1", "body_measurements": {"chest_cm": 96, "hips": 98}}])
    fake_db.trend_reports = _FakeCollection([{"id": "t1", "country_code": "ISRAEL "}])
    fake_db.migration_sessions = _FakeCollection([{"id": "m1", "parsed_hashes": ["abcd"], "status": None}])
    fake_db.credit_topups = _FakeCollection([{"id": "topup-123", "user_id": "test-user-billing-id"}])
    fake_db.atzmai_topups = _FakeCollection([{"id": "a1", "payment_url": "https://example.com/mock-atzmai-payment-link?x=1"}])
    fake_db.ad_campaigns = _FakeCollection([{"id": "demo-campaign-01"}])

    for col in (
        fake_db.closet_items,
        fake_db.listings,
        fake_db.outfits,
        fake_db.users,
        fake_db.trend_reports,
        fake_db.migration_sessions,
        fake_db.credit_topups,
        fake_db.atzmai_topups,
        fake_db.ad_campaigns,
    ):
        async def _upd_one(flt, op, _col=col):
            for d in _col.docs:
                if ("id" in flt and d.get("id") == flt["id"]):
                    d.update(op.get("$set", {}))
            return SimpleNamespace(modified_count=1)

        async def _del_many(q, _col=col):
            before = len(_col.docs)
            _col.docs[:] = []
            return SimpleNamespace(deleted_count=before)

        col.update_one = AsyncMock(side_effect=_upd_one)
        col.delete_many = AsyncMock(side_effect=_del_many)

    with (
        patch.object(cleanup_mod, "get_db", return_value=fake_db),
        patch.object(
            cleanup_mod.UploadManager,
            "upload_data_url",
            new_callable=AsyncMock,
            return_value="/static/uploads/migrated.webp",
        ),
    ):
        summary = await cleanup_mod.run_cleanup(dry_run=False, warm_pt=False, purge_test_rows=True)
        assert summary["closet_categories_normalized"] == 1
        assert summary["listings_categories_normalized"] == 1
        assert summary["listings_media_offloaded"] == 1
        assert summary["outfits_media_offloaded"] == 1
        assert summary["users_measurements_normalized"] == 1
        assert summary["trend_countries_normalized"] == 1
        assert summary["trend_country_duplicates_removed"] == 0
        assert summary["migration_sessions_backfilled"] == 1
        assert summary["test_rows_purged"] == {"credit_topups": 1, "atzmai_topups": 1, "ad_campaigns": 1}

    # Verify E11000 DuplicateKeyError on trend_reports deletes the colliding legacy row
    dup_db = _FakeDB()
    for name in ("closet_items", "listings", "outfits", "users", "migration_sessions"):
        setattr(dup_db, name, _FakeCollection([]))
    dup_db.trend_reports = _FakeCollection([{"_id": "oid-dup", "id": "t-dup", "country_code": "ISRAEL"}])

    class _FakeDupError(Exception):
        pass

    async def _raise_dup(*_a, **_kw):
        raise _FakeDupError("E11000 duplicate key error")

    dup_db.trend_reports.update_one = AsyncMock(side_effect=_raise_dup)
    dup_db.trend_reports.delete_one = AsyncMock(return_value=SimpleNamespace(deleted_count=1))
    with patch.object(cleanup_mod, "get_db", return_value=dup_db):
        dup_summary = await cleanup_mod.run_cleanup(dry_run=False, warm_pt=False, purge_test_rows=False)
        assert dup_summary["trend_countries_normalized"] == 1
        assert dup_summary["trend_country_duplicates_removed"] == 1
        dup_db.trend_reports.delete_one.assert_awaited_once_with({"_id": "oid-dup"})
