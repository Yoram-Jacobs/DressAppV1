"""Enterprise 3D Virtual Dressing Room API endpoints."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.services.avatar_service import (
    AVATAR_CACHE_DIR,
    generate_parametric_avatar_glb,
    normalize_avatar_shape_keys,
    resolve_base_avatar_path,
)

router = APIRouter(prefix="/dressing-room", tags=["dressing-room"])

ROOT_DIR = Path(__file__).resolve().parents[4]
ASSETS_TEMPLATES_DIR = ROOT_DIR / "assets" / "templates"
WEB_TEMPLATES_DIR = ROOT_DIR / "apps" / "web" / "public" / "models" / "templates"
FITTER_SCRIPT_PATH = ROOT_DIR / "scripts" / "blender_enterprise_fitter.py"

LAYER_RADIAL_OFFSETS: Dict[int, float] = {
    1: 0.003,  # Layer 1 (Tops / Base): +0.003m
    2: 0.004,  # Layer 2 (Low Shoes): +0.004m
    3: 0.007,  # Layer 3 (Bottoms / Trousers / Skirts): +0.007m
    4: 0.010,  # Layer 4 (Mid-Layers / Sweaters): +0.010m
    5: 0.013,  # Layer 5 (Boots): +0.013m
    6: 0.016,  # Layer 6 (Outerwear / Coats / Cardigans): +0.016m
    7: 0.019,  # Layer 7 (Scarves / Bags): +0.019m
    8: 0.022,  # Layer 8 (Outer Accessories): +0.022m
}

CATEGORY_DEFAULT_TEMPLATES: Dict[str, str] = {
    "undergarment": "singlet.glb",
    "top": "top_tshirt.glb",
    "bottom": "bottom_trousers.glb",
    "low_shoes": "shoes_sneakers.glb",
    "boots": "shoes_boots.glb",
    "outerwear": "top_outerwear_jacket.glb",
    "accessory": "accessory_belt.glb",
}

CATEGORY_DEFAULT_LAYER: Dict[str, int] = {
    "undergarment": 1,
    "top": 1,
    "low_shoes": 2,
    "bottom": 3,
    "boots": 5,
    "outerwear": 6,
    "accessory": 7,
}


class AvatarMeasurementsRequest(BaseModel):
    height: float = Field(168.0, ge=120.0, le=230.0, description="Height in cm")
    chest: float = Field(88.0, ge=50.0, le=180.0, description="Chest/bust circumference in cm")
    waist: float = Field(68.0, ge=40.0, le=170.0, description="Waist circumference in cm")
    hips: float = Field(94.0, ge=50.0, le=185.0, description="Hips circumference in cm")
    gender: Optional[str] = Field("female", description="Avatar gender ('male' or 'female')")


class OutfitGarmentItem(BaseModel):
    id: Optional[str] = None
    texture_url: str = Field("", description="Clean transparent RGBA garment texture URL or path")
    category: Literal[
        "undergarment",
        "top",
        "bottom",
        "low_shoes",
        "boots",
        "outerwear",
        "accessory",
    ] = Field("top", description="Canonical garment category")
    layer_index: int = Field(1, ge=1, le=8, description="Discrete collision layer index (1..8)")
    template_id: Optional[str] = Field(None, description="Optional canonical template override (e.g. 'hoodie', 'trench_coat')")


class FitOutfitRequest(BaseModel):
    avatar_id: str = Field(..., description="Target morphed avatar ID")
    gender: Optional[str] = Field("female", description="Avatar gender ('male' or 'female')")
    items: List[OutfitGarmentItem] = Field(default_factory=list, description="Ordered garment layers to fit")


def _find_blender_executable() -> Optional[str]:
    env_bin = os.environ.get("BLENDER_EXECUTABLE")
    if env_bin and os.path.exists(env_bin):
        return env_bin
    which_bin = shutil.which("blender")
    if which_bin:
        return which_bin
    win_candidates = [
        r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
    ]
    for c in win_candidates:
        if os.path.exists(c):
            return c
    return None


def _resolve_template_glb(gender: str, category: str, template_id: Optional[str] = None) -> Path:
    gender_key = "male" if str(gender).lower() in ("male", "m", "man", "men") else "female"
    fname = f"{template_id}.glb" if template_id and not template_id.endswith(".glb") else (template_id or CATEGORY_DEFAULT_TEMPLATES.get(category, "top_tshirt.glb"))
    candidates = [
        ASSETS_TEMPLATES_DIR / gender_key / fname,
        WEB_TEMPLATES_DIR / gender_key / fname,
        Path("/app/assets/templates") / gender_key / fname,
        Path("/srv/AI-Stylist/assets/templates") / gender_key / fname,
        ASSETS_TEMPLATES_DIR / gender_key / CATEGORY_DEFAULT_TEMPLATES.get(category, "top_tshirt.glb"),
        WEB_TEMPLATES_DIR / gender_key / CATEGORY_DEFAULT_TEMPLATES.get(category, "top_tshirt.glb"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]


async def _fit_single_garment_layer(
    avatar_path: Path,
    gender: str,
    item: OutfitGarmentItem,
    prefer_blender: bool = False,
) -> Dict[str, Any]:
    t0 = time.perf_counter()
    layer_idx = item.layer_index if 1 <= item.layer_index <= 8 else CATEGORY_DEFAULT_LAYER.get(item.category, 1)
    layer_offset = LAYER_RADIAL_OFFSETS.get(layer_idx, 0.003)
    template_path = _resolve_template_glb(gender, item.category, item.template_id)

    AVATAR_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    sig = json.dumps(
        {
            "avatar": avatar_path.name,
            "gender": gender,
            "category": item.category,
            "layer_index": layer_idx,
            "template": template_path.name,
            "texture_url": item.texture_url,
        },
        sort_keys=True,
    )
    digest = hashlib.sha256(sig.encode("utf-8")).hexdigest()[:12]
    out_filename = f"fitted_{gender}_{item.category}_L{layer_idx}_{digest}.glb"
    out_path = AVATAR_CACHE_DIR / out_filename

    if not out_path.exists():
        blender_bin = _find_blender_executable() if prefer_blender else None
        if blender_bin and FITTER_SCRIPT_PATH.exists() and avatar_path.exists() and template_path.exists():
            cmd = [
                blender_bin,
                "-b",
                "-P",
                str(FITTER_SCRIPT_PATH),
                "--",
                "--avatar",
                str(avatar_path),
                "--garment_template",
                str(template_path),
                "--category",
                item.category,
                "--layer_index",
                str(layer_idx),
                "--output",
                str(out_path),
            ]
            if item.texture_url and os.path.exists(item.texture_url):
                cmd.extend(["--texture", item.texture_url])
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

        if not out_path.exists() and template_path.exists():
            # Fast (< 50ms) CPU-native radial layer offset + rigid sole lock via trimesh
            try:
                import numpy as np
                import trimesh

                mesh = trimesh.load(str(template_path), force="mesh")
                verts = np.array(mesh.vertices, dtype=np.float64, copy=True)
                normals = np.array(mesh.vertex_normals, dtype=np.float64, copy=True)

                # Apply incremental outward radial collision offset relative to canonical Layer 1 (+0.003m)
                extra_offset = max(0.0, layer_offset - 0.003)
                if item.category in ("low_shoes", "boots"):
                    # Preserve rigid flat sole at ground plane (Y <= 0.026m in glTF Y-up)
                    deform_mask = (verts[:, 1] > 0.026).astype(np.float64)[:, None]
                    verts = verts + normals * (extra_offset * deform_mask)
                    sole_mask = verts[:, 1] < 0.002
                    verts[sole_mask, 1] = 0.0
                else:
                    verts = verts + normals * extra_offset

                mesh.vertices = verts
                mesh.export(str(out_path), file_type="glb")
            except Exception:
                shutil.copy2(str(template_path), str(out_path))

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "id": item.id or f"{item.category}_{layer_idx}",
        "category": item.category,
        "layer_index": layer_idx,
        "layer_offset_m": layer_offset,
        "template": template_path.name,
        "texture_url": item.texture_url,
        "glb_url": f"/api/v1/dressing-room/models/{out_filename}",
        "elapsed_ms": elapsed_ms,
    }


@router.post("/avatar")
async def create_morphed_avatar(payload: AvatarMeasurementsRequest) -> Dict[str, Any]:
    """
    Accepts body measurements (height, chest, waist, hips in cm), maps them into
    calibrated normalized shape-key weights (0.0 to 1.0), and generates/caches the morphed avatar .glb.
    """
    measurements = {
        "height": payload.height,
        "chest": payload.chest,
        "waist": payload.waist,
        "hips": payload.hips,
        "gender": payload.gender or "female",
    }
    result = await asyncio.to_thread(
        generate_parametric_avatar_glb,
        measurements=measurements,
        gender=payload.gender or "female",
    )
    return result


@router.post("/fit-outfit")
async def fit_outfit_layers(payload: FitOutfitRequest) -> Dict[str, Any]:
    """
    Accepts avatar_id and an ordered array of garment items (texture_url, category, layer_index).
    Orchestrates parallel fitting across layers following the 7-layer collision hierarchy
    and returns URLs for the fitted outfit GLBs.
    """
    t0 = time.perf_counter()
    gender_key = "male" if (
        str(payload.gender or "").lower() in ("male", "m", "man", "men")
        or "_male_" in payload.avatar_id
    ) else "female"

    cached_avatar = AVATAR_CACHE_DIR / f"{payload.avatar_id}.glb"
    avatar_path = cached_avatar if cached_avatar.exists() else resolve_base_avatar_path(gender_key)

    ordered_items = sorted(
        payload.items,
        key=lambda it: (it.layer_index if 1 <= it.layer_index <= 8 else CATEGORY_DEFAULT_LAYER.get(it.category, 1)),
    )

    fitted_layers = await asyncio.gather(
        *[_fit_single_garment_layer(avatar_path, gender_key, item) for item in ordered_items]
    )

    total_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "avatar_id": payload.avatar_id,
        "gender": gender_key,
        "avatar_glb_url": (
            f"/api/v1/dressing-room/models/{cached_avatar.name}"
            if cached_avatar.exists()
            else f"/models/avatar_{gender_key}_1.glb"
        ),
        "fitted_garments": list(fitted_layers),
        "total_elapsed_ms": total_ms,
    }


@router.get("/models/{filename}")
async def get_dressing_room_model(filename: str):
    """Serves generated/cached morphed avatar and fitted garment .glb models."""
    safe_name = Path(filename).name
    target = AVATAR_CACHE_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Fitted 3D model not found")
    return FileResponse(
        str(target),
        media_type="model/gltf-binary",
        filename=safe_name,
    )
