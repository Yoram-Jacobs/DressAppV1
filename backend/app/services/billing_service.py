"""billing_service.py - Backward-compatible wrapper delegating to credit_manager.py"""
from typing import Any, Dict
from app.services.credit_manager import (
    deduct_user_credits as _deduct,
    track_ai_operation_with_billing as _track,
    add_paid_credits as _add,
    get_user_credit_summary as _summary,
    refund_user_credits as _refund,
)

async def deduct_user_credits(
    db_connection: Any,
    user: dict,
    cost: float = 1.0,
    operation: str | None = None,
    check_thresholds: bool = True
) -> bool:
    return await _deduct(db_connection, user, cost, operation, check_thresholds, wait_if_exhausted=False)

async def track_ai_operation_with_billing(
    db_connection: Any,
    user: dict,
    operation: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    return await _track(db_connection, user, operation, provider, model, input_tokens, output_tokens)

async def add_paid_credits(user_id: str, amount: int) -> bool:
    return await _add(user_id, amount)

async def get_user_credit_summary(user_id: str) -> Dict[str, Any]:
    return await _summary(user_id)

async def refund_user_credits(
    db_connection: Any,
    user_id: str,
    amount: int,
    credit_type: str = "free"
) -> bool:
    return await _refund(db_connection, user_id, amount, credit_type)