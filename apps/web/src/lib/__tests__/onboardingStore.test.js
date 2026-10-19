import {
  ONBOARDING_STATIC_DATASET,
  WOMEN_ONBOARDING_DATASET,
  MEN_ONBOARDING_DATASET,
  ONBOARDING_DATASET_BY_ID,
} from '../onboardingDataset';
import {
  getStarterCapsuleForUser,
  validateStarterSelection,
  autoSelectStarterCapsule,
  assembleStarterOutfit,
  saveOnboardingDraft,
  getOnboardingDraft,
  clearOnboardingDraft,
  flushOnboardingDraftToBackend,
  ONBOARDING_FIRST_OUTFIT_KEY,
} from '../onboardingStore';
import { isPublicPath } from '../api/client';
import {
  getFullAvatarAnatomy,
  getDefaultAvatarAnatomy,
  warpDefaultAvatarPoint,
} from '../../components/DynamicAvatar';

describe('onboardingDataset & onboardingStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('ONBOARDING_STATIC_DATASET has 48 curated items with pre-fitted avatar_fit & point-cloud meshes', () => {
    expect(WOMEN_ONBOARDING_DATASET).toHaveLength(24);
    expect(MEN_ONBOARDING_DATASET).toHaveLength(24);
    expect(ONBOARDING_STATIC_DATASET).toHaveLength(48);

    ONBOARDING_STATIC_DATASET.forEach((item) => {
      expect(item.id).toBeTruthy();
      expect(ONBOARDING_DATASET_BY_ID[item.id]).toBe(item);
      expect(item.image_url).toMatch(/^\/assets\/onboarding\/.+\.(png|jpg)$/);
      expect(['Top', 'Bottom', 'Full Body', 'Outerwear', 'Footwear']).toContain(item.category);
      expect(item.avatar_fit).toBeDefined();
      expect(item.avatar_fit.fitted_to_default_avatar).toBe(true);
      expect(item.avatar_fit.default_viewbox.width).toBeGreaterThan(20);
      expect(item.avatar_fit.default_viewbox.height).toBeGreaterThan(15);
      expect(item.avatar_fit.point_cloud.vertices.length).toBeGreaterThanOrEqual(20);
      expect(item.avatar_fit.point_cloud.triangles.length).toBeGreaterThanOrEqual(20);
    });
  });

  test('warpDefaultAvatarPoint keeps Default Avatar points 1-to-1 and dynamically stretches anatomical zones on resize', () => {
    const defFemale = getDefaultAvatarAnatomy('female');
    const samePoint = warpDefaultAvatarPoint(132, defFemale.yWaist, defFemale, defFemale);
    expect(samePoint.x).toBeCloseTo(132, 3);
    expect(samePoint.y).toBeCloseTo(defFemale.yWaist, 3);
    expect(samePoint.scaleX).toBeCloseTo(1.0, 3);

    // Resize waist wider (68 -> 94 cm) and height taller (168 -> 182 cm) while keeping shoulders 38 cm
    const liveFemale = getFullAvatarAnatomy({
      height: 182,
      shoulders: 38,
      chest: 88,
      waist: 94,
      hip: 94,
      armLength: 62,
      inseam: 82,
      gender: 'female',
    });

    const warpedShoulder = warpDefaultAvatarPoint(130, defFemale.yShoulders, defFemale, liveFemale);
    const warpedWaist = warpDefaultAvatarPoint(130, defFemale.yWaist, defFemale, liveFemale);

    // Shoulder width unchanged (scaleX === 1), while waist widens significantly (scaleX > 1.3)
    expect(warpedShoulder.scaleX).toBeCloseTo(1.0, 2);
    expect(warpedWaist.scaleX).toBeGreaterThan(1.3);
    expect(warpedWaist.x).toBeGreaterThan(warpedShoulder.x + 8);
  });

  test('getStarterCapsuleForUser boosts Modest & Traditional items when requested', () => {
    const modestWomen = getStarterCapsuleForUser({
      sex: 'female',
      aesthetics: ['modest', 'traditional'],
      conservativeness: 'high',
    });
    expect(modestWomen).toHaveLength(24);
    const topFiveIds = modestWomen.slice(0, 5).map((i) => i.id);
    expect(topFiveIds).toEqual(
      expect.arrayContaining(['w_abaya_black', 'w_kaftan_emerald', 'w_jalabiya_kurta_set'])
    );
  });

  test('validateStarterSelection supports both Separates path and Full Body path (min 4 items)', () => {
    // Full-body path (Abaya + Kaftan + Heels + Trench Coat = 4 items, Full Body + Footwear)
    const fullBodyCheck = validateStarterSelection([
      'w_abaya_black',
      'w_kaftan_emerald',
      'w_heels_pumps_black',
      'w_trench_coat_cream',
    ]);
    expect(fullBodyCheck.isComplete).toBe(true);
    expect(fullBodyCheck.hasFullBodyPath).toBe(true);

    // Separates path (Top + Skirt + Blazer + Loafers = 4 items)
    const separatesCheck = validateStarterSelection([
      'w_shirt_buttondown_striped',
      'w_skirt_pleated_midi',
      'w_blazer_suit_black',
      'w_loafers_black',
    ]);
    expect(separatesCheck.isComplete).toBe(true);
    expect(separatesCheck.hasSeparatesPath).toBe(true);

    // Incomplete selection (only tops/outerwear, no bottom or footwear)
    const incompleteCheck = validateStarterSelection([
      'w_shirt_buttondown_striped',
      'w_tunic_mandarin_green',
      'w_blazer_suit_black',
    ]);
    expect(incompleteCheck.isComplete).toBe(false);
    expect(incompleteCheck.missingHints.length).toBeGreaterThan(0);
  });

  test('autoSelectStarterCapsule returns a valid 4-item outfit-complete selection', () => {
    const autoWomen = autoSelectStarterCapsule({
      sex: 'female',
      aesthetics: ['business', 'minimalist'],
      conservativeness: 'moderate',
    });
    expect(autoWomen).toHaveLength(4);
    const validation = validateStarterSelection(autoWomen);
    expect(validation.isComplete).toBe(true);

    const autoMen = autoSelectStarterCapsule({
      sex: 'male',
      aesthetics: ['traditional', 'modest'],
      conservativeness: 'high',
    });
    expect(autoMen).toHaveLength(4);
    expect(validateStarterSelection(autoMen).isComplete).toBe(true);
  });

  test('assembleStarterOutfit builds a weather-aware outfit for both Full Body and Separates', () => {
    const fullBodyOutfit = assembleStarterOutfit(
      ['w_kaftan_emerald', 'w_heels_pumps_black', 'w_trench_coat_cream', 'w_abaya_black'],
      14 // cool weather -> includes outerwear
    );
    expect(fullBodyOutfit.mode).toBe('full_body');
    expect(fullBodyOutfit.outfitPieces.map((i) => i.id)).toEqual([
      'w_kaftan_emerald',
      'w_trench_coat_cream',
      'w_heels_pumps_black',
    ]);

    const warmSeparatesOutfit = assembleStarterOutfit(
      ['m_shirt_dress_grey', 'm_chinos_beige', 'm_blazer_smart_lightblue', 'm_shoes_derby_brown'],
      24 // warm weather, separates mode -> includes top, bottom, smart blazer, shoes
    );
    expect(warmSeparatesOutfit.mode).toBe('separates');
    expect(warmSeparatesOutfit.outfitPieces.map((i) => i.id)).toEqual([
      'm_shirt_dress_grey',
      'm_chinos_beige',
      'm_blazer_smart_lightblue',
      'm_shoes_derby_brown',
    ]);
  });

  test('saveOnboardingDraft, getOnboardingDraft, and clearOnboardingDraft persist cleanly and deep-merge nested fields', () => {
    const step1 = saveOnboardingDraft({
      is_professional: true,
      professional: {
        is_professional: true,
        business: { name: 'Atelier Noor', address: 'Milan, Italy' },
      },
    });
    const step2 = saveOnboardingDraft(
      {
        step: 3,
        professional: {
          business: { website: 'https://ateliernoor.example' },
        },
        starter_item_ids: ['w_abaya_black', 'w_heels_pumps_black', 'w_trench_coat_cream', 'w_kaftan_emerald'],
      },
      step1
    );
    expect(step2.step).toBe(3);
    expect(step2.professional.business).toEqual({
      name: 'Atelier Noor',
      address: 'Milan, Italy',
      website: 'https://ateliernoor.example',
      description: '',
    });

    const loaded = getOnboardingDraft();
    expect(loaded.starter_item_ids).toEqual([
      'w_abaya_black',
      'w_heels_pumps_black',
      'w_trench_coat_cream',
      'w_kaftan_emerald',
    ]);

    clearOnboardingDraft();
    expect(getOnboardingDraft()).toBeNull();
  });

  test('isPublicPath includes /onboarding so guests are not redirected on 401', () => {
    expect(isPublicPath('/onboarding')).toBe(true);
  });

  test('flushOnboardingDraftToBackend deduplicates existing closet items, sets measurement aliases, and preserves avatar_fit', async () => {
    const patchCalls = [];
    const createCalls = [];
    const mockApi = {
      patchMe: async (patch) => {
        patchCalls.push(patch);
        return { id: 'u-1', ...patch };
      },
      createItem: async (payload) => {
        createCalls.push(payload);
        return { id: `created-${createCalls.length}`, ...payload };
      },
    };
    const mockClosetStore = {
      getSnapshot: () => ({
        items: [
          {
            id: 'existing-abaya-id',
            clean_image_url: ONBOARDING_DATASET_BY_ID.w_abaya_black.image_url,
            is_starter_capsule: true,
          },
        ],
      }),
      upsert: jest.fn(),
    };

    const result = await flushOnboardingDraftToBackend({
      api: mockApi,
      closetStore: mockClosetStore,
      currentUser: { id: 'u-1' },
      draft: {
        step: 4,
        sex: 'female',
        measurements: { height_cm: 170, weight_kg: 63, waist_cm: 71, foot_length_cm: 24.5, skin_tone: '#E0AC69' },
        predicted_sizes: { shoulders: 39, chest: 90, hip: 96, recommended_sizes: { shirt_size: 'M', shoe_size_us: 8 } },
        starter_item_ids: ['w_abaya_black', 'w_heels_pumps_black', 'w_trench_coat_cream', 'w_kaftan_emerald'],
      },
    });

    // w_abaya_black was already in closetStore, so only 3 items should be created
    expect(createCalls).toHaveLength(3);
    expect(result.createdCount).toBe(3);
    expect(patchCalls[0].migration_flag).toBe('New');
    expect(patchCalls[0].body_measurements.hips).toBe(96);
    expect(patchCalls[0].body_measurements.height_cm).toBe(170);

    const savedFirstOutfit = JSON.parse(sessionStorage.getItem(ONBOARDING_FIRST_OUTFIT_KEY));
    expect(savedFirstOutfit.garments.length).toBeGreaterThanOrEqual(2);
    expect(savedFirstOutfit.garments[0].closet_item_id).toBe('existing-abaya-id');
    expect(savedFirstOutfit.garments[0].avatar_fit).toBeDefined();
  });
});
