import * as THREE from 'three';

/**
 * Modular Parametric 3D Sandal Kit (`sandalBuilder3D.js`)
 *
 * Composes anatomically fitted, watertight 3D sandals from reusable modular components:
 *  - Footbeds & soles: flat_leather, contoured_cork, flatform, wedge, block_heel, stiletto
 *  - Forefoot / instep straps: toe_post_only + t_stem / scalloped_v_collar, v_thong,
 *    single_band, double_band, criss_cross, multi_thin, caged, toe_ring
 *  - Back / heel closures: open_backless, open_heel_cup (horizontal open-top cup),
 *    closed_heel_counter, ankle_strap, slingback, lace_up_calf
 *  - Hardware ornaments: metal_ring (+ keeper loops), micro_studs, buckle, ankle_buckle
 *
 * Every foot surface measurement is calibrated directly from `avatar_female_1.glb`
 * and `avatar_male_1.glb` so straps and heel cups conform over the instep, toes,
 * inter-toe cleft, and ankle without clipping or height-clamping artifacts.
 */

const FEMALE_METRICS = {
  isMale: false,
  heelBackZ: -0.0135,
  toeTipZ: 0.2386,
  ballZ: 0.165,
  midfootZ: 0.125,
  instepZ: 0.095,
  toeCleftX: 0.159,
  toeCleftZ: 0.220,
  soleBottomY: -0.0061,
  // Foot dorsum height cross-section envelope [z, xMin, xMax, peakY, medialY, lateralY]
  profile: [
    { z: -0.0135, x0: 0.145, x1: 0.184, peakY: 0.056, medialY: 0.044, lateralY: 0.042 },
    { z: 0.005, x0: 0.135, x1: 0.195, peakY: 0.072, medialY: 0.055, lateralY: 0.045 },
    { z: 0.031, x0: 0.135, x1: 0.205, peakY: 0.098, medialY: 0.078, lateralY: 0.045 },
    { z: 0.068, x0: 0.138, x1: 0.208, peakY: 0.128, medialY: 0.112, lateralY: 0.036 },
    { z: 0.098, x0: 0.140, x1: 0.213, peakY: 0.084, medialY: 0.064, lateralY: 0.030 },
    { z: 0.128, x0: 0.132, x1: 0.216, peakY: 0.058, medialY: 0.042, lateralY: 0.032 },
    { z: 0.158, x0: 0.125, x1: 0.216, peakY: 0.040, medialY: 0.032, lateralY: 0.024 },
    { z: 0.188, x0: 0.127, x1: 0.215, peakY: 0.029, medialY: 0.023, lateralY: 0.017 },
    { z: 0.209, x0: 0.130, x1: 0.206, peakY: 0.024, medialY: 0.021, lateralY: 0.014 },
    { z: 0.224, x0: 0.131, x1: 0.192, peakY: 0.021, medialY: 0.019, lateralY: 0.012 },
    { z: 0.2386, x0: 0.136, x1: 0.168, peakY: 0.018, medialY: 0.016, lateralY: 0.011 },
  ],
  heelRings: [
    { y: 0.015, cx: 0.171, rx: 0.040, zBack: -0.0135, cz: 0.036, rz: 0.049 },
    { y: 0.035, cx: 0.169, rx: 0.036, zBack: -0.0130, cz: 0.035, rz: 0.048 },
    { y: 0.055, cx: 0.167, rx: 0.032, zBack: -0.0107, cz: 0.035, rz: 0.046 },
    { y: 0.075, cx: 0.167, rx: 0.031, zBack: -0.0070, cz: 0.036, rz: 0.044 },
    { y: 0.095, cx: 0.165, rx: 0.029, zBack: -0.0040, cz: 0.040, rz: 0.043 },
    { y: 0.120, cx: 0.167, rx: 0.026, zBack: -0.0055, cz: 0.033, rz: 0.040 },
    { y: 0.170, cx: 0.166, rx: 0.032, zBack: -0.0120, cz: 0.030, rz: 0.044 },
  ],
};

const MALE_METRICS = {
  isMale: true,
  heelBackZ: -0.0704,
  toeTipZ: 0.1968,
  ballZ: 0.122,
  midfootZ: 0.085,
  instepZ: 0.052,
  toeCleftX: 0.132,
  toeCleftZ: 0.180,
  soleBottomY: -0.0061,
  profile: [
    { z: -0.0704, x0: 0.132, x1: 0.174, peakY: 0.048, medialY: 0.038, lateralY: 0.036 },
    { z: -0.050, x0: 0.116, x1: 0.185, peakY: 0.075, medialY: 0.055, lateralY: 0.045 },
    { z: -0.015, x0: 0.108, x1: 0.192, peakY: 0.118, medialY: 0.088, lateralY: 0.045 },
    { z: 0.025, x0: 0.116, x1: 0.196, peakY: 0.134, medialY: 0.116, lateralY: 0.040 },
    { z: 0.055, x0: 0.108, x1: 0.200, peakY: 0.092, medialY: 0.064, lateralY: 0.038 },
    { z: 0.085, x0: 0.098, x1: 0.201, peakY: 0.066, medialY: 0.046, lateralY: 0.034 },
    { z: 0.115, x0: 0.096, x1: 0.200, peakY: 0.045, medialY: 0.035, lateralY: 0.026 },
    { z: 0.145, x0: 0.098, x1: 0.200, peakY: 0.031, medialY: 0.025, lateralY: 0.017 },
    { z: 0.166, x0: 0.098, x1: 0.191, peakY: 0.024, medialY: 0.021, lateralY: 0.014 },
    { z: 0.181, x0: 0.102, x1: 0.174, peakY: 0.020, medialY: 0.018, lateralY: 0.012 },
    { z: 0.1968, x0: 0.106, x1: 0.142, peakY: 0.017, medialY: 0.015, lateralY: 0.010 },
  ],
  heelRings: [
    { y: 0.015, cx: 0.156, rx: 0.042, zBack: -0.0704, cz: -0.008, rz: 0.062 },
    { y: 0.035, cx: 0.155, rx: 0.040, zBack: -0.0681, cz: -0.007, rz: 0.060 },
    { y: 0.055, cx: 0.150, rx: 0.034, zBack: -0.0608, cz: -0.006, rz: 0.056 },
    { y: 0.075, cx: 0.147, rx: 0.033, zBack: -0.0569, cz: -0.006, rz: 0.054 },
    { y: 0.095, cx: 0.143, rx: 0.036, zBack: -0.0560, cz: -0.005, rz: 0.053 },
    { y: 0.120, cx: 0.142, rx: 0.033, zBack: -0.0555, cz: -0.012, rz: 0.046 },
    { y: 0.170, cx: 0.146, rx: 0.038, zBack: -0.0540, cz: -0.005, rz: 0.050 },
  ],
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

function appendQuad(indices, a, b, c, d) {
  indices.push(a, c, b, b, c, d);
}

function sampleSeries(arr, key, val) {
  if (val <= arr[0][key]) return { ...arr[0] };
  const last = arr[arr.length - 1];
  if (val >= last[key]) return { ...last };
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i];
    const b = arr[i + 1];
    if (val >= a[key] && val <= b[key]) {
      const t = (val - a[key]) / Math.max(1e-5, b[key] - a[key]);
      const out = {};
      Object.keys(a).forEach((k) => {
        out[k] = lerp(a[k], b[k], t);
      });
      return out;
    }
  }
  return { ...last };
}

export function getSandalFootMetrics(isMale = false) {
  return isMale ? MALE_METRICS : FEMALE_METRICS;
}

/**
 * Evaluates anatomical foot dorsum height `y(z, xNorm)` where `xNorm = -1` is the
 * medial (inner/big-toe) border and `xNorm = +1` is the lateral (outer/pinky) border.
 * Never artificially clamps instep heights.
 */
export function evalFootDorsumSurface(metrics, z, xNorm = 0) {
  const s = sampleSeries(metrics.profile, 'z', z);
  const xn = clamp(xNorm, -1, 1);
  // Natural dorsal crown peaks slightly toward the medial-center arch ridge (xNorm ≈ -0.18).
  const peakShift = -0.18;
  let heightFrac;
  if (xn <= peakShift) {
    const u = Math.abs(xn - peakShift) / (1 + peakShift);
    heightFrac = Math.pow(Math.max(0, 1 - Math.pow(u, 2.0)), 0.72);
    return lerp(s.medialY, s.peakY, heightFrac);
  }
  const u = (xn - peakShift) / (1 - peakShift);
  heightFrac = Math.pow(Math.max(0, 1 - Math.pow(u, 1.85)), 0.78);
  return lerp(s.lateralY, s.peakY, heightFrac);
}

/**
 * Evaluates foot slice center & half-width at `z` for side (+1 or -1).
 */
function evalFootSlice(metrics, side, z) {
  const s = sampleSeries(metrics.profile, 'z', z);
  const cxAbs = 0.5 * (s.x0 + s.x1);
  const hw = 0.5 * (s.x1 - s.x0);
  return {
    z,
    cx: side * cxAbs,
    hw,
    s,
  };
}

/**
 * Evaluates horizontal heel / ankle cross-section ring at height `y`.
 */
export function evalAnkleRing(metrics, side, y) {
  const r = sampleSeries(metrics.heelRings, 'y', y);
  return {
    cx: side * r.cx,
    rx: r.rx,
    zBack: r.zBack,
    cz: r.cz,
    rz: r.rz,
  };
}

/**
 * Resolves leather strap UV safely inside the shoe cutout box while avoiding
 * empty background margins and dark hollow heel interior zones.
 */
function resolveStrapBox(side, layout) {
  const mode = layout?.mode || 'top';
  if (mode === 'pair' && Array.isArray(layout.boxes) && layout.boxes.length >= 2) {
    const b0 = layout.boxes[0];
    const b1 = layout.boxes[1];
    const toeUp = !!(b1?.toeUp ?? b0?.toeUp ?? layout.toeUp);
    if (Number.isInteger(layout.heroBoxIndex) && layout.boxes[layout.heroBoxIndex]) {
      const hero = layout.boxes[layout.heroBoxIndex];
      return { ...hero, toeUp: hero.toeUp ?? toeUp };
    }
    const picked = toeUp ? (side > 0 ? b0 : b1) : side > 0 ? b1 : b0;
    return { ...picked, toeUp };
  }
  if (layout?.box) {
    return {
      ...layout.box,
      toeUp: layout.box.toeUp !== undefined ? layout.box.toeUp : layout.toeUp !== false,
    };
  }
  return null;
}

function sandalStrapUV(side, metrics, xNorm, z, layout, opts = {}) {
  const solidU = Number.isFinite(layout?.solidU) ? layout.solidU : 0.5;
  const solidV = Number.isFinite(layout?.solidV) ? layout.solidV : 0.5;
  const bx = resolveStrapBox(side, layout);
  if (!bx) {
    return [solidU, solidV];
  }
  if (layout?.mode === 'side') {
    const along = clamp((z - metrics.heelBackZ) / (metrics.toeTipZ - metrics.heelBackZ), 0, 1);
    const toeLeft = layout?.toeLeft !== false;
    const uA = toeLeft ? 1 - along : along;
    const u = lerp(bx.u0, bx.u1, clamp(uA * 0.72 + 0.14, 0.08, 0.92));
    const v = lerp(bx.v0, bx.v1, 0.48);
    return [u, v];
  }

  const toeUp = !!bx.toeUp;
  // Map along=0 (heel back) -> along=1 (toe tip) safely clear of outer drop-shadow fringe.
  const along = clamp((z - metrics.heelBackZ) / (metrics.toeTipZ - metrics.heelBackZ), 0.14, 0.86);
  const lateralU = toeUp ? 0.5 - clamp(xNorm, -1, 1) * 0.34 : 0.5 + clamp(xNorm, -1, 1) * 0.34;
  // When mapping the back heel cup walls, stay near the outer collar rim (avoid dark empty cavity interior at center).
  const uFinalNorm = opts.heelWall
    ? clamp(0.5 + (lateralU >= 0.5 ? 1 : -1) * lerp(0.28, 0.38, Math.abs(lateralU - 0.5) * 2), 0.12, 0.88)
    : clamp(lateralU, 0.14, 0.86);
  const vNorm = opts.heelWall ? clamp(lerp(0.14, 0.34, along / 0.4), 0.12, 0.40) : along;
  const v = toeUp ? lerp(bx.v0, bx.v1, vNorm) : lerp(bx.v1, bx.v0, vNorm);

  let u0 = lerp(bx.u0, bx.u1, 0.12);
  let u1 = lerp(bx.u0, bx.u1, 0.88);
  if (Array.isArray(bx.rowSpans) && bx.rowSpans.length >= 2) {
    const vFrac = clamp((v - bx.v0) / Math.max(1e-4, bx.v1 - bx.v0), 0, 1);
    const fIdx = vFrac * (bx.rowSpans.length - 1);
    const i0 = Math.floor(fIdx);
    const i1 = Math.min(bx.rowSpans.length - 1, i0 + 1);
    const ft = fIdx - i0;
    const rL = lerp(bx.rowSpans[i0][0], bx.rowSpans[i1][0], ft);
    const rR = lerp(bx.rowSpans[i0][1], bx.rowSpans[i1][1], ft);
    u0 = lerp(rL, rR, 0.10);
    u1 = lerp(rL, rR, 0.90);
  }
  return [lerp(u0, u1, uFinalNorm), v];
}

/**
 * Resolves the complete modular sandal recipe via 3-tier hierarchy:
 *  Tier 1: Structured `footwear_anatomy` from Gemini Vision
 *  Tier 2: Explicit metadata/text keywords (`spec`)
 *  Tier 3: Photo layout visual cues (`layout`)
 */
export function resolveSandalRecipe(spec = {}, layout = {}) {
  const fa = spec?.footwearAnatomy || spec?.footwear_anatomy || null;
  const hasHeelHeight = Number(fa?.heel_height_cm) > 0
    ? Number(fa.heel_height_cm) / 100
    : clamp(spec?.heelHeight || 0, 0, 0.15);
  const platformH = Number(fa?.platform_height_cm) > 0
    ? Number(fa.platform_height_cm) / 100
    : 0;

  let soleType = fa?.sole_type || null;
  if (!soleType) {
    if (spec?.heelStyle === 'stiletto') soleType = 'stiletto';
    else if (spec?.heelStyle === 'wedge') soleType = 'wedge';
    else if (spec?.isPlatform) soleType = 'flatform';
    else if (hasHeelHeight >= 0.035) soleType = 'block_heel';
    else soleType = 'flat_leather';
  }

  let silhouette = fa?.silhouette || null;
  if (!silhouette) {
    if (spec?.isFlipFlop) silhouette = 'thong_flipflop';
    else if (spec?.sandalStyle === 'tstrap' || layout?.sandalStyle === 'tstrap' || layout?.tstrap) silhouette = 't_strap';
    else if (spec?.sandalStyle === 'ankle_strap' || layout?.sandalStyle === 'ankle_strap' || spec?.hasAnkleStrap) silhouette = 'ankle_strap';
    else if (soleType === 'wedge' && hasHeelHeight >= 0.03) silhouette = 'wedge_sandal';
    else silhouette = 'slide_double';
  }

  let forefootStrap = fa?.forefoot_strap || null;
  if (!forefootStrap) {
    if (silhouette === 't_strap') forefootStrap = 'toe_post_only';
    else if (silhouette === 'thong_flipflop') forefootStrap = 'v_thong';
    else if (silhouette === 'criss_cross') forefootStrap = 'criss_cross';
    else if (silhouette === 'gladiator') forefootStrap = 'multi_thin';
    else if (silhouette === 'fisherman') forefootStrap = 'caged';
    else if (silhouette === 'slide_single' || silhouette === 'ankle_strap' || silhouette === 'slingback') forefootStrap = 'single_band';
    else forefootStrap = 'double_band';
  }

  let instepStrap = fa?.instep_strap || null;
  if (!instepStrap) {
    if (silhouette === 't_strap') {
      instepStrap = layout?.hasHeelCup ? 'scalloped_v_collar' : 't_stem';
    } else if (silhouette === 'criss_cross') {
      instepStrap = 'criss_cross';
    } else if (silhouette === 'fisherman') {
      instepStrap = 'caged';
    } else if (silhouette === 'slide_double' || silhouette === 'sport_velcro') {
      instepStrap = 'buckle_band';
    } else {
      instepStrap = 'none';
    }
  }

  let backStyle = fa?.back_style || null;
  if (!backStyle) {
    if (silhouette === 'gladiator') backStyle = 'lace_up_calf';
    else if (silhouette === 'slingback') backStyle = 'slingback';
    else if (silhouette === 'ankle_strap' || hasHeelHeight >= 0.035) backStyle = 'ankle_strap';
    else if (silhouette === 't_strap') {
      if (layout?.hasHeelCup) backStyle = 'open_heel_cup';
      else if (layout?.hasAnkleStrap || spec?.hasAnkleStrap) backStyle = 'ankle_strap';
      else if (!spec?.isFlipFlop) backStyle = 'open_heel_cup';
      else backStyle = 'open_backless';
    } else if (layout?.hasHeelCup) {
      backStyle = 'open_heel_cup';
    } else if (layout?.hasAnkleStrap || spec?.hasAnkleStrap) {
      backStyle = 'ankle_strap';
    } else {
      backStyle = 'open_backless';
    }
  }

  const strapWidth = fa?.strap_width || (hasHeelHeight >= 0.04 ? 'delicate' : 'medium');
  const toeStyle = fa?.toe_style || (forefootStrap === 'toe_post_only' || forefootStrap === 'v_thong' ? 'thong_post' : 'open_round');

  const hwSet = new Set(Array.isArray(fa?.hardware) ? fa.hardware.filter((h) => h && h !== 'none') : []);
  if (spec?.hasRingHardware || layout?.hasRingHardware) hwSet.add('metal_ring');
  if (spec?.hasStuds) hwSet.add('micro_studs');
  if (spec?.hasBuckle) {
    hwSet.add(backStyle === 'ankle_strap' ? 'ankle_buckle' : 'buckle');
  }
  const hardware = Array.from(hwSet);
  const hardwareTone = hardware.length === 1 && hardware[0] === 'micro_studs' ? 'brass' : 'silver';

  const soleThickness = Math.max(
    0.009,
    platformH > 0
      ? platformH
      : soleType === 'flatform'
        ? 0.034
        : soleType === 'contoured_cork'
          ? 0.020
          : clamp(spec?.soleThickness || 0.012, 0.009, 0.045)
  );

  return {
    silhouette,
    soleType,
    heelHeight: hasHeelHeight,
    soleThickness,
    toeStyle,
    forefootStrap,
    instepStrap,
    backStyle,
    strapWidth,
    hardware,
    hardwareTone,
    widthScale: strapWidth === 'wide' ? 1.35 : strapWidth === 'delicate' ? 0.78 : 1.0,
  };
}

/**
 * Builds a watertight 3D beveled leather strap along centerline samples.
 * `samples`: array of `{ p: Vector3, n: Vector3, halfW: number, thick: number, uv: [u, v] }`
 * where `n` points strictly OUTWARD from the foot surface so thickness builds outward.
 */
function build3DLeatherStrap(samples) {
  if (!samples || samples.length < 2) return null;

  // Compute smooth tangent vectors & transverse binormals at every sample.
  const nStations = samples.length;
  const frames = [];
  for (let i = 0; i < nStations; i++) {
    const pPrev = samples[Math.max(0, i - 1)].p;
    const pNext = samples[Math.min(nStations - 1, i + 1)].p;
    const T = new THREE.Vector3().subVectors(pNext, pPrev);
    if (T.lengthSq() < 1e-10) T.set(0, 0, 1);
    T.normalize();

    const N = samples[i].n.clone().normalize();
    // Orthogonalize N against T and compute right-handed binormal B = normalize(T x N)
    N.addScaledVector(T, -N.dot(T));
    if (N.lengthSq() < 1e-10) N.set(0, 1, 0);
    N.normalize();
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    frames.push({ T, N, B, ...samples[i] });
  }

  // 8-point chamfered leather cross section (counter-clockwise in B, N plane when looking along +T)
  // Using (bCoeff, nCoeff): since T x N = B, T x B = -N -> (B x T) = +N.
  // In loop k: angle progresses in (+B, +N) plane: B*b + N*n.
  // Inner face touches clearance surface (n=0), outer face rises +thick along +N.
  const section = [
    [1.0, 0.20],   // 0 outer-right bevel lower
    [0.72, 0.92],  // 1 outer-right bevel upper
    [0.0, 1.0],    // 2 outer center crown
    [-0.72, 0.92], // 3 outer-left bevel upper
    [-1.0, 0.20],  // 4 outer-left bevel lower
    [-0.86, 0.0],  // 5 inner-left edge
    [0.0, -0.05],  // 6 inner center
    [0.86, 0.0],   // 7 inner-right edge
  ];
  const nSec = section.length;
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < nStations; i++) {
    const f = frames[i];
    for (let k = 0; k < nSec; k++) {
      const [bc, nc] = section[k];
      const vx = f.p.x + f.B.x * (bc * f.halfW) + f.N.x * (nc * f.thick);
      const vy = f.p.y + f.B.y * (bc * f.halfW) + f.N.y * (nc * f.thick);
      const vz = f.p.z + f.B.z * (bc * f.halfW) + f.N.z * (nc * f.thick);
      verts.push(vx, vy, vz);
      uvs.push(f.uv[0], f.uv[1]);
    }
  }

  // Orient quad winding automatically against outward vector for guaranteed outside normals
  for (let i = 0; i < nStations - 1; i++) {
    for (let k = 0; k < nSec; k++) {
      const kn = (k + 1) % nSec;
      const a = i * nSec + k;
      const b = i * nSec + kn;
      const c = (i + 1) * nSec + k;
      const d = (i + 1) * nSec + kn;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Check sample quad #0 center normal orientation vs outward direction:
  // Midpoint of k=1->2 is outer top-right (+N). Verify tri (a,b,c) at k=1 faces +N.
  if (nStations >= 2) {
    const f0 = frames[0];
    const i0 = 1;
    const aIdx = 0 * nSec + i0;
    const bIdx = 0 * nSec + i0 + 1;
    const cIdx = 1 * nSec + i0;
    const vA = new THREE.Vector3(verts[aIdx * 3], verts[aIdx * 3 + 1], verts[aIdx * 3 + 2]);
    const vB = new THREE.Vector3(verts[bIdx * 3], verts[bIdx * 3 + 1], verts[bIdx * 3 + 2]);
    const vC = new THREE.Vector3(verts[cIdx * 3], verts[cIdx * 3 + 1], verts[cIdx * 3 + 2]);
    const triN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
    if (triN.dot(f0.N) < 0) {
      for (let t = 0; t < indices.length; t += 3) {
        const tmp = indices[t + 1];
        indices[t + 1] = indices[t + 2];
        indices[t + 2] = tmp;
      }
    }
  }

  // Seal start cap & end cap cleanly
  const addEndCap = (stationIdx, flip) => {
    const f = frames[stationIdx];
    const cIdx = verts.length / 3;
    verts.push(
      f.p.x + f.N.x * (0.45 * f.thick),
      f.p.y + f.N.y * (0.45 * f.thick),
      f.p.z + f.N.z * (0.45 * f.thick)
    );
    uvs.push(f.uv[0], f.uv[1]);
    const base = stationIdx * nSec;
    for (let k = 0; k < nSec; k++) {
      const kn = (k + 1) % nSec;
      if (flip) {
        indices.push(cIdx, base + k, base + kn);
      } else {
        indices.push(cIdx, base + kn, base + k);
      }
    }
  };

  // Orient start cap against -T0 and end cap against +T_last
  const fFirst = frames[0];
  const capStartBase = indices.length;
  addEndCap(0, false);
  if (indices.length >= capStartBase + 3) {
    const iA = indices[capStartBase];
    const iB = indices[capStartBase + 1];
    const iC = indices[capStartBase + 2];
    const vA = new THREE.Vector3(verts[iA * 3], verts[iA * 3 + 1], verts[iA * 3 + 2]);
    const vB = new THREE.Vector3(verts[iB * 3], verts[iB * 3 + 1], verts[iB * 3 + 2]);
    const vC = new THREE.Vector3(verts[iC * 3], verts[iC * 3 + 1], verts[iC * 3 + 2]);
    const triN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
    if (triN.dot(fFirst.T) > 0) {
      for (let t = capStartBase; t < indices.length; t += 3) {
        const tmp = indices[t + 1];
        indices[t + 1] = indices[t + 2];
        indices[t + 2] = tmp;
      }
    }
  }

  const fLast = frames[nStations - 1];
  const capEndBase = indices.length;
  addEndCap(nStations - 1, true);
  if (indices.length >= capEndBase + 3) {
    const iA = indices[capEndBase];
    const iB = indices[capEndBase + 1];
    const iC = indices[capEndBase + 2];
    const vA = new THREE.Vector3(verts[iA * 3], verts[iA * 3 + 1], verts[iA * 3 + 2]);
    const vB = new THREE.Vector3(verts[iB * 3], verts[iB * 3 + 1], verts[iB * 3 + 2]);
    const vC = new THREE.Vector3(verts[iC * 3], verts[iC * 3 + 1], verts[iC * 3 + 2]);
    const triN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
    if (triN.dot(fLast.T) < 0) {
      for (let t = capEndBase; t < indices.length; t += 3) {
        const tmp = indices[t + 1];
        indices[t + 1] = indices[t + 2];
        indices[t + 2] = tmp;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper to evaluate a transverse / curved foot-hugging arch sample `(x, y, z)` + outward normal `n`
 * at `(z, xNorm)` with strict positive clearance above `evalFootDorsumSurface`.
 */
function sampleDorsumArchPoint(metrics, side, z, xNorm, layout, clearance = 0.0046) {
  const { cx, hw } = evalFootSlice(metrics, side, z);
  const footMargin = 0.0042 + clearance * 0.4;
  const effHw = hw + footMargin;
  const x = cx + side * xNorm * effHw;
  const yFoot = evalFootDorsumSurface(metrics, z, xNorm);
  const absN = Math.abs(xNorm);
  const yBaseMin = -0.0048;
  // Blend down toward footbed rim near |xNorm| >= 0.88 so ends anchor cleanly into welt edge
  const edgeAnchor = smoothstep(0.86, 1.04, absN);
  const y = lerp(Math.max(yBaseMin + 0.004, yFoot + clearance), yBaseMin, edgeAnchor);
  // Compute finite-difference surface normal (df/dx, df/dz) pointing strictly outward
  const n = new THREE.Vector3(
    side * Math.sin(clamp(xNorm, -1, 1) * Math.PI * 0.44),
    Math.max(0.28, Math.cos(clamp(xNorm, -1, 1) * Math.PI * 0.44)),
    0.08
  ).normalize();
  return {
    p: new THREE.Vector3(x, y, z),
    n,
    uv: sandalStrapUV(side, metrics, xNorm, z, layout),
  };
}

/**
 * Builds the watertight ergonomic sandal sole/outsole (Group 1) and clean cupped
 * leather/cork insole top surface (Group 2) with sealed toe & heel contours.
 */
function buildSandalFootbedParts(side, metrics, recipe) {
  const soleH = recipe.soleThickness;
  const z0 = metrics.heelBackZ - 0.011;
  const z1 = metrics.toeTipZ + 0.014;
  const zHeelAnchor = metrics.heelBackZ + 0.030;
  const zToeAnchor = metrics.toeTipZ - 0.028;

  const heelRef = evalFootSlice(metrics, side, zHeelAnchor);
  const toeRef = evalFootSlice(metrics, side, zToeAnchor);
  const ballRef = evalFootSlice(metrics, side, metrics.ballZ);
  const solePad = 0.0068;

  const nz = 38;
  const slices = [];
  for (let i = 0; i <= nz; i++) {
    // Cosine distribution concentrates resolution along toe & heel rounded caps
    const t = 0.5 * (1 - Math.cos((i / nz) * Math.PI));
    const z = lerp(z0, z1, t);
    let cx;
    let hw;
    if (z < zHeelAnchor) {
      const u = clamp((zHeelAnchor - z) / Math.max(1e-4, zHeelAnchor - z0), 0, 1);
      const round = Math.sqrt(Math.max(0.075, 1 - Math.pow(u, 2.2) * 0.925));
      cx = heelRef.cx;
      hw = (heelRef.hw + solePad) * round;
    } else if (z > zToeAnchor) {
      const u = clamp((z - zToeAnchor) / Math.max(1e-4, z1 - zToeAnchor), 0, 1);
      const pToe = recipe.toeStyle === 'open_square' ? 3.8 : 2.35;
      const round = Math.sqrt(Math.max(0.085, 1 - Math.pow(u, pToe) * 0.915));
      // Track toward anatomical big-toe / 2nd-toe apex so medial big toe never overhangs outsole perimeter
      const toeApexCx = side * (metrics.isMale ? 0.124 : 0.151);
      cx = lerp(toeRef.cx, toeApexCx, Math.pow(u, 1.25));
      hw = (toeRef.hw + solePad + 0.0012 * u) * round;
    } else {
      const sl = evalFootSlice(metrics, side, z);
      cx = sl.cx;
      hw = sl.hw + solePad;
      // Subtle ergonomic inward arch pinch at midfoot medial side
      const archMid = Math.exp(-Math.pow((z - (metrics.heelBackZ + 0.095)) / 0.035, 2));
      cx += side * 0.0022 * archMid;
      hw -= 0.0020 * archMid;
    }

    // Slight cupped footbed perimeter: contacts foot sole gently at -0.0065 while rim stands at -0.0025
    const yRim = -0.0026;
    const yInsoleCenter = -0.0062;
    const wedgeArchExtra =
      recipe.soleType === 'wedge' && recipe.heelHeight > 0.02
        ? smoothstep(metrics.ballZ, metrics.heelBackZ, z) * recipe.heelHeight * 0.38
        : 0;
    const yBottom = -0.0072 - soleH - wedgeArchExtra;

    slices.push({ z, cx, hw, yRim, yInsoleCenter, yBottom, uLong: t });
  }

  // Group 1: Watertight outsole perimeter & bottom hull
  // Cross section around outsole hull (12 points from outer rim down around bottom up to inner rim, plus top rim lip)
  const hullVerts = [];
  const hullUvs = [];
  const hullIndices = [];
  const nHull = 14;

  for (let i = 0; i <= nz; i++) {
    const s = slices[i];
    const inRimFrac = 0.90;
    const pts = [
      // Top bevel lip (inner rim -> outer rim)
      [s.cx - s.hw * inRimFrac, s.yRim - 0.0005],
      [s.cx - s.hw * 0.98, s.yRim],
      // Left/medial outer sidewall descending to bottom
      [s.cx - s.hw * 1.03, lerp(s.yRim, s.yBottom, 0.35)],
      [s.cx - s.hw * 1.02, lerp(s.yRim, s.yBottom, 0.78)],
      [s.cx - s.hw * 0.94, s.yBottom],
      // Bottom sole tread surface
      [s.cx - s.hw * 0.45, s.yBottom],
      [s.cx, s.yBottom],
      [s.cx + s.hw * 0.45, s.yBottom],
      // Right/lateral bottom corner & sidewall ascending
      [s.cx + s.hw * 0.94, s.yBottom],
      [s.cx + s.hw * 1.02, lerp(s.yRim, s.yBottom, 0.78)],
      [s.cx + s.hw * 1.03, lerp(s.yRim, s.yBottom, 0.35)],
      [s.cx + s.hw * 0.98, s.yRim],
      // Top bevel lip right (outer rim -> inner rim)
      [s.cx + s.hw * inRimFrac, s.yRim - 0.0005],
      // Recessed middle of sole underside? No, complete closed ring back to point 0 across top interior so Group 1 itself is sealed, while Group 2 insoles sit neatly at yInsole!
      [s.cx, s.yInsoleCenter - 0.0005],
    ];
    for (let k = 0; k < nHull; k++) {
      hullVerts.push(pts[k][0], pts[k][1], s.z);
      hullUvs.push(k / nHull, s.uLong);
    }
  }

  for (let i = 0; i < nz; i++) {
    for (let k = 0; k < nHull; k++) {
      const kn = (k + 1) % nHull;
      const a = i * nHull + k;
      const b = i * nHull + kn;
      const c = (i + 1) * nHull + k;
      const d = (i + 1) * nHull + kn;
      // Since +z points forward and point order goes clockwise around Y/X, verify outward direction at bottom center k=5->6
      hullIndices.push(a, c, b, b, c, d);
    }
  }

  // Verify outward winding at sole bottom center using the ACTUAL triangle indices stored in hullIndices
  if (hullIndices.length >= 6) {
    const triBase = (Math.floor(nz / 2) * nHull + 5) * 6;
    const iA = hullIndices[triBase];
    const iB = hullIndices[triBase + 1];
    const iC = hullIndices[triBase + 2];
    const vA = new THREE.Vector3(hullVerts[iA * 3], hullVerts[iA * 3 + 1], hullVerts[iA * 3 + 2]);
    const vB = new THREE.Vector3(hullVerts[iB * 3], hullVerts[iB * 3 + 1], hullVerts[iB * 3 + 2]);
    const vC = new THREE.Vector3(hullVerts[iC * 3], hullVerts[iC * 3 + 1], hullVerts[iC * 3 + 2]);
    const triN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
    if (triN.y > 0) {
      for (let t = 0; t < hullIndices.length; t += 3) {
        const tmp = hullIndices[t + 1];
        hullIndices[t + 1] = hullIndices[t + 2];
        hullIndices[t + 2] = tmp;
      }
    }
  }

  // Seal heel & toe endcaps on outsole hull
  const capHullEnd = (sliceIdx, dirZ) => {
    const s = slices[sliceIdx];
    const centerIdx = hullVerts.length / 3;
    const yMid = 0.5 * (s.yRim + s.yBottom);
    hullVerts.push(s.cx, yMid, s.z + dirZ * 0.0005);
    hullUvs.push(0.5, s.uLong);
    const startTri = hullIndices.length;
    const base = sliceIdx * nHull;
    for (let k = 0; k < nHull; k++) {
      const kn = (k + 1) % nHull;
      hullIndices.push(centerIdx, base + k, base + kn);
    }
    const iA = hullIndices[startTri];
    const iB = hullIndices[startTri + 1];
    const iC = hullIndices[startTri + 2];
    const vA = new THREE.Vector3(hullVerts[iA * 3], hullVerts[iA * 3 + 1], hullVerts[iA * 3 + 2]);
    const vB = new THREE.Vector3(hullVerts[iB * 3], hullVerts[iB * 3 + 1], hullVerts[iB * 3 + 2]);
    const vC = new THREE.Vector3(hullVerts[iC * 3], hullVerts[iC * 3 + 1], hullVerts[iC * 3 + 2]);
    const triN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
    if (triN.z * dirZ < 0) {
      for (let t = startTri; t < hullIndices.length; t += 3) {
        const tmp = hullIndices[t + 1];
        hullIndices[t + 1] = hullIndices[t + 2];
        hullIndices[t + 2] = tmp;
      }
    }
  };
  capHullEnd(0, -1);
  capHullEnd(nz, 1);

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullVerts, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hullUvs, 2));
  hullGeo.setIndex(hullIndices);
  hullGeo.computeVertexNormals();

  // Group 2: Cupped leather/cork insole top surface (slightly recessed inside outer rim)
  const nAcross = 8;
  const insoleVerts = [];
  const insoleUvs = [];
  const insoleIndices = [];
  for (let i = 0; i <= nz; i++) {
    const s = slices[i];
    const span = s.hw * 0.91;
    for (let j = 0; j <= nAcross; j++) {
      const u = (j / nAcross) * 2 - 1;
      const x = s.cx + u * span;
      const cup = Math.pow(Math.abs(u), 2.2);
      const y = lerp(s.yInsoleCenter, s.yRim - 0.0004, cup);
      insoleVerts.push(x, y, s.z);
      insoleUvs.push(j / nAcross, s.uLong);
    }
  }
  const stride = nAcross + 1;
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nAcross; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      insoleIndices.push(a, c, b, b, c, d);
    }
  }
  // Ensure insole normals point strictly +Y
  if (insoleIndices.length >= 3) {
    const iA = insoleIndices[0];
    const iB = insoleIndices[1];
    const iC = insoleIndices[2];
    const vA = new THREE.Vector3(insoleVerts[iA * 3], insoleVerts[iA * 3 + 1], insoleVerts[iA * 3 + 2]);
    const vB = new THREE.Vector3(insoleVerts[iB * 3], insoleVerts[iB * 3 + 1], insoleVerts[iB * 3 + 2]);
    const vC = new THREE.Vector3(insoleVerts[iC * 3], insoleVerts[iC * 3 + 1], insoleVerts[iC * 3 + 2]);
    const triN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
    if (triN.y < 0) {
      for (let t = 0; t < insoleIndices.length; t += 3) {
        const tmp = insoleIndices[t + 1];
        insoleIndices[t + 1] = insoleIndices[t + 2];
        insoleIndices[t + 2] = tmp;
      }
    }
  }

  const insoleGeo = new THREE.BufferGeometry();
  insoleGeo.setAttribute('position', new THREE.Float32BufferAttribute(insoleVerts, 3));
  insoleGeo.setAttribute('uv', new THREE.Float32BufferAttribute(insoleUvs, 2));
  insoleGeo.setIndex(insoleIndices);
  insoleGeo.computeVertexNormals();

  return [
    { geometry: hullGeo, materialIndex: 1 },
    { geometry: insoleGeo, materialIndex: 2 },
  ];
}

/**
 * Computes points along the continuous T-strap center stem from the embedded
 * inter-toe cleft anchor up along the foot dorsum to the instep junction.
 */
function evaluateTStemCurve(side, metrics, recipe, layout) {
  const hasRing = recipe.hardware.includes('metal_ring');
  const baseHalfW = (hasRing ? 0.0085 : 0.0060) * recipe.widthScale;
  const thick = 0.0034;

  const cleftX = side * metrics.toeCleftX;
  const cleftZ = metrics.toeCleftZ;
  const slCleft = evalFootSlice(metrics, side, cleftZ);
  const cleftNorm = clamp((cleftX - slCleft.cx) / Math.max(1e-4, slCleft.hw), -0.8, 0.8);
  const cleftSurfaceY = evalFootDorsumSurface(metrics, cleftZ, cleftNorm);
  // Sit apex snugly on the convex upper instep (below the sharp ankle-shin crease)
  const zEnd = metrics.instepZ + 0.014;

  // Step 1: Vertical toe post anchored inside footbed (-0.0065) up through inter-toe cleft
  const pts = [];
  const nPost = 5;
  for (let i = 0; i <= nPost; i++) {
    const t = i / nPost;
    const y = lerp(-0.0065, cleftSurfaceY + 0.0045, t);
    const z = lerp(cleftZ, cleftZ - 0.003, t);
    // Outward normal faces forward (+Z) near vertical toe post curving smoothly to dorsal (+Y)
    const n = new THREE.Vector3(0, smoothstep(0.35, 1.0, t), Math.max(0.25, 1.0 - t * 0.7)).normalize();
    pts.push({
      p: new THREE.Vector3(cleftX, y, z),
      n,
      halfW: lerp(0.0032, baseHalfW * 0.82, smoothstep(0.4, 1.0, t)),
      thick: lerp(0.0028, thick, smoothstep(0.4, 1.0, t)),
      uv: sandalStrapUV(side, metrics, cleftNorm, z, layout),
    });
  }

  // Step 2: Dorsal center stem sweeping back over forefoot & instep to V-collar junction
  const nStem = 16;
  for (let i = 1; i <= nStem; i++) {
    const t = i / nStem;
    const z = lerp(cleftZ - 0.004, zEnd, t);
    const sl = evalFootSlice(metrics, side, z);
    // Smoothly transition centerline from toe cleft X toward dorsal arch center ridge (xNorm = -0.10)
    const xTargetNorm = lerp(cleftNorm, -0.08, smoothstep(0.0, 0.45, t));
    const x = sl.cx + side * xTargetNorm * sl.hw;
    const yFoot = evalFootDorsumSurface(metrics, z, xTargetNorm);
    const y = yFoot + 0.0042;
    const hwMod = hasRing ? baseHalfW * lerp(0.85, 1.35, smoothstep(0.3, 0.6, t)) : baseHalfW * lerp(0.88, 1.06, t);
    pts.push({
      p: new THREE.Vector3(x, y, z),
      n: new THREE.Vector3(0, 0.96, 0.28).normalize(),
      halfW: hwMod,
      thick,
      uv: sandalStrapUV(side, metrics, xTargetNorm, z, layout),
    });
  }
  return pts;
}

/**
 * Evaluates a single continuous bilateral V / scalloped instep collar spline sweeping
 * seamlessly from the medial heel cup / welt side, up over the dorsal T-junction apex,
 * and down to the lateral heel cup / welt side with zero apex pinch or side gap.
 */
function evaluateInstepVCollarCurves(side, metrics, recipe, layout) {
  const isScalloped = recipe.instepStrap === 'scalloped_v_collar';
  const baseHalfW = (isScalloped ? 0.0076 : 0.0064) * recipe.widthScale;
  const thick = 0.0034;

  const meetsHeelCup =
    recipe.backStyle === 'open_heel_cup' ||
    recipe.backStyle === 'closed_heel_counter' ||
    recipe.backStyle === 'slingback';
  // Meet the T-stem cleanly on the convex instep ridge without crossing into the ankle crease gap
  const zApex = metrics.instepZ + 0.014;
  // Slightly overlap into the front rim of buildHorizontalPosteriorWrap (z ~ heelBackZ + 0.050) for zero gap
  const zSideTarget = meetsHeelCup
    ? metrics.heelBackZ + 0.044
    : metrics.heelBackZ + 0.068;
  const nHalf = 13;

  const apexY = evalFootDorsumSurface(metrics, zApex, -0.08) + 0.0044;
  const yCupFront =
    recipe.backStyle === 'closed_heel_counter'
      ? 0.046
      : recipe.backStyle === 'open_heel_cup'
        ? 0.039
        : recipe.backStyle === 'slingback'
          ? 0.036
          : -0.0045;

  const wingPts = [];
  for (let idx = -nHalf; idx <= nHalf; idx++) {
    const signedFrac = idx / nHalf; // -1 (medial tip) .. 0 (dorsal apex) .. +1 (lateral tip)
    const t = Math.abs(signedFrac);
    const dir = signedFrac >= 0 ? 1 : -1;
    // C^1 smooth sweep at apex (dz/dt -> 0 at t=0) eliminating pinch or upright flap
    const tSweepZ = Math.pow(t, 1.55);
    const z = lerp(zApex, zSideTarget, tSweepZ);
    const xNorm = lerp(-0.08, dir * 1.04, Math.sin(t * Math.PI * 0.5));
    const sl = evalFootSlice(metrics, side, z);
    const yDesired = lerp(apexY, yCupFront, smoothstep(0.05, 1.0, t));
    const ring = evalAnkleRing(metrics, side, Math.max(0.015, yDesired));
    const minSideRadius = Math.max(sl.hw + 0.0048, lerp(0, ring.rx + 0.0052, smoothstep(0.20, 0.75, t)));
    const xCenter = lerp(sl.cx, ring.cx, smoothstep(0.25, 1.0, t));
    const x = xCenter + side * xNorm * minSideRadius;

    const yFoot = evalFootDorsumSurface(metrics, z, xNorm);
    // Only follow top dorsum height over the central crown (t < 0.48); once past the arch crest, follow symmetric collar contour yDesired around the ankle sides (clearing skin via minSideRadius)
    const dorsalFollow = 1 - smoothstep(0.18, 0.48, t);
    const y = Math.max(yDesired, lerp(yDesired, yFoot + 0.0044, dorsalFollow));

    const n = new THREE.Vector3(
      side * Math.sin(signedFrac * Math.PI * 0.44),
      lerp(0.95, 0.26, smoothstep(0.15, 0.95, t)),
      lerp(0.28, 0.04, t)
    ).normalize();

    const scallopMod = isScalloped ? 1 + 0.14 * Math.sin(t * Math.PI * 3.5) : 1.0;
    wingPts.push({
      p: new THREE.Vector3(x, y, z),
      n,
      halfW: baseHalfW * scallopMod * lerp(1.04, 0.90, t),
      thick,
      uv: sandalStrapUV(side, metrics, xNorm, z, layout),
    });
  }
  return [wingPts];
}

/**
 * Builds a single 3D curved foot-hugging arch strap centered near `zCenter`.
 */
function buildCurvedArchBand(side, metrics, zCenter, halfW, thick, layout, zSkew = 0, yLift = 0.0045) {
  const nPts = 18;
  const pts = [];
  for (let i = 0; i <= nPts; i++) {
    const xNorm = lerp(-1.05, 1.05, i / nPts);
    const z = zCenter + xNorm * zSkew;
    const s = sampleDorsumArchPoint(metrics, side, z, xNorm, layout, yLift);
    pts.push({
      p: s.p,
      n: s.n,
      halfW,
      thick,
      uv: s.uv,
    });
  }
  return build3DLeatherStrap(pts);
}

/**
 * Builds a 3D horizontal wrap around the posterior heel/ankle (`open_heel_cup`, `closed_heel_counter`, `slingback`).
 * NEVER bridges over the top of the ankle (`ang ∈ [-112°, +112°]` facing `-Z` rear).
 */
function buildHorizontalPosteriorWrap(side, metrics, opts, layout) {
  const {
    yLowBottom,
    yBackTop,
    yFrontTip,
    angSpanRad = 0.62 * Math.PI,
    thickness = 0.0030,
    zReachScale = 1.0,
    standalone = false,
  } = opts;

  const nY = 6;
  const nArc = 18;
  const rzCup = 0.048 * zReachScale;
  const outerVerts = [];
  const outerUvs = [];
  const innerVerts = [];
  const innerUvs = [];

  for (let iy = 0; iy <= nY; iy++) {
    const vFrac = iy / nY;
    for (let j = 0; j <= nArc; j++) {
      const uFrac = j / nArc;
      const theta = uFrac * 2 - 1; // -1 medial wing tip, 0 posterior center, +1 lateral wing tip
      const ang = theta * angSpanRad;

      const rimH = lerp(yBackTop, yFrontTip, Math.pow(Math.abs(theta), 1.35));
      const y = lerp(yLowBottom, rimH, vFrac);
      const ring = evalAnkleRing(metrics, side, Math.max(0.015, y));

      // Anchor bottom tightly to footbed perimeter when sitting on sole
      const baseFoot = evalFootSlice(metrics, side, metrics.heelBackZ + 0.015);
      const rxClear = lerp(Math.max(ring.rx, baseFoot.hw) + 0.0052, ring.rx + 0.0048, smoothstep(0.0, 0.5, vFrac));
      const rzClear = rzCup;

      const xNormApprox = clamp(Math.sin(ang), -1, 1);
      const xIn = ring.cx + side * rxClear * Math.sin(ang);
      const zIn = (ring.zBack - 0.0045) + (1 - Math.cos(ang)) * rzClear;

      // Radial outward vector from heel core axis
      const outX = side * Math.sin(ang);
      const outZ = -Math.cos(ang);
      const normLen = Math.hypot(outX, outZ) || 1;
      const nx = outX / normLen;
      const nz = outZ / normLen;

      const xOut = xIn + nx * thickness;
      const zOut = zIn + nz * thickness;

      outerVerts.push(xOut, y, zOut);
      innerVerts.push(xIn, y, zIn);

      const [uTex, vTex] = sandalStrapUV(side, metrics, xNormApprox, zIn, layout, { heelWall: true });
      outerUvs.push(uTex, vTex);
      innerUvs.push(uTex, vTex);
    }
  }

  const stride = nArc + 1;
  const outerIndices = [];
  const innerIndices = [];
  for (let iy = 0; iy < nY; iy++) {
    for (let j = 0; j < nArc; j++) {
      const a = iy * stride + j;
      const b = a + 1;
      const c = (iy + 1) * stride + j;
      const d = c + 1;
      outerIndices.push(a, c, b, b, c, d);
      innerIndices.push(a, b, c, b, d, c);
    }
  }

  // Orient outer wall strictly outward (-Z at theta=0, iy=nY/2, j=nArc/2) and inner wall inward (+Z at theta=0)
  const triBase = (Math.floor(nY / 2) * nArc + Math.floor(nArc / 2)) * 6;
  const oA = outerIndices[triBase];
  const oB = outerIndices[triBase + 1];
  const oC = outerIndices[triBase + 2];
  const vA = new THREE.Vector3(outerVerts[oA * 3], outerVerts[oA * 3 + 1], outerVerts[oA * 3 + 2]);
  const vB = new THREE.Vector3(outerVerts[oB * 3], outerVerts[oB * 3 + 1], outerVerts[oB * 3 + 2]);
  const vC = new THREE.Vector3(outerVerts[oC * 3], outerVerts[oC * 3 + 1], outerVerts[oC * 3 + 2]);
  const testN = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
  if (testN.z > 0) {
    // Flip outer and inner triangle sets
    for (let t = 0; t < outerIndices.length; t += 3) {
      let tmp = outerIndices[t + 1]; outerIndices[t + 1] = outerIndices[t + 2]; outerIndices[t + 2] = tmp;
      tmp = innerIndices[t + 1]; innerIndices[t + 1] = innerIndices[t + 2]; innerIndices[t + 2] = tmp;
    }
  }

  // Outer shell geo (Material 0) + Top/Side Border Rim stitching Outer & Inner together (Material 0)
  const borderVerts = [...outerVerts];
  const borderUvs = [...outerUvs];
  const borderIndices = [...outerIndices];
  const innerOffset = outerVerts.length / 3;
  for (let i = 0; i < innerVerts.length; i++) borderVerts.push(innerVerts[i]);
  for (let i = 0; i < innerUvs.length; i++) borderUvs.push(innerUvs[i]);

  // Stitch top rim edge (iy = nY) pointing +Y
  const topOuter = nY * stride;
  const topInner = innerOffset + nY * stride;
  const topStart = borderIndices.length;
  for (let j = 0; j < nArc; j++) {
    appendQuad(borderIndices, topOuter + j, topOuter + j + 1, topInner + j, topInner + j + 1);
  }
  const tCheckA = borderIndices[topStart];
  const tCheckB = borderIndices[topStart + 1];
  const tCheckC = borderIndices[topStart + 2];
  const tN = new THREE.Vector3(borderVerts[tCheckB * 3] - borderVerts[tCheckA * 3], borderVerts[tCheckB * 3 + 1] - borderVerts[tCheckA * 3 + 1], borderVerts[tCheckB * 3 + 2] - borderVerts[tCheckA * 3 + 2])
    .cross(new THREE.Vector3(borderVerts[tCheckC * 3] - borderVerts[tCheckA * 3], borderVerts[tCheckC * 3 + 1] - borderVerts[tCheckA * 3 + 1], borderVerts[tCheckC * 3 + 2] - borderVerts[tCheckA * 3 + 2]));
  if (tN.y < 0) {
    for (let t = topStart; t < borderIndices.length; t += 3) {
      const tmp = borderIndices[t + 1]; borderIndices[t + 1] = borderIndices[t + 2]; borderIndices[t + 2] = tmp;
    }
  }

  // Stitch bottom rim + left/right forward edge caps cleanly
  const botOuter = 0;
  const botInner = innerOffset;
  for (let j = 0; j < nArc; j++) {
    borderIndices.push(botOuter + j, botInner + j, botOuter + j + 1, botOuter + j + 1, botInner + j, botInner + j + 1);
  }
  for (let iy = 0; iy < nY; iy++) {
    // Left vertical edge (j = 0)
    const o0 = iy * stride;
    const o1 = (iy + 1) * stride;
    const i0 = innerOffset + o0;
    const i1 = innerOffset + o1;
    borderIndices.push(o0, i0, o1, o1, i0, i1);
    // Right vertical edge (j = nArc)
    const ro0 = o0 + nArc;
    const ro1 = o1 + nArc;
    const ri0 = innerOffset + ro0;
    const ri1 = innerOffset + ro1;
    borderIndices.push(ro0, ro1, ri0, ro1, ri1, ri0);
  }

  const outerGeo = new THREE.BufferGeometry();
  outerGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderVerts, 3));
  outerGeo.setAttribute('uv', new THREE.Float32BufferAttribute(borderUvs, 2));
  outerGeo.setIndex(borderIndices);
  outerGeo.computeVertexNormals();

  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerVerts, 3));
  innerGeo.setAttribute('uv', new THREE.Float32BufferAttribute(innerUvs, 2));
  innerGeo.setIndex(innerIndices);
  innerGeo.computeVertexNormals();

  const result = [{ geometry: outerGeo, materialIndex: 0 }];
  // Render inner heel lining cleanly (Material 2 leather liner in standalone or worn)
  if (standalone || yBackTop - yLowBottom > 0.025) {
    result.push({ geometry: innerGeo, materialIndex: 2 });
  } else {
    innerGeo.dispose();
  }
  return result;
}

/**
 * Builds a full 360-degree horizontal 3D ankle wrap strap around measured ankle geometry at `yAnkle`.
 */
function buildHorizontalAnkleWrap(side, metrics, yAnkle, halfW, thick, layout) {
  const nSeg = 26;
  const ring = evalAnkleRing(metrics, side, yAnkle);
  const rx = ring.rx + 0.0052;
  const rz = ring.rz + 0.0052;
  const pts = [];
  for (let i = 0; i <= nSeg; i++) {
    const th = (i / nSeg) * Math.PI * 2;
    const x = ring.cx + side * rx * Math.sin(th);
    const z = ring.cz + rz * Math.cos(th);
    const n = new THREE.Vector3(side * Math.sin(th), 0.04, Math.cos(th)).normalize();
    pts.push({
      p: new THREE.Vector3(x, yAnkle, z),
      n,
      halfW,
      thick,
      uv: sandalStrapUV(side, metrics, Math.sin(th), z, layout, { heelWall: true }),
    });
  }
  return build3DLeatherStrap(pts);
}

/**
 * Builds all modular 3D geometries `{ geometry, materialIndex }` for ONE foot (`side = -1 | +1`).
 * Caller merges across both sides via `mergeGeometryParts`.
 */
export function buildModularSandalForSide(side, _legacyAnatomy, spec, layout, standalone = false) {
  const metrics = getSandalFootMetrics(Boolean(spec?.isMale ?? (_legacyAnatomy?.heelZ < -0.04)));
  const recipe = resolveSandalRecipe(spec, layout);
  const parts = [];

  // 1. Ergonomic Contoured Footbed & Outsole (Group 1 = sole, Group 2 = cupped insole)
  parts.push(...buildSandalFootbedParts(side, metrics, recipe));

  // 2. Forefoot Strap Module (Group 0)
  const thick = 0.0034;
  if (recipe.forefootStrap === 'toe_post_only') {
    const stemPts = evaluateTStemCurve(side, metrics, recipe, layout);
    const stemGeo = build3DLeatherStrap(stemPts);
    if (stemGeo) parts.push({ geometry: stemGeo, materialIndex: 0 });
  } else if (recipe.forefootStrap === 'v_thong') {
    const stemPts = evaluateTStemCurve(side, metrics, recipe, layout).slice(0, 7);
    const postGeo = build3DLeatherStrap(stemPts);
    if (postGeo) parts.push({ geometry: postGeo, materialIndex: 0 });

    const jct = stemPts[stemPts.length - 1].p;
    for (const dir of [-1, 1]) {
      const wing = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const z = lerp(jct.z, metrics.midfootZ - 0.025, t);
        const xNorm = lerp(-0.18, dir * 1.05, t);
        const s = sampleDorsumArchPoint(metrics, side, z, xNorm, layout, 0.0046);
        wing.push({
          p: t === 0 ? jct.clone() : s.p,
          n: s.n,
          halfW: 0.0072 * recipe.widthScale,
          thick,
          uv: s.uv,
        });
      }
      const wg = build3DLeatherStrap(wing);
      if (wg) parts.push({ geometry: wg, materialIndex: 0 });
    }
  } else if (recipe.forefootStrap === 'single_band') {
    const band = buildCurvedArchBand(side, metrics, metrics.ballZ + 0.004, 0.017 * recipe.widthScale, thick, layout, 0.006);
    if (band) parts.push({ geometry: band, materialIndex: 0 });
  } else if (recipe.forefootStrap === 'double_band') {
    const b1 = buildCurvedArchBand(side, metrics, metrics.ballZ + 0.006, 0.014 * recipe.widthScale, thick, layout, 0.005);
    const b2 = buildCurvedArchBand(side, metrics, metrics.midfootZ + 0.004, 0.015 * recipe.widthScale, thick, layout, 0.005);
    if (b1) parts.push({ geometry: b1, materialIndex: 0 });
    if (b2) parts.push({ geometry: b2, materialIndex: 0 });
  } else if (recipe.forefootStrap === 'criss_cross') {
    const c1 = buildCurvedArchBand(side, metrics, (metrics.ballZ + metrics.midfootZ) * 0.5, 0.013 * recipe.widthScale, thick, layout, 0.028, 0.0042);
    const c2 = buildCurvedArchBand(side, metrics, (metrics.ballZ + metrics.midfootZ) * 0.5, 0.013 * recipe.widthScale, thick, layout, -0.028, 0.0078);
    if (c1) parts.push({ geometry: c1, materialIndex: 0 });
    if (c2) parts.push({ geometry: c2, materialIndex: 0 });
  } else if (recipe.forefootStrap === 'multi_thin' || recipe.forefootStrap === 'caged') {
    for (const zPos of [metrics.ballZ + 0.022, metrics.ballZ - 0.005, metrics.midfootZ - 0.018]) {
      const band = buildCurvedArchBand(side, metrics, zPos, 0.0065 * recipe.widthScale, 0.0030, layout, 0.004);
      if (band) parts.push({ geometry: band, materialIndex: 0 });
    }
    if (recipe.forefootStrap === 'caged') {
      const spine = evaluateTStemCurve(side, metrics, recipe, layout).slice(5);
      const sg = build3DLeatherStrap(spine);
      if (sg) parts.push({ geometry: sg, materialIndex: 0 });
    }
  } else if (recipe.forefootStrap === 'toe_ring') {
    // 3D ring wrapping big toe (x around medial big toe), plus ball strap
    const bigToeX = side * (metrics.isMale ? 0.118 : 0.146);
    const bigToeZ = metrics.toeCleftZ - 0.006;
    const ringPts = [];
    for (let i = 0; i <= 14; i++) {
      const th = (i / 14) * Math.PI * 2;
      ringPts.push({
        p: new THREE.Vector3(bigToeX + Math.sin(th) * 0.013, 0.011 + Math.cos(th) * 0.013, bigToeZ),
        n: new THREE.Vector3(Math.sin(th), Math.cos(th), 0).normalize(),
        halfW: 0.0045,
        thick: 0.0028,
        uv: sandalStrapUV(side, metrics, -0.5, bigToeZ, layout),
      });
    }
    const rg = build3DLeatherStrap(ringPts);
    if (rg) parts.push({ geometry: rg, materialIndex: 0 });
    const band = buildCurvedArchBand(side, metrics, metrics.midfootZ, 0.014 * recipe.widthScale, thick, layout, 0.012);
    if (band) parts.push({ geometry: band, materialIndex: 0 });
  }

  // 3. Instep Collar / Secondary Instep Strap Module (Group 0)
  if (recipe.instepStrap === 't_stem' || recipe.instepStrap === 'scalloped_v_collar' || recipe.instepStrap === 'ring_bridge') {
    const wings = evaluateInstepVCollarCurves(side, metrics, recipe, layout);
    wings.forEach((wingPts) => {
      const g = build3DLeatherStrap(wingPts);
      if (g) parts.push({ geometry: g, materialIndex: 0 });
    });

    if (recipe.hardware.includes('metal_ring')) {
      const zVamp = metrics.instepZ;
      const keeperZs = [zVamp + 0.016, zVamp + 0.068];
      keeperZs.forEach((kz) => {
        const kPts = [];
        for (let i = 0; i <= 6; i++) {
          const u = (i / 6) * 2 - 1;
          const sl = evalFootSlice(metrics, side, kz);
          const xNorm = -0.08 + u * 0.24;
          const yFoot = evalFootDorsumSurface(metrics, kz, xNorm);
          kPts.push({
            p: new THREE.Vector3(sl.cx + side * xNorm * sl.hw, yFoot + 0.0076 + (1 - u * u) * 0.0028, kz),
            n: new THREE.Vector3(0, 0.96, 0.28).normalize(),
            halfW: 0.0052,
            thick: 0.0026,
            uv: sandalStrapUV(side, metrics, xNorm, kz, layout),
          });
        }
        const kg = build3DLeatherStrap(kPts);
        if (kg) parts.push({ geometry: kg, materialIndex: 0 });
      });
    }
  } else if (recipe.instepStrap === 'criss_cross' && recipe.forefootStrap !== 'criss_cross') {
    const c1 = buildCurvedArchBand(side, metrics, metrics.instepZ + 0.01, 0.011 * recipe.widthScale, thick, layout, 0.022, 0.0045);
    const c2 = buildCurvedArchBand(side, metrics, metrics.instepZ + 0.01, 0.011 * recipe.widthScale, thick, layout, -0.022, 0.0078);
    if (c1) parts.push({ geometry: c1, materialIndex: 0 });
    if (c2) parts.push({ geometry: c2, materialIndex: 0 });
  }

  // 4. Back / Heel / Ankle Module (Open-top horizontal wrap — ZERO ankle beak!)
  if (recipe.backStyle === 'open_heel_cup' || recipe.backStyle === 'closed_heel_counter') {
    const isTall = recipe.backStyle === 'closed_heel_counter';
    parts.push(...buildHorizontalPosteriorWrap(side, metrics, {
      yLowBottom: -0.0055,
      yBackTop: isTall ? 0.064 : 0.056,
      yFrontTip: isTall ? 0.044 : 0.036,
      angSpanRad: 0.62 * Math.PI,
      thickness: 0.0030,
      zReachScale: 1.0,
      standalone,
    }, layout));
    if (isTall || recipe.hardware.includes('ankle_buckle')) {
      const aWrap = buildHorizontalAnkleWrap(side, metrics, 0.095, 0.0075 * recipe.widthScale, 0.0030, layout);
      if (aWrap) parts.push({ geometry: aWrap, materialIndex: 0 });
    }
  } else if (recipe.backStyle === 'ankle_strap') {
    parts.push(...buildHorizontalPosteriorWrap(side, metrics, {
      yLowBottom: -0.0055,
      yBackTop: 0.058,
      yFrontTip: 0.032,
      angSpanRad: 0.56 * Math.PI,
      thickness: 0.0028,
      zReachScale: 0.96,
      standalone,
    }, layout));
    // Vertical rear heel spine connecting heel counter smoothly up to ankle wrap
    const spinePts = [];
    for (let i = 0; i <= 7; i++) {
      const t = i / 7;
      const y = lerp(0.050, 0.098, t);
      const r = evalAnkleRing(metrics, side, y);
      spinePts.push({
        p: new THREE.Vector3(r.cx, y, r.zBack - 0.0042),
        n: new THREE.Vector3(0, 0, -1),
        halfW: 0.0085,
        thick: 0.0030,
        uv: sandalStrapUV(side, metrics, 0, r.zBack, layout, { heelWall: true }),
      });
    }
    const spGeo = build3DLeatherStrap(spinePts);
    if (spGeo) parts.push({ geometry: spGeo, materialIndex: 0 });
    const aWrap = buildHorizontalAnkleWrap(side, metrics, 0.096, 0.0072 * recipe.widthScale, 0.0032, layout);
    if (aWrap) parts.push({ geometry: aWrap, materialIndex: 0 });
  } else if (recipe.backStyle === 'slingback') {
    parts.push(...buildHorizontalPosteriorWrap(side, metrics, {
      yLowBottom: 0.042,
      yBackTop: 0.058,
      yFrontTip: 0.034,
      angSpanRad: 0.65 * Math.PI,
      thickness: 0.0030,
      zReachScale: 1.08,
      standalone,
    }, layout));
  } else if (recipe.backStyle === 'lace_up_calf') {
    parts.push(...buildHorizontalPosteriorWrap(side, metrics, {
      yLowBottom: -0.0055,
      yBackTop: 0.058,
      yFrontTip: 0.034,
      angSpanRad: 0.58 * Math.PI,
      thickness: 0.0028,
      zReachScale: 0.98,
      standalone,
    }, layout));
    for (const yLace of [0.092, 0.128, 0.164]) {
      const lace = buildHorizontalAnkleWrap(side, metrics, yLace, 0.0042, 0.0026, layout);
      if (lace) parts.push({ geometry: lace, materialIndex: 0 });
    }
  }

  return parts;
}

/**
 * Appends a small 3D metallic dome stud at `(cx, cy, cz)`.
 */
function appendDomeStud(cx, cy, cz, r, verts, indices) {
  const nLat = 4;
  const nLon = 8;
  const base = verts.length / 3;
  for (let i = 0; i <= nLat; i++) {
    const theta = (i / nLat) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let j = 0; j <= nLon; j++) {
      const phi = (j / nLon) * Math.PI * 2;
      verts.push(cx + r * st * Math.cos(phi), cy + r * ct, cz + r * st * Math.sin(phi));
    }
  }
  const stride = nLon + 1;
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      appendQuad(indices, base + i * stride + j, base + i * stride + j + 1, base + (i + 1) * stride + j, base + (i + 1) * stride + j + 1);
    }
  }
}

/**
 * Appends a contoured 3D oval metallic ring flush atop the evaluated dorsal T-stem.
 */
function appendHardwareRing(side, metrics, zCenter, rx, rz, tubeR, verts, indices) {
  const nMajor = 24;
  const nMinor = 10;
  const base = verts.length / 3;
  for (let i = 0; i <= nMajor; i++) {
    const th = (i / nMajor) * Math.PI * 2;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    const z = zCenter + rz * st;
    const sl = evalFootSlice(metrics, side, z);
    const xCenter = sl.cx + side * -0.08 * sl.hw;
    const xRing = xCenter + rx * ct;
    const yDorsum = evalFootDorsumSurface(metrics, z, -0.08);
    const yRing = yDorsum + 0.0080 + tubeR * 1.15;

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
      appendQuad(indices, base + i * nMinor + j, base + i * nMinor + jn, base + (i + 1) * nMinor + j, base + (i + 1) * nMinor + jn);
    }
  }
}

/**
 * Appends the center metallic connecting link bar & beads between two stacked rings.
 */
function appendHardwareLink(side, metrics, zJoin, halfW, tubeR, verts, indices) {
  const nx = 10;
  const nPhi = 10;
  const sl = evalFootSlice(metrics, side, zJoin);
  const cx = sl.cx + side * -0.08 * sl.hw;
  const yBase = evalFootDorsumSurface(metrics, zJoin, -0.08) + 0.0082 + tubeR * 1.25;
  const base = verts.length / 3;

  for (let i = 0; i <= nx; i++) {
    const u = (i / nx) * 2 - 1;
    const x = cx + u * halfW;
    const r = tubeR * (1 + 0.3 * Math.exp(-u * u * 10));
    for (let j = 0; j < nPhi; j++) {
      const phi = (j / nPhi) * Math.PI * 2;
      verts.push(x, yBase + r * Math.sin(phi), zJoin + r * Math.cos(phi));
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nPhi; j++) {
      const jn = (j + 1) % nPhi;
      appendQuad(indices, base + i * nPhi + j, base + i * nPhi + jn, base + (i + 1) * nPhi + j, base + (i + 1) * nPhi + jn);
    }
  }
  appendDomeStud(cx, yBase + 0.0006, zJoin, tubeR * 1.85, verts, indices);
}

/**
 * Appends a crisp 3D rectangular strap buckle at position `(cx, cy, cz)` oriented laterally.
 */
function appendRectangularBuckle(cx, cy, cz, side, halfZ, halfY, tubeR, verts, indices) {
  const corners = [
    [cx + side * tubeR, cy + halfY, cz - halfZ],
    [cx + side * tubeR, cy + halfY, cz + halfZ],
    [cx + side * tubeR, cy - halfY, cz + halfZ],
    [cx + side * tubeR, cy - halfY, cz - halfZ],
  ];
  for (let e = 0; e < 4; e++) {
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    const nSeg = 4;
    const nPhi = 6;
    const base = verts.length / 3;
    const T = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const N = new THREE.Vector3(side, 0, 0);
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    for (let i = 0; i <= nSeg; i++) {
      const t = i / nSeg;
      const px = lerp(a[0], b[0], t);
      const py = lerp(a[1], b[1], t);
      const pz = lerp(a[2], b[2], t);
      for (let j = 0; j < nPhi; j++) {
        const phi = (j / nPhi) * Math.PI * 2;
        verts.push(
          px + tubeR * (Math.cos(phi) * N.x + Math.sin(phi) * B.x),
          py + tubeR * (Math.cos(phi) * N.y + Math.sin(phi) * B.y),
          pz + tubeR * (Math.cos(phi) * N.z + Math.sin(phi) * B.z)
        );
      }
    }
    for (let i = 0; i < nSeg; i++) {
      for (let j = 0; j < nPhi; j++) {
        const jn = (j + 1) % nPhi;
        appendQuad(indices, base + i * nPhi + j, base + i * nPhi + jn, base + (i + 1) * nPhi + j, base + (i + 1) * nPhi + jn);
      }
    }
  }
}

/**
 * Builds modular metallic hardware (rings, micro-studs, buckles) strictly when
 * signaled by `resolveSandalRecipe`. Returns `null` for plain/minimalist sandals.
 */
export function buildModularSandalHardware({ isMale = false, spec = {}, layout = null } = {}) {
  if (!spec || spec.kind !== 'sandal') return null;
  const recipe = resolveSandalRecipe(spec, layout);
  if (!recipe.hardware.length) return null;

  const metrics = getSandalFootMetrics(isMale);
  const verts = [];
  const indices = [];

  for (const side of [-1, 1]) {
    if (recipe.hardware.includes('metal_ring')) {
      const zVamp = metrics.instepZ;
      const zUpper = zVamp + 0.022;
      const zLower = zVamp + 0.056;
      const zJoin = 0.5 * ((zUpper + 0.010) + (zLower - 0.014));
      appendHardwareRing(side, metrics, zLower, 0.0135, 0.0155, 0.0025, verts, indices);
      appendHardwareRing(side, metrics, zUpper, 0.0095, 0.0105, 0.0023, verts, indices);
      appendHardwareLink(side, metrics, zJoin, 0.0090, 0.0023, verts, indices);
    }

    if (recipe.hardware.includes('micro_studs')) {
      const stemPts = evaluateTStemCurve(side, metrics, recipe, layout);
      for (let i = 6; i < stemPts.length; i += 2) {
        const pt = stemPts[i];
        const cx = pt.p.x + pt.n.x * (pt.thick + 0.0005);
        const cy = pt.p.y + pt.n.y * (pt.thick + 0.0005);
        const cz = pt.p.z + pt.n.z * (pt.thick + 0.0005);
        const edgeOffset = Math.min(0.0032, pt.halfW * 0.55);
        appendDomeStud(cx - edgeOffset, cy, cz, 0.0014, verts, indices);
        appendDomeStud(cx + edgeOffset, cy, cz, 0.0014, verts, indices);
      }
      if (recipe.instepStrap === 'scalloped_v_collar' || recipe.instepStrap === 't_stem') {
        const wings = evaluateInstepVCollarCurves(side, metrics, recipe, layout);
        wings.forEach((wingPts) => {
          for (let i = 2; i < wingPts.length - 1; i += 2) {
            const pt = wingPts[i];
            appendDomeStud(
              pt.p.x + pt.n.x * (pt.thick + 0.0005),
              pt.p.y + pt.n.y * (pt.thick + 0.0005),
              pt.p.z + pt.n.z * (pt.thick + 0.0005),
              0.0014,
              verts,
              indices
            );
          }
        });
      }
    }

    if (recipe.hardware.includes('ankle_buckle')) {
      const ring = evalAnkleRing(metrics, side, 0.096);
      const bx = ring.cx + side * (ring.rx + 0.0092);
      appendRectangularBuckle(bx, 0.096, ring.cz, side, 0.0075, 0.0090, 0.0018, verts, indices);
    }

    if (recipe.hardware.includes('buckle')) {
      const targets = recipe.forefootStrap === 'double_band'
        ? [metrics.ballZ + 0.006, metrics.midfootZ + 0.004]
        : [metrics.ballZ + 0.006];
      targets.forEach((tz) => {
        const pt = sampleDorsumArchPoint(metrics, side, tz, 0.78, layout, 0.0046);
        // Align rectangular buckle flush along strap surface normal
        const cxB = pt.p.x + pt.n.x * 0.0042;
        const cyB = pt.p.y + pt.n.y * 0.0042;
        appendRectangularBuckle(cxB, cyB, pt.p.z, side, 0.0080, 0.0050, 0.0016, verts, indices);
      });
    }
  }

  if (verts.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
