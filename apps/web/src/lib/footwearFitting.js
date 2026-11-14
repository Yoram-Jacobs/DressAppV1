import * as THREE from 'three';

/**
 * Footwear Fit
 *
 * Fits detailed 3D footwear around the avatar's actual feet (completely enclosing
 * the sole and covering the feet with zero skin show-through) and, for platform
 * and high-heeled shoes, elevates and re-poses the avatar: the heel is raised,
 * the foot pivots about the ball of the foot, toes stay flat on the platform/sole,
 * and the whole body is elevated above the floor plane.
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
  { y: 0.10, cx: 0.166, rx: 0.032, cz: 0.035, rz: 0.048 },
  { y: 0.20, cx: 0.165, rx: 0.035, cz: 0.028, rz: 0.044 },
  { y: 0.35, cx: 0.151, rx: 0.052, cz: 0.020, rz: 0.056 },
  { y: 0.50, cx: 0.128, rx: 0.056, cz: 0.038, rz: 0.058 },
];
const SHAFT_PROFILE_MALE = [
  { y: 0.10, cx: 0.142, rx: 0.038, cz: -0.002, rz: 0.052 },
  { y: 0.20, cx: 0.148, rx: 0.040, cz: 0.005, rz: 0.048 },
  { y: 0.35, cx: 0.142, rx: 0.056, cz: 0.012, rz: 0.060 },
  { y: 0.50, cx: 0.130, rx: 0.060, cz: 0.022, rz: 0.062 },
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
      soleBottomY: -0.0061,
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
    soleBottomY: -0.0061,
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
 * Classifies a footwear item from its metadata (name, subcategory, item_type, caption, description)
 * and returns its fit, elevation, and detail parameters.
 * heelHeight is the rise of the heel above the fore-foot platform (metres).
 * soleThickness is the platform/outsole thickness under the fore-foot (metres).
 */
export function resolveFootwearSpec(garment) {
  const text = [
    garment?.name,
    garment?.title,
    garment?.sub_category,
    garment?.subcategory,
    garment?.item_type,
    garment?.category,
    garment?.caption,
    garment?.description,
    garment?.rawItem?.name,
    garment?.rawItem?.title,
    garment?.rawItem?.sub_category,
    garment?.rawItem?.subcategory,
    garment?.rawItem?.item_type,
    garment?.rawItem?.heel_type,
    garment?.rawItem?.caption,
    garment?.rawItem?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const has = (re) => re.test(text);
  const explicitHeel = Number(garment?.rawItem?.heel_height_cm || garment?.heel_height_cm);
  const explicitPlatform = Number(garment?.rawItem?.platform_height_cm || garment?.platform_height_cm);

  const isAnkleBoot = has(/ankle\s*boot|bootie|chelsea|chukka|desert\s*boot|combat\s*boot|dr\.?\s*martens|מגפונ|צ['’׳]?לסי|צ['’׳]?אקה|קרסול|bottines?|stiefelette|botin|ботильон|челси|短靴|切尔西|ショートブーツ|サイドゴア/);
  const isBoot = !isAnkleBoot && has(/boots?\b|מגפ|bottes|stiefel|botas|stivali|сапог|靴子|ブーツ|جزمة/);
  const isSneaker = has(/sneaker|trainer|running|tennis\s*shoe|athletic|סניקרס|נעלי ספורט|basket|zapatilla|кроссовк|运动鞋|スニーカー/);
  const isSandal = has(/sandal|flip.?flop|slide|mule|סנדל|כפכפ|sandale|sandalia|сандал|凉鞋|サンダル|صندل/);
  const isLoaferOrOxford = has(/loafer|oxford|derby|brogue|moccasin|dress\s*shoe|מוקסין|אוקספורד|נעלי אלגנט/);
  const isPlatform = has(/platform|flatform|creeper|chunky|lug\s*sole|פלטפורמ|סוליה עבה|厚底|プラットフォーム/);

  let heelHeight = 0;
  if (has(/stiletto|סטילטו/)) heelHeight = 0.10;
  else if (has(/kitten/)) heelHeight = 0.045;
  else if (has(/wedge|טריז/)) heelHeight = 0.075;
  else if (has(/block\s*heel|עקב רחב|chunky\s*heel/)) heelHeight = 0.065;
  else if (has(/heels?\b|high.?heel|pumps?\b|עקב|עקבים|talon|tacón|tacco|absatz|каблук|高跟|ヒール|كعب/)) heelHeight = 0.085;
  // Flat platform sandals/shoes elevate the entire sole (soleThickness) without tilting the heel above the forefoot.

  if (Number.isFinite(explicitHeel) && explicitHeel > 0) {
    heelHeight = Math.min(0.14, explicitHeel / 100);
  }
  // Boots and dress oxfords carry a modest heel unless explicitly higher
  if ((isBoot || isAnkleBoot) && heelHeight === 0) heelHeight = 0.028;
  else if (isLoaferOrOxford && heelHeight === 0) heelHeight = 0.018;

  const heelStyle = has(/stiletto|סטילטו|kitten/) ? 'stiletto'
    : has(/wedge|טריז/) ? 'wedge'
      : isPlatform ? 'platform'
        : 'block';

  let kind = 'flat';
  let collar = 0.095;
  let soleThickness = 0.016;
  if (isBoot) {
    kind = 'boot';
    const isKneeHigh = has(/knee[-_\s]?high|over[-_\s]?the[-_\s]?knee|tall\s*boot|עד הברך|מעל הברך|מגפי עור|מגפיים גבוהים|גבוהים|bottes hautes|hohe stiefel|cuissardes|botas altas/);
    collar = isKneeHigh ? 0.48 : 0.40;
    soleThickness = isPlatform ? 0.038 : 0.022;
  } else if (isAnkleBoot) {
    kind = 'ankle_boot';
    collar = 0.135;
    soleThickness = isPlatform ? 0.038 : 0.020;
  } else if (isSneaker) {
    kind = 'sneaker';
    collar = 0.105;
    soleThickness = isPlatform ? 0.038 : 0.024;
  } else if (isSandal) {
    kind = 'sandal';
    collar = 0.065;
    soleThickness = isPlatform ? 0.036 : (heelHeight >= 0.04 ? 0.010 : 0.014);
  } else if (isLoaferOrOxford) {
    kind = 'loafer';
    collar = 0.092;
    soleThickness = isPlatform ? 0.034 : 0.018;
  }

  if (heelHeight >= 0.04 && (kind === 'flat' || kind === 'loafer')) {
    kind = 'heel';
    collar = 0.082;
    soleThickness = isPlatform ? 0.034 : 0.012;
  } else if (isPlatform && soleThickness < 0.034) {
    soleThickness = 0.038;
  }

  if (Number.isFinite(explicitPlatform) && explicitPlatform > 0) {
    soleThickness = Math.min(0.08, Math.max(0.012, explicitPlatform / 100));
  }

  const hasTongue = kind === 'sneaker' || kind === 'loafer' || kind === 'ankle_boot' || kind === 'boot';
  const hasWelt = true;
  const sandalStyle = kind === 'sandal'
    ? (has(/thong|t[-_\s]*strap|flip.?flop|toe.?post|אצבע/)
        ? 'tstrap'
        : has(/slide|mule|סלייד|כפכף/)
          ? 'slide'
          : heelHeight >= 0.035
            ? 'ankle_strap'
            : null)
    : null;

  return {
    kind,
    sandalStyle,
    heelHeight,
    heelStyle,
    collar,
    soleThickness,
    isPlatform,
    hasTongue,
    hasWelt,
  };
}

/**
 * Computes the rigid foot pose for a given heel height and platform/sole thickness.
 * The foot pivots about the ball of the foot so the heel rises by heelHeight;
 * the whole avatar and outfit are elevated above the floor plane by groupLift = lift + soleThickness.
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
  const lift = Math.max(0, ankleY2 - a.ankleY);
  const shiftZ = ankleZ2 - a.ankleZ;
  const effectiveSole = Math.max(0, Number(soleThickness) || 0);
  return {
    active: theta > 1e-4,
    elevated: (lift + effectiveSole) > 1e-4,
    theta,
    cos: c,
    sin: s,
    lift,
    shiftZ,
    soleThickness: effectiveSole,
    heelHeight,
    groupLift: lift + effectiveSole,
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
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const along = clamp01((z - z0) / (z1 - z0)); // 0 heel -> 1 toe
  const across = clamp01((x - x0) / (x1 - x0)); // 0 at -X edge -> 1 at +X edge
  const mode = layout?.mode || 'top';
  const full = { u0: 0, u1: 1, v0: 0, v1: 1 };

  // Inset the box slightly so edge samples land on the shoe, not the background
  const inset = (bx) => {
    const du = (bx.u1 - bx.u0) * 0.04;
    const dv = (bx.v1 - bx.v0) * 0.03;
    return { u0: bx.u0 + du, u1: bx.u1 - du, v0: bx.v0 + dv, v1: bx.v1 - dv };
  };

  if (mode === 'side') {
    const bx = inset(layout?.box || full);
    const toeLeft = layout?.toeLeft !== false;
    const u = toeLeft ? 1 - along : along;
    const h = clamp01(y / Math.max(0.04, yTop));
    return [bx.u0 + u * (bx.u1 - bx.u0), bx.v0 + h * (bx.v1 - bx.v0)];
  }

  // Top view: in catalog photos, toes point UP toward the top of the photo (v1),
  // and the heel opening points DOWN (v0).
  let bx = layout?.box || full;
  if (mode === 'pair' && layout?.boxes?.length === 2) {
    // Avatar faces +Z (toward viewer when camera looks at front).
    // The avatar's right foot is -X in 3D space, which appears on the left in the viewer / photo.
    // The avatar's left foot is +X in 3D space, which appears on the right in the viewer / photo.
    bx = side < 0 ? layout.boxes[0] : layout.boxes[1];
  } else if (mode === 'pair') {
    bx = side < 0 ? { u0: 0, u1: 0.5, v0: 0, v1: 1, toeUp: true } : { u0: 0.5, u1: 1, v0: 0, v1: 1, toeUp: true };
  }
  bx = inset(bx);
  // along = 0 at heel -> along = 1 at toe.
  // With toeUp (standard for shoe photos), toe is at v1 (top) and heel is at v0 (bottom).
  const toeUp = bx.toeUp !== false;
  const v = toeUp ? bx.v0 + along * (bx.v1 - bx.v0) : bx.v0 + (1 - along) * (bx.v1 - bx.v0);
  return [bx.u0 + across * (bx.u1 - bx.u0), v];
}

function appendQuad(indices, a0, b0, c0, d0) {
  indices.push(a0, c0, b0, b0, c0, d0);
}

/**
 * Computes anatomical foot cross-section width & center at z along one foot.
 */
function footSliceMetrics(a, side, z, z0, z1, off) {
  const p = sampleProfile(a.profile, 'z', z);
  let endTaper = 1.0;
  if (z < a.heelZ) {
    const uHeel = Math.max(0, (z - z0) / Math.max(1e-4, a.heelZ - z0));
    endTaper = 0.35 + 0.65 * Math.pow(uHeel, 0.45);
  } else if (z > a.toeZ) {
    const uToe = Math.max(0, (z1 - z) / Math.max(1e-4, z1 - a.toeZ));
    endTaper = 0.30 + 0.70 * Math.pow(uToe, 0.42);
  }
  const cxR = (p.x0 + p.x1) / 2;
  const hw = ((p.x1 - p.x0) / 2 + off) * endTaper;
  return { p, endTaper, cx: side * cxR, hw };
}

/**
 * Builds a watertight contoured outsole/footbed from z0 to z1 for one foot.
 */
function buildFootbedGeometry(side, a, sole, z0, z1, off, frame, layout, verts, uvs, indices, suppressCenterInsole = false) {
  const yWelt = Math.min(-0.007, (a.soleBottomY || -0.0061) - 0.002);
  const yInsole = Math.max(yWelt + 0.003, -0.0015);
  const yOutsoleBottom = yWelt - sole;
  const nz = 24;
  const nRing = 12;
  const startIdx = verts.length / 3;

  for (let i = 0; i <= nz; i++) {
    const t = i / nz;
    const z = lerp(z0, z1, t);
    const { endTaper, cx, hw } = footSliceMetrics(a, side, z, z0, z1, off);
    const hwSole = hw + 0.0025 * endTaper;
    for (let j = 0; j < nRing; j++) {
      const ang = (j / nRing) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const x = cx + side * hwSole * Math.sign(ca) * Math.pow(Math.abs(ca), 0.65);
      const yMid = 0.5 * (yInsole + yOutsoleBottom);
      const yHalf = 0.5 * (yInsole - yOutsoleBottom);
      const y = yMid + yHalf * Math.sign(sa) * Math.pow(Math.abs(sa), 0.65);
      verts.push(x, y, z);
      let uvX = x;
      let uvZ = z;
      if (suppressCenterInsole && sa > 0.15 && Math.abs(ca) < 0.92) {
        const along = (z - frame.z0) / Math.max(1e-4, frame.z1 - frame.z0);
        if (along >= 0.32 && along <= 0.76) {
          uvZ = lerp(frame.z0, frame.z1, 0.84);
        }
      }
      uvs.push(...shoeUV(side, uvX, Math.max(0, y), uvZ, frame, layout));
    }
  }

  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nRing; j++) {
      const jn = (j + 1) % nRing;
      const a0 = startIdx + i * nRing + j;
      const b0 = startIdx + i * nRing + jn;
      const c0 = startIdx + (i + 1) * nRing + j;
      const d0 = startIdx + (i + 1) * nRing + jn;
      appendQuad(indices, a0, b0, c0, d0);
    }
  }

  [
    { sliceIdx: 0, zCap: z0 - 0.0015, flip: false },
    { sliceIdx: nz, zCap: z1 + 0.0015, flip: true },
  ].forEach(({ sliceIdx, zCap, flip }) => {
    const ringOffset = startIdx + sliceIdx * nRing;
    let sumX = 0;
    let sumY = 0;
    for (let j = 0; j < nRing; j++) {
      sumX += verts[(ringOffset + j) * 3];
      sumY += verts[(ringOffset + j) * 3 + 1];
    }
    const centerIdx = verts.length / 3;
    verts.push(sumX / nRing, sumY / nRing, zCap);
    uvs.push(...shoeUV(side, sumX / nRing, Math.max(0, sumY / nRing), zCap, frame, layout));
    for (let j = 0; j < nRing; j++) {
      const jn = (j + 1) % nRing;
      if (flip) indices.push(centerIdx, ringOffset + j, ringOffset + jn);
      else indices.push(centerIdx, ringOffset + jn, ringOffset + j);
    }
  });
}

/**
 * Builds a 3D contoured arch strap across the foot at zStart..zEnd, anchored to the footbed edges.
 */
function buildFootStrap(side, a, zStart, zEnd, off, thickness, frame, layout, verts, uvs, indices, vSweep = 0) {
  const nz = 4;
  const nArc = 16;
  const yBase = Math.min(-0.005, (a.soleBottomY || -0.0061));
  const startIdx = verts.length / 3;

  // Build closed tube-like arch band (outer arch + inner arch)
  const ring = nArc * 2;
  for (let i = 0; i <= nz; i++) {
    const zBase = lerp(zStart, zEnd, i / nz);
    const p = sampleProfile(a.profile, 'z', zBase);
    const cx = side * ((p.x0 + p.x1) / 2);
    const hwInner = (p.x1 - p.x0) / 2 + off;
    const hwOuter = hwInner + thickness;
    const archInner = Math.max(0.016, p.top + off);
    const archOuter = archInner + thickness;

    for (let j = 0; j < nArc; j++) {
      const phi = Math.PI * (j / (nArc - 1));
      const cphi = Math.cos(phi);
      const sphi = Math.sin(phi);
      const ex = Math.sign(cphi) * Math.pow(Math.abs(cphi), 0.78);
      const ey = Math.pow(sphi, 0.82);
      const x = cx + side * hwOuter * ex;
      const y = yBase + (archOuter - yBase) * ey;
      const z = zBase - vSweep * Math.abs(ex);
      const uvZ = vSweep > 0 ? zBase - 0.014 * Math.abs(ex) : z;
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, x, Math.max(0, y), uvZ, frame, layout));
    }
    for (let j = nArc - 1; j >= 0; j--) {
      const phi = Math.PI * (j / (nArc - 1));
      const cphi = Math.cos(phi);
      const sphi = Math.sin(phi);
      const ex = Math.sign(cphi) * Math.pow(Math.abs(cphi), 0.78);
      const ey = Math.pow(sphi, 0.82);
      const x = cx + side * hwInner * ex;
      const y = yBase + (archInner - yBase) * ey;
      const z = zBase - vSweep * Math.abs(ex);
      const uvZ = vSweep > 0 ? zBase - 0.014 * Math.abs(ex) : z;
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, x, Math.max(0, y), uvZ, frame, layout));
    }
  }

  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < ring; j++) {
      const jn = (j + 1) % ring;
      appendQuad(
        indices,
        startIdx + i * ring + j,
        startIdx + i * ring + jn,
        startIdx + (i + 1) * ring + j,
        startIdx + (i + 1) * ring + jn
      );
    }
  }
  // Cap front & back edges of strap
  [0, nz].forEach((sliceIdx) => {
    const r0 = startIdx + sliceIdx * ring;
    for (let j = 0; j < nArc - 1; j++) {
      const o0 = r0 + j;
      const o1 = r0 + j + 1;
      const i1 = r0 + (ring - 1 - (j + 1));
      const i0 = r0 + (ring - 1 - j);
      if (sliceIdx === 0) appendQuad(indices, o0, i0, o1, i1);
      else appendQuad(indices, o0, o1, i0, i1);
    }
  });
}

/**
 * Builds a sleek 3D ankle strap ring around the lower ankle shaft plus a slim heel counter spine.
 */
function buildAnkleStrapAndHeelCounter(side, a, yAnkle, bandH, off, frame, layout, verts, uvs, indices) {
  const nTheta = 20;
  const sp = sampleProfile(a.shaft, 'y', yAnkle);
  const rxIn = sp.rx + off;
  const rzIn = sp.rz + off;
  const thick = 0.004;
  const y0 = yAnkle - bandH * 0.5;
  const y1 = yAnkle + bandH * 0.5;

  // 4-ring rectangular-section cuff around ankle (bottom-out, top-out, top-in, bottom-in)
  const rings = [
    { y: y0, rx: rxIn + thick, rz: rzIn + thick },
    { y: y1, rx: rxIn + thick, rz: rzIn + thick },
    { y: y1, rx: rxIn, rz: rzIn },
    { y: y0, rx: rxIn, rz: rzIn },
  ];
  const baseIdx = verts.length / 3;
  rings.forEach(({ y, rx, rz }) => {
    for (let j = 0; j <= nTheta; j++) {
      const th = -Math.PI + (j / nTheta) * Math.PI * 2;
      const x = side * sp.cx + rx * Math.sin(th);
      const z = sp.cz + rz * Math.cos(th);
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, x, Math.max(0, y), z, frame, layout));
    }
  });
  const stride = nTheta + 1;
  for (let r = 0; r < 4; r++) {
    const rn = (r + 1) % 4;
    for (let j = 0; j < nTheta; j++) {
      appendQuad(
        indices,
        baseIdx + r * stride + j,
        baseIdx + r * stride + j + 1,
        baseIdx + rn * stride + j,
        baseIdx + rn * stride + j + 1
      );
    }
  }

  // Slim heel counter spine connecting heel footbed up to ankle strap
  const ny = 6;
  const nArc = 9;
  const pHeel = sampleProfile(a.profile, 'z', a.heelZ);
  const cxHeel = side * (pHeel.x0 + pHeel.x1) / 2;
  const hwHeel = (pHeel.x1 - pHeel.x0) / 2 + off + 0.003;
  const spineStart = verts.length / 3;
  for (let i = 0; i <= ny; i++) {
    const t = i / ny;
    const y = lerp(-0.004, yAnkle, t);
    const sTop = sampleProfile(a.shaft, 'y', Math.max(0.10, y));
    const cx = lerp(cxHeel, side * sTop.cx, t);
    const rx = lerp(hwHeel, sTop.rx + off + 0.003, t);
    const czBack = lerp(a.heelZ - 0.004, sTop.cz - (sTop.rz + off + 0.003), t);
    for (let j = 0; j < nArc; j++) {
      // Back arc around heel (-65 deg to +65 deg facing -Z)
      const ang = lerp(-1.1, 1.1, j / (nArc - 1));
      const x = cx + rx * Math.sin(ang);
      const z = czBack + 0.022 * (1 - Math.cos(ang));
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, x, Math.max(0, y), z, frame, layout));
    }
  }
  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nArc - 1; j++) {
      appendQuad(
        indices,
        spineStart + i * nArc + j,
        spineStart + i * nArc + j + 1,
        spineStart + (i + 1) * nArc + j,
        spineStart + (i + 1) * nArc + j + 1
      );
    }
  }
}

/**
 * Builds a contoured 3D oval torus ring sitting on top of the center T-strap.
 */
function buildHardwareRing(side, a, off, zCenter, rx, rz, tubeR, verts, indices) {
  const nMajor = 24;
  const nMinor = 10;
  const startIdx = verts.length / 3;

  for (let i = 0; i <= nMajor; i++) {
    const theta = (i / nMajor) * Math.PI * 2;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const z = zCenter + rz * st;
    const p = sampleProfile(a.profile, 'z', z);
    const cx = side * ((p.x0 + p.x1) / 2);
    const xRing = cx + rx * ct;
    const yRing = Math.max(0.014, p.top + off) + 0.0044 + tubeR * 0.9;

    for (let j = 0; j < nMinor; j++) {
      const phi = (j / nMinor) * Math.PI * 2;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      verts.push(xRing + tubeR * cp * ct, yRing + tubeR * sp, z + tubeR * cp * st);
    }
  }
  for (let i = 0; i < nMajor; i++) {
    for (let j = 0; j < nMinor; j++) {
      const jn = (j + 1) % nMinor;
      appendQuad(
        indices,
        startIdx + i * nMinor + j,
        startIdx + i * nMinor + jn,
        startIdx + (i + 1) * nMinor + j,
        startIdx + (i + 1) * nMinor + jn
      );
    }
  }
}

/**
 * Builds the metal connecting link bar + center stud between two stacked T-strap rings.
 */
function buildHardwareLink(side, a, off, zJoin, halfW, tubeR, verts, indices) {
  const nx = 10;
  const nPhi = 10;
  const p = sampleProfile(a.profile, 'z', zJoin);
  const cx = side * ((p.x0 + p.x1) / 2);
  const yBase = Math.max(0.014, p.top + off) + 0.0046 + tubeR * 0.9;
  const barStart = verts.length / 3;

  for (let i = 0; i <= nx; i++) {
    const u = (i / nx) * 2 - 1;
    const x = cx + u * halfW;
    // Slight barrel swell at center stud and end clasps
    const r = tubeR * (1 + 0.55 * Math.exp(-u * u * 10));
    for (let j = 0; j < nPhi; j++) {
      const phi = (j / nPhi) * Math.PI * 2;
      verts.push(x, yBase + r * Math.sin(phi), zJoin + r * Math.cos(phi));
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nPhi; j++) {
      const jn = (j + 1) % nPhi;
      appendQuad(indices, barStart + i * nPhi + j, barStart + i * nPhi + jn, barStart + (i + 1) * nPhi + j, barStart + (i + 1) * nPhi + jn);
    }
  }
}

/**
 * Builds a sleek 3D T-strap / thong continuous center leather strap from toe-post to vamp,
 * plus arched V-strap wings down to the footbed edges. (Metal hardware is built separately.)
 */
function buildTStrap(side, a, off, frame, layout, verts, uvs, indices) {
  const zToePost = a.toeZ - 0.036;
  const zVamp = a.ankleZ + 0.048;
  const nz = 14;
  const nW = 5;
  const thick = 0.0042;
  const uvStrapZ = lerp(frame.z0, frame.z1, 0.415);
  const uvStrapX = lerp(frame.x0, frame.x1, 0.50);
  const startIdx = verts.length / 3;

  // Continuous black leather center strap from toe post up to the V-strap (supporting the rings)
  for (let i = 0; i <= nz; i++) {
    const t = i / nz;
    const z = lerp(zToePost, zVamp, t);
    const p = sampleProfile(a.profile, 'z', z);
    const cx = side * ((p.x0 + p.x1) / 2);
    const halfW = lerp(0.0045, 0.0085, smoothstep(0.18, 0.45, t));
    const yTop = (i === 0 ? 0.004 : Math.max(0.013, p.top + off)) + thick;
    const yBot = i === 0 ? -0.003 : Math.max(0.009, p.top + off);
    const ringPts = [];
    for (let j = 0; j < nW; j++) {
      const u = (j / (nW - 1)) * 2 - 1;
      ringPts.push([cx + u * halfW, yTop]);
    }
    for (let j = nW - 1; j >= 0; j--) {
      const u = (j / (nW - 1)) * 2 - 1;
      ringPts.push([cx + u * halfW, yBot]);
    }
    ringPts.forEach(([x, y]) => {
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, uvStrapX, Math.max(0, y), uvStrapZ, frame, layout));
    });
  }
  const ring = nW * 2;
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < ring; j++) {
      const jn = (j + 1) % ring;
      appendQuad(indices, startIdx + i * ring + j, startIdx + i * ring + jn, startIdx + (i + 1) * ring + j, startIdx + (i + 1) * ring + jn);
    }
  }

  // Arched V/T-bar wings across the instep
  buildFootStrap(side, a, zVamp - 0.012, zVamp + 0.016, off * 0.55, 0.0045, frame, layout, verts, uvs, indices, 0.006);
}

/**
 * Builds a sleek closed heel cup wrapping around the back of the heel up to ~0.048m.
 */
function buildHeelCup(side, a, off, frame, layout, verts, uvs, indices) {
  const z0 = a.heelZ - 0.010;
  const zCupEnd = a.heelZ + 0.058;
  const nz = 10;
  const nArc = 16;
  const yWelt = Math.min(-0.006, (a.soleBottomY || -0.0061) - 0.002);
  const startIdx = verts.length / 3;

  for (let i = 0; i <= nz; i++) {
    const t = i / nz;
    const z = lerp(z0, zCupEnd, t);
    const { endTaper, cx, hw } = footSliceMetrics(a, side, z, z0, a.toeZ + 0.010, off);
    const rimH = lerp(0.052, 0.020, Math.pow(t, 1.4)) * endTaper;
    for (let j = 0; j < nArc; j++) {
      const phi = Math.PI * (j / (nArc - 1));
      const cphi = Math.cos(phi);
      const sphi = Math.sin(phi);
      const x = cx + side * hw * Math.sign(cphi) * Math.pow(Math.abs(cphi), 0.78);
      const y = lerp(yWelt, Math.max(0.016, rimH), Math.pow(sphi, 0.55));
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, x, Math.max(0, y), z, frame, layout));
    }
  }
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nArc - 1; j++) {
      appendQuad(indices, startIdx + i * nArc + j, startIdx + i * nArc + j + 1, startIdx + (i + 1) * nArc + j, startIdx + (i + 1) * nArc + j + 1);
    }
  }
}

/**
 * Builds an open-toe, open-instep sandal matching the actual sandal style
 * (T-strap/thong with optional heel cup, heeled ankle-strap, or slide).
 */
function buildSandalGeometry(side, a, s, off, frame, layout, verts, uvs, indices) {
  const sole = Math.max(0.010, s.soleThickness || 0.012);
  const z0 = a.heelZ - 0.008;
  const z1 = a.toeZ + 0.008;
  const style = layout?.sandalStyle || s.sandalStyle || (s.heelHeight >= 0.035 ? 'ankle_strap' : 'slide');
  buildFootbedGeometry(side, a, sole, z0, z1, off * 0.65, frame, layout, verts, uvs, indices, style === 'tstrap');
  const hasHeelCup = Boolean(layout?.hasHeelCup);

  if (style === 'tstrap') {
    buildTStrap(side, a, off, frame, layout, verts, uvs, indices);
    if (hasHeelCup) {
      buildHeelCup(side, a, off, frame, layout, verts, uvs, indices);
    } else if (s.heelHeight >= 0.035) {
      buildAnkleStrapAndHeelCounter(side, a, 0.095, 0.016, off * 0.45, frame, layout, verts, uvs, indices);
    }
    return;
  }

  // Forefoot strap across the ball of the foot (leaves toes open and visible)
  buildFootStrap(side, a, a.ballZ - 0.004, a.ballZ + 0.024, off * 0.55, 0.0045, frame, layout, verts, uvs, indices);

  if (style === 'ankle_strap' || s.heelHeight >= 0.035) {
    // Heeled sandal: delicate ankle strap + slim heel counter
    buildAnkleStrapAndHeelCounter(side, a, 0.095, 0.016, off * 0.45, frame, layout, verts, uvs, indices);
  } else {
    // Flat slide sandal: second midfoot/instep strap
    buildFootStrap(side, a, a.ankleZ + 0.055, a.ankleZ + 0.088, off * 0.55, 0.0045, frame, layout, verts, uvs, indices);
  }
}

/**
 * Builds a low-cut closed-toe/closed-heel shoe (pumps, heels, ballet flats, loafers)
 * with an open instep/throat so the top of the foot and ankle remain visible.
 */
function buildLowCutShoeGeometry(side, a, s, off, frame, layout, verts, uvs, indices) {
  const sole = Math.max(0.010, s.soleThickness || 0.014);
  const z0 = a.heelZ - 0.010;
  const z1 = a.toeZ + 0.012;
  buildFootbedGeometry(side, a, sole, z0, z1, off, frame, layout, verts, uvs, indices);

  const isLoafer = s.kind === 'loafer';
  const yWelt = Math.min(-0.006, (a.soleBottomY || -0.0061) - 0.002);
  const nz = 32;
  const nArc = 20;
  const startIdx = verts.length / 3;
  const zToeVamp = isLoafer ? a.ballZ - 0.055 : a.ballZ - 0.018;
  const zHeelCup = a.heelZ + 0.048;

  for (let i = 0; i <= nz; i++) {
    const z = lerp(z0, z1, i / nz);
    const { p, endTaper, cx, hw } = footSliceMetrics(a, side, z, z0, z1, off);
    const footTop = p.top + off;
    const toePuff = smoothstep(a.ballZ, a.toeZ, z) * 0.008 * endTaper;
    const closedTop = Math.max(0.020, (footTop + toePuff) * endTaper);

    // Throat opening: full upper over toe box [zToeVamp..z1] and heel cup [z0..zHeelCup],
    // dipping down to low side quarters in between so the instep stays open!
    const inToe = smoothstep(zToeVamp - 0.018, zToeVamp + 0.012, z);
    const inHeel = 1 - smoothstep(zHeelCup - 0.012, zHeelCup + 0.018, z);
    const upperCover = Math.max(inToe, inHeel);
    const sideWallTop = Math.min(closedTop, 0.030);

    for (let j = 0; j < nArc; j++) {
      const phi = Math.PI * (j / (nArc - 1));
      const cphi = Math.cos(phi);
      const sphi = Math.sin(phi);
      const ex = Math.sign(cphi) * Math.pow(Math.abs(cphi), 0.78);
      const ey = Math.pow(sphi, 0.82);

      // In the open throat zone (upperCover < 1), pull the dorsal crest down to sideWallTop
      const crestFactor = Math.pow(sphi, 2.2);
      const archRoof = lerp(sideWallTop, closedTop, Math.max(upperCover, 1 - crestFactor));
      const x = cx + side * hw * ex;
      const y = yWelt + (archRoof - yWelt) * ey;
      verts.push(x, y, z);
      uvs.push(...shoeUV(side, x, Math.max(0, y), z, frame, layout));
    }
  }

  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nArc - 1; j++) {
      appendQuad(
        indices,
        startIdx + i * nArc + j,
        startIdx + i * nArc + j + 1,
        startIdx + (i + 1) * nArc + j,
        startIdx + (i + 1) * nArc + j + 1
      );
    }
  }
}

/**
 * Builds a high-detail, watertight closed shoe shell (sneakers, ankle boots, tall boots)
 * wrapped around both feet in base foot coordinates, plus an optional boot shaft.
 */
export function createFittedFootwearGeometry({ isMale = false, spec, layout } = {}) {
  const a = getFootAnatomy(isMale);
  const s = spec || resolveFootwearSpec(null);
  const isSneaker = s.kind === 'sneaker';
  const off = isSneaker ? 0.0055 : (s.kind === 'boot' || s.kind === 'ankle_boot' ? 0.010 : 0.0065);
  const sole = Math.max(0.010, s.soleThickness || 0.016);
  const yWelt = Math.min(-0.007, (a.soleBottomY || -0.0061) - 0.002);
  const yOutsoleBottom = yWelt - sole;
  const z0 = a.heelZ - (isSneaker ? 0.010 : 0.014);
  const z1 = a.toeZ + (isSneaker ? 0.012 : 0.016);
  const nz = 36;
  const nArch = 24;
  const nSole = 10;
  const ring = nArch + nSole;

  const verts = [];
  const uvs = [];
  const indices = [];

  [-1, 1].forEach((side) => {
    const minX = Math.min(...a.profile.map((q) => q.x0)) - off;
    const maxX = Math.max(...a.profile.map((q) => q.x1)) + off;
    const frame = {
      x0: side > 0 ? minX : -maxX,
      x1: side > 0 ? maxX : -minX,
      z0,
      z1,
      yTop: Math.max(s.collar, 0.135),
    };

    if (s.kind === 'sandal') {
      buildSandalGeometry(side, a, s, off, frame, layout, verts, uvs, indices);
      return;
    }

    if (s.kind === 'heel' || s.kind === 'flat' || s.kind === 'loafer') {
      buildLowCutShoeGeometry(side, a, s, off, frame, layout, verts, uvs, indices);
      return;
    }

    const startIdx = verts.length / 3;

    for (let i = 0; i <= nz; i++) {
      const t = i / nz;
      const z = lerp(z0, z1, t);
      const p = sampleProfile(a.profile, 'z', z);

      // Keep full anatomical width across [heelZ, toeZ], rounding only in the extended bumper caps
      let endTaper = 1.0;
      if (z < a.heelZ) {
        const uHeel = Math.max(0, (z - z0) / Math.max(1e-4, a.heelZ - z0));
        endTaper = 0.35 + 0.65 * Math.pow(uHeel, 0.45);
      } else if (z > a.toeZ) {
        const uToe = Math.max(0, (z1 - z) / Math.max(1e-4, z1 - a.toeZ));
        endTaper = 0.30 + 0.70 * Math.pow(uToe, 0.42);
      }

      const cxR = (p.x0 + p.x1) / 2;
      const baseHalfW = (p.x1 - p.x0) / 2 + off;
      const hw = baseHalfW * endTaper;
      const cx = side * cxR;

      // Full foot coverage: upper roof ALWAYS clears p.top + off across the entire foot!
      // Plus sculpted toe box puff at the front and tongue / collar contour at the ankle.
      const footTop = p.top + off;
      const toeBoxPuff = smoothstep(a.ballZ, a.toeZ, z) * (isSneaker ? 0.007 : 0.012) * endTaper;
      const tongueZone = smoothstep(a.ankleZ, a.ankleZ + 0.04, z) * (1 - smoothstep(a.ballZ - 0.04, a.ballZ + 0.01, z));
      const tongueBoost = s.hasTongue ? tongueZone * (isSneaker ? 0.010 : 0.014) : 0;
      const collarBoost = z <= a.ankleZ + 0.05 ? Math.max(0, s.collar - footTop) * (isSneaker ? 0.22 : 0.35) : 0;
      const archTop = Math.max(0.022, (footTop + toeBoxPuff + tongueBoost + collarBoost) * endTaper);

      // Subtle tread ripples along outsole bottom for realism
      const treadRipple = Math.sin(t * Math.PI * 14) * 0.0012;
      const weltFlare = (isSneaker ? 0.003 : 0.0045) * endTaper;

      // Natural sneaker cross-section powers: smooth athletic contour (0.92 / 0.88)
      // vs boxy work boot / cast (0.62 / 0.68)
      const pX = isSneaker ? 0.92 : 0.68;
      const pY = isSneaker ? 0.88 : 0.72;

      for (let j = 0; j < ring; j++) {
        let x;
        let y;
        if (j < nArch) {
          // Upper arch from inner welt edge (phi=0), over dorsal crest (phi=PI/2), to outer welt edge (phi=PI)
          const phi = Math.PI * (j / (nArch - 1));
          const cphi = Math.cos(phi);
          const sphi = Math.sin(phi);
          // Smooth curved shoe last cross-section so sneakers look athletic and sleek
          const ex = Math.sign(cphi) * Math.pow(Math.abs(cphi), pX);
          const ey = Math.pow(sphi, pY);
          // Tongue crest ridge along center dorsal line (sphi near 1)
          const centerCrest = s.hasTongue ? Math.pow(sphi, 4) * tongueBoost * 0.6 : 0;
          x = cx + side * hw * ex;
          y = yWelt + (archTop - yWelt) * ey + centerCrest;
        } else {
          // Sculpted Welt + Outsole underside (outer welt -> outer sole bottom -> inner sole bottom -> inner welt)
          const k = (j - nArch) / (nSole - 1); // 0 .. 1
          const hwSole = hw + weltFlare;
          if (k <= 0.15) {
            // Outer welt lip descending to sole bottom
            const uSide = k / 0.15;
            x = cx - side * hwSole;
            y = lerp(yWelt, yOutsoleBottom + treadRipple, uSide);
          } else if (k >= 0.85) {
            // Inner sole bottom ascending to inner welt lip
            const uSide = (k - 0.85) / 0.15;
            x = cx + side * hwSole;
            y = lerp(yOutsoleBottom + treadRipple, yWelt, uSide);
          } else {
            // Flat contoured outsole bottom face
            const uBottom = (k - 0.15) / 0.70;
            x = cx + side * hwSole * lerp(-1, 1, uBottom);
            y = yOutsoleBottom + treadRipple;
          }
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

    // Watertight Heel Cap (i = 0) and Toe Box Cap (i = nz)
    [
      { sliceIdx: 0, zCap: z0 - 0.002, flip: false },
      { sliceIdx: nz, zCap: z1 + 0.002, flip: true },
    ].forEach(({ sliceIdx, zCap, flip }) => {
      const ringOffset = startIdx + sliceIdx * ring;
      let sumX = 0;
      let sumY = 0;
      for (let j = 0; j < ring; j++) {
        sumX += verts[(ringOffset + j) * 3];
        sumY += verts[(ringOffset + j) * 3 + 1];
      }
      const centerIdx = verts.length / 3;
      const cxCap = sumX / ring;
      const cyCap = sumY / ring;
      verts.push(cxCap, cyCap, zCap);
      uvs.push(...shoeUV(side, cxCap, Math.max(0, cyCap), zCap, frame, layout));

      for (let j = 0; j < ring; j++) {
        const jn = (j + 1) % ring;
        const v0 = ringOffset + j;
        const v1 = ringOffset + jn;
        if (flip) {
          indices.push(centerIdx, v0, v1);
        } else {
          indices.push(centerIdx, v1, v0);
        }
      }
    });

    // Boot / Ankle-Boot / High-Top Shaft: sleek sculpted cuff following the lower leg up to the collar height
    if (s.kind === 'boot' || s.kind === 'ankle_boot') {
      const shaftStart = verts.length / 3;
      const ny = 14;
      const nTheta = 22;
      const yStart = 0.058;
      const yEnd = s.collar;
      // Sleek ankle-hugging elastic gusset for ankle/Chelsea boots so trousers drape cleanly over the shaft without z-fighting
      const shaftOff = s.kind === 'ankle_boot' ? 0.0015 : off * 1.15;
      const fullBox = { u0: 0, u1: 1, v0: 0, v1: 1 };
      const rawShaftBox = layout?.mode === 'pair' && layout?.boxes?.length === 2
        ? (side < 0 ? layout.boxes[0] : layout.boxes[1])
        : (layout?.mode === 'pair'
          ? (side < 0 ? { u0: 0, u1: 0.5, v0: 0, v1: 1 } : { u0: 0.5, u1: 1, v0: 0, v1: 1 })
          : (layout?.box || fullBox));
      const uMid = (rawShaftBox.u0 + rawShaftBox.u1) * 0.5;
      const uSpan = (rawShaftBox.u1 - rawShaftBox.u0) * 0.22;
      const vLo = rawShaftBox.v0 + (rawShaftBox.v1 - rawShaftBox.v0) * 0.28;
      const vHi = rawShaftBox.v0 + (rawShaftBox.v1 - rawShaftBox.v0) * 0.62;
      for (let i = 0; i <= ny; i++) {
        const vShaft = i / ny;
        const y = lerp(yStart, yEnd, vShaft);
        const sp = sampleProfile(a.shaft, 'y', y);
        // Padded top collar lip on the final 2 rings
        const collarLip = vShaft > 0.85 ? 0.0025 * ((vShaft - 0.85) / 0.15) : 0;
        for (let j = 0; j <= nTheta; j++) {
          const th = -Math.PI + (j / nTheta) * Math.PI * 2;
          const x = side * sp.cx + (sp.rx + shaftOff + collarLip) * Math.sin(th);
          const z = sp.cz + (sp.rz + shaftOff + collarLip) * Math.cos(th);
          verts.push(x, y, z);
          if (layout?.mode === 'side') {
            uvs.push(
              Math.max(0.05, Math.min(0.95, uMid + Math.sin(th) * uSpan)),
              Math.min(0.95, Math.max(0.08, vLo + vShaft * (vHi - vLo)))
            );
          } else {
            uvs.push(
              Math.max(0.05, Math.min(0.95, uMid + Math.sin(th) * uSpan)),
              Math.min(0.95, Math.max(0.08, lerp(vLo, vHi, vShaft)))
            );
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
 * Builds the heel posts (or wedge / platform blocks) for heeled footwear in the posed,
 * lifted local frame. Returns null for flat footwear without heel elevation.
 */
export function createHeelGeometry({ isMale = false, spec, pose } = {}) {
  if (!pose?.active || !spec || spec.heelHeight < 0.02 || spec.heelStyle === 'platform') return null;
  const supportsStandaloneHeel =
    spec.kind === 'heel' ||
    spec.kind === 'sandal' ||
    (spec.heelHeight >= 0.035 && (spec.kind === 'boot' || spec.kind === 'ankle_boot' || spec.kind === 'loafer'));
  if (!supportsStandaloneHeel) {
    return null;
  }
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
    const topHalfW = isWedge ? 0.032 : isStiletto ? 0.018 : 0.024;
    const topHalfD = isWedge ? 0.032 : isStiletto ? 0.018 : 0.024;
    const botHalfW = isWedge ? 0.030 : isStiletto ? 0.006 : 0.019;
    const botHalfD = isWedge ? 0.036 : isStiletto ? 0.006 : 0.019;
    // Wedges extend forward toward the arch
    const fwd = isWedge ? 0.055 : 0;
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

/**
 * Builds sculpted 3D metallic hardware (stacked oval rings + connecting link bar)
 * for T-strap sandals so the ornament renders with real metallic PBR shading.
 */
export function createFootwearHardwareGeometry({ isMale = false, spec, layout, pose } = {}) {
  const style = layout?.sandalStyle || spec?.sandalStyle;
  if (!spec || spec.kind !== 'sandal' || style !== 'tstrap') return null;

  const a = getFootAnatomy(isMale);
  const off = 0.0045;
  const zToePost = a.toeZ - 0.036;
  const zVamp = a.ankleZ + 0.048;
  const zRingBot = lerp(zToePost, zVamp, 0.30);
  const zLowerRing = lerp(zRingBot, zVamp, 0.32);
  const zUpperRing = lerp(zRingBot, zVamp, 0.78);
  const zJoin = 0.5 * (zLowerRing + 0.0155 + (zUpperRing - 0.0105));

  const verts = [];
  const indices = [];
  [-1, 1].forEach((side) => {
    buildHardwareRing(side, a, off, zLowerRing, 0.0125, 0.0165, 0.0024, verts, indices);
    buildHardwareRing(side, a, off, zUpperRing, 0.009, 0.011, 0.0022, verts, indices);
    buildHardwareLink(side, a, off, zJoin, 0.0095, 0.0023, verts, indices);
  });

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  if (pose?.active) {
    geo = poseGeometry(geo, pose);
  } else {
    geo.computeBoundingSphere();
  }
  return geo;
}
