"""
Enterprise Headless Blender Garment Fitting Engine for DressApp.

Usage:
  blender -b -P scripts/blender_enterprise_fitter.py -- \
    --avatar assets/avatars/avatar_female.glb \
    --garment_template assets/templates/female/hoodie.glb \
    --texture path/to/clean_garment.png \
    --category top \
    --layer_index 1 \
    --output output_fitted.glb
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import bpy

LAYER_RADIAL_OFFSETS = {
    1: 0.003,  # Layer 1 (Tops / Base / Undergarment): +0.003m
    2: 0.004,  # Layer 2 (Low Shoes): +0.004m (Rigid soles locked via Footwear_Sole weight 0)
    3: 0.007,  # Layer 3 (Bottoms / Trousers / Skirts): +0.007m
    4: 0.010,  # Layer 4 (Mid-Layers / Sweaters): +0.010m
    5: 0.013,  # Layer 5 (Boots): +0.013m (Wraps over lower pants hem tightly)
    6: 0.016,  # Layer 6 (Outerwear / Coats / Cardigans): +0.016m
    7: 0.019,  # Layer 7 (Scarves / Bags / Accessories): +0.019m
    8: 0.022,  # Layer 8 (Outer Accessories): +0.022m
}

CATEGORY_DEFAULT_LAYER = {
    "undergarment": 1,
    "top": 1,
    "low_shoes": 2,
    "bottom": 3,
    "mid_layer": 4,
    "boots": 5,
    "outerwear": 6,
    "accessory": 7,
}

VALID_CATEGORIES = (
    "undergarment",
    "top",
    "bottom",
    "low_shoes",
    "boots",
    "outerwear",
    "accessory",
)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DressApp Headless Blender Fitting Engine")
    parser.add_argument("--avatar", required=True, help="Path to morphed avatar .glb")
    parser.add_argument("--garment_template", required=True, help="Path to canonical garment template .glb")
    parser.add_argument("--texture", required=False, default="", help="Path to clean RGBA garment texture PNG")
    parser.add_argument(
        "--category",
        required=True,
        choices=VALID_CATEGORIES,
        help="Garment category enum",
    )
    parser.add_argument(
        "--layer_index",
        type=int,
        required=False,
        default=0,
        help="Collision hierarchy layer index (1 to 8)",
    )
    parser.add_argument("--output", required=True, help="Output fitted .glb path")
    return parser.parse_args(argv)


def resolve_layer_offset(category: str, layer_index: int) -> float:
    eff_layer = layer_index if 1 <= layer_index <= 8 else CATEGORY_DEFAULT_LAYER.get(category, 1)
    return LAYER_RADIAL_OFFSETS.get(eff_layer, 0.003)


def ensure_deform_vertex_group(garment_obj: bpy.types.Object, category: str) -> str | None:
    """
    Ensures rigid zones (Footwear_Sole at Z=0, Rigid_Hardware belt buckles, Bag_Body)
    remain 100% locked (weight 0.0 in the active deform group) during Shrinkwrap & Smooth.
    """
    vgroups = garment_obj.vertex_groups
    if category in ("low_shoes", "boots"):
        if "Footwear_Upper" in vgroups:
            return "Footwear_Upper"
        # Create Footwear_Sole (Z <= 0.026m weight 0 in deform) and Footwear_Upper
        sole_vg = vgroups.get("Footwear_Sole") or vgroups.new(name="Footwear_Sole")
        upper_vg = vgroups.get("Footwear_Upper") or vgroups.new(name="Footwear_Upper")
        mw = garment_obj.matrix_world
        for v in garment_obj.data.vertices:
            wz = (mw @ v.co).z
            if wz <= 0.026:
                sole_vg.add([v.index], 1.0, "REPLACE")
                upper_vg.add([v.index], 0.0, "REPLACE")
            else:
                sole_vg.add([v.index], 0.0, "REPLACE")
                upper_vg.add([v.index], 1.0, "REPLACE")
        return "Footwear_Upper"

    if "Deformable_Strap" in vgroups:
        return "Deformable_Strap"
    if "Strap_Deform" in vgroups:
        return "Strap_Deform"
    if "Torso_Deform" in vgroups:
        return "Torso_Deform"
    if "Lower_Deform" in vgroups:
        return "Lower_Deform"
    return None


def bind_pbr_material(garment_obj: bpy.types.Object, texture_path: str) -> None:
    """
    Connects the uploaded clean RGBA garment texture to Principled BSDF Base Color,
    sets Roughness = 0.75, Metallic = 0.0, and configures Alpha blend mode to HASHED.
    """
    mat = bpy.data.materials.new(name="EnterpriseGarmentPBR")
    mat.use_nodes = True
    if hasattr(mat, "blend_method"):
        mat.blend_method = "HASHED"
    if hasattr(mat, "surface_render_method"):
        try:
            mat.surface_render_method = "DITHERED"
        except Exception:
            pass

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")

    bsdf.inputs["Roughness"].default_value = 0.75
    bsdf.inputs["Metallic"].default_value = 0.0

    if texture_path and os.path.exists(texture_path):
        tex_image = nodes.new(type="ShaderNodeTexImage")
        tex_image.image = bpy.data.images.load(os.path.abspath(texture_path), check_existing=True)
        links.new(tex_image.outputs["Color"], bsdf.inputs["Base Color"])
        if "Alpha" in bsdf.inputs and "Alpha" in tex_image.outputs:
            links.new(tex_image.outputs["Alpha"], bsdf.inputs["Alpha"])

    garment_obj.data.materials.clear()
    garment_obj.data.materials.append(mat)


def fit_garment(args: argparse.Namespace) -> dict:
    t0 = time.perf_counter()
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 1. Import morphed target Avatar GLB
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.avatar))
    avatar_meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not avatar_meshes:
        raise RuntimeError(f"No mesh found in avatar GLB: {args.avatar}")
    avatar_obj = max(avatar_meshes, key=lambda o: len(o.data.vertices))
    avatar_obj.name = "Target_Avatar_Body"

    # 2. Import Canonical Garment Template GLB
    before_objs = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.garment_template))
    new_objs = [o for o in bpy.context.scene.objects if o not in before_objs and o.type == "MESH"]
    if not new_objs:
        raise RuntimeError(f"No mesh found in garment template GLB: {args.garment_template}")
    garment_obj = max(new_objs, key=lambda o: len(o.data.vertices))
    garment_obj.name = f"Fitted_{args.category}"

    layer_offset = resolve_layer_offset(args.category, args.layer_index)
    deform_vg_name = ensure_deform_vertex_group(garment_obj, args.category)

    # 3. Modifier Automation: SHRINKWRAP -> SMOOTH -> SOLIDIFY
    bpy.context.view_layer.objects.active = garment_obj

    # 3a. SHRINKWRAP targeting avatar with designated layer offset and Nearest Surface Point
    sw_mod = garment_obj.modifiers.new(name="Enterprise_Shrinkwrap", type="SHRINKWRAP")
    sw_mod.target = avatar_obj
    sw_mod.wrap_method = "NEAREST_SURFACEPOINT"
    sw_mod.wrap_mode = "OUTSIDE_SURFACE"
    sw_mod.offset = layer_offset
    if deform_vg_name:
        sw_mod.vertex_group = deform_vg_name

    # 3b. SMOOTH modifier (factor: 0.4, iterations: 2) to eliminate crotch/armpit pinching
    sm_mod = garment_obj.modifiers.new(name="Enterprise_Smooth", type="SMOOTH")
    sm_mod.factor = 0.4
    sm_mod.iterations = 2
    if deform_vg_name:
        sm_mod.vertex_group = deform_vg_name

    # 3c. SOLIDIFY modifier (thickness: 0.0015m) for physical rim volume
    sol_mod = garment_obj.modifiers.new(name="Enterprise_Solidify", type="SOLIDIFY")
    sol_mod.thickness = 0.0015
    sol_mod.offset = 1.0
    sol_mod.use_rim = True

    # Apply modifiers in sequence
    for mod in (sw_mod, sm_mod, sol_mod):
        bpy.ops.object.modifier_apply(modifier=mod.name)

    # Preserve strict ground contact (Z = 0.0) for footwear soles
    if args.category in ("low_shoes", "boots") and "Footwear_Sole" in garment_obj.vertex_groups:
        sole_idx = garment_obj.vertex_groups["Footwear_Sole"].index
        mw = garment_obj.matrix_world
        mw_inv = mw.inverted()
        for v in garment_obj.data.vertices:
            for g in v.groups:
                if g.group == sole_idx and g.weight >= 0.5:
                    w_co = mw @ v.co
                    if w_co.z < 0.004:
                        w_co.z = 0.0
                        v.co = mw_inv @ w_co

    # 4. PBR Material Binding (Principled BSDF, Roughness 0.75, Metallic 0.0, Alpha HASHED)
    bind_pbr_material(garment_obj, args.texture)

    # 5. Remove avatar & non-garment objects before exporting fitted garment GLB
    for obj in list(bpy.context.scene.objects):
        if obj != garment_obj:
            bpy.data.objects.remove(obj, do_unlink=True)

    if hasattr(bpy.ops.outliner, "orphans_purge"):
        try:
            bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
        except Exception:
            pass

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(args.output),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    size_bytes = os.path.getsize(os.path.abspath(args.output))
    print(
        f"[ENTERPRISE FITTER OK] category={args.category} offset={layer_offset:.4f}m "
        f"size={size_bytes}B elapsed={elapsed_ms}ms output={args.output}"
    )
    return {
        "output": os.path.abspath(args.output),
        "layer_offset": layer_offset,
        "size_bytes": size_bytes,
        "elapsed_ms": elapsed_ms,
    }


if __name__ == "__main__":
    argv = sys.argv
    cli_args = argv[argv.index("--") + 1 :] if "--" in argv else []
    parsed = parse_args(cli_args)
    fit_garment(parsed)
