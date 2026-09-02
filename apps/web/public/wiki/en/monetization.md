# DressApp Monetization & Billing Engine

This document provides a comprehensive architectural overview, user manual, and technology deep-dive of the monetization, subscription billing, and growth-loop mechanics in DressApp.

---

## 1. Executive Summary & Value Proposition

### High-Level Overview
DressApp implements a hybrid SaaS subscription and daily utility gating model:
1. **Subscription Tiers (SaaS)**: Flat-rate plans (Free, Manager, Professional) that govern closet storage capacities, daily AI styling limits, and advanced features (e.g., ad campaign creation).
2. **Daily Quota Limits (Free Tier)**: Gated AI usage on the Free plan, which restricts users to 10 daily requests. Draw-down logic and 30-day bucket expirations apply *only* to Free and Trial accounts.
3. **Viral Growth Loop**: A referral program allowing Free tier users to expand their baseline closet capacity organically by sharing invite links.
4. **Localized Payments (Atzmai Gateway)**: Native support for Israeli payments (Bit, local credit cards) in ILS (Shekels). Since Atzmai only supports ILS, USD prices are converted using a live exchange rate API.

### Architectural Flow

```mermaid
graph TD
    User([User App Client])
    Gateway[Payments API Gateway /atzmai]
    Auth[Auth Router /auth/register]
    Closet[Closet Router /closet/item]
    DB[(MongoDB Atlas)]
    AtzmaiAPI[Atzmai Payment API]
    PayPalAPI[PayPal Subscriptions API]

    %% Closet Upload Limit Gating
    User -->|1. Upload Garment| Closet
    Closet -->|2. Check Item Count & Subscription| DB
    DB -->|3. Return Count + SubscriptionInfo| Closet
    Closet -.->|If Exceeded & Sub Inactive: HTTP 402| User
    
    %% Paid Subscription Checkout
    User -->|4. Post /atzmai/subscribe| Gateway
    Gateway -->|5. Create Intent (ILS)| AtzmaiAPI
    AtzmaiAPI -->|6. Return Payment URL| Gateway
    Gateway -->|7. Return Payment URL| User
    User -->|8. User Approves Payment| AtzmaiAPI
    AtzmaiAPI -->|9. Trigger Webhook| Gateway
    Gateway -->|10. Capture Transaction| DB
    
    %% Viral Referral Mechanics
    User -->|11. Register with referrer_id| Auth
    Auth -->|12. Increment closet_capacity_bonus| DB
```

---

## 2. Subscription Tiers & Pricing Topology

### Pricing Plans

| Plan | Price (Monthly) | Closet Capacity | AI Credits Allocation | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Free Plan** | $0.00 / month | 50 items baseline | 10 free daily credits (expire in 30 days) | Basic organization, community support, referral expansions (+10 slots per signup up to 200 items max) |
| **Manager (Pro)** | $4.99 / month | Unlimited | Unlimited daily operations | 14-day free trial, 50-credit initial allocation, marketplace selling & renting, Trend Scout, scheduled notifications |
| **Professional** | $9.99 / month | Unlimited | Unlimited daily operations | 30-day free trial, 300-credit initial allocation, all Manager features, support for creating ad campaigns ($1/day fee, max 3 campaigns simultaneously) |

### Prepaid AI Credit Packs (Obsolete)
* Prepaid credit top-up packages are **no longer supported**.
* To prevent service interruptions, Free plan users must upgrade to the Manager or Professional subscription plan.

### Credit Expiration & Consumption Priority (FIFO Logic)
* **Rule**: Credit expiration (30 days) and FIFO (first-in-first-out) consumption priority logic apply **only to the Free and Trial subscription tiers**.
* **Paid Plans**: Users on active Manager or Professional plans receive unlimited daily AI operations and are not subject to credit metering, expiration, or draw-down priority checks.

---

## 3. Localized Payments & Invoicing (Atzmai Gateway)

For accounts based in Israel, DressApp integrates with the **Atzmai payment gate** to process local transactions in ILS (Shekels):
1. **ILS-Only Processing**: The Atzmai gateway processes local payments exclusively in ILS.
2. **Currency Exchange**: USD-denominated subscriptions and campaign fees are dynamically converted to ILS prior to link generation using a live exchange rate values API (falling back to a static 3.70 rate if unreachable).
3. **Webhook Verification & Campaign Billing**: 
   * General transaction tracking via `atzmai_topups` is obsolete.
   * However, `atzmai_topups` remains active for capturing and verifying **daily campaign payments ($1/day fee)**.
   * On successful capture, the campaign's `last_daily_payment_date` is updated to the current date.
4. **Automated PDF Bookkeeping**: Upon successful capture, the backend queries the Atzmai billing API to generate and download official invoice and receipt PDFs. These are sent as email attachments directly to the buyer.

---

## 4. Technical Stack & Capability Deep-Dive

### Data Schema Definitions

The MongoDB schema in [schemas.py](file:///C:/DressApp_AG/backend/app/models/schemas.py) tracks user subscriptions and closet capacity:

```python
class SubscriptionInfo(BaseModel):
    is_active: bool = False
    plan_type: Literal["free", "monthly", "yearly"] = "free"
    tier: Literal["free", "manager", "professional"] = "free"
    stripe_subscription_id: str | None = None
    paypal_subscription_id: str | None = None
    atzmai_subscription_id: str | None = None
    expires_at: str | None = None
    cancelled_at: str | None = None

class User(BaseDoc):
    subscription: SubscriptionInfo = Field(default_factory=SubscriptionInfo)
    closet_capacity_bonus: int = 0
```

### Closet limit enforcement ([closet.py](file:///C:/DressApp_AG/backend/app/api/v1/closet.py))
During item uploads, the system guards the database limits with a 200 items hard cap for referrals:
```python
capacity_limit = min(200, 50 + user.get("closet_capacity_bonus", 0))
if current_count >= capacity_limit and not user.get("subscription", {}).get("is_active", False):
    raise HTTPException(
        status_code=402,
        detail={
            "code": "closet_capacity_exceeded",
            "message": f"You have reached your free closet capacity of {capacity_limit} items. Upgrade to Manager or Professional to add more items."
        }
    )
```

### Currency Exchange Logic ([atzmai_client.py](file:///C:/DressApp_AG/backend/app/services/atzmai_client.py))
Converts USD amounts to ILS dynamically before sending payloads to Atzmai:
```python
async def get_usd_to_ils_rate() -> float:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://open.er-api.com/v6/latest/USD", timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get("ILS")
                if rate:
                    return float(rate)
    except Exception:
        pass
    return 3.70
```
