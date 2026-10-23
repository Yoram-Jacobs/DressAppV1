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
    // Merge runs separated by tiny gaps (anti-aliasing / hairline seams)
    const merged = [];
    px.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] <= Math.max(2, w * 0.004)) last[1] = r[1];
      else merged.push([r[0], r[1]]);
    });
    runsByRow.push(
      merged
        .filter(([x0, x1]) => x1 - x0 + 1 >= minRunPx)
        .map(([x0, x1]) => [(x0 / (w - 1)) * nx, ((x1 + 1) / (w - 1)) * nx])
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

  // ── Per-row geometry ──
  const offF = new Float32Array(vw * vh); // front depth offset (>= 0)
  const offB = new Float32Array(vw * vh); // back depth offset (>= 0)
  const baseZ = new Float32Array(vw * vh);
  const xs = new Float32Array(vw * vh);
  const ys = new Float32Array(vw * vh);

  for (let j = 0; j < vh; j++) {
    const y = rowY(j);
    const runs = runsByRow[j];
    const torso = getTorsoSlice(Math.max(0.5, y), isMale);
    const belowCrotch = y < yCrotchBody;
    const leg = belowCrotch ? getLegSlice(y, isMale) : null;

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
      let x = (i - colMid) * dx;
      if (legRuns && blend > 0) {
        const c0 = (legRuns[0][0] + legRuns[0][1]) / 2;
        const c1 = (legRuns[1][0] + legRuns[1][1]) / 2;
        const k = Math.abs(i - c0) <= Math.abs(i - c1) ? 0 : 1;
        const ck = k === 0 ? c0 : c1;
        const halfCols = (legRuns[k][1] - legRuns[k][0]) / 2;
        const legScale = clamp((leg.r + layerOffset) / Math.max(1e-3, halfCols * dx), 0.8, 1.25);
        const side = k === 0 ? -1 : 1;
        const xLeg = side * leg.cx + (i - ck) * dx * legScale;
        x = x * (1 - blend) + xLeg * blend;
      }
      xs[idx] = x;
      ys[idx] = y;
      baseZ[idx] = isBottom && belowCrotch ? leg.cz : torso.cz;
    }

    // Depth profile per run (elliptical cross-section, exactly closed at the outline).
    runs.forEach(([a, b]) => {
      const mid = (a + b) / 2;
      const half = Math.max(0.5, (b - a) / 2);
      const halfWorld = half * dx;
      let bodyRz;
      if (isBottom && belowCrotch) bodyRz = leg.r + layerOffset;
      else bodyRz = torso.rz + layerOffset;
      // Skirts / dresses / long coats flare below the hips
      if (!isBottom && y < 0.84) {
        bodyRz = Math.max(bodyRz, 0.5 * halfWorld);
      }
      // Narrow parts (sleeves, straps) must not be thicker than they are wide
      const amp = Math.min(bodyRz, halfWorld * 1.05 + 0.012);
      for (let i = Math.max(0, Math.ceil(a)); i <= Math.min(nx, Math.floor(b)); i++) {
        const u = clamp((i - mid) / half, -1, 1);
        const hh = Math.sqrt(Math.max(0, 1 - u * u));
        offF[j * vw + i] = amp * hh;
        offB[j * vw + i] = (amp + 0.008) * hh;
      }
    });
  }

  // Vertical smoothing of the depth offsets (inside the fabric only)
  for (let pass = 0; pass < 2; pass++) {
    const tmpF = new Float32Array(offF);
    const tmpB = new Float32Array(offB);
    for (let j = 1; j < vh - 1; j++) {
      for (let i = 0; i < vw; i++) {
        const idx = j * vw + i;
        if (!inside[idx]) continue;
        const up = inside[idx - vw] ? idx - vw : idx;
        const dn = inside[idx + vw] ? idx + vw : idx;
        tmpF[idx] = 0.25 * offF[up] + 0.5 * offF[idx] + 0.25 * offF[dn];
        tmpB[idx] = 0.25 * offB[up] + 0.5 * offB[idx] + 0.25 * offB[dn];
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

  // UVs: both sheets sample their texture at the same normalised position, so the
  // back texture (which is baked mirrored, see buildBackTexture) always has exactly
  // the same silhouette as the front photo and the two sheets close perfectly.
  const uvFront = new Float32Array(vw * vh * 2);
  const uvBack = new Float32Array(vw * vh * 2);
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const idx = j * vw + i;
      const u = i / nx;
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
