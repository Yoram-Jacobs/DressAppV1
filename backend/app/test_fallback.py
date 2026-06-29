import asyncio
import logging
from app.db.database import get_db
from app.services.scheduler import _generate_fallback_advice
from app.services.stylist_scheduler_brain import get_rotation_prioritized_closet

logging.basicConfig(level=logging.INFO)

async def test():
    db = get_db()
    user = await db.users.find_one({})
    if not user:
        print("No user found")
        return
        
    closet_items = await get_rotation_prioritized_closet(user["id"], limit=20)
    print(f"Loaded {len(closet_items)} closet items.")
    
    # 1. Warm weather test
    weather_ctx_warm = {"temp_c": 28.0, "condition": "Sunny", "description": "clear sky"}
    advice_warm = _generate_fallback_advice(closet_items, "casual", weather_ctx_warm)
    print("\n--- WARM WEATHER FALLBACK ---")
    for r in advice_warm["outfit_recommendations"]:
        print(f"Name: {r['name']}")
        print(f"Items: {[it['description'] for it in r['items']]}")
        print(f"Why: {r['why']}")
        
    # 2. Cold/Rainy weather test
    weather_ctx_cold_rain = {"temp_c": 8.0, "condition": "Rain", "description": "heavy intensity rain"}
    advice_cold = _generate_fallback_advice(closet_items, "casual", weather_ctx_cold_rain)
    print("\n--- COLD & RAINY WEATHER FALLBACK ---")
    for r in advice_cold["outfit_recommendations"]:
        print(f"Name: {r['name']}")
        print(f"Items: {[it['description'] for it in r['items']]}")
        print(f"Why: {r['why']}")

if __name__ == "__main__":
    asyncio.run(test())
