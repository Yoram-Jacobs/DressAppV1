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
    DEFAULT_HAMMING_THRESHOLD,
    DEFAULT_COLOR_THRESHOLD,
)

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
    "ג'קט": "outerwear", "מעיל": "outerwear", "בלייזר": "outerwear", "קרדיגן": "outerwear",
    "ז'קט": "outerwear", "וסט": "outerwear",
    
    # Dresses & Jumpsuits
    "dress": "dress", "gown": "dress", "jumpsuit": "dress", "romper": "dress",
    "שמלה": "dress", "אוברול": "dress",
}

COLOR_CANONICAL_MAP = {
    "white": "white", "לבן": "white",
    "black": "black", "שחור": "black",
    "blue": "blue", "כחול": "blue", "נייבי": "blue", "navy": "blue",
    "red": "red", "אדום": "red", "בורדו": "red", "burgundy": "red",
    "green": "green", "ירוק": "green", "זית": "green", "olive": "green",
    "yellow": "yellow", "צהוב": "yellow",
    "grey": "grey", "gray": "grey", "אפור": "grey", "charcoal": "grey",
    "brown": "brown", "חום": "brown", "tan": "brown", "camel": "brown",
    "pink": "pink", "ורוד": "pink",
    "purple": "purple", "סגול": "purple", "lavender": "purple", "לבנדר": "purple",
    "beige": "beige", "בז'": "beige", "cream": "beige", "שמנת": "beige",
    "orange": "orange", "כתום": "orange",
}


def _canonical_category(val: str | None) -> str:
    norm = _norm(val)
    return CATEGORY_CANONICAL_MAP.get(norm, norm)


def _canonical_color(val: str | None) -> str:
    norm = _norm(val)
    return COLOR_CANONICAL_MAP.get(norm, norm)


async def find_potential_duplicate(
    user_id: str, analysis: dict[str, Any]
) -> dict[str, Any] | None:
    """Return the first existing closet item that "looks like" the
    analysed garment by perceptual hash or normalized metadata,
    or ``None`` if nothing matches.
    """
    db = get_db()
    
    # 1. Perceptual Image Fingerprint Check (Visual Priority)
    source_img = (
        analysis.get("clean_image_url")
        or analysis.get("thumbnail_data_url")
        or analysis.get("image_url")
        or analysis.get("cutout_url")
    )
    incoming_phash = analysis.get("source_phash") or (average_hash(source_img) if source_img else None)
    incoming_sha = analysis.get("source_sha256") or (compute_sha256(source_img) if source_img else None)
    
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
            "source_phash": 1,
            "source_sha256": 1,
        },
    ).limit(300)
    
    existing_items = await cursor.to_list(length=300)
    
    # Check visual hash match first
    if incoming_phash or incoming_sha:
        for existing in existing_items:
            ex_phash = existing.get("source_phash")
            ex_sha = existing.get("source_sha256")
            
            # Lazy compute if existing item has an image but no phash stored yet
            if not ex_phash and (existing.get("clean_image_url") or existing.get("thumbnail_data_url")):
                ex_img = existing.get("clean_image_url") or existing.get("thumbnail_data_url")
                ex_phash = average_hash(ex_img)
                ex_sha = compute_sha256(ex_img)
                
            if is_duplicate_match(incoming_sha, ex_sha, incoming_phash, ex_phash):
                return {
                    "id": existing.get("id"),
                    "title": existing.get("title") or existing.get("name") or "Untitled garment",
                    "name": existing.get("name"),
                    "item_type": existing.get("item_type"),
                    "sub_category": existing.get("sub_category"),
                    "brand": existing.get("brand"),
                    "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url"),
                    "match_reason": "visual_hash",
                }

    # 2. Normalized Multilingual Metadata Check
    incoming_cat = _canonical_category(analysis.get("category") or analysis.get("sub_category") or analysis.get("item_type"))
    incoming_sub = _canonical_category(analysis.get("sub_category") or analysis.get("item_type"))
    incoming_color = _canonical_color(_dominant_color(analysis))
    brand = _norm(analysis.get("brand"))
    
    if incoming_cat and incoming_color:
        for existing in existing_items:
            ex_cat = _canonical_category(existing.get("category") or existing.get("sub_category") or existing.get("item_type"))
            ex_sub = _canonical_category(existing.get("sub_category") or existing.get("item_type"))
            ex_color = _canonical_color(_dominant_color(existing))
            
            if (incoming_cat == ex_cat or incoming_sub == ex_sub) and (incoming_color == ex_color):
                existing_brand = _norm(existing.get("brand"))
                if brand and existing_brand and brand != existing_brand:
                    continue
                return {
                    "id": existing.get("id"),
                    "title": existing.get("title") or existing.get("name") or "Untitled garment",
                    "name": existing.get("name"),
                    "item_type": existing.get("item_type"),
                    "sub_category": existing.get("sub_category"),
                    "brand": existing.get("brand"),
                    "thumbnail_data_url": existing.get("thumbnail_data_url") or existing.get("clean_image_url"),
                    "match_reason": "metadata_match",
                }
                
    return None

