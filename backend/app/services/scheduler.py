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
            "Trend-Scout daily run: generated=%d skipped=%d date=%s",
            len(result.get("generated") or []),
            len(result.get("skipped") or []),
            result.get("date"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Trend-Scout daily run failed: %s", exc)


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



def _generate_fallback_advice(
    closet_items: list[dict[str, Any]], 
    style_dress_for: str | None = None,
    weather_ctx: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Generate outfit recommendations based on closet items and user preferences, with strict category validation."""
    if not closet_items:
        return {
            "reasoning_summary": "No clothing items available in closet.",
            "outfit_recommendations": []
        }

    from app.services.stylist_scheduler_brain import norm_category, matches_style_func, matches_season_func

    clean_items = []
    for it in closet_items:
        c = dict(it)
        if "_id" in c:
            c.pop("_id")
        clean_items.append(c)

    # Determine target season
    target_season = None
    if weather_ctx:
        temp = weather_ctx.get("temp_c")
        if temp is not None:
            if temp >= 23:
                target_season = "summer"
            elif temp <= 15:
                target_season = "winter"
            else:
                target_season = "spring"

    # Bucket items strictly by normalized category
    tops = [it for it in clean_items if norm_category(it.get("category")) == "top"]
    bottoms = [it for it in clean_items if norm_category(it.get("category")) == "bottom"]
    shoes = [it for it in clean_items if norm_category(it.get("category")) == "shoes"]
    dresses = [it for it in clean_items if norm_category(it.get("category")) == "dress"]
    outerwear = [it for it in clean_items if norm_category(it.get("category")) == "outerwear"]
    accessories = [it for it in clean_items if norm_category(it.get("category")) == "accessory"]

    # Check if there is at least one exact case-insensitive tag match in the user's closet
    has_exact_tag_match = False
    if style_dress_for:
        style_clean = style_dress_for.strip().lower()
        for it in clean_items:
            it_tags = [t.lower() for t in (it.get("tags") or [])]
            it_custom = [t.lower() for t in (it.get("custom_tags") or [])]
            if style_clean in it_tags or style_clean in it_custom:
                has_exact_tag_match = True
                break

    # Score item helper
    from app.services.stylist_scheduler_brain import calculate_garment_style_score

    def score_item(it: dict) -> int:
        score = calculate_garment_style_score(it, style_dress_for)
        if matches_season_func(it, target_season):
            score += 10
        return score

    # Sort each bucket by score descending
    tops.sort(key=score_item, reverse=True)
    bottoms.sort(key=score_item, reverse=True)
    shoes.sort(key=score_item, reverse=True)
    dresses.sort(key=score_item, reverse=True)
    outerwear.sort(key=score_item, reverse=True)
    accessories.sort(key=score_item, reverse=True)

    all_outfits = []

    def is_formal_tie(acc: dict) -> bool:
        sub_cat = str(acc.get("sub_category") or "").lower()
        title = str(acc.get("title") or acc.get("name") or "").lower()
        tags = [str(t).lower() for t in (acc.get("tags") or [])]
        return any(w in title for w in ("necktie", "silk tie", "polka dot", "עניבה", "עניבת")) or "tie" in sub_cat or title.strip() == "tie"

    def is_formal_shirt_or_blazer(top: dict) -> bool:
        title = str(top.get("title") or top.get("name") or "").lower()
        dc = str(top.get("dress_code") or "").lower()
        return any(w in title for w in ("button", "dress shirt", "collared", "blazer", "suit", "חולצה מכופתרת", "בלייזר", "חליפה")) or dc in ("business", "formal")

    # 1. Two-Piece outfits (Top + Bottom + Shoes, with optional Accessory)
    for top in tops:
        top_is_formal = is_formal_shirt_or_blazer(top)
        for bottom in bottoms:
            if top.get("id") == bottom.get("id"):
                continue
            for chosen_shoe in (shoes if shoes else [None]):
                if chosen_shoe and chosen_shoe.get("id") in {top.get("id"), bottom.get("id")}:
                    continue
                used_ids = {top.get("id"), bottom.get("id")}
                if chosen_shoe:
                    used_ids.add(chosen_shoe.get("id"))

                # Only pick accessories that don't clash (e.g. no neckties on casual T-shirts/shorts)
                outfit_accs = [
                    a for a in accessories
                    if a.get("id") not in used_ids and (not is_formal_tie(a) or top_is_formal)
                ]
                chosen_acc = outfit_accs[0] if outfit_accs else None

                score = (
                    score_item(top)
                    + score_item(bottom)
                    + (score_item(chosen_shoe) if chosen_shoe else 0)
                    + (score_item(chosen_acc) if chosen_acc else 0)
                )
                top_clean = top.get("clean_image_url") or top.get("reconstructed_image_url") or top.get("cutout_url") or top.get("thumbnail_data_url") or top.get("image_url")
                bottom_clean = bottom.get("clean_image_url") or bottom.get("reconstructed_image_url") or bottom.get("cutout_url") or bottom.get("thumbnail_data_url") or bottom.get("image_url")
                
                items = [
                    {
                        "role": "top",
                        "category": top.get("category") or "Top",
                        "sub_category": top.get("sub_category") or top.get("item_type") or "",
                        "title": top.get("title") or top.get("name") or "Top",
                        "name": top.get("name") or top.get("title") or "Top",
                        "description": top.get("title") or top.get("name") or "Top",
                        "color": top.get("color") or "",
                        "clean_image_url": top_clean,
                        "image_url": top_clean,
                        "thumbnail_data_url": top.get("thumbnail_data_url") or top_clean,
                        "id": top.get("id"),
                        "closet_item_id": top.get("id")
                    },
                    {
                        "role": "bottom",
                        "category": bottom.get("category") or "Bottom",
                        "sub_category": bottom.get("sub_category") or bottom.get("item_type") or "",
                        "title": bottom.get("title") or bottom.get("name") or "Bottom",
                        "name": bottom.get("name") or bottom.get("title") or "Bottom",
                        "description": bottom.get("title") or bottom.get("name") or "Bottom",
                        "color": bottom.get("color") or "",
                        "clean_image_url": bottom_clean,
                        "image_url": bottom_clean,
                        "thumbnail_data_url": bottom.get("thumbnail_data_url") or bottom_clean,
                        "id": bottom.get("id"),
                        "closet_item_id": bottom.get("id")
                    },
                ]
                if chosen_shoe:
                    shoe_clean = chosen_shoe.get("clean_image_url") or chosen_shoe.get("reconstructed_image_url") or chosen_shoe.get("cutout_url") or chosen_shoe.get("thumbnail_data_url") or chosen_shoe.get("image_url")
                    items.append({
                        "role": "shoes",
                        "category": chosen_shoe.get("category") or "Footwear",
                        "sub_category": chosen_shoe.get("sub_category") or chosen_shoe.get("item_type") or "",
                        "title": chosen_shoe.get("title") or chosen_shoe.get("name") or "Shoes",
                        "name": chosen_shoe.get("name") or chosen_shoe.get("title") or "Shoes",
                        "description": chosen_shoe.get("title") or chosen_shoe.get("name") or "Shoes",
                        "color": chosen_shoe.get("color") or "",
                        "clean_image_url": shoe_clean,
                        "image_url": shoe_clean,
                        "thumbnail_data_url": chosen_shoe.get("thumbnail_data_url") or shoe_clean,
                        "id": chosen_shoe.get("id"),
                        "closet_item_id": chosen_shoe.get("id")
                    })
                if chosen_acc:
                    acc_clean = chosen_acc.get("clean_image_url") or chosen_acc.get("reconstructed_image_url") or chosen_acc.get("cutout_url") or chosen_acc.get("thumbnail_data_url") or chosen_acc.get("image_url")
                    items.append({
                        "role": "accessory",
                        "category": chosen_acc.get("category") or "Accessory",
                        "sub_category": chosen_acc.get("sub_category") or chosen_acc.get("item_type") or "",
                        "title": chosen_acc.get("title") or chosen_acc.get("name") or "Accessory",
                        "name": chosen_acc.get("name") or chosen_acc.get("title") or "Accessory",
                        "description": chosen_acc.get("title") or chosen_acc.get("name") or "Accessory",
                        "color": chosen_acc.get("color") or "",
                        "clean_image_url": acc_clean,
                        "image_url": acc_clean,
                        "thumbnail_data_url": chosen_acc.get("thumbnail_data_url") or acc_clean,
                        "id": chosen_acc.get("id"),
                        "closet_item_id": chosen_acc.get("id")
                    })

                top_title = top.get("title") or top.get("name") or "Top"
                bottom_title = bottom.get("title") or bottom.get("name") or "Bottom"
                all_outfits.append({
                    "name": f"Outfit with {top_title} and {bottom_title}",
                    "items": items,
                    "why": f"Recommended based on {style_dress_for or 'casual'} style preference",
                    "confidence": min(0.95, 0.7 + score / 100),
                    "_score": score,
                    "_top_id": top.get("id"),
                    "_bottom_id": bottom.get("id"),
                    "_shoe_id": chosen_shoe.get("id") if chosen_shoe else None,
                })

    # 2. One-Piece outfits (Dress / Overall / Suit / Jumpsuit + Shoes, with optional Accessory)
    for dress in dresses:
        dress_is_formal = is_formal_shirt_or_blazer(dress)
        for chosen_shoe in (shoes if shoes else [None]):
            if chosen_shoe and chosen_shoe.get("id") == dress.get("id"):
                continue
            used_ids = {dress.get("id")}
            if chosen_shoe:
                used_ids.add(chosen_shoe.get("id"))

            outfit_accs = [
                a for a in accessories
                if a.get("id") not in used_ids and (not is_formal_tie(a) or dress_is_formal)
            ]
            chosen_acc = outfit_accs[0] if outfit_accs else None

            score = (
                score_item(dress) * 2
                + (score_item(chosen_shoe) if chosen_shoe else 0)
                + (score_item(chosen_acc) if chosen_acc else 0)
            )
            dress_clean = dress.get("clean_image_url") or dress.get("reconstructed_image_url") or dress.get("cutout_url") or dress.get("thumbnail_data_url") or dress.get("image_url")
            items = [
                {
                    "role": "dress",
                    "category": dress.get("category") or "Dress",
                    "sub_category": dress.get("sub_category") or dress.get("item_type") or "",
                    "title": dress.get("title") or dress.get("name") or "One-Piece",
                    "name": dress.get("name") or dress.get("title") or "One-Piece",
                    "description": dress.get("title") or dress.get("name") or "One-Piece",
                    "color": dress.get("color") or "",
                    "clean_image_url": dress_clean,
                    "image_url": dress_clean,
                    "thumbnail_data_url": dress.get("thumbnail_data_url") or dress_clean,
                    "id": dress.get("id"),
                    "closet_item_id": dress.get("id")
                },
            ]
            if chosen_shoe:
                shoe_clean = chosen_shoe.get("clean_image_url") or chosen_shoe.get("reconstructed_image_url") or chosen_shoe.get("cutout_url") or chosen_shoe.get("thumbnail_data_url") or chosen_shoe.get("image_url")
                items.append({
                    "role": "shoes",
                    "category": chosen_shoe.get("category") or "Footwear",
                    "sub_category": chosen_shoe.get("sub_category") or chosen_shoe.get("item_type") or "",
                    "title": chosen_shoe.get("title") or chosen_shoe.get("name") or "Shoes",
                    "name": chosen_shoe.get("name") or chosen_shoe.get("title") or "Shoes",
                    "description": chosen_shoe.get("title") or chosen_shoe.get("name") or "Shoes",
                    "color": chosen_shoe.get("color") or "",
                    "clean_image_url": shoe_clean,
                    "image_url": shoe_clean,
                    "thumbnail_data_url": chosen_shoe.get("thumbnail_data_url") or shoe_clean,
                    "id": chosen_shoe.get("id"),
                    "closet_item_id": chosen_shoe.get("id")
                })
            if chosen_acc:
                acc_clean = chosen_acc.get("clean_image_url") or chosen_acc.get("reconstructed_image_url") or chosen_acc.get("cutout_url") or chosen_acc.get("thumbnail_data_url") or chosen_acc.get("image_url")
                items.append({
                    "role": "accessory",
                    "category": chosen_acc.get("category") or "Accessory",
                    "sub_category": chosen_acc.get("sub_category") or chosen_acc.get("item_type") or "",
                    "title": chosen_acc.get("title") or chosen_acc.get("name") or "Accessory",
                    "name": chosen_acc.get("name") or chosen_acc.get("title") or "Accessory",
                    "description": chosen_acc.get("title") or chosen_acc.get("name") or "Accessory",
                    "color": chosen_acc.get("color") or "",
                    "clean_image_url": acc_clean,
                    "image_url": acc_clean,
                    "thumbnail_data_url": chosen_acc.get("thumbnail_data_url") or acc_clean,
                    "id": chosen_acc.get("id"),
                    "closet_item_id": chosen_acc.get("id")
                })

            dress_title = dress.get("title") or dress.get("name") or "Outfit"
            all_outfits.append({
                "name": f"Outfit with {dress_title}",
                "items": items,
                "why": f"Recommended based on {style_dress_for or 'casual'} style preference",
                "confidence": min(0.95, 0.7 + score / 100),
                "_score": score,
                "_top_id": dress.get("id"),
                "_bottom_id": dress.get("id"),
                "_shoe_id": chosen_shoe.get("id") if chosen_shoe else None,
            })

    all_outfits.sort(key=lambda x: x["_score"], reverse=True)

    # Pass 1: Select distinct outfits prioritizing unique tops, unique bottoms, AND unique shoes
    seen_combos = set()
    used_top_ids = set()
    used_bottom_ids = set()
    used_shoe_ids = set()
    recs = []
    
    for o in all_outfits:
        item_ids = tuple(sorted([item["closet_item_id"] for item in o["items"] if item.get("closet_item_id")]))
        top_id = o.get("_top_id")
        bottom_id = o.get("_bottom_id")
        shoe_id = o.get("_shoe_id")
        
        if item_ids and item_ids not in seen_combos:
            top_ok = (top_id not in used_top_ids) or (len(used_top_ids) >= len(tops))
            bottom_ok = (bottom_id not in used_bottom_ids) or (len(used_bottom_ids) >= len(bottoms))
            shoe_ok = (shoe_id not in used_shoe_ids) or (len(used_shoe_ids) >= len(shoes)) or (shoe_id is None)
            
            if top_ok and bottom_ok and shoe_ok:
                seen_combos.add(item_ids)
                if top_id:
                    used_top_ids.add(top_id)
                if bottom_id:
                    used_bottom_ids.add(bottom_id)
                if shoe_id:
                    used_shoe_ids.add(shoe_id)
                recs.append(o)
                if len(recs) >= 3:
                    break

    # Pass 2: If less than 3 distinct outfits found, relax uniqueness
    if len(recs) < 3:
        for o in all_outfits:
            item_ids = tuple(sorted([item["closet_item_id"] for item in o["items"] if item.get("closet_item_id")]))
            if item_ids and item_ids not in seen_combos:
                seen_combos.add(item_ids)
                recs.append(o)
                if len(recs) >= 3:
                    break

    for r in recs:
        r.pop("_score", None)
        r.pop("_top_id", None)
        r.pop("_bottom_id", None)
        r.pop("_shoe_id", None)

    # Fallback if no full combination found, build the best possible complete outfit
    if not recs:
        items = []
        if tops:
            t = tops[0]
            items.append({"role": "top", "title": t.get("title") or "Top", "description": t.get("title") or "Top", "closet_item_id": t["id"]})
        elif dresses:
            d = dresses[0]
            items.append({"role": "dress", "title": d.get("title") or "Dress", "description": d.get("title") or "Dress", "closet_item_id": d["id"]})
        
        if bottoms and not dresses:
            b = bottoms[0]
            items.append({"role": "bottom", "title": b.get("title") or "Bottom", "description": b.get("title") or "Bottom", "closet_item_id": b["id"]})

        if shoes:
            sh = shoes[0]
            items.append({"role": "shoes", "title": sh.get("title") or "Shoes", "description": sh.get("title") or "Shoes", "closet_item_id": sh["id"]})

        if items:
            recs.append({
                "name": "Daily outfit suggestion",
                "items": items,
                "why": "Curated suggestion based on available items in your closet",
                "confidence": 0.7,
            })

    return {
        "reasoning_summary": f"Here are outfit recommendations curated from your closet for: {style_dress_for or 'casual'}.",
        "outfit_recommendations": recs
    }


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
                        fallback_result = _generate_fallback_advice(closet_items, style_option, weather_ctx=target_weather)
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
                                    "id": it.get("closet_item_id") or it.get("id"),
                                    "closet_item_id": it.get("closet_item_id") or it.get("id"),
                                    "title": it.get("title") or it.get("name") or it.get("description"),
                                    "name": it.get("name") or it.get("title") or it.get("description"),
                                    "description": it.get("description") or it.get("title") or it.get("name"),
                                    "role": it.get("role") or it.get("category"),
                                    "category": it.get("category") or it.get("role"),
                                    "clean_image_url": it.get("clean_image_url") if (isinstance(it.get("clean_image_url"), str) and not it.get("clean_image_url", "").startswith("data:")) else None,
                                    "image_url": it.get("image_url") if (isinstance(it.get("image_url"), str) and not it.get("image_url", "").startswith("data:")) else None,
                                    "thumbnail_data_url": it.get("thumbnail_data_url") if (isinstance(it.get("thumbnail_data_url"), str) and not it.get("thumbnail_data_url", "").startswith("data:")) else None,
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

        if settings.TREND_SCOUT_RUN_ON_STARTUP:
            asyncio.create_task(_safe_run())
            logger.info("Trend-Scout run on startup triggered in background")

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