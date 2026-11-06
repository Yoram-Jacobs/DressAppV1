/**
 * Canonical 3D Garment & Accessory Templates Catalog & Resolver
 *
 * Maps wardrobe catalog items, categories, and Hebrew/English keywords
 * directly to their production-grade 3D GLB archetype models.
 */

export const AVAILABLE_TEMPLATES = [
  'singlet',
  'tshirt',
  'tunic',
  'top_tunic',
  'shirt',
  'hoodie',
  'top_outerwear_jacket',
  'jacket',
  'jacket_blazer',
  'cardigan',
  'vest',
  'coat',
  'trench_coat',
  'kaftan',
  'dress',
  'pants',
  'bottom_trousers',
  'shorts',
  'bottom_shorts',
  'bermuda',
  'skirt',
  'bottom_skirt',
  'skirt_aline',
  'skirt_pencil',
  'hat',
  'hat_cap',
  'hat_fedora',
  'bag',
  'bag_handbag',
  'bag_crossbody',
  'belt',
  'shoes_sneakers',
  'shoes_boots',
  'accessory_glasses',
];

export const CANONICAL_TEMPLATES = [
  'top_tshirt',
  'top_tunic',
  'top_longsleeve',
  'top_outerwear_jacket',
  'bottom_trousers',
  'bottom_shorts',
  'bottom_skirt',
  'dress',
  'shoes_sneakers',
  'shoes_boots',
  'accessory_belt',
  'accessory_hat',
  'accessory_glasses',
  'accessory_crossbody_bag',
];

export const CANONICAL_TEMPLATE_MAP = {
  singlet: 'singlet',
  tank: 'singlet',
  tshirt: 'top_tshirt',
  tunic: 'top_tunic',
  top_tunic: 'top_tunic',
  tunic: 'top_tunic',
  top_tunic: 'top_tunic',
  top_tshirt: 'top_tshirt',
  shirt: 'top_longsleeve',
  hoodie: 'hoodie',
  top_longsleeve: 'top_longsleeve',
  top_outerwear_jacket: 'top_outerwear_jacket',
  jacket: 'top_outerwear_jacket',
  jacket_blazer: 'jacket_blazer',
  cardigan: 'cardigan',
  vest: 'vest',
  coat: 'coat',
  trench_coat: 'trench_coat',
  kaftan: 'kaftan',
  dress: 'dress',
  pants: 'bottom_trousers',
  bottom_trousers: 'bottom_trousers',
  shorts: 'bottom_shorts',
  bottom_shorts: 'bottom_shorts',
  bermuda: 'bermuda',
  skirt: 'bottom_skirt',
  bottom_skirt: 'bottom_skirt',
  skirt_aline: 'bottom_skirt',
  skirt_pencil: 'skirt_pencil',
  sneakers: 'shoes_sneakers',
  shoes_sneakers: 'shoes_sneakers',
  boots: 'shoes_boots',
  shoes_boots: 'shoes_boots',
  hat: 'accessory_hat',
  hat_cap: 'accessory_hat',
  hat_fedora: 'accessory_hat',
  accessory_hat: 'accessory_hat',
  glasses: 'accessory_glasses',
  accessory_glasses: 'accessory_glasses',
  bag: 'accessory_crossbody_bag',
  bag_handbag: 'accessory_crossbody_bag',
  bag_crossbody: 'accessory_crossbody_bag',
  accessory_crossbody_bag: 'accessory_crossbody_bag',
  belt: 'accessory_belt',
  accessory_belt: 'accessory_belt',
};

export function getTemplateGlbUrl(templateId, isMale) {
  if (!templateId) return null;
  const isValid =
    AVAILABLE_TEMPLATES.includes(templateId) ||
    CANONICAL_TEMPLATES.includes(templateId) ||
    Boolean(CANONICAL_TEMPLATE_MAP[templateId]);
  if (!isValid) return null;
  if (typeof isMale === 'boolean') {
    const genderDir = isMale ? 'male' : 'female';
    const canonicalName = CANONICAL_TEMPLATE_MAP[templateId] || templateId;
    return `/models/templates/${genderDir}/${canonicalName}.glb?v=canon12`;
  }
  return `/models/templates/${templateId}.glb?v=canon12`;
}

/**
 * Resolves the optimal 3D GLB template for a given wardrobe item.
 */
export function resolveGarmentTemplate({
  rawSlot = '',
  garmentText = '',
  aspect = 0.55,
  slot = '',
  category = '',
} = {}) {
  const fullText = `${slot} ${category} ${rawSlot} ${garmentText}`.toLowerCase();
  const has = (...words) => words.some((w) => {
    if (/^[a-z0-9_ -]+$/i.test(w)) {
      const escaped = w.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const reg = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      return reg.test(fullText);
    }
    return fullText.includes(w.toLowerCase());
  });

  // 1. STANDALONE ACCESSORIES (Only when slot is accessory or explicit accessory slot)
  const isAccessoryRole = ['belt', 'headwear', 'bag', 'accessory', 'scarf', 'jewelry', 'glasses'].includes(rawSlot);
  if (rawSlot === 'belt' || (isAccessoryRole && has('belt', 'חגורה'))) {
    return 'belt';
  }
  if (rawSlot === 'headwear' || (isAccessoryRole && has('hat', 'cap', 'beanie', 'fedora', 'beret', 'כובע', 'קסקט', 'מצחיה', 'מצחייה'))) {
    if (has('cap', 'baseball', 'קסקט', 'מצחיה', 'מצחייה')) return 'hat_cap';
    return 'hat_fedora';
  }
  if (rawSlot === 'bag' || (isAccessoryRole && has('bag', 'handbag', 'tote', 'crossbody', 'purse', 'clutch', 'תיק', 'ארנק'))) {
    if (has('crossbody', 'shoulder', 'side', 'אלכסון', 'צד')) return 'bag_crossbody';
    return 'bag_handbag';
  }
  if (rawSlot === 'glasses' || (isAccessoryRole && has('glasses', 'sunglasses', 'משקפיים', 'משקפי'))) {
    return 'accessory_glasses';
  }

  // 2. FULL-BODY / ROBES / KAFTAN / GALABIYE (Only for dresses / outerwear / robes, never for tops/bottoms)
  const isFullBodyRole = ['dress', 'fullbody', 'robe', 'one-piece', 'kaftan', 'outerwear'].includes(rawSlot);
  if (
    (isFullBodyRole || !rawSlot) &&
    !['top', 'bottom', 'shoes'].includes(rawSlot) &&
    has('kaftan', 'caftan', 'galabiye', 'galabeya', 'jalabiya', 'abaya', 'djellaba', 'thobe', 'robe', 'robes', 'כפתן', 'גלבייה', 'גלביה', 'עבאיה', 'חלוק')
  ) {
    return 'kaftan';
  }

  // 3. OUTERWEAR
  if (rawSlot === 'outerwear') {
    if (has('trench', 'טרנץ', "טרנץ'")) return 'trench_coat';
    if (has('cardigan', 'קרדיגן')) return 'cardigan';
    if (has('vest', 'וסט', 'אפודה')) return 'vest';
    if (has('blazer', 'suit', 'בלייזר', 'מקטורן')) return 'jacket_blazer';
    if (has('overcoat', 'coat', 'מעיל', 'מנטו', 'cappotto', 'abrigo', 'mantel', 'пальто', 'duster', 'parka')) {
      return aspect <= 0.78 ? 'trench_coat' : 'coat';
    }
    if (has('jacket', 'זקט', 'גקט')) return 'top_outerwear_jacket';
    return aspect <= 0.82 ? 'trench_coat' : 'top_outerwear_jacket';
  }

  // 4. DRESS
  if (rawSlot === 'dress') {
    return 'dress';
  }

  // 4b. FOOTWEAR / SHOES
  if (rawSlot === 'shoes') {
    if (has('boot', 'boots', 'chelsea', 'מגף', 'מגפיים', 'מגפי')) return 'shoes_boots';
    return 'shoes_sneakers';
  }

  // 5. BOTTOMS
  if (rawSlot === 'bottom') {
    if (has('skirt', 'חצאית')) {
      if (has('pencil', 'tight', 'straight', 'עיפרון', 'צמודה', 'ישרה')) return 'skirt_pencil';
      return 'skirt_aline';
    }
    if (has('short', 'shorts', 'שורט', 'שורטס', 'קצרים', 'מכנס קצר')) {
      if (has('bermuda', 'cargo', 'knee', 'ברמודה', 'דגמ"ח', 'דגמח', 'עד הברך')) return 'bermuda';
      return 'shorts';
    }
    if (has('bermuda', 'cargo', 'ברמודה', 'דגמ"ח', 'דגמח')) {
      return 'bermuda';
    }
    return 'pants';
  }

  // 6. TOPS
  if (rawSlot === 'top' && has('tunic', 'טוניקה', 'kurta', 'קורטה')) return 'top_tunic';
  if (rawSlot === 'top') {
    if (has('tank', 'singlet', 'sleeveless', 'vest', 'camisole', 'גופיה', 'גופייה', 'גופית', 'גופיית', 'בלי שרוולים')) return 'singlet';
    if (has('hoodie', 'sweatshirt', 'sweater', 'knit', 'pullover', 'fleece', 'סוודר', 'סווטשירט', "קפוצ'ון", 'סריג')) return 'hoodie';
    if (has('long sleeve', 'long-sleeve', 'longsleeve', 'long-sleeved', 'long sleeved', 'long_sleeve', 'שרוול ארוך', 'שרוולים ארוכים')) return 'top_longsleeve';
    if (has('button', 'collared', 'dress shirt', 'blouse', 'חולצה מכופתרת', 'מכופתרת', 'חולצה אלגנטית')) return 'shirt';
    if (has('t-shirt', 'tshirt', 'tee', 'טי שירט', 'חולצת טי', 'חולצה קצרה', 'טריקו')) return 'tshirt';
    return aspect < 0.70 ? 'shirt' : 'tshirt';
  }

  return null;
}
