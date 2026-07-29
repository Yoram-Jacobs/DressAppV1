"""Quota management API endpoints for credit exhaustion handling with pause-and-resume pattern."""
from __future__ import annotations

import logging
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from app.services.auth import get_current_user
from app.services.quota_manager import (
    check_quota_status, 
    get_quota_config,
    QuotaExhaustionError,
    execute_with_quotas,
    CreditQuotaStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quota", tags=["quota"])


@router.get("/status")
async def get_status(
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current credit quota status with actionable messages for frontend.
    
    This endpoint is designed to be called before initiating any credit-consuming operation
    to provide immediate feedback on whether the user can proceed, needs a soft warning,
    or must purchase more credits.
    """
    try:
        return await check_quota_status(user)
    except Exception as e:
        logger.error(f"Error getting quota status for user {user.get('id', 'unknown')}: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get global quota configuration thresholds for frontend UI rendering."""
    try:
        return await get_quota_config()
    except Exception as e:
        logger.error(f"Error getting quota config: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# EXCEPTION HANDLING MIDDLEWARE FOR QUOTA EXHAUSTION
# ============================================================================

# This would typically be added at the application level middleware,
# but included here for documentation purposes when integrating with FastAPI:
"""
@app.on_event("startup")
async def setup_exception_handlers():
    @app.exceptionhandler(QuotaExhaustionError)
    async def quota_exhaustion_exception_handler(request, exc):
        # Return a 428 Precondition Required or 402 Payment Required response
        # With details about what action the user should take
        return JSONResponse(
            status_code=428,
            content={
                "error": "quota_exhausted",
                "message": exc.message,
                "status": exc.status.value,
                "details": exc.details,
                "suggested_action": f"Visit {exc.details.get('purchase_link', '/pricing/purchase')}" if exc.details else None,
            }
        )
"""