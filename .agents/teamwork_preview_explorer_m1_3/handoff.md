# Handoff Report: ClosetScreen Navigation Integration & Edge Cases Strategy

**Explorer:** Explorer 3 (Milestone M1 — ClosetScreen)  
**Target File:** `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Working Directory:** `c:\DressApp_AG\.agents\teamwork_preview_explorer_m1_3`  
**Date:** 2026-08-17  

---

## 1. Observation

### 1.1 Navigation Contract in `apps/mobile/src/navigation/types.ts:18-22`
```typescript
// ── Closet Stack ──────────────────────────────────────────────────────────
export type ClosetStackParamList = {
  Closet: undefined;
  ItemDetail: { itemId: string };
  ClosetAdd: { source?: 'camera' | 'manual' };
};
```

### 1.2 ClosetStack Navigator Wiring in `apps/mobile/src/navigation/stacks/ClosetStack.tsx:24-29`
```typescript
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
```

### 1.3 Web Implementation Reference in `apps/web/src/pages/Closet.jsx`
- **Line 1209**: Web card links to `/closet/${it.id}` via `<Link to={'/closet/' + it.id}>`.
- **Line 896 & 1172**: Web Add buttons route to `/closet/add` via `<Link to="/closet/add">`.
- **Lines 1158-1175**: Empty state displays headline (`t('closet.emptyTitle')`), subtitle (`t('closet.emptySub')`), and an "Add item" button linking to `/closet/add`.
- **Lines 1620-1681**: Image rendering resolves via `bestImageUrl(item)` and displays `ProgressiveImage` or `t('market.noImage')` placeholder if missing or failed.
- **Lines 1635-1661**: If `isCleanImagePending(item)` is true (`clean_image_status === 'pending'`), renders an overlaid badge with `t('item.polishingPhoto')`.

### 1.4 API Client Contract in `packages/api-client/src/closet.js:6-7`
```javascript
export const closet = {
  // --- basic CRUD ---
  listCloset: (params = {}) =>
    client.get('/closet', { params }).then((r) => r.data),
  getItem: (id) => client.get(`/closet/${id}`).then((r) => r.data),
  ...
};
```
And exposed in mobile via `@mobile/lib/api`:
```typescript
import { api } from '@mobile/lib/api';
// api.listCloset() returns Promise<{ items: ClosetItem[], total?: number } | ClosetItem[]>
```

### 1.5 Current Stub in `apps/mobile/src/screens/closet/ClosetScreen.tsx:1-18`
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ClosetScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Closet</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}
```
Currently, `ClosetScreen.tsx` is an 18-line stub with no navigation integration, list rendering, or error/offline handling.

---

## 2. Logic Chain

1. **Navigation Hook Typing (from Observation 1.1 & 1.2)**:
   - To make navigation completely type-safe and prevent runtime parameter mismatches, `ClosetScreen.tsx` must import `NativeStackNavigationProp` from `@react-navigation/native-stack` and `ClosetStackParamList` from `@mobile/navigation/types`.
   - `type ClosetScreenNavProp = NativeStackNavigationProp<ClosetStackParamList, 'Closet'>;`
   - `const navigation = useNavigation<ClosetScreenNavProp>();` ensures TypeScript catches invalid route names or missing route parameters at compile time.

2. **Item Tap Navigation (from Observation 1.1 & 1.3)**:
   - In React Native, touchable cards (`TouchableOpacity` or `Pressable`) replace web `<a>` / `<Link>`.
   - On tap, the card executes `navigation.navigate('ItemDetail', { itemId: item.id })`.
   - This passes the required parameter `{ itemId: string }` defined in `ClosetStackParamList.ItemDetail`, satisfying R1 and R2 contracts.

3. **Floating Action Button (FAB) Navigation (from Observation 1.1, 1.2, & 1.3)**:
   - A floating button positioned at the bottom-end of the screen with fixed positioning and high elevation/shadow provides the primary "+ Add Item" CTA.
   - On press, the FAB triggers `navigation.navigate('ClosetAdd', { source: 'manual' })`.
   - Because `ClosetAdd` is configured with `presentation: 'modal'` in `ClosetStack.tsx`, pressing the FAB opens the modal add sheet seamlessly.

4. **Empty Closet State & Search Edge Case (from Observation 1.3 & 1.5)**:
   - When `items.length === 0` after initial loading completes without network errors:
     - Render `ListEmptyComponent` with an empty state illustration/icon, `t('closet.emptyTitle', 'No items yet')`, and `t('closet.emptySub', 'Add your first piece to start styling.')`.
     - Render a primary button "Add Item" that triggers `navigation.navigate('ClosetAdd', { source: 'manual' })`.
   - When filtering yields 0 items (`filteredItems.length === 0` but `allItems.length > 0`):
     - Display a "No items found in this category" view with a "Reset Filter" button that resets the active category to `'all'`.

5. **Network Errors & Offline Resilience (from Observation 1.4)**:
   - When `api.listCloset()` fails (network offline or server error):
     - Check local cache in `AsyncStorage` under `@dressapp:closet_cache`.
     - If cached items exist, populate state and display an informational offline banner (`⚠️ Viewing offline closet • Pull down to sync`).
     - If no cached data exists, display a full-screen `ErrorView` with an explicit "Try Again" button calling `fetchCloset()`.
     - Keep `RefreshControl` active so pull-to-refresh works in all states.

6. **Broken Image URLs & Fallbacks (from Observation 1.3)**:
   - A dedicated `resolveItemImage(item)` function handles the 8-tier resolution priority cascade (`thumbnail_data_url` -> `reconstructed_image_url` -> `clean_image_url` -> `cutout_url` -> `segmented_image_url` -> `image_variants` -> `original_image_url` -> `image_url` -> `photo_url`).
   - The card image component tracks `imageError` via `onError={() => setImageError(true)}`.
   - When `imageUri` is null or `imageError` is true, render a styled fallback box with a category icon (`🏷️`, `👗`, `👔`) so no broken images or blank gaps appear in the grid.
   - If `item.clean_image_status === 'pending'`, render an overlay badge "Polishing photo…" matching web parity.

---

## 3. Caveats

1. **Advanced Web Features Deferred**:
   - Web drag-to-group multi-view pairing, bulk selection mode, and semantic FashionCLIP vector search are complex web-specific features that rely on DOM elements and unported store logic (`workStore`, `closetStore`). As per `ORIGINAL_REQUEST.md`, only the core interaction loop (fetch, 2-column grid, category filter, pull-to-refresh, navigation, FAB, error/empty handling) is ported in M1.
2. **Camera Capture**:
   - `ClosetAdd` parameter `{ source: 'camera' | 'manual' }` is passed with `'manual'`. Camera live capture / VisionCamera is deferred to Phase 7 per monorepo constraints.
3. **Store Architecture**:
   - Mobile uses local component state + `AsyncStorage` cache rather than the web-only `closetStore.js` to ensure zero web code leakage and zero web regressions.

---

## 4. Conclusion

The navigation integration for `ClosetScreen.tsx` is completely defined and adheres strictly to `ClosetStackParamList` without modifying any navigation typings.

### Recommended Implementation Strategy:
1. **Typed Navigation Hook**:
   ```typescript
   import { useNavigation } from '@react-navigation/native';
   import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
   import type { ClosetStackParamList } from '@mobile/navigation/types';

   type ClosetNavProp = NativeStackNavigationProp<ClosetStackParamList, 'Closet'>;
   const navigation = useNavigation<ClosetNavProp>();
   ```
2. **Item Tap**:
   ```typescript
   onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
   ```
3. **FAB & Empty State CTA**:
   ```typescript
   onPress={() => navigation.navigate('ClosetAdd', { source: 'manual' })}
   ```
4. **Resilience & Edge Cases**:
   - 2-Column `FlatList` with `RefreshControl`.
   - Multi-tier `resolveItemImage()` with `Image onError` fallback component.
   - Dual empty states: Full empty with `ClosetAdd` CTA vs. Filter empty with Clear Filter button.
   - Network failure recovery via `@dressapp:closet_cache` in `AsyncStorage`.
   - Polishing badge overlay when `item.clean_image_status === 'pending'`.

---

## 5. Verification Method

### 5.1 Static Type Checking
Run the TypeScript compiler against the mobile app from the mobile directory:
```powershell
cd c:\DressApp_AG\apps\mobile
node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
```
**Expected Result:** Exit code 0, 0 type errors.

### 5.2 Navigation Signature Verification
Inspect `apps/mobile/src/navigation/types.ts` to ensure:
1. `Closet` route takes `undefined`.
2. `ItemDetail` route takes `{ itemId: string }`.
3. `ClosetAdd` route takes `{ source?: 'camera' | 'manual' }`.

### 5.3 Web Build Regression Check
Ensure no web files were modified or broken:
```powershell
cd c:\DressApp_AG\apps\web
yarn build
```
**Expected Result:** Exit code 0, build succeeds.
