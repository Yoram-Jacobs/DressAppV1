import asyncio
import sys

sys.path.insert(0, r"/app/backend")

from types import ModuleType
dotenv = ModuleType('dotenv')
def dummy_load_dotenv(*args, **kwargs): pass
dotenv.load_dotenv = dummy_load_dotenv
sys.modules['dotenv'] = dotenv

from app.services.vision import GarmentVisionService

async def main():
    svc = GarmentVisionService()
    with open("test_garment.jpg", "rb") as f:
        img_bytes = f.read()

    print(f"Original input size: {len(img_bytes)} bytes")
    matted = await svc._whole_image_matte(img_bytes)
    if matted:
        is_png = bool(matted.startswith(b"\x89PNG"))
        print(f"Matted output: {len(matted)} bytes, is_png={is_png}")
    else:
        print("Matted returned None")

if __name__ == "__main__":
    asyncio.run(main())
