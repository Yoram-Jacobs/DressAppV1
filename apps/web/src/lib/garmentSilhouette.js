import * as THREE from 'three';

/**
 * Silhouette-driven garment shells
 * --------------------------------
 * Instead of wrapping a photo around a generic cylinder (which discards sleeves,
 * pant legs and every other part of the real silhouette) the garment is rebuilt
 * from its own cut-out:
 *
 *   ? The alpha channel of the (background-removed) photo is scanned row by row.
 *   ? Every grid row is split into horizontal runs (torso, each sleeve, each leg)
 *     with sub-cell accurate left/right ends, so the shell meets the photographed
 *     outline exactly (no staircase edges).
 *   ? Each run is inflated into an elliptical cross-section whose depth follows the
 *     avatar's body profile (torso slice / leg slice), so the garment keeps the
 *     photographed silhouette AND hugs the avatar's point cloud.
 *   ? Strict Anatomical Anchors:
 *       - Tops, outerwear, and full-body dresses (except strapless) are strictly
 *         anchored to the avatar's shoulder contour (cannot go lower or higher).
 *       - Bottoms are anchored to the waist and to the crotch (pants leg split
 *         can never go higher than the crotch line).
 *   ? A front sheet carries the front photo; a back sheet carries the back photo of
 *     the item group when available (otherwise a clean detail-damped back synthesis).
 *
 * The functions here are pure (no DOM / canvas) so they can be unit-tested.
 * A "run" is [a, b]: left / right boundary of fabric in grid-column units.
 */

/** Chooses a grid resolution that gives roughly square cells. */
export function chooseGridResolution(aspect, ny = 104) {
  const nx = Math.max(28, Math.min(112, Math.round(ny * aspect)));
  return { nx, ny };
}

/** Converts a (nx+1)x(ny+1) vertex mask into integer runs (cell-centred boundaries). */
export function rowRuns(mask, nx, j, minLen = 2) {
  const vw = nx + 1;
  const runs = [];
  let s = -1;
  for (let i = 0; i <= vw; i++) {
    const on = i < vw && mask[j * vw + i] === 1;
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      const e = i - 1;
      if (e - s + 1 >= minLen) runs.push([s - 0.5, e + 0.5]);
      s = -1;
    }
  }
  return runs;
}

/** Downsamples an alpha channel to a (nx+1) x (ny+1) vertex mask. */
export function resampleAlphaMask(alpha, w, h, nx, ny, threshold = 110) {
  const vw = nx + 1;
  const vh = ny + 1;
  const out = new Uint8Array(vw * vh);
  for (let j = 0; j < vh; j++) {
    const y = Math.min(h - 1, Math.max(0, Math.round((j / ny) * (h - 1))));
    for (let i = 0; i < vw; i++) {
      const x = Math.min(w - 1, Math.max(0, Math.round((i / nx) * (w - 1))));
      out[j * vw + i] = alpha[y * w + x] >= threshold ? 1 : 0;
    }
  }
  return out;
}

/**
 * Sub-cell accurate runs of fabric for every grid row, measured on the full
 * resolution alpha channel. Returns runsByRow[j] = [[a, b], ...] in grid columns.
 */
export function extractRowRuns(alpha, w, h, nx, ny, threshold = 110) {
  const runsByRow = [];
  const minRunPx = Math.max(2, (w / nx) * 1.4);
  for (let j = 0; j <= ny; j++) {
    const y = Math.min(h - 1, Math.max(0, Math.round((j / ny) * (h - 1))));
    const row = y * w;
    const px = [];
    let s = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && alpha[row + x] >= threshold;
      if (on && s < 0) s = x;
      if (!on && s >= 0) {
        px.push([s, x - 1]);
        s = -1;
      }
    }
    // Merge runs separated by tiny anti-aliasing pinholes (<= 1.2% width)
    // without merging the top of the pant crotch split!
    const merged = [];
    px.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] <= Math.max(2, w * 0.012)) last[1] = r[1];
      else merged.push([r[0], r[1]]);
    });
    let rowGridRuns = merged
      .filter(([x0, x1]) => x1 - x0 + 1 >= minRunPx)
      .map(([x0, x1]) => [
        clamp((x0 / (w - 1)) * nx, 0, nx),
        clamp(((x1 + 1) / (w - 1)) * nx, 0, nx),
      ]);
    if (rowGridRuns.length > 1) {
      const maxRunW = Math.max(...rowGridRuns.map(([a, b]) => b - a));
      if (maxRunW >= 0.25 * nx) {
        rowGridRuns = rowGridRuns.filter(([a, b]) => (b - a) >= Math.max(2.0, 0.05 * nx));
      }
    }
    runsByRow.push(rowGridRuns);
  }

  // Vertical bridge across dropped interior rows (e.g. horizontal creases, graphics, or alpha dropouts)
  let firstFabric = 0;
  while (firstFabric <= ny && (!runsByRow[firstFabric] || !runsByRow[firstFabric].length)) firstFabric++;
  let lastFabric = ny;
  while (lastFabric >= 0 && (!runsByRow[lastFabric] || !runsByRow[lastFabric].length)) lastFabric--;

  for (let j = firstFabric + 1; j < lastFabric; j++) {
    if (!runsByRow[j] || runsByRow[j].length === 0) {
      let prevJ = j - 1;
      while (prevJ >= firstFabric && (!runsByRow[prevJ] || !runsByRow[prevJ].length)) prevJ--;
      let nextJ = j + 1;
      while (nextJ <= lastFabric && (!runsByRow[nextJ] || !runsByRow[nextJ].length)) nextJ++;

      if (prevJ >= firstFabric && nextJ <= lastFabric && (nextJ - prevJ) <= 6) {
        const t = (j - prevJ) / (nextJ - prevJ);
        const prevRuns = runsByRow[prevJ];
        const nextRuns = runsByRow[nextJ];
        if (prevRuns.length === nextRuns.length) {
          runsByRow[j] = prevRuns.map((r, k) => [
            r[0] * (1 - t) + nextRuns[k][0] * t,
            r[1] * (1 - t) + nextRuns[k][1] * t,
          ]);
        } else {
          const minA = Math.min(...prevRuns.map((r) => r[0])) * (1 - t) + Math.min(...nextRuns.map((r) => r[0])) * t;
          const maxB = Math.max(...prevRuns.map((r) => r[1])) * (1 - t) + Math.max(...nextRuns.map((r) => r[1])) * t;
          runsByRow[j] = [[minA, maxB]];
        }
      }
    }
  }

  return runsByRow;
}

function percentile(values, p) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep01(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Exact anatomical shoulder ridge height Y(x) measured from the male and female
 * 3D avatar meshes across the trapezius/clavicle/acromion span.
 * Follows natural human shoulder slope without robotic step-ledges or flat shelves.
 */
export function getAvatarShoulderRidgeY(absX, isMale = false) {
  const ax = Math.max(0, Number(absX) || 0);
  if (isMale) {
    if (ax <= 0.068) return 1.535;
    if (ax >= 0.220) {
      // Natural deltoid downward curvature beyond acromion tip
      const t = Math.min(1.0, (ax - 0.220) / 0.05);
      return 1.470 - 0.065 * t * t;
    }
    // Smooth anatomical slope across trapezius & clavicle (concave-to-convex S-curve)
    const t = (ax - 0.068) / (0.220 - 0.068);
    return 1.535 - 0.065 * (t * 0.90 + 0.10 * smoothstep01(t));
  }
  if (ax <= 0.058) return 1.435;
  if (ax >= 0.198) {
    // Natural deltoid downward curvature beyond acromion tip
    const t = Math.min(1.0, (ax - 0.198) / 0.05);
    return 1.375 - 0.060 * t * t;
  }
  const t = (ax - 0.058) / (0.198 - 0.058);
  return 1.435 - 0.060 * (t * 0.90 + 0.10 * smoothstep01(t));
}

/**
 * Piecewise linear interpolation across anatomical depth & contour profiles.
 */
export function resolveBottomLength({
  garment = null,
  garmentText = '',
  aspect = 0.55,
  isMale = false,
  isSkirt = false,
} = {}) {
  const g = garment || {};
  const metaText = `${g.length || ''} ${g.bottom_length || ''} ${g.item_length || ''} ${g.metadata?.length || ''} ${garmentText}`.toLowerCase();

  if (isSkirt) {
    const isMini = /\b(mini|micro|????|????)\b/i.test(metaText);
    const isMaxi = /\b(maxi|gown|long|?????|????)\b/i.test(metaText);
    if (isMini) return { lengthType: 'mini_skirt', yBottom: isMale ? 0.76 : 0.72 };
    if (isMaxi) return { lengthType: 'maxi_skirt', yBottom: isMale ? 0.16 : 0.12 };
    return { lengthType: 'midi_skirt', yBottom: isMale ? 0.48 : 0.44 };
  }

  // Bottoms (pants, shorts, culottes, etc.)
  // 1. Explicit keywords in metadata or title
  // Note: Hebrew characters are non-ASCII (\w is ASCII-only in standard JS regex), so use unicode boundaries
  const isMiniShorts = /(?:^|[^\p{L}\p{N}])(hot\s*pants|micro\s*short|mini\s*short|?????|??????|???????|brief|thong|bikini)(?:$|[^\p{L}\p{N}])/iu.test(metaText);
  const isBermudaOrKnee = /(?:^|[^\p{L}\p{N}])(bermuda|knee|knee-high|knee_length|knee-length|??????|?? ????|???)(?:$|[^\p{L}\p{N}])/iu.test(metaText);
  const isShortsText = /(?:^|[^\p{L}\p{N}])(short|shorts|trunk|trunks|boxer|boxers|swim_short|????|?????|?????|???|????? ??|?????_??|?????)(?:$|[^\p{L}\p{N}])/iu.test(metaText);
  const isCapriOr78 = /(?:^|[^\p{L}\p{N}])(capri|cropped|culotte|culottes|3\/4|7\/8|seven_eighths|????|??? ???????|????? ????|???_???????|ankle\s*pant)(?:$|[^\p{L}\p{N}])/iu.test(metaText);
  // Full-length pants keywords: e.g. "pants", "trousers", "chinos", "jeans", "slacks", "sweatpants", "???????", "????", "???\"?"
  const isFullPantsExplicit = /(?:^|[^\p{L}\p{N}])(pants|pant|trousers|trouser|chinos?|jeans?|slacks|sweatpants|joggers?|pantalon|pantaloni|cal?a|calca|hose|????(?:???|?)?|???['?"]??)(?:$|[^\p{L}\p{N}])/iu.test(metaText);

  let lengthType = 'full';
  if (isMiniShorts) {
    lengthType = 'mini_shorts';
  } else if (isBermudaOrKnee) {
    lengthType = 'bermuda';
  } else if (isShortsText) {
    // If aspect is tall (< 0.75), might be longer bermuda, otherwise standard shorts
    lengthType = aspect < 0.88 ? 'bermuda' : 'shorts';
  } else if (isCapriOr78) {
    lengthType = 'capri';
  } else if (isFullPantsExplicit) {
    // Explicit pants/trousers/chinos must stay full-length even if the cutout photo has spread legs or wide framing!
    lengthType = 'full';
  } else {
    // Physical cutout aspect ratio fallback (only when no explicit pants/shorts keywords exist):
    // Full trousers: aspect ~ 0.35..0.58
    // Capri / 7/8: aspect ~ 0.58..0.72
    // Bermuda / Knee-length: aspect ~ 0.72..0.90
    // Shorts: aspect >= 0.90
    if (aspect >= 1.05) {
      lengthType = 'shorts';
    } else if (aspect >= 0.72) {
      lengthType = 'bermuda';
    } else if (aspect >= 0.58) {
      lengthType = 'capri';
    } else {
      lengthType = 'full';
    }
  }

  const yBottomMap = {
    mini_shorts: isMale ? 0.72 : 0.68,
    shorts: isMale ? 0.60 : 0.56,
    bermuda: isMale ? 0.48 : 0.44, // Right at / just around knee (e.g. cargo shorts)
    capri: isMale ? 0.32 : 0.28,   // 7/8 length / mid calf
    full: isMale ? 0.11 : 0.10,    // Ankle length
  };

  return { lengthType, yBottom: yBottomMap[lengthType] };
}

/**
 * Catalog photos show sleeves in all sorts of poses (arms raised, stretched out).
 * The avatar's arms hang down, so each sleeve is swung about the shoulder joint until
 * its cuff points along the avatar's arm. Torso vertices never move.
 * Operates in place on the vertex x / y arrays.
 */
export function retargetSleeves({ xs, ys, inside, vw, vh, isMale, layerOffset, getTorsoSlice }) {
  const yShoulder = isMale ? 1.48 : 1.42;
  const sh = getTorsoSlice(yShoulder, isMale);
  const pivotX = sh.rx * 0.92;
  const pivotY = yShoulder - 0.04;
  const target = isMale ? { x: 0.285, y: 0.95 } : { x: 0.26, y: 0.90 };
  const thetaTarget = Math.atan2(target.y - pivotY, target.x - pivotX);
  const applied = [];

  [-1, 1].forEach((side) => {
    let best = -1;
    let bestR = 0;
    for (let idx = 0; idx < vw * vh; idx++) {
      if (!inside[idx]) continue;
      const x = xs[idx] * side;
      const y = ys[idx];
      if (x <= 0 || y < 0.8) continue;
      const torso = getTorsoSlice(y, isMale);
      if (x <= torso.rx + layerOffset + 0.06) continue;
      const r = Math.hypot(x - pivotX, y - pivotY);
      if (r > bestR) {
        bestR = r;
        best = idx;
      }
    }
    if (best < 0 || bestR < 0.12) return;

    const thetaPhoto = Math.atan2(ys[best] - pivotY, xs[best] * side - pivotX);
    const phi = thetaTarget - thetaPhoto;
    if (Math.abs(phi) < 0.05 || Math.abs(phi) > 1.95) return;

    // For short sleeves (T-shirts with bestR < 0.24m):
    // Soften rotation angle so short sleeves drape naturally rather than shearing aggressively into sharp robotic angles
    const sleeveLengthFactor = clamp((bestR - 0.10) / 0.18, 0.35, 1.0);
    const effectivePhi = phi * sleeveLengthFactor;
    const cos = Math.cos(effectivePhi);
    const sin = Math.sin(effectivePhi);
    const yWrist = isMale ? 0.93 : 0.89;

    for (let idx = 0; idx < vw * vh; idx++) {
      const x = xs[idx] * side;
      const y = ys[idx];
      if (x <= 0 || y < 0.75) continue;
      const torso = getTorsoSlice(y, isMale);
      const r = Math.hypot(x - pivotX, y - pivotY);
      const w = smoothstep01((x - (torso.rx + layerOffset)) / 0.05) * smoothstep01(r / 0.08);
      if (w <= 0) continue;
      const dxp = x - pivotX;
      const dyp = y - pivotY;
      const nx2 = pivotX + dxp * cos - dyp * sin;
      let ny2 = pivotY + dxp * sin + dyp * cos;
      if (ny2 < yWrist) {
        ny2 = yWrist + (ny2 - yWrist) * 0.15;
      }
      xs[idx] = side * (x + (nx2 - x) * w);
      ys[idx] = y + (ny2 - y) * w;
    }
    applied.push({ side, phiDeg: (effectivePhi * 180) / Math.PI });
  });
  return applied;
}

/**
 * Detects the row index of the garment's shoulder line in the photographed silhouette.
 */
export function detectGarmentShoulderRow(runsByRow, nx, ny, dxUniform = 0.007) {
  if (!runsByRow || !runsByRow.length) return 0;
  const vh = ny + 1;
  const widths = new Float32Array(vh);
  for (let j = 0; j < vh; j++) {
    const runs = runsByRow[j];
    if (runs && runs.length) {
      let minA = Infinity;
      let maxB = -Infinity;
      for (let k = 0; k < runs.length; k++) {
        if (runs[k][0] < minA) minA = runs[k][0];
        if (runs[k][1] > maxB) maxB = runs[k][1];
      }
      widths[j] = Math.max(0, maxB - minA);
    }
  }

  const jStart = Math.floor(0.15 * ny);
  const jEnd = Math.floor(0.65 * ny);
  let wMax = 0;
  for (let j = jStart; j <= jEnd; j++) {
    if (widths[j] > wMax) wMax = widths[j];
  }
  if (wMax <= 0) return 0;

  let topMaxW = 0;
  const topRows = Math.max(1, Math.floor(0.08 * ny));
  for (let j = 0; j < topRows; j++) {
    if (widths[j] > topMaxW) topMaxW = widths[j];
  }
  const topWorldW = topMaxW * dxUniform;
  const topFrac = topMaxW / nx;
  const isNarrowHeadOrHanger = topWorldW <= 0.18 && topFrac <= 0.26;
  if (!isNarrowHeadOrHanger) {
    return 0;
  }

  const maxScan = Math.floor(0.55 * ny);
  for (let j = 0; j <= maxScan; j++) {
    if (widths[j] >= 0.68 * wMax) {
      return j;
    }
  }

  return 0;
}

/**
 * Builds the front and back sheets of a silhouette shell.
 */
export function buildSilhouetteShell({
  runsByRow: providedRuns = null,
  mask = null,
  nx,
  ny,
  aspect,
  slot,
  isMale = false,
  isSkirt = false,
  isStrapless = false,
  isWideOrLoose = false,
  isStandalone = false,
  yTop,
  yBottom,
  layerOffset = 0.02,
  fabricThickness = null,
  poseSleeves = true,
  sideProfile = null,
  getTorsoSlice,
  getLegSlice,
}) {
  const vw = nx + 1;
  const vh = ny + 1;
  const isBottom = slot === 'bottom' && !isSkirt;
  const isTopOrBody = slot === 'top' || slot === 'outerwear' || slot === 'dress';
  const yCrotchBody = isMale ? 0.86 : 0.82;
  const yShoulderAvatar = isMale ? 1.48 : 1.42;
  const yHeadTop = isMale ? 1.74 : 1.70;

  // Realistic physical fabric thickness in meters (0.2 mm to 3.0 mm = 0.0002m to 0.0030m).
  // Waistlines on skirts and bottoms are strictly <= 1.8 mm (0.0018m) thick.
  const effOffset = isStandalone
    ? layerOffset
    : Number.isFinite(fabricThickness)
      ? clamp(fabricThickness, 0.0002, 0.0035)
      : (isBottom || isSkirt ? Math.min(layerOffset, 0.0018) : Math.min(layerOffset, 0.0020));
  const waistOffset = isStandalone ? layerOffset : Math.min(effOffset, 0.0018);

  // Enforce strict top anchor bounds:
  // - Bottoms / skirts are anchored to the avatar waist (isMale ? 1.08 : 1.05).
  // - Strapless tops/dresses sit at the bust/chest line (isMale ? 1.34 : 1.30).
  const effectiveYTop = isBottom || isSkirt
    ? (isMale ? 1.08 : 1.05)
    : (isTopOrBody && isStrapless ? Math.min(yTop, isMale ? 1.34 : 1.30) : yTop);
  const hWorld = Math.max(0.10, effectiveYTop - yBottom);

  // ?? Row analysis & Detached Shard Pruning ??
  const runsByRow = [];
  let total = 0;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (let j = 0; j < vh; j++) {
    let runs = providedRuns
      ? (providedRuns[j] ? providedRuns[j].map((r) => [r[0], r[1]]) : [])
      : (mask ? rowRuns(mask, nx, j) : []);
    // Prune detached cutout shards / noise slivers so a stray side artifact is never
    // mistaken for a pant leg or stretched into a gray horizontal band across the garment.
    if (runs.length > 1) {
      const maxRunW = Math.max(...runs.map(([a, b]) => b - a));
      const minShardW = (isBottom || isSkirt)
        ? Math.max(2.5, Math.min(0.15 * nx, 0.42 * maxRunW))
        : (maxRunW >= 0.25 * nx ? Math.max(2.0, 0.05 * nx) : 0);
      if (minShardW > 0) {
        const filtered = runs.filter(([a, b]) => (b - a) >= minShardW);
        if (filtered.length > 0) runs = filtered;
      }
    }
    runsByRow.push(runs);
    runs.forEach(([a, b]) => {
      total += b - a;
      if (a < minCol) minCol = a;
      if (b > maxCol) maxCol = b;
    });
  }
  if (total < 120 || maxCol - minCol < 6) {
    return { ok: false, reason: 'mask_too_small' };
  }

  // Find the first and last rows that actually contain fabric
  let jFabricTop = 0;
  while (jFabricTop < vh && (!runsByRow[jFabricTop] || !runsByRow[jFabricTop].length)) jFabricTop++;
  let jFabricBottom = vh - 1;
  while (jFabricBottom >= 0 && (!runsByRow[jFabricBottom] || !runsByRow[jFabricBottom].length)) jFabricBottom--;
  const fabricHeight = Math.max(1, jFabricBottom - jFabricTop);
  const colMid = (minCol + maxCol) / 2;

  // Helper: validate that a row's runs represent two genuine left/right pant legs
  // rather than a single body span plus an edge shard or pocket flap.
  const getValidLegPair = (runs) => {
    if (!runs || runs.length < 2) return null;
    const sorted = [...runs]
      .sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))
      .slice(0, 2)
      .sort((p, q) => p[0] - q[0]);
    const w0 = sorted[0][1] - sorted[0][0];
    const w1 = sorted[1][1] - sorted[1][0];
    const minLegW = Math.max(3, 0.16 * nx);
    if (w0 < minLegW || w1 < minLegW) return null;
    if (Math.min(w0, w1) / Math.max(1e-3, Math.max(w0, w1)) < 0.48) return null;
    const gapCenter = (sorted[0][1] + sorted[1][0]) * 0.5;
    if (Math.abs(gapCenter - colMid) > 0.18 * nx) return null;
    return sorted;
  };

  // ?? Bottoms: Strict Waist & Crotch Anchor Detection ??
  // Pants are anchored at the waist (jFabricTop -> effectiveYTop) and at the crotch (crotchRow -> yCrotchBody).
  // In no case can pants split into legs higher than the crotch line (yCrotchBody)!
  const isShortBottom = isBottom && hWorld <= 0.66;
  const anatomicalRiseFrac = clamp((effectiveYTop - yCrotchBody) / Math.max(0.12, hWorld), 0.16, 0.62);
  const pelvisSplitRow = jFabricTop + Math.max(2, Math.round(anatomicalRiseFrac * fabricHeight));
  let crotchRow = -1;
  if (isBottom) {
    const scanStart = Math.min(ny - 3, jFabricTop + Math.max(2, Math.floor(0.14 * fabricHeight)));
    const scanEnd = Math.min(ny - 3, jFabricTop + Math.floor((isShortBottom ? 0.90 : 0.56) * fabricHeight));
    for (let j = scanStart; j <= scanEnd; j++) {
      let stable = true;
      for (let k = 0; k < 3; k++) {
        if (!getValidLegPair(runsByRow[j + k])) {
          stable = false;
          break;
        }
      }
      if (stable) {
        crotchRow = j;
        break;
      }
    }
    const minCrotchRow = jFabricTop + Math.max(2, Math.round(0.16 * fabricHeight));
    const maxCrotchRow = jFabricTop + Math.max(4, Math.round((isShortBottom ? 0.92 : 0.55) * fabricHeight));
    if (crotchRow < 0) {
      crotchRow = pelvisSplitRow;
    } else if (isShortBottom) {
      crotchRow = clamp(Math.max(pelvisSplitRow, crotchRow), minCrotchRow, maxCrotchRow);
    } else {
      crotchRow = clamp(crotchRow, minCrotchRow, maxCrotchRow);
    }

    // Strictly unify any split runs ABOVE the crotch split row into a single continuous pelvis/thigh span [minA, maxB]
    // so bottoms NEVER split higher than the crotch line and never tear into triangles!
    const unifyLimitRow = Math.max(pelvisSplitRow, crotchRow);
    for (let j = jFabricTop; j < unifyLimitRow; j++) {
      const r = runsByRow[j];
      if (r && r.length > 1) {
        let rMin = Infinity;
        let rMax = -Infinity;
        for (let k = 0; k < r.length; k++) {
          if (r[k][0] < rMin) rMin = r[k][0];
          if (r[k][1] > rMax) rMax = r[k][1];
        }
        if (rMax > rMin) {
          runsByRow[j] = [[rMin, rMax]];
        }
      }
    }
  } else if (isSkirt) {
    // A skirt is a single continuous envelope from waist to hem
    for (let j = jFabricTop; j <= jFabricBottom; j++) {
      const r = runsByRow[j];
      if (r && r.length > 1) {
        let rMin = Infinity;
        let rMax = -Infinity;
        for (let k = 0; k < r.length; k++) {
          if (r[k][0] < rMin) rMin = r[k][0];
          if (r[k][1] > rMax) rMax = r[k][1];
        }
        if (rMax > rMin) {
          runsByRow[j] = [[rMin, rMax]];
        }
      }
    }
  }

  // Track first opaque row per column for waistband UV leveling and level arched/tabbed top waistband rows
  // Applies to BOTH pants/shorts (isBottom) and skirts (isSkirt) so cutout waistbands never create sawtooth teeth!
  const waistLevelLimitRow = isBottom
    ? crotchRow
    : (isSkirt ? Math.min(jFabricBottom, jFabricTop + Math.max(4, Math.floor(0.28 * fabricHeight))) : -1);
  let jFirstWaistCol = null;
  if ((isBottom || isSkirt) && !isStandalone && waistLevelLimitRow > jFabricTop) {
    const jWaistScanEnd = Math.min(waistLevelLimitRow - 1, jFabricTop + Math.max(2, Math.floor(0.14 * fabricHeight)));
    const waistWidths = [];
    for (let j = jFabricTop; j <= jWaistScanEnd; j++) {
      const r = runsByRow[j];
      if (r && r.length) waistWidths.push(r[0][1] - r[0][0]);
    }
    const maxWaistW = waistWidths.length ? Math.max(...waistWidths) : 0;
    let jWaistFull = jFabricTop;
    for (let j = jFabricTop; j <= jWaistScanEnd; j++) {
      const r = runsByRow[j];
      if (r && r.length && (r[0][1] - r[0][0]) >= 0.88 * maxWaistW) {
        jWaistFull = j;
        break;
      }
    }
    const fullRun = runsByRow[jWaistFull] && runsByRow[jWaistFull][0];
    if (fullRun && jWaistFull > jFabricTop) {
      const wMinA = fullRun[0];
      const wMaxB = fullRun[1];
      jFirstWaistCol = new Int32Array(vw).fill(jWaistFull);
      for (let i = 0; i < vw; i++) {
        for (let j = jFabricTop; j <= jWaistFull; j++) {
          const r = runsByRow[j];
          if (r && r.length && i >= r[0][0] && i <= r[0][1]) {
            jFirstWaistCol[i] = j;
            break;
          }
        }
      }
      for (let j = jFabricTop; j < jWaistFull; j++) {
        const r = runsByRow[j];
        if (r && r.length) {
          runsByRow[j] = [[Math.min(r[0][0], wMinA), Math.max(r[0][1], wMaxB)]];
        } else {
          runsByRow[j] = [[wMinA, wMaxB]];
        }
      }
    }
  }

  // ?? Tops & Dresses: Continuous Torso & Waist Envelope Unification ??
  // For dresses, skirts, and tops below the bust line / armpits, the garment forms a single
  // continuous body sheath. Any interior transparency gap, wrinkle tear, or cutout artifact
  // must never slice holes or detach the torso into disconnected tubes.
  if (isTopOrBody) {
    const isDress = slot === 'dress';
    const isTop = slot === 'top';
    const torsoStartRow = jFabricTop + Math.max(2, Math.floor((isDress ? 0.22 : 0.30) * fabricHeight));
    for (let j = torsoStartRow; j <= jFabricBottom; j++) {
      const r = runsByRow[j];
      if (!r || r.length <= 1) continue;
      if (isDress) {
        // A dress below bust is strictly a single continuous body envelope
        let rMin = Infinity;
        let rMax = -Infinity;
        for (let k = 0; k < r.length; k++) {
          if (r[k][0] < rMin) rMin = r[k][0];
          if (r[k][1] > rMax) rMax = r[k][1];
        }
        if (rMax > rMin) runsByRow[j] = [[rMin, rMax]];
      } else {
        // For general tops: bridge small/medium cutout gaps between adjacent runs within the torso
        // (tears, wrinkle artifacts, or arm-torso boundary seams up to 14% of width)
        const merged = [];
        let cur = [r[0][0], r[0][1]];
        for (let k = 1; k < r.length; k++) {
          const gap = r[k][0] - cur[1];
          if (gap <= Math.max(3, 0.14 * nx)) {
            cur[1] = Math.max(cur[1], r[k][1]);
          } else {
            merged.push(cur);
            cur = [r[k][0], r[k][1]];
          }
        }
        merged.push(cur);
        runsByRow[j] = merged;
      }
    }
  }

  // Which vertices lie inside the fabric (for smoothing / cell selection)
  const inside = new Uint8Array(vw * vh);
  runsByRow.forEach((runs, j) => {
    runs.forEach(([a, b]) => {
      for (let i = Math.max(0, Math.ceil(a)); i <= Math.min(nx, Math.floor(b)); i++) inside[j * vw + i] = 1;
    });
  });

  // ?? Horizontal scale & Shoulder line detection ??
  const dxUniform = (aspect * hWorld) / nx;

  const detectedShoulder = isTopOrBody && !isStrapless
    ? detectGarmentShoulderRow(runsByRow, nx, ny, dxUniform)
    : 0;
  const shoulderFrac = detectedShoulder / ny;
  const hasHoodOrHanger = !isStandalone && shoulderFrac >= 0.12;

  const rowY = (j) => {
    if (isBottom && crotchRow > jFabricTop) {
      // Strict Waist & Crotch Anchor Mapping for ALL bottoms (pants, capris, bermudas, shorts):
      // Waist (jFabricTop) anchors strictly to effectiveYTop.
      // Crotch split (crotchRow) anchors strictly to yCrotchBody (or yBottom if yBottom > yCrotchBody).
      // In no case can pants split or go higher than the crotch line!
      const effectiveCrotchY = Math.min(effectiveYTop - 0.04, Math.max(yBottom, yCrotchBody));
      if (j <= jFabricTop) return effectiveYTop;
      if (j <= crotchRow) {
        const yVal = effectiveYTop + (effectiveCrotchY - effectiveYTop) * ((j - jFabricTop) / Math.max(1, crotchRow - jFabricTop));
        return clamp(yVal, effectiveCrotchY, effectiveYTop);
      }
      const bRow = jFabricBottom > crotchRow ? jFabricBottom : ny;
      if (j >= bRow) return yBottom;
      const yLeg = effectiveCrotchY + (yBottom - effectiveCrotchY) * ((j - crotchRow) / Math.max(1, bRow - crotchRow));
      return Math.min(effectiveCrotchY, yLeg);
    }
    if (hasHoodOrHanger) {
      const torsoRows = Math.max(1, jFabricBottom - detectedShoulder);
      const bodyHeight = yShoulderAvatar - yBottom;
      if (j >= detectedShoulder) {
        return Math.max(yBottom, yShoulderAvatar - ((j - detectedShoulder) / torsoRows) * bodyHeight);
      }
      const theoreticalHeadHeight = (detectedShoulder / torsoRows) * bodyHeight;
      const headRoom = yHeadTop - yShoulderAvatar;
      const cHood = theoreticalHeadHeight > 1e-3 ? Math.min(1.0, headRoom / theoreticalHeadHeight) : 1.0;
      return yShoulderAvatar + ((detectedShoulder - j) / torsoRows) * bodyHeight * cHood;
    }
    if (isSkirt && jFabricBottom > jFabricTop) {
      if (j <= jFabricTop) return effectiveYTop;
      if (j >= jFabricBottom) return yBottom;
      return effectiveYTop - ((j - jFabricTop) / (jFabricBottom - jFabricTop)) * hWorld;
    }
    if (isTopOrBody && jFabricBottom > jFabricTop) {
      if (j <= jFabricTop) return effectiveYTop;
      if (j >= jFabricBottom) return yBottom;
      return effectiveYTop - ((j - jFabricTop) / (jFabricBottom - jFabricTop)) * hWorld;
    }
    return effectiveYTop - (j / ny) * hWorld;
  };

  const bodyHalfAt = (y) => {
    if (isBottom && y < yCrotchBody) {
      const leg = getLegSlice(y, isMale);
      return leg.cx + leg.r;
    }
    return getTorsoSlice(y, isMale).rx;
  };
  const ratios = [];
  for (let j = Math.floor(vh * 0.12); j < Math.floor(vh * 0.92); j++) {
    const runs = runsByRow[j];
    if (!runs.length) continue;
    let wCols = 0;
    runs.forEach(([a, b]) => { wCols += b - a; });
    const wWorld = wCols * dxUniform;
    const y = rowY(j);
    const target = 2 * (bodyHalfAt(y) + effOffset);
    if (wWorld > 1e-3) ratios.push(target / wWorld);
  }

  let waistCenterCol = colMid;
  let collarCenterCol = colMid;
  let spineCenterCol = colMid;
  let sWaistSkirt = 1.0;
  let sCorr;
  if (isStandalone) {
    sCorr = 1.0;
  } else if (isSkirt) {
    // ?? Skirt Slicing: Align & scale top-hem slice with avatar's waist slice circumference (<= 2mm thick) ??
    const yWaist = effectiveYTop;
    const waistTorso = getTorsoSlice(yWaist, isMale);
    const reqWaistHalf = waistTorso.rx + waistOffset;

    const waistScanStart = jFabricTop;
    const waistScanEnd = Math.min(vh - 1, jFabricTop + Math.max(3, Math.floor(0.10 * fabricHeight)));
    const topWidths = [];
    const topCenters = [];
    for (let j = waistScanStart; j <= waistScanEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      let minA = Infinity, maxB = -Infinity;
      runs.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (b > maxB) maxB = b;
      });
      if (maxB > minA) {
        topWidths.push(maxB - minA);
        topCenters.push((minA + maxB) / 2);
      }
    }
    const waistCols = topWidths.length ? percentile(topWidths, 0.55) : nx * 0.4;
    waistCenterCol = topCenters.length ? percentile(topCenters, 0.50) : colMid;
    const waistHalfWorld = Math.max(1e-3, 0.5 * waistCols * dxUniform);
    const sWaist = reqWaistHalf / waistHalfWorld;
    sWaistSkirt = sWaist;
    sCorr = clamp(sWaist, 0.45, 2.20);
  } else if (isBottom) {
    // ?? Bottom Slicing: Align & scale top-hem slice with avatar's waist slice circumference (<= 2mm thick) ??
    const waistTorso = getTorsoSlice(effectiveYTop, isMale);
    const reqWaistHalf = waistTorso.rx + waistOffset;
    const waistScanEnd = Math.min(vh - 1, jFabricTop + Math.max(2, Math.floor(0.12 * fabricHeight)));
    const topWidths = [];
    const topCenters = [];
    for (let j = jFabricTop; j <= waistScanEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      let minA = Infinity, maxB = -Infinity;
      runs.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (b > maxB) maxB = b;
      });
      if (maxB > minA) {
        topWidths.push(maxB - minA);
        topCenters.push((minA + maxB) / 2);
      }
    }
    const waistCols = topWidths.length ? percentile(topWidths, 0.60) : nx * 0.4;
    waistCenterCol = topCenters.length ? percentile(topCenters, 0.50) : colMid;
    const waistHalfWorld = Math.max(1e-3, 0.5 * waistCols * dxUniform);
    const sWaist = reqWaistHalf / waistHalfWorld;
    sCorr = clamp(sWaist, 0.55, 1.65);
  } else if (isTopOrBody) {
    // ?? Top / Dress / Outerwear Slicing:
    // 1. Align the top's collar center with the avatar's neck center (x = 0).
    // 2. Align & scale the top's shoulder slices with the avatar's shoulder slice circumference.
    // 3. Keep the original silhouette and cut below the shoulders.
    const jTopAnchor = hasHoodOrHanger ? detectedShoulder : jFabricTop;
    const collarScanEnd = Math.min(vh - 1, jTopAnchor + Math.max(2, Math.floor(0.08 * fabricHeight)));
    const collarCenters = [];
    for (let j = jTopAnchor; j <= collarScanEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      let minA = Infinity, maxB = -Infinity;
      runs.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (b > maxB) maxB = b;
      });
      if (maxB > minA) collarCenters.push((minA + maxB) * 0.5);
    }
    collarCenterCol = collarCenters.length ? percentile(collarCenters, 0.50) : colMid;

    // Measure torso trunk width & center
    const trunkWidths = [];
    const trunkCenters = [];
    const tStart = Math.min(vh - 1, jTopAnchor + Math.floor(0.35 * fabricHeight));
    const tEnd = Math.min(vh - 1, jTopAnchor + Math.floor(0.75 * fabricHeight));
    for (let j = tStart; j <= tEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      let bestRun = runs[0];
      let bestDist = Math.abs((bestRun[0] + bestRun[1]) / 2 - colMid);
      for (let k = 1; k < runs.length; k++) {
        const d = Math.abs((runs[k][0] + runs[k][1]) / 2 - colMid);
        if (d < bestDist) {
          bestDist = d;
          bestRun = runs[k];
        }
      }
      trunkWidths.push(bestRun[1] - bestRun[0]);
      trunkCenters.push((bestRun[0] + bestRun[1]) * 0.5);
    }
    const trunkCols = trunkWidths.length ? percentile(trunkWidths, 0.50) : nx * 0.45;
    spineCenterCol = trunkCenters.length ? percentile(trunkCenters, 0.50) : colMid;

    // Measure shoulder slice width at the shoulder line (excluding outstretched sleeves)
    const shScanStart = Math.min(vh - 1, jTopAnchor + Math.max(1, Math.floor(0.06 * fabricHeight)));
    const shScanEnd = Math.min(vh - 1, jTopAnchor + Math.max(3, Math.floor(0.18 * fabricHeight)));
    const shWidths = [];
    for (let j = shScanStart; j <= shScanEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      let minA = Infinity, maxB = -Infinity;
      runs.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (b > maxB) maxB = b;
      });
      if (maxB > minA) shWidths.push(maxB - minA);
    }
    const rawShoulderCols = shWidths.length ? percentile(shWidths, 0.60) : trunkCols * 1.12;
    const shoulderCols = rawShoulderCols > trunkCols * 1.20
      ? clamp(rawShoulderCols * 0.78, trunkCols * 1.06, trunkCols * 1.18)
      : Math.max(rawShoulderCols, trunkCols * 1.04);

    const shTorso = getTorsoSlice(yShoulderAvatar, isMale);
    const reqShoulderHalf = shTorso.rx + effOffset;
    const shoulderHalfWorld = Math.max(1e-3, 0.5 * shoulderCols * dxUniform);
    const sShoulder = reqShoulderHalf / shoulderHalfWorld;

    const trunkHalfWorld = Math.max(1e-3, 0.5 * trunkCols * dxUniform);
    const targetTrunkHalf = getTorsoSlice(isMale ? 1.24 : 1.18, isMale).rx + effOffset;
    const sTrunk = targetTrunkHalf / trunkHalfWorld;

    sCorr = clamp(isWideOrLoose ? sShoulder : Math.max(sShoulder, sTrunk * 0.96), 0.55, 1.65);
  } else {
    sCorr = clamp(percentile(ratios, 0.85), 0.72, 1.4);
  }

  const dx = dxUniform * sCorr;

  // Helper: resolve the owning run [a, b] for vertex (i, j), including vertical cap rows
  const distToRun = (col, r) => (col < r[0] ? r[0] - col : col > r[1] ? col - r[1] : 0);
  const runsOverlap = (r1, r2) => r1[0] <= r2[1] + 1.5 && r2[0] <= r1[1] + 1.5;
  const resolveVertexRun = (i, j) => {
    const runs = runsByRow[j];
    let bestCurr = null;
    let bestCurrDist = Infinity;
    for (let k = 0; k < runs.length; k++) {
      const d = distToRun(i, runs[k]);
      if (d < bestCurrDist) {
        bestCurrDist = d;
        bestCurr = runs[k];
      }
    }
    if (bestCurr && bestCurrDist <= 1.5) return bestCurr;

    let bestAdj = null;
    let bestAdjDist = Infinity;
    for (let dj = -1; dj <= 1; dj += 2) {
      const rj = j + dj;
      if (rj < 0 || rj >= vh) continue;
      const adjRuns = runsByRow[rj];
      for (let k = 0; k < adjRuns.length; k++) {
        const d = distToRun(i, adjRuns[k]);
        if (d < bestAdjDist) {
          bestAdjDist = d;
          bestAdj = adjRuns[k];
        }
      }
    }
    if (bestAdj && bestAdjDist <= 1.5) {
      if (bestCurr && runsOverlap(bestCurr, bestAdj)) return bestCurr;
      return bestAdj;
    }
    return bestCurr || bestAdj;
  };

  // Optional side-view profile depth modulation from item group POV image
  const sideScaleAtRow = (j) => {
    if (!sideProfile || !sideProfile.ratios || !sideProfile.ratios.length) return 1.0;
    const t = clamp((j - jFabricTop) / Math.max(1, fabricHeight), 0, 1);
    const idx = Math.min(sideProfile.ratios.length - 1, Math.max(0, Math.round(t * (sideProfile.ratios.length - 1))));
    return clamp(sideProfile.ratios[idx] || 1.0, 0.85, 1.30);
  };

  // ?? Per-row geometry ??
  const offF = new Float32Array(vw * vh);
  const offB = new Float32Array(vw * vh);
  const baseZ = new Float32Array(vw * vh);
  const xs = new Float32Array(vw * vh);
  const ys = new Float32Array(vw * vh);
  const uCols = new Float32Array(vw * vh);

  for (let j = 0; j < vh; j++) {
    const y = rowY(j);
    const runs = runsByRow[j];
    const effectiveRuns = (runs && runs.length)
      ? runs
      : (runsByRow[clamp(j, jFabricTop, jFabricBottom)] || []);
    const torso = getTorsoSlice(Math.max(0.5, y), isMale);
    const leg = isBottom ? getLegSlice(Math.min(yCrotchBody, y), isMale) : null;
    const crotchBlend = isBottom ? smoothstep01((yCrotchBody + 0.03 - y) / 0.06) : 0;

    const legRuns = isBottom && j >= crotchRow ? getValidLegPair(effectiveRuns) : null;
    let singleLegRun = null;
    let singleLegSide = 0;
    if (isBottom && j >= crotchRow && !legRuns && effectiveRuns && effectiveRuns.length >= 1) {
      const sortedLegs = [...effectiveRuns].sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
      const candidate = sortedLegs[0];
      const wCandidate = candidate[1] - candidate[0];
      const cCandidate = (candidate[0] + candidate[1]) * 0.5;
      if (wCandidate >= Math.max(2, 0.08 * nx)) {
        singleLegRun = candidate;
        singleLegSide = cCandidate < colMid ? -1 : 1;
      }
    }

    let rMinA = Infinity, rMaxB = -Infinity;
    if (effectiveRuns && effectiveRuns.length) {
      effectiveRuns.forEach(([a, b]) => {
        if (a < rMinA) rMinA = a;
        if (b > rMaxB) rMaxB = b;
      });
    }
    const rMid = Number.isFinite(rMinA) ? (rMinA + rMaxB) / 2 : colMid;
    const rHalf = Number.isFinite(rMinA)
      ? Math.max(Math.max(3, 0.12 * nx), (rMaxB - rMinA) / 2)
      : Math.max(4, 0.25 * nx);

    for (let i = 0; i < vw; i++) {
      const idx = j * vw + i;
      const run = resolveVertexRun(i, j);
      const col = run ? clamp(i, run[0], run[1]) : i;
      if (run && !isSkirt) {
        const spanW = Math.max(0, run[1] - run[0]);
        const uvInset = spanW >= 8 ? Math.min(3.2, spanW * 0.075) : 0;
        uCols[idx] = clamp(col, run[0] + uvInset, run[1] - uvInset);
      } else {
        uCols[idx] = col;
      }

      let x = (col - colMid) * dx;
      if (isTopOrBody && !isStandalone) {
        // Align collar center with avatar neck (x = 0) and transition smoothly down the spine,
        // keeping the garment's original photographed silhouette & cut while ensuring torso clearance.
        const tCollar = clamp((j - jFabricTop) / Math.max(1, 0.20 * fabricHeight), 0, 1);
        const rowCenter = collarCenterCol * (1 - tCollar) + spineCenterCol * tCollar;
        x = (col - rowCenter) * dx;
        if (y >= 0.80 && y <= yShoulderAvatar - 0.04 && run && run[0] <= rowCenter && run[1] >= rowCenter) {
          const trunkHalfWorld = Math.max(1e-3, ((run[1] - run[0]) * 0.5) * dx);
          const minTrunkHalf = torso.rx + effOffset;
          if (trunkHalfWorld < minTrunkHalf) {
            const trunkMid = (run[0] + run[1]) * 0.5;
            const scaleBoost = minTrunkHalf / trunkHalfWorld;
            x = (col - trunkMid) * dx * scaleBoost;
          }
        }
      } else if (isSkirt && !isStandalone) {
        // Align top-hem slice center to waist (x = 0) and scale top-hem slice to avatar waist circumference,
        // while keeping the skirt's original photographed silhouette and cut below the waist.
        const tSkirt = clamp((effectiveYTop - y) / Math.max(0.01, hWorld), 0, 1);
        const rowMid = waistCenterCol * (1 - tSkirt) + rMid * tSkirt;
        const naturalHalf = rHalf * dx;
        const waistTorso = getTorsoSlice(effectiveYTop, isMale);
        const reqWaistHalf = waistTorso.rx + waistOffset;
        const minBodyHalf = (y >= yCrotchBody ? torso.rx : getTorsoSlice(Math.max(0.68, y), isMale).rx * 0.96) + effOffset;
        const waistLock = smoothstep01(tSkirt / 0.14);
        const targetRowHalf = reqWaistHalf * (1 - waistLock) + Math.max(minBodyHalf, naturalHalf) * waistLock;
        const uSkirt = clamp((col - rowMid) / Math.max(1, rHalf), -1, 1);
        x = uSkirt * targetRowHalf;
      } else if (isBottom && !isStandalone) {
        // Anchor top-hem slice to avatar's waist slice circumference with <= 1.8mm thickness,
        // and keep original silhouette for wide/loose/hip-hop/cargo pants below the waist.
        const waistTorso = getTorsoSlice(effectiveYTop, isMale);
        const reqWaistHalf = waistTorso.rx + waistOffset;
        const bodyOuterHalf = (torso.rx * (1 - crotchBlend) + (leg.cx + leg.r) * crotchBlend) + effOffset;
        const currentHalf = rHalf * dx;
        const tBelowWaist = smoothstep01((effectiveYTop - y) / 0.08);
        const naturalPelvisHalf = (isShortBottom || isWideOrLoose || currentHalf > bodyOuterHalf * 1.08)
          ? clamp(currentHalf, bodyOuterHalf, bodyOuterHalf * 1.38)
          : bodyOuterHalf;
        const targetRowHalf = reqWaistHalf * (1 - tBelowWaist) + naturalPelvisHalf * tBelowWaist;
        const rowCenter = waistCenterCol * (1 - tBelowWaist) + rMid * tBelowWaist;
        const uPelvis = clamp((col - rowCenter) / Math.max(1, rHalf), -1, 1);
        const xCont = uPelvis * targetRowHalf;

        if (legRuns && y <= yCrotchBody + 1e-4) {
          const c0 = (legRuns[0][0] + legRuns[0][1]) / 2;
          const c1 = (legRuns[1][0] + legRuns[1][1]) / 2;
          const k = Math.abs(col - c0) <= Math.abs(col - c1) ? 0 : 1;
          const ck = k === 0 ? c0 : c1;
          const halfCols = Math.max(1, (legRuns[k][1] - legRuns[k][0]) / 2);
          const uLeg = clamp((col - ck) / halfCols, -1, 1);
          const side = k === 0 ? -1 : 1;

          const minLegRadius = leg.r + effOffset;
          const photoLegRadius = halfCols * dx;
          const outerRadius = (isWideOrLoose || photoLegRadius > minLegRadius * 1.12)
            ? clamp(photoLegRadius, minLegRadius, minLegRadius * 1.38)
            : minLegRadius;
          const crotchClose = clamp((y - (yCrotchBody - 0.06)) / 0.06, 0, 1);
          const baseInnerRadius = minLegRadius;
          const innerRadius = Math.min(
            leg.cx - 0.001 * (1 - crotchClose),
            baseInnerRadius + crotchClose * Math.max(0, leg.cx - baseInnerRadius)
          );

          const isInnerSide = side * uLeg < 0;
          const rActive = isInnerSide ? innerRadius : outerRadius;
          const xLeg = side * leg.cx + uLeg * rActive;
          const legBlend = smoothstep01((j - crotchRow + 1) / (isShortBottom ? 4 : 2.5));
          x = xCont * (1 - legBlend) + xLeg * legBlend;
        } else if (singleLegRun && y <= yCrotchBody + 1e-4) {
          const c0 = (singleLegRun[0] + singleLegRun[1]) / 2;
          const halfCols = Math.max(1, (singleLegRun[1] - singleLegRun[0]) / 2);
          const uLeg = clamp((col - c0) / halfCols, -1, 1);
          const side = singleLegSide;

          const minLegRadius = leg.r + effOffset;
          const photoLegRadius = halfCols * dx;
          const outerRadius = (isWideOrLoose || photoLegRadius > minLegRadius * 1.12)
            ? clamp(photoLegRadius, minLegRadius, minLegRadius * 1.38)
            : minLegRadius;
          const crotchClose = clamp((y - (yCrotchBody - 0.06)) / 0.06, 0, 1);
          const baseInnerRadius = minLegRadius;
          const innerRadius = Math.min(
            leg.cx - 0.001 * (1 - crotchClose),
            baseInnerRadius + crotchClose * Math.max(0, leg.cx - baseInnerRadius)
          );

          const isInnerSide = side * uLeg < 0;
          const rActive = isInnerSide ? innerRadius : outerRadius;
          const xLeg = side * leg.cx + uLeg * rActive;
          const legBlend = smoothstep01((j - crotchRow + 1) / (isShortBottom ? 4 : 2.5));
          x = xCont * (1 - legBlend) + xLeg * legBlend;
        } else {
          x = xCont;
        }
      }
      xs[idx] = x;
      ys[idx] = y;
      baseZ[idx] = isStandalone
        ? 0
        : (isBottom ? (torso.cz * (1 - crotchBlend) + leg.cz * crotchBlend) : torso.cz);
    }

    const sideMod = sideScaleAtRow(j);

    // Depth profile per run (elliptical cross-section, strictly closed at a and b).
    runs.forEach(([a, b]) => {
      const mid = (a + b) / 2;
      const half = Math.max(0.5, (b - a) / 2);
      const halfWorld = half * dx;

      let bodyRzFront, bodyRzBack;
      if (isBottom) {
        const tWaist = smoothstep01((effectiveYTop - y) / 0.06);
        const fitOffset = isStandalone ? layerOffset : (waistOffset * (1 - tWaist) + effOffset * tWaist);
        const torsoF = (torso.rzFront || torso.rz) + fitOffset;
        const torsoB = (torso.rzBack || torso.rz) + fitOffset;
        const legF = (leg.rzFront || leg.r) + fitOffset;
        const legB = (leg.rzBack || leg.r) + fitOffset;
        const crotchProximity = clamp((y - (yCrotchBody - 0.06)) / 0.08, 0, 1);
        const minF = legRuns
          ? Math.max(legF, torsoF * 0.95 * crotchProximity)
          : (torsoF * (1 - crotchBlend) + legF * crotchBlend);
        const minB = legRuns
          ? Math.max(legB, torsoB * 0.95 * crotchProximity)
          : (torsoB * (1 - crotchBlend) + legB * crotchBlend);
        bodyRzFront = Math.max(minF, minF * sideMod);
        bodyRzBack = Math.max(minB, minB * sideMod);
      } else if (isSkirt) {
        // Skirt waistline thickness is strictly <= 1.8 mm (waistOffset) on the waist!
        // Below the waist, follow the avatar's exact hip/buttock contour and drape smoothly downward.
        const tWaist = smoothstep01((effectiveYTop - y) / 0.08);
        const fitOff = isStandalone ? layerOffset : (waistOffset * (1 - tWaist) + effOffset * tWaist);
        const hipPeakSlice = getTorsoSlice(isMale ? 0.92 : 0.90, isMale);
        // Below the hip peak (y < 0.90), a skirt hangs straight or flares outward rather than pinching between the legs
        const belowHipT = smoothstep01(((isMale ? 0.92 : 0.90) - y) / 0.14);
        const baseRzFront = ((torso.rzFront || torso.rz) * (1 - belowHipT) + (hipPeakSlice.rzFront || hipPeakSlice.rz) * belowHipT) + fitOff;
        const baseRzBack = ((torso.rzBack || torso.rz) * (1 - belowHipT) + (hipPeakSlice.rzBack || hipPeakSlice.rz) * belowHipT) + fitOff;

        const lateralFlare = Math.max(0, halfWorld - (torso.rx + fitOff)) * 0.42 * tWaist;
        bodyRzFront = (baseRzFront + lateralFlare) * sideMod;
        bodyRzBack = (baseRzBack + lateralFlare) * sideMod;
      } else {
        const minF = (torso.rzFront || torso.rz) + effOffset;
        const minB = (torso.rzBack || torso.rz) + effOffset;
        bodyRzFront = Math.max(minF, minF * sideMod);
        bodyRzBack = Math.max(minB, minB * sideMod);
      }

      // In standalone 3D Garment View, use a consistent 0.82 scale of the full anatomical depth
      // across both pelvis and legs (and torso) so the pelvis NEVER deflates relative to the legs!
      if (isStandalone) {
        bodyRzFront *= 0.82;
        bodyRzBack *= 0.82;
      }

      // Dresses / ball gowns / long coats flare below the hips proportional to their silhouette width
      if (!isBottom && !isSkirt && !isStandalone && y < 0.84) {
        const hipRx = getTorsoSlice(0.88, isMale).rx + effOffset;
        const dressFlare = Math.max(0, halfWorld - hipRx) * 0.48;
        bodyRzFront = Math.max(bodyRzFront, bodyRzFront + dressFlare);
        bodyRzBack = Math.max(bodyRzBack, bodyRzBack + dressFlare);
      }

      const isShoulderZone = !isBottom && !isSkirt && y >= (isMale ? 1.35 : 1.29);
      const isBodySpan = isBottom || isSkirt || halfWorld >= torso.rx * 0.72 || isShoulderZone;
      const ampFront = (isBottom || isSkirt) ? bodyRzFront : (isBodySpan ? bodyRzFront : Math.min(bodyRzFront, halfWorld + 0.010));
      const ampBack = (isBottom || isSkirt) ? bodyRzBack : (isBodySpan ? bodyRzBack : Math.min(bodyRzBack, halfWorld + 0.010));

      // For sloped shoulder rows near the top of shirts/jackets, normalize u against the full shoulder span
      // so diagonal shoulder edges retain full anterior/posterior clavicle & scapula depth.
      const effectiveHalf = isShoulderZone
        ? Math.max(half, ((torso.rx + effOffset) * 1.04) / Math.max(1e-4, dx))
        : half;

      const iStart = Math.max(0, Math.ceil(a + 0.02));
      const iEnd = Math.min(nx, Math.floor(b - 0.02));

      for (let i = iStart; i <= iEnd; i++) {
        const u = clamp((i - mid) / effectiveHalf, -1, 1);
        const s = Math.max(0, 1 - u * u);
        // Tight 0.06 flank taper and fuller s^0.36 super-ellipse for bottoms & skirts so waistbands and pant legs
        // wrap cleanly around the waist, hip, and thigh before closing at the side seam.
        const taperWidth = (isBottom || isSkirt) ? 0.06 : 0.16;
        const edgeTaper = isShoulderZone
          ? smoothstep01((1 - Math.abs(u)) / 0.05)
          : smoothstep01((1 - Math.abs(u)) / taperWidth);
        const hhFront = ((isBottom || isSkirt) ? Math.pow(s, 0.36) : (isBodySpan ? Math.pow(s, 0.42) : Math.sqrt(s))) * edgeTaper;
        const hhBack = ((isBottom || isSkirt) ? Math.pow(s, 0.36) : (isBodySpan ? Math.pow(s, 0.40) : Math.pow(s, 0.46))) * edgeTaper;
        offF[j * vw + i] = ampFront * hhFront;
        offB[j * vw + i] = ampBack * hhBack;
      }
    });
  }

  // For bottoms: at the crotch transition row (j = crotchRow), bridge offF and offB across any
  // central gap columns that connect upward to the lower pelvis row (crotchRow - 1)
  // so the lower pelvis center NEVER gets pulled inward to z = baseZ!
  if (isBottom && crotchRow > 0 && crotchRow < vh) {
    const prevRow = (crotchRow - 1) * vw;
    const currRow = crotchRow * vw;
    for (let i = 0; i < vw; i++) {
      if (offF[currRow + i] <= 1e-4 && offF[prevRow + i] > 1e-4) {
        offF[currRow + i] = offF[prevRow + i] * 0.92;
        offB[currRow + i] = offB[prevRow + i] * 0.92;
        xs[currRow + i] = xs[prevRow + i];
        baseZ[currRow + i] = baseZ[prevRow + i];
      }
    }
  }

  // Vertical X-smoothing for bottoms and skirts across consecutive rows with matching topology
  // so pocket flaps or cutout noise never create horizontal step shelves.
  if (isBottom || isSkirt) {
    for (let pass = 0; pass < 2; pass++) {
      const tmpX = new Float32Array(xs);
      for (let j = Math.max(1, jFabricTop + 1); j < Math.min(vh - 1, jFabricBottom); j++) {
        const rUp = runsByRow[j - 1];
        const rCur = runsByRow[j];
        const rDn = runsByRow[j + 1];
        if (!rUp || !rCur || !rDn || rUp.length !== rCur.length || rDn.length !== rCur.length) continue;
        for (let i = 0; i < vw; i++) {
          const idx = j * vw + i;
          if (!inside[idx] || !inside[idx - vw] || !inside[idx + vw]) continue;
          tmpX[idx] = 0.18 * xs[idx - vw] + 0.64 * xs[idx] + 0.18 * xs[idx + vw];
        }
      }
      xs.set(tmpX);
    }
  }

  // ?? Strict Column-Wise Shoulder Line Anchor for Tops, Outerwear & Full-Body Garments ??
  // Anchors the top shoulder edge of every column across the left and right shoulders
  // smoothly along the avatar's anatomical shoulder contour without sharp shelves or skin holes.
  if (isTopOrBody && !isStrapless) {
    const minNeckX = isMale ? 0.064 : 0.054;
    const maxShoulderX = isMale ? 0.222 : 0.198;
    const decayRows = Math.max(6, Math.round(0.28 * fabricHeight));
    const minStartRow = hasHoodOrHanger ? Math.max(0, detectedShoulder - 2) : 0;

    const jFirsts = new Int32Array(vw).fill(-1);
    const dys = new Float32Array(vw);
    const weights = new Float32Array(vw);

    for (let i = 0; i < vw; i++) {
      let jFirst = -1;
      for (let j = minStartRow; j <= jFabricBottom; j++) {
        if (inside[j * vw + i]) {
          jFirst = j;
          break;
        }
      }
      if (jFirst < 0 || jFirst > jFabricTop + Math.round(0.28 * fabricHeight)) continue;
      jFirsts[i] = jFirst;
      const xCol = xs[jFirst * vw + i];
      const absX = Math.abs(xCol);

      // Smooth blend near neck line and outer deltoid/acromion
      const neckBlend = smoothstep01((absX - (minNeckX - 0.025)) / 0.035);
      const shoulderBlend = 1 - smoothstep01((absX - (maxShoulderX - 0.010)) / 0.055);
      const shoulderWeight = neckBlend * shoulderBlend;
      weights[i] = shoulderWeight;

      if (shoulderWeight > 1e-3) {
        const yTarget = getAvatarShoulderRidgeY(absX, isMale) + effOffset;
        const yActual = ys[jFirst * vw + i];
        dys[i] = (yTarget - yActual) * shoulderWeight;
      }
    }

    // 1D Gaussian-like smoothing across columns to prevent stepped ledges between adjacent columns
    const smoothedDy = new Float32Array(dys);
    for (let i = 1; i < vw - 1; i++) {
      if (weights[i] > 1e-3 || weights[i - 1] > 1e-3 || weights[i + 1] > 1e-3) {
        smoothedDy[i] = 0.25 * dys[i - 1] + 0.50 * dys[i] + 0.25 * dys[i + 1];
      }
    }

    for (let i = 0; i < vw; i++) {
      const jFirst = jFirsts[i];
      if (jFirst < 0) continue;
      const shoulderWeight = weights[i];
      if (shoulderWeight <= 1e-3) continue;

      const xCol = xs[jFirst * vw + i];
      const absX = Math.abs(xCol);
      const dy = smoothedDy[i];
      const yTarget = getAvatarShoulderRidgeY(absX, isMale) + effOffset;
      const shSlice = getTorsoSlice(yTarget, isMale);

      // Anatomically contoured deltoid & trapezius depth that rolls smoothly over the shoulder cap
      // and guarantees full anterior clavicle & posterior trapezius clearance (zero shoulder skin holes!)
      const lateralRolloff = Math.cos(clamp(absX / (maxShoulderX + 0.045), 0, 1) * (Math.PI * 0.42));
      const minShFront = (shSlice.rzFront + effOffset + 0.004) * Math.max(0.72, lateralRolloff) * shoulderWeight;
      const minShBack = (shSlice.rzBack + effOffset + 0.004) * Math.max(0.72, lateralRolloff) * shoulderWeight;

      for (let dj = 0; dj <= 6 && jFirst + dj < vh; dj++) {
        const sIdx = (jFirst + dj) * vw + i;
        if (!inside[sIdx]) continue;
        const depthGrad = 0.92 + 0.08 * Math.sin((dj / 6) * (Math.PI * 0.5));
        offF[sIdx] = Math.max(offF[sIdx], minShFront * depthGrad);
        offB[sIdx] = Math.max(offB[sIdx], minShBack * depthGrad);
      }

      if (Math.abs(dy) >= 1e-4) {
        for (let j = 0; j < jFirst; j++) {
          ys[j * vw + i] += dy;
        }
        for (let dj = 0; dj <= decayRows && jFirst + dj < vh; dj++) {
          const w = 1 - smoothstep01(dj / decayRows);
          ys[(jFirst + dj) * vw + i] += dy * w;
        }
      }

      if (!isStandalone && shoulderWeight >= 0.85) {
        ys[jFirst * vw + i] = yTarget;
      }
    }

    // Enforce strict vertical monotonicity down every column so triangles never fold backwards or invert normals
    for (let i = 0; i < vw; i++) {
      for (let j = 1; j < vh; j++) {
        const prevIdx = (j - 1) * vw + i;
        const curIdx = j * vw + i;
        if (ys[curIdx] >= ys[prevIdx] - 1e-4) {
          ys[curIdx] = ys[prevIdx] - 0.001;
        }
      }
    }
  }

  // 4-pass Laplacian smoothing of the depth offsets (strictly positive interior neighbors only
  // so boundary/cap-row offF=0 vertices never pull waistbands, shoulders, or outer thighs inward)
  for (let pass = 0; pass < 4; pass++) {
    const tmpF = new Float32Array(offF);
    const tmpB = new Float32Array(offB);
    for (let j = 1; j < vh - 1; j++) {
      for (let i = 1; i < vw - 1; i++) {
        const idx = j * vw + i;
        if (!inside[idx] || offF[idx] <= 1e-5) continue;
        const up = idx - vw;
        const dn = idx + vw;
        const lf = idx - 1;
        const rt = idx + 1;
        if (!inside[up] || !inside[dn] || !inside[lf] || !inside[rt]) continue;
        if (offF[up] <= 1e-5 || offF[dn] <= 1e-5 || offF[lf] <= 1e-5 || offF[rt] <= 1e-5) continue;
        const smF = 0.125 * (offF[up] + offF[dn] + offF[lf] + offF[rt]) + 0.5 * offF[idx];
        const smB = 0.125 * (offB[up] + offB[dn] + offB[lf] + offB[rt]) + 0.5 * offB[idx];
        tmpF[idx] = smF;
        tmpB[idx] = smB;
      }
    }
    offF.set(tmpF);
    offB.set(tmpB);
  }

  // ?? Column-Wise Top & Bottom Boundary Vertex Snap ??
  // For any column i, vertices strictly above jFirstCol[i] (or below jLastCol[i]) are outside the
  // garment's vertical span in that column. Snapping them onto (i, jFirstCol[i]) / (i, jLastCol[i])
  // collapses any stepped quad along a sloped shoulder, collar, waistband, or hem into a smooth
  // diagonal triangle with full surface depth (never diving to z = baseZ or creating sawtooth teeth!).
  for (let i = 0; i < vw; i++) {
    let jFirst = -1;
    let jLast = -1;
    for (let j = jFabricTop; j <= jFabricBottom; j++) {
      if (inside[j * vw + i]) {
        if (jFirst < 0) jFirst = j;
        jLast = j;
      }
    }
    if (jFirst > 0) {
      const src = jFirst * vw + i;
      for (let j = 0; j < jFirst; j++) {
        const dst = j * vw + i;
        xs[dst] = xs[src];
        ys[dst] = ys[src];
        offF[dst] = offF[src];
        offB[dst] = offB[src];
        baseZ[dst] = baseZ[src];
        uCols[dst] = uCols[src];
      }
    }
    if (jLast >= 0 && jLast < vh - 1) {
      const src = jLast * vw + i;
      for (let j = jLast + 1; j < vh; j++) {
        const dst = j * vw + i;
        xs[dst] = xs[src];
        ys[dst] = ys[src];
        offF[dst] = offF[src];
        offB[dst] = offB[src];
        baseZ[dst] = baseZ[src];
        uCols[dst] = uCols[src];
      }
    }
  }

  // Swing photographed sleeves down along the avatar's arms
  let sleevePose = null;
  if (poseSleeves && isTopOrBody) {
    sleevePose = retargetSleeves({ xs, ys, inside, vw, vh, isMale, layerOffset: effOffset, getTorsoSlice });
  }

  const frontPos = new Float32Array(vw * vh * 3);
  const backPos = new Float32Array(vw * vh * 3);
  for (let idx = 0; idx < vw * vh; idx++) {
    frontPos[idx * 3] = xs[idx];
    frontPos[idx * 3 + 1] = ys[idx];
    frontPos[idx * 3 + 2] = baseZ[idx] + offF[idx];
    backPos[idx * 3] = xs[idx];
    backPos[idx * 3 + 1] = ys[idx];
    backPos[idx * 3 + 2] = baseZ[idx] - offB[idx];
  }

  // UVs: both sheets sample their texture at the same normalised position, clamped
  // inside the opaque run so boundary triangles never clip or tear along the seam.
  const uvFront = new Float32Array(vw * vh * 2);
  const uvBack = new Float32Array(vw * vh * 2);
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const idx = j * vw + i;
      const u = clamp(uCols[idx] / nx, 0, 1);
      let jSample = j;
      if (jFirstWaistCol && j >= jFabricTop && j <= waistLevelLimitRow) {
        const colIdx = Math.round(clamp(uCols[idx], 0, nx));
        const jTopCol = Math.min(waistLevelLimitRow - 1, jFirstWaistCol[colIdx] + 0.5);
        const tRow = (j - jFabricTop) / Math.max(1, waistLevelLimitRow - jFabricTop);
        jSample = jTopCol + tRow * (waistLevelLimitRow - jTopCol);
      }
      const v = 1 - clamp(jSample / ny, 0, 1);
      uvFront[idx * 2] = u;
      uvFront[idx * 2 + 1] = v;
      uvBack[idx * 2] = u;
      uvBack[idx * 2 + 1] = v;
    }
  }

  // Helper: check if a row's runs contain fabric on the specified leg side
  const hasLegOnSide = (runs, side) => {
    if (!runs || !runs.length) return false;
    for (let k = 0; k < runs.length; k++) {
      const c = (runs[k][0] + runs[k][1]) * 0.5;
      if (side < 0 && c <= colMid) return true;
      if (side > 0 && c >= colMid) return true;
    }
    return false;
  };

  // Index: keep every cell the fabric overlaps (in this row band or the next)
  const cellHasFabric = (i, j) => {
    if (j < jFabricTop || j >= jFabricBottom) return false;
    const lo = i;
    const hi = i + 1;
    const currRuns = runsByRow[j];
    const nextRuns = runsByRow[j + 1];

    // For pants/bottoms below crotch:
    // 1. Do not bridge across the crotch void where separated legs have empty space between them.
    // 2. Do not bridge under a terminated pant leg hem when the adjacent row has no fabric on that side
    //    (strictly prevents horizontal polygon shelves spanning from a shorter cuff across to the other leg).
    if (isBottom) {
      if (currRuns && currRuns.length >= 2 && nextRuns && nextRuns.length >= 2) {
        const gapStart = Math.max(currRuns[0][1], nextRuns[0][1]);
        const gapEnd = Math.min(currRuns[1][0], nextRuns[1][0]);
        if (gapEnd > gapStart && lo >= gapStart && hi <= gapEnd) {
          // Strictly only bridge at the exact crotch apex row (j === crotchRow) across 1 cell
          const isCrotchApexRow = j === crotchRow;
          const isCenterApexCell = Math.abs((lo + hi) * 0.5 - colMid) <= 1.0;
          if (isCrotchApexRow && isCenterApexCell) {
            return true;
          }
          return false;
        }
      }

      if (j >= crotchRow) {
        const cCell = (lo + hi) * 0.5;
        const side = cCell < colMid ? -1 : 1;
        const hasCurrOnSide = hasLegOnSide(currRuns, side);
        const hasNextOnSide = hasLegOnSide(nextRuns, side);
        if (hasCurrOnSide && !hasNextOnSide) return false;
        if (!hasCurrOnSide && hasNextOnSide) return false;
      }
    }

    for (let r = j; r <= j + 1; r++) {
      const runs = runsByRow[r];
      for (let k = 0; k < runs.length; k++) {
        if (runs[k][0] <= hi && runs[k][1] >= lo) return true;
      }
    }
    return false;
  };
  const addTri = (idxArr, posArr, p0, p1, p2) => {
    const ax = posArr[p1 * 3] - posArr[p0 * 3];
    const ay = posArr[p1 * 3 + 1] - posArr[p0 * 3 + 1];
    const az = posArr[p1 * 3 + 2] - posArr[p0 * 3 + 2];
    const bx = posArr[p2 * 3] - posArr[p0 * 3];
    const by = posArr[p2 * 3 + 1] - posArr[p0 * 3 + 1];
    const bz = posArr[p2 * 3 + 2] - posArr[p0 * 3 + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const areaSq = cx * cx + cy * cy + cz * cz;
    if (areaSq > 1e-10) {
      idxArr.push(p0, p1, p2);
    }
  };

  const frontIdx = [];
  const backIdx = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cellHasFabric(i, j)) continue;
      const a = j * vw + i;
      const b = a + 1;
      const c = a + vw;
      const d = c + 1;
      addTri(frontIdx, frontPos, a, c, b);
      addTri(frontIdx, frontPos, b, c, d);
      addTri(backIdx, backPos, a, b, c);
      addTri(backIdx, backPos, b, d, c);
    }
  }

  const makeGeo = (pos, uv, index) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  };

  const front = makeGeo(frontPos, uvFront, frontIdx);
  const back = makeGeo(backPos, uvBack, backIdx);

  // Smooth boundary vertex normals between front and back sheets:
  // At edge vertices where depth offset is small (offF <= 0.006 and offB <= 0.006),
  // average the normals (setting normal Z to 0 so light wraps continuously around the flank).
  const fNorm = front.attributes.normal.array;
  const bNorm = back.attributes.normal.array;
  for (let idx = 0; idx < vw * vh; idx++) {
    if (offF[idx] <= 0.006 && offB[idx] <= 0.006) {
      const p = idx * 3;
      const nxAvg = (fNorm[p] + bNorm[p]) * 0.5;
      const nyAvg = (fNorm[p + 1] + bNorm[p + 1]) * 0.5;
      const len = Math.hypot(nxAvg, nyAvg);
      if (len > 1e-4) {
        const nxN = nxAvg / len;
        const nyN = nyAvg / len;
        fNorm[p] = nxN;
        fNorm[p + 1] = nyN;
        fNorm[p + 2] = 0;
        bNorm[p] = nxN;
        bNorm[p + 1] = nyN;
        bNorm[p + 2] = 0;
      }
    }
  }
  front.attributes.normal.needsUpdate = true;
  back.attributes.normal.needsUpdate = true;

  return {
    ok: true,
    front,
    back,
    info: { nx, ny, crotchRow, sCorr, sleevePose, runsPerRow: runsByRow.map((r) => r.length) },
  };
}

/**
 * Decides whether another group image is a plausible back view of the host
 * garment: similar overall colour and a comparable silhouette area & aspect ratio.
 */
export function isConsistentView(frontStats, otherStats) {
  if (!frontStats || !otherStats) return false;
  const dr = frontStats.mean[0] - otherStats.mean[0];
  const dg = frontStats.mean[1] - otherStats.mean[1];
  const db = frontStats.mean[2] - otherStats.mean[2];
  const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
  // Note: frontStats.area is a fraction in (0, 1], so use 1e-3 (not 1) as denominator floor!
  const areaRatio = otherStats.area / Math.max(1e-3, frontStats.area);
  const aspectRatio = otherStats.aspect / Math.max(1e-3, frontStats.aspect);
  return colorDist < 72 && areaRatio > 0.48 && areaRatio < 2.1 && aspectRatio > 0.62 && aspectRatio < 1.55;
}

/**
 * Classifies an additional item-group POV image as 'back', 'side', or null.
 */
export function classifyGroupView(frontStats, otherStats, hintText = '') {
  if (!frontStats || !otherStats) return null;
  const hint = String(hintText || '').toLowerCase();
  const dr = frontStats.mean[0] - otherStats.mean[0];
  const dg = frontStats.mean[1] - otherStats.mean[1];
  const db = frontStats.mean[2] - otherStats.mean[2];
  const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
  if (colorDist >= 85) return null;

  if (/(?:\b(?:side|profile)\b|??|??????)/i.test(hint)) return 'side';
  if (/(?:\b(?:back|rear|behind)\b|??|????)/i.test(hint)) return 'back';

  const aspectRatio = otherStats.aspect / Math.max(1e-3, frontStats.aspect);
  const areaRatio = otherStats.area / Math.max(1e-3, frontStats.area);
  if (aspectRatio >= 0.62 && aspectRatio <= 1.55 && areaRatio > 0.45 && areaRatio < 2.2) {
    return 'back';
  }
  if (aspectRatio >= 0.20 && aspectRatio < 0.62 && areaRatio > 0.25 && areaRatio < 1.8) {
    return 'side';
  }
  return null;
}

/**
 * Extracts a row-by-row sagittal depth modulation profile from a side-view silhouette mask.
 */
export function extractSideProfile(shellMask, sideAspect = 0.5, frontAspect = 1.0) {
  if (!shellMask || !shellMask.runsByRow || !shellMask.runsByRow.length) return null;
  const { runsByRow, nx } = shellMask;
  const widths = runsByRow.map((runs) => {
    if (!runs || !runs.length) return 0;
    let minA = Infinity, maxB = -Infinity;
    runs.forEach(([a, b]) => {
      if (a < minA) minA = a;
      if (b > maxB) maxB = b;
    });
    return maxB > minA ? (maxB - minA) / Math.max(1, nx) : 0;
  });
  const nonZero = widths.filter((w) => w > 0.05);
  if (!nonZero.length) return null;
  const med = percentile(nonZero, 0.50) || 0.5;
  const baseScale = clamp((sideAspect / Math.max(0.2, frontAspect)) / 0.45, 0.88, 1.22);
  const ratios = widths.map((w) => (w > 0.05 ? clamp((w / med) * baseScale, 0.85, 1.30) : baseScale));
  return { ratios, baseScale };
}

/**
 * Synthesizes the back fabric texture data from the front garment image:
 *   1. Preserves base fabric colors, lighting gradients, and repeating patterns
 *      (horizontal stripes, vertical stripes, plaid, herringbone, houndstooth, knit weave).
 *   2. Dumps front-only closures (zippers, buttonflies, plackets, belt buckles, drawstrings).
 *   3. Dumps asymmetric pockets, slash pockets, coin pockets, and front logos.
 *   4. Dumps chest/torso graphic prints, slogans, decals, and artwork.
 *   5. Restores authentic high-frequency fabric grain/weave so the back sheet looks
 *      like real woven cloth, not flat blur.
 *
 * Operates on Uint8ClampedArray or Uint8Array of RGBA bytes (length w * h * 4).
 */
export function synthesizeBackFabricData(data, w, h) {
  if (!data || !w || !h) return data;

  for (let y = 0; y < h; y++) {
    const vRel = y / Math.max(1, h - 1);
    const rowOffset = y * w * 4;
    let xMin = -1;
    let xMax = -1;
    for (let x = 0; x < w; x++) {
      if (data[rowOffset + x * 4 + 3] >= 96) {
        if (xMin < 0) xMin = x;
        xMax = x;
      }
    }
    if (xMin < 0 || xMax - xMin < 16) continue;
    const span = xMax - xMin + 1;

    // Clean outer flanks: left [2%..15%], right [85%..98%]
    const lStart = Math.min(span - 1, Math.max(0, Math.floor(0.02 * span)));
    const lEnd = Math.min(span, Math.max(lStart + 1, Math.floor(0.15 * span)));
    const rStart = Math.min(span - 1, Math.max(0, Math.floor(0.85 * span)));
    const rEnd = Math.min(span, Math.max(rStart + 1, Math.floor(0.98 * span)));

    let lSumR = 0, lSumG = 0, lSumB = 0, lCount = 0;
    const lSamples = [];
    for (let i = lStart; i < lEnd; i++) {
      const idx = rowOffset + (xMin + i) * 4;
      if (data[idx + 3] >= 96) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        lSumR += r; lSumG += g; lSumB += b; lCount++;
        lSamples.push([r, g, b]);
      }
    }

    let rSumR = 0, rSumG = 0, rSumB = 0, rCount = 0;
    const rSamples = [];
    for (let i = rStart; i < rEnd; i++) {
      const idx = rowOffset + (xMin + i) * 4;
      if (data[idx + 3] >= 96) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        rSumR += r; rSumG += g; rSumB += b; rCount++;
        rSamples.push([r, g, b]);
      }
    }

    if (lCount === 0 && rCount === 0) continue;

    let cL = lCount > 0 ? [lSumR / lCount, lSumG / lCount, lSumB / lCount] : null;
    let cR = rCount > 0 ? [rSumR / rCount, rSumG / rCount, rSumB / rCount] : null;
    if (!cL) cL = cR;
    if (!cR) cR = cL;

    const grainSrc = [...lSamples, ...rSamples];
    let flankVarSum = 0;
    const midR = (cL[0] + cR[0]) / 2;
    const midG = (cL[1] + cR[1]) / 2;
    const midB = (cL[2] + cR[2]) / 2;
    for (let s = 0; s < grainSrc.length; s++) {
      const dr = grainSrc[s][0] - midR;
      const dg = grainSrc[s][1] - midG;
      const db = grainSrc[s][2] - midB;
      flankVarSum += Math.sqrt(dr * dr + dg * dg + db * db);
    }
    const sigma = grainSrc.length > 0 ? flankVarSum / grainSrc.length : 8;
    const tol = Math.max(18, sigma * 1.9);

    const curR = new Float32Array(span);
    const curG = new Float32Array(span);
    const curB = new Float32Array(span);
    const baseR = new Float32Array(span);
    const baseG = new Float32Array(span);
    const baseB = new Float32Array(span);
    const diffBase = new Float32Array(span);

    for (let i = 0; i < span; i++) {
      const idx = rowOffset + (xMin + i) * 4;
      const cr = data[idx], cg = data[idx + 1], cb = data[idx + 2];
      curR[i] = cr; curG[i] = cg; curB[i] = cb;

      const u = i / (span - 1);
      const bR = (1 - u) * cL[0] + u * cR[0];
      const bG = (1 - u) * cL[1] + u * cR[1];
      const bB = (1 - u) * cL[2] + u * cR[2];
      baseR[i] = bR; baseG[i] = bG; baseB[i] = bB;

      const dr = cr - bR;
      const dg = cg - bG;
      const db = cb - bB;
      diffBase[i] = Math.sqrt(dr * dr + dg * dg + db * db);
    }

    // 1. Bilateral symmetry check for pockets / asymmetric details (coin pockets, breast pockets, logos)
    for (let i = 0; i < span; i++) {
      const mi = span - 1 - i;
      const dAsym = Math.sqrt(
        (curR[i] - curR[mi]) ** 2 +
        (curG[i] - curG[mi]) ** 2 +
        (curB[i] - curB[mi]) ** 2
      );
      if ((diffBase[i] - diffBase[mi] >= 10) || (dAsym >= 12 && diffBase[i] > diffBase[mi] + 6)) {
        curR[i] = curR[mi];
        curG[i] = curG[mi];
        curB[i] = curB[mi];
        diffBase[i] = diffBase[mi];
      }
    }

    // 2. Dump center closures: zipper tracks, zipper pulls, button plackets, buttonflies, J-stitch fly seams, waistband button/fly
    const cMidL = Math.floor(0.35 * span);
    const cMidR = Math.min(span - 1, Math.ceil(0.65 * span));
    if (cMidR > cMidL + 2) {
      const colLR = curR[cMidL], colLG = curG[cMidL], colLB = curB[cMidL];
      const colRR = curR[cMidR], colRG = curG[cMidR], colRB = curB[cMidR];
      for (let i = cMidL + 1; i < cMidR; i++) {
        const t = (i - cMidL) / (cMidR - cMidL);
        const s = t * t * (3 - 2 * t);
        const brR = (1 - s) * colLR + s * colRR;
        const brG = (1 - s) * colLG + s * colRG;
        const brB = (1 - s) * colLB + s * colRB;
        const distFromBridge = Math.sqrt(
          (curR[i] - brR) ** 2 + (curG[i] - brG) ** 2 + (curB[i] - brB) ** 2
        );
        if (diffBase[i] > 6 || distFromBridge > 6) {
          curR[i] = brR;
          curG[i] = brG;
          curB[i] = brB;
          const dr = brR - baseR[i], dg = brG - baseG[i], db = brB - baseB[i];
          diffBase[i] = Math.sqrt(dr * dr + dg * dg + db * db);
        }
      }
    }

    // 2b. Dump front pockets (hip slash pockets, patch pockets, cargo pockets, kangaroo pockets),
    // belt loops, rivets, and fine front stitching/details across the interior when flanks are uniform/horizontally striped
    if (sigma < 22) {
      const pStart = Math.floor(0.08 * span);
      const pEnd = Math.min(span - 1, Math.ceil(0.92 * span));
      if (pEnd > pStart + 2) {
        const fineThreshold = Math.max(7, sigma * 1.15);
        for (let i = pStart + 1; i < pEnd; i++) {
          const prevDiff = i > 0 ? Math.hypot(curR[i] - curR[i - 1], curG[i] - curG[i - 1], curB[i] - curB[i - 1]) : 0;
          if (diffBase[i] > fineThreshold || prevDiff > Math.max(9, sigma * 1.3)) {
            let synR = baseR[i];
            let synG = baseG[i];
            let synB = baseB[i];
            if (grainSrc.length > 0) {
              const gSample = grainSrc[i % grainSrc.length];
              synR = Math.max(0, Math.min(255, synR + (gSample[0] - midR) * 0.65));
              synG = Math.max(0, Math.min(255, synG + (gSample[1] - midG) * 0.65));
              synB = Math.max(0, Math.min(255, synB + (gSample[2] - midB) * 0.65));
            }
            curR[i] = synR;
            curG[i] = synG;
            curB[i] = synB;
            diffBase[i] = 0;
          }
        }
      }
    }

    // 3. Inpaint remaining graphic prints & fine front details (contiguous anomalies in torso u_rel in [0.12, 0.88])
    const torsoStart = Math.floor(0.12 * span);
    const torsoEnd = Math.min(span - 1, Math.ceil(0.88 * span));
    let inRun = false;
    let runStart = 0;
    const runsToInpaint = [];
    for (let i = torsoStart; i <= torsoEnd; i++) {
      const isAnomaly = diffBase[i] > tol;
      if (isAnomaly && !inRun) {
        inRun = true;
        runStart = i;
      } else if (!isAnomaly && inRun) {
        runsToInpaint.push([runStart, i - 1]);
        inRun = false;
      }
    }
    if (inRun) {
      runsToInpaint.push([runStart, torsoEnd]);
    }

    for (const [rStartIdx, rEndIdx] of runsToInpaint) {
      const bLeft = Math.max(0, rStartIdx - 1);
      const bRight = Math.min(span - 1, rEndIdx + 1);
      const blR = curR[bLeft], blG = curG[bLeft], blB = curB[bLeft];
      const brR = curR[bRight], brG = curG[bRight], brB = curB[bRight];
      const runLen = rEndIdx - rStartIdx + 1;
      for (let k = 0; k < runLen; k++) {
        const idx = rStartIdx + k;
        const t = (k + 1) / (runLen + 1);
        let synR = (1 - t) * blR + t * brR;
        let synG = (1 - t) * blG + t * brG;
        let synB = (1 - t) * blB + t * brB;

        if (grainSrc.length > 0) {
          const gSample = grainSrc[idx % grainSrc.length];
          const gdr = gSample[0] - midR;
          const gdg = gSample[1] - midG;
          const gdb = gSample[2] - midB;
          synR = Math.max(0, Math.min(255, synR + gdr * 0.65));
          synG = Math.max(0, Math.min(255, synG + gdg * 0.65));
          synB = Math.max(0, Math.min(255, synB + gdb * 0.65));
        }

        curR[idx] = synR;
        curG[idx] = synG;
        curB[idx] = synB;
      }
    }

    for (let i = 0; i < span; i++) {
      const idx = rowOffset + (xMin + i) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(curR[i])));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(curG[i])));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(curB[i])));
    }
  }

  return data;
}
