"""DressApp Suitcase API Routes — Traveling AI solution."""
from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.gemini_client import GeminiClient
from app.services.weather_service import weather_service
from app.services.calendar_service import calendar_service
from app.services.push_service import send_push_notification
from app.services.marketplace_search import suggest_for_gaps
from app.services.i18n import LANG_NAMES
from app.services.keyed_prompts import PROMPT_SUITCASE, KEY_SUITCASE

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


def get_suitcase_language_directive(code: str | None) -> str:
    code = (code or "en").lower().split("-")[0]
    name = LANG_NAMES.get(code, "English")
    return (
        f"\n\nCRITICAL LANGUAGE DIRECTIVE: The user's interface language is {name} ('{code}').\n"
        f"You MUST generate ALL human-facing text in natural, idiomatic {name} ('{code}'). This strictly applies to:\n"
        f"- All outfit names ('outfits[].outfit_name')\n"
        f"- All outfit reasoning ('outfits[].reasoning')\n"
        f"- All item descriptions ('outfits[].items[].description')\n"
        f"- All missing item descriptions ('missing_items[].description')\n"
        f"- All missing item reasons ('missing_items[].reason_needed')\n"
        f"- Cultural guidelines ('cultural_guidelines')\n"
        f"- Danger zone warnings ('danger_zones_info')\n"
        f"- Local fashion store recommendations rationale ('local_fashion_stores[].why')\n"
        f"Even if user closet items or destination names are in English, DO NOT write explanations, reasons, or descriptions in English. Write them in {name}.\n"
        f"Keep ONLY technical schema keys and enum values in English ('top', 'bottom', 'outerwear', 'shoes', 'accessory', 'dress', 'morning', 'afternoon', 'evening', 'all_day', 'closet', 'missing')."
    )


GEMINI_SUITCASE_SYSTEM_PROMPT = (
    "You are DressApp’s Traveling AI Stylist. You specialize in building smart packing plans.\n"
    "Your goals are:\n"
    "1. Select appropriate clothing from the user's Closet honoring weather, duration, scheduled calendar events/activities during the trip. You MUST translate and understand calendar event titles if they are in another language (e.g. Hebrew like 'יום טרקים' = trekking day, 'ארוחת ערב חגיגית' = festive/gala dinner) and design outfits specifically for each day's scheduled activities (e.g., activewear/comfortable athletic shoes for active/trekking days, formalwear/dressy clothes for festive dinners/gala events, modest long-sleeved/ankle-length attire for mosque or temple visits, or comfortable travel outfits for flight days), while respecting cultural conventions, and strictly adhering to the user's personal style preferences, aesthetic, and outfit-generation rules.\n"
    "2. Minimize the load: select versatile garments that can be recombined into different outfits (e.g. reuse jeans, shirts, jackets, shoes across multiple days).\n"
    "3. Highlight cultural or religious dress restrictions of the destination using the provided Safety Context.\n"
    "4. Alert if crucial items are missing.\n"
    "5. Recommend shopping advisor local store recommendations (recommend top 3 fashion stores in the destination area where the user can buy missing items).\n"
    "6. If 'Current Outfits' and 'Current Packing List' are provided in the input, the user is requesting modifications or refinements to their existing suitcase plan. Execute the requested changes while keeping the rest of the outfits as stable as possible.\n"
    "7. Keep 'reasoning' to 1-2 concise sentences per outfit and item 'description' under 10 words so the JSON response remains compact.\n\n"
    "Output contract: You MUST respond ONLY with a JSON object matching this schema. Do not output markdown code blocks, just raw JSON:\n"
    "{\n"
    '  "cultural_guidelines": string,\n'
    '  "danger_zones_info": string,\n'
    '  "outfits": Array<{\n'
    '    "date": string, // YYYY-MM-DD\n'
    '    "location": string,\n'
    '    "time_to_wear": "morning" | "afternoon" | "evening" | "all_day",\n'
    '    "outfit_name": string,\n'
    '    "items": Array<{\n'
    '      "role": "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "dress",\n'
    '      "description": string,\n'
    '      "closet_item_id": string | null, // exact ID from User Closet Items, or null if missing\n'
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


def find_closet_match(
    item: dict,
    closet_items: list[dict],
    alias_map: dict[str, dict] | None = None,
) -> dict | None:
    if not item or not closet_items:
        return None
    # 1. Try matching by short alias ID or full UUID first
    cid = item.get("closet_item_id") or item.get("id")
    if cid is not None:
        cid_str = str(cid).strip()
        if alias_map and cid_str in alias_map:
            return alias_map[cid_str]
        match = next((i for i in closet_items if str(i.get("id") or "") == cid_str), None)
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


_KNOWN_DESTINATIONS_GEO: dict[str, tuple[float, float]] = {
    "marrakech": (31.6295, -7.9811),
    "marrakesh": (31.6295, -7.9811),
    "מרקש": (31.6295, -7.9811),
    "morocco": (31.6295, -7.9811),
    "מרוקו": (31.6295, -7.9811),
    "casablanca": (33.5731, -7.5898),
    "קזבלנקה": (33.5731, -7.5898),
    "fes": (34.0181, -5.0078),
    "פאס": (34.0181, -5.0078),
    "paris": (48.8566, 2.3522),
    "פריז": (48.8566, 2.3522),
    "london": (51.5074, -0.1278),
    "לונדון": (51.5074, -0.1278),
    "rome": (41.9028, 12.4964),
    "רומא": (41.9028, 12.4964),
    "milan": (45.4642, 9.1900),
    "מילאנו": (45.4642, 9.1900),
    "barcelona": (41.3874, 2.1686),
    "ברצלונה": (41.3874, 2.1686),
    "madrid": (40.4168, -3.7038),
    "מדריד": (40.4168, -3.7038),
    "berlin": (52.5200, 13.4050),
    "ברלין": (52.5200, 13.4050),
    "amsterdam": (52.3676, 4.9041),
    "אמסטרדם": (52.3676, 4.9041),
    "athens": (37.9838, 23.7275),
    "אתונה": (37.9838, 23.7275),
    "istanbul": (41.0082, 28.9784),
    "איסטנבול": (41.0082, 28.9784),
    "dubai": (25.2048, 55.2708),
    "דובאי": (25.2048, 55.2708),
    "tokyo": (35.6762, 139.6503),
    "טוקיו": (35.6762, 139.6503),
    "kyoto": (35.0116, 135.7681),
    "קיוטו": (35.0116, 135.7681),
    "bangkok": (13.7563, 100.5018),
    "בנגקוק": (13.7563, 100.5018),
    "thailand": (13.7563, 100.5018),
    "תאילנד": (13.7563, 100.5018),
    "new york": (40.7128, -74.0060),
    "ניו יורק": (40.7128, -74.0060),
    "tel aviv": (32.0853, 34.7818),
    "תל אביב": (32.0853, 34.7818),
    "jerusalem": (31.7683, 35.2137),
    "ירושלים": (31.7683, 35.2137),
    "eilat": (29.5577, 34.9519),
    "אילת": (29.5577, 34.9519),
    "vienna": (48.2082, 16.3738),
    "וינה": (48.2082, 16.3738),
    "prague": (50.0755, 14.4378),
    "פראג": (50.0755, 14.4378),
    "budapest": (47.4979, 19.0402),
    "בודפשט": (47.4979, 19.0402),
    "lisbon": (38.7223, -9.1393),
    "ליסבון": (38.7223, -9.1393),
    "cairo": (30.0444, 31.2357),
    "קהיר": (30.0444, 31.2357),
    "mumbai": (19.0760, 72.8777),
    "מומבאי": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "דלהי": (28.6139, 77.2090),
    "india": (28.6139, 77.2090),
    "הודו": (28.6139, 77.2090),
}


async def _fast_geocode_destination(destinations: str) -> tuple[float | None, float | None]:
    """Resolve destination coordinates in <200ms via known city table or Open-Meteo Geocoding API."""
    if not destinations:
        return None, None
    dest_low = destinations.lower().strip()
    for key, coords in _KNOWN_DESTINATIONS_GEO.items():
        if key in dest_low:
            return coords

    # Try Open-Meteo free geocoding API
    first_part = re.split(r"[,;/\-]", destinations)[0].strip(" .")
    if first_part:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=2.5) as cli:
                resp = await cli.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": first_part, "count": 1, "format": "json"},
                )
                if resp.status_code == 200:
                    results = (resp.json() or {}).get("results") or []
                    if results:
                        return float(results[0]["latitude"]), float(results[0]["longitude"])
        except Exception as exc:
            logger.debug("Open-Meteo geocoding lookup skipped: %s", exc)
    return None, None


def _select_suitcase_closet_pool(
    clean_closet: list[dict[str, Any]],
    max_items: int = 45,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Select a diverse, category-balanced subset of closet items with compact integer alias IDs ('1', '2', ...).

    Prevents large closets (100+ items with 36-char UUIDs) from overflowing the 8192-token context window
    of on-prem DressApp Eyes (llama-server) and speeds up Gemini generation.
    """
    from app.services.stylist_scheduler_brain import norm_category

    buckets: dict[str, list[dict[str, Any]]] = {
        "top": [],
        "bottom": [],
        "shoes": [],
        "outerwear": [],
        "dress": [],
        "accessory": [],
        "other": [],
    }
    for it in clean_closet:
        c = norm_category(it.get("category"))
        if c not in buckets:
            c = "other"
        buckets[c].append(it)

    selected: list[dict[str, Any]] = []
    bucket_order = ["top", "bottom", "shoes", "outerwear", "dress", "accessory", "other"]
    idx = 0
    while len(selected) < max_items:
        added_in_round = False
        for b_name in bucket_order:
            b_list = buckets[b_name]
            if idx < len(b_list) and len(selected) < max_items:
                selected.append(b_list[idx])
                added_in_round = True
        if not added_in_round:
            break
        idx += 1

    compact_pool: list[dict[str, Any]] = []
    alias_map: dict[str, dict[str, Any]] = {}
    for i, it in enumerate(selected, start=1):
        alias_id = str(i)
        alias_map[alias_id] = it
        real_id = str(it.get("id") or "")
        if real_id:
            alias_map[real_id] = it
        entry: dict[str, Any] = {
            "id": alias_id,
            "title": (it.get("title") or it.get("name") or "Item")[:55],
            "category": it.get("category") or "",
        }
        if it.get("sub_category"):
            entry["sub_category"] = it.get("sub_category")
        col = it.get("color")
        if col:
            entry["color"] = col if isinstance(col, str) else str(col)[:30]
        if it.get("material"):
            entry["material"] = str(it.get("material"))[:25]
        compact_pool.append(entry)

    return compact_pool, alias_map


def _parse_suitcase_json(raw: str) -> dict[str, Any]:
    """Resiliently parse and repair JSON emitted by Gemini or DressApp Eyes for Suitcase endpoints."""
    if isinstance(raw, dict):
        return raw
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())

    parsed: dict[str, Any] | None = None
    try:
        cand = json.loads(text)
        if isinstance(cand, dict):
            parsed = cand
    except Exception:
        pass

    if parsed is None:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                cand = json.loads(match.group(0))
                if isinstance(cand, dict):
                    parsed = cand
            except Exception:
                pass

    if parsed is None:
        from app.services.gemini_stylist import _repair_truncated_json
        repaired = _repair_truncated_json(text)
        if isinstance(repaired, dict):
            parsed = repaired

    if not isinstance(parsed, dict):
        logger.error("Suitcase JSON parser could not decode output (len=%d): %s", len(text), text[:250])
        parsed = {
            "cultural_guidelines": "",
            "danger_zones_info": "",
            "outfits": [],
            "missing_items": [],
            "local_fashion_stores": [],
        }

    # Normalize schema variations between GEMINI_SUITCASE_SYSTEM_PROMPT and PROMPT_SUITCASE
    if not isinstance(parsed.get("outfits"), list):
        parsed["outfits"] = []
    if not isinstance(parsed.get("missing_items"), list):
        parsed["missing_items"] = []
    if not isinstance(parsed.get("local_fashion_stores"), list):
        parsed["local_fashion_stores"] = []

    for m in parsed["missing_items"]:
        if isinstance(m, dict):
            reason_val = m.get("reason_needed") or m.get("reason") or ""
            m["reason_needed"] = reason_val
            m["reason"] = reason_val

    for s in parsed["local_fashion_stores"]:
        if isinstance(s, dict):
            why_val = s.get("why") or s.get("reason") or ""
            s["why"] = why_val
            s["reason"] = why_val

    return parsed


class SuitcasePackIn(BaseModel):
    destinations: str
    purpose: str = "vacation"
    preferred_style: str = "casual chic"
    departure_time: str | None = None  # ISO8601
    return_time: str | None = None     # ISO8601
    duration_days: int | None = None
    notes: str | None = None
    current_outfits: list[dict[str, Any]] | None = None
    current_packing_list: list[dict[str, Any]] | None = None
    language: str | None = None


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
    message: str | None = None
    query: str | None = None
    language: str | None = None


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
    model: str = "gemini-3.5-flash-lite",
    user: dict[str, Any] | None = None,
    skip_translation: bool = False,
    timeout: float | None = None,
) -> str:
    from app.services.llm_gateway import call_main_llm

    return await call_main_llm(
        user_text=user_text,
        system_prompt=system,
        json_schema=response_schema,
        response_mime_type=response_mime_type,
        max_tokens=max_tokens or 4096,
        temperature=temperature or 0.1,
        model=model,
        fallback_model=model,
        api_key=api_key,
        user=user,
        skip_translation=skip_translation,
        timeout=timeout,
    )


# ─── endpoints ──────────────────────────────────────────────

@router.post("/chat")
async def suitcase_chat(
    body: SuitcaseChatIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    user_msg = (body.message or body.query or "").strip()
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

    target_lang = (body.language or user.get("preferred_language") or "en").lower().split("-")[0]
    lang_name = LANG_NAMES.get(target_lang, "English")
    from app.services.fashion_rules_rag import retrieve_fashion_axioms, format_rules_for_prompt
    chat_corpus = f"{body.destinations or ''} {body.purpose or ''} {body.preferred_style or ''} {body.notes or ''} {user_msg}"
    chat_axioms = retrieve_fashion_axioms(
        user_profile=user,
        user_text=chat_corpus,
        top_k=3,
    )
    chat_axioms_text = format_rules_for_prompt(chat_axioms, max_chars_per_rule=180)
    rag_section = f"\nDestination Dress Code & Cultural Axioms (RAG):\n{chat_axioms_text}\n\n" if chat_axioms_text else ""

    prompt = (
        "You are DressApp's Suitcase Chat Assistant. The user is planning a trip and gathering details.\n"
        f"Language Instruction: The user's interface language is '{target_lang}' ({lang_name}). Your 'reply' message MUST be written in natural, idiomatic {lang_name} ('{target_lang}').\n"
        "Your task is to analyze the user's message, extract updates to the travel fields, and output a friendly response.\n"
        "You also have visibility into the user's scheduled calendar events/activities during their trip. Use this information to reply intelligently if the user asks about outfits, planning, activities, or the calendar.\n\n"
        f"{rag_section}"
        "Current fields:\n"
        f"Destinations: {body.destinations or 'None'}\n"
        f"Purpose: {body.purpose or 'None'}\n"
        f"Preferred Style: {body.preferred_style or 'None'}\n"
        f"Departure: {body.departure_time or 'None'}\n"
        f"Return: {body.return_time or 'None'}\n"
        f"Notes: {body.notes or 'None'}\n"
        f"Scheduled Calendar Events: {json.dumps(events) if events else 'None'}\n\n"
        "User message:\n"
        f"'{user_msg}'\n\n"
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
        max_tokens=1024,
        api_key=user_api_key,
        model=user_model,
        user=user,
    )
    parsed_chat = _parse_suitcase_json(resp_str)
    if "reply" not in parsed_chat:
        parsed_chat["reply"] = ""
    if "should_regenerate" not in parsed_chat:
        parsed_chat["should_regenerate"] = False
    return parsed_chat


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
    now_utc = datetime.now(timezone.utc)
    from datetime import timedelta
    if not body.departure_time:
        body.departure_time = now_utc.isoformat()
    if not body.return_time:
        days = body.duration_days or 5
        body.return_time = (now_utc + timedelta(days=days)).isoformat()

    try:
        dep_dt = datetime.fromisoformat(body.departure_time.replace("Z", "+00:00"))
        ret_dt = datetime.fromisoformat(body.return_time.replace("Z", "+00:00"))
        duration_hours = max(24, int((ret_dt - dep_dt).total_seconds() / 3600))
        trip_days = max(1, min(14, (ret_dt.date() - dep_dt.date()).days + 1))
    except Exception:
        dep_dt = now_utc
        ret_dt = now_utc + timedelta(days=3)
        duration_hours = 72  # fallback 3 days
        trip_days = 3

    # 2. Get user calendar events
    events = []
    try:
        from app.services.calendar_service import calendar_service
        events = await calendar_service.get_events_for_user(
            user,
            hours_ahead=max(24, duration_hours),
            time_min=dep_dt,
            time_max=ret_dt
        )
    except Exception as e:
        logger.warning("Failed to retrieve user calendar events: %s", e)

    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model, resolve_effective_provider
    from app.services.eyes_override import get_active_provider
    user_api_key = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)
    eff_provider = (resolve_effective_provider(user) or await get_active_provider() or "gemini").lower().strip()
    is_gemma_provider = eff_provider in ("gemma", "eyes", "dressapp")

    # 3. Get destination coordinates & weather (fast lookup / Open-Meteo geocoding first)
    weather_ctx = None
    weather_summary = "Weather information unavailable."
    try:
        lat, lng = await _fast_geocode_destination(body.destinations)
        if lat is None or lng is None:
            geo_prompt = (
                f"Provide the approximate latitude, longitude, and Olson timezone name for "
                f"the travel destination: '{body.destinations}'. "
                f"Respond ONLY with a JSON object in this format: "
                f'{{"lat": float, "lng": float, "timezone": string}}'
            )
            geo_str = await generate_text(
                user_text=geo_prompt,
                response_mime_type="application/json",
                max_tokens=96,
                api_key=user_api_key,
                model=user_model,
                user=user,
                skip_translation=True,
                timeout=12.0,
            )
            geo_data = _parse_suitcase_json(geo_str)
            lat = geo_data.get("lat")
            lng = geo_data.get("lng")

        if lat is not None and lng is not None:
            try:
                from app.services.weather_service import weather_service
                if weather_service:
                    weather_ctx = await weather_service.fetch(float(lat), float(lng))
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

    # 5. Load Ground-Truth Fashion Rules RAG and travel safety context
    safety_context = get_safety_knowledge()

    from app.services.fashion_rules_rag import (
        retrieve_fashion_axioms,
        format_rules_for_prompt,
        filter_modesty_closet_items,
        filter_gender_closet_items,
    )
    user_gender = user.get("sex") or user.get("gender")
    clean_closet = filter_modesty_closet_items(closet_items, user.get("modesty_level"))
    clean_closet = filter_gender_closet_items(clean_closet, user_gender)

    trip_corpus = f"{body.destinations or ''} {body.purpose or ''} {body.preferred_style or ''} {body.notes or ''} {' '.join(e.get('title', '') for e in events if isinstance(e, dict))}"
    first_evt = events[0].get("title") if (events and isinstance(events, list) and isinstance(events[0], dict)) else None
    suitcase_axioms = retrieve_fashion_axioms(
        user_profile=user,
        weather=weather_ctx if isinstance(weather_ctx, dict) else None,
        occasion=body.purpose or first_evt,
        user_text=trip_corpus,
        closet_summary=clean_closet,
        top_k=4,
    )
    rag_axioms_text = format_rules_for_prompt(suitcase_axioms, max_chars_per_rule=200)

    # 6. Select compact, balanced closet pool with short alias IDs ('1', '2', ...)
    from app.services.user_preferences import render_user_preferences
    prefs_block, _ = render_user_preferences(user)

    target_lang = (body.language or user.get("preferred_language") or "en").lower().split("-")[0]
    max_closet_pool = 24 if is_gemma_provider else 48
    compact_pool, alias_map = _select_suitcase_closet_pool(clean_closet, max_items=max_closet_pool)

    # For on-prem DressApp Eyes (gemma / Qwen2.5-VL-3B on CPU), run generation in English
    # with a concise capsule plan (3-4 core outfits that rotate across trip dates) so CPU
    # completes in ~15-22s without overflowing context or timing out, then batch-translate to target_lang.
    prompt_lang = "en" if is_gemma_provider else target_lang
    lang_directive = get_suitcase_language_directive(prompt_lang)
    base_suitcase_prompt = PROMPT_SUITCASE if is_gemma_provider else GEMINI_SUITCASE_SYSTEM_PROMPT

    eff_destinations = body.destinations or ""
    eff_purpose = body.purpose or "vacation"
    eff_notes = body.notes or "None"
    if is_gemma_provider and target_lang != "en":
        try:
            from app.services.translation_service import translate_batch
            tr_inputs = [eff_destinations, eff_purpose, eff_notes]
            tr_outputs = await translate_batch(tr_inputs, target_lang="en", source_lang=target_lang)
            if len(tr_outputs) == 3:
                eff_destinations, eff_purpose, eff_notes = tr_outputs[0], tr_outputs[1], tr_outputs[2]
        except Exception as tr_in_exc:
            logger.warning("Suitcase inbound translation for Eyes soft-failed: %s", tr_in_exc)

    system_prompt = f"{base_suitcase_prompt}\n{lang_directive}\n"
    if rag_axioms_text:
        system_prompt += f"\n{rag_axioms_text}\n"
    if prefs_block and not is_gemma_provider:
        system_prompt += f"\nUser's Personal Style & Closet Preferences:\n{prefs_block}\n\n"

    # Keep safety context compact on CPU
    eff_safety_context = safety_context[:1500] if is_gemma_provider else safety_context

    user_brief_parts = [
        f"Destinations: {eff_destinations}",
        f"Trip Purpose: {eff_purpose}",
        f"Preferred Style: {body.preferred_style}",
        f"Departure: {body.departure_time}",
        f"Return: {body.return_time}",
        f"User Notes: {eff_notes}",
        f"Weather Info: {weather_summary}",
        f"Calendar Events during trip: {json.dumps(events[:6], ensure_ascii=False)}",
        f"Safety Context (RAG): {eff_safety_context}",
    ]
    if rag_axioms_text:
        user_brief_parts.append(f"Destination & Activity Fashion Axioms (RAG):\n{rag_axioms_text}")
    if body.current_outfits and not is_gemma_provider:
        user_brief_parts.append(f"Current Outfits (to be refined/modified based on user feedback): {json.dumps(body.current_outfits, ensure_ascii=False)}")
    if body.current_packing_list and not is_gemma_provider:
        user_brief_parts.append(f"Current Packing List: {json.dumps(body.current_packing_list, ensure_ascii=False)}")

    user_brief_parts.append(
        f"User's Closet Items:\n"
        f"{json.dumps(compact_pool, ensure_ascii=False, separators=(',', ':'))}"
    )
    if is_gemma_provider:
        target_outfit_count = min(trip_days, 3)
        user_brief_parts.append(
            f"\nCONCISE CAPSULE REQUIREMENT: Return exactly {target_outfit_count} versatile core outfits "
            f"(using exact 'id' strings from User's Closet Items for 'closet_item_id'), 2-3 'missing_items', "
            f"and 2 'local_fashion_stores'. Keep descriptions under 8 words and reasoning to 1 sentence."
        )
    user_brief_parts.append(lang_directive)
    user_brief = "\n".join(user_brief_parts)

    analysis_str = await generate_text(
        user_text=user_brief,
        system=system_prompt,
        response_mime_type="application/json",
        max_tokens=900 if is_gemma_provider else 8192,
        api_key=user_api_key,
        model=user_model,
        user=user,
        skip_translation=True,
        timeout=90.0 if is_gemma_provider else None,
    )
    analysis = _parse_suitcase_json(analysis_str)

    outfits = [o for o in (analysis.get("outfits") or []) if isinstance(o, dict)]
    missing_items = [m for m in (analysis.get("missing_items") or []) if isinstance(m, dict)]
    packing_list = []
    packed_closet_ids: set[str] = set()
    used_role_ids: set[str] = set()
    user_gender = user.get("sex") or user.get("gender")
    trip_context_text = f"{body.destinations or ''} {body.purpose or ''} {body.notes or ''}"

    # 7a. Map closet items onto the base outfits BEFORE outbound translation and BEFORE multi-day cloning
    for outfit in outfits:
        for item in outfit.get("items") or []:
            if not isinstance(item, dict):
                continue
            match = find_closet_match(item, closet_items, alias_map=alias_map)
            role = str(item.get("role") or "").lower().strip()
            if not match and is_gemma_provider and role in ("top", "bottom", "shoes", "outerwear"):
                try:
                    from app.services.stylist_qa_engine import find_best_garment_replacement
                    match = find_best_garment_replacement(
                        role=role,
                        all_closet_items=closet_items,
                        user_text=trip_context_text,
                        user_gender=user_gender,
                        exclude_item_ids=used_role_ids,
                    )
                    if match and match.get("id"):
                        used_role_ids.add(str(match["id"]))
                except Exception:
                    pass

            if match:
                item["closet_item_id"] = match["id"]
                item["status"] = "closet"
                if match.get("title"):
                    item["description"] = match.get("title")

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
                        "original_image_url": match.get("original_image_url"),
                    })
            else:
                item["closet_item_id"] = None
                item["status"] = "missing"

    # 7b. Translate Gemma English output into target_lang BEFORE multi-day cloning (3x fewer strings to translate)
    if is_gemma_provider and target_lang != "en":
        try:
            from app.services.translation_service import translate_batch
            texts_to_tr: list[str] = []
            tr_setters: list[Any] = []

            def _queue_tr(obj: dict[str, Any], key: str) -> None:
                val = obj.get(key)
                if isinstance(val, str) and val.strip():
                    texts_to_tr.append(val.strip())
                    tr_setters.append((obj, key))

            _queue_tr(analysis, "cultural_guidelines")
            _queue_tr(analysis, "danger_zones_info")
            for o in outfits:
                _queue_tr(o, "outfit_name")
                _queue_tr(o, "location")
                _queue_tr(o, "reasoning")
                for itm in o.get("items") or []:
                    if isinstance(itm, dict):
                        _queue_tr(itm, "description")
            for m in missing_items:
                if isinstance(m, dict):
                    _queue_tr(m, "description")
                    _queue_tr(m, "reason_needed")
            for s in analysis.get("local_fashion_stores") or []:
                if isinstance(s, dict):
                    _queue_tr(s, "why")

            if texts_to_tr:
                translated_list = await translate_batch(texts_to_tr, target_lang=target_lang, source_lang="en")
                for (target_dict, key), tr_val in zip(tr_setters, translated_list):
                    if tr_val:
                        target_dict[key] = tr_val
                        if key == "reason_needed":
                            target_dict["reason"] = tr_val
                        elif key == "why":
                            target_dict["reason"] = tr_val
        except Exception as tr_out_exc:
            logger.warning("Suitcase outbound translation for Eyes soft-failed: %s", tr_out_exc)

    # 7c. If trip_days > returned capsule outfits, expand across all trip dates so every day of the trip is covered
    if outfits and trip_days > len(outfits):
        import copy
        base_count = len(outfits)
        for day_idx in range(trip_days):
            day_date = (dep_dt + timedelta(days=day_idx)).strftime("%Y-%m-%d")
            if day_idx < base_count:
                outfits[day_idx]["date"] = day_date
            else:
                cloned = copy.deepcopy(outfits[day_idx % base_count])
                cloned["date"] = day_date
                outfits.append(cloned)
        analysis["outfits"] = outfits

    # Extract missing items from outfits if Gemini omitted them from analysis["missing_items"]
    seen_missing_keys = {
        (m.get("description") or m.get("role") or "").lower().strip()
        for m in missing_items
    }
    for outfit in outfits:
        for item in outfit.get("items") or []:
            if not isinstance(item, dict):
                continue
            if item.get("status") == "missing":
                desc = (item.get("description") or "").strip()
                key = desc.lower() if desc else (item.get("role") or "missing").lower()
                if key and key not in seen_missing_keys:
                    seen_missing_keys.add(key)
                    outfit_title = outfit.get("outfit_name") or "Outfit"
                    date_info = f" ({outfit.get('date')})" if outfit.get("date") else ""
                    missing_items.append({
                        "role": item.get("role") or "accessory",
                        "description": desc or item.get("role") or "Missing garment",
                        "reason_needed": f"{outfit_title}{date_info}",
                        "reason": f"{outfit_title}{date_info}",
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
            elif stores and isinstance(stores[0], dict):
                rec_source = f"Local Store: {stores[0].get('name')}"

            clean_desc = (m.get("description") or role or "Missing garment").strip()
            clean_desc = re.sub(r'^(?:missing\s*item\s*:\s*|פריט\s*חסר\s*:\s*)', '', clean_desc, flags=re.IGNORECASE).strip()

            packing_list.append({
                "id": f"missing-{role}-{str(uuid.uuid4())[:8]}",
                "title": clean_desc,
                "category": role,
                "checked": False,
                "is_missing": True,
                "recommendation_source": rec_source,
                "recommendation_url": rec_url
            })

    # Build response structure
    return {
        "status": "success",
        "cultural_guidelines": analysis.get("cultural_guidelines") or "",
        "danger_zones_info": analysis.get("danger_zones_info") or "",
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
        f"or a holy/cultural place (e.g. temples, churches, mosques) that requires specific modest outfits.\n"
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
        max_tokens=512,
        api_key=user_api_key,
        model=user_model,
        user=user,
    )
    res = _parse_suitcase_json(resp_str)

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
