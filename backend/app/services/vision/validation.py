from __future__ import annotations
import logging
logger = logging.getLogger(__name__)

from typing import Any



def _coerce_single_garment(
    parsed: dict[str, Any] | list[dict[str, Any]],
) -> dict[str, Any]:
    """Collapse a list-of-garments response into the single-item contract.

    Eyes v3 (Gemma 4) sometimes returns ``[{...}, {...}]`` when a crop
    accidentally bundles two garments, or in the already-cropped fast
    path. ``analyze()`` is contractually single-garment, so we pick the
    first entry (model orders by prominence) and log so we can monitor
    how often this happens.
    """
    if isinstance(parsed, list):
        items = [x for x in parsed if isinstance(x, dict)]
        if not items:
            return {}
        if len(items) > 1:
            logger.info(
                "Eyes returned %d garments in one call; using the first "
                "(consider tightening crop or upgrading to multi-item path)",
                len(items),
            )
        res = items[0]
    elif isinstance(parsed, dict):
        res = parsed
    else:
        return {}

    cat_lower = (res.get("category") or "").strip().lower()
    sub_lower = (res.get("sub_category") or "").strip().lower()
    full_text = f"{res.get('item_type', '')} {res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}".lower()

    # Subcategory collision prevention: NEVER allow sub_category to be identical to category or generic "Top"/"Tops"/"Bottom"/"Bottoms"
    if sub_lower in {"top", "tops", "bottom", "bottoms", "outerwear", "full body", "footwear", "accessories", "clothing", "garment", ""} or sub_lower == cat_lower:
        if cat_lower == "top":
            if any(w in full_text for w in ("blouse", "בלוזה", "cap-sleeve", "cap sleeve", "flutter")):
                res["sub_category"] = "Blouse"
            elif any(w in full_text for w in ("tee", "t-shirt", "tshirt", "טי")):
                res["sub_category"] = "T-Shirt"
            elif any(w in full_text for w in ("sweater", "cardigan", "knit", "סריג", "סוודר")):
                res["sub_category"] = "Sweater"
            elif any(w in full_text for w in ("tank", "camisole", "גופיי")):
                res["sub_category"] = "Tank Top"
            elif any(w in full_text for w in ("hoodie", "sweatshirt", "קפוצ")):
                res["sub_category"] = "Hoodie"
            else:
                res["sub_category"] = "Blouse" if res.get("gender") == "women" else "Shirt"
        elif cat_lower == "bottom":
            if any(w in full_text for w in ("jean", "denim", "גינס")):
                res["sub_category"] = "Jeans"
            elif any(w in full_text for w in ("short", "שורט", "קצר")):
                res["sub_category"] = "Shorts"
            elif any(w in full_text for w in ("skirt", "חצאית")):
                res["sub_category"] = "Skirt"
            elif any(w in full_text for w in ("legging", "טייץ")):
                res["sub_category"] = "Leggings"
            else:
                res["sub_category"] = "Pants"
        elif cat_lower == "outerwear":
            res["sub_category"] = "Coats" if any(w in full_text for w in ("coat", "מעיל", "parka")) else "Jackets"
        elif cat_lower in ("full body", "dress"):
            res["sub_category"] = "Dresses"
        elif cat_lower == "footwear":
            res["sub_category"] = "Sneakers"
        sub_lower = (res["sub_category"] or "").strip().lower()

    # Guarantee item_type is never blank or equal to category
    itype_lower = (res.get("item_type") or "").strip().lower()
    if not res.get("item_type") or itype_lower in {"top", "tops", "bottom", "bottoms", "outerwear", "full body", "footwear", "accessories", "clothing", "garment", ""} or itype_lower == cat_lower:
        res["item_type"] = res.get("sub_category") or "Shirt"
        itype_lower = (res["item_type"] or "").strip().lower()

    # Guarantee item_type and sub_category are distinct and specific
    if itype_lower == sub_lower:
        full_text_itype = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}".lower()
        is_summer = any(s in res.get("season", []) for s in ("summer", "spring")) or any(w in full_text_itype for w in ("short", "cap", "summer", "קצר", "קיץ"))
        if any(w in sub_lower for w in ("t-shirt", "t_shirt", "tshirt", "tee", "טי")):
            if is_summer or any(w in full_text_itype for w in ("cap", "flutter", "short")):
                res["item_type"] = "Short-Sleeve T-Shirt"
            elif any(w in full_text_itype for w in ("long", "ארוך")):
                res["item_type"] = "Long-Sleeve T-Shirt"
            else:
                res["item_type"] = "Short-Sleeve T-Shirt"
        elif any(w in sub_lower for w in ("shirt", "מכופתרת")):
            res["item_type"] = "Short-Sleeve Shirt" if is_summer else "Button-Down Shirt"
        elif any(w in sub_lower for w in ("blouse", "בלוזה")):
            res["item_type"] = "Cap-Sleeve Blouse" if is_summer else "Casual Blouse"
        elif any(w in sub_lower for w in ("jeans", "ג'ינס", "גינס")):
            res["item_type"] = "Straight Jeans"
        elif any(w in sub_lower for w in ("pants", "trousers", "מכנסי")):
            res["item_type"] = "Tailored Trousers"
        elif any(w in sub_lower for w in ("coat", "מעיל")):
            res["item_type"] = "Tailored Coat"
        elif any(w in sub_lower for w in ("jacket", "ג'קט")):
            res["item_type"] = "Casual Jacket"
        elif any(w in sub_lower for w in ("sweater", "סוודר", "סריג")):
            res["item_type"] = "Crew-Neck Sweater"
        elif any(w in sub_lower for w in ("skirt", "חצאית")):
            res["item_type"] = "A-Line Skirt"
        elif any(w in sub_lower for w in ("dress", "שמלה")):
            res["item_type"] = "Midi Dress"
        else:
            res["item_type"] = f"Short-Sleeve {res['sub_category']}" if is_summer else f"Classic {res['sub_category']}"
        itype_lower = (res["item_type"] or "").strip().lower()

    # Footwear pluralization
    if cat_lower == "footwear" or sub_lower in {"boot", "shoe", "sneaker", "heel", "loafer", "sandal", "pump"}:
        plural_map = {
            "boot": "Boots",
            "shoe": "Shoes",
            "sneaker": "Sneakers",
            "heel": "Heels",
            "loafer": "Loafers",
            "sandal": "Sandals",
            "pump": "Pumps",
            "ankle boot": "Ankle Boots",
            "knee-high boot": "Knee-High Boots",
            "leather boot": "Leather Boots",
        }
        if sub_lower in plural_map:
            res["sub_category"] = plural_map[sub_lower]
        elif res.get("sub_category") and not res["sub_category"].endswith("s"):
            res["sub_category"] = res["sub_category"] + "s"

        if itype_lower in plural_map:
            res["item_type"] = plural_map[itype_lower]
        elif res.get("item_type") and not res["item_type"].endswith("s"):
            res["item_type"] = res["item_type"] + "s"

    # Gender inference fallback (don't leave women's pieces as unisex)
    g_val = (res.get("gender") or "").strip().lower()
    if g_val in {"unisex", "", None}:
        fem_cues = {
            "dress", "skirt", "blouse", "heels", "pumps", "knee-high boots",
            "shoulder bag", "handbag", "tote bag", "clutch", "cap sleeve",
            "cap-sleeve", "flutter sleeve", "peplum", "sweetheart", "ruffle",
            "scoop neck", "boat neck", "curved hem", "fitted", "light blue",
            "baby blue", "pastel", "תכלת", "עדינה", "נשים",
            "בלוזה", "שמלה", "חצאית", "גופיית", "עקבים"
        }
        full_text_fem = f"{sub_lower} {itype_lower} {res.get('name', '')} {res.get('title', '')} {res.get('caption', '')}".lower()
        size_upper = str(res.get("size") or "").strip().upper()
        is_fem_size = size_upper in {"XS", "S", "XXS", "34", "36", "38"}
        is_fem_top = cat_lower == "top" and (is_fem_size or any(c in full_text_fem for c in ("cap", "flutter", "scoop", "light blue", "תכלת", "עדינ", "קצרצר")))
        if cat_lower in {"full body", "dress"} or is_fem_top or any(c in full_text_fem for c in fem_cues):
            res["gender"] = "women"

    # Color refinement: upgrade generic "blue" / "כחול" to specific fine-grained shade if hinted
    full_color_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {' '.join(res.get('tags') or [])}".lower()
    is_he = any("\u0590" <= ch <= "\u05ea" for ch in full_color_text)

    # Refine string color if present
    c_str = str(res.get("color") or "").strip().lower()
    if c_str in {"blue", "כחול"}:
        if any(w in full_color_text for w in ("light blue", "sky blue", "baby blue", "cyan", "turquoise", "תכלת", "כחול בהיר", "שמיים")):
            res["color"] = "תכלת" if is_he else "Light Blue"
    elif c_str in {"green", "ירוק"}:
        if any(w in full_color_text for w in ("olive", "זית")):
            res["color"] = "ירוק זית" if is_he else "Olive Green"
        elif any(w in full_color_text for w in ("mint", "sage", "מנטה")):
            res["color"] = "מנטה" if is_he else "Mint Green"

    colors = res.get("colors")
    if isinstance(colors, list) and colors:
        for c in colors:
            if isinstance(c, dict):
                c_name = str(c.get("name", "")).strip().lower()
                if c_name in {"blue", "כחול"}:
                    if any(w in full_color_text for w in ("light blue", "sky blue", "baby blue", "cyan", "turquoise", "תכלת", "כחול בהיר", "שמיים")):
                        c["name"] = "תכלת" if is_he else "Light Blue"
                        c["hex"] = "#7dd3fc"
                elif c_name in {"green", "ירוק"}:
                    if any(w in full_color_text for w in ("olive", "זית")):
                        c["name"] = "ירוק זית" if is_he else "Olive Green"
                        c["hex"] = "#808000"
                    elif any(w in full_color_text for w in ("mint", "sage", "מנטה")):
                        c["name"] = "מנטה" if is_he else "Mint Green"
                        c["hex"] = "#6ee7b7"

    # Unique name guarantee: ensure name is not just the subcategory name
    name_str = (res.get("name") or "").strip()
    sub_str = (res.get("sub_category") or "").strip()
    if not name_str or name_str.lower() == sub_str.lower() or len(name_str.split()) < 2:
        color_name = ""
        colors = res.get("colors")
        if isinstance(colors, list) and colors and isinstance(colors[0], dict):
            color_name = colors[0].get("name", "")
        elif res.get("color"):
            color_name = str(res.get("color"))
        mat_name = ""
        mats = res.get("fabric_materials")
        if isinstance(mats, list) and mats and isinstance(mats[0], dict):
            m_val = mats[0].get("name", "")
            if m_val.lower() not in {"unknown", "n/a", "other", "none"}:
                mat_name = m_val
        itype = res.get("item_type") or sub_str or "Garment"
        parts = [p for p in [color_name, mat_name, itype] if p]
        if len(parts) >= 2:
            res["name"] = " ".join(parts).title()
            if not res.get("title") or res.get("title").lower() == sub_str.lower():
                res["title"] = res["name"]

    # Materials fallback: ensure never "Unknown"
    mats = res.get("fabric_materials")
    if not mats or (isinstance(mats, list) and all(str(m.get("name", "")).lower() in {"unknown", "n/a", "other", "none", ""} for m in mats if isinstance(m, dict))):
        if cat_lower == "footwear" or "boot" in sub_lower or "belt" in sub_lower or "bag" in sub_lower:
            res["fabric_materials"] = [{"name": "Leather", "pct": 100}]
        elif "jean" in sub_lower or "denim" in sub_lower:
            res["fabric_materials"] = [{"name": "Denim", "pct": 100}]
        elif "coat" in sub_lower or "jacket" in sub_lower or cat_lower == "outerwear":
            res["fabric_materials"] = [{"name": "Wool", "pct": 70}, {"name": "Polyester", "pct": 30}]
        else:
            res["fabric_materials"] = [{"name": "Cotton", "pct": 70}, {"name": "Polyester", "pct": 30}]

    # Coat vs Dress auto-correction: long tailored outerwear with lapels/buttons is Outerwear, not Dress
    coat_keywords = ("coat", "trench", "duster", "jacket", "overcoat", "parka", "blazer", "double-breasted")
    name_and_type = f"{res.get('name', '')} {res.get('item_type', '')} {res.get('caption', '')}".lower()
    if cat_lower in {"full body", "dress"} or sub_lower in {"dress", "dresses"}:
        if any(w in name_and_type for w in coat_keywords):
            res["category"] = "Outerwear"
            cat_lower = "outerwear"
            if sub_lower in {"dress", "dresses"}:
                res["sub_category"] = "Coats"
                sub_lower = "coats"
            if res.get("item_type", "").lower() in {"dress", "dresses", "coat dress", "midi dress"}:
                res["item_type"] = "Double-Breasted Coat" if "double-breasted" in name_and_type else "Tailored Long Coat"
            if "dress" in res.get("name", "").lower():
                import re as _re
                res["name"] = _re.sub(r"(?i)\bdress\b", "Coat", res["name"]).strip()
            if "dress" in res.get("title", "").lower():
                import re as _re
                res["title"] = _re.sub(r"(?i)\bdress\b", "Coat", res["title"]).strip()

    # Caption guarantee: ensure caption is never empty or blank
    cap = (res.get("caption") or "").strip()
    if not cap:
        name_val = res.get("name") or res.get("title") or "garment"
        itype = (res.get("item_type") or res.get("sub_category") or "piece").lower()
        if "coat" in itype or cat_lower == "outerwear":
            res["caption"] = f"A tailored {name_val.lower()} crafted with structured silhouette and refined button detailing."
        elif cat_lower == "footwear" or "boot" in itype:
            res["caption"] = f"Classic {name_val.lower()} featuring sleek styling and premium construction."
        elif "bag" in itype or "belt" in itype or cat_lower == "accessories":
            res["caption"] = f"An elegant {name_val.lower()} that adds functional sophistication to any ensemble."
        else:
            res["caption"] = f"A versatile {name_val.lower()} designed with thoughtful proportions and clean detailing."

    # Pattern fallback: if model returned solid/empty, check text for subtle geometric, striped, or floral patterns
    pat_str = (res.get("pattern") or "").strip().lower()
    if not pat_str or pat_str == "solid":
        full_pat_text = f"{res.get('name', '')} {res.get('title', '')} {res.get('caption', '')} {' '.join(res.get('tags') or [])}".lower()
        if any(w in full_pat_text for w in ("geometric", "geometry", "texture", "textured", "weave", "waffle", "jacquard", "pique", "dot", "dots", "polka", "eyelet", "perforated", "mesh", "ribbed", "subtle", "גיאומטרי", "מרקם", "טקסטורה", "נקודות", "עיגולים", "מחורר", "דוגמה")):
            res["pattern"] = "geometric"
        elif any(w in full_pat_text for w in ("stripe", "striped", "פסים")):
            res["pattern"] = "striped"
        elif any(w in full_pat_text for w in ("plaid", "check", "checker", "משובץ")):
            res["pattern"] = "plaid"
        elif any(w in full_pat_text for w in ("floral", "flower", "פרח")):
            res["pattern"] = "floral"


    # Price estimation guarantee: provide realistic fallback if omitted or 0
    p = res.get("price_cents")
    if p is None or p <= 0:
        base_prices = {
            "top": 2500,
            "bottom": 4500,
            "outerwear": 9500,
            "full body": 6500,
            "footwear": 6000,
            "accessories": 2500,
            "underwear": 1500,
        }
        mult = {"budget": 0.6, "mid": 1.0, "premium": 2.2, "luxury": 5.0}.get(res.get("quality"), 1.0)
        res["price_cents"] = int(base_prices.get(cat_lower, 3000) * mult)

    return res


# -------------------- enum sanitisers --------------------
# The Flash tier of Gemini occasionally confuses ``state`` (new/used) with
# ``condition`` (bad/fair/good/excellent) or returns values in slightly
# different casing (e.g. "Smart Casual" vs "smart-casual"). Rather than
# reject those responses with a 422 at save time, we coerce them to the
# nearest valid enum value so the auto-fill stays useful and the user
# can still edit freely.
_VALID_STATE = {"new", "used"}
_VALID_CONDITION = {"bad", "fair", "good", "excellent"}
_VALID_QUALITY = {"budget", "mid", "premium", "luxury"}
_VALID_GENDER = {"men", "women", "unisex", "kids"}
_VALID_DRESS_CODE = {
    "casual", "smart-casual", "business", "formal", "athletic", "loungewear",
}
_VALID_PATTERN = {
    "solid", "striped", "plaid", "floral", "herringbone",
    "polka", "polka-dot", "polka_dot", "paisley", "geometric",
    "animal_print", "animal-print", "graphic", "tie_dye", "tie-dye", "abstract",
}
_PATTERN_ALIASES = {
    "polka-dot": "polka_dot",
    "polka": "polka_dot",
    "animal-print": "animal_print",
    "tie-dye": "tie_dye",
    "print": "graphic",
    "graphic-print": "graphic",
    "text": "graphic",
    "slogan": "graphic",
    "lettering": "graphic",
    "logo": "graphic",
}


def _norm_str(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    return v.strip().lower().replace("_", "-")


def _coerce_enum_field(
    parsed: dict[str, Any],
    key: str,
    valid: set[str],
    *,
    aliases: dict[str, str] | None = None,
    default: str | None = None,
) -> None:
    """Normalise ``parsed[key]`` to a value in ``valid`` (or ``None``).

    Steps: strip → lower via ``_norm_str`` → remap via ``aliases`` →
    accept only if in ``valid``. When the coerced value is invalid the
    field is set to ``default`` (typically ``None``) so Pydantic's
    optional-enum validators stay happy.
    """
    value = _norm_str(parsed.get(key))
    if value and aliases:
        value = aliases.get(value, value)
    parsed[key] = value if value in valid else default


def _coerce_seasons(parsed: dict[str, Any]) -> None:
    """Coerce ``parsed['season']`` to a validated list. Incurs a context-aware default if empty."""
    allowed = {"spring", "summer", "fall", "autumn", "winter", "all"}
    raw = parsed.get("season") or []
    if isinstance(raw, str):
        raw = [raw]
    seasons: list[str] = []
    for entry in raw:
        tok = _norm_str(entry)
        if tok == "autumn":
            tok = "fall"
        if tok in allowed and tok not in seasons:
            seasons.append(tok)

    cat_lower = (parsed.get("category") or "").strip().lower()
    sub_lower = (parsed.get("sub_category") or "").strip().lower()
    itype = (parsed.get("item_type") or "").strip().lower()
    txt = f"{cat_lower} {sub_lower} {itype} {parsed.get('name', '')} {parsed.get('title', '')} {parsed.get('caption', '')}".lower()

    # Short-sleeve, cap-sleeve, or lightweight tops must be summer wear, NEVER "all"
    if not seasons or seasons == ["all"]:
        if any(w in txt for w in ("short sleeve", "short-sleeve", "cap sleeve", "cap-sleeve", "sleeveless", "tank", "swim", "sandal", "linen", "shorts", "sundress", "blouse", "בלוזה", "קיץ", "קצר")):
            seasons = ["summer"]
        elif any(w in txt for w in ("coat", "jacket", "outerwear", "boot", "wool", "sweater", "cardigan", "scarf", "parka", "overcoat", "puffer", "down", "fleece", "חורף", "מעיל", "סוודר")):
            seasons = ["fall", "winter"]
        elif not seasons:
            seasons = ["all"]

    parsed["season"] = seasons


# Alias tables for the model's common off-spec echoes. Keeping these at
# module scope lets us unit-test them directly without instantiating the
# vision service.
_GENDER_ALIASES = {
    "male": "men", "female": "women", "uni": "unisex", "kid": "kids",
}
_CONDITION_ALIASES = {"poor": "bad", "very-good": "excellent"}
_QUALITY_ALIASES = {
    "cheap": "budget", "entry": "budget", "basic": "budget",
    "mid-range": "mid", "standard": "mid",
    "high": "premium", "high-end": "premium",
}


def _normalise_dress_code(raw: str | None) -> str | None:
    """Return the dress-code token after space→hyphen + common renames."""
    value = _norm_str(raw)
    if not value:
        return None
    value = value.replace(" ", "-")
    if value == "athleisure":
        value = "athletic"
    if value == "lounge":
        value = "loungewear"
    return value


def _coerce_enums(parsed: dict[str, Any]) -> dict[str, Any]:
    """Best-effort coercion of AI-returned enum values.

    * Unknown / empty values are defaulted to sensible fallbacks rather than
      dropped, so the user never sees empty dashes ("—").
    * ``state`` defaults to ``used``; the user can flip to ``new`` in the form.
    """
    _coerce_enum_field(
        parsed, "gender", _VALID_GENDER, aliases=_GENDER_ALIASES,
    )
    parsed["dress_code"] = (
        _normalise_dress_code(parsed.get("dress_code"))
        if _normalise_dress_code(parsed.get("dress_code")) in _VALID_DRESS_CODE
        else "casual"
    )
    _coerce_enum_field(
        parsed, "condition", _VALID_CONDITION, aliases=_CONDITION_ALIASES, default="good"
    )
    s = _norm_str(parsed.get("state"))
    parsed["state"] = s if s in _VALID_STATE else "used"
    _coerce_enum_field(
        parsed, "quality", _VALID_QUALITY, aliases=_QUALITY_ALIASES, default="mid"
    )
    _coerce_enum_field(
        parsed, "pattern", _VALID_PATTERN, aliases=_PATTERN_ALIASES, default="solid"
    )
    _coerce_seasons(parsed)
    return parsed


# ---------------------------------------------------------------------------
# Patch M21 (May 2026) — SegFormer-anchored category enforcement.
# ---------------------------------------------------------------------------
# SegFormer (``clothing_parser.parse_garments``) returns a per-pixel
# garment classification that we use to crop the source photo into
# per-garment images. The internal category it assigns (top, bottom,
# dress, footwear, accessory, headwear) is HIGHLY reliable on the
# pixels it claims — it's trained on the ATR clothes-parsing dataset
# and rarely confuses pant-leg pixels for a coat sleeve at the mask
# level.
#
# Gemini, on the other hand, is a free-form vision LLM that classifies
# the WHOLE CROP. When a bbox is loose and a sliver of an adjacent
# garment leaks in (e.g. coat tails over pants), Gemini can be lured
# into mis-labeling. Real example from the May 2026 closet test:
# pants crop with charcoal coat tails leaking into the top edge →
# Gemini returned ``{"category": "Outerwear", "sub_category":
# "Overcoat"}`` → user saw a "Charcoal Overcoat" card in their closet
# that was actually pants.
#
# Fix: anchor Gemini's ``category`` to the SegFormer ``kind``. For
# unambiguous SegFormer kinds (bottom, dress, footwear, accessory,
# headwear) we REJECT any Gemini category outside the compatible set
# and overwrite it. For ambiguous kinds (``top`` — could legitimately
# be Top or Outerwear) we leave Gemini's classification alone so it
# can still distinguish a t-shirt from a parka.
#
# Two-layer defence:
#   1. PROMPT HINT — every batched Gemini call now embeds the per-
#      crop SegFormer kind in the system prompt so the model has the
#      hint up-front. Cheaper than overriding; usually enough.
#   2. POST-VALIDATION — applied after _coerce_enums on every analysis
#      coming back from Gemini, regardless of which path produced it.
#      Catches the cases where Gemini ignored the hint.

# Internal SegFormer kind → set of acceptable Gemini ``category`` values
# (case-insensitive match). Any Gemini answer OUTSIDE this set is
# treated as an error and overridden.
_SEGFORMER_KIND_TO_ALLOWED_CATEGORIES: dict[str, set[str]] = {
    # SegFormer's "top" covers everything upper-body — shirts, tees,
    # blouses, sweaters, jackets, coats. We let Gemini decide between
    # Top and Outerwear because it has the vocabulary to distinguish
    # a t-shirt from a parka, and either is a legitimate match for
    # the SegFormer kind.
    "top": {"top", "outerwear"},
    # SegFormer's "bottom" covers pants / skirts / shorts — unambiguous.
    "bottom": {"bottom"},
    # SegFormer's "dress" ATR dataset class has no outerwear/coat class, so long
    # coats/trench/dusters are also segmented as dress. We allow Outerwear and Full Body.
    "dress": {"full body", "dress", "outerwear"},
    "footwear": {"footwear"},
    "accessory": {"accessories", "accessory"},
    "headwear": {"accessories", "accessory"},
}

# When we have to overwrite a bad Gemini answer, what should the
# canonical ``category`` value be? Same rule as a human reading the
# SegFormer kind: if SegFormer said "bottom", set category="Bottom".
_SEGFORMER_KIND_TO_DEFAULT_CATEGORY: dict[str, str] = {
    "top": "Top",
    "bottom": "Bottom",
    "dress": "Full Body",
    "footwear": "Footwear",
    "accessory": "Accessories",
    "headwear": "Accessories",
}

# Human-readable label injected into the Gemini system prompt as a
# hint. Phrased as the *category the user would expect on the closet
# card*, not the raw SegFormer label, so Gemini interprets it in the
# same vocabulary as its ``category`` field.
_SEGFORMER_KIND_HUMAN_LABEL: dict[str, str] = {
    "top": "Top or Outerwear (upper-body garment)",
    "bottom": "Bottom (pants / skirt / shorts)",
    "dress": "Outerwear (coat / trench / jacket) or Full Body (dress / jumpsuit)",
    "footwear": "Footwear (shoes / boots / sneakers)",
    "accessory": "Accessories (belt / scarf / sunglasses / bag)",
    "headwear": "Accessories (hat / cap / beanie)",
}


def _enforce_segformer_category(
    analysis: dict[str, Any] | None,
    *,
    segformer_kind: str | None,
    label: str | None = None,
    is_single_item: bool = False,
) -> dict[str, Any] | None:
    """Anchor Gemini's category classification to the SegFormer kind.

    Mutates and returns ``analysis``. If SegFormer's kind is in the
    enforcement table AND Gemini's category is outside the allowed
    set, we:

    * Overwrite ``analysis["category"]`` with the table default.
    * Clear ``analysis["sub_category"]`` so a stale value like
      "Overcoat" doesn't survive on a now-"Bottom" item — the user
      can re-name in /closet if needed; better an empty sub_category
      than a wrong one.
    * Stamp ``analysis["_category_overridden_by"] = "segformer"`` for
      triage / observability.
    * Log a WARNING with before/after.

    For ambiguous kinds (``top``) we leave Gemini alone — both Top
    and Outerwear are legitimate matches for a SegFormer "top" mask.

    Idempotent: calling on an already-correct or already-overridden
    analysis is a no-op.
    """
    if not isinstance(analysis, dict):
        return analysis
    if is_single_item:
        return analysis
    if not segformer_kind:
        return analysis
    kind = segformer_kind.strip().lower()
    allowed = _SEGFORMER_KIND_TO_ALLOWED_CATEGORIES.get(kind)
    if not allowed:
        # Unknown SegFormer kind (e.g. "garment" from the Gemini-only
        # detection fallback) — no anchor available, bail out.
        return analysis
    current = (analysis.get("category") or "").strip()
    if not current:
        # Gemini didn't assign one — fill in from SegFormer rather
        # than leaving a blank category that would default to "Top"
        # in the frontend.
        default = _SEGFORMER_KIND_TO_DEFAULT_CATEGORY.get(kind)
        if default:
            analysis["category"] = default
            analysis["_category_overridden_by"] = "segformer-fill"
        return analysis
    if current.lower() in allowed:
        # Gemini's classification is compatible with SegFormer.
        return analysis
    # Flat lay tops and t-shirts are frequently misclassified by SegFormer as 'dress'.
    # If Gemini classified it as a Top or Outerwear, preserve Gemini's rich classification.
    if current.lower() in ("top", "tops", "outerwear") and kind == "dress":
        logger.info(
            "garment_vision: Preserving Gemini %r (%r) over SegFormer 'dress' label",
            current,
            analysis.get("sub_category"),
        )
        return analysis
    # Override.
    default = _SEGFORMER_KIND_TO_DEFAULT_CATEGORY.get(kind, current)
    old_subcategory = analysis.get("sub_category")
    logger.warning(
        "garment_vision: SegFormer-anchored category override "
        "label=%r kind=%r gemini_category=%r gemini_subcategory=%r "
        "-> category=%r (sub_category cleared)",
        label, kind, current, old_subcategory, default,
    )
    analysis["category"] = default
    # Wipe sub_category — if Gemini said "Overcoat" but the SegFormer
    # mask is unambiguously a bottom, an "Overcoat" sub_category makes
    # no sense and would mis-render in the closet card.
    analysis["sub_category"] = None
    analysis["_category_overridden_by"] = "segformer"
    return analysis

