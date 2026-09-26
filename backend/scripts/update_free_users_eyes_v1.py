"""Update Free tier users in MongoDB to use the 'Eyes v1' model.

Ensures that all Free tier users in the production database have their
AI model configuration set to:
  selected_model: "Eyes v1"
  selected_provider: "dressapp"
  provider_mode: "dressapp"

Usage:
    # Dry run (inspect what would change without modifying DB):
    python -m scripts.update_free_users_eyes_v1 --dry-run

    # Perform update:
    python -m scripts.update_free_users_eyes_v1
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
from app.config import settings  # noqa: E402
from app.services.credit_manager import get_user_tier  # noqa: E402


def _build_updated_ai_config(existing: dict | None) -> dict:
    base = {
        "provider_mode": "dressapp",
        "selected_provider": "dressapp",
        "selected_model": "Eyes v1",
        "custom_keys": {},
        "current_credits": 1000,
        "credits_used_this_month": 0,
    }
    if isinstance(existing, dict):
        base.update(existing)
        # Enforce Eyes v1 and dressapp provider for free users
        base["selected_model"] = "Eyes v1"
        base["selected_provider"] = "dressapp"
        if not base.get("provider_mode"):
            base["provider_mode"] = "dressapp"
    return base


async def update_free_users(dry_run: bool = False) -> int:
    db = get_db()
    users = await db.users.find({}).to_list(length=1000)

    total_count = len(users)
    free_users = []
    skipped_users = []

    for u in users:
        email = (u.get("email") or "").strip().lower()
        roles = u.get("roles") or []
        sub = u.get("subscription") or {}
        tier = get_user_tier(u)

        # Safety perimeter: Never modify admins, testers, or active paid subscribers
        is_admin_or_tester = (
            email in settings.admin_emails_set
            or email in settings.tester_emails_set
            or "admin" in roles
            or "tester" in roles
            or u.get("is_tester") is True
            or sub.get("is_tester") is True
        )
        is_paid_active = (
            sub.get("is_active") is True
            and sub.get("tier") in ["manager", "professional", "business", "pro"]
            and sub.get("plan_type") != "free"
        )

        if is_admin_or_tester or is_paid_active or tier != "free":
            skipped_users.append((email or u.get("id"), tier, roles))
            continue

        free_users.append(u)

    print(f"Total users scanned: {total_count}")
    print(f"Non-free / protected users skipped ({len(skipped_users)}):")
    for identifier, tier, roles in skipped_users:
        print(f"  - {identifier} | tier={tier} | roles={roles}")

    print(f"\nFree users evaluated: {len(free_users)}")

    updated_count = 0
    already_valid_count = 0

    now_iso = datetime.now(timezone.utc).isoformat()

    for u in free_users:
        user_id = u.get("id") or str(u.get("_id"))
        email = u.get("email") or user_id
        existing_ai_cfg = u.get("ai_configuration")

        current_model = existing_ai_cfg.get("selected_model") if isinstance(existing_ai_cfg, dict) else None
        current_provider = existing_ai_cfg.get("selected_provider") if isinstance(existing_ai_cfg, dict) else None

        if current_model == "Eyes v1" and current_provider == "dressapp" and isinstance(existing_ai_cfg, dict):
            already_valid_count += 1
            print(f"  [ALREADY OK] {email} (model={current_model}, provider={current_provider})")
            continue

        new_ai_cfg = _build_updated_ai_config(existing_ai_cfg)

        if dry_run:
            print(f"  [WOULD UPDATE] {email} -> model='Eyes v1', provider='dressapp'")
            updated_count += 1
        else:
            await db.users.update_one(
                {"_id": u["_id"]},
                {
                    "$set": {
                        "ai_configuration": new_ai_cfg,
                        "updated_at": now_iso,
                    }
                },
            )
            print(f"  [UPDATED] {email} -> model='Eyes v1', provider='dressapp'")
            updated_count += 1

    mode_label = "DRY RUN COMPLETE" if dry_run else "UPDATE COMPLETE"
    print(f"\n=== {mode_label} ===")
    print(f"Total Free users: {len(free_users)}")
    print(f"Already configured with Eyes v1: {already_valid_count}")
    print(f"Updated (or would update): {updated_count}")

    # Post-verification
    if not dry_run and updated_count > 0:
        print("\nVerifying updates in database...")
        mismatched = []
        for u in free_users:
            fresh = await db.users.find_one({"_id": u["_id"]})
            cfg = fresh.get("ai_configuration") if fresh else None
            if not cfg or cfg.get("selected_model") != "Eyes v1" or cfg.get("selected_provider") != "dressapp":
                mismatched.append(fresh.get("email") or fresh.get("id"))

        if mismatched:
            print(f"ERROR: {len(mismatched)} free users failed verification: {mismatched}")
            return 1
        else:
            print(f"VERIFICATION SUCCESSFUL: All {len(free_users)} free users now have Eyes v1 model configured!")

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Update free tier users to Eyes v1 model in MongoDB")
    parser.add_argument("--dry-run", action="store_true", help="Simulate changes without modifying MongoDB")
    args = parser.parse_args()

    exit_code = asyncio.run(update_free_users(dry_run=args.dry_run))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
