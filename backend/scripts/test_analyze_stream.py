"""End-to-end smoke test for the refactored garment_vision streaming path.

Drives ``GarmentVisionService.analyze_outfit_stream`` against the
canonical test images and prints each NDJSON frame as it arrives. This
is the same generator that powers ``POST /api/v1/closet/analyze`` —
proving it works here proves the backend half of the user-reported
streaming bug is fixed without needing auth / curl gymnastics.

Run::

    cd /app/backend && python scripts/test_analyze_stream.py
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.vision import GarmentVisionService  # noqa: E402


TEST_IMAGES = [
    Path("/app/inference-server/eyes/test_images/0001.jpg"),
    Path("/app/inference-server/eyes/test_images/0002.jpg"),
]


async def main() -> int:
    svc = GarmentVisionService()
    print(f"[INFO] provider={svc.provider} model={svc.model}")
    print(f"[INFO] crop_model={svc.crop_model} max_items={svc.max_items}")

    for img_path in TEST_IMAGES:
        if not img_path.exists():
            print(f"[SKIP] {img_path} (missing)")
            continue
        print(f"\n=== analyze_outfit_stream: {img_path.name} ===")
        image_bytes = img_path.read_bytes()
        t0 = time.perf_counter()
        frames_seen = 0
        types_seen: dict[str, int] = {}
        first_frame_at: float | None = None
        try:
            async for frame in svc.analyze_outfit_stream(image_bytes):
                frames_seen += 1
                if first_frame_at is None:
                    first_frame_at = time.perf_counter() - t0
                ftype = frame.get("type") or "?"
                types_seen[ftype] = types_seen.get(ftype, 0) + 1
                # Compact preview so output stays readable on long streams.
                preview = json.dumps(frame, ensure_ascii=False)[:160]
                elapsed = (time.perf_counter() - t0) * 1000
                print(f"  [+{elapsed:6.0f}ms] type={ftype}  {preview}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [FAIL] stream raised: {exc!r}")
            return 1
        dt_ms = (time.perf_counter() - t0) * 1000
        print(
            f"  -> done: {frames_seen} frames in {dt_ms:.0f}ms "
            f"(first @ +{(first_frame_at or 0)*1000:.0f}ms)"
        )
        print(f"  -> frame types: {types_seen}")

    print("\n[PASS] analyze_outfit_stream completed without exceptions")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
