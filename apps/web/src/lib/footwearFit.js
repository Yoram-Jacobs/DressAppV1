import * as THREE from 'three';

/**
 * Footwear Fit
 *
 * Fits 3D footwear around the avatar's actual feet and, for heeled shoes,
 * re-poses the avatar: the heel is raised, the foot pivots about the ball of
 * the foot, toes stay flat on the floor and the whole body is lifted.
 *
 * All profiles are measured from avatar_female_1.glb / avatar_male_1.glb
 * (base, un-morphed coordinates, metres, avatar facing +Z). Profiles describe
 * the +X foot; the other foot is mirrored.
 */

export const FOOT_PROFILE_FEMALE = [
  { z: -0.013, x0: 0.144, x1: 0.181, top: 0.124 },
  { z: 0.005, x0: 0.134, x1: 0.195, top: 0.129 },
  { z: 0.023, x0: 0.134, x1: 0.205, top: 0.129 },
  { z: 0.041, x0: 0.135, x1: 0.205, top: 0.124 },
  { z: 0.059, x0: 0.137, x1: 0.208, top: 0.129 },
  { z: 0.077, x0: 0.140, x1: 0.212, top: 0.117 },
  { z: 0.095, x0: 0.141, x1: 0.214, top: 0.093 },
  { z: 0.113, x0: 0.137, x1: 0.215, top: 0.072 },
  { z: 0.131, x0: 0.131, x1: 0.216, top: 0.056 },
  { z: 0.149, x0: 0.125, x1: 0.216, top: 0.050 },
  { z: 0.167, x0: 0.125, x1: 0.215, top: 0.038 },
  { z: 0.185, x0: 0.125, x1: 0.215, top: 0.029 },
  { z: 0.203, x0: 0.130, x1: 0.213, top: 0.023 },
  { z: 0.221, x0: 0.131, x1: 0.203, top: 0.020 },
  { z: 0.239, x0: 0.134, x1: 0.172, top: 0.017 },
];

export const FOOT_PROFILE_MALE = [
  { z: -0.070, x0: 0.133, x1: 0.173, top: 0.060 },
  { z: -0.051, x0: 0.117, x1: 0.183, top: 0.128 },
  { z: -0.032, x0: 0.107, x1: 0.192, top: 0.121 },
  { z: -0.013, x0: 0.107, x1: 0.192, top: 0.118 },
  { z: 0.006, x0: 0.113, x1: 0.194, top: 0.125 },
  { z: 0.025, x0: 0.118, x1: 0.196, top: 0.128 },
  { z: 0.044, x0: 0.115, x1: 0.200, top: 0.103 },
  { z: 0.063, x0: 0.108, x1: 0.200, top: 0.081 },
  { z: 0.082, x0: 0.098, x1: 0.201, top: 0.071 },
  { z: 0.101, x0: 0.096, x1: 0.201, top: 0.058 },
  { z: 0.120, x0: 0.096, x1: 0.200, top: 0.044 },
  { z: 0.140, x0: 0.099, x1: 0.201, top: 0.033 },
  { z: 0.159, x0: 0.098, x1: 0.200, top: 0.024 },
  { z: 0.178, x0: 0.100, x1: 0.185, top: 0.019 },
  { z: 0.197, x0: 0.105, x1: 0.149, top: 0.017 },
];

// Lower-leg cross sections used for boot shafts (+X leg)
const SHAFT_PROFILE_FEMALE = [
  { y: 0.10, cx: 0.166, rx: 0.028, cz: 0.035, rz: 0.045 },
  { y: 0.20, cx: 0.165, rx: 0.030, cz: 0.028, rz: 0.040 },
  { y: 0.35, cx: 0.151, rx: 0.048, cz: 0.020, rz: 0.052 },
  { y: 0.50, cx: 0.128, rx: 0.052, cz: 0.038, rz: 0.055 },
];
const SHAFT_PROFILE_MALE = [
  { y: 0.10, cx: 0.142, rx: 0.033, cz: -0.002, rz: 0.048 },
  { y: 0.20, cx: 0.148, rx: 0.036, cz: 0.005, rz: 0.044 },
  { y: 0.35, cx: 0.142, rx: 0.052, cz: 0.012, rz: 0.056 },
  { y: 0.50, cx: 0.130, rx: 0.056, cz: 0.022, rz: 0.058 },
];

export function getFootAnatomy(isMale) {
  if (isMale) {
    return {
      profile: FOOT_PROFILE_MALE,
      shaft: SHAFT_PROFILE_MALE,
      heelZ: -0.070,
      toeZ: 0.197,
      ballZ: 0.122,
      heelContactZ: -0.048,
      ankleY: 0.085,
      ankleZ: -0.005,
    };
  }
  return {
    profile: FOOT_PROFILE_FEMALE,
    shaft: SHAFT_PROFILE_FEMALE,
    heelZ: -0.013,
    toeZ: 0.239,
    ballZ: 0.168,
    heelContactZ: 0.008,
    ankleY: 0.085,
    ankleZ: 0.035,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function sampleProfile(profile, key, value) {
  if (value <= profile[0][key]) return { ...profile[0] };
  const last = profile[profile.length - 1];
  if (value >= last[key]) return { ...last };
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    if (value >= a[key] && value <= b[key]) {
      const t = (value - a[key]) / (b[key] - a[key]);
      const out = {};
      Object.keys(a).forEach((k) => {
        out[k] = lerp(a[k], b[k], t);
      });
      return out;
    }
  }
  return { ...last };
}

/**
 * Classifies a footwear item and returns its fit parameters.
 * heelHeight is the rise of the heel above the toes (metres).
 */
export function resolveFootwearSpec(garment) {
  const text = [
    garment?.name,
    garment?.title,
    garment?.sub_category,
    garment?.item_type,
    garment?.category,
    garment?.rawItem?.name,
    garment?.rawItem?.sub_category,
    garment?.rawItem?.item_type,
    garment?.rawItem?.heel_type,
    garment?.rawItem?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const has = (re) => re.test(text);
  const explicitHeel = Number(garment?.rawItem?.heel_height_cm || garment?.heel_height_cm);

  const isAnkleBoot = has(/ankle\s*boot|bootie|chelsea|מגפונ|bottines?|stiefelette|botin|ботильон|短靴|ショートブーツ/);
  const isBoot = !isAnkleBoot && has(/boots?\b|מגפ|bottes|stiefel|botas|stivali|сапог|靴子|ブーツ|جزمة/);
  const isSneaker = has(/sneaker|trainer|running|סניקרס|נעלי ספורט|basket|zapatilla|кроссовк|运动鞋|スニーカー/);
  const isSandal = has(/sandal|flip.?flop|slide|סנדל|כפכפ|sandale|sandalia|сандал|凉鞋|サンダル|صندل/);

  let heelHeight = 0;
  if (has(/stiletto|סטילטו/)) heelHeight = 0.10;
  else if (has(/kitten/)) heelHeight = 0.045;
  else if (has(/wedge|platform|פלטפורמ|טריז/)) heelHeight = 0.07;
  else if (has(/block\s*heel|עקב רחב/)) heelHeight = 0.06;
  else if (has(/heels?\b|high.?heel|pumps?\b|עקב|עקבים|talon|tacón|tacco|absatz|каблук|高跟|ヒール|كعب/)) heelHeight = 0.08;
  if (Number.isFinite(explicitHeel) && explicitHeel > 0) heelHeight = Math.min(0.13, explicitHeel / 100);
  // Boots usually carry a modest heel unless explicitly heeled
  if ((isBoot || isAnkleBoot) && heelHeight === 0) heelHeight = 0.025;

  const heelStyle = has(/stiletto|סטילטו|kitten/) ? 'stiletto'
    : has(/wedge|טריז/) ? 'wedge'
      : has(/platform|פלטפורמ/) ? 'platform'
        : 'block';

  let kind = 'flat';
  let collar = 0.055;
  let soleThickness = 0.012;
  if (isBoot) { kind = 'boot'; collar = 0.40; soleThickness = 0.016; }
  else if (isAnkleBoot) { kind = 'ankle_boot'; collar = 0.17; soleThickness = 0.016; }
  else if (isSneaker) { kind = 'sneaker'; collar = 0.075; soleThickness = 0.022; }
  else if (isSandal) { kind = 'sandal'; collar = 0.035; soleThickness = 0.012; }
  if (heelHeight >= 0.04 && kind === 'flat') { kind = 'heel'; collar = 0.045; soleThickness = 0.008; }

  return { kind, heelHeight, heelStyle, collar, soleThickness };
}

/**
 * Computes the rigid foot pose for a given heel height. The foot pivots about
 * the ball of the foot so the heel rises by heelHeight; the body is lifted by
 * the resulting ankle rise plus the sole thickness.
 */
export function computeFootPose(isMale, heelHeight = 0, soleThickness = 0) {
  const a = getFootAnatomy(isMale);
  const lever = a.ballZ - a.heelContactZ;
  const theta = heelHeight > 0 ? Math.asin(Math.min(0.85, heelHeight / lever)) : 0;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const dz0 = a.ankleZ - a.ballZ;
  const dy0 = a.ankleY;
  const ankleY2 = dy0 * c - dz0 * s;
  const ankleZ2 = a.ballZ + dz0 * c + dy0 * s;
  const lift = ankleY2 - a.ankleY;
  const shiftZ = ankleZ2 - a.ankleZ;
  return {
    active: theta > 1e-4,
    theta,
    cos: c,
    sin: s,
    lift,
    shiftZ,
    soleThickness,
    heelHeight,
    groupLift: lift + soleThickness,
    anatomy: a,
  };
}

/**
 * Per-vertex blend weights for the foot pose (computed in base coordinates).
 */
function poseWeights(x, y, z, a) {
  if (Math.abs(x) < 0.05 || y > a.ankleY + 0.06) return null;
  const wFoot = smoothstep(a.ankleY + 0.055, a.ankleY - 0.005, y);
  if (wFoot <= 0) return null;
  const wToe = smoothstep(a.ballZ - 0.012, a.ballZ + 0.02, z);
  return { wFoot, wToe };
}

/**
 * Applies the foot pose to a point (base coords) and writes into out.
 * Returns the linear part blend factor so callers can transform deltas.
 */
export function poseFootPoint(x, y, z, pose, out) {
  out.x = x; out.y = y; out.z = z;
  if (!pose?.active) return null;
  const a = pose.anatomy;
  const w = poseWeights(x, y, z, a);
  if (!w) return null;
  const { cos: c, sin: s, lift, shiftZ } = pose;
  // Foot transform: rotate about ball pivot (y=0, z=ballZ), then re-anchor ankle
  const dz = z - a.ballZ;
  const fy = y * c - dz * s - lift;
  const fz = a.ballZ + dz * c + y * s - shiftZ;
  // Toe transform: stay flat, translate with the ball
  const ty = y - lift;
  const tz = z - shiftZ;
  const py = lerp(fy, ty, w.wToe);
  const pz = lerp(fz, tz, w.wToe);
  out.y = lerp(y, py, w.wFoot);
  out.z = lerp(z, pz, w.wFoot);
  return w;
}

/** Transforms a displacement vector (dy, dz) with the blended linear part. */
function poseDelta(dy, dz, w, pose) {
  const { cos: c, sin: s } = pose;
  const ry = dy * c - dz * s;
  const rz = dz * c + dy * s;
  const fy = lerp(ry, dy, w.wToe);
  const fz = lerp(rz, dz, w.wToe);
  return [lerp(dy, fy, w.wFoot), lerp(dz, fz, w.wFoot)];
}

/**
 * Re-poses an avatar mesh geometry in place (positions + relative morph
 * target deltas). Pass a fresh clone of the original geometry.
 */
export function poseAvatarGeometry(geometry, pose) {
  if (!geometry || !pose?.active) return geometry;
  const pos = geometry.attributes.position;
  const morphs = geometry.morphAttributes?.position || [];
  const relative = geometry.morphTargetsRelative !== false;
  const out = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const w = poseFootPoint(x, y, z, pose, out);
    if (!w) continue;
    pos.setXYZ(i, out.x, out.y, out.z);
    for (let m = 0; m < morphs.length; m++) {
      const attr = morphs[m];
      if (relative) {
        const [dy, dz] = poseDelta(attr.getY(i), attr.getZ(i), w, pose);
        attr.setY(i, dy);
        attr.setZ(i, dz);
      }
    }
  }
  pos.needsUpdate = true;
  morphs.forEach((m) => { m.needsUpdate = true; });
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Applies the foot pose to every vertex of a (garment) geometry. */
export function poseGeometry(geometry, pose) {
  if (!geometry || !pose?.active) return geometry;
  const out = geometry.clone();
  const pos = out.attributes.position;
  const p = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    poseFootPoint(pos.getX(i), pos.getY(i), pos.getZ(i), pose, p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/**
 * Maps a point on the shoe to texture coordinates according to the
 * product-photo layout (pair top view, single top view, or single side view).
 */
function shoeUV(side, x, y, z, frame, layout) {
  const { x0, x1, z0, z1, yTop } = frame;
  const along = (z - z0) / (z1 - z0); // 0 heel -> 1 toe
  const across = (x - x0) / (x1 - x0); // 0 at -X edge -> 1 at +X edge
  const mode = layout?.mode || 'pair';

  if (mode === 'side') {
    // Side view: u along the shoe length, v up the shoe height
    const toeLeft = layout?.toeLeft !== false;
    const u = toeLeft ? 1 - along : along;
    const v = Math.max(0.02, Math.min(0.98, 0.04 + (y / Math.max(0.04, yTop)) * 0.9));
    return [Math.max(0.02, Math.min(0.98, 0.03 + u * 0.94)), v];
  }

  // Top view: toes point down in the photo (v low), heel opening up (v high)
  const v = Math.max(0.02, Math.min(0.98, 0.98 - along * 0.96));
  if (mode === 'pair') {
    const split = layout?.splitU ?? 0.5;
    // Avatar faces the camera: the -X foot appears on the image's left
    const [u0, u1] = side < 0 ? [0.01, split - 0.01] : [split + 0.01, 0.99];
    return [u0 + Math.max(0, Math.min(1, across)) * (u1 - u0), v];
  }
  return [0.02 + Math.max(0, Math.min(1, across)) * 0.96, v];
}

/**
 * Builds a closed shoe shell (upper + outsole) wrapped around both feet in
 * base foot coordinates, plus an optional boot shaft.
 */
export function createFittedFootwearGeometry({ isMale = false, spec, layout } = {}) {
  const a = getFootAnatomy(isMale);
  const s = spec || resolveFootwearSpec(null);
  const off = 0.007; // upper clearance over the skin
  const sole = s.soleThickness;
  const z0 = a.heelZ - 0.012;
  const z1 = a.toeZ + 0.014;
  const nz = 30;
  const nArch = 20;
  const nSole = 6;
  const ring = nArch + nSole; // closed loop: arch (inner->top->outer) + sole (outer->inner)

  const verts = [];
  const uvs = [];
  const indices = [];

  [-1, 1].forEach((side) => {
    const startIdx = verts.length / 3;
    // Texture frame spans the actual foot width
    const minX = Math.min(...a.profile.map((q) => q.x0)) - off;
    const maxX = Math.max(...a.profile.map((q) => q.x1)) + off;
    const frame = {
      x0: side > 0 ? minX : -maxX,
      x1: side > 0 ? maxX : -minX,
      z0,
      z1,
      yTop: Math.min(s.collar, 0.14),
    };

    for (let i = 0; i <= nz; i++) {
      const t = i / nz;
      const z = lerp(z0, z1, t);
      const p = sampleProfile(a.profile, 'z', z);
      // Rounded heel counter and toe box in plan view
      const tc = (t - 0.5) * 2;
      const round = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(tc), 4)), 0.25);
      const cxR = (p.x0 + p.x1) / 2;
      const hw = ((p.x1 - p.x0) / 2 + off) * Math.max(0.05, round);
      const cx = side * cxR;
      const footTop = p.top + off;
      const capTop = Math.min(footTop, s.collar);
      const archTop = Math.max(0.012, capTop * Math.max(0.35, round));

      for (let j = 0; j < ring; j++) {
        let x;
        let y;
        if (j < nArch) {
          // Arch from inner sole edge, over the top, to outer sole edge
          const phi = Math.PI * (j / (nArch - 1));
          const cphi = Math.cos(phi);
          const sphi = Math.sin(phi);
          const ex = Math.sign(cphi) * Math.pow(Math.abs(cphi), 0.7);
          const ey = Math.pow(sphi, 0.8);
          x = cx + side * hw * ex;
          y = archTop * ey;
        } else {
          // Outsole underside from outer edge back to inner edge
          const k = (j - nArch) / (nSole - 1);
          x = cx + side * hw * lerp(-1, 1, k);
          y = -sole;
        }
        verts.push(x, y, z);
        uvs.push(...shoeUV(side, x, Math.max(0, y), z, frame, layout));
      }
    }

    for (let i = 0; i < nz; i++) {
      for (let j = 0; j < ring; j++) {
        const jn = (j + 1) % ring;
        const a0 = startIdx + i * ring + j;
        const b0 = startIdx + i * ring + jn;
        const c0 = startIdx + (i + 1) * ring + j;
        const d0 = startIdx + (i + 1) * ring + jn;
        indices.push(a0, c0, b0, b0, c0, d0);
      }
    }

    // Boot shaft: tube following the lower leg up to the collar height
    if (s.kind === 'boot' || s.kind === 'ankle_boot') {
      const shaftStart = verts.length / 3;
      const ny = 12;
      const nTheta = 20;
      const yStart = 0.06;
      const yEnd = s.collar;
      for (let i = 0; i <= ny; i++) {
        const y = lerp(yStart, yEnd, i / ny);
        const sp = sampleProfile(a.shaft, 'y', y);
        for (let j = 0; j <= nTheta; j++) {
          const th = -Math.PI + (j / nTheta) * Math.PI * 2;
          const x = side * sp.cx + (sp.rx + off) * Math.sin(th);
          const z = sp.cz + (sp.rz + off) * Math.cos(th);
          verts.push(x, y, z);
          if (layout?.mode === 'side') {
            uvs.push(0.5 + Math.sin(th) * 0.2, Math.min(0.98, 0.3 + (y / yEnd) * 0.66));
          } else {
            uvs.push(layout?.solidU ?? 0.5, layout?.solidV ?? 0.5);
          }
        }
      }
      for (let i = 0; i < ny; i++) {
        for (let j = 0; j < nTheta; j++) {
          const a0 = shaftStart + i * (nTheta + 1) + j;
          const b0 = a0 + 1;
          const c0 = a0 + (nTheta + 1);
          const d0 = c0 + 1;
          indices.push(a0, c0, b0, b0, c0, d0);
        }
      }
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the heel posts (or wedge blocks) for heeled footwear in the posed,
 * lifted local frame. Returns null for flat footwear.
 */
export function createHeelGeometry({ isMale = false, spec, pose } = {}) {
  if (!pose?.active || !spec || spec.heelHeight < 0.02) return null;
  const a = pose.anatomy;
  const floorY = -pose.groupLift;
  const verts = [];
  const indices = [];
  const p = { x: 0, y: 0, z: 0 };

  [-1, 1].forEach((side) => {
    const prof = sampleProfile(a.profile, 'z', a.heelContactZ);
    const cx = side * (prof.x0 + prof.x1) / 2;
    // Top of the heel: underside of the posed outsole at the heel contact
    poseFootPoint(cx, -spec.soleThickness, a.heelContactZ, pose, p);
    const topY = p.y;
    const topZ = p.z;
    if (topY - floorY < 0.01) return;

    const isStiletto = spec.heelStyle === 'stiletto';
    const isWedge = spec.heelStyle === 'wedge' || spec.heelStyle === 'platform';
    const topHalfW = isWedge ? 0.030 : isStiletto ? 0.016 : 0.022;
    const topHalfD = isWedge ? 0.030 : isStiletto ? 0.016 : 0.022;
    const botHalfW = isWedge ? 0.028 : isStiletto ? 0.005 : 0.017;
    const botHalfD = isWedge ? 0.034 : isStiletto ? 0.005 : 0.017;
    // Wedges extend forward toward the arch
    const fwd = isWedge ? 0.05 : 0;
    const base = verts.length / 3;
    const box = [
      [cx - topHalfW, topY, topZ - topHalfD], [cx + topHalfW, topY, topZ - topHalfD],
      [cx + topHalfW, topY, topZ + topHalfD + fwd], [cx - topHalfW, topY, topZ + topHalfD + fwd],
      [cx - botHalfW, floorY, topZ - botHalfD], [cx + botHalfW, floorY, topZ - botHalfD],
      [cx + botHalfW, floorY, topZ + botHalfD + fwd], [cx - botHalfW, floorY, topZ + botHalfD + fwd],
    ];
    box.forEach((v) => verts.push(...v));
    const faces = [
      [0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
    ];
    faces.forEach(([q0, q1, q2, q3]) => {
      indices.push(base + q0, base + q1, base + q2, base + q0, base + q2, base + q3);
    });
  });

  if (verts.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
