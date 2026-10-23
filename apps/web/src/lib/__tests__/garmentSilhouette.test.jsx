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
