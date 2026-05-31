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

export const canonicalMaterialKey = (raw) => {
  if (!raw) return '';
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_א-תа-яё]/g, '');

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

  if (normalized.includes('cotton') || normalized.includes('כותנה') || normalized.includes('хлопок')) return 'cotton';
  if (normalized.includes('linen') || normalized.includes('פשתן') || normalized.includes('лен') || normalized.includes('лён')) return 'linen';
  
  if (normalized.includes('burlap') || normalized.includes('jute') || normalized.includes('יוטה') || normalized.includes('джут') || normalized.includes('мешковина')) return 'burlap';
  if (normalized.includes('canvas') || normalized.includes('קנבס') || normalized.includes('холст') || normalized.includes('канвас')) return 'canvas';
  
  if (normalized.includes('satin') || normalized.includes('סאטן') || normalized.includes('атлас')) return 'satin';
  if (normalized.includes('brocade') || normalized.includes('זהב') || normalized.includes('gold') || normalized.includes('פייטים') || normalized.includes('sequins') || normalized.includes('парча') || normalized.includes('блестки')) return 'brocade';
  if (normalized.includes('copper') || normalized.includes('metal') || normalized.includes('נחושת') || normalized.includes('מתכת') || normalized.includes('סיבים_מתכתיים') || normalized.includes('медь') || normalized.includes('металл')) return 'copper';
  
  if (normalized.includes('cashmere') || normalized.includes('קשמיר') || normalized.includes('кашемир')) return 'cashmere';
  if (normalized.includes('chiffon') || normalized.includes('שיפון') || normalized.includes('טול') || normalized.includes('tulle') || normalized.includes('шифон') || normalized.includes('тюль')) return 'chiffon';
  if (normalized.includes('velvet') || normalized.includes('קטיפה') || normalized.includes('barhat') || normalized.includes('бархат')) return 'velvet';
  
  if (normalized.includes('suede') || normalized.includes('זמש') || normalized.includes('замша')) return 'suede';
  if (normalized.includes('leather') || normalized.includes('עור') || normalized.includes('cowhide') || normalized.includes('кожа')) {
    if (normalized.includes('oxblood') || normalized.includes('cordovan') || normalized.includes('בורדו')) return 'oxblood';
    return 'leather';
  }
  
  if (normalized.includes('chambray') || normalized.includes('שמברה')) return 'chambray';
  if (normalized.includes('denim') || normalized.includes('דנים') || normalized.includes('ג\'ינס') || normalized.includes('גינס') || normalized.includes('jeans')) return 'denim';
  if (normalized.includes('nylon') || normalized.includes('ניילון') || normalized.includes('нейлон')) return 'nylon';
  
  if (normalized.includes('mesh') || normalized.includes('רשת') || normalized.includes('сетка')) return 'mesh';
  if (normalized.includes('polyester') || normalized.includes('פוליאסטר') || normalized.includes('полиэстер')) return 'polyester';
  if (normalized.includes('rayon') || normalized.includes('viscose') || normalized.includes('ויסקוזה') || normalized.includes('ראיון') || normalized.includes('вискоза') || normalized.includes('район')) return 'rayon';
  if (normalized.includes('spandex') || normalized.includes('elastane') || normalized.includes('lycra') || normalized.includes('אלסטן') || normalized.includes('ספנדקס') || normalized.includes('לייקרה') || normalized.includes('эластан') || normalized.includes('лайкра')) return 'spandex';
  if (normalized.includes('acrylic') || normalized.includes('אקריליק') || normalized.includes('акрил')) return 'acrylic';
  
  if (normalized.includes('vinyl') || normalized.includes('tarp') || normalized.includes('rubber') || normalized.includes('ויניל') || normalized.includes('ברזנט') || normalized.includes('גומי') || normalized.includes('резина')) return 'vinyl';
  if (normalized.includes('ripstop') || normalized.includes('ריפסטופ')) return 'ripstop';
  
  if (normalized.includes('wool') || normalized.includes('צמר') || normalized.includes('флис') || normalized.includes('твил') || normalized.includes('шерсть') || normalized.includes('פליז') || normalized.includes('טוויל') || normalized.includes('קצף') || normalized.includes('foam')) return 'wool';
  if (normalized.includes('silk') || normalized.includes('משי') || normalized.includes('шелк') || normalized.includes('шёлк')) return 'silk';

  if (normalized.includes('בד') || normalized.includes('ткань') || normalized.includes('fabric')) return 'other';

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
