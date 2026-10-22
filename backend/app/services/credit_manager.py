"""credit_manager.py - Centralized credit, billing, token metering, and quota management for DressApp.

Consolidates:
- Credit bucket deduction & summaries
- Quota alerts, thresholds, warnings
- Async waiter for credit exhaustion (pause-and-resume)
- Token meter calculation and tracking
- Free trials and rollover logic
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Optional, Dict, List, Tuple
from fastapi import HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_db
from app.models.schemas import User, CreditBucket, CreditType, CreditUsageResponse
from app.models.credit import prune_expired_buckets

logger = logging.getLogger(__name__)

# ============================================================================
# CREDIT QUOTA THRESHOLDS & STATUS
# ============================================================================

class CreditQuotaStatus(str, Enum):
    OK = "ok"
    SOFT_WARNING = "soft_warning"
    HARD_LIMIT = "hard_limit"
    EXHAUSTED = "exhausted"


class CreditThresholdConfig:
    def __init__(self):
        self.SOFT_WARNING_THRESHOLD = 0.20
        self.HARD_THRESHOLD_PERCENT = 0.0
        self.SOFT_WARNING_MESSAGE = "You're running low on AI credits. Consider purchasing more packs to avoid interruption."
        self.HARD_LIMIT_MESSAGE = "Daily/your monthly AI credit allocation has been exhausted. Upgrade your plan or purchase additional credits."
        self.PAGE_LINK = "/pricing/purchase"
        
    def get_status(
        self,
        available: float,
        total_needed: int,
        monthly_limit: int,
        daily_limit: int,
        monthly_used: float | None = None,
        daily_used: float | None = None
    ) -> Tuple[CreditQuotaStatus, str, str | None]:
        if available < total_needed:
            return CreditQuotaStatus.EXHAUSTED, "Insufficient credits to complete this operation", "Purchase more credits"
        
        m_used = monthly_used if monthly_used is not None else max(0.0, monthly_limit - available)
        d_used = daily_used if daily_used is not None else max(0.0, daily_limit - available)
        
        monthly_pct = (m_used / monthly_limit) if monthly_limit > 0 else 0.0
        daily_pct = (d_used / daily_limit) if daily_limit > 0 else 0.0
        
        if monthly_pct >= 1.0 or daily_pct >= 1.0:
            return CreditQuotaStatus.HARD_LIMIT, self.HARD_LIMIT_MESSAGE, "Quota exceeded"
            
        if monthly_pct >= 1 - self.SOFT_WARNING_THRESHOLD or daily_pct >= 1 - self.SOFT_WARNING_THRESHOLD:
            return CreditQuotaStatus.SOFT_WARNING, self.SOFT_WARNING_MESSAGE, "Consider topping up before you run out"
        
        return CreditQuotaStatus.OK, "All set", None
    
    def should_pause_and_resume(self, status: CreditQuotaStatus) -> bool:
        return status in [CreditQuotaStatus.EXHAUSTED]


_threshold_config = CreditThresholdConfig()

def get_credit_thresholds() -> Dict[str, Any]:
    config = _threshold_config
    return {
        "soft_warning_percent": config.SOFT_WARNING_THRESHOLD * 100,
        "hard_limit_percent": config.HARD_THRESHOLD_PERCENT * 100,
        "soft_warning_message": config.SOFT_WARNING_MESSAGE,
        "hard_limit_message": config.HARD_LIMIT_MESSAGE,
        "page_link": config.PAGE_LINK,
    }

# ============================================================================
# CREDIT PACKS
# ============================================================================

class CreditPack(str, Enum):
    TEN = "10"
    FIFTY = "50"
    HUNDRED = "100"

class CreditPackPrice(BaseModel):
    pack: str
    credits_amount: int
    price_cents: int
    discounted_price_cents: int
    savings_cents: int

CREDIT_PACK_PRICES: Dict[str, CreditPackPrice] = {
    CreditPack.TEN: CreditPackPrice(
        pack=CreditPack.TEN,
        credits_amount=10,
        price_cents=300,
        discounted_price_cents=300,
        savings_cents=0
    ),
    CreditPack.FIFTY: CreditPackPrice(
        pack=CreditPack.FIFTY,
        credits_amount=50,
        price_cents=1200,
        discounted_price_cents=1200,
        savings_cents=0
    ),
    CreditPack.HUNDRED: CreditPackPrice(
        pack=CreditPack.HUNDRED,
        credits_amount=100,
        price_cents=2000,
        discounted_price_cents=2000,
        savings_cents=0
    ),
}

FREE_CREDIT_ROLLOVER_DAYS = 30
CREDIT_OVERAGE_PRICE_PER_TEN = 199
MAX_OVERAGE_LIMIT = 1000

class CreditTransaction(BaseModel):
    type: str
    amount: int
    balance_before: int
    balance_after: int
    description: str
    timestamp: str
    reference_id: Optional[str] = None

# ============================================================================
# ASYNC EXHAUSTION WAITERS (PAUSE & AUTO-RESUME)
# ============================================================================

class CreditExhaustionWaiter:
    _instance = None
    _lock = asyncio.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._waiters = []
            cls._instance._initialized = False
        return cls._instance
    
    def add_waiter(self, coro: Any) -> None:
        self._waiters.append(coro)
    
    async def notify_all(self) -> None:
        waiters = list(self._waiters)
        self._waiters = []
        for waiter in waiters:
            try:
                waiter.set_result(None)
            except Exception as e:
                logger.debug(f"Waiter already completed: {e}")
    
    async def wait_for_credits(self, timeout_seconds: int = 300) -> bool:
        if not self._waiters:
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
    db = get_db()
    for attempt in range(max_wait // 5):
        try:
            user_record = await db.users.find_one({"id": user_id})
            if user_record:
                u_model = User.parse_obj(user_record)
                if u_model.total_credits > 0:
                    await _credit_waiter.notify_all()
                    return True
        except Exception as e:
            logger.debug(f"Error checking credit status during wait: {e}")
        await asyncio.sleep(5)
    return False

async def handle_credit_exhaustion(operation: str, user_id: str, required_credits: int) -> bool:
    db = get_db()
    user_record = await db.users.find_one({"id": user_id})
    if not user_record:
        return False
    
    u_model = User.parse_obj(user_record)
    if u_model.total_credits >= required_credits:
        return True
    
    waiter = asyncio.Future()
    _credit_waiter.add_waiter(waiter)
    
    try:
        did_we_get_credits = await wait_for_credit_replenishment(user_id, max_wait=60)
        if did_we_get_credits:
            user_record = await db.users.find_one({"id": user_id})
            if user_record:
                u_model = User.parse_obj(user_record)
                if u_model.total_credits >= required_credits:
                    return True
        return False
    except asyncio.TimeoutError:
        logger.warning(f"Credit wait timed out for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in credit exhaustion handler: {str(e)}")
        return False

# ============================================================================
# QUOTA & ACCESS CHECKERS
# ============================================================================

class QuotaExhaustionError(Exception):
    def __init__(self, message: str, status: CreditQuotaStatus, details: Dict[str, Any] = None):
        self.message = message
        self.status = status
        self.details = details or {}
        super().__init__(message)


async def migrate_legacy_credits_if_needed(user_record: dict, db: Any) -> dict:
    user_id = user_record.get("id")
    ai_config = user_record.get("ai_configuration", {})
    legacy_credits = ai_config.get("current_credits", 0)
    
    if legacy_credits <= 0:
        return user_record

    buckets = user_record.get("credit_buckets") or []
    # Sum the amounts in all buckets
    total_in_buckets = sum(b.get("amount", 0) for b in buckets)
    
    if total_in_buckets == 0:
        import uuid
        from datetime import datetime, timezone
        new_bucket = {
            "id": str(uuid.uuid4()),
            "amount": legacy_credits,
            "type": "paid",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None,
            "description": "Legacy migrated credits"
        }
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "credit_buckets": [new_bucket],
                    "ai_configuration.current_credits": legacy_credits
                }
            }
        )
        updated_record = await db.users.find_one({"id": user_id})
        logger.info("Migrated legacy %d credits to bucket for user %s", legacy_credits, user_id)
        return updated_record
        
    return user_record


ONPREM_DAILY_GRANT = 10
ONPREM_CYCLE_DAYS = 30
ONPREM_MAX_CREDITS = ONPREM_DAILY_GRANT * ONPREM_CYCLE_DAYS  # 300


def compute_onprem_credit_state(user_record: dict) -> Dict[str, Any]:
    """Compute the cumulative 30-day On-Premises AI credit state for Free users.

    Free users receive 10 daily on-premises AI credits that accumulate over up to
    a 30-day period (up to 300 AI credits), then reset for a fresh 30-day cycle.
    """
    today_dt = datetime.now(timezone.utc).date()
    ai_config = (user_record or {}).get("ai_configuration") or {}

    raw_start = ai_config.get("onprem_cycle_start") or (user_record or {}).get("created_at")
    cycle_start_date = today_dt
    if isinstance(raw_start, str) and raw_start.strip():
        try:
            clean_str = raw_start.strip().replace("Z", "+00:00")
            if "T" in clean_str or " " in clean_str:
                cycle_start_date = datetime.fromisoformat(clean_str).astimezone(timezone.utc).date()
            else:
                cycle_start_date = datetime.fromisoformat(clean_str).date()
        except Exception:
            cycle_start_date = today_dt

    days_elapsed = (today_dt - cycle_start_date).days
    needs_cycle_reset = False
    if days_elapsed >= ONPREM_CYCLE_DAYS or days_elapsed < 0:
        cycle_start_date = today_dt
        days_elapsed = 0
        needs_cycle_reset = True
        used_in_cycle = 0
    else:
        if isinstance(ai_config.get("onprem_credits_used"), (int, float)):
            used_in_cycle = max(0, int(ai_config["onprem_credits_used"]))
        else:
            # Migrate today's daily_request_count if present
            last_date = ai_config.get("daily_request_date")
            used_in_cycle = (
                max(0, int(ai_config.get("daily_request_count", 0)))
                if last_date == today_dt.isoformat()
                else 0
            )

    days_in_cycle = min(ONPREM_CYCLE_DAYS, max(1, days_elapsed + 1))
    accrued_credits = min(ONPREM_MAX_CREDITS, days_in_cycle * ONPREM_DAILY_GRANT)
    available_credits = max(0, accrued_credits - used_in_cycle)
    days_until_reset = max(1, ONPREM_CYCLE_DAYS - days_elapsed)

    return {
        "onprem_credits_balance": available_credits,
        "onprem_credits_accrued": accrued_credits,
        "onprem_credits_used": used_in_cycle,
        "onprem_daily_grant": ONPREM_DAILY_GRANT,
        "onprem_max_credits": ONPREM_MAX_CREDITS,
        "onprem_cycle_days": ONPREM_CYCLE_DAYS,
        "onprem_days_in_cycle": days_in_cycle,
        "onprem_days_until_reset": days_until_reset,
        "onprem_cycle_start": cycle_start_date.isoformat(),
        "needs_cycle_reset": needs_cycle_reset,
    }


NANO_BANANA_MONTHLY_LIMIT = 100
NANO_BANANA_CYCLE_DAYS = 30
MIN_CLUSTER_RECONSTRUCTION_CREDITS = 15


def get_available_reconstruction_credits(user_record: dict) -> int:
    """Return the user's available AI reconstruction (Nano Banana) credits.

    - Manager & Professional users: bounded by the 100/month Nano Banana studio reconstruction limit.
    - Free users: bounded by both their active credit_buckets balance (or legacy credits) and the 100/month cap.
    """
    if not user_record:
        return 0
    nb_state = compute_nano_banana_monthly_state(user_record)
    nb_remaining = max(0, int(nb_state.get("nano_banana_monthly_remaining", 0)))
    tier = get_user_tier(user_record)
    if tier in ("manager", "professional"):
        return nb_remaining

    raw_buckets = user_record.get("credit_buckets")
    bucket_total = 0
    if isinstance(raw_buckets, list) and raw_buckets:
        try:
            parsed = [CreditBucket(**b) if isinstance(b, dict) else b for b in raw_buckets]
            bucket_total = max(0, int(get_total_credits(parsed)))
        except Exception:
            bucket_total = 0
    else:
        for fallback_val in (
            user_record.get("total_credits"),
            user_record.get("ai_credits"),
            (user_record.get("ai_configuration") or {}).get("current_credits"),
        ):
            if isinstance(fallback_val, (int, float)):
                bucket_total = max(0, int(fallback_val))
                break

    return min(bucket_total, nb_remaining)


def can_use_cluster_pipeline(user_record: dict) -> bool:
    """Return True if the user is allowed to run the Mass / Cluster upload pipeline.

    - Manager and Professional tiers have Cluster Upload included (subject to monthly limit).
    - Free tier users unlock the Cluster pipeline when they possess 15 or more AI reconstruction credits.
    """
    if not user_record:
        return False
    tier = get_user_tier(user_record)
    if tier in ("manager", "professional"):
        return True
    return get_available_reconstruction_credits(user_record) >= MIN_CLUSTER_RECONSTRUCTION_CREDITS


def compute_nano_banana_monthly_state(user_record: dict) -> Dict[str, Any]:
    """Compute the 30-day Nano Banana execution cap state (max 100/month per user)."""
    today_dt = datetime.now(timezone.utc).date()
    ai_config = (user_record or {}).get("ai_configuration") or {}

    raw_start = ai_config.get("nano_banana_cycle_start") or (user_record or {}).get("created_at")
    cycle_start_date = today_dt
    if isinstance(raw_start, str) and raw_start.strip():
        try:
            clean_str = raw_start.strip().replace("Z", "+00:00")
            if "T" in clean_str or " " in clean_str:
                cycle_start_date = datetime.fromisoformat(clean_str).astimezone(timezone.utc).date()
            else:
                cycle_start_date = datetime.fromisoformat(clean_str).date()
        except Exception:
            cycle_start_date = today_dt

    days_elapsed = (today_dt - cycle_start_date).days
    needs_cycle_reset = False
    if days_elapsed >= NANO_BANANA_CYCLE_DAYS or days_elapsed < 0:
        cycle_start_date = today_dt
        days_elapsed = 0
        needs_cycle_reset = True
        used_in_cycle = 0
    else:
        raw_used = ai_config.get("nano_banana_monthly_used", 0)
        used_in_cycle = max(0, int(raw_used)) if isinstance(raw_used, (int, float)) else 0

    remaining = max(0, NANO_BANANA_MONTHLY_LIMIT - used_in_cycle)
    days_until_reset = max(1, NANO_BANANA_CYCLE_DAYS - days_elapsed)

    return {
        "nano_banana_monthly_limit": NANO_BANANA_MONTHLY_LIMIT,
        "nano_banana_monthly_used": used_in_cycle,
        "nano_banana_monthly_remaining": remaining,
        "nano_banana_cycle_start": cycle_start_date.isoformat(),
        "nano_banana_days_until_reset": days_until_reset,
        "needs_cycle_reset": needs_cycle_reset,
    }


async def check_and_increment_nano_banana_monthly(
    db: Any, user_id: str, cost: int = 1
) -> bool:
    """Enforce the strict 100/month per-user Nano Banana execution limit across all tiers."""
    user_record = await db.users.find_one({"id": user_id})
    if not user_record:
        return False

    req_cost = max(1, int(cost))
    state = compute_nano_banana_monthly_state(user_record)
    if state["nano_banana_monthly_remaining"] < req_cost:
        logger.info(
            "User %s reached monthly Nano Banana limit (%d/%d used, requested=%d).",
            user_id,
            state["nano_banana_monthly_used"],
            state["nano_banana_monthly_limit"],
            req_cost,
        )
        return False

    new_used = state["nano_banana_monthly_used"] + req_cost
    new_remaining = max(0, NANO_BANANA_MONTHLY_LIMIT - new_used)
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "ai_configuration.nano_banana_cycle_start": state["nano_banana_cycle_start"],
                "ai_configuration.nano_banana_monthly_used": new_used,
                "ai_configuration.nano_banana_monthly_remaining": new_remaining,
                "ai_configuration.nano_banana_monthly_limit": NANO_BANANA_MONTHLY_LIMIT,
            }
        },
    )
    return True



async def check_operation_quota(user_id: str, required_credits: int = 1, operation: str = "ai_operation") -> Tuple[bool, CreditQuotaStatus, str]:
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return False, CreditQuotaStatus.EXHAUSTED, "User not found"
            
        user_tier = get_user_tier(user_record)
        if user_tier != "free":
            return True, CreditQuotaStatus.OK, "All set"
            
        req_cost = max(1, int(required_credits))
        state = compute_onprem_credit_state(user_record)
        if state["onprem_credits_balance"] < req_cost:
            return (
                False,
                CreditQuotaStatus.EXHAUSTED,
                f"Insufficient On-Premises AI credits ({state['onprem_credits_balance']} available, {req_cost} required). Credits accumulate at +10/day (up to 300 over 30 days) or upgrade your plan.",
            )
            
        return True, CreditQuotaStatus.OK, "All set"
    except Exception as e:
        logger.error(f"Error checking quota: {str(e)}")
        return False, CreditQuotaStatus.EXHAUSTED, f"System error checking quota: {str(e)}"


async def execute_with_quotas(
    user_id: str,
    operation_func,
    required_credits: int = 1,
    operation_name: str = "operation",
    **kwargs
) -> Any:
    db = get_db()
    success = await check_and_increment_daily_request(db, user_id)
    if not success:
        raise QuotaExhaustionError(
            message="Daily AI operation limit of 10 requests reached. Please upgrade to continue.",
            status=CreditQuotaStatus.EXHAUSTED,
            details={
                "status": "exhausted",
                "required_credits": 1,
                "available": 0,
                "operation": operation_name,
            }
        )
    try:
        return await operation_func(**kwargs)
    except QuotaExhaustionError as e:
        raise e
    except Exception as e:
        logger.error(f"Operation failed after credit deduction: {str(e)}")
        raise


async def _get_available_credits(user_id: str) -> int:
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if user_record:
            u_model = User.parse_obj(user_record)
            return u_model.total_credits
    except:
        pass
    return 0

# ============================================================================
# TOKEN METERING
# ============================================================================

class TokenMeter:
    def __init__(self, user_id: str, operation: str):
        self.user_id = user_id
        self.operation = operation
        self.input_tokens = 0
        self.output_tokens = 0
        self.provider = None
        self.credits_consumed: float = 0.0
        self.credit_type_used: Optional[str] = None

    async def track_llm_call(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        db_connection: Any = None,
    ) -> float:
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.provider = f"{provider.lower()}_{model.lower()}"
        self.credits_consumed = self._calculate_credits(provider, model, input_tokens, output_tokens)
        
        success = await self._deduct_credits(db_connection)
        if not success:
            raise HTTPException(status_code=402, detail="Insufficient credits to complete operation")
        await self._save_token_usage(input_tokens, output_tokens)
        return self.credits_consumed

    async def _deduct_credits(self, db_connection: Any = None) -> bool:
        db = db_connection if db_connection is not None else get_db()
        return await check_and_increment_daily_request(db, self.user_id)

    async def _save_token_usage(self, input_tokens: int, output_tokens: int) -> None:
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
        rates = self._get_rate_card()
        key = f"{provider.lower()}_{model.lower()}"
        rate = rates.get(key, rates["gemini_flash"])
        cost = (input_tokens * rate["input"] + output_tokens * rate["output"]) / 1000
        credits = cost / 0.01
        return max(0.1, round(credits, 2))

    @classmethod
    def _get_rate_card(cls):
        return {
            "gemini_flash": {"input": 0.000075, "output": 0.0003},
            "gemini_pro": {"input": 0.00035, "output": 0.0007},
            "claude_haiku": {"input": 0.00025, "output": 0.00125},
            "claude_sonnet": {"input": 0.0005, "output": 0.0025},
            "gpt4o": {"input": 0.0005, "output": 0.0015},
        }

    @classmethod
    def _calculate_credits_static(cls, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        rates = cls._get_rate_card()
        key = f"{provider.lower()}_{model.lower()}"
        rate = rates.get(key, rates["gemini_flash"])
        cost = (input_tokens * rate["input"] + output_tokens * rate["output"]) / 1000
        credits = cost / 0.01
        return max(0.1, round(credits, 2))


def estimate_token_cost(
    operation: str, provider: str, model: str, input_tokens: int, output_tokens: int
) -> dict[str, Any]:
    return {
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_credits": TokenMeter._calculate_credits_static(provider, model, input_tokens, output_tokens),
    }

# ============================================================================
# BILLING OPERATIONS & TRIAL MANAGEMENT
# ============================================================================

async def check_and_increment_daily_request(db: Any, user_id: str, cost: int = 1) -> bool:
    user_record = await db.users.find_one({"id": user_id})
    if not user_record:
        return False
        
    user_tier = get_user_tier(user_record)
    if user_tier != "free":
        return True
        
    req_cost = max(1, int(cost))
    today = datetime.now(timezone.utc).date().isoformat()
    ai_config = user_record.get("ai_configuration") or {}
    state = compute_onprem_credit_state(user_record)
    
    if state["onprem_credits_balance"] < req_cost:
        logger.info(
            "User %s on FREE plan has insufficient cumulative On-Premises AI credits (available=%d, required=%d).",
            user_id,
            state["onprem_credits_balance"],
            req_cost,
        )
        return False
        
    new_used = state["onprem_credits_used"] + req_cost
    new_balance = max(0, state["onprem_credits_accrued"] - new_used)
    last_date = ai_config.get("daily_request_date")
    daily_count = ai_config.get("daily_request_count", 0) if last_date == today else 0
    daily_count += req_cost

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "ai_configuration.onprem_cycle_start": state["onprem_cycle_start"],
                "ai_configuration.onprem_credits_used": new_used,
                "ai_configuration.onprem_credits_balance": new_balance,
                "ai_configuration.daily_request_date": today,
                "ai_configuration.daily_request_count": daily_count,
            }
        }
    )
    return True


def get_user_tier(user_record: dict) -> str:
    """Returns 'free', 'manager', or 'professional' based on active subscription or tester group membership."""
    email = (user_record.get("email") or "").strip().lower()
    roles = user_record.get("roles") or []
    sub = user_record.get("subscription") or {}

    # Tester group members always enjoy the Professional tier for free
    if (
        email in settings.tester_emails_set
        or "tester" in roles
        or sub.get("is_tester")
        or sub.get("plan_type") == "tester"
    ):
        return "professional"

    is_active = sub.get("is_active", False)
    plan_type = sub.get("plan_type", "free")
    tier = (sub.get("tier") or "free").lower()
    if is_active and plan_type != "free":
        if tier in ["pro", "manager"]:
            return "manager"
        elif tier in ["business", "professional"]:
            return "professional"
    return "free"


def get_credit_exhaustion_info(user_or_tier: dict | str) -> dict[str, str]:
    """Returns the exact localized code, i18n_key, and default message for credit exhaustion."""
    tier = user_or_tier if isinstance(user_or_tier, str) else get_user_tier(user_or_tier)
    if tier in ["manager", "professional"]:
        return {
            "code": "credits_exhausted_paid",
            "i18n_key": "credits.exhausted_paid",
            "message": "You've used your AI actions! Purchase a credit pack to continue.",
        }
    return {
        "code": "credits_exhausted_free",
        "i18n_key": "common.upgradeToUse",
        "feature_key": "moreAiActions",
        "message": "Upgrade your plan or purchase AI credits to continue.",
    }


def make_insufficient_credits_exception(user: dict, cost: int = 1) -> HTTPException:
    """Creates a structured 402 HTTPException with the user's available credit balance and required credits."""
    tier = get_user_tier(user)
    onprem_state = compute_onprem_credit_state(user) if tier == "free" else {}
    credit_balance = int(onprem_state.get("onprem_credits_balance", 0)) if tier == "free" else 0
    return HTTPException(
        status_code=402,
        detail={
            "code": "insufficient_credits",
            "message": "Insufficient credits or quota limit reached",
            "credit_balance": credit_balance,
            "required_credits": int(cost),
            "tier": tier,
        },
    )


async def ensure_monthly_subscription_credits(user_record: dict, db: Any) -> dict:
    """Ensure Manager and Professional subscribers receive 100 non-cumulative AI credits each billing month."""
    user_id = user_record.get("id")
    tier = get_user_tier(user_record)
    if tier not in ["manager", "professional"]:
        return user_record

    sub = user_record.get("subscription") or {}
    last_cycle = sub.get("last_credit_cycle_start")
    now = datetime.now(timezone.utc)
    
    needs_reset = False
    if not last_cycle:
        needs_reset = True
    else:
        try:
            last_dt = datetime.fromisoformat(last_cycle.replace("Z", "+00:00"))
            if (now - last_dt) >= timedelta(days=30):
                needs_reset = True
        except Exception:
            needs_reset = True

    if needs_reset:
        # Non-cumulative: retain paid packs, discard remaining subscription credits, grant fresh 100
        buckets = user_record.get("credit_buckets") or []
        kept_buckets = [
            b for b in buckets
            if b.get("type") == "paid" or b.get("description") != "Monthly subscription credits"
        ]
        
        new_sub_bucket = {
            "amount": 100,
            "type": "free",
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(days=30)).isoformat(),
            "description": "Monthly subscription credits",
        }
        kept_buckets.append(new_sub_bucket)
        
        sub["last_credit_cycle_start"] = now.isoformat()
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "credit_buckets": kept_buckets,
                    "subscription.last_credit_cycle_start": now.isoformat(),
                }
            }
        )
        user_record["credit_buckets"] = kept_buckets
        user_record["subscription"] = sub
        logger.info("Provisioned 100 non-cumulative monthly credits to %s subscriber %s", tier, user_id)

    return user_record


async def deduct_user_credits(
    db_connection: Any,
    user: dict,
    cost: float = 1.0,
    operation: str | None = None,
    check_thresholds: bool = True,
    wait_if_exhausted: bool = False
) -> bool:
    try:
        user_id = user.get("id")
        if not user_id:
            return False
        db = db_connection if db_connection is not None else get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return False

        user_tier = get_user_tier(user_record)
        req_int = max(1, int(round(cost)))

        is_generative = operation in (
            "mass_reconstruct",
            "polish_crop",
            "chat_image_edit",
            "repair_item_crop",
            "edit_item_image",
            "reconstruct",
            "generative_inpainting",
        ) or (
            bool(operation)
            and any(
                k in operation
                for k in (
                    "image_edit",
                    "reconstruct",
                    "repair_item",
                    "inpainting",
                    "polish_crop",
                    "mass_reconstruct",
                )
            )
        )

        # 1. Professional and Manager tiers:
        #    - Analytical / non-generative operations: unlimited.
        #    - Generative Nano Banana operations: capped at 100 executions per month per user.
        if user_tier in ["manager", "professional"]:
            if is_generative:
                monthly_ok = await check_and_increment_nano_banana_monthly(db, user_id, req_int)
                if not monthly_ok:
                    return False
            try:
                meter = TokenMeter(user_id, operation or "ai_operation")
                meter.input_tokens = 0
                meter.output_tokens = 0
                meter.credits_consumed = req_int
                meter.credit_type_used = "nano_banana_monthly" if is_generative else "subscription"
                await meter._save_token_usage(0, 0)
            except Exception:
                pass
            return True

        # 2. Free tier users:
        # --- A. Non-generative analytical operations (on-premises model requests: garment analysis, stylist, suitcase) ---
        # Calculated strictly against the cumulative 10 daily On-Premises AI credits (up to 300 over 30 days).
        # NEVER drains the user's Nano Banana generative credits!
        if not is_generative:
            if req_int == 1:
                daily_ok = await check_and_increment_daily_request(db, user_id)
            else:
                daily_ok = await check_and_increment_daily_request(db, user_id, req_int)
            if daily_ok:
                try:
                    meter = TokenMeter(user_id, operation or "ai_operation")
                    meter.input_tokens = 0
                    meter.output_tokens = 0
                    meter.credits_consumed = req_int
                    meter.credit_type_used = "free_daily_quota"
                    await meter._save_token_usage(0, 0)
                except Exception:
                    pass
                return True
            logger.info("User %s on Free plan has exhausted their cumulative On-Premises AI credits.", user_id)
            return False

        # --- B. Generative image editing & reconstruction operations (Nano Banana) ---
        # Calculated strictly and separately from daily AI credits, and subject to the 100/month cap.
        nb_state = compute_nano_banana_monthly_state(user_record)
        if nb_state["nano_banana_monthly_remaining"] < req_int:
            logger.info(
                "User %s on Free plan reached monthly Nano Banana cap (%d/%d).",
                user_id,
                nb_state["nano_banana_monthly_used"],
                nb_state["nano_banana_monthly_limit"],
            )
            return False

        user_record = await migrate_legacy_credits_if_needed(user_record, db)
        u_model = User.parse_obj(user_record)
        available_credits = u_model.total_credits

        if available_credits >= req_int:
            success, spent_details = u_model.spend_credits(req_int, operation or "ai_operation")
            if success:
                clean_buckets = [b.dict() for b in prune_expired_buckets(u_model.credit_buckets)]
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"credit_buckets": clean_buckets}}
                )
                await check_and_increment_nano_banana_monthly(db, user_id, req_int)
                try:
                    meter = TokenMeter(user_id, operation or "ai_operation")
                    meter.input_tokens = 0
                    meter.output_tokens = 0
                    meter.credits_consumed = req_int
                    meter.credit_type_used = spent_details[0].get("type", "free") if spent_details else "free"
                    await meter._save_token_usage(0, 0)
                except Exception:
                    pass
                return True

        logger.info(
            "User %s on Free plan has exhausted generative Nano Banana credits (available: %d). "
            "Refill required via purchased credit pack or plan upgrade.",
            user_id,
            available_credits,
        )
        return False
    except Exception as e:
        logger.error(f"Error checking/deducting user credits: {str(e)}")
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
    user_id = user.get("id")
    if not user_id:
        return 0.0
    user_record = await db_connection.users.find_one({"id": user_id})
    if not user_record:
        return 0.0
    ai_config = user_record.get("ai_configuration", {})
    provider_mode = ai_config.get("ai_provider_mode", "standard")
    if provider_mode not in ["standard", "custom_keys"]:
        return 0.0
    meter = TokenMeter(user_id, operation)
    try:
        credits_consumed = await meter.track_llm_call(
            provider, model, input_tokens, output_tokens, db_connection
        )
        return credits_consumed
    except Exception as e:
        logger.error(f"Failed to track AI operation with billing: {e}")
        raise


async def refund_user_credits(
    db_connection: Any,
    user_id: str,
    amount: int,
    credit_type: str = "free"
) -> bool:
    try:
        user_record = await db_connection.users.find_one({"id": user_id})
        if not user_record:
            return False

        if credit_type == "free_daily_quota":
            state = compute_onprem_credit_state(user_record)
            new_used = max(0, state["onprem_credits_used"] - max(0, int(amount)))
            new_balance = max(0, state["onprem_credits_accrued"] - new_used)
            await db_connection.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "ai_configuration.onprem_cycle_start": state["onprem_cycle_start"],
                        "ai_configuration.onprem_credits_used": new_used,
                        "ai_configuration.onprem_credits_balance": new_balance,
                    }
                },
            )
        elif credit_type == "nano_banana_monthly":
            nb_state = compute_nano_banana_monthly_state(user_record)
            new_used = max(0, nb_state["nano_banana_monthly_used"] - max(0, int(amount)))
            new_remaining = max(0, NANO_BANANA_MONTHLY_LIMIT - new_used)
            await db_connection.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "ai_configuration.nano_banana_cycle_start": nb_state["nano_banana_cycle_start"],
                        "ai_configuration.nano_banana_monthly_used": new_used,
                        "ai_configuration.nano_banana_monthly_remaining": new_remaining,
                        "ai_configuration.nano_banana_monthly_limit": NANO_BANANA_MONTHLY_LIMIT,
                    }
                },
            )
        else:
            u_model = User.parse_obj(user_record)
            u_model.add_credit_bucket(
                amount=amount,
                credit_type=credit_type,
                days_until_expiry=30 if credit_type == "free" else None
            )
            await db_connection.users.update_one(
                {"id": user_id},
                {"$set": {"credit_buckets": [b.dict() for b in prune_expired_buckets(u_model.credit_buckets)]}}
            )
        
        # Log the refund transaction
        doc = {
            "user_id": user_id,
            "operation": "refund",
            "provider": "system",
            "input_tokens": 0,
            "output_tokens": 0,
            "credits_consumed": -amount,
            "credit_type": credit_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db_connection.token_usage.insert_one(doc)
        return True
    except Exception as e:
        logger.error(f"Error refunding credits: {str(e)}")
        return False


async def add_paid_credits(user_id: str, amount: int) -> bool:
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return False
        
        new_bucket = {
            "amount": amount,
            "type": "paid",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None
        }
        
        user_record["credit_buckets"] = user_record.get("credit_buckets", [])
        user_record["credit_buckets"].append(new_bucket)
        # Prune zero-amount expired free buckets before writing back.
        raw_buckets = [CreditBucket(**b) if isinstance(b, dict) else b for b in user_record["credit_buckets"]]
        clean_buckets = [b.dict() for b in prune_expired_buckets(raw_buckets)]

        await db.users.update_one(
            {"id": user_id},
            {"$set": {"credit_buckets": clean_buckets}}
        )
        return True
    except Exception as e:
        logger.error(f"Error adding paid credits: {e}")
        return False


async def get_user_credit_summary(user_id: str) -> Dict[str, Any]:
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


async def use_ai_c_with_threshold_check(
    user_id: str,
    credits_required: int,
    operation: str = "ai_operation",
    wait_if_exhausted: bool = False
) -> bool:
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return False
        user_record = await migrate_legacy_credits_if_needed(user_record, db)
        u_model = User.parse_obj(user_record)
        if u_model.total_credits < credits_required:
            if not wait_if_exhausted:
                return False
            got_enough = await handle_credit_exhaustion(
                operation=operation,
                user_id=user_id,
                required_credits=credits_required
            )
            if not got_enough:
                return False
        
        success, spent_details = u_model.spend_credits(credits_required, operation)
        if not success:
            return False
        
        user_record["credit_buckets"] = [b.dict() for b in prune_expired_buckets(u_model.credit_buckets)]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"credit_buckets": user_record["credit_buckets"]}}
        )
        
        meter = TokenMeter(user_id, operation)
        meter.input_tokens = 0
        meter.output_tokens = 0
        meter.credits_consumed = credits_required
        meter.credit_type_used = "free" if any(d["type"]=="free" for d in spent_details) else "paid"
        await meter._save_token_usage(0, 0)
        return True
    except Exception as e:
        logger.error(f"Error using AI credits with threshold: {str(e)}")
        return False


async def check_quota_status(user: dict) -> Dict[str, Any]:
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
        "needs_purchase_action": not can_proceed,
        "purchase_link": "/pricing",
    }
    if not can_proceed:
        result["actionable_message"] = "Daily AI operation limit of 10 requests reached. Please upgrade to continue."
    else:
        result["actionable_message"] = "All set"
    return result


async def get_quota_config() -> Dict[str, Any]:
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


async def expire_old_free_credits(user_data: dict) -> dict:
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
    try:
        db = get_db()
        user_record = await db.users.find_one({"id": user_id})
        if not user_record:
            return {"success": False, "error": "User not found"}
        
        subscription = user_record.get("subscription") or {}
        trial_info = user_record.get("trial_info") or {}
        
        if not subscription.get("is_active") or subscription.get("plan_type") == "free":
            return {"success": True, "expired": False}
        
        expires_at_str = subscription.get("expires_at")
        if not expires_at_str:
            return {"success": True, "expired": False}
            
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            subscription["plan_type"] = "free"
            subscription["is_active"] = True
            subscription["expires_at"] = None
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "subscription": subscription,
                        "ai_configuration.ai_provider_mode": "standard",
                        "ai_configuration.ai_monthly_limit": 100
                    }
                }
            )
            return {"success": True, "expired": True}
        return {"success": True, "expired": False}
    except Exception as e:
        logger.error(f"Error in check_trial_expiration: {e}")
        return {"success": False, "error": str(e)}


async def get_user_ai_balance(user_id: str) -> Dict:
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    u_model = User.parse_obj(user)
    return {
        "total_credits": u_model.total_credits,
        "free_credits_available": sum(b["amount"] for b in user.get("credit_buckets", []) 
                                     if b["type"]=="free" and (not b.get("expires_at") or datetime.now(timezone.utc).isoformat() <= b["expires_at"])),
        "paid_credits": sum(b["amount"] for b in user.get("credit_buckets", []) if b["type"]=="paid"),
        "ai_credits_used_this_month": user.get("ai_configuration", {}).get("ai_credits_used_this_month", 0),
        "ai_monthly_limit": user.get("ai_configuration", {}).get("ai_monthly_limit", 1000),
        "ai_daily_limit": user.get("ai_configuration", {}).get("ai_daily_limit", 100),
        "daily_usage": user.get("ai_configuration", {}).get("ai_daily_used", 0),
        "monthly_usage": user.get("ai_configuration", {}).get("ai_monthly_used", 0),
        "provider_mode": user.get("ai_configuration", {}).get("ai_provider_mode", "standard"),
        "ai_provider": user.get("ai_configuration", {}).get("ai_provider", "gemini"),
    }


async def check_ai_access(user_id: str, operation: str = "ai_operation") -> CreditUsageResponse:
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    u_model = User.parse_obj(user)
    available = u_model.total_credits
    requires_credits = operation in [
        "text_generation", "image_processing", "video_processing",
        "auto_tagging", "outfit_recommendation", "stylist_chat",
        "bookmarklet_migration", "body_measurement", "background_removal"
    ]
    credits_needed = 10
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
        daily_usage=int(daily_used),
        monthly_usage=int(monthly_used),
        daily_limit=daily_limit,
        monthly_limit=monthly_limit,
        can_use=can_use,
        upgrade_required=upgrade_required
    )


async def cleanup_expired_trials() -> dict:
    try:
        db = get_db()
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        cursor = db.users.find({
            "trial_info.expires_at": {"$lte": now.isoformat()},
            "trial_info": {"$exists": True}
        })
        cleaned_count = 0
        async for user in cursor:
            res = await check_trial_expiration(user["id"])
            if res.get("expired"):
                cleaned_count += 1
        return {"success": True, "cleaned_count": cleaned_count}
    except Exception as e:
        logger.error(f"Error in cleanup_expired_trials: {e}")
        return {"success": False, "error": str(e)}

