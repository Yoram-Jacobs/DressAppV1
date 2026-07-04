"""
test_credits_billing.py
=======================
Offline integration test for the credits & billing cycle.
No real MongoDB or PayPal credentials required.

Verifies:
  1. Stylist turn  → deducts 1 credit, increments credits_used_this_month
  2. PayPal topup  → adds credits, resets credits_used_this_month to 0
  3. Thank-you email is dispatched after a successful capture

Run from the backend directory:
    .\\venv\\Scripts\\python.exe -m pytest test_credits_billing.py -v

Dependencies (already in requirements.txt or installable):
    pip install mongomock
"""

import os
import sys
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

# ---------------------------------------------------------------------------
# Bootstrap: env vars must be set BEFORE server.py is imported because
# server.py reads os.environ at module-load time (not lazy).
# When this file runs from c:\\DressApp_AG\\backend, __file__ resolves
# correctly and we avoid any hardcoded absolute paths.
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

_ENV_DEFAULTS = {
    "MONGO_URL": "mongodb://localhost:27017",  # won't actually connect — mocked below
    "DB_NAME": "dressapp_test",
    "JWT_SECRET": "test-jwt-secret-not-for-production",
    "PAYPAL_SANDBOX_CLIENT_ID": "DUMMY_CID",
    "PAYPAL_SANDBOX_SECRET": "DUMMY_SECRET",
    "GOOGLE_AI_API_KEY": "DUMMY_KEY",
}
for _k, _v in _ENV_DEFAULTS.items():
    os.environ.setdefault(_k, _v)

# ---------------------------------------------------------------------------
# Async shim over mongomock's sync client.
#
# mongomock 4.3 has no motor_asyncio module, so we build a minimal wrapper
# that makes every collection method return an awaitable and makes cursors
# async-iterable — matching the Motor interface the app expects.
#
# Supported cursor modifiers: sort(), limit(), skip(), allow_disk_use()
# ---------------------------------------------------------------------------
import mongomock


class _AsyncCursor:
    """Wraps a sync mongomock Cursor so `async for` works."""

    def __init__(self, cursor):
        self._cursor = cursor
        self._items = None

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._items is None:
            self._items = iter(list(self._cursor))
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


class _AsyncCollection:
    def __init__(self, coll):
        self._coll = coll

    def __getattr__(self, name):
        attr = getattr(self._coll, name)
        if callable(attr):
            async def _async_wrapper(*a, **kw):
                result = attr(*a, **kw)
                import pymongo
                if isinstance(result, pymongo.cursor.Cursor):
                    return _AsyncCursor(result)
                return result
            return _async_wrapper
        return attr

    def find(self, *a, **kw):
        """find() returns a chainable AsyncCursor, not a coroutine."""
        sync_coll = self._coll

        class _ChainCursor(_AsyncCursor):
            def __init__(self):
                super().__init__(sync_coll.find(*a, **kw))

            def sort(self, key_or_list, direction=None):
                if direction is not None:
                    self._cursor = self._cursor.sort(key_or_list, direction)
                else:
                    self._cursor = self._cursor.sort(key_or_list)
                return self

            def limit(self, n):
                self._cursor = self._cursor.limit(n)
                return self

            def skip(self, n):
                self._cursor = self._cursor.skip(n)
                return self

            def allow_disk_use(self, value=True):
                # No-op: mongomock is always in-memory; Atlas hint not needed.
                return self

        return _ChainCursor()


class _AsyncDB:
    def __init__(self, db):
        self._db = db

    def __getattr__(self, name):
        return _AsyncCollection(self._db[name])

    def __getitem__(self, name):
        return _AsyncCollection(self._db[name])


_SYNC_CLIENT = mongomock.MongoClient()
_MOCK_DB = _AsyncDB(_SYNC_CLIENT["dressapp_test"])


def _mock_get_db():
    """Drop-in for get_db() — returns the shared in-memory database."""
    return _MOCK_DB


# ---------------------------------------------------------------------------
# Patch get_db at every import point before server.py is loaded.
# • app.db.database.get_db  — covers modules that do a lazy local import
#                             (e.g. stylist.py: `from app.db.database import get_db`
#                              inside the function body)
# • app.api.v1.payments.get_db — covers top-level imports already bound
#                                 in the payments module namespace
# ---------------------------------------------------------------------------
_PATCH_TARGETS = [
    "app.db.database.get_db",
    "app.api.v1.payments.get_db",
]
_active_patches = []
for _target in _PATCH_TARGETS:
    _p = patch(_target, side_effect=_mock_get_db)
    _p.start()
    _active_patches.append(_p)

# Safe to import server now that get_db and env vars are ready.
from fastapi.testclient import TestClient  # noqa: E402
from server import app                      # noqa: E402
from app.services.auth import get_current_user  # noqa: E402


# ---------------------------------------------------------------------------
# Helper: run a coroutine from sync test code using the per-test event loop.
# ---------------------------------------------------------------------------
def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------
class TestCreditsBilling(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.db = _MOCK_DB
        app.dependency_overrides.clear()
        # Create a fresh event loop for each test to avoid deprecation warnings
        # and cross-test event-loop contamination.
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        # Wipe all relevant collections for full test isolation.
        loop.run_until_complete(self.db.users.drop())
        loop.run_until_complete(self.db.credit_topups.drop())
        loop.run_until_complete(self.db.user_credits.drop())
        loop.run_until_complete(self.db.stylist_sessions.drop())
        loop.run_until_complete(self.db.stylist_messages.drop())

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("app.api.v1.stylist.get_styling_advice")
    @patch("app.services.paypal_client.capture_order", new_callable=AsyncMock)
    @patch("app.services.email_service.send_thank_you_payment", new_callable=AsyncMock)
    @patch("app.services.paypal_client.is_configured", return_value=True)
    def test_credit_deduction_and_billing_cycle(
        self,
        mock_is_configured,
        mock_send_email,
        mock_capture_order,
        mock_get_styling_advice,
    ):
        """
        Full billing cycle:
          1. Stylist turn deducts 1 credit and increments monthly usage counter.
          2. PayPal topup capture credits the balance and resets the counter.
          3. A thank-you email is dispatched.
        """
        # ------------------------------------------------------------------
        # 1. Seed the test user (100 credits, 5 used this month)
        # ------------------------------------------------------------------
        test_user = {
            "id": "test-user-billing-id",
            "email": "test-billing@dressapp.co",
            "preferred_language": "he",
            "ai_configuration": {
                "provider_mode": "standard",
                "current_credits": 100,
                "credits_used_this_month": 5,
            },
        }
        app.dependency_overrides[get_current_user] = lambda: test_user

        _run(self.db.users.delete_many({"id": test_user["id"]}))
        _run(self.db.users.insert_one(dict(test_user)))

        mock_get_styling_advice.return_value = {
            "reasoning_summary": "Looking sharp!",
            "outfit_recommendations": [],
        }

        # ------------------------------------------------------------------
        # 2. Stylist turn → expect 1 credit deducted
        # ------------------------------------------------------------------
        response = self.client.post(
            "/api/v1/stylist",
            data={"text": "Suggest an outfit for today"},
        )
        self.assertEqual(
            response.status_code, 200,
            f"Stylist endpoint failed: {response.status_code} — {response.text[:300]}",
        )

        usr = _run(self.db.users.find_one({"id": test_user["id"]}))
        self.assertEqual(
            usr["ai_configuration"]["current_credits"], 99,
            "Expected 1 credit deducted after stylist turn",
        )
        self.assertEqual(
            usr["ai_configuration"]["credits_used_this_month"], 6,
            "Expected credits_used_this_month incremented to 6",
        )

        # ------------------------------------------------------------------
        # 3. Insert a pending PayPal topup document ($10 = 2000 credits)
        # ------------------------------------------------------------------
        topup_doc = {
            "id": "topup-test-123",
            "user_id": test_user["id"],
            "amount_cents": 1000,   # $10.00 → 1000 × 2 = 2000 credits
            "currency": "USD",
            "status": "pending",
            "paypal_order_id": "paypal-order-test-123",
        }
        _run(self.db.credit_topups.delete_many({"id": topup_doc["id"]}))
        _run(self.db.credit_topups.insert_one(dict(topup_doc)))

        mock_capture_order.return_value = {
            "status": "COMPLETED",
            "purchase_units": [
                {
                    "payments": {
                        "captures": [{"id": "capture-test-123", "status": "COMPLETED"}]
                    }
                }
            ],
            "payer": {"email_address": "payer@dressapp.co"},
        }

        # ------------------------------------------------------------------
        # 4. Capture the topup
        # ------------------------------------------------------------------
        response = self.client.post(
            f"/api/v1/credits/topup/{topup_doc['id']}/capture"
        )
        self.assertEqual(
            response.status_code, 200,
            f"Capture endpoint failed: {response.status_code} — {response.text[:300]}",
        )

        # ------------------------------------------------------------------
        # 5. Verify final state
        # ------------------------------------------------------------------
        # Note: capture_topup reads existing_credits from the get_current_user
        # dependency (the injected object), not a fresh DB read. In this test
        # the dependency is frozen at 100 credits, so: 100 + 2000 = 2100.
        # In production, get_current_user fetches fresh from DB (post-deduction
        # value = 99), giving 99 + 2000 = 2099.
        usr = _run(self.db.users.find_one({"id": test_user["id"]}))
        self.assertEqual(
            usr["ai_configuration"]["current_credits"], 2100,
            f"Expected 2100 credits after topup, got {usr['ai_configuration'].get('current_credits')}",
        )
        self.assertEqual(
            usr["ai_configuration"]["credits_used_this_month"], 0,
            "Expected monthly usage counter reset to 0 after payment",
        )

        # Verify thank-you email was dispatched exactly once.
        mock_send_email.assert_called_once()


# ---------------------------------------------------------------------------
# Stop patches on process exit (avoids ResourceWarning in some environments)
# ---------------------------------------------------------------------------
import atexit  # noqa: E402
for _p in _active_patches:
    atexit.register(_p.stop)


if __name__ == "__main__":
    unittest.main()
