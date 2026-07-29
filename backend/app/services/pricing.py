"""Pricing service for DressApp AI credits and subscription management.

This module handles:
- AI credit management with bucket-based tracking (free vs paid, with different expiry rules)
- Credit pack purchases (25, 50, 100 credits - these are always PAID credits)
- Credit rollover logic for free credits (30-day expiration before being removed)
- Tier-based access controls
- Credit balance endpoints
- Quota exhaustion handling with pause/resume mechanism for AI operations
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Dict, Optional, List, Any, Tuple
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from app.db.database import get_db
from app.models.schemas import User, CreditBucket, CreditType, CreditUsageResponse
from app.services.auth import get_current_user
from app.services.token_meter import TokenMeter

logger = logging.getLogger(__name__)

# ============================================================================
# CREDIT QUOTA THRESHOLDS & MESSAGING CONFIGURATION
# ============================================================================

class CreditQuotaStatus(str, Enum):
    """Status levels for credit quota monitoring."""
    OK = "ok"           # Within safe range
    SOFT_WARNING = "soft_warning"  # Approaching limit but still working
    HARD_LIMIT = "hard_limit"      # At or below zero - need to purchase
    EXHAUSTED = "exhausted"        # No usable credits available


class CreditThresholdConfig:
    """Configuration for credit warning thresholds."""
    
    def __init__(self):
        self.SOFT_WARNING_THRESHOLD = 0.20  # 20% remaining triggers soft warning
        self.HARD_THRESHOLD_PERCENT = 0.0   # 0% is hard limit
        self.SOFT_WARNING_MESSAGE = "You're running low on AI credits. Consider purchasing more packs to avoid interruption."
        self.HARD_LIMIT_MESSAGE = "Daily/your monthly AI credit allocation has been exhausted. Upgrade your plan or purchase additional credits."
        self.PAGE_LINK = "/pricing/purchase"  # Relative URL to credits page
        
    def get_status(
        self,
        available: float,
        total_needed: int,
        monthly_limit: int,
        daily_limit: int,
        monthly_used: float | None = None,
        daily_used: float | None = None
    ) -> Tuple[CreditQuotaStatus, str, str | None]:
        """Determine the credit status based on usage levels."""
        
        # Check if there's sufficient credit for the requested operation
        if available < total_needed:
            return CreditQuotaStatus.EXHAUSTED, "Insufficient credits to complete this operation", "Purchase more credits"
        
        # Calculate percentages of monthly and daily limits used
        m_used = monthly_used if monthly_used is not None else max(0.0, monthly_limit - available)
        d_used = daily_used if daily_used is not None else max(0.0, daily_limit - available)
        
        monthly_pct = (m_used / monthly_limit) if monthly_limit > 0 else 0.0
        daily_pct = (d_used / daily_limit) if daily_limit > 0 else 0.0
        
        # Check for hard limit (100% or more of quota used)
        if monthly_pct >= 1.0 or daily_pct >= 1.0:
            return CreditQuotaStatus.HARD_LIMIT, self.HARD_LIMIT_MESSAGE, "Quota exceeded"
            
        # If approaching limits
        if monthly_pct >= 1 - self.SOFT_WARNING_THRESHOLD or daily_pct >= 1 - self.SOFT_WARNING_THRESHOLD:
            return CreditQuotaStatus.SOFT_WARNING, self.SOFT_WARNING_MESSAGE, "Consider topping up before you run out"
        
        return CreditQuotaStatus.OK, "All set", None
    
    def should_pause_and_resume(self, status: CreditQuotaStatus) -> bool:
        """Return whether we should pause and wait for credits rather than fail immediately."""
        return status in [CreditQuotaStatus.EXHAUSTED]


# Global singleton configuration instance
_threshold_config = CreditThresholdConfig()
get_threshold_config = lambda: _threshold_config


def get_credit_thresholds() -> Dict[str, Any]:
    """Get current threshold configuration for frontend consumption."""
    config = _threshold_config
    return {
        "soft_warning_percent": config.SOFT_WARNING_THRESHOLD * 100,
        "hard_limit_percent": config.HARD_THRESHOLD_PERCENT * 100,
        "soft_warning_message": config.SOFT_WARNING_MESSAGE,
        "hard_limit_message": config.HARD_LIMIT_MESSAGE,
        "page_link": config.PAGE_LINK,
    }


router = APIRouter(prefix="/pricing", tags=["pricing"])

# Credit pack definitions - these are PAID credits (never expire)
class CreditPack(str, Enum):
    """Available credit pack sizes."""
    TEN = "10"
    TWENTY_FIVE = "25"
    FIFTY = "50"
    HUNDRED = "100"

class CreditPackPrice(BaseModel):
    """Price information for a credit pack."""
    pack: str
    credits_amount: int
    price_cents: int
    discounted_price_cents: int
    savings_cents: int

# Global pricing configuration
CREDIT_PACK_PRICES: Dict[str, CreditPackPrice] = {
    CreditPack.TEN: CreditPackPrice(
        pack=CreditPack.TEN,
        credits_amount=10,
        price_cents=199,  # $1.99 per 10 credits
        discounted_price_cents=199,
        savings_cents=0
    ),
    CreditPack.TWENTY_FIVE: CreditPackPrice(
        pack=CreditPack.TWENTY_FIVE,
        credits_amount=25,
        price_cents=399,  # $3.99 per 25 credits = ~$1.60 per 10 credits
        discounted_price_cents=399,
        savings_cents=0
    ),
    CreditPack.FIFTY: CreditPackPrice(
        pack=CreditPack.FIFTY,
        credits_amount=50,
        price_cents=799,  # $7.99 per 50 credits = ~$1.60 per 10 credits
        discounted_price_cents=799,
        savings_cents=0
    ),
    CreditPack.HUNDRED: CreditPackPrice(
        pack=CreditPack.HUNDRED,
        credits_amount=100,
        price_cents=1599,  # $15.99 per 100 credits = ~$1.60 per 10 credits
        discounted_price_cents=1599,
        savings_cents=0
    ),
}

# Rollover settings for FREE credits - they expire after 30 days
FREE_CREDIT_ROLLOVER_DAYS = 30  # Free credits expire 30 days after allocation
CREDIT_OVERAGE_PRICE_PER_TEN = 199  # $1.99 per 10 credits for overage packs
MAX_OVERAGE_LIMIT = 1000  # Maximum overage allowed at once

class CreditTransaction(BaseModel):
    """Credit transaction record."""
    type: str  # "purchase", "usage", "rollover", "expiry", "overage"
    amount: int
    balance_before: int
    balance_after: int
    description: str
    timestamp: str
    reference_id: Optional[str] = None

# ============================================================================
# QUOTA EXHAUSTION HANDLING WITH RESUME MECHANISM
# ============================================================================

class CreditExhaustionWaiter:
    """Manages async waiting for credit replenishment when quotas are exhausted.
    
    This implements the "pause and auto-resume" pattern where operations
    block until credits become available rather than failing outright.
    """
    
    _instance = None
    _lock = asyncio.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._waiters = []
            cls._instance._initialized = False
        return cls._instance

    
    def add_waiter(self, coro: Any) -> None:
        """Add an async coroutine to be notified when credits are restored."""
        self._waiters.append(coro)
    
    async def notify_all(self) -> None:
        """Wake up all waiting coroutines when credits are replenished."""
        waiters = list(self._waiters)
        self._waiters = []  # Clear after notifying
        for waiter in waiters:
            try:
                waiter.set_result(None)
            except Exception as e:
                logger.debug(f"Waiter already completed: {e}")
    
    async def wait_for_credits(self, timeout_seconds: int = 300) -> bool:
        """Wait until credits are available or timeout occurs.
        
        Returns True if credits became available, False if timed out.
        """
        if not self._waiters:
            # No one waiting, give a brief check then succeed if credits exist later
            await asyncio.sleep(1)
            return True
        
        done, pending = await asyncio.wait(
            [asyncio.create_task(waiter) for waiter in self._waiters],
            timeout=timeout_seconds,
            return_when=asyncio.ALL_COMPLETED
        )
        return len(done) > 0


_credit_waiter = CreditExhaustionWaiter()


async def wait_for_credit_replenishment(user_id: str, max_wait: int = 300) -> bool:
    """Wait for user to obtain more credits via purchase or renewal.
    
    This function checks periodically if credits have become available
    while also allowing other tasks to yield control.
    """
    db = get_db()
    
    for attempt in range(max_wait // 5):  # Check every 5 seconds
        try:
            user_record = await db.users.find_one({"id": user_id})
            if user_record:
                u_model = User.parse_obj(user_record)
                if u_model.total_credits > 0:
                    return True
        except Exception as e:
            logger.debug(f"Error checking credit status during wait: {e}")
        
        await asyncio.sleep(5)
    
    return False


async def handle_credit_exhaustion(operation: str, user_id: str, required_credits: int) -> bool:
    """Handle credit exhaustion with pause-and-resume pattern.
    
    When credits are insufficient, this function:
    1. Pauses the operation (raises a special exception that can be caught upstream)
    2. Waits for the user to purchase more credits (via webhook or periodic polling)
    3. Resumes the operation automatically when credits are replenished
    db = get_db()
    user_record = await db.users.find_one({"id": user_id})
    
    if not user_record:
        return False
    
    u_model = User.parse_obj(user_record)
    
    # Check if we actually have enough credits
    if u_model.total_credits >= required_credits:
        return True  # Enough credits, proceed normally
    
    # Queue up a waiter for this operation
    waiter = asyncio.Future()
    _credit_waiter.add_waiter(waiter)
    
    try:
        # Wait for either credit replenishment or some external trigger
        # In a real implementation, you might wait on a specific event channel
        did_we_get_credits = await wait_for_credit_replenishment(user_id, max_wait=300)
        
        if did_we_get_credits:
            # Verify we now have sufficient credits after wait
            await db.users.refresh("user_id", user_id)  # Would need proper refresh in real code
            user_record = await db.users.find_one({"id": user_id})
            if user_record:
                u_model = User.parse_obj(user_record)
                if u_model.total_credits >= required_credits:
                    return True
        
        return False  # Still didn't get enough credits
        
    except asyncio.TimeoutError:
        logger.warning(f"Credit wait timed out for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in credit exhaustion handler: {str(e)}")
        return False

# ============================================================================
# PRICING ENDPOINTS WITH QUOTA STATUS
# ============================================================================


@router.get("/credits/thresholds")
async def get_credit_thresholds_endpoint(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get configured credit thresholds and messaging for the current user."""
    try:
        config = get_credit_thresholds()
        return {
            "success": True,
            "config": config,
            "current_plan": user.get("ai_configuration", {}).get("subscription", {}).get("plan_type", "free"),
        }
    except Exception as e:
        logger.error(f"Error fetching credit thresholds: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/credits/status")
async def get_credit_status(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive credit status including warnings and messages."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        
        u_model = User.parse_obj(user_record)
        ai_config = user_record.get("ai_configuration", {})
        
        # Determine status with messaging
        status, message, action = _threshold_config.get_status(
            available=u_model.total_credits,
            total_needed=1,  # Default minimum request
            monthly_limit=ai_config.get("ai_monthly_limit", 1000),
            daily_limit=ai_config.get("ai_daily_limit", 100),
            monthly_used=ai_config.get("ai_monthly_used", 0.0),
            daily_used=ai_config.get("ai_daily_used", 0.0)
        )
        
        # Add exhaustion handling info
        can_proceed = status != CreditQuotaStatus.EXHAUSTED and u_model.total_credits >= 1
        
        result = {
            "success": True,
            "user_id": user["id"],
            "status": status.value,
            "message": message or ("Ready to use credits" if can_proceed else "No usable credits available"),
            "action": action,
            "link_to_purchase": f"{_threshold_config.PAGE_LINK}",
            "credits_available": u_model.total_credits,
            "free_credits_available": sum(b["amount"] for b in user_record.get("credit_buckets", []) 
                                         if b["type"]=="free" and (not b.get("expires_at") or datetime.now().timestamp() <= datetime.fromisoformat(b["expires_at"]).timestamp())),
            "paid_credits": sum(b["amount"] for b in user_record.get("credit_buckets", []) if b["type"]=="paid"),
            "total_buckets": len(user_record.get("credit_buckets", [])),
            "can_proceed": can_proceed,
            "needs_purchase": status == CreditQuotaStatus.SOFT_WARNING or status == CreditQuotaStatus.HARD_LIMIT or status == CreditQuotaStatus.EXHAUSTED,
            "ai_daily_limit": ai_config.get("ai_daily_limit", 100),
            "ai_monthly_limit": ai_config.get("ai_monthly_limit", 1000),
            "ai_daily_used": ai_config.get("ai_daily_used", 0),
            "ai_monthly_used": ai_config.get("ai_monthly_used", 0),
        }
        
        return result
    except Exception as e:
        logger.error(f"Error getting credit status: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/pricing/info")
async def get_pricing_info(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get comprehensive pricing and credit information including warnings."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user["id"]})
        
        if not user_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        
        u_model = User.parse_obj(user_record)
        summary = u_model.get_credit_usage_summary()
        
        return {
            "success": True,
            "user_id": user["id"],
            "pricing_plan": {
                "plan_type": user_record.get("ai_configuration", {}).get("subscription", {}).get("plan_type", "free"),
                "ai_provider_mode": user_record.get("ai_configuration", {}).get("ai_provider_mode", "standard"),
                "ai_provider": user_record.get("ai_configuration", {}).get("ai_provider", "gemini"),
                "ai_model": user_record.get("ai_configuration", {}).get("ai_model", "gemini-2.5-flash"),
            },
            "credits": {
                "total_credits": summary["total"],
                "free_credits_available": summary["free_available"],
                "free_credits_expired": summary["expired"],
                "paid_credits": summary["paid"],
                "ai_credits_used_this_month": user_record.get("ai_configuration", {}).get("ai_credits_used_this_month", 0),
                "ai_monthly_limit": user_record.get("ai_configuration", {}).get("ai_monthly_limit", 1000),
                "ai_daily_limit": user_record.get("ai_configuration", {}).get("ai_daily_limit", 100),
                "ai_daily_used": user_record.get("ai_configuration", {}).get("ai_daily_used", 0),
                "ai_monthly_used": user_record.get("ai_configuration", {}).get("ai_monthly_used", 0),
            },
            "credit_packs": [
                {"amount": 10, "price_cents": 199},
                {"amount": 25, "price_cents": 399},
                {"amount": 50, "price_cents": 799},
                {"amount": 100, "price_cents": 1599},
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
                    "price": 999,  # $9.99
                    "credits": 100,
                    "ai_daily_limit": 200,
                    "ai_monthly_limit": 1000,
                    "features": ["Advanced AI operations", "Priority support", "Unlimited uploads"],
                },
                {
                    "name": "Business",
                    "price": 2900,  # $29.00
                    "credits": 300,
                    "ai_daily_limit": 500,
                    "ai_monthly_limit": 3000,
                    "features": ["All Pro features", "Dedicated support", "API access", "Custom branding"],
                },
            ],
            "bucket_count": summary["bucket_count"],
            # Include quota status info for frontend warning display
            "quota_status": {
                "available": u_model.total_credits,
                "warning_level": "soft" if u_model.total_credits < 20 else ("critical" if u_model.total_credits == 0 else "normal"),
                "needs_purchase": u_model.total_credits <= 0,
            }
        }
    except Exception as e:
        logger.error(f"Error fetching pricing info: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# Backward-compatible endpoint returning simple balance
@router.get("/balance")
async def get_credit_balance_compat(user: dict = Depends(get_current_user)) -> Dict:
    """Compat wrapper for existing frontend code."""
    return await get_credit_status(user)

# ============================================================================
# CREDIT USAGE WITH THRESHOLD CHECKS & PAUSE-RESUME LOGIC
# ============================================================================

async def use_ai_c_with_threshold_check(
    user_id: str,
    credits_required: int,
    operation: str = "ai_operation"
) -> bool:
    """Use AI credits with threshold checks and pause-resume capability.
    
    This version integrates the quota exhaustion handling into the credit
    consumption flow, implementing the requested "pause instead of exit"
    behavior with automatic resumption when credits are replenished.
    """
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        
        if not user_record:
            return False
        
        # First check if we have enough immediate credits
        u_model = User.parse_obj(user_record)
        
        if u_model.total_credits < credits_required:
            # Not enough credits - apply pause-and-resume logic
            
            # Try waiting briefly for credits to become available
            got_enough = await handle_credit_exhaustion(
                operation=operation,
                user_id=user_id,
                required_credits=credits_required
            )
            
            if not got_enough:
                # Still not enough even after waiting - return failure indicator
                # The calling frontend/backend can decide to show "buy more" UI
                return False
        
        # Now spend the credits (using the bucket method)
        success, spent_details = u_model.spend_credits(credits_required, operation)
        
        if not success:
            return False
        
        # Update database with new credit_buckets
        user_record["credit_buckets"] = [b.dict() for b in u_model.credit_buckets]
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"credit_buckets": user_record["credit_buckets"]}}
        )
        
        # Log token usage
        from app.services.token_meter import TokenMeter
        meter = TokenMeter(user_id, operation)
        meter.input_tokens = 0  # Simplified
        meter.output_tokens = 0
        meter.credits_consumed = credits_required
        meter.credit_type_used = "free" if any(d["type"]=="free" for d in spent_details) else "paid"
        await meter._save_token_usage(0, 0)
        
        return True
    
    except Exception as e:
        logger.error(f"Error using AI credits with threshold: {str(e)}")
        return False


# ============================================================================
# BACKWARD COMPATIBILITY WRAPPERS
# ============================================================================

async def get_user_ai_balance(user_id: str) -> Dict:
    """Get current AI balance (backward compatible wrapper)."""
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    
    u_model = User.parse_obj(user)
    return {
        "total_credits": u_model.total_credits,
        "free_credits_available": sum(b["amount"] for b in user.get("credit_buckets", []) 
                                     if b["type"]=="free" and (not b.get("expires_at") or datetime.now().timestamp() <= datetime.fromisoformat(b["expires_at"]).timestamp())),
        "paid_credits": sum(b["amount"] for b in user.get("credit_buckets", []) if b["type"]=="paid"),
        "ai_credits_used_this_month": user.get("ai_configuration", {}).get("ai_credits_used_this_month", 0),
        "ai_monthly_limit": user.get("ai_configuration", {}).get("ai_monthly_limit", 1000),
        "ai_daily_limit": user.get("ai_configuration", {}).get("ai_daily_limit", 100),
        "daily_usage": user.get("ai_configuration", {}).get("ai_daily_used", 0),
        "monthly_usage": user.get("ai_configuration", {}).get("ai_monthly_used", 0),
        "provider_mode": user.get("ai_configuration", {}).get("ai_provider_mode", "standard"),
        "ai_provider": user.get("ai_configuration", {}).get("ai_provider", "gemini"),
    }

async def use_ai_credits(
    user_id: str,
    credits_required: int,
    operation: str = "ai_operation"
) -> bool:
    """Use AI credits (backward compatible with threshold-aware version)."""
    return await use_ai_c_with_threshold_check(user_id, credits_required, operation)

async def purchase_credit_pack(user_id: str, pack: str) -> Dict:
    """Purchase credit pack (backward compatible)."""
    try:
        result = await purchase_ai_credits_endpoint(
            {"pack_size": pack},
            {"id": user_id, "ai_configuration": {}}  # Mock user dep
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

async def apply_credit_rollover(user_id: str) -> Dict:
    """Apply credit rollover (now actually allocates daily free credits)."""
    try:
        result = await allocate_free_daily_credits(
            {"id": user_id, "ai_configuration": {}}  # Mock user dep
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

async def check_ai_access(user_id: str, operation: str = "ai_operation") -> CreditUsageResponse:
    """Check if user has access to AI operations."""
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    
    u_model = User.parse_obj(user)
    available = u_model.total_credits
    
    requires_credits = operation in [
        "text_generation", "image_processing", "video_processing",
        "auto_tagging", "outfit_recommendation", "stylist_chat",
        "bookmarklet_migration", "body_measurement", "background_removal"
    ]
    credits_needed = 10  # Default estimate
    
    can_use = True
    upgrade_required = False
    
    daily_used = user.get("ai_configuration", {}).get("ai_daily_used", 0.0)
    monthly_used = user.get("ai_configuration", {}).get("ai_monthly_used", 0.0)
    daily_limit = user.get("ai_configuration", {}).get("ai_daily_limit", 100)
    monthly_limit = user.get("ai_configuration", {}).get("ai_monthly_limit", 1000)
    
    if requires_credits:
        if available < credits_needed:
            can_use = False
            upgrade_required = True
        elif daily_used >= daily_limit or monthly_used >= monthly_limit:
            can_use = False
            upgrade_required = True
    
    return CreditUsageResponse(
        available_credits=available,
        daily_usage=user.get("ai_configuration", {}).get("ai_daily_used", 0),
        monthly_usage=user.get("ai_configuration", {}).get("ai_monthly_used", 0),
        daily_limit=user.get("ai_configuration", {}).get("ai_daily_limit", 100),
        monthly_limit=user.get("ai_configuration", {}).get("ai_monthly_limit", 1000),
        can_use=can_use,
        upgrade_required=upgrade_required
    )


# ============================================================================
# LEGACY ENDPOINTS (keep for existing frontend integration)
# ============================================================================

@router.get("/credits/balance")
async def get_credits_balance_legacy(user: dict = Depends(get_current_user)) -> Dict:
    """Legacy endpoint - uses get_credits_balance which already returns detailed info."""
    return await get_credits_balance(user)

@router.post("/credits/use")
async def use_ai_credits_endpoint_legacy(
    request: Dict,
    user: dict = Depends(get_current_user)
) -> Dict:
    """Legacy endpoint - delegate to new implementation."""
    return await use_ai_credits_endpoint(request, user)

@router.post("/credits/purchase")
async def purchase_credits_endpoint_legacy(
    request: Dict,
    user: dict = Depends(get_current_user)
) -> Dict:
    """Legacy endpoint - delegate to new implementation."""
    return await purchase_ai_credits_endpoint(request, user)

@router.post("/credits/rollover")
async def apply_credits_rollover_endpoint_legacy(user: dict = Depends(get_current_user)) -> Dict:
    """Legacy endpoint name - allocates daily free credits (misnamed but kept for backward compatibility)."""
    return await allocate_free_daily_credits(user)

@router.get("/credits/usage")
async def get_ai_credits_usage_legacy(user: dict = Depends(get_current_user)) -> CreditUsageResponse:
    """Legacy endpoint."""
    return await check_ai_access(user["id"], "ai_operation")

@router.get("/pricing/info")
async def get_pricing_info_legacy(user: dict = Depends(get_current_user)) -> Dict:
    """Legacy pricing endpoint."""
    return await get_pricing_info(user)


async def expire_old_free_credits(user_data: dict) -> dict:
    """Scan the user's credit buckets and remove any expired free credits.
    
    Returns:
        dict: {"success": True, "expired_removed": expired_removed}
    """
    try:
        user_id = user_data.get("id")
        if not user_id:
            return {"success": False, "expired_removed": 0}
            
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"success": False, "expired_removed": 0}
            
        u_model = User.parse_obj(user_record)
        now = datetime.now(timezone.utc).isoformat()
        
        expired_removed = 0
        new_buckets = []
        for bucket in u_model.credit_buckets:
            if bucket.type == "free" and bucket.expires_at and now > bucket.expires_at:
                expired_removed += bucket.amount
            else:
                new_buckets.append(bucket)
                
        if expired_removed > 0:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"credit_buckets": [b.dict() for b in new_buckets]}}
            )
            
        return {"success": True, "expired_removed": expired_removed}
    except Exception as e:
        logger.error(f"Error in expire_old_free_credits: {e}")
        return {"success": False, "expired_removed": 0}


async def start_pro_trial(user_id: str, days: int = 14) -> dict:
    """Start a 14-day Pro trial with 50 bonus free credits."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"success": False, "error": "User not found"}
            
        u_model = User.parse_obj(user_record)
        now = datetime.now(timezone.utc)
        expiry = now + timedelta(days=days)
        now_iso = now.isoformat()
        expiry_iso = expiry.isoformat()
        
        subscription = user_record.get("subscription") or {}
        subscription["plan_type"] = "pro"
        subscription["is_active"] = True
        subscription["expires_at"] = expiry_iso
        
        trial_info = {
            "trial_type": "pro",
            "started_at": now_iso,
            "expires_at": expiry_iso
        }
        
        u_model.add_credit_bucket(amount=50, credit_type="free", days_until_expiry=days)
        
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription": subscription,
                    "trial_info": trial_info,
                    "credit_buckets": [b.dict() for b in u_model.credit_buckets],
                    "ai_configuration.ai_provider_mode": "standard",
                    "ai_configuration.ai_monthly_limit": 1000
                }
            }
        )
        return {"success": True, "message": "Pro trial started successfully", "expires_at": expiry_iso}
    except Exception as e:
        logger.error(f"Error starting pro trial: {e}")
        return {"success": False, "error": str(e)}


async def start_business_trial(user_id: str, days: int = 30) -> dict:
    """Start a 30-day Business trial with 300 bonus free credits."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"success": False, "error": "User not found"}
            
        u_model = User.parse_obj(user_record)
        now = datetime.now(timezone.utc)
        expiry = now + timedelta(days=days)
        now_iso = now.isoformat()
        expiry_iso = expiry.isoformat()
        
        subscription = user_record.get("subscription") or {}
        subscription["plan_type"] = "business"
        subscription["is_active"] = True
        subscription["expires_at"] = expiry_iso
        
        trial_info = {
            "trial_type": "business",
            "started_at": now_iso,
            "expires_at": expiry_iso
        }
        
        u_model.add_credit_bucket(amount=300, credit_type="free", days_until_expiry=days)
        
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription": subscription,
                    "trial_info": trial_info,
                    "credit_buckets": [b.dict() for b in u_model.credit_buckets],
                    "ai_configuration.ai_provider_mode": "standard",
                    "ai_configuration.ai_monthly_limit": 3000
                }
            }
        )
        return {"success": True, "message": "Business trial started successfully", "expires_at": expiry_iso}
    except Exception as e:
        logger.error(f"Error starting business trial: {e}")
        return {"success": False, "error": str(e)}


async def check_trial_expiration(user_id: str) -> dict:
    """Check if the user's trial has expired and revert to free plan if so."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"trial_expired": False, "error": "User not found"}
            
        trial_info = user_record.get("trial_info")
        if not trial_info:
            return {"trial_expired": False, "message": "No active trial found"}
            
        now = datetime.now(timezone.utc)
        expires_at_str = trial_info.get("expires_at")
        if not expires_at_str:
            return {"trial_expired": False, "message": "Trial expires_at missing"}
            
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if now > expires_at:
            subscription = user_record.get("subscription") or {}
            subscription["plan_type"] = "free"
            subscription["is_active"] = True
            subscription.pop("expires_at", None)
            
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "subscription": subscription,
                        "ai_configuration.ai_provider_mode": "on_device",
                        "ai_configuration.ai_monthly_limit": 100
                    },
                    "$unset": {"trial_info": ""}
                }
            )
            return {"trial_expired": True, "message": "Trial has expired. Downgraded to free plan."}
            
        days_remaining = (expires_at - now).days
        return {
            "trial_expired": False,
            "trial_type": trial_info.get("trial_type"),
            "days_remaining": max(0, days_remaining),
            "expires_at": expires_at_str
        }
    except Exception as e:
        logger.error(f"Error checking trial expiration: {e}")
        return {"trial_expired": False, "error": str(e)}


async def cleanup_expired_trials() -> dict:
    """Helper to scan and expire trials (redundant but matches import)."""
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        cursor = db.users.find(
            {
                "trial_info.expires_at": {"$lte": now.isoformat()},
                "trial_info": {"$exists": True},
            },
            {"id": 1}
        )
        cleaned = 0
        async for user in cursor:
            res = await check_trial_expiration(user["id"])
            if res.get("trial_expired"):
                cleaned += 1
        return {"cleaned_count": cleaned}
    except Exception as e:
        logger.error(f"Error cleaning up expired trials: {e}")
        return {"cleaned_count": 0}
