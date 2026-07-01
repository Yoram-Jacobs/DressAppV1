import asyncio
from app.db.database import get_db

async def run():
    db = get_db()
    # Find all sessions for user f840e23d-6a4e-43fb-9184-24554d9523a7
    sessions = await db.stylist_sessions.find({"user_id": "f840e23d-6a4e-43fb-9184-24554d9523a7"}).to_list(100)
    sessions.sort(key=lambda x: x.get("last_active_at", ""), reverse=True)
    if not sessions:
        print("No sessions found.")
        return
    s = sessions[0]
    print(f"Active Session: {s['id']} Title: {s.get('title')}")
    msgs = await db.stylist_messages.find({"session_id": s["id"]}).to_list(100)
    msgs.sort(key=lambda x: x.get("created_at", ""))
    for m in msgs:
        print(f"[{m.get('role')}] text: {m.get('text')} | spoken: {m.get('spoken_text')} | err: {m.get('error')}")

asyncio.run(run())
