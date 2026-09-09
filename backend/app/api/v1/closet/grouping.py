from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from pymongo import ReturnDocument

from app.db.database import get_db
from app.config import settings
from app.models.schemas import (
    ClosetItem,
    DressCode,
    FinancialMetadata,
    Formality,
    GarmentAnalysis,
    GarmentCondition,
    GarmentGender,
    GarmentQuality,
    GarmentState,
    Listing,
    MarketplaceIntent,
    RetailMetadata,
    Source,
    WeightedTag,
)
from app.services import repos
from app.services.auth import (
    get_current_user,
    resolve_user_gemini_api_key,
    resolve_user_gemini_model,
)
from app.services.fees import compute_fees
from app.services.vision import garment_vision_service, get_garment_vision_service
from app.services.fashion_clip import fashion_clip_service
from app.services.gemini_image_service import gemini_image_service, get_gemini_image_service
from app.services.image_compression import (
    compress_b64_image,
    compress_image_bytes,
    compress_image_url_or_b64,
)
from app.services import closet_service
from app.api.v1.closet.common import (
    _active_background_tasks,
    _track_task,
    _ANALYZE_CONCURRENCY,
    _ANALYZE_LOCK,
    _get_item_image_url,
    _pick_segformer_mask_for_category,
    _bytes_from_data_url,
    _ensure_min_resolution,
    _read_image_bytes_from_url,
    _maybe_retry_stale_matte,
    _run_background_matte,
    _run_background_matte_and_analyze,
    _run_background_reconstruction,
    CreateItemIn,
    UpdateItemIn,
    logger,
)

router = APIRouter()

# --- Card Grouping endpoints & helper ---
class GroupItemsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    host_id: str
    member_id: str


class UploadMemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_base64: str
    image_mime: str = "image/jpeg"


class GroupEditIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_host_id: str | None = None
    ungroup_member_ids: list[str] = []
    add_member_ids: list[str] = []
    new_uploads: list[UploadMemberIn] = []


reanalyze_group_helper = closet_service.reanalyze_group_helper
@router.post("/group")
async def group_items(
    payload: GroupItemsIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    host_id = payload.host_id
    member_id = payload.member_id

    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    member = await db.closet_items.find_one({"id": member_id, "user_id": user["id"]})
    if not host or not member:
        raise HTTPException(404, "Host or member item not found")

    # If the member was already the host of another group, we will merge the groups!
    group_id = host.get("group_id") or host_id
    member_group_id = member.get("group_id")

    if member_group_id:
        # Move all members of the member's group to the new group
        await db.closet_items.update_many(
            {"group_id": member_group_id, "user_id": user["id"]},
            {"$set": {"group_id": group_id, "group_role": "member", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # Set host role on B
    await db.closet_items.update_one(
        {"id": host_id},
        {"$set": {"group_id": group_id, "group_role": "host", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Set member role on A (and update group_id)
    await db.closet_items.update_one(
        {"id": member_id},
        {"$set": {"group_id": group_id, "group_role": "member", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Run group reanalysis in the background
    background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    updated_host = await db.closet_items.find_one({"id": host_id})
    updated_member = await db.closet_items.find_one({"id": member_id})

    # Strip pymongo ObjectId
    if updated_host and "_id" in updated_host:
        updated_host.pop("_id")
    if updated_member and "_id" in updated_member:
        updated_member.pop("_id")

    return {
        "status": "success",
        "host": updated_host,
        "member": updated_member
    }



@router.post("/{host_id}/upload-member")
async def upload_group_member(
    host_id: str,
    payload: UploadMemberIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    sub = user.get("subscription") or {}
    is_active = sub.get("is_active", False)
    plan_type = sub.get("plan_type", "free")
    tier = sub.get("tier", "free")
    
    user_tier = "free"
    if is_active and plan_type != "free":
        if tier in ["pro", "manager"]:
            user_tier = "manager"
        elif tier in ["business", "professional"]:
            user_tier = "professional"
            
    if user_tier == "free":
        current_count = await db.closet_items.count_documents({"user_id": user["id"]})
        capacity_limit = min(200, 50 + user.get("closet_capacity_bonus", 0))
        if current_count >= capacity_limit:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "closet_capacity_exceeded",
                    "message": f"You have reached your free closet capacity of {capacity_limit} items. Upgrade to Manager or Professional to add more items.",
                    "capacity": capacity_limit,
                    "current_count": current_count
                }
            )

    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    if not host:
        raise HTTPException(404, "Host item not found")

    group_id = host.get("group_id") or host_id
    if not host.get("group_id") or host.get("group_role") != "host":
        await db.closet_items.update_one(
            {"id": host_id},
            {"$set": {"group_id": group_id, "group_role": "host", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.closet_items.update_one(
            {"id": host_id},
            {"$set": {"group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except Exception as exc:
        raise HTTPException(400, f"Invalid image_base64: {exc}")

    original_data_url = f"data:{payload.image_mime};base64,{payload.image_base64}"
    
    # Create the member closet item document
    from app.models.schemas import ClosetItem
    
    member_item = ClosetItem(
        user_id=user["id"],
        title=f"{host.get('title', 'Garment')} (Back View)",
        category=host.get("category", "Top"),
        sub_category=host.get("sub_category"),
        item_type=host.get("item_type"),
        brand=host.get("brand"),
        gender=host.get("gender"),
        dress_code=host.get("dress_code"),
        colors=host.get("colors") or [],
        color=host.get("color"),
        group_id=group_id,
        group_role="member",
        group_analysis_status="pending",
        original_image_url=original_data_url,
    ).model_dump()

    # Fast single-item segmentation
    segmented_data_url = None
    segmentation_model = None
    vision_service = get_garment_vision_service(user=user)
    if vision_service is not None:
        try:
            detections = await vision_service.detect_items(raw)
            if detections:
                best_det = max(
                    detections,
                    key=lambda d: (
                        max(0, d["bbox"][2] - d["bbox"][0])
                        * max(0, d["bbox"][3] - d["bbox"][1])
                    ),
                )
                raw_crops = await asyncio.to_thread(
                    vision_service._bbox_crop_useful, raw, [best_det]
                )
                from app.services.vision.image import _apply_fast_matte
                out = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                
                if out:
                    _, b64_bytes, mime = out[0]
                elif raw_crops:
                    _, b64_bytes, mime = raw_crops[0]
                else:
                    b64_bytes = None
                
                if b64_bytes:
                    b64 = base64.b64encode(b64_bytes).decode("ascii")
                    segmented_data_url = f"data:{mime or 'image/png'};base64,{b64}"
                    segmentation_model = "the_eyes_single"
        except Exception as exc:
            logger.warning("upload_group_member segment failed: %r", exc)

    if segmented_data_url:
        member_item["segmented_image_url"] = segmented_data_url
        member_item["clean_image_url"] = segmented_data_url
        member_item["segmentation_model"] = segmentation_model
    elif original_data_url:
        member_item["clean_image_url"] = original_data_url


    # Get FashionCLIP embedding for member item
    if fashion_clip_service is not None:
        try:
            embed_bytes = base64.b64decode(segmented_data_url.split(",", 1)[1]) if segmented_data_url else raw
            vec = await fashion_clip_service.embed_image(embed_bytes)
            if vec:
                member_item["clip_embedding"] = vec
                member_item["clip_model"] = fashion_clip_service.model_id
        except Exception as exc:
            logger.warning("upload_group_member CLIP embed failed: %r", exc)

    # Save to DB
    await repos.insert(db.closet_items, member_item)

    # Re-run group analysis in the background
    background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    updated_host = await db.closet_items.find_one({"id": host_id})
    updated_member = await db.closet_items.find_one({"id": member_item["id"]})

    # Strip ObjectId
    if updated_host and "_id" in updated_host:
        updated_host.pop("_id")
    if updated_member and "_id" in updated_member:
        updated_member.pop("_id")

    return {
        "status": "success",
        "member": updated_member,
        "host": updated_host
    }



@router.post("/{host_id}/set-host/{member_id}")
async def set_group_host(
    host_id: str,
    member_id: str,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    member = await db.closet_items.find_one({"id": member_id, "user_id": user["id"]})
    if not host or not member:
        raise HTTPException(404, "Host or member item not found")

    # Verify they belong to the same group
    group_id = host.get("group_id")
    if not group_id or member.get("group_id") != group_id:
        raise HTTPException(400, "Items do not belong to the same group")

    # Update all items in this group to have the new group_id (the new host's ID)
    new_group_id = member_id
    await db.closet_items.update_many(
        {"group_id": group_id, "user_id": user["id"]},
        {"$set": {"group_id": new_group_id}}
    )

    # Update old host to be a member
    await db.closet_items.update_one(
        {"id": host_id},
        {"$set": {"group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Update new host to be the host
    await db.closet_items.update_one(
        {"id": member_id},
        {"$set": {"group_role": "host", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Fetch updated new host
    updated_new_host = await db.closet_items.find_one({"id": member_id})
    if updated_new_host and "_id" in updated_new_host:
        updated_new_host.pop("_id")

    return {
        "status": "success",
        "host": updated_new_host
    }



@router.post("/{item_id}/ungroup")
async def ungroup_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    item = await db.closet_items.find_one({"id": item_id, "user_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")

    group_id = item.get("group_id")
    if not group_id:
        return {"status": "success"}

    # Ungroup this item (set group fields to None)
    await db.closet_items.update_one(
        {"id": item_id, "user_id": user["id"]},
        {"$set": {"group_id": None, "group_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Check remaining items in the group
    remaining = await db.closet_items.find(
        {"group_id": group_id, "user_id": user["id"]}
    ).to_list(None)

    if len(remaining) <= 1:
        # Only 1 item left -> dissolve group entirely
        await db.closet_items.update_many(
            {"group_id": group_id, "user_id": user["id"]},
            {"$set": {"group_id": None, "group_role": None, "group_analysis_status": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # If multiple remain, and the ungrouped item was the host, pick a new host
        if item.get("group_role") == "host":
            new_host = remaining[0]
            await db.closet_items.update_many(
                {"group_id": group_id, "user_id": user["id"]},
                {"$set": {"group_id": new_host["id"], "group_analysis_status": "pending"}}
            )
            await db.closet_items.update_one(
                {"id": new_host["id"]},
                {"$set": {"group_role": "host", "group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            background_tasks.add_task(reanalyze_group_helper, new_host["id"], user["id"])
        else:
            # Host is still there. Run background re-analysis on remaining group
            remaining_ids = [r["id"] for r in remaining]
            await db.closet_items.update_many(
                {"id": {"$in": remaining_ids}},
                {"$set": {"group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    return {"status": "success"}



@router.post("/{host_id}/group-edit")
async def group_edit(
    host_id: str,
    payload: GroupEditIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    # 1. Fetch current host item
    host = await db.closet_items.find_one({"id": host_id, "user_id": user["id"]})
    if not host:
        raise HTTPException(404, "Host item not found")

    group_id = host.get("group_id") or host_id

    # Make sure host is marked as host (if not already set)
    if not host.get("group_id") or host.get("group_role") != "host":
        await db.closet_items.update_one(
            {"id": host_id},
            {"$set": {"group_id": group_id, "group_role": "host", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # 2. Process new uploads
    for upload in payload.new_uploads:
        try:
            raw = base64.b64decode(upload.image_base64, validate=True)
        except Exception as exc:
            raise HTTPException(400, f"Invalid image_base64: {exc}")

        original_data_url = f"data:{upload.image_mime};base64,{upload.image_base64}"
        
        from app.models.schemas import ClosetItem
        member_item = ClosetItem(
            user_id=user["id"],
            title=f"{host.get('title', 'Garment')} (View)",
            category=host.get("category", "Top"),
            sub_category=host.get("sub_category"),
            item_type=host.get("item_type"),
            brand=host.get("brand"),
            gender=host.get("gender"),
            dress_code=host.get("dress_code"),
            colors=host.get("colors") or [],
            color=host.get("color"),
            group_id=group_id,
            group_role="member",
            group_analysis_status="pending",
            original_image_url=original_data_url,
        ).model_dump()

        # Fast single-item segmentation
        segmented_data_url = None
        segmentation_model = None
        vision_service = get_garment_vision_service(user=user)
        if vision_service is not None:
            try:
                detections = await vision_service.detect_items(raw)
                if detections:
                    best_det = max(
                        detections,
                        key=lambda d: (
                            max(0, d["bbox"][2] - d["bbox"][0])
                            * max(0, d["bbox"][3] - d["bbox"][1])
                        ),
                    )
                    raw_crops = await asyncio.to_thread(
                        vision_service._bbox_crop_useful, raw, [best_det]
                    )
                    from app.services.vision.image import _apply_fast_matte
                    out = await asyncio.to_thread(_apply_fast_matte, raw_crops)
                    
                    if out:
                        _, b64_bytes, mime = out[0]
                    elif raw_crops:
                        _, b64_bytes, mime = raw_crops[0]
                    else:
                        b64_bytes = None
                    
                    if b64_bytes:
                        b64 = base64.b64encode(b64_bytes).decode("ascii")
                        segmented_data_url = f"data:{mime or 'image/png'};base64,{b64}"
                        segmentation_model = "the_eyes_single"
            except Exception as exc:
                logger.warning("group_edit segment failed: %r", exc)

        if segmented_data_url:
            member_item["segmented_image_url"] = segmented_data_url
            member_item["clean_image_url"] = segmented_data_url
            member_item["segmentation_model"] = segmentation_model
        elif original_data_url:
            member_item["clean_image_url"] = original_data_url


        # Get FashionCLIP embedding
        if fashion_clip_service is not None:
            try:
                embed_bytes = base64.b64decode(segmented_data_url.split(",", 1)[1]) if segmented_data_url else raw
                vec = await fashion_clip_service.embed_image(embed_bytes)
                if vec:
                    member_item["clip_embedding"] = vec
                    member_item["clip_model"] = fashion_clip_service.model_id
            except Exception as exc:
                logger.warning("group_edit CLIP embed failed: %r", exc)

        # Save to DB
        await repos.insert(db.closet_items, member_item)

    # 3. Process adding existing closet items
    for add_id in payload.add_member_ids:
        member = await db.closet_items.find_one({"id": add_id, "user_id": user["id"]})
        if not member:
            continue
        member_group_id = member.get("group_id")
        if member_group_id:
            # Move all members of the member's group to the current group
            await db.closet_items.update_many(
                {"group_id": member_group_id, "user_id": user["id"]},
                {"$set": {"group_id": group_id, "group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.closet_items.update_one(
                {"id": add_id},
                {"$set": {"group_id": group_id, "group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

    # 4. Process ungrouping members
    for remove_id in payload.ungroup_member_ids:
        await db.closet_items.update_one(
            {"id": remove_id, "user_id": user["id"]},
            {"$set": {"group_id": None, "group_role": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    # 5. Process swapping host role
    active_host_id = host_id
    if payload.new_host_id and payload.new_host_id != host_id:
        new_host = await db.closet_items.find_one({"id": payload.new_host_id, "user_id": user["id"]})
        if new_host:
            active_host_id = payload.new_host_id
            # Update all items in this group to have the new group_id (the new host's ID)
            await db.closet_items.update_many(
                {"group_id": group_id, "user_id": user["id"]},
                {"$set": {"group_id": active_host_id}}
            )
            # Update old host to be a member
            await db.closet_items.update_one(
                {"id": host_id},
                {"$set": {"group_role": "member", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Update new host to be the host
            await db.closet_items.update_one(
                {"id": active_host_id},
                {"$set": {"group_role": "host", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Also update group_id to active_host_id for the rest of processing
            group_id = active_host_id

    # 6. Dissolution check
    remaining = await db.closet_items.find(
        {"group_id": group_id, "user_id": user["id"]}
    ).to_list(None)

    if len(remaining) <= 1:
        # Only 1 item left -> dissolve group entirely
        await db.closet_items.update_many(
            {"group_id": group_id, "user_id": user["id"]},
            {"$set": {"group_id": None, "group_role": None, "group_analysis_status": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Mark all remaining items in the group as pending!
        remaining_ids = [r["id"] for r in remaining]
        await db.closet_items.update_many(
            {"id": {"$in": remaining_ids}},
            {"$set": {"group_analysis_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Re-run group analysis in the background
        background_tasks.add_task(reanalyze_group_helper, group_id, user["id"])

    # Fetch and return the updated host
    updated_host = await db.closet_items.find_one({"id": active_host_id})
    if updated_host and "_id" in updated_host:
        updated_host.pop("_id")

    return {
        "status": "success",
        "host": updated_host
    }



