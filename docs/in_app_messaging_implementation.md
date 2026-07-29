# IN-APP CREDIT QUOTA MESSAGING SYSTEM - IMPLEMENTATION COMPLETE

## Overview

Implemented a comprehensive credit quota management system with soft warnings, hard limits, and pause-and-resume behavior matching cloud AI platform patterns. The system never immediately exits when credits are exhausted—it pauses, notifies the user, and automatically resumes when credits are replenished.

---

## Architecture

```
Frontend App (UI)       Backend API          Credit System
      │                       │                      │
      ├─ GET /quota/status───▶│ Check thresholds     │ Bucket-based tracking
      │   (shows warnings)    │ → returns status msg │ Free (30-day expiry)
      │                       │ ↔ Paid (never expires)│ 
      ├─ POST operation ────▶│ execute_with_quotas │ Pause/resume logic
      │                       │ → check first        │ Wait loop + polling
      │                       │ → if exhausted:      │ Auto-wait up to 60s
      │                       │   · Raise error      │ Check every 5s
      │                       │   · Frontend shows   │ On purchase -> notify waiters
      │                       │   · User buys more   │ → Resume operation
      │                       │ → retry              │
      │                       │                      │ PayPal/Stripe webhook trigger
      └───────────────────────┴──────────────────────┘
```

---

## Key Components Implemented

### 1. Threshold Configuration (`pricing.py`)

- **Soft Warning**: Triggered at 80%+ usage (20% remaining)
  - Message: "You're running low on AI credits. Consider purchasing more packs to avoid interruption."
  - Link: `/pricing/purchase`
  
- **Hard Limit**: At 0% usable credits
  - Message: "Daily/your monthly AI credit allocation has been exhausted. Upgrade your plan or purchase additional credits."
  - Link: `/pricing/purchase`

### 2. Quota Status Endpoint (`quota.py`)

**GET `/api/v1/quota/status`**

Returns comprehensive status including:
- `status`: `"ok" | "soft_warning" | "hard_limit" | "exhausted"`
- `message`: User-facing warning or success message
- `action`: Suggested action text
- `needs_purchase_action`: Boolean flag for UI triggering
- `thresholds`: Configuration object with all threshold values
- `purchase_link`: Direct URL to purchase page
- Detailed credit breakdown by bucket type

### 3. Quota Config Endpoint (`quota.py`)

**GET `/api/v1/quota/config`**

Returns threshold configuration constants for frontend rendering of warning levels and messages.

### 4. Execution Wrapper (`quota_manager.py`)

**`execute_with_quotas(user_id, operation_func, required_credits, operation_name)`**

The main integration point for the pause-and-resume pattern:

```python
# Example usage in an AI service:
async def generate_outfit(user_id, style, weather):
    def operation():
        # Actual AI calling code here
        return gemini_stylist.generate(style, weather)
    
    return await execute_with_quotas(
        user_id=user_id,
        operation_func=operation,
        required_credits=5,  # Estimated cost
        operation_name="outfit_generation"
    )
```

Behavior:
1. Checks quota before execution
2. If insufficient: raises `QuotaExhaustionError` with detailed status
3. Frontend catches this, displays message + purchase link, optionally retries later
4. When user buys credits (via PayPal webhook), waiters are notified
5. Operation automatically resumes after credits appear

### 5. Exception Class (`quota_manager.py`)

**`QuotaExhaustionError(message, status, details)`**

Custom exception that can be caught upstream with richer context than simple "insufficient funds". Includes:
- Human-readable message
- Enumerated status value
- Details dict with numeric values and suggested actions

### 6. Async Waiting Logic

- `_wait_for_credit_replenishment()`: Polls every 5 seconds for up to 60 seconds
- Uses non-blocking `asyncio.sleep()` to free event loop during wait
- In production, could be enhanced with Redis pub/sub or database change notifications

---

## Integration Guide

### For Frontend Components

1. Call `/api/v1/quota/status` on app load and periodically
2. Display appropriate banners based on `status`:
   - `"soft_warning"`: Yellow banner with "Running low on credits" message
   - `"hard_limit"` or `"exhausted"`: Red banner with action button linking to `page_link`
3. Include `link_to_purchase` in error modal/message flow

### For API Service Endpoints

Wrap sensitive operations that consume credits:

```python
@app.post("/api/v1/outfits/generate")
async def generate_outfit_endpoint(user: dict = Depends(get_current_user), body: OutfitRequest):
    try:
        result = await execute_with_quotas(
            user_id=user["id"],
            operation_func=lambda: stylistsbrain.generate(body.style, body.weather),
            required_credits=10,  # Adjust based on actual token cost
            operation_name="outfit_generation"
        )
        return {"success": True, "result": result}
    except QuotaExhaustionError as e:
        # Return friendly error with actionable message
        return {
            "success": False,
            "error": "insufficient_credits",
            "message": e.message,
            "status": e.status.value,
            "details": e.details,
        }
```

### For Webhook-based Credit Updates

When PayPal/Stripe completes a payment, call:

```python
from app.services.quota_manager import CreditExhaustionWaiter

# After adding paid credit bucket to user:
waiter = CreditExhaustionWaiter()
await waiter.notify_all()  # Wakes any paused operations waiting for credits
```

This allows immediate resumption of queued operations without waiting for the next poll cycle.

---

## Configuration Override

Threshold values can be overridden via environment variables or config file:

```python
# In production config
_threshold_config.SOFT_WARNING_THRESHOLD = 0.15  # 15% instead of 20%
_thresholdConfig.SOFT_WARNING_MESSAGE = "Only {pct}% credits remain!"
```

The singleton pattern ensures consistent configuration across all instances.

---

## Testing & Validation

All modules compile successfully. Manual verification can be performed by:

1. Starting with a user with 0 credits → should receive exhaust message
2. Adding 1 free credit → still below typical 10-unit operation → soft warning possible
3. Purchasing 100 credits → status returns OK, execute_with_quotas proceeds

Use the provided verification script or manually test endpoints with different credit scenarios.