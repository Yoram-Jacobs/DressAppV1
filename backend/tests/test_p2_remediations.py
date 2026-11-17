"""Regression tests for P2 QA remediations (QA-22, QA-24, QA-25, QA-28, QA-29, QA-32)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1 import payments, wiki
from app.db.database import get_db
from app.services import credit_manager, session_titles
from app.services.vision import validation
from server import app


def test_session_title_fallback_strips_trailing_prepositions():
    title = session_titles._fallback_title("תכנון תלבושת לערב של החבר הכי טוב")
    assert not title.endswith(" של")
    en_title = session_titles._fallback_title("Need an outfit suggestion for the wedding of my cousin")
    assert not en_title.lower().endswith(" of")


def test_clean_color_name_normalizes_corrupted_hebrew_grey():
    assert validation._clean_color_name("אlפור", "he") == "Grey"
    assert validation._clean_color_name("אlפור", "he") == validation._clean_color_name("אפור", "he")


def test_platform_fee_math_uses_paypal_processing_fee_fields():
    fin = payments._platform_fee_math(10000)
    assert fin.platform_fee_applied_after == "paypal_processing_fee"
    assert fin.processing_fee_cents is not None
    assert fin.processing_fee_cents == fin.stripe_fee_cents


def test_resolve_safe_wiki_file_blocks_path_traversal():
    assert wiki._resolve_safe_wiki_file("en", "overview") is not None
    assert wiki._resolve_safe_wiki_file("../backend", "server") is None
    assert wiki._resolve_safe_wiki_file("en", "../../.env") is None
    assert wiki._resolve_safe_wiki_file("en/sub", "overview") is None
    assert wiki._resolve_safe_wiki_file("en", r"..\overview") is None


@pytest.mark.anyio
async def test_wait_for_credit_replenishment_fails_fast_without_sleeping():
    db = get_db()
    now = datetime.now(timezone.utc)
    future = (now + timedelta(days=10)).isoformat()
    await db.users.insert_one(
        {
            "id": "p2_credit_user",
            "email": "p2_credit@example.com",
            "credit_buckets": [
                {
                    "type": "paid",
                    "amount": 5,
                    "created_at": now.isoformat(),
                    "expires_at": future,
                }
            ],
        }
    )

    with patch.object(credit_manager.asyncio, "sleep", new_callable=AsyncMock) as mock_sleep:
        ok = await credit_manager.wait_for_credit_replenishment("p2_credit_user", max_wait=60)
        assert ok is True
        mock_sleep.assert_not_called()

        await db.users.update_one(
            {"id": "p2_credit_user"},
            {"$set": {"credit_buckets": []}},
        )
        missing = await credit_manager.wait_for_credit_replenishment("p2_credit_user", max_wait=60)
        assert missing is False
        mock_sleep.assert_not_called()


def test_server_uses_fastapi_lifespan_context():
    assert app.router.lifespan_context is not None
