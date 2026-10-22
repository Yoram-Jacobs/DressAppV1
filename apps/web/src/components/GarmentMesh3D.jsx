import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';

// ─── Parametric Curved Shell Builders ───

/**
 * Creates an elliptical curved tube / shell wrapping around the torso.
 */
function createCurvedTorsoGeometry({
  yTop = 1.38,
  yBottom = 0.96,
  rxTop = 0.19,
  rxBottom = 0.145,
  rzTop = 0.12,
  rzBottom = 0.095,
  zOffset = 0.01,
  ny = 16,
  nx = 24,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= ny; i++) {
    const v = i / ny;
    const y = yTop - v * (yTop - yBottom);
    const rx = rxTop * (1 - v) + rxBottom * v;
    const rz = rzTop * (1 - v) + rzBottom * v;

    for (let j = 0; j <= nx; j++) {
      const u = j / nx;
      const theta = -Math.PI + u * 2 * Math.PI;
      const x = rx * Math.sin(theta);
      const z = rz * Math.cos(theta) + zOffset;
      verts.push(x, y, z);

      // Map texture across front (theta in [-pi/2, +pi/2]) and back symmetrically
      const isFront = Math.cos(theta) >= 0;
      let uTex = (x + rx) / Math.max(0.001, 2 * rx);
      if (!isFront) {
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
 * Creates 3D geometry for pants, jeans, shorts, or skirts.
 */
function createCurvedBottomGeometry({
  isSkirt = false,
  isShorts = false,
  yWaist = 1.04,
  yCrotch = 0.82,
  yHem = 0.10,
  rxWaist = 0.16,
  rzWaist = 0.10,
  legCenterX = 0.088,
  zOffset = 0.008,
}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  if (isSkirt) {
    // Flared A-line cone/tube for skirt
    const ny = 16;
    const nx = 24;
    const rxHem = rxWaist * 1.55;
    const rzHem = rzWaist * 1.50;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yWaist - v * (yWaist - yHem);
      const rx = rxWaist * (1 - v) + rxHem * v;
      const rz = rzWaist * (1 - v) + rzHem * v;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const z = rz * Math.cos(theta) + zOffset;
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        let uTex = (x + rx) / Math.max(0.001, 2 * rx);
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
    // Trousers / Jeans / Shorts: Pelvis section + 2 tapered leg cylinders
    const actualHem = isShorts ? Math.max(0.64, yCrotch - 0.18) : yHem;
    const nyPelvis = 6;
    const nxPelvis = 20;

    // 1. Pelvis
    const pelvisStartIdx = verts.length / 3;
    for (let i = 0; i <= nyPelvis; i++) {
      const v = i / nyPelvis;
      const y = yWaist - v * (yWaist - yCrotch);
      const rx = rxWaist * (1 - v * 0.12);
      const rz = rzWaist * (1 - v * 0.05);

      for (let j = 0; j <= nxPelvis; j++) {
        const u = j / nxPelvis;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const z = rz * Math.cos(theta) + zOffset;
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        let uTex = (x + rx) / Math.max(0.001, 2 * rx);
        if (!isFront) uTex = 1 - uTex;
        const vTex = 1 - (v * (yWaist - yCrotch)) / (yWaist - actualHem);
        uvs.push(Math.max(0, Math.min(1, uTex)), vTex);
      }
    }
    for (let i = 0; i < nyPelvis; i++) {
      for (let j = 0; j < nxPelvis; j++) {
        const a = pelvisStartIdx + i * (nxPelvis + 1) + j;
        const b = a + 1;
        const c = a + (nxPelvis + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    // 2. Left and Right Legs
    const nyLeg = 12;
    const nxLeg = 16;
    const legSides = [-legCenterX, legCenterX];

    legSides.forEach((cx, legIdx) => {
      const legStartIdx = verts.length / 3;
      const rTop = 0.082;
      const rBottom = isShorts ? 0.076 : 0.052;

      for (let i = 0; i <= nyLeg; i++) {
        const v = i / nyLeg;
        const y = yCrotch - v * (yCrotch - actualHem);
        const r = rTop * (1 - v) + rBottom * v;

        for (let j = 0; j <= nxLeg; j++) {
          const u = j / nxLeg;
          const theta = -Math.PI + u * 2 * Math.PI;
          const x = cx + r * Math.sin(theta);
          const z = r * Math.cos(theta) + zOffset;
          verts.push(x, y, z);

          // UV mapping mapped across leg span
          const isFront = Math.cos(theta) >= 0;
          let uLeg = (r * Math.sin(theta) + r) / Math.max(0.001, 2 * r);
          if (!isFront) uLeg = 1 - uLeg;
          // Global U between 0 and 1 (left leg 0..0.5, right leg 0.5..1)
          const globalU = legIdx === 0 ? uLeg * 0.48 : 0.52 + uLeg * 0.48;
          const vTex = 1 - (yWaist - y) / (yWaist - actualHem);
          uvs.push(Math.max(0, Math.min(1, globalU)), Math.max(0, Math.min(1, vTex)));
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
 * Creates 3D footwear geometry for left and right feet.
 */
function createFootwearGeometry({ legCenterX = 0.088, yHem = 0.00 }) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const footSides = [-legCenterX, legCenterX];

  footSides.forEach((cx, idx) => {
    const startIdx = verts.length / 3;
    const ny = 6;
    const nx = 12;
    const yTop = yHem + 0.085;
    const ySole = yHem + 0.005;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yTop - v * (yTop - ySole);
      const rx = 0.048 + v * 0.012;
      const rz = 0.065 + v * 0.055;
      const zCenter = 0.04 + v * 0.04;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = cx + rx * Math.sin(theta);
        const z = zCenter + rz * Math.cos(theta);
        verts.push(x, y, z);

        const isFront = Math.cos(theta) >= 0;
        let uFoot = (rx * Math.sin(theta) + rx) / Math.max(0.001, 2 * rx);
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
function createAccessoryGeometry(type, { isMale = false, heightScale = 1.0 }) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const baseHeadY = isMale ? 1.70 * heightScale : 1.62 * heightScale;

  if (type === 'headwear') {
    // Dome cap / hat crown
    const ny = 8;
    const nx = 18;
    const yCrown = baseHeadY + 0.09;
    const yBrim = baseHeadY - 0.02;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yCrown - v * (yCrown - yBrim);
      const r = Math.sin(v * (Math.PI / 2)) * 0.108;

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
    const yEyes = isMale ? 1.67 * heightScale : 1.57 * heightScale;
    const zEyes = 0.126;
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
    // Ring around waist
    const yWaist = isMale ? 1.08 * heightScale : 1.03 * heightScale;
    const h = 0.038;
    const ny = 2;
    const nx = 20;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = (yWaist + h / 2) - v * h;
      const rx = 0.158;
      const rz = 0.104;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        verts.push(rx * Math.sin(theta), y, rz * Math.cos(theta) + 0.01);
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
    const yHip = isMale ? 0.90 * heightScale : 0.82 * heightScale;
    const bagW = 0.11;
    const bagH = 0.14;
    const bagX = 0.28;
    const bagZ = 0.05;

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
      ? (isMale ? 1.45 : 1.38) * heightScale
      : (type === 'watch' || type === 'gloves')
      ? (isMale ? 0.98 : 0.92) * heightScale
      : 1.20 * heightScale;

    const w = 0.08;
    const h = 0.08;
    const zPos = 0.13;
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
 * curved drape curvature, contact shadows, and physical studio materials.
 */
export default function GarmentMesh3D({
  garment,
  slot,
  isMale = false,
  avatarHeight = 170,
  measurements = {},
  morphInfluences = {},
  visible = true,
  hasOuterwear = false,
}) {
  const { texture } = useGarmentTexture(garment?.url);

  const heightScale = (Number(avatarHeight) || (isMale ? 178 : 168)) / (isMale ? 178 : 168);
  const rawSlot = String(slot || garment?.category || garment?.slot || '').toLowerCase();

  // Determine subcategory descriptors to tailor hem lines and fit
  const garmentText = `${garment?.sub_category || ''} ${garment?.item_type || ''} ${garment?.name || ''} ${garment?.category || ''}`.toLowerCase();

  // Build the appropriate 3D geometry matching this slot and garment type
  const geometry = useMemo(() => {
    if (!visible) return null;

    // 1. TOP
    if (rawSlot === 'top' || rawSlot === 'upper' || rawSlot === 'shirt') {
      const isCrop = garmentText.includes('crop') || garmentText.includes('sports_bra') || garmentText.includes('bralette');
      const isLongline = garmentText.includes('kurta') || garmentText.includes('tunic') || garmentText.includes('longline') || garmentText.includes('thobe');

      const yTop = (isMale ? 1.45 : 1.38) * heightScale;
      let yBottom = (isMale ? 1.02 : 0.96) * heightScale;
      if (isCrop) yBottom = (isMale ? 1.20 : 1.14) * heightScale;
      if (isLongline) yBottom = (isMale ? 0.82 : 0.74) * heightScale;

      const baseRx = isMale ? 0.22 : 0.185;
      const rxTop = hasOuterwear ? baseRx * 0.96 : baseRx;
      const rxBottom = isMale ? 0.165 : 0.145;

      return createCurvedTorsoGeometry({
        yTop,
        yBottom,
        rxTop,
        rxBottom,
        rzTop: isMale ? 0.115 : 0.125,
        rzBottom: 0.095,
        zOffset: 0.007,
      });
    }

    // 2. OUTERWEAR
    if (rawSlot === 'outerwear' || rawSlot === 'jacket' || rawSlot === 'coat') {
      const isLongCoat = garmentText.includes('overcoat') || garmentText.includes('trench') || garmentText.includes('duster') || garmentText.includes('מעיל ארוך');
      const isCropJacket = garmentText.includes('bolero') || garmentText.includes('shrug') || garmentText.includes('עליונית קצרה') || (garmentText.includes('jacket') && garmentText.includes('crop'));

      const yTop = (isMale ? 1.46 : 1.39) * heightScale;
      let yBottom = (isMale ? 0.94 : 0.88) * heightScale;
      if (isLongCoat) yBottom = (isMale ? 0.58 : 0.50) * heightScale;
      if (isCropJacket) yBottom = (isMale ? 1.15 : 1.08) * heightScale;

      return createCurvedTorsoGeometry({
        yTop,
        yBottom,
        rxTop: (isMale ? 0.235 : 0.205),
        rxBottom: (isMale ? 0.185 : 0.165),
        rzTop: isMale ? 0.128 : 0.138,
        rzBottom: 0.110,
        zOffset: 0.016, // Layered comfortably outside top
      });
    }

    // 3. DRESS
    if (rawSlot === 'dress' || rawSlot === 'full_body' || rawSlot === 'one_piece') {
      const isMini = garmentText.includes('mini') || garmentText.includes('קצרה');
      const isMaxi = garmentText.includes('maxi') || garmentText.includes('gown') || garmentText.includes('evening') || garmentText.includes('ארוכה');

      const yTop = (isMale ? 1.45 : 1.38) * heightScale;
      let yBottom = (isMale ? 0.60 : 0.52) * heightScale; // Default midi
      if (isMini) yBottom = (isMale ? 0.88 : 0.80) * heightScale;
      if (isMaxi) yBottom = (isMale ? 0.16 : 0.12) * heightScale;

      return createCurvedTorsoGeometry({
        yTop,
        yBottom,
        rxTop: isMale ? 0.22 : 0.185,
        rxBottom: isMaxi ? 0.26 : 0.20,
        rzTop: isMale ? 0.115 : 0.125,
        rzBottom: 0.125,
        zOffset: 0.008,
      });
    }

    // 4. BOTTOM
    if (rawSlot === 'bottom' || rawSlot === 'pants' || rawSlot === 'trousers' || rawSlot === 'skirt' || rawSlot === 'lower') {
      const isSkirt = garmentText.includes('skirt') || garmentText.includes('חצאית') || garmentText.includes('falda') || garmentText.includes('jupe');
      const isShorts = garmentText.includes('short') || garmentText.includes('trunk') || garmentText.includes('boxer') || garmentText.includes('קצרים');
      const isMaxiSkirt = isSkirt && (garmentText.includes('maxi') || garmentText.includes('long') || garmentText.includes('מקסי'));
      const isMiniSkirt = isSkirt && (garmentText.includes('mini') || garmentText.includes('מיני'));

      const yWaist = (isMale ? 1.08 : 1.03) * heightScale;
      const yCrotch = (isMale ? 0.85 : 0.80) * heightScale;
      let yHem = (isMale ? 0.11 : 0.09) * heightScale;
      if (isShorts) yHem = (isMale ? 0.68 : 0.62) * heightScale;
      if (isMiniSkirt) yHem = (isMale ? 0.80 : 0.74) * heightScale;
      if (isMaxiSkirt) yHem = (isMale ? 0.16 : 0.12) * heightScale;

      return createCurvedBottomGeometry({
        isSkirt,
        isShorts,
        yWaist,
        yCrotch,
        yHem,
        rxWaist: isMale ? 0.17 : 0.155,
        rzWaist: isMale ? 0.105 : 0.098,
        legCenterX: 0.088,
        zOffset: 0.006,
      });
    }

    // 5. SHOES
    if (rawSlot === 'shoes' || rawSlot === 'footwear' || rawSlot === 'shoe') {
      return createFootwearGeometry({
        legCenterX: 0.088,
        yHem: 0.00,
      });
    }

    // 6. ACCESSORIES
    return createAccessoryGeometry(rawSlot, { isMale, heightScale });
  }, [visible, rawSlot, garmentText, isMale, heightScale, hasOuterwear]);

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
        roughness={0.65}
        metalness={0.06}
        envMapIntensity={0.8}
      />
    </mesh>
  );
}
