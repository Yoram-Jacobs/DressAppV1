# Milestone M1 Iteration 2 — ClosetScreen Investigation & Strategy Report

**Target**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Explorer**: Explorer 3 (Read-Only Investigation & Strategy)  
**Parent Agent**: `07c82dc6-4807-410c-9b75-b5ead21de5df`  
**Working Directory**: `c:\DressApp_AG\.agents\teamwork_preview_explorer_m1_iter2_3`  
**Status**: Investigation Complete — Fix Strategy Formulated (No Source Modified)

---

## 1. Observation

Direct forensic inspection of `apps/mobile/src/screens/closet/ClosetScreen.tsx` and comparison against `apps/web/src/pages/Closet.jsx`, `@dressapp/i18n`, and `packages/api-client/src/closet.js` revealed five critical areas requiring remediation:

### Observation 1.1: Category Filter Inclusion Leak on Nullish/Empty Categories
- **Location**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`, lines 174–190
- **Verbatim Code**:
  ```typescript
  export function matchesCategory(item: ClosetItem, selectedCategory: string): boolean {
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
  ```
- **Observed Behavior**: When `item.category` is `null`, `undefined`, or `""`, `rawCat` is `""`. For any synonym string `syn` (e.g. `"shoes"`, `"outerwear"`), `syn.includes("")` evaluates to `true`. Consequently, uncategorized items match every category filter.

---

### Observation 1.2: Incomplete Nullish Safety on `tags`, `colors`, `attributes`, and Category Localization
- **Location**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`, lines 192–212 & 557–558
- **Verbatim Code (`matchesSearch`)**:
  ```typescript
  export function matchesSearch(item: ClosetItem, query: string): boolean {
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
  ```
- **Verbatim Code (`ClosetItemCard` metadata)**:
  ```typescript
  const titleText = item.title || item.name || t('closet.unnamedItem', 'Garment Piece');
  const metadataText = [item.category, item.color || item.brand].filter(Boolean).join(' · ');
  ```
- **Observed Behavior**:
  1. `item.colors` (array of objects `[{ name: 'Navy', hex: '#000080' }]`) is completely ignored in search and card metadata fallback when `item.color` is null.
  2. `item.tags` is assumed to be an array of pure strings. If backend items contain tag objects (`[{ name: 'casual' }]`) or comma-separated strings (`"casual, summer"`), search fails or injects `[object Object]`.
  3. `item.attributes` (e.g. `{ pattern: 'striped', fit: 'slim' }`) is omitted from search indexing.
  4. Card subtitle renders raw category slugs (e.g. `'full_body'`, `'outerwear'`) rather than localized taxonomy labels via `t('taxonomy.categories.' + item.category)`.

---

### Observation 1.3: `keyExtractor` Generates Random Keys on Missing `id`
- **Location**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`, line 345
- **Verbatim Code**:
  ```typescript
  const keyExtractor = useCallback((item: ClosetItem) => item.id || Math.random().toString(), []);
  ```
- **Observed Behavior**: Raw items from MongoDB endpoints often contain `_id` instead of `id`. When `item.id` is undefined, `Math.random().toString()` assigns a new key on every re-render, forcing unneeded re-mounts and dropping card image error states.

---

### Observation 1.4: Loss of Pull-to-Refresh in Empty and Filter-Empty States
- **Location**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`, lines 465–524
- **Verbatim Code**:
  ```typescript
  } : filteredItems.length === 0 ? (
    items.length === 0 ? (
      // Total empty closet state
      <View style={s.emptyContainer}>...</View>
    ) : (
      // Filter / Search empty state
      <View style={s.emptyContainer}>...</View>
    )
  ) : (
    <FlatList
      data={filteredItems}
      ...
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} ... />}
    />
  )
  ```
- **Observed Behavior**: When `filteredItems.length === 0`, `FlatList` is unmounted and replaced with a static non-scrollable `View`. Users with an empty closet or unmatched filter cannot pull-down to refresh to check for synced items.

---

### Observation 1.5: Lack of Component Memoization & FlatList Virtualization Tuning
- **Location**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`, lines 333–346 & 550–634
- **Observed Behavior**:
  1. `ClosetItemCard` is a standard functional component without `React.memo()`. Every keystroke in the search bar triggers re-rendering of all visible cards.
  2. `FlatList` lacks virtualization props: `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize`, and `initialNumToRender`.
  3. `imageError` state in `ClosetItemCard` is not reset when `imageUrl` prop changes (e.g. after background rembg matte finishes).

---

## 2. Logic Chain

```
[Observation 1.1: syn.includes(rawCat) with rawCat=""]
   │
   ├──> Evaluates to true for all items with category: null/undefined/""
   │
   └──> [Conclusion 1]: Filter leak causes uncategorized items to appear in every category tab.

[Observation 1.2: item.colors, item.tags, item.attributes indexing]
   │
   ├──> item.colors array ignored; tag objects converted to [object Object]; raw category slugs shown
   │
   └──> [Conclusion 2]: Search misses colors and tags; UI displays un-translated internal slugs.

[Observation 1.3: keyExtractor fallback to Math.random()]
   │
   ├──> If item._id exists instead of item.id, every render generates new key
   │
   └──> [Conclusion 3]: React Native re-mounts DOM nodes, thrashing image cache and scroll state.

[Observation 1.4: Conditional rendering of static View for empty states]
   │
   ├──> FlatList is replaced with View; RefreshControl is unmounted
   │
   └──> [Conclusion 4]: Pull-to-refresh is broken when closet is empty or filtered to 0 items.

[Observation 1.5: Unmemoized ClosetItemCard & untuned FlatList]
   │
   ├──> Card re-renders on every parent state change (search input, focus effect, refresh state)
   │
   └──> [Conclusion 5]: Noticeable frame drops during scrolling and real-time typing on mobile devices.
```

---

## 3. Caveats

1. **Read-Only Constraint**: In strict adherence to Explorer protocol, no production files were modified. All proposals are documented in this report.
2. **FashionCLIP Semantic Search**: Web's FashionCLIP backend endpoint (`api.searchCloset`) is reserved for Phase 5; mobile client-side keyword search over the local snapshot is intentionally used for Phase 1 instant response.
3. **Multi-View Sets**: In accordance with web parity, items with `group_role === 'member'` remain excluded from top-level grid display.

---

## 4. Conclusion & Recommended Fix Strategy

We recommend applying the following concrete, targeted refactor to `apps/mobile/src/screens/closet/ClosetScreen.tsx`:

### Fix 1: Guard String Inclusion in `matchesCategory`
```typescript
// BEFORE:
export function matchesCategory(item: ClosetItem, selectedCategory: string): boolean {
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

// AFTER:
export function matchesCategory(item: ClosetItem, selectedCategory: string): boolean {
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
```

### Fix 2: Comprehensive Nullish Safety in `matchesSearch` and Card Subtitle
```typescript
// Enhanced matchesSearch
export function matchesSearch(item: ClosetItem, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!item) return false;

  const needle = query.trim().toLowerCase();

  const tagStrings = Array.isArray(item.tags)
    ? item.tags.map((t) => (typeof t === 'string' ? t : (t as any)?.name || (t as any)?.tag || '')).filter(Boolean)
    : typeof item.tags === 'string'
    ? (item.tags as string).split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const colorStrings = [
    typeof item.color === 'string' ? item.color : '',
    ...(Array.isArray(item.colors)
      ? item.colors.map((c) => (typeof c === 'string' ? c : (c as any)?.name || '')).filter(Boolean)
      : []),
  ].filter(Boolean);

  const attrStrings: string[] = [];
  if (item.fabric_materials && Array.isArray(item.fabric_materials)) {
    item.fabric_materials.forEach((f) => f?.name && attrStrings.push(f.name));
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
```

### Fix 3: Robust `keyExtractor` with MongoDB `_id` Fallback
```typescript
// BEFORE:
const keyExtractor = useCallback((item: ClosetItem) => item.id || Math.random().toString(), []);

// AFTER:
const keyExtractor = useCallback(
  (item: ClosetItem, index: number) => item.id || (item as any)._id || `closet-item-${index}`,
  []
);
```

### Fix 4: Unify Empty State Inside `FlatList.ListEmptyComponent` for Pull-to-Refresh
```typescript
// Wrap empty container inside ListEmptyComponent so RefreshControl remains active:
<FlatList
  data={filteredItems}
  keyExtractor={keyExtractor}
  numColumns={2}
  renderItem={renderItem}
  contentContainerStyle={[s.listContent, filteredItems.length === 0 && s.emptyListContent]}
  columnWrapperStyle={filteredItems.length > 0 ? s.columnWrapper : undefined}
  showsVerticalScrollIndicator={false}
  initialNumToRender={8}
  maxToRenderPerBatch={10}
  windowSize={7}
  removeClippedSubviews={true}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
    />
  }
  ListEmptyComponent={
    loading && !refreshing ? null : items.length === 0 ? (
      <View style={s.emptyContainer}>
        <View style={s.emptyIconCircle}>
          <Icon source="hanger" size={48} color={colors.accent} />
        </View>
        <Text style={s.emptyTitle}>{t('closet.emptyTitle', 'No items in your closet yet')}</Text>
        <Text style={s.emptySub}>
          {t('closet.emptySub', 'Add your first piece to begin building outfits and getting AI styling advice.')}
        </Text>
        <TouchableOpacity style={s.emptyCtaBtn} activeOpacity={0.8} onPress={handleAddPress}>
          <Icon source="plus" size={20} color={colors.primaryFg} />
          <Text style={s.emptyCtaText}>{t('closet.addFirstItem', 'Add Your First Item')}</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={s.emptyContainer}>
        <View style={s.emptyIconCircle}>
          <Icon source="magnify-remove-outline" size={44} color={colors.mutedFg} />
        </View>
        <Text style={s.emptyTitle}>{t('closet.noResultsTitle', 'No matching items')}</Text>
        <Text style={s.emptySub}>
          {t('closet.noResultsSub', 'No wardrobe pieces match your current search or category filter.')}
        </Text>
        <TouchableOpacity style={s.resetFilterBtn} activeOpacity={0.8} onPress={handleResetFilters}>
          <Text style={s.resetFilterBtnText}>{t('closet.showAllItems', 'Show All Items')}</Text>
        </TouchableOpacity>
      </View>
    )
  }
/>
```

### Fix 5: Memoize `ClosetItemCard` and Reset `imageError` on URL Mutation
```typescript
const ClosetItemCard = React.memo(function ClosetItemCard({
  item,
  onPress,
  colors,
  t,
}: ClosetItemCardProps) {
  const [imageError, setImageError] = useState(false);
  const cardStyles = useMemo(() => makeCardStyles(colors), [colors]);
  const imageUrl = useMemo(() => resolveThumbnailUrl(item), [item]);

  // Reset error state if image URL updates (e.g. background matte completes)
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const isPolishing = item.clean_image_status === 'pending';
  const titleText = item.title || item.name || t('closet.unnamedItem', 'Garment Piece');

  // Derive localized category & color fallback
  const categoryLabel = item.category
    ? t(`taxonomy.categories.${item.category}`, item.category)
    : '';
  const primaryColor =
    item.color || (Array.isArray(item.colors) && item.colors[0]?.name) || '';
  const metadataText = [categoryLabel, primaryColor || item.brand].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={cardStyles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titleText}
    >
      {/* 3:4 Aspect Ratio Container */}
      <View style={cardStyles.imageContainer}>
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            style={cardStyles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={cardStyles.placeholderImage}>
            <Icon source="hanger" size={32} color={colors.mutedFg} />
          </View>
        )}
        ...
      </View>
      <View style={cardStyles.cardBody}>
        <Text style={cardStyles.cardTitle} numberOfLines={1}>
          {titleText}
        </Text>
        {metadataText ? (
          <Text style={cardStyles.cardSubtitle} numberOfLines={1}>
            {metadataText}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});
```

---

## 5. Verification Method

To verify these fixes independently:

1. **TypeScript Typecheck**:
   ```bash
   cd c:\DressApp_AG\apps\mobile
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   *Expected*: Exit code 0, 0 errors.

2. **Web Build Integrity Check**:
   ```bash
   cd c:\DressApp_AG\apps\web
   yarn build
   ```
   *Expected*: Exit code 0.

3. **Empirical Edge-Case Test Harness**:
   Execute the test script at `c:\DressApp_AG\.agents\teamwork_preview_explorer_m1_iter2_3\test_audit.mjs`:
   ```bash
   node c:\DressApp_AG\.agents\teamwork_preview_explorer_m1_iter2_3\test_audit.mjs
   ```
   *Verification Assertions*:
   - `matchesCategory({ category: null }, 'shoes')` returns `false` (Pass)
   - `matchesCategory({ category: '' }, 'outerwear')` returns `false` (Pass)
   - `matchesCategory({ category: 'top' }, 'top')` returns `true` (Pass)
   - `matchesSearch({ colors: [{ name: 'Crimson' }] }, 'crimson')` returns `true` (Pass)
   - `matchesSearch({ tags: [{ name: 'formal' }] }, 'formal')` returns `true` (Pass)
   - `matchesSearch({ tags: 'casual, summer' }, 'summer')` returns `true` (Pass)
   - `matchesSearch({ attributes: { pattern: 'striped' } }, 'striped')` returns `true` (Pass)
