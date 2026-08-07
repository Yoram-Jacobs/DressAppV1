"""Experts Campaign Platform — REST API (Experts Campaign Platform).

Endpoints:
  POST   /campaigns/                 — Expert creates campaign (Draft)
  GET    /campaigns/mine             — Expert's own campaigns
  GET    /campaigns/feed             — Public active campaign feed
  GET    /campaigns/{id}             — Single campaign detail
  PATCH  /campaigns/{id}             — Expert edits (Draft only)
  POST   /campaigns/{id}/submit      — Expert submits (Draft → Pending)
  DELETE /campaigns/{id}             — Expert cancels
  POST   /campaigns/{id}/save        — User saves/unsaves campaign
  POST   /campaigns/{id}/share       — User shares (increment counter)
  POST   /campaigns/{id}/report      — User reports campaign
  POST   /campaigns/{id}/view        — Track view impression

Business rules enforced server-side:
  - Only verified Experts (professional.is_professional=True, not hidden) may create.
  - Max 3 active campaigns per Expert.
  - Category must be fashion-related.
  - Campaigns invisible to public until status=active AND admin_approved=True.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.db.database import get_db
from app.services.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["campaigns"])

# ---------------------------------------------------------------------------
# Fashion-category allow-list
# ---------------------------------------------------------------------------
FASHION_CATEGORIES = {
    "boutique", "tailor", "stylist", "designer", "personal shopper",
    "clothing repair", "alterations", "shoe repair", "fashion consultant",
    "accessories", "jewellery", "jewelry", "vintage", "secondhand",
    "consignment", "luxury fashion", "streetwear", "activewear",
    "sustainable fashion", "denim", "knitwear", "leather goods",
    "bridal", "swimwear", "lingerie", "menswear", "womenswear",
    "kidswear", "childrenswear", "hats", "scarves", "bags", "belts"
}


def _is_fashion_category(cat: str) -> bool:
    c = cat.lower().strip()
    return any(allowed in c or c in allowed for allowed in FASHION_CATEGORIES)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip(doc: dict[str, Any]) -> dict[str, Any]:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


def _is_expert(user: dict[str, Any]) -> bool:
    prof = user.get("professional") or {}
    return bool(
        prof.get("is_professional")
        and prof.get("approval_status") != "hidden"
    )


async def _check_paypal_connected(user: dict, db) -> bool:
    """True iff the expert has paypal_receiver_email set OR has any prior captured PayPal credit topup."""
    if user.get("paypal_receiver_email"):
        return True
    # Check for any previously captured PayPal topup (means they've used the PayPal SDK before)
    prior = await db.credit_topups.find_one(
        {"user_id": user["id"], "status": "captured"}, {"_id": 0, "id": 1}
    )
    return prior is not None


def _calc_fee_cents(start_date: str | None, end_date: str | None) -> int:
    """$1.00 USD per day. Minimum 1 day. Returns cents."""
    if not start_date or not end_date:
        return 100  # minimum $1.00 for open-ended
    try:
        from datetime import date
        s = date.fromisoformat(start_date)
        e = date.fromisoformat(end_date)
        days = max(1, (e - s).days)
        return days * 100  # $1.00 per day in cents
    except Exception:
        return 100


async def _get_campaign_or_404(campaign_id: str) -> dict[str, Any]:
    db = get_db()
    doc = await db.experts_campaigns.find_one({"id": campaign_id})
    if not doc:
        raise HTTPException(404, "Campaign not found")
    return _strip(doc)


# ---------------------------------------------------------------------------
# Pydantic input models
# ---------------------------------------------------------------------------

class CampaignLocationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    country: str | None = None
    city: str | None = None
    lat: float | None = None
    lon: float | None = None
    radius_km: float = Field(default=25.0, ge=0.5, le=500.0)


class CampaignAudienceIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    targets: list[str] = Field(default_factory=lambda: ["all"])
    age_min: int | None = Field(default=None, ge=0, le=120)
    age_max: int | None = Field(default=None, ge=0, le=120)
    interests: list[str] = Field(default_factory=list)


class CampaignNotifIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    master_enabled: bool = False
    channels: list[str] = Field(default_factory=list)
    timing: str = "immediately_after_approval"
    custom_datetime: str | None = None


class CampaignCreateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = Field(min_length=1, max_length=120)
    short_description: str = Field(min_length=1, max_length=300)
    long_description: str | None = Field(default=None, max_length=3000)
    category: str = Field(min_length=1, max_length=80)
    business_name: str = Field(min_length=1, max_length=120)
    cover_image_url: str | None = None
    gallery_images: list[str] = Field(default_factory=list)
    discount_pct: int | None = Field(default=None, ge=0, le=100)
    coupon_code: str | None = Field(default=None, max_length=40)
    sale_type: str = "discount"
    limited_time_offer: bool = False
    start_date: str | None = None
    end_date: str | None = None
    location: CampaignLocationIn = Field(default_factory=CampaignLocationIn)
    audience: CampaignAudienceIn = Field(default_factory=CampaignAudienceIn)
    notifications: CampaignNotifIn = Field(default_factory=CampaignNotifIn)


class CampaignPatchIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str | None = Field(default=None, max_length=120)
    short_description: str | None = Field(default=None, max_length=300)
    long_description: str | None = Field(default=None, max_length=3000)
    category: str | None = Field(default=None, max_length=80)
    business_name: str | None = Field(default=None, max_length=120)
    cover_image_url: str | None = None
    gallery_images: list[str] | None = None
    discount_pct: int | None = Field(default=None, ge=0, le=100)
    coupon_code: str | None = Field(default=None, max_length=40)
    sale_type: str | None = None
    limited_time_offer: bool | None = None
    start_date: str | None = None
    end_date: str | None = None
    location: CampaignLocationIn | None = None
    audience: CampaignAudienceIn | None = None
    notifications: CampaignNotifIn | None = None


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class SubmitCaptureIn(BaseModel):
    order_id: str


class ExtendIn(BaseModel):
    new_end_date: str  # ISO date string


class ExtendCaptureIn(BaseModel):
    order_id: str
    new_end_date: str


# ---------------------------------------------------------------------------
# Expert-facing endpoints
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_campaign(
    body: CampaignCreateIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    sub = user.get("subscription") or {}
    is_active = sub.get("is_active", False)
    plan_type = sub.get("plan_type", "free")
    tier = sub.get("tier", "free")
    
    user_tier = "free"
    if is_active and plan_type != "free":
        if tier in ["pro", "manager"]:
            user_tier = "manager"
        elif tier in ["business", "professional"]:
            user_tier = "professional"
            
    if user_tier != "professional":
        raise HTTPException(
            status_code=403,
            detail="Campaigns are only available on the Professional plan. Please upgrade your plan to create campaigns."
        )

    if not _is_expert(user):
        raise HTTPException(403, "Only verified Experts may create campaigns")

    if not _is_fashion_category(body.category):
        raise HTTPException(422, f"Category '{body.category}' is not an approved fashion category")

    db = get_db()
    # Enforce max 3 active campaigns
    active_count = await db.experts_campaigns.count_documents({
        "expert_id": user["id"],
        "status": {"$in": ["active", "approved", "pending_approval"]},
    })
    if active_count >= 3:
        raise HTTPException(422, "Maximum of 3 active/pending campaigns reached")

    prof = user.get("professional") or {}
    biz = prof.get("business") or {}

    now = _now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "expert_id": user["id"],
        "business_name": body.business_name or biz.get("name") or user.get("display_name") or "",
        "title": body.title,
        "short_description": body.short_description,
        "long_description": body.long_description,
        "category": body.category,
        "cover_image_url": body.cover_image_url,
        "gallery_images": body.gallery_images,
        "discount_pct": body.discount_pct,
        "coupon_code": body.coupon_code,
        "sale_type": body.sale_type,
        "limited_time_offer": body.limited_time_offer,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "location": body.location.model_dump(),
        "audience": body.audience.model_dump(),
        "status": "draft",
        "admin_approved": False,
        "rejection_reason": None,
        "submitted_at": None,
        "approved_at": None,
        "approved_by": None,
        "activated_at": None,
        "expired_at": None,
        "notifications": {
            **body.notifications.model_dump(),
            "push_sent": False,
            "email_sent": False,
            "push_sent_at": None,
            "email_sent_at": None,
        },
        "analytics": {"views": 0, "clicks": 0, "push_opens": 0,
                       "saves": 0, "shares": 0, "conversions": 0,
                       "unique_users_reached": 0},
        "saved_by": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.experts_campaigns.insert_one(doc)
    return _strip(doc)


@router.get("/mine")
async def list_my_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    if not _is_expert(user):
        raise HTTPException(403, "Only verified Experts may view their campaigns")
    db = get_db()
    flt = {"expert_id": user["id"]}
    total = await db.experts_campaigns.count_documents(flt)
    cursor = (
        db.experts_campaigns.find(flt, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [_strip(doc) async for doc in cursor]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/feed")
async def campaign_feed(
    country: str | None = Query(None),
    city: str | None = Query(None),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    radius_km: float = Query(50.0, ge=0.5, le=500.0),
    sort: str = Query("newest"),  # newest | nearest | ending_soon | highest_discount
    category: str | None = Query(None),
    ticker: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    db = get_db()
    flt: dict[str, Any] = {"status": "active", "admin_approved": True}
    if category:
        flt["category"] = {"$regex": category, "$options": "i"}
    if country:
        flt["$or"] = [
            {"location.country": {"$regex": f"^{country}$", "$options": "i"}},
        ]
    if city:
        flt.setdefault("$or", []).append(
            {"location.city": {"$regex": city, "$options": "i"}}
        )

    sort_fields: list[tuple[str, int]] = [("created_at", -1)]
    if sort == "ending_soon":
        sort_fields = [("end_date", 1)]
    elif sort == "highest_discount":
        sort_fields = [("discount_pct", -1), ("created_at", -1)]

    total = await db.experts_campaigns.count_documents(flt)
    projection = {"_id": 0} if not ticker else {
        "_id": 0, "id": 1, "title": 1, "business_name": 1,
        "cover_image_url": 1, "discount_pct": 1, "location": 1, "end_date": 1,
    }
    cursor = (
        db.experts_campaigns.find(flt, projection)
        .sort(sort_fields)
        .skip(skip)
        .limit(limit)
    )
    items = [_strip(doc) async for doc in cursor]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    campaign = await _get_campaign_or_404(campaign_id)
    user_id = (user or {}).get("id")

    # Public: only active + approved
    is_owner = user_id and campaign.get("expert_id") == user_id
    is_admin = user_id and "admin" in ((user or {}).get("roles") or [])
    if not is_owner and not is_admin:
        if not (campaign.get("status") == "active" and campaign.get("admin_approved")):
            raise HTTPException(404, "Campaign not found")

    return campaign


@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignPatchIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign["status"] not in ("draft", "rejected"):
        raise HTTPException(422, "Only Draft or Rejected campaigns can be edited")

    updates: dict[str, Any] = {"updated_at": _now_iso()}
    data = body.model_dump(exclude_none=True)
    for k, v in data.items():
        if k == "location" and isinstance(v, dict):
            updates["location"] = v
        elif k == "audience" and isinstance(v, dict):
            updates["audience"] = v
        elif k == "notifications" and isinstance(v, dict):
            # preserve push_sent / email_sent
            existing_notif = campaign.get("notifications") or {}
            updates["notifications"] = {**existing_notif, **v}
        else:
            updates[k] = v

    if "category" in updates and not _is_fashion_category(updates["category"]):
        raise HTTPException(422, f"Category '{updates['category']}' is not an approved fashion category")

    db = get_db()
    await db.experts_campaigns.update_one({"id": campaign_id}, {"$set": updates})
    return _strip(await db.experts_campaigns.find_one({"id": campaign_id}, {"_id": 0}))


@router.post("/{campaign_id}/submit")
async def submit_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign["status"] not in ("draft", "rejected"):
        raise HTTPException(422, "Only Draft or Rejected campaigns can be submitted")

    db = get_db()

    # --- PayPal connection gate ---
    if not await _check_paypal_connected(user, db):
        raise HTTPException(
            402,
            {
                "code": "paypal_not_connected",
                "message": "A PayPal account is required to submit a campaign. "
                           "Please add your PayPal email in Profile → Payment Settings.",
            },
        )

    # --- Fee calculation ---
    fee_cents = _calc_fee_cents(campaign.get("start_date"), campaign.get("end_date"))
    if not campaign.get("end_date"):  # open-ended: charge for 1 day minimum
        fee_cents = 100

    try:
        from datetime import date as _date
        if campaign.get("start_date") and campaign.get("end_date"):
            s = _date.fromisoformat(campaign["start_date"])
            e = _date.fromisoformat(campaign["end_date"])
            total_days = max(1, (e - s).days)
        else:
            total_days = 1
    except Exception:
        total_days = 1

    # --- Create PayPal order (CAPTURE intent — expert completes via SDK) ---
    from app.services import paypal_client
    try:
        order = await paypal_client.create_order(
            amount_cents=fee_cents,
            currency="USD",
            reference_id=f"campaign:{campaign_id}",
            description=f"DressApp Campaign: {campaign.get('title', '')[:60]} ({total_days}d × $1.00)",
            custom_id=campaign_id,
        )
    except paypal_client.PayPalError as exc:
        raise HTTPException(502, {"paypal_error": str(exc.body)}) from exc

    now = _now_iso()

    # Store PayPal order + billing info on campaign (status stays draft until expert captures)
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "billing.paypal_order_id": order["id"],
            "billing.total_days": total_days,
            "billing.total_fee_cents": fee_cents,
            "billing.payment_status": "pending",
            "updated_at": now,
        }},
    )

    return {
        "order_id": order["id"],
        "fee_cents": fee_cents,
        "currency": "USD",
        "total_days": total_days,
        "mock": order.get("mock", False),
    }


@router.post("/{campaign_id}/submit/capture")
async def submit_capture(
    campaign_id: str,
    body: SubmitCaptureIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Called after expert completes the PayPal SDK button. Captures the payment,
    marks campaign as pending_approval, fires admin alert email."""
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign.get("billing", {}).get("paypal_order_id") != body.order_id:
        raise HTTPException(400, "Order ID mismatch")
    if campaign["status"] not in ("draft", "rejected"):
        raise HTTPException(422, "Campaign is not in a submittable state")

    db = get_db()
    from app.services import paypal_client
    try:
        captured = await paypal_client.capture_order(body.order_id)
    except paypal_client.PayPalError as exc:
        await db.experts_campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"billing.payment_status": "failed", "updated_at": _now_iso()}},
        )
        raise HTTPException(502, {"paypal_error": str(exc.body)}) from exc

    capture_id = (
        (captured.get("purchase_units") or [{}])[0]
        .get("payments", {})
        .get("captures", [{}])[0]
        .get("id")
    )
    payer_email = (captured.get("payer") or {}).get("email_address")
    now = _now_iso()

    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "pending_approval",
            "submitted_at": now,
            "rejection_reason": None,
            "billing.paypal_capture_id": capture_id,
            "billing.payer_email": payer_email,
            "billing.paid_at": now,
            "billing.payment_status": "paid",
            "updated_at": now,
        }},
    )

    # Fire admin alert email immediately (fire-and-forget)
    import asyncio
    from app.services.email_service import campaign_submission_alert
    expert_name = user.get("display_name") or user.get("email") or "Expert"
    expert_email = user.get("email") or ""
    fee_cents = campaign.get("billing", {}).get("total_fee_cents", 0)
    updated_campaign = _strip(await db.experts_campaigns.find_one({"id": campaign_id}, {"_id": 0}))
    asyncio.create_task(
        campaign_submission_alert(
            campaign=updated_campaign,
            expert_name=expert_name,
            expert_email=expert_email,
            fee_cents=fee_cents,
        )
    )

    return {"status": "pending_approval", "submitted_at": now, "capture_id": capture_id}


@router.post("/{campaign_id}/extend")
async def extend_campaign(
    campaign_id: str,
    body: ExtendIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a PayPal order for extending the campaign end date.
    Extension is auto-approved (no admin review needed).
    Expert must complete the PayPal SDK flow then call /extend/capture.
    """
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign["status"] not in ("active", "approved", "paused"):
        raise HTTPException(422, "Only Active, Approved, or Paused campaigns can be extended")

    from datetime import date as _date
    try:
        new_end = _date.fromisoformat(body.new_end_date)
        current_end = _date.fromisoformat(campaign["end_date"]) if campaign.get("end_date") else _date.today()
        extra_days = max(1, (new_end - current_end).days)
        if extra_days < 1:
            raise HTTPException(422, "New end date must be after the current end date")
    except ValueError:
        raise HTTPException(422, "Invalid date format. Use YYYY-MM-DD")

    extra_fee_cents = extra_days * 100  # $1.00 per day

    db = get_db()
    from app.services import paypal_client
    try:
        order = await paypal_client.create_order(
            amount_cents=extra_fee_cents,
            currency="USD",
            reference_id=f"campaign_ext:{campaign_id}",
            description=f"DressApp Campaign Extension: {campaign.get('title', '')[:50]} (+{extra_days}d × $1.00)",
            custom_id=f"{campaign_id}:ext:{body.new_end_date}",
        )
    except paypal_client.PayPalError as exc:
        raise HTTPException(502, {"paypal_error": str(exc.body)}) from exc

    # Store pending extension info
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "_pending_extension": {
                "new_end_date": body.new_end_date,
                "extra_days": extra_days,
                "extra_fee_cents": extra_fee_cents,
                "paypal_order_id": order["id"],
            },
            "updated_at": _now_iso(),
        }},
    )

    return {
        "order_id": order["id"],
        "extra_days": extra_days,
        "extra_fee_cents": extra_fee_cents,
        "currency": "USD",
        "new_end_date": body.new_end_date,
        "mock": order.get("mock", False),
    }


@router.post("/{campaign_id}/extend/capture")
async def extend_capture(
    campaign_id: str,
    body: ExtendCaptureIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Capture the extension PayPal payment, then update end_date.
    Extension is auto-approved — no admin review required."""
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")

    pending = campaign.get("_pending_extension") or {}
    if pending.get("paypal_order_id") != body.order_id:
        raise HTTPException(400, "Order ID mismatch — call /extend first")

    db = get_db()
    from app.services import paypal_client
    try:
        captured = await paypal_client.capture_order(body.order_id)
    except paypal_client.PayPalError as exc:
        raise HTTPException(502, {"paypal_error": str(exc.body)}) from exc

    capture_id = (
        (captured.get("purchase_units") or [{}])[0]
        .get("payments", {})
        .get("captures", [{}])[0]
        .get("id")
    )
    now = _now_iso()
    extra_days = pending.get("extra_days", 1)
    extra_fee = pending.get("extra_fee_cents", 100)

    extension_record = {
        "new_end_date": body.new_end_date,
        "extra_days": extra_days,
        "extra_fee_cents": extra_fee,
        "paypal_order_id": body.order_id,
        "paypal_capture_id": capture_id,
        "captured_at": now,
    }

    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {
            "$set": {
                "end_date": body.new_end_date,
                "_pending_extension": None,
                "updated_at": now,
            },
            "$inc": {
                "billing.total_days": extra_days,
                "billing.total_fee_cents": extra_fee,
            },
            "$push": {"billing.extension_history": extension_record},
        },
    )

    return {
        "ok": True,
        "new_end_date": body.new_end_date,
        "extra_days": extra_days,
        "capture_id": capture_id,
    }


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Pause an active campaign. Paused campaigns are hidden from the feed.
    Paused days do not count against the paid campaign duration;
    end_date is extended by paused duration when resumed.
    """
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign["status"] != "active":
        raise HTTPException(422, "Only Active campaigns can be paused")

    now = _now_iso()
    db = get_db()
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "paused",
            "paused_at": now,
            "updated_at": now,
        }},
    )
    return {"status": "paused", "paused_at": now}


@router.post("/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Resume a paused campaign. Extends end_date by the number of paused days
    so the expert gets their full paid duration.
    """
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign["status"] != "paused":
        raise HTTPException(422, "Only Paused campaigns can be resumed")

    now = _now_iso()
    db = get_db()

    # Calculate paused duration and extend end_date to compensate
    paused_at_str = campaign.get("paused_at")
    paused_days = 0
    new_end_date = campaign.get("end_date")
    if paused_at_str and new_end_date:
        try:
            from datetime import datetime, date, timezone
            paused_at_dt = datetime.fromisoformat(paused_at_str.replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            paused_days = max(0, (now_dt - paused_at_dt).days)
            if paused_days > 0:
                end_dt = date.fromisoformat(new_end_date)
                from datetime import timedelta
                new_end_date = (end_dt + timedelta(days=paused_days)).isoformat()
        except Exception:
            pass

    pause_record = {
        "paused_at": paused_at_str,
        "resumed_at": now,
        "days": paused_days,
    }

    updates: dict = {
        "status": "active",
        "paused_at": None,
        "updated_at": now,
    }
    if new_end_date and new_end_date != campaign.get("end_date"):
        updates["end_date"] = new_end_date

    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {
            "$set": updates,
            "$inc": {"billing.total_paused_days": paused_days},
            "$push": {"billing.paused_periods": pause_record},
        },
    )
    return {"status": "active", "resumed_at": now, "end_date": new_end_date, "paused_days": paused_days}


@router.delete("/{campaign_id}")
async def cancel_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    campaign = await _get_campaign_or_404(campaign_id)
    if campaign["expert_id"] != user["id"]:
        raise HTTPException(403, "Not the campaign owner")
    if campaign["status"] in ("expired", "cancelled"):
        raise HTTPException(422, "Campaign is already ended")

    db = get_db()

    # Best-effort void pending PayPal order if campaign was never charged
    billing = campaign.get("billing") or {}
    order_id = billing.get("paypal_order_id")
    if order_id and billing.get("payment_status") == "pending":
        try:
            from app.services import paypal_client
            # PayPal orders expire naturally — no explicit void API; just log
            logger.info("Campaign cancelled with pending PayPal order: %s → %s", campaign_id, order_id)
        except Exception:
            pass

    billing_update = {}
    if (campaign.get("billing") or {}).get("payment_status") == "pending":
        billing_update["billing.payment_status"] = "voided"

    update_fields = {"status": "cancelled", "updated_at": _now_iso()}
    update_fields.update(billing_update)
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": update_fields},
    )
    return {"status": "cancelled"}


@router.post("/{campaign_id}/save")
async def save_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    campaign = await _get_campaign_or_404(campaign_id)
    if not (campaign.get("status") == "active" and campaign.get("admin_approved")):
        raise HTTPException(404, "Campaign not found")
    db = get_db()
    user_id = user["id"]
    saved_by = campaign.get("saved_by") or []
    now = _now_iso()
    if user_id in saved_by:
        await db.experts_campaigns.update_one(
            {"id": campaign_id},
            {"$pull": {"saved_by": user_id}, "$inc": {"analytics.saves": -1},
             "$set": {"updated_at": now}},
        )
        return {"saved": False}
    else:
        await db.experts_campaigns.update_one(
            {"id": campaign_id},
            {"$addToSet": {"saved_by": user_id}, "$inc": {"analytics.saves": 1},
             "$set": {"updated_at": now}},
        )
        return {"saved": True}


@router.post("/{campaign_id}/share")
async def share_campaign(
    campaign_id: str,
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    db = get_db()
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$inc": {"analytics.shares": 1}, "$set": {"updated_at": _now_iso()}},
    )
    return {"ok": True}


@router.post("/{campaign_id}/view")
async def track_view(
    campaign_id: str,
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    db = get_db()
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$inc": {"analytics.views": 1}, "$set": {"updated_at": _now_iso()}},
    )
    return {"ok": True}


@router.post("/{campaign_id}/report")
async def report_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    # Log to admin_reports collection (best-effort)
    db = get_db()
    await db.admin_reports.insert_one({
        "id": str(uuid.uuid4()),
        "type": "campaign",
        "target_id": campaign_id,
        "reported_by": user["id"],
        "created_at": _now_iso(),
    })
    return {"reported": True}
