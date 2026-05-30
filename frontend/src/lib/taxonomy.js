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
const slug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const fallback = (t, key, raw) => {
  const out = t(key, { defaultValue: raw ?? '' });
  // i18next will return the key itself when nothing matches — degrade to raw.
  if (!out || out === key) return raw ?? '';
  return out;
};

export const labelForCategory = (code, t) => {
  if (!code) return '';
  if (code === 'all') return fallback(t, 'taxonomy.categories.all', 'All');
  const key = `taxonomy.categories.${slug(code)}`;
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
  const key = `taxonomy.condition.${code}`;
  return fallback(t, key, code);
};

export const labelForQuality = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.quality.${code}`;
  return fallback(t, key, code);
};

export const labelForPattern = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.pattern.${code}`;
  return fallback(t, key, code);
};

export const labelForFormality = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.formality.${code}`;
  return fallback(t, key, code);
};

export const labelForIntent = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.intent.${code}`;
  return fallback(t, key, code);
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
  const key = `taxonomy.role.${code}`;
  return fallback(t, key, code);
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
  'navy': 'navy',
  'navy_blue': 'navy',
  'dark_blue': 'navy',
  'dark_blue_gray': 'charcoal_grey',
  'blue_gray': 'charcoal_grey',
  'charcoal': 'charcoal_grey',
  'charcoal_grey': 'charcoal_grey',
  'charcoal_gray': 'charcoal_grey',
  'green': 'green',
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
  'dark_grey': 'charcoal_grey',
  'dark_gray': 'charcoal_grey',
  'turquoise': 'light_blue',
  'silver': 'light_grey',
  'bronze': 'brown',
  'mustard': 'yellow',
  'peach': 'orange',
  'lilac': 'purple',
  'lavender': 'purple',
  'khaki': 'beige',
  'coral': 'orange',
  'fuchsia': 'pink',
  'magenta': 'pink',
  'plum': 'purple',
  'teal': 'blue',
  'indigo': 'navy',
  'maroon': 'burgundy',
  
  // Hebrew
  'לבן': 'white',
  'שחור': 'black',
  'אפור': 'grey',
  'אפור_בהיר': 'light_grey',
  'בורדו': 'burgundy',
  'חום': 'brown',
  'כחول': 'blue',
  'כחול': 'blue',
  'תכלת': 'light_blue',
  'כחול_כהה': 'navy',
  'כחול_אפור_כהה': 'charcoal_grey',
  'ירוק': 'green',
  'ירוק_זית': 'olive',
  'צהוב': 'yellow',
  'כתום': 'orange',
  'ורוד': 'pink',
  'סגول': 'purple',
  'חום_חמרה': 'terracotta_brown',
  'טראקוטה': 'terracotta_brown',
  'בז\'': 'beige',
  'בז': 'beige',
  'קרם': 'cream',
  'זהב': 'champagne_gold',
  'שמפניה': 'champagne_gold',
  'אדום': 'red',
  'אפור_כהה': 'charcoal_grey',
  'אפור_עכבר': 'charcoal_grey',
  'טורקיז': 'light_blue',
  'כסף': 'light_grey',
  'ברונزه': 'brown',
  'חרדל': 'yellow',
  'אפרסק': 'orange',
  'לילך': 'purple',
  'לבנדر': 'purple',
  'קאكي': 'beige',
  'קורل': 'orange',
  'פוקסיה': 'pink',
  'מגنتة': 'pink',
  'מגנטה': 'pink',
  'שזיף': 'purple',
  'כחول_ירקרק': 'blue',
  'כחול_ירקרק': 'blue',
  'אינדיגו': 'navy',
  'חום_ערמוני': 'burgundy',

  // Russian
  'белый': 'white',
  'черный': 'black',
  'чёрный': 'black',
  'серый': 'grey',
  'светло_серый': 'light_grey',
  'бордовый': 'burgundy',
  'бордо': 'burgundy',
  'коричневый': 'brown',
  'синий': 'blue',
  'голубой': 'light_blue',
  'темно_синий': 'navy',
  'зеленый': 'green',
  'зелёный': 'green',
  'оливковый': 'olive',
  'желтый': 'yellow',
  'жёлтый': 'yellow',
  'оранжевый': 'orange',
  'розовый': 'pink',
  'фиолетовый': 'purple',
  'терракотовый': 'terracotta_brown',
  'бежевый': 'beige',
  'кремовый': 'cream',
  'золотой': 'champagne_gold',
  'шампань': 'champagne_gold',
  'красный': 'red',

  // Arabic
  'احمر': 'red',
  'أحمر': 'red',

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
  'लाल': 'red',

  // Japanese
  '赤': 'red',

  // Chinese
  '红': 'red',
  '红色': 'red'
};

export const canonicalColorKey = (code) => {
  if (!code) return '';
  const normalized = String(code)
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_א-תа-яё]/g, '');
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
const itemSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

export const labelForSubCategory = (raw, t) => {
  if (!raw) return '';
  const slug = itemSlug(raw);
  if (!slug) return raw;
  const key = `taxonomy.sub_category.${slug}`;
  return fallback(t, key, raw);
};

export const labelForItemType = (raw, t) => {
  if (!raw) return '';
  const slug = itemSlug(raw);
  if (!slug) return raw;
  const key = `taxonomy.item_type.${slug}`;
  return fallback(t, key, raw);
};

/** Generic helper to map an array of codes into translated Select-ready objects. */
export const makeLabeledOptions = (codes, labelFn, t) =>
  (codes || []).map((code) => ({ value: code, label: labelFn(code, t) }));
