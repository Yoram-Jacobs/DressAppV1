import asyncio
from app.db.database import get_db

async def main():
    db = get_db()
    user_id = 'f840e23d-6a4e-43fb-9184-24554d9523a7'
    # Find outfits for this user on 2026-07-18
    outfit = await db.outfits.find_one({"user_id": user_id, "usage.date": "2026-07-18"})
    if outfit:
        print("Found outfit for lokoprod on 2026-07-18:")
        import pprint
        pprint.pprint(outfit)
    else:
        print("No outfit found for lokoprod on 2026-07-18")
        # Find any outfits for this user
        async for o in db.outfits.find({"user_id": user_id}).sort("created_at", -1).limit(5):
             print(f"ID: {o.get('id')}, Date: {o.get('usage', {}).get('date')}, Name: {o.get('name')}, Source: {o.get('source_workflow')}")

if __name__ == "__main__":
    asyncio.run(main())
