"""Simulated Push Notification Service (Phase Scheduler)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db

logger = logging.getLogger(__name__)


async def send_push_notification(user_id: str, title: str, body: str) -> dict[str, Any]:
    """Simulate sending a push notification to a user's phone.

    Inserts the alert into the `simulated_notifications` collection so the
    frontend sandbox dashboard can fetch it and display notifications in real-time.
    """
    db = get_db()
    notif_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

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
    logger.info(
        "Simulated PUSH sent to user_id=%s id=%s title=%r body=%r",
        user_id,
        notif_id,
        title,
        body,
    )
    return {k: v for k, v in doc.items() if k != "_id"}
