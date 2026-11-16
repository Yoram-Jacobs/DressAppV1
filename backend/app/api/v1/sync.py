"""Real-time universal sync API routes."""
from __future__ import annotations

import logging
import secrets
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.auth import get_current_user, decode_token
from app.services.sync_service import (
    broadcast_sync_event,
    get_user_sync_status,
    sync_event_generator,
)

logger = logging.getLogger("dressapp.sync.api")

router = APIRouter(prefix="/sync", tags=["sync"])

# Short-lived single-use opaque tickets for EventSource connections so master JWTs
# never appear in SSE query strings or access logs.
_SSE_TICKET_TTL_SECONDS = 60
_SSE_TICKETS_MAX = 5000
_sse_tickets: dict[str, tuple[str, float]] = {}


def _prune_expired_tickets(now: float) -> None:
    expired = [k for k, (_, exp) in _sse_tickets.items() if exp <= now]
    for k in expired:
        _sse_tickets.pop(k, None)
    if len(_sse_tickets) > _SSE_TICKETS_MAX:
        overflow = len(_sse_tickets) - _SSE_TICKETS_MAX
        for k in list(_sse_tickets.keys())[:overflow]:
            _sse_tickets.pop(k, None)


def _mint_sse_ticket(user_id: str) -> str:
    now = time.time()
    _prune_expired_tickets(now)
    ticket = f"stkt_{secrets.token_urlsafe(32)}"
    _sse_tickets[ticket] = (user_id, now + _SSE_TICKET_TTL_SECONDS)
    return ticket


def _consume_sse_ticket(ticket: str) -> str | None:
    now = time.time()
    _prune_expired_tickets(now)
    entry = _sse_tickets.pop(ticket, None)
    if not entry:
        return None
    user_id, exp = entry
    if exp <= now:
        return None
    return user_id


class SyncNotifyIn(BaseModel):
    event_type: str
    payload: dict[str, Any] | None = None


@router.get("/status")
async def get_sync_status(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Return the current sync version vector for the user."""
    return await get_user_sync_status(user["id"])


@router.post("/ticket")
async def create_sync_ticket(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Exchange a Bearer token for a short-lived single-use opaque SSE stream ticket."""
    ticket = _mint_sse_ticket(user["id"])
    return {
        "ticket": ticket,
        "expires_in": _SSE_TICKET_TTL_SECONDS,
    }


@router.get("/stream")
async def sync_stream(
    ticket: str | None = Query(default=None),
    token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> StreamingResponse:
    """Server-Sent Events (SSE) stream for real-time cross-device activity updates."""
    user_id: str | None = None

    if ticket:
        user_id = _consume_sse_ticket(ticket)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired SSE ticket",
            )
    elif authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization.split(" ", 1)[1].strip()
        payload = decode_token(bearer_token)
        user_id = payload.get("sub")
    elif token:
        # Reject long-lived master JWTs leaked in URL query strings; only allow
        # short-lived purpose-scoped SSE tokens if explicitly issued.
        payload = decode_token(token)
        exp = int(payload.get("exp") or 0)
        iat = int(payload.get("iat") or 0)
        if payload.get("purpose") != "sse_stream" or not exp or not iat or (exp - iat) > 180:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Master JWT cannot be passed in query parameters; use POST /api/v1/sync/ticket.",
            )
        user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SSE ticket or Authorization header required",
        )

    return StreamingResponse(
        sync_event_generator(user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/notify")
async def notify_sync_event(
    body: SyncNotifyIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Notify all connected devices of an action completed on this client."""
    await broadcast_sync_event(user["id"], body.event_type, body.payload)
    return {"status": "ok", "event": body.event_type}
