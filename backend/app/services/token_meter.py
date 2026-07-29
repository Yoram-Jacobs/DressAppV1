"""Token metering system for DressApp AI credits.

Tracks actual LLM/vision API consumption per user operation and converts to DressApp credits using a dynamic rate card.
This version integrates with the credit bucket system (free vs paid, different expiry rules).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Optional, Dict


from fastapi import APIRouter
from app.db.database import get_db
from app.services.auth import get_current_user
from app.models.schemas import User, CreditType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/token-meter", tags=["token-meter"])


class OperationType(str, Enum):
    AUTO_TAGGING = "auto_tagging"
    OUTFIT_RECOMMENDATION = "outfit_recommendation"
    STYLIST_CHAT = "stylist_chat"
    BOOKMARKLET_MIGRATION = "bookmarklet_migration"
    BODY_MEASUREMENT = "body_measurement"
    BACKGROUND_REMOVAL = "background_removal"


class Provider(str, Enum):
    GEMINI_FLASH = "gemini-flash"
    GEMINI_PRO = "gemini-pro"
    CLAUDE_HAIKU = "claude-haiku"
    CLAUDE_SONNET = "claude-sonnet"
    GPT4O = "gpt4o"


class TokenMeter:
    def __init__(self, user_id: str, operation: str):
        self.user_id = user_id
        self.operation = operation
        self.input_tokens = 0
        self.output_tokens = 0
        self.provider = None
        self.credits_consumed: float = 0.0
        self.credit_type_used: Optional[CreditType] = None  # Track which credit type was used

    async def track_llm_call(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        db_connection: Any = None,  # Optional db connection for atomic ops
    ) -> float:
        """Track token usage and return credits consumed, updating user's credit buckets."""
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.provider = f"{provider.lower()}_{model.lower()}"
        
        # Calculate credits based on token usage
        self.credits_consumed = self._calculate_credits(provider, model, input_tokens, output_tokens)
        
        # Deduct from user's credit buckets (oldest first)
        success = await self._deduct_credits(db_connection)
        
        if not success:
            raise HTTPException(status_code=402, detail="Insufficient credits to complete operation")
        
        # Save token usage record
        await self._save_token_usage(input_tokens, output_tokens)
        
        return self.credits_consumed

    async def _deduct_credits(self, db_connection: Any = None) -> bool:
        """Deduct credits from the user's oldest credit buckets first."""
        db = db_connection or get_db()
        
        # Get current user
        user_record = await db.users.find_one({"id": self.user_id})
        if not user_record:
            return False
        
        # Convert to User model for bucket operations
        user_model = User.parse_obj(user_record)
        
        credits_needed = int(round(self.credits_consumed))  # Round to nearest integer credit
        if credits_needed <= 0:
            # No deduction needed for negligible cost operations
            self.credit_type_used = "paid"  # Fallback, no real credit used
            return True
        
        # Try to spend from buckets
        success, spent_details = user_model.spend_credits(credits_needed, self.operation)
        
        if not success:
            return False
        
        # Determine which credit types were consumed (prioritize free credits first)
        free_spent = sum(d["amount_spent"] for d in spent_details if d["type"] == "free")
        paid_spent = sum(d["amount_spent"] for d in spent_details if d["type"] == "paid")
        
        if free_spent > 0:
            self.credit_type_used = "free"
        elif paid_spent > 0:
            self.credit_type_used = "paid"
        else:
            self.credit_type_used = None
        
        # Update database with new credit_buckets
        user_model.credit_buckets = [b for b in user_model.credit_buckets if b.amount > 0]  # Remove empty buckets
        user_record["credit_buckets"] = [b.dict() for b in user_model.credit_buckets]
        
        await db.users.update_one(
            {"id": self.user_id},
            {"$set": {"credit_buckets": user_record["credit_buckets"]}}
        )
        
        return True

    async def _save_token_usage(self, input_tokens: int, output_tokens: int) -> None:
        """Save token usage for cost analysis and rollback."""
        db = get_db()
        
        doc = {
            "user_id": self.user_id,
            "operation": self.operation,
            "provider": self.provider,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "credits_consumed": self.credits_consumed,
            "credit_type": self.credit_type_used,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.token_usage.insert_one(doc)

    def _calculate_credits(self, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate DressApp credits using provider pricing and rate card."""
        rates = self._get_rate_card()
        key = f"{provider.lower()}_{model.lower()}"
        rate = rates.get(key, rates["gemini_flash"])

        cost = (input_tokens * rate["input"] + output_tokens * rate["output"]) / 1000
        credits = cost / 0.01
        return max(0.1, round(credits, 2))

    @classmethod
    def _get_rate_card(cls):
        """Return the DressApp credit rate card."""
        return {
            "gemini_flash": {"input": 0.000075, "output": 0.0003},
            "gemini_pro": {"input": 0.00035, "output": 0.0007},
            "claude_haiku": {"input": 0.00025, "output": 0.00125},
            "claude_sonnet": {"input": 0.0005, "output": 0.0025},
            "gpt4o": {"input": 0.0005, "output": 0.0015},
        }

    @classmethod
    def _calculate_credits_static(cls, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        """Static version for cost estimation."""
        rates = {
            "gemini_flash": {"input": 0.000075, "output": 0.0003},
            "gemini_pro": {"input": 0.00035, "output": 0.0007},
            "claude_haiku": {"input": 0.00025, "output": 0.00125},
            "claude_sonnet": {"input": 0.0005, "output": 0.0025},
            "gpt4o": {"input": 0.0005, "output": 0.0015},
        }

        key = f"{provider.lower()}_{model.lower()}"
        rate = rates.get(key, rates['gemini_flash'])

        cost = (input_tokens * rate['input'] + output_tokens * rate['output']) / 1000
        credits = cost / 0.01
        return max(0.1, round(credits, 2))


# ------------------------------------------------------------------
# Token cost estimator (stateless version for FastAPI route)
# ------------------------------------------------------------------
def estimate_token_cost(
    operation: str, provider: str, model: str, input_tokens: int, output_tokens: int
) -> dict[str, Any]:
    """Quick estimate for token cost calculation."""
    costs = {
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_credits": TokenMeter._calculate_credits_static(provider, model, input_tokens, output_tokens),
    }

    return costs


# ------------------------------------------------------------------
# Token metering middleware for FastAPI
# ------------------------------------------------------------------
def track_token_usage(operation: str, provider: str, model: str, input_tokens: int, output_tokens: int):
    async def middleware(request: Any, call_next) -> Any:
        response = await call_next(request)
        return response

    return middleware


# ------------------------------------------------------------------
# API endpoints
# ------------------------------------------------------------------
@router.get("/cost-estimate", response_model=dict)
async def get_operation_cost_estimate(
    operation: OperationType,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get the estimated cost of an operation for the current user."""
    cost = TokenMeter._calculate_credits_static(provider, model, input_tokens, output_tokens)
    return {
        "operation": operation,
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_credits": cost,
        "estimated_cost_usd": cost * 0.01,
    }


@router.post("/track", response_model=dict)
async def track_token_usage_endpoint(
    request: dict,
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Track token usage for an AI operation - deducts credits from appropriate bucket."""
    try:
        db = get_db()
        
        operation = request.get("operation")
        provider = request.get("provider")
        model = request.get("model")
        input_tokens = request.get("input_tokens", 0)
        output_tokens = request.get("output_tokens", 0)
        
        if not all([operation, provider, input_tokens >= 0, output_tokens >= 0]):
            raise HTTPException(400, "Missing or invalid required fields")
        
        meter = TokenMeter(user["id"], operation)
        credits_consumed = await meter.track_llm_call(
            provider, model, input_tokens, output_tokens, db
        )
        
        return {
            "success": True,
            "credits_consumed": credits_consumed,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "provider": provider,
            "model": model,
            "operation": operation,
            "credit_type_used": meter.credit_type_used,
            "balance_after": await get_user_balance_after_deduction(user["id"]),
        }
    except Exception as e:
        logger.error(f"Error tracking token usage: {str(e)}")
        raise

async def get_user_balance_after_deduction(user_id: str) -> Dict:
    """Get the user's balance after potential deduction (used for response)."""
    db = get_db()
    user_record = await db.users.find_one({"id": user_id})
    if not user_record:
        return {"total_credits": 0}
    
    u_model = User.parse_obj(user_record)
    return {
        "total_credits": u_model.total_credits,
        "free_credits_available": sum(b["amount"] for b in user_record.get("credit_buckets", []) 
                                     if b["type"]=="free" and (not b.get("expires_at") or datetime.now().isoformat() <= b["expires_at"])),
        "paid_credits": sum(b["amount"] for b in user_record.get("credit_buckets", []) if b["type"]=="paid"),
    }


@router.get("/analytics", response_model=dict)
async def get_token_analytics(
    user: dict = Depends(get_current_user),
    days: int = 30,
) -> dict[str, Any]:
    """Get token usage analytics for the current user."""
    db = get_db()
    user_id = user["id"]
    
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$match": {
            "created_at": {
                "$gte": (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            }
        }},
        {"$group": {
            "_id": "$operation",
            "total_input_tokens": {"$sum": "$input_tokens"},
            "total_output_tokens": {"$sum": "$output_tokens"},
            "total_credits": {"$sum": "$credits_consumed"},
            "count": {"$sum": 1},
            "credit_types_used": {"$addToSet": "$credit_type"}
        }}
    ]
    
    analytics = await db.token_usage.aggregate(pipeline).to_list(length=None)
    
    return {"analytics": analytics}
