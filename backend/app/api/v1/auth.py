"""Auth routes: /me."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.config import settings
from app.services.auth import (
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    create_access_token,
    get_current_user,
    sanitize_user_doc,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


def _public_user(user: dict[str, Any]) -> dict[str, Any]:
    from app.models.credit import CreditBucket, get_total_credits
    from app.services.credit_manager import (
        compute_nano_banana_monthly_state,
        compute_onprem_credit_state,
    )
    out = sanitize_user_doc(user)
    out["google_connected"] = bool(user.get("google_oauth"))
    try:
        raw_buckets = out.get("credit_buckets") or []
        parsed_buckets = [CreditBucket(**b) if isinstance(b, dict) else b for b in raw_buckets]
        computed_credits = get_total_credits(parsed_buckets)
        out["total_credits"] = computed_credits
        out["ai_credits"] = computed_credits
        out["onprem_credits"] = compute_onprem_credit_state(out)
        out["nano_banana_monthly"] = compute_nano_banana_monthly_state(out)
    except Exception:
        pass
    return out


@router.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    return _public_user(user)


@router.post("/logout")
async def logout(response: Response) -> dict[str, Any]:
    """Clear browser HttpOnly session and CSRF cookies."""
    secure_cookie = not settings.is_dev_or_test
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        path="/",
        httponly=False,
        secure=secure_cookie,
        samesite="lax",
    )
    return {"ok": True}


@router.post("/extension-token")
async def issue_extension_token(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Mint a Bearer token for Chrome Extension handoff without storing the web session in localStorage."""
    token = create_access_token(
        user["id"],
        {"email": user.get("email"), "client": "extension"},
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": int(settings.JWT_EXPIRES_MIN) * 60,
    }

