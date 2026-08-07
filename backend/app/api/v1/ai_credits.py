"""Phase 4P — AI credits API endpoints with bucket-based credit management.

Everything AI-credit-related lives here:

- /ai-credits/balance          per-user AI credit balance (now supports buckets)
- /ai-credits/purchase         create PayPal order for a credit pack (paid credits)
- /ai-credits/purchase/{id}/capture  capture order + add paid credit bucket
- /ai-credits/history          AI credit transaction history
- /ai-credits/usage            check usage limits and credit availability
- /api/v1/pricing              comprehensive pricing/tier information (new endpoint group)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional, Literal, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.db.database import get_db
from app.models.schemas import AiCreditPurchase, User, CreditBucket, CreditType
from app.services import paypal_client
from app.services.auth import get_current_user
from app.services.pricing import get_user_ai_balance, apply_credit_rollover as apply_daily_allocation
from app.services.token_meter import TokenMeter
from app.config import settings

logger = logging.getLogger(__name__)

ai_credits_router = APIRouter(prefix="/ai-credits", tags=["ai-credits"])
pricing_router = APIRouter(prefix="/pricing", tags=["pricing"])  # Complementary pricing endpoints
quota_router = APIRouter(prefix="/quota", tags=["quota"])  # Quota management endpoints


_CREDIT_PACKS = {"10": 10, "25": 25, "50": 50, "100": 100}  # Updated to match modern pack sizes


class AiCreditPurchaseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pack: Literal["10", "25", "50", "100"]
    currency: str = "USD"


class CreditUsageRequest(BaseModel):
    operation: str = "ai_operation"
    required_credits: int = 10


class CreditUsageResponse(BaseModel):
    available_credits: int
    daily_used: int
    monthly_used: int
    daily_limit: int
    monthly_limit: int
    can_use: bool
    upgrade_required: bool


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_configured() -> None:
    if not paypal_client.is_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {
                "code": "paypal_not_configured",
                "message": (
                    "PayPal is not configured on this environment. Add "
                    "PAYPAL_SANDBOX_CLIENT_ID + PAYPAL_SANDBOX_SECRET "
                    "to /app/backend/.env and restart."
                ),
            },
        )


@pricing_router.get("/info")
async def get_pricing_info(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get comprehensive pricing and credit information."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        
        u_model = User.parse_obj(user_record)
        summary = u_model.get_credit_usage_summary()
        
        sub = user_record.get("subscription") or {}
        is_active = sub.get("is_active", False)
        plan_type = sub.get("plan_type", "free")
        tier = sub.get("tier", "free")
        
        user_tier = "free"
        if is_active and plan_type != "free":
            if tier in ["pro", "manager"]:
                user_tier = "manager"
            elif tier in ["business", "professional"]:
                user_tier = "professional"

        return {
            "success": True,
            "user_id": user["id"],
            "pricing_plan": {
                "plan_type": user_tier,
                "ai_provider_mode": "custom_keys",
                "ai_provider": user_record.get("ai_configuration", {}).get("selected_provider", "google_ai"),
                "ai_model": user_record.get("ai_configuration", {}).get("selected_model", "gemini-2.5-flash"),
            },
            "credits": {
                "total_credits": 0,
                "free_credits_available": 0,
                "free_credits_expired": 0,
                "paid_credits": 0,
                "ai_credits_used_this_month": 0,
                "ai_monthly_limit": 0,
                "ai_daily_limit": 10 if user_tier == "free" else 999999,
                "ai_daily_used": user_record.get("ai_configuration", {}).get("daily_request_count", 0),
                "ai_monthly_used": 0,
            },
            "credit_packs": [],
            "pricing_tiers": [
                {
                    "name": "Free",
                    "price": 0,
                    "features": [
                        "Up to 50 closet items",
                        "Up to 10 requests per day",
                        "Community support"
                    ],
                },
                {
                    "name": "Manager",
                    "price": 500,  # $5.00
                    "features": [
                        "Unlimited closet items",
                        "Unlimited daily requests",
                        "Marketplace selling & renting",
                        "Trend Scout",
                        "Scheduler & push notifications",
                        "Priority support"
                    ],
                },
                {
                    "name": "Professional",
                    "price": 1000,  # $10.00
                    "features": [
                        "Unlimited closet items",
                        "Unlimited daily requests",
                        "Marketplace selling & renting",
                        "Trend Scout",
                        "Scheduler & push notifications",
                        "Ad Campaigns included",
                        "Dedicated support"
                    ],
                },
            ],
            "bucket_count": 0,
        }
    except Exception as e:
        logger.error(f"Error fetching pricing info: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@ai_credits_router.get("/balance")
async def get_balance(
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get current AI credit balance using the bucket system (backward compatible view)."""
    db = get_db()
    user_record = await db.users.find_one({"id": user["id"]})
    
    if not user_record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Use User model for proper bucket calculations
    u_model = User.parse_obj(user_record)
    
    # Return both old-style fields (for backward compatibility) and new bucket details
    return {
        "current_credits": u_model.total_credits,  # Backward compatible field showing total
        "total_credits": u_model.total_credits,
        "free_credits_available": sum(b["amount"] for b in user_record.get("credit_buckets", []) 
                                     if b["type"]=="free" and (not b.get("expires_at") or datetime.now().timestamp() <= datetime.fromisoformat(b["expires_at"]).timestamp())),
        "paid_credits": sum(b["amount"] for b in user_record.get("credit_buckets", []) if b["type"]=="paid"),
        "ai_credits_used_this_month": user_record.get("ai_configuration", {}).get("ai_credits_used_this_month", 0),
        "ai_monthly_limit": user_record.get("ai_configuration", {}).get("ai_monthly_limit", 1000),
        "ai_daily_limit": user_record.get("ai_configuration", {}).get("ai_daily_limit", 100),
        "daily_usage": user_record.get("ai_configuration", {}).get("ai_daily_used", 0),
        "monthly_usage": user_record.get("ai_configuration", {}).get("ai_monthly_used", 0),
        "provider_mode": user_record.get("ai_configuration", {}).get("ai_provider_mode", "standard"),
        "ai_provider": user_record.get("ai_configuration", {}).get("ai_provider", "gemini"),
        "buckets": [
            {
                "index": i,
                "amount": b["amount"],
                "type": b["type"],
                "created_at": b["created_at"],
                "expires_at": b.get("expires_at"),
                "is_expired": b["type"] == "free" and b.get("expires_at") and datetime.now().timestamp() > datetime.fromisoformat(b["expires_at"]).timestamp(),
            }
            for i, b in enumerate(user_record.get("credit_buckets", []))
        ],
    }


@ai_credits_router.post("/purchase")
async def create_purchase(
    payload: AiCreditPurchaseIn,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create Atzmai payment link for credit pack purchase (adds paid credit bucket upon capture)."""
    import uuid
    from app.services import atzmai_client
    
    currency = payload.currency.upper()
    pack_size = payload.pack
    credits_amount = _CREDIT_PACKS[pack_size]
    
    # Actually use correct pricing from config
    from app.services.pricing import CREDIT_PACK_PRICES
    pack_info = CREDIT_PACK_PRICES[pack_size]
    amount_cents = pack_info.price_cents
    
    purchase_id = f"ai_pur_{uuid.uuid4().hex[:16]}"
    amount_units = amount_cents / 100.0
    description = f"DressApp AI credit pack ({credits_amount} credits)"
    phone = user.get("phone", "0500000000") or "0500000000"
    email = user["email"]
    customer_name = f"{user.get('first_name', 'User')} {user.get('last_name', '')}".strip() or "User"
    
    # Resolve callback and redirect URLs dynamically
    redirect_url = f"{settings.APP_PUBLIC_URL}/pricing/purchase?sub_status=success&token={purchase_id}"
    fail_redirect_url = f"{settings.APP_PUBLIC_URL}/pricing/purchase?sub_status=cancel&token={purchase_id}"
    callback_url = f"{settings.APP_PUBLIC_URL}/api/v1/atzmai/webhook"
    
    try:
        items = [{"amount": amount_units, "description": description}]
        resp = await atzmai_client.generate_payment_link(
            items=items,
            customer_name=customer_name,
            email=email,
            phone=phone,
            language="he",
            redirect_url=redirect_url,
            fail_redirect_url=fail_redirect_url,
            callback_url=callback_url,
            atzmai_client_id=user["id"],
            currency=currency,
        )
    except atzmai_client.AtzmaiError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, {"atzmai_error": str(exc.body)}) from exc
        
    body_data = resp.get("body") or {}
    atzmai_payment_id = body_data.get("atzmai_payment_id")
    payment_url = body_data.get("url")

    if not atzmai_payment_id or not payment_url:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Invalid response from Atzmai payment gateway")
        
    db = get_db()
    topup_doc = {
        "id": purchase_id,
        "atzmai_payment_id": atzmai_payment_id,
        "user_id": user["id"],
        "amount_cents": amount_cents,
        "currency": currency,
        "type": "ai_credits",
        "pack": pack_size,
        "status": "pending",
        "payment_url": payment_url,
        "created_at": _now_iso(),
        "updated_at": _now_iso()
    }
    await db.atzmai_topups.insert_one(topup_doc)
    
    compat_doc = {
        "id": purchase_id,
        "user_id": user["id"],
        "pack": pack_size,
        "credits_amount": credits_amount,
        "amount_cents": amount_cents,
        "currency": currency,
        "paypal_order_id": atzmai_payment_id,
        "status": "pending",
        "created_at": _now_iso(),
        "updated_at": _now_iso()
    }
    await db.ai_credit_purchases.insert_one(compat_doc)
    
    return {
        "purchase_id": purchase_id,
        "order_id": atzmai_payment_id,
        "credits_amount": credits_amount,
        "amount_cents": amount_cents,
        "currency": currency,
        "status": "pending",
        "approve_url": payment_url,
    }


@ai_credits_router.post("/purchase/{purchase_id}/capture")
async def capture_purchase(
    purchase_id: str,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Capture Atzmai transaction and add credit bucket (paid credits, never expires)."""
    db = get_db()
    from app.services import atzmai_client
    
    purchase = await db.ai_credit_purchases.find_one(
        {"id": purchase_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not purchase:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="AI credit purchase not found")
        
    if purchase.get("status") == "captured":
        return {"ok": True, "already_captured": True, "purchase": purchase}
        
    topup = await db.atzmai_topups.find_one({"id": purchase_id})
    if not topup:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Atzmai transaction not found")
        
    is_captured = topup.get("status") == "captured" or atzmai_client.is_mock_mode()
    
    if is_captured and topup.get("status") != "captured":
        await db.atzmai_topups.update_one(
            {"id": purchase_id},
            {"$set": {"status": "captured", "updated_at": _now_iso()}}
        )
        
    if not is_captured:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Payment has not been captured yet")
        
    await db.ai_credit_purchases.update_one(
        {"id": purchase_id},
        {
            "$set": {
                "status": "captured",
                "captured_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        },
    )
    
    credits_added = int(purchase["credits_amount"])
    from datetime import datetime, timezone
    new_bucket = {
        "amount": credits_added,
        "type": "paid",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
    }
    
    user_record = await db.users.find_one({"id": user["id"]})
    if user_record:
        from app.models.credit import add_credit_bucket
        updated_buckets = user_record.get("credit_buckets", [])
        updated_buckets.append(new_bucket)
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"credit_buckets": updated_buckets}},
        )
        
        ai_config = user_record.get("ai_configuration", {})
        existing = int(ai_config.get("current_credits", 0))
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"ai_configuration.current_credits": existing + credits_added}},
        )
        try:
            from app.api.v1.atzmai import trigger_success_email
            import asyncio
            asyncio.create_task(
                trigger_success_email(
                    user_record=user_record,
                    amount_cents=int(purchase["amount_cents"]),
                    currency=purchase.get("currency", "USD"),
                    credits_purchased=credits_added,
                    atzmai_payment_id=purchase.get("paypal_order_id") or purchase_id
                )
            )
        except Exception as e:
            logger.error(f"Failed to dispatch thank-you email: {e}")
        
    final = await db.ai_credit_purchases.find_one({"id": purchase_id}, {"_id": 0})
    return {"ok": True, "purchase": final}


@ai_credits_router.get("/history")
async def credit_history(
    limit: int = 30, 
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get AI credit transaction history including bucket changes."""
    db = get_db()
    
    # Get purchases
    purchase_cursor = (
        db.ai_credit_purchases.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(max(1, min(200, limit)))
    )
    purchases = [d async for d in purchase_cursor]
    
    # Get token usage records for more detailed history
    usage_cursor = (
        db.token_usage.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(max(1, min(200, limit)))
    )
    token_usage = [d async for d in usage_cursor]
    
    return {
        "purchases": purchases,
        "token_usage": token_usage,
        "total_purchases": len(purchases),
        "total_usage_records": len(token_usage),
    }


@ai_credits_router.post("/use")
async def use_credits(
    request: CreditUsageRequest,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Use credits from oldest buckets first (free before paid)."""
    try:
        db = get_db()
        
        # Get user record
        user_record = await db.users.find_one({"id": user["id"]})
        if not user_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Convert to User model for bucket spending
        u_model = User.parse_obj(user_record)
        
        # Check if we have enough credits
        if u_model.total_credits < request.required_credits:
            return {
                "success": False,
                "error": "Insufficient credits",
                "message": f"You need {request.required_credits} credits but only have {u_model.total_credits} available.",
                "required": request.required_credits,
                "available": u_model.total_credits,
            }
        
        # Spend from buckets
        success, spent_details = u_model.spend_credits(request.required_credits, request.operation)
        
        if not success:
            return {"success": False, "error": "Failed to spend credits"}
        
        # Update database
        user_record["credit_buckets"] = [b.dict() for b in u_model.credit_buckets]
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"credit_buckets": user_record["credit_buckets"]}}
        )
        
        # Log each expenditure as a token_usage record
        from app.services.token_meter import TokenMeter, Provider, OperationType
        meter = TokenMeter(user["id"], request.operation)
        meter.input_tokens = 0  # Not tracked for spend-only operations
        meter.output_tokens = 0
        meter.provider = "N/A"
        meter.credits_consumed = request.required_credits
        meter.credit_type_used = "free" if any(d["type"]=="free" for d in spent_details) else "paid"
        
        await meter._save_token_usage(0, 0)
        
        return {
            "success": True,
            "operation": request.operation,
            "credits_used": request.required_credits,
            "details": spent_details,
            "message": f"Successfully used {request.required_credits} credits for {request.operation}",
        }
    except Exception as e:
        logger.error(f"Error using credits: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@ai_credits_router.get("/usage")
async def check_usage(
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Check current usage and credit availability."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        if not user_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        
        u_model = User.parse_obj(user_record)
        ai_config = user_record.get("ai_configuration", {})
        
        can_use = u_model.total_credits > 0
        
        return {
            "success": True,
            "user_id": user["id"],
            "available_credits": u_model.total_credits,
            "free_credits_available": sum(b["amount"] for b in user_record.get("credit_buckets", []) 
                                         if b["type"]=="free" and not (b.get("expires_at") and datetime.now().timestamp() > datetime.fromisoformat(b["expires_at"]).timestamp())),
            "paid_credits": sum(b["amount"] for b in user_record.get("credit_buckets", []) if b["type"]=="paid"),
            "daily_limit": ai_config.get("ai_daily_limit", 100),
            "monthly_limit": ai_config.get("ai_monthly_limit", 1000),
            "daily_used": ai_config.get("ai_daily_used", 0),
            "monthly_used": ai_config.get("ai_monthly_used", 0),
            "can_use": can_use,
            "upgrade_required": False if can_use else True,
        }
    except Exception as e:
        logger.error(f"Error checking usage: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@pricing_router.post("/subscription/upgrade")
async def upgrade_subscription(
    request: Dict[str, Any],
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Upgrade subscription and add bonus paid credits."""
    try:
        new_plan = request.get("plan_type")
        if not new_plan:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Plan type required")
        
        if new_plan not in ["pro", "business"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid plan: {new_plan}")
        
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        
        ai_config = user_record.get("ai_configuration", {})
        subscription_info = ai_config.get("subscription", {})
        
        # Update subscription
        subscription_info["plan_type"] = new_plan
        subscription_info["is_active"] = True
        
        from datetime import datetime, timezone
        bonus = 100 if new_plan == "pro" else 300
        new_bucket = {
            "amount": bonus,
            "type": "paid",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None,
        }
        
        user_record["credit_buckets"] = user_record.get("credit_buckets", [])
        user_record["credit_buckets"].append(new_bucket)
        
        # Update plan-specific limits
        if new_plan == "pro":
            ai_config["ai_monthly_limit"] = 1000
        elif new_plan == "business":
            ai_config["ai_monthly_limit"] = 3000
        
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "ai_configuration": ai_config,
                    "subscription": subscription_info,
                    "credit_buckets": user_record["credit_buckets"]
                }
            },
        )
        
        return {
            "success": True,
            "message": f"Successfully upgraded to {new_plan} plan with {bonus} bonus paid credits",
            "plan_type": new_plan,
            "bonus_credits_added": bonus,
        }
    except Exception as e:
        logger.error(f"Error upgrading subscription: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# Backward-compatible endpoints for existing frontend code
# ============================================================================

@ai_credits_router.get("/balance")
async def get_balance_compat(user: dict = Depends(get_current_user)) -> Dict:
    """Compat wrapper returning same structure as before."""
    return await get_balance(user)


@ai_credits_router.post("/purchase")
async def create_purchase_compat(payload: AiCreditPurchaseIn, user: dict = Depends(get_current_user)) -> Dict:
    return await create_purchase(payload, user)


@ai_credits_router.post("/purchase/{purchase_id}/capture")
async def capture_purchase_compat(purchase_id: str, user: dict = Depends(get_current_user)) -> Dict:
    return await capture_purchase(purchase_id, user)


@ai_credits_router.get("/history")
async def credit_history_compat(limit: int = 30, user: dict = Depends(get_current_user)) -> Dict:
    return await credit_history(limit, user)


@ai_credits_router.post("/rollover")
async def rollover_credits_compat(user: dict = Depends(get_current_user)) -> Dict:
    """Compat wrapper - now actually allocates daily free credits instead of just resetting counters."""
    # Apply daily free allocation (new behavior)
    try:
        result = await apply_daily_allocation(user)
        result["message"] = f"Daily free credits allocated: {result.get('credits_allocated', 10)} credits (expire in 30 days)"
        return result
    except Exception as e:
        logger.error(f"Compat rollover error: {e}")
        # Fallback to old behavior if needed
        db = get_db()
        ai_config = user.get("ai_configuration") or {}
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"ai_configuration.credits_used_this_month": 0, "ai_configuration.last_rolled_at": _now_iso()}},
        )
        return {"ok": True, "message": "Rollover completed (compat mode)"}


# Expose routers separately for inclusion in v1 router
__all__ = ["ai_credits_router", "pricing_router"]


# ============================================================================
# Trial Endpoints (exposed via ai_credits_router)
# ============================================================================

@ai_credits_router.post("/trial/pro/start")
async def start_pro_trial_endpoint(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start a 14-day Pro trial with 50 bonus credits."""
    try:
        result = await start_pro_trial(user["id"], days=14)
        return result
    except Exception as e:
        logger.error(f"Error starting pro trial: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@ai_credits_router.post("/trial/business/start")
async def start_business_trial_endpoint(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start a 30-day Business trial with 300 bonus credits and campaign slots."""
    try:
        result = await start_business_trial(user["id"], days=30)
        return result
    except Exception as e:
        logger.error(f"Error starting business trial: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@ai_credits_router.get("/trial/status")
async def get_trial_status(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check current trial status for the user."""
    try:
        result = await check_trial_expiration(user["id"])
        # Also get additional info from trial_info if available
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        if user_record and user_record.get("trial_info"):
            result["trial_info"] = user_record["trial_info"]
        return result
    except Exception as e:
        logger.error(f"Error checking trial status: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@quota_router.get("/status")
async def get_status(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current credit quota status with actionable messages for frontend."""
    from app.services.quota_manager import check_quota_status
    try:
        return await check_quota_status(user)
    except Exception as e:
        logger.error(f"Error getting quota status for user {user.get('id', 'unknown')}: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@quota_router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get global quota configuration thresholds for frontend UI rendering."""
    from app.services.quota_manager import get_quota_config
    try:
        return await get_quota_config()
    except Exception as e:
        logger.error(f"Error getting quota config: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))