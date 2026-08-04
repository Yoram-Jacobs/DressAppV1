import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.config import settings
from app.db.database import get_db
from app.services import atzmai_client
from app.services.auth import get_current_user
from app.services.email_service import send_thank_you_payment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/atzmai", tags=["atzmai"])

_PACK_PRICES = {"10": 1000, "25": 2500, "50": 5000}

class AtzmaiTopupIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pack: Literal["10", "25", "50", "custom"]
    custom_amount_cents: Optional[int] = Field(default=None, ge=0, le=100000)
    currency: str = "ILS"  # Atzmai default currency is ILS
    method: Literal["regular", "bit", "recurring"] = "regular"
    # Recurring parameters
    recurring_period: Optional[int] = 3  # 1 - Daily, 2 - Weekly, 3 - Monthly, 4 - Yearly
    payments_count: Optional[int] = 12
    start_date: Optional[str] = None  # Format DD/MM/YYYY

class AtzmaiCallbackPayload(BaseModel):
    model_config = ConfigDict(extra="allow")
    atzmai_payment_id: str
    atzmai_client_id: Optional[str] = None
    status: Optional[str] = None
    transaction_status: Optional[str] = None
    sale_status: Optional[str] = None
    payme_status: Optional[str] = None
    payme_sale_status: Optional[str] = None
    transaction_amount: Optional[str] = None
    price: Optional[str] = None
    error_message: Optional[str] = None
    error_description: Optional[str] = None

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def trigger_success_email(
    user_record: dict,
    amount_cents: int,
    currency: str,
    credits_purchased: int,
    atzmai_payment_id: str,
):
    try:
        from app.services.email_service import send_thank_you_payment, fetch_invoice_and_receipt_attachments
        attachments = await fetch_invoice_and_receipt_attachments(amount_cents)
        await send_thank_you_payment(
            to=user_record["email"],
            user=user_record,
            amount_cents=amount_cents,
            currency=currency,
            credits_purchased=credits_purchased,
            transaction_id=atzmai_payment_id,
            attachments=attachments
        )
    except Exception as e:
        logger.error(f"Failed to dispatch thank-you email: {e}")

@router.post("/topup")
async def create_atzmai_topup(
    payload: AtzmaiTopupIn,
    req: Request,
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    currency = payload.currency.upper()
    if payload.pack == "custom":
        amount_cents = int(payload.custom_amount_cents or 0)
        if amount_cents < 500:  # Atzmai minimum amount is 5 ILS (500 cents)
            raise HTTPException(
                400,
                {
                    "code": "amount_too_small",
                    "message": "Custom top-up amount must be at least 5.00 ILS.",
                },
            )
    else:
        amount_cents = _PACK_PRICES[payload.pack]

    if amount_cents < 500:
        raise HTTPException(400, "Amount must be at least 5.00 ILS")

    # Resolve callback and redirect URLs dynamically
    base_url = str(req.base_url).rstrip("/")
    callback_url = f"{base_url}/api/v1/atzmai/webhook"
    
    # Redirect URL using settings.APP_PUBLIC_URL
    redirect_url = f"{settings.APP_PUBLIC_URL}/profile"

    db = get_db()
    topup_id = f"atz_{uuid.uuid4().hex[:16]}"
    
    amount_units = amount_cents / 100.0
    description = f"DressApp ad credit top-up ({currency} {amount_units:.2f})"

    try:
        if payload.method == "recurring":
            start_date = payload.start_date or datetime.now(timezone.utc).strftime("%d/%m/%Y")
            resp = await atzmai_client.generate_recurring_payment_link(
                amount=amount_units,
                description=description,
                email=user["email"],
                phone=user.get("phone", "0500000000"),
                customer_name=f"{user.get('first_name', 'User')} {user.get('last_name', '')}".strip(),
                recurring_period=payload.recurring_period or 3,
                payments_count=payload.payments_count or 12,
                start_date=start_date,
                redirect_url=redirect_url,
                callback_url=callback_url,
                atzmai_client_id=user["id"]
            )
        elif payload.method == "bit":
            resp = await atzmai_client.generate_bit_payment_link(
                amount=amount_units,
                description=description,
                customer_name=f"{user.get('first_name', 'User')} {user.get('last_name', '')}".strip(),
                phone=user.get("phone", "0500000000"),
                email=user["email"],
                language="he",
                callback_url=callback_url,
                atzmai_client_id=user["id"]
            )
        else:
            items = [{"amount": amount_units, "description": description}]
            resp = await atzmai_client.generate_payment_link(
                items=items,
                customer_name=f"{user.get('first_name', 'User')} {user.get('last_name', '')}".strip(),
                email=user["email"],
                phone=user.get("phone", "0500000000"),
                language="he",
                redirect_url=redirect_url,
                fail_redirect_url=redirect_url,
                callback_url=callback_url,
                atzmai_client_id=user["id"]
            )
    except atzmai_client.AtzmaiError as exc:
        logger.error(f"Atzmai API failure: {exc}")
        raise HTTPException(502, {"atzmai_error": str(exc.body)}) from exc

    body_data = resp.get("body") or {}
    atzmai_payment_id = body_data.get("atzmai_payment_id")
    payment_url = body_data.get("url")

    if not atzmai_payment_id or not payment_url:
        raise HTTPException(502, "Invalid response from Atzmai payment gateway")

    topup_doc = {
        "id": topup_id,
        "atzmai_payment_id": atzmai_payment_id,
        "user_id": user["id"],
        "amount_cents": amount_cents,
        "currency": currency,
        "pack": payload.pack,
        "method": payload.method,
        "status": "pending",
        "payment_url": payment_url,
        "created_at": _now_iso(),
        "updated_at": _now_iso()
    }
    
    await db.atzmai_topups.insert_one(topup_doc)
    return {
        "topup_id": topup_id,
        "atzmai_payment_id": atzmai_payment_id,
        "payment_url": payment_url,
        "amount_cents": amount_cents,
        "currency": currency
    }

@router.get("/topup/{atzmai_payment_id}")
async def get_atzmai_topup_status(
    atzmai_payment_id: str,
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    doc = await db.atzmai_topups.find_one(
        {"atzmai_payment_id": atzmai_payment_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Top-up transaction not found")
    return doc

@router.post("/webhook")
async def atzmai_webhook(payload: AtzmaiCallbackPayload) -> dict[str, Any]:
    db = get_db()
    atzmai_payment_id = payload.atzmai_payment_id
    logger.info(f"Atzmai webhook received for payment ID {atzmai_payment_id}, payload: {payload.model_dump()}")
    
    topup = await db.atzmai_topups.find_one({"atzmai_payment_id": atzmai_payment_id})
    if not topup:
        logger.warning(f"Atzmai webhook matching top-up not found for payment ID: {atzmai_payment_id}")
        return {"ok": False, "reason": "topup_not_found"}

    if topup.get("status") == "captured":
        logger.info(f"Atzmai payment {atzmai_payment_id} already marked as captured. Skipping.")
        return {"ok": True, "duplicate": True}

    # Determine success status across different payment methods' callback schemas
    status_values = [
        (payload.status or "").lower(),
        (payload.transaction_status or "").lower(),
        (payload.sale_status or "").lower(),
        (payload.payme_status or "").lower(),
        (payload.payme_sale_status or "").lower()
    ]
    
    is_success = any(
        s in ["completed", "success", "paid", "approved", "authorized"]
        for s in status_values
    )

    # In mock mode, we accept anything as success or allow manual simulation
    if atzmai_client.is_mock_mode():
        is_success = True

    new_status = "captured" if is_success else "failed"
    
    await db.atzmai_topups.update_one(
        {"atzmai_payment_id": atzmai_payment_id},
        {
            "$set": {
                "status": new_status,
                "webhook_payload": payload.model_dump(),
                "captured_at": _now_iso(),
                "updated_at": _now_iso()
            }
        }
    )

    if new_status == "captured":
        user_id = topup["user_id"]
        currency = topup["currency"]
        amount_cents = int(topup["amount_cents"])
        tx_type = topup.get("type", "topup")
        
        user_record = await db.users.find_one({"id": user_id})
        
        if tx_type == "topup":
            # Credit balance atomically.
            await db.user_credits.update_one(
                {"user_id": user_id, "currency": currency},
                {
                    "$inc": {"balance_cents": amount_cents},
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "currency": currency,
                        "created_at": _now_iso(),
                    },
                    "$set": {"updated_at": _now_iso()},
                },
                upsert=True,
            )

            # Update user's profile credits
            credits_purchased = int(amount_cents * 2)  # $0.005 per credit (amount_cents * 2)
            if user_record:
                ai_config = user_record.get("ai_configuration") or {}
                existing_credits = int(ai_config.get("current_credits", 1000))
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "ai_configuration.current_credits": existing_credits + credits_purchased,
                            "ai_configuration.credits_used_this_month": 0,
                        }
                    }
                )

                # Send localized email receipt
                import asyncio
                asyncio.create_task(
                    trigger_success_email(
                        user_record=user_record,
                        amount_cents=amount_cents,
                        currency=currency,
                        credits_purchased=credits_purchased,
                        atzmai_payment_id=atzmai_payment_id
                    )
                )
                    
        elif tx_type == "ai_credits":
            # AI credit pack purchase
            pack_size = topup.get("pack", "10")
            from app.api.v1.ai_credits import _CREDIT_PACKS
            credits_added = _CREDIT_PACKS.get(pack_size, 10)
            
            await db.ai_credit_purchases.update_one(
                {"paypal_order_id": atzmai_payment_id},
                {
                    "$set": {
                        "status": "captured",
                        "captured_at": _now_iso(),
                        "updated_at": _now_iso(),
                    }
                }
            )
            
            if user_record:
                from datetime import datetime, timezone
                new_bucket = {
                    "amount": credits_added,
                    "type": "paid",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": None,
                }
                updated_buckets = user_record.get("credit_buckets", [])
                updated_buckets.append(new_bucket)
                
                ai_config = user_record.get("ai_configuration") or {}
                existing_credits = int(ai_config.get("current_credits", 1000))
                
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "credit_buckets": updated_buckets,
                            "ai_configuration.current_credits": existing_credits + credits_added
                        }
                    }
                )
                import asyncio
                asyncio.create_task(
                    trigger_success_email(
                        user_record=user_record,
                        amount_cents=amount_cents,
                        currency=currency,
                        credits_purchased=credits_added,
                        atzmai_payment_id=atzmai_payment_id
                    )
                )
                
        elif tx_type == "subscription":
            # Subscription upgrade
            tier = topup.get("tier", "pro")
            plan_type = topup.get("plan_type", "monthly")
            
            duration_days = 365 if plan_type == "yearly" else 30
            from datetime import datetime, timezone, timedelta
            expires_at = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()
            
            sub_doc = {
                "is_active": True,
                "plan_type": plan_type,
                "tier": tier,
                "stripe_subscription_id": None,
                "paypal_subscription_id": None,
                "atzmai_subscription_id": atzmai_payment_id,
                "expires_at": expires_at,
                "cancelled_at": None,
            }
            
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "subscription": sub_doc,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                }
            )
            
            if user_record:
                from app.models.credit import add_credit_bucket
                credits_map = {"pro": 100, "business": 300}
                included_credits = credits_map.get(tier, 100)
                
                expiry_time = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                updated_buckets = add_credit_bucket(
                    user_record.get("credit_buckets") or [],
                    amount=included_credits,
                    bucket_type="free",
                    expires_at=expiry_time
                )
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"credit_buckets": updated_buckets}}
                )
                import asyncio
                asyncio.create_task(
                    trigger_success_email(
                        user_record=user_record,
                        amount_cents=amount_cents,
                        currency=currency,
                        credits_purchased=included_credits,
                        atzmai_payment_id=atzmai_payment_id
                    )
                )
                
        elif tx_type == "marketplace":
            # Marketplace listing purchase
            tx = await db.transactions.find_one({"paypal.order_id": atzmai_payment_id})
            if tx:
                listing_id = topup.get("listing_id")
                await db.transactions.update_one(
                    {"id": tx["id"]},
                    {
                        "$set": {
                            "status": "paid",
                            "paid_at": _now_iso(),
                            "paypal.capture_id": f"atz_cap_{uuid.uuid4().hex[:12]}",
                            "paypal.status": "COMPLETED",
                            "paypal.captured_at": _now_iso(),
                            "updated_at": _now_iso(),
                        }
                    }
                )
                # Mark listing sold
                if listing_id:
                    await db.listings.update_one(
                        {"id": listing_id},
                        {"$set": {"status": "sold", "updated_at": _now_iso()}}
                    )

    return {"ok": True, "status": new_status}
