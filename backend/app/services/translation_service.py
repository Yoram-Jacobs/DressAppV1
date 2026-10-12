"""translation_service.py - Production Google Translate Integration for DressApp Eyes.

Integrates Google Translate into the on-premises Eyes (Qwen2.5-VL-3B / Gemma-4-E4B)
pipeline. Because lightweight models running on CPU cannot reliably generate or translate
non-English languages (often hallucinating gibberish or truncating tokens), the Eyes
pipeline runs in canonical English, and this service provides high-fidelity, native
Google Translation for all 13 supported languages.

Supported translation engines:
1. Google Cloud Translation REST API (v2) if a working GOOGLE_TRANSLATE_API_KEY is active.
2. Google Gemini Neural Translation (gemini-3.5-flash-lite / gemini-2.5-flash) via Google GenAI SDK.
3. In-memory LRU cache to eliminate redundant network round-trips for common terms and repeated queries.
4. Fashion glossary alignment (e.g. Shalwar/Salwar -> 'שרוואל').
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any
from collections import OrderedDict

import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# Normalization mapping for language codes
LANG_CODE_MAP: dict[str, str] = {
    "iw": "he",
    "he": "he",
    "ar": "ar",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "it": "it",
    "pt": "pt",
    "nl": "nl",
    "ru": "ru",
    "zh": "zh",
    "zh-cn": "zh",
    "zh-tw": "zh",
    "ja": "ja",
    "hi": "hi",
    "en": "en",
}

LANG_NAMES: dict[str, str] = {
    "he": "Hebrew",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "ru": "Russian",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "hi": "Hindi",
    "en": "English",
}

# Domain-specific terminology alignment
FASHION_GLOSSARY_HINTS: dict[str, dict[str, str]] = {
    "he": {
        "salwar": "שרוואל",
        "shalwar": "שרוואל",
        "kurta": "קורטה",
        "churidar": "צ'ורידר",
        "kaftan": "קפטן",
        "galabiya": "גלבייה",
        "thobe": "ת'וב",
        "abaya": "עבאיה",
        "sari": "סארי",
        "lehenga": "להנגה",
        "sherwani": "שרוואני",
        "smart-casual": "סמארט קז'ואל",
        "smart casual": "סמארט קז'ואל",
    }
}

# Thread-safe in-memory LRU cache for translations
_CACHE_MAX_SIZE = 4096
_TRANSLATION_CACHE: OrderedDict[tuple[str, str, str], str] = OrderedDict()
_CACHE_LOCK = asyncio.Lock()


def normalize_lang(code: str | None) -> str:
    if not code:
        return "en"
    clean = code.strip().lower()
    return LANG_CODE_MAP.get(clean, clean)


async def _cache_get(key: tuple[str, str, str]) -> str | None:
    async with _CACHE_LOCK:
        if key in _TRANSLATION_CACHE:
            _TRANSLATION_CACHE.move_to_end(key)
            return _TRANSLATION_CACHE[key]
    return None


async def _cache_set(key: tuple[str, str, str], val: str) -> None:
    async with _CACHE_LOCK:
        _TRANSLATION_CACHE[key] = val
        _TRANSLATION_CACHE.move_to_end(key)
        if len(_TRANSLATION_CACHE) > _CACHE_MAX_SIZE:
            _TRANSLATION_CACHE.popitem(last=False)


def _apply_fashion_glossary(text: str, target_lang: str) -> str:
    """Post-process translation with canonical fashion glossary terms."""
    glossary = FASHION_GLOSSARY_HINTS.get(target_lang)
    if not glossary or not text:
        return text
    result = text
    if target_lang == "he":
        # Replace common variations of salwar/salwar kameez with canonical שרוואל
        result = re.sub(r"\bסלוואר\b", "שרוואל", result)
        result = re.sub(r"\bסלבר\b", "שרוואל", result)
        result = re.sub(r"\bשלוואר\b", "שרוואל", result)
    return result


async def _translate_via_google_rest(
    texts: list[str],
    target_lang: str,
    source_lang: str = "en",
    api_key: str | None = None,
) -> list[str] | None:
    """Attempt translation via official Google Cloud Translation REST API v2."""
    key = api_key or getattr(settings, "GOOGLE_TRANSLATE_API_KEY", None) or settings.GEMINI_API_KEY
    if not key:
        return None
    try:
        url = f"https://translation.googleapis.com/language/translate/v2?key={key}"
        payload = {
            "q": texts,
            "target": target_lang,
            "source": source_lang,
            "format": "text",
        }
        async with httpx.AsyncClient(timeout=8.0) as cli:
            resp = await cli.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                translations = data.get("data", {}).get("translations", [])
                if len(translations) == len(texts):
                    return [t.get("translatedText", "") for t in translations]
    except Exception as exc:
        logger.debug("Google Cloud Translation REST API unavailable: %s", exc)
    return None


async def _translate_via_google_gemini(
    texts: list[str],
    target_lang: str,
    source_lang: str = "en",
) -> list[str] | None:
    """Translate via Google Gemini (gemini-3.5-flash-lite / gemini-2.5-flash) using Google GenAI SDK."""
    active_key = settings.GEMINI_API_KEY or getattr(settings, "GOOGLE_API_KEY", None)
    if not active_key:
        return None

    try:
        from google import genai
        client = genai.Client(api_key=active_key)
        target_name = LANG_NAMES.get(target_lang, target_lang)

        glossary_note = ""
        if target_lang == "he":
            glossary_note = " Use 'שרוואל' for salwar/shalwar, 'קורטה' for kurta, 'צ'ורידר' for churidar."

        prompt = (
            f"You are a professional fashion translator. Translate the following list of strings from {source_lang} "
            f"into fluent, natural, culturally appropriate {target_name} ({target_lang}).{glossary_note} "
            "Return ONLY a valid JSON array of strings containing the exact same number of elements and in the exact same order.\n\n"
            f"{json.dumps(texts, ensure_ascii=False)}"
        )

        resp = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config={"response_mime_type": "application/json", "temperature": 0.0},
        )
        if resp and resp.text:
            cleaned = resp.text.strip()
            parsed = json.loads(cleaned)
            if isinstance(parsed, list) and len(parsed) == len(texts):
                return [str(x) for x in parsed]
    except Exception as exc:
        logger.warning("Gemini fashion translation soft-failed: %s", exc)
    return None


async def translate_batch(
    texts: list[str],
    target_lang: str,
    source_lang: str = "en",
) -> list[str]:
    """Translate a list of strings into target_lang with batching and caching."""
    target_lang = normalize_lang(target_lang)
    source_lang = normalize_lang(source_lang)

    if not texts:
        return []

    if target_lang == source_lang:
        return list(texts)

    results: list[str | None] = [None] * len(texts)
    missing_indices: list[int] = []
    missing_texts: list[str] = []

    # Check cache first
    for idx, text in enumerate(texts):
        if not text or not text.strip():
            results[idx] = text
            continue
        cached = await _cache_get((text.strip(), target_lang, source_lang))
        if cached is not None:
            results[idx] = cached
        else:
            missing_indices.append(idx)
            missing_texts.append(text)

    if missing_texts:
        # Tier 1: Google Cloud Translation REST API
        translated = await _translate_via_google_rest(missing_texts, target_lang, source_lang)

        # Tier 2: Google Gemini Neural Translation
        if not translated:
            translated = await _translate_via_google_gemini(missing_texts, target_lang, source_lang)

        # Tier 3: If all translation backends fail, fallback to original texts safely
        if not translated or len(translated) != len(missing_texts):
            translated = missing_texts

        for i, idx in enumerate(missing_indices):
            res_text = _apply_fashion_glossary(translated[i], target_lang)
            results[idx] = res_text
            await _cache_set((missing_texts[i].strip(), target_lang, source_lang), res_text)

    return [r if r is not None else "" for r in results]


async def translate_text(
    text: str,
    target_lang: str,
    source_lang: str = "en",
) -> str:
    """Translate a single text string into target_lang."""
    if not text or not text.strip():
        return text
    target_lang = normalize_lang(target_lang)
    source_lang = normalize_lang(source_lang)
    if target_lang == source_lang:
        return text

    cached = await _cache_get((text.strip(), target_lang, source_lang))
    if cached is not None:
        return cached

    res = await translate_batch([text], target_lang=target_lang, source_lang=source_lang)
    return res[0] if res else text


async def translate_stylist_payload(
    payload: dict[str, Any],
    target_lang: str,
) -> dict[str, Any]:
    """Translates user-facing text fields in a stylist advice payload into target_lang.

    Preserves JSON keys, enum values, IDs, image URLs, and schema contracts.
    """
    target_lang = normalize_lang(target_lang)
    if target_lang == "en" or not isinstance(payload, dict):
        return payload

    out = dict(payload)

    # Collect texts to batch translate
    texts_to_translate: list[str] = []
    text_slots: list[tuple[str, Any, Any]] = []

    def record_slot(category: str, key_or_index: Any, parent_ref: Any, val: Any):
        if isinstance(val, str) and val.strip():
            texts_to_translate.append(val)
            text_slots.append((category, key_or_index, parent_ref))

    if out.get("spoken_reply"):
        record_slot("spoken_reply", None, out, out["spoken_reply"])
    if out.get("reasoning_summary"):
        record_slot("reasoning_summary", None, out, out["reasoning_summary"])

    # Outfit recommendations
    outfits = out.get("outfit_recommendations") or []
    for o_idx, outfit in enumerate(outfits):
        if not isinstance(outfit, dict):
            continue
        if outfit.get("name"):
            record_slot("outfit_name", "name", outfit, outfit["name"])
        if outfit.get("why"):
            record_slot("outfit_why", "why", outfit, outfit["why"])
        if outfit.get("designer_notes"):
            record_slot("outfit_notes", "designer_notes", outfit, outfit["designer_notes"])

        # Items inside outfit
        items = outfit.get("items") or []
        for it in items:
            if not isinstance(it, dict):
                continue
            if it.get("description"):
                record_slot("item_desc", "description", it, it["description"])

    # Shopping suggestions
    suggestions = out.get("shopping_suggestions") or []
    for s_idx, sugg in enumerate(suggestions):
        if not isinstance(sugg, dict):
            continue
        if sugg.get("name"):
            record_slot("sugg_name", "name", sugg, sugg["name"])
        if sugg.get("why"):
            record_slot("sugg_why", "why", sugg, sugg["why"])
        if sugg.get("notes"):
            record_slot("sugg_notes", "notes", sugg, sugg["notes"])

    # Do and Don'ts
    dodonts = out.get("do_dont") or []
    for d_idx, dd in enumerate(dodonts):
        if isinstance(dd, str) and dd.strip():
            record_slot("dodont", d_idx, dodonts, dd)

    if not texts_to_translate:
        return out

    translated_texts = await translate_batch(texts_to_translate, target_lang=target_lang, source_lang="en")

    # Re-apply translated texts to original slots
    for (category, key_or_index, parent_ref), translated_str in zip(text_slots, translated_texts):
        if category == "spoken_reply":
            parent_ref["spoken_reply"] = translated_str
        elif category == "reasoning_summary":
            parent_ref["reasoning_summary"] = translated_str
        elif category in ("outfit_name", "outfit_why", "outfit_notes", "item_desc", "sugg_name", "sugg_why", "sugg_notes"):
            parent_ref[key_or_index] = translated_str
        elif category == "dodont":
            parent_ref[key_or_index] = translated_str

    return out


async def translate_garment_attributes(
    item: dict[str, Any],
    target_lang: str,
) -> dict[str, Any]:
    """Translates user-facing text fields in garment vision extraction into target_lang."""
    target_lang = normalize_lang(target_lang)
    if target_lang == "en" or not isinstance(item, dict):
        return item

    out = dict(item)
    texts_to_translate: list[str] = []
    slots: list[tuple[str, Any]] = []

    for field in ("title", "name", "caption", "repair_advice"):
        val = out.get(field)
        if isinstance(val, str) and val.strip():
            texts_to_translate.append(val)
            slots.append((field, None))

    tags = out.get("tags")
    if isinstance(tags, list):
        for idx, tag in enumerate(tags):
            if isinstance(tag, str) and tag.strip():
                texts_to_translate.append(tag)
                slots.append(("tags", idx))

    if not texts_to_translate:
        return out

    translated = await translate_batch(texts_to_translate, target_lang=target_lang, source_lang="en")
    for (field, idx), trans_str in zip(slots, translated):
        if idx is None:
            out[field] = trans_str
        else:
            out["tags"][idx] = trans_str

    return out
