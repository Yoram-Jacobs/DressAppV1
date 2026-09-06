"""User profile routes."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.db.database import get_db
from app.models.schemas import CulturalContext, StyleProfile
from app.services.auth import get_current_user, verify_password
from app.services.avatar_service import calculate_shape_parameters

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


class UpdateUserIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
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
    birthday: str | None = None
    sex: str | None = None
    gender: str | None = None
    personal_status: str | None = None
    marital_status: str | None = None
    address: dict[str, Any] | None = None
    city: str | None = None
    country: str | None = None
    units: dict[str, Any] | None = None
    face_photo_url: str | None = None
    body_photo_url: str | None = None
    skin_tone: str | None = None
    body_measurements: dict[str, Any] | None = None
    measurements: dict[str, Any] | None = None
    hair: dict[str, Any] | None = None

    # --- Phase U: Professional ---
    professional: dict[str, Any] | None = None
    is_stylist: bool | None = None
    stylist_bio: str | None = None
    hourly_rate: float | None = None
    booking_url: str | None = None
    specialties: list[str] | None = None

    # --- Shopping Assistant ---
    shopping_assistant: dict[str, Any] | None = None

    # --- Phase 4P: PayPal payouts ---
    paypal_receiver_email: str | None = None

    # --- Phase TS-2 (Trend-Scout personalization) ---
    occupation: str | None = None

    # --- Migration & Competitor Onboarding ---
    migration_flag: str | None = None
    migration_details: dict[str, Any] | None = None

    # --- AI Stylist Scheduler Settings (Phase Scheduler) ---
    scheduler_settings: dict[str, Any] | None = None
    scheduler_enabled: bool | None = None
    morning_notification_time: str | None = None

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
    
    # Normalize aliases so all frontends receive expected keys
    if "date_of_birth" in safe and "birthday" not in safe:
        safe["birthday"] = safe["date_of_birth"]
    if "birthday" in safe and "date_of_birth" not in safe:
        safe["date_of_birth"] = safe["birthday"]
    if "sex" in safe and "gender" not in safe:
        safe["gender"] = safe["sex"]
    if "gender" in safe and "sex" not in safe:
        safe["sex"] = safe["gender"]
    if "personal_status" in safe and "marital_status" not in safe:
        safe["marital_status"] = safe["personal_status"]
    if "marital_status" in safe and "personal_status" not in safe:
        safe["personal_status"] = safe["marital_status"]
        
    addr = safe.get("address") or safe.get("home_location") or {}
    if isinstance(addr, dict):
        if "city" not in safe and addr.get("city"):
            safe["city"] = addr.get("city")
        if "country" not in safe and addr.get("country"):
            safe["country"] = addr.get("country")
            
    if "body_measurements" in safe and "measurements" not in safe:
        safe["measurements"] = safe["body_measurements"]
    if "measurements" in safe and "body_measurements" not in safe:
        safe["body_measurements"] = safe["measurements"]

    # Normalize subscription & tier
    sub = safe.get("subscription") or {}
    if isinstance(sub, dict):
        if sub.get("is_active") and sub.get("tier"):
            safe["subscription_tier"] = sub.get("tier")
        else:
            safe["subscription_tier"] = "free"
    else:
        safe["subscription_tier"] = "free"

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
    from app.services.sync_service import broadcast_sync_event
    await broadcast_sync_event(user["id"], "profile_updated")
    return {"status": "ok", "migration_flag": flag}


@router.patch("/me")
async def update_me(
    payload: UpdateUserIn, user: dict = Depends(get_current_user)
) -> dict[str, Any]:
    """Partial profile update."""
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
        "measurements",
        "address",
        "units",
        "hair",
        "home_location",
        "professional",
        "style_profile",
        "cultural_context",
        "scheduler_settings",
        "shopping_assistant",
    )

    db = get_db()
    set_ops: dict[str, Any] = {}

    # Normalize aliases in incoming patch
    if "birthday" in patch:
        set_ops["date_of_birth"] = patch["birthday"]
        set_ops["birthday"] = patch["birthday"]
    if "date_of_birth" in patch:
        set_ops["date_of_birth"] = patch["date_of_birth"]
        set_ops["birthday"] = patch["date_of_birth"]
    if "gender" in patch:
        set_ops["sex"] = patch["gender"]
        set_ops["gender"] = patch["gender"]
    if "sex" in patch:
        set_ops["sex"] = patch["sex"]
        set_ops["gender"] = patch["sex"]
    if "marital_status" in patch:
        set_ops["personal_status"] = patch["marital_status"]
        set_ops["marital_status"] = patch["marital_status"]
    if "personal_status" in patch:
        set_ops["personal_status"] = patch["personal_status"]
        set_ops["marital_status"] = patch["personal_status"]
    if "city" in patch:
        set_ops["city"] = patch["city"]
        set_ops["address.city"] = patch["city"]
        set_ops["home_location.city"] = patch["city"]
    if "country" in patch:
        set_ops["country"] = patch["country"]
        set_ops["address.country"] = patch["country"]
        set_ops["home_location.country"] = patch["country"]

    if "ai_configuration" in patch and patch["ai_configuration"] is not None:
        ai_config = patch["ai_configuration"]
        existing_config = user.get("ai_configuration") or {}
        provider_mode = ai_config.get("provider_mode") or existing_config.get("provider_mode") or "custom_keys"
        
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
                key_str = str(key_val).strip()
                from app.services.auth import decrypt_api_key, encrypt_api_key
                if key_str.startswith("gAAAAA"):
                    unwrapped = decrypt_api_key(key_str)
                    if unwrapped:
                        key_str = unwrapped

                if key_name == "google_ai" and key_str:
                    from app.services.gemini_client import GeminiClient
                    client = GeminiClient(api_key=key_str)
                    try:
                        resp = await client.text(user_text="Test connection.", model="gemini-3.5-flash")
                        if not resp:
                            raise ValueError("No response from Google Gemini")
                    except Exception as exc:
                        logger.warning("Gemini key validation failed during patch: %s", exc)
                        err_text = str(exc)
                        if "API_KEY_SERVICE_BLOCKED" in err_text or "blocked" in err_text.lower():
                            msg = (
                                "This Google API key is blocked from accessing Gemini (API_KEY_SERVICE_BLOCKED). "
                                "Please ensure 'Generative Language API' is enabled in your Google Cloud Console, "
                                "or generate a dedicated key at Google AI Studio (https://aistudio.google.com/app/apikey)."
                            )
                        elif "RESOURCE_EXHAUSTED" in err_text or "spending cap" in err_text.lower():
                            msg = "This Google Gemini key has exceeded its quota or monthly spend cap (RESOURCE_EXHAUSTED)."
                        else:
                            msg = f"Google Gemini API key validation failed: {exc}"
                        raise HTTPException(
                            status_code=400,
                            detail=msg,
                        ) from exc

                # Encrypt new key
                merged_keys[key_name] = encrypt_api_key(key_str)
                
        set_ops["ai_configuration"] = {
            "provider_mode": provider_mode,
            "custom_keys": merged_keys,
            "selected_provider": ai_config.get("selected_provider") or existing_config.get("selected_provider") or "google_ai",
            "selected_model": ai_config.get("selected_model") or existing_config.get("selected_model") or "gemini-3.5-flash",
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

    # Automatic storage upload, background removal & tight normalization for avatar, face & body photos
    from app.services.upload_manager import UploadManager
    from app.services.image_compression import compress_image_bytes
    import base64
    import io
    from PIL import Image, ImageOps

    async def _segment_and_crop_profile_photo(raw_bytes: bytes, mode: str = "face") -> tuple[bytes, str, str]:
        """
        Remove background and crop to subject bounding box for profile face and full-body photos.
        Returns (image_bytes, mime_type, extension).
        """
        try:
            from app.services.background_matting import remove_background

            orig = Image.open(io.BytesIO(raw_bytes))
            orig = ImageOps.exif_transpose(orig).convert("RGB")

            # Downscale input to 768px for fast inference (<1.5s on CPU)
            max_dim = 768
            w, h = orig.size
            if max(w, h) > max_dim:
                scale = max_dim / float(max(w, h))
                orig = orig.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)

            buf = io.BytesIO()
            orig.save(buf, format="JPEG", quality=88)

            matted = await remove_background(buf.getvalue())
            if matted and matted.get("image_png"):
                cutout = Image.open(io.BytesIO(matted["image_png"])).convert("RGBA")
                bbox = cutout.getbbox()
                if bbox:
                    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
                    pad_x = int(bw * 0.03)
                    pad_y = int(bh * 0.03)
                    cw, ch = cutout.size
                    crop_box = (
                        max(0, bbox[0] - pad_x),
                        max(0, bbox[1] - pad_y),
                        min(cw, bbox[2] + pad_x),
                        min(ch, bbox[3] + pad_y),
                    )
                    cutout = cutout.crop(crop_box)

                out_buf = io.BytesIO()
                cutout.save(out_buf, format="PNG", optimize=True)
                return out_buf.getvalue(), "image/png", "png"
        except Exception as exc:
            logger.warning("Profile photo segmentation fallback for %s: %s", mode, exc)

        compressed = compress_image_bytes(raw_bytes, max_dim=1024, quality=80)
        return compressed, "image/jpeg", "jpg"

    for photo_field in ("avatar_url", "face_photo_url", "body_photo_url"):
        val = patch.get(photo_field)
        if val and isinstance(val, str) and val.startswith("data:image"):
            try:
                header, b64_str = val.split(",", 1)
                img_bytes = base64.b64decode(b64_str)
                mode = "face" if photo_field in ("face_photo_url", "avatar_url") else "body"

                processed_bytes, mime, ext = await _segment_and_crop_profile_photo(img_bytes, mode=mode)
                uploaded_url = await UploadManager.upload_bytes(processed_bytes, mime, ext)
                set_ops[photo_field] = uploaded_url
                if photo_field == "face_photo_url" and "avatar_url" not in patch:
                    set_ops["avatar_url"] = uploaded_url
                elif photo_field == "avatar_url" and "face_photo_url" not in patch:
                    set_ops["face_photo_url"] = uploaded_url
            except Exception as photo_exc:
                logger.warning("Failed to process/upload %s for user %s: %s", photo_field, user["id"], photo_exc)


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
        from app.services.sync_service import broadcast_sync_event
        await broadcast_sync_event(user["id"], "profile_updated")

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
    try:
        await email_service.send_deletion_email(
            to=user["email"],
            display_name=user.get("display_name") or user.get("email").split("@")[0]
        )
    except Exception as exc:
        logger.error("Failed to send deletion email: %s", exc)

    return {"deleted": True}


class ValidateApiKeyRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    provider: str = "google_ai"
    api_key: str


@router.post("/validate-api-key")
async def validate_api_key(
    payload: ValidateApiKeyRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Test user's API key against the provider before saving."""
    key = (payload.api_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")

    provider = payload.provider.lower()
    if provider == "google_ai":
        from app.services.gemini_client import GeminiClient
        client = GeminiClient(api_key=key)
        try:
            resp = await client.text(user_text="Test connection.", model="gemini-3.5-flash")
            if resp:
                return {
                    "valid": True,
                    "provider": "google_ai",
                    "message": "Google Gemini API key is valid and connected successfully.",
                }
            raise ValueError("Empty response received from Gemini.")
        except Exception as exc:
            logger.warning("Google AI key validation failed: %s", exc)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Google Gemini API key: {exc}",
            ) from exc

    return {
        "valid": True,
        "provider": provider,
        "message": f"{provider} API key format accepted.",
    }


