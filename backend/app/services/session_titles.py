"""Generate short, friendly titles for stylist conversations.

Uses the Emergent LLM key + Gemini Flash so it's cheap and quick. Falls back
to a rule-based truncation if the LLM is unreachable so we never block the
user's first turn.
"""
from __future__ import annotations

import logging
import re
import uuid

from app.config import settings
from app.services.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

_LANG_NAMES: dict[str, str] = {
    "en": "English",
    "he": "Hebrew",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "ja": "Japanese",
    "hi": "Hindi",
}


def clean_title(raw: str, fallback_query: str = "") -> str:
    """Sanitize title output, stripping JSON, tool call fragments, and punctuation."""
    import json
    text = (raw or "").strip()
    if not text:
        return _fallback_title(fallback_query)

    # 1. Strip markdown fences
    if "```" in text:
        text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()

    # 2. Try JSON parse if it looks like a JSON object
    if ("{" in text and "}" in text) or text.startswith("{"):
        try:
            m = re.search(r"\{.*?\}", text, re.DOTALL)
            if m:
                obj = json.loads(m.group(0))
                if isinstance(obj, dict):
                    candidate = obj.get("title") or obj.get("text") or obj.get("response") or obj.get("answer")
                    if candidate and isinstance(candidate, str):
                        text = candidate
        except Exception:
            pass

    # 3. Regex extract "text": "..." or "title": "..." if JSON fragments remain
    frag_match = re.search(r'"(?:text|title|answer|topic)"\s*:\s*"([^"]+)"', text)
    if frag_match:
        text = frag_match.group(1)

    # 4. Strip remaining quotes, brackets, and prefixes like "action": or "title:"
    text = re.sub(r'^(?:action\s*:\s*"?[^"]*"?\s*,\s*)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:title|topic|subject|text|ללבוש)\s*:\s*', '', text, flags=re.IGNORECASE)
    text = text.strip(" \t\n\r\"'`“”‘’[](){}:,;")
    text = text.splitlines()[0].strip() if text else ""

    # 5. Sanity check: if it still has json garbage like "action": or curly braces, use fallback
    if any(bad in text.lower() for bad in ('"action"', '"text"', '{"', '"}', 'action":', 'text":')):
        return _fallback_title(fallback_query)

    if not text or len(text) < 2:
        return _fallback_title(fallback_query)

    return text[:45]


async def generate_session_title(
    text: str,
    language: str = "en",
    api_key: str | None = None,
    user: dict[str, Any] | None = None,
) -> str:
    """Return a crisp 2–4 word conversation title based on the first user turn."""
    text = (text or "").strip()
    if not text:
        return "Style advice"

    from app.services.auth import resolve_effective_provider
    eff_prov = resolve_effective_provider(user=user)

    active_key = api_key or settings.GEMINI_API_KEY
    if not active_key and eff_prov != "gemma":
        return _fallback_title(text)

    lang_code = (language or "en").lower()
    lang_name = _LANG_NAMES.get(lang_code, "the same language as the user query")
    system_msg = (
        f"You are a fashion stylist thread title generator. Generate a concise, catchy, highly descriptive 2 to 4 word title in {lang_name} for this fashion conversation. "
        "Return ONLY the plain title text without quotes, punctuation, markdown, emoji, or prefixes like 'Title:' or 'Topic:'. "
        "Keep it under 35 characters."
    )
    from app.services.llm_gateway import call_main_llm
    try:
        raw = await call_main_llm(
            system_prompt=system_msg,
            user_text=text[:300],
            max_tokens=60,
            temperature=0.3,
            model="gemini-3.5-flash-lite",
            api_key=active_key,
            user=user,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Session title generation failed: %s", exc)
        return _fallback_title(text)

    return clean_title(raw, fallback_query=text)
