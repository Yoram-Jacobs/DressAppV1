import { create } from 'zustand';
import { useGLTF } from '@react-three/drei';
import { isMaleGender } from '@/lib/gender';
import { resolveEffectiveGarmentUrl } from '@/lib/itemImage';
import { resolveGarmentTemplate, getTemplateGlbUrl } from '@/lib/garmentTemplates';

export const DRACO_DECODER_PATH = '/draco/';

export const FEMALE_AVATAR_GLB = '/models/avatar_female_1.glb';
export const MALE_AVATAR_GLB = '/models/avatar_male_1.glb';

export const SLOT_DEFAULT_LAYERS = Object.freeze({
  top: 1,
  bottom: 1,
  outerwear: 2,
  shoes: 3,
  accessories: 3,
});

export const DEFAULT_BODY_METRICS = Object.freeze({
  chest_circ: 0.5,
  waist_circ: 0.5,
  hip_circ: 0.5,
  inseam: 0.5,
});

export const VALID_CAMERA_PRESETS = Object.freeze([
  'front',
  'full',
  'shoes',
  'close_up',
]);

// Calibrated ANSUR II / backend anthropometric [min, max] cm bounds -> [0.0, 1.0]
const ANTHROPOMETRIC_BOUNDS_CM = Object.freeze({
  female: {
    chest: [74, 118],
    waist: [56, 104],
    hip: [80, 126],
    inseam: [64, 88],
  },
  male: {
    chest: [84, 128],
    waist: [68, 116],
    hip: [84, 122],
    inseam: [70, 94],
  },
});

export function clampMetric01(value, fallback = 0.5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, Math.round(num * 10000) / 10000));
}

export function normalizeGender(gender) {
  return isMaleGender(gender) ? 'male' : 'female';
}

export function getCanonicalAvatarGlb(gender = 'female') {
  return normalizeGender(gender) === 'male' ? MALE_AVATAR_GLB : FEMALE_AVATAR_GLB;
}

export function preloadDressingRoomAsset(glbUrl) {
  if (!glbUrl || typeof glbUrl !== 'string') return;
  try {
    useGLTF?.preload?.(glbUrl, DRACO_DECODER_PATH);
  } catch {
    // Safe no-op in non-WebGL / unit-test environments
  }
}

export function resolveDefaultTemplateGlbForSlot(slot, gender = 'female', item = null) {
  const normGender = normalizeGender(gender);
  const isMale = normGender === 'male';
  if (item && typeof item === 'object') {
    const garmentText = [
      item.name,
      item.title,
      item.sub_category,
      item.subcategory,
      item.item_type,
      item.caption,
    ]
      .filter(Boolean)
      .join(' ');
    const templateId = resolveGarmentTemplate({
      rawSlot: slot,
      garmentText,
      category: item.category || slot,
    });
    const url = templateId ? getTemplateGlbUrl(templateId, isMale) : null;
    if (url) {
      return url;
    }
  }
  const baseDir = `/models/templates/${normGender}`;
  switch (slot) {
    case 'top':
      return `${baseDir}/top_tshirt.glb`;
    case 'bottom':
      return `${baseDir}/bottom_trousers.glb`;
    case 'outerwear':
      return `${baseDir}/jacket_blazer.glb`;
    case 'shoes': {
      const shoeText = [
        item?.name,
        item?.title,
        item?.sub_category,
        item?.subcategory,
        item?.item_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (/boot|מגפ|botte|stiefel|bota/.test(shoeText)) {
        return `${baseDir}/shoes_boots.glb`;
      }
      return `${baseDir}/shoes_sneakers.glb`;
    }
    case 'accessories':
      return `${baseDir}/accessory_belt.glb`;
    default:
      return `${baseDir}/top_tshirt.glb`;
  }
}

export function remapGenderTemplateUrl(glbUrl, gender) {
  if (!glbUrl || typeof glbUrl !== 'string') return glbUrl;
  const normGender = normalizeGender(gender);
  return glbUrl.replace(/\/models\/templates\/(female|male)\//, `/models/templates/${normGender}/`);
}

export function measurementsToBodyMetrics(input = {}, gender = 'female') {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_BODY_METRICS };
  }

  // Direct [0.0 - 1.0] ANSUR II keys or backend normalized shape_keys
  const hasNormalizedKeys =
    input.chest_circ !== undefined ||
    input.waist_circ !== undefined ||
    input.hip_circ !== undefined ||
    input.chest_girth !== undefined ||
    input.waist_girth !== undefined ||
    input.hip_girth !== undefined;

  if (hasNormalizedKeys) {
    return {
      chest_circ: clampMetric01(input.chest_circ ?? input.chest_girth, 0.5),
      waist_circ: clampMetric01(input.waist_circ ?? input.waist_girth, 0.5),
      hip_circ: clampMetric01(input.hip_circ ?? input.hip_girth, 0.5),
      inseam: clampMetric01(
        input.inseam !== undefined && Number(input.inseam) <= 1.5
          ? input.inseam
          : 0.5,
        0.5
      ),
    };
  }

  const normGender = normalizeGender(gender || input.gender);
  const bounds = ANTHROPOMETRIC_BOUNDS_CM[normGender];
  const normRange = (val, [min, max]) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return 0.5;
    if (n <= 1.5) return clampMetric01(n, 0.5);
    return clampMetric01((n - min) / Math.max(1e-4, max - min), 0.5);
  };

  return {
    chest_circ: normRange(input.chest ?? input.bust, bounds.chest),
    waist_circ: normRange(input.waist, bounds.waist),
    hip_circ: normRange(input.hip ?? input.hips, bounds.hip),
    inseam: normRange(input.inseam, bounds.inseam),
  };
}

export const STARTER_GARMENT_CATALOG = Object.freeze({
  female: [
    {
      id: 'starter-f-top-white-tee',
      slot: 'top',
      name: 'Classic White Crew Tee',
      glbUrl: '/models/templates/female/top_tshirt.glb',
      textureUrl: '/assets/onboarding/w_tshirt_white_crew_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/w_tshirt_white_crew_cutout.png',
        '/assets/onboarding/w_tshirt_black_fitted_cutout.png',
      ],
      layer: 1,
    },
    {
      id: 'starter-f-top-longsleeve',
      slot: 'top',
      name: 'Fitted Long-Sleeve Top',
      glbUrl: '/models/templates/female/top_longsleeve.glb',
      textureUrl: '/assets/onboarding/w_top_white_longsleeve_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/w_top_white_longsleeve_cutout.png',
        '/assets/onboarding/w_blouse_stand_collar_cutout.png',
      ],
      layer: 1,
    },
    {
      id: 'starter-f-bottom-trousers',
      slot: 'bottom',
      name: 'Tailored Grey Trousers',
      glbUrl: '/models/templates/female/bottom_trousers.glb',
      textureUrl: '/assets/onboarding/w_trousers_tailored_grey_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/w_trousers_tailored_grey_cutout.png',
        '/assets/onboarding/w_chinos_beige_cutout.png',
        '/assets/onboarding/w_jeans_blue_cutout.png',
      ],
      layer: 1,
    },
    {
      id: 'starter-f-outerwear-blazer',
      slot: 'outerwear',
      name: 'Structured Black Blazer',
      glbUrl: '/models/templates/female/jacket_blazer.glb',
      textureUrl: '/assets/onboarding/w_blazer_suit_black_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/w_blazer_suit_black_cutout.png',
        '/assets/onboarding/w_trench_coat_cream_cutout.png',
      ],
      layer: 2,
    },
    {
      id: 'starter-f-shoes-pumps',
      slot: 'shoes',
      name: 'Black Leather Pumps',
      glbUrl: '/models/templates/female/shoes_sneakers.glb',
      textureUrl: '/assets/onboarding/w_heels_pumps_black_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/w_heels_pumps_black_cutout.png',
        '/assets/onboarding/w_loafers_black_cutout.png',
      ],
      layer: 3,
    },
    {
      id: 'starter-f-acc-belt',
      slot: 'accessories',
      name: 'Waist Leather Belt',
      glbUrl: '/models/templates/female/accessory_belt.glb',
      textureUrl: null,
      layer: 3,
    },
  ],
  male: [
    {
      id: 'starter-m-top-shirt',
      slot: 'top',
      name: 'Tailored Grey Dress Shirt',
      glbUrl: '/models/templates/male/top_longsleeve.glb',
      textureUrl: '/assets/onboarding/m_shirt_dress_grey_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/m_shirt_dress_grey_cutout.png',
        '/assets/onboarding/m_shirt_relaxed_white_cutout.png',
      ],
      layer: 1,
    },
    {
      id: 'starter-m-top-tee',
      slot: 'top',
      name: 'Classic Black Crew Tee',
      glbUrl: '/models/templates/male/top_tshirt.glb',
      textureUrl: '/assets/onboarding/m_tshirt_black_crew_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/m_tshirt_black_crew_cutout.png',
        '/assets/onboarding/m_tshirt_white_crew_cutout.png',
        '/assets/onboarding/m_tshirt_navy_cutout.png',
      ],
      layer: 1,
    },
    {
      id: 'starter-m-bottom-trousers',
      slot: 'bottom',
      name: 'Charcoal Tailored Trousers',
      glbUrl: '/models/templates/male/bottom_trousers.glb',
      textureUrl: '/assets/onboarding/m_trousers_dress_charcoal_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/m_trousers_dress_charcoal_cutout.png',
        '/assets/onboarding/m_pants_white_linen_cutout.png',
      ],
      layer: 1,
    },
    {
      id: 'starter-m-outerwear-blazer',
      slot: 'outerwear',
      name: 'Charcoal Single-Breasted Blazer',
      glbUrl: '/models/templates/male/jacket_blazer.glb',
      textureUrl: '/assets/onboarding/m_blazer_suit_charcoal_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/m_blazer_suit_charcoal_cutout.png',
        '/assets/onboarding/m_trench_coat_khaki_cutout.png',
      ],
      layer: 2,
    },
    {
      id: 'starter-m-shoes-derby',
      slot: 'shoes',
      name: 'Rich Brown Leather Derby Shoes',
      glbUrl: '/models/templates/male/shoes_sneakers.glb',
      textureUrl: '/assets/onboarding/m_shoes_derby_brown_cutout.png',
      altTextureUrls: [
        '/assets/onboarding/m_shoes_derby_brown_cutout.png',
        '/assets/onboarding/m_loafers_leather_brown_cutout.png',
        '/assets/onboarding/m_sneakers_navy_white_cutout.png',
      ],
      layer: 3,
    },
    {
      id: 'starter-m-acc-belt',
      slot: 'accessories',
      name: 'Tailored Leather Belt',
      glbUrl: '/models/templates/male/accessory_belt.glb',
      textureUrl: null,
      layer: 3,
    },
  ],
});

function createEmptyOutfit() {
  return {
    top: null,
    bottom: null,
    outerwear: null,
    shoes: null,
    accessories: [],
  };
}

function normalizeSlottedGarment(slot, item, gender) {
  if (!item) return null;
  const defaultLayer = SLOT_DEFAULT_LAYERS[slot] ?? 1;
  const resolvedGlbUrl =
    item.glbUrl ||
    item.glb_url ||
    resolveDefaultTemplateGlbForSlot(slot, gender, item);
  const resolvedTextureUrl =
    item.textureUrl !== undefined
      ? item.textureUrl
      : (item.texture_url || resolveEffectiveGarmentUrl(item) || item.clean_image_url || item.image_url || item.url || null);

  const normalized = {
    id: String(item.id || item._id || `${slot}-${Date.now()}`),
    name: item.name || item.title || item.caption || slot,
    glbUrl: resolvedGlbUrl,
    textureUrl: resolvedTextureUrl || null,
    normalMapUrl: item.normalMapUrl || item.normal_map_url || null,
    altTextureUrls: Array.isArray(item.altTextureUrls) ? item.altTextureUrls : [],
    layer: Number.isFinite(Number(item.layer)) ? Number(item.layer) : defaultLayer,
  };

  preloadDressingRoomAsset(normalized.glbUrl);
  return normalized;
}

// Preload canonical base avatars via Draco-configured loader
preloadDressingRoomAsset(FEMALE_AVATAR_GLB);
preloadDressingRoomAsset(MALE_AVATAR_GLB);

export const useDressingRoomStore = create((set, get) => ({
  avatarGender: 'female',
  avatarSkinColor: '#E0AC69',
  bodyMetrics: { ...DEFAULT_BODY_METRICS },
  activeOutfit: createEmptyOutfit(),
  cameraPreset: 'full',

  setAvatarGender: (gender) => {
    const nextGender = normalizeGender(gender);
    preloadDressingRoomAsset(getCanonicalAvatarGlb(nextGender));
    set((state) => {
      const remapItem = (it) =>
        it ? { ...it, glbUrl: remapGenderTemplateUrl(it.glbUrl, nextGender) } : null;
      const nextOutfit = {
        top: remapItem(state.activeOutfit.top),
        bottom: remapItem(state.activeOutfit.bottom),
        outerwear: remapItem(state.activeOutfit.outerwear),
        shoes: remapItem(state.activeOutfit.shoes),
        accessories: (state.activeOutfit.accessories || []).map((acc) => remapItem(acc)).filter(Boolean),
      };
      Object.values(nextOutfit).forEach((entry) => {
        if (Array.isArray(entry)) {
          entry.forEach((a) => preloadDressingRoomAsset(a?.glbUrl));
        } else if (entry?.glbUrl) {
          preloadDressingRoomAsset(entry.glbUrl);
        }
      });
      return {
        avatarGender: nextGender,
        activeOutfit: nextOutfit,
      };
    });
  },

  setAvatarSkinColor: (skinColor) => {
    if (!skinColor || typeof skinColor !== 'string') return;
    set({ avatarSkinColor: skinColor });
  },

  updateBodyMetric: (key, value) => {
    if (!key || typeof key !== 'string') return;
    set((state) => ({
      bodyMetrics: {
        ...state.bodyMetrics,
        [key]: clampMetric01(value, state.bodyMetrics[key] ?? 0.5),
      },
    }));
  },

  setBodyMetric: (key, value) => {
    get().updateBodyMetric(key, value);
  },

  setBodyMetrics: (partialMetrics = {}) => {
    if (!partialMetrics || typeof partialMetrics !== 'object') return;
    set((state) => {
      const next = { ...state.bodyMetrics };
      Object.entries(partialMetrics).forEach(([k, v]) => {
        next[k] = clampMetric01(v, next[k] ?? 0.5);
      });
      return { bodyMetrics: next };
    });
  },

  resetBodyMetrics: () => {
    set({ bodyMetrics: { ...DEFAULT_BODY_METRICS } });
  },

  hydrateFromProfile: (profile = {}) => {
    if (!profile || typeof profile !== 'object') return;
    const nextGender = normalizeGender(
      profile.gender || profile.sex || profile?.measurements?.gender || get().avatarGender
    );
    const rawMetrics =
      profile.bodyMetrics ||
      profile.shape_keys ||
      profile.avatar_shape_params ||
      profile.measurements ||
      profile.body_measurements ||
      profile;
    const computedMetrics = measurementsToBodyMetrics(rawMetrics, nextGender);
    const nextSkin = profile.skin_tone || profile.skinColor || get().avatarSkinColor;

    preloadDressingRoomAsset(getCanonicalAvatarGlb(nextGender));
    set({
      avatarGender: nextGender,
      avatarSkinColor: nextSkin,
      bodyMetrics: computedMetrics,
    });
  },

  slotGarment: (slot, item) => {
    if (!slot) return;
    if (!item) {
      get().unslotGarment(slot);
      return;
    }
    const { avatarGender } = get();
    if (slot === 'accessories') {
      const normalized = normalizeSlottedGarment('accessories', item, avatarGender);
      if (!normalized) return;
      set((state) => {
        const existing = Array.isArray(state.activeOutfit.accessories)
          ? state.activeOutfit.accessories
          : [];
        const filtered = existing.filter((acc) => acc.id !== normalized.id);
        return {
          activeOutfit: {
            ...state.activeOutfit,
            accessories: [...filtered, normalized],
          },
        };
      });
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(SLOT_DEFAULT_LAYERS, slot)) return;
    const normalized = normalizeSlottedGarment(slot, item, avatarGender);
    set((state) => ({
      activeOutfit: {
        ...state.activeOutfit,
        [slot]: normalized,
      },
    }));
  },

  unslotGarment: (slot, accessoryId = null) => {
    if (!slot) return;
    if (slot === 'accessories') {
      set((state) => ({
        activeOutfit: {
          ...state.activeOutfit,
          accessories: accessoryId
            ? (state.activeOutfit.accessories || []).filter((acc) => acc.id !== accessoryId)
            : [],
        },
      }));
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(SLOT_DEFAULT_LAYERS, slot)) return;
    set((state) => ({
      activeOutfit: {
        ...state.activeOutfit,
        [slot]: null,
      },
    }));
  },

  toggleGarmentSlot: (slotOrItem, maybeItem) => {
    let slot = slotOrItem;
    let item = maybeItem;
    if (slotOrItem && typeof slotOrItem === 'object' && !maybeItem) {
      item = slotOrItem;
      slot = slotOrItem.slot;
    }
    if (!slot || !item) return;
    const { activeOutfit } = get();
    if (slot === 'accessories') {
      const exists = (activeOutfit.accessories || []).some((acc) => acc.id === item.id);
      if (exists) {
        get().unslotGarment('accessories', item.id);
      } else {
        get().slotGarment('accessories', item);
      }
      return;
    }
    if (activeOutfit[slot]?.id === item.id) {
      get().unslotGarment(slot);
    } else {
      get().slotGarment(slot, item);
    }
  },

  swapGarmentTexture: (slot, textureUrl, options = {}) => {
    if (!slot) return;
    const { accessoryId = null, normalMapUrl } = options;
    set((state) => {
      if (slot === 'accessories') {
        const nextAccessories = (state.activeOutfit.accessories || []).map((acc) => {
          if (accessoryId && acc.id !== accessoryId) return acc;
          return {
            ...acc,
            textureUrl: textureUrl ?? null,
            ...(normalMapUrl !== undefined ? { normalMapUrl } : {}),
          };
        });
        return {
          activeOutfit: {
            ...state.activeOutfit,
            accessories: nextAccessories,
          },
        };
      }

      const current = state.activeOutfit[slot];
      if (!current) return state;
      return {
        activeOutfit: {
          ...state.activeOutfit,
          [slot]: {
            ...current,
            textureUrl: textureUrl ?? null,
            ...(normalMapUrl !== undefined ? { normalMapUrl } : {}),
          },
        },
      };
    });
  },

  swapTexture: (slot, textureUrl, options = {}) => {
    get().swapGarmentTexture(slot, textureUrl, options);
  },

  clearOutfit: () => {
    set({ activeOutfit: createEmptyOutfit() });
  },

  setCameraPreset: (preset) => {
    if (!VALID_CAMERA_PRESETS.includes(preset)) return;
    set({ cameraPreset: preset });
  },

  syncFromAppOutfit: (outfitItems = {}, gender) => {
    const nextGender = gender ? normalizeGender(gender) : get().avatarGender;
    const nextOutfit = createEmptyOutfit();
    Object.entries(outfitItems || {}).forEach(([rawSlot, rawItem]) => {
      if (!rawItem) return;
      const slotKey = String(rawSlot).toLowerCase();
      if (slotKey === 'top' || slotKey === 'dress') {
        nextOutfit.top = normalizeSlottedGarment('top', rawItem, nextGender);
      } else if (slotKey === 'bottom') {
        nextOutfit.bottom = normalizeSlottedGarment('bottom', rawItem, nextGender);
      } else if (slotKey === 'outerwear') {
        nextOutfit.outerwear = normalizeSlottedGarment('outerwear', rawItem, nextGender);
      } else if (slotKey === 'shoes' || slotKey === 'footwear') {
        nextOutfit.shoes = normalizeSlottedGarment('shoes', rawItem, nextGender);
      } else {
        const acc = normalizeSlottedGarment('accessories', rawItem, nextGender);
        if (acc) nextOutfit.accessories.push(acc);
      }
    });
    set({
      avatarGender: nextGender,
      activeOutfit: nextOutfit,
    });
  },
}));

export default useDressingRoomStore;
