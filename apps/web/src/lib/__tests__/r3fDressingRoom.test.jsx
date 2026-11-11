import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import * as THREE from 'three';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
    i18n: { language: 'en', dir: () => 'ltr', changeLanguage: () => Promise.resolve() },
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {},
  userStore: {
    get: () => null,
    subscribe: () => () => {},
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/lib/closetStore', () => {
  const emptySnapshot = Object.freeze({ items: [] });
  return {
    closetStore: {
      subscribe: () => () => {},
      getSnapshot: () => emptySnapshot,
    },
  };
});

var mockCanvasProps;
var mockOrbitProps;
var mockShadowProps;
var mockUseGltfCalls;
var mockPreloadCalls;
var mockDisposedObjects;
var mockGltfFixtureCache;

function mockCreateMeshWithMorphs() {
  const geoDispose = () => (mockDisposedObjects ||= []).push('geometry');
  const matDispose = () => (mockDisposedObjects ||= []).push('material');

  const THREE_REQ = require('three');
  const geometry = new THREE_REQ.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE_REQ.BufferAttribute(
      new Float32Array([
        -0.2, 0.9, 0.1,
        0.2, 0.9, 0.1,
        0.0, 1.4, 0.1,
        0.0, 1.4, -0.1,
      ]),
      3
    )
  );
  geometry.setAttribute(
    'uv',
    new THREE_REQ.BufferAttribute(
      new Float32Array([
        0, 1,
        1, 1,
        0.5, 0,
        0.5, 0,
      ]),
      2
    )
  );
  const origGeoClone = geometry.clone.bind(geometry);
  geometry.clone = () => {
    const c = origGeoClone();
    c.dispose = geoDispose;
    return c;
  };

  const material = new THREE_REQ.MeshStandardMaterial({ name: 'fabric' });
  const origMatClone = material.clone.bind(material);
  material.clone = () => {
    const cm = origMatClone();
    cm.dispose = matDispose;
    return cm;
  };

  const mesh = new THREE_REQ.Mesh(geometry, material);
  mesh.morphTargetDictionary = {
    chest_circ: 0,
    waist_circ: 1,
    hip_circ: 2,
    inseam: 3,
    unused_key: 4,
  };
  mesh.morphTargetInfluences = [0.99, 0.99, 0.99, 0.99, 0.88];

  const scene = new THREE_REQ.Group();
  scene.add(mesh);
  return { scene, geoDispose, matDispose };
}

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children, gl, camera }) => {
    (mockCanvasProps ||= []).push({ gl, camera });
    return <div data-testid="mock-r3f-canvas">{children}</div>;
  },
  useThree: () => ({
    camera: {
      position: {
        x: 0,
        y: 1.2,
        z: 2.5,
        set: jest.fn(),
      },
    },
  }),
  useFrame: () => {},
}));

jest.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    (url, dracoPath) => {
      (mockUseGltfCalls ||= []).push([url, dracoPath]);
      mockGltfFixtureCache ||= new Map();
      if (!mockGltfFixtureCache.has(url)) {
        mockGltfFixtureCache.set(url, mockCreateMeshWithMorphs());
      }
      return mockGltfFixtureCache.get(url);
    },
    {
      preload: (url, dracoPath) => {
        (mockPreloadCalls ||= []).push([url, dracoPath]);
      },
      clear: () => {},
    }
  ),
  useTexture: (url) => {
    const THREE_REQ = require('three');
    const tex = new THREE_REQ.Texture();
    tex.name = url;
    const origClone = tex.clone.bind(tex);
    tex.clone = () => {
      const ct = origClone();
      ct.dispose = () => (mockDisposedObjects ||= []).push(`texture:${url}`);
      return ct;
    };
    return tex;
  },
  OrbitControls: (props) => {
    (mockOrbitProps ||= []).push(props);
    return <div data-testid="mock-r3f-orbit-controls" />;
  },
  ContactShadows: (props) => {
    (mockShadowProps ||= []).push(props);
    return <div data-testid="mock-r3f-contact-shadows" />;
  },
  Html: ({ children }) => <div data-testid="mock-drei-html">{children}</div>,
}));

import {
  useDressingRoomStore,
  DRACO_DECODER_PATH,
  DEFAULT_BODY_METRICS,
  DressingRoomCanvas,
  DressingRoomView,
  GarmentMesh,
  applyBodyMetricsToMorphTargets,
  applyLayerAntiZFighting,
  synthesizeBackFabricData,
  partitionGarmentGeometryFrontBack,
} from '@/components/dressing-room';

describe('Production R3F 3D Dressing Room Suite', () => {
  beforeEach(() => {
    (mockCanvasProps ||= []).length = 0;
    (mockOrbitProps ||= []).length = 0;
    (mockShadowProps ||= []).length = 0;
    (mockUseGltfCalls ||= []).length = 0;
    (mockPreloadCalls ||= []).length = 0;
    (mockDisposedObjects ||= []).length = 0;

    const store = useDressingRoomStore.getState();
    store.setAvatarGender('female');
    store.resetBodyMetrics();
    store.clearOutfit();
    store.setCameraPreset('full');
  });

  test('useDressingRoomStore manages gender, clamped [0..1] bodyMetrics, outfit slots, and texture swaps', () => {
    const store = useDressingRoomStore.getState();
    expect(store.avatarGender).toBe('female');
    expect(store.bodyMetrics).toEqual(DEFAULT_BODY_METRICS);

    store.updateBodyMetric('chest_circ', 1.4);
    store.updateBodyMetric('waist_circ', -0.2);
    store.updateBodyMetric('hip_circ', 0.72);
    expect(useDressingRoomStore.getState().bodyMetrics).toEqual({
      chest_circ: 1,
      waist_circ: 0,
      hip_circ: 0.72,
      inseam: 0.5,
    });

    store.slotGarment('top', {
      id: 'tee-1',
      glbUrl: '/models/templates/female/top_tshirt.glb',
      textureUrl: '/assets/onboarding/w_tshirt_white_crew_cutout.png',
      layer: 1,
    });
    store.slotGarment('outerwear', {
      id: 'blazer-1',
      glbUrl: '/models/templates/female/jacket_blazer.glb',
      textureUrl: '/assets/onboarding/w_blazer_suit_black_cutout.png',
      layer: 2,
    });

    expect(useDressingRoomStore.getState().activeOutfit.top.layer).toBe(1);
    expect(useDressingRoomStore.getState().activeOutfit.outerwear.layer).toBe(2);
    expect(mockPreloadCalls).toContainEqual([
      '/models/templates/female/top_tshirt.glb',
      DRACO_DECODER_PATH,
    ]);

    store.swapGarmentTexture('top', '/assets/onboarding/w_tshirt_black_fitted_cutout.png');
    expect(useDressingRoomStore.getState().activeOutfit.top.textureUrl).toBe(
      '/assets/onboarding/w_tshirt_black_fitted_cutout.png'
    );

    store.setAvatarGender('male');
    expect(useDressingRoomStore.getState().avatarGender).toBe('male');
    expect(useDressingRoomStore.getState().activeOutfit.top.glbUrl).toBe(
      '/models/templates/male/top_tshirt.glb'
    );

    store.unslotGarment('top');
    expect(useDressingRoomStore.getState().activeOutfit.top).toBeNull();
  });

  test('applyBodyMetricsToMorphTargets maps bodyMetrics with defensive zero-fallbacks and MBLab bridge', () => {
    const ansurMesh = {
      morphTargetDictionary: {
        chest_circ: 0,
        waist_circ: 1,
        hip_circ: 2,
        inseam: 3,
        stale_morph: 4,
      },
      morphTargetInfluences: [0, 0, 0, 0, 0.95],
    };

    applyBodyMetricsToMorphTargets(ansurMesh, {
      chest_circ: 0.8,
      waist_circ: 0.35,
      hip_circ: NaN,
    });

    expect(ansurMesh.morphTargetInfluences[0]).toBeCloseTo(0.8);
    expect(ansurMesh.morphTargetInfluences[1]).toBeCloseTo(0.35);
    expect(ansurMesh.morphTargetInfluences[2]).toBe(0); // defensive NaN fallback
    expect(ansurMesh.morphTargetInfluences[3]).toBe(0); // defensive missing-key fallback
    expect(ansurMesh.morphTargetInfluences[4]).toBe(0); // stale target zeroed

    const mblabMesh = {
      morphTargetDictionary: {
        busty: 0,
        waist_thick: 1,
        waist_thin: 2,
        hips_wide: 3,
        legs_long: 4,
        hair_long: 5,
      },
      morphTargetInfluences: [0, 0, 0, 0, 0, 0.75],
    };

    applyBodyMetricsToMorphTargets(mblabMesh, {
      chest_circ: 0.75,
      waist_circ: 0.25,
      hip_circ: 0.9,
      inseam: 0.7,
    });

    expect(mblabMesh.morphTargetInfluences[0]).toBeCloseTo(0.5); // busty
    expect(mblabMesh.morphTargetInfluences[1]).toBe(0); // waist_thick
    expect(mblabMesh.morphTargetInfluences[2]).toBeCloseTo(0.5); // waist_thin
    expect(mblabMesh.morphTargetInfluences[3]).toBeCloseTo(0.8); // hips_wide
    expect(mblabMesh.morphTargetInfluences[4]).toBeCloseTo(0.4); // legs_long
    expect(mblabMesh.morphTargetInfluences[5]).toBeCloseTo(0.75); // hair morph preserved
  });

  test('applyLayerAntiZFighting enforces renderOrder and polygonOffset protocol', () => {
    const baseMesh = {
      renderOrder: 99,
      material: new THREE.MeshStandardMaterial(),
    };
    applyLayerAntiZFighting(baseMesh, 0);
    expect(baseMesh.renderOrder).toBe(0);
    expect(baseMesh.material.polygonOffset).toBe(false);
    expect(baseMesh.material.depthWrite).toBe(true);

    const outerMesh = {
      renderOrder: 0,
      material: new THREE.MeshStandardMaterial(),
    };
    applyLayerAntiZFighting(outerMesh, 2);
    expect(outerMesh.renderOrder).toBe(2);
    expect(outerMesh.material.polygonOffset).toBe(true);
    expect(outerMesh.material.polygonOffsetFactor).toBe(-2);
    expect(outerMesh.material.polygonOffsetUnits).toBe(-2);
    expect(outerMesh.material.depthWrite).toBe(true);
  });

  test('GarmentMesh loads via /draco/, applies SRGB flipY=false textures, and disposes GPU resources on swap & unmount', () => {
    const { rerender, unmount } = render(
      <GarmentMesh
        glbUrl="/models/templates/female/jacket_blazer.glb"
        textureUrl="/tex/diffuse_v1.png"
        layer={2}
        slot="outerwear"
        bodyMetrics={{ chest_circ: 0.7, waist_circ: 0.6, hip_circ: 0.5, inseam: 0.5 }}
      />
    );

    expect(mockUseGltfCalls).toContainEqual([
      '/models/templates/female/jacket_blazer.glb',
      '/draco/',
    ]);

    // Swap texture dynamically -> old texture must be disposed immediately
    rerender(
      <GarmentMesh
        glbUrl="/models/templates/female/jacket_blazer.glb"
        textureUrl="/tex/diffuse_v2.png"
        layer={2}
        slot="outerwear"
        bodyMetrics={{ chest_circ: 0.7, waist_circ: 0.6, hip_circ: 0.5, inseam: 0.5 }}
      />
    );

    expect(mockDisposedObjects).toContain('texture:/tex/diffuse_v1.png');

    // Unmount (unslot) -> active texture, cloned geometry, and cloned material must all dispose
    unmount();
    expect(mockDisposedObjects).toContain('texture:/tex/diffuse_v2.png');
    expect(mockDisposedObjects).toContain('geometry');
    expect(mockDisposedObjects).toContain('material');
  });

  test('DressingRoomCanvas configures WebGL, camera, ContactShadows, and OrbitControls constraints', () => {
    render(<DressingRoomCanvas />);

    expect(mockCanvasProps[0].gl).toEqual({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    expect(mockCanvasProps[0].camera).toEqual({
      position: [0, 1.2, 2.5],
      fov: 45,
    });

    expect(mockShadowProps[0]).toMatchObject({
      position: [0, 0, 0],
      opacity: 0.6,
      scale: 10,
      blur: 1.5,
      far: 1,
    });

    expect(mockOrbitProps[0]).toMatchObject({
      dampingFactor: 0.05,
      minDistance: 1.0,
      maxDistance: 4.0,
      minPolarAngle: Math.PI / 4,
      maxPolarAngle: Math.PI / 2,
      target: [0, 0.9, 0],
    });
  });

  test('DressingRoomView wires camera presets, morph sliders, and garment rack slotting/swapping', () => {
    render(<DressingRoomView />);

    expect(screen.getByTestId('dressing-room-view')).toBeInTheDocument();

    // Camera preset buttons
    fireEvent.click(screen.getByTestId('camera-preset-shoes'));
    expect(useDressingRoomStore.getState().cameraPreset).toBe('shoes');

    fireEvent.click(screen.getByTestId('camera-preset-close_up'));
    expect(useDressingRoomStore.getState().cameraPreset).toBe('close_up');

    // Morph slider updates bodyMetrics directly
    const chestSlider = screen.getByTestId('morph-slider-chest_circ');
    fireEvent.change(chestSlider, { target: { value: '0.82' } });
    expect(useDressingRoomStore.getState().bodyMetrics.chest_circ).toBeCloseTo(0.82);
    expect(screen.getByTestId('morph-value-chest_circ')).toHaveTextContent('0.82');

    // Slot starter garment from rack
    fireEvent.click(screen.getByTestId('slot-action-starter-f-top-white-tee'));
    expect(useDressingRoomStore.getState().activeOutfit.top?.id).toBe('starter-f-top-white-tee');
    expect(screen.getByTestId('active-slot-count')).toHaveTextContent('1');

    // Swap texture swatch on slotted garment
    fireEvent.click(screen.getByTestId('swap-texture-starter-f-top-white-tee-1'));
    expect(useDressingRoomStore.getState().activeOutfit.top?.textureUrl).toBe(
      '/assets/onboarding/w_tshirt_black_fitted_cutout.png'
    );

    // Unslot garment
    fireEvent.click(screen.getByTestId('slot-action-starter-f-top-white-tee'));
    expect(useDressingRoomStore.getState().activeOutfit.top).toBeNull();
    expect(screen.getByTestId('active-slot-count')).toHaveTextContent('0');
  });

  test('synthesizeBackFabricData eliminates center closures, chest graphics/logos, and fills collar scoop', () => {
    const w = 64;
    const h = 64;
    const data = new Uint8Array(w * h * 4);

    // Fill with base fabric color [200, 180, 160, 255]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = 200;
        data[i + 1] = 180;
        data[i + 2] = 160;
        data[i + 3] = 255;
      }
    }

    // 1. Add center zipper line at x in [31, 32] down the torso (y in [12..50])
    for (let y = 12; y <= 50; y++) {
      for (let x = 31; x <= 32; x++) {
        const i = (y * w + x) * 4;
        data[i] = 20;
        data[i + 1] = 20;
        data[i + 2] = 20;
      }
    }

    // 2. Add high-contrast chest print/logo at x in [22..28], y in [20..30]
    for (let y = 20; y <= 30; y++) {
      for (let x = 22; x <= 28; x++) {
        const i = (y * w + x) * 4;
        data[i] = 250;
        data[i + 1] = 10;
        data[i + 2] = 10;
      }
    }

    // 3. Add neckline collar scoop at y in [2..8], x in [28..35]
    for (let y = 2; y <= 8; y++) {
      for (let x = 28; x <= 35; x++) {
        const i = (y * w + x) * 4;
        data[i] = 40;
        data[i + 1] = 30;
        data[i + 2] = 25;
      }
    }

    // Synthesize back fabric
    synthesizeBackFabricData(data, w, h);

    // Verify center zipper is eliminated (replaced with clean fabric, R close to ~200, not 20)
    const zipperSampleIdx = (30 * w + 31) * 4;
    expect(data[zipperSampleIdx]).toBeGreaterThan(160);

    // Verify chest logo is eliminated (R close to ~200, G close to ~180, not red [250, 10, 10])
    const logoSampleIdx = (25 * w + 25) * 4;
    expect(data[logoSampleIdx + 1]).toBeGreaterThan(150);

    // Verify collar scoop is filled
    const collarSampleIdx = (5 * w + 31) * 4;
    expect(data[collarSampleIdx]).toBeGreaterThan(160);
  });

  test('partitionGarmentGeometryFrontBack partitions triangles into anterior (group 0) and posterior (group 1) sets', () => {
    const geometry = new THREE.BufferGeometry();
    // 2 triangles: one front (+Z), one back (-Z)
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          // Front triangle: midZ = 0.08
          -0.1, 1.2, 0.08,
           0.1, 1.2, 0.08,
           0.0, 1.3, 0.08,
          // Back triangle: midZ = -0.08
          -0.1, 1.2, -0.08,
           0.1, 1.2, -0.08,
           0.0, 1.3, -0.08,
        ]),
        3
      )
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 3, 4, 5]), 1));

    partitionGarmentGeometryFrontBack(geometry, 'top', false);

    expect(geometry.groups.length).toBe(2);
    expect(geometry.groups[0].materialIndex).toBe(0); // Front material
    expect(geometry.groups[0].count).toBe(3);
    expect(geometry.groups[1].materialIndex).toBe(1); // Back material
    expect(geometry.groups[1].count).toBe(3);
  });
});
