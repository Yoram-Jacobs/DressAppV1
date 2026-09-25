"""Factory for resolving and instantiating image generation providers."""
from __future__ import annotations

import logging
import os
from typing import Any

from app.config import settings
from app.services.image_generation.base import ImageGenerationProvider
from app.services.image_generation.gemini_provider import GeminiImageProvider
from app.services.image_generation.mock_provider import MockImageProvider
from app.services.image_generation.runpod_provider import RunpodFluxProvider

logger = logging.getLogger(__name__)


def get_image_provider(
    user_custom_gemini_key: str | None = None,
    provider_override: str | None = None,
) -> ImageGenerationProvider:
    """Resolves and returns the configured ImageGenerationProvider instance.

    Priority order:
    1. Explicit provider_override if provided ('runpod', 'gemini', 'mock').
    2. Environment variable settings.IMAGE_GENERATION_PROVIDER.
    3. Fallback to Gemini if RunPod credentials are not configured.
    4. Fallback to Mock if no credentials exist and running in testing environment.
    """
    selected = (provider_override or getattr(settings, "IMAGE_GENERATION_PROVIDER", "runpod")).lower().strip()

    if selected == "mock":
        return MockImageProvider()

    gemini_key = user_custom_gemini_key or getattr(settings, "GEMINI_API_KEY", None)

    if selected == "runpod":
        runpod_key = getattr(settings, "RUNPOD_API_KEY", None) or os.environ.get("RUNPOD_API_KEY")
        endpoint_id = getattr(settings, "RUNPOD_FLUX_ENDPOINT_ID", None) or os.environ.get("RUNPOD_FLUX_ENDPOINT_ID")
        model_name = getattr(settings, "RUNPOD_FLUX_MODEL", "flux.2-klein-4b")
        timeout = getattr(settings, "RUNPOD_TIMEOUT_SECONDS", 60)
        runsync_timeout = getattr(settings, "RUNPOD_RUNSYNC_TIMEOUT", 25)
        poll_timeout = getattr(settings, "RUNPOD_POLL_TIMEOUT", 120)
        max_concurrency = getattr(settings, "RUNPOD_MAX_CONCURRENCY", 4)
        max_retries = getattr(settings, "RUNPOD_MAX_RETRIES", 3)
        enable_fallback = getattr(settings, "IMAGE_GENERATION_ENABLE_FALLBACK", True)

        # Build fallback provider if enabled
        fallback: ImageGenerationProvider | None = None
        if enable_fallback:
            if gemini_key:
                try:
                    fallback = GeminiImageProvider(api_key=gemini_key)
                except Exception as exc:
                    logger.warning("Could not initialize Gemini fallback provider: %s", exc)
            elif os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("USE_MOCK_IMAGE_PROVIDER", "").lower() == "true":
                fallback = MockImageProvider()

        if runpod_key and endpoint_id:
            return RunpodFluxProvider(
                api_key=runpod_key,
                endpoint_id=endpoint_id,
                model_name=model_name,
                timeout=timeout,
                runsync_timeout=runsync_timeout,
                poll_timeout=poll_timeout,
                max_concurrency=max_concurrency,
                max_retries=max_retries,
                fallback_provider=fallback,
            )

        logger.warning(
            "RunPod credentials missing (RUNPOD_API_KEY or RUNPOD_FLUX_ENDPOINT_ID); "
            "attempting fallback to Gemini Nano Banana."
        )

    # Fallback or explicit Gemini provider
    if gemini_key:
        try:
            return GeminiImageProvider(api_key=gemini_key)
        except Exception as exc:
            logger.warning("GeminiImageProvider initialization failed: %s", exc)

    # Check if pytest or local dev without any keys
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("USE_MOCK_IMAGE_PROVIDER", "").lower() == "true":
        logger.info("Using MockImageProvider for test/mock environment.")
        return MockImageProvider()

    # If runpod was requested but keys missing, raise descriptive error
    if selected == "runpod":
        raise RuntimeError(
            "RunPod image generation requires RUNPOD_API_KEY and RUNPOD_FLUX_ENDPOINT_ID. "
            "Configure them in .env or switch IMAGE_GENERATION_PROVIDER=gemini."
        )

    raise RuntimeError(
        "No image generation provider could be configured. "
        "Provide RUNPOD_API_KEY or GEMINI_API_KEY."
    )
