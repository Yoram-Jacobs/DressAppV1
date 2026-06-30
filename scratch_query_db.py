import asyncio
from app.db.database import get_db

async def run():
    db = get_db()
    async for user in db.users.find({}):
        print("User ID:", user.get("id"))
        print("Scheduler settings:", user.get("scheduler_settings"))
        print("---")

asyncio.run(run())
