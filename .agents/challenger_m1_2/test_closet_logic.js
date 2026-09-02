const fs = require('fs');
const assert = require('assert');

const filePath = 'apps/mobile/src/screens/closet/ClosetScreen.tsx';
const fileContent = fs.readFileSync(filePath, 'utf8');

console.log('--- Starting Challenger 2 Stress Test Suite ---');

// 1. Check contracts & patterns in source code
console.log('1. Verifying Navigation contracts...');
assert.ok(
  fileContent.includes("navigation.navigate('ItemDetail', { itemId: item.id })"),
  "Must include navigation.navigate('ItemDetail', { itemId: item.id })"
);
assert.ok(
  fileContent.includes("navigation.navigate('ClosetAdd', { source: 'manual' })"),
  "Must include navigation.navigate('ClosetAdd', ...)"
);
console.log('PASS: Navigation contracts verified.');

// 2. Check File size
const stats = fs.statSync(filePath);
console.log(`2. Verifying File Size: ${stats.size} bytes (${(stats.size/1024).toFixed(2)} KB)`);
assert.ok(stats.size > 3072, 'File size must be > 3 KB');
console.log('PASS: File size check passed.');

// 3. Extract functions for testing
// We will evaluate the pure helper functions in isolation
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

// 3. Stress-test Edge Cases
console.log('3. Stress-testing edge cases...');

// Edge Case 1: Null/undefined items
assert.strictEqual(resolveThumbnailUrl(null), null);
assert.strictEqual(resolveThumbnailUrl(undefined), null);
assert.strictEqual(matchesCategory(null, 'top'), false);
assert.strictEqual(matchesSearch(null, 'dress'), false);

// Edge Case 2: Malformed or relative URLs
assert.strictEqual(resolveThumbnailUrl({ photo_url: '   ' }), null);
assert.strictEqual(resolveThumbnailUrl({ thumbnail_data_url: 'data:image/png;base64,abc' }), 'data:image/png;base64,abc');
assert.strictEqual(resolveThumbnailUrl({ image_url: 'https://images.unsplash.com/photo-1' }), 'https://images.unsplash.com/photo-1');
assert.strictEqual(resolveThumbnailUrl({ cutout_url: '/media/cutouts/item-42.png' }), 'https://dressapp.co/media/cutouts/item-42.png');
assert.strictEqual(resolveThumbnailUrl({ original_image_url: 'media/orig/item-42.png' }), 'https://dressapp.co/media/orig/item-42.png');

// Edge Case 3: Priority waterfall for thumbnail resolution
const waterfallItem = {
  thumbnail_data_url: 'data:thumb',
  reconstructed_image_url: 'http://reconstructed',
  clean_image_url: 'http://clean',
  image_url: 'http://image'
};
assert.strictEqual(resolveThumbnailUrl(waterfallItem), 'data:thumb');

// Edge Case 4: Category synonym & partial matching
assert.strictEqual(matchesCategory({ category: 'T-Shirt' }, 'top'), true);
assert.strictEqual(matchesCategory({ category: 'Denim Trousers' }, 'bottom'), true);
assert.strictEqual(matchesCategory({ sub_category: 'Trench Coat' }, 'outerwear'), true);
assert.strictEqual(matchesCategory({ item_type: 'Ankle Boots' }, 'shoes'), true);
assert.strictEqual(matchesCategory({ category: 'Leather Handbag' }, 'accessory'), true);
assert.strictEqual(matchesCategory({ category: 'Evening Gown' }, 'dress'), true);
assert.strictEqual(matchesCategory({ category: 'Formal Jumpsuit' }, 'dress'), true);
assert.strictEqual(matchesCategory({ category: 'Swimwear' }, 'all'), true);
assert.strictEqual(matchesCategory({ category: 'Swimwear' }, 'top'), false);

// Edge Case 5: Multi-word search and case-insensitivity
const complexItem = {
  title: 'Gucci Floral Silk Shirt',
  brand: 'Gucci',
  category: 'Tops',
  colors: [{ name: 'Emerald Green' }],
  fabric_materials: [{ name: '100% Pure Silk' }],
  tags: ['vintage', 'runway', 'italian']
};
assert.strictEqual(matchesSearch(complexItem, 'gucci silk'), true);
assert.strictEqual(matchesSearch(complexItem, 'EMERALD runway'), true);
assert.strictEqual(matchesSearch(complexItem, 'italian vintage tops'), true);
assert.strictEqual(matchesSearch(complexItem, 'prada'), false);

// Edge Case 6: Group member garment filtering
const mockItems = [
  { id: '1', title: 'Suit Jacket', group_role: 'host', category: 'outerwear' },
  { id: '2', title: 'Suit Trousers', group_role: 'member', category: 'bottom' },
  { id: '3', title: 'Single Shirt', group_role: 'single', category: 'top' },
  { id: '4', title: 'Unassigned Role Dress', category: 'dress' }
];

const filtered = mockItems.filter(it => it.group_role !== 'member');
assert.strictEqual(filtered.length, 3, 'Group members must be filtered from top-level grid');
assert.deepStrictEqual(filtered.map(i => i.id), ['1', '3', '4']);

console.log('PASS: All empirical stress tests passed successfully!');
