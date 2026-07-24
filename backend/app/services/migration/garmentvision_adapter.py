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
from app.services.image_hash import average_hash
from app.services.vision import garment_vision_service
from app.services.vision.geometry import _is_unidentifiable

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
        persisted_items: List[Dict[str, Any]] = []

        # 1. Convert PIL Images to JPEG bytes and compile
        crops_data = []
        for idx, tile_img in enumerate(unique_tiles):
            try:
                img_byte_arr = io.BytesIO()
                tile_img.save(img_byte_arr, format="JPEG", quality=90)
                jpeg_bytes = img_byte_arr.getvalue()
                crops_data.append((tile_img, jpeg_bytes))
            except Exception as e:
                logger.warning("Failed to serialize crop tile %d: %s", idx, e)

        # 2. Run batched vision analysis in chunks of 4 using garment_vision_service
        chunk_size = 4
        analyses = [None] * len(crops_data)

        for i in range(0, len(crops_data), chunk_size):
            chunk = crops_data[i:i + chunk_size]
            chunk_bytes = [jpeg_bytes for _, jpeg_bytes in chunk]
            
            chunk_analyses = []
            try:
                # Call batched Gemini analyzer
                chunk_analyses = await garment_vision_service.analyze_batch(chunk_bytes)
            except Exception as batch_err:
                logger.warning("Batch analysis failed for chunk %d: %s. Falling back to sequential.", i // chunk_size, batch_err)
                # Sequential fallback
                for tile_img, jpeg_bytes in chunk:
                    try:
                        single_analysis = await garment_vision_service.analyze(jpeg_bytes)
                        chunk_analyses.append(single_analysis)
                    except Exception as single_err:
                        logger.error("Single analysis fallback failed: %s", single_err)
                        chunk_analyses.append({})
            
            # Map results back to the main list
            for offset, analysis in enumerate(chunk_analyses):
                idx = i + offset
                if idx < len(analyses):
                    analyses[idx] = analysis

        # 3. Process, matte, and save each crop that passes the sanity filter
        for idx, (tile_img, jpeg_bytes) in enumerate(crops_data):
            analysis = analyses[idx]
            if not analysis:
                logger.warning("No analysis result for crop %d. Skipping.", idx)
                continue

            # Check if this crop is noise / unidentifiable (e.g. icons, layout, text)
            if _is_unidentifiable(analysis):
                logger.info("GarmentVisionAdapter: dropping noise/unidentifiable crop %d (%s)", idx, analysis.get("title") or "Unnamed")
                continue

            try:
                # Run background matting (rembg)
                cutout_bytes = None
                try:
                    cutout_bytes = await background_matting.matte_crop(jpeg_bytes)
                except Exception as bg_err:
                    logger.warning("Background matting failed for crop %d: %s", idx, bg_err)

                # Base64 encode images
                b64_orig = base64.b64encode(jpeg_bytes).decode("utf-8")
                orig_data_url = f"data:image/jpeg;base64,{b64_orig}"
                
                if cutout_bytes:
                    b64_png = base64.b64encode(cutout_bytes).decode("utf-8")
                    cutout_url = f"data:image/png;base64,{b64_png}"
                else:
                    cutout_url = orig_data_url

                # Determine categories & properties from Gemini analysis
                raw_cat = str(analysis.get("category") or "").strip().capitalize()
                category = "Top"
                valid_categories = ["Top", "Bottom", "Accessory", "Footwear", "Outerwear", "Dress"]
                if raw_cat in valid_categories:
                    category = raw_cat
                else:
                    raw_cat_lower = raw_cat.lower()
                    if "top" in raw_cat_lower or "shirt" in raw_cat_lower or "blouse" in raw_cat_lower or "tee" in raw_cat_lower:
                        category = "Top"
                    elif "bottom" in raw_cat_lower or "pant" in raw_cat_lower or "jean" in raw_cat_lower or "skirt" in raw_cat_lower or "short" in raw_cat_lower:
                        category = "Bottom"
                    elif "accessory" in raw_cat_lower or "belt" in raw_cat_lower or "bag" in raw_cat_lower or "hat" in raw_cat_lower or "scarf" in raw_cat_lower:
                        category = "Accessory"
                    elif "foot" in raw_cat_lower or "shoe" in raw_cat_lower or "boot" in raw_cat_lower or "sneaker" in raw_cat_lower:
                        category = "Footwear"
                    elif "outer" in raw_cat_lower or "jacket" in raw_cat_lower or "coat" in raw_cat_lower or "hoodie" in raw_cat_lower:
                        category = "Outerwear"
                    elif "dress" in raw_cat_lower:
                        category = "Dress"

                sub_category = analysis.get("sub_category") or category
                
                # Determine colors
                color = "Neutral"
                colors_list = analysis.get("colors") or []
                if colors_list and isinstance(colors_list, list):
                    first_color = colors_list[0]
                    if isinstance(first_color, dict) and "name" in first_color:
                        color = str(first_color["name"]).capitalize()
                    elif isinstance(first_color, str):
                        color = first_color.capitalize()
                
                if color == "Neutral" or not color:
                    color = _determine_primary_color(tile_img)

                title = analysis.get("title") or f"{color} {category}"
                c_id = f"item_{uuid.uuid4().hex[:12]}"
                now_iso = datetime.now(timezone.utc).isoformat()
                p_hash = average_hash(tile_img)

                doc = {
                    "id": c_id,
                    "user_id": self.user_id,
                    "schemaVersion": 1,
                    "source": "Private",
                    "title": title,
                    "name": title,
                    "category": category,
                    "sub_category": sub_category,
                    "color": color,
                    "colors": [color],
                    "pattern": analysis.get("pattern") or "Solid",
                    "material": analysis.get("fabric_materials")[0].get("name") if (analysis.get("fabric_materials") and isinstance(analysis.get("fabric_materials"), list)) else "Mixed",
                    "brand": analysis.get("brand") or f"Imported ({self.app_name})",
                    "quality": analysis.get("quality") or "Good",
                    "condition": analysis.get("condition") or "Excellent",
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
            except Exception as err:
                logger.warning("GarmentVisionAdapter persist failed for crop %d: %s", idx, err)

        logger.info(
            "GarmentVisionAdapter successfully persisted %d items for user %s",
            len(persisted_items),
            self.user_id,
        )
        return persisted_items
