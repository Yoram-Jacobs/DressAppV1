"""Text-to-Speech service using native Gemini multimodal capability."""
from __future__ import annotations

import logging
import time
from typing import Any

from app.services import provider_activity
from app.services.gemini_client import get_default_client

logger = logging.getLogger(__name__)


class GeminiTTSService:
    async def speak_to_bytes(
        self,
        text: str,
        voice: str | None = None,
        encoding: str | None = None,
    ) -> bytes:
        """Synthesise text to speech bytes using Gemini's native audio output."""
        t0 = time.perf_counter()
        client = await get_default_client()
        
        # We can map standard voices or specify prebuilt voices
        # Gemini 2.5 voice options: Puck, Charon, Kore, Fenrir, Aoede
        voice_name = "Puck"
        if voice:
            v_lower = voice.lower()
            if "female" in v_lower or "thalia" in v_lower:
                voice_name = "Aoede"
            elif "male" in v_lower:
                voice_name = "Charon"

        logger.info("Gemini TTS speak voice=%s text=%r", voice_name, text[:60])
        
        ok = False
        last_err: str | None = None
        audio_bytes = b""
        try:
            config = {
                "response_modalities": ["AUDIO"],
                "speech_config": {
                    "voice_config": {
                        "prebuilt_voice_config": {
                            "voice_name": voice_name
                        }
                    }
                }
            }
            resp = await client._client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"Read this text aloud: {text}",
                config=config,
            )
            
            for candidate in getattr(resp, "candidates", None) or []:
                content = getattr(candidate, "content", None)
                if content is None:
                    continue
                parts = getattr(content, "parts", None) or []
                for part in parts:
                    inline_data = getattr(part, "inline_data", None)
                    if inline_data and getattr(inline_data, "data", None):
                        audio_bytes = inline_data.data
                        break
                if audio_bytes:
                    break
                    
            if not audio_bytes:
                raise RuntimeError("No audio bytes returned in Gemini TTS response")
                
            ok = True
        except Exception as exc:
            last_err = repr(exc)
            logger.exception("Gemini TTS speech synthesis failed")
            raise
        finally:
            provider_activity.record(
                "gemini-tts",
                ok=ok,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                error=last_err,
                extra={"voice": voice_name, "text_len": len(text)},
            )
            
        return audio_bytes


tts_service = GeminiTTSService()
