import asyncio
from app.db.mongodb import get_db

async def check():
    db = get_db()
    user_id = 'f840e23d-6a4e-43fb-9184-24554d9523a7'
    items = await db.closet_items.find({'user_id': user_id, 'is_duplicate': {'$ne': True}}).to_list(100)
    print(f'Total items: {len(items)}')
    
    work_items = []
    for it in items:
        tags = [str(t).lower() for t in (it.get('tags') or []) + (it.get('custom_tags') or [])]
        if any('עבודה' in t or 'work' in t for t in tags):
            work_items.append(it)
    print(f'Work tagged items: {len(work_items)}')
    for wi in work_items:
        print(f"  [{wi.get('category')}] {wi.get('title') or wi.get('name')} (id: {wi.get('id')}, wear: {wi.get('wear_count', 0)}, last_worn: {wi.get('last_worn_at')})")
    
    proposals = await db.daily_proposals.find({'user_id': user_id}).sort('date', -1).to_list(10)
    print(f'\nRecent proposals ({len(proposals)}):')
    for p in proposals:
        item_names = [it.get('name') for it in p.get('items', [])]
        print(f"  Date: {p.get('date')}, Worn: {p.get('worn')}, Title: {p.get('title')}, Items: {item_names}")

if __name__ == '__main__':
    asyncio.run(check())
