# Milestone M2 Investigation Report: Navigation Contracts, Parameter Handling & Resilience Analysis for ItemDetailScreen.tsx

**Explorer Agent**: Explorer 3 (M2)  
**Target Screen**: `apps/mobile/src/screens/closet/ItemDetailScreen.tsx`  
**Reference Files**:
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/navigation/stacks/ClosetStack.tsx`
- `apps/mobile/src/screens/closet/ClosetScreen.tsx`
- `apps/web/src/pages/ItemDetail.jsx`
- `packages/api-client/src/closet.js` & `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/theme/tokens.ts` & `apps/mobile/src/theme/index.tsx`
- `packages/i18n/locales/en.json`

---

## 1. Observation

### 1.1 Navigation Contract & Route Definitions
In `apps/mobile/src/navigation/types.ts` (lines 17–23):
```typescript
// ── Closet Stack ──────────────────────────────────────────────────────────
export type ClosetStackParamList = {
  Closet: undefined;
  ItemDetail: { itemId: string };
  ClosetAdd: { source?: 'camera' | 'manual' };
};
```

In `apps/mobile/src/navigation/stacks/ClosetStack.tsx` (lines 7–29):
```typescript
// Lazy imports — screens loaded on demand
const ClosetScreen = React.lazy(() => import('@mobile/screens/closet/ClosetScreen').then(m => ({ default: m.ClosetScreen })));
const ItemDetailScreen = React.lazy(() => import('@mobile/screens/closet/ItemDetailScreen').then(m => ({ default: m.ItemDetailScreen })));
const ClosetAddScreen = React.lazy(() => import('@mobile/screens/closet/ClosetAddScreen').then(m => ({ default: m.ClosetAddScreen })));

const Stack = createNativeStackNavigator<ClosetStackParamList>();

export function ClosetStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Closet" component={ClosetScreen as any} options={{ title: 'My Closet' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen as any} options={{ title: '' }} />
      <Stack.Screen name="ClosetAdd" component={ClosetAddScreen as any} options={{ title: 'Add Item', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
```

In `apps/mobile/src/screens/closet/ClosetScreen.tsx` (lines 426–432):
```typescript
const handleItemPress = useCallback(
  (item: ClosetItem) => {
    if (!item || !item.id) return;
    navigation.navigate('ItemDetail', { itemId: item.id });
  },
  [navigation]
);
```

### 1.2 Current Stub State
In `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` (18 lines, 635 bytes):
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ItemDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Item Detail</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(40, 20%, 98%)' },
  title: { fontSize: 24, fontFamily: 'Manrope_600SemiBold', color: 'hsl(240, 10%, 12%)', marginBottom: 8 },
  sub: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: 'hsl(240, 5%, 45%)' },
});
```

### 1.3 Web Implementation Details (API Calls, Delete & 404 Handling)
In `apps/web/src/pages/ItemDetail.jsx`:
- Loading item (lines 694–705):
  ```javascript
  const load = async () => {
    try {
      const data = await api.getItem(id);
      setItem(data);
      setForm(toFormState(data, user));
    } catch (err) {
      const is404 = err?.response?.status === 404;
      toast.error(is404 ? t('itemDetail.notFound') : (err?.response?.data?.detail || t('common.error')));
      nav('/closet');
    } finally {
      setLoading(false);
    }
  };
  ```
- Deleting item (lines 1351–1379):
  ```javascript
  const onDelete = async () => {
    const snapshot = item;
    closetStore.remove(id);
    toast.success(t('itemDetail.deleted'));
    if (location.state?.fromOutfits) {
      nav('/stylist', { replace: true, state: { tab: 'shuffle' } });
    } else {
      nav('/closet');
    }
    api.deleteItem(id).catch((err) => {
      if (err?.response?.status !== 404) {
        if (snapshot) {
          closetStore.upsert(snapshot);
        }
        toast.error(err?.response?.data?.detail || t('closet.deleteFailed'));
      }
    });
  };
  ```

### 1.4 API Client Methods in Mobile
In `packages/api-client/src/closet.js` (lines 6–12) exposed via `@mobile/lib/api`:
- `api.getItem(id)`: `client.get('/closet/' + id).then(r => r.data)`
- `api.deleteItem(id)`: `client.delete('/closet/' + id).then(r => r.data)`
- `api.updateItem(id, body)` / `api.patchItem(id, body)`: `client.patch('/closet/' + id, body).then(r => r.data)`
- `api.cleanItemBackground(itemId)`: `client.post('/closet/' + itemId + '/clean-background')`
- `api.reanalyzeItem(itemId)`: `client.post('/closet/' + itemId + '/reanalyze')`

### 1.5 Shared Image Resolver Pattern in Mobile
In `apps/mobile/src/screens/closet/ClosetScreen.tsx` (lines 137–170):
- Cascade order: `thumbnail_data_url` → `reconstructed_image_url` → `clean_image_url` → `cutout_url` → `segmented_image_url` → `image_variants.webp.medium` → `image_variants.original` → `original_image_url` → `image_url` → `photo_url`.
- URL normalization:
  - `data:` inline Base64 URLs returned as-is.
  - Absolute HTTP/HTTPS URLs returned as-is.
  - Relative URLs prefixed with `process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co'`.

---

## 2. Logic Chain & Analysis

### 2.1 Navigation Contracts & Parameter Handling
1. **Type Definition**:
   - `RouteProp<ClosetStackParamList, 'ItemDetail'>` defines `{ route: { params: { itemId: string } } }`.
   - `NativeStackNavigationProp<ClosetStackParamList, 'ItemDetail'>` provides `navigation.goBack()`, `navigation.navigate('Closet')`, `navigation.navigate('ClosetAdd')`.
   - Component typing:
     ```typescript
     import type { RouteProp } from '@react-navigation/native';
     import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
     import { useNavigation, useRoute } from '@react-navigation/native';
     import type { ClosetStackParamList } from '@mobile/navigation/types';

     export type ItemDetailRouteProp = RouteProp<ClosetStackParamList, 'ItemDetail'>;
     export type ItemDetailNavigationProp = NativeStackNavigationProp<ClosetStackParamList, 'ItemDetail'>;
     ```
2. **Safe Parameter Extraction**:
   - In React Native, navigation parameters may be missing if an un-typed navigation call occurs or if deep-linking routes directly.
   - We must extract with optional chaining:
     ```typescript
     const route = useRoute<ItemDetailRouteProp>();
     const navigation = useNavigation<ItemDetailNavigationProp>();
     const itemId = route.params?.itemId;
     ```
   - Parameter validation must occur before calling `api.getItem(itemId)`. If `!itemId || typeof itemId !== 'string' || !itemId.trim()`, transition immediately to a descriptive `InvalidItemState` rather than firing a malformed HTTP request (`GET /closet/undefined` or `GET /closet/`).

### 2.2 Comprehensive Edge Case Resilience Matrix

| Edge Case | Root Cause / Scenario | Consequence if Unhandled | Required Resilience Pattern |
|:---|:---|:---|:---|
| **Undefined / Missing `itemId`** | Deep link without param or navigation route mismatch | `api.getItem(undefined)` -> `GET /api/v1/closet/undefined` (500 or 404) | Early guard clause: render `EmptyState` ("No item specified") with "Back to Closet" CTA button. |
| **Malformed ID / Invalid String** | Injected characters, empty string, corrupted cache | API error / crash | String sanitization + immediate fallback error UI. |
| **Item Not Found (404)** | Item was deleted on another device or invalid ID | Infinite spinner or unhandled rejected promise | `try/catch` on `api.getItem`: check `err?.response?.status === 404`; display clear "Item not found" error card with "Back to Closet" CTA and `Alert.alert`. |
| **Unmount During Async Operation** | User taps Back while `api.getItem` or `api.deleteItem` is in flight | React "Can't perform a React state update on an unmounted component" warning / memory leak | `isMounted` flag pattern in `useEffect`/`useFocusEffect` and `useRef(true)` cleanup. |
| **Double-Tap on Delete Button** | User rapidly taps Delete multiple times | Multiple concurrent `DELETE /closet/:id` calls; race condition; duplicate alert triggers | 1. Native `Alert.alert` confirmation modal.<br>2. Synchronous `isDeletingRef.current` guard + `isDeleting` state.<br>3. `disabled={isDeleting || loading}` on button.<br>4. Inline `ActivityIndicator` on button during deletion. |
| **Offline / Network Failure** | Network disconnected during fetch | Blank screen / uncaught error | 1. Catch network error and set `error` state with retry CTA.<br>2. Fallback to AsyncStorage cache (`@dressapp:closet_cache`) to find item locally if available. |
| **Broken / Missing Hero Image** | Image URL 404, corrupted upload, network timeout | Broken image box or UI flicker | 1. Comprehensive `resolveItemImageUrl` cascade.<br>2. `Image.onError` state falling back to placeholder garment icon with themed card. |
| **RTL Directional Inversion** | Arabic / Hebrew locale active (`I18nManager.isRTL`) | Text misaligned, backwards chevrons | 1. `I18nManager.isRTL` dynamic alignment.<br>2. Flexbox `flexDirection: 'row'`, start/end alignment.<br>3. Chevron icon dynamic flipping (`chevron-left` vs `chevron-right`). |

### 2.3 Detailed Delete Interaction Flow with Double-Tap Prevention

```typescript
const [isDeleting, setIsDeleting] = useState(false);
const isDeletingRef = useRef(false);

const handleDelete = useCallback(() => {
  if (isDeletingRef.current || isDeleting || !itemId) return;

  Alert.alert(
    t('itemDetail.removeTitle', 'Remove from closet?'),
    t('itemDetail.removeBody', "This action can't be undone."),
    [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('itemDetail.deleteItem', 'Delete item'),
        style: 'destructive',
        onPress: async () => {
          if (isDeletingRef.current) return;
          isDeletingRef.current = true;
          setIsDeleting(true);

          try {
            await api.deleteItem(itemId);

            // Pop back to ClosetScreen on success
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Closet');
            }
          } catch (err: any) {
            isDeletingRef.current = false;
            setIsDeleting(false);

            // If it's 404, it was already deleted on server — pop back safely
            if (err?.response?.status === 404) {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Closet');
              }
              return;
            }

            Alert.alert(
              t('common.error', 'Error'),
              err?.response?.data?.detail || t('closet.deleteFailed', 'Failed to delete item. Please try again.')
            );
          }
        },
      },
    ]
  );
}, [itemId, isDeleting, navigation, t]);
```

### 2.4 Cross-Screen Consistency Alignment with `ClosetScreen.tsx`

1. **Item Model (`ClosetItem`) Alignment**:
   - `ItemDetailScreen.tsx` must use the same `ClosetItem` interface definition as `ClosetScreen.tsx`.
   - Fields covered:
     - Identification: `id`, `title`, `name`, `source`, `wear_count`, `is_duplicate`
     - Taxonomy: `category`, `sub_category`, `item_type`, `brand`, `gender`, `dress_code`, `season`, `tradition`
     - Attributes: `size`, `color`, `colors`, `material`, `fabric_materials`, `pattern`
     - Status & Quality: `state`, `condition`, `quality`, `clean_image_status`, `group_role`, `group_id`
     - Commerce: `marketplace_intent`, `price_cents`, `currency`
     - Notes & Metadata: `notes`, `tags`, `created_at`, `updated_at`
     - Image Variants: `thumbnail_data_url`, `reconstructed_image_url`, `clean_image_url`, `cutout_url`, `segmented_image_url`, `original_image_url`, `image_url`, `photo_url`, `image_variants`
2. **Image Resolution Helper**:
   - Export and use `resolveItemImageUrl(item: ClosetItem | null | undefined): string | null` following the exact priority order and backend URL resolution from `ClosetScreen.tsx`.
3. **Design Tokens & Theming**:
   - Single source of truth: `useTheme()` from `@mobile/theme`
   - Tokens: `fonts`, `fontSizes`, `spacing`, `radii`, `shadows` from `@mobile/theme/tokens`
   - Colors: `colors.background`, `colors.card`, `colors.foreground`, `colors.muted`, `colors.mutedFg`, `colors.primary`, `colors.destructive`, `colors.accent`, `colors.border`.
4. **Header and Navigation Structure**:
   - Screen integrates with `ClosetStack` options (`headerShadowVisible: false`, `headerTintColor: colors.foreground`).
   - Custom in-screen header bar providing a back button (`navigation.goBack()`), item title / brand, and quick actions.

### 2.5 Code Structure & Export Contract
- **File Location**: `apps/mobile/src/screens/closet/ItemDetailScreen.tsx`
- **File Size Target**: Current stub is 635 B. Complete production screen will be **15–25 KB** (well exceeding the > 3 KB acceptance criteria).
- **Dual Export Pattern** (required by `ClosetStack.tsx`):
  ```typescript
  export function ItemDetailScreen() { ... }
  export default ItemDetailScreen;
  ```
- **Component Architecture**:
  1. `ItemDetailScreen` (Main Controller)
  2. `ItemHeroSection` (3:4 aspect ratio hero image with zoom/badge overlays and fallback handling)
  3. `ItemHeaderBlock` (Garment name, brand, category chip, price badge)
  4. `ItemAttributesGrid` (Structured 2-column or card layout for Size, Color palette, Material percentages, Pattern, Season, Condition, Formality)
  5. `ItemNotesSection` (Notes, Tags, AI Analysis status)
  6. `ItemActionFooter` (Sticky or scrollable Delete button with destructive styling, spinner, confirmation modal)
  7. `ItemLoadingSkeleton` (3:4 hero shimmer + attribute placeholder lines)
  8. `ItemErrorView` (404/Network failure with retry and back button)

---

## 3. Caveats

1. **Sub-features & Complex Stores**:
   - Advanced web sub-features (e.g. multi-view garment set grouping `group_members`, live audio dictation, DppPanel, and marketplace backfill) depend on unported web stores (`closetStore`, `workStore`) and are stubbed inline with `// TODO Phase 5` per the prompt's instruction.
2. **Offline Cache Read-Only**:
   - If offline, reading from `@dressapp:closet_cache` allows viewing cached item data, but deletion requires active backend connectivity (or optimistic local deletion when offline store is ported in Phase 5).

---

## 4. Conclusion & Recommended Implementation Blueprint

The implementation for `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` is fully specified and ready for implementation.

### Implementation Checklist for Worker M2:
1. **Imports & Types**:
   - React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`).
   - React Native primitives (`View`, `Text`, `ScrollView`, `Image`, `TouchableOpacity`, `StyleSheet`, `Alert`, `Dimensions`, `I18nManager`, `RefreshControl`).
   - React Navigation hooks (`useNavigation`, `useRoute`) and types (`RouteProp`, `NativeStackNavigationProp`).
   - Localization (`useTranslation`) with fallback strings.
   - Theme tokens (`useTheme`, `fonts`, `fontSizes`, `spacing`, `radii`, `shadows`).
   - API client (`api` from `@mobile/lib/api`).
2. **State Management**:
   - `item: ClosetItem | null`
   - `loading: boolean` (initial true)
   - `refreshing: boolean` (false)
   - `error: string | null`
   - `is404: boolean` (false)
   - `isDeleting: boolean` (false)
   - `imageError: boolean` (false)
3. **Interaction & Handlers**:
   - `fetchItem(isRefresh?: boolean)` with `isMounted` guard and 404 detection.
   - `handleDelete()` with double-tap lock (`isDeletingRef`), `Alert.alert` confirmation, and `navigation.goBack()`.
   - `handleBack()` (`navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Closet')`).
   - `handleRetry()` to re-fetch data.
4. **UI Layout**:
   - Header with Back Chevron and Title.
   - Hero Image Container (3:4 ratio) with fallback placeholder icon.
   - Title, Brand, Category, Size, and Price Overview.
   - Taxonomy & Attribute Cards (Category, Sub-category, Brand, Size, Color/Colors, Material/Materials, Pattern, Gender, Season, Formality, Condition).
   - Notes & Tags.
   - Delete Button (styled with `colors.destructive`, loading indicator, confirmation dialog).
5. **Exports**:
   - `export function ItemDetailScreen()`
   - `export default ItemDetailScreen;`

---

## 5. Verification Method

To verify the implementation independently:

1. **TypeScript Typecheck**:
   ```bash
   cd c:\DressApp_AG\apps\mobile
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   *Expected result*: Exit code `0` with 0 errors.

2. **Web App Build Check** (No Regressions):
   ```bash
   cd c:\DressApp_AG\apps\web
   yarn build
   ```
   *Expected result*: Exit code `0`.

3. **File Size Check**:
   Confirm `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` is > 3 KB.

4. **Navigation Contract Inspection**:
   Verify `ItemDetailScreen.tsx` compiles against `ClosetStackParamList` without `any` overrides on route params.
