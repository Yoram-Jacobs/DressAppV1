"""3D Archetype Template Management for CPU-only 2D-to-3D garment modeling.

Maintains and loads canonical low-poly, clean-topology, watertight 2-manifold
garment meshes in `.glb` format under `assets/templates/`:
  - `tshirt_base.glb`
  - `hoodie_base.glb`
  - `pants_base.glb`
  - `dress_base.glb`

Each template features pre-mapped, front-projected UV coordinates aligned to a
normalized [0, 1] x [0, 1] square canvas.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable, Dict, Tuple

import numpy as np
import trimesh
from PIL import Image

from garment_analyzer import GarmentValidationError, normalize_garment_type

TEMPLATE_FILENAMES: Dict[str, str] = {
    "tshirt": "tshirt_base.glb",
    "hoodie": "hoodie_base.glb",
    "pants": "pants_base.glb",
    "dress": "dress_base.glb",
}

# Canonical physical dimensions (width_m, height_m, thickness_m)
CANONICAL_DIMENSIONS: Dict[str, Tuple[float, float, float]] = {
    "tshirt": (0.62, 0.68, 0.045),
    "hoodie": (0.72, 0.76, 0.055),
    "pants": (0.46, 0.96, 0.050),
    "dress": (0.60, 1.04, 0.050),
}

# In-memory cache of canonical template vertices/faces/uvs for sub-millisecond cloning
_TEMPLATE_MEMORY_CACHE: Dict[str, Tuple[np.ndarray, np.ndarray, np.ndarray]] = {}


def get_default_templates_dir() -> Path:
    """Resolve the canonical `assets/templates/` directory."""
    here = Path(__file__).resolve().parent
    repo_root_candidates = [
        here / "assets" / "templates",
        here.parent / "assets" / "templates",
    ]
    for candidate in repo_root_candidates:
        if candidate.exists():
            return candidate
    return repo_root_candidates[0]


def _profile_tshirt(t: np.ndarray) -> np.ndarray:
    """Half-width silhouette multiplier in [0..1] as a function of vertical fraction t (0=bottom, 1=top)."""
    # Torso from t=0..0.56, short-sleeve flare from 0.56..0.86, shoulder slope 0.86..1.0
    torso = 0.66 - 0.03 * np.sin(np.pi * np.clip(t / 0.56, 0.0, 1.0))
    sleeve_flare = 0.66 + 0.34 * np.sin(np.pi * np.clip((t - 0.54) / 0.34, 0.0, 1.0))
    shoulder_slope = 1.0 - 0.48 * np.clip((t - 0.86) / 0.14, 0.0, 1.0)
    return np.where(t < 0.56, torso, np.where(t <= 0.86, sleeve_flare, shoulder_slope))


def _profile_hoodie(t: np.ndarray) -> np.ndarray:
    """Half-width silhouette multiplier for a long-sleeve hoodie with upper hood dome."""
    # Ribbed hem at bottom, wide long-sleeve span in middle, narrow rounded hood at top (t > 0.76)
    lower = 0.64 + 0.36 * np.clip(t / 0.25, 0.0, 1.0)
    mid = 1.0 - 0.08 * np.clip((t - 0.55) / 0.21, 0.0, 1.0)
    hood = 0.46 * np.cos(0.42 * np.pi * np.clip((t - 0.76) / 0.24, 0.0, 1.0)) + 0.12
    return np.where(t < 0.25, lower, np.where(t <= 0.76, mid, hood))


def _profile_pants(t: np.ndarray) -> np.ndarray:
    """Half-width silhouette multiplier for tapered trousers/jeans."""
    # Ankle at t=0 (0.80), knee at t=0.42 (0.84), hip swell at t=0.76 (1.0), waistband at t=1.0 (0.86)
    leg = 0.80 + 0.20 * np.sin(0.5 * np.pi * np.clip(t / 0.76, 0.0, 1.0))
    waist_taper = 1.0 - 0.14 * np.clip((t - 0.76) / 0.24, 0.0, 1.0)
    return np.where(t <= 0.76, leg, waist_taper)


def _profile_dress(t: np.ndarray) -> np.ndarray:
    """Half-width silhouette multiplier for a fitted-waist A-line dress."""
    # Flared hem at t=0 (1.0), cinch at natural waist t=0.62 (0.58), bust/shoulder at t=0.88 (0.76), neckline t=1.0 (0.48)
    skirt = 1.0 - 0.42 * np.power(np.clip(t / 0.62, 0.0, 1.0), 0.85)
    bodice = 0.58 + 0.18 * np.sin(np.pi * np.clip((t - 0.62) / 0.26, 0.0, 1.0))
    neck = 0.76 - 0.28 * np.clip((t - 0.88) / 0.12, 0.0, 1.0)
    return np.where(t <= 0.62, skirt, np.where(t <= 0.88, bodice, neck))


PROFILE_BUILDERS: Dict[str, Callable[[np.ndarray], np.ndarray]] = {
    "tshirt": _profile_tshirt,
    "hoodie": _profile_hoodie,
    "pants": _profile_pants,
    "dress": _profile_dress,
}


def build_canonical_template_mesh(
    garment_type: str,
    nx: int = 16,
    ny: int = 20,
) -> trimesh.Trimesh:
    """Construct a clean, low-poly, watertight 2-manifold canonical mesh with normalized [0,1]^2 UVs."""
    gtype = normalize_garment_type(garment_type)
    if gtype == "auto":
        gtype = "tshirt"

    width_m, height_m, thickness_m = CANONICAL_DIMENSIONS[gtype]
    profile_fn = PROFILE_BUILDERS[gtype]

    u_grid = np.linspace(-1.0, 1.0, nx, dtype=np.float64)
    t_grid = np.linspace(0.0, 1.0, ny, dtype=np.float64)

    half_w_mult = profile_fn(t_grid)  # shape (ny,)
    # Normalize profile so max span equals exactly width_m
    half_w_mult = half_w_mult / float(np.max(half_w_mult))

    y_coords = (t_grid - 0.5) * height_m  # centered at y = 0

    front_xyz = []
    back_xyz = []
    half_z = 0.5 * thickness_m

    for j in range(ny):
        row_half_w = 0.5 * width_m * float(half_w_mult[j])
        y_val = float(y_coords[j])
        # Subtle anatomical chest/hip contour on canonical shell
        row_arch = 0.008 * np.cos(0.5 * np.pi * u_grid)
        for i in range(nx):
            x_val = float(u_grid[i]) * row_half_w
            z_off = float(row_arch[i])
            front_xyz.append([x_val, y_val, half_z + z_off])
            back_xyz.append([x_val, y_val, -half_z + z_off])

    n_side = nx * ny
    vertices = np.vstack([np.asarray(front_xyz, dtype=np.float64), np.asarray(back_xyz, dtype=np.float64)])

    # Front-projected UV coordinates aligned to the normalized [0, 1] x [0, 1] square canvas
    x_min, x_max = float(np.min(vertices[:, 0])), float(np.max(vertices[:, 0]))
    y_min, y_max = float(np.min(vertices[:, 1])), float(np.max(vertices[:, 1]))
    span_x = max(1e-6, x_max - x_min)
    span_y = max(1e-6, y_max - y_min)

    u_tex = np.clip((vertices[:, 0] - x_min) / span_x, 0.0, 1.0)
    v_tex = np.clip((vertices[:, 1] - y_min) / span_y, 0.0, 1.0)
    uv = np.column_stack([u_tex, v_tex])

    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            b = a + 1
            c = (j + 1) * nx + i
            d = c + 1
            # Front grid (CCW outward +Z)
            faces.append([a, b, d])
            faces.append([a, d, c])
            # Back grid (CW when viewed from +Z -> CCW outward -Z)
            faces.append([n_side + a, n_side + d, n_side + b])
            faces.append([n_side + a, n_side + c, n_side + d])

    # Stitched boundary loop connecting front perimeter to back perimeter (watertight manifold closure)
    perim = []
    for i in range(nx - 1):
        perim.append(0 * nx + i)
    for j in range(ny - 1):
        perim.append(j * nx + (nx - 1))
    for i in range(nx - 1, 0, -1):
        perim.append((ny - 1) * nx + i)
    for j in range(ny - 1, 0, -1):
        perim.append(j * nx + 0)

    n_perim = len(perim)
    for k in range(n_perim):
        p0 = perim[k]
        p1 = perim[(k + 1) % n_perim]
        faces.append([p0, n_side + p0, n_side + p1])
        faces.append([p0, n_side + p1, p1])

    faces_arr = np.asarray(faces, dtype=np.int64)

    # Default neutral white PBR material on the base template
    placeholder_img = Image.new("RGBA", (16, 16), (245, 245, 247, 255))
    material = trimesh.visual.material.PBRMaterial(
        name=f"{gtype}_canonical_pbr",
        baseColorTexture=placeholder_img,
        roughnessFactor=0.8,
        metallicFactor=0.0,
        doubleSided=True,
    )
    visual = trimesh.visual.TextureVisuals(uv=uv, material=material, image=placeholder_img)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces_arr, visual=visual, process=False)
    return mesh


def ensure_templates(templates_dir: Path | str | None = None) -> Dict[str, Path]:
    """Ensure all 4 canonical `.glb` templates exist on disk under `assets/templates/`."""
    target_dir = Path(templates_dir) if templates_dir is not None else get_default_templates_dir()
    target_dir.mkdir(parents=True, exist_ok=True)

    paths: Dict[str, Path] = {}
    for gtype, filename in TEMPLATE_FILENAMES.items():
        file_path = target_dir / filename
        if not file_path.is_file() or file_path.stat().st_size < 128:
            mesh = build_canonical_template_mesh(gtype)
            glb_bytes = mesh.export(file_type="glb")
            file_path.write_bytes(glb_bytes)
        paths[gtype] = file_path
    return paths


def get_template_path(garment_type: str, templates_dir: Path | str | None = None) -> Path:
    """Return the path to the requested canonical `.glb` template, creating it if missing."""
    gtype = normalize_garment_type(garment_type)
    if gtype == "auto":
        gtype = "tshirt"
    paths = ensure_templates(templates_dir)
    return paths[gtype]


def load_template_mesh(garment_type: str, templates_dir: Path | str | None = None) -> trimesh.Trimesh:
    """Load a fresh copy of the canonical base template mesh via `trimesh.load()`."""
    gtype = normalize_garment_type(garment_type)
    if gtype == "auto":
        gtype = "tshirt"

    template_path = get_template_path(gtype, templates_dir=templates_dir)
    cache_key = str(template_path.resolve())

    if cache_key not in _TEMPLATE_MEMORY_CACHE:
        loaded = trimesh.load(str(template_path), file_type="glb", force="mesh", process=False)
        if isinstance(loaded, trimesh.Scene):
            loaded = loaded.dump(concatenate=True)
        verts = np.array(loaded.vertices, dtype=np.float64, copy=True)
        faces = np.array(loaded.faces, dtype=np.int64, copy=True)
        if hasattr(loaded.visual, "uv") and loaded.visual.uv is not None and len(loaded.visual.uv) == len(verts):
            uv = np.array(loaded.visual.uv, dtype=np.float64, copy=True)
        else:
            x_min, x_max = float(np.min(verts[:, 0])), float(np.max(verts[:, 0]))
            y_min, y_max = float(np.min(verts[:, 1])), float(np.max(verts[:, 1]))
            u = np.clip((verts[:, 0] - x_min) / max(1e-6, x_max - x_min), 0.0, 1.0)
            v = np.clip((verts[:, 1] - y_min) / max(1e-6, y_max - y_min), 0.0, 1.0)
            uv = np.column_stack([u, v])
        _TEMPLATE_MEMORY_CACHE[cache_key] = (verts, faces, uv)

    cached_verts, cached_faces, cached_uv = _TEMPLATE_MEMORY_CACHE[cache_key]
    visual = trimesh.visual.TextureVisuals(uv=cached_uv.copy())
    return trimesh.Trimesh(
        vertices=cached_verts.copy(),
        faces=cached_faces.copy(),
        visual=visual,
        process=False,
    )
