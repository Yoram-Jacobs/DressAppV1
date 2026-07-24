"""
wardrobe_migration_agent.py

DressApp's agentic wardrobe migration agent governed by Gemini 2.5 Flash.
Replaces the programmatic scroller, OpenCV grid slicer, and static deduplicator.
"""

import io
import uuid
import base64
import logging
import json
from datetime import datetime, timezone
from PIL import Image

from app.services.gemini_client import GeminiClient
from app.services.migration.dedup_engine import compute_perceptual_hash
from app.services.image_hash import hamming_distance
from app.services import background_matting
from app.db.database import get_db

logger = logging.getLogger(__name__)


class WardrobeMigrationAgent:
    """
    Agentic Wardrobe Migration Agent running on DressApp's production backend.
    """

    def __init__(self, api_key: str | None = None):
        self.client = GeminiClient(api_key=api_key)

    async def process_step(
        self,
        session_id: str,
        user_id: str,
        app_name: str,
        pil_img: Image.Image,
    ) -> dict:
        """
        Processes a single screenshot frame from the competitor closet viewport.
        Uses Gemini 2.5 Flash to detect garments, deduplicate them visually/perceptually,
        and decide next scrolling actions.
        """
        db = get_db()
        session = await db.migration_sessions.find_one({"id": session_id})
        if not session:
            # Create session on the fly if needed
            session = {
                "id": session_id,
                "user_id": user_id,
                "app_name": app_name,
                "parsed_hashes": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.migration_sessions.insert_one(session)

        # Get dimensions of screenshot
        img_w, img_h = pil_img.size

        # Convert image to JPEG bytes for Gemini
        img_byte_arr = io.BytesIO()
        pil_img.save(img_byte_arr, format="JPEG", quality=90)
        jpeg_bytes = img_byte_arr.getvalue()

        # Gemini 2.5 Flash Bounding Box Detection prompt
        system_prompt = (
            "You are DressApp's Wardrobe Migration Agent. Your goal is to migrate competitor wardrobe closets.\n"
            "Analyze the screenshot of the competitor's closet app. Identify the grid layout (columns and rows of clothing cards) on the page.\n"
            "You MUST follow these rules:\n"
            "1. DETECT ENTIRE CARD: Return the bounding box of the ENTIRE rectangular card container (including borders, padding, and background card canvas), NOT a tight box around just the colored clothing item pixels itself. This centers the item and avoids cropping sleeves or parts off.\n"
            "2. IGNORE BOUNDARY CUT-OFFS: If any card is partially cut off at the top (ymin touches 0) or bottom (ymax touches 1000) of the viewport, DO NOT return its bounding box. It will be fully captured in the next scroll iteration.\n"
            "3. PREVENT HALF-CROPS: Never split a card or a garment in half. Each bounding box must encompass a single complete card from the grid.\n\n"
            "Return the bounding box coordinates [ymin, xmin, ymax, xmax] of each complete garment card on a 0-1000 normalized scale.\n"
            "Also provide category (one of: Top, Bottom, Accessory, Footwear, Outerwear, Dress), color, and a short visual description label."
        )

        response_schema = {
            "type": "OBJECT",
            "properties": {
                "garments": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "box_2d": {
                                "type": "ARRAY",
                                "items": {"type": "INTEGER"},
                                "description": "Normalized integer bounding box [ymin, xmin, ymax, xmax] from 0 to 1000.",
                            },
                            "label": {"type": "STRING", "description": "Short visual label description"},
                            "category": {"type": "STRING", "description": "Top, Bottom, Accessory, Footwear, Outerwear, or Dress"},
                            "color": {"type": "STRING", "description": "Primary color family"},
                        },
                        "required": ["box_2d", "label", "category", "color"],
                    },
                },
                "should_scroll": {
                    "type": "BOOLEAN",
                    "description": "True if there are visible items partially below or more items remaining further down.",
                },
            },
            "required": ["garments", "should_scroll"],
        }

        new_items = []
        try:
            # Call Gemini 2.5 Flash using direct vision wrapper
            response_text = await self.client.vision(
                user_parts=[jpeg_bytes],
                system=system_prompt,
                model="gemini-2.5-flash",
                response_mime_type="application/json",
                response_schema=response_schema,
            )

            result = json.loads(response_text)
            detected_garments = result.get("garments", [])
            should_scroll = result.get("should_scroll", False)

            logger.info("WardrobeMigrationAgent detected %d garment bounding boxes.", len(detected_garments))

            # Retrieve previously parsed hashes for deduplication
            parsed_hashes = session.get("parsed_hashes", [])

            for garment in detected_garments:
                box = garment.get("box_2d")
                if not box or len(box) != 4:
                    continue

                # Map normalized coordinates [ymin, xmin, ymax, xmax] to actual pixels
                ymin_pct, xmin_pct, ymax_pct, xmax_pct = box

                # Skip cards touching boundaries to prevent cut-off/partial items
                if ymin_pct <= 5 or ymax_pct >= 995:
                    logger.info("Skipping boundary box to prevent cut-offs: %s", box)
                    continue

                ymin = int(ymin_pct * img_h / 1000.0)
                xmin = int(xmin_pct * img_w / 1000.0)
                ymax = int(ymax_pct * img_h / 1000.0)
                xmax = int(xmax_pct * img_w / 1000.0)

                # Skip invalid crops
                if ymax <= ymin or xmax <= xmin or ymin < 0 or xmin < 0:
                    continue

                # Crop the garment tile
                crop_tile = pil_img.crop((xmin, ymin, xmax, ymax))

                # Compute perceptual hash of the crop
                p_hash = compute_perceptual_hash(crop_tile)
                if not p_hash:
                    continue

                # Check for duplicate
                is_dup = False
                for registered_hash in parsed_hashes:
                    dist = hamming_distance(p_hash, registered_hash)
                    if dist <= 5:
                        is_dup = True
                        break

                if is_dup:
                      logger.info("Deduplication: skipped duplicate crop with hash %s", p_hash)
                      continue

                # Unique item: Ingest
                try:
                    # Save crop to JPEG bytes
                    crop_byte_arr = io.BytesIO()
                    crop_tile.save(crop_byte_arr, format="JPEG", quality=90)
                    crop_bytes = crop_byte_arr.getvalue()

                    # Run background removal
                    cutout_bytes = None
                    try:
                        cutout_bytes = await background_matting.matte_crop(crop_bytes)
                    except Exception as bg_err:
                        logger.warning("Background matting failed for agent crop: %s", bg_err)

                    b64_orig = base64.b64encode(crop_bytes).decode("utf-8")
                    orig_data_url = f"data:image/jpeg;base64,{b64_orig}"

                    if cutout_bytes:
                        b64_png = base64.b64encode(cutout_bytes).decode("utf-8")
                        cutout_url = f"data:image/png;base64,{b64_png}"
                    else:
                        cutout_url = orig_data_url

                    category = garment.get("category", "Top").capitalize()
                    if category not in ["Top", "Bottom", "Accessory", "Footwear", "Outerwear", "Dress"]:
                        category = "Top"

                    color = garment.get("color", "Neutral").capitalize()
                    title = garment.get("label") or f"{color} {category}"

                    c_id = f"item_{uuid.uuid4().hex[:12]}"
                    now_iso = datetime.now(timezone.utc).isoformat()

                    doc = {
                        "id": c_id,
                        "user_id": user_id,
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
                        "brand": f"Imported ({app_name})",
                        "quality": "Good",
                        "condition": "Excellent",
                        "state": "Active",
                        "wear_count": 0,
                        "original_image_url": orig_data_url,
                        "segmented_image_url": cutout_url,
                        "thumbnail_data_url": cutout_url,
                        "perceptual_hash": p_hash,
                        "migrated_from": app_name,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    }

                    await db.closet_items.insert_one(doc)
                    parsed_hashes.append(p_hash)
                    new_items.append({
                        "id": c_id,
                        "title": title,
                        "category": category,
                        "color": color,
                        "segmented_image_url": cutout_url,
                    })
                    logger.info("Agent persisted unique item %s (%s)", c_id, title)
                except Exception as ingest_err:
                    logger.warning("Agent ingestion failed for crop: %s", ingest_err)

            # Update the session's parsed hashes
            await db.migration_sessions.update_one(
                {"id": session_id},
                {"$set": {"parsed_hashes": parsed_hashes}},
            )

            action = "scroll" if should_scroll else "done"
            return {
                "status": "active" if should_scroll else "completed",
                "action": action,
                "scroll_amount": 350,
                "new_items_found": new_items,
            }

        except Exception as exc:
            logger.error("Agent process_step failed: %s", exc)
            return {
                "status": "active",
                "action": "scroll",
                "scroll_amount": 350,
                "new_items_found": [],
                "error": str(exc),
            }
