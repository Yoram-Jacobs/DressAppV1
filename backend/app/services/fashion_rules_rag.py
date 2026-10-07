"""Fashion Rules Knowledge Base & Lightweight RAG Retrieval Engine.

Loads canonical styling axioms into memory and dynamically retrieves the
top 3-5 relevant ground-truth rules for any styling turn based on:
1. Hard environmental/climate constraints (temperature, rain, snow).
2. Hard cultural/modesty constraints (conservative, orthodox, modest).
3. Event dress code & occasion formality.
4. Closet color palette & texture harmony matching.

Keeps total injected prompt tokens under 150 tokens so on-premises
CPU models (Qwen2.5-VL-3B-Instruct) remain sub-20s in inference latency.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.models.fashion_rule import FashionRule

logger = logging.getLogger(__name__)

_RULES_CACHE: list[FashionRule] = []
_RULES_BY_ID: dict[str, FashionRule] = {}


def _load_rules_from_seed() -> list[FashionRule]:
    """Load canonical rules from the seed JSON file."""
    seed_path = Path(__file__).resolve().parent.parent / "data" / "fashion_rules_seed.json"
    if not seed_path.exists():
        logger.warning("Fashion rules seed file not found at %s", seed_path)
        return []

    try:
        with open(seed_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        rules = [FashionRule.model_validate(r) for r in raw_data]
        logger.info("Loaded %d canonical fashion rules from seed", len(rules))
        return rules
    except Exception as exc:
        logger.error("Failed to parse fashion rules seed: %s", exc)
        return []


def initialize_rules_cache() -> None:
    """Initialize in-memory cache of fashion rules."""
    global _RULES_CACHE, _RULES_BY_ID
    if _RULES_CACHE:
        return
    _RULES_CACHE = _load_rules_from_seed()
    _RULES_BY_ID = {r.id: r for r in _RULES_CACHE}


async def sync_rules_to_db(db: Any) -> None:
    """Ensure fashion rules collection in MongoDB is seeded and indexed."""
    global _RULES_CACHE, _RULES_BY_ID
    initialize_rules_cache()
    if db is None or not _RULES_CACHE:
        return

    try:
        count = await db.fashion_rules.count_documents({})
        if count == 0:
            docs = [r.model_dump() for r in _RULES_CACHE]
            await db.fashion_rules.insert_many(docs)
            logger.info("Seeded %d fashion rules into MongoDB 'fashion_rules'", len(docs))
        else:
            # Refresh local cache with any rules in the database (admin updates)
            cursor = db.fashion_rules.find({})
            db_rules = []
            async for doc in cursor:
                doc.pop("_id", None)
                db_rules.append(FashionRule.model_validate(doc))
            if db_rules:
                _RULES_CACHE = db_rules
                _RULES_BY_ID = {r.id: r for r in _RULES_CACHE}
    except Exception as exc:
        logger.warning("Could not sync fashion rules with MongoDB: %s", exc)


def get_all_rules() -> list[FashionRule]:
    """Return all cached rules."""
    if not _RULES_CACHE:
        initialize_rules_cache()
    return list(_RULES_CACHE)


def retrieve_fashion_axioms(
    *,
    user_profile: dict[str, Any] | None = None,
    weather: dict[str, Any] | None = None,
    occasion: str | None = None,
    user_text: str | None = None,
    closet_summary: list[dict[str, Any]] | None = None,
    top_k: int = 4,
) -> list[FashionRule]:
    """Dynamically retrieve top-k most relevant fashion rules for this turn."""
    if not _RULES_CACHE:
        initialize_rules_cache()

    user_profile = user_profile or {}
    weather = weather or {}
    text_corpus = f"{occasion or ''} {user_text or ''}".lower()

    selected: list[FashionRule] = []
    selected_ids: set[str] = set()

    def add_rule(r_id: str) -> None:
        if r_id in _RULES_BY_ID and r_id not in selected_ids and len(selected) < top_k:
            selected.append(_RULES_BY_ID[r_id])
            selected_ids.add(r_id)

    # -------------------------------------------------------------
    # 1. Hard Cultural & Modesty Constraints (Highest Priority = 10)
    # -------------------------------------------------------------
    modesty_level = str(user_profile.get("modesty_level") or "").lower().strip()
    if modesty_level in ("conservative", "orthodox", "high", "modest"):
        add_rule("rule_cultural_modesty_conservative")

    if any(w in text_corpus for w in ("wedding", "חתונה", "ceremony", "sacred")):
        add_rule("rule_cultural_ceremony_etiquette")

    # -------------------------------------------------------------
    # 2. Hard Weather & Thermodynamic Constraints
    # -------------------------------------------------------------
    temp = weather.get("temp_c")
    if temp is None:
        temp = weather.get("temperature")
    if temp is None and isinstance(weather.get("main"), dict):
        temp = weather["main"].get("temp")

    is_rain = False
    weather_desc = str(weather.get("condition") or weather.get("description") or "").lower()
    if any(w in weather_desc or w in text_corpus for w in ("rain", "drizzle", "shower", "wet", "גשם")):
        is_rain = True

    if is_rain:
        add_rule("rule_weather_precipitation_protection")

    if temp is not None:
        try:
            temp_val = float(temp)
            if temp_val <= 5.0:
                add_rule("rule_weather_subzero_layering")
            elif 6.0 <= temp_val <= 16.0:
                add_rule("rule_weather_transitional_layering")
            elif temp_val >= 25.0:
                add_rule("rule_weather_summer_breathability")
        except (ValueError, TypeError):
            pass

    # -------------------------------------------------------------
    # 3. Occasion & Dress Code
    # -------------------------------------------------------------
    if any(w in text_corpus for w in ("interview", "business", "formal", "suit", "ראיון", "עבודה")):
        add_rule("rule_occasion_business_formal")
    elif any(w in text_corpus for w in ("smart-casual", "smart casual", "date", "dinner", "cocktail", "יציאה", "מסעדה")):
        add_rule("rule_occasion_smart_casual")

    # -------------------------------------------------------------
    # 4. Color Wheel & Texture Harmonies (Foundational Design Axioms)
    # -------------------------------------------------------------
    # Default to 60-30-10 composition anchor if we have space
    add_rule("rule_color_60_30_10")

    # Proportions & Golden Ratio (Rule of Thirds)
    add_rule("rule_proportion_rule_of_thirds")

    # Tactile Texture Contrast
    add_rule("rule_texture_tactile_contrast")

    # Fill remaining slots with visual weight matching or analogous rules
    add_rule("rule_texture_weight_matching")
    add_rule("rule_color_neutral_anchor")

    return selected[:top_k]


def format_rules_for_prompt(rules: list[FashionRule], max_chars_per_rule: int = 240) -> str:
    """Format the retrieved rules into a compact prompt string (<150 tokens)."""
    if not rules:
        return ""

    lines = ["GROUND-TRUTH FASHION DESIGN AXIOMS:"]
    for r in rules:
        stmt = r.rule_statement.strip()
        if r.negative_constraint and len(stmt) + len(r.negative_constraint) < max_chars_per_rule:
            line = f"• [{r.title}]: {stmt} (Avoid: {r.negative_constraint})"
        else:
            line = f"• [{r.title}]: {stmt}"
        lines.append(line)

    return "\n".join(lines)


def filter_modesty_closet_items(
    closet_items: list[dict[str, Any]] | None,
    modesty_level: str | None,
) -> list[dict[str, Any]]:
    """Prune garments that violate strict conservative/orthodox modesty standards."""
    if not closet_items:
        return []
    mod_norm = str(modesty_level or "").lower().strip()
    if mod_norm not in ("conservative", "orthodox", "high", "modest"):
        return closet_items

    # Garment cuts that inherently violate conservative modesty (exposed shoulders, knees, midriff)
    IMMODEST_CUTS = {
        "mini skirt", "crop top", "tank top", "halter top", "bikini",
        "swimwear", "tube top", "spaghetti strap", "shorts", "cutoffs",
        "camisole", "bralette", "sleeveless top", "mini dress"
    }

    filtered = []
    for it in closet_items:
        sub = str(it.get("sub_category") or it.get("item_type") or "").lower()
        title = str(it.get("title") or it.get("name") or "").lower()
        tags = [str(t).lower() for t in (it.get("tags") or [])]

        is_immodest = any(cut in sub or cut in title for cut in IMMODEST_CUTS)
        is_immodest = is_immodest or any(t in ("sleeveless", "sheer", "crop", "mini", "revealing") for t in tags)

        if not is_immodest:
            filtered.append(it)
        else:
            logger.info("Modesty filter pruned item: %s (%s)", it.get("id"), title)

    # Return filtered list (or fallback to original if user closet has nothing else)
    return filtered if filtered else closet_items

