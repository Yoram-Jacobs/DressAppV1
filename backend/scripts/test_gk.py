import asyncio
import os
import sys

sys.path.insert(0, r"C:\DressApp_AG\backend")

# Monkeypatch load_dotenv to avoid ModuleNotFoundError
import sys
from types import ModuleType
dotenv = ModuleType('dotenv')
def dummy_load_dotenv(*args, **kwargs): pass
dotenv.load_dotenv = dummy_load_dotenv
sys.modules['dotenv'] = dotenv

from app.config import settings
from app.services import vision as garment_vision

async def test_gatekeeper():
    img_path = "test_garment.jpg"
    print(f"Testing {img_path}")
    with open(img_path, "rb") as f:
        image_bytes = f.read()

    svc = garment_vision.GarmentVisionService()
    
    count = await svc._gatekeep_image(image_bytes)
    print(f"_gatekeep_image returned: {count}")
    
    dets = await svc.detect_items(image_bytes)
    print(f"SegFormer returned {len(dets)} items")

if __name__ == "__main__":
    asyncio.run(test_gatekeeper())
