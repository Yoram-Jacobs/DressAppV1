import asyncio
from app.db.database import get_db

async def run():
    db = get_db()
    uid = "f840e23d-6a4e-43fb-9184-24554d9523a7"
    outfits = await db.outfits.count_documents({"user_id": uid})
    sim_notifs = await db.simulated_notifications.count_documents({"user_id": uid})
    sessions = await db.stylist_sessions.count_documents({"user_id": uid})
    messages = await db.stylist_messages.count_documents({"user_id": uid})
    closet_items = await db.closet_items.count_documents({"user_id": uid})
    total_closet_items = await db.closet_items.count_documents({})
    
    print(f"User: {uid}")
    print(f"  closet_items count: {closet_items}")
    print(f"  outfits count: {outfits}")
    print(f"  simulated_notifications count: {sim_notifs}")
    print(f"  stylist_sessions count: {sessions}")
    print(f"  stylist_messages count: {messages}")
    print(f"Total closet items in DB: {total_closet_items}")
    
    # Check if there are other users
    all_users = await db.closet_items.distinct("user_id")
    print(f"Distinct user_ids in closet_items: {all_users}")

if __name__ == '__main__':
    asyncio.run(run())
