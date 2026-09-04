"""/api/v1/trends \u2014 read + admin trigger endpoints for the Trend-Scout."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Header

from app.db.database import get_db
from app.services.auth import get_current_user, get_current_user_optional, require_admin
from app.services.trend_scout import (
    BUCKETS,
    fashion_scout_feed,
    latest_trend_cards,
    rank_cards_for_user,
    run_trend_scout,
    _country_codes,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trends", tags=["trends"])


def check_trend_scout_access(user: dict) -> None:
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
            
    if user_tier == "free":
        raise HTTPException(
            status_code=403,
            detail="Trend Scout is only available on Manager or Professional tiers. Please upgrade your plan."
        )


@router.get("/latest")
async def get_latest_trends(
    per_bucket: int = Query(default=1, ge=1, le=5),
    gender: str | None = Query(default=None, regex="^(male|female)$"),
    country: str | None = Query(default=None, max_length=4),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Public-safe read: newest card(s) per bucket for the user's gender ecosystem."""
    check_trend_scout_access(user)
    if not country:
        user_countries = _country_codes(user)
        if user_countries:
            country = next(iter(user_countries))
    if not gender:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        gender = "male" if user_sex == "male" else "female"
    cards = await latest_trend_cards(limit_per_bucket=per_bucket, country=country, gender=gender)
    return {"cards": cards, "count": len(cards), "gender": gender, "country": country}


@router.get("/last_refresh")
async def get_last_refresh() -> dict[str, Any]:
    """Diagnostics endpoint — when did each bucket last refresh?"""
    db = get_db()
    out_buckets: dict[str, str | None] = {}
    newest_iso: str | None = None
    for bucket in BUCKETS:
        latest = await db.trend_reports.find_one(
            {"bucket": bucket["slug"], "language": {"$in": [None, "en"]}},
            sort=[("created_at", -1)],
            projection={"_id": 0, "created_at": 1, "date": 1},
        )
        ts = (latest or {}).get("created_at")
        out_buckets[bucket["slug"]] = ts
        if ts and (newest_iso is None or ts > newest_iso):
            newest_iso = ts

    stale_for_seconds: int | None = None
    if newest_iso:
        try:
            newest = datetime.fromisoformat(newest_iso.replace("Z", "+00:00"))
            if newest.tzinfo is None:
                newest = newest.replace(tzinfo=timezone.utc)
            stale_for_seconds = int(
                (datetime.now(timezone.utc) - newest).total_seconds()
            )
        except (TypeError, ValueError):
            stale_for_seconds = None
    return {
        "newest_created_at": newest_iso,
        "stale_for_seconds": stale_for_seconds,
        "buckets": out_buckets,
    }


@router.get("/fashion-scout")
async def get_fashion_scout_feed(
    limit: int = Query(default=12, ge=1, le=50),
    language: str | None = Query(default=None, max_length=8),
    country: str | None = Query(default=None, max_length=4),
    gender: str | None = Query(default=None, regex="^(male|female)$"),
    personalized: bool = Query(default=True),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Newest-first flat feed for the Stylist right-panel and Trend Scout radar.

    Returns cards matching the user's gender ecosystem and device country location.
    """
    check_trend_scout_access(user)
    if not gender and user:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        gender = "male" if user_sex == "male" else "female"
    try:
        cards = await fashion_scout_feed(
            limit=limit,
            language=language,
            country=country,
            gender=gender,
            user=user if personalized else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "fashion_scout endpoint failed (limit=%s language=%s country=%s gender=%s personalized=%s): %s",
            limit,
            language,
            country,
            gender,
            personalized,
            exc,
        )
        cards = []
    return {
        "cards": cards,
        "count": len(cards),
        "language": language or "en",
        "gender": gender or "female",
        "personalized": bool(user and personalized),
    }


@router.post("/run-now")
async def run_trend_scout_now(
    force: bool = Query(default=False),
    country: str | None = Query(default=None, max_length=4),
    gender: str | None = Query(default=None, regex="^(male|female)$"),
    x_device_type: str | None = Header(default=None),
    user: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Admin-only trigger for an immediate Trend-Scout run (for testing)."""
    client_type = "mobile" if x_device_type == "mobile" else "desktop"
    res = await run_trend_scout(force=force, client_type=client_type, user=user, country_code=country, gender=gender)
    try:
        if user and user.get("id"):
            from app.services.sync_service import broadcast_sync_event
            await broadcast_sync_event(user["id"], "trend_scout_updated", {"action": "refresh", "gender": gender, "country": country})
    except Exception as exc:
        logger.warning("Failed to broadcast trend_scout_updated: %s", exc)
    return res


@router.post("/run-now-dev")
async def run_trend_scout_now_dev(
    force: bool = Query(default=True),
    country: str | None = Query(default=None, max_length=4),
    gender: str | None = Query(default=None, regex="^(male|female)$"),
    x_device_type: str | None = Header(default=None),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Dev helper: any authenticated user can trigger a run while we don't
    yet have a dedicated admin UI.
    """
    if not user:
        raise HTTPException(401, "auth required")
    client_type = "mobile" if x_device_type == "mobile" else "desktop"
    res = await run_trend_scout(force=force, client_type=client_type, user=user, country_code=country, gender=gender)
    try:
        if user and user.get("id"):
            from app.services.sync_service import broadcast_sync_event
            await broadcast_sync_event(user["id"], "trend_scout_updated", {"action": "refresh", "gender": gender, "country": country})
    except Exception as exc:
        logger.warning("Failed to broadcast trend_scout_updated: %s", exc)
    return res
