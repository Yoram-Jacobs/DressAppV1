"""Base abstractions and result schemas for image generation providers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ImageGenerationResult:
    """Standardized result returned by all image generation providers."""
    image_bytes: bytes
    mime_type: str = "image/png"
    provider: str = "runpod"
    model_name: str = "flux.2-klein-4b"
    latency_ms: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


class ImageGenerationProvider(ABC):
    """Abstract base class defining the contract for garment image generation/editing."""

    @abstractmethod
    async def edit_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mask_bytes: bytes | None = None,
        strength: float = 0.45,
        garment_metadata: dict[str, Any] | None = None,
    ) -> ImageGenerationResult:
        """Edit or reconstruct an existing garment image.

        Args:
            image_bytes: Raw binary bytes of the input garment image.
            prompt: Editing or restoration prompt instruction.
            mask_bytes: Optional binary mask bytes for inpainting/targeted editing.
            strength: Denoising strength (clamped between 0.35 and 0.65).
            garment_metadata: Optional dictionary with taxonomy from The Eyes.

        Returns:
            ImageGenerationResult containing the generated image bytes and metadata.
        """
        pass

    @abstractmethod
    async def generate_image(
        self,
        prompt: str,
        *,
        aspect_ratio: str = "1:1",
    ) -> ImageGenerationResult:
        """Generate a new garment product photograph from a text prompt.

        Args:
            prompt: Text prompt describing the garment and studio setup.
            aspect_ratio: Aspect ratio (default: "1:1").

        Returns:
            ImageGenerationResult containing the generated image bytes and metadata.
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify upstream provider availability and authentication."""
        pass
