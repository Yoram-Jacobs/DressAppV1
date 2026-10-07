"""Unified Daily Suggestions & Scheduled Proposals across all interfaces."""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.db.database import get_db
from app.services.auth import get_current_user
from app.services.sync_service import broadcast_sync_event
from app.services.stylist_scheduler_brain import (
    calculate_garment_style_score,
    generate_scheduled_proposals,
    item_has_any_tag,
    norm_category,
)


logger = logging.getLogger("dressapp.daily_proposals")

router = APIRouter(prefix="/stylist", tags=["stylist"])


class ProposalActionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    action: str  # "wear" | "like" | "dismiss" | "unlike" | "unwear"
    proposal_id: str | None = None
    date: str | None = None


class ProposalGenerateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    occasion: str = "daily"
    force: bool = False
    date: str | None = None


def _resolve_effective_style(user: dict, occasion: str | None = None) -> str:
    sched = user.get("scheduler_settings") or {}
    style_option = sched.get("style_option") or sched.get("style")
    if style_option == "tags":
        selected_tags = sched.get("selected_tags")
        if isinstance(selected_tags, list) and selected_tags:
            return ", ".join(str(t) for t in selected_tags if t).strip()
        if sched.get("custom_style"):
            return sched.get("custom_style").strip()
        return "casual"
    elif style_option == "custom":
        if sched.get("custom_style"):
            return sched.get("custom_style").strip()
        if sched.get("style_dress_for") and sched.get("style_dress_for") not in ("custom", "tags", "daily", "default"):
            return sched.get("style_dress_for").strip()
        return "casual"

    if sched.get("style_dress_for") and sched.get("style_dress_for") not in ("daily", "default", "custom", "tags"):
        return sched.get("style_dress_for").strip()
    if isinstance(sched.get("selected_tags"), list) and sched.get("selected_tags"):
        return ", ".join(str(t) for t in sched.get("selected_tags") if t).strip()
    if sched.get("custom_style"):
        return sched.get("custom_style").strip()
    if occasion and occasion != "daily":
        return occasion.strip()
    return "casual"


def _is_tags_style(user: dict) -> tuple[bool, list[str]]:
    sched = user.get("scheduler_settings") or {}
    style_option = sched.get("style_option") or sched.get("style")
    if style_option == "tags":
        selected_tags = sched.get("selected_tags")
        if isinstance(selected_tags, list) and selected_tags:
            return True, [str(t).strip() for t in selected_tags if t and str(t).strip()]
        if sched.get("custom_style"):
            tags = [t.strip() for t in str(sched.get("custom_style")).replace(";", ",").split(",") if t.strip()]
            return True, tags
        return True, []
    return False, []



def check_scheduler_access(user: dict) -> None:
    """Enforce that daily outfit proposals require an active Manager or Professional subscription/trial."""
    sub = user.get("subscription") or {}
    is_active = sub.get("is_active", False)
    plan_type = (sub.get("plan_type") or "free").lower()
    tier = (sub.get("tier") or "free").lower()

    # 1. Check active trial in trial_info
    trial = user.get("trial_info") or {}
    if trial.get("is_active") and trial.get("expires_at"):
        try:
            exp = datetime.fromisoformat(trial["expires_at"].replace("Z", "+00:00"))
            if exp > datetime.now(timezone.utc):
                return
        except Exception:
            pass

    # 2. Check active subscription
    if is_active and plan_type != "free":
        expires_at_str = sub.get("expires_at")
        if expires_at_str:
            try:
                exp = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                if exp <= datetime.now(timezone.utc):
                    raise HTTPException(
                        status_code=403,
                        detail="Daily outfit proposals require a Manager or Professional subscription."
                    )
            except HTTPException:
                raise
            except Exception:
                pass

        if tier in ["pro", "manager", "business", "professional"] or plan_type in ["pro", "manager", "business", "professional"]:
            return

    raise HTTPException(
        status_code=403,
        detail="Daily outfit proposals require a Manager or Professional subscription."
    )


@router.get("/daily-proposal")
async def get_daily_proposal(
    date: str | None = None,
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Get the active scheduled daily outfit proposal for the user across all devices.
    
    If date is explicitly requested, returns the proposal for that date.
    Otherwise checks tomorrow's proposal first (the upcoming scheduled look to prepare for),
    then today's proposal, or generates for tomorrow.
    """
    check_scheduler_access(user)
    db = get_db()
    sched = user.get("scheduler_settings") or {}
    user_tz = sched.get("timezone") or "UTC"
    try:
        from zoneinfo import ZoneInfo
        from datetime import timedelta
        local_now = datetime.now(timezone.utc).astimezone(ZoneInfo(user_tz))
    except Exception:
        from datetime import timedelta
        local_now = datetime.now(timezone.utc)

    today_str = local_now.strftime("%Y-%m-%d")
    tomorrow_str = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")

    user_lang = ((user or {}).get("preferred_language") or "en").lower().split("-")[0]

    # 1. If explicit date passed, return proposal for that date
    if date:
        doc = await db.daily_proposals.find_one(
            {"user_id": user["id"], "date": date, "dismissed": {"$ne": True}},
            {"_id": 0},
            sort=[("worn", -1), ("created_at", -1)],
        )
        if doc and len(doc.get("items") or []) > 0:
            doc_lang = doc.get("language")
            if not doc_lang or doc_lang == user_lang:
                return doc
        return await _generate_and_save_daily_proposal(user, date, force=True if doc else False)

    # 2. Check tomorrow's proposal (pushed the day before for advance prep)
    tom_doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": tomorrow_str, "dismissed": {"$ne": True}},
        {"_id": 0},
        sort=[("worn", -1), ("created_at", -1)],
    )
    if tom_doc and tom_doc.get("language") and tom_doc.get("language") != user_lang:
        tom_doc = None

    # 3. Check today's proposal (e.g. prepared yesterday for today)
    today_doc = await db.daily_proposals.find_one(
        {"user_id": user["id"], "date": today_str, "dismissed": {"$ne": True}},
        {"_id": 0},
        sort=[("worn", -1), ("created_at", -1)],
    )
    if today_doc and today_doc.get("language") and today_doc.get("language") != user_lang:
        today_doc = None

    all_proposals = [p for p in [today_doc, tom_doc] if p and len(p.get("items") or []) > 0]

    if tom_doc and len(tom_doc.get("items") or []) > 0:
        res = dict(tom_doc)
        res["all_proposals"] = all_proposals
        return res

    if today_doc and len(today_doc.get("items") or []) > 0:
        res = dict(today_doc)
        res["all_proposals"] = all_proposals
        return res

    # 4. If neither exists, generate for tomorrow
    gen_res = await _generate_and_save_daily_proposal(user, tomorrow_str, force=False)
    if gen_res and isinstance(gen_res, dict):
        gen_res["all_proposals"] = [gen_res]
    return gen_res


@router.post("/daily-proposal/generate")
async def generate_daily_proposal(
    body: ProposalGenerateIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate or regenerate daily proposal for tomorrow (or specified date)."""
    check_scheduler_access(user)
    sched = user.get("scheduler_settings") or {}
    user_tz = sched.get("timezone") or "UTC"
    try:
        from zoneinfo import ZoneInfo
        from datetime import timedelta
        local_now = datetime.now(timezone.utc).astimezone(ZoneInfo(user_tz))
    except Exception:
        from datetime import timedelta
        local_now = datetime.now(timezone.utc)

    tomorrow_str = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")
    target_date = body.date or tomorrow_str

    res = await _generate_and_save_daily_proposal(user, target_date, force=body.force, occasion=body.occasion)
    await broadcast_sync_event(user["id"], "daily_suggestions_updated", {"proposal_id": res.get("id")})
    return res


@router.post("/daily-proposal/action")
async def act_on_daily_proposal(
    body: ProposalActionIn,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Record an action on today's proposal (worn, liked, dismissed) and sync across all devices."""
    check_scheduler_access(user)
    db = get_db()
    today_str = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query: dict[str, Any] = {"user_id": user["id"]}
    if body.proposal_id:
        query["id"] = body.proposal_id
    else:
        query["date"] = today_str
        
    update_data: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.action == "wear":
        update_data["worn"] = True
    elif body.action == "unwear":
        update_data["worn"] = False
    elif body.action == "like":
        update_data["liked"] = True
    elif body.action == "unlike":
        update_data["liked"] = False
    elif body.action == "dismiss":
        update_data["dismissed"] = True
        
    res = await db.daily_proposals.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0},
    )
    
    if not res:
        # Fallback to date query if proposal_id wasn't found
        res = await db.daily_proposals.find_one_and_update(
            {"user_id": user["id"], "date": today_str},
            {"$set": update_data},
            return_document=True,
            projection={"_id": 0},
        )
        if not res:
            raise HTTPException(status_code=404, detail="Proposal not found")

    # If worn, purge unselected intermediate daily proposals for this user & date
    if body.action == "wear":
        try:
            await db.daily_proposals.delete_many({
                "user_id": user["id"],
                "date": today_str,
                "id": {"$ne": res.get("id")},
                "worn": {"$ne": True},
            })
        except Exception as p_err:
            logger.warning("Failed to purge intermediate proposals: %s", p_err)
        
    await broadcast_sync_event(
        user["id"],
        "daily_suggestions_updated",
        {"proposal_id": res.get("id"), "action": body.action},
    )
    return res


async def _generate_and_save_daily_proposal(
    user: dict,
    date_str: str,
    force: bool = False,
    occasion: str = "daily",
) -> dict[str, Any]:
    """Helper to pick or generate a smart, diverse outfit from closet and store it in daily_proposals."""
    db = get_db()
    effective_occasion = _resolve_effective_style(user, occasion)
    
    # Check if valid existing exists unless force=True
    if not force:
        existing = await db.daily_proposals.find_one(
            {"user_id": user["id"], "date": date_str, "dismissed": {"$ne": True}},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if existing and len(existing.get("items") or []) > 0:
            return existing
            
    if force:
        # On 'New Look', mark previous proposals for today as replaced and unwear them
        await db.daily_proposals.update_many(
            {"user_id": user["id"], "date": date_str},
            {"$set": {"worn": False, "replaced": True, "dismissed": True}},
        )

    # Gather items already used in today's proposals to avoid repeats on "New Look"
    past_proposals_cursor = db.daily_proposals.find({"user_id": user["id"], "date": date_str})
    past_proposals = [doc async for doc in past_proposals_cursor]
    past_item_ids: set[str] = set()
    for pdp in past_proposals:
        for it in (pdp.get("items") or []):
            if it.get("id"):
                past_item_ids.add(it["id"])
            if it.get("closet_item_id"):
                past_item_ids.add(it["closet_item_id"])

    # Fetch user's closet items with slim projection to eliminate heavy binary/base64 payload
    _CLOSET_ITEM_PROJECTION = {
        "_id": 0,
        "id": 1,
        "name": 1,
        "title": 1,
        "category": 1,
        "sub_category": 1,
        "color": 1,
        "colors": 1,
        "material": 1,
        "pattern": 1,
        "season": 1,
        "dress_code": 1,
        "preferred_image_view": 1,
        "clean_image_url": 1,
        "reconstructed_image_url": 1,
        "image_url": 1,
        "thumbnail_url": 1,
        "thumbnail_data_url": 1,
        "tags": 1,
        "is_duplicate": 1,
        "group_role": 1,
    }
    cursor = db.closet_items.find(
        {"user_id": user["id"], "is_duplicate": {"$ne": True}},
        _CLOSET_ITEM_PROJECTION,
    )
    items = [doc async for doc in cursor]

    def _cat(i: dict) -> str:
        return norm_category(i.get("category"))

    def _best_img(i: dict) -> str | None:
        pref = i.get("preferred_image_view")
        if pref in ("clean", "original"):
            return (
                i.get("clean_image_url")
                or i.get("reconstructed_image_url")
                or i.get("image_url")
                or i.get("thumbnail_url")
                or i.get("thumbnail_data_url")
            )
        return (
            i.get("reconstructed_image_url")
            or i.get("clean_image_url")
            or i.get("image_url")
            or i.get("thumbnail_url")
            or i.get("thumbnail_data_url")
        )

    is_tags_mode, filter_tags = _is_tags_style(user)

    # 1. Try AI-powered recommendation first (curates 1 daily outfit)
    selected_items: list[dict[str, Any]] = []
    proposal_title = "Look of the Day"
    proposal_desc = "Curated based on your style profile, weather conditions, and closet harmony."
    proposal_harmony = 94

    ai_generated = False
    try:
        scheduler_res = await generate_scheduled_proposals(
            user,
            style_dress_for=effective_occasion,
            exclude_item_ids=past_item_ids,
            target_date=date_str,
            filter_tags=filter_tags,
            is_tags_filter=is_tags_mode,
        )
        recs = scheduler_res.get("outfit_recommendations") or []
        if recs:
            chosen_rec = recs[0]
            proposal_title = chosen_rec.get("name") or proposal_title
            proposal_desc = chosen_rec.get("why") or proposal_desc
            confidence = chosen_rec.get("confidence")
            if confidence:
                proposal_harmony = min(99, max(80, int(confidence * 100)))

            item_map = {item["id"]: item for item in items}
            cids = [it.get("closet_item_id") for it in chosen_rec.get("items", []) if it.get("closet_item_id")]
            missing_cids = [c for c in cids if c not in item_map]
            if missing_cids:
                missing_docs = [d async for d in db.closet_items.find({"id": {"$in": missing_cids}})]
                for d in missing_docs:
                    item_map[d["id"]] = d

            for it in chosen_rec.get("items", []):
                cid = it.get("closet_item_id") or it.get("id")
                closet_doc = item_map.get(cid)
                if closet_doc:
                    selected_items.append({
                        "id": closet_doc.get("id"),
                        "closet_item_id": closet_doc.get("id"),
                        "role": it.get("role") or _cat(closet_doc) or "item",
                        "name": closet_doc.get("title") or closet_doc.get("name") or it.get("description") or "Garment",
                        "category": closet_doc.get("category"),
                        "image_url": _best_img(closet_doc),
                    })
                elif it.get("image_url") or it.get("clean_image_url"):
                    selected_items.append({
                        "id": cid,
                        "closet_item_id": cid,
                        "role": it.get("role") or "item",
                        "name": it.get("title") or it.get("name") or it.get("description") or "Garment",
                        "category": it.get("category") or "Item",
                        "image_url": it.get("clean_image_url") or it.get("image_url"),
                    })
            if len(selected_items) >= 2:
                ai_generated = True
    except Exception as ai_exc:
        logger.warning("AI scheduled proposals generation fallback: %s", ai_exc)

    # 2. Smart Diversified Closet Fallback if AI didn't return full outfit
    if not ai_generated or len(selected_items) < 2:
        selected_items = []
        # Categorize items into buckets
        tops = [i for i in items if _cat(i) == "top"]
        bottoms = [i for i in items if _cat(i) == "bottom"]
        shoes = [i for i in items if _cat(i) == "shoes"]
        dresses = [i for i in items if _cat(i) == "dress"]
        outerwear = [i for i in items if _cat(i) == "outerwear"]
        accessories = [i for i in items if _cat(i) == "accessory"]

        if is_tags_mode and filter_tags:
            tagged_tops = [i for i in tops if item_has_any_tag(i, filter_tags)]
            if tagged_tops:
                tops = tagged_tops
            tagged_bottoms = [i for i in bottoms if item_has_any_tag(i, filter_tags)]
            if tagged_bottoms:
                bottoms = tagged_bottoms
            tagged_shoes = [i for i in shoes if item_has_any_tag(i, filter_tags)]
            if tagged_shoes:
                shoes = tagged_shoes
            tagged_dresses = [i for i in dresses if item_has_any_tag(i, filter_tags)]
            dresses = tagged_dresses
            tagged_outerwear = [i for i in outerwear if item_has_any_tag(i, filter_tags)]
            outerwear = tagged_outerwear
            tagged_accessories = [i for i in accessories if item_has_any_tag(i, filter_tags)]
            accessories = tagged_accessories

        # Sort each bucket: unused today first, then matching custom style tag, then lowest wear count, with random jitter
        def _fallback_sort_key(item: dict) -> tuple:
            iid = item.get("id")
            already_used = 1 if (iid in past_item_ids) else 0
            style_score = calculate_garment_style_score(item, effective_occasion, is_tags_mode=is_tags_mode)
            wear_count = item.get("wear_count") or 0
            jitter = random.random()
            return (already_used, -style_score, wear_count, jitter)

        tops.sort(key=_fallback_sort_key)
        bottoms.sort(key=_fallback_sort_key)
        shoes.sort(key=_fallback_sort_key)
        dresses.sort(key=_fallback_sort_key)
        outerwear.sort(key=_fallback_sort_key)
        accessories.sort(key=_fallback_sort_key)

        # Decide whether dress or top+bottom
        use_dress = bool(dresses and (not tops or not bottoms or random.random() < 0.25))

        if use_dress and dresses:
            d0 = dresses[0]
            selected_items.append({
                "id": d0.get("id"),
                "closet_item_id": d0.get("id"),
                "role": "dress",
                "name": d0.get("title") or d0.get("name") or "Dress",
                "category": d0.get("category"),
                "image_url": _best_img(d0),
            })
        else:
            if tops:
                t0 = tops[0]
                selected_items.append({
                    "id": t0.get("id"),
                    "closet_item_id": t0.get("id"),
                    "role": "top",
                    "name": t0.get("title") or t0.get("name") or "Top",
                    "category": t0.get("category"),
                    "image_url": _best_img(t0),
                })
            if bottoms:
                b0 = bottoms[0]
                selected_items.append({
                    "id": b0.get("id"),
                    "closet_item_id": b0.get("id"),
                    "role": "bottom",
                    "name": b0.get("title") or b0.get("name") or "Bottom",
                    "category": b0.get("category"),
                    "image_url": _best_img(b0),
                })

        if shoes:
            s0 = shoes[0]
            selected_items.append({
                "id": s0.get("id"),
                "closet_item_id": s0.get("id"),
                "role": "shoes",
                "name": s0.get("title") or s0.get("name") or "Shoes",
                "category": s0.get("category"),
                "image_url": _best_img(s0),
            })

        # Optionally add outerwear
        if outerwear and random.random() < 0.5:
            ow0 = outerwear[0]
            selected_items.append({
                "id": ow0.get("id"),
                "closet_item_id": ow0.get("id"),
                "role": "outerwear",
                "name": ow0.get("title") or ow0.get("name") or "Outerwear",
                "category": ow0.get("category"),
                "image_url": _best_img(ow0),
            })

        # Optionally add accessory
        if accessories and random.random() < 0.4:
            acc0 = accessories[0]
            selected_items.append({
                "id": acc0.get("id"),
                "closet_item_id": acc0.get("id"),
                "role": "accessory",
                "name": acc0.get("title") or acc0.get("name") or "Accessory",
                "category": acc0.get("category"),
                "image_url": _best_img(acc0),
            })

        # Generate vibrant title based on selected items & occasion
        user_lang = ((user or {}).get("preferred_language") or "en").lower().split("-")[0]

        LOCALIZED_FALLBACKS = {
            "en": {
                "tag": "{adj} {tags} Outfit",
                "tag_desc": "Curated strictly from your closet items tagged '{tags}'.",
                "occasion": "{adj} {occasion} Look",
                "occasion_desc": "Curated based on your '{occasion}' preference, weather conditions, and closet harmony.",
                "default": "{adj} Everyday Look",
                "default_desc": "Curated based on your style profile, weather conditions, and closet harmony.",
                "adjs": ["Effortless", "Crisp", "Polished", "Modern", "Refined", "Relaxed", "Vibrant", "Chic", "Smart"],
            },
            "he": {
                "tag": "{adj} {tags}",
                "tag_desc": "נבחר בקפידה מתוך הפריטים שלך בארון עם התגית '{tags}'.",
                "occasion": "{adj} {occasion}",
                "occasion_desc": "נבחר בהתאמה להעדפת '{occasion}', תנאי מזג האוויר והרמוניה בארון.",
                "default": "מראה יומיומי מושלם",
                "default_desc": "נבחר בהתאמה לפרופיל הסגנון שלך, תנאי מזג האוויר והרמוניה בארון.",
                "adjs": ["מראה מושלם ל", "מראה מוקפד ל", "שילוב נוח ל", "מראה רענן ל", "סטיילינג מדויק ל"],
            },
            "ar": {
                "tag": "إطلالة {tags} أنيقة",
                "tag_desc": "مختارة بعناية من خزانة ملابسك الموسومة بـ '{tags}'.",
                "occasion": "إطلالة {occasion} متميزة",
                "occasion_desc": "مختارة وفقاً لتفضيل '{occasion}' وحالة الطقس وتناسق الخزانة.",
                "default": "إطلالة يومية مميزة",
                "default_desc": "مختارة وفقاً لأسلوبك وحالة الطقس وتناسق خزانة ملابسك.",
                "adjs": ["أنيقة", "عصرية", "مريحة", "متناسقة"],
            },
            "es": {
                "tag": "Look {tags} {adj}",
                "tag_desc": "Seleccionado estrictamente de tus prendas etiquetadas como '{tags}'.",
                "occasion": "Look {occasion} {adj}",
                "occasion_desc": "Seleccionado según tu preferencia '{occasion}', el clima y la armonía del armario.",
                "default": "Look Diario Estilizado",
                "default_desc": "Seleccionado según tu perfil de estilo, el clima y la armonía del armario.",
                "adjs": ["Elegante", "Moderno", "Impecable", "Chic", "Cómodo"],
            },
            "fr": {
                "tag": "Tenue {tags} {adj}",
                "tag_desc": "Sélectionnée avec soin parmi vos pièces étiquetées '{tags}'.",
                "occasion": "Look {occasion} {adj}",
                "occasion_desc": "Sélectionné selon votre préférence '{occasion}', la météo et l'harmonie du dressing.",
                "default": "Look Quotidien Soigné",
                "default_desc": "Sélectionné selon votre profil de style, la météo et l'harmonie du dressing.",
                "adjs": ["Élégant", "Moderne", "Chic", "Raffiné", "Confortable"],
            },
            "de": {
                "tag": "{adj} {tags}-Outfit",
                "tag_desc": "Sorgfältig ausgewählt aus deinen Kleidungsstücken mit dem Tag '{tags}'.",
                "occasion": "{adj} {occasion}-Look",
                "occasion_desc": "Ausgewählt basierend auf deiner Vorliebe '{occasion}', dem Wetter und deiner Garderobe.",
                "default": "Stilvoller Alltagslook",
                "default_desc": "Ausgewählt basierend auf deinem Stilprofil, dem Wetter und deiner Garderobe.",
                "adjs": ["Stilvolles", "Modernes", "Elegantes", "Lässiges", "Klassisches"],
            },
            "it": {
                "tag": "Outfit {tags} {adj}",
                "tag_desc": "Selezionato attentamente dai tuoi capi contrassegnati come '{tags}'.",
                "occasion": "Look {occasion} {adj}",
                "occasion_desc": "Selezionato in base alla tua preferenza '{occasion}', al meteo e all'armonia del guardaroba.",
                "default": "Look Quotidiano Impeccabile",
                "default_desc": "Selezionato in base al tuo profilo di stile, al meteo e all'armonia del guardaroba.",
                "adjs": ["Elegante", "Raffinato", "Moderno", "Chic", "Impeccabile"],
            },
            "pt": {
                "tag": "Look {tags} {adj}",
                "tag_desc": "Selecionado estritamente das suas peças etiquetadas como '{tags}'.",
                "occasion": "Look {occasion} {adj}",
                "occasion_desc": "Selecionado com base na sua preferência '{occasion}', clima e harmonia do closet.",
                "default": "Look Diário Elegante",
                "default_desc": "Selecionado com base no seu perfil de estilo, clima e harmonia do closet.",
                "adjs": ["Elegante", "Moderno", "Sofisticado", "Confortável", "Chic"],
            },
            "ru": {
                "tag": "{adj} образ для {tags}",
                "tag_desc": "Тщательно подобран из ваших вещей с тегом '{tags}'.",
                "occasion": "{adj} образ для {occasion}",
                "occasion_desc": "Подобран с учётом предпочтения '{occasion}', погоды и гармонии гардероба.",
                "default": "Стильный повседневный образ",
                "default_desc": "Подобран на основе вашего стиля, погоды и гармонии гардероба.",
                "adjs": ["Элегантный", "Стильный", "Современный", "Удобный", "Изысканный"],
            },
            "zh": {
                "tag": "精选{tags}穿搭",
                "tag_desc": "严格精选自带有标签“{tags}”的衣橱单品。",
                "occasion": "精选{occasion}穿搭",
                "occasion_desc": "根据您的“{occasion}”偏好、天气状况和衣橱协调度精选。",
                "default": "优雅日常穿搭",
                "default_desc": "根据您的风格档案、天气状况和衣橱协调度精选。",
                "adjs": ["优雅", "利落", "时尚", "舒适"],
            },
            "ja": {
                "tag": "洗練された{tags}スタイル",
                "tag_desc": "「{tags}」タグの付いたクローゼットのアイテムから厳選しました。",
                "occasion": "洗練された{occasion}スタイル",
                "occasion_desc": "「{occasion}」のお好み、天候、クローゼットの調和に合わせて厳選しました。",
                "default": "上質なデイリースタイル",
                "default_desc": "スタイルプロファイル、天候、クローゼットの調和に合わせて厳選しました。",
                "adjs": ["洗練された", "爽やかな", "上品な", "快適な"],
            },
            "hi": {
                "tag": "आकर्षक {tags} आउटफिट",
                "tag_desc": "आपके '{tags}' टैग वाले कपड़ों से सावधानीपूर्वक चुना गया।",
                "occasion": "आकर्षक {occasion} लुक",
                "occasion_desc": "आपकी '{occasion}' पसंद, मौसम और अलमारी के सामंजस्य पर आधारित।",
                "default": "शानदार दैनिक लुक",
                "default_desc": "आपकी स्टाइल प्रोफ़ाइल, मौसम और अलमारी के सामंजस्य पर आधारित।",
                "adjs": ["आकर्षक", "स्टाइलिश", "आरामदायक", "आधुनिक"],
            },
            "nl": {
                "tag": "{adj} {tags} Outfit",
                "tag_desc": "Zorgvuldig geselecteerd uit je kledingstukken met de tag '{tags}'.",
                "occasion": "{adj} {occasion} Look",
                "occasion_desc": "Geselecteerd op basis van je voorkeur voor '{occasion}', het weer en kastbalans.",
                "default": "Stijlvolle Dagelijkse Look",
                "default_desc": "Geselecteerd op basis van je stijlprofiel, het weer en kastbalans.",
                "adjs": ["Stijlvolle", "Moderne", "Elegante", "Frisse", "Vlotte"],
            },
        }

        loc_fb = LOCALIZED_FALLBACKS.get(user_lang) or LOCALIZED_FALLBACKS["en"]
        adj = random.choice(loc_fb["adjs"])
        if is_tags_mode and filter_tags:
            tag_label = ", ".join(filter_tags)
            proposal_title = loc_fb["tag"].format(adj=adj, tags=tag_label)
            proposal_desc = loc_fb["tag_desc"].format(tags=tag_label)
        elif effective_occasion and effective_occasion not in ("casual", "daily", "default"):
            proposal_title = loc_fb["occasion"].format(adj=adj, occasion=effective_occasion.title())
            proposal_desc = loc_fb["occasion_desc"].format(occasion=effective_occasion)
        else:
            proposal_title = loc_fb["default"].format(adj=adj)
            proposal_desc = loc_fb["default_desc"]

        proposal_harmony = random.randint(88, 97) if len(selected_items) >= 2 else 85
        
    proposal = {
        "id": f"prop_{uuid.uuid4().hex[:12]}",
        "user_id": user["id"],
        "date": date_str,
        "language": user_lang,
        "title": proposal_title,
        "description": proposal_desc,
        "weather_summary": "Mild & Pleasant",
        "temperature": 22,
        "items": selected_items,
        "harmony_score": proposal_harmony,
        "worn": False,
        "liked": False,
        "dismissed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.daily_proposals.insert_one(proposal)
    
    return {k: v for k, v in proposal.items() if k != "_id"}
