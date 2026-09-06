"""MongoDB (Motor) client with idempotent index bootstrap."""
from __future__ import annotations

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_clients_by_loop: dict[int, AsyncIOMotorClient] = {}


def get_client() -> AsyncIOMotorClient:
    global _client
    try:
        loop = asyncio.get_running_loop()
        loop_id = id(loop)
        if loop_id not in _clients_by_loop:
            _clients_by_loop[loop_id] = AsyncIOMotorClient(settings.MONGO_URL)
        return _clients_by_loop[loop_id]
    except RuntimeError:
        if _client is None:
            _client = AsyncIOMotorClient(settings.MONGO_URL)
        return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.DB_NAME]


async def ensure_indexes() -> None:
    """Create every index DressApp expects. Safe to call at every startup."""
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("stripe_account_id", sparse=True)

    await db.closet_items.create_index(
        [("user_id", 1), ("source", 1), ("category", 1)]
    )
    # Compound index to back the main /closet list query
    # (`find({user_id}).sort(created_at DESC)`). Without this index Atlas
    # M0 tries an in-memory sort, caps at 32 MB, and 500s once the
    # closet has a few dozen items carrying base64 crop thumbnails.
    await db.closet_items.create_index(
        [("user_id", 1), ("created_at", -1)],
        name="user_id_1_created_at_-1",
    )
    await db.closet_items.create_index(
        [("title", "text"), ("brand", "text"), ("tags", "text")]
    )

    await db.listings.create_index([("source", 1), ("status", 1), ("category", 1)])
    await db.listings.create_index([("seller_id", 1), ("status", 1)])
    await db.listings.create_index([("location", "2dsphere")], sparse=True)

    await db.transactions.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.transactions.create_index([("seller_id", 1), ("created_at", -1)])
    # Partial-filter unique index: only enforce uniqueness when the Stripe
    # checkout session id is actually a non-empty string. This avoids the
    # classic "duplicate key on null" problem that breaks pre-payment writes.
    try:
        await db.transactions.drop_index("stripe.checkout_session_id_1")
    except Exception:  # noqa: BLE001
        pass
    await db.transactions.create_index(
        [("stripe.checkout_session_id", 1)],
        unique=True,
        partialFilterExpression={"stripe.checkout_session_id": {"$type": "string"}},
        name="stripe_checkout_session_id_unique_partial",
    )

    # Multi-session: one user can have many conversation threads, so we
    # index user_id non-uniquely alongside last_active_at for the sidebar
    # list. The legacy unique index (if present) is dropped on boot.
    try:
        await db.stylist_sessions.drop_index("user_id_1")
    except Exception:  # noqa: BLE001
        # Index may not exist (fresh DB) — safe to ignore.
        pass
    await db.stylist_sessions.create_index([("user_id", 1), ("last_active_at", -1)])
    await db.stylist_messages.create_index([("session_id", 1), ("created_at", -1)])

    await db.embeddings.create_index(
        [("entity_type", 1), ("entity_id", 1)], unique=True
    )

    await db.cultural_rules.create_index(
        [("region", 1), ("religion", 1), ("occasion", 1)]
    )
    await db.trend_reports.create_index([("date", -1), ("bucket", 1)])
    # Phase R+S: multi-language cards. Legacy unique index didn't include
    # `language` — drop and replace so we can persist per-(bucket,date,lang).
    try:
        await db.trend_reports.drop_index("bucket_1_date_1")
    except Exception:  # noqa: BLE001
        pass
    try:
        await db.trend_reports.drop_index("bucket_1_date_1_language_1")
    except Exception:  # noqa: BLE001
        pass
    await db.trend_reports.create_index(
        [("bucket", 1), ("date", 1), ("language", 1), ("country_code", 1)], unique=True, sparse=True
    )
    await db.trend_reports.create_index(
        [("origin_id", 1), ("language", 1), ("country_code", 1)],
        unique=True,
        partialFilterExpression={"origin_id": {"$type": "string"}},
    )


    # Phase U — professionals directory + ad campaigns
    await db.users.create_index(
        [("professional.is_professional", 1), ("professional.approval_status", 1)],
        sparse=True,
    )
    await db.users.create_index(
        [("professional.profession", 1)], sparse=True
    )
    await db.ad_campaigns.create_index([("owner_id", 1), ("created_at", -1)])
    await db.ad_campaigns.create_index(
        [
            ("status", 1),
            ("target_country", 1),
            ("target_region", 1),
        ]
    )

    # Phase 4P — PayPal payments + credits
    await db.user_credits.create_index(
        [("user_id", 1), ("currency", 1)], unique=True
    )
    await db.credit_topups.create_index([("user_id", 1), ("created_at", -1)])
    await db.credit_topups.create_index(
        [("paypal_order_id", 1)], unique=True, sparse=True
    )
    # Phase 4P — AI credit purchases
    await db.ai_credit_purchases.create_index([("user_id", 1), ("created_at", -1)])
    await db.ai_credit_purchases.create_index(
        [("paypal_order_id", 1)], unique=True, sparse=True
    )
    # Wave 2: swap + donate transactions never touch PayPal, so
    # ``paypal.order_id`` is explicitly null for them. ``sparse=True``
    # alone doesn't skip null values (only missing fields), so we use a
    # partialFilterExpression restricted to string values. Older
    # deployments may have the legacy sparse index — drop it defensively
    # first so the create_index call doesn't 85-error on a conflicting
    # definition.
    try:
        await db.transactions.drop_index("paypal.order_id_1")
    except Exception:  # noqa: BLE001
        pass  # first boot or already migrated
    await db.transactions.create_index(
        [("paypal.order_id", 1)],
        unique=True,
        partialFilterExpression={"paypal.order_id": {"$type": "string"}},
    )
    await db.transactions.create_index(
        [("paypal.payout_item_id", 1)], sparse=True
    )
    await db.paypal_events.create_index([("id", 1)], unique=True)

    # --- AI Stylist Scheduler (Phase Scheduler) ---
    await db.outfits.create_index([("user_id", 1), ("created_at", -1)])
    await db.simulated_notifications.create_index([("user_id", 1), ("created_at", -1)])
    # TTL: automatically expire simulated notifications after 30 days to bound storage
    await db.simulated_notifications.create_index(
        "created_at_dt",
        expireAfterSeconds=30 * 24 * 3600,
        name="simulated_notifications_ttl_30d",
    )


    # --- token usage indexing for Admin panel queries ---
    await db.token_usage.create_index([("user_id", 1), ("created_at", -1)])
    # TTL: automatically delete token_usage records older than 90 days.
    # This prevents the collection growing indefinitely (one row per AI call).
    # 90 days is sufficient for the admin billing dashboard and monthly reports.
    await db.token_usage.create_index(
        "created_at",
        expireAfterSeconds=90 * 24 * 3600,
        name="token_usage_ttl_90d",
    )

    # Backfill missing listing locations from seller home_location
    try:
        updated_count = 0
        async for listing in db.listings.find({"$or": [{"location": None}, {"location.type": {"$exists": False}}]}):
            seller_id = listing.get("seller_id")
            if seller_id:
                seller = await db.users.find_one({"id": seller_id}, {"home_location": 1})
                if seller and seller.get("home_location"):
                    home = seller["home_location"]
                    lat_coord = home.get("lat")
                    lng_coord = home.get("lng")
                    if lat_coord is not None and lng_coord is not None:
                        new_loc = {
                            "type": "Point",
                            "coordinates": [float(lng_coord), float(lat_coord)],
                            "city": home.get("city"),
                            "country": home.get("country"),
                            "region": home.get("region"),
                        }
                        await db.listings.update_one({"id": listing["id"]}, {"$set": {"location": new_loc}})
                        updated_count += 1
        if updated_count > 0:
            logger.info("MongoDB migration: backfilled coordinates for %d listings", updated_count)
    except Exception as e:
        logger.warning("MongoDB listing location backfill failed: %s", e)

    # Backfill legacy closet items and listings to prioritize reconstructed_image_url -> clean_image_url
    try:
        legacy_closet_count = 0
        async for item in db.closet_items.find({
            "$or": [
                {"reconstruct_image_url": {"$exists": True, "$ne": None}},
                {"reconstructed_image_url": {"$exists": True, "$ne": None}},
                {"clean_image_url": {"$exists": True, "$ne": None}},
            ]
        }):
            recon = item.get("reconstruct_image_url") or item.get("reconstructed_image_url")
            clean = item.get("clean_image_url")
            best = recon or clean
            if best:
                update_fields = {}
                if recon and not item.get("reconstructed_image_url"):
                    update_fields["reconstructed_image_url"] = recon
                if item.get("thumbnail_data_url") != best:
                    update_fields["thumbnail_data_url"] = best
                if update_fields:
                    await db.closet_items.update_one({"id": item["id"]}, {"$set": update_fields})
                    legacy_closet_count += 1
        if legacy_closet_count > 0:
            logger.info("MongoDB migration: backfilled reconstructed/clean image priority for %d legacy closet items", legacy_closet_count)

        legacy_listing_count = 0
        async for listing in db.listings.find({}):
            closet_item_id = listing.get("closet_item_id")
            closet_item = None
            if closet_item_id:
                closet_item = await db.closet_items.find_one({"id": closet_item_id})

            recon = (
                listing.get("reconstruct_image_url")
                or listing.get("reconstructed_image_url")
                or (closet_item and (closet_item.get("reconstructed_image_url") or closet_item.get("reconstruct_image_url")))
            )
            clean = (
                listing.get("clean_image_url")
                or (closet_item and closet_item.get("clean_image_url"))
            )
            best = recon or clean
            if best:
                update_fields = {}
                if recon and listing.get("reconstructed_image_url") != recon:
                    update_fields["reconstructed_image_url"] = recon
                if clean and listing.get("clean_image_url") != clean:
                    update_fields["clean_image_url"] = clean
                if listing.get("thumbnail_data_url") != best:
                    update_fields["thumbnail_data_url"] = best
                images = listing.get("images") or []
                if not images or (isinstance(images, list) and len(images) > 0 and images[0] != best):
                    update_fields["images"] = [best] + [i for i in images if i != best]
                if update_fields:
                    await db.listings.update_one({"id": listing["id"]}, {"$set": update_fields})
                    legacy_listing_count += 1
        if legacy_listing_count > 0:
            logger.info("MongoDB migration: backfilled reconstructed/clean image priority for %d legacy listings", legacy_listing_count)

        # Normalize clean_image_url and reconstructed_image_url (deskew + 0.90 safety margin) for all closet items
        # Also restore clean_image_url if it was previously overwritten with reconstructed_image_url
        from app.services.vision.image import fit_image_data_url_to_card
        normalized_item_count = 0
        async for item in db.closet_items.find({}):
            update_fields = {}
            clean = item.get("clean_image_url")
            recon = item.get("reconstructed_image_url")

            # Check if clean_image_url was overwritten with reconstructed_image_url
            if recon and clean and clean == recon:
                variants = item.get("image_variants") or {}
                orig_candidate = (
                    variants.get("original")
                    or (variants.get("webp") or {}).get("large")
                    or (variants.get("webp") or {}).get("medium")
                    or item.get("cutout_url")
                    or item.get("segmented_image_url")
                )
                if orig_candidate and orig_candidate != recon:
                    clean = orig_candidate
                    update_fields["clean_image_url"] = clean

            if clean and isinstance(clean, str) and clean.startswith("data:image/"):
                norm_clean = fit_image_data_url_to_card(clean)
                if norm_clean and norm_clean != clean:
                    update_fields["clean_image_url"] = norm_clean
            if recon and isinstance(recon, str) and recon.startswith("data:image/"):
                norm_recon = fit_image_data_url_to_card(recon)
                if norm_recon and norm_recon != recon:
                    update_fields["reconstructed_image_url"] = norm_recon

            if update_fields:
                query = {"id": item["id"]} if item.get("id") else {"_id": item["_id"]}
                await db.closet_items.update_one(query, {"$set": update_fields})
                normalized_item_count += 1
        if normalized_item_count > 0:
            logger.info("MongoDB migration: normalized clean/reconstructed images for %d closet items", normalized_item_count)
    except Exception as e:
        logger.warning("MongoDB legacy image priority backfill failed: %s", e)

    logger.info("MongoDB indexes ensured")


async def close() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
