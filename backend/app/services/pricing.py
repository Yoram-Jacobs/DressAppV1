"""pricing.py - Backward-compatible wrapper delegating to credit_manager.py"""
from app.services.credit_manager import (
    CreditQuotaStatus,
    CreditThresholdConfig,
    _threshold_config,
    get_credit_thresholds,
    CreditPack,
    CreditPackPrice,
    CREDIT_PACK_PRICES,
    FREE_CREDIT_ROLLOVER_DAYS,
    CREDIT_OVERAGE_PRICE_PER_TEN,
    MAX_OVERAGE_LIMIT,
    CreditTransaction,
    CreditExhaustionWaiter,
    _credit_waiter,
    wait_for_credit_replenishment,
    handle_credit_exhaustion,
    use_ai_c_with_threshold_check,
    get_user_ai_balance,
    check_ai_access,
    expire_old_free_credits,
    start_pro_trial,
    start_business_trial,
    check_trial_expiration,
    cleanup_expired_trials,
)

async def use_ai_credits(
    user_id: str,
    credits_required: int,
    operation: str = "ai_operation"
) -> bool:
    return await use_ai_c_with_threshold_check(user_id, credits_required, operation)

async def purchase_credit_pack(user_id: str, pack: str) -> dict:
    from app.services.credit_manager import add_paid_credits
    try:
        amount = int(pack)
        success = await add_paid_credits(user_id, amount)
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def apply_credit_rollover(user_id: str) -> dict:
    from app.db.database import get_db
    from app.models.schemas import User
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"success": False, "error": "User not found"}
        u_model = User.parse_obj(user_record)
        u_model.add_credit_bucket(amount=10, credit_type="free", days_until_expiry=30)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"credit_buckets": [b.dict() for b in u_model.credit_buckets]}}
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
