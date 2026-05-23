import asyncio
import os
import sys
import time

sys.path.insert(0, r"C:\DressApp_AG\backend")
from app.config import settings
from app.services import vision as garment_vision

async def test_timing():
    with open(r"C:\DressApp_AG\inference-server\eyes\Garments\DSC00516.jpg", "rb") as f:
        image_bytes = f.read()

    svc = garment_vision.GarmentVisionService()
    
    t0 = time.time()
    count = 0
    async for frame in svc.analyze_outfits_stream([image_bytes]):
        count += 1
        print(f"[{time.time() - t0:.1f}s] Frame: {frame['type']}")
    t1 = time.time()
    print(f"Total time: {t1 - t0:.1f}s")

if __name__ == "__main__":
    asyncio.run(test_timing())
