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
    "Output raw JSON only ({...} or [{...}]). No thinking tags, markdown, or intro. "
    "Analyze each visible garment in concise merchandisable detail.\n\n"
    "Rules:\n"
    "• sub_category: Specific cut ('Shirt','T-Shirt','Sweater','Jeans','Pants','Skirt','Sneakers'). Never generic 'Top'/'Bottom'.\n"
    "• item_type: Styling cut ('Crew-Neck T-Shirt','Skinny Jeans'). Must differ from sub_category.\n"
    "• gender: 'women' for feminine cuts/styles (crop tops, blouses, skirts, dresses, heels, bras, feminine florals); 'men' for menswear/masculine cuts; 'unisex' for neutral activewear, tank tops, standard tees, sneakers, bags; 'kids' for children's items. If worn by an identifiable model, standard cuts align with the model's apparent gender.\n"
    "• colors: [{\"name\": str, \"pct\": int}] summing to 100. Specific shades ('Burgundy','Navy','Olive','Light Blue'). Never omit pct.\n"
    "• fabric_materials: [{\"name\": str, \"pct\": int}] summing to 100 (e.g. [{\"name\": \"Cotton\", \"pct\": 100}]). Never omit pct.\n"
    "• pattern: 'printed' for graphic tees, text, logos, artwork, front prints; 'geometric' for repeating weave, texture, heathering, waffle; 'striped'|'plaid'|'floral'; 'solid' only if plain & unprinted.\n"
    "• text/logos: Read lettering & emblems accurately (e.g. 'American Eagle' = eagle/עיט, not deer/אייל).\n"
    "• season: ['spring'|'summer'|'fall'|'winter'|'all']. Short-sleeve/linen=['summer']; wool/down=['fall','winter']."
)


# ─────────────────────────────────────────────────────────────────────
# Phase O.6 — single-pass-only suffix
# ─────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT_ONE_PASS_SUFFIX = (
    "\n\nInclude `region`: {\"bbox\": [ymin, xmin, ymax, xmax], \"confidence\": float, \"is_full_frame\": bool}.\n"
    "• 0..1000 normalized grid (0=top/left, 1000=bottom/right).\n"
    "• Flat lay/studio still: bbox=[0, 0, 1000, 1000], is_full_frame=true.\n"
    "• Worn/multi: tight box on visible garment (exclude skin). Omit if >80% occluded."
)


def _build_system_prompt(*, one_pass: bool = False, user_gender: str | None = None) -> str:
    """Return the full system prompt for an Eyes call.

    ``one_pass=False`` returns the base prompt. ``one_pass=True``
    appends the bbox-emission rules + one-shot example.
    """
    from .validation import resolve_garment_gender
    norm_gender = resolve_garment_gender(user_gender) or "unisex"
    prompt = SYSTEM_PROMPT.replace("{DEFAULT_GENDER_HINT}", f"'{norm_gender}'")
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
    "required": ["title"],
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string"},
        "title": {"type": "string"},
        "caption": {"type": "string", "maxLength": 240},
        "category": {
            "type": "string",
            "enum": [
                "Top", "Bottom", "Outerwear", "Full Body",
                "Footwear", "Accessories", "Underwear",
            ],
        },
        "sub_category": {"type": "string"},
        "item_type": {"type": "string"},
        "brand": {"type": ["string", "null"]},
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
        "image_quality_reason": {"type": ["string", "null"]},
        "reconstruction_prompt": {"type": ["string", "null"]},
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
    code = (code or "en").lower()

    if code == "en":
        return (
            "Analyze photo. Return raw JSON (1 object or array). No commentary.\n"
            f"Rules: sub_category != item_type; specific shades; graphic/print/logo=pattern:'printed'; textured=pattern:'geometric'; "
            f"default to '{norm_gender}' for standard menswear/womenswear cuts (feminine cuts/styles='women', activewear tanks/singlets='unisex')."
        )

    lang_name = _LANG_NAMES.get(code, code)
    if code in ("he", "iw"):
        return (
            "**OUTPUT LANGUAGE: Hebrew (עברית)**\n"
            "All string values (name, caption, tags, sub_category, item_type, colors, materials) in fluent modern Hebrew (חולצת טי, ג'ינס). No diacritics.\n"
            f"• sub_category != item_type; specific colors (תכלת, כחול כהה, בורדו); graphic/print/logo=pattern:'printed'; default to '{norm_gender}' for standard cuts (feminine cuts='women', activewear tanks/singlets='unisex').\n"
            "• Graphic text/logos: Read accurately ('AMERICAN EAGLE' = עיט/נשר, NEVER deer/אייל). All tags in Hebrew.\n"
            "• JSON keys and enum values stay in English. Return raw JSON (1 object or array). No commentary."
        )
    elif code == "ar":
        return (
            "**OUTPUT LANGUAGE: Arabic (العربية)**\n"
            "All string values (name, caption, tags, sub_category, item_type, colors, materials) in fluent modern Arabic.\n"
            f"• sub_category != item_type; textured=pattern:'geometric'; default to '{norm_gender}' for standard cuts (feminine cuts='women', activewear tanks/singlets='unisex').\n"
            "• JSON keys and enum values stay in English. Return raw JSON (1 object or array). No commentary."
        )
    else:
        return (
            f"**OUTPUT LANGUAGE: {lang_name} ({code})**\n"
            f"All string values (name, caption, tags, sub_category, item_type, colors, materials) in fluent {lang_name}.\n"
            f"• sub_category != item_type; textured=pattern:'geometric'; default to '{norm_gender}' for standard cuts (feminine cuts='women', activewear tanks/singlets='unisex').\n"
            "• JSON keys and enum values stay in English. Return raw JSON (1 object or array). No commentary."
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
    "Detect visible wearable fashion items (clothing garments, outerwear, footwear, real wearable bags/backpacks, wearable accessories, jewelry). Ignore person body and background scene.\n"
    "• DO NOT detect non-fashion handheld items: water bottles, cups, mugs, flasks, beverages, phones, keys, cameras, food, books, or background furniture. Only wearable items.\n"
    "• Tight bbox [ymin, xmin, ymax, xmax] in 0..1000 grid. Pairs (shoes, earrings)=1 box for both. Bags=bag body only.\n"
    "• No duplicate/part boxes. Return raw JSON:\n"
    '{"items": [{"label": "name", "kind": "garment"|"outerwear"|"footwear"|"bag"|"accessory"|"jewelry", "bbox": [ymin, xmin, ymax, xmax]}]}\n'
    'If uncertain, return full frame: {"items": [{"label": "garment", "kind": "garment", "bbox": [0, 0, 1000, 1000]}]}'
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
) -> tuple[str, str]:
    """Build ``(system_prompt, user_text)`` for a batched garment analysis."""
    from .validation import resolve_garment_gender
    norm_gender = resolve_garment_gender(user_gender)
    gender_rule = ""
    if norm_gender in ("men", "women"):
        gender_rule = (
            f"• Garment gender classification: evaluate the specific cut and styling of each garment. "
            f"Feminine cuts/styles (crop tops, floral blouses, skirts, dresses, heels, bras, feminine florals) must be 'women'. "
            f"Activewear tank tops, singlets, standard t-shirts, sneakers, and bags are 'unisex'. "
            f"Menswear tailoring or standard cuts worn by a visible {norm_gender} model are '{norm_gender}'.\n"
        )

    hint_block = ""
    if n > 1 and kind_hints and len(kind_hints) == n:
        bullets: list[str] = []
        for i, k in enumerate(kind_hints, 1):
            if not k:
                continue
            human = _SEGFORMER_KIND_HUMAN_LABEL.get(k.strip().lower())
            if not human:
                continue
            bullets.append(f"  - Image {i}: {human}")
        if bullets:
            hint_block = (
                "\nCROP CATEGORY HINTS:\n"
                + "\n".join(bullets)
                + "\nAnchor category & sub_category to these hints."
            )
    user_text = f"{gender_rule}Analyze {n} crop(s) in order. Return JSON array of {n} GarmentAnalysis objects ([...])."
    code = (language or "en").lower()
    if code != "en":
        lang_name = _LANG_NAMES.get(code, code)
        if code in ("he", "iw"):
            directive = "**OUTPUT LANGUAGE: Hebrew (עברית).** Strings in fluent modern Hebrew. Keys/enums in English.\n"
        elif code == "ar":
            directive = "**OUTPUT LANGUAGE: Arabic (العربية).** Strings in fluent modern Arabic. Keys/enums in English.\n"
        else:
            directive = f"**OUTPUT LANGUAGE: {lang_name} ({code}).** Strings in fluent {lang_name}. Keys/enums in English.\n"
        user_text = directive + user_text

    system_prompt = (
        _build_system_prompt(one_pass=False, user_gender=user_gender)
        + _language_directive(language)
        + f"\nBATCH: Analyze {n} crops in order (1..{n}). Return raw JSON array of EXACTLY {n} objects matching GarmentAnalysis schema. No extra text."
        + (f"\n{gender_rule}" if gender_rule else "")
        + hint_block
    )
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
                user_hints.append(f"SEGMENTATION: Crop is '{mapped_cat}'. Describe this item only.")

        if "bag" in lbl_low or segformer_category == "bag":
            user_hints.append("RULE: Bag item. sub_category='Bag'|'Tote Bag'|'Handbag'. Not belt/scarf/jewelry.")
        elif ("shoe" in lbl_low or segformer_category == "footwear") and "boot" not in lbl_low:
            user_hints.append("RULE: Footwear item. Low-cut/athletic/canvas/casual sub_category='Sneakers'|'Shoes' (not 'Boots').")

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
                    if "bag" in lbl_low or segformer_category == "bag":
                        prop["enum"] = [
                            "Bag", "Handbag", "Tote Bag", "Crossbody Bag", "Shoulder Bag",
                            "Backpack", "Clutch", "Wicker Bag", "Basket Bag",
                        ]
                    elif ("shoe" in lbl_low or segformer_category == "footwear") and "boot" not in lbl_low:
                        prop["enum"] = [
                            "Sneakers", "Shoes", "Loafers", "Flats", "Heels", "Sandals", "Boots",
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
                        prop["maxLength"] = 120

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
                "name", "category", "sub_category", "item_type",
                "colors", "pattern", "gender", "dress_code", "season",
                "fabric_materials", "state", "condition", "quality",
                "price_cents", "caption",
            ],
            "additionalProperties": False,
        }

        try:
            timeout_single = max(180.0, float(settings.EYES_GEMMA_TIMEOUT_S))
            raw = await _call_gemma_space(
                system_prompt=system_prompt,
                user_text=user_text,
                image_b64_jpeg=image_b64_jpeg,
                max_tokens=380,
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

