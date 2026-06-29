import asyncio
from app.db.database import get_db
from app.services.scheduler import _generate_fallback_advice
from app.services.stylist_scheduler_brain import get_rotation_prioritized_closet

async def test():
    db = get_db()
    user = await db.users.find_one({})
    if not user:
        print("No user found")
        return
        
    closet_items = await get_rotation_prioritized_closet(user["id"], limit=40)
    print(f"Loaded {len(closet_items)} closet items.")
    
    # Summer heatwave in Israel (e.g. 34°C, Sunny)
    weather_ctx = {"temp_c": 34.0, "condition": "Sunny", "description": "clear sky"}
    advice = _generate_fallback_advice(closet_items, "casual", weather_ctx)
    
    print("\n--- ISRAELI SUMMER HEATWAVE FALLBACK (34°C) ---")
    for r in advice["outfit_recommendations"]:
        print(f"Name: {r['name']}")
        print(f"Items: {[it['description'] for it in r['items']]}")
        print(f"Why: {r['why']}")

if __name__ == "__main__":
    asyncio.run(test())
