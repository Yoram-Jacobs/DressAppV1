"""Pricing API endpoints for DressApp."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.pricing import (
    get_user_ai_balance,
    use_ai_credits,
    purchase_credit_pack,
    apply_credit_rollover,
    check_ai_access,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pricing", tags=["pricing"])

@router.get("/pricing-info")
async def get_pricing_info(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get user's current pricing plan and AI credit information."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        ai_config = user_record.get("ai_configuration", {})
        
        return {
            "success": True,
            "user_id": user["id"],
            "pricing_plan": {
                "current_plan": ai_config.get("subscription", {}).get("plan_type", "free"),
                "ai_provider_mode": ai_config.get("ai_provider_mode", "standard"),
                "ai_provider": ai_config.get("ai_provider", "gemini"),
                "ai_model": ai_config.get("ai_model", "gemini-2.5-flash"),
            },
            "credits": {
                "total_credits": ai_config.get("ai_credits", 0),
                "ai_credits_used_this_month": ai_config.get("ai_credits_used_this_month", 0),
                "ai_monthly_limit": ai_config.get("ai_monthly_limit", 1000),
                "ai_daily_limit": ai_config.get("ai_daily_limit", 100),
                "ai_daily_used": ai_config.get("ai_daily_used", 0),
                "ai_monthly_used": ai_config.get("ai_monthly_used", 0),
            },
            "credit_packs": [
                {"amount": 10, "price": 1.99},
                {"amount": 25, "price": 3.99},
                {"amount": 50, "price": 7.99},
                {"amount": 100, "price": 15.99},
            ],
            "pricing_tiers": [
                {
                    "name": "Free",
                    "price": 0,
                    "credits": 10,
                    "ai_daily_limit": 20,
                    "ai_monthly_limit": 100,
                    "features": ["Basic AI operations", "Community support"],
                },
                {
                    "name": "Pro",
                    "price": 9.99,
                    "credits": 100,
                    "ai_daily_limit": 200,
                    "ai_monthly_limit": 1000,
                    "features": ["Advanced AI operations", "Priority support", "Unlimited uploads"],
                },
                {
                    "name": "Business",
                    "price": 29.99,
                    "credits": 300,
                    "ai_daily_limit": 500,
                    "ai_monthly_limit": 3000,
                    "features": ["All Pro features", "Dedicated support", "API access", "Custom branding"],
                },
            ],
        }
        
    except Exception as e:
        logger.error(f"Error fetching pricing info: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/credits/balance")
async def get_ai_credits_balance(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current user's AI credits balance and usage information."""
    try:
        balance_info = await get_user_ai_balance(user["id"])
        
        return {
            "success": True,
            "user_id": user["id"],
            "credits": {
                "total_credits": balance_info["total_credits"],
                "ai_credits_used_this_month": balance_info["ai_credits_used_this_month"],
                "ai_monthly_limit": balance_info["ai_monthly_limit"],
                "ai_daily_limit": balance_info["ai_daily_limit"],
                "daily_usage": balance_info["daily_usage"],
                "monthly_usage": balance_info["monthly_usage"],
                "can_use_more": balance_info["total_credits"] > 0,
            },
            "usage_percentage": round((balance_info["monthly_usage"] / balance_info["ai_monthly_limit"]) * 100, 2),
        }
        
    except Exception as e:
        logger.error(f"Error fetching AI credits balance: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/credits/use")
async def use_ai_credits_endpoint(
    request: Dict[str, Any],
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Use AI credits for an operation."""
    try:
        credits_required = request.get("credits", 10)
        operation = request.get("operation", "ai_operation")
        
        if credits_required <= 0:
            raise HTTPException(status_code=400, detail="Credits required must be positive")
        
        success = await use_ai_credits(user["id"], credits_required, operation)
        
        if not success:
            return {
                "success": False,
                "error": "Insufficient credits",
                "message": f"You need {credits_required} credits but only have {await get_user_ai_balance(user['id'])['total_credits']} available.",
                "required_credits": credits_required,
                "available_credits": await get_user_ai_balance(user['id'])['total_credits'],
            }
        
        return {
            "success": True,
            "operation": operation,
            "credits_used": credits_required,
            "message": f"Successfully used {credits_required} credits for {operation}",
        }
        
    except Exception as e:
        logger.error(f"Error using AI credits: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/credits/purchase")
async def purchase_ai_credits_endpoint(
    request: Dict[str, Any],
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Purchase AI credits pack."""
    try:
        pack_size = request.get("pack_size")
        if not pack_size:
            raise HTTPException(status_code=400, detail="Pack size is required")
        
        result = await purchase_credit_pack(user["id"], pack_size)
        
        return result
        
    except Exception as e:
        logger.error(f"Error purchasing AI credits: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/credits/rollover")
async def apply_credits_rollover_endpoint(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Apply credit rollover for unused daily credits."""
    try:
        result = await apply_credit_rollover(user["id"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error applying credit rollover: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/credits/usage")
async def get_ai_credits_usage_endpoint(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check AI credits usage and limits."""
    try:
        usage_info = await check_ai_access(user["id"], "ai_operation")
        
        return {
            "success": True,
            "credits_info": usage_info.dict(),
        }
        
    except Exception as e:
        logger.error(f"Error checking AI credits usage: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/subscription/upgrade")
async def upgrade_subscription_endpoint(
    request: Dict[str, Any],
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Upgrade user subscription to a higher tier."""
    try:
        new_plan = request.get("plan_type")
        if not new_plan:
            raise HTTPException(status_code=400, detail="Plan type is required")
        
        if new_plan not in ["pro", "business"]:
            raise HTTPException(status_code=400, detail=f"Invalid plan type: {new_plan}")
        
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        ai_config = user_record.get("ai_configuration", {})
        subscription_info = ai_config.get("subscription", {})
        
        # Update subscription plan
        subscription_info["plan_type"] = new_plan
        subscription_info["is_active"] = True
        
        # Update AI configuration based on plan
        if new_plan == "pro":
            ai_config["ai_provider_mode"] = "standard"
            ai_config["ai_credits"] = ai_config.get("ai_credits", 0) + 100
            ai_config["ai_monthly_limit"] = 1000
        elif new_plan == "business":
            ai_config["ai_provider_mode"] = "standard"
            ai_config["ai_credits"] = ai_config.get("ai_credits", 0) + 300
            ai_config["ai_monthly_limit"] = 3000
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"ai_configuration": ai_config, "subscription": subscription_info}}
        )
        
        return {
            "success": True,
            "message": f"Subscription upgraded to {new_plan} plan successfully",
            "plan_type": new_plan,
        }
        
    except Exception as e:
        logger.error(f"Error upgrading subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/subscription/downgrade")
async def downgrade_subscription_endpoint(
    request: Dict[str, Any],
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Downgrade user subscription to a lower tier."""
    try:
        new_plan = request.get("plan_type")
        if not new_plan:
            raise HTTPException(status_code=400, detail="Plan type is required")
        
        if new_plan not in ["free", "pro"]:
            raise HTTPException(status_code=400, detail=f"Invalid plan type: {new_plan}")
        
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        ai_config = user_record.get("ai_configuration", {})
        subscription_info = ai_config.get("subscription", {})
        
        # Update subscription plan
        subscription_info["plan_type"] = new_plan
        subscription_info["is_active"] = True
        
        # Update AI configuration based on plan
        if new_plan == "free":
            ai_config["ai_provider_mode"] = "on_device"
            ai_config["ai_credits"] = ai_config.get("ai_credits", 0)
            ai_config["ai_monthly_limit"] = 100
        elif new_plan == "pro":
            ai_config["ai_provider_mode"] = "standard"
            ai_config["ai_credits"] = ai_config.get("ai_credits", 0)
            ai_config["ai_monthly_limit"] = 1000
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"ai_configuration": ai_config, "subscription": subscription_info}}
        )
        
        return {
            "success": True,
            "message": f"Subscription downgraded to {new_plan} plan successfully",
            "plan_type": new_plan,
        }
        
    except Exception as e:
        logger.error(f"Error downgrading subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/subscription/status")
async def get_subscription_status_endpoint(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current user's subscription status."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        ai_config = user_record.get("ai_configuration", {})
        subscription_info = ai_config.get("subscription", {})
        
        return {
            "success": True,
            "subscription_status": {
                "plan_type": subscription_info.get("plan_type", "free"),
                "is_active": subscription_info.get("is_active", False),
                "stripe_subscription_id": subscription_info.get("stripe_subscription_id"),
                "paypal_subscription_id": subscription_info.get("paypal_subscription_id"),
                "expires_at": subscription_info.get("expires_at"),
                "cancelled_at": subscription_info.get("cancelled_at"),
            },
            "ai_configuration": {
                "ai_provider_mode": ai_config.get("ai_provider_mode", "standard"),
                "ai_provider": ai_config.get("ai_provider", "gemini"),
                "ai_model": ai_config.get("ai_model", "gemini-2.5-flash"),
                "ai_credits": ai_config.get("ai_credits", 0),
                "ai_credits_used_this_month": ai_config.get("ai_credits_used_this_month", 0),
                "ai_monthly_limit": ai_config.get("ai_monthly_limit", 1000),
            },
        }
        
    except Exception as e:
        logger.error(f"Error fetching subscription status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/subscription/cancel")
async def cancel_subscription_endpoint(
    request: Dict[str, Any],
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Cancel user subscription."""
    try:
        cancel_immediately = request.get("cancel_immediately", False)
        
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        ai_config = user_record.get("ai_configuration", {})
        subscription_info = ai_config.get("subscription", {})
        
        # Update subscription
        subscription_info["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        subscription_info["is_active"] = not cancel_immediately
        
        # Downgrade to free if cancelling immediately
        if cancel_immediately:
            subscription_info["plan_type"] = "free"
            ai_config["ai_provider_mode"] = "on_device"
            ai_config["ai_credits"] = ai_config.get("ai_credits", 0)
            ai_config["ai_monthly_limit"] = 100
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"ai_configuration": ai_config, "subscription": subscription_info}}
        )
        
        return {
            "success": True,
            "message": "Subscription cancelled successfully",
            "plan_type": subscription_info.get("plan_type"),
        }
        
    except Exception as e:
        logger.error(f"Error cancelling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

import datetime
import time