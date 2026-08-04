"""/api/v1 router hub."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ads,
    ai_credits,  # Updated with bucket-based credits and quota support
    campaigns,
    auth,
    avatar,
    closet,
    google_auth,
    listings,
    outfits,
    payments,
    professionals,
    share,
    sizes,
    stylist,
    suitcase,
    transactions,
    trends,
    users,
    atzmai,  # Atzmai payment gateway
)

api_v1_router = APIRouter(prefix="/v1")
api_v1_router.include_router(ai_credits.ai_credits_router)  # AI credits endpoints
api_v1_router.include_router(ai_credits.pricing_router)     # New pricing information endpoints
api_v1_router.include_router(ai_credits.quota_router)            # Quota management endpoints
api_v1_router.include_router(auth.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(avatar.router)
api_v1_router.include_router(closet.router)
api_v1_router.include_router(outfits.router)
api_v1_router.include_router(listings.router)
api_v1_router.include_router(transactions.router)
api_v1_router.include_router(stylist.router)
api_v1_router.include_router(suitcase.router)
api_v1_router.include_router(google_auth.auth_router)
api_v1_router.include_router(google_auth.calendar_router)
api_v1_router.include_router(trends.router)
api_v1_router.include_router(sizes.router)
api_v1_router.include_router(share.router)
api_v1_router.include_router(professionals.router)
api_v1_router.include_router(ads.router)
api_v1_router.include_router(campaigns.router)
api_v1_router.include_router(payments.paypal_router)
api_v1_router.include_router(payments.credits_router)
api_v1_router.include_router(payments.buy_router)
api_v1_router.include_router(admin.router)
api_v1_router.include_router(atzmai.router)
