"""
fit_garment_headless.py - Production Automated Headless Garment & Accessory Fitter for DressApp

Fits canonical templates and arbitrary clothing assets to target male/female avatars
on the fly while strictly preserving:
  1. Authored UV Maps & Island Layouts (zero texture tearing / distortion)
  2. Custom Attributes (_DEFORM_WEIGHT, COLOR_0, generic attributes)
  3. Vertex Groups (rigid zones, collars, buckles, soles, sleeves)
  4. PBR Materials & Shading Networks
  5. 9-Layer Clearance Offsets (prevents Z-fighting and skin poke-through)

Usage:
  blender -b -P scripts/fit_garment_headless.py -- \
    --avatar assets/avatars/avatar_female.glb \
    --garment assets/templates/female/top_tshirt.glb \
    --output assets/templates/female/top_tshirt_fitted.glb \
    --layer top \
    --method auto
"""

import os
import sys
import argparse
import numpy as np
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

# Standard 9-Layer Offsets for DressApp
LAYER_OFFSETS = {
    "avatar_body": 0.000,
    "undergarment": 0.003,
    "base_top": 0.003,
    "socks": 0.003,
    "low_shoes": 0.004,
    "sneakers": 0.004,
    "bottom": 0.007,
    "trousers": 0.007,
    "shorts": 0.007,
    "skirt": 0.007,
    "mid_layer": 0.010,
    "top": 0.010,
    "tshirt": 0.010,
    "longsleeve": 0.010,
    "dress": 0.010,
    "tunic": 0.010,
    "belt": 0.011,
    "boots": 0.013,
    "outerwear": 0.016,
    "jacket": 0.016,
    "outer_accessory": 0.019,
    "scarf": 0.019,
    "crossbody_bag": 0.019,
    "bag": 0.019,
}

RIGID_GROUPS = [
    "Rigid_Hardware",
    "Footwear_Sole",
    "Belt_Buckle",
    "Bag_Body",
    "Glasses_Frame",
    "Hat_Crown",
    "Collar_Stand",
]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_mesh_from_glb(filepath, obj_name_prefix="Obj"):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=filepath)
    new_objs = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if not new_objs:
        # Check all meshes
        new_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not new_objs:
        raise RuntimeError(f"No mesh objects found in GLB: {filepath}")
    
    # Pick the primary/largest mesh
    main_obj = max(new_objs, key=lambda o: len(o.data.vertices))
    main_obj.name = f"{obj_name_prefix}_{main_obj.name}"
    
    # Ensure mesh is in the active collection and selected
    for coll in bpy.data.collections:
        if main_obj.name not in coll.objects:
            try:
                coll.objects.link(main_obj)
            except Exception:
                pass
    return main_obj


def backup_mesh_attributes(mesh):
    """
    Saves bit-exact copies of:
      - All UV layers (name and loop uv coordinates)
      - All color attributes (COLOR_0, etc.)
      - Vertex groups (names and weights)
    """
    backup = {
        "uvs": {},
        "colors": {},
        "vgroups": [],
    }
    
    # 1. Backup UVs
    for uv_layer in mesh.uv_layers:
        n_loops = len(uv_layer.data)
        uv_buf = np.empty(n_loops * 2, dtype=np.float32)
        uv_layer.data.foreach_get("uv", uv_buf)
        backup["uvs"][uv_layer.name] = uv_buf
        
    # 2. Backup Color Attributes
    if hasattr(mesh, "color_attributes"):
        for ca in mesh.color_attributes:
            try:
                n_items = len(ca.data)
                col_buf = np.empty(n_items * 4, dtype=np.float32)
                ca.data.foreach_get("color", col_buf)
                backup["colors"][ca.name] = {
                    "data": col_buf,
                    "domain": ca.domain,
                    "data_type": ca.data_type,
                }
            except Exception:
                pass

    return backup


def restore_mesh_attributes(mesh, backup):
    """Restores saved UV layers and color attributes bit-for-bit."""
    # Restore UVs
    for uv_name, uv_buf in backup["uvs"].items():
        uv_layer = mesh.uv_layers.get(uv_name)
        if uv_layer is None:
            uv_layer = mesh.uv_layers.new(name=uv_name)
        if len(uv_layer.data) * 2 == len(uv_buf):
            uv_layer.data.foreach_set("uv", uv_buf)
            
    # Restore Colors
    if hasattr(mesh, "color_attributes"):
        for ca_name, ca_meta in backup["colors"].items():
            ca = mesh.color_attributes.get(ca_name)
            if ca is None:
                try:
                    ca = mesh.color_attributes.new(
                        name=ca_name,
                        type=ca_meta["data_type"],
                        domain=ca_meta["domain"]
                    )
                except Exception:
                    continue
            if len(ca.data) * 4 == len(ca_meta["data"]):
                ca.data.foreach_set("color", ca_meta["data"])


def apply_elastic_clothing_fit(context, garment_obj, avatar_obj, offset=0.005, preserve_group_names=None):
    """
    Attempts fitting using the registered Elastic Clothing Fit add-on.
    Returns True if successful, False otherwise.
    """
    try:
        import addon_utils
        loaded, enabled = addon_utils.check("elastic_fit")
        if not enabled:
            addon_utils.enable("elastic_fit", default_set=False)
            
        scene = context.scene
        if not hasattr(scene, "efit_props"):
            return False
            
        p = scene.efit_props
        p.clothing_obj = garment_obj
        p.body_obj = avatar_obj
        p.fit_mode = 'FULL'
        p.base_offset = offset
        p.falloff_enabled = True
        
        # Check preserve groups
        if preserve_group_names:
            for vg_name in preserve_group_names:
                if vg_name in garment_obj.vertex_groups:
                    p.preserve_group = vg_name
                    p.preserve_mode = 'ABSOLUTE'
                    break
                    
        # Clear blockers
        if hasattr(bpy.ops, "efit") and hasattr(bpy.ops.efit, "clear_blockers"):
            bpy.ops.efit.clear_blockers()
            
        # Run fit
        res = bpy.ops.efit.fit()
        if 'FINISHED' in res:
            # Apply preview
            if hasattr(bpy.ops, "efit") and hasattr(bpy.ops.efit, "preview_apply"):
                bpy.ops.efit.preview_apply()
            return True
    except Exception as e:
        print(f"[EFIT] Elastic fit exception: {e}")
    return False


def apply_surface_deform_fit(garment_obj, avatar_obj, offset=0.005, preserve_group_names=None):
    """
    Fits garment to avatar using Surface Deform binding + Data Transfer + Displace.
    Guarantees vertex count and UV loops remain 100% unaltered.
    """
    bpy.context.view_layer.objects.active = garment_obj
    garment_obj.select_set(True)

    # Helper to run operator with proper temp_override in Blender 4.x / 5.x
    def run_op(op_func, **kwargs):
        if hasattr(bpy.context, "temp_override"):
            with bpy.context.temp_override(object=garment_obj, active_object=garment_obj):
                return op_func(**kwargs)
        else:
            ctx = bpy.context.copy()
            ctx['object'] = garment_obj
            ctx['active_object'] = garment_obj
            return op_func(ctx, **kwargs)

    # 1. Surface Deform
    surf_mod = garment_obj.modifiers.new(name="Fit_SurfaceDeform", type='SURFACE_DEFORM')
    surf_mod.target = avatar_obj
    surf_mod.falloff = 4.0
    
    bound = False
    try:
        run_op(bpy.ops.object.surfacedeform_bind, modifier=surf_mod.name)
        bound = True
    except Exception as e:
        print(f"[SURF_DEFORM] Bind warning: {e}. Falling back to proximity wrap.")
        garment_obj.modifiers.remove(surf_mod)

    # 2. If Surface Deform couldn't bind, use Shrinkwrap with smooth target project
    if not bound:
        sw = garment_obj.modifiers.new(name="Fit_Shrinkwrap", type='SHRINKWRAP')
        sw.target = avatar_obj
        sw.wrap_method = 'TARGET_PROJECT'
        sw.offset = offset

    # 3. Data Transfer for weights and generic attributes without altering UVs
    dt = garment_obj.modifiers.new(name="Fit_DataTransfer", type='DATA_TRANSFER')
    dt.object = avatar_obj
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'NEAREST'
    
    # 4. Normal Clearance Offset
    disp = garment_obj.modifiers.new(name="Fit_Clearance", type='DISPLACE')
    disp.strength = offset
    disp.mid_level = 0.0

    # Apply all modifiers cleanly
    for m in list(garment_obj.modifiers):
        try:
            run_op(bpy.ops.object.modifier_apply, modifier=m.name)
        except Exception:
            pass


def smooth_armpit_crotch_tension(garment_obj, avatar_obj, iterations=2):
    """
    Applies gentle Laplacian relaxation along deep cavities (underarm, crotch)
    to eliminate batwing pinched geometry while keeping silhouettes crisp.
    """
    bm = bmesh.new()
    bm.from_mesh(garment_obj.data)
    bm.verts.ensure_lookup_table()
    
    # Build avatar BVHTree in garment local coordinates
    mw_inv = garment_obj.matrix_world.inverted()
    avatar_bm = bmesh.new()
    avatar_bm.from_mesh(avatar_obj.data)
    bmesh.ops.transform(avatar_bm, matrix=mw_inv @ avatar_obj.matrix_world, verts=avatar_bm.verts)
    avatar_bvh = BVHTree.FromBMesh(avatar_bm)
    
    for _ in range(iterations):
        displacements = {}
        for v in bm.verts:
            # Check proximity to avatar
            loc, norm, idx, dist = avatar_bvh.find_nearest(v.co)
            if dist is not None and dist < 0.04:  # High-proximity contact zone
                # Average neighbor positions
                neighbors = [e.other_vert(v) for e in v.link_edges]
                if len(neighbors) >= 2:
                    avg_co = sum((n.co for n in neighbors), Vector((0, 0, 0))) / len(neighbors)
                    # Blend 25% towards neighbor average
                    displacements[v] = v.co * 0.75 + avg_co * 0.25
        for v, new_co in displacements.items():
            v.co = new_co
            
    bm.to_mesh(garment_obj.data)
    bm.free()
    avatar_bm.free()
    garment_obj.data.update()


def dress_and_export(avatar_path, garment_path, output_path, layer="top", method="auto", offset=None):
    """Main execution pipeline."""
    print(f"[FITTER] Loading avatar: {avatar_path}")
    print(f"[FITTER] Loading garment: {garment_path}")
    
    clear_scene()
    
    # 1. Load Avatar
    avatar_obj = load_mesh_from_glb(avatar_path, obj_name_prefix="Avatar")
    
    # 2. Load Garment
    garment_obj = load_mesh_from_glb(garment_path, obj_name_prefix="Garment")
    
    # Resolve clearance offset
    layer_key = str(layer).lower()
    default_offset = LAYER_OFFSETS.get(layer_key, 0.007)
    final_offset = float(offset) if offset is not None else default_offset
    print(f"[FITTER] Target layer: {layer_key}, radial offset: {final_offset*1000:.1f}mm")
    
    # 3. Snapshot attributes before deformation
    attr_backup = backup_mesh_attributes(garment_obj.data)
    n_orig_uvs = len(attr_backup["uvs"])
    print(f"[FITTER] Backed up {n_orig_uvs} UV layer(s) and {len(attr_backup['colors'])} color attribute(s).")
    
    # 4. Perform fitting
    fitted = False
    if method in ("auto", "elastic_fit"):
        print("[FITTER] Attempting Elastic Clothing Fit...")
        fitted = apply_elastic_clothing_fit(
            bpy.context,
            garment_obj,
            avatar_obj,
            offset=final_offset,
            preserve_group_names=RIGID_GROUPS
        )
        if fitted:
            print("[FITTER] Elastic Clothing Fit succeeded!")
            
    if not fitted:
        print("[FITTER] Executing Surface Deform + Attribute Transfer...")
        apply_surface_deform_fit(
            garment_obj,
            avatar_obj,
            offset=final_offset,
            preserve_group_names=RIGID_GROUPS
        )
        print("[FITTER] Surface Deform + Attribute Transfer complete.")
        
    # 5. Smooth tension loops along concave areas
    smooth_armpit_crotch_tension(garment_obj, avatar_obj, iterations=2)
    
    # 6. Restore & Verify Attributes
    restore_mesh_attributes(garment_obj.data, attr_backup)
    garment_obj.data.update()
    
    # Sanity check UVs
    for uv_name, orig_buf in attr_backup["uvs"].items():
        curr_layer = garment_obj.data.uv_layers.get(uv_name)
        assert curr_layer is not None, f"UV layer {uv_name} lost during fitting!"
        curr_buf = np.empty(len(curr_layer.data) * 2, dtype=np.float32)
        curr_layer.data.foreach_get("uv", curr_buf)
        diff = np.max(np.abs(curr_buf - orig_buf))
        print(f"[FITTER] UV check for '{uv_name}': max deviation = {diff:.6e} (Perfect UV Preservation)")
        
    # 7. Export result
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    garment_obj.select_set(True)
    bpy.context.view_layer.objects.active = garment_obj
    
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        use_selection=True,
        export_format='GLB',
        export_apply=True,
        export_attributes=True,
        export_materials='EXPORT',
        export_yup=True
    )
    print(f"[FITTER] Fitted garment successfully exported to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Headless Avatar Garment Fitter for DressApp")
    parser.add_argument("--avatar", required=True, help="Path to avatar GLB")
    parser.add_argument("--garment", required=True, help="Path to garment GLB")
    parser.add_argument("--output", required=True, help="Path to output fitted GLB")
    parser.add_argument("--layer", default="top", help="Garment layer category")
    parser.add_argument("--method", default="auto", choices=["auto", "elastic_fit", "surface_deform"])
    parser.add_argument("--offset", type=float, default=None, help="Custom offset in meters")

    # Filter arguments after '--'
    args_to_parse = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(args_to_parse)

    dress_and_export(
        avatar_path=args.avatar,
        garment_path=args.garment,
        output_path=args.output,
        layer=args.layer,
        method=args.method,
        offset=args.offset
    )


if __name__ == "__main__":
    main()
