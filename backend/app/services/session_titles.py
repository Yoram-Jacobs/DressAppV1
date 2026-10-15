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


_FILLER_PREFIX_RE_HE = re.compile(
    r"^(?:האם\s+חסרים\s+בארון\s+הבגדים|האם\s+חסרים\s+לי\s+בארון|האם\s+חסרים\s+לי|האם\s+חסר\s+לי|"
    r"חקור\s+את\s+ארון\s+הבגדים\s*[.,?]?\s*|חקור\s+את\s+הארון\s*[.,?]?\s*|"
    r"בדוק\s+את\s+ארון\s+הבגדים\s*[.,?]?\s*|בדוק\s+את\s+הארון\s*[.,?]?\s*|"
    r"ערוך\s+רשימה\s+של|תערוך\s+רשימה\s+של|תן\s+לי\s+רשימה\s+של|"
    r"האם\s+אפשר|אפשר\s+בבקשה|תוכל\s+בבקשה|תוכלי\s+בבקשה|אני\s+רוצה|אני\s+צריך|אני\s+מחפש|"
    r"מה\s+כדאי\s+לי\s+ללבוש|מה\s+ללבוש)\s*",
    re.IGNORECASE,
)

_FILLER_PREFIX_RE_EN = re.compile(
    r"^(?:can\s+you\s+please|could\s+you\s+please|can\s+you|could\s+you|please\s+|"
    r"explore\s+my\s+closet\s*[.,?]?\s*|explore\s+the\s+closet\s*[.,?]?\s*|"
    r"analyze\s+my\s+closet\s*[.,?]?\s*|audit\s+my\s+closet\s*[.,?]?\s*|"
    r"make\s+a\s+list\s+of|create\s+a\s+list\s+of|give\s+me\s+a\s+list\s+of|"
    r"i\s+want\s+to\s+know|i\s+need\s+help\s+with|what\s+should\s+i\s+wear\s+for)\s*",
    re.IGNORECASE,
)


def _fallback_title(text: str) -> str:
    """Crisp 3–5 word ChatGPT/Gemini-style title extracted from the user query."""
    cleaned = (text or "").strip()
    if not cleaned:
        return "Style advice"
    cleaned = re.sub(r"[\r\n\t]+", " ", cleaned)

    # Heuristic topic mapping for common wardrobe exploration / missing items queries
    low = cleaned.lower()
    if re.search(r"[\u0590-\u05fe]", cleaned):
        if any(w in low for w in ("חסרים", "חסר", "אלמנטריים", "בסיסיים")) and any(w in low for w in ("ארון", "מלתחה", "בגדים", "פריטי")):
            return "בדיקת פריטי בסיס חסרים בארון"
        if "רשימה" in low and any(w in low for w in ("השלמת", "מומלצים", "מלתחה", "קנייה")):
            return "רשימת פריטים להשלמת המלתחה"
        if any(w in low for w in ("חקור את ארון", "חקור את הארון", "בדוק את הארון", "נתח את הארון")):
            return "סקירת ארון הבגדים"

    # Strip leading conversational fillers to isolate the core topic
    stripped = _FILLER_PREFIX_RE_HE.sub("", cleaned).strip()
    stripped = _FILLER_PREFIX_RE_EN.sub("", stripped).strip()
    if len(stripped) >= 4:
        cleaned = stripped

    # Take first sentence/clause if multiple sentences exist
    first_clause = re.split(r"[?.!;:]+", cleaned)[0].strip()
    if len(first_clause) >= 4:
        cleaned = first_clause

    cleaned = re.sub(r"[^\w\s\u0590-\u05fe\u0600-\u06ff\'-]", " ", cleaned)
    words = [w for w in cleaned.split() if len(w) >= 2]
    if not words:
        return "Style advice"
    return " ".join(words[:5])[:40].strip()


def clean_title(raw: str, fallback_query: str = "") -> str:
    """Sanitize title output, stripping JSON, tool call fragments, and hallucinated prefixes."""
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

    # 4. Strip remaining quotes, brackets, and prefixes like "action": or "title:" or hallucinated "אצ'ו:"
    text = re.sub(r'^(?:action\s*:\s*"?[^"]*"?\s*,\s*)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:title|topic|subject|text|chat|conversation|נושא|כותרת|שיחה|ללבוש|אצ\'ו)\s*:\s*', '', text, flags=re.IGNORECASE)
    # If a short prefix before a colon was hallucinated (e.g. "אצ'ו: ..."), drop the prefix or use fallback
    if ":" in text:
        parts = [p.strip() for p in text.split(":", 1)]
        if len(parts) == 2 and len(parts[0].split()) <= 2 and len(parts[1]) >= 4:
            text = parts[1]

    text = text.strip(" \t\n\r\"'`“”‘’[](){}:,;-–—*")
    text = text.splitlines()[0].strip() if text else ""

    # 5. Sanity check: if it still has json garbage or hallucinated nonsense, use fallback
    if any(bad in text.lower() for bad in (
        '"action"', '"text"', '{"', '"}', 'action":', 'text":',
        "אצ'ו", "מדריך אבזרי לבוש שדרכו", "untitled", "שיחה ללא שם",
    )):
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
    """Return a crisp 3–5 word ChatGPT/Gemini-style conversation title based on the user's message."""
    text = (text or "").strip()
    if not text:
        return "Style advice"

    active_key = api_key or settings.GEMINI_API_KEY
    if not active_key:
        return _fallback_title(text)

    lang_code = (language or "en").lower().strip().split("-")[0].split("_")[0]
    if re.search(r"[\u0590-\u05fe]", text):
        lang_code = "he"
    elif re.search(r"[\u0600-\u06ff]", text):
        lang_code = "ar"
    lang_name = _LANG_NAMES.get(lang_code, "the same language as the user query")

    system_msg = (
        f"Summarize the user's message into a short, natural conversation title (3 to 5 words) in {lang_name}, "
        "just like ChatGPT or Gemini names a chat thread.\n"
        "STRICT RULES:\n"
        "1. Use plain, direct words from the user's topic (e.g. 'בדיקת פריטי בסיס בארון', 'רשימת קניות להשלמת המלתחה', 'לבוש מתאים לפגישה בעירייה', 'Summer Wedding Guest Outfit').\n"
        "2. NEVER invent brand names, proper nouns, colons (:), quotes, markdown, or words unrelated to the prompt.\n"
        "3. Return ONLY the plain title text (max 38 characters)."
    )
    from app.services.llm_gateway import call_main_llm
    try:
        # Always force_provider='gemini' so title generation completes in <1s without CPU Eyes round-trip translation
        raw = await call_main_llm(
            system_prompt=system_msg,
            user_text=text[:300],
            max_tokens=40,
            temperature=0.1,
            model="gemini-3.5-flash-lite",
            api_key=active_key,
            force_provider="gemini",
            user=user,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Session title generation failed: %s", exc)
        return _fallback_title(text)

    return clean_title(raw, fallback_query=text)
