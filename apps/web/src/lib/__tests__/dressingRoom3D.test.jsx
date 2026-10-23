import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
    i18n: { dir: () => 'ltr', changeLanguage: () => new Promise(() => {}) },
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/stylist' }),
}));

// Mock auth hook
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

// Mock framer-motion
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

import DressingRoom3D from '@/components/DressingRoom3D';
import AvatarMesh3D from '@/components/AvatarMesh3D';
import GarmentMesh3D from '@/components/GarmentMesh3D';
import AvatarViewer2D from '@/components/AvatarViewer2D';

// Mock Three.js Canvas and WebGL contexts for testing environment
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="mock-three-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: jest.fn(), lerp: jest.fn(), distanceTo: () => 0.01 },
    },
  }),
  useFrame: (cb) => {
    // optional frame runner
  },
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

describe('3D Try-On Dressing Room Unit Tests', () => {
  const sampleOutfitItems = {
    top: {
      id: 'top-101',
      name: 'Classic White Linen Shirt',
      url: 'https://example.com/shirt.png',
      category: 'top',
      sub_category: 'shirt',
    },
    bottom: {
      id: 'bottom-202',
      name: 'Indigo Slim-Fit Jeans',
      url: 'https://example.com/jeans.png',
      category: 'bottom',
      sub_category: 'jeans',
    },
    shoes: {
      id: 'shoe-303',
      name: 'Minimalist White Sneakers',
      url: 'https://example.com/sneakers.png',
      category: 'shoes',
      sub_category: 'sneakers',
    },
  };

  const sampleMeasurements = {
    height: 172,
    shoulders: 41,
    chest: 92,
    waist: 74,
    hip: 98,
    inseam: 79,
    gender: 'female',
  };

  test('DressingRoom3D mounts dialog with 3D studio, camera presets, and active garment rack', () => {
    render(
      <DressingRoom3D
        open={true}
        onOpenChange={jest.fn()}
        outfit={{ name: 'Summer Chic Riviera' }}
        outfitItems={sampleOutfitItems}
        measurements={sampleMeasurements}
        sex="female"
        skinColor="#E0AC69"
        hair={{ length: 'medium', type: 'straight', color: 'Brunette', style: 'Karre' }}
      />
    );

    expect(screen.getByTestId('dressing-room-3d-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('mock-three-canvas')).toBeInTheDocument();
    expect(screen.getByText('Summer Chic Riviera')).toBeInTheDocument();

    // Verify garment rack items
    expect(screen.getByText('Classic White Linen Shirt')).toBeInTheDocument();
    expect(screen.getByText('Indigo Slim-Fit Jeans')).toBeInTheDocument();
    expect(screen.getByText('Minimalist White Sneakers')).toBeInTheDocument();
  });

  test('DressingRoom3D camera controls trigger view presets and auto-rotate turnaround', () => {
    render(
      <DressingRoom3D
        open={true}
        onOpenChange={jest.fn()}
        outfitItems={sampleOutfitItems}
        measurements={sampleMeasurements}
      />
    );

    const fullBtn = screen.getByTitle('Full Body');
    const upperBtn = screen.getByTitle('Upper Body');
    const lowerBtn = screen.getByTitle('Lower Body');
    const rotateBtn = screen.getByTitle('360° Rotate');
    const resetBtn = screen.getByTitle('Reset View');

    expect(fullBtn).toBeInTheDocument();
    expect(upperBtn).toBeInTheDocument();
    expect(lowerBtn).toBeInTheDocument();
    expect(rotateBtn).toBeInTheDocument();
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(upperBtn);
    fireEvent.click(rotateBtn);
    fireEvent.click(resetBtn);
  });

  test('Garment layer visibility toggling in DressingRoom3D hides and shows items', () => {
    render(
      <DressingRoom3D
        open={true}
        onOpenChange={jest.fn()}
        outfitItems={sampleOutfitItems}
        measurements={sampleMeasurements}
      />
    );

    const hideButtons = screen.getAllByTitle('Hide item');
    expect(hideButtons.length).toBeGreaterThanOrEqual(1);

    // Toggle off the first item
    fireEvent.click(hideButtons[0]);
    expect(screen.getByTitle('Show item')).toBeInTheDocument();
  });

  test('Clicking an item card in Outfit Layers triggers navigation or custom onItemClick', () => {
    mockNavigate.mockClear();
    const handleItemClickMock = jest.fn();
    const onOpenChangeMock = jest.fn();

    // Render with custom onItemClick
    const { rerender } = render(
      <DressingRoom3D
        open={true}
        onOpenChange={onOpenChangeMock}
        outfitItems={sampleOutfitItems}
        measurements={sampleMeasurements}
        onItemClick={handleItemClickMock}
      />
    );

    const topItemCard = screen.getByTestId('rack-item-top');
    expect(topItemCard).toBeInTheDocument();
    fireEvent.click(topItemCard);
    expect(handleItemClickMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'top-101', name: 'Classic White Linen Shirt' })
    );

    // Rerender without onItemClick -> verifies fallback to navigate('/closet/:id')
    rerender(
      <DressingRoom3D
        open={true}
        onOpenChange={onOpenChangeMock}
        outfitItems={sampleOutfitItems}
        measurements={sampleMeasurements}
      />
    );

    const bottomItemCard = screen.getByTestId('rack-item-bottom');
    fireEvent.click(bottomItemCard);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith('/closet/bottom-202');
  });

  test('GarmentMesh3D anatomical geometry builders generate valid non-empty geometry', () => {
    const {
      getTorsoSlice,
      getLegSlice,
      createAnatomicalTorsoGeometry,
      createAnatomicalBottomGeometry,
      createAnatomicalFootwearGeometry,
    } = require('@/components/GarmentMesh3D');

    // 1. Torso slice interpolation at bust and waist
    const femaleBust = getTorsoSlice(1.22, false);
    expect(femaleBust.rx).toBeGreaterThan(0.18);
    expect(femaleBust.cz).toBeGreaterThan(0.04); // bust reaches forward

    const maleChest = getTorsoSlice(1.30, true);
    expect(maleChest.rx).toBeGreaterThan(0.21);

    // 2. Leg slice interpolation at crotch and ankle
    const legCrotch = getLegSlice(0.80, false);
    const legAnkle = getLegSlice(0.08, false);
    expect(legAnkle.cx).toBeGreaterThan(legCrotch.cx); // A-stance widening

    // 3. Torso geometry (top / outerwear / dress)
    const torsoGeo = createAnatomicalTorsoGeometry({ isMale: false, yTop: 1.38, yBottom: 0.96 });
    expect(torsoGeo.getAttribute('position').count).toBeGreaterThan(100);
    expect(torsoGeo.getAttribute('uv').count).toBeGreaterThan(100);
    expect(torsoGeo.getIndex().count).toBeGreaterThan(200);

    // 4. Pants bottom geometry
    const pantsGeo = createAnatomicalBottomGeometry({ isMale: false, isSkirt: false });
    expect(pantsGeo.getAttribute('position').count).toBeGreaterThan(150);

    // 5. Skirt bottom geometry
    const skirtGeo = createAnatomicalBottomGeometry({ isMale: false, isSkirt: true });
    expect(skirtGeo.getAttribute('position').count).toBeGreaterThan(150);

    // 6. Footwear geometry
    const footGeo = createAnatomicalFootwearGeometry({ isMale: false });
    expect(footGeo.getAttribute('position').count).toBeGreaterThan(80);
  });

  test('AvatarViewer2D renders 3D Try-On button when interactive is true and opens modal', async () => {
    render(
      <AvatarViewer2D
        interactive={true}
        enable3DTryOn={true}
        outfitItems={sampleOutfitItems}
        measurements={sampleMeasurements}
      />
    );

    const openBtn = screen.getByTestId('open-dressing-room-3d-btn');
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(await screen.findByTestId('dressing-room-3d-dialog')).toBeInTheDocument();
  });

  test('Locale JSON files all contain required dressing_room_3d keys', () => {
    const fs = require('fs');
    const path = require('path');
    const localesDir = path.resolve(__dirname, '../../locales');
    const langCodes = ['en', 'he', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'nl', 'pt', 'ru', 'zh'];

    const requiredKeys = [
      'title',
      'subtitle',
      'open_button',
      'default_outfit',
      'full_body',
      'upper_body',
      'lower_body',
      'auto_rotate',
      'reset_view',
      'drag_hint',
      'garments',
      'view_item_details',
      'hide_item',
      'show_item',
      'fullscreen',
      'exit_fullscreen',
    ];

    langCodes.forEach((lang) => {
      const file = path.join(localesDir, `${lang}.json`);
      expect(fs.existsSync(file)).toBe(true);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(data.dressing_room_3d).toBeDefined();
      requiredKeys.forEach((key) => {
        expect(data.dressing_room_3d[key]).toBeTruthy();
      });

      // Verify dressingRoom namespace for 3D switches in closet, add-item, and item-detail
      expect(data.dressingRoom).toBeDefined();
      expect(data.dressingRoom.title).toBeTruthy();
      expect(data.dressingRoom.tryOn3D).toBeTruthy();
      expect(data.dressingRoom.badge3D).toBeTruthy();
    });
  });

  test('normalizeGarmentRole accurately maps localized categories and cultural garments across languages', () => {
    const { normalizeGarmentRole, TORSO_PROFILE_FEMALE, TORSO_PROFILE_MALE } = require('@/components/GarmentMesh3D');

    // 1. Hebrew canonical taxonomy
    expect(normalizeGarmentRole('item_0', 'חלק עליון', '')).toBe('top');
    expect(normalizeGarmentRole('item_1', 'חלק תחתון', '')).toBe('bottom');
    expect(normalizeGarmentRole('item_2', 'מעיל', '')).toBe('outerwear');
    expect(normalizeGarmentRole('item_2', 'בלייזר', '')).toBe('outerwear');
    expect(normalizeGarmentRole('item_3', 'חלק שלם', '')).toBe('dress');
    expect(normalizeGarmentRole('item_3', 'שמלה', '')).toBe('dress');
    expect(normalizeGarmentRole('item_4', 'הנעלה', '')).toBe('shoes');
    expect(normalizeGarmentRole('item_4', 'נעליים', '')).toBe('shoes');

    // 2. Arabic canonical taxonomy
    expect(normalizeGarmentRole('item_0', 'قطعة علوية', '')).toBe('top');
    expect(normalizeGarmentRole('item_1', 'قطعة سفلية', '')).toBe('bottom');
    expect(normalizeGarmentRole('item_2', 'ملابس خارجية', '')).toBe('outerwear');
    expect(normalizeGarmentRole('item_3', 'قطعة كاملة', '')).toBe('dress');
    expect(normalizeGarmentRole('item_3', 'فستان', '')).toBe('dress');
    expect(normalizeGarmentRole('item_4', 'أحذية', '')).toBe('shoes');

    // 3. German, French, Russian, Chinese canonical taxonomies
    expect(normalizeGarmentRole('item_0', 'Oberteil', '')).toBe('top');
    expect(normalizeGarmentRole('item_0', 'Haut', '')).toBe('top');
    expect(normalizeGarmentRole('item_0', 'Верх', '')).toBe('top');
    expect(normalizeGarmentRole('item_0', '上装', '')).toBe('top');

    expect(normalizeGarmentRole('item_1', 'Unterteil', '')).toBe('bottom');
    expect(normalizeGarmentRole('item_1', 'Bas', '')).toBe('bottom');
    expect(normalizeGarmentRole('item_1', 'Низ', '')).toBe('bottom');
    expect(normalizeGarmentRole('item_1', '下装', '')).toBe('bottom');

    // 4. Cultural attire
    expect(normalizeGarmentRole('item_0', 'cultural', 'Abaya')).toBe('dress');
    expect(normalizeGarmentRole('item_0', 'cultural', 'Kaftan')).toBe('dress');
    expect(normalizeGarmentRole('item_0', 'cultural', 'Saree')).toBe('dress');
    expect(normalizeGarmentRole('item_0', 'cultural', 'Thobe')).toBe('dress');
    expect(normalizeGarmentRole('item_0', 'cultural', 'Kurta')).toBe('top');

    // 5. Profile calibration checks: shoulders & collar heights
    const collarFemale = TORSO_PROFILE_FEMALE.find((p) => p.y >= 1.45);
    expect(collarFemale.y).toBeCloseTo(1.46, 2);
    const shoulderFemale = TORSO_PROFILE_FEMALE.find((p) => p.y === 1.36);
    expect(shoulderFemale.rx).toBeGreaterThanOrEqual(0.23);

    const collarMale = TORSO_PROFILE_MALE.find((p) => p.y >= 1.50);
    expect(collarMale.y).toBeCloseTo(1.52, 2);
    const shoulderMale = TORSO_PROFILE_MALE.find((p) => p.y === 1.42);
    expect(shoulderMale.rx).toBeGreaterThanOrEqual(0.25);
  });

  test('resolveEffectiveGarmentUrl resolves clean avatar overlay url for starter items', () => {
    const { resolveEffectiveGarmentUrl } = require('@/lib/itemImage');

    const starterItem = {
      id: 'w_blazer_suit_black',
      category: 'outerwear',
      image_url: '/assets/onboarding/w_blazer_suit_black_cutout.png',
    };
    expect(resolveEffectiveGarmentUrl(starterItem)).toBe('/assets/onboarding/w_blazer_suit_black.png');

    const itemWithOverlay = {
      id: 'item-custom-1',
      avatar_overlay_url: 'https://example.com/clean.png',
      image_url: 'https://example.com/raw.png',
    };
    expect(resolveEffectiveGarmentUrl(itemWithOverlay)).toBe('https://example.com/clean.png');
  });

  test('detectSleeveStyle accurately distinguishes T-shirts, long sleeves, and sleeveless items', () => {
    const { detectSleeveStyle, createAnatomicalTopGeometry } = require('@/components/GarmentMesh3D');

    // 1. T-shirts & short sleeves in Hebrew and English
    const hebrewTShirt = detectSleeveStyle({ garmentText: 'חולצת טריקו שחורה מחוייטת מכונת ריצה', rawSlot: 'top' });
    expect(hebrewTShirt.type).toBe('short');
    expect(hebrewTShirt.factor).toBeCloseTo(0.36, 2);

    const englishTShirt = detectSleeveStyle({ garmentText: 'Nike Dri-FIT Running T-Shirt', rawSlot: 'top' });
    expect(englishTShirt.type).toBe('short');
    expect(englishTShirt.factor).toBeCloseTo(0.36, 2);

    const poloShirt = detectSleeveStyle({ garmentText: 'Classic Pique Polo Shirt', rawSlot: 'top' });
    expect(poloShirt.type).toBe('short');

    // 2. Sleeveless items
    const tankTop = detectSleeveStyle({ garmentText: 'Ribbed Tank Top', rawSlot: 'top' });
    expect(tankTop.type).toBe('sleeveless');
    expect(tankTop.factor).toBe(0.0);

    const hebrewTank = detectSleeveStyle({ garmentText: 'גופיית סבא מכותנה', rawSlot: 'top' });
    expect(hebrewTank.type).toBe('sleeveless');
    expect(hebrewTank.factor).toBe(0.0);

    // 3. Long sleeves & outerwear
    const blazer = detectSleeveStyle({ garmentText: 'Tailored Wool Blazer', rawSlot: 'outerwear' });
    expect(blazer.type).toBe('long');
    expect(blazer.factor).toBe(1.0);

    const hebrewSweater = detectSleeveStyle({ garmentText: 'סוודר קשמיר שחור', rawSlot: 'top' });
    expect(hebrewSweater.type).toBe('long');
    expect(hebrewSweater.factor).toBe(1.0);

    // 4. Geometry creation test: short sleeve vs long sleeve arm boundary
    const shortSleeveGeo = createAnatomicalTopGeometry({ isMale: false, hasSleeves: true, sleeveFactor: 0.36 });
    const longSleeveGeo = createAnatomicalTopGeometry({ isMale: false, hasSleeves: true, sleeveFactor: 1.0 });
    const sleevelessGeo = createAnatomicalTopGeometry({ isMale: false, hasSleeves: false, sleeveFactor: 0.0 });

    expect(shortSleeveGeo.getAttribute('position').count).toBeGreaterThan(sleevelessGeo.getAttribute('position').count);

    // Find the minimum y position in the sleeve geometry (vertices after torso shell)
    const getMinArmY = (geo) => {
      const pos = geo.getAttribute('position').array;
      // Torso mesh has (20 + 1) * (28 + 1) = 609 vertices = 1827 floats
      const sleeveStartIdx = 21 * 29 * 3;
      let minY = 999;
      for (let i = sleeveStartIdx; i < pos.length; i += 3) {
        const y = pos[i + 1];
        if (y < minY) {
          minY = y;
        }
      }
      return minY;
    };

    const minShortY = getMinArmY(shortSleeveGeo);
    const minLongY = getMinArmY(longSleeveGeo);

    // Short sleeve ends around mid-bicep (y ~ 1.23m) well above elbow (1.16m)
    expect(minShortY).toBeGreaterThan(1.20);
    expect(minShortY).toBeLessThan(1.26);

    // Long sleeve extends all the way down to wrist (y ~ 0.90m)
    expect(minLongY).toBeCloseTo(0.90, 1);
  });
});
