// GarmentMesh3D pulls in three.js scene helpers; stub the WebGL-only pieces
jest.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useThree: () => ({ camera: {} }),
  useFrame: () => {},
}));
jest.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: { traverse: () => {} } }), { preload: jest.fn() }),
  OrbitControls: () => null,
  ContactShadows: () => null,
}));

import {
  rowRuns,
  resampleAlphaMask,
  chooseGridResolution,
  buildSilhouetteShell,
  isConsistentView,
  synthesizeBackFabricData,
  detectGarmentShoulderRow,
} from '@/lib/garmentSilhouette';
import {
  getTorsoSlice,
  getLegSlice,
  normalizeGarmentRole,
  inferRoleFromName,
  resolveShellFit,
} from '@/components/GarmentMesh3D';

/** Paints a synthetic cut-out into a vertex mask of the given grid size. */
function paintMask(nx, ny, painter) {
  const vw = nx + 1;
  const vh = ny + 1;
  const mask = new Uint8Array(vw * vh);
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      mask[j * vw + i] = painter(i / nx, j / ny) ? 1 : 0;
    }
  }
  return mask;
}

// T-shirt: torso 0.25..0.75, sleeves reach the outer edges for the top 35% of the height
const teeMask = (nx, ny) =>
  paintMask(nx, ny, (u, v) => (v > 0.02 && ((u > 0.27 && u < 0.73) || (v < 0.35 && u > 0.02 && u < 0.98))));

// Pants: waistband block then two legs below 38%
const pantsMask = (nx, ny) =>
  paintMask(nx, ny, (u, v) => {
    if (v < 0.38) return u > 0.2 && u < 0.8;
    return (u > 0.2 && u < 0.46) || (u > 0.54 && u < 0.8);
  });

describe('silhouette shell builder', () => {
  test('rowRuns splits a row into torso + sleeves', () => {
    const nx = 40;
    const ny = 40;
    const mask = paintMask(nx, ny, (u) => (u > 0.1 && u < 0.3) || (u > 0.7 && u < 0.9));
    const runs = rowRuns(mask, nx, 10);
    expect(runs).toHaveLength(2);
  });

  test('resampleAlphaMask follows the alpha channel', () => {
    const w = 64;
    const h = 64;
    const alpha = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 16; x < 48; x++) alpha[y * w + x] = 255;
    const mask = resampleAlphaMask(alpha, w, h, 16, 16);
    const vw = 17;
    expect(mask[8 * vw + 8]).toBe(1);
    expect(mask[8 * vw + 1]).toBe(0);
  });

  test('a tee keeps its sleeves and inflates front/back around the torso', () => {
    const { nx, ny } = chooseGridResolution(1.0, 80);
    const mask = teeMask(nx, ny);
    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 1.0, slot: 'top', isMale: false, poseSleeves: false,
      yTop: 1.47, yBottom: 0.86, layerOffset: 0.022, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);

    const vw = nx + 1;
    const pf = shell.front.attributes.position;
    const pb = shell.back.attributes.position;
    // widest extent (sleeves) must exceed the torso width
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pf.count; i++) {
      minX = Math.min(minX, pf.getX(i));
      maxX = Math.max(maxX, pf.getX(i));
    }
    expect(maxX - minX).toBeGreaterThan(0.5);

    // centre of the chest: front is in front of the back sheet
    const mid = Math.floor(ny * 0.55) * vw + Math.floor(nx / 2);
    expect(pf.getZ(mid)).toBeGreaterThan(pb.getZ(mid) + 0.1);

    // sleeve tip: much thinner than the chest -> a tapered sleeve instead of a barrel
    const sleeveIdx = Math.floor(ny * 0.12) * vw + Math.floor(nx * 0.06);
    const sleeveGap = pf.getZ(sleeveIdx) - pb.getZ(sleeveIdx);
    const chestGap = pf.getZ(mid) - pb.getZ(mid);
    expect(sleeveGap).toBeLessThan(chestGap * 0.7);
  });

  test('moderately angled sleeves are swung down along the avatar arms', () => {
    const { nx, ny } = chooseGridResolution(1.6, 80);
    // Sleeves leave the shoulders at ~-48° (typical flat-lay photo)
    const mask = paintMask(nx, ny, (u, v) => {
      if (v <= 0.02) return false;
      if (u > 0.36 && u < 0.64) return true;
      if (u >= 0.02 && u <= 0.36) {
        const lo = (0.36 - u) * 1.8;
        return v >= lo && v <= lo + 0.18;
      }
      if (u >= 0.64 && u < 0.98) {
        const lo = (u - 0.64) * 1.8;
        return v >= lo && v <= lo + 0.18;
      }
      return false;
    });
    const common = {
      mask, nx, ny, aspect: 1.6, slot: 'top', isMale: false,
      yTop: 1.47, yBottom: 0.86, layerOffset: 0.022, getTorsoSlice, getLegSlice,
    };
    const raw = buildSilhouetteShell({ ...common, poseSleeves: false });
    const posed = buildSilhouetteShell({ ...common, poseSleeves: true });
    expect(raw.ok && posed.ok).toBe(true);
    expect(posed.info.sleevePose.length).toBe(2);

    const lowestSleeveY = (shell) => {
      const p = shell.front.attributes.position;
      let minY = Infinity;
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getX(i)) > 0.3) minY = Math.min(minY, p.getY(i));
      }
      return minY;
    };
    const maxAbsX = (shell) => {
      const p = shell.front.attributes.position;
      let m = 0;
      for (let i = 0; i < p.count; i++) m = Math.max(m, Math.abs(p.getX(i)));
      return m;
    };
    // sleeves now hang lower and no longer stick out sideways
    expect(maxAbsX(posed)).toBeLessThan(maxAbsX(raw) - 0.04);
    expect(posed.front.attributes.position.count).toBe(raw.front.attributes.position.count);
    expect(Number.isFinite(lowestSleeveY(posed))).toBe(true);
  });

  test('fully raised / horizontal sleeves keep the photographed pose', () => {
    const { nx, ny } = chooseGridResolution(1.6, 80);
    const mask = paintMask(nx, ny, (u, v) => (v > 0.02 && ((u > 0.36 && u < 0.64) || (v < 0.22 && u > 0.02 && u < 0.98))));
    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 1.6, slot: 'top', isMale: false,
      yTop: 1.47, yBottom: 0.86, layerOffset: 0.022, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);
    expect(shell.info.sleevePose).toHaveLength(0);
  });

  test('pants keep two legs and snap onto the avatar legs', () => {
    const { nx, ny } = chooseGridResolution(0.55, 100);
    const mask = pantsMask(nx, ny);
    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 0.55, slot: 'bottom', isMale: true,
      yTop: 1.08, yBottom: 0.11, layerOffset: 0.018, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);
    expect(shell.info.crotchRow).toBeGreaterThan(0);

    const vw = nx + 1;
    const pf = shell.front.attributes.position;
    // a row well below the crotch: left leg centre must be near -legCx
    const j = Math.floor(ny * 0.7);
    const leftIdx = j * vw + Math.floor(nx * 0.33);
    const rightIdx = j * vw + Math.floor(nx * 0.67);
    const y = pf.getY(leftIdx);
    const leg = getLegSlice(y, true);
    expect(Math.abs(pf.getX(leftIdx) + leg.cx)).toBeLessThan(0.05);
    expect(Math.abs(pf.getX(rightIdx) - leg.cx)).toBeLessThan(0.05);
  });

  test('degenerate masks are rejected so the procedural fallback is used', () => {
    const nx = 30;
    const ny = 30;
    const mask = new Uint8Array((nx + 1) * (ny + 1));
    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 1, slot: 'top', yTop: 1.47, yBottom: 0.86,
      getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(false);
  });

  test('isConsistentView accepts a matching back photo and rejects a different garment', () => {
    const front = { mean: [120, 120, 125], area: 0.55, aspect: 0.8 };
    expect(isConsistentView(front, { mean: [110, 112, 118], area: 0.58, aspect: 0.78 })).toBe(true);
    expect(isConsistentView(front, { mean: [30, 30, 30], area: 0.55, aspect: 0.8 })).toBe(false);
    expect(isConsistentView(front, { mean: [118, 120, 124], area: 0.1, aspect: 0.8 })).toBe(false);
  });

  test('A-line skirt closes watertight at slanted side seams and aligns front/back UVs', () => {
    const { nx, ny } = chooseGridResolution(0.85, 80);
    // Slanted A-line skirt: narrow at top waist (0.30..0.70), flaring wide to (0.08..0.92) at hem
    const mask = paintMask(nx, ny, (u, v) => {
      const halfSpan = 0.20 + 0.22 * v;
      return v >= 0.02 && v <= 0.98 && Math.abs(u - 0.5) <= halfSpan;
    });
    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 0.85, slot: 'bottom', isMale: false, isSkirt: true,
      yTop: 1.05, yBottom: 0.44, layerOffset: 0.018, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);

    const vw = nx + 1;
    const pf = shell.front.attributes.position;
    const pb = shell.back.attributes.position;
    const uvf = shell.front.attributes.uv;
    const uvb = shell.back.attributes.uv;

    // Every boundary vertex outside the interior mask must have identical front/back 3D position
    for (let j = 2; j < ny - 2; j++) {
      const idxLeft = j * vw;
      const idxRight = j * vw + nx;
      expect(pf.getZ(idxLeft)).toBeCloseTo(pb.getZ(idxLeft), 5);
      expect(pf.getZ(idxRight)).toBeCloseTo(pb.getZ(idxRight), 5);
      // Waist/hip width must clear the avatar torso half-width at that height
      const y = pf.getY(idxRight);
      if (y >= 0.72 && y <= 1.02) {
        const torso = getTorsoSlice(y, false);
        expect(pf.getX(idxRight) - pf.getX(idxLeft)).toBeGreaterThan(2 * (torso.rx + 0.015));
      }
    }

    // Front and back UVs must match 1:1 across the entire grid for pattern alignment
    for (let i = 0; i < uvf.count; i++) {
      expect(uvb.getX(i)).toBeCloseTo(uvf.getX(i), 5);
      expect(uvb.getY(i)).toBeCloseTo(uvf.getY(i), 5);
    }
  });
});

describe('garment slot inference from the item name', () => {
  test('cargo pants mislabeled as a top are still a bottom', () => {
    expect(normalizeGarmentRole('top', 'Top', 'grid-patterned utility cargo pants')).toBe('bottom');
    expect(inferRoleFromName('S-W-G Menswear Men\'s Cargo Pants Summer Spring')).toBe('bottom');
  });

  test('overcoats, dresses and tops keep their slot', () => {
    expect(normalizeGarmentRole('outerwear', 'Outerwear', 'dusty blue wool-blend overcoat')).toBe('outerwear');
    expect(normalizeGarmentRole('top', 'Top', 'Mustard Yellow Kaftan Robe')).toBe('dress');
    expect(normalizeGarmentRole('top', 'Top', 'Cotton T-shirt')).toBe('top');
    expect(normalizeGarmentRole('shoes', 'Footwear', 'Black Leather Boots')).toBe('shoes');
  });

  test('resolveShellFit places pants from waist to hem and long coats below the knee', () => {
    const pants = resolveShellFit({ rawSlot: 'bottom', garmentText: 'cargo pants', isMale: true });
    expect(pants.yTop).toBeGreaterThan(1.0);
    expect(pants.yBottom).toBeLessThan(0.2);
    const coat = resolveShellFit({ rawSlot: 'outerwear', garmentText: 'wool overcoat', isMale: false });
    expect(coat.yBottom).toBeLessThan(0.6);
  });
});

describe('back fabric synthesis (synthesizeBackFabricData)', () => {
  test('excludes graphics, prints and zippers while preserving horizontal stripes', () => {
    const w = 100;
    const h = 100;
    const data = new Uint8ClampedArray(w * h * 4);

    // Torso: x from 20 to 80, y from 10 to 90
    // Horizontal stripes: alternating navy [20, 35, 75] and white [240, 240, 245] every 10 rows
    for (let y = 10; y < 90; y++) {
      const isNavy = Math.floor(y / 10) % 2 === 0;
      const r = isNavy ? 20 : 240;
      const g = isNavy ? 35 : 240;
      const b = isNavy ? 75 : 245;
      for (let x = 20; x <= 80; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    // Add metallic zipper down center: x in [48..52], y in [15..85]
    for (let y = 15; y < 85; y++) {
      for (let x = 48; x <= 52; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 180; data[idx + 1] = 180; data[idx + 2] = 190;
      }
    }

    // Add bright yellow chest graphic print: x in [35..65], y in [35..55]
    for (let y = 35; y <= 55; y++) {
      for (let x = 35; x <= 65; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255; data[idx + 1] = 210; data[idx + 2] = 20;
      }
    }

    // Synthesize back fabric
    synthesizeBackFabricData(data, w, h);

    // 1. Center zipper in navy stripe row (e.g. y = 25, x = 50) must be restored to navy
    const idxZipNavy = (25 * w + 50) * 4;
    expect(data[idxZipNavy]).toBeCloseTo(20, -1);
    expect(data[idxZipNavy + 1]).toBeCloseTo(35, -1);
    expect(data[idxZipNavy + 2]).toBeCloseTo(75, -1);

    // 2. Center zipper in white stripe row (e.g. y = 75, x = 50) must be restored to white
    const idxZipWhite = (75 * w + 50) * 4;
    expect(data[idxZipWhite]).toBeGreaterThan(200);
    expect(data[idxZipWhite + 1]).toBeGreaterThan(200);
    expect(data[idxZipWhite + 2]).toBeGreaterThan(200);

    // 3. Graphic print area on navy row (y = 45 is in row 40..49, which is navy)
    // Center of graphic (x = 50, y = 45) must NOT be yellow! It must be navy!
    const idxGraphicNavy = (45 * w + 50) * 4;
    expect(data[idxGraphicNavy]).toBeLessThan(60);
    expect(data[idxGraphicNavy + 1]).toBeLessThan(60);
    expect(data[idxGraphicNavy + 2]).toBeCloseTo(75, -1);

    // 4. Graphic print area on white row (y = 52 is in row 50..59, which is white)
    // Center of graphic (x = 50, y = 52) must be white, not yellow!
    const idxGraphicWhite = (52 * w + 50) * 4;
    expect(data[idxGraphicWhite]).toBeGreaterThan(200);
    expect(data[idxGraphicWhite + 1]).toBeGreaterThan(200);
    expect(data[idxGraphicWhite + 2]).toBeGreaterThan(200);
  });

  test('excludes asymmetric breast pockets and preserves plaid pattern', () => {
    const w = 100;
    const h = 100;
    const data = new Uint8ClampedArray(w * h * 4);

    // Plaid pattern across torso: x in 20..80, y in 10..90
    // Red [180, 30, 30] and Green [20, 100, 30] blocks of 12x12 px
    for (let y = 10; y < 90; y++) {
      const yBand = Math.floor(y / 12) % 2;
      for (let x = 20; x <= 80; x++) {
        const xBand = Math.floor((x - 20) / 12) % 2;
        const isRed = (yBand === 0 && xBand === 0) || (yBand === 1 && xBand === 1);
        const idx = (y * w + x) * 4;
        data[idx] = isRed ? 180 : 20;
        data[idx + 1] = isRed ? 30 : 100;
        data[idx + 2] = 30;
        data[idx + 3] = 255;
      }
    }

    // Add a contrasting breast pocket on the right chest: x in [56..70], y in [25..45]
    for (let y = 25; y <= 45; y++) {
      for (let x = 56; x <= 70; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 230; data[idx + 1] = 230; data[idx + 2] = 230;
      }
    }

    synthesizeBackFabricData(data, w, h);

    // Pocket area at (x=63, y=30): was white [230, 230, 230], must now match the mirrored plaid color!
    const idxPocket = (30 * w + 63) * 4;
    expect(data[idxPocket]).not.toBe(230);
    // At y=30, x=63: mirrored position is xMirror = 20 + 80 - 63 = 37.
    const idxMirror = (30 * w + 37) * 4;
    expect(data[idxPocket]).toBe(data[idxMirror]);
    expect(data[idxPocket + 1]).toBe(data[idxMirror + 1]);
    expect(data[idxPocket + 2]).toBe(data[idxMirror + 2]);
  });
});

describe('shoulder line detection and hoodie mapping', () => {
  test('maps flat-lay/hanged hoodie shoulders to the avatar shoulder line', () => {
    const nx = 64;
    const ny = 100;
    // Hoodie mask:
    // rows 0..37: narrow hood in center (u in [0.42, 0.58])
    // rows 38..100: shoulders and torso (u in [0.15, 0.85])
    const mask = paintMask(nx, ny, (u, v) => {
      if (v < 0.38) return u >= 0.42 && u <= 0.58;
      return u >= 0.15 && u <= 0.85;
    });

    const shoulderRow = detectGarmentShoulderRow(
      Array.from({ length: ny + 1 }, (_, j) => rowRuns(mask, nx, j)),
      nx,
      ny,
      (0.85 * 0.61) / nx
    );
    expect(shoulderRow).toBeGreaterThanOrEqual(35);
    expect(shoulderRow).toBeLessThanOrEqual(40);

    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 0.85, slot: 'top', isMale: false,
      yTop: 1.47, yBottom: 0.86, layerOffset: 0.022, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);

    const pf = shell.front.attributes.position;
    const vw = nx + 1;

    // 1. The garment's shoulder row sits right at the avatar's shoulder line (~1.42)
    const midCol = Math.floor(nx / 2);
    const shoulderIdx = shoulderRow * vw + midCol;
    expect(pf.getY(shoulderIdx)).toBeCloseTo(1.42, 2);

    // 2. The hood extends upward above the shoulders toward the avatar head
    const topIdx = midCol;
    expect(pf.getY(topIdx)).toBeGreaterThan(1.60);

    // 3. The hem sits at the avatar hip height (~0.86)
    const hemIdx = ny * vw + midCol;
    expect(pf.getY(hemIdx)).toBeCloseTo(0.86, 2);
  });

  test('skirts preserve linear A-line silhouette without waist pinching or hourglass indentation', () => {
    const { nx, ny } = chooseGridResolution(0.85, 80);
    // Pure linear A-line skirt: span increases linearly from waist (0.40) to hem (0.84)
    const mask = paintMask(nx, ny, (u, v) => {
      const halfSpan = 0.20 + 0.22 * v;
      return v >= 0.02 && v <= 0.98 && Math.abs(u - 0.5) <= halfSpan;
    });

    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 0.85, slot: 'bottom', isMale: false, isSkirt: true,
      yTop: 1.05, yBottom: 0.44, layerOffset: 0.018, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);

    const pf = shell.front.attributes.position;
    const vw = nx + 1;

    // Check skirt width at waist (v=0.1), mid (v=0.5), and hem (v=0.9)
    const getRowWidth = (j) => {
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i <= nx; i++) {
        const idx = j * vw + i;
        if (mask[idx]) {
          minX = Math.min(minX, pf.getX(idx));
          maxX = Math.max(maxX, pf.getX(idx));
        }
      }
      return maxX - minX;
    };

    const wWaist = getRowWidth(Math.floor(ny * 0.1));
    const wMid = getRowWidth(Math.floor(ny * 0.5));
    const wHem = getRowWidth(Math.floor(ny * 0.9));

    // Mid width must be exactly the linear midpoint between waist and hem (no hourglass pinch!)
    const expectedMid = (wWaist + wHem) / 2;
    expect(wMid).toBeCloseTo(expectedMid, 1);
    expect(wMid).toBeGreaterThan(wWaist);
    expect(wHem).toBeGreaterThan(wMid);
  });

  test('skirt top aligns precisely with avatar waistline (y=1.05) and waist width', () => {
    const { nx, ny } = chooseGridResolution(0.83, 80);
    // Skirt mask starting at row 5 (v ~ 0.06) down to row 75 (v ~ 0.94)
    // with waistband width = 0.46 of grid, flaring to 0.75 at hem
    const mask = paintMask(nx, ny, (u, v) => {
      if (v < 0.06 || v > 0.94) return false;
      const vNorm = (v - 0.06) / (0.94 - 0.06);
      const halfSpan = 0.23 + 0.15 * vNorm;
      return Math.abs(u - 0.5) <= halfSpan;
    });

    const shell = buildSilhouetteShell({
      mask, nx, ny, aspect: 0.83, slot: 'bottom', isMale: false, isSkirt: true, isStandalone: false,
      yTop: 1.05, yBottom: 0.44, layerOffset: 0.018, getTorsoSlice, getLegSlice,
    });
    expect(shell.ok).toBe(true);

    const pf = shell.front.attributes.position;
    const vw = nx + 1;

    // 1. First row with fabric must sit right at the avatar waistline (y = 1.05)
    let firstFabricJ = -1;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        if (mask[j * vw + i]) { firstFabricJ = j; break; }
      }
      if (firstFabricJ >= 0) break;
    }
    expect(firstFabricJ).toBeGreaterThan(0);
    const midIdx = firstFabricJ * vw + Math.floor(nx / 2);
    expect(pf.getY(midIdx)).toBeCloseTo(1.05, 2);

    // 2. Skirt waistband width must match the avatar waist size (~0.46m)
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i <= nx; i++) {
      const idx = firstFabricJ * vw + i;
      if (mask[idx]) {
        minX = Math.min(minX, pf.getX(idx));
        maxX = Math.max(maxX, pf.getX(idx));
      }
    }
    const waistWidth = maxX - minX;
    // Avatar waist slice has rx ~ 0.212, so total width with clearance is ~0.46m - 0.48m
    expect(waistWidth).toBeGreaterThanOrEqual(0.44);
    expect(waistWidth).toBeLessThanOrEqual(0.52);
  });
});
