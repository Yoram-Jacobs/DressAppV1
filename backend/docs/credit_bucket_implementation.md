# Credit Bucket System Implementation

## Summary

Implemented differentiated credit management for free vs paid credits with proper expiry tracking, as requested. This replaces the simple integer-based `ai_credits` field with a robust bucket-based system.

## Key Changes

### 1. User Model Update (`app/models/schemas.py`)

**New Feature:** `CreditBucket` model replaces simple `ai_credits` field.

```python
class CreditBucket(BaseModel):
    amount: int                  # Number of credits in this bucket
    type: CreditType             # "free" or "paid"
    created_at: str              # ISO timestamp when bucket was created
    expires_at: str | None       # None = never expires (paid); date string for free credits
```

**User schema additions:**
- `credit_buckets: List[CreditBucket]` - instead of single `ai_credits` integer
- New methods:
  - `total_credits` property - sums all non-expired buckets
  - `get_aging_credit_buckets()` - returns buckets sorted by consumption priority (oldest/free-expiring first)
  - `add_credit_bucket(amount, type, days_until_expiry)` - creates new bucket
  - `spend_credits(required_amount, operation)` - consumes from oldest buckets first
  - `get_credit_usage_summary()` - breakdown by type and expiry status

### 2. Pricing Service (`app/services/pricing.py`)

**Core functions implemented:**

| Function | Purpose |
|----------|---------|
| `allocate_free_daily_credits()` | Adds daily free credit bucket with 30-day expiry |
| `purchase_ai_credits_endpoint()` | Creates paid credit bucket (never expires) via PayPal/Stripe |
| `use_ai_credits_endpoint()` | Consumes credits from oldest buckets first |
| `expire_old_free_credits()` | Removes expired free credits (>30 days old) |
| `check_credit_expiry()` | Returns soon-to-expire credit buckets |
| `get_detailed_credits()` | Full bucket-level breakdown |

**Credit pack pricing (matches Pricing-Plane.md):**
- 10 credits: $1.99
- 25 credits: $3.99  
- 50 credits: $7.99
- 100 credits: $15.99

**Rollover logic:** Free credits expire after 30 days; paid credits never expire.

### 3. Token Meter Integration (`app/services/token_meter.py`)

Updated to track which credit type (`free` or `paid`) is consumed during AI operations and return this information in responses. The `_deduct_creds()` method uses the new `User.spend_credits()` method.

### 4. Billing Service (`app/services/billing_service.py`)

Rewritten to work with bucket-based system:
- `deduct_user_credits()` now uses bucket spending logic
- `track_ai_operation_with_billing()` integrates TokenMeter with credit buckets
- Added `add_paid_credits()` utility function

### 5. API Endpoints (`app/api/v1/ai_credits.py` + `pricing_router`)

**New endpoints:**
- `GET /ai-credits/balance` - shows bucket breakdown alongside legacy fields
- `POST /ai-credits/purchase` - initiate credit pack purchase
- `POST /ai-credits/purchase/{id}/capture` - complete purchase → adds paid bucket
- `POST /ai-credits/use` - spend credits
- `GET /ai-credits/usage` - check availability
- `GET /pricing/info` - comprehensive pricing data with tier info
- `POST /pricing/subscription/upgrade` - upgrade plan → adds bonus paid credits

**Backward compatibility:** Legacy wrappers maintain existing frontend integration while transitioning to bucket system.

### 6. Scheduler (`app/services/scheduler.py`)

Added daily cleanup job:
- **Schedule:** Every day at 02:00 UTC
- **Task:** Scan all users, remove expired free credit buckets
- **Log:** Records total credits removed per user

### 7. Credit Consumption Priority Order

When a user spends credits, they are consumed in this order:

1. **Free credits expiring soonest** (earliest expiry date first) - implements "use before they expire"
2. **Other free credits** (non-expiring or distant expiry)
3. **Paid credits** (never expire, used last)

This ensures promotional/free credits are utilized first, preserving paid balance for long-term use.

## Migration Notes

The system is designed to co-exist with legacy code during transition:

- Old `ai_credits` field still exists but is **computed** from buckets (read-only view)
- `current_credits` getter returns sum of all non-expired buckets
- Existing `/ai-credits/balance` endpoint still works (returns both bucket view and computed totals)

## Verification

Run verification script:
```bash
python backend/scripts/verify_credit_system.py
```

Expected output: All tests passed ✓ showing bucket creation, expiration handling, and consumption ordering work correctly.

## Open Items

1. Frontend UI needs to display bucket-level credit detail (free vs paid, expiry dates)
2. Annual discount (20% off yearly plans) not yet wired into subscription upgrade flow
3. Trial provisioning (14-day Pro trial, 30-day Business trial) needs implementation
4. Daily usage quota reset logic (when `ai_daily_reset` is hit) requires background task
5. Token testing methodology (run 100 sample ops per feature for P95 validation) still pending
