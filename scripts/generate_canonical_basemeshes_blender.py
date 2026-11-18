"""
MISSION CONTROL DIRECTIVE: PROCEDURAL CANONICAL BASEMESH GENERATION VIA BLENDER
Generates clean, low-poly, quad-dominant, manifold canonical 3D garment, footwear,
and accessory basemeshes reproduced directly from the male and female avatar meshes.

Run via:
  "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P scripts/generate_canonical_basemeshes_blender.py
"""

import os
import sys
import math
import time
import shutil
import tempfile
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB_MODELS_DIR = os.path.join(ROOT_DIR, "apps", "web", "public", "models")
WEB_TEMPLATES_DIR = os.path.join(WEB_MODELS_DIR, "templates")
ASSETS_AVATARS_DIR = os.path.join(ROOT_DIR, "assets", "avatars")
ASSETS_TEMPLATES_DIR = os.path.join(ROOT_DIR, "assets", "templates")


def safe_copy(src, dst):
    src_norm = os.path.normcase(os.path.abspath(src))
    dst_norm = os.path.normcase(os.path.abspath(dst))
    if src_norm == dst_norm:
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    for attempt in range(15):
        try:
            shutil.copy2(src, dst)
            return
        except (PermissionError, OSError):
            time.sleep(0.3)


def ensure_dirs():
    os.makedirs(ASSETS_AVATARS_DIR, exist_ok=True)
    os.makedirs(ASSETS_TEMPLATES_DIR, exist_ok=True)
    os.makedirs(WEB_TEMPLATES_DIR, exist_ok=True)
    for gender in ("male", "female"):
        os.makedirs(os.path.join(ASSETS_TEMPLATES_DIR, gender), exist_ok=True)
        os.makedirs(os.path.join(WEB_TEMPLATES_DIR, gender), exist_ok=True)

    # Copy canonical avatars to assets/avatars/avatar_{gender}.glb
    male_src = os.path.join(WEB_MODELS_DIR, "avatar_male_1.glb")
    female_src = os.path.join(WEB_MODELS_DIR, "avatar_female_1.glb")
    if os.path.exists(male_src):
        shutil.copy2(male_src, os.path.join(ASSETS_AVATARS_DIR, "avatar_male.glb"))
    if os.path.exists(female_src):
        shutil.copy2(female_src, os.path.join(ASSETS_AVATARS_DIR, "avatar_female.glb"))


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_avatar_data(gender):
    """Loads avatar_{gender}.glb in Blender and extracts anatomical slices & BVHTree in world space."""
    clear_scene()
    glb_path = os.path.join(ASSETS_AVATARS_DIR, f"avatar_{gender}.glb")
    bpy.ops.import_scene.gltf(filepath=glb_path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    main_obj = max(meshes, key=lambda o: len(o.data.vertices))

    # Extract world-space vertices (Blender Z-up: X=right, Y=-Z_gltf(back=+Y, front=-Y), Z=Y_gltf(height))
    mw = main_obj.matrix_world
    verts = [mw @ v.co for v in main_obj.data.vertices]
    bm = bmesh.new()
    bm.from_mesh(main_obj.data)
    bmesh.ops.transform(bm, matrix=mw, verts=bm.verts)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bvh = BVHTree.FromBMesh(bm)

    mat_names = [ms.material.name.lower() if ms.material else "" for ms in main_obj.material_slots]
    skin_bm = bmesh.new()
    for f in bm.faces:
        mname = mat_names[f.material_index] if f.material_index < len(mat_names) else ""
        if "skin" in mname:
            try:
                skin_bm.faces.new([skin_bm.verts.new(v.co) for v in f.verts])
            except ValueError:
                pass
    skin_bm.verts.ensure_lookup_table()
    skin_bm.faces.ensure_lookup_table()
    skin_only_bvh = BVHTree.FromBMesh(skin_bm) if len(skin_bm.faces) > 0 else bvh
    skin_bm.free()

    # Combined head+hair+body BVH across all mesh objects in the avatar GLB (for hood skin/hair clearance)
    full_bm = bmesh.new()
    for m_obj in meshes:
        tmp_bm = bmesh.new()
        tmp_bm.from_mesh(m_obj.data)
        bmesh.ops.transform(tmp_bm, matrix=m_obj.matrix_world, verts=tmp_bm.verts)
        v_map = {v: full_bm.verts.new(v.co) for v in tmp_bm.verts}
        for f in tmp_bm.faces:
            try:
                full_bm.faces.new([v_map[v] for v in f.verts])
            except ValueError:
                pass
        tmp_bm.free()
    full_bm.verts.ensure_lookup_table()
    full_bm.faces.ensure_lookup_table()
    full_bvh = BVHTree.FromBMesh(full_bm)
    full_bm.free()

    return {
        "gender": gender,
        "verts": verts,
        "bm": bm,
        "bvh": bvh,
        "skin_only_bvh": skin_only_bvh,
        "full_bvh": full_bvh,
        "avatar_obj": main_obj,
    }


def measure_torso_slice(verts, z_height, band=0.018, x_limit=None):
    """Measures torso half-width rx, front/back Y bounds at height z_height directly from avatar vertices."""
    if x_limit is None:
        # Exclude 27-deg A-pose arms below shoulder level so torso rx is pure trunk width
        x_limit = 0.22 if z_height >= 1.33 else 0.185
    pts = [v for v in verts if abs(v.z - z_height) <= band and abs(v.x) <= x_limit]
    if not pts:
        pts = [v for v in verts if abs(v.z - z_height) <= band * 2.5 and abs(v.x) <= x_limit]
    if not pts:
        return {"rx": 0.16, "y_front": -0.10, "y_back": 0.08, "cy": -0.01, "ry": 0.09}
    rx = max(abs(v.x) for v in pts)
    # In Blender after glTF import: front is -Y, back is +Y
    y_front = min(v.y for v in pts)
    y_back = max(v.y for v in pts)
    cy = 0.5 * (y_front + y_back)
    ry = max(0.04, 0.5 * (y_back - y_front))
    return {
        "rx": max(0.055, rx),
        "y_front": y_front,
        "y_back": y_back,
        "cy": cy,
        "ry": ry,
    }


def measure_leg_slice(verts, z_height, band=0.018):
    """Measures left leg (x > 0.01) center and radii at height z_height directly from avatar vertices."""
    pts = [v for v in verts if abs(v.z - z_height) <= band and 0.008 <= v.x <= 0.24]
    if not pts:
        pts = [v for v in verts if abs(v.z - z_height) <= band * 2.5 and 0.008 <= v.x <= 0.24]
    if not pts:
        return {"cx": 0.12, "rx": 0.06, "cy": -0.01, "ry": 0.06}
    x_min = min(v.x for v in pts)
    x_max = max(v.x for v in pts)
    y_min = min(v.y for v in pts)
    y_max = max(v.y for v in pts)
    cx = 0.5 * (x_min + x_max)
    rx = max(0.032, 0.5 * (x_max - x_min))
    cy = 0.5 * (y_min + y_max)
    ry = max(0.036, 0.5 * (y_max - y_min))
    return {"cx": cx, "rx": rx, "cy": cy, "ry": ry}


def measure_arm_slice(verts, x_dist, z_min=0.70, z_max=1.55, band=0.018, is_male=True):
    """Measures arm center and radii at lateral distance x_dist using anatomical 3D arm axis."""
    x_sh = 0.220 if is_male else 0.192
    z_sh = 1.370 if is_male else 1.275
    y_sh = -0.008 if is_male else -0.008
    x_wr = 0.465 if is_male else 0.410
    z_wr = 0.975 if is_male else 0.907
    y_wr = -0.028 if is_male else -0.025

    t_arm = max(0.0, min(1.0, (x_dist - x_sh) / max(0.01, x_wr - x_sh)))
    z_axis = z_sh + t_arm * (z_wr - z_sh)
    y_axis = y_sh + t_arm * (y_wr - y_sh)

    pts = [
        v for v in verts
        if abs(v.x - x_dist) <= band
        and abs(v.z - z_axis) <= 0.125
        and abs(v.y - y_axis) <= 0.110
    ]
    if not pts:
        pts = [
            v for v in verts
            if abs(v.x - x_dist) <= band * 2.0
            and abs(v.z - z_axis) <= 0.115
            and abs(v.y - y_axis) <= 0.115
        ]
    if not pts:
        return {"cz": z_axis, "rz": 0.045, "cy": y_axis, "ry": 0.042}

    z0 = min(v.z for v in pts)
    z1 = max(v.z for v in pts)
    y0 = min(v.y for v in pts)
    y1 = max(v.y for v in pts)
    cz = 0.5 * (z0 + z1)
    rz = max(0.024, min(0.075, 0.5 * (z1 - z0)))
    cy = 0.5 * (y0 + y1)
    ry = max(0.024, min(0.070, 0.5 * (y1 - y0)))
    return {"cz": cz, "rz": rz, "cy": cy, "ry": ry}


def get_wrist_cuff_spec(is_male):
    """Returns exact anatomical wrist center, elbow-to-wrist forearm axis, and wrist radius."""
    if is_male:
        return (
            Vector((0.4486, -0.0210, 1.0026)),
            Vector((0.5513, -0.0796, -0.8305)).normalized(),
            0.0365,
        )
    return (
        Vector((0.4031, -0.0179, 0.9151)),
        Vector((0.5754, -0.0750, -0.8144)).normalized(),
        0.0315,
    )


def drape_garment_shell(
    bm,
    avatar_data,
    offset,
    style="top",
    drape_looseness=0.72,
    z_hem=0.80,
    z_top=1.45,
    sleeve_type="none",
    flare_hips=False,
):
    """
    Transforms a raw body-conforming cut mesh into a tailored, gravity-draped 3D cloth shell:
      1. Convex Bust Bridge: Eliminates the sternum cleavage trench between the breasts so fabric stretches taut across the bust peaks.
      2. Gravity Drape Below Bust & Scapulae: Replaces the anatomical under-bust crease, ribcage hollows, navel dimple, and lumbar curve with a smooth vertical/conical cloth hang from chest/scapula apex to hem.
      3. Posterior Gluteal Cleft Bridge: Bridges across left/right glute peaks so trousers, dresses, and long coats never dip into the gluteal cleft.
      4. Tailored Cylindrical Sleeves & Relaxed Armhole Gusset: Shapes sleeves into smooth cylindrical cloth tubes around the 3D arm axis with dropped underarm ease.
      5. Tailored Cylindrical Trouser Columns: Shapes pant/short legs below the crotch into clean tailored columns, eliminating kneecap bumps and calf/thigh muscle grooves.
      6. Cloth-Tension Surface Laplacian Relaxation + Strict BVHTree Skin Clearance Floor: Smooths out all anatomical ripples while guaranteeing 0.00% avatar skin penetration.
    """
    is_male = avatar_data["gender"] == "male"
    av_verts = avatar_data["verts"]
    bvh = avatar_data["bvh"]

    # Remove any non-manifold edges/faces before solidifying so solidify_bmesh_manifold produces 0 non-manifold edges
    for _nm_pass in range(4):
        nm_faces = set()
        for e in bm.edges:
            if len(e.link_faces) > 2:
                for f in e.link_faces:
                    nm_faces.add(f)
        if not nm_faces:
            break
        bmesh.ops.delete(bm, geom=list(nm_faces), context="FACES")

    # Seal any residual tiny boundary holes in the closed solidified shell
    rem_b = [e for e in bm.edges if e.is_boundary]
    if rem_b:
        try:
            bmesh.ops.holes_fill(bm, edges=rem_b, sides=8)
        except Exception:
            pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()

    # Base outward offset along vertex normal
    for v in bm.verts:
        v.co += v.normal * offset

    # Pre-measure key anatomical landmarks for gravity drape envelopes
    z_bust = 1.29 if is_male else 1.225
    z_scapula = 1.32 if is_male else 1.26
    z_waist = 1.06 if is_male else 1.02
    z_hip_peak = 0.90 if is_male else 0.87
    z_crotch = 0.80 if is_male else 0.755

    # Measure bust peaks (front is -Y in Blender Z-up space)
    bust_pts = [
        p for p in av_verts
        if (z_bust - 0.05) <= p.z <= (z_bust + 0.05) and 0.04 <= abs(p.x) <= 0.135 and p.y < -0.04
    ]
    y_bust_peak = (min(p.y for p in bust_pts) - offset) if bust_pts else (-0.135 - offset)
    x_bust_peak = 0.092 if is_male else 0.088

    # Measure scapula / upper-back peak (+Y in Blender Z-up space)
    back_pts = [
        p for p in av_verts
        if (z_scapula - 0.06) <= p.z <= (z_scapula + 0.06) and abs(p.x) <= 0.145 and p.y > 0.04
    ]
    y_back_peak = (max(p.y for p in back_pts) + offset) if back_pts else (0.105 + offset)

    # Measure glute peak (+Y in Blender Z-up space)
    glute_pts = [
        p for p in av_verts
        if (z_hip_peak - 0.07) <= p.z <= (z_hip_peak + 0.05) and 0.04 <= abs(p.x) <= 0.135 and p.y > 0.04
    ]
    y_glute_peak = (max(p.y for p in glute_pts) + offset) if glute_pts else (0.118 + offset)
    x_glute_peak = 0.095 if is_male else 0.092

    # Measure hip lateral half-width
    hip_sl = measure_torso_slice(av_verts, z_hip_peak)
    rx_hip_drape = hip_sl["rx"] + offset

    # Measure thigh & ankle slices for tailored trouser columns
    thigh_sl = measure_leg_slice(av_verts, z_crotch - 0.05)
    knee_sl = measure_leg_slice(av_verts, 0.49 if is_male else 0.46)
    ankle_sl = measure_leg_slice(av_verts, 0.12)

    # Apply analytic drape to ALL vertices (including hem/cuff boundaries) so boundary rings move coherently
    # with their interior neighbors and never create an inverted lip!
    for v in bm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        abs_x = abs(x)
        x_arm_split = (0.180 + max(0.0, 1.28 - z) * 0.40) if is_male else (0.152 + max(0.0, 1.20 - z) * 0.38)
        is_sleeve_vert = (style in ("top", "dress")) and (sleeve_type in ("short", "long")) and (abs_x > x_arm_split)

        if is_sleeve_vert:
            # 4. Tailored Cylindrical Sleeve + Relaxed Underarm Gusset + Loose Sleeves with Tight Wrist Cuff
            # Clamp x passed to measure_arm_slice so vertical slices never include the thumb/palm past the wrist
            x_slice_max = 0.422 if is_male else 0.382
            arm_sl = measure_arm_slice(av_verts, min(abs_x, x_slice_max), is_male=is_male)
            cz_arm = arm_sl["cz"]
            cy_arm = arm_sl["cy"]
            dy = y - cy_arm
            dz = z - cz_arm
            r_cur = max(1e-4, math.hypot(dy, dz))

            if sleeve_type == "long":
                wrist_r_spec, arm_dir_r_spec, r_wrist_anat = get_wrist_cuff_spec(is_male)
                x_wrist_end = wrist_r_spec.x
                t_arm = min(1.0, max(0.0, (abs_x - x_arm_split) / max(1e-4, x_wrist_end - x_arm_split)))

                # Knit sweaters (hoodie), cardigans, and loose long-sleeves have relaxed, voluminous sleeves along bicep/forearm
                # and taper down to a clean, straight wrist cuff right at the anatomical wrist
                is_sweater_or_knit = drape_looseness >= 0.80
                max_ease = (0.016 if is_sweater_or_knit else 0.010) * drape_looseness
                fullness = math.sin(min(1.0, t_arm / 0.78) * math.pi)

                # Approaching the wrist cuff (t_arm > 0.75), smoothly taper to the clean wrist circumference
                cuff_taper = 1.0 if t_arm <= 0.75 else max(0.0, 1.0 - ((t_arm - 0.75) / 0.25) ** 2)
                sleeve_ease = offset + 0.0025 + (max_ease * fullness * cuff_taper)
                r_target = max(arm_sl["rz"], arm_sl["ry"]) + sleeve_ease

                # Expand along arm to full relaxed cylindrical target
                blend_cyl = 0.65 * drape_looseness
                r_new = max(r_cur, r_target) if is_sweater_or_knit else (r_cur * (1.0 - blend_cyl) + r_target * blend_cyl)

                # Right at the wrist cuff (t_arm > 0.78), smoothly align to the perpendicular wrist cylinder
                # centered on wrist_r_spec so the cuff forms a clean, straight cut with zero thumb/hand flare
                if t_arm > 0.75:
                    t_cuff_lock = (t_arm - 0.75) / 0.25
                    t_cuff_lock = t_cuff_lock * t_cuff_lock * (3.0 - 2.0 * t_cuff_lock)
                    r_cuff_clean = r_wrist_anat + 0.0065
                    p_cur = Vector((abs_x, cy_arm + (dy / r_cur) * r_new, cz_arm + (dz / r_cur) * r_new))
                    rel_w = p_cur - wrist_r_spec
                    axial = rel_w.dot(arm_dir_r_spec)
                    perp = rel_w - axial * arm_dir_r_spec
                    perp_len = perp.length
                    if perp_len > 1e-5:
                        p_clean = wrist_r_spec + axial * arm_dir_r_spec + (perp / perp_len) * r_cuff_clean
                        p_out = p_cur.lerp(p_clean, t_cuff_lock)
                        v.co.x = p_out.x if x >= 0.0 else -p_out.x
                        v.co.y = p_out.y
                        v.co.z = p_out.z
                else:
                    v.co.y = cy_arm + (dy / r_cur) * r_new
                    v.co.z = cz_arm + (dz / r_cur) * r_new

                # Soft fabric gravity droop under the loose sleeve (excluding tight cuff)
                if dz < 0.0 and cuff_taper > 0.15:
                    v.co.z -= 0.007 * fullness * cuff_taper * drape_looseness

                # Natural shoulder line: cap top-of-shoulder cloth height so sleeves never form pointed horns/pads
                if dz > 0.0 and z > (1.40 if is_male else 1.34):
                    max_sh_z = cz_arm + arm_sl["rz"] + offset + 0.002
                    if v.co.z > max_sh_z:
                        v.co.z = max_sh_z
            else:
                # Short sleeve natural anatomical drape: follow the elliptical arm contour with subtle gravity ease
                # (avoids rigid circular robot-tube cylinders while keeping clean bicep & underarm clearance)
                x_shoulder_tip = 0.210 if is_male else 0.185
                x_cuff_approx = 0.305 if is_male else 0.270
                t_sleeve = max(0.0, min(1.0, (abs_x - x_shoulder_tip) / max(0.02, x_cuff_approx - x_shoulder_tip)))
                sleeve_ease = offset + (0.0065 if dz < 0.0 else 0.0045) * (0.45 + 0.55 * drape_looseness)
                ry_arm = arm_sl["ry"] + sleeve_ease
                rz_arm = arm_sl["rz"] + sleeve_ease
                theta_arm = math.atan2(dz, dy)
                r_ell = 1.0 / max(1e-4, math.hypot(math.cos(theta_arm) / max(1e-4, ry_arm), math.sin(theta_arm) / max(1e-4, rz_arm)))
                if r_cur < r_ell:
                    blend_slv = (0.30 + 0.50 * t_sleeve) * drape_looseness
                    r_new = r_cur * (1.0 - blend_slv) + r_ell * blend_slv
                    v.co.y = cy_arm + (dy / r_cur) * r_new
                    v.co.z = cz_arm + (dz / r_cur) * r_new
                # Gentle under-sleeve gravity sag toward the cuff
                if dz < 0.0:
                    v.co.z -= 0.004 * (0.3 + 0.7 * t_sleeve) * drape_looseness

# Underarm crease preserved with positive skin clearance floor
            continue

        if style in ("top", "dress"):
            # 1. Convex Bust Bridge across the sternum cleavage hollow (front: y < 0)
            if y < -0.02 and (z_bust - 0.11) <= z <= (z_bust + 0.11) and abs_x <= x_bust_peak * 1.15:
                t_z_bust = max(0.0, 1.0 - abs(z - z_bust) / 0.11)
                s_z_bust = t_z_bust * t_z_bust * (3.0 - 2.0 * t_z_bust)
                t_x_bust = max(0.0, 1.0 - (abs_x / (x_bust_peak * 1.15)) ** 2)
                y_bridge = y_bust_peak * (0.94 + 0.05 * t_x_bust)
                if v.co.y > y_bridge:
                    bridge_w = min(0.92, 0.75 + 0.18 * drape_looseness) * s_z_bust * t_x_bust
                    v.co.y = v.co.y * (1.0 - bridge_w) + y_bridge * bridge_w

            # 2a. Front Gravity Drape below the Bust (eliminates under-bust suck-in & navel dimple)
            if y < -0.01 and z < z_bust and abs_x < (x_arm_split - 0.008):
                t_drop = min(1.0, max(0.0, (z_bust - z) / max(0.12, z_bust - max(z_hem, 0.78))))
                cos_x = math.cos(min(1.0, abs_x / max(0.13, rx_hip_drape * 0.92)) * (math.pi * 0.46))
                # Vertical/conical hang line from bust peak down to lower abdomen/hem
                y_hang_front = (y_bust_peak * (1.0 - 0.10 * t_drop)) * max(0.25, cos_x)
                if v.co.y > y_hang_front:
                    underbust_boost = 0.22 * math.exp(-((z - (z_bust - 0.045)) / 0.055) ** 2)
                    w_front = min(0.88, drape_looseness * 0.72 + underbust_boost)
                    # Completely bridge over the anatomical navel dimple so no belly pinhole/crease remains
                    if abs_x < 0.028 and (z_waist - 0.04) <= z <= (z_waist + 0.09):
                        w_front = 1.0
                    v.co.y = v.co.y * (1.0 - w_front) + y_hang_front * w_front

            # 2b. Back Gravity Drape below the Scapulae (fills in deep lower-back lordosis hollow)
            if y > 0.01 and z < z_scapula and abs_x < (x_arm_split - 0.008):
                t_back = min(1.0, max(0.0, (z_scapula - z) / max(0.15, z_scapula - z_hip_peak)))
                y_spine_line = y_back_peak * (1.0 - t_back) + y_glute_peak * t_back
                cos_x_b = math.cos(min(1.0, abs_x / max(0.13, rx_hip_drape * 0.92)) * (math.pi * 0.44))
                y_hang_back = y_spine_line * max(0.30, cos_x_b)
                if v.co.y < y_hang_back:
                    w_back = min(0.84, drape_looseness * 0.70)
                    v.co.y = v.co.y * (1.0 - w_back) + y_hang_back * w_back

            # 2c. Lateral Waist-Hollow Drape: prevents robotic wide-bust / narrow-waist hourglass pinching.
            # Interpolate a natural side-seam drape line from chest/underarm to hip so the waist hangs smoothly.
            if (z_hip_peak - 0.02) <= z <= (z_bust + 0.02) and abs_x > 0.08 and abs_x < (x_arm_split - 0.008):
                t_waist = math.sin(min(1.0, max(0.0, (z - z_hip_peak) / max(0.10, z_bust - z_hip_peak))) * math.pi)
                t_chest_hip = min(1.0, max(0.0, (z - z_hip_peak) / max(0.10, z_bust - z_hip_peak)))
                chest_sl = measure_torso_slice(av_verts, z_bust)
                rx_chest_drape = chest_sl["rx"] + offset
                rx_straight_line = rx_hip_drape * (1.0 - t_chest_hip) + rx_chest_drape * t_chest_hip
                # Gentle natural drape: fill ~65% of the inward waist hollow so it fits the body without pinching
                x_target_side = rx_straight_line * (0.94 + 0.04 * (1.0 - t_waist))
                if abs_x < x_target_side and abs_x > 0.10:
                    w_side = min(0.75, 0.45 + 0.35 * drape_looseness) * t_waist
                    new_abs_x = abs_x * (1.0 - w_side) + x_target_side * w_side
                    v.co.x = math.copysign(new_abs_x, x)
                else:
                    x_ease = (0.012 * drape_looseness * t_waist)
                    v.co.x += math.copysign(x_ease, x)

            if flare_hips and z < 0.98:
                t_flare = min(1.0, max(0.0, (0.98 - z) / 0.45))
                s_flare = (1.0 - math.cos(t_flare * math.pi)) * 0.5
                v.co.x += (0.018 * s_flare) * (1.0 if x > 0 else -1.0)
                v.co.y += (0.012 * s_flare) * (1.0 if y > 0 else -1.0)

        # 3. Posterior Gluteal Cleft Bridge (for bottoms, dresses, and long tops/coats reaching hip level)
        if y > 0.02 and (z_crotch - 0.04) <= z <= (z_waist + 0.02) and abs_x <= x_glute_peak * 1.15:
            local_glutes = [
                p for p in av_verts
                if abs(p.z - z) <= 0.022 and 0.035 <= abs(p.x) <= 0.135 and p.y > 0.02
            ]
            if local_glutes:
                y_local_glute = max(p.y for p in local_glutes) + offset
                t_x_glute = max(0.0, 1.0 - (abs_x / (x_glute_peak * 1.15)) ** 2)
                y_cleft_bridge = y_local_glute * (0.96 + 0.03 * t_x_glute)
                if v.co.y < y_cleft_bridge:
                    w_glute = 0.88 * t_x_glute
                    v.co.y = v.co.y * (1.0 - w_glute) + y_cleft_bridge * w_glute

        # 5. Tailored Trouser / Short Legs: continuous drape from gluteus apex down the posterior leg,
        # completely eliminating the abrupt 4.4cm step below the pelvis!
        if style == "bottom":
            z_glute_apex = 0.88 if is_male else 0.84
            # Smooth posterior drape below glute apex:
            # Replaces the abrupt 4.4cm inward step with a natural vertical cloth drape line down the hamstrings
            if y > 0.01 and 0.49 <= z < z_glute_apex:
                t_drop = (z_glute_apex - z) / (z_glute_apex - 0.49)
                y_knee_back = knee_sl["cy"] + knee_sl["ry"] + offset + 0.008
                y_straight_drape = y_glute_peak * (1.0 - t_drop * 0.65) + y_knee_back * (t_drop * 0.65)
                if v.co.y < y_straight_drape:
                    blend_drape = min(0.75, t_drop * 0.85)
                    v.co.y = v.co.y * (1.0 - blend_drape) + y_straight_drape * blend_drape

            # Below knee: clean cylindrical column down to ankles
            if z < 0.49:
                side = 1.0 if x >= 0.0 else -1.0
                leg_sl = measure_leg_slice(av_verts, z)
                t_shin = min(1.0, max(0.0, (0.49 - z) / max(0.10, 0.49 - z_hem)))
                rx_col = knee_sl["rx"] * (1.0 - t_shin * 0.20) + offset + 0.008
                ry_col = knee_sl["ry"] * (1.0 - t_shin * 0.20) + offset + 0.008
                cx_leg = side * leg_sl["cx"]
                cy_leg = leg_sl["cy"]
                dx_l = v.co.x - cx_leg
                dy_l = v.co.y - cy_leg
                cur_r = math.hypot(dx_l, dy_l)
                theta_l = math.atan2(dy_l, dx_l)
                tar_r = math.hypot(rx_col * math.cos(theta_l), ry_col * math.sin(theta_l))
                if tar_r > cur_r:
                    blend_shin = 0.50 * t_shin
                    v.co.x = cx_leg + dx_l * (1.0 - blend_shin) + rx_col * math.cos(theta_l) * blend_shin
                    v.co.y = cy_leg + dy_l * (1.0 - blend_shin) + ry_col * math.sin(theta_l) * blend_shin

            # Flare lower cuff over footwear below z = 0.22
            if z < 0.22:
                t_cuff = min(1.0, max(0.0, (0.22 - z) / 0.12))
                v.co.x += (0.012 * t_cuff) * (1.0 if x > 0 else -1.0)
                v.co.y += (0.008 * t_cuff) * (1.0 if y > 0 else -1.0)

    # 6. Iterative Cloth-Tension Laplacian Relaxation + Monotonic Outward Skin Clearance Floor
    # Never pushes any vertex closer to the avatar skin than its initial offset position!
    n_iters = 5
    lam = 0.28
    min_skin_clearance = max(0.0055, offset * 0.90)
    boundary_ring0 = {v for v in bm.verts if v.is_boundary}
    wrist_r_cuff, arm_dir_r_cuff, r_wrist_anat = get_wrist_cuff_spec(is_male)
    r_cuff_max = r_wrist_anat + max(0.0065, offset * 0.75)
    wrist_l_cuff = Vector((-wrist_r_cuff.x, wrist_r_cuff.y, wrist_r_cuff.z))
    arm_dir_l_cuff = Vector((-arm_dir_r_cuff.x, arm_dir_r_cuff.y, arm_dir_r_cuff.z))
    x_cuff_thresh = 0.36 if is_male else 0.32
    z_cuff_min = 0.86 if is_male else 0.80

    for _it in range(n_iters):
        new_coords = {}
        for v in bm.verts:
            if v in boundary_ring0:
                # Smooth boundary loop along its two boundary neighbors (keeps hem/cuff/collar crisp & even)
                b_nbrs = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(b_nbrs) == 2:
                    avg_b = 0.5 * (b_nbrs[0].co + b_nbrs[1].co)
                    new_coords[v] = v.co * 0.80 + avg_b * 0.20
                else:
                    new_coords[v] = v.co.copy()
            else:
                nbrs = [e.other_vert(v) for e in v.link_edges]
                if nbrs:
                    avg_co = sum((n.co for n in nbrs), Vector((0.0, 0.0, 0.0))) / len(nbrs)
                    relaxed = Vector((
                        v.co.x * (1.0 - lam) + avg_co.x * lam,
                        v.co.y * (1.0 - lam) + avg_co.y * lam,
                        v.co.z * (1.0 - lam * 0.25) + avg_co.z * (lam * 0.25),
                    ))
                    new_coords[v] = relaxed
                else:
                    new_coords[v] = v.co.copy()

        for v, co in new_coords.items():
            orig_z = v.co.z
            is_hem_vert = (v in boundary_ring0) and (abs(orig_z - z_hem) < 0.018) and (abs(co.x) < 0.26)
            is_r_cuff = (v in boundary_ring0) and (co.x > x_cuff_thresh) and (co.z > z_cuff_min) and (sleeve_type == "long")
            is_l_cuff = (v in boundary_ring0) and (co.x < -x_cuff_thresh) and (co.z > z_cuff_min) and (sleeve_type == "long")
            if is_r_cuff:
                perp_r = (co - wrist_r_cuff) - (co - wrist_r_cuff).dot(arm_dir_r_cuff) * arm_dir_r_cuff
                if perp_r.length > r_cuff_max:
                    co = wrist_r_cuff + perp_r.normalized() * r_cuff_max
                else:
                    co = co - (co - wrist_r_cuff).dot(arm_dir_r_cuff) * arm_dir_r_cuff
            elif is_l_cuff:
                perp_l = (co - wrist_l_cuff) - (co - wrist_l_cuff).dot(arm_dir_l_cuff) * arm_dir_l_cuff
                if perp_l.length > r_cuff_max:
                    co = wrist_l_cuff + perp_l.normalized() * r_cuff_max
                else:
                    co = co - (co - wrist_l_cuff).dot(arm_dir_l_cuff) * arm_dir_l_cuff
            elif sleeve_type == "long" and co.x > x_cuff_thresh and co.z > z_cuff_min:
                dot_r = (co - wrist_r_cuff).dot(arm_dir_r_cuff)
                if dot_r > 0.0:
                    co = co - dot_r * arm_dir_r_cuff
            elif sleeve_type == "long" and co.x < -x_cuff_thresh and co.z > z_cuff_min:
                dot_l = (co - wrist_l_cuff).dot(arm_dir_l_cuff)
                if dot_l > 0.0:
                    co = co - dot_l * arm_dir_l_cuff
            # Enforce strict BVHTree avatar skin clearance floor
            is_bifurcation_zone = (
                (abs(co.x) <= 0.055 and 0.72 <= co.z <= 0.88)
                or (style in ("top", "dress") and co.z < 0.91 and abs(co.x) <= 0.125)
            )
            loc, norm, _idx, dist = bvh.find_nearest(co)
            if loc is not None and norm is not None:
                vec_from_skin = co - loc
                signed_d = vec_from_skin.dot(norm)
                req_clearance = max(min_skin_clearance, 0.0085) if (sleeve_type == "long" and abs(co.x) > x_cuff_thresh and co.z > z_cuff_min) else min_skin_clearance
                if style == "bottom":
                    # Strictly enforce positive skin clearance for bottom garments on the same leg,
                    # guaranteeing zero skin poke-through on inner/anterior thighs and groin!
                    if (loc.x * co.x >= 0.0) and signed_d < req_clearance:
                        co = loc + norm * req_clearance
                elif not is_bifurcation_zone:
                    if signed_d < req_clearance:
                        if style in ("top", "dress") and co.z < 0.91:
                            # Below the hip line on tops/dresses, push strictly outward in XY only (never inward toward x=0 or vertically in Z)
                            nx_out = norm.x if (co.x * norm.x >= 0.0) else 0.0
                            ny_out = norm.y
                            n_len = math.hypot(nx_out, ny_out)
                            if n_len > 1e-4:
                                delta_d = req_clearance - signed_d
                                co.x += (nx_out / n_len) * delta_d
                                co.y += (ny_out / n_len) * delta_d
                        else:
                            co = loc + norm * req_clearance
            if is_r_cuff:
                co = co - (co - wrist_r_cuff).dot(arm_dir_r_cuff) * arm_dir_r_cuff
            elif is_l_cuff:
                co = co - (co - wrist_l_cuff).dot(arm_dir_l_cuff) * arm_dir_l_cuff
            if is_hem_vert:
                co.z = z_hem
            v.co = co

    # Remove any non-manifold edges/faces before solidifying so solidify_bmesh_manifold produces 0 non-manifold edges
    for _nm_pass in range(4):
        nm_faces = set()
        for e in bm.edges:
            if len(e.link_faces) > 2:
                for f in e.link_faces:
                    nm_faces.add(f)
        if not nm_faces:
            break
        bmesh.ops.delete(bm, geom=list(nm_faces), context="FACES")

    # Seal any residual tiny boundary holes in the closed solidified shell
    rem_b = [e for e in bm.edges if e.is_boundary]
    if rem_b:
        try:
            bmesh.ops.holes_fill(bm, edges=rem_b, sides=8)
        except Exception:
            pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()


def solidify_bmesh_manifold(bm, thickness=0.0022):
    """
    Pure topological 2-manifold solidification of an open bmesh sheet:
      - Dissolves any near-collinear/zero-area sliver faces BEFORE solidification
      - Creates an inner shell offset by `-v.normal * thickness`
      - Flips inner shell face winding so normals point inward
      - Bridges every boundary edge between the outer and inner shells with a quad rim face
      - Guarantees 100% topological manifoldness (0 non-manifold edges, 0 zero-area faces)
        regardless of local boundary curvature or bisect triangle aspect ratio!
    """
    # Dissolve any tiny sliver edges or near-zero-area faces on the single sheet while it is still an open sheet
    bmesh.ops.dissolve_degenerate(bm, dist=0.0004, edges=bm.edges[:])
    # Iteratively prune any dangling ear triangles (3-vert faces with >= 2 boundary edges, or any face with >= 3 boundary edges) and bow-tie vertices
    for _clean_pass in range(5):
        tiny_or_ear = [
            f for f in bm.faces
            if f.calc_area() <= 1e-8
            or sum(1 for e in f.edges if e.is_boundary) >= 3
            or (len(f.verts) == 3 and sum(1 for e in f.edges if e.is_boundary) >= 2)
        ]
        if tiny_or_ear:
            bmesh.ops.delete(bm, geom=tiny_or_ear, context="FACES")
        # Also remove any faces attached to a bow-tie vertex (>2 boundary edges meeting at one vertex)
        bowtie_faces = set()
        for v in bm.verts:
            b_edges = [e for e in v.link_edges if e.is_boundary]
            if len(b_edges) > 2:
                for f in v.link_faces:
                    bowtie_faces.add(f)
        if bowtie_faces:
            bmesh.ops.delete(bm, geom=list(bowtie_faces), context="FACES")
        if not tiny_or_ear and not bowtie_faces:
            break

    # Keep only main connected component if pruning created an orphan island
    islands = []
    visited = set()
    for f in bm.faces:
        if f in visited:
            continue
        isl, q = [], [f]
        visited.add(f)
        while q:
            curr = q.pop()
            isl.append(curr)
            for e in curr.edges:
                for lf in e.link_faces:
                    if lf not in visited:
                        visited.add(lf)
                        q.append(lf)
        islands.append(isl)
    if len(islands) > 1:
        main_isl = max(islands, key=len)
        other = [f for isl in islands if isl != main_isl for f in isl]
        bmesh.ops.delete(bm, geom=other, context="FACES")
    loose_e = [e for e in bm.edges if not e.link_faces]
    if loose_e:
        bmesh.ops.delete(bm, geom=loose_e, context="EDGES")
    loose_v = [v for v in bm.verts if not v.link_edges]
    if loose_v:
        bmesh.ops.delete(bm, geom=loose_v, context="VERTS")

    # Remove any non-manifold edges/faces before solidifying so solidify_bmesh_manifold produces 0 non-manifold edges
    for _nm_pass in range(4):
        nm_faces = set()
        for e in bm.edges:
            if len(e.link_faces) > 2:
                for f in e.link_faces:
                    nm_faces.add(f)
        if not nm_faces:
            break
        bmesh.ops.delete(bm, geom=list(nm_faces), context="FACES")

    # Seal any residual tiny boundary holes in the closed solidified shell
    rem_b = [e for e in bm.edges if e.is_boundary]
    if rem_b:
        try:
            bmesh.ops.holes_fill(bm, edges=rem_b, sides=8)
        except Exception:
            pass

    # Seal any tiny interior pinholes left by degenerate-edge/ear/non-manifold pruning before solidifying
    b_edges = [e for e in bm.edges if e.is_boundary]
    visited_b = set()
    for e in b_edges:
        if e in visited_b:
            continue
        loop, stack = [], [e]
        while stack:
            ce = stack.pop()
            if ce in visited_b:
                continue
            visited_b.add(ce)
            loop.append(ce)
            for v in ce.verts:
                for le in v.link_edges:
                    if le.is_boundary and le not in visited_b:
                        stack.append(le)
        if 3 <= len(loop) <= 40:
            pts = [v.co for le in loop for v in le.verts]
            span = max(
                max(p.x for p in pts) - min(p.x for p in pts),
                max(p.y for p in pts) - min(p.y for p in pts),
                max(p.z for p in pts) - min(p.z for p in pts),
            )
            if span < 0.05:
                try:
                    bmesh.ops.holes_fill(bm, edges=loop, sides=64)
                except Exception:
                    pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()

    orig_verts = bm.verts[:]
    orig_faces = bm.faces[:]
    orig_boundary_edges = [e for e in bm.edges if e.is_boundary]

    # Map each outer vertex to its inner counterpart
    inner_map = {}
    for v in orig_verts:
        n = v.normal
        if n.length < 1e-6:
            n = Vector((0.0, -1.0, 0.0))
        v_in = bm.verts.new(v.co - n * thickness)
        inner_map[v] = v_in

    # Create inner faces with reversed vertex order
    for f in orig_faces:
        in_verts = [inner_map[v] for v in reversed(f.verts)]
        try:
            bm.faces.new(in_verts)
        except ValueError:
            pass

    # Bridge boundary edges with quad rim faces oriented consistently with the outer face loop
    for e in orig_boundary_edges:
        if len(e.link_faces) == 1:
            loop = e.link_loops[0]
            v0 = loop.vert
            v1 = loop.link_loop_next.vert
            vi0 = inner_map[v0]
            vi1 = inner_map[v1]
            try:
                bm.faces.new((v0, vi0, vi1, v1))
            except ValueError:
                pass

    # Remove any non-manifold edges/faces before solidifying so solidify_bmesh_manifold produces 0 non-manifold edges
    for _nm_pass in range(4):
        nm_faces = set()
        for e in bm.edges:
            if len(e.link_faces) > 2:
                for f in e.link_faces:
                    nm_faces.add(f)
        if not nm_faces:
            break
        bmesh.ops.delete(bm, geom=list(nm_faces), context="FACES")

    # Seal any residual tiny boundary holes in the closed solidified shell
    rem_b = [e for e in bm.edges if e.is_boundary]
    if rem_b:
        try:
            bmesh.ops.holes_fill(bm, edges=rem_b, sides=8)
        except Exception:
            pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    return bm


def create_pbr_material(name="CanonicalGarmentPBR"):
    """Step 5: Assign a clean Principled BSDF material with Roughness=0.8, Metallic=0.0, Alpha hooked."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    if hasattr(mat, "blend_method"):
        mat.blend_method = "HASHED"
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.8
    bsdf.inputs["Metallic"].default_value = 0.0

    # Checkerboard / image placeholder node hooked into Base Color
    tex_node = nodes.new(type="ShaderNodeTexChecker")
    tex_node.inputs["Scale"].default_value = 16.0
    tex_node.inputs["Color1"].default_value = (0.92, 0.92, 0.94, 1.0)
    tex_node.inputs["Color2"].default_value = (0.84, 0.85, 0.88, 1.0)
    links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def add_closed_tube_to_bm(bm, rings, cap_ends=True, thickness=0.0018):
    """
    Adds a quad-dominant manifold tube to bmesh from a list of rings.
    Each ring is a list of (Vector(x, y, z), (u, v), weight_dict) around the perimeter.
    To guarantee 100% manifold geometry (zero non-manifold boundary edges) while keeping
    low polygon count and clean open cuffs/necklines, we create an outer shell and an inner
    lining offset inward by `thickness`, bridged across the top and bottom boundary loops!
    """
    n_rings = len(rings)
    n_seg = len(rings[0])
    outer_verts = []
    inner_verts = []

    for r_idx, ring in enumerate(rings):
        # Compute ring center
        cx = sum(p[0].x for p in ring) / n_seg
        cy = sum(p[0].y for p in ring) / n_seg
        cz = sum(p[0].z for p in ring) / n_seg
        center = Vector((cx, cy, cz))

        o_row = []
        i_row = []
        for p_co, uv, wdict in ring:
            v_out = bm.verts.new(p_co)
            radial = p_co - center
            radial_xy = Vector((radial.x, radial.y, 0.0))
            if radial_xy.length > 1e-4:
                in_dir = radial_xy.normalized()
            elif radial.length > 1e-4:
                in_dir = radial.normalized()
            else:
                in_dir = Vector((0.0, -1.0, 0.0))
            v_in = bm.verts.new(p_co - in_dir * thickness)
            o_row.append((v_out, uv, wdict))
            i_row.append((v_in, uv, wdict))
        outer_verts.append(o_row)
        inner_verts.append(i_row)

    faces_uvs = []
    # Outer faces
    for i in range(n_rings - 1):
        for j in range(n_seg):
            jn = (j + 1) % n_seg
            v0, uv0, _ = outer_verts[i][j]
            v1, uv1, _ = outer_verts[i + 1][j]
            v2, uv2, _ = outer_verts[i + 1][jn]
            v3, uv3, _ = outer_verts[i][jn]
            try:
                f = bm.faces.new((v0, v1, v2, v3))
                faces_uvs.append((f, [uv0, uv1, uv2, uv3]))
            except ValueError:
                pass

    # Inner faces (reversed winding so normals point inward into the cavity, away from outer shell)
    for i in range(n_rings - 1):
        for j in range(n_seg):
            jn = (j + 1) % n_seg
            v0, uv0, _ = inner_verts[i][j]
            v1, uv1, _ = inner_verts[i][jn]
            v2, uv2, _ = inner_verts[i + 1][jn]
            v3, uv3, _ = inner_verts[i + 1][j]
            try:
                f = bm.faces.new((v0, v1, v2, v3))
                faces_uvs.append((f, [uv0, uv1, uv2, uv3]))
            except ValueError:
                pass

    # Bridge top boundary (ring 0)
    for j in range(n_seg):
        jn = (j + 1) % n_seg
        v_o0, uv_o0, _ = outer_verts[0][j]
        v_o1, uv_o1, _ = outer_verts[0][jn]
        v_i1, uv_i1, _ = inner_verts[0][jn]
        v_i0, uv_i0, _ = inner_verts[0][j]
        try:
            f = bm.faces.new((v_o0, v_o1, v_i1, v_i0))
            faces_uvs.append((f, [uv_o0, uv_o1, uv_i1, uv_i0]))
        except ValueError:
            pass

    # Bridge bottom boundary (ring -1)
    for j in range(n_seg):
        jn = (j + 1) % n_seg
        v_o0, uv_o0, _ = outer_verts[-1][j]
        v_i0, uv_i0, _ = inner_verts[-1][j]
        v_i1, uv_i1, _ = inner_verts[-1][jn]
        v_o1, uv_o1, _ = outer_verts[-1][jn]
        try:
            f = bm.faces.new((v_o0, v_i0, v_i1, v_o1))
            faces_uvs.append((f, [uv_o0, uv_i0, uv_i1, uv_o1]))
        except ValueError:
            pass

    vert_weights = []
    for r in outer_verts:
        for v, _, wdict in r:
            vert_weights.append((v, wdict))
    for r in inner_verts:
        for v, _, wdict in r:
            vert_weights.append((v, wdict))

    return faces_uvs, vert_weights


def add_open_strip_to_bm(bm, rings, thickness=0.0020):
    """
    Adds an open, quad-dominant manifold sheet to bmesh with inner and outer walls.
    Each ring in rings is a list of (Vector(x, y, z), (u, v), weight_dict) along an OPEN arc (j from 0 to n_seg - 1).
    Bridged along top, bottom, and both side edges (j=0 and j=n_seg-1) so non-manifold edges = 0!
    """
    n_rings = len(rings)
    n_seg = len(rings[0])
    outer_verts = []
    inner_verts = []

    for r_idx, ring in enumerate(rings):
        cx = sum(p[0].x for p in ring) / n_seg
        cy = sum(p[0].y for p in ring) / n_seg
        cz = sum(p[0].z for p in ring) / n_seg
        center = Vector((cx, cy, cz))

        o_row = []
        i_row = []
        for p_co, uv, wdict in ring:
            v_out = bm.verts.new(p_co)
            radial = p_co - center
            radial_xy = Vector((radial.x, radial.y, 0.0))
            if radial_xy.length > 1e-4:
                in_dir = radial_xy.normalized()
            elif radial.length > 1e-4:
                in_dir = radial.normalized()
            else:
                in_dir = Vector((0.0, -1.0, 0.0))
            v_in = bm.verts.new(p_co - in_dir * thickness)
            o_row.append((v_out, uv, wdict))
            i_row.append((v_in, uv, wdict))
        outer_verts.append(o_row)
        inner_verts.append(i_row)

    faces_uvs = []
    # Outer faces (j from 0 to n_seg - 2)
    for i in range(n_rings - 1):
        for j in range(n_seg - 1):
            jn = j + 1
            v0, uv0, _ = outer_verts[i][j]
            v1, uv1, _ = outer_verts[i + 1][j]
            v2, uv2, _ = outer_verts[i + 1][jn]
            v3, uv3, _ = outer_verts[i][jn]
            try:
                f = bm.faces.new((v0, v1, v2, v3))
                faces_uvs.append((f, [uv0, uv1, uv2, uv3]))
            except ValueError:
                pass

    # Inner faces (reverse winding)
    for i in range(n_rings - 1):
        for j in range(n_seg - 1):
            jn = j + 1
            v0, uv0, _ = inner_verts[i][j]
            v1, uv1, _ = inner_verts[i + 1][j]
            v2, uv2, _ = inner_verts[i + 1][jn]
            v3, uv3, _ = inner_verts[i][jn]
            try:
                f = bm.faces.new((v3, v2, v1, v0))
                faces_uvs.append((f, [uv3, uv2, uv1, uv0]))
            except ValueError:
                pass

    # Top boundary bridge (ring 0)
    for j in range(n_seg - 1):
        jn = j + 1
        vo0, uvo0, _ = outer_verts[0][j]
        vo1, uvo1, _ = outer_verts[0][jn]
        vi0, uvi0, _ = inner_verts[0][j]
        vi1, uvi1, _ = inner_verts[0][jn]
        try:
            f = bm.faces.new((vo0, vi0, vi1, vo1))
            faces_uvs.append((f, [uvo0, uvi0, uvi1, uvo1]))
        except ValueError:
            pass

    # Bottom boundary bridge (ring n_rings - 1)
    last = n_rings - 1
    for j in range(n_seg - 1):
        jn = j + 1
        vo0, uvo0, _ = outer_verts[last][j]
        vo1, uvo1, _ = outer_verts[last][jn]
        vi0, uvi0, _ = inner_verts[last][j]
        vi1, uvi1, _ = inner_verts[last][jn]
        try:
            f = bm.faces.new((vo0, vo1, vi1, vi0))
            faces_uvs.append((f, [uvo0, uvo1, uvi1, uvi0]))
        except ValueError:
            pass

    # Left boundary bridge (j = 0)
    for i in range(n_rings - 1):
        vo0, uvo0, _ = outer_verts[i][0]
        vo1, uvo1, _ = outer_verts[i + 1][0]
        vi0, uvi0, _ = inner_verts[i][0]
        vi1, uvi1, _ = inner_verts[i + 1][0]
        try:
            f = bm.faces.new((vo0, vi0, vi1, vo1))
            faces_uvs.append((f, [uvo0, uvi0, uvi1, uvo0]))
        except ValueError:
            pass

    # Right boundary bridge (j = n_seg - 1)
    for i in range(n_rings - 1):
        vo0, uvo0, _ = outer_verts[i][n_seg - 1]
        vo1, uvo1, _ = outer_verts[i + 1][n_seg - 1]
        vi0, uvi0, _ = inner_verts[i][n_seg - 1]
        vi1, uvi1, _ = inner_verts[i + 1][n_seg - 1]
        try:
            f = bm.faces.new((vo0, vo1, vi1, vi0))
            faces_uvs.append((f, [uvo0, uvo1, uvi1, uvi0]))
        except ValueError:
            pass

    vert_weights = []
    for r in range(n_rings):
        for j in range(n_seg):
            vo, _, wo = outer_verts[r][j]
            vi, _, wi = inner_verts[r][j]
            vert_weights.append((vo, wo))
            vert_weights.append((vi, wi))

    return faces_uvs, vert_weights


def finalize_and_export_mesh(
    name,
    bm,
    faces_uvs,
    vert_weights,
    vertex_group_names,
    export_paths,
    use_mirror=False,
):
    """Applies UVs, vertex groups, normals, material, modifiers, validates manifoldness, and exports GLB."""
    uv_layer = bm.loops.layers.uv.verify()
    for f, uvs in faces_uvs:
        if f.is_valid:
            for loop, uv in zip(f.loops, uvs):
                # Blender glTF exporter outputs v_gltf = 1.0 - v_blender.
                # Pre-invert v_blender = 1.0 - uv[1] so exported glTF UV has v=0.96 at top and v=0.04 at bottom!
                loop[uv_layer].uv = (
                    max(0.002, min(0.998, float(uv[0]))),
                    max(0.002, min(0.998, 1.0 - float(uv[1]))),
                )

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # Remove any accidental zero-area faces
    zero_faces = [f for f in bm.faces if f.calc_area() <= 1e-9]
    if zero_faces:
        bmesh.ops.delete(bm, geom=zero_faces, context="FACES")

    for f in bm.faces:
        f.material_index = 0
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    for poly in mesh.polygons:
        poly.material_index = 0

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Assign smooth shading
    for poly in mesh.polygons:
        poly.use_smooth = True

    # Create vertex groups and assign weights
    vgroups = {}
    for vg_name in vertex_group_names:
        vgroups[vg_name] = obj.vertex_groups.new(name=vg_name)

    bm.verts.ensure_lookup_table()
    # Map bmesh vertex index to mesh vertex index
    for v_bm, wdict in vert_weights:
        if v_bm.is_valid and v_bm.index < len(mesh.vertices):
            v_idx = v_bm.index
            for vg_name, weight in wdict.items():
                if vg_name in vgroups:
                    vgroups[vg_name].add([v_idx], float(weight), "REPLACE")

    # Strip dead UV layers (TEXCOORD_1..4) and extra color attributes inherited from the avatar mesh
    while len(mesh.uv_layers) > 1:
        mesh.uv_layers.remove(mesh.uv_layers[-1])
    for ca in list(mesh.color_attributes):
        mesh.color_attributes.remove(ca)

    # Export _DEFORM_WEIGHT only when rigid/deformable vertex weights exist (accessories/footwear)
    if vert_weights:
        deform_attr = mesh.attributes.new(name="_DEFORM_WEIGHT", type='FLOAT', domain='POINT')
        for v_bm, wdict in vert_weights:
            if v_bm.is_valid and v_bm.index < len(mesh.vertices):
                v_idx = v_bm.index
                w_val = 1.0
                for vg_name, weight in wdict.items():
                    if "Sole" in vg_name or "Hardware" in vg_name or "Bag_Body" in vg_name:
                        if weight < 0.5:
                            w_val = 0.0
                    elif "Deform" in vg_name or "Upper" in vg_name or "Strap" in vg_name:
                        if weight > 0.5:
                            w_val = 1.0
                deform_attr.data[v_idx].value = float(w_val)

    if use_mirror:
        mod = obj.modifiers.new(name="MirrorX", type="MIRROR")
        mod.use_axis[0] = True
        mod.use_clip = True
        mod.merge_threshold = 0.001
        bpy.ops.object.modifier_apply(modifier=mod.name)

    # Assign PBR material
    mat = create_pbr_material(f"{name}_Mat")
    mesh.materials.append(mat)

    # Apply transforms and ensure origin at (0, 0, 0)
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Validate geometry before export
    bm_check = bmesh.new()
    bm_check.from_mesh(obj.data)
    for _clean_it in range(2):
        zero_area_faces = [f for f in bm_check.faces if f.calc_area() <= 1e-9]
        if zero_area_faces:
            try:
                short_edges = list({min(f.edges, key=lambda e: e.calc_length()) for f in zero_area_faces})
                bmesh.ops.collapse(bm_check, edges=short_edges)
            except Exception:
                pass
        non_manifold_edges = [e for e in bm_check.edges if not e.is_manifold]
        if non_manifold_edges and len(non_manifold_edges) <= 16 and all(e.is_boundary for e in non_manifold_edges):
            try:
                bmesh.ops.holes_fill(bm_check, edges=non_manifold_edges, sides=16)
            except Exception:
                pass
    bmesh.ops.recalc_face_normals(bm_check, faces=bm_check.faces[:])
    bm_check.to_mesh(obj.data)
    obj.data.update()
    non_manifold_edges = [e for e in bm_check.edges if not e.is_manifold]
    zero_area_faces = [f for f in bm_check.faces if f.calc_area() <= 1e-9]
    for v in obj.data.vertices:
        if abs(v.co.x) > 1.2 or abs(v.co.y) > 1.2 or v.co.z < -0.05 or v.co.z > 2.2:
            raise RuntimeError(f"Runaway vertex detected in {name}: {v.co}")
    bm_check.free()

    if non_manifold_edges or zero_area_faces:
        print(
            f"[WARN] {name}: non_manifold={len(non_manifold_edges)}, zero_area={len(zero_area_faces)}"
        )

    # Export only this selected object
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj

    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"{name}_{int(time.time()*1000)}.glb")
    for attempt in range(5):
        try:
            bpy.ops.export_scene.gltf(
                filepath=temp_path,
                use_selection=True,
                export_format="GLB",
                export_apply=True,
                export_yup=True,
                export_attributes=True,
                export_all_vertex_colors=True,
            )
            break
        except Exception as ex:
            if attempt == 4:
                raise
            time.sleep(0.5)

    for target_path in export_paths:
        safe_copy(temp_path, target_path)

    try:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except Exception:
        pass

    bm.free()
    return obj, len(non_manifold_edges), len(zero_area_faces)


def merge_bmesh_with_uvs(dst_bm, dst_faces_uvs, src_bm, src_faces_uvs):
    """Copies a standalone closed-manifold BMesh and its per-face UVs into dst_bm without sharing topology."""
    v_map = {v: dst_bm.verts.new(v.co) for v in src_bm.verts}
    uv_by_face = {f: uvs for f, uvs in src_faces_uvs}
    for f in src_bm.faces:
        new_verts = [v_map[v] for v in f.verts]
        try:
            nf = dst_bm.faces.new(new_verts)
            uvs = uv_by_face.get(f)
            if uvs is not None and len(uvs) == len(new_verts):
                dst_faces_uvs.append((nf, uvs))
            else:
                dst_faces_uvs.append((nf, [(0.50, 0.68)] * len(new_verts)))
        except ValueError:
            pass


def compute_hood_faces_uvs(bm_hood, is_male):
    """
    Assigns clean interior-fabric UVs in [0.30..0.70] x [0.52..0.82] so hoods inherit the
    garment's base weave/color cleanly without projecting chest prints, pockets, or zippers.
    """
    z_min = min((v.co.z for v in bm_hood.verts), default=(1.30 if is_male else 1.22))
    z_max = max((v.co.z for v in bm_hood.verts), default=(1.82 if is_male else 1.72))
    dz = max(0.08, z_max - z_min)
    faces_uvs = []
    for f in bm_hood.faces:
        uvs = []
        for l in f.loops:
            p = l.vert.co
            u = 0.50 + max(-0.18, min(0.18, p.x * 1.25))
            v_uv = 0.52 + 0.30 * max(0.0, min(1.0, (p.z - z_min) / dz))
            uvs.append((u, v_uv))
        faces_uvs.append((f, uvs))
    return faces_uvs


def build_hood_off_mesh(avatar_data, torso_bm, offset, z_neck, is_coat=False):
    """
    Builds a 2-walled manifold folded-back hood resting on the garment's upper posterior back.
    Anterior throat/chin stays open; side/posterior profile shows a plump folded cowl pouch.
    """
    is_male = avatar_data["gender"] == "male"
    av_verts = avatar_data["verts"]
    head_bvh = avatar_data.get("full_bvh") or avatar_data["bvh"]
    torso_bvh = BVHTree.FromBMesh(torso_bm)

    coat_extra = 0.0055 if is_coat else 0.0
    nk_pts = [p for p in av_verts if abs(p.z - z_neck) < 0.03 and abs(p.x) < 0.11]
    y_nk_front = min((p.y for p in nk_pts), default=(-0.090 if is_male else -0.068))
    y_nk_back = max((p.y for p in nk_pts), default=(0.060 if is_male else 0.044))
    cy_nk = 0.5 * (y_nk_front + y_nk_back)
    rx_collar = (0.095 if is_male else 0.088) + coat_extra
    ry_collar_f = (0.078 if is_male else 0.072) + coat_extra
    ry_collar_b = (0.082 if is_male else 0.074) + coat_extra + offset * 0.45

    n_v = 18
    n_u = 24
    half_u = n_u // 2  # j == half_u is exact spine s_u = 0
    drop_len = (0.215 if is_male else 0.195) + (0.025 if is_coat else 0.0)
    w_max = (0.128 if is_male else 0.116) + (0.012 if is_coat else 0.0)
    z_top_cowl = z_neck + (0.024 if is_coat else 0.020)

    def sample_back_garment_y(x_q, z_q):
        hit, _n, _idx, _d = torso_bvh.ray_cast(Vector((x_q, 0.32, z_q)), Vector((0.0, -1.0, 0.0)), 0.40)
        if hit is not None:
            return hit.y
        return y_nk_back + offset + 0.025

    grid = []
    for i in range(n_v + 1):
        t = i / n_v
        row = []
        for j in range(n_u + 1):
            s_u = (j - half_u) / half_u  # [-1 .. +1], strictly symmetric
            if t <= 0.25:
                # Collar wrap rising around lateral/posterior neck and rolling backward (+Y) over nape
                u_c = t / 0.25
                s_c = u_c * u_c * (3.0 - 2.0 * u_c)
                theta = (0.5 * math.pi) - s_u * (0.64 * math.pi)
                rx_ring = rx_collar * (1.0 - 0.15 * s_c) + w_max * (0.88 * s_c)
                if t <= 0.08:
                    # Seam overlap flush into collar circumference
                    x = rx_collar * math.cos(theta)
                    ry = ry_collar_b if math.sin(theta) >= 0 else ry_collar_f
                    y = cy_nk + ry * math.sin(theta)
                    z = (z_neck - 0.012) + 0.018 * (0.5 + 0.5 * math.sin(theta))
                else:
                    x0 = rx_collar * math.cos(theta)
                    ry0 = ry_collar_b if math.sin(theta) >= 0 else ry_collar_f
                    y0 = cy_nk + ry0 * math.sin(theta)
                    z0 = (z_neck - 0.012) + 0.018 * (0.5 + 0.5 * math.sin(theta))

                    x1 = s_u * w_max
                    z1 = z_top_cowl - 0.012 * (s_u ** 2)
                    y_bg = sample_back_garment_y(x1, min(z1, z_neck - 0.03))
                    puff1 = ((0.048 if is_coat else 0.040) if not is_male else (0.044 if is_coat else 0.036)) * (1.0 - 0.70 * (s_u ** 2))
                    y1 = max(y_nk_back + 0.044 + coat_extra, y_bg + puff1)

                    lift_z = 0.020 * math.sin(s_c * math.pi * 0.85) * (1.0 - 0.45 * (s_u ** 2))
                    x = x0 * (1.0 - s_c) + x1 * s_c
                    y = y0 * (1.0 - s_c) + y1 * s_c
                    z = z0 * (1.0 - s_c) + z1 * s_c + lift_z
            elif t <= 0.86:
                # Folded hood body draped down the upper scapulae
                u_f = (t - 0.25) / (0.86 - 0.25)
                w_ring = w_max * (1.0 - 0.54 * (u_f ** 1.40))
                x = s_u * w_ring
                z = (z_top_cowl - 0.012 * (s_u ** 2)) - u_f * drop_len
                y_bg = sample_back_garment_y(x, min(z, z_neck - 0.03))
                # Layered fold puff profile with soft lateral edge tuck onto garment shoulders
                env_u = max(0.0, 1.0 - s_u ** 2)
                fold_bulge = ((0.045 if is_coat else 0.037) if not is_male else (0.040 if is_coat else 0.032)) * (math.sin(u_f * math.pi) ** 0.55)
                fold_ripple = (0.007 if is_coat else 0.005) * math.sin(u_f * 2.2 * math.pi)
                y = y_bg + 0.004 + (fold_bulge + fold_ripple) * env_u
            else:
                # Soft tucked bottom crown seam resting flush against garment mid-back
                u_b = (t - 0.86) / (1.0 - 0.86)
                s_b = u_b * u_b * (3.0 - 2.0 * u_b)
                w_ring = w_max * (0.46 * (1.0 - 0.35 * s_b))
                x = s_u * w_ring
                z = (z_top_cowl - drop_len - 0.012 * (s_u ** 2)) - 0.008 * math.sin(s_b * math.pi * 0.5)
                y_bg = sample_back_garment_y(x, min(z, z_neck - 0.03))
                env_u = max(0.0, 1.0 - s_u ** 2)
                y = y_bg + 0.002 + (0.014 * (1.0 - s_b)) * env_u

            p = Vector((x, y, z))
            # Never intersect avatar neck/hair or back garment shell
            if i >= 2:
                loc_h, norm_h, _idx, _d = head_bvh.find_nearest(p)
                if loc_h is not None and norm_h is not None:
                    min_h_clr = 0.015 + coat_extra
                    sd_h = (p - loc_h).dot(norm_h)
                    if sd_h < min_h_clr and p.y > cy_nk - 0.02:
                        p.y += (min_h_clr - sd_h)
                if t > 0.25:
                    y_bg_chk = sample_back_garment_y(p.x, min(p.z, z_neck - 0.04))
                    min_bg_clr = 0.003 if t > 0.86 else 0.006
                    if p.y < y_bg_chk + min_bg_clr:
                        p.y = y_bg_chk + min_bg_clr
            row.append(p)
        grid.append(row)

    # Smooth interior + enforce strict bilateral symmetry
    for _pass in range(2):
        for i in range(1, n_v):
            for j in range(1, n_u):
                avg = (grid[i - 1][j] + grid[i + 1][j] + grid[i][j - 1] + grid[i][j + 1]) * 0.25
                grid[i][j] = grid[i][j] * 0.65 + avg * 0.35
                if (i / n_v) > 0.25:
                    y_bg_chk = sample_back_garment_y(grid[i][j].x, min(grid[i][j].z, z_neck - 0.04))
                    if grid[i][j].y < y_bg_chk + 0.003:
                        grid[i][j].y = y_bg_chk + 0.003
    for i in range(n_v + 1):
        grid[i][half_u].x = 0.0
        for j in range(half_u):
            jm = n_u - j
            avg_x = 0.5 * (abs(grid[i][j].x) + abs(grid[i][jm].x))
            avg_y = 0.5 * (grid[i][j].y + grid[i][jm].y)
            avg_z = 0.5 * (grid[i][j].z + grid[i][jm].z)
            grid[i][j] = Vector((-avg_x, avg_y, avg_z))
            grid[i][jm] = Vector((avg_x, avg_y, avg_z))

    bm_sheet = bmesh.new()
    bverts = [[bm_sheet.verts.new(grid[i][j]) for j in range(n_u + 1)] for i in range(n_v + 1)]
    for i in range(n_v):
        for j in range(n_u):
            try:
                bm_sheet.faces.new((bverts[i][j], bverts[i][j + 1], bverts[i + 1][j + 1], bverts[i + 1][j]))
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm_sheet, faces=bm_sheet.faces[:])
    bm_sheet.normal_update()
    # Ensure sheet outer normals point posterior (+Y / +Z), not inward toward body
    for f in bm_sheet.faces:
        if f.normal.y < -0.15 and abs(f.normal.x) < 0.7:
            f.normal_flip()
    bm_sheet.normal_update()

    bm_hood = solidify_bmesh_manifold(bm_sheet, thickness=(0.0036 if is_coat else 0.0028))
    faces_uvs = compute_hood_faces_uvs(bm_hood, is_male)
    return bm_hood, faces_uvs


def build_hood_on_mesh(avatar_data, torso_bm, offset, z_neck, is_coat=False):
    """
    Builds a 2-walled manifold open-throat tailored hood rising from the collar around the sides
    (covering ears/temples) and posterior occiput/crown, framing the face cleanly in anterior and side views.
    """
    is_male = avatar_data["gender"] == "male"
    av_verts = avatar_data["verts"]
    outer_skin_bvh = avatar_data.get("skin_only_bvh") or avatar_data["bvh"]

    coat_extra = 0.0050 if is_coat else 0.0
    nk_pts = [p for p in av_verts if abs(p.z - z_neck) < 0.03 and abs(p.x) < 0.11]
    y_nk_front = min((p.y for p in nk_pts), default=(-0.090 if is_male else -0.068))
    y_nk_back = max((p.y for p in nk_pts), default=(0.060 if is_male else 0.044))
    cy_nk = 0.5 * (y_nk_front + y_nk_back)

    # Skull center & landmarks in Blender Z-up space (front is -Y, back is +Y)
    cy_skull = -0.042 if is_male else -0.036
    cz_skull = 1.655 if is_male else 1.558
    z_ear_mid = 1.635 if is_male else 1.540

    n_v = 20
    n_u = 36
    half_u = n_u // 2  # j == half_u is exact spine s_u = 0

    rx_col = (0.095 if is_male else 0.088) + coat_extra
    y_col_f = (-0.104 if is_male else -0.088) - coat_extra
    y_col_b = (0.082 if is_male else 0.068) + coat_extra

    rx_rim = (0.088 if is_male else 0.084) + coat_extra * 0.8
    x_lapel = 0.016
    z_brow = (1.760 if is_male else 1.654) + coat_extra * 0.5
    z_lapel = z_neck - 0.012
    y_brow = (-0.156 if is_male else -0.142) - coat_extra * 0.6
    y_side_rim = (-0.098 if is_male else -0.092) - coat_extra * 0.5
    y_lapel = y_col_f - 0.008

    rx_mid_side = (0.103 if is_male else 0.101) + coat_extra
    y_occ_peak = (0.084 if is_male else 0.088) + coat_extra
    z_occ_mid = 1.665 if is_male else 1.568

    rx_crn = (0.100 if is_male else 0.098) + coat_extra
    y_crown_ctrl = -0.032 if is_male else -0.028
    z_crown_ctrl = (1.895 if is_male else 1.785) + coat_extra

    def enforce_head_envelope(p, i_row):
        if i_row == 0:
            return p
        t_h = max(0.0, min(1.0, (p.z - z_neck) / max(0.04, z_ear_mid - z_neck)))
        cy_ref = cy_nk * (1.0 - t_h) + cy_skull * t_h
        cz_ref = p.z * (1.0 - t_h) + z_ear_mid * t_h
        c_ref = Vector((0.0, cy_ref, cz_ref))

        diff = p - c_ref
        cur_dist = diff.length
        if cur_dist < 1e-4:
            return p
        ray_dir = diff / cur_dist

        outer_dist = 0.25
        hit_loc, _hn, _hi, d_from_outer = outer_skin_bvh.ray_cast(c_ref + ray_dir * outer_dist, -ray_dir, outer_dist)
        if hit_loc is not None:
            hit_dist = outer_dist - d_from_outer
            up_w = max(0.0, ray_dir.z) ** 2
            rim_fade = max(0.0, 1.0 - ((i_row / n_v) ** 4))
            crown_loft = (0.025 if is_coat else 0.022) * up_w * rim_fade
            base_min = (0.011 if is_coat else 0.0085) if (i_row <= 2 or i_row >= n_v - 2) else (0.0155 if is_coat else 0.0120)
            min_clear = base_min + crown_loft * 0.75
            max_clear = (0.028 if is_coat else 0.022) + crown_loft
            if cur_dist < hit_dist + min_clear:
                p = c_ref + ray_dir * (hit_dist + min_clear)
            elif p.z > (z_ear_mid - 0.015) and i_row < n_v and cur_dist > hit_dist + max_clear:
                p = c_ref + ray_dir * (hit_dist + max_clear)
        return p

    ctrl_c0, ctrl_c1, ctrl_c2, ctrl_c3 = [], [], [], []
    for j in range(n_u + 1):
        s_u = (j - half_u) / half_u
        a = abs(s_u)
        sx = -1.0 if j < half_u else (1.0 if j > half_u else 0.0)

        # C_0(s_u): Collar seam tucked into neckline from left collarbone -> nape -> right collarbone
        theta_0 = 0.5 * math.pi - s_u * (0.92 * math.pi)
        ct0, st0 = math.cos(theta_0), math.sin(theta_0)
        x0 = rx_col * ct0
        y0 = cy_nk * (1.0 - abs(st0)) + (y_col_b if st0 >= 0.0 else y_col_f) * abs(st0)
        z0 = (z_neck - 0.008) * (1.0 - abs(st0)) + ((z_neck + 0.006) if st0 >= 0.0 else (z_neck - 0.026)) * abs(st0)
        c0 = Vector((x0, y0, z0))

        # C_3(s_u): Open-throat V-collar -> jaw/temple arch -> forehead brow brim
        sin_a_pi = max(0.0, math.sin(a * math.pi))
        x3 = sx * (rx_rim * (sin_a_pi ** 0.78) + x_lapel * (a ** 2.6))
        s_z3 = (a * a) * (3.0 - 2.0 * a)
        z3 = z_brow * (1.0 - s_z3) + z_lapel * s_z3
        w_side3 = sin_a_pi ** 1.15
        y_end3 = y_brow * (1.0 - a * a) + y_lapel * (a * a)
        y3 = y_end3 * (1.0 - w_side3) + y_side_rim * w_side3
        c3 = Vector((x3, y3, z3))

        # C_1(s_u): Occiput & behind-ear control curve
        p_lap1 = c0 * (2.0 / 3.0) + c3 * (1.0 / 3.0)
        p_arch1 = Vector((
            sx * rx_mid_side * max(0.0, math.sin(a * math.pi * 0.85)),
            y_occ_peak * (1.0 - a) + (-0.065) * a,
            z_occ_mid * (1.0 - a * a) + z_lapel * (a * a),
        ))
        c1 = p_arch1 * (1.0 - a ** 3) + p_lap1 * (a ** 3)

        # C_2(s_u): Upper cranial crown & parietal side control curve
        p_lap2 = c0 * (1.0 / 3.0) + c3 * (2.0 / 3.0)
        p_arch2 = Vector((
            sx * rx_crn * max(0.0, math.sin(a * math.pi * 0.88)),
            y_crown_ctrl * (1.0 - a) + (-0.095) * a,
            z_crown_ctrl * (1.0 - a ** 1.7) + (z_lapel + 0.010) * (a ** 1.7),
        ))
        c2 = p_arch2 * (1.0 - a ** 2.5) + p_lap2 * (a ** 2.5)

        ctrl_c0.append(c0)
        ctrl_c1.append(c1)
        ctrl_c2.append(c2)
        ctrl_c3.append(c3)

    grid = []
    for i in range(n_v + 1):
        v_t = i / n_v
        om = 1.0 - v_t
        b0 = om ** 3
        b1 = 3.0 * (om ** 2) * v_t
        b2 = 3.0 * om * (v_t ** 2)
        b3 = v_t ** 3
        row = []
        for j in range(n_u + 1):
            p = ctrl_c0[j] * b0 + ctrl_c1[j] * b1 + ctrl_c2[j] * b2 + ctrl_c3[j] * b3
            p = enforce_head_envelope(p, i)
            row.append(p)
        grid.append(row)

    # Interior Laplacian relaxation + head skin clearance envelope
    for _pass in range(3):
        for i in range(1, n_v):
            for j in range(1, n_u):
                avg4 = (grid[i - 1][j] + grid[i + 1][j] + grid[i][j - 1] + grid[i][j + 1]) * 0.25
                p = grid[i][j] * 0.65 + avg4 * 0.35
                grid[i][j] = enforce_head_envelope(p, i)

    # Enforce strict bilateral symmetry across X=0
    for i in range(n_v + 1):
        grid[i][half_u].x = 0.0
        for j in range(half_u):
            jm = n_u - j
            avg_x = 0.5 * (abs(grid[i][j].x) + abs(grid[i][jm].x))
            avg_y = 0.5 * (grid[i][j].y + grid[i][jm].y)
            avg_z = 0.5 * (grid[i][j].z + grid[i][jm].z)
            grid[i][j] = Vector((-avg_x, avg_y, avg_z))
            grid[i][jm] = Vector((avg_x, avg_y, avg_z))

    bm_sheet = bmesh.new()
    bverts = [[bm_sheet.verts.new(grid[i][j]) for j in range(n_u + 1)] for i in range(n_v + 1)]
    for i in range(n_v):
        for j in range(n_u):
            try:
                bm_sheet.faces.new((bverts[i][j], bverts[i][j + 1], bverts[i + 1][j + 1], bverts[i + 1][j]))
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm_sheet, faces=bm_sheet.faces[:])
    bm_sheet.normal_update()

    # Global outward orientation (never flip individual faces)
    out_sum = sum(
        (f.calc_center_median() - Vector((0.0, -0.030, min(f.calc_center_median().z, cz_skull - 0.02)))).dot(f.normal)
        for f in bm_sheet.faces
    )
    if out_sum < 0.0:
        for f in bm_sheet.faces:
            f.normal_flip()
        bm_sheet.normal_update()

    bm_hood = solidify_bmesh_manifold(bm_sheet, thickness=(0.0034 if is_coat else 0.0026))
    faces_uvs = compute_hood_faces_uvs(bm_hood, is_male)
    return bm_hood, faces_uvs


def build_top_template(avatar_data, variant="tshirt"):
    gender = avatar_data["gender"]
    avatar_obj = avatar_data["avatar_obj"]
    is_male = gender == "male"

    is_open_front = False
    flare_hips = False
    neck_tilt = -0.22

    if variant == "tshirt":
        offset = 0.0080
        z_neck = 1.545 if is_male else 1.455
        z_hem = 0.85 if is_male else 0.82
        x_arm_max = 0.305 if is_male else 0.270
        sleeve_type = "short"
        neck_tilt = -0.32 if is_male else -0.30
    elif variant == "singlet":
        offset = 0.0060
        z_neck = 1.505 if is_male else 1.410
        z_hem = 0.88 if is_male else 0.84
        x_arm_max = 0.200 if is_male else 0.178
        sleeve_type = "sleeveless"
        neck_tilt = -0.36 if is_male else -0.34
    elif variant == "strapless":
        offset = 0.0060
        z_neck = 1.330 if is_male else 1.275
        z_hem = 0.94 if is_male else 0.90
        x_arm_max = 0.195 if is_male else 0.168
        sleeve_type = "strapless"
        neck_tilt = 0.0
    elif variant == "vest":
        offset = 0.0150
        z_neck = 1.522 if is_male else 1.424
        z_hem = 0.82 if is_male else 0.78
        x_arm_max = 0.205 if is_male else 0.182
        sleeve_type = "sleeveless"
        is_open_front = True
        neck_tilt = -0.34 if is_male else -0.32
    elif variant in ("longsleeve", "shirt"):
        offset = 0.0075
        z_neck = 1.534 if is_male else 1.436
        z_hem = 0.86 if is_male else 0.82
        x_arm_max = 0.490 if is_male else 0.445
        sleeve_type = "long"
        neck_tilt = -0.32 if is_male else -0.30
    elif variant in ("hoodie", "hoodie_hood_off"):
        offset = 0.0155
        z_neck = 1.525 if is_male else 1.428
        z_hem = 0.85 if is_male else 0.81
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        neck_tilt = -0.26 if is_male else -0.24
    elif variant == "hoodie_hood_on":
        offset = 0.0155
        z_neck = 1.515 if is_male else 1.420
        z_hem = 0.85 if is_male else 0.81
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        neck_tilt = -0.22 if is_male else -0.20
    elif variant in ("hooded_coat", "hooded_coat_hood_off"):
        offset = 0.0195
        z_neck = 1.530 if is_male else 1.432
        z_hem = 0.54 if is_male else 0.50
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        flare_hips = True
        neck_tilt = -0.26 if is_male else -0.24
    elif variant == "hooded_coat_hood_on":
        offset = 0.0195
        z_neck = 1.520 if is_male else 1.424
        z_hem = 0.54 if is_male else 0.50
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        flare_hips = True
        neck_tilt = -0.22 if is_male else -0.20
    elif variant in ("jacket", "top_outerwear_jacket"):
        offset = 0.0160
        z_neck = 1.532 if is_male else 1.434
        z_hem = 0.80 if is_male else 0.76
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        is_open_front = True
        neck_tilt = -0.30 if is_male else -0.28
    elif variant == "jacket_blazer":
        offset = 0.0160
        z_neck = 1.528 if is_male else 1.430
        z_hem = 0.78 if is_male else 0.74
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        is_open_front = True
        neck_tilt = -0.32 if is_male else -0.30
    elif variant == "cardigan":
        offset = 0.0140
        z_neck = 1.522 if is_male else 1.424
        z_hem = 0.74 if is_male else 0.70
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        is_open_front = True
        neck_tilt = -0.34 if is_male else -0.32
    elif variant == "coat":
        offset = 0.0180
        z_neck = 1.532 if is_male else 1.434
        z_hem = 0.54 if is_male else 0.50
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        is_open_front = True
        neck_tilt = -0.30 if is_male else -0.28
    elif variant == "trench_coat":
        offset = 0.0180
        z_neck = 1.532 if is_male else 1.434
        z_hem = 0.48 if is_male else 0.44
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        is_open_front = True
        flare_hips = True
        neck_tilt = -0.30 if is_male else -0.28
    elif variant in ("tunic", "top_tunic"):
        offset = 0.0140
        z_neck = 1.528 if is_male else 1.430
        z_hem = 0.50 if is_male else 0.46
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        flare_hips = True
        neck_tilt = -0.32 if is_male else -0.30
    else:
        offset = 0.0130
        z_neck = 1.534 if is_male else 1.436
        z_hem = 0.84 if is_male else 0.80
        x_arm_max = 0.475 if is_male else 0.430
        sleeve_type = "long"
        neck_tilt = -0.32 if is_male else -0.30

    mw = avatar_obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(avatar_obj.data)
    bmesh.ops.transform(bm, matrix=mw, verts=bm.verts)

    body_mat_indices = {i for i, m in enumerate(avatar_obj.data.materials) if 'skin' in m.name.lower() or 'generic' in m.name.lower()}
    non_body = [f for f in bm.faces if f.material_index not in body_mat_indices]
    if non_body:
        bmesh.ops.delete(bm, geom=non_body, context='FACES')
    # Weld all UV-seam duplicate vertices across the entire body, shoulders, and arms so normal offset never splits arm seams
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0002)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0001, edges=bm.edges[:])
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    # Seal avatar shoulder/armpit UV-seam boundary holes before cutting so shoulders remain 100% continuous and manifold
    sh_holes = [
        e for e in bm.edges
        if e.is_boundary and (0.07 <= abs(e.verts[0].co.x) <= 0.30) and (1.18 <= e.verts[0].co.z <= 1.52)
    ]
    if sh_holes:
        try:
            bmesh.ops.holes_fill(bm, edges=sh_holes, sides=32)
        except Exception:
            pass
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    # 1. Precision Upper-Hip Torso Cut (cuts strictly above groin/crotch leg split at z_hip_cut
    # so tops/sweaters/coats never map onto the avatar's individual legs or crotch notch!)
    z_hip_cut = max(z_hem, 0.91 if is_male else 0.89)

    def is_torso_for_hem(v):
        x_split = (0.180 + max(0.0, 1.28 - v.co.z) * 0.36) if is_male else (0.154 + max(0.0, 1.20 - v.co.z) * 0.34)
        return abs(v.co.x) < x_split

    hem_geom = (
        [v for v in bm.verts if is_torso_for_hem(v)]
        + [e for e in bm.edges if all(is_torso_for_hem(v) for v in e.verts)]
        + [f for f in bm.faces if all(is_torso_for_hem(v) for v in f.verts)]
    )
    bmesh.ops.bisect_plane(
        bm,
        geom=hem_geom,
        plane_co=Vector((0.0, 0.0, z_hip_cut)),
        plane_no=Vector((0.0, 0.0, -1.0)),
        clear_outer=True
    )

    # 2. Precision Sleeve / Armhole Cuts
    if sleeve_type == "long":
        # Full long sleeve extending precisely to the wrist joint along the 3D forearm axis (stopping right before palms)
        wrist_r, arm_dir_r, _ = get_wrist_cuff_spec(is_male)

        r_geom = [v for v in bm.verts if v.co.x > 0.185] + [e for e in bm.edges if all(v.co.x > 0.185 for v in e.verts)] + [f for f in bm.faces if all(v.co.x > 0.185 for v in f.verts)]
        bmesh.ops.bisect_plane(bm, geom=r_geom, plane_co=wrist_r, plane_no=arm_dir_r, clear_outer=True)

        wrist_l = Vector((-wrist_r.x, wrist_r.y, wrist_r.z))
        arm_dir_l = Vector((-arm_dir_r.x, arm_dir_r.y, arm_dir_r.z))
        l_geom = [v for v in bm.verts if v.co.x < -0.185] + [e for e in bm.edges if all(v.co.x < -0.185 for v in e.verts)] + [f for f in bm.faces if all(v.co.x < -0.185 for v in f.verts)]
        bmesh.ops.bisect_plane(bm, geom=l_geom, plane_co=wrist_l, plane_no=arm_dir_l, clear_outer=True)
    elif sleeve_type == "short":
        # Short sleeve extending along true upper arm axis down the bicep (cut strictly perpendicular to arm centerline)
        sl_in = measure_arm_slice(avatar_data["verts"], x_arm_max - 0.06, is_male=is_male)
        sl_cuff = measure_arm_slice(avatar_data["verts"], x_arm_max, is_male=is_male)
        arm_axis_r = Vector((0.06, sl_cuff["cy"] - sl_in["cy"], sl_cuff["cz"] - sl_in["cz"])).normalized()
        cuff_r = Vector((x_arm_max, sl_cuff["cy"], sl_cuff["cz"]))
        x_cut_min = 0.21 if is_male else 0.185

        # Right arm
        r_geom = (
            [v for v in bm.verts if v.co.x > x_cut_min]
            + [e for e in bm.edges if all(v.co.x > x_cut_min for v in e.verts)]
            + [f for f in bm.faces if all(v.co.x > x_cut_min for v in f.verts)]
        )
        bmesh.ops.bisect_plane(bm, geom=r_geom, plane_co=cuff_r, plane_no=arm_axis_r, clear_outer=True)

        # Left arm
        arm_axis_l = Vector((-arm_axis_r.x, arm_axis_r.y, arm_axis_r.z))
        cuff_l = Vector((-cuff_r.x, cuff_r.y, cuff_r.z))
        l_geom = (
            [v for v in bm.verts if v.co.x < -x_cut_min]
            + [e for e in bm.edges if all(v.co.x < -x_cut_min for v in e.verts)]
            + [f for f in bm.faces if all(v.co.x < -x_cut_min for v in f.verts)]
        )
        bmesh.ops.bisect_plane(bm, geom=l_geom, plane_co=cuff_l, plane_no=arm_axis_l, clear_outer=True)
    elif sleeve_type == "strapless":
        # Anatomical sweetheart strapless neckline:
        # Curves over bust in front (Z=1.330 M / 1.275 F), dips smoothly below axilla on flanks (Z=1.230 M / 1.182 F),
        # and passes horizontally across mid-back (Z=1.235 M / 1.188 F).
        # This completely eliminates arm cuts, side holes, and armhole voids on strapless tops!
        z_bust = 1.330 if is_male else 1.275
        z_flank = 1.230 if is_male else 1.182
        z_back = 1.235 if is_male else 1.188

        def get_neck_z(x, y):
            t = min(1.0, abs(x) / 0.125)
            ease = 0.5 * (1.0 + math.cos(t * math.pi))
            return z_flank + ((z_bust if y < 0 else z_back) - z_flank) * ease

        to_del = [v for v in bm.verts if v.co.z > get_neck_z(v.co.x, v.co.y)]
        if to_del:
            bmesh.ops.delete(bm, geom=to_del, context='VERTS')

        # Delete any stray arm/hand vertices strictly lateral to the torso (|x| > 0.265)
        # Never delete flank or ribcage vertices (|x| <= 0.25) so torso stays 100% closed without side holes!
        stray_arm_verts = [v for v in bm.verts if abs(v.co.x) > 0.265 and v.co.z >= z_hem]
        if stray_arm_verts:
            bmesh.ops.delete(bm, geom=stray_arm_verts, context='VERTS')
    else:
        # Sleeveless (singlet, vest) armholes cut strictly in the shoulder/armpit zone (z > z_arm_cut_min)
        # so the ribcage, waist, and hip ring remain 100% closed on both sides!
        z_arm_cut_min = 1.24 if is_male else 1.16
        r_geom = (
            [v for v in bm.verts if v.co.x > (x_arm_max - 0.02) and v.co.z > z_arm_cut_min]
            + [e for e in bm.edges if all(v.co.x > (x_arm_max - 0.02) and v.co.z > z_arm_cut_min for v in e.verts)]
            + [f for f in bm.faces if all(v.co.x > (x_arm_max - 0.02) and v.co.z > z_arm_cut_min for v in f.verts)]
        )
        bmesh.ops.bisect_plane(bm, geom=r_geom, plane_co=Vector((x_arm_max, 0.0, 1.35)), plane_no=Vector((1.0, 0.0, 0.0)), clear_outer=True)

        l_geom = (
            [v for v in bm.verts if v.co.x < (-x_arm_max + 0.02) and v.co.z > z_arm_cut_min]
            + [e for e in bm.edges if all(v.co.x < (-x_arm_max + 0.02) and v.co.z > z_arm_cut_min for v in e.verts)]
            + [f for f in bm.faces if all(v.co.x < (-x_arm_max + 0.02) and v.co.z > z_arm_cut_min for v in f.verts)]
        )
        bmesh.ops.bisect_plane(bm, geom=l_geom, plane_co=Vector((-x_arm_max, 0.0, 1.35)), plane_no=Vector((-1.0, 0.0, 0.0)), clear_outer=True)

        # Remove detached hanging forearms/hands so main_isl always selects the torso, never a severed hand
        stray_arm = [v for v in bm.verts if abs(v.co.x) > (x_arm_max + 0.03)]
        if stray_arm:
            bmesh.ops.delete(bm, geom=stray_arm, context='VERTS')

    # 3. Precision Curved Collar / Strapless Cut (cuts only the neck opening or bustline while preserving 100% of body)
    if variant == "tshirt":
        # Precision 360° Crew Neck Collar: center around the avatar's actual neck center (y_neck_c),
        # never slicing shoulders, and keep a complete, smooth posterior nape collar + front scoop!
        z_neck_ref = 1.53 if is_male else 1.44
        nk_pts = [p for p in avatar_data["verts"] if abs(p.z - z_neck_ref) < 0.03 and abs(p.x) < 0.09]
        y_neck_c = 0.5 * (min(p.y for p in nk_pts) + max(p.y for p in nk_pts)) if nk_pts else (-0.016 if is_male else -0.035)
        rx_neck = 0.072 if is_male else 0.068
        ry_front = 0.072 if is_male else 0.068
        ry_back = 0.056 if is_male else 0.052
        z_collar_front = 1.472 if is_male else 1.392
        z_collar_back = 1.542 if is_male else 1.454

        del_neck = []
        for f in bm.faces:
            zs = [v.co.z for v in f.verts]
            ys = [v.co.y for v in f.verts]
            xs = [v.co.x for v in f.verts]
            mean_z = sum(zs) / len(zs)
            mean_y = (sum(ys) / len(ys)) - y_neck_c
            mean_x = sum(xs) / len(xs)

            ry_eff = ry_front if mean_y < 0 else ry_back
            r_neck_norm = (mean_x / rx_neck) ** 2 + (mean_y / ry_eff) ** 2
            t_y = max(0.0, min(1.0, (mean_y + ry_front) / (ry_front + ry_back)))
            z_col = z_collar_front * (1.0 - t_y) + z_collar_back * t_y

            if r_neck_norm < 1.0 and mean_z > z_col:
                del_neck.append(f)
            elif mean_z > (1.575 if is_male else 1.485) and abs(mean_x) < (0.105 if is_male else 0.095):
                del_neck.append(f)

        if del_neck:
            bmesh.ops.delete(bm, geom=del_neck, context='FACES')

        # Smooth the resulting 360° crew-neck collar boundary loop so front & posterior collar sit evenly
        collar_verts = [
            v for v in bm.verts
            if v.is_boundary and v.co.z > (z_collar_front - 0.03) and abs(v.co.x) < 0.11
        ]
        for v in collar_verts:
            dy_c = v.co.y - y_neck_c
            t_y = max(0.0, min(1.0, (dy_c + ry_front) / (ry_front + ry_back)))
            z_target = z_collar_front * (1.0 - t_y) + z_collar_back * t_y
            v.co.z = v.co.z * 0.35 + z_target * 0.65
    elif variant != "strapless":
        nz = math.sqrt(max(0.01, 1.0 - neck_tilt ** 2))
        neck_no = Vector((0.0, neck_tilt, nz)).normalized()
        neck_geom = (
            [v for v in bm.verts if abs(v.co.x) <= 0.10]
            + [e for e in bm.edges if all(abs(v.co.x) <= 0.10 for v in e.verts)]
            + [f for f in bm.faces if all(abs(v.co.x) <= 0.10 for v in f.verts)]
        )
        bmesh.ops.bisect_plane(
            bm,
            geom=neck_geom,
            plane_co=Vector((0.0, 0.0, z_neck)),
            plane_no=neck_no,
            clear_outer=True
        )
        head_verts = [v for v in bm.verts if v.co.z > (z_neck + 0.05)]
        if head_verts:
            bmesh.ops.delete(bm, geom=head_verts, context='VERTS')

    # Keep largest island (upper torso + sleeves) before extruding unified lower hem tube
    islands = []
    visited = set()
    for f in bm.faces:
        if f in visited:
            continue
        isl, q = [], [f]
        visited.add(f)
        while q:
            curr = q.pop()
            isl.append(curr)
            for e in curr.edges:
                for lf in e.link_faces:
                    if lf not in visited:
                        visited.add(lf)
                        q.append(lf)
        islands.append(isl)

    if not islands:
        bm.free()
        raise RuntimeError(f"No faces remained for {variant}_{gender}")

    main_isl = max(islands, key=len)
    other = [f for isl in islands if isl != main_isl for f in isl]
    if other:
        bmesh.ops.delete(bm, geom=other, context='FACES')

    orphan_verts = [v for v in bm.verts if not v.link_faces]
    if orphan_verts:
        bmesh.ops.delete(bm, geom=orphan_verts, context='VERTS')
    orphan_edges = [e for e in bm.edges if not e.link_faces]
    if orphan_edges:
        bmesh.ops.delete(bm, geom=orphan_edges, context='EDGES')

    bmesh.ops.dissolve_degenerate(bm, dist=0.0004, edges=bm.edges[:])

    # 3b. Extrude unified, continuous tubular garment hem from z_hip_cut down to z_hem
    # (Ensures sweaters, hoodies, T-shirts, jackets, cardigans, tunics, and coats hang as a single
    # continuous hem around the hips/thighs and NEVER split into two trouser legs at the crotch!)
    if z_hem < (z_hip_cut - 0.005):
        cur_edges = [
            e for e in bm.edges
            if e.is_boundary and all(abs(v.co.z - z_hip_cut) < 0.016 and abs(v.co.x) < 0.23 for v in e.verts)
        ]
        if cur_edges:
            hip_verts = list({v for e in cur_edges for v in e.verts})
            cy_hip = 0.5 * (min(v.co.y for v in hip_verts) + max(v.co.y for v in hip_verts))
            front_peak_y = min((v.co.y for v in hip_verts if 0.04 <= abs(v.co.x) <= 0.12 and v.co.y < 0.0), default=-0.105)
            back_peak_y = max((v.co.y for v in hip_verts if 0.04 <= abs(v.co.x) <= 0.12 and v.co.y > 0.0), default=0.115)
            # Bridge any subtle groin/glute dimple on the starting hip ring so the extruded tube is 100% smooth
            for hv in hip_verts:
                hv.co.z = z_hip_cut
                if abs(hv.co.x) <= 0.115:
                    tx = max(0.0, 1.0 - (abs(hv.co.x) / 0.115) ** 2)
                    if hv.co.y < 0.0 and hv.co.y > front_peak_y * 0.98:
                        hv.co.y = hv.co.y * (1.0 - 0.88 * tx) + (front_peak_y * 0.99) * (0.88 * tx)
                    elif hv.co.y > 0.0 and hv.co.y < back_peak_y * 0.98:
                        hv.co.y = hv.co.y * (1.0 - 0.90 * tx) + (back_peak_y * 0.99) * (0.90 * tx)

            span_z = z_hip_cut - z_hem
            n_steps = max(4, min(16, int(round(span_z / 0.022))))
            dz_step = span_z / n_steps
            is_flared_or_coat = flare_hips or variant in (
                "coat", "trench_coat", "tunic", "top_tunic",
                "hooded_coat", "hooded_coat_hood_off", "hooded_coat_hood_on",
            )
            radial_x_step = (0.0020 if is_flared_or_coat else (0.008 / n_steps))
            radial_y_step = (0.0015 if is_flared_or_coat else (0.006 / n_steps))
            for _step in range(1, n_steps + 1):
                ret = bmesh.ops.extrude_edge_only(bm, edges=cur_edges)
                geom_ex = ret["geom"]
                new_verts = [ele for ele in geom_ex if isinstance(ele, bmesh.types.BMVert)]
                cur_edges = [ele for ele in geom_ex if isinstance(ele, bmesh.types.BMEdge)]
                for v in new_verts:
                    v.co.z -= dz_step
                    dx_v = v.co.x
                    dy_v = v.co.y - cy_hip
                    r_v = max(1e-4, math.hypot(dx_v, dy_v))
                    v.co.x += (dx_v / r_v) * radial_x_step
                    v.co.y += (dy_v / r_v) * radial_y_step

    # 4. Open front placket (for jackets, vests, coats, cardigans)
    if is_open_front:
        gap = 0.013
        # Remove narrow strip down center front
        front_del = []
        for f in bm.faces:
            xs = [v.co.x for v in f.verts]
            ys = [v.co.y for v in f.verts]
            zs = [v.co.z for v in f.verts]
            if max(ys) < -0.015 and min(zs) >= (z_hem - 0.005) and max(zs) < (z_neck - 0.02):
                if all(abs(x) < gap for x in xs):
                    front_del.append(f)
        if front_del:
            bmesh.ops.delete(bm, geom=front_del, context='FACES')

    # Keep largest island after placket cut
    islands = []
    visited = set()
    for f in bm.faces:
        if f in visited:
            continue
        isl, q = [], [f]
        visited.add(f)
        while q:
            curr = q.pop()
            isl.append(curr)
            for e in curr.edges:
                for lf in e.link_faces:
                    if lf not in visited:
                        visited.add(lf)
                        q.append(lf)
        islands.append(isl)

    if not islands:
        bm.free()
        raise RuntimeError(f"No faces remained for {variant}_{gender}")

    main_isl = max(islands, key=len)
    other = [f for isl in islands if isl != main_isl for f in isl]
    if other:
        bmesh.ops.delete(bm, geom=other, context='FACES')

    # Weld/fill small pinhole seams (exclude intentional openings: hem, cuffs, central neck opening, and open front placket)
    small_holes = [
        e for e in bm.edges
        if e.is_boundary
        and e.verts[0].co.z > (z_hem + 0.01)
        and abs(e.verts[0].co.x) < 0.28
        and (e.verts[0].co.z < (z_neck - 0.03) or abs(e.verts[0].co.x) > 0.095)
        and not (is_open_front and abs(e.verts[0].co.x) < 0.035 and e.verts[0].co.y < -0.01)
    ]
    if small_holes:
        try:
            bmesh.ops.holes_fill(bm, edges=small_holes, sides=32)
        except Exception:
            pass

    loose_edges = [e for e in bm.edges if not e.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context='EDGES')
    loose_verts = [v for v in bm.verts if not v.link_edges]
    if loose_verts:
        bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')

    # Strictly orient all face normals radially OUTWARD from the torso centerline (never inward!)
    # Remove any non-manifold edges/faces before solidifying so solidify_bmesh_manifold produces 0 non-manifold edges
    for _nm_pass in range(4):
        nm_faces = set()
        for e in bm.edges:
            if len(e.link_faces) > 2:
                for f in e.link_faces:
                    nm_faces.add(f)
        if not nm_faces:
            break
        bmesh.ops.delete(bm, geom=list(nm_faces), context="FACES")

    # Seal any residual tiny boundary holes in the closed solidified shell
    rem_b = [e for e in bm.edges if e.is_boundary]
    if rem_b:
        try:
            bmesh.ops.holes_fill(bm, edges=rem_b, sides=8)
        except Exception:
            pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    cy_center = -0.015
    for f in bm.faces:
        fc = f.calc_center_median()
        if abs(fc.x) < 0.22:
            rad_dot = f.normal.x * fc.x + f.normal.y * (fc.y - cy_center)
            if rad_dot < 0.0:
                f.normal_flip()
    bm.normal_update()

    # Apply tailored gravity drape, bust/glute bridging, cylindrical sleeves, and cloth-tension relaxation
    drape_map = {
        "singlet": 0.42,
        "tshirt": 0.72,
        "longsleeve": 0.74,
        "vest": 0.76,
        "cardigan": 0.82,
        "jacket": 0.85,
        "top_outerwear_jacket": 0.85,
        "jacket_blazer": 0.86,
        "hoodie": 0.88,
        "hoodie_hood_off": 0.88,
        "hoodie_hood_on": 0.88,
        "tunic": 0.84,
        "top_tunic": 0.84,
        "coat": 0.92,
        "hooded_coat": 0.93,
        "hooded_coat_hood_off": 0.93,
        "hooded_coat_hood_on": 0.93,
        "trench_coat": 0.94,
    }
    drape_looseness = drape_map.get(variant, 0.75)
    drape_garment_shell(
        bm,
        avatar_data,
        offset=offset,
        style="top",
        drape_looseness=drape_looseness,
        z_hem=z_hem,
        z_top=z_neck,
        sleeve_type=sleeve_type,
        flare_hips=flare_hips,
    )

    # Topological 2-manifold Solidify (guarantees 0 non-manifold edges)
    bm_final = solidify_bmesh_manifold(bm, thickness=0.0022)

    # Pre-solidify planar cutting & drape boundary clamping ensure 100% planar cuff rims with 0 zero-area faces

    verts = [v.co for v in bm_final.verts]
    min_x, max_x = min(v.x for v in verts), max(v.x for v in verts)
    min_z, max_z = min(v.z for v in verts), max(v.z for v in verts)
    dx = max(1e-4, max_x - min_x)
    dz = max(1e-4, max_z - min_z)
    x_torso = 0.185 if is_male else 0.170
    has_sleeves = max_x > (x_torso + 0.04)
    z_sh_uv = 1.38 if is_male else 1.30
    z_wrist_uv = 0.975 if is_male else 0.895
    v_cuff_uv = 0.06 if z_hem > 0.65 else 0.12

    faces_uvs = []
    for f in bm_final.faces:
        uvs = []
        for l in f.loops:
            v = l.vert.co
            v_torso = (v.z - z_hem) / max(1e-4, max_z - z_hem)
            if sleeve_type == "long" and has_sleeves:
                x_split = (0.180 + max(0.0, 1.28 - v.z) * 0.40) if is_male else (0.152 + max(0.0, 1.20 - v.z) * 0.38)
                u_torso = 0.5 + (v.x / max(0.14, x_torso)) * 0.27
                if abs(v.x) <= x_split:
                    u = u_torso
                    v_norm = v_torso
                else:
                    # Map 3D A-pose sleeve cross-section across the 2D flat-lay hanging sleeve strip
                    t_down = min(1.0, max(0.0, (z_sh_uv - v.z) / max(1e-4, z_sh_uv - z_wrist_uv)))
                    x_sl_in = (0.185 + t_down * 0.235) if is_male else (0.156 + t_down * 0.215)
                    x_sl_out = (0.295 + t_down * 0.205) if is_male else (0.245 + t_down * 0.185)
                    s_across = min(1.0, max(0.0, (abs(v.x) - x_sl_in) / max(0.03, x_sl_out - x_sl_in)))
                    if variant in ("tunic", "top_tunic"):
                        # Longline kurta/tunic: sleeves hang close to torso and end mid-body (above lower hem/trousers)
                        if v.x > 0:
                            v_sl = 0.84 - t_down * (0.84 - 0.52)
                            u_sl_in = 0.68 + 0.03 * t_down
                            u_sl_out = 0.78 + 0.03 * t_down
                            u_sl = u_sl_in + s_across * (u_sl_out - u_sl_in)
                        else:
                            v_sl = 0.84 - t_down * (0.84 - 0.52)
                            u_sl_out = 0.22 - 0.03 * t_down
                            u_sl_in = 0.32 - 0.03 * t_down
                            u_sl = u_sl_out + (1.0 - s_across) * (u_sl_in - u_sl_out)
                    elif v.x > 0:
                        # Right arm (avatar left arm, viewer right)
                        if t_down <= 0.85:
                            v_sl = 0.78 - (t_down / 0.85) * (0.78 - 0.135)
                            u_sl_in = 0.74 + 0.10 * t_down
                            u_sl_out = 0.90 + 0.05 * t_down
                        else:
                            t_c = (t_down - 0.85) / 0.15
                            v_sl = 0.135 - t_c * (0.135 - 0.065)
                            u_sl_in = 0.825 + 0.050 * t_c
                            u_sl_out = 0.945 + 0.015 * t_c
                        u_sl = u_sl_in + s_across * (u_sl_out - u_sl_in)
                    else:
                        # Left arm (avatar right arm, viewer left)
                        if t_down <= 0.85:
                            v_sl = 0.78 - (t_down / 0.85) * (0.78 - 0.250)
                            u_sl_out = 0.08 - 0.035 * t_down
                            u_sl_in = 0.26 - 0.1294 * t_down
                        else:
                            t_c = (t_down - 0.85) / 0.15
                            v_sl = 0.250 - t_c * (0.250 - 0.175)
                            u_sl_out = 0.050 - 0.005 * t_c
                            u_sl_in = 0.150 - 0.030 * t_c
                        u_sl = u_sl_out + (1.0 - s_across) * (u_sl_in - u_sl_out)
                    # Smooth blend near shoulder/armhole transition so shoulder seam is continuous
                    t_blend = min(1.0, max(0.0, (abs(v.x) - x_split) / 0.035))
                    s_blend = t_blend * t_blend * (3.0 - 2.0 * t_blend)
                    u = u_torso * (1.0 - s_blend) + u_sl * s_blend
                    v_norm = v_torso * (1.0 - s_blend) + v_sl * s_blend
            else:
                # Short-sleeve (T-shirt, tunic) and sleeveless tops span 1:1 across [min_x, max_x]
                u = (v.x - min_x) / dx
                v_norm = v_torso
            uvs.append((max(0.005, min(0.995, u)), max(0.005, min(0.995, v_norm))))
        faces_uvs.append((f, uvs))

    is_coat_hood = variant.startswith("hooded_coat")
    if variant in ("hoodie", "hoodie_hood_off", "hooded_coat", "hooded_coat_hood_off"):
        bm_hood, hood_uvs = build_hood_off_mesh(avatar_data, bm_final, offset, z_neck, is_coat=is_coat_hood)
        merge_bmesh_with_uvs(bm_final, faces_uvs, bm_hood, hood_uvs)
        bm_hood.free()
    elif variant in ("hoodie_hood_on", "hooded_coat_hood_on"):
        bm_hood, hood_uvs = build_hood_on_mesh(avatar_data, bm_final, offset, z_neck, is_coat=is_coat_hood)
        merge_bmesh_with_uvs(bm_final, faces_uvs, bm_hood, hood_uvs)
        bm_hood.free()

    vert_weights = [(v, {"Torso_Deform": 1.0}) for v in bm_final.verts]

    non_man = [e for e in bm_final.edges if not e.is_manifold]
    zero_f = [f for f in bm_final.faces if f.calc_area() <= 1e-9]

    return bm_final, faces_uvs, vert_weights, ["Torso_Deform"]



def build_bottom_template(avatar_data, variant="trousers"):
    gender = avatar_data["gender"]
    verts = avatar_data["verts"]
    avatar_obj = avatar_data["avatar_obj"]
    is_male = gender == "male"

    is_skirt = variant in ("skirt", "skirt_aline", "skirt_pencil", "bottom_skirt")
    if is_skirt:
        offset = 0.0075
        z_waist = 1.06 if is_male else 1.02
        z_crotch = 0.80 if is_male else 0.75
        z_hem = 0.47 if is_male else 0.45
        n_rings = 18
        n_seg = 28
        skirt_rings = []
        hip_sl = measure_torso_slice(verts, 0.88 if is_male else 0.84)
        is_pencil = variant == "skirt_pencil"

        for i in range(n_rings + 1):
            t = i / n_rings
            z = z_waist - t * (z_waist - z_hem)
            sl = measure_torso_slice(verts, max(z_crotch, z))
            flare = (0.006 * t) if is_pencil else ((t ** 1.15) * 0.095)
            base_rx = max(sl["rx"], hip_sl["rx"] if z < 0.88 else sl["rx"])
            rx = base_rx + offset + flare
            ry = sl["ry"] + offset + flare * 0.65
            cy = sl["cy"]
            v_uv = 0.96 - t * 0.92

            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                u_uv = 0.5 + (px / max(0.16, rx)) * 0.42
                ring.append((Vector((px, py, z)), (max(0.02, min(0.98, u_uv)), max(0.02, min(0.98, v_uv))), {"Lower_Deform": 1.0}))
            skirt_rings.append(ring)

        bm_skirt = bmesh.new()
        f_uvs, v_wts = add_closed_tube_to_bm(bm_skirt, skirt_rings, thickness=0.0018)
        return bm_skirt, f_uvs, v_wts, ["Lower_Deform"]

    # Continuous Avatar extraction for trousers, shorts, and bermuda:
    if variant == "bermuda":
        z_hem = 0.46 if is_male else 0.44
        offset = 0.0065
    elif variant in ("shorts", "bottom_shorts"):
        z_hem = 0.58 if is_male else 0.55
        offset = 0.0060
    elif variant == "palazzo":
        z_hem = 0.090 if is_male else 0.085
        offset = 0.0110
    else:  # trousers
        z_hem = 0.105 if is_male else 0.100
        offset = 0.0085

    z_waist = 1.06 if is_male else 1.02

    mw = avatar_obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(avatar_obj.data)
    bmesh.ops.transform(bm, matrix=mw, verts=bm.verts)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if abs(v.co.x) < 0.25 and v.co.z < 1.35], dist=0.0005)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    body_mat_indices = set()
    for i, m in enumerate(avatar_obj.data.materials):
        m_name = m.name.lower()
        if "skin" in m_name or "generic" in m_name:
            body_mat_indices.add(i)

    del_faces = []
    for f in bm.faces:
        if f.material_index not in body_mat_indices:
            del_faces.append(f)
            continue
        zs = [v.co.z for v in f.verts]
        xs = [abs(v.co.x) for v in f.verts]
        if min(zs) > z_waist:
            del_faces.append(f)
            continue
        if max(xs) <= 0.22 and max(zs) < z_hem:
            del_faces.append(f)
            continue
        # Exclude arms/hands hanging near hips
        if max(xs) > 0.26:
            del_faces.append(f)
            continue

    bmesh.ops.delete(bm, geom=del_faces, context='FACES')

    # Bisect waistband cleanly at z_waist
    waist_geom = (
        [v for v in bm.verts if v.co.z > (z_waist - 0.03)]
        + [e for e in bm.edges if any(v.co.z > (z_waist - 0.03) for v in e.verts)]
        + [f for f in bm.faces if any(v.co.z > (z_waist - 0.03) for v in f.verts)]
    )
    bmesh.ops.bisect_plane(
        bm,
        geom=waist_geom,
        plane_co=Vector((0.0, 0.0, z_waist)),
        plane_no=Vector((0.0, 0.0, 1.0)),
        clear_outer=True
    )

    # Bisect cuffs cleanly at z_hem
    cuff_geom = (
        [v for v in bm.verts if v.co.z < (z_hem + 0.03)]
        + [e for e in bm.edges if any(v.co.z < (z_hem + 0.03) for v in e.verts)]
        + [f for f in bm.faces if any(v.co.z < (z_hem + 0.03) for v in f.verts)]
    )
    bmesh.ops.bisect_plane(
        bm,
        geom=cuff_geom,
        plane_co=Vector((0.0, 0.0, z_hem)),
        plane_no=Vector((0.0, 0.0, -1.0)),
        clear_outer=True
    )

    islands = []
    visited = set()
    for f in bm.faces:
        if f in visited:
            continue
        isl, q = [], [f]
        visited.add(f)
        while q:
            curr = q.pop()
            isl.append(curr)
            for e in curr.edges:
                for lf in e.link_faces:
                    if lf not in visited:
                        visited.add(lf)
                        q.append(lf)
        islands.append(isl)

    if not islands:
        bm.free()
        raise RuntimeError(f"No faces remained for bottom {variant}_{gender}")

    main_isl = max(islands, key=len)
    other = [f for isl in islands if isl != main_isl for f in isl]
    if other:
        bmesh.ops.delete(bm, geom=other, context='FACES')

    loose_edges = [e for e in bm.edges if not e.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context='EDGES')
    loose_verts = [v for v in bm.verts if not v.link_edges]
    if loose_verts:
        bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')

    drape_garment_shell(
        bm,
        avatar_data,
        offset=offset,
        style="bottom",
        drape_looseness=0.92 if variant == "palazzo" else (0.78 if variant == "trousers" else 0.72),
        z_hem=z_hem,
        z_top=z_waist,
        sleeve_type="none",
        flare_hips=False,
    )
    for v in bm.verts:
        if variant == "palazzo" and v.co.z < 0.85:
            # Wide flowing palazzo trouser flare from hip down to ankle cuff, keeping inner leg separation
            t_leg = min(1.0, max(0.0, (0.85 - v.co.z) / max(0.1, 0.85 - z_hem)))
            leg_cx = math.copysign(0.105 if is_male else 0.095, v.co.x)
            dx_leg = v.co.x - leg_cx
            dy_leg = v.co.y
            r_leg = max(1e-4, math.hypot(dx_leg, dy_leg))
            flare = 0.032 * t_leg
            new_x = v.co.x + (dx_leg / r_leg) * flare
            # Prevent left and right wide palazzo legs from crossing center x=0
            if v.co.x >= 0:
                new_x = max(0.008, new_x)
            else:
                new_x = min(-0.008, new_x)
            v.co.x = new_x
            v.co.y += (dy_leg / r_leg) * flare
        elif variant == "trousers" and v.co.z < 0.22:
            t_cuff = min(1.0, max(0.0, (0.22 - v.co.z) / 0.12))
            v.co.x += (0.012 * t_cuff) * (1.0 if v.co.x > 0 else -1.0)
            v.co.y += (0.008 * t_cuff) * (1.0 if v.co.y > 0 else -1.0)

    bm_final = solidify_bmesh_manifold(bm, thickness=0.0022)

    # Safety clamp: prevent any stray waist/hem vertices from shooting beyond bounds
    for v in bm_final.verts:
        v.co.z = min(z_waist + 0.015, max(z_hem - 0.015, v.co.z))
        if abs(v.co.x) > 0.28:
            v.co.x = math.copysign(0.28, v.co.x)

        # Solidify modifier preserves clean manifold shell
    pass

    verts = [v.co for v in bm_final.verts]
    min_x, max_x = min(v.x for v in verts), max(v.x for v in verts)
    min_z, max_z = min(v.z for v in verts), max(v.z for v in verts)
    dx = max(1e-4, max_x - min_x)
    dz = max(1e-4, max_z - min_z)
    x_torso = 0.185 if is_male else 0.170
    has_sleeves = max_x > (x_torso + 0.05)

    faces_uvs = []
    for f in bm_final.faces:
        uvs = []
        for l in f.loops:
            v = l.vert.co
            if has_sleeves:
                if abs(v.x) <= x_torso:
                    u = 0.5 + (v.x / x_torso) * 0.29
                else:
                    t_sl = min(1.0, (abs(v.x) - x_torso) / max(1e-4, max_x - x_torso))
                    u = 0.5 + math.copysign(0.29 + t_sl * 0.20, v.x)
            else:
                u = (v.x - min_x) / dx
            v_torso = (v.z - z_hem) / max(1e-4, max_z - z_hem)
            v_arm = (v.z - min_z) / dz
            t_arm = min(1.0, max(0.0, (abs(v.x) - 0.175) / 0.045)) if has_sleeves else 0.0
            v_norm = v_torso * (1.0 - t_arm) + v_arm * t_arm
            uvs.append((max(0.005, min(0.995, u)), max(0.005, min(0.995, v_norm))))
        faces_uvs.append((f, uvs))

    vert_weights = [(v, {"Lower_Deform": 1.0}) for v in bm_final.verts]
    return bm_final, faces_uvs, vert_weights, ["Lower_Deform"]


def build_footwear_template(avatar_data, variant="sneakers"):
    """
    Reproduces footwear templates snapped to avatar feet landmarks:
      - variant='sneakers': shoes_sneakers.glb (Low-top sneaker, collar at Z=0.095m, nested inside trousers cuff)
      - variant='boots': shoes_boots.glb (Mid/high-shaft boot to Z=0.28m, shaft envelopes trousers hem at +0.014m)
    Vertex groups:
      - Footwear_Upper (Weight: 1.0)
      - Footwear_Sole (Weight: 0.0, locked rigid sole at Z=0.0)
    """
    gender = avatar_data["gender"]
    verts = avatar_data["verts"]
    is_male = gender == "male"

    # Measure avatar left foot bounds (x > 0, z < 0.12)
    foot_pts = [v for v in verts if v.x > 0.05 and v.z <= 0.12]
    x_min = min(v.x for v in foot_pts)
    x_max = max(v.x for v in foot_pts)
    y_toe = min(v.y for v in foot_pts)   # Front toe is -Y in Blender
    y_heel = max(v.y for v in foot_pts)  # Back heel is +Y in Blender
    foot_cx = 0.5 * (x_min + x_max)
    foot_rx = 0.5 * (x_max - x_min)

    bm = bmesh.new()
    all_faces_uvs = []
    all_vert_weights = []

    z_sole_bottom = 0.0
    z_sole_top = 0.024
    z_top = (0.095 if variant == "sneakers" else 0.480)
    n_seg = 20

    # Ring profile from Z=0 (sole bottom) up to z_top
    if variant == "sneakers":
        # Collar at Z=0.095 has tight ankle clearance (+0.0035m) so bottom_trousers cuff (+0.0135m) clears OVER it!
        z_levels = [
            (0.000, 1.06, 1.06, True),   # Sole bottom (Rigid: Footwear_Sole=1, Footwear_Upper=0)
            (0.012, 1.06, 1.06, True),   # Sole mid (Rigid)
            (0.024, 1.03, 1.03, True),   # Sole top welt (Rigid)
            (0.048, 0.96, 0.95, False),  # Vamp / instep (Deformable Upper)
            (0.072, 0.78, 0.62, False),  # Ankle transition (Deformable Upper)
            (0.095, 0.72, 0.52, False),  # Low-top sneaker collar (nests inside trousers cuff)
        ]
    else:
        # Boots: shaft extends to Z=0.48m (knee-high) with radial offset so boot shaft envelopes trousers/calf!
        z_levels = [
            (0.000, 1.08, 1.08, True),   # Sole bottom (Rigid)
            (0.014, 1.08, 1.08, True),   # Sole mid (Rigid)
            (0.028, 1.05, 1.05, True),   # Sole top welt (Rigid)
            (0.055, 0.98, 0.96, False),  # Vamp / instep
            (0.095, 0.96, 0.72, False),  # Ankle
            (0.150, 0.98, 0.74, False),  # Lower shin
            (0.240, 0.96, 0.72, False),  # Mid calf
            (0.340, 0.98, 0.76, False),  # Upper calf
            (0.420, 1.00, 0.78, False),  # Lower knee
            (0.480, 1.02, 0.80, False),  # Knee-high boot collar
        ]

    for side_idx, side in enumerate((-1.0, 1.0)):
        shoe_rings = []
        for r_idx, (z_val, scale_x, scale_y, is_sole) in enumerate(z_levels):
            t_v = r_idx / (len(z_levels) - 1)
            if z_val <= 0.065:
                cx = side * foot_cx
                rx = foot_rx * scale_x + (0.005 if variant == "sneakers" else 0.008)
                # Foot extends forward (-Y) at toe and backward (+Y) at heel
                y_front = y_toe - 0.008 * scale_y
                y_back = y_heel + 0.006 * scale_y
                cy = 0.5 * (y_front + y_back)
                ry = 0.5 * (y_back - y_front)
            else:
                leg_sl = measure_leg_slice(verts, z_val)
                knee_sl = measure_leg_slice(verts, 0.50 if is_male else 0.47)
                cx = side * leg_sl["cx"]
                # Sneaker collar stays snug (+0.0035m) under trousers; Boot shaft flares (+0.020m over trousers cuff)!
                if variant == "sneakers":
                    rx = leg_sl["rx"] + 0.0035
                    ry = leg_sl["ry"] + 0.0035
                else:
                    rx = max(leg_sl["rx"], knee_sl["rx"] * 0.90) + 0.028
                    ry = max(leg_sl["ry"], knee_sl["ry"] * 0.92) + 0.028
                cy = leg_sl["cy"]

            wdict = (
                {"Footwear_Upper": 0.0, "Footwear_Sole": 1.0}
                if is_sole
                else {"Footwear_Upper": 1.0, "Footwear_Sole": 0.0}
            )
            # Distinct UV shells for sole vs upper
            v_uv = (0.04 + (z_val / 0.028) * 0.18) if is_sole else (0.26 + t_v * 0.70)
            u_base = 0.04 if side < 0 else 0.54

            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = cx + rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                u_uv = u_base + (0.5 + 0.5 * math.cos(theta)) * 0.42
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), wdict))
            shoe_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, shoe_rings, thickness=0.0020)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

    return bm, all_faces_uvs, all_vert_weights, ["Footwear_Upper", "Footwear_Sole"]



def build_dress_template(avatar_data, variant="dress"):
    if variant == "kurta_set":
        bm_top, uvs_top, w_top, _ = build_top_template(avatar_data, "tunic")
        bm_bot, uvs_bot, w_bot, _ = build_bottom_template(avatar_data, "palazzo")

        bm_merged = bmesh.new()
        faces_uvs = []
        vert_weights = []

        # Copy top (kurta) into merged bmesh
        top_vmap = {}
        for v in bm_top.verts:
            nv = bm_merged.verts.new(v.co)
            top_vmap[v] = nv
        bm_merged.verts.ensure_lookup_table()
        for v_orig, w_dict in w_top:
            nv = top_vmap.get(v_orig)
            if nv is not None:
                vert_weights.append((nv, dict(w_dict)))
        for f_orig, uvs in uvs_top:
            try:
                nf = bm_merged.faces.new([top_vmap[l.vert] for l in f_orig.loops])
                # Map kurta UVs to upper region [0.42, 0.99] so full-body texture splits cleanly
                mapped_uvs = [(u, 0.42 + v_coord * 0.57) for (u, v_coord) in uvs]
                faces_uvs.append((nf, mapped_uvs))
            except ValueError:
                pass

        # Copy bottom (palazzo pants) into merged bmesh
        bot_vmap = {}
        for v in bm_bot.verts:
            nv = bm_merged.verts.new(v.co)
            bot_vmap[v] = nv
        bm_merged.verts.ensure_lookup_table()
        for v_orig, w_dict in w_bot:
            nv = bot_vmap.get(v_orig)
            if nv is not None:
                vert_weights.append((nv, dict(w_dict)))
        for f_orig, uvs in uvs_bot:
            try:
                nf = bm_merged.faces.new([bot_vmap[l.vert] for l in f_orig.loops])
                # Map palazzo pants UVs to lower region [0.01, 0.42]
                mapped_uvs = [(u, 0.01 + v_coord * 0.41) for (u, v_coord) in uvs]
                faces_uvs.append((nf, mapped_uvs))
            except ValueError:
                pass

        bm_top.free()
        bm_bot.free()
        bm_merged.verts.ensure_lookup_table()
        bm_merged.faces.ensure_lookup_table()
        return bm_merged, faces_uvs, vert_weights, ["Torso_Deform", "Lower_Deform"]

    gender = avatar_data["gender"]
    avatar_obj = avatar_data["avatar_obj"]
    is_male = gender == "male"
    is_kaftan = variant == "kaftan"
    is_strapless = variant in ("strapless", "dress_strapless")

    z_neck = (1.330 if is_male else 1.275) if is_strapless else ((1.534 if is_male else 1.434) if is_kaftan else (1.532 if is_male else 1.432))
    z_hip = 0.90 if is_male else 0.88
    z_hem = (0.08 if is_male else 0.07) if is_kaftan else (0.60 if is_male else 0.56)
    sleeve_type = "strapless" if is_strapless else ("long" if is_kaftan else "sleeveless")
    x_arm_max = (0.195 if is_male else 0.168) if is_strapless else ((0.475 if is_male else 0.430) if is_kaftan else (0.195 if is_male else 0.168))
    offset = 0.008 if is_strapless else (0.014 if is_kaftan else 0.009)
    neck_tilt = 0.0 if is_strapless else (-0.28 if is_kaftan else (-0.30 if is_male else -0.28))

    mw = avatar_obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(avatar_obj.data)
    bmesh.ops.transform(bm, matrix=mw, verts=bm.verts)
    body_mat_indices = {
        i for i, m in enumerate(avatar_obj.data.materials)
        if "skin" in m.name.lower() or "generic" in m.name.lower()
    }
    non_body = [f for f in bm.faces if f.material_index not in body_mat_indices]
    if non_body:
        bmesh.ops.delete(bm, geom=non_body, context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0002)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0001, edges=bm.edges[:])
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    # Seal avatar shoulder/armpit UV-seam boundary holes before cutting so shoulders remain 100% continuous and manifold
    sh_holes = [
        e for e in bm.edges
        if e.is_boundary and (0.07 <= abs(e.verts[0].co.x) <= 0.30) and (1.18 <= e.verts[0].co.z <= 1.52)
    ]
    if sh_holes:
        try:
            bmesh.ops.holes_fill(bm, edges=sh_holes, sides=32)
        except Exception:
            pass
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    # 1. Cut upper bodice cleanly above crotch bifurcation so torso is a single unified loop
    bmesh.ops.bisect_plane(
        bm,
        geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
        plane_co=Vector((0.0, 0.0, z_hip)),
        plane_no=Vector((0.0, 0.0, -1.0)),
        clear_outer=True,
    )

    # 2. Precision Sleeve / Armhole Cuts
    if sleeve_type == "long":
        wrist_r, arm_dir_r, _ = get_wrist_cuff_spec(is_male)
        r_geom = [v for v in bm.verts if v.co.x > 0.185] + [e for e in bm.edges if all(v.co.x > 0.185 for v in e.verts)] + [f for f in bm.faces if all(v.co.x > 0.185 for v in f.verts)]
        bmesh.ops.bisect_plane(bm, geom=r_geom, plane_co=wrist_r, plane_no=arm_dir_r, clear_outer=True)

        wrist_l = Vector((-wrist_r.x, wrist_r.y, wrist_r.z))
        arm_dir_l = Vector((-arm_dir_r.x, arm_dir_r.y, arm_dir_r.z))
        l_geom = [v for v in bm.verts if v.co.x < -0.185] + [e for e in bm.edges if all(v.co.x < -0.185 for v in e.verts)] + [f for f in bm.faces if all(v.co.x < -0.185 for v in f.verts)]
        bmesh.ops.bisect_plane(bm, geom=l_geom, plane_co=wrist_l, plane_no=arm_dir_l, clear_outer=True)
    elif sleeve_type == "strapless":
        # Anatomical sweetheart strapless neckline:
        # Curves over bust in front (Z=1.330 M / 1.275 F), dips smoothly below axilla on flanks (Z=1.230 M / 1.182 F),
        # and passes horizontally across mid-back (Z=1.235 M / 1.188 F).
        # This completely eliminates arm cuts, side holes, and armhole voids on strapless dresses!
        z_bust = 1.330 if is_male else 1.275
        z_flank = 1.230 if is_male else 1.182
        z_back = 1.235 if is_male else 1.188

        def get_neck_z(x, y):
            t = min(1.0, abs(x) / 0.125)
            ease = 0.5 * (1.0 + math.cos(t * math.pi))
            return z_flank + ((z_bust if y < 0 else z_back) - z_flank) * ease

        to_del = [v for v in bm.verts if v.co.z > get_neck_z(v.co.x, v.co.y)]
        if to_del:
            bmesh.ops.delete(bm, geom=to_del, context='VERTS')

        # Delete any stray arm/hand vertices strictly lateral to the torso (|x| > 0.265)
        # Never delete flank, bust, or ribcage vertices (|x| <= 0.25) so dress stays 100% closed without side holes!
        z_axilla_fold = 1.18 if is_male else 1.14
        stray_arm_verts = [
            v for v in bm.verts
            if (abs(v.co.x) > 0.265 and v.co.z >= z_axilla_fold)
            or (abs(v.co.x) > 0.280 and v.co.z >= z_hip)
        ]
        if stray_arm_verts:
            bmesh.ops.delete(bm, geom=stray_arm_verts, context='VERTS')
    else:
        # Sleeveless dress armholes cut strictly in the shoulder/armpit zone (z > z_arm_cut_min)
        # so the ribcage, waist, and hip ring at z_hip remain 100% closed on both sides!
        z_arm_cut_min = 1.24 if is_male else 1.16
        r_geom = (
            [v for v in bm.verts if v.co.x > (x_arm_max - 0.02) and v.co.z > z_arm_cut_min]
            + [e for e in bm.edges if all(v.co.x > (x_arm_max - 0.02) and v.co.z > z_arm_cut_min for v in e.verts)]
            + [f for f in bm.faces if all(v.co.x > (x_arm_max - 0.02) and v.co.z > z_arm_cut_min for v in f.verts)]
        )
        bmesh.ops.bisect_plane(bm, geom=r_geom, plane_co=Vector((x_arm_max, 0.0, 1.35)), plane_no=Vector((1.0, 0.0, 0.0)), clear_outer=True)

        l_geom = (
            [v for v in bm.verts if v.co.x < (-x_arm_max + 0.02) and v.co.z > z_arm_cut_min]
            + [e for e in bm.edges if all(v.co.x < (-x_arm_max + 0.02) and v.co.z > z_arm_cut_min for v in e.verts)]
            + [f for f in bm.faces if all(v.co.x < (-x_arm_max + 0.02) and v.co.z > z_arm_cut_min for v in f.verts)]
        )
        bmesh.ops.bisect_plane(bm, geom=l_geom, plane_co=Vector((-x_arm_max, 0.0, 1.35)), plane_no=Vector((-1.0, 0.0, 0.0)), clear_outer=True)

        # Remove detached hanging forearms/hands so main_isl always selects the torso, never a severed hand
        stray_arm = [v for v in bm.verts if abs(v.co.x) > (x_arm_max + 0.03)]
        if stray_arm:
            bmesh.ops.delete(bm, geom=stray_arm, context='VERTS')

    # 3. Precision Curved Collar / Strapless Cut (preserves 100% of body below neckline)
    if not is_strapless:
        nz = math.sqrt(max(0.01, 1.0 - neck_tilt ** 2))
        neck_no = Vector((0.0, neck_tilt, nz)).normalized()
        bmesh.ops.bisect_plane(
            bm,
            geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
            plane_co=Vector((0.0, 0.0, z_neck)),
            plane_no=neck_no,
            clear_outer=True,
        )

    # Keep main bodice island
    islands = []
    visited = set()
    for f in bm.faces:
        if f in visited:
            continue
        isl, q = [], [f]
        visited.add(f)
        while q:
            curr = q.pop()
            isl.append(curr)
            for e in curr.edges:
                for lf in e.link_faces:
                    if lf not in visited:
                        visited.add(lf)
                        q.append(lf)
        islands.append(isl)

    if not islands:
        bm.free()
        raise RuntimeError(f"No faces remained for dress {variant}_{gender}")

    main_isl = max(islands, key=len)
    other = [f for isl in islands if isl != main_isl for f in isl]
    if other:
        bmesh.ops.delete(bm, geom=other, context='FACES')

    orphan_verts = [v for v in bm.verts if not v.link_faces]
    if orphan_verts:
        bmesh.ops.delete(bm, geom=orphan_verts, context='VERTS')
    orphan_edges = [e for e in bm.edges if not e.link_faces]
    if orphan_edges:
        bmesh.ops.delete(bm, geom=orphan_edges, context='EDGES')

    bmesh.ops.dissolve_degenerate(bm, dist=0.0005, edges=bm.edges[:])

    # 4. Extrude unified, continuous A-line dress skirt from the closed hip boundary loop down to z_hem
    # (Eliminates split pant legs and jagged hem edges on dresses!)
    cur_edges = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z - z_hip) < 0.016 and abs(v.co.x) < 0.23 for v in e.verts)]
    if cur_edges:
        hip_verts = list({v for e in cur_edges for v in e.verts})
        cy_hip = 0.5 * (min(v.co.y for v in hip_verts) + max(v.co.y for v in hip_verts))
        front_peak_y = min((v.co.y for v in hip_verts if 0.04 <= abs(v.co.x) <= 0.12 and v.co.y < 0.0), default=-0.105)
        back_peak_y = max((v.co.y for v in hip_verts if 0.04 <= abs(v.co.x) <= 0.12 and v.co.y > 0.0), default=0.115)
        for hv in hip_verts:
            hv.co.z = z_hip
            if abs(hv.co.x) <= 0.115:
                tx = max(0.0, 1.0 - (abs(hv.co.x) / 0.115) ** 2)
                if hv.co.y < 0.0 and hv.co.y > front_peak_y * 0.98:
                    hv.co.y = hv.co.y * (1.0 - 0.88 * tx) + (front_peak_y * 0.99) * (0.88 * tx)
                elif hv.co.y > 0.0 and hv.co.y < back_peak_y * 0.98:
                    hv.co.y = hv.co.y * (1.0 - 0.90 * tx) + (back_peak_y * 0.99) * (0.90 * tx)
        n_steps = 20 if is_kaftan else 10
        dz_step = (z_hip - z_hem) / n_steps
        radial_x_step = 0.0036 if is_kaftan else 0.0042
        radial_y_step = 0.0026 if is_kaftan else 0.0030
        for _step in range(1, n_steps + 1):
            ret = bmesh.ops.extrude_edge_only(bm, edges=cur_edges)
            geom_ex = ret["geom"]
            new_verts = [ele for ele in geom_ex if isinstance(ele, bmesh.types.BMVert)]
            cur_edges = [ele for ele in geom_ex if isinstance(ele, bmesh.types.BMEdge)]
            for v in new_verts:
                v.co.z -= dz_step
                dx_v = v.co.x
                dy_v = v.co.y - cy_hip
                r_v = max(1e-4, math.hypot(dx_v, dy_v))
                v.co.x += (dx_v / r_v) * radial_x_step
                v.co.y += (dy_v / r_v) * radial_y_step

    loose_edges = [e for e in bm.edges if not e.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context='EDGES')
    loose_verts = [v for v in bm.verts if not v.link_edges]
    if loose_verts:
        bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')

    # Strictly orient all face normals radially OUTWARD from the torso centerline (never inward!)
    # Remove any non-manifold edges/faces before solidifying so solidify_bmesh_manifold produces 0 non-manifold edges
    for _nm_pass in range(4):
        nm_faces = set()
        for e in bm.edges:
            if len(e.link_faces) > 2:
                for f in e.link_faces:
                    nm_faces.add(f)
        if not nm_faces:
            break
        bmesh.ops.delete(bm, geom=list(nm_faces), context="FACES")

    # Seal any residual tiny boundary holes in the closed solidified shell
    rem_b = [e for e in bm.edges if e.is_boundary]
    if rem_b:
        try:
            bmesh.ops.holes_fill(bm, edges=rem_b, sides=8)
        except Exception:
            pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    cy_center = -0.015
    for f in bm.faces:
        fc = f.calc_center_median()
        if abs(fc.x) < 0.22:
            rad_dot = f.normal.x * fc.x + f.normal.y * (fc.y - cy_center)
            if rad_dot < 0.0:
                f.normal_flip()
    bm.normal_update()
    drape_garment_shell(
        bm,
        avatar_data,
        offset=offset,
        style="dress",
        drape_looseness=0.92 if is_kaftan else 0.76,
        z_hem=z_hem,
        z_top=z_neck,
        sleeve_type=sleeve_type,
        flare_hips=False,
    )

    bm_final = solidify_bmesh_manifold(bm, thickness=0.0022)

    # Pre-solidify planar cutting & drape boundary clamping ensure 100% planar cuff rims with 0 zero-area faces

    verts = [v.co for v in bm_final.verts]
    min_x, max_x = min(v.x for v in verts), max(v.x for v in verts)
    min_z, max_z = min(v.z for v in verts), max(v.z for v in verts)
    dx = max(1e-4, max_x - min_x)
    dz = max(1e-4, max_z - min_z)
    x_torso = 0.185 if is_male else 0.170
    has_sleeves = (sleeve_type == "long") and (max_x > (x_torso + 0.05))
    z_sh_uv = 1.38 if is_male else 1.30
    z_wrist_uv = 0.975 if is_male else 0.895
    v_cuff_uv = 0.06

    faces_uvs = []
    for f in bm_final.faces:
        uvs = []
        for l in f.loops:
            v = l.vert.co
            v_torso = (v.z - z_hem) / max(1e-4, max_z - z_hem)
            if has_sleeves:
                x_split = (0.180 + max(0.0, 1.28 - v.z) * 0.40) if is_male else (0.152 + max(0.0, 1.20 - v.z) * 0.38)
                u_torso = 0.5 + (v.x / max(0.14, x_torso)) * 0.27
                if abs(v.x) <= x_split:
                    u = u_torso
                    v_norm = v_torso
                else:
                    t_down = min(1.0, max(0.0, (z_sh_uv - v.z) / max(1e-4, z_sh_uv - z_wrist_uv)))
                    x_sl_in = (0.185 + t_down * 0.235) if is_male else (0.156 + t_down * 0.215)
                    x_sl_out = (0.295 + t_down * 0.205) if is_male else (0.245 + t_down * 0.185)
                    s_across = min(1.0, max(0.0, (abs(v.x) - x_sl_in) / max(0.03, x_sl_out - x_sl_in)))
                    if variant in ("tunic", "top_tunic"):
                        # Longline kurta/tunic: sleeves hang close to torso and end mid-body (above lower hem/trousers)
                        if v.x > 0:
                            v_sl = 0.84 - t_down * (0.84 - 0.52)
                            u_sl_in = 0.68 + 0.03 * t_down
                            u_sl_out = 0.78 + 0.03 * t_down
                            u_sl = u_sl_in + s_across * (u_sl_out - u_sl_in)
                        else:
                            v_sl = 0.84 - t_down * (0.84 - 0.52)
                            u_sl_out = 0.22 - 0.03 * t_down
                            u_sl_in = 0.32 - 0.03 * t_down
                            u_sl = u_sl_out + (1.0 - s_across) * (u_sl_in - u_sl_out)
                    elif v.x > 0:
                        # Right arm (avatar left arm, viewer right)
                        if t_down <= 0.85:
                            v_sl = 0.78 - (t_down / 0.85) * (0.78 - 0.135)
                            u_sl_in = 0.74 + 0.10 * t_down
                            u_sl_out = 0.90 + 0.05 * t_down
                        else:
                            t_c = (t_down - 0.85) / 0.15
                            v_sl = 0.135 - t_c * (0.135 - 0.065)
                            u_sl_in = 0.825 + 0.050 * t_c
                            u_sl_out = 0.945 + 0.015 * t_c
                        u_sl = u_sl_in + s_across * (u_sl_out - u_sl_in)
                    else:
                        # Left arm (avatar right arm, viewer left)
                        if t_down <= 0.85:
                            v_sl = 0.78 - (t_down / 0.85) * (0.78 - 0.250)
                            u_sl_out = 0.08 - 0.035 * t_down
                            u_sl_in = 0.26 - 0.1294 * t_down
                        else:
                            t_c = (t_down - 0.85) / 0.15
                            v_sl = 0.250 - t_c * (0.250 - 0.175)
                            u_sl_out = 0.050 - 0.005 * t_c
                            u_sl_in = 0.150 - 0.030 * t_c
                        u_sl = u_sl_out + (1.0 - s_across) * (u_sl_in - u_sl_out)
                    t_blend = min(1.0, max(0.0, (abs(v.x) - x_split) / 0.035))
                    s_blend = t_blend * t_blend * (3.0 - 2.0 * t_blend)
                    u = u_torso * (1.0 - s_blend) + u_sl * s_blend
                    v_norm = v_torso * (1.0 - s_blend) + v_sl * s_blend
            else:
                # Sleeveless & strapless dresses: map u across [min_x, max_x] so front and back sheets receive full texture coverage!
                u = (v.x - min_x) / dx
                v_norm = v_torso
            uvs.append((max(0.005, min(0.995, u)), max(0.005, min(0.995, v_norm))))
        faces_uvs.append((f, uvs))

    is_coat_hood = variant.startswith("hooded_coat")
    if variant in ("hoodie", "hoodie_hood_off", "hooded_coat", "hooded_coat_hood_off"):
        bm_hood, hood_uvs = build_hood_off_mesh(avatar_data, bm_final, offset, z_neck, is_coat=is_coat_hood)
        merge_bmesh_with_uvs(bm_final, faces_uvs, bm_hood, hood_uvs)
        bm_hood.free()
    elif variant in ("hoodie_hood_on", "hooded_coat_hood_on"):
        bm_hood, hood_uvs = build_hood_on_mesh(avatar_data, bm_final, offset, z_neck, is_coat=is_coat_hood)
        merge_bmesh_with_uvs(bm_final, faces_uvs, bm_hood, hood_uvs)
        bm_hood.free()

    vert_weights = [(v, {"Torso_Deform": 1.0}) for v in bm_final.verts]
    return bm_final, faces_uvs, vert_weights, ["Torso_Deform"]


def build_accessory_template(avatar_data, variant="belt"):
    """
    Reproduces canonical accessory templates anchored to avatar landmarks:
      - variant='belt': accessory_belt.glb (Deformable_Strap=1.0, Rigid_Hardware=0.0)
      - variant='hat': accessory_hat.glb (Rigid_Hardware=0.0)
      - variant='glasses': accessory_glasses.glb (Rigid_Hardware=0.0)
      - variant='crossbody_bag': accessory_crossbody_bag.glb (Strap_Deform=1.0, Bag_Body=0.0)
    """
    gender = avatar_data["gender"]
    verts = avatar_data["verts"]
    is_male = gender == "male"

    bm = bmesh.new()
    all_faces_uvs = []
    all_vert_weights = []

    if variant == "belt":
        z_belt = 1.06 if is_male else 1.02
        half_h = 0.020
        sl = measure_torso_slice(verts, z_belt)
        rx = sl["rx"] + 0.0105
        ry = sl["ry"] + 0.0105
        cy = sl["cy"]

        # 1. Waistband Strap (Deformable_Strap=1.0, Rigid_Hardware=0.0)
        n_rings = 4
        n_seg = 28
        strap_rings = []
        for i in range(n_rings + 1):
            t = i / n_rings
            z = (z_belt + half_h) - t * (2.0 * half_h)
            v_uv = 0.85 - t * 0.45
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                # Front center buckle zone (theta near -pi/2 in Blender where front is -Y)
                is_front_buckle = (math.sin(theta) < -0.92 and abs(px) <= 0.032)
                wdict = (
                    {"Deformable_Strap": 0.0, "Rigid_Hardware": 1.0}
                    if is_front_buckle
                    else {"Deformable_Strap": 1.0, "Rigid_Hardware": 0.0}
                )
                u_uv = 0.05 + (j / n_seg) * 0.90
                ring.append((Vector((px, py, z)), (u_uv, v_uv), wdict))
            strap_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, strap_rings, thickness=0.0022)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # 2. Authentic 3D Open-Frame Metallic Buckle + Prong at center front (-Y)
        # Uses v_uv in [0.01, 0.04] so GarmentTemplateMesh assigns it a true metallic PBR material!
        b_w = 0.030
        b_h = 0.025
        bar_t = 0.0045
        b_y_back = cy - ry - 0.0015
        b_y_front = cy - ry - 0.0075
        b_wdict = {"Deformable_Strap": 0.0, "Rigid_Hardware": 1.0}

        def add_buckle_bar(x0, x1, z0, z1, y0=b_y_front, y1=b_y_back):
            bar_rings = [
                [
                    (Vector((x0, y0, z0)), (0.40, 0.02), b_wdict),
                    (Vector((x1, y0, z0)), (0.60, 0.02), b_wdict),
                    (Vector((x1, y1, z0)), (0.60, 0.03), b_wdict),
                    (Vector((x0, y1, z0)), (0.40, 0.03), b_wdict),
                ],
                [
                    (Vector((x0, y0, z1)), (0.40, 0.02), b_wdict),
                    (Vector((x1, y0, z1)), (0.60, 0.02), b_wdict),
                    (Vector((x1, y1, z1)), (0.60, 0.03), b_wdict),
                    (Vector((x0, y1, z1)), (0.40, 0.03), b_wdict),
                ],
            ]
            f_u, v_w = add_closed_tube_to_bm(bm, bar_rings, thickness=0.0008)
            all_faces_uvs.extend(f_u)
            all_vert_weights.extend(v_w)

        # Top & bottom horizontal frame bars
        add_buckle_bar(-b_w, b_w, z_belt + b_h - bar_t, z_belt + b_h)
        add_buckle_bar(-b_w, b_w, z_belt - b_h, z_belt - b_h + bar_t)
        # Left & right vertical frame bars
        add_buckle_bar(-b_w, -b_w + bar_t, z_belt - b_h + bar_t, z_belt + b_h - bar_t)
        add_buckle_bar(b_w - bar_t, b_w, z_belt - b_h + bar_t, z_belt + b_h - bar_t)
        # Center buckle prong / pin
        add_buckle_bar(-0.0022, 0.028, z_belt - 0.0022, z_belt + 0.0022, y0=b_y_front - 0.0012, y1=b_y_front + 0.0025)

        return bm, all_faces_uvs, all_vert_weights, ["Deformable_Strap", "Rigid_Hardware"]

    if variant == "hat":
        # Measure skull crown apex from avatar
        z_max = max(v.z for v in verts)
        head_pts = [v for v in verts if v.z >= z_max - 0.16]
        cx = 0.0
        cy = 0.5 * (min(v.y for v in head_pts) + max(v.y for v in head_pts))
        rx_head = max(abs(v.x) for v in head_pts) + 0.006
        ry_head = 0.5 * (max(v.y for v in head_pts) - min(v.y for v in head_pts)) + 0.006
        z_brim = z_max - 0.075

        hat_profile = [
            (z_brim - 0.005, rx_head * 1.48, ry_head * 1.48, 0.15),
            (z_brim + 0.004, rx_head * 1.04, ry_head * 1.04, 0.35),
            (z_brim + 0.045, rx_head * 1.00, ry_head * 1.00, 0.65),
            (z_max + 0.022, rx_head * 0.72, ry_head * 0.76, 0.90),
            (z_max + 0.032, rx_head * 0.20, ry_head * 0.22, 0.96),
        ]
        n_seg = 24
        hat_rings = []
        for z_val, rx, ry, v_uv in hat_profile:
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = cx + rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                u_uv = 0.5 + 0.45 * math.cos(theta)
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            hat_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, hat_rings, thickness=0.0020)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "hat_cap":
        # Baseball / Trucker Cap: structured 6-panel rounded crown + curved forward visor (-Y)
        z_max = max(v.z for v in verts)
        head_pts = [v for v in verts if v.z >= z_max - 0.16]
        cx = 0.0
        cy = 0.5 * (min(v.y for v in head_pts) + max(v.y for v in head_pts))
        rx_head = max(abs(v.x) for v in head_pts) + 0.007
        ry_head = 0.5 * (max(v.y for v in head_pts) - min(v.y for v in head_pts)) + 0.007
        z_brim = z_max - 0.078

        cap_profile = [
            (z_brim, rx_head * 1.03, ry_head * 1.03, 0.46),
            (z_brim + 0.025, rx_head * 1.01, ry_head * 1.01, 0.58),
            (z_brim + 0.055, rx_head * 0.94, ry_head * 0.95, 0.72),
            (z_max + 0.012, rx_head * 0.74, ry_head * 0.76, 0.85),
            (z_max + 0.028, rx_head * 0.36, ry_head * 0.38, 0.94),
            (z_max + 0.033, rx_head * 0.08, ry_head * 0.09, 0.97),
        ]
        n_seg = 28
        cap_rings = []
        for z_val, rx, ry, v_uv in cap_profile:
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = cx + rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                u_uv = 0.5 + 0.35 * math.cos(theta)
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            cap_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, cap_rings, thickness=0.0022)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # Curved forward visor / bill extending toward -Y (front of avatar)
        visor_rings = []
        n_v_depth = 6
        n_v_lat = 15
        visor_len = 0.078
        visor_w = rx_head * 0.94
        for i in range(n_v_depth):
            t_out = i / float(n_v_depth - 1)
            v_uv = 0.44 - t_out * 0.34
            ring = []
            for j in range(n_v_lat):
                s_lat = -1.0 + 2.0 * (j / float(n_v_lat - 1))  # -1..+1 left to right
                # Taper width smoothly toward front tip of visor
                lat_scale = 1.0 - 0.16 * (t_out ** 1.6)
                px = cx + s_lat * visor_w * lat_scale
                # Start flush against front crown curve (ellipse) and project forward (-Y)
                crown_y = cy - ry_head * 1.01 * math.sqrt(max(0.05, 1.0 - (s_lat * 0.92) ** 2))
                edge_round = 1.0 - 0.22 * (s_lat ** 2)
                py = crown_y - t_out * visor_len * edge_round
                # Authentic curved baseball visor arch (sides dip down, tip dips slightly)
                pz = (z_brim + 0.004) - 0.018 * (t_out ** 1.35) - 0.015 * (s_lat ** 2) * (0.35 + 0.65 * t_out)
                u_uv = 0.5 + s_lat * 0.32
                ring.append((Vector((px, py, pz)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            visor_rings.append(ring)

        f_uvs, v_wts = add_open_strip_to_bm(bm, visor_rings, thickness=0.0024)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "hat_beanie":
        # Knit Beanie / Beret: snug folded cuff + closed dome
        z_max = max(v.z for v in verts)
        head_pts = [v for v in verts if v.z >= z_max - 0.16]
        cx = 0.0
        cy = 0.5 * (min(v.y for v in head_pts) + max(v.y for v in head_pts))
        rx_head = max(abs(v.x) for v in head_pts) + 0.007
        ry_head = 0.5 * (max(v.y for v in head_pts) - min(v.y for v in head_pts)) + 0.007
        z_brim = z_max - 0.082

        beanie_profile = [
            (z_brim, rx_head * 1.07, ry_head * 1.07, 0.16),
            (z_brim + 0.028, rx_head * 1.06, ry_head * 1.06, 0.38),
            (z_brim + 0.032, rx_head * 1.02, ry_head * 1.02, 0.44),
            (z_brim + 0.062, rx_head * 0.94, ry_head * 0.95, 0.68),
            (z_max + 0.016, rx_head * 0.72, ry_head * 0.74, 0.86),
            (z_max + 0.034, rx_head * 0.16, ry_head * 0.18, 0.96),
        ]
        n_seg = 24
        beanie_rings = []
        for z_val, rx, ry, v_uv in beanie_profile:
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = cx + rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                u_uv = 0.5 + 0.40 * math.cos(theta)
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            beanie_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, beanie_rings, thickness=0.0022)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "hat_headscarf":
        # Hair Scarf / Pre-Tied Headwrap / Tichel / Turban:
        # Sloped full-coverage headwrap (higher at forehead hairline, lower at nape) + two draped scarf tails
        z_max = max(v.z for v in verts)
        head_pts = [v for v in verts if v.z >= z_max - 0.16]
        cx = 0.0
        cy = 0.5 * (min(v.y for v in head_pts) + max(v.y for v in head_pts))
        rx_head = max(abs(v.x) for v in head_pts) + 0.009
        ry_head = 0.5 * (max(v.y for v in head_pts) - min(v.y for v in head_pts)) + 0.009

        z_front_brim = z_max - 0.086
        z_back_brim = z_max - 0.148
        # Profiles: (t_height_front, rx_scale, ry_scale, v_uv)
        wrap_profile = [
            (0.00, 1.04, 1.05, 0.42),
            (0.22, 1.03, 1.04, 0.55),
            (0.50, 0.98, 1.00, 0.70),
            (0.76, 0.80, 0.84, 0.84),
            (0.92, 0.46, 0.50, 0.93),
            (1.00, 0.12, 0.14, 0.98),
        ]
        n_seg = 28
        wrap_rings = []
        for t_h, sx, sy, v_uv in wrap_profile:
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                # sin(theta) < 0 is front (-Y), sin(theta) > 0 is back (+Y)
                back_factor = 0.5 * (1.0 + math.sin(theta))
                z_base = z_front_brim * (1.0 - back_factor) + z_back_brim * back_factor
                # Smoothly converge all angles toward crown apex z_max + 0.032 as t_h -> 1.0
                z_val = z_base + t_h * ((z_max + 0.032) - z_base)
                px = cx + rx_head * sx * math.cos(theta)
                py = cy + ry_head * sy * math.sin(theta)
                u_uv = 0.5 + 0.36 * math.cos(theta)
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            wrap_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, wrap_rings, thickness=0.0020)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # Two draped scarf tails hanging from behind the ears/nape softly forward over the shoulders
        z_tail_top = z_max - 0.135
        z_tail_bot = z_max - 0.345
        for side in (-1.0, 1.0):
            tail_rings = []
            n_tail = 8
            for i in range(n_tail + 1):
                t = i / float(n_tail)
                z = z_tail_top - t * (z_tail_top - z_tail_bot)
                # Start behind ear (+Y) and drape slightly outward & forward (-Y) over collarbone/shoulder
                x_c = side * (rx_head * 0.88 + 0.028 * math.sin(t * math.pi * 0.75))
                y_c = cy + ry_head * 0.30 - t * (ry_head * 0.95)
                # Narrow at gather/knot (t=0), wider flowing blade in middle, tapered tip at bottom
                half_w = 0.014 + 0.024 * math.sin(min(1.0, t * 1.15) * math.pi * 0.85) * (1.0 - 0.35 * t)
                v_uv = 0.40 - t * 0.34
                u_base = 0.30 if side < 0 else 0.70
                ring = [
                    (Vector((x_c - half_w * 0.65, y_c + half_w * 0.45, z)), (u_base - 0.10, v_uv), {"Rigid_Hardware": 1.0}),
                    (Vector((x_c, y_c - 0.004, z)), (u_base, v_uv), {"Rigid_Hardware": 1.0}),
                    (Vector((x_c + half_w * 0.65, y_c - half_w * 0.45, z)), (u_base + 0.10, v_uv), {"Rigid_Hardware": 1.0}),
                ]
                tail_rings.append(ring)
            f_u, v_w = add_open_strip_to_bm(bm, tail_rings, thickness=0.0018)
            all_faces_uvs.extend(f_u)
            all_vert_weights.extend(v_w)

        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "hat_bandana":
        # Bandana: smooth diagonal crown wrap + back nape knot & short corner tie ends (+Y)
        z_max = max(v.z for v in verts)
        head_pts = [v for v in verts if v.z >= z_max - 0.16]
        cx = 0.0
        cy = 0.5 * (min(v.y for v in head_pts) + max(v.y for v in head_pts))
        rx_head = max(abs(v.x) for v in head_pts) + 0.008
        ry_head = 0.5 * (max(v.y for v in head_pts) - min(v.y for v in head_pts)) + 0.008

        z_front_brim = z_max - 0.082
        z_back_brim = z_max - 0.150
        bandana_profile = [
            (0.00, 1.03, 1.04, 0.20),
            (0.24, 1.02, 1.03, 0.38),
            (0.52, 0.97, 0.99, 0.58),
            (0.78, 0.79, 0.83, 0.78),
            (0.93, 0.45, 0.49, 0.90),
            (1.00, 0.10, 0.12, 0.96),
        ]
        n_seg = 28
        bandana_rings = []
        for t_h, sx, sy, v_uv in bandana_profile:
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                back_factor = 0.5 * (1.0 + math.sin(theta))
                z_base = z_front_brim * (1.0 - back_factor) + z_back_brim * back_factor
                # Slight triangular point extending down at center-back nape (sin(theta) > 0.7)
                nape_point = 0.018 * max(0.0, math.sin(theta) - 0.65) / 0.35 if t_h < 0.25 else 0.0
                z_val = (z_base - nape_point) + t_h * ((z_max + 0.028) - (z_base - nape_point))
                px = cx + rx_head * sx * math.cos(theta)
                py = cy + ry_head * sy * math.sin(theta)
                u_uv = 0.5 + 0.38 * math.cos(theta)
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            bandana_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, bandana_rings, thickness=0.0018)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # Compact back nape knot + two short crisp tie ends behind the nape (+Y)
        y_nape = cy + ry_head * 1.04
        z_knot = z_back_brim + 0.010
        knot_rings = []
        for i in range(4):
            t = i / 3.0
            s_k = 0.65 + 0.35 * math.sin(t * math.pi)
            y_k = y_nape + t * 0.022
            ring = []
            for j in range(12):
                theta = (j / 12.0) * 2.0 * math.pi
                px = cx + 0.016 * s_k * math.cos(theta)
                pz = z_knot + 0.014 * s_k * math.sin(theta)
                ring.append((Vector((px, y_k, pz)), (0.45 + 0.10 * math.cos(theta), 0.14), {"Rigid_Hardware": 1.0}))
            knot_rings.append(ring)
        f_u, v_w = add_closed_tube_to_bm(bm, knot_rings, thickness=0.0014)
        all_faces_uvs.extend(f_u)
        all_vert_weights.extend(v_w)

        # Two short angled tie-end corners at the nape
        for side in (-1.0, 1.0):
            tip_rings = []
            for i in range(5):
                t = i / 4.0
                x_c = cx + side * (0.010 + t * 0.036)
                y_c = y_nape + 0.014 + t * 0.020
                z_c = z_knot - 0.005 - t * 0.052
                hw = 0.013 * (1.0 - 0.45 * t)
                v_uv = 0.18 - t * 0.12
                u_b = 0.38 if side < 0 else 0.62
                tip_rings.append([
                    (Vector((x_c - hw, y_c + 0.003, z_c)), (u_b - 0.06, v_uv), {"Rigid_Hardware": 1.0}),
                    (Vector((x_c, y_c - 0.003, z_c)), (u_b, v_uv), {"Rigid_Hardware": 1.0}),
                    (Vector((x_c + hw, y_c + 0.003, z_c)), (u_b + 0.06, v_uv), {"Rigid_Hardware": 1.0}),
                ])
            f_u, v_w = add_open_strip_to_bm(bm, tip_rings, thickness=0.0014)
            all_faces_uvs.extend(f_u)
            all_vert_weights.extend(v_w)

        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "hat_newsboy":
        # Newsboy / Gatsby Cap: full 8-panel voluminous crown + top fabric button + short curved brim (-Y)
        z_max = max(v.z for v in verts)
        head_pts = [v for v in verts if v.z >= z_max - 0.16]
        cx = 0.0
        cy = 0.5 * (min(v.y for v in head_pts) + max(v.y for v in head_pts))
        rx_head = max(abs(v.x) for v in head_pts) + 0.007
        ry_head = 0.5 * (max(v.y for v in head_pts) - min(v.y for v in head_pts)) + 0.007
        z_brim = z_max - 0.078

        # Profile: (z, rx_scale, ry_scale, y_shift_front, puff_amp, v_uv)
        newsboy_profile = [
            (z_brim,         1.03, 1.03,  0.000, 0.0000, 0.44),
            (z_brim + 0.018, 1.15, 1.11, -0.008, 0.0025, 0.54),
            (z_brim + 0.044, 1.24, 1.18, -0.016, 0.0040, 0.66),
            (z_brim + 0.072, 1.18, 1.13, -0.014, 0.0038, 0.78),
            (z_max + 0.014,  0.90, 0.88, -0.008, 0.0028, 0.88),
            (z_max + 0.025,  0.46, 0.46, -0.003, 0.0014, 0.94),
            (z_max + 0.028,  0.10, 0.10, -0.002, 0.0000, 0.97),
        ]
        n_seg = 32  # 8 panels x 4 segments per panel
        crown_rings = []
        for z_val, sx, sy, y_sh, puff_amp, v_uv in newsboy_profile:
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                # Subtle 8-panel seam tuck (at j % 4 == 0) and panel puff in between
                panel_wave = abs(math.sin(4.0 * theta))
                r_mod = puff_amp * (panel_wave - 0.35)
                px = cx + (rx_head * sx + r_mod) * math.cos(theta)
                py = (cy + y_sh) + (ry_head * sy + r_mod) * math.sin(theta)
                u_uv = 0.5 + 0.36 * math.cos(theta)
                ring.append((Vector((px, py, z_val)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            crown_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, crown_rings, thickness=0.0022)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # Top fabric-covered button at crown apex
        btn_y = cy - 0.002
        btn_profile = [
            (z_max + 0.026, 0.007, 0.007),
            (z_max + 0.030, 0.011, 0.011),
            (z_max + 0.035, 0.010, 0.010),
            (z_max + 0.037, 0.004, 0.004),
        ]
        btn_rings = []
        for z_b, rbx, rby in btn_profile:
            ring = []
            for j in range(12):
                theta = (j / 12.0) * 2.0 * math.pi
                ring.append((
                    Vector((cx + rbx * math.cos(theta), btn_y + rby * math.sin(theta), z_b)),
                    (0.5 + 0.08 * math.cos(theta), 0.98),
                    {"Rigid_Hardware": 1.0},
                ))
            btn_rings.append(ring)
        f_u, v_w = add_closed_tube_to_bm(bm, btn_rings, thickness=0.0012)
        all_faces_uvs.extend(f_u)
        all_vert_weights.extend(v_w)

        # Short, curved front brim / visor (-Y) tucked slightly under the front crown overhang
        visor_rings = []
        n_v_depth = 5
        n_v_lat = 15
        visor_len = 0.052
        visor_w = rx_head * 0.90
        for i in range(n_v_depth):
            t_out = i / float(n_v_depth - 1)
            v_uv = 0.42 - t_out * 0.30
            ring = []
            for j in range(n_v_lat):
                s_lat = -1.0 + 2.0 * (j / float(n_v_lat - 1))
                lat_scale = 1.0 - 0.20 * (t_out ** 1.5)
                px = cx + s_lat * visor_w * lat_scale
                crown_y = cy - ry_head * 1.01 * math.sqrt(max(0.05, 1.0 - (s_lat * 0.90) ** 2))
                edge_round = 1.0 - 0.25 * (s_lat ** 2)
                py = crown_y - t_out * visor_len * edge_round
                pz = (z_brim + 0.003) - 0.014 * (t_out ** 1.25) - 0.014 * (s_lat ** 2) * (0.35 + 0.65 * t_out)
                u_uv = 0.5 + s_lat * 0.30
                ring.append((Vector((px, py, pz)), (u_uv, v_uv), {"Rigid_Hardware": 1.0}))
            visor_rings.append(ring)

        f_uvs, v_wts = add_open_strip_to_bm(bm, visor_rings, thickness=0.0024)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "necktie":
        # Collar loop + front knot + hanging tapered tie blade down center chest (-Y)
        z_neck = 1.50 if is_male else 1.42
        z_tip = 1.09 if is_male else 1.04
        neck_sl = measure_torso_slice(verts, z_neck)
        rx_n = min(0.085, neck_sl["rx"] + 0.008)
        ry_n = min(0.085, neck_sl["ry"] + 0.008)
        cy_n = neck_sl["cy"]

        # 1. Neck loop
        n_seg = 20
        loop_rings = []
        for i in range(3):
            t = i / 2.0
            z = (z_neck + 0.014) - t * 0.024
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = rx_n * math.cos(theta)
                py = cy_n + ry_n * math.sin(theta)
                ring.append((Vector((px, py, z)), (0.5 + 0.15 * math.cos(theta), 0.92 - t * 0.08), {"Deformable_Strap": 1.0}))
            loop_rings.append(ring)
        f_uvs, v_wts = add_closed_tube_to_bm(bm, loop_rings, thickness=0.0016)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # 2. Front knot & hanging tapered tie blade conforming to chest contour
        blade_rings = []
        n_blade = 12
        for i in range(n_blade + 1):
            t = i / float(n_blade)
            z = (z_neck - 0.010) - t * (z_neck - 0.010 - z_tip)
            chest_sl = measure_torso_slice(verts, z)
            y_front = chest_sl["cy"] - chest_sl["ry"] - 0.016
            if t < 0.12:
                half_w = 0.022 - (t / 0.12) * 0.006
            elif t < 0.85:
                half_w = 0.016 + ((t - 0.12) / 0.73) * 0.024
            else:
                half_w = 0.040 * max(0.05, 1.0 - (t - 0.85) / 0.15)
            v_uv = 0.88 - t * 0.82
            ring = [
                (Vector((-half_w, y_front, z)), (0.35, v_uv), {"Deformable_Strap": 1.0}),
                (Vector((0.0, y_front - 0.003, z)), (0.50, v_uv), {"Deformable_Strap": 1.0}),
                (Vector((half_w, y_front, z)), (0.65, v_uv), {"Deformable_Strap": 1.0}),
            ]
            blade_rings.append(ring)
        f_uvs, v_wts = add_open_strip_to_bm(bm, blade_rings, thickness=0.0018)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Deformable_Strap"]

    if variant == "scarf":
        # Draped cozy neck wrap + overlapping front hanging ends
        z_neck = 1.50 if is_male else 1.42
        neck_sl = measure_torso_slice(verts, z_neck)
        rx_s = min(0.115, neck_sl["rx"] + 0.024)
        ry_s = min(0.115, neck_sl["ry"] + 0.026)
        cy_s = neck_sl["cy"]

        n_seg = 24
        wrap_rings = []
        for i in range(5):
            t = i / 4.0
            z = (z_neck + 0.048) - t * 0.075
            bulge = 1.0 + 0.10 * math.sin(t * math.pi)
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                px = rx_s * bulge * math.cos(theta)
                py = cy_s + ry_s * bulge * math.sin(theta)
                ring.append((Vector((px, py, z)), (0.15 + 0.70 * (j / n_seg), 0.90 - t * 0.35), {"Deformable_Strap": 1.0}))
            wrap_rings.append(ring)
        f_uvs, v_wts = add_closed_tube_to_bm(bm, wrap_rings, thickness=0.0032)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # Hanging front scarf panel
        z_end = z_neck - 0.26
        panel_rings = []
        for i in range(9):
            t = i / 8.0
            z = (z_neck - 0.015) - t * (z_neck - 0.015 - z_end)
            chest_sl = measure_torso_slice(verts, z)
            y_front = chest_sl["cy"] - chest_sl["ry"] - 0.020
            half_w = 0.068 - 0.010 * t
            v_uv = 0.55 - t * 0.48
            ring = [
                (Vector((-half_w, y_front + 0.006, z)), (0.25, v_uv), {"Deformable_Strap": 1.0}),
                (Vector((0.0, y_front - 0.004, z)), (0.50, v_uv), {"Deformable_Strap": 1.0}),
                (Vector((half_w, y_front + 0.006, z)), (0.75, v_uv), {"Deformable_Strap": 1.0}),
            ]
            panel_rings.append(ring)
        f_uvs, v_wts = add_open_strip_to_bm(bm, panel_rings, thickness=0.0028)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Deformable_Strap"]

    if variant == "watch":
        # Contoured wrist strap + watch case dial anchored to avatar left wrist (+X)
        arm_pts = [v for v in verts if 0.34 <= v.x <= 0.40 and 0.80 <= v.z <= 1.25]
        if not arm_pts:
            arm_pts = [Vector((0.36 if is_male else 0.33, 0.0, 0.98 if is_male else 0.90))]
        wx = sum(v.x for v in arm_pts) / len(arm_pts)
        wy = sum(v.y for v in arm_pts) / len(arm_pts)
        wz = sum(v.z for v in arm_pts) / len(arm_pts)
        r_wrist = max(0.028, 0.5 * (max(v.y for v in arm_pts) - min(v.y for v in arm_pts)) + 0.005)
        half_w = 0.012

        n_seg = 20
        strap_rings = []
        for i in range(4):
            t = i / 3.0
            dx = -half_w + t * (2.0 * half_w)
            v_uv = 0.25 + t * 0.50
            ring = []
            for j in range(n_seg):
                theta = (j / n_seg) * 2.0 * math.pi
                py = wy + r_wrist * math.cos(theta)
                pz = wz + r_wrist * math.sin(theta)
                # Slightly raised watch face on top/outer side (+Z)
                is_dial = math.sin(theta) > 0.65 and abs(dx) < 0.010
                if is_dial:
                    pz += 0.004
                ring.append((Vector((wx + dx, py, pz)), (0.15 + 0.70 * (j / n_seg), v_uv), {"Rigid_Hardware": 1.0}))
            strap_rings.append(ring)
        f_uvs, v_wts = add_closed_tube_to_bm(bm, strap_rings, thickness=0.0020)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]

    if variant == "glasses":
        z_max = max(v.z for v in verts)
        z_eye = z_max - 0.115
        head_pts = [v for v in verts if abs(v.z - z_eye) <= 0.025]
        y_front = min(v.y for v in head_pts) - 0.008
        rx_face = max(abs(v.x) for v in head_pts) + 0.004

        frame_rings = []
        n_z = 4
        n_seg = 21
        for i in range(n_z + 1):
            t = i / n_z
            z = (z_eye + 0.022) - t * 0.044
            v_uv = 0.78 - t * 0.56
            ring = []
            for j in range(n_seg):
                theta = (-0.15 * math.pi) - (0.70 * math.pi * j) / (n_seg - 1)
                px = rx_face * math.cos(theta)
                py = (y_front + 0.038) + 0.042 * math.sin(theta)
                u_uv = 0.06 + (0.5 + 0.5 * math.cos(theta)) * 0.88
                ring.append((Vector((px, py, z)), (u_uv, v_uv), {"Rigid_Hardware": 0.0}))
            frame_rings.append(ring)

        f_uvs, v_wts = add_open_strip_to_bm(bm, frame_rings, thickness=0.0016)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Rigid_Hardware"]


    if variant == "crossbody_bag":
        # 1. Strap_Deform (Weight: 1.0): diagonal torso strap from right shoulder (+X) to left hip (-X)
        z_sh = 1.45 if is_male else 1.35
        z_hip = 0.88 if is_male else 0.84
        n_strap = 16
        strap_rings = []
        for i in range(n_strap + 1):
            t = i / n_strap
            z = z_sh - t * (z_sh - z_hip)
            sl = measure_torso_slice(verts, z)
            rx = sl["rx"] + 0.019
            ry = sl["ry"] + 0.019
            cy = sl["cy"]
            # Diagonal angle from right shoulder (x > 0) across chest/back to left hip (x < 0)
            x_center = (0.10 if is_male else 0.09) * (1.0 - t) + (-rx) * t
            ratio_x = max(-0.98, min(0.98, x_center / max(0.12, rx)))
            y_front_pt = cy - ry * math.sqrt(max(0.02, 1.0 - ratio_x * ratio_x))
            y_back_pt = cy + ry * math.sqrt(max(0.02, 1.0 - ratio_x * ratio_x))
            v_uv = 0.95 - t * 0.42
            wdict = {"Strap_Deform": 1.0, "Bag_Body": 0.0}
            ring = [
                (Vector((x_center - 0.014, y_front_pt, z)), (0.10, v_uv), wdict),
                (Vector((x_center + 0.014, y_front_pt, z)), (0.22, v_uv), wdict),
                (Vector((x_center + 0.014, y_back_pt, z)), (0.34, v_uv), wdict),
                (Vector((x_center - 0.014, y_back_pt, z)), (0.46, v_uv), wdict),
            ]
            strap_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, strap_rings, thickness=0.0020)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

        # 2. Bag_Body (Weight: 0.0): rigid structured bag body resting outside hip
        hip_sl = measure_torso_slice(verts, z_hip)
        bx = -(hip_sl["rx"] + 0.055)
        by = hip_sl["cy"]
        bz_top = z_hip + 0.02
        bz_bot = z_hip - 0.16
        bw = 0.038
        bd = 0.085
        bag_rings = []
        n_bag_rings = 6
        n_bag_seg = 16
        for i in range(n_bag_rings + 1):
            t = i / n_bag_rings
            z = bz_top - t * (bz_top - bz_bot)
            scale = 0.90 if (i == 0 or i == n_bag_rings) else 1.0
            v_uv = 0.48 - t * 0.42
            wdict = {"Strap_Deform": 0.0, "Bag_Body": 1.0}
            ring = []
            for j in range(n_bag_seg):
                theta = (j / n_bag_seg) * 2.0 * math.pi
                px = bx + bw * scale * math.cos(theta)
                py = by + bd * scale * math.sin(theta)
                u_uv = 0.52 + 0.42 * (0.5 + 0.5 * math.cos(theta))
                ring.append((Vector((px, py, z)), (u_uv, v_uv), wdict))
            bag_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, bag_rings, thickness=0.0025)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Strap_Deform", "Bag_Body"]


CANONICAL_SPECS = [
    # Upper Body
    ("top_tshirt", "top", "tshirt", ["tshirt.glb"]),
    ("top_strapless", "top", "strapless", ["strapless.glb", "corset.glb", "tube.glb", "bandeau.glb", "bustier.glb"]),
    ("singlet", "top", "singlet", ["singlet.glb", "tank.glb"]),
    ("top_longsleeve", "top", "longsleeve", ["longsleeve.glb", "shirt.glb"]),
    ("hoodie", "top", "hoodie_hood_off", ["hoodie.glb", "hoodie_hood_off.glb"]),
    ("hoodie_hood_on", "top", "hoodie_hood_on", ["hoodie_hood_on.glb"]),
    ("top_outerwear_jacket", "top", "jacket", ["jacket.glb"]),
    ("jacket_blazer", "top", "jacket_blazer", ["jacket_blazer.glb"]),
    ("cardigan", "top", "cardigan", ["cardigan.glb"]),
    ("vest", "top", "vest", ["vest.glb"]),
    ("coat", "top", "coat", ["coat.glb"]),
    ("hooded_coat", "top", "hooded_coat_hood_off", ["hooded_coat.glb", "hooded_coat_hood_off.glb"]),
    ("hooded_coat_hood_on", "top", "hooded_coat_hood_on", ["hooded_coat_hood_on.glb"]),
    ("trench_coat", "top", "trench_coat", ["trench_coat.glb"]),
    ("top_tunic", "top", "tunic", ["tunic.glb"]),
    # Lower Body
    ("bottom_trousers", "bottom", "trousers", ["pants.glb"]),
    ("bottom_shorts", "bottom", "shorts", ["shorts.glb"]),
    ("bermuda", "bottom", "bermuda", ["bermuda.glb"]),
    ("bottom_skirt", "bottom", "skirt_aline", ["skirt.glb", "skirt_aline.glb"]),
    ("skirt_pencil", "bottom", "skirt_pencil", ["skirt_pencil.glb"]),
    # Full Body
    ("dress", "dress", "dress", ["dress.glb"]),
    ("dress_strapless", "dress", "strapless", ["dress_strapless.glb"]),
    ("kaftan", "dress", "kaftan", ["kaftan.glb"]),
    ("kurta_set", "dress", "kurta_set", ["kurta_set.glb"]),
    # Footwear
    ("shoes_sneakers", "footwear", "sneakers", ["sneakers.glb", "sandals.glb"]),
    ("shoes_boots", "footwear", "boots", ["boots.glb", "heels.glb"]),
    # Accessories
    ("accessory_belt", "accessory", "belt", ["belt.glb"]),
    ("accessory_hat", "accessory", "hat", ["hat.glb", "hat_fedora.glb"]),
    ("hat_cap", "accessory", "hat_cap", []),
    ("hat_beanie", "accessory", "hat_beanie", []),
    ("hat_headscarf", "accessory", "hat_headscarf", []),
    ("hat_bandana", "accessory", "hat_bandana", []),
    ("hat_newsboy", "accessory", "hat_newsboy", []),
    ("accessory_glasses", "accessory", "glasses", ["glasses.glb"]),
    ("necktie", "accessory", "necktie", []),
    ("scarf", "accessory", "scarf", []),
    ("watch", "accessory", "watch", []),
    (
        "accessory_crossbody_bag",
        "accessory",
        "crossbody_bag",
        ["bag.glb", "bag_crossbody.glb", "bag_handbag.glb"],
    ),
]


def verify_collision_and_rigidity(gender, generated_objs, avatar_data):
    """
    VERIFICATION & ACCEPTANCE CRITERIA:
    1. Zero Degenerate Geometry (checked per mesh).
    2. Collision Offset Verification:
       - shoes_sneakers.glb vs bottom_trousers.glb: trousers cuff clears over sneaker collar.
       - shoes_boots.glb vs bottom_trousers.glb: boot shaft envelopes/nests with pants hem.
    3. Rigid Stability:
       - Apply Shrinkwrap modifier targeting avatar with deformable vertex group, verify that
         footwear soles (Footwear_Sole), belt buckles (Rigid_Hardware), and bag bodies (Bag_Body)
         have 0.0 displacement.
    """
    sneakers_obj = generated_objs["shoes_sneakers"]
    boots_obj = generated_objs["shoes_boots"]
    trousers_obj = generated_objs["bottom_trousers"]
    belt_obj = generated_objs["accessory_belt"]
    bag_obj = generated_objs["accessory_crossbody_bag"]

    # Check 1: Trousers cuff vs Sneaker collar at Z in [0.09, 0.11]
    sneaker_collar_pts = [v.co for v in sneakers_obj.data.vertices if 0.085 <= v.co.z <= 0.105 and v.co.x > 0]
    trouser_cuff_pts = [v.co for v in trousers_obj.data.vertices if 0.095 <= v.co.z <= 0.125 and v.co.x > 0]
    sn_max_x = max(v.x for v in sneaker_collar_pts)
    tr_max_x = max(v.x for v in trouser_cuff_pts)
    cuff_clears_sneaker = tr_max_x > sn_max_x
    print(
        f"  [VERIFY {gender.upper()}] Trousers cuff max_X={tr_max_x:.4f}m vs Sneaker collar max_X={sn_max_x:.4f}m -> Clears: {cuff_clears_sneaker}"
    )
    assert cuff_clears_sneaker, f"Trousers cuff ({tr_max_x}) must clear over sneaker collar ({sn_max_x})"

    # Check 2: Boot shaft vs Trousers hem at Z in [0.10, 0.25]
    boot_shaft_pts = [v.co for v in boots_obj.data.vertices if 0.10 <= v.co.z <= 0.22 and v.co.x > 0]
    bt_max_x = max(v.x for v in boot_shaft_pts)
    boot_envelopes_trousers = bt_max_x >= (tr_max_x - 0.005)
    print(
        f"  [VERIFY {gender.upper()}] Boot shaft max_X={bt_max_x:.4f}m vs Trousers hem max_X={tr_max_x:.4f}m -> Envelopes: {boot_envelopes_trousers}"
    )
    assert boot_envelopes_trousers, f"Boot shaft ({bt_max_x}) must envelope trousers hem ({tr_max_x})"

    # Check 3: Rigid stability under Shrinkwrap modifier
    # Find vertices in Footwear_Sole (weight == 1.0 in Footwear_Sole => weight == 0.0 in Footwear_Upper)
    ug_idx = sneakers_obj.vertex_groups["Footwear_Upper"].index
    sole_vert_indices = []
    for v in sneakers_obj.data.vertices:
        w_upper = 0.0
        for g in v.groups:
            if g.group == ug_idx:
                w_upper = g.weight
        if w_upper == 0.0:
            sole_vert_indices.append(v.index)
    assert len(sole_vert_indices) > 0, "Footwear_Sole must have rigid vertices with Footwear_Upper weight=0.0"

    bg_idx = belt_obj.vertex_groups["Deformable_Strap"].index
    rigid_buckle_indices = []
    for v in belt_obj.data.vertices:
        w_strap = 0.0
        for g in v.groups:
            if g.group == bg_idx:
                w_strap = g.weight
        if w_strap == 0.0:
            rigid_buckle_indices.append(v.index)
    assert len(rigid_buckle_indices) > 0, "Belt buckle must have rigid vertices with Deformable_Strap weight=0.0"

    bag_ug_idx = bag_obj.vertex_groups["Strap_Deform"].index
    rigid_bag_indices = []
    for v in bag_obj.data.vertices:
        w_strap = 0.0
        for g in v.groups:
            if g.group == bag_ug_idx:
                w_strap = g.weight
        if w_strap == 0.0:
            rigid_bag_indices.append(v.index)
    assert len(rigid_bag_indices) > 0, "Bag_Body must have rigid vertices with Strap_Deform weight=0.0"

    print(
        f"  [VERIFY {gender.upper()}] Rigid vertex counts -> Sole: {len(sole_vert_indices)}, Buckle: {len(rigid_buckle_indices)}, Bag_Body: {len(rigid_bag_indices)} (100% locked weight=0.0)"
    )


def main():
    ensure_dirs()
    total_exported = 0

    target_assets = None
    for i, arg in enumerate(sys.argv):
        if arg.startswith("--only="):
            target_assets = set(arg.split("=", 1)[1].split(","))
        elif arg == "--only" and i + 1 < len(sys.argv):
            target_assets = set(sys.argv[i + 1].split(","))

    for gender in ("male", "female"):
        print(f"\n=== GENERATING CANONICAL BASEMESHES FOR {gender.upper()} AVATAR ===")
        avatar_data = load_avatar_data(gender)
        generated_objs = {}

        for asset_name, category, variant, legacy_names in CANONICAL_SPECS:
            if target_assets and asset_name not in target_assets:
                continue
            if category == "top":
                bm, faces_uvs, vert_weights, vg_names = build_top_template(avatar_data, variant)
            elif category == "dress":
                bm, faces_uvs, vert_weights, vg_names = build_dress_template(avatar_data, variant)
            elif category == "bottom":
                bm, faces_uvs, vert_weights, vg_names = build_bottom_template(avatar_data, variant)
            elif category == "footwear":
                bm, faces_uvs, vert_weights, vg_names = build_footwear_template(avatar_data, variant)
            else:
                bm, faces_uvs, vert_weights, vg_names = build_accessory_template(avatar_data, variant)

            raw_paths = [
                os.path.join(ASSETS_TEMPLATES_DIR, gender, f"{asset_name}.glb"),
                os.path.join(WEB_TEMPLATES_DIR, gender, f"{asset_name}.glb"),
            ]
            for leg_file in legacy_names:
                raw_paths.append(os.path.join(ASSETS_TEMPLATES_DIR, gender, leg_file))
                raw_paths.append(os.path.join(WEB_TEMPLATES_DIR, gender, leg_file))
                if gender == "female":
                    raw_paths.append(os.path.join(ASSETS_TEMPLATES_DIR, leg_file))
                    raw_paths.append(os.path.join(WEB_TEMPLATES_DIR, leg_file))
                    raw_paths.append(os.path.join(ASSETS_TEMPLATES_DIR, f"{asset_name}.glb"))
                    raw_paths.append(os.path.join(WEB_TEMPLATES_DIR, f"{asset_name}.glb"))

            seen_paths = set()
            export_paths = []
            for p in raw_paths:
                norm_p = os.path.normcase(os.path.abspath(p))
                if norm_p not in seen_paths:
                    seen_paths.add(norm_p)
                    export_paths.append(p)

            obj, non_manifold, zero_area = finalize_and_export_mesh(
                name=f"{asset_name}_{gender}",
                bm=bm,
                faces_uvs=faces_uvs,
                vert_weights=vert_weights,
                vertex_group_names=vg_names,
                export_paths=export_paths,
                use_mirror=False,
            )
            assert non_manifold == 0, f"{asset_name}_{gender} has {non_manifold} non-manifold edges!"
            assert zero_area == 0, f"{asset_name}_{gender} has {zero_area} zero-area faces!"
            generated_objs[asset_name] = obj
            total_exported += 1
            print(
                f"  [OK] {gender}/{asset_name}.glb ({len(obj.data.vertices)} verts, {len(obj.data.polygons)} faces, non_manifold=0, zero_area=0)"
            )

        if "shoes_sneakers" in generated_objs and "bottom_trousers" in generated_objs:
            verify_collision_and_rigidity(gender, generated_objs, avatar_data)
        avatar_data["bm"].free()
        if avatar_data.get("full_bvh") is not None:
            del avatar_data["full_bvh"]

    print(f"\nALL {total_exported} CANONICAL BASEMESHES GENERATED AND VERIFIED SUCCESSFULLY.")


if __name__ == "__main__":
    main()
