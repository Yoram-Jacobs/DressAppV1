"""AI Stylist Scheduler Brain Service (Phase Scheduler)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db
from app.services.gemini_stylist import gemini_stylist_service
from app.services.marketplace_search import suggest_for_query
from app.services import repos

logger = logging.getLogger(__name__)


async def get_rotation_prioritized_closet(user_id: str, limit: int = 40) -> list[dict[str, Any]]:
    """Fetch closet items prioritized for rotation.

    Filters out duplicates (`is_duplicate=True`) and sorts items:
    1. Items never suggested or suggested longest ago (`last_suggested_at` is null, then ascending).
    2. Items never worn or worn longest ago (`last_worn_at` is null, then ascending).
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

    # Define sort key
    def sort_key(item: dict[str, Any]) -> tuple:
        last_sug = item.get("last_suggested_at") or ""
        last_worn = item.get("last_worn_at") or ""
        wear_count = item.get("wear_count") or 0
        
        # We want empty dates to sort FIRST (since they are never worn / never suggested)
        sug_val = last_sug if last_sug else "0000-00-00"
        worn_val = last_worn if last_worn else "0000-00-00"
        
        return (sug_val, worn_val, wear_count)

    items.sort(key=sort_key)
    return items[:limit]


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
                    break


async def generate_scheduled_proposals(
    user: dict[str, Any],
    style_dress_for: str | None = None
) -> dict[str, Any]:
    """Generate 3 scheduled outfit proposals using the rotation prioritized items."""
    user_id = user["id"]
    prioritized_closet = await get_rotation_prioritized_closet(user_id, limit=40)
    
    # We will query Gemini with customized rotation options
    closet_summary_str = "\n".join(
        f"- ID: {item['id']} | Title: {item.get('title')} | Category: {item.get('category')} | Color: {item.get('color')} | Brand: {item.get('brand')}"
        for item in prioritized_closet
    )

    style_prompt = style_dress_for or "casual/daily dress"
    
    prompt = (
        f"Generate EXACTLY 3 different outfit recommendations for tomorrow. "
        f"The user's preset preference is: {style_prompt}.\n\n"
        f"You MUST prioritize selecting from these rotation-friendly closet items first to ensure the user rotates their wardrobe:\n"
        f"{closet_summary_str}\n\n"
        f"Output MUST be in JSON matching this TypeScript type:\n"
        f"{{\n"
        f"  \"reasoning_summary\": string,\n"
        f"  \"outfit_recommendations\": Array<{{\n"
        f"    \"name\": string,\n"
        f"    \"items\": Array<{{\n"
        f"      \"role\": \"top\"|\"bottom\"|\"outerwear\"|\"shoes\"|\"accessory\"|\"dress\",\n"
        f"      \"description\": string,\n"
        f"      \"closet_item_id\": string | null\n"
        f"    }}>\n,"
        f"    \"why\": string,\n"
        f"    \"confidence\": number\n"
        f"  }}>\n"
        f"}}"
    )

    from app.services.user_preferences import render_user_preferences
    prefs_block, _ = render_user_preferences(user)

    # Trigger Gemini Stylist
    res_json = await gemini_stylist_service.advise(
        session_id=f"scheduled-scheduler-{uuid.uuid4().hex[:8]}",
        user_text=prompt,
        image_base64=None,
        user_profile=user,
        closet_summary=prioritized_closet,
        user_preferences_block=prefs_block,
    )

    # Extract proposals
    proposals = res_json.get("outfit_recommendations") or []
    
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
        f"    \"name\": string,\n"
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

    res_json = await gemini_stylist_service.advise(
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
