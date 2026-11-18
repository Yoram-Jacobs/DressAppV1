import asyncio, json
from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.config import settings

async def main():
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    it = await db.closet_items.find_one({"id": "9bc62dd6-f976-43dc-a1c6-4493085b0c4c"})
    if it and "_id" in it:
        del it["_id"]
    print(json.dumps(it, indent=2, ensure_ascii=False))

asyncio.run(main())
