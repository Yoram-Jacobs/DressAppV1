"""Native Google Gemini client wrapper (``google-genai`` SDK).

This is the SINGLE SDK touchpoint for every backend module that calls
Gemini for chat / vision / streaming. Replaces the previous
``emergentintegrations.llm.chat.LlmChat`` + ``litellm`` stack, which
routed through the Emergent proxy when ``EMERGENT_LLM_KEY`` was set.

Why a wrapper module
====================

* Keeps the SDK surface in ONE file — future ``google-genai`` upgrades
  touch one place, not six.
* Centralises auth, timeouts, retries, and JSON-mode handling so all
  callers behave consistently.
* Hides the sync/async split: the SDK exposes both ``client.models``
  (sync) and ``client.aio.models`` (async). The wrapper uses the
  async surface so FastAPI handlers can ``await`` without
  ``asyncio.to_thread`` boilerplate.
* Lets us migrate modules one at a time without forking the wrapper.

Migration notes
---------------

* Old: ``LlmChat(api_key=..., session_id=..., system_message=...)
   .with_model("gemini", model).send_message(UserMessage(text=..., file_contents=[ImageContent(b64)]))``
  → ``await client.vision(system=..., user_text=..., images=[<bytes>], model=...)``
* Old: ``litellm.acompletion(stream=True, ...)`` async-iterating
  ``chunk.choices[0].delta.content``
  → ``async for chunk in client.stream_vision(...): yield chunk.text``
* JSON-mode: pass ``response_mime_type="application/json"`` so Gemini
  emits clean JSON without prose. Optional ``response_schema`` further
  grammar-constrains the output (handy for the Eyes garment schema).

Key naming
----------

The wrapper reads ``settings.GEMINI_API_KEY`` (production / .env). The
historical ``EMERGENT_LLM_KEY`` fallback is intentionally NOT honoured
here — that key only works through the Emergent proxy and has no
meaning to the native Google endpoint. Keeping ``EMERGENT_LLM_KEY``
defined in env / config is fine (rollback safety) but it never feeds
into native calls.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
from typing import Any, AsyncIterator, Iterable

from app.config import settings

logger = logging.getLogger(__name__)


# Lazy import of the SDK — keeps the rest of the codebase importable
# even when ``google-genai`` is not installed (CI / minimal images /
# the Emergent lightweight-deploy pod).
try:
    from google import genai as _genai  # type: ignore
    from google.genai import types as _genai_types  # type: ignore
except Exception as _exc:  # noqa: BLE001
    _genai = None  # type: ignore[assignment]
    _genai_types = None  # type: ignore[assignment]
    logger.info("google-genai not importable: %s", _exc)


# Default model used when the caller doesn't specify one. Matches the
# historical Gemini Flash routing through Emergent / litellm.
DEFAULT_TEXT_MODEL = "gemini-3.5-flash"
DEFAULT_VISION_MODEL = "gemini-3.5-flash"

# A type alias for "anything that can become a Part" — accepted by
# :meth:`GeminiClient.vision` / ``stream_vision``.
#   * ``str``  → text part
#   * ``bytes`` → image part (assumed image/jpeg unless a 2-tuple is given)
#   * ``tuple[bytes, str]`` → (image_bytes, mime_type)
#   * an SDK ``types.Part`` instance — passed through unchanged.
ContentPart = "str | bytes | tuple[bytes, str] | Any"


class GeminiUnavailable(RuntimeError):
    """Raised when google-genai isn't importable or no API key is set."""


def _require_sdk() -> None:
    if _genai is None or _genai_types is None:
        raise GeminiUnavailable(
            "google-genai is not installed. Add `google-genai>=2.4.0` "
            "to requirements.txt and reinstall the backend."
        )


def _resolve_api_key(explicit: str | None) -> str:
    """Pick the API key — explicit wins, else ``settings.GEMINI_API_KEY``.

    Note: ``settings.GOOGLE_API_KEY`` is *already* aliased into
    ``GEMINI_API_KEY`` inside ``config.py``; we just need to check the
    one canonical attribute here.
    """
    key = explicit or settings.GEMINI_API_KEY
    if not key:
        raise GeminiUnavailable(
            "GEMINI_API_KEY is not configured. Set it in /app/backend/.env "
            "(or pass api_key= explicitly to GeminiClient)."
        )
    return key


def _coerce_content_parts(parts: Iterable[Any]) -> list[Any]:
    """Translate the wrapper's lightweight content syntax into SDK content parts."""
    _require_sdk()
    out: list[Any] = []
    for entry in parts:
        if entry is None:
            continue
        if isinstance(entry, str):
            out.append(entry)
        elif isinstance(entry, (bytes, bytearray)):
            # Detect JPEG vs PNG vs WebP
            mime = "image/jpeg"
            if entry.startswith(b"\x89PNG\r\n\x1a\n"):
                mime = "image/png"
            elif entry.startswith(b"RIFF") and len(entry) > 12 and entry[8:12] == b"WEBP":
                mime = "image/webp"
            out.append(_genai_types.Part.from_bytes(data=bytes(entry), mime_type=mime))
        elif (
            isinstance(entry, tuple)
            and len(entry) == 2
            and isinstance(entry[0], (bytes, bytearray))
            and isinstance(entry[1], str)
        ):
            blob, mime = entry
            out.append(_genai_types.Part.from_bytes(data=bytes(blob), mime_type=mime or "image/jpeg"))
        elif hasattr(entry, "inline_data") or hasattr(entry, "text"):
            out.append(entry)
        elif isinstance(entry, dict) and "data" in entry and "mime_type" in entry:
            try:
                raw_b = base64.b64decode(entry["data"])
                out.append(_genai_types.Part.from_bytes(data=raw_b, mime_type=entry["mime_type"]))
            except Exception:
                out.append(entry)
        else:
            out.append(entry)
    return out


class GeminiClient:
    """Async wrapper around ``google.genai.Client`` using standard Models API.

    Construct once per service (cheap, thread-safe). The wrapper holds
    a single SDK client and exposes three call surfaces:

    * :meth:`text`         — text-only, non-streaming.
    * :meth:`vision`       — multimodal, non-streaming.
    * :meth:`stream_vision` — multimodal, streaming (yields text chunks).

    All three honour the same ``system`` instruction / ``response_mime_type``
    / ``response_schema`` knobs so callers can express JSON-mode requests
    uniformly.
    """

    def __init__(self, api_key: str | None = None) -> None:
        _require_sdk()
        self.api_key = _resolve_api_key(api_key)
        self._client = _genai.Client(api_key=self.api_key)

    def _build_config(
        self,
        *,
        system: str | None,
        temperature: float | None,
        max_tokens: int | None,
        response_mime_type: str | None,
        response_schema: dict[str, Any] | None,
    ) -> Any:
        cfg_kwargs: dict[str, Any] = {}
        if system:
            cfg_kwargs["system_instruction"] = system
        if temperature is not None:
            cfg_kwargs["temperature"] = float(temperature)
        if max_tokens is not None:
            cfg_kwargs["max_output_tokens"] = int(max_tokens)
        if response_mime_type:
            cfg_kwargs["response_mime_type"] = response_mime_type
        if response_schema:
            if hasattr(response_schema, "model_json_schema"):
                cfg_kwargs["response_schema"] = response_schema.model_json_schema()
            else:
                cfg_kwargs["response_schema"] = response_schema

        if cfg_kwargs and _genai_types is not None:
            return _genai_types.GenerateContentConfig(**cfg_kwargs)
        return None

    # ------------------------------------------------------------------ text
    async def text(
        self,
        *,
        user_text: str,
        system: str | None = None,
        model: str = DEFAULT_TEXT_MODEL,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_mime_type: str | None = None,
        response_schema: dict[str, Any] | None = None,
    ) -> str:
        """Text-only completion. Returns the model's response text."""
        config = self._build_config(
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            response_mime_type=response_mime_type,
            response_schema=response_schema,
        )
        resp = await self._client.aio.models.generate_content(
            model=_normalise_model(model),
            contents=user_text,
            config=config,
        )
        return _coerce_text(resp)

    # ----------------------------------------------------------------- vision
    async def vision(
        self,
        *,
        user_parts: Iterable[Any],
        system: str | None = None,
        model: str = DEFAULT_VISION_MODEL,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_mime_type: str | None = None,
        response_schema: dict[str, Any] | None = None,
    ) -> str:
        """Multimodal completion (text + image parts). Non-streaming.

        ``user_parts`` is an iterable of strings (text), bytes (treated
        as image/jpeg or png), ``(bytes, mime_type)`` tuples, or any SDK
        ``types.Part``. Order is preserved.
        """
        config = self._build_config(
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            response_mime_type=response_mime_type,
            response_schema=response_schema,
        )
        contents = _coerce_content_parts(user_parts)
        resp = await self._client.aio.models.generate_content(
            model=_normalise_model(model),
            contents=contents,
            config=config,
        )
        return _coerce_text(resp)

    # --------------------------------------------------------------- streaming
    async def stream_vision(
        self,
        *,
        user_parts: Iterable[Any],
        system: str | None = None,
        model: str = DEFAULT_VISION_MODEL,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_mime_type: str | None = None,
        response_schema: dict[str, Any] | None = None,
    ) -> AsyncIterator[str]:
        """Streaming multimodal completion. Yields text deltas."""
        config = self._build_config(
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            response_mime_type=response_mime_type,
            response_schema=response_schema,
        )
        contents = _coerce_content_parts(user_parts)
        stream = await self._client.aio.models.generate_content_stream(
            model=_normalise_model(model),
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            txt = getattr(chunk, "text", None)
            if txt:
                yield txt


# ---------------------------------------------------------------------- helpers
def _normalise_model(model: str) -> str:
    """Strip provider prefixes the legacy ``litellm`` path required.

    Old code passed ``"gemini/gemini-2.5-flash"`` so litellm would route
    through Google's GenAI API. The native SDK only wants the bare
    model id (``"gemini-3.5-flash-lite"``).
    """
    if not model:
        return DEFAULT_TEXT_MODEL
    if model.startswith("gemini/"):
        return model.split("/", 1)[1]
    if model.startswith("google/"):
        return model.split("/", 1)[1]
    return model


def _coerce_text(resp: Any) -> str:
    """Pull the text payload out of an Interaction response.

    Retrieves output_text from the interaction object. Falls back to walk candidates if needed.
    """
    if resp is None:
        return ""
    if hasattr(resp, "output_text"):
        return resp.output_text
    if isinstance(resp, dict) and "output_text" in resp:
        return resp["output_text"]

    text = getattr(resp, "text", None)
    if text:
        return text
    # Walk candidates → content.parts → part.text.
    candidates = getattr(resp, "candidates", None) or []
    out: list[str] = []
    for cand in candidates:
        content = getattr(cand, "content", None)
        if content is None:
            continue
        parts = getattr(content, "parts", None) or []
        for part in parts:
            txt = getattr(part, "text", None)
            if txt:
                out.append(txt)
    return "".join(out)


# Module-level singleton convenience — most call sites only need one
# client per process. They can also instantiate ``GeminiClient()``
# directly if they want a separate instance.
_default_client: GeminiClient | None = None
_default_client_lock = asyncio.Lock()


async def get_default_client() -> GeminiClient:
    """Return a process-wide default :class:`GeminiClient` (lazy-init)."""
    global _default_client
    if _default_client is None:
        async with _default_client_lock:
            if _default_client is None:
                _default_client = GeminiClient()
    return _default_client


def get_default_client_sync() -> GeminiClient:
    """Synchronous variant for module-init contexts that aren't async.

    Most callers want :func:`get_default_client`; this exists for the
    ``GarmentVisionService.__init__`` use case where the constructor
    must run in a sync ``__init__``.
    """
    global _default_client
    if _default_client is None:
        _default_client = GeminiClient()
    return _default_client


__all__ = [
    "GeminiClient",
    "GeminiUnavailable",
    "DEFAULT_TEXT_MODEL",
    "DEFAULT_VISION_MODEL",
    "get_default_client",
    "get_default_client_sync",
]
