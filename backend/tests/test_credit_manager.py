import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from app.services import credit_manager
from app.models.schemas import User, CreditBucket

@pytest.mark.anyio
async def test_token_meter_credits_calculation():
    # Test static rate calculation
    cost = credit_manager.TokenMeter._calculate_credits_static("gemini", "flash", 1000, 2000)
    # Gemini Flash rate: input: 0.000075, output: 0.0003
    # Cost = (1000 * 0.000075 + 2000 * 0.0003) / 1000 = (0.075 + 0.6) / 1000 = 0.000675
    # Credits = 0.000675 / 0.01 = 0.0675 -> max(0.1, round(0.075, 2)) = 0.1
    assert cost == 0.1

    cost_pro = credit_manager.TokenMeter._calculate_credits_static("gemini", "pro", 10000, 20000)
    # Gemini Pro: input: 0.00035, output: 0.0007
    # Cost = (10000 * 0.00035 + 20000 * 0.0007) / 1000 = (3.5 + 14) / 1000 = 0.0175
    # Credits = 0.0175 / 0.01 = 1.75
    assert cost_pro == 1.75


@pytest.mark.anyio
async def test_get_credit_thresholds():
    thresholds = credit_manager.get_credit_thresholds()
    assert thresholds["soft_warning_percent"] == 20.0
    assert thresholds["hard_limit_percent"] == 0.0
    assert "low on AI credits" in thresholds["soft_warning_message"]
    assert "page_link" in thresholds


@pytest.mark.anyio
async def test_quota_status_ok():
    config = credit_manager.CreditThresholdConfig()
    status, message, action = config.get_status(
        available=100,
        total_needed=5,
        monthly_limit=1000,
        daily_limit=100,
        monthly_used=100,
        daily_used=10
    )
    assert status == credit_manager.CreditQuotaStatus.OK
    assert message == "All set"
    assert action is None


@pytest.mark.anyio
async def test_quota_status_exhausted():
    config = credit_manager.CreditThresholdConfig()
    status, message, action = config.get_status(
        available=2,
        total_needed=5,
        monthly_limit=1000,
        daily_limit=100,
        monthly_used=100,
        daily_used=10
    )
    assert status == credit_manager.CreditQuotaStatus.EXHAUSTED
    assert "Insufficient" in message
    assert "Purchase" in action


@pytest.mark.anyio
async def test_pure_credit_domain_bucket_calculations():
    from app.models.credit import (
        CreditBucket,
        get_total_credits,
        get_aging_credit_buckets,
        add_credit_bucket,
        spend_credits
    )

    buckets = []
    # Add paid bucket
    add_credit_bucket(buckets, 50, "paid", now_str="2026-08-01T00:00:00")
    # Add expiring free bucket
    add_credit_bucket(buckets, 20, "free", days_until_expiry=30, now_str="2026-08-01T00:00:00")
    
    # Expiry calculated: 2026-08-31T00:00:00
    assert buckets[1].expires_at == "2026-08-31T00:00:00"
    
    # Verify aging: free expiring goes first, then paid
    aging = get_aging_credit_buckets(buckets, now_str="2026-08-15T00:00:00")
    assert aging[0].amount == 20
    assert aging[0].type == "free"
    assert aging[1].amount == 50
    assert aging[1].type == "paid"

    # Total credits: 50 + 20 = 70
    assert get_total_credits(buckets, now_str="2026-08-15T00:00:00") == 70

    # Test spending: 30 credits spent.
    # FIFO/Aging logic: 20 is consumed from free bucket, 10 from paid bucket.
    success, spent = spend_credits(buckets, 30, operation="stylist_chat", now_str="2026-08-15T00:00:00")
    assert success is True
    assert len(spent) == 2
    # Detail checks
    assert spent[0]["amount_spent"] == 20
    assert spent[0]["type"] == "free"
    assert spent[1]["amount_spent"] == 10
    assert spent[1]["type"] == "paid"

    # Remaining in paid bucket: 40. Expired free bucket deleted.
    assert len(buckets) == 1
    assert buckets[0].amount == 40
    assert buckets[0].type == "paid"

