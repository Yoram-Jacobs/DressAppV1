import asyncio
import time
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

from app.services.vision import GarmentVisionService

async def test_full_stream():
    svc = GarmentVisionService()
    img_path = Path("/tmp/original_upload.png")
    img_bytes = img_path.read_bytes()

    print("=== STARTING FULL ANALYZE_OUTFITS_STREAM ===")
    t0 = time.perf_counter()
    frame_count = 0
    item_idx = 0
    async for frame in svc.analyze_outfits_stream([img_bytes]):
        frame_count += 1
        elapsed = time.perf_counter() - t0
        ftype = frame.get("type")
        if ftype == "field":
            group = frame.get("group")
            fields = frame.get("fields", {})
            print(f"[{elapsed:5.2f}s] Frame #{frame_count} ({ftype}): group={group} fields={fields}")
        elif ftype == "detect":
            count = frame.get("count")
            items_meta = frame.get("items_meta", [])
            print(f"[{elapsed:5.2f}s] Frame #{frame_count} ({ftype}): count={count}")
            import base64
            for idx, meta in enumerate(items_meta):
                c_b64 = meta.get("crop_base64")
                if c_b64:
                    raw_png = base64.b64decode(c_b64)
                    lbl = meta.get("label", "item").replace(" ", "_")
                    out_f = Path(f"/tmp/e2e_cutout_{idx}_{lbl}.png")
                    out_f.write_bytes(raw_png)
                    print(f"  [CUTOUT SAVED] #{idx} ({lbl}) -> {out_f} ({len(raw_png)} bytes, bbox={meta.get('bbox')})")
        elif ftype == "item":
            item_idx += 1
            analysis = frame.get("analysis", {})
            name = analysis.get("name")
            category = analysis.get("category")
            sub_category = analysis.get("sub_category")
            item_type = analysis.get("item_type")
            gender = analysis.get("gender")
            colors = analysis.get("colors")
            mats = analysis.get("fabric_materials")
            
            print(f"\n==========================================")
            print(f"[{elapsed:5.2f}s] ITEM #{item_idx}:")
            print(f"  Name:             {name}")
            print(f"  Category:         {category}")
            print(f"  Sub-category:     {sub_category}")
            print(f"  Item Type:        {item_type}")
            print(f"  Gender:           {gender}")
            print(f"  Colors:           {colors}")
            print(f"  Materials:        {mats}")
            print(f"==========================================\n")
        elif ftype == "done":
            print(f"[{elapsed:5.2f}s] Frame #{frame_count} ({ftype}): count={frame.get('count')}")
        else:
            print(f"[{elapsed:5.2f}s] Frame #{frame_count} ({ftype}): {frame}")
    total_t = time.perf_counter() - t0
    print(f"=== TOTAL STREAM TIME: {total_t:.2f}s ({frame_count} frames, {item_idx} items) ===")

if __name__ == "__main__":
    asyncio.run(test_full_stream())
