"""Real-time universal sync API routes."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.auth import get_current_user, decode_access_token
from app.services.sync_service import (
    broadcast_sync_event,
    get_user_sync_status,
    sync_event_generator,
)

logger = logging.getLogger("dressapp.sync.api")

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncNotifyIn(BaseModel):
    event_type: str
    payload: dict[str, Any] | None = None


async def get_user_from_header_or_query(
    token: str | None = Query(default=None),
    current_user: dict | None = Depends(lambda: None),
) -> dict:
    """Allow authentication via either Authorization header or ?token= query parameter (for standard EventSource)."""
    if current_user:
        return current_user
    if token:
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            from app.db.database import get_db
            db = get_db()
            user = await db.users.find_one({"id": payload["sub"]})
            if user:
                return user
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


@router.get("/status")
async def get_sync_status(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Return the current sync version vector for the user."""
    return await get_user_sync_status(user["id"])


@router.get("/stream")
async def sync_stream(
    token: str | None = Query(default=None),
) -> StreamingResponse:
    """Server-Sent Events (SSE) stream for real-time cross-device activity updates."""
    if not token:
        raise HTTPException(status_code=401, detail="Token parameter required for SSE stream")
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload["sub"]
    
    return StreamingResponse(
        sync_event_generator(user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
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
