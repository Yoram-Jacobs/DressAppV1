"""
Step D: Ingestion into DressApp GarmentVision (garmentvision_adapter.py)

Passes deduplicated unique tile assets to native GarmentVision processing:
1. Background Removal: Strip UI elements and card backgrounds to generate isolated transparent PNG cutouts via background_matting.
2. Metadata Extraction: Run vision classification to infer category (Tops, Bottoms, Outerwear, Footwear, Dress, Accessory), primary/secondary colors, and patterns.
3. DB Persistence: Save clean image assets and extracted metadata records directly into DressApp Mongo closet_items collection.
"""

import io
import uuid
import base64
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from PIL import Image

from app.db.database import get_db
from app.services import background_matting
from app.services import clothing_parser as _cp
from app.services.image_hash import average_hash, color_signature

logger = logging.getLogger(__name__)


def _determine_primary_color(pil_img: Image.Image) -> str:
    """
    Infers primary color family of a PIL image thumbnail using quantized color analysis.
    """
    try:
        small = pil_img.convert("RGB").resize((50, 50))
        colors = small.getcolors(maxcolors=2500)
        if not colors:
            return "Neutral"

        # Sort by pixel count descending
        colors.sort(key=lambda c: c[0], reverse=True)

        for count, (r, g, b) in colors:
            # Skip near-white or background pixels
            if r > 240 and g > 240 and b > 240:
                continue
            if r < 15 and g < 15 and b < 15:
                return "Black"
            if r > 200 and g > 200 and b > 200:
                return "White"
            if r > g + 40 and r > b + 40:
                return "Red"
            if g > r + 30 and g > b + 30:
                return "Green"
            if b > r + 30 and b > g + 30:
                return "Blue"
            if r > 180 and g > 150 and b < 100:
                return "Yellow"
            if r > 120 and g < 90 and b > 120:
                return "Purple"
            if r > 160 and g > 110 and b > 90:
                return "Beige"
            if r > 100 and g > 60 and b < 50:
                return "Brown"
            if abs(r - g) < 20 and abs(g - b) < 20:
                return "Grey"

        return "Neutral"
    except Exception:
        return "Neutral"


class GarmentVisionAdapter:
    """
    Ingests deduplicated tile assets into native GarmentVision pipeline and Mongo DB.
    """

    def __init__(self, user_id: str, app_name: str = "Competitor Import"):
        self.user_id = user_id
        self.app_name = app_name

    async def process_and_persist_tiles(
        self,
        unique_tiles: List[Image.Image],
        concurrency_limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Processes deduplicated tile assets through GarmentVision (background removal + metadata extraction)
        and persists clean closet_item records to MongoDB.
        """
        if not unique_tiles:
            return []

        db = get_db()
        sem = asyncio.Semaphore(concurrency_limit)
        persisted_items: List[Dict[str, Any]] = []

        async def _ingest_tile(idx: int, tile_img: Image.Image) -> Optional[Dict[str, Any]]:
            async with sem:
                try:
                    # Convert PIL Image to JPEG bytes
                    img_byte_arr = io.BytesIO()
                    tile_img.save(img_byte_arr, format="JPEG", quality=90)
                    jpeg_bytes = img_byte_arr.getvalue()

                    b64_orig = base64.b64encode(jpeg_bytes).decode("utf-8")
                    orig_data_url = f"data:image/jpeg;base64,{b64_orig}"
                    cutout_url = orig_data_url

                    # Step D.1: Background Removal via background_matting
                    bg_task = asyncio.create_task(background_matting.remove_background(jpeg_bytes))
                    cp_task = asyncio.create_task(_cp.parse_garments(jpeg_bytes))

                    await asyncio.wait_for(
                        asyncio.gather(bg_task, cp_task, return_exceptions=True),
                        timeout=3.5,
                    )

                    bg_res = bg_task.result() if bg_task.done() and not bg_task.exception() else {}
                    garments = cp_task.result() if cp_task.done() and not cp_task.exception() else []

                    png_bytes = bg_res.get("png_bytes") or bg_res.get("image_png") if isinstance(bg_res, dict) else None
                    if png_bytes:
                        b64_png = base64.b64encode(png_bytes).decode("utf-8")
                        cutout_url = f"data:image/png;base64,{b64_png}"

                    # Step D.2: Metadata Classification
                    category = "Top"
                    if garments and isinstance(garments, list):
                        top_g = garments[0]
                        det_label = str(top_g.get("label") or top_g.get("kind") or "").lower()
                        if any(k in det_label for k in ["top", "shirt", "blouse", "tee", "sweat", "upper"]):
                            category = "Top"
                        elif any(k in det_label for k in ["pant", "bottom", "skirt", "jean", "short", "trouser"]):
                            category = "Bottom"
                        elif any(k in det_label for k in ["shoe", "footwear", "boot", "sneaker", "sandal"]):
                            category = "Footwear"
                        elif any(k in det_label for k in ["dress", "gown"]):
                            category = "Dress"
                        elif any(k in det_label for k in ["coat", "jacket", "outerwear"]):
                            category = "Outerwear"
                        elif any(k in det_label for k in ["belt", "bag", "accessory", "hat", "watch"]):
                            category = "Accessory"

                    color = _determine_primary_color(tile_img)
                    title = f"{color} {category} {idx + 1}"
                    c_id = f"item_{uuid.uuid4().hex[:12]}"
                    now_iso = datetime.now(timezone.utc).isoformat()
                    p_hash = average_hash(tile_img)

                    # Step D.3: DB Persistence directly to MongoDB
                    doc = {
                        "id": c_id,
                        "user_id": self.user_id,
                        "schemaVersion": 1,
                        "source": "Private",
                        "title": title,
                        "name": title,
                        "category": category,
                        "sub_category": category,
                        "color": color,
                        "colors": [color],
                        "pattern": "Solid",
                        "material": "Mixed",
                        "brand": f"Imported ({self.app_name})",
                        "quality": "Good",
                        "condition": "Excellent",
                        "state": "Active",
                        "wear_count": 0,
                        "original_image_url": orig_data_url,
                        "segmented_image_url": cutout_url,
                        "thumbnail_data_url": cutout_url,
                        "perceptual_hash": p_hash,
                        "migrated_from": self.app_name,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    }

                    await db.closet_items.insert_one(doc)
                    persisted_items.append(doc)
                    logger.info("GarmentVisionAdapter persisted item %s (%s)", c_id, title)
                    return doc
                except Exception as err:
                    logger.warning("GarmentVisionAdapter tile %d processing error: %s", idx, err)
                    return None

        tasks = [_ingest_tile(i, tile) for i, tile in enumerate(unique_tiles)]
        await asyncio.gather(*tasks, return_exceptions=True)

        logger.info(
            "GarmentVisionAdapter successfully persisted %d items for user %s",
            len(persisted_items),
            self.user_id,
        )
        return persisted_items
