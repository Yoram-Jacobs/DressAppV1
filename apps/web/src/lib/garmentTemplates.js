/**
 * Canonical 3D Garment Template Catalog & Category-Smart Router.
 *
 * Maps clothing items (top, outerwear, dress, bottom) to their repaired,
 * gender-specific canonical GLB templates in `/models/templates/{female,male}/`,
 * while routing footwear (`shoes`) and accessories (`watch`, `belt`, `glasses`,
 * `headwear`, `bag`, `necktie`, `scarf`, `jewelry`) to parametric anatomical
 * geometry builders (`createFittedFootwearGeometry`, `createAnatomicalAccessoryGeometry`).
 */

export const TEMPLATE_CACHE_VERSION = 'clean3';

export const AVAILABLE_TEMPLATES = Object.freeze([
  // Tops
  'top_tshirt',
  'top_longsleeve',
  'shirt',
  'top_tunic',
  'singlet',
  'tank',
  'vest',
  'top_strapless',
  'bandeau',
  'bustier',
  'corset',
  // Outerwear
  'hoodie',
  'cardigan',
  'jacket_blazer',
  'top_outerwear_jacket',
  'coat',
  'trench_coat',
  'kaftan',
  // Dresses
  'dress',
  'dress_strapless',
  // Bottoms
  'bottom_trousers',
  'bottom_shorts',
  'bermuda',
  'bottom_skirt',
  'skirt_pencil',
]);

export const CANONICAL_TEMPLATE_MAP = Object.freeze({
  // Tops
  tshirt: 'top_tshirt',
  top_tshirt: 'top_tshirt',
  longsleeve: 'top_longsleeve',
  top_longsleeve: 'top_longsleeve',
  shirt: 'shirt',
  tunic: 'top_tunic',
  top_tunic: 'top_tunic',
  singlet: 'singlet',
  tank: 'tank',
  vest: 'vest',
  strapless: 'top_strapless',
  tube: 'top_strapless',
  top_strapless: 'top_strapless',
  bandeau: 'bandeau',
  bustier: 'bustier',
  corset: 'corset',

  // Outerwear
  hoodie: 'hoodie',
  cardigan: 'cardigan',
  blazer: 'jacket_blazer',
  jacket_blazer: 'jacket_blazer',
  jacket: 'top_outerwear_jacket',
  top_outerwear_jacket: 'top_outerwear_jacket',
  coat: 'coat',
  trench_coat: 'trench_coat',
  kaftan: 'kaftan',

  // Dresses
  dress: 'dress',
  dress_midi: 'dress',
  dress_strapless: 'dress_strapless',

  // Bottoms
  pants: 'bottom_trousers',
  trousers: 'bottom_trousers',
  bottom_trousers: 'bottom_trousers',
  shorts: 'bottom_shorts',
  bottom_shorts: 'bottom_shorts',
  bermuda: 'bermuda',
  skirt: 'bottom_skirt',
  skirt_aline: 'bottom_skirt',
  bottom_skirt: 'bottom_skirt',
  skirt_pencil: 'skirt_pencil',
});

const PARAMETRIC_ONLY_SLOTS = new Set([
  'shoes',
  'footwear',
  'watch',
  'belt',
  'glasses',
  'headwear',
  'hat',
  'bag',
  'necktie',
  'scarf',
  'jewelry',
  'accessory',
]);

/**
 * Resolves the gender-specific GLB URL for a canonical template ID, or null if invalid.
 */
export function getTemplateGlbUrl(templateId, isMale = false) {
  if (!templateId) return null;
  const canonical = CANONICAL_TEMPLATE_MAP[templateId] || templateId;
  if (!AVAILABLE_TEMPLATES.includes(canonical)) return null;
  const sexFolder = isMale ? 'male' : 'female';
  return `/models/templates/${sexFolder}/${canonical}.glb?v=${TEMPLATE_CACHE_VERSION}`;
}

/**
 * Resolves the best-matching canonical 3D template ID for core clothing slots,
 * returning `null` for footwear and accessories so they always use fitted anatomical builders.
 */
export function resolveGarmentTemplate({
  rawSlot = '',
  garmentText = '',
  aspect = 0.75,
  slot = '',
  category = '',
} = {}) {
  const effectiveSlot = String(rawSlot || slot || '').toLowerCase().trim();
  if (!effectiveSlot || PARAMETRIC_ONLY_SLOTS.has(effectiveSlot)) {
    return null;
  }

  const text = `${garmentText} ${category} ${slot}`.toLowerCase();
  const has = (...words) => words.some((w) => text.includes(w));

  // 1. DRESSES / FULL-BODY
  if (effectiveSlot === 'dress') {
    if (has('kaftan', 'caftan', 'abaya', 'קפטן', 'גלבי')) {
      return 'kaftan';
    }
    if (has(
      'strapless', 'tube', 'bandeau', 'bustier', 'corset', 'sweetheart',
      'סטרפלס', 'בנדו', 'בוסטייה', 'קורסט', 'מחוך', 'sans bretelles', 'trägerlos'
    )) {
      return 'dress_strapless';
    }
    return 'dress';
  }

  // 2. BOTTOMS
  if (effectiveSlot === 'bottom') {
    if (has('skirt', 'חצאית', 'jupe', 'falda', 'rock', 'gonna')) {
      const isPencilOrStraight =
        has(
          'pencil', 'straight', 'bodycon', 'fitted', 'slim', 'mini', 'narrow', 'tube',
          'עיפרון', 'ישרה', 'צמודה', 'מיני', 'קצרה'
        ) &&
        !has('pleated', 'plisse', 'a-line', 'aline', 'flared', 'skater', 'פליסה', 'מתרחבת', 'קפלים', 'פעמון');
      if (isPencilOrStraight || aspect < 0.68) {
        return 'skirt_pencil';
      }
      return 'bottom_skirt';
    }

    if (has('bermuda', 'capri', 'pedal pusher', 'knee-length short', 'ברמודה', 'קפרי', 'שלושת רבעי')) {
      return 'bermuda';
    }

    if (has('shorts', 'short ', 'hotpants', 'booty short', 'שורטס', 'מכנסיים קצרים', 'מכנס קצר')) {
      return 'bottom_shorts';
    }

    return 'bottom_trousers';
  }

  // 3. OUTERWEAR
  if (effectiveSlot === 'outerwear') {
    // Sleeveless vest / waistcoat / gilet classified under outerwear
    if (
      has('vest', 'waistcoat', 'gilet', 'sleeveless jacket', 'ווסט', 'אפודה', 'שכמייה ללא שרוולים') &&
      !has('long sleeve', 'שרוול ארוך')
    ) {
      return 'vest';
    }
    if (has('trench', 'טרנץ', 'gabardine', 'raincoat', 'מעיל גשם')) {
      return 'trench_coat';
    }
    if (has('kaftan', 'kimono', 'robe', 'קפטן', 'קימונו', 'חלוק')) {
      return 'kaftan';
    }
    if (has('overcoat', 'peacoat', 'parka', 'duster', 'coat', 'מעיל', 'manteau', 'mantel', 'abrigo')) {
      return 'coat';
    }
    if (has('cardigan', 'קרדיגן', 'עליונית סרוגה')) {
      return 'cardigan';
    }
    if (has('hoodie', 'קפוצ׳ון', "קפוצ'ון", 'סווטשירט קפוצ')) {
      return 'hoodie';
    }
    if (has('blazer', 'suit jacket', 'sport coat', 'tuxedo', 'בלייזר', 'מקטורן', 'חליפה')) {
      return 'jacket_blazer';
    }
    return 'top_outerwear_jacket';
  }

  // 4. TOPS
  if (effectiveSlot === 'top') {
    if (has('bandeau', 'בנדו')) {
      return 'bandeau';
    }
    if (has('bustier', 'בוסטייה')) {
      return 'bustier';
    }
    if (has('corset', 'קורסט', 'מחוך')) {
      return 'corset';
    }
    if (has('strapless', 'tube top', 'tube ', 'סטרפלס', 'טיוב', 'sans bretelles', 'trägerlos')) {
      return 'top_strapless';
    }
    if (has('vest', 'waistcoat', 'gilet', 'ווסט', 'אפודה')) {
      return 'vest';
    }
    if (has('singlet', 'camisole', 'cami', 'spaghetti', 'halter', 'גופיית ספגטי', 'קמיסול', 'קולר')) {
      return 'singlet';
    }
    if (has('tank', 'sleeveless', 'muscle tee', 'גופיה', 'גופייה', 'ללא שרוולים')) {
      return 'tank';
    }
    if (has('hoodie', 'sweatshirt', 'קפוצ׳ון', "קפוצ'ון", 'סווטשירט')) {
      return 'hoodie';
    }
    if (has('cardigan', 'קרדיגן')) {
      return 'cardigan';
    }
    if (has('tunic', 'kurta', 'longline', 'טוניקה')) {
      return 'top_tunic';
    }
    if (
      has(
        'dress shirt', 'button-down', 'button down', 'button-up', 'oxford', 'chambray',
        'מכופתרת', 'חולצה מכופתרת', 'אוקספורד'
      ) &&
      !has('short sleeve', 'שרוול קצר', 'קצרה')
    ) {
      return 'shirt';
    }
    if (
      has(
        'long sleeve', 'long-sleeve', 'sweater', 'pullover', 'jumper', 'turtleneck', 'knit', 'blouse',
        'שרוול ארוך', 'סוודר', 'סריג', 'גולף', 'חולצה ארוכה'
      ) &&
      !has('short sleeve', 'שרוול קצר')
    ) {
      return 'top_longsleeve';
    }
    return 'top_tshirt';
  }

  return null;
}
