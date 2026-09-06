"""Listings CRUD + fee preview."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.db.database import get_db
from app.models.schemas import (
    Condition,
    FinancialMetadata,
    Listing,
    ListingMode,
    ListingSource,
    ListingStatus,
)
from app.services import repos
from app.services.auth import get_current_user, get_current_user_optional
from app.services.fashion_clip import fashion_clip_service
from app.services.fees import compute_fees
import math
import re

_CATEGORY_SYNONYMS: dict[str, list[str]] = {
    "top": ["top", "tops"],
    "bottom": ["bottom", "bottoms"],
    "outerwear": ["outerwear"],
    "shoes": ["shoes", "footwear"],
    "footwear": ["shoes", "footwear"],
    "accessory": ["accessory", "accessories", "headwear"],
    "accessories": ["accessory", "accessories", "headwear"],
    "headwear": ["accessory", "accessories", "headwear"],
    "dress": ["dress", "dresses", "full body", "full_body", "fullbody", "full-body", "one-piece"],
    "dresses": ["dress", "dresses", "full body", "full_body", "fullbody", "full-body", "one-piece"],
    "full body": ["dress", "dresses", "full body", "full_body", "fullbody", "full-body", "one-piece"],
    "full_body": ["dress", "dresses", "full body", "full_body", "fullbody", "full-body", "one-piece"],
    "fullbody": ["dress", "dresses", "full body", "full_body", "fullbody", "full-body", "one-piece"],
    "underwear": ["underwear"],
}


def _build_category_filter(category: str | None) -> dict[str, Any] | None:
    if not category or category.strip().lower() == "all":
        return None
    raw = category.strip().lower()
    lookup_key = raw.replace("_", " ")
    synonyms = _CATEGORY_SYNONYMS.get(raw) or _CATEGORY_SYNONYMS.get(lookup_key) or [raw]
    pattern = "^(" + "|".join(re.escape(s) for s in synonyms) + ")$"
    return {"$regex": pattern, "$options": "i"}


def haversine_distance(coord1: list[float], coord2: list[float]) -> float:
    # coord1, coord2 are [lng, lat]
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    R = 6371.0  # Earth radius in km
    
    dlon = math.radians(lon2 - lon1)
    dlat = math.radians(lat2 - lat1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_distance_km(listing_loc: dict | None, lat: float | None, lng: float | None) -> float | None:
    if not listing_loc or lat is None or lng is None:
        return None
    try:
        if isinstance(listing_loc, dict):
            if listing_loc.get("type") == "Point" and isinstance(listing_loc.get("coordinates"), list):
                coords = listing_loc["coordinates"]
                if len(coords) >= 2:
                    l_lng, l_lat = coords[0], coords[1]
                    return round(haversine_distance([l_lng, l_lat], [lng, lat]), 1)
            elif listing_loc.get("lat") is not None and listing_loc.get("lng") is not None:
                l_lat = float(listing_loc["lat"])
                l_lng = float(listing_loc["lng"])
                return round(haversine_distance([l_lng, l_lat], [lng, lat]), 1)
    except Exception:
        pass
    return None

def _sanitize_listing_browse_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Ensure listing payloads are lightweight and memory-safe for mobile and web clients."""
    thumb = doc.get("thumbnail_data_url")
    if isinstance(thumb, str) and len(thumb) > 50000:
        doc["thumbnail_data_url"] = None

    images = doc.get("images")
    if isinstance(images, list):
        safe_images = []
        for img in images:
            if isinstance(img, str) and img.strip():
                if (
                    img.startswith("http://")
                    or img.startswith("https://")
                    or img.startswith("/static/")
                    or img.startswith("/uploads/")
                    or img.startswith("/")
                ):
                    safe_images.append(img)
                elif img.startswith("data:image/") and len(img) <= 50000:
                    safe_images.append(img)
        doc["images"] = safe_images

    # Derive best thumbnail/clean image in priority order:
    # 1. reconstructed_image_url / reconstruct_image_url
    # 2. clean_image_url
    # 3. images[0] / thumbnail_data_url / image_url
    pref = doc.get("preferred_image_view")
    if pref in ("clean", "original"):
        recon_or_clean = (
            doc.get("clean_image_url")
            or doc.get("reconstructed_image_url")
            or doc.get("reconstruct_image_url")
        )
    else:
        recon_or_clean = (
            doc.get("reconstructed_image_url")
            or doc.get("reconstruct_image_url")
            or doc.get("clean_image_url")
        )

    if recon_or_clean:
        doc["thumbnail_data_url"] = recon_or_clean
        images = doc.get("images")
        if not images:
            doc["images"] = [recon_or_clean]
        elif isinstance(images, list) and len(images) > 0 and images[0] != recon_or_clean:
            doc["images"] = [recon_or_clean] + [i for i in images if i != recon_or_clean]
    else:
        best_img = (
            (doc.get("images")[0] if doc.get("images") and len(doc["images"]) > 0 else None)
            or doc.get("thumbnail_data_url")
            or doc.get("image_url")
        )
        if not doc.get("thumbnail_data_url") and best_img:
            doc["thumbnail_data_url"] = best_img
        if not doc.get("images") and best_img:
            doc["images"] = [best_img]

    return doc


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/listings", tags=["listings"])


class CreateListingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    closet_item_id: str | None = None
    source: ListingSource = "Shared"
    mode: ListingMode = "sell"
    title: str
    description: str | None = None
    category: str
    size: str | None = None
    condition: Condition = "good"
    images: list[str] = Field(default_factory=list)
    location: dict[str, Any] | None = None
    ships_to: list[str] = Field(default_factory=list)
    list_price_cents: int = Field(ge=0)
    currency: str = "USD"
    # Wave 3 — optional shipping fee attached to this listing. 0 means
    # "free / local pickup only". Capped nowhere on the backend;
    # product copy nudges users toward 0 for donations.
    shipping_fee_cents: int = Field(default=0, ge=0)


class UpdateListingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = None
    description: str | None = None
    category: str | None = None
    size: str | None = None
    condition: Condition | None = None
    images: list[str] | None = None
    location: dict[str, Any] | None = None
    ships_to: list[str] | None = None
    list_price_cents: int | None = None
    shipping_fee_cents: int | None = Field(default=None, ge=0)
    status: ListingStatus | None = None


@router.get("/fee-preview")
async def fee_preview(
    list_price_cents: int = Query(ge=0),
) -> dict[str, Any]:
    return compute_fees(list_price_cents).to_dict()


@router.post("", status_code=201)
async def create_listing(
    payload: CreateListingIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    sub = user.get("subscription") or {}
    is_active = sub.get("is_active", False)
    plan_type = sub.get("plan_type", "free")
    tier = sub.get("tier", "free")
    
    user_tier = "free"
    if is_active and plan_type != "free":
        if tier in ["pro", "manager"]:
            user_tier = "manager"
        elif tier in ["business", "professional"]:
            user_tier = "professional"
            
    if user_tier == "free" and payload.mode in ["sell", "rent"]:
        raise HTTPException(
            status_code=403,
            detail="Selling or renting items is not allowed on the Free plan. Please upgrade to Manager or Professional to sell or rent."
        )

    db = get_db()
    # If linking to a closet item, ensure ownership and mark it Shared/Retail.
    closet_item = None
    if payload.closet_item_id:
        closet_item = await repos.find_one(
            db.closet_items,
            {"id": payload.closet_item_id, "user_id": user["id"]},
        )
        if not closet_item:
            raise HTTPException(404, "Linked closet item not found")

    fees = compute_fees(payload.list_price_cents)
    financial = FinancialMetadata(
        list_price_cents=payload.list_price_cents,
        currency=payload.currency,
        platform_fee_percent=fees.platform_fee_percent,
        estimated_seller_net_cents=fees.seller_net_cents,
    )

    # Derive listing images from the linked closet item when the client
    # didn't already pass them. The closet *list* endpoint deliberately
    # strips `original_image_url` / `segmented_image_url` to keep the
    # grid payload small (~200KB instead of ~25MB), so a frontend that
    # sources `body.images` from the closet list always sees them as
    # `undefined`. Doing the lookup server-side avoids forcing the
    # frontend to make an extra full-detail GET before posting.
    images = list(payload.images or [])
    if not images and closet_item:
        group_id = closet_item.get("group_id")
        if group_id:
            group_items = await repos.find_many(
                db.closet_items,
                {"group_id": group_id, "user_id": user["id"]}
            )
            group_items.sort(key=lambda x: 0 if x.get("group_role") == "host" else 1)
            pref = (closet_item or {}).get("preferred_image_view")
            flds = (
                ("clean_image_url", "reconstructed_image_url")
                if pref in ("clean", "original")
                else ("reconstructed_image_url", "clean_image_url")
            )
            candidate_fields = (
                *flds,
                "cutout_url",
                "thumbnail_data_url",
                "image_url",
                "segmented_image_url",
                "original_image_url",
            )
            for g_item in group_items:
                for fld in candidate_fields:
                    url = g_item.get(fld)
                    if isinstance(url, str) and url:
                        images.append(url)
                        break
        else:
            pref = (closet_item or {}).get("preferred_image_view")
            flds = (
                ("clean_image_url", "reconstructed_image_url")
                if pref in ("clean", "original")
                else ("reconstructed_image_url", "clean_image_url")
            )
            candidate_fields = (
                *flds,
                "cutout_url",
                "thumbnail_data_url",
                "image_url",
                "segmented_image_url",
                "original_image_url",
            )
            for fld in candidate_fields:
                url = closet_item.get(fld)
                if isinstance(url, str) and url:
                    images.append(url)
                    break


    # Default to seller's home location if not provided
    location = payload.location
    if not location and user.get("home_location"):
        home = user["home_location"]
        lat_coord = home.get("lat")
        lng_coord = home.get("lng")
        if lat_coord is not None and lng_coord is not None:
            location = {
                "type": "Point",
                "coordinates": [float(lng_coord), float(lat_coord)],
                "city": home.get("city"),
                "country": home.get("country"),
                "region": home.get("region"),
            }

    clean_img = (closet_item or {}).get("clean_image_url") if closet_item else None
    reconstructed_img = (closet_item or {}).get("reconstructed_image_url") if closet_item else None
    thumb_img = (closet_item or {}).get("thumbnail_data_url") if closet_item else (images[0] if images else None)

    listing = Listing(
        closet_item_id=payload.closet_item_id,
        seller_id=user["id"],
        source=payload.source,
        mode=payload.mode,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        size=payload.size,
        condition=payload.condition,
        images=images,
        clean_image_url=clean_img,
        reconstructed_image_url=reconstructed_img,
        thumbnail_data_url=thumb_img,
        location=location,
        ships_to=payload.ships_to,
        financial_metadata=financial,
        shipping_fee_cents=payload.shipping_fee_cents,
    )

    doc = listing.model_dump()
    if closet_item and closet_item.get("preferred_image_view"):
        doc["preferred_image_view"] = closet_item["preferred_image_view"]
    await repos.insert(db.listings, doc)

    # Transition the closet_item's source (Private → Shared/Retail).
    if closet_item and closet_item.get("source") == "Private":
        await db.closet_items.update_one(
            {"id": closet_item["id"]},
            {"$set": {"source": payload.source,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    return doc


@router.get("")
async def browse_listings(
    source: ListingSource | None = Query(default=None),
    category: str | None = Query(default=None),
    mode: ListingMode | None = Query(default=None),
    seller_id: str | None = Query(default=None),
    min_price_cents: int | None = Query(default=None, ge=0),
    max_price_cents: int | None = Query(default=None, ge=0),
    status: ListingStatus = Query(default="active"),
    limit: int = Query(default=30, le=100),
    skip: int = Query(default=0, ge=0),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, ge=1, le=20037),
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    db = get_db()
    query: dict[str, Any] = {"status": status}
    if source:
        query["source"] = source
    cat_filter = _build_category_filter(category)
    if cat_filter:
        query["category"] = cat_filter
    if mode:
        query["mode"] = mode
    if seller_id:
        query["seller_id"] = seller_id
    if min_price_cents is not None:
        query.setdefault("financial_metadata.list_price_cents", {})["$gte"] = (
            min_price_cents
        )
    if max_price_cents is not None:
        query.setdefault("financial_metadata.list_price_cents", {})["$lte"] = (
            max_price_cents
        )

    # Geo-ranked browse: only run $geoNear if a specific radius filter is requested.
    # Otherwise, run a standard find so that listings with location=None are not excluded.
    use_geo = lat is not None and lng is not None and radius_km is not None

    if use_geo:
        geo_near_opts = {
            "near": {"type": "Point", "coordinates": [lng, lat]},
            "distanceField": "distance_m",
            "query": query,
            "spherical": True,
        }
        if radius_km:
            geo_near_opts["maxDistance"] = radius_km * 1000
        pipeline = [
            {"$geoNear": geo_near_opts},
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {"_id": 0}},
        ]
        cursor = db.listings.aggregate(pipeline)
        items: list[dict[str, Any]] = []
        async for doc in cursor:
            if "distance_m" in doc:
                doc["distance_km"] = round(doc["distance_m"] / 1000, 1)
            _sanitize_listing_browse_doc(doc)
            items.append(doc)
        total = await repos.count(db.listings, query)
        return {"items": items, "total": total, "limit": limit, "skip": skip}

    items = await repos.find_many(
        db.listings, query, sort=[("created_at", -1)], limit=limit, skip=skip
    )
    # Calculate distance in Python for any listings that do have location info
    for doc in items:
        if lat is not None and lng is not None:
            dist = calculate_distance_km(doc.get("location"), lat, lng)
            if dist is not None:
                doc["distance_km"] = dist
        _sanitize_listing_browse_doc(doc)

    total = await repos.count(db.listings, query)
    return {"items": items, "total": total, "limit": limit, "skip": skip}


@router.get("/stream")
async def browse_listings_stream(
    source: ListingSource | None = Query(default=None),
    category: str | None = Query(default=None),
    mode: ListingMode | None = Query(default=None),
    seller_id: str | None = Query(default=None),
    min_price_cents: int | None = Query(default=None, ge=0),
    max_price_cents: int | None = Query(default=None, ge=0),
    status: ListingStatus = Query(default="active"),
    limit: int = Query(default=30, le=100),
    skip: int = Query(default=0, ge=0),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, ge=1, le=20037),
    user: dict | None = Depends(get_current_user_optional),
):
    # Geo-ranked browse: only run $geoNear if a specific radius filter is requested.
    # Otherwise, run a standard find so that listings with location=None are not excluded.
    use_geo = lat is not None and lng is not None and radius_km is not None
    
    # Indicate to client whether coordinates are available in start event
    start_geo = lat is not None and lng is not None
    """**NDJSON-streaming** counterpart to ``GET /listings``.

    Same filters, same ranking (incl. geo ``$geoNear``), but each
    matching listing is emitted as a separate JSON line so the
    Marketplace grid can paint listings as they arrive instead of
    waiting for the full result set. Time-to-first-listing on a cold
    geo query drops from ~400-700 ms to ~150 ms on the Hetzner box
    measured in production.

    Wire format
    ===========
    ``application/x-ndjson``. One JSON object per line:

      * ``{"type":"start", "total":N, "geo":bool}`` — total count
        (pre-pagination) the client should expect to fill its grid.
        ``geo=true`` when the query ran through ``$geoNear`` so the
        client knows to expect ``distance_km`` on each item.
      * ``{"type":"item", "data": {...listing...}}`` — one full
        listing document per line. ``data`` is the exact same shape
        the JSON endpoint returns inside its ``items`` array, so
        the client can append directly to the same render path.
      * ``{"type":"done", "emitted":N}`` — how many ``item`` lines
        were actually sent (≤ ``limit``); lets the client distinguish
        "fewer-than-page-size results" from "stream truncated".

    The new ``api.streamListings`` helper on the frontend consumes
    this directly into ``marketplaceStore.browseProgress`` and
    splices each item onto the visible grid.
    """
    db = get_db()
    query: dict[str, Any] = {"status": status}
    if source:
        query["source"] = source
    cat_filter = _build_category_filter(category)
    if cat_filter:
        query["category"] = cat_filter
    if mode:
        query["mode"] = mode
    if seller_id:
        query["seller_id"] = seller_id
    if min_price_cents is not None:
        query.setdefault("financial_metadata.list_price_cents", {})["$gte"] = (
            min_price_cents
        )
    if max_price_cents is not None:
        query.setdefault("financial_metadata.list_price_cents", {})["$lte"] = (
            max_price_cents
        )

    use_geo = lat is not None and lng is not None and radius_km is not None

    # Note on `user`: the optional auth dependency is consumed for
    # parity with the JSON endpoint (future filters may want to know
    # the viewer, e.g. to hide their own listings). Currently unused
    # so we silence the lint.
    _ = user

    async def gen():
        emitted = 0
        try:
            # Total is computed once up-front so the client can size its
            # skeleton grid before listings start streaming in.
            total = await repos.count(db.listings, query)
            yield (
                json.dumps(
                    {"type": "start", "total": total, "geo": start_geo}
                )
                + "\n"
            )

            if use_geo:
                geo_near_opts = {
                    "near": {"type": "Point", "coordinates": [lng, lat]},
                    "distanceField": "distance_m",
                    "query": query,
                    "spherical": True,
                }
                if radius_km:
                    geo_near_opts["maxDistance"] = radius_km * 1000
                pipeline = [
                    {"$geoNear": geo_near_opts},
                    {"$skip": skip},
                    {"$limit": limit},
                    {"$project": {"_id": 0}},
                ]
                cursor = db.listings.aggregate(pipeline, allowDiskUse=True)
                async for doc in cursor:
                    if "distance_m" in doc:
                        doc["distance_km"] = round(doc["distance_m"] / 1000, 1)
                    _sanitize_listing_browse_doc(doc)
                    yield (
                        json.dumps({"type": "item", "data": doc}) + "\n"
                    )
                    emitted += 1
                    await asyncio.sleep(0)
            else:
                cursor = (
                    db.listings.find(query, {"_id": 0})
                    .sort("created_at", -1)
                    .allow_disk_use(True)
                    .skip(skip)
                    .limit(limit)
                )
                async for doc in cursor:
                    if lat is not None and lng is not None:
                        dist = calculate_distance_km(doc.get("location"), lat, lng)
                        if dist is not None:
                            doc["distance_km"] = dist
                    _sanitize_listing_browse_doc(doc)
                    yield (
                        json.dumps({"type": "item", "data": doc}) + "\n"
                    )
                    emitted += 1
                    # Yield to the loop every row so the bytes actually
                    # leave the box one-by-one instead of being coalesced
                    # into one big TCP write at the end.
                    await asyncio.sleep(0)

            yield (
                json.dumps({"type": "done", "emitted": emitted}) + "\n"
            )
        except Exception as exc:
            logger.error("Error in browse_listings_stream for query %s: %s", query, exc, exc_info=True)
            yield (
                json.dumps({"type": "done", "emitted": emitted, "error": str(exc)}) + "\n"
            )

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache, no-transform",
        },
    )


@router.get("/{listing_id}")
async def get_listing(listing_id: str) -> dict[str, Any]:
    db = get_db()
    listing = await repos.find_one(db.listings, {"id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing not found")
    # bump views (fire-and-forget)
    try:
        await db.listings.update_one(
            {"id": listing_id}, {"$inc": {"views": 1}}
        )
    except Exception:  # noqa: BLE001
        pass

    # Hydrate the seller's public-facing display name + city/country
    # so the listing detail UI can render "From Lisbon, Portugal" without
    # a second round-trip. Order of preference for the name:
    #   1. ``display_name`` — the user's explicit handle.
    #   2. ``company_name`` — for sellers running a brand / boutique.
    #   3. ``first_name``  — friendly fallback before any "anon".
    #   4. (no merchant-name line at all — never an email prefix.)
    # Order of preference for the location:
    #   1. The listing's own ``location`` dict (most specific, e.g. a
    #      pop-up sale at a different address).
    #   2. The seller's ``home_location`` (broader fallback).
    #   3. The seller's ``address`` city/country (last resort).
    # Email/phone are deliberately NOT exposed here — buyers learn
    # those after a successful transaction via the post-sale email.
    seller_pub: dict[str, Any] = {}
    try:
        seller = await db.users.find_one(
            {"id": listing.get("seller_id")},
            {
                "_id": 0,
                "id": 1,
                "display_name": 1,
                "company_name": 1,
                "first_name": 1,
                "home_location": 1,
                "address": 1,
            },
        )
        if seller:
            seller_pub["id"] = seller.get("id")
            seller_pub["display_name"] = (
                seller.get("display_name")
                or seller.get("company_name")
                or seller.get("first_name")
                or None
            )
            loc = (
                listing.get("location")
                or seller.get("home_location")
                or {}
            )
            if not loc and isinstance(seller.get("address"), dict):
                addr = seller["address"]
                loc = {
                    "city": addr.get("city"),
                    "country": addr.get("country"),
                    "region": addr.get("region"),
                }
            seller_pub["location"] = {
                "city": (loc or {}).get("city"),
                "country": (loc or {}).get("country"),
                "region": (loc or {}).get("region"),
            }
    except Exception as exc:  # noqa: BLE001
        logger.warning("seller hydrate failed: %s", exc)
    listing = dict(listing)
    listing["seller_public"] = seller_pub
    _sanitize_listing_browse_doc(listing)
    return listing


@router.get("/{listing_id}/similar")
async def get_similar_listings(
    listing_id: str,
    limit: int = Query(default=6, ge=1, le=24),
    min_score: float = Query(default=0.22, ge=0.0, le=1.0),
) -> dict[str, Any]:
    """Return listings whose underlying closet item is visually similar.

    Powered by FashionCLIP embeddings persisted on each closet item.
    Falls back to category-only matching when embeddings are missing so
    the UI can still show something useful on legacy rows.
    """
    db = get_db()
    seed = await repos.find_one(db.listings, {"id": listing_id})
    if not seed:
        raise HTTPException(404, "Listing not found")
    seed_item_id = seed.get("closet_item_id")
    seed_item: dict[str, Any] | None = None
    if seed_item_id:
        seed_item = await repos.find_one(db.closet_items, {"id": seed_item_id})
    seed_vec = (seed_item or {}).get("clip_embedding")

    # Candidates: all active listings in the same marketplace (including
    # other categories) except this listing itself.
    cand_query: dict[str, Any] = {
        "status": "active",
        "id": {"$ne": listing_id},
    }
    candidates = await repos.find_many(
        db.listings, cand_query, sort=[("created_at", -1)], limit=500
    )
    if not candidates:
        return {"items": [], "total": 0, "mode": "none"}

    # Batch-fetch the embeddings for every candidate's underlying item.
    item_ids = [c["closet_item_id"] for c in candidates if c.get("closet_item_id")]
    vec_map: dict[str, list[float]] = {}
    cat_map: dict[str, str | None] = {}
    if item_ids:
        docs = await repos.find_many(
            db.closet_items,
            {"id": {"$in": item_ids}},
            sort=[("created_at", -1)],
            limit=len(item_ids),
        )
        for d in docs:
            ce = d.get("clip_embedding")
            if isinstance(ce, list) and ce:
                vec_map[d["id"]] = ce
            cat_map[d["id"]] = d.get("category")

    mode = "embedding"
    scored: list[dict[str, Any]] = []
    if fashion_clip_service is not None and seed_vec:
        for c in candidates:
            vec = vec_map.get(c.get("closet_item_id") or "")
            if not vec:
                continue
            score = fashion_clip_service.cosine(seed_vec, vec)
            if score < min_score:
                continue
            c2 = dict(c)
            c2["_score"] = round(score, 4)
            _sanitize_listing_browse_doc(c2)
            scored.append(c2)
        scored.sort(key=lambda r: r["_score"], reverse=True)
    else:
        # Embedding fallback: show active listings in the same category,
        # newest first. Marks the response so the UI can render a subtler
        # "popular in this category" label rather than "items like this".
        mode = "category"
        seed_cat = (seed_item or {}).get("category") or seed.get("category")
        for c in candidates:
            cat = cat_map.get(c.get("closet_item_id") or "") or c.get("category")
            if seed_cat and cat and cat != seed_cat:
                continue
            c2 = dict(c)
            _sanitize_listing_browse_doc(c2)
            scored.append(c2)
    return {
        "items": scored[: max(1, limit)],
        "total": len(scored),
        "mode": mode,
        "seed_has_embedding": bool(seed_vec),
    }


@router.patch("/{listing_id}")
async def update_listing(
    listing_id: str,
    payload: UpdateListingIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    listing = await repos.find_one(
        db.listings, {"id": listing_id, "seller_id": user["id"]}
    )
    if not listing:
        raise HTTPException(404, "Listing not found")
    patch = payload.model_dump(exclude_none=True)
    if "list_price_cents" in patch:
        fees = compute_fees(patch["list_price_cents"])
        patch["financial_metadata.list_price_cents"] = patch.pop("list_price_cents")
        patch["financial_metadata.estimated_seller_net_cents"] = fees.seller_net_cents
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.listings.update_one({"id": listing_id}, {"$set": patch})
    return await repos.find_one(db.listings, {"id": listing_id}) or {}


@router.delete("/{listing_id}")
async def delete_listing(
    listing_id: str, user: dict = Depends(get_current_user)
) -> Response:
    """Hard-delete a listing and reset the linked closet item back to
    private / own.

    Historically this endpoint only removed the row from
    ``listings`` — leaving the linked closet item with a dangling
    ``auto_listing_id`` and a ``marketplace_intent`` like
    ``swap`` / ``donate`` / ``for_sale``. From a user's perspective
    that meant clicking "Remove listing" did *not* take the item off
    the marketplace next time the auto-list pipeline ran (because the
    closet item still indicated marketplace participation).

    We now do a coordinated cleanup:
        1. Remove the listing row.
        2. If the listing was linked to a closet item we own, reset
           ``marketplace_intent`` to ``"own"``, ``source`` to
           ``"Private"``, and clear ``auto_listing_id`` /
           ``auto_listing_needs_completion``. This guarantees the
           closet card flips back to "Private" immediately.
    """
    db = get_db()
    listing = await repos.find_one(
        db.listings, {"id": listing_id, "seller_id": user["id"]}
    )
    if not listing:
        raise HTTPException(404, "Listing not found")

    closet_item_id = listing.get("closet_item_id")

    deleted = await repos.delete(
        db.listings, {"id": listing_id, "seller_id": user["id"]}
    )
    if not deleted:
        # Race condition — somebody else removed it between the
        # find_one and the delete. Treat as 404 so the client can
        # refresh.
        raise HTTPException(404, "Listing not found")

    if closet_item_id:
        try:
            await db.closet_items.update_one(
                {
                    "id": closet_item_id,
                    "user_id": user["id"],
                    # Only reset if the closet item is still pointing
                    # at THIS listing — guards against deleting a
                    # listing that was already de-linked manually.
                    "auto_listing_id": listing_id,
                },
                {
                    "$set": {
                        "marketplace_intent": "own",
                        "source": "Private",
                        "auto_listing_id": None,
                        "auto_listing_needs_completion": False,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
            )
        except Exception as exc:  # noqa: BLE001
            # Non-fatal — the listing IS gone, the closet card may
            # just lag for one render. Surface in logs for triage.
            logger.warning(
                "delete_listing: closet cleanup failed listing=%s "
                "closet_item=%s err=%s",
                listing_id, closet_item_id, exc,
            )

    return Response(status_code=204)
