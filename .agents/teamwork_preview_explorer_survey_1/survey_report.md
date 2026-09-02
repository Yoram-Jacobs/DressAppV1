# Survey Report: Closet Flow Screen Porting (R1, R2, R3)

**Author:** Survey Explorer 1  
**Target:** DressApp Mobile Porting (React 19 Web -> Expo 53 React Native)  
**Scope:** R1 (ClosetScreen), R2 (ItemDetailScreen), R3 (ClosetAddScreen)  
**Date:** 2026-08-17  

---

## 1. Executive Summary

This survey report provides a complete architectural and technical investigation for porting the three Closet-related screens from `apps/web/` to `apps/mobile/`:
1. **R1: ClosetScreen** (`apps/web/src/pages/Closet.jsx` -> `apps/mobile/src/screens/closet/ClosetScreen.tsx`)
2. **R2: ItemDetailScreen** (`apps/web/src/pages/ItemDetail.jsx` -> `apps/mobile/src/screens/closet/ItemDetailScreen.tsx`)
3. **R3: ClosetAddScreen** (`apps/web/src/pages/AddItem.jsx` -> `apps/mobile/src/screens/closet/ClosetAddScreen.tsx`)

Each screen's web implementation, underlying API calls in `packages/api-client/src/`, navigation routing in `apps/mobile/src/navigation/types.ts`, design tokens in `apps/mobile/src/theme/tokens.ts`, form validation with `react-hook-form` + `zod`, image handling with `expo-image-picker`, and required placeholders are detailed below.

---

## 2. Monorepo Wiring & Platform Architecture

### 2.1 API Client Layer (`packages/api-client/src/`)
- Mobile accesses API methods through `import { api } from '@mobile/lib/api';` (or `@dressapp/api-client`).
- Mobile initializes `createApiClient` with `expo-secure-store` for JWT tokens, `AsyncStorage` for user preferences, and a 401 handler that resets navigation to `AuthStack`.
- The `api` object is built by `buildApi()` which aggregates domain adapters: `closet`, `auth`, `users`, `stylist`, `suitcase`, `listings`, etc.

### 2.2 Navigation Architecture (`apps/mobile/src/navigation/`)
- Stack definitions are typed in `apps/mobile/src/navigation/types.ts`:
  ```typescript
  export type ClosetStackParamList = {
    Closet: undefined;
    ItemDetail: { itemId: string };
    ClosetAdd: { source?: 'camera' | 'manual' };
  };
  ```
- `ClosetStack.tsx` configures the stack with native navigation:
  - `Closet`: Main grid view (`options={{ title: 'My Closet' }}`)
  - `ItemDetail`: Full item viewer (`options={{ title: '' }}`)
  - `ClosetAdd`: Modal manual addition (`options={{ title: 'Add Item', presentation: 'modal' }}`)

### 2.3 Theme & Tokens (`apps/mobile/src/theme/`)
- `useTheme()` provides active palette `colors` (supporting light and dark mode):
  - `colors.background`: `hsl(40, 20%, 98%)` (light) / `hsl(240, 10%, 8%)` (dark)
  - `colors.foreground`: `hsl(240, 10%, 12%)` / `hsl(40, 20%, 98%)`
  - `colors.card`: `hsl(0, 0%, 100%)` / `hsl(240, 8%, 11%)`
  - `colors.accent`: `hsl(174, 44%, 33%)` (ocean teal)
  - `colors.brand`: `hsl(271, 81%, 56%)`
  - `colors.muted`, `colors.mutedFg`, `colors.border`, `colors.destructive`, etc.
- Fonts: `PlayfairDisplay_400Regular`, `PlayfairDisplay_700Bold` (display), `Manrope_400Regular`, `Manrope_500Medium`, `Manrope_600SemiBold`, `Manrope_700Bold` (body).

---

## 3. R1: ClosetScreen Investigation

### 3.1 Web Source Analysis (`apps/web/src/pages/Closet.jsx`)
- **Total lines:** 1,909 lines.
- **Core Loop:**
  - Fetches closet items on mount via `api.listCloset()`.
  - Filters items client-side by category (`all`, `top`, `bottom`, `outerwear`, `shoes`, `accessory`, `dress`), source (`Private`, `Shared`, `Retail`), and text search query.
  - Category matcher accounts for synonyms:
    - `top`: `['top', 'tops']`
    - `bottom`: `['bottom', 'bottoms']`
    - `outerwear`: `['outerwear']`
    - `shoes`: `['shoes', 'footwear']`
    - `accessory`: `['accessory', 'accessories']`
    - `dress`: `['dress', 'dresses', 'full body']`
  - Renders a responsive grid of item cards (2-column on mobile, 4-column on desktop).
  - Each item card displays:
    - Image (resolves thumbnail in priority order).
    - Item title / name.
    - Category & Color chips.
    - Status badges (e.g. outfit set, source tag, wear count, duplicate star ⭐).
  - Tapping an item navigates to `/closet/:id` (ItemDetail).
  - Floating "+ Add item" button navigates to `/closet/add`.
  - Bulk select mode, drag-to-group, outfit completion sheet, and tag modal are sub-features that are web-heavy and out of the core mobile loop.

### 3.2 API Endpoint & Exact Signature
- `api.listCloset(params = {})` (`packages/api-client/src/closet.js:6`):
  - Request: `GET /closet`
  - Query params: `{ category, source, search, limit, offset, updated_after, ids_only }`
  - Response structure: `{ items: ClosetItem[], total?: number }` (or array `ClosetItem[]`)

### 3.3 Mobile Implementation Requirements (`ClosetScreen.tsx`)
- **State Management:**
  - `items: ClosetItem[]` (all fetched items)
  - `loading: boolean` (initial load spinner)
  - `refreshing: boolean` (pull-to-refresh)
  - `selectedCategory: string` (default: `'all'`)
  - `searchQuery: string` (optional search input)
- **Component Layout:**
  - Header with title (`t('closet.title', 'My Closet')`) and item count `(items.length)`.
  - Horizontal category filter bar (`ScrollView horizontal` with pill buttons for: `All`, `Tops`, `Bottoms`, `Outerwear`, `Shoes`, `Accessories`, `Dresses`).
  - Search bar (optional text input with clear icon).
  - 2-Column `FlatList` with `numColumns={2}`:
    - Item card: 3:4 aspect ratio container, `Image` with fallback placeholder, title, category/color labels.
    - `onPress` -> `navigation.navigate('ItemDetail', { itemId: item.id })`.
  - Floating Action Button (FAB) or header button:
    - `onPress` -> `navigation.navigate('ClosetAdd', { source: 'manual' })`.
  - `RefreshControl` bound to `onRefresh` handler calling `fetchCloset()`.
  - Empty state when `items.length === 0`:
    - "Your closet is empty" headline, illustration/icon, and "Add your first item" button.
  - Error state with retry button.

---

## 4. R2: ItemDetailScreen Investigation

### 4.1 Web Source Analysis (`apps/web/src/pages/ItemDetail.jsx`)
- **Total lines:** 2,772 lines.
- **Core Loop:**
  - Reads `id` from URL params (`useParams()`).
  - Fetches item via `api.getItem(id)`.
  - Displays primary photo, title, taxonomy attributes (category, sub_category, item_type, brand, gender, dress_code, season, tradition), composition (size, color, colors array, material, fabric_materials array, pattern), quality (state, condition, quality, repair_advice), pricing (price_cents, currency, marketplace_intent), organization (tags, cultural_tags, notes).
  - Delete button opens a confirmation alert (`AlertDialog`).
  - Upon delete confirmation, calls `api.deleteItem(id)` and navigates back to `/closet`.
  - Discard/Save floating action bar handles field edits (title, taxonomy, size, color, etc.) via `api.updateItem(id, patch)`.
  - Sub-features like AI Eyes Chat re-analysis, Nano Banana photo repair, and multi-view garment grouping are advanced web features.

### 4.2 API Endpoints & Exact Signatures
- `api.getItem(id: string)` (`packages/api-client/src/closet.js:8`):
  - Request: `GET /closet/${id}`
  - Response: `ClosetItem` object:
    ```typescript
    {
      id: string;
      title?: string;
      name?: string;
      category?: string;
      sub_category?: string;
      item_type?: string;
      brand?: string;
      gender?: string;
      dress_code?: string;
      season?: string[];
      tradition?: string;
      size?: string;
      color?: string;
      colors?: { name: string; pct?: number }[];
      material?: string;
      fabric_materials?: { name: string; pct?: number }[];
      pattern?: string;
      state?: string;
      condition?: string;
      quality?: string;
      repair_advice?: string;
      price_cents?: number;
      currency?: string;
      marketplace_intent?: string;
      tags?: string[];
      notes?: string;
      thumbnail_data_url?: string;
      original_image_url?: string;
      clean_image_url?: string;
      segmented_image_url?: string;
      reconstructed_image_url?: string;
    }
    ```
- `api.deleteItem(id: string)` (`packages/api-client/src/closet.js:12`):
  - Request: `DELETE /closet/${id}`
  - Response: `{ status: 'success', id: string }`

### 4.3 Mobile Implementation Requirements (`ItemDetailScreen.tsx`)
- **Route Params:**
  - `const route = useRoute<RouteProp<ClosetStackParamList, 'ItemDetail'>>();`
  - `const { itemId } = route.params;`
- **Navigation:**
  - `const navigation = useNavigation<NativeStackNavigationProp<ClosetStackParamList, 'ItemDetail'>>();`
- **State Management:**
  - `item: ClosetItem | null`
  - `loading: boolean`
  - `deleting: boolean`
  - `error: string | null`
- **Component Layout (Scrollable):**
  - **Hero Image:**
    - Full width with 3:4 aspect ratio container, rounded corners (`radii.lg`).
    - Image resolver fallback cascade: `item.thumbnail_data_url || item.reconstructed_image_url || item.clean_image_url || item.segmented_image_url || item.original_image_url || item.image_url`.
    - No-image fallback placeholder if empty.
  - **Header Card:**
    - Item title / name in `fonts.displayBold` (fontSize `2xl`).
    - Category & Brand badge.
  - **Attributes Card (Sectional Breakdown):**
    - Category, Sub-category, Brand.
    - Size & Color(s).
    - Dress Code, Season, Gender.
    - Material & Pattern.
    - Condition, Quality state.
    - Price & Marketplace intent (e.g. "Personal Wardrobe" / "For Sale: $X").
    - Notes & Tags (rendered as chips).
  - **Action Buttons:**
    - Destructive **Delete Item** button:
      - Triggers `Alert.alert(t('itemDetail.removeTitle', 'Delete Garment'), t('itemDetail.removeBody', 'Are you sure you want to remove this item from your closet?'), [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: handleDelete }])`.
      - `handleDelete`: Sets `deleting(true)`, calls `await api.deleteItem(itemId)`, and calls `navigation.goBack()`.
- **Loading & Error handling:**
  - Loading skeleton or `ActivityIndicator`.
  - Error banner with back navigation.

---

## 5. R3: ClosetAddScreen Investigation

### 5.1 Web Source Analysis (`apps/web/src/pages/AddItem.jsx`)
- **Total lines:** 4,499 lines.
- **Core Loop:**
  - User picks an image (or snaps a photo).
  - Enters garment attributes (title, category, color, brand, size, price, etc.).
  - Submits the form via `api.createItem(payload)`.
  - On success, redirects to `/closet`.
- **Exclusions (per user request):**
  - Camera live streaming / VisionCamera scanner is deferred to Phase 7.
  - DPP QR scanner and bulk receipt extraction are excluded.
  - A prominent "Camera scan coming soon" placeholder must be rendered for those entry modes.

### 5.2 API Endpoint & Exact Signature
- `api.createItem(body: object)` (`packages/api-client/src/closet.js:9`):
  - Request: `POST /closet`
  - Payload Shape:
    ```typescript
    {
      title: string;                   // required
      name?: string;
      category: string;                // 'Top' | 'Bottom' | 'Outerwear' | 'Full Body' | 'Footwear' | 'Accessories' | 'Underwear'
      sub_category?: string;
      brand?: string;
      size?: string;
      color?: string;
      colors?: { name: string; pct?: number }[];
      gender?: 'men' | 'women' | 'unisex' | 'kids';
      dress_code?: 'casual' | 'smart-casual' | 'business' | 'formal' | 'athletic' | 'loungewear';
      season?: string[];
      price_cents?: number;
      currency?: string;              // default 'USD'
      marketplace_intent?: 'own' | 'for_sale' | 'donate' | 'swap' | 'rent';
      source?: 'Private' | 'Shared';  // 'Private' for own
      notes?: string;
      tags?: string[];
      image_base64?: string;          // base64 data (without data:image/jpeg;base64, prefix)
      image_mime?: string;            // 'image/jpeg' | 'image/png'
    }
    ```
  - Response: `{ status: 'success', item: ClosetItem }` or `ClosetItem`

### 5.3 Mobile Image Picker Integration (`expo-image-picker`)
- Package version in `apps/mobile/package.json`: `expo-image-picker: ~16.1.4`.
- Implementation pattern:
  ```typescript
  import * as ImagePicker from 'expo-image-picker';

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library access is needed to select garment photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageMime(asset.mimeType ?? 'image/jpeg');
    }
  };
  ```

### 5.4 Form Validation (`react-hook-form` + `zod`)
- Dependencies present: `react-hook-form: ^7.56.2`, `zod: ^3.24.4`.
- Schema definition:
  ```typescript
  import { z } from 'zod';
  import { useForm, Controller } from 'react-hook-form';

  const addItemSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    category: z.string().min(1, 'Category is required'),
    color: z.string().optional(),
    brand: z.string().optional(),
    size: z.string().optional(),
    price: z.string().optional(),
    gender: z.string().optional(),
    dress_code: z.string().optional(),
    notes: z.string().optional(),
  });

  type AddItemFormData = z.infer<typeof addItemSchema>;
  ```

### 5.5 Mobile Implementation Requirements (`ClosetAddScreen.tsx`)
- **Route Params:** `route.params?.source` (`'camera' | 'manual'`).
- **Layout & Structure:**
  - **Camera Scan Placeholder:** Top card with camera/scanner icon, title "Camera Scan & Live Tag Detection", subtitle "Real-time AI scanning coming soon in Phase 7", badge "COMING SOON".
  - **Image Picker Section:**
    - If image selected: 3:4 preview card with "Change Photo" and "Remove Photo" buttons.
    - If no image: Tap-to-upload card with photo library icon and "Select Photo from Library".
  - **Form Section:**
    - Title Input (required).
    - Category Selection (horizontal scroll / chips of standard categories).
    - Color Input / chips.
    - Brand Input.
    - Size Input.
    - Price Input (number pad keyboard, formatted into cents upon submit).
    - Dress Code / Gender / Notes.
  - **Submit Button:**
    - Floating / bottom fixed button: "Save to Closet".
    - Disabled while saving; shows spinner indicator.
    - Upon success, displays success message and calls `navigation.goBack()`.

---

## 6. Helper Logic & Taxonomy Parity

### 6.1 Best Image Resolver
```typescript
export function resolveItemImage(item: any): string | null {
  if (!item) return null;
  if (item.thumbnail_data_url) return item.thumbnail_data_url;
  if (item.reconstructed_image_url) return item.reconstructed_image_url;
  if (item.clean_image_url) return item.clean_image_url;
  if (item.cutout_url) return item.cutout_url;
  if (item.segmented_image_url) return item.segmented_image_url;
  if (item.original_image_url) return item.original_image_url;
  if (item.image_url) return item.image_url;
  if (item.photo_url) return item.photo_url;
  return null;
}
```

### 6.2 Standard Categories & Enums
- **Categories:** `Top`, `Bottom`, `Outerwear`, `Full Body`, `Footwear`, `Accessories`, `Underwear` (or `all`, `top`, `bottom`, `outerwear`, `shoes`, `accessory`, `dress`).
- **Dress Codes:** `casual`, `smart-casual`, `business`, `formal`, `athletic`, `loungewear`.
- **Genders:** `men`, `women`, `unisex`, `kids`.
- **Seasons:** `spring`, `summer`, `fall`, `winter`, `all`.

---

## 7. Verification Methodology

### 7.1 Static Typing
- Run from `apps/mobile/`:
  ```bash
  node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
  ```
  Must exit with **code 0**.

### 7.2 Web App Integrity
- Run from `apps/web/`:
  ```bash
  yarn build
  ```
  Must exit with **code 0** without any regressions.

### 7.3 Constraints Checklist
- [x] TypeScript only (`.tsx`) in `apps/mobile/`.
- [x] No DOM/web APIs (`window`, `document`, `localStorage`).
- [x] Style with `StyleSheet.create()` and `@mobile/theme/tokens`.
- [x] Preserved navigation types in `apps/mobile/src/navigation/types.ts`.
- [x] Used existing API signatures in `packages/api-client/src/`.
- [x] Excluded live camera / VisionCamera; provided "Camera scan coming soon" placeholder.

---

## 8. Conclusion & Implementation Readiness

The survey is complete. All API endpoints, parameter shapes, UI interaction flows, design tokens, and validation schemas are fully documented and aligned with the requirements. The porting agents can proceed directly to implementing `ClosetScreen.tsx`, `ItemDetailScreen.tsx`, and `ClosetAddScreen.tsx` based on this specification.
