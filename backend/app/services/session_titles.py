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


def _fallback_title(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if not cleaned:
        return "New conversation"
    words = cleaned.split()
    return " ".join(words[:5])[:60]


async def generate_session_title(text: str, language: str = "en", api_key: str | None = None) -> str:
    """Return a crisp 3–5 word conversation title based on the first user turn."""
    text = (text or "").strip()
    if not text:
        return "New conversation"
    active_key = api_key or settings.GEMINI_API_KEY
    if not active_key:
        return _fallback_title(text)

    lang_code = (language or "en").lower()
    lang_name = _LANG_NAMES.get(lang_code, "English")
    system_msg = (
        "You summarise a user's stylist question into a very short thread "
        f"title in {lang_name}. Return ONLY the title — no quotes, no "
        "punctuation at the ends, no emoji, 3 to 5 words, Title Case where "
        "the target language uses it. Do NOT prefix with words like 'Topic:' "
        "or 'Title:'."
    )
    client = GeminiClient(api_key=active_key)
    try:
        # Flash is more than enough for a 5-word summary.
        raw = await client.text(
            system=system_msg,
            user_text=text[:400],
            model="gemini-3.5-flash-lite",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Session title generation failed: %s", exc)
        return _fallback_title(text)

    title = (raw or "").strip()
    # Strip surrounding quotes / brackets if the model added them
    title = title.strip(" \t\n\r\"'`“”‘’[](){}")
    # If the model returned multiple lines, keep the first
    title = title.splitlines()[0].strip() if title else ""
    if not title:
        return _fallback_title(text)
    # Hard cap at 60 chars as a safety net
    return title[:60]
