"""Abstract notification provider interface (Experts Campaign Platform).

This module defines the ``NotificationProvider`` protocol so campaign
notification dispatch is decoupled from the concrete transport.  Swapping
from Web-Push/Resend to OneSignal, FCM, SMS, or WhatsApp later requires
only a new concrete class — campaign_service.py stays unchanged.
"""
from __future__ import annotations

import logging
from typing import Any, Protocol

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Protocol (structural typing — no ABC overhead)
# ---------------------------------------------------------------------------
class NotificationProvider(Protocol):
    """Minimal interface every notification channel must implement."""

    async def send_push(
        self,
        user_id: str,
        title: str,
        body: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    async def send_email(
        self,
        to: str,
        subject: str,
        html: str,
    ) -> dict[str, Any]: ...


# ---------------------------------------------------------------------------
# Concrete: Web Push (VAPID / pywebpush)
# ---------------------------------------------------------------------------
class WebPushProvider:
    """Wraps the existing push_service to satisfy NotificationProvider."""

    async def send_push(
        self,
        user_id: str,
        title: str,
        body: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        from app.services.push_service import send_push_notification

        return await send_push_notification(user_id, title, body, payload)

    async def send_email(
        self,
        to: str,
        subject: str,
        html: str,
    ) -> dict[str, Any]:
        """Not supported for this provider."""
        raise NotImplementedError("WebPushProvider does not send emails")


# ---------------------------------------------------------------------------
# Concrete: Resend email
# ---------------------------------------------------------------------------
class ResendEmailProvider:
    """Wraps the existing email_service._send to satisfy NotificationProvider."""

    async def send_push(
        self,
        user_id: str,
        title: str,
        body: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Not supported for this provider."""
        raise NotImplementedError("ResendEmailProvider does not send push")

    async def send_email(
        self,
        to: str,
        subject: str,
        html: str,
    ) -> dict[str, Any]:
        from app.services.email_service import _send

        return await _send(to, subject, html)


# ---------------------------------------------------------------------------
# Singletons (imported by campaign_service)
# ---------------------------------------------------------------------------
web_push_provider = WebPushProvider()
resend_email_provider = ResendEmailProvider()
