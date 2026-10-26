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

  const isAnkleBoot = has(/ankle\s*boot|bootie|chelsea|combat\s*boot|מגפונ|bottines?|stiefelette|botin|ботильон|短靴|ショートブーツ/);
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
  else if (isPlatform && !isSneaker) heelHeight = 0.045;

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
    collar = 0.40;
    soleThickness = isPlatform ? 0.038 : 0.020;
  } else if (isAnkleBoot) {
    kind = 'ankle_boot';
    collar = 0.18;
    soleThickness = isPlatform ? 0.038 : 0.020;
  } else if (isSneaker) {
    kind = 'sneaker';
    collar = 0.105;
    soleThickness = isPlatform ? 0.038 : 0.024;
  } else if (isSandal) {
    kind = 'sandal';
    collar = 0.065;
    soleThickness = isPlatform ? 0.038 : 0.016;
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

  return {
    kind,
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

  // Top view: toes point down in the photo, heel opening up
  let bx = layout?.box || full;
  if (mode === 'pair' && layout?.boxes?.length === 2) {
    // Avatar faces the camera: its -X foot appears on the image's left
    bx = side < 0 ? layout.boxes[0] : layout.boxes[1];
  } else if (mode === 'pair') {
    bx = side < 0 ? { u0: 0, u1: 0.5, v0: 0, v1: 1 } : { u0: 0.5, u1: 1, v0: 0, v1: 1 };
  }
  bx = inset(bx);
  return [bx.u0 + across * (bx.u1 - bx.u0), bx.v0 + (1 - along) * (bx.v1 - bx.v0)];
}

/**
 * Builds a high-detail, watertight closed shoe shell (contoured upper, tongue,
 * collar cushion, welt lip, and sculpted outsole) wrapped around both feet in
 * base foot coordinates, plus an optional boot shaft.
 * Guarantees 100% enclosure of the sole and full coverage of the foot so avatar
 * skin never pokes through.
 */
export function createFittedFootwearGeometry({ isMale = false, spec, layout } = {}) {
  const a = getFootAnatomy(isMale);
  const s = spec || resolveFootwearSpec(null);
  const off = 0.011; // generous anatomical clearance over skin so toes/instep never poke through
  const sole = Math.max(0.012, s.soleThickness || 0.016);
  const yWelt = Math.min(-0.007, (a.soleBottomY || -0.0061) - 0.002); // below foot sole bottom
  const yOutsoleBottom = yWelt - sole;
  const z0 = a.heelZ - 0.016;
  const z1 = a.toeZ + 0.018;
  const nz = 36;
  const nArch = 24;
  const nSole = 10;
  const ring = nArch + nSole; // closed loop: upper arch + welt/outsole perimeter + sole bottom

  const verts = [];
  const uvs = [];
  const indices = [];

  [-1, 1].forEach((side) => {
    const startIdx = verts.length / 3;
    const minX = Math.min(...a.profile.map((q) => q.x0)) - off;
    const maxX = Math.max(...a.profile.map((q) => q.x1)) + off;
    const frame = {
      x0: side > 0 ? minX : -maxX,
      x1: side > 0 ? maxX : -minX,
      z0,
      z1,
      yTop: Math.max(s.collar, 0.135),
    };

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
      const toeBoxPuff = smoothstep(a.ballZ, a.toeZ, z) * 0.012 * endTaper;
      const tongueZone = smoothstep(a.ankleZ, a.ankleZ + 0.04, z) * (1 - smoothstep(a.ballZ - 0.04, a.ballZ + 0.01, z));
      const tongueBoost = s.hasTongue ? tongueZone * 0.014 : 0;
      const collarBoost = z <= a.ankleZ + 0.05 ? Math.max(0, s.collar - footTop) * 0.35 : 0;
      const archTop = Math.max(0.022, (footTop + toeBoxPuff + tongueBoost + collarBoost) * endTaper);

      // Subtle tread ripples along outsole bottom for realism
      const treadRipple = Math.sin(t * Math.PI * 14) * 0.0012;
      const weltFlare = 0.0045 * endTaper;

      for (let j = 0; j < ring; j++) {
        let x;
        let y;
        if (j < nArch) {
          // Upper arch from inner welt edge (phi=0), over dorsal crest (phi=PI/2), to outer welt edge (phi=PI)
          const phi = Math.PI * (j / (nArch - 1));
          const cphi = Math.cos(phi);
          const sphi = Math.sin(phi);
          // Boxier, fuller shoe last cross-section (power 0.62) so lateral toes & ankle malleoli are 100% enclosed
          const ex = Math.sign(cphi) * Math.pow(Math.abs(cphi), 0.62);
          const ey = Math.pow(sphi, 0.68);
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

    // Boot / Ankle-Boot / High-Top Shaft: tube following the lower leg up to the collar height
    if (s.kind === 'boot' || s.kind === 'ankle_boot') {
      const shaftStart = verts.length / 3;
      const ny = 14;
      const nTheta = 22;
      const yStart = 0.055;
      const yEnd = s.collar;
      for (let i = 0; i <= ny; i++) {
        const vShaft = i / ny;
        const y = lerp(yStart, yEnd, vShaft);
        const sp = sampleProfile(a.shaft, 'y', y);
        // Padded top collar lip on the final 2 rings
        const collarLip = vShaft > 0.85 ? 0.004 * ((vShaft - 0.85) / 0.15) : 0;
        for (let j = 0; j <= nTheta; j++) {
          const th = -Math.PI + (j / nTheta) * Math.PI * 2;
          const x = side * sp.cx + (sp.rx + off + collarLip) * Math.sin(th);
          const z = sp.cz + (sp.rz + off + collarLip) * Math.cos(th);
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
 * Builds the heel posts (or wedge / platform blocks) for heeled footwear in the posed,
 * lifted local frame. Returns null for flat footwear without heel elevation.
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
