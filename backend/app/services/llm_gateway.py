"""llm_gateway.py - Centralized gateway routing DressApp's LLM completions to Google Gemini (gemini-3.5-flash-lite).

Phase 2 Architecture:
- Google Gemini (gemini-3.5-flash-lite) is formalized as DressApp's primary LLM model across all pipelines:
  1. Wardrobe Migration Agent (wardrobe_migration_agent.py)
  2. AI Stylist & Scheduled Outfit Brain (gemini_stylist.py)
  3. Suitcase Packing Assistant (suitcase.py)
  4. Trend Scout Localization & Card Summaries (trend_scout.py)
  5. Session Title Generator (session_titles.py)
  6. Closet Chat & Photo Re-analysis (ingestion.py)

Phase 3 Architecture:
- On-prem DressApp Eyes Gemma-4-E4B on the Hetzner VPS (http://eyes:7860/predict) is preserved as:
  1. Free-Tier baseline / zero-BYOK model (when requested or running background unauthenticated cron).
  2. Quota Safety Net (transparent fallback on Gemini 429 / RESOURCE_EXHAUSTED / timeout / connection failure).
"""
from __future__ import annotations

import base64
import logging
import re
from typing import Any

from app.config import settings
from app.services.eyes_override import get_active_provider
from app.services.vision.llm import _call_gemma_space
from app.services.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

# Pattern to strip internal chain-of-thought channel tokens emitted by fine-tuned reasoning models
THOUGHT_PATTERN = re.compile(r"<\|channel\>thought.*?<channel\|>", re.DOTALL)
THINK_TAG_PATTERN = re.compile(r"<think>.*?</think>", re.DOTALL)

DEFAULT_MAIN_MODEL = "gemini-3.5-flash-lite"


def strip_thinking_tokens(text: str) -> str:
    """Removes thinking channel markers and scratchpads from model text."""
    if not text:
        return ""
    cleaned = THOUGHT_PATTERN.sub("", text)
    cleaned = THINK_TAG_PATTERN.sub("", cleaned)
    return cleaned.strip()


async def call_main_llm(
    *,
    user_text: str,
    system_prompt: str | None = None,
    image_b64_jpeg: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.2,
    json_schema: dict[str, Any] | None = None,
    response_mime_type: str | None = None,
    think: bool = False,
    api_key: str | None = None,
    model: str | None = None,
    fallback_model: str | None = None,
    force_provider: str | None = None,
) -> str:
    """Invokes the primary DressApp LLM (Google Gemini gemini-3.5-flash-lite) with on-prem Eyes Gemma-4-E4B VPS fallback.

    Args:
        user_text: Prompt or query from the user/agent.
        system_prompt: Guiding system persona or constraints.
        image_b64_jpeg: Optional base64 JPEG for multimodal analysis.
        max_tokens: Maximum tokens to generate.
        temperature: Sampling temperature.
        json_schema: Target JSON schema for constrained generation.
        response_mime_type: Target MIME type (e.g. 'application/json').
        think: Whether reasoning/thinking is explicitly enabled.
        api_key: Optional Gemini API key override for fallback.
        model: Target model name (defaults to gemini-3.5-flash-lite).
        fallback_model: Backward-compatible alias for target Gemini model name.
        force_provider: Explicit provider override ('gemini' or 'gemma').

    Returns:
        Generated text / JSON string.
    """
    provider = (force_provider or await get_active_provider()).lower()
    target_model = model or fallback_model or DEFAULT_MAIN_MODEL

    # Normalization: ensure cost-effective Gemini 3.5 Flash-Lite is preferred unless explicitly specified
    if target_model in ("gemini-3.5-flash", "gemini-2.5-flash"):
        target_model = DEFAULT_MAIN_MODEL

    # 1. Gemma-first branch: activated only if provider explicitly set to gemma (e.g., Free Tier zero-BYOK or admin override)
    if provider in ("gemma", "eyes", "dressapp") and settings.EYES_GEMMA_SPACE_URL:
        try:
            logger.info("Routing LLM completion to on-prem DressApp Eyes Gemma-4-E4B VPS model")
            raw_response = await _call_gemma_space(
                system_prompt=system_prompt or "",
                user_text=user_text,
                image_b64_jpeg=image_b64_jpeg,
                max_tokens=max_tokens,
                temperature=temperature,
                json_schema=json_schema,
                think=think,
            )
            cleaned = strip_thinking_tokens(raw_response)
            if cleaned:
                return cleaned
        except Exception as exc:
            logger.warning(
                "DressApp Eyes Gemma-4-E4B VPS call failed or returned empty; cascading to Gemini fallback (%s): %s",
                target_model,
                exc,
            )

    # 2. Primary Production Branch: Google Gemini (gemini-3.5-flash-lite)
    try:
        active_key = api_key or settings.gemini_chat_key
        if not active_key:
            raise RuntimeError("No Gemini API key configured for call_main_llm")

        client = GeminiClient(api_key=active_key)
        mime_type = response_mime_type or ("application/json" if json_schema else None)

        if image_b64_jpeg:
            try:
                img_bytes = base64.b64decode(image_b64_jpeg)
                user_parts = [user_text, (img_bytes, "image/jpeg")]
            except Exception as b64_err:
                logger.warning("Failed to decode image_b64_jpeg in call_main_llm; proceeding text-only: %s", b64_err)
                user_parts = [user_text]

            logger.info("Executing multimodal LLM completion via Gemini (%s)", target_model)
            return await client.vision(
                user_parts=user_parts,
                system=system_prompt,
                model=target_model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_mime_type=mime_type,
                response_schema=json_schema,
            )
        else:
            logger.info("Executing text LLM completion via Gemini (%s)", target_model)
            return await client.text(
                user_text=user_text,
                system=system_prompt,
                model=target_model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_mime_type=mime_type,
                response_schema=json_schema,
            )
    except Exception as gemini_exc:
        # Phase 3: Quota Safety Net — fallback to on-prem Eyes Gemma-4-E4B on the VPS
        exc_str = str(gemini_exc).lower()
        is_transient_or_quota = (
            "429" in exc_str
            or "quota" in exc_str
            or "resource_exhausted" in exc_str
            or "spending cap" in exc_str
            or "temporarily unavailable" in exc_str
            or "deadline exceeded" in exc_str
            or isinstance(gemini_exc, (TimeoutError, RuntimeError))
        )

        if settings.EYES_GEMMA_SPACE_URL and is_transient_or_quota:
            logger.warning(
                "Gemini (%s) encountered failure/quota limit (%s); activating on-prem Eyes Gemma-4-E4B VPS Quota Safety Net",
                target_model,
                repr(gemini_exc)[:200],
            )
            try:
                raw_response = await _call_gemma_space(
                    system_prompt=system_prompt or "",
                    user_text=user_text,
                    image_b64_jpeg=image_b64_jpeg,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    json_schema=json_schema,
                    think=think,
                )
                cleaned = strip_thinking_tokens(raw_response)
                if cleaned:
                    return cleaned
            except Exception as gemma_exc:
                logger.error("VPS Eyes Gemma-4-E4B safety net also failed: %s", gemma_exc)

        # Re-raise original error if fallback also failed or wasn't applicable
        raise gemini_exc
