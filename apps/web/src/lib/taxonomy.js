/**
 * Taxonomy label helpers.
 *
 * The backend stores stable English codes for category / dress_code / gender /
 * season / state / condition / quality / pattern / formality / intent / source,
 * and `role` for stylist recommendation items. This module converts those
 * codes into display labels honoring the active i18next locale, with a safe
 * fallback that keeps the original code if we don't have a translation yet.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   <SelectItem value="top">{labelForCategory('top', t)}</SelectItem>
 */

/**
 * Normalize a taxonomy code into the key shape we use in locale files.
 *
 * Category labels in the DB/API often arrive capitalized (e.g. "Top",
 * "Full Body", "Accessories"). We map them to lowercase with underscore
 * separators so JSON keys stay predictable.
 */
export const slug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

export const FIT_OPTIONS = ['slim', 'regular', 'loose', 'oversized', 'flared'];

const FIT_FALLBACK_EN = {
  slim: 'Slim Fit',
  regular: 'Regular Fit',
  loose: 'Loose / Relaxed Fit',
  oversized: 'Oversized Fit',
  flared: 'Flared / A-Line',
};

const FIT_FALLBACK_HE = {
  slim: '???? ????? (Slim)',
  regular: '???? ????? (Regular)',
  loose: '???? ????? / ???? (Loose)',
  oversized: '???????? (Oversized)',
  flared: '?????? / ???? A (Flared)',
};

export const labelForFit = (value, t) => {
  if (!value) return '';
  const code = slug(value).replace(/-/g, '_');
  const isHe = typeof document !== 'undefined' && document.documentElement?.dir === 'rtl';
  if (typeof t === 'function') {
    const key = `taxonomy.fit.${code}`;
    const res = t(key, { defaultValue: '' });
    if (res && res !== key) return res;
  }
  if (isHe && FIT_FALLBACK_HE[code]) return FIT_FALLBACK_HE[code];
  return FIT_FALLBACK_EN[code] || String(value);
};

export const CANONICAL_CATEGORY_KEYS = {
  // Hebrew
  '??? ?????': 'top',
  '???_?????': 'top',
  '?????': 'top',
  '???': 'top',
  '?????': 'top',
  '??????': 'top',
  '??? ?????': 'bottom',
  '???_?????': 'bottom',
  '?????': 'bottom',
  '???????': 'bottom',
  '????': 'bottom',
  '????': 'outerwear',
  '??????': 'outerwear',
  '???????': 'outerwear',
  '????????': 'outerwear',
  "?'??": 'outerwear',
  "?'??": 'outerwear',
  '??? ???': 'full_body',
  '???_???': 'full_body',
  '????': 'full_body',
  '?????': 'full_body',
  '??????': 'full_body',
  '????': 'full_body',
  '?????': 'footwear',
  '??????': 'shoes',
  '????': 'shoes',
  '????????': 'accessories',
  '?????': 'accessory',
  '???????': 'accessories',
  '????? ??????': 'underwear',
  '?????_??????': 'underwear',
  '???? ??': 'swimwear',
  '????_??': 'swimwear',
  '???? ?????': 'activewear',
  '????_?????': 'activewear',
  '?????? ???': 'headwear',
  '??????_???': 'headwear',
  '????': 'headwear',
  '??????': 'headwear',
  '???????': 'glasses',
  '?????': 'glasses',
  '?????': 'belt',
  '??????': 'belt',
  // English / standard
  'top': 'top',
  'tops': 'top',
  'bottom': 'bottom',
  'bottoms': 'bottom',
  'outerwear': 'outerwear',
  'full_body': 'full_body',
  'full body': 'full_body',
  'one_piece': 'full_body',
  'one-piece': 'full_body',
  'footwear': 'footwear',
  'shoes': 'shoes',
  'shoe': 'shoes',
  'accessories': 'accessories',
  'accessory': 'accessory',
  'underwear': 'underwear',
  'dress': 'dress',
  'swimwear': 'swimwear',
  'activewear': 'activewear',
  'headwear': 'headwear',
  'hat': 'headwear',
  'glasses': 'glasses',
  'belt': 'belt',
};

export const canonicalCategoryKey = (code) => {
  if (!code) return '';
  const raw = String(code).trim().toLowerCase();
  const normalizedSlug = raw.replace(/\s+/g, '_');
  return CANONICAL_CATEGORY_KEYS[raw] || CANONICAL_CATEGORY_KEYS[normalizedSlug] || normalizedSlug;
};

const fallback = (t, key, raw) => {
  const out = t(key, { defaultValue: raw ?? '' });
  // i18next will return the key itself when nothing matches ? degrade to raw.
  if (!out || out === key) return raw ?? '';
  return out;
};

export const labelForCategory = (code, t) => {
  if (!code) return '';
  if (code === 'all') return fallback(t, 'taxonomy.categories.all', 'All');
  const catKey = canonicalCategoryKey(code);
  const key = `taxonomy.categories.${catKey}`;
  return fallback(t, key, code);
};

export const labelForDressCode = (code, t) => {
  if (!code) return '';
  // Keep the original code (e.g. "smart-casual") so JSON keys match.
  const key = `taxonomy.dress_code.${code}`;
  return fallback(t, key, code);
};

export const labelForGender = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.gender.${code}`;
  return fallback(t, key, code);
};

export const labelForSeason = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.season.${code}`;
  return fallback(t, key, code);
};

export const labelForState = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.state.${code}`;
  return fallback(t, key, code);
};

export const labelForCondition = (code, t) => {
  if (!code) return '';
  const normalized = String(code).trim().toLowerCase().replace(/\s+/g, '_');
  const key = `taxonomy.condition.${normalized}`;
  const rawFallback = normalized.replace(/_/g, ' ');
  return fallback(t, key, rawFallback);
};

export const labelForQuality = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.quality.${code}`;
  return fallback(t, key, code);
};

export const labelForPattern = (code, t) => {
  if (!code) return '';
  const normalized = String(code).trim().toLowerCase().replace(/[- ]/g, '_');
  let mapped = normalized === 'print' ? 'printed' : normalized;
  if (mapped === 'camo' || mapped === 'camouflaged') mapped = 'camouflage';
  if (mapped === 'embroidery') mapped = 'embroidered';
  const key = `taxonomy.pattern.${mapped}`;
  return fallback(t, key, code);
};

export const labelForFormality = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.formality.${code}`;
  return fallback(t, key, code);
};

export const labelForIntent = (code, t) => {
  if (!code) return '';
  let normalized = String(code).trim().toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'keep') normalized = 'own';
  if (normalized === 'sell') normalized = 'for_sale';
  const map = {
    own: 'Keep',
    for_sale: 'For sale',
    donate: 'Donate',
    swap: 'Swap',
    rent: 'Rent',
  };
  const key = `taxonomy.intent.${normalized}`;
  const addItemKey = `addItem.intent_${normalized}`;
  return fallback(t, key, fallback(t, addItemKey, map[normalized] || code));
};

export const labelForSource = (code, t) => {
  if (!code) return '';
  if (code === 'all') return fallback(t, 'taxonomy.source.all', 'All sources');
  // Source codes in the DB are capitalized: Private | Shared | Retail.
  const key = `taxonomy.source.${code}`;
  return fallback(t, key, code);
};

export const labelForRole = (code, t) => {
  if (!code) return '';
  const normalized = slug(code);
  const aliasMap = {
    footwear: 'shoes',
    shoe: 'shoes',
    accessories: 'accessory',
    full_body: 'dress',
    one_piece: 'dress',
  };
  const finalRole = aliasMap[normalized] || normalized;
  const key = `taxonomy.role.${finalRole}`;
  return fallback(t, key, fallback(t, `taxonomy.categories.${finalRole}`, code));
};

const CANONICAL_COLORS = {
  // English
  'white': 'white',
  'black': 'black',
  'grey': 'grey',
  'gray': 'grey',
  'light_grey': 'light_grey',
  'light_gray': 'light_grey',
  'burgundy': 'burgundy',
  'bordeaux': 'burgundy',
  'brown': 'brown',
  'blue': 'blue',
  'light_blue': 'light_blue',
  'sky_blue': 'sky_blue',
  'baby_blue': 'baby_blue',
  'cyan': 'cyan',
  'navy': 'navy',
  'navy_blue': 'navy',
  'dark_blue': 'navy',
  'dark_blue_gray': 'charcoal_grey',
  'blue_gray': 'charcoal_grey',
  'charcoal': 'charcoal',
  'charcoal_grey': 'charcoal',
  'charcoal_gray': 'charcoal',
  'green': 'green',
  'mint': 'mint',
  'mint_green': 'mint',
  'olive': 'olive',
  'olive_green': 'olive',
  'yellow': 'yellow',
  'orange': 'orange',
  'pink': 'pink',
  'purple': 'purple',
  'terracotta': 'terracotta_brown',
  'terracotta_brown': 'terracotta_brown',
  'beige': 'beige',
  'cream': 'cream',
  'champagne_gold': 'champagne_gold',
  'champagne': 'champagne_gold',
  'gold': 'champagne_gold',
  'red': 'red',
  'dark_grey': 'charcoal',
  'dark_gray': 'charcoal',
  'turquoise': 'turquoise',
  'teal': 'teal',
  'silver': 'light_grey',
  'bronze': 'brown',
  'mustard': 'yellow',
  'peach': 'peach',
  'lilac': 'purple',
  'lavender': 'lavender',
  'khaki': 'beige',
  'coral': 'coral',
  'fuchsia': 'pink',
  'magenta': 'pink',
  'plum': 'purple',
  'plum_purple': 'purple',
  'emerald_green': 'green',
  'dark_green': 'green',
  'crimson_red': 'burgundy',
  'royal_blue': 'blue',
  'indigo': 'indigo',
  'maroon': 'burgundy',
  
  // Hebrew
  '???': 'white',
  '????': 'black',
  '????': 'grey',
  '????_????': 'light_grey',
  '?????': 'burgundy',
  '???': 'brown',
  '????': 'blue',
  '????': 'light_blue',
  '????_????': 'light_blue',
  '????_?????': 'sky_blue',
  '?????': 'sky_blue',
  '????_????': 'baby_blue',
  '????': 'cyan',
  '??????': 'turquoise',
  '????_???': 'navy',
  '????_?????': 'navy',
  '????_????_???': 'charcoal',
  '????': 'green',
  '????': 'mint',
  '????_????': 'mint',
  '????_???': 'olive',
  '????': 'yellow',
  '????': 'orange',
  '????': 'pink',
  '????': 'purple',
  '???_????': 'terracotta_brown',
  '???????': 'terracotta_brown',
  '??\'': 'beige',
  '??': 'beige',
  '???': 'cream',
  '???': 'champagne_gold',
  '??????': 'champagne_gold',
  '????': 'red',
  '????_???': 'charcoal',
  '????_????': 'charcoal',
  '????_???': 'charcoal',
  '???': 'light_grey',
  '??????': 'brown',
  '????': 'yellow',
  '?????': 'peach',
  '????': 'purple',
  '?????': 'lavender',
  '????': 'beige',
  '????': 'coral',
  '??????': 'pink',
  '?????': 'pink',
  '????': 'purple',
  '????_?????': 'teal',
  '???????': 'indigo',
  '???_??????': 'burgundy',

  // Russian
  '?????': 'white',
  '??????': 'black',
  '??????': 'black',
  '?????': 'grey',
  '??????_?????': 'light_grey',
  '????????': 'burgundy',
  '?????': 'burgundy',
  '??????????': 'brown',
  '?????': 'blue',
  '???????': 'light_blue',
  '?????_?????': 'navy',
  '???????': 'green',
  '???????': 'green',
  '?????????': 'olive',
  '??????': 'yellow',
  '??????': 'yellow',
  '?????????': 'orange',
  '???????': 'pink',
  '??????????': 'purple',
  '????????????': 'terracotta_brown',
  '???????': 'beige',
  '????????': 'cream',
  '???????': 'champagne_gold',
  '???????': 'champagne_gold',
  '???????': 'red',

  // Arabic
  '????': 'red',
  '????': 'red',

  // French
  'rouge': 'red',

  // Spanish
  'rojo': 'red',

  // German
  'rot': 'red',

  // Italian
  'rosso': 'red',

  // Portuguese
  'vermelho': 'red',

  // Hindi
  '???': 'red',

  // Japanese
  '?': 'red',

  // Chinese
  '?': 'red',
  '??': 'red'
};

export const canonicalColorKey = (code) => {
  if (!code) return '';
  const normalized = String(code)
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_?-??-??]/g, '');
  return CANONICAL_COLORS[normalized] || slug(code);
};

export const labelForColor = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.color.${canonicalColorKey(code)}`;
  return fallback(t, key, code);
};

/**
 * Sub-category / item-type labels.
 *
 * Backend stores these as free-form English text (e.g., "Pants", "Shorts",
 * "Oxford shirt"). We normalize to a slug and look up a localized label; if
 * we don't have a translation we return the raw value unchanged so non-
 * dictionary garments (e.g., brand-specific nomenclature) still render.
 */
const itemSlug = (value) => {
  const s = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['?`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (s === 'cargo' || s === 'cargos') return 'cargo_pants';
  if (s === 'cargo_short' || s === 'cargo_shorts') return 'cargo_shorts';
  if (s.includes('high_heel') || s.includes('pump') || s === 'heels' || s === 'high_heel_pump' || s === 'high_heel_pumps') return 'heels';
  if (s === 'long_sleeve_sv' || s === 'long_sleeve_sweater' || s === 'knit_sweater') return 'sweater';
  if (s === 'casual_jacket' || s === 'hooded_jacket') return 'casual_jacket';
  if (s === 'chino' || s === 'chinos') return 'chinos';
  if (s === 'pant' || s === 'pants') return 'pants';
  if (s === 'hoodie' || s === 'sweatshirt' || s.includes('hoodie')) {
    if (s.includes('zip') || s.includes('zipper')) return 'zip_hoodie';
    return 'hoodie';
  }
  return s;
};

export const canonicalSubCategoryKey = (raw) => {
  if (!raw) return '';
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/['?`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^\p{L}\p{M}\p{N}_]/gu, '');

  // Cultural Traditional Attire & Headwear
  if (normalized.includes('galabiya') || normalized.includes('djellaba') || normalized.includes('jalabiya') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('???????') || normalized.includes('galabija')) return 'galabiya';
  if (normalized.includes('kaftan') || normalized.includes('caftan') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('caftano') || normalized.includes('cafta')) return 'kaftan';
  if (normalized.includes('thobe') || normalized.includes('thoub') || normalized.includes('kandura') || normalized.includes('dishdasha') || normalized.includes('???') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('???') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('???') || normalized.includes('???????')) return 'thobe';
  if (normalized.includes('abaya') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('abaia')) return 'abaya';
  if (normalized.includes('kurta') || normalized.includes('kurti') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('??????')) return 'kurta';
  if (normalized.includes('sherwani') || normalized.includes('achkan') || normalized.includes('bandhgala') || normalized.includes('???????') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('??\'???') || normalized.includes('???????') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('????????') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('???????') || normalized.includes('????') || normalized.includes('???????') || normalized.includes('scherwani')) return 'sherwani';
  if (normalized.includes('sari') || normalized.includes('saree') || normalized.includes('????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('?????')) return 'sari';
  if (normalized.includes('lehenga') || normalized.includes('lengha') || normalized.includes('chaniya_choli') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('???????')) return 'lehenga';
  if (normalized.includes('hanbok') || normalized.includes('chima_jeogori') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('??')) return 'hanbok';
  if (normalized.includes('kimono') || normalized.includes('yukata') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('??') || normalized.includes('??') || normalized.includes('??')) return 'kimono';
  if (normalized.includes('dirndl') || normalized.includes('trachtenkleid') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('???????')) return 'dirndl';
  if (normalized.includes('guayabera') || normalized.includes('chacabana') || normalized.includes('?????????') || normalized.includes('???????') || normalized.includes('?????????') || normalized.includes('????????')) return 'guayabera';
  if (normalized.includes('dhoti') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????')) return 'dhoti';
  if (normalized.includes('salwar') || normalized.includes('shalwar') || normalized.includes('sharwal') || normalized.includes('sirwal') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????????') || normalized.includes('?????')) return 'salwar';

  // Traditional Headwear & Accessories
  if (normalized.includes('kippah') || normalized.includes('yarmulke') || normalized.includes('yarmulka') || normalized.includes('kipa') || normalized.includes('????') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('??????')) return 'kippah';
  if (normalized.includes('keffiyeh') || normalized.includes('shemagh') || normalized.includes('ghutra') || normalized.includes('kufiyya') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????????')) return 'keffiyeh';
  if (normalized.includes('turban') || normalized.includes('dastar') || normalized.includes('pagri') || normalized.includes('pagdi') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('?????')) return 'turban';
  if (normalized.includes('hijab') || normalized.includes('sheila') || normalized.includes('shayla') || normalized.includes('khimar') || normalized.includes('?????') || normalized.includes('???\'??') || normalized.includes('?????') || normalized.includes('??\'??') || normalized.includes('????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('?????')) return 'hijab';
  if (normalized.includes('mitpachat') || normalized.includes('tichel') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('????????') || normalized.includes('??????') || normalized.includes('??????')) return 'mitpachat';
  if (normalized.includes('shtreimel') || normalized.includes('spodik') || normalized.includes('???????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('???????') || normalized.includes('????????') || normalized.includes('?????????')) return 'shtreimel';
  if (normalized.includes('tarboush') || normalized.includes('tarbush') || normalized.includes('fez') || normalized.includes('?????') || normalized.includes('??') || normalized.includes('?????') || normalized.includes('???') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('????')) return 'tarboush';
  if (normalized.includes('rumal') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????')) return 'rumal';

  if (
    normalized.includes('basket_bag') ||
    normalized.includes('wicker_bag') ||
    normalized.includes('straw_bag') ||
    normalized.includes('??_??') ||
    normalized.includes('???_??') ||
    normalized.includes('???_??') ||
    normalized.includes('???_??') ||
    normalized.includes('?????_???') ||
    normalized.includes('?????_??') ||
    normalized.includes('korbtasche') ||
    normalized.includes('capazo') ||
    normalized.includes('cesta') ||
    normalized.includes('sac_panier') ||
    normalized.includes('panier') ||
    normalized.includes('?????') ||
    normalized.includes('?????') ||
    normalized.includes('???') ||
    normalized.includes('???') ||
    normalized.includes('???????_???') ||
    normalized.includes('borsa_a_cesto') ||
    normalized.includes('mandtas') ||
    normalized.includes('korftas') ||
    normalized.includes('bolsa_de_palha') ||
    normalized.includes('?????_???????') ||
    normalized.includes('????????_?????')
  ) return 'basket_bags';

  if (normalized.includes('sports_bra') || normalized.includes('????_?????') || normalized.includes('????????_???') || normalized.includes('????????_???')) return 'sports_bras';
  if (normalized.includes('tracksuit') || normalized.includes('?????_?????') || normalized.includes('??????_?????') || normalized.includes('????????_??????')) return 'tracksuits';
  if (normalized.includes('active_jacket') || normalized.includes('???_?????') || normalized.includes('????????_????')) return 'active_jackets';
  if (normalized.includes('performance_top') || normalized.includes('?????_?????') || normalized.includes('??????_?????') || normalized.includes('????????_??????')) return 'performance_tops';
  if (normalized.includes('running_short') || normalized.includes('?????_????') || normalized.includes('?????_????')) return 'running_shorts';
  if (normalized.includes('compression_gear') || normalized.includes('?????_???') || normalized.includes('???????????')) return 'compression_gear';
  if (normalized.includes('athleisure_dress') || normalized.includes('????_?????') || normalized.includes('?????_?????') || normalized.includes('????????_?????')) return 'athleisure_dresses';

  if (normalized.includes('one_piece_swimsuit') || normalized.includes('???_??_???') || normalized.includes('????_??_?????') || normalized.includes('?????_?????????')) return 'one_piece_swimsuits';
  if (normalized.includes('bikini') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('????????_?????????')) return 'bikinis';
  if (normalized.includes('swim_trunk') || normalized.includes('?????_??') || normalized.includes('?????') || normalized.includes('???????_????')) return 'swim_trunks';
  if (normalized.includes('cover_up') || normalized.includes('???????_???') || normalized.includes('?????_?????')) return 'cover_ups';
  if (normalized.includes('rash_guard') || normalized.includes('?????_?????') || normalized.includes('???????')) return 'rash_guards';
  if (normalized.includes('wetsuit') || normalized.includes('?????_?????') || normalized.includes('???????????')) return 'wetsuits';
  if (normalized.includes('resort_romper') || normalized.includes('??????_????') || normalized.includes('???????_??????')) return 'resort_rompers';

  if (normalized.includes('necklace') || normalized.includes('?????') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('???????')) return 'necklaces';
  if (normalized.includes('earring') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('??????')) return 'earrings';
  if (normalized.includes('bracelet') || normalized.includes('bangle') || normalized.includes('????') || normalized.includes('???????')) return 'bracelets_and_bangles';
  if ((/(^|_)rings?(_|$)/.test(normalized) || normalized.includes('????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('??????')) && !normalized.includes('spring') && !normalized.includes('string') && !normalized.includes('earring')) return 'rings';
  if (normalized.includes('brooch') || /(^|_)pins?(_|$)/.test(normalized) || normalized.includes('????_?????') || normalized.includes('?????_?????') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('??????')) return 'brooches_and_pins';
  if (normalized.includes('watch') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('??????_???')) return 'watches';
  if (normalized.includes('body_jewelry') || normalized.includes('?????_???') || normalized.includes('???????_???_???')) return 'body_jewelry';

  if (
    normalized.includes('bag') ||
    normalized.includes('handbag') ||
    normalized.includes('backpack') ||
    normalized.includes('clutch') ||
    normalized.includes('???') ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('??????') ||
    normalized.includes('????') ||
    normalized.includes('???') ||
    normalized.includes('tasche') ||
    normalized.includes('bolso') ||
    normalized.includes('bolsa') ||
    normalized.includes('borsa') ||
    normalized.includes('sac') ||
    normalized.includes('???') ||
    normalized.includes('????') ||
    normalized.includes('???') ||
    normalized.includes('?')
  ) return 'bags';
  if (normalized.includes('small_good') || normalized.includes('??????') || normalized.includes('????????') || normalized.includes('???????')) return 'small_goods';
  if (normalized.includes('cape') || normalized.includes('poncho') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('?????')) return 'capes_and_ponchos';
  if (normalized.includes('headwear') || normalized.includes('hat') || (normalized.includes('cap') && !normalized.includes('cape')) || normalized.includes('beanie') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('??????_????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('hut') || normalized.includes('m?tze') || normalized.includes('sombrero') || normalized.includes('gorra') || normalized.includes('chapeau') || normalized.includes('cappello') || normalized.includes('chap?u') || normalized.includes('????') || normalized.includes('??')) return 'headwear';
  const hasCoreClothingInRaw =
    normalized.includes('coat') ||
    normalized.includes('overcoat') ||
    normalized.includes('trench') ||
    normalized.includes('parka') ||
    normalized.includes('????') ||
    normalized.includes('??????') ||
    normalized.includes('jacket') ||
    normalized.includes('???') ||
    normalized.includes('???') ||
    normalized.includes('?????') ||
    normalized.includes('blazer') ||
    normalized.includes('??????') ||
    normalized.includes('cardigan') ||
    normalized.includes('??????') ||
    normalized.includes('dress') ||
    normalized.includes('????') ||
    normalized.includes('????') ||
    normalized.includes('?????') ||
    normalized.includes('pant') ||
    normalized.includes('trouser') ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('skirt') ||
    normalized.includes('?????') ||
    normalized.includes('???') ||
    normalized.includes('top') ||
    normalized.includes('shirt') ||
    normalized.includes('????');

  if (!hasCoreClothingInRaw && (normalized.includes('belt') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('g?rtel') || normalized.includes('cintur') || normalized.includes('ceinture') || normalized.includes('cinto') || normalized.includes('?????') || normalized.includes('???') || normalized.includes('??'))) return 'belts';
  if (normalized.includes('glove') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('handschuh') || normalized.includes('guante') || normalized.includes('gant') || normalized.includes('guanti') || normalized.includes('luva') || normalized.includes('???????') || normalized.includes('??') || normalized.includes('??')) return 'gloves';
  if (normalized.includes('scarf') || normalized.includes('wrap') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('schal') || normalized.includes('bufanda') || normalized.includes('?charpe') || normalized.includes('echarpe') || normalized.includes('sciarpa') || normalized.includes('cachecol') || normalized.includes('???????') || normalized.includes('????') || normalized.includes('??')) return 'scarves_and_wraps';
  if (normalized.includes('sock') || normalized.includes('hosiery') || normalized.includes('tight') || normalized.includes('????') || normalized.includes('???') || normalized.includes('??????')) return 'hosiery_and_socks';
  if (
    normalized.includes('sunglass') ||
    normalized.includes('glasses') ||
    normalized.includes('eyewear') ||
    normalized === 'glass' ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('????') ||
    normalized.includes('solbrill') ||
    normalized.includes('zonnebril') ||
    normalized.includes('brille') ||
    normalized.includes('lunette') ||
    normalized.includes('gafas') ||
    normalized.includes('lentes') ||
    normalized.includes('occhiali') ||
    normalized.includes('?culos') ||
    normalized.includes('oculos') ||
    normalized.includes('????') ||
    normalized.includes('???????') ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('?????') ||
    normalized.includes('???') ||
    normalized.includes('??') ||
    normalized.includes('???') ||
    normalized.includes('??') ||
    normalized.includes('??')
  ) return 'sunglasses';

  if (normalized.includes('soles') || normalized.includes('outsole') || normalized.includes('?????_???????') || normalized.includes('??????')) return 'soles_and_outsoles';
  if (normalized.includes('lifts') || normalized.includes('heel_stack') || normalized.includes('?????_??????') || normalized.includes('??????') || normalized.includes('??????')) return 'heels_and_lifts';
  if (normalized.includes('midsole') || normalized.includes('cushioning') || normalized.includes('??????_????') || normalized.includes('???????????_??????')) return 'midsoles_and_cushioning';
  if (normalized.includes('insole') || normalized.includes('footbed') || normalized.includes('?????_??????') || normalized.includes('??????')) return 'insoles_and_footbeds';
  if (normalized.includes('lace') || normalized.includes('fastener') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('???????')) return 'laces_and_fasteners';
  if (normalized.includes('eyelet') || normalized.includes('grommet') || normalized.includes('??????') || normalized.includes('??????')) return 'eyelets_and_grommets';
  if (normalized.includes('vamp') || normalized.includes('upper') || normalized.includes('????_???') || normalized.includes('????_?????')) return 'vamps_and_uppers';

  if (
    normalized.includes('combat_boot') ||
    normalized.includes('boot') ||
    normalized.includes('???') ||
    normalized.includes('?????') ||
    normalized.includes('?????') ||
    normalized.includes('stiefel') ||
    normalized.includes('bota') ||
    normalized.includes('botte') ||
    normalized.includes('stival') ||
    normalized.includes('????') ||
    normalized.includes('???') ||
    normalized.includes('???') ||
    normalized.includes('??')
  ) return 'boots';
  if (
    normalized.includes('sandal') ||
    normalized.includes('????') ||
    normalized.includes('??????') ||
    normalized.includes('????????') ||
    normalized.includes('????') ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('??')
  ) return 'sandals';
  if (normalized.includes('clog') || normalized.includes('slide') || normalized.includes('flopper') || normalized.includes('mule') || normalized.includes('flip_flop') || normalized.includes('????') || normalized.includes('????')) return 'clogs';
  if (
    normalized.includes('sneaker') ||
    normalized.includes('runner') ||
    normalized.includes('trainer') ||
    normalized.includes('high_top') ||
    normalized.includes('low_top') ||
    normalized.includes('??????') ||
    normalized.includes('???????') ||
    normalized.includes('????') ||
    normalized.includes('??????') ||
    normalized.includes('turnschuh') ||
    normalized.includes('zapatillas') ||
    normalized.includes('baskets') ||
    normalized.includes('t?nis') ||
    normalized.includes('tenis') ||
    normalized.includes('????????') ||
    normalized.includes('?????') ||
    normalized.includes('???') ||
    ((normalized.includes('????') || normalized.includes('shoe') || normalized.includes('????')) && (normalized.includes('?????') || normalized.includes('sport')))
  ) return 'sneakers';
  if (normalized.includes('heel') || normalized.includes('pump') || normalized.includes('stiletto') || normalized.includes('???') || normalized.includes('??????') || normalized.includes('???') || normalized.includes('tac?n') || normalized.includes('tacon') || normalized.includes('talon') || normalized.includes('tacco') || normalized.includes('salto') || normalized.includes('???') || normalized.includes('???') || normalized.includes('???')) return 'heels';
  if (normalized.includes('flat') || (normalized.includes('??????') && (normalized.includes('????') || normalized.includes('shoe'))) || normalized.includes('??????')) return 'flats';
  if (normalized.includes('slipper') || normalized.includes('????_???') || normalized.includes('?????') || ((normalized.includes('????') || normalized.includes('shoe')) && normalized.includes('???'))) return 'slippers';
  if (
    normalized.includes('loafer') ||
    normalized.includes('????') ||
    normalized.includes('??????') ||
    normalized.includes('?????') ||
    normalized.includes('???????') ||
    normalized.includes('????') ||
    normalized.includes('???????') ||
    normalized.includes('mocas') ||
    normalized.includes('mocass') ||
    normalized.includes('??????') ||
    normalized.includes('?????') ||
    normalized.includes('???')
  ) return 'loafers';
  if (normalized.includes('double_monk') || normalized.includes('????_????') || normalized.includes('monk_strap') || normalized.includes('????')) return 'dress_shoes';
  if (normalized.includes('oxford') || normalized.includes('????????')) return 'oxfords';
  if (normalized.includes('derby') || normalized.includes('????')) return 'dress_shoes';
  if (normalized.includes('brogue') || normalized.includes('????')) return 'dress_shoes';
  if (
    normalized.includes('dress_shoe') ||
    normalized.includes('????_?????') ||
    normalized.includes('????_???') ||
    normalized.includes('?????') ||
    normalized.includes('??????????_????') ||
    ((normalized.includes('????') || normalized.includes('shoe') || normalized.includes('????')) && (normalized.includes('?????') || normalized.includes('dress') || normalized.includes('business') || normalized.includes('formal')))
  ) return 'dress_shoes';
  if (
    normalized.includes('casual_shoe') ||
    normalized.includes('????_?????') ||
    normalized.includes('????_??????') ||
    ((normalized.includes('????') || normalized.includes('shoe') || normalized.includes('????')) && (normalized.includes('?????') || normalized.includes('??????') || normalized.includes('casual')))
  ) return 'casual_shoes';
  if (normalized.includes('solid') && (normalized.includes('shoe') || normalized.includes('????') || normalized.includes('????'))) return 'shoes';
  if (normalized.includes('shoe') || normalized.includes('????') || normalized.includes('????')) return 'shoes';

  if (normalized.includes('overcoat') || normalized.includes('coat') || normalized.includes('parka') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('mantel') || normalized.includes('abrigo') || normalized.includes('manteau') || normalized.includes('cappotto') || normalized.includes('casaco') || normalized.includes('???') || normalized.includes('???') || normalized.includes('??')) return 'coats';
  if (normalized.includes('jacket') || normalized.includes('bomber') || normalized.includes('moto') || normalized.includes('???') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('jacke') || normalized.includes('chaqueta') || normalized.includes('veste') || normalized.includes('giacca') || normalized.includes('jaqueta') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('??')) return 'jackets';
  if (normalized.includes('performance_gear') || normalized.includes('windbreaker') || normalized.includes('?????_????') || normalized.includes('??????')) return 'performance_gear';
  if (normalized === 'suit' || normalized === 'suits' || normalized.includes('business_suit')) return 'suit';
  if (normalized.includes('polo_shirt') || normalized.includes('polo') || normalized.includes('????') || normalized.includes('????')) return 'polo_shirt';
  if (normalized.includes('blazer') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('???????')) return 'blazers';
  if (normalized.includes('vest') || normalized.includes('waistcoat') || normalized.includes('gilet') || normalized.includes('????') || normalized.includes('?????')) return 'vests';
  if (normalized.includes('cape') || normalized.includes('poncho') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('?????')) return 'capes_and_ponchos';
  if (normalized.includes('shrug') || normalized.includes('bolero') || normalized.includes('???????_????') || normalized.includes('??????')) return 'shrugs';

  if (normalized.includes('sweatshirt') || normalized.includes('hoodie') || normalized.includes('fleece') || normalized.includes('????????') || normalized.includes('????') || normalized.includes('????') || normalized.includes('????????')) return 'sweatshirts';
  if (normalized.includes('tailored_shirt') || normalized.includes('button_down') || normalized.includes('oxford_shirt') || normalized.includes('dress_shirt') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('hemd') || normalized.includes('camisa') || normalized.includes('chemise') || normalized.includes('camicia') || normalized.includes('overhemd') || normalized.includes('????') || normalized.includes('???') || normalized.includes('??') || normalized === 'shirt' || normalized === 'shirts' || normalized === 'top' || normalized === 'tops') return 'tailored_shirts';
  if (normalized.includes('knitwear') || normalized.includes('sweater') || normalized.includes('cardigan') || normalized.includes('pullover') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('????????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('su?ter') || normalized.includes('sueter') || normalized.includes('pull') || normalized.includes('maglione') || normalized.includes('trui') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('??')) return 'knitwear';
  if (normalized.includes('t_shirt') || normalized.includes('tshirt') || normalized.includes('t-shirt') || normalized.includes('tee') || normalized.includes('?????_??') || normalized.includes('??????') || normalized.includes('???????') || normalized.includes('??????') || normalized.includes('t_????') || normalized.includes('t???') || normalized.includes('t?')) return 't_shirts';
  if (normalized.includes('blouse') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('bluse') || normalized.includes('blusa') || normalized.includes('chemisier') || normalized.includes('camicetta') || normalized.includes('??????') || normalized.includes('????')) return 'blouses';
  if (normalized.includes('tank_top') || normalized.includes('tank') || normalized.includes('camisole') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????')) return 'tank_tops';
  if (normalized.includes('tunic') || normalized.includes('?????') || normalized.includes('?????')) return 'tunics';

  if (
    normalized.includes('cargo') ||
    normalized.includes('????') ||
    normalized.includes('?????') ||
    normalized.includes('???"?') ||
    normalized.includes('?????')
  ) return 'cargo_pants';
  if (normalized.includes('shorts') || normalized.includes('short') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('?????')) return 'shorts';
  if (
    normalized.includes('trouser') ||
    normalized.includes('chino') ||
    normalized.includes('pants') ||
    normalized.includes('pant') ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('????') ||
    normalized.includes('?????') ||
    normalized.includes('?????') ||
    normalized.includes('??????') ||
    normalized.includes('?????') ||
    normalized.includes('hose') ||
    normalized.includes('hosen') ||
    normalized.includes('pantalon') ||
    normalized.includes('calca') ||
    normalized.includes('cal?a') ||
    normalized.includes('broek') ||
    normalized.includes('?????') ||
    normalized.includes('????') ||
    normalized.includes('???') ||
    normalized.includes('???') ||
    normalized.includes('??') ||
    normalized.includes('??')
  ) return 'trousers';
  if (normalized.includes('jeans') || normalized.includes('jean') || normalized.includes('denim') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('?????')) return 'jeans';
  if (normalized.includes('legging') || normalized.includes('????') || normalized.includes('??????')) return 'leggings';
  if (normalized.includes('sweatpants') || normalized.includes('jogger') || normalized.includes('???????') || normalized.includes('???????') || normalized.includes('???????')) return 'sweatpants';
  if (normalized.includes('jumpsuit') || normalized.includes('romper') || normalized.includes('??????') || normalized.includes('??????????') || normalized.includes('??????')) return 'jumpsuits_and_rompers';
  if (normalized.includes('overall') || normalized.includes('dungaree') || normalized.includes('????') || normalized.includes('??????????????')) return 'overalls';

  if (normalized.includes('pleated_skirt') || normalized.includes('pleated skirt') || normalized.includes('pleated') || normalized.includes('?????') || normalized.includes('???????????') || normalized.includes('?????') || normalized.includes('plisada') || normalized.includes('pliss?e') || normalized.includes('plissee')) return 'pleated_skirt';
  if (normalized.includes('a_line_skirt') || normalized.includes('a-line') || normalized.includes('a_line') || normalized.includes('??_a') || normalized.includes('??????')) return 'a_line_skirt';
  if (normalized.includes('pencil_skirt') || normalized.includes('??????')) return 'pencil_skirt';
  if (normalized.includes('mini_skirt') || normalized.includes('?????_????')) return 'mini_skirt';
  if (normalized.includes('midi_skirt') || normalized.includes('?????_????')) return 'midi_skirt';
  if (normalized.includes('maxi_skirt') || normalized.includes('?????_????')) return 'maxi_skirt';
  if (
    normalized.includes('skirt') ||
    normalized.includes('?????') ||
    normalized.includes('??????') ||
    normalized.includes('???') ||
    normalized.includes('?????') ||
    normalized.includes('falda') ||
    normalized.includes('jupe') ||
    normalized.includes('gonna') ||
    normalized.includes('saia') ||
    normalized.includes('rok') ||
    normalized.includes('??????') ||
    normalized.includes('????') ||
    normalized.includes('???') ||
    normalized.includes('??')
  ) return 'skirts';
  if (normalized.includes('mini_dress') || normalized.includes('????') || normalized.includes('????_?????')) return 'mini_dresses';
  if (normalized.includes('maxi_dress') || normalized.includes('????') || normalized.includes('?????_?????')) return 'maxi_dresses';
  if (normalized.includes('evening_dress') || normalized.includes('gown') || normalized.includes('????_???') || normalized.includes('?????_???') || normalized.includes('??????_?????')) return 'evening_dresses';
  if (normalized.includes('midi_dress') || normalized.includes('cocktail_dress') || normalized.includes('????') || normalized.includes('????_?????')) return 'midi_dresses';
  if (normalized.includes('sundress') || normalized.includes('????_???') || normalized.includes('???????')) return 'sundresses';
  if (normalized.includes('wrap_dress') || normalized.includes('?????') || normalized.includes('??????_?_?????')) return 'wrap_dresses';
  if (normalized.includes('dress') || normalized.includes('????') || normalized.includes('?????')) return 'midi_dresses';

  if (normalized === 'clutches' || normalized === 'clutch' || normalized.includes('????')) return 'clutch';
  if (normalized === 'handbags' || normalized === 'handbag' || normalized.includes('???_??')) return 'handbag';
  if (normalized === 'totes' || normalized === 'tote' || normalized === 'tote_bags' || normalized === 'tote_bag' || normalized === 'tote bag') return 'basket_bag';

  return normalized;
};

export const canonicalCategoryForSubCategory = (raw) => {
  const canonical = canonicalSubCategoryKey(raw);
  if (!canonical) return null;
  const topKeys = new Set(['t_shirts', 'tailored_shirts', 'polo_shirt', 'sweatshirts', 'knitwear', 'blouses', 'tank_tops', 'tunics']);
  const bottomKeys = new Set(['jeans', 'trousers', 'cargo_pants', 'shorts', 'sweatpants', 'leggings', 'skirts', 'pleated_skirt', 'a_line_skirt', 'pencil_skirt', 'mini_skirt', 'midi_skirt', 'maxi_skirt']);
  const outerwearKeys = new Set(['coats', 'jackets', 'blazers', 'vests', 'capes_and_ponchos', 'shrugs', 'performance_gear']);
  const fullBodyKeys = new Set(['dress', 'dresses', 'midi_dresses', 'mini_dresses', 'maxi_dresses', 'evening_dresses', 'sundresses', 'wrap_dresses', 'suit', 'jumpsuits_and_rompers', 'overalls', 'cultural_traditional']);
  const footwearKeys = new Set(['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'flats', 'slippers', 'loafers', 'oxfords', 'oxford_shoes']);
  const accessoryKeys = new Set(['bags', 'belts', 'headwear', 'scarves_and_wraps', 'gloves', 'jewelry', 'sunglasses', 'wallets', 'ties', 'socks', 'handbag', 'clutch', 'basket_bag']);

  if (topKeys.has(canonical)) return 'Top';
  if (bottomKeys.has(canonical)) return 'Bottom';
  if (outerwearKeys.has(canonical)) return 'Outerwear';
  if (fullBodyKeys.has(canonical)) return 'Full Body';
  if (footwearKeys.has(canonical)) return 'Footwear';
  if (accessoryKeys.has(canonical)) return 'Accessories';
  return null;
};

export const labelForSubCategory = (raw, t) => {
  if (!raw) return '';
  let canonical = canonicalSubCategoryKey(raw);
  if (canonical === 'other') {
    return t('stats.unknownSubcategory', { defaultValue: 'Other' });
  }
  if (canonical === 'oxford_shoes') canonical = 'oxfords';
  const key = `taxonomy.sub_category.${canonical}`;
  const translated = fallback(t, key, '');
  if (translated && translated !== key) return translated;
  const itemTypeFallback = fallback(t, `taxonomy.item_type.${canonical}`, '');
  if (itemTypeFallback && itemTypeFallback !== `taxonomy.item_type.${canonical}`) return itemTypeFallback;
  if (canonical === 'oxfords') {
    const alt = fallback(t, 'taxonomy.item_type.oxford_shoes', '');
    if (alt && alt !== 'taxonomy.item_type.oxford_shoes') return alt;
  }
  return fallback(t, key, raw);
};

export const labelForItemType = (raw, t) => {
  if (!raw) return '';
  const slug = itemSlug(raw);
  if (!slug) return raw;
  let val = fallback(t, `taxonomy.item_type.${slug}`, null);
  if (val) return val;
  val = fallback(t, `taxonomy.sub_category.${slug}`, null);
  if (val) return val;
  val = fallback(t, `taxonomy.subcategories.${slug}`, null);
  if (val) return val;
  if (slug === 'pants' || slug === 'pant' || slug === 'trousers' || slug === 'trouser') {
    val = fallback(t, 'taxonomy.sub_category.trousers', null);
    if (val) return val;
    val = fallback(t, 'taxonomy.categories.bottom', null);
    if (val) return val;
  }
  return fallback(t, `taxonomy.item_type.${slug}`, raw);
};

export const canonicalMaterialKey = (raw) => {
  if (!raw) return '';
  const rawStr = String(raw).trim().toLowerCase();

  // Chinese / Japanese / Arabic / multilingual leather detection
  if (rawStr === '?' || rawStr === '??' || rawStr === '?' || rawStr.includes('?')) return 'leather';
  if (
    rawStr.includes('leather') ||
    rawStr.includes('???') ||
    rawStr.includes('???') ||
    rawStr.includes('leder') ||
    rawStr.includes('cuir') ||
    rawStr.includes('cuero') ||
    rawStr.includes('couro') ||
    rawStr.includes('pelle') ||
    rawStr.includes('????') ||
    rawStr.includes('?????') ||
    rawStr.includes('cowhide')
  ) {
    if (rawStr.includes('oxblood') || rawStr.includes('cordovan') || rawStr.includes('?????')) return 'oxblood';
    return 'leather';
  }

  const normalized = rawStr
    .replace(/['?`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_?-??-??]/g, '');

  if (normalized === 'acrylic') return 'acrylic';
  if (normalized === 'brocade') return 'brocade';
  if (normalized === 'burlap') return 'burlap';
  if (normalized === 'canvas') return 'canvas';
  if (normalized === 'cashmere') return 'cashmere';
  if (normalized === 'chambray') return 'chambray';
  if (normalized === 'chiffon') return 'chiffon';
  if (normalized === 'copper') return 'copper';
  if (normalized === 'cotton') return 'cotton';
  if (normalized === 'denim') return 'denim';
  if (normalized === 'leather') return 'leather';
  if (normalized === 'linen') return 'linen';
  if (normalized === 'mesh') return 'mesh';
  if (normalized === 'nylon') return 'nylon';
  if (normalized === 'oxblood') return 'oxblood';
  if (normalized === 'polyester') return 'polyester';
  if (normalized === 'rayon') return 'rayon';
  if (normalized === 'ripstop') return 'ripstop';
  if (normalized === 'satin') return 'satin';
  if (normalized === 'silk') return 'silk';
  if (normalized === 'spandex') return 'spandex';
  if (normalized === 'suede') return 'suede';
  if (normalized === 'velvet') return 'velvet';
  if (normalized === 'vinyl') return 'vinyl';
  if (normalized === 'wool') return 'wool';
  if (normalized === 'synthetic') return 'synthetic';

  if (normalized.includes('synthetic') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('????????') || rawStr.includes('???????') || rawStr.includes('synthetisch') || rawStr.includes('synth?tique') || rawStr.includes('sint?tico') || rawStr.includes('sintetico') || rawStr.includes('?????????') || rawStr.includes('??')) return 'synthetic';
  if (normalized.includes('cotton') || normalized.includes('?????') || normalized.includes('??????') || rawStr.includes('???') || rawStr.includes('baumwolle') || rawStr.includes('coton') || rawStr.includes('algod') || rawStr.includes('?') || rawStr.includes('?')) return 'cotton';
  if (normalized.includes('linen') || normalized.includes('????') || normalized.includes('???') || normalized.includes('???') || rawStr.includes('????') || rawStr.includes('leinen') || rawStr.includes('lin') || rawStr.includes('lino') || rawStr.includes('???') || rawStr.includes('??')) return 'linen';
  
  if (normalized.includes('burlap') || normalized.includes('jute') || normalized.includes('????') || normalized.includes('????') || normalized.includes('?????????')) return 'burlap';
  if (normalized.includes('canvas') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('??????')) return 'canvas';
  
  if (normalized.includes('satin') || normalized.includes('????') || normalized.includes('?????')) return 'satin';
  if (normalized.includes('brocade') || normalized.includes('???') || normalized.includes('gold') || normalized.includes('??????') || normalized.includes('sequins') || normalized.includes('?????') || normalized.includes('???????')) return 'brocade';
  if (normalized.includes('copper') || normalized.includes('metal') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('?????_???????') || normalized.includes('????') || normalized.includes('??????')) return 'copper';
  
  if (normalized.includes('cashmere') || normalized.includes('?????') || normalized.includes('???????')) return 'cashmere';
  if (normalized.includes('chiffon') || normalized.includes('?????') || normalized.includes('???') || normalized.includes('tulle') || normalized.includes('?????') || normalized.includes('????')) return 'chiffon';
  if (normalized.includes('velvet') || normalized.includes('?????') || normalized.includes('barhat') || normalized.includes('??????')) return 'velvet';
  
  if (normalized.includes('suede') || normalized.includes('???') || normalized.includes('?????')) return 'suede';
  if (normalized.includes('chambray') || normalized.includes('?????')) return 'chambray';
  if (normalized.includes('denim') || normalized.includes('????') || normalized.includes('?\'???') || normalized.includes('????') || normalized.includes('jeans') || rawStr.includes('?????') || rawStr.includes('???') || rawStr.includes('??')) return 'denim';
  if (normalized.includes('nylon') || normalized.includes('??????') || normalized.includes('??????') || rawStr.includes('??????') || rawStr.includes('????') || rawStr.includes('??')) return 'nylon';
  
  if (normalized.includes('mesh') || normalized.includes('???') || normalized.includes('?????')) return 'mesh';
  if (normalized.includes('polyester') || normalized.includes('????????') || normalized.includes('?????????') || rawStr.includes('???????') || rawStr.includes('??????') || rawStr.includes('??')) return 'polyester';
  if (normalized.includes('rayon') || normalized.includes('viscose') || normalized.includes('???????') || normalized.includes('?????') || normalized.includes('???????') || normalized.includes('?????')) return 'rayon';
  if (normalized.includes('spandex') || normalized.includes('elastane') || normalized.includes('lycra') || normalized.includes('?????') || normalized.includes('??????') || normalized.includes('??????') || normalized.includes('???????') || normalized.includes('??????')) return 'spandex';
  if (normalized.includes('acrylic') || normalized.includes('???????') || normalized.includes('?????')) return 'acrylic';
  
  if (normalized.includes('vinyl') || normalized.includes('tarp') || normalized.includes('rubber') || normalized.includes('?????') || normalized.includes('?????') || normalized.includes('????') || normalized.includes('??????')) return 'vinyl';
  if (normalized.includes('ripstop') || normalized.includes('???????')) return 'ripstop';
  
  if (normalized.includes('wool') || normalized.includes('???') || normalized.includes('????') || normalized.includes('????') || normalized.includes('??????') || normalized.includes('????') || normalized.includes('?????') || normalized.includes('???') || normalized.includes('foam') || rawStr.includes('???') || rawStr.includes('laine') || rawStr.includes('wolle') || rawStr.includes('???') || rawStr.includes('??')) return 'wool';
  if (normalized.includes('silk') || normalized.includes('???') || normalized.includes('????') || normalized.includes('????') || rawStr.includes('????') || rawStr.includes('soie') || rawStr.includes('???') || rawStr.includes('?')) return 'silk';

  if (normalized.includes('??') || normalized.includes('?????') || normalized.includes('fabric')) return 'other';

  return normalized;
};

export const labelForMaterial = (raw, t) => {
  if (!raw) return '';
  const canonical = canonicalMaterialKey(raw);
  if (canonical === 'other') {
    return t('stats.unknownMaterial', { defaultValue: 'Other' });
  }
  const key = `taxonomy.material.${canonical}`;
  return fallback(t, key, raw);
};

/** Generic helper to map an array of codes into translated Select-ready objects. */
export const makeLabeledOptions = (codes, labelFn, t) =>
  (codes || []).map((code) => ({ value: code, label: labelFn(code, t) }));

export const getTaxonomyMismatches = (itemA, itemB) => {
  if (!itemA || !itemB) return [];
  const mismatches = [];

  // Category (normalize common plural/singular or alternative variations)
  const normCategory = (cat) => {
    const s = String(cat || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'top' || s === 'tops') return 'top';
    if (s === 'bottom' || s === 'bottoms') return 'bottom';
    if (s === 'footwear' || s === 'shoes') return 'footwear';
    if (s === 'accessory' || s === 'accessories') return 'accessories';
    return s;
  };
  const catA = normCategory(itemA.category);
  const catB = normCategory(itemB.category);
  if (catA !== catB) mismatches.push('category');

  // Sub-category (compare canonical keys to honor translation equivalent keys like 'shirt' vs '?????')
  const subCatA = canonicalSubCategoryKey(itemA.sub_category);
  const subCatB = canonicalSubCategoryKey(itemB.sub_category);
  if (subCatA !== subCatB) mismatches.push('sub_category');

  // Brand
  const brandA = String(itemA.brand || '').trim().toLowerCase();
  const brandB = String(itemB.brand || '').trim().toLowerCase();
  if (brandA !== brandB) mismatches.push('brand');

  // Gender
  const genderA = String(itemA.gender || '').trim().toLowerCase();
  const genderB = String(itemB.gender || '').trim().toLowerCase();
  if (genderA !== genderB) mismatches.push('gender');

  // Dress Code
  const dcA = String(itemA.dress_code || '').trim().toLowerCase();
  const dcB = String(itemB.dress_code || '').trim().toLowerCase();
  if (dcA !== dcB) mismatches.push('dress_code');

  // Tradition
  const tradA = String(itemA.tradition || '').trim().toLowerCase();
  const tradB = String(itemB.tradition || '').trim().toLowerCase();
  if (tradA !== tradB) mismatches.push('tradition');

  // Season (list of strings - handle array, CSV, single string or falsy inputs)
  const normSeason = (list) => {
    let arr = [];
    if (Array.isArray(list)) {
      arr = list;
    } else if (typeof list === 'string') {
      arr = list.split(',').map((s) => s.trim());
    } else if (list) {
      arr = [list];
    }
    const sList = arr.map((s) => String(s || '').trim().toLowerCase());
    const hasAll = sList.includes('all') || (
      sList.includes('spring') && sList.includes('summer') && sList.includes('fall') && sList.includes('winter')
    );
    return hasAll ? ['all'] : sList.filter((s) => s && s !== 'all').sort();
  };
  const seasonA = normSeason(itemA.season);
  const seasonB = normSeason(itemB.season);
  if (seasonA.join(',') !== seasonB.join(',')) mismatches.push('season');

  return mismatches;
};

export const TAG_REVERSE_MAP = {
  '???????': 'casual',
  '??????': 'smart_casual',
  '??????????????': 'smart_casual',
  '??????_???????': 'smart_casual',
  '????': 'formal',
  '????': 'business',
  '????????': 'athletic',
  '????? ??': 't_shirt',
  '?????_??': 't_shirt',
  '??????': 't_shirt',
  '???': 'eagle',
  '???': 'eagle',
  '????': 'deer',
  '?????': 'cotton',
  '????': 'denim',
  '?????': 'burgundy',
  '????': 'printed',
  '????': 'graphic',
  '????': 'logo',
  '?????\'': 'vintage',
  '?????': 'vintage',
  '????? ????': 'streetwear',
  '???': 'summer',
  '????': 'winter',
  '????': 'spring',
  '????': 'fall',
  '????????': 'utility',
  '????? ?????': 'multi_pocket',
  '????\'??': 'hooded',
  '?? ????\'??': 'hooded',
  '?????': 'zipper',
  '????': 'knit',
  '????': 'knitwear',
  '?????': 'sweater',
  '??????': 'synthetic',
  '??????': 'camouflage',
  '???? ???': 'heels',
  '????? ???"? ?????': 'cargo_shorts',
  '????? ???"?': 'cargo_pants',
};

export const labelForTag = (raw, t) => {
  if (!raw) return '';
  let key = String(raw).trim().toLowerCase().replace(/[\s\-]+/g, '_');
  if (key === 'casual_wear' || key === 'casualwear') key = 'casual';
  if (key === 'multi_pocket' || key === 'multipocket' || key === 'multi_pockets') key = 'multi_pocket';
  if (key === 'high_heel' || key === 'high_heels' || key === 'high_heel_pump' || key === 'pump' || key === 'pumps') key = 'heels';
  if (key === 'hood' || key === 'hooded') key = 'hooded';
  if (key === 'zip' || key === 'zipper') key = 'zipper';
  const canonicalKey = TAG_REVERSE_MAP[String(raw).trim()] || TAG_REVERSE_MAP[key] || key;

  // 1. Try dedicated tags namespace
  const tagVal = t(`tags.${canonicalKey}`, { defaultValue: '' });
  if (tagVal && tagVal !== `tags.${canonicalKey}`) return tagVal;
  const taxTagVal = t(`taxonomy.tags.${canonicalKey}`, { defaultValue: '' });
  if (taxTagVal && taxTagVal !== `taxonomy.tags.${canonicalKey}`) return taxTagVal;

  // 2. Try taxonomy dress_code
  const dcVal = t(`taxonomy.dress_code.${canonicalKey}`, { defaultValue: '' });
  if (dcVal && dcVal !== `taxonomy.dress_code.${canonicalKey}`) return dcVal;

  // 3. Try taxonomy pattern
  const patVal = labelForPattern(canonicalKey, t);
  if (patVal && patVal.toLowerCase() !== canonicalKey) return patVal;

  // 4. Try taxonomy color
  const colorVal = labelForColor(canonicalKey, t);
  if (colorVal && colorVal.toLowerCase() !== canonicalKey) return colorVal;

  // If raw is already localized in Hebrew and current language is Hebrew,
  // return raw directly to avoid subcategory false positives
  const isHe = t?.language?.startsWith('he') || t?.language?.startsWith('iw');
  const hasHebrew = /[\u0590-\u05FF]/.test(raw);
  if (isHe && hasHebrew) {
    return raw;
  }

  // 5. Try taxonomy sub_category / item_type
  const subVal = labelForSubCategory(canonicalKey, t);
  if (subVal && subVal.toLowerCase() !== canonicalKey) return subVal;

  const itypeVal = labelForItemType(canonicalKey, t);
  if (itypeVal && itypeVal.toLowerCase() !== canonicalKey) return itypeVal;

  // 6. Try taxonomy material
  const matVal = labelForMaterial(canonicalKey, t);
  if (matVal && matVal.toLowerCase() !== canonicalKey) return matVal;

  // 7. Try taxonomy season
  const seasonVal = labelForSeason(canonicalKey, t);
  if (seasonVal && seasonVal.toLowerCase() !== canonicalKey) return seasonVal;

  // 8. Try taxonomy gender
  const genderVal = labelForGender(canonicalKey, t);
  if (genderVal && genderVal !== canonicalKey) return genderVal;

  return raw;
};

