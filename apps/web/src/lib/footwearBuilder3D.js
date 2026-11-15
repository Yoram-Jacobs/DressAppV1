import * as THREE from 'three';

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

/**
 * Merges indexed or non-indexed BufferGeometry parts into a single indexed
 * BufferGeometry with material groups preserved.
 */
function mergeGeometryParts(parts) {
  let totalVerts = 0;
  let totalIndices = 0;

  const normalized = parts.map(({ geometry, materialIndex = 0 }) => {
    const pos = geometry.getAttribute('position');
    const norm = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const idx = geometry.getIndex();
    const vCount = pos ? pos.count : 0;
    const iCount = idx ? idx.count : vCount;
    totalVerts += vCount;
    totalIndices += iCount;
    return { geometry, materialIndex, pos, norm, uv, idx, vCount, iCount };
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const UseUint32 = totalVerts > 65535;
  const indices = UseUint32 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  const out = new THREE.BufferGeometry();
  let vOffset = 0;
  let iOffset = 0;

  for (const part of normalized) {
    const { pos, norm, uv, idx, vCount, iCount, materialIndex } = part;
    if (!vCount || !iCount) continue;

    for (let i = 0; i < vCount; i++) {
      const vi = (vOffset + i) * 3;
      const ui = (vOffset + i) * 2;
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      positions[vi] = Number.isFinite(px) ? px : 0;
      positions[vi + 1] = Number.isFinite(py) ? py : 0;
      positions[vi + 2] = Number.isFinite(pz) ? pz : 0;

      if (norm) {
        const nx = norm.getX(i);
        const ny = norm.getY(i);
        const nz = norm.getZ(i);
        normals[vi] = Number.isFinite(nx) ? nx : 0;
        normals[vi + 1] = Number.isFinite(ny) ? ny : 1;
        normals[vi + 2] = Number.isFinite(nz) ? nz : 0;
      } else {
        normals[vi + 1] = 1;
      }

      if (uv) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uvs[ui] = Number.isFinite(u) ? u : 0.5;
        uvs[ui + 1] = Number.isFinite(v) ? v : 0.5;
      } else {
        uvs[ui] = 0.5;
        uvs[ui + 1] = 0.5;
      }
    }

    if (idx) {
      for (let i = 0; i < iCount; i++) {
        indices[iOffset + i] = idx.getX(i) + vOffset;
      }
    } else {
      for (let i = 0; i < iCount; i++) {
        indices[iOffset + i] = vOffset + i;
      }
    }

    out.addGroup(iOffset, iCount, materialIndex);
    vOffset += vCount;
    iOffset += iCount;
  }

  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function rgbToHex(r, g, b) {
  const hr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0');
  const hg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0');
  const hb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0');
  return `#${hr}${hg}${hb}`;
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Analyzes an RGBA shoe cutout buffer to extract:
 * - mode: 'pair' | 'top' | 'side'
 * - boxes: pair bounding rects in normalized UV space (v0=bottom, v1=top)
 * - toeUp / toeLeft orientation flags with zero white-shoe breakage
 * - isFrontThreeQuarter flag for front 3/4 overlapping/angled catalog shots
 * - soleColor & liningColor extracted from footwear perimeter and collar interior
 * - tstrap & hasHeelCup hints for open sandals
 */
export function extractShoePhotoLayout(rgbaData, effW, effH) {
  const defaultAspect = effW / Math.max(1, effH);
  const fallback = {
    mode: defaultAspect > 1.25 ? 'side' : 'top',
    toeLeft: true,
    toeUp: true,
    isFrontThreeQuarter: false,
    boxes: null,
    box: null,
    tstrap: false,
    hasHeelCup: false,
    soleColor: '#e4e5e8',
    liningColor: '#1d2026',
  };

  if (!rgbaData || effW < 8 || effH < 8) return fallback;

  // Detect whether image uses an alpha cutout mask so white sneakers are preserved.
  let sampleCount = 0;
  let transparentCount = 0;
  for (let y = 0; y < effH; y += 2) {
    for (let x = 0; x < effW; x += 2) {
      sampleCount++;
      if (rgbaData[(y * effW + x) * 4 + 3] < 128) transparentCount++;
    }
  }
  const hasAlphaCutout = sampleCount > 0 && transparentCount / sampleCount >= 0.02;

  const isOpaque = (o) => {
    const a = rgbaData[o + 3];
    if (a <= 45) return false;
    if (hasAlphaCutout) return true;
    return !(rgbaData[o] > 242 && rgbaData[o + 1] > 242 && rgbaData[o + 2] > 242);
  };

  const colCov = new Int32Array(effW);
  const colMinY = new Int32Array(effW).fill(effH);
  const colMaxY = new Int32Array(effW).fill(-1);
  let fgX0 = effW;
  let fgX1 = -1;
  let fgY0 = effH;
  let fgY1 = -1;
  let totalOpaque = 0;

  for (let y = 0; y < effH; y++) {
    const rowOff = y * effW;
    for (let x = 0; x < effW; x++) {
      const o = (rowOff + x) * 4;
      if (isOpaque(o)) {
        colCov[x]++;
        if (y < colMinY[x]) colMinY[x] = y;
        if (y > colMaxY[x]) colMaxY[x] = y;
        if (x < fgX0) fgX0 = x;
        if (x > fgX1) fgX1 = x;
        if (y < fgY0) fgY0 = y;
        if (y > fgY1) fgY1 = y;
        totalOpaque++;
      }
    }
  }

  if (totalOpaque < Math.max(24, effW * effH * 0.008) || fgX1 <= fgX0 || fgY1 <= fgY0) {
    return fallback;
  }

  const fgW = fgX1 - fgX0 + 1;
  const fgH = fgY1 - fgY0 + 1;
  const fgAspect = fgW / Math.max(1, fgH);

  // Locate disconnected horizontal runs.
  const colActiveThresh = Math.max(2, Math.floor(effH * 0.015));
  const runs = [];
  let inRun = false;
  let runStart = 0;
  for (let x = 0; x < effW; x++) {
    const active = colCov[x] >= colActiveThresh;
    if (active && !inRun) {
      inRun = true;
      runStart = x;
    } else if (!active && inRun) {
      inRun = false;
      if (x - runStart >= Math.max(4, effW * 0.10)) {
        runs.push([runStart, x - 1]);
      }
    }
  }
  if (inRun && effW - runStart >= Math.max(4, effW * 0.10)) {
    runs.push([runStart, effW - 1]);
  }

  const computeRunPixels = (rx0, rx1) => {
    let cnt = 0;
    for (let x = rx0; x <= rx1; x++) cnt += colCov[x];
    return cnt;
  };
  const substantialRuns = runs.filter(([a, b]) => computeRunPixels(a, b) >= totalOpaque * 0.08);

  const tightenBox = (rx0, rx1, seamTrimL = 0, seamTrimR = 0) => {
    const x0 = Math.min(rx1, rx0 + seamTrimL);
    const x1 = Math.max(x0, rx1 - seamTrimR);
    let y0 = effH;
    let y1 = -1;
    let tx0 = x1;
    let tx1 = x0;
    for (let x = x0; x <= x1; x++) {
      if (colCov[x] > 0) {
        if (colMinY[x] < y0) y0 = colMinY[x];
        if (colMaxY[x] > y1) y1 = colMaxY[x];
        if (x < tx0) tx0 = x;
        if (x > tx1) tx1 = x;
      }
    }
    if (y1 <= y0 || tx1 <= tx0) {
      return { px0: x0, px1: x1, py0: fgY0, py1: fgY1 };
    }
    return { px0: tx0, px1: tx1, py0: y0, py1: y1 };
  };

  let rawBoxes = [];
  let overlappedSplit = false;
  if (substantialRuns.length >= 2) {
    // Take the two largest horizontal runs as the pair.
    const sortedBySize = [...substantialRuns].sort(
      (a, b) => computeRunPixels(b[0], b[1]) - computeRunPixels(a[0], a[1])
    );
    const two = sortedBySize.slice(0, 2).sort((a, b) => a[0] - b[0]);
    rawBoxes = [tightenBox(two[0][0], two[0][1]), tightenBox(two[1][0], two[1][1])];
  } else if (fgAspect >= 0.52 && fgAspect <= 1.38) {
    // Check for overlapping pair split via middle valley or dual-peak V-notch.
    const searchX0 = fgX0 + Math.floor(fgW * 0.25);
    const searchX1 = fgX0 + Math.floor(fgW * 0.75);
    let vx = Math.floor((fgX0 + fgX1) / 2);
    let minCov = Infinity;

    for (let x = searchX0; x <= searchX1; x++) {
      if (colCov[x] < minCov) {
        minCov = colCov[x];
        vx = x;
      }
    }

    let leftPeakCov = 0;
    let rightPeakCov = 0;
    let leftBestY = effH;
    let rightBestY = effH;
    for (let x = fgX0; x < vx; x++) {
      if (colCov[x] > leftPeakCov) leftPeakCov = colCov[x];
      if (colMinY[x] < leftBestY) leftBestY = colMinY[x];
    }
    for (let x = vx + 1; x <= fgX1; x++) {
      if (colCov[x] > rightPeakCov) rightPeakCov = colCov[x];
      if (colMinY[x] < rightBestY) rightBestY = colMinY[x];
    }

    const minPeak = Math.min(leftPeakCov, rightPeakCov);
    const maxPeak = Math.max(leftPeakCov, rightPeakCov);
    const topNotchDepth = colMinY[vx] - Math.max(leftBestY, rightBestY);
    const hasValleySplit = minPeak > 0 && minCov <= minPeak * 0.72 && minCov <= maxPeak * 0.70;
    const hasNotchSplit =
      minPeak > 0 && topNotchDepth > fgH * 0.08 && minCov <= minPeak * 0.80;

    if (hasValleySplit || hasNotchSplit) {
      const seamPad = Math.max(1, Math.round(fgW * 0.008));
      overlappedSplit = true;
      rawBoxes = [
        tightenBox(fgX0, Math.max(fgX0 + 2, vx - 1), 0, seamPad),
        tightenBox(Math.min(fgX1 - 2, vx + 1), fgX1, seamPad, 0),
      ];
    }
  }

  const analyzeBoxOrientation = (rb) => {
    const bw = rb.px1 - rb.px0 + 1;
    const bh = rb.py1 - rb.py0 + 1;
    const boxAspect = bw / Math.max(1, bh);

    // Measure span & center luminance across vertical bands.
    const measureBand = (f0, f1) => {
      const rStart = rb.py0 + Math.floor(bh * f0);
      const rEnd = Math.max(rStart, rb.py0 + Math.floor(bh * f1));
      let spanSum = 0;
      let spanCnt = 0;
      let lumSum = 0;
      let lumCnt = 0;
      let fillRatioSum = 0;

      for (let y = rStart; y <= rEnd; y++) {
        let minX = bw;
        let maxX = -1;
        let rowOpaque = 0;
        const rowOff = y * effW;
        for (let x = rb.px0; x <= rb.px1; x++) {
          if (isOpaque(rowOff * 4 + x * 4)) {
            const lx = x - rb.px0;
            if (lx < minX) minX = lx;
            if (lx > maxX) maxX = lx;
            rowOpaque++;
          }
        }
        if (maxX >= minX) {
          const span = maxX - minX + 1;
          spanSum += span;
          spanCnt++;
          fillRatioSum += rowOpaque / span;
          const cx0 = rb.px0 + minX + Math.floor(span * 0.25);
          const cx1 = rb.px0 + minX + Math.floor(span * 0.75);
          for (let x = cx0; x <= cx1; x++) {
            const o = (rowOff + x) * 4;
            if (isOpaque(o)) {
              lumSum += lum(rgbaData[o], rgbaData[o + 1], rgbaData[o + 2]);
              lumCnt++;
            }
          }
        }
      }

      return {
        avgSpan: spanCnt ? spanSum / spanCnt : 0,
        avgLum: lumCnt ? lumSum / lumCnt : 128,
        avgFill: spanCnt ? fillRatioSum / spanCnt : 1,
        lumCnt,
      };
    };

    const topTip = measureBand(0.03, 0.15);
    const upperBand = measureBand(0.08, 0.36);
    const midBand = measureBand(0.40, 0.62);
    const lowerBand = measureBand(0.64, 0.92);
    const botTip = measureBand(0.85, 0.97);
    const maxSpan = Math.max(upperBand.avgSpan, midBand.avgSpan, lowerBand.avgSpan, 1);

    // Zero-bias width cue: wider end leans toward the toe/forefoot.
    const widthScore =
      ((upperBand.avgSpan - lowerBand.avgSpan) / Math.max(upperBand.avgSpan, lowerBand.avgSpan, 1)) * 2.4;

    // Collar opening interior luminance contrast cue (darker interior vs bright knit toe/midsole).
    let lumCue = 0;
    if (upperBand.lumCnt > 8 && lowerBand.lumCnt > 8) {
      const lumDiff = upperBand.avgLum - lowerBand.avgLum;
      if (Math.abs(lumDiff) > 22) {
        lumCue = clamp(lumDiff / 150, -0.55, 0.55) * 0.65;
      }
    }

    // Hollow ankle opening fill-ratio cue (cutouts with dark/transparent collar gaps vs solid forefoot).
    const fillCue = clamp(upperBand.avgFill - lowerBand.avgFill, -0.35, 0.35) * 0.5;

    const toeUpScore = widthScore + lumCue + fillCue;
    const toeUp = toeUpScore > 0;

    // Front 3/4 perspective check: narrower collar end + vertical/slightly tilted box framing.
    const collarTipSpan = toeUp ? botTip.avgSpan : topTip.avgSpan;
    const collarTipRatio = collarTipSpan / maxSpan;
    const isFrontThreeQuarter =
      collarTipRatio < 0.72 && boxAspect < 0.72 && bh > bw * 1.15;

    return {
      ...rb,
      bw,
      bh,
      boxAspect,
      area: bw * bh,
      toeUpScore,
      toeUp,
      isFrontThreeQuarter,
    };
  };

  // Determine side vs single-top vs pair.
  if (rawBoxes.length < 2 && fgAspect > 1.25) {
    // Side view shoe.
    const rb = tightenBox(fgX0, fgX1);
    const w = rb.px1 - rb.px0 + 1;
    const leftTopMax = (() => {
      let minY = effH;
      for (let x = rb.px0; x <= rb.px0 + Math.floor(w * 0.42); x++) {
        if (colCov[x] > 0 && colMinY[x] < minY) minY = colMinY[x];
      }
      return rb.py1 - minY;
    })();
    const rightTopMax = (() => {
      let minY = effH;
      for (let x = rb.px0 + Math.floor(w * 0.58); x <= rb.px1; x++) {
        if (colCov[x] > 0 && colMinY[x] < minY) minY = colMinY[x];
      }
      return rb.py1 - minY;
    })();
    // Tall end is heel/collar; lower sloping end is toe.
    const toeLeft = leftTopMax < rightTopMax;

    const toUVBox = (b) => ({
      u0: clamp((b.px0 + (b.px1 - b.px0) * 0.015) / effW, 0.002, 0.996),
      u1: clamp((b.px1 - (b.px1 - b.px0) * 0.015 + 1) / effW, 0.004, 0.998),
      v1: clamp(1 - (b.py0 + (b.py1 - b.py0) * 0.015) / effH, 0.004, 0.998),
      v0: clamp(1 - (b.py1 - (b.py1 - b.py0) * 0.015 + 1) / effH, 0.002, 0.996),
      toeUp: false,
      toeLeft,
      isFrontThreeQuarter: false,
      aspect: w / Math.max(1, rb.py1 - rb.py0 + 1),
    });

    const box = toUVBox(rb);
    const { soleColor, liningColor } = extractPaletteFromPhoto(rgbaData, effW, effH, isOpaque, [rb], false, 'side');

    return {
      mode: 'side',
      toeLeft,
      toeUp: false,
      isFrontThreeQuarter: false,
      boxes: null,
      box,
      heroBoxIndex: null,
      tstrap: false,
      hasHeelCup: false,
      soleColor,
      liningColor,
    };
  }

  const activeRawBoxes =
    rawBoxes.length >= 2
      ? rawBoxes
      : [tightenBox(fgX0, fgX1)];

  const analyzed = activeRawBoxes.map(analyzeBoxOrientation);

  // Pair orientation consensus: match pair orientation unless both sides strongly oppose.
  if (analyzed.length >= 2) {
    const [a0, a1] = analyzed;
    if (a0.toeUp !== a1.toeUp) {
      const strongOpposing =
        Math.abs(a0.toeUpScore) > 0.35 &&
        Math.abs(a1.toeUpScore) > 0.35 &&
        Math.min(a0.bw, a1.bw) > Math.max(a0.bw, a1.bw) * 0.85;
      if (!strongOpposing) {
        const w0 = a0.area * (0.4 + Math.abs(a0.toeUpScore));
        const w1 = a1.area * (0.4 + Math.abs(a1.toeUpScore));
        const consensusToeUp = a0.toeUpScore * w0 + a1.toeUpScore * w1 > 0;
        a0.toeUp = consensusToeUp;
        a1.toeUp = consensusToeUp;
      }
    }
    if (a0.isFrontThreeQuarter || a1.isFrontThreeQuarter) {
      a0.isFrontThreeQuarter = true;
      a1.isFrontThreeQuarter = true;
    }
  }

  const toNormalizedBox = (b, isPair, idx) => {
    // Tight inset so tongue crest & perimeter never leak adjacent shoe/white halo.
    const insetL = isPair && idx === 1 ? 0.015 : 0.025;
    const insetR = isPair && idx === 0 ? 0.015 : 0.025;
    const insetT = 0.015;
    const insetB = 0.015;
    const rawU0 = clamp((b.px0 + b.bw * insetL) / effW, 0.002, 0.996);
    const rawU1 = clamp((b.px1 - b.bw * insetR + 1) / effW, 0.004, 0.998);
    const rawV1 = clamp(1 - (b.py0 + b.bh * insetT) / effH, 0.004, 0.998);
    const rawV0 = clamp(1 - (b.py1 - b.bh * insetB + 1) / effH, 0.002, 0.996);
    const nu0 = Math.min(rawU0, rawU1 - 0.005);
    const nu1 = Math.max(rawU1, rawU0 + 0.005);
    const nv0 = Math.min(rawV0, rawV1 - 0.005);
    const nv1 = Math.max(rawV1, rawV0 + 0.005);
    const minSpan = (nu1 - nu0) * 0.36;

    // 24-bin median silhouette span from nv0 (bottom) to nv1 (top) to exclude smeared margins & outer sole rim.
    const N_BINS = 24;
    let spans = [];
    const bandHalf = Math.max(2, Math.floor(b.bh / 36));
    for (let k = 0; k < N_BINS; k++) {
      const vVal = lerp(nv0, nv1, k / (N_BINS - 1));
      const yCenter = Math.round((1 - vVal) * effH);
      const yStart = clamp(yCenter - bandHalf, b.py0, b.py1);
      const yEnd = clamp(yCenter + bandHalf, b.py0, b.py1);
      const lefts = [];
      const rights = [];
      for (let y = yStart; y <= yEnd; y++) {
        let lx = -1;
        let rx = -1;
        for (let x = b.px0; x <= b.px1; x++) {
          if (isOpaque((y * effW + x) * 4)) {
            lx = x;
            break;
          }
        }
        if (lx < 0) continue;
        for (let x = b.px1; x >= lx; x--) {
          if (isOpaque((y * effW + x) * 4)) {
            rx = x;
            break;
          }
        }
        if (rx > lx + 3) {
          lefts.push(lx);
          rights.push(rx);
        }
      }
      let uL = nu0;
      let uR = nu1;
      if (lefts.length > 0) {
        lefts.sort((p, q) => p - q);
        rights.sort((p, q) => p - q);
        uL = clamp(lefts[Math.floor(lefts.length * 0.5)] / effW, nu0, nu1);
        uR = clamp((rights[Math.floor(rights.length * 0.5)] + 1) / effW, nu0, nu1);
      }
      if (uR - uL < minSpan) {
        const mid = (uL + uR) * 0.5;
        uL = clamp(mid - minSpan * 0.5, nu0, nu1 - minSpan);
        uR = clamp(uL + minSpan, nu0 + minSpan, nu1);
      }
      spans.push([uL, uR]);
    }
    for (let pass = 0; pass < 2; pass++) {
      spans = spans.map((cur, i) => {
        if (i === 0 || i === spans.length - 1) return cur;
        const prev = spans[i - 1];
        const next = spans[i + 1];
        return [
          prev[0] * 0.25 + cur[0] * 0.5 + next[0] * 0.25,
          prev[1] * 0.25 + cur[1] * 0.5 + next[1] * 0.25,
        ];
      });
    }

    return {
      u0: nu0,
      u1: nu1,
      v0: nv0,
      v1: nv1,
      rowSpans: spans,
      toeUp: b.toeUp,
      isFrontThreeQuarter: b.isFrontThreeQuarter,
      aspect: b.boxAspect,
    };
  };

  const isPair = analyzed.length >= 2;
  const uvBoxes = analyzed.map((b, i) => toNormalizedBox(b, isPair, i));
  let heroBoxIndex = null;
  if (
    isPair &&
    overlappedSplit &&
    analyzed[0].isFrontThreeQuarter &&
    Math.min(analyzed[0].bw, analyzed[1].bw) < Math.max(analyzed[0].bw, analyzed[1].bw) * 0.86
  ) {
    heroBoxIndex = analyzed[1].area >= analyzed[0].area ? 1 : 0;
  }
  const primary = analyzed[heroBoxIndex !== null ? heroBoxIndex : analyzed.length - 1];
  const sandalHints = analyzeSandalCues(rgbaData, effW, effH, isOpaque, primary);
  const { soleColor, liningColor } = extractPaletteFromPhoto(
    rgbaData,
    effW,
    effH,
    isOpaque,
    analyzed,
    primary.toeUp,
    isPair ? 'pair' : 'top'
  );

  return {
    mode: isPair ? 'pair' : 'top',
    toeLeft: true,
    toeUp: primary.toeUp,
    isFrontThreeQuarter: primary.isFrontThreeQuarter,
    boxes: isPair ? uvBoxes : null,
    box: isPair ? null : uvBoxes[0],
    heroBoxIndex,
    tstrap: sandalHints.tstrap,
    ...(sandalHints.tstrap ? { sandalStyle: 'tstrap' } : {}),
    hasHeelCup: sandalHints.hasHeelCup,
    soleColor,
    liningColor,
  };
}

function analyzeSandalCues(rgbaData, effW, effH, isOpaque, box) {
  if (!box || box.bh < 12) return { tstrap: false, hasHeelCup: false };
  // Midfoot center fill vs strap bridge check for T-strap, heel back row check for cup.
  let tstrapHits = 0;
  let midRows = 0;
  const midStart = box.py0 + Math.floor(box.bh * (box.toeUp ? 0.25 : 0.50));
  const midEnd = box.py0 + Math.floor(box.bh * (box.toeUp ? 0.50 : 0.75));
  for (let y = midStart; y <= midEnd; y += 2) {
    let cnt = 0;
    let centerHit = 0;
    const cx = Math.floor((box.px0 + box.px1) / 2);
    for (let x = box.px0; x <= box.px1; x++) {
      if (isOpaque((y * effW + x) * 4)) {
        cnt++;
        if (Math.abs(x - cx) < box.bw * 0.14) centerHit++;
      }
    }
    midRows++;
    if (centerHit > 0 && cnt < box.bw * 0.48) tstrapHits++;
  }

  let heelOpaque = 0;
  let heelChecked = 0;
  const hStart = box.toeUp ? box.py0 + Math.floor(box.bh * 0.85) : box.py0;
  const hEnd = box.toeUp ? box.py1 : box.py0 + Math.floor(box.bh * 0.15);
  for (let y = hStart; y <= hEnd; y += 2) {
    for (let x = box.px0 + Math.floor(box.bw * 0.25); x <= box.px1 - Math.floor(box.bw * 0.25); x++) {
      heelChecked++;
      if (isOpaque((y * effW + x) * 4)) heelOpaque++;
    }
  }

  return {
    tstrap: midRows > 2 && tstrapHits / midRows > 0.45,
    hasHeelCup: heelChecked > 8 && heelOpaque / heelChecked > 0.42,
  };
}

function extractPaletteFromPhoto(rgbaData, effW, effH, isOpaque, boxes, toeUp, mode) {
  const b = boxes[boxes.length - 1];
  const bw = b.px1 - b.px0 + 1;
  const bh = b.py1 - b.py0 + 1;

  // 1. Sample outer lower perimeter & toe-bumper pixels for sole/midsole rubber color.
  const rimSamples = [];
  const samplePixel = (x, y) => {
    const o = (y * effW + x) * 4;
    if (!isOpaque(o)) return;
    const r = rgbaData[o];
    const g = rgbaData[o + 1];
    const bl = rgbaData[o + 2];
    rimSamples.push({ r, g, b: bl, lum: lum(r, g, bl) });
  };

  if (mode === 'side') {
    const r0 = b.py0 + Math.floor(bh * 0.84);
    const r1 = b.py0 + Math.floor(bh * 0.97);
    for (let y = r0; y <= r1; y += Math.max(1, Math.floor(bh / 30))) {
      for (let x = b.px0 + Math.floor(bw * 0.1); x <= b.px1 - Math.floor(bw * 0.1); x += 2) {
        samplePixel(x, y);
      }
    }
  } else {
    // Trace lowest opaque pixel per column in foreground & lower perimeter (stepping inward past contact-shadow fringe).
    const maxDy = Math.max(4, Math.min(12, Math.floor(bh * 0.045)));
    for (let x = b.px0 + 2; x <= b.px1 - 2; x += Math.max(1, Math.floor(bw / 40))) {
      if (!toeUp) {
        for (let y = b.py1; y >= b.py0 + Math.floor(bh * 0.55); y--) {
          if (isOpaque((y * effW + x) * 4)) {
            let added = 0;
            for (let dy = 1; dy <= maxDy && y - dy >= b.py0; dy++) {
              samplePixel(x, y - dy);
              added++;
            }
            if (!added) samplePixel(x, y);
            break;
          }
        }
      } else {
        for (let y = b.py0; y <= b.py0 + Math.floor(bh * 0.45); y++) {
          if (isOpaque((y * effW + x) * 4)) {
            let added = 0;
            for (let dy = 1; dy <= maxDy && y + dy <= b.py1; dy++) {
              samplePixel(x, y + dy);
              added++;
            }
            if (!added) samplePixel(x, y);
            break;
          }
        }
      }
    }

    // Also sample lower left/right outer silhouette walls where white rubber midsole sidewalls sit.
    const wallY0 = b.py0 + Math.floor(bh * (toeUp ? 0.08 : 0.55));
    const wallY1 = b.py0 + Math.floor(bh * (toeUp ? 0.45 : 0.92));
    const wallStep = Math.max(2, Math.floor(bh / 24));
    for (let y = wallY0; y <= wallY1; y += wallStep) {
      for (let x = b.px0; x <= b.px1; x++) {
        if (isOpaque((y * effW + x) * 4)) {
          for (let dx = 2; dx <= 6 && x + dx <= b.px1; dx++) samplePixel(x + dx, y);
          break;
        }
      }
      for (let x = b.px1; x >= b.px0; x--) {
        if (isOpaque((y * effW + x) * 4)) {
          for (let dx = 2; dx <= 6 && x - dx >= b.px0; dx++) samplePixel(x - dx, y);
          break;
        }
      }
    }
  }

  let soleColor = '#e2e4e8';
  if (rimSamples.length >= 6) {
    // Check if there is a distinct bright white/light-grey rubber midsole rim.
    const bright = rimSamples.filter((s) => s.lum > 175);
    const hasBrightRim = bright.length >= Math.max(5, Math.floor(rimSamples.length * 0.14));
    const pool = hasBrightRim ? bright : rimSamples;
    pool.sort((p, q) => p.lum - q.lum);
    const mid = pool[Math.floor(pool.length * (hasBrightRim ? 0.72 : 0.52))];
    // Cap pure white down slightly so sole catches 3D directional lighting without blowing out.
    const scale = mid.lum > 236 ? 234 / mid.lum : 1;
    soleColor = rgbToHex(mid.r * scale, mid.g * scale, mid.b * scale);
  }

  // 2. Sample collar interior region for lining color.
  const liningSamples = [];
  const cy0 = b.py0 + Math.floor(bh * (toeUp ? 0.70 : 0.08));
  const cy1 = b.py0 + Math.floor(bh * (toeUp ? 0.88 : 0.26));
  const cx0 = b.px0 + Math.floor(bw * 0.30);
  const cx1 = b.px0 + Math.floor(bw * 0.70);
  for (let y = cy0; y <= cy1; y += 2) {
    for (let x = cx0; x <= cx1; x += 2) {
      const o = (y * effW + x) * 4;
      if (isOpaque(o)) {
        const r = rgbaData[o];
        const g = rgbaData[o + 1];
        const bl = rgbaData[o + 2];
        liningSamples.push({ r, g, b: bl, lum: lum(r, g, bl) });
      }
    }
  }

  let liningColor = '#1c1f26';
  if (liningSamples.length >= 6) {
    liningSamples.sort((p, q) => p.lum - q.lum);
    const darkQuartile = liningSamples[Math.floor(liningSamples.length * 0.22)];
    if (darkQuartile.lum < 120) {
      liningColor = rgbToHex(darkQuartile.r, darkQuartile.g, darkQuartile.b);
    }
  }

  return { soleColor, liningColor };
}

function resolveShoeBox(side, layout) {
  const mode = layout?.mode || 'top';
  if (mode === 'pair' && Array.isArray(layout.boxes) && layout.boxes.length >= 2) {
    const b0 = layout.boxes[0];
    const b1 = layout.boxes[1];
    const toeUp = !!(b1?.toeUp ?? b0?.toeUp ?? layout.toeUp);
    if (Number.isInteger(layout.heroBoxIndex) && layout.boxes[layout.heroBoxIndex]) {
      const hero = layout.boxes[layout.heroBoxIndex];
      return { ...hero, toeUp: hero.toeUp ?? toeUp };
    }
    // In front-facing camera (toeUp === false), -X foot (side = -1) is screen-left (b0), +X foot (side = +1) is screen-right (b1).
    // In top-down wearer POV (toeUp === true), wearer's left (+X) is image-left (b0), wearer's right (-X) is image-right (b1).
    const picked = toeUp ? (side > 0 ? b0 : b1) : side > 0 ? b1 : b0;
    return { ...picked, toeUp };
  }
  if (layout?.box) {
    return {
      ...layout.box,
      toeUp: layout.box.toeUp !== undefined ? layout.box.toeUp : layout.toeUp !== false,
    };
  }
  return {
    u0: 0.04,
    u1: 0.96,
    v0: 0.04,
    v1: 0.96,
    toeUp: layout?.toeUp !== undefined ? layout.toeUp : false,
    isFrontThreeQuarter: !!layout?.isFrontThreeQuarter,
    aspect: 0.5,
  };
}

/**
 * Multi-zone anatomical UV mapper for footwear upper shells.
 * Preserves toeUp & perspective flags, keeps tongue logos upright and legible,
 * maps forefoot knit/toe-cap monotonically, and wraps quarters smoothly around
 * the back heel without duplicating tongue logos onto the heel counter.
 */
export function shoeUVAnatomical(side, x, y, z, frame, layout, opts = {}) {
  const mode = layout?.mode || 'top';
  const z0 = frame.z0;
  const z1 = frame.z1;
  const xMin = frame.xMin;
  const xMax = frame.xMax;
  const yMin = frame.yMin;
  const yMax = frame.yMax;
  const ankleZ = frame.ankleZ !== undefined ? frame.ankleZ : lerp(z0, z1, 0.24);

  const zSpan = Math.max(1e-4, z1 - z0);
  const xSpan = Math.max(1e-4, xMax - xMin);
  const ySpan = Math.max(1e-4, yMax - yMin);

  if (mode === 'side') {
    const bx = resolveShoeBox(side, layout);
    const along = clamp((z - z0) / zSpan, 0, 1);
    const elev = clamp((y - yMin) / ySpan, 0, 1);
    const toeLeft = layout?.toeLeft !== false;
    const uAlong = toeLeft ? 1 - along : along;
    const u = lerp(bx.u0, bx.u1, clamp(uAlong * 0.94 + 0.03, 0.01, 0.99));
    const v = lerp(bx.v0, bx.v1, clamp(elev * 0.92 + 0.04, 0.01, 0.99));
    return [u, v];
  }

  const bx = resolveShoeBox(side, layout);
  const toeUp = !!bx.toeUp;
  const acrossRaw = clamp((x - xMin) / xSpan, 0, 1);
  const acrossEff = Number.isFinite(opts.archU)
    ? lerp(acrossRaw, clamp(opts.archU, 0, 1), 0.75)
    : acrossRaw;
  const wallElev = Number.isFinite(opts.wallElev)
    ? clamp(opts.wallElev, 0, 1)
    : clamp((y - yMin) / ySpan, 0, 1);

  // Flip X->U only when photo was shot in top-down wearer POV (toeUp === true).
  const lateralU = toeUp ? 1 - acrossEff : acrossEff;

  let uBoxNorm;
  let photoFromToe;
  let edgeInset = 0.12;

  const bootShaftBlend = opts.isBootShaft
    ? 1
    : Number.isFinite(opts.bootShaftBlend)
      ? clamp(opts.bootShaftBlend, 0, 1)
      : 0;

  // 1. Dorsal tongue + laces + forefoot vamp (ahead of tongueOriginZ):
  const tongueOriginZ = frame.tongueStartZ !== undefined ? frame.tongueStartZ : ankleZ;
  const fwdT = clamp((z - tongueOriginZ) / Math.max(1e-4, z1 - tongueOriginZ), 0, 1);
  const curvedFwd = Math.pow(fwdT, 0.86);
  const uDorsal = lerp(0.08, 0.92, lateralU);
  // End at 0.14 at toe tip (z1) so knit upper stays above bottom outsole shadow / rubber rim [0.00..0.12].
  const vDorsal = lerp(0.90, 0.14, curvedFwd);

  // 2. Properly oriented 2D knit/upper swatch for side quarters, heel counter & lower sidewalls:
  //    Horizontal Z maps across U, vertical wallElev maps across V within the clean forefoot/vamp
  //    fabric band [0.16..0.32], eliminating 90°-rotated vertical lace/collar stripes on sidewalls
  //    and wrapping C-infinity smoothly across 0.5 at the back heel seam.
  const alongShoe = clamp((z - z0) / zSpan, 0, 1);
  const sideFactor = Math.sin((lateralU - 0.5) * Math.PI);
  const uQuarter = 0.5 + sideFactor * lerp(0.12, 0.36, alongShoe);
  const vQuarter = lerp(0.16, 0.32, clamp(wallElev * 0.82 + (1 - alongShoe) * 0.18, 0, 1));

  // 3. Smooth saddle mask isolating tongue/laces to upper dorsal instep while unifying across forefoot toe box.
  const sAbs = Math.abs(acrossEff - 0.5) * 2;
  const zAhead = smoothstep(ankleZ - 0.012, tongueOriginZ, z);
  const dorsalElev = smoothstep(0.24, 0.68, wallElev);
  const dorsalCenter = 1 - smoothstep(0.60, 0.90, sAbs) * (1 - smoothstep(0.75, 0.92, wallElev));
  const forefootUnify = smoothstep(0.38, 0.68, fwdT);
  const saddleMask = clamp(
    Math.max(zAhead * dorsalElev * dorsalCenter, zAhead * forefootUnify),
    0,
    1
  );

  uBoxNorm = lerp(uQuarter, uDorsal, saddleMask);
  photoFromToe = lerp(vQuarter, vDorsal, saddleMask);
  edgeInset = lerp(0.14, 0.07, saddleMask);

  if (bootShaftBlend > 0) {
    const shaftY0 = opts.shaftY0 !== undefined ? opts.shaftY0 : yMin;
    const shaftY1 = opts.shaftY1 !== undefined ? opts.shaftY1 : yMax;
    const elev = clamp((y - shaftY0) / Math.max(1e-4, shaftY1 - shaftY0), 0, 1);
    const frontShaftMask = smoothstep(ankleZ - 0.025, ankleZ + 0.015, z);
    const uShaftFront = lerp(0.18, 0.82, lateralU);
    const uShaftBack = 0.5 + sideFactor * 0.22;
    const uShaft = lerp(uShaftBack, uShaftFront, frontShaftMask);
    const vShaft = lerp(0.24, 0.84, elev);
    uBoxNorm = lerp(uBoxNorm, uShaft, bootShaftBlend);
    photoFromToe = lerp(photoFromToe, vShaft, bootShaftBlend);
    edgeInset = lerp(edgeInset, 0.12, bootShaftBlend);
  }

  const vPos = clamp(photoFromToe, 0.04, 0.96);
  const v = toeUp ? lerp(bx.v1, bx.v0, vPos) : lerp(bx.v0, bx.v1, vPos);

  let uSpan0 = lerp(bx.u0, bx.u1, edgeInset);
  let uSpan1 = lerp(bx.u0, bx.u1, 1 - edgeInset);
  if (Array.isArray(bx.rowSpans) && bx.rowSpans.length >= 2) {
    const vBoxFrac = clamp((v - bx.v0) / Math.max(1e-4, bx.v1 - bx.v0), 0, 1);
    const fIdx = vBoxFrac * (bx.rowSpans.length - 1);
    const i0 = Math.floor(fIdx);
    const i1 = Math.min(bx.rowSpans.length - 1, i0 + 1);
    const ft = fIdx - i0;
    const rawL = lerp(bx.rowSpans[i0][0], bx.rowSpans[i1][0], ft);
    const rawR = lerp(bx.rowSpans[i0][1], bx.rowSpans[i1][1], ft);
    uSpan0 = lerp(rawL, rawR, edgeInset);
    uSpan1 = lerp(rawL, rawR, 1 - edgeInset);
  }

  const u = lerp(uSpan0, uSpan1, clamp(uBoxNorm, 0.01, 0.99));
  return [u, v];
}

/**
 * Returns smoothed longitudinal foot profile stations across [zStart..zEnd]
 * aligned to the canonical left/right avatar foot frame.
 */
function sampleProfileStations(anatomy, side, numSlices, zPadBack = 0.006, zPadFront = 0.005, opts = {}) {
  const raw = anatomy.profile;
  const xSign = anatomy.shaft?.[0]?.cx < 0 ? -1 : 1;

  // Pre-smooth raw profile knots slightly (3-point moving filter on interior knots)
  // to eliminate any avatar foot scan steps (e.g. z=0.041 dip / z=-0.070 heel step).
  const smoothed = raw.map((k, idx) => {
    const prev = raw[Math.max(0, idx - 1)];
    const next = raw[Math.min(raw.length - 1, idx + 1)];
    const x0 = idx === 0 || idx === raw.length - 1 ? k.x0 : (prev.x0 + 2 * k.x0 + next.x0) * 0.25;
    const x1 = idx === 0 || idx === raw.length - 1 ? k.x1 : (prev.x1 + 2 * k.x1 + next.x1) * 0.25;
    const top = idx === 0 || idx === raw.length - 1 ? k.top : (prev.top + 2 * k.top + next.top) * 0.25;
    return { z: k.z, x0, x1, top };
  });

  const zStart = anatomy.heelZ - zPadBack;
  const zEnd = anatomy.toeZ + zPadFront;

  const evalKnot = (z) => {
    const cz = clamp(z, smoothed[0].z, smoothed[smoothed.length - 1].z);
    let idx = 0;
    while (idx < smoothed.length - 2 && smoothed[idx + 1].z < cz) idx++;
    const a = smoothed[idx];
    const b = smoothed[idx + 1] || a;
    const t = b.z > a.z ? clamp((cz - a.z) / (b.z - a.z), 0, 1) : 0;
    const lx0 = lerp(a.x0, b.x0, t) * xSign;
    const lx1 = lerp(a.x1, b.x1, t) * xSign;
    const rawMin = Math.min(lx0, lx1);
    const rawMax = Math.max(lx0, lx1);
    // Mirror across X=0 depending on foot side (+1 vs -1).
    const xMin = side > 0 ? rawMin : -rawMax;
    const xMax = side > 0 ? rawMax : -rawMin;
    const top = lerp(a.top, b.top, t);
    return { xMin, xMax, top };
  };

  const athleticLast = !!opts.athleticLast;
  const ballZ = opts.ballZ !== undefined ? opts.ballZ : anatomy.ballZ;
  const heelContactZ = opts.heelContactZ !== undefined ? opts.heelContactZ : anatomy.heelContactZ;
  const ballKnot = evalKnot(ballZ);
  const cxBall = (ballKnot.xMin + ballKnot.xMax) * 0.5;
  const hwBall = (ballKnot.xMax - ballKnot.xMin) * 0.5;
  const heelKnot = evalKnot(heelContactZ);
  const cxHeelRef = (heelKnot.xMin + heelKnot.xMax) * 0.5;
  const hwHeelRef = Math.max(hwBall * 0.66, (heelKnot.xMax - heelKnot.xMin) * 0.5);

  const stations = [];
  for (let i = 0; i <= numSlices; i++) {
    const linT = i / numSlices;
    const z = lerp(zStart, zEnd, linT);
    const rawBounds = evalKnot(z);
    let xMin = rawBounds.xMin;
    let xMax = rawBounds.xMax;
    const top = rawBounds.top;

    if (athleticLast) {
      if (z > ballZ) {
        // Natural rounded athletic toe-box last: prevents bare-toe pinky-side wedge & UV twist
        // while strictly enclosing the bare foot bounds inside [smoothed[0].z .. smoothed[last].z].
        const tToe = clamp((z - ballZ) / Math.max(1e-4, zEnd - ballZ), 0, 1);
        const toeInwardShift = (side > 0 ? -0.006 : 0.006) * Math.pow(tToe, 1.5);
        const cxTarget = cxBall + toeInwardShift;
        const hwTarget = hwBall * Math.pow(Math.max(0.19, 1 - Math.pow(tToe, 2.5)), 0.44);
        if (z <= smoothed[smoothed.length - 1].z) {
          xMin = Math.min(xMin, cxTarget - hwTarget);
          xMax = Math.max(xMax, cxTarget + hwTarget);
        } else {
          const ft = clamp((z - smoothed[smoothed.length - 1].z) / Math.max(1e-4, zEnd - smoothed[smoothed.length - 1].z), 0, 1);
          const toeEdge = evalKnot(smoothed[smoothed.length - 1].z);
          const toeInwardAtEdge = (side > 0 ? -0.006 : 0.006) * Math.pow((smoothed[smoothed.length - 1].z - ballZ) / Math.max(1e-4, zEnd - ballZ), 1.5);
          const hwAtEdge = hwBall * Math.pow(Math.max(0.19, 1 - Math.pow((smoothed[smoothed.length - 1].z - ballZ) / Math.max(1e-4, zEnd - ballZ), 2.5)), 0.44);
          const edgeMin = Math.min(toeEdge.xMin, cxBall + toeInwardAtEdge - hwAtEdge);
          const edgeMax = Math.max(toeEdge.xMax, cxBall + toeInwardAtEdge + hwAtEdge);
          xMin = lerp(edgeMin, cxTarget - hwTarget, smoothstep(0, 1, ft));
          xMax = lerp(edgeMax, cxTarget + hwTarget, smoothstep(0, 1, ft));
        }
      } else if (z < heelContactZ) {
        // Rounded athletic heel cup & outsole perimeter (eliminates pinched arrowhead heel).
        const tHeel = clamp((heelContactZ - z) / Math.max(1e-4, heelContactZ - zStart), 0, 1);
        const hwTarget = hwHeelRef * Math.pow(Math.max(0.14, 1 - Math.pow(tHeel, 2.3)), 0.45);
        if (z >= smoothed[0].z) {
          xMin = Math.min(xMin, cxHeelRef - hwTarget);
          xMax = Math.max(xMax, cxHeelRef + hwTarget);
        } else {
          const bt = clamp((smoothed[0].z - z) / Math.max(1e-4, smoothed[0].z - zStart), 0, 1);
          const heelEdge = evalKnot(smoothed[0].z);
          const hwAtEdge = hwHeelRef * Math.pow(Math.max(0.14, 1 - Math.pow((heelContactZ - smoothed[0].z) / Math.max(1e-4, heelContactZ - zStart), 2.3)), 0.45);
          const edgeMin = Math.min(heelEdge.xMin, cxHeelRef - hwAtEdge);
          const edgeMax = Math.max(heelEdge.xMax, cxHeelRef + hwAtEdge);
          xMin = lerp(edgeMin, cxHeelRef - hwTarget, smoothstep(0, 1, bt));
          xMax = lerp(edgeMax, cxHeelRef + hwTarget, smoothstep(0, 1, bt));
        }
      }
      const cx = (xMin + xMax) * 0.5;
      const hw = (xMax - xMin) * 0.5;
      stations.push({ z, cx, hw: Math.max(0.012, hw), rawTop: top });
    } else {
      const cx = (xMin + xMax) * 0.5;
      let hw = (xMax - xMin) * 0.5;
      if (z < smoothed[0].z) {
        const bt = clamp((z - zStart) / Math.max(1e-4, smoothed[0].z - zStart), 0, 1);
        hw *= Math.sqrt(Math.max(0.08, bt));
      } else if (z > smoothed[smoothed.length - 1].z) {
        const ft = clamp((zEnd - z) / Math.max(1e-4, zEnd - smoothed[smoothed.length - 1].z), 0, 1);
        hw *= Math.sqrt(Math.max(0.08, ft));
      }
      stations.push({ z, cx, hw: Math.max(0.008, hw), rawTop: top });
    }
  }

  if (athleticLast && stations.length > 4) {
    for (let pass = 0; pass < 2; pass++) {
      const copy = stations.map((s) => ({ ...s }));
      for (let i = 1; i < stations.length - 1; i++) {
        stations[i].cx = copy[i - 1].cx * 0.25 + copy[i].cx * 0.5 + copy[i + 1].cx * 0.25;
        stations[i].hw = copy[i - 1].hw * 0.25 + copy[i].hw * 0.5 + copy[i + 1].hw * 0.25;
      }
    }
    // Re-enforce strict bare-foot enclosure after smoothing so zero toe/heel pokethrough can occur.
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      if (st.z >= smoothed[0].z && st.z <= smoothed[smoothed.length - 1].z) {
        const rawBounds = evalKnot(st.z);
        const sMin = Math.min(st.cx - st.hw, rawBounds.xMin);
        const sMax = Math.max(st.cx + st.hw, rawBounds.xMax);
        st.cx = (sMin + sMax) * 0.5;
        st.hw = (sMax - sMin) * 0.5;
      }
    }
  }

  return { stations, zStart, zEnd };
}

/**
 * Builds a grid BufferGeometry of size (nRows + 1) x (nCols + 1) with optional double-sided winding.
 */
function buildGridPart(nRows, nCols, evalPoint, flipWinding = false) {
  const vRows = nRows + 1;
  const vCols = nCols + 1;
  const positions = new Float32Array(vRows * vCols * 3);
  const uvs = new Float32Array(vRows * vCols * 2);

  for (let r = 0; r < vRows; r++) {
    for (let c = 0; c < vCols; c++) {
      const p = evalPoint(r, c);
      const vi = (r * vCols + c) * 3;
      const ui = (r * vCols + c) * 2;
      positions[vi] = p.x;
      positions[vi + 1] = p.y;
      positions[vi + 2] = p.z;
      uvs[ui] = p.u ?? 0.5;
      uvs[ui + 1] = p.v ?? 0.5;
    }
  }

  const indices = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const a = r * vCols + c;
      const b = a + 1;
      const d = (r + 1) * vCols + c;
      const e = d + 1;
      if (!flipWinding) {
        indices.push(a, d, b, b, d, e);
      } else {
        indices.push(a, b, d, b, e, d);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function buildClosedShoeForSide(side, anatomy, spec, layout, standalone) {
  const kind = spec?.kind || 'sneaker';
  const isBootKind = kind === 'boot' || kind === 'ankle_boot';
  const heelExtra = clamp(spec?.heelHeight || 0, 0, 0.14);
  const soleThickness = Math.max(
    0.010,
    spec?.soleThickness || (kind === 'sneaker' ? 0.024 : kind === 'boot' || kind === 'ankle_boot' ? 0.020 : 0.014)
  );

  const zPadBack = kind === 'sneaker' ? 0.010 : 0.007;
  const zPadFront = kind === 'sneaker' ? 0.009 : 0.006;
  const nSlices = 36;
  const { stations, zStart, zEnd } = sampleProfileStations(anatomy, side, nSlices, zPadBack, zPadFront, {
    athleticLast: kind === 'sneaker' || kind === 'loafer' || kind === 'boot' || kind === 'ankle_boot',
    ballZ: anatomy.ballZ,
    heelContactZ: anatomy.heelContactZ,
  });

  const upperPad = kind === 'sneaker' ? 0.0065 : kind === 'boot' || kind === 'ankle_boot' ? 0.006 : 0.004;
  const frameXMin = Math.min(...stations.map((s) => s.cx - s.hw - upperPad));
  const frameXMax = Math.max(...stations.map((s) => s.cx + s.hw + upperPad));

  // Anatomical height milestones tailored per footwear silhouette.
  const ankleY = anatomy.ankleY;
  const ankleZ = anatomy.ankleZ;
  const ballZ = anatomy.ballZ;
  const heelZ = anatomy.heelZ;
  const soleBottomY = anatomy.soleBottomY;
  const yWelt = Math.min(-0.007, (soleBottomY || -0.0061) - 0.002);
  const yOutsoleBottom = yWelt - soleThickness;

  const tongueCenterZ = ankleZ + 0.014;
  const sideCollarY =
    kind === 'sneaker'
      ? ankleY + 0.008
      : kind === 'loafer'
        ? ankleY - 0.016
        : kind === 'flat' || kind === 'heel'
          ? ankleY - 0.028
          : kind === 'ankle_boot'
            ? ankleY + 0.065
            : Math.max(ankleY + 0.16, spec?.collar || ankleY + 0.22);

  const bootFootTop = ankleY + 0.018;

  const heelTabY =
    kind === 'sneaker'
      ? ankleY + 0.020
      : kind === 'loafer' || kind === 'flat' || kind === 'heel'
        ? ankleY - 0.008
        : bootFootTop + 0.006;

  const tonguePeakY =
    kind === 'sneaker'
      ? ankleY + 0.026
      : kind === 'loafer'
        ? ankleY + 0.004
        : kind === 'boot' || kind === 'ankle_boot'
          ? bootFootTop
          : sideCollarY;

  const toeCapY = yWelt + (kind === 'sneaker' ? 0.040 : 0.028);
  const ballDorsalY = yWelt + (kind === 'sneaker' ? 0.064 : 0.044);

  const computeSoleProfile = (z) => {
    const heelT = clamp((z - zStart) / Math.max(1e-4, ballZ - zStart), 0, 1);
    const springT = smoothstep(ballZ, zEnd, z);
    // Athletic sneakers curl upward gently at the toe tip (toe-spring) while keeping heel/ball grounded.
    const toeSpringLift = (kind === 'sneaker' ? 0.0055 : isBootKind ? 0.0032 : 0.0025) * springT * springT;
    // Boots feature a slight midfoot waist arch between the grounded heel block and forefoot ball.
    const waistLift = isBootKind ? Math.sin(smoothstep(heelZ + 0.024, ballZ - 0.01, z) * Math.PI) * 0.0035 : 0;
    const botY = yOutsoleBottom + waistLift + toeSpringLift;
    // Cup-sole foxing rises slightly above yWelt on sneakers; boots have a crisp Goodyear welt ledge.
    const foxingRise = kind === 'sneaker' ? lerp(0.012, 0.005, heelT) : isBootKind ? 0.004 : 0.003;
    const topY = yWelt + foxingRise + toeSpringLift * 0.85;
    const flange = (kind === 'sneaker' ? 0.0032 : isBootKind ? 0.0028 : 0.0020) * (1 - 0.15 * springT);
    return { botY, topY, flange };
  };

  const computeCollarAndDorsalY = (z, sAbs /* 0 at center spine, 1 at sole wall */) => {
    if (isBootKind) {
      const throatZ = ankleZ + 0.022;
      if (z <= throatZ) {
        const backT = clamp((z - zStart) / Math.max(1e-4, throatZ - zStart), 0, 1);
        // Taper down smoothly toward the back heel counter so rearClosedGrid flows into the flared
        // boot shaft base instead of forming a boxy horizontal shelf behind the ankle.
        return lerp(ankleY - 0.026, ankleY + 0.010, Math.pow(backT, 0.85));
      }
      const vampT = clamp((z - throatZ) / Math.max(1e-4, zEnd - throatZ), 0, 1);
      return lerp(ankleY + 0.010, toeCapY, Math.pow(vampT, 0.82));
    }

    if (kind === 'flat' || kind === 'heel') {
      const throatStart = heelZ + 0.048;
      const throatEnd = ballZ - 0.018;
      if (z >= throatStart && z <= throatEnd) {
        const inThroat = Math.sin(((z - throatStart) / Math.max(1e-4, throatEnd - throatStart)) * Math.PI);
        const sideWallFade = smoothstep(0.55, 0.92, sAbs);
        const normalY = z < tongueCenterZ - 0.012 ? sideCollarY : lerp(ballDorsalY, toeCapY, 0.35);
        return lerp(lerp(normalY, 0.028, inThroat * 0.85), normalY, sideWallFade);
      }
    }

    if (z < tongueCenterZ - 0.012) {
      // Behind tongue (quarters & Achilles tab): lower on sides, higher at heel tab & toward tongue.
      const backFrac = clamp((z - zStart) / Math.max(1e-4, tongueCenterZ - 0.012 - zStart), 0, 1);
      // U-shaped dip at side collar (backFrac ~ 0.65)
      const dip = Math.sin(backFrac * Math.PI) * (kind === 'sneaker' ? 0.012 : 0.016);
      return lerp(heelTabY, sideCollarY + 0.004, backFrac) - dip;
    }

    // Anterior zone (tongue -> laces -> ball -> toe):
    const fwdT = clamp((z - (tongueCenterZ - 0.012)) / Math.max(1e-4, zEnd - (tongueCenterZ - 0.012)), 0, 1);
    const ballFrac = clamp((ballZ - (tongueCenterZ - 0.012)) / Math.max(1e-4, zEnd - (tongueCenterZ - 0.012)), 0.25, 0.85);

    let centerLineY;
    if (fwdT <= ballFrac) {
      const lt = fwdT / Math.max(1e-4, ballFrac);
      // Proud tongue bump near lt = 0.0..0.22 transitioning smoothly to vamp/ball.
      const tongueBoost = kind === 'sneaker' ? Math.exp(-Math.pow((lt - 0.06) / 0.16, 2)) * 0.014 : 0;
      centerLineY = lerp(tonguePeakY, ballDorsalY, smoothstep(0, 1, lt)) + tongueBoost;
    } else {
      const tt = (fwdT - ballFrac) / Math.max(1e-4, 1 - ballFrac);
      centerLineY = lerp(ballDorsalY, toeCapY, Math.pow(tt, 1.15));
    }

    // Around the tongue/eyestay, center (sAbs < 0.45) rises slightly above outer eyestay rim.
    if (kind === 'sneaker' && z < ballZ) {
      const sideDrop = smoothstep(0.28, 0.72, sAbs) * 0.009 * (1 - fwdT / Math.max(1e-4, ballFrac));
      return centerLineY - sideDrop;
    }
    return centerLineY;
  };

  const parts = [];

  let rAnkleSplit = 1;
  while (rAnkleSplit < nSlices - 4 && stations[rAnkleSplit].z < ankleZ + 0.002) {
    rAnkleSplit++;
  }

  const frame = {
    z0: zStart,
    z1: zEnd,
    xMin: frameXMin,
    xMax: frameXMax,
    yMin: soleBottomY,
    yMax: Math.max(tonguePeakY, sideCollarY) + 0.01,
    ankleZ,
    tongueStartZ: stations[rAnkleSplit].z,
  };

  const evalUpperUV = (x, y, z, archU = null, wallElev = 1) =>
    shoeUVAnatomical(side, x, y, z, frame, layout, {
      archU,
      wallElev,
      bootShaftBlend: isBootKind ? smoothstep(ankleY - 0.015, ankleY + 0.025, y) : 0,
      shaftY0: ankleY,
      shaftY1: sideCollarY,
    });

  // --- PART 1: GROUP 1 CONTOURED MIDSOLE & OUTSOLE FOXING ---
  // Loop parameter c = 0..10:
  // 0: bottom centerline (tread)
  // 1..3: left bottom sole -> outer left outsole corner
  // 4..6: vertical left midsole foxing wall -> welt shelf edge
  // 7..9: vertical right midsole foxing wall -> outer right outsole corner -> right bottom sole
  // Actually use clean symmetric ring c = 0..12 around entire sole perimeter at each station r = 0..nSlices:
  // c=0: botCenter -> 1: botLeftMid -> 2: botLeftCorner -> 3: wallLeftLower -> 4: wallLeftUpper(flange) -> 5: weltLeftInner
  // Wait: welt top meets upper at (cx - hw, topY) and (cx + hw, topY).
  // Keep midsole strictly BELOW upper welt join so there's zero overlap clipping!
  const nSoleCols = 10;
  const soleGrid = buildGridPart(
    nSlices,
    nSoleCols,
    (r, c) => {
      const st = stations[r];
      const hw = st.hw + upperPad;
      const { botY, topY, flange } = computeSoleProfile(st.z);
      const outerHW = hw + flange;
      let x = st.cx;
      let y = botY;

      switch (c) {
        case 0: // left inner welt meeting upper wall
          x = st.cx - hw;
          y = topY;
          break;
        case 1: // left outer midsole rim bevel
          x = st.cx - outerHW;
          y = topY - 0.0018;
          break;
        case 2: // left midsole middle bulge
          x = st.cx - (outerHW + 0.0012);
          y = lerp(botY, topY, 0.52);
          break;
        case 3: // left bottom outsole edge
          x = st.cx - (hw + flange * 0.45);
          y = botY + 0.0015;
          break;
        case 4: // bottom left sole plate
          x = st.cx - hw * 0.55;
          y = botY;
          break;
        case 5: // bottom center tread
          x = st.cx;
          y = botY;
          break;
        case 6: // bottom right sole plate
          x = st.cx + hw * 0.55;
          y = botY;
          break;
        case 7: // right bottom outsole edge
          x = st.cx + (hw + flange * 0.45);
          y = botY + 0.0015;
          break;
        case 8: // right midsole middle bulge
          x = st.cx + (outerHW + 0.0012);
          y = lerp(botY, topY, 0.52);
          break;
        case 9: // right outer midsole rim bevel
          x = st.cx + outerHW;
          y = topY - 0.0018;
          break;
        case 10: // right inner welt meeting upper wall
        default:
          x = st.cx + hw;
          y = topY;
          break;
      }
      return { x, y, z: st.z, u: c / nSoleCols, v: r / nSlices };
    },
    true
  );
  parts.push({ geometry: soleGrid, materialIndex: 1 });

  // Endcaps for sole (rounded heel back cap & toe front cap cleanly closed at r=0 and r=nSlices).
  const capExtHeel = kind === 'sneaker' ? 0.008 : isBootKind ? 0.0075 : 0.0045;
  const capExtToe = kind === 'sneaker' ? 0.009 : isBootKind ? 0.0085 : 0.005;
  for (const endIdx of [0, nSlices]) {
    const st = stations[endIdx];
    const hw = st.hw + upperPad;
    const { botY, topY, flange } = computeSoleProfile(st.z);
    const capZ = endIdx === 0 ? st.z - capExtHeel : st.z + capExtToe;
    const nSoleCapRows = 3;
    const gCap = buildGridPart(
      nSoleCapRows,
      nSoleCols,
      (rr, c) => {
        const tCap = rr / nSoleCapRows;
        const angle = tCap * Math.PI * 0.5;
        const radialScale = Math.cos(angle);
        const zBlend = Math.sin(angle);
        const outerHW = hw + flange;
        let rx = st.cx;
        let ry = topY;
        if (c === 0) { rx = st.cx - hw; ry = topY; }
        else if (c === 1) { rx = st.cx - outerHW; ry = topY - 0.0018; }
        else if (c === 2) { rx = st.cx - (outerHW + 0.0012); ry = lerp(botY, topY, 0.52); }
        else if (c === 3) { rx = st.cx - (hw + flange * 0.45); ry = botY + 0.0015; }
        else if (c === 4) { rx = st.cx - hw * 0.55; ry = botY; }
        else if (c === 5) { rx = st.cx; ry = botY; }
        else if (c === 6) { rx = st.cx + hw * 0.55; ry = botY; }
        else if (c === 7) { rx = st.cx + (hw + flange * 0.45); ry = botY + 0.0015; }
        else if (c === 8) { rx = st.cx + (outerHW + 0.0012); ry = lerp(botY, topY, 0.52); }
        else if (c === 9) { rx = st.cx + outerHW; ry = topY - 0.0018; }
        else { rx = st.cx + hw; ry = topY; }

        // Converge cleanly onto exact welt-plane apex shared with toeCapGrid / heelEndCap.
        const x = lerp(st.cx, rx, radialScale);
        const y = lerp(topY, ry, radialScale);
        const z = lerp(st.z, capZ, zBlend);
        return { x, y, z, u: 0.5 * radialScale, v: 0.5 };
      },
      endIdx === nSlices
    );
    parts.push({ geometry: gCap, materialIndex: 1 });
  }

  // Separate heel pillar for raised heels/boots is rendered by createHeelGeometry in GarmentMesh3D.
  void heelExtra;

  // --- PART 2: GROUP 0 UPPER SHELL + PROUD TONGUE + PADDED COLLAR ---
  // Divide longitudinal shoe into:
  //   (A) Forefoot / Tongue / Toe-Box (from rAnkleSplit near ankleZ to nSlices)
  //   (B) Rear Quarters & Heel Counter (from r=0 to rAnkleSplit)
  const nUpperArch = 16;

  // (A) Forefoot + Proud Tongue Grid (r = rAnkleSplit .. nSlices)
  const nForeSlices = nSlices - rAnkleSplit;
  const foreGrid = buildGridPart(nForeSlices, nUpperArch, (rf, c) => {
    const r = rAnkleSplit + rf;
    const st = stations[r];
    const hw = st.hw + upperPad;
    const { topY: soleTopY } = computeSoleProfile(st.z);
    const uParam = c / nUpperArch; // 0 (left welt) -> 0.5 (dorsal centerline) -> 1.0 (right welt)
    const theta = uParam * Math.PI; // 0 .. PI
    const cosT = Math.cos(theta); // +1 left -> -1 right
    const sinT = Math.sin(theta); // 0 edges -> 1 top spine

    // Superellipse profile gives athletic sneaker flat sidewall + curved forefoot shoulder (power < 1).
    const sAbs = Math.abs(uParam - 0.5) * 2;
    const archHeight = computeCollarAndDorsalY(st.z, sAbs) - soleTopY;

    // Rounded side curve: broad low toe box, sculpted padded tongue & eyestay near ankleZ.
    const xFrac = -Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.72);
    const yFrac = Math.pow(Math.max(0, sinT), 0.78);

    const x = st.cx + xFrac * hw;
    const y = soleTopY + yFrac * Math.max(0.012, archHeight);
    // Subtle forward tongue-tip arch fading from 0 at rf=0 so ankle seam with qGrid stays watertight.
    const tongueTipPush =
      kind === 'sneaker' && rf > 0 && rf <= 3
        ? -0.0035 * Math.sin((rf / 3) * Math.PI) * Math.max(0, sinT - 0.35)
        : 0;
    const z = st.z + tongueTipPush;
    const [u, v] = evalUpperUV(x, y, z, uParam, yFrac);
    return { x, y, z, u, v };
  });
  parts.push({ geometry: foreGrid, materialIndex: 0 });

  // Toe-tip rounded dome cap converging to the exact welt-plane apex shared with soleGrid endcap.
  const stToe = stations[nSlices];
  const toeHW = stToe.hw + upperPad;
  const { topY: toeSoleTop } = computeSoleProfile(stToe.z);
  const toeDorsalY = computeCollarAndDorsalY(stToe.z, 0);
  const toeApexZ = stToe.z + capExtToe;
  const nUpperCapRows = 3;
  const toeCapGrid = buildGridPart(
    nUpperCapRows,
    nUpperArch,
    (rr, c) => {
      const tCap = rr / nUpperCapRows;
      const angle = tCap * Math.PI * 0.5;
      const radialScale = Math.cos(angle);
      const zBlend = Math.sin(angle);
      const uParam = c / nUpperArch;
      const theta = uParam * Math.PI;
      const cosT = Math.cos(theta);
      const sinT = Math.max(0, Math.sin(theta));
      const xFrac = -Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.72);
      const yFrac = Math.pow(sinT, 0.78);
      const xRing = stToe.cx + xFrac * toeHW;
      const yRing = toeSoleTop + yFrac * Math.max(0.012, toeDorsalY - toeSoleTop);
      const x = lerp(stToe.cx, xRing, radialScale);
      const y = toeSoleTop + (yRing - toeSoleTop) * radialScale;
      const z = lerp(stToe.z, toeApexZ, zBlend);
      const archU = lerp(uParam, 0.5, tCap * 0.65);
      const wallElev = yFrac * radialScale;
      const [u, v] = evalUpperUV(x, y, z, archU, wallElev);
      return { x, y, z, u, v };
    },
    false
  );
  parts.push({ geometry: toeCapGrid, materialIndex: 0 });

  // (B) Rear Quarters & Heel Counter (r = 0 .. rAnkleSplit)
  // Build left quarter wall and right quarter wall rising from welt soleTopY up to collarRimY,
  // smoothly meeting around back heel counter (r = 0) AND meeting the forefoot at r = rAnkleSplit!
  const sideSplitIdx = nUpperArch / 2; // 8 verts per side

  // Watertight heel-end dome cap converging to the exact welt-plane apex shared with soleGrid heel endcap.
  const stHeel = stations[0];
  const hHW = stHeel.hw + upperPad;
  const { topY: hSoleTop } = computeSoleProfile(stHeel.z);
  const heelApexZ = stHeel.z - capExtHeel;
  const heelBulgeAmp = isBootKind ? 0 : -0.004;
  const heelMinArch = isBootKind ? 0.02 : 0.015;
  const heelEndCap = buildGridPart(
    nUpperCapRows,
    nUpperArch,
    (rr, c) => {
      const tCap = rr / nUpperCapRows;
      const angle = tCap * Math.PI * 0.5;
      const radialScale = Math.cos(angle);
      const zBlend = Math.sin(angle);
      const uParam = c / nUpperArch;
      const tWall = uParam <= 0.5 ? uParam * 2 : (1 - uParam) * 2;
      const theta = uParam * Math.PI;
      const cosT = cosTVal(theta);
      const sinT = Math.max(0, Math.sin(theta));
      const archHeight = computeCollarAndDorsalY(stHeel.z, 1 - tWall) - hSoleTop;
      const xFrac = -Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.72);
      const wallElev = Math.pow(sinT, 0.78);
      const xRing = stHeel.cx + xFrac * hHW;
      const yRing = hSoleTop + wallElev * Math.max(heelMinArch, archHeight);
      const zRing = stHeel.z + heelBulgeAmp * Math.sin(tWall * Math.PI * 0.75);
      const x = lerp(stHeel.cx, xRing, radialScale);
      const y = hSoleTop + (yRing - hSoleTop) * radialScale;
      const z = lerp(zRing, heelApexZ, zBlend);
      const archU = lerp(uParam, 0.5, tCap * 0.65);
      const [u, v] = evalUpperUV(x, y, z, archU, wallElev * radialScale);
      return { x, y, z, u, v };
    },
    true
  );
  parts.push({ geometry: heelEndCap, materialIndex: 0 });

  // Left & Right outer quarter walls + heel counter continuity.
  // For boot / ankle_boot, keep closed ring around full leg shaft (same topology as foreGrid!).
  if (isBootKind) {
    const rearClosedGrid = buildGridPart(rAnkleSplit, nUpperArch, (r, c) => {
      const st = stations[r];
      const hw = st.hw + upperPad;
      const { topY: soleTopY } = computeSoleProfile(st.z);
      const uParam = c / nUpperArch;
      const theta = uParam * Math.PI;
      const sAbs = Math.abs(uParam - 0.5) * 2;
      const archHeight = computeCollarAndDorsalY(st.z, sAbs) - soleTopY;
      const xFrac = -Math.sign(cosTVal(theta)) * Math.pow(Math.abs(cosTVal(theta)), 0.72);
      const yFrac = Math.pow(Math.max(0, Math.sin(theta)), 0.78);
      const x = st.cx + xFrac * hw;
      const y = soleTopY + yFrac * Math.max(0.02, archHeight);
      const [u, v] = evalUpperUV(x, y, st.z, uParam, yFrac);
      return { x, y, z: st.z, u, v };
    });
    parts.push({ geometry: rearClosedGrid, materialIndex: 0 });

    // Dedicated sculpted lower-leg shaft flaring organically into the heel counter and instep,
    // finished with a rolled collar rim and recessed dark interior lining (Group 2).
    const shaftArr = anatomy.shaft || [];
    if (shaftArr.length >= 2) {
      const yStart = Math.max(yWelt + 0.045, ankleY - 0.028);
      const yEnd = kind === 'ankle_boot' ? Math.max(0.145, ankleY + 0.065) : Math.max(0.36, spec?.collar || 0.40);
      const shaftOff = kind === 'ankle_boot' ? 0.003 : 0.0065;
      const xSign = shaftArr[0].cx < 0 ? -1 : 1;
      const sampleShaftAtY = (yVal) => {
        const cy = clamp(yVal, shaftArr[0].y, shaftArr[shaftArr.length - 1].y);
        let idx = 0;
        while (idx < shaftArr.length - 2 && shaftArr[idx + 1].y < cy) idx++;
        const a = shaftArr[idx];
        const b = shaftArr[idx + 1] || a;
        const t = b.y > a.y ? clamp((cy - a.y) / (b.y - a.y), 0, 1) : 0;
        return {
          cx: lerp(a.cx, b.cx, t) * xSign,
          rx: lerp(a.rx, b.rx, t),
          cz: lerp(a.cz, b.cz, t),
          rz: lerp(a.rz, b.rz, t),
        };
      };
      const evalShaftOuterPoint = (vT, th) => {
        const y = lerp(yStart, yEnd, vT);
        const sp = sampleShaftAtY(y);
        const baseFlare = Math.pow(1 - smoothstep(0, 0.45, vT), 1.35);
        const cuffFlare = smoothstep(0.88, 1.0, vT) * 0.0025;
        const cosTh = Math.cos(th);
        const sinTh = Math.sin(th);
        // Flare bottom of shaft into the heel counter (-Z) and instep vamp (+Z) so there is no step seam.
        const zExt = (cosTh < 0 ? 0.022 : 0.020) * baseFlare;
        const rx = sp.rx + shaftOff + cuffFlare + 0.006 * baseFlare;
        const rz = sp.rz + shaftOff + cuffFlare + zExt;
        const x = (side > 0 ? sp.cx : -sp.cx) + rx * sinTh;
        const z = sp.cz + rz * cosTh;
        return { x, y, z, sp, rx, rz };
      };
      const nyShaft = 16;
      const nTheta = 24;
      const shaftGrid = buildGridPart(
        nyShaft,
        nTheta,
        (ry, c) => {
          const vT = ry / nyShaft;
          const th = -Math.PI + (c / nTheta) * Math.PI * 2;
          const p = evalShaftOuterPoint(vT, th);
          const blendStart = ankleY - 0.015;
          const [u, v] = shoeUVAnatomical(side, p.x, p.y, p.z, frame, layout, {
            bootShaftBlend: smoothstep(blendStart, ankleY + 0.025, p.y),
            shaftY0: yStart,
            shaftY1: yEnd,
          });
          return { x: p.x, y: p.y, z: p.z, u, v };
        },
        true
      );
      parts.push({ geometry: shaftGrid, materialIndex: 0 });

      // Rolled collar rim & recessed interior shaft lining (Group 2) so top-down/front views are watertight.
      const wallThick = 0.0045;
      const yInnerBot = Math.max(ankleY + 0.012, yEnd - (kind === 'ankle_boot' ? 0.052 : 0.10));
      const liningProfile = [
        { y: yEnd, inset: 0 },
        { y: yEnd + 0.0022, inset: wallThick * 0.45 },
        { y: yEnd, inset: wallThick },
        { y: lerp(yEnd, yInnerBot, 0.35), inset: wallThick + 0.0005 },
        { y: lerp(yEnd, yInnerBot, 0.72), inset: wallThick + 0.001 },
        { y: yInnerBot, inset: wallThick + 0.0015 },
      ];
      const shaftLiningGrid = buildGridPart(
        liningProfile.length - 1,
        nTheta,
        (ry, c) => {
          const lp = liningProfile[ry];
          const sp = sampleShaftAtY(Math.min(lp.y, yEnd));
          const cuffFlare = ry <= 2 ? 0.0025 : 0;
          const th = -Math.PI + (c / nTheta) * Math.PI * 2;
          const rx = Math.max(0.016, sp.rx + shaftOff + cuffFlare - lp.inset);
          const rz = Math.max(0.018, sp.rz + shaftOff + cuffFlare - lp.inset);
          const x = (side > 0 ? sp.cx : -sp.cx) + rx * Math.sin(th);
          const z = sp.cz + rz * Math.cos(th);
          return { x, y: lp.y, z, u: c / nTheta, v: ry / (liningProfile.length - 1) };
        },
        true
      );
      parts.push({ geometry: shaftLiningGrid, materialIndex: 2 });

      // Closed dark shaft floor cap at yInnerBot so looking down into the boot never shows empty space.
      const spBot = sampleShaftAtY(yInnerBot);
      const botFloorGrid = buildGridPart(
        1,
        nTheta,
        (r, c) => {
          const th = -Math.PI + (c / nTheta) * Math.PI * 2;
          const cx = side > 0 ? spBot.cx : -spBot.cx;
          const rx = Math.max(0.016, spBot.rx + shaftOff - (wallThick + 0.0015));
          const rz = Math.max(0.018, spBot.rz + shaftOff - (wallThick + 0.0015));
          const x = r === 0 ? cx : cx + rx * Math.sin(th);
          const z = r === 0 ? spBot.cz : spBot.cz + rz * Math.cos(th);
          return { x, y: yInnerBot, z, u: 0.5, v: 0.5 };
        },
        false
      );
      parts.push({ geometry: botFloorGrid, materialIndex: 2 });
    }
  } else {
    // Open-collar shoe (sneaker / loafer / flat / heel):
    // Around heel counter r = 0..rAnkleSplit, outer wall rises from welt edge (soleTopY) to collarRimY,
    // and meets foreGrid seamlessly at r = rAnkleSplit!
    for (const qSign of [-1, 1]) {
      const qGrid = buildGridPart(
        rAnkleSplit,
        sideSplitIdx,
        (r, cs) => {
          const st = stations[r];
          const hw = st.hw + upperPad;
          const { topY: soleTopY } = computeSoleProfile(st.z);
          const archHeight = computeCollarAndDorsalY(st.z, 1 - cs / sideSplitIdx) - soleTopY;

          const fracFromBack = r / Math.max(1, rAnkleSplit);
          const openRing = Math.sin(fracFromBack * Math.PI);
          const innerCollarHW = hw * (kind === 'sneaker' ? 0.62 : 0.72);
          const rimTargetX = st.cx + qSign * innerCollarHW;

          const tWall = cs / sideSplitIdx; // 0 = sole welt edge -> 1 = top collar rim
          const uFrac = qSign < 0 ? lerp(0, 0.5, tWall) : lerp(1, 0.5, tWall);
          const theta = uFrac * Math.PI;
          const cosT = cosTVal(theta);
          const archX = st.cx - Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.72) * hw;

          const x = lerp(archX, lerp(st.cx + qSign * hw, rimTargetX, tWall), openRing * smoothstep(0.35, 1.0, tWall));
          const wallElev = Math.pow(Math.max(0, Math.sin(theta)), 0.78);
          const y = soleTopY + wallElev * Math.max(0.015, archHeight);
          const bulge = r === 0 ? -0.004 : r === 1 ? -0.001 : 0;
          const z = st.z + bulge * Math.sin(tWall * Math.PI * 0.75);
          const rimArchU = qSign < 0 ? 0.19 : 0.81;
          const archUEnd = lerp(0.5, rimArchU, openRing);
          const archU = qSign < 0 ? lerp(0, archUEnd, tWall) : lerp(1, archUEnd, tWall);
          const [u, v] = evalUpperUV(x, y, z, archU, wallElev);
          return { x, y, z, u, v };
        },
        qSign > 0
      );
      parts.push({ geometry: qGrid, materialIndex: 0 });
    }

    // --- PART 3: COLLAR INTERIOR & TONGUE LINING (GROUP 2) ---
    // Keeps Group 2 strictly BEHIND z = ankleZ - 0.004 so the front tongue face (Group 0)
    // and "NIKE AIR ZOOM" branding are NEVER clipped or occluded.
    const nRing = 20;
    const cavityBackZ = Math.max(heelZ + 0.016, stations[2].z);
    const cavityFrontZ = ankleZ - 0.004;
    const cavityMidZ = lerp(cavityBackZ, cavityFrontZ, 0.5);
    const cavityHalfZ = Math.max(0.010, (cavityFrontZ - cavityBackZ) * 0.5);

    const getCollarPoint = (tAng, yFrac) => {
      const zLocal = cavityMidZ - Math.cos(tAng) * cavityHalfZ;
      const stIdx = clamp(
        Math.round(((zLocal - zStart) / Math.max(1e-4, zEnd - zStart)) * nSlices),
        1,
        rAnkleSplit - 1
      );
      const st = stations[stIdx];
      const hw = st.hw + upperPad;
      const { topY: soleTop } = computeSoleProfile(zLocal);
      const outerRimY = computeCollarAndDorsalY(zLocal, 0.2);
      const insoleY = soleTop + 0.0045;

      const rxOuter = hw * (kind === 'sneaker' ? 0.62 : 0.72);
      const rxInner = hw * (kind === 'sneaker' ? 0.50 : 0.64);
      const rx = lerp(rxInner, rxOuter, yFrac);
      const zInset = lerp(0.004, 0, yFrac);
      const zAdj = cavityMidZ - Math.cos(tAng) * Math.max(0.006, cavityHalfZ - zInset);

      return {
        x: st.cx + Math.sin(tAng) * rx,
        y: lerp(insoleY, outerRimY - 0.001, yFrac),
        z: zAdj,
      };
    };

    const stMid = stations[Math.max(2, Math.floor(rAnkleSplit * 0.5))];
    if (standalone) {
      const collarWall = buildGridPart(
        3,
        nRing,
        (ry, c) => {
          const tAng = (c / nRing) * Math.PI * 2;
          const yFrac = 1 - ry / 3;
          const pt = getCollarPoint(tAng, yFrac);
          return { x: pt.x, y: pt.y, z: pt.z, u: c / nRing, v: yFrac };
        },
        false
      );
      parts.push({ geometry: collarWall, materialIndex: 2 });

      const insoleCenter = { x: stMid.cx, y: computeSoleProfile(cavityMidZ).topY + 0.0045, z: cavityMidZ };
      const insoleCap = buildGridPart(
        1,
        nRing,
        (rc, c) => {
          if (rc === 0) {
            const pt = getCollarPoint((c / nRing) * Math.PI * 2, 0);
            return { ...pt, u: 0.5, v: 0.5 };
          }
          return { ...insoleCenter, u: 0.5, v: 0.5 };
        },
        false
      );
      parts.push({ geometry: insoleCap, materialIndex: 2 });
    } else {
      // Shallow sockliner collar closure around avatar ankle to prevent seeing through collar gap.
      const socklinerY = sideCollarY - 0.012;
      const socklinerCenter = { x: stMid.cx, y: socklinerY, z: cavityMidZ };
      const socklinerCap = buildGridPart(
        1,
        nRing,
        (rc, c) => {
          if (rc === 0) {
            const pt = getCollarPoint((c / nRing) * Math.PI * 2, 0.72);
            return { x: pt.x, y: socklinerY, z: pt.z, u: 0.5, v: 0.5 };
          }
          return { ...socklinerCenter, u: 0.5, v: 0.5 };
        },
        false
      );
      parts.push({ geometry: socklinerCap, materialIndex: 2 });
    }
  }

  return parts;
}

function cosTVal(theta) {
  return Math.cos(theta);
}

/**
 * Generates open sandal footwear (footbed + wedge/heel + forefoot/ankle/T straps).
 */
function buildSandalForSide(side, anatomy, spec, layout) {
  const heelExtra = clamp(spec?.heelHeight || 0, 0, 0.14);
  const baseSoleH = Math.max(0.009, spec?.soleThickness || 0.011);
  const yWelt = Math.min(-0.007, (anatomy.soleBottomY || -0.0061) - 0.002);
  const { stations, zStart, zEnd } = sampleProfileStations(anatomy, side, 28, 0.004, 0.004);
  const upperPad = 0.003;
  const frame = {
    z0: zStart,
    z1: zEnd,
    xMin: Math.min(...stations.map((s) => s.cx - s.hw - upperPad)),
    xMax: Math.max(...stations.map((s) => s.cx + s.hw + upperPad)),
    yMin: yWelt - baseSoleH,
    yMax: anatomy.ankleY + 0.02,
    ankleZ: anatomy.ankleZ,
  };

  const parts = [];
  const nCols = 8;

  // Group 1 contoured sandal footbed & sole (separate heel pillar comes from createHeelGeometry).
  const footbed = buildGridPart(
    28,
    nCols,
    (r, c) => {
      const st = stations[r];
      const hw = st.hw + upperPad;
      const tBack = smoothstep(anatomy.heelZ + 0.04, anatomy.ballZ, st.z);
      const wedgeLift = spec?.sandalStyle === 'wedge' || spec?.isPlatform ? heelExtra * (1 - tBack * 0.75) : 0;
      const botY = yWelt - baseSoleH;
      const topY = yWelt + wedgeLift * 0.25;
      let x = st.cx;
      let y = topY;
      if (c === 0) { x = st.cx - hw; y = topY; }
      else if (c === 1) { x = st.cx - hw * 1.04; y = botY; }
      else if (c === 2) { x = st.cx - hw * 0.5; y = botY; }
      else if (c === 3) { x = st.cx; y = botY; }
      else if (c === 4) { x = st.cx + hw * 0.5; y = botY; }
      else if (c === 5) { x = st.cx + hw * 1.04; y = botY; }
      else if (c === 6) { x = st.cx + hw; y = topY; }
      else if (c === 7) { x = st.cx; y = topY; }
      else { x = st.cx - hw; y = topY; }
      return { x, y, z: st.z, u: c / nCols, v: r / 28 };
    },
    true
  );
  parts.push({ geometry: footbed, materialIndex: 1 });

  // Group 0 Forefoot toe strap band
  const addStrap = (zA, zB, liftAboveFoot = 0.004) => {
    const strapSt = stations.filter((s) => s.z >= zA && s.z <= zB);
    const targetSt = strapSt.length >= 2 ? strapSt : [stations[18], stations[22]];
    const gStrap = buildGridPart(targetSt.length - 1, 10, (r, c) => {
      const st = targetSt[r];
      const hw = st.hw + 0.004;
      const th = (c / 10) * Math.PI;
      const x = st.cx - Math.cos(th) * hw;
      const topY = Math.min(yWelt + 0.045, st.rawTop + liftAboveFoot);
      const y = yWelt + Math.sin(th) * Math.max(0.012, topY - yWelt);
      const [u, v] = shoeUVAnatomical(side, x, y, st.z, frame, layout);
      return { x, y, z: st.z, u, v };
    });
    parts.push({ geometry: gStrap, materialIndex: 0 });
  };

  addStrap(anatomy.ballZ - 0.015, anatomy.ballZ + 0.032, 0.005);
  if (layout?.tstrap || layout?.hasHeelCup) {
    addStrap(anatomy.ankleZ - 0.005, anatomy.ankleZ + 0.025, 0.006);
  }

  return parts;
}

/**
 * Creates multi-zone, photo-faithful 3D footwear geometry separated cleanly into:
 * - Group 0: Upper shell & tongue (photo-textured with shoeUVAnatomical)
 * - Group 1: Contoured midsole/outsole foxing & heel block (clean rubber color, zero barcode streaks)
 * - Group 2: Padded interior collar liner & insole (standalone sneaker/open-shoe studio mode)
 */
export function createRealisticFootwearGeometry({
  isMale = false,
  spec = {},
  layout = null,
  standalone = false,
} = {}) {
  const anatomy = getFootAnatomy(isMale);
  const kind = spec?.kind || 'sneaker';
  const safeLayout = layout || {
    mode: 'top',
    toeLeft: true,
    toeUp: false,
    isFrontThreeQuarter: false,
    boxes: null,
    box: null,
    soleColor: '#e2e4e8',
    liningColor: '#1c1f26',
  };

  const parts = [];
  for (const side of [-1, 1]) {
    const sideParts =
      kind === 'sandal'
        ? buildSandalForSide(side, anatomy, spec, safeLayout)
        : buildClosedShoeForSide(side, anatomy, spec, safeLayout, standalone);
    parts.push(...sideParts);
  }

  return mergeGeometryParts(parts);
}
