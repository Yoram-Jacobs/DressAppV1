"""Marketplace + retail-store search for the Outfit Composer.

Live integration: the user's own ``listings`` collection (Phase L). Suggests
1-3 listings per outfit gap, ranked by:

  1. Category match (must)
  2. Price within optional budget
  3. Tag/keyword overlap with the brief
  4. Closet-style match by color/formality/season

Architecture-only stubs (per user choice **3d**):

  * ``_search_google_places``   — wires up when ``GOOGLE_PLACES_API_KEY`` lands
  * ``_search_retailer_feeds``  — wires up when affiliate API keys land

Both return ``[]`` today; no UI surface yet.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from app.config import settings
from app.db.database import get_db

logger = logging.getLogger(__name__)


# ─── public API ─────────────────────────────────────────────
async def suggest_for_gaps(
    *,
    user: dict[str, Any],
    gaps: list[dict[str, Any]],
    brief: str,
    constraints: dict[str, Any] | None = None,
    per_gap: int = 3,
) -> list[dict[str, Any]]:
    """Return MarketplaceSuggestion dicts for every empty slot.

    Resilient: never raises — a search failure for one gap silently
    contributes zero suggestions.
    """
    constraints = constraints or {}
    out: list[dict[str, Any]] = []
    seen_listing_ids: set[str] = set()
    for gap in gaps:
        role = gap.get("role")
        if not role:
            continue
        try:
            picks = await _suggest_for_role(
                user=user,
                role=role,
                brief=brief,
                constraints=constraints,
                per_gap=per_gap,
                exclude=seen_listing_ids,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("marketplace gap[%s] failed: %s", role, repr(exc)[:160])
            picks = []
        for p in picks:
            seen_listing_ids.add(p["listing_id"])
        out.extend(picks)
    return out


# ─── internals ──────────────────────────────────────────────
async def _suggest_for_role(
    *,
    user: dict[str, Any],
    role: str,
    brief: str,
    constraints: dict[str, Any],
    per_gap: int,
    exclude: set[str],
) -> list[dict[str, Any]]:
    db = get_db()
    cat_filter = _role_to_listing_filter(role)
    query: dict[str, Any] = {
        "status": "active",
        **cat_filter,
    }
    # Don't surface the user's own listings in their own outfit suggestions.
    if user.get("id"):
        query["seller_id"] = {"$ne": user["id"]}
    # Budget filter: applied as a *soft* preference (we still score below
    # budget items higher) but a hard ceiling so we never recommend
    # something 10× over budget.
    budget = _resolve_budget(constraints, role)
    if budget:
        cap = int(budget * 1.5)
        query["$or"] = [
            {"price_cents": {"$lte": cap}},
            {"financial_metadata.list_price_cents": {"$lte": cap}},
        ]

    cursor = db.listings.find(query, {"_id": 0}).sort([("created_at", -1)]).limit(50)
    listings = [doc async for doc in cursor]
    if not listings:
        return []

    # Score each listing.
    keywords = _extract_keywords(brief)
    scored = []
    for lst in listings:
        if lst.get("id") in exclude:
            continue
        score = _score_listing(lst, role=role, keywords=keywords, budget=budget)
        if score <= 0:
            continue
        scored.append((score, lst))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        _to_suggestion(lst, role=role, score=score)
        for score, lst in scored[:per_gap]
    ]


SLOT_CATEGORY_SYNONYMS: dict[str, list[str]] = {
    "top": ["top", "tops", "shirt", "tshirt", "t-shirt", "blouse", "sweater", "knit", "tee"],
    "bottom": ["bottom", "bottoms", "pants", "jeans", "shorts", "skirt", "trousers"],
    "dress": ["dress", "dresses", "full body", "full_body", "fullbody", "full-body", "one-piece", "jumpsuit", "romper"],
    "outerwear": ["outerwear", "jacket", "coat", "blazer"],
    "shoes": ["shoes", "shoe", "footwear", "sneakers", "boots", "heels", "sandals", "loafers"],
    "bag": ["bag", "bags", "handbag", "backpack", "purse"],
    "headwear": ["hat", "cap", "headwear", "scarf"],
    "accessory": ["accessory", "accessories", "jewellery", "jewelry", "belt", "watch"],
}


def role_to_category_query(role: str) -> dict[str, Any]:
    """Return a case-insensitive MongoDB category filter for an outfit slot role."""
    synonyms = SLOT_CATEGORY_SYNONYMS.get((role or "").strip().lower())
    if not synonyms:
        return {}
    pattern = "^(" + "|".join(re.escape(s) for s in synonyms) + ")$"
    return {"category": {"$regex": pattern, "$options": "i"}}


def _role_to_listing_filter(role: str) -> dict[str, Any]:
    return role_to_category_query(role)


def _resolve_budget(constraints: dict[str, Any], role: str) -> int | None:
    """Return per-slot budget (cents) or None."""
    full = constraints.get("budget_cents")
    if not full:
        return None
    # Allocate roughly proportional to typical outfit cost.
    weights = {
        "top": 0.20,
        "bottom": 0.25,
        "dress": 0.40,
        "outerwear": 0.30,
        "shoes": 0.25,
        "bag": 0.10,
        "accessory": 0.05,
        "headwear": 0.05,
    }
    return int(full * weights.get(role, 0.15))


_STOPWORDS = {
    "a", "the", "and", "or", "to", "for", "with", "of", "in", "on", "at",
    "an", "is", "are", "be", "this", "that", "i", "my", "wear", "want",
    "need", "please", "should", "could", "would", "going", "go", "have",
    "has", "had",
}


def _extract_keywords(text: str) -> set[str]:
    """Cheap keyword extractor — Latin + Unicode word characters."""
    if not text:
        return set()
    tokens = re.findall(r"[\w\u0590-\u05FF\u0600-\u06FF]+", text.lower(), flags=re.UNICODE)
    return {t for t in tokens if len(t) >= 3 and t not in _STOPWORDS}


def _score_listing(
    listing: dict[str, Any], *, role: str, keywords: set[str], budget: int | None,
) -> float:
    score = 1.0  # baseline since the category already matched
    # Tag / keyword overlap
    tag_pool: set[str] = set()
    for k in ("tags", "title", "brand", "color", "pattern", "material"):
        v = listing.get(k)
        if isinstance(v, str):
            tag_pool.update(_extract_keywords(v))
        elif isinstance(v, list):
            for x in v:
                if isinstance(x, str):
                    tag_pool.update(_extract_keywords(x))
    overlap = len(keywords & tag_pool)
    score += min(overlap, 4) * 0.5
    # Budget fit
    price, _ = _extract_price(listing)
    price = price or 0
    if budget and price:
        if price <= budget:
            score += 0.5
        elif price <= int(budget * 1.25):
            score += 0.1
        else:
            score -= 0.3
    # Recency tiny bonus (listings posted in last 30 days)
    # Skipping for speed — composer is already going to be ~3-5s.
    return score


def _extract_image_url(lst: dict[str, Any]) -> str | None:
    """Resolve the primary display image across legacy and current listing schemas."""
    for key in ("image_url", "thumbnail_url", "reconstructed_image_url", "clean_image_url"):
        val = lst.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    images = lst.get("images")
    if isinstance(images, list):
        for img in images:
            if isinstance(img, str) and img.strip():
                return img.strip()
    thumb = lst.get("thumbnail_data_url")
    if isinstance(thumb, str) and thumb.strip():
        return thumb.strip()
    return None


def _extract_price(lst: dict[str, Any]) -> tuple[int | None, str | None]:
    """Resolve price_cents and currency from top-level fields or financial_metadata."""
    fm = lst.get("financial_metadata") if isinstance(lst.get("financial_metadata"), dict) else {}
    price_cents = lst.get("price_cents")
    if price_cents is None:
        price_cents = fm.get("list_price_cents")
    currency = lst.get("currency") or fm.get("currency")
    return price_cents, currency


def _to_suggestion(
    lst: dict[str, Any], *, role: str, score: float
) -> dict[str, Any]:
    price_cents, currency = _extract_price(lst)
    return {
        "listing_id": lst.get("id") or "",
        "title": lst.get("title") or "Marketplace listing",
        "image_url": _extract_image_url(lst),
        "price_cents": price_cents,
        "currency": currency,
        "seller_display_name": lst.get("seller_display_name"),
        "fills_slot": role,
        "match_score": round(min(max(score / 4.0, 0.0), 1.0), 3),
        "why": _why_phrase(lst, role),
    }


def _why_phrase(lst: dict[str, Any], role: str) -> str:
    bits = []
    if lst.get("brand"):
        bits.append(f"{lst['brand']}")
    if lst.get("color"):
        bits.append(f"{lst['color']}")
    if lst.get("title"):
        bits.append(f"{lst['title']}")
    summary = " ".join(bits) or role
    return f"Fills the {role} slot — {summary[:70]}"


# ─── stubs (architecture-only, no surface yet) ─────────────
async def suggest_for_query(
    *,
    user: dict[str, Any],
    query: str,
    categories: list[str] | None = None,
    constraints: dict[str, Any] | None = None,
    per_category: int = 3,
) -> list[dict[str, Any]]:
    """Text-driven marketplace search (Phase S — Stylist horizon expansion).

    Used by ``stylist_widen`` when the Stylist response references a
    category the user does not own. Wraps ``suggest_for_gaps`` with a
    convenience signature so callers don't have to fabricate a fake
    gaps list.
    """
    if not categories:
        return []
    gaps = [{"role": cat} for cat in categories]
    return await suggest_for_gaps(
        user=user,
        gaps=gaps,
        brief=query,
        constraints=constraints or {},
        per_gap=per_category,
    )


async def _search_google_places(  # noqa: ARG001
    *, location: str | None, role: str,
) -> list[dict[str, Any]]:
    """Placeholder for nearby brick-and-mortar search via Google Places.

    Activate by setting ``GOOGLE_PLACES_API_KEY`` and routing this from
    ``suggest_for_gaps``. Returns ``[]`` until then.
    """
    if not getattr(settings, "GOOGLE_PLACES_API_KEY", None):
        return []
    return []


async def _search_retailer_feeds(  # noqa: ARG001
    *, role: str, keywords: set[str], budget: int | None,
) -> list[dict[str, Any]]:
    """Placeholder for affiliate retailer feeds (Zalando / ASOS / Shein).

    Activate by adding the relevant API keys to settings and routing
    this from ``suggest_for_gaps``. Returns ``[]`` until then.
    """
    return []
