import asyncio
import logging
from app.db.database import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    db = get_db()
    res = await db.users.update_many({}, {"$set": {"scheduler_settings.enabled": True}})
    logger.info(f"Re-enabled push notifications for all users: matched {res.matched_count}, modified {res.modified_count}")

if __name__ == "__main__":
    asyncio.run(main())
