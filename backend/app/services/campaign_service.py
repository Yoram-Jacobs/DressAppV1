"""Campaign Service — Experts Campaign Platform.

Handles:
- Haversine geo-radius filtering for user eligibility
- Push and email notification dispatch per campaign
- Campaign activation (Approved → Active when start_date≤now)
- Campaign expiry (Active → Expired when end_date<now)

All I/O is async (Motor/MongoDB). The push_provider and email_provider
are injected via the NotificationProvider interface so swapping to
OneSignal/FCM/SMS later requires only a config change.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db
from app.services.notification_provider import web_push_provider, resend_email_provider

logger = logging.getLogger(__name__)

_APP_URL = "https://dressapp.co"
_BRAND_NAME = "DressApp"
_BRAND_COLOR = "#1F6F6B"
_ACCENT = "#C2553A"
_BG = "#F7F4EE"


# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# User eligibility
# ---------------------------------------------------------------------------

def _user_in_radius(user: dict[str, Any], campaign: dict[str, Any]) -> bool:
    """Return True if the user's home location falls inside the campaign radius."""
    loc = campaign.get("location") or {}
    c_lat = loc.get("lat")
    c_lon = loc.get("lon")
    radius = float(loc.get("radius_km") or 25.0)

    if c_lat is None or c_lon is None:
        # No GPS — fall back to country/city string match
        c_country = (loc.get("country") or "").lower()
        c_city = (loc.get("city") or "").lower()
        u_loc = user.get("home_location") or {}
        u_country = (u_loc.get("country") or u_loc.get("country_code") or "").lower()
        u_city = (u_loc.get("city") or "").lower()
        if c_country and u_country and c_country not in u_country and u_country not in c_country:
            return False
        if c_city and u_city and c_city not in u_city and u_city not in c_city:
            return False
        return True

    u_loc = user.get("home_location") or {}
    u_lat = u_loc.get("lat")
    u_lon = u_loc.get("lon")
    if u_lat is None or u_lon is None:
        return True  # location unknown — optimistic include
    return _haversine_km(c_lat, c_lon, float(u_lat), float(u_lon)) <= radius


def _user_matches_audience(user: dict[str, Any], campaign: dict[str, Any]) -> bool:
    """Return True if the user matches the campaign audience."""
    audience = campaign.get("audience") or {}
    targets = audience.get("targets") or ["all"]
    if "all" in targets:
        return True
    # Gender mapping
    gender = (user.get("sex") or "").lower()
    if gender == "male" and "men" in targets:
        return True
    if gender == "female" and "women" in targets:
        return True
    # Age range
    dob = user.get("date_of_birth")
    age_min = audience.get("age_min")
    age_max = audience.get("age_max")
    if dob and (age_min or age_max):
        try:
            birth = datetime.fromisoformat(dob)
            age = (datetime.now(timezone.utc) - birth.replace(tzinfo=timezone.utc)).days // 365
            if age_min and age < age_min:
                return False
            if age_max and age > age_max:
                return False
        except Exception:
            pass
    return True


async def _already_notified(campaign_id: str, user_id: str, channel: str) -> bool:
    db = get_db()
    return bool(
        await db.campaign_notifications.find_one(
            {"campaign_id": campaign_id, "user_id": user_id, "channel": channel,
             "status": {"$in": ["sent", "delivered"]}}
        )
    )


# ---------------------------------------------------------------------------
# Email template
# ---------------------------------------------------------------------------

def _build_campaign_email_html(campaign: dict[str, Any], app_url: str) -> str:
    title = campaign.get("title", "")
    business = campaign.get("business_name", "")
    short_desc = campaign.get("short_description", "")
    discount = campaign.get("discount_pct")
    coupon = campaign.get("coupon_code")
    end_date = campaign.get("end_date", "")
    cover = campaign.get("cover_image_url") or ""
    cid = campaign.get("id", "")
    loc = campaign.get("location") or {}
    city = loc.get("city") or ""
    country = loc.get("country") or ""
    address_str = ", ".join(filter(None, [city, country]))
    lat = loc.get("lat")
    lon = loc.get("lon")
    map_link = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=15/{lat}/{lon}" if lat and lon else ""
    campaign_url = f"{app_url}/campaigns/{cid}"

    discount_badge = ""
    if discount:
        discount_badge = f"""
        <td align="center" style="padding:8px 0;">
          <span style="background:#C2553A;color:#fff;padding:6px 16px;border-radius:20px;
                       font-size:18px;font-weight:700;letter-spacing:1px;">{discount}% OFF</span>
        </td>"""

    coupon_row = ""
    if coupon:
        coupon_row = f"""
        <tr><td align="center" style="padding:6px 0;color:#555;font-size:13px;">
          Use code: <strong style="font-size:15px;letter-spacing:2px;color:#1F6F6B;">{coupon}</strong>
        </td></tr>"""

    hero_img = ""
    if cover.startswith("http"):
        hero_img = f'<img src="{cover}" alt="{title}" style="width:100%;max-height:320px;object-fit:cover;display:block;"/>'

    map_row = ""
    if map_link:
        map_row = f"""
        <tr><td align="center" style="padding:12px 0;">
          <a href="{map_link}" style="color:{_BRAND_COLOR};font-size:13px;text-decoration:none;">
            📍 {address_str} — Open in Maps
          </a>
        </td></tr>"""

    expiry_row = ""
    if end_date:
        expiry_row = f"""
        <tr><td align="center" style="padding:4px 0;color:#888;font-size:12px;">
          Offer valid until {end_date}
        </td></tr>"""

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
    <body style="margin:0;padding:0;background:{_BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="{_BG}">
        <tr><td align="center" style="padding:32px 16px;">
          <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
                 style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:600px;">
            <!-- Hero -->
            <tr><td>{hero_img}</td></tr>
            <!-- Header -->
            <tr><td align="center" style="padding:24px 24px 0;">
              <p style="margin:0;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">{_BRAND_NAME} Local Campaigns</p>
              <h1 style="margin:8px 0 4px;font-size:26px;color:#111;">{title}</h1>
              <p style="margin:0;font-size:15px;color:#555;">{business}</p>
            </td></tr>
            <!-- Discount -->
            <tr>{discount_badge}</tr>
            {coupon_row}
            <!-- Description -->
            <tr><td style="padding:20px 32px;color:#444;font-size:14px;line-height:1.6;">{short_desc}</td></tr>
            {expiry_row}
            {map_row}
            <!-- CTA -->
            <tr><td align="center" style="padding:24px;">
              <a href="{campaign_url}" style="background:{_BRAND_COLOR};color:#fff;text-decoration:none;
                         padding:14px 36px;border-radius:30px;font-size:15px;font-weight:600;
                         display:inline-block;">View Offer</a>
            </td></tr>
            <!-- Footer -->
            <tr><td align="center" style="background:{_BG};padding:20px 24px;
                     border-top:1px solid #eee;font-size:11px;color:#aaa;">
              <p style="margin:0 0 6px;">{_BRAND_NAME} — Your Digital Wardrobe &amp; Local Fashion Hub</p>
              <p style="margin:0;">
                <a href="{app_url}/me" style="color:{_BRAND_COLOR};text-decoration:none;">Manage Notification Preferences</a>
                &nbsp;|&nbsp;
                <a href="{app_url}/me" style="color:{_BRAND_COLOR};text-decoration:none;">Unsubscribe</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
    """


# ---------------------------------------------------------------------------
# Push notification dispatch
# ---------------------------------------------------------------------------

async def notify_campaign_push(campaign_id: str) -> dict[str, Any]:
    """Dispatch push notifications to all eligible users for a campaign."""
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    campaign = await db.experts_campaigns.find_one({"id": campaign_id})
    if not campaign:
        logger.error("Campaign not found: %s", campaign_id)
        return {"error": "campaign not found"}

    if not campaign.get("admin_approved") or campaign.get("status") not in ("active", "approved"):
        logger.warning("Campaign not approved/active — skipping push: %s", campaign_id)
        return {"skipped": "not approved or active"}

    notif_cfg = campaign.get("notifications") or {}
    if not notif_cfg.get("master_enabled") or "push" not in (notif_cfg.get("channels") or []):
        return {"skipped": "push not enabled"}

    if notif_cfg.get("push_sent"):
        return {"skipped": "push already sent"}

    sent_count = 0
    fail_count = 0
    title = campaign.get("title", "Local fashion offer")
    body = "Exclusive fashion offer near you."

    async for user in db.users.find(
        {"web_push_subscriptions.0": {"$exists": True}},
        {"id": 1, "home_location": 1, "sex": 1, "date_of_birth": 1,
         "scheduler_settings": 1, "web_push_subscriptions": 1}
    ):
        user_id = user.get("id")
        if not user_id:
            continue

        if not _user_in_radius(user, campaign):
            continue
        if not _user_matches_audience(user, campaign):
            continue
        if await _already_notified(campaign_id, user_id, "push"):
            continue

        # Check push opt-in in campaign_notification_prefs
        sched = user.get("scheduler_settings") or {}
        prefs = sched.get("campaign_notification_prefs") or {}
        if prefs.get("local_fashion_push") is False:
            continue

        payload = {"url": f"/campaigns/{campaign_id}", "campaign_id": campaign_id}
        result = await web_push_provider.send_push(user_id, title, body, payload)

        status = "sent" if not result.get("error") else "failed"
        if status == "sent":
            sent_count += 1
        else:
            fail_count += 1

        # Record delivery
        await db.campaign_notifications.insert_one({
            "id": __import__("uuid").uuid4().__str__(),
            "campaign_id": campaign_id,
            "user_id": user_id,
            "channel": "push",
            "scheduled_at": now_iso,
            "sent_at": now_iso if status == "sent" else None,
            "status": status,
            "opened": False,
            "clicked": False,
            "failed": status == "failed",
            "failure_reason": result.get("error") if status == "failed" else None,
            "created_at": now_iso,
            "updated_at": now_iso,
        })

    # Mark push as sent on campaign
    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"notifications.push_sent": True,
                  "notifications.push_sent_at": now_iso,
                  "updated_at": now_iso}},
    )
    logger.info("Campaign push sent: campaign=%s sent=%d failed=%d", campaign_id, sent_count, fail_count)
    return {"sent": sent_count, "failed": fail_count}


# ---------------------------------------------------------------------------
# Email notification dispatch
# ---------------------------------------------------------------------------

async def notify_campaign_email(campaign_id: str) -> dict[str, Any]:
    """Dispatch email notifications to all eligible users for a campaign."""
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    campaign = await db.experts_campaigns.find_one({"id": campaign_id})
    if not campaign:
        return {"error": "campaign not found"}

    if not campaign.get("admin_approved") or campaign.get("status") not in ("active", "approved"):
        return {"skipped": "not approved or active"}

    notif_cfg = campaign.get("notifications") or {}
    if not notif_cfg.get("master_enabled") or "email" not in (notif_cfg.get("channels") or []):
        return {"skipped": "email not enabled"}

    if notif_cfg.get("email_sent"):
        return {"skipped": "email already sent"}

    sent_count = 0
    fail_count = 0
    subject = campaign.get("title", "Exclusive offer near you")
    html = _build_campaign_email_html(campaign, _APP_URL)

    async for user in db.users.find(
        {"email": {"$exists": True, "$ne": None}},
        {"id": 1, "email": 1, "home_location": 1, "sex": 1, "date_of_birth": 1,
         "scheduler_settings": 1}
    ):
        user_id = user.get("id")
        email = user.get("email")
        if not user_id or not email:
            continue

        if not _user_in_radius(user, campaign):
            continue
        if not _user_matches_audience(user, campaign):
            continue
        if await _already_notified(campaign_id, user_id, "email"):
            continue

        # Check email opt-in in campaign_notification_prefs
        sched = user.get("scheduler_settings") or {}
        prefs = sched.get("campaign_notification_prefs") or {}
        if prefs.get("local_fashion_email") is False:
            continue

        result = await resend_email_provider.send_email(email, subject, html)
        status = "sent" if not result.get("error") else "failed"
        if status == "sent":
            sent_count += 1
        else:
            fail_count += 1

        await db.campaign_notifications.insert_one({
            "id": __import__("uuid").uuid4().__str__(),
            "campaign_id": campaign_id,
            "user_id": user_id,
            "channel": "email",
            "scheduled_at": now_iso,
            "sent_at": now_iso if status == "sent" else None,
            "status": status,
            "opened": False,
            "clicked": False,
            "failed": status == "failed",
            "failure_reason": result.get("error") if status == "failed" else None,
            "created_at": now_iso,
            "updated_at": now_iso,
        })

    await db.experts_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"notifications.email_sent": True,
                  "notifications.email_sent_at": now_iso,
                  "updated_at": now_iso}},
    )
    logger.info("Campaign email sent: campaign=%s sent=%d failed=%d", campaign_id, sent_count, fail_count)
    return {"sent": sent_count, "failed": fail_count}


# ---------------------------------------------------------------------------
# Batch lifecycle jobs (called from scheduler.py)
# ---------------------------------------------------------------------------

async def activate_scheduled_campaigns() -> None:
    """Promote Approved campaigns whose start_date has arrived to Active."""
    db = get_db()
    now = datetime.now(timezone.utc)
    now_date = now.date().isoformat()
    now_iso = now.isoformat()

    cursor = db.experts_campaigns.find({
        "status": "approved",
        "admin_approved": True,
        "$or": [
            {"start_date": {"$lte": now_date}},
            {"start_date": None},
        ],
    })
    async for campaign in cursor:
        campaign_id = campaign.get("id")
        await db.experts_campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"status": "active", "activated_at": now_iso, "updated_at": now_iso}},
        )
        logger.info("Campaign activated: %s", campaign_id)

        # Fire notifications if timing is start_date or immediate
        notif = campaign.get("notifications") or {}
        timing = notif.get("timing", "immediately_after_approval")
        if notif.get("master_enabled") and timing in ("on_start_date", "immediately_after_approval"):
            channels = notif.get("channels") or []
            if "push" in channels and not notif.get("push_sent"):
                try:
                    await notify_campaign_push(campaign_id)
                except Exception as exc:
                    logger.error("Campaign push failed for %s: %s", campaign_id, exc)
            if "email" in channels and not notif.get("email_sent"):
                try:
                    await notify_campaign_email(campaign_id)
                except Exception as exc:
                    logger.error("Campaign email failed for %s: %s", campaign_id, exc)


async def bill_ended_campaign(campaign: dict[str, Any], db: Any) -> None:
    """Bill the expert when their campaign is completed (either expired or cancelled)."""
    try:
        from app.config import settings
        from app.services.email_service import send_campaign_billing_invoice, fetch_invoice_and_receipt_attachments
        import uuid
        import math
        
        campaign_id = campaign.get("id")
        expert_id = campaign.get("expert_id")
        
        # Calculate active days
        activated_at_str = campaign.get("activated_at")
        if not activated_at_str:
            activated_at_str = campaign.get("created_at")
            
        activated_at = datetime.fromisoformat(activated_at_str.replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        
        total_paused_days = (campaign.get("billing") or {}).get("total_paused_days", 0)
        
        # Calculate duration
        total_seconds = (now_dt - activated_at).total_seconds()
        active_seconds = max(0, total_seconds - (total_paused_days * 86400))
        active_days = math.ceil(active_seconds / 86400.0)
        active_days = max(1, active_days)
        
        # Get expert record
        expert = await db.users.find_one({"id": expert_id})
        if not expert:
            logger.warning(f"Could not find expert {expert_id} for campaign {campaign_id} billing.")
            return
            
        # Convert $1/day directly (currency is USD)
        amount_usd = active_days * 1.00
        amount_cents = int(amount_usd * 100)
        
        # Create transaction doc
        paypal_payment_id = f"ncp_end_{uuid.uuid4().hex[:12].upper()}"
        topup_doc = {
            "id": f"camp_pay_{uuid.uuid4().hex[:12]}",
            "atzmai_payment_id": paypal_payment_id,
            "user_id": expert_id,
            "campaign_id": campaign_id,
            "amount_cents": amount_cents,
            "currency": "USD",
            "type": "campaign_final",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.atzmai_topups.insert_one(topup_doc)
        
        # Auto-capture mock campaign billing
        await db.atzmai_topups.update_one(
            {"atzmai_payment_id": paypal_payment_id},
            {"$set": {"status": "captured", "captured_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update campaign billing fields
        await db.experts_campaigns.update_one(
            {"id": campaign_id},
            {"$set": {
                "billing.payment_status": "paid",
                "billing.total_active_days": active_days,
                "billing.total_fee_cents": amount_cents,
                "billing.final_payment_id": paypal_payment_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Send invoice + receipt PDFs
        attachments = []
        try:
            attachments = await fetch_invoice_and_receipt_attachments(amount_cents)
        except Exception as e:
            logger.error(f"Failed to fetch attachments: {e}")
            
        try:
            await send_campaign_billing_invoice(
                to=expert["email"],
                user=expert,
                campaign=campaign,
                amount_cents=amount_cents,
                currency="USD",
                active_days=active_days,
                transaction_id=paypal_payment_id,
                attachments=attachments
            )
            logger.info(f"Campaign final invoice and email sent for campaign {campaign_id}")
        except Exception as e:
            logger.error(f"Failed to send campaign billing email: {e}")
            
    except Exception as e:
        logger.error(f"Error in bill_ended_campaign: {e}")


async def expire_overdue_campaigns() -> None:
    """Move Active campaigns past their end_date to Expired and bill them."""
    db = get_db()
    now_date = datetime.now(timezone.utc).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor = db.experts_campaigns.find({
        "status": "active",
        "end_date": {"$lt": now_date, "$ne": None},
    })
    
    expired_count = 0
    async for campaign in cursor:
        campaign_id = campaign.get("id")
        
        # Bill the campaign
        await bill_ended_campaign(campaign, db)
        
        # Expire it
        await db.experts_campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"status": "expired", "expired_at": now_iso, "updated_at": now_iso}}
        )
        expired_count += 1
        logger.info(f"Expired and billed campaign {campaign_id}")
        
    if expired_count:
        logger.info("Expired %d campaigns total", expired_count)
