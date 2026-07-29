"""billing_service.py - Centralized billing and credit management logic with bucket-based tracking.

This module handles:
- Credit deduction from user buckets (oldest first)
- Free vs paid credit distinction with different expiry rules
- Integration with token metering for AI operations
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.token_meter import TokenMeter
from app.models.schemas import User, CreditType
from app.services.pricing import get_credit_thresholds, CreditQuotaStatus, use_ai_c_with_threshold_check  # Import new quota-aware functions

logger = logging.getLogger(__name__)


async def deduct_user_credits(
    db_connection: Any,
    user: dict,
    cost: float = 1.0,
    operation: str | None = None,
    check_thresholds: bool = True
) -> bool:
    """
    Deduct AI credits from the user's account using the bucket system.
    Always consumes free credits (with expiration) before paid credits.
    
    Args:
        db_connection: Database connection
        user: User dictionary (from auth context)
        cost: Credit cost (float, e.g., 2.5 credits)
        operation: Operation name for logging
        check_thresholds: If True, apply pause-and-resume logic on exhaustion
    
    Returns:
        True if deduction successful, False otherwise (including when pausing and waiting)
    """
    try:
        user_id = user.get("id")
        if not user_id:
            return False
        
        # Use the enhanced version that handles thresholds
        return await use_ai_c_with_threshold_check(
            user_id=user_id,
            credits_required=int(round(cost)),
            operation=operation or "usage"
        )
    except Exception as e:
        logger.error(f"Error deducting credits with threshold checking: {str(e)}")
        return False


async def track_ai_operation_with_billing(
    db_connection: Any,
    user: dict,
    operation: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Track AI operation and deduct appropriate credits from user's bucket system.
    This integrates TokenMeter with the new credit bucket system.
    
    Args:
        db_connection: Database connection
        user: User dictionary with ai_configuration
        operation: Name of AI operation being performed
        provider: AI provider name (e.g., "gemini", "claude")
        model: Specific model name (e.g., "gemini-2.5-flash")
        input_tokens: Estimated input tokens for this operation
        output_tokens: Estimated output tokens for this operation
    
    Returns:
        Number of credits consumed (float)
    """
    user_id = user.get("id")
    if not user_id:
        return 0.0
    
    # Get current AI configuration
    user_record = await db_connection.users.find_one({"id": user_id})
    if not user_record:
        return 0.0
    
    ai_config = user_record.get("ai_configuration", {})
    
    # Determine if we need to deduct credits (standard plan)
    provider_mode = ai_config.get("ai_provider_mode", "standard")
    if provider_mode not in ["standard", "custom_keys"]:
        # On-device or free mode doesn't consume credits
        return 0.0
    
    # Create token meter and track usage (this will also deduct credits)
    meter = TokenMeter(user_id, operation)
    try:
        credits_consumed = await meter.track_llm_call(
            provider, model, input_tokens, output_tokens, db_connection
        )
        return credits_consumed
    except Exception as e:
        logger.error(f"Failed to track AI operation with billing: {e}")
        raise


async def add_paid_credits(user_id: str, amount: int) -> bool:
    """Add a new paid credit bucket (never expires)."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return False
        
        from datetime import datetime, timezone
        new_bucket = {
            "amount": amount,
            "type": "paid",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None
        }
        
        user_record["credit_buckets"] = user_record.get("credit_buckets", [])
        user_record["credit_buckets"].append(new_bucket)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"credit_buckets": user_record["credit_buckets"]}}
        )
        
        return True
    except Exception as e:
        logger.error(f"Error adding paid credits: {e}")
        return False


async def get_user_credit_summary(user_id: str) -> Dict[str, Any]:
    """Get comprehensive credit summary including bucket details."""
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"error": "User not found"}
        
        u_model = User.parse_obj(user_record)
        
        buckets_detail = []
        for bucket in u_model.credit_buckets:
            remaining = bucket.amount
            is_expired = False
            if bucket.type == "free" and bucket.expires_at:
                from datetime import datetime, timezone
                now_dt = datetime.now(timezone.utc)
                expires_dt = datetime.fromisoformat(bucket.expires_at.replace("Z", "+00:00"))
                if now_dt > expires_dt:
                    remaining = 0
                    is_expired = True
            
            buckets_detail.append({
                "index": u_model.credit_buckets.index(bucket),
                "amount": bucket.amount,
                "remaining": remaining,
                "type": bucket.type,
                "created_at": bucket.created_at,
                "expires_at": bucket.expires_at,
                "expired": is_expired
            })
        
        return {
            "success": True,
            "user_id": user_id,
            "total_credits": u_model.total_credits,
            "free_credits_available": sum(b["remaining"] for b in buckets_detail if b["type"]=="free" and not b["expired"]),
            "free_credits_expired": sum(b["amount"] for b in buckets_detail if b["type"]=="free" and b["expired"]),
            "paid_credits": sum(b["remaining"] for b in buckets_detail if b["type"]=="paid"),
            "bucket_count": len(buckets_detail),
            "buckets": buckets_detail
        }
    except Exception as e:
        logger.error(f"Error getting credit summary: {e}")
        return {"error": str(e)}