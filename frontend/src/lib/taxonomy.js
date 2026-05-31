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

  if (normalized.includes('bleached_cotton') || normalized.includes('bleachedcotton')) return 'bleached_cotton';
  if (normalized.includes('ecru_linen') || normalized.includes('ecrulinen')) return 'ecru_linen';
  if (normalized.includes('jute_burlap') || normalized.includes('juteburlap')) return 'jute_burlap';
  if (normalized.includes('champagne_satin') || normalized.includes('champagnesatin')) return 'champagne_satin';
  if (normalized.includes('brocade_gold') || normalized.includes('brocadegold')) return 'brocade_gold';
  if (normalized.includes('liquid_copper') || normalized.includes('liquidcopper')) return 'liquid_copper';
  if (normalized.includes('cashmere_down') || normalized.includes('cashmeredown')) return 'cashmere_down';
  if (normalized.includes('amethyst_chiffon') || normalized.includes('amethystchiffon')) return 'amethyst_chiffon';
  if (normalized.includes('velvet_maroon') || normalized.includes('velvetmaroon')) return 'velvet_maroon';
  if (normalized.includes('vachetta_cowhide') || normalized.includes('vachettacowhide')) return 'vachetta_cowhide';
  if (normalized.includes('saddle_tan') || normalized.includes('saddletan')) return 'saddle_tan';
  if (normalized.includes('cordovan_oxblood') || normalized.includes('cordovanoxblood')) return 'cordovan_oxblood';
  if (normalized.includes('chambray_light') || normalized.includes('chambraylight')) return 'chambray_light';
  if (normalized.includes('denim_indigo') || normalized.includes('denimindigo')) return 'denim_indigo';
  if (normalized.includes('ballistic_nylon_black') || normalized.includes('ballisticnylonblack')) return 'ballistic_nylon_black';
  if (normalized.includes('tyvek_mesh') || normalized.includes('tyvekmesh')) return 'tyvek_mesh';
  if (normalized.includes('tarp_vinyl') || normalized.includes('tarpvinyl')) return 'tarp_vinyl';
  if (normalized.includes('olive_drab_ripstop') || normalized.includes('olivedrabripstop')) return 'olive_drab_ripstop';

  // Substring matches for Hebrew
  if (normalized.includes('כותנה') || normalized.includes('cotton')) return 'bleached_cotton';
  if (normalized.includes('פשתן') || normalized.includes('linen')) return 'ecru_linen';
  if (normalized.includes('יוטה') || normalized.includes('jute') || normalized.includes('burlap') || normalized.includes('קנבס') || normalized.includes('canvas')) return 'jute_burlap';
  if (normalized.includes('סאטן') || normalized.includes('satin')) return 'champagne_satin';
  if (normalized.includes('משי') || normalized.includes('silk') || normalized.includes('brocade') || normalized.includes('זהב') || normalized.includes('gold') || normalized.includes('פייטים') || normalized.includes('sequins')) return 'brocade_gold';
  if (normalized.includes('נחושת') || normalized.includes('copper') || normalized.includes('מתכת') || normalized.includes('metal') || normalized.includes('סיבים_מתכתיים')) return 'liquid_copper';
  if (normalized.includes('קשמיר') || normalized.includes('cashmere')) return 'cashmere_down';
  if (normalized.includes('צמר') || normalized.includes('wool') || normalized.includes('שיפון') || normalized.includes('chiffon') || normalized.includes('טול') || normalized.includes('tulle') || normalized.includes('אקריליק') || normalized.includes('acrylic')) return 'amethyst_chiffon';
  if (normalized.includes('קטיפה') || normalized.includes('velvet') || normalized.includes('maroon')) return 'velvet_maroon';
  if (normalized.includes('עור') || normalized.includes('leather') || normalized.includes('cowhide')) {
    if (normalized.includes('tan') || normalized.includes('saddle')) return 'saddle_tan';
    if (normalized.includes('cordovan') || normalized.includes('oxblood')) return 'cordovan_oxblood';
    return 'vachetta_cowhide';
  }
  if (normalized.includes('שמברה') || normalized.includes('chambray')) return 'chambray_light';
  if (normalized.includes('דנים') || normalized.includes('denim') || normalized.includes('ג\'ינס') || normalized.includes('גינס') || normalized.includes('jeans')) return 'denim_indigo';
  if (normalized.includes('ניילון') || normalized.includes('nylon')) return 'ballistic_nylon_black';
  if (normalized.includes('פוליאסטר') || normalized.includes('polyester') || normalized.includes('אלסטן') || normalized.includes('elastane') || normalized.includes('ספנדקס') || normalized.includes('spandex') || normalized.includes('לייקרה') || normalized.includes('lycra') || normalized.includes('ויסקוזה') || normalized.includes('viscose') || normalized.includes('ראיون') || normalized.includes('rayon') || normalized.includes('סינתטי') || normalized.includes('סינטטי') || normalized.includes('synthetic')) return 'tyvek_mesh';
  if (normalized.includes('ויניל') || normalized.includes('vinyl') || normalized.includes('ברזנט') || normalized.includes('tarp') || normalized.includes('גומי') || normalized.includes('rubber')) return 'tarp_vinyl';
  if (normalized.includes('ריפסטופ') || normalized.includes('ripstop') || normalized.includes('פליז') || normalized.includes('fleece') || normalized.includes('טוויל') || normalized.includes('twill') || normalized.includes('קצף') || normalized.includes('foam')) return 'olive_drab_ripstop';

  // Substring matches for Russian
  if (normalized.includes('хлопок')) return 'bleached_cotton';
  if (normalized.includes('лен') || normalized.includes('лён')) return 'ecru_linen';
  if (normalized.includes('джут') || normalized.includes('мешковина') || normalized.includes('холст') || normalized.includes('канвас')) return 'jute_burlap';
  if (normalized.includes('атлас')) return 'champagne_satin';
  if (normalized.includes('шелк') || normalized.includes('шёлк') || normalized.includes('парча') || normalized.includes('блестки')) return 'brocade_gold';
  if (normalized.includes('медь') || normalized.includes('металл')) return 'liquid_copper';
  if (normalized.includes('кашемир')) return 'cashmere_down';
  if (normalized.includes('шерсть') || normalized.includes('шифон') || normalized.includes('тюль') || normalized.includes('акрил')) return 'amethyst_chiffon';
  if (normalized.includes('бархат')) return 'velvet_maroon';
  if (normalized.includes('резина')) return 'tarp_vinyl';
  if (normalized.includes('флис') || normalized.includes('твил')) return 'olive_drab_ripstop';

  // Default fallbacks for common general material names
  if (normalized.includes('בד') || normalized.includes('ткань') || normalized.includes('fabric')) return 'other';

  return normalized;
};

export const labelForMaterial = (raw, t) => {
  if (!raw) return '';
  const canonical = canonicalMaterialKey(raw);
  const key = `taxonomy.material.${canonical}`;
  return fallback(t, key, raw);
};

/** Generic helper to map an array of codes into translated Select-ready objects. */
export const makeLabeledOptions = (codes, labelFn, t) =>
  (codes || []).map((code) => ({ value: code, label: labelFn(code, t) }));
