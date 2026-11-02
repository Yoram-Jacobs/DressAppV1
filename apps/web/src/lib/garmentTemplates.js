/**
 * Canonical 3D Garment & Accessory Templates Catalog & Resolver
 *
 * Maps wardrobe catalog items, categories, and Hebrew/English keywords
 * directly to their production-grade 3D GLB archetype models.
 */

export const AVAILABLE_TEMPLATES = [
  'singlet',
  'tshirt',
  'shirt',
  'hoodie',
  'trench_coat',
  'cardigan',
  'jacket_blazer',
  'kaftan',
  'pants',
  'shorts',
  'bermuda',
  'skirt_aline',
  'skirt_pencil',
  'dress',
  'hat_cap',
  'hat_fedora',
  'bag_handbag',
  'bag_crossbody',
  'belt',
];

export const CANONICAL_TEMPLATES = [
  'top_tshirt',
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
  singlet: 'top_tshirt',
  tshirt: 'top_tshirt',
  top_tshirt: 'top_tshirt',
  shirt: 'top_longsleeve',
  hoodie: 'top_longsleeve',
  top_longsleeve: 'top_longsleeve',
  trench_coat: 'top_outerwear_jacket',
  cardigan: 'top_outerwear_jacket',
  jacket_blazer: 'top_outerwear_jacket',
  top_outerwear_jacket: 'top_outerwear_jacket',
  kaftan: 'dress',
  pants: 'bottom_trousers',
  bottom_trousers: 'bottom_trousers',
  shorts: 'bottom_shorts',
  bermuda: 'bottom_shorts',
  bottom_shorts: 'bottom_shorts',
  skirt_aline: 'bottom_skirt',
  skirt_pencil: 'bottom_skirt',
  dress: 'dress',
  bottom_skirt: 'bottom_skirt',
  sneakers: 'shoes_sneakers',
  shoes_sneakers: 'shoes_sneakers',
  boots: 'shoes_boots',
  shoes_boots: 'shoes_boots',
  hat_cap: 'accessory_hat',
  hat_fedora: 'accessory_hat',
  accessory_hat: 'accessory_hat',
  glasses: 'accessory_glasses',
  accessory_glasses: 'accessory_glasses',
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
    return `/models/templates/${genderDir}/${canonicalName}.glb?v=canon2`;
  }
  return `/models/templates/${templateId}.glb`;
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
  const has = (...words) => words.some((w) => fullText.includes(w));

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

  // 2. FULL-BODY / ROBES / KAFTAN / GALABIYE
  if (has('kaftan', 'caftan', 'galabiye', 'galabeya', 'jalabiya', 'abaya', 'djellaba', 'thobe', 'robe', 'כפתן', 'גלבייה', 'גלביה', 'עבאיה', 'חלוק')) {
    return 'kaftan';
  }

  // 3. OUTERWEAR
  if (rawSlot === 'outerwear') {
    if (has('cardigan', 'קרדיגן')) return 'cardigan';
    if (has('blazer', 'suit', 'בלייזר', 'מקטורן')) return 'jacket_blazer';
    if (has('trench', 'overcoat', 'coat', 'parka', 'duster', 'raincoat', 'טרנץ', "טרנץ'", 'מעיל', 'מנטו')) return 'trench_coat';
    return aspect <= 0.85 ? 'trench_coat' : 'jacket_blazer';
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
  if (rawSlot === 'top') {
    if (has('tank', 'singlet', 'sleeveless', 'vest', 'camisole', 'גופיה', 'גופייה', 'גופית', 'גופיית', 'בלי שרוולים')) return 'singlet';
    if (has('hoodie', 'sweatshirt', 'sweater', 'knit', 'pullover', 'fleece', 'סוודר', 'סווטשירט', "קפוצ'ון", 'סריג')) return 'hoodie';
    if (has('button', 'collared', 'dress shirt', 'blouse', 'חולצה מכופתרת', 'מכופתרת', 'חולצה אלגנטית')) return 'shirt';
    if (has('t-shirt', 'tshirt', 'tee', 'טי שירט', 'חולצת טי', 'חולצה קצרה', 'טריקו')) return 'tshirt';
    return aspect < 0.70 ? 'shirt' : 'tshirt';
  }

  return null;
}
