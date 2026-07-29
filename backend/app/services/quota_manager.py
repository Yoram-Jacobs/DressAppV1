"""Quota management service for credit exhaustion handling with pause-and-resume pattern.

This module provides utilities for checking credit availability before operations
and implementing the requested "pause instead of fail" behavior when quotas are exhausted.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple

from app.db.database import get_db
from app.services.auth import get_current_user
from app.models.schemas import User
from app.services.pricing import (
    CreditQuotaStatus, 
    use_ai_c_with_threshold_check,
    get_credit_thresholds,
    _threshold_config,
)

logger = logging.getLogger(__name__)


class QuotaExhaustionError(Exception):
    """Raised when operation cannot proceed due to credit exhaustion.
    
    This exception can be caught by upstream callers who implement retry/pause logic.
    """
    def __init__(self, message: str, status: CreditQuotaStatus, details: Dict[str, Any] = None):
        self.message = message
        self.status = status
        self.details = details or {}
        super().__init__(message)


async def check_operation_quota(user_id: str, required_credits: int = 1, operation: str = "ai_operation") -> Tuple[bool, CreditQuotaStatus, str]:
    """Check if the user has sufficient credits for an operation.
    
    Returns a tuple of:
    - (can_proceed: bool, status: CreditQuotaStatus, message: str)
    
    This checks both available balance and usage limits without deducting.
    """
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        
        if not user_record:
            return False, CreditQuotaStatus.EXHAUSTED, "User not found"
        
        u_model = User.parse_obj(user_record)
        ai_config = user_record.get("ai_configuration", {})
        
        # Check if we have enough raw credit balance
        if u_model.total_credits < required_credits:
            # Check if we can wait/resume - this is where pause happens
            got_enough = await _handle_exhaustion_with_resume(user_id, required_credits, operation)
            if not got_enough:
                return False, CreditQuotaStatus.EXHAUSTED, "No usable credits available after waiting"
        
        # Check daily/monthly quotas
        daily_limit = ai_config.get("ai_daily_limit", 100)
        monthly_limit = ai_config.get("ai_monthly_limit", 1000)
        
        # In a real implementation, you'd check actual usage logs against limits
        # For now, assume we pass this check if we have credit balance
        
        # Determine status with messaging
        status, message, action = _threshold_config.get_status(
            available=u_model.total_credits,
            total_needed=required_credits,
            monthly_limit=monthly_limit,
            daily_limit=daily_limit,
            monthly_used=ai_config.get("ai_monthly_used", 0.0),
            daily_used=ai_config.get("ai_daily_used", 0.0)
        )
        
        can_proceed = status != CreditQuotaStatus.EXHAUSTED and u_model.total_credits >= required_credits
        return can_proceed, status, message or "Operation ready to proceed"
        
    except Exception as e:
        logger.error(f"Error checking quota: {str(e)}")
        return False, CreditQuotaStatus.EXHAUSTED, f"System error checking quota: {str(e)}"


async def _handle_exhaustion_with_resume(user_id: str, required_credits: int, operation: str) -> bool:
    """Handle credit exhaustion using the pause-and-resume pattern.
    
    Instead of failing immediately, this function waits for credits to become
    available (via purchase, renewal, or rollover) up to a timeout period.
    """
    from app.services.billing_service import get_user_balance
    
    # Try briefly waiting for credits to appear
    did_we_get_credits = await _wait_for_credit_replenishment(user_id, max_wait=60)  # 1 minute timeout
    
    if not did_we_get_credits:
        # Timeout reached - still no credits, raise appropriate status
        # Upstream caller should handle displaying "buy more" UI
        return False
    
    # After waiting, verify we now have enough credits
    db = get_db()
    user_record = await db.users.find_one({"id": user_id})
    if user_record:
        u_model = User.parse_obj(user_record)
        if u_model.total_credits >= required_credits:
            return True
    
    return False


async def _wait_for_credit_replenishment(user_id: str, max_wait: int = 60) -> bool:
    """Poll periodically to check if credits have been replenished.
    
    Simulates the "pause" part of the pause-and-resume pattern.
    In a production system, you might replace polling with event-driven wakeup.
    """
    start_time = datetime.now(timezone.utc)
    
    while (datetime.now(timezone.utc) - start_time).total_seconds() < max_wait:
        try:
            db = get_db()
            user_record = await db.users.find_one({"id": user_id})
            if user_record:
                from app.models.schemas import User
                u_model = User.parse_obj(user_record)
                if u_model.total_credits > 0:
                    return True  # Credits became available
        except Exception as e:
            logger.debug(f"Checking credit status during wait failed: {e}")
        
        # Wait before next poll (5 second intervals)
        await asyncio.sleep(5)
    
    return False  # Timeout reached without getting credits


async def execute_with_quotas(
    user_id: str,
    operation_func,  # Async function that performs the actual work
    required_credits: int = 1,
    operation_name: str = "operation",
    **kwargs
) -> Any:
    """Execute an operation with automatic quota exhaustion handling.
    
    This is the main integration point for the pause-and-resume pattern.
    Usage pattern:
        
        result = await execute_with_quotas(
            user_id="user123",
            operation_func=my_ai_operation_function,
            required_credits=5,
            operation_name="outfit_recommendation",
            ...other args...
        )
    
    If quotas are exhausted, the function will:
    1. Pause execution (wait for credits to be replenished)
    2. Automatically resume once credits are available
    3. If timeout/retry limit reached, re-raise QuotaExhaustionError
    """
    # First check if we can proceed
    can_proceed, status, message = await check_operation_quota(
        user_id=user_id,
        required_credits=required_credits,
        operation=operation_name
    )
    
    if not can_proceed:
        # Raise error that allows caller to decide what to do
        raise QuotaExhaustionError(
            message=message,
            status=status,
            details={
                "status": status.value,
                "required_credits": required_credits,
                "available": await _get_available_credits(user_id),
                "operation": operation_name,
            }
        )
    
    # Proceed with the actual operation
    try:
        # Deduct credits first (using threshold-aware method)
        success = await use_ai_c_with_threshold_check(
            user_id=user_id,
            credits_required=required_credits,
            operation=operation_name
        )
        
        if not success:
            raise RuntimeError("Failed to deduct credits even though quota check passed")
        
        # Execute the actual operation function
        result = await operation_func(**kwargs)
        
        return result
        
    except QuotaExhaustionError as e:
        # Re-raise if it happens mid-operation
        raise e
    except Exception as e:
        logger.error(f"Operation failed after credit deduction: {str(e)}")
        # Optionally refund credits here if needed
        raise


async def _get_available_credits(user_id: str) -> int:
    """Helper to get current available credit count."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if user_record:
            from app.models.schemas import User
            u_model = User.parse_obj(user_record)
            return u_model.total_credits
    except:
        pass
    return 0


async def send_quota_warning_notification(user_id: str, warning_level: str, details: Dict[str, Any]) -> None:
    """Send an in-app notification about approaching/exceeded quota limits.
    
    Integrates with the notification system to inform users before they hit limits.
    """
    # In a real implementation, this would push to WebSocket/mobile notification
    logger.info(f"Sending quota warning for user {user_id}: level={warning_level}, details={details}")
    # Notification sending logic would go here (email, in-app toast, etc.)


# ============================================================================
# FRONTEND-API ENDPOINTS FOR QUOTA STATUS CHECKS
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException

quota_router = APIRouter(prefix="/quota", tags=["quota"])


@quota_router.get("/status")
async def get_status(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current credit quota status with actionable messages for frontend.
    
    This endpoint is designed to be called before initiating any credit-consuming operation
    to provide immediate feedback on whether the user can proceed, needs a soft warning,
    or must purchase more credits.
    """
    try:
        return await check_quota_status(user)
    except Exception as e:
        logger.error(f"Error getting quota status for user {user.get('id', 'unknown')}: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@quota_router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get global quota configuration thresholds for frontend UI rendering."""
    try:
        return await get_quota_config()
    except Exception as e:
        logger.error(f"Error getting quota config: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# BACKWARD COMPATIBILITY WRAPPERS (integrate with existing ai_credits system)
# ============================================================================

async def check_quota_status(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Compat wrapper for existing codebase patterns."""
    user_id = user["id"]
    can_proceed, status, message = await check_operation_quota(
        user_id=user_id,
        required_credits=1,
        operation="quota_check"
    )
    
    thresholds = get_credit_thresholds()
    
    result = {
        "success": True,
        "user_id": user_id,
        "can_proceed": can_proceed,
        "status": status.value,
        "message": message,
        "thresholds": thresholds,
        "needs_purchase_action": status in [CreditQuotaStatus.SOFT_WARNING, CreditQuotaStatus.HARD_LIMIT, CreditQuotaStatus.EXHAUSTED],
        "purchase_link": f"{_threshold_config.PAGE_LINK}",
    }
    
    # Add additional context based on status
    if status == CreditQuotaStatus.SOFT_WARNING:
        result["actionable_message"] = "You're approaching your credit limit. Consider purchasing a pack to avoid disruption."
    elif status == CreditQuotaStatus.HARD_LIMIT:
        result["actionable_message"] = "Your allocated credits have been exhausted for this billing cycle. Upgrade your plan or purchase additional credits."
    elif status == CreditQuotaStatus.EXHAUSTED:
        result["actionable_message"] = "No credits available. Please purchase more credits to continue using AI services."
    
    return result


async def get_quota_config() -> Dict[str, Any]:
    """Compat wrapper for config endpoint."""
    thresholds = get_credit_thresholds()
    return {
        "success": True,
        "config": {
            "soft_warning_percent": thresholds["soft_warning_percent"],
            "hard_limit_percent": thresholds["hard_limit_percent"],
            "soft_warning_message": thresholds["soft_warning_message"],
            "hard_limit_message": thresholds["hard_limit_message"],
            "page_link": thresholds["page_link"],
        }
    }
