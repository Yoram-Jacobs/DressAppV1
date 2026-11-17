"""Idempotent backfill script for missing FashionCLIP embeddings and color signatures.

Populates:
  - ``closet_items`` missing ``clip_embedding`` or ``source_color_sig``
  - ``listings`` missing ``clip_embedding``

Usage:
    python scripts/backfill_clip_embeddings.py
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import get_db  # noqa: E402
from app.services.closet_service import read_image_bytes_from_url  # noqa: E402
from app.services.fashion_clip import ensure_doc_clip_embedding  # noqa: E402
from app.services.image_hash import AUTHORITATIVE_SOURCE_FIELDS, compute_signatures  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_clip")


async def backfill_once() -> dict[str, int]:
    """Backfill missing clip_embedding and source_color_sig across closet_items and listings."""
    db = get_db()
    closet_updated = 0
    color_updated = 0
    listings_updated = 0

    cursor = db.closet_items.find(
        {
            "$or": [
                {"clip_embedding": {"$exists": False}},
                {"clip_embedding": None},
                {"clip_embedding": {"$size": 0}},
                {"source_color_sig": {"$exists": False}},
                {"source_color_sig": None},
            ]
        }
    )
    async for item in cursor:
        patch: dict = {}
        raw_bytes: bytes | None = None
        for fld in AUTHORITATIVE_SOURCE_FIELDS:
            src = item.get(fld)
            if isinstance(src, str) and src.strip():
                try:
                    raw_bytes = await read_image_bytes_from_url(src.strip())
                except Exception:
                    raw_bytes = None
                if raw_bytes:
                    break

        if not item.get("source_color_sig") and raw_bytes:
            ph, cs = compute_signatures(raw_bytes)
            if cs:
                patch["source_color_sig"] = cs
                color_updated += 1
            if not item.get("source_phash") and ph:
                patch["source_phash"] = ph

        if not (isinstance(item.get("clip_embedding"), list) and item["clip_embedding"]):
            vec = await ensure_doc_clip_embedding(item, image_bytes=raw_bytes)
            if vec:
                patch["clip_embedding"] = vec
                closet_updated += 1

        if patch:
            await db.closet_items.update_one({"id": item["id"]}, {"$set": patch})

    l_cursor = db.listings.find(
        {
            "$or": [
                {"clip_embedding": {"$exists": False}},
                {"clip_embedding": None},
                {"clip_embedding": {"$size": 0}},
            ]
        }
    )
    async for lst in l_cursor:
        vec = None
        cid = lst.get("closet_item_id")
        if cid:
            linked = await db.closet_items.find_one({"id": cid}, {"clip_embedding": 1})
            if linked and isinstance(linked.get("clip_embedding"), list) and linked["clip_embedding"]:
                vec = linked["clip_embedding"]
        if not vec:
            vec = await ensure_doc_clip_embedding(lst)
        if vec:
            await db.listings.update_one({"id": lst["id"]}, {"$set": {"clip_embedding": vec}})
            listings_updated += 1

    return {
        "closet_embeddings_updated": closet_updated,
        "closet_color_sigs_updated": color_updated,
        "listings_embeddings_updated": listings_updated,
    }


if __name__ == "__main__":
    summary = asyncio.run(backfill_once())
    logger.info("Backfill complete: %s", summary)
