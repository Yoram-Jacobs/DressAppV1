"""Native Google Gemini image service — Nano Banana (gemini-2.5-flash-image).

Why this exists as its own service:

* The Emergent proxy does not route image-generation traffic to Gemini, so
  this module talks to Google's API directly via ``google-genai`` using
  ``settings.GEMINI_API_KEY``.
* Nano Banana is the GA image-gen / edit model optimised for fast,
  photorealistic, character-consistent product shots — used by the
  reconstruction pipeline (``services/reconstruction.py``) and the
  ``POST /api/v1/closet/{id}/edit-image`` endpoint.

History note (May 2026): an older sibling module ``hf_image_service`` ran
HF FLUX.1-schnell as a fallback. That fallback was retired when the user
asked for HF to be removed from the runtime surface — Nano Banana is now
the sole image-generation backend.

Public surface:

* ``generate(prompt) -> {image_b64, mime_type, model_used, text}``
* ``edit(image_bytes, prompt, *, garment_metadata=None) -> {...}``

Both calls are wrapped in ``asyncio.to_thread`` so they're safe inside a
FastAPI request without blocking the event loop.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


# Lazy import of the SDK — keeps the rest of the codebase importable even
# when google-genai is not installed (CI / minimal images).
try:
    from google import genai as _genai  # type: ignore
    from google.genai import types as _genai_types  # type: ignore
except Exception as _exc:  # noqa: BLE001
    _genai = None  # type: ignore[assignment]
    _genai_types = None  # type: ignore[assignment]
    logger.info("google-genai not importable: %s", _exc)


def _coerce_image_part(part: Any) -> bytes | None:
    """Extract image bytes from a Gemini response part."""
    inline = getattr(part, "inline_data", None)
    if inline is None:
        return None
    data = getattr(inline, "data", None)
    if not data:
        return None
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    # Some SDK versions return base64-encoded strings.
    if isinstance(data, str):
        try:
            return base64.b64decode(data)
        except Exception:  # noqa: BLE001
            return None
    return None


class GeminiImageService:
    """Thin async wrapper around `google-genai` for Nano Banana."""

    def __init__(self) -> None:
        if _genai is None:
            raise RuntimeError(
                "google-genai is not installed. Add `google-genai` to "
                "requirements.txt and reinstall."
            )
        if not settings.GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured. Required for Nano Banana."
            )
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_IMAGE_MODEL
        # The SDK is sync — we instantiate a Client per service and call it
        # from a worker thread. The client is cheap and thread-safe.
        self._client = _genai.Client(api_key=self.api_key)

    # ------------------------------------------------------------------ public
    async def generate(
        self, prompt: str, *, session_id: str | None = None
    ) -> dict[str, Any]:
        """Pure text-to-image. Returns ``{image_b64, mime_type, model_used, text}``."""
        return await asyncio.to_thread(self._run_generate, prompt, None)

    async def edit(
        self,
        image: bytes | str,
        prompt: str,
        *,
        garment_metadata: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Image + text → image (the Wardrobe Reconstructor entry point).

        Composes a rich descriptive prompt out of the user's edit
        instruction + the garment metadata coming from The Eyes, then
        feeds the original crop alongside it so Nano Banana preserves
        fabric texture, pattern, and silhouette while only repairing
        the missing / clipped areas.
        """
        composed = self._build_edit_prompt(prompt, garment_metadata)
        image_bytes = await _to_bytes(image)
        return await asyncio.to_thread(self._run_generate, composed, image_bytes)

    # ------------------------------------------------------------------ internals
    def _run_generate(
        self,
        prompt: str,
        image_bytes: bytes | None,
    ) -> dict[str, Any]:
        from app.services import provider_activity

        last_exc: Exception | None = None
        for attempt in range(3):
            t0 = time.time()
            try:
                contents: list[Any] = [prompt]
                if image_bytes:
                    # Pass the source image as an inline Part so the model
                    # has the actual pixels to edit / outpaint from.
                    assert _genai_types is not None  # mypy
                    contents.append(
                        _genai_types.Part.from_bytes(
                            data=image_bytes,
                            mime_type=_detect_mime_type(image_bytes),
                        )
                    )
                with provider_activity.Track(
                    "gemini-image",
                    {"model": self.model, "edit": bool(image_bytes)},
                ):
                    resp = self._client.models.generate_content(
                        model=self.model,
                        contents=contents,
                    )
                # Find the first inline image part.
                raw: bytes | None = None
                text_out = ""
                candidates = getattr(resp, "candidates", []) or []
                for cand in candidates:
                    parts = getattr(getattr(cand, "content", None), "parts", []) or []
                    for part in parts:
                        if raw is None:
                            raw = _coerce_image_part(part)
                        if raw is None:
                            txt = getattr(part, "text", None)
                            if txt:
                                text_out += str(txt)
                    if raw:
                        break
                if not raw:
                    cand_details = []
                    for i, cand in enumerate(candidates):
                        fr = getattr(cand, "finish_reason", "unknown")
                        sr = getattr(cand, "safety_ratings", []) or []
                        sr_str = ", ".join(f"{getattr(r, 'category', '')}={getattr(r, 'probability', '')}" for r in sr)
                        cand_details.append(f"Candidate {i} (finish_reason={fr}, safety={sr_str})")
                    details_msg = "; ".join(cand_details)
                    raise RuntimeError(
                        "Gemini image response had no inline_data part "
                        f"(text='{text_out[:160]}', details={details_msg})"
                    )
                logger.info(
                    "Nano Banana OK (%s, %.1fs, %d bytes, edit=%s)",
                    self.model,
                    time.time() - t0,
                    len(raw),
                    bool(image_bytes),
                )
                return {
                    "image_b64": base64.b64encode(raw).decode("ascii"),
                    "mime_type": "image/png",
                    "model_used": self.model,
                    "text": text_out,
                }
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                msg = repr(exc)
                transient = any(
                    tok in msg
                    for tok in ("503", "504", "timeout", "Timeout", "TimeoutException", "RESOURCE_EXHAUSTED")
                )
                if not transient or attempt == 2:
                    logger.warning(
                        "Nano Banana failed (attempt %d, giving up): %s",
                        attempt + 1,
                        msg[:240],
                    )
                    raise
                wait = 1.5 * (2 ** attempt)
                logger.info(
                    "Nano Banana transient error (attempt %d, sleeping %.1fs): %s",
                    attempt + 1,
                    wait,
                    msg[:160],
                )
                time.sleep(wait)
        assert last_exc is not None
        raise last_exc

    @staticmethod
    def _build_edit_prompt(
        user_prompt: str, meta: dict[str, Any] | None
    ) -> str:
        if "High-fidelity editorial product photograph" in user_prompt or "Studio lighting" in user_prompt:
            return user_prompt[:1000]
        meta = meta or {}
        descriptor_bits: list[str] = []
        for key in ("color", "material", "pattern", "category"):
            v = meta.get(key)
            if v:
                descriptor_bits.append(str(v))
        descriptor = ", ".join(descriptor_bits) if descriptor_bits else "garment"
        composed = (
            f"Commercial fashion catalog product photograph of a complete, isolated "
            f"{descriptor}. {user_prompt}. Centered composition filling the frame, "
            "neutral DressApp card background (#F5F2EB / light warm neutral backdrop), studio lighting, "
            "crisp edges, photorealistic, preserve all fabric texture, color fidelity, "
            "and silhouette details, no dark shadows, no dark vignette, no black backdrop, "
            "no people, no mannequin body, no text, no logos, no watermarks."
        )
        return composed[:1000]


def _detect_mime_type(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data.startswith(b"RIFF") and len(data) > 12 and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"GIF8"):
        return "image/gif"
    return "image/jpeg"  # default fallback


# ----------------------------------------------------------------- helpers
async def _to_bytes(image: bytes | str) -> bytes:
    if isinstance(image, bytes):
        return image
    if image.startswith("data:"):
        return base64.b64decode(image.split(",", 1)[1])
    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(image, follow_redirects=True)
        resp.raise_for_status()
        return resp.content


# Module-level singleton — None when the direct Gemini key is absent. The
# legacy HF FLUX fallback was retired in May 2026, so callers must handle
# the None case (typically a 503 surfaced to the user).
gemini_image_service = (
    GeminiImageService() if (settings.has_native_gemini and _genai is not None) else None
)

if gemini_image_service is None:
    logger.info(
        "Nano Banana disabled (no GEMINI_API_KEY or google-genai missing). "
        "Image edit / reconstruction endpoints will return 503 until a "
        "direct GEMINI_API_KEY is configured."
    )
else:
    logger.info(
        "Nano Banana enabled — model=%s", gemini_image_service.model
    )
