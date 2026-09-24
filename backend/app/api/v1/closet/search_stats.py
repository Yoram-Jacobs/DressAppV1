from __future__ import annotations

import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.config import settings
from app.db.database import get_db
from app.services import repos
from app.services.auth import get_current_user
from app.services.fashion_clip import fashion_clip_service
from app.services import closet_service
from app.services.stylist_scheduler_brain import norm_category

logger = logging.getLogger(__name__)

router = APIRouter()

_SLIM_SEARCH_PROJECTION = {
    "clip_embedding": 1, "title": 1, "name": 1, "category": 1, "sub_category": 1,
    "brand": 1, "color": 1, "clean_image_url": 1, "reconstructed_image_url": 1,
    "thumbnail_data_url": 1, "created_at": 1, "id": 1, "group_id": 1, "group_role": 1,
}


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
        projection=_SLIM_SEARCH_PROJECTION,
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
    model_config = ConfigDict(extra="ignore")
    item_ids: list[str] = Field(min_length=1, max_length=8)
    include_marketplace: bool = False
    occasion: str | None = None
    limit: int = Field(default=6, ge=1, le=12)
    min_score: float = Field(default=0.10, ge=0.0, le=1.0)
    provider: str | None = None
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


async def _complete_outfit_with_gemma(
    *,
    anchors: list[dict[str, Any]],
    closet_candidates: list[dict[str, Any]],
    market_candidates: list[dict[str, Any]],
    occasion: str | None = None,
    weather_summary: str | None = None,
    language: str = "en",
) -> dict[str, Any]:
    """Complete the outfit using self-hosted Gemma-4 model on the Eyes inference server."""
    from app.services.vision.llm import _call_gemma_space, _extract_json, _LANG_NAMES

    lang_name = _LANG_NAMES.get(language.lower(), "English")
    sys_prompt = (
        "You are The Stylist — DressApp's expert fashion stylist and personal dresser.\n"
        "Your goal is to complete a stylish, cohesive outfit starting from the user's ANCHOR pieces, "
        "selecting complementary items from CLOSET_CANDIDATES (preferred) or MARKET_CANDIDATES.\n\n"
        "MANDATORY COMPLETE LOOK RULES:\n"
        "Every single outfit recommendation MUST be a COMPLETE, wearable head-to-toe ensemble. It MUST contain:\n"
        "1. Primary complementary garment(s): if anchor is a top, include a complementary bottom (pants, jeans, skirt, shorts); if anchor is bottom, include a top; if anchor is dress, include layering.\n"
        "2. SHOES / FOOTWEAR (role: 'shoes'): MANDATORY. Every outfit MUST include footwear (sneakers, boots, loafers, sandals, heels, flats). Pick the most complementary shoes from CLOSET_CANDIDATES whenever available, copying their exact closet_item_id. If none match, describe the ideal shoes with closet_item_id: null.\n"
        "3. ACCESSORY (role: 'accessory' or 'belt'): MANDATORY. Every outfit MUST include at least one accessory (bag, belt, sunglasses, hat, watch, scarf, or jewelry) to elevate the look. Pick from CLOSET_CANDIDATES with its closet_item_id, or describe the ideal piece with closet_item_id: null.\n"
        "4. Optional OUTERWEAR / LAYER (role: 'outerwear'): If appropriate for the occasion or weather (jacket, blazer, coat, cardigan).\n\n"
        "CRITICAL: NEVER omit shoes or accessories! Every outfit recommendation MUST include both a 'shoes' item and an 'accessory' item!\n\n"
        "Styling Principles:\n"
        "- Cohesion: Combine colors, textures, and silhouettes gracefully.\n"
        f"- Target Occasion: {occasion or 'casual / everyday chic'}\n"
        + (f"- Weather Context: {weather_summary}\n" if weather_summary else "")
        + f"- Language: Return all descriptive text in fluent {lang_name}.\n\n"
        "Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "reasoning_summary": "1-2 sentences explaining why the completed outfit works.",\n'
        '  "outfit_recommendations": [\n'
        "    {\n"
        '      "name": "3-5 word creative outfit title",\n'
        '      "items": [\n'
        '        {"role": "top"|"bottom"|"outerwear"|"shoes"|"accessory"|"dress"|"belt", "description": "piece description", "closet_item_id": "id or null"}\n'
        "      ],\n"
        '      "why": "2-3 sentences explaining the styling choices.",\n'
        '      "confidence": 0.95\n'
        "    }\n"
        "  ],\n"
        '  "do_dont": ["Do ...", "Don\'t ..."],\n'
        '  "spoken_reply": "Warm 1-2 sentence spoken summary for voice narration."\n'
        "}"
    )

    anchors_brief = [
        {"id": a.get("id"), "name": a.get("title") or a.get("name"), "category": a.get("category"), "color": a.get("color")}
        for a in anchors
    ]
    closet_brief = [
        {"id": c.get("id") or c.get("closet_item_id"), "name": c.get("title") or c.get("name"), "category": c.get("category"), "slot": c.get("norm_cat") or c.get("category"), "color": c.get("color")}
        for c in closet_candidates
    ]
    market_brief = [
        {"id": m.get("id") or m.get("listing_id"), "name": m.get("title") or m.get("name"), "category": m.get("category")}
        for m in market_candidates
    ]

    user_text = (
        f"Complete this outfit starting with these ANCHOR item(s):\n"
        f"{json.dumps(anchors_brief, ensure_ascii=False)}\n\n"
        f"Available CLOSET CANDIDATES to choose from:\n"
        f"{json.dumps(closet_brief, ensure_ascii=False)}\n\n"
        f"Available MARKETPLACE CANDIDATES:\n"
        f"{json.dumps(market_brief, ensure_ascii=False)}\n\n"
        f"Occasion: {occasion or 'casual / everyday'}"
    )

    gemma_schema = {
        "type": "object",
        "properties": {
            "reasoning_summary": {"type": "string"},
            "outfit_recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "role": {"type": "string"},
                                    "description": {"type": "string"},
                                    "closet_item_id": {"type": ["string", "null"]},
                                },
                                "required": ["role", "description"],
                            },
                        },
                        "why": {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["name", "items", "why"],
                },
            },
            "do_dont": {
                "type": "array",
                "items": {"type": "string"},
            },
            "spoken_reply": {"type": "string"},
        },
        "required": ["reasoning_summary", "outfit_recommendations"],
    }

    raw = await _call_gemma_space(
        system_prompt=sys_prompt,
        user_text=user_text,
        image_b64_jpeg=None,
        max_tokens=450,
        temperature=0.2,
        timeout=45.0,
        json_schema=gemma_schema,
    )
    parsed = _extract_json(raw)
    if isinstance(parsed, dict) and parsed.get("outfit_recommendations"):
        dd = parsed.get("do_dont")
        if isinstance(dd, dict):
            parsed["do_dont"] = [f"Do: {dd.get('do', '')}", f"Don't: {dd.get('dont', '')}"]
        return parsed
    return {}


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

    # ------- 3. Score closet candidates with category stratification -------
    anchor_norm_cats = {norm_category(a.get("category")) for a in anchors if a.get("category")}
    buckets: dict[str, list[dict[str, Any]]] = {
        "bottom": [],
        "shoes": [],
        "accessory": [],
        "outerwear": [],
        "dress": [],
        "top": [],
    }

    if centroid is not None:
        candidates = await repos.find_many(
            db.closet_items,
            {
                "user_id": user["id"],
                "id": {"$nin": payload.item_ids},
                "clip_embedding": {"$exists": True, "$ne": None},
                "group_role": {"$ne": "member"},
            },
            projection=_SLIM_SEARCH_PROJECTION,
            sort=[("created_at", -1)],
            limit=2000,
        )
        for c in candidates:
            vec = c.get("clip_embedding")
            if not isinstance(vec, list) or not vec:
                continue
            nc = norm_category(c.get("category"))
            # Diversity: skip same-category-as-any-anchor items unless accessory
            if nc in anchor_norm_cats and nc not in ("accessory",):
                continue
            score = fashion_clip_service.cosine(centroid, vec)
            if score < payload.min_score:
                continue
            slim = _slim_item(c)
            slim["_score"] = round(score, 4)
            slim["norm_cat"] = nc
            buckets.setdefault(nc, []).append(slim)

        for k in buckets:
            buckets[k].sort(key=lambda r: r["_score"], reverse=True)

    # Fallback: ensure shoes, accessories, and complementary garments exist even if embeddings were missing or low
    existing_ids = set(payload.item_ids) | {
        it["id"] for b in buckets.values() for it in b
    }
    needed_cats = ["shoes", "accessory"]
    if "top" in anchor_norm_cats:
        needed_cats.append("bottom")
    elif "bottom" in anchor_norm_cats:
        needed_cats.append("top")
    else:
        needed_cats.extend(["bottom", "top"])

    for req_cat in needed_cats:
        if len(buckets.get(req_cat, [])) < 3:
            fb_docs = await repos.find_many(
                db.closet_items,
                {
                    "user_id": user["id"],
                    "id": {"$nin": list(existing_ids)},
                    "group_role": {"$ne": "member"},
                },
                projection=_SLIM_SEARCH_PROJECTION,
                sort=[("created_at", -1)],
                limit=150,
            )
            for fb in fb_docs:
                fnc = norm_category(fb.get("category"))
                if fnc == req_cat and fb["id"] not in existing_ids:
                    slim = _slim_item(fb)
                    slim["_score"] = 0.5
                    slim["norm_cat"] = fnc
                    buckets.setdefault(fnc, []).append(slim)
                    existing_ids.add(fb["id"])
                    if len(buckets[fnc]) >= 4:
                        break

    # Assemble stratified candidates list:
    stratified_closet: list[dict[str, Any]] = []
    if "top" in anchor_norm_cats:
        stratified_closet.extend(buckets.get("bottom", [])[:4])
    elif "bottom" in anchor_norm_cats:
        stratified_closet.extend(buckets.get("top", [])[:4])
    elif "dress" in anchor_norm_cats:
        pass
    else:
        stratified_closet.extend(buckets.get("bottom", [])[:3])
        stratified_closet.extend(buckets.get("top", [])[:3])

    if "shoes" not in anchor_norm_cats:
        stratified_closet.extend(buckets.get("shoes", [])[:4])
    stratified_closet.extend(buckets.get("accessory", [])[:4])
    if "outerwear" not in anchor_norm_cats:
        stratified_closet.extend(buckets.get("outerwear", [])[:2])

    if not stratified_closet:
        for b in buckets.values():
            stratified_closet.extend(b[:2])

    closet_suggestions = stratified_closet

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

    # ------- 6. Stylist rationale (Gemma / Gemini) -------
    from app.services.gemini_stylist import get_gemini_stylist_service

    rationale = ""
    outfit_recommendations: list[dict[str, Any]] = []
    do_dont: list[str] = []
    spoken_reply = ""

    # Determine provider preference
    preferred_provider = (payload.provider or "").lower()
    if not preferred_provider:
        # Default to gemma if EYES_PROVIDER is gemma or if self-hosted EYES Space URL is configured
        preferred_provider = "gemma" if (getattr(settings, "EYES_PROVIDER", "") or "").lower() == "gemma" or settings.EYES_GEMMA_SPACE_URL else "gemini"

    user_lang = user.get("preferred_language") or "en"

    # Try Gemma first if preferred and configured
    if preferred_provider == "gemma" and settings.EYES_GEMMA_SPACE_URL:
        try:
            gemma_res = await _complete_outfit_with_gemma(
                anchors=anchors,
                closet_candidates=closet_suggestions,
                market_candidates=market_suggestions,
                occasion=payload.occasion,
                weather_summary=weather_summary_text,
                language=user_lang,
            )
            if gemma_res and gemma_res.get("outfit_recommendations"):
                rationale = gemma_res.get("reasoning_summary", "") or ""
                outfit_recommendations = gemma_res.get("outfit_recommendations", []) or []
                do_dont = gemma_res.get("do_dont", []) or []
                spoken_reply = gemma_res.get("spoken_reply", "") or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Complete-outfit Gemma call failed: %s", exc)

    # Fallback to Gemini if Gemma wasn't preferred or produced no recommendations
    if not outfit_recommendations:
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
                        "score": s.get("_score", 0.0),
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
                        "score": lg.get("_score", 0.0),
                    }
                    for lg in market_suggestions
                ]
                weather_line = (
                    f"\nWEATHER: {weather_summary_text}"
                    if weather_summary_text
                    else ""
                )
                request_text = (
                    "Complete this outfit using the user's ANCHOR pieces as the starting point. "
                    "The anchors are listed in priority order (first = most important).\n\n"
                    "MANDATORY COMPLETE LOOK RULES:\n"
                    "Every outfit recommendation MUST be a complete, wearable head-to-toe look and MUST contain:\n"
                    "1. Primary complementary garments: if anchor is a top, include complementary bottom (pants, jeans, skirt); if anchor is bottom, include a top; if anchor is dress, include layering.\n"
                    "2. SHOES / FOOTWEAR (role: 'shoes'): MANDATORY. Every outfit MUST include footwear (sneakers, boots, loafers, sandals, heels). Pick from CLOSET_CANDIDATES with its exact closet_item_id.\n"
                    "3. ACCESSORY (role: 'accessory' or 'belt'): MANDATORY. Every outfit MUST include at least one accessory (bag, belt, sunglasses, hat, watch, scarf, or jewelry) to elevate the look. Pick from CLOSET_CANDIDATES with its exact closet_item_id.\n"
                    "4. Optional layering/outerwear (role: 'outerwear') if appropriate for the occasion or weather.\n\n"
                    "CRITICAL: Always select matching pieces from CLOSET_CANDIDATES first and copy their exact closet_item_id. "
                    "Never omit shoes or accessories from any recommendation. Return ONE or TWO outfit recommendations. "
                    "In `why`, explain the styling reasoning in 1-2 sentences. If weather context is provided AND the occasion sounds outdoor, "
                    "prioritise weather-appropriate layers/footwear and call that out in the rationale.\n\n"
                    f"OCCASION: {payload.occasion or 'unspecified (casual by default)'}"
                    f"{weather_line}\n\n"
                    f"ANCHORS (priority order): "
                    f"{json.dumps(anchors_pretty, ensure_ascii=False)}\n\n"
                    f"CLOSET_CANDIDATES: {json.dumps(closet_short, ensure_ascii=False)}\n\n"
                    f"MARKET_CANDIDATES: {json.dumps(market_short, ensure_ascii=False)}"
                )
                user_profile = {
                    "preferred_language": user_lang,
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
                logger.warning("Complete-outfit Gemini stylist call failed: %s", exc)

    if outfit_recommendations:
        # Safety net: ensure each recommendation has footwear and accessory, and resolve IDs
        for rec in outfit_recommendations:
            rec_items = rec.get("items") or []
            roles_present = {norm_category(it.get("role") or it.get("category")) for it in rec_items}

            # Guarantee Shoes
            if "shoes" not in roles_present and "shoes" not in anchor_norm_cats:
                shoe_pool = buckets.get("shoes", [])
                if shoe_pool:
                    best_shoe = shoe_pool[0]
                    rec_items.append({
                        "role": "shoes",
                        "description": best_shoe.get("title") or best_shoe.get("name") or "Shoes",
                        "closet_item_id": best_shoe.get("id"),
                    })
                    roles_present.add("shoes")

            # Guarantee Accessory
            if "accessory" not in roles_present:
                acc_pool = buckets.get("accessory", [])
                if acc_pool:
                    best_acc = acc_pool[0]
                    rec_items.append({
                        "role": "accessory",
                        "description": best_acc.get("title") or best_acc.get("name") or "Accessory",
                        "closet_item_id": best_acc.get("id"),
                    })
                    roles_present.add("accessory")

            # Resolve missing closet_item_id where possible
            for it in rec_items:
                if not it.get("closet_item_id"):
                    it_norm = norm_category(it.get("role") or it.get("category"))
                    cand_pool = buckets.get(it_norm, [])
                    if cand_pool:
                        it_desc = (it.get("description") or it.get("title") or "").lower()
                        matched = next((c for c in cand_pool if (c.get("title") or "").lower() in it_desc or it_desc in (c.get("title") or "").lower()), cand_pool[0])
                        it["closet_item_id"] = matched.get("id")

            rec["items"] = rec_items

        used_closet_ids = set()
        used_descriptions = set()
        for rec in outfit_recommendations:
            for it in rec.get("items", []):
                if it.get("closet_item_id"):
                    used_closet_ids.add(it["closet_item_id"])
                if it.get("description"):
                    used_descriptions.add(it["description"].strip().lower())
                if it.get("title"):
                    used_descriptions.add(it["title"].strip().lower())
        filtered_suggestions = [
            s for s in closet_suggestions
            if s.get("id") in used_closet_ids
            or any(d in (s.get("title") or s.get("name") or "").lower() or (s.get("title") or s.get("name") or "").lower() in d for d in used_descriptions)
        ]
        found_ids = {s.get("id") for s in filtered_suggestions}
        for uid in used_closet_ids:
            if uid not in found_ids:
                extra = await repos.find_one(db.closet_items, {"id": uid, "user_id": user["id"]})
                if extra:
                    filtered_suggestions.append(_slim_item(extra))
                    found_ids.add(uid)
        if filtered_suggestions:
            closet_suggestions = filtered_suggestions

        if market_suggestions:
            filtered_market = [
                m for m in market_suggestions
                if any(d in (m.get("title") or m.get("name") or "").lower() or (m.get("title") or m.get("name") or "").lower() in d for d in used_descriptions)
            ]
            if filtered_market:
                market_suggestions = filtered_market

    # Synthesized fallback rationale if neither model succeeded
    if not rationale and (closet_suggestions or market_suggestions):
        anchor_names = ", ".join(a.get("title") or a.get("name") or "piece" for a in anchors)
        rationale = f"Curated outfit suggestions based on your {anchor_names} for {payload.occasion or 'everyday wear'}."

    def _sanitize(obj: Any) -> Any:
        try:
            from bson import ObjectId
            if isinstance(obj, ObjectId):
                return str(obj)
        except ImportError:
            pass
        if isinstance(obj, dict):
            return {k: _sanitize(v) for k, v in obj.items() if k != "_id"}
        if isinstance(obj, list):
            return [_sanitize(x) for x in obj]
        return obj

    return _sanitize({
        "anchors": [_slim_item(a) for a in anchors],
        "closet_suggestions": closet_suggestions,
        "market_suggestions": market_suggestions,
        "rationale": rationale,
        "outfit_recommendations": outfit_recommendations,
        "do_dont": do_dont,
        "spoken_reply": spoken_reply,
        "has_embeddings": centroid is not None,
        "weather_summary": weather_summary_text,
    })


# ------------------------- Phase Q: Wardrobe Reconstructor -------------------------

@router.get("/stats/sustainability")
async def get_sustainability_stats(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculate sustainability metrics (F5)."""
    db = get_db()
    
    items_cursor = db.closet_items.find(
        {"user_id": user["id"]},
        {"_id": 0, "wear_count": 1, "from_receipt": 1, "dpp_data": 1, "price_cents": 1}
    )
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


