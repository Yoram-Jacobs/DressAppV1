"""
OpenTryOn API Router (v1)
Endpoints for 3D Dressing Room integration with OpenTryOn (https://github.com/tryonlabs/opentryon).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.opentryon_service import (
    get_opentryon_status,
    generate_garment_3d,
    perform_virtual_tryon,
)

router = APIRouter(prefix="/tryon", tags=["OpenTryOn"])


class Generate3DRequest(BaseModel):
    garment_id: str = Field(..., description="Unique ID of the closet item")
    image_url: str = Field(..., description="Image or cutout URL of the garment")
    category: Optional[str] = Field("clothing", description="Garment category (top, dress, outerwear, etc.)")
    title: Optional[str] = Field("", description="Optional title or label")


class VTONRequest(BaseModel):
    person_image_url: str = Field(..., description="Avatar snapshot or user photo URL")
    garments: List[Dict[str, Any]] = Field(..., description="List of garment objects or URLs")
    measurements: Optional[Dict[str, Any]] = Field(default_factory=dict, description="User biometric measurements")
    model: Optional[str] = Field("fashn-tryon-max", description="Preferred VTON model (fashn-tryon-max, flux-vto, etc.)")


@router.get("/status")
async def status():
    """Returns connectivity and supported model status of the OpenTryOn engine."""
    return await get_opentryon_status()


@router.post("/generate-3d")
async def generate_3d(req: Generate3DRequest):
    """
    Generates or retrieves a 3D volumetric mesh (.glb) from a 2D garment cutout
    using OpenTryOn's Trellis pipeline.
    """
    try:
        res = await generate_garment_3d(
            garment_id=req.garment_id,
            image_url=req.image_url,
            category=req.category or "clothing",
            title=req.title or "",
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenTryOn 3D generation error: {str(e)}")


@router.post("/vton")
async def vton(req: VTONRequest):
    """
    Executes photorealistic virtual try-on on the user's avatar using OpenTryOn's VTON pipeline.
    """
    try:
        res = await perform_virtual_tryon(
            person_image_url=req.person_image_url,
            garments=req.garments,
            measurements=req.measurements,
            preferred_model=req.model or "fashn-tryon-max",
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenTryOn VTON error: {str(e)}")
