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
    });
  });
});
