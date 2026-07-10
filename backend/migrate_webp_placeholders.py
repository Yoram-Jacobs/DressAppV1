import asyncio
import os
import sys
import logging
from pymongo import MongoClient

# Ensure the backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migration")

from app.config import settings
from app.services.thumbnails import ensure_thumbnail_and_placeholder

async def run_migration():
    logger.info("Connecting to MongoDB Atlas...")
    client = MongoClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    
    closet_items_coll = db.closet_items
    logger.info("Fetching closet items...")
    items = list(closet_items_coll.find({}))
    logger.info(f"Found {len(items)} closet items. Starting WebP transcoding and placeholder generation...")
    
    for idx, item in enumerate(items):
        item_id = item.get("id")
        
        # Generate thumbnail and placeholder
        thumb, place = await ensure_thumbnail_and_placeholder(item)
        
        updates = {}
        if thumb and thumb != item.get("thumbnail_data_url"):
            updates["thumbnail_data_url"] = thumb
        if place and place != item.get("placeholder_data_url"):
            updates["placeholder_data_url"] = place
            
        if updates:
            closet_items_coll.update_one({"id": item_id}, {"$set": updates})
            logger.info(f"[{idx+1}/{len(items)}] Updated item {item_id}: "
                        f"thumbnail_len={len(thumb) if thumb else 0}, "
                        f"placeholder_len={len(place) if place else 0}")
        else:
            logger.info(f"[{idx+1}/{len(items)}] Item {item_id} already up-to-date.")

    logger.info("Migration complete!")

if __name__ == "__main__":
    asyncio.run(run_migration())
