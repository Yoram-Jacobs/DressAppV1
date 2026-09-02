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
        return items[0]
    return parsed if isinstance(parsed, dict) else {}


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
    """Coerce ``parsed['season']`` to a validated list (may be empty)."""
    allowed = {"spring", "summer", "fall", "autumn", "winter", "all"}
    raw = parsed.get("season") or []
    if isinstance(raw, str):
        raw = [raw]
    seasons: list[str] = []
    for entry in raw:
        tok = _norm_str(entry)
        if tok == "autumn":
            tok = "fall"
        if tok in allowed:
            seasons.append(tok)
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

    * Unknown / empty values are dropped rather than kept, so Pydantic's
      optional-enum fields stay valid (None instead of an unknown literal).
    * ``state`` is the main hazard: the model sometimes echoes the
      ``condition`` value there. We default to ``used``; the user can
      flip to ``new`` in the form.
    """
    _coerce_enum_field(
        parsed, "gender", _VALID_GENDER, aliases=_GENDER_ALIASES,
    )
    parsed["dress_code"] = (
        _normalise_dress_code(parsed.get("dress_code"))
        if _normalise_dress_code(parsed.get("dress_code")) in _VALID_DRESS_CODE
        else None
    )
    _coerce_enum_field(
        parsed, "condition", _VALID_CONDITION, aliases=_CONDITION_ALIASES,
    )
    # ``state`` has a sensible default unlike the other enums — the form
    # can round-trip "used" without surprising the user.
    s = _norm_str(parsed.get("state"))
    parsed["state"] = s if s in _VALID_STATE else "used"
    _coerce_enum_field(
        parsed, "quality", _VALID_QUALITY, aliases=_QUALITY_ALIASES,
    )
    _coerce_enum_field(
        parsed, "pattern", _VALID_PATTERN, aliases=_PATTERN_ALIASES,
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
    # SegFormer's "dress" is a full-body garment.
    "dress": {"full body", "dress"},
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
    "dress": "Full Body (dress / jumpsuit)",
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
    # If the previous sub_category is incompatible, default to a sensible type for the category
    if kind == "headwear":
        analysis["sub_category"] = "Hat"
    elif kind == "footwear":
        analysis["sub_category"] = "Shoes"
    elif kind == "bottom":
        analysis["sub_category"] = "Pants"
    else:
        analysis["sub_category"] = None
    analysis["_category_overridden_by"] = "segformer"
    return analysis


_SEGFORMER_KIND_TO_ALLOWED_CATEGORIES: dict[str, set[str]] = {
    # SegFormer's "top" covers everything upper-body — shirts, tees,
    # blouses, sweaters, jackets, coats. We let Gemini decide between
    # Top and Outerwear because it has the vocabulary to distinguish
    # a t-shirt from a parka, and either is a legitimate match for
    # the SegFormer kind.
    "top": {"top", "outerwear"},
    # SegFormer's "bottom" covers pants / skirts / shorts — unambiguous.
    "bottom": {"bottom"},
    # SegFormer's "dress" is a full-body garment.
    "dress": {"full body", "dress"},
    "footwear": {"footwear"},
    "accessory": {"accessories", "accessory"},
    "headwear": {"accessories", "accessory"},
}


_SEGFORMER_KIND_TO_DEFAULT_CATEGORY: dict[str, str] = {
    "top": "Top",
    "bottom": "Bottom",
    "dress": "Full Body",
    "footwear": "Footwear",
    "accessory": "Accessories",
    "headwear": "Accessories",
}
