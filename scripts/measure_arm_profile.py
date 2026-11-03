import bpy
import os
import math
import numpy as np

ROOT_DIR = os.path.abspath(".")
for gender in ["female", "male"]:
    glb_path = os.path.join(ROOT_DIR, "apps", "web", "public", "models", f"avatar_{gender}_1.glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    body = max(meshes, key=lambda m: len(m.data.vertices))
    mw = body.matrix_world
    verts = np.array([mw @ v.co for v in body.data.vertices])
    
    print(f"\n=================== ARM PROFILE FOR {gender.upper()} ===================")
    # Filter for left arm: x > 0.18, z in [0.75, 1.45]
    # For each slice along the arm, let's find the center of mass and radius
    x_steps = np.linspace(0.20, 0.43 if gender == "male" else 0.39, 12)
    arm_centers = []
    for x_val in x_steps:
        # Band of +/- 0.015 around x_val
        band_mask = (verts[:, 0] >= x_val - 0.012) & (verts[:, 0] <= x_val + 0.012)
        # To avoid torso, for x < 0.23, only consider z > 1.15
        if x_val < 0.24:
            band_mask &= (verts[:, 2] >= (1.20 if gender == "male" else 1.12))
        else:
            band_mask &= (verts[:, 2] >= 0.78) & (verts[:, 2] <= 1.48)
        
        pts = verts[band_mask]
        if len(pts) > 0:
            cx = float(np.mean(pts[:, 0]))
            cy = float(np.mean(pts[:, 1]))
            cz = float(np.mean(pts[:, 2]))
            # Distance from center in YZ plane
            dists = np.hypot(pts[:, 1] - cy, pts[:, 2] - cz)
            r = float(np.max(dists))
            r_mean = float(np.mean(dists))
            arm_centers.append((cx, cy, cz, r, r_mean))
            print(f"  x={cx:.3f}: cy={cy:.3f}, cz={cz:.3f}, r_max={r:.3f}, r_mean={r_mean:.3f}")
