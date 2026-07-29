#!/usr/bin/env python3
"""Verification script for the new credit bucket system."""

import asyncio
import sys
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, '/app/backend')

from app.db.database import get_db
from app.models.schemas import User, CreditBucket
from app.services.auth import get_current_user

async def test_credit_buckets():
    """Test that credit buckets work correctly."""
    print("Testing credit bucket system...")
    
    db = get_db()
    
    # Create a test user (or use existing)
    test_user_id = "test_credit_user_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    
    # Insert test user with initial state
    test_user = {
        "id": test_user_id,
        "email": f"test_{test_user_id}@example.com",
        "password_hash": "dummy",
        "display_name": "Test User",
        "ai_configuration": {
            "ai_provider_mode": "standard",
            "ai_daily_limit": 100,
            "ai_monthly_limit": 1000,
            "ai_credits": 100,  # Legacy field - should be ignored now
        },
        "credit_buckets": [],
        "subscription": {
            "plan_type": "free",
            "is_active": True,
        }
    }
    
    await db.users.insert_one(test_user)
    print(f"✓ Created test user: {test_user_id}")
    
    # Test 1: Add paid credits bucket
    from datetime import datetime, timezone
    new_paid_bucket = {
        "amount": 50,
        "type": "paid",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
    }
    
    await db.users.update_one(
        {"id": test_user_id},
        {"$set": {"credit_buckets": [new_paid_bucket]}},
    )
    print("✓ Added paid credit bucket (50 credits)")
    
    # Reload and verify
    user_record = await db.users.find_one({"id": test_user_id"})
    u_model = User.parse_obj(user_record)
    assert u_model.total_credits == 50, f"Expected 50, got {u_model.total_credits}"
    print(f"✓ Total credits verified: {u_model.total_credits}")
    
    # Test 2: Add free credits bucket (will expire in 30 days)
    free_bucket = {
        "amount": 20,
        "type": "free",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    }
    
    await db.users.update_one(
        {"id": test_user_id},
        {"$push": {"credit_buckets": free_bucket}},
    )
    print("✓ Added free credit bucket (20 credits, expires in 30 days)")
    
    user_record = await db.users.find_one({"id": test_user_id})
    u_model = User.parse_obj(user_record)
    assert u_model.total_credits == 70, f"Expected 70, got {u_model.total_credits}"
    print(f"✓ Total after adding free credits: {u_model.total_credits}")
    
    # Test 3: Spend credits (should use free first, then paid)
    # For this test, we'll manually update the model and call spend_credits
    user_record["credit_buckets"].append(free_bucket)  # Ensure it's there
    user_record_copy = user_record.copy()
    user_model = User.parse_obj(user_record_copy)
    
    success, details = user_model.spend_credits(25, "test_operation")
    assert success, "Spend operation failed"
    
    # After spending 25, we should have used all 20 free + 5 paid
    remaining = user_model.credit_buckets
    total_remaining = sum(b["amount"] for b in remaining)
    expected_remaining = 45  # 50 - 5 = 45 paid left
    assert total_remaining == expected_remaining, f"Expected {expected_remaining} remaining, got {total_remaining}"
    print(f"✓ Spent 25 credits: free consumed, then 5 from paid. Remaining: {total_remaining}")
    
    # Test 4: Check expiration simulation
    # Manually set expiry to past for one bucket
    expired_bucket = {
        "amount": 10,
        "type": "free",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),  # Expired yesterday
    }
    
    user_record["credit_buckets"].append(expired_bucket)
    user_record_copy = user_record.copy()
    user_model2 = User.parse_obj(user_record_copy)
    
    # Verify expired bucket is not counted in total
    assert user_model2.total_credits == 45, f"After adding expired bucket, total should still be 45, got {user_model2.total_credits}"
    print(f"✓ Expired bucket correctly excluded from total: {user_model2.total_credits}")
    
    # Cleanup
    await db.users.delete_one({"id": test_user_id})
    print("✓ Cleaned up test user")
    
    print("\nAll tests passed! ✓")

async def main():
    try:
        await test_credit_buckets()
    except Exception as e:
        print(f"❌ Test failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())