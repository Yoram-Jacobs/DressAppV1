"""/api/v1/trends \u2014 read + admin trigger endpoints for the Trend-Scout."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Response
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.services.auth import get_current_user, get_current_user_optional, require_admin
from app.services.trend_scout import (
    BUCKETS,
    fashion_scout_feed,
    latest_trend_cards,
    rank_cards_for_user,
    run_trend_scout,
    _country_codes,
    get_user_trend_scout_settings,
    save_user_trend_scout_settings,
    connect_user_social_platform,
    disconnect_user_social_platform,
    analyze_user_closet_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trends", tags=["trends"])


class TrendScoutSettingsPayload(BaseModel):
    custom_style: str | None = None
    social_platforms: list[dict[str, Any]] | None = None


class SocialConnectPayload(BaseModel):
    platform_id: str
    username: str | None = None


class SocialDisconnectPayload(BaseModel):
    platform_id: str


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
    country: str | None = Query(default=None, max_length=64),
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
    country: str | None = Query(default=None, max_length=64),
    gender: str | None = Query(default=None, regex="^(male|female)$"),
    x_device_type: str | None = Header(default=None),
    user: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Admin-only trigger for an immediate Trend-Scout run (for testing)."""
    client_type = "mobile" if x_device_type == "mobile" else "desktop"
    if not gender and user:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        gender = "male" if user_sex == "male" else "female"
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
    country: str | None = Query(default=None, max_length=64),
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
    if not gender:
        user_sex = (user.get("sex") or user.get("gender") or "female").lower()
        gender = "male" if user_sex == "male" else "female"
    res = await run_trend_scout(force=force, client_type=client_type, user=user, country_code=country, gender=gender)
    try:
        if user and user.get("id"):
            from app.services.sync_service import broadcast_sync_event
            await broadcast_sync_event(user["id"], "trend_scout_updated", {"action": "refresh", "gender": gender, "country": country})
    except Exception as exc:
        logger.warning("Failed to broadcast trend_scout_updated: %s", exc)
    return res


@router.get("/settings")
async def get_trend_scout_settings_endpoint(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve user Trend Scout personalization settings, social platforms, and closet analysis."""
    check_trend_scout_access(user)
    user_id = str(user.get("id") or user.get("_id"))
    settings = await get_user_trend_scout_settings(user_id, user=user)
    closet_profile = await analyze_user_closet_profile(user_id, user=user)
    return {
        "success": True,
        "settings": settings,
        "closet_profile": closet_profile,
    }


@router.put("/settings")
async def update_trend_scout_settings_endpoint(
    payload: TrendScoutSettingsPayload,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Save user Trend Scout personalization preferences (custom style override and social platforms)."""
    check_trend_scout_access(user)
    user_id = str(user.get("id") or user.get("_id"))
    data = payload.dict(exclude_unset=True)
    saved = await save_user_trend_scout_settings(user_id, data)
    closet_profile = await analyze_user_closet_profile(user_id, user=user)
    return {
        "success": True,
        "settings": saved,
        "closet_profile": closet_profile,
    }


@router.post("/settings/social/connect")
async def connect_social_account_endpoint(
    payload: SocialConnectPayload,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Connect a social media platform account for Trend Scout."""
    check_trend_scout_access(user)
    user_id = str(user.get("id") or user.get("_id"))
    saved = await connect_user_social_platform(user_id, payload.platform_id, payload.username)
    return {
        "success": True,
        "settings": saved,
    }


@router.post("/settings/social/disconnect")
async def disconnect_social_account_endpoint(
    payload: SocialDisconnectPayload,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Disconnect a social media platform account for Trend Scout."""
    check_trend_scout_access(user)
    user_id = str(user.get("id") or user.get("_id"))
    saved = await disconnect_user_social_platform(user_id, payload.platform_id)
    return {
        "success": True,
        "settings": saved,
    }


@router.get("/image-proxy")
async def proxy_trend_image(url: str = Query(..., description="Target image URL to proxy")) -> Response:
    """Proxy external trend article images to bypass CDN anti-hotlinking referer checks."""
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid image URL scheme")

    # SSRF protection: block private IP ranges and localhost
    lowered = url.lower()
    blocked_hosts = ("localhost", "127.0.0.1", "0.0.0.0", "10.", "192.168.", "169.254.")
    if any(h in lowered for h in blocked_hosts):
        raise HTTPException(status_code=400, detail="Disallowed target host")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/avif,image/jpeg,image/png,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Remote image fetch failed")
            content_type = resp.headers.get("content-type", "image/jpeg")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400, s-maxage=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {exc}")


