"""Ad Campaigns (Phase U).

Facebook-inspired one-level ads:
- professionals own `ad_campaigns`
- auction-lite ticker selects region-matched, active, in-budget campaigns
  weighted by `bid_cents` * pacing factor
- tracking counters for impressions/clicks/spent (no real billing yet — the
  PayPlus wiring is deferred)
"""
from __future__ import annotations

from collections import deque
import hashlib
import logging
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import jwt
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from app.config import settings
from app.db.database import get_db
from app.models.schemas import AdCampaign, AdCreative
from app.services.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/promotions", tags=["promotions"])

_AD_TOKEN_TTL_SECONDS = 900
_AD_EVENT_WINDOW_SECONDS = 60
_AD_MAX_EVENTS_PER_WINDOW = 30
_CONSUMED_TOKENS_MAX = 10000
_consumed_ad_events: dict[str, float] = {}
_ad_rate_buckets: dict[str, deque[float]] = {}


class AdTrackIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    token: str | None = None


def _viewer_key(request: Request, user: dict[str, Any] | None) -> str:
    if user and user.get("id"):
        return f"u:{user['id']}"
    forwarded = request.headers.get("x-forwarded-for") or ""
    raw_ip = forwarded.split(",")[0].strip() if forwarded else ""
    if not raw_ip and request.client:
        raw_ip = request.client.host or ""
    digest = hashlib.sha256(f"{raw_ip or 'anon'}:{settings.JWT_SECRET}".encode("utf-8")).hexdigest()[:20]
    return f"ip:{digest}"


def _mint_ad_token(campaign_id: str, viewer_key: str) -> str:
    now = int(time.time())
    payload = {
        "purpose": "ad_track",
        "cid": campaign_id,
        "vk": viewer_key,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + _AD_TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _check_ad_rate_limit(viewer_key: str) -> bool:
    now = time.time()
    q = _ad_rate_buckets.get(viewer_key)
    if q is None:
        q = deque()
        _ad_rate_buckets[viewer_key] = q
    cutoff = now - _AD_EVENT_WINDOW_SECONDS
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= _AD_MAX_EVENTS_PER_WINDOW:
        return False
    q.append(now)
    if len(_ad_rate_buckets) > 5000:
        stale = [k for k, dq in _ad_rate_buckets.items() if not dq or dq[-1] < cutoff]
        for k in stale:
            _ad_rate_buckets.pop(k, None)
    return True


async def _consume_ad_token(
    db: Any,
    *,
    token: str | None,
    campaign_id: str,
    event_kind: str,
    viewer_key: str,
) -> dict[str, Any]:
    if not token or not isinstance(token, str):
        raise HTTPException(403, "Valid ad tracking token is required")
    try:
        claims = jwt.decode(token.strip(), settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(403, "Ad tracking token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(403, "Invalid ad tracking token") from exc

    if claims.get("purpose") != "ad_track" or claims.get("cid") != campaign_id:
        raise HTTPException(403, "Ad tracking token mismatch")
    if claims.get("vk") and claims.get("vk") != viewer_key:
        raise HTTPException(403, "Ad tracking token viewer mismatch")

    jti = claims.get("jti")
    if not jti:
        raise HTTPException(403, "Malformed ad tracking token")

    now = time.time()
    event_key = f"{jti}:{event_kind}"
    expired = [k for k, exp in _consumed_ad_events.items() if exp <= now]
    for k in expired:
        _consumed_ad_events.pop(k, None)
    if event_key in _consumed_ad_events:
        return {"ok": False, "reason": "duplicate"}

    # Atomic single-use marker in MongoDB across workers
    try:
        res = await db.ad_tracking_events.update_one(
            {"key": event_key},
            {
                "$setOnInsert": {
                    "key": event_key,
                    "campaign_id": campaign_id,
                    "event_kind": event_kind,
                    "created_at_dt": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        if getattr(res, "upserted_id", None) is None and getattr(res, "matched_count", 0) > 0:
            return {"ok": False, "reason": "duplicate"}
    except Exception:
        # Mock DB fallback stays protected by the bounded in-memory set
        pass

    if len(_consumed_ad_events) >= _CONSUMED_TOKENS_MAX:
        for k in list(_consumed_ad_events.keys())[: _CONSUMED_TOKENS_MAX // 2]:
            _consumed_ad_events.pop(k, None)
    _consumed_ad_events[event_key] = float(claims.get("exp") or (now + _AD_TOKEN_TTL_SECONDS))
    return {"ok": True}


# ----------------------------- models -----------------------------
class AdCreativeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    headline: str = Field(min_length=1, max_length=120)
    body: str | None = Field(default=None, max_length=280)
    image_url: str | None = None
    cta_label: str | None = Field(default=None, max_length=40)
    cta_url: str | None = None


class CampaignCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    profession: str | None = None
    creative: AdCreativeIn
    daily_budget_cents: int = Field(default=0, ge=0)
    bid_cents: int = Field(default=0, ge=0)
    start_date: str | None = None
    end_date: str | None = None
    target_country: str | None = None
    target_region: str | None = None
    currency: str = "USD"
    status: str = "draft"


class CampaignPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    profession: str | None = None
    creative: AdCreativeIn | None = None
    daily_budget_cents: int | None = Field(default=None, ge=0)
    bid_cents: int | None = Field(default=None, ge=0)
    start_date: str | None = None
    end_date: str | None = None
    target_country: str | None = None
    target_region: str | None = None
    currency: str | None = None
    status: str | None = None


# ----------------------------- helpers -----------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_iso_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _strip_doc(doc: dict[str, Any]) -> dict[str, Any]:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ----------------------------- CRUD -----------------------------
@router.post("/campaigns")
async def create_campaign(
    payload: CampaignCreateIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    prof = (user.get("professional") or {})
    if not prof.get("is_professional"):
        raise HTTPException(403, "Only professionals can create ad campaigns")
    db = get_db()
    campaign = AdCampaign(
        owner_id=user["id"],
        name=payload.name,
        profession=payload.profession or prof.get("profession"),
        creative=AdCreative(**payload.creative.model_dump()),
        daily_budget_cents=payload.daily_budget_cents,
        bid_cents=payload.bid_cents,
        start_date=payload.start_date,
        end_date=payload.end_date,
        target_country=payload.target_country,
        target_region=payload.target_region,
        currency=(payload.currency or "USD").upper(),
        status=payload.status if payload.status in {"draft", "active", "paused"} else "draft",
    )
    doc = campaign.model_dump()
    await db.ad_campaigns.insert_one(doc)
    return _strip_doc(doc)


@router.get("/campaigns")
async def list_my_campaigns(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_db()
    cursor = (
        db.ad_campaigns.find({"owner_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(200)
    )
    items = [doc async for doc in cursor]
    return {"items": items, "total": len(items)}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    doc = await db.ad_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Campaign not found")
    if doc["owner_id"] != user["id"] and "admin" not in (user.get("roles") or []):
        raise HTTPException(403, "Not allowed")
    return doc


@router.patch("/campaigns/{campaign_id}")
async def patch_campaign(
    campaign_id: str,
    payload: CampaignPatchIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    existing = await db.ad_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["owner_id"] != user["id"]:
        raise HTTPException(403, "Not allowed")
    patch = payload.model_dump(exclude_none=True)
    # Only permit owners to transition to these states (admin uses /admin/ads/...).
    if "status" in patch and patch["status"] not in {"draft", "active", "paused", "ended"}:
        patch.pop("status")
    if "creative" in patch:
        patch["creative"] = AdCreative(**patch["creative"]).model_dump()
    patch["updated_at"] = _now_iso()
    await db.ad_campaigns.update_one({"id": campaign_id}, {"$set": patch})
    doc = await db.ad_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return doc or {}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    existing = await db.ad_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["owner_id"] != user["id"]:
        raise HTTPException(403, "Not allowed")
    await db.ad_campaigns.delete_one({"id": campaign_id})
    return {"status": "ok", "id": campaign_id}


# ----------------------------- ticker (public) -----------------------------
def _eligible_filter(country: str | None, region: str | None) -> dict[str, Any]:
    today = _today_iso_date()
    flt: dict[str, Any] = {
        "status": "active",
        "$and": [
            {
                "$or": [
                    {"start_date": {"$exists": False}},
                    {"start_date": None},
                    {"start_date": {"$lte": today}},
                ]
            },
            {
                "$or": [
                    {"end_date": {"$exists": False}},
                    {"end_date": None},
                    {"end_date": {"$gte": today}},
                ]
            },
        ],
    }
    if country:
        flt["$and"].append(
            {
                "$or": [
                    {"target_country": None},
                    {"target_country": {"$exists": False}},
                    {"target_country": {"$regex": f"^{country}$", "$options": "i"}},
                ]
            }
        )
    if region:
        flt["$and"].append(
            {
                "$or": [
                    {"target_region": None},
                    {"target_region": {"$exists": False}},
                    {"target_region": {"$regex": region, "$options": "i"}},
                ]
            }
        )
    return flt


@router.get("/ticker")
async def ticker(
    request: Request,
    country: str | None = Query(None),
    region: str | None = Query(None),
    limit: int = Query(5, ge=1, le=20),
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Return region-matched ads using bid-weighted random selection.

    MVP selection strategy: eligible campaigns are weighted by
    `max(bid_cents, 1) * max(1, daily_budget_cents - spent_today)`. We then
    sample without replacement up to `limit` items. Keeps higher-bidders and
    budget-healthy campaigns at the top.
    """
    db = get_db()
    flt = _eligible_filter(country, region)
    candidates = [doc async for doc in db.ad_campaigns.find(flt, {"_id": 0}).limit(200)]
    if not candidates:
        return {"items": [], "country": country, "region": region}

    def weight(c: dict[str, Any]) -> float:
        bid = max(1, int(c.get("bid_cents") or 0))
        # crude pacing: if over daily_budget, halve weight but don't zero out
        spent = int(c.get("spent_cents") or 0)
        budget = int(c.get("daily_budget_cents") or 0)
        pacing = 1.0
        if budget > 0 and spent >= budget:
            pacing = 0.25
        return bid * pacing

    weights = [weight(c) for c in candidates]
    # bias-weighted sampling without replacement
    chosen: list[dict[str, Any]] = []
    pool = list(zip(candidates, weights))
    k = min(limit, len(pool))
    for _ in range(k):
        total = sum(w for _, w in pool) or 1.0
        r = random.random() * total
        acc = 0.0
        pick_idx = 0
        for i, (_c, w) in enumerate(pool):
            acc += w
            if acc >= r:
                pick_idx = i
                break
        chosen.append(pool[pick_idx][0])
        pool.pop(pick_idx)

    # Public view for ticker — include single-use signed tracking tokens
    viewer_key = _viewer_key(request, user)
    items = []
    for c in chosen:
        items.append(
            {
                "id": c["id"],
                "owner_id": c["owner_id"],
                "profession": c.get("profession"),
                "creative": c.get("creative") or {},
                "target_country": c.get("target_country"),
                "target_region": c.get("target_region"),
                "tracking_token": _mint_ad_token(c["id"], viewer_key),
            }
        )
    return {"items": items, "country": country, "region": region}


# ----------------------------- tracking -----------------------------
async def _charge_owner_or_pause(
    db, campaign: dict[str, Any], amount_cents: int
) -> bool:
    """Atomically deduct `amount_cents` from campaign owner's credit
    balance for the campaign currency. If insufficient funds, auto-pause
    the campaign. Returns True if charge succeeded."""
    owner_id = campaign["owner_id"]
    currency = (campaign.get("currency") or "USD").upper()
    res = await db.user_credits.update_one(
        {
            "user_id": owner_id,
            "currency": currency,
            "balance_cents": {"$gte": amount_cents},
        },
        {"$inc": {"balance_cents": -amount_cents}, "$set": {"updated_at": _now_iso()}},
    )
    if res.modified_count:
        return True
    # Not enough funds → auto-pause.
    await db.ad_campaigns.update_one(
        {"id": campaign["id"], "status": "active"},
        {
            "$set": {
                "status": "paused",
                "status_reason": "insufficient_funds",
                "updated_at": _now_iso(),
            }
        },
    )
    return False


async def _track_ad_event(
    *,
    request: Request,
    campaign_id: str,
    event_kind: str,
    amount_cents: int,
    counter_field: str,
    payload: AdTrackIn | None,
    token_q: str | None,
    token_h: str | None,
    user: dict | None,
) -> dict[str, Any]:
    db = get_db()
    viewer_key = _viewer_key(request, user)
    if not _check_ad_rate_limit(viewer_key):
        raise HTTPException(429, "Ad tracking rate limit exceeded")

    supplied_token = (payload.token if payload else None) or token_q or token_h
    token_check = await _consume_ad_token(
        db,
        token=supplied_token,
        campaign_id=campaign_id,
        event_kind=event_kind,
        viewer_key=viewer_key,
    )
    if not token_check.get("ok"):
        return token_check

    campaign = await db.ad_campaigns.find_one(
        {"id": campaign_id, "status": "active"}, {"_id": 0}
    )
    if not campaign:
        return {"ok": False, "reason": "not_active"}
    if user and user.get("id") == campaign.get("owner_id"):
        return {"ok": False, "reason": "owner_self_view"}

    charged = await _charge_owner_or_pause(db, campaign, amount_cents)
    if not charged:
        return {"ok": False, "reason": "insufficient_funds"}
    await db.ad_campaigns.update_one(
        {"id": campaign_id},
        {
            "$inc": {counter_field: 1, "spent_cents": amount_cents},
            "$set": {"updated_at": _now_iso()},
        },
    )
    return {"ok": True}


@router.post("/impression/{campaign_id}")
async def track_impression(
    campaign_id: str,
    request: Request,
    payload: AdTrackIn | None = Body(default=None),
    token: str | None = Query(default=None),
    x_ad_token: str | None = Header(default=None),
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    return await _track_ad_event(
        request=request,
        campaign_id=campaign_id,
        event_kind="imp",
        amount_cents=1,
        counter_field="impressions",
        payload=payload,
        token_q=token,
        token_h=x_ad_token,
        user=user,
    )


@router.post("/click/{campaign_id}")
async def track_click(
    campaign_id: str,
    request: Request,
    payload: AdTrackIn | None = Body(default=None),
    token: str | None = Query(default=None),
    x_ad_token: str | None = Header(default=None),
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    return await _track_ad_event(
        request=request,
        campaign_id=campaign_id,
        event_kind="click",
        amount_cents=5,
        counter_field="clicks",
        payload=payload,
        token_q=token,
        token_h=x_ad_token,
        user=user,
    )
