// Empirical audit test for ClosetScreen logic
import assert from 'node:assert';

const CATEGORY_SYNONYMS = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'polo'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'leggings'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench'],
  shoes: ['shoes', 'footwear', 'sneakers', 'boots', 'sandals', 'heels', 'loafers', 'flats', 'slippers'],
  accessory: ['accessory', 'accessories', 'bag', 'handbag', 'hat', 'belt', 'scarf', 'jewelry', 'glasses', 'sunglasses', 'watch'],
  dress: ['dress', 'dresses', 'full body', 'full_body', 'jumpsuit', 'romper', 'gown', 'suit'],
};

// Current implementation in ClosetScreen.tsx
function currentMatchesCategory(item, selectedCategory) {
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

// Proposed fixed implementation
function fixedMatchesCategory(item, selectedCategory) {
  if (!selectedCategory || selectedCategory === 'all') return true;

  const rawCat = (item.category || '').toLowerCase().trim();
  const rawSub = (item.sub_category || '').toLowerCase().trim();
  const rawItemType = (item.item_type || '').toLowerCase().trim();

  const synonyms = CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase()];

  return synonyms.some((syn) => {
    const synLower = syn.toLowerCase().trim();
    return (
      (rawCat.length > 0 && (rawCat === synLower || rawCat.includes(synLower) || synLower.includes(rawCat))) ||
      (rawSub.length > 0 && (rawSub === synLower || rawSub.includes(synLower) || synLower.includes(rawSub))) ||
      (rawItemType.length > 0 && (rawItemType === synLower || rawItemType.includes(synLower) || synLower.includes(rawItemType)))
    );
  });
}

// Current matchesSearch
function currentMatchesSearch(item, query) {
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

// Proposed enhanced matchesSearch with full nullish safety across tags, colors array, attributes
function robustMatchesSearch(item, query) {
  if (!query || !query.trim()) return true;
  if (!item) return false;

  const needle = query.trim().toLowerCase();

  const tagStrings = Array.isArray(item.tags)
    ? item.tags.map((t) => (typeof t === 'string' ? t : (t && t.name) || (t && t.tag) || '')).filter(Boolean)
    : typeof item.tags === 'string'
    ? item.tags.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const colorStrings = [
    typeof item.color === 'string' ? item.color : '',
    ...(Array.isArray(item.colors)
      ? item.colors.map((c) => (typeof c === 'string' ? c : (c && c.name) || '')).filter(Boolean)
      : []),
  ].filter(Boolean);

  const attrStrings = [];
  if (item.attributes && typeof item.attributes === 'object') {
    Object.values(item.attributes).forEach((val) => {
      if (typeof val === 'string') attrStrings.push(val);
      else if (Array.isArray(val)) val.forEach((v) => typeof v === 'string' && attrStrings.push(v));
    });
  }

  const seasonStrings = Array.isArray(item.season)
    ? item.season.filter((s) => typeof s === 'string')
    : typeof item.season === 'string'
    ? [item.season]
    : [];

  const haystack = [
    typeof item.title === 'string' ? item.title : '',
    typeof item.name === 'string' ? item.name : '',
    typeof item.category === 'string' ? item.category : '',
    typeof item.sub_category === 'string' ? item.sub_category : '',
    typeof item.item_type === 'string' ? item.item_type : '',
    typeof item.brand === 'string' ? item.brand : '',
    typeof item.material === 'string' ? item.material : '',
    typeof item.pattern === 'string' ? item.pattern : '',
    typeof item.dress_code === 'string' ? item.dress_code : '',
    ...colorStrings,
    ...tagStrings,
    ...seasonStrings,
    ...attrStrings,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

console.log('--- TEST RUN ---');

// Test 1: Category Filtering on Null / Undefined / Empty
const itemNoCategory = { id: '1', title: 'Mystery Coat', category: null };
const itemEmptyCat = { id: '2', title: 'Empty Cat Item', category: '' };
const itemTops = { id: '3', title: 'Classic Oxford', category: 'top' };
const itemShoes = { id: '4', title: 'Running Sneakers', category: 'footwear' };

console.log('Current matchesCategory on null category for shoes:', currentMatchesCategory(itemNoCategory, 'shoes')); // true (BUG!)
console.log('Fixed matchesCategory on null category for shoes:', fixedMatchesCategory(itemNoCategory, 'shoes')); // false (CORRECT)
console.log('Fixed matchesCategory on tops for top:', fixedMatchesCategory(itemTops, 'top')); // true
console.log('Fixed matchesCategory on tops for shoes:', fixedMatchesCategory(itemTops, 'shoes')); // false
console.log('Fixed matchesCategory on shoes for shoes:', fixedMatchesCategory(itemShoes, 'shoes')); // true

// Test 2: Search with colors array, tag objects, and null values
const itemWithComplexData = {
  id: '5',
  title: null,
  name: 'Silk Blouse',
  category: 'top',
  color: null,
  colors: [{ name: 'Crimson', hex: '#DC143C' }, { name: 'Gold' }],
  tags: [{ name: 'formal' }, 'evening', 123],
  attributes: { pattern: 'striped', fit: 'relaxed' },
  season: ['autumn', 'spring'],
};

console.log('Robust search for Crimson:', robustMatchesSearch(itemWithComplexData, 'crimson')); // true
console.log('Robust search for Formal:', robustMatchesSearch(itemWithComplexData, 'formal')); // true
console.log('Robust search for Striped:', robustMatchesSearch(itemWithComplexData, 'striped')); // true
console.log('Robust search for Autumn:', robustMatchesSearch(itemWithComplexData, 'autumn')); // true
console.log('Robust search for Nonexistent:', robustMatchesSearch(itemWithComplexData, 'denim')); // false

console.log('--- ALL CHECKS EVALUATED ---');
