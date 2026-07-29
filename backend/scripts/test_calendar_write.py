import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.services.calendar_service import calendar_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_calendar_write")

async def test_crud():
    db = get_db()
    users = await db.users.find({}).to_list(length=100)
    user = None
    for u in users:
        if u.get("google_calendar_tokens", {}).get("refresh_token"):
            user = u
            break
            
    if not user:
        logger.error("No user with connected Google Calendar found in DB!")
        return

    logger.info("Found calendar-connected user: %s (email: %s)", user["id"], user.get("email"))
    
    summary = "Test Outfit Saved by DressApp"
    description = "This is a smoke test event containing garments:\n- top: Blue Silk Blouse\n- bottom: White Cotton Pants"
    date_str = "2026-08-01"
    time_str = "10:00"

    logger.info("--- Testing Event Creation ---")
    event = await calendar_service.create_calendar_event(
        user, summary, description, date_str, time_str
    )
    if not event or not event.get("id"):
        logger.error("Event creation FAILED! Check logs above for detailed Google API error.")
        return
        
    event_id = event["id"]
    logger.info("Event creation SUCCEEDED. Event ID: %s", event_id)

    logger.info("--- Testing Event Update ---")
    updated_summary = "Test Outfit Saved by DressApp (Updated)"
    updated_event = await calendar_service.update_calendar_event(
        user, event_id, updated_summary, description, "2026-08-01", "11:00"
    )
    if not updated_event:
        logger.error("Event update FAILED!")
    else:
        logger.info("Event update SUCCEEDED.")

    logger.info("--- Testing Event Deletion ---")
    deleted = await calendar_service.delete_calendar_event(user, event_id)
    if not deleted:
        logger.error("Event deletion FAILED!")
    else:
        logger.info("Event deletion SUCCEEDED.")

if __name__ == "__main__":
    asyncio.run(test_crud())
