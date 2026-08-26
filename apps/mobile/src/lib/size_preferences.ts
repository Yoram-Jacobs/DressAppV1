/**
 * apps/mobile/src/lib/size_preferences.ts
 *
 * Pick the most appropriate user size preference for a given garment category.
 * Mirrors apps/web/src/lib/size_preferences.js.
 */

export function deriveSizeFromPreferences(user: any, item: { category?: string; sub_category?: string; item_type?: string }): string {
  if (!user) return '';
  const meas = user.body_measurements || user.measurements || {};
  const cat = String(item?.category || '').toLowerCase();
  const sub = String(item?.sub_category || '').toLowerCase();
  const type = String(item?.item_type || '').toLowerCase();
  const blob = `${sub} ${type}`;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = meas[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  // Footwear → shoe size
  if (cat === 'footwear' || /shoe|sneaker|boot|sandal|heel|loafer/.test(blob)) {
    return pick('shoe_size');
  }

  // Underwear: bra for females / bra items, otherwise shirt size
  if (cat === 'underwear' || /bra|bralette|lingerie/.test(blob)) {
    if (/bra|bralette/.test(blob) || user?.sex === 'female' || user?.gender === 'female') {
      return pick('bra_size', 'shirt_size');
    }
    return pick('shirt_size');
  }

  // Full-body / dress-coded garments → dress_size first, then shirt_size
  if (cat === 'full body' || /dress|jumpsuit|gown|kaftan|robe/.test(blob)) {
    return pick('dress_size', 'shirt_size');
  }

  // Skirts: dress_size or pants_size or shirt_size
  if (/skirt/.test(blob)) {
    return pick('dress_size', 'pants_size', 'shirt_size');
  }

  // Bottoms (pants, jeans, shorts, …)
  if (cat === 'bottom' || /pants|jeans|trouser|short|legging/.test(blob)) {
    return pick('pants_size');
  }

  // Default: top / outerwear
  if (
    cat === 'top' ||
    cat === 'outerwear' ||
    /shirt|tee|t-shirt|blouse|sweater|hoodie|jacket|coat|cardigan|blazer/.test(blob)
  ) {
    return pick('shirt_size');
  }

  return '';
}
