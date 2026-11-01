# Canonical 3D Garment & Accessory GLB Template Generator
# Generates high-fidelity, manifold, UV-mapped 3D GLB models aligned to DressApp avatar measurements.

import os, math
import numpy as np
import trimesh

OUTPUT_DIRS = [
    'apps/web/public/models/templates',
    'assets/templates'
]

for d in OUTPUT_DIRS:
    os.makedirs(d, exist_ok=True)

def export_model(name, mesh):
    mesh.fix_normals()
    # Ensure every mesh has complete UVs for all vertices
    uv = getattr(mesh.visual, 'uv', None)
    if uv is None or len(uv) != len(mesh.vertices):
        v = mesh.vertices
        x_min, x_max = v[:, 0].min(), v[:, 0].max()
        y_min, y_max = v[:, 1].min(), v[:, 1].max()
        dx = max(1e-4, x_max - x_min)
        dy = max(1e-4, y_max - y_min)
        gen_uv = np.zeros((len(v), 2), dtype=np.float32)
        gen_uv[:, 0] = np.clip((v[:, 0] - x_min) / dx, 0.0, 1.0)
        gen_uv[:, 1] = np.clip((v[:, 1] - y_min) / dy, 0.0, 1.0)
        mesh.visual = trimesh.visual.TextureVisuals(uv=gen_uv)
    glb_bytes = mesh.export(file_type='glb')
    for d in OUTPUT_DIRS:
        path = os.path.join(d, f'{name}.glb')
        with open(path, 'wb') as f:
            f.write(glb_bytes)
    print(f'Exported {name}.glb: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces, {len(glb_bytes)} bytes')

def make_tube(slices, n_radial=32):
    """
    Constructs a smooth 3D hollow tube through an array of horizontal slices.
    Each slice specifies y, rx, rz_f, rz_b, cx, cz.
    """
    verts = []
    uvs = []
    n_slices = len(slices)
    y_min = slices[0]['y']
    y_max = slices[-1]['y']
    h = max(1e-4, y_max - y_min)

    for s_idx, s in enumerate(slices):
        y = s['y']
        rx = s['rx']
        rz_f = s.get('rz_f', s.get('rz', rx * 0.65))
        rz_b = s.get('rz_b', s.get('rz', rx * 0.65))
        cx = s.get('cx', 0.0)
        cz = s.get('cz', 0.0)
        v = (y - y_min) / h

        for r_idx in range(n_radial):
            theta = 2.0 * math.pi * r_idx / n_radial
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)
            x = cx + rx * cos_t
            rz = rz_f if sin_t >= 0 else rz_b
            z = cz + rz * sin_t
            verts.append([x, y, z])
            u = r_idx / float(n_radial)
            uvs.append([u, v])

    faces = []
    for s_idx in range(n_slices - 1):
        for r_idx in range(n_radial):
            next_r = (r_idx + 1) % n_radial
            p1 = s_idx * n_radial + r_idx
            p2 = s_idx * n_radial + next_r
            p3 = (s_idx + 1) * n_radial + r_idx
            p4 = (s_idx + 1) * n_radial + next_r
            faces.append([p1, p3, p2])
            faces.append([p2, p3, p4])

    verts = np.array(verts, dtype=np.float32)
    faces = np.array(faces, dtype=np.int32)
    uvs = np.array(uvs, dtype=np.float32)

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=uvs)
    return mesh

def make_cylinder_limb(p_start, p_end, r_start, r_end, n_radial=16, n_axial=8):
    """Generates a cylindrical sleeve / leg tube connecting p_start to p_end"""
    p_start = np.array(p_start, dtype=np.float32)
    p_end = np.array(p_end, dtype=np.float32)
    axis = p_end - p_start
    length = np.linalg.norm(axis)
    axis_dir = axis / max(1e-6, length)

    v_up = np.array([0, 1, 0], dtype=np.float32)
    if abs(np.dot(axis_dir, v_up)) > 0.9:
        v_up = np.array([1, 0, 0], dtype=np.float32)
    perp1 = np.cross(axis_dir, v_up)
    perp1 /= np.linalg.norm(perp1)
    perp2 = np.cross(axis_dir, perp1)

    verts = []
    uvs = []
    for a in range(n_axial):
        t = a / float(n_axial - 1)
        center = p_start + t * axis
        r = r_start + t * (r_end - r_start)
        for i in range(n_radial):
            theta = 2.0 * math.pi * i / n_radial
            offset = r * (math.cos(theta) * perp1 + math.sin(theta) * perp2)
            verts.append(center + offset)
            uvs.append([i / float(n_radial), t])

    faces = []
    for a in range(n_axial - 1):
        for i in range(n_radial):
            next_i = (i + 1) % n_radial
            p1 = a * n_radial + i
            p2 = a * n_radial + next_i
            p3 = (a + 1) * n_radial + i
            p4 = (a + 1) * n_radial + next_i
            faces.append([p1, p3, p2])
            faces.append([p2, p3, p4])

    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=np.array(uvs))
    return mesh

# ─── 1. SINGLET (Tank Top / Sleeveless) ───
def build_singlet():
    slices = [
        {'y': 0.98, 'rx': 0.160, 'rz_f': 0.110, 'rz_b': 0.110},
        {'y': 1.05, 'rx': 0.146, 'rz_f': 0.098, 'rz_b': 0.098},
        {'y': 1.15, 'rx': 0.176, 'rz_f': 0.114, 'rz_b': 0.100},
        {'y': 1.25, 'rx': 0.212, 'rz_f': 0.130, 'rz_b': 0.118},
        {'y': 1.34, 'rx': 0.200, 'rz_f': 0.108, 'rz_b': 0.102},
        {'y': 1.41, 'rx': 0.180, 'rz_f': 0.082, 'rz_b': 0.078},
    ]
    return make_tube(slices, n_radial=32)

# ─── 2. T-SHIRT (Short Sleeve Crewneck) ───
def build_tshirt():
    body_slices = [
        {'y': 0.98, 'rx': 0.168, 'rz_f': 0.115, 'rz_b': 0.115},
        {'y': 1.05, 'rx': 0.150, 'rz_f': 0.102, 'rz_b': 0.102},
        {'y': 1.15, 'rx': 0.180, 'rz_f': 0.118, 'rz_b': 0.104},
        {'y': 1.25, 'rx': 0.216, 'rz_f': 0.132, 'rz_b': 0.120},
        {'y': 1.36, 'rx': 0.210, 'rz_f': 0.108, 'rz_b': 0.100},
        {'y': 1.42, 'rx': 0.194, 'rz_f': 0.086, 'rz_b': 0.080},
    ]
    body = make_tube(body_slices, n_radial=32)
    sleeve_l = make_cylinder_limb([0.18, 1.38, 0.02], [0.24, 1.22, 0.01], 0.078, 0.068, n_radial=16, n_axial=6)
    sleeve_r = make_cylinder_limb([-0.18, 1.38, 0.02], [-0.24, 1.22, 0.01], 0.078, 0.068, n_radial=16, n_axial=6)
    return trimesh.util.concatenate([body, sleeve_l, sleeve_r])

# ─── 3. SHIRT (Long Sleeve Collared) ───
def build_shirt():
    body_slices = [
        {'y': 0.94, 'rx': 0.170, 'rz_f': 0.116, 'rz_b': 0.116},
        {'y': 1.05, 'rx': 0.152, 'rz_f': 0.104, 'rz_b': 0.104},
        {'y': 1.15, 'rx': 0.182, 'rz_f': 0.120, 'rz_b': 0.106},
        {'y': 1.25, 'rx': 0.218, 'rz_f': 0.134, 'rz_b': 0.122},
        {'y': 1.36, 'rx': 0.212, 'rz_f': 0.110, 'rz_b': 0.102},
        {'y': 1.42, 'rx': 0.195, 'rz_f': 0.088, 'rz_b': 0.082},
        {'y': 1.45, 'rx': 0.128, 'rz_f': 0.085, 'rz_b': 0.080},
    ]
    body = make_tube(body_slices, n_radial=32)
    sleeve_l = make_cylinder_limb([0.185, 1.38, 0.02], [0.265, 0.90, 0.00], 0.078, 0.052, n_radial=16, n_axial=10)
    sleeve_r = make_cylinder_limb([-0.185, 1.38, 0.02], [-0.265, 0.90, 0.00], 0.078, 0.052, n_radial=16, n_axial=10)
    return trimesh.util.concatenate([body, sleeve_l, sleeve_r])

# ─── 4. HOODIE / SWEATER ───
def build_hoodie():
    body_slices = [
        {'y': 0.90, 'rx': 0.180, 'rz_f': 0.125, 'rz_b': 0.125},
        {'y': 1.05, 'rx': 0.165, 'rz_f': 0.115, 'rz_b': 0.115},
        {'y': 1.15, 'rx': 0.195, 'rz_f': 0.132, 'rz_b': 0.118},
        {'y': 1.25, 'rx': 0.228, 'rz_f': 0.145, 'rz_b': 0.132},
        {'y': 1.36, 'rx': 0.220, 'rz_f': 0.122, 'rz_b': 0.114},
        {'y': 1.42, 'rx': 0.202, 'rz_f': 0.098, 'rz_b': 0.092},
    ]
    body = make_tube(body_slices, n_radial=32)
    sleeve_l = make_cylinder_limb([0.19, 1.38, 0.02], [0.27, 0.89, 0.00], 0.088, 0.058, n_radial=16, n_axial=10)
    sleeve_r = make_cylinder_limb([-0.19, 1.38, 0.02], [-0.27, 0.89, 0.00], 0.088, 0.058, n_radial=16, n_axial=10)
    hood_slices = [
        {'y': 1.42, 'rx': 0.135, 'rz_f': 0.090, 'rz_b': 0.095, 'cz': -0.04},
        {'y': 1.50, 'rx': 0.130, 'rz_f': 0.085, 'rz_b': 0.115, 'cz': -0.06},
        {'y': 1.58, 'rx': 0.100, 'rz_f': 0.065, 'rz_b': 0.095, 'cz': -0.07},
    ]
    hood = make_tube(hood_slices, n_radial=24)
    return trimesh.util.concatenate([body, sleeve_l, sleeve_r, hood])

# ─── 5. TRENCH COAT (Belter & Flared A-Line) ───
def build_trench_coat():
    slices = [
        {'y': 0.48, 'rx': 0.345, 'rz_f': 0.185, 'rz_b': 0.185},
        {'y': 0.65, 'rx': 0.295, 'rz_f': 0.170, 'rz_b': 0.170},
        {'y': 0.82, 'rx': 0.245, 'rz_f': 0.155, 'rz_b': 0.155},
        {'y': 0.95, 'rx': 0.215, 'rz_f': 0.145, 'rz_b': 0.145},
        {'y': 1.05, 'rx': 0.165, 'rz_f': 0.116, 'rz_b': 0.116},
        {'y': 1.15, 'rx': 0.192, 'rz_f': 0.130, 'rz_b': 0.118},
        {'y': 1.25, 'rx': 0.228, 'rz_f': 0.146, 'rz_b': 0.134},
        {'y': 1.36, 'rx': 0.222, 'rz_f': 0.125, 'rz_b': 0.116},
        {'y': 1.42, 'rx': 0.206, 'rz_f': 0.100, 'rz_b': 0.095},
        {'y': 1.46, 'rx': 0.140, 'rz_f': 0.095, 'rz_b': 0.090},
    ]
    coat_body = make_tube(slices, n_radial=36)
    sleeve_l = make_cylinder_limb([0.195, 1.39, 0.02], [0.275, 0.88, 0.00], 0.090, 0.065, n_radial=16, n_axial=10)
    sleeve_r = make_cylinder_limb([-0.195, 1.39, 0.02], [-0.275, 0.88, 0.00], 0.090, 0.065, n_radial=16, n_axial=10)
    belt_ring = make_tube([
        {'y': 1.03, 'rx': 0.170, 'rz_f': 0.122, 'rz_b': 0.122},
        {'y': 1.07, 'rx': 0.170, 'rz_f': 0.122, 'rz_b': 0.122}
    ], n_radial=24)
    return trimesh.util.concatenate([coat_body, sleeve_l, sleeve_r, belt_ring])

# ─── 6. CARDIGAN (Longline Open-Front) ───
def build_cardigan():
    slices = [
        {'y': 0.72, 'rx': 0.235, 'rz_f': 0.150, 'rz_b': 0.150},
        {'y': 0.85, 'rx': 0.210, 'rz_f': 0.140, 'rz_b': 0.140},
        {'y': 1.05, 'rx': 0.172, 'rz_f': 0.118, 'rz_b': 0.118},
        {'y': 1.15, 'rx': 0.195, 'rz_f': 0.132, 'rz_b': 0.118},
        {'y': 1.25, 'rx': 0.228, 'rz_f': 0.145, 'rz_b': 0.132},
        {'y': 1.36, 'rx': 0.220, 'rz_f': 0.122, 'rz_b': 0.114},
        {'y': 1.42, 'rx': 0.204, 'rz_f': 0.098, 'rz_b': 0.092},
    ]
    body = make_tube(slices, n_radial=32)
    sleeve_l = make_cylinder_limb([0.192, 1.38, 0.02], [0.270, 0.89, 0.00], 0.086, 0.058, n_radial=16, n_axial=10)
    sleeve_r = make_cylinder_limb([-0.192, 1.38, 0.02], [-0.270, 0.89, 0.00], 0.086, 0.058, n_radial=16, n_axial=10)
    return trimesh.util.concatenate([body, sleeve_l, sleeve_r])

# ─── 7. JACKET / BLAZER ───
def build_blazer():
    slices = [
        {'y': 0.82, 'rx': 0.215, 'rz_f': 0.142, 'rz_b': 0.142},
        {'y': 0.95, 'rx': 0.195, 'rz_f': 0.135, 'rz_b': 0.135},
        {'y': 1.05, 'rx': 0.165, 'rz_f': 0.116, 'rz_b': 0.116},
        {'y': 1.15, 'rx': 0.192, 'rz_f': 0.130, 'rz_b': 0.118},
        {'y': 1.25, 'rx': 0.226, 'rz_f': 0.144, 'rz_b': 0.130},
        {'y': 1.36, 'rx': 0.224, 'rz_f': 0.124, 'rz_b': 0.116},
        {'y': 1.43, 'rx': 0.215, 'rz_f': 0.100, 'rz_b': 0.095},
    ]
    body = make_tube(slices, n_radial=32)
    sleeve_l = make_cylinder_limb([0.20, 1.39, 0.02], [0.272, 0.89, 0.00], 0.088, 0.060, n_radial=16, n_axial=10)
    sleeve_r = make_cylinder_limb([-0.20, 1.39, 0.02], [-0.272, 0.89, 0.00], 0.088, 0.060, n_radial=16, n_axial=10)
    return trimesh.util.concatenate([body, sleeve_l, sleeve_r])

# ─── 8. KAFTAN / GALABIYE (Flowing Full-Length Robe) ───
def build_kaftan():
    slices = [
        {'y': 0.18, 'rx': 0.380, 'rz_f': 0.250, 'rz_b': 0.250},
        {'y': 0.45, 'rx': 0.340, 'rz_f': 0.230, 'rz_b': 0.230},
        {'y': 0.70, 'rx': 0.300, 'rz_f': 0.210, 'rz_b': 0.210},
        {'y': 0.95, 'rx': 0.260, 'rz_f': 0.185, 'rz_b': 0.185},
        {'y': 1.05, 'rx': 0.245, 'rz_f': 0.175, 'rz_b': 0.175},
        {'y': 1.25, 'rx': 0.240, 'rz_f': 0.165, 'rz_b': 0.155},
        {'y': 1.38, 'rx': 0.230, 'rz_f': 0.135, 'rz_b': 0.125},
        {'y': 1.44, 'rx': 0.205, 'rz_f': 0.105, 'rz_b': 0.098},
    ]
    robe = make_tube(slices, n_radial=36)
    sleeve_l = make_cylinder_limb([0.19, 1.38, 0.02], [0.29, 0.88, 0.00], 0.105, 0.135, n_radial=20, n_axial=10)
    sleeve_r = make_cylinder_limb([-0.19, 1.38, 0.02], [-0.29, 0.88, 0.00], 0.105, 0.135, n_radial=20, n_axial=10)
    return trimesh.util.concatenate([robe, sleeve_l, sleeve_r])

# ─── 9. PANTS (Full Length Trousers) ───
def build_pants():
    pelvis_slices = [
        {'y': 0.82, 'rx': 0.192, 'rz_f': 0.120, 'rz_b': 0.120},
        {'y': 0.95, 'rx': 0.175, 'rz_f': 0.125, 'rz_b': 0.125},
        {'y': 1.05, 'rx': 0.148, 'rz_f': 0.100, 'rz_b': 0.100},
    ]
    pelvis = make_tube(pelvis_slices, n_radial=32)
    leg_l = make_cylinder_limb([0.088, 0.82, 0.015], [0.080, 0.10, 0.010], 0.088, 0.062, n_radial=16, n_axial=12)
    leg_r = make_cylinder_limb([-0.088, 0.82, 0.015], [-0.080, 0.10, 0.010], 0.088, 0.062, n_radial=16, n_axial=12)
    return trimesh.util.concatenate([pelvis, leg_l, leg_r])

# ─── 10. SHORTS (Mid-Thigh) ───
def build_shorts():
    pelvis_slices = [
        {'y': 0.82, 'rx': 0.192, 'rz_f': 0.120, 'rz_b': 0.120},
        {'y': 0.95, 'rx': 0.175, 'rz_f': 0.125, 'rz_b': 0.125},
        {'y': 1.05, 'rx': 0.148, 'rz_f': 0.100, 'rz_b': 0.100},
    ]
    pelvis = make_tube(pelvis_slices, n_radial=32)
    leg_l = make_cylinder_limb([0.090, 0.82, 0.015], [0.092, 0.62, 0.015], 0.092, 0.085, n_radial=16, n_axial=6)
    leg_r = make_cylinder_limb([-0.090, 0.82, 0.015], [-0.092, 0.62, 0.015], 0.092, 0.085, n_radial=16, n_axial=6)
    return trimesh.util.concatenate([pelvis, leg_l, leg_r])

# ─── 11. BERMUDA (Knee Length) ───
def build_bermuda():
    pelvis_slices = [
        {'y': 0.82, 'rx': 0.192, 'rz_f': 0.120, 'rz_b': 0.120},
        {'y': 0.95, 'rx': 0.175, 'rz_f': 0.125, 'rz_b': 0.125},
        {'y': 1.05, 'rx': 0.148, 'rz_f': 0.100, 'rz_b': 0.100},
    ]
    pelvis = make_tube(pelvis_slices, n_radial=32)
    leg_l = make_cylinder_limb([0.088, 0.82, 0.015], [0.085, 0.46, 0.012], 0.090, 0.076, n_radial=16, n_axial=8)
    leg_r = make_cylinder_limb([-0.088, 0.82, 0.015], [-0.085, 0.46, 0.012], 0.090, 0.076, n_radial=16, n_axial=8)
    return trimesh.util.concatenate([pelvis, leg_l, leg_r])

# ─── 12. SKIRT A-LINE ───
def build_skirt_aline():
    slices = [
        {'y': 0.48, 'rx': 0.320, 'rz_f': 0.200, 'rz_b': 0.200},
        {'y': 0.68, 'rx': 0.260, 'rz_f': 0.170, 'rz_b': 0.170},
        {'y': 0.85, 'rx': 0.210, 'rz_f': 0.145, 'rz_b': 0.145},
        {'y': 0.95, 'rx': 0.176, 'rz_f': 0.126, 'rz_b': 0.126},
        {'y': 1.05, 'rx': 0.146, 'rz_f': 0.098, 'rz_b': 0.098},
    ]
    return make_tube(slices, n_radial=32)

# ─── 13. SKIRT PENCIL ───
def build_skirt_pencil():
    slices = [
        {'y': 0.48, 'rx': 0.155, 'rz_f': 0.105, 'rz_b': 0.105},
        {'y': 0.68, 'rx': 0.172, 'rz_f': 0.116, 'rz_b': 0.116},
        {'y': 0.85, 'rx': 0.188, 'rz_f': 0.126, 'rz_b': 0.126},
        {'y': 0.95, 'rx': 0.175, 'rz_f': 0.124, 'rz_b': 0.124},
        {'y': 1.05, 'rx': 0.146, 'rz_f': 0.098, 'rz_b': 0.098},
    ]
    return make_tube(slices, n_radial=32)

# ─── 14. DRESS (A-Line Day Dress) ───
def build_dress():
    slices = [
        {'y': 0.48, 'rx': 0.320, 'rz_f': 0.200, 'rz_b': 0.200},
        {'y': 0.68, 'rx': 0.260, 'rz_f': 0.170, 'rz_b': 0.170},
        {'y': 0.88, 'rx': 0.200, 'rz_f': 0.138, 'rz_b': 0.138},
        {'y': 1.05, 'rx': 0.146, 'rz_f': 0.098, 'rz_b': 0.098},
        {'y': 1.15, 'rx': 0.176, 'rz_f': 0.114, 'rz_b': 0.100},
        {'y': 1.25, 'rx': 0.212, 'rz_f': 0.130, 'rz_b': 0.118},
        {'y': 1.36, 'rx': 0.204, 'rz_f': 0.104, 'rz_b': 0.098},
        {'y': 1.42, 'rx': 0.188, 'rz_f': 0.084, 'rz_b': 0.078},
    ]
    return make_tube(slices, n_radial=32)

# ─── 15. HAT: BASEBALL CAP ───
def build_hat_cap():
    dome_slices = [
        {'y': 1.62, 'rx': 0.102, 'rz_f': 0.108, 'rz_b': 0.108, 'cz': 0.01},
        {'y': 1.66, 'rx': 0.098, 'rz_f': 0.102, 'rz_b': 0.102, 'cz': 0.01},
        {'y': 1.70, 'rx': 0.075, 'rz_f': 0.080, 'rz_b': 0.080, 'cz': 0.01},
        {'y': 1.72, 'rx': 0.035, 'rz_f': 0.040, 'rz_b': 0.040, 'cz': 0.01},
    ]
    dome = make_tube(dome_slices, n_radial=24)
    visor_box = trimesh.creation.box(extents=[0.15, 0.008, 0.085])
    visor_box.apply_translation([0.0, 1.62, 0.135])
    return trimesh.util.concatenate([dome, visor_box])

# ─── 16. HAT: FEDORA ───
def build_hat_fedora():
    crown_slices = [
        {'y': 1.62, 'rx': 0.098, 'rz_f': 0.104, 'rz_b': 0.104, 'cz': 0.01},
        {'y': 1.67, 'rx': 0.092, 'rz_f': 0.098, 'rz_b': 0.098, 'cz': 0.01},
        {'y': 1.73, 'rx': 0.082, 'rz_f': 0.088, 'rz_b': 0.088, 'cz': 0.01},
    ]
    crown = make_tube(crown_slices, n_radial=24)
    brim_slices = [
        {'y': 1.618, 'rx': 0.165, 'rz_f': 0.175, 'rz_b': 0.175, 'cz': 0.01},
        {'y': 1.622, 'rx': 0.098, 'rz_f': 0.104, 'rz_b': 0.104, 'cz': 0.01},
    ]
    brim = make_tube(brim_slices, n_radial=28)
    return trimesh.util.concatenate([crown, brim])

# ─── 17. BAG: HANDBAG / TOTE ───
def build_bag_handbag():
    body = trimesh.creation.box(extents=[0.24, 0.20, 0.10])
    body.apply_translation([0.28, 0.65, 0.02])
    h1 = trimesh.creation.cylinder(radius=0.008, height=0.18, sections=12)
    # Rotate cylinder 90 deg along Z axis
    rot = np.eye(4)
    rot[0, 0] = 0; rot[0, 1] = -1
    rot[1, 0] = 1; rot[1, 1] = 0
    h1.apply_transform(rot)
    h1.apply_translation([0.28, 0.76, 0.02])
    return trimesh.util.concatenate([body, h1])

# ─── 18. BAG: CROSSBODY ───
def build_bag_crossbody():
    pouch = trimesh.creation.box(extents=[0.18, 0.14, 0.06])
    pouch.apply_translation([0.18, 0.94, 0.10])
    strap = make_cylinder_limb([-0.16, 1.42, 0.03], [0.18, 0.95, 0.10], 0.016, 0.016, n_radial=8, n_axial=8)
    return trimesh.util.concatenate([pouch, strap])

# ─── 19. BELT (Waistband with Buckle) ───
def build_belt():
    ring = make_tube([
        {'y': 1.035, 'rx': 0.148, 'rz_f': 0.100, 'rz_b': 0.100},
        {'y': 1.065, 'rx': 0.148, 'rz_f': 0.100, 'rz_b': 0.100}
    ], n_radial=32)
    buckle = trimesh.creation.box(extents=[0.048, 0.038, 0.008])
    buckle.apply_translation([0.0, 1.050, 0.102])
    return trimesh.util.concatenate([ring, buckle])

TEMPLATES = {
    'singlet': build_singlet,
    'tshirt': build_tshirt,
    'shirt': build_shirt,
    'hoodie': build_hoodie,
    'trench_coat': build_trench_coat,
    'cardigan': build_cardigan,
    'jacket_blazer': build_blazer,
    'kaftan': build_kaftan,
    'pants': build_pants,
    'shorts': build_shorts,
    'bermuda': build_bermuda,
    'skirt_aline': build_skirt_aline,
    'skirt_pencil': build_skirt_pencil,
    'dress': build_dress,
    'hat_cap': build_hat_cap,
    'hat_fedora': build_hat_fedora,
    'bag_handbag': build_bag_handbag,
    'bag_crossbody': build_bag_crossbody,
    'belt': build_belt,
}

if __name__ == '__main__':
    print(f'Starting generation of {len(TEMPLATES)} canonical 3D GLB templates...')
    for name, builder_fn in TEMPLATES.items():
        try:
            m = builder_fn()
            export_model(name, m)
        except Exception as e:
            print(f'ERROR building {name}: {e}')
    print('All canonical 3D GLB templates successfully generated!')
