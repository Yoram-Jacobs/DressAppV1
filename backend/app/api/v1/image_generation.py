"""Isolated test and diagnostic router for FLUX.2 Klein 4B / Nano Banana image generation."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.services.auth import require_admin
from app.services.image_generation.factory import get_image_provider
from app.services.security_validator import SafeFetchError, is_safe_external_url, safe_fetch_external
from app.services.upload_manager import UploadManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image-generation", tags=["image-generation"])

_MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15 MB upload / remote fetch cap
_ALLOWED_IMAGE_CONTENT_TYPES = frozenset({
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
})


async def _read_bounded_upload(upload: UploadFile, max_bytes: int = _MAX_IMAGE_BYTES) -> bytes:
    """Read an uploaded image incrementally and fail fast if it exceeds max_bytes."""
    buf = bytearray()
    while True:
        chunk = await upload.read(65536)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Uploaded image exceeds maximum {max_bytes // (1024 * 1024)} MB limit.",
            )
    return bytes(buf)


@router.get("/health")
async def provider_health(
    provider: str | None = None,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Check health and credential status of configured or requested image provider."""
    try:
        instance = get_image_provider(provider_override=provider)
        healthy = await instance.health_check()
        return {
            "status": "healthy" if healthy else "degraded",
            "provider": getattr(instance, "model_name", "unknown"),
            "class": instance.__class__.__name__,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Image provider health check failed: %s", exc)
        return {
            "status": "unhealthy",
            "error": "Image generation provider unavailable",
        }


@router.post("/test")
async def test_image_generation(
    prompt: str = Form(..., description="Prompt instruction for generation or edit"),
    image: UploadFile | None = File(None, description="Optional input garment image to edit/reconstruct"),
    image_url: str | None = Form(None, description="Optional public URL to input image"),
    provider: str | None = Form(None, description="Provider override: 'runpod', 'gemini', or 'mock'"),
    strength: float = Form(0.45, description="Denoising strength (0.35 - 0.65)"),
    aspect_ratio: str = Form("1:1", description="Aspect ratio for text-to-image"),
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Isolated admin-only test endpoint to evaluate FLUX.2 Klein 4B without modifying closet items."""
    try:
        provider_instance = get_image_provider(provider_override=provider)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Image generation provider error: {exc}",
        ) from exc

    input_bytes: bytes | None = None
    if image is not None:
        input_bytes = await _read_bounded_upload(image)
    elif image_url:
        cleaned_url = image_url.strip()
        if not is_safe_external_url(cleaned_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or prohibited image URL destination",
            )
        try:
            res = await safe_fetch_external(
                cleaned_url,
                timeout=15.0,
                max_redirects=5,
                max_bytes=_MAX_IMAGE_BYTES,
            )
        except SafeFetchError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or prohibited image URL destination: {exc}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to load image from URL: {exc}",
            ) from exc

        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch image from URL: HTTP {res.status_code}",
            )
        raw_ct = (res.headers.get("content-type") or "").split(";")[0].strip().lower()
        if raw_ct and raw_ct not in _ALLOWED_IMAGE_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Remote URL did not return a supported raster image content type.",
            )
        input_bytes = res.content

    try:
        if input_bytes:
            result = await provider_instance.edit_image(
                image_bytes=input_bytes,
                prompt=prompt,
                strength=strength,
            )
        else:
            result = await provider_instance.generate_image(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        # Upload generated bytes via UploadManager to maintain storage contract
        uploaded_url = await UploadManager.upload_bytes(
            file_bytes=result.image_bytes,
            mime_type=result.mime_type,
            extension="png",
        )

        return {
            "status": "success",
            "image_url": uploaded_url,
            "provider": result.provider,
            "model_name": result.model_name,
            "latency_ms": result.latency_ms,
            "metadata": result.metadata,
        }

    except Exception as exc:
        logger.exception("Image generation test failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image generation test failed: {exc}",
        ) from exc
