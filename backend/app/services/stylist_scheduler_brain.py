"""AI Stylist Scheduler Brain Service (Phase Scheduler)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from app.db.database import get_db
from app.services.gemini_stylist import gemini_stylist_service
from app.services.marketplace_search import suggest_for_query
from app.services import repos

logger = logging.getLogger(__name__)


SYNONYMS = {
    "עבודה": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear"],
    "work": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear"],
    "business": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear"],
    "business casual": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear"],
    "business-casual": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear"],
    "smart-casual": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear", "smart casual"],
    "smart casual": ["עבודה", "work", "business", "business-casual", "business casual", "smart-casual", "smart casual", "formal", "office", "workwear", "smart-casual"],
    "casual": ["casual", "יומיום", "יומיומי", "קז'ואל", "everyday", "everyday wear"],
    "יומיום": ["casual", "יומיום", "יומיומי", "קז'ואל", "everyday", "everyday wear"],
    "יומיומי": ["casual", "יומיום", "יומיומי", "קז'ואל", "everyday", "everyday wear"],
    "קיץ": ["קיץ", "summer", "summer wear", "poolwear", "beachwear"],
    "summer": ["קיץ", "summer", "summer wear", "poolwear", "beachwear"],
    "winter": ["חורף", "winter", "winter wear", "snow", "cold"],
    "חורף": ["חורף", "winter", "winter wear", "snow", "cold"],
}

def norm_category(cat: Any) -> str:
    """Normalize raw clothing categories into standard taxonomy tokens."""
    s = str(cat or "").strip().lower().replace(" ", "_").replace("-", "_")
    if s in (
        "top", "tops", "shirt", "shirts", "t_shirt", "tshirt", "tshirts",
        "polo", "sweater", "sweaters", "blouse", "blouses", "hoodie",
        "hoodies", "tank", "tank_top", "tanktop", "crop_top", "sweatshirt",
        "cardigan", "knitwear", "topwear"
    ):
        return "top"
    if s in (
        "bottom", "bottoms", "pants", "shorts", "jeans", "skirt", "skirts",
        "trousers", "joggers", "leggings", "sweatpants", "chinos", "slacks",
        "bottomwear"
    ):
        return "bottom"
    if s in (
        "footwear", "shoes", "shoe", "sneakers", "sneaker", "boots", "boot",
        "sandals", "sandal", "heels", "heel", "loafers", "loafer", "slides",
        "slippers", "flats"
    ):
        return "shoes"
    if s in (
        "dress", "dresses", "jumpsuit", "jumpsuits", "suit", "suits", "overall",
        "overalls", "dungaree", "dungarees", "full_body", "full_body_suit",
        "romper", "gown", "tracksuit", "bodysuit", "unitard"
    ):
        return "dress"
    if s in (
        "outerwear", "jacket", "jackets", "coat", "coats", "blazer",
        "blazers", "parka", "trench", "vest", "overcoat"
    ):
        return "outerwear"
    return "accessory"


def calculate_garment_style_score(item: dict, style_dress_for: str | None) -> int:
    if not style_dress_for:
        return 0
        
    prompt_lower = style_dress_for.strip().lower()
    tags = [str(t).lower() for t in (item.get("tags") or [])]
    custom_tags = [str(t).lower() for t in (item.get("custom_tags") or [])]
    title = str(item.get("title") or item.get("name") or "").lower()
    sub_cat = str(item.get("sub_category") or item.get("item_type") or "").lower()
    cat = norm_category(item.get("category"))
    dress_code = str(item.get("dress_code") or "").lower()
    material = str(item.get("material") or "").lower()
    all_text = f"{title} {sub_cat} {cat} {dress_code} {material} {' '.join(tags)} {' '.join(custom_tags)}"
    
    score = 0
    
    # Check exact tag / token matches
    for t in tags + custom_tags:
        if t and t in prompt_lower:
            score += 30
            
    # Formality / Occasion analysis
    is_formal_or_smart = any(w in prompt_lower for w in (
        "elegant", "smart casual", "smart-casual", "business", "formal", "party", "birthday", 
        "dinner", "restaurant", "wedding", "cocktail", "celebration", "date night", "asian food",
        "אלגנטי", "ערב", "מסיבה", "מסעדה", "חתונה", "אירוע", "חגיגי", "יומולדת", "יום הולדת"
    ))
    
    is_swim_beach = any(w in prompt_lower for w in (
        "beach", "pool", "swim", "swimming", "sea", "resort", "ים", "בריכה", "שחייה", "חוף"
    ))
    
    is_sport_gym = any(w in prompt_lower for w in (
        "gym", "workout", "running", "sport", "fitness", "yoga", "אימון", "כושר", "ריצה", "ספורט"
    ))
    
    if is_formal_or_smart and not is_swim_beach and not is_sport_gym:
        # Severe penalties for clashing casual/beach/gym/sleeveless wear
        if any(w in all_text for w in ("swim", "swimwear", "trunks", "בגד ים")):
            return -100
        if any(w in all_text for w in ("tank top", "tank", "sleeveless", "גופייה", "גופיה")):
            return -80
        if any(w in all_text for w in ("sweatpants", "pajama", "sleepwear", "פיג'מה", "טרנינג")):
            return -70
        if any(w in all_text for w in ("flip flop", "slide", "slides", "כפכף", "כפכפים")):
            return -70
        if any(w in all_text for w in ("running shorts", "gym shorts")):
            return -60
            
        # Boosts for elegant / smart casual pieces
        if any(w in all_text for w in ("button", "dress shirt", "collared", "polo", "oxford", "linen shirt", "חולצה מכופתרת", "פולו")):
            score += 40
        if any(w in all_text for w in ("blazer", "suit", "jacket", "בלייזר", "חליפה")):
            score += 35
        if any(w in all_text for w in ("chino", "trouser", "slacks", "dress pants", "tailored", "מכנסיים", "צ'ינו", "אלגנט")):
            score += 35
        if any(w in all_text for w in ("leather", "derby", "loafer", "chelsea", "boot", "smart", "מוקסין", "נעלי עור", "מגפיים")):
            score += 30
        if any(w in all_text for w in ("dress", "one-piece", "jumpsuit", "שמלה")):
            score += 35
        if dress_code in ("business", "formal", "cocktail", "smart_casual", "smart casual"):
            score += 25
            
    elif is_swim_beach:
        if any(w in all_text for w in ("swim", "swimwear", "trunks", "בגד ים", "beach")):
            score += 40
        if any(w in all_text for w in ("flip flop", "slide", "sandals", "כפכף")):
            score += 25
        if any(w in all_text for w in ("suit", "blazer", "formal", "חליפה")):
            return -50
            
    elif is_sport_gym:
        if any(w in all_text for w in ("athletic", "gym", "running", "sport", "אימון", "ספורט")):
            score += 35
        if any(w in all_text for w in ("suit", "blazer", "dress shirt", "leather", "חליפה", "נעלי עור")):
            return -50
            
    return score

def matches_style_func(item: dict, style_dress_for: str | None, has_exact_tag_match: bool = False) -> bool:
    if not style_dress_for:
        return True
    score = calculate_garment_style_score(item, style_dress_for)
    return score >= 0

def matches_season_func(item: dict, target_season: str | None) -> bool:
    if not target_season:
        return True
        
    item_seasons = item.get("season") or []
    if isinstance(item_seasons, str):
        item_seasons = [item_seasons]
    item_seasons = [s.lower().strip() for s in item_seasons]
    
    if "all" in item_seasons:
        return True
    if target_season in item_seasons:
        return True
        
    tags = [t.lower() for t in (item.get("tags") or [])]
    season_syns = SYNONYMS.get(target_season, [target_season])
    for s in season_syns:
        if s in tags:
            return True
            
    return False

async def get_rotation_prioritized_closet(
    user_id: str,
    limit: int = 40,
    style_dress_for: str | None = None,
    weather: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """Fetch closet items prioritized for rotation, matching tag restrictions and weather/season.

    Filters out duplicates (`is_duplicate=True`) and partitions items into category buckets.
    Prioritizes items matching the style/tag and target weather season first, then sorts
    by rotation parameters:
    1. Items never suggested or suggested longest ago (`last_suggested_at` null, then ascending).
    2. Items never worn or worn longest ago (`last_worn_at` null, then ascending).
    3. Wear count ascending (`wear_count` ascending).
    """
    db = get_db()
    cursor = db.closet_items.find(
        {
            "user_id": user_id,
            "is_duplicate": {"$ne": True},
            "group_role": {"$ne": "member"},
        }
    )
    items = [doc async for doc in cursor]

    # Clean Mongo ObjectId
    for item in items:
        if "_id" in item:
            item.pop("_id")

    # Hydrate group members if they are part of a set
    group_ids = [r["group_id"] for r in items if r.get("group_id")]
    if group_ids:
        members_cursor = db.closet_items.find({
            "group_id": {"$in": group_ids},
            "group_role": "member",
            "is_duplicate": {"$ne": True},
        })
        members = [doc async for doc in members_cursor]
        
        from collections import defaultdict
        members_by_group = defaultdict(list)
        for m in members:
            if "_id" in m:
                m.pop("_id")
            members_by_group[m["group_id"]].append(m)
            
        final_items = []
        for item in items:
            final_items.append(item)
            g_id = item.get("group_id")
            if g_id and g_id in members_by_group:
                g_members = members_by_group[g_id]
                all_cats = {norm_category(item.get("category")), *(norm_category(m.get("category")) for m in g_members)}
                if len(all_cats) > 1:
                    final_items.extend(g_members)
        items = final_items

    # Check if there is at least one exact case-insensitive tag match in the user's closet
    has_exact_tag_match = False
    if style_dress_for:
        style_clean = style_dress_for.strip().lower()
        for it in items:
            it_tags = [t.lower() for t in (it.get("tags") or [])]
            it_custom = [t.lower() for t in (it.get("custom_tags") or [])]
            if style_clean in it_tags or style_clean in it_custom:
                has_exact_tag_match = True
                break

    # Determine target season
    target_season = None
    if weather:
        temp = weather.get("temp_c")
        if temp is not None:
            if temp >= 23:
                target_season = "summer"
            elif temp <= 15:
                target_season = "winter"
            else:
                target_season = "spring"
    
    if not target_season:
        # Fallback to current calendar month
        from datetime import datetime
        now_month = datetime.now().month
        if now_month in [5, 6, 7, 8, 9]:
            target_season = "summer"
        elif now_month in [11, 12, 1, 2]:
            target_season = "winter"
        else:
            target_season = "spring"

    # Rotation sort key: matches criteria first, then un-suggested/un-worn, oldest suggested, lowest wear
    def sort_key(item: dict[str, Any]) -> tuple:
        style_score = calculate_garment_style_score(item, style_dress_for)
        matches_season = matches_season_func(item, target_season)
        season_score = 10 if matches_season else 0
        
        last_sug = item.get("last_suggested_at") or ""
        last_worn = item.get("last_worn_at") or ""
        wear_count = item.get("wear_count") or 0
        
        sug_val = last_sug if last_sug else "0000-00-00"
        worn_val = last_worn if last_worn else "0000-00-00"
        
        # Style score is PRIMARY (-style_score: highest score first).
        # Season is secondary (-season_score).
        # Rotation (sug_val, worn_val, wear_count) is tie-breaker among matching items.
        return (-style_score, -season_score, sug_val, worn_val, wear_count)

    # Partition items into category buckets using global norm_category
    buckets: dict[str, list[dict[str, Any]]] = {
        "top": [],
        "bottom": [],
        "shoes": [],
        "dress": [],
        "outerwear": [],
        "accessory": [],
    }

    for item in items:
        cat_key = norm_category(item.get("category"))
        if cat_key not in buckets:
            cat_key = "accessory"
        buckets[cat_key].append(item)

    # Sort each bucket by rotation key
    for cat_key in buckets:
        buckets[cat_key].sort(key=sort_key)

    # Target distribution ratios for a balanced candidate pool
    target_ratios = {
        "top": 0.35,
        "bottom": 0.35,
        "shoes": 0.20,
        "dress": 0.04,
        "outerwear": 0.04,
        "accessory": 0.02,
    }

    min_quotas = {"top": 4, "bottom": 4, "shoes": 4, "dress": 1, "outerwear": 1, "accessory": 1}
    quotas = {cat: max(min_quotas.get(cat, 1), int(limit * ratio)) for cat, ratio in target_ratios.items()}

    # Selected items list
    selected_ids = set()
    result_items = []

    # First pass: take up to quota from each category bucket
    leftover_budget = 0
    for cat_key, bucket in buckets.items():
        q = quotas[cat_key]
        taken = bucket[:q]
        for item in taken:
            if item["id"] not in selected_ids:
                selected_ids.add(item["id"])
                result_items.append(item)
        if len(taken) < q:
            leftover_budget += (q - len(taken))

    # Second pass: redistribute leftover budget to categories with remaining items
    if leftover_budget > 0:
        for cat_key in ["top", "bottom", "shoes", "dress", "outerwear", "accessory"]:
            bucket = buckets[cat_key]
            q = quotas[cat_key]
            remaining_in_bucket = bucket[q:]
            for item in remaining_in_bucket:
                if leftover_budget <= 0:
                    break
                if item["id"] not in selected_ids:
                    selected_ids.add(item["id"])
                    result_items.append(item)
                    leftover_budget -= 1

    return result_items[:limit]


async def update_suggested_timestamps(closet_item_ids: list[str]) -> None:
    """Update last_suggested_at timestamp for list of closet item IDs."""
    if not closet_item_ids:
        return
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.closet_items.update_many(
        {"id": {"$in": closet_item_ids}},
        {"$set": {"last_suggested_at": now}}
    )


async def check_event_similarities(
    user_id: str,
    proposals: list[dict[str, Any]],
    current_location: str | None,
    current_event: str | None
) -> None:
    """Check for similar outfits worn in previous event/location.

    If an outfit uses the same items as a previous outfit for a similar event type or location,
    appends the warning note:
    'This outfit was in use on @date and place @place for @Event'.
    """
    if not proposals:
        return
    db = get_db()
    cursor = db.outfits.find({"user_id": user_id})
    past_outfits = [doc async for doc in cursor]
    if not past_outfits:
        return

    # Normalize inputs for keyword matching
    loc_norm = (current_location or "").lower().strip()
    evt_norm = (current_event or "").lower().strip()

    for prop in proposals:
        prop_item_ids = {
            item.get("closet_item_id")
            for item in prop.get("items", [])
            if item.get("closet_item_id")
        }
        if not prop_item_ids:
            continue

        for past in past_outfits:
            past_item_ids = {
                item.get("closet_item_id")
                for item in past.get("garments", [])
                if item.get("closet_item_id")
            }
            # Overlap threshold: if they share 80%+ of their garments
            shared = prop_item_ids & past_item_ids
            total_unique = prop_item_ids | past_item_ids
            if not total_unique:
                continue

            similarity = len(shared) / len(total_unique)
            if similarity >= 0.8:
                # Check if it was for a similar location or event type
                past_usage = past.get("usage") or {}
                past_loc = (past_usage.get("location") or "").lower().strip()
                past_evt = (past.get("prompt") or past_usage.get("event_name") or "").lower().strip()

                is_similar = False
                if loc_norm and past_loc and (loc_norm in past_loc or past_loc in loc_norm):
                    is_similar = True
                if evt_norm and past_evt and (evt_norm in past_evt or past_evt in evt_norm):
                    is_similar = True

                if is_similar:
                    p_date = past_usage.get("date") or "unknown date"
                    p_place = past_usage.get("location") or "unknown place"
                    p_evt = past_usage.get("event_name") or past.get("prompt") or "Event"
                    note = f"This outfit was in use on {p_date} and place {p_place} for {p_evt}."
                    # Append note to the proposal why / rationale
                    why = prop.get("why") or ""
                    if note not in why:
                        prop["why"] = (why + f" Note: {note}").strip()


def _ensure_complete_outfit(prop: dict[str, Any], raw_closet: list[dict[str, Any]]) -> None:
    """Ensure proposal contains valid, non-duplicated items with correct roles and complete coverage, strictly sorted in anatomical order."""
    raw_by_id = {c["id"]: c for c in raw_closet if c.get("id")}
    items = prop.get("items") or []

    # 1. Sanitize and correct roles of LLM-returned items based on actual closet category.
    #    Enforce BOTH ID-level deduplication AND role-level deduplication (max one item per
    #    anatomical role). This prevents the LLM from slipping two footwear items into the
    #    proposal instead of a shoe + a bottom.
    sanitized_items = []
    seen_ids: set[str] = set()
    seen_roles: set[str] = set()  # Enforce one item per anatomical role
    SINGLETON_ROLES = {"top", "bottom", "shoes", "dress", "outerwear"}  # roles limited to 1

    for it in items:
        cid = it.get("closet_item_id")
        if not cid or cid not in raw_by_id:
            continue
        if cid in seen_ids:
            continue
        seen_ids.add(cid)

        c_item = raw_by_id[cid]
        true_cat = norm_category(c_item.get("category"))
        true_role = "shoes" if true_cat in ("footwear", "shoes") else true_cat

        # Drop duplicate role for singleton roles (e.g. second pair of shoes when
        # a shoe is already present — the hydration step will supply the missing bottom)
        if true_role in SINGLETON_ROLES and true_role in seen_roles:
            logger.info(
                "Dropping duplicate role '%s' (item %s) from outfit — role already filled",
                true_role, cid
            )
            continue
        seen_roles.add(true_role)

        # Background-free image selection: clean_image_url > reconstructed > cutout > thumbnail > image_url
        clean_img = (
            c_item.get("clean_image_url")
            or c_item.get("reconstructed_image_url")
            or c_item.get("cutout_url")
            or c_item.get("segmented_image_url")
            or c_item.get("image_url")
            or c_item.get("thumbnail_data_url")
        )

        sanitized_items.append({
            "id": cid,
            "closet_item_id": cid,
            "role": true_role,
            "category": c_item.get("category") or true_role.title(),
            "sub_category": c_item.get("sub_category") or c_item.get("item_type") or "",
            "description": it.get("description") or c_item.get("title") or c_item.get("name") or true_role.title(),
            "title": c_item.get("title") or c_item.get("name") or it.get("description") or true_role.title(),
            "name": c_item.get("name") or c_item.get("title") or it.get("description") or true_role.title(),
            "color": c_item.get("color") or (c_item.get("colors") and c_item.get("colors")[0] and (c_item["colors"][0].get("name") if isinstance(c_item["colors"][0], dict) else c_item["colors"][0])) or "",
            "clean_image_url": clean_img,
            "image_url": clean_img,
            "thumbnail_data_url": c_item.get("thumbnail_data_url") or clean_img,
        })

    # 1b. Check for clashing accessories (e.g. formal necktie / bowtie on casual T-shirt, tank top, shorts, etc.)
    final_sanitized = []
    outfit_has_formal_shirt = any(
        it["role"] in ("top", "outerwear", "dress") and (
            any(w in str(it.get("title", "")).lower() for w in ("button", "dress shirt", "collared", "blazer", "suit", "חולצה מכופתרת", "בלייזר", "חליפה"))
            or str(raw_by_id.get(it.get("closet_item_id", ""), {}).get("dress_code", "")).lower() in ("business", "formal")
        )
        for it in sanitized_items
    )
    for it in sanitized_items:
        if it["role"] == "accessory":
            desc = (str(it.get("title", "")) + " " + str(it.get("description", "")) + " " + str(it.get("sub_category", ""))).lower()
            is_formal_neckwear = any(w in desc for w in ("necktie", "silk tie", "polka dot", "עניבה", "עניבת")) or desc.strip() == "tie"
            if is_formal_neckwear and not outfit_has_formal_shirt:
                logger.info("Dropping formal neckwear %s from casual outfit lacking formal collared shirt / blazer", it.get("closet_item_id"))
                continue
        final_sanitized.append(it)
    sanitized_items = final_sanitized

    # 2. Check roles present
    roles_present = {it["role"] for it in sanitized_items}
    has_dress = "dress" in roles_present
    has_top = "top" in roles_present or has_dress
    has_bottom = "bottom" in roles_present or has_dress
    has_shoes = "shoes" in roles_present

    # Group available closet items by normalized role
    closet_by_role: dict[str, list[dict[str, Any]]] = {}
    for c_item in raw_closet:
        cat = norm_category(c_item.get("category"))
        role = "shoes" if cat in ("footwear", "shoes") else cat

        closet_by_role.setdefault(role, []).append(c_item)

    missing_notes = []

    # Hydrate Top if missing (and no dress)
    if not has_top:
        available_tops = [c for c in closet_by_role.get("top", []) if c["id"] not in seen_ids]
        if available_tops:
            t_item = available_tops[0]
            seen_ids.add(t_item["id"])
            t_clean_img = (
                t_item.get("clean_image_url")
                or t_item.get("reconstructed_image_url")
                or t_item.get("cutout_url")
                or t_item.get("thumbnail_data_url")
                or t_item.get("image_url")
            )
            sanitized_items.append({
                "id": t_item["id"],
                "closet_item_id": t_item["id"],
                "role": "top",
                "category": t_item.get("category") or "Top",
                "sub_category": t_item.get("sub_category") or t_item.get("item_type") or "",
                "description": t_item.get("title") or t_item.get("name") or "Top",
                "title": t_item.get("title") or t_item.get("name") or "Top",
                "name": t_item.get("name") or t_item.get("title") or "Top",
                "clean_image_url": t_clean_img,
                "image_url": t_clean_img,
                "thumbnail_data_url": t_item.get("thumbnail_data_url") or t_clean_img,
            })
            logger.info("Hydrated missing top %s into proposal", t_item["id"])
            has_top = True
        else:
            missing_notes.append("top/shirt")

    # Hydrate Bottom if missing (and no dress)
    if not has_bottom:
        available_bottoms = [c for c in closet_by_role.get("bottom", []) if c["id"] not in seen_ids]
        if available_bottoms:
            b_item = available_bottoms[0]
            seen_ids.add(b_item["id"])
            b_clean_img = (
                b_item.get("clean_image_url")
                or b_item.get("reconstructed_image_url")
                or b_item.get("cutout_url")
                or b_item.get("thumbnail_data_url")
                or b_item.get("image_url")
            )
            sanitized_items.append({
                "id": b_item["id"],
                "closet_item_id": b_item["id"],
                "role": "bottom",
                "category": b_item.get("category") or "Bottom",
                "sub_category": b_item.get("sub_category") or b_item.get("item_type") or "",
                "description": b_item.get("title") or b_item.get("name") or "Bottom",
                "title": b_item.get("title") or b_item.get("name") or "Bottom",
                "name": b_item.get("name") or b_item.get("title") or "Bottom",
                "clean_image_url": b_clean_img,
                "image_url": b_clean_img,
                "thumbnail_data_url": b_item.get("thumbnail_data_url") or b_clean_img,
            })
            logger.info("Hydrated missing bottom %s into proposal", b_item["id"])
            has_bottom = True
        else:
            missing_notes.append("pants/shorts")

    # Hydrate Shoes if missing
    if not has_shoes:
        available_shoes = [c for c in closet_by_role.get("shoes", []) if c["id"] not in seen_ids]
        if available_shoes:
            sh_item = available_shoes[0]
            seen_ids.add(sh_item["id"])
            sh_clean_img = (
                sh_item.get("clean_image_url")
                or sh_item.get("reconstructed_image_url")
                or sh_item.get("cutout_url")
                or sh_item.get("thumbnail_data_url")
                or sh_item.get("image_url")
            )
            sanitized_items.append({
                "id": sh_item["id"],
                "closet_item_id": sh_item["id"],
                "role": "shoes",
                "category": sh_item.get("category") or "Footwear",
                "sub_category": sh_item.get("sub_category") or sh_item.get("item_type") or "",
                "description": sh_item.get("title") or sh_item.get("name") or "Shoes",
                "title": sh_item.get("title") or sh_item.get("name") or "Shoes",
                "name": sh_item.get("name") or sh_item.get("title") or "Shoes",
                "clean_image_url": sh_clean_img,
                "image_url": sh_clean_img,
                "thumbnail_data_url": sh_item.get("thumbnail_data_url") or sh_clean_img,
            })
            logger.info("Hydrated missing shoes %s into proposal", sh_item["id"])
            has_shoes = True
        else:
            missing_notes.append("shoes")

    # 3. CRITICAL: Strict Anatomical Layer Sort Order
    # Top/Dress (1) -> Outerwear (2) -> Bottom (3) -> Shoes/Footwear (4) -> Accessories (5+)
    ROLE_SORT_ORDER = {
        "top": 1,
        "dress": 1,
        "outerwear": 2,
        "bottom": 3,
        "shoes": 4,
        "footwear": 4,
        "belt": 5,
        "headwear": 6,
        "glasses": 7,
        "bag": 8,
        "accessory": 9,
    }
    sanitized_items.sort(key=lambda it: ROLE_SORT_ORDER.get(it.get("role", ""), 99))

    prop["items"] = sanitized_items

    if missing_notes:
        note_str = f"Note: Please add {' and '.join(missing_notes)} to your closet for a complete outfit suggestion."
        why = prop.get("why") or ""
        if note_str not in why:
            prop["why"] = (why + f" {note_str}").strip()


def _get_scheduler_stylist_service(user: dict[str, Any]):
    api_key_resolved = None
    ai_config = user.get("ai_configuration") or {}
    provider_mode = ai_config.get("provider_mode", "standard")
    if provider_mode in ["standard", "custom_keys"]:
        encrypted_key = (ai_config.get("custom_keys") or {}).get("google_ai")
        if encrypted_key:
            from app.services.auth import decrypt_api_key
            api_key_resolved = decrypt_api_key(encrypted_key)

    from app.services.gemini_stylist import GeminiStylistService, gemini_stylist_service
    if api_key_resolved:
        return GeminiStylistService(api_key=api_key_resolved)
    if gemini_stylist_service is not None:
        return gemini_stylist_service
    raise RuntimeError("No Gemini API key configured for stylist service")

async def generate_scheduled_proposals(
    user: dict[str, Any],
    style_dress_for: str | None = None,
    weather: dict[str, Any] | None = None,
    calendar_events: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    """Generate 3 scheduled outfit proposals using the rotation prioritized items."""
    user = dict(user)
    user.pop("_id", None)
    user_id = user["id"]

    # If weather is not provided, try to fetch it first so we can use it to filter the candidate closet
    if weather is None:
        try:
            from app.services.weather_service import weather_service
            home = user.get("home_location") or {}
            lat = home.get("lat")
            lng = home.get("lng")
            lang = user.get("preferred_language") or "en"
            if lat is not None and lng is not None and weather_service is not None:
                weather = await weather_service.fetch(float(lat), float(lng), lang=lang)
        except Exception as w_exc:
            logger.warning("Failed to fetch weather inside scheduler brain for user %s: %s", user_id, w_exc)

    # Fetch closet items prioritized by tag restriction and weather/season matching
    raw_closet = await get_rotation_prioritized_closet(
        user_id,
        limit=40,
        style_dress_for=style_dress_for,
        weather=weather
    )
    
    # Slim down closet items to prevent sending massive base64 image strings and embeddings to the LLM
    # Slim down closet items to prevent sending massive base64 image strings and embeddings to the LLM
    prioritized_closet = [
        {
            "id": item["id"],
            "title": item.get("title") or item.get("name") or "Garment",
            "category": item.get("category"),
            "sub_category": item.get("sub_category"),
            "color": item.get("color"),
            "brand": item.get("brand"),
            "pattern": item.get("pattern"),
            "material": item.get("material"),
            "dress_code": item.get("dress_code"),
            "season": item.get("season"),
            "tags": item.get("tags") or [],
        }
        for item in raw_closet
    ]
    
    # We will query Gemini with customized rotation options
    closet_summary_str = "\n".join(
        f"- ID: {item['id']} | Title: {item.get('title')} | Category: {item.get('category')} | Tags: {item.get('tags')} | Color: {item.get('color')} | Brand: {item.get('brand')}"
        for item in prioritized_closet
    )

    # Determine target day and date for the outfit selection
    user_timezone = (user.get("scheduler_settings") or {}).get("timezone") or "UTC"
    try:
        from zoneinfo import ZoneInfo
        local_now = datetime.now(timezone.utc).astimezone(ZoneInfo(user_timezone))
    except Exception:
        local_now = datetime.now(timezone.utc)
    is_next_day = local_now.hour >= 12
    target_date = local_now + timedelta(days=1) if is_next_day else local_now
    target_day_name = target_date.strftime("%A")
    target_date_str = target_date.strftime("%Y-%m-%d")

    style_prompt = style_dress_for or "casual/daily dress"
    
    weather_info = ""
    if weather:
        temp = weather.get("temp_c")
        cond = weather.get("condition") or weather.get("description")
        weather_info = f"Weather forecast for {target_day_name}: {temp}°C, {cond}." if temp is not None else f"Weather condition: {cond}."

    calendar_info = ""
    if calendar_events:
        event_titles = [f"'{e.get('summary') or e.get('title') or 'Event'}'" for e in calendar_events if (e.get('summary') or e.get('title'))]
        if event_titles:
            calendar_info = f"Scheduled calendar events for {target_day_name}: {', '.join(event_titles)}."

    weather_line = f"- {weather_info}\n" if weather_info else ""
    calendar_line = f"- {calendar_info}\n" if calendar_info else ""

    prompt = (
        f"PERSONA & EXPERTISE:\n"
        f"You are a senior fashion stylist and dresser with 30 years of experience in multi-nationality and cultural fashion and trends. "
        f"You have deep fashion knowledge, and rules like color matching, material matching, body fitting, pattern matching, and cultural and religious restrictions are natural to you; "
        f"you constantly keep up with current local fashion and social trends. Your ability to tailor a perfect outfit for an event and weather from the customer's own garments, "
        f"following the customer's restrictions and orders, is well known and admired.\n\n"
        f"GOAL:\n"
        f"Generate EXACTLY 3 complete, distinct, and coordinated full-body outfit recommendations for {target_day_name} ({target_date_str}) from the user's Closet items below, "
        f"following Fashion and Social Rules and Restrictions.\n\n"
        f"CONTEXT & APPLIED FILTERS:\n"
        f"- Target Occasion / Style Preference: '{style_prompt}'\n"
        f"{weather_line}"
        f"{calendar_line}\n"
        f"STRICT STYLING RULES & RESTRICTIONS:\n"
        f"1. FASHION & SOCIAL/RELIGIOUS RESTRICTIONS:\n"
        f"   - Always follow timeless fashion harmony rules (color theory, texture/material pairing, proportional silhouette, pattern clash prevention) and respect any local social, modest, or religious restrictions.\n"
        f"2. APPLIED TAG FILTERS & PREFERENCES:\n"
        f"   - If the closet items list below contains garments with the tag '{style_prompt}' (case-insensitive), prioritize selecting those items. Only when no matching tags are found or to complete the outfit (e.g. if there are no shoes with that tag), select other items matching the intent/style of the preference.\n"
        f"3. ROTATION & DIVERSITY (NO REPEATS ACROSS OUTFITS):\n"
        f"   - Rotate items within categories: make every item count and get used.\n"
        f"   - The 3 generated outfits MUST be 3 DISTINCT, UNIQUE looks with NO DUPLICATE TOPS, NO DUPLICATE BOTTOMS, and NO DUPLICATE SHOES across the 3 recommendations whenever multiple options are available in the closet.\n"
        f"   - Do NOT repeat the same shirt, pants, or shoes across Outfit 1, 2, and 3!\n"
        f"4. NEVER MIX CATEGORIES (STRICT ANATOMICAL ROLES):\n"
        f"   - A garment's 'role' MUST strictly match its anatomical category:\n"
        f"     • Category 'Top' / 'Tops' / 'Shirts' MUST have role: 'top'.\n"
        f"     • Category 'Bottom' / 'Bottoms' / 'Pants' / 'Jeans' / 'Shorts' / 'Skirts' MUST have role: 'bottom'.\n"
        f"     • Category 'Footwear' / 'Shoes' / 'Sneakers' / 'Boots' / 'Sandals' MUST have role: 'shoes'. NEVER label shoes or footwear as a 'top' or 'bottom'!\n"
        f"     • Category 'Outerwear' / 'Jackets' / 'Coats' / 'Blazers' MUST have role: 'outerwear'.\n"
        f"     • Category 'Dress' / 'One-piece' MUST have role: 'dress'.\n"
        f"     • Category 'Accessories' / 'Bags' / 'Belts' / 'Hats' MUST have role: 'accessory'.\n"
        f"   - Never duplicate singleton anatomical roles (e.g. do not put two bottoms or two pairs of shoes in the same outfit).\n"
        f"5. WEATHER AWARE:\n"
        f"   - Outfits must be perfectly suited to the forecast temperature and conditions. NEVER suggest shorts for rainy/cold weather, and NEVER suggest a heavy wool sweater or warm coat for a hot summer day. Match fabrics (e.g. breathable linen/cotton for warm weather, insulated wool/layering for cold).\n"
        f"6. CALENDAR AWARE:\n"
        f"   - When calendar events are scheduled for the day, tailor the outfits to appropriately suit those event descriptions (e.g., formal/business for meetings, smart-casual for lunches, functional for active/outdoor events).\n"
        f"7. COMPLETE FULL-BODY OUTFIT (MANDATORY TOP + BOTTOM + SHOES):\n"
        f"   - Every outfit recommendation MUST be a COMPLETE full-body outfit consisting of: 1) Either (a 'top' AND a 'bottom') OR a 'dress', and 2) 'shoes' (footwear). Add outerwear and accessories to complete the look.\n"
        f"   - Shoes/footwear are MANDATORY for every single outfit recommendation.\n"
        f"   - List items inside the 'items' array strictly in top-to-bottom anatomical order:\n"
        f"     1st: 'top' (or 'dress')\n"
        f"     2nd: 'outerwear' (if layered)\n"
        f"     3rd: 'bottom' (if wearing a top)\n"
        f"     4th: 'shoes' (footwear)\n"
        f"     5th: 'accessory' (if any)\n"
        f"8. APPROPRIATE ACCESSORIES (NO FASHION CLASH):\n"
        f"   - ONLY add an accessory if it harmonizes with the dress code and clothing items.\n"
        f"   - NEVER pair a formal necktie or bowtie with a casual graphic T-shirt, tank top, sportswear, shorts, or swim trunks! Formal ties belong ONLY with formal collared dress shirts, blazers, and suits.\n"
        f"9. STRICT CLOSET INVENTORY CONSTRAINT:\n"
        f"   - You MUST select items ONLY from the user's closet list below. Under no circumstances should you recommend items that the user does not own or that have a null closet_item_id. Every recommended item must map to a valid closet item ID from the list below.\n\n"
        f"User's Closet Items:\n"
        f"{closet_summary_str}\n\n"
        f"Output MUST be in JSON matching this TypeScript type:\n"
        f"{{\n"
        f"  \"reasoning_summary\": string,\n"
        f"  \"outfit_recommendations\": Array<{{\n"
        f"    \"name\": string, // 3-6 words. Generates a highly descriptive, appealing, and creative style title (e.g., 'Casual Blue & White Summer Hangout', 'Classic Charcoal Streetwear', 'Sporty Emerald Workout') describing the vibe, season, and color combination. Avoid generic titles like 'The Look' or 'Outfit 1'.\n"
        f"    \"items\": Array<{{\n"
        f"      \"role\": \"top\"|\"bottom\"|\"outerwear\"|\"shoes\"|\"accessory\"|\"dress\",\n"
        f"      \"description\": string, // Use the item's title/description from the list.\n"
        f"      \"closet_item_id\": string // MUST be a valid ID from the closet list above. Cannot be null.\n"
        f"    }}>,\n"
        f"    \"why\": string,\n"
        f"    \"confidence\": number\n"
        f"  }}>\n"
        f"}}"
    )

    from app.services.user_preferences import render_user_preferences
    prefs_block, _ = render_user_preferences(user)

    # Trigger Gemini Stylist with resolved API key
    svc = _get_scheduler_stylist_service(user)
    res_json = await svc.advise(
        session_id=f"scheduled-scheduler-{uuid.uuid4().hex[:8]}",
        user_text=prompt,
        image_base64=None,
        weather=weather,
        calendar_events=calendar_events,
        user_profile=user,
        closet_summary=prioritized_closet,
        user_preferences_block=prefs_block,
    )

    # Extract proposals
    proposals = res_json.get("outfit_recommendations") or []
    
    # Resolve any truncated IDs returned by the LLM back to the full UUIDs in raw_closet
    valid_ids = {x["id"] for x in raw_closet}
    for prop in proposals:
        for item in prop.get("items", []):
            cid = item.get("closet_item_id")
            if cid and len(cid) < 36:
                match = next((x["id"] for x in raw_closet if x["id"].startswith(cid)), None)
                if match:
                    item["closet_item_id"] = match
                    logger.info("Resolved truncated ID %s to full UUID %s", cid, match)
            
            # Validate that the item matches an actual item in the closet list
            if not item.get("closet_item_id") or item["closet_item_id"] not in valid_ids:
                desc = (item.get("description") or item.get("title") or "").lower().strip()
                role = norm_category(item.get("role") or item.get("category"))
                if role in ("footwear", "shoes"):
                    role = "shoes"
                found_match = None
                if desc:
                    found_match = next((x for x in raw_closet if x.get("title", "").lower() in desc or desc in x.get("title", "").lower()), None)
                if not found_match and role:
                    found_match = next((x for x in raw_closet if norm_category(x.get("category")) == role), None)
                if found_match:
                    item["closet_item_id"] = found_match["id"]
                    logger.info("Recovered unmapped LLM item '%s' to closet item %s (%s)", desc, found_match["id"], found_match.get("title"))
                else:
                    logger.warning("Dropping unmapped LLM item not in closet list: %s", item)
                    item["closet_item_id"] = None
        
        # Guarantee complete outfit (Top + Bottom + Shoes or Dress + Shoes)
        _ensure_complete_outfit(prop, raw_closet)
    
    # Track suggested items to update last_suggested_at
    suggested_ids = []
    for prop in proposals:
        for item in prop.get("items", []):
            cid = item.get("closet_item_id")
            if cid:
                suggested_ids.append(cid)
    await update_suggested_timestamps(suggested_ids)

    return res_json


async def generate_event_proposals(
    user: dict[str, Any],
    event_prompt: str,
    location: str | None = None,
    event_name: str | None = None
) -> dict[str, Any]:
    """Generate 3 outfit proposals for a special event, incorporating marketplace search if closet matches are poor."""
    user = dict(user)
    user.pop("_id", None)
    user_id = user["id"]
    prioritized_closet = await get_rotation_prioritized_closet(user_id, limit=40, style_dress_for=event_prompt)
    
    # 1. Search marketplace listings in parallel to broaden results
    mkt_suggestions = []
    try:
        mkt_suggestions = await suggest_for_query(
            user=user,
            query=event_prompt,
            categories=["top", "bottom", "dress", "outerwear", "shoes"],
            per_category=2
        )
    except Exception as exc:
        logger.warning("Event marketplace pre-search failed: %s", exc)

    closet_summary_str = "\n".join(
        f"- ID: {item['id']} | Title: {item.get('title')} | Category: {item.get('category')} | Color: {item.get('color')} | Brand: {item.get('brand')} | Formality: {item.get('formality')}"
        for item in prioritized_closet
    )

    mkt_summary_str = ""
    if mkt_suggestions:
        mkt_summary_str = "\n".join(
            f"- Marketplace Item ID: {m['listing_id']} | Title: {m.get('title')} | Price: {m.get('price_cents')} cents | Fits: {m.get('fills_slot')}"
            for m in mkt_suggestions
        )

    prompt = (
        f"You are the Lead Fashion AI Stylist for DressApp.\n"
        f"Generate EXACTLY 3 distinct, complete, and coordinated outfit recommendations for this special event: \"{event_prompt}\".\n\n"
        f"CRITICAL STYLING & ROTATION RULES:\n"
        f"1. OCCASION & STYLE HARMONY:\n"
        f"   - Match the tone and dress code of the event. For elegant/smart-casual/dinner/party events, choose sophisticated, polished items (collared shirts, polos, blazers, chinos, trousers, smart shoes). NEVER choose gym tank tops, swim trunks, running shorts, or beach flip-flops for smart-casual/dinner events!\n"
        f"2. ROTATION & DIVERSITY (NO REPEATS ACROSS OUTFITS):\n"
        f"   - The 3 recommendations MUST be 3 DISTINCT looks with DIFFERENT tops, DIFFERENT bottoms, and DIFFERENT shoes across Outfit 1, 2, and 3 whenever multiple options are available in the closet.\n"
        f"   - Do NOT repeat the exact same shirt or shoes across all 3 outfits!\n"
        f"3. A garment's 'role' MUST strictly match its anatomical category:\n"
        f"   - Category 'Top' / 'Tops' / 'Shirts' MUST have role: 'top'.\n"
        f"   - Category 'Bottom' / 'Bottoms' / 'Pants' / 'Jeans' / 'Shorts' / 'Skirts' MUST have role: 'bottom'.\n"
        f"   - Category 'Footwear' / 'Shoes' / 'Sneakers' / 'Boots' / 'Sandals' MUST have role: 'shoes'. NEVER label shoes as a top or bottom!\n"
        f"   - Category 'Outerwear' / 'Jackets' / 'Coats' / 'Blazers' MUST have role: 'outerwear'.\n"
        f"   - Category 'Dress' / 'One-piece' MUST have role: 'dress'.\n"
        f"   - Category 'Accessories' / 'Bags' / 'Belts' / 'Hats' MUST have role: 'accessory'.\n\n"
        f"4. COMPLETE OUTFIT & ANATOMICAL ORDERING:\n"
        f"   - Every outfit must have: top (or dress), bottom (if top), and shoes (footwear).\n"
        f"   - List items strictly top-to-bottom: 'top' (or 'dress'), 'outerwear', 'bottom', 'shoes', 'accessory'.\n\n"
        f"User's Closet Items:\n{closet_summary_str}\n\n"
        f"Available Marketplace Items to purchase (use if closet matches are poor or missing):\n{mkt_summary_str}\n\n"
        f"Rules:\n"
        f"1. Be honest and real. If the closet is missing good matches based on the event demands, suggest the closest closet option "
        f"BUT recommend purchasing a missing piece. If utilizing a marketplace item, set `closet_item_id = null` and describe the garment in `description`.\n"
        f"2. Add explicit shopping recommendations in `shopping_suggestions` detailing what to buy to complete the outfit.\n"
        f"3. Output MUST be in JSON matching this TypeScript type:\n"
        f"{{\n"
        f"  \"reasoning_summary\": string,\n"
        f"  \"outfit_recommendations\": Array<{{\n"
        f"    \"name\": string, // 3-6 words. Generates a highly descriptive, appealing, and creative style title (e.g., 'Casual Blue & White Summer Hangout', 'Classic Charcoal Streetwear', 'Sporty Emerald Workout') describing the vibe, season, and color combination. Avoid generic titles like 'The Look' or 'Outfit 1'.\n"
        f"    \"items\": Array<{{\n"
        f"      \"role\": \"top\"|\"bottom\"|\"outerwear\"|\"shoes\"|\"accessory\"|\"dress\",\n"
        f"      \"description\": string,\n"
        f"      \"closet_item_id\": string | null\n"
        f"    }}>,\n"
        f"    \"why\": string,\n"
        f"    \"confidence\": number\n"
        f"  }}>\n"
        f"  \"shopping_suggestions\": Array<string>\n"
        f"}}"
    )

    from app.services.user_preferences import render_user_preferences
    prefs_block, _ = render_user_preferences(user)

    try:
        svc = _get_scheduler_stylist_service(user)
        res_json = await svc.advise(
            session_id=f"event-scheduler-{uuid.uuid4().hex[:8]}",
            user_text=prompt,
            image_base64=None,
            user_profile=user,
            closet_summary=prioritized_closet,
            user_preferences_block=prefs_block,
        )
    except Exception as exc:
        logger.warning("Event proposals AI generation failed (%s), using deterministic fallback", exc)
        from app.services.scheduler import _generate_fallback_advice
        res_json = _generate_fallback_advice(prioritized_closet, style_dress_for=event_prompt)

    proposals = res_json.get("outfit_recommendations") or []
    for prop in proposals:
        _ensure_complete_outfit(prop, prioritized_closet)
    
    # 2. Check similar event similarities and location warnings
    try:
        await check_event_similarities(user_id, proposals, location, event_name or event_prompt)
    except Exception as sim_exc:
        logger.warning("Check event similarities failed: %s", sim_exc)

    # 3. Update suggested timestamps
    suggested_ids = []
    for prop in proposals:
        for item in prop.get("items", []):
            cid = item.get("closet_item_id")
            if cid:
                suggested_ids.append(cid)
    await update_suggested_timestamps(suggested_ids)

    # Map marketplace items if any matched
    res_json["marketplace_matches"] = mkt_suggestions
    return res_json


async def reject_garment(user_id: str, garment_id: str) -> dict[str, Any]:
    """Record a rejection for a garment.

    Increments the rejection count of a closet item. If it reaches 3,
    toggles the offer to list it on the marketplace.
    """
    db = get_db()
    item = await db.closet_items.find_one({"id": garment_id, "user_id": user_id})
    if not item:
        raise ValueError("Garment not found")

    new_count = (item.get("rejection_count") or 0) + 1
    await db.closet_items.update_one(
        {"id": garment_id, "user_id": user_id},
        {"$set": {"rejection_count": new_count}}
    )

    return {
        "item_id": garment_id,
        "title": item.get("title") or "Garment",
        "rejection_count": new_count,
        "offer_marketplace": new_count >= 3
    }
