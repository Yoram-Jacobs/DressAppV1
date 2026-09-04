# Handoff Report — Explorer 1 (Milestone M3: ClosetAddScreen)

## 1. Observation

### Exact File Paths & Code References
1. **Web AddItem Implementation**: `apps/web/src/pages/AddItem.jsx`
   - Initial state & fields: lines 171–189 (`blankFields()`), including `name`, `title`, `category`, `sub_category`, `brand`, `size`, `color`, `colors`, `price_cents`, `currency`, `marketplace_intent`.
   - Category options: line 54:
     ```js
     const CATEGORY_OPTIONS = [
       'Top', 'Bottom', 'Outerwear', 'Full Body', 'Footwear', 'Accessories', 'Underwear',
     ];
     ```
   - Basic Info form section: lines 3804–3837, 3960–3991, 4095–4138 (`NameCaption`, `BasicTaxonomyGrid`).
   - Image conversion to Base64: lines 107–164 (`fileToBase64`).
   - Payload construction: lines 4306–4380 (`buildCreatePayload(card)`).
   - API Invocation: line 981, 1142, 1562, 2181 (`api.createItem(payload)`).

2. **API Client & Module Structure**:
   - `packages/api-client/src/items.js` does **NOT** exist.
   - `packages/api-client/src/closet.js` (lines 4–13):
     ```js
     export const closet = {
       listCloset: (params = {}) => client.get('/closet', { params }).then((r) => r.data),
       getItem: (id) => client.get(`/closet/${id}`).then((r) => r.data),
       createItem: (body) => client.post('/closet', body).then((r) => r.data),
       patchItem: (id, body) => client.patch(`/closet/${id}`, body).then((r) => r.data),
       updateItem: (id, body) => client.patch(`/closet/${id}`, body).then((r) => r.data),
       deleteItem: (id) => client.delete(`/closet/${id}`).then((r) => r.data),
       ...
     };
     ```
   - `packages/api-client/src/index.js` (lines 23, 51–71, 76): Imports `closet` from `./closet.js`, spreads `...closet` in `buildApi()`, and exports `export { closet }`.
   - `apps/mobile/src/lib/api.ts` (lines 68–78): Injects React Native adapters (SecureStore, AsyncStorage) and exports `export const api = buildApi()`, plus named export `closet`.

3. **Backend API Schema & Behavior**:
   - `backend/app/api/v1/closet.py` (lines 89–150): `CreateItemIn(BaseModel)` defines the endpoint payload with `extra="forbid"`. Required fields: `title: str`, `category: str`. Optional fields: `name`, `brand`, `size`, `color`, `colors`, `image_base64`, `image_mime`, `price_cents`, `currency`, `marketplace_intent`.
   - `backend/app/api/v1/closet.py` (lines 272–663): `POST /closet` returns HTTP 201 with the full MongoDB `ClosetItem` document upon success. Checks free tier capacity (limit 50) and returns `HTTP 402` if exceeded. Invalid base64 returns `HTTP 400`. Validation failure on required fields or enum keys returns `HTTP 422`.

4. **Taxonomies & Colors**:
   - `apps/web/src/lib/taxonomy.js` (lines 111–266): `CANONICAL_COLORS` defines standard color slugs across English, Hebrew, Russian, and Arabic (`white`, `black`, `grey`, `light_grey`, `burgundy`, `brown`, `blue`, `light_blue`, `navy`, `green`, `olive`, `yellow`, `orange`, `pink`, `purple`, `terracotta_brown`, `beige`, `cream`, `champagne_gold`, `red`, `charcoal_grey`).

5. **Mobile Environment & Theme**:
   - `apps/mobile/package.json` contains `expo-image-picker ~16.1.4`, `react-hook-form ^7.56.2`, `zod ^3.24.4`, `@dressapp/api-client *`, `@dressapp/i18n *`.
   - `apps/mobile/src/theme/tokens.ts` & `apps/mobile/src/theme/index.tsx`: Provides `useTheme()`, `lightColors`, `darkColors`, `fonts`, `fontSizes`, `spacing`, `radii`, `shadows`.
   - `apps/mobile/src/navigation/types.ts`: `ClosetStackParamList` defines `ClosetAdd: { source?: 'camera' | 'manual' }`.
   - `apps/mobile/src/screens/closet/ClosetAddScreen.tsx`: Currently an 18-line stub.

---

## 2. Logic Chain

1. **API Invocation & Method Name**:
   - Web `AddItem.jsx` calls `api.createItem(payload)`.
   - `packages/api-client/src/closet.js` implements `createItem: (body) => client.post('/closet', body).then(r => r.data)`.
   - `@dressapp/api-client` merges `closet` methods into `api`, exposed in mobile at `@mobile/lib/api`.
   - Therefore, mobile screen must invoke `api.createItem(payload)` or `closet.createItem(payload)`.

2. **Payload Structure & Media Transport**:
   - The backend `POST /closet` expects JSON content (`application/json`), not multipart `FormData`.
   - Images are passed via `image_base64` (raw or data URL string) and `image_mime` (e.g. `'image/jpeg'`).
   - `expo-image-picker` with `base64: true` directly yields `asset.base64`, `asset.uri`, and `asset.mimeType`.
   - Therefore, no external file upload endpoint or FormData wrapper is required; the image base64 is embedded directly into the JSON creation payload.

3. **Field Validation & Taxonomy Compatibility**:
   - Backend `CreateItemIn` marks `title` and `category` as mandatory, while `brand`, `size`, `color`, `price_cents`, and `marketplace_intent` are optional.
   - Valid categories strictly belong to the 7-item enum: `Top`, `Bottom`, `Outerwear`, `Full Body`, `Footwear`, `Accessories`, `Underwear`.
   - Therefore, the Zod validation schema on mobile must enforce non-empty `title` and a valid `category` enum option, while keeping other fields optional.

4. **User Experience & Scope Constraints**:
   - Requirement R3 specifies manual entry only. Live camera scanner and DPP QR scanner are excluded with a "Camera scan coming soon" placeholder.
   - On submission success, navigating back via `navigation.goBack()` returns the user to `ClosetScreen`, which auto-refreshes via `useFocusEffect`.

---

## 3. Caveats

1. **No `@hookform/resolvers` Package**:
   `apps/mobile/package.json` includes `react-hook-form` and `zod`, but not `@hookform/resolvers`. Form validation should be executed via standard `react-hook-form` validation rules (`rules={{ required: ... }}`) and/or running `ClosetAddSchema.safeParse` inside the submit handler / custom resolver to avoid adding unbundled dependencies.
2. **Quota Handling (402)**:
   Free tier users with >=50 items will receive HTTP 402 with `detail.code === "closet_capacity_exceeded"`. The mobile form must catch this error and display a user-friendly alert.
3. **No `items.js` in API Client**:
   Implementers searching for `packages/api-client/src/items.js` should look in `packages/api-client/src/closet.js`.

---

## 4. Conclusion

- **Target Screen**: `apps/mobile/src/screens/closet/ClosetAddScreen.tsx`.
- **Core Loop**:
  1. Image selection from photo library via `ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ['images'] })`.
  2. Form input for `title` (required), `category` (required selection from the 7 standard options), `brand`, `size`, and `color`.
  3. Form validation via `react-hook-form` and `zod`.
  4. Submit execution via `api.createItem({ title, category, brand, size, color, image_base64, image_mime, source: 'Private' })`.
  5. UI presentation using `@mobile/theme`, `StyleSheet.create()`, RTL compatibility (`I18nManager.isRTL`), and "Camera scan coming soon" placeholder for live camera/DPP scanner.
- All detailed mappings and code snippets are documented in `c:\DressApp_AG\.agents\explorer_m3_1\analysis.md`.

---

## 5. Verification Method

### Independent Inspection
1. Verify API client method:
   - Inspect `packages/api-client/src/closet.js` line 9 to confirm `createItem: (body) => client.post('/closet', body)`.
2. Verify Backend schema:
   - Inspect `backend/app/api/v1/closet.py` line 89 to confirm `CreateItemIn` schema.
3. Verify Categories:
   - Inspect `apps/web/src/pages/AddItem.jsx` line 54 and `backend/app/models/schemas.py`.

### Project Test Commands
```bash
# TypeScript verification (from apps/mobile/)
node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck

# Web app build verification (from apps/web/)
yarn build
```
