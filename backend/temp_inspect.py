import asyncio
from datetime import datetime, timezone, timedelta
from app.db.database import get_db
from app.services.stylist_scheduler_brain import (
    norm_category,
    calculate_garment_style_score,
    matches_season_func,
    _item_has_any_tag
)

async def test_sorting():
    db = get_db()
    uid = 'f840e23d-6a4e-43fb-9184-24554d9523a7'
    user = await db.users.find_one({'id': uid})
    target_date_str = '2026-10-18'
    ref_dt = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    start_str = (ref_dt - timedelta(days=5)).strftime("%Y-%m-%d")

    recency_map = {}
    cursor = db.daily_proposals.find({
        "user_id": uid,
        "date": {"$gte": start_str, "$lte": target_date_str},
    }).sort("date", -1)
    
    async for prop in cursor:
        p_date_str = prop.get("date") or ""
        try:
            p_dt = datetime.strptime(p_date_str, "%Y-%m-%d").date()
            days_ago = (ref_dt - p_dt).days
        except Exception:
            days_ago = 1
        for it in (prop.get("items") or []):
            cid = str(it.get("closet_item_id") or it.get("id") or "")
            if cid and (cid not in recency_map or days_ago < recency_map[cid]):
                recency_map[cid] = days_ago

    items = await db.closet_items.find({'user_id': uid, 'is_duplicate': {'$ne': True}}).to_list(200)

    # Let's test sort_key
    style_dress_for = 'עבודה'
    is_tags_filter = True
    target_season = 'spring'

    def sort_key(item: dict) -> tuple:
        cid = str(item.get("id") or "")
        days_ago = recency_map.get(cid)
        recent_penalty = 0
        if days_ago is not None:
            if days_ago == 0:
                recent_penalty = 1000
            elif days_ago == 1:
                recent_penalty = 600
            elif days_ago == 2:
                recent_penalty = 400
            elif days_ago == 3:
                recent_penalty = 200
            else:
                recent_penalty = 100

        last_worn = item.get("last_worn_at") or ""
        if last_worn:
            try:
                lw_date = datetime.strptime(last_worn[:10], "%Y-%m-%d").date()
                diff = (ref_dt - lw_date).days
                if diff == 0:
                    recent_penalty = max(recent_penalty, 1000)
                elif diff == 1:
                    recent_penalty = max(recent_penalty, 600)
                elif diff == 2:
                    recent_penalty = max(recent_penalty, 400)
                elif diff == 3:
                    recent_penalty = max(recent_penalty, 200)
            except Exception:
                pass

        style_score = calculate_garment_style_score(
            item,
            style_dress_for,
            is_tags_mode=is_tags_filter,
            occupation=user.get('occupation'),
            respect_occupation=True,
            user_gender=user.get('gender')
        )
        season_score = 10 if matches_season_func(item, target_season) else 0
        wear_count = item.get("wear_count") or 0
        wear_penalty = min(wear_count * 10, 100)
        
        rot_hash = abs(hash(f"{uid}_{cid}_{style_dress_for}_{target_date_str}")) % 1000

        return (recent_penalty, wear_penalty, -style_score, -season_score, rot_hash)

    bottoms = [b for b in items if norm_category(b.get('category')) == 'bottom' and _item_has_any_tag(b, ['עבודה'])]
    bottoms.sort(key=sort_key)
    print("=== BOTTOMS AFTER NEW ROTATION SORT ===")
    for b in bottoms[:10]:
        cid = b.get('id')
        print(f"  {b.get('title') or b.get('name')} | recency_pen={recency_map.get(cid, 'none')} | wear={b.get('wear_count', 0)}")
    
    shoes = [s for s in items if norm_category(s.get('category')) == 'shoes' and _item_has_any_tag(s, ['עבודה'])]
    shoes.sort(key=sort_key)
    print("\n=== SHOES AFTER NEW ROTATION SORT ===")
    for s in shoes:
        cid = s.get('id')
        print(f"  {s.get('title') or s.get('name')} | recency_pen={recency_map.get(cid, 'none')} | wear={s.get('wear_count', 0)}")

    tops = [t for t in items if norm_category(t.get('category')) == 'top' and _item_has_any_tag(t, ['עבודה'])]
    tops.sort(key=sort_key)
    print("\n=== TOPS AFTER NEW ROTATION SORT ===")
    for t in tops[:10]:
        cid = t.get('id')
        print(f"  {t.get('title') or t.get('name')} | recency_pen={recency_map.get(cid, 'none')} | wear={t.get('wear_count', 0)}")

if __name__ == '__main__':
    asyncio.run(test_sorting())
