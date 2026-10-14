"""Gemini 2.5 Pro styling brain via the Emergent Universal LLM Key.

Uses the `emergentintegrations` library. We create a **fresh LlmChat** for each
stylist call so session isolation is guaranteed. Conversation history is
persisted in MongoDB (`stylist_sessions`) and hydrated on subsequent calls.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

from app.config import settings
from app.services.gemini_client import DEFAULT_VISION_MODEL, GeminiClient

logger = logging.getLogger(__name__)

GEMINI_SYSTEM_PROMPT = """You are DressApp's Senior Fashion Designer & Celebrity Stylist.
Deliver expert, warm, practical advice grounded strictly in the user's closet, weather, calendar, and cultural constraints.

Output contract: Return ONLY a JSON object. No markdown, no prose outside JSON.
{
  "reasoning_summary": string, // Main chat response shown to the user. For outfit requests: 1-2 concise sentences explaining styling rationale and dress code. For wardrobe audit / missing essentials / comparison / Q&A requests: a comprehensive, well-structured answer (using '• ' bullet points when listing items or gaps).
  "outfit_recommendations": Array<{
    "name": string, // 2-5 words capturing outfit's essence and vibe (e.g. 'Sophisticated Wedding Guest', 'Refined Earthy Elegance', 'אלגנטיות חגיגית לחתונה'). NEVER use garment/bottom names or unowned cultural pieces.
    "items": Array<{ "role": "top"|"bottom"|"outerwear"|"shoes"|"accessory"|"dress"|"belt"|"headwear"|"glasses", "description": string, "closet_item_id": string | null }>,
    "why": string, // 1-2 punchy sentences on color/cut harmony and occasion fit
    "designer_notes": { "color_harmony": string, "texture_balance": string, "silhouette": string },
    "confidence": number // 0-1
  }>, // Return [] (empty array) when the user asks a pure text question, wardrobe audit, missing essentials list, garment comparison, or follow-up question that does NOT ask to curate an outfit!
  "shopping_suggestions": Array<string>, // For outfit requests: max 2 key missing pieces if closet lacks them (or []). For wardrobe audit / missing essentials queries: 4-7 specific missing wardrobe staples grounded in closet_inventory_analysis.detected_wardrobe_gaps. NEVER suggest items the user already owns. NO URLs.
  "do_dont": Array<string>, // Exactly 2 crisp bullets in target language (1 Do, 1 Don't)
  "spoken_reply": string // 1-2 warm conversational sentences summarizing your answer for voice playback
}

HARD RULES:
1. Intent Routing (Outfit Curation vs. Pure Text Q&A):
   • If the user asks to explore/audit their closet, check for missing essential/elementary garments, compile a recommended shopping/wardrobe completion list, compare garments, or asks a follow-up question that does NOT request wearing/curating an outfit: set "outfit_recommendations": [] and write a thorough, structured answer in "reasoning_summary" (and populate "shopping_suggestions" with specific missing essentials).
   • If the user asks what to wear or requests an outfit look: each look in "outfit_recommendations" MUST include (top+bottom OR dress) + shoes. Order: top/dress -> outerwear -> bottom -> shoes -> accessory. Match role to garment anatomy (never label shoes/pants as top; no duplicate bottoms).
2. Formality Degradation Hierarchy: Prioritize: 1) Formal (suits, blazers, dress shirts/trousers, formal kurtas/dresses, dress shoes). 2) If absent, degrade to Semi-Formal (collared shirts, fine knits, tailored chinos/slacks, leather loafers). 3) If absent, degrade to Smart Casual (neat button/polo shirts, clean dark non-distressed pants, neat shoes). Capture achieved formality in title and explain in spoken_reply/reasoning_summary.
3. Event Rules & Negative Restrictions: Ensure tasteful color harmony (festive rich tones for Hindu weddings; avoid stark funeral mourning white/all-black). For weddings/formal events: NEVER recommend cargo pants (with utility pockets), bomber jackets, athletic hoodies, graphic t-shirts, shorts, beach flip-flops, or heavy rugged combat/work boots!
4. Cultural & Weather Non-Negotiables: Adhere strictly to cultural rules and forecast weather.
5. Closet Grounding & Gender Conformance: Describe ONLY actual items and their real colors from closet_summary (no phantom pieces). Strictly respect user's gender/sex (never cross-gender garments). Rotate garments to provide distinct looks across recommendations. Integrate available closet accessories (belts, hats, glasses, bags).
6. Multi-turn Coherence: Carefully read CONVERSATION_HISTORY to resolve pronouns, follow-up requests (e.g. 'make a list', 'elaborate', 'what else is missing?'), maintain topic continuity, and answer user queries directly.
"""

SYSTEM_PROMPT = GEMINI_SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# Image-aware addendum (Phase S1)
# ---------------------------------------------------------------------------
# When the caller attaches one or more images via ``file_contents``, Gemini
# receives the bytes but the SYSTEM_PROMPT above is image-agnostic — it
# focuses entirely on text, closet, and context. The previous behaviour was
# that the model would silently ignore the photo and recommend outfits as
# if the user had asked a text-only question. This addendum is appended to
# the system message ONLY when image_base64 is present, so:
#
#   * text-only flows are unaffected (no prompt pollution).
#   * image flows get explicit (soft) instructions to consider the picture.
#
# Permissive language ("may reference", "do not need to mention") is by
# design — per the user's UX choice (Phase S, decision 4b), the image is
# **soft context**, not a hard anchor. The model is free to use or skip it
# based on what the user actually asked for.
_IMAGE_CONTEXT_ADDENDUM = """

IMAGE CONTEXT:
The user has attached one or more images. Treat them as additional context
about garments they are wearing, considering, or asking about. You MAY
reference visible elements (garment type, dominant color, fit, fabric,
silhouette) when it would make the recommendation more useful. Do NOT
invent details you cannot clearly see — if uncertain, prefer to say so or
ask. If the user's question is unrelated to the image, you do not need to
mention it. The image never overrides the closet summary or cultural
constraints below; it adds context to them.
"""


# Human-readable names for each supported UI language code — sourced from
# app.services.i18n so the frontend, backend prompts, system emails, and
# anything else stay in lock-step with a single dictionary.
from app.services import i18n as _i18n

_LANG_NAMES = _i18n.LANG_NAMES


def _language_directive(code: str | None) -> str:
    # Thin re-export so existing call-sites (stylist_brain etc.) keep working.
    return _i18n.language_directive(code)


def _compact_closet_summary(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not items:
        return []
    compact: list[dict[str, Any]] = []
    for it in items:
        colors = it.get("colors") or it.get("color")
        color_names = []
        if isinstance(colors, list):
            for c in colors:
                if isinstance(c, dict) and c.get("name"):
                    color_names.append(c["name"])
                elif isinstance(c, str):
                    color_names.append(c)
        elif isinstance(colors, str):
            color_names.append(colors)

        compact_item: dict[str, Any] = {
            "id": str(it.get("id") or it.get("_id") or ""),
            "name": it.get("title") or it.get("name") or "",
            "category": it.get("category"),
        }
        sub_cat = it.get("sub_category")
        if sub_cat:
            compact_item["sub_category"] = sub_cat
        gender = it.get("gender") or it.get("target_gender")
        if gender:
            compact_item["gender"] = gender
        if color_names:
            compact_item["colors"] = color_names
        if it.get("material"):
            compact_item["material"] = it.get("material")
        if it.get("dress_code"):
            compact_item["dress_code"] = it.get("dress_code")
        if it.get("season"):
            compact_item["season"] = it.get("season")
        pat = it.get("pattern")
        if pat and str(pat).lower() != "solid":
            compact_item["pattern"] = pat
        if it.get("tags"):
            compact_item["tags"] = it.get("tags")[:4]
        if it.get("brand"):
            compact_item["brand"] = it.get("brand")
        compact.append(compact_item)
    return compact


def _format_conversation_history_block(conv_hist: list[dict[str, Any]] | None) -> str:
    """Render recent conversation turns into a compact, readable dialogue transcript for multi-turn memory."""
    if not conv_hist or not isinstance(conv_hist, list):
        return ""
    lines: list[str] = []
    for idx, turn in enumerate(conv_hist[-8:], start=1):
        if not isinstance(turn, dict):
            continue
        role = str(turn.get("role") or "user").upper()
        transcript = str(turn.get("transcript") or "").strip()
        payload = turn.get("payload") or turn.get("assistant_payload") or {}
        if role == "USER":
            if transcript:
                lines.append(f"[{idx}] USER: {transcript}")
        else:
            spoken = str(payload.get("spoken_reply") or "").strip() if isinstance(payload, dict) else ""
            main_text = transcript or spoken
            shop = payload.get("shopping_suggestions") if isinstance(payload, dict) else None
            recs = payload.get("outfit_recommendations") if isinstance(payload, dict) else None
            extras: list[str] = []
            if isinstance(recs, list) and recs:
                rec_names = [str(r.get("name") or "") for r in recs if isinstance(r, dict) and r.get("name")]
                if rec_names:
                    extras.append(f"outfits_suggested={rec_names}")
            if isinstance(shop, list) and shop:
                extras.append(f"shopping_suggestions={shop}")
            extra_str = f" ({'; '.join(extras)})" if extras else ""
            if main_text or extra_str:
                lines.append(f"[{idx}] STYLIST: {main_text}{extra_str}")
    if not lines:
        return ""
    return "CONVERSATION_HISTORY (Recent turns in this chat session — maintain full context & continuity):\n" + "\n".join(lines) + "\n\n"


async def prepare_stylist_prompt(
    *,
    session_id: str | None = None,
    user_text: str | None = None,
    image_base64: str | None = None,
    weather: dict[str, Any] | None = None,
    calendar_events: list[dict[str, Any]] | None = None,
    cultural_rules: list[dict[str, Any]] | None = None,
    user_profile: dict[str, Any] | None = None,
    closet_summary: list[dict[str, Any]] | None = None,
    user_preferences_block: str | None = None,
    base_system_prompt: str | None = None,
) -> tuple[str, str]:
    """Build the system and user prompt strings for the stylist brain."""
    user_text = await parse_urls_and_context(user_text, session_id=session_id)
    sys_msg = base_system_prompt or GEMINI_SYSTEM_PROMPT
    if image_base64:
        sys_msg = sys_msg + _IMAGE_CONTEXT_ADDENDUM
        logger.info("gemini-stylist: image addendum applied session=%s", session_id)
    sys_msg = sys_msg + _language_directive(
        (user_profile or {}).get("preferred_language")
    )
    if user_preferences_block:
        sys_msg = sys_msg + "\n\n" + user_preferences_block.strip() + "\n"

    # Ground-Truth Fashion Knowledge Base & Modesty Gating
    from app.services.fashion_rules_rag import (
        filter_gender_closet_items,
        filter_modesty_closet_items,
        format_rules_for_prompt,
        retrieve_fashion_axioms,
    )
    from app.services.stylist_qa_engine import (
        build_closet_inventory_analysis,
        filter_candidate_closet_by_axioms,
        is_text_only_stylist_query,
    )

    clean_closet = filter_modesty_closet_items(
        closet_summary, (user_profile or {}).get("modesty_level")
    )
    user_gender = (user_profile or {}).get("sex") or (user_profile or {}).get("gender")
    clean_closet = filter_gender_closet_items(clean_closet, user_gender)
    first_evt = calendar_events[0].get("title") if (calendar_events and isinstance(calendar_events, list)) else None
    axioms = retrieve_fashion_axioms(
        user_profile=user_profile,
        weather=weather,
        occasion=first_evt,
        user_text=user_text,
        closet_summary=clean_closet,
        top_k=4,
    )
    axioms_text = format_rules_for_prompt(axioms)
    if axioms_text:
        sys_msg = sys_msg + "\n\n" + axioms_text + "\n"

    conv_hist = (user_profile or {}).get("conversation_history") if isinstance(user_profile, dict) else None
    text_only_mode = is_text_only_stylist_query(user_text, conv_hist)

    # Candidate closet pre-filter: Purge items violating retrieved RAG negative constraints before LLM inference
    # (Skip aggressive occasion pre-filtering when user is auditing/exploring their entire closet)
    if not text_only_mode:
        clean_closet, _ = filter_candidate_closet_by_axioms(
            clean_closet,
            axioms,
            user_profile=user_profile,
            user_gender=user_gender,
        )

    lang_code = ((user_profile or {}).get("preferred_language") or "en").lower()
    lang_name = _LANG_NAMES.get(lang_code, "English")

    inventory_analysis = build_closet_inventory_analysis(
        clean_closet, user_gender=user_gender, lang=lang_code
    )

    if text_only_mode:
        sys_msg = (
            sys_msg
            + "\n\nQUERY MODE — ANALYTICAL / WARDROBE EXPLORATION / MISSING ESSENTIALS Q&A (NO OUTFIT CURATION):\n"
            "The user is asking an analytical question about their wardrobe inventory, missing essential items, "
            "a recommended shopping/completion list, garment comparison, or a conversational follow-up — NOT asking to dress the mannequin.\n"
            "1. You MUST set \"outfit_recommendations\": [] (an empty array).\n"
            f"2. In \"reasoning_summary\", write a comprehensive, helpful, well-structured response in {lang_name} that directly answers the user's prompt "
            "(use '• ' bullet points when listing missing items, wardrobe categories, or comparisons, grounded in CONTEXT.closet_inventory_analysis).\n"
            f"3. In \"shopping_suggestions\", include 4 to 7 specific missing essential items in {lang_name} based on CONTEXT.closet_inventory_analysis.detected_wardrobe_gaps.\n"
            f"4. In \"spoken_reply\", provide a warm 1-2 sentence spoken summary in {lang_name}.\n"
        )

    safe_profile: dict[str, Any] = {}
    if user_profile:
        for k in ("name", "display_name", "preferred_language", "sex", "age_group", "body_measurements", "style_preferences", "modesty_level"):
            val = user_profile.get(k)
            if val is not None and val != "" and val != [] and val != {}:
                safe_profile[k] = val

    context_block: dict[str, Any] = {
        "weather": weather,
        "user_profile": safe_profile,
        "closet_inventory_analysis": inventory_analysis,
        "closet_summary": _compact_closet_summary(clean_closet),
    }
    if calendar_events:
        context_block["calendar_events"] = calendar_events
    if cultural_rules:
        context_block["cultural_rules"] = cultural_rules

    lang_preamble = (
        f"OUTPUT LANGUAGE: {lang_name} ({lang_code}). All text fields (reasoning_summary, outfit name/why, item description, do_dont, shopping_suggestions, spoken_reply) MUST be in fluent {lang_name}. Keep JSON keys and enums in English.\n\n"
    )
    history_block = _format_conversation_history_block(conv_hist)
    context_json = json.dumps(context_block, ensure_ascii=False, separators=(",", ":"), default=str)
    prompt_text = (
        f"{lang_preamble}"
        f"{history_block}"
        f"USER_REQUEST:\n{user_text}\n\n"
        f"CONTEXT:\n{context_json}\n\n"
        "Return the JSON object now."
    )
    return sys_msg, prompt_text


class GeminiStylistService:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        if not self.api_key:
            raise RuntimeError(
                "No Gemini API key available. Set GEMINI_API_KEY or provide user API key."
            )
        self.model = model or settings.DEFAULT_STYLIST_MODEL or "gemini-3.5-flash-lite"
        self.provider = settings.DEFAULT_STYLIST_PROVIDER
        self._client = GeminiClient(api_key=self.api_key)

    async def advise(
        self,
        session_id: str,
        user_text: str | None,
        image_base64: str | None,
        image_mime: str = "image/jpeg",
        weather: dict[str, Any] | None = None,
        calendar_events: list[dict[str, Any]] | None = None,
        cultural_rules: list[dict[str, Any]] | None = None,
        user_profile: dict[str, Any] | None = None,
        closet_summary: list[dict[str, Any]] | None = None,
        user_preferences_block: str | None = None,
    ) -> dict[str, Any]:
        sys_msg, prompt_text = await prepare_stylist_prompt(
            session_id=session_id,
            user_text=user_text,
            image_base64=image_base64,
            weather=weather,
            calendar_events=calendar_events,
            cultural_rules=cultural_rules,
            user_profile=user_profile,
            closet_summary=closet_summary,
            user_preferences_block=user_preferences_block,
        )

        # Build the user-parts list: text first, optional image second.
        # The native google-genai SDK accepts raw bytes via the wrapper
        # (which calls ``types.Part.from_bytes``), so decode the
        # historical base64 payload back to bytes once here.
        user_parts: list[Any] = [prompt_text]
        if image_base64:
            try:
                user_parts.append(base64.b64decode(image_base64))
            except Exception:  # noqa: BLE001
                # Bad base64 — proceed text-only so the stylist still
                # answers; the addendum block is now a no-op but the
                # advice is still actionable.
                logger.warning(
                    "gemini-stylist: failed to decode image_base64 "
                    "(session=%s) — proceeding text-only",
                    session_id,
                )

        logger.info(
            "Gemini stylist call session=%s model=%s has_image=%s",
            session_id,
            self.model,
            bool(image_base64),
        )
        from app.services import provider_activity

        with provider_activity.Track(
            "gemini-stylist", {"model": self.model, "has_image": bool(image_base64)}
        ):
            try:
                raw = await self._client.vision(
                    system=sys_msg,
                    user_parts=user_parts,
                    model=self.model,
                    response_mime_type="application/json",
                    max_tokens=2048,
                )
            except Exception as exc:
                if self.api_key and settings.GEMINI_API_KEY and self.api_key != settings.GEMINI_API_KEY:
                    logger.warning("Custom Gemini key failed (%s), falling back to system key", exc)
                    fallback_client = GeminiClient(api_key=settings.GEMINI_API_KEY)
                    raw = await fallback_client.vision(
                        system=sys_msg,
                        user_parts=user_parts,
                        model=self.model,
                        response_mime_type="application/json",
                        max_tokens=2048,
                    )
                else:
                    raise
        res = _parse_json(raw)
        lang = (user_profile or {}).get("preferred_language") or "en"
        return sanitize_stylist_payload(res, lang=lang, closet_summary=closet_summary)


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


_PREFIX_LOCALIZATIONS: dict[str, dict[str, str]] = {
    "he": {
        "do_not_wear": "אין ללבוש ",
        "do_wear": "מומלץ ללבוש ",
        "avoid_wearing": "להימנע מללבוש ",
        "do_colon": "כדאי: ",
        "dont_colon": "אין: ",
    },
    "ar": {
        "do_not_wear": "لا ترتدِ ",
        "do_wear": "يُفضل ارتداء ",
        "avoid_wearing": "تجنب ارتداء ",
        "do_colon": "افعل: ",
        "dont_colon": "لا تفعل: ",
    },
    "es": {
        "do_not_wear": "No usar ",
        "do_wear": "Se recomienda usar ",
        "avoid_wearing": "Evitar usar ",
        "do_colon": "Hacer: ",
        "dont_colon": "No hacer: ",
    },
    "fr": {
        "do_not_wear": "Ne pas porter ",
        "do_wear": "À privilégier : ",
        "avoid_wearing": "Évitez de porter ",
        "do_colon": "À faire : ",
        "dont_colon": "À éviter : ",
    },
    "de": {
        "do_not_wear": "Nicht tragen: ",
        "do_wear": "Empfohlen: ",
        "avoid_wearing": "Vermeide: ",
        "do_colon": "Empfehlung: ",
        "dont_colon": "Vermeiden: ",
    },
    "it": {
        "do_not_wear": "Non indossare ",
        "do_wear": "Consigliato indossare ",
        "avoid_wearing": "Evitare di indossare ",
        "do_colon": "Cosa fare: ",
        "dont_colon": "Da evitare: ",
    },
    "pt": {
        "do_not_wear": "Não usar ",
        "do_wear": "Recomenda-se usar ",
        "avoid_wearing": "Evite usar ",
        "do_colon": "Recomendado: ",
        "dont_colon": "Evitar: ",
    },
    "nl": {
        "do_not_wear": "Draag geen ",
        "do_wear": "Aanbevolen om te dragen: ",
        "avoid_wearing": "Vermijd het dragen van ",
        "do_colon": "Wel doen: ",
        "dont_colon": "Niet doen: ",
    },
    "ru": {
        "do_not_wear": "Не надевайте ",
        "do_wear": "Рекомендуется надеть ",
        "avoid_wearing": "Избегайте носить ",
        "do_colon": "Рекомендуется: ",
        "dont_colon": "Не рекомендуется: ",
    },
    "zh": {
        "do_not_wear": "请勿穿着 ",
        "do_wear": "建议穿着 ",
        "avoid_wearing": "避免穿着 ",
        "do_colon": "建议：",
        "dont_colon": "避免：",
    },
    "ja": {
        "do_not_wear": "着用を避ける: ",
        "do_wear": "着用をおすすめ: ",
        "avoid_wearing": "着用を避ける: ",
        "do_colon": "おすすめ: ",
        "dont_colon": "避ける: ",
    },
    "hi": {
        "do_not_wear": "पहनने से बचें: ",
        "do_wear": "पहनना बेहतर है: ",
        "avoid_wearing": "पहनने से बचें: ",
        "do_colon": "क्या करें: ",
        "dont_colon": "क्या न करें: ",
    },
}

_RE_DO_NOT_WEAR = re.compile(r"^(?:do\s+not\s+wear|don\'?t\s+wear|do\s+not|don\'?t)\s*:?\s*", re.IGNORECASE)
_RE_DO_WEAR = re.compile(r"^(?:do\s+wear|always\s+wear)\s*:?\s*", re.IGNORECASE)
_RE_AVOID_WEARING = re.compile(r"^(?:avoid\s+wearing|avoid)\s*:?\s*", re.IGNORECASE)
_RE_DO_COLON = re.compile(r"^do\s*:\s*", re.IGNORECASE)
_RE_DONT_COLON = re.compile(r"^(?:don\'?t|do\s+not)\s*:\s*", re.IGNORECASE)


def sanitize_stylist_text(text: str | None, lang: str = "en") -> str:
    """Scrub leaked CJK tokens and clean up language prefixes in generated text."""
    if not text or not isinstance(text, str):
        return ""

    clean = text
    lang_norm = (lang or "en").lower().strip()
    base_lang = lang_norm.split("-")[0].split("_")[0]

    # 1. Clean Chinese tokens when language is neither Chinese nor Japanese
    if not base_lang.startswith("zh") and not base_lang.startswith("ja"):
        cjk_replacements = {
            "he": {
                "组装": "שילוב",
                "保守": "שמרני",
                "推荐": "המלצה",
                "搭配": "התאמה",
                "合适": "מתאים",
                "经典": "קלאסי",
                "黑色": "שחור",
                "白色": "לבן",
                "灰色": "אפור",
            },
            "default": {
                "组装": "ensemble",
                "保守": "conservative",
                "推荐": "recommended",
                "搭配": "styling",
                "合适": "appropriate",
                "经典": "classic",
            },
        }
        rep_map = cjk_replacements.get(base_lang, cjk_replacements["default"])
        for k, v in rep_map.items():
            clean = clean.replace(k, v)
        # Strip any other stray CJK characters in non-Chinese outputs
        clean = re.sub(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", "", clean)

    # 2. Localize or remove English imperative prefixes across all supported languages
    if base_lang in _PREFIX_LOCALIZATIONS:
        loc = _PREFIX_LOCALIZATIONS[base_lang]
        clean = _RE_DO_NOT_WEAR.sub(loc["do_not_wear"], clean)
        clean = _RE_DO_WEAR.sub(loc["do_wear"], clean)
        clean = _RE_AVOID_WEARING.sub(loc["avoid_wearing"], clean)
        clean = _RE_DO_COLON.sub(loc["do_colon"], clean)
        clean = _RE_DONT_COLON.sub(loc["dont_colon"], clean)

    # 3. Clean duplicate prefix verbs (e.g. 'אין ללבוש ללבוש' -> 'אין ללבוש')
    clean = re.sub(r"^(אין ללבוש)\s+ללבוש\s+", r"אין ללבוש ", clean)
    clean = re.sub(r"^(מומלץ ללבוש)\s+ללבוש\s+", r"מומלץ ללבוש ", clean)
    clean = re.sub(r"^(כדאי ללבוש)\s+ללבוש\s+", r"כדאי ללבוש ", clean)
    clean = re.sub(r"\b(ללבוש)\s+\1\b", r"\1", clean)

    # 4. Clean Cyrillic and stray Arabic tokens when language is not Russian / Arabic
    if base_lang != "ru":
        clean = re.sub(r"\bправило\b", "כלל" if base_lang == "he" else "rule", clean, flags=re.IGNORECASE)
        clean = re.sub(r"[\u0400-\u04ff]+", "", clean)
    if base_lang not in ("ar", "fa", "ur"):
        clean = re.sub(r"ח[\u0600-\u06ff]+ה", "חומה", clean)
        clean = re.sub(r"[\u0600-\u06ff]+", "", clean)

    # 5. Strip formulaic math ratio and design rules (e.g. 10–30–60, 60-30-10, 1:2 Ratio)
    clean = re.sub(r"(?:את\s+)?(?:\d+[\s–\-/:]\d+[\s–\-/:]\d+|\d+:\d+(?:\s*Ratio)?)\s*(?:правило|rule|כלל)?", "", clean, flags=re.IGNORECASE)

    # 6. Clean Hebrew Shiva / Mourning literal translation errors and typos
    clean = re.sub(r"להולך\s+בישיבה\s+שבעה", "לביקור שבעה", clean)
    clean = re.sub(r"להולך\s+בישיבה", "לביקור שבעה", clean)
    clean = re.sub(r"הולך\s+בישיבה\s+שבעה", "הולך לשבעה", clean)
    clean = re.sub(r"הולך\s+בישיבה", "הולך לשבעה", clean)
    clean = re.sub(r"לישיבה\s+שבעה", "לשבעה", clean)
    clean = re.sub(r"בישיבה\s+שבעה", "בשבעה", clean)
    clean = re.sub(r"יושב\s+בישיבה\s+שבעה", "יושב שבעה", clean)
    clean = re.sub(r"להולך\s+לשבעה", "לביקור שבעה", clean)
    clean = re.sub(r"going\s+(?:in|to)\s+a\s+sitting\s+shiva", "attending a shiva", clean, flags=re.IGNORECASE)

    # 7. Hebrew specific token, garment name, and typo corrections
    if base_lang == "he":
        # Mixed-script token glitches inside Hebrew words (e.g. 'חomה' -> 'חומה')
        clean = re.sub(r"ח(?:om|um|oom)ה", "חומה", clean, flags=re.IGNORECASE)
        clean = re.sub(r"ח(?:om|um|oom)ות", "חומות", clean, flags=re.IGNORECASE)
        clean = re.sub(r"\bמתא[a-zA-Z]+\b", "מתאים", clean)
        clean = re.sub(r"מתאistes", "מתאים", clean)
        clean = re.sub(r"התאוםשתאור", "וסט", clean)
        clean = re.sub(r"(?:ו?תאוםשת\s+האורודת|התאוםשת\s*האורודת|ו?תאוםשת|התאוםשת)", "וההתאמה", clean)
        clean = re.sub(r"\bשתאור\b", "מחויט", clean)

        # Common typos and awkward phrasing
        clean = re.sub(r"\bלניקום\b", "לניחום", clean)
        clean = re.sub(r"חליפות\s+כחולה", "חולצה כחולה", clean)
        clean = re.sub(r"כחול\s+כחולה", "כחול", clean)

        # Machine translation gibberish fixes ("שילוב מונה" -> "שילוב")
        clean = re.sub(r"ה?שילוב\s+מונה\s+מושלם", "השילוב המושלם", clean)
        clean = re.sub(r"שילוב\s+מונה\s+הולם", "שילוב הולם ומכובד", clean)
        clean = re.sub(r"השילוב\s+מונה\s+הולם", "השילוב ההולם", clean)
        clean = re.sub(r"\bשילוב\s+מונה\b", "שילוב", clean)
        clean = re.sub(r"\bהשילוב\s+מונה\b", "השילוב", clean)
        clean = re.sub(r"\bמונה\s+מושלם\b", "מושלם", clean)
        clean = re.sub(r"\bמונה\s+הולם\b", "הולם", clean)

        # Machine-translation fixes for footwear ("עקבות נוחות" -> "נעליים נוחות")
        clean = re.sub(r"ועקבות\s+נוחות\b", "ונעליים נוחות", clean)
        clean = re.sub(r"\bעקבות\s+נוחות\b", "נעליים נוחות", clean)
        clean = re.sub(r"\bעקבות\b(?=\s+(?:נוחות|גמישות|אלגנטיות|מעור))", "נעליים", clean)

        # Machine-translation fixes for centerpiece garment ("הגדולה היא" -> "הפריט המרכזי הוא")
        clean = re.sub(r"\bהגדולה\s+היא\s+חולצת\b", "הפריט המרכזי הוא חולצת", clean)
        clean = re.sub(r"\bהגדולה\s+היא\b", "הפריט המרכזי הוא", clean)

        # Do/Don't machine translation fixes ("מפוחיות פנים", "חולצות קצרים או מכנסיים")
        clean = re.sub(r"מפוחיות\s+פנים", "כיסויי פנים", clean)
        clean = re.sub(r"מפוחית\s+פנים", "כיסוי פנים", clean)
        clean = re.sub(r"חולצות\s+קצרים\s+או\s+מכנסיים\b(?!\s*קצרים)", "חולצות קצרות או מכנסיים קצרים", clean)
        clean = re.sub(r"חולצות\s+קצרים", "חולצות קצרות", clean)
        clean = re.sub(r"חולצות\s+קצרות\s+או\s+מכנסיים\b(?!\s*קצרים)", "חולצות עם שרוול קצר או מכנסיים קצרים", clean)
        clean = re.sub(r"אין ללבוש מכנסיים\b(?!\s*קצרים)", "אין ללבוש מכנסיים קצרים", clean)

        # Garment mistranslation: vest/waistcoat -> וסט (never סינר which means apron)
        clean = re.sub(r"סינר\s+אפור\s+בהי\b", "וסט אפור בהיר", clean)
        clean = re.sub(r"סינר\s+אפור\s+בהיר", "וסט אפור בהיר", clean)
        clean = re.sub(r"וסינר\b", "ו-וסט", clean)
        clean = re.sub(r"\bסינר\b", "וסט", clean)

        # English garment labels leaked into Hebrew
        clean = re.sub(r"notched\s+lapel\s+tailored\s*\+?\s*vest", "וסט מחויט עם צווארון דש", clean, flags=re.IGNORECASE)
        clean = re.sub(r"tailored\s*\+?\s*vest", "וסט מחויט", clean, flags=re.IGNORECASE)
        clean = re.sub(r"black\s+wool\s+tailored\s+overcoat", "מעיל צמר שחור מחויט", clean, flags=re.IGNORECASE)
        clean = re.sub(r"tailored\s+overcoat", "מעיל מחויט", clean, flags=re.IGNORECASE)

        # Shiva and mourning tone adjustments (replace celebratory words with solemn ones)
        if any(w in clean for w in ("שבעה", "אבל", "ניחום", "לוויה", "אזכרה")):
            clean = re.sub(r"מלבוש\s+יומיומי\s+מושלם|יומיומי\s+מושלם", "לבוש מאופק ומכובד", clean)
            clean = re.sub(r"\bמשובחת\b", "מכובדת", clean)
            clean = re.sub(r"\bמשובח\b", "מכובד", clean)
            clean = re.sub(r"\bמושלמת\b", "הולמת", clean)
            clean = re.sub(r"\bמושלם\b", "הולם", clean)

    # 8. Clean double spaces and stray punctuation spacing while preserving newlines
    clean = re.sub(r"[ \t]{2,}", " ", clean)
    clean = re.sub(r"[ \t]+([,.:;?!])", r"\1", clean)
    clean = re.sub(r",\s*,+", ",", clean)

    return clean.strip()



def sanitize_stylist_payload(
    advice: dict[str, Any],
    lang: str = "en",
    closet_summary: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Sanitize all text fields in stylist response payload (strip CJK, drop fake URLs, fix prefixes)."""
    if not isinstance(advice, dict):
        return advice

    if advice.get("reasoning_summary"):
        advice["reasoning_summary"] = sanitize_stylist_text(advice["reasoning_summary"], lang=lang)
    if advice.get("spoken_reply"):
        advice["spoken_reply"] = sanitize_stylist_text(advice["spoken_reply"], lang=lang)

    # Clean Do / Don't
    if isinstance(advice.get("do_dont"), list):
        cleaned_dd = []
        for entry in advice["do_dont"]:
            if isinstance(entry, str):
                s = sanitize_stylist_text(entry, lang=lang)
                if s:
                    cleaned_dd.append(s)
        advice["do_dont"] = cleaned_dd

    # Collect all items already recommended in outfit_recommendations to avoid duplicate shopping suggestions
    existing_look_tokens = set()
    if isinstance(advice.get("outfit_recommendations"), list):
        for rec in advice["outfit_recommendations"]:
            if isinstance(rec, dict):
                for it in rec.get("items") or []:
                    if isinstance(it, dict):
                        d = str(it.get("description") or it.get("name") or "").lower().strip()
                        if d:
                            existing_look_tokens.add(d)
                            for part in d.split(","):
                                if part.strip():
                                    existing_look_tokens.add(part.strip())

    # Clean Shopping Suggestions: DROP URLs, raw IDs, and items already in the outfit or closet!
    if isinstance(advice.get("shopping_suggestions"), list):
        cleaned_shop = []
        for s in advice["shopping_suggestions"]:
            if not isinstance(s, str):
                continue
            s_clean = sanitize_stylist_text(s, lang=lang)
            # Drop fake URLs or web links
            if re.search(r"https?://|www\.|\.example\.com|/products/|[a-f0-9]{8}-[a-f0-9]{4}", s_clean):
                continue
            s_lower = s_clean.lower().strip()
            # Drop if it duplicates an item already in the look
            is_dup = any(
                s_lower == tok or (len(tok) >= 5 and (s_lower in tok or tok in s_lower))
                for tok in existing_look_tokens
            )
            if not is_dup and len(s_clean) >= 3:
                cleaned_shop.append(s_clean)

        # Filter against closet_summary
        if cleaned_shop and closet_summary:
            try:
                from app.services.stylist_qa_engine import filter_shopping_suggestions_against_closet
                cleaned_shop = filter_shopping_suggestions_against_closet(
                    cleaned_shop,
                    all_closet_items=closet_summary,
                    outfit_recommendations=advice.get("outfit_recommendations"),
                    lang=lang,
                )
            except Exception as exc:
                logger.warning("Could not filter shopping suggestions against closet summary: %s", exc)

        advice["shopping_suggestions"] = cleaned_shop

    # Clean Outfit Recommendations names, whys, descriptions
    if isinstance(advice.get("outfit_recommendations"), list):
        for rec in advice["outfit_recommendations"]:
            if not isinstance(rec, dict):
                continue
            if rec.get("name"):
                rec["name"] = sanitize_stylist_text(rec["name"], lang=lang)
            if rec.get("why"):
                rec["why"] = sanitize_stylist_text(rec["why"], lang=lang)
            if isinstance(rec.get("items"), list):
                for item in rec["items"]:
                    if isinstance(item, dict) and item.get("description"):
                        item["description"] = sanitize_stylist_text(item["description"], lang=lang)
                    if isinstance(item, dict) and item.get("name"):
                        item["name"] = sanitize_stylist_text(item["name"], lang=lang)

    return advice


def _sanitize_spoken_reply_field(parsed: dict[str, Any]) -> None:
    """Ensure spoken_reply never contains raw JSON syntax or prompt leaks."""
    spk = str(parsed.get("spoken_reply") or "").strip()
    if not spk or spk.startswith("{") or '"reasoning_summary"' in spk or '"outfit_recommendations"' in spk or "{" in spk[:10]:
        parsed["spoken_reply"] = parsed.get("reasoning_summary") or "Here are your curated outfit recommendations."


def _repair_truncated_json(text: str) -> dict[str, Any] | None:
    """Attempt graceful recovery of truncated JSON streams by balancing stacks or extracting completed objects."""
    if not text or not isinstance(text, str):
        return None
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    # 1. Direct parse attempt
    try:
        res = json.loads(cleaned)
        if isinstance(res, dict):
            return res
    except Exception:
        pass

    # 2. Structural closing of unclosed strings, arrays, and objects
    s = cleaned
    for _ in range(50):
        in_string = False
        escape = False
        stack = []
        for ch in s:
            if escape:
                escape = False
                continue
            if ch == '\\':
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if not in_string:
                if ch in ('{', '['):
                    stack.append(ch)
                elif ch == '}':
                    if stack and stack[-1] == '{':
                        stack.pop()
                elif ch == ']':
                    if stack and stack[-1] == '[':
                        stack.pop()

        closing = ""
        if in_string:
            closing += '"'
        for token in reversed(stack):
            if token == '{':
                closing += '}'
            elif token == '[':
                closing += ']'

        candidate = s + closing
        try:
            res = json.loads(candidate)
            if isinstance(res, dict):
                return res
        except Exception:
            pass

        # Trim back to previous delimiter
        last_delim = max(s.rfind(','), s.rfind('{'), s.rfind('['), s.rfind('}'), s.rfind(']'))
        if last_delim <= 0:
            break
        s = s[:last_delim].rstrip()

    # 3. Regex extraction of outfit recommendations if JSON root failed
    recs = []
    rec_pattern = re.compile(
        r'\{\s*"name"\s*:\s*"(?P<name>[^"]+)"\s*,\s*"items"\s*:\s*\[(?P<items>[^\]]+)\](?:\s*,\s*"why"\s*:\s*"(?P<why>[^"]*)")?',
        re.DOTALL
    )
    for m in rec_pattern.finditer(cleaned):
        rec_obj = {"name": m.group("name"), "items": []}
        if m.group("why"):
            rec_obj["why"] = m.group("why")
        item_pattern = re.compile(
            r'\{\s*"role"\s*:\s*"(?P<role>[^"]+)"\s*,\s*"description"\s*:\s*"(?P<desc>[^"]*)"(?:,\s*"closet_item_id"\s*:\s*(?P<cid>"[^"]*"|null))?\s*\}'
        )
        for itm in item_pattern.finditer(m.group("items")):
            cid_val = itm.group("cid")
            if cid_val and cid_val != "null":
                cid_val = cid_val.strip('"')
            else:
                cid_val = None
            rec_obj["items"].append({
                "role": itm.group("role"),
                "description": itm.group("desc"),
                "name": itm.group("desc"),
                "closet_item_id": cid_val,
            })
        if rec_obj["items"]:
            recs.append(rec_obj)

    reasoning_match = re.search(r'"reasoning_summary"\s*:\s*"(?P<res>[^"]+)"', cleaned)
    spoken_match = re.search(r'"spoken_reply"\s*:\s*"(?P<spk>[^"]+)"', cleaned)

    if recs:
        return {
            "reasoning_summary": reasoning_match.group("res") if reasoning_match else "Curated recommendations",
            "outfit_recommendations": recs,
            "spoken_reply": spoken_match.group("spk") if spoken_match else (reasoning_match.group("res") if reasoning_match else ""),
            "shopping_suggestions": [],
            "do_dont": [],
        }

    return None


def _parse_json(raw: str) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw  # defensive
    text = raw or ""
    # Strip ```json fences if present
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            _sanitize_spoken_reply_field(parsed)
            return parsed
    except json.JSONDecodeError:
        pass

    match = _JSON_RE.search(text)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                _sanitize_spoken_reply_field(parsed)
                return parsed
        except json.JSONDecodeError as exc:
            logger.error("Stylist regex JSON parse failed: %s", exc)

    # Try stream repair of truncated JSON
    repaired = _repair_truncated_json(text)
    if repaired and isinstance(repaired, dict):
        _sanitize_spoken_reply_field(repaired)
        return repaired

    logger.error("Stylist model returned non-JSON / unrepairable output (len=%d)", len(text))
    return {
        "reasoning_summary": "Parser could not decode model output.",
        "outfit_recommendations": [],
        "shopping_suggestions": [],
        "do_dont": [],
        "spoken_reply": "Here are your curated outfit recommendations.",
        "_raw": text,
    }


def image_bytes_to_base64(img: bytes) -> str:
    return base64.b64encode(img).decode("ascii")


async def parse_urls_and_context(text: str | None, session_id: str = "") -> str:
    """
    Given the user input text, parses any URLs present in it.
    If a URL is recognized as an item or clothing list URL, fetches the metadata
    and appends a context block to the user text.
    """
    if not text or not isinstance(text, str):
        return ""

    urls = re.findall(r'https?://[^\s]+', text)
    if not urls:
        return text

    for url in urls:
        try:
            # Parse listing id from the url
            # e.g., dressapp.co/listings/123 or similar patterns
            # Fetch info from local db or marketplace API
            import httpx
            from app.db.database import get_db
            
            # 1) If it is a local listing url
            # Format: .../listings/{id}
            listing_match = re.search(r'/listings/([a-zA-Z0-9\-]+)', url)
            if listing_match:
                listing_id = listing_match.group(1)
                db = get_db()
                listing = await db.listings.find_one({"id": listing_id})
                if listing:
                    desc = f"Garment: {listing.get('title')}, category: {listing.get('category')}, brand: {listing.get('brand')}, price: {listing.get('price')} {listing.get('currency')}"
                    text = text.replace(url, f"{url} ({desc})")
                    continue

            # 2) If it is an external URL, scrape title/description using a simple HTTP GET
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code == 200:
                    # Extract html title
                    html_text = resp.text
                    title_match = re.search(r'<title>(.*?)</title>', html_text, re.IGNORECASE)
                    title = title_match.group(1).strip() if title_match else "Webpage"
                    # Clean title
                    title = re.sub(r'\s+', ' ', title)
                    desc = f"Link: {title}"
                    text = text.replace(url, f"{url} ({desc})")
        except Exception as e:
            logger.warning("Failed to parse URL %s: %s", url, e)
            
    return text


gemini_stylist_service = (
    GeminiStylistService() if settings.GEMINI_API_KEY else None
)


def get_gemini_stylist_service(
    user: dict[str, Any] | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> GeminiStylistService | None:
    """Return a GeminiStylistService instance resolved for the user or system."""
    if not api_key and user:
        from app.services.auth import resolve_user_gemini_api_key
        api_key = resolve_user_gemini_api_key(user)
    if not model and user:
        from app.services.auth import resolve_user_gemini_model
        model = resolve_user_gemini_model(user)
    if not api_key:
        api_key = settings.GEMINI_API_KEY
    if not api_key:
        return gemini_stylist_service
    try:
        return GeminiStylistService(api_key=api_key, model=model)
    except Exception as exc:
        logger.warning("Failed to initialize user-specific GeminiStylistService: %s", exc)
        return gemini_stylist_service

