# Original User Request

## 2026-08-17T10:04:16Z

Port five core DressApp screens from the existing React 19 web app to the
Expo 53 React Native app in the same monorepo. Each screen replaces an existing
compile-safe stub. **Port the core interaction loop only** — sub-features that
depend on unported stores or complex sub-components may be stubbed inline with
a `// TODO Phase 5` comment.

Working directory: C:\DressApp_AG

Integrity mode: development

---

## Reference — read before writing any screen

- **Web source files**: `apps/web/src/pages/` — read the relevant `.jsx` file to understand the
  API calls, data shapes, and UX flow before porting.
- **API methods**: read `packages/api-client/src/<module>.js` for exact method names and
  signatures. **Do not invent method names.** The `api` object in `@mobile/lib/api` exposes
  every method from `packages/api-client/src/index.js`.
- **Design tokens**: `apps/mobile/src/theme/tokens.ts` — colors, fonts, spacing, radii.
  Use `useTheme()` from `@mobile/theme` for the active palette.
- **Navigation param lists**: `apps/mobile/src/navigation/types.ts` — use typed hooks
  (`useNavigation<...>()`, `useRoute<...>()`). Do not modify this file.
- **Expo 53 SDK bundle** (`bundledNativeModules.json`): packages like `@shopify/flash-list 1.7.6`,
  `lottie-react-native 7.2.2`, `@react-native-community/slider 4.5.6`, etc. are available to add
  to `apps/mobile/package.json` if genuinely useful. Run `yarn install` from the repo root after
  adding any. **react-native-vision-camera is excluded — camera is deferred to Phase 7.**

---

## Requirements

### R1. ClosetScreen
Replace the stub at `apps/mobile/src/screens/closet/ClosetScreen.tsx`.

Port `apps/web/src/pages/Closet.jsx` — **core loop**: fetch the user's closet items from the API,
display them in a 2-column scrollable grid using `@shopify/flash-list` or `FlatList`, and support
filtering by at least one dimension (e.g. category). Pull-to-refresh required. Tapping an item
navigates to `ItemDetail` via the `ClosetStack` navigator. A floating action button (or header
button) navigates to `ClosetAdd`.

### R2. ItemDetailScreen
Replace the stub at `apps/mobile/src/screens/closet/ItemDetailScreen.tsx`.

Port `apps/web/src/pages/ItemDetail.jsx` — **core loop**: receive `itemId` from `ClosetStack`
route params, fetch the item, display its image, name, category, color, brand, and size. Provide
a Delete button that calls the appropriate API endpoint and pops back to `ClosetScreen` on success.

### R3. ClosetAddScreen — manual form only
Replace the stub at `apps/mobile/src/screens/closet/ClosetAddScreen.tsx`.

Port the **manual / form-based** entry flow from `apps/web/src/pages/AddItem.jsx` — **core loop**:
image picker via `expo-image-picker` (photo library), form fields for name, category, color, brand,
and size using `react-hook-form` + `zod`, and a Submit button that POSTs to the API. Any
camera-live-capture or DPP scanner sections are **excluded** — show a "Camera scan coming soon"
placeholder for those UI regions.

### R4. StylistScreen — voice + streaming response
Replace the stub at `apps/mobile/src/screens/stylist/StylistScreen.tsx`.

Port `apps/web/src/pages/Stylist.jsx` — **core loop**:
- A microphone button that records the user's voice using `expo-av` (`Audio.Recording`), sends
  the audio to the backend, and shows a loading state.
- A scrollable output region that displays the streaming stylist text response. Use the existing
  `streamNdjson.native.js` module from `packages/api-client/src/` — import it directly, do not
  rewrite it.
- If the response includes outfit cards/suggestions, render them as a horizontal scroll of cards
  showing item images and names. Skip avatar/3D try-on (Phase 7).

### R5. SuitcaseScreen
Replace the stub at `apps/mobile/src/screens/me/SuitcaseScreen.tsx`.

Port `apps/web/src/pages/Suitcase.jsx` — **core loop**: allow the user to create or select a trip,
add items from their closet to the suitcase packing list, remove items, and save/submit the trip
via the API. Read `packages/api-client/src/suitcase.js` (or equivalent) for exact endpoint names.

---

## Constraints (all screens)

- **TypeScript only** (`.tsx`). No `.js` or `.jsx` in `apps/mobile/`.
- **No web APIs**: no `localStorage`, `window`, `document`, `navigator`.
- **Styling**: `StyleSheet.create()` with tokens from `@mobile/theme/tokens`. NativeWind Tailwind
  classes are available but `StyleSheet` is preferred for complex layouts.
- **RTL**: all directional layouts must work when `I18nManager.isRTL` is true.
- **Do not modify**: `backend/`, `inference-server/`, `apps/web/`, `apps/android-twa/`,
  `apps/mobile/src/navigation/types.ts`, any `packages/` files.
- **New packages**: only from the Expo 53 `bundledNativeModules.json` list. If added, run
  `yarn install` from the repo root.

---

## Verification

After writing all 5 screens, run the following commands and report the output:

```bash
# 1. TypeScript check (must exit 0) — run from apps/mobile/
node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck

# 2. Web app build check (must exit 0) — run from apps/web/
yarn build 2>&1 | Select-Object -Last 5
```

## Acceptance Criteria

### TypeScript
- [ ] `tsc --noEmit --skipLibCheck` exits **code 0** with no errors after all 5 screens are written

### Screen completeness (each must replace its stub — file size > 3 KB)
- [ ] `ClosetScreen.tsx` — renders a grid/list of closet items with at least one filter control
- [ ] `ItemDetailScreen.tsx` — shows item image + attributes + Delete button
- [ ] `ClosetAddScreen.tsx` — contains image picker + name + category fields + submit button
- [ ] `StylistScreen.tsx` — contains a microphone button and a response output region
- [ ] `SuitcaseScreen.tsx` — renders a packing list interface with add/remove capability

### No regressions
- [ ] `yarn build` in `apps/web/` exits **code 0**
- [ ] No files modified in `backend/`, `inference-server/`, or `apps/web/`
