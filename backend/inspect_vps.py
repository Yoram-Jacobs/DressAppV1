import asyncio
from app.db.database import get_db

async def main():
    db = get_db()
    users = await db.users.find().to_list(100)
    for u in users:
        print("EMAIL:", u.get("email"))
        print("SUB:", u.get("subscription"))
        print("AI_CONFIG:", u.get("ai_configuration"))
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(main())
