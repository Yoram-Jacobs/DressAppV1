import '@testing-library/jest-dom';
import { compareSizes, checkListingFit } from '../fitCompatibility';
import { deriveSizeFromPreferences } from '../size_preferences';

jest.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useFrame: jest.fn(),
  useThree: () => ({}),
}));

jest.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: { clone: () => ({ traverse: () => {} }) } }), { preload: jest.fn() }),
}));

jest.mock('three', () => ({
  Color: function Color() {},
}));

import { getFullAvatarAnatomy } from '../../components/DynamicAvatar';

describe('P1 Sizing, Fit Compatibility & 2D ANSUR II Calibration', () => {
  test('BUG-ML-05: compareSizes handles EU/US footwear conversion, M/L ranges, composite labels, and Hebrew categories', () => {
    expect(compareSizes('EU 42', 'US 9', 'Footwear')).toEqual({ match: true, difference: 'exact' });
    expect(compareSizes('42', '9', 'shoes')).toEqual({ match: true, difference: 'exact' });
    expect(compareSizes('EU 44', 'US 9', 'Footwear')).toEqual({ match: false, difference: 'too_large' });
    expect(compareSizes('M/L', 'M', 'Top')).toEqual({ match: true, difference: 'exact' });
    expect(compareSizes('M/L', 'XS', 'Top')).toEqual({ match: false, difference: 'too_large' });
    expect(compareSizes('M', '6 / M', 'Dress')).toEqual({ match: true, difference: 'exact' });

    const user = {
      sex: 'male',
      body_measurements: { shirt_size: 'M', shoe_size_us: '9' },
    };
    expect(deriveSizeFromPreferences(user, { category: 'חלק עליון' })).toBe('M');
    expect(deriveSizeFromPreferences(user, { category: 'Footwear' })).toBe('9');
    const fit = checkListingFit({ category: 'חלק עליון', size: 'M/L', gender: 'men' }, user);
    expect(fit.isCompatible).toBe(true);
    expect(fit.hasSizeMismatch).toBe(false);
  });

  test('BUG-2D-01: getFullAvatarAnatomy uses ANSUR II calibrated chest & hip breadths', () => {
    const maleAnat = getFullAvatarAnatomy({
      height: 178,
      shoulders: 42,
      chest: 100,
      waist: 88,
      hip: 96,
      gender: 'male',
    });
    expect(maleAnat.wChest).toBeGreaterThan(26.5);
    expect(maleAnat.wChest).toBeLessThan(29.8);
    expect(maleAnat.wHip).toBeGreaterThan(31.5);
    expect(maleAnat.wHip).toBeLessThan(34.5);

    const femaleAnat = getFullAvatarAnatomy({
      height: 165,
      shoulders: 37,
      chest: 89,
      waist: 74,
      hip: 96.5,
      gender: 'female',
    });
    expect(femaleAnat.wChest).toBeGreaterThan(25.0);
    expect(femaleAnat.wChest).toBeLessThan(27.5);
    expect(femaleAnat.wHip).toBeGreaterThan(32.5);
    expect(femaleAnat.wHip).toBeLessThan(35.0);
  });
});
