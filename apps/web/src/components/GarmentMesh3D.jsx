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

// ─── Parametric Anatomical Geometry Builders ───

/**
 * Creates an anatomical torso shell conforming faithfully to chest, waist, and hip contours.
 */
export function createAnatomicalTorsoGeometry({
  isMale = false,
  yTop = 1.38,
  yBottom = 0.96,
  layerOffset = 0.010,
  flareBottom = false,
  ny = 18,
  nx = 28,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= ny; i++) {
    const v = i / ny;
    const y = yTop - v * (yTop - yBottom);
    const slice = getTorsoSlice(y, isMale);

    let rx = slice.rx + layerOffset;
    let rz = slice.rz + layerOffset;
    const cz = slice.cz;

    // A-line flare for dresses and coats below hips
    if (flareBottom && v > 0.4) {
      const flareRatio = Math.pow((v - 0.4) / 0.6, 1.4);
      rx += flareRatio * 0.11;
      rz += flareRatio * 0.09;
    }

    for (let j = 0; j <= nx; j++) {
      const u = j / nx;
      // Front is centered around theta = 0 facing +Z
      const theta = -Math.PI + u * 2 * Math.PI;
      const x = rx * Math.sin(theta);
      const z = cz + rz * Math.cos(theta);
      verts.push(x, y, z);

      // Centered UV mapping: front hemisphere maps [0, 1]
      const isFront = Math.cos(theta) >= 0;
      let uTex = (Math.sin(theta) + 1) * 0.5;
      if (!isFront) {
        // Back mirrored symmetrically for seamless appearance
        uTex = 1 - uTex;
      }
      uvs.push(Math.max(0, Math.min(1, uTex)), 1 - v);
    }
  }

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
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
  layerOffset = 0.010,
  nyTorso = 8,
  nyLeg = 14,
  nx = 24,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const actualHem = isShorts
    ? (isMale ? 0.68 : 0.62)
    : Math.max(0.08, yHem);

  if (isSkirt) {
    // Flared cone/tube skirt from waist to hem
    const ny = 18;
    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yWaist - v * (yWaist - actualHem);
      const slice = getTorsoSlice(Math.max(yCrotch, y), isMale);

      const flare = Math.pow(v, 1.25) * 0.14;
      const rx = slice.rx + layerOffset + flare;
      const rz = slice.rz + layerOffset + flare * 0.8;
      const cz = slice.cz;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const z = cz + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        let uTex = (Math.sin(theta) + 1) * 0.5;
        if (!isFront) uTex = 1 - uTex;
        uvs.push(Math.max(0, Math.min(1, uTex)), 1 - v);
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  } else {
    // Two-part pants/shorts: Upper Pelvis waistband shell + Split Left & Right Legs

    // 1. Pelvis waistband (from yWaist down to yCrotch)
    for (let i = 0; i <= nyTorso; i++) {
      const v = i / nyTorso;
      const y = yWaist - v * (yWaist - yCrotch);
      const slice = getTorsoSlice(y, isMale);
      const rx = slice.rx + layerOffset;
      const rz = slice.rz + layerOffset;
      const cz = slice.cz;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const z = cz + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        let uTex = (Math.sin(theta) + 1) * 0.5;
        if (!isFront) uTex = 1 - uTex;
        const vTex = (yWaist - y) / (yWaist - actualHem);
        uvs.push(Math.max(0, Math.min(1, uTex)), 1 - vTex);
      }
    }

    for (let i = 0; i < nyTorso; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    // 2. Left & Right Leg Shells (widening naturally from crotch to ankle)
    const legSigns = [-1, 1]; // Left (-X), Right (+X)
    const nxLeg = 14;

    legSigns.forEach((sideSign, legIdx) => {
      const legStartIdx = verts.length / 3;

      for (let i = 0; i <= nyLeg; i++) {
        const v = i / nyLeg;
        const y = yCrotch - v * (yCrotch - actualHem);
        const legSlice = getLegSlice(y, isMale);

        const cx = sideSign * legSlice.cx;
        const r = legSlice.r + layerOffset;
        const cz = legSlice.cz;

        for (let j = 0; j <= nxLeg; j++) {
          const u = j / nxLeg;
          const theta = -Math.PI + u * 2 * Math.PI;
          const x = cx + r * Math.sin(theta);
          const z = cz + r * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          let uLeg = (Math.sin(theta) + 1) * 0.5;
          if (!isFront) uLeg = 1 - uLeg;
          const globalU = legIdx === 0 ? uLeg * 0.48 : 0.52 + uLeg * 0.48;
          const vTex = (yWaist - y) / (yWaist - actualHem);
          uvs.push(Math.max(0, Math.min(1, globalU)), 1 - vTex);
        }
      }

      for (let i = 0; i < nyLeg; i++) {
        for (let j = 0; j < nxLeg; j++) {
          const a = legStartIdx + i * (nxLeg + 1) + j;
          const b = a + 1;
          const c = a + (nxLeg + 1);
          const d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
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
  yTop = 0.088,
  ySole = 0.005,
  layerOffset = 0.008,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  // Exact anatomical stance positions for feet
  const footCenterX = isMale ? 0.148 : 0.168;
  const footSides = [-footCenterX, footCenterX];
  const ny = 6;
  const nx = 14;

  footSides.forEach((cx, idx) => {
    const startIdx = verts.length / 3;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yTop - v * (yTop - ySole);
      // Foot widens toward the ground and extends forward
      const rx = (isMale ? 0.052 : 0.046) + v * 0.012 + layerOffset;
      const rz = (isMale ? 0.075 : 0.068) + v * 0.062 + layerOffset;
      const zCenter = 0.035 + v * 0.075;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = cx + rx * Math.sin(theta);
        const z = zCenter + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        let uFoot = (Math.sin(theta) + 1) * 0.5;
        if (!isFront) uFoot = 1 - uFoot;
        const globalU = idx === 0 ? uFoot * 0.48 : 0.52 + uFoot * 0.48;
        uvs.push(Math.max(0, Math.min(1, globalU)), 1 - v);
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = startIdx + i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
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
export function createAnatomicalAccessoryGeometry(type, { isMale = false } = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const baseHeadY = isMale ? 1.70 : 1.62;

  if (type === 'headwear') {
    // Dome cap / hat crown
    const ny = 8;
    const nx = 18;
    const yCrown = baseHeadY + 0.10;
    const yBrim = baseHeadY - 0.02;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yCrown - v * (yCrown - yBrim);
      const r = Math.sin(v * (Math.PI / 2)) * 0.112;

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
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  } else if (type === 'glasses') {
    // Curved eyewear bridge and frame resting at eye level
    const yEyes = isMale ? 1.66 : 1.57;
    const zEyes = 0.128;
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
    // Ring around natural waist
    const yWaist = isMale ? 1.10 : 1.05;
    const h = 0.040;
    const ny = 2;
    const nx = 22;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = (yWaist + h / 2) - v * h;
      const rx = (isMale ? 0.174 : 0.166);
      const rz = (isMale ? 0.114 : 0.104);

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
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  } else if (type === 'bag') {
    // Shoulder/crossbody or handbag suspended at side hip
    const yHip = isMale ? 0.92 : 0.84;
    const bagW = 0.12;
    const bagH = 0.15;
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
    // Generic accessory quad (scarf / watch / necklace / gloves)
    const yCenter = (type === 'scarf' || type === 'necklace')
      ? (isMale ? 1.44 : 1.37)
      : (type === 'watch' || type === 'gloves')
      ? (isMale ? 0.98 : 0.92)
      : 1.20;

    const w = 0.08;
    const h = 0.08;
    const zPos = 0.14;
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

// ─── Custom Garment Texture Hook ───
function useGarmentTexture(url) {
  const [texture, setTexture] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setTexture(null);
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

  return { texture, error };
}

/**
 * GarmentMesh3D
 * 
 * Renders an active outfit piece in the 3D Try-On Dressing Room with authentic 3D depth,
 * anatomical body-contoured drape, contact shadows, and physical studio materials.
 */
export default function GarmentMesh3D({
  garment,
  slot,
  isMale = false,
  visible = true,
  hasOuterwear = false,
}) {
  const { texture } = useGarmentTexture(garment?.url);

  const rawSlot = String(slot || garment?.category || garment?.slot || '').toLowerCase();
  const garmentText = `${garment?.sub_category || ''} ${garment?.item_type || ''} ${garment?.name || ''} ${garment?.category || ''}`.toLowerCase();

  // Build the appropriate 3D geometry matching this slot and garment type
  const geometry = useMemo(() => {
    if (!visible) return null;

    // 1. TOP
    if (rawSlot === 'top' || rawSlot === 'upper' || rawSlot === 'shirt') {
      const isCrop = garmentText.includes('crop') || garmentText.includes('sports_bra') || garmentText.includes('bralette') || garmentText.includes('קרופ') || garmentText.includes('חזיה');
      const isLongline = garmentText.includes('kurta') || garmentText.includes('tunic') || garmentText.includes('longline') || garmentText.includes('thobe') || garmentText.includes('טוניקה');

      const yTop = isMale ? 1.46 : 1.38;
      let yBottom = isMale ? 1.02 : 0.96;
      if (isCrop) yBottom = isMale ? 1.20 : 1.14;
      if (isLongline) yBottom = isMale ? 0.80 : 0.74;

      const layerOffset = hasOuterwear ? 0.008 : 0.012;

      return createAnatomicalTorsoGeometry({
        isMale,
        yTop,
        yBottom,
        layerOffset,
        flareBottom: isLongline,
      });
    }

    // 2. OUTERWEAR
    if (rawSlot === 'outerwear' || rawSlot === 'jacket' || rawSlot === 'coat') {
      const isLongCoat = garmentText.includes('overcoat') || garmentText.includes('trench') || garmentText.includes('duster') || garmentText.includes('מעיל ארוך');
      const isCropJacket = garmentText.includes('bolero') || garmentText.includes('shrug') || garmentText.includes('עליונית קצרה') || (garmentText.includes('jacket') && garmentText.includes('crop'));

      const yTop = isMale ? 1.47 : 1.39;
      let yBottom = isMale ? 0.94 : 0.88;
      if (isLongCoat) yBottom = isMale ? 0.54 : 0.48;
      if (isCropJacket) yBottom = isMale ? 1.15 : 1.08;

      // Layered cleanly outside tops with 2.4 - 2.6cm clearance
      const layerOffset = isMale ? 0.026 : 0.024;

      return createAnatomicalTorsoGeometry({
        isMale,
        yTop,
        yBottom,
        layerOffset,
        flareBottom: isLongCoat,
      });
    }

    // 3. DRESS
    if (rawSlot === 'dress' || rawSlot === 'full_body' || rawSlot === 'one_piece') {
      const isMini = garmentText.includes('mini') || garmentText.includes('קצרה');
      const isMaxi = garmentText.includes('maxi') || garmentText.includes('gown') || garmentText.includes('evening') || garmentText.includes('ארוכה') || garmentText.includes('מקסי');

      const yTop = isMale ? 1.46 : 1.38;
      let yBottom = isMale ? 0.58 : 0.52; // Default midi
      if (isMini) yBottom = isMale ? 0.82 : 0.76;
      if (isMaxi) yBottom = isMale ? 0.16 : 0.12;

      return createAnatomicalTorsoGeometry({
        isMale,
        yTop,
        yBottom,
        layerOffset: 0.012,
        flareBottom: true,
      });
    }

    // 4. BOTTOM
    if (rawSlot === 'bottom' || rawSlot === 'pants' || rawSlot === 'trousers' || rawSlot === 'skirt' || rawSlot === 'lower') {
      const isSkirt = garmentText.includes('skirt') || garmentText.includes('חצאית') || garmentText.includes('falda') || garmentText.includes('jupe');
      const isShorts = garmentText.includes('short') || garmentText.includes('trunk') || garmentText.includes('boxer') || garmentText.includes('קצרים') || garmentText.includes('ברמודה');
      const isMaxiSkirt = isSkirt && (garmentText.includes('maxi') || garmentText.includes('long') || garmentText.includes('מקסי'));
      const isMiniSkirt = isSkirt && (garmentText.includes('mini') || garmentText.includes('מיני'));

      const yWaist = isMale ? 1.10 : 1.05;
      const yCrotch = isMale ? 0.85 : 0.80;
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
        layerOffset: 0.011,
      });
    }

    // 5. SHOES
    if (rawSlot === 'shoes' || rawSlot === 'footwear' || rawSlot === 'shoe') {
      return createAnatomicalFootwearGeometry({
        isMale,
        yTop: isMale ? 0.092 : 0.088,
        ySole: 0.005,
        layerOffset: 0.008,
      });
    }

    // 6. ACCESSORIES
    return createAnatomicalAccessoryGeometry(rawSlot, { isMale });
  }, [visible, rawSlot, garmentText, isMale, hasOuterwear]);

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
