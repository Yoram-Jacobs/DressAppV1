"""Mock image generation provider for automated testing and offline development."""
from __future__ import annotations

import base64
from typing import Any

from app.services.image_generation.base import ImageGenerationProvider, ImageGenerationResult

# 1x1 transparent PNG fixture
DUMMY_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


class MockImageProvider(ImageGenerationProvider):
    """Deterministic mock provider returning test PNG fixtures without external API calls."""

    def __init__(self, model_name: str = "mock-flux-model") -> None:
        self.model_name = model_name

    async def edit_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mask_bytes: bytes | None = None,
        strength: float = 0.45,
        garment_metadata: dict[str, Any] | None = None,
    ) -> ImageGenerationResult:
        """Returns mock result echoing metadata."""
        return ImageGenerationResult(
            image_bytes=DUMMY_PNG_BYTES,
            mime_type="image/png",
            provider="mock",
            model_name=self.model_name,
            latency_ms=15,
            metadata={
                "mock": True,
                "input_length": len(image_bytes),
                "prompt": prompt,
                "strength": strength,
                "has_mask": bool(mask_bytes),
                "garment_metadata": garment_metadata,
            },
        )

    async def generate_image(
        self,
        prompt: str,
        *,
        aspect_ratio: str = "1:1",
    ) -> ImageGenerationResult:
        """Returns mock generated image result."""
        return ImageGenerationResult(
            image_bytes=DUMMY_PNG_BYTES,
            mime_type="image/png",
            provider="mock",
            model_name=self.model_name,
            latency_ms=10,
            metadata={
                "mock": True,
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
            },
        )

    async def health_check(self) -> bool:
        """Mock is always healthy."""
        return True
