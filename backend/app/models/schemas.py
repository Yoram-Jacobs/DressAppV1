"""Pydantic v2 models that mirror the MongoDB schema.

All datetimes are serialised as ISO-8601 strings to avoid the
"datetime is not JSON serializable" MongoDB pitfall.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional, List

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


Source = Literal["Private", "Shared", "Retail"]
ListingSource = Literal["Shared", "Retail"]
ListingMode = Literal["sell", "swap", "donate", "rent"]
ListingStatus = Literal["draft", "active", "reserved", "sold", "removed"]
# Transaction lifecycle covers buy + swap + donate. Older clients only
# read pending/paid/refunded/failed/disputed; the new "accepted",
# "denied", "shipped", "completed" states are produced by the swap +
# donate pipelines and never appear in classic /buy transactions.
TxStatus = Literal[
    "pending", "paid", "refunded", "failed", "disputed",
    "accepted", "denied", "shipped", "completed",
]
Formality = Literal["casual", "smart-casual", "business", "formal"]
Condition = Literal["new", "like_new", "good", "fair"]
# Rich closet-item enums (used by AddItem flow + The Eyes analyzer)
GarmentState = Literal["new", "used"]
GarmentCondition = Literal["bad", "fair", "good", "excellent"]
GarmentQuality = Literal["budget", "mid", "premium", "luxury"]
GarmentGender = Literal["men", "women", "unisex", "kids"]
MarketplaceIntent = Literal["own", "for_sale", "donate", "swap", "rent"]
DressCode = Literal[
    "casual", "smart-casual", "business", "formal", "athletic", "loungewear"
]

# AI Provider and Plan Types
AiProvider = Literal["gemini", "claude", "openai"]
AiProviderMode = Literal["standard", "custom_keys", "on_device"]

# Credit Type (differentiate between free promotional credits vs paid credits)
CreditType = Literal["free", "paid"]

class WeightedTag(BaseModel):
    """Generic ``{name, pct}`` pair used for colours and fabric composition."""
    name: str
    pct: int | None = None  # 0..100, optional, e.g. "red" without %)


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(default_factory=_new_id)
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


# --------------------------- Users ---------------------------
class StyleProfile(BaseModel):
    aesthetics: list[str] = Field(default_factory=list)
    color_palette: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)
    body_notes: str | None = None
    budget_monthly_cents: int | None = None


class CulturalContext(BaseModel):
    region: str | None = None
    religion: str | None = None
    dress_conservativeness: Literal["low", "moderate", "high"] | None = None


class GoogleOAuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: str
    scopes: list[str] = Field(default_factory=list)


class SubscriptionInfo(BaseModel):
    is_active: bool = False
    plan_type: Literal["free", "monthly", "yearly"] = "free"
    stripe_subscription_id: str | None = None
    paypal_subscription_id: str | None = None
    expires_at: str | None = None
    cancelled_at: str | None = None
    ai_credits_enabled: bool = True
    ai_provider_mode: Literal["standard", "custom_keys", "on_device"] = "standard"
    ai_provider: str = "gemini"
    ai_model: str = "gemini-2.5-flash"
    ai_daily_limit: int = 100
    ai_daily_used: int = 0
    ai_monthly_limit: int = 1000
    ai_monthly_used: int = 0


class CreditBucket(BaseModel):
    """A bucket of credits with an expiration date.
    
    Free credits expire after 30 days. Paid credits have no expiry.
    When spending credits, we always use the oldest (oldest expiry first) buckets.
    """
    amount: int
    type: CreditType  # "free" or "paid"
    created_at: str  # ISO timestamp
    expires_at: str | None = None  # None means infinite (paid credits)

    class Config:
        frozen = True


class User(BaseDoc):
    email: EmailStr
    password_hash: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    locale: str = "en-US"
    preferred_language: str = "en"
    preferred_voice_id: str = "en_US-ryan-medium"
    home_location: dict[str, Any] | None = None
    style_profile: StyleProfile = Field(default_factory=StyleProfile)
    cultural_context: CulturalContext = Field(default_factory=CulturalContext)
    google_oauth: GoogleOAuthTokens | None = None
    stripe_account_id: str | None = None
    stripe_onboarding_complete: bool = False
    roles: list[str] = Field(default_factory=lambda: ["user"])
    subscription: SubscriptionInfo = Field(default_factory=SubscriptionInfo)
    closet_capacity_bonus: int = 0

    # --- Extended profile (Phase T) -------------------------------------
    # Plain identity — populated from OAuth `given_name` / `family_name` on
    # first Google connect, editable afterwards.
    first_name: str | None = None
    last_name: str | None = None
    # Optional brand / company name — sellers running their listings as a
    # boutique can set this and it'll appear instead of their personal
    # name on the marketplace listing detail page. Distinct from
    # display_name so power-users can have a casual handle plus a
    # business-facing brand simultaneously.
    company_name: str | None = None
    phone: str | None = None
    date_of_birth: str | None = None  # ISO YYYY-MM-DD
    sex: Literal["male", "female"] | None = None
    personal_status: Literal[
        "single", "married", "divorced", "widowed"
    ] | None = None
    address: dict[str, Any] | None = None  # {line1,line2,city,region,country,postal_code}

    # Unit preferences: weight (kg | lb) + length (cm | in).
    units: dict[str, Any] | None = None

    # Photos — stored as data URLs so we stay inside the current serverless
    # Mongo footprint (no external blob store yet). Capped client-side to
    # ~500 KB each.
    face_photo_url: str | None = None
    body_photo_url: str | None = None

    # Body measurements kept in one nested doc so adding a field later is a
    # one-line change and doesn't bloat the user root document.
    body_measurements: dict[str, Any] | None = None

    # Hair profile (length / type / color / style).
    hair: dict[str, Any] | None = None

    # Calculated 3D Avatar parameters
    avatar_shape_params: dict[str, Any] | None = None

    # --- Phase 4P: PayPal payouts ---
    # Email address used to receive seller payouts via PayPal Payouts API.
    paypal_receiver_email: str | None = None

    # --- Phase TS-2 (Trend-Scout personalization) ---
    # Free-text occupation used as a signal when ranking Trend-Scout
    # cards. Distinct from ``professional.profession`` (which is the
    # fashion-pro toggle for the /experts directory) — this is the
    # user's actual day-job, e.g. "marketing manager", "student",
    # "barista". Optional; absent users get neutral newest-first
    # ranking.
    occupation: str | None = None

    # --- Professional (Phase U) ----------------------------------------
    # Self-service "is fashion professional?" toggle + business card.
    # When is_professional=True the user appears in the /experts directory
    # (unless approval_status='hidden' by admin moderation).
    is_professional: bool = False
    professional_details: dict[str, Any] = Field(default_factory=dict)

    # --- Phase 4P: AI Credits System - Credit Buckets (replaces simple ai_credits)
    # List of credit buckets. Each bucket has an amount, type (free/paid),
    # creation date, and expiry (None for paid/never-expiring credits).
    # We use LIFO/FIFO ordering based on creation order - oldest first gets spent first.
    credit_buckets: List[CreditBucket] = Field(default_factory=list)

    # --- Legacy compatibility field (kept for backward compatibility) ----
    # This is computed from credit_buckets; do not update directly.
    _ai_credits_computed: int | None = None  # Internal use only

    # --- Phase AS-3: Free tier credit management (enhanced with buckets) ---
    # Free AI credits daily allocation (these go into free buckets with expiry)
    free_ai_credits_daily: int = Field(default_factory=lambda: 10)

    # --- Calendar and Scheduling ---
    calendar_events: list[dict[str, Any]] = Field(default_factory=list)

    # Model config
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    @property
    def total_credits(self) -> int:
        """Get total available credits across all non-expired buckets."""
        now = _now_iso()
        total = 0
        for bucket in self.credit_buckets:
            # Skip if expired (for free credits with expiry)
            if bucket.type == "free" and bucket.expires_at and now > bucket.expires_at:
                continue
            total += bucket.amount
        return total

    def get_aging_credit_buckets(self) -> List[CreditBucket]:
        """
        Get credit buckets sorted by age (oldest first) for consumption.
        Free credits expire after 30 days; paid credits never expire.
        Order: free expiring soonest first, then other free credits, then paid credits.
        """
        now = _now_iso()
        buckets_with_priority = []
        for bucket in self.credit_buckets:
            # Determine sort priority: lower = earlier to be consumed
            if bucket.type == "free" and bucket.expires_at:
                # Free credits with expiry: sort by expiry (earliest first)
                priority = (0, bucket.expires_at)
            elif bucket.type == "free":
                # Unexpired free credits: sort by created_at
                priority = (1, bucket.created_at)
            else:
                # Paid credits: no expiry, sort by created_at
                priority = (2, bucket.created_at)
            buckets_with_priority.append((priority, bucket))
        # Sort by priority tuple
        buckets_with_priority.sort(key=lambda x: x[0])
        return [bucket for _, bucket in buckets_with_priority]

    def add_credit_bucket(self, amount: int, credit_type: CreditType, days_until_expiry: int | None = None) -> None:
        """Add a new credit bucket to the user's credit history."""
        now = _now_iso()
        expires_at: str | None = None
        if credit_type == "free" and days_until_expiry is not None:
            # Calculate expiry date (30 days default for free credits)
            from datetime import timedelta
            expiry_dt = datetime.fromisoformat(now.replace("Z", "+00:00")) + timedelta(days=days_until_expiry)
            expires_at = expiry_dt.isoformat()
        
        new_bucket = CreditBucket(
            amount=amount,
            type=credit_type,
            created_at=now,
            expires_at=expires_at
        )
        self.credit_buckets.append(new_bucket)
        # Clear computed cache
        self._ai_credits_computed = None

    def spend_credits(self, required_amount: int, operation: str | None = None) -> tuple[bool, List[dict]]:
        """
        Spend credits from the oldest buckets first. Returns (success, details of what was spent).
        Updates credit_buckets in-place.
        """
        if required_amount <= 0:
            return True, [{"type": "noop", "amount": 0, "operation": operation or "usage"}]
        
        buckets = self.get_aging_credit_buckets()
        remaining = required_amount
        spent_details = []
        
        i = 0
        while remaining > 0 and i < len(buckets):
            bucket = buckets[i]
            if bucket.type == "free" and bucket.expires_at and _now_iso() > bucket.expires_at:
                # Skip expired free credits
                i += 1
                continue
            
            if bucket.amount >= remaining:
                # This bucket covers everything needed
                spent_details.append({
                    "bucket_index": i,
                    "type": bucket.type,
                    "amount_spent": remaining,
                    "remaining_after": bucket.amount - remaining,
                    "operation": operation
                })
                if bucket.amount - remaining > 0:
                    # Update bucket amount in place
                    buckets[i].amount -= remaining
                else:
                    # Remove empty bucket
                    buckets.pop(i)
                    # Adjust index since list changed
                    i -= 1
                remaining = 0
            else:
                # Use entire bucket
                spent_details.append({
                    "bucket_index": i,
                    "type": bucket.type,
                    "amount_spent": bucket.amount,
                    "remaining_after": 0,
                    "operation": operation
                })
                buckets.pop(i)
                remaining -= bucket.amount
                i -= 1  # adjust after pop
        
        # Update the credit_buckets list
        self.credit_buckets = buckets
        self._ai_credits_computed = None
        return True, spent_details

    def get_credit_usage_summary(self) -> dict[str, Any]:
        """Return a summary of credit usage by type and age."""
        now = _now_iso()
        free_total = 0
        paid_total = 0
        free_expired = 0
        
        for bucket in self.credit_buckets:
            if bucket.type == "free":
                free_total += bucket.amount
                if bucket.expires_at and now > bucket.expires_at:
                    free_expired += bucket.amount
            else:
                paid_total += bucket.amount
        
        return {
            "free_available": free_total - free_expired,
            "free_expired": free_expired,
            "paid": paid_total,
            "total": self.total_credits,
            "bucket_count": len(self.credit_buckets)
        }