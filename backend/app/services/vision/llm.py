from __future__ import annotations
import logging
logger = logging.getLogger(__name__)

import json
import re
from typing import Any
from app.config import settings
from .validation import _coerce_single_garment, _coerce_enums



async def _call_gemma_space(
    *,
    system_prompt: str,
    user_text: str,
    image_b64_jpeg: str | None = None,
    max_tokens: int = 512,
    temperature: float = 0.1,
    timeout: float | None = None,
    json_schema: dict[str, Any] | None = None,
    think: bool = False,
    id_slot: int | None = None,
) -> str:
    """Phase O.3 — call the self-hosted Gemma-4 E2B/E4B HF Space.

    The Space exposes a FastAPI ``/predict`` endpoint that wraps
    llama-cpp-python / llama-server. Supports both multimodal vision
    and pure text completions (outfit stylist, recommendations).
    """
    space_url = (settings.EYES_GEMMA_SPACE_URL or "").rstrip("/")
    if not space_url:
        raise RuntimeError("EYES_GEMMA_SPACE_URL not configured.")

    # Build OpenAI-compatible messages with multimodal format
    messages = []
    
    # System message
    messages.append({"role": "system", "content": system_prompt})
    
    # User message with optional image and text
    user_content = []
    if image_b64_jpeg:
        user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64_jpeg}"}})
    user_content.append({"type": "text", "text": user_text})
    messages.append({"role": "user", "content": user_content})
    
    # Build the payload in OpenAI-compatible format for the eyes proxy
    payload: dict[str, Any] = {
        "messages": messages,
        "max_tokens": min(int(max_tokens), 4096),
        "temperature": float(temperature),
        "json_mode": True,
        "repeat_penalty": 1.1,
        "enable_thinking": bool(think),
        "think": bool(think),
        "reasoning_budget": 0 if not think else 500,
        "chat_template_kwargs": {"enable_thinking": bool(think)},
        "reasoning_format": "none" if not think else "deepseek",
    }
    if id_slot is not None:
        payload["id_slot"] = id_slot
    if json_schema is not None:
        # The dressapp-eyes proxy should forward this to llama-server's
        # OpenAI-compatible response_format. Unknown to older proxies
        # → ignored harmlessly.
        payload["json_schema"] = json_schema
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": "eyes_garment_response",
                "strict": True,
                "schema": json_schema,
            },
        }
    headers: dict[str, str] = {"Content-Type": "application/json"}
    # Bearer auth between backend and the Eyes service. Uses the
    # dedicated ``EYES_API_TOKEN`` only (a random 32-byte secret
    # generated with ``openssl rand -hex 32``). The legacy
    # ``EYES_HF_TOKEN`` fallback was removed in May 2026 — Eyes
    # never authenticates against HuggingFace at runtime. See
    # ``quarantine/2026-05-sabotage/READ_THIS_FIRST.md``.
    bearer = settings.EYES_API_TOKEN
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    timeout_s = float(
        timeout if timeout is not None else settings.EYES_GEMMA_TIMEOUT_S
    )

    try:
        import httpx
        async with httpx.AsyncClient(timeout=timeout_s) as cli:
            resp = await cli.post(
                f"{space_url}/predict", json=payload, headers=headers,
            )
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Gemma Space network error: {exc}") from exc

    if resp.status_code != 200:
        raise RuntimeError(
            f"Gemma Space {resp.status_code}: {resp.text[:300]}"
        )
    try:
        body = resp.json()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Gemma Space non-JSON response: {exc}") from exc

    output = (body or {}).get("output")
    if not output or not isinstance(output, str):
        # Surface the empty-output condition together with the
        # adjacent metadata so logs immediately reveal whether the
        # Space ran in vision_disabled mode or just generated zero
        # tokens. Common Phase-1 case: vision_disabled=true while
        # the caller passed only an image (no text grounding).
        meta = {
            "output_type": type(output).__name__,
            "output_preview": (str(output)[:120] if output is not None else None),
            "vision_disabled": (body or {}).get("vision_disabled"),
            "vision_used": (body or {}).get("vision_used"),
            "tokens_completion": (body or {}).get("tokens_completion"),
            "finish_reason": (body or {}).get("finish_reason"),
        }
        raise RuntimeError(
            f"Gemma Space empty/invalid output ({meta})"
        )
    if body.get("vision_disabled"):
        # Phase-1 expected state — log once per call so we can spot
        # how often we're degrading. Not an error.
        logger.info(
            "Gemma Space replied with vision_disabled=true (Phase 1 text-only)."
        )
    logger.info(
        "Gemma Space OK tokens=%s+%s elapsed_ms=%s",
        body.get("tokens_prompt"),
        body.get("tokens_completion"),
        body.get("elapsed_ms"),
    )
    return output



SYSTEM_PROMPT = (
    "Output raw JSON only ({...} or [{...}]). No markdown/intro.\n"
    "• sub_category: Specific cut ('T-Shirt','Sweater','Button-Down Shirt','Blouse','Jeans','Pants','Skirt','Shoes','Sneakers','Sandals','Boots','Loafers','Heels','Flats','Sunglasses','Handbag','Crossbody Bag'). Never generic 'Top'/'Bottom'/'Footwear'.\n"
    "• Bottoms: 'Jeans'=denim rivets. Chinos -> sub_category:'Pants', item_type:'Chinos', dress_code:'smart-casual'. Sweatpants/joggers -> sub_category:'Pants', item_type:'Sweatpants'|'Joggers', dress_code:'casual'|'athletic' (never 'Wool'/'Business').\n"
    "• Footwear: 'Shoes' (oxfords/monk straps/derbies/brogues), 'Sneakers' (trainers), 'Sandals' (open-toe/strappy), 'Loafers', 'Boots' (combat/lace-up/ankle/knee-high). Laced/ankle/combat footwear are 'Boots' (never 'Loafers'). Low dress shoes are 'Shoes' (never 'Boots').\n"
    "• Accessories: 'Sunglasses','Handbag','Crossbody Bag','Tote Bag','Belts','Headwear','Scarves & Wraps','Jewelry'. Attached hoods/collars belong to garment. Non-wearables (bottles, phones) -> is_clothing:false.\n"
    "• item_type: Detailed cut ('Crew-Neck T-Shirt','Chinos','Straight Jeans','Sweatpants','Double Monk Strap Shoes','Open-Toe Sandals','Classic Sunglasses'). Differ from sub_category.\n"
    "• caption: <=12 words. Natural fluent sentence in requested language. End with period. Never output brackets or comma lists.\n"
    "• dress_code: 'casual'|'smart-casual'|'business'|'formal'|'athletic'|'loungewear'. Suits='business'; shirts='smart-casual'; tuxedos='formal'; sweatpants='athletic'; sleepwear='loungewear'.\n"
    "• model_gender: Model -> 'women'|'men'. Flat lay/hanger/mannequin -> null.\n"
    "• gender: Strict 3-Tier Hierarchy: (1) Human Model: anchor garments to model gender ('women'|'men'). (2) Garment Criteria: flat lays determined strictly by cut ('women' for floral/blouses/skirts/sandals; 'men' for masculine cuts; 'unisex' for neutral basics). (3) Neutral basics fall back to profile gender, or 'unisex'. Never default to 'men'.\n"
    "• colors: ALWAYS [{\"name\": str, \"pct\": int}] summing to 100. White/cream knitwear/tops photographed indoors must be 'white' or 'cream', never 'grey'.\n"
    "• fabric_materials: [{\"name\": str, \"pct\": int}] summing to 100. tags: [str] (3-4 unique tags, never duplicate sub_category).\n"
    "• pattern: 'solid'|'printed'|'geometric'|'striped'|'plaid'|'floral'.\n"
    "• text/logos: Read accurately ('American Eagle'=eagle/עיט, not deer/אייל).\n"
    "• season: ['spring'|'summer'|'fall'|'winter']. Skirts/shorts/sandals=['summer','spring']. Sweaters/coats/boots=['fall','winter']. Basics=['spring','summer','fall','winter']. Avoid 'all' unless truly seasonless.\n"
    "• Quality & Repair: Only emit 'reconstruction_prompt' if image_quality_status != 'complete'. Set null if complete."
)


# ─────────────────────────────────────────────────────────────────────
# Phase O.6 — single-pass-only suffix
# ─────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT_ONE_PASS_SUFFIX = (
    "\n\nInclude `region`: {\"bbox\": [ymin, xmin, ymax, xmax], \"confidence\": float, \"is_full_frame\": bool}.\n"
    "• 0..1000 grid. Flat lay: bbox=[0, 0, 1000, 1000], is_full_frame=true.\n"
    "• Worn/multi: tight box on garment (exclude skin). Omit if >80% occluded."
)


def _build_system_prompt(*, one_pass: bool = False, user_gender: str | None = None) -> str:
    """Return the full system prompt for an Eyes call.

    ``one_pass=False`` returns the base prompt. ``one_pass=True``
    appends the bbox-emission rules + one-shot example.
    """
    prompt = SYSTEM_PROMPT
    if "{DEFAULT_GENDER_HINT}" in prompt:
        from .validation import resolve_garment_gender
        norm_gender = resolve_garment_gender(user_gender) or "unisex"
        prompt = prompt.replace("{DEFAULT_GENDER_HINT}", f"'{norm_gender}'")
    if one_pass:
        return prompt + SYSTEM_PROMPT_ONE_PASS_SUFFIX
    return prompt


# ─────────────────────────────────────────────────────────────────────
# Canonical JSON schema for Eyes responses. Sent to llama-server via
# ``response_format={"type":"json_schema","json_schema":{...}}`` so the
# decoder is grammar-constrained to a valid garment object (or array
# of garment objects). Kept in lockstep with ``SYSTEM_PROMPT``.
#
# The wrapper uses ``oneOf`` so the model can return either a single
# garment object or a JSON array of garment objects, matching the
# user-message instruction. Empty array `[]` is allowed (no garment).
# ─────────────────────────────────────────────────────────────────────
_GARMENT_OBJECT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["is_clothing", "title", "name", "category", "sub_category", "item_type", "caption", "colors", "tags"],
    "additionalProperties": False,
    "properties": {
        "is_clothing": {
            "type": "boolean",
            "description": "True for wearable clothing/footwear/bags/accessories. False for non-clothing objects like water bottles, cups, phones, furniture.",
        },
        "name": {"type": "string"},
        "title": {"type": "string"},
        "caption": {"type": "string", "maxLength": 160},
        "slot_index": {"type": "integer", "description": "0-based index of this crop (0..n-1)"},
        "category": {
            "type": ["string", "null"],
            "enum": [
                "Top", "Bottom", "Outerwear", "Full Body",
                "Footwear", "Accessories", "Underwear", None,
            ],
        },
        "sub_category": {"type": "string"},
        "item_type": {"type": "string"},
        "brand": {"type": ["string", "null"]},
        "model_gender": {
            "type": ["string", "null"],
            "enum": ["men", "women", None],
        },
        "gender": {
            "type": "string",
            "enum": ["men", "women", "unisex", "kids"],
        },
        "dress_code": {
            "type": "string",
            "enum": [
                "casual", "smart-casual", "business",
                "formal", "athletic", "loungewear",
            ],
        },
        "season": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["spring", "summer", "fall", "winter", "all"],
            },
        },
        "tradition": {"type": ["string", "null"]},
        "colors": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "pct"],
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "pct": {"type": "integer", "minimum": 0, "maximum": 100},
                },
            },
        },
        "fabric_materials": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "pct"],
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "pct": {"type": "integer", "minimum": 0, "maximum": 100},
                },
            },
        },
        "pattern": {
            "type": "string",
            "enum": [
                "printed", "geometric", "striped", "plaid", "floral", "herringbone",
                "polka", "polka_dot", "paisley", "animal_print",
                "graphic", "tie_dye", "abstract", "solid",
            ],
        },
        "state": {"type": "string", "enum": ["new", "used"]},
        "condition": {
            "type": "string",
            "enum": ["bad", "fair", "good", "excellent"],
        },
        "quality": {
            "type": "string",
            "enum": ["budget", "mid", "premium", "luxury"],
        },
        "size": {"type": ["string", "null"]},
        "price_cents": {"type": ["integer", "null"], "minimum": 0},
        "repair_advice": {"type": ["string", "null"]},
        "tags": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 0,
            "maxItems": 16,
        },
        "image_quality_status": {
            "type": ["string", "null"],
            "enum": ["complete", "needs_completion", "needs_reconstruction", None],
        },
        "image_quality_reason": {"type": ["string", "null"], "description": "Reason if needs completion or reconstruction; null if complete."},
        "reconstruction_prompt": {"type": ["string", "null"], "description": "Prompt for Wardrobe Reconstructor. Must be null if image_quality_status is complete."},
        # ── Phase O.6 — single-pass region info ───────────────────────
        # Optional spatial metadata. Only populated when the caller is
        # the single-pass pipeline (``EYES_ONE_PASS=true``). Legacy
        # multi-call pipelines never request this field, so the schema
        # leaves it out of ``required`` and the existing crops/Gemini
        # paths continue to validate without changes.
        #
        # The bbox is on a normalised 0..1000 grid so the model can
        # answer in pure integers regardless of the source image's
        # resolution; the backend rescales to pixels using the
        # ``size`` it sent in the user message.
        "region": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "required": ["bbox"],
            "properties": {
                "bbox": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": 1000},
                    "minItems": 4,
                    "maxItems": 4,
                    "description": (
                        "[ymin, xmin, ymax, xmax] on the 0..1000 normalised "
                        "grid. Origin top-left; ymax > ymin; xmax > xmin."
                    ),
                },
                "confidence": {
                    "type": ["number", "null"],
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Self-reported confidence in the bbox (optional).",
                },
                "is_full_frame": {
                    "type": ["boolean", "null"],
                    "description": (
                        "True when the photo is already a clean, single-garment "
                        "shot and the bbox is [0, 0, 1000, 1000]."
                    ),
                },
            },
        },
    },
}

# Top-level wrapper: single garment object OR list of garment objects.
EYES_JSON_SCHEMA: dict[str, Any] = {
    "oneOf": [
        _GARMENT_OBJECT_SCHEMA,
        {
            "type": "array",
            "items": _GARMENT_OBJECT_SCHEMA,
        },
    ],
}



# Human-readable names for each supported UI language (matches
# frontend/src/lib/i18n.js). Enum-ish values and JSON keys MUST stay in
# English so downstream Pydantic validation never 422s.
_LANG_NAMES = {
    "en": "English",
    "he": "Hebrew",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "hi": "Hindi",
    "nl": "Dutch",
}


def _language_directive(code: str | None) -> str:
    """No-op now — the language directive lives at the top of the
    user message (see :func:`_user_prompt`), matching the proven
    pattern used by ``stylist_brain``. Kept as a callable so the rest
    of ``analyze()`` doesn't need to branch on language.
    """
    return ""


def _user_prompt(code: str | None, user_gender: str | None = None) -> str:
    """Build the user-message prompt for ``analyze()``."""
    from .validation import resolve_garment_gender
    norm_gender = resolve_garment_gender(user_gender) or "unisex"
    fallback_gender_hint = f"if uncertain/neutral basics, apply '{norm_gender}'" if norm_gender != "unisex" else "if uncertain, apply 'unisex'"
    code = (code or "en").lower()

    if code == "en":
        return (
            "Analyze photo. Return raw JSON (1 object or array). No commentary.\n"
            f"sub_category != item_type; pattern: 'printed'|'floral'|'geometric'|'solid'; dress_code: formality; "
            f"gender: criteria ('women' for floral/feminine/blouses, 'men' for masculine cuts, 'unisex' for neutral; {fallback_gender_hint}; never default to 'men')."
        )

    lang_name = _LANG_NAMES.get(code, code)
    if code in ("he", "iw"):
        fallback_he = f"אם ניטרלי/לא ודאי, היעזר במגדר המשתמש '{norm_gender}'" if norm_gender != "unisex" else "אם לא ודאי, 'unisex'"
        return (
            "**OUTPUT LANGUAGE: Hebrew (עברית)**\n"
            "All strings in fluent modern Hebrew (חולצת טי, ג'ינס). Keys and enum values in English.\n"
            f"• sub_category != item_type; פרחוני=pattern:'floral'; dress_code: רשמיות; "
            f"מגדר: נתח גזרה והדפס ('women' לפרחוני/נשי/בלוזות, 'men' לגברי, 'unisex' לפריטים ניטרליים; {fallback_he}; לעולם אל תניח אוטומטית 'men').\n"
            "• Graphic text: 'AMERICAN EAGLE'=עיט/נשר (not deer). Return raw JSON."
        )
    elif code == "ar":
        fallback_ar = f"إذا كان غير مؤكد، استخدم '{norm_gender}'" if norm_gender != "unisex" else "إذا كان غير مؤكد، 'unisex'"
        return (
            "**OUTPUT LANGUAGE: Arabic (العربية)**\n"
            "All strings in fluent Arabic. Keys and enum values in English.\n"
            f"• sub_category != item_type; dress_code: formality; "
            f"gender: criteria ('women' for floral/feminine, 'men' for masculine, 'unisex' for neutral; {fallback_ar}; never default to 'men').\n"
            "• Return raw JSON."
        )
    else:
        return (
            f"**OUTPUT LANGUAGE: {lang_name} ({code})**\n"
            f"All strings in fluent {lang_name}. Keys and enum values in English.\n"
            f"• sub_category != item_type; dress_code: formality; "
            f"gender: criteria ('women' for floral/feminine, 'men' for masculine, 'unisex' for neutral; {fallback_gender_hint}; never default to 'men').\n"
            "• Return raw JSON."
        )


def _extract_json(raw: str) -> dict[str, Any] | list[dict[str, Any]]:
    """Pull the JSON payload out of a model response.

    Returns either:
      * dict  — the typical single-garment response, OR
      * list[dict] — Eyes v3 (Gemma 4) can return a JSON array when the
        photo contains multiple garments. Callers that expect a single
        item should handle the list case (see ``analyze()``).
    """
    if not raw:
        return {}

    # 1) ```json fenced``` — prefer array form, then object.
    for pattern in (r"```(?:json)?\s*(\[.*?\])\s*```", r"```(?:json)?\s*(\{.*?\})\s*```"):
        m = re.search(pattern, raw, flags=re.S)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:  # noqa: BLE001
                pass

    # 2) Bare array: take the outermost [...] span.
    a_first = raw.find("[")
    a_last = raw.rfind("]")
    o_first = raw.find("{")
    o_last = raw.rfind("}")

    # Prefer array if it brackets an object (i.e. real list-of-garments,
    # not just a stray "[" inside a string field). Heuristic: the array
    # span must enclose at least one "{".
    if (
        a_first != -1 and a_last != -1 and a_last > a_first
        and (o_first == -1 or a_first < o_first <= a_last)
    ):
        try:
            return json.loads(raw[a_first : a_last + 1])
        except Exception:  # noqa: BLE001
            pass

    # 3) Bare object.
    if o_first != -1 and o_last != -1 and o_last > o_first:
        try:
            return json.loads(raw[o_first : o_last + 1])
        except Exception:  # noqa: BLE001
            pass

    # 4) Last resort — model returned valid JSON with no surrounding text.
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        pass

    # 5) Fallback for unclosed or truncated JSON arrays / objects
    scanned_objs, _ = _scan_complete_json_objects(raw)
    if scanned_objs:
        if raw.lstrip().startswith("[") or len(scanned_objs) > 1:
            return scanned_objs
        return scanned_objs[0]

    return {}


GROUP_ANALYZE_SYSTEM_PROMPT = (
    "Analyze multiple views of the same garment. 'host'=front view; 'members'=back/profile views.\n"
    "1. Tag views: 'Front', 'Back', 'Profile' in `tags`.\n"
    "2. Refine host metadata with details visible in member views; correct member metadata.\n"
    'Return raw JSON in requested language:\n'
    '{"items": [{"id": str, "group_role": "host"|"member", "view_tag": "Front"|"Back"|"Profile", "updates": {...}}]}'
)


DETECT_SYSTEM_PROMPT = (
    "Detect visible wearable fashion items (clothing, outerwear, footwear, bags, accessories, jewelry). Ignore body and background.\n"
    "• Discard non-wearable items: water bottles, cups, flasks, phones, keys, cameras, food, furniture.\n"
    "• Tight bbox [ymin, xmin, ymax, xmax] in 0..1000 grid. Pairs=1 box. Bags=bag body only. No duplicate boxes.\n"
    'Return raw JSON: {"items": [{"label": "name", "kind": "garment"|"outerwear"|"footwear"|"bag"|"accessory"|"jewelry", "bbox": [ymin, xmin, ymax, xmax]}]}\n'
    'If uncertain: {"items": [{"label": "garment", "kind": "garment", "bbox": [0, 0, 1000, 1000]}]}'
)



def _scan_complete_json_objects(
    text: str, start_pos: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Patch M19 (May 2026) — streaming JSON-array object scanner.

    Walks ``text[start_pos:]`` looking for top-level ``{...}`` objects
    inside an outer JSON array (the response shape produced by
    :meth:`GarmentVisionService.analyze_batch_stream`). Returns:

        (objects_found, next_start_pos)

    where ``next_start_pos`` is the byte offset just past the last
    complete object. Callers stash that offset between chunks and pass
    it in as ``start_pos`` next time so we never re-parse a
    successfully-extracted region.

    The scanner is brace-counting plus quote-tracking — deliberately
    tiny (no ``ijson`` dependency) and tolerant of leading whitespace,
    fenced code blocks before ``[``, trailing commas / whitespace
    between entries, and partial / truncated final objects (left in
    the buffer for a later call).
    """
    pos = start_pos
    n = len(text)
    objects: list[dict[str, Any]] = []
    depth = 0
    obj_start = -1
    in_string = False
    escape = False

    while pos < n:
        c = text[pos]
        if escape:
            escape = False
            pos += 1
            continue
        if in_string:
            if c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            pos += 1
            continue
        if c == '"':
            in_string = True
            pos += 1
            continue
        if c == "{":
            if depth == 0:
                obj_start = pos
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and obj_start >= 0:
                blob = text[obj_start : pos + 1]
                try:
                    obj = json.loads(blob)
                    if isinstance(obj, dict):
                        objects.append(obj)
                except Exception:  # noqa: BLE001
                    pass
                obj_start = -1
                pos += 1
                start_pos = pos
                continue
        pos += 1

    return objects, start_pos


_SEGFORMER_KIND_HUMAN_LABEL: dict[str, str] = {
    "top": "Top or Outerwear (upper-body garment)",
    "bottom": "Bottom (pants / skirt / shorts)",
    "dress": "Full Body (dress / jumpsuit)",
    "footwear": "Footwear (shoes / boots / sneakers)",
    "accessory": "Accessories (belt / scarf / sunglasses / bag)",
    "headwear": "Accessories (hat / cap / beanie)",
}


def _build_batch_prompts(
    *,
    n: int,
    language: str | None,
    kind_hints: list[str | None] | None = None,
    user_gender: str | None = None,
    model_gender: str | None = None,
) -> tuple[str, str]:
    """Build ``(system_prompt, user_text)`` for a batched garment analysis."""
    from .validation import resolve_garment_gender
    norm_model = resolve_garment_gender(model_gender)
    norm_gender = norm_model or resolve_garment_gender(user_gender)
    gender_rule = ""
    if norm_model in ("men", "women"):
        gender_rule = (
            f"• HUMAN MODEL OUTFIT GENDER: All garments in this outfit are worn by a visible {norm_model} model. "
            f"Set the gender of every garment in this outfit to '{norm_model}'. "
            f"Do NOT classify any garment from this {norm_model}'s outfit as the opposite gender.\n"
        )
    else:
        norm_u = resolve_garment_gender(user_gender)
        user_fallback_hint = f" If uncertain/basic, use '{norm_u}'." if norm_u in ("men", "women") else ""
        gender_rule = (
            "• Garment gender: Analyze criteria strictly ('women' for feminine/floral, 'men' for masculine cuts, 'unisex' for neutral basics)."
            f"{user_fallback_hint} Never default to 'men'.\n"
        )

    hint_block = ""
    if n > 1 and kind_hints and len(kind_hints) == n:
        bullets = [
            f"  - Image {i}: {human}"
            for i, k in enumerate(kind_hints, 1)
            if k and (human := _SEGFORMER_KIND_HUMAN_LABEL.get(k.strip().lower()))
        ]
        if bullets:
            hint_block = (
                "\nCROP HINTS:\n"
                + "\n".join(bullets)
                + "\nDiscard non-clothing objects (bottles/cups/phones) with is_clothing: false."
            )

    user_parts = []
    code = (language or "en").lower()
    if code != "en":
        lang_name = _LANG_NAMES.get(code, code)
        if code in ("he", "iw"):
            user_parts.append("**OUTPUT LANGUAGE: Hebrew (עברית).** Strings in fluent Hebrew. Keys/enums in English.")
        elif code == "ar":
            user_parts.append("**OUTPUT LANGUAGE: Arabic (العربية).** Strings in fluent Arabic. Keys/enums in English.")
        else:
            user_parts.append(f"**OUTPUT LANGUAGE: {lang_name} ({code}).** Strings in fluent {lang_name}. Keys/enums in English.")

    user_parts.append(f"BATCH: Analyze {n} crop(s) (indices 0..{n-1}). Return JSON array of {n} objects with 'slot_index'.")
    if hint_block:
        user_parts.append(hint_block)

    user_text = "\n".join(user_parts)

    system_prompt = _build_system_prompt(one_pass=False, user_gender=norm_gender)
    if gender_rule:
        system_prompt = f"{system_prompt}\n{gender_rule}"
    return system_prompt, user_text


# ─────────────────────────────────────────────────────────────────────
# Patch M23 (Aug 2026) — Gemma per-attribute streaming
#
# Problem: one 2400-token Gemma call takes 82-111 s on the CPU-only VPS.
# After 111 s the stream silently dies (Caddy idle timeout).
#
# Solution: split the 17 fields into 5 focused attribute groups and send
# one /predict request per group.  Each group outputs 50-250 tokens
# (~8-22 s on CPU) and the result is immediately yielded to the NDJSON
# stream so the frontend can update form fields progressively.
#
# Total wall time: ~60-75 s (sequential, 5 calls) vs 82-111 s (single).
# Time to first field: ~8-14 s vs 82-111 s.
# No silent kill: each call finishes well within any proxy idle timeout.
# ─────────────────────────────────────────────────────────────────────

# Each entry: (group_name, field_names, max_output_tokens, system_snippet)
# Groups are ordered so fast enum-heavy groups fire first.
ATTRIBUTE_GROUPS: list[tuple[str, list[str], int, str]] = [
    (
        "identity",
        ["name", "title", "category", "sub_category", "item_type"],
        280,
        (
            'Garment identity:\n'
            '- name: 2-5 unique distinguishing words\n'
            '- title: short title matching name\n'
            '- category: Top|Bottom|Outerwear|Full Body|Footwear|Accessories|Underwear\n'
            '- sub_category: cut (Shirt, Pants, Jacket, Dress, Sneakers)\n'
            '- item_type: specific cut (Oxford shirt, Bomber jacket)'
        )
    ),
    (
        "visual",
        ["colors", "pattern", "fabric_materials"],
        320,
        (
            'Visual properties:\n'
            '- colors: [{"name": str, "pct": int}] summing to 100\n'
            '- pattern: printed|solid|striped|plaid|floral|herringbone|polka_dot|paisley|geometric|animal_print|graphic|tie_dye|abstract\n'
            '- fabric_materials: [{"name": str, "pct": int}] summing to 100'
        )
    ),
    (
        "context",
        ["gender", "dress_code", "season", "tradition"],
        120,
        (
            'Context of use:\n'
            '- gender: men|women|unisex|kids\n'
            '- dress_code: casual|smart-casual|business|formal|athletic|loungewear\n'
            '- season: [spring|summer|fall|winter|all]\n'
            '- tradition: cultural style if visible, else null'
        )
    ),
    (
        "condition",
        ["state", "condition", "quality", "size", "brand"],
        160,
        (
            'Physical condition:\n'
            '- state: new|used\n'
            '- condition: bad|fair|good|excellent\n'
            '- quality: budget|mid|premium|luxury\n'
            '- size: visible size tag, else null\n'
            '- brand: visible brand, else null'
        )
    ),
    (
        "narrative",
        ["caption", "price_cents", "repair_advice", "tags"],
        520,
        (
            'Narrative fields:\n'
            '- caption: ONE confident vivid sentence (max 240 chars)\n'
            '- price_cents: estimated resale in USD cents (integer) or null\n'
            '- repair_advice: restoration tip if worn/damaged, else null\n'
            '- tags: 3 to 8 searchable keywords'
        )
    ),
]

# Text-heavy groups that need language localisation for free-text fields.
_TEXT_GROUPS = {"identity", "narrative"}


async def call_gemma_space_stream_attributes(
    *,
    image_b64_jpeg: str,
    language: str | None = None,
    timeout_per_group: float | None = None,
    segformer_label: str | None = None,
    segformer_category: str | None = None,
    request_id: str | None = None,
    id_slot: int | None = None,
    is_single_item: bool = False,
    user_gender: str | None = None,
    system_prompt: str | None = None,
) -> "AsyncIterator[tuple[str, list[str], dict[str, Any]]]":
    """Patch M23 — per-attribute streaming for Gemma on CPU.

    Sends one focused /predict request per attribute group and yields
    ``(group_name, field_names, partial_dict)`` as each call resolves.

    Callers ``async for`` over this generator and emit an NDJSON
    ``{"type": "field", ...}`` frame for each yielded tuple, so the
    frontend can progressively fill the Add-Item form while the next
    group is still being processed by the model.

    The 5-group split reduces the single 2400-token call (82-111 s) to
    5 calls of 50-280 tokens each (~8-22 s per group), cutting the
    total wall time to ~60-75 s while giving the user visible results
    within ~10 s.

    On any individual group failure the generator yields an empty dict
    for that group and continues — the final assembled analysis will
    simply be missing those fields, which is better than failing the
    entire analysis.
    """
    # Per-group timeout: default to max(45s, EYES_GEMMA_TIMEOUT_S/3).
    # 45 s is generous for 280 tokens at 35 ms/token (~10 s generation
    # + ~30 s image prefill overhead worst-case on a cold CPU).
    tpg: float = timeout_per_group or max(
        60.0, float(settings.EYES_GEMMA_TIMEOUT_S) / 2.0
    )

    lang_code = (language or "en").lower()
    lang_name = _LANG_NAMES.get(lang_code, lang_code) if lang_code != "en" else None

    # ── Fast path: Unified single pass (~24s vs 102s sequential) ──
    # When enabled, avoids re-encoding the multimodal image 5 times on CPU.
    single_pass = getattr(settings, "EYES_GEMMA_SINGLE_PASS", True)
    if single_pass:
        all_field_names: list[str] = []
        for _, fnames, _, _ in ATTRIBUTE_GROUPS:
            all_field_names.extend(fnames)

        # Use authoritative Gemini SYSTEM_PROMPT (exact prompt used by Gemini Flash)
        # Keep system_prompt STATIC so llama-server can cache KV prefix across all batch items!
        if not system_prompt:
            system_prompt = _build_system_prompt(one_pass=False, user_gender=user_gender)

        user_hints = []
        lbl_low = (segformer_label or "").lower()
        if segformer_category and (not is_single_item or segformer_category in ("footwear", "bottom", "accessory", "headwear", "bag")):
            mapped_cat = None
            if segformer_category == "top":
                mapped_cat = "Top or Outerwear"
            elif segformer_category == "bottom":
                mapped_cat = "Bottom"
            elif segformer_category == "dress":
                mapped_cat = "Outerwear (Coat / Trench) or Full Body (Dress)"
            elif segformer_category == "footwear":
                mapped_cat = "Footwear"
            elif segformer_category in ("headwear", "accessory", "bag"):
                mapped_cat = "Accessories"

            if mapped_cat:
                user_hints.append(f"Crop: '{mapped_cat}'. Describe this item only.")

        if "skirt" in lbl_low:
            user_hints.append("RULE: Skirt. Lower garment with continuous flare/hem and no leg division is sub_category='Skirt', item_type='Pleated Skirt'|'Midi Skirt'|'A-Line Skirt'|'Mini Skirt'|'Maxi Skirt'. NEVER classify as Pants or Trousers. Accurately report visual fabric color (grey/olive/charcoal), NOT black.")
        elif "bag" in lbl_low or segformer_category == "bag":
            user_hints.append("RULE: Genuine bags/purses only. Handheld water bottles/cups/phones/objects: set is_clothing: false, sub_category='non-clothing', item_type='non-clothing'.")
        elif ("shoe" in lbl_low or segformer_category == "footwear") and "boot" not in lbl_low:
            user_hints.append("RULE: Footwear. Low-cut/athletic: sub_category='Sneakers'|'Shoes'.")
        elif "pants" in lbl_low or (segformer_category == "bottom" and "skirt" not in lbl_low):
            user_hints.append("RULE: Pants vs Jeans. 5-pocket rivet denim only is 'Jeans'. Chinos/slacks/trousers are sub_category='Pants', item_type='Chinos'|'Tailored Trousers', dress_code='smart-casual'.")

        user_text = _user_prompt(language, user_gender=user_gender)
        if user_hints:
            user_text = "\n".join(user_hints) + "\n\n" + user_text

        import copy
        properties = {}
        is_coarse_seg = (segformer_label or "").lower().strip() in ("upper-clothes", "upper_clothes", "lower-clothes", "lower_clothes", "garment", "clothing", "item")
        for name in all_field_names:
            if name in _GARMENT_OBJECT_SCHEMA["properties"]:
                prop = copy.deepcopy(_GARMENT_OBJECT_SCHEMA["properties"][name])
                if name == "category" and segformer_category and (not is_single_item or segformer_category in ("footwear", "bottom", "accessory", "headwear", "bag")) and not is_coarse_seg:
                    if segformer_category == "top":
                        prop["enum"] = ["Top", "Outerwear"]
                    elif segformer_category == "bottom":
                        prop["enum"] = ["Bottom"]
                    elif segformer_category == "dress":
                        prop["enum"] = ["Outerwear", "Full Body"]
                    elif segformer_category == "footwear":
                        prop["enum"] = ["Footwear"]
                    elif segformer_category in ("headwear", "accessory", "bag"):
                        prop["enum"] = ["Accessories"]

                if name == "sub_category":
                    if "skirt" in lbl_low:
                        prop["enum"] = [
                            "Skirt", "Midi Skirt", "Pleated Skirt", "A-Line Skirt", "Mini Skirt", "Maxi Skirt", "Pencil Skirt",
                        ]
                    elif "bag" in lbl_low or segformer_category == "bag":
                        prop["enum"] = [
                            "Bag", "Handbag", "Tote Bag", "Crossbody Bag", "Shoulder Bag",
                            "Backpack", "Clutch", "Wicker Bag", "Basket Bag", "non-clothing",
                        ]
                    elif ("shoe" in lbl_low or segformer_category == "footwear") and "boot" not in lbl_low:
                        prop["enum"] = [
                            "Sneakers", "Shoes", "Loafers", "Flats", "Heels", "Sandals", "Boots", "non-clothing",
                        ]

                if name == "price_cents":
                    prop["type"] = "integer"
                    prop["minimum"] = 100
                    prop["maximum"] = 500000

                if isinstance(prop, dict):
                    p_type = prop.get("type")
                    if p_type == "string" and "maxLength" not in prop and "enum" not in prop:
                        prop["maxLength"] = 16 if name == "size" else 36
                    elif isinstance(p_type, list) and "string" in p_type and "maxLength" not in prop:
                        prop["maxLength"] = 16 if name == "size" else 36

                    if name == "caption":
                        prop["minLength"] = 10
                        prop["maxLength"] = 300

                    if p_type == "array" and "items" in prop:
                        if name == "season":
                            prop["minItems"] = 1
                            prop["maxItems"] = 4
                        elif name == "colors":
                            prop["maxItems"] = 3
                        elif name == "fabric_materials":
                            prop["maxItems"] = 2
                        elif name == "tags":
                            prop["maxItems"] = 4

                        items_schema = prop["items"]
                        if isinstance(items_schema, dict):
                            i_type = items_schema.get("type")
                            if i_type == "string" and "maxLength" not in items_schema:
                                items_schema["maxLength"] = 24
                            elif i_type == "object" and "properties" in items_schema:
                                for sub_p_name, sub_p in items_schema["properties"].items():
                                    if isinstance(sub_p, dict) and sub_p.get("type") == "string":
                                        sub_p["maxLength"] = 24

                properties[name] = prop

        # Omit 'title' from prompt schema to save ~25 tokens; title is populated from 'name'
        schema_props = {k: v for k, v in properties.items() if k != "title"}
        full_schema = {
            "type": "object",
            "properties": schema_props,
            "required": [
                "is_clothing", "name", "category", "sub_category", "item_type",
                "colors", "pattern", "gender", "dress_code", "season",
                "fabric_materials", "tags", "caption",
            ],
            "additionalProperties": False,
        }

        try:
            timeout_single = max(180.0, float(settings.EYES_GEMMA_TIMEOUT_S))
            raw = await _call_gemma_space(
                system_prompt=system_prompt,
                user_text=user_text,
                image_b64_jpeg=image_b64_jpeg,
                max_tokens=320,
                temperature=0.0,
                timeout=timeout_single,
                json_schema=full_schema,
                id_slot=id_slot,
            )
            parsed = _extract_json(raw)
            if isinstance(parsed, list) and parsed:
                parsed = parsed[0]
            if isinstance(parsed, dict) and len(parsed) >= 3:
                if not parsed.get("title") and parsed.get("name"):
                    parsed["title"] = parsed["name"]
                elif not parsed.get("name") and parsed.get("title"):
                    parsed["name"] = parsed["title"]
                parsed = _coerce_single_garment(parsed, user_gender=user_gender, language=language)
                parsed = _coerce_enums(parsed, user_gender=user_gender)
                for group_name, field_names, _, _ in ATTRIBUTE_GROUPS:
                    filtered = {k: v for k, v in parsed.items() if k in field_names}
                    yield group_name, field_names, filtered
                return
            raise ValueError(f"Incomplete garment JSON (keys={list(parsed.keys()) if isinstance(parsed, dict) else type(parsed)})")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemma single-pass failed (%s); bubbling up to Gemini fallback", exc)
            raise RuntimeError(f"Gemma single-pass analysis failed: {exc}") from exc

