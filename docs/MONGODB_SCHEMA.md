# DressApp — MongoDB Schema Reference

> **Version:** 2.0 (Verified against `backend/app/models/schemas.py` & `credit.py`)  
> **Database:** MongoDB Atlas M10 (Cluster: `dressapp_prod`)  
> **Conventions:**
> - All documents use UUID strings (`id: str`) as their primary domain identifier.
> - Timestamps are ISO-8601 strings (`created_at`, `updated_at`) to ensure lossless JSON serialization.
> - Monetary amounts are represented in integer minor units / cents (`amount_cents`, `price_cents`) to avoid floating-point drift.

---

## 1. Collections & Indexes Summary

| Collection | Purpose | Key Indexes |
|---|---|---|
| `users` | Auth, profile preferences, body sizing, and credit ledger | `email` (unique), `id` (unique), `stripe_account_id` |
| `closet_items` | Digitized garments with visual matting and taxonomy | `user_id`, `source`, `category`, text on `tags`, `(user_id, category)` |
| `listings` | Marketplace items (sell, swap, donate, rent) | `source`, `status`, `seller_id`, `category`, 2dsphere on `location` |
| `transactions` | Marketplace payment and fulfillment ledger | `buyer_id`, `seller_id`, `listing_id`, `status`, `paypal.order_id` (unique, sparse) |
| `stylist_sessions` | Long-lived conversational stylist memory | `user_id` (unique), `id` (unique) |
| `stylist_messages` | Individual conversation turns within a stylist session | `(session_id, created_at)` compound, `session_id` |
| `embeddings` | Multi-modal vector store for visual and semantic retrieval | `entity_type`, `entity_id`, Atlas Vector Search index on `vector` |
| `cultural_rules` | Regional, religious, and dress-code constraints | `(region, religion, occasion)` compound |
| `trend_reports` | Daily automated fashion trend reports (Trend Scout) | `date`, `category`, `(date, category)` (unique) |
| `outfits` | Saved AI and user-composed outfit sets | `user_id`, `created_at`, `(user_id, created_at)` |
| `ad_campaigns` | Expert directory promotional campaigns | `(owner_id, created_at)`, `(status, target_country, target_region)` |
| `user_credits` | Expert advertising credits per user and currency | `(user_id, currency)` (unique) |
| `credit_topups` | Expert ad credit deposit receipts | `(user_id, created_at)`, `paypal_order_id` (unique) |
| `ai_credit_purchases` | Purchased non-expiring AI credit packs | `(user_id, created_at)`, `paypal_order_id` (unique) |
| `suitcases` | Travel packing assistant trips and checklists | `user_id`, `id` (unique) |

---

## 2. Collection Schemas

### 2.1 `users`

Represents user accounts, authentication data, styling profile, body sizing, and credit balances.

```json
{
  "id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "email": "user@example.com",
  "password_hash": "$2b$12$...",
  "display_name": "Jordan Smith",
  "avatar_url": "https://dressapp.co/static/avatars/c1f7b0f6.jpg",
  "locale": "en-US",
  "preferred_language": "en",
  "preferred_voice_id": "aura-2-thalia-en",
  "home_location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "city": "New York"
  },
  "style_profile": {
    "aesthetics": ["minimalist", "smart-casual"],
    "color_palette": ["navy", "white", "earth-tones"],
    "avoid": ["loud prints", "neon"],
    "body_notes": "tall, athletic build",
    "budget_monthly_cents": 25000
  },
  "cultural_context": {
    "region": "US",
    "religion": null,
    "dress_conservativeness": "moderate"
  },
  "google_oauth": {
    "access_token": "ya29...",
    "refresh_token": "1//04...",
    "expires_at": "2026-09-04T12:00:00Z",
    "scopes": ["https://www.googleapis.com/auth/calendar.readonly"]
  },
  "stripe_account_id": "acct_1N...",
  "stripe_onboarding_complete": true,
  "roles": ["user"],
  "credit_buckets": [
    {
      "amount": 10,
      "type": "free",
      "created_at": "2026-09-03T00:00:00Z",
      "expires_at": "2026-10-03T00:00:00Z"
    },
    {
      "amount": 50,
      "type": "paid",
      "created_at": "2026-08-15T10:00:00Z",
      "expires_at": null
    }
  ],
  "free_ai_credits_daily": 10,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-09-03T11:00:00Z"
}
```

#### The `CreditBucket` System (`credit.py`)
- **`type: "free"`**: 10 daily complimentary credits granted per user with a 30-day expiration (`expires_at = created_at + 30 days`).
- **`type: "paid"`**: Purchased credit bundles with infinite lifetime (`expires_at = null`).
- **Spend Precedence**: Spent credits drain the oldest soonest-expiring free buckets first, preserving paid credits.

---

### 2.2 `closet_items`

Primary entity for user garments cataloged via camera capture, manual upload, or DPP scanning.

```json
{
  "id": "e4b2d184-3c67-4e92-91d8-04f7b2c9e782",
  "user_id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "source": "Private",
  "category": "top",
  "sub_category": "blazer",
  "title": "Navy Wool Double-Breasted Blazer",
  "brand": "SuitSupply",
  "size": "40R",
  "color": "navy",
  "colors": [
    { "name": "navy", "pct": 90 },
    { "name": "gold", "pct": 10 }
  ],
  "material": "wool",
  "fabrics": [
    { "name": "wool", "pct": 95 },
    { "name": "elastane", "pct": 5 }
  ],
  "pattern": "solid",
  "season": ["fall", "winter", "spring"],
  "formality": "business",
  "state": "used",
  "condition": "good",
  "quality": "premium",
  "gender": "men",
  "marketplace_intent": "own",
  "dress_code": "business",
  "cultural_tags": ["modest"],
  "tags": ["tailored", "office", "blazer", "navy"],
  "original_image_url": "https://dressapp.co/static/raw/e4b2d184.jpg",
  "clean_image_url": "https://dressapp.co/static/clean/e4b2d184.png",
  "thumbnail_url": "https://dressapp.co/static/thumbs/e4b2d184.webp",
  "dpp_data": {
    "gtin": "08432198765432",
    "facility_country": "IT",
    "carbon_footprint_kg": 14.2,
    "care_instructions": ["dry_clean_only", "iron_low"]
  },
  "reshoot_history": [
    {
      "prompt": "Remove brass button reflections",
      "timestamp": "2026-08-20T14:30:00Z",
      "image_url": "https://dressapp.co/static/clean/e4b2d184_v1.png"
    }
  ],
  "repair_advice": "Re-stitch cuff buttons within 6 months.",
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-20T14:30:00Z"
}
```

---

### 2.3 `listings`

Marketplace entries allowing users to monetize, swap, donate, or rent garments.

```json
{
  "id": "78a1bc45-e123-4b67-890a-bcdef1234567",
  "seller_id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "item_id": "e4b2d184-3c67-4e92-91d8-04f7b2c9e782",
  "source": "Shared",
  "mode": "sell",
  "status": "active",
  "title": "Navy Wool Double-Breasted Blazer (Excellent Condition)",
  "description": "Worn twice to weddings. Perfectly tailored fit.",
  "category": "top",
  "brand": "SuitSupply",
  "size": "40R",
  "price_cents": 18000,
  "shipping_fee_cents": 1500,
  "currency": "USD",
  "allow_offers": true,
  "minimum_offer_cents": 15000,
  "location": {
    "type": "Point",
    "coordinates": [-74.0060, 40.7128],
    "city": "New York",
    "country": "US"
  },
  "images": [
    "https://dressapp.co/static/clean/e4b2d184.png"
  ],
  "created_at": "2026-08-22T09:00:00Z",
  "updated_at": "2026-08-22T09:00:00Z"
}
```

---

### 2.4 `transactions`

Payment and fulfillment state machine for marketplace activities.

```json
{
  "id": "90fe2341-b123-4c56-789a-0123456789ab",
  "listing_id": "78a1bc45-e123-4b67-890a-bcdef1234567",
  "buyer_id": "f8a92b31-0192-4918-ba21-123456789abc",
  "seller_id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "mode": "sell",
  "status": "paid",
  "amount_cents": 18000,
  "shipping_cents": 1500,
  "platform_fee_cents": 1260,
  "currency": "USD",
  "paypal": {
    "order_id": "7AB12345CD67890EF",
    "capture_id": "1EF23456GH78901IJ",
    "payer_email": "buyer@example.com"
  },
  "shipping_address": {
    "name": "Alex Mercer",
    "street": "100 Broadway",
    "city": "New York",
    "state": "NY",
    "postal_code": "10005",
    "country": "US"
  },
  "created_at": "2026-08-23T15:00:00Z",
  "updated_at": "2026-08-23T15:05:00Z"
}
```

#### Transaction Lifecycle States (`TxStatus`)
- **Direct Sale**: `pending` → `paid` → `shipped` → `completed` (or `refunded`, `failed`, `disputed`).
- **Swap / Donation**: `pending` → `accepted` | `denied` → `shipped` → `completed`.

---

### 2.5 `stylist_sessions` & `stylist_messages`

Persistent conversation memory maintaining multi-turn styling interactions and grounded advice.

```json
// stylist_sessions
{
  "id": "ses_01928374-65ab-7c8d-9e0f-1234567890ab",
  "user_id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "title": "Autumn Business Casual Wardrobe Refresh",
  "summary": "User prefers navy blazers paired with grey chinos for client meetings.",
  "created_at": "2026-09-01T08:00:00Z",
  "updated_at": "2026-09-03T10:30:00Z"
}

// stylist_messages
{
  "id": "msg_01928374-65ab-7c8d-9e0f-1234567890cd",
  "session_id": "ses_01928374-65ab-7c8d-9e0f-1234567890ab",
  "role": "assistant",
  "content": "Given today's 18°C temperature and your 2:00 PM boardroom meeting, I recommend your SuitSupply blazer layered over the white Uniqlo oxford shirt.",
  "outfit_recommendation": {
    "item_ids": [
      "e4b2d184-3c67-4e92-91d8-04f7b2c9e782",
      "99a12384-5c67-4e92-88d8-04f7b2c9e111"
    ],
    "occasion": "business",
    "rationale": "Matches meeting dress code and handles mild outdoor transit."
  },
  "created_at": "2026-09-03T10:30:00Z"
}
```

---

### 2.6 `suitcases`

Manages packing lists for trips, cross-referencing wardrobe items with weather and planned activities.

```json
{
  "id": "suit_12345678-abcd-ef01-2345-6789abcdef01",
  "user_id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "destination": "Milan, Italy",
  "start_date": "2026-09-15",
  "end_date": "2026-09-20",
  "purpose": "Fashion Week & Client Dinners",
  "items": [
    {
      "item_id": "e4b2d184-3c67-4e92-91d8-04f7b2c9e782",
      "category": "top",
      "is_packed": true,
      "packed_at": "2026-09-14T18:00:00Z"
    }
  ],
  "ai_proposals": [
    {
      "day": 1,
      "occasion": "Welcome Cocktail",
      "item_ids": ["e4b2d184-3c67-4e92-91d8-04f7b2c9e782"]
    }
  ],
  "status": "active",
  "created_at": "2026-09-02T12:00:00Z",
  "updated_at": "2026-09-03T09:00:00Z"
}
```

---

### 2.7 `ad_campaigns`, `user_credits` & `credit_topups`

Powers the verified Experts directory, self-serve home feed ad tickers, and credit ledgers.

```json
// ad_campaigns
{
  "id": "camp_55112233-4455-6677-8899-aabbccddeeff",
  "owner_id": "c1f7b0f6-9f1e-4518-8f15-3b9845012345",
  "title": "Bespoke Tailoring by Maestro Rossi",
  "headline": "Hand-stitched Italian suits in Lower Manhattan",
  "cta_url": "https://dressapp.co/experts/rossi",
  "daily_budget_cents": 100,
  "status": "active",
  "target_country": "US",
  "target_region": "NY",
  "impressions": 1420,
  "clicks": 88,
  "created_at": "2026-08-01T00:00:00Z",
  "updated_at": "2026-09-03T00:00:00Z"
}
```
