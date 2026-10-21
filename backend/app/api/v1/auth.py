"""Auth routes: /me, dev-bypass."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_db
from app.models.schemas import User
from app.services import repos
from app.services.auth import (
    apply_admin_role,
    create_access_token,
    get_current_user,
    hash_password,
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


@router.post("/dev-bypass", response_model=TokenOut)
async def dev_bypass() -> TokenOut:
    """Creates / logs in as a fixed test user.

    REMOVE BEFORE PRODUCTION. Controlled by `ALLOW_DEV_BYPASS=true`.
    """
    if not settings.ALLOW_DEV_BYPASS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Dev bypass disabled")

    db = get_db()
    email = "dressapdeveloper@gmail.com"
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        new_user = User(
            email=email,
            password_hash=hash_password("DevPass123!"),
            display_name="DressApp Developer",
            roles=["user", "admin", "tester"],
            preferred_language="en",
            preferred_voice_id="en_US-ryan-medium",
            home_location={"lat": 40.758, "lng": -73.9855, "city": "New York"},
        )
        # Provision 5 onboarding credits on signup as per pricing spec
        new_user.add_credit_bucket(amount=5, credit_type="free", days_until_expiry=30)
        doc = new_user.model_dump()
        await repos.insert(db.users, doc)
        user = doc
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    token = create_access_token(user["id"], {"email": user["email"], "dev": True})
    return TokenOut(access_token=token, user=_public_user(user))
