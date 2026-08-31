# Milestone M2 (ItemDetailScreen.tsx) — Explorer Handoff Report

## 1. Observation

Direct observations from source inspection across web, mobile, and API client packages:

### 1.1 Requirements and Scope
- **`ORIGINAL_REQUEST.md` (lines 46–52)**:
  > "Port `apps/web/src/pages/ItemDetail.jsx` — **core loop**: receive `itemId` from `ClosetStack` route params, fetch the item, display its image, name, category, color, brand, and size. Provide a Delete button that calls the appropriate API endpoint and pops back to `ClosetScreen` on success."
- **`PROJECT.md` (lines 17–18, 40–46)**:
  > "Item Detail View: Read `{ itemId }` route params from `ClosetStackParamList`, fetch item via `api.getItem(itemId)`, display 3:4 image hero and taxonomy attributes (name, category, color, brand, size)"
  > "Item Deletion: Delete button with confirmation `Alert.alert`, calls `api.deleteItem(itemId)`, navigates back on success"

### 1.2 API Client Methods
From `packages/api-client/src/closet.js` (lines 4–13, 239–246) and `apps/mobile/src/lib/api.ts` (lines 70–78):
- **`api.getItem(id: string)`**: Executes `GET /closet/${id}` -> returns full `ClosetItem` document.
- **`api.deleteItem(id: string)`**: Executes `DELETE /closet/${id}` -> returns `{ deleted: boolean, id: string }`.
- **`api.patchItem(id: string, body: object)` / `api.updateItem(id: string, body: object)`**: Executes `PATCH /closet/${id}` -> returns updated `ClosetItem`.
- **`api.cleanItemBackground(id: string, preview?: boolean)`**: Executes `POST /closet/${id}/clean-background`.
- **`api.reanalyzeItem(id: string, opts?: { fill_empty_only?: boolean })`**: Executes `POST /closet/${id}/reanalyze`.
- **`api.repairItemImage(id: string, opts?: { userHint?: string; force?: boolean; preview?: boolean })`**: Executes `POST /closet/${id}/repair`.

### 1.3 Data Shape & Attribute Fields
Observed in `apps/web/src/pages/ItemDetail.jsx` (lines 171–281) and `apps/mobile/src/screens/closet/ClosetScreen.tsx` (lines 47–97):
```typescript
export interface ClosetItem {
  id: string;
  title?: string | null;
  name?: string | null;
  caption?: string | null;
  category?: string | null;            // e.g. 'Top', 'Bottom', 'Outerwear', 'Full Body', 'Footwear', 'Accessories', 'Underwear'
  sub_category?: string | null;        // e.g. 't-shirt', 'jeans', 'sneakers', 'hoodie'
  item_type?: string | null;
  brand?: string | null;               // e.g. 'Zara', 'Nike', 'Levi\'s'
  size?: string | null;                // e.g. 'M', 'L', '32x30', '42'
  color?: string | null;               // legacy / primary single color string
  colors?: Array<{ name: string; pct?: number; hex?: string }> | null;
  material?: string | null;            // legacy / primary single material string
  fabric_materials?: Array<{ name: string; pct?: number }> | null;
  pattern?: string | null;             // 'solid', 'striped', 'plaid', 'floral', etc.
  gender?: 'men' | 'women' | 'unisex' | 'kids' | string | null;
  dress_code?: string | null;          // 'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear'
  season?: string[] | string | null;   // ['spring', 'summer', 'fall', 'winter', 'all']
  state?: string | null;               // 'new', 'used'
  condition?: string | null;           // 'bad', 'fair', 'good', 'excellent'
  quality?: string | null;             // 'budget', 'mid', 'premium', 'luxury'
  price_cents?: number | null;         // stored in cents (e.g. 2900 = $29.00)
  currency?: string | null;            // 'USD', 'EUR', 'ILS', etc.
  marketplace_intent?: 'own' | 'for_sale' | 'donate' | 'swap' | 'rent' | string | null;
  formality?: string | null;
  cultural_tags?: string[] | null;
  tags?: string[] | null;
  notes?: string | null;
  wear_count?: number | null;
  is_duplicate?: boolean | null;
  clean_image_status?: 'pending' | 'ready' | 'failed' | string | null;
  group_role?: 'host' | 'member' | 'single' | string | null;
  group_id?: string | null;
  group_members?: Array<ClosetItem> | null;

  // Image URLs
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

### 1.4 Image URL Cascade
From `apps/web/src/lib/itemImage.js` (lines 15–37) and `ClosetScreen.tsx` (lines 137–170):
Priority sequence:
1. `thumbnail_data_url`
2. `reconstructed_image_url`
3. `clean_image_url`
4. `cutout_url`
5. `segmented_image_url`
6. `image_variants?.webp?.medium` / `image_variants?.avif?.medium` / `image_variants?.original`
7. `original_image_url`
8. `image_url`
9. `photo_url`

URL Normalization:
- Data URIs (`data:...`) and absolute HTTP(S) URIs are used directly.
- Relative URIs starting with `/` or relative paths are prepended with `process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co'`.

### 1.5 Delete Flow & UX
From `apps/web/src/pages/ItemDetail.jsx` (lines 1351–1379, 2704–2717):
- Web uses an `AlertDialog` (trigger button -> confirm modal -> `onDelete`).
- Mobile translation: React Native `Alert.alert` with title, message, cancel button, and destructive delete button.
- On delete success: navigate back to `Closet` (`navigation.goBack()`).
- Error handling: if 404 (already deleted), treat as success and navigate back; for other network/server errors, show error message to user and retain screen state.

### 1.6 Navigation & Theme Tokens
- Route definition: `apps/mobile/src/navigation/types.ts`:
  `ClosetStackParamList`: `ItemDetail: { itemId: string }`.
  Typed with `NativeStackScreenProps<ClosetStackParamList, 'ItemDetail'>` or `useRoute<RouteProp<ClosetStackParamList, 'ItemDetail'>>()`.
- Theme & Tokens: `apps/mobile/src/theme/index.tsx` (`useTheme()`) and `apps/mobile/src/theme/tokens.ts` (`fonts`, `fontSizes`, `spacing`, `radii`, `shadows`).

---

## 2. Logic Chain

From the observations above, the implementation architecture for `ItemDetailScreen.tsx` follows this reasoning:

```
[Route Params: { itemId }]
        │
        ▼
[Fetch Item via api.getItem(itemId)]
        ├── Success ──► Set item state, populate attributes, resolve image URL, cache item locally
        ├── 404 / Missing ──► Set notFound state, display "Item Not Found" with "Back to Closet" button
        └── Network Error ──► Check local AsyncStorage cache (@dressapp:closet_cache). If found, display cached data with offline banner; else display Error screen with Retry button
        │
        ▼
[Display Item Screen]
        ├── Header: Back button, Title / Brand, Actions (Delete icon)
        ├── Hero Image: 3:4 aspect ratio with rounded corners, subtle shadows, placeholder fallback on image load error
        ├── Badges Row: Category, Gender, Season, Marketplace Intent, Clean/Polish status
        ├── Primary Details Card: Garment Name / Title, Sub-Category, Brand, Size
        ├── Attributes Card: Colors (color names + swatch badges), Materials (% breakdown if present), Pattern, Dress Code, Formality
        ├── Additional Info: Condition / Quality, Notes, Tags, Wear Count
        └── Sticky / Bottom Action: Delete Button (Destructive red)
        │
        ▼
[Delete Action Flow]
        1. User taps "Delete Item"
        2. Trigger Alert.alert(
             t('closet.confirmDeleteTitle', 'Delete Item'),
             t('closet.confirmDeleteMsg', 'Are you sure you want to delete this item? This action cannot be undone.'),
             [
               { text: t('common.cancel', 'Cancel'), style: 'cancel' },
               {
                 text: t('common.delete', 'Delete'),
                 style: 'destructive',
                 onPress: async () => {
                   setDeleting(true);
                   try {
                     await api.deleteItem(itemId);
                     // Evict from local AsyncStorage cache if present
                     navigation.goBack();
                   } catch (err) {
                     if (err?.response?.status === 404) {
                       navigation.goBack();
                     } else {
                       Alert.alert(t('common.error'), err?.response?.data?.detail || t('closet.deleteFailed'));
                       setDeleting(false);
                     }
                   }
                 }
               }
             ]
           )
```

---

## 3. Caveats

1. **Complex Web Sub-Features (Excluded / Deferred per ORIGINAL_REQUEST.md)**:
   - Web `ItemDetail.jsx` has extensive sub-features: Rembg background matting, Nano-Banana AI reshooting, Group/Host set management, Audio voice dictation, and DPP QR code parsing. Per `ORIGINAL_REQUEST.md` (R2 and preamble), mobile ports the **core interaction loop only**: view image, name, category, color, brand, size, attributes, and delete. Complex sub-features should be omitted or stubbed with `// TODO Phase 5`.
2. **Alert API in React Native**:
   - `Alert.alert` renders the native dialog on iOS / Android. It does not support custom React Native components inside the dialog body. This is the standard pattern in React Native apps.
3. **Offline Cache Synchronization**:
   - `ClosetScreen.tsx` writes `@dressapp:closet_cache` to `AsyncStorage`. When an item is deleted in `ItemDetailScreen`, updating or evicting the item from this cache key prevents stale items if the user goes back while offline.
4. **RTL Support**:
   - Directional properties should use `start` / `end`, `flexDirection: 'row'`, and check `I18nManager.isRTL` where text alignment or chevron directions are involved.

---

## 4. Conclusion & Recommended Implementation Blueprint

The recommended `ItemDetailScreen.tsx` implementation must fulfill all Milestone M2 requirements:

### 4.1 Component Structure
1. **Imports**:
   - React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
   - React Native primitives (`View`, `Text`, `StyleSheet`, `ScrollView`, `Image`, `TouchableOpacity`, `Alert`, `RefreshControl`, `I18nManager`, `ActivityIndicator`).
   - `SafeAreaView` from `react-native-safe-area-context`.
   - `useNavigation` and `useRoute` with typed `ClosetStackParamList`.
   - `useTranslation` from `react-i18next`.
   - `Icon` and `ActivityIndicator` from `react-native-paper`.
   - `AsyncStorage` from `@react-native-async-storage/async-storage`.
   - `useTheme` from `@mobile/theme` and design tokens (`fonts`, `fontSizes`, `spacing`, `radii`, `shadows`).
   - `api` from `@mobile/lib/api`.

2. **State Management**:
   - `item: ClosetItem | null`
   - `loading: boolean` (initial skeleton / spinner)
   - `refreshing: boolean` (pull-to-refresh)
   - `deleting: boolean` (delete operation in progress)
   - `error: string | null` (network error message)
   - `notFound: boolean` (404 item missing)
   - `imageError: boolean` (failed to load remote image -> fallback icon)

3. **Key Visual Sections**:
   - **Header Bar**: Back button, Screen Title (`Item Details`), and Delete Action icon button.
   - **Image Hero (3:4 aspect ratio)**: Full resolution best image with corner radius `radii.xl`, border, shadow, overlay badges (Category, Intent, Duplicate).
   - **Main Info Card**: Garment Name / Title, Brand, Sub-Category, Size badge.
   - **Attributes Grid / Cards**:
     - *Colors*: Color names with visual swatch chips.
     - *Materials*: Material names and percentage pills.
     - *Style & Fit*: Dress code, pattern, season pills, gender.
     - *Care & Notes*: Condition, quality, user notes, tags.
   - **Bottom Sticky Delete Button**: Destructive button with trash icon and loading spinner.

---

## 5. Verification Method

To verify the implementation independently once built:

1. **TypeScript Typecheck**:
   ```bash
   cd c:\DressApp_AG\apps\mobile
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   *Expected result*: Exit code 0 with 0 errors.

2. **Web App Build Check (No regression)**:
   ```bash
   cd c:\DressApp_AG\apps\web
   yarn build
   ```
   *Expected result*: Exit code 0 with clean build output.

3. **File Verification**:
   - Verify `c:\DressApp_AG\apps\mobile\src\screens\closet\ItemDetailScreen.tsx` exists and file size > 3 KB.
   - Verify named export `export function ItemDetailScreen()` and `export default ItemDetailScreen`.
   - Verify no modifications were made to `backend/`, `inference-server/`, `apps/web/`, or `packages/`.
