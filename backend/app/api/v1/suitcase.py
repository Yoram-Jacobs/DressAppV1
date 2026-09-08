"""DressApp Suitcase API Routes — Traveling AI solution."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
import json
import logging
import os
import uuid
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.schemas import ClosetItem, Suitcase, SuitcaseArchive
from app.services.auth import get_current_user
from app.services.gemini_client import GeminiClient
from app.services.weather_service import weather_service
from app.services.calendar_service import calendar_service
from app.services.push_service import send_push_notification
from app.services.marketplace_search import suggest_for_gaps
from app.services import repos

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/suitcase", tags=["suitcase"])

KNOWLEDGE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "services",
    "travel_safety_knowledge.md"
)


def get_safety_knowledge() -> str:
    try:
        if os.path.exists(KNOWLEDGE_PATH):
            with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
                return f.read()
    except Exception as e:
        logger.error("Failed to read safety knowledge file: %s", e)
    return ""


def find_closet_match(item: dict, closet_items: list[dict]) -> dict | None:
    if not item or not closet_items:
        return None
    # 1. Try matching by ID first
    cid = item.get("closet_item_id") or item.get("id")
    if cid:
        match = next((i for i in closet_items if i.get("id") == cid), None)
        if match:
            return match
    # 2. Fallback: Try matching by description/title/name
    desc = (item.get("description") or item.get("title") or "").lower().strip()
    if desc:
        for i in closet_items:
            title = (i.get("title") or "").lower().strip()
            name = (i.get("name") or "").lower().strip()
            if (title and (title in desc or desc in title)) or (name and (name in desc or desc in name)):
                return i
    return None


class SuitcasePackIn(BaseModel):
    destinations: str
    purpose: str
    preferred_style: str
    departure_time: str  # ISO8601
    return_time: str     # ISO8601
    notes: str | None = None
    current_outfits: list[dict[str, Any]] | None = None
    current_packing_list: list[dict[str, Any]] | None = None


class SuitcaseApproveIn(BaseModel):
    destinations: str
    purpose: str
    preferred_style: str
    departure_time: str
    return_time: str
    notes: str | None = None
    outfits: list[dict[str, Any]]
    packing_list: list[dict[str, Any]]
    missing_notes: str | None = None
    local_fashion_stores: list[dict[str, Any]] | None = None
    missing_items: list[dict[str, Any]] | None = None


class PackStatusIn(BaseModel):
    packed_ids: list[str]
    unpacked_ids: list[str]


class AddSuitcaseItemIn(BaseModel):
    title: str
    category: str
    color: str | None = None
    brand: str | None = None
    price_cents: int | None = None
    currency: str = "USD"
    notes: str | None = None
    size: str | None = None


class EnterLocationIn(BaseModel):
    location: str


class SuitcaseChatIn(BaseModel):
    destinations: str | None = None
    purpose: str | None = None
    preferred_style: str | None = None
    departure_time: str | None = None
    return_time: str | None = None
    notes: str | None = None
    message: str


def strip_base64_images(val: Any) -> Any:
    if isinstance(val, dict):
        keys_to_remove = {
            "thumbnail_data_url",
            "reconstructed_image_url",
            "clean_image_url",
            "segmented_image_url",
            "original_image_url"
        }
        return {k: strip_base64_images(v) for k, v in val.items() if k not in keys_to_remove}
    elif isinstance(val, list):
        return [strip_base64_images(item) for item in val]
    return val



async def generate_text(
    *,
    user_text: str,
    system: str | None = None,
    response_mime_type: str | None = None,
    response_schema: dict[str, Any] | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
    api_key: str | None = None,
    model: str = "gemini-3.5-flash",
) -> str:
    from app.services import eyes_override
    from app.services.vision.llm import _call_gemma_space
    from app.config import settings

    provider = (await eyes_override.get_active_provider()).lower()
    if provider == "gemma" and settings.EYES_GEMMA_SPACE_URL:
        try:
            logger.info("Routing text request to Gemma Space")
            return await _call_gemma_space(
                system_prompt=system or "",
                user_text=user_text,
                image_b64_jpeg="",
                max_tokens=max_tokens or 2048,
                temperature=temperature or 0.1,
                json_schema=response_schema,
            )
        except Exception as exc:
            logger.warning("Gemma Space call failed; falling back to Gemini. Error: %s", exc)

    logger.info("Routing text request to Gemini Client (model=%s)", model)
    client = GeminiClient(api_key=api_key)
    return await client.text(
        user_text=user_text,
        system=system,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_mime_type=response_mime_type,
        response_schema=response_schema,
    )


# ─── endpoints ──────────────────────────────────────────────

@router.post("/chat")
async def suitcase_chat(
    body: SuitcaseChatIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    events = []
    if body.departure_time and body.return_time:
        try:
            dep_dt = datetime.fromisoformat(body.departure_time.replace("Z", "+00:00"))
            ret_dt = datetime.fromisoformat(body.return_time.replace("Z", "+00:00"))
            duration_hours = int((ret_dt - dep_dt).total_seconds() / 3600)
            from app.services.calendar_service import calendar_service
            events = await calendar_service.get_events_for_user(
                user,
                hours_ahead=max(24, duration_hours),
                time_min=dep_dt,
                time_max=ret_dt
            )
        except Exception as e:
            logger.warning("Failed to retrieve calendar events in chat: %s", e)

    prompt = (
        "You are DressApp's Suitcase Chat Assistant. The user is planning a trip and gathering details.\n"
        "Your task is to analyze the user's message, extract updates to the travel fields, and output a friendly response.\n"
        "You also have visibility into the user's scheduled calendar events/activities during their trip. Use this information to reply intelligently if the user asks about outfits, planning, activities, or the calendar.\n\n"
        "Current fields:\n"
        f"Destinations: {body.destinations or 'None'}\n"
        f"Purpose: {body.purpose or 'None'}\n"
        f"Preferred Style: {body.preferred_style or 'None'}\n"
        f"Departure: {body.departure_time or 'None'}\n"
        f"Return: {body.return_time or 'None'}\n"
        f"Notes: {body.notes or 'None'}\n"
        f"Scheduled Calendar Events: {json.dumps(events) if events else 'None'}\n\n"
        "User message:\n"
        f"'{body.message}'\n\n"
        "Respond ONLY with a JSON object in this format (no markdown formatting, no prose outside JSON):\n"
        "{\n"
        '  "destinations": string | null,\n'
        '  "purpose": string | null,\n'
        '  "preferred_style": string | null,\n'
        '  "departure_time": string | null,\n'
        '  "return_time": string | null,\n'
        '  "notes": string | null,\n'
        '  "should_regenerate": boolean, // set to true if user asks to generate, coordinate, construct, conduit, regenerate, pack, replan, update, adapt, or recreate outfits or the packing list, or suit them to calendar activities/weather. Otherwise false\n'
        '  "reply": string\n'
        "}"
    )

    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    resp_str = await generate_text(
        user_text=prompt,
        response_mime_type="application/json",
        api_key=user_api_key,
        model=user_model,
    )
    import re
    try:
        return json.loads(resp_str)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', resp_str, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Could not parse response: {resp_str}")


@router.get("/active")
async def get_active_suitcase(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_db()
    suitcase = await db.suitcases.find_one(
        {"user_id": user["id"], "status": {"$ne": "completed"}}
    )
    if not suitcase:
        return {"active": False}
    
    # Clean Mongo _id for JSON output
    suitcase_dict = {k: v for k, v in suitcase.items() if k != "_id"}
    
    # Strictly enforce lists for array fields to prevent frontend React map/filter crashes
    for list_field in ["packing_list", "outfits", "local_fashion_stores", "missing_items"]:
        val = suitcase_dict.get(list_field)
        if not isinstance(val, list):
            suitcase_dict[list_field] = []
            
    # Strictly enforce string fields for outfits to prevent React 'Objects are not valid' errors
    for outfit in suitcase_dict["outfits"]:
        if not isinstance(outfit, dict):
            continue
        for str_field in ["date", "location", "time_to_wear", "outfit_name", "reasoning"]:
            if str_field in outfit and not isinstance(outfit[str_field], str):
                outfit[str_field] = str(outfit[str_field])
        
        items = outfit.get("items")
        if not isinstance(items, list):
            outfit["items"] = []
        else:
            for item in outfit["items"]:
                if not isinstance(item, dict):
                    continue
                for str_field in ["role", "description"]:
                    if str_field in item and not isinstance(item[str_field], str):
                        item[str_field] = str(item[str_field])

    for store in suitcase_dict["local_fashion_stores"]:
        if not isinstance(store, dict): continue
        for str_field in ["name", "address_or_area", "why"]:
            if str_field in store and not isinstance(store[str_field], str):
                store[str_field] = str(store[str_field])
                
    for m in suitcase_dict["missing_items"]:
        if not isinstance(m, dict): continue
        for str_field in ["role", "description", "reason_needed"]:
            if str_field in m and not isinstance(m[str_field], str):
                m[str_field] = str(m[str_field])

    # Enforce string for notes to prevent React 'Objects are not valid' errors
    if "missing_notes" in suitcase_dict and not isinstance(suitcase_dict["missing_notes"], str):
        suitcase_dict["missing_notes"] = str(suitcase_dict["missing_notes"])
        
    if "cultural_guidelines" in suitcase_dict and not isinstance(suitcase_dict["cultural_guidelines"], str):
        suitcase_dict["cultural_guidelines"] = str(suitcase_dict["cultural_guidelines"])
        
    if "danger_zones_info" in suitcase_dict and not isinstance(suitcase_dict["danger_zones_info"], str):
        suitcase_dict["danger_zones_info"] = str(suitcase_dict["danger_zones_info"])

    for top_level_str in ["destinations", "purpose", "preferred_style", "departure_time", "return_time", "notes"]:
        if top_level_str in suitcase_dict and not isinstance(suitcase_dict[top_level_str], str):
            if suitcase_dict[top_level_str] is None:
                suitcase_dict[top_level_str] = ""
            else:
                suitcase_dict[top_level_str] = str(suitcase_dict[top_level_str])

    return {"active": True, "suitcase": suitcase_dict}


@router.post("/active")
async def save_active_suitcase(
    body: dict[str, Any], user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    body["user_id"] = user["id"]
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    cleaned_body = strip_base64_images(body)
    
    if "id" not in cleaned_body or not cleaned_body["id"]:
        cleaned_body["id"] = str(uuid.uuid4())
        cleaned_body["created_at"] = cleaned_body["updated_at"]
        await db.suitcases.insert_one(cleaned_body)
    else:
        await db.suitcases.update_one(
            {"id": cleaned_body["id"], "user_id": user["id"]},
            {"$set": cleaned_body},
            upsert=True
        )
        
    # Clean Mongo _id for JSON output
    clean_suitcase = {k: v for k, v in cleaned_body.items() if k != "_id"}
    return {"status": "success", "suitcase": clean_suitcase}


@router.delete("/active")
async def delete_active_suitcase(
    is_unpack: bool = Query(False), user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Unpacking/Resetting the suitcase: moves all items back to closet, optionally schedules laundry push alert."""
    db = get_db()
    suitcase = await db.suitcases.find_one(
        {"user_id": user["id"], "status": {"$ne": "completed"}}
    )
    if not suitcase:
        return {"status": "error", "message": "No active suitcase found"}

    # Archive the completed trip
    now_iso = datetime.now(timezone.utc).isoformat()
    archive_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "destination": suitcase.get("destinations") or suitcase.get("destination") or "",
        "departure_time": suitcase.get("departure_time"),
        "return_time": suitcase.get("return_time"),
        "purpose": suitcase.get("purpose"),
        "preferred_style": suitcase.get("preferred_style"),
        "notes": suitcase.get("notes"),
        "packing_list": suitcase.get("packing_list"),
        "outfits": suitcase.get("outfits"),
        "local_fashion_stores": suitcase.get("local_fashion_stores") or [],
        "missing_items": suitcase.get("missing_items") or [],
        "push_notification_sent": not is_unpack, # True if resetting, False if unpacking
        "created_at": suitcase.get("created_at") or now_iso,
        "updated_at": now_iso
    }
    await db.suitcase_archives.insert_one(archive_doc)

    # Set status to completed
    await db.suitcases.update_one(
        {"id": suitcase["id"], "user_id": user["id"]},
        {"$set": {"status": "completed", "updated_at": now_iso}}
    )

    # Move all items back to closet (in_suitcase = False)
    await db.closet_items.update_many(
        {"user_id": user["id"], "in_suitcase": True},
        {"$set": {"in_suitcase": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"status": "success", "message": "Suitcase unpacked/reset and all items returned to Closet"}


@router.post("/pack")
async def pack_suitcase(
    body: SuitcasePackIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    
    # 1. Gather travel duration details
    try:
        dep_dt = datetime.fromisoformat(body.departure_time.replace("Z", "+00:00"))
        ret_dt = datetime.fromisoformat(body.return_time.replace("Z", "+00:00"))
        duration_hours = int((ret_dt - dep_dt).total_seconds() / 3600)
    except Exception:
        duration_hours = 72  # fallback 3 days

    # 2. Get user calendar events
    events = []
    try:
        from app.services.calendar_service import calendar_service
        events = await calendar_service.get_events_for_user(
            user,
            hours_ahead=max(24, duration_hours),
            time_min=dep_dt if "dep_dt" in locals() else None,
            time_max=ret_dt if "ret_dt" in locals() else None
        )
    except Exception as e:
        logger.warning("Failed to retrieve user calendar events: %s", e)

    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    # 3. Get destination coordinates & weather
    weather_ctx = None
    weather_summary = "Weather information unavailable."
    try:
        geo_prompt = (
            f"Provide the approximate latitude, longitude, and Olson timezone name for "
            f"the travel destination: '{body.destinations}'. "
            f"Respond ONLY with a JSON object in this format: "
            f'{{"lat": float, "lng": float, "timezone": string}}'
        )
        geo_str = await generate_text(
            user_text=geo_prompt,
            response_mime_type="application/json",
            api_key=user_api_key,
            model=user_model,
        )
        geo_data = json.loads(geo_str)
        lat = geo_data.get("lat")
        lng = geo_data.get("lng")
        
        if lat is not None and lng is not None:
            try:
                from app.services.weather_service import weather_service
                if weather_service:
                    weather_ctx = await weather_service.fetch(lat, lng)
                    if weather_ctx:
                        weather_summary = (
                            f"Current weather at destination: {weather_ctx.get('temp_c')}°C, "
                            f"{weather_ctx.get('description') or weather_ctx.get('condition')}. "
                            f"24h Forecast: {weather_ctx.get('forecast_next_24h') or 'N/A'}"
                        )
            except Exception as w_exc:
                logger.warning("Failed to fetch weather: %s", w_exc)
    except Exception as e:
        logger.warning("Geocoding/Weather setup failed: %s", e)

    # 4. Fetch user's closet items
    cursor = db.closet_items.find(
        {"user_id": user["id"], "group_role": {"$ne": "member"}},
        {"_id": 0}
    )
    closet_items = [doc async for doc in cursor]

    # 5. Load safety knowledge RAG context
    safety_context = get_safety_knowledge()

    # 6. Query Gemini to analyze and generate outfits & packing list
    from app.services.user_preferences import render_user_preferences
    prefs_block, _ = render_user_preferences(user)

    system_prompt = (
        "You are DressApp’s Traveling AI Stylist. You specialize in building smart packing plans.\n"
        "Your goals are:\n"
        "1. Select appropriate clothing from the user's Closet honoring weather, duration, scheduled calendar events/activities during the trip. You MUST translate and understand calendar event titles if they are in another language (e.g. Hebrew like 'יום טרקים' = trekking day, 'ארוחת ערב חגיגית' = festive/gala dinner) and design outfits specifically for each day's scheduled activities (e.g., activewear/comfortable athletic shoes for active/trekking days, formalwear/dressy clothes for festive dinners/gala events, or comfortable travel outfits for flight days), while respecting cultural conventions, and strictly adhering to the user's personal style preferences, aesthetic, and outfit-generation rules.\n"
        "2. Minimize the load: select versatile garments that can be recombined into different outfits (e.g. reuse jeans, shirts, jackets across multiple days).\n"
        "3. Highlight cultural or religious dress restrictions of the destination using the provided Safety Context.\n"
        "4. Alert if crucial items are missing.\n"
        "5. Recommend shopping advisor local store recommendations (search/recommend top 3 fashion stores in the destination area where the user can buy missing items).\n"
        "6. If 'Current Outfits' and 'Current Packing List' are provided in the input, the user is requesting modifications or refinements to their existing suitcase plan (e.g., as specified in the 'Feedback modification:' section of User Notes). Your primary objective is to execute these requested changes (e.g. replacing a specific outfit, adding or removing specific garments, adjusting for weather changes) while keeping the rest of the outfits and packing checklist as stable and close to the current ones as possible. Do not regenerate everything from scratch if not necessary.\n\n"
    )
    if prefs_block:
        system_prompt += f"User's Personal Style & Closet Preferences:\n{prefs_block}\n\n"

    system_prompt += (
        "Output contract: You MUST respond ONLY with a JSON object matching this schema. Do not output markdown code blocks, just raw JSON:\n"
        "{\n"
        '  "cultural_guidelines": string, // weather-aware, calendar-aware, fashion guidelines on conventions, religion, proper dress codes\n'
        '  "danger_zones_info": string,   // safety/danger zones alert if applicable (e.g. Iran hijab law warning details), otherwise empty string\n'
        '  "outfits": Array<{\n'
        '    "date": string, // YYYY-MM-DD\n'
        '    "location": string,\n'
        '    "time_to_wear": "morning" | "afternoon" | "evening" | "all_day",\n'
        '    "outfit_name": string,\n'
        '    "items": Array<{\n'
        '      "role": "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress",\n'
        '      "description": string,\n'
        '      "closet_item_id": string | null, // ID of matching closet item, or null if missing\n'
        '      "status": "closet" | "missing"\n'
        '    }>,\n'
        '    "reasoning": string\n'
        '  }>,\n'
        '  "missing_items": Array<{\n'
        '    "role": "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress",\n'
        '    "description": string,\n'
        '    "reason_needed": string\n'
        '  }>,\n'
        '  "local_fashion_stores": Array<{\n'
        '    "name": string,\n'
        '    "address_or_area": string,\n'
        '    "why": string\n'
        '  }>\n'
        "}"
    )

    user_brief_parts = [
        f"Destinations: {body.destinations}",
        f"Trip Purpose: {body.purpose}",
        f"Preferred Style: {body.preferred_style}",
        f"Departure: {body.departure_time}",
        f"Return: {body.return_time}",
        f"User Notes: {body.notes or 'None'}",
        f"Weather Info: {weather_summary}",
        f"Calendar Events during trip: {json.dumps(events)}",
        f"Safety Context (RAG): {safety_context}"
    ]
    if body.current_outfits:
        user_brief_parts.append(f"Current Outfits (to be refined/modified based on user feedback): {json.dumps(body.current_outfits)}")
    if body.current_packing_list:
        user_brief_parts.append(f"Current Packing List: {json.dumps(body.current_packing_list)}")

    user_brief_parts.append(
        f"User's Closet Items:\n"
        f"{json.dumps([{ 'id': it.get('id'), 'title': it.get('title'), 'category': it.get('category'), 'sub_category': it.get('sub_category'), 'color': it.get('color'), 'brand': it.get('brand'), 'material': it.get('material') } for it in closet_items])}"
    )
    user_brief = "\n".join(user_brief_parts)

    analysis_str = await generate_text(
        user_text=user_brief,
        system=system_prompt,
        response_mime_type="application/json",
        api_key=user_api_key,
        model=user_model,
    )
    analysis = json.loads(analysis_str)

    # 7. Add Marketplace recommendations for missing items
    missing_items = analysis.get("missing_items") or []
    packing_list = []
    
    # Map closet items into the initial packing checklist & populate outfits with images
    packed_closet_ids = set()
    outfits = analysis.get("outfits") or []
    for outfit in outfits:
        for item in outfit.get("items") or []:
            match = find_closet_match(item, closet_items)
            if match:
                item["closet_item_id"] = match["id"]
                item["status"] = "closet"
                
                # Attach images directly to the outfit item
                item["thumbnail_data_url"] = match.get("thumbnail_data_url")
                item["reconstructed_image_url"] = match.get("reconstructed_image_url")
                item["clean_image_url"] = match.get("clean_image_url")
                item["segmented_image_url"] = match.get("segmented_image_url")
                item["original_image_url"] = match.get("original_image_url")
                
                if match["id"] not in packed_closet_ids:
                    packed_closet_ids.add(match["id"])
                    packing_list.append({
                        "id": match["id"],
                        "title": match.get("title") or "Closet item",
                        "category": match.get("category"),
                        "checked": False,
                        "is_missing": False,
                        "recommendation_source": None,
                        "recommendation_url": None,
                        "thumbnail_data_url": match.get("thumbnail_data_url"),
                        "reconstructed_image_url": match.get("reconstructed_image_url"),
                        "clean_image_url": match.get("clean_image_url"),
                        "segmented_image_url": match.get("segmented_image_url"),
                        "original_image_url": match.get("original_image_url")
                    })
            else:
                item["closet_item_id"] = None
                item["status"] = "missing"

    # Fetch Marketplace recommendations for missing slots
    if missing_items:
        gaps = [{"role": m.get("role") or "accessory"} for m in missing_items]
        try:
            suggestions = await suggest_for_gaps(
                user=user,
                gaps=gaps,
                brief=f"{body.purpose} in {body.destinations} style {body.preferred_style}"
            )
        except Exception:
            suggestions = []

        # Merge suggestions into missing items in the packing checklist
        for m in missing_items:
            role = m.get("role")
            matching_sugs = [s for s in suggestions if s.get("fills_slot") == role]
            
            # Format recommendation
            rec_source = "Local Shopping Advice"
            rec_url = None
            stores = analysis.get("local_fashion_stores") or []
            if matching_sugs:
                rec_source = "Marketplace Suggestion"
                rec_url = f"/market/{matching_sugs[0]['listing_id']}"
            elif stores:
                rec_source = f"Local Store: {stores[0].get('name')}"

            packing_list.append({
                "id": f"missing-{role}-{str(uuid.uuid4())[:8]}",
                "title": f"Missing item: {m.get('description') or role}",
                "category": role,
                "checked": False,
                "is_missing": True,
                "recommendation_source": rec_source,
                "recommendation_url": rec_url
            })

    # Build response structure
    return {
        "status": "success",
        "cultural_guidelines": analysis.get("cultural_guidelines"),
        "danger_zones_info": analysis.get("danger_zones_info"),
        "outfits": outfits,
        "packing_list": packing_list,
        "local_fashion_stores": analysis.get("local_fashion_stores") or [],
        "missing_items": missing_items,
    }


@router.post("/approve")
async def approve_suitcase(
    body: SuitcaseApproveIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()

    # 2. Save/Update active suitcase state
    suitcase_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "destinations": body.destinations,
        "purpose": body.purpose,
        "preferred_style": body.preferred_style,
        "departure_time": body.departure_time,
        "return_time": body.return_time,
        "notes": body.notes,
        "status": "active",
        "outfits": body.outfits,
        "packing_list": body.packing_list,
        "missing_notes": body.missing_notes,
        "local_fashion_stores": body.local_fashion_stores or [],
        "missing_items": body.missing_items or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    cleaned_doc = strip_base64_images(suitcase_doc)
    
    # Replace any existing active suitcase
    await db.suitcases.delete_many({"user_id": user["id"], "status": {"$ne": "completed"}})
    await db.suitcases.insert_one(cleaned_doc)

    # Clean Mongo _id for JSON output
    suitcase_clean = {k: v for k, v in cleaned_doc.items() if k != "_id"}
    return {"status": "success", "suitcase": suitcase_clean}


@router.post("/items/pack-status")
async def update_items_pack_status(
    body: PackStatusIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Helper to build mixed ID queries
    def get_mixed_ids(ids: list[str]) -> list[Any]:
        return ids + [int(x) for x in ids if x.isdigit()]

    # Packed items move to suitcase (in_suitcase = True)
    if body.packed_ids:
        await db.closet_items.update_many(
            {"id": {"$in": get_mixed_ids(body.packed_ids)}, "user_id": user["id"]},
            {"$set": {"in_suitcase": True, "updated_at": now_iso}}
        )
    # Unpacked items move back to closet (in_suitcase = False)
    if body.unpacked_ids:
        await db.closet_items.update_many(
            {"id": {"$in": get_mixed_ids(body.unpacked_ids)}, "user_id": user["id"]},
            {"$set": {"in_suitcase": False, "updated_at": now_iso}}
        )

    # Sync Suitcase packing list state in the DB
    active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
    if active_s:
        updated_packing_list = []
        packed_str = [str(x) for x in body.packed_ids]
        unpacked_str = [str(x) for x in body.unpacked_ids]
        for p in active_s.get("packing_list") or []:
            p_id = str(p.get("id") or p.get("closet_item_id") or "")
            if p_id in packed_str:
                p["checked"] = True
            elif p_id in unpacked_str:
                p["checked"] = False
            updated_packing_list.append(p)

        await db.suitcases.update_one(
            {"id": active_s["id"]},
            {"$set": {"packing_list": updated_packing_list, "updated_at": now_iso}}
        )

    return {"status": "success"}


@router.post("/items")
async def add_suitcase_item(
    body: AddSuitcaseItemIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Adds a new purchased item directly to the Suitcase (and Closet)."""
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    item_id = str(uuid.uuid4())
    doc = {
        "id": item_id,
        "user_id": user["id"],
        "source": "Private",
        "title": body.title,
        "name": body.title,
        "category": body.category.lower(),
        "color": body.color,
        "brand": body.brand,
        "price_cents": body.price_cents,
        "currency": body.currency,
        "notes": body.notes,
        "size": body.size,
        "in_suitcase": True,  # added while traveling -> immediately in suitcase
        "created_at": now_iso,
        "updated_at": now_iso
    }
    
    # Save garment in database
    await db.closet_items.insert_one(doc)

    # Append to suitcase packing list
    active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
    if active_s:
        p_list = active_s.get("packing_list") or []
        p_list.append({
            "id": item_id,
            "title": body.title,
            "category": body.category.lower(),
            "checked": True,  # immediately checked/packed
            "is_missing": False,
            "recommendation_source": None,
            "recommendation_url": None
        })
        await db.suitcases.update_one(
            {"id": active_s["id"]},
            {"$set": {"packing_list": p_list, "updated_at": now_iso}}
        )

    # Clean Mongo _id for JSON output
    clean_item = {k: v for k, v in doc.items() if k != "_id"}
    return {"status": "success", "item": clean_item}


@router.delete("/items/{item_id}")
async def delete_suitcase_item(
    item_id: str, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # 1. Return the "deleted" Suitcase item to the Closet (set in_suitcase = False)
    item_id_query = int(item_id) if item_id.isdigit() else item_id
    await db.closet_items.update_one(
        {"id": {"$in": [item_id, item_id_query]}, "user_id": user["id"]},
        {"$set": {"in_suitcase": False, "updated_at": now_iso}}
    )

    # 2. Remove from active suitcase packing list
    active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
    if active_s:
        p_list = active_s.get("packing_list") or []
        filtered_p_list = [p for p in p_list if str(p.get("id") or "") != str(item_id)]
        await db.suitcases.update_one(
            {"id": active_s["id"]},
            {"$set": {"packing_list": filtered_p_list, "updated_at": now_iso}}
        )

    return {"status": "success"}


@router.post("/enter-location")
async def enter_suitcase_location(
    body: EnterLocationIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Triggered when user enters a location (danger zone/holy place). Sends appropriate outfit advice push alerts."""
    db = get_db()
    safety_context = get_safety_knowledge()

    prompt = (
        f"You are a travel modesty and safety advisor. Given the user's location '{body.location}', "
        f"determine if it is a danger modesty zone (where inappropriate outfit can lead to court-martial/death, like Iran) "
        f"or a holy/cultural place (e.g. temples, churches) that requires specific modest outfits.\n"
        f"Use the attached guidelines:\n{safety_context}\n\n"
        f"Respond ONLY with a JSON object in this format:\n"
        f'{{"is_danger_zone": boolean, "is_holy_place": boolean, "alert_title": string, "alert_body": string}}'
    )

    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    resp_str = await generate_text(
        user_text=prompt,
        response_mime_type="application/json",
        api_key=user_api_key,
        model=user_model,
    )
    res = json.loads(resp_str)

    if res.get("is_danger_zone") or res.get("is_holy_place"):
        # Send push notification immediately
        await send_push_notification(
            user_id=user["id"],
            title=res.get("alert_title") or "Modesty Warning! ⚠️",
            body=res.get("alert_body") or f"Modest dress code required in this area."
        )

    return {"status": "success", "analysis": res}


@router.get("/archive")
async def get_suitcase_archives(user: dict = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db.suitcase_archives.find({"user_id": user["id"]}).sort([("created_at", -1)])
    return [{k: v for k, v in doc.items() if k != "_id"} async for doc in cursor]

@router.delete("/archive")
async def delete_suitcase_archives(
    ids: str = Query(..., description="Comma separated list of archive IDs to delete"),
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return {"status": "error", "message": "No IDs provided"}
    
    result = await db.suitcase_archives.delete_many(
        {"id": {"$in": id_list}, "user_id": user["id"]}
    )
    return {"status": "success", "deleted_count": result.deleted_count}
