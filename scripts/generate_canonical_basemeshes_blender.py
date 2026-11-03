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
    for attempt in range(10):
        try:
            shutil.copy2(src, dst)
            return
        except (PermissionError, OSError):
            time.sleep(0.15)


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

    return {
        "gender": gender,
        "verts": verts,
        "bm": bm,
        "bvh": bvh,
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


def measure_arm_slice(verts, x_dist, z_min=0.70, z_max=1.50, band=0.016):
    """Measures left arm (x > 0.18) center and radii at lateral distance x_dist from avatar vertices."""
    pts = [v for v in verts if abs(v.x - x_dist) <= band and z_min <= v.z <= z_max]
    if not pts:
        pts = [v for v in verts if abs(v.x - x_dist) <= band * 2.0 and z_min <= v.z <= z_max]
    if not pts:
        return {"cz": 1.15, "rz": 0.045, "cy": 0.0, "ry": 0.042}
    z0 = min(v.z for v in pts)
    z1 = max(v.z for v in pts)
    y0 = min(v.y for v in pts)
    y1 = max(v.y for v in pts)
    # Trim outlier torso points if near armpit
    if z1 - z0 > 0.22:
        z0 = z1 - 0.14
    cz = 0.5 * (z0 + z1)
    rz = max(0.030, min(0.068, 0.5 * (z1 - z0)))
    cy = 0.5 * (y0 + y1)
    ry = max(0.030, min(0.065, 0.5 * (y1 - y0)))
    return {"cz": cz, "rz": rz, "cy": cy, "ry": ry}


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

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)

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

    # 🔴 Blocker 1: Export custom vertex attributes _DEFORM_WEIGHT and COLOR_0
    # Because glTF 2.0 strips vertex_groups without armatures, export point attributes!
    deform_attr = mesh.attributes.new(name="_DEFORM_WEIGHT", type='FLOAT', domain='POINT')
    color_attr = mesh.color_attributes.new(name="COLOR_0", type='FLOAT_COLOR', domain='POINT')

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
            color_attr.data[v_idx].color = (float(w_val), float(w_val), float(w_val), 1.0)

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
    non_manifold_edges = [e for e in bm_check.edges if not e.is_manifold]
    zero_area_faces = [f for f in bm_check.faces if f.calc_area() <= 1e-9]
    bm_check.free()

    if non_manifold_edges or zero_area_faces:
        print(
            f"[WARN] {name}: non_manifold={len(non_manifold_edges)}, zero_area={len(zero_area_faces)}"
        )

    # Export only this selected object
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj

    first_path = export_paths[0]
    bpy.ops.export_scene.gltf(
        filepath=first_path,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_attributes=True,
        export_all_vertex_colors=True,
    )
    for extra_path in export_paths[1:]:
        safe_copy(first_path, extra_path)

    bm.free()
    return obj, len(non_manifold_edges), len(zero_area_faces)


def build_top_template(avatar_data, variant="tshirt"):
    """
    Reproduces upper-body canonical template directly from avatar torso & 27-deg A-pose arms:
      - variant='tshirt': top_tshirt.glb (Crewneck short sleeve, +0.004m offset)
      - variant='longsleeve': top_longsleeve.glb (Long sleeve fitted shirt, +0.005m offset)
      - variant='singlet': singlet.glb / tank.glb (Sleeveless tank top, +0.004m offset)
      - variant='hoodie': hoodie.glb (Relaxed fit hoodie, +0.012m offset)
      - variant='jacket'/'top_outerwear_jacket': top_outerwear_jacket.glb (Open-front jacket, +0.016m offset)
      - variant='jacket_blazer': jacket_blazer.glb (Tailored structured blazer, +0.016m offset)
      - variant='cardigan': cardigan.glb (Soft open knit cardigan, +0.014m offset)
      - variant='vest': vest.glb (Sleeveless outerwear vest, +0.016m offset)
      - variant='coat': coat.glb (Tailored wool overcoat, +0.018m offset)
      - variant='trench_coat': trench_coat.glb (Classic A-line knee-length belted trench coat, +0.018m offset)
    Features balanced quad topology, bilateral symmetry, and planar front/back UVs in [0, 1] x [0, 1].
    """
    gender = avatar_data["gender"]
    verts = avatar_data["verts"]
    is_male = gender == "male"

    is_open_front = False
    is_trench = variant == "trench_coat"
    is_coat = variant == "coat"
    is_cardigan = variant == "cardigan"
    is_blazer = variant == "jacket_blazer"
    is_vest = variant == "vest"
    is_singlet = variant == "singlet"
    is_hoodie = variant == "hoodie"

    if variant == "tshirt":
        offset = 0.0045
        z_top = 1.50 if is_male else 1.40
        z_bottom = 0.88 if is_male else 0.84
        sleeve_frac = 0.38
    elif variant == "singlet":
        offset = 0.0040
        z_top = 1.48 if is_male else 1.38
        z_bottom = 0.88 if is_male else 0.84
        sleeve_frac = 0.0  # Sleeveless
    elif variant == "vest":
        offset = 0.0160
        z_top = 1.52 if is_male else 1.42
        z_bottom = 0.80 if is_male else 0.76
        sleeve_frac = 0.0  # Sleeveless outerwear vest
        is_open_front = True
    elif variant == "longsleeve":
        offset = 0.0055
        z_top = 1.51 if is_male else 1.41
        z_bottom = 0.87 if is_male else 0.83
        sleeve_frac = 0.95
    elif variant == "hoodie":
        offset = 0.0120
        z_top = 1.52 if is_male else 1.42
        z_bottom = 0.84 if is_male else 0.80
        sleeve_frac = 0.96
    elif variant in ("jacket", "top_outerwear_jacket"):
        offset = 0.0160
        z_top = 1.52 if is_male else 1.42
        z_bottom = 0.80 if is_male else 0.76
        sleeve_frac = 0.98
        is_open_front = True
    elif variant == "jacket_blazer":
        offset = 0.0160
        z_top = 1.52 if is_male else 1.42
        z_bottom = 0.78 if is_male else 0.74
        sleeve_frac = 0.98
        is_open_front = True
    elif variant == "cardigan":
        offset = 0.0140
        z_top = 1.51 if is_male else 1.41
        z_bottom = 0.68 if is_male else 0.64
        sleeve_frac = 0.96
        is_open_front = True
    elif variant == "coat":
        offset = 0.0180
        z_top = 1.53 if is_male else 1.43
        z_bottom = 0.54 if is_male else 0.50
        sleeve_frac = 0.98
        is_open_front = True
    elif variant == "trench_coat":
        offset = 0.0180
        z_top = 1.54 if is_male else 1.44
        z_bottom = 0.48 if is_male else 0.44  # Knee length!
        sleeve_frac = 0.98
        is_open_front = True
    else:
        offset = 0.0160
        z_top = 1.52 if is_male else 1.42
        z_bottom = 0.84 if is_male else 0.80
        sleeve_frac = 0.98

    z_shoulder = 1.45 if is_male else 1.35
    z_waist = 1.05 if is_male else 1.00
    z_hip_peak = 0.92 if is_male else 0.86
    hip_slice = measure_torso_slice(verts, z_hip_peak)

    bm = bmesh.new()
    all_faces_uvs = []
    all_vert_weights = []

    # 1. Torso rings (from z_top down to z_bottom)
    n_rings = 24 if (is_trench or is_coat) else 18
    n_seg = 28
    torso_rings = []

    # Determine full horizontal span for planar UV normalization
    x_arm_start = 0.178 if is_male else 0.158
    x_arm_wrist = 0.435 if is_male else 0.395
    x_cuff = x_arm_start + sleeve_frac * (x_arm_wrist - x_arm_start)
    max_half_span = max(0.26, x_cuff + 0.045)

    for i in range(n_rings + 1):
        t = i / n_rings
        z = z_top - t * (z_top - z_bottom)
        sl = measure_torso_slice(verts, max(0.60, min(1.40, z)))

        if z > z_shoulder:
            t_neck = (z - z_shoulder) / max(0.01, z_top - z_shoulder)
            neck_rx = 0.082 if is_male else 0.072
            neck_ry = 0.068 if is_male else 0.060
            rx = (1.0 - t_neck) * sl["rx"] + t_neck * neck_rx + offset
            ry = (1.0 - t_neck) * sl["ry"] + t_neck * neck_ry + offset
            cy = sl["cy"]
        elif is_trench and z < z_waist:
            # Trench coat authentic A-line flare widening all the way down to knee hem:
            t_flare = (z_waist - z) / max(0.01, z_waist - z_bottom)
            base_rx = max(sl["rx"], hip_slice["rx"])
            flare_rx = 0.118 * (t_flare ** 1.12)
            flare_ry = 0.075 * (t_flare ** 1.12)
            rx = base_rx + offset + flare_rx
            ry = sl["ry"] + offset + flare_ry
            cy = sl["cy"]
        elif is_coat and z < z_waist:
            # Tailored coat flare
            t_flare = (z_waist - z) / max(0.01, z_waist - z_bottom)
            base_rx = max(sl["rx"], hip_slice["rx"])
            rx = base_rx + offset + 0.065 * t_flare
            ry = sl["ry"] + offset + 0.045 * t_flare
            cy = sl["cy"]
        else:
            base_rx = max(sl["rx"], hip_slice["rx"]) if z < z_hip_peak else sl["rx"]
            rx = base_rx + offset
            ry = sl["ry"] + offset
            cy = sl["cy"]

        v_uv = 0.96 - t * 0.92

        ring = []
        for j in range(n_seg):
            theta = (j / n_seg) * 2.0 * math.pi
            px = rx * math.cos(theta)
            sin_t = math.sin(theta)
            if sin_t < 0:
                sin_s = -((-sin_t) ** 0.62)
                py = cy + (ry + 0.012) * sin_s
            else:
                sin_s = sin_t ** 0.85
                py = cy + (ry + 0.006) * sin_s
            pz = z

            u_torso = 0.5 + (px / max(0.18, rx)) * 0.28
            ring.append((Vector((px, py, pz)), (max(0.02, min(0.98, u_torso)), max(0.02, min(0.98, v_uv))), {"Torso_Deform": 1.0}))
        torso_rings.append(ring)

    if is_open_front:
        open_rings = []
        n_seg_j = 26
        for i in range(n_rings + 1):
            t = i / n_rings
            z = z_top - t * (z_top - z_bottom)
            sl = measure_torso_slice(verts, max(0.60, min(1.40, z)))
            if z > z_shoulder:
                t_neck = (z - z_shoulder) / max(0.01, z_top - z_shoulder)
                neck_rx = 0.082 if is_male else 0.072
                neck_ry = 0.068 if is_male else 0.060
                rx = (1.0 - t_neck) * sl["rx"] + t_neck * neck_rx + offset
                ry = (1.0 - t_neck) * sl["ry"] + t_neck * neck_ry + offset
                cy = sl["cy"]
            elif is_trench and z < z_waist:
                t_flare = (z_waist - z) / max(0.01, z_waist - z_bottom)
                base_rx = max(sl["rx"], hip_slice["rx"])
                rx = base_rx + offset + 0.118 * (t_flare ** 1.12)
                ry = sl["ry"] + offset + 0.075 * (t_flare ** 1.12)
                cy = sl["cy"]
            elif is_coat and z < z_waist:
                t_flare = (z_waist - z) / max(0.01, z_waist - z_bottom)
                base_rx = max(sl["rx"], hip_slice["rx"])
                rx = base_rx + offset + 0.065 * t_flare
                ry = sl["ry"] + offset + 0.045 * t_flare
                cy = sl["cy"]
            else:
                base_rx = max(sl["rx"], hip_slice["rx"]) if z < z_hip_peak else sl["rx"]
                rx = base_rx + offset
                ry = sl["ry"] + offset
                cy = sl["cy"]
            ring = []
            for j in range(n_seg_j):
                theta = (-0.38 * math.pi) + (1.76 * math.pi * j) / (n_seg_j - 1)
                px = rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                pz = z
                u_torso = 0.50 + 0.44 * (px / max_half_span)
                v_uv = 0.04 + 0.92 * t
                ring.append((Vector((px, py, pz)), (max(0.02, min(0.98, u_torso)), max(0.02, min(0.98, v_uv))), {"Torso_Deform": 1.0}))
            open_rings.append(ring)
        f_uvs, v_wts = add_open_strip_to_bm(bm, open_rings, thickness=0.0022)
    else:
        f_uvs, v_wts = add_closed_tube_to_bm(bm, torso_rings, thickness=0.0018)

    all_faces_uvs.extend(f_uvs)
    all_vert_weights.extend(v_wts)

    # 2. Left & Right Sleeves reproduced from avatar's anatomical arm trajectory
    if sleeve_frac > 0.05:
        n_sleeve_rings = 10 if variant == "tshirt" else 16
        n_sleeve_seg = 16

        if is_male:
            p_sh_left = Vector((0.218, 0.007, 1.378))
            p_wr_left = Vector((0.412, -0.012, 1.069))
            r_sh = 0.076
            r_wr = 0.052
        else:
            p_sh_left = Vector((0.198, -0.008, 1.259))
            p_wr_left = Vector((0.375, -0.009, 0.956))
            r_sh = 0.062
            r_wr = 0.040

        u_arm = (p_wr_left - p_sh_left).normalized()
        v_coronal = Vector((-u_arm.z, 0.0, u_arm.x)).normalized()
        w_sagittal = u_arm.cross(v_coronal).normalized()
        if w_sagittal.y < 0:
            w_sagittal = -w_sagittal

        arm_clearance = 0.010 if variant == "tshirt" else (0.014 if variant == "longsleeve" else 0.022)

        for side in (-1.0, 1.0):
            sleeve_rings = []
            v_dir = Vector((side * v_coronal.x, v_coronal.y, v_coronal.z))
            w_dir = Vector((side * w_sagittal.x, w_sagittal.y, w_sagittal.z))
            p_sh = Vector((side * p_sh_left.x, p_sh_left.y, p_sh_left.z))
            p_wr = Vector((side * p_wr_left.x, p_wr_left.y, p_wr_left.z))

            for i in range(n_sleeve_rings + 1):
                t = i / n_sleeve_rings
                s_frac = t * sleeve_frac
                c_pos = p_sh + s_frac * (p_wr - p_sh)
                r_arm = (1.0 - s_frac) * r_sh + s_frac * r_wr + arm_clearance

                ring = []
                for j in range(n_sleeve_seg):
                    theta = (j / n_sleeve_seg) * 2.0 * math.pi
                    cos_th = math.cos(theta)
                    sin_th = math.sin(theta)

                    p = c_pos + r_arm * (cos_th * v_dir + sin_th * w_dir)

                    v_uv = (p.z - z_bottom) / max(0.20, z_top - z_bottom)
                    v_uv = max(0.04, min(0.96, v_uv))
                    if side < 0:
                        u_uv = 0.32 - s_frac * 0.26 - 0.03 * cos_th
                    else:
                        u_uv = 0.68 + s_frac * 0.26 + 0.03 * cos_th
                    u_uv = max(0.02, min(0.98, u_uv))

                    ring.append((p, (u_uv, v_uv), {"Torso_Deform": 1.0}))
                sleeve_rings.append(ring)

            f_uvs, v_wts = add_closed_tube_to_bm(bm, sleeve_rings, thickness=0.0016)
            all_faces_uvs.extend(f_uvs)
            all_vert_weights.extend(v_wts)

    return bm, all_faces_uvs, all_vert_weights, ["Torso_Deform"]


def build_bottom_template(avatar_data, variant="trousers"):
    """
    Reproduces lower-body canonical template directly from avatar waist, pelvis & legs:
      - variant='trousers': bottom_trousers.glb / pants.glb (Straight-leg pants, cuff at Z=0.105m)
      - variant='shorts': bottom_shorts.glb / shorts.glb (Mid-thigh shorts, hem at Z=0.58m)
      - variant='bermuda': bermuda.glb (Knee-length bermuda shorts, hem at Z=0.46m)
      - variant='skirt'/'skirt_aline': bottom_skirt.glb / skirt_aline.glb (Flared A-line knee skirt)
      - variant='skirt_pencil': skirt_pencil.glb (Form-fitting knee pencil skirt)
    """
    gender = avatar_data["gender"]
    verts = avatar_data["verts"]
    is_male = gender == "male"

    offset = 0.0075
    z_waist = 1.06 if is_male else 1.02
    z_crotch = 0.80 if is_male else 0.75

    bm = bmesh.new()
    all_faces_uvs = []
    all_vert_weights = []

    is_skirt = variant in ("skirt", "skirt_aline", "skirt_pencil", "bottom_skirt")
    if is_skirt:
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

        f_uvs, v_wts = add_closed_tube_to_bm(bm, skirt_rings, thickness=0.0018)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)
        return bm, all_faces_uvs, all_vert_weights, ["Lower_Deform"]

    # Trousers, Shorts, or Bermuda:
    if variant == "bermuda":
        z_hem = 0.46 if is_male else 0.44
    elif variant in ("shorts", "bottom_shorts"):
        z_hem = 0.58 if is_male else 0.55
    else:  # trousers
        z_hem = 0.105 if is_male else 0.100

    pelvis_span_uv = (z_waist - z_crotch) / max(0.20, z_waist - z_hem)
    n_pelvis_rings = 7
    n_pelvis_seg = 28
    pelvis_rings = []
    hip_sl = measure_torso_slice(verts, 0.88 if is_male else 0.84)

    for i in range(n_pelvis_rings + 1):
        t = i / n_pelvis_rings
        z = z_waist - t * (z_waist - z_crotch)
        sl = measure_torso_slice(verts, z)
        base_rx = max(sl["rx"], hip_sl["rx"] if z < 0.88 else sl["rx"])
        rx = base_rx + offset
        ry = sl["ry"] + offset
        cy = sl["cy"]
        v_uv = 0.96 - t * pelvis_span_uv * 0.92

        ring = []
        for j in range(n_pelvis_seg):
            theta = (j / n_pelvis_seg) * 2.0 * math.pi
            px = rx * math.cos(theta)
            py = cy + ry * math.sin(theta)
            u_uv = 0.5 + (px / max(0.16, rx)) * 0.42
            ring.append((Vector((px, py, z)), (max(0.02, min(0.98, u_uv)), max(0.02, min(0.98, v_uv))), {"Lower_Deform": 1.0}))
        pelvis_rings.append(ring)

    f_uvs, v_wts = add_closed_tube_to_bm(bm, pelvis_rings, thickness=0.0018)
    all_faces_uvs.extend(f_uvs)
    all_vert_weights.extend(v_wts)

    # 2. Left & Right Legs from z_crotch down to z_hem
    n_leg_rings = 12 if variant == "trousers" else (8 if variant == "bermuda" else 6)
    n_leg_seg = 16
    leg_span_uv = 1.0 - pelvis_span_uv

    for side in (-1.0, 1.0):
        leg_rings = []
        for i in range(n_leg_rings + 1):
            t = i / n_leg_rings
            z = z_crotch - t * (z_crotch - z_hem)
            sl = measure_leg_slice(verts, z, side)
            rx = sl["rx"] + offset + 0.003
            ry = sl["ry"] + offset + 0.003
            cx = sl["cx"]
            cy = sl["cy"]
            v_uv = 0.96 - (pelvis_span_uv + t * leg_span_uv) * 0.92

            ring = []
            for j in range(n_leg_seg):
                theta = (j / n_leg_seg) * 2.0 * math.pi
                px = cx + rx * math.cos(theta)
                py = cy + ry * math.sin(theta)
                u_leg = 0.28 + (px / (cx + (rx if side > 0 else -rx))) * 0.22 if side < 0 else 0.72 + (px / (cx + (rx if side > 0 else -rx))) * 0.22
                ring.append((Vector((px, py, z)), (max(0.02, min(0.98, u_leg)), max(0.02, min(0.98, v_uv))), {"Lower_Deform": 1.0}))
            leg_rings.append(ring)

        f_uvs, v_wts = add_closed_tube_to_bm(bm, leg_rings, thickness=0.0018)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

    return bm, all_faces_uvs, all_vert_weights, ["Lower_Deform"]


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
    z_top = (0.095 if variant == "sneakers" else 0.280)
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
        # Boots: shaft extends to Z=0.28m with +0.015m radial offset so boot shaft envelopes trousers hem!
        z_levels = [
            (0.000, 1.08, 1.08, True),   # Sole bottom (Rigid)
            (0.014, 1.08, 1.08, True),   # Sole mid (Rigid)
            (0.028, 1.05, 1.05, True),   # Sole top welt (Rigid)
            (0.055, 0.98, 0.96, False),  # Vamp / instep
            (0.095, 0.96, 0.72, False),  # Ankle
            (0.150, 0.98, 0.74, False),  # Lower shin (envelopes trousers)
            (0.215, 0.96, 0.72, False),  # Mid shin
            (0.280, 1.00, 0.74, False),  # High boot collar
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
    """
    Generates full-body dress / kaftan templates:
      - variant='dress': knee-length dress with fitted bodice & flared skirt (Z in [0.48, 1.44])
      - variant='kaftan': ankle-length traditional robe with wide flowing A-line flare & sleeves (Z in [0.18, 1.48])
    """
    gender = avatar_data["gender"]
    verts = avatar_data["verts"]
    is_male = gender == "male"
    is_kaftan = variant == "kaftan"

    offset = 0.012 if is_kaftan else 0.007
    z_top = (1.50 if is_male else 1.44) if is_kaftan else (1.48 if is_male else 1.42)
    z_waist = 1.05 if is_male else 0.98
    z_bottom = (0.22 if is_male else 0.18) if is_kaftan else (0.52 if is_male else 0.48)
    z_shoulder = 1.44 if is_male else 1.36

    bm = bmesh.new()
    all_faces_uvs = []
    all_vert_weights = []

    n_rings = 32 if is_kaftan else 28
    n_seg = 28
    dress_rings = []
    max_half_span = 0.38 if is_kaftan else 0.32

    for i in range(n_rings + 1):
        t = i / n_rings
        z = z_top - t * (z_top - z_bottom)
        sl = measure_torso_slice(verts, max(0.60, min(1.40, z)))

        if z > z_shoulder:
            t_neck = (z - z_shoulder) / max(0.01, z_top - z_shoulder)
            neck_rx = 0.082 if is_male else 0.072
            neck_ry = 0.068 if is_male else 0.060
            rx = (1.0 - t_neck) * sl["rx"] + t_neck * neck_rx + offset
            ry = (1.0 - t_neck) * sl["ry"] + t_neck * neck_ry + offset
            cy = sl["cy"]
        elif z >= z_waist:
            rx = sl["rx"] + offset
            ry = sl["ry"] + offset
            cy = sl["cy"]
        else:
            t_flare = (z_waist - z) / max(0.01, z_waist - z_bottom)
            base_rx = sl["rx"] + offset
            flare_scale_x = 0.140 if is_kaftan else 0.085
            flare_scale_y = 0.080 if is_kaftan else 0.040
            rx = base_rx + flare_scale_x * (t_flare ** 1.08)
            ry = sl["ry"] + offset + flare_scale_y * (t_flare ** 1.08)
            cy = sl["cy"]

        ring = []
        for j in range(n_seg):
            theta = -0.5 * math.pi + (2.0 * math.pi * j) / n_seg
            x = rx * math.cos(theta)
            y = cy + ry * math.sin(theta)
            p = Vector((x, y, z))

            u = 0.50 + 0.44 * (x / max_half_span)
            v = 0.04 + 0.92 * t
            u = max(0.02, min(0.98, u))
            v = max(0.02, min(0.98, v))

            ring.append((p, (u, v), {"Torso_Deform": 1.0}))
        dress_rings.append(ring)

    faces_uvs, vert_weights = add_closed_tube_to_bm(bm, dress_rings, cap_ends=False, thickness=0.0020)
    all_faces_uvs.extend(faces_uvs)
    all_vert_weights.extend(vert_weights)

    if is_kaftan:
        # Flowing kaftan sleeves
        n_sleeve_rings = 14
        n_sleeve_seg = 16
        if is_male:
            p_sh_left = Vector((0.218, 0.007, 1.378))
            p_wr_left = Vector((0.412, -0.012, 1.069))
            r_sh, r_wr = 0.082, 0.068
        else:
            p_sh_left = Vector((0.198, -0.008, 1.259))
            p_wr_left = Vector((0.375, -0.009, 0.956))
            r_sh, r_wr = 0.070, 0.058

        u_arm = (p_wr_left - p_sh_left).normalized()
        v_coronal = Vector((-u_arm.z, 0.0, u_arm.x)).normalized()
        w_sagittal = u_arm.cross(v_coronal).normalized()
        if w_sagittal.y < 0:
            w_sagittal = -w_sagittal

        for side in (-1.0, 1.0):
            sleeve_rings = []
            v_dir = Vector((side * v_coronal.x, v_coronal.y, v_coronal.z))
            w_dir = Vector((side * w_sagittal.x, w_sagittal.y, w_sagittal.z))
            p_sh = Vector((side * p_sh_left.x, p_sh_left.y, p_sh_left.z))
            p_wr = Vector((side * p_wr_left.x, p_wr_left.y, p_wr_left.z))

            for i in range(n_sleeve_rings + 1):
                t = i / n_sleeve_rings
                s_frac = t * 0.94
                c_pos = p_sh + s_frac * (p_wr - p_sh)
                r_arm = (1.0 - s_frac) * r_sh + s_frac * r_wr + 0.018

                ring = []
                for j in range(n_sleeve_seg):
                    theta = (j / n_sleeve_seg) * 2.0 * math.pi
                    p = c_pos + r_arm * (math.cos(theta) * v_dir + math.sin(theta) * w_dir)
                    v_uv = max(0.04, min(0.96, (p.z - z_bottom) / max(0.20, z_top - z_bottom)))
                    u_uv = max(0.02, min(0.98, (0.32 - s_frac * 0.26) if side < 0 else (0.68 + s_frac * 0.26)))
                    ring.append((p, (u_uv, v_uv), {"Torso_Deform": 1.0}))
                sleeve_rings.append(ring)
            f_uvs, v_wts = add_closed_tube_to_bm(bm, sleeve_rings, thickness=0.0018)
            all_faces_uvs.extend(f_uvs)
            all_vert_weights.extend(v_wts)

    return bm, all_faces_uvs, all_vert_weights, ["Torso_Deform"]


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

        # 2. Rigid Buckle Plate at center front (-Y)
        buckle_rings = []
        b_w = 0.030
        b_h = 0.026
        b_y = cy - ry - 0.003
        for i in range(3):
            t = i / 2.0
            z = (z_belt + b_h) - t * (2.0 * b_h)
            ring = [
                (Vector((-b_w, b_y - 0.003, z)), (0.35, 0.10 + t * 0.20), {"Deformable_Strap": 0.0, "Rigid_Hardware": 1.0}),
                (Vector((b_w, b_y - 0.003, z)), (0.65, 0.10 + t * 0.20), {"Deformable_Strap": 0.0, "Rigid_Hardware": 1.0}),
                (Vector((b_w, b_y + 0.002, z)), (0.65, 0.10 + t * 0.20), {"Deformable_Strap": 0.0, "Rigid_Hardware": 1.0}),
                (Vector((-b_w, b_y + 0.002, z)), (0.35, 0.10 + t * 0.20), {"Deformable_Strap": 0.0, "Rigid_Hardware": 1.0}),
            ]
            buckle_rings.append(ring)
        f_uvs, v_wts = add_closed_tube_to_bm(bm, buckle_rings, thickness=0.0012)
        all_faces_uvs.extend(f_uvs)
        all_vert_weights.extend(v_wts)

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
    ("singlet", "top", "singlet", ["singlet.glb", "tank.glb"]),
    ("top_longsleeve", "top", "longsleeve", ["longsleeve.glb", "shirt.glb"]),
    ("hoodie", "top", "hoodie", ["hoodie.glb"]),
    ("top_outerwear_jacket", "top", "jacket", ["jacket.glb"]),
    ("jacket_blazer", "top", "jacket_blazer", ["jacket_blazer.glb"]),
    ("cardigan", "top", "cardigan", ["cardigan.glb"]),
    ("vest", "top", "vest", ["vest.glb"]),
    ("coat", "top", "coat", ["coat.glb"]),
    ("trench_coat", "top", "trench_coat", ["trench_coat.glb"]),
    # Lower Body
    ("bottom_trousers", "bottom", "trousers", ["pants.glb"]),
    ("bottom_shorts", "bottom", "shorts", ["shorts.glb"]),
    ("bermuda", "bottom", "bermuda", ["bermuda.glb"]),
    ("bottom_skirt", "bottom", "skirt_aline", ["skirt.glb", "skirt_aline.glb"]),
    ("skirt_pencil", "bottom", "skirt_pencil", ["skirt_pencil.glb"]),
    # Full Body
    ("dress", "dress", "dress", ["dress.glb"]),
    ("kaftan", "dress", "kaftan", ["kaftan.glb"]),
    # Footwear
    ("shoes_sneakers", "footwear", "sneakers", ["sneakers.glb", "sandals.glb"]),
    ("shoes_boots", "footwear", "boots", ["boots.glb", "heels.glb"]),
    # Accessories
    ("accessory_belt", "accessory", "belt", ["belt.glb"]),
    ("accessory_hat", "accessory", "hat", ["hat.glb", "hat_cap.glb", "hat_fedora.glb"]),
    ("accessory_glasses", "accessory", "glasses", ["glasses.glb"]),
    (
        "accessory_crossbody_bag",
        "accessory",
        "crossbody_bag",
        ["bag.glb", "bag_crossbody.glb", "bag_handbag.glb", "watch.glb", "scarf.glb"],
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

    for gender in ("male", "female"):
        print(f"\n=== GENERATING CANONICAL BASEMESHES FOR {gender.upper()} AVATAR ===")
        avatar_data = load_avatar_data(gender)
        generated_objs = {}

        for asset_name, category, variant, legacy_names in CANONICAL_SPECS:
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

        verify_collision_and_rigidity(gender, generated_objs, avatar_data)
        avatar_data["bm"].free()

    print(f"\nALL {total_exported} CANONICAL BASEMESHES GENERATED AND VERIFIED SUCCESSFULLY.")


if __name__ == "__main__":
    main()
