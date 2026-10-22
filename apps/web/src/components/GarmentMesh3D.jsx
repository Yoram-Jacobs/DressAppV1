import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';

// ─── Anatomical Profiles Extracted from Avatar 3D Meshes (Metric Coordinates) ───

export const TORSO_PROFILE_FEMALE = [
  { y: 1.44, rx: 0.180, cz: 0.015, rz: 0.075 }, // Neck base
  { y: 1.38, rx: 0.200, cz: 0.020, rz: 0.080 }, // Shoulders
  { y: 1.28, rx: 0.210, cz: 0.045, rz: 0.098 }, // Upper chest
  { y: 1.22, rx: 0.205, cz: 0.057, rz: 0.108 }, // Bust peak (front Z reaches +0.165)
  { y: 1.14, rx: 0.175, cz: 0.056, rz: 0.102 }, // Under-bust
  { y: 1.05, rx: 0.162, cz: 0.055, rz: 0.100 }, // Natural waist
  { y: 0.90, rx: 0.185, cz: 0.035, rz: 0.105 }, // Upper hips
  { y: 0.80, rx: 0.190, cz: 0.029, rz: 0.111 }, // Lower hips / crotch
  { y: 0.65, rx: 0.205, cz: 0.025, rz: 0.115 }, // Upper thigh flare (for skirts/dresses)
];

export const TORSO_PROFILE_MALE = [
  { y: 1.50, rx: 0.200, cz: 0.010, rz: 0.090 }, // Neck base
  { y: 1.46, rx: 0.235, cz: 0.010, rz: 0.108 }, // Shoulders
  { y: 1.36, rx: 0.250, cz: 0.020, rz: 0.130 }, // Upper chest
  { y: 1.30, rx: 0.245, cz: 0.028, rz: 0.146 }, // Pecs peak (front Z reaches +0.174)
  { y: 1.20, rx: 0.195, cz: 0.038, rz: 0.125 }, // Rib cage
  { y: 1.10, rx: 0.170, cz: 0.045, rz: 0.110 }, // Waist
  { y: 0.95, rx: 0.190, cz: 0.042, rz: 0.112 }, // Upper hips
  { y: 0.85, rx: 0.195, cz: 0.039, rz: 0.121 }, // Crotch
  { y: 0.70, rx: 0.205, cz: 0.030, rz: 0.125 }, // Thigh flare
];

export const LEG_PROFILE_FEMALE = [
  { y: 0.80, cx: 0.105, r: 0.088, cz: 0.029 }, // Crotch / upper thigh
  { y: 0.65, cx: 0.118, r: 0.076, cz: 0.020 }, // Mid thigh
  { y: 0.46, cx: 0.131, r: 0.063, cz: 0.005 }, // Knee
  { y: 0.25, cx: 0.148, r: 0.058, cz: 0.000 }, // Calf
  { y: 0.08, cx: 0.166, r: 0.044, cz: 0.000 }, // Ankle
];

export const LEG_PROFILE_MALE = [
  { y: 0.85, cx: 0.102, r: 0.092, cz: 0.039 }, // Crotch
  { y: 0.70, cx: 0.115, r: 0.080, cz: 0.025 }, // Mid thigh
  { y: 0.50, cx: 0.127, r: 0.068, cz: 0.008 }, // Knee
  { y: 0.28, cx: 0.136, r: 0.062, cz: 0.002 }, // Calf
  { y: 0.09, cx: 0.143, r: 0.048, cz: 0.000 }, // Ankle
];

/**
 * Piecewise linear interpolation across anatomical depth & contour profiles.
 */
function interpolateProfile(profile, y) {
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

export function getTorsoSlice(y, isMale) {
  const profile = isMale ? TORSO_PROFILE_MALE : TORSO_PROFILE_FEMALE;
  return interpolateProfile(profile, y);
}

export function getLegSlice(y, isMale) {
  const profile = isMale ? LEG_PROFILE_MALE : LEG_PROFILE_FEMALE;
  return interpolateProfile(profile, y);
}

/**
 * Normalizes multi-lingual category / role strings into canonical slots.
 */
export function normalizeGarmentRole(role, category, title) {
  const text = (String(role || '') + ' ' + String(category || '') + ' ' + String(title || '')).toLowerCase().trim();
  if (/(?:outerwear|jacket|coat|blazer|parka|מעיל|ז['’]קט|ג['’]קט|בלייזר|עליונית|vest|overcoat)/i.test(text)) return 'outerwear';
  if (/(?:dress|gown|jumpsuit|romper|overall|שמלה|שמלת|אוברול|סרבל|חלוק|גלבייה)/i.test(text)) return 'dress';
  if (/(?:bottom|pants|jeans|trousers|shorts?|skirt|מכנסיים|מכנס|חצאית|ג['’]ינס|שורטס|טייץ)/i.test(text)) return 'bottom';
  if (/(?:top|shirt|blouse|sweater|hoodie|tee|t-shirt|polo|חולצה|חולצת|סוודר|גופייה|גופיה|סווטשירט)/i.test(text)) return 'top';
  if (/(?:shoes?|footwear|sneakers?|boots?|sandals?|loafers?|נעליים|נעלי|מגפיים|סנדלים|מוקסינים)/i.test(text)) return 'shoes';
  if (/(?:hat|cap|headwear|beanie|כובע|כיפה|ברט)/i.test(text)) return 'headwear';
  if (/(?:glasses|sunglasses|משקפיים|משקפי)/i.test(text)) return 'glasses';
  if (/(?:belt|חגורה)/i.test(text)) return 'belt';
  if (/(?:bag|purse|tote|backpack|תיק|ארנק)/i.test(text)) return 'bag';
  return 'accessory';
}

/**
 * Extracts non-transparent bounding box from image so UV coordinates anchor exactly
 * to the actual garment fabric, eliminating empty margin offsets.
 */
export function extractImageAlphaBounds(img) {
  if (!img || typeof document === 'undefined') {
    return { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true };
  }
  try {
    const canvas = document.createElement('canvas');
    const w = Math.min(160, img.naturalWidth || img.width || 160);
    const h = Math.min(160, img.naturalHeight || img.height || 160);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true };
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = imgData[(y * w + x) * 4 + 3];
        if (a > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) {
      return { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true };
    }
    const uMin = Math.max(0, minX / w);
    const uMax = Math.min(1, maxX / w);
    const vMin = Math.max(0, minY / h);
    const vMax = Math.min(1, maxY / h);
    const aspect = (uMax - uMin) / Math.max(0.1, vMax - vMin);
    const hasSleeves = aspect > 0.86;
    return { uMin, uMax, vMin, vMax, hasSleeves };
  } catch {
    return { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true };
  }
}

// ─── 3D Parametric Body-Wrapping Geometry Builders ───

/**
 * Creates 3D Top or Outerwear geometry with anatomically contoured torso shell
 * AND left/right sleeve shells that wrap around the avatar's arms in 3D.
 */
export function createAnatomicalTopGeometry({
  isMale = false,
  hasSleeves = true,
  yTop = 1.42,
  yBottom = 0.88,
  bounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
  layerOffset = 0.015,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const uMin = bounds?.uMin ?? 0;
  const uMax = bounds?.uMax ?? 1;
  const vMin = bounds?.vMin ?? 0;
  const vMax = bounds?.vMax ?? 1;
  const uSpan = Math.max(0.1, uMax - uMin);
  const vSpan = Math.max(0.1, vMax - vMin);

  // Split texture into sleeves (outer ~22% on left/right) and torso (central ~56%)
  const uTorsoMin = hasSleeves ? uMin + 0.22 * uSpan : uMin;
  const uTorsoMax = hasSleeves ? uMax - 0.22 * uSpan : uMax;

  // 1. Torso Shell (wrapping 360° around chest, waist, and hips)
  const ny = 16;
  const nx = 26;
  for (let i = 0; i <= ny; i++) {
    const vNorm = i / ny;
    const y = yTop - vNorm * (yTop - yBottom);
    const slice = getTorsoSlice(y, isMale);

    const rx = slice.rx + layerOffset;
    const rz = slice.rz + layerOffset;
    const cz = slice.cz;
    const vTex = 1 - (vMin + vNorm * vSpan);

    for (let j = 0; j <= nx; j++) {
      const uFrac = j / nx;
      const theta = -Math.PI + uFrac * 2 * Math.PI;
      const x = rx * Math.sin(theta);
      const z = cz + rz * Math.cos(theta);
      verts.push(x, y, z);

      const isFront = Math.cos(theta) >= 0;
      const uT = isFront
        ? uTorsoMin + ((Math.sin(theta) + 1) * 0.5) * (uTorsoMax - uTorsoMin)
        : uTorsoMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * (uTorsoMax - uTorsoMin);
      uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
    }
  }

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2. Left & Right Sleeves (following avatar's A-pose arm trajectory in 3D)
  if (hasSleeves) {
    const sides = [-1, 1]; // Left (-X), Right (+X)
    const nySleeve = 10;
    const nxSleeve = 14;

    sides.forEach((side) => {
      const startIdx = verts.length / 3;
      const uSleeveMin = side === -1 ? uMin : uTorsoMax;
      const uSleeveMax = side === -1 ? uTorsoMin : uMax;

      for (let i = 0; i <= nySleeve; i++) {
        const t = i / nySleeve;
        const yArm = (yTop - 0.04) - t * ((yTop - 0.04) - yBottom);
        const xArm = side * (0.18 + t * (0.25 - 0.18));
        const zArm = 0.02 + t * (0.05 - 0.02);
        const rArm = (0.048 - t * (0.048 - 0.035)) + layerOffset;
        const vTex = 1 - (vMin + t * vSpan);

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rArm * Math.sin(theta);
          const y = yArm;
          const z = zArm + rArm * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          const uT = isFront
            ? uSleeveMin + ((Math.sin(theta) + 1) * 0.5) * (uSleeveMax - uSleeveMin)
            : uSleeveMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * (uSleeveMax - uSleeveMin);
          uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
        }
      }

      for (let i = 0; i < nySleeve; i++) {
        for (let j = 0; j < nxSleeve; j++) {
          const a = startIdx + i * (nxSleeve + 1) + j;
          const b = a + 1;
          const c = a + (nxSleeve + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    });
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Backward compatibility alias for createAnatomicalTopGeometry.
 */
export const createAnatomicalTorsoGeometry = (opts) => createAnatomicalTopGeometry(opts);

/**
 * Creates 3D Dress geometry combining a contoured bodice (with optional sleeves)
 * and a flared lower skirt shell that wraps around the avatar's body in 3D.
 */
export function createAnatomicalDressGeometry({
  isMale = false,
  hasSleeves = false,
  yTop = 1.42,
  yBottom = 0.48,
  bounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
  layerOffset = 0.014,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const uMin = bounds?.uMin ?? 0;
  const uMax = bounds?.uMax ?? 1;
  const vMin = bounds?.vMin ?? 0;
  const vMax = bounds?.vMax ?? 1;
  const uSpan = Math.max(0.1, uMax - uMin);
  const vSpan = Math.max(0.1, vMax - vMin);

  const uTorsoMin = hasSleeves ? uMin + 0.20 * uSpan : uMin;
  const uTorsoMax = hasSleeves ? uMax - 0.20 * uSpan : uMax;

  // 1. Bodice & Flared Skirt Tube
  const ny = 22;
  const nx = 28;
  for (let i = 0; i <= ny; i++) {
    const vNorm = i / ny;
    const y = yTop - vNorm * (yTop - yBottom);
    const slice = getTorsoSlice(Math.max(0.80, y), isMale);

    let rx = slice.rx + layerOffset;
    let rz = slice.rz + layerOffset;
    const cz = slice.cz;

    // Flare skirt naturally below hips (y < 0.85)
    if (y < 0.85) {
      const flareRatio = Math.pow((0.85 - y) / (0.85 - yBottom), 1.25);
      rx += flareRatio * 0.12;
      rz += flareRatio * 0.09;
    }

    const vTex = 1 - (vMin + vNorm * vSpan);

    for (let j = 0; j <= nx; j++) {
      const uFrac = j / nx;
      const theta = -Math.PI + uFrac * 2 * Math.PI;
      const x = rx * Math.sin(theta);
      const z = cz + rz * Math.cos(theta);
      verts.push(x, y, z);

      const isFront = Math.cos(theta) >= 0;
      const uT = isFront
        ? uTorsoMin + ((Math.sin(theta) + 1) * 0.5) * (uTorsoMax - uTorsoMin)
        : uTorsoMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * (uTorsoMax - uTorsoMin);
      uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
    }
  }

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2. Dress Sleeves (if dress has sleeves)
  if (hasSleeves) {
    const sides = [-1, 1];
    const nySleeve = 10;
    const nxSleeve = 12;

    sides.forEach((side) => {
      const startIdx = verts.length / 3;
      const uSleeveMin = side === -1 ? uMin : uTorsoMax;
      const uSleeveMax = side === -1 ? uTorsoMin : uMax;

      for (let i = 0; i <= nySleeve; i++) {
        const t = i / nySleeve;
        const yArm = (yTop - 0.04) - t * 0.46;
        const xArm = side * (0.18 + t * (0.24 - 0.18));
        const zArm = 0.02 + t * 0.03;
        const rArm = (0.046 - t * 0.012) + layerOffset;
        const vTex = 1 - (vMin + t * (vSpan * 0.5));

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rArm * Math.sin(theta);
          const y = yArm;
          const z = zArm + rArm * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          const uT = isFront
            ? uSleeveMin + ((Math.sin(theta) + 1) * 0.5) * (uSleeveMax - uSleeveMin)
            : uSleeveMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * (uSleeveMax - uSleeveMin);
          uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
        }
      }

      for (let i = 0; i < nySleeve; i++) {
        for (let j = 0; j < nxSleeve; j++) {
          const a = startIdx + i * (nxSleeve + 1) + j;
          const b = a + 1;
          const c = a + (nxSleeve + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    });
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates anatomical pants, jeans, shorts, or skirts following natural A-stance leg widening.
 */
export function createAnatomicalBottomGeometry({
  isMale = false,
  isSkirt = false,
  isShorts = false,
  yWaist = 1.05,
  yCrotch = 0.80,
  yHem = 0.08,
  bounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
  layerOffset = 0.011,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const uMin = bounds?.uMin ?? 0;
  const uMax = bounds?.uMax ?? 1;
  const vMin = bounds?.vMin ?? 0;
  const vMax = bounds?.vMax ?? 1;
  const uSpan = Math.max(0.1, uMax - uMin);
  const vSpan = Math.max(0.1, vMax - vMin);
  const uMid = uMin + 0.5 * uSpan;

  const actualHem = isShorts
    ? (isMale ? 0.68 : 0.62)
    : Math.max(0.08, yHem);

  if (isSkirt) {
    const ny = 18;
    const nx = 26;
    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yWaist - v * (yWaist - actualHem);
      const slice = getTorsoSlice(Math.max(yCrotch, y), isMale);

      const flare = Math.pow(v, 1.25) * 0.14;
      const rx = slice.rx + layerOffset + flare;
      const rz = slice.rz + layerOffset + flare * 0.8;
      const cz = slice.cz;
      const vTex = 1 - (vMin + v * vSpan);

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const z = cz + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        const uT = isFront
          ? uMin + ((Math.sin(theta) + 1) * 0.5) * uSpan
          : uMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * uSpan;
        uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  } else {
    // 1. Pelvis waistband (from yWaist down to yCrotch)
    const nyTorso = 8;
    const nx = 24;
    for (let i = 0; i <= nyTorso; i++) {
      const v = i / nyTorso;
      const y = yWaist - v * (yWaist - yCrotch);
      const slice = getTorsoSlice(y, isMale);
      const rx = slice.rx + layerOffset;
      const rz = slice.rz + layerOffset;
      const cz = slice.cz;
      const vFrac = (yWaist - y) / (yWaist - actualHem);
      const vTex = 1 - (vMin + vFrac * vSpan);

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const z = cz + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        const uT = isFront
          ? uMin + ((Math.sin(theta) + 1) * 0.5) * uSpan
          : uMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * uSpan;
        uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
      }
    }

    for (let i = 0; i < nyTorso; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    // 2. Left & Right Leg Shells
    const legSigns = [-1, 1]; // Left (-X), Right (+X)
    const nyLeg = 14;
    const nxLeg = 14;

    legSigns.forEach((sideSign, legIdx) => {
      const startIdx = verts.length / 3;
      const uLegMin = legIdx === 0 ? uMin : uMid;
      const uLegMax = legIdx === 0 ? uMid : uMax;

      for (let i = 0; i <= nyLeg; i++) {
        const v = i / nyLeg;
        const y = yCrotch - v * (yCrotch - actualHem);
        const legSlice = getLegSlice(y, isMale);

        const cx = sideSign * legSlice.cx;
        const r = legSlice.r + layerOffset;
        const cz = legSlice.cz;
        const vFrac = (yWaist - y) / (yWaist - actualHem);
        const vTex = 1 - (vMin + vFrac * vSpan);

        for (let j = 0; j <= nxLeg; j++) {
          const u = j / nxLeg;
          const theta = -Math.PI + u * 2 * Math.PI;
          const x = cx + r * Math.sin(theta);
          const z = cz + r * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          const uT = isFront
            ? uLegMin + ((Math.sin(theta) + 1) * 0.5) * (uLegMax - uLegMin)
            : uLegMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * (uLegMax - uLegMin);
          uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
        }
      }

      for (let i = 0; i < nyLeg; i++) {
        for (let j = 0; j < nxLeg; j++) {
          const a = startIdx + i * (nxLeg + 1) + j;
          const b = a + 1;
          const c = a + (nxLeg + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    });
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates 3D footwear geometry mapping directly over avatar feet stance.
 */
export function createAnatomicalFootwearGeometry({
  isMale = false,
  yTop = 0.092,
  ySole = 0.005,
  bounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
  layerOffset = 0.008,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const uMin = bounds?.uMin ?? 0;
  const uMax = bounds?.uMax ?? 1;
  const vMin = bounds?.vMin ?? 0;
  const vMax = bounds?.vMax ?? 1;
  const uSpan = Math.max(0.1, uMax - uMin);
  const vSpan = Math.max(0.1, vMax - vMin);
  const uMid = uMin + 0.5 * uSpan;

  const footCenterX = isMale ? 0.148 : 0.168;
  const footSides = [-footCenterX, footCenterX];
  const ny = 6;
  const nx = 14;

  footSides.forEach((cx, idx) => {
    const startIdx = verts.length / 3;
    const uFootMin = idx === 0 ? uMin : uMid;
    const uFootMax = idx === 0 ? uMid : uMax;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yTop - v * (yTop - ySole);
      const rx = (isMale ? 0.052 : 0.046) + v * 0.012 + layerOffset;
      const rz = (isMale ? 0.075 : 0.068) + v * 0.062 + layerOffset;
      const zCenter = 0.035 + v * 0.075;
      const vTex = 1 - (vMin + v * vSpan);

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = cx + rx * Math.sin(theta);
        const z = zCenter + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        const uT = isFront
          ? uFootMin + ((Math.sin(theta) + 1) * 0.5) * (uFootMax - uFootMin)
          : uFootMin + ((1 - (Math.sin(theta) + 1) * 0.5)) * (uFootMax - uFootMin);
        uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = startIdx + i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  });

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates 3D accessory geometries (headwear, glasses, scarf, belt, bag).
 */
export function createAnatomicalAccessoryGeometry(type, { isMale = false, bounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 } } = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const baseHeadY = isMale ? 1.70 : 1.62;

  if (type === 'headwear') {
    const ny = 8;
    const nx = 18;
    const yCrown = baseHeadY + 0.10;
    const yBrim = baseHeadY - 0.02;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yCrown - v * (yCrown - yBrim);
      const r = Math.sin(v * (Math.PI / 2)) * 0.115;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = r * Math.sin(theta);
        const z = r * Math.cos(theta) + 0.02;
        verts.push(x, y, z);
        uvs.push(u, 1 - v);
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  } else if (type === 'glasses') {
    const yEyes = isMale ? 1.66 : 1.57;
    const zEyes = 0.130;
    const w = 0.075;
    const h = 0.024;

    const quadVerts = [
      -w, yEyes + h, zEyes,
       w, yEyes + h, zEyes,
      -w, yEyes - h, zEyes,
       w, yEyes - h, zEyes,
    ];
    const quadUvs = [
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ];
    indices.push(0, 2, 1, 1, 2, 3);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(quadVerts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(quadUvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  } else if (type === 'belt') {
    const yWaist = isMale ? 1.10 : 1.05;
    const h = 0.040;
    const ny = 2;
    const nx = 22;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = (yWaist + h / 2) - v * h;
      const rx = (isMale ? 0.176 : 0.168);
      const rz = (isMale ? 0.116 : 0.106);

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        verts.push(rx * Math.sin(theta), y, rz * Math.cos(theta) + 0.05);
        uvs.push(u, 1 - v);
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  } else if (type === 'bag') {
    const yHip = isMale ? 0.92 : 0.84;
    const bagW = 0.13;
    const bagH = 0.16;
    const bagX = isMale ? 0.30 : 0.28;
    const bagZ = 0.06;

    const quadVerts = [
      bagX - bagW / 2, yHip + bagH / 2, bagZ,
      bagX + bagW / 2, yHip + bagH / 2, bagZ,
      bagX - bagW / 2, yHip - bagH / 2, bagZ,
      bagX + bagW / 2, yHip - bagH / 2, bagZ,
    ];
    const quadUvs = [
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ];
    indices.push(0, 2, 1, 1, 2, 3);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(quadVerts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(quadUvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  } else {
    const yCenter = (type === 'scarf' || type === 'necklace')
      ? (isMale ? 1.44 : 1.37)
      : (type === 'watch' || type === 'gloves')
      ? (isMale ? 0.98 : 0.92)
      : 1.20;

    const w = 0.09;
    const h = 0.09;
    const zPos = 0.145;
    const xPos = type === 'watch' ? 0.24 : 0;

    const quadVerts = [
      xPos - w, yCenter + h, zPos,
      xPos + w, yCenter + h, zPos,
      xPos - w, yCenter - h, zPos,
      xPos + w, yCenter - h, zPos,
    ];
    const quadUvs = [
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ];
    indices.push(0, 2, 1, 1, 2, 3);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(quadVerts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(quadUvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Custom Garment Texture Hook with Alpha Bounding Box Detection ───
function useGarmentTexture(url) {
  const [texture, setTexture] = useState(null);
  const [bounds, setBounds] = useState({ uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true });
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      setBounds({ uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true });
      setError(false);
      return;
    }

    let isMounted = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      url,
      (tex) => {
        if (!isMounted) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;

        const b = extractImageAlphaBounds(tex.image);
        setBounds(b);
        setTexture(tex);
        setError(false);
      },
      undefined,
      () => {
        if (!isMounted) return;
        setError(true);
        setTexture(null);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { texture, bounds, error };
}

/**
 * GarmentMesh3D
 * 
 * Renders an active outfit piece in the 3D Try-On Dressing Room with authentic 3D depth,
 * anatomical body-contoured drape around chest, shoulders, waist, and sleeves,
 * contact shadows, and physical studio materials.
 */
export default function GarmentMesh3D({
  garment,
  slot,
  isMale = false,
  visible = true,
  hasOuterwear = false,
}) {
  const { texture, bounds } = useGarmentTexture(garment?.url);

  const rawSlot = normalizeGarmentRole(
    slot || garment?.slot,
    garment?.category,
    garment?.name || garment?.title || garment?.sub_category || garment?.item_type
  );
  const garmentText = `${garment?.sub_category || ''} ${garment?.item_type || ''} ${garment?.name || ''} ${garment?.category || ''}`.toLowerCase();

  // Build the appropriate 3D geometry matching this slot and garment type
  const geometry = useMemo(() => {
    if (!visible) return null;

    // 1. TOP
    if (rawSlot === 'top') {
      const isCrop = garmentText.includes('crop') || garmentText.includes('sports_bra') || garmentText.includes('bralette') || garmentText.includes('קרופ') || garmentText.includes('חזיה');
      const isLongline = garmentText.includes('kurta') || garmentText.includes('tunic') || garmentText.includes('longline') || garmentText.includes('thobe') || garmentText.includes('טוניקה');
      const isSleeveless = garmentText.includes('sleeveless') || garmentText.includes('tank') || garmentText.includes('vest') || garmentText.includes('גופיה') || garmentText.includes('גופייה') || garmentText.includes('וסט') || !bounds.hasSleeves;

      const yTop = isMale ? 1.48 : 1.42;
      let yBottom = isMale ? 1.00 : 0.94;
      if (isCrop) yBottom = isMale ? 1.20 : 1.14;
      if (isLongline) yBottom = isMale ? 0.82 : 0.76;

      const layerOffset = hasOuterwear ? 0.008 : 0.012;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: !isSleeveless,
        yTop,
        yBottom,
        bounds,
        layerOffset,
      });
    }

    // 2. OUTERWEAR
    if (rawSlot === 'outerwear') {
      const isLongCoat = garmentText.includes('overcoat') || garmentText.includes('trench') || garmentText.includes('duster') || garmentText.includes('מעיל ארוך');
      const isCropJacket = garmentText.includes('bolero') || garmentText.includes('shrug') || garmentText.includes('עליונית קצרה') || (garmentText.includes('jacket') && garmentText.includes('crop'));
      const isSleeveless = garmentText.includes('vest') || garmentText.includes('waistcoat') || garmentText.includes('וסט') || !bounds.hasSleeves;

      const yTop = isMale ? 1.49 : 1.44;
      let yBottom = isMale ? 0.92 : 0.86;
      if (isLongCoat) yBottom = isMale ? 0.54 : 0.48;
      if (isCropJacket) yBottom = isMale ? 1.15 : 1.08;

      // Layered cleanly outside tops with 2.4 - 2.6cm clearance
      const layerOffset = isMale ? 0.026 : 0.024;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: !isSleeveless,
        yTop,
        yBottom,
        bounds,
        layerOffset,
      });
    }

    // 3. DRESS
    if (rawSlot === 'dress') {
      const isMini = garmentText.includes('mini') || garmentText.includes('קצרה');
      const isMaxi = garmentText.includes('maxi') || garmentText.includes('gown') || garmentText.includes('evening') || garmentText.includes('ארוכה') || garmentText.includes('מקסי');
      const hasSleeves = bounds.hasSleeves && (garmentText.includes('long sleeve') || garmentText.includes('sleeve') || garmentText.includes('שרוול'));

      const yTop = isMale ? 1.48 : 1.42;
      let yBottom = isMale ? 0.54 : 0.48; // Default midi/knee
      if (isMini) yBottom = isMale ? 0.80 : 0.74;
      if (isMaxi) yBottom = isMale ? 0.16 : 0.12;

      return createAnatomicalDressGeometry({
        isMale,
        hasSleeves,
        yTop,
        yBottom,
        bounds,
        layerOffset: 0.014,
      });
    }

    // 4. BOTTOM
    if (rawSlot === 'bottom') {
      const isSkirt = garmentText.includes('skirt') || garmentText.includes('חצאית') || garmentText.includes('falda') || garmentText.includes('jupe');
      const isShorts = garmentText.includes('short') || garmentText.includes('trunk') || garmentText.includes('boxer') || garmentText.includes('קצרים') || garmentText.includes('ברמודה');
      const isMaxiSkirt = isSkirt && (garmentText.includes('maxi') || garmentText.includes('long') || garmentText.includes('מקסי'));
      const isMiniSkirt = isSkirt && (garmentText.includes('mini') || garmentText.includes('מיני'));

      const yWaist = isMale ? 1.10 : 1.05;
      const yCrotch = isMale ? 0.85 : 0.82;
      let yHem = isMale ? 0.09 : 0.08;
      if (isShorts) yHem = isMale ? 0.68 : 0.62;
      if (isMiniSkirt) yHem = isMale ? 0.78 : 0.72;
      if (isMaxiSkirt) yHem = isMale ? 0.16 : 0.12;

      return createAnatomicalBottomGeometry({
        isMale,
        isSkirt,
        isShorts,
        yWaist,
        yCrotch,
        yHem,
        bounds,
        layerOffset: 0.011,
      });
    }

    // 5. SHOES
    if (rawSlot === 'shoes') {
      return createAnatomicalFootwearGeometry({
        isMale,
        yTop: isMale ? 0.092 : 0.088,
        ySole: 0.005,
        bounds,
        layerOffset: 0.008,
      });
    }

    // 6. ACCESSORIES
    return createAnatomicalAccessoryGeometry(rawSlot, { isMale, bounds });
  }, [visible, rawSlot, garmentText, isMale, hasOuterwear, bounds]);

  if (!visible || !garment || !geometry) return null;

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        map={texture || null}
        color={texture ? '#FFFFFF' : '#CBD5E1'}
        transparent={true}
        alphaTest={0.05}
        depthWrite={true}
        side={THREE.DoubleSide}
        roughness={0.62}
        metalness={0.06}
        envMapIntensity={0.8}
      />
    </mesh>
  );
}
