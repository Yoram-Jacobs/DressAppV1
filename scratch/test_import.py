import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, r"C:\DressApp_AG\backend")

from app.db.database import get_db
from app.api.v1.closet import import_competitor_closet, ImportCompetitorIn

async def test_import():
    db = get_db()
    # Find a test user or dummy user
    user = await db.users.find_one({})
    if not user:
        print("No user found in DB")
        return
    print(f"Testing import for user {user.get('id')}")

    mock_items = [
        {"id": "appA_1", "title": "Classic White Linen Shirt", "category": "Top", "color": "White", "brand": "Zara", "wear_count": 5},
        {"id": "appA_2", "title": "Slim Dark Indigo Jeans", "category": "Bottom", "color": "Blue", "brand": "Levi's", "wear_count": 12}
    ]
    mock_outfits = [
        {
            "name": "Casual Friday Office",
            "description": "Classic Linen Shirt with Slim Jeans",
            "garments": [
                {"item_id": "appA_1", "role": "Top", "title": "Classic White Linen Shirt"},
                {"item_id": "appA_2", "role": "Bottom", "title": "Slim Dark Indigo Jeans"}
            ]
        }
    ]

    payload = ImportCompetitorIn(
        app_name="Whering",
        items=mock_items,
        outfits=mock_outfits
    )

    try:
        res = await import_competitor_closet(payload, user)
        print("Import successful! Result:", res)
    except Exception as exc:
        print("Import failed with exception:", exc)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_import())
