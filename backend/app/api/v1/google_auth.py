"""Google OAuth + Calendar endpoints.

Three flows live here:

1. **Calendar connect** (existing) — an already-logged-in DressApp user clicks
   "Connect Calendar" on Profile. We mint a short-lived state JWT carrying the
   user_id, send the browser to Google with the calendar scope, and on
   callback persist tokens onto that user.

2. **Sign in with Google** (Phase T-Auth, NEW) — an *unauthenticated*
   visitor clicks "Continue with Google" on Login or Register. We mint a
   stateless state JWT (no user_id, since there is no logged-in user yet),
   redirect to Google, and on callback **find-or-create** a user by email,
   issue a DressApp JWT, and send the browser to ``/auth/callback`` on the
   frontend with the token in the URL hash fragment.

3. **Calendar status / upcoming** — small read-only endpoints used by the
   frontend Profile page and the Stylist for grounded-in-schedule advice.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.config import settings
from app.db.database import get_db
from app.models.schemas import User
from app.services import repos
from app.services.auth import (
    apply_admin_role,
    create_access_token,
    get_current_user,
)
from app.services.calendar_service import (
    LOGIN_SCOPES,
    SCOPES,
    calendar_service,
)

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/auth/google", tags=["auth-google"])
calendar_router = APIRouter(prefix="/calendar", tags=["calendar"])

_STATE_EXPIRES_MIN = 15  # short-lived CSRF state

# Backend path used by the new sign-in flow.
#
# IMPORTANT — historic note:
#   Originally we used a *distinct* callback path
#   ``/api/v1/auth/google/login/callback`` so the two flows could co-exist
#   with different state purposes. That approach required users to register
#   *two* redirect URIs in Google Cloud Console, and OAuth clients that
#   only had the calendar URI registered started failing with
#   ``redirect_uri_mismatch`` (Google 403 page) the moment we shipped
#   sign-in-with-Google.
#
#   Both flows now share ``/api/v1/auth/google/callback`` (the URI that
#   was already registered for calendar). Dispatch happens in the
#   callback handler based on the JWT state's ``purpose`` claim. The
#   legacy ``/login/callback`` route is preserved as a thin alias so any
#   handshake mid-flight when this lands still resolves cleanly.
LOGIN_CALLBACK_PATH = "/api/v1/auth/google/callback"
LEGACY_LOGIN_CALLBACK_PATH = "/api/v1/auth/google/login/callback"

# Frontend route that finalises the sign-in handshake (parses the hash
# fragment, persists the DressApp JWT, redirects into the app).
LOGIN_FRONTEND_PATH = "/auth/callback"


# -------------------- state helpers --------------------
def _build_state(
    user_id: str | None = None,
    *,
    purpose: str = "google-oauth-link",
    extra: dict[str, Any] | None = None,
) -> str:
    payload: dict[str, Any] = {
        "purpose": purpose,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_STATE_EXPIRES_MIN),
    }
    if user_id:
        payload["sub"] = user_id
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _read_state(token: str, *, expected_purpose: str) -> dict[str, Any]:
    try:
        data = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(400, "OAuth state token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(400, "Invalid OAuth state token") from exc
    if data.get("purpose") != expected_purpose:
        raise HTTPException(400, "Invalid OAuth state payload")
    return data


# -------------------- 1) Calendar connect (existing) --------------------
@auth_router.get("/start")
async def google_oauth_start(
    request: Request,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate the Google authorization URL for the current DressApp user."""
    if not calendar_service.enabled:
        raise HTTPException(503, "Google OAuth not configured on server")
    redirect_uri = calendar_service.resolve_redirect_uri(request)
    state = _build_state(
        user["id"],
        purpose="google-oauth-link",
        extra={"redirect_uri": redirect_uri},
    )
    try:
        url = calendar_service.build_authorization_url(state, request=request)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"authorization_url": url, "state": state}


@auth_router.get("/callback")
async def google_oauth_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    """Unified callback for both Google OAuth flows.

    Dispatches based on the JWT state's ``purpose`` claim:
      * ``google-oauth-link``  → calendar connect (existing user adds Calendar)
      * ``google-oauth-login`` → sign-in / sign-up (find-or-create user)

    Sharing a single redirect URI lets the app run with **one** entry in
    Google Cloud Console regardless of which flow the user enters.
    """
    # Peek at the state to decide which branch to run. We deliberately
    # decode WITHOUT a purpose check here so a missing/malformed state
    # is handled the same way each flow used to handle it.
    purpose = None
    if state:
        try:
            unverified = jwt.decode(
                state,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
            purpose = unverified.get("purpose")
        except Exception:  # noqa: BLE001
            purpose = None

    if purpose == "google-oauth-login":
        return await _handle_login_callback(request, code, state, error)
    # Default branch: calendar-link (back-compat with any state minted
    # by the original ``/callback`` handler).
    return await _handle_calendar_link_callback(request, code, state, error)


async def _handle_calendar_link_callback(
    request: Request,
    code: str | None,
    state: str | None,
    error: str | None,
) -> RedirectResponse:
    """Calendar-connect branch (existing logic, extracted verbatim)."""
    redirect_base = calendar_service.resolve_post_login_redirect(request)

    if error:
        logger.warning("Google OAuth error: %s", error)
        return RedirectResponse(f"{redirect_base}?calendar=error&reason={error}")
    if not code or not state:
        return RedirectResponse(f"{redirect_base}?calendar=error&reason=missing_params")

    try:
        data = _read_state(state, expected_purpose="google-oauth-link")
    except HTTPException as exc:
        return RedirectResponse(
            f"{redirect_base}?calendar=error&reason={exc.detail.replace(' ', '_')}"
        )
    user_id = data.get("sub")
    if not user_id:
        return RedirectResponse(f"{redirect_base}?calendar=error&reason=missing_user")

    redirect_uri = data.get("redirect_uri")
    try:
        tokens = await calendar_service.exchange_code(
            code, request=request, redirect_uri=redirect_uri
        )
    except Exception:  # noqa: BLE001
        logger.exception("Google token exchange failed")
        return RedirectResponse(
            f"{redirect_base}?calendar=error&reason=token_exchange_failed"
        )

    try:
        await calendar_service.persist_tokens_for_user(user_id, tokens)
    except Exception:  # noqa: BLE001
        logger.exception("Persisting Google tokens failed")
        return RedirectResponse(
            f"{redirect_base}?calendar=error&reason=persist_failed"
        )

    logger.info("google-calendar: successfully linked user_id=%s", user_id)
    return RedirectResponse(f"{redirect_base}?calendar=connected")


@auth_router.post("/disconnect")
async def google_oauth_disconnect(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    await calendar_service.disconnect_user(user["id"])
    return {"status": "disconnected"}


@auth_router.get("/re-consent")
async def google_re_consent(
    request: Request,
    user: dict = Depends(get_current_user),
    with_calendar: bool = Query(
        default=False,
        description="When true, also requests calendar.readonly scope.",
    ),
) -> dict[str, Any]:
    """Generate a new Google authorization URL that forces re-consent with
    the full scope set (including People API scopes for demographics).

    This is needed for users who signed in BEFORE the People API scopes
    were added — their existing tokens don't have the permissions needed
    to fetch birthday, phone, address, or gender from Google.
    """
    if not calendar_service.enabled:
        raise HTTPException(503, "Google OAuth not configured on server")

    state = _build_state(
        user["id"],
        purpose="google-oauth-link",
        extra={"reconsent": True},
    )

    scopes = SCOPES if with_calendar else LOGIN_SCOPES
    try:
        url = calendar_service.build_authorization_url(
            state,
            request=request,
            scopes=scopes,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"authorization_url": url, "with_calendar": bool(with_calendar)}


# -------------------- 2) Sign in / Sign up with Google (NEW) --------------------
def _frontend_origin(request: Request) -> str:
    """Resolve the public frontend origin for the post-login redirect.

    Reuses the same env override / X-Forwarded headers logic the calendar
    flow relies on, so this works on preview, staging, prod and any custom
    domain without .env edits.
    """
    if settings.GOOGLE_OAUTH_POST_LOGIN_REDIRECT:
        # Strip path component if present — we want just origin here.
        from urllib.parse import urlparse

        parsed = urlparse(settings.GOOGLE_OAUTH_POST_LOGIN_REDIRECT)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    headers = request.headers
    scheme = headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = (
        headers.get("x-forwarded-host")
        or headers.get("host")
        or request.url.netloc
    )
    host = (host or "").split(",")[0].strip()
    return f"{scheme}://{host}" if host else ""


# ---------------------------------------------------------------------------
# Idempotency cache & in-flight exchange locks — protects against Chrome
# Custom Tab retrying the /callback URL or duplicate concurrent prefetch hits.
# The second hit finds the Google auth code already consumed → invalid_grant.
# Keyed by the raw state JWT string (unique per sign-in attempt).
# ---------------------------------------------------------------------------
_EXCHANGE_CACHE: dict[str, tuple[str, float]] = {}
_EXCHANGE_CACHE_TTL = 300.0   # seconds — covers any realistic Chrome retry
_EXCHANGE_CACHE_MAX = 500     # safety cap on memory usage
_EXCHANGE_LOCKS: dict[str, asyncio.Lock] = {}
_EXCHANGE_LOCKS_GUARD = asyncio.Lock()


def _cleanup_exchange_cache() -> None:
    """Evict expired entries; trim to half capacity when above the limit."""
    now = time.time()
    expired = [
        k for k, (_, ts) in _EXCHANGE_CACHE.items()
        if now - ts > _EXCHANGE_CACHE_TTL
    ]
    for k in expired:
        _EXCHANGE_CACHE.pop(k, None)
        _EXCHANGE_LOCKS.pop(k, None)
    if len(_EXCHANGE_CACHE) > _EXCHANGE_CACHE_MAX:
        trim = list(_EXCHANGE_CACHE.keys())[: len(_EXCHANGE_CACHE) // 2]
        for k in trim:
            _EXCHANGE_CACHE.pop(k, None)
            _EXCHANGE_LOCKS.pop(k, None)


def _login_error_redirect(origin: str, reason: str) -> RedirectResponse:
    target = f"{origin}{LOGIN_FRONTEND_PATH}#error={reason}"
    return RedirectResponse(target)


def _smart_error_redirect(
    origin: str,
    reason: str,
    state_data: dict[str, Any] | None = None,
) -> RedirectResponse:
    """Route errors to the mobile custom scheme when the flow was initiated
    from the React Native app (``state_data['mobile']`` is True), otherwise
    to the standard web ``/auth/callback`` page.

    Using ``dressapp://auth/callback#error=…`` lets ``openAuthSessionAsync``
    intercept the redirect so the LoginScreen can surface the error via
    Alert.alert instead of leaving the user on a Chrome Custom Tab.
    """
    if state_data and state_data.get("mobile"):
        return RedirectResponse(f"dressapp://auth/callback#error={reason}")
    return _login_error_redirect(origin, reason)


@auth_router.get("/login/start")
async def google_login_start(
    request: Request,
    with_calendar: bool = Query(
        default=False,
        description="When true, also requests the calendar.readonly scope so the user lands logged-in *and* calendar-connected in a single consent.",
    ),
    next: str | None = Query(  # noqa: A002 — query name is intentional
        default=None,
        description="Optional frontend path to redirect to after sign-in. Only relative paths are honoured.",
    ),
    mobile: bool = Query(
        default=False,
        description="When true (sent by the React Native app), the post-login redirect uses dressapp://auth/callback instead of the web /auth/callback so the Custom Tab hands control back to the app.",
    ),
) -> dict[str, Any]:
    """Public endpoint that returns the Google authorization URL for the
    *sign-in / sign-up* flow. No DressApp credentials required.
    """
    if not calendar_service.enabled:
        raise HTTPException(503, "Google OAuth not configured on server")

    # Sanitize ``next`` — only allow relative paths to prevent open-redirect.
    safe_next = None
    if next and next.startswith("/") and not next.startswith("//"):
        safe_next = next

    redirect_uri = calendar_service.resolve_redirect_uri(
        request, callback_path=LOGIN_CALLBACK_PATH
    )

    state = _build_state(
        purpose="google-oauth-login",
        extra={
            "with_calendar": bool(with_calendar),
            "next": safe_next,
            "mobile": bool(mobile),
            "redirect_uri": redirect_uri,
        },
    )

    scopes = SCOPES if with_calendar else LOGIN_SCOPES
    try:
        url = calendar_service.build_authorization_url(
            state,
            request=request,
            scopes=scopes,
            callback_path=LOGIN_CALLBACK_PATH,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"authorization_url": url, "with_calendar": bool(with_calendar)}


@auth_router.get("/login/diag")
async def google_login_diag(request: Request) -> dict[str, Any]:
    """Read-only diagnostic that returns the *exact* redirect_uri the
    backend will send to Google for the sign-in flow. Use this to verify
    the URI registered in your Google Cloud Console matches byte-for-byte.

    Safe to expose: no secrets are leaked, only the public client_id and
    the request-derived origin.
    """
    redirect_uri = calendar_service.resolve_redirect_uri(
        request, callback_path=LOGIN_CALLBACK_PATH
    )
    calendar_redirect_uri = calendar_service.resolve_redirect_uri(request)
    return {
        "enabled": calendar_service.enabled,
        "client_id_present": bool(calendar_service.client_id),
        "client_id_tail": (
            (calendar_service.client_id or "")[-12:]
            if calendar_service.client_id
            else None
        ),
        "login_redirect_uri": redirect_uri,
        "calendar_redirect_uri": calendar_redirect_uri,
        "headers_seen": {
            "host": request.headers.get("host"),
            "x-forwarded-host": request.headers.get("x-forwarded-host"),
            "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
        },
    }


@auth_router.get("/login/callback")
async def google_login_callback_legacy(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    """Legacy alias kept ONLY for users mid-flow when the unified-callback
    refactor lands. New starts always go through ``/callback``. Safe to
    remove after one full release cycle.

    Crucially, we forward the **legacy** callback path to ``exchange_code``
    so Google's token endpoint sees the same ``redirect_uri`` the
    authorize step used (otherwise Google rejects with
    ``invalid_grant: redirect_uri mismatch``).
    """
    return await _handle_login_callback(
        request, code, state, error,
        callback_path=LEGACY_LOGIN_CALLBACK_PATH,
    )


async def _handle_login_callback(
    request: Request,
    code: str | None,
    state: str | None,
    error: str | None,
    *,
    callback_path: str = LOGIN_CALLBACK_PATH,
) -> RedirectResponse:
    """Handle Google's redirect for the *sign-in / sign-up* flow.

    On success: find-or-create user by email, optionally persist calendar
    tokens, mint a DressApp JWT, redirect to the frontend with the token
    in the URL hash fragment (so it never hits any access log).
    """
    origin = _frontend_origin(request) or ""

    # --- Best-effort mobile detection (before full state validation) ---
    # Try to peek at the state JWT to detect mobile=true BEFORE the
    # full validation, so that error redirects go to dressapp:// instead
    # of the web. We use options={"verify_exp": False} to avoid rejecting
    # expired tokens during this peek — the full validation below will
    # enforce expiry properly.
    _peek_state: dict[str, Any] | None = None
    if state:
        try:
            _peek_state = jwt.decode(
                state, settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_exp": False},
            )
        except jwt.InvalidTokenError:
            pass  # best-effort — errors handled below

    if error:
        logger.warning("Google sign-in OAuth error: %s", error)
        return _smart_error_redirect(origin, error, _peek_state)
    if not code or not state:
        return _smart_error_redirect(origin, "missing_params", _peek_state)

    try:
        state_data = _read_state(state, expected_purpose="google-oauth-login")
    except HTTPException as exc:
        return _smart_error_redirect(origin, exc.detail.replace(" ", "_"), _peek_state)

    with_calendar = bool(state_data.get("with_calendar"))
    next_path = state_data.get("next") or "/home"

    is_mobile = bool(state_data.get("mobile"))

    # --- Idempotency guard (Chrome Custom Tab retry protection) ---
    # Chrome sometimes re-requests the backend callback after firing the
    # dressapp:// intent to Android.  If we already processed this state
    # JWT successfully, return the cached redirect immediately without
    # hitting Google's token endpoint a second time.
    _cleanup_exchange_cache()
    if state in _EXCHANGE_CACHE:
        cached_url, cached_at = _EXCHANGE_CACHE[state]
        if time.time() - cached_at < _EXCHANGE_CACHE_TTL:
            logger.info(
                "google sign-in: returning cached redirect (Chrome retry) "
                "state_jti=%.12s", state[-12:]
            )
            return RedirectResponse(cached_url)

    # Acquire or create per-state lock to serialize concurrent requests for the same state
    async with _EXCHANGE_LOCKS_GUARD:
        if state not in _EXCHANGE_LOCKS:
            _EXCHANGE_LOCKS[state] = asyncio.Lock()
        state_lock = _EXCHANGE_LOCKS[state]

    async with state_lock:
        if state in _EXCHANGE_CACHE:
            cached_url, cached_at = _EXCHANGE_CACHE[state]
            if time.time() - cached_at < _EXCHANGE_CACHE_TTL:
                logger.info(
                    "google sign-in: returning cached redirect after awaiting lock "
                    "state_jti=%.12s", state[-12:]
                )
                return RedirectResponse(cached_url)

        pinned_redirect_uri = state_data.get("redirect_uri")

        # 1) Exchange the auth code.
        try:
            tokens = await calendar_service.exchange_code(
                code,
                request=request,
                callback_path=callback_path,
                redirect_uri=pinned_redirect_uri,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Google sign-in token exchange failed (redirect_uri=%s)", pinned_redirect_uri)
            # Surface a compact reason so the user can see it in the URL hash
            # without having to grep backend logs. We URL-quote-plus to avoid
            # breaking the fragment parser on ``=`` / ``&`` characters.
            from urllib.parse import quote_plus

            reason = quote_plus(f"token_exchange_failed: {str(exc)[:160]}")
            return _smart_error_redirect(origin, reason, state_data)

        access_token = tokens.get("access_token")
        if not access_token:
            return _smart_error_redirect(origin, "no_access_token", state_data)

        # Log granted scopes for diagnostics — helps identify if People API
        # scopes were silently skipped by Google (restricted scope issue).
        granted_scopes = (tokens.get("scope") or "").split()
        people_scopes_needed = [
            "https://www.googleapis.com/auth/user.birthday.read",
            "https://www.googleapis.com/auth/user.phonenumbers.read",
            "https://www.googleapis.com/auth/user.addresses.read",
            "https://www.googleapis.com/auth/user.gender.read",
        ]
        missing = [s for s in people_scopes_needed if s not in granted_scopes]
        if missing:
            logger.warning(
                "google sign-in: People API scopes NOT granted — missing=%s granted=%s. "
                "Demographics will not be auto-filled. Verify the OAuth consent screen "
                "is published in Google Cloud Console.",
                missing,
                granted_scopes,
            )
        else:
            logger.info(
                "google sign-in: all People API scopes granted — scopes=%s",
                granted_scopes,
            )

        # 2) Fetch userinfo (email is the join key).
        try:
            userinfo = await calendar_service.fetch_userinfo(access_token)
        except Exception:  # noqa: BLE001
            logger.exception("Google sign-in userinfo fetch failed")
            return _smart_error_redirect(origin, "userinfo_failed", state_data)

        email = (userinfo.get("email") or "").lower()

        # Fetch extended profile (optional/non-blocking)
        extended_profile = {}
        try:
            extended_profile = await calendar_service.fetch_people_profile(access_token)
            if not extended_profile:
                # People API returned empty — likely missing scopes. Log the
                # granted scopes so the admin can diagnose from logs.
                granted = (tokens.get("scope") or "").split()
                logger.warning(
                    "google sign-in: People API returned empty for user email=%s — "
                    "granted_scopes=%s. If user.birthday.read / user.gender.read / "
                    "user.phonenumbers.read / user.addresses.read are not in the list, "
                    "the OAuth consent screen needs to be verified in Google Cloud Console.",
                    email,
                    granted,
                )
        except Exception as e:
            logger.warning("Google sign-in People API fetch failed: %s", e)
        if not email:
            return _smart_error_redirect(origin, "no_email", state_data)
        if not userinfo.get("verified_email", True):
            # Most Google accounts are verified; reject unverified to prevent
            # account-takeover via email collision.
            return _smart_error_redirect(origin, "email_unverified", state_data)

        db = get_db()
        existing = await db.users.find_one({"email": email}, {"_id": 0})

        # 3) Find-or-create the user (auto-link by email per decision 2a).
        if existing:
            user_doc = existing
            patch: dict[str, Any] = {}
            # Autofill profile fields that are still empty — mirrors the same
            # logic used by ``calendar_service.persist_tokens_for_user`` so the
            # behaviour is consistent regardless of which path is taken.
            if userinfo.get("given_name") and not user_doc.get("first_name"):
                patch["first_name"] = userinfo["given_name"]
            if userinfo.get("family_name") and not user_doc.get("last_name"):
                patch["last_name"] = userinfo["family_name"]
            if userinfo.get("name") and not user_doc.get("display_name"):
                patch["display_name"] = userinfo["name"]
            if userinfo.get("picture") and not user_doc.get("avatar_url"):
                patch["avatar_url"] = userinfo["picture"]
            if userinfo.get("locale") and not user_doc.get("locale"):
                patch["locale"] = userinfo["locale"]
                
            # Autofill extended contact info from Google People API if empty or missing
            if extended_profile.get("date_of_birth") and (not user_doc.get("date_of_birth") or user_doc.get("date_of_birth") == ""):
                patch["date_of_birth"] = extended_profile["date_of_birth"]
            if extended_profile.get("phone") and (not user_doc.get("phone") or user_doc.get("phone") == ""):
                patch["phone"] = extended_profile["phone"]
            if extended_profile.get("sex") and (not user_doc.get("sex") or user_doc.get("sex") == ""):
                patch["sex"] = extended_profile["sex"]

            if extended_profile.get("address"):
                google_addr = extended_profile["address"]
                existing_addr = user_doc.get("address") or {}
                
                addr_patch = {}
                for sub_k in ["line1", "line2", "city", "region", "postal_code", "country"]:
                    g_val = google_addr.get(sub_k)
                    e_val = existing_addr.get(sub_k)
                    if g_val and (not e_val or e_val == ""):
                        addr_patch[sub_k] = g_val
                
                if addr_patch:
                    merged_addr = dict(existing_addr)
                    merged_addr.update(addr_patch)
                    patch["address"] = merged_addr

            # Re-apply admin allow-list on every Google login — same idempotent
            # behaviour as email/password login.
            new_roles = apply_admin_role(user_doc.get("roles"), email)
            if set(new_roles) != set(user_doc.get("roles") or []):
                patch["roles"] = new_roles
            if patch:
                patch["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.users.update_one({"id": user_doc["id"]}, {"$set": patch})
                user_doc.update(patch)
            logger.info("google sign-in: linked existing user email=%s", email)
        else:
            new_user = User(
                email=email,
                password_hash=None,
                display_name=userinfo.get("name")
                or userinfo.get("given_name")
                or email.split("@")[0],
                avatar_url=userinfo.get("picture"),
                first_name=userinfo.get("given_name"),
                last_name=userinfo.get("family_name"),
                locale=userinfo.get("locale") or "en-US",
                date_of_birth=extended_profile.get("date_of_birth"),
                phone=extended_profile.get("phone"),
                address=extended_profile.get("address"),
                sex=extended_profile.get("sex"),
            )
            # Provision 10 free credits (expiring in 30 days) on signup as per pricing spec
            new_user.add_credit_bucket(amount=10, credit_type="free", days_until_expiry=30)
            user_doc = new_user.model_dump()
            user_doc["roles"] = apply_admin_role(user_doc.get("roles"), email)
            await repos.insert(db.users, user_doc)
            logger.info("google sign-in: created new user email=%s id=%s", email, new_user.id)

        # 4) Persist tokens for the user to mark as Google-connected and enable profile sync.
        try:
            await calendar_service.persist_tokens_for_user(user_doc["id"], tokens)
        except Exception:  # noqa: BLE001
            logger.exception("Google token persist failed during sign-in")
            if with_calendar:
                jwt_token = create_access_token(
                    user_doc["id"], {"email": user_doc["email"]}
                )
                params = urlencode(
                    {
                        "token": jwt_token,
                        "next": next_path,
                        "warning": "calendar_persist_failed",
                    }
                )
                if is_mobile:
                    return RedirectResponse(f"dressapp://auth/callback#{params}")
                return RedirectResponse(f"{origin}{LOGIN_FRONTEND_PATH}#{params}")

        # 5) Mint our own JWT and hand it back to the client.
        jwt_token = create_access_token(
            user_doc["id"], {"email": user_doc["email"]}
        )
        params = urlencode({"token": jwt_token, "next": next_path})

        # Mobile clients (React Native + openAuthSessionAsync) need a custom-scheme
        # redirect so Chrome Custom Tab signals the app to close and returns the URL.
        # Web clients get the standard web /auth/callback fragment.
        if is_mobile:
            final_url = f"dressapp://auth/callback#{params}"
        else:
            final_url = f"{origin}{LOGIN_FRONTEND_PATH}#{params}"

        # Cache the successful result so a Chrome retry of the same callback
        # returns the same redirect without re-exchanging the (now invalid) code.
        _EXCHANGE_CACHE[state] = (final_url, time.time())
        logger.info(
            "google sign-in: success email=%s mobile=%s — redirect cached",
            email, is_mobile,
        )
        return RedirectResponse(final_url)


# -------------------- 3) calendar routes --------------------
@calendar_router.get("/status")
async def calendar_status(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    tokens = (user or {}).get("google_calendar_tokens") or {}
    return {
        "connected": bool(tokens.get("refresh_token")),
        "google_email": tokens.get("google_email"),
        "connected_at": tokens.get("connected_at"),
        "scope": tokens.get("scope"),
    }


@calendar_router.get("/upcoming")
async def calendar_upcoming(
    hours_ahead: int = Query(default=48, ge=1, le=168),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    events = await calendar_service.get_events_for_user(user, hours_ahead=hours_ahead)
    return {"events": events, "count": len(events)}


@auth_router.post("/sync-profile")
async def sync_profile_from_google(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve user's extended profile details (birthday, phone, address) from Google People API."""
    tokens = user.get("google_calendar_tokens") or {}
    if not tokens.get("access_token"):
        raise HTTPException(status_code=400, detail="Google account not connected.")

    # Check if People API scopes were granted — if not, the People API
    # calls will silently return empty data, confusing the user.
    granted_scopes = (tokens.get("scope") or "").split()
    people_scopes = [
        "https://www.googleapis.com/auth/user.birthday.read",
        "https://www.googleapis.com/auth/user.phonenumbers.read",
        "https://www.googleapis.com/auth/user.addresses.read",
        "https://www.googleapis.com/auth/user.gender.read",
    ]
    missing_people = [s for s in people_scopes if s not in granted_scopes]
    if missing_people:
        logger.warning(
            "sync-profile: People API scopes missing for user %s — missing=%s. "
            "Returning re-consent prompt.",
            user["id"],
            missing_people,
        )
        raise HTTPException(
            status_code=403,
            detail="missing_people_scopes",
        )

    try:
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2.credentials import Credentials
        from app.services.calendar_service import GOOGLE_TOKEN_URL
        
        scope_val = tokens.get("scope")
        if isinstance(scope_val, str):
            token_scopes = scope_val.split(" ")
        else:
            token_scopes = tokens.get("scopes") or SCOPES
            
        creds = Credentials(
            token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri=GOOGLE_TOKEN_URL,
            client_id=calendar_service.client_id,
            client_secret=calendar_service.client_secret,
            scopes=token_scopes,
        )
        if not creds.valid and creds.refresh_token:
            creds.refresh(GoogleAuthRequest())
            db = get_db()
            await db.users.update_one(
                {"id": user["id"]},
                {
                    "$set": {
                        "google_calendar_tokens.access_token": creds.token,
                        "google_calendar_tokens.expires_at": (
                            datetime.now(timezone.utc) + timedelta(minutes=50)
                        ).isoformat(),
                    }
                },
            )
        access_token = creds.token
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to refresh Google credentials: {exc}")
        
    extended_profile = await calendar_service.fetch_people_profile(access_token)
    if not extended_profile:
        raise HTTPException(status_code=400, detail="No profile details could be retrieved from Google.")
        
    db = get_db()
    patch = {}
    
    # Merge Date of Birth
    dob = extended_profile.get("date_of_birth")
    if dob:
        patch["date_of_birth"] = dob
        
    # Merge Phone
    phone = extended_profile.get("phone")
    if phone:
        patch["phone"] = phone
        
    # Merge Gender
    sex = extended_profile.get("sex")
    if sex:
        patch["sex"] = sex
        
    # Merge Address fields defensively
    if extended_profile.get("address"):
        google_addr = extended_profile["address"]
        existing_addr = user.get("address") or {}
        
        # Build merged address dict
        merged_addr = {}
        for sub_k in ["line1", "line2", "city", "region", "postal_code", "country"]:
            # Google value takes precedence if present, otherwise keep existing
            merged_addr[sub_k] = google_addr.get(sub_k) or existing_addr.get(sub_k) or ""
            
        patch["address"] = merged_addr
        
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
        
    # Retrieve final merged values to return to frontend
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0}) or {}
    
    return {
        "success": True,
        "date_of_birth": updated_user.get("date_of_birth") or dob,
        "phone": updated_user.get("phone") or phone,
        "address": updated_user.get("address") or extended_profile.get("address"),
        "sex": updated_user.get("sex") or sex,
    }
