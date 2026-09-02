const CATEGORY_SYNONYMS = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'polo'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'leggings'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench'],
  shoes: ['shoes', 'footwear', 'sneakers', 'boots', 'sandals', 'heels', 'loafers', 'flats', 'slippers'],
  accessory: ['accessory', 'accessories', 'bag', 'handbag', 'hat', 'belt', 'scarf', 'jewelry', 'glasses', 'sunglasses', 'watch'],
  dress: ['dress', 'dresses', 'full body', 'full_body', 'jumpsuit', 'romper', 'gown', 'suit'],
};

// CURRENT IMPLEMENTATION IN ClosetScreen.tsx
function matchesCategoryCurrent(item, selectedCategory) {
  if (!selectedCategory || selectedCategory === 'all') return true;

  const rawCat = (item.category || '').toLowerCase().trim();
  const rawSub = (item.sub_category || '').toLowerCase().trim();
  const rawItemType = (item.item_type || '').toLowerCase().trim();

  const synonyms = CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase()];

  return synonyms.some(
    (syn) =>
      rawCat.includes(syn) ||
      syn.includes(rawCat) ||
      rawSub.includes(syn) ||
      rawItemType.includes(syn)
  );
}

function matchesSearchCurrent(item, query) {
  if (!query || !query.trim()) return true;

  const needle = query.trim().toLowerCase();
  const haystack = [
    item.title,
    item.name,
    item.category,
    item.sub_category,
    item.item_type,
    item.brand,
    item.color,
    item.material,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

// PROPOSED ROBUST IMPLEMENTATION
function matchesCategoryProposed(item, selectedCategory) {
  if (!item) return false;
  if (!selectedCategory || selectedCategory === 'all') return true;

  const getStr = (val) => {
    if (typeof val === 'string') return val.toLowerCase().trim();
    if (typeof val === 'object' && val !== null && 'name' in val) return String(val.name).toLowerCase().trim();
    return '';
  };

  const rawCat = getStr(item.category);
  const rawSub = getStr(item.sub_category);
  const rawItemType = getStr(item.item_type);

  const synonyms = CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase()];

  return synonyms.some((syn) => {
    const s = syn.toLowerCase().trim();
    if (!s) return false;
    return (
      (rawCat.length > 0 && (rawCat === s || rawCat.includes(s) || (rawCat.length >= 3 && s.includes(rawCat)))) ||
      (rawSub.length > 0 && (rawSub === s || rawSub.includes(s) || (rawSub.length >= 3 && s.includes(rawSub)))) ||
      (rawItemType.length > 0 && (rawItemType === s || rawItemType.includes(s) || (rawItemType.length >= 3 && s.includes(rawItemType))))
    );
  });
}

function matchesSearchProposed(item, query) {
  if (!item) return false;
  if (!query || !query.trim()) return true;

  const getStr = (val) => (typeof val === 'string' ? val.trim() : typeof val === 'number' ? String(val) : '');

  const extractTagStrings = (tags) => {
    if (!tags) return [];
    if (typeof tags === 'string') return [tags.trim()];
    if (Array.isArray(tags)) {
      return tags.flatMap((t) => {
        if (typeof t === 'string') return [t.trim()];
        if (typeof t === 'object' && t !== null) {
          return [t.name || t.label || t.title || t.tag || ''].filter(Boolean);
        }
        return [];
      });
    }
    return [];
  };

  const extractColorStrings = (item) => {
    const list = [];
    if (typeof item.color === 'string') list.push(item.color.trim());
    if (Array.isArray(item.colors)) {
      item.colors.forEach((c) => {
        if (typeof c === 'string') list.push(c.trim());
        else if (c && typeof c.name === 'string') list.push(c.name.trim());
      });
    }
    return list;
  };

  const extractMaterialStrings = (item) => {
    const list = [];
    if (typeof item.material === 'string') list.push(item.material.trim());
    if (Array.isArray(item.fabric_materials)) {
      item.fabric_materials.forEach((m) => {
        if (typeof m === 'string') list.push(m.trim());
        else if (m && typeof m.name === 'string') list.push(m.name.trim());
      });
    }
    return list;
  };

  const extractSeasonStrings = (season) => {
    if (!season) return [];
    if (typeof season === 'string') return [season.trim()];
    if (Array.isArray(season)) return season.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    return [];
  };

  const tokens = [
    getStr(item.title),
    getStr(item.name),
    getStr(item.caption),
    getStr(item.notes),
    getStr(item.category),
    getStr(item.sub_category),
    getStr(item.item_type),
    getStr(item.brand),
    getStr(item.pattern),
    getStr(item.dress_code),
    ...extractColorStrings(item),
    ...extractMaterialStrings(item),
    ...extractSeasonStrings(item.season),
    ...extractTagStrings(item.tags),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const queryTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return queryTerms.every((term) => tokens.includes(term));
}

console.log('====================================================');
console.log('1. Category Filtering with Null/Empty Category:');
console.log('Current (null -> shoes):', matchesCategoryCurrent({ category: null }, 'shoes'), '(BUG if true)');
console.log('Proposed (null -> shoes):', matchesCategoryProposed({ category: null }, 'shoes'), '(PASS if false)');
console.log('Current (empty string -> top):', matchesCategoryCurrent({ category: '' }, 'top'), '(BUG if true)');
console.log('Proposed (empty string -> top):', matchesCategoryProposed({ category: '' }, 'top'), '(PASS if false)');
console.log('Current (whitespace -> dress):', matchesCategoryCurrent({ category: '   ' }, 'dress'), '(BUG if true)');
console.log('Proposed (whitespace -> dress):', matchesCategoryProposed({ category: '   ' }, 'dress'), '(PASS if false)');

console.log('\n2. Category Filtering with Subcategory / ItemType:');
console.log('Proposed (sub_category="hoodie" -> top):', matchesCategoryProposed({ sub_category: 'hoodie' }, 'top'), '(PASS if true)');
console.log('Proposed (item_type="sneakers" -> shoes):', matchesCategoryProposed({ item_type: 'sneakers' }, 'shoes'), '(PASS if true)');

console.log('\n3. Short String False Positives:');
console.log('Current (category="o" -> top):', matchesCategoryCurrent({ category: 'o' }, 'top'), '(BUG if true)');
console.log('Proposed (category="o" -> top):', matchesCategoryProposed({ category: 'o' }, 'top'), '(PASS if false)');
console.log('Current (category="o" -> shoes):', matchesCategoryCurrent({ category: 'o' }, 'shoes'), '(BUG if true)');
console.log('Proposed (category="o" -> shoes):', matchesCategoryProposed({ category: 'o' }, 'shoes'), '(PASS if false)');

console.log('\n4. Search in colors array:');
const itemColors = { title: 'Linen Shirt', colors: [{ name: 'Navy Blue', hex: '#000080' }] };
console.log('Current search "navy":', matchesSearchCurrent(itemColors, 'navy'), '(BUG if false)');
console.log('Proposed search "navy":', matchesSearchProposed(itemColors, 'navy'), '(PASS if true)');

console.log('\n5. Search in fabric_materials array:');
const itemMat = { title: 'V-Neck', fabric_materials: [{ name: 'Cashmere', pct: 100 }] };
console.log('Current search "cashmere":', matchesSearchCurrent(itemMat, 'cashmere'), '(BUG if false)');
console.log('Proposed search "cashmere":', matchesSearchProposed(itemMat, 'cashmere'), '(PASS if true)');

console.log('\n6. Search in season array:');
const itemSeason = { title: 'Overcoat', season: ['Winter', 'Fall'] };
console.log('Current search "winter":', matchesSearchCurrent(itemSeason, 'winter'), '(BUG if false)');
console.log('Proposed search "winter":', matchesSearchProposed(itemSeason, 'winter'), '(PASS if true)');

console.log('\n7. Multi-word Search:');
const itemMulti = { title: 'Oxford Shirt', brand: 'Zara', color: 'Blue' };
console.log('Current search "blue zara shirt":', matchesSearchCurrent(itemMulti, 'blue zara shirt'), '(BUG if false)');
console.log('Proposed search "blue zara shirt":', matchesSearchProposed(itemMulti, 'blue zara shirt'), '(PASS if true)');

console.log('\n8. Object in tags array:');
const itemTagObj = { title: 'Jeans', tags: [{ name: 'vintage' }, 'summer'] };
console.log('Current search "vintage":', matchesSearchCurrent(itemTagObj, 'vintage'), '(BUG if false)');
console.log('Proposed search "vintage":', matchesSearchProposed(itemTagObj, 'vintage'), '(PASS if true)');
console.log('Current search "object":', matchesSearchCurrent(itemTagObj, 'object'), '(BUG if true)');
console.log('Proposed search "object":', matchesSearchProposed(itemTagObj, 'object'), '(PASS if false)');

console.log('\n9. Null/Undefined item crash safety:');
try {
  matchesCategoryCurrent(null, 'top');
  console.log('Current matchesCategory(null): Survived');
} catch (e) {
  console.log('Current matchesCategory(null): CRASHED with', e.message);
}
try {
  matchesSearchCurrent(null, 'test');
  console.log('Current matchesSearch(null): Survived');
} catch (e) {
  console.log('Current matchesSearch(null): CRASHED with', e.message);
}
console.log('Proposed matchesCategory(null):', matchesCategoryProposed(null, 'top'), '(PASS if false)');
console.log('Proposed matchesSearch(null):', matchesSearchProposed(null, 'test'), '(PASS if false)');
console.log('====================================================');
