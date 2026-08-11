import asyncio
from app.db.database import get_db

async def run():
    db = get_db()
    users = await db.users.find({}).to_list(length=100)
    for u in users:
        tokens = u.get("google_calendar_tokens") or {}
        print(u.get("email"), "tokens_present:", bool(tokens), "scopes:", tokens.get("scope"))

asyncio.run(run())
