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
from app.services.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are DressApp’s Stylist Agent — a witty, practical fashion
consultant. You speak with warmth, never condescend, and always ground your
advice in the user’s actual closet, the weather, their calendar, and any
cultural constraints provided.

Output contract: return ONLY a JSON object matching this TypeScript type. No
markdown, no prose outside the JSON.

{
  "reasoning_summary": string,                 // 1-2 sentence plain-language rationale
  "outfit_recommendations": Array<{
    "name": string,                             // 3-6 words. Generates a highly descriptive, appealing, and creative style title (e.g., 'Casual Blue & White Summer Hangout', 'Classic Charcoal Streetwear', 'Sporty Emerald Workout') describing the vibe, season, and color combination. Avoid generic titles like 'The Look' or 'Outfit 1'.
    "items": Array<{ "role": "top"|"bottom"|"outerwear"|"shoes"|"accessory"|"dress",
                     "description": string,
                     "closet_item_id": string | null }>,
    "why": string,                              // 2-4 sentences explaining the detailed styling choices, why they work, and how they match the target occasion.
    "confidence": number                        // 0-1
  }>,
  "shopping_suggestions": Array<string>,        // only if closet lacks a key piece
  "do_dont": Array<string>,                     // brisk “Do …” / “Don’t …” bullets
  "spoken_reply": string                        // 2-4 sentences suitable for TTS
}

Hard rules:
• If cultural constraints are provided, they are NON-negotiable.
• Never recommend items that contradict the weather (e.g. linen in 2°C rain).
• Prefer items already in the user’s closet; suggest shopping only when a
  clearly missing staple would dramatically improve the outfit.
"""


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


class GeminiStylistService:
    def __init__(self, api_key: str | None = None) -> None:
        # Native google-genai path: requires a direct GEMINI_API_KEY.
        # The legacy EMERGENT_LLM_KEY fallback was removed when this
        # service migrated off the Emergent proxy — keeping the var
        # defined in env is harmless but it never feeds into real
        # calls any more.
        self.api_key = api_key or settings.GEMINI_API_KEY
        if not self.api_key:
            raise RuntimeError(
                "No GEMINI_API_KEY configured. Set it in /app/backend/.env or pass it explicitly."
            )
        self.model = settings.DEFAULT_STYLIST_MODEL
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
        # Prepend the URL parser context block to the user request.
        user_text = await parse_urls_and_context(user_text, session_id=session_id)

        # Phase S: prepend the rendered user-preference block (sex, age,
        # body, region, modesty, style aesthetics, avoid list...) directly
        # to the system message so EVERY recommendation respects them.
        # Falls through gracefully when no preferences are available.
        sys_msg = SYSTEM_PROMPT
        # Phase S1: when an image is attached, splice in the image-aware
        # addendum BEFORE the language directive so the directive (which
        # forces output language) stays last and "wins" if there's any
        # conflict between blocks. This is the fix for the user-reported
        # bug "stylist totally ignores the uploaded photo" — Gemini was
        # receiving the bytes but had no instruction to look at them.
        if image_base64:
            sys_msg = sys_msg + _IMAGE_CONTEXT_ADDENDUM
            logger.info(
                "gemini-stylist: image addendum applied session=%s",
                session_id,
            )
        sys_msg = sys_msg + _language_directive(
            (user_profile or {}).get("preferred_language")
        )
        if user_preferences_block:
            sys_msg = sys_msg + "\n\n" + user_preferences_block.strip() + "\n"
        context_block = {
            "weather": weather,
            "calendar_events": calendar_events or [],
            "cultural_rules": cultural_rules or [],
            "user_profile": user_profile or {},
            "closet_summary": closet_summary or [],
        }
        lang_code = ((user_profile or {}).get("preferred_language") or "en").lower()
        lang_name = _LANG_NAMES.get(lang_code, "English")
        # Inject the directive directly into the user message as well — Gemini
        # respects inline imperative clauses far more reliably than the system
        # prompt alone when it has to return JSON.
        lang_preamble = (
            f"**OUTPUT LANGUAGE = {lang_name} ({lang_code}).** Every "
            f"free-text field (`reasoning_summary`, each recommendation's "
            f"`name`/`why`, every item `description`, every `do_dont` "
            f"entry, every `shopping_suggestions` entry, and the final "
            f"`spoken_reply`) MUST be written in fluent, idiomatic "
            f"{lang_name}. JSON keys and enum tokens stay in English.\n\n"
        )
        prompt_text = (
            f"{lang_preamble}"
            f"USER_REQUEST:\n{user_text}\n\n"
            f"CONTEXT:\n{json.dumps(context_block, ensure_ascii=False, indent=2)}\n\n"
            "Return the JSON object now."
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
            raw = await self._client.vision(
                system=sys_msg,
                user_parts=user_parts,
                model=self.model,
                response_mime_type="application/json",
            )
        return _parse_json(raw)


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json(raw: str) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw  # defensive
    text = raw or ""
    # Strip ```json fences if present
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_RE.search(text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError as exc:
                logger.error("Gemini returned non-JSON: %s", exc)
        return {
            "reasoning_summary": "Parser could not decode model output.",
            "outfit_recommendations": [],
            "shopping_suggestions": [],
            "do_dont": [],
            "spoken_reply": text[:400],
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
