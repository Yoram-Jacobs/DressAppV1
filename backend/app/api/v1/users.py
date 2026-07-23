"""User profile routes."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.db.database import get_db
from app.models.schemas import CulturalContext, StyleProfile
from app.services.auth import get_current_user, verify_password
from app.services.avatar_service import calculate_shape_parameters

router = APIRouter(prefix="/users", tags=["users"])


class UpdateUserIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = None
    avatar_url: str | None = None
    locale: str | None = None
    preferred_language: str | None = None
    preferred_voice_id: str | None = None
    home_location: dict[str, Any] | None = None
    style_profile: StyleProfile | None = None
    cultural_context: CulturalContext | None = None

    # --- Extended profile (Phase T) ---
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    date_of_birth: str | None = None
    sex: str | None = None
    personal_status: str | None = None
    address: dict[str, Any] | None = None
    units: dict[str, Any] | None = None
    face_photo_url: str | None = None
    body_photo_url: str | None = None
    skin_tone: str | None = None
    body_measurements: dict[str, Any] | None = None
    hair: dict[str, Any] | None = None

    # --- Phase U: Professional ---
    professional: dict[str, Any] | None = None

    # --- Phase 4P: PayPal payouts ---
    paypal_receiver_email: str | None = None

    # --- Phase TS-2 (Trend-Scout personalization) ---
    occupation: str | None = None

    # --- Migration & Competitor Onboarding ---
    migration_flag: str | None = None
    migration_details: dict[str, Any] | None = None

    # --- AI Stylist Scheduler Settings (Phase Scheduler) ---
    scheduler_settings: dict[str, Any] | None = None

    # --- AI Settings (F3 pay-as-you-go) ---
    ai_configuration: dict[str, Any] | None = None


class MigrationFlagIn(BaseModel):
    migration_flag: str  # "New" | "Migrate"
    app_name: str | None = None
    app_url: str | None = None
    credentials: str | None = None
    notes: str | None = None


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    safe = {k: v for k, v in user.items() if k not in {"password_hash", "google_oauth"}}
    safe["google_connected"] = bool(user.get("google_oauth"))
    safe["has_password"] = bool(user.get("password_hash"))
    
    # Mask API keys to keep them secured
    if "ai_configuration" in safe:
        ai_config = dict(safe["ai_configuration"])
        if "custom_keys" in ai_config:
            custom_keys = dict(ai_config["custom_keys"])
            for key_name in list(custom_keys.keys()):
                if custom_keys[key_name]:
                    custom_keys[key_name] = True
                else:
                    custom_keys[key_name] = False
            ai_config["custom_keys"] = custom_keys
        safe["ai_configuration"] = ai_config
        
    return safe


@router.patch("/migration-flag")
async def update_migration_flag(
    payload: MigrationFlagIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Set migration_flag ('New' or 'Migrate') and store competitor details."""
    db = get_db()
    flag = "Migrate" if payload.migration_flag.lower() == "migrate" else "New"
    update_data: dict[str, Any] = {
        "migration_flag": flag,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if flag == "Migrate":
        update_data["migration_details"] = {
            "app_name": payload.app_name or "Competitor App",
            "app_url": payload.app_url,
            "credentials": payload.credentials,
            "notes": payload.notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    return {"status": "ok", "migration_flag": flag}


@router.patch("/me")
async def update_me(
    payload: UpdateUserIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Partial profile update.

    **Important — embedded-document merge semantics.** Mongo's
    ``$set`` on a nested dict (e.g. ``body_measurements``) wholesale
    replaces the dict, dropping every field not present in the
    incoming payload. That's the opposite of what users expect from
    a "PATCH" — and a real data-loss bug when a frontend form sends
    only the fields it knows about (e.g. a cropped/pruned body
    measurements blob from a partial form re-render).

    To make the endpoint safe under all callers, we **deep-merge**
    every dict-typed field into its existing value instead of
    overwriting it. Scalar fields keep ``$set`` semantics. Setting
    a dict field to ``{}`` explicitly is treated as "no change"
    (use a dedicated reset endpoint if you ever need to fully wipe
    a sub-document — none currently exists).
    """
    patch = payload.model_dump(exclude_none=True)
    if "style_profile" in patch and patch["style_profile"] is not None:
        patch["style_profile"] = patch["style_profile"] if isinstance(
            patch["style_profile"], dict
        ) else patch["style_profile"].model_dump()
    if "cultural_context" in patch and patch["cultural_context"] is not None:
        patch["cultural_context"] = patch["cultural_context"] if isinstance(
            patch["cultural_context"], dict
        ) else patch["cultural_context"].model_dump()

    # Embedded-document fields that must MERGE (not replace) so a
    # partial PATCH cannot wipe values the frontend wasn't aware of.
    _MERGEABLE_DICT_FIELDS = (
        "body_measurements",
        "address",
        "units",
        "hair",
        "home_location",
        "professional",
        "style_profile",
        "cultural_context",
        "scheduler_settings",
    )

    db = get_db()
    set_ops: dict[str, Any] = {}

    if "ai_configuration" in patch and patch["ai_configuration"] is not None:
        ai_config = patch["ai_configuration"]
        existing_config = user.get("ai_configuration") or {}
        provider_mode = ai_config.get("provider_mode") or existing_config.get("provider_mode") or "standard"
        
        # Merge custom keys
        existing_keys = existing_config.get("custom_keys") or {}
        new_keys = ai_config.get("custom_keys") or {}
        
        merged_keys = dict(existing_keys)
        for key_name, key_val in new_keys.items():
            if key_val is True:
                # Keep existing key
                continue
            elif key_val == "" or key_val is None:
                # Remove key
                merged_keys.pop(key_name, None)
            else:
                # Encrypt new key
                from app.services.auth import encrypt_api_key
                merged_keys[key_name] = encrypt_api_key(str(key_val))
                
        set_ops["ai_configuration"] = {
            "provider_mode": provider_mode,
            "custom_keys": merged_keys,
            "selected_provider": ai_config.get("selected_provider") or existing_config.get("selected_provider") or "google_ai",
            "selected_model": ai_config.get("selected_model") or existing_config.get("selected_model") or "gemini-2.5-flash",
            "current_credits": ai_config.get("current_credits", existing_config.get("current_credits", 1000)),
            "credits_used_this_month": ai_config.get("credits_used_this_month", existing_config.get("credits_used_this_month", 0))
        }

    for k, v in patch.items():
        if k == "ai_configuration":
            continue
        if k in _MERGEABLE_DICT_FIELDS and isinstance(v, dict):
            # Check if parent is not a dictionary in database (e.g. null or missing)
            db_val = user.get(k)
            if not isinstance(db_val, dict):
                # Write direct subfield values without dot notation to prevent WriteError 28
                set_ops[k] = {sub_k: sub_v for sub_k, sub_v in v.items() if sub_v is not None}
            else:
                # Mongo dot-notation: ``$set: {"body_measurements.chest": 92}``
                # leaves every other ``body_measurements.*`` field untouched.
                for sub_k, sub_v in v.items():
                    if sub_v is None:
                        continue
                    set_ops[f"{k}.{sub_k}"] = sub_v
        else:
            set_ops[k] = v

    # Explicitly handle cleared photo & text fields (Remove button sets field = None / "")
    for clearable in ("body_photo_url", "face_photo_url", "avatar_url", "skin_tone"):
        if clearable in payload.model_fields_set:
            val = getattr(payload, clearable, None)
            if val is None or val == "":
                set_ops[clearable] = None

    # Automatic background cutout processing for face & body photos
    if "face_photo_url" in patch and patch["face_photo_url"] and isinstance(patch["face_photo_url"], str) and patch["face_photo_url"].startswith("data:image"):
        try:
            import base64
            from app.services.background_matting import remove_background
            b64_str = patch["face_photo_url"].split(",", 1)[-1]
            img_bytes = base64.b64decode(b64_str)
            mat_res = await remove_background(img_bytes)
            if mat_res and mat_res.get("image_png"):
                m_b64 = base64.b64encode(mat_res["image_png"]).decode("utf-8")
                set_ops["face_photo_url"] = f"data:image/png;base64,{m_b64}"
        except Exception:
            pass

    if "body_photo_url" in patch and patch["body_photo_url"] and isinstance(patch["body_photo_url"], str) and patch["body_photo_url"].startswith("data:image"):
        try:
            import base64
            from app.services.background_matting import remove_background
            b64_str = patch["body_photo_url"].split(",", 1)[-1]
            img_bytes = base64.b64decode(b64_str)
            mat_res = await remove_background(img_bytes)
            if mat_res and mat_res.get("image_png"):
                m_b64 = base64.b64encode(mat_res["image_png"]).decode("utf-8")
                set_ops["body_photo_url"] = f"data:image/png;base64,{m_b64}"
        except Exception:
            pass

    set_ops["updated_at"] = datetime.now(timezone.utc).isoformat()
    if set_ops:
        if any(k.startswith("body_measurements.") for k in set_ops):
            raw_bm = user.get("body_measurements")
            current_measurements = dict(raw_bm) if isinstance(raw_bm, dict) else {}
            for k, v in set_ops.items():
                if k.startswith("body_measurements."):
                    sub_k = k.split(".", 1)[1]
                    current_measurements[sub_k] = v
            try:
                set_ops["avatar_shape_params"] = calculate_shape_parameters(current_measurements)
            except Exception:
                pass
            
        await db.users.update_one({"id": user["id"]}, {"$set": set_ops})

    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if updated is not None:
        updated.pop("password_hash", None)
        updated.pop("google_oauth", None)
    return updated or {}


class DeleteAccountIn(BaseModel):
    password: str | None = None
    oauth_provider: str | None = None


@router.post("/me/delete")
async def delete_me(
    payload: DeleteAccountIn,
    user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    db = get_db()
    
    # 1. Verify user identity
    if user.get("password_hash"):
        if not payload.password or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password verification"
            )
    else:
        # OAuth user verification
        if payload.oauth_provider != "google":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAuth verification required"
            )

    user_id = user["id"]
    
    # 2. Collect IDs to delete embeddings
    closet_items = await db.closet_items.find({"user_id": user_id}, {"id": 1}).to_list(length=None)
    closet_item_ids = [item["id"] for item in closet_items]
    
    outfits = await db.outfits.find({"user_id": user_id}, {"id": 1}).to_list(length=None)
    outfit_ids = [o["id"] for o in outfits]
    
    # 3. Perform cascade deletions across all collections
    await db.users.delete_one({"id": user_id})
    await db.closet_items.delete_many({"user_id": user_id})
    await db.outfits.delete_many({"user_id": user_id})
    await db.listings.delete_many({"seller_id": user_id})
    await db.suitcases.delete_many({"user_id": user_id})
    await db.suitcase_archives.delete_many({"user_id": user_id})
    await db.simulated_notifications.delete_many({"user_id": user_id})
    await db.user_credits.delete_many({"user_id": user_id})
    await db.credit_topups.delete_many({"user_id": user_id})
    
    # Cascade Stylist sessions and messages
    sessions = await db.stylist_sessions.find({"user_id": user_id}, {"id": 1}).to_list(length=None)
    session_ids = [s["id"] for s in sessions]
    if session_ids:
        await db.stylist_messages.delete_many({"session_id": {"$in": session_ids}})
    await db.stylist_sessions.delete_many({"user_id": user_id})
    
    # Delete embeddings
    entity_ids = [user_id] + closet_item_ids + outfit_ids
    await db.embeddings.delete_many({"entity_id": {"$in": entity_ids}})
    
    # 4. Dispatch deletion notification email
    from app.services import email_service
    import logging
    logger = logging.getLogger(__name__)
    try:
        await email_service.send_deletion_email(
            to=user["email"],
            display_name=user.get("display_name") or user.get("email").split("@")[0]
        )
    except Exception as exc:
        logger.error("Failed to send deletion email: %s", exc)

    return {"deleted": True}

