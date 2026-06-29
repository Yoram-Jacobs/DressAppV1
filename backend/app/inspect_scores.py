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
        
    closet_items = await get_rotation_prioritized_closet(user["id"], limit=100)
    weather_ctx = {"temp_c": 34.0, "condition": "Sunny", "description": "clear sky"}
    
    style_key = "casual"
    style_synonyms = {
        "casual": ["casual", "daily", "יומיומי", "קז'ואל", "קזואל", "פשוט", "יומי"],
        "formal": ["formal", "business", "אלגנטי", "רשמי", "מחויט", "חגיגי"],
        "sporty": ["sporty", "athletic", "sport", "ספורטיבי", "ספורט", "אימון", "ריצה"],
        "work": ["work", "office", "עבודה", "משרד", "חצי רשמי"]
    }
    syns = style_synonyms.get(style_key, [style_key])
    
    temp_c = 34.0
    
    scored_tops = []
    scored_bottoms = []
    
    for idx, item in enumerate(closet_items):
        item["original_index"] = idx
        score = 0
        
        tags = [t.lower() for t in item.get("tags") or []]
        title = (item.get("title") or "").lower()
        category = (item.get("category") or "").lower()
        brand = (item.get("brand") or "").lower()
        
        # Style match
        style_match = any(syn in tags or syn in title or syn in category or syn in brand for syn in syns)
        if style_match:
            score += 15
            
        # Temp match
        temp_log = ""
        if temp_c >= 28:
            if category in {"jacket", "coat", "blazer", "outerwear"}:
                score -= 30
                temp_log = "Jacket penalty -30"
            if category == "top":
                if any(w in title or w in tags for w in ["long sleeve", "long-sleeve", "sweater", "coat", "wool", "knit", "heavy", "ארוך", "סוודר"]):
                    score -= 30
                    temp_log = "Long top penalty -30"
                elif any(w in title or w in tags for w in ["short sleeve", "short-sleeve", "tshirt", "tee", "tank", "polo", "קצר", "גופייה", "טי"]):
                    score += 30
                    temp_log = "Short top bonus +30"
            if category == "bottom":
                if any(w in title or w in tags for w in ["shorts", "skirt", "קצרים", "חצאית"]):
                    score += 30
                    temp_log = "Shorts bonus +30"
                elif any(w in title or w in tags for w in ["pants", "jeans", "trousers", "ארוכים"]) and not any(w in title for w in ["linen", "light", "thin"]):
                    score -= 20
                    temp_log = "Long pants penalty -20"
                    
        item["score"] = score
        item["style_match"] = style_match
        item["temp_log"] = temp_log
        
        # Map to categories
        cat = (item.get("category") or "top").lower()
        if cat in {"shoe", "footwear", "sneaker", "boot", "heel", "shoes"}:
            pass
        elif cat in {"shirt", "tshirt", "top", "blouse", "sweater", "knit", "polo"}:
            scored_tops.append(item)
        elif cat in {"pants", "trousers", "jeans", "shorts", "skirt", "bottom"}:
            scored_bottoms.append(item)
            
    # Sort
    scored_tops.sort(key=lambda x: (x["score"], -x["original_index"]), reverse=True)
    scored_bottoms.sort(key=lambda x: (x["score"], -x["original_index"]), reverse=True)
    
    print("\n--- ALL TOPS ---")
    for t in scored_tops:
        print(f"Title: {t['title']} | Score: {t['score']} (Style: {t['style_match']}, Temp: {t['temp_log']}) | Index: {t['original_index']}")
        
    print("\n--- ALL BOTTOMS ---")
    for b in scored_bottoms:
        print(f"Title: {b['title']} | Score: {b['score']} (Style: {b['style_match']}, Temp: {b['temp_log']}) | Index: {b['original_index']}")

if __name__ == "__main__":
    asyncio.run(test())
