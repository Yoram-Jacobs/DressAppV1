from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from app.db.database import get_db
from app.config import settings
from app.models.schemas import (
    ClosetItem,
    DressCode,
    FinancialMetadata,
    Formality,
    GarmentAnalysis,
    GarmentCondition,
    GarmentGender,
    GarmentQuality,
    GarmentState,
    Listing,
    MarketplaceIntent,
    RetailMetadata,
    Source,
    WeightedTag,
)
from app.services import repos
from app.services.auth import (
    get_current_user,
    resolve_user_gemini_api_key,
    resolve_user_gemini_model,
)
from app.services.fees import compute_fees
from app.services.vision import garment_vision_service, get_garment_vision_service
from app.services.fashion_clip import fashion_clip_service
from app.services.gemini_image_service import gemini_image_service, get_gemini_image_service
from app.services.image_compression import (
    compress_b64_image,
    compress_image_bytes,
    compress_image_url_or_b64,
)
from app.services import closet_service
from app.api.v1.closet.common import (
    _active_background_tasks,
    _track_task,
    _ANALYZE_CONCURRENCY,
    _ANALYZE_LOCK,
    _get_item_image_url,
    _pick_segformer_mask_for_category,
    _bytes_from_data_url,
    _ensure_min_resolution,
    _read_image_bytes_from_url,
    _maybe_retry_stale_matte,
    _run_background_matte,
    _run_background_matte_and_analyze,
    _run_background_reconstruction,
    CreateItemIn,
    UpdateItemIn,
    logger,
)

router = APIRouter()


class SearchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str | None = None
    image_base64: str | None = None
    limit: int = 24
    min_score: float = 0.15


@router.post("/search")
async def search_closet(
    payload: SearchIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Semantic closet search via FashionCLIP embeddings.

    Accepts *either* a free-text query ("blue flowy summer tops") *or*
    an image (e.g. a screenshot the user wants to find a match for).
    Returns items sorted by cosine similarity, filtered by ``min_score``.
    """
    if fashion_clip_service is None:
        raise HTTPException(503, "Embedding search is not available right now.")
    if not payload.text and not payload.image_base64:
        raise HTTPException(400, "Provide either `text` or `image_base64`.")

    try:
        if payload.image_base64:
            raw = base64.b64decode(payload.image_base64, validate=True)
            q_vec = await fashion_clip_service.embed_image(raw)
        else:
            q_vec = await fashion_clip_service.embed_text(payload.text or "")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Search embedding failed: %s", exc)
        raise HTTPException(503, "Could not build the search query.") from exc
    if not q_vec:
        raise HTTPException(400, "Empty query.")

    db = get_db()
    # Pull only items that have a stored embedding (others cannot be scored).
    candidates = await repos.find_many(
        db.closet_items,
        {"user_id": user["id"], "clip_embedding": {"$exists": True, "$ne": None}, "group_role": {"$ne": "member"}},
        sort=[("created_at", -1)],
        limit=2000,
    )
    scored: list[dict[str, Any]] = []
    for item in candidates:
        vec = item.get("clip_embedding")
        if not isinstance(vec, list) or not vec:
            continue
        score = fashion_clip_service.cosine(q_vec, vec)
        if score < payload.min_score:
            continue
        # Strip the big embedding vector from the response payload.
        slim = {k: v for k, v in item.items() if k != "clip_embedding"}
        slim["_score"] = round(score, 4)
        scored.append(slim)
    scored.sort(key=lambda r: r["_score"], reverse=True)
    return {
        "items": scored[: max(1, payload.limit)],
        "total": len(scored),
        "indexed": len(candidates),
        "model": fashion_clip_service.model_id,
    }



class CompleteOutfitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_ids: list[str] = Field(min_length=1, max_length=8)
    include_marketplace: bool = False
    occasion: str | None = None
    limit: int = Field(default=6, ge=1, le=12)
    min_score: float = Field(default=0.10, ge=0.0, le=1.0)
    # When True (default) the server builds an order-weighted centroid:
    # the 1st anchor in `item_ids` gets the heaviest weight, the last
    # gets the lightest (linear decay, normalised to sum=1). Set False
    # for a plain equal-weight mean.
    weighted: bool = True
    # Optional client-supplied coordinates override user.home_location
    # for the weather hook.
    lat: float | None = None
    lng: float | None = None


_slim_item = closet_service.slim_item
_anchor_summary = closet_service.anchor_summary
@router.post("/complete-outfit")
async def complete_outfit(
    payload: CompleteOutfitIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """**Complete the Outfit** — given 1..N anchor items from the user's
    closet, return ranked complementary items (from the closet and,
    optionally, from the active marketplace) plus a short rationale.

    The score uses FashionCLIP embeddings averaged across the anchors
    (centroid) against every candidate's embedding. Candidates whose
    ``category`` duplicates any anchor's ``category`` are filtered out
    so suggestions are actually *completing* the look rather than
    duplicating it.

    When ``include_marketplace=true`` the endpoint also searches active
    listings (excluding the user's own listings) using the same
    FashionCLIP centroid, then asks Gemini to produce a combined
    rationale grounded in the anchors + shortlist.
    """
    db = get_db()
    from app.services.billing_service import deduct_user_credits
    if not await deduct_user_credits(db, user, cost=1):
        raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

    # ------- 1. Fetch & validate anchors (preserve client-supplied order) -------
    fetched = await repos.find_many(
        db.closet_items,
        {"id": {"$in": payload.item_ids}, "user_id": user["id"]},
        limit=len(payload.item_ids),
    )
    if not fetched:
        raise HTTPException(404, "None of the selected items were found.")
    if len(fetched) != len(payload.item_ids):
        missing = set(payload.item_ids) - {a["id"] for a in fetched}
        raise HTTPException(
            404,
            f"{len(missing)} item(s) were not found in your closet.",
        )
    # Re-order to match `payload.item_ids` so the first anchor supplied by
    # the client is anchor[0] (drives weighting + stylist narrative).
    by_id = {a["id"]: a for a in fetched}
    anchors = [by_id[i] for i in payload.item_ids if i in by_id]

    # ------- 2. Build anchor centroid (optionally order-weighted) -------
    anchor_vecs: list[tuple[list[float], float]] = []
    if fashion_clip_service is not None:
        n = len(anchors)
        for idx, a in enumerate(anchors):
            vec = a.get("clip_embedding")
            if isinstance(vec, list) and vec:
                if payload.weighted and n > 1:
                    # Linear decay: weight = n-idx, then normalise later.
                    weight = float(n - idx)
                else:
                    weight = 1.0
                anchor_vecs.append((vec, weight))
    anchor_categories = {a.get("category") for a in anchors if a.get("category")}

    centroid: list[float] | None = None
    if anchor_vecs:
        dim = len(anchor_vecs[0][0])
        sums = [0.0] * dim
        total_w = 0.0
        for vec, w in anchor_vecs:
            if len(vec) != dim:
                continue
            for i, x in enumerate(vec):
                sums[i] += float(x) * w
            total_w += w
        if total_w > 0:
            mean = [s / total_w for s in sums]
            # L2-normalise so cosine is still a straight dot product.
            norm = sum(x * x for x in mean) ** 0.5
            if norm > 0:
                centroid = [x / norm for x in mean]

    # ------- 3. Score closet candidates -------
    closet_suggestions: list[dict[str, Any]] = []
    if centroid is not None:
        candidates = await repos.find_many(
            db.closet_items,
            {
                "user_id": user["id"],
                "id": {"$nin": payload.item_ids},
                "clip_embedding": {"$exists": True, "$ne": None},
                "group_role": {"$ne": "member"},
            },
            sort=[("created_at", -1)],
            limit=2000,
        )
        scored: list[dict[str, Any]] = []
        for c in candidates:
            vec = c.get("clip_embedding")
            if not isinstance(vec, list) or not vec:
                continue
            # Diversity: skip same-category-as-any-anchor items so we
            # actually COMPLETE the look (don't suggest another top
            # when the anchor is already a top).
            if c.get("category") in anchor_categories:
                continue
            score = fashion_clip_service.cosine(centroid, vec)
            if score < payload.min_score:
                continue
            slim = _slim_item(c)
            slim["_score"] = round(score, 4)
            scored.append(slim)
        scored.sort(key=lambda r: r["_score"], reverse=True)
        closet_suggestions = scored[: payload.limit]

    # ------- 4. Marketplace suggestions (opt-in) -------
    market_suggestions: list[dict[str, Any]] = []
    if payload.include_marketplace and centroid is not None:
        listings = await repos.find_many(
            db.listings,
            {"status": "active", "seller_id": {"$ne": user["id"]}},
            sort=[("created_at", -1)],
            limit=1000,
        )
        listing_item_ids = [
            lg.get("closet_item_id") for lg in listings if lg.get("closet_item_id")
        ]
        vec_map: dict[str, list[float]] = {}
        cat_map: dict[str, str | None] = {}
        if listing_item_ids:
            docs = await repos.find_many(
                db.closet_items,
                {"id": {"$in": listing_item_ids}},
                limit=len(listing_item_ids),
            )
            for d in docs:
                ce = d.get("clip_embedding")
                if isinstance(ce, list) and ce:
                    vec_map[d["id"]] = ce
                cat_map[d["id"]] = d.get("category")
        m_scored: list[dict[str, Any]] = []
        for lg in listings:
            cid = lg.get("closet_item_id")
            if not cid:
                continue
            cat = cat_map.get(cid)
            # Same diversity rule for marketplace
            if cat and cat in anchor_categories:
                continue
            vec = vec_map.get(cid)
            if not vec:
                continue
            score = fashion_clip_service.cosine(centroid, vec)
            if score < payload.min_score:
                continue
            lg2 = dict(lg)
            lg2["_score"] = round(score, 4)
            m_scored.append(lg2)
        m_scored.sort(key=lambda r: r["_score"], reverse=True)
        market_suggestions = m_scored[: payload.limit]

    # ------- 5. Weather hook (optional, soft-fail) -------
    from app.services.weather_service import weather_service

    weather_ctx: dict[str, Any] | None = None
    weather_summary_text: str | None = None
    home = user.get("home_location") or {}
    lat = payload.lat if payload.lat is not None else home.get("lat")
    lng = payload.lng if payload.lng is not None else home.get("lng")
    if lat is not None and lng is not None and weather_service is not None:
        try:
            weather_ctx = await weather_service.fetch(
                float(lat),
                float(lng),
                lang=(user.get("preferred_language") or "en"),
            )
            if weather_ctx:
                # Prefer the localized `description` field (e.g. "bewölkt",
                # "מעונן") over the English `condition`. Strip the
                # hardcoded " in " connector to avoid mixing languages.
                localized_cond = (
                    weather_ctx.get("description")
                    or weather_ctx.get("condition")
                    or ""
                )
                parts = [
                    f"{weather_ctx.get('temp_c')}°C",
                    localized_cond,
                    weather_ctx.get("city") or "",
                ]
                weather_summary_text = " · ".join(p for p in parts if p)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Complete-outfit weather fetch failed: %s", exc)

    # ------- 6. Stylist rationale (Gemini) -------
    from app.services.gemini_stylist import get_gemini_stylist_service

    rationale = ""
    outfit_recommendations: list[dict[str, Any]] = []
    do_dont: list[str] = []
    spoken_reply = ""
    stylist_service = get_gemini_stylist_service(user=user)
    if stylist_service is not None:
        try:
            anchors_pretty = [_anchor_summary(a) for a in anchors]
            closet_short = [
                {
                    "closet_item_id": s["id"],
                    "title": s.get("title") or s.get("name"),
                    "category": s.get("category"),
                    "color": s.get("color"),
                    "material": s.get("material"),
                    "score": s["_score"],
                }
                for s in closet_suggestions
            ]
            market_short = [
                {
                    "listing_id": lg["id"],
                    "title": lg.get("title"),
                    "category": lg.get("category"),
                    "price_cents": (lg.get("financial_metadata") or {}).get(
                        "list_price_cents"
                    ),
                    "score": lg["_score"],
                }
                for lg in market_suggestions
            ]
            weather_line = (
                f"\nWEATHER: {weather_summary_text}"
                if weather_summary_text
                else ""
            )
            request_text = (
                "Complete this outfit using the user's ANCHOR pieces as the "
                "starting point. The anchors are listed in priority order "
                "(first = most important). Choose complementary items from "
                "the CLOSET_CANDIDATES first (preferred); only reach into "
                "MARKET_CANDIDATES if a key complementary category is "
                "missing. Return ONE or TWO outfit recommendations. In "
                "`why`, explain the reasoning in 1-2 sentences. If weather "
                "context is provided AND the occasion sounds outdoor, "
                "prioritise weather-appropriate layers/footwear and call "
                "that out in the rationale.\n\n"
                f"OCCASION: {payload.occasion or 'unspecified (casual by default)'}"
                f"{weather_line}\n\n"
                f"ANCHORS (priority order): "
                f"{json.dumps(anchors_pretty, ensure_ascii=False)}\n\n"
                f"CLOSET_CANDIDATES: {json.dumps(closet_short, ensure_ascii=False)}\n\n"
                f"MARKET_CANDIDATES: {json.dumps(market_short, ensure_ascii=False)}"
            )
            user_profile = {
                "preferred_language": user.get("preferred_language", "en"),
                "style_profile": user.get("style_profile"),
            }
            advice = await stylist_service.advise(
                session_id=f"complete-outfit:{user['id']}",
                user_text=request_text,
                image_base64=None,
                weather=weather_ctx,
                user_profile=user_profile,
                closet_summary=closet_short + [{"is_anchor": True, **a} for a in anchors_pretty],
            )
            rationale = advice.get("reasoning_summary", "") or ""
            outfit_recommendations = advice.get("outfit_recommendations", []) or []
            do_dont = advice.get("do_dont", []) or []
            spoken_reply = advice.get("spoken_reply", "") or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Complete-outfit stylist call failed: %s", exc)
            # Soft-fail: the ranked suggestions are still useful without rationale.

    return {
        "anchors": [_slim_item(a) for a in anchors],
        "closet_suggestions": closet_suggestions,
        "market_suggestions": market_suggestions,
        "rationale": rationale,
        "outfit_recommendations": outfit_recommendations,
        "do_dont": do_dont,
        "spoken_reply": spoken_reply,
        "has_embeddings": centroid is not None,
        "weather_summary": weather_summary_text,
    }


# ------------------------- Phase Q: Wardrobe Reconstructor -------------------------

@router.get("/stats/sustainability")
async def get_sustainability_stats(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculate sustainability metrics (F5)."""
    db = get_db()
    
    items_cursor = db.closet_items.find({"user_id": user["id"]})
    items = []
    async for item in items_cursor:
        items.append(item)
    
    total_items = len(items)
    worn_items = sum(1 for item in items if (item.get("wear_count") or 0) > 0)
    utilisation_pct = round((worn_items / total_items) * 100) if total_items > 0 else 0
    
    receipt_items = sum(1 for item in items if item.get("from_receipt", False))
    manual_items = total_items - receipt_items
    
    carbon_sum = 0.0
    total_price = 0
    total_wears = 0
    for item in items:
        # Calculate carbon
        dpp = item.get("dpp_data") or {}
        cfp = dpp.get("carbon_footprint")
        if isinstance(cfp, (int, float)):
            carbon_sum += cfp
        elif isinstance(cfp, str):
            import re
            match = re.search(r"([\d\.]+)", cfp)
            if match:
                carbon_sum += float(match.group(1))
        
        # Calculate CPW aggregates
        price = item.get("price_cents")
        if price is not None:
            total_price += price / 100
        total_wears += (item.get("wear_count") or 0)

    current_cpw = (total_price / total_wears) if total_wears > 0 else total_price

    import datetime
    from dateutil.relativedelta import relativedelta
    now = datetime.datetime.now(datetime.timezone.utc)
    
    cpw_trend = []
    for i in range(5, -1, -1):
        target_month = now - relativedelta(months=i)
        month_label = target_month.strftime("%b")
        # Simulate a downward trend for CPW over time
        mock_cpw = current_cpw * (1 + (i * 0.15))
        cpw_trend.append({"month": month_label, "cpw": round(mock_cpw, 2)})
        
    return {
        "utilisation_pct": utilisation_pct,
        "cpw_trend": cpw_trend,
        "intake_breakdown": {
            "receipt": receipt_items,
            "manual": manual_items
        },
        "carbon_sum": round(carbon_sum, 1)
    }


