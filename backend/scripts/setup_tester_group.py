"""CLI management for the DressApp Professional Tester Group.

Users in the tester group enjoy the Professional tier for free with unlimited closet capacity,
unlimited AI operations, daily morning styling scheduler, and Trend-Scout access.

Usage:
    # Grant tester group membership (Professional plan for free)
    python -m scripts.setup_tester_group user@example.com

    # Grant multiple testers at once
    python -m scripts.setup_tester_group maystarboard@gmail.com lokoprod@gmail.com

    # Revoke tester status
    python -m scripts.setup_tester_group user@example.com --revoke

    # List current tester group members
    python -m scripts.setup_tester_group --list
"""
from __future__ import annotations

import argparse
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


async def _grant_tester(email: str) -> int:
    db = get_db()
    email_clean = email.strip().lower()
    user = await db.users.find_one({"email": email_clean})
    if not user:
        print(f"Warning: User with email '{email_clean}' not found in DB yet. Creating a pre-provisioned tester user.")
        import uuid
        now_iso = datetime.now(timezone.utc).isoformat()
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "email": email_clean,
            "display_name": email_clean.split("@")[0],
            "roles": ["user", "tester"],
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
        print(f"SUCCESS: Pre-provisioned user {email_clean} as Professional Tester (id={user_id})")
        return 0

    roles = list(user.get("roles") or ["user"])
    if "user" not in roles:
        roles.append("user")
    if "tester" not in roles:
        roles.append("tester")

    sub = dict(user.get("subscription") or {})
    sub["is_active"] = True
    sub["plan_type"] = "tester"
    sub["tier"] = "professional"
    sub["is_tester"] = True
    sub["expires_at"] = None

    now_iso = datetime.now(timezone.utc).isoformat()
    if not sub.get("last_credit_cycle_start"):
        sub["last_credit_cycle_start"] = now_iso
    sub["credits_allocated_cycle"] = 100

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "roles": roles,
                "subscription": sub,
                "updated_at": now_iso,
            }
        },
    )

    # Ensure monthly AI credits are credited
    updated_user = await db.users.find_one({"id": user["id"]})
    if updated_user:
        await ensure_monthly_subscription_credits(updated_user, db)

    print(f"SUCCESS: {email_clean} is now in the Tester Group with free Professional tier.")
    print(f"  Roles: {roles}")
    print(f"  Subscription: {sub}")
    return 0


async def _revoke_tester(email: str) -> int:
    db = get_db()
    email_clean = email.strip().lower()
    user = await db.users.find_one({"email": email_clean})
    if not user:
        print(f"ERROR: User '{email_clean}' not found in DB.", file=sys.stderr)
        return 1

    roles = [r for r in (user.get("roles") or ["user"]) if r != "tester"]
    sub = dict(user.get("subscription") or {})
    if sub.get("plan_type") == "tester":
        sub["is_active"] = False
        sub["tier"] = "free"
        sub["plan_type"] = "free"
    sub["is_tester"] = False

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "roles": roles,
                "subscription": sub,
                "updated_at": now_iso,
            }
        },
    )
    print(f"SUCCESS: Revoked tester status from {email_clean}. Tier reverted.")
    return 0


async def _list_testers() -> int:
    db = get_db()
    cursor = db.users.find(
        {
            "$or": [
                {"roles": "tester"},
                {"subscription.is_tester": True},
                {"subscription.plan_type": "tester"},
            ]
        },
        {"email": 1, "roles": 1, "subscription": 1, "id": 1},
    )
    testers = await cursor.to_list(100)
    print(f"\n--- DressApp Tester Group Members ({len(testers)}) ---")
    if not testers:
        print("  (No testers currently found in DB)")
    for t in testers:
        sub = t.get("subscription") or {}
        print(f"  * {t.get('email')} (id={t.get('id')})")
        print(f"    - Roles: {t.get('roles')}")
        print(f"    - Tier: {sub.get('tier')} (Active: {sub.get('is_active')}, Plan: {sub.get('plan_type')})")
    print("--------------------------------------------------\n")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("emails", nargs="*", help="One or more user email addresses to add or revoke.")
    parser.add_argument("--revoke", action="store_true", help="Revoke tester status instead of granting.")
    parser.add_argument("--list", action="store_true", help="List all users currently in the tester group.")

    args = parser.parse_args()

    if args.list:
        return asyncio.run(_list_testers())

    if not args.emails:
        parser.print_help()
        return 2

    exit_code = 0
    for email in args.emails:
        if args.revoke:
            code = asyncio.run(_revoke_tester(email))
        else:
            code = asyncio.run(_grant_tester(email))
        if code != 0:
            exit_code = code

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
