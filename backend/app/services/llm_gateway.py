"""llm_gateway.py - Centralized gateway routing DressApp's LLM completions to DressApp Eyes Gemma4-E4B VPS model.

All tiers use the on-prem DressApp Eyes Gemma4-E4B model (llama-server on http://eyes:7860) as the primary LLM.
Fallback to GeminiClient occurs only if Eyes Gemma is temporarily unreachable or fails.
"""
from __future__ import annotations

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
    max_tokens: int = 1024,
    temperature: float = 0.2,
    json_schema: dict[str, Any] | None = None,
    response_mime_type: str | None = None,
    think: bool = False,
    api_key: str | None = None,
    fallback_model: str = "gemini-3.5-flash",
) -> str:
    """Invokes the main DressApp LLM (DressApp Eyes Gemma4-E4B) with graceful Gemini fallback.

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
        fallback_model: Target Gemini model name for fallback.

    Returns:
        Generated text / JSON string.
    """
    provider = (await get_active_provider()).lower()

    if provider == "gemma" and settings.EYES_GEMMA_SPACE_URL:
        try:
            logger.info("Routing LLM completion to DressApp Eyes Gemma4-E4B VPS model")
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
                "DressApp Eyes Gemma4-E4B VPS call failed or returned empty; falling back to Gemini (%s): %s",
                fallback_model,
                exc,
            )

    # Fallback path to Gemini
    logger.info("Executing LLM completion via Gemini fallback (%s)", fallback_model)
    client = GeminiClient(api_key=api_key or settings.GEMINI_API_KEY)
    return await client.text(
        user_text=user_text,
        system=system_prompt,
        model=fallback_model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_mime_type=response_mime_type or ("application/json" if json_schema else None),
        response_schema=json_schema,
    )
