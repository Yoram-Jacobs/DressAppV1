import asyncio
from app.db.database import get_db

async def run():
    db = get_db()
    users = await db.users.find({}).to_list(length=100)
    for u in users:
        if u.get("google_calendar_tokens"):
            print(f"User: {u['id']}, email: {u.get('email')}")
            print(f"Tokens: {u['google_calendar_tokens']}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(run())
