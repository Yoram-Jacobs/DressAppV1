"""/api/v1/stylist — authenticated multimodal stylist route (Phase 2 + R).

Phase R adds multi-session support:
  * accepts an optional ``session_id`` form field on POST /stylist
  * sessions CRUD under /stylist/sessions
  * history is per-session
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.services.auth import get_current_user
from app.services.calendar_service import calendar_service
from app.services.logic import get_styling_advice
from app.services.session_titles import generate_session_title
from app.services.stylist_memory import (
    append_message,
    closet_summary_for,
    create_session,
    delete_session,
    full_history,
    get_or_create_active_session,
    get_session,
    list_sessions,
    recent_messages,
    update_session,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stylist", tags=["stylist"])


def _safe_session(session: dict) -> dict:
    """Strip Mongo _id to keep the payload JSON-safe."""
    return {k: v for k, v in session.items() if k != "_id"}


# ---------------------------------------------------------------------------
# Sessions CRUD
# ---------------------------------------------------------------------------
@router.get("/sessions")
async def stylist_sessions(
    user: dict = Depends(get_current_user),
    limit: int = 50,
) -> dict[str, Any]:
    """Newest-first list of the user's conversation sessions."""
    sessions = await list_sessions(user["id"], limit=limit)
    return {"sessions": [_safe_session(s) for s in sessions]}


@router.post("/sessions")
async def stylist_create_session(
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a fresh session. The title will be filled on the first turn."""
    session = await create_session(user["id"])
    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "stylist_updated", {"action": "create_session", "session_id": session.get("id")})
    return _safe_session(session)


@router.delete("/sessions/{session_id}")
async def stylist_delete_session(
    session_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    ok = await delete_session(session_id, user["id"])
    if not ok:
        raise HTTPException(404, "Session not found")
    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "stylist_updated", {"action": "delete_session", "session_id": session_id})
    return {"deleted": True, "session_id": session_id}


# ---------------------------------------------------------------------------
# POST /stylist — primary conversational endpoint
# ---------------------------------------------------------------------------
@router.post("")
async def stylist_endpoint(
    text: str | None = Form(default=None),
    voice_audio: UploadFile | None = File(default=None),
    image: UploadFile | None = File(default=None),
    do_infill: bool = Form(default=False),
    infill_prompt: str | None = Form(default=None),
    lat: float | None = Form(default=None),
    lng: float | None = Form(default=None),
    include_calendar: bool = Form(default=False),
    language: str | None = Form(default=None),
    voice_id: str | None = Form(default=None),
    occasion: str | None = Form(default=None),
    skip_tts: bool = Form(default=False),
    session_id: str | None = Form(default=None),
    widen_search: bool = Form(default=False),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    if not text and not voice_audio:
        raise HTTPException(400, "Provide `text` or `voice_audio`.")

    image_bytes: bytes | None = None
    image_mime = "image/jpeg"
    if image is not None:
        image_bytes = await image.read()
        image_mime = image.content_type or "image/jpeg"

    audio_bytes: bytes | None = None
    audio_filename = "audio.webm"
    audio_mime = "audio/webm"
    if voice_audio is not None:
        audio_bytes = await voice_audio.read()
        audio_filename = voice_audio.filename or audio_filename
        audio_mime = voice_audio.content_type or audio_mime

    calendar_events: list[dict[str, Any]] | None = None
    if include_calendar:
        real_events = await calendar_service.get_events_for_user(user)
        if real_events:
            calendar_events = real_events
        else:
            calendar_events = [calendar_service.mock_event(occasion or "Work day")]

    if lat is None or lng is None:
        home = user.get("home_location") or {}
        lat = lat if lat is not None else home.get("lat")
        lng = lng if lng is not None else home.get("lng")

    # Resolve target session: explicit id > last active > create fresh.
    session: dict | None = None
    if session_id:
        session = await get_session(session_id, user["id"])
    if not session:
        session = await get_or_create_active_session(user["id"])

    is_first_turn = (session.get("turns") or 0) == 0

    history = await recent_messages(session["id"], limit=8)
    closet = await closet_summary_for(user["id"], limit=1000)

    user_profile = {
        "preferred_language": (language or user.get("preferred_language") or "en").lower(),
        "preferred_voice_id": user.get("preferred_voice_id") or voice_id or "aura-2-thalia-en",
        "style_profile": user.get("style_profile"),
        "cultural_context": user.get("cultural_context"),
        "conversation_history": [
            {
                "role": m.get("role"),
                "transcript": m.get("transcript"),
                "payload": m.get("assistant_payload"),
            }
            for m in history
        ],
    }

    await append_message(
        session_id=session["id"],
        role="user",
        input_modality=(
            "image+voice"
            if image_bytes and audio_bytes
            else "image+text"
            if image_bytes
            else "voice"
            if audio_bytes
            else "text"
        ),
        transcript=text,
        image_refs=[],
        context={"lat": lat, "lng": lng, "include_calendar": include_calendar},
    )

    # Resolve user's API key and model
    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    api_key_resolved = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    if not api_key_resolved:
        raise HTTPException(
            status_code=400,
            detail="A valid Google Gemini API key is required. Please set your key in Profile -> AI Configuration.",
        )

    # Phase S — render user preferences once (cheap, ~1ms) so we can
    # both inject them into the LLM prompt AND echo the applied keys.
    from app.services.user_preferences import render_user_preferences
    prefs_block, applied_prefs = render_user_preferences(user)

    try:
        advice = await get_styling_advice(
            session_id=session["id"],
            image_bytes=image_bytes,
            image_mime=image_mime,
            user_text=text,
            voice_audio=audio_bytes,
            voice_filename=audio_filename,
            voice_mime=audio_mime,
            do_infill=do_infill,
            infill_prompt=infill_prompt,
            lat=lat,
            lng=lng,
            language=user_profile["preferred_language"],
            voice_id=user_profile["preferred_voice_id"],
            calendar_events=calendar_events,
            cultural_rules=user.get("cultural_context"),
            user_profile=user_profile,
            closet_summary=closet,
            user_preferences_block=prefs_block,
            synthesize_tts=not skip_tts,
            api_key=api_key_resolved,
            model=user_model,
        )
        
        # Deduct credit and count usage
        from app.db.database import get_db
        from app.services.billing_service import deduct_user_credits
        db = get_db()
        if not await deduct_user_credits(db, user, cost=1):
            raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("Stylist misconfiguration")
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        # Phase S: never 500 the chat — degrade gracefully so the user
        # gets a soft apology instead of a hard error. Especially
        # important when the user asks about something not in the closet.
        err_msg = str(exc)
        logger.exception("Stylist pipeline failed: %s", err_msg)
        _req_lang = (user_profile.get("preferred_language") or "en").lower()
        if "API_KEY_SERVICE_BLOCKED" in err_msg or "blocked" in err_msg.lower():
            _fallback_summary = (
                "מפתח ה-API של Google חסום לגישה ל-Gemini (שגיאת API_KEY_SERVICE_BLOCKED). "
                "נא לוודא ש-Generative Language API מופעל ב-Google Cloud Console, או לייצר מפתח מ-Google AI Studio (aistudio.google.com) ולהזינו בפרופיל."
                if _req_lang == "he" else
                "Your Google API key is blocked for Generative Language API (API_KEY_SERVICE_BLOCKED). "
                "Please enable 'Generative Language API' in Google Cloud Console or generate a key from Google AI Studio (aistudio.google.com)."
            )
        elif "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg or "spending cap" in err_msg.lower():
            _fallback_summary = (
                "מכסת השימוש ב-Gemini הסתיימה (429 Resource Exhausted / Spending Cap). "
                "נא לבדוק את מגבלות התקציב ב-Google AI Studio או להזין מפתח פעיל בהגדרות הפרופיל."
                if _req_lang == "he" else
                "Google Gemini quota exceeded (429 Resource Exhausted). Please check your spend cap in Google AI Studio or update your API key in profile settings."
            )
        elif "API_KEY_INVALID" in err_msg:
            _fallback_summary = (
                "מפתח ה-API של Google Gemini אינו תקין. נא לעדכן את המפתח בהגדרות הפרופיל."
                if _req_lang == "he" else
                "Google Gemini API key is invalid. Please update your API key in profile settings."
            )
        elif _req_lang == "he":
            _fallback_summary = "מצטער — התקשיתי בהרכבת ההמלצה. נסה לנסח מחדש או לבחור פריטים אחרים מהארון."
        elif _req_lang == "ar":
            _fallback_summary = "عذرًا — واجهت مشكلة في إعداد التوصية. حاول إعادة الصياغة أو إرفاق صورة."
        elif _req_lang == "es":
            _fallback_summary = "Lo siento, tuve problemas para armar esa recomendación. Intenta reformular o adjuntar una foto."
        elif _req_lang == "fr":
            _fallback_summary = "Désolé, j'ai eu du mal à élaborer cette recommandation. Essayez de reformuler votre demande."
        elif _req_lang == "de":
            _fallback_summary = "Entschuldigung, ich hatte Schwierigkeiten, diese Empfehlung zusammenzustellen. Bitte versuche es erneut."
        elif _req_lang == "it":
            _fallback_summary = "Spiacente, ho avuto problemi a creare questa raccomandazione. Prova a riformulare la richiesta."
        elif _req_lang == "ru":
            _fallback_summary = "Извините, не удалось составить эту рекомендацию. Попробуйте переформулировать запрос."
        else:
            _fallback_summary = (
                "Sorry — I had trouble putting that recommendation together. "
                "Try rephrasing, or attach a photo so I can see what you're working with."
            )

        advice = {
            "reasoning_summary": _fallback_summary,
            "spoken_reply": _fallback_summary,
            "outfit_recommendations": [],
            "shopping_suggestions": [],
            "do_dont": [],
            "latency_ms": {},
            "_soft_error": str(exc)[:200],
        }

    # Phase S — horizon expansion: marketplace + fashion-scout + Nano Banana
    # visualisation, all soft-failing so this branch can't 500.
    try:
        from app.services.stylist_widen import widen_stylist_response
        enrichment = await widen_stylist_response(
            user=user,
            user_text=text or "",
            advice=advice,
            closet_summary={"items": closet} if closet else None,
            user_requested_widen=widen_search,
        )
        advice["marketplace_suggestions"] = enrichment.get("marketplace_suggestions", [])
        advice["fashion_scout_picks"] = enrichment.get("fashion_scout_picks", [])
        advice["generated_examples"] = enrichment.get("generated_examples", [])
        advice["widened_for"] = enrichment.get("widened_for", [])
    except Exception as exc:  # noqa: BLE001
        logger.warning("widen-stylist soft-failed: %s", repr(exc)[:200])
    advice["applied_preferences"] = applied_prefs

    await append_message(
        session_id=session["id"],
        role="assistant",
        input_modality="text",
        transcript=advice.get("reasoning_summary") or "",
        assistant_payload={
            k: advice.get(k)
            for k in (
                "outfit_recommendations",
                "shopping_suggestions",
                "do_dont",
                "weather_summary",
                "calendar_summary",
                "segmented_image_url",
                "infilled_image_url",
                "spoken_reply",
                # Phase S enrichment
                "marketplace_suggestions",
                "fashion_scout_picks",
                "generated_examples",
                "widened_for",
                "applied_preferences",
            )
        },
        latency_ms=advice.get("latency_ms") or {},
    )

    # Generate session title if it doesn't have a descriptive one and we have user text/transcript
    final_text = (text or advice.get("transcript") or "").strip()
    current_title = session.get("title")
    is_untitled = not current_title or current_title in ("Untitled chat", "שיחה ללא שם", "New conversation", "Style advice")
    if is_untitled and final_text:
        try:
            title = await generate_session_title(
                final_text,
                language=user_profile.get("preferred_language") or "en",
                api_key=api_key_resolved
            )
            if title:
                await update_session(session["id"], user["id"], title=title)
                session["title"] = title
        except Exception as exc:  # noqa: BLE001
            logger.warning("Title generation failed for %s: %s", session["id"], exc)

    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "stylist_updated", {"action": "message", "session_id": session["id"]})

    return {
        "session_id": session["id"],
        "session": _safe_session(
            await get_session(session["id"], user["id"]) or session
        ),
        "advice": advice,
    }


# ---------------------------------------------------------------------------
# GET /stylist/history
# ---------------------------------------------------------------------------
@router.get("/history")
async def stylist_history(
    session_id: str | None = None,
    limit: int = 200,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Return full message history for a specific session (defaults to the
    user's most recent active session)."""
    if session_id:
        session = await get_session(session_id, user["id"])
        if not session:
            raise HTTPException(404, "Session not found")
    else:
        session = await get_or_create_active_session(user["id"])
    msgs = await full_history(session["id"], limit=limit)
    return {
        "session_id": session["id"],
        "session": _safe_session(session),
        "messages": [{k: v for k, v in m.items() if k != "_id"} for m in msgs],
    }



# ─── Phase R: Outfit Composer ───────────────────────────────
@router.post("/compose-outfit")
async def compose_outfit_endpoint(
    text: str = Form(""),
    language: str = Form("en"),
    session_id: str | None = Form(None),
    images: list[UploadFile] = File(default_factory=list),
    budget_cents: int | None = Form(None),
    currency: str | None = Form(None),
    dress_code: str | None = Form(None),
    season: str | None = Form(None),
    must_include: str | None = Form(None),  # comma-separated
    avoid: str | None = Form(None),  # comma-separated
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Multi-image outfit composer.

    Accepts up to ~8 images + a brief and returns a structured
    ``OutfitCanvas`` containing selected slots, rejected duplicates,
    marketplace gap suggestions, and an optional pro referral.

    The result is persisted as an assistant ``StylistMessage`` so the
    canvas survives chat history and can be re-rendered later.
    """
    from app.services import outfit_composer

    # Read all upload bytes up front (FastAPI streams them otherwise).
    image_bytes_list: list[bytes] = []
    for f in images or []:
        if not f or not f.filename:
            continue
        raw = await f.read()
        if raw:
            image_bytes_list.append(raw)
    if not image_bytes_list and not (text or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Send at least one image OR a text brief.",
        )

    constraints: dict[str, Any] = {}
    if budget_cents:
        constraints["budget_cents"] = int(budget_cents)
        constraints["currency"] = currency or "USD"
    if dress_code:
        constraints["dress_code"] = dress_code
    if season:
        constraints["season"] = season
    if must_include:
        constraints["must_include"] = [
            s.strip() for s in must_include.split(",") if s.strip()
        ]
    if avoid:
        constraints["avoid"] = [s.strip() for s in avoid.split(",") if s.strip()]

    # Phase S — render preferences once for the composer too.
    from app.services.user_preferences import render_user_preferences
    prefs_block, applied_prefs = render_user_preferences(user)

    # Resolve user's API key
    from app.services.auth import resolve_user_gemini_api_key
    api_key_resolved = resolve_user_gemini_api_key(user)

    if not api_key_resolved:
        raise HTTPException(
            status_code=400,
            detail="A valid Google Gemini API key is required. Please set your key in Profile -> AI Configuration.",
        )

    try:
        canvas = await outfit_composer.compose_outfit(
            user=user,
            brief=text or "",
            image_bytes_list=image_bytes_list,
            language=language,
            constraints=constraints,
            user_preferences_block=prefs_block,
            api_key=api_key_resolved,
        )
        # Echo applied preferences for transparency in the canvas UI.
        canvas["applied_preferences"] = applied_prefs
    except Exception as exc:  # noqa: BLE001
        # Never 500 the composer — return a clear empty canvas + reason.
        logger.exception("compose-outfit failed: %s", exc)
        return {
            "canvas": {
                "canvas_id": "",
                "schema_version": 1,
                "brief": text or "",
                "language": language,
                "summary": (
                    "Sorry — couldn't compose an outfit just now. Please try again."
                ),
                "slots": [],
                "candidates": [],
                "rejected": [],
                "marketplace_suggestions": [],
                "professional_suggestion": None,
                "model_used": None,
                "latency_ms": {},
            },
            "error": str(exc)[:200],
        }

    # Persist as an assistant message inside the user's stylist session.
    try:
        if session_id:
            session = await get_session(session_id, user_id=user["id"])
            if not session:
                session = await get_or_create_active_session(user["id"])
        else:
            session = await get_or_create_active_session(user["id"])
        await append_message(
            session_id=session["id"],
            role="user",
            input_modality="image+text" if image_bytes_list else "text",
            transcript=text or "(compose outfit)",
            image_refs=[],
            context={"compose": True, "image_count": len(image_bytes_list)},
        )
        await append_message(
            session_id=session["id"],
            role="assistant",
            input_modality="tool_result",
            transcript=canvas.get("summary"),
            image_refs=[],
            context={},
            assistant_payload={"outfit_canvas": canvas},
        )
        # Generate session title if it doesn't have one
        if session and not session.get("title") and (text or "").strip():
            try:
                title = await generate_session_title(
                    text.strip(),
                    language=language,
                    api_key=api_key_resolved
                )
                if title:
                    await update_session(session["id"], user["id"], title=title)
                    session["title"] = title
            except Exception as exc:  # noqa: BLE001
                logger.warning("Title generation failed for composer session %s: %s", session["id"], exc)

        canvas_session_id = session["id"]
    except Exception as exc:  # noqa: BLE001
        logger.warning("compose-outfit persistence skipped: %s", repr(exc)[:200])
        canvas_session_id = None

    return {"canvas": canvas, "session_id": canvas_session_id}


from pydantic import BaseModel
import uuid

class PlannerScoutPayload(BaseModel):
    lat: float | None = None
    lng: float | None = None
    dress_code: str | None = None
    tag: str | None = None
    include_calendar: bool = False

@router.post("/planner-scout")
async def planner_scout_endpoint(
    payload: PlannerScoutPayload,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    from app.db.database import get_db
    db = get_db()
    
    # 1. Billing check & deduction
    from app.services.billing_service import deduct_user_credits
    if not await deduct_user_credits(db, user, cost=1):
        raise HTTPException(status_code=402, detail="Insufficient credits or quota limit reached")

    # 2. Weather fetching (soft-fail)
    from app.services.weather_service import weather_service
    weather_summary = "Weather information unavailable."
    weather_ctx = None
    lat = payload.lat
    lng = payload.lng
    if lat is None or lng is None:
        home = user.get("home_location") or {}
        lat = home.get("lat")
        lng = home.get("lng")
    
    if lat is not None and lng is not None and weather_service is not None:
        try:
            weather_ctx = await weather_service.fetch(
                float(lat),
                float(lng),
                lang=(user.get("preferred_language") or "en"),
            )
            if weather_ctx:
                parts = [
                    f"{weather_ctx.get('temp_c')}°C",
                    weather_ctx.get("description") or weather_ctx.get("condition") or "",
                    weather_ctx.get("city") or "",
                ]
                weather_summary = " · ".join(p for p in parts if p)
        except Exception as exc:
            logger.warning("Planner weather fetch failed: %s", exc)

    # 3. Calendar events (soft-fail)
    calendar_events = []
    if payload.include_calendar:
        try:
            from app.services.calendar_service import calendar_service
            calendar_events = await calendar_service.get_events_for_user(user, hours_ahead=24)
        except Exception as exc:
            logger.warning("Planner calendar fetch failed: %s", exc)

    # 4. Retrieve closet items
    cursor = db.closet_items.find({
        "user_id": user["id"],
        "group_role": {"$ne": "member"},  # only host garments
    })
    garments = []
    async for doc in cursor:
        garments.append(doc)

    # Hydrate group members if they are part of a set
    group_ids = [r["group_id"] for r in garments if r.get("group_id")]
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
            members_by_group[m["group_id"]].append(m)
            
        def norm_category(cat):
            s = str(cat or "").strip().lower().replace(" ", "_")
            if s in ("top", "tops", "shirt", "t-shirt", "t_shirt", "polo", "sweater", "blouse", "outerwear", "full_body", "jacket", "coat"): return "top"
            if s in ("bottom", "bottoms", "pants", "shorts", "jeans", "skirt", "trousers"): return "bottom"
            if s in ("footwear", "shoes", "sneakers", "boots", "sandals", "shoe"): return "footwear"
            if s in ("dress", "dresses", "jumpsuit", "suit", "full_body_suit"): return "dress"
            if s in ("accessory", "accessories"): return "accessories"
            return s
            
        final_garments = []
        for g in garments:
            final_garments.append(g)
            g_id = g.get("group_id")
            if g_id and g_id in members_by_group:
                g_members = members_by_group[g_id]
                all_cats = {norm_category(g.get("category")), *(norm_category(m.get("category")) for m in g_members)}
                if len(all_cats) > 1:
                    final_garments.extend(g_members)
        garments = final_garments

    filtered = []
    for g in garments:
        if payload.dress_code and payload.dress_code != "all":
            if g.get("dress_code") != payload.dress_code:
                continue
        if payload.tag:
            g_tags = g.get("tags") or []
            if payload.tag not in g_tags:
                continue
        filtered.append(g)

    if not filtered:
        raise HTTPException(status_code=400, detail="No matching garments found in your closet for these filters.")

    tops = [g for g in filtered if norm_category(g.get("category")) in ("top", "dress")]
    bottoms = [g for g in filtered if norm_category(g.get("category")) == "bottom"]
    shoes = [g for g in filtered if norm_category(g.get("category")) == "footwear"]

    if not tops:
        tops = [g for g in garments if norm_category(g.get("category")) in ("top", "dress")]
    if not bottoms:
        bottoms = [g for g in garments if norm_category(g.get("category")) == "bottom"]
    if not shoes:
        shoes = [g for g in garments if norm_category(g.get("category")) == "footwear"]

    if not tops or not bottoms or not shoes:
        raise HTTPException(status_code=400, detail="Ensure your closet has at least one Top/Outerwear, one Bottom, and one pair of shoes.")

    def slim(lst):
        return [
            {
                "id": g["id"],
                "title": g.get("title") or g.get("name") or "Garment",
                "color": g.get("color"),
                "colors": g.get("colors"),
                "pattern": g.get("pattern"),
                "brand": g.get("brand"),
                "dress_code": g.get("dress_code"),
            }
            for g in lst
        ]

    # Resolve user's API key and model
    from app.services.auth import resolve_user_gemini_api_key, resolve_user_gemini_model
    api_key_resolved = resolve_user_gemini_api_key(user)
    user_model = resolve_user_gemini_model(user)

    if not api_key_resolved:
        raise HTTPException(
            status_code=400,
            detail="A valid Google Gemini API key is required. Please set your key in Profile -> AI Configuration.",
        )

    prompt = (
        f"You are the AI Stylist for DressApp.\n"
        f"Select EXACTLY one Top/Outerwear, one Bottom, and one pair of Footwear from the candidates below to compose a perfectly coordinated look.\n\n"
        f"Current Weather: {weather_summary}\n"
        f"Today's Calendar Events: {calendar_events}\n"
        f"Constraints:\n"
        f"- Target Style/Dress Code: {payload.dress_code or 'any'}\n"
        f"- Target Tag: {payload.tag or 'any'}\n"
        f"- Honor the weather, calendar events, cultural conventions, and modest/religious appropriateness where applicable.\n\n"
        f"Top Candidates:\n{slim(tops)[:40]}\n\n"
        f"Bottom Candidates:\n{slim(bottoms)[:40]}\n\n"
        f"Footwear Candidates:\n{slim(shoes)[:40]}\n\n"
        f"Output MUST be in JSON matching this schema:\n"
        f"{{\n"
        f"  \"top_id\": string,\n"
        f"  \"bottom_id\": string,\n"
        f"  \"shoes_id\": string,\n"
        f"  \"why\": string // styling advice and rationale in 1-2 sentences\n"
        f"}}"
    )

    from app.services.gemini_stylist import GeminiStylistService, gemini_stylist_service
    svc = GeminiStylistService(api_key=api_key_resolved, model=user_model) if api_key_resolved else gemini_stylist_service
    if svc is None:
        raise RuntimeError("Stylist service unavailable")

    res_json = await svc.advise(
        session_id=f"planner-scout-{uuid.uuid4().hex[:8]}",
        user_text=prompt,
        image_base64=None,
        user_profile=user,
    )

    updated_user = await db.users.find_one({"id": user["id"]})
    current_credits = (updated_user.get("ai_configuration") or {}).get("current_credits", 0)

    return {
        "top_id": res_json.get("top_id"),
        "bottom_id": res_json.get("bottom_id"),
        "shoes_id": res_json.get("shoes_id"),
        "why": res_json.get("why"),
        "weather": weather_ctx,
        "weather_summary": weather_summary,
        "events": calendar_events,
        "credits_left": current_credits,
    }
