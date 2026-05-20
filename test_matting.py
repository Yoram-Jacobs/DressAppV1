import asyncio
import io
import json
import os
import sys
import numpy as np

from app.api.v1 import closet
from app.services import clothing_parser as _cp
from app.services import garment_vision
from PIL import Image

async def test_image():
    # Load 0001.jpg
    path = r"C:\DressApp_AG\inference-server\eyes\test_images\0001.jpg"
    with open(path, "rb") as f:
        img_bytes = f.read()

    print("Parsing garments...")
    garments = await _cp.parse_garments(img_bytes)
    print(f"Parsed {len(garments)} garments.")
    for g in garments:
        print(f"Garment: {g['label']} (Category: {g['category']})")
        
        # Test matting via background matting
        seg_mask, human_mask = closet._pick_segformer_mask_for_category([g], g['category'])
        print(f"Mask size: {seg_mask.shape if seg_mask is not None else None}")
        
if __name__ == "__main__":
    os.environ["AUTO_MATTE_CROPS"] = "true"
    os.environ["USE_LOCAL_CLOTHING_PARSER"] = "true"
    asyncio.run(test_image())
