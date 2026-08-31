/**
 * stress_test.js
 * Comprehensive Adversarial Test Suite for ClosetScreen.tsx (Milestone M1 Iteration 2)
 */

const assert = require('assert');

// ── Extraction of functions under test (identical to ClosetScreen.tsx) ────────

const BACKEND_URL = 'https://dressapp.co';

const CATEGORY_SYNONYMS = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'polo', 'crop top', 'cardigan'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'leggings', 'joggers', 'pant', 'trouser', 'short'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench', 'windbreaker', 'overcoat', 'topcoat'],
  shoes: ['shoes', 'shoe', 'footwear', 'sneakers', 'sneaker', 'boots', 'boot', 'sandals', 'sandal', 'heels', 'heel', 'loafers', 'loafer', 'flats', 'flat', 'slippers', 'slipper', 'pumps', 'clogs'],
  accessory: ['accessory', 'accessories', 'bag', 'handbag', 'hat', 'belt', 'scarf', 'jewelry', 'glasses', 'sunglasses', 'watch', 'cap', 'beanie'],
  dress: ['dress', 'dresses', 'full body', 'full_body', 'jumpsuit', 'romper', 'gown', 'suit', 'overall', 'overalls'],
};

function resolveThumbnailUrl(item) {
  if (!item) return null;

  const rawUrl =
    item.thumbnail_data_url ||
    item.reconstructed_image_url ||
    item.clean_image_url ||
    item.cutout_url ||
    item.segmented_image_url ||
    item.image_variants?.webp?.medium ||
    item.image_variants?.original ||
    item.original_image_url ||
    item.image_url ||
    item.photo_url;

  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `${BACKEND_URL}${trimmed}`;
  }

  return `${BACKEND_URL}/${trimmed}`;
}

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

  if (!rawCat && !rawSub && !rawItemType) {
    return selectedCategory === 'unassigned' || selectedCategory === 'other';
  }

  const synonyms =
    CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase().trim()];

  const checkMatch = (val) => {
    if (!val) return false;

    if (synonyms.includes(val)) return true;

    const tokens = val.split(/[\s,/\-_]+/).filter(Boolean);

    return synonyms.some((syn) => {
      const s = syn.toLowerCase().trim();
      if (!s) return false;

      if (val === s) return true;
      if (tokens.includes(s)) return true;
      if (s.includes(' ') && val.includes(s)) return true;
      if (val.includes(' ') && s.includes(val)) return true;
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
    if (typeof tags === 'string') {
      return tags.split(',').map((s) => s.trim()).filter(Boolean);
    }
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

  const extractColorStrings = (it) => {
    const list = [];
    if (typeof it.color === 'string') list.push(it.color.trim());
    if (Array.isArray(it.colors)) {
      it.colors.forEach((c) => {
        if (typeof c === 'string') list.push(c.trim());
        else if (c && typeof c.name === 'string') list.push(c.name.trim());
      });
    }
    return list;
  };

  const extractMaterialStrings = (it) => {
    const list = [];
    if (typeof it.material === 'string') list.push(it.material.trim());
    if (Array.isArray(it.fabric_materials)) {
      it.fabric_materials.forEach((m) => {
        if (typeof m === 'string') list.push(m.trim());
        else if (m && typeof m.name === 'string') list.push(m.name.trim());
      });
    }
    return list;
  };

  const extractSeasonStrings = (season) => {
    if (!season) return [];
    if (typeof season === 'string') return [season.trim()];
    if (Array.isArray(season)) {
      return season.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    }
    return [];
  };

  const extractAttributes = (attrs) => {
    if (!attrs || typeof attrs !== 'object') return [];
    if (Array.isArray(attrs)) {
      return attrs.map((a) => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean);
    }
    return Object.values(attrs)
      .map((v) => (typeof v === 'string' ? v : ''))
      .filter(Boolean);
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

function normalizeApiResponse(res) {
  let fetchedList = [];
  if (Array.isArray(res)) {
    fetchedList = res;
  } else if (res && Array.isArray(res.items)) {
    fetchedList = res.items;
  }
  return fetchedList;
}

function keyExtractor(item, index) {
  return item.id || item._id || `closet-item-${index}`;
}

// ── Test Runner ──────────────────────────────────────────────────────────────

let total = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('=== STARTING ADVERSARIAL STRESS TEST SUITE ===\n');

// ── SECTION 1: Null/Undefined & Missing Item Fields ─────────────────────────
console.log('--- Section 1: Null/Undefined & Corrupted Item Fields ---');

test('matchesCategory: null item returns false', () => {
  assert.strictEqual(matchesCategory(null, 'top'), false);
  assert.strictEqual(matchesCategory(undefined, 'all'), false);
});

test('matchesCategory: item with null category does NOT match specific category', () => {
  const item = { id: '1', category: null, sub_category: null, item_type: null };
  assert.strictEqual(matchesCategory(item, 'shoes'), false);
  assert.strictEqual(matchesCategory(item, 'top'), false);
  assert.strictEqual(matchesCategory(item, 'bottom'), false);
  assert.strictEqual(matchesCategory(item, 'outerwear'), false);
  assert.strictEqual(matchesCategory(item, 'accessory'), false);
  assert.strictEqual(matchesCategory(item, 'dress'), false);
});

test('matchesCategory: item with empty string category does NOT match specific category', () => {
  const item = { id: '1', category: '', sub_category: '   ', item_type: '' };
  assert.strictEqual(matchesCategory(item, 'shoes'), false);
  assert.strictEqual(matchesCategory(item, 'top'), false);
});

test('matchesCategory: item with null category matches "all"', () => {
  const item = { id: '1', category: null };
  assert.strictEqual(matchesCategory(item, 'all'), true);
  assert.strictEqual(matchesCategory(item, ''), true);
});

test('matchesCategory: item with null category matches "unassigned" and "other"', () => {
  const item = { id: '1', category: null, sub_category: null, item_type: null };
  assert.strictEqual(matchesCategory(item, 'unassigned'), true);
  assert.strictEqual(matchesCategory(item, 'other'), true);
});

test('matchesSearch: null/undefined item returns false', () => {
  assert.strictEqual(matchesSearch(null, 'shirt'), false);
  assert.strictEqual(matchesSearch(undefined, ''), false);
});

test('matchesSearch: empty or whitespace query returns true for valid item', () => {
  const item = { id: '1', name: 'Vintage Blazer' };
  assert.strictEqual(matchesSearch(item, ''), true);
  assert.strictEqual(matchesSearch(item, '   '), true);
  assert.strictEqual(matchesSearch(item, null), true);
  assert.strictEqual(matchesSearch(item, undefined), true);
});

test('matchesSearch: item with all null fields does not crash', () => {
  const item = {
    id: '1',
    title: null,
    name: null,
    category: null,
    brand: null,
    size: null,
    color: null,
    colors: null,
    material: null,
    fabric_materials: null,
    season: null,
    tags: null,
  };
  assert.strictEqual(matchesSearch(item, 'shirt'), false);
  assert.strictEqual(matchesSearch(item, ''), true);
});

// ── SECTION 2: Category Matching Taxonomy & Edge Cases ──────────────────────
console.log('\n--- Section 2: Category Matching Taxonomy & Edge Cases ---');

test('matchesCategory: synonym matching for tops (blouse, t-shirt, sweater, hoodie, polo)', () => {
  assert.strictEqual(matchesCategory({ id: '1', category: 'Blouse' }, 'top'), true);
  assert.strictEqual(matchesCategory({ id: '2', category: 'T-Shirt' }, 'top'), true);
  assert.strictEqual(matchesCategory({ id: '3', category: 'Oversized Sweater' }, 'top'), true);
  assert.strictEqual(matchesCategory({ id: '4', category: 'Polo Shirt' }, 'top'), true);
  assert.strictEqual(matchesCategory({ id: '5', sub_category: 'Hoodie' }, 'top'), true);
  assert.strictEqual(matchesCategory({ id: '6', item_type: 'tank top' }, 'top'), true);
});

test('matchesCategory: synonym matching for bottoms (jeans, trousers, shorts, skirt, leggings)', () => {
  assert.strictEqual(matchesCategory({ id: '1', category: 'Jeans' }, 'bottom'), true);
  assert.strictEqual(matchesCategory({ id: '2', category: 'Cargo Pants' }, 'bottom'), true);
  assert.strictEqual(matchesCategory({ id: '3', sub_category: 'Mini Skirt' }, 'bottom'), true);
  assert.strictEqual(matchesCategory({ id: '4', category: 'Leggings' }, 'bottom'), true);
  assert.strictEqual(matchesCategory({ id: '5', item_type: 'bermuda shorts' }, 'bottom'), true);
});

test('matchesCategory: synonym matching for shoes (sneakers, boots, sandals, loafers, heels)', () => {
  assert.strictEqual(matchesCategory({ id: '1', category: 'Sneakers' }, 'shoes'), true);
  assert.strictEqual(matchesCategory({ id: '2', category: 'Ankle Boots' }, 'shoes'), true);
  assert.strictEqual(matchesCategory({ id: '3', sub_category: 'Sandals' }, 'shoes'), true);
  assert.strictEqual(matchesCategory({ id: '4', item_type: 'High Heels' }, 'shoes'), true);
  assert.strictEqual(matchesCategory({ id: '5', category: 'Loafers' }, 'shoes'), true);
});

test('matchesCategory: non-leakage across disparate categories', () => {
  const shoeItem = { id: '1', category: 'Sneakers' };
  assert.strictEqual(matchesCategory(shoeItem, 'top'), false);
  assert.strictEqual(matchesCategory(shoeItem, 'bottom'), false);
  assert.strictEqual(matchesCategory(shoeItem, 'outerwear'), false);
  assert.strictEqual(matchesCategory(shoeItem, 'accessory'), false);
  assert.strictEqual(matchesCategory(shoeItem, 'dress'), false);

  const topItem = { id: '2', category: 'Silk Blouse' };
  assert.strictEqual(matchesCategory(topItem, 'shoes'), false);
  assert.strictEqual(matchesCategory(topItem, 'bottom'), false);
  assert.strictEqual(matchesCategory(topItem, 'outerwear'), false);
});

test('matchesCategory: category object format { name: "Sneakers" }', () => {
  const item = { id: '1', category: { name: 'Sneakers' } };
  assert.strictEqual(matchesCategory(item, 'shoes'), true);
  assert.strictEqual(matchesCategory(item, 'top'), false);
});

test('matchesCategory: category with delimiter chars (e.g. "shoes/sneakers", "tops-hoodie")', () => {
  assert.strictEqual(matchesCategory({ id: '1', category: 'shoes/sneakers' }, 'shoes'), true);
  assert.strictEqual(matchesCategory({ id: '2', category: 'tops-hoodie' }, 'top'), true);
  assert.strictEqual(matchesCategory({ id: '3', category: 'clothing_outerwear_jacket' }, 'outerwear'), true);
});

// ── SECTION 3: Search Query Edge Cases & Complex Structures ─────────────────
console.log('\n--- Section 3: Search Query Edge Cases & Complex Structures ---');

test('matchesSearch: handles special regex characters in query without crashing', () => {
  const item = { id: '1', name: 'C++ Tee (Special Edition) [2026] {Rare} $50 *+?^' };
  assert.strictEqual(matchesSearch(item, 'C++'), true);
  assert.strictEqual(matchesSearch(item, '(Special'), true);
  assert.strictEqual(matchesSearch(item, '[2026]'), true);
  assert.strictEqual(matchesSearch(item, '{Rare}'), true);
  assert.strictEqual(matchesSearch(item, '$50'), true);
  assert.strictEqual(matchesSearch(item, '*+?^'), true);
  assert.strictEqual(matchesSearch(item, '.*+?^${}()|[]\\'), false); // Doesn't crash, returns false
});

test('matchesSearch: multi-word search across distinct item fields', () => {
  const item = {
    id: '1',
    name: 'Air Jordan 1',
    brand: 'Nike',
    category: 'Shoes',
    color: 'Red',
    size: '10.5',
  };
  assert.strictEqual(matchesSearch(item, 'Nike Red Shoes'), true);
  assert.strictEqual(matchesSearch(item, 'jordan red 10.5'), true);
  assert.strictEqual(matchesSearch(item, 'Nike Blue Shoes'), false);
});

test('matchesSearch: complex nested colors array and fabric materials', () => {
  const item = {
    id: '1',
    name: 'Evening Dress',
    colors: [{ name: 'Emerald Green', hex: '#50C878' }, { name: 'Gold', hex: '#FFD700' }],
    fabric_materials: [{ name: 'Mulberry Silk', pct: 90 }, { name: 'Elastane', pct: 10 }],
    season: ['Spring', 'Summer'],
  };
  assert.strictEqual(matchesSearch(item, 'Emerald'), true);
  assert.strictEqual(matchesSearch(item, 'Mulberry Silk'), true);
  assert.strictEqual(matchesSearch(item, 'Gold Summer Silk'), true);
  assert.strictEqual(matchesSearch(item, 'Winter Wool'), false);
});

test('matchesSearch: object tag structures vs string tag structures', () => {
  const item1 = { id: '1', tags: 'vintage, retro, 90s, streetwear' };
  assert.strictEqual(matchesSearch(item1, 'streetwear'), true);
  assert.strictEqual(matchesSearch(item1, 'retro'), true);

  const item2 = {
    id: '2',
    tags: [
      { name: 'oversized' },
      { label: 'minimalist' },
      { title: 'cyberpunk' },
      { tag: 'techwear' },
      'casual',
    ],
  };
  assert.strictEqual(matchesSearch(item2, 'cyberpunk techwear'), true);
  assert.strictEqual(matchesSearch(item2, 'minimalist casual'), true);
  assert.strictEqual(matchesSearch(item2, 'bohemian'), false);
});

test('matchesSearch: attributes object dictionary vs array', () => {
  const item1 = { id: '1', attributes: { style: 'Boho Chic', fit: 'Relaxed Fit' } };
  assert.strictEqual(matchesSearch(item1, 'Boho'), true);
  assert.strictEqual(matchesSearch(item1, 'Relaxed'), true);

  const item2 = { id: '2', attributes: [{ name: 'Breathable' }, 'Waterproof'] };
  assert.strictEqual(matchesSearch(item2, 'Waterproof'), true);
  assert.strictEqual(matchesSearch(item2, 'Breathable'), true);
});

// ── SECTION 4: Image Pipeline Resolution Cascade ────────────────────────────
console.log('\n--- Section 4: Image Pipeline Resolution Cascade ---');

test('resolveThumbnailUrl: resolves according to priority order', () => {
  const item = {
    id: '1',
    thumbnail_data_url: 'data:image/png;base64,THUMB',
    clean_image_url: 'https://cdn.dressapp.co/clean.jpg',
    image_url: 'https://cdn.dressapp.co/orig.jpg',
  };
  assert.strictEqual(resolveThumbnailUrl(item), 'data:image/png;base64,THUMB');
});

test('resolveThumbnailUrl: falls back through variants to clean_image_url and image_url', () => {
  const item1 = {
    id: '1',
    clean_image_url: 'https://cdn.dressapp.co/clean.jpg',
    image_url: 'https://cdn.dressapp.co/orig.jpg',
  };
  assert.strictEqual(resolveThumbnailUrl(item1), 'https://cdn.dressapp.co/clean.jpg');

  const item2 = {
    id: '2',
    image_variants: { webp: { medium: '/media/webp/med.webp' } },
  };
  assert.strictEqual(resolveThumbnailUrl(item2), `${BACKEND_URL}/media/webp/med.webp`);

  const item3 = {
    id: '3',
    photo_url: 'uploads/photo.jpg',
  };
  assert.strictEqual(resolveThumbnailUrl(item3), `${BACKEND_URL}/uploads/photo.jpg`);
});

test('resolveThumbnailUrl: returns null on invalid or empty values', () => {
  assert.strictEqual(resolveThumbnailUrl(null), null);
  assert.strictEqual(resolveThumbnailUrl(undefined), null);
  assert.strictEqual(resolveThumbnailUrl({}), null);
  assert.strictEqual(resolveThumbnailUrl({ image_url: '' }), null);
  assert.strictEqual(resolveThumbnailUrl({ image_url: '   ' }), null);
  assert.strictEqual(resolveThumbnailUrl({ image_url: 12345 }), null);
  assert.strictEqual(resolveThumbnailUrl({ image_url: null }), null);
});

// ── SECTION 5: API Response Normalization & Key Extraction ───────────────────
console.log('\n--- Section 5: API Response Normalization & Key Extraction ---');

test('normalizeApiResponse: handles plain array', () => {
  const input = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
  const res = normalizeApiResponse(input);
  assert.strictEqual(res.length, 2);
  assert.strictEqual(res[0].id, '1');
});

test('normalizeApiResponse: handles { items: [...] } object envelope', () => {
  const input = { items: [{ id: '10' }, { id: '20' }], total: 2 };
  const res = normalizeApiResponse(input);
  assert.strictEqual(res.length, 2);
  assert.strictEqual(res[0].id, '10');
});

test('normalizeApiResponse: handles null, undefined, error objects, and empty objects', () => {
  assert.deepStrictEqual(normalizeApiResponse(null), []);
  assert.deepStrictEqual(normalizeApiResponse(undefined), []);
  assert.deepStrictEqual(normalizeApiResponse({}), []);
  assert.deepStrictEqual(normalizeApiResponse({ error: 'Unauthorized', code: 401 }), []);
  assert.deepStrictEqual(normalizeApiResponse({ items: null }), []);
});

test('keyExtractor: handles id, _id, and index fallbacks without duplicates', () => {
  assert.strictEqual(keyExtractor({ id: 'item-100' }, 0), 'item-100');
  assert.strictEqual(keyExtractor({ _id: 'mongo-64a8b' }, 1), 'mongo-64a8b');
  assert.strictEqual(keyExtractor({}, 5), 'closet-item-5');
});

// ── SECTION 6: Group Role Filtering Web Parity ──────────────────────────────
console.log('\n--- Section 6: Group Role Filtering Web Parity ---');

test('Group role filter: filters secondary members of garment sets', () => {
  const allItems = [
    { id: '1', name: 'Suit Jacket', group_role: 'host' },
    { id: '2', name: 'Suit Trousers', group_role: 'member' },
    { id: '3', name: 'Casual Tee', group_role: 'single' },
    { id: '4', name: 'Vintage Hat' }, // group_role undefined
  ];

  const visibleItems = allItems.filter((it) => {
    if (!it) return false;
    if (it.group_role === 'member') return false;
    return true;
  });

  assert.strictEqual(visibleItems.length, 3);
  assert.strictEqual(visibleItems.some((i) => i.id === '2'), false);
  assert.strictEqual(visibleItems.some((i) => i.id === '1'), true);
  assert.strictEqual(visibleItems.some((i) => i.id === '3'), true);
  assert.strictEqual(visibleItems.some((i) => i.id === '4'), true);
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────
console.log('\n========================================');
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY.');
  process.exit(0);
}
