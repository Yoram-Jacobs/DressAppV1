import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from app.api.v1.daily_proposals import (
    check_scheduler_access,
    get_daily_proposal,
    generate_daily_proposal,
    act_on_daily_proposal,
    _generate_and_save_daily_proposal,
    ProposalGenerateIn,
    ProposalActionIn,
)


def test_free_user_allowed():
    """Free users are now permitted to access daily proposals."""
    free_user = {
        "id": "u_free",
        "email": "free@example.com",
        "subscription": {
            "is_active": False,
            "plan_type": "free",
            "tier": "free",
        },
    }
    # Must not raise
    check_scheduler_access(free_user)


def test_free_user_with_no_subscription_object():
    """Users without an explicit subscription dict are treated as valid free users."""
    user = {"id": "u_none", "email": "none@example.com"}
    check_scheduler_access(user)


def test_unauthenticated_user_rejected():
    """Unauthenticated calls (empty dict or missing id) raise 401."""
    with pytest.raises(HTTPException) as exc_info:
        check_scheduler_access({})
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        check_scheduler_access({"email": "no_id@example.com"})
    assert exc_info.value.status_code == 401


def test_active_manager_allowed():
    user = {
        "id": "u_mgr",
        "subscription": {
            "is_active": True,
            "plan_type": "monthly",
            "tier": "manager",
        },
    }
    check_scheduler_access(user)


def test_active_pro_allowed():
    user = {
        "id": "u_pro",
        "subscription": {
            "is_active": True,
            "plan_type": "pro",
            "tier": "pro",
        },
    }
    check_scheduler_access(user)


def test_active_professional_allowed():
    user = {
        "id": "u_prof",
        "subscription": {
            "is_active": True,
            "plan_type": "professional",
            "tier": "professional",
        },
    }
    check_scheduler_access(user)


@pytest.mark.anyio
async def test_generate_daily_proposal_consumes_one_credit():
    """Generating a new daily outfit proposal deducts 1 AI credit."""
    user = {"id": "u_free_1", "email": "free1@example.com"}
    target_date = "2026-11-12"

    mock_db = MagicMock()
    # No existing proposal
    mock_db.daily_proposals.find_one = AsyncMock(return_value=None)
    mock_db.daily_proposals.update_many = AsyncMock()
    mock_db.daily_proposals.insert_one = AsyncMock()

    # Empty cursor for past proposals
    class AsyncIter:
        def __init__(self, items):
            self.items = items
        def __aiter__(self):
            self._iter = iter(self.items)
            return self
        async def __anext__(self):
            try:
                return next(self._iter)
            except StopIteration:
                raise StopAsyncIteration

    mock_db.daily_proposals.find = MagicMock(return_value=AsyncIter([]))
    mock_db.closet_items.find = MagicMock(
        return_value=AsyncIter([
            {"id": "c_top_1", "category": "top", "title": "White Tee", "color": "white"},
            {"id": "c_bot_1", "category": "bottom", "title": "Blue Jeans", "color": "navy"},
        ])
    )

    with patch("app.api.v1.daily_proposals.get_db", return_value=mock_db), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_deduct, \
         patch("app.services.stylist_scheduler_brain.get_recent_wardrobe_history", new_callable=AsyncMock, return_value=({}, [])), \
         patch("app.api.v1.daily_proposals.generate_scheduled_proposals", new_callable=AsyncMock, return_value={"outfit_recommendations": []}):

        mock_deduct.return_value = True

        res = await _generate_and_save_daily_proposal(user, target_date, force=True)
        assert mock_deduct.called
        assert mock_deduct.call_args[1]["cost"] == 1
        assert mock_deduct.call_args[1]["operation"] == "daily_proposal"
        assert len(res["items"]) == 2


@pytest.mark.anyio
async def test_generate_daily_proposal_skips_deduction_when_closet_empty():
    """Empty/insufficient closet (<2 items) must raise 400 BEFORE deducting credits."""
    user = {"id": "u_empty_closet", "email": "empty@example.com"}
    target_date = "2026-11-12"

    class AsyncIter:
        def __init__(self, items):
            self.items = items
        def __aiter__(self):
            self._iter = iter(self.items)
            return self
        async def __anext__(self):
            try:
                return next(self._iter)
            except StopIteration:
                raise StopAsyncIteration

    mock_db = MagicMock()
    mock_db.daily_proposals.find_one = AsyncMock(return_value=None)
    mock_db.daily_proposals.insert_one = AsyncMock()
    mock_db.closet_items.find = MagicMock(return_value=AsyncIter([]))

    with patch("app.api.v1.daily_proposals.get_db", return_value=mock_db), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_deduct:

        with pytest.raises(HTTPException) as exc_info:
            await _generate_and_save_daily_proposal(user, target_date, force=True)
        assert exc_info.value.status_code == 400
        assert "closet_empty" in exc_info.value.detail
        assert not mock_deduct.called
        assert not mock_db.daily_proposals.insert_one.called


@pytest.mark.anyio
async def test_generate_daily_proposal_fails_when_credits_exhausted():
    """If user has 0 AI credits, generation raises 402 with insufficient credits detail."""
    user = {"id": "u_free_broke", "email": "broke@example.com"}
    target_date = "2026-11-12"

    class AsyncIter:
        def __init__(self, items):
            self.items = items
        def __aiter__(self):
            self._iter = iter(self.items)
            return self
        async def __anext__(self):
            try:
                return next(self._iter)
            except StopIteration:
                raise StopAsyncIteration

    mock_db = MagicMock()
    mock_db.daily_proposals.find_one = AsyncMock(return_value=None)
    mock_db.closet_items.find = MagicMock(
        return_value=AsyncIter([
            {"id": "c_1", "category": "top", "title": "Shirt"},
            {"id": "c_2", "category": "bottom", "title": "Pants"},
        ])
    )

    with patch("app.api.v1.daily_proposals.get_db", return_value=mock_db), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_deduct, \
         patch("app.services.credit_manager.make_insufficient_credits_exception") as mock_make_exc:

        mock_deduct.return_value = False
        mock_make_exc.return_value = HTTPException(status_code=402, detail="Insufficient credits")

        with pytest.raises(HTTPException) as exc_info:
            await _generate_and_save_daily_proposal(user, target_date, force=True)
        assert exc_info.value.status_code == 402
        assert "Insufficient credits" in exc_info.value.detail


@pytest.mark.anyio
async def test_get_daily_proposal_returns_existing_without_credit_deduction():
    """Fetching an already existing daily proposal does not consume an AI credit."""
    user = {"id": "u_free_cached", "email": "cached@example.com"}
    existing_prop = {
        "id": "prop_123",
        "user_id": "u_free_cached",
        "date": "2026-11-12",
        "items": [{"id": "item_1", "name": "Shirt"}],
    }

    mock_db = MagicMock()
    mock_db.daily_proposals.find_one = AsyncMock(return_value=existing_prop)

    with patch("app.api.v1.daily_proposals.get_db", return_value=mock_db), \
         patch("app.services.billing_service.deduct_user_credits", new_callable=AsyncMock) as mock_deduct:

        res = await get_daily_proposal(date="2026-11-12", user=user)
        assert res["id"] == "prop_123"
        # deduct_user_credits must NOT have been called
        assert not mock_deduct.called
