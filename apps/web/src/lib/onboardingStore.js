import {
  ONBOARDING_STATIC_DATASET,
  ONBOARDING_DATASET_BY_ID,
} from './onboardingDataset';

export const ONBOARDING_DRAFT_KEY = 'dressapp.onboarding_draft';
export const ONBOARDING_COMPLETED_KEY = 'dressapp.onboarding_completed';
export const ONBOARDING_FIRST_OUTFIT_KEY = 'dressapp.onboarding_first_outfit';

export const DEFAULT_ONBOARDING_DRAFT = {
  step: 1,
  sex: 'female',
  aesthetics: ['minimalist', 'smart_casual'],
  color_palette: ['neutrals'],
  conservativeness: 'moderate',
  occupation: 'office_corporate',
  is_professional: false,
  professional: {
    is_professional: false,
    profession: 'personal_stylist',
    business: {
      name: '',
      address: '',
      website: '',
      description: '',
    },
  },
  unit_system: 'metric',
  measurements: {
    height_cm: 168,
    weight_kg: 62,
    waist_cm: 72,
    foot_length_cm: 24.5,
    skin_tone: '#E0AC69',
  },
  predicted_sizes: null,
  starter_item_ids: [],
  migration_flag: null,
  updated_at: null,
};

export function getOnboardingDraft() {
  if (typeof window === 'undefined') return { ...DEFAULT_ONBOARDING_DRAFT };
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...DEFAULT_ONBOARDING_DRAFT,
      ...parsed,
      measurements: {
        ...DEFAULT_ONBOARDING_DRAFT.measurements,
        ...(parsed.measurements || {}),
      },
      professional: {
        ...DEFAULT_ONBOARDING_DRAFT.professional,
        ...(parsed.professional || {}),
        business: {
          ...DEFAULT_ONBOARDING_DRAFT.professional.business,
          ...(parsed.professional?.business || {}),
        },
      },
    };
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(patch = {}, baseDraft = null) {
  const existing = getOnboardingDraft() || baseDraft || { ...DEFAULT_ONBOARDING_DRAFT };
  const next = {
    ...DEFAULT_ONBOARDING_DRAFT,
    ...existing,
    ...patch,
    measurements: {
      ...DEFAULT_ONBOARDING_DRAFT.measurements,
      ...(existing.measurements || {}),
      ...(patch.measurements || {}),
    },
    professional: {
      ...DEFAULT_ONBOARDING_DRAFT.professional,
      ...(existing.professional || {}),
      ...(patch.professional || {}),
      business: {
        ...DEFAULT_ONBOARDING_DRAFT.professional.business,
        ...(existing.professional?.business || {}),
        ...(patch.professional?.business || {}),
      },
    },
    updated_at: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

export function clearOnboardingDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function markOnboardingCompleted(userId = 'guest') {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, String(userId || 'done'));
  } catch {
    // ignore
  }
}

export function hasCompletedOnboarding(user, hasClosetItems = false) {
  if (hasClosetItems) return true;
  if (typeof window !== 'undefined') {
    try {
      const done = window.localStorage.getItem(ONBOARDING_COMPLETED_KEY);
      if (done && (!user?.id || done === String(user.id) || done === 'done')) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  if (!user) return false;
  const bm = user.body_measurements || user.measurements || {};
  const hasMeasurements = Boolean(
    (bm.height || bm.height_cm) && (bm.weight || bm.weight_kg)
  );
  const hasStyleAesthetics = Boolean(
    Array.isArray(user.style_profile?.aesthetics) && user.style_profile.aesthetics.length > 0
  );
  const hasMigrationFlag = Boolean(user.migration_flag);
  return (hasMeasurements && hasStyleAesthetics) || hasMigrationFlag;
}

/**
 * Ranks and filters the 24 gender-matched items from the static dataset
 * according to the user's Step 1 Style DNA (`sex`, `aesthetics`, `conservativeness`, `occupation`).
 */
export function getStarterCapsuleForUser({
  sex = 'female',
  aesthetics = [],
  conservativeness = 'moderate',
  occupation = '',
} = {}) {
  const normalizedSex = sex === 'male' ? 'male' : 'female';
  const pool = ONBOARDING_STATIC_DATASET.filter((item) => item.sex === normalizedSex);
  const aestheticSet = new Set((aesthetics || []).map((a) => String(a).toLowerCase()));
  const occ = String(occupation || '').toLowerCase();

  const scored = pool.map((item, idx) => {
    let score = 0;

    // 1. Aesthetic alignment (+10 per matched aesthetic tag)
    (item.aesthetics || []).forEach((tag) => {
      if (aestheticSet.has(String(tag).toLowerCase())) {
        score += 10;
      }
    });

    // 2. Modesty / Conservativeness alignment
    if (conservativeness === 'high') {
      if (item.conservativeness === 'high') score += 8;
      if (['Abaya', 'Kaftan', 'Kurta Set', 'Saree', 'Thobe', 'Kurta', 'Tunic', 'Achkan', 'Waistcoat'].includes(item.sub_category)) {
        score += 6;
      }
    } else if (conservativeness === 'moderate') {
      if (item.conservativeness === 'moderate' || item.conservativeness === 'high') score += 4;
    }

    // 3. Occupation / Daily routine boost
    if (occ.includes('office') || occ.includes('corporate') || aestheticSet.has('business')) {
      if (item.dress_code === 'business' || item.dress_code === 'formal') score += 7;
    }
    if (occ.includes('remote') || occ.includes('student') || aestheticSet.has('relaxed')) {
      if (item.dress_code === 'casual' || item.dress_code === 'smart-casual') score += 5;
    }
    if (occ.includes('events') || aestheticSet.has('traditional')) {
      if (item.dress_code === 'formal' || (item.aesthetics || []).includes('traditional')) score += 6;
    }

    return { item, score, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((entry) => entry.item);
}

/**
 * Dual-Path Outfit Completeness Validator:
 * A user's Starter Capsule selection is valid when they pick >= 4 items
 * that form at least one complete head-to-toe outfit via EITHER:
 *   - Path A (Full-Body / One-Piece / Cultural): >= 1 Full Body + >= 1 Footwear (4+ items total)
 *   - Path B (Separates / Suit): >= 1 Top + >= 1 Bottom (Trousers or Skirt) + >= 1 Footwear (4+ items total)
 */
export function validateStarterSelection(selectedIds = []) {
  const uniqueIds = Array.from(new Set(selectedIds || []));
  const items = uniqueIds
    .map((id) => ONBOARDING_DATASET_BY_ID[id])
    .filter(Boolean);

  const counts = {
    fullBody: 0,
    top: 0,
    bottom: 0,
    outerwear: 0,
    footwear: 0,
  };

  items.forEach((item) => {
    const cat = String(item.category || '').toLowerCase();
    if (cat === 'full body' || cat === 'dress') counts.fullBody += 1;
    else if (cat === 'top') counts.top += 1;
    else if (cat === 'bottom') counts.bottom += 1;
    else if (cat === 'outerwear') counts.outerwear += 1;
    else if (cat === 'footwear') counts.footwear += 1;
  });

  const hasFullBodyPath = counts.fullBody >= 1 && counts.footwear >= 1;
  const hasSeparatesPath = counts.top >= 1 && counts.bottom >= 1 && counts.footwear >= 1;
  const hasMinCount = items.length >= 4;
  const isComplete = hasMinCount && (hasFullBodyPath || hasSeparatesPath);

  const missingHints = [];
  if (!hasFullBodyPath && !hasSeparatesPath) {
    if (counts.fullBody >= 1) {
      if (counts.footwear === 0) missingHints.push('footwear');
    } else {
      if (counts.top === 0 && counts.fullBody === 0) missingHints.push('top_or_fullbody');
      if (counts.bottom === 0 && counts.fullBody === 0) missingHints.push('bottom');
      if (counts.footwear === 0) missingHints.push('footwear');
    }
  }
  if (items.length < 4) {
    missingHints.push(`min_items_${4 - items.length}`);
  }

  return {
    isComplete,
    totalSelected: items.length,
    hasFullBodyPath,
    hasSeparatesPath,
    counts,
    missingHints,
    items,
  };
}

/**
 * Automatically selects 4 harmonious items for the user's style DNA that
 * satisfy the Dual-Path Outfit Completeness rules.
 */
export function autoSelectStarterCapsule({
  sex = 'female',
  aesthetics = [],
  conservativeness = 'moderate',
  occupation = '',
} = {}) {
  const ranked = getStarterCapsuleForUser({ sex, aesthetics, conservativeness, occupation });
  const aestheticSet = new Set((aesthetics || []).map((a) => String(a).toLowerCase()));

  const fullBodies = ranked.filter((i) => i.category === 'Full Body');
  const tops = ranked.filter((i) => i.category === 'Top');
  const bottoms = ranked.filter((i) => i.category === 'Bottom');
  const outerwears = ranked.filter((i) => i.category === 'Outerwear');
  const footwears = ranked.filter((i) => i.category === 'Footwear');

  const prefersFullBodyFirst =
    aestheticSet.has('traditional') ||
    aestheticSet.has('modest') ||
    aestheticSet.has('dresses_skirts');

  const selected = [];
  const pushUnique = (item) => {
    if (item && !selected.includes(item.id)) {
      selected.push(item.id);
    }
  };

  if (prefersFullBodyFirst && fullBodies.length > 0) {
    pushUnique(fullBodies[0]);
    pushUnique(footwears[0]);
    pushUnique(tops[0]);
    pushUnique(bottoms[0]);
  } else {
    pushUnique(tops[0]);
    pushUnique(bottoms[0]);
    pushUnique(footwears[0]);
    pushUnique(outerwears[0] || fullBodies[0]);
  }

  for (const item of ranked) {
    if (selected.length >= 4) break;
    pushUnique(item);
  }

  return selected;
}

/**
 * Assembles a complete head-to-toe outfit from the user's selected starter items,
 * returning both `avatarOutfitItems` (keyed by slot for `<AvatarViewer />`) and
 * `outfitPieces` (ordered list of full garment objects for UI cards & `/stylist`).
 */
export function assembleStarterOutfit(selectedIds = [], weatherTempC = 20) {
  const items = (selectedIds || [])
    .map((id) => ONBOARDING_DATASET_BY_ID[id])
    .filter(Boolean);

  const fullBodies = items.filter((i) => i.category === 'Full Body');
  const tops = items.filter((i) => i.category === 'Top');
  const bottoms = items.filter((i) => i.category === 'Bottom');
  const outerwears = items.filter((i) => i.category === 'Outerwear');
  const footwears = items.filter((i) => i.category === 'Footwear');

  const isCoolWeather = typeof weatherTempC === 'number' && weatherTempC <= 19;
  const avatarOutfitItems = {};
  const outfitPieces = [];

  const toAvatarEntry = (item, role) => ({
    id: item.id,
    closet_item_id: item.id,
    role,
    name: item.name,
    title: item.title,
    category: item.category,
    sub_category: item.sub_category,
    item_type: item.item_type,
    color: item.color,
    url: item.image_url,
    image_url: item.image_url,
    clean_image_url: item.image_url,
    original_image_url: item.image_url,
    avatar_fit: item.avatar_fit || null,
  });

  const firstMainItem = items.find((i) =>
    ['Full Body', 'Top', 'Bottom'].includes(i.category)
  );
  const useFullBody =
    fullBodies.length > 0 &&
    (tops.length === 0 || bottoms.length === 0 || firstMainItem?.category === 'Full Body');

  if (useFullBody) {
    const dressItem = fullBodies[0];
    avatarOutfitItems.dress = toAvatarEntry(dressItem, 'dress');
    outfitPieces.push(dressItem);
  } else {
    if (tops[0]) {
      avatarOutfitItems.top = toAvatarEntry(tops[0], 'top');
      outfitPieces.push(tops[0]);
    }
    if (bottoms[0]) {
      avatarOutfitItems.bottom = toAvatarEntry(bottoms[0], 'bottom');
      outfitPieces.push(bottoms[0]);
    }
  }

  if (outerwears[0] && (isCoolWeather || !useFullBody || outerwears[0].dress_code === 'business')) {
    avatarOutfitItems.outerwear = toAvatarEntry(outerwears[0], 'outerwear');
    outfitPieces.push(outerwears[0]);
  }

  if (footwears[0]) {
    avatarOutfitItems.shoes = toAvatarEntry(footwears[0], 'shoes');
    outfitPieces.push(footwears[0]);
  }

  return {
    avatarOutfitItems,
    outfitPieces,
    mode: useFullBody ? 'full_body' : 'separates',
  };
}

/**
 * Flushes the guest/authenticated onboarding draft to the backend:
 *   1. Non-destructively merges profile fields via `api.patchMe(profilePatch)`
 *   2. Seeds selected Starter Capsule items via `api.createItem(itemPayload)`
 *   3. Stores the first outfit in `sessionStorage` so `/stylist` loads it immediately
 */
export async function flushOnboardingDraftToBackend({
  api,
  closetStore,
  currentUser,
  draft: explicitDraft,
} = {}) {
  const draft = explicitDraft || getOnboardingDraft();
  if (!draft || !api) return { seededItems: [], updatedUser: currentUser };

  const existingBM = currentUser?.body_measurements || currentUser?.measurements || {};
  const draftM = draft.measurements || {};
  const predicted = draft.predicted_sizes || {};
  const recSizes = predicted.recommended_sizes || {};

  const profilePatch = {};

  if (!existingBM.height || draft.step >= 2) {
    const heightCm = Number(draftM.height_cm) || existingBM.height || existingBM.height_cm || 168;
    const weightKg = Number(draftM.weight_kg) || existingBM.weight || existingBM.weight_kg || 62;
    const waistCm = Number(draftM.waist_cm) || existingBM.waist || existingBM.waist_cm || 72;
    const footLengthCm = Number(draftM.foot_length_cm) || existingBM.foot_length || existingBM.foot_length_cm || 24.5;
    const shouldersCm = predicted.shoulders ? Math.round(predicted.shoulders * 10) / 10 : undefined;
    const chestCm = predicted.chest ? Math.round(predicted.chest * 10) / 10 : undefined;
    const hipCm = predicted.hip ? Math.round(predicted.hip * 10) / 10 : undefined;
    const sleeveCm = predicted.sleeve ? Math.round(predicted.sleeve * 10) / 10 : undefined;
    const inseamCm = predicted.inseam ? Math.round(predicted.inseam * 10) / 10 : undefined;
    const outseamCm = predicted.outseam ? Math.round(predicted.outseam * 10) / 10 : undefined;

    profilePatch.sex = draft.sex || currentUser?.sex || 'female';
    profilePatch.skin_tone = draftM.skin_tone || currentUser?.skin_tone || '#E0AC69';
    profilePatch.units = {
      weight: draft.unit_system === 'imperial' ? 'lb' : 'kg',
      length: draft.unit_system === 'imperial' ? 'in' : 'cm',
    };
    profilePatch.body_measurements = {
      ...existingBM,
      height: heightCm,
      height_cm: heightCm,
      weight: weightKg,
      weight_kg: weightKg,
      waist: waistCm,
      waist_cm: waistCm,
      foot_length: footLengthCm,
      foot_length_cm: footLengthCm,
      ...(shouldersCm ? { shoulders: shouldersCm, shoulders_cm: shouldersCm } : {}),
      ...(chestCm ? { chest: chestCm, chest_cm: chestCm } : {}),
      ...(hipCm ? { hip: hipCm, hips: hipCm, hips_cm: hipCm } : {}),
      ...(sleeveCm ? { sleeve: sleeveCm, arm_length: sleeveCm } : {}),
      ...(inseamCm ? { inseam: inseamCm, inseam_cm: inseamCm } : {}),
      ...(outseamCm ? { outseam: outseamCm } : {}),
      ...(recSizes.shirt_size ? { shirt_size: recSizes.shirt_size } : {}),
      ...(recSizes.pants_size ? { pants_size: recSizes.pants_size } : {}),
      ...(recSizes.shoe_size_us ? { shoe_size: String(recSizes.shoe_size_us), shoe_size_us: String(recSizes.shoe_size_us) } : {}),
      ...(recSizes.dress_size && recSizes.dress_size !== 'N/A' ? { dress_size: String(recSizes.dress_size) } : {}),
      ...(recSizes.bra_size && recSizes.bra_size !== 'N/A' ? { bra_size: String(recSizes.bra_size) } : {}),
    };
  }

  profilePatch.style_profile = {
    ...(currentUser?.style_profile || {}),
    aesthetics: Array.isArray(draft.aesthetics) && draft.aesthetics.length > 0
      ? draft.aesthetics
      : currentUser?.style_profile?.aesthetics || ['minimalist'],
    color_palette: Array.isArray(draft.color_palette) && draft.color_palette.length > 0
      ? draft.color_palette
      : currentUser?.style_profile?.color_palette || ['neutrals'],
  };

  profilePatch.cultural_context = {
    ...(currentUser?.cultural_context || {}),
    dress_conservativeness:
      draft.conservativeness ||
      currentUser?.cultural_context?.dress_conservativeness ||
      'moderate',
  };

  if (draft.occupation && !currentUser?.occupation) {
    profilePatch.occupation = draft.occupation;
  }

  profilePatch.migration_flag =
    draft.migration_flag === 'Migrate'
      ? 'Migrate'
      : currentUser?.migration_flag || 'New';

  if (draft.is_professional || draft.professional?.is_professional) {
    profilePatch.professional = {
      ...(currentUser?.professional || {}),
      is_professional: true,
      profession: draft.professional?.profession || 'personal_stylist',
      approval_status: currentUser?.professional?.approval_status || 'self',
      business: {
        ...(currentUser?.professional?.business || {}),
        ...(draft.professional?.business || {}),
      },
    };
  }

  let updatedUser = currentUser;
  const updateUserFn = api.patchMe || api.updateMe;
  if (typeof updateUserFn === 'function') {
    try {
      updatedUser = await updateUserFn(profilePatch);
    } catch (err) {
      console.warn('Onboarding profile merge warning:', err);
    }
  }
  if (
    profilePatch.migration_flag === 'Migrate' &&
    typeof api.updateMigrationFlag === 'function'
  ) {
    try {
      await api.updateMigrationFlag('Migrate');
    } catch {
      // non-fatal if patchMe already persisted migration_flag
    }
  }

  // 2. Seed selected Starter Capsule items (idempotent: skip items already in closet)
  const selectedIds = Array.from(new Set(draft.starter_item_ids || []));
  const existingClosetItems =
    (typeof closetStore?.getSnapshot === 'function' && closetStore.getSnapshot()?.items) || [];
  const seededItems = [];
  const idMap = {};

  if (selectedIds.length > 0 && typeof api.createItem === 'function') {
    for (const starterId of selectedIds) {
      const template = ONBOARDING_DATASET_BY_ID[starterId];
      if (!template) continue;

      const existingMatch = Array.isArray(existingClosetItems)
        ? existingClosetItems.find(
            (ci) =>
              ci &&
              (ci.clean_image_url === template.image_url ||
                ci.original_image_url === template.image_url ||
                (ci.is_starter_capsule && (ci.title === template.title || ci.name === template.name)))
          )
        : null;

      if (existingMatch) {
        idMap[starterId] = existingMatch.id || existingMatch._id;
        continue;
      }

      try {
        const created = await api.createItem({
          source: 'Private',
          name: template.name,
          title: template.title,
          caption: template.caption,
          category: template.category,
          sub_category: template.sub_category,
          item_type: template.item_type,
          gender: template.gender,
          dress_code: template.dress_code,
          season: template.season,
          color: template.color,
          colors: template.colors,
          material: template.material,
          fabric_materials: template.fabric_materials,
          pattern: template.pattern,
          tags: Array.from(new Set(['starter_capsule', ...(template.tags || [])])),
          original_image_url: template.image_url,
          clean_image_url: template.image_url,
          clean_image_status: 'ready',
          is_starter_capsule: true,
        });
        if (created) {
          seededItems.push(created);
          idMap[starterId] = created.id || created._id;
          if (closetStore) {
            if (typeof closetStore.upsert === 'function') {
              closetStore.upsert(created);
            } else if (typeof closetStore.upsertItem === 'function') {
              closetStore.upsertItem(created);
            }
          }
        }
      } catch (err) {
        console.warn(`Failed seeding starter item ${starterId}:`, err);
      }
    }
  }

  // 3. Save assembled first outfit to sessionStorage so /stylist loads it on arrival
  try {
    const assembled = assembleStarterOutfit(selectedIds);
    const mappedAvatarItems = {};
    const garments = [];
    Object.entries(assembled.avatarOutfitItems || {}).forEach(([slot, entry]) => {
      const realId = idMap[entry.id] || entry.id;
      const mapped = {
        ...entry,
        id: realId,
        closet_item_id: realId,
      };
      mappedAvatarItems[slot] = mapped;
      garments.push({
        closet_item_id: realId,
        role: entry.role || slot,
        category: entry.category,
        sub_category: entry.sub_category,
        item_type: entry.item_type,
        title: entry.title || entry.name,
        name: entry.name || entry.title,
        image_url: entry.image_url,
        clean_image_url: entry.image_url,
        avatar_fit: entry.avatar_fit || null,
      });
    });
    if (typeof window !== 'undefined' && Object.keys(mappedAvatarItems).length > 0) {
      window.sessionStorage.setItem(
        ONBOARDING_FIRST_OUTFIT_KEY,
        JSON.stringify({
          name: 'My First AI Look',
          avatarOutfitItems: mappedAvatarItems,
          garments,
          createdAt: new Date().toISOString(),
        })
      );
    }
  } catch {
    // ignore sessionStorage errors
  }

  markOnboardingCompleted(updatedUser?.id || currentUser?.id || 'done');
  clearOnboardingDraft();

  return {
    flushed: true,
    createdCount: seededItems.length,
    seededItems,
    updatedUser,
    redirectTo: '/stylist?onboarded=1',
  };
}
