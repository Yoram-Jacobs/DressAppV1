import asyncio
from app.db.database import get_db

async def main():
    db = get_db()
    user = await db.users.find_one({})
    if not user:
        print("No user found")
        return
    print(f"User email: {user.get('email')}")
    print(f"User home_location: {user.get('home_location')}")
    print(f"User scheduler_settings: {user.get('scheduler_settings')}")
    
    # Check closet items
    count = await db.closet_items.count_documents({"user_id": user["id"]})
    print(f"Closet items count: {count}")
    
    # List items
    cursor = db.closet_items.find({"user_id": user["id"]}).limit(30)
    async for item in cursor:
        print(f"Item: {item['id']} | Title: {item.get('title')} | Category: {item.get('category')} | Tags: {item.get('tags')}")

if __name__ == "__main__":
    asyncio.run(main())
