import asyncio
from app.db.database import get_db
from app.services.billing_service import deduct_user_credits

async def main():
    db = get_db()
    user_record = await db.users.find_one({"email": "lokoprod@gmail.com"})
    print("USER RECORD FOUND:", bool(user_record))
    if user_record:
        print("USER ID:", user_record.get("id"))
        try:
            res = await deduct_user_credits(db, user_record, cost=1)
            print("DEDUCT RESULT:", res)
        except Exception as e:
            print("DEDUCT EXCEPTION:", e)

if __name__ == "__main__":
    asyncio.run(main())
