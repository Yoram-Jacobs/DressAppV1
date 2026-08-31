const assert = require('assert');

// CATEGORY SYNONYMS table
const CATEGORY_SYNONYMS = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'polo', 'crop top', 'cardigan'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'leggings', 'joggers', 'pant', 'trouser', 'short'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench', 'windbreaker', 'overcoat', 'topcoat'],
  shoes: ['shoes', 'shoe', 'footwear', 'sneakers', 'sneaker', 'boots', 'boot', 'sandals', 'sandal', 'heels', 'heel', 'loafers', 'loafer', 'flats', 'flat', 'slippers', 'slipper', 'pumps', 'clogs'],
  accessory: ['accessory', 'accessories', 'bag', 'handbag', 'hat', 'belt', 'scarf', 'jewelry', 'glasses', 'sunglasses', 'watch', 'cap', 'beanie'],
  dress: ['dress', 'dresses', 'full body', 'full_body', 'jumpsuit', 'romper', 'gown', 'suit', 'overall', 'overalls'],
};

function matchesCategory(item, selectedCategory) {
  if (!item) return false;
  if (!selectedCategory || selectedCategory === 'all') return true;

  const getStr = (val) => {
    if (typeof val === 'string') return val.toLowerCase().trim();
    if (typeof val === 'object' && val !== null && 'name' in val) {
      return String(val.name).toLowerCase().trim();
    }
    return '';
  };

  const rawCat = getStr(item.category);
  const rawSub = getStr(item.sub_category);
  const rawItemType = getStr(item.item_type);

  // Guard: If item has no category data at all, it only matches 'all' (or explicit unassigned/other)
  if (!rawCat && !rawSub && !rawItemType) {
    return selectedCategory === 'unassigned' || selectedCategory === 'other';
  }

  const synonyms =
    CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase().trim()];

  const checkMatch = (val) => {
    if (!val) return false;

    // Fast path: direct exact match against synonyms list
    if (synonyms.includes(val)) return true;

    // Tokenized word-level match and multi-word phrase check
    const tokens = val.split(/[\s,/\-_]+/).filter(Boolean);

    return synonyms.some((syn) => {
      const s = syn.toLowerCase().trim();
      if (!s) return false;

      // 1. Exact value match
      if (val === s) return true;

      // 2. Token match (e.g., 'shoes' in 'running shoes', 'dress' in 'short dress')
      if (tokens.includes(s)) return true;

      // 3. Multi-word phrase match (e.g. 'full body' or 'tank top')
      if (s.includes(' ') && val.includes(s)) return true;
      if (val.includes(' ') && s.includes(val)) return true;

      // 4. Safe substring containment for longer tokens (length >= 4)
      if (s.length >= 4 && val.includes(s)) return true;

      return false;
    });
  };

  return checkMatch(rawCat) || checkMatch(rawSub) || checkMatch(rawItemType);
}

function matchesSearch(item, query) {
  if (!item) return false;
  if (!query || !query.trim()) return true;

  const getStr = (val) =>
    typeof val === 'string' ? val.trim() : typeof val === 'number' ? String(val) : '';

  const extractTagStrings = (tags) => {
    if (!tags) return [];
    if (typeof tags === 'string') return tags.split(',').map((s) => s.trim()).filter(Boolean);
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

  const extractAttributes = (attrs) => {
    if (!attrs || typeof attrs !== 'object') return [];
    if (Array.isArray(attrs)) return attrs.map((a) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean);
    return Object.values(attrs).map((v) => (typeof v === 'string' ? v : '')).filter(Boolean);
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
    getStr(item.size),
    getStr(item.pattern),
    getStr(item.dress_code),
    ...extractColorStrings(item),
    ...extractMaterialStrings(item),
    ...extractSeasonStrings(item.season),
    ...extractTagStrings(item.tags),
    ...extractAttributes(item.attributes),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const queryTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return queryTerms.every((term) => tokens.includes(term));
}

// ── Test Execution ───────────────────────────────────────────────────────────
console.log('Running test suite for ClosetScreen matchesCategory & matchesSearch...\n');

const categoryTests = [
  { name: 'null category with shoes filter', item: { category: null }, cat: 'shoes', expected: false },
  { name: 'undefined category with top filter', item: { category: undefined }, cat: 'top', expected: false },
  { name: 'empty string category with outerwear filter', item: { category: '' }, cat: 'outerwear', expected: false },
  { name: 'whitespace category with dress filter', item: { category: '   ' }, cat: 'dress', expected: false },
  { name: 'null category with all filter', item: { category: null }, cat: 'all', expected: true },
  { name: 'shoes category with shoes filter', item: { category: 'Shoes' }, cat: 'shoes', expected: true },
  { name: 'footwear category with shoes filter', item: { category: 'Footwear' }, cat: 'shoes', expected: true },
  { name: 'full body category with dress filter', item: { category: 'Full Body' }, cat: 'dress', expected: true },
  { name: 'top category with bottom filter', item: { category: 'Top' }, cat: 'bottom', expected: false },
  { name: 'sub_category sneakers with shoes filter', item: { category: null, sub_category: 'sneakers' }, cat: 'shoes', expected: true },
  { name: 'running shoes with shoes filter', item: { category: 'running shoes' }, cat: 'shoes', expected: true },
  { name: 'short dress with dress filter', item: { category: 'short dress' }, cat: 'dress', expected: true },
  { name: 'null item with all filter', item: null, cat: 'all', expected: false },
  { name: 'null item with shoes filter', item: null, cat: 'shoes', expected: false },
  { name: 'null category with unassigned filter', item: { category: null }, cat: 'unassigned', expected: true },
  { name: 'topcoat with top filter', item: { category: 'topcoat' }, cat: 'top', expected: false },
  { name: 'topcoat with outerwear filter', item: { category: 'topcoat' }, cat: 'outerwear', expected: true },
];

let catPassed = 0;
categoryTests.forEach((tc) => {
  const result = matchesCategory(tc.item, tc.cat);
  assert.strictEqual(result, tc.expected, `FAILED: ${tc.name} -> expected ${tc.expected}, got ${result}`);
  console.log(`✓ matchesCategory: ${tc.name} -> ${result}`);
  catPassed++;
});

console.log(`\nAll ${catPassed}/${categoryTests.length} matchesCategory tests passed!\n`);

const searchTests = [
  { name: 'multi-word search', item: { title: 'Oxford Shirt', brand: 'Zara', color: 'Blue' }, q: 'blue zara shirt', expected: true },
  { name: 'colors array search', item: { title: 'Summer Shirt', colors: [{ name: 'Navy Blue' }] }, q: 'navy', expected: true },
  { name: 'fabric_materials array search', item: { title: 'Luxury Sweater', fabric_materials: [{ name: 'Cashmere' }] }, q: 'cashmere', expected: true },
  { name: 'season array search', item: { title: 'Heavy Coat', season: ['Winter', 'Autumn'] }, q: 'winter', expected: true },
  { name: 'tag object search', item: { title: 'Denim', tags: [{ name: 'vintage' }] }, q: 'vintage', expected: true },
  { name: 'tag object does not match [object Object]', item: { title: 'Denim', tags: [{ name: 'vintage' }] }, q: 'object', expected: false },
  { name: 'comma separated tags string', item: { title: 'Jacket', tags: 'casual, street, cool' }, q: 'street', expected: true },
  { name: 'empty query returns true', item: { title: 'Item' }, q: '', expected: true },
  { name: 'null item returns false', item: null, q: 'test', expected: false },
  { name: 'pattern search', item: { title: 'Dress', pattern: 'Floral' }, q: 'floral', expected: true },
  { name: 'attributes object search', item: { title: 'Pants', attributes: { fit: 'Slim', style: 'Chino' } }, q: 'chino', expected: true },
];

let searchPassed = 0;
searchTests.forEach((tc) => {
  const result = matchesSearch(tc.item, tc.q);
  assert.strictEqual(result, tc.expected, `FAILED: ${tc.name} -> expected ${tc.expected}, got ${result}`);
  console.log(`✓ matchesSearch: ${tc.name} -> ${result}`);
  searchPassed++;
});

console.log(`\nAll ${searchPassed}/${searchTests.length} matchesSearch tests passed!\n`);
console.log('ALL TESTS PASSED SUCCESSFULLY (Exit Code 0).');
