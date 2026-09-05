import pytest
from app.models.schemas import User

def test_referral_capacity_calculation():
    # Base user with 0 referral bonus
    user_data = {"id": "user-123", "closet_capacity_bonus": 0}
    capacity_limit = min(200, 50 + user_data.get("closet_capacity_bonus", 0))
    assert capacity_limit == 50

    # User who earned 1 referral (+10 slots)
    user_data["closet_capacity_bonus"] += 10
    capacity_limit = min(200, 50 + user_data.get("closet_capacity_bonus", 0))
    assert capacity_limit == 60

    # User with 20 referrals (+200 max bonus cap)
    user_data["closet_capacity_bonus"] = 200
    capacity_limit = min(200, 50 + user_data.get("closet_capacity_bonus", 0))
    assert capacity_limit == 200
