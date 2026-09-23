import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from app.api.v1.daily_proposals import (
    check_scheduler_access,
    get_daily_proposal,
    generate_daily_proposal,
    act_on_daily_proposal,
    ProposalGenerateIn,
    ProposalActionIn,
)


def test_free_user_blocked():
    free_user = {
        "id": "u_free",
        "email": "free@example.com",
        "subscription": {
            "is_active": False,
            "plan_type": "free",
            "tier": "free",
        },
    }
    with pytest.raises(HTTPException) as exc_info:
        check_scheduler_access(free_user)
    assert exc_info.value.status_code == 403
    assert "Manager or Professional" in exc_info.value.detail


def test_free_user_with_no_subscription_object():
    user = {"id": "u_none", "email": "none@example.com"}
    with pytest.raises(HTTPException) as exc_info:
        check_scheduler_access(user)
    assert exc_info.value.status_code == 403


def test_expired_subscription_blocked():
    past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    expired_user = {
        "id": "u_expired",
        "subscription": {
            "is_active": True,
            "plan_type": "manager",
            "tier": "manager",
            "expires_at": past,
        },
    }
    with pytest.raises(HTTPException) as exc_info:
        check_scheduler_access(expired_user)
    assert exc_info.value.status_code == 403


def test_expired_trial_blocked():
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    expired_trial_user = {
        "id": "u_trial_exp",
        "subscription": {"is_active": False, "plan_type": "free", "tier": "free"},
        "trial_info": {"is_active": True, "expires_at": past},
    }
    with pytest.raises(HTTPException) as exc_info:
        check_scheduler_access(expired_trial_user)
    assert exc_info.value.status_code == 403


def test_active_manager_allowed():
    user = {
        "id": "u_mgr",
        "subscription": {
            "is_active": True,
            "plan_type": "monthly",
            "tier": "manager",
        },
    }
    # Should not raise
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


def test_active_trial_allowed():
    future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    user = {
        "id": "u_trial",
        "subscription": {"is_active": False, "plan_type": "free", "tier": "free"},
        "trial_info": {
            "is_active": True,
            "expires_at": future,
            "trial_type": "pro",
        },
    }
    check_scheduler_access(user)


@pytest.mark.anyio
async def test_get_daily_proposal_endpoint_rejects_free():
    free_user = {"id": "u_free", "subscription": {"is_active": False}}
    with pytest.raises(HTTPException) as exc_info:
        await get_daily_proposal(user=free_user)
    assert exc_info.value.status_code == 403


@pytest.mark.anyio
async def test_generate_daily_proposal_endpoint_rejects_free():
    free_user = {"id": "u_free", "subscription": {"is_active": False}}
    with pytest.raises(HTTPException) as exc_info:
        await generate_daily_proposal(body=ProposalGenerateIn(), user=free_user)
    assert exc_info.value.status_code == 403


@pytest.mark.anyio
async def test_act_daily_proposal_endpoint_rejects_free():
    free_user = {"id": "u_free", "subscription": {"is_active": False}}
    with pytest.raises(HTTPException) as exc_info:
        await act_on_daily_proposal(body=ProposalActionIn(action="wear"), user=free_user)
    assert exc_info.value.status_code == 403
