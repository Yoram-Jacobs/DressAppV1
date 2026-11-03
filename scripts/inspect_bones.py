import bpy
import os

ROOT_DIR = os.path.abspath(".")
for gender in ["female", "male"]:
    glb_path = os.path.join(ROOT_DIR, "apps", "web", "public", "models", f"avatar_{gender}_1.glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    print(f"\nArmature for {gender}:", arms)
    if arms:
        arm = arms[0]
        for b in arm.data.bones:
            if any(k in b.name.lower() for k in ['shoulder', 'arm', 'elbow', 'wrist', 'hand', 'forearm', 'clavicle']):
                head_w = arm.matrix_world @ b.head_local
                tail_w = arm.matrix_world @ b.tail_local
                print(f"  Bone {b.name}: head=({head_w.x:.3f}, {head_w.y:.3f}, {head_w.z:.3f}), tail=({tail_w.x:.3f}, {tail_w.y:.3f}, {tail_w.z:.3f})")
