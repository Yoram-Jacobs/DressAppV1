"""Provider abstraction for the DressApp Stylist Brain.

As of May 2026, the Stylist runs on Google Gemini (``gemini-2.5-pro``
via ``emergentintegrations`` / direct ``GEMINI_API_KEY``). The factory
keeps a thin Protocol-based abstraction so a future fine-tuned
``Gemma4-E4B`` provider can be slotted in without touching call sites
in ``services/logic.py``.

Earlier waves shipped Alibaba Qwen-VL via DashScope as a temporary
primary brain (Wave O.1). That path was removed in May 2026 — see
``docs/WASTED_WORK_REPORT.md §2.2`` for the rationale.

The public entrypoint is :func:`stylist_brain_service`, which picks
the primary provider based on ``settings.STYLIST_PROVIDER`` and wraps
it in :class:`FallbackBrain` if ``settings.STYLIST_FALLBACK`` is set.
Both the primary and the fallback satisfy the same minimal contract:

    async def advise(self, session_id, user_text, image_base64, image_mime,
                     weather, calendar_events, cultural_rules,
                     user_profile, closet_summary,
                     user_preferences_block) -> dict

so callers in ``services/logic.py`` don't know — and don't need to
know — which brain actually produced the recommendation.
"""
from __future__ import annotations

import logging
from typing import Any, Protocol

from app.config import settings
from app.services.gemini_stylist import gemini_stylist_service

logger = logging.getLogger(__name__)


class StylistBrain(Protocol):
    """Structural contract — any concrete provider satisfies this shape."""

    provider_name: str

    async def advise(
        self,
        *,
        session_id: str,
        user_text: str,
        image_base64: str | None,
        image_mime: str = "image/jpeg",
        weather: dict[str, Any] | None = None,
        calendar_events: list[dict[str, Any]] | None = None,
        cultural_rules: list[dict[str, Any]] | None = None,
        user_profile: dict[str, Any] | None = None,
        closet_summary: list[dict[str, Any]] | None = None,
        user_preferences_block: str | None = None,
    ) -> dict[str, Any]:
        ...


# -----------------------------------------------------------------
# -----------------------------------------------------------------
# Gemma provider — on-prem Eyes fine-tuned Gemma-4 E4B
# -----------------------------------------------------------------
class GemmaStylistBrain:
    """Stylist Brain implementation backed by on-prem Eyes / Gemma-4 E4B."""

    provider_name = "gemma"

    def __init__(self, model: str | None = None) -> None:
        self.model = model or settings.DEFAULT_STYLIST_MODEL or "gemma-4-E4B-it-Q3_K_M.gguf"

    async def advise(
        self,
        *,
        session_id: str,
        user_text: str,
        image_base64: str | None = None,
        image_mime: str = "image/jpeg",
        weather: dict[str, Any] | None = None,
        calendar_events: list[dict[str, Any]] | None = None,
        cultural_rules: list[dict[str, Any]] | None = None,
        user_profile: dict[str, Any] | None = None,
        closet_summary: list[dict[str, Any]] | None = None,
        user_preferences_block: str | None = None,
    ) -> dict[str, Any]:
        from app.services.gemini_stylist import prepare_stylist_prompt, _parse_json
        from app.services.vision.llm import _call_gemma_space
        from app.services import provider_activity

        # Gemma on-prem has a 4096 token context window; cap closet items to top 15 so it fits cleanly
        gemma_closet = closet_summary[:15] if closet_summary else None

        sys_msg, prompt_text = await prepare_stylist_prompt(
            session_id=session_id,
            user_text=user_text,
            image_base64=image_base64,
            weather=weather,
            calendar_events=calendar_events,
            cultural_rules=cultural_rules,
            user_profile=user_profile,
            closet_summary=gemma_closet,
            user_preferences_block=user_preferences_block,
        )

        with provider_activity.Track(
            "gemma-stylist", {"model": self.model, "has_image": bool(image_base64)}
        ):
            raw = await _call_gemma_space(
                system_prompt=sys_msg,
                user_text=prompt_text,
                image_b64_jpeg=image_base64,
                max_tokens=3000,
                temperature=0.3,
            )
        return _parse_json(raw)


# -----------------------------------------------------------------
# Gemini provider — thin adapter so the legacy service satisfies the
# same Protocol as any future provider
# -----------------------------------------------------------------
class GeminiStylistBrain:
    """Adapter around the legacy ``gemini_stylist_service`` singleton."""

    provider_name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        if api_key or model:
            from app.services.gemini_stylist import GeminiStylistService
            self._svc = GeminiStylistService(api_key=api_key, model=model)
        else:
            if gemini_stylist_service is None:
                raise RuntimeError(
                    "Gemini stylist service unavailable. Set GEMINI_API_KEY to enable it."
                )
            self._svc = gemini_stylist_service

    async def advise(self, **kwargs: Any) -> dict[str, Any]:
        return await self._svc.advise(**kwargs)


# -----------------------------------------------------------------
# Fallback chain — try primary, fall back on RuntimeError / Timeout / Quota
# -----------------------------------------------------------------
class FallbackBrain:
    """Wraps a ``primary`` brain, falling back to ``fallback`` on error or quota exhaustion."""

    def __init__(self, primary: StylistBrain, fallback: StylistBrain) -> None:
        self.primary = primary
        self.fallback = fallback
        self.provider_name = (
            f"{primary.provider_name}+fallback:{fallback.provider_name}"
        )

    async def advise(self, **kwargs: Any) -> dict[str, Any]:
        try:
            return await self.primary.advise(**kwargs)
        except Exception as exc:
            exc_str = str(exc).lower()
            is_quota_or_transient = (
                isinstance(exc, (RuntimeError, TimeoutError))
                or "resource_exhausted" in exc_str
                or "429" in exc_str
                or "quota" in exc_str
                or "spending cap" in exc_str
                or "temporarily unavailable" in exc_str
                or "deadline exceeded" in exc_str
            )
            if is_quota_or_transient:
                logger.warning(
                    "stylist primary provider %s failed (%s); falling back to %s",
                    self.primary.provider_name,
                    repr(exc)[:200],
                    self.fallback.provider_name,
                )
                res = await self.fallback.advise(**kwargs)
                if isinstance(res, dict):
                    is_quota = bool(
                        "429" in exc_str
                        or "quota" in exc_str
                        or "resource_exhausted" in exc_str
                        or "spending cap" in exc_str
                    )
                    res["provider_fallback"] = {
                        "from": self.primary.provider_name,
                        "to": self.fallback.provider_name,
                        "reason": repr(exc)[:200],
                        "quota_exhausted": is_quota,
                    }
                    res["fallback_from_quota"] = is_quota
                return res
            raise


# -----------------------------------------------------------------
# Factory
# -----------------------------------------------------------------
def _make_provider(name: str) -> StylistBrain | None:
    """Instantiate a concrete brain by name; return None if the
    environment isn't configured to support it."""
    try:
        if name in ("gemma", "eyes", "dressapp"):
            return GemmaStylistBrain()
        if name == "gemini":
            if gemini_stylist_service is None:
                logger.info("gemini requested but no Gemini key configured")
                return None
            return GeminiStylistBrain()
        if name in ("", "none"):
            return None
        logger.warning(
            "Unknown / retired STYLIST_PROVIDER value: %r — falling "
            "through to gemini default", name,
        )
        return GeminiStylistBrain() if gemini_stylist_service else GemmaStylistBrain()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to instantiate provider %s: %s", name, exc)
        return None


def build_stylist_brain() -> StylistBrain:
    """Resolve the brain stack based on current settings."""
    primary_name = settings.STYLIST_PROVIDER.lower().strip() or "gemini"
    if primary_name in ("gemma", "eyes", "dressapp") and (not fallback_name or fallback_name in ("gemma", "eyes", "dressapp")):
        if gemini_stylist_service is not None:
            fallback_name = "gemini"

    primary = _make_provider(primary_name)
    fallback = (
        _make_provider(fallback_name)
        if fallback_name and fallback_name != primary_name
        else None
    )

    if primary is None and fallback is None:
        raise RuntimeError(
            "No stylist brain provider is configured. Check STYLIST_PROVIDER or EYES_GEMMA_SPACE_URL."
        )
    if primary is None:
        logger.warning(
            "Primary stylist provider %s unavailable; promoting fallback %s",
            primary_name, fallback_name,
        )
        assert fallback is not None
        return fallback
    if fallback is None:
        logger.info(
            "Stylist brain initialised: provider=%s, no fallback configured",
            primary.provider_name,
        )
        return primary
    logger.info(
        "Stylist brain initialised: primary=%s fallback=%s",
        primary.provider_name, fallback.provider_name,
    )
    return FallbackBrain(primary=primary, fallback=fallback)


# Lazy module-level singleton. The factory is cheap, but we avoid
# re-running provider init on every stylist call.
_service: StylistBrain | None = None


def stylist_brain_service(api_key: str | None = None, model: str | None = None) -> StylistBrain:
    if model in ("Eyes v1", "gemma", "dressapp", "gemma-4-E4B-it-Q3_K_M.gguf"):
        primary = GemmaStylistBrain(model=model)
        fallback = GeminiStylistBrain() if gemini_stylist_service else None
        return FallbackBrain(primary=primary, fallback=fallback) if fallback else primary

    if api_key or (model and model not in ("Eyes v1", "gemma", "dressapp", "gemma-4-E4B-it-Q3_K_M.gguf")):
        primary = GeminiStylistBrain(api_key=api_key, model=model)
        # Always equip user BYOK brains with on-prem Gemma fallback for quota exhaustion
        return FallbackBrain(primary=primary, fallback=GemmaStylistBrain())
    global _service
    if _service is None:
        _service = build_stylist_brain()
    return _service


def reset_stylist_brain_service() -> None:
    """Clear the cached singleton. Exposed for tests + ``/admin`` hot-reload."""
    global _service
    _service = None

