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
 *   • A front sheet carries the front photo; a back sheet carries the back photo of
 *     the item group when available (otherwise a colour-consistent fallback).
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
    // Merge runs separated by tiny gaps (anti-aliasing / hairline seams / narrow armpit creases)
    const merged = [];
    px.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] <= Math.max(3, w * 0.03)) last[1] = r[1];
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
    // The cuff is the fabric point farthest from the shoulder, outside the torso
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
    // Small corrections only: swinging a fully raised arm through >50° folds the cloth,
    // so those photos keep their original (faithful) sleeve pose.
    if (Math.abs(phi) < 0.05 || Math.abs(phi) > 0.9) return;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    for (let idx = 0; idx < vw * vh; idx++) {
      const x = xs[idx] * side;
      const y = ys[idx];
      if (x <= 0 || y < 0.8) continue;
      const torso = getTorsoSlice(y, isMale);
      const r = Math.hypot(x - pivotX, y - pivotY);
      const w = smoothstep01((x - (torso.rx + layerOffset)) / 0.06) * smoothstep01(r / 0.1);
      if (w <= 0) continue;
      const dxp = x - pivotX;
      const dyp = y - pivotY;
      const nx2 = pivotX + dxp * cos - dyp * sin;
      const ny2 = pivotY + dxp * sin + dyp * cos;
      xs[idx] = side * (x + (nx2 - x) * w);
      ys[idx] = y + (ny2 - y) * w;
    }
    applied.push({ side, phiDeg: (phi * 180) / Math.PI });
  });
  return applied;
}

/**
 * Builds the front and back sheets of a silhouette shell.
 *
 * @param {object} p
 * @param {Array}  [p.runsByRow]   sub-cell runs per grid row (preferred)
 * @param {Uint8Array} [p.mask]    (nx+1)*(ny+1) vertex mask (used when runsByRow is absent)
 * @param {number} p.nx
 * @param {number} p.ny
 * @param {number} p.aspect        crop width / crop height of the photo
 * @param {string} p.slot          'top' | 'outerwear' | 'dress' | 'bottom'
 * @param {number} p.yTop          world y of the photo's top edge
 * @param {number} p.yBottom       world y of the photo's bottom edge
 * @param {number} p.layerOffset   clearance above the body surface (m)
 * @param {boolean} [p.poseSleeves] swing sleeves down along the avatar's arms (default true for tops)
 * @param {Function} p.getTorsoSlice (y, isMale) => { rx, cz, rz }
 * @param {Function} p.getLegSlice   (y, isMale) => { cx, r, cz }
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
  yTop,
  yBottom,
  layerOffset = 0.02,
  poseSleeves = true,
  getTorsoSlice,
  getLegSlice,
}) {
  const vw = nx + 1;
  const vh = ny + 1;
  const hWorld = yTop - yBottom;
  const isBottom = slot === 'bottom' && !isSkirt;
  const yCrotchBody = isMale ? 0.86 : 0.82;

  // ── Row analysis ──
  const runsByRow = [];
  let total = 0;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (let j = 0; j < vh; j++) {
    const runs = providedRuns ? (providedRuns[j] || []) : (mask ? rowRuns(mask, nx, j) : []);
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

  // Which vertices lie inside the fabric (for smoothing / cell selection)
  const inside = new Uint8Array(vw * vh);
  runsByRow.forEach((runs, j) => {
    runs.forEach(([a, b]) => {
      for (let i = Math.max(0, Math.ceil(a)); i <= Math.min(nx, Math.floor(b)); i++) inside[j * vw + i] = 1;
    });
  });

  // ── Vertical placement ──
  // Bottoms: anchor the photographed crotch (where the legs split) onto the
  // avatar's crotch so the legs line up with the avatar legs.
  let crotchRow = -1;
  if (isBottom) {
    for (let j = Math.floor(ny * 0.12); j < ny - 6; j++) {
      let stable = true;
      for (let k = 0; k < 6; k++) {
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
    if (crotchRow >= 0 && crotchRow < ny * 0.18) crotchRow = -1;
  }
  const rowY = (j) => {
    if (crotchRow > 0) {
      if (j <= crotchRow) return yTop + (yCrotchBody - yTop) * (j / crotchRow);
      return yCrotchBody + (yBottom - yCrotchBody) * ((j - crotchRow) / (ny - crotchRow));
    }
    return yTop - (j / ny) * hWorld;
  };

  // ── Horizontal scale: match the garment's torso width to the avatar ──
  const dxUniform = (aspect * hWorld) / nx;
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
  const sCorr = isBottom
    ? clamp(percentile(ratios, 0.5), 0.8, 1.25)
    : clamp(percentile(ratios, 0.85), 0.72, 1.4);
  const dx = dxUniform * sCorr;
  const colMid = (minCol + maxCol) / 2;
  const yShoulder = isMale ? 1.48 : 1.42;

  // Per-row horizontal body-clearance scale for skirts / bottoms so A-line skirt waists
  // never narrow inside the avatar's lateral hip/waist flanks.
  const rowScaleArr = new Float32Array(vh);
  for (let j = 0; j < vh; j++) {
    rowScaleArr[j] = 1.0;
    if (!isSkirt) continue;
    const y = rowY(j);
    const runs = runsByRow[j];
    if (!runs.length || y < 0.68) continue;
    let mainRun = runs[0];
    let bestDist = Infinity;
    runs.forEach((r) => {
      const d = colMid < r[0] ? r[0] - colMid : colMid > r[1] ? colMid - r[1] : 0;
      if (d < bestDist) {
        bestDist = d;
        mainRun = r;
      }
    });
    const halfCols = Math.max(1, (mainRun[1] - mainRun[0]) * 0.5);
    const reqHalf = (bodyHalfAt(y) + layerOffset) * 1.06;
    if (halfCols * dx < reqHalf) {
      rowScaleArr[j] = clamp(reqHalf / Math.max(1e-3, halfCols * dx), 1.0, 1.65);
    }
  }
  if (isSkirt) {
    for (let pass = 0; pass < 2; pass++) {
      const tmp = new Float32Array(rowScaleArr);
      for (let j = 1; j < vh - 1; j++) {
        tmp[j] = 0.25 * rowScaleArr[j - 1] + 0.5 * rowScaleArr[j] + 0.25 * rowScaleArr[j + 1];
      }
      rowScaleArr.set(tmp);
    }
  }

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

    // Check adjacent rows for vertical cap vertices (e.g. underside of a horizontal sleeve)
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

  // ── Per-row geometry ──
  const offF = new Float32Array(vw * vh); // front depth offset (>= 0)
  const offB = new Float32Array(vw * vh); // back depth offset (>= 0)
  const baseZ = new Float32Array(vw * vh);
  const xs = new Float32Array(vw * vh);
  const ys = new Float32Array(vw * vh);
  const uCols = new Float32Array(vw * vh);

  for (let j = 0; j < vh; j++) {
    const y = rowY(j);
    const runs = runsByRow[j];
    const torso = getTorsoSlice(Math.max(0.5, y), isMale);
    const belowCrotch = y < yCrotchBody;
    const leg = belowCrotch ? getLegSlice(y, isMale) : null;
    const dxRow = dx * rowScaleArr[j];

    // Leg warp: two big runs below the avatar crotch snap onto the avatar legs.
    let legRuns = null;
    if (isBottom && belowCrotch && runs.length >= 2) {
      legRuns = [...runs]
        .sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))
        .slice(0, 2)
        .sort((p, q) => p[0] - q[0]);
    }
    const blend = isBottom && belowCrotch ? clamp((yCrotchBody - y) / 0.12, 0, 1) : 0;

    for (let i = 0; i < vw; i++) {
      const idx = j * vw + i;
      const run = resolveVertexRun(i, j);
      const col = run ? clamp(i, run[0], run[1]) : i;
      const inset = run ? Math.min(0.35, (run[1] - run[0]) * 0.15) : 0;
      uCols[idx] = run ? clamp(col, run[0] + inset, run[1] - inset) : i;

      let x = (col - colMid) * dxRow;
      if (legRuns && blend > 0) {
        const c0 = (legRuns[0][0] + legRuns[0][1]) / 2;
        const c1 = (legRuns[1][0] + legRuns[1][1]) / 2;
        const k = Math.abs(col - c0) <= Math.abs(col - c1) ? 0 : 1;
        const ck = k === 0 ? c0 : c1;
        const halfCols = Math.max(1, (legRuns[k][1] - legRuns[k][0]) / 2);
        const legScale = clamp(((leg.r + layerOffset) * 1.05) / Math.max(1e-3, halfCols * dx), 0.8, 1.35);
        const side = k === 0 ? -1 : 1;
        const xLeg = side * leg.cx + (col - ck) * dx * legScale;
        x = x * (1 - blend) + xLeg * blend;
      }
      xs[idx] = x;
      ys[idx] = y;
      baseZ[idx] = isBottom && belowCrotch ? leg.cz : torso.cz;
    }

    // Depth profile per run (elliptical cross-section, strictly closed at a and b).
    runs.forEach(([a, b]) => {
      const mid = (a + b) / 2;
      const half = Math.max(0.5, (b - a) / 2);
      const halfWorld = half * dxRow;
      let bodyRz;
      if (isBottom && belowCrotch) bodyRz = leg.r + layerOffset;
      else bodyRz = torso.rz + layerOffset;
      // Skirts / dresses / long coats flare below the hips
      if (!isBottom && y < 0.84) {
        bodyRz = Math.max(bodyRz, 0.5 * halfWorld);
      }
      // Narrow parts (sleeves, straps) must not be thicker than they are wide
      const amp = Math.min(bodyRz, halfWorld * 1.05 + 0.012);
      const isBodySpan = halfWorld >= torso.rx * 0.82;
      const iStart = Math.max(0, Math.ceil(a + 0.02));
      const iEnd = Math.min(nx, Math.floor(b - 0.02));
      for (let i = iStart; i <= iEnd; i++) {
        const u = clamp((i - mid) / half, -1, 1);
        const s = Math.max(0, 1 - u * u);
        const edgeTaper = smoothstep01((1 - Math.abs(u)) / 0.08);
        const hh = (isBodySpan ? Math.pow(s, 0.44) : Math.sqrt(s)) * edgeTaper;
        offF[j * vw + i] = amp * hh;
        offB[j * vw + i] = (amp + 0.008) * hh;
      }
    });
  }

  // Vertical smoothing of the depth offsets (interior vertices only; boundary stays pinned to 0)
  for (let pass = 0; pass < 2; pass++) {
    const tmpF = new Float32Array(offF);
    const tmpB = new Float32Array(offB);
    for (let j = 1; j < vh - 1; j++) {
      for (let i = 0; i < vw; i++) {
        const idx = j * vw + i;
        if (!inside[idx] || offF[idx] <= 1e-5) continue;
        const up = idx - vw;
        const dn = idx + vw;
        const smF = 0.25 * offF[up] + 0.5 * offF[idx] + 0.25 * offF[dn];
        const smB = 0.25 * offB[up] + 0.5 * offB[idx] + 0.25 * offB[dn];
        const nearEdge = !inside[idx - 1] || !inside[idx + 1] || !inside[up] || !inside[dn];
        tmpF[idx] = nearEdge ? Math.min(smF, offF[idx] * 1.05) : smF;
        tmpB[idx] = nearEdge ? Math.min(smB, offB[idx] * 1.05) : smB;
      }
    }
    offF.set(tmpF);
    offB.set(tmpB);
  }

  // Swing photographed sleeves down along the avatar's arms
  let sleevePose = null;
  if (poseSleeves && (slot === 'top' || slot === 'outerwear' || slot === 'dress')) {
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
      // front faces +z (counter-clockwise seen from the front)
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

  return {
    ok: true,
    front: makeGeo(frontPos, uvFront, frontIdx),
    back: makeGeo(backPos, uvBack, backIdx),
    info: { nx, ny, crotchRow, sCorr, sleevePose, runsPerRow: runsByRow.map((r) => r.length) },
  };
}

/**
 * Decides whether another group image is a plausible back/side view of the host
 * garment: similar overall colour and a comparable silhouette area.
 */
export function isConsistentView(frontStats, otherStats) {
  if (!frontStats || !otherStats) return false;
  const dr = frontStats.mean[0] - otherStats.mean[0];
  const dg = frontStats.mean[1] - otherStats.mean[1];
  const db = frontStats.mean[2] - otherStats.mean[2];
  const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
  const areaRatio = otherStats.area / Math.max(1, frontStats.area);
  const aspectRatio = otherStats.aspect / Math.max(1e-3, frontStats.aspect);
  return colorDist < 64 && areaRatio > 0.55 && areaRatio < 1.8 && aspectRatio > 0.6 && aspectRatio < 1.6;
}

/**
 * Synthesizes the back fabric texture data from the front garment image:
 *   1. Preserves base fabric colors, lighting gradients, and repeating patterns
 *      (horizontal stripes, vertical stripes, plaid, herringbone, houndstooth, knit weave).
 *   2. Bridges over center closures (zipper tracks, metal pulls, button plackets, drawstrings).
 *   3. Excludes and inpaints asymmetric breast pockets, pocket flaps, and front logos.
 *   4. Excludes and inpaints chest/torso graphic prints, slogans, decals, and artwork.
 *   5. Restores authentic high-frequency fabric grain/weave so the back sheet looks
 *      like real woven cloth, not flat blur.
 *
 * Operates on Uint8ClampedArray or Uint8Array of RGBA bytes (length w * h * 4).
 */
export function synthesizeBackFabricData(data, w, h) {
  if (!data || !w || !h) return data;

  for (let y = 0; y < h; y++) {
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
    const tol = Math.max(20, sigma * 2.0);

    // Extract current row colors and calculate expected baseline
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

    // 1. Bilateral symmetry check for pockets / asymmetric details
    // (Preserves symmetric plaid / herringbone patterns while removing one-sided chest pockets)
    for (let i = 0; i < span; i++) {
      const mi = span - 1 - i;
      const dAsym = Math.sqrt(
        (curR[i] - curR[mi]) ** 2 +
        (curG[i] - curG[mi]) ** 2 +
        (curB[i] - curB[mi]) ** 2
      );
      if ((diffBase[i] - diffBase[mi] >= 12) || (dAsym >= 14 && diffBase[i] > diffBase[mi] + 8)) {
        curR[i] = curR[mi];
        curG[i] = curG[mi];
        curB[i] = curB[mi];
        diffBase[i] = diffBase[mi];
      }
    }

    // 2. Bridge center closure (zipper tracks, zipper pulls, button plackets)
    const cMidL = Math.floor(0.43 * span);
    const cMidR = Math.min(span - 1, Math.ceil(0.57 * span));
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
        if (diffBase[i] > 10 || distFromBridge > 10) {
          curR[i] = brR;
          curG[i] = brG;
          curB[i] = brB;
          const dr = brR - baseR[i], dg = brG - baseG[i], db = brB - baseB[i];
          diffBase[i] = Math.sqrt(dr * dr + dg * dg + db * db);
        }
      }
    }

    // 3. Inpaint remaining graphic prints (contiguous anomalies in torso u_rel in [0.15, 0.85])
    const torsoStart = Math.floor(0.15 * span);
    const torsoEnd = Math.min(span - 1, Math.ceil(0.85 * span));
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

    for (const [rStart, rEnd] of runsToInpaint) {
      const bLeft = Math.max(0, rStart - 1);
      const bRight = Math.min(span - 1, rEnd + 1);
      const blR = curR[bLeft], blG = curG[bLeft], blB = curB[bLeft];
      const brR = curR[bRight], brG = curG[bRight], brB = curB[bRight];
      const runLen = rEnd - rStart + 1;
      for (let k = 0; k < runLen; k++) {
        const idx = rStart + k;
        const t = (k + 1) / (runLen + 1);
        let synR = (1 - t) * blR + t * brR;
        let synG = (1 - t) * blG + t * brG;
        let synB = (1 - t) * blB + t * brB;

        // Apply weave grain micro-texture sampled from flank
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

    // Write back modified colors into data
    for (let i = 0; i < span; i++) {
      const idx = rowOffset + (xMin + i) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(curR[i])));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(curG[i])));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(curB[i])));
    }
  }

  return data;
}
