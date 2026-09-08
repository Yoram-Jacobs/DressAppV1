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
        return "Style advice"
    # Remove leading common conversational prefixes like "Can you", "Please", "I need", "מה ללבוש", etc.
    words = cleaned.split()
    return " ".join(words[:4])[:40]


async def generate_session_title(text: str, language: str = "en", api_key: str | None = None) -> str:
    """Return a crisp 2–4 word conversation title based on the first user turn."""
    text = (text or "").strip()
    if not text:
        return "Style advice"
    active_key = api_key or settings.GEMINI_API_KEY
    if not active_key:
        return _fallback_title(text)

    lang_code = (language or "en").lower()
    lang_name = _LANG_NAMES.get(lang_code, "the same language as the user query")
    system_msg = (
        f"You are a fashion stylist thread title generator. Generate a concise, catchy, highly descriptive 2 to 4 word title in {lang_name} for this fashion conversation. "
        "Return ONLY the plain title text without quotes, punctuation, markdown, emoji, or prefixes like 'Title:' or 'Topic:'. "
        "Keep it under 35 characters."
    )
    client = GeminiClient(api_key=active_key)
    try:
        raw = await client.text(
            system=system_msg,
            user_text=text[:300],
            model="gemini-3.5-flash",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Session title generation failed: %s", exc)
        return _fallback_title(text)

    title = (raw or "").strip()
    title = title.strip(" \t\n\r\"'`“”‘’[](){}")
    title = title.splitlines()[0].strip() if title else ""
    if not title or len(title) < 2:
        return _fallback_title(text)
    return title[:45]
