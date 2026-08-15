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

def matches_style_func(item: dict, style_dress_for: str | None, has_exact_tag_match: bool = False) -> bool:
    if not style_dress_for:
        return True
    
    style_dress_for_clean = style_dress_for.strip().lower()
    if style_dress_for_clean == "casual":
        return True
        
    tags = [t.lower() for t in (item.get("tags") or [])]
    custom_tags = [t.lower() for t in (item.get("custom_tags") or [])]
    
    # First priority: exact case-insensitive tag match
    if style_dress_for_clean in tags or style_dress_for_clean in custom_tags:
        return True
        
    # If there is at least one exact tag match in the closet, and this item isn't it,
    # then this item does NOT match (exact tag match is required when available).
    if has_exact_tag_match:
        return False
        
    # Only when no items in the entire closet have an exact tag match, understand demand meaning/intent (fallback)
    dress_code = str(item.get("dress_code") or "").lower()
    title = str(item.get("title") or item.get("name") or "").lower()
    
    syns = SYNONYMS.get(style_dress_for_clean, [style_dress_for_clean])
    
    for s in syns:
        if s in tags or s in custom_tags:
            return True
        if s in dress_code or dress_code in s:
            return True
        if s in title:
            return True
            
    if any(style_dress_for_clean in t for t in tags):
        return True
    if any(style_dress_for_clean in t for t in custom_tags):
        return True
    if style_dress_for_clean in dress_code:
        return True
    if style_dress_for_clean in title:
        return True
        
    return False

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

    def norm_category(cat: Any) -> str:
        s = str(cat or "").strip().lower().replace(" ", "_")
        if s in ("top", "tops", "shirt", "t-shirt", "t_shirt", "polo", "sweater", "blouse"):
            return "top"
        if s in ("bottom", "bottoms", "pants", "shorts", "jeans", "skirt", "trousers"):
            return "bottom"
        if s in ("footwear", "shoes", "sneakers", "boots", "sandals", "shoe"):
            return "footwear"
        if s in ("dress", "dresses", "jumpsuit", "suit", "full_body", "full_body_suit"):
            return "dress"
        if s in ("outerwear", "jacket", "coat"):
            return "outerwear"
        return "accessory"

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
        matches_style = matches_style_func(item, style_dress_for, has_exact_tag_match)
        matches_season = matches_season_func(item, target_season)
        
        last_sug = item.get("last_suggested_at") or ""
        last_worn = item.get("last_worn_at") or ""
        wear_count = item.get("wear_count") or 0
        
        sug_val = last_sug if last_sug else "0000-00-00"
        worn_val = last_worn if last_worn else "0000-00-00"
        
        # Sort True (1) before False (0), so we negate the boolean int
        style_and_season_score = -1 if (matches_style and matches_season) else 0
        style_score = -1 if matches_style else 0
        season_score = -1 if matches_season else 0
        
        return (style_and_season_score, style_score, season_score, sug_val, worn_val, wear_count)

    # Partition items into category buckets
    buckets: dict[str, list[dict[str, Any]]] = {
        "top": [],
        "bottom": [],
        "footwear": [],
        "dress": [],
        "outerwear": [],
        "accessory": [],
    }

    for item in items:
        cat_key = norm_category(item.get("category"))
        buckets[cat_key].append(item)

    # Sort each bucket by rotation key
    for cat_key in buckets:
        buckets[cat_key].sort(key=sort_key)

    # Target distribution ratios for a balanced candidate pool
    target_ratios = {
        "top": 0.35,
        "bottom": 0.35,
        "footwear": 0.15,
        "dress": 0.05,
        "outerwear": 0.05,
        "accessory": 0.05,
    }

    quotas = {cat: max(1, int(limit * ratio)) for cat, ratio in target_ratios.items()}

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
        for cat_key in ["top", "bottom", "footwear", "dress", "outerwear", "accessory"]:
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
    """Ensure proposal contains top/dress, bottom, and shoes if available in closet."""
    items = prop.get("items") or []
    roles = {str(i.get("role")).lower() for i in items}
    
    def norm_cat(cat):
        s = str(cat or "").strip().lower().replace(" ", "_")
        if s in ("top", "tops", "shirt", "t-shirt", "t_shirt", "polo", "sweater", "blouse"): return "top"
        if s in ("bottom", "bottoms", "pants", "shorts", "jeans", "skirt", "trousers"): return "bottom"
        if s in ("footwear", "shoes", "sneakers", "boots", "sandals", "shoe"): return "shoes"
        if s in ("dress", "dresses", "jumpsuit", "suit", "full_body", "full_body_suit"): return "dress"
        return s

    has_dress = "dress" in roles
    has_bottom = "bottom" in roles or has_dress
    has_shoes = "shoes" in roles

    closet_by_role = {}
    for c_item in raw_closet:
        role = norm_cat(c_item.get("category"))
        if role not in closet_by_role:
            closet_by_role[role] = []
        closet_by_role[role].append(c_item)

    missing_notes = []

    # Hydrate bottom if missing and available
    if not has_bottom:
        bottoms = closet_by_role.get("bottom") or []
        if bottoms:
            b = bottoms[0]
            items.append({
                "role": "bottom",
                "description": b.get("title") or b.get("name") or "Bottoms",
                "closet_item_id": b["id"]
            })
            logger.info("Hydrated missing bottom %s into proposal", b["id"])
        else:
            missing_notes.append("pants/shorts")

    # Hydrate shoes if missing and available
    if not has_shoes:
        shoes_list = closet_by_role.get("shoes") or []
        if shoes_list:
            sh = shoes_list[0]
            items.append({
                "role": "shoes",
                "description": sh.get("title") or sh.get("name") or "Shoes",
                "closet_item_id": sh["id"]
            })
            logger.info("Hydrated missing shoes %s into proposal", sh["id"])
        else:
            missing_notes.append("shoes")

    prop["items"] = items

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
    
    prompt = (
        f"Generate EXACTLY 3 different outfit recommendations for {target_day_name} ({target_date_str}). "
        f"The user's preset preference is: {style_prompt}.\n\n"
        f"CRITICAL TAG PREFERENCE: If the closet items list below contains garments with the tag '{style_prompt}' (case-insensitive), you MUST prioritize selecting those items for the outfits. Only when no matching tags are found or to complete the outfit (e.g. if there are no shoes with that tag), you may select other items matching the intent/style of the preference.\n\n"
        f"CRITICAL REQUIREMENT: Every outfit recommendation MUST be a COMPLETE outfit consisting of: 1) Either (a 'top' AND a 'bottom') OR a 'dress', and 2) 'shoes' (footwear). NEVER recommend an outfit consisting of only a single T-shirt, top, or bottom without shoes and pants, unless the closet literally lacks those categories.\n\n"
        f"You MUST select items ONLY from the user's closet list below. Under no circumstances should you recommend items that the user does not own or that have a null closet_item_id. Every recommended item must map to a valid closet item ID from the list below.\n\n"
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
        f"    }}>\n,"
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
                raise ValueError(f"LLM suggested item not in closet list: {item}")
        
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
    prioritized_closet = await get_rotation_prioritized_closet(user_id, limit=40)
    
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
        f"Generate EXACTLY 3 different outfit recommendations for this special event prompt: \"{event_prompt}\".\n\n"
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
        f"    }}>\n,"
        f"    \"why\": string,\n"
        f"    \"confidence\": number\n"
        f"  }}>\n"
        f"  \"shopping_suggestions\": Array<string>\n"
        f"}}"
    )

    from app.services.user_preferences import render_user_preferences
    prefs_block, _ = render_user_preferences(user)

    svc = _get_scheduler_stylist_service(user)
    res_json = await svc.advise(
        session_id=f"event-scheduler-{uuid.uuid4().hex[:8]}",
        user_text=prompt,
        image_base64=None,
        user_profile=user,
        closet_summary=prioritized_closet,
        user_preferences_block=prefs_block,
    )

    proposals = res_json.get("outfit_recommendations") or []
    
    # 2. Check similar event similarities and location warnings
    await check_event_similarities(user_id, proposals, location, event_name or event_prompt)

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
