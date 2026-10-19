#!/usr/bin/env python3
"""
Adjusts and tailors all 48 Onboarding Starter Capsule garments to fit the
Default Avatar's exact Cubic Bezier body geometry (`DynamicAvatar.jsx` 200x450 viewBox),
blends real photographic fabric textures from the 5,000+ cataloged dataset images,
generates transparent studio-cutout PNGs (`apps/web/public/assets/onboarding/{id}.png`),
and computes per-garment 2D Anatomical Point-Cloud Meshes (`avatar_fit`).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
ONBOARDING_ASSETS_DIR = REPO_ROOT / "apps" / "web" / "public" / "assets" / "onboarding"
DATASET_JS_PATH = REPO_ROOT / "apps" / "web" / "src" / "lib" / "onboardingDataset.js"
DISTILLED_IMAGES_DIR = REPO_ROOT / "dataset_distilled" / "images"
CULTURAL_IMAGES_DIR = REPO_ROOT / "inference-server" / "eyes" / "training" / "cultural_images"

SVG_W = 200.0
SVG_H = 450.0
SCALE = 3.0  # 600x1350 supersampled canvas -> downsampled to 400x900
CANVAS_W = int(SVG_W * SCALE)
CANVAS_H = int(SVG_H * SCALE)


def cubic_bezier(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    steps: int = 32,
) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for i in range(1, steps + 1):
        t = i / float(steps)
        mt = 1.0 - t
        x = (
            (mt**3) * p0[0]
            + 3.0 * (mt**2) * t * p1[0]
            + 3.0 * mt * (t**2) * p2[0]
            + (t**3) * p3[0]
        )
        y = (
            (mt**3) * p0[1]
            + 3.0 * (mt**2) * t * p1[1]
            + 3.0 * mt * (t**2) * p2[1]
            + (t**3) * p3[1]
        )
        pts.append((x, y))
    return pts


def compute_avatar_geometry(
    *,
    sex: str = "female",
    height: float | None = None,
    shoulders: float | None = None,
    chest: float | None = None,
    waist: float | None = None,
    hip: float | None = None,
    arm_length: float | None = None,
    inseam: float | None = None,
) -> dict[str, float]:
    """
    Mirrors `DynamicAvatar.jsx` + `AvatarViewer2D.jsx` default measurements
    and coordinate math 1-to-1 in the 200x450 SVG viewBox.
    """
    is_male = str(sex).lower() == "male"
    num_h = float(height if height is not None else (178.0 if is_male else 168.0))
    num_sh = float(shoulders if shoulders is not None else (44.0 if is_male else 38.0))
    num_ch = float(chest if chest is not None else (98.0 if is_male else 88.0))
    num_w = float(waist if waist is not None else (82.0 if is_male else 68.0))
    num_hip = float(hip if hip is not None else (96.0 if is_male else 94.0))
    num_arm = float(arm_length if arm_length is not None else (64.0 if is_male else 58.0))
    num_ins = float(inseam if inseam is not None else (82.0 if is_male else 76.0))

    x0 = 100.0
    view_box_height = 450.0
    total_body_svg_height = 360.0 * (num_h / 170.0)
    y_head_top = (view_box_height - total_body_svg_height) / 2.0 + 10.0
    y_feet = y_head_top + total_body_svg_height

    head_height = total_body_svg_height / 7.3
    y_chin = y_head_top + head_height
    neck_height = total_body_svg_height * 0.045
    y_shoulders = y_chin + neck_height

    inseam_svg = total_body_svg_height * (num_ins / num_h)
    y_ankles = y_feet - 18.0
    y_crotch = y_feet - inseam_svg

    torso_height = y_crotch - y_shoulders
    y_chest = y_shoulders + torso_height * (0.30 if is_male else 0.26)
    y_waist = y_shoulders + torso_height * (0.62 if is_male else 0.58)
    y_hip = y_shoulders + torso_height * 0.88
    y_knees = y_crotch + inseam_svg * 0.48

    arm_svg = total_body_svg_height * (num_arm / num_h)
    y_elbow = y_shoulders + arm_svg * 0.48
    y_wrist = y_shoulders + arm_svg * 0.88
    y_hand_tip = y_shoulders + arm_svg

    divisor = 2.65
    w_shoulders = (num_sh * 1.05) if is_male else (num_sh * 0.92)
    w_chest = ((num_ch / divisor) * 1.1) if is_male else ((num_ch / divisor) * 0.95)
    w_waist = ((num_w / divisor) * 1.02) if is_male else ((num_w / divisor) * 0.82)
    w_hip = ((num_hip / divisor) * 0.92) if is_male else ((num_hip / divisor) * 1.08)
    w_neck = 14.0 if is_male else 9.5

    w_outer_knee = (w_hip * 0.65) if is_male else (w_hip * 0.58)
    w_inner_knee = 10.5 if is_male else 9.5
    w_outer_ankle = 21.0 if is_male else 18.5
    w_inner_ankle = 9.5 if is_male else 8.0
    w_foot_tip = 24.0 if is_male else 20.0
    w_foot_heel = 10.0 if is_male else 8.5

    arm_thick_upper = 6.5 if is_male else 5.2
    arm_thick_elbow = 5.5 if is_male else 4.5
    arm_thick_wrist = 4.0 if is_male else 3.2

    return {
        "x0": x0,
        "is_male": 1.0 if is_male else 0.0,
        "neckHeight": neck_height,
        "yHeadTop": y_head_top,
        "yChin": y_chin,
        "yShoulders": y_shoulders,
        "yChest": y_chest,
        "yWaist": y_waist,
        "yHip": y_hip,
        "yCrotch": y_crotch,
        "yKnees": y_knees,
        "yAnkles": y_ankles,
        "yFeet": y_feet,
        "yElbow": y_elbow,
        "yWrist": y_wrist,
        "yHandTip": y_hand_tip,
        "wNeck": w_neck,
        "wShoulders": w_shoulders,
        "wChest": w_chest,
        "wWaist": w_waist,
        "wHip": w_hip,
        "wOuterKnee": w_outer_knee,
        "wInnerKnee": w_inner_knee,
        "wOuterAnkle": w_outer_ankle,
        "wInnerAnkle": w_inner_ankle,
        "wFootTip": w_foot_tip,
        "wFootHeel": w_foot_heel,
        "armThickUpper": arm_thick_upper,
        "armThickElbow": arm_thick_elbow,
        "armThickWrist": arm_thick_wrist,
    }


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) != 6:
        return (120, 120, 128)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def adjust_rgb(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return (
        max(0, min(255, int(rgb[0] * factor))),
        max(0, min(255, int(rgb[1] * factor))),
        max(0, min(255, int(rgb[2] * factor))),
    )


def pt(x: float, y: float) -> tuple[float, float]:
    return (x * SCALE, y * SCALE)


def extract_real_fabric_patch(spec: dict[str, Any]) -> np.ndarray | None:
    """
    Extracts the central photographic garment fabric patch from the cataloged
    source image in `dataset_distilled/images/` or `cultural_images/` so real
    fabric color/weave nuances are blended onto the fitted avatar garment.
    """
    src_id = spec.get("source_dataset_id", "")
    img_path: Path | None = None
    if ":" in src_id:
        prefix, name = src_id.split(":", 1)
        if prefix == "curated_distilled_5k":
            cand = DISTILLED_IMAGES_DIR / f"{name}.jpg"
            if cand.exists():
                img_path = cand
        elif prefix == "curated_cultural_sft":
            cand = CULTURAL_IMAGES_DIR / f"{name}.jpg"
            if cand.exists():
                img_path = cand

    if not img_path or not img_path.exists():
        return None

    try:
        im = Image.open(img_path).convert("RGB")
        w, h = im.size
        # Sample central core of the garment (avoiding head at top and feet at bottom)
        patch = im.crop((int(w * 0.28), int(h * 0.32), int(w * 0.72), int(h * 0.72)))
        patch_resized = patch.resize((CANVAS_W, CANVAS_H), Image.Resampling.BICUBIC)
        patch_blur = patch_resized.filter(ImageFilter.GaussianBlur(radius=6))
        # High-frequency fabric detail = patch_resized - patch_blur
        detail = np.array(patch_resized, dtype=np.float32) - np.array(patch_blur, dtype=np.float32)
        return np.clip(detail, -28.0, 28.0)
    except Exception:
        return None


def build_smooth_torso_and_sleeves_path(
    g: dict[str, float],
    *,
    hem_y: float,
    ease_sh: float = 2.0,
    ease_ch: float = 2.2,
    ease_wa: float = 2.5,
    ease_hip: float = 3.0,
    ease_hem: float = 3.5,
    sleeve_end_y: float | None = None,
    cuff_width: float = 9.5,
    neck_depth: float = 4.5,
    neck_width_extra: float = 1.8,
) -> list[list[tuple[float, float]]]:
    """
    Builds non-self-intersecting, butter-smooth Cubic Bezier polygons covering
    the torso + resting left/right sleeves matching `DynamicAvatar.jsx`'s exact
    Bezier body and arm curves. Returning separate torso and sleeve polygons
    prevents PIL's even-odd polygon fill rule from creating transparent cutouts
    where the lower sleeve overlaps the hip contour.
    """
    x0 = g["x0"]
    is_male = bool(g["is_male"])
    y_chin = g["yChin"]
    y_sh = g["yShoulders"]
    y_ch = g["yChest"]
    y_wa = g["yWaist"]
    y_hip = g["yHip"]
    w_neck = g["wNeck"] + neck_width_extra
    w_sh = g["wShoulders"] + ease_sh
    w_ch = g["wChest"] + ease_ch
    w_wa = g["wWaist"] + ease_wa
    # Flowing robes (abaya, kaftan, thobe) drape smoothly without a tight waist pinch
    if ease_hem >= 10.0:
        w_wa = max(w_wa, w_ch * 0.95)
    w_hip = g["wHip"] + ease_hip

    # 1. Build Torso Polygon (never self-intersects)
    torso_r: list[tuple[float, float]] = []
    p_neck_c = (x0, y_sh + neck_depth)
    p_neck_r = (x0 + w_neck, y_chin + 9.5)
    p_sh_r = (x0 + w_sh, y_sh + 1.0)
    p_ch_r = (x0 + w_ch, y_ch)
    p_wa_r = (x0 + w_wa, y_wa)

    torso_r.append(p_neck_c)
    torso_r.extend(
        cubic_bezier(
            p_neck_c,
            (x0 + w_neck * 0.55, y_sh + neck_depth),
            (x0 + w_neck * 0.9, y_chin + 11.5),
            p_neck_r,
            18,
        )
    )
    torso_r.extend(
        cubic_bezier(
            p_neck_r,
            (x0 + w_neck + (w_sh - w_neck) * 0.55, y_chin + 12.0),
            (x0 + w_sh * 0.88, y_sh - 1.5),
            p_sh_r,
            18,
        )
    )
    torso_r.extend(
        cubic_bezier(
            p_sh_r,
            (x0 + w_sh + 1.0, y_sh + 9.0),
            (x0 + w_ch + 1.2, y_ch - 5.0),
            p_ch_r,
            18,
        )
    )
    torso_r.extend(
        cubic_bezier(
            p_ch_r,
            (x0 + w_ch - (1.0 if is_male else 2.2), y_ch + (y_wa - y_ch) * 0.5),
            (x0 + w_wa + (1.2 if is_male else -1.2), y_wa - 7.0),
            p_wa_r,
            20,
        )
    )

    if hem_y <= y_hip + 12.0:
        w_hem = w_hip + ease_hem - ease_hip
        p_hem_r = (x0 + w_hem, hem_y)
        torso_r.extend(
            cubic_bezier(
                p_wa_r,
                (x0 + w_wa + (1.0 if is_male else 3.5), y_wa + (hem_y - y_wa) * 0.45),
                (x0 + w_hem + 0.8, hem_y - 6.0),
                p_hem_r,
                20,
            )
        )
    else:
        p_hip_r = (x0 + w_hip, y_hip)
        torso_r.extend(
            cubic_bezier(
                p_wa_r,
                (x0 + w_wa + (1.0 if is_male else 3.5), y_wa + (y_hip - y_wa) * 0.5),
                (x0 + w_hip + 1.5, y_hip - 7.0),
                p_hip_r,
                18,
            )
        )
        w_hem = g["wOuterAnkle"] + ease_hem if hem_y > g["yKnees"] + 20 else g["wOuterKnee"] + ease_hem
        p_hem_r = (x0 + w_hem, hem_y)
        torso_r.extend(
            cubic_bezier(
                p_hip_r,
                (x0 + w_hip + (ease_hem * 0.25), y_hip + (hem_y - y_hip) * 0.4),
                (x0 + w_hem - 1.0, hem_y - 12.0),
                p_hem_r,
                28,
            )
        )

    p_hem_l = (2.0 * x0 - p_hem_r[0], hem_y)
    hem_curve = cubic_bezier(
        p_hem_r,
        (x0 + (p_hem_r[0] - x0) * 0.4, hem_y + 2.8),
        (x0 - (p_hem_r[0] - x0) * 0.4, hem_y + 2.8),
        p_hem_l,
        24,
    )

    torso_poly = list(torso_r) + hem_curve
    for rx, ry in reversed(torso_r[1:-1]):
        torso_poly.append((2.0 * x0 - rx, ry))

    polygons: list[list[tuple[float, float]]] = [torso_poly]

    # 2. Build Left & Right Sleeve Polygons (if sleeved)
    if sleeve_end_y is not None and sleeve_end_y > y_sh + 6.0:
        frac = min(1.1, max(0.15, (sleeve_end_y - y_sh) / max(1.0, (g["yWrist"] - y_sh))))
        out_end_x = x0 + (g["wShoulders"] - 1.8 * frac) + ease_sh + (3.8 if ease_hem >= 10.0 else 1.2)
        in_end_x = out_end_x - cuff_width
        armpit_x = x0 + w_ch - 2.5
        armpit_y = y_ch + 3.0

        p_sh_inner = (x0 + w_sh - cuff_width * 0.65, y_sh + 1.5)
        p_sleeve_out = (out_end_x, sleeve_end_y)
        p_sleeve_in = (in_end_x, sleeve_end_y + 1.2)
        p_armpit = (armpit_x, armpit_y)

        sleeve_r: list[tuple[float, float]] = [p_sh_inner, p_sh_r]
        sleeve_r.extend(
            cubic_bezier(
                p_sh_r,
                (x0 + w_sh + 1.4, y_sh + (sleeve_end_y - y_sh) * 0.35),
                (out_end_x + 0.8, sleeve_end_y - 6.0),
                p_sleeve_out,
                22,
            )
        )
        sleeve_r.extend(
            cubic_bezier(
                p_sleeve_out,
                (out_end_x - cuff_width * 0.3, sleeve_end_y + 1.5),
                (in_end_x + cuff_width * 0.3, sleeve_end_y + 1.5),
                p_sleeve_in,
                10,
            )
        )
        sleeve_r.extend(
            cubic_bezier(
                p_sleeve_in,
                (in_end_x - 0.5, armpit_y + (sleeve_end_y - armpit_y) * 0.45),
                (armpit_x + 0.5, armpit_y + 5.0),
                p_armpit,
                18,
            )
        )
        sleeve_l = [(2.0 * x0 - sx, sy) for sx, sy in sleeve_r]
        polygons.append(sleeve_r)
        polygons.append(sleeve_l)

    return polygons


def build_smooth_trousers_path(
    g: dict[str, float],
    *,
    is_loose: bool = False,
) -> list[tuple[float, float]]:
    """
    Builds a smooth Cubic Bezier contour for Trousers/Pants/Chinos/Jeans
    matching `DynamicAvatar.jsx`'s waist->hip->knee->ankle->crotch Bezier curves!
    """
    x0 = g["x0"]
    is_male = bool(g["is_male"])
    y_wa = g["yWaist"] - 2.0
    y_hip = g["yHip"]
    y_cr = g["yCrotch"] + 2.5
    y_kn = g["yKnees"]
    y_an = g["yAnkles"] + 3.5

    w_wa = g["wWaist"] + 2.0
    w_hip = g["wHip"] + (4.2 if is_loose else 2.4)
    w_okn = g["wOuterKnee"] + (7.5 if is_loose else 2.6)
    w_oan = g["wOuterAnkle"] + (7.5 if is_loose else 2.2)
    w_ikn = max(3.5, g["wInnerKnee"] - (2.8 if is_loose else 1.2))
    w_ian = max(3.2, g["wInnerAnkle"] - (2.8 if is_loose else 1.0))

    right_pts: list[tuple[float, float]] = []
    p_wa_c = (x0, y_wa)
    p_wa_r = (x0 + w_wa, y_wa)
    p_hip_r = (x0 + w_hip, y_hip)
    p_okn_r = (x0 + w_okn, y_kn)
    p_oan_r = (x0 + w_oan, y_an)
    p_ian_r = (x0 + w_ian, y_an)
    p_ikn_r = (x0 + w_ikn, y_kn)
    p_cr = (x0, y_cr)

    right_pts.append(p_wa_c)
    right_pts.append(p_wa_r)
    # Waist -> Hip (exact DynamicAvatar Bezier curve)
    right_pts.extend(
        cubic_bezier(
            p_wa_r,
            (x0 + w_wa + (1.5 if is_male else 4.2), y_wa + (y_hip - y_wa) * 0.5),
            (x0 + w_hip + (1.2 if is_male else 2.2), y_hip - 8.0),
            p_hip_r,
            20,
        )
    )
    # Hip -> Outer Knee
    right_pts.extend(
        cubic_bezier(
            p_hip_r,
            (x0 + w_hip - (0.5 if is_loose else 1.5), y_hip + (y_kn - y_hip) * 0.4),
            (x0 + w_okn + 2.5, y_kn - 12.0),
            p_okn_r,
            22,
        )
    )
    # Outer Knee -> Outer Ankle
    right_pts.extend(
        cubic_bezier(
            p_okn_r,
            (x0 + w_okn + 1.2, y_kn + 15.0),
            (x0 + w_oan + 2.0, y_an - 15.0),
            p_oan_r,
            22,
        )
    )
    # Slight curved cuff at ankle
    right_pts.extend(
        cubic_bezier(
            p_oan_r,
            (x0 + (w_oan + w_ian) * 0.5, y_an + 1.5),
            (x0 + (w_oan + w_ian) * 0.5, y_an + 1.5),
            p_ian_r,
            10,
        )
    )
    # Inner Ankle -> Inner Knee
    right_pts.extend(
        cubic_bezier(
            p_ian_r,
            (x0 + w_ian + 1.0, y_an - 15.0),
            (x0 + w_ikn + 0.8, y_kn + 15.0),
            p_ikn_r,
            20,
        )
    )
    # Inner Knee -> Crotch
    right_pts.extend(
        cubic_bezier(
            p_ikn_r,
            (x0 + w_ikn - 1.0, y_kn - 15.0),
            (x0 + 2.5, y_cr + 8.0),
            p_cr,
            18,
        )
    )

    full_pts = list(right_pts)
    for rx, ry in reversed(right_pts[1:-1]):
        full_pts.append((2.0 * x0 - rx, ry))
    return full_pts


def build_smooth_skirt_path(
    g: dict[str, float],
    *,
    hem_y: float,
    flare: float = 12.0,
) -> list[tuple[float, float]]:
    x0 = g["x0"]
    y_wa = g["yWaist"] - 2.0
    y_hip = g["yHip"]
    w_wa = g["wWaist"] + 2.0
    w_hip = g["wHip"] + 3.2
    w_hem = w_hip + flare

    right_pts: list[tuple[float, float]] = [(x0, y_wa), (x0 + w_wa, y_wa)]
    p_wa_r = (x0 + w_wa, y_wa)
    p_hip_r = (x0 + w_hip, y_hip)
    p_hem_r = (x0 + w_hem, hem_y)

    right_pts.extend(
        cubic_bezier(
            p_wa_r,
            (x0 + w_wa + 4.0, y_wa + (y_hip - y_wa) * 0.5),
            (x0 + w_hip + 1.5, y_hip - 7.0),
            p_hip_r,
            20,
        )
    )
    right_pts.extend(
        cubic_bezier(
            p_hip_r,
            (x0 + w_hip + flare * 0.35, y_hip + (hem_y - y_hip) * 0.45),
            (x0 + w_hem - 1.0, hem_y - 10.0),
            p_hem_r,
            24,
        )
    )

    p_hem_l = (x0 - w_hem, hem_y)
    hem_curve = cubic_bezier(
        p_hem_r,
        (x0 + w_hem * 0.4, hem_y + 3.5),
        (x0 - w_hem * 0.4, hem_y + 3.5),
        p_hem_l,
        24,
    )

    full_pts = list(right_pts) + hem_curve
    for rx, ry in reversed(right_pts[1:-1]):
        full_pts.append((2.0 * x0 - rx, ry))
    return full_pts


def apply_3d_fabric_shading_and_texture(
    img_rgba: Image.Image,
    spec: dict[str, Any],
) -> Image.Image:
    """
    Applies realistic 3D cylindrical lighting, soft inner edge beveling,
    drapery folds, and real photographic texture detail from the dataset image.
    """
    arr = np.array(img_rgba, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 8
    if not mask.any():
        return img_rgba

    ys, xs = np.where(mask)
    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    w_span = max(1.0, float(max_x - min_x))
    h_span = max(1.0, float(max_y - min_y))

    yy, xx = np.mgrid[0:CANVAS_H, 0:CANVAS_W]
    nx = (xx - (CANVAS_W * 0.5)) / (w_span * 0.5)
    ny = (yy - min_y) / h_span

    # Soft inner ambient-occlusion edge bevel (gives real 3D garment thickness)
    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode="L")
    blurred_alpha = np.array(alpha_img.filter(ImageFilter.GaussianBlur(radius=7)), dtype=np.float32) / 255.0
    edge_bevel = 0.86 + 0.16 * np.clip(blurred_alpha, 0.0, 1.0)

    # Cylindrical 3D lighting
    cyl_light = (1.05 - 0.15 * (nx + 0.16) ** 2) * edge_bevel

    item_id = spec["id"].lower()
    material = spec.get("material", "Cotton").lower()

    if "pleated" in item_id:
        fold_freq = 28.0
        fold_amp = 0.075
    elif any(k in item_id for k in ("abaya", "kaftan", "saree", "skirt", "jalabiya", "thobe")):
        fold_freq = 11.0
        fold_amp = 0.05 * np.clip(ny * 1.2, 0.2, 1.0)
    else:
        fold_freq = 7.0
        fold_amp = 0.025

    drape_wave = fold_amp * np.sin(nx * math.pi * fold_freq)

    rng = np.random.default_rng(abs(hash(item_id)) % (2**32))
    weave = rng.normal(0.0, 0.01, size=(CANVAS_H, CANVAS_W)).astype(np.float32)

    if "denim" in material or "jeans" in item_id:
        twill = 0.028 * np.sin((xx + yy) * 0.9)
        wash = 0.075 * np.exp(-((np.abs(nx) - 0.34) ** 2) / 0.05) * np.exp(-((ny - 0.42) ** 2) / 0.09)
        weave += twill + wash
    elif "knit" in material or "sweater" in item_id or "cardigan" in item_id:
        weave += 0.032 * np.sin(xx * 1.4) + 0.015 * np.sin(yy * 0.8)
    elif "striped" in item_id:
        weave += 0.08 * (np.sin(xx * 0.95) > 0.25).astype(np.float32) - 0.035
    elif "silk" in material or "velvet" in material or "leather" in material:
        weave += 0.065 * np.exp(-((nx + 0.22) ** 2) / 0.06)

    total_gain = np.clip(cyl_light + drape_wave + weave, 0.70, 1.20)

    # Blend subtle real photographic detail from source dataset image
    real_detail = extract_real_fabric_patch(spec)

    for c in range(3):
        ch_val = arr[:, :, c] * total_gain
        if real_detail is not None:
            ch_val = ch_val + real_detail[:, :, c] * 0.28
        arr[:, :, c] = np.where(mask, np.clip(ch_val, 0, 255), arr[:, :, c])

    return Image.fromarray(arr.astype(np.uint8), mode="RGBA")


def draw_fitted_garment(spec: dict[str, Any]) -> Image.Image:
    sex = spec["sex"]
    g = compute_avatar_geometry(sex=sex)
    x0 = g["x0"]

    item_id = spec["id"]
    cat = spec["category"]
    sub = spec["sub_category"].lower()
    base_rgb = hex_to_rgb(spec.get("hex_color") or "#2B2D34")
    dark_rgb = adjust_rgb(base_rgb, 0.74)
    darker_rgb = adjust_rgb(base_rgb, 0.54)
    light_rgb = adjust_rgb(base_rgb, 1.22)
    seam_rgb = adjust_rgb(base_rgb, 0.64) if sum(base_rgb) > 160 else adjust_rgb(base_rgb, 1.38)

    trim_rgb = seam_rgb
    colors = spec.get("colors") or []
    if len(colors) > 1:
        sec_name = colors[1].get("name", "").lower()
        if "gold" in sec_name or "brass" in sec_name:
            trim_rgb = (212, 175, 55)
        elif "silver" in sec_name:
            trim_rgb = (200, 206, 216)
        elif "white" in sec_name:
            trim_rgb = (244, 245, 248)
        elif "coral" in sec_name:
            trim_rgb = (226, 109, 92)
        elif "navy" in sec_name or "blue" in sec_name:
            trim_rgb = (32, 54, 96)
        elif "light grey" in sec_name or "grey" in sec_name:
            trim_rgb = (180, 186, 196)

    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    y_chin = g["yChin"]
    y_sh = g["yShoulders"]
    y_ch = g["yChest"]
    y_wa = g["yWaist"]
    y_hip = g["yHip"]
    y_cr = g["yCrotch"]
    y_kn = g["yKnees"]
    y_an = g["yAnkles"]
    y_ft = g["yFeet"]
    y_el = g["yElbow"]
    y_wr = g["yWrist"]
    w_neck = g["wNeck"]
    w_sh = g["wShoulders"]
    w_ch = g["wChest"]
    w_wa = g["wWaist"]
    w_hip = g["wHip"]

    def poly(pts_svg: list[Any], fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None, width: int = 2):
        if not pts_svg:
            return
        polys = pts_svg if isinstance(pts_svg[0], list) else [pts_svg]
        for sub_p in polys:
            pts_px = [pt(px, py) for px, py in sub_p]
            draw.polygon(pts_px, fill=(*fill, 255))
        if outline:
            for sub_p in polys:
                pts_px = [pt(px, py) for px, py in sub_p]
                draw.line(pts_px + [pts_px[0]], fill=(*outline, 255), width=width, joint="curve")

    def line(pts_svg: list[tuple[float, float]], fill: tuple[int, int, int], width: int = 3):
        pts_px = [pt(px, py) for px, py in pts_svg]
        draw.line(pts_px, fill=(*fill, 255), width=width, joint="curve")

    def circle(cx: float, cy: float, r: float, fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None):
        x1, y1 = pt(cx - r, cy - r)
        x2, y2 = pt(cx + r, cy + r)
        draw.ellipse([x1, y1, x2, y2], fill=(*fill, 255), outline=(*outline, 255) if outline else None, width=2)

    def draw_collar(style: str, fill_rgb: tuple[int, int, int], accent_rgb: tuple[int, int, int]):
        if style == "mandarin":
            band = [
                (x0 - w_neck - 2.0, y_chin + 8.5),
                (x0 + w_neck + 2.0, y_chin + 8.5),
                (x0 + w_neck + 3.0, y_sh + 1.5),
                (x0 - w_neck - 3.0, y_sh + 1.5),
            ]
            poly(band, fill_rgb, outline=accent_rgb, width=3)
            line([(x0, y_chin + 9.0), (x0, y_ch + 12.0)], accent_rgb, width=3)
        elif style == "shirt":
            line([(x0, y_sh + 2.5), (x0, y_hip + 2.0)], seam_rgb, width=3)
            left_c = [
                (x0 - w_neck - 2.0, y_chin + 9.0),
                (x0, y_sh + 3.5),
                (x0 - w_neck * 0.82, y_sh + 10.5),
                (x0 - w_neck - 4.8, y_sh + 1.0),
            ]
            right_c = [
                (x0 + w_neck + 2.0, y_chin + 9.0),
                (x0, y_sh + 3.5),
                (x0 + w_neck * 0.82, y_sh + 10.5),
                (x0 + w_neck + 4.8, y_sh + 1.0),
            ]
            poly(left_c, adjust_rgb(fill_rgb, 1.06), outline=seam_rgb, width=2)
            poly(right_c, adjust_rgb(fill_rgb, 1.06), outline=seam_rgb, width=2)
            for by in np.linspace(y_sh + 9.0, y_wa + 18.0, 5):
                circle(x0, float(by), 1.1, accent_rgb)
        elif style == "shawl":
            shawl_l = [
                (x0 - w_neck - 3.0, y_chin + 10.0),
                (x0 - w_neck - 8.5, y_sh + 8.0),
                (x0, y_ch + 8.0),
                (x0, y_sh + 4.0),
            ]
            shawl_r = [
                (x0 + w_neck + 3.0, y_chin + 10.0),
                (x0 + w_neck + 8.5, y_sh + 8.0),
                (x0, y_ch + 8.0),
                (x0, y_sh + 4.0),
            ]
            poly(shawl_l, adjust_rgb(fill_rgb, 0.86), outline=seam_rgb, width=3)
            poly(shawl_r, adjust_rgb(fill_rgb, 0.92), outline=seam_rgb, width=3)

    # =========================================================================
    # 1. FULL BODY
    # =========================================================================
    if cat == "Full Body":
        if item_id == "m_suit_navy_three_piece":
            trouser_pts = build_smooth_trousers_path(g, is_loose=False)
            poly(trouser_pts, dark_rgb, outline=seam_rgb, width=2)
            shirt_v = [
                (x0 - w_neck - 2.0, y_chin + 9.0),
                (x0 + w_neck + 2.0, y_chin + 9.0),
                (x0 + w_neck + 4.0, y_ch + 8.0),
                (x0 - w_neck - 4.0, y_ch + 8.0),
            ]
            poly(shirt_v, (245, 247, 250), outline=(200, 205, 215), width=2)
            tie_pts = [
                (x0 - 2.5, y_sh),
                (x0 + 2.5, y_sh),
                (x0 + 3.8, y_ch + 8.0),
                (x0, y_ch + 15.0),
                (x0 - 3.8, y_ch + 8.0),
            ]
            poly(tie_pts, (62, 104, 156), outline=(40, 70, 115), width=2)
            jacket_pts = build_smooth_torso_and_sleeves_path(
                g,
                hem_y=y_hip + 10.0,
                ease_sh=2.8,
                ease_ch=3.0,
                ease_wa=2.8,
                ease_hip=3.2,
                ease_hem=3.2,
                sleeve_end_y=y_wr,
                cuff_width=10.5,
                neck_depth=16.0,
            )
            poly(jacket_pts, base_rgb, outline=seam_rgb, width=2)
            poly([(x0 - w_neck - 2.5, y_chin + 10.5), (x0 - w_neck - 10.0, y_sh + 13.0), (x0, y_sh + 16.0)], dark_rgb, outline=seam_rgb, width=2)
            poly([(x0 + w_neck + 2.5, y_chin + 10.5), (x0 + w_neck + 10.0, y_sh + 13.0), (x0, y_sh + 16.0)], dark_rgb, outline=seam_rgb, width=2)
            line([(x0, y_sh + 16.0), (x0, y_hip + 10.0)], seam_rgb, width=2)

        elif item_id in ("w_jumpsuit_black", "w_jalabiya_kurta_set", "m_kurta_set_festive"):
            pant_rgb = trim_rgb if item_id == "w_jalabiya_kurta_set" else ((242, 238, 228) if item_id == "m_kurta_set_festive" else base_rgb)
            trouser_pts = build_smooth_trousers_path(g, is_loose=(item_id != "m_kurta_set_festive"))
            poly(trouser_pts, pant_rgb, outline=seam_rgb, width=2)

            hem_y = y_hip + 4.0 if item_id == "w_jumpsuit_black" else y_kn - 6.0
            tunic_pts = build_smooth_torso_and_sleeves_path(
                g,
                hem_y=hem_y,
                ease_sh=2.0,
                ease_ch=2.4,
                ease_wa=2.0 if item_id == "w_jumpsuit_black" else 4.8,
                ease_hip=3.0 if item_id == "w_jumpsuit_black" else 6.0,
                ease_hem=3.0 if item_id == "w_jumpsuit_black" else 7.5,
                sleeve_end_y=y_wr if item_id != "w_jumpsuit_black" else y_sh + 14.0,
                cuff_width=9.5,
                neck_depth=10.0 if item_id == "w_jumpsuit_black" else 3.0,
            )
            poly(tunic_pts, base_rgb, outline=seam_rgb, width=2)
            if item_id != "w_jumpsuit_black":
                draw_collar("mandarin", base_rgb, trim_rgb)
            else:
                poly([(x0 - w_wa - 2.2, y_wa - 3.0), (x0 + w_wa + 2.2, y_wa - 3.0), (x0 + w_wa + 2.2, y_wa + 3.0), (x0 - w_wa - 2.2, y_wa + 3.0)], dark_rgb, outline=seam_rgb)

        elif item_id == "w_dress_sheath_black":
            dress_pts = build_smooth_torso_and_sleeves_path(
                g,
                hem_y=y_kn + 6.0,
                ease_sh=1.6,
                ease_ch=2.0,
                ease_wa=1.8,
                ease_hip=2.5,
                ease_hem=3.0,
                sleeve_end_y=y_sh + 16.0,
                cuff_width=9.0,
                neck_depth=5.5,
            )
            poly(dress_pts, base_rgb, outline=seam_rgb, width=2)
            line([(x0 - w_neck - 2.0, y_chin + 10.5), (x0, y_sh + 6.0), (x0 + w_neck + 2.0, y_chin + 10.5)], trim_rgb, width=6)

        else:
            is_thobe = item_id == "m_thobe_white"
            robe_pts = build_smooth_torso_and_sleeves_path(
                g,
                hem_y=y_an + 3.0,
                ease_sh=2.4,
                ease_ch=3.2,
                ease_wa=6.5 if is_thobe else 7.5,
                ease_hip=5.0,
                ease_hem=8.5 if is_thobe else 16.5,
                sleeve_end_y=y_wr if item_id != "w_saree_maroon" else y_el - 4.0,
                cuff_width=10.5 if is_thobe else 13.0,
                neck_depth=2.5 if is_thobe else 6.5,
            )
            poly(robe_pts, base_rgb, outline=seam_rgb, width=2)

            if item_id == "w_kaftan_emerald":
                line([(x0 - w_neck - 1.8, y_chin + 10.0), (x0, y_sh + 7.0), (x0 + w_neck + 1.8, y_chin + 10.0)], trim_rgb, width=6)
                line([(x0, y_sh + 7.0), (x0, y_an + 2.0)], trim_rgb, width=6)
                poly([(x0 - w_wa - 7.8, y_wa - 4.0), (x0 + w_wa + 7.8, y_wa - 4.0), (x0 + w_wa + 7.8, y_wa + 4.0), (x0 - w_wa - 7.8, y_wa + 4.0)], trim_rgb, outline=dark_rgb)
                circle(x0, y_wa, 5.2, trim_rgb, outline=dark_rgb)
            elif item_id == "w_abaya_black":
                line([(x0, y_sh + 6.5), (x0, y_an + 2.0)], trim_rgb, width=3)
                line([(x0 - g["wOuterAnkle"] - 14.0, y_an), (x0 + g["wOuterAnkle"] + 14.0, y_an)], trim_rgb, width=4)
            elif item_id == "w_saree_maroon":
                pallu = [
                    (x0 - w_sh - 2.0, y_sh),
                    (x0 - w_neck + 2.0, y_sh),
                    (x0 + w_hip + 4.5, y_hip + 8.0),
                    (x0 - w_wa - 6.0, y_wa + 10.0),
                ]
                poly(pallu, adjust_rgb(base_rgb, 1.12), outline=trim_rgb, width=5)
                line([(x0 - g["wOuterAnkle"] - 14.5, y_an - 1.5), (x0 + g["wOuterAnkle"] + 14.5, y_an - 1.5)], trim_rgb, width=8)
            elif is_thobe:
                draw_collar("mandarin", base_rgb, seam_rgb)

    # =========================================================================
    # 2. BOTTOMS
    # =========================================================================
    elif cat == "Bottom":
        if sub == "skirt":
            hem_y = y_kn + (26.0 if "pleated" in item_id else 18.0)
            flare = 14.0 if "pleated" in item_id else 8.0
            sk_pts = build_smooth_skirt_path(g, hem_y=hem_y, flare=flare)
            poly(sk_pts, base_rgb, outline=seam_rgb, width=2)
            poly(
                [
                    (x0 - w_wa - 2.0, y_wa - 2.5),
                    (x0 + w_wa + 2.0, y_wa - 2.5),
                    (x0 + w_wa + 2.4, y_wa + 3.5),
                    (x0 - w_wa - 2.4, y_wa + 3.5),
                ],
                dark_rgb,
                outline=seam_rgb,
                width=2,
            )
            if "pleated" in item_id:
                for px_frac in np.linspace(-0.78, 0.78, 9):
                    line(
                        [
                            (x0 + px_frac * w_wa, y_wa + 3.5),
                            (x0 + px_frac * (w_hip + flare - 2.0), hem_y),
                        ],
                        seam_rgb,
                        width=2,
                    )
        else:
            is_loose = "loose" in item_id or "relaxed" in item_id
            pant_pts = build_smooth_trousers_path(g, is_loose=is_loose)
            poly(pant_pts, base_rgb, outline=seam_rgb, width=2)
            poly(
                [
                    (x0 - w_wa - 2.0, y_wa - 2.5),
                    (x0 + w_wa + 2.0, y_wa - 2.5),
                    (x0 + w_wa + 2.4, y_wa + 3.5),
                    (x0 - w_wa - 2.4, y_wa + 3.5),
                ],
                dark_rgb,
                outline=seam_rgb,
                width=2,
            )
            line([(x0, y_wa + 3.5), (x0, y_cr + 1.5)], seam_rgb, width=2)
            circle(x0, y_wa + 0.5, 1.3, trim_rgb)
            if "trousers" in item_id or "chinos" in item_id:
                for sign in (-1.0, 1.0):
                    cx_leg = x0 + sign * ((g["wOuterKnee"] + g["wInnerKnee"]) * 0.5)
                    line([(cx_leg, y_hip + 4.0), (cx_leg, y_an + 2.0)], seam_rgb, width=1)

    # =========================================================================
    # 3. TOPS
    # =========================================================================
    elif cat == "Top":
        is_longline = sub in ("tunic", "kurta")
        is_short_sleeve = any(k in item_id for k in ("polo", "tshirt", "relaxed_white"))
        hem_y = (y_cr + 28.0) if is_longline else (y_hip + 3.0)
        wa_ease = 4.8 if (is_longline or "relaxed" in item_id) else 2.2

        top_pts = build_smooth_torso_and_sleeves_path(
            g,
            hem_y=hem_y,
            ease_sh=2.0,
            ease_ch=2.4,
            ease_wa=wa_ease,
            ease_hip=3.5 if is_longline else 2.2,
            ease_hem=5.0 if is_longline else 2.4,
            sleeve_end_y=(y_el - 4.0) if is_short_sleeve else y_wr,
            cuff_width=9.5,
            neck_depth=5.5 if ("tshirt" in item_id or "longsleeve" in item_id) else 3.0,
        )
        poly(top_pts, base_rgb, outline=seam_rgb, width=2)

        if is_longline or "stand_collar" in item_id:
            draw_collar("mandarin", base_rgb, trim_rgb)
        elif "sweater" in item_id:
            draw_collar("shawl", base_rgb, trim_rgb)
        elif "shirt" in sub or "polo" in sub or "guayabera" in sub:
            draw_collar("shirt", base_rgb, trim_rgb)

        if "guayabera" in item_id:
            for sign in (-1.0, 1.0):
                px = x0 + sign * (w_ch * 0.46)
                line([(px - 1.5, y_sh + 3.0), (px - 1.5, hem_y - 2.0)], seam_rgb, width=2)
                line([(px + 1.5, y_sh + 3.0), (px + 1.5, hem_y - 2.0)], seam_rgb, width=2)

    # =========================================================================
    # 4. OUTERWEAR
    # =========================================================================
    elif cat == "Outerwear":
        is_long_coat = any(k in item_id for k in ("trench", "cardigan", "achkan"))
        is_sleeveless = "waistcoat" in item_id
        hem_y = (y_kn + 14.0) if is_long_coat else (y_hip + 9.0)

        coat_pts = build_smooth_torso_and_sleeves_path(
            g,
            hem_y=hem_y,
            ease_sh=1.2 if is_sleeveless else 3.6,
            ease_ch=3.8,
            ease_wa=3.8,
            ease_hip=4.5,
            ease_hem=7.5 if is_long_coat else 4.2,
            sleeve_end_y=None if is_sleeveless else (y_wr + 1.0),
            cuff_width=11.0,
            neck_depth=2.5 if ("achkan" in item_id or "waistcoat" in item_id) else 15.0,
        )
        poly(coat_pts, base_rgb, outline=seam_rgb, width=2)

        if "cardigan" in item_id:
            # Cut open center vertical strip on open-front cardigan so underlayer shirt shows through!
            open_strip = [
                pt(x0 - 6.5, y_chin + 8.0),
                pt(x0 + 6.5, y_chin + 8.0),
                pt(x0 + 7.5, hem_y + 5.0),
                pt(x0 - 7.5, hem_y + 5.0),
            ]
            draw.polygon(open_strip, fill=(0, 0, 0, 0))
        elif "achkan" in item_id or "waistcoat" in item_id:
            draw_collar("mandarin", base_rgb, trim_rgb)
            line([(x0, y_sh + 2.0), (x0, hem_y)], trim_rgb, width=3)
            for by in np.linspace(y_sh + 8.0, y_hip - 2.0, 6):
                circle(x0, float(by), 1.4, trim_rgb)
        else:
            poly([(x0 - w_neck - 2.5, y_chin + 10.5), (x0 - w_neck - 10.5, y_sh + 13.0), (x0, y_sh + 15.5)], dark_rgb, outline=seam_rgb, width=2)
            poly([(x0 + w_neck + 2.5, y_chin + 10.5), (x0 + w_neck + 10.5, y_sh + 13.0), (x0, y_sh + 15.5)], dark_rgb, outline=seam_rgb, width=2)
            line([(x0, y_sh + 15.5), (x0, hem_y)], seam_rgb, width=2)
            if "trench" in item_id:
                poly([(x0 - w_wa - 4.2, y_wa - 3.0), (x0 + w_wa + 4.2, y_wa - 3.0), (x0 + w_wa + 4.2, y_wa + 3.0), (x0 - w_wa - 4.2, y_wa + 3.0)], dark_rgb, outline=seam_rgb, width=2)

    # =========================================================================
    # 5. FOOTWEAR (SMOOTH CURVED PAIRED LEFT & RIGHT SHOES)
    # =========================================================================
    elif cat == "Footwear":
        is_boot = "boot" in item_id
        is_sandal = "sandal" in item_id
        is_sneaker = "sneaker" in item_id
        top_shoe_y = (y_an - 10.0) if is_boot else (y_an - 1.5)
        sole_rgb = (242, 244, 248) if is_sneaker else darker_rgb

        for sign in (-1.0, 1.0):
            in_x = x0 + sign * (g["wInnerAnkle"] - 1.5)
            out_x = x0 + sign * (g["wFootTip"] + 2.5)
            an_out_x = x0 + sign * (g["wOuterAnkle"] + 1.5)

            shoe_curve: list[tuple[float, float]] = [(in_x, top_shoe_y), (an_out_x, top_shoe_y)]
            shoe_curve.extend(
                cubic_bezier(
                    (an_out_x, top_shoe_y),
                    (an_out_x + sign * 1.5, y_an + 6.0),
                    (out_x + sign * 2.0, y_ft - 5.5),
                    (out_x, y_ft + 1.5),
                    16,
                )
            )
            shoe_curve.extend(
                cubic_bezier(
                    (out_x, y_ft + 1.5),
                    ((in_x + out_x) * 0.5, y_ft + 2.8),
                    ((in_x + out_x) * 0.5, y_ft + 2.8),
                    (in_x, y_ft + 1.5),
                    12,
                )
            )
            shoe_curve.extend(
                cubic_bezier(
                    (in_x, y_ft + 1.5),
                    (in_x - sign * 0.8, y_an + 8.0),
                    (in_x, top_shoe_y + 4.0),
                    (in_x, top_shoe_y),
                    12,
                )
            )
            poly(shoe_curve, base_rgb, outline=seam_rgb, width=2)
            line([(in_x, y_ft + 1.0), (out_x, y_ft + 1.0)], sole_rgb, width=5)
            if is_sandal:
                circle((in_x + out_x) * 0.5, y_an + 5.5, 3.2, light_rgb, outline=seam_rgb)
            elif is_sneaker:
                line([(in_x + sign * 2.0, y_an + 5.0), (out_x - sign * 2.0, y_an + 8.0)], trim_rgb, width=4)

    shaded = apply_3d_fabric_shading_and_texture(img, spec=spec)
    return shaded.resize((400, 900), Image.Resampling.LANCZOS)


def build_point_cloud_mesh(
    spec: dict[str, Any],
    default_viewbox: dict[str, float],
    alpha_crop: np.ndarray,
) -> dict[str, Any]:
    sex = spec["sex"]
    g = compute_avatar_geometry(sex=sex)
    vx = default_viewbox["x"]
    vy = default_viewbox["y"]
    vw = max(1.0, default_viewbox["width"])
    vh = max(1.0, default_viewbox["height"])

    ch, cw = alpha_crop.shape
    rows = 8 if spec["category"] != "Footwear" else 4
    cols = 5

    vertices: list[dict[str, Any]] = []
    grid_idx: dict[tuple[int, int], int] = {}

    def classify_zone(svg_y: float) -> str:
        if svg_y <= g["yShoulders"] + 6:
            return "shoulders"
        if svg_y <= (g["yChest"] + g["yWaist"]) * 0.5:
            return "chest"
        if svg_y <= (g["yWaist"] + g["yHip"]) * 0.5:
            return "waist"
        if svg_y <= g["yCrotch"] + 10:
            return "hip"
        if svg_y <= g["yKnees"] + 15:
            return "knee"
        if svg_y <= g["yAnkles"] + 6:
            return "ankle"
        return "feet"

    for r in range(rows):
        v_norm = r / float(rows - 1)
        py = min(ch - 1, max(0, int(round(v_norm * (ch - 1)))))
        band_y0 = max(0, py - max(2, ch // 20))
        band_y1 = min(ch, py + max(3, ch // 20))
        opaque_xs = np.where((alpha_crop[band_y0:band_y1, :] > 25).any(axis=0))[0]
        if len(opaque_xs) >= 2:
            u_min = float(opaque_xs[0]) / max(1, cw - 1)
            u_max = float(opaque_xs[-1]) / max(1, cw - 1)
        else:
            u_min, u_max = 0.15, 0.85

        svg_y = vy + v_norm * vh
        zone = classify_zone(svg_y)

        for c in range(cols):
            t_col = c / float(cols - 1)
            u_norm = u_min + t_col * (u_max - u_min)
            svg_x = vx + u_norm * vw
            idx = len(vertices)
            grid_idx[(r, c)] = idx
            vertices.append(
                {
                    "u": round(u_norm, 4),
                    "v": round(v_norm, 4),
                    "svg_x": round(svg_x, 2),
                    "svg_y": round(svg_y, 2),
                    "zone": zone,
                    "is_edge": bool(c == 0 or c == cols - 1 or r == 0 or r == rows - 1),
                    "is_center": bool(c == cols // 2),
                }
            )

    triangles: list[list[int]] = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            i00 = grid_idx[(r, c)]
            i10 = grid_idx[(r, c + 1)]
            i01 = grid_idx[(r + 1, c)]
            i11 = grid_idx[(r + 1, c + 1)]
            triangles.append([i00, i10, i11])
            triangles.append([i00, i11, i01])

    return {
        "rows": rows,
        "cols": cols,
        "vertices": vertices,
        "triangles": triangles,
    }


def main() -> None:
    ONBOARDING_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    raw_js = DATASET_JS_PATH.read_text(encoding="utf-8")
    start_marker = "export const ONBOARDING_STATIC_DATASET = "
    start_idx = raw_js.index(start_marker) + len(start_marker)
    end_idx = raw_js.index(";\n\nexport const WOMEN_ONBOARDING_DATASET")
    items: list[dict[str, Any]] = json.loads(raw_js[start_idx:end_idx])

    for item in items:
        item_id = item["id"]
        full_400x900 = draw_fitted_garment(item)
        arr = np.array(full_400x900)
        alpha = arr[:, :, 3]
        ys, xs = np.where(alpha > 12)

        pad = 4
        min_x = max(0, int(xs.min()) - pad)
        max_x = min(399, int(xs.max()) + pad)
        min_y = max(0, int(ys.min()) - pad)
        max_y = min(899, int(ys.max()) + pad)

        cropped = full_400x900.crop((min_x, min_y, max_x + 1, max_y + 1))
        png_path = ONBOARDING_ASSETS_DIR / f"{item_id}.png"
        cropped.save(png_path, format="PNG", optimize=True)

        jpg_bg = Image.new("RGB", cropped.size, (248, 247, 244))
        jpg_bg.paste(cropped, mask=cropped.split()[3])
        jpg_bg.save(ONBOARDING_ASSETS_DIR / f"{item_id}.jpg", format="JPEG", quality=92)

        default_viewbox = {
            "x": round(min_x / 2.0, 2),
            "y": round(min_y / 2.0, 2),
            "width": round((max_x - min_x + 1) / 2.0, 2),
            "height": round((max_y - min_y + 1) / 2.0, 2),
        }

        point_cloud = build_point_cloud_mesh(
            item,
            default_viewbox=default_viewbox,
            alpha_crop=np.array(cropped)[:, :, 3],
        )

        item["image_url"] = f"/assets/onboarding/{item_id}.png"
        item["avatar_fit"] = {
            "fitted_to_default_avatar": True,
            "default_sex": item["sex"],
            "default_viewbox": default_viewbox,
            "point_cloud": point_cloud,
        }

    header = raw_js[: raw_js.index(start_marker)]
    footer = raw_js[end_idx:]
    updated_js = f"{header}{start_marker}{json.dumps(items, indent=2, ensure_ascii=False)}{footer}"
    DATASET_JS_PATH.write_text(updated_js, encoding="utf-8")
    print(f"Smooth Cubic-Bezier fitted all {len(items)} garments + Point-Cloud Meshes!")


if __name__ == "__main__":
    main()
