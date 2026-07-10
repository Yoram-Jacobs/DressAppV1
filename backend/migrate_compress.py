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
from app.services.image_compression import compress_image_url_or_b64

async def run_migration():
    logger.info("Connecting to MongoDB Atlas...")
    client = MongoClient(settings.MONGO_URI)
    db = client.get_default_database()
    
    # 1. Compress closet items
    closet_items_coll = db.closet_items
    logger.info("Fetching closet items...")
    items = list(closet_items_coll.find({}))
    logger.info(f"Found {len(items)} closet items. Starting compression...")
    
    compressed_items_map = {}
    
    for idx, item in enumerate(items):
        item_id = item.get("id")
        updates = {}
        
        # Compress original_image_url
        orig = item.get("original_image_url")
        if orig and orig.startswith("data:"):
            logger.info(f"[{idx+1}/{len(items)}] Compressing original_image_url for item {item_id} (len={len(orig)})")
            comp_orig = compress_image_url_or_b64(orig)
            if comp_orig and len(comp_orig) < len(orig):
                updates["original_image_url"] = comp_orig
                logger.info(f"  -> Compressed original from {len(orig)} to {len(comp_orig)} bytes")
                
        # Compress segmented_image_url
        seg = item.get("segmented_image_url")
        if seg and seg.startswith("data:"):
            logger.info(f"[{idx+1}/{len(items)}] Compressing segmented_image_url for item {item_id} (len={len(seg)})")
            comp_seg = compress_image_url_or_b64(seg)
            if comp_seg and len(comp_seg) < len(seg):
                updates["segmented_image_url"] = comp_seg
                logger.info(f"  -> Compressed segmented from {len(seg)} to {len(comp_seg)} bytes")
                
        # Compress clean_image_url
        clean = item.get("clean_image_url")
        if clean and clean.startswith("data:"):
            logger.info(f"[{idx+1}/{len(items)}] Compressing clean_image_url for item {item_id} (len={len(clean)})")
            comp_clean = compress_image_url_or_b64(clean)
            if comp_clean and len(comp_clean) < len(clean):
                updates["clean_image_url"] = comp_clean
                logger.info(f"  -> Compressed clean from {len(clean)} to {len(comp_clean)} bytes")
                
        # Compress reconstructed_image_url
        recon = item.get("reconstructed_image_url")
        if recon and recon.startswith("data:"):
            logger.info(f"[{idx+1}/{len(items)}] Compressing reconstructed_image_url for item {item_id} (len={len(recon)})")
            comp_recon = compress_image_url_or_b64(recon)
            if comp_recon and len(comp_recon) < len(recon):
                updates["reconstructed_image_url"] = comp_recon
                logger.info(f"  -> Compressed reconstructed from {len(recon)} to {len(comp_recon)} bytes")
                
        # Force thumbnail invalidation so it regenerates from the newly compressed images
        if updates:
            updates["thumbnail_data_url"] = None
            closet_items_coll.update_one({"id": item_id}, {"$set": updates})
            logger.info(f"Updated item {item_id} in database.")
            
            # Save updated values for listing reference
            compressed_items_map[item_id] = {
                "original_image_url": updates.get("original_image_url", orig),
                "segmented_image_url": updates.get("segmented_image_url", seg),
            }
            
    # 2. Update listings with compressed images
    listings_coll = db.listings
    logger.info("Fetching listings...")
    listings = list(listings_coll.find({}))
    logger.info(f"Found {len(listings)} listings. Syncing compressed images...")
    
    for listing in listings:
        closet_item_id = listing.get("closet_item_id")
        listing_id = listing.get("id")
        
        # If we compressed this closet item, copy its compressed images over
        if closet_item_id in compressed_items_map:
            c_item = compressed_items_map[closet_item_id]
            cover_image = c_item.get("original_image_url") or c_item.get("segmented_image_url")
            if cover_image:
                listings_coll.update_one(
                    {"id": listing_id},
                    {"$set": {"images": [cover_image]}}
                )
                logger.info(f"Updated listing {listing_id} with compressed cover image.")
                
    logger.info("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_migration())
