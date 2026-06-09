"""Simulated & Native Web Push Notification Service (Phase Scheduler)."""
from __future__ import annotations

import logging
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db
from app.config import settings
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


async def send_push_notification(user_id: str, title: str, body: str) -> dict[str, Any]:
    """Simulate push alert and send real Native Web Push notifications via VAPID.

    1. Inserts mock notification log into the `simulated_notifications` collection.
    2. Iterates over user's `web_push_subscriptions` and signs/sends native browser alerts.
    """
    db = get_db()
    notif_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # 1. Log simulated notification
    doc = {
        "id": notif_id,
        "user_id": user_id,
        "title": title,
        "body": body,
        "read": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.simulated_notifications.insert_one(doc)

    # 2. Query user to find active web push subscriptions
    user = await db.users.find_one({"id": user_id})
    if not user:
        logger.warning("User not found for push: user_id=%s", user_id)
        return {k: v for k, v in doc.items() if k != "_id"}

    # Send via Aimtell if API key and Site ID are configured
    if settings.AIMTELL_API_KEY and settings.AIMTELL_SITE_ID:
        try:
            import httpx
            headers = {
                "X-Authorization-Api-Key": settings.AIMTELL_API_KEY,
                "Content-Type": "application/json"
            }
            aimtell_payload = {
                "idSite": int(settings.AIMTELL_SITE_ID),
                "title": title,
                "body": body,
                "link": "https://dressapp.co/",
                "alias": user_id
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.aimtell.com/v1/notifications",
                    headers=headers,
                    json=aimtell_payload
                )
                if response.status_code == 200:
                    logger.info("Sent push notification via Aimtell successfully to user_id=%s", user_id)
                else:
                    logger.error(
                        "Failed to send push notification via Aimtell: HTTP %d, Response: %s",
                        response.status_code,
                        response.text
                    )
        except Exception as e:
            logger.error("Error sending push notification via Aimtell: %s", e)

    subscriptions = user.get("web_push_subscriptions") or []
    if not subscriptions:
        logger.info("No active web push subscriptions registered for user_id=%s", user_id)
        return {k: v for k, v in doc.items() if k != "_id"}

    # Require VAPID keys to send real push alerts
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured in server environment. Skipping browser Web Push.")
        return {k: v for k, v in doc.items() if k != "_id"}

    payload = json.dumps({
        "title": title,
        "body": body,
    })

    # Send web push to each registered subscription endpoint
    for sub in subscriptions:
        try:
            # pywebpush blocks synchronously, but since it is a fast HTTP call we can wrap it or call it inline.
            # In a production environment, this could be delegated to a task runner.
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"}
            )
            logger.info("Sent Web Push successfully to endpoint=%s", sub.get("endpoint")[:45] + "...")
        except WebPushException as ex:
            # Handle expired / gone subscription endpoints (404 Not Found or 410 Gone)
            if ex.response is not None and ex.response.status_code in (404, 410):
                logger.info("Subscription endpoint has expired (HTTP %d). Removing from user.", ex.response.status_code)
                await db.users.update_one(
                    {"id": user_id},
                    {"$pull": {"web_push_subscriptions": {"endpoint": sub["endpoint"]}}}
                )
            else:
                logger.error("WebPushException sending notification: %s", ex)
        except Exception as e:
            logger.error("General error sending Web Push notification: %s", e)

    return {k: v for k, v in doc.items() if k != "_id"}
