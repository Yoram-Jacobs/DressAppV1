"""Detect potential duplicates of newly-analysed garments.

Problem
-------
After ``/closet/analyze`` produces a clean cutout + LLM analysis, we want
to spare the user from accidentally re-uploading a garment they already
own (the most common case: same DSLR shot uploaded twice while iterating
on lighting). Without this they'd end up with two identical "Charcoal
Grey Polo Shirt" cards and no clear signal which to keep.

Strategy (Option A — strict matching, recommended in chat)
----------------------------------------------------------
Flag a duplicate when ALL of these match an existing closet item:

* ``item_type`` (case-insensitive)
* ``sub_category`` (case-insensitive)
* the *dominant* color name (i.e. ``colors[0].name`` if present, else
  the legacy top-level ``color`` field)
* AND if BOTH items carry a ``brand``, the brands must agree
  (otherwise the brand is ignored — many garments are unbranded)

This is strict enough to catch genuine re-uploads ("Charcoal grey polo"
→ "Charcoal grey polo") without false-positiving on "two different white
t-shirts I genuinely own".

Implementation
--------------
The whole analyse-flow runs server-side and already has a Mongo handle,
so we do a single ``.find()`` per analysis call (typically 1-3 items per
upload) using a compound index already in place on
``(user_id, sub_category)``. The fan-out is tiny — 99% of users have
under 200 closet items.
"""
from __future__ import annotations

import logging
from typing import Any

from app.db.database import get_db

from app.services.image_hash import (
    average_hash,
    compute_sha256,
    is_duplicate_match,
    hamming_distance,
    DEFAULT_HAMMING_THRESHOLD,
    DEFAULT_COLOR_THRESHOLD,
)

logger = logging.getLogger(__name__)

# Cross-lingual taxonomy normalization for robust metadata duplicate matching
CATEGORY_CANONICAL_MAP = {
    # Footwear
    "footwear": "footwear", "shoes": "footwear", "sneakers": "footwear", "boots": "footwear",
    "sandals": "footwear", "heels": "footwear", "loafers": "footwear", "slippers": "footwear",
    "נעליים": "footwear", "סניקרס": "footwear", "מגפיים": "footwear", "סנדלים": "footwear",
    "עקבים": "footwear", "כפכפים": "footwear", "נעלי ספורט": "footwear", "נעלי ריצה": "footwear",
    
    # Tops
    "top": "top", "shirt": "top", "t-shirt": "top", "tee": "top", "blouse": "top",
    "sweater": "top", "hoodie": "top", "sweatshirt": "top", "tank": "top", "tank top": "top",
    "חולצה": "top", "חולצת טי": "top", "טי שירט": "top", "בלוזה": "top", "סוודר": "top",
    "קפוצ'ון": "top", "סווטשירט": "top", "גופייה": "top", "גופיה": "top",
    
    # Bottoms
    "bottom": "bottom", "pants": "bottom", "trousers": "bottom", "jeans": "bottom",
    "shorts": "bottom", "skirt": "bottom", "leggings": "bottom", "joggers": "bottom",
    "מכנסיים": "bottom", "מכנס": "bottom", "ג'ינס": "bottom", "שורטס": "bottom",
    "חצאית": "bottom", "טייץ": "bottom", "מכנסי ספורט": "bottom", "מכנסי טרנינג": "bottom",
    
    # Outerwear
    "outerwear": "outerwear", "jacket": "outerwear", "coat": "outerwear", "blazer": "outerwear",
    "cardigan": "outerwear", "trench": "outerwear", "vest": "outerwear", "parka": "outerwear",
    "bolero": "outerwear",
    "ג'קט": "outerwear", "מעיל": "outerwear", "בלייזר": "outerwear", "קרדיגן": "outerwear",
    "ז'קט": "outerwear", "וסט": "outerwear", "בולרו": "outerwear",
    
    # Dresses & Jumpsuits
    "dress": "dress", "gown": "dress", "jumpsuit": "dress", "romper": "dress",
    "שמלה": "dress", "אוברול": "dress",

    # Bags & Accessories
    "accessory": "accessory", "accessories": "accessory",
    "bag": "bag", "handbag": "bag", "purse": "bag", "tote": "bag", "backpack": "bag",
    "תיק": "bag", "תיק יד": "bag", "תיק צד": "bag", "תיק גב": "bag",
    "belt": "belt", "חגורה": "belt", "חגורת עור": "belt",
    "hat": "hat", "cap": "hat", "כובע": "hat",
    "scarf": "scarf", "צעיף": "scarf",
}

SUBCATEGORY_CANONICAL_MAP = {
    # Tops / Upper
    "sweater": "sweater", "סוודר": "sweater", "סריג": "sweater", "knitwear": "sweater",
    "cardigan": "cardigan", "קרדיגן": "cardigan",
    "hoodie": "hoodie", "קפוצ'ון": "hoodie", "sweatshirt": "hoodie", "סווטשירט": "hoodie",
    "t-shirt": "t_shirt", "t_shirt": "t_shirt", "tee": "t_shirt", "טי שירט": "t_shirt", "חולצת טי": "t_shirt",
    "shirt": "shirt", "button-down": "shirt", "button_down_shirt": "shirt", "חולצה מכופתרת": "shirt",
    "blouse": "blouse", "בלוזה": "blouse",
    "tank": "tank_top", "tank top": "tank_top", "tank_top": "tank_top", "גופייה": "tank_top", "גופיה": "tank_top",
    "mesh top": "mesh_top", "mesh_top": "mesh_top", "טופ רשת": "mesh_top", "top": "top", "טופ": "top",

    # Bottoms
    "jeans": "jeans", "ג'ינס": "jeans",
    "shorts": "shorts", "מכנס קצר": "shorts", "שורטס": "shorts",
    "pants": "pants", "trousers": "pants", "מכנסיים": "pants", "מכנס": "pants",
    "skirt": "skirt", "חצאית": "skirt",
    "leggings": "leggings", "טייץ": "leggings",
    "sweatpants": "sweatpants", "joggers": "sweatpants", "מכנסי טרנינג": "sweatpants",

    # Outerwear
    "jacket": "jacket", "ג'קט": "jacket", "ז'קט": "jacket", "בלייזר": "blazer", "blazer": "blazer",
    "coat": "coat", "מעיל": "coat", "trench": "trench", "vest": "vest", "וסט": "vest",
    "bolero": "bolero", "בולרו": "bolero",

    # Footwear
    "sandals": "sandals", "slides": "sandals", "flip_flops": "sandals", "flip-flops": "sandals",
    "כפכפים": "sandals", "סנדלים": "sandals", "floppers": "sandals",
    "sneakers": "sneakers", "נעלי ספורט": "sneakers", "סניקרס": "sneakers", "running_shoes": "sneakers",
    "boots": "boots", "מגפיים": "boots", "מגפונים": "boots",
    "heels": "heels", "עקבים": "heels", "נעלי עקב": "heels",
    "loafers": "loafers", "נעלי מוקסין": "loafers", "shoes": "shoes", "נעליים": "shoes",

    # Dresses & Jumpsuits
    "dress": "dress", "שמלה": "dress",
    "jumpsuit": "jumpsuit", "אוברול": "jumpsuit",

    # Bags & Accessories
    "bag": "bag", "handbag": "bag", "תיק": "bag", "תיק יד": "bag", "backpack": "backpack", "תיק גב": "backpack",
    "belt": "belt", "חגורה": "belt",
    "hat": "hat", "cap": "hat", "כובע": "hat",
    "scarf": "scarf", "צעיף": "scarf",
}

COLOR_CANONICAL_MAP = {
    "white": "white", "לבן": "white",
    "black": "black", "שחור": "black",
    "blue": "blue", "כחול": "blue", "נייבי": "blue", "navy": "blue", "תכלת": "blue", "כחול כהה": "blue", "כחול בהיר": "blue",
    "red": "red", "אדום": "red", "בורדו": "red", "burgundy": "red",
    "green": "green", "ירוק": "green", "זית": "green", "olive": "green", "ירוק כהה": "green", "ירוק בהיר": "green", "חאקי": "green", "khaki": "green",
    "yellow": "yellow", "צהוב": "yellow", "חרדל": "yellow", "mustard": "yellow",
    "grey": "grey", "gray": "grey", "אפור": "grey", "charcoal": "grey", "אפור כהה": "grey", "אפור בהיר": "grey",
    "brown": "brown", "חום": "brown", "tan": "brown", "camel": "brown", "חום כהה": "brown", "חום בהיר": "brown",
    "pink": "pink", "ורוד": "pink",
    "purple": "purple", "סגול": "purple", "lavender": "purple", "לבנדר": "purple",
    "beige": "beige", "בז'": "beige", "cream": "beige", "שמנת": "beige",
    "orange": "orange", "כתום": "orange",
}

STOP_WORDS = {
    "a", "an", "the", "and", "or", "of", "in", "with", "for", "on", "by", "to",
    "של", "עם", "בצבע", "בסיסי", "בסיסית", "פריט", "בגדים", "אופנה", "חדש", "יפה",
    "garment", "item", "clothing", "fashion", "basic", "classic", "casual",
}


def _norm(value: str | None) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def _dominant_color(analysis: dict[str, Any]) -> str:
    colors = analysis.get("colors") or []
    if isinstance(colors, list) and colors:
        first = colors[0]
        if isinstance(first, dict):
            name = first.get("name")
            if isinstance(name, str) and name.strip():
                return _norm(name)
        elif isinstance(first, str) and first.strip():
            return _norm(first)
    legacy = analysis.get("color")
    if isinstance(legacy, str) and legacy.strip():
        return _norm(legacy)
    return ""


def _canonical_category(val: str | None) -> str:
    norm = _norm(val)
    if not norm:
        return ""
    if norm in CATEGORY_CANONICAL_MAP:
        return CATEGORY_CANONICAL_MAP[norm]
    for part in norm.split():
        if part in CATEGORY_CANONICAL_MAP:
            return CATEGORY_CANONICAL_MAP[part]
    for k, v in CATEGORY_CANONICAL_MAP.items():
        if len(k) >= 3 and k in norm:
            return v
    return norm


def _canonical_subcategory(val: str | None) -> str:
    norm = _norm(val).replace("-", "_").replace(" ", "_")
    if not norm:
        return ""
    if norm in SUBCATEGORY_CANONICAL_MAP:
        return SUBCATEGORY_CANONICAL_MAP[norm]
    for k, v in SUBCATEGORY_CANONICAL_MAP.items():
        if k in norm:
            return v
    return norm


def _canonical_color(val: str | None) -> str:
    norm = _norm(val)
    if not norm:
        return ""
    if norm in COLOR_CANONICAL_MAP:
        return COLOR_CANONICAL_MAP[norm]
    for part in norm.split():
        if part in COLOR_CANONICAL_MAP:
            return COLOR_CANONICAL_MAP[part]
    for k, v in COLOR_CANONICAL_MAP.items():
        if len(k) >= 3 and k in norm:
            return v
    return norm


def _extract_title_tokens(title: str | None) -> set[str]:
    norm = _norm(title)
    if not norm:
        return set()
    for ch in ",.-_/:;'\"!?()[]{}":
        norm = norm.replace(ch, " ")
    return {w for w in norm.split() if len(w) >= 2 and w not in STOP_WORDS}


async def find_potential_duplicate(
    user_id: str, analysis: dict[str, Any]
) -> dict[str, Any] | None:
    """Return the first existing closet item that "looks like" the
    analysed garment by perceptual hash or strict normalized metadata,
    or ``None`` if nothing matches.
    """
    db = get_db()
    
    # 1. Perceptual Image Fingerprint Check (Visual Priority)
    source_img = (
        analysis.get("crop_base64")
        or analysis.get("clean_image_url")
        or analysis.get("thumbnail_data_url")
        or analysis.get("original_image_url")
        or analysis.get("image_url")
        or analysis.get("cutout_url")
        or analysis.get("image_base64")
    )
    incoming_phash = analysis.get("source_phash") or (average_hash(source_img) if source_img else None)
    incoming_sha = analysis.get("source_sha256") or (compute_sha256(source_img) if source_img else None)
    incoming_parent_sha = analysis.get("parent_image_sha256") or (
        compute_sha256(analysis.get("parent_image_bytes")) if analysis.get("parent_image_bytes") else None
    )
    
    # Query all user closet items
    cursor = db.closet_items.find(
        {"user_id": user_id},
        {
            "_id": 0,
            "id": 1,
            "title": 1,
            "name": 1,
            "category": 1,
            "sub_category": 1,
            "item_type": 1,
            "brand": 1,
            "color": 1,
            "colors": 1,
            "thumbnail_data_url": 1,
            "clean_image_url": 1,
            "original_image_url": 1,
            "segmented_image_url": 1,
            "source_phash": 1,
            "source_sha256": 1,
            "parent_image_sha256": 1,
        },
    ).limit(300)
    
    existing_items = await cursor.to_list(length=300)
    if not existing_items:
        return None
    
    # Check visual hash match first
    for existing in existing_items:
        ex_phash = existing.get("source_phash")
        ex_sha = existing.get("source_sha256")
        ex_parent_sha = existing.get("parent_image_sha256")

        # 1a. Check exact parent photo re-upload
        if incoming_parent_sha and ex_parent_sha and incoming_parent_sha == ex_parent_sha:
            return {
                "id": existing.get("id"),
                "title": existing.get("title") or existing.get("name") or "Untitled garment",
                "name": existing.get("name"),
                "item_type": existing.get("item_type"),
                "sub_category": existing.get("sub_category"),
                "brand": existing.get("brand"),
                "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url") or existing.get("original_image_url"),
                "match_reason": "parent_photo_exact_match",
            }

        # Lazy compute if existing item has an image but no phash stored yet
        if not ex_phash and not ex_sha:
            for candidate_key in (
                "clean_image_url",
                "segmented_image_url",
                "thumbnail_data_url",
                "original_image_url",
            ):
                ex_img = existing.get(candidate_key)
                if not ex_img or not isinstance(ex_img, str):
                    continue
                if ex_img.startswith("data:") or len(ex_img) > 300:
                    ex_phash = average_hash(ex_img)
                    ex_sha = compute_sha256(ex_img)
                else:
                    try:
                        from app.services.closet_service import read_image_bytes_from_url
                        raw_ex = await read_image_bytes_from_url(ex_img)
                        if raw_ex:
                            ex_phash = average_hash(raw_ex)
                            ex_sha = compute_sha256(raw_ex)
                    except Exception:
                        pass
                if ex_phash or ex_sha:
                    try:
                        await db.closet_items.update_one(
                            {"id": existing["id"]},
                            {"$set": {"source_phash": ex_phash, "source_sha256": ex_sha}},
                        )
                    except Exception:
                        pass
                    break
            
        # 1b. Exact crop SHA-256 match
        if incoming_sha and ex_sha and incoming_sha == ex_sha:
            return {
                "id": existing.get("id"),
                "title": existing.get("title") or existing.get("name") or "Untitled garment",
                "name": existing.get("name"),
                "item_type": existing.get("item_type"),
                "sub_category": existing.get("sub_category"),
                "brand": existing.get("brand"),
                "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url") or existing.get("original_image_url"),
                "match_reason": "visual_hash_exact",
            }

        # 1c. Strict perceptual dHash match (Hamming distance <= 3)
        if incoming_phash and ex_phash:
            # Reject degenerate flat hashes (all-0s or all-1s has zero entropy and collides across flat cutouts)
            try:
                ai = int(incoming_phash, 16)
                bi = int(ex_phash, 16)
                bits_a = ai.bit_count()
                bits_b = bi.bit_count()
            except ValueError:
                bits_a = bits_b = 0
            
            if 6 <= bits_a <= 58 and 6 <= bits_b <= 58:
                dist = hamming_distance(incoming_phash, ex_phash)
                if dist <= 3:
                    # Category and subcategory must not actively contradict
                    incoming_cat_v = _canonical_category(analysis.get("category") or analysis.get("sub_category") or analysis.get("item_type"))
                    ex_cat_v = _canonical_category(existing.get("category") or existing.get("sub_category") or existing.get("item_type"))
                    incoming_sub_v = _canonical_subcategory(analysis.get("sub_category") or analysis.get("item_type") or analysis.get("category"))
                    ex_sub_v = _canonical_subcategory(existing.get("sub_category") or existing.get("item_type") or existing.get("category"))

                    if incoming_cat_v and ex_cat_v and incoming_cat_v != ex_cat_v:
                        continue
                    if incoming_sub_v and ex_sub_v and incoming_sub_v != ex_sub_v:
                        continue

                    return {
                        "id": existing.get("id"),
                        "title": existing.get("title") or existing.get("name") or "Untitled garment",
                        "name": existing.get("name"),
                        "item_type": existing.get("item_type"),
                        "sub_category": existing.get("sub_category"),
                        "brand": existing.get("brand"),
                        "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url") or existing.get("original_image_url"),
                        "match_reason": f"visual_hash (dist={dist})",
                    }

    # 2. Strict Normalized Multilingual Metadata Check
    incoming_cat = _canonical_category(analysis.get("category") or analysis.get("sub_category") or analysis.get("item_type"))
    incoming_sub = _canonical_subcategory(analysis.get("sub_category") or analysis.get("item_type") or analysis.get("category"))
    incoming_color = _canonical_color(_dominant_color(analysis))
    brand = _norm(analysis.get("brand"))
    incoming_tokens = _extract_title_tokens(analysis.get("title") or analysis.get("name"))
    
    if incoming_cat and incoming_color:
        for existing in existing_items:
            ex_cat = _canonical_category(existing.get("category") or existing.get("sub_category") or existing.get("item_type"))
            ex_sub = _canonical_subcategory(existing.get("sub_category") or existing.get("item_type") or existing.get("category"))
            ex_color = _canonical_color(_dominant_color(existing))
            existing_brand = _norm(existing.get("brand"))
            existing_tokens = _extract_title_tokens(existing.get("title") or existing.get("name"))

            # Broad category AND dominant color family MUST match
            if incoming_cat != ex_cat or incoming_color != ex_color:
                continue

            # If both have brands, they MUST agree
            if brand and existing_brand and brand != existing_brand:
                continue

            # Sub-category / item type MUST match (e.g. sweater != mesh top, hoodie != shirt)
            sub_matched = bool(incoming_sub and ex_sub and incoming_sub == ex_sub)
            if not sub_matched:
                continue

            # Title tokens overlap
            overlap = incoming_tokens & existing_tokens
            if incoming_tokens and existing_tokens:
                min_len = min(len(incoming_tokens), len(existing_tokens))
                # For very short titles (1-2 tokens), 1 match is sufficient; otherwise require >= 2
                if len(overlap) >= 2 or (min_len <= 2 and len(overlap) >= 1):
                    return {
                        "id": existing.get("id"),
                        "title": existing.get("title") or existing.get("name") or "Untitled garment",
                        "name": existing.get("name"),
                        "item_type": existing.get("item_type"),
                        "sub_category": existing.get("sub_category"),
                        "brand": existing.get("brand"),
                        "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url") or existing.get("original_image_url"),
                        "match_reason": "metadata_match",
                    }
            elif sub_matched and brand and existing_brand and brand == existing_brand:
                # If titles are missing/generic, identical brand + subcategory + color confirms duplicate
                return {
                    "id": existing.get("id"),
                    "title": existing.get("title") or existing.get("name") or "Untitled garment",
                    "name": existing.get("name"),
                    "item_type": existing.get("item_type"),
                    "sub_category": existing.get("sub_category"),
                    "brand": existing.get("brand"),
                    "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url") or existing.get("original_image_url"),
                    "match_reason": "metadata_brand_match",
                }
                
    return None


