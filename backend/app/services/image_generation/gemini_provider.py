"""Gemini Nano Banana adapter implementing ImageGenerationProvider."""
from __future__ import annotations

import base64
import logging
import time
from typing import Any

from app.services.gemini_image_service import GeminiImageService
from app.services.image_generation.base import ImageGenerationProvider, ImageGenerationResult

logger = logging.getLogger(__name__)


class GeminiImageProvider(ImageGenerationProvider):
    """Adapter wrapping GeminiImageService (Nano Banana: gemini-3.1-flash-lite-image)."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key
        self._service = GeminiImageService(api_key=api_key)
        self.model_name = self._service.model

    async def edit_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mask_bytes: bytes | None = None,
        strength: float = 0.45,
        garment_metadata: dict[str, Any] | None = None,
    ) -> ImageGenerationResult:
        """Delegates garment editing to legacy GeminiImageService.edit()."""
        t0 = time.time()
        res = await self._service.edit(
            image=image_bytes,
            prompt=prompt,
            garment_metadata=garment_metadata,
        )
        latency_ms = int((time.time() - t0) * 1000)

        image_raw = res.get("image_b64", "")
        output_bytes = base64.b64decode(image_raw)

        return ImageGenerationResult(
            image_bytes=output_bytes,
            mime_type=res.get("mime_type", "image/png"),
            provider="gemini",
            model_name=res.get("model_used", self.model_name),
            latency_ms=latency_ms,
            metadata={"text": res.get("text", "")},
        )

    async def generate_image(
        self,
        prompt: str,
        *,
        aspect_ratio: str = "1:1",
    ) -> ImageGenerationResult:
        """Delegates text-to-image to legacy GeminiImageService.generate()."""
        t0 = time.time()
        res = await self._service.generate(prompt=prompt)
        latency_ms = int((time.time() - t0) * 1000)

        image_raw = res.get("image_b64", "")
        output_bytes = base64.b64decode(image_raw)

        return ImageGenerationResult(
            image_bytes=output_bytes,
            mime_type=res.get("mime_type", "image/png"),
            provider="gemini",
            model_name=res.get("model_used", self.model_name),
            latency_ms=latency_ms,
            metadata={"text": res.get("text", "")},
        )

    async def health_check(self) -> bool:
        """Checks if Gemini client is initialized."""
        return bool(self._service and self._service.api_key)
