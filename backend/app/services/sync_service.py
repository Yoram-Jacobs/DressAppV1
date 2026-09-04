"""Universal Sync Service for DressApp.

Provides real-time Server-Sent Events (SSE) broadcasting to all connected
client interfaces (Mobile, Web, Desktop) and maintains version vectors in MongoDB.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from app.db.database import get_db

logger = logging.getLogger("dressapp.sync")

# In-memory registry of active subscriber queues per user_id
# user_id -> set of asyncio.Queue
_subscribers: dict[str, set[asyncio.Queue]] = {}
_lock = asyncio.Lock()

DEFAULT_SYNC_DOMAINS = (
    "profile",
    "closet",
    "daily_suggestions",
    "stylist",
    "lookbook",
    "trend_scout",
)


async def register_subscriber(user_id: str) -> asyncio.Queue:
    """Register a new SSE stream queue for a user."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    async with _lock:
        if user_id not in _subscribers:
            _subscribers[user_id] = set()
        _subscribers[user_id].add(queue)
    logger.debug("Registered sync subscriber for user %s (total: %d)", user_id, len(_subscribers.get(user_id, set())))
    return queue


async def unregister_subscriber(user_id: str, queue: asyncio.Queue) -> None:
    """Remove an SSE stream queue when client disconnects."""
    async with _lock:
        if user_id in _subscribers:
            _subscribers[user_id].discard(queue)
            if not _subscribers[user_id]:
                del _subscribers[user_id]
    logger.debug("Unregistered sync subscriber for user %s", user_id)


async def increment_sync_version(user_id: str, domain: str) -> int:
    """Increment the sync version for a domain in MongoDB and return the new version."""
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    version_key = f"sync_versions.{domain}"
    
    res = await db.users.find_one_and_update(
        {"id": user_id},
        {
            "$inc": {version_key: 1},
            "$set": {
                "sync_versions.last_updated_at": now_iso,
                "sync_versions.last_domain": domain,
            },
        },
        upsert=True,
        return_document=True,
        projection={"sync_versions": 1},
    )
    
    sync_versions = (res or {}).get("sync_versions") or {}
    return int(sync_versions.get(domain, 1))


async def get_user_sync_status(user_id: str) -> dict[str, Any]:
    """Retrieve the current version vector and last updated timestamp for a user."""
    db = get_db()
    user_doc = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "sync_versions": 1},
    )
    sync_versions = (user_doc or {}).get("sync_versions") or {}
    
    status: dict[str, Any] = {
        "last_updated_at": sync_versions.get("last_updated_at") or datetime.now(timezone.utc).isoformat(),
        "versions": {},
    }
    for domain in DEFAULT_SYNC_DOMAINS:
        status["versions"][domain] = int(sync_versions.get(domain, 0))
    return status


async def broadcast_sync_event(
    user_id: str,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Broadcast a synchronization event to all connected devices for a user.
    
    Also automatically increments the relevant domain version in MongoDB.
    """
    domain_map = {
        "profile_updated": "profile",
        "closet_updated": "closet",
        "daily_suggestions_updated": "daily_suggestions",
        "stylist_updated": "stylist",
        "lookbook_updated": "lookbook",
        "trend_scout_updated": "trend_scout",
    }
    domain = domain_map.get(event_type, "profile")
    
    try:
        new_version = await increment_sync_version(user_id, domain)
    except Exception as exc:
        logger.warning("Could not increment sync version for %s (%s): %s", user_id, domain, exc)
        new_version = 1

    event_data = {
        "type": event_type,
        "domain": domain,
        "version": new_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": payload or {},
    }
    
    raw_message = f"event: sync\ndata: {json.dumps(event_data)}\n\n"
    
    async with _lock:
        queues = list(_subscribers.get(user_id, []))
        
    for q in queues:
        try:
            q.put_nowait(raw_message)
        except asyncio.QueueFull:
            try:
                q.get_nowait()
                q.put_nowait(raw_message)
            except Exception:
                pass


async def sync_event_generator(user_id: str) -> AsyncGenerator[str, None]:
    """Yield SSE formatted events to a connected client, with periodic heartbeats."""
    queue = await register_subscriber(user_id)
    
    # Send initial connection handshake
    initial_status = await get_user_sync_status(user_id)
    handshake = {
        "type": "connected",
        "status": initial_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    yield f"event: connected\ndata: {json.dumps(handshake)}\n\n"
    
    try:
        while True:
            try:
                # Wait for event with a 20s timeout to deliver keepalive heartbeats
                msg = await asyncio.wait_for(queue.get(), timeout=20.0)
                yield msg
            except asyncio.TimeoutError:
                # Heartbeat keepalive comment prevents proxies/browsers from dropping connection
                yield ": keepalive\n\n"
    finally:
        await unregister_subscriber(user_id, queue)
