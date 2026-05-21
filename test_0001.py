import asyncio
import os
import sys

# Add backend to path
sys.path.insert(0, r"C:\DressApp_AG\backend")

from app.services import garment_vision
from app.services import clothing_parser

async def main():
    with open(r"C:\DressApp_AG\inference-server\eyes\test_images\0001.jpg", "rb") as f:
        image_bytes = f.read()
    
    svc = garment_vision.GarmentVisionService()
    
    # 1. detect
    detections = await svc._detect_via_clothing_parser(image_bytes)
    if not detections:
        print("No detections from parser")
        return
        
    print(f"Parser returned {len(detections)} detections")
    
    # nms
    clean = garment_vision._nms_detections(detections)
    print(f"After NMS: {len(clean)} detections")
    
    # filter useful
    useful = garment_vision._filter_useful_detections(clean, max_items=10)
    print(f"After filter_useful: {len(useful)} detections")
    
    # _bbox_crop_useful
    useful_crops = garment_vision._GarmentVisionService__bbox_crop_useful(image_bytes, useful)
    print(f"After bbox_crop_useful: {len(useful_crops)} detections")
    
    # print what was dropped
    for det in useful:
        bbox = det["bbox"]
        y1, x1, y2, x2 = bbox
        cur_short = min(x2 - x1, y2 - y1)
        # We need w, h
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size
        src_short = min(w, h)
        pct = garment_vision._resolve_min_short_edge_pct_for_category(det.get("kind"))
        floor_px = max(16, min(192, int(pct * src_short)))
        print(f"Det {det['label']} ({det['kind']}): {cur_short}px short edge vs floor {floor_px}px (pct {pct})")

    # Let's check _matte_crops as well for phantom guard and mask confidence
    from unittest.mock import patch
    with patch("app.services.background_matting.matte_crop") as mock_rembg:
        # mock rembg to just return a white square to see if intersection works
        mock_rembg.return_value = image_bytes # dummy
        matted = await svc._matte_crops(useful_crops)
        print(f"After matte_crops: {len(matted)} detections")

if __name__ == "__main__":
    # We can't use standard asyncio.run because of uvloop? No, uvloop is not installed.
    # standard asyncio should work.
    asyncio.run(main())
