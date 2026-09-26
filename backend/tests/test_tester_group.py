import pytest
from app.config import settings
from app.models.schemas import SubscriptionInfo, User
from app.services.auth import apply_tester_group
from app.services.credit_manager import (
    get_user_tier,
    check_and_increment_daily_request,
    get_credit_exhaustion_info,
)


@pytest.mark.anyio
async def test_tester_group_emails_resolved_as_professional():
    # 1. Tester emails in allowlist get professional tier even with empty/free subscription
    tester_1 = {"email": "maystarboard@gmail.com", "roles": ["user"], "subscription": {"tier": "free", "is_active": False}}
    assert get_user_tier(tester_1) == "professional"

    tester_2 = {"email": "lokoprod@gmail.com", "roles": ["user", "admin"], "subscription": {"tier": "manager", "is_active": True}}
    assert get_user_tier(tester_2) == "professional"


@pytest.mark.anyio
async def test_user_with_tester_role_or_flag_resolved_as_professional():
    # 2. Users with 'tester' role or is_tester flag get professional tier
    user_with_role = {"email": "custom_tester@example.com", "roles": ["user", "tester"], "subscription": {}}
    assert get_user_tier(user_with_role) == "professional"

    user_with_flag = {"email": "custom2@example.com", "roles": ["user"], "subscription": {"is_tester": True, "is_active": True}}
    assert get_user_tier(user_with_flag) == "professional"

    user_with_plan = {"email": "custom3@example.com", "roles": ["user"], "subscription": {"plan_type": "tester", "tier": "professional", "is_active": True}}
    assert get_user_tier(user_with_plan) == "professional"


@pytest.mark.anyio
async def test_regular_user_retains_normal_tiers():
    # Regular free user
    free_user = {"email": "regular@example.com", "roles": ["user"], "subscription": {"tier": "free", "is_active": False}}
    assert get_user_tier(free_user) == "free"

    # Regular manager user
    manager_user = {"email": "manager@example.com", "roles": ["user"], "subscription": {"tier": "manager", "plan_type": "monthly", "is_active": True}}
    assert get_user_tier(manager_user) == "manager"

    # Regular professional user
    pro_user = {"email": "pro@example.com", "roles": ["user"], "subscription": {"tier": "professional", "plan_type": "yearly", "is_active": True}}
    assert get_user_tier(pro_user) == "professional"


@pytest.mark.anyio
async def test_apply_tester_group_helper():
    roles, sub, modified = apply_tester_group(["user"], "maystarboard@gmail.com", None)
    assert modified is True
    assert "tester" in roles
    assert sub["is_active"] is True
    assert sub["tier"] == "professional"
    assert sub["plan_type"] == "tester"
    assert sub["is_tester"] is True

    # Idempotent: second run doesn't re-modify
    roles_2, sub_2, modified_2 = apply_tester_group(roles, "maystarboard@gmail.com", sub)
    assert modified_2 is False


@pytest.mark.anyio
async def test_subscription_schema_validation_with_tester():
    sub = SubscriptionInfo(
        is_active=True,
        plan_type="tester",
        tier="professional",
        is_tester=True,
        credits_allocated_cycle=100,
    )
    assert sub.is_active is True
    assert sub.plan_type == "tester"
    assert sub.tier == "professional"
    assert sub.is_tester is True
