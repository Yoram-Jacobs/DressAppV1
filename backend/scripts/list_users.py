import asyncio
from app.db.database import get_db

async def run():
    db = get_db()
    users = await db.users.find({}).to_list(length=100)
    for u in users:
        print(u.get("email"), "tokens_present:", bool(u.get("google_calendar_tokens")), "keys:", list((u.get("google_calendar_tokens") or {}).keys()))

asyncio.run(run())
