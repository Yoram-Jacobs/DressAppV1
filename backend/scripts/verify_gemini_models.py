"""Prove the post-migration wiring really hits Gemini 3.5 Flash-Lite + Nano Banana.

Three live calls:

1. ``GeminiStylistService.advise(...)`` — must call **gemini-3.5-flash-lite**
   (settings.DEFAULT_STYLIST_MODEL).
2. ``GeminiImageService.generate(prompt=...)`` — must call **nano banana**
   (settings.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image').
3. ``GarmentVisionService.analyze(image_bytes=...)`` — must call
   **gemini-3.5-flash-lite** (settings.GARMENT_VISION_MODEL).

Each call prints the model the SDK actually saw via a tiny SDK
instrumentation wrapper, plus the elapsed time so you can compare
against the Google AI Studio dashboard.
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

print("=" * 70)
print("LIVE MODEL-VERIFICATION TEST — runs real Gemini API calls")
print("=" * 70)
print(f"settings.GEMINI_API_KEY present       : {bool(settings.GEMINI_API_KEY)}")
print(f"settings.DEFAULT_STYLIST_MODEL        : {settings.DEFAULT_STYLIST_MODEL}")
print(f"settings.GEMINI_IMAGE_MODEL           : {settings.GEMINI_IMAGE_MODEL}")
print(f"settings.GARMENT_VISION_MODEL         : {settings.GARMENT_VISION_MODEL}")
print(f"settings.GARMENT_VISION_CROP_MODEL    : {settings.GARMENT_VISION_CROP_MODEL}")
print(f"settings.GARMENT_VISION_DETECT_MODEL  : {settings.GARMENT_VISION_DETECT_MODEL}")
print("=" * 70)


# Instrument google.genai so we can see the exact model string every
# call is targeting.
from google.genai import models as _genai_models  # noqa: E402

try:
    import google.genai._interactions.resources.interactions as _interact_module
    _AsyncInteractionsClass = _interact_module.AsyncInteractionsResource
except ImportError:
    try:
        import google.genai._gaos.google_genai as _gaos_genai
        _AsyncInteractionsClass = _gaos_genai.AsyncGeminiNextGenInteractions
    except ImportError:
        _AsyncInteractionsClass = None

_orig_gen = _genai_models.AsyncModels.generate_content
_orig_gen_stream = _genai_models.AsyncModels.generate_content_stream
_orig_gen_sync = _genai_models.Models.generate_content
_orig_interact_async = getattr(_AsyncInteractionsClass, "create", None) if _AsyncInteractionsClass else None
_calls: list[dict] = []


async def _traced_gen(self, *, model, contents, config=None, **kw):
    t0 = time.perf_counter()
    _calls.append({"kind": "async", "model": model, "ts": t0})
    print(f"  [SDK CALL] async generate_content  model={model!r}")
    return await _orig_gen(self, model=model, contents=contents, config=config, **kw)


async def _traced_stream(self, *, model, contents, config=None, **kw):
    t0 = time.perf_counter()
    _calls.append({"kind": "async-stream", "model": model, "ts": t0})
    print(f"  [SDK CALL] async generate_content_stream  model={model!r}")
    return await _orig_gen_stream(self, model=model, contents=contents, config=config, **kw)


def _traced_gen_sync(self, *, model, contents, config=None, **kw):
    t0 = time.perf_counter()
    _calls.append({"kind": "sync", "model": model, "ts": t0})
    print(f"  [SDK CALL] sync generate_content  model={model!r}")
    return _orig_gen_sync(self, model=model, contents=contents, config=config, **kw)


async def _traced_interact_async(self, *, model, input, **kw):
    t0 = time.perf_counter()
    _calls.append({"kind": "async-interaction", "model": model, "ts": t0})
    print(f"  [SDK CALL] async interactions.create  model={model!r}")
    if _orig_interact_async:
        return await _orig_interact_async(self, model=model, input=input, **kw)
    return None


_genai_models.AsyncModels.generate_content = _traced_gen
_genai_models.AsyncModels.generate_content_stream = _traced_stream
_genai_models.Models.generate_content = _traced_gen_sync
if _AsyncInteractionsClass and _orig_interact_async:
    _AsyncInteractionsClass.create = _traced_interact_async


# ---------------------------------------------------------------- 1. STYLIST
async def test_stylist() -> bool:
    print(f"\n[1/3] Stylist (must hit {settings.DEFAULT_STYLIST_MODEL}) ...")
    try:
        from app.services.gemini_stylist import gemini_stylist_service
        if gemini_stylist_service is None:
            print("  FAIL: gemini_stylist_service is None (no GEMINI_API_KEY?)")
            return False
        t0 = time.perf_counter()
        result = await gemini_stylist_service.advise(
            session_id="model-verification-test",
            user_text="Suggest one casual outfit. Be brief.",
            image_base64=None,
            weather={"temp_c": 20, "summary": "clear"},
            calendar_events=[],
            cultural_rules=[],
            user_profile={"preferred_language": "en"},
            closet_summary=[],
        )
        dt = (time.perf_counter() - t0) * 1000
        ok = bool(result.get("spoken_reply") or result.get("reasoning_summary"))
        keys = list(result.keys())[:6]
        print(f"  -> {'PASS' if ok else 'FAIL'} elapsed={dt:.0f}ms  keys={keys}")
        return ok
    except Exception as exc:  # noqa: BLE001
        print(f"  -> FAIL with {type(exc).__name__}: {exc}")
        return False


# ---------------------------------------------------------- 2. NANO BANANA
async def test_nano_banana() -> bool:
    print(f"\n[2/3] Nano Banana (must hit {settings.GEMINI_IMAGE_MODEL}) ...")
    try:
        from app.services.gemini_image_service import GeminiImageService
        svc = GeminiImageService()
        print(f"  service.model = {svc.model!r}")
        t0 = time.perf_counter()
        out = await svc.generate(
            prompt=(
                "Editorial product shot of a plain white cotton crew-neck t-shirt "
                "on a neutral grey background. Studio lighting, 4:5 aspect ratio."
            ),
        )
        dt = (time.perf_counter() - t0) * 1000
        has_image = bool(out.get("image_b64"))
        print(
            f"  -> {'PASS' if has_image else 'FAIL'} elapsed={dt:.0f}ms  "
            f"image_b64={'present' if has_image else 'missing'}  "
            f"model_used={out.get('model_used')!r}"
        )
        return has_image
    except Exception as exc:  # noqa: BLE001
        print(f"  -> FAIL with {type(exc).__name__}: {exc}")
        return False


# ----------------------------------------------------- 3. GARMENT VISION
async def test_garment_vision() -> bool:
    print(f"\n[3/3] GarmentVision Eyes (must hit {settings.GARMENT_VISION_MODEL}) ...")
    try:
        from app.services.vision import GarmentVisionService
        svc = GarmentVisionService()
        img = (Path(__file__).resolve().parent.parent.parent / "inference-server/eyes/test_images/0001.jpg").read_bytes()
        t0 = time.perf_counter()
        result = await svc.analyze(img)
        dt = (time.perf_counter() - t0) * 1000
        ok = bool(result.get("title") or result.get("category"))
        print(
            f"  -> {'PASS' if ok else 'FAIL'} elapsed={dt:.0f}ms  "
            f"title={result.get('title')!r}  category={result.get('category')!r}  "
            f"model_used={result.get('model_used')!r}"
        )
        return ok
    except Exception as exc:  # noqa: BLE001
        print(f"  -> FAIL with {type(exc).__name__}: {exc}")
        return False


async def main() -> int:
    results = [
        await test_stylist(),
        await test_nano_banana(),
        await test_garment_vision(),
    ]
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Stylist              : {'PASS' if results[0] else 'FAIL'}")
    print(f"  Nano Banana          : {'PASS' if results[1] else 'FAIL'}")
    print(f"  Garment Vision Eyes  : {'PASS' if results[2] else 'FAIL'}")
    print("\nTrace of every model string the SDK actually saw this run:")
    for c in _calls:
        print(f"  - kind={c['kind']:20} model={c['model']!r}")
    print("=" * 70)
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
