# Plan: ClosetScreen Navigation Integration & Edge Cases Handling

**Milestone:** M1 (ClosetScreen)  
**Agent:** Explorer 3  
**Target:** `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Date:** 2026-08-17  

---

## 1. Scope and Objectives

1. **Navigation Integration**:
   - Type-safe integration with `ClosetStackParamList` using React Navigation's `useNavigation`.
   - Navigation on Garment Item Card tap: route to `ItemDetail` passing `{ itemId: item.id }`.
   - Navigation on Floating Action Button (FAB) / Header Action: route to `ClosetAdd` passing `{ source: 'manual' }`.
   - Navigation on Empty State CTA: route to `ClosetAdd` passing `{ source: 'manual' }`.
2. **Edge Cases & Resilience**:
   - **Empty Closet State**: Distinct handling for global empty closet vs. no items matching current filter/search.
   - **Network Errors**: Graceful error UI with actionable "Retry" button and persistent pull-to-refresh (`RefreshControl`).
   - **Broken Image URLs & Fallback**: Priority cascade for multi-source image resolution and `onError` image fallback component.
   - **Offline Fallback / Caching**: Local persistence via `AsyncStorage` (`@dressapp:closet_cache`) allowing instant load and offline browsing.
   - **RTL & Platform Compatibility**: Respecting `I18nManager.isRTL`, safe area insets, and design tokens from `@mobile/theme/tokens`.

---

## 2. Navigation Architecture & Interface Contracts

### 2.1 Navigation Types (`apps/mobile/src/navigation/types.ts`)

`ClosetStackParamList` is defined as:
```typescript
export type ClosetStackParamList = {
  Closet: undefined;
  ItemDetail: { itemId: string };
  ClosetAdd: { source?: 'camera' | 'manual' };
};
```

### 2.2 Hook Typing in `ClosetScreen.tsx`

For pure stack navigation within `ClosetStack`:
```typescript
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClosetStackParamList } from '@mobile/navigation/types';

export type ClosetScreenNavigationProp = NativeStackNavigationProp<
  ClosetStackParamList,
  'Closet'
>;

// Inside ClosetScreen component:
const navigation = useNavigation<ClosetScreenNavigationProp>();
```

For composite navigation (if navigating to sibling tabs like `StylistTab` or `MeTab`):
```typescript
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabsParamList } from '@mobile/navigation/types';

export type ClosetNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ClosetStackParamList, 'Closet'>,
  BottomTabNavigationProp<MainTabsParamList>
>;
```

### 2.3 Navigation Handlers

```typescript
// Item Card Tap
const handleItemPress = useCallback((itemId: string) => {
  navigation.navigate('ItemDetail', { itemId });
}, [navigation]);

// FAB / Header Add Tap
const handleAddPress = useCallback(() => {
  navigation.navigate('ClosetAdd', { source: 'manual' });
}, [navigation]);
```

---

## 3. Detailed Component Architecture

### 3.1 Screen Layout Breakdown
```
┌─────────────────────────────────────────────────────────┐
│ SafeAreaView (edges=['top'])                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Header: "My Closet" + Item Count badge              │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Category Filter Bar (Horizontal Scroll Chips)       │ │
│ │ [All] [Tops] [Bottoms] [Outerwear] [Shoes] [Dresses]│ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 2-Column FlatList (numColumns={2})                  │ │
│ │  ┌──────────────┐  ┌──────────────┐                 │ │
│ │  │ Item Card 1  │  │ Item Card 2  │                 │ │
│ │  │ - 3:4 Image  │  │ - 3:4 Image  │                 │ │
│ │  │ - Title      │  │ - Title      │                 │ │
│ │  │ - Cat · Color│  │ - Cat · Color│                 │ │
│ │  └──────────────┘  └──────────────┘                 │ │
│ │  ...                                                │ │
│ │                                                     │ │
│ │  [PullToRefresh: RefreshControl]                    │ │
│ │  [EmptyStateComponent when items.length === 0]      │ │
│ │  [ErrorBannerComponent when error != null]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Floating Action Button (FAB) [ + ] ─────────► ClosetAdd │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Edge Cases Handling Specification

### 4.1 Empty Closet State
- **State Condition 1 (Total Empty):** `!loading && !error && allItems.length === 0`
  - Display centered layout with icon/illustration.
  - Title: `t('closet.emptyTitle', 'No items yet')`
  - Subtitle: `t('closet.emptySub', 'Add your first piece to start styling.')`
  - Primary Action: `Button` calling `handleAddPress()` with text `t('closet.addItem', 'Add Item')`.
- **State Condition 2 (Filter Empty):** `!loading && !error && allItems.length > 0 && filteredItems.length === 0`
  - Title: `t('common.noResults', 'No matching items')`
  - Subtitle: `No items found in category "${selectedCategory}"`
  - Action: "Show all items" button which resets category filter to `'all'`.

### 4.2 Network Errors & Retry Mechanism
- **State Variables:** `error: string | null`, `isOffline: boolean`.
- **Handling in `fetchCloset`**:
  ```typescript
  const fetchCloset = useCallback(async (isPullToRefresh = false) => {
    if (!isPullToRefresh) setLoading(true);
    setError(null);
    try {
      const data = await api.listCloset();
      const rawItems = Array.isArray(data) ? data : (data?.items || []);
      setItems(rawItems);
      setIsOffline(false);
      // Persist to offline cache
      await AsyncStorage.setItem('@dressapp:closet_cache', JSON.stringify(rawItems));
    } catch (err: any) {
      console.warn('[ClosetScreen] Failed to fetch closet:', err);
      // Attempt offline cache recovery
      try {
        const cached = await AsyncStorage.getItem('@dressapp:closet_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setIsOffline(true);
            return;
          }
        }
      } catch {
        // ignore cache parse errors
      }
      setError(err?.response?.data?.detail || err?.message || 'Failed to load closet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  ```
- **Error UI**:
  - If error occurs and no cached items are available, render `ErrorView` with retry button.
  - If cached items are displayed in offline mode, render a non-intrusive warning chip: `⚠️ Offline mode • Pull down to sync`.

### 4.3 Broken Image URLs & Resolution Cascade
- **Image Priority Cascade:**
  ```typescript
  function resolveItemImage(item: any): string | null {
    if (!item) return null;
    if (item.thumbnail_data_url) return item.thumbnail_data_url;
    if (item.reconstructed_image_url) return item.reconstructed_image_url;
    if (item.clean_image_url) return item.clean_image_url;
    if (item.cutout_url) return item.cutout_url;
    if (item.segmented_image_url) return item.segmented_image_url;
    if (item.image_variants?.webp?.medium) return item.image_variants.webp.medium;
    if (item.original_image_url) return item.original_image_url;
    if (item.image_url) return item.image_url;
    if (item.photo_url) return item.photo_url;
    return null;
  }
  ```
- **Image Fallback Component (`ClosetItemImage`):**
  - Uses local state `imageError: boolean`.
  - When `imageUri` is null or `onError` fires, renders a fallback placeholder container with:
    - Subtle sand/secondary background.
    - Category initial or generic garment icon (`🏷️` / `👗` / `👔`).
    - Prevents broken image icons or jarring blank rectangles.
- **Polishing State:**
  - If `item.clean_image_status === 'pending'`, render a subtle pill overlay: `Polishing...` with soft pulse opacity.

### 4.4 FAB Design & Touch Interaction
- **FAB Styling & Positioning:**
  ```typescript
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    end: spacing[6],
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  }
  ```
- Positioned using safe area insets (`useSafeAreaInsets().bottom + spacing[4]`).
- Elevated with shadow to remain clear of the scrollable grid items.

---

## 5. Verification Plan

1. **TypeScript Typecheck**:
   - `cd apps/mobile && node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck`
   - Must exit **0 errors**.
2. **Navigation Linkages**:
   - Verify `ItemDetail` receives `{ itemId }` param matching `ClosetStackParamList`.
   - Verify `ClosetAdd` receives optional `{ source: 'manual' }`.
   - Verify `FAB` and `EmptyState` buttons navigate cleanly to `ClosetAdd`.
3. **Web Regression**:
   - `cd apps/web && yarn build`
   - Must exit code 0 with no modified web files.
