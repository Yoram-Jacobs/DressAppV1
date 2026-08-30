# Technical Specification & Implementation Plan: ClosetScreen (Milestone M1)

**Screen:** `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Author:** Teamwork Explorer 1 (Milestone M1)  
**Target:** Expo 53 / React Native 0.76+ (TypeScript `.tsx` only)  
**References:** `apps/web/src/pages/Closet.jsx`, `apps/web/src/lib/itemImage.js`, `@mobile/lib/api`, `packages/api-client/src/closet.js`, `apps/mobile/src/navigation/types.ts`, `apps/mobile/src/theme/tokens.ts`

---

## 1. Executive Summary & Problem Boundary

The goal of Milestone M1 is to replace the stub in `apps/mobile/src/screens/closet/ClosetScreen.tsx` with a fully functional, production-ready React Native screen porting the core interaction loop from `apps/web/src/pages/Closet.jsx`.

### Core Interaction Loop
1. **Data Fetching:** Fetch closet items via `api.listCloset()`.
2. **State Management:** Manage `items`, `loading`, `refreshing`, `error`, `selectedCategory`, and `searchQuery`.
3. **Thumbnail Resolution:** Resolve garment images in optimal priority order (`thumbnail_data_url` → `reconstructed_image_url` → `clean_image_url` → `cutout_url` → `segmented_image_url` → `original_image_url` → `image_url` → `photo_url`).
4. **Filtering & Search:** Client-side category matching (accounting for synonyms) and keyword search over the fetched set.
5. **2-Column Responsive Grid:** Render a 2-column scrollable grid with 3:4 aspect ratio cards.
6. **Navigation:** Tapping an item navigates to `ItemDetail` (`{ itemId: item.id }`); tapping the Floating Action Button (FAB) navigates to `ClosetAdd` (`{ source: 'manual' }`).
7. **Pull-to-Refresh & Lifecycle Sync:** Pull-to-refresh via `RefreshControl` and screen focus auto-refetching via `useFocusEffect`.

---

## 2. TypeScript Types & Contracts

### 2.1 Closet Item Contract (`ClosetItem`)
```typescript
export interface ClosetItem {
  id: string;
  title?: string | null;
  name?: string | null;
  category?: string | null;
  sub_category?: string | null;
  item_type?: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  colors?: Array<{ name: string; pct?: number; hex?: string }> | null;
  material?: string | null;
  fabric_materials?: Array<{ name: string; pct?: number }> | null;
  pattern?: string | null;
  gender?: 'men' | 'women' | 'unisex' | 'kids' | string | null;
  dress_code?: 'casual' | 'smart-casual' | 'business' | 'formal' | 'athletic' | 'loungewear' | string | null;
  season?: string[] | null;
  source?: 'Private' | 'Shared' | 'Retail' | string | null;
  marketplace_intent?: 'own' | 'for_sale' | 'donate' | 'swap' | 'rent' | string | null;
  price_cents?: number | null;
  currency?: string | null;
  state?: string | null;
  condition?: string | null;
  quality?: string | null;
  wear_count?: number | null;
  is_duplicate?: boolean | null;
  group_role?: 'host' | 'member' | 'single' | string | null;
  group_id?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  
  // Image pipeline URLs
  thumbnail_data_url?: string | null;
  placeholder_data_url?: string | null;
  reconstructed_image_url?: string | null;
  clean_image_url?: string | null;
  cutout_url?: string | null;
  segmented_image_url?: string | null;
  original_image_url?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  image_variants?: {
    avif?: { medium?: string; thumbnail?: string };
    webp?: { medium?: string; thumbnail?: string };
    original?: string;
  } | null;
  
  created_at?: string | null;
  updated_at?: string | null;
}
```

### 2.2 API Response Shape (`ClosetListResponse`)
```typescript
export interface ClosetListResponse {
  items: ClosetItem[];
  total?: number;
  limit?: number;
  skip?: number;
}
```

### 2.3 Category Filter Keys & Taxonomy
```typescript
export const CATEGORY_FILTERS = [
  { id: 'all', labelKey: 'taxonomy.categories.all', defaultLabel: 'All' },
  { id: 'top', labelKey: 'taxonomy.categories.top', defaultLabel: 'Tops' },
  { id: 'bottom', labelKey: 'taxonomy.categories.bottom', defaultLabel: 'Bottoms' },
  { id: 'outerwear', labelKey: 'taxonomy.categories.outerwear', defaultLabel: 'Outerwear' },
  { id: 'shoes', labelKey: 'taxonomy.categories.shoes', defaultLabel: 'Shoes' },
  { id: 'accessory', labelKey: 'taxonomy.categories.accessories', defaultLabel: 'Accessories' },
  { id: 'dress', labelKey: 'taxonomy.categories.dress', defaultLabel: 'Dresses' },
] as const;

export type CategoryFilterId = typeof CATEGORY_FILTERS[number]['id'];
```

### 2.4 Navigation Prop Types
```typescript
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClosetStackParamList } from '@mobile/navigation/types';

export type ClosetScreenNavigationProp = NativeStackNavigationProp<ClosetStackParamList, 'Closet'>;
```

---

## 3. Thumbnail Resolution Strategy

### 3.1 Architecture & Pipeline Priority
The backend generates optimized ~15 KB JPEG thumbnails encoded as `data:image/jpeg;base64,...` in the `thumbnail_data_url` field during `GET /closet`. However, if an item is newly created or mid-processing, alternative fields must be cascaded.

Priority Order (matching `apps/web/src/lib/itemImage.js`):
1. `item.thumbnail_data_url` (~15 KB data URL / optimized thumbnail)
2. `item.reconstructed_image_url` (high-fidelity generative repair)
3. `item.clean_image_url` (background-removed cutout)
4. `item.cutout_url` (matte layer)
5. `item.segmented_image_url` (segmented mask)
6. `item.image_variants?.webp?.medium` or `item.image_variants?.original`
7. `item.original_image_url` (original raw photo)
8. `item.image_url` (fallback photo link)
9. `item.photo_url` (legacy link)

### 3.2 URL Normalization Implementation
```typescript
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co';

export function resolveThumbnailUrl(item: ClosetItem | null | undefined): string | null {
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

  // 1. Data URLs (data:image/jpeg;base64,...) are natively supported by React Native Image
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 2. Absolute HTTP/HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 3. Relative server paths (/uploads/..., /api/v1/...)
  if (trimmed.startsWith('/')) {
    return `${BACKEND_URL}${trimmed}`;
  }

  return `${BACKEND_URL}/${trimmed}`;
}
```

---

## 4. Filtering & Search Logic

### 4.1 Category Matching & Synonym Resolution
To maintain strict parity with the web application and backend matching semantics (`_CATEGORY_SYNONYMS` in `Closet.jsx`), the mobile category filter maps user choices to synonymous taxonomy terms:

```typescript
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'polo'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'shorts', 'skirt', 'leggings'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan', 'vest', 'parka', 'trench'],
  shoes: ['shoes', 'footwear', 'sneakers', 'boots', 'sandals', 'heels', 'loafers', 'flats', 'slippers'],
  accessory: ['accessory', 'accessories', 'bag', 'handbag', 'hat', 'belt', 'scarf', 'jewelry', 'glasses', 'sunglasses', 'watch'],
  dress: ['dress', 'dresses', 'full body', 'full_body', 'jumpsuit', 'romper', 'gown', 'suit'],
};

export function matchesCategory(item: ClosetItem, selectedCategory: string): boolean {
  if (!selectedCategory || selectedCategory === 'all') return true;
  
  const rawCat = (item.category || '').toLowerCase().trim();
  const rawSub = (item.sub_category || '').toLowerCase().trim();
  const rawItemType = (item.item_type || '').toLowerCase().trim();
  
  const synonyms = CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase()];
  
  return synonyms.some(syn => 
    rawCat.includes(syn) || rawSub.includes(syn) || rawItemType.includes(syn)
  );
}
```

### 4.2 Search Matching
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

### 4.3 Memoized Filter Pipeline
```typescript
const filteredItems = useMemo(() => {
  return items.filter((item) => {
    if (!item) return false;
    // Exclude sub-members of grouped sets from the top-level grid (same as web)
    if (item.group_role === 'member') return false;
    
    return matchesCategory(item, selectedCategory) && matchesSearch(item, searchQuery);
  });
}, [items, selectedCategory, searchQuery]);
```

---

## 5. State Management, Data Fetching & Lifecycle

### 5.1 State Hooks
```typescript
const [items, setItems] = useState<ClosetItem[]>([]);
const [loading, setLoading] = useState<boolean>(true);
const [refreshing, setRefreshing] = useState<boolean>(false);
const [error, setError] = useState<string | null>(null);
const [selectedCategory, setSelectedCategory] = useState<CategoryFilterId>('all');
const [searchQuery, setSearchQuery] = useState<string>('');
```

### 5.2 API Call & Error Handling
```typescript
const fetchCloset = useCallback(async (isRefresh = false) => {
  if (isRefresh) {
    setRefreshing(true);
  } else {
    setLoading(true);
  }
  setError(null);
  
  try {
    const res = await api.listCloset();
    let fetchedList: ClosetItem[] = [];
    
    if (Array.isArray(res)) {
      fetchedList = res;
    } else if (res && Array.isArray(res.items)) {
      fetchedList = res.items;
    }
    
    setItems(fetchedList);
  } catch (err: any) {
    console.warn('[ClosetScreen] Failed to fetch closet items:', err);
    setError(err?.response?.data?.detail || err?.message || 'Failed to load closet items.');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, []);
```

### 5.3 Focus & Pull-to-Refresh Integration
```typescript
// Initial load and refetch on screen focus (e.g. after adding or deleting an item)
useFocusEffect(
  useCallback(() => {
    fetchCloset();
  }, [fetchCloset])
);

// Pull-to-refresh handler
const onRefresh = useCallback(() => {
  fetchCloset(true);
}, [fetchCloset]);
```

---

## 6. Component Architecture & UI Layout

```
┌────────────────────────────────────────────────────────────┐
│ SafeAreaView (edges=['top'])                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Header Row: Title ("Your closet") + Garment Count    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Search Bar: [🔍 Search your closet        [✖ Clear]] │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Horizontal Filter Chips: [All] [Tops] [Bottoms] ...  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ FlatList (numColumns=2, RefreshControl)              │  │
│  │  ┌───────────────────────┐ ┌───────────────────────┐ │  │
│  │  │ Card 1 (3:4 aspect)   │ │ Card 2 (3:4 aspect)   │ │  │
│  │  │ ┌───────────────────┐ │ │ ┌───────────────────┐ │ │  │
│  │  │ │ Resolved Image    │ │ │ │ Resolved Image    │ │ │  │
│  │  │ └───────────────────┘ │ │ └───────────────────┘ │ │  │
│  │  │ Title / Name        │ │ │ Title / Name        │ │ │  │
│  │  │ Category · Color    │ │ │ Category · Color    │ │ │  │
│  │  └───────────────────────┘ └───────────────────────┘ │  │
│  │  ...                                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Floating Action Button (+) (Bottom-Right, fixed)     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 6.1 Card Dimensions & Styling Tokens
- **Grid Layout:** 2 columns.
- **Card Spacing:** Horizontal padding `spacing[4]`, column gap `spacing[3]`, row gap `spacing[3]`.
- **Card Image Aspect Ratio:** 3:4 (`height = width * 4 / 3`).
- **Typography:** Display font for header (`fonts.displayBold`), body bold for titles (`fonts.bodySemiBold`), body regular for metadata (`fonts.body`).
- **Colors:** Dynamic via `useTheme()` (`colors.background`, `colors.card`, `colors.foreground`, `colors.mutedFg`, `colors.accent`, `colors.border`).
- **RTL:** Fully responsive to `I18nManager.isRTL` via standard flex start/end alignment.

---

## 7. Implementation File Structure for Worker M1

Worker M1 will replace `apps/mobile/src/screens/closet/ClosetScreen.tsx` with the complete implementation adhering to:
- Named export `export function ClosetScreen()`
- Default export `export default ClosetScreen`
- Full TypeScript type annotations without `any` regressions
- No DOM/Web APIs (`window`, `document`, `localStorage`)
- File size > 3 KB
- Zero modifications to `apps/mobile/src/navigation/types.ts` or `packages/` files.

---

## 8. Verification Strategy

1. **Static Analysis:**
   ```bash
   cd apps/mobile && node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   *Expected result:* Exit code 0 with 0 errors.
2. **Web Build Safety:**
   ```bash
   cd apps/web && yarn build
   ```
   *Expected result:* Exit code 0 without web regressions.
3. **File Size Check:**
   `apps/mobile/src/screens/closet/ClosetScreen.tsx` size > 3.0 KB.
