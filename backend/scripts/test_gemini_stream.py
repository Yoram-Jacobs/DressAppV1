"""POC — exercise the native google-genai streaming + JSON-mode path.

Validates that the new :mod:`app.services.gemini_client` wrapper can:

1. Open a real garment photo,
2. Stream a JSON-mode multimodal response from Gemini 2.5 Flash,
3. Reconstruct valid JSON from the streamed deltas.

Used as a smoke test BEFORE refactoring ``garment_vision.py`` so we
prove the wrapper end-to-end against the same image the production
GOLD pipeline ingests.

Run::

    cd /app/backend && python scripts/test_gemini_stream.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Make sure the backend package is on the path when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.gemini_client import GeminiClient  # noqa: E402


TEST_IMAGE = Path("/app/inference-server/eyes/test_images/0001.jpg")
MODEL = os.environ.get("TEST_GEMINI_MODEL", "gemini-3.5-flash-lite")

SYSTEM = (
    "You are a garment analyst. Look at the image and return a single "
    "JSON object with keys: title (short string), category "
    '(one of "Top","Bottom","Outerwear","Full Body","Footwear",'
    '"Accessories"), and dominant_color (string). No extra prose.'
)

USER_TEXT = (
    "Analyse this photograph. Return ONLY a JSON object as instructed."
)


async def main() -> int:
    if not TEST_IMAGE.exists():
        print(f"[FAIL] missing test image: {TEST_IMAGE}", file=sys.stderr)
        return 2

    image_bytes = TEST_IMAGE.read_bytes()
    print(
        f"[INFO] image={TEST_IMAGE.name}  bytes={len(image_bytes)}  "
        f"model={MODEL}"
    )

    client = GeminiClient()

    # ---- 1. Non-streaming JSON mode ---------------------------------------
    print("\n[STEP 1] non-streaming vision call (JSON mode)...")
    t0 = time.perf_counter()
    raw = await client.vision(
        system=SYSTEM,
        user_parts=[USER_TEXT, image_bytes],
        model=MODEL,
        temperature=0.1,
        max_tokens=512,
        response_mime_type="application/json",
    )
    dt = time.perf_counter() - t0
    print(f"  -> raw ({dt*1000:.0f}ms): {raw[:240]}")
    try:
        obj = json.loads(raw)
        print(f"  -> parsed OK: keys={list(obj.keys())}")
    except json.JSONDecodeError as exc:
        print(f"  -> JSON parse failed: {exc}")
        return 1

    # ---- 2. Streaming JSON mode -------------------------------------------
    print("\n[STEP 2] STREAMING vision call (JSON mode)...")
    chunks: list[str] = []
    t0 = time.perf_counter()
    first_chunk_at: float | None = None
    chunk_count = 0
    async for delta in client.stream_vision(
        system=SYSTEM,
        user_parts=[USER_TEXT, image_bytes],
        model=MODEL,
        temperature=0.1,
        max_tokens=512,
        response_mime_type="application/json",
    ):
        chunk_count += 1
        if first_chunk_at is None:
            first_chunk_at = time.perf_counter() - t0
        chunks.append(delta)
        # Show first few chunks to confirm they arrive incrementally.
        if chunk_count <= 5:
            print(
                f"  [chunk {chunk_count} @ +{(time.perf_counter()-t0)*1000:.0f}ms] "
                f"len={len(delta)} preview={delta[:80]!r}"
            )
    dt = time.perf_counter() - t0
    full = "".join(chunks)
    print(
        f"\n  -> streamed {chunk_count} chunks in {dt*1000:.0f}ms "
        f"(first chunk at +{(first_chunk_at or 0)*1000:.0f}ms)"
    )
    print(f"  -> total text length={len(full)}")
    print(f"  -> reconstructed: {full[:240]}")

    try:
        obj = json.loads(full)
        print(f"  -> parsed OK: keys={list(obj.keys())}")
    except json.JSONDecodeError as exc:
        print(f"  -> JSON parse failed: {exc}")
        return 1

    print("\n[PASS] gemini_client streaming + JSON mode work end-to-end")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
