const CATEGORY_SYNONYMS = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'polo', 'crop top', 'cardigan'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'leggings', 'joggers'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench', 'windbreaker', 'overcoat', 'topcoat'],
  shoes: ['shoes', 'shoe', 'footwear', 'sneakers', 'boots', 'sandals', 'heels', 'loafers', 'flats', 'slippers', 'pumps', 'clogs'],
  accessory: ['accessory', 'accessories', 'bag', 'handbag', 'hat', 'belt', 'scarf', 'jewelry', 'glasses', 'sunglasses', 'watch', 'cap', 'beanie'],
  dress: ['dress', 'dresses', 'full body', 'full_body', 'jumpsuit', 'romper', 'gown', 'suit', 'overall', 'overalls'],
};

function fixedMatchesCategory(item, selectedCategory) {
  if (!item) return false;
  if (!selectedCategory || selectedCategory === 'all') return true;

  const rawCat = (item.category || '').toLowerCase().trim();
  const rawSub = (item.sub_category || '').toLowerCase().trim();
  const rawItemType = (item.item_type || '').toLowerCase().trim();

  // Guard: If item has no category taxonomy at all, only match 'all' (or explicit 'unassigned'/'other')
  if (!rawCat && !rawSub && !rawItemType) {
    return selectedCategory === 'unassigned' || selectedCategory === 'other';
  }

  const synonyms = CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase().trim()];

  const checkMatch = (val) => {
    if (!val) return false;
    // Exact match against synonym
    if (synonyms.includes(val)) return true;

    // Tokenized word-level match and multi-word phrase check
    const tokens = val.split(/[\s,/\\-_]+/).filter(Boolean);
    return synonyms.some((syn) => {
      const s = syn.toLowerCase().trim();
      if (!s) return false;
      if (val === s) return true;
      if (tokens.includes(s)) return true;
      // For multi-word synonyms like 'full body', 'tank top', check substring inclusion in normalized phrase
      if (s.includes(' ') && val.includes(s)) return true;
      return false;
    });
  };

  return checkMatch(rawCat) || checkMatch(rawSub) || checkMatch(rawItemType);
}

const advancedTests = [
  { item: { category: 'topcoat' }, cat: 'outerwear', expected: true, desc: 'topcoat -> outerwear' },
  { item: { category: 'topcoat' }, cat: 'top', expected: false, desc: 'topcoat -> top (should not match top without boundary)' },
  { item: { category: 'short dress' }, cat: 'dress', expected: true, desc: 'short dress -> dress' },
  { item: { category: 'tank top' }, cat: 'top', expected: true, desc: 'tank top -> top' },
  { item: { category: 'Crop Top' }, cat: 'top', expected: true, desc: 'Crop Top -> top' },
  { item: { category: 't-shirt' }, cat: 'top', expected: true, desc: 't-shirt -> top' },
  { item: { category: 't_shirt' }, cat: 'top', expected: true, desc: 't_shirt -> top' },
  { item: { category: 'full_body' }, cat: 'dress', expected: true, desc: 'full_body -> dress' },
  { item: { category: 'full body' }, cat: 'dress', expected: true, desc: 'full body -> dress' },
  { item: { category: 'running shoes' }, cat: 'shoes', expected: true, desc: 'running shoes -> shoes' },
  { item: { category: 'winter jacket' }, cat: 'outerwear', expected: true, desc: 'winter jacket -> outerwear' },
  { item: { category: 'leather belt' }, cat: 'accessory', expected: true, desc: 'leather belt -> accessory' },
  { item: { category: 'casual pants' }, cat: 'bottom', expected: true, desc: 'casual pants -> bottom' },
  { item: { category: null }, cat: 'shoes', expected: false, desc: 'null category -> shoes' },
  { item: { category: undefined }, cat: 'top', expected: false, desc: 'undefined category -> top' },
  { item: { category: '' }, cat: 'bottom', expected: false, desc: 'empty string category -> bottom' },
  { item: { category: null }, cat: 'all', expected: true, desc: 'null category -> all' },
];

console.log('=== ADVANCED TAXONOMY TESTS ===');
let passCount = 0;
advancedTests.forEach((tc, idx) => {
  const res = fixedMatchesCategory(tc.item, tc.cat);
  const pass = res === tc.expected;
  if (pass) passCount++;
  console.log(`Test #${idx + 1} [${tc.desc}]: Got ${res} (Expected: ${tc.expected}) -> ${pass ? 'PASS' : 'FAIL'}`);
});
console.log(`\nAdvanced Summary: ${passCount}/${advancedTests.length} tests passed.`);
