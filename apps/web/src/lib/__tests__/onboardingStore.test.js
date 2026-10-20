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

  test('closetGarmentFitter maps all closet item categories to Default Avatar collar-to-hem envelopes & point-cloud meshes', () => {
    const {
      resolveGarmentHexColor,
      getGarmentAnatomicalEnvelope,
      assessPhotoContourQuality,
      fitClosetGarmentToDefaultAvatar,
    } = require('../closetGarmentFitter');

    expect(resolveGarmentHexColor({ color: 'Emerald Green' })).toBe('#145F37');
    expect(resolveGarmentHexColor({ colors: [{ name: 'Navy' }] })).toBe('#1E2D4A');

    const defFemale = getDefaultAvatarAnatomy('female');
    const topEnv = getGarmentAnatomicalEnvelope(
      { name: 'Silk Blouse', category: 'Top', sub_category: 'Blouse' },
      'top',
      'female'
    );
    // Collar line starts at yChin - 0.6 and hem lands at yHip + 3.0
    expect(topEnv.yTop0).toBeCloseTo(defFemale.yChin - 0.6, 2);
    expect(topEnv.yBot0).toBeCloseTo(defFemale.yHip + 3.0, 2);

    // Assess photo contour quality: clean symmetric cutout vs unsegmented rectangle
    const w = 40;
    const h = 60;
    const symmetricCutout = new Uint8ClampedArray(w * h);
    for (let y = 4; y < h - 4; y++) {
      for (let x = 10; x < w - 10; x++) {
        symmetricCutout[y * w + x] = 255;
      }
    }
    const cleanCheck = assessPhotoContourQuality(symmetricCutout, w, h, 'top');
    expect(cleanCheck.canWarpPhoto).toBe(true);

    const unsegmentedRect = new Uint8ClampedArray(w * h).fill(255);
    const rectCheck = assessPhotoContourQuality(unsegmentedRect, w, h, 'top');
    expect(rectCheck.canWarpPhoto).toBe(false);
    expect(rectCheck.reason).toBe('unsegmented_rectangle');

    // Fit arbitrary closet items across all 5 avatar slots
    const sampleClosetSlots = [
      { slot: 'top', item: { id: 'c-top-1', name: 'Navy Linen Shirt', category: 'Top', color: 'Navy' } },
      { slot: 'bottom', item: { id: 'c-bot-1', name: 'Pleated Midi Skirt', category: 'Bottom', sub_category: 'Skirt', color: 'Beige' } },
      { slot: 'dress', item: { id: 'c-drs-1', name: 'Emerald Kaftan Gown', category: 'Full Body', color: 'Emerald' } },
      { slot: 'outerwear', item: { id: 'c-out-1', name: 'Camel Trench Coat', category: 'Outerwear', color: 'Camel' } },
      { slot: 'shoes', item: { id: 'c-sho-1', name: 'Black Chelsea Boots', category: 'Footwear', color: 'Black' } },
    ];

    sampleClosetSlots.forEach(({ slot, item }) => {
      const fitted = fitClosetGarmentToDefaultAvatar(item, null, slot, 'female');
      expect(fitted).not.toBeNull();
      expect(fitted.avatarFit.fitted_to_default_avatar).toBe(true);
      expect(fitted.avatarFit.default_viewbox.width).toBeGreaterThan(20);
      expect(fitted.avatarFit.default_viewbox.height).toBeGreaterThan(10);
      expect(fitted.avatarFit.point_cloud.vertices.length).toBeGreaterThanOrEqual(20);
      expect(fitted.avatarFit.point_cloud.triangles.length).toBeGreaterThanOrEqual(20);
    });
  });

  test('extractBodyPhotoAnatomy & getGarmentAnatomicalEnvelope map closet garments to a Full-Body Photo avatar anatomy and spine centerline', () => {
    const {
      extractBodyPhotoAnatomy,
      getGarmentAnatomicalEnvelope,
    } = require('../closetGarmentFitter');

    const W = 200;
    const H = 450;
    const rgba = new Uint8ClampedArray(W * H * 4);
    const spineCenter = 106; // Person standing slightly right of center (x=106 vs 100)

    // Paint a full-body silhouette from y=30 (head crown) to y=420 (feet)
    for (let y = 30; y <= 420; y++) {
      const rel = (y - 30) / 390;
      let halfW = 18;
      if (rel < 0.11) halfW = 14; // head
      else if (rel < 0.15) halfW = 9; // neck constriction around y=78..88
      else if (rel < 0.22) halfW = 42; // broad shoulders around y=95..115
      else if (rel < 0.35) halfW = 36; // chest
      else if (rel < 0.45) halfW = 24; // narrow waist indentation
      else if (rel < 0.56) halfW = 41; // wide hips
      else if (rel < 0.78) halfW = 24; // knees
      else halfW = 18; // ankles & feet

      const x0 = Math.max(0, Math.round(spineCenter - halfW));
      const x1 = Math.min(W - 1, Math.round(spineCenter + halfW));
      for (let x = x0; x <= x1; x++) {
        const idx = (y * W + x) * 4;
        rgba[idx] = 60;
        rgba[idx + 1] = 50;
        rgba[idx + 2] = 45;
        rgba[idx + 3] = 255;
      }
    }

    const baseAnat = getDefaultAvatarAnatomy('female');
    const photoAnatomy = extractBodyPhotoAnatomy(
      { data: rgba, width: W, height: H },
      baseAnat,
      'female'
    );

    expect(photoAnatomy.isPhotoExtracted).toBe(true);
    expect(photoAnatomy.yHeadTop).toBe(30);
    expect(photoAnatomy.yFeet).toBe(420);
    expect(photoAnatomy.centerXAtY(photoAnatomy.yWaist)).toBeCloseTo(spineCenter, 0);
    expect(photoAnatomy.wShoulders).toBeGreaterThan(photoAnatomy.wWaist + 6);
    expect(photoAnatomy.wHip).toBeGreaterThan(photoAnatomy.wWaist + 6);

    // Map a maxi abaya and tailored trousers directly to the Full-Body Photo anatomy
    const abayaEnv = getGarmentAnatomicalEnvelope(
      { name: 'Black Silk Abaya', category: 'Full Body', sub_category: 'Abaya' },
      'dress',
      'female',
      photoAnatomy
    );
    expect(abayaEnv.yTop0).toBeCloseTo(photoAnatomy.yChin - 0.6, 2);
    expect(abayaEnv.yBot0).toBeCloseTo(photoAnatomy.yAnkles + 3.0, 2);
    const waistSpan = abayaEnv.spanAtY(photoAnatomy.yWaist);
    expect(waistSpan.centerX).toBeCloseTo(spineCenter, 0);
    expect(waistSpan.xRight - waistSpan.xLeft).toBeGreaterThan(50);

    // Verify warpDefaultAvatarPoint shifts the Default Avatar's x=100 centerline onto the photo's spineCenter
    const warpedWaistCenter = warpDefaultAvatarPoint(100, baseAnat.yWaist, baseAnat, photoAnatomy);
    expect(warpedWaistCenter.x).toBeCloseTo(spineCenter, 0);
    expect(warpedWaistCenter.y).toBeCloseTo(photoAnatomy.yWaist, 1);
  });

  test('pant proportions enforce waist-to-hip top position by style, absolute crotch barrier, and top-hem width fitting', () => {
    const {
      getBottomRiseAndCrotchMetrics,
      detectPantsCrotchRatio,
      getGarmentAnatomicalEnvelope,
    } = require('../closetGarmentFitter');

    const g = getDefaultAvatarAnatomy('female');

    // 1. High-waisted trousers sit at yWaist (upper limit) and match avatar waist width
    const highWaistItem = { name: 'High-Waist Tailored Trousers', category: 'Bottom', sub_category: 'Trousers' };
    const highEnv = getGarmentAnatomicalEnvelope(highWaistItem, 'bottom', 'female', g);
    expect(highEnv.riseStyle).toBe('high_rise');
    expect(highEnv.yTop0).toBeCloseTo(g.yWaist, 2);
    expect(highEnv.yTop0).toBeGreaterThanOrEqual(g.yWaist);
    expect(highEnv.yTop0).toBeLessThanOrEqual(g.yHip);
    expect(highEnv.yCrotchTarget).toBeGreaterThanOrEqual(g.yCrotch);
    expect(highEnv.halfWidthAtY(highEnv.yTop0)).toBeCloseTo(g.wWaist + 0.35, 1);

    // 2. Classic jeans sit at mid-rise between yWaist and yHip, and top hem interpolates between wWaist and wHip
    const midRiseItem = { name: 'Blue Straight Jeans', category: 'Bottom', sub_category: 'Jeans' };
    const midEnv = getGarmentAnatomicalEnvelope(midRiseItem, 'bottom', 'female', g);
    expect(midEnv.riseStyle).toBe('mid_rise');
    expect(midEnv.yTop0).toBeGreaterThan(g.yWaist);
    expect(midEnv.yTop0).toBeLessThan(g.yHip);
    expect(midEnv.yCrotchTarget).toBeGreaterThanOrEqual(g.yCrotch);
    expect(midEnv.halfWidthAtY(midEnv.yTop0)).toBeGreaterThan(g.wWaist + 0.35);
    expect(midEnv.halfWidthAtY(midEnv.yTop0)).toBeLessThan(g.wHip + 0.35);

    // 3. Low-rise / hip-hugger pants approach yHip (lower limit) and never exceed yHip, while crotch stays >= yCrotch
    const lowRiseItem = { name: 'Low-Rise Hipster Cargo Pants', category: 'Bottom', sub_category: 'Cargo' };
    const lowEnv = getGarmentAnatomicalEnvelope(lowRiseItem, 'bottom', 'female', g);
    expect(lowEnv.riseStyle).toBe('low_rise');
    expect(lowEnv.yTop0).toBeGreaterThan(midEnv.yTop0);
    expect(lowEnv.yTop0).toBeLessThanOrEqual(g.yHip);
    expect(lowEnv.yCrotchTarget).toBeGreaterThanOrEqual(g.yCrotch);
    expect(lowEnv.halfWidthAtY(lowEnv.yTop0)).toBeGreaterThan(midEnv.halfWidthAtY(midEnv.yTop0));
    expect(lowEnv.halfWidthAtY(g.yHip)).toBeCloseTo(g.wHip + 0.9, 1);

    // 4. Drop-crotch joggers have yCrotchTarget lower than (>=) avatar yCrotch
    const dropCrotchMetrics = getBottomRiseAndCrotchMetrics(
      { name: 'Baggy Harem Sweatpants', category: 'Bottom' },
      g
    );
    expect(dropCrotchMetrics.yCrotchTarget).toBeGreaterThan(g.yCrotch);

    // 5. detectPantsCrotchRatio finds the exact leg-split row in a two-legged pants alpha mask
    const maskW = 60;
    const maskH = 100;
    const pantsMask = new Uint8ClampedArray(maskW * maskH);
    for (let y = 0; y < maskH; y++) {
      if (y < 32) {
        // Unified pelvis block above row 32
        for (let x = 10; x < 50; x++) pantsMask[y * maskW + x] = 255;
      } else {
        // Split into left leg (10..26) and right leg (34..50) with gap (26..34)
        for (let x = 10; x < 26; x++) pantsMask[y * maskW + x] = 255;
        for (let x = 34; x < 50; x++) pantsMask[y * maskW + x] = 255;
      }
    }
    const detectedCrotchV = detectPantsCrotchRatio(pantsMask, maskW, maskH, false);
    expect(detectedCrotchV).toBeCloseTo(0.32, 2);
  });

  test('analyzeFootwearCutout splits paired shoes into left and right single-shoe boxes so one shoe maps per foot', () => {
    const { analyzeFootwearCutout } = require('../closetGarmentFitter');

    // 1. Pair of Chelsea boots standing side-by-side with a narrow 4px gap in a tall 80x96 crop
    const pairW = 80;
    const pairH = 96;
    const pairMask = new Uint8ClampedArray(pairW * pairH);
    for (let y = 4; y < 92; y++) {
      // Left boot in x=[6..37], Right boot in x=[42..73]
      for (let x = 6; x <= 37; x++) pairMask[y * pairW + x] = 255;
      for (let x = 42; x <= 73; x++) pairMask[y * pairW + x] = 255;
    }
    const pairResult = analyzeFootwearCutout(pairMask, pairW, pairH);
    expect(pairResult.isPaired).toBe(true);
    expect(pairResult.splitX).toBeGreaterThanOrEqual(38);
    expect(pairResult.splitX).toBeLessThanOrEqual(42);
    expect(pairResult.leftBox.x).toBe(6);
    expect(pairResult.leftBox.x + pairResult.leftBox.w - 1).toBe(37);
    expect(pairResult.rightBox.x).toBe(42);
    expect(pairResult.rightBox.x + pairResult.rightBox.w - 1).toBe(73);

    // 2. Single side-profile sneaker (ankle collar on left y=[6..56], low toe box on right y=[34..56], no central gap)
    const singleW = 90;
    const singleH = 60;
    const singleMask = new Uint8ClampedArray(singleW * singleH);
    for (let x = 8; x <= 82; x++) {
      const t = (x - 8) / 74;
      const topY = Math.round(6 + t * 32); // slopes down from ankle collar (y=6) to toe tip (y=38)
      for (let y = topY; y <= 55; y++) {
        singleMask[y * singleW + x] = 255;
      }
    }
    const singleResult = analyzeFootwearCutout(singleMask, singleW, singleH);
    expect(singleResult.isPaired).toBe(false);
  });
});


