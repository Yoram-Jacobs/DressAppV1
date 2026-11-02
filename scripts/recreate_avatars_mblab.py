import bpy
import os
import json
import math
import mathutils

def recreate_avatar_mblab(gender, clean_glb_path, output_glb_path):
    print(f"\n=======================================================")
    print(f"Recreating {gender} avatar via Blender MB-Lab")
    print(f"=======================================================")
    
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module='MB-Lab-master')
    
    char_name = 'f_ca01' if gender == 'female' else 'm_ca01'
    arm_name = f"{char_name}_skeleton"
    
    # 1. Initialize character in MB-Lab
    bpy.context.scene.mblab_character_name = char_name
    bpy.context.scene.mblab_use_ik = False
    bpy.context.scene.mblab_use_muscle = False
    bpy.ops.mbast.init_character()
    
    arm = bpy.data.objects.get(arm_name)
    mb_mesh = bpy.data.objects.get(char_name)
    assert arm and mb_mesh, f"Failed to find MB-Lab objects {arm_name}, {char_name}"
    
    # 2. Load the baseline standing_in_lab pose
    addon_path = bpy.utils.user_resource('SCRIPTS', path='addons')
    pose_folder = 'female_poses' if gender == 'female' else 'male_poses'
    lab_pose_path = os.path.join(addon_path, 'MB-Lab-master', 'data', 'poses', pose_folder, 'standing_in_lab.json')
    with open(lab_pose_path, 'r') as fp:
        lab_data = json.load(fp)
        
    for b_name, rot in lab_data.items():
        if b_name in arm.pose.bones:
            arm.pose.bones[b_name].rotation_quaternion = rot
            
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    base_eval = mb_mesh.evaluated_get(depsgraph)
    base_coords = [v.co.copy() for v in base_eval.data.vertices]
    
    # 3. Slerp arm bones to natural A-pose (~27.5 degrees)
    # In standing_in_lab: ~6 degrees from vertical
    # In rest pose: 60 degrees from vertical
    # t=0.42 yields exactly ~27.5-28 degrees natural A-pose
    slerp_t = 0.42
    arm_bone_keywords = ('arm', 'hand', 'finger', 'thumb', 'index', 'middle', 'ring', 'pinky')
    arm_bones = [b for b in arm.pose.bones.keys() if ('_L' in b or '_R' in b) and any(k in b for k in arm_bone_keywords)]
    
    for b_name in arm_bones:
        q_lab = mathutils.Quaternion(lab_data.get(b_name, [1.0, 0.0, 0.0, 0.0]))
        q_rest = mathutils.Quaternion((1.0, 0.0, 0.0, 0.0))
        arm.pose.bones[b_name].rotation_quaternion = q_lab.slerp(q_rest, slerp_t)
        
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    posed_eval = mb_mesh.evaluated_get(depsgraph)
    posed_coords = [v.co.copy() for v in posed_eval.data.vertices]
    
    deltas_mb = [posed_coords[i] - base_coords[i] for i in range(len(base_coords))]
    max_mb_disp = max(d.length for d in deltas_mb)
    print(f"MB-Lab armature deformation evaluated. Max displacement on arms: {max_mb_disp:.4f}m")
    
    # Verify upper arm bone angle
    b_l = arm.pose.bones['upperarm_L']
    h = arm.matrix_world @ b_l.head
    t = arm.matrix_world @ b_l.tail
    vec = (t - h)
    angle = math.degrees(math.atan2(vec.x, -vec.z))
    print(f"Posed upperarm_L angle from vertical: {angle:.2f} degrees")
    
    # 4. Build spatial KD-tree of base MB-Lab mesh for sub-millimeter vertex transfer
    kd = mathutils.kdtree.KDTree(len(base_coords))
    for i, co in enumerate(base_coords):
        kd.insert(co, i)
    kd.balance()
    
    # 5. Import clean baseline avatar with 23 shape keys and hair materials
    print(f"Importing clean baseline avatar from {clean_glb_path}...")
    bpy.ops.import_scene.gltf(filepath=clean_glb_path)
    clean_obj = [o for o in bpy.data.objects if o != mb_mesh and o != arm and o.type == 'MESH'][0]
    clean_mesh = clean_obj.data
    n_verts = len(clean_mesh.vertices)
    print(f"Clean avatar loaded: {clean_obj.name} with {n_verts} vertices and {len(clean_mesh.polygons)} polygons.")
    
    # 6. Transfer MB-Lab deformation to clean avatar vertices using 4-nearest-neighbor IDW
    clean_deltas = []
    displaced_count = 0
    
    for v in clean_mesh.vertices:
        # Find 4 nearest neighbors on mb_mesh
        neighbors = kd.find_n(v.co, 4)
        # Check if the nearest point is on body and has deformation
        nearest_co, nearest_idx, nearest_dist = neighbors[0]
        
        if nearest_dist < 0.05 and any(deltas_mb[idx].length > 0.0001 for _, idx, _ in neighbors):
            # Compute inverse distance weighted average delta
            total_weight = 0.0
            accum_delta = mathutils.Vector((0.0, 0.0, 0.0))
            for _, idx, dist in neighbors:
                w = 1.0 / (dist + 0.0005)
                accum_delta += deltas_mb[idx] * w
                total_weight += w
            smooth_delta = accum_delta / total_weight
            clean_deltas.append(smooth_delta)
            displaced_count += 1
        else:
            clean_deltas.append(mathutils.Vector((0.0, 0.0, 0.0)))
            
    print(f"Deformation mapped to {displaced_count} / {n_verts} clean vertices ({n_verts - displaced_count} strictly stationary).")
    
    # 7. Apply deformation to Basis mesh
    for i, d in enumerate(clean_deltas):
        clean_mesh.vertices[i].co += d
        
    # 8. Apply exact same deformation to all shape keys
    if clean_mesh.shape_keys:
        num_keys = len(clean_mesh.shape_keys.key_blocks)
        print(f"Applying deformation to all {num_keys} shape keys...")
        for kb in clean_mesh.shape_keys.key_blocks:
            for i, d in enumerate(clean_deltas):
                kb.data[i].co += d
        print(f"All {num_keys} shape keys updated successfully.")
        
    clean_mesh.update()
    
    # 9. Quality Verification
    xs = [v.co.x for v in clean_mesh.vertices]
    ys = [v.co.y for v in clean_mesh.vertices]
    zs = [v.co.z for v in clean_mesh.vertices]
    print(f"Final Avatar Bounds: X=[{min(xs):.3f}, {max(xs):.3f}], Y=[{min(ys):.3f}, {max(ys):.3f}], Z=[{min(zs):.3f}, {max(zs):.3f}]")
    
    # Hip integrity check (Z in [0.70, 0.95], Y in [-0.2, 0.2], |X| < 0.25)
    hip_verts = [v.co for v in clean_mesh.vertices if 0.70 < v.co.z < 0.95 and abs(v.co.y) < 0.2 and abs(v.co.x) < 0.25]
    hip_xs = [v.x for v in hip_verts]
    print(f"Pelvis/Hip X bounds (must be intact ~0.19m): [{min(hip_xs):.3f}, {max(hip_xs):.3f}]")
    assert max(abs(min(hip_xs)), abs(max(hip_xs))) < 0.22, f"Hip distortion detected! max hip X={max(hip_xs)}"
    
    # Hand position check (must be lifted out to X ~ 0.35 - 0.45)
    hand_l = [v.co for v in clean_mesh.vertices if 0.70 < v.co.z < 0.95 and v.co.x > 0.25]
    print(f"Left Hand bounds: X=[{min(v.x for v in hand_l):.3f}, {max(v.x for v in hand_l):.3f}]")
    assert min(v.x for v in hand_l) > 0.28, "Arm lift failed! Hand is too close to body."
    
    # 10. Delete MB-Lab temp generator objects so only clean_obj is exported
    bpy.data.objects.remove(mb_mesh, do_unlink=True)
    bpy.data.objects.remove(arm, do_unlink=True)
    
    # Ensure clean_obj has correct canonical name
    clean_obj.name = char_name
    bpy.context.view_layer.objects.active = clean_obj
    clean_obj.select_set(True)
    
    # Export to GLB
    print(f"Exporting production GLB to {output_glb_path}...")
    bpy.ops.export_scene.gltf(
        filepath=output_glb_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_materials='EXPORT',
        export_yup=True
    )
    size_mb = os.path.getsize(output_glb_path) / (1024 * 1024)
    print(f"Export complete: {output_glb_path} ({size_mb:.2f} MB)")
    return True

if __name__ == '__main__':
    recreate_avatar_mblab('female', 'temp_f_clean.glb', 'apps/web/public/models/avatar_female_1.glb')
    recreate_avatar_mblab('male', 'temp_m_clean.glb', 'apps/web/public/models/avatar_male_1.glb')
