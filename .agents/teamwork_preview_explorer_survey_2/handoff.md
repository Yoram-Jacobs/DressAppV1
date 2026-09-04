# Handoff Report: R4 StylistScreen & R5 SuitcaseScreen Porting Survey

## 1. Observation
1. **Stylist Web Implementation (`apps/web/src/pages/Stylist.jsx`)**:
   - Voice/Audio handling: Lines 1194–1256 use `webkitSpeechRecognition` or `MediaRecorder` to record audio into a webm Blob. Lines 1297–1415 construct a `FormData` object containing `voice_audio: voice.webm`, `text`, `session_id`, `language`, `lat`, `lng` and post it to `POST /api/v1/stylist` using `api.stylist(body)`.
   - Streaming/Payload: Lines 1381–1415 parse `res.advice`, extracting `reasoning_summary`, `spoken_reply`, `outfit_recommendations`, `shopping_suggestions`, `do_dont`, `weather_summary`.
   - Outfit Cards: Lines 1571–1580 render `OutfitRecommendationCard` components for each item in `m.payload.outfit_recommendations`. `OutfitRecommendationCard.jsx` (lines 50–100) fetches item images from closet by `closet_item_id` and allows saving the outfit via `api.saveOutfit(body)`.
2. **Stylist Mobile Dependencies & Native NDJSON**:
   - `expo-av` (~15.1.7) is installed in `apps/mobile/package.json` (line 27).
   - `streamNdjson.native.js` in `packages/api-client/src/streamNdjson.native.js` implements the React Native polling/fetch NDJSON handler and is auto-resolved by Metro (`apps/mobile/metro.config.js` lines 33–40).
3. **Suitcase Web Implementation (`apps/web/src/pages/Suitcase.jsx`)**:
   - State Machine: Supports `gathering` (lines 196–213), `reviewing` (lines 218–221, 509–554), and `active` (lines 557–603).
   - API endpoints used: `api.getSuitcaseActive()`, `api.saveSuitcaseActive()`, `api.deleteSuitcaseActive()`, `api.packSuitcase()`, `api.approveSuitcase()`, `api.updateSuitcaseItemPackStatus()`, `api.deleteSuitcaseItem()`, `api.getSuitcaseArchive()`.
4. **Suitcase API Adapter (`packages/api-client/src/suitcase.js`)**:
   - Lines 3–16 define 11 API methods covering active suitcase CRUD, pack generation (`/suitcase/pack`), trip approval (`/suitcase/approve`), item pack status updates (`/suitcase/items/pack-status`), item deletion (`/suitcase/items/{id}`), location simulator, archives, and chat assistant.
5. **Navigation Definitions (`apps/mobile/src/navigation/types.ts`)**:
   - Line 26: `StylistStackParamList = { Stylist: undefined }`
   - Line 47: `MeStackParamList = { ..., Suitcase: undefined, ... }`
   - `StylistStack.tsx` (line 7) and `MeStack.tsx` (line 13) import `StylistScreen` and `SuitcaseScreen` using `React.lazy` expecting default or named exports (`{ default: m.StylistScreen }` / `{ default: m.SuitcaseScreen }`).
6. **Baseline Build & Type Checks**:
   - Ran `node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck` in `apps/mobile` -> exit code 0.

## 2. Logic Chain
1. **Stylist Screen Porting (R4)**:
   - Based on Observations 1 and 2, web's Web Speech API cannot run on mobile. Replacing it with `expo-av`'s `Audio.Recording` provides native microphone recording across iOS and Android.
   - Metro bundler automatically picks `packages/api-client/src/streamNdjson.native.js` for `@dressapp/api-client` imports.
   - The conversational UI needs to show a loading state while processing voice, display the assistant response text (`reasoning_summary`), and render horizontal outfit recommendation cards with images resolved from closet items and a "Save Outfit" action. Avatar/3D try-on is explicitly omitted per project spec (Phase 7).
2. **Suitcase Screen Porting (R5)**:
   - Based on Observations 3 and 4, the web app's suitcase workflow maps directly to a 3-step mobile view:
     - **Gathering**: Form fields for destination, purpose, preferred style, dates, and notes + "Generate Packing List" button invoking `api.packSuitcase()`.
     - **Reviewing**: AI packing proposal preview with checklist items and outfits + "Approve & Pack" button invoking `api.approveSuitcase()`.
     - **Active**: Active trip display with interactive checkable packing list calling `api.updateSuitcaseItemPackStatus()`, closet item add picker, item removal calling `api.deleteSuitcaseItem()`, and "Unpack" button calling `api.deleteSuitcaseActive({ is_unpack: true })`.
   - Based on Observation 5, SuitcaseScreen lives in the `MeStack` navigation flow and does not require complex deep route params.

## 3. Caveats
- Avatar / 3D Canvas Try-On (`OutfitAvatarViewer` / `AvatarViewer`) is excluded for both screens as specified in the original request (deferred to Phase 7).
- Background location simulator in Suitcase is omitted from the core loop; location falls back to user's profile home location server-side.

## 4. Conclusion
Both R4 (StylistScreen) and R5 (SuitcaseScreen) have clear, decoupled web source reference implementations and complete API adapters in `packages/api-client`.
- **R4 (StylistScreen)** can be ported to `apps/mobile/src/screens/stylist/StylistScreen.tsx` using `expo-av` for voice recording, `api.stylist(formData)` / `streamNdjson.native.js` for response consumption, and a horizontal scroll of outfit recommendation cards.
- **R5 (SuitcaseScreen)** can be ported to `apps/mobile/src/screens/me/SuitcaseScreen.tsx` using the 3-state workflow (`gathering` -> `reviewing` -> `active`), interactive item checklist with `api.updateSuitcaseItemPackStatus`, and closet item addition/deletion.

## 5. Verification Method
1. Verify TypeScript compilation of mobile app:
   ```bash
   cd apps/mobile
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   *Expected result: Exits with code 0.*
2. Inspect target screen files to confirm complete implementation replacing stubs:
   - `apps/mobile/src/screens/stylist/StylistScreen.tsx` (implements mic button + stream output + outfit card scroll)
   - `apps/mobile/src/screens/me/SuitcaseScreen.tsx` (implements trip form + packing checklist + add/remove closet items)
