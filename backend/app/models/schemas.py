"""Pydantic v2 models that mirror the MongoDB schema.

All datetimes are serialised as ISO-8601 strings to avoid the
"datetime is not JSON serializable" MongoDB pitfall.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal, List

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
# donate pipelines and never appear on classic /buy transactions.
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


class WeightedTag(BaseModel):
    """Generic ``{name, pct}`` pair used for colours and fabric composition."""
    name: str
    pct: int | None = None  # 0..100, optional (e.g. "red" without %)


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
    tier: Literal["free", "pro", "business", "manager", "professional"] = "free"
    stripe_subscription_id: str | None = None
    paypal_subscription_id: str | None = None
    expires_at: str | None = None
    cancelled_at: str | None = None


from app.models.credit import (
    CreditType,
    CreditBucket,
    get_total_credits,
    get_aging_credit_buckets as _get_aging_credit_buckets,
    add_credit_bucket as _add_credit_bucket,
    spend_credits as _spend_credits
)





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
    google_calendar_tokens: dict[str, Any] | None = None
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
    professional: dict[str, Any] | None = None

    # --- Migration & Competitor Onboarding ---
    migration_flag: Literal["New", "Migrate"] | None = None
    migration_details: dict[str, Any] | None = None

    # --- AI Stylist Scheduler Settings (Phase Scheduler) ---
    scheduler_settings: dict[str, Any] | None = None
    web_push_subscriptions: list[dict] = Field(default_factory=list)

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

    @property
    def total_credits(self) -> int:
        """Get total available credits across all non-expired buckets."""
        return get_total_credits(self.credit_buckets)

    def get_aging_credit_buckets(self) -> List[CreditBucket]:
        """
        Get credit buckets sorted by age (oldest first) for consumption.
        """
        return _get_aging_credit_buckets(self.credit_buckets)

    def add_credit_bucket(self, amount: int, credit_type: CreditType, days_until_expiry: int | None = None) -> None:
        """Add a new credit bucket to the user's credit history."""
        _add_credit_bucket(self.credit_buckets, amount, credit_type, days_until_expiry)
        self._ai_credits_computed = None

    def spend_credits(self, required_amount: int, operation: str | None = None) -> tuple[bool, List[dict]]:
        """
        Spend credits from the oldest buckets first. Returns (success, details of what was spent).
        """
        success, details = _spend_credits(self.credit_buckets, required_amount, operation)
        if success:
            self._ai_credits_computed = None
        return success, details


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


# ------------------------- Closet items -------------------------
class RetailMetadata(BaseModel):
    retailer_name: str
    product_url: str
    sku: str | None = None
    list_price_cents: int
    currency: str = "USD"
    availability: Literal["in_stock", "low", "out_of_stock"] = "in_stock"


class ClosetItem(BaseDoc):
    user_id: str
    schemaVersion: int = 1
    source: Source = "Private"
    in_suitcase: bool = False
    # Grouping
    group_id: str | None = None
    group_role: Literal["host", "member"] | None = None
    group_analysis_status: str | None = None  # "pending" | "ready" | "failed"
    # Descriptive
    name: str | None = None  # short, friendly — may differ from title
    title: str
    caption: str | None = None
    # Taxonomy (rich, used by The Eyes)
    category: str
    sub_category: str | None = None
    item_type: str | None = None
    brand: str | None = None
    gender: GarmentGender | None = None
    dress_code: DressCode | None = None
    season: list[str] = Field(default_factory=list)
    tradition: str | None = None  # e.g. "arabic", "jewish"; free-form
    # Structured composition
    size: str | None = None
    color: str | None = None  # keep for backward compat (dominant colour)
    colors: list[WeightedTag] = Field(default_factory=list)
    material: str | None = None
    fabric_materials: list[WeightedTag] = Field(default_factory=list)
    pattern: str | None = None
    # Quality & state
    state: GarmentState | None = None
    condition: GarmentCondition | None = None
    quality: GarmentQuality | None = None
    repair_advice: str | None = None  # populated by The Eyes when condition == bad
    # Pricing & marketplace intent
    price_cents: int | None = None
    currency: str = "USD"
    marketplace_intent: MarketplaceIntent = "own"
    listing_id: str | None = None  # set when auto-listed on save
    # Legacy / compatibility
    formality: Formality | None = None
    cultural_tags: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    # Media + persistence
    original_image_url: str | None = None
    segmented_image_url: str | None = None
    segmentation_model: str | None = None
    # Phase Q — Wardrobe Reconstructor
    reconstructed_image_url: str | None = None
    reconstruction_metadata: dict[str, Any] | None = None
    # Phase O.6 — single-pass Eyes pipeline (background rembg matte).
    # ``clean_image_url`` is populated asynchronously after the item is
    # saved, by a FastAPI BackgroundTask that runs rembg on the raw
    # bytes. It carries the alpha-channelled PNG so the closet grid can
    # render a borderless cutout on the next refresh; until rembg
    # finishes the frontend renders ``original_image_url`` instead.
    # ``clean_image_status`` cycles ``pending``  ``ready``  ``failed``
    # so the UI can show a tiny "polishing photo…" affordance during
    # the few seconds rembg is running. Both fields are nullable so
    # legacy items (and one-pass items that skipped rembg entirely)
    # remain valid documents.
    clean_image_url: str | None = None
    clean_image_status: str | None = None  # "pending" | "ready" | "failed"
    variants: list[dict[str, Any]] = Field(default_factory=list)
    placeholder_data_url: str | None = None
    embedding_id: str | None = None
    # Purchase history
    purchase_price_cents: int | None = None
    purchase_currency: str = "USD"
    purchase_date: str | None = None
    wear_count: int = 0
    last_worn_at: str | None = None
    notes: str | None = None
    retail_metadata: RetailMetadata | None = None
    # Phase V6 — EU Digital Product Passport (DPP) data imported via
    # QR scan. Stored verbatim as a nested document so the UI can render
    # full provenance (materials %, carbon footprint, country of origin,
    # care & repair instructions, certifications, source URL, ...)
    # without polluting the flat taxonomy fields.
    dpp_data: dict[str, Any] | None = None
    # ---- Phase Z2 — duplicate-photo detection ----
    # The Eyes' deterministic pre-flight check uses these three fields
    # (computed in-browser before upload, no LLM cost) to spot the case
    # "user uploaded the same JPEG twice". Only the SHA-256 is used for
    # equality; ``source_filename`` and ``source_size_bytes`` are kept
    # for diagnostics / UI ("we matched IMG_1742.jpg / 4.2 MB"). All
    # three are nullable so legacy items remain valid.
    source_sha256: str | None = None
    source_filename: str | None = None
    source_size_bytes: int | None = None
    # Phase Z2.1 — 64-bit average-hash of the photo (16-char hex).
    # Used by /closet/preflight to catch visual duplicates of legacy
    # items whose ``source_sha256`` was never captured (the original
    # bytes weren't stored). Backfilled lazily from
    # ``thumbnail_data_url`` / ``segmented_image_url`` / etc. on the
    # first /preflight call that touches the row.
    source_phash: str | None = None
    # Phase Z2.2 — 24-byte RGB colour signature (48 hex chars), 4
    # quadrants × 3 channels averaged. Used together with
    # ``source_phash`` so two same-shape garments of different colours
    # (navy vs grey shorts of the same cut) are not mis-flagged as
    # duplicates of each other. Optional + lazily backfilled like
    # ``source_phash``.
    source_color_sig: str | None = None
    # Set to ``True`` when the user explicitly approved adding a photo
    # the pre-flight flagged as a duplicate. The closet UI overlays a
    # red ⭐ on these cards, and the Stylist Brain filters them out of
    # the recommendation pool to prevent doubled-up outfit suggestions.
    is_duplicate: bool = False

    # Phase R (July 2026) — digital receipt import provenance.
    # ``from_receipt=True`` means this item was created from a parsed
    # digital receipt (email / text / PDF). The Gemini analysis pipeline
    # runs on the attached image (if any), but receipt-provided fields
    # listed in ``receipt_locked_fields`` are never overwritten by The
    # Eyes — not during the initial background matte+analyze task, and
    # not on any subsequent ``/reanalyze`` call.
    from_receipt: bool = False
    # Immutable set of field names supplied by the receipt parser.
    # Persisted so ItemDetail's "Analyse" button can honour the rule
    # even after the item is saved (no need to re-derive it from source).
    receipt_locked_fields: list[str] = Field(default_factory=list)

    # --- AI Stylist Scheduler & Rotation (Phase Scheduler) ---
    rejection_count: int = 0
    last_suggested_at: str | None = None


# ----------------- The Eyes: analyzer response payload -----------------
class GarmentAnalysis(BaseModel):
    """Structured output returned by ``POST /api/v1/closet/analyze``.

    Every field is optional so the caller can show an editable form even
    if the model is uncertain. ``model_used`` surfaces which AI provider
    produced the analysis for telemetry.
    """
    name: str | None = None
    title: str | None = None
    caption: str | None = None
    category: str | None = None
    sub_category: str | None = None
    item_type: str | None = None
    brand: str | None = None
    gender: str | None = None
    dress_code: str | None = None
    season: list[str] = Field(default_factory=list)
    tradition: str | None = None
    colors: list[WeightedTag] = Field(default_factory=list)
    fabric_materials: list[WeightedTag] = Field(default_factory=list)
    pattern: str | None = None
    state: str | None = None
    condition: str | None = None
    quality: str | None = None
    size: str | None = None
    price_cents: int | None = None
    repair_advice: str | None = None
    tags: list[str] = Field(default_factory=list)
    image_quality_status: str | None = None
    image_quality_reason: str | None = None
    reconstruction_prompt: str | None = None
    model_used: str | None = None
    raw: dict[str, Any] | None = None


# -------------------------- Listings --------------------------
class FinancialMetadata(BaseModel):
    list_price_cents: int
    currency: str = "USD"
    platform_fee_percent: float = 7.0
    platform_fee_applied_after: Literal["stripe_processing_fee", "gross"] = (
        "stripe_processing_fee"
    )
    stripe_processing_fee_percent: float = 2.9
    stripe_processing_fee_fixed_cents: int = 30
    estimated_seller_net_cents: int


class Listing(BaseDoc):
    closet_item_id: str | None = None
    seller_id: str
    source: ListingSource
    mode: ListingMode = "sell"
    title: str
    description: str | None = None
    category: str
    size: str | None = None
    condition: Condition = "good"
    images: list[str] = Field(default_factory=list)
    location: dict[str, Any] | None = None
    ships_to: list[str] = Field(default_factory=list)
    financial_metadata: FinancialMetadata
    # Optional shipping fee (Wave 3) — charged on top of the listing's
    # mode-specific flow:
    #   * ``sell``    → added to the buyer's PayPal order.
    #   * ``donate``  → recipient pays *only* this on claim; otherwise
    #                   the donation is free end-to-end.
    #   * ``swap``    → display-only for now; parties coordinate directly.
    # Defaults to 0 so every existing row stays valid without migration.
    # DressApp's environmental ethos: we nudge users toward local pickup
    # with "Meet locally to skip the fee 🌱" — sellers are encouraged to
    # keep this at 0 whenever possible.
    shipping_fee_cents: int = 0
    status: ListingStatus = "active"
    views: int = 0
    favorites: int = 0
    # ``auto_created=True`` marks listings created automatically when
    # a closet item is shared. The frontend uses this flag to display
    # a "Complete listing" CTA on the closet card, prompting the
    # user to refine price / mode / description before serious
    # browsing happens.
    auto_created: bool = False


# ------------------------- Transactions -------------------------
class TransactionFinancial(BaseModel):
    gross_cents: int
    stripe_fee_cents: int
    net_after_stripe_cents: int
    platform_fee_percent: float = 7.0
    platform_fee_cents: int
    seller_net_cents: int
    platform_fee_applied_after: Literal["stripe_processing_fee", "gross"] = (
        "stripe_processing_fee"
    )


class StripePointer(BaseModel):
    checkout_session_id: str | None = None
    payment_intent_id: str | None = None
    transfer_id: str | None = None
    destination_account: str | None = None


class PayPalPointer(BaseModel):
    """Persisted on a Transaction once the PayPal flow is initiated."""

    order_id: str | None = None
    capture_id: str | None = None
    payer_id: str | None = None
    payer_email: str | None = None
    status: str | None = None  # COMPLETED, PENDING, DENIED, REFUNDED
    payout_batch_id: str | None = None
    payout_item_id: str | None = None
    payout_status: str | None = None  # SUCCESS, PENDING, FAILED, BLOCKED
    captured_at: str | None = None


# --------- Wave 2: swap + donate sub-pointers on Transaction ---------
class SwapPointer(BaseModel):
    """Nested state for swap-kind transactions.

    The lister keeps the listing; the swapper offers ``offered_item_id``
    from their own closet. Email accept/deny links carry a JWT whose
    ``jti`` is persisted on ``action_token_jti`` to enforce single-use.
    Both parties confirm receipt independently; once both timestamps
    are set the swap is marked completed and ownership flips.
    """

    offered_item_id: str | None = None
    accepted_at: str | None = None
    denied_at: str | None = None
    lister_received_at: str | None = None
    swapper_received_at: str | None = None
    completed_at: str | None = None
    # Single-use accept/deny JWT id (rotated on each new email).
    action_token_jti: str | None = None
    # When True the action token has already been spent; subsequent
    # clicks redirect to the landing page with the recorded status
    # rather than re-applying the decision.
    action_token_used: bool = False


class DonatePointer(BaseModel):
    """Nested state for donate-kind transactions.

    Optional handling fee paid via PayPal — when ``handling_fee_cents``
    is 0 the flow falls back to a JWT-signed accept/deny email exactly
    like swap. ``action_token_jti`` and ``action_token_used`` mirror
    the swap semantics.
    """

    handling_fee_cents: int = 0
    accepted_at: str | None = None
    denied_at: str | None = None
    completed_at: str | None = None
    action_token_jti: str | None = None
    action_token_used: bool = False


class Transaction(BaseDoc):
    listing_id: str
    buyer_id: str
    seller_id: str
    # ``kind`` lets old buy transactions stay untouched (default "buy")
    # while swap + donate transactions opt into their own state machine.
    kind: Literal["buy", "swap", "donate", "rent"] = "buy"
    currency: str = "USD"
    financial: TransactionFinancial
    stripe: StripePointer = Field(default_factory=StripePointer)
    paypal: PayPalPointer = Field(default_factory=PayPalPointer)
    swap: SwapPointer = Field(default_factory=SwapPointer)
    donate: DonatePointer = Field(default_factory=DonatePointer)
    status: TxStatus = "pending"
    paid_at: str | None = None
    refunded_at: str | None = None


# --------------------- Stylist session memory ---------------------
class StylistSession(BaseDoc):
    user_id: str
    active_conversation_id: str | None = None
    memory: dict[str, Any] = Field(default_factory=dict)
    turns: int = 0
    last_active_at: str = Field(default_factory=_now_iso)
    title: str | None = None
    snippet: str | None = None
    archived: bool = False


class StylistMessage(BaseDoc):
    session_id: str
    role: Literal["user", "assistant", "tool"]
    input_modality: Literal[
        "text", "voice", "image", "image+text", "image+voice", "tool_result"
    ]
    transcript: str | None = None
    image_refs: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    assistant_payload: dict[str, Any] | None = None
    tts_audio_ref: str | None = None
    latency_ms: dict[str, int] = Field(default_factory=dict)


# --------------------- Phase U: Ad Campaigns ---------------------
AdCampaignStatus = Literal["draft", "active", "paused", "ended", "disabled"]


class AdCreative(BaseModel):
    headline: str
    body: str | None = None
    image_url: str | None = None
    cta_label: str | None = None
    cta_url: str | None = None


class AdCampaign(BaseDoc):
    owner_id: str
    name: str
    profession: str | None = None  # Stylist, Barber, Fashion designer, etc.
    creative: AdCreative
    # Billing (counters only for MVP — PayPlus not yet wired).
    daily_budget_cents: int = 0
    bid_cents: int = 0  # auction-lite weight
    # Scheduling window (ISO dates).
    start_date: str | None = None
    end_date: str | None = None
    # Regional targeting.
    target_country: str | None = None  # ISO-2 (e.g. IL, US)
    target_region: str | None = None  # region/state name (free-form for MVP)
    status: AdCampaignStatus = "draft"
    # When the serving layer auto-pauses a campaign (e.g. insufficient
    # funds) we surface the reason so the UI can render a helpful banner.
    status_reason: str | None = None
    # Per-currency billing: campaigns draw from the owner's matching
    # `user_credits(user_id, currency)` balance. Default USD for MVP.
    currency: str = "USD"
    # Live counters.
    impressions: int = 0
    clicks: int = 0
    spent_cents: int = 0


# --------------------- Phase 4P: Credits + Payments ---------------------
CreditTopupStatus = Literal["pending", "captured", "failed", "refunded"]


class UserCredits(BaseDoc):
    """Per-(user, currency) prepaid ad credit balance."""

    user_id: str
    currency: str = "USD"
    balance_cents: int = 0


class CreditTopup(BaseDoc):
    user_id: str
    amount_cents: int
    currency: str = "USD"
    status: CreditTopupStatus = "pending"
    paypal_order_id: str | None = None
    paypal_capture_id: str | None = None
    captured_at: str | None = None
    payer_email: str | None = None
    pack: str | None = None  # "10" | "25" | "50" | "custom"


class AiCreditPurchase(BaseDoc):
    user_id: str
    pack: str
    credits_amount: int
    amount_cents: int
    currency: str = "USD"
    status: str = "pending"
    paypal_order_id: str | None = None
    paypal_capture_id: str | None = None
    captured_at: str | None = None
    payer_email: str | None = None


class CreditUsageResponse(BaseModel):
    available_credits: int
    daily_usage: int
    monthly_usage: int
    daily_limit: int
    monthly_limit: int
    can_use: bool
    upgrade_required: bool


# --------------------- DressApp Suitcase ---------------------
class Suitcase(BaseDoc):
    user_id: str
    destinations: str
    purpose: str
    preferred_style: str
    departure_time: str
    return_time: str
    notes: str | None = None
    status: str = "gathering"  # "gathering" | "reviewing" | "active" | "completed"
    outfits: list[dict[str, Any]] = Field(default_factory=list)
    packing_list: list[dict[str, Any]] = Field(default_factory=list)
    missing_notes: str | None = None
    local_fashion_stores: list[dict[str, Any]] = Field(default_factory=list)
    missing_items: list[dict[str, Any]] = Field(default_factory=list)


class SuitcaseArchive(BaseDoc):
    user_id: str
    destination: str
    departure_time: str
    return_time: str
    purpose: str
    preferred_style: str
    notes: str | None = None
    packing_list: list[dict[str, Any]] = Field(default_factory=list)
    outfits: list[dict[str, Any]] = Field(default_factory=list)
    local_fashion_stores: list[dict[str, Any]] = Field(default_factory=list)
    missing_items: list[dict[str, Any]] = Field(default_factory=list)

