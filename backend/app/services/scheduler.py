"""APScheduler boot — schedules the Trend-Scout agent and user styling notifications."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.db.database import get_db
from app.services.trend_scout import run_trend_scout
from app.services.push_service import send_push_notification

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


async def check_scheduler_triggers() -> None:
    """Scan user scheduler preferences and active outfits to trigger mock push notifications."""
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        current_time_str = now.strftime("%H:%M")
        current_day_str = now.strftime("%A").lower()

        # 1. User Daily/Weekly Scheduler
        cursor = db.users.find({"scheduler_settings.enabled": True})
        async for user in cursor:
            s_set = user.get("scheduler_settings") or {}
            time_str = s_set.get("time") or "08:00"
            freq = s_set.get("frequency") or "everyday"
            weekday = s_set.get("weekday")

            try:
                uh, um = map(int, time_str.split(":", 1))
            except Exception:
                uh, um = 8, 0

            # Match hour and minute (UTC for MVP simplicity)
            if now.hour == uh and now.minute == um:
                should_notify = False
                if freq == "everyday":
                    should_notify = True
                elif freq == "on_weekday" and weekday and weekday.lower() == current_day_str:
                    should_notify = True
                elif freq == "every_other_day" and now.timetuple().tm_yday % 2 == 0:
                    should_notify = True
                elif freq == "twice_a_week" and current_day_str in ["monday", "thursday"]:
                    should_notify = True

                if should_notify:
                    await send_push_notification(
                        user_id=user["id"],
                        title="Tomorrow's Outfit Proposal is Ready! 👕",
                        body=f"Your AI Stylist prepared 3 outfit options for your: {s_set.get('style_dress_for') or 'day'}."
                    )

        # 2. Event Notifications
        outfit_cursor = db.outfits.find({})
        async for outfit in outfit_cursor:
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
