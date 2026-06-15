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


class SuitcasePackIn(BaseModel):
    destinations: str
    purpose: str
    preferred_style: str
    departure_time: str  # ISO8601
    return_time: str     # ISO8601
    notes: str | None = None


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


# ─── endpoints ──────────────────────────────────────────────

@router.post("/chat")
async def suitcase_chat(
    body: SuitcaseChatIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    client = GeminiClient()
    prompt = (
        "You are DressApp's Suitcase Chat Assistant. The user is planning a trip and gathering details.\n"
        "Your task is to analyze the user's message, extract updates to the travel fields, and output a friendly response.\n"
        "Current fields:\n"
        f"Destinations: {body.destinations or 'None'}\n"
        f"Purpose: {body.purpose or 'None'}\n"
        f"Preferred Style: {body.preferred_style or 'None'}\n"
        f"Departure: {body.departure_time or 'None'}\n"
        f"Return: {body.return_time or 'None'}\n"
        f"Notes: {body.notes or 'None'}\n\n"
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
        '  "reply": string\n'
        "}"
    )

    resp_str = await client.text(user_text=prompt, response_mime_type="application/json")
    return json.loads(resp_str)


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
    return {"active": True, "suitcase": suitcase_dict}


@router.post("/active")
async def save_active_suitcase(
    body: dict[str, Any], user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    body["user_id"] = user["id"]
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if "id" not in body or not body["id"]:
        body["id"] = str(uuid.uuid4())
        body["created_at"] = body["updated_at"]
        await db.suitcases.insert_one(body)
    else:
        await db.suitcases.update_one(
            {"id": body["id"], "user_id": user["id"]},
            {"$set": body},
            upsert=True
        )
    # Clean Mongo _id for JSON output
    clean_suitcase = {k: v for k, v in body.items() if k != "_id"}
    return {"status": "success", "suitcase": clean_suitcase}


@router.delete("/active")
async def delete_active_suitcase(
    background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Unpacking the suitcase: moves all items back to closet, triggers laundry push alert."""
    db = get_db()
    suitcase = await db.suitcases.find_one(
        {"user_id": user["id"], "status": {"$ne": "completed"}}
    )
    if not suitcase:
        return {"status": "error", "message": "No active suitcase found"}

    # Set status to completed
    await db.suitcases.update_one(
        {"id": suitcase["id"], "user_id": user["id"]},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Move all items back to closet (in_suitcase = False)
    await db.closet_items.update_many(
        {"user_id": user["id"], "in_suitcase": True},
        {"$set": {"in_suitcase": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Queue push notification in background
    background_tasks.add_task(
        send_push_notification,
        user_id=user["id"],
        title="Welcome Back! ✈️",
        body="Don't forget to launder the garments from your suitcase soon to keep them fresh!"
    )

    return {"status": "success", "message": "Suitcase unpacked and all items returned to Closet"}


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
        events = await calendar_service.get_events_for_user(user, hours_ahead=max(24, duration_hours))
    except Exception as e:
        logger.warning("Failed to retrieve user calendar events: %s", e)

    # 3. Get destination coordinates & weather
    weather_ctx = None
    weather_summary = "Weather information unavailable."
    try:
        client = GeminiClient()
        geo_prompt = (
            f"Provide the approximate latitude, longitude, and Olson timezone name for "
            f"the travel destination: '{body.destinations}'. "
            f"Respond ONLY with a JSON object in this format: "
            f'{{"lat": float, "lng": float, "timezone": string}}'
        )
        geo_str = await client.text(user_text=geo_prompt, response_mime_type="application/json")
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
    client = GeminiClient()
    system_prompt = (
        "You are DressApp’s Traveling AI Stylist. You specialize in building smart packing plans.\n"
        "Your goals are:\n"
        "1. Select appropriate clothing from the user's Closet honoring weather, duration, and cultural conventions.\n"
        "2. Minimize the load: select versatile garments that can be recombined into different outfits (e.g. reuse jeans, shirts, jackets across multiple days).\n"
        "3. Highlight cultural or religious dress restrictions of the destination using the provided Safety Context.\n"
        "4. Alert if crucial items are missing.\n"
        "5. Recommend shopping advisor local store recommendations (search/recommend top 3 fashion stores in the destination area where the user can buy missing items).\n\n"
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
        "  }>\n"
        "}"
    )

    user_brief = (
        f"Destinations: {body.destinations}\n"
        f"Trip Purpose: {body.purpose}\n"
        f"Preferred Style: {body.preferred_style}\n"
        f"Departure: {body.departure_time}\n"
        f"Return: {body.return_time}\n"
        f"User Notes: {body.notes or 'None'}\n"
        f"Weather Info: {weather_summary}\n"
        f"Calendar Events during trip: {json.dumps(events)}\n"
        f"Safety Context (RAG): {safety_context}\n\n"
        f"User's Closet Items:\n"
        f"{json.dumps([{ 'id': it.get('id'), 'title': it.get('title'), 'category': it.get('category'), 'sub_category': it.get('sub_category'), 'color': it.get('color'), 'brand': it.get('brand'), 'material': it.get('material') } for it in closet_items])}"
    )

    analysis_str = await client.text(
        user_text=user_brief,
        system=system_prompt,
        response_mime_type="application/json"
    )
    analysis = json.loads(analysis_str)

    # 7. Add Marketplace recommendations for missing items
    missing_items = analysis.get("missing_items") or []
    packing_list = []
    
    # Map closet items into the initial packing checklist
    packed_closet_ids = set()
    for outfit in analysis.get("outfits") or []:
        for item in outfit.get("items") or []:
            cid = item.get("closet_item_id")
            if cid and cid not in packed_closet_ids:
                packed_closet_ids.add(cid)
                c_item = next((it for it in closet_items if it.get("id") == cid), None)
                if c_item:
                    packing_list.append({
                        "id": cid,
                        "title": c_item.get("title") or "Closet item",
                        "category": c_item.get("category"),
                        "checked": False,
                        "is_missing": False,
                        "recommendation_source": None,
                        "recommendation_url": None
                    })

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
        "outfits": analysis.get("outfits") or [],
        "packing_list": packing_list,
        "local_fashion_stores": analysis.get("local_fashion_stores") or [],
        "missing_items": missing_items,
    }


@router.post("/approve")
async def approve_suitcase(
    body: SuitcaseApproveIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    
    # 1. Archive the trip record
    archive_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "destination": body.destinations,
        "departure_time": body.departure_time,
        "return_time": body.return_time,
        "purpose": body.purpose,
        "preferred_style": body.preferred_style,
        "notes": body.notes,
        "packing_list": body.packing_list,
        "outfits": body.outfits,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.suitcase_archives.insert_one(archive_doc)

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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Replace any existing active suitcase
    await db.suitcases.delete_many({"user_id": user["id"], "status": {"$ne": "completed"}})
    await db.suitcases.insert_one(suitcase_doc)

    # Clean Mongo _id for JSON output
    suitcase_clean = {k: v for k, v in suitcase_doc.items() if k != "_id"}
    return {"status": "success", "suitcase": suitcase_clean}


@router.post("/items/pack-status")
async def update_items_pack_status(
    body: PackStatusIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Packed items move to suitcase (in_suitcase = True)
    if body.packed_ids:
        await db.closet_items.update_many(
            {"id": {"$in": body.packed_ids}, "user_id": user["id"]},
            {"$set": {"in_suitcase": True, "updated_at": now_iso}}
        )
    # Unpacked items move back to closet (in_suitcase = False)
    if body.unpacked_ids:
        await db.closet_items.update_many(
            {"id": {"$in": body.unpacked_ids}, "user_id": user["id"]},
            {"$set": {"in_suitcase": False, "updated_at": now_iso}}
        )

    # Sync Suitcase packing list state in the DB
    active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
    if active_s:
        updated_packing_list = []
        for p in active_s.get("packing_list") or []:
            if p["id"] in body.packed_ids:
                p["checked"] = True
            elif p["id"] in body.unpacked_ids:
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
    
    # 1. Delete closet item
    await db.closet_items.delete_one({"id": item_id, "user_id": user["id"]})

    # 2. Remove from active suitcase packing list
    active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
    if active_s:
        p_list = active_s.get("packing_list") or []
        filtered_p_list = [p for p in p_list if p["id"] != item_id]
        await db.suitcases.update_one(
            {"id": active_s["id"]},
            {"$set": {"packing_list": filtered_p_list, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    return {"status": "success"}


@router.post("/enter-location")
async def enter_suitcase_location(
    body: EnterLocationIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Triggered when user enters a location (danger zone/holy place). Sends appropriate outfit advice push alerts."""
    db = get_db()
    safety_context = get_safety_knowledge()
    client = GeminiClient()

    prompt = (
        f"You are a travel modesty and safety advisor. Given the user's location '{body.location}', "
        f"determine if it is a danger modesty zone (where inappropriate outfit can lead to court-martial/death, like Iran) "
        f"or a holy/cultural place (e.g. temples, churches) that requires specific modest outfits.\n"
        f"Use the attached guidelines:\n{safety_context}\n\n"
        f"Respond ONLY with a JSON object in this format:\n"
        f'{{"is_danger_zone": boolean, "is_holy_place": boolean, "alert_title": string, "alert_body": string}}'
    )

    resp_str = await client.text(user_text=prompt, response_mime_type="application/json")
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
