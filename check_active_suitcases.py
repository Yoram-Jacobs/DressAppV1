import asyncio
from app.db.database import get_db

async def main():
    db = get_db()
    suitcases = await db.suitcases.find({}).to_list(100)
    print("Suitcases in db:")
    for s in suitcases:
        print(f"ID: {s.get('id')}, user_id: {s.get('user_id')}, destinations: {s.get('destinations')}, status: {s.get('status')}, departure: {s.get('departure_time')}, return: {s.get('return_time')}, updated_at: {s.get('updated_at')}")

    print("\nArchives in db:")
    archives = await db.suitcase_archives.find({}).to_list(100)
    for a in archives:
         print(f"ID: {a.get('id')}, user_id: {a.get('user_id')}, destination: {a.get('destination')}, departure: {a.get('departure_time')}, return: {a.get('return_time')}, updated_at: {a.get('updated_at')}")

if __name__ == '__main__':
    asyncio.run(main())
