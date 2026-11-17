"""/api/v1/trends \u2014 read + admin trigger endpoints for the Trend-Scout."""
from __future__ import annotations

from collections import deque
import hashlib
import hmac
import io
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_db
from app.services.auth import (
    decode_token,
    get_current_user,
    get_current_user_optional,
    require_admin,
)
from app.services.trend_scout import (
    BUCKETS,
    fashion_scout_feed,
    latest_trend_cards,
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
    from app.services.auth import user_has_custom_api_key, is_tester_user

    if is_tester_user(user):
        return

    if not user_has_custom_api_key(user):
        raise HTTPException(
            status_code=403,
            detail="Trend Scout is available exclusively for users with their own custom AI supplier API key. Please configure your API key in Profile -> AI Configuration.",
        )

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
    gender: str | None = Query(default=None, pattern="^(male|female)$"),
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
    gender: str | None = Query(default=None, pattern="^(male|female)$"),
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
    gender: str | None = Query(default=None, pattern="^(male|female)$"),
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
    gender: str | None = Query(default=None, pattern="^(male|female)$"),
    x_device_type: str | None = Header(default=None),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Dev helper: any authenticated user can trigger a run while we don't
    yet have a dedicated admin UI.
    """
    if not user:
        raise HTTPException(401, "auth required")
    check_trend_scout_access(user)
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


_PROXY_RATE_WINDOW_S = 60
_PROXY_MAX_REQUESTS_PER_WINDOW = 60
_proxy_rate_buckets: dict[str, deque[float]] = {}
_ALLOWED_RASTER_CONTENT_TYPES = frozenset({
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
})
_ALLOWED_PIL_FORMATS = frozenset({"JPEG", "PNG", "WEBP", "GIF", "AVIF"})


def _check_proxy_rate_limit(client_key: str) -> bool:
    now = time.time()
    q = _proxy_rate_buckets.get(client_key)
    if q is None:
        q = deque()
        _proxy_rate_buckets[client_key] = q
    cutoff = now - _PROXY_RATE_WINDOW_S
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= _PROXY_MAX_REQUESTS_PER_WINDOW:
        return False
    q.append(now)
    if len(_proxy_rate_buckets) > 5000:
        stale = [k for k, dq in _proxy_rate_buckets.items() if not dq or dq[-1] < cutoff]
        for k in stale:
            _proxy_rate_buckets.pop(k, None)
    return True


def _proxy_client_key(request: Request, user: dict | None) -> str:
    if user and user.get("id"):
        return f"u:{user['id']}"
    forwarded = request.headers.get("x-forwarded-for") or ""
    raw_ip = forwarded.split(",")[0].strip() if forwarded else ""
    if not raw_ip and request.client:
        raw_ip = request.client.host or ""
    return f"ip:{raw_ip or 'anon'}"


def _verify_image_proxy_sig(url: str, sig: str | None) -> bool:
    if not sig:
        return False
    expected = hmac.new(
        settings.JWT_SECRET.encode("utf-8"),
        f"trend_img:{url}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    return hmac.compare_digest(expected, sig.strip())


async def _is_registered_trend_image(url: str) -> bool:
    from app.services.trend_scout import _trend_feed_cache

    for entry in _trend_feed_cache.values():
        cards = entry[1] if isinstance(entry, tuple) and len(entry) > 1 else ()
        if any((c.get("image_url") or "").strip() == url for c in cards):
            return True
    db = get_db()
    hit = await db.trend_reports.find_one({"image_url": url}, {"_id": 1})
    return bool(hit)


def _validate_raster_image_payload(raw_ct: str, content: bytes) -> str:
    """Ensure fetched bytes carry an allowed raster MIME type and valid binary image signature."""
    base_ct = (raw_ct or "").split(";")[0].strip().lower()
    if base_ct not in _ALLOWED_RASTER_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported media type; only raster images are allowed",
        )
    if base_ct == "image/avif":
        # Older Pillow builds without pillow-avif lack the AVIF decoder; validate ISO-BMFF ftyp box.
        if len(content) < 16 or content[4:8] != b"ftyp" or content[8:12] not in (b"avif", b"avis", b"mif1"):
            raise HTTPException(status_code=415, detail="Invalid raster image payload")
        return "image/avif"
    try:
        with Image.open(io.BytesIO(content)) as im:
            fmt = (im.format or "").upper()
            im.verify()
    except (UnidentifiedImageError, Exception) as exc:
        raise HTTPException(status_code=415, detail="Invalid raster image payload") from exc
    if fmt not in _ALLOWED_PIL_FORMATS:
        raise HTTPException(status_code=415, detail="Unsupported raster image format")
    return "image/jpeg" if base_ct == "image/jpg" else base_ct


@router.get("/image-proxy")
async def proxy_trend_image(
    request: Request,
    url: str = Query(..., description="Target image URL to proxy"),
    sig: str | None = Query(default=None, description="Optional HMAC signature for unauthenticated image tag loads"),
    token: str | None = Query(default=None, description="Optional bearer token for authenticated image tag loads"),
    user: dict | None = Depends(get_current_user_optional),
) -> Response:
    """Proxy external trend article raster images to bypass CDN anti-hotlinking referer checks."""
    from app.services.security_validator import SafeFetchError, is_safe_external_url, safe_fetch_external

    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid image URL scheme")

    effective_user = user
    if effective_user is None and token:
        try:
            claims = decode_token(token.strip())
            if claims.get("sub"):
                effective_user = {"id": claims["sub"]}
        except HTTPException:
            effective_user = None

    if not _check_proxy_rate_limit(_proxy_client_key(request, effective_user)):
        raise HTTPException(status_code=429, detail="Image proxy rate limit exceeded")

    authorized = (
        effective_user is not None
        or _verify_image_proxy_sig(url, sig)
        or await _is_registered_trend_image(url)
    )
    if not authorized:
        raise HTTPException(status_code=403, detail="Authentication or registered trend media URL required")

    if not is_safe_external_url(url):
        raise HTTPException(status_code=400, detail="Disallowed target host")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/avif,image/jpeg,image/png,*/*;q=0.8",
    }
    try:
        resp = await safe_fetch_external(url, timeout=8.0, headers=headers, max_redirects=5, max_bytes=10_000_000)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Remote image fetch failed")
        safe_ct = _validate_raster_image_payload(resp.headers.get("content-type", ""), resp.content)
        return Response(
            content=resp.content,
            media_type=safe_ct,
            headers={
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'none'; sandbox",
                "Content-Disposition": "inline",
            },
        )
    except SafeFetchError as exc:
        raise HTTPException(status_code=400, detail=f"Blocked unsafe image URL: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {exc}")


