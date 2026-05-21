import os

path = r"C:\DressApp_AG\backend\app\services\garment_vision.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix the already-cropped logic
old_already_cropped = """            if _looks_already_cropped(detections):
                # Fallback to single-item analysis for already-cropped product photos
                # We do this inline here to keep the crop structure uniform for the batched stream.
                return idx, [({"label": "garment", "kind": "garment", "bbox": [0,0,1000,1000]}, img_bytes, "image/jpeg")]"""

new_already_cropped = """            if _looks_already_cropped(detections):
                # Fallback to single-item analysis for already-cropped product photos
                det = {"label": "garment", "kind": "garment", "bbox": [0,0,1000,1000]}
                defer_matte = settings.DEFER_REMBG_ON_ANALYZE and settings.AUTO_MATTE_CROPS
                
                if settings.AUTO_MATTE_CROPS and not defer_matte:
                    matted = await self._whole_image_matte(img_bytes)
                    if matted:
                        return idx, [(det, matted, "image/png")]
                
                if defer_matte:
                    det["defer_matte"] = True
                
                return idx, [(det, img_bytes, "image/jpeg")]"""

content = content.replace(old_already_cropped, new_already_cropped)

# 2. Fix the asyncio.gather to be sequential to prevent OOM
old_gather = """        results = await asyncio.gather(*[_detect_and_crop(i, b) for i, b in enumerate(images_bytes_list)])"""
new_gather = """        results = []
        for i, b in enumerate(images_bytes_list):
            results.append(await _detect_and_crop(i, b))"""

content = content.replace(old_gather, new_gather)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
