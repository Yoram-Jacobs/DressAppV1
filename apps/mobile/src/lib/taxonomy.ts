/**
 * apps/mobile/src/lib/taxonomy.ts
 *
 * Taxonomy label helpers and canonical option constants for DressApp Mobile.
 */

import type { TFunction } from 'i18next';

export const CATEGORY_OPTIONS = [
  'Top',
  'Bottom',
  'Full Body',
  'Outerwear',
  'Footwear',
  'Accessories',
] as const;

export const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Top: ['T-Shirt', 'Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Polo', 'Tank Top', 'Crop Top', 'Vest', 'Knitwear'],
  Bottom: ['Jeans', 'Trousers', 'Pants', 'Shorts', 'Skirt', 'Leggings', 'Sweatpants', 'Cargo Pants'],
  'Full Body': ['Dress', 'Jumpsuit', 'Romper', 'Suit', 'Overall', 'Abaya', 'Kaftan'],
  Outerwear: ['Jacket', 'Coat', 'Blazer', 'Trench', 'Cardigan', 'Parka', 'Windbreaker', 'Puffer', 'Bomber'],
  Footwear: ['Sneakers', 'Boots', 'Loafers', 'Sandals', 'Heels', 'Flats', 'Oxfords', 'Slippers', 'Espadrilles'],
  Accessories: ['Bag', 'Belt', 'Hat', 'Scarf', 'Sunglasses', 'Jewelry', 'Watch', 'Tie', 'Gloves', 'Wallet'],
};

export const COLOR_OPTIONS = [
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#F9FAFB' },
  { name: 'Grey', hex: '#6B7280' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Beige', hex: '#D4B996' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Cream', hex: '#FEF3C7' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Olive', hex: '#556B2F' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gold', hex: '#D97706' },
  { name: 'Silver', hex: '#9CA3AF' },
];

export const SEASON_OPTIONS = ['spring', 'summer', 'autumn', 'winter', 'all'] as const;

export const FORMALITY_OPTIONS = ['casual', 'smart-casual', 'business', 'formal'] as const;

export const GENDER_OPTIONS = ['men', 'women', 'unisex', 'kids'] as const;

export const DRESS_CODE_OPTIONS = [
  'casual',
  'smart-casual',
  'business',
  'formal',
  'athletic',
  'loungewear',
] as const;

export const CONDITION_OPTIONS = ['bad', 'fair', 'good', 'excellent'] as const;

export const QUALITY_OPTIONS = ['budget', 'mid', 'premium', 'luxury'] as const;

export const INTENT_OPTIONS = ['own', 'for_sale', 'donate', 'swap', 'rent'] as const;

export const PATTERN_OPTIONS = [
  'solid',
  'striped',
  'plaid',
  'floral',
  'polka_dot',
  'geometric',
  'animal_print',
  'graphic',
  'tie_dye',
  'abstract',
] as const;

const slug = (value?: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const fallback = (t: TFunction, key: string, raw?: string) => {
  try {
    const out = t(key, { defaultValue: raw ?? '' });
    if (!out || typeof out !== 'string' || out === key || out.includes('returned an object instead of string')) {
      return raw ?? '';
    }
    return out;
  } catch {
    return raw ?? '';
  }
};

export const labelForCategory = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  if (code === 'all' || code === '__all__') return fallback(t, 'taxonomy.categories.all', 'All');
  return fallback(t, `taxonomy.categories.${slug(code)}`, code);
};

export const labelForSubCategory = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.subcategories.${slug(code)}`, code);
};

export const labelForSeason = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.charAt(0).toUpperCase() + code.slice(1);
  return fallback(t, `taxonomy.season.${s}`, capitalized);
};

export const labelForFormality = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.dress_code.${s}`, fallback(t, `taxonomy.formality.${s}`, capitalized));
};

export const labelForDressCode = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.dress_code.${s}`, capitalized);
};

export const labelForCondition = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.condition.${s}`, capitalized);
};

export const labelForQuality = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.quality.${s}`, capitalized);
};

export const labelForIntent = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  let normalized = code.toLowerCase().trim();
  if (normalized === 'keep') normalized = 'own';
  if (normalized === 'sell') normalized = 'for_sale';
  const map: Record<string, string> = {
    own: 'Keep',
    for_sale: 'For sale',
    donate: 'Donate',
    swap: 'Swap',
    rent: 'Rent',
  };
  return fallback(t, `addItem.intent_${normalized}`, fallback(t, `taxonomy.intent.${normalized}`, map[normalized] || code));
};

export const labelForColor = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const colorSlug = slug(code);
  const keySingular = `taxonomy.color.${colorSlug}`;
  const keyPlural = `taxonomy.colors.${colorSlug}`;
  return fallback(t, keySingular, fallback(t, keyPlural, code));
};

export const labelForGender = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.gender.${code}`, code);
};

export const labelForState = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.state.${code}`, code);
};

export const labelForSource = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  if (code === 'all') return fallback(t, 'taxonomy.source.all', 'All sources');
  return fallback(t, `taxonomy.source.${code}`, code);
};

export const labelForRole = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.role.${code}`, code);
};

export const labelForItemType = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.subcategories.${slug(code)}`, code);
};

export const labelForPattern = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.pattern.${s}`, capitalized);
};

export const labelForProfession = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  if (code === 'all' || code === '__all__') return fallback(t, 'closet.filterAll', 'All');
  const s = slug(code);
  const canonicalMap: Record<string, string> = {
    fashion_designer: 'designer',
    personal_stylist: 'stylist',
    fashion_stylist: 'stylist',
    stylist: 'stylist',
    tailor: 'tailor',
    seamstress: 'tailor',
    'tailor_/_seamstress': 'tailor',
    barber: 'barber',
    hair_stylist: 'hair_stylist',
    ai_for_fashion: 'ai_fashion',
    ai_fashion: 'ai_fashion',
    personal_shopper: 'shopper',
    shopper: 'shopper',
    wardrobe_consultant: 'consultant',
    consultant: 'consultant',
    color_analyst: 'color',
    color: 'color',
  };
  const mappedSlug = canonicalMap[s] || s;
  return fallback(
    t,
    `experts.professions.${mappedSlug}`,
    fallback(t, `experts.professions.${s}`, fallback(t, `taxonomy.professions.${s}`, code))
  );
};


