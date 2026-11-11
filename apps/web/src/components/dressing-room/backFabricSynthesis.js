import { BufferAttribute, CanvasTexture, SRGBColorSpace, ClampToEdgeWrapping } from 'three';

// ─── Anatomical Profiles Extracted from Canonical Avatar 3D Meshes ───
export const TORSO_PROFILE_FEMALE = [
  { y: 1.46, rx: 0.125, cz: 0.030, rz: 0.082, rzFront: 0.082, rzBack: 0.075 },
  { y: 1.42, rx: 0.192, cz: 0.015, rz: 0.078, rzFront: 0.082, rzBack: 0.072 },
  { y: 1.36, rx: 0.215, cz: 0.020, rz: 0.104, rzFront: 0.112, rzBack: 0.090 },
  { y: 1.25, rx: 0.210, cz: 0.052, rz: 0.130, rzFront: 0.136, rzBack: 0.114 },
  { y: 1.15, rx: 0.174, cz: 0.054, rz: 0.118, rzFront: 0.128, rzBack: 0.094 },
  { y: 1.05, rx: 0.146, cz: 0.052, rz: 0.110, rzFront: 0.116, rzBack: 0.095 },
  { y: 0.95, rx: 0.172, cz: 0.024, rz: 0.128, rzFront: 0.138, rzBack: 0.120 },
  { y: 0.82, rx: 0.188, cz: 0.016, rz: 0.118, rzFront: 0.124, rzBack: 0.114 },
  { y: 0.65, rx: 0.186, cz: 0.032, rz: 0.108, rzFront: 0.112, rzBack: 0.100 },
];

export const TORSO_PROFILE_MALE = [
  { y: 1.52, rx: 0.145, cz: 0.016, rz: 0.088, rzFront: 0.085, rzBack: 0.082 },
  { y: 1.48, rx: 0.220, cz: 0.008, rz: 0.098, rzFront: 0.096, rzBack: 0.096 },
  { y: 1.42, rx: 0.235, cz: 0.013, rz: 0.122, rzFront: 0.124, rzBack: 0.122 },
  { y: 1.30, rx: 0.215, cz: 0.027, rz: 0.140, rzFront: 0.142, rzBack: 0.138 },
  { y: 1.18, rx: 0.178, cz: 0.036, rz: 0.116, rzFront: 0.118, rzBack: 0.112 },
  { y: 1.08, rx: 0.148, cz: 0.044, rz: 0.106, rzFront: 0.106, rzBack: 0.106 },
  { y: 0.96, rx: 0.172, cz: 0.025, rz: 0.128, rzFront: 0.128, rzBack: 0.128 },
  { y: 0.86, rx: 0.184, cz: 0.018, rz: 0.116, rzFront: 0.116, rzBack: 0.116 },
  { y: 0.70, rx: 0.188, cz: 0.028, rz: 0.110, rzFront: 0.110, rzBack: 0.106 },
];

export const LEG_PROFILE_FEMALE = [
  { y: 0.82, cx: 0.094, r: 0.092, cz: 0.016, rzFront: 0.102, rzBack: 0.100 },
  { y: 0.75, cx: 0.101, r: 0.087, cz: 0.032, rzFront: 0.086, rzBack: 0.086 },
  { y: 0.65, cx: 0.115, r: 0.068, cz: 0.040, rzFront: 0.074, rzBack: 0.074 },
  { y: 0.50, cx: 0.129, r: 0.058, cz: 0.036, rzFront: 0.062, rzBack: 0.062 },
  { y: 0.40, cx: 0.148, r: 0.060, cz: 0.003, rzFront: 0.059, rzBack: 0.059 },
  { y: 0.30, cx: 0.155, r: 0.053, cz: 0.010, rzFront: 0.054, rzBack: 0.054 },
  { y: 0.20, cx: 0.166, r: 0.033, cz: 0.021, rzFront: 0.038, rzBack: 0.038 },
  { y: 0.10, cx: 0.167, r: 0.028, cz: 0.035, rzFront: 0.042, rzBack: 0.042 },
];

export const LEG_PROFILE_MALE = [
  { y: 0.86, cx: 0.094, r: 0.090, cz: 0.018, rzFront: 0.114, rzBack: 0.112 },
  { y: 0.78, cx: 0.098, r: 0.090, cz: 0.036, rzFront: 0.092, rzBack: 0.092 },
  { y: 0.70, cx: 0.105, r: 0.082, cz: 0.040, rzFront: 0.086, rzBack: 0.086 },
  { y: 0.58, cx: 0.115, r: 0.061, cz: 0.029, rzFront: 0.073, rzBack: 0.073 },
  { y: 0.50, cx: 0.133, r: 0.058, cz: 0.000, rzFront: 0.072, rzBack: 0.072 },
  { y: 0.40, cx: 0.142, r: 0.066, cz: -0.022, rzFront: 0.062, rzBack: 0.062 },
  { y: 0.30, cx: 0.144, r: 0.059, cz: -0.025, rzFront: 0.052, rzBack: 0.052 },
  { y: 0.20, cx: 0.149, r: 0.036, cz: -0.023, rzFront: 0.039, rzBack: 0.039 },
  { y: 0.10, cx: 0.144, r: 0.034, cz: -0.004, rzFront: 0.050, rzBack: 0.050 },
];

function interpolateProfile(profile, y) {
  if (!Array.isArray(profile) || profile.length === 0) return { y, cz: 0 };
  if (y >= profile[0].y) return { ...profile[0] };
  const last = profile[profile.length - 1];
  if (y <= last.y) return { ...last };

  for (let i = 0; i < profile.length - 1; i++) {
    const p1 = profile[i];
    const p2 = profile[i + 1];
    if (y <= p1.y && y >= p2.y) {
      const t = (p1.y - y) / (p1.y - p2.y);
      const res = {};
      Object.keys(p1).forEach((key) => {
        if (key === 'y') res.y = y;
        else res[key] = p1[key] * (1 - t) + p2[key] * t;
      });
      return res;
    }
  }
  return { ...last };
}

export function getTorsoSlice(y, isMale = false) {
  const profile = isMale ? TORSO_PROFILE_MALE : TORSO_PROFILE_FEMALE;
  return interpolateProfile(profile, y);
}

export function getLegSlice(y, isMale = false) {
  const profile = isMale ? LEG_PROFILE_MALE : LEG_PROFILE_FEMALE;
  return interpolateProfile(profile, y);
}

/**
 * Synthesizes the back fabric texture data from the front garment image:
 *   1. Preserves base fabric colors, lighting gradients, and repeating patterns.
 *   2. Removes front-only closures (zippers, buttonflies, plackets, belt buckles, drawstrings).
 *   3. Removes asymmetric breast pockets, pocket flaps, and front logos.
 *   4. Removes chest/torso graphic prints, slogans, decals, and artwork.
 *   5. Fills collar neckline cavity and inner lining in the upper 16% height.
 *   6. Restores authentic high-frequency fabric grain/weave so the back sheet looks
 *      like real woven cloth, not flat blur.
 */
export function synthesizeBackFabricData(data, w, h) {
  if (!data || !w || !h) return data;

  for (let y = 0; y < h; y++) {
    const vRel = y / Math.max(1, h - 1);
    const rowOffset = y * w * 4;

    const runs = [];
    let inRun = false;
    let rStart = 0;
    for (let x = 0; x < w; x++) {
      if (data[rowOffset + x * 4 + 3] >= 96) {
        if (!inRun) {
          inRun = true;
          rStart = x;
        }
      } else if (inRun) {
        inRun = false;
        runs.push([rStart, x - 1]);
      }
    }
    if (inRun) {
      runs.push([rStart, w - 1]);
    }

    const merged = [];
    for (const r of runs) {
      if (merged.length > 0 && r[0] - merged[merged.length - 1][1] <= 4) {
        merged[merged.length - 1][1] = r[1];
      } else {
        merged.push(r);
      }
    }

    for (const [xMin, xMax] of merged) {
      const span = xMax - xMin + 1;
      if (span < 16) continue;

      if (merged.length > 1 && (xMax < w * 0.38 || xMin > w * 0.62)) {
        continue;
      }

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

      const flankVarL = lSamples.length > 0
        ? (lSamples.reduce((acc, s) => acc + Math.hypot(s[0] - cL[0], s[1] - cL[1], s[2] - cL[2]), 0) / lSamples.length)
        : 8;
      const flankVarR = rSamples.length > 0
        ? (rSamples.reduce((acc, s) => acc + Math.hypot(s[0] - cR[0], s[1] - cR[1], s[2] - cR[2]), 0) / rSamples.length)
        : 8;
      const sigma = Math.max(flankVarL, flankVarR);
      const isAllOverPatternRow = sigma >= 32;

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

        const u = i / Math.max(1, span - 1);
        const bR = (1 - u) * cL[0] + u * cR[0];
        const bG = (1 - u) * cL[1] + u * cR[1];
        const bB = (1 - u) * cL[2] + u * cR[2];
        baseR[i] = bR; baseG[i] = bG; baseB[i] = bB;

        const dr = cr - bR;
        const dg = cg - bG;
        const db = cb - bB;
        diffBase[i] = Math.sqrt(dr * dr + dg * dg + db * db);
      }

      // 1. Center closures: zipper tracks, zipper pulls, button plackets, buttonflies
      const cMidL = Math.floor(0.35 * span);
      const cMidR = Math.min(span - 1, Math.ceil(0.65 * span));
      if (!isAllOverPatternRow && cMidR > cMidL + 2) {
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

      // 2. Eliminate all front-view details: buttons, zippers, breast pockets, chest graphics, lettering, logos
      const isChestTorsoZone = vRel >= 0.10 && vRel <= 0.85;
      const pStart = Math.floor(0.06 * span);
      const pEnd = Math.min(span - 1, Math.ceil(0.94 * span));
      if (pEnd > pStart + 2) {
        const isGraphic = new Uint8Array(span);
        const fineThreshold = isAllOverPatternRow
          ? Math.max(12.0, sigma * 1.5)
          : Math.max(3.5, Math.min(7.0, sigma * 0.70));
        for (let i = pStart + 1; i < pEnd; i++) {
          const u_rel = i / (span - 1);
          const inChestBox = isChestTorsoZone && u_rel >= 0.10 && u_rel <= 0.90;
          const prevDiff = i > 0
            ? Math.hypot(curR[i] - curR[i - 1], curG[i] - curG[i - 1], curB[i] - curB[i - 1])
            : 0;
          if (
            diffBase[i] > fineThreshold ||
            (!isAllOverPatternRow && prevDiff > Math.max(5.0, sigma * 0.80)) ||
            (inChestBox && diffBase[i] > (isAllOverPatternRow ? 8.0 : 3.0))
          ) {
            isGraphic[i] = 1;
          }
        }

        if (!isAllOverPatternRow) {
          const isGraphicDilated = new Uint8Array(isGraphic);
          for (let i = 0; i < span; i++) {
            if (isGraphic[i]) {
              const start = Math.max(0, i - 3);
              const end = Math.min(span - 1, i + 3);
              for (let k = start; k <= end; k++) isGraphicDilated[k] = 1;
            }
          }
          for (let i = 0; i < span; i++) {
            isGraphic[i] = isGraphicDilated[i];
          }
        }

        for (let i = 0; i < span; i++) {
          if (isGraphic[i]) {
            const synR = baseR[i];
            const synG = baseG[i];
            const synB = baseB[i];
            const symI = Math.min(i, span - 1 - i);
            const microNoise = Math.round(((symI * 37 + y * 17) % 5) - 2) * 0.5;
            curR[i] = Math.max(0, Math.min(255, synR + microNoise));
            curG[i] = Math.max(0, Math.min(255, synG + microNoise));
            curB[i] = Math.max(0, Math.min(255, synB + microNoise));
            diffBase[i] = 0;
          }
        }
      }

      // 3. Fill collar cavity & inner neck lining in upper 16% of garment height
      if (vRel < 0.16) {
        const cStart = Math.floor(0.38 * span);
        const cEnd = Math.min(span - 1, Math.ceil(0.62 * span));
        const colL = Math.max(0, cStart - 2);
        const colR = Math.min(span - 1, cEnd + 2);
        const collarR = (curR[colL] + curR[colR]) / 2;
        const collarG = (curG[colL] + curG[colR]) / 2;
        const collarB = (curB[colL] + curB[colR]) / 2;
        for (let i = cStart; i <= cEnd; i++) {
          const dNeck = Math.hypot(curR[i] - collarR, curG[i] - collarG, curB[i] - collarB);
          if (dNeck > 12 || diffBase[i] > 8) {
            curR[i] = collarR;
            curG[i] = collarG;
            curB[i] = collarB;
          }
        }
      }

      for (let i = 0; i < span; i++) {
        const idx = rowOffset + (xMin + i) * 4;
        data[idx] = Math.max(0, Math.min(255, Math.round(curR[i])));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(curG[i])));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(curB[i])));
      }
    }
  }

  return data;
}

export function synthesizeBackFabricCanvas(frontCanvas) {
  if (!frontCanvas || typeof document === 'undefined') return frontCanvas;
  try {
    const W = frontCanvas.width;
    const H = frontCanvas.height;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return frontCanvas;
    ctx.drawImage(frontCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, W, H);
    synthesizeBackFabricData(imgData.data, W, H);
    ctx.putImageData(imgData, 0, 0);
    return out;
  } catch {
    return frontCanvas;
  }
}

export function fillTransparentCanvasMargins(canvas, dominantColor = '#FFFFFF') {
  if (!canvas || typeof document === 'undefined') return;
  try {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, W, H);
    const px = imgData.data;

    const hexColor = String(dominantColor || '#CBD5E1').replace('#', '');
    const domR = parseInt(hexColor.substring(0, 2), 16) || 200;
    const domG = parseInt(hexColor.substring(2, 4), 16) || 200;
    const domB = parseInt(hexColor.substring(4, 6), 16) || 200;

    for (let y = 0; y < H; y++) {
      let firstOpaque = -1;
      let lastOpaque = -1;
      const rowOffset = y * W * 4;

      for (let x = 0; x < W; x++) {
        if (px[rowOffset + x * 4 + 3] >= 96) {
          if (firstOpaque === -1) firstOpaque = x;
          lastOpaque = x;
        }
      }

      if (firstOpaque === -1) {
        // Entire row is transparent
        for (let x = 0; x < W; x++) {
          const idx = rowOffset + x * 4;
          px[idx] = domR;
          px[idx + 1] = domG;
          px[idx + 2] = domB;
          px[idx + 3] = 255;
        }
      } else {
        const leftIdx = rowOffset + firstOpaque * 4;
        const lR = px[leftIdx], lG = px[leftIdx + 1], lB = px[leftIdx + 2];
        for (let x = 0; x < firstOpaque; x++) {
          const idx = rowOffset + x * 4;
          px[idx] = lR;
          px[idx + 1] = lG;
          px[idx + 2] = lB;
          px[idx + 3] = 255;
        }

        const rightIdx = rowOffset + lastOpaque * 4;
        const rR = px[rightIdx], rG = px[rightIdx + 1], rB = px[rightIdx + 2];
        for (let x = lastOpaque + 1; x < W; x++) {
          const idx = rowOffset + x * 4;
          px[idx] = rR;
          px[idx + 1] = rG;
          px[idx + 2] = rB;
          px[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Graceful fallback
  }
}

export function buildBackTexture({ frontCanvas, dominantColor = '#FFFFFF' }) {
  if (!frontCanvas || typeof document === 'undefined') return null;
  const W = frontCanvas.width;
  const H = frontCanvas.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const cleanBackCanvas = synthesizeBackFabricCanvas(frontCanvas);
  ctx.drawImage(cleanBackCanvas, 0, 0);
  fillTransparentCanvasMargins(out, dominantColor);

  const tex = new CanvasTexture(out);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Splits geometry faces into front and back spatial groups around the anatomical centerline cz(y),
 * keeping both walls of garment GLB templates paired on the correct anterior (+Z) or posterior (-Z) half.
 */
export function partitionGarmentGeometryFrontBack(geometry, slot = null, isMale = false) {
  if (!geometry) return geometry;
  const pos = geometry.attributes?.position;
  if (!pos || pos.count < 3) return geometry;

  let idx = geometry.index ? geometry.index.array : null;
  if (!idx) {
    const triangleVertexCount = Math.floor(pos.count / 3) * 3;
    if (triangleVertexCount < 3) return geometry;
    const generated = new (pos.count > 65535 ? Uint32Array : Uint16Array)(triangleVertexCount);
    for (let i = 0; i < triangleVertexCount; i++) {
      generated[i] = i;
    }
    geometry.setIndex(new BufferAttribute(generated, 1));
    idx = geometry.index.array;
  }

  const triCount = Math.floor(idx.length / 3);
  if (triCount < 1) return geometry;

  const frontTriangles = [];
  const backTriangles = [];
  const yCrotch = isMale ? 0.86 : 0.82;
  const isBottomBifurcated = slot === 'bottom';
  const isCoreTopSlot = ['top', 'outerwear', 'dress'].includes(slot);

  for (let t = 0; t < triCount; t++) {
    const i0 = idx[t * 3];
    const i1 = idx[t * 3 + 1];
    const i2 = idx[t * 3 + 2];

    const midX = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
    const midY = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const midZ = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;

    let splitZ = 0.005;
    if (isBottomBifurcated && midY < yCrotch) {
      splitZ = getLegSlice(midY, isMale)?.cz ?? 0;
    } else if (isCoreTopSlot) {
      const xArmpitSplit = isMale
        ? (0.180 + Math.max(0, 1.28 - midY) * 0.42)
        : (0.150 + Math.max(0, 1.20 - midY) * 0.40);
      splitZ = Math.abs(midX) > xArmpitSplit
        ? (isMale ? 0.004 : 0.008)
        : (getTorsoSlice(Math.max(0.5, midY), isMale)?.cz ?? 0);
    } else if (['bottom', 'belt'].includes(slot)) {
      splitZ = getTorsoSlice(Math.max(0.5, midY), isMale)?.cz ?? 0;
    }

    if (midZ < splitZ) {
      backTriangles.push(i0, i1, i2);
    } else {
      frontTriangles.push(i0, i1, i2);
    }
  }

  if (backTriangles.length > 0 && frontTriangles.length > 0) {
    const newIdx = new idx.constructor(frontTriangles.length + backTriangles.length);
    newIdx.set(frontTriangles, 0);
    newIdx.set(backTriangles, frontTriangles.length);
    geometry.setIndex(new BufferAttribute(newIdx, 1));
    geometry.clearGroups?.();
    geometry.addGroup(0, frontTriangles.length, 0);
    geometry.addGroup(frontTriangles.length, backTriangles.length, 1);
  } else {
    geometry.clearGroups?.();
    geometry.addGroup(0, idx.length, 0);
  }

  return geometry;
}
