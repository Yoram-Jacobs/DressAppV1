import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DynamicAvatar, {
  computeMorphInfluences,
  resolveHairProperties,
  getDefaultAvatarHair,
} from '@/components/DynamicAvatar';
import { useProfileForm } from '@/components/profile/useProfileForm';
import { renderHook, act } from '@testing-library/react';
import AvatarViewer from '@/components/AvatarViewer';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
    i18n: { changeLanguage: () => new Promise(() => {}) },
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

// Mock Three.js & @react-three/fiber for JSDOM unit testing
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="mock-webgl-canvas">{children}</div>,
  useThree: () => ({
    gl: {
      setSize: jest.fn(),
      setClearColor: jest.fn(),
      clear: jest.fn(),
      render: jest.fn(),
      domElement: { toDataURL: () => 'data:image/png;base64,mock' },
    },
    scene: {},
    camera: {
      isOrthographicCamera: true,
      position: { set: jest.fn() },
      lookAt: jest.fn(),
      updateProjectionMatrix: jest.fn(),
    },
  }),
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
                name: 'skin_mat',
                color: { copy: jest.fn(), set: jest.fn() },
                clone: () => ({
                  name: 'skin_mat',
                  color: { copy: jest.fn(), set: jest.fn() },
                }),
              },
              morphTargetDictionary: { tall: 0 },
              morphTargetInfluences: [0],
            });
          },
        }),
      },
    }),
    {
      preload: jest.fn(),
    }
  ),
}));

describe('DynamicAvatar & AvatarViewer old avatar removal', () => {
  test('DynamicAvatar mounts and renders 3D avatar container', () => {
    const { container } = render(
      <DynamicAvatar
        height={175}
        shoulders={42}
        chest={92}
        waist={74}
        hip={98}
        gender="female"
        interactive={true}
      />
    );

    const avatarRoot = screen.getByTestId('dynamic-3d-avatar');
    expect(avatarRoot).toBeInTheDocument();
    expect(avatarRoot).toHaveAttribute('data-gender', 'female');

    // Verify the old 2D SVG silhouette paths (bodyPath, armPath, headPath) are completely gone
    const svgPaths = container.querySelectorAll('svg path');
    svgPaths.forEach((path) => {
      const d = path.getAttribute('d') || '';
      expect(d).not.toContain('M 100,');
    });
  });

  test('Modifying properties rerenders smoothly without old avatar flicker or regression', () => {
    const { rerender, container } = render(
      <DynamicAvatar
        height={165}
        waist={68}
        chest={86}
        gender="female"
        interactive={true}
      />
    );

    // Modify height and waist (simulating user dragging sliders)
    rerender(
      <DynamicAvatar
        height={180}
        waist={80}
        chest={98}
        gender="female"
        interactive={true}
      />
    );

    const avatarRoot = screen.getByTestId('dynamic-3d-avatar');
    expect(avatarRoot).toBeInTheDocument();

    // Verify no old mannequin SVG group exists
    const oldMannequinGroup = container.querySelector('g[stroke="rgba(15, 23, 42, 0.18)"]');
    expect(oldMannequinGroup).toBeNull();
  });

  test('AvatarViewer accepts interactive prop and passes through cleanly', () => {
    render(
      <AvatarViewer
        measurements={{ height: 170, waist: 72, chest: 90, shoulders: 40 }}
        sex="male"
        interactive={true}
      />
    );

    const avatarRoot = screen.getByTestId('dynamic-3d-avatar');
    expect(avatarRoot).toBeInTheDocument();
    expect(avatarRoot).toHaveAttribute('data-gender', 'male');
  });

  test('computeMorphInfluences accurately calculates morph weights', () => {
    const morphs = computeMorphInfluences({
      height: 190,
      shoulders: 48,
      chest: 108,
      waist: 90,
      hip: 104,
      armLength: 70,
      inseam: 88,
      isMale: true,
    });

    expect(morphs.tall).toBeGreaterThan(0);
    expect(morphs.short).toBe(0);
    expect(morphs.shoulders_wide).toBeGreaterThan(0);
  });

  test('resolveHairProperties & computeMorphInfluences map hair length, type, style, and color', () => {
    const blondeLongWavy = resolveHairProperties(
      { length: 'long', type: 'wavy', color: 'Golden Blonde', style: 'Layered Waves' },
      false
    );
    expect(blondeLongWavy.color).toBe('#D4AF6A');
    expect(blondeLongWavy.morphs.hair_long).toBe(1);
    expect(blondeLongWavy.morphs.hair_wavy).toBe(1);
    expect(blondeLongWavy.morphs.hair_volume).toBeGreaterThan(0.8);

    const blackShortCurlyBun = resolveHairProperties(
      { length: 'short', type: 'curly', color: 'Jet Black', style: 'High Bun Updo' },
      false
    );
    expect(blackShortCurlyBun.color).toBe('#110E0D');
    expect(blackShortCurlyBun.morphs.hair_curly).toBe(1);
    expect(blackShortCurlyBun.morphs.hair_updo).toBe(1);
    expect(blackShortCurlyBun.morphs.hair_long).toBe(0);

    const maleBuzzCoily = computeMorphInfluences({
      height: 180,
      isMale: true,
      hair: { length: 'short', type: 'coily', color: '#222222', style: 'Buzz Fade' },
    });
    expect(maleBuzzCoily.hair_short).toBeGreaterThanOrEqual(1);
    expect(maleBuzzCoily.hair_coily).toBe(1);
  });

  test('useProfileForm defaults Hair & Grooming properties to the avatar default characteristics', () => {
    const { result } = renderHook(() => useProfileForm({ sex: 'female' }));
    expect(result.current.form.hair).toEqual({
      length: 'medium',
      type: 'straight',
      color: 'Brunette',
      style: 'Karre',
    });

    const femaleResolved = resolveHairProperties(result.current.form.hair, false);
    expect(femaleResolved.color).toBe('#3B2316');
    expect(Object.values(femaleResolved.morphs).every((v) => v === 0)).toBe(true);

    // Switching gender to male updates default hair automatically
    act(() => {
      result.current.setField('sex', 'male');
    });
    expect(result.current.form.hair).toEqual(getDefaultAvatarHair('male'));

    const maleResolved = resolveHairProperties(result.current.form.hair, true);
    expect(maleResolved.color).toBe('#181412');
    expect(Object.values(maleResolved.morphs).every((v) => v === 0)).toBe(true);
  });
});
