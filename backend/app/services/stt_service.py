"""Speech-to-Text service using Gemini or Gemma4 sidecar."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import settings
from app.services import eyes_override, provider_activity
from app.services.gemini_client import get_default_client

logger = logging.getLogger(__name__)


class GeminiSTTService:
    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        language: str | None = None,
    ) -> dict[str, Any]:
        """Transcribe audio using native Gemini multimodal capability."""
        t0 = time.perf_counter()
        client = await get_default_client()
        
        # BCP-47 locale mapping / taxonomy helper language honor
        lang_hint = language or "en"
        prompt = (
            "Transcribe this audio precisely. Output ONLY the raw transcription text in the language "
            "it was spoken. Do not add any introductory or concluding text, formatting, or commentary."
        )
        if lang_hint and lang_hint != "auto":
            prompt += f" The audio is expected to be in {lang_hint}."

        logger.info("Gemini STT transcribe bytes=%d language=%s", len(audio_bytes), lang_hint)
        
        ok = False
        last_err: str | None = None
        text = ""
        try:
            # Pass the audio bytes as a (bytes, mime) tuple which gemini_client converts to a Part.
            text = await client.vision(
                user_parts=[prompt, (audio_bytes, content_type)],
                temperature=0.0,
            )
            text = text.strip()
            ok = True
        except Exception as exc:
            last_err = repr(exc)
            logger.exception("Gemini STT transcription failed")
            raise
        finally:
            provider_activity.record(
                "gemini-stt",
                ok=ok,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={"bytes": len(audio_bytes), "language": lang_hint},
            )

        return {"text": text, "language": lang_hint, "raw": {"text": text}}


class EyesSTTService:
    def __init__(self) -> None:
        self.gemini_fallback = GeminiSTTService()

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        language: str | None = None,
    ) -> dict[str, Any]:
        provider = await eyes_override.get_active_provider()
        
        if provider == "gemini":
            return await self.gemini_fallback.transcribe(
                audio_bytes, filename=filename, content_type=content_type, language=language
            )

        # Gemma path: call POST /transcribe on the eyes container
        url = settings.EYES_GEMMA_SPACE_URL
        if not url:
            logger.warning("EYES_PROVIDER=gemma but EYES_GEMMA_SPACE_URL is unset. Falling back to Gemini.")
            return await self.gemini_fallback.transcribe(
                audio_bytes, filename=filename, content_type=content_type, language=language
            )

        t0 = time.perf_counter()
        headers = {}
        if settings.EYES_API_TOKEN:
            headers["Authorization"] = f"Bearer {settings.EYES_API_TOKEN}"

        files = {"file": (filename, audio_bytes, content_type)}
        data = {}
        if language:
            data["language"] = language

        logger.info("Eyes G4 STT transcribe target=%s bytes=%d", url, len(audio_bytes))
        
        ok = False
        last_err: str | None = None
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{url}/transcribe",
                    headers=headers,
                    files=files,
                    data=data,
                )
                if resp.status_code >= 400:
                    raise RuntimeError(f"Eyes container /transcribe failed: {resp.status_code} {resp.text}")
                
                result = resp.json()
                ok = True
                provider_activity.record(
                    "eyes-stt",
                    ok=True,
                    latency_ms=int((time.perf_counter() - t0) * 1000),
                    extra={"bytes": len(audio_bytes), "provider": "gemma"},
                )
                return {
                    "text": result.get("text", "").strip(),
                    "language": result.get("language") or language,
                    "raw": result,
                }
        except Exception as exc:
            last_err = repr(exc)
            logger.warning("Eyes container STT failed (%s). Falling back to Gemini STT.", last_err)
            provider_activity.record(
                "eyes-stt",
                ok=False,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={"bytes": len(audio_bytes), "fallback": "gemini"},
            )
            # Fall back to Gemini STT
            return await self.gemini_fallback.transcribe(
                audio_bytes, filename=filename, content_type=content_type, language=language
            )


stt_service = EyesSTTService()
