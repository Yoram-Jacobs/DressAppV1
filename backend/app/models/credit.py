from datetime import datetime, timezone, timedelta
from typing import Literal, List, Tuple
from pydantic import BaseModel

CreditType = Literal["free", "paid"]


class CreditBucket(BaseModel):
    """A bucket of credits with an expiration date.
    
    Free credits expire after 30 days. Paid credits have no expiry.
    When spending credits, we always use the oldest (oldest expiry first) buckets.
    """
    amount: int
    type: CreditType  # "free" or "paid"
    created_at: str  # ISO timestamp
    expires_at: str | None = None  # None means infinite (paid credits)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_total_credits(buckets: List[CreditBucket], now_str: str | None = None) -> int:
    """Get total available credits across all non-expired buckets."""
    now = now_str or _now_iso()
    total = 0
    for bucket in buckets:
        # Skip if expired (for free credits with expiry)
        if bucket.type == "free" and bucket.expires_at and now > bucket.expires_at:
            continue
        total += bucket.amount
    return total


def get_aging_credit_buckets(buckets: List[CreditBucket], now_str: str | None = None) -> List[CreditBucket]:
    """
    Get credit buckets sorted by age (oldest first) for consumption.
    Free credits expire after 30 days; paid credits never expire.
    Order: free expiring soonest first, then other free credits, then paid credits.
    """
    now = now_str or _now_iso()
    buckets_with_priority = []
    for bucket in buckets:
        # Determine sort priority: lower = earlier to be consumed
        if bucket.type == "free" and bucket.expires_at:
            # Free credits with expiry: sort by expiry (earliest first)
            priority = (0, bucket.expires_at)
        elif bucket.type == "free":
            # Unexpired free credits: sort by created_at
            priority = (1, bucket.created_at)
        else:
            # Paid credits: no expiry, sort by created_at
            priority = (2, bucket.created_at)
        buckets_with_priority.append((priority, bucket))
    # Sort by priority tuple
    buckets_with_priority.sort(key=lambda x: x[0])
    return [bucket for _, bucket in buckets_with_priority]


def add_credit_bucket(
    buckets: List[CreditBucket],
    amount: int,
    credit_type: CreditType,
    days_until_expiry: int | None = None,
    now_str: str | None = None
) -> None:
    """Add a new credit bucket to the user's credit history."""
    now = now_str or _now_iso()
    expires_at: str | None = None
    if credit_type == "free" and days_until_expiry is not None:
        # Calculate expiry date (30 days default for free credits)
        expiry_dt = datetime.fromisoformat(now.replace("Z", "+00:00")) + timedelta(days=days_until_expiry)
        expires_at = expiry_dt.isoformat()
    
    new_bucket = CreditBucket(
        amount=amount,
        type=credit_type,
        created_at=now,
        expires_at=expires_at
    )
    buckets.append(new_bucket)


def spend_credits(
    buckets: List[CreditBucket],
    required_amount: int,
    operation: str | None = None,
    now_str: str | None = None
) -> Tuple[bool, List[dict]]:
    """
    Spend credits from the oldest buckets first. Returns (success, details of what was spent).
    Updates credit_buckets in-place.
    """
    if required_amount <= 0:
        return True, [{"type": "noop", "amount": 0, "operation": operation or "usage"}]
        
    # 1. Identify which active buckets are candidates and sort them
    now = now_str or _now_iso()
    active_buckets_with_indices = []
    for idx, bucket in enumerate(buckets):
        if bucket.type == "free" and bucket.expires_at and now > bucket.expires_at:
            # Skip expired free credits
            continue
        
        # Priority: lower = earlier to consume
        if bucket.type == "free" and bucket.expires_at:
            priority = (0, bucket.expires_at)
        elif bucket.type == "free":
            priority = (1, bucket.created_at)
        else:
            priority = (2, bucket.created_at)
        active_buckets_with_indices.append((priority, idx, bucket))
        
    # Sort by priority
    active_buckets_with_indices.sort(key=lambda x: x[0])
    
    # 2. Check total capacity
    total_active_credits = sum(x[2].amount for x in active_buckets_with_indices)
    if total_active_credits < required_amount:
        return False, [{"error": "Insufficient active credits"}]
        
    # 3. Deduct from sorted active buckets
    remaining = required_amount
    spent_details = []
    consumed_indices = set()
    modified_buckets = {}  # index -> new_amount
    
    for priority, idx, bucket in active_buckets_with_indices:
        if remaining <= 0:
            break
            
        if bucket.amount >= remaining:
            spent_details.append({
                "bucket_index": idx,
                "type": bucket.type,
                "amount_spent": remaining,
                "remaining_after": bucket.amount - remaining,
                "operation": operation
            })
            if bucket.amount - remaining > 0:
                modified_buckets[idx] = bucket.amount - remaining
            else:
                consumed_indices.add(idx)
            remaining = 0
        else:
            spent_details.append({
                "bucket_index": idx,
                "type": bucket.type,
                "amount_spent": bucket.amount,
                "remaining_after": 0,
                "operation": operation
            })
            consumed_indices.add(idx)
            remaining -= bucket.amount
            
    # 4. Rebuild the list in place
    new_buckets = []
    for idx, bucket in enumerate(buckets):
        if idx in consumed_indices:
            continue
        if idx in modified_buckets:
            new_buckets.append(
                CreditBucket(
                    amount=modified_buckets[idx],
                    type=bucket.type,
                    created_at=bucket.created_at,
                    expires_at=bucket.expires_at
                )
            )
        else:
            new_buckets.append(bucket)
            
    buckets.clear()
    buckets.extend(new_buckets)
    return True, spent_details
