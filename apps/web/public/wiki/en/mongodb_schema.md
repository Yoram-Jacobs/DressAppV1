# DressApp — MongoDB Schema (Phase 1)

> All documents use `id: UUID (string)` as the public identifier. The native `_id` is excluded from API responses.  
> Timestamps are ISO-8601 strings (not `BSON Date`) to avoid the classic `datetime not JSON serializable` pitfall.  
> All monetary amounts are stored as **cents/minor units** (integers) to avoid float drift.

---

## Collections & Indexes

| Collection         | Purpose                                              | Key Indexes                                                                         |
|--------------------|------------------------------------------------------|-------------------------------------------------------------------------------------|
| `users`            | Auth + profile + style preferences + OAuth tokens    | `email` (unique), `stripe_account_id`                                                |
| `closet_items`     | User's wardrobe items                                | `user_id`, `source`, `category`, text index on `tags`                                |
| `listings`         | Marketplace items (subset of closet_items or retail) | `source`, `status`, `seller_id`, `category`, 2dsphere on `location`                   |
| `transactions`     | Money ledger for marketplace sales                   | `buyer_id`, `seller_id`, `listing_id`, `status`, `paypal.order_id` (unique, partial) |
| `stylist_sessions` | Per-user agent memory (Durable Object equivalent)    | `user_id` (unique)                                                                    |
| `stylist_messages` | Conversation turns within a session                  | `(session_id, created_at)` compound                                                    |
| `embeddings`       | Vector store for items / outfits / text queries      | `entity_type`, `entity_id`; **Atlas Vector Search** on `vector`                       |
| `cultural_rules`   | Regional / religious / occasion constraints          | `(region, religion, occasion)` compound                                                |
| `trend_reports`    | Daily Trend-Scout summaries                          | `date`, `category`                                                                    |
| `outfits`          | Saved AI-generated outfits for later reuse           | `user_id`, `created_at`                                                                |
| `ad_campaigns`     | Expert promotion ad campaigns                        | `(owner_id, created_at)`, `(status, target_country, target_region)`                 |
| `user_credits`     | Prepaid ad credits per user & currency               | `(user_id, currency)` (unique)                                                       |
| `credit_topups`    | Paid ad credits deposit ledger                       | `(user_id, created_at)`, `paypal_order_id` (unique)                                  |
| `ai_credit_purchases` | Paid AI credit purchases (never expire)            | `(user_id, created_at)`, `paypal_order_id` (unique)                                  |
| `suitcases`        | Travel packing assistant lists and outfits           | `user_id`                                                                           |

---

## 1. `users`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "password_hash": "bcrypt$...",           // null if OAuth-only
  "display_name": "Alex",
  "avatar_url": "https://...",
  "locale": "en-US",
  "preferred_language": "en",              // Whisper / Deepgram / Gemini language
  "preferred_voice_id": "aura-2-thalia-en",// Deepgram Aura-2 voice
  "home_location": { "lat": 40.7128, "lng": -74.0060, "city": "New York" },
  "style_profile": {
    "aesthetics": ["minimalist", "smart-casual"],
    "color_palette": ["navy", "ivory", "olive"],
    "avoid": ["neon", "logos"],
    "body_notes": "tall, athletic",
    "budget_monthly_cents": 15000
  },
  "cultural_context": {
    "region": "US",
    "religion": null,
    "dress_conservativeness": "moderate"
  },
  "google_oauth": {                         // stored only after /oauth/google/callback
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": "2025-01-01T00:00:00Z",
    "scopes": ["https://www.googleapis.com/auth/calendar.readonly"]
  },
  "stripe_account_id": "acct_xxx",          // Stripe Connect Express (seller side)
  "stripe_onboarding_complete": false,
  "roles": ["user"],                        // 'admin' for backoffice
  "credit_buckets": [                       // Prepaid credits buckets list
    {
      "amount": 10,
      "type": "free",                       // free | paid
      "created_at": "2026-08-09T00:00:00Z",
      "expires_at": "2026-09-08T00:00:00Z"  // 30-day expiry for free credits, null for paid
    }
  ],
  "free_ai_credits_daily": 10,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

---

## 2. `closet_items`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "source": "Private",                      // SOURCE TAG: 'Private' | 'Shared' | 'Retail'
  "category": "top",                        // top | bottom | outerwear | shoes | accessory | dress | full_outfit
  "sub_category": "shirt",
  "title": "White Oxford Shirt",
  "brand": "Uniqlo",
  "size": "M",
  "color": "white",
  "material": "cotton",
  "pattern": "solid",
  "season": ["spring", "summer", "fall"],
  "formality": "smart-casual",              // casual | smart-casual | business | formal
  "cultural_tags": [],                       // e.g. ['modest', 'hijab-friendly']
  "tags": ["oxford", "office", "layerable"],
  "original_image_url": "s3://.../raw.jpg",
  "segmented_image_url": "s3://.../segmented.png",
  "clean_image_url": "data:image/png;base64,...",
  "clean_image_status": "ready",              // "pending" | "ready" | "failed"
  "reconstructed_image_url": "data:image/png;base64,...",
  "reconstruction_metadata": {
    "method": "completion",                  // "completion" | "reconstruction"
    "model": "gemini-3.1-flash-lite-image",
    "prompt": "...",
    "reasons": ["quality_checker:needs_completion", "reason:..."],
    "deferred": true
  },
  "image_quality_status": "needs_completion", // "complete" | "needs_completion" | "needs_reconstruction"
  "image_quality_reason": "Missing right hem and occluded collar",
  "reconstruction_prompt": "Complete the missing right hem and collar...",
  "thumbnail_data_url": "data:image/webp;base64,...",
  "placeholder_data_url": "data:image/webp;base64,...",
  "embedding_id": "uuid",                    // FK → embeddings.id
  "purchase_price_cents": 3500,
  "purchase_currency": "USD",
  "purchase_date": "2024-03-01",
  "wear_count": 14,
  "last_worn_at": "2024-12-20T08:00:00Z",
  "notes": "Slightly small in shoulders",
  "retail_metadata": null,                   // populated when source='Retail'
  "dpp_data": null,                          // EU Digital Product Passport payload
  "source_sha256": "...",                    // in-browser SHA-256 duplicate fingerprint
  "source_phash": "...",                     // 64-bit perceptual visual hash
  "source_color_sig": "...",                 // 24-byte RGB color signature
  "is_duplicate": false,
  "from_receipt": false,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

`retail_metadata` (only when `source = 'Retail'`):

```json
{
  "retailer_name": "Zara",
  "product_url": "https://...",
  "sku": "...",
  "list_price_cents": 4500,
  "currency": "USD",
  "availability": "in_stock"
}
```

---

## 3. `listings`

Listings are marketplace-facing projections of a `closet_item`. Private items are listable as Shared/Retail only.

```json
{
  "id": "uuid",
  "closet_item_id": "uuid",                  // nullable if pure retail dropship
  "seller_id": "uuid",                       // users.id
  "source": "Shared",                        // 'Shared' | 'Retail'  (never 'Private')
  "mode": "sell",                             // sell | swap | donate
  "title": "White Oxford Shirt — worn twice",
  "description": "Barely worn, from smoke-free home.",
  "category": "top",
  "size": "M",
  "condition": "like_new",                   // new | like_new | good | fair
  "images": ["s3://..."],
  "location": { "type": "Point", "coordinates": [-74.006, 40.7128] },
  "ships_to": ["US", "CA"],
  "financial_metadata": {                    // FINANCIAL METADATA — required
    "list_price_cents": 2500,
    "currency": "USD",
    "platform_fee_percent": 7,
    "platform_fee_applied_after": "stripe_processing_fee",
    "stripe_processing_fee_percent": 2.9,
    "stripe_processing_fee_fixed_cents": 30,
    "estimated_seller_net_cents": 2224       // pre-computed preview for UI
  },
  "status": "active",                        // draft | active | reserved | sold | removed
  "views": 0,
  "favorites": 0,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

---

## 4. `transactions`

One document per marketplace payment. Gross, Stripe fees, platform fees and seller net are stored explicitly so the admin dashboard never has to recompute.

```json
{
  "id": "uuid",
  "listing_id": "uuid",
  "buyer_id": "uuid",
  "seller_id": "uuid",
  "currency": "USD",
  "financial": {                              // FINANCIAL METADATA (immutable ledger)
    "gross_cents": 2500,
    "stripe_fee_cents": 103,                  // round(2500*0.029 + 30) = 103
    "net_after_stripe_cents": 2397,
    "platform_fee_percent": 7,
    "platform_fee_cents": 168,                // round(2397 * 0.07) = 168
    "seller_net_cents": 2229,
    "platform_fee_applied_after": "stripe_processing_fee"
  },
  "stripe": {
    "checkout_session_id": "cs_...",
    "payment_intent_id": "pi_...",
    "transfer_id": "tr_...",
    "destination_account": "acct_xxx"         // seller's Stripe Connect account
  },
  "paypal": {
    "order_id": "order_xxx",
    "payout_item_id": "payout_xxx"
  },
  "status": "paid",                           // pending | paid | refunded | failed | disputed
  "paid_at": "2025-01-01T00:00:00Z",
  "refunded_at": null,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 5. `stylist_sessions` (Durable Object equivalent)

One per user — holds persistent agent memory.

```json
{
  "id": "uuid",
  "user_id": "uuid",                         // unique index
  "active_conversation_id": "uuid",
  "memory": {
    "long_term_preferences": ["prefers layering", "dislikes pastels"],
    "recent_outfits": [
      { "outfit_id": "uuid", "rating": 5, "occasion": "date night" }
    ],
    "feedback_signals": {
      "liked_tags": { "minimalist": 12, "linen": 7 },
      "disliked_tags": { "neon": 3 }
    }
  },
  "turns": 42,
  "last_active_at": "2025-01-01T00:00:00Z",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### `stylist_messages`

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "role": "user",                             // user | assistant | tool
  "input_modality": "image+voice",            // text | voice | image | image+text | image+voice
  "transcript": "What should I wear to the client meeting tomorrow?",
  "image_refs": ["s3://.../img.jpg"],
  "context": {
    "weather": { "temp_c": 6, "condition": "rain" },
    "calendar": [{ "title": "Client pitch", "start": "...", "formality_hint": "business" }]
  },
  "assistant_payload": {
    "outfit_recommendations": [
      {
        "name": "Navy suit + light blue oxford",
        "items": [
          { "closet_item_id": "uuid", "role": "top" },
          { "closet_item_id": "uuid", "role": "bottom" }
        ],
        "why": "Weather calls for layers; calendar has a client pitch at 10am."
      }
    ],
    "reasoning_summary": "...",
    "shopping_suggestions": [],
    "do_dont": []
  },
  "tts_audio_ref": "s3://.../reply.mp3",
  "latency_ms": { "whisper": 420, "sam": 650, "gemini": 1800, "deepgram": 210 },
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 6. `embeddings` (Vectorize equivalent)

```json
{
  "id": "uuid",
  "entity_type": "closet_item",               // closet_item | listing | outfit | query
  "entity_id": "uuid",
  "model": "clip-vit-l-14",                   // or sentence-transformers/all-MiniLM-L6-v2 for text
  "vector": [0.012, -0.034, ...],             // 512 or 768 dims
  "metadata": {
    "category": "top",
    "color": "white",
    "user_id": "uuid"
  },
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Atlas Vector Search index**:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "vector": { "type": "knnVector", "dimensions": 512, "similarity": "cosine" },
      "entity_type": { "type": "token" },
      "metadata.user_id": { "type": "token" }
    }
  }
}
```

---

## 7. `cultural_rules`

```json
{
  "id": "uuid",
  "region": "SA",
  "religion": "islam",
  "occasion": "mosque",
  "rules": {
    "required": ["cover_shoulders", "cover_knees", "no_sheer_fabric"],
    "recommended": ["loose_fit", "neutral_colors"],
    "disallowed": ["shorts", "sleeveless"]
  },
  "source": "editor",
  "priority": 10,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 8. `trend_reports`

```json
{
  "id": "uuid",
  "date": "2025-01-01",
  "bucket": "womens_ss25",
  "headline": "Butter yellow dominates Milan",
  "summary_md": "...",
  "sources": ["https://vogue.com/...", "https://bof.com/..."],
  "key_items": [
    { "name": "butter-yellow tailored blazer", "expected_price_band": "mid" }
  ],
  "language": "en",
  "country_code": "US",
  "origin_id": null,
  "generated_by": "trend-scout-agent@1.0",
  "created_at": "2025-01-01T06:00:00Z"
}
```

---

## 9. `outfits`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Rainy Tuesday client meeting",
  "items": [
    { "closet_item_id": "uuid", "role": "top" },
    { "closet_item_id": "uuid", "role": "bottom" },
    { "closet_item_id": "uuid", "role": "outerwear" }
  ],
  "source": "stylist_agent",
  "context_at_creation": {
    "weather": { "temp_c": 6, "condition": "rain" },
    "calendar": [{ "title": "Client pitch", "formality_hint": "business" }]
  },
  "user_rating": 5,
  "worn_on": ["2025-01-08"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 11. `ad_campaigns`

```json
{
  "id": "uuid",
  "owner_id": "uuid",
  "name": "Summer Boutique Promo",
  "profession": "stylist",
  "creative": {
    "headline": "Personal Styling Consultation",
    "body": "Book a 1-on-1 session with a professional stylist today.",
    "image_url": "https://...",
    "cta_label": "Book Now",
    "cta_url": "https://..."
  },
  "daily_budget_cents": 100,                 // $1.00 USD/day PayPal budget
  "bid_cents": 10,
  "start_date": "2026-08-01T00:00:00Z",
  "end_date": "2026-08-31T23:59:59Z",
  "target_country": "US",
  "target_region": "New York",
  "status": "active",                        // draft | active | paused | ended | disabled
  "status_reason": null,
  "currency": "USD",
  "impressions": 1420,
  "clicks": 98,
  "spent_cents": 980,
  "created_at": "2026-08-01T00:00:00Z",
  "updated_at": "2026-08-09T12:00:00Z"
}
```

---

## 12. `suitcases`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "destinations": "Lisbon, Portugal",
  "purpose": "Summer Vacation",
  "preferred_style": "casual",
  "departure_time": "2026-08-15T08:00:00Z",
  "return_time": "2026-08-22T20:00:00Z",
  "notes": "Warm weather, expect some light wind at night.",
  "status": "active",                        // gathering | reviewing | active | completed
  "outfits": [
    {
      "date": "2026-08-15",
      "items": [
        { "closet_item_id": "uuid", "role": "top" },
        { "closet_item_id": "uuid", "role": "bottom" }
      ]
    }
  ],
  "packing_list": [
    { "item_id": "uuid", "packed": true, "name": "White Linen Shirt" }
  ],
  "missing_notes": null,
  "local_fashion_stores": [],
  "missing_items": [],
  "created_at": "2026-08-09T10:00:00Z",
  "updated_at": "2026-08-09T10:30:00Z"
}
```

---

## 13. `ai_credit_purchases`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "pack": "50_credits",
  "credits_amount": 50,
  "amount_cents": 799,
  "currency": "USD",
  "status": "captured",                      // pending | captured | failed
  "paypal_order_id": "order_xxx",
  "paypal_capture_id": "capture_xxx",
  "payer_email": "buyer@example.com",
  "captured_at": "2026-08-09T11:00:00Z",
  "created_at": "2026-08-09T10:55:00Z",
  "updated_at": "2026-08-09T11:00:00Z"
}
```

---

## 14. `user_credits` & `credit_topups`

Prepaid ad credits (USD) used to pay for daily ad campaigns.

`user_credits` (per-user balance):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "currency": "USD",
  "balance_cents": 5000,
  "created_at": "2026-08-01T00:00:00Z",
  "updated_at": "2026-08-09T11:00:00Z"
}
```

`credit_topups` (deposit ledger):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "amount_cents": 2000,
  "currency": "USD",
  "status": "captured",
  "paypal_order_id": "order_yyy",
  "paypal_capture_id": "capture_yyy",
  "payer_email": "buyer@example.com",
  "captured_at": "2026-08-01T00:05:00Z",
  "created_at": "2026-08-01T00:00:00Z",
  "updated_at": "2026-08-01T00:05:00Z"
}
```

---

## 10. Index creation (idempotent bootstrap on FastAPI startup)

```python
await db.users.create_index("email", unique=True)
await db.users.create_index("stripe_account_id", sparse=True)
await db.users.create_index(
    [("professional.is_professional", 1), ("professional.approval_status", 1)],
    sparse=True,
)
await db.users.create_index([("professional.profession", 1)], sparse=True)
await db.closet_items.create_index([("user_id", 1), ("source", 1), ("category", 1)])
await db.closet_items.create_index([("tags", "text"), ("title", "text"), ("brand", "text")])
await db.listings.create_index([("source", 1), ("status", 1), ("category", 1)])
await db.listings.create_index([("seller_id", 1), ("status", 1)])
await db.listings.create_index([("location", "2dsphere")], sparse=True)
await db.transactions.create_index([("buyer_id", 1), ("created_at", -1)])
await db.transactions.create_index([("seller_id", 1), ("created_at", -1)])
await db.transactions.create_index(
    [("paypal.order_id", 1)],
    unique=True,
    partialFilterExpression={"paypal.order_id": {"$type": "string"}},
)
await db.transactions.create_index([("paypal.payout_item_id", 1)], sparse=True)
await db.paypal_events.create_index([("id", 1)], unique=True)
await db.stylist_sessions.create_index([("user_id", 1), ("last_active_at", -1)])
await db.stylist_messages.create_index([("session_id", 1), ("created_at", -1)])
await db.embeddings.create_index([("entity_type", 1), ("entity_id", 1)], unique=True)
await db.cultural_rules.create_index([("region", 1), ("religion", 1), ("occasion", 1)])
await db.trend_reports.create_index([("date", -1), ("bucket", 1)])
await db.trend_reports.create_index(
    [("bucket", 1), ("date", 1), ("language", 1), ("country_code", 1)], unique=True, sparse=True
)
await db.trend_reports.create_index(
    [("origin_id", 1), ("language", 1), ("country_code", 1)], unique=True, sparse=True
)
await db.ad_campaigns.create_index([("owner_id", 1), ("created_at", -1)])
await db.ad_campaigns.create_index([("status", 1), ("target_country", 1), ("target_region", 1)])
await db.user_credits.create_index([("user_id", 1), ("currency", 1)], unique=True)
await db.credit_topups.create_index([("user_id", 1), ("created_at", -1)])
await db.credit_topups.create_index([("paypal_order_id", 1)], unique=True, sparse=True)
await db.ai_credit_purchases.create_index([("user_id", 1), ("created_at", -1)])
await db.ai_credit_purchases.create_index([("paypal_order_id", 1)], unique=True, sparse=True)
await db.outfits.create_index([("user_id", 1), ("created_at", -1)])
await db.simulated_notifications.create_index([("user_id", 1), ("created_at", -1)])
await db.token_usage.create_index([("user_id", 1), ("created_at", -1)])
```
