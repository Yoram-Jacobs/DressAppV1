import bpy
import mathutils
import math
import sys
import os
from collections import deque

def pose_avatar(glb_path, gender, output_path):
    print(f"\n--- Processing {gender} avatar from {glb_path} ---")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    obj_name = 'f_ca01' if gender == 'female' else 'm_ca01'
    mesh_obj = bpy.data.objects.get(obj_name)
    if not mesh_obj:
        print(f"Error: Object {obj_name} not found!")
        for o in bpy.data.objects:
            print(" Available object:", o.name, o.type)
        return False
    
    mesh = mesh_obj.data
    n_verts = len(mesh.vertices)
    print(f"Loaded {mesh_obj.name} with {n_verts} vertices, {len(mesh.edges)} edges, {len(mesh.polygons)} polys.")
    
    # Build topological adjacency
    adj = [[] for _ in range(n_verts)]
    for e in mesh.edges:
        adj[e.vertices[0]].append(e.vertices[1])
        adj[e.vertices[1]].append(e.vertices[0])
    
    # Step 1: Lower body (feet, legs, hips, pelvis) via BFS from bottom
    seeds_lower = [i for i, v in enumerate(mesh.vertices) if v.co.z < 0.1]
    lower_body = set(seeds_lower)
    q = deque(seeds_lower)
    while q:
        c = q.popleft()
        for nbr in adj[c]:
            if nbr not in lower_body:
                lower_body.add(nbr)
                q.append(nbr)
    print(f"Identified {len(lower_body)} lower-body/hip vertices (Z in [{min(mesh.vertices[i].co.z for i in lower_body):.2f}, {max(mesh.vertices[i].co.z for i in lower_body):.2f}])")
    
    # Step 2: Medial Torso and Head (strictly protected)
    medial_x = 0.13 if gender == 'female' else 0.14
    sh_z_split = 1.25 if gender == 'female' else 1.32
    sh_x_stop = 0.155 if gender == 'female' else 0.175
    torso_x_stop = 0.165 if gender == 'female' else 0.185
    
    seeds_torso = [i for i, v in enumerate(mesh.vertices) if abs(v.co.x) < medial_x and i not in lower_body]
    central_body = set(seeds_torso)
    q = deque(seeds_torso)
    while q:
        c = q.popleft()
        for nbr in adj[c]:
            if nbr not in central_body and nbr not in lower_body:
                co = mesh.vertices[nbr].co
                if (co.z >= sh_z_split and abs(co.x) < sh_x_stop) or (co.z < sh_z_split and abs(co.x) < torso_x_stop):
                    central_body.add(nbr)
                    q.append(nbr)
    print(f"Identified {len(central_body)} central torso/head vertices")
    
    # Step 3: Pure arm vertices
    left_arm = [i for i in range(n_verts) if mesh.vertices[i].co.x > 0 and i not in lower_body and i not in central_body]
    right_arm = [i for i in range(n_verts) if mesh.vertices[i].co.x < 0 and i not in lower_body and i not in central_body]
    print(f"Left arm vertices: {len(left_arm)}, Right arm vertices: {len(right_arm)}")
    assert len(left_arm) == len(right_arm), f"Asymmetry detected! L={len(left_arm)}, R={len(right_arm)}"
    
    # Shoulder joint pivots
    if gender == 'female':
        p_sh_L = mathutils.Vector((0.174, -0.011, 1.357))
        p_sh_R = mathutils.Vector((-0.174, -0.011, 1.357))
        x_inner, x_outer = 0.155, 0.185
    else:
        p_sh_L = mathutils.Vector((0.202, 0.004, 1.429))
        p_sh_R = mathutils.Vector((-0.202, 0.004, 1.429))
        x_inner, x_outer = 0.175, 0.210
    
    # Lifting arms by 27 degrees (~28 deg natural A-pose)
    angle_deg = 27.0
    theta = math.radians(angle_deg)
    rot_L = mathutils.Matrix.Rotation(-theta, 3, 'Y')
    rot_R = mathutils.Matrix.Rotation(theta, 3, 'Y')
    
    deltas = {}
    
    # Compute displacements for left arm
    for i in left_arm:
        co = mesh.vertices[i].co
        if co.z < 1.30:
            w = 1.0
        else:
            t = max(0.0, min(1.0, (co.x - x_inner) / (x_outer - x_inner)))
            w = 3.0 * t * t - 2.0 * t * t * t
        
        # Rotation around shoulder pivot
        offset = co - p_sh_L
        rotated = rot_L @ offset
        delta = (rotated - offset) * w
        deltas[i] = delta
        
    # Compute displacements for right arm
    for i in right_arm:
        co = mesh.vertices[i].co
        if co.z < 1.30:
            w = 1.0
        else:
            t = max(0.0, min(1.0, (abs(co.x) - x_inner) / (x_outer - x_inner)))
            w = 3.0 * t * t - 2.0 * t * t * t
        
        offset = co - p_sh_R
        rotated = rot_R @ offset
        delta = (rotated - offset) * w
        deltas[i] = delta
    
    print(f"Applying displacements to Basis mesh and {len(mesh.shape_keys.key_blocks) if mesh.shape_keys else 0} shape keys...")
    
    # 1. Apply to mesh.vertices
    for i, delta in deltas.items():
        mesh.vertices[i].co += delta
        
    # 2. Apply to all shape keys
    if mesh.shape_keys:
        for kb in mesh.shape_keys.key_blocks:
            for i, delta in deltas.items():
                kb.data[i].co += delta
        print(f"Updated {len(mesh.shape_keys.key_blocks)} shape keys successfully!")
        
    # Update normals
    mesh.update()
    
    # Check new bounds
    new_l_xs = [mesh.vertices[i].co.x for i in left_arm]
    new_l_zs = [mesh.vertices[i].co.z for i in left_arm]
    print(f"Posed Left arm bounds: X=[{min(new_l_xs):.3f}, {max(new_l_xs):.3f}], Z=[{min(new_l_zs):.3f}, {max(new_l_zs):.3f}]")
    
    # Export to GLB
    print(f"Exporting to {output_path}...")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_materials='EXPORT',
        export_yup=True
    )
    print(f"Export complete: {os.path.getsize(output_path)} bytes.")
    return True

if __name__ == '__main__':
    female_in = r'C:\DressApp_AG\apps\web\public\models\avatar_female_1.glb'
    female_out = r'C:\DressApp_AG\apps\web\public\models\avatar_female_1.glb'
    
    male_in = r'C:\DressApp_AG\apps\web\public\models\avatar_male_1.glb'
    male_out = r'C:\DressApp_AG\apps\web\public\models\avatar_male_1.glb'
    
    # Execute for female
    pose_avatar(female_in, 'female', female_out)
    
    # Execute for male
    pose_avatar(male_in, 'male', male_out)
    
    print("\nAll avatars processed successfully!")
