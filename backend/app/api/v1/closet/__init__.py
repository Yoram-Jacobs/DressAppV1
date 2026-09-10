from __future__ import annotations

import asyncio
from typing import Any
from fastapi import APIRouter

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
)
from app.services.gemini_image_service import gemini_image_service
from app.api.v1.closet import (
    items,
    ingestion,
    dpp_receipts,
    migration,
    grouping,
    repairs,
    search_stats,
)

router = items.router

router.include_router(ingestion.router)
router.include_router(dpp_receipts.router)
router.include_router(migration.router)
router.include_router(repairs.router)
router.include_router(search_stats.router)
router.include_router(grouping.router)

__all__ = [
    "router",
    "_active_background_tasks",
    "_track_task",
    "_read_image_bytes_from_url",
    "_get_item_image_url",
    "gemini_image_service",
    "CreateItemIn",
    "UpdateItemIn",
]
