"""billing_service.py - Backward-compatible wrapper delegating to credit_manager.py"""
from typing import Any, Dict
from app.services.credit_manager import (
    deduct_user_credits as _deduct,
    track_ai_operation_with_billing as _track,
    add_paid_credits as _add,
    get_user_credit_summary as _summary,
    refund_user_credits as _refund,
    get_user_tier,
    get_credit_exhaustion_info,
    make_insufficient_credits_exception,
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

FREE_CLOSET_LIMIT = 100


async def demote_user_to_free_plan(
    db_connection: Any,
    user: dict,
) -> Dict[str, Any]:
    """Demote a Manager/Professional user to the Free plan and prune their closet
    to the last 100 added items (up to 150 with referral bonus) (ordered by created_at descending).
    """
    from datetime import datetime, timezone

    user_id = user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    bonus = user.get("closet_capacity_bonus", 0)
    effective_limit = min(150, FREE_CLOSET_LIMIT + bonus)

    # Fetch all closet items ordered by created_at DESC (newest first)
    cursor = db_connection.closet_items.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "created_at": 1},
    ).sort([("created_at", -1), ("_id", -1)])
    all_items = await cursor.to_list(length=10000)

    removed_count = 0
    if len(all_items) > effective_limit:
        older_ids = [
            it["id"] for it in all_items[effective_limit:] if it.get("id")
        ]
        if older_ids:
            del_res = await db_connection.closet_items.delete_many(
                {"user_id": user_id, "id": {"$in": older_ids}}
            )
            removed_count = int(getattr(del_res, "deleted_count", len(older_ids)))

    remaining_count = min(len(all_items), effective_limit)

    await db_connection.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "subscription.plan_type": "free",
                "subscription.tier": "free",
                "subscription.is_active": False,
                "subscription.cancelled_at": now_iso,
                "ai_configuration.subscription.plan_type": "free",
                "ai_configuration.subscription.is_active": False,
                "ai_configuration.ai_monthly_limit": 20,
                "closet_capacity_bonus": 0,
                "updated_at": now_iso,
            }
        },
    )

    return {
        "ok": True,
        "success": True,
        "plan_type": "free",
        "removed_closet_items_count": removed_count,
        "remaining_closet_items_count": remaining_count,
        "free_closet_limit": FREE_CLOSET_LIMIT,
        "message": (
            f"Demoted to Free plan. Retained the last {remaining_count} added items "
            f"and removed {removed_count} older closet items."
        ),
    }
