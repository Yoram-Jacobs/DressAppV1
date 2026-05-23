import asyncio
import os
import sys

# Add backend to path
sys.path.insert(0, r"C:\DressApp_AG\backend")

# Try to load env vars manually if dotenv fails
from app.config import settings

from app.services import vision as garment_vision

async def test_gatekeeper():
    with open(r"C:\DressApp_AG\inference-server\eyes\test_images\0001.jpg", "rb") as f:
        image_bytes = f.read()

    svc = garment_vision.GarmentVisionService()
    print("Testing gatekeeper on 0001.jpg...")
    count = await svc._gatekeep_image(image_bytes)
    print(f"Gatekeeper returned: {count} items")

if __name__ == "__main__":
    asyncio.run(test_gatekeeper())
