import bpy
import bmesh
import heapq
import math
import mathutils
import os
import json

def recreate_avatar_mblab(gender, clean_glb_path, output_glb_path, out_preview_path=None):
    print(f"\n=======================================================")
    print(f"Recreating {gender.upper()} Avatar via Geodesic MB-Lab Pipeline")
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
    
    # Remove subdivision modifiers so we operate directly on base MB-Lab mesh
    for mod in list(mb_mesh.modifiers):
        if mod.type == 'SUBSURF':
            mb_mesh.modifiers.remove(mod)
            
    # 2. Identify arm vertex groups in MB-Lab
    arm_vgroup_names = {
        'upperarm_L', 'upperarm_twist_L', 'lowerarm_L', 'lowerarm_twist_L', 'hand_L',
        'upperarm_R', 'upperarm_twist_R', 'lowerarm_R', 'lowerarm_twist_R', 'hand_R',
        'thumb01_L', 'thumb02_L', 'thumb03_L', 'index00_L', 'index01_L', 'index02_L', 'index03_L',
        'middle00_L', 'middle01_L', 'middle02_L', 'middle03_L', 'ring00_L', 'ring01_L', 'ring02_L', 'ring03_L',
        'pinky00_L', 'pinky01_L', 'pinky02_L', 'pinky03_L',
        'thumb01_R', 'thumb02_R', 'thumb03_R', 'index00_R', 'index01_R', 'index02_R', 'index03_R',
        'middle00_R', 'middle01_R', 'middle02_R', 'middle03_R', 'ring00_R', 'ring01_R', 'ring02_R', 'ring03_R',
        'pinky00_R', 'pinky01_R', 'pinky02_R', 'pinky03_R',
    }
    arm_vg_indices = {mb_mesh.vertex_groups[name].index for name in arm_vgroup_names if name in mb_mesh.vertex_groups}
    
    # 3. Load baseline standing_in_lab pose
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
    
    # Arm weights on base mesh
    mb_arm_weights = []
    for v in base_eval.data.vertices:
        arm_w = sum(g.weight for g in v.groups if g.group in arm_vg_indices)
        mb_arm_weights.append(arm_w)
        
    # 4. Slerp arm bones to natural A-pose (~27 degrees from vertical)
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
    
    # KD-Trees for Left and Right Arm on mb_mesh (ONLY arm vertices with weight > 0.05)
    kd_arm_L = mathutils.kdtree.KDTree(len(base_coords))
    kd_arm_R = mathutils.kdtree.KDTree(len(base_coords))
    for i, co in enumerate(base_coords):
        if mb_arm_weights[i] > 0.05:
            if co.x > 0:
                kd_arm_L.insert(co, i)
            else:
                kd_arm_R.insert(co, i)
    kd_arm_L.balance()
    kd_arm_R.balance()
    
    # 5. Import clean avatar GLB (baseline with 23 shape keys and hair materials)
    print(f"Importing clean baseline avatar from {clean_glb_path}...")
    bpy.ops.import_scene.gltf(filepath=clean_glb_path)
    clean_obj = [o for o in bpy.data.objects if o != mb_mesh and o != arm and o.type == 'MESH'][0]
    clean_mesh = clean_obj.data
    n_verts = len(clean_mesh.vertices)
    print(f"Clean avatar loaded: {clean_obj.name} with {n_verts} vertices.")
    
    bm = bmesh.new()
    bm.from_mesh(clean_mesh)
    bm.verts.ensure_lookup_table()
    
    # Find all connected components
    visited = set()
    components = []
    for v in bm.verts:
        if v.index in visited:
            continue
        c = []
        q = [v]
        visited.add(v.index)
        while q:
            curr = q.pop()
            c.append(curr.index)
            for e in curr.link_edges:
                nxt = e.other_vert(curr)
                if nxt.index not in visited:
                    visited.add(nxt.index)
                    q.append(nxt)
        components.append(c)
        
    # Classify components:
    # 1. Left hand: components where all verts have Z in [0.65, 1.05] and X > 0.18
    # 2. Right hand: components where all verts have Z in [0.65, 1.05] and X < -0.18
    # 3. Torso+arm: component with size > 1500 and X spanning [-0.20, 0.20]
    # 4. All other components (legs, feet, toenails, hair, underwear, bra, face, eyes): 100% stationary!
    weights = [0.0] * n_verts
    left_hand_verts = set()
    right_hand_verts = set()
    torso_arm_comp = None
    
    for c in components:
        xs = [bm.verts[i].co.x for i in c]
        zs = [bm.verts[i].co.z for i in c]
        min_x, max_x = min(xs), max(xs)
        min_z, max_z = min(zs), max(zs)
        
        # Torso+Arm component
        if len(c) > 1500 and min_x < -0.20 and max_x > 0.20:
            torso_arm_comp = c
            continue
            
        # Left Hand (palm, back, fingernails)
        if min_x > 0.18 and min_z > 0.65 and max_z < 1.05:
            for idx in c:
                weights[idx] = 1.0
                left_hand_verts.add(idx)
            continue
            
        # Right Hand (palm, back, fingernails)
        if max_x < -0.18 and min_z > 0.65 and max_z < 1.05:
            for idx in c:
                weights[idx] = 1.0
                right_hand_verts.add(idx)
            continue
            
    print(f"Components classified: Left Hand={len(left_hand_verts)}, Right Hand={len(right_hand_verts)}, Torso+Arm={len(torso_arm_comp)}")
    
    # 6. In Torso+Arm component, calculate Geodesic distance from wrists along edges
    z_wrist = 0.96 if gender == 'male' else 0.87
    x_wrist = 0.20 if gender == 'male' else 0.19
    
    lw_seeds = [bm.verts[i] for i in torso_arm_comp if abs(bm.verts[i].co.z - z_wrist) < 0.05 and bm.verts[i].co.x > x_wrist]
    rw_seeds = [bm.verts[i] for i in torso_arm_comp if abs(bm.verts[i].co.z - z_wrist) < 0.05 and bm.verts[i].co.x < -x_wrist]
    
    def run_dijkstra(seeds):
        dist = {}
        pq = []
        for sv in seeds:
            dist[sv.index] = 0.0
            heapq.heappush(pq, (0.0, sv.index))
        while pq:
            d, u_idx = heapq.heappop(pq)
            if d > dist[u_idx]:
                continue
            u = bm.verts[u_idx]
            for e in u.link_edges:
                v = e.other_vert(u)
                new_d = d + (v.co - u.co).length
                if v.index not in dist or new_d < dist[v.index]:
                    dist[v.index] = new_d
                    heapq.heappush(pq, (new_d, v.index))
        return dist
        
    d_left = run_dijkstra(lw_seeds)
    d_right = run_dijkstra(rw_seeds)
    
    d_full = 0.36
    d_trans = 0.48
    
    for idx in torso_arm_comp:
        if idx in d_left:
            d = d_left[idx]
            if d < d_full:
                weights[idx] = 1.0
            elif d < d_trans:
                t = (d - d_full) / (d_trans - d_full)
                weights[idx] = 0.5 * (1.0 + math.cos(math.pi * t))
                
        if idx in d_right:
            d = d_right[idx]
            if d < d_full:
                weights[idx] = 1.0
            elif d < d_trans:
                t = (d - d_full) / (d_trans - d_full)
                weights[idx] = 0.5 * (1.0 + math.cos(math.pi * t))
                
    w1 = sum(1 for w in weights if w == 1.0)
    w_trans = sum(1 for w in weights if 0.0 < w < 1.0)
    w0 = sum(1 for w in weights if w == 0.0)
    print(f"Weight distribution: Full Arm (w=1.0): {w1}, Shoulder Blend (0<w<1): {w_trans}, Stationary (w=0): {w0}")
    
    # 7. Compute per-vertex deltas via IDW on arm KD-trees scaled by geodesic weight
    clean_deltas = []
    for i, v in enumerate(clean_mesh.vertices):
        w = weights[i]
        if w <= 0.0001:
            clean_deltas.append(mathutils.Vector((0.0, 0.0, 0.0)))
            continue
            
        kd = kd_arm_L if v.co.x > 0 else kd_arm_R
        neighbors = kd.find_n(v.co, 4)
        
        total_w = 0.0
        accum_delta = mathutils.Vector((0.0, 0.0, 0.0))
        for _, n_idx, dist in neighbors:
            nw = 1.0 / (dist + 0.0005)
            accum_delta += deltas_mb[n_idx] * nw
            total_w += nw
        raw_delta = accum_delta / total_w
        clean_deltas.append(raw_delta * w)
        
    # 8. Apply deformation to Basis and all 23 shape keys
    print("Applying clean deformation to Basis mesh and all shape keys...")
    for i, d in enumerate(clean_deltas):
        clean_mesh.vertices[i].co += d
        
    if clean_mesh.shape_keys:
        num_keys = len(clean_mesh.shape_keys.key_blocks)
        print(f"Updating all {num_keys} shape keys...")
        for kb in clean_mesh.shape_keys.key_blocks:
            for i, d in enumerate(clean_deltas):
                kb.data[i].co += d
                
    clean_mesh.update()
    
    # 9. Verify Quality Constraints
    hip_verts = [v.co for v in clean_mesh.vertices if 0.70 < v.co.z < 0.95 and abs(v.co.y) < 0.2 and abs(v.co.x) < 0.25]
    hip_xs = [v.x for v in hip_verts]
    print(f"Pelvis/Hip X bounds: [{min(hip_xs):.3f}, {max(hip_xs):.3f}]")
    assert max(abs(min(hip_xs)), abs(max(hip_xs))) < 0.22, f"Hip distortion detected! max hip X={max(hip_xs)}"
    
    hand_l = [v.co for v in clean_mesh.vertices if 0.70 < v.co.z < 0.95 and v.co.x > 0.25]
    print(f"Left Hand bounds: X=[{min(v.x for v in hand_l):.3f}, {max(v.x for v in hand_l):.3f}]")
    assert min(v.x for v in hand_l) > 0.28, "Arm lift failed! Hand is too close to body."
    
    # 10. Delete MB-Lab temp generator objects so only clean_obj is exported
    bpy.data.objects.remove(mb_mesh, do_unlink=True)
    bpy.data.objects.remove(arm, do_unlink=True)
    
    # Optional Preview Render
    if out_preview_path:
        cam_data = bpy.data.cameras.new("Cam")
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = 2.0
        cam = bpy.data.objects.new("Cam", cam_data)
        bpy.context.collection.objects.link(cam)
        cam.location = (0, -2.5, 0.9)
        cam.rotation_euler = (1.5707963, 0, 0)
        bpy.context.scene.camera = cam
        
        light_data = bpy.data.lights.new("Sun", type='SUN')
        light_data.energy = 2.0
        light = bpy.data.objects.new("Sun", light_data)
        bpy.context.collection.objects.link(light)
        light.rotation_euler = (0.5, 0.3, 0.2)
        
        bpy.context.scene.render.engine = 'BLENDER_EEVEE'
        bpy.context.scene.render.image_settings.file_format = 'PNG'
        bpy.context.scene.render.filepath = os.path.abspath(out_preview_path)
        bpy.context.scene.render.resolution_x = 800
        bpy.context.scene.render.resolution_y = 1200
        bpy.ops.render.render(write_still=True)
        print(f"Rendered preview to {out_preview_path}")
        
    # 11. Export production GLB
    print(f"Exporting production GLB to {output_glb_path}...")
    bpy.ops.export_scene.gltf(
        filepath=output_glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_morph_tangent=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_draco_mesh_compression_enable=False
    )
    print(f"Export complete: {output_glb_path} ({os.path.getsize(output_glb_path)/(1024*1024):.2f} MB)")

if __name__ == '__main__':
    recreate_avatar_mblab(
        gender='female',
        clean_glb_path='temp_f_112b.glb',
        output_glb_path='apps/web/public/models/avatar_female_1.glb',
        out_preview_path='avatar_female_preview.png'
    )
    recreate_avatar_mblab(
        gender='male',
        clean_glb_path='temp_m_6c0.glb',
        output_glb_path='apps/web/public/models/avatar_male_1.glb',
        out_preview_path='avatar_male_preview.png'
    )
