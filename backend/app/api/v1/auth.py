"""Auth routes: /me."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.auth import (
    get_current_user,
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
    out = {k: v for k, v in user.items() if k not in {"password_hash", "google_oauth"}}
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

