import {
  extractShoePhotoLayout,
  shoeUVAnatomical,
  createRealisticFootwearGeometry,
  getFootAnatomy,
} from '@/lib/footwearBuilder3D';

function makeImageBuffer(w, h, paintPixel) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paintPixel(x, y, w, h);
      const o = (y * w + x) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = a;
    }
  }
  return buf;
}

describe('extractShoePhotoLayout', () => {
  test('splits overlapping 3/4 Nike-like pair (4cdc profile), sets heroBoxIndex=1, and detects toeUp=false', () => {
    const w = 313;
    const h = 374;
    const vx = 134;
    const buf = makeImageBuffer(w, h, (x, y) => {
      const ny = y / h;
      // Left shoe [8..134] (partially occluded ~126px), right shoe [134..306] (~172px)
      const leftCenter = 68;
      const rightCenter = 222;

      const leftHalfW = ny < 0.20 ? 18 + ny * 180 : 48 + Math.sin(Math.min(1, ny) * Math.PI * 0.75) * 20;
      const rightHalfW = ny < 0.20 ? 22 + ny * 210 : 54 + Math.sin(Math.min(1, ny) * Math.PI * 0.75) * 34;

      const inLeft = ny >= 0.06 && ny <= 0.94 && Math.abs(x - leftCenter) <= leftHalfW && x <= vx + 2;
      const inRight = ny >= 0.02 && ny <= 0.98 && Math.abs(x - rightCenter) <= rightHalfW && x >= vx - 2;

      // Overlapping valley around vx=134 spans lower mid/forefoot [0.36..0.94]
      const inMidOverlap = Math.abs(x - vx) <= 6 && ny >= 0.36 && ny <= 0.94;
      if (!inLeft && !inRight && !inMidOverlap) return [0, 0, 0, 0];

      if (ny >= 0.90) return [236, 238, 240, 255];
      if (ny <= 0.35) return [52, 54, 60, 255];
      return [178, 180, 184, 255];
    });

    const layout = extractShoePhotoLayout(buf, w, h);
    expect(layout.mode).toBe('pair');
    expect(layout.boxes).toHaveLength(2);
    expect(layout.heroBoxIndex).toBe(1);
    expect(layout.toeUp).toBe(false);
    expect(layout.boxes[0].toeUp).toBe(false);
    expect(layout.boxes[1].toeUp).toBe(false);
    expect(layout.isFrontThreeQuarter).toBe(true);
    expect(parseInt(layout.soleColor.slice(1, 3), 16)).toBeGreaterThan(205);
    expect(parseInt(layout.liningColor.slice(1, 3), 16)).toBeLessThan(90);
  });

  test('preserves pure white sneaker cutout (w_sneakers_white_navy profile) and detects toeUp=true', () => {
    const w = 258;
    const h = 342;
    const buf = makeImageBuffer(w, h, (x, y) => {
      const ny = y / h;
      const inLeft = x >= 16 && x <= 116;
      const inRight = x >= 142 && x <= 242;
      if ((!inLeft && !inRight) || ny < 0.04 || ny > 0.95) return [0, 0, 0, 0];
      const cx = inLeft ? 66 : 192;
      const hw = ny < 0.45 ? 46 : 36;
      if (Math.abs(x - cx) > hw) return [0, 0, 0, 0];
      if (ny >= 0.68 && ny <= 0.88 && Math.abs(x - cx) < 22) {
        return [20, 32, 62, 255];
      }
      return [249, 249, 251, 255];
    });

    const layout = extractShoePhotoLayout(buf, w, h);
    expect(layout.mode).toBe('pair');
    expect(layout.toeUp).toBe(true);
    expect(layout.boxes[0].toeUp).toBe(true);
    expect(layout.boxes[1].toeUp).toBe(true);
    expect(layout.boxes[0].v1 - layout.boxes[0].v0).toBeGreaterThan(0.8);
  });

  test('detects toeUp=false on top-down flat-lay sneaker pair (m_sneakers_navy_white profile)', () => {
    const w = 258;
    const h = 343;
    const buf = makeImageBuffer(w, h, (x, y) => {
      const ny = y / h;
      const inLeft = x >= 18 && x <= 116;
      const inRight = x >= 142 && x <= 240;
      if ((!inLeft && !inRight) || ny < 0.04 || ny > 0.96) return [0, 0, 0, 0];
      const cx = inLeft ? 67 : 191;
      const hw = ny < 0.45 ? 36 : 46;
      if (Math.abs(x - cx) > hw) return [0, 0, 0, 0];
      if (ny >= 0.10 && ny <= 0.30 && Math.abs(x - cx) < 24) {
        return [25, 34, 52, 255];
      }
      return [230, 232, 236, 255];
    });

    const layout = extractShoePhotoLayout(buf, w, h);
    expect(layout.mode).toBe('pair');
    expect(layout.toeUp).toBe(false);
    expect(layout.boxes[0].toeUp).toBe(false);
    expect(layout.boxes[1].toeUp).toBe(false);
  });

  test('does not split a single narrow boot into a pair', () => {
    const w = 140;
    const h = 360;
    const buf = makeImageBuffer(w, h, (x, y) => {
      const ny = y / h;
      if (ny < 0.04 || ny > 0.96) return [0, 0, 0, 0];
      const hw = ny < 0.55 ? 34 : 46;
      if (Math.abs(x - w / 2) > hw) return [0, 0, 0, 0];
      return [38, 36, 36, 255];
    });

    const layout = extractShoePhotoLayout(buf, w, h);
    expect(layout.mode).toBe('top');
    expect(layout.boxes).toBeNull();
    expect(parseInt(layout.soleColor.slice(1, 3), 16)).toBeLessThan(80);
  });

  test('detects side view horizontal shoe and toe direction', () => {
    const w = 320;
    const h = 170;
    const buf = makeImageBuffer(w, h, (x, y) => {
      const nx = x / w;
      const ny = y / h;
      if (nx < 0.06 || nx > 0.94 || ny > 0.90) return [0, 0, 0, 0];
      const topNy = nx < 0.45 ? 0.58 : 0.18;
      if (ny < topNy) return [0, 0, 0, 0];
      return [45, 48, 55, 255];
    });

    const layout = extractShoePhotoLayout(buf, w, h);
    expect(layout.mode).toBe('side');
    expect(layout.toeLeft).toBe(true);
  });
});

describe('shoeUVAnatomical', () => {
  const layout4cdc = {
    mode: 'pair',
    toeUp: false,
    isFrontThreeQuarter: true,
    heroBoxIndex: 1,
    boxes: [
      { u0: 0.02, u1: 0.42, v0: 0.04, v1: 0.95, toeUp: false, isFrontThreeQuarter: true },
      { u0: 0.45, u1: 0.97, v0: 0.03, v1: 0.98, toeUp: false, isFrontThreeQuarter: true },
    ],
  };

  test('maps toe to bottom, upright tongue logo to top on BOTH feet, and avoids duplicate logo on heel', () => {
    const bx = layout4cdc.boxes[1];
    for (const side of [-1, 1]) {
      const frame = {
        z0: -0.08,
        z1: 0.206,
        xMin: side > 0 ? 0.04 : -0.14,
        xMax: side > 0 ? 0.14 : -0.04,
        yMin: -0.006,
        yMax: 0.111,
        ankleZ: -0.005,
      };
      const xL = frame.xMin + 0.015;
      const xR = frame.xMax - 0.015;
      const xMid = (frame.xMin + frame.xMax) * 0.5;

      const [uLeftTongue, vTongue] = shoeUVAnatomical(side, xL, 0.105, -0.005, frame, layout4cdc);
      const [uRightTongue] = shoeUVAnatomical(side, xR, 0.105, -0.005, frame, layout4cdc);
      const [, vLaces] = shoeUVAnatomical(side, xMid, 0.075, 0.075, frame, layout4cdc);
      const [, vToe] = shoeUVAnatomical(side, xMid, 0.035, 0.204, frame, layout4cdc);
      const [uHeel, vHeel] = shoeUVAnatomical(side, xMid, 0.09, -0.076, frame, layout4cdc);

      // Both feet sample heroBoxIndex = 1 cleanly
      expect(uLeftTongue).toBeGreaterThanOrEqual(bx.u0);
      expect(uRightTongue).toBeLessThanOrEqual(bx.u1);
      // Non-mirrored left-to-right text reading across tongue on BOTH feet
      expect(uLeftTongue).toBeLessThan(uRightTongue);
      // Monotonic top-to-bottom progression: tongue -> laces -> toe
      expect(vTongue).toBeGreaterThan(bx.v0 + 0.78 * (bx.v1 - bx.v0));
      expect(vTongue).toBeGreaterThan(vLaces);
      expect(vLaces).toBeGreaterThan(vToe);
      expect(vToe).toBeLessThan(bx.v0 + 0.18 * (bx.v1 - bx.v0));
      // Back heel samples the clean forefoot knit weave zone, well below the top tongue logo [0.74..0.92]
      expect(vHeel).toBeLessThan(bx.v0 + 0.35 * (bx.v1 - bx.v0));
      expect(vHeel).toBeGreaterThan(bx.v0 + 0.12 * (bx.v1 - bx.v0));

      // Side quarters vary smoothly in V along Z and in U across steep sidewall rings (zero barcode strips)
      const [, vQuarterFront] = shoeUVAnatomical(side, frame.xMin + 0.01, 0.06, -0.02, frame, layout4cdc, {
        archU: 0.15,
        wallElev: 0.65,
      });
      const [, vQuarterBack] = shoeUVAnatomical(side, frame.xMin + 0.01, 0.06, -0.06, frame, layout4cdc, {
        archU: 0.15,
        wallElev: 0.65,
      });
      expect(Math.abs(vQuarterFront - vQuarterBack)).toBeGreaterThan(0.15);

      const [uWall0] = shoeUVAnatomical(side, frame.xMin + 0.002, 0.03, 0.08, frame, layout4cdc, {
        archU: 0.0,
        wallElev: 0.0,
      });
      const [uWall3] = shoeUVAnatomical(side, frame.xMin + 0.002, 0.05, 0.08, frame, layout4cdc, {
        archU: 0.18,
        wallElev: 0.55,
      });
      expect(Math.abs(uWall0 - uWall3)).toBeGreaterThan(0.04);
    }
  });

  test('inverts v cleanly when toeUp is true', () => {
    const frame = {
      z0: -0.08,
      z1: 0.206,
      xMin: 0.04,
      xMax: 0.14,
      yMin: -0.006,
      yMax: 0.111,
      ankleZ: -0.005,
    };
    const layoutToeUp = {
      mode: 'top',
      toeUp: true,
      box: { u0: 0.1, u1: 0.9, v0: 0.05, v1: 0.95, toeUp: true },
    };
    const [, vToe] = shoeUVAnatomical(1, 0.09, 0.035, 0.204, frame, layoutToeUp);
    const [, vTongue] = shoeUVAnatomical(1, 0.09, 0.105, -0.005, frame, layoutToeUp);
    expect(vToe).toBeGreaterThan(0.80);
    expect(vTongue).toBeLessThan(0.25);
  });
});

describe('createRealisticFootwearGeometry', () => {
  function assertValidGeometry(geo) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    expect(pos.count).toBeGreaterThan(100);
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(Number.isFinite(pos.getY(i))).toBe(true);
      expect(Number.isFinite(pos.getZ(i))).toBe(true);
      expect(Number.isFinite(norm.getX(i))).toBe(true);
      expect(Number.isFinite(norm.getY(i))).toBe(true);
      expect(Number.isFinite(norm.getZ(i))).toBe(true);
      expect(Number.isFinite(uv.getX(i))).toBe(true);
      expect(Number.isFinite(uv.getY(i))).toBe(true);
    }
    geo.computeBoundingBox();
    return geo.boundingBox;
  }

  test('builds multi-zone male sneaker aligned to avatar foot bounds with no NaN attributes', () => {
    const anatomy = getFootAnatomy(true);
    const spec = { kind: 'sneaker', soleThickness: 0.024 };
    const realistic = createRealisticFootwearGeometry({
      isMale: true,
      spec,
      layout: { mode: 'pair', toeUp: false, boxes: null },
      standalone: true,
    });

    const rBox = assertValidGeometry(realistic);

    // Group 0 (upper), Group 1 (sole), Group 2 (lining)
    const groupMats = new Set(realistic.groups.map((g) => g.materialIndex));
    expect(groupMats.has(0)).toBe(true);
    expect(groupMats.has(1)).toBe(true);
    expect(groupMats.has(2)).toBe(true);
    expect(groupMats.size).toBe(3);

    // Aligned closely to avatar foot envelope in X and Z, flush ground contact at -soleThickness
    const expectedMaxX = Math.max(...anatomy.profile.map((p) => p.x1)) + 0.0095;
    const expectedMinX = -expectedMaxX;
    expect(Math.abs(rBox.min.x - expectedMinX)).toBeLessThan(0.015);
    expect(Math.abs(rBox.max.x - expectedMaxX)).toBeLessThan(0.015);
    expect(Math.abs(rBox.min.z - (anatomy.heelZ - 0.012))).toBeLessThan(0.015);
    expect(Math.abs(rBox.max.z - (anatomy.toeZ + 0.012))).toBeLessThan(0.015);
    expect(rBox.min.y).toBeLessThan(-0.020);
    expect(rBox.min.y).toBeGreaterThan(-0.045);

    // Group 2 interior lining remains behind the front tongue crest so tongue text is never clipped
    const pos = realistic.getAttribute('position');
    const idx = realistic.getIndex();
    let liningMaxZ = -Infinity;
    for (const grp of realistic.groups) {
      if (grp.materialIndex !== 2) continue;
      for (let k = grp.start; k < grp.start + grp.count; k++) {
        const vi = idx.getX(k);
        const pz = pos.getZ(vi);
        if (pz > liningMaxZ) liningMaxZ = pz;
      }
    }
    expect(liningMaxZ).toBeLessThan(anatomy.ankleZ);

    // Watertight toe & heel seams: Group 0 (upper) and Group 1 (sole) share exact welt-plane apexes
    const group0Verts = [];
    let soleToeApex = null;
    let soleHeelApex = null;
    for (const grp of realistic.groups) {
      for (let k = grp.start; k < grp.start + grp.count; k++) {
        const vi = idx.getX(k);
        const vx = pos.getX(vi);
        if (vx <= 0) continue; // inspect right-side shoe cleanly
        const pt = { x: vx, y: pos.getY(vi), z: pos.getZ(vi) };
        if (grp.materialIndex === 0) {
          group0Verts.push(pt);
        } else if (grp.materialIndex === 1) {
          if (!soleToeApex || pt.z > soleToeApex.z) soleToeApex = pt;
          if (!soleHeelApex || pt.z < soleHeelApex.z) soleHeelApex = pt;
        }
      }
    }
    const minDistToGroup0 = (target) =>
      group0Verts.reduce(
        (best, p) => Math.min(best, Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z)),
        Infinity
      );
    expect(soleToeApex).not.toBeNull();
    expect(soleHeelApex).not.toBeNull();
    expect(minDistToGroup0(soleToeApex)).toBeLessThan(1e-5);
    expect(minDistToGroup0(soleHeelApex)).toBeLessThan(1e-5);
  });

  test('supports worn sneakers, sandals, heels, flats, loafers, and boots cleanly', () => {
    for (const [isMale, spec, standalone] of [
      [false, { kind: 'sneaker', soleThickness: 0.024 }, false],
      [false, { kind: 'sandal', sandalStyle: 'tstrap', heelHeight: 0.04, soleThickness: 0.01 }, true],
      [false, { kind: 'heel', heelHeight: 0.08, soleThickness: 0.01 }, true],
      [true, { kind: 'loafer', soleThickness: 0.014 }, true],
      [true, { kind: 'ankle_boot', soleThickness: 0.020 }, false],
      [false, { kind: 'boot', collar: 0.40, soleThickness: 0.022 }, false],
    ]) {
      const geo = createRealisticFootwearGeometry({ isMale, spec, standalone });
      const box = assertValidGeometry(geo);
      const groupMats = new Set(geo.groups.map((g) => g.materialIndex));
      expect(groupMats.has(0)).toBe(true);
      expect(groupMats.has(1)).toBe(true);
      if (spec.kind === 'boot') {
        expect(box.max.y).toBeGreaterThan(0.35);
      } else if (spec.kind === 'ankle_boot') {
        expect(box.max.y).toBeGreaterThan(0.13);
      }
    }
  });
});
