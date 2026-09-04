# Handoff Report: Milestone M3 — ClosetAddScreen (UI, Form Validation & Image Picker)

## 1. Observation
- **Package Status**:
  - `apps/mobile/package.json` contains `"react-hook-form": "^7.56.2"`, `"zod": "^3.24.4"`, and `"expo-image-picker": "~16.1.4"`.
  - `@hookform/resolvers` is available in the monorepo root node_modules (`^5.0.1`).
  - `react-native-paper` (`^5.13.1`) is available for iconography (`Icon`) and loading states (`ActivityIndicator`).
- **Existing Files & Navigation**:
  - `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` currently contains an 18-line compile-safe stub (631 bytes).
  - `apps/mobile/src/navigation/stacks/ClosetStack.tsx:10` loads `ClosetAddScreen` lazily with modal presentation (`options={{ title: 'Add Item', presentation: 'modal' }}`).
  - `apps/mobile/src/navigation/types.ts:21` specifies route params `ClosetAdd: { source?: 'camera' | 'manual' }`.
- **Web Reference (`apps/web/src/pages/AddItem.jsx`)**:
  - Contains full web add-item workflow including image base64 conversions, category taxonomy, color taxonomy, size preferences, and `api.createItem()` payload formatting (`buildCreatePayload` at line 4306).
  - Categories: `'Top'`, `'Bottom'`, `'Outerwear'`, `'Full Body'`, `'Footwear'`, `'Accessories'`, `'Underwear'`.
- **Image Picker API (`expo-image-picker` ~16.1.4)**:
  - `requestMediaLibraryPermissionsAsync()` requests photo library permissions.
  - `launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.8, base64: true })` captures local URI and base64 string directly.

---

## 2. Logic Chain
1. **Form Validation Strategy**:
   - `zod` schema (`closetAddSchema`) validates:
     - `name`: string, min 1 char, max 100 chars (required)
     - `category`: enum (`'Top' | 'Bottom' | 'Outerwear' | 'Full Body' | 'Footwear' | 'Accessories' | 'Underwear'`) (required)
     - `color`: string, min 1 char, max 50 chars (required)
     - `brand`: string, max 60 chars (optional)
     - `size`: string, max 30 chars (optional)
     - `notes`: string, max 500 chars (optional)
     - `imageUri` / `imageBase64` / `imageMime`: image file data (optional/recommended)
   - `react-hook-form` uses `useForm<ClosetAddFormData>` with a clean Zod resolver to ensure strict type-safety and instant field-level error messages.

2. **Image Selection Strategy**:
   - `expo-image-picker` with `aspect: [3, 4]` produces standard 3:4 portrait images matching DressApp's visual identity.
   - Setting `base64: true` directly retrieves the image bytes for immediate inclusion in `api.createItem()` without requiring additional file-system read libraries.

3. **Phase 7 Scoping & "Camera Scan" Placeholder**:
   - The user request explicitly mandates manual entry for M3, excluding live camera and DPP QR scanners.
   - A segmented top tab switcher allows navigating between "Manual Form" and "Camera Scan".
   - The "Camera Scan" view displays a polished "Coming in Phase 7" card with an explanation and a direct action button to switch back to the manual form.

4. **API & Data Flow**:
   - On submit, `api.createItem(payload)` sends garment attributes to `/closet`.
   - On success, an alert or toast notifies the user, and navigation returns to `ClosetScreen`.

---

## 3. Caveats
- Camera live capture (`expo-camera` / `react-native-vision-camera`) and DPP QR scanner are intentionally excluded from M3 per `ORIGINAL_REQUEST.md` (deferred to Phase 7).
- If the user selects a non-base64 image on older platforms, a fallback to JPEG base64 encoding or local URI should be handled gracefully.

---

## 4. Conclusion
The UI, form validation, and image picker architecture for `ClosetAddScreen.tsx` is completely specified, fully compatible with existing project dependencies, and ready for immediate implementation. All design tokens, taxonomy options, Zod validation rules, and error states are mapped directly from the web application while honoring React Native and Expo 53 conventions.

---

## 5. Verification Method
1. **TypeScript Type Check**:
   ```bash
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   (Must exit with code 0).

2. **Web Build Integrity**:
   ```bash
   yarn build
   ```
   (Must exit with code 0).

3. **File Size Check**:
   Confirm `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` is >3 KB and exports both named `ClosetAddScreen` and default export for lazy loading.
