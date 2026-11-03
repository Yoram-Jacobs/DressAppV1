import bpy
import os
import math

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
for gender in ["male", "female"]:
    glb_path = os.path.join(ROOT_DIR, "apps", "web", "public", "models", f"avatar_{gender}_1.glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    body = max(meshes, key=lambda m: len(m.data.vertices))
    mw = body.matrix_world
    verts = [mw @ v.co for v in body.data.vertices]
    print(f"\n=================== {gender.upper()} AVATAR ===================")
    # Blender coords: X = lateral, Y = front/back, Z = height
    # Let's inspect arm slices along X for X > 0.18 (left arm)
    for x_target in [0.20, 0.24, 0.28, 0.32, 0.36, 0.40, 0.44]:
        pts = [v for v in verts if abs(v.x - x_target) <= 0.015 and v.z >= 0.75 and v.z <= 1.55]
        if pts:
            min_z = min(v.z for v in pts)
            max_z = max(v.z for v in pts)
            min_y = min(v.y for v in pts)
            max_y = max(v.y for v in pts)
            cz = (min_z + max_z) * 0.5
            cy = (min_y + max_y) * 0.5
            rz = (max_z - min_z) * 0.5
            ry = (max_y - min_y) * 0.5
            print(f"  x={x_target:.2f}: count={len(pts):3d}, cz={cz:.3f}, rz={rz:.3f}, cy={cy:.3f}, ry={ry:.3f}, z=[{min_z:.3f}, {max_z:.3f}]")
        else:
            print(f"  x={x_target:.2f}: no points")
