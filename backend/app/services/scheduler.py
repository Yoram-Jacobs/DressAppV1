"""APScheduler boot — schedules the Trend-Scout agent and user styling notifications."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.db.database import get_db
from app.services.trend_scout import run_trend_scout
from app.services.push_service import send_push_notification
from app.services.stylist_scheduler_brain import generate_scheduled_proposals

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def _parse_hhmm(hhmm: str) -> tuple[int, int]:
    try:
        h_s, m_s = hhmm.split(":", 1)
        h, m = int(h_s), int(m_s)
        if 0 <= h < 24 and 0 <= m < 60:
            return h, m
    except Exception:  # noqa: BLE001
        pass
    logger.warning("Bad TREND_SCOUT_SCHEDULE_UTC=%s; defaulting to 07:00", hhmm)
    return 7, 0


async def _safe_run() -> None:
    try:
        result = await run_trend_scout()
        logger.info(
            "Trend-Scout daily run: generated=%d skipped=%d date=%s",
            len(result.get("generated") or []),
            len(result.get("skipped") or []),
            result.get("date"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Trend-Scout daily run failed: %s", exc)


def _generate_fallback_advice(closet_items: list[dict[str, Any]], style_dress_for: str) -> dict[str, Any]:
    by_cat: dict[str, list[dict[str, Any]]] = {}
    for it in closet_items:
        cat = (it.get("category") or "top").lower()
        if cat in {"shoe", "footwear", "sneaker", "boot", "heel", "shoes"}:
            c_key = "shoes"
        elif cat in {"shirt", "tshirt", "top", "blouse", "sweater", "knit", "polo"}:
            c_key = "top"
        elif cat in {"pants", "trousers", "jeans", "shorts", "skirt", "bottom"}:
            c_key = "bottom"
        elif cat == "dress":
            c_key = "dress"
        elif cat in {"jacket", "coat", "blazer", "outerwear"}:
            c_key = "outerwear"
        else:
            c_key = "accessory"
        by_cat.setdefault(c_key, []).append(it)

    recs = []

    # Outfit 1: top + bottom + shoes
    o1_items = []
    t_item = by_cat.get("top", [None])[0]
    b_item = by_cat.get("bottom", [None])[0]
    s_item = by_cat.get("shoes", [None])[0]
    if t_item:
        o1_items.append({"role": "top", "description": t_item.get("title", "Top"), "closet_item_id": t_item.get("id")})
    if b_item:
        o1_items.append({"role": "bottom", "description": b_item.get("title", "Bottom"), "closet_item_id": b_item.get("id")})
    if s_item:
        o1_items.append({"role": "shoes", "description": s_item.get("title", "Shoes"), "closet_item_id": s_item.get("id")})
    if o1_items:
        recs.append({
            "name": "Outfit 1",
            "items": o1_items,
            "why": f"A balanced daily outfit matching your preferred {style_dress_for} style.",
            "confidence": 0.85
        })

    # Outfit 2: dress + shoes / top + bottom + outerwear
    o2_items = []
    d_item = by_cat.get("dress", [None])[0]
    if d_item:
        o2_items.append({"role": "dress", "description": d_item.get("title", "Dress"), "closet_item_id": d_item.get("id")})
        s_item_2 = by_cat.get("shoes", [None])[-1] if len(by_cat.get("shoes", [])) > 1 else s_item
        if s_item_2:
            o2_items.append({"role": "shoes", "description": s_item_2.get("title", "Shoes"), "closet_item_id": s_item_2.get("id")})
    else:
        t_item_2 = by_cat.get("top", [None])[-1] if len(by_cat.get("top", [])) > 1 else t_item
        b_item_2 = by_cat.get("bottom", [None])[-1] if len(by_cat.get("bottom", [])) > 1 else b_item
        o_item = by_cat.get("outerwear", [None])[0]
        if t_item_2:
            o2_items.append({"role": "top", "description": t_item_2.get("title", "Top"), "closet_item_id": t_item_2.get("id")})
        if b_item_2:
            o2_items.append({"role": "bottom", "description": b_item_2.get("title", "Bottom"), "closet_item_id": b_item_2.get("id")})
        if o_item:
            o2_items.append({"role": "outerwear", "description": o_item.get("title", "Jacket"), "closet_item_id": o_item.get("id")})
        if s_item:
            o2_items.append({"role": "shoes", "description": s_item.get("title", "Shoes"), "closet_item_id": s_item.get("id")})
    if o2_items:
        recs.append({
            "name": "Outfit 2",
            "items": o2_items,
            "why": f"An alternative casual look selected to maximize your wardrobe rotation.",
            "confidence": 0.88
        })

    # Outfit 3: default fallback or another combo
    o3_items = []
    t_item_3 = by_cat.get("top", [None])[len(by_cat.get("top", [])) // 2] if len(by_cat.get("top", [])) > 2 else None
    b_item_3 = by_cat.get("bottom", [None])[len(by_cat.get("bottom", [])) // 2] if len(by_cat.get("bottom", [])) > 2 else None
    s_item_3 = by_cat.get("shoes", [None])[len(by_cat.get("shoes", [])) // 2] if len(by_cat.get("shoes", [])) > 2 else None
    if t_item_3:
        o3_items.append({"role": "top", "description": t_item_3.get("title", "Top"), "closet_item_id": t_item_3.get("id")})
    if b_item_3:
        o3_items.append({"role": "bottom", "description": b_item_3.get("title", "Bottom"), "closet_item_id": b_item_3.get("id")})
    if s_item_3:
        o3_items.append({"role": "shoes", "description": s_item_3.get("title", "Shoes"), "closet_item_id": s_item_3.get("id")})

    if not o3_items and closet_items:
        for it in closet_items[1:4]:
            o3_items.append({"role": "accessory", "description": it.get("title", "Item"), "closet_item_id": it.get("id")})

    if o3_items:
        recs.append({
            "name": "Outfit 3",
            "items": o3_items,
            "why": f"A coordinates-driven selection based on your preferred {style_dress_for}.",
            "confidence": 0.82
        })

    # If all recommendations are empty, use fallback static text items
    if not recs:
        recs = [{
            "name": "Outfit 1",
            "items": [
                {"role": "top", "description": "Classic Tee", "closet_item_id": None},
                {"role": "bottom", "description": "Comfort Jeans", "closet_item_id": None},
                {"role": "shoes", "description": "Casual Sneakers", "closet_item_id": None}
            ],
            "why": "Standard fallback option.",
            "confidence": 0.8
        }]

    return {
        "reasoning_summary": f"Here are outfit recommendations curated from your closet for: {style_dress_for}.",
        "outfit_recommendations": recs
    }


async def check_scheduler_triggers() -> None:
    """Scan user scheduler preferences and active outfits to trigger mock push notifications."""
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        current_time_str = now.strftime("%H:%M")
        current_day_str = now.strftime("%A").lower()

        cursor = db.users.find({}, {"_id": 0})
        async for user in cursor:
            # Check traveling suitcase status
            active_s = await db.suitcases.find_one({"user_id": user["id"], "status": {"$ne": "completed"}})
            is_traveling = False
            if active_s and active_s.get("status") == "active":
                try:
                    dep_dt = datetime.fromisoformat(active_s["departure_time"].replace("Z", "+00:00"))
                    ret_dt = datetime.fromisoformat(active_s["return_time"].replace("Z", "+00:00"))
                    if dep_dt.tzinfo is None:
                        dep_dt = dep_dt.replace(tzinfo=timezone.utc)
                    if ret_dt.tzinfo is None:
                        ret_dt = ret_dt.replace(tzinfo=timezone.utc)
                    if dep_dt <= now <= ret_dt:
                        is_traveling = True
                    elif now > ret_dt and active_s["status"] == "active":
                        # Auto-unpacking sequence
                        logger.info("Scheduler: Auto-unpacking suitcase for user=%s", user["id"])
                        
                        # Archive the completed trip
                        import uuid
                        archive_doc = {
                            "id": str(uuid.uuid4()),
                            "user_id": user["id"],
                            "destination": active_s.get("destinations") or active_s.get("destination") or "",
                            "departure_time": active_s.get("departure_time"),
                            "return_time": active_s.get("return_time"),
                            "purpose": active_s.get("purpose"),
                            "preferred_style": active_s.get("preferred_style"),
                            "notes": active_s.get("notes"),
                            "packing_list": active_s.get("packing_list"),
                            "outfits": active_s.get("outfits"),
                            "local_fashion_stores": active_s.get("local_fashion_stores") or [],
                            "missing_items": active_s.get("missing_items") or [],
                            "push_notification_sent": False,
                            "created_at": active_s.get("created_at") or now.isoformat(),
                            "updated_at": now.isoformat()
                        }
                        await db.suitcase_archives.insert_one(archive_doc)

                        await db.suitcases.update_one(
                            {"id": active_s["id"]},
                            {"$set": {"status": "completed", "updated_at": now.isoformat()}}
                        )
                        await db.closet_items.update_many(
                            {"user_id": user["id"], "in_suitcase": True},
                            {"$set": {"in_suitcase": False, "updated_at": now.isoformat()}}
                        )
                except Exception as ex:
                    logger.warning("Scheduler date check failed for suitcase: %s", ex)

            s_set = user.get("scheduler_settings") or {}
            tz_str = s_set.get("timezone")
            user_tz = timezone.utc
            if tz_str:
                try:
                    from zoneinfo import ZoneInfo
                    user_tz = ZoneInfo(tz_str)
                except Exception:
                    pass

            local_now = now.astimezone(user_tz)
            local_hour = local_now.hour
            local_minute = local_now.minute
            local_day_str = local_now.strftime("%A").lower()

            if is_traveling:
                # 20:00 local time: send next day's outfit recommendations from suitcase
                if local_hour == 20 and local_minute == 0:
                    tomorrow_str = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")
                    tomorrow_outfits = [o for o in active_s.get("outfits", []) if o.get("date") == tomorrow_str]
                    if tomorrow_outfits:
                        rec_lines = []
                        for o in tomorrow_outfits:
                            items_str = ", ".join(it.get("description") or it.get("title") or "item" for it in o.get("items", []) if it.get("status") != "missing")
                            rec_lines.append(f"• {o.get('outfit_name') or 'Outfit'}: {items_str}")
                        
                        body_text = f"Your outfit recommendation for tomorrow ({tomorrow_str}) is ready:\n" + "\n".join(rec_lines)
                        await send_push_notification(
                            user_id=user["id"],
                            title="Tomorrow's Travel Outfit 👕",
                            body=body_text
                        )
                # Ignore regular scheduler notifications while traveling
                continue

            if not s_set.get("enabled"):
                continue

            time_str = s_set.get("time") or "08:00"
            freq = s_set.get("frequency") or "everyday"
            weekday = s_set.get("weekday")

            try:
                uh, um = map(int, time_str.split(":", 1))
            except Exception:
                uh, um = 8, 0

            # Check for unpacked suitcases that need a laundry notification
            if local_hour == uh and local_minute == um:
                cursor_archives = db.suitcase_archives.find({"user_id": user["id"], "push_notification_sent": False})
                async for arch in cursor_archives:
                    ret_dt_str = arch.get("return_time")
                    if ret_dt_str:
                        try:
                            from datetime import timedelta
                            ret_dt = datetime.fromisoformat(ret_dt_str.replace("Z", "+00:00"))
                            if ret_dt.tzinfo is None:
                                ret_dt = ret_dt.replace(tzinfo=timezone.utc)
                            target_date = (ret_dt.astimezone(user_tz) + timedelta(days=1)).date()
                            if local_now.date() >= target_date:
                                await send_push_notification(
                                    user_id=user["id"],
                                    title="Welcome Back! ✈️",
                                    body="Don't forget to launder the garments from your suitcase soon to keep them fresh!"
                                )
                                await db.suitcase_archives.update_one({"id": arch["id"]}, {"$set": {"push_notification_sent": True}})
                        except Exception as e:
                            logger.warning("Error processing delayed notification for archive %s: %s", arch.get("id"), e)

            # Match hour and minute in local timezone if provided, else UTC
            if local_hour == uh and local_minute == um:
                should_notify = False
                if freq == "everyday":
                    should_notify = True
                elif freq == "on_weekday" and weekday and weekday.lower() == local_day_str:
                    should_notify = True
                elif freq == "every_other_day" and local_now.timetuple().tm_yday % 2 == 0:
                    should_notify = True
                elif freq == "twice_a_week" and local_day_str in ["monday", "thursday"]:
                    should_notify = True

                if should_notify:
                    style_dress_for = s_set.get("style_dress_for") or "casual/daily dress"
                    advice = None
                    try:
                        advice = await generate_scheduled_proposals(user, style_dress_for)
                        recs = advice.get("outfit_recommendations") or []
                        
                        rec_lines = []
                        for r in recs:
                            items_str = ", ".join(it.get("description") or it.get("title") or "item" for it in r.get("items") or [])
                            rec_lines.append(f"• {r.get('name') or 'Outfit'}: {items_str}")
                        
                        body_text = f"Proposals for {style_dress_for}:\n" + "\n".join(rec_lines)
                    except Exception as exc:
                        logger.warning("Failed to generate scheduled proposals in cron: %s", exc)
                        try:
                            from app.services.stylist_scheduler_brain import get_rotation_prioritized_closet
                            closet_items = await get_rotation_prioritized_closet(user["id"], limit=20)
                            advice = _generate_fallback_advice(closet_items, style_dress_for)
                            recs = advice.get("outfit_recommendations") or []
                            
                            rec_lines = []
                            for r in recs:
                                items_str = ", ".join(it.get("description") or it.get("title") or "item" for it in r.get("items") or [])
                                rec_lines.append(f"• {r.get('name') or 'Outfit'}: {items_str}")
                            
                            body_text = f"Proposals for {style_dress_for}:\n" + "\n".join(rec_lines)
                        except Exception as inner_exc:
                            logger.error("Failed to generate fallback scheduled proposals: %s", inner_exc)
                            body_text = f"Your AI Stylist prepared outfit options for your: {style_dress_for}."
                            advice = None

                    # Auto-save the first recommendation to tomorrow's calendar so the user can view it on the grid
                    if advice and advice.get("outfit_recommendations"):
                        first_rec = advice["outfit_recommendations"][0]
                        tomorrow_date_str = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
                        
                        outfit_doc = {
                            "id": str(uuid.uuid4()),
                            "user_id": user["id"],
                            "prompt": f"Scheduled AI Proposal for {style_dress_for}",
                            "garments": first_rec.get("items", []),
                            "usage": {
                                "date": tomorrow_date_str,
                                "location": "",
                                "event_name": "AI Scheduled Proposal"
                            },
                            "use_count": 1,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        try:
                            await db.outfits.insert_one(outfit_doc)
                            logger.info(f"Auto-saved scheduled outfit {outfit_doc['id']} for {tomorrow_date_str}")
                        except Exception as e:
                            logger.error(f"Failed to auto-save scheduled outfit: {e}")

                    await send_push_notification(
                        user_id=user["id"],
                        title="Tomorrow's Outfit Proposal is Ready! 👕",
                        body=body_text,
                        payload=advice
                    )

        # 2. Event Notifications
        outfit_cursor = db.outfits.find({})
        async for outfit in outfit_cursor:
            # Check if this user is currently traveling
            user_id = outfit.get("user_id")
            active_s = await db.suitcases.find_one({"user_id": user_id, "status": {"$ne": "completed"}})
            is_traveling_now = False
            if active_s:
                try:
                    dep_dt = datetime.fromisoformat(active_s["departure_time"].replace("Z", "+00:00"))
                    ret_dt = datetime.fromisoformat(active_s["return_time"].replace("Z", "+00:00"))
                    if dep_dt.tzinfo is None:
                        dep_dt = dep_dt.replace(tzinfo=timezone.utc)
                    if ret_dt.tzinfo is None:
                        ret_dt = ret_dt.replace(tzinfo=timezone.utc)
                    if dep_dt <= now <= ret_dt:
                        is_traveling_now = True
                except Exception:
                    pass
            
            if is_traveling_now:
                continue  # Skip event notification while traveling

            usage = outfit.get("usage") or {}
            date_str = usage.get("date")
            time_str = usage.get("time")
            if date_str and time_str:
                if date_str == now.strftime("%Y-%m-%d") and current_time_str == time_str:
                    await send_push_notification(
                        user_id=outfit["user_id"],
                        title=f"Time to get ready for {outfit.get('name')}! 🌟",
                        body=f"Your chosen outfit is prepared. Have a wonderful time!"
                    )
    except Exception as exc:
        logger.warning("Error checking scheduler triggers: %s", exc)


def start_scheduler() -> None:
    """Start the APScheduler singleton. Safe to call multiple times."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")

    # Unconditionally add user scheduling check (runs every minute)
    _scheduler.add_job(
        check_scheduler_triggers,
        IntervalTrigger(minutes=1),
        id="scheduler_triggers_check",
        replace_existing=True,
        misfire_grace_time=30,
    )

    if settings.TREND_SCOUT_ENABLED:
        hour, minute = _parse_hhmm(settings.TREND_SCOUT_SCHEDULE_UTC)
        _scheduler.add_job(
            _safe_run,
            CronTrigger(hour=hour, minute=minute, timezone="UTC"),
            id="trend_scout_daily",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        logger.info(
            "Trend-Scout daily scheduled (at %02d:%02d UTC)", hour, minute
        )

    _scheduler.start()
    logger.info("DressApp Scheduler singleton started")

    if settings.TREND_SCOUT_ENABLED and settings.TREND_SCOUT_RUN_ON_STARTUP:
        asyncio.create_task(_safe_run())


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        try:
            _scheduler.shutdown(wait=False)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Scheduler shutdown error: %s", exc)
    _scheduler = None
