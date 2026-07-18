# Experts Campaign Platform

A localized promotional campaign system that lets verified Fashion Experts publish geo-targeted offers for users near their business.

## Overview

The Campaign Platform is DressApp's "Know Your Neighborhood" engine. Verified experts (boutiques, tailors, stylists, designers, personal shoppers, etc.) create campaigns with a discount, coupon code, promotion details, and a geographic radius. Every campaign goes through admin moderation before it becomes visible. Campaigns can optionally trigger push notifications and/or email notifications to nearby, matching users.

## Prerequisites

- You must be registered as a verified Fashion Professional in your Profile (toggle "Fashion Pro").
- Your profile must have `approval_status ≠ hidden` (approved by a DressApp admin).
- Only fashion-related categories are accepted (Boutique, Tailor, Stylist, Designer, Accessories, Bridal, Vintage, etc.).
- You must have a **PayPal account** connected (either `paypal_receiver_email` set in Profile → Payment Settings, or a prior PayPal purchase in DressApp). This is required to pay the campaign fee.


## Campaign Workflow

```
Expert creates campaign
    ↓
Status = Draft
    ↓
Expert submits campaign
    ↓
PayPal SDK button shown → Expert authorizes payment ($1/day × N days)
    ↓
Payment captured → Admin alert email fired to dev@dressapp.co
    ↓
Status = Pending Approval
    ↓
DressApp Admin reviews
    ↓
  ┌─ Approved → Status = Active (visible to users, payment already collected)
  │       ↓
  │  Optional notifications sent (Push / Email)
  │       ↓
  │  Campaign expires automatically on end_date
  └─ Rejected → Status = Rejected (expert sees reason + can re-edit & resubmit)
```

## Campaign Statuses

| Status | Description |
|---|---|
| `draft` | Created but not yet submitted. Editable. |
| `pending_approval` | Submitted + paid, awaiting admin review. Read-only. |
| `approved` | Approved, waiting for start_date to arrive. |
| `active` | Live — visible in the campaign feed and ticker. |
| `paused` | Manually paused by the expert. Hidden from feed. Paused days are added back to end_date on resume. |
| `rejected` | Rejected by admin. Expert sees rejection reason. Can be re-edited and resubmitted (re-payment required). |
| `payment_failed` | PayPal payment failed during submission. Expert must retry. |
| `expired` | End date has passed. Automatically removed from feed. |
| `cancelled` | Cancelled or deleted by the expert. No refund for active campaigns. |


## Step-by-Step: Creating a Campaign

1. **Open Experts tab** → click the **Campaigns** sub-tab.
2. Click **New Campaign** or navigate to `/campaigns/create`.
3. Complete the **6-step wizard**:
   - **Basic** — Title, business name, category, short + long description, cover image URL.
   - **Promotion** — Discount %, coupon code, sale type, start/end dates, limited-time toggle.
   - **Location** — Country, city, GPS coordinates (lat/lon), reach radius (5–100 km).
   - **Audience** — Target genders/styles (Women, Men, Kids, Luxury, Casual, Sustainable, Streetwear), age range.
   - **Notifications** — Master on/off switch, channels (Push / Email), timing (immediately after approval / on start date / custom).
   - **Review** — Summary including **campaign fee breakdown** ($1.00/day × N days = $N.00 USD).
4. Click **Submit for Approval**:
   - If PayPal is not connected → a dialog appears with a link to Profile → Payment Settings.
   - If PayPal is connected → a PayPal payment button appears. Complete the payment.
   - After payment, the campaign moves to `pending_approval`. An alert email is sent to `dev@dressapp.co`.

## Campaign Feed

- Navigate to `/experts?tab=campaigns` to browse the feed.
- Sort by: Newest · Ending Soon · Highest Discount.
- Feed is geo-filtered: campaigns are matched to your device location within their radius.
- Only **Active** + **Admin Approved** campaigns are shown.
- Infinite scroll with skeleton loading.

## Campaign Detail

- Tap any campaign card to open the full detail page.
- Shows: hero image gallery, promotion details (discount badge, coupon code), expiry countdown, business info, Google Maps embed + "Get Directions" link, analytics strip (views, saves, shares), Save / Share / Report buttons.

## Home Screen Integration

The promotion ticker on the Home screen rotates active campaigns alongside standard ads. Campaigns are prioritized by nearest + highest relevance.

## Notifications

### Push Notifications

Sent only when ALL conditions are met:
- Campaign is Admin Approved + Active.
- User is within the campaign radius.
- User matches campaign audience (gender, age range).
- User has Push Notifications enabled.
- User has not already received a push for this campaign.
- User's Campaign Notification Preference `local_fashion_push` is not explicitly disabled.

### Email Notifications

Sent only when ALL conditions are met:
- Campaign is Admin Approved + Active.
- User is within the campaign radius.
- User matches campaign audience.
- User has a verified email address.
- User has not already received an email for this campaign.
- User's Campaign Notification Preference `local_fashion_email` is not explicitly disabled.

### Notification Timing

| Option | Behaviour |
|---|---|
| Immediately after approval | Sent as soon as the admin approves |
| On campaign start date | Sent by the APScheduler when start_date arrives (every 5 min poll) |
| Custom date & time | Expert picks an exact date-time |

Each channel (push, email) is sent at most once per campaign per user.

## User Notification Preferences

Users can manage campaign notification preferences in **Profile → Campaign Notifications**:

- Toggle: Local Fashion Offers (Push)
- Toggle: Local Fashion Offers (Email)
- Toggle: Sale Alerts, New Expert Near Me, Sustainable Fashion, Luxury, Personal Stylist
- Frequency: Instant / Daily Digest / Weekly Digest
- Max campaign distance: 5 / 10 / 25 / 50 km

## Admin Moderation

Admins review campaigns in **Admin → Campaign Queue**.

- Default view: `pending_approval` campaigns.
- Switch to "All Campaigns" to see every status.
- **Approve**: Campaign moves to `active` (or `approved` if start_date is in the future). Notifications fire immediately if configured.
- **Reject**: Admin must enter a rejection reason (≥5 chars). Reason is displayed to the expert.
- **Admin edit**: Admin can adjust title, description, images, dates, and location before approval.

## Anti-Abuse Rules

- Maximum **3 active/pending/paused campaigns** per Expert at any time.
- Category must be fashion-related (server validates on submit).
- Experts must be verified (`is_professional=True`, not hidden).
- All moderation actions are logged to the `campaign_approvals` collection.
- **PayPal connection is required** before submitting a campaign.

---

## Monetization

DressApp charges a **$1.00 USD per day** campaign fee.

| Step | What happens |
|---|---|
| Expert submits | PayPal order created for full duration ($1 × N days) |
| Expert clicks PayPal button | Payment captured immediately |
| Admin approves | Campaign goes live (payment already collected) |
| Admin rejects | No automatic refund — manual credit may be issued |

### Fee Calculation
`total_fee = max(1, end_date − start_date in days) × $1.00 USD`

For campaigns without an end date, a minimum of $1.00 is charged.

### Extension Billing
When an expert extends a campaign:
1. Expert picks a new end date in Campaign Settings → Extend.
2. A new PayPal order is created for the additional days only.
3. Expert completes the PayPal flow in-app.
4. End date is updated immediately — **no admin review required**.
5. Extension is recorded in `billing.extension_history`.

### Billing Record
Each campaign stores a `billing` sub-document:
```json
{
  "fee_per_day_cents": 100,
  "currency": "USD",
  "total_days": 14,
  "total_fee_cents": 1400,
  "paypal_order_id": "...",
  "paypal_capture_id": "...",
  "payer_email": "expert@example.com",
  "paid_at": "2026-07-18T...",
  "payment_status": "paid",
  "extension_history": [...],
  "paused_periods": [...],
  "total_paused_days": 2
}
```

---

## Campaign Lifecycle Management (Expert)

Experts can manage active campaigns from **My Campaigns → Settings** (gear icon).

### Extend
- Pick a new end date (must be after current end date).
- Fee preview shows additional days × $1.00.
- PayPal payment required. Extension is auto-approved.

### Pause
- Hidden from the campaign feed immediately.
- The expert continues to count against the "3 campaign" limit.
- **Paused days are NOT charged** — when the campaign is resumed, `end_date` is automatically extended by the number of paused days.

### Resume
- Campaign becomes visible in the feed again.
- `end_date` is extended by the total paused duration.

### Delete
- Campaign is permanently removed (status = `cancelled`).
- **No refund** is issued for active campaigns with remaining days.
- Campaigns in `expired` or `cancelled` state cannot be deleted (already ended).

---

## Admin Email Alerts

Every time an expert submits a campaign (after PayPal payment), an automatic alert is sent to `dev@dressapp.co` containing:
- Campaign title, business name, category
- Location and run dates
- Expert name and email
- Total campaign fee
- Direct links to the Admin Panel and campaign preview



## Database Collections

| Collection | Purpose |
|---|---|
| `experts_campaigns` | Campaign documents (all fields) |
| `campaign_approvals` | Audit log: approve/reject/edit actions by admin |
| `campaign_billing_log` | Billing events: approval charge, extension captures |
| `campaign_notifications` | Per-user, per-channel delivery tracking |
| `campaign_analytics` | (Future) Per-event impression/click log |


## Future Roadmap

- Sponsored / paid campaign boosts
- AI campaign recommendations
- Campaign performance dashboard
- Coupon redemption + QR code promotions
- Seasonal & recurring campaigns
- Multi-language campaign copy
- SMS / WhatsApp notification channels (provider interface already abstracted)

## Troubleshooting

- **Campaign not appearing in feed**: Verify status is `active` and `admin_approved = true`. Check that end_date has not passed.
- **Notifications not sent**: Verify `notifications.master_enabled = true` and at least one channel is selected. Confirm user is within radius and has not already received the notification.
- **Submission rejected**: Read the rejection reason on `/campaigns/mine`. Edit the campaign and resubmit.
- **Category rejected**: Ensure your category is fashion-related (Boutique, Tailor, Stylist, etc.). Food/restaurant/automotive categories are not accepted.
