"""Professionals Directory routes (Phase U).

Exposes a curated public listing of users who self-certify as fashion
professionals. Admin moderation (hide/unhide) lives under /admin/professionals.
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.db.database import get_db
from app.services.auth import sanitize_user_doc

router = APIRouter(prefix="/professionals", tags=["professionals"])


def _public_view(user: dict[str, Any]) -> dict[str, Any]:
    """Strip secrets & personal contact info; expose only directory-appropriate fields."""
    prof = user.get("professional") or {}
    business = prof.get("business") or {}
    show_contact = bool(prof.get("public_contact") or business.get("public_contact"))
    home_loc = user.get("home_location") or {}
    addr = user.get("address") or {}
    city = home_loc.get("city") or addr.get("city")
    country = home_loc.get("country") or addr.get("country")

    business_view: dict[str, Any] = {
        "name": business.get("name"),
        "website": business.get("website"),
        "description": business.get("description"),
    }
    if show_contact:
        business_view["phone"] = business.get("phone")
        business_view["email"] = business.get("email")
        business_view["address"] = business.get("address")

    return {
        "id": user.get("id"),
        "display_name": user.get("display_name")
        or " ".join(
            [user.get("first_name") or "", user.get("last_name") or ""]
        ).strip()
        or "Fashion pro",
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "avatar_url": user.get("avatar_url"),
        "face_photo_url": user.get("face_photo_url"),
        "locale": user.get("locale"),
        "preferred_language": user.get("preferred_language"),
        "location_summary": {
            "city": city,
            "country": country,
        },
        "professional": {
            "is_professional": prof.get("is_professional", True),
            "profession": prof.get("profession"),
            "public_contact": show_contact,
            "business": business_view,
            "approval_status": prof.get("approval_status", "pending"),
            "created_at": prof.get("created_at"),
        },
    }


@router.get("")
async def list_professionals(
    country: str | None = Query(None),
    region: str | None = Query(None),
    profession: str | None = Query(None),
    q: str | None = Query(None, description="Free-text search"),
    limit: int = Query(40, ge=1, le=100),
    skip: int = Query(0, ge=0),
) -> dict[str, Any]:
    db = get_db()
    flt: dict[str, Any] = {
        "professional.is_professional": True,
        "professional.approval_status": "approved",
    }
    if profession:
        flt["professional.profession"] = {"$regex": f"^{re.escape(profession[:100])}$", "$options": "i"}
    if country:
        safe_country = re.escape(country[:100])
        flt["$and"] = flt.get("$and", []) + [
            {
                "$or": [
                    {"home_location.country_code": {"$regex": f"^{safe_country}$", "$options": "i"}},
                    {"home_location.country": {"$regex": f"^{safe_country}$", "$options": "i"}},
                    {"address.country": {"$regex": f"^{safe_country}$", "$options": "i"}},
                ]
            }
        ]
    if region:
        safe_region = re.escape(region[:100])
        flt.setdefault("$and", []).append(
            {
                "$or": [
                    {"home_location.region": {"$regex": safe_region, "$options": "i"}},
                    {"address.region": {"$regex": safe_region, "$options": "i"}},
                    {"home_location.city": {"$regex": safe_region, "$options": "i"}},
                    {"address.city": {"$regex": safe_region, "$options": "i"}},
                ]
            }
        )
    if q:
        safe_q = re.escape(q[:100])
        flt.setdefault("$and", []).append(
            {
                "$or": [
                    {"display_name": {"$regex": safe_q, "$options": "i"}},
                    {"first_name": {"$regex": safe_q, "$options": "i"}},
                    {"last_name": {"$regex": safe_q, "$options": "i"}},
                    {"professional.business.name": {"$regex": safe_q, "$options": "i"}},
                    {"professional.profession": {"$regex": safe_q, "$options": "i"}},
                ]
            }
        )

    total = await db.users.count_documents(flt)
    cursor = (
        db.users.find(flt, {"_id": 0, "password_hash": 0, "google_oauth": 0, "google_calendar_tokens": 0})
        .sort([("professional.created_at", -1), ("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )
    items = [_public_view(sanitize_user_doc(doc)) async for doc in cursor]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{user_id}")
async def get_professional(user_id: str) -> dict[str, Any]:
    db = get_db()
    user = await db.users.find_one(
        {
            "id": user_id,
            "professional.is_professional": True,
            "professional.approval_status": "approved",
        },
        {"_id": 0, "password_hash": 0, "google_oauth": 0, "google_calendar_tokens": 0},
    )
    if not user:
        raise HTTPException(404, "Professional not found")
    return _public_view(sanitize_user_doc(user))
