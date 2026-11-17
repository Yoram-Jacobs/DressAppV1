"""Idempotent P2 production data hygiene & migration script.

Fixes:
  1. BUG-DATA-01: Normalize closet_items.category, listings.category,
     trend_reports.country_code ('ISRAEL'/'ISRAEL ' -> 'IL'), and
     users.body_measurements / users.measurements dual legacy keys.
  2. BUG-DATA-02: Pre-warm Portuguese ('pt') trend_reports translations.
  3. BUG-PERF-01: Offload oversized inline data:image/* payloads in
     db.outfits and db.listings via UploadManager to /static/uploads (or R2).
  4. BUG-FUNNEL-01: Backfill null/missing migration_sessions.status.
  5. Purge confirmed synthetic test artifacts in production billing/ad tables.

Usage:
    python scripts/p2_db_cleanup.py [--dry-run] [--no-pt] [--keep-test-rows]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import get_db  # noqa: E402
from app.services.canonical import canonicalize_category, canonicalize_measurements  # noqa: E402
from app.services.trend_scout import normalize_country_code, warm_trend_translations  # noqa: E402
from app.services.upload_manager import UploadManager  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("p2_db_cleanup")

_INLINE_OFFLOAD_THRESHOLD = 15_000


async def _offload_value(val: Any, dry_run: bool) -> tuple[Any, bool]:
    """Recursively offload inline data:image/* strings exceeding threshold."""
    if isinstance(val, str):
        if val.startswith("data:image/") and len(val) > _INLINE_OFFLOAD_THRESHOLD:
            if dry_run:
                return val, True
            uploaded = await UploadManager.upload_data_url(val)
            return uploaded, uploaded != val
        return val, False
    if isinstance(val, list):
        changed = False
        out = []
        for elem in val:
            new_elem, elem_changed = await _offload_value(elem, dry_run)
            out.append(new_elem)
            changed = changed or elem_changed
        return out, changed
    if isinstance(val, dict):
        changed = False
        out_dict: dict[str, Any] = {}
        for k, v in val.items():
            if k == "_id":
                out_dict[k] = v
                continue
            new_v, v_changed = await _offload_value(v, dry_run)
            out_dict[k] = new_v
            changed = changed or v_changed
        return out_dict, changed
    return val, False


async def run_cleanup(
    *,
    dry_run: bool = False,
    warm_pt: bool = True,
    purge_test_rows: bool = True,
) -> dict[str, Any]:
    """Execute idempotent P2 MongoDB cleanup & normalization tasks."""
    db = get_db()
    stats: dict[str, Any] = {
        "dry_run": dry_run,
        "closet_categories_normalized": 0,
        "listings_categories_normalized": 0,
        "listings_media_offloaded": 0,
        "outfits_media_offloaded": 0,
        "users_measurements_normalized": 0,
        "trend_countries_normalized": 0,
        "migration_sessions_backfilled": 0,
        "pt_trends_warmed": 0,
        "test_rows_purged": {"credit_topups": 0, "atzmai_topups": 0, "ad_campaigns": 0},
    }

    # 1. Canonicalize closet_items.category
    async for doc in db.closet_items.find({}, {"_id": 0, "id": 1, "category": 1}):
        raw_cat = doc.get("category")
        canon = canonicalize_category(raw_cat, default="Top")
        if canon and raw_cat != canon:
            stats["closet_categories_normalized"] += 1
            if not dry_run and doc.get("id"):
                await db.closet_items.update_one(
                    {"id": doc["id"]},
                    {"$set": {"category": canon, "updated_at": datetime.now(timezone.utc).isoformat()}},
                )

    # 2. Canonicalize listings.category & offload base64 listing images
    async for lst in db.listings.find({}):
        patch: dict[str, Any] = {}
        raw_cat = lst.get("category")
        canon = canonicalize_category(raw_cat, default="Top")
        if canon and raw_cat != canon:
            patch["category"] = canon
            stats["listings_categories_normalized"] += 1

        offload_hit = False
        for fld in ("images", "clean_image_url", "reconstructed_image_url", "thumbnail_data_url"):
            val = lst.get(fld)
            if val is not None:
                new_val, changed = await _offload_value(val, dry_run)
                if changed:
                    offload_hit = True
                    if not dry_run:
                        patch[fld] = new_val
        if offload_hit:
            stats["listings_media_offloaded"] += 1

        if patch and not dry_run and lst.get("id"):
            patch["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.listings.update_one({"id": lst["id"]}, {"$set": patch})

    # 3. Offload inline base64 images inside outfits
    async for outfit in db.outfits.find({}):
        outfit_patch: dict[str, Any] = {}
        outfit_changed = False
        for key, val in outfit.items():
            if key in ("_id", "id", "user_id", "name", "description", "source_workflow", "created_at", "updated_at"):
                continue
            new_val, changed = await _offload_value(val, dry_run)
            if changed:
                outfit_changed = True
                if not dry_run:
                    outfit_patch[key] = new_val
        if outfit_changed:
            stats["outfits_media_offloaded"] += 1
            if not dry_run and outfit.get("id"):
                outfit_patch["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.outfits.update_one({"id": outfit["id"]}, {"$set": outfit_patch})

    # 4. Canonicalize legacy dual keys inside users.body_measurements / users.measurements
    async for u in db.users.find({}, {"_id": 0, "id": 1, "body_measurements": 1, "measurements": 1}):
        u_patch: dict[str, Any] = {}
        for fld in ("body_measurements", "measurements"):
            cur = u.get(fld)
            if isinstance(cur, dict) and cur:
                norm_m = canonicalize_measurements(cur)
                if norm_m != cur:
                    u_patch[fld] = norm_m
        if u_patch:
            stats["users_measurements_normalized"] += 1
            if not dry_run and u.get("id"):
                await db.users.update_one({"id": u["id"]}, {"$set": u_patch})

    # 5. Normalize trend_reports.country_code ('ISRAEL', 'ISRAEL ' -> 'IL')
    async for tr in db.trend_reports.find(
        {"country_code": {"$ne": None}},
        {"_id": 1, "id": 1, "country_code": 1},
    ):
        raw_cc = tr.get("country_code")
        norm_cc = normalize_country_code(raw_cc)
        if norm_cc and norm_cc != raw_cc:
            stats["trend_countries_normalized"] += 1
            if not dry_run:
                flt = {"id": tr["id"]} if tr.get("id") else {"_id": tr["_id"]}
                await db.trend_reports.update_one(flt, {"$set": {"country_code": norm_cc}})

    # 6. Backfill missing migration_sessions.status
    async for sess in db.migration_sessions.find(
        {"$or": [{"status": {"$exists": False}}, {"status": None}]},
        {"_id": 0, "id": 1, "parsed_hashes": 1},
    ):
        has_hashes = bool(sess.get("parsed_hashes"))
        next_status = "completed" if has_hashes else "expired"
        stats["migration_sessions_backfilled"] += 1
        if not dry_run and sess.get("id"):
            await db.migration_sessions.update_one(
                {"id": sess["id"]},
                {"$set": {"status": next_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )

    # 7. Warm missing Portuguese ('pt') trend_reports
    if warm_pt and not dry_run:
        warmed = await warm_trend_translations(languages=["pt"], country="IL", limit_per_gender=10)
        stats["pt_trends_warmed"] = warmed.get("pt", 0)

    # 8. Purge synthetic test artifacts in production collections
    if purge_test_rows:
        credit_q = {"$or": [{"id": "topup-123"}, {"user_id": "test-user-billing-id"}]}
        atzmai_q = {"payment_url": {"$regex": r"^https://example\.com/mock-atzmai-payment-link"}}
        ads_q = {"id": {"$regex": r"^demo-campaign-"}}
        if dry_run:
            stats["test_rows_purged"]["credit_topups"] = await db.credit_topups.count_documents(credit_q)
            stats["test_rows_purged"]["atzmai_topups"] = await db.atzmai_topups.count_documents(atzmai_q)
            stats["test_rows_purged"]["ad_campaigns"] = await db.ad_campaigns.count_documents(ads_q)
        else:
            r1 = await db.credit_topups.delete_many(credit_q)
            r2 = await db.atzmai_topups.delete_many(atzmai_q)
            r3 = await db.ad_campaigns.delete_many(ads_q)
            stats["test_rows_purged"] = {
                "credit_topups": r1.deleted_count,
                "atzmai_topups": r2.deleted_count,
                "ad_campaigns": r3.deleted_count,
            }

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Run idempotent P2 DressApp MongoDB cleanup.")
    parser.add_argument("--dry-run", action="store_true", help="Report counts without mutating MongoDB.")
    parser.add_argument("--no-pt", action="store_true", help="Skip Portuguese trend warmup.")
    parser.add_argument("--keep-test-rows", action="store_true", help="Keep synthetic test rows.")
    args = parser.parse_args()

    result = asyncio.run(
        run_cleanup(
            dry_run=args.dry_run,
            warm_pt=not args.no_pt,
            purge_test_rows=not args.keep_test_rows,
        )
    )
    logger.info("P2 DB cleanup summary: %s", result)


if __name__ == "__main__":
    main()
