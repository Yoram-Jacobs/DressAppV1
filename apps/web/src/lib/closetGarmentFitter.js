/**
 * Hybrid Closet-to-Avatar Garment Fitting Engine (`closetGarmentFitter.js`)
 *
 * Ports and unifies the anatomical fitting techniques from
 * `scripts/fit_onboarding_garments_to_avatar.py` so ANY closet item curated into
 * an avatar outfit (in AI Stylist, Closet Try-On, Outfit Canvas, Daily Outfit,
 * Suitcase, Style Sandbox, or Onboarding) is fitted to the Default Avatar's
 * `200 x 450` SVG anatomy and dynamically warped to the user's live avatar
 * proportions via 56 horizontal anatomical slices + a triangulated Point-Cloud Mesh.
 *
 * Hybrid Two-Tier Strategy:
 *   - Tier 1 (Real-Photo Alpha-Contour Warping):
 *     When a closet item has a clean, segmented front-facing cutout photo, scans
 *     its per-row alpha contour `[uMin(v), uMax(v)]`, maps its vertical span to
 *     the exact Default Avatar anatomical landmarks (`yChin - 0.6` collar line,
 *     `yShoulders`, `yChest`, `yWaist`, `yHip`, `yCrotch`, `yKnees`, `yAnkles`,
 *     `yFeet`), smoothly aligns each horizontal slice to the avatar's body contour
 *     while preserving natural skirt/robe flare, and builds its 2D Point-Cloud Mesh.
 *   - Tier 2 (Cubic-Bezier Silhouette + Real Fabric Texture Reconstruction):
 *     When a closet item photo is unsegmented (full rectangular background),
 *     heavily asymmetrical/folded, or unavailable due to CORS/network, reconstructs
 *     the garment onto the exact Cubic-Bezier avatar templates (`buildSmoothTorsoAndSleevesPath`,
 *     `buildSmoothTrousersPath`, `buildSmoothSkirtPath`, `buildSmoothShoesPath`)
 *     using its extracted central fabric texture patch, catalog colors, pattern,
 *     and 3D cylindrical shading.
 */

import { getDefaultAvatarAnatomy } from '@/components/DynamicAvatar';

const SVG_W = 200;
const SVG_H = 450;
const SCALE = 2; // 400 x 900 supersampled Default Avatar canvas
const CANVAS_W = SVG_W * SCALE;
const CANVAS_H = SVG_H * SCALE;

// Cache of fitted closet garment results keyed by `${sex}::${id || url}::${category}::${color}`
const fittedClosetGarmentCache = new Map();

const NAMED_COLOR_HEX = {
  black: '#1F2026',
  charcoal: '#2F343D',
  slate: '#4E5869',
  grey: '#7C828D',
  gray: '#7C828D',
  silver: '#C0C5CE',
  white: '#F4F3EF',
  ivory: '#F5F1E6',
  cream: '#EDE5D2',
  off_white: '#F2EFE9',
  beige: '#D5C3AA',
  tan: '#C4A482',
  camel: '#BC9162',
  khaki: '#BDB094',
  taupe: '#9B8B7A',
  brown: '#5C3E2B',
  chocolate: '#3F271B',
  espresso: '#2E1D14',
  cognac: '#8F4B2A',
  navy: '#1E2D4A',
  blue: '#345E96',
  light_blue: '#98B9E2',
  sky_blue: '#7DB0DE',
  cobalt: '#2048A8',
  indigo: '#283B63',
  denim: '#3B587E',
  teal: '#1F6368',
  turquoise: '#3AA8A8',
  emerald: '#145F37',
  green: '#2A6B47',
  olive: '#5A6338',
  sage: '#8FA189',
  mint: '#9ED2BE',
  red: '#9E2629',
  crimson: '#8C1D24',
  burgundy: '#5F1A27',
  maroon: '#5A1B24',
  wine: '#581826',
  coral: '#D96B56',
  rust: '#9C4328',
  terracotta: '#B55338',
  orange: '#CF6A2D',
  peach: '#EBCFB2',
  pink: '#D88A9E',
  blush: '#E4B7C0',
  rose: '#C4687B',
  magenta: '#A62B69',
  purple: '#5B3773',
  plum: '#4F284B',
  lavender: '#B29EC9',
  lilac: '#C3B1D8',
  yellow: '#D9B44A',
  mustard: '#C4932B',
  gold: '#D4AF37',
};

export function resolveGarmentHexColor(garment = {}) {
  if (typeof garment.hex_color === 'string' && /^#[0-9a-f]{6}$/i.test(garment.hex_color.trim())) {
    return garment.hex_color.trim();
  }
  const candidates = [];
  if (typeof garment.color === 'string') candidates.push(garment.color);
  if (Array.isArray(garment.colors)) {
    garment.colors.forEach((c) => {
      if (typeof c === 'string') candidates.push(c);
      else if (c && typeof c.hex === 'string') candidates.push(c.hex);
      else if (c && typeof c.name === 'string') candidates.push(c.name);
    });
  }
  if (typeof garment.name === 'string') candidates.push(garment.name);
  if (typeof garment.title === 'string') candidates.push(garment.title);

  for (const raw of candidates) {
    const s = String(raw || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    const norm = s.toLowerCase().replace(/[\s-]+/g, '_');
    if (NAMED_COLOR_HEX[norm]) return NAMED_COLOR_HEX[norm];
    for (const [key, hex] of Object.entries(NAMED_COLOR_HEX)) {
      if (norm.includes(key)) return hex;
    }
  }
  return '#334155';
}

export function hexToRgb(hexStr) {
  const h = String(hexStr || '#334155').replace('#', '').trim();
  if (h.length !== 6) return [72, 82, 98];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [72, 82, 98];
  return [r, g, b];
}

function adjustRgb(rgb, factor) {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * factor))),
  ];
}

function rgbCss(rgb, alpha = 1) {
  return alpha >= 1
    ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
    : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Evaluates a Cubic Bezier curve at `steps + 1` points from `t = 0` to `t = 1`.
 */
export function evalCubicBezier(p0, p1, p2, p3, steps = 20) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x =
      u * u * u * p0[0] +
      3 * u * u * t * p1[0] +
      3 * u * t * t * p2[0] +
      t * t * t * p3[0];
    const y =
      u * u * u * p0[1] +
      3 * u * u * t * p1[1] +
      3 * u * t * t * p2[1] +
      t * t * t * p3[1];
    pts.push([x, y]);
  }
  return pts;
}

/**
 * Mirrors `compute_avatar_geometry` in `scripts/fit_onboarding_garments_to_avatar.py`.
 */
export function getDefaultAvatarFitterGeometry(sex = 'female', customAnatomy = null) {
  const a = customAnatomy || getDefaultAvatarAnatomy(sex);
  const isMale = Boolean(a.isMale ?? String(sex).toLowerCase() === 'male');
  const defaultCenterX = Number.isFinite(a.X0) ? a.X0 : 100;
  const wSh = a.wShoulders || (isMale ? 44.0 : 37.62);
  return {
    ...a,
    x0: defaultCenterX,
    isMale,
    neckHeight: (a.yShoulders || 116) - (a.yChin || 100),
    wElbowOut: Number.isFinite(a.wElbowOut) ? a.wElbowOut : wSh + (isMale ? 13.0 : 11.4),
    wElbowIn: Number.isFinite(a.wElbowIn) ? a.wElbowIn : wSh - (isMale ? 7.8 : 7.4),
    wWristOut: Number.isFinite(a.wWristOut) ? a.wWristOut : wSh + (isMale ? 17.0 : 18.4),
    wWristIn: Number.isFinite(a.wWristIn) ? a.wWristIn : wSh + (isMale ? 6.2 : 9.6),
    armThickUpper: isMale ? 9.0 : 7.8,
    armThickElbow: isMale ? 8.2 : 7.0,
    armThickWrist: isMale ? 5.4 : 4.4,
    centerXAtY:
      typeof a.centerXAtY === 'function'
        ? a.centerXAtY
        : () => defaultCenterX,
  };
}

/**
 * Computes style-dependent rise position (`yTop0` between `g.yWaist` upper limit
 * and `g.yHip` lower limit), pelvis width interpolation, and the absolute
 * crotch ("crunch") barrier (`yCrotchTarget >= g.yCrotch`) for any bottom/pants item.
 */
export function getBottomRiseAndCrotchMetrics(garment = {}, g) {
  const text = `${garment.name || ''} ${garment.title || ''} ${garment.sub_category || ''} ${garment.item_type || ''} ${garment.category || ''}`.toLowerCase();

  const isSkirt = /\b(skirt|?????|?????|falda|jupe)\b/i.test(text);
  const isBriefOrBikini = /\b(bikini|brief|thong|swim_brief|???????|??????)\b/i.test(text);
  const isShort = /\b(short|trunk|boxer|bermuda|????|?????|??????)\b/i.test(text);
  const isLoose = /\b(wide|loose|palazzo|relaxed|baggy|jogger|sweatpant|cargo|?????|??????|???)\b/i.test(text);

  // Determine style riseRatio in [0.0 (waist upper limit) .. 1.0 (hip lower limit)]
  let riseStyle = 'mid_rise';
  let riseRatio = 0.35;

  if (
    /\b(low[-_\s]*rise|hipster|hip[-_\s]*hugger|???? ?????)\b/i.test(text) ||
    isBriefOrBikini
  ) {
    riseStyle = 'low_rise';
    riseRatio = isBriefOrBikini ? 0.92 : 0.85;
  } else if (
    /\b(high[-_\s]*rise|high[-_\s]*waist|tailored|pleat|dress\s*pants|dress\s*trousers|formal|palazzo|wide[-_\s]*leg|culotte|???? ?????|??????|?????)\b/i.test(
      text
    ) ||
    isSkirt
  ) {
    riseStyle = 'high_rise';
    riseRatio = 0.0;
  } else if (
    /\b(jogger|sweatpant|track|cargo|relaxed|baggy|trunk|boxer|??????|????|????? ??)\b/i.test(
      text
    )
  ) {
    riseStyle = 'relaxed_rise';
    riseRatio = 0.62;
  } else {
    // Classic jeans, chinos, straight/slim trousers, leggings, capris
    riseStyle = 'mid_rise';
    riseRatio = 0.35;
  }

  // Clamp yTop0 strictly between g.yWaist (upper limit) and g.yHip (lower limit)
  const rawYTop = g.yWaist + riseRatio * (g.yHip - g.yWaist);
  const yTop0 = Math.max(g.yWaist, Math.min(g.yHip, rawYTop));

  // Absolute Crunch (Crotch) Barrier: pants crunch point can NEVER be higher than avatar's g.yCrotch
  const dropCrotchExtra = isLoose ? 3.2 : 1.0;
  const yCrotchTarget = Math.max(g.yCrotch, g.yCrotch + dropCrotchExtra);

  // Avatar pelvis half-width at any y in [g.yWaist, g.yHip] using smooth cubic Hermite S-curve
  const avatarPelvisHalfWidthAtY = (y) => {
    const t = Math.max(0, Math.min(1, (y - g.yWaist) / Math.max(1, g.yHip - g.yWaist)));
    const s = t * t * (3 - 2 * t);
    return g.wWaist + (g.wHip - g.wWaist) * s;
  };

  return {
    riseStyle,
    riseRatio,
    yTop0,
    yCrotchTarget,
    isSkirt,
    isBriefOrBikini,
    isShort,
    isLoose,
    avatarPelvisHalfWidthAtY,
  };
}

/**
 * Computes the target vertical span `[yTop0, yBot0]`, per-Y anatomical half-width
 * `halfWidthAtY(y)`, and horizontal spine center `centerXAtY(y)` for any closet
 * garment slot & subtype on either the Default Avatar (`customAnatomy = null`)
 * or a Full-Body Photo / Live Avatar (`customAnatomy = photoAnatomy`).
 */
export function getGarmentAnatomicalEnvelope(
  garment = {},
  roleKey = 'top',
  sex = 'female',
  customAnatomy = null
) {
  const g = getDefaultAvatarFitterGeometry(sex, customAnatomy);
  const text = `${garment.name || ''} ${garment.title || ''} ${garment.sub_category || ''} ${garment.item_type || ''} ${garment.category || ''}`.toLowerCase();
  const isStrapless = /\b(strapless|tube\s*top|tube\s*dress|bandeau|off[\s-_]*shoulder|??????|????)\b/i.test(text);

  let yTop0 = g.yChin - 0.6;
  let yBot0 = g.yHip + 3.0;
  let flareExtra = 0;
  let easeMult = 1.04;
  let bottomMetrics = null;

  if (roleKey === 'dress' || roleKey === 'full_body') {
    yTop0 = isStrapless ? g.yChest - 7.5 : g.yChin - 0.6;
    if (/\b(one_piece|swimsuit|monokini|bodysuit|??? ?? ???)\b/i.test(text)) {
      yBot0 = g.yCrotch + 3.0;
      easeMult = 1.01;
    } else if (/\b(mini|short\s+dress|???? ????|???? ????)\b/i.test(text)) {
      yBot0 = g.yCrotch + (g.yKnees - g.yCrotch) * 0.55;
      flareExtra = 4.0;
    } else if (/\b(maxi|gown|abaya|kaftan|caftan|jalabiya|galabiya|thobe|kandura|saree|sari|jumpsuit|suit|????|?????|????|??????|??????)\b/i.test(text)) {
      yBot0 = g.yAnkles + 3.0;
      flareExtra = /\b(abaya|kaftan|caftan|jalabiya|galabiya|gown|saree)\b/i.test(text) ? 14.5 : 5.0;
    } else {
      yBot0 = g.yKnees + 6.0;
      flareExtra = 3.5;
    }
  } else if (roleKey === 'outerwear') {
    yTop0 = g.yChin - 0.6;
    easeMult = 1.09;
    if (/\b(crop|bolero|shrug|????|??????? ????)\b/i.test(text)) {
      yBot0 = g.yWaist + 4.0;
    } else if (/\b(trench|overcoat|duster|cardigan|achkan|sherwani|long\s+coat|maxi\s+coat|???? ????|????)\b/i.test(text)) {
      yBot0 = g.yKnees + 14.0;
      flareExtra = 6.5;
    } else {
      yBot0 = g.yHip + 9.0;
      flareExtra = 3.0;
    }
  } else if (roleKey === 'bottom') {
    bottomMetrics = getBottomRiseAndCrotchMetrics(garment, g);
    yTop0 = bottomMetrics.yTop0;
    easeMult = 1.0;

    if (bottomMetrics.isBriefOrBikini) {
      yBot0 = bottomMetrics.yCrotchTarget + 1.5;
    } else if (/\b(mini_skirt|mini\s+skirt|????? ????)\b/i.test(text)) {
      yBot0 = g.yCrotch + (g.yKnees - g.yCrotch) * 0.45;
      flareExtra = 6.0;
    } else if (bottomMetrics.isShort) {
      yBot0 = /\b(bermuda|??????|knee)\b/i.test(text)
        ? g.yKnees - 2.0
        : bottomMetrics.yCrotchTarget + (g.yKnees - bottomMetrics.yCrotchTarget) * 0.48;
      flareExtra = 2.0;
    } else if (bottomMetrics.isSkirt) {
      const isMaxi = /\b(maxi|long|????|?????)\b/i.test(text);
      yBot0 = isMaxi ? g.yAnkles + 1.0 : g.yKnees + 22.0;
      flareExtra = /\b(pleat|a-line|a_line|flared|?????)\b/i.test(text) ? 13.0 : 8.0;
    } else if (/\b(capri|cropped|culotte|3\/4|????)\b/i.test(text)) {
      yBot0 = g.yKnees + 18.0;
      flareExtra = 2.5;
    } else {
      yBot0 = g.yAnkles + 2.0;
      flareExtra = bottomMetrics.isLoose ? 5.5 : 1.5;
    }
  } else if (roleKey === 'shoes') {
    const isBoot = /\b(boot|chelsea|ankle\s*boot|??????|????|???????|???)\b/i.test(text);
    yTop0 = g.yAnkles - (isBoot ? 6.5 : 2.5);
    yBot0 = g.yFeet + 2.8;
  } else {
    // 'top'
    yTop0 = isStrapless ? g.yChest - 7.5 : g.yChin - 0.6;
    if (/\b(crop|bralette|sports_bra|bikini_top|????|????? ???|?????)\b/i.test(text)) {
      yBot0 = g.yWaist - 2.0;
    } else if (/\b(tunic|kurta|longline|kaftan|galabiya|??????|?????)\b/i.test(text)) {
      yBot0 = g.yCrotch + 26.0;
      flareExtra = 4.5;
    } else {
      yBot0 = g.yHip + 3.0;
      flareExtra = 2.0;
    }
  }

  /**
   * Evaluates the target anatomical half-width at any SVG `y` coordinate in `[yTop0, yBot0]`.
   */
  const halfWidthAtY = (y) => {
    if (roleKey === 'shoes') {
      const t = Math.max(0, Math.min(1, (y - yTop0) / Math.max(1, yBot0 - yTop0)));
      return (g.wOuterAnkle + 1.8) * (1 - t) + (g.wFootTip + 2.2) * t;
    }

    if (roleKey === 'bottom' && bottomMetrics) {
      // 1. Waist-to-Hip Pelvis Zone [g.yWaist .. g.yHip]:
      //    Map the pants top hem and upper pelvis directly to the avatar's exact body width at `y`
      //    (e.g., if top hem is at yWaist, width fits avatar's wWaist; if at yHip, fits wHip).
      if (y <= g.yHip) {
        const pelvisHalfW = bottomMetrics.avatarPelvisHalfWidthAtY(y);
        const t = Math.max(0, Math.min(1, (y - g.yWaist) / Math.max(1, g.yHip - g.yWaist)));
        const ease = 0.35 + 0.55 * t;
        return pelvisHalfW + ease;
      }
      // 2. Skirt flare below hip
      if (bottomMetrics.isSkirt) {
        const t = Math.max(0, Math.min(1, (y - g.yHip) / Math.max(1, yBot0 - g.yHip)));
        const w0 = g.wHip + 1.4;
        const legOuterAtHem = yBot0 > g.yKnees + 25 ? g.wOuterAnkle : Math.max(g.wOuterKnee, 44.2);
        const wEnd = Math.max(g.wHip + flareExtra, legOuterAtHem + Math.max(3.5, flareExtra * 0.45));
        return w0 + (wEnd - w0) * t;
      }
      // 3. Pants / Jeans / Shorts below hip: follow avatar's outer thigh -> knee -> calf -> ankle
      const wHipOut = g.wHip + (bottomMetrics.isLoose ? 3.2 : 1.6);
      const wKneeOut = g.wOuterKnee + (bottomMetrics.isLoose ? 5.5 : 2.2);
      const wCalfOut = Math.max(wKneeOut, 44.2) + (bottomMetrics.isLoose ? 4.2 : 2.2);
      const wAnkleOut = g.wOuterAnkle + (bottomMetrics.isLoose ? 5.5 : 2.0);
      if (y <= g.yKnees) {
        const t = Math.max(0, Math.min(1, (y - g.yHip) / Math.max(1, g.yKnees - g.yHip)));
        return wHipOut + (wKneeOut - wHipOut) * t;
      }
      const t = Math.max(0, Math.min(1, (y - g.yKnees) / Math.max(1, g.yAnkles - g.yKnees)));
      // Smoothly bow out over the 3D calf (~35% down from knee to ankle) before tapering to ankle
      const calfBump = Math.sin(t * Math.PI) * Math.max(0, wCalfOut - (wKneeOut * (1 - t) + wAnkleOut * t));
      return wKneeOut + (wAnkleOut - wKneeOut) * t + calfBump;
    }

    if (y <= g.yShoulders) {
      const t = Math.max(0, Math.min(1, (y - (g.yChin - 0.6)) / Math.max(1, g.yShoulders - (g.yChin - 0.6))));
      const wCollar = Math.max(6.0, g.wNeck - 0.5);
      const wSh = g.wShoulders * easeMult + 2.0;
      const smoothT = 1 - Math.pow(1 - t, 1.85);
      return wCollar + (wSh - wCollar) * smoothT;
    }
    if (y <= g.yChest) {
      const t = (y - g.yShoulders) / Math.max(1, g.yChest - g.yShoulders);
      const w0 = g.wShoulders * easeMult + 2.0;
      const w1 = (g.wChest + 3.2) * easeMult;
      return w0 + (w1 - w0) * t;
    }
    if (y <= g.yWaist) {
      const t = (y - g.yChest) / Math.max(1, g.yWaist - g.yChest);
      const w0 = (g.wChest + 3.2) * easeMult;
      const w1 = (flareExtra >= 10 ? Math.max(g.wWaist + 5.5, g.wChest * 0.94) : g.wWaist + 2.2) * easeMult;
      return w0 + (w1 - w0) * t;
    }
    if (y <= g.yHip) {
      const t = (y - g.yWaist) / Math.max(1, g.yHip - g.yWaist);
      const w0 = (flareExtra >= 10 ? Math.max(g.wWaist + 5.5, g.wChest * 0.94) : g.wWaist + 2.2) * easeMult;
      const w1 = (g.wHip + 2.6 + flareExtra * 0.35) * easeMult;
      return w0 + (w1 - w0) * t;
    }
    // Below hip down to knees/ankles for dresses/outerwear/long tops
    const t = Math.max(0, Math.min(1, (y - g.yHip) / Math.max(1, yBot0 - g.yHip)));
    const w0 = (g.wHip + 2.6 + flareExtra * 0.35) * easeMult;
    const legOuterAtHem = yBot0 > g.yKnees + 20 ? g.wOuterAnkle : g.wOuterKnee;
    const wEnd = Math.max(g.wHip + flareExtra, legOuterAtHem + flareExtra);
    return w0 + (wEnd - w0) * t;
  };

  /**
   * Evaluates the inner-leg half-width (distance from centerline `x0` to inner thigh/knee/ankle seam)
   * for pants/shorts below `yCrotchTarget` so trouser legs cover the avatar's inner leg contour.
   */
  const innerLegHalfWidthAtY = (y) => {
    const yCr = bottomMetrics ? bottomMetrics.yCrotchTarget : g.yCrotch + 1.0;
    if (y <= yCr) return 0;
    const isLoose = Boolean(bottomMetrics?.isLoose);
    const wInKn = Math.max(2.2, g.wInnerKnee - (isLoose ? 2.8 : 1.5));
    const wInAn = Math.max(2.2, g.wInnerAnkle - (isLoose ? 2.4 : 1.2));
    if (y <= g.yKnees) {
      const t = Math.max(0, Math.min(1, (y - yCr) / Math.max(1, g.yKnees - yCr)));
      // Smoothly open from 0 at crotch to wInKn at knee
      return wInKn * Math.pow(t, 0.78);
    }
    const t = Math.max(0, Math.min(1, (y - g.yKnees) / Math.max(1, g.yAnkles - g.yKnees)));
    return wInKn + (wInAn - wInKn) * t;
  };

  const centerXAtY = (y) => g.centerXAtY(y);
  const spanAtY = (y) => {
    const cx = centerXAtY(y);
    const hw = halfWidthAtY(y);
    return { xLeft: cx - hw, xRight: cx + hw, centerX: cx, halfWidth: hw };
  };

  return {
    g,
    yTop0,
    yBot0,
    yCrotchTarget: bottomMetrics ? bottomMetrics.yCrotchTarget : g.yCrotch,
    riseStyle: bottomMetrics ? bottomMetrics.riseStyle : null,
    riseRatio: bottomMetrics ? bottomMetrics.riseRatio : null,
    bottomMetrics,
    flareExtra,
    easeMult,
    isStrapless,
    halfWidthAtY,
    innerLegHalfWidthAtY,
    centerXAtY,
    spanAtY,
  };
}

/**
 * Builds the 2D Point-Cloud Mesh (`rows x cols` vertices + triangulated wireframe)
 * from an alpha crop (`alphaData`, `cw`, `ch`) and `default_viewbox`, matching
 * `build_point_cloud_mesh` in `scripts/fit_onboarding_garments_to_avatar.py`.
 */
export function buildPointCloudMeshFromAlpha(alphaData, cw, ch, defaultViewbox, sex = 'female', roleKey = 'top') {
  const g = getDefaultAvatarFitterGeometry(sex);
  const vx = defaultViewbox.x;
  const vy = defaultViewbox.y;
  const vw = Math.max(1.0, defaultViewbox.width);
  const vh = Math.max(1.0, defaultViewbox.height);

  const rows = roleKey === 'shoes' ? 4 : 8;
  const cols = 5;
  const vertices = [];
  const gridIdx = new Map();

  const classifyZone = (svgY) => {
    if (svgY <= g.yShoulders + 6) return 'shoulders';
    if (svgY <= (g.yChest + g.yWaist) * 0.5) return 'chest';
    if (svgY <= (g.yWaist + g.yHip) * 0.5) return 'waist';
    if (svgY <= g.yCrotch + 10) return 'hip';
    if (svgY <= g.yKnees + 15) return 'knee';
    if (svgY <= g.yAnkles + 6) return 'ankle';
    return 'feet';
  };

  let minOpaqueY = -1;
  let maxOpaqueY = -1;
  if (alphaData && cw > 1 && ch > 1) {
    for (let y = 0; y < ch; y++) {
      const rowOff = y * cw;
      for (let x = 0; x < cw; x++) {
        if (alphaData[rowOff + x] > 25) {
          if (minOpaqueY === -1) minOpaqueY = y;
          maxOpaqueY = y;
          break;
        }
      }
    }
  }
  const pyStart = minOpaqueY !== -1 && maxOpaqueY > minOpaqueY + 2 ? minOpaqueY + 1 : 0;
  const pyEnd =
    minOpaqueY !== -1 && maxOpaqueY > minOpaqueY + 2
      ? Math.max(pyStart + 1, maxOpaqueY - 1)
      : Math.max(1, ch - 1);

  for (let r = 0; r < rows; r++) {
    const tRow = r / (rows - 1);
    const py = Math.min(ch - 1, Math.max(0, Math.round(pyStart + tRow * (pyEnd - pyStart))));
    const vNorm = ch > 1 ? py / (ch - 1) : tRow;
    const halfBand = r === 0 || r === rows - 1 ? 3 : Math.max(2, Math.floor(ch / 45));
    const bandY0 = Math.max(0, py - halfBand);
    const bandY1 = Math.min(ch, py + halfBand + 1);

    let minOpaqueX = -1;
    let maxOpaqueX = -1;
    if (alphaData && cw > 1 && ch > 1) {
      for (let x = 0; x < cw; x++) {
        let hit = false;
        for (let y = bandY0; y < bandY1; y++) {
          if (alphaData[y * cw + x] > 25) {
            hit = true;
            break;
          }
        }
        if (hit) {
          if (minOpaqueX === -1) minOpaqueX = x;
          maxOpaqueX = x;
        }
      }
    }

    const uMin = minOpaqueX !== -1 && maxOpaqueX > minOpaqueX ? minOpaqueX / Math.max(1, cw - 1) : 0.25;
    const uMax = minOpaqueX !== -1 && maxOpaqueX > minOpaqueX ? maxOpaqueX / Math.max(1, cw - 1) : 0.75;
    const svgY = vy + vNorm * vh;
    const zone = classifyZone(svgY);

    for (let c = 0; c < cols; c++) {
      const tCol = c / (cols - 1);
      const uNorm = uMin + tCol * (uMax - uMin);
      const svgX = vx + uNorm * vw;
      const idx = vertices.length;
      gridIdx.set(`${r},${c}`, idx);
      vertices.push({
        u: Number(uNorm.toFixed(4)),
        v: Number(vNorm.toFixed(4)),
        svg_x: Number(svgX.toFixed(2)),
        svg_y: Number(svgY.toFixed(2)),
        zone,
        is_edge: Boolean(c === 0 || c === cols - 1 || r === 0 || r === rows - 1),
        is_center: Boolean(c === Math.floor(cols / 2)),
      });
    }
  }

  const triangles = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i00 = gridIdx.get(`${r},${c}`);
      const i10 = gridIdx.get(`${r},${c + 1}`);
      const i01 = gridIdx.get(`${r + 1},${c}`);
      const i11 = gridIdx.get(`${r + 1},${c + 1}`);
      triangles.push([i00, i10, i11]);
      triangles.push([i00, i11, i01]);
    }
  }

  return {
    rows,
    cols,
    vertices,
    triangles,
  };
}

/**
 * Inspects a cropped garment image's alpha channel to determine whether it is a
 * clean segmented garment cutout suitable for Tier 1 Real-Photo Contour Warping
 * or whether it should fall back to Tier 2 Cubic-Bezier Silhouette Reconstruction.
 */
export function assessPhotoContourQuality(croppedAlpha, cropW, cropH, roleKey = 'top') {
  if (!croppedAlpha || cropW < 16 || cropH < 16) {
    return { canWarpPhoto: false, reason: 'too_small' };
  }

  let opaqueCount = 0;
  let borderOpaqueCount = 0;
  const totalPixels = cropW * cropH;
  const borderTotal = 2 * cropW + 2 * cropH;

  for (let y = 0; y < cropH; y++) {
    const rowOff = y * cropW;
    for (let x = 0; x < cropW; x++) {
      const a = croppedAlpha[rowOff + x];
      if (a > 25) {
        opaqueCount++;
        if (y === 0 || y === cropH - 1 || x === 0 || x === cropW - 1) {
          borderOpaqueCount++;
        }
      }
    }
  }

  const coverageRatio = opaqueCount / Math.max(1, totalPixels);
  const borderRatio = borderOpaqueCount / Math.max(1, borderTotal);

  // Unsegmented rectangular background photo (almost 100% opaque rectangle)
  if (coverageRatio > 0.95 && borderRatio > 0.92) {
    return { canWarpPhoto: false, reason: 'unsegmented_rectangle', coverageRatio };
  }

  if (coverageRatio < 0.08) {
    return { canWarpPhoto: false, reason: 'sparse_alpha', coverageRatio };
  }

  // Measure horizontal symmetry across 16 vertical slices
  const BANDS = 16;
  const leftU = new Float64Array(BANDS);
  const rightU = new Float64Array(BANDS);
  let validBands = 0;
  let centerDeviationSum = 0;

  for (let b = 0; b < BANDS; b++) {
    const y0 = Math.floor((b / BANDS) * cropH);
    const y1 = Math.max(y0 + 1, Math.floor(((b + 1) / BANDS) * cropH));
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < cropW; x++) {
      let hit = false;
      for (let y = y0; y < y1; y++) {
        if (croppedAlpha[y * cropW + x] > 25) {
          hit = true;
          break;
        }
      }
      if (hit) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX !== -1 && maxX > minX + 2) {
      const u0 = minX / Math.max(1, cropW - 1);
      const u1 = maxX / Math.max(1, cropW - 1);
      leftU[b] = u0;
      rightU[b] = u1;
      const mid = 0.5 * (u0 + u1);
      centerDeviationSum += Math.abs(mid - 0.5);
      validBands++;
    } else {
      leftU[b] = 0.15;
      rightU[b] = 0.85;
    }
  }

  if (validBands < 6) {
    return { canWarpPhoto: false, reason: 'insufficient_bands', coverageRatio };
  }

  const meanCenterDeviation = centerDeviationSum / validBands;
  // Heavily lopsided/folded garment pile
  if (meanCenterDeviation > 0.24 && roleKey !== 'shoes') {
    return { canWarpPhoto: false, reason: 'asymmetrical_cutout', meanCenterDeviation };
  }

  return {
    canWarpPhoto: true,
    coverageRatio,
    meanCenterDeviation,
    leftU,
    rightU,
  };
}

/**
 * Detects the normalized vertical position `vCrotchPhoto` (`0..1` from top of cropped pants)
 * where the single pelvis/fly span splits into separated left and right trouser legs.
 * Used to enforce the absolute Crunch (Crotch) Barrier (`yCrotch_pants >= avatar.yCrotch`).
 */
export function detectPantsCrotchRatio(croppedAlpha, cropW, cropH, isShort = false) {
  const defaultRatio = isShort ? 0.56 : 0.28;
  if (!croppedAlpha || cropW < 16 || cropH < 16) return defaultRatio;

  const yStart = Math.floor(cropH * 0.14);
  const yEnd = Math.floor(cropH * (isShort ? 0.82 : 0.62));
  let consecutiveSplitRows = 0;

  for (let y = yStart; y <= yEnd; y++) {
    const rowOff = y * cropW;
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < cropW; x++) {
      if (croppedAlpha[rowOff + x] > 65) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    const span = maxX - minX;
    if (minX === -1 || span < cropW * 0.25) continue;

    // Check central 34% corridor of [minX, maxX] for an interior leg-split gap
    const c0 = Math.max(minX + 2, Math.floor(minX + span * 0.33));
    const c1 = Math.min(maxX - 2, Math.ceil(minX + span * 0.67));
    let hasLeftLeg = false;
    for (let x = minX; x < c0; x++) {
      if (croppedAlpha[rowOff + x] > 65) {
        hasLeftLeg = true;
        break;
      }
    }
    let hasRightLeg = false;
    for (let x = c1 + 1; x <= maxX; x++) {
      if (croppedAlpha[rowOff + x] > 65) {
        hasRightLeg = true;
        break;
      }
    }

    let maxGapRun = 0;
    let curGap = 0;
    for (let x = c0; x <= c1; x++) {
      if (croppedAlpha[rowOff + x] <= 65) {
        curGap++;
        if (curGap > maxGapRun) maxGapRun = curGap;
      } else {
        curGap = 0;
      }
    }

    if (hasLeftLeg && hasRightLeg && maxGapRun >= Math.max(2, Math.floor(cropW * 0.025))) {
      consecutiveSplitRows++;
      if (consecutiveSplitRows >= 3) {
        const splitY = y - 2;
        const ratio = splitY / Math.max(1, cropH - 1);
        return isShort
          ? Math.max(0.32, Math.min(0.76, ratio))
          : Math.max(0.18, Math.min(0.52, ratio));
      }
    } else {
      consecutiveSplitRows = 0;
    }
  }

  return defaultRatio;
}

/**
 * Analyzes a cropped footwear alpha mask (`croppedAlpha`, `cropW`, `cropH`) to determine
 * whether the image shows a **pair of shoes** side-by-side (`isPaired = true`) or a
 * **single shoe** (`isPaired = false`).
 *
 * When `isPaired === true`, finds the exact vertical split column `splitX` separating
 * the left shoe from the right shoe and returns each individual shoe's tight bounding box
 * (`leftBox`, `rightBox`) so exactly ONE shoe is mapped onto each of the avatar's feet.
 */
export function analyzeFootwearCutout(croppedAlpha, cropW, cropH) {
  const fullBox = { x: 0, y: 0, w: Math.max(1, cropW), h: Math.max(1, cropH) };
  if (!croppedAlpha || cropW < 8 || cropH < 8) {
    return { isPaired: false, splitX: Math.floor(cropW * 0.5), leftBox: fullBox, rightBox: fullBox };
  }

  const minRunWidth = Math.max(2, Math.floor(cropW * 0.035));
  const splitGapMidpoints = [];

  // 1. Scan rows for 2+ horizontal opaque islands separated by a gap near the center
  for (let y = 0; y < cropH; y++) {
    const rowOff = y * cropW;
    const runs = [];
    let inRun = false;
    let runStart = 0;
    for (let x = 0; x < cropW; x++) {
      if (croppedAlpha[rowOff + x] > 40) {
        if (!inRun) {
          inRun = true;
          runStart = x;
        }
      } else if (inRun) {
        if (x - runStart >= minRunWidth) {
          runs.push({ start: runStart, end: x - 1 });
        }
        inRun = false;
      }
    }
    if (inRun && cropW - runStart >= minRunWidth) {
      runs.push({ start: runStart, end: cropW - 1 });
    }

    if (runs.length >= 2) {
      // Find the gap between consecutive runs closest to the horizontal center (0.5 * cropW)
      let bestGapMid = null;
      let bestDist = Infinity;
      for (let i = 0; i < runs.length - 1; i++) {
        const gapStart = runs[i].end + 1;
        const gapEnd = runs[i + 1].start - 1;
        const gapMid = 0.5 * (gapStart + gapEnd);
        if (gapMid >= cropW * 0.25 && gapMid <= cropW * 0.75) {
          const dist = Math.abs(gapMid - cropW * 0.5);
          if (dist < bestDist) {
            bestDist = dist;
            bestGapMid = gapMid;
          }
        }
      }
      if (bestGapMid !== null) {
        splitGapMidpoints.push(bestGapMid);
      }
    }
  }

  // 2. Compute column opacity profiles (full height, upper 45% collar zone, lower 35% toe zone)
  const colCount = new Float64Array(cropW);
  const topColCount = new Float64Array(cropW);
  const botColCount = new Float64Array(cropW);
  const topH = Math.max(1, Math.floor(cropH * 0.45));
  const botStartY = Math.min(cropH - 1, Math.floor(cropH * 0.65));

  for (let x = 0; x < cropW; x++) {
    let allC = 0;
    let topC = 0;
    let botC = 0;
    for (let y = 0; y < cropH; y++) {
      if (croppedAlpha[y * cropW + x] > 40) {
        allC++;
        if (y < topH) topC++;
        if (y >= botStartY) botC++;
      }
    }
    colCount[x] = allC / cropH;
    topColCount[x] = topC / topH;
    botColCount[x] = botC / Math.max(1, cropH - botStartY);
  }

  const lStart = Math.max(0, Math.floor(cropW * 0.10));
  const lEnd = Math.max(lStart + 1, Math.floor(cropW * 0.44));
  const rStart = Math.min(cropW - 2, Math.ceil(cropW * 0.56));
  const rEnd = Math.min(cropW - 1, Math.ceil(cropW * 0.90));

  let leftPeakX = Math.floor(cropW * 0.25);
  let leftPeakVal = 0;
  let topLeftPeak = 0;
  for (let x = lStart; x <= lEnd; x++) {
    if (colCount[x] > leftPeakVal) {
      leftPeakVal = colCount[x];
      leftPeakX = x;
    }
    if (topColCount[x] > topLeftPeak) topLeftPeak = topColCount[x];
  }

  let rightPeakX = Math.floor(cropW * 0.75);
  let rightPeakVal = 0;
  let topRightPeak = 0;
  for (let x = rStart; x <= rEnd; x++) {
    if (colCount[x] > rightPeakVal) {
      rightPeakVal = colCount[x];
      rightPeakX = x;
    }
    if (topColCount[x] > topRightPeak) topRightPeak = topColCount[x];
  }

  const searchX0 = Math.max(Math.floor(cropW * 0.32), Math.min(leftPeakX + 1, Math.floor(cropW * 0.45)));
  const searchX1 = Math.min(Math.ceil(cropW * 0.68), Math.max(rightPeakX - 1, Math.ceil(cropW * 0.55)));
  let valleyX = Math.floor(cropW * 0.5);
  let valleyScore = Infinity;
  for (let x = searchX0; x <= searchX1; x++) {
    const score = colCount[x] + 0.75 * topColCount[x] + 0.45 * botColCount[x];
    if (score < valleyScore) {
      valleyScore = score;
      valleyX = x;
    }
  }

  // 3. Measure vertical span symmetry between left half [8%..44%] and right half [56%..92%]
  let leftMinY = cropH;
  let leftMaxY = 0;
  let rightMinY = cropH;
  let rightMaxY = 0;
  for (let y = 0; y < cropH; y++) {
    const rowOff = y * cropW;
    for (let x = lStart; x <= lEnd; x++) {
      if (croppedAlpha[rowOff + x] > 40) {
        if (y < leftMinY) leftMinY = y;
        if (y > leftMaxY) leftMaxY = y;
      }
    }
    for (let x = rStart; x <= rEnd; x++) {
      if (croppedAlpha[rowOff + x] > 40) {
        if (y < rightMinY) rightMinY = y;
        if (y > rightMaxY) rightMaxY = y;
      }
    }
  }

  const splitRowRatio = splitGapMidpoints.length / Math.max(1, cropH);
  const minPeak = Math.min(leftPeakVal, rightPeakVal);
  const minTopPeak = Math.min(topLeftPeak, topRightPeak);
  const hasFullValley = minPeak > 0.2 && colCount[valleyX] <= minPeak * 0.84;
  const hasTopCollarValley = minTopPeak > 0.15 && topColCount[valleyX] <= minTopPeak * 0.78;
  const bothSidesReachTopAndBottom =
    leftMinY <= cropH * 0.24 &&
    rightMinY <= cropH * 0.24 &&
    leftMaxY >= cropH * 0.76 &&
    rightMaxY >= cropH * 0.76 &&
    cropW / Math.max(1, cropH) >= 0.48;

  const isPaired =
    splitGapMidpoints.length >= Math.max(2, Math.floor(cropH * 0.05)) ||
    splitRowRatio >= 0.05 ||
    hasFullValley ||
    hasTopCollarValley ||
    bothSidesReachTopAndBottom;

  let splitX = valleyX;
  if (splitGapMidpoints.length >= 2) {
    const sorted = [...splitGapMidpoints].sort((a, b) => a - b);
    const medianGap = sorted[Math.floor(sorted.length * 0.5)];
    splitX = Math.round(0.65 * medianGap + 0.35 * valleyX);
  }
  splitX = Math.max(Math.floor(cropW * 0.32), Math.min(Math.ceil(cropW * 0.68), splitX));

  if (!isPaired) {
    return { isPaired: false, splitX, leftBox: fullBox, rightBox: fullBox };
  }

  const computeHalfBox = (xStart, xEndInclusive) => {
    let bx0 = xEndInclusive;
    let by0 = cropH - 1;
    let bx1 = xStart;
    let by1 = 0;
    let found = false;
    for (let y = 0; y < cropH; y++) {
      const rowOff = y * cropW;
      for (let x = xStart; x <= xEndInclusive; x++) {
        if (croppedAlpha[rowOff + x] > 35) {
          found = true;
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
          if (y < by0) by0 = y;
          if (y > by1) by1 = y;
        }
      }
    }
    if (!found || bx1 <= bx0 + 2 || by1 <= by0 + 2) {
      return {
        x: xStart,
        y: 0,
        w: Math.max(1, xEndInclusive - xStart + 1),
        h: cropH,
      };
    }
    return {
      x: bx0,
      y: by0,
      w: Math.max(1, bx1 - bx0 + 1),
      h: Math.max(1, by1 - by0 + 1),
    };
  };

  const leftBox = computeHalfBox(0, Math.max(0, splitX - 1));
  const rightBox = computeHalfBox(Math.min(cropW - 1, splitX), cropW - 1);

  return {
    isPaired: true,
    splitX,
    leftBox,
    rightBox,
  };
}

/**
 * Tier 1: Warps a real segmented closet garment cutout (`cropCanvas`, `croppedAlpha`)
 * onto the Default Avatar's `400 x 900` canvas so its collar, shoulders, chest,
 * waist, hips, crotch barrier, and hem align with the Default Avatar's exact landmarks.
 */
function warpRealGarmentPhotoToDefaultCanvas(
  cropCanvas,
  croppedAlpha,
  cropW,
  cropH,
  garment,
  roleKey,
  sex = 'female'
) {
  const env = getGarmentAnatomicalEnvelope(garment, roleKey, sex);
  const { g, yTop0, yBot0, yCrotchTarget, bottomMetrics, halfWidthAtY } = env;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = CANVAS_W;
  outCanvas.height = CANVAS_H;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Special handling for Footwear: map exactly ONE shoe per foot
  if (roleKey === 'shoes') {
    const shoeAnalysis = analyzeFootwearCutout(croppedAlpha, cropW, cropH);
    const footIn = Math.max(2.0, Math.min(g.wInnerAnkle, g.wFootHeel || g.wInnerAnkle) - 2.0);
    const footOut = g.wFootTip + 2.2;
    const shoeW = (footOut - footIn) * SCALE;
    const dxLeft = (g.x0 - footOut) * SCALE;
    const dxRight = (g.x0 + footIn) * SCALE;

    // Detect if the individual shoe has a tall boot shaft (height/width > 1.18)
    const singleW = shoeAnalysis.isPaired
      ? 0.5 * (shoeAnalysis.leftBox.w + shoeAnalysis.rightBox.w)
      : cropW;
    const singleH = shoeAnalysis.isPaired
      ? 0.5 * (shoeAnalysis.leftBox.h + shoeAnalysis.rightBox.h)
      : cropH;
    const isTallShaftPhoto = singleH / Math.max(1, singleW) > 1.18;
    const effectiveYTop0 = isTallShaftPhoto ? Math.min(yTop0, g.yAnkles - 6.5) : yTop0;

    const dy = effectiveYTop0 * SCALE;
    const dh = Math.max(8, (yBot0 - effectiveYTop0) * SCALE);

    if (shoeAnalysis.isPaired) {
      const { leftBox, rightBox } = shoeAnalysis;
      // Draw ONLY the left shoe from the pair onto the avatar's left foot
      ctx.drawImage(
        cropCanvas,
        leftBox.x,
        leftBox.y,
        leftBox.w,
        leftBox.h,
        dxLeft,
        dy,
        shoeW,
        dh
      );
      // Draw ONLY the right shoe from the pair onto the avatar's right foot
      ctx.drawImage(
        cropCanvas,
        rightBox.x,
        rightBox.y,
        rightBox.w,
        rightBox.h,
        dxRight,
        dy,
        shoeW,
        dh
      );
    } else {
      // Single shoe in photo: draw onto right foot and mirror onto left foot
      ctx.drawImage(cropCanvas, 0, 0, cropW, cropH, dxRight, dy, shoeW, dh);
      ctx.save();
      ctx.translate((g.x0 - footIn) * SCALE, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(cropCanvas, 0, 0, cropW, cropH, 0, 0, shoeW, dh);
      ctx.restore();
    }
    return outCanvas;
  }

  const SLICES = 64;
  const isPantsOrShorts =
    roleKey === 'bottom' &&
    bottomMetrics &&
    !bottomMetrics.isSkirt &&
    !bottomMetrics.isBriefOrBikini;

  // Detect photo crotch ("crunch") split ratio for pants/shorts so we can map
  // [0..vCrotchPhoto] -> [yTop0..yCrotchTarget] and [vCrotchPhoto..1] -> [yCrotchTarget..yBot0]
  const vCrotchPhoto = isPantsOrShorts
    ? detectPantsCrotchRatio(croppedAlpha, cropW, cropH, bottomMetrics.isShort)
    : null;

  // Helper that maps normalized SVG slice position `tSvg` (0..1 in [yTop0, yBot0])
  // to normalized photo vertical coordinate `vPhoto` (0..1 in [0, cropH])
  const mapSvgFractionToPhotoV = (tSvg) => {
    const ySvg = yTop0 + tSvg * (yBot0 - yTop0);
    if (
      !isPantsOrShorts ||
      vCrotchPhoto === null ||
      yCrotchTarget <= yTop0 + 4 ||
      yCrotchTarget >= yBot0 - 4
    ) {
      return tSvg;
    }
    if (ySvg <= yCrotchTarget) {
      const riseFrac = (ySvg - yTop0) / Math.max(1, yCrotchTarget - yTop0);
      return riseFrac * vCrotchPhoto;
    }
    const legFrac = (ySvg - yCrotchTarget) / Math.max(1, yBot0 - yCrotchTarget);
    return vCrotchPhoto + legFrac * (1 - vCrotchPhoto);
  };

  const rawU0 = new Float64Array(SLICES);
  const rawU1 = new Float64Array(SLICES);

  for (let s = 0; s < SLICES; s++) {
    const v0 = mapSvgFractionToPhotoV(s / SLICES);
    const v1 = mapSvgFractionToPhotoV((s + 1) / SLICES);
    const sy0 = Math.max(0, Math.min(cropH - 1, Math.floor(v0 * cropH)));
    const sy1 = Math.max(sy0 + 1, Math.min(cropH, Math.ceil(v1 * cropH)));
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < cropW; x++) {
      let hit = false;
      for (let y = sy0; y < sy1; y++) {
        if (croppedAlpha[y * cropW + x] > 60) {
          hit = true;
          break;
        }
      }
      if (hit) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX !== -1 && maxX > minX + 2) {
      let curU0 = minX / Math.max(1, cropW - 1);
      let curU1 = maxX / Math.max(1, cropW - 1);
      // For pants/shorts: below crotch, detect when one leg ends before the other (uneven hems or cuffs)
      // to prevent bounding box collapse, coordinate shifts, and diagonal smeared stretching!
      if (isPantsOrShorts && s > 0 && s >= Math.floor(SLICES * 0.35)) {
        const prevSpan = rawU1[s - 1] - rawU0[s - 1];
        const curSpan = curU1 - curU0;
        if (prevSpan > 0.28 && curSpan < 0.60 * prevSpan) {
          if (curU1 < 0.50) {
            curU1 = rawU1[s - 1];
          } else if (curU0 > 0.50) {
            curU0 = rawU0[s - 1];
          }
        }
      }
      rawU0[s] = curU0;
      rawU1[s] = curU1;
    } else {
      rawU0[s] = s > 0 ? rawU0[s - 1] : 0.15;
      rawU1[s] = s > 0 ? rawU1[s - 1] : 0.85;
    }
  }

  // Smooth [rawU0, rawU1] with a 7-tap moving average
  const smoothU0 = new Float64Array(SLICES);
  const smoothU1 = new Float64Array(SLICES);
  for (let s = 0; s < SLICES; s++) {
    let sum0 = 0;
    let sum1 = 0;
    let cnt = 0;
    for (let k = Math.max(0, s - 3); k <= Math.min(SLICES - 1, s + 3); k++) {
      sum0 += rawU0[k];
      sum1 += rawU1[k];
      cnt++;
    }
    smoothU0[s] = sum0 / cnt;
    smoothU1[s] = sum1 / cnt;
  }

  // =========================================================================
  // 2. TOPS / OUTERWEAR / DRESSES:
  //    Fit the avatar's shoulders and neckline (`yTop0 = g.yChin - 0.6`,
  //    shoulder width `2 * (g.wShoulders * easeMult + 2.2)`), leaving the
  //    garment's original silhouette and cut 100% untouched.
  // =========================================================================
  if (
    roleKey === 'top' ||
    roleKey === 'outerwear' ||
    roleKey === 'dress' ||
    roleKey === 'full_body'
  ) {
    const minRunW = Math.max(2, Math.floor(cropW * 0.035));
    const innerTorsoSpans = [];
    const innerTorsoCenters = [];
    const scanY0 = Math.floor(cropH * 0.28);
    const scanY1 = Math.floor(cropH * 0.82);
    for (let y = scanY0; y <= scanY1; y += Math.max(1, Math.floor((scanY1 - scanY0) / 28))) {
      const rowOff = y * cropW;
      const runs = [];
      let inRun = false;
      let r0 = 0;
      for (let x = 0; x < cropW; x++) {
        if (croppedAlpha[rowOff + x] > 55) {
          if (!inRun) {
            inRun = true;
            r0 = x;
          }
        } else if (inRun) {
          if (x - r0 >= minRunW) runs.push({ start: r0, end: x - 1 });
          inRun = false;
        }
      }
      if (inRun && cropW - r0 >= minRunW) runs.push({ start: r0, end: cropW - 1 });
      // Top/Outerwear with visible gap(s) separating one or both sleeves from the main torso
      if (runs.length >= 2) {
        const dominantRun = runs.reduce((best, cur) =>
          cur.end - cur.start > best.end - best.start ? cur : best
        );
        const domCenter = 0.5 * (dominantRun.start + dominantRun.end) / Math.max(1, cropW - 1);
        const domSpan = (dominantRun.end - dominantRun.start + 1) / Math.max(1, cropW - 1);
        if (domCenter >= 0.25 && domCenter <= 0.78 && domSpan >= 0.25 && domSpan <= 0.85) {
          innerTorsoSpans.push(domSpan);
          innerTorsoCenters.push(domCenter);
        }
      }
    }

    let upperMaxSpanU = 0;
    for (let s = Math.floor(SLICES * 0.10); s <= Math.floor(SLICES * 0.44); s++) {
      const sp = smoothU1[s] - smoothU0[s];
      if (sp > upperMaxSpanU) upperMaxSpanU = sp;
    }

    const lowerSpans = [];
    for (let s = Math.floor(SLICES * 0.52); s <= Math.floor(SLICES * 0.86); s++) {
      const sp = smoothU1[s] - smoothU0[s];
      if (sp > 0.18) lowerSpans.push(sp);
    }
    lowerSpans.sort((a, b) => a - b);
    const lowerBodySpanU =
      lowerSpans.length > 0 ? lowerSpans[Math.floor(lowerSpans.length * 0.5)] : 0.68;

    let coreShoulderSpanU = lowerBodySpanU;
    if (innerTorsoSpans.length >= 2) {
      innerTorsoSpans.sort((a, b) => a - b);
      coreShoulderSpanU = innerTorsoSpans[Math.floor(innerTorsoSpans.length * 0.5)] * 1.03;
    } else if (upperMaxSpanU > lowerBodySpanU * 1.12) {
      // Short/medium sleeves stick out in upper half; lower half is the pure torso body
      coreShoulderSpanU = lowerBodySpanU * 1.02;
    } else if (upperMaxSpanU > 0.78 && cropW / Math.max(1, cropH) > 0.76) {
      // Long sleeves hanging down beside torso without a transparent gap
      coreShoulderSpanU = upperMaxSpanU * 0.72;
    } else {
      // Sleeveless top, tank, vest, or A-line dress
      coreShoulderSpanU = Math.min(upperMaxSpanU || lowerBodySpanU, lowerBodySpanU);
    }
    coreShoulderSpanU = Math.max(0.28, Math.min(0.98, coreShoulderSpanU));

    // Anchor horizontal centerline using the collar/shoulder zone + dominant torso runs
    // so an asymmetrically extended sleeve on one side never shifts the collar/torso off the spine
    const collarCenters = [];
    for (let s = Math.floor(SLICES * 0.04); s <= Math.floor(SLICES * 0.26); s++) {
      collarCenters.push(0.5 * (smoothU0[s] + smoothU1[s]));
    }
    for (let s = Math.floor(SLICES * 0.78); s <= Math.floor(SLICES * 0.92); s++) {
      collarCenters.push(0.5 * (smoothU0[s] + smoothU1[s]));
    }
    innerTorsoCenters.forEach((c) => collarCenters.push(c));
    collarCenters.sort((a, b) => a - b);
    const topCenterU =
      collarCenters.length > 0 ? collarCenters[Math.floor(collarCenters.length * 0.5)] : 0.5;

    const targetShoulderHalfW = (g.wShoulders + 4.0) * env.easeMult + 2.2;
    const shoulderFullSvgWidth = Math.max(
      52,
      Math.min(168, (2 * targetShoulderHalfW) / coreShoulderSpanU)
    );

    const midPhotoX = Math.max(1, Math.min(cropW - 1, Math.round(topCenterU * cropW)));
    for (let s = 0; s < SLICES; s++) {
      const t0 = s / SLICES;
      const t1 = (s + 1) / SLICES;
      const sy = t0 * cropH;
      const sh = Math.max(1, (t1 - t0) * cropH);
      const ySvgTop = yTop0 + t0 * (yBot0 - yTop0);
      const ySvgBot = yTop0 + t1 * (yBot0 - yTop0);
      const dy = ySvgTop * SCALE;
      const dh = (ySvgBot - ySvgTop) * SCALE + 0.95;

      const leftSpanU = Math.max(0.05, topCenterU - smoothU0[s]);
      const rightSpanU = Math.max(0.05, smoothU1[s] - topCenterU);

      // Symmetrize any asymmetrically outstretched sleeve so both sides drape along the avatar arms
      const effLeftSpanU = Math.min(leftSpanU, Math.max(rightSpanU * 1.12, 0.5 * coreShoulderSpanU));
      const effRightSpanU = Math.min(rightSpanU, Math.max(leftSpanU * 1.12, 0.5 * coreShoulderSpanU));

      const leftScale = effLeftSpanU / leftSpanU;
      const rightScale = effRightSpanU / rightSpanU;

      const leftDestW = topCenterU * shoulderFullSvgWidth * leftScale * SCALE;
      const rightDestW = (1 - topCenterU) * shoulderFullSvgWidth * rightScale * SCALE;

      ctx.drawImage(
        cropCanvas,
        0,
        sy,
        midPhotoX,
        sh,
        g.x0 * SCALE - leftDestW,
        dy,
        leftDestW + 0.5,
        dh
      );
      ctx.drawImage(
        cropCanvas,
        midPhotoX,
        sy,
        cropW - midPhotoX,
        sh,
        g.x0 * SCALE,
        dy,
        rightDestW,
        dh
      );
    }
    return outCanvas;
  }

  // =========================================================================
  // 3. BOTTOMS (PANTS / JEANS / TROUSERS / SHORTS / SKIRTS):
  //    Fit the avatar's waist (`yTop0`), pelvis (`g.yHip`), and leg contour
  //    with the crotch barrier at `yCrotchTarget >= g.yCrotch`.
  // =========================================================================
  const tHipSvg = Math.max(
    0.04,
    Math.min(0.45, (g.yHip - yTop0) / Math.max(1, yBot0 - yTop0))
  );
  const sHip = Math.max(1, Math.min(SLICES - 2, Math.round(tHipSvg * (SLICES - 1))));

  let waistSpanSum = 0;
  let waistSpanCnt = 0;
  const waistEndSlice = Math.min(3, sHip);
  for (let s = 0; s <= waistEndSlice; s++) {
    waistSpanSum += Math.max(0.22, smoothU1[s] - smoothU0[s]);
    waistSpanCnt++;
  }
  const waistPhotoSpanU = waistSpanSum / Math.max(1, waistSpanCnt);

  let pelvisSpanSum = 0;
  let pelvisSpanCnt = 0;
  for (let s = Math.max(0, sHip - 2); s <= Math.min(SLICES - 1, sHip + 2); s++) {
    pelvisSpanSum += Math.max(0.22, smoothU1[s] - smoothU0[s]);
    pelvisSpanCnt++;
  }
  const pelvisPhotoSpanU = pelvisSpanSum / Math.max(1, pelvisSpanCnt);

  const waistTargetHalfW = halfWidthAtY(yTop0);
  const pelvisTargetHalfW = g.wHip + 1.5;

  const waistFullSvgWidth = Math.max(
    40,
    Math.min(152, (2 * waistTargetHalfW) / Math.max(0.22, waistPhotoSpanU))
  );
  const pelvisFullSvgWidth = Math.max(
    44,
    Math.min(156, (2 * pelvisTargetHalfW) / Math.max(0.22, pelvisPhotoSpanU))
  );

  for (let s = 0; s < SLICES; s++) {
    const t0 = s / SLICES;
    const t1 = (s + 1) / SLICES;
    const tMid = 0.5 * (t0 + t1);

    const v0 = mapSvgFractionToPhotoV(t0);
    const v1 = mapSvgFractionToPhotoV(t1);
    const sy = v0 * cropH;
    const sh = Math.max(1, (v1 - v0) * cropH);

    const ySvgTop = yTop0 + t0 * (yBot0 - yTop0);
    const ySvgBot = yTop0 + t1 * (yBot0 - yTop0);
    const ySvgMid = yTop0 + tMid * (yBot0 - yTop0);

    const dy = ySvgTop * SCALE;
    const dh = (ySvgBot - ySvgTop) * SCALE + 0.95;

    const sliceSpanU = Math.max(0.22, smoothU1[s] - smoothU0[s]);
    const sliceCenterU = 0.5 * (smoothU0[s] + smoothU1[s]);
    const targetHalfW = halfWidthAtY(ySvgMid);
    const envelopeFullSvgWidth = Math.max(
      40,
      Math.min(156, (2 * targetHalfW) / sliceSpanU)
    );

    let fullSliceSvgWidth = envelopeFullSvgWidth;
    if (ySvgMid <= g.yHip && g.yHip > yTop0 + 0.5) {
      const uPelvis = Math.max(0, Math.min(1, (ySvgMid - yTop0) / (g.yHip - yTop0)));
      const sCurve = uPelvis * uPelvis * (3 - 2 * uPelvis);
      fullSliceSvgWidth = waistFullSvgWidth + (pelvisFullSvgWidth - waistFullSvgWidth) * sCurve;
    } else if (isPantsOrShorts) {
      // Blend smoothly from pelvis width at g.yHip to anatomical leg envelope width below crotch
      const uLeg = Math.max(0, Math.min(1, (ySvgMid - g.yHip) / Math.max(1, yBot0 - g.yHip)));
      const blend = Math.min(1, uLeg * 1.6);
      fullSliceSvgWidth = pelvisFullSvgWidth * (1 - blend) + envelopeFullSvgWidth * blend;
    }

    const effectiveCenterU = isPantsOrShorts
      ? Math.max(0.44, Math.min(0.56, sliceCenterU))
      : sliceCenterU;
    const svgLeftX = g.x0 - effectiveCenterU * fullSliceSvgWidth;
    const dx = svgLeftX * SCALE;
    const dw = fullSliceSvgWidth * SCALE;

    ctx.drawImage(cropCanvas, 0, sy, cropW, sh, dx, dy, dw, dh);
  }

  return outCanvas;
}

/**
 * Tier 2: Direct JS port of `scripts/fit_onboarding_garments_to_avatar.py`
 * Cubic-Bezier garment silhouette + real fabric texture & 3D cylindrical shading.
 */
export function renderProceduralBezierFittedGarment(garment, roleKey, sex = 'female', sourceImg = null) {
  const g = getDefaultAvatarFitterGeometry(sex);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = CANVAS_W;
  outCanvas.height = CANVAS_H;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const text = `${garment.name || ''} ${garment.title || ''} ${garment.sub_category || ''} ${garment.item_type || ''} ${garment.category || ''} ${garment.pattern || ''}`.toLowerCase();
  const baseHex = resolveGarmentHexColor(garment);
  const baseRgb = hexToRgb(baseHex);
  const darkRgb = adjustRgb(baseRgb, 0.72);
  const seamRgb = adjustRgb(baseRgb, 0.55);
  const trimRgb = adjustRgb(baseRgb, 1.22);

  const fillPolygonList = (polyList, fillRgb, strokeRgb = seamRgb, lineWidth = 2) => {
    const list = Array.isArray(polyList[0]?.[0]) ? polyList : [polyList];
    list.forEach((pts) => {
      if (!pts || pts.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * SCALE, pts[0][1] * SCALE);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0] * SCALE, pts[i][1] * SCALE);
      }
      ctx.closePath();
      ctx.fillStyle = rgbCss(fillRgb);
      ctx.fill();
      if (strokeRgb) {
        ctx.strokeStyle = rgbCss(strokeRgb);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    });
  };

  const strokeLine = (pts, strokeRgb, lineWidth = 2) => {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * SCALE, pts[0][1] * SCALE);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * SCALE, pts[i][1] * SCALE);
    }
    ctx.strokeStyle = rgbCss(strokeRgb);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  const buildTorsoAndSleevesPolys = ({
    hemY,
    easeSh = 2.0,
    easeCh = 2.2,
    easeWa = 2.5,
    easeHip = 3.0,
    easeHem = 3.5,
    sleeveEndY = null,
    cuffWidth = 9.5,
    neckDepth = 3.5,
  }) => {
    const x0 = g.x0;
    const yChin = g.yChin;
    const ySh = g.yShoulders;
    const yCh = g.yChest;
    const yWa = g.yWaist;
    const yHip = g.yHip;
    const wSh = g.wShoulders + easeSh + (sleeveEndY !== null ? 4.2 : 0.0);
    const wCh = g.wChest + easeCh;
    let wWa = g.wWaist + easeWa;
    if (easeHem >= 10.0) wWa = Math.max(wWa, wCh * 0.95);
    const wHip = g.wHip + easeHip;

    const neckHeight = ySh - yChin;
    const collarTopY = yChin - 0.6;
    const wCollarAnchor = Math.max(6.0, g.wNeck - 0.5);
    const neckDipY = Math.min(ySh + neckDepth * 0.45, yChin + 0.8 + neckDepth * 0.35);

    const pNeckC = [x0, neckDipY];
    const pNeckR = [x0 + wCollarAnchor, collarTopY];
    const pShR = [x0 + wSh, ySh - 0.5];
    const pChR = [x0 + wCh, yCh];
    const pWaR = [x0 + wWa, yWa];

    const torsoR = [pNeckC];
    torsoR.push(
      ...evalCubicBezier(
        pNeckC,
        [x0 + wCollarAnchor * 0.55, neckDipY],
        [x0 + wCollarAnchor * 0.90, collarTopY + 0.6],
        pNeckR,
        16
      )
    );
    torsoR.push(
      ...evalCubicBezier(
        pNeckR,
        [x0 + wCollarAnchor + (wSh - wCollarAnchor) * 0.48, yChin + neckHeight * 0.30],
        [x0 + wSh * 0.82, ySh - 2.5],
        pShR,
        16
      )
    );
    torsoR.push(
      ...evalCubicBezier(
        pShR,
        [x0 + wSh + 1.0, ySh + 9.0],
        [x0 + wCh + 1.2, yCh - 5.0],
        pChR,
        16
      )
    );
    torsoR.push(
      ...evalCubicBezier(
        pChR,
        [x0 + wCh - (g.isMale ? 1.0 : 2.5), yCh + (yWa - yCh) * 0.5],
        [x0 + wWa + (g.isMale ? 1.5 : -1.5), yWa - 7.0],
        pWaR,
        16
      )
    );

    let wHem = wHip + easeHem;
    if (hemY <= yHip + 6.0) {
      wHem = wHip + easeHem * 0.5;
      torsoR.push(
        ...evalCubicBezier(
          pWaR,
          [x0 + wWa + 2.0, yWa + (hemY - yWa) * 0.5],
          [x0 + wHem, hemY - 4.0],
          [x0 + wHem, hemY],
          16
        )
      );
    } else {
      const legOuterAtHem = hemY > g.yKnees + 20 ? g.wOuterAnkle : g.wOuterKnee;
      wHem = Math.max(wHip + easeHem, legOuterAtHem + easeHem);
      const pHipR = [x0 + wHip, yHip];
      torsoR.push(
        ...evalCubicBezier(
          pWaR,
          [x0 + wWa + (g.isMale ? 1.0 : 3.5), yWa + (yHip - yWa) * 0.5],
          [x0 + wHip + 1.5, yHip - 7.0],
          pHipR,
          16
        )
      );
      torsoR.push(
        ...evalCubicBezier(
          pHipR,
          [x0 + wHip + easeHem * 0.35, yHip + (hemY - yHip) * 0.45],
          [x0 + wHem, hemY - 8.0],
          [x0 + wHem, hemY],
          18
        )
      );
    }

    const hemCurve = evalCubicBezier(
      [x0 + wHem, hemY],
      [x0 + wHem * 0.35, hemY + 2.5],
      [x0 - wHem * 0.35, hemY + 2.5],
      [x0 - wHem, hemY],
      16
    );
    const torsoL = torsoR
      .slice()
      .reverse()
      .map(([px, py]) => [2.0 * x0 - px, py]);
    const polys = [[...torsoR, ...hemCurve, ...torsoL]];

    if (sleeveEndY !== null && sleeveEndY > ySh + 6.0) {
      const yEl = g.yElbow;
      const yWr = g.yWrist;
      const armSpan = Math.max(1.0, yWr - ySh);
      const elFrac = Math.max(0.25, Math.min(0.75, (yEl - ySh) / armSpan));
      const frac = Math.min(1.08, Math.max(0.15, (sleeveEndY - ySh) / armSpan));

      const armpitOff = Math.min(wCh, wWa) - 3.5;
      const armpitY = Math.min(hemY - 4.0, yCh + 16.0);

      const outElOff = g.wElbowOut + easeSh + (easeHem >= 10.0 ? 2.2 : 1.2);
      const inElOff = g.wElbowIn - (easeHem >= 10.0 ? 3.5 : 2.6);
      const outWrOff = g.wWristOut + easeSh * 0.85 + (easeHem >= 10.0 ? 3.2 : 1.4);
      const inWrOff = Math.min(outWrOff - cuffWidth, g.wWristIn - (easeHem >= 10.0 ? 3.6 : 2.2));

      let outEndOff;
      let inEndOff;
      let ctrlOut1Off;
      let ctrlOut2Off;
      let ctrlIn1Off;
      let ctrlIn2Off;

      if (frac <= elFrac) {
        const tU = frac / elFrac;
        outEndOff = wSh + (outElOff - wSh) * tU;
        inEndOff = Math.min(outEndOff - cuffWidth, armpitOff + (inElOff - armpitOff) * tU);
        ctrlOut1Off = wSh + 3.2;
        ctrlOut2Off = outEndOff + 0.5;
        ctrlIn1Off = inEndOff - 1.5;
        ctrlIn2Off = armpitOff;
      } else {
        const tF = (frac - elFrac) / Math.max(0.05, 1.0 - elFrac);
        outEndOff = outElOff + (outWrOff - outElOff) * tF;
        inEndOff = inElOff + (inWrOff - inElOff) * tF;
        ctrlOut1Off = outElOff + 0.8;
        ctrlOut2Off = outEndOff + 1.0;
        ctrlIn1Off = inElOff - 2.2;
        ctrlIn2Off = armpitOff - 1.0;
      }

      for (const sign of [1, -1]) {
        const outerShX = x0 + sign * wSh;
        const outerEndX = x0 + sign * outEndOff;
        const innerEndX = x0 + sign * inEndOff;
        const innerArmpitX = x0 + sign * armpitOff;
        const sleevePoly = [
          [x0 + sign * (wSh - Math.min(14.0, cuffWidth * 0.95)), ySh],
          [outerShX, ySh - 0.5],
          ...evalCubicBezier(
            [outerShX, ySh - 0.5],
            [x0 + sign * ctrlOut1Off, ySh + (sleeveEndY - ySh) * 0.38],
            [x0 + sign * ctrlOut2Off, sleeveEndY - 6.0],
            [outerEndX, sleeveEndY],
            16
          ),
          ...evalCubicBezier(
            [outerEndX, sleeveEndY],
            [(outerEndX + innerEndX) * 0.5, sleeveEndY + 1.8],
            [(outerEndX + innerEndX) * 0.5, sleeveEndY + 1.8],
            [innerEndX, sleeveEndY + 1.5],
            8
          ),
          ...evalCubicBezier(
            [innerEndX, sleeveEndY + 1.5],
            [x0 + sign * ctrlIn1Off, armpitY + (sleeveEndY - armpitY) * 0.45],
            [x0 + sign * ctrlIn2Off, armpitY + 4.0],
            [innerArmpitX, armpitY],
            14
          ),
        ];
        polys.push(sleevePoly);
      }
    }
    return polys;
  };

  const buildTrousersPoly = (isLoose = false) => {
    const bm = getBottomRiseAndCrotchMetrics(garment, g);
    const x0 = g.x0;
    const yTop = bm.yTop0;
    const yHip = g.yHip;
    const yCr = bm.yCrotchTarget;
    const yKn = g.yKnees;
    const yAn = g.yAnkles + 3.0;

    const wTop = bm.avatarPelvisHalfWidthAtY(yTop) + 1.2;
    const isChino = /\b(chino|slim|tapered)\b/i.test(text);
    const wHip = g.wHip + (isLoose ? 3.6 : isChino ? 2.0 : 2.4);
    const wOutKn = isLoose ? 46.8 : isChino ? 44.6 : 45.2;
    const wOutAn = isLoose ? 47.2 : isChino ? (g.isMale ? 43.2 : 43.8) : 44.8;
    const wInKn = isLoose ? (g.isMale ? 11.5 : 12.5) : isChino ? (g.isMale ? 14.0 : 15.2) : (g.isMale ? 13.2 : 14.5);
    const wInAn = isLoose ? (g.isMale ? 14.5 : 18.5) : isChino ? (g.isMale ? 18.2 : 23.2) : (g.isMale ? 16.8 : 21.5);

    const ptsR = [[x0, yTop], [x0 + wTop, yTop]];
    if (yTop < yHip - 1.0) {
      ptsR.push(
        ...evalCubicBezier(
          [x0 + wTop, yTop],
          [x0 + wTop + (wHip - wTop) * 0.55, yTop + (yHip - yTop) * 0.48],
          [x0 + wHip + 0.6, yHip - 4.0],
          [x0 + wHip, yHip],
          14
        )
      );
    } else {
      ptsR.push([x0 + wHip, yHip]);
    }
    ptsR.push(
      ...evalCubicBezier(
        [x0 + wHip, yHip],
        [x0 + wHip + (wOutKn - wHip) * 0.38, yHip + (yKn - yHip) * 0.36],
        [x0 + wOutKn - (wOutKn - wHip) * 0.15, yKn - (yKn - yHip) * 0.28],
        [x0 + wOutKn, yKn],
        16
      ),
      ...evalCubicBezier(
        [x0 + wOutKn, yKn],
        [x0 + wOutKn + (wOutAn - wOutKn) * 0.32, yKn + (yAn - yKn) * 0.34],
        [x0 + wOutKn + (wOutAn - wOutKn) * 0.68, yAn - (yAn - yKn) * 0.32],
        [x0 + wOutAn, yAn],
        16
      ),
      [x0 + wInAn, yAn],
      ...evalCubicBezier(
        [x0 + wInAn, yAn],
        [x0 + wInKn + (wInAn - wInKn) * 0.60, yAn - (yAn - yKn) * 0.34],
        [x0 + wInKn + (wInAn - wInKn) * 0.18, yKn + (yAn - yKn) * 0.34],
        [x0 + wInKn, yKn],
        16
      ),
      ...evalCubicBezier(
        [x0 + wInKn, yKn],
        [x0 + wInKn * 0.52, yKn - (yKn - yCr) * 0.42],
        [x0 + 0.6, yCr + (yKn - yCr) * 0.22],
        [x0, yCr],
        16
      )
    );
    const ptsL = ptsR
      .slice()
      .reverse()
      .map(([px, py]) => [2.0 * x0 - px, py]);
    return [...ptsR, ...ptsL];
  };

  const buildSkirtPoly = (hemY, flare = 12.0) => {
    const x0 = g.x0;
    const yWa = g.yWaist;
    const yHip = g.yHip;
    const wWa = g.wWaist + 1.0;
    const wHip = g.wHip + 1.8;
    const legOuterAtHem = hemY > g.yKnees + 25.0 ? g.wOuterAnkle : Math.max(g.wOuterKnee, 44.2);
    const wHem = Math.max(wHip + flare, legOuterAtHem + Math.max(3.5, flare * 0.45));

    const ptsR = [[x0, yWa], [x0 + wWa, yWa]];
    ptsR.push(
      ...evalCubicBezier(
        [x0 + wWa, yWa],
        [x0 + wWa + 3.5, yWa + (yHip - yWa) * 0.45],
        [x0 + wHip + 1.5, yHip - 6.0],
        [x0 + wHip, yHip],
        14
      ),
      ...evalCubicBezier(
        [x0 + wHip, yHip],
        [x0 + wHip + flare * 0.45, yHip + (hemY - yHip) * 0.45],
        [x0 + wHem, hemY - 8.0],
        [x0 + wHem, hemY],
        16
      )
    );
    const hemCurve = evalCubicBezier(
      [x0 + wHem, hemY],
      [x0 + wHem * 0.35, hemY + 3.2],
      [x0 - wHem * 0.35, hemY + 3.2],
      [x0 - wHem, hemY],
      14
    );
    const ptsL = ptsR
      .slice()
      .reverse()
      .map(([px, py]) => [2.0 * x0 - px, py]);
    return [...ptsR, ...hemCurve, ...ptsL];
  };

  if (roleKey === 'dress' || roleKey === 'full_body') {
    const isMaxi = /\b(maxi|gown|abaya|kaftan|caftan|jalabiya|galabiya|thobe|saree|jumpsuit|suit)\b/i.test(text);
    const hemY = isMaxi ? g.yAnkles + 3.0 : g.yKnees + 6.0;
    const polys = buildTorsoAndSleevesPolys({
      hemY,
      easeSh: 2.2,
      easeCh: 2.8,
      easeWa: isMaxi ? 6.0 : 2.0,
      easeHip: 4.0,
      easeHem: isMaxi ? 14.0 : 3.5,
      sleeveEndY: isMaxi ? g.yWrist : g.yShoulders + 16.0,
      cuffWidth: isMaxi ? 12.0 : 9.0,
      neckDepth: 3.5,
    });
    fillPolygonList(polys, baseRgb, seamRgb, 2);
  } else if (roleKey === 'bottom') {
    const isSkirt = /\b(skirt|?????|?????|falda|jupe)\b/i.test(text);
    if (isSkirt) {
      const hemY = g.yKnees + 22.0;
      const poly = buildSkirtPoly(hemY, 12.0);
      fillPolygonList([poly], baseRgb, seamRgb, 2);
    } else {
      const isLoose = /\b(wide|loose|palazzo|relaxed|baggy)\b/i.test(text);
      const poly = buildTrousersPoly(isLoose);
      fillPolygonList([poly], baseRgb, seamRgb, 2);
    }
  } else if (roleKey === 'outerwear') {
    const isLong = /\b(trench|overcoat|duster|cardigan|achkan|long\s+coat)\b/i.test(text);
    const hemY = isLong ? g.yKnees + 14.0 : g.yHip + 9.0;
    const polys = buildTorsoAndSleevesPolys({
      hemY,
      easeSh: 3.6,
      easeCh: 3.8,
      easeWa: 3.8,
      easeHip: 4.5,
      easeHem: isLong ? 7.5 : 4.2,
      sleeveEndY: g.yWrist + 1.0,
      cuffWidth: 11.0,
      neckDepth: 12.0,
    });
    fillPolygonList(polys, baseRgb, seamRgb, 2);
    const wCollar = Math.max(6.0, g.wNeck - 0.5);
    fillPolygonList(
      [
        [[g.x0 - wCollar - 0.5, g.yChin - 0.4], [g.x0 - wCollar - 9.5, g.yShoulders + 10.0], [g.x0, g.yShoulders + 13.5]],
        [[g.x0 + wCollar + 0.5, g.yChin - 0.4], [g.x0 + wCollar + 9.5, g.yShoulders + 10.0], [g.x0, g.yShoulders + 13.5]],
      ],
      darkRgb,
      seamRgb,
      2
    );
    strokeLine([[g.x0, g.yShoulders + 13.5], [g.x0, hemY]], seamRgb, 2);
  } else if (roleKey === 'shoes') {
    const isBoot = /\b(boot|chelsea|??????|????)\b/i.test(text);
    const topShoeY = g.yAnkles - (isBoot ? 4.0 : 0.0);
    const yFt = g.yFeet;
    for (const sign of [-1, 1]) {
      const inAnX = g.x0 + sign * (g.wInnerAnkle - 2.0);
      const inFtX = g.x0 + sign * ((g.wFootHeel || g.wInnerAnkle) - 2.2);
      const outAnX = g.x0 + sign * (g.wOuterAnkle + 2.0);
      const outToeX = g.x0 + sign * (g.wFootTip + 2.5);
      const shoeCurve = [
        [inAnX, topShoeY],
        [outAnX, topShoeY],
        ...evalCubicBezier(
          [outAnX, topShoeY],
          [outAnX + sign * 1.5, g.yAnkles + 6.0],
          [outToeX + sign * 1.2, yFt - 3.0],
          [outToeX, yFt + 1.5],
          10
        ),
        ...evalCubicBezier(
          [outToeX, yFt + 1.5],
          [(inFtX + outToeX) * 0.5, yFt + 2.8],
          [(inFtX + outToeX) * 0.5, yFt + 2.8],
          [inFtX, yFt + 1.5],
          10
        ),
      ];
      fillPolygonList([shoeCurve], baseRgb, seamRgb, 2);
    }
  } else {
    // 'top'
    const isShortSleeve = /\b(t-shirt|tee|polo|short\s*sleeve|tank)\b/i.test(text);
    const isLongline = /\b(tunic|kurta|longline)\b/i.test(text);
    const hemY = isLongline ? g.yCrotch + 26.0 : g.yHip + 3.0;
    const polys = buildTorsoAndSleevesPolys({
      hemY,
      easeSh: 2.0,
      easeCh: 2.4,
      easeWa: isLongline ? 4.5 : 2.2,
      easeHip: 2.4,
      easeHem: isLongline ? 5.0 : 2.4,
      sleeveEndY: isShortSleeve ? g.yElbow - 4.0 : g.yWrist,
      cuffWidth: 9.5,
      neckDepth: 3.0,
    });
    fillPolygonList(polys, baseRgb, seamRgb, 2);
    const wCollar = Math.max(6.0, g.wNeck - 0.5);
    strokeLine(
      [
        [g.x0 - wCollar - 0.4, g.yChin - 0.3],
        [g.x0, g.yChin + 3.2],
        [g.x0 + wCollar + 0.4, g.yChin - 0.3],
      ],
      trimRgb,
      4
    );
  }

  // Blend central fabric patch from `sourceImg` + cylindrical 3D shading where alpha > 0
  try {
    const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const data = imgData.data;

    let patchData = null;
    if (sourceImg && (sourceImg.naturalWidth || sourceImg.width) > 32) {
      try {
        const sw = sourceImg.naturalWidth || sourceImg.width;
        const sh = sourceImg.naturalHeight || sourceImg.height;
        const pCanvas = document.createElement('canvas');
        pCanvas.width = CANVAS_W;
        pCanvas.height = CANVAS_H;
        const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
        pCtx.drawImage(
          sourceImg,
          Math.floor(sw * 0.28),
          Math.floor(sh * 0.32),
          Math.max(1, Math.floor(sw * 0.44)),
          Math.max(1, Math.floor(sh * 0.40)),
          0,
          0,
          CANVAS_W,
          CANVAS_H
        );
        patchData = pCtx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
      } catch {
        patchData = null;
      }
    }

    for (let y = 0; y < CANVAS_H; y++) {
      const rowOff = y * CANVAS_W;
      for (let x = 0; x < CANVAS_W; x++) {
        const idx = (rowOff + x) * 4;
        const a = data[idx + 3];
        if (a <= 10) continue;
        const normX = (x - CANVAS_W * 0.5) / (CANVAS_W * 0.24);
        const shade =
          1.0 +
          0.11 * Math.exp(-Math.pow((normX + 0.28) / 0.42, 2)) -
          0.16 * Math.min(1.2, Math.pow(Math.abs(normX), 1.65));

        let r = data[idx] * shade;
        let gr = data[idx + 1] * shade;
        let b = data[idx + 2] * shade;

        if (patchData) {
          r = r * 0.82 + patchData[idx] * 0.18;
          gr = gr * 0.82 + patchData[idx + 1] * 0.18;
          b = b * 0.82 + patchData[idx + 2] * 0.18;
        }

        data[idx] = Math.max(0, Math.min(255, Math.round(r)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(gr)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Ignore getImageData errors in restricted environments
  }

  return outCanvas;
}

/**
 * Crops a `400 x 900` Default Avatar canvas to its opaque bounding box and computes
 * `{ croppedCanvas, default_viewbox, point_cloud }` identical in format to
 * `scripts/fit_onboarding_garments_to_avatar.py`.
 */
function finalizeDefaultCanvasFit(fullCanvas400x900, sex = 'female', roleKey = 'top') {
  if (!fullCanvas400x900) return null;
  const ctx = fullCanvas400x900.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  } catch {
    return null;
  }
  const data = imgData.data;
  let minX = CANVAS_W;
  let minY = CANVAS_H;
  let maxX = 0;
  let maxY = 0;
  let hasOpaque = false;

  for (let y = 0; y < CANVAS_H; y++) {
    const rowOff = y * CANVAS_W;
    for (let x = 0; x < CANVAS_W; x++) {
      if (data[(rowOff + x) * 4 + 3] > 12) {
        hasOpaque = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasOpaque) return null;

  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(CANVAS_W - 1, maxX + pad);
  maxY = Math.min(CANVAS_H - 1, maxY + pad);

  const cw = Math.max(1, maxX - minX + 1);
  const ch = Math.max(1, maxY - minY + 1);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cw;
  croppedCanvas.height = ch;
  const cropCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
  cropCtx.drawImage(fullCanvas400x900, minX, minY, cw, ch, 0, 0, cw, ch);

  const croppedData = cropCtx.getImageData(0, 0, cw, ch).data;
  const alphaCrop = new Uint8ClampedArray(cw * ch);
  for (let i = 0; i < cw * ch; i++) {
    alphaCrop[i] = croppedData[i * 4 + 3];
  }

  const defaultViewbox = {
    x: Number((minX / SCALE).toFixed(2)),
    y: Number((minY / SCALE).toFixed(2)),
    width: Number((cw / SCALE).toFixed(2)),
    height: Number((ch / SCALE).toFixed(2)),
  };

  const pointCloud = buildPointCloudMeshFromAlpha(alphaCrop, cw, ch, defaultViewbox, sex, roleKey);

  return {
    croppedCanvas,
    default_viewbox: defaultViewbox,
    point_cloud: pointCloud,
  };
}

/**
 * Main entry point: Given any closet garment and loaded `HTMLImageElement` (optional),
 * fits the garment to the Default Avatar using the Hybrid Two-Tier Engine:
 *   - Tier 1: Real-Photo Alpha-Contour Warping onto Default Avatar anatomy
 *   - Tier 2: Cubic-Bezier Silhouette + Real Fabric Texture Reconstruction
 *
 * Returns `{ imageSource, avatarFit }` ready for `FittedGarmentLayer` & `PointCloudMeshOverlay`.
 */
export function fitClosetGarmentToDefaultAvatar(garment, loadedImg, roleKey = 'top', sex = 'female') {
  if (!garment || typeof document === 'undefined') return null;

  // Accessories (headwear, glasses, earrings, scarf, belt, watch, gloves, bag) use landmark overlays
  if (!['top', 'bottom', 'dress', 'full_body', 'outerwear', 'shoes'].includes(roleKey)) {
    return null;
  }

  const hasLoadedImg = Boolean(loadedImg && (loadedImg.naturalWidth || loadedImg.width) > 16);
  const cacheKey = `v4::${sex}::${roleKey}::img:${hasLoadedImg ? 1 : 0}::${garment.id || ''}::${garment.url || ''}::${garment.category || ''}::${garment.sub_category || ''}::${garment.color || ''}`;
  if (fittedClosetGarmentCache.has(cacheKey)) {
    return fittedClosetGarmentCache.get(cacheKey);
  }

  let fitMode = 'bezier_reconstructed';
  let fullCanvas400x900 = null;

  if (hasLoadedImg) {
    try {
      const w = loadedImg.naturalWidth || loadedImg.width;
      const h = loadedImg.naturalHeight || loadedImg.height;
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (srcCtx) {
        srcCtx.drawImage(loadedImg, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, w, h).data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let hasOpaque = false;
        for (let y = 0; y < h; y++) {
          const rowOff = y * w;
          for (let x = 0; x < w; x++) {
            const pIdx = (rowOff + x) * 4;
            const a = srcData[pIdx + 3];
            if (a > 35) {
              hasOpaque = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (hasOpaque) {
          const cropW = Math.max(1, maxX - minX + 1);
          const cropH = Math.max(1, maxY - minY + 1);
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
          cropCtx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

          const cropImageData = cropCtx.getImageData(0, 0, cropW, cropH);
          const cropData = cropImageData.data;
          const croppedAlpha = new Uint8ClampedArray(cropW * cropH);
          let modifiedFringe = false;
          for (let i = 0; i < cropW * cropH; i++) {
            const p = i * 4;
            let a = cropData[p + 3];
            // Strip faint translucent white/gray matting fringe (e.g. between trouser legs)
            if (a > 0 && a < 95 && cropData[p] > 215 && cropData[p + 1] > 215 && cropData[p + 2] > 215) {
              a = 0;
              cropData[p + 3] = 0;
              modifiedFringe = true;
            }
            croppedAlpha[i] = a;
          }
          if (modifiedFringe) {
            cropCtx.putImageData(cropImageData, 0, 0);
          }

          const quality = assessPhotoContourQuality(croppedAlpha, cropW, cropH, roleKey);
          if (quality.canWarpPhoto) {
            fullCanvas400x900 = warpRealGarmentPhotoToDefaultCanvas(
              cropCanvas,
              croppedAlpha,
              cropW,
              cropH,
              garment,
              roleKey,
              sex
            );
            if (fullCanvas400x900) {
              fitMode = 'photo_contour';
            }
          }
        }
      }
    } catch {
      // Canvas tainted by CORS or unsupported in test runner -> fall back to Tier 2 Bezier Reconstruction
      fullCanvas400x900 = null;
    }
  }

  if (!fullCanvas400x900) {
    fullCanvas400x900 = renderProceduralBezierFittedGarment(garment, roleKey, sex, loadedImg);
    fitMode = 'bezier_reconstructed';
  }

  const finalized = finalizeDefaultCanvasFit(fullCanvas400x900, sex, roleKey);
  if (!finalized) {
    // Fallback metadata when running in headless test environments without 2D canvas pixel readback
    const env = getGarmentAnatomicalEnvelope(garment, roleKey, sex);
    const fallbackHalfW = env.halfWidthAtY(0.5 * (env.yTop0 + env.yBot0));
    const fallbackVb = {
      x: Number((100 - fallbackHalfW).toFixed(2)),
      y: Number(env.yTop0.toFixed(2)),
      width: Number((fallbackHalfW * 2).toFixed(2)),
      height: Number(Math.max(10, env.yBot0 - env.yTop0).toFixed(2)),
    };
    const fallbackRes = {
      imageSource: loadedImg || null,
      avatarFit: {
        fitted_to_default_avatar: true,
        default_sex: sex,
        fit_mode: fitMode,
        default_viewbox: fallbackVb,
        point_cloud: buildPointCloudMeshFromAlpha(null, 0, 0, fallbackVb, sex, roleKey),
      },
    };
    fittedClosetGarmentCache.set(cacheKey, fallbackRes);
    return fallbackRes;
  }

  const result = {
    imageSource: finalized.croppedCanvas,
    avatarFit: {
      fitted_to_default_avatar: true,
      default_sex: sex,
      fit_mode: fitMode,
      default_viewbox: finalized.default_viewbox,
      point_cloud: finalized.point_cloud,
    },
  };

  fittedClosetGarmentCache.set(cacheKey, result);
  return result;
}

const bodyPhotoAnatomyCache = new Map();

/**
 * Extracts a full `0 0 200 450` anatomical landmark table (`yHeadTop`, `yChin`,
 * `yShoulders`, `yChest`, `yWaist`, `yHip`, `yCrotch`, `yKnees`, `yAnkles`, `yFeet`,
 * `wNeck`, `wShoulders`, `wChest`, `wWaist`, `wHip`, `wOuterKnee`, `wOuterAnkle`,
 * `wFootTip`, and per-Y spine centerline `centerXAtY(y)`) directly from a user's
 * real full-body photo (`HTMLImageElement`, `HTMLCanvasElement`, or `{ data, width, height }`
 * RGBA buffer), calibrated with `baseAnatomy` (user's measurements/sliders).
 */
export function extractBodyPhotoAnatomy(
  imgOrImageData,
  baseAnatomy = null,
  sex = 'female'
) {
  const fallback = baseAnatomy || getDefaultAvatarAnatomy(sex);
  if (!imgOrImageData) return fallback;

  const cacheSrcKey =
    typeof imgOrImageData.src === 'string' && imgOrImageData.src
      ? `${imgOrImageData.src}::${sex}::${Math.round(fallback.yShoulders || 85)}_${Math.round(fallback.wShoulders || 36)}_${Math.round(fallback.wWaist || 24)}_${Math.round(fallback.wHip || 36)}`
      : null;

  if (cacheSrcKey && bodyPhotoAnatomyCache.has(cacheSrcKey)) {
    return bodyPhotoAnatomyCache.get(cacheSrcKey);
  }

  const W = 200;
  const H = 450;
  let rgba = null;
  let drawX0 = 0;
  let drawY0 = 0;
  let drawW = W;
  let drawH = H;

  try {
    if (
      imgOrImageData.data &&
      Number.isFinite(imgOrImageData.width) &&
      Number.isFinite(imgOrImageData.height)
    ) {
      const srcW = Math.max(1, imgOrImageData.width);
      const srcH = Math.max(1, imgOrImageData.height);
      const srcData = imgOrImageData.data;
      const scale = Math.min(W / srcW, H / srcH);
      drawW = srcW * scale;
      drawH = srcH * scale;
      drawX0 = (W - drawW) * 0.5;
      drawY0 = (H - drawH) * 0.5;

      rgba = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        const sy = Math.floor((y - drawY0) / scale);
        if (sy < 0 || sy >= srcH) continue;
        for (let x = 0; x < W; x++) {
          const sx = Math.floor((x - drawX0) / scale);
          if (sx < 0 || sx >= srcW) continue;
          const sIdx = (sy * srcW + sx) * 4;
          const dIdx = (y * W + x) * 4;
          rgba[dIdx] = srcData[sIdx];
          rgba[dIdx + 1] = srcData[sIdx + 1];
          rgba[dIdx + 2] = srcData[sIdx + 2];
          rgba[dIdx + 3] = srcData[sIdx + 3];
        }
      }
    } else if (typeof document !== 'undefined') {
      const srcW = imgOrImageData.naturalWidth || imgOrImageData.width || 0;
      const srcH = imgOrImageData.naturalHeight || imgOrImageData.height || 0;
      if (srcW < 16 || srcH < 16) return fallback;

      const scale = Math.min(W / srcW, H / srcH);
      drawW = srcW * scale;
      drawH = srcH * scale;
      drawX0 = (W - drawW) * 0.5;
      drawY0 = (H - drawH) * 0.5;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return fallback;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(imgOrImageData, drawX0, drawY0, drawW, drawH);
      rgba = ctx.getImageData(0, 0, W, H).data;
    }
  } catch {
    return fallback;
  }

  if (!rgba) return fallback;

  const ix0 = Math.max(0, Math.floor(drawX0));
  const ix1 = Math.min(W - 1, Math.ceil(drawX0 + drawW) - 1);
  const iy0 = Math.max(0, Math.floor(drawY0));
  const iy1 = Math.min(H - 1, Math.ceil(drawY0 + drawH) - 1);
  if (ix1 - ix0 < 20 || iy1 - iy0 < 60) return fallback;

  // Determine whether the photo within [ix0..ix1, iy0..iy1] has an alpha cutout or solid background
  let borderCount = 0;
  let borderTransparent = 0;
  const bgSamples = [];

  for (let x = ix0; x <= ix1; x += 2) {
    const topIdx = (iy0 * W + x) * 4;
    const botIdx = (iy1 * W + x) * 4;
    borderCount += 2;
    if (rgba[topIdx + 3] <= 35) borderTransparent++;
    else bgSamples.push([rgba[topIdx], rgba[topIdx + 1], rgba[topIdx + 2]]);
    if (rgba[botIdx + 3] <= 35) borderTransparent++;
  }
  for (let y = iy0; y <= iy1; y += 3) {
    const leftIdx = (y * W + ix0) * 4;
    const rightIdx = (y * W + ix1) * 4;
    borderCount += 2;
    if (rgba[leftIdx + 3] <= 35) borderTransparent++;
    else bgSamples.push([rgba[leftIdx], rgba[leftIdx + 1], rgba[leftIdx + 2]]);
    if (rgba[rightIdx + 3] <= 35) borderTransparent++;
    else bgSamples.push([rgba[rightIdx], rgba[rightIdx + 1], rgba[rightIdx + 2]]);
  }

  const useAlphaMask = borderCount > 0 && borderTransparent / borderCount >= 0.12;
  let bgR = 245;
  let bgG = 245;
  let bgB = 245;
  if (!useAlphaMask && bgSamples.length > 0) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let i = 0; i < bgSamples.length; i++) {
      sr += bgSamples[i][0];
      sg += bgSamples[i][1];
      sb += bgSamples[i][2];
    }
    bgR = sr / bgSamples.length;
    bgG = sg / bgSamples.length;
    bgB = sb / bgSamples.length;
  }

  const isForeground = (x, y) => {
    if (x < ix0 || x > ix1 || y < iy0 || y > iy1) return false;
    const idx = (y * W + x) * 4;
    const a = rgba[idx + 3];
    if (a <= 35) return false;
    if (useAlphaMask) return true;
    const dr = rgba[idx] - bgR;
    const dg = rgba[idx + 1] - bgG;
    const db = rgba[idx + 2] - bgB;
    return Math.hypot(dr, dg, db) > 26;
  };

  const rowHasFg = new Uint8Array(H);
  const outerHalfW = new Float64Array(H);
  const coreHalfW = new Float64Array(H);
  const rowCenterX = new Float64Array(H);
  rowCenterX.fill(100);

  let yHeadTop = -1;
  let yFeet = -1;

  for (let y = iy0; y <= iy1; y++) {
    let minX = -1;
    let maxX = -1;
    let count = 0;
    let sumX = 0;
    for (let x = ix0; x <= ix1; x++) {
      if (isForeground(x, y)) {
        if (minX === -1) minX = x;
        maxX = x;
        count++;
        sumX += x;
      }
    }
    if (count >= 3 && maxX - minX >= 4) {
      rowHasFg[y] = 1;
      if (yHeadTop === -1) yHeadTop = y;
      yFeet = y;
      const cx = sumX / count;
      rowCenterX[y] = Math.max(82, Math.min(118, cx));
      outerHalfW[y] = (maxX - minX) * 0.5;

      // Scan outward from row center to find contiguous torso core (ignoring separated arms)
      const startX = Math.round(cx);
      let coreL = startX;
      let gapL = 0;
      for (let x = startX; x >= minX; x--) {
        if (isForeground(x, y)) {
          coreL = x;
          gapL = 0;
        } else {
          gapL++;
          if (gapL >= 3) break;
        }
      }
      let coreR = startX;
      let gapR = 0;
      for (let x = startX; x <= maxX; x++) {
        if (isForeground(x, y)) {
          coreR = x;
          gapR = 0;
        } else {
          gapR++;
          if (gapR >= 3) break;
        }
      }
      const detectedCore = (coreR - coreL) * 0.5;
      coreHalfW[y] = detectedCore >= 4 ? detectedCore : outerHalfW[y];
    }
  }

  const bodyH = yFeet - yHeadTop;
  if (yHeadTop === -1 || bodyH < 160) {
    return fallback;
  }

  // Smooth row arrays with 7-tap moving average
  const smoothOuterW = new Float64Array(H);
  const smoothCoreW = new Float64Array(H);
  const smoothCenterX = new Float64Array(H);
  smoothCenterX.fill(100);

  for (let y = 0; y < H; y++) {
    let sOut = 0;
    let sCore = 0;
    let sCx = 0;
    let n = 0;
    for (let dy = -4; dy <= 4; dy++) {
      const yy = Math.max(yHeadTop, Math.min(yFeet, y + dy));
      if (rowHasFg[yy]) {
        sOut += outerHalfW[yy];
        sCore += coreHalfW[yy];
        sCx += rowCenterX[yy];
        n++;
      }
    }
    if (n > 0) {
      smoothOuterW[y] = sOut / n;
      smoothCoreW[y] = sCore / n;
      smoothCenterX[y] = sCx / n;
    }
  }

  const isMale = Boolean(fallback.isMale ?? String(sex).toLowerCase() === 'male');

  // 1. Neck / Chin (`yChin`, `wNeck`): local width minimum between 10% and 17% of body height
  const neckY0 = Math.round(yHeadTop + bodyH * 0.10);
  const neckY1 = Math.round(yHeadTop + bodyH * 0.17);
  let yChin = Math.round(yHeadTop + bodyH / 7.3);
  let minNeckW = Infinity;
  for (let y = neckY0; y <= neckY1; y++) {
    if (smoothCoreW[y] > 3 && smoothCoreW[y] < minNeckW) {
      minNeckW = smoothCoreW[y];
      yChin = y;
    }
  }
  const rawNeckW = Number.isFinite(minNeckW) ? minNeckW : fallback.wNeck;
  const wNeck = Math.max(6.5, Math.min(18.5, rawNeckW * 0.72 + fallback.wNeck * 0.28));

  // 2. Shoulders (`yShoulders`, `wShoulders`): upper-torso shoulder flare below yChin
  const shY0 = Math.max(yChin + 5, Math.round(yHeadTop + bodyH * 0.155));
  const shY1 = Math.max(shY0 + 4, Math.round(yHeadTop + bodyH * 0.22));
  let yShoulders = Math.round(yChin + bodyH * 0.032);
  let maxShW = 0;
  for (let y = shY0; y <= shY1; y++) {
    if (smoothOuterW[y] > maxShW) {
      maxShW = smoothOuterW[y];
      yShoulders = y;
    }
  }
  // Keep yShoulders snug to collar base so necklines stay natural
  yShoulders = Math.min(yShoulders, Math.round(yChin + bodyH * 0.045));
  const detectedShW = maxShW > 12 ? maxShW * 0.92 : fallback.wShoulders;
  const wShoulders = Math.max(
    22,
    Math.min(62, detectedShW * 0.72 + fallback.wShoulders * 0.28)
  );

  // 3. Ankles, Feet & Crotch
  const yAnkles = Math.round(yFeet - Math.max(12, bodyH * 0.048));
  const yCrotch = Math.round(yHeadTop + bodyH * (isMale ? 0.535 : 0.525));
  const torsoH = Math.max(40, yCrotch - yShoulders);

  // 4. Chest, Waist, Hips
  const yChest = Math.round(yShoulders + torsoH * (isMale ? 0.30 : 0.26));
  const waistY0 = Math.round(yShoulders + torsoH * 0.48);
  const waistY1 = Math.round(yShoulders + torsoH * 0.70);
  let yWaist = Math.round(yShoulders + torsoH * (isMale ? 0.62 : 0.58));
  let minWaistW = Infinity;
  for (let y = waistY0; y <= waistY1; y++) {
    const candidateW = Math.min(smoothCoreW[y], smoothOuterW[y] * 0.80);
    if (candidateW > 8 && candidateW < minWaistW) {
      minWaistW = candidateW;
      yWaist = y;
    }
  }

  const hipY0 = Math.max(yWaist + 6, Math.round(yShoulders + torsoH * 0.76));
  const hipY1 = Math.max(hipY0 + 4, Math.round(yShoulders + torsoH * 0.96));
  let yHip = Math.round(yShoulders + torsoH * 0.88);
  let maxHipW = 0;
  for (let y = hipY0; y <= hipY1; y++) {
    const candidateW = Math.min(smoothCoreW[y], smoothOuterW[y] * 0.88);
    if (candidateW > maxHipW) {
      maxHipW = candidateW;
      yHip = y;
    }
  }

  const inseamSvg = Math.max(40, yFeet - yCrotch);
  const yKnees = Math.round(yCrotch + inseamSvg * 0.48);

  const rawChestW = Math.min(smoothCoreW[yChest], smoothOuterW[yChest] * 0.84) || fallback.wChest;
  const rawWaistW = Number.isFinite(minWaistW) ? minWaistW : fallback.wWaist;
  const rawHipW = maxHipW > 10 ? maxHipW : fallback.wHip;
  const rawKneeW = smoothOuterW[yKnees] > 8 ? smoothOuterW[yKnees] : fallback.wOuterKnee;
  const rawAnkleW = smoothOuterW[yAnkles] > 6 ? smoothOuterW[yAnkles] : fallback.wOuterAnkle;
  const rawFootW = smoothOuterW[Math.min(H - 1, yAnkles + 6)] > 6
    ? smoothOuterW[Math.min(H - 1, yAnkles + 6)]
    : fallback.wFootTip;

  const wChest = Math.max(18, Math.min(58, rawChestW * 0.68 + fallback.wChest * 0.32));
  const wWaist = Math.max(15, Math.min(54, rawWaistW * 0.68 + fallback.wWaist * 0.32));
  const wHip = Math.max(20, Math.min(62, rawHipW * 0.70 + fallback.wHip * 0.30));
  const wOuterKnee = Math.max(12, Math.min(42, rawKneeW * 0.65 + fallback.wOuterKnee * 0.35));
  const wOuterAnkle = Math.max(10, Math.min(34, rawAnkleW * 0.65 + fallback.wOuterAnkle * 0.35));
  const wFootTip = Math.max(12, Math.min(38, rawFootW * 0.65 + fallback.wFootTip * 0.35));

  const centerXAtY = (y) => {
    const idx = Math.max(0, Math.min(H - 1, Math.round(Number(y) || 0)));
    return smoothCenterX[idx] || 100;
  };

  const photoAnatomy = {
    ...fallback,
    X0: centerXAtY(yWaist),
    viewBoxHeight: H,
    isMale,
    isPhotoExtracted: true,
    yHeadTop,
    yChin,
    yShoulders,
    yChest,
    yWaist,
    yHip,
    yCrotch,
    yKnees,
    yAnkles,
    yFeet,
    wNeck,
    wShoulders,
    wChest,
    wWaist,
    wHip,
    wOuterKnee,
    wOuterAnkle,
    wFootTip,
    shoulderYPercent: (yShoulders / H) * 100,
    shoulderWidthPercent: ((wShoulders * 4) / H) * 100,
    centerXAtY,
  };

  if (cacheSrcKey) {
    bodyPhotoAnatomyCache.set(cacheSrcKey, photoAnatomy);
  }
  return photoAnatomy;
}

