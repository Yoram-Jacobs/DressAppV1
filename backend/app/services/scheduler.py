"""APScheduler boot — schedules the Trend-Scout agent, user styling notifications, and credit cleanup.

This module manages all scheduled background tasks for the DressApp backend.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.db.database import get_db
from app.services.trend_scout import run_trend_scout, monthly_trend_scout_refresh
from app.services.push_service import send_push_notification
from app.services.stylist_scheduler_brain import generate_scheduled_proposals
from app.services.i18n import t
from app.services.garment_visuals import resolve_garment_image_url

from app.services.campaign_service import activate_scheduled_campaigns, expire_overdue_campaigns
from app.services.pricing import expire_old_free_credits, check_trial_expiration, cleanup_expired_trials  # Import our new credit and trial cleanup functions

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
            "Trend-Scout daily run (default): generated=%d skipped=%d date=%s",
            len(result.get("generated") or []),
            len(result.get("skipped") or []),
            result.get("date"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Trend-Scout daily run (default) failed: %s", exc)

    # Dynamic run for other premium users' countries
    try:
        db = get_db()
        cursor = db.users.find(
            {
                "subscription.is_active": True,
                "subscription.tier": {"$in": ["manager", "professional"]}
            },
            {"address.country": 1, "address.country_code": 1, "home_location.country": 1, "home_location.country_code": 1}
        )
        countries = set()
        async for user in cursor:
            addr = user.get("address") or {}
            if isinstance(addr, dict):
                cc = addr.get("country_code") or addr.get("country")
                if isinstance(cc, str) and cc.strip():
                    countries.add(cc.strip().upper())
            hl = user.get("home_location") or {}
            if isinstance(hl, dict):
                cc = hl.get("country_code") or hl.get("country")
                if isinstance(cc, str) and cc.strip():
                    countries.add(cc.strip().upper())

        iso_countries = set()
        for c in countries:
            if c in {"ISRAEL", "IL"}:
                iso_countries.add("IL")
            elif c in {"UNITED STATES", "USA", "US"}:
                iso_countries.add("US")
            elif c in {"UNITED KINGDOM", "UK", "GB"}:
                iso_countries.add("GB")
            elif c in {"FRANCE", "FR"}:
                iso_countries.add("FR")
            elif len(c) == 2:
                iso_countries.add(c)

        for cc in iso_countries:
            if cc == "IL":  # Default run already covers IL
                continue
            try:
                res = await run_trend_scout(country_code=cc)
                logger.info(
                    "Trend-Scout daily run (%s): generated=%d skipped=%d date=%s",
                    cc,
                    len(res.get("generated") or []),
                    len(res.get("skipped") or []),
                    res.get("date"),
                )
            except Exception as e:
                logger.warning("Trend-Scout daily run (%s) failed: %s", cc, e)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Trend-Scout daily run dynamic countries resolution failed: %s", exc)


async def _safe_monthly_run() -> None:
    try:
        result = await monthly_trend_scout_refresh()
        logger.info("Trend-Scout monthly refresh complete: %s", result)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Trend-Scout monthly refresh failed: %s", exc)


async def _expire_old_free_credits_job() -> None:
    """Background task to expire old free credits for all users.
    
    This scans all users and removes free credits that have passed their
    30-day expiry window. Runs daily at 02:00 UTC.
    """
    try:
        db = get_db()
        # Get all user IDs (cursor-based to avoid loading all users at once)
        cursor = db.users.find({}, {"id": 1})
        
        total_expired = 0
        users_processed = 0
        
        async for user in cursor:
            try:
                result = await expire_old_free_credits({"id": user["id"]})
                if result.get("success", False) and result.get("expired_removed", 0) > 0:
                    total_expired += result["expired_removed"]
                    logger.info(f"User {user['id']}: expired {result['expired_removed']} free credits")
            except Exception as e:
                logger.error(f"Error processing user {user.get('id', 'unknown')} for credit cleanup: {e}")
            
            users_processed += 1
            # Log progress every 100 users
            if users_processed % 100 == 0:
                logger.info(f"Credit cleanup progress: {users_processed} users processed")
        
        logger.info(f"Credit cleanup completed: {users_processed} users scanned, {total_expired} total free credits expired removed")
        
    except Exception as e:
        logger.error(f"Error in expire_old_free_crons job: {e}")


async def _cleanup_expired_trials_job() -> None:
    """Background task to clean up expired trials for all users.
    
    Scans all users with active trials and reverts those past their expiration
    date back to the free plan. Runs daily shortly after credit cleanup.
    """
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        # Find all users with trial_info where expires_at is in the past
        db = get_db()
        cursor = db.users.find(
            {
                "trial_info.expires_at": {"$lte": now.isoformat()},
                "trial_info": {"$exists": True},
            },
            {"id": 1}
        )
        
        cleaned_count = 0
        async for user in cursor:
            try:
                result = await check_trial_expiration(user["id"])
                if result.get("trial_expired"):
                    cleaned_count += 1
                    logger.info(f"User {user['id']} trial expired and reverted to free")
            except Exception as e:
                logger.error(f"Error cleaning up trial for user {user.get('id', 'unknown')}: {e}")
        
        logger.info(f"Trial cleanup completed: {cleaned_count} expired trial accounts processed")
        
    except Exception as e:
        logger.error(f"Error in cleanup_expired_trials job: {str(e)}")



from app.services.stylist_scheduler_brain import generate_fallback_advice

# Backward-compatible alias
_generate_fallback_advice = generate_fallback_advice



def _get_target_weather(weather_ctx: dict[str, Any] | None, is_next_day: bool) -> dict[str, Any] | None:
    if not weather_ctx:
        return None
    if not is_next_day:
        return weather_ctx
    
    forecasts = weather_ctx.get("forecast_next_24h") or []
    if not forecasts:
        return weather_ctx
    
    target_entry = None
    for f in forecasts:
        at_str = f.get("at") or ""
        if "12:00:00" in at_str or "09:00:00" in at_str or "15:00:00" in at_str:
            target_entry = f
            break
            
    if not target_entry and forecasts:
        target_entry = forecasts[-1]
        
    if target_entry:
        return {
            "temp_c": target_entry.get("temp_c"),
            "feels_like_c": target_entry.get("temp_c"),
            "humidity": weather_ctx.get("humidity"),
            "condition": target_entry.get("condition"),
            "description": f"Forecasted {target_entry.get('condition')}",
            "wind_speed": weather_ctx.get("wind_speed"),
            "city": weather_ctx.get("city"),
            "country": weather_ctx.get("country"),
        }
    return weather_ctx


async def check_scheduler_triggers() -> None:
    """Scan user scheduler preferences and trigger push notifications with outfit proposals."""
    try:
        db = get_db()
        now = datetime.now(timezone.utc)

        # Query users with scheduler enabled
        cursor = db.users.find(
            {
                "scheduler_settings.enabled": True,
            }
        )

        async for user in cursor:
            try:
                user_id = user.get("id")
                if not user_id:
                    continue

                sched = user.get("scheduler_settings") or {}

                # Convert current UTC time to user's local time based on their timezone
                user_timezone = sched.get("timezone") or "UTC"
                try:
                    from zoneinfo import ZoneInfo
                    local_now = now.astimezone(ZoneInfo(user_timezone))
                except Exception:
                    local_now = now
                current_time_str = local_now.strftime("%H:%M")
                current_day_str = local_now.strftime("%A").lower()

                # Check notification time matches (within 1-minute window)
                notif_time = sched.get("time") or sched.get("notification_time") or "08:00"
                if notif_time != current_time_str:
                    continue

                # Check frequency
                frequency = sched.get("frequency") or "everyday"
                if frequency == "weekdays" and current_day_str in ("saturday", "sunday"):
                    continue
                if frequency == "weekends" and current_day_str not in ("saturday", "sunday"):
                    continue
                # For "everyday" or specific day matches, continue

                # Check if push notifications are enabled
                if sched.get("push_enabled") is False:
                    continue

                # Determine if we are scheduling for today or the next day
                is_next_day = local_now.hour >= 12
                target_date = local_now + timedelta(days=1) if is_next_day else local_now
                target_date_str = target_date.strftime("%Y-%m-%d")

                # Fetch weather (soft-fail)
                weather_ctx = None
                try:
                    from app.services.weather_service import weather_service
                    home = user.get("home_location") or {}
                    lat = home.get("lat")
                    lng = home.get("lng")
                    lang = user.get("preferred_language") or "en"
                    if lat is not None and lng is not None and weather_service is not None:
                        weather_ctx = await weather_service.fetch(float(lat), float(lng), lang=lang)
                except Exception as w_exc:
                    logger.warning("Failed to fetch weather for user %s: %s", user_id, w_exc)

                # Get weather for the target date
                target_weather = _get_target_weather(weather_ctx, is_next_day)

                # Fetch calendar events for the target date
                calendar_events = []
                try:
                    from app.services.calendar_service import calendar_service
                    from zoneinfo import ZoneInfo
                    local_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=ZoneInfo(user_timezone))
                    local_end = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=ZoneInfo(user_timezone))
                    time_min = local_start.astimezone(timezone.utc)
                    time_max = local_end.astimezone(timezone.utc)
                    
                    calendar_events = await calendar_service.get_events_for_user(
                        user,
                        time_min=time_min,
                        time_max=time_max
                    )
                except Exception as cal_exc:
                    logger.warning("Failed to fetch calendar events for user %s on %s: %s", user_id, target_date_str, cal_exc)

                style_option = sched.get("style_dress_for")
                if not style_option or style_option == "custom":
                    style_option = sched.get("custom_style") or sched.get("style_option") or "casual"
                if style_option == "custom":
                    style_option = "casual"
                
                # Sanitize user dict to prevent ObjectId JSON serialization errors
                user_clean = dict(user)
                user_clean.pop("_id", None)

                try:
                    try:
                        from app.services.stylist_scheduler_brain import generate_scheduled_proposals
                        proposals_result = await generate_scheduled_proposals(
                            user_clean, 
                            style_option, 
                            weather=target_weather,
                            calendar_events=calendar_events
                        )
                        proposals = proposals_result.get("outfit_recommendations") or []
                        if not proposals:
                            raise ValueError("No proposals returned from LLM brain")
                    except Exception as prop_exc:
                        logger.warning("Failed to generate scheduled proposals from LLM brain, falling back to rule-based: %s", prop_exc)
                        # Fallback to local rule-based scheduler
                        cursor_items = db.closet_items.find({"user_id": user_id})
                        closet_items = [d async for d in cursor_items]
                        fallback_result = generate_fallback_advice(closet_items, style_option, weather_ctx=target_weather)
                        proposals = fallback_result.get("outfit_recommendations") or []


                    if not proposals:
                        logger.info("No proposals generated for user %s, skipping", user_id)
                        continue

                    # Build notification body
                    outfit_count = len(proposals)
                    style_label = style_option.title() if style_option else "Daily"
                    
                    title = f"Your {style_label} Outfit Proposals"
                    day_word = "tomorrow" if is_next_day else "today"
                    body_lines = [f"Here are {outfit_count} outfit(s) curated for you {day_word}:"]
                    
                    for i, prop in enumerate(proposals[:3], 1):
                        outfit_name = prop.get("name", f"Outfit {i}")
                        items = prop.get("items", [])
                        item_names = [it.get("title", it.get("role", "")) for it in items[:3]]
                        body_lines.append(f"{i}. {outfit_name} — {', '.join(item_names)}")
                    
                    body = "\n".join(body_lines)

                    # Serialize lightweight proposal objects (no heavy image base64 strings)
                    lightweight_proposals = []
                    for prop in proposals[:3]:
                        p_copy = {
                            "name": prop.get("name"),
                            "reasoning": prop.get("reasoning"),
                            "why": prop.get("why"),
                            "items": [
                                {
                                    # closet_item_id is CRITICAL — without it, the frontend saves
                                    # outfits with null closet references (empty avatar mannequins).
                                    "closet_item_id": it.get("closet_item_id") or it.get("id"),
                                    "id": it.get("closet_item_id") or it.get("id"),
                                    "title": it.get("title") or it.get("name"),
                                    "description": it.get("description") or it.get("title") or it.get("name"),
                                    "role": it.get("role") or it.get("category"),
                                    "category": it.get("category") or it.get("role"),
                                    "clean_image_url": it.get("clean_image_url") if (isinstance(it.get("clean_image_url"), str) and not it.get("clean_image_url", "").startswith("data:")) else None,
                                    "image_url": it.get("image_url") if (isinstance(it.get("image_url"), str) and not it.get("image_url", "").startswith("data:")) else None,
                                    "color": it.get("color"),
                                }
                                for it in prop.get("items", [])
                            ]
                        }
                        lightweight_proposals.append(p_copy)

                    payload = {
                        "url": "/stylist?tab=match", 
                        "target_date": target_date_str,
                        "tag": f"daily-suggestions-{target_date_str}",
                        "proposals": lightweight_proposals
                    }
                    await send_push_notification(user_id, title, body, payload)

                    
                    logger.info("Sent scheduled notification to user %s for %s", user_id, target_date_str)

                except Exception as trigger_exc:
                    logger.warning("Failed to process notification generation/sending for user %s: %s", user_id, trigger_exc)

            except Exception as user_exc:
                logger.warning("Error processing scheduler for user %s: %s", user.get("id"), user_exc)

    except Exception as exc:
        logger.warning("Error checking scheduler triggers: %s", exc)


def start_scheduler() -> None:
    """Start the APScheduler singleton. Safe to call multiple times."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")

    # User scheduling check (runs every minute)
    _scheduler.add_job(
        check_scheduler_triggers,
        IntervalTrigger(minutes=1),
        id="scheduler_triggers_check",
        replace_existing=True,
        misfire_grace_time=30,
    )

    # Trend-Scout daily run
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

        # Trend-Scout monthly refresh (midnight on the 1st of every month)
        _scheduler.add_job(
            _safe_monthly_run,
            CronTrigger(day=1, hour=0, minute=0, timezone="UTC"),
            id="trend_scout_monthly_refresh",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        logger.info("Trend-Scout monthly refresh scheduled: 1st of every month at 00:00 UTC")

    # Credit cleanup: expire old free credits (daily at 02:00 UTC)
    # Free credits expire after 30 days per Pricing-Plane.md requirement
    _scheduler.add_job(
        _expire_old_free_credits_job,
        CronTrigger(hour=2, minute=0, timezone="UTC"),
        id="expire_old_free_credits_daily",
        replace_existing=True,
        misfire_grace_time=300,  # 5 minute grace period
    )
    logger.info("Credit cleanup job scheduled: daily at 02:00 UTC to expire free credits over 30 days old")
    
    # Trial cleanup: remove expired trial accounts (runs shortly after credit cleanup)
    _scheduler.add_job(
        _cleanup_expired_trials_job,
        CronTrigger(hour=2, minute=15, timezone="UTC"),  # 15 minutes after credit cleanup
        id="cleanup_expired_trials_daily",
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info("Trial cleanup job scheduled: daily at 02:15 UTC to expire and revert trial accounts")



    # Experts Campaign Platform
    _scheduler.add_job(
        activate_scheduled_campaigns,
        IntervalTrigger(minutes=5),
        id="campaign_activate",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.add_job(
        expire_overdue_campaigns,
        IntervalTrigger(minutes=15),
        id="campaign_expire",
        replace_existing=True,
        max_instances=1,
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