import asyncio
from app.db.database import get_db
from app.services.stylist_scheduler_brain import generate_event_proposals

async def run_test():
    db = get_db()
    user = await db.users.find_one({})
    if not user:
        print("No user found in DB")
        return
    u_gender = user.get("gender") or user.get("sex")
    u_id = user.get("id")
    print(f"Testing for user {u_id} (gender: {u_gender})")
    result = await generate_event_proposals(user=user, event_prompt="Hindu wedding")
    recs = result.get("outfit_recommendations") or []
    print(f"Received {len(recs)} proposals")
    for i, r in enumerate(recs):
        name = r.get("name")
        print(f"Outfit {i+1}: {name}")
        for itm in r.get("items", []):
            role = itm.get("role")
            iname = itm.get("name")
            cid = itm.get("closet_item_id")
            print(f"  - role: {role}, name: {iname}, cid: {cid}")
        print(f"  Why: {r.get('why')}")
        print(f"  QA Notes: {r.get('qa_notes')}")

asyncio.run(run_test())
