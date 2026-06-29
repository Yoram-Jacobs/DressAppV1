import asyncio
import logging
from app.db.database import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    db = get_db()
    
    # 1. Update users where scheduler_settings is null, missing, or not an object
    res1 = await db.users.update_many(
        {"$or": [
            {"scheduler_settings": None},
            {"scheduler_settings": {"$exists": False}},
            {"scheduler_settings": {"$not": {"$type": "object"}}}
        ]},
        {"$set": {"scheduler_settings": {
            "enabled": True,
            "time": "08:00",
            "frequency": "everyday",
            "style_option": "casual"
        }}}
    )
    
    # 2. Update users where scheduler_settings is already an object
    res2 = await db.users.update_many(
        {"scheduler_settings": {"$type": "object"}},
        {"$set": {"scheduler_settings.enabled": True}}
    )
    
    logger.info(
        f"Re-enabled push notifications. "
        f"Created settings for {res1.modified_count} users. "
        f"Updated existing settings for {res2.modified_count} users."
    )

if __name__ == "__main__":
    asyncio.run(main())
