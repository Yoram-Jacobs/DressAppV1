/**
 * Canonical 3D Garment Template Catalog & Category-Smart Router.
 *
 * Maps clothing items (top, outerwear, dress, bottom) to their repaired,
 * gender-specific canonical GLB templates in `/models/templates/{female,male}/`,
 * while routing footwear (`shoes`) and accessories (`watch`, `belt`, `glasses`,
 * `headwear`, `bag`, `necktie`, `scarf`, `jewelry`) to parametric anatomical
 * geometry builders (`createFittedFootwearGeometry`, `createAnatomicalAccessoryGeometry`).
 */

export const TEMPLATE_CACHE_VERSION = 'clean11';

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
  'strapless_torso',
  'bandeau',
  'bandeau_torso',
  'bustier',
  'corset',
  // Outerwear & Hooded Models
  'hoodie',
  'hoodie_hood_off',
  'hoodie_hood_on',
  'hooded_coat',
  'hooded_coat_hood_off',
  'hooded_coat_hood_on',
  'cardigan',
  'jacket_blazer',
  'top_outerwear_jacket',
  'coat',
  'trench_coat',
  'kaftan',
  // Dresses
  'dress',
  'dress_strapless',
  'kurta_set',
  // Bottoms
  'bottom_trousers',
  'bottom_shorts',
  'bermuda',
  'bottom_skirt',
  'skirt_pencil',
  // Footwear
  'shoes_boots',
  'shoes_sneakers',
  'boots',
  'sneakers',
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
  strapless: 'strapless_torso',
  tube: 'strapless_torso',
  top_strapless: 'strapless_torso',
  strapless_torso: 'strapless_torso',
  bandeau: 'bandeau_torso',
  bandeau_torso: 'bandeau_torso',
  bustier: 'strapless_torso',
  corset: 'strapless_torso',

  // Outerwear & Hooded Models
  hoodie: 'hoodie',
  hoodie_hood_off: 'hoodie_hood_off',
  hoodie_hood_on: 'hoodie_hood_on',
  hooded_coat: 'hooded_coat',
  hooded_coat_hood_off: 'hooded_coat_hood_off',
  hooded_coat_hood_on: 'hooded_coat_hood_on',
  parka: 'hooded_coat',
  anorak: 'hooded_coat',
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
  kurta_set: 'kurta_set',

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

  // Footwear
  shoes_boots: 'shoes_boots',
  boots: 'shoes_boots',
  shoes_sneakers: 'shoes_sneakers',
  sneakers: 'shoes_sneakers',
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

const HOODED_KEYWORDS = [
  'hoodie', 'hooded', 'zip-up hood', 'zip hood', 'pullover hood',
  'קפוצ׳ון', "קפוצ'ון", 'קפוצון', 'עם כובע', 'כובע צמוד', 'סווטשירט קפוצ',
  'capuche', 'kapuze', 'capucha', 'cappuccio', 'капюшон', 'худи',
  '连帽', 'フード', 'パーカー', '후드', 'هودي',
];

const INHERENT_HOODED_OUTERWEAR_KEYWORDS = [
  'parka', 'anorak', 'duffle coat', 'duffel coat',
  'פארקה', 'אנורק', 'מעיל קפוצ',
];

const COAT_OR_JACKET_KEYWORDS = [
  'coat', 'overcoat', 'peacoat', 'parka', 'anorak', 'duster', 'trench',
  'puffer', 'down jacket', 'raincoat', 'windbreaker', 'jacket', 'duffle', 'duffel',
  'מעיל', "ג'קט", "ז'קט", 'ג׳קט', 'ז׳קט', 'פארקה', 'אנורק', 'טרנץ',
  'manteau', 'mantel', 'abrigo',
];

/**
 * Returns true when an upper-body garment carries a hood (hoodie, zip-hoodie,
 * hooded coat, parka, anorak, etc.).
 */
export function isHoodedGarment({
  rawSlot = '',
  garmentText = '',
  slot = '',
  category = '',
} = {}) {
  const effectiveSlot = String(rawSlot || slot || '').toLowerCase().trim();
  if (!effectiveSlot || PARAMETRIC_ONLY_SLOTS.has(effectiveSlot) || effectiveSlot === 'bottom' || effectiveSlot === 'dress') {
    return false;
  }
  const text = `${garmentText} ${category} ${slot} ${rawSlot}`.toLowerCase();
  const has = (words) => words.some((w) => text.includes(w));
  if (has(INHERENT_HOODED_OUTERWEAR_KEYWORDS)) {
    return true;
  }
  if (has(HOODED_KEYWORDS)) {
    return true;
  }
  return has(COAT_OR_JACKET_KEYWORDS) && (text.includes('hood') || text.includes('קפוצ'));
}

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
  hoodMode = 'off',
} = {}) {
  const effectiveSlot = String(rawSlot || slot || '').toLowerCase().trim();
  if (!effectiveSlot || PARAMETRIC_ONLY_SLOTS.has(effectiveSlot)) {
    return null;
  }

  const text = `${garmentText} ${category} ${slot}`.toLowerCase();
  const has = (...words) => words.some((w) => text.includes(w));
  const wantHoodOn = hoodMode === 'on';

  // 1. DRESSES / FULL-BODY
  if (effectiveSlot === 'dress') {
    if (has('kurta set', 'kurta_set', 'kurta pyjama', 'kurta-pyjama', 'סט קורטה')) {
      return 'kurta_set';
    }
    if (has('kaftan', 'caftan', 'abaya', 'galabiya', 'jalabiya', 'thobe', 'קפטן', 'כפתן', 'עבאיה', 'גלבי', 'תוב')) {
      return 'kaftan';
    }
    if (has('tunic', 'kurta', 'kurti', 'קורטה', 'כורטה', 'קורטי', 'טוניקה', 'longline')) {
      return 'top_tunic';
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
    const isHoodedCoat =
      has(...INHERENT_HOODED_OUTERWEAR_KEYWORDS) ||
      (has(...COAT_OR_JACKET_KEYWORDS) && (has(...HOODED_KEYWORDS) || text.includes('hood') || text.includes('קפוצ')));
    if (isHoodedCoat) {
      return wantHoodOn ? 'hooded_coat_hood_on' : 'hooded_coat';
    }
    if (has(...HOODED_KEYWORDS)) {
      return wantHoodOn ? 'hoodie_hood_on' : 'hoodie';
    }
    if (has('trench', 'טרנץ', 'gabardine', 'raincoat', 'מעיל גשם')) {
      return 'trench_coat';
    }
    if (has('kaftan', 'kimono', 'robe', 'קפטן', 'קימונו', 'חלוק')) {
      return 'kaftan';
    }
    if (has('overcoat', 'peacoat', 'duster', 'coat', 'מעיל', 'manteau', 'mantel', 'abrigo')) {
      return 'coat';
    }
    if (has('cardigan', 'קרדיגן', 'עליונית סרוגה')) {
      return 'cardigan';
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
    if (has(...HOODED_KEYWORDS)) {
      return wantHoodOn ? 'hoodie_hood_on' : 'hoodie';
    }
    if (has('sweatshirt', 'סווטשירט')) {
      return 'top_longsleeve';
    }
    if (has('cardigan', 'קרדיגן')) {
      return 'cardigan';
    }
    if (has('tunic', 'kurta', 'kurti', 'longline', 'טוניקה', 'קורטה', 'כורטה', 'קורטי')) {
      return 'top_tunic';
    }
    if (
      has(
        't-shirt', 'tshirt', 't shirt', 'tee',
        'טי שירט', 'טי-שירט', 'חולצת טי', 'טישירט'
      ) &&
      !has('long sleeve', 'long-sleeve', 'שרוול ארוך')
    ) {
      return 'top_tshirt';
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

  // 5. FOOTWEAR / SHOES
  if (effectiveSlot === 'shoes' || effectiveSlot === 'footwear') {
    if (has('sneaker', 'trainer', 'running', 'tennis', 'athletic', 'סניקרס', 'נעלי ספורט', 'basket', 'zapatilla', 'кроссовк', 'turnschuhe')) {
      return 'shoes_sneakers';
    }
    // Default boots, knee-high boots, ankle boots, and leather shoes to authentic 3D boots template
    return 'shoes_boots';
  }

  return null;
}
