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
    max_tokens: int = 2400,
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
        "max_tokens": int(max_tokens),
        "temperature": float(temperature),
        "json_mode": True,
        "enable_thinking": bool(think),
        "think": bool(think),
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
    "You are The Eyes \u2014 DressApp's visual garment analyst. You look at "
    "a photograph. If there are garments present in the photograph, analyse the photogaph (which may contain one or more garments) and "
    "describe each item in exhaustive, merchandisable detail. Your output "
    "is used to auto-fill an Add-Item form that a user will review, so be "
    "confident but never invent sensitive claims (e.g. do not guess a "
    "specific brand unless clearly visible; leave brand blank otherwise).\n\n"
    "CRITICAL FORMAT RULE — ZERO CONVERSATIONAL FILLER:\n"
    "Never begin your response with conversational introductions or preambles such as "
    "'Here is the clothing item:', 'Here is the analysis:', 'Certainly!', 'In this photo I see', or any greeting. "
    "Your response MUST start immediately with the first JSON character '{' or '[' and end immediately with '}' or ']'. "
    "Never wrap the result in extra commentary or markdown backticks.\n\n"
    "Return ONLY a JSON value with one of two shapes:\n"
    "  \u2022 a single JSON object when one garment is visible, or\n"
    "  \u2022 a JSON array of such objects when multiple garments are visible, or\n"
    "  \u2022 a 'No Garments detected' message\n\n"
    "Each garment object has the following shape (all keys optional except "
    "`title`):\n"
    "{\n"
    '  "name": string,                     // 2\u20135 words. Must be UNIQUE & distinguishing \u2014 weave in a defining detail (material, fit, vibe, pattern, era, hardware, neckline, wash) so the user never ends up with 12 generic "Black T-shirt" rows. The pattern is "<distinguishing detail> + <core garment>" \u2014 e.g. heavyweight boxy + tee, ribbed slim + crewneck, vintage pocket + tee. Render that pattern in the OUTPUT LANGUAGE specified by the user message; do NOT echo English examples verbatim.\n'
    '  "title": string,                    // fallback short title (required). Same uniqueness rules as `name`. Same output language as `name`.\n'
    '  "caption": string,                  // ONE confident, vivid sentence in the OUTPUT LANGUAGE describing what makes this piece tick \u2014 silhouette, surface detail, what it pairs with. Max 240 chars. NEVER hedge: forbid "seems", "appears", "probably", "looks like", "might be". State observations directly. If `state` is "used" and `condition` is "bad", end with one short repair/enhancement tip.\n'
    '  "category": string,                 // top bucket: "Top", "Bottom", "Outerwear", "Full Body", "Footwear", "Accessories", "Underwear"\n'
    '  "sub_category": string,             // e.g. "Shirt", "Pants", "Dress", "Coat", "Sneakers"\n'
    '  "item_type": string,                // specific type: "Oxford shirt", "Mini-dress", "Crew-neck sweater"\n'
    '  "brand": string|null,               // only if legibly visible\n'
    '  "gender": "men"|"women"|"unisex"|"kids",\n'
    '  "dress_code": "casual"|"smart-casual"|"business"|"formal"|"athletic"|"loungewear",\n'
    '  "season": string[],                 // any of: "spring","summer","fall","winter","all"\n'
    '  "tradition": string|null,           // cultural/religious pattern if clearly present (e.g. "arabic","jewish","indian"), else null\n'
    '  "colors":           [{"name": string, "pct": integer 0..100}, ...],  // sum \u2248 100\n'
    '  "fabric_materials": [{"name": string, "pct": integer 0..100}, ...],  // sum \u2248 100; infer likely composition\n'
    '  "pattern": string,                  // "solid","striped","plaid","floral","herringbone","polka_dot","paisley","geometric","animal_print","graphic","tie_dye","abstract"\n'
    '  "state": "new"|"used",\n'
    '  "condition": "bad"|"fair"|"good"|"excellent",\n'
    '  "quality": "budget"|"mid"|"premium"|"luxury",\n'
    '  "size": string|null,                // only if a label/tag is readable, else null\n'
    '  "price_cents": integer|null,        // estimated resale value in USD cents, only if confident; else null\n'
    '  "repair_advice": string|null,       // a short, warm, actionable tip if condition=="bad" (e.g. "Minor pilling on the sleeves — a fabric shaver will restore the surface."); null otherwise\n'
    '  "tags": string[],                   // 3–8 searchable keywords\n'
    '  "image_quality_status": "complete"|"needs_completion"|"needs_reconstruction", // Quality Checker assessment of the cropped image:\n'
    '                                                                              // • "complete": ONLY if 100% of the entire garment is pristine, standalone, fully unoccluded, with all outer edges, side contours, waistband/collar, and bottom hems clearly intact (e.g. clean studio flat lay or ghost mannequin). NEVER use "complete" for crops from worn outfits where any edge, side, or hem is truncated or occluded.\n'
    '                                                                              // • "needs_completion": Visible garment is mostly present, but has ANY missing side panels/contours, occlusions from hands, arms, bags, hair, or overlapping garments, clipped hems/waistbands, or uneven amputated borders. Needs image completion to outpaint/inpaint missing sections while preserving visible fabric and shape.\n'
    '                                                                              // • "needs_reconstruction": Severely truncated, severed (e.g. only shoe tips visible, tiny sliver, amputated torso), or heavily degraded so that inpainting is insufficient and a full new photorealistic generation from scratch is required.\n'
    '  "image_quality_reason": string|null, // Diagnostic note in English describing what is missing/occluded (e.g. "Right side contour cut by bag occlusion; hem clipped at bottom" or "Only toe caps visible, heels and openings missing"). Null if "complete".\n'
    '  "reconstruction_prompt": string|null // Nano Banana prompt. If "needs_completion": clear instruction to outpaint and complete missing borders/hems/sleeves/sides into a symmetrical, whole garment on a neutral DressApp card background (#F5F2EB) while preserving existing fabric and texture. If "needs_reconstruction": complete editorial product photograph prompt for the entire item on a neutral DressApp card background (#F5F2EB). Null if "complete".\n'
    "}\n\n"
    "Style rules for the free-text fields (`name`, `title`, `caption`, "
    "`tags`, `repair_advice`):\n"
    "  1. LANGUAGE \u2014 honour the OUTPUT LANGUAGE specified at the "
    "top of the user message. It applies equally to short label-like "
    "fields (`name`, `title`) and long descriptive ones (`caption`). "
    "JSON keys and the listed enum tokens always stay in English.\n"
    "  2. CONFIDENCE \u2014 state observations directly. Never hedge "
    "with \"seems\", \"appears\", \"probably\", \"looks like\", "
    "\"might be\", \"possibly\", \"kind of\". You are the expert; "
    "commit to the call. \"There's a cute cat print.\" not \"There "
    "seems to be an animal print, probably a cat.\"\n"
    "  3. UNIQUENESS \u2014 `name` and `title` must be distinguishing. "
    "Imagine the user already owns ten black tees; pick a detail no "
    "other shirt in a closet would share (texture, weight, neckline, "
    "wash, hardware, vibe, era).\n"
    "  4. VOICE — thoughtful editor, never salesy, never robotic. "
    "No emojis, no markdown, no hashtags, no #tags inside text "
    "fields.\n"
    "  5. FIELD RULES:\n"
    "     • pattern: If the garment has printed text, slogans, artwork, graphics, typography, or illustrations, set pattern=\"graphic\". Only use \"solid\" if there is no graphic or pattern.\n"
    "     • season: If the piece is versatile and wearable year-round (e.g. standard t-shirt, jeans, hoodie, sneakers), return [\"all\"]. Only restrict to specific seasons if clearly weather-bound (e.g. heavy winter down parka, summer swimwear).\n"
    "     • gender: Default to \"unisex\" for standard t-shirts, hoodies, and casual pieces unless tailored explicitly for men or women.\n"
    "  6. CANONICAL TAXONOMY RULES (STRICTLY BANNED SYNONYMS):\n"
    "     Always use standard DressApp taxonomy terms; never use regional, colloquial, or dialectal synonyms:\n"
    "     • Knitwear: ALWAYS use 'Sweater' or 'Cardigan'. NEVER use 'jumper', 'jersey', 'pullover', or 'knit'.\n"
    "     • Legwear: ALWAYS use 'Pants', 'Jeans', 'Shorts', or 'Leggings'. NEVER use 'trousers', 'slacks', or 'dungarees'.\n"
    "     • Tops: ALWAYS use 'Shirt', 'T-Shirt', 'Blouse', 'Tank Top', or 'Hoodie'. NEVER use 'vest' for tank tops, 'chemise', or 'singlet'.\n"
    "     • Outerwear: ALWAYS use 'Jacket', 'Coat', or 'Blazer'. NEVER use 'mackintosh', 'anorak', 'windcheater', or 'overcoat'.\n"
    "     • Footwear: ALWAYS use 'Sneakers', 'Boots', 'Loafers', 'Sandals', or 'Flats'. NEVER use 'trainers', 'tennis shoes', or 'plimsolls'."
)


# ─────────────────────────────────────────────────────────────────────
# Phase O.6 — single-pass-only suffix
# ─────────────────────────────────────────────────────────────────────
# Appended to ``SYSTEM_PROMPT`` ONLY when the caller is the single-pass
# pipeline (``EYES_ONE_PASS=true`` or the ``analyze_outfit_one_pass``
# helper). Teaches Eyes to additionally emit a ``region`` object with
# a tightly-fitted bbox on the 0..1000 normalised grid for every
# garment. Crucially we keep this OUT of the legacy ``SYSTEM_PROMPT``
# so:
#   1. legacy multi-call path keeps validating against the existing
#      schema (region is optional in the schema, never required there);
#   2. legacy LoRA evaluation runs are unaffected (no prompt drift);
#   3. the one-pass change can be A/B'd without a deploy.
#
# One-shot example included so Gemma-4 E2B can pattern-match the grid
# convention without needing a fine-tune (Option α per the proposal).
SYSTEM_PROMPT_ONE_PASS_SUFFIX = (
    "\n\n"
    "ADDITIONAL OUTPUT REQUIREMENT \u2014 spatial region.\n"
    "For EACH garment object you return, include a `region` block:\n"
    "  region: {\n"
    "    bbox: [ymin, xmin, ymax, xmax],   // integers on a 0..1000 grid\n"
    "    confidence: number 0..1 (optional),\n"
    "    is_full_frame: boolean (optional)\n"
    "  }\n"
    "Rules for `bbox`:\n"
    "  \u2022 Coordinates are normalised: 0 is the top/left edge, 1000 is "
    "the bottom/right edge. Use integers; ignore the source pixel size.\n"
    "  \u2022 Tightly enclose the visible garment, INCLUDING sleeves, "
    "collars, hems. EXCLUDE the wearer's face and bare skin.\n"
    "  \u2022 If the photo is a clean, single-garment shot (flat lay, "
    "studio still, ghost mannequin) and there is no other garment in "
    "frame, set `region.bbox = [0, 0, 1000, 1000]` and "
    "`region.is_full_frame = true`. This is the common case.\n"
    "  \u2022 If multiple garments overlap, each garment's bbox encloses "
    "ONLY that garment (the bboxes may overlap each other).\n"
    "  \u2022 If a garment is mostly occluded (less than ~20% visible), "
    "omit it from the output entirely \u2014 do not return a near-empty "
    "bbox.\n"
    "\n"
    "Worked example. Input: a full-length photo of a person wearing a "
    "white t-shirt tucked into blue jeans, plus white sneakers. "
    "Correct output (truncated for clarity):\n"
    "  [\n"
    "    { \"title\": \"White crew tee\", "
    "\"category\": \"Top\", "
    "\"region\": {\"bbox\": [180, 280, 520, 720], \"confidence\": 0.92, "
    "\"is_full_frame\": false} },\n"
    "    { \"title\": \"Blue straight jeans\", "
    "\"category\": \"Bottom\", "
    "\"region\": {\"bbox\": [520, 290, 880, 720], \"confidence\": 0.94, "
    "\"is_full_frame\": false} },\n"
    "    { \"title\": \"White low-top sneakers\", "
    "\"category\": \"Footwear\", "
    "\"region\": {\"bbox\": [880, 320, 985, 700], \"confidence\": 0.88, "
    "\"is_full_frame\": false} }\n"
    "  ]"
)


def _build_system_prompt(*, one_pass: bool) -> str:
    """Return the full system prompt for an Eyes call.

    ``one_pass=False`` returns the legacy prompt verbatim so existing
    callers (per-crop analysis, reconstruction re-validate, the old
    ``analyze_outfit``) keep working bit-for-bit. ``one_pass=True``
    appends the bbox-emission rules + one-shot example.
    """
    if one_pass:
        return SYSTEM_PROMPT + SYSTEM_PROMPT_ONE_PASS_SUFFIX
    return SYSTEM_PROMPT


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
                "solid", "striped", "plaid", "floral", "herringbone",
                "polka", "polka_dot", "paisley", "geometric", "animal_print",
                "graphic", "tie_dye", "abstract",
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


def _user_prompt(code: str | None) -> str:
    """Build the user-message prompt for ``analyze()``."""
    base = (
        "Analyse this photograph. If one garment is visible return a single "
        "JSON object; if multiple garments are visible return a JSON array "
        "of such objects. No commentary."
    )
    code = (code or "en").lower()
    if code == "en":
        return base
    lang_name = _LANG_NAMES.get(code, code)
    if code in ("he", "iw"):
        directive = (
            "**OUTPUT LANGUAGE = Hebrew (עברית).** Every free-text field "
            "(`name`, `title`, `caption`, `tags`, `repair_advice`, "
            "`sub_category`, `item_type`, `colors[*].name`, "
            "`fabric_materials[*].name`) MUST be written in fluent, "
            "idiomatic modern Hebrew using standard Hebrew Unicode characters "
            "(e.g. מכנסי קרגו, חולצת טי, שמלת מקסי, ג'ינס). Do not use non-Hebrew "
            "diacritics, Yiddish ligatures, or transliteration characters from other scripts. "
            "JSON keys and enum tokens (`category`, `gender`, `dress_code`, "
            "`season`, `pattern`, `state`, `condition`, `quality`) stay in English.\n\n"
        )
    elif code == "ar":
        directive = (
            "**OUTPUT LANGUAGE = Arabic (العربية).** Every free-text field "
            "(`name`, `title`, `caption`, `tags`, `repair_advice`, "
            "`sub_category`, `item_type`, `colors[*].name`, "
            "`fabric_materials[*].name`) MUST be written in fluent, "
            "idiomatic modern Arabic using standard Arabic script. "
            "JSON keys and enum tokens (`category`, `gender`, `dress_code`, "
            "`season`, `pattern`, `state`, `condition`, `quality`) stay in English.\n\n"
        )
    else:
        directive = (
            f"**OUTPUT LANGUAGE = {lang_name} ({code}).** Every free-text "
            f"field (`name`, `title`, `caption`, `tags`, `repair_advice`, "
            f"`sub_category`, `item_type`, `colors[*].name`, "
            f"`fabric_materials[*].name`) MUST be written in fluent, "
            f"idiomatic {lang_name}. JSON keys and enum tokens "
            f"(`category`, `gender`, `dress_code`, `season`, `pattern`, "
            f"`state`, `condition`, `quality`) stay in English.\n\n"
        )
    return directive + base


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
        return {}


GROUP_ANALYZE_SYSTEM_PROMPT = (
    "You are The Eyes — DressApp's visual garment group analyzer.\n"
    "You are given multiple images representing different views of the SAME single garment, "
    "along with their current metadata (analysis details) and aspect ratios (width/height).\n"
    "One item is designated as the 'host' (the master item, usually the frontal view), "
    "and the others are 'members' (fine-tuning details, usually back or profile views).\n\n"
    "Your tasks are:\n"
    "1. Identify the view of each image:\n"
    "   - One image is the frontal view (the host). Tag it as 'Front'.\n"
    "   - Back views of the garment must be tagged as 'Back'.\n"
    "   - Profile/side views of the garment (often identified by a narrow tall aspect ratio/image) must be tagged as 'Profile'.\n"
    "2. Compare and refine metadata across all items in the group:\n"
    "   - The host item's properties should be enhanced/corrected using details visible in other views (e.g. if a back view reveals an exposed back, update host tags/caption to reflect that).\n"
    "   - Correct the member items' metadata if the initial analysis was inaccurate (e.g. if the back view of a dress was initially analyzed as a frontal 'Deep U decolletage dress', correct its description, item_type, category, etc., to align with being the back view of the garment).\n"
    "3. Add the corresponding tag ('Front' for host, 'Back' for back view, 'Profile' for profile view) to each item's `tags` array.\n\n"
    "Return a JSON object containing updates for each item in the group, keyed by their item ID, in the following shape:\n"
    "{\n"
    "  \"items\": [\n"
    "    {\n"
    "      \"id\": string,                   // The ID of the item\n"
    "      \"group_role\": \"host\"|\"member\",\n"
    "      \"view_tag\": \"Front\"|\"Back\"|\"Profile\",\n"
    "      \"updates\": {\n"
    "        \"title\": string,\n"
    "        \"name\": string,\n"
    "        \"caption\": string,\n"
    "        \"category\": string,\n"
    "        \"sub_category\": string,\n"
    "        \"item_type\": string,\n"
    "        \"brand\": string|null,\n"
    "        \"gender\": \"men\"|\"women\"|\"unisex\"|\"kids\",\n"
    "        \"dress_code\": \"casual\"|\"smart-casual\"|\"business\"|\"formal\"|\"athletic\"|\"loungewear\",\n"
    "        \"season\": string[],\n"
    "        \"tradition\": string|null,\n"
    "        \"colors\": [{\"name\": string, \"pct\": integer}],\n"
    "        \"fabric_materials\": [{\"name\": string, \"pct\": integer}],\n"
    "        \"pattern\": string,\n"
    "        \"state\": \"new\"|\"used\",\n"
    "        \"condition\": \"bad\"|\"fair\"|\"good\"|\"excellent\",\n"
    "        \"quality\": \"budget\"|\"mid\"|\"premium\"|\"luxury\",\n"
    "        \"tags\": string[]\n"
    "      }\n"
    "    },\n"
    "    ...\n"
    "  ]\n"
    "}\n\n"
    "Rules:\n"
    "- You only need to include fields in `updates` if they need to be updated/corrected. You MUST include `tags` containing the appropriate view tag ('Front', 'Back', 'Profile') along with any other tags for the item.\n"
    "- Ensure all text is returned in the requested output language."
)


DETECT_SYSTEM_PROMPT = (
    "You are DressApp's object detector. Look at a photo and enumerate EVERY "
    "visible fashion item \u2014 garments, outerwear, footwear, bags, "
    "accessories (belts, scarves, hats, glasses), and jewelry (rings, "
    "necklaces, earrings, watches). Do not guess things that are not "
    "clearly visible. Ignore the person, skin, hair, and background.\n\n"
    "CRITICAL RULES:\n"
    "- Return **exactly one** bounding box per distinct physical item. "
    "Never output multiple boxes for the same piece (e.g. do not return "
    "both a \"shirt\" box and a \"sleeve\" box for the same shirt).\n"
    "- If you are uncertain whether two regions are the same garment, "
    "merge them into a single box that covers both.\n"
    "- Footwear & Pairs: A pair (boots, shoes, sneakers, earrings, gloves) counts as ONE item — "
    "use a single bounding box that encloses BOTH boots/shoes in the pair (even if one is diagonally behind or partially occluded).\n"
    "- Bags and purses: Return the bounding box around the BAG/PURSE BODY itself. "
    "Do NOT extend the box up along long shoulder straps to the shoulder/neck, so the crop cleanly captures the handbag.\n"
    "- Do NOT include a full-frame box covering the whole outfit — only individual items.\n\n"
    "For each item, return a tight bounding box in normalized coordinates "
    "on a 0\u20131000 scale (where 0 is top/left and 1000 is bottom/right), "
    "using Gemini's standard ``[ymin, xmin, ymax, xmax]`` order.\n\n"
    "Return ONLY a JSON object of the form:\n"
    '{\n'
    '  "items": [\n'
    '    {\n'
    '      "label": "short lowercase tag like \'oxford shirt\' or \'gold watch\'",\n'
    '      "kind": "garment"|"outerwear"|"footwear"|"bag"|"accessory"|"jewelry",\n'
    '      "bbox": [ymin, xmin, ymax, xmax]   // integers, 0\u20131000\n'
    '    }\n'
    '  ]\n'
    '}\n'
    "If only a single item fills the frame, return exactly one entry. "
    "Never return an empty list \u2014 if you cannot confidently detect "
    "anything, return a single entry covering the whole frame with "
    'label="garment" and kind="garment".'
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


def _build_batch_prompts(
    *,
    n: int,
    language: str | None,
    kind_hints: list[str | None] | None = None,
) -> tuple[str, str]:
    """Build ``(system_prompt, user_text)`` for a batched garment analysis.

    Used by both the one-shot batched path
    (:meth:`GarmentVisionService.analyze_batch`) and the streaming
    batched path (:meth:`GarmentVisionService.analyze_batch_stream`).
    The image parts themselves are constructed at the call site, since
    the native google-genai SDK accepts raw bytes / PIL images directly
    and we don't need to reshape them into OpenAI ``image_url`` blocks
    any more.

    Patch M21 (May 2026) — ``kind_hints`` is a list of per-crop
    SegFormer kind strings (or ``None`` for crops without a hint).
    When provided, the system prompt is decorated with a numbered
    "CROP CATEGORY HINTS" block telling Gemini what each image has
    been pre-classified as. This is layer 1 of the SegFormer-anchored
    category enforcement — layer 2 is the post-validation in
    :func:`_enforce_segformer_category` which catches the cases where
    Gemini ignores the hint.
    """
    # are supplied. We deliberately only emit the block when there's
    # at least one usable hint AND we have multiple crops (n > 1).
    # If there's only 1 crop, there are no adjacent garments to leak,
    # so we let Gemini make its own decision without being forced.
    hint_block = ""
    if n > 1 and kind_hints and len(kind_hints) == n:
        bullets: list[str] = []
        for i, k in enumerate(kind_hints, 1):
            if not k:
                continue
            human = _SEGFORMER_KIND_HUMAN_LABEL.get(k.strip().lower())
            if not human:
                continue
            bullets.append(f"  - Image {i}: pre-classified as {human}.")
        if bullets:
            hint_block = (
                "\n\nCROP CATEGORY HINTS — Each image below has been "
                "pre-classified by a per-pixel garment segmentation "
                "model that is highly reliable on the dominant pixels "
                "of each crop. Use these hints to anchor your "
                "`category` assignment when adjacent garments leak "
                "into the crop frame:\n"
                + "\n".join(bullets)
                + "\n\nIf a hint says 'Bottom', the dominant garment "
                "IS a bottom (pants / skirt / shorts), even if a "
                "sleeve, hem, or coat tail from an adjacent garment "
                "is partially visible. Same logic applies to "
                "Footwear, Full Body, Headwear, and Accessory hints. "
                "Honour these hints; choose `sub_category` from "
                "within the hinted top-level category."
            )
    user_text = (
        f"Analyse the {n} cropped garment image(s) below in order. "
        f"Return a JSON array of {n} GarmentAnalysis entries."
    )
    code = (language or "en").lower()
    if code != "en":
        lang_name = _LANG_NAMES.get(code, code)
        if code in ("he", "iw"):
            directive = (
                "**OUTPUT LANGUAGE = Hebrew (עברית).** Every free-text field "
                "(`name`, `title`, `caption`, `tags`, `repair_advice`, "
                "`sub_category`, `item_type`, `colors[*].name`, "
                "`fabric_materials[*].name`) MUST be written in fluent, "
                "idiomatic modern Hebrew using standard Hebrew Unicode characters "
                "(e.g. מכנסי קרגו, חולצת טי, שמלת מקסי, ג'ינס). Do not use non-Hebrew "
                "diacritics, Yiddish ligatures, or transliteration characters from other scripts. "
                "JSON keys and enum tokens (`category`, `gender`, `dress_code`, "
                "`season`, `pattern`, `state`, `condition`, `quality`) stay in English.\n\n"
            )
        elif code == "ar":
            directive = (
                "**OUTPUT LANGUAGE = Arabic (العربية).** Every free-text field "
                "(`name`, `title`, `caption`, `tags`, `repair_advice`, "
                "`sub_category`, `item_type`, `colors[*].name`, "
                "`fabric_materials[*].name`) MUST be written in fluent, "
                "idiomatic modern Arabic using standard Arabic script. "
                "JSON keys and enum tokens (`category`, `gender`, `dress_code`, "
                "`season`, `pattern`, `state`, `condition`, `quality`) stay in English.\n\n"
            )
        else:
            directive = (
                f"**OUTPUT LANGUAGE = {lang_name} ({code}).** Every free-text "
                f"field (`name`, `title`, `caption`, `tags`, `repair_advice`, "
                f"`sub_category`, `item_type`, `colors[*].name`, "
                f"`fabric_materials[*].name`) MUST be written in fluent, "
                f"idiomatic {lang_name}. JSON keys and enum tokens "
                f"(`category`, `gender`, `dress_code`, `season`, `pattern`, "
                f"`state`, `condition`, `quality`) stay in English.\n\n"
            )
        user_text = directive + user_text

    system_prompt = (
        _build_system_prompt(one_pass=False)
        + _language_directive(language)
        + (
            "\n\nBATCH MODE — You will be given multiple cropped "
            "garment photographs in a single message. They appear "
            "in numbered order (image 1, image 2, ...). You MUST "
            f"return a JSON ARRAY of EXACTLY {n} objects, one "
            "per crop, in the same order, each following the "
            "GarmentAnalysis schema described above. Do NOT "
            "merge crops, do NOT skip crops, do NOT add explanatory "
            "text outside the array. The response MUST start with "
            "`[` and end with `]`."
        )
        + hint_block
    )
    return system_prompt, user_text


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
                "solid", "striped", "plaid", "floral", "herringbone",
                "polka", "polka_dot", "paisley", "geometric", "animal_print",
                "graphic", "tie_dye", "abstract",
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


EYES_JSON_SCHEMA: dict[str, Any] = {
    "oneOf": [
        _GARMENT_OBJECT_SCHEMA,
        {
            "type": "array",
            "items": _GARMENT_OBJECT_SCHEMA,
        },
    ],
}


_SEGFORMER_KIND_HUMAN_LABEL: dict[str, str] = {
    "top": "Top or Outerwear (upper-body garment)",
    "bottom": "Bottom (pants / skirt / shorts)",
    "dress": "Full Body (dress / jumpsuit)",
    "footwear": "Footwear (shoes / boots / sneakers)",
    "accessory": "Accessories (belt / scarf / sunglasses / bag)",
    "headwear": "Accessories (hat / cap / beanie)",
}


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
            'Identify the garment:\n'
            '- name: 2-5 unique, distinguishing words (e.g. "heavyweight boxy tee", "hooded windbreaker")\n'
            '- title: short fallback title matching name (e.g. "Boxy Tee", "Windbreaker Jacket")\n'
            '- category: Top | Bottom | Outerwear | Full Body | Footwear | Accessories | Underwear\n'
            '- sub_category: e.g. Shirt, Pants, Jacket, Dress, Sneakers\n'
            '- item_type: specific type, e.g. Oxford shirt, Bomber jacket, Parka'
        )
    ),
    (
        "visual",
        ["colors", "pattern", "fabric_materials"],
        320,
        (
            'Analyze visual properties:\n'
            '- colors: list of [{"name": "color name", "pct": 0-100}] summing to 100\n'
            '- pattern: solid | striped | plaid | floral | herringbone | polka_dot | paisley | geometric | animal_print | graphic | tie_dye | abstract\n'
            '- fabric_materials: list of [{"name": "fabric", "pct": 0-100}] summing to 100 (infer composition)'
        )
    ),
    (
        "context",
        ["gender", "dress_code", "season", "tradition"],
        120,
        (
            'Analyze context of use:\n'
            '- gender: men | women | unisex | kids\n'
            '- dress_code: casual | smart-casual | business | formal | athletic | loungewear\n'
            '- season: array of spring, summer, fall, winter, all\n'
            '- tradition: cultural/religious style if clearly visible (e.g. arabic, jewish, indian), else null'
        )
    ),
    (
        "condition",
        ["state", "condition", "quality", "size", "brand"],
        160,
        (
            'Analyze physical condition:\n'
            '- state: new | used\n'
            '- condition: bad | fair | good | excellent\n'
            '- quality: budget | mid | premium | luxury\n'
            '- size: readable size label/tag in photo, else null\n'
            '- brand: legibly visible brand name, else null'
        )
    ),
    (
        "narrative",
        ["caption", "price_cents", "repair_advice", "tags"],
        520,
        (
            'Generate narrative fields:\n'
            '- caption: ONE confident vivid sentence (max 240 chars) describing silhouette and key details. No hedging!\n'
            '- price_cents: estimated resale value in USD cents as integer, or null\n'
            '- repair_advice: short actionable restoration tip if condition is bad, else null\n'
            '- tags: array of 3 to 8 searchable keywords'
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

        first_part = "You are The Eyes — DressApp's visual garment analyst. Your job is to describe the garment in the photo in exhaustive, merchandisable detail for an Add-Item form. Be confident, concise, and never invent brand names or details that are not visible.\n"
        if request_id:
            first_part = f"Request ID: {request_id}\n\n" + first_part

        sys_parts = [
            first_part,
            "Style Rules:\n"
            "- CONFIDENCE: Do not hedge (do not use 'seems', 'appears', 'looks like', 'probably'). State observations directly.\n"
            "- VOICE: Thoughtful, professional editor. No markdown, emojis, or sales pitch.\n"
            "- UNIQUE NAME: 'name' must be 3-5 unique, specific, descriptive fashion words (e.g. 'Cognac Leather Slouch Knee-High Boots', 'Minimalist Black Sleeveless Trench Dress', 'Olive Tan Leather Waist Belt', 'Double-Breasted Wool Long Coat'). NEVER output only the subcategory name or generic words!\n"
            "- ITEM TYPE: 'item_type' must be the specific garment cut or style (e.g. 'Double-Breasted Coat', 'Tailored Coat', 'Trench Coat', 'Knee-High Boots', 'Waist Belt', 'Crossbody Bag'). NEVER leave blank.\n"
            "- OUTERWEAR VS DRESS: Long garments with structured lapels, double-breasted buttons, tailored trench cuts, heavy wool, or coats/jackets MUST be classified as Category: 'Outerwear' (sub_category: 'Coats', item_type: e.g. 'Double-Breasted Coat' or 'Tailored Coat'). They are NOT dresses! Only indoor single-piece dresses or gowns belong in Category: 'Full Body' (sub_category: 'Dresses').\n"
            "- FOOTWEAR: For footwear, always use plural nouns ('Boots', 'Knee-High Boots', 'Loafers', 'Sneakers') and describe both boots/shoes in the pair. If shafts rise up the leg, label as 'Knee-High Boots' or 'Tall Boots'. NEVER output singular 'Boot' or 'Shoe'.\n"
            "- GENDER: If worn by a female model or styled for women (e.g. dress, women's heeled boots, women's handbag, waist belt), set gender to 'women'. Do NOT lazily classify as 'unisex'.\n"
            "- RICH COLORS: Use precise, high-fashion color nuances (e.g. 'Cognac', 'Tan', 'Espresso', 'Chestnut', 'Camel', 'Olive-Tan', 'Charcoal', 'Jet Black', 'Gold') rather than basic flat colors ('Brown', 'Black').\n"
            "- MATERIALS: Visually inspect texture, grain, and structure to infer primary composition (e.g. 'Leather', 'Cotton', 'Wool', 'Silk', 'Denim'). NEVER output 'Unknown'.\n"
            "- SEASON: Every item MUST include a populated 'season' array with at least 1 valid value ('spring', 'summer', 'fall', 'winter', or 'all'). E.g., heavy wool coats or boots are ['fall', 'winter']; leather belts, bags, and versatile basics are ['all']; lightweight summer dresses are ['spring', 'summer']. NEVER return an empty list or null.\n"
            "- CAPTION: Provide an elegant, 1-2 sentence editorial caption describing the garment's silhouette, styling versatility, craftsmanship, and prominent design details. NEVER leave empty or null.\n"
            "- BOTTOMS & SHORTS: For shorts, skirts, or pants, identify the specific cut, rise, and silhouette (e.g. 'High-Rise Distressed Denim Shorts', 'Tailored Pleated Bermuda Shorts', 'Relaxed Cargo Shorts', 'Drawstring Linen Shorts'). Note the rise, pocket style, hem treatment (cuffed, raw, frayed), and silhouette. NEVER output generic 'Shorts' or 'Pants' alone!\n"
            "- TOPS & SHIRTS: For tops, specify the neckline (crewneck, V-neck, scoop, collar), sleeve length (short-sleeve, sleeveless, long-sleeve), and fit (oversized, slim-fit, boxy, cropped).\n"
            "- TERMINOLOGY: Use standard global fashion terms (e.g. 'Sweater' instead of 'Jumper', 'Pants' or 'Trousers', 'Sneakers'). Strictly output raw JSON with NO conversational prefixes (never say 'Here is the clothing item:' or any conversational introduction)."
        ]

        if segformer_category and not is_single_item:
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
                sys_parts.append(
                    f"- CATEGORY HINT: Semantic segmentation suggested Category: '{mapped_cat}' (SegFormer label: '{segformer_label}'). "
                    "Visually verify the garment: if it has coat lapels, double-breasted buttons, or overcoat structure, classify it as Category: 'Outerwear' (sub_category: 'Coats'). If it is a standalone dress, classify it as Category: 'Full Body' (sub_category: 'Dresses')."
                )

        if lang_code in ("he", "iw"):
            sys_parts.append(
                "- LANGUAGE: OUTPUT LANGUAGE = Hebrew (עברית). Every free-text field "
                "(`name`, `title`, `caption`, `tags`, `sub_category`, `item_type`, "
                "`colors[*].name`, `fabric_materials[*].name`) MUST be written in fluent, "
                "idiomatic modern Hebrew (e.g. מכנסיים קצרים, ג'ינס, כותנה, כחול כהה). "
                "JSON keys and enum tokens stay in English."
            )
        elif lang_name:
            sys_parts.append(f"- LANGUAGE: All free-text values must be written in fluent {lang_name}.")

        sys_parts.append("Return ONLY the JSON object. No markdown, no commentary.")
        system_prompt = "\n".join(sys_parts)

        lang_suffix = " Respond in Hebrew (עברית) for all free-text fields." if lang_code in ("he", "iw") else (f" Respond in {lang_name} for all free-text fields." if lang_name else "")
        user_text = f"Analyse this garment photo and return JSON for the following fields: {', '.join(all_field_names)}.{lang_suffix}"
        if request_id:
            user_text = f"Analyse this garment photo (Request ID: {request_id}) and return JSON for the following fields: {', '.join(all_field_names)}.{lang_suffix}"

        import copy
        properties = {}
        is_coarse_seg = (segformer_label or "").lower().strip() in ("upper-clothes", "upper_clothes", "lower-clothes", "lower_clothes", "garment", "clothing", "item")
        for name in all_field_names:
            if name in _GARMENT_OBJECT_SCHEMA["properties"]:
                prop = copy.deepcopy(_GARMENT_OBJECT_SCHEMA["properties"][name])
                if name == "category" and segformer_category and not is_single_item and not is_coarse_seg:
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

                if isinstance(prop, dict):
                    p_type = prop.get("type")
                    if p_type == "string" and "maxLength" not in prop and "enum" not in prop:
                        prop["maxLength"] = 16 if name == "size" else 36
                    elif isinstance(p_type, list) and "string" in p_type and "maxLength" not in prop:
                        prop["maxLength"] = 16 if name == "size" else 36

                    if name == "caption":
                        prop["minLength"] = 10
                        prop["maxLength"] = 240

                    if p_type == "array" and "items" in prop:
                        if name == "season":
                            prop["minItems"] = 1
                            prop["maxItems"] = 4
                        elif name == "colors":
                            prop["maxItems"] = 4
                        elif name == "fabric_materials":
                            prop["maxItems"] = 3
                        elif name == "tags":
                            prop["maxItems"] = 6

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

        full_schema = {
            "type": "object",
            "properties": properties,
            "required": [
                "name", "title", "category", "sub_category", "item_type",
                "colors", "pattern", "gender", "fabric_materials", "season", "caption"
            ],
            "additionalProperties": False,
        }

        try:
            timeout_single = max(180.0, float(settings.EYES_GEMMA_TIMEOUT_S))
            raw = await _call_gemma_space(
                system_prompt=system_prompt,
                user_text=user_text,
                image_b64_jpeg=image_b64_jpeg,
                max_tokens=700,
                temperature=0.0,
                timeout=timeout_single,
                json_schema=full_schema,
                id_slot=id_slot,
            )
            parsed = _extract_json(raw)
            if isinstance(parsed, list) and parsed:
                parsed = parsed[0]
            if isinstance(parsed, dict) and len(parsed) >= 3:
                parsed = _coerce_single_garment(parsed)
                parsed = _coerce_enums(parsed)
                for group_name, field_names, _, _ in ATTRIBUTE_GROUPS:
                    filtered = {k: v for k, v in parsed.items() if k in field_names}
                    yield group_name, field_names, filtered
                return
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemma single-pass failed (%s); falling back to sequential groups", exc)

    for group_name, field_names, max_tokens, sys_snippet in ATTRIBUTE_GROUPS:
        # Build stitched system prompt: Header + Style Rules (Common & Identical across groups to hit cache)
        first_part = "You are The Eyes — DressApp's visual garment analyst. Your job is to describe the garment in the photo in exhaustive, merchandisable detail for an Add-Item form. Be confident, concise, and never invent brand names or details that are not visible.\n"
        if request_id:
            first_part = f"Request ID: {request_id}\n\n" + first_part

        sys_parts = [
            first_part,
            "Style Rules:\n"
            "- CONFIDENCE: Do not hedge (do not use 'seems', 'appears', 'looks like', 'probably'). State observations directly.\n"
            "- VOICE: Thoughtful, professional editor. No markdown, emojis, or sales pitch.\n"
            "- UNIQUE NAME: 'name' must be 3-5 unique, specific, descriptive fashion words (e.g. 'Cognac Leather Slouch Knee-High Boots', 'Minimalist Black Sleeveless Trench Dress', 'Olive Tan Leather Waist Belt', 'Double-Breasted Wool Long Coat'). NEVER output only the subcategory name or generic words!\n"
            "- ITEM TYPE: 'item_type' must be the specific garment cut or style (e.g. 'Double-Breasted Coat', 'Tailored Coat', 'Trench Coat', 'Knee-High Boots', 'Waist Belt', 'Crossbody Bag'). NEVER leave blank.\n"
            "- OUTERWEAR VS DRESS: Long garments with structured lapels, double-breasted buttons, tailored trench cuts, heavy wool, or coats/jackets MUST be classified as Category: 'Outerwear' (sub_category: 'Coats', item_type: e.g. 'Double-Breasted Coat' or 'Tailored Coat'). They are NOT dresses! Only indoor single-piece dresses or gowns belong in Category: 'Full Body' (sub_category: 'Dresses').\n"
            "- FOOTWEAR: For footwear, always use plural nouns ('Boots', 'Knee-High Boots', 'Loafers', 'Sneakers') and describe both boots/shoes in the pair. If shafts rise up the leg, label as 'Knee-High Boots' or 'Tall Boots'. NEVER output singular 'Boot' or 'Shoe'.\n"
            "- GENDER: If worn by a female model or styled for women (e.g. dress, women's heeled boots, women's handbag, waist belt), set gender to 'women'. Do NOT lazily classify as 'unisex'.\n"
            "- RICH COLORS: Use precise, high-fashion color nuances (e.g. 'Cognac', 'Tan', 'Espresso', 'Chestnut', 'Camel', 'Olive-Tan', 'Charcoal', 'Jet Black', 'Gold') rather than basic flat colors ('Brown', 'Black').\n"
            "- MATERIALS: Visually inspect texture, grain, and structure to infer primary composition (e.g. 'Leather', 'Cotton', 'Wool', 'Silk', 'Denim'). NEVER output 'Unknown'.\n"
            "- SEASON: Every item MUST include a populated 'season' array with at least 1 valid value ('spring', 'summer', 'fall', 'winter', or 'all'). E.g., heavy wool coats or boots are ['fall', 'winter']; leather belts, bags, and versatile basics are ['all']; lightweight summer dresses are ['spring', 'summer']. NEVER return an empty list or null.\n"
            "- CAPTION: Provide an elegant, 1-2 sentence editorial caption describing the garment's silhouette, styling versatility, craftsmanship, and prominent design details. NEVER leave empty or null.\n"
            "- TERMINOLOGY: Use standard global fashion terms (e.g. 'Sweater' instead of 'Jumper', 'Pants' or 'Trousers', 'Sneakers'). Strictly output raw JSON with NO conversational prefixes (never say 'Here is the clothing item:' or any conversational introduction)."
        ]
        
        # Inject category restriction based on SegFormer detection (ONLY if NOT is_single_item)
        if segformer_category and not is_single_item:
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
                sys_parts.append(
                    f"- CATEGORY HINT: Semantic segmentation suggested Category: '{mapped_cat}' (SegFormer label: '{segformer_label}'). "
                    "Visually verify the garment: if it has coat lapels, double-breasted buttons, or overcoat structure, classify it as Category: 'Outerwear' (sub_category: 'Coats'). If it is a standalone dress, classify it as Category: 'Full Body' (sub_category: 'Dresses')."
                )

        # Add target language rule if applicable
        if lang_name:
            sys_parts.append(f"- LANGUAGE: All free-text values must be written in fluent {lang_name}.")
        
        sys_parts.append("Return ONLY the JSON object. No markdown, no commentary.")
        system_prompt = "\n".join(sys_parts)

        # Build group-specific user query (contains the changing group guidelines/fields)
        user_text = f"Analyse this garment photo and return JSON for the following fields: {', '.join(field_names)}.\n\nSpecific guidelines for these fields:\n{sys_snippet}"
        if request_id:
            user_text = f"Analyse this garment photo (Request ID: {request_id}) and return JSON for the following fields: {', '.join(field_names)}.\n\nSpecific guidelines for these fields:\n{sys_snippet}"

        # Build strict JSON schema for this group to grammar-constrain Gemma.
        import copy
        properties = {}
        for name in field_names:
            if name in _GARMENT_OBJECT_SCHEMA["properties"]:
                prop = copy.deepcopy(_GARMENT_OBJECT_SCHEMA["properties"][name])
                
                # Constrain category enum based on SegFormer pre-classification (ONLY if NOT is_single_item and NOT coarse label)
                is_coarse_seg = (segformer_label or "").lower().strip() in ("upper-clothes", "upper_clothes", "lower-clothes", "lower_clothes", "garment", "clothing", "item")
                if name == "category" and segformer_category and not is_single_item and not is_coarse_seg:
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

                # Enforce maxLength on string fields to prevent repetition loops
                if isinstance(prop, dict):
                    p_type = prop.get("type")
                    if p_type == "string" and "maxLength" not in prop and "enum" not in prop:
                        prop["maxLength"] = 16 if name == "size" else 36
                    elif isinstance(p_type, list) and "string" in p_type and "maxLength" not in prop:
                        prop["maxLength"] = 16 if name == "size" else 36

                    if name == "caption":
                        prop["minLength"] = 10
                        prop["maxLength"] = 240
                    
                    # Nested array properties (colors, fabric_materials, tags, season)
                    if p_type == "array" and "items" in prop:
                        if name == "season":
                            prop["minItems"] = 1
                            prop["maxItems"] = 4
                        elif name == "colors":
                            prop["maxItems"] = 4
                        elif name == "fabric_materials":
                            prop["maxItems"] = 3
                        elif name == "tags":
                            prop["maxItems"] = 6

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

        group_schema = {
            "type": "object",
            "properties": properties,
            "required": field_names,
            "additionalProperties": False,
        }

        try:
            raw = await _call_gemma_space(
                system_prompt=system_prompt,
                user_text=user_text,
                image_b64_jpeg=image_b64_jpeg,
                max_tokens=max_tokens,
                temperature=0.0,
                timeout=tpg,
                json_schema=group_schema,
                id_slot=id_slot,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "M23: Gemma attribute group %r failed: %s",
                group_name,
                repr(exc)[:200],
            )
            err_msg = str(exc)
            if any(k in err_msg for k in ("502", "503", "504", "All connection attempts failed", "ConnectError", "Connection refused")):
                raise
            yield group_name, field_names, {}
            continue

        try:
            parsed = _extract_json(raw)
            # Model may occasionally wrap results in a list — take first.
            if isinstance(parsed, list) and parsed:
                parsed = parsed[0]
            if not isinstance(parsed, dict):
                parsed = {}
            # Keep only the fields this group owns; discard hallucinated keys.
            filtered = {k: v for k, v in parsed.items() if k in field_names}
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "M23: Gemma attribute group %r parse error: %s",
                group_name,
                repr(exc)[:200],
            )
            filtered = {}

        logger.debug(
            "M23: Gemma group %r → keys=%s", group_name, list(filtered.keys()),
        )
        yield group_name, field_names, filtered
