"""Migration script: Migrate dev@dressapp.io account to dressapdeveloper@gmail.com.

Preserves the existing user ID, chat sessions, closet items, and configuration,
while granting admin and tester roles and updating the display name.

Usage:
    python -m scripts.migrate_dev_to_dressappdeveloper
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Make the backend package importable when this script is run directly.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

if not os.environ.get("MONGO_URL"):
    print("ERROR: MONGO_URL not set in environment or .env", file=sys.stderr)
    sys.exit(2)

from app.db.database import get_db, get_client  # noqa: E402
from app.services.credit_manager import ensure_monthly_subscription_credits  # noqa: E402


async def migrate() -> int:
    db = get_db()
    target_email = "dressappdeveloper@gmail.com"
    alias_emails = ["dressapdeveloper@gmail.com", "dev@dressapp.io"]

    now_iso = datetime.now(timezone.utc).isoformat()

    target_user = await db.users.find_one({"email": target_email})
    alias_users = await db.users.find({"email": {"$in": alias_emails}}).to_list(10)

    # 1. Determine target user ID
    if not target_user:
        if alias_users:
            primary_old = alias_users[0]
            print(f"Renaming alias user {primary_old.get('email')} (ID={primary_old.get('id')}) to {target_email}...")
            await db.users.update_one(
                {"id": primary_old["id"]},
                {"$set": {"email": target_email, "display_name": "DressApp Developer", "updated_at": now_iso}},
            )
            target_user = await db.users.find_one({"email": target_email})
            alias_users = [u for u in alias_users if u["id"] != primary_old["id"]]
        else:
            import uuid
            user_id = str(uuid.uuid4())
            print(f"Creating brand-new user for {target_email} (ID={user_id})...")
            doc = {
                "id": user_id,
                "email": target_email,
                "display_name": "DressApp Developer",
                "roles": ["user", "admin", "tester"],
                "subscription": {
                    "is_active": True,
                    "plan_type": "tester",
                    "tier": "professional",
                    "is_tester": True,
                    "expires_at": None,
                    "last_credit_cycle_start": now_iso,
                    "credits_allocated_cycle": 100,
                },
                "migration_flag": "New",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.users.insert_one(doc)
            target_user = await db.users.find_one({"email": target_email})

    target_id = target_user["id"]
    print(f"Target user established: {target_email} (ID={target_id})")

    # 2. Merge collections from any alias users into target user
    for old_u in alias_users:
        old_id = old_u.get("id")
        if not old_id or old_id == target_id:
            continue
        print(f"Merging data from {old_u.get('email')} (ID={old_id}) into {target_id}...")

        # Migrate closet_items
        c_res = await db.closet_items.update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})
        if c_res.modified_count:
            print(f"  Moved {c_res.modified_count} closet items.")

        # Migrate stylist sessions
        s_res = await db.stylist_sessions.update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})
        if s_res.modified_count:
            print(f"  Moved {s_res.modified_count} stylist sessions.")

        # Migrate outfits
        o_res = await db.outfits.update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})
        if o_res.modified_count:
            print(f"  Moved {o_res.modified_count} outfits.")

        # Migrate shared_outfits
        so_res = await db.shared_outfits.update_many({"owner_id": old_id}, {"$set": {"owner_id": target_id}})
        if so_res.modified_count:
            print(f"  Moved {so_res.modified_count} shared outfits.")

        # Migrate suitcases
        sc_res = await db.suitcases.update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})
        if sc_res.modified_count:
            print(f"  Moved {sc_res.modified_count} suitcases.")

        # Migrate suitcase archives
        sa_res = await db.suitcase_archives.update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})
        if sa_res.modified_count:
            print(f"  Moved {sa_res.modified_count} suitcase archives.")

        # Migrate daily proposals
        dp_res = await db.daily_proposals.update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})
        if dp_res.modified_count:
            print(f"  Moved {dp_res.modified_count} daily proposals.")

        # Migrate remaining user-referenced collections
        for coll_name in ["user_credits", "simulated_notifications", "token_usage", "ai_credit_purchases", "atzmai_topups"]:
            await db[coll_name].update_many({"user_id": old_id}, {"$set": {"user_id": target_id}})

        # Delete the obsolete alias user document
        await db.users.delete_one({"id": old_id})
        print(f"  Removed obsolete alias user {old_u.get('email')} (ID={old_id})")

    # 3. Ensure target user has admin and professional tester privileges, 100 credits, and dismissed migration
    roles = list(set(list(target_user.get("roles") or []) + ["user", "admin", "tester"]))
    sub = dict(target_user.get("subscription") or {})
    sub["is_active"] = True
    sub["plan_type"] = "tester"
    sub["tier"] = "professional"
    sub["is_tester"] = True
    sub["expires_at"] = None
    if not sub.get("last_credit_cycle_start"):
        sub["last_credit_cycle_start"] = now_iso
    sub["credits_allocated_cycle"] = 100

    await db.users.update_one(
        {"id": target_id},
        {
            "$set": {
                "roles": roles,
                "subscription": sub,
                "migration_flag": "New",
                "updated_at": now_iso,
            }
        },
    )
    print(f"Updated {target_email} with roles={roles}, Professional tester subscription, and migration_flag='dismissed'.")

    # 4. Top up subscription credits for the month
    try:
        refreshed_user = await db.users.find_one({"id": target_id})
        await ensure_monthly_subscription_credits(refreshed_user, db)
        print(f"Ensured monthly subscription credits for {target_email}")
    except Exception as exc:
        print(f"Warning: Credit allocation error: {exc}")

    # 5. Verification count
    sessions_count = await db.stylist_sessions.count_documents({"user_id": target_id})
    clothes_count = await db.closet_items.count_documents({"user_id": target_id})
    print(f"SUCCESS: {target_email} has {sessions_count} stylist sessions and {clothes_count} closet items intact.")
    return 0


async def _main():
    code = await migrate()
    client = get_client()
    client.close()
    sys.exit(code)


if __name__ == "__main__":
    asyncio.run(_main())
