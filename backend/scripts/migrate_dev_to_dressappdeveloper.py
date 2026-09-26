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
    old_email = "dev@dressapp.io"
    new_email = "dressapdeveloper@gmail.com"

    old_user = await db.users.find_one({"email": old_email})
    new_user = await db.users.find_one({"email": new_email})

    now_iso = datetime.now(timezone.utc).isoformat()

    if old_user:
        print(f"Found existing old dev user: ID={old_user.get('id')}, email={old_user.get('email')}")
        if new_user and new_user["id"] != old_user["id"]:
            print(f"WARNING: A separate user with email {new_email} already exists (ID={new_user['id']}).")
            print("Merging or keeping existing new user roles.")
            roles = list(set(list(new_user.get("roles") or []) + ["user", "admin", "tester"]))
            await db.users.update_one(
                {"id": new_user["id"]},
                {
                    "$set": {
                        "roles": roles,
                        "subscription.tier": "professional",
                        "subscription.plan_type": "tester",
                        "subscription.is_tester": True,
                        "subscription.is_active": True,
                        "updated_at": now_iso,
                    }
                },
            )
            print(f"Updated existing {new_email} with admin & tester roles.")
            return 0

        # Update the old user document in-place to new email
        roles = list(set(list(old_user.get("roles") or []) + ["user", "admin", "tester"]))
        sub = dict(old_user.get("subscription") or {})
        sub["is_active"] = True
        sub["plan_type"] = "tester"
        sub["tier"] = "professional"
        sub["is_tester"] = True
        sub["expires_at"] = None
        if not sub.get("last_credit_cycle_start"):
            sub["last_credit_cycle_start"] = now_iso
        sub["credits_allocated_cycle"] = 100

        res = await db.users.update_one(
            {"id": old_user["id"]},
            {
                "$set": {
                    "email": new_email,
                    "display_name": "DressApp Developer",
                    "roles": roles,
                    "subscription": sub,
                    "updated_at": now_iso,
                }
            },
        )
        print(f"Successfully migrated user ID={old_user['id']} from {old_email} to {new_email}. Matched: {res.matched_count}, Modified: {res.modified_count}")

        # Top up subscription credits for the month
        try:
            await ensure_monthly_subscription_credits(old_user["id"], tier="professional")
            print(f"Ensured monthly subscription credits for {new_email}")
        except Exception as exc:
            print(f"Warning: Credit allocation error: {exc}")

        # Count related collections to verify data preservation
        sessions_count = await db.stylist_sessions.count_documents({"user_id": old_user["id"]})
        clothes_count = await db.clothes.count_documents({"user_id": old_user["id"]})
        print(f"Data verification: User has {sessions_count} stylist sessions and {clothes_count} closet items intact.")
        return 0

    elif new_user:
        print(f"Old dev user not found, but {new_email} already exists (ID={new_user.get('id')}).")
        roles = list(set(list(new_user.get("roles") or []) + ["user", "admin", "tester"]))
        sub = dict(new_user.get("subscription") or {})
        sub["is_active"] = True
        sub["plan_type"] = "tester"
        sub["tier"] = "professional"
        sub["is_tester"] = True
        sub["expires_at"] = None
        await db.users.update_one(
            {"id": new_user["id"]},
            {
                "$set": {
                    "roles": roles,
                    "subscription": sub,
                    "updated_at": now_iso,
                }
            },
        )
        print(f"Ensured admin and tester roles for {new_email}")
        return 0

    else:
        print(f"Neither {old_email} nor {new_email} found. Pre-provisioning {new_email}...")
        import uuid

        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "email": new_email,
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
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        await db.users.insert_one(doc)
        print(f"SUCCESS: Pre-provisioned user {new_email} as Admin & Professional Tester (id={user_id})")
        return 0


async def _main():
    code = await migrate()
    client = get_client()
    client.close()
    sys.exit(code)


if __name__ == "__main__":
    asyncio.run(_main())
