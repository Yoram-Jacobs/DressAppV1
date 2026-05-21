import { Shirt, HandCoins, Gift, Repeat } from 'lucide-react';
import { deriveSizeFromPreferences } from '@/lib/size_preferences';

export const CATEGORY_OPTIONS = [
  'Top', 'Bottom', 'Outerwear', 'Full Body', 'Footwear', 'Accessories', 'Underwear',
];

export const DRESS_CODE_OPTIONS = [
  'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear',
];

export const GENDER_OPTIONS = ['men', 'women', 'unisex', 'kids'];
export const SEASON_OPTIONS = ['spring', 'summer', 'fall', 'winter', 'all'];
export const STATE_OPTIONS = ['new', 'used'];
export const CONDITION_OPTIONS = ['bad', 'fair', 'good', 'excellent'];
export const QUALITY_OPTIONS = ['budget', 'mid', 'premium', 'luxury'];

export const PATTERN_OPTIONS = [
  'solid', 'striped', 'plaid', 'floral', 'herringbone', 'polka', 'paisley',
  'geometric', 'abstract',
];

export const INTENT_OPTIONS = [
  { value: 'own', icon: Shirt, tone: 'bg-slate-100 text-slate-900 border-slate-200' },
  { value: 'for_sale', icon: HandCoins, tone: 'bg-amber-100 text-amber-900 border-amber-200' },
  { value: 'donate', icon: Gift, tone: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  { value: 'swap', icon: Repeat, tone: 'bg-sky-100 text-sky-900 border-sky-200' },
];

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const s = String(r.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.readAsDataURL(file);
  });

export const fmtCents = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(
    (cents || 0) / 100
  );

export const blankFields = () => ({
  name: '', title: '', caption: '',
  category: '', sub_category: '', item_type: '', brand: '',
  gender: '', dress_code: '', season: [], tradition: '',
  colors: [], fabric_materials: [], pattern: '',
  state: '', condition: '', quality: '',
  size: '', price_cents: 0, currency: 'USD',
  marketplace_intent: 'own',
  repair_advice: '',
  tags: [],
});

/** Coerce analyze payload into a plain, editable form dict. */
export const hydrate = (a, user) => {
  const out = {
    ...blankFields(),
    ...Object.fromEntries(
      Object.entries(a || {}).filter(([k]) => k in blankFields()),
    ),
  };
  if (user && (!out.size || String(out.size).trim() === '')) {
    const pref = deriveSizeFromPreferences(user, out);
    if (pref) out.size = pref;
  }
  return out;
};

export const buildCreatePayload = (card) => {
  const f = card.fields || {};
  const asBase64 = card.base64;
  // Drop empty/falsy optional keys to satisfy enum validators on the backend.
  const body = {
    source: f.marketplace_intent && f.marketplace_intent !== 'own' ? 'Shared' : 'Private',
    name: f.name || undefined,
    title: f.name || f.title || 'Unnamed garment',
    caption: f.caption || undefined,
    category: f.category || 'Top',
    sub_category: f.sub_category || undefined,
    item_type: f.item_type || undefined,
    brand: f.brand || undefined,
    gender: f.gender || undefined,
    dress_code: f.dress_code || undefined,
    season: f.season || [],
    tradition: f.tradition || undefined,
    size: f.size || undefined,
    color: (f.colors && f.colors[0]?.name) || undefined,
    colors: (f.colors || []).filter((c) => c.name),
    fabric_materials: (f.fabric_materials || []).filter((c) => c.name),
    pattern: f.pattern || undefined,
    state: f.state || undefined,
    condition: f.condition || undefined,
    quality: f.quality || undefined,
    repair_advice: f.repair_advice || undefined,
    price_cents: f.price_cents === '' || f.price_cents == null ? 0 : Number(f.price_cents),
    currency: f.currency || 'USD',
    marketplace_intent: f.marketplace_intent || 'own',
    tags: f.tags || [],
    image_base64: asBase64 || undefined,
    crop_base64: card.cropBase64 || undefined,
    image_mime: asBase64 ? (card.mime || card.file?.type || 'image/jpeg') : undefined,
    reconstructed_image_b64: card.useReconstructed && card.reconstructedB64
      ? card.reconstructedB64
      : undefined,
    reconstruction_metadata: card.useReconstructed && card.reconstructionMeta
      ? card.reconstructionMeta
      : undefined,
    dpp_data: card.dppData || undefined,
    source_sha256: card.sourceSha256 || undefined,
    source_phash: card.sourcePhash || undefined,
    source_color_sig: card.sourceColorSig || undefined,
    source_filename: card.sourceFilename || undefined,
    source_size_bytes:
      typeof card.sourceSizeBytes === 'number' ? card.sourceSizeBytes : undefined,
    is_duplicate: card.isDuplicate ? true : undefined,
    from_one_pass: card.fromOnePass ? true : undefined,
    defer_matte: card.deferMatte ? true : undefined,
  };
  // Strip undefined to keep payload clean
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
};
