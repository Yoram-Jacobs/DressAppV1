"""Simulated & Native Web Push Notification Service (Phase Scheduler)."""
from __future__ import annotations

import logging
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db
from app.config import settings

# Monkeypatch cryptography to fix pywebpush SECP256R1 class vs instance compatibility issue
import cryptography.hazmat.primitives.asymmetric.ec as ec
_orig_generate_private_key = ec.generate_private_key

def _patched_generate_private_key(curve, backend=None):
    if curve == ec.SECP256R1:
        curve = ec.SECP256R1()
    return _orig_generate_private_key(curve, backend)

ec.generate_private_key = _patched_generate_private_key

from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


async def send_push_notification(user_id: str, title: str, body: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
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
    if payload:
        doc["payload"] = payload
    await db.simulated_notifications.insert_one(doc)

    # 2. Query user to find active web push subscriptions
    user = await db.users.find_one({"id": user_id})
    if not user:
        logger.warning("User not found for push: user_id=%s", user_id)
        return {k: v for k, v in doc.items() if k != "_id"}

    subscriptions = user.get("web_push_subscriptions") or []
    if not subscriptions:
        logger.info("No active web push subscriptions registered for user_id=%s", user_id)
        return {k: v for k, v in doc.items() if k != "_id"}

    # Require VAPID keys to send real push alerts
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured in server environment. Skipping browser Web Push.")
        return {k: v for k, v in doc.items() if k != "_id"}

    # For native browser push, send a truncated body if it is too long or contains newlines,
    # to keep the encrypted push payload under the 4096-byte Web Push protocol limit
    web_push_body = body
    if len(body.encode('utf-8')) > 1000 or "\n" in body:
        first_line = body.split("\n")[0].strip()
        if len(first_line.encode('utf-8')) > 200:
            web_push_body = first_line[:150] + "..."
        else:
            web_push_body = first_line
            if ":" in web_push_body:
                clean_body = web_push_body.rstrip(":")
                if any("\u0590" <= c <= "\u05ff" for c in clean_body):
                    web_push_body = clean_body + " · לחץ לצפייה בהצעות."
                elif any("\u0600" <= c <= "\u06ff" for c in clean_body):
                    web_push_body = clean_body + " · اضغط לעرض المقترحات."
                else:
                    web_push_body = clean_body + " · Tap to view recommendations."

    # Write VAPID private key to a temp file if it's PEM format (starts with ---)
    # or contains newlines, because pywebpush from_string expects DER format.
    private_key_input = settings.VAPID_PRIVATE_KEY
    if private_key_input:
        private_key_input = private_key_input.strip('"').replace("\\n", "\n")

    vapid_key_param = private_key_input
    temp_key_file = None
    if private_key_input and "-----BEGIN" in private_key_input:
        import tempfile
        import os
        try:
            fd, path = tempfile.mkstemp()
            with os.fdopen(fd, 'w') as f:
                f.write(private_key_input)
            temp_key_file = path
            vapid_key_param = path
        except Exception as e:
            logger.error("Failed to create temporary VAPID key file: %s", e)

    payload_dict = {
        "title": title,
        "body": web_push_body,
        "url": "/stylist?tab=match"
    }

    payload_data_str = json.dumps(payload_dict)

    # Send web push to each registered subscription endpoint
    for sub in subscriptions:
        try:
            # pywebpush blocks synchronously, but since it is a fast HTTP call we can wrap it or call it inline.
            # In a production environment, this could be delegated to a task runner.
            webpush(
                subscription_info=sub,
                data=payload_data_str,
                vapid_private_key=vapid_key_param,
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

    if temp_key_file:
        try:
            import os
            os.unlink(temp_key_file)
        except Exception as e:
            logger.error("Failed to unlink temporary VAPID key file: %s", e)

    return {k: v for k, v in doc.items() if k != "_id"}
