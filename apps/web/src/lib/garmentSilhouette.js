import * as THREE from 'three';

/**
 * Silhouette-driven garment shells
 * --------------------------------
 * Instead of wrapping a photo around a generic cylinder (which discards sleeves,
 * pant legs and every other part of the real silhouette) the garment is rebuilt
 * from its own cut-out:
 *
 *   • The alpha channel of the (background-removed) photo is scanned row by row.
 *   • Every grid row is split into horizontal runs (torso, each sleeve, each leg)
 *     with sub-cell accurate left/right ends, so the shell meets the photographed
 *     outline exactly (no staircase edges).
 *   • Each run is inflated into an elliptical cross-section whose depth follows the
 *     avatar's body profile (torso slice / leg slice), so the garment keeps the
 *     photographed silhouette AND hugs the avatar's point cloud.
 *   • Strict Anatomical Anchors:
 *       - Tops, outerwear, and full-body dresses (except strapless) are strictly
 *         anchored to the avatar's shoulder contour (cannot go lower or higher).
 *       - Bottoms are anchored to the waist and to the crotch (pants leg split
 *         can never go higher than the crotch line).
 *   • A front sheet carries the front photo; a back sheet carries the back photo of
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
export function extractRowRuns(alpha, w, h, nx, ny, threshold = 80) {
  const runsByRow = [];
  const minRunPx = Math.max(2, (w / nx) * 1.2);
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
    runsByRow.push(
      merged
        .filter(([x0, x1]) => x1 - x0 + 1 >= minRunPx)
        .map(([x0, x1]) => [
          clamp((x0 / (w - 1)) * nx, 0, nx),
          clamp(((x1 + 1) / (w - 1)) * nx, 0, nx),
        ])
    );
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
 */
export function getAvatarShoulderRidgeY(absX, isMale = false) {
  const ax = Math.max(0, Number(absX) || 0);
  if (isMale) {
    if (ax <= 0.068) return 1.535;
    if (ax >= 0.220) return 1.470;
    return 1.535 - 0.428 * (ax - 0.068);
  }
  if (ax <= 0.058) return 1.435;
  if (ax >= 0.198) return 1.375;
  return 1.435 - 0.430 * (ax - 0.058);
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
    const isMini = /\b(mini|micro|קצרה|מיני)\b/i.test(metaText);
    const isMaxi = /\b(maxi|gown|long|ארוכה|מקסי)\b/i.test(metaText);
    if (isMini) return { lengthType: 'mini_skirt', yBottom: isMale ? 0.76 : 0.72 };
    if (isMaxi) return { lengthType: 'maxi_skirt', yBottom: isMale ? 0.16 : 0.12 };
    return { lengthType: 'midi_skirt', yBottom: isMale ? 0.48 : 0.44 };
  }

  // Bottoms (pants, shorts, culottes, etc.)
  // 1. Explicit keywords in metadata or title
  const isMiniShorts = /\b(hot\s*pants|micro\s*short|mini\s*short|קצרצר|ביקיני|תחתונים|brief|thong|bikini)\b/i.test(metaText);
  const isBermudaOrKnee = /\b(bermuda|knee|knee-high|knee_length|knee-length|ברמודה|עד הברך|ברך)\b/i.test(metaText);
  const isShortsText = /\b(short|shorts|trunk|trunks|boxer|boxers|swim_short|שורט|שורטס|קצרים|מכנסי ים|מכנסי_ים|בוקסר)\b/i.test(metaText);
  const isCapriOr78 = /\b(capri|cropped|culotte|culottes|3\/4|7\/8|seven_eighths|קפרי|שבע שמיניות|שלושת רבעי|שבע_שמיניות|ankle\s*pant)\b/i.test(metaText);

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
  } else {
    // Physical cutout aspect ratio fallback:
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
  isStandalone = false,
  yTop,
  yBottom,
  layerOffset = 0.02,
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

  // Enforce strict top anchor bounds:
  // - Bottoms / skirts are anchored to the avatar waist (isMale ? 1.08 : 1.05).
  // - Strapless tops/dresses sit at the bust/chest line (isMale ? 1.34 : 1.30).
  const effectiveYTop = isBottom || isSkirt
    ? (isMale ? 1.08 : 1.05)
    : (isTopOrBody && isStrapless ? Math.min(yTop, isMale ? 1.34 : 1.30) : yTop);
  const hWorld = Math.max(0.10, effectiveYTop - yBottom);

  // ── Row analysis ──
  const runsByRow = [];
  let total = 0;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (let j = 0; j < vh; j++) {
    const runs = providedRuns ? (providedRuns[j] ? providedRuns[j].map((r) => [r[0], r[1]]) : []) : (mask ? rowRuns(mask, nx, j) : []);
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

  // ── Bottoms: Strict Waist & Crotch Anchor Detection ──
  // Pants are anchored at the waist (jFabricTop -> effectiveYTop) and at the crotch (crotchRow -> yCrotchBody).
  // In no case can pants split into legs higher than the crotch line (yCrotchBody)!
  let crotchRow = -1;
  if (isBottom) {
    const scanStart = Math.min(ny - 4, jFabricTop + Math.max(2, Math.floor(0.14 * fabricHeight)));
    const scanEnd = Math.min(ny - 4, jFabricTop + Math.floor(0.55 * fabricHeight));
    for (let j = scanStart; j <= scanEnd; j++) {
      let stable = true;
      for (let k = 0; k < 4; k++) {
        if ((runsByRow[j + k] || []).length < 2) {
          stable = false;
          break;
        }
      }
      if (stable) {
        crotchRow = j;
        break;
      }
    }
    // Realistic anatomical trouser rise based on effectiveYTop and yCrotchBody:
    const anatomicalRiseFrac = clamp((effectiveYTop - yCrotchBody) / Math.max(0.12, hWorld), 0.16, 0.58);
    const minCrotchRow = jFabricTop + Math.max(2, Math.round(0.16 * fabricHeight));
    const maxCrotchRow = jFabricTop + Math.max(4, Math.round(0.55 * fabricHeight));
    if (crotchRow < 0) {
      crotchRow = jFabricTop + Math.round(anatomicalRiseFrac * fabricHeight);
    } else {
      crotchRow = clamp(crotchRow, minCrotchRow, maxCrotchRow);
    }

    // Strictly unify any split runs ABOVE crotchRow into a single continuous pelvis span [minA, maxB]
    // so pants NEVER split higher than the crotch line and the pelvis never deflates or tears into triangles!
    for (let j = jFabricTop; j < crotchRow; j++) {
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

  // Which vertices lie inside the fabric (for smoothing / cell selection)
  const inside = new Uint8Array(vw * vh);
  runsByRow.forEach((runs, j) => {
    runs.forEach(([a, b]) => {
      for (let i = Math.max(0, Math.ceil(a)); i <= Math.min(nx, Math.floor(b)); i++) inside[j * vw + i] = 1;
    });
  });

  // ── Horizontal scale & Shoulder line detection ──
  const dxUniform = (aspect * hWorld) / nx;

  const detectedShoulder = isTopOrBody && !isStrapless
    ? detectGarmentShoulderRow(runsByRow, nx, ny, dxUniform)
    : 0;
  const shoulderFrac = detectedShoulder / ny;
  const hasHoodOrHanger = !isStandalone && shoulderFrac >= 0.12;

  const rowY = (j) => {
    if (isBottom && crotchRow > jFabricTop) {
      // Strict waist & crotch anchor mapping in both avatar and standalone 3D views
      if (j <= jFabricTop) return effectiveYTop;
      if (j <= crotchRow) {
        const yVal = effectiveYTop + (yCrotchBody - effectiveYTop) * ((j - jFabricTop) / Math.max(1, crotchRow - jFabricTop));
        return clamp(yVal, yCrotchBody, effectiveYTop);
      }
      const bRow = jFabricBottom > crotchRow ? jFabricBottom : ny;
      if (j >= bRow) return yBottom;
      const yLeg = yCrotchBody + (yBottom - yCrotchBody) * ((j - crotchRow) / Math.max(1, bRow - crotchRow));
      return Math.min(yCrotchBody, yLeg);
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
    const target = 2 * (bodyHalfAt(y) + layerOffset) * (isBottom ? 0.98 : 1.04);
    if (wWorld > 1e-3) ratios.push(target / wWorld);
  }

  const colMid = (minCol + maxCol) / 2;
  let waistCenterCol = colMid;
  let sWaistSkirt = 1.0;
  let sCorr;
  if (isStandalone) {
    sCorr = 1.0;
  } else if (isSkirt) {
    const yWaist = effectiveYTop;
    const waistTorso = getTorsoSlice(yWaist, isMale);
    const reqWaistHalf = (waistTorso.rx + layerOffset) * 1.02;

    const waistScanStart = Math.min(vh - 1, jFabricTop + Math.max(1, Math.floor(0.02 * fabricHeight)));
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
    if (!topWidths.length) {
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
    }
    const waistCols = topWidths.length ? percentile(topWidths, 0.50) : nx * 0.4;
    waistCenterCol = topCenters.length ? percentile(topCenters, 0.50) : colMid;
    const waistHalfWorld = Math.max(1e-3, 0.5 * waistCols * dxUniform);
    const sWaist = reqWaistHalf / waistHalfWorld;
    sWaistSkirt = sWaist;

    const hipClearance = [];
    const hipScanStart = Math.min(vh - 1, jFabricTop + Math.max(3, Math.floor(0.20 * fabricHeight)));
    const hipScanEnd = Math.min(vh - 1, jFabricTop + Math.floor(0.50 * fabricHeight));
    for (let j = hipScanStart; j <= hipScanEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      const y = rowY(j);
      let minA = Infinity, maxB = -Infinity;
      runs.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (b > maxB) maxB = b;
      });
      const halfCols = Math.max(1, (maxB - minA) * 0.5);
      const reqHalf = bodyHalfAt(y) + layerOffset;
      hipClearance.push(reqHalf / Math.max(1e-3, halfCols * dxUniform));
    }
    const maxHipClear = hipClearance.length ? Math.max(...hipClearance) : sWaist;
    const sHipBounded = Math.min(sWaist * 1.05, maxHipClear);
    sCorr = clamp(Math.max(sWaist, sHipBounded), 0.45, 2.20);
  } else if (isBottom) {
    const waistTorso = getTorsoSlice(effectiveYTop, isMale);
    const reqWaistHalf = (waistTorso.rx + layerOffset) * 1.02;
    const waistScanEnd = Math.min(vh - 1, jFabricTop + Math.max(2, Math.floor(0.12 * fabricHeight)));
    const topWidths = [];
    for (let j = jFabricTop; j <= waistScanEnd; j++) {
      const runs = runsByRow[j];
      if (!runs || !runs.length) continue;
      let minA = Infinity, maxB = -Infinity;
      runs.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (b > maxB) maxB = b;
      });
      if (maxB > minA) topWidths.push(maxB - minA);
    }
    const waistCols = topWidths.length ? percentile(topWidths, 0.60) : nx * 0.4;
    const waistHalfWorld = Math.max(1e-3, 0.5 * waistCols * dxUniform);
    const sWaist = reqWaistHalf / waistHalfWorld;
    sCorr = clamp(sWaist, 0.72, 1.35);
  } else if (isTopOrBody) {
    const trunkWidths = [];
    const tStart = Math.min(vh - 1, jFabricTop + Math.floor(0.35 * fabricHeight));
    const tEnd = Math.min(vh - 1, jFabricTop + Math.floor(0.80 * fabricHeight));
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
    }
    const trunkCols = trunkWidths.length ? percentile(trunkWidths, 0.50) : nx * 0.45;
    const trunkHalfWorld = Math.max(1e-3, 0.5 * trunkCols * dxUniform);
    const targetTrunkHalf = (getTorsoSlice(1.15, isMale).rx + layerOffset) * 1.02;
    const sTrunk = targetTrunkHalf / trunkHalfWorld;
    sCorr = clamp(sTrunk, 0.68, 1.35);
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

  // ── Per-row geometry ──
  const offF = new Float32Array(vw * vh);
  const offB = new Float32Array(vw * vh);
  const baseZ = new Float32Array(vw * vh);
  const xs = new Float32Array(vw * vh);
  const ys = new Float32Array(vw * vh);
  const uCols = new Float32Array(vw * vh);

  for (let j = 0; j < vh; j++) {
    const y = rowY(j);
    const runs = runsByRow[j];
    const torso = getTorsoSlice(Math.max(0.5, y), isMale);
    const belowCrotch = isBottom && (j >= crotchRow || y < yCrotchBody);
    const leg = belowCrotch ? getLegSlice(y, isMale) : null;

    let legRuns = null;
    if (isBottom && belowCrotch && runs.length >= 2) {
      legRuns = [...runs]
        .sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))
        .slice(0, 2)
        .sort((p, q) => p[0] - q[0]);
    }

    for (let i = 0; i < vw; i++) {
      const idx = j * vw + i;
      const run = resolveVertexRun(i, j);
      const col = run ? clamp(i, run[0], run[1]) : i;
      uCols[idx] = col;

      let x = (col - colMid) * dx;
      if (isSkirt && !isStandalone) {
        const tSkirt = clamp((effectiveYTop - y) / Math.max(0.01, hWorld), 0, 1);
        const rowMid = waistCenterCol * (1 - tSkirt) + colMid * tSkirt;
        const waistFitFactor = tSkirt < 0.15 ? (sWaistSkirt / sCorr) + (1 - sWaistSkirt / sCorr) * (tSkirt / 0.15) : 1.0;
        x = (col - rowMid) * dx * waistFitFactor;
      } else if (isBottom && !isStandalone && !belowCrotch) {
        // Pelvis & Waist (above crotch line):
        // Align top tightly with avatar waist (slice.rx + layerOffset) and guarantee full pelvic width clearance
        // down to the crotch while preserving the garment's cut.
        const tWaist = clamp((y - yCrotchBody) / Math.max(0.01, effectiveYTop - yCrotchBody), 0, 1);
        const slice = getTorsoSlice(y, isMale);
        const minTargetHalf = (slice.rx + layerOffset) * (1.02 + 0.05 * (1 - tWaist));
        let rMinA = Infinity, rMaxB = -Infinity;
        if (runs && runs.length) {
          runs.forEach(([a, b]) => {
            if (a < rMinA) rMinA = a;
            if (b > rMaxB) rMaxB = b;
          });
        }
        const rMid = Number.isFinite(rMinA) ? (rMinA + rMaxB) / 2 : colMid;
        const rHalf = Number.isFinite(rMinA) ? Math.max(1, (rMaxB - rMinA) / 2) : 1;
        const currentHalf = rHalf * dx;
        // At waist (tWaist -> 1), fit tightly to minTargetHalf; at hips/pelvis (tWaist -> 0), never shrink below minTargetHalf
        // while allowing wide-cut hips up to 1.15 * minTargetHalf.
        const maxAllowedHalf = minTargetHalf * (1.02 + 0.13 * (1 - tWaist));
        const targetRowHalf = clamp(currentHalf, minTargetHalf, maxAllowedHalf);
        const fitScale = targetRowHalf / Math.max(1e-3, currentHalf);
        x = (col - rMid) * dx * fitScale;
      } else if (isBottom && !isStandalone && belowCrotch) {
        const legSpread = clamp((j - crotchRow) / 3, 0, 1);
        const activeLegCx = leg.cx * (0.85 + 0.15 * legSpread);

        if (legRuns) {
          const c0 = (legRuns[0][0] + legRuns[0][1]) / 2;
          const c1 = (legRuns[1][0] + legRuns[1][1]) / 2;
          const k = Math.abs(col - c0) <= Math.abs(col - c1) ? 0 : 1;
          const ck = k === 0 ? c0 : c1;
          const halfCols = Math.max(1, (legRuns[k][1] - legRuns[k][0]) / 2);
          const uLeg = clamp((col - ck) / halfCols, -1, 1);
          const side = k === 0 ? -1 : 1;

          // Keep the garment's photographed leg cut (slim vs wide) while guaranteeing
          // full avatar limb clearance and centering each leg tube directly over side * activeLegCx!
          const minLegRadius = (leg.r + layerOffset) * 1.06;
          const photoLegRadius = halfCols * dx;
          const outerRadius = clamp(photoLegRadius, minLegRadius, minLegRadius * 1.38);
          // Inner thigh seam stays cleanly in the inter-thigh cleft (|x| >= 0.012m) and never crosses x = 0
          const maxInnerRadius = Math.max(0.035, activeLegCx - 0.012);
          const innerRadius = Math.min(outerRadius, maxInnerRadius);

          const isInnerSide = side * uLeg < 0;
          const rActive = isInnerSide ? innerRadius : outerRadius;
          x = side * activeLegCx + uLeg * rActive;
        } else {
          // Single-run row at or below crotchRow (e.g. cargo pockets or touching hems/fabric in shorts)
          // Split the single run into left and right leg segments relative to colMid
          // so leg vertices never snap to center x = 0 (which created horizontal sliced bands/shelves!)
          const side = col < colMid ? -1 : 1;
          let legMin = run ? run[0] : 0;
          let legMax = run ? run[1] : nx;
          if (legMin < colMid && legMax > colMid) {
            if (side === -1) legMax = Math.floor(colMid);
            else legMin = Math.ceil(colMid);
          }
          const ck = (legMin + legMax) / 2;
          const halfCols = Math.max(1, (legMax - legMin) / 2);
          const uLeg = clamp((col - ck) / halfCols, -1, 1);

          const minLegRadius = (leg.r + layerOffset) * 1.06;
          const photoLegRadius = halfCols * dx;
          const outerRadius = clamp(photoLegRadius, minLegRadius, minLegRadius * 1.38);
          const maxInnerRadius = Math.max(0.035, activeLegCx - 0.012);
          const innerRadius = Math.min(outerRadius, maxInnerRadius);

          const isInnerSide = side * uLeg < 0;
          const rActive = isInnerSide ? innerRadius : outerRadius;
          x = side * activeLegCx + uLeg * rActive;
        }
      }
      xs[idx] = x;
      ys[idx] = y;
      baseZ[idx] = isStandalone ? 0 : (isBottom && belowCrotch ? leg.cz : torso.cz);
    }

    const sideMod = sideScaleAtRow(j);

    // Depth profile per run (elliptical cross-section, strictly closed at a and b).
    runs.forEach(([a, b]) => {
      const mid = (a + b) / 2;
      const half = Math.max(0.5, (b - a) / 2);
      const halfWorld = half * dx;

      let bodyRzFront, bodyRzBack;
      if (isBottom && belowCrotch) {
        const minF = (leg.rzFront || leg.r) + layerOffset;
        const minB = (leg.rzBack || leg.r) + layerOffset;
        bodyRzFront = Math.max(minF, minF * sideMod);
        bodyRzBack = Math.max(minB, minB * sideMod);
      } else if (isSkirt) {
        const frontClearance = (y <= 1.05 && y >= 0.75) ? 0.132 : 0.108;
        const baseRzFront = Math.max(((torso ? torso.rzFront : null) || 0.108), frontClearance) + layerOffset;
        const buttockClearance = (y <= 1.05 && y >= 0.75) ? 0.134 : 0.108;
        const baseRzBack = Math.max(((torso ? torso.rzBack : null) || 0.108), buttockClearance) + layerOffset;

        const flareProgress = clamp((0.84 - y) / Math.max(0.01, 0.84 - yBottom), 0, 1);
        bodyRzFront = (baseRzFront + flareProgress * Math.max(0, 0.32 * halfWorld - baseRzFront)) * sideMod;
        bodyRzBack = (baseRzBack + flareProgress * Math.max(0, 0.32 * halfWorld - baseRzBack)) * sideMod;
      } else {
        const minF = (torso.rzFront || torso.rz) + layerOffset;
        const minB = (torso.rzBack || torso.rz) + layerOffset;
        bodyRzFront = Math.max(minF, minF * sideMod);
        bodyRzBack = Math.max(minB, minB * sideMod);
      }

      // In standalone 3D Garment View, use a consistent 0.82 scale of the full anatomical depth
      // across both pelvis and legs (and torso) so the pelvis NEVER deflates relative to the legs!
      if (isStandalone) {
        bodyRzFront *= 0.82;
        bodyRzBack *= 0.82;
      }

      // Dresses / long coats flare below the hips
      if (!isBottom && !isSkirt && !isStandalone && y < 0.84) {
        bodyRzFront = Math.max(bodyRzFront, 0.42 * halfWorld);
        bodyRzBack = Math.max(bodyRzBack, 0.42 * halfWorld);
      }

      const isShoulderZone = !isBottom && !isSkirt && y >= (isMale ? 1.35 : 1.29);
      const isBodySpan = isBottom || isSkirt || halfWorld >= torso.rx * 0.72 || isShoulderZone;
      const ampFront = isBodySpan ? bodyRzFront : Math.min(bodyRzFront, halfWorld * 1.05 + 0.012);
      const ampBack = isBodySpan ? bodyRzBack : Math.min(bodyRzBack, halfWorld * 1.05 + 0.012);

      // For sloped shoulder rows near the top of shirts/jackets, normalize u against the full shoulder span
      // so diagonal shoulder edges retain full anterior/posterior clavicle & scapula depth.
      const effectiveHalf = isShoulderZone
        ? Math.max(half, ((torso.rx + layerOffset) * 0.96) / Math.max(1e-4, dx))
        : half;

      const iStart = Math.max(0, Math.ceil(a + 0.02));
      const iEnd = Math.min(nx, Math.floor(b - 0.02));

      for (let i = iStart; i <= iEnd; i++) {
        const u = clamp((i - mid) / effectiveHalf, -1, 1);
        const s = Math.max(0, 1 - u * u);
        const taperWidth = isBottom ? 0.08 : 0.12;
        const edgeTaper = isShoulderZone
          ? smoothstep01((1 - Math.abs(u)) / 0.05)
          : smoothstep01((1 - Math.abs(u)) / taperWidth);
        const hhFront = (isBottom ? Math.pow(s, 0.38) : (isBodySpan ? Math.pow(s, 0.44) : Math.sqrt(s))) * edgeTaper;
        // Natural anatomical back curvature (0.42 power instead of flat box) eliminates robot torso
        const hhBack = (isBottom ? Math.pow(s, 0.36) : (isBodySpan ? Math.pow(s, 0.42) : Math.pow(s, 0.44))) * edgeTaper;
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

  // ── Strict Column-Wise Shoulder Line Anchor for Tops, Outerwear & Full-Body Garments ──
  // Anchors the top shoulder edge of every column across the left and right shoulders
  // directly to the avatar's anatomical shoulder contour (cannot go lower or higher).
  if (isTopOrBody && !isStrapless) {
    const minNeckX = isMale ? 0.064 : 0.054;
    const maxShoulderX = isMale ? 0.222 : 0.198;
    const decayRows = Math.max(6, Math.round(0.28 * fabricHeight));
    const minStartRow = hasHoodOrHanger ? Math.max(0, detectedShoulder - 2) : 0;

    for (let i = 0; i < vw; i++) {
      let jFirst = -1;
      for (let j = minStartRow; j <= jFabricBottom; j++) {
        if (inside[j * vw + i]) {
          jFirst = j;
          break;
        }
      }
      if (jFirst < 0 || jFirst > jFabricTop + Math.round(0.25 * fabricHeight)) continue;
      const xCol = xs[jFirst * vw + i];
      const absX = Math.abs(xCol);

      // Smooth blend near neck line and outer deltoid/acromion
      const neckBlend = smoothstep01((absX - (minNeckX - 0.025)) / 0.035);
      const shoulderBlend = 1 - smoothstep01((absX - (maxShoulderX - 0.030)) / 0.045);
      const shoulderWeight = neckBlend * shoulderBlend;
      if (shoulderWeight <= 1e-3) continue;

      const yTarget = getAvatarShoulderRidgeY(absX, isMale);
      const yActual = ys[jFirst * vw + i];
      const dy = clamp(yTarget - yActual, -0.12, 0.12) * shoulderWeight;
      if (Math.abs(dy) < 1e-4) continue;

      // Apply anchor shift to cap rows above jFirst and decay smoothly down to chest/armpit
      for (let j = 0; j < jFirst; j++) {
        ys[j * vw + i] += dy;
      }
      for (let dj = 0; dj <= decayRows && jFirst + dj < vh; dj++) {
        const w = 1 - smoothstep01(dj / decayRows);
        ys[(jFirst + dj) * vw + i] += dy * w;
      }
    }
  }

  // 4-pass Laplacian smoothing of the depth offsets (interior vertices only; boundary stays pinned to 0)
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
        const smF = 0.125 * (offF[up] + offF[dn] + offF[lf] + offF[rt]) + 0.5 * offF[idx];
        const smB = 0.125 * (offB[up] + offB[dn] + offB[lf] + offB[rt]) + 0.5 * offB[idx];
        tmpF[idx] = smF;
        tmpB[idx] = smB;
      }
    }
    offF.set(tmpF);
    offB.set(tmpB);
  }

  // Swing photographed sleeves down along the avatar's arms
  let sleevePose = null;
  if (poseSleeves && isTopOrBody) {
    sleevePose = retargetSleeves({ xs, ys, inside, vw, vh, isMale, layerOffset, getTorsoSlice });
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
      const v = 1 - j / ny;
      uvFront[idx * 2] = u;
      uvFront[idx * 2 + 1] = v;
      uvBack[idx * 2] = u;
      uvBack[idx * 2 + 1] = v;
    }
  }

  // Index: keep every cell the fabric overlaps (in this row band or the next)
  const cellHasFabric = (i, j) => {
    const lo = i;
    const hi = i + 1;

    // For pants/bottoms: do not bridge across the crotch void when BOTH adjacent rows have separated legs
    if (isBottom) {
      const currRuns = runsByRow[j];
      const nextRuns = runsByRow[j + 1];
      if (currRuns && currRuns.length >= 2 && nextRuns && nextRuns.length >= 2) {
        const gapStart = Math.min(currRuns[0][1], nextRuns[0][1]);
        const gapEnd = Math.max(currRuns[1][0], nextRuns[1][0]);
        if (lo >= gapStart && hi <= gapEnd) return false;
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
  const frontIdx = [];
  const backIdx = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cellHasFabric(i, j)) continue;
      const a = j * vw + i;
      const b = a + 1;
      const c = a + vw;
      const d = c + 1;
      frontIdx.push(a, c, b, b, c, d);
      backIdx.push(a, b, c, b, d, c);
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

  if (/(?:\b(?:side|profile)\b|צד|פרופיל)/i.test(hint)) return 'side';
  if (/(?:\b(?:back|rear|behind)\b|גב|אחור)/i.test(hint)) return 'back';

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

    // 2. Dump center closures: zipper tracks, zipper pulls, button plackets, buttonflies, waistband button/fly
    const cMidL = Math.floor(0.39 * span);
    const cMidR = Math.min(span - 1, Math.ceil(0.61 * span));
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
        if (diffBase[i] > 8 || distFromBridge > 8) {
          curR[i] = brR;
          curG[i] = brG;
          curB[i] = brB;
          const dr = brR - baseR[i], dg = brG - baseG[i], db = brB - baseB[i];
          diffBase[i] = Math.sqrt(dr * dr + dg * dg + db * db);
        }
      }
    }

    // 2b. Dump front hip slash-pocket openings & belt loops in the upper pelvic band (vRel in 0.02..0.34)
    if (vRel >= 0.02 && vRel <= 0.34 && sigma < 24) {
      const pBands = [
        [Math.floor(0.08 * span), Math.floor(0.34 * span)],
        [Math.floor(0.66 * span), Math.min(span - 1, Math.ceil(0.92 * span))],
      ];
      for (const [pL, pR] of pBands) {
        if (pR > pL + 2) {
          const lR = curR[pL], lG = curG[pL], lB = curB[pL];
          const rR = curR[pR], rG = curG[pR], rB = curB[pR];
          for (let i = pL + 1; i < pR; i++) {
            if (diffBase[i] > Math.max(10, sigma * 1.35)) {
              const t = (i - pL) / (pR - pL);
              curR[i] = (1 - t) * lR + t * rR;
              curG[i] = (1 - t) * lG + t * rG;
              curB[i] = (1 - t) * lB + t * rB;
              const dr = curR[i] - baseR[i], dg = curG[i] - baseG[i], db = curB[i] - baseB[i];
              diffBase[i] = Math.sqrt(dr * dr + dg * dg + db * db);
            }
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
