/**
 * apps/mobile/src/lib/garmentNormalizer.ts
 *
 * Deep module: Garment Attribute Normalization & Form State Synthesis.
 *
 * Consolidates attribute extraction, weighted tag normalization (colors,
 * fabric materials), formality mapping, and form state initialization into
 * a single tested seam.
 */

import { resolveDisplayUrl } from './imageUtils';

export interface WeightedItem {
  name: string;
  pct: number | null;
}

export interface ItemFormState {
  title: string;
  name: string;
  brand: string;
  caption: string;
  category: string;
  sub_category: string;
  item_type: string;
  gender: string;
  dress_code: string;
  season: string[];
  tradition: string;
  size: string;
  color: string;
  colors: WeightedItem[];
  pattern: string;
  fabric_materials: WeightedItem[];
  state: string;
  condition: string;
  quality: string;
  repair_advice: string;
  price_cents: number;
  currency: string;
  marketplace_intent: string;
  tags: string[];
  cultural_tags: string[];
  notes: string;
  formality: string;
  clean_image_url?: string | null;
  reconstructed_image_url?: string | null;
  original_image_url?: string | null;
  image_url?: string | null;
  thumbnail_data_url?: string | null;
  placeholder_data_url?: string | null;
  segmented_image_url?: string | null;
  cutout_url?: string | null;
  image_variants?: any;
}

/**
 * Normalizes color array or single color string into structured WeightedItem array.
 * If multiple colors are provided without explicit percentage, pct is null (percentage unknown).
 * If only a single fallback color is given, it defaults to 100%.
 */
export function normalizeColors(colors: any, fallbackColor?: string | null): WeightedItem[] {
  if (Array.isArray(colors) && colors.length > 0) {
    return colors
      .map((c: any) => {
        const name = typeof c === 'string' ? c.trim() : (c?.name || '').trim();
        const pct = typeof c === 'object' && c?.pct != null ? Number(c.pct) : null;
        return { name, pct };
      })
      .filter((c) => Boolean(c.name));
  }

  if (fallbackColor && String(fallbackColor).trim()) {
    return [{ name: String(fallbackColor).trim(), pct: 100 }];
  }

  return [];
}

/**
 * Normalizes fabric materials array or fallback fabric/material string into structured WeightedItem array.
 * Handles defensive fallback from 'percentage' to 'pct' for legacy documents.
 */
export function normalizeFabricMaterials(materials: any, fallbackFabric?: string | null): WeightedItem[] {
  if (Array.isArray(materials) && materials.length > 0) {
    return materials
      .map((m: any) => {
        const name = typeof m === 'string' ? m.trim() : (m?.name || m?.tag || '').trim();
        const rawPct =
          typeof m === 'object' && m?.pct != null
            ? m.pct
            : typeof m === 'object' && m?.percentage != null
            ? m.percentage
            : null;
        const pct = rawPct != null ? Number(rawPct) : null;
        return { name, pct };
      })
      .filter((m) => Boolean(m.name));
  }

  if (fallbackFabric && String(fallbackFabric).trim()) {
    return [{ name: String(fallbackFabric).trim(), pct: 100 }];
  }

  return [];
}

const VALID_FORMALITIES = new Set(['casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear']);

export function normalizeFormality(formality?: string | null, dressCode?: string | null): string {
  const f = (formality || '').toLowerCase().replace(/\s+/g, '-');
  if (VALID_FORMALITIES.has(f)) return f;

  const d = (dressCode || '').toLowerCase().replace(/\s+/g, '-');
  if (VALID_FORMALITIES.has(d)) return d;

  return 'casual';
}

export function normalizeSeason(season: any): string[] {
  if (Array.isArray(season)) {
    const cleaned = season.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : ['all'];
  }
  if (typeof season === 'string' && season.trim()) {
    return [season.trim().toLowerCase()];
  }
  return ['all'];
}

/**
 * Transforms any raw item or analysis payload into a standardized ItemFormState.
 */
export function normalizeGarmentFormState(
  data: any,
  options?: { size?: string }
): ItemFormState {
  const rawColors = normalizeColors(data?.colors, data?.color);
  const rawMaterials = normalizeFabricMaterials(
    data?.fabric_materials,
    data?.material || data?.fabric
  );
  const validFormality = normalizeFormality(data?.formality, data?.dress_code);

  const cat = data?.category || 'Top';
  const subCat = data?.sub_category || data?.subcategory || '';
  const itemType = data?.item_type || '';

  const resolvedSize = options?.size ?? (data?.size ? String(data.size).trim() : '');

  return {
    title: data?.title || data?.name || '',
    name: data?.name || data?.title || '',
    brand: data?.brand || '',
    caption: data?.caption || '',
    category: cat,
    sub_category: subCat,
    item_type: itemType,
    gender: data?.gender || 'unisex',
    dress_code: data?.dress_code || validFormality,
    formality: validFormality,
    season: normalizeSeason(data?.season),
    tradition: data?.tradition || '',
    size: resolvedSize,
    color: data?.color || rawColors[0]?.name || '',
    colors: rawColors,
    pattern: data?.pattern || 'solid',
    fabric_materials: rawMaterials,
    state: data?.state || 'used',
    condition: data?.condition || 'good',
    quality: data?.quality || 'mid',
    repair_advice: data?.repair_advice || '',
    price_cents: Math.round(Number(data?.price_cents ?? (data?.price ? data.price * 100 : 0)) / 100),
    currency: data?.currency || 'USD',
    marketplace_intent: data?.marketplace_intent || data?.intent || 'own',
    tags: Array.isArray(data?.tags) ? data.tags : [],
    cultural_tags: Array.isArray(data?.cultural_tags) ? data.cultural_tags : [],
    notes: data?.notes || '',
    clean_image_url: data?.clean_image_url || null,
    reconstructed_image_url: resolveDisplayUrl(data?.reconstructed_image_url),
    original_image_url: data?.original_image_url || null,
    image_url: data?.image_url || null,
    thumbnail_data_url: data?.thumbnail_data_url || null,
    placeholder_data_url: data?.placeholder_data_url || null,
    segmented_image_url: data?.segmented_image_url || null,
    cutout_url: data?.cutout_url || null,
    image_variants: data?.image_variants || null,
  };
}
