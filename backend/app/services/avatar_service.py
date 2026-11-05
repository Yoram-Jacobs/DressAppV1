"""Parametric Avatar Engine & morphological shape-key service."""
from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

ROOT_DIR = Path(__file__).resolve().parents[3]
ASSETS_AVATARS_DIR = ROOT_DIR / "assets" / "avatars"
WEB_MODELS_DIR = ROOT_DIR / "apps" / "web" / "public" / "models"
AVATAR_CACHE_DIR = Path(tempfile.gettempdir()) / "dressapp_avatars"


# Calibrated anthropometric range bounds (in cm) mapped to normalized [0.0, 1.0] shape-key weights
ANTHROPOMETRIC_RANGES: Dict[str, Dict[str, tuple[float, float]]] = {
    "female": {
        "height": (150.0, 186.0),
        "chest": (74.0, 118.0),
        "waist": (56.0, 104.0),
        "hips": (80.0, 126.0),
    },
    "male": {
        "height": (160.0, 198.0),
        "chest": (84.0, 128.0),
        "waist": (68.0, 116.0),
        "hips": (84.0, 122.0),
    },
}


def get_default_measurements(gender: str = "female") -> Dict[str, Any]:
    """Get anatomical baseline measurements in cm for male or female."""
    if str(gender).lower() in ("male", "m", "man", "men"):
        return {
            "height": 178.0,
            "shoulders": 44.0,
            "chest": 98.0,
            "waist": 82.0,
            "hips": 96.0,
            "arm_length": 64.0,
            "inseam": 82.0,
            "gender": "male",
        }
    return {
        "height": 168.0,
        "shoulders": 38.0,
        "chest": 88.0,
        "waist": 68.0,
        "hips": 94.0,
        "arm_length": 58.0,
        "inseam": 76.0,
        "gender": "female",
    }


def _safe_float(val: Any, fallback: float) -> float:
    if val is None or val == "":
        return fallback
    try:
        return float(val)
    except (ValueError, TypeError):
        return fallback


def _clamp01(value: float) -> float:
    return round(min(1.0, max(0.0, float(value))), 4)


def normalize_avatar_shape_keys(
    measurements: Optional[Dict[str, Any]] = None,
    sex: str = "female",
) -> Dict[str, float]:
    """
    Maps anthropometric measurements (in cm) into calibrated normalized shape-key weights (0.0 to 1.0):
      - height_scale
      - chest_girth
      - waist_girth
      - hip_girth
    """
    if not measurements:
        measurements = {}
    gender_key = "male" if str(sex or measurements.get("gender", "female")).lower() in ("male", "m", "man", "men") else "female"
    defaults = get_default_measurements(gender_key)
    ranges = ANTHROPOMETRIC_RANGES[gender_key]

    height = _safe_float(measurements.get("height"), defaults["height"])
    chest = _safe_float(measurements.get("chest") or measurements.get("bust"), defaults["chest"])
    waist = _safe_float(measurements.get("waist"), defaults["waist"])
    hips = _safe_float(measurements.get("hips") or measurements.get("hip"), defaults["hips"])

    h_min, h_max = ranges["height"]
    c_min, c_max = ranges["chest"]
    w_min, w_max = ranges["waist"]
    hp_min, hp_max = ranges["hips"]

    return {
        "height_scale": _clamp01((height - h_min) / max(1e-4, h_max - h_min)),
        "chest_girth": _clamp01((chest - c_min) / max(1e-4, c_max - c_min)),
        "waist_girth": _clamp01((waist - w_min) / max(1e-4, w_max - w_min)),
        "hip_girth": _clamp01((hips - hp_min) / max(1e-4, hp_max - hp_min)),
    }


def calculate_shape_parameters(measurements: Dict[str, Any], sex: str = "female") -> Dict[str, float]:
    """
    Calculate 3D morph target weights from body measurements.
    Includes both canonical enterprise shape keys (height_scale, chest_girth, waist_girth, hip_girth)
    and directional morph targets used by the interactive frontend viewport.
    """
    if not measurements:
        measurements = {}

    gender_key = "male" if str(sex or measurements.get("gender", "female")).lower() in ("male", "m", "man", "men") else "female"
    defaults = get_default_measurements(gender_key)
    height = _safe_float(measurements.get("height"), defaults["height"])
    weight = _safe_float(measurements.get("weight"), 65.0)
    chest = _safe_float(measurements.get("chest") or measurements.get("bust"), defaults["chest"])
    waist = _safe_float(measurements.get("waist"), defaults["waist"])
    hips = _safe_float(measurements.get("hips") or measurements.get("hip"), defaults["hips"])

    baseline_height = defaults["height"]
    baseline_weight = 65.0
    baseline_chest = defaults["chest"]
    baseline_waist = defaults["waist"]
    baseline_hips = defaults["hips"]

    height_diff = (height - baseline_height) / 20.0
    weight_diff = (weight - baseline_weight) / 15.0

    normalized_keys = normalize_avatar_shape_keys(measurements, gender_key)

    shape_params = {
        "tall": max(0.0, height_diff),
        "short": max(0.0, -height_diff),
        "heavy": max(0.0, weight_diff),
        "thin": max(0.0, -weight_diff),
        "busty": max(0.0, (chest - baseline_chest) / 10.0),
        "waist_thick": max(0.0, (waist - baseline_waist) / 10.0),
        "waist_thin": max(0.0, -(waist - baseline_waist) / 10.0),
        "hips_wide": max(0.0, (hips - baseline_hips) / 10.0),
        "hips_narrow": max(0.0, -(hips - baseline_hips) / 10.0),
        **normalized_keys,
    }

    for k, v in shape_params.items():
        shape_params[k] = min(1.0, max(0.0, v))

    return shape_params


def resolve_base_avatar_path(gender: str = "female") -> Path:
    """Resolves the canonical parametric base avatar .glb path for the given gender."""
    gender_key = "male" if str(gender).lower() in ("male", "m", "man", "men") else "female"
    candidates = [
        ASSETS_AVATARS_DIR / f"avatar_{gender_key}.glb",
        WEB_MODELS_DIR / f"avatar_{gender_key}_1.glb",
        Path("/app/assets/avatars") / f"avatar_{gender_key}.glb",
        Path("/srv/AI-Stylist/assets/avatars") / f"avatar_{gender_key}.glb",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def generate_parametric_avatar_glb(
    measurements: Optional[Dict[str, Any]] = None,
    gender: str = "female",
    output_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Generates and caches a morphed parametric avatar .glb from anthropometric measurements (in cm).
    Applies calibrated morphological deformations (height_scale, chest_girth, waist_girth, hip_girth)
    and outputs a temporary .glb target for garment fitting.
    """
    if not measurements:
        measurements = {}
    gender_key = "male" if str(gender or measurements.get("gender", "female")).lower() in ("male", "m", "man", "men") else "female"
    shape_keys = normalize_avatar_shape_keys(measurements, gender_key)
    shape_params = calculate_shape_parameters(measurements, gender_key)

    payload_sig = json.dumps({"gender": gender_key, "shape_keys": shape_keys}, sort_keys=True)
    avatar_id = f"avatar_{gender_key}_{hashlib.sha256(payload_sig.encode('utf-8')).hexdigest()[:12]}"

    cache_dir = Path(output_dir) if output_dir else AVATAR_CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)
    out_path = cache_dir / f"{avatar_id}.glb"

    base_path = resolve_base_avatar_path(gender_key)
    if not out_path.exists() and base_path.exists():
        try:
            import numpy as np
            import trimesh

            scene_or_mesh = trimesh.load(str(base_path), force="scene")
            # Apply smooth parametric morphological deformation around neutral (0.5) weight
            dh = (shape_keys["height_scale"] - 0.5) * 0.12
            dc = (shape_keys["chest_girth"] - 0.5) * 0.16
            dw = (shape_keys["waist_girth"] - 0.5) * 0.20
            dhp = (shape_keys["hip_girth"] - 0.5) * 0.18

            geoms = (
                scene_or_mesh.geometry.values()
                if hasattr(scene_or_mesh, "geometry")
                else [scene_or_mesh]
            )
            for geom in geoms:
                if not hasattr(geom, "vertices") or len(geom.vertices) == 0:
                    continue
                v = np.array(geom.vertices, dtype=np.float64, copy=True)
                # glTF Y-up: Y is height, X is width, Z is depth
                y = v[:, 1]
                x = v[:, 0]
                z = v[:, 2]
                torso_mask = (np.abs(x) < 0.23).astype(np.float64)

                w_chest = np.exp(-((y - 1.28) / 0.14) ** 2) * torso_mask
                w_waist = np.exp(-((y - 1.04) / 0.13) ** 2) * torso_mask
                w_hip = np.exp(-((y - 0.88) / 0.14) ** 2) * torso_mask

                radial_scale_x = 1.0 + dc * w_chest + dw * w_waist + dhp * w_hip
                radial_scale_z = 1.0 + dc * 1.1 * w_chest + dw * 1.15 * w_waist + dhp * 1.1 * w_hip

                v[:, 0] = x * radial_scale_x
                v[:, 1] = y * (1.0 + dh)
                v[:, 2] = z * radial_scale_z
                geom.vertices = v

            scene_or_mesh.export(str(out_path), file_type="glb")
        except Exception:
            shutil.copy2(str(base_path), str(out_path))

    return {
        "avatar_id": avatar_id,
        "gender": gender_key,
        "glb_path": str(out_path),
        "glb_url": f"/api/v1/dressing-room/models/{out_path.name}",
        "shape_keys": shape_keys,
        "shape_params": shape_params,
    }
