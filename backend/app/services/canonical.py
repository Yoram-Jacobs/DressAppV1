"""Canonical data normalizers for categories and body measurements."""
from __future__ import annotations

from typing import Any

_CANONICAL_CATEGORY_BY_SLOT: dict[str, str] = {
    "top": "Top",
    "bottom": "Bottom",
    "outerwear": "Outerwear",
    "dress": "Full Body",
    "shoes": "Footwear",
    "accessory": "Accessories",
    "underwear": "Underwear",
}


def canonicalize_category(raw: Any, default: str | None = None) -> str | None:
    """Normalize any category string or Hebrew/Arabic/English alias into DressApp's canonical Title Case taxonomy."""
    if raw is None:
        return default
    text = str(raw).strip()
    if not text:
        return default

    low = text.lower().replace("-", "_").replace(" ", "_")
    if low in ("underwear", "bra", "bras", "bralette", "lingerie", "boxer", "boxers", "הלבשה_תחתונה", "חזייה", "חזיה"):
        return "Underwear"
    if low in ("accessories", "accessory", "bag", "bags", "hat", "hats", "headwear", "belt", "belts", "scarf", "sunglasses", "jewelry", "watch", "אקססוריז", "אביזרים", "תיק", "תיקים", "כובע", "חגורה"):
        return "Accessories"
    if low in ("full_body", "fullbody", "one_piece", "dress", "dresses", "jumpsuit", "jumpsuits", "suit", "suits", "overall", "overalls", "dungaree", "dungarees", "romper", "gown", "שמלה", "שמלות", "גוף_מלא", "אוברול"):
        return "Full Body"
    if low in ("footwear", "shoes", "shoe", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals", "heel", "heels", "loafer", "loafers", "flats", "slippers", "slides", "נעליים", "נעל", "מגפיים", "סנדלים"):
        return "Footwear"

    from app.services.stylist_scheduler_brain import norm_category

    slot = norm_category(text)
    if slot == "accessory" and low not in ("accessory", "accessories"):
        # Preserve unknown custom labels only if not matched by English/Hebrew defaults;
        # wait - norm_category returns "accessory" for anything else, so return "Accessories"
        # for standard accessory tokens and Title Case otherwise when unambiguous.
        return "Accessories"
    return _CANONICAL_CATEGORY_BY_SLOT.get(slot, text.title())


_MEASUREMENT_ALIASES: dict[str, str] = {
    "height_cm": "height",
    "weight_kg": "weight",
    "chest_cm": "chest",
    "bust_cm": "chest",
    "bust": "chest",
    "waist_cm": "waist",
    "hips": "hip",
    "hips_cm": "hip",
    "hip_cm": "hip",
    "shoulders_cm": "shoulders",
    "shoulder_cm": "shoulders",
    "sleeve_cm": "sleeve",
    "arm_length_cm": "sleeve",
    "inseam_cm": "inseam",
    "outseam_cm": "outseam",
    "foot_length_cm": "foot_length",
}


def canonicalize_measurements(meas: dict[str, Any] | None) -> dict[str, Any] | None:
    """Fold legacy `*_cm` / `hips` / `bust` measurement keys into canonical field names."""
    if not isinstance(meas, dict):
        return meas
    cleaned: dict[str, Any] = {}
    for k, v in meas.items():
        if k in _MEASUREMENT_ALIASES:
            canon_k = _MEASUREMENT_ALIASES[k]
            if canon_k not in meas or meas.get(canon_k) in (None, ""):
                cleaned.setdefault(canon_k, v)
        else:
            cleaned[k] = v
    return cleaned
