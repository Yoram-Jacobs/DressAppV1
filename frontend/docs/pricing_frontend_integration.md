# Frontend Pricing Integration Guide

## Overview

This document explains how to integrate the new credit quota messaging system with the DressApp frontend. The backend provides RESTful API endpoints for checking credit status and managing purchases.

## Backend API Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/api/v1/pricing/info` | GET | Get comprehensive pricing info with credit tiers and current user state | `{ success, user_id, pricing_plan, credits, credit_packs, pricing_tiers }` |
| `/api/v1/quota/status` | GET | Check current credit quota status with actionable messages | `{ success, user_id, status, message, needs_purchase_action, can_proceed }` |
| `/api/v1/quota/config` | GET | Get global threshold configuration constants for UI rendering | `{ success, config: { soft_warning_percent, hard_limit_percent, ... } }` |
| `/api/v1/ai-credits/purchase` | POST | Initiate PayPal credit pack purchase order | `{ purchase_id, order_id, credits_amount, amount_cents, currency }` |
| `/api/v1/ai-credits/purchase/{id}/capture` | POST | Complete PayPal capture → add paid credit bucket | `{ ok, purchase, new_credit_balance }` |

## Quota Status Values

The `status` field in quota responses can have these values:

| Status | Meaning | UI Action | Severity |
|--------|---------|-----------|----------|
| `ok` | Sufficient credits available | No action needed | Info |
| `soft_warning` | Approaching 80%+ usage | Show warning banner, suggest top-up before running out | Warning |
| `hard_limit` | At or below allocated limit | Show alert, redirect to purchase | Warning/Caution |
| `exhausted` | No usable credits left | Block AI operations, show strong CTA to buy | Danger |

## Component Implementation

### Pricing Page (`/pricing`)

The Pricing page displays:
1. **Quota Status Banner** - Top-of-page alert showing current credit status with message and purchase link
2. **Plan Comparison Cards** - Three-tier comparison (Free/Pro/Business) with feature lists
3. **Current Credit Breakdown** - Table showing free vs paid credit amounts with expiration tracking
4. **Credit Purchase Section** - Individual cards for each available credit pack with "Buy Now" buttons
5. **Usage Progress Bars** - Visual indicators of daily/monthly consumption

### Credit Purchase Page (`/pricing/purchase`)

The Purchase page allows users to:
1. Select from available credit packs via tabs
2. See summary of selected pack before confirming payment
3. Initiate PayPal checkout flow
4. Receive confirmation message after successful purchase
5. See real-time update of their credit balance

The component polls the quota status every 30 seconds to reflect credit balance changes without requiring page refresh.

## Integration Pattern

For any operation that consumes credits (outfit generation, garment tagging, etc.), follow this pattern:

```javascript
// Before initiating expensive operation:
const quotaRes = await axios.get('/api/v1/quota/status');

if (quotaRes.data.status === 'exhausted') {
  // Show modal with purchase suggestion
  showModal({
    title: 'Credits Required',
    message: quotaRes.data.message,
    actions: [
      { text: 'Buy More Credits', href: '/pricing/purchase' },
      { text: 'Cancel', variant: 'secondary' }
    ]
  });
  return;
}

// Alternatively, use the enhanced execute-with-quotas pattern from backend docs:
try {
  const result = await api.post('/api/v1/ai-credits/use', {
    credits: estimatedCost,
    operation: 'outfit_recommendation'
  });
} catch (err) {
  if (err.response?.data?.status === 'exhausted') {
    // Handle pause/resume logic - show notification that user can top up
    showPauseNotification();
    // Optionally auto-resume when user navigates back after purchase
  } else {
    throw err;
  }
}
```

## Pause-and-Resume Behavior

When credits are exhausted during an active operation:

1. **Backend**: The `execute_with_quotas()` wrapper (in quota_manager.py) detects insufficient credits and returns a `QuotaExhaustionError` with detailed status
2. **Frontend**: Catch this error, display a non-blocking notification saying "Credits depleted - please purchase more"
3. **User action**: User goes to pricing page, purchases credits
4. **Automatic resume**: On returning to the original page, check quota status again - if credits replenished, re-execute the paused operation

The frontend can implement this automatically by wrapping async API calls in a retry mechanism with exponential backoff when encountering exhaustion errors.

## Throttle Events

Consider debouncing frequent quota checks (e.g., on keystroke or rapid UI interactions) to avoid excessive API calls. The pricing page already implements automatic polling at 30-second intervals which is sufficient for most use cases.

## Accessibility Considerations

- Alert banners should have `role="alert"` for screen readers announcing status changes
- Color contrast meets WCAG AA standards (primary palette uses accessible combinations)
- All interactive elements are keyboard navigable
- Purchase links include descriptive text for assistive technologies