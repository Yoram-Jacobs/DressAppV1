import React from 'react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
    i18n: { dir: () => 'ltr', changeLanguage: () => new Promise(() => {}) },
  }),
  Translation: ({ children }) => children((key, options) => (options && options.defaultValue) || key),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/stylist' }),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

jest.mock('@/lib/api', () => ({
  userStore: {
    get: () => null,
    subscribe: () => () => {},
  },
  closet: {
    list: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  DialogTitle: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogFooter: ({ children }) => <div>{children}</div>,
}));

jest.mock('@/lib/footwearFitting', () => ({
  poseAvatarGeometry: (g) => g,
  resolveFootwearSpec: () => null,
  computeFootPose: () => ({ active: false }),
  createFittedFootwearGeometry: () => null,
  createHeelGeometry: () => null,
  createFootwearHardwareGeometry: () => null,
  poseGeometry: (g) => g,
}));

jest.mock('@/lib/avatarMorphField', () => ({
  buildAvatarMorphField: () => null,
  applyAvatarMorphsToGeometry: (g) => g,
}));

jest.mock('@/lib/garmentSilhouette', () => ({
  analyzeGarmentFit: () => ({ fit: 'regular' }),
  buildSilhouetteShell: () => null,
  chooseGridResolution: () => 32,
  resampleAlphaMask: () => null,
  extractRowRuns: () => [],
  isConsistentView: () => true,
  classifyGroupView: () => 'front',
  extractSideProfile: () => null,
  synthesizeBackFabricData: () => null,
  resolveBottomLength: () => null,
}));

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="mock-three-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: jest.fn(), lerp: jest.fn(), distanceTo: () => 0.01 },
    },
  }),
  useFrame: () => {},
}));

jest.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    () => ({
      scene: {
        clone: () => ({
          traverse: (cb) => {
            cb({
              isMesh: true,
              material: {
                name: 'skin',
                color: { copy: jest.fn(), set: jest.fn() },
                needsUpdate: false,
                clone: jest.fn().mockReturnThis(),
              },
              morphTargetDictionary: { tall: 0 },
              morphTargetInfluences: [0],
            });
          },
        }),
      },
    }),
    { preload: jest.fn() }
  ),
  OrbitControls: () => <div data-testid="mock-orbit-controls" />,
  ContactShadows: () => <div data-testid="mock-contact-shadows" />,
}));

import DressingRoom3D from '@/components/DressingRoom3D';
import { retractCoveredAvatarSkin } from '@/components/AvatarMesh3D';
import * as catalog from '@/lib/garmentTemplatesCatalog';
import * as templates from '@/lib/garmentTemplates';

describe('Canonical Hooded 3D Garments (Hood-On / Hood-Off)', () => {
  const sampleMeasurements = {
    height_cm: 175,
    weight_kg: 72,
    chest_cm: 98,
    waist_cm: 82,
    hips_cm: 96,
  };

  test('Catalog and legacy template resolvers detect hooded garments, respect hoodMode, and keep crewnecks hoodless', () => {
    for (const mod of [catalog, templates]) {
      expect(mod.TEMPLATE_CACHE_VERSION).toBe('clean9');
      expect(mod.isHoodedGarment({ rawSlot: 'top', garmentText: 'Black Zip-Up Hoodie' })).toBe(true);
      expect(mod.isHoodedGarment({ rawSlot: 'top', garmentText: 'קפוצ׳ון פליז שחור' })).toBe(true);
      expect(mod.isHoodedGarment({ rawSlot: 'outerwear', garmentText: 'Olive Winter Parka Hooded Coat' })).toBe(true);
      expect(mod.isHoodedGarment({ rawSlot: 'top', garmentText: 'Classic Crewneck Sweatshirt' })).toBe(false);

      expect(mod.resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Black Zip-Up Hoodie', hoodMode: 'off' })).toBe('hoodie');
      expect(mod.resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Black Zip-Up Hoodie', hoodMode: 'on' })).toBe('hoodie_hood_on');
      expect(mod.resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Olive Winter Parka Hooded Coat', hoodMode: 'off' })).toBe('hooded_coat');
      expect(mod.resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Olive Winter Parka Hooded Coat', hoodMode: 'on' })).toBe('hooded_coat_hood_on');
      expect(mod.resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Classic Crewneck Sweatshirt', hoodMode: 'on' })).toBe('top_longsleeve');

      expect(mod.getTemplateGlbUrl('hoodie_hood_on', true)).toBe('/models/templates/male/hoodie_hood_on.glb?v=clean9');
      expect(mod.getTemplateGlbUrl('hooded_coat_hood_on', false)).toBe('/models/templates/female/hooded_coat_hood_on.glb?v=clean9');
    }
  });

  test('All 12 male & female hooded GLBs have <=4 clean attributes, bilateral X symmetry, Hood-On crown clearance, and Hood-Off posterior drape', () => {
    const fs = require('fs');
    const path = require('path');

    const readGlb = (relPath, gender) => {
      const full = path.resolve(__dirname, '../../../public/models/templates', relPath);
      const buf = fs.readFileSync(full);
      const jsonLen = buf.readUInt32LE(12);
      const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
      const binOff = 20 + jsonLen;
      const prim = gltf.meshes[0].primitives[0];
      const attrs = Object.keys(prim.attributes);
      expect(attrs.length).toBeLessThanOrEqual(4);
      expect(attrs).toContain('POSITION');
      expect(attrs).toContain('NORMAL');
      expect(attrs).toContain('TEXCOORD_0');
      const posAcc = gltf.accessors[prim.attributes.POSITION];
      expect(posAcc.min[0]).toBeLessThan(-0.35);
      expect(posAcc.max[0]).toBeGreaterThan(0.35);
      expect(Math.abs(posAcc.max[0] + posAcc.min[0])).toBeLessThan(0.03);

      const bv = gltf.bufferViews[posAcc.bufferView];
      const startByte = binOff + 8 + (bv.byteOffset || 0) + (posAcc.byteOffset || 0);
      const stride = bv.byteStride || 12;
      const yHeadMin = gender === 'male' ? 1.54 : 1.44;
      let hoodMaxZ = -Infinity;
      let headMaxAbsX = 0;
      let centerCrownMaxY = -Infinity;
      let sideCrownMaxY = -Infinity;
      for (let i = 0; i < posAcc.count; i++) {
        const off = startByte + i * stride;
        const x = buf.readFloatLE(off);
        const y = buf.readFloatLE(off + 4);
        const z = buf.readFloatLE(off + 8);
        if (y > yHeadMin) {
          if (z > hoodMaxZ) hoodMaxZ = z;
          if (Math.abs(x) > headMaxAbsX) headMaxAbsX = Math.abs(x);
          if (Math.abs(x) < 0.008 && y > centerCrownMaxY) centerCrownMaxY = y;
          if (Math.abs(x) >= 0.015 && Math.abs(x) <= 0.060 && y > sideCrownMaxY) sideCrownMaxY = y;
        }
      }
      return { posAcc, hoodMaxZ, headMaxAbsX, centerCrownMaxY, sideCrownMaxY };
    };

    for (const gender of ['male', 'female']) {
      for (const base of ['hoodie', 'hooded_coat']) {
        const off = readGlb(`${gender}/${base}.glb`, gender);
        const aliasOff = readGlb(`${gender}/${base}_hood_off.glb`, gender);
        const on = readGlb(`${gender}/${base}_hood_on.glb`, gender);
        expect(off.posAcc.min[2]).toBeLessThan(-0.12);
        expect(aliasOff.posAcc.min[2]).toBeLessThan(-0.12);
        expect(on.posAcc.max[1]).toBeGreaterThan(off.posAcc.max[1] + 0.18);
        expect(on.posAcc.max[1]).toBeLessThan(gender === 'male' ? 1.845 : 1.740);
        expect(on.centerCrownMaxY).toBeGreaterThanOrEqual(on.sideCrownMaxY - 0.002);
        expect(on.hoodMaxZ).toBeLessThan(gender === 'male' ? 0.172 : 0.160);
        expect(on.headMaxAbsX).toBeLessThan(0.118);
      }
    }
  });

  test('retractCoveredAvatarSkin retracts hair crown, sides, and occiput under hasHoodOn without deforming non-hair skin', () => {
    const hairGeo = new THREE.BufferGeometry();
    hairGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          0.0, 1.80, 0.042,
          0.09, 1.66, 0.05,
          0.0, 1.66, -0.05,
        ]),
        3
      )
    );
    retractCoveredAvatarSkin(hairGeo, { hasHoodOn: true }, true, 'MBLab_hair', 'hair_brown');
    const hp = hairGeo.attributes.position.array;
    expect(hp[1]).toBeLessThan(1.80);
    expect(hp[3]).toBeCloseTo(0.09 * 0.76, 4);
    expect(hp[8]).toBeGreaterThan(-0.05);

    const skinGeo = new THREE.BufferGeometry();
    skinGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0.0, 1.80, 0.042]), 3)
    );
    retractCoveredAvatarSkin(skinGeo, { hasHoodOn: true }, true, 'MBLab_human_male', 'skin');
    const sp = skinGeo.attributes.position.array;
    expect(sp[0]).toBeCloseTo(0.0, 5);
    expect(sp[1]).toBeCloseTo(1.80, 5);
    expect(sp[2]).toBeCloseTo(0.042, 5);
  });

  test('DressingRoom3D renders toggle-hood-mode-btn for hooded outfits and toggles between Hood Off and Hood On', () => {
    render(
      <DressingRoom3D
        open={true}
        onOpenChange={jest.fn()}
        outfitItems={{
          top: {
            id: 'hoodie-test-1',
            name: 'Black Zip-Up Hoodie',
            url: '/assets/onboarding/m_tshirt_crew_white.png',
            category: 'top',
          },
          bottom: {
            id: 'pants-test-1',
            name: 'Black Twill Chinos',
            url: '/assets/onboarding/m_pants_chinos_black.png',
            category: 'bottom',
          },
        }}
        measurements={sampleMeasurements}
        sex="male"
      />
    );

    const hoodBtn = screen.getByTestId('toggle-hood-mode-btn');
    expect(hoodBtn).toBeInTheDocument();
    expect(screen.getByText('Hood Off')).toBeInTheDocument();
    fireEvent.click(hoodBtn);
    expect(screen.getByText('Hood On')).toBeInTheDocument();
    fireEvent.click(hoodBtn);
    expect(screen.getByText('Hood Off')).toBeInTheDocument();
  });

  test('DressingRoom3D hides toggle-hood-mode-btn when no hooded garment is active', () => {
    render(
      <DressingRoom3D
        open={true}
        onOpenChange={jest.fn()}
        outfitItems={{
          top: {
            id: 'crew-test-1',
            name: 'White Crew T-Shirt',
            url: '/assets/onboarding/m_tshirt_crew_white.png',
            category: 'top',
          },
        }}
        measurements={sampleMeasurements}
        sex="male"
      />
    );

    expect(screen.queryByTestId('toggle-hood-mode-btn')).toBeNull();
  });

  test('All 13 locale files in web and i18n package define dressing_room_3d.hood_on and hood_off', () => {
    const fs = require('fs');
    const path = require('path');
    const langs = ['ar', 'de', 'en', 'es', 'fr', 'he', 'hi', 'it', 'ja', 'nl', 'pt', 'ru', 'zh'];

    for (const baseDir of [
      path.resolve(__dirname, '../../locales'),
      path.resolve(__dirname, '../../../../../packages/i18n/locales'),
    ]) {
      for (const lang of langs) {
        const data = JSON.parse(fs.readFileSync(path.join(baseDir, `${lang}.json`), 'utf8'));
        expect(typeof data.dressing_room_3d?.hood_on).toBe('string');
        expect(data.dressing_room_3d.hood_on.length).toBeGreaterThan(0);
        expect(typeof data.dressing_room_3d?.hood_off).toBe('string');
        expect(data.dressing_room_3d.hood_off.length).toBeGreaterThan(0);
      }
      const en = JSON.parse(fs.readFileSync(path.join(baseDir, 'en.json'), 'utf8'));
      const he = JSON.parse(fs.readFileSync(path.join(baseDir, 'he.json'), 'utf8'));
      expect(en.dressing_room_3d.hood_on).toBe('Hood On');
      expect(en.dressing_room_3d.hood_off).toBe('Hood Off');
      expect(he.dressing_room_3d.hood_on).toBe('כובע חבוש');
      expect(he.dressing_room_3d.hood_off).toBe('כובע מקופל');
    }
  });
});
