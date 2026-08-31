# Survey Report: R4 StylistScreen & R5 SuitcaseScreen Porting Analysis

**Author**: Survey Explorer 2  
**Date**: 2026-08-17  
**Scope**: 
1. **R4: StylistScreen** (`apps/web/src/pages/Stylist.jsx` → `apps/mobile/src/screens/stylist/StylistScreen.tsx`)
2. **R5: SuitcaseScreen** (`apps/web/src/pages/Suitcase.jsx` → `apps/mobile/src/screens/me/SuitcaseScreen.tsx`)
3. **API Contracts & Streaming**: `packages/api-client/src/` (`stylist.js`, `suitcase.js`, `streamNdjson.native.js`, `outfits.js`, `closet.js`)
4. **Navigation & Theming**: `apps/mobile/src/navigation/types.ts`, `apps/mobile/src/theme/tokens.ts`, `@mobile/lib/api`

---

## 1. Executive Summary

| Screen / Feature | Web Source | Mobile Destination | Key Capabilities & Mobile Adaptation Strategy |
|---|---|---|---|
| **R4: StylistScreen** | `apps/web/src/pages/Stylist.jsx` (2,890 lines) | `apps/mobile/src/screens/stylist/StylistScreen.tsx` | Voice recording (`expo-av` `Audio.Recording`) + Text input fallback; streaming/NDJSON response consumption (`streamNdjson.native.js` / `api.stylist(formData)`); outfit suggestion cards with horizontal scroll, image resolution, and save outfit action; skip Phase 7 avatar/3D try-on. |
| **R5: SuitcaseScreen** | `apps/web/src/pages/Suitcase.jsx` (2,168 lines) | `apps/mobile/src/screens/me/SuitcaseScreen.tsx` | 3-phase trip lifecycle: **Gathering** (trip params & dates), **Reviewing** (AI-generated packing list & outfits), and **Active** (interactive checkable packing list, add/remove closet items, unpack suitcase); API methods from `packages/api-client/src/suitcase.js`. |

---

## 2. R4: StylistScreen Deep Dive

### 2.1 Web Implementation Architecture (`apps/web/src/pages/Stylist.jsx`)
- **Speech-to-Text (STT)**:
  - Lines 1194–1256: Uses Web Speech API (`createRecognition` / `webkitSpeechRecognition`) with fallback to `MediaRecorder` audio recording (`voice.webm` Blob).
  - Lines 1297–1415: `sendTurn()` packs `voice_audio` (or text), `session_id`, `language`, `lat`/`lng` into `FormData` and POSTs to `/api/v1/stylist` (`api.stylist(formData)`).
- **Stylist Response & Payload Structure**:
  - Response shape: `{ session: { id, title }, advice: StylistAdvice }`
  - `StylistAdvice`:
    - `reasoning_summary` (`string`): Conversational styling advice displayed in chat bubble.
    - `spoken_reply` (`string`): Concise text for voice synthesizer.
    - `outfit_recommendations` (`Array<OutfitRec>`):
      - `name` (`string`): e.g. "Minimalist Summer Linen"
      - `why` (`string`): Style rationale
      - `items` (`Array<{ closet_item_id: string, role: string, description: string }>`): Garments picked from closet
    - `shopping_suggestions` (`Array<string>`): Missing pieces or suggestions
    - `do_dont` (`Array<string>`): Fashion tips
    - `weather_summary` (`string`): Local weather context
    - `calendar_summary` (`string`): Event / calendar context
- **Outfit Card Component** (`apps/web/src/components/stylist/OutfitRecommendationCard.jsx`):
  - Fetches closet item images by `closet_item_id` using `api.getItem(id)` or `closetStore`.
  - Displays garment badges, reason summary, and "Save Outfit" button calling `api.saveOutfit(body)`.

### 2.2 Mobile Adaptation for StylistScreen

#### A. Voice Recording via `expo-av` (`Audio.Recording`)
```typescript
import { Audio } from 'expo-av';

// 1. Permissions & Mode Setup
const { status } = await Audio.requestPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Permission Denied', 'Microphone permission is required to record audio.');
  return;
}

await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
});

// 2. Start Recording
const recording = new Audio.Recording();
await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
await recording.startAsync();

// 3. Stop Recording & Extract URI
await recording.stopAndUnloadAsync();
const uri = recording.getURI();

// 4. Construct Multipart FormData for React Native
const formData = new FormData();
if (uri) {
  const filename = uri.split('/').pop() || 'voice.m4a';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `audio/${match[1]}` : 'audio/m4a';
  formData.append('voice_audio', {
    uri,
    name: filename,
    type,
  } as any);
}
if (sessionId) formData.append('session_id', sessionId);
if (textInput) formData.append('text', textInput);
```

#### B. Streaming & API Client Integration
- `streamNdjson.native.js` is automatically resolved by Metro when importing `streamNdjson` from `@dressapp/api-client` (or calling `api.stylist(formData)`).
- Mobile can invoke `api.stylist(formData)` for standard multipart turn submissions or `streamNdjson('/stylist', { method: 'POST', body: formData, onLine: (event) => ... })`.

#### C. Outfit Recommendation Cards UI
- Render a horizontal `<ScrollView horizontal showsHorizontalScrollIndicator={false}>` or `FlatList`.
- Each card displays:
  - Outfit title (`fonts.displayBold`, `colors.foreground`)
  - "Why" rationale (`fonts.body`, `colors.mutedFg`)
  - Garment pills/thumbnails: Grid of garment images (`Image` from `react-native`) with role tags (`top`, `bottom`, `shoes`, `outerwear`).
  - "Save Outfit" button calling `api.saveOutfit(...)`.

---

## 3. R5: SuitcaseScreen Deep Dive

### 3.1 Web Implementation Architecture (`apps/web/src/pages/Suitcase.jsx`)
`Suitcase.jsx` manages 3 distinct UX states:
1. **`gathering` (Trip Creation)**:
   - User inputs: Destination (`destinations`), Purpose (`purpose`: pleasure, business, etc.), Style (`preferred_style`: casual, formal, etc.), Departure date (`departure_time`), Return date (`return_time`), Notes (`notes`).
   - Action: "Generate Packing List" calls `api.packSuitcase(body)`.
2. **`reviewing` (AI Packing Proposal Review)**:
   - Displays AI-generated packing checklist and outfits.
   - User can add garments from closet (`handleAddFromCloset`), remove items (`handleDeleteReviewedItem`), or refine with text (`handleRefine`).
   - Action: "Approve & Pack" calls `api.approveSuitcase(body)` -> transitions to `active`.
3. **`active` (Active Trip & Packing Checklist)**:
   - Displays trip destination, date countdown, and categorized packing checklist.
   - Toggle packed status: calls `api.updateSuitcaseItemPackStatus({ packed_ids, unpacked_ids })`.
   - Remove item: calls `api.deleteSuitcaseItem(itemId)`.
   - Add item: opens closet picker and calls `api.updateSuitcaseItemPackStatus`.
   - Action: "Unpack Suitcase" calls `api.deleteSuitcaseActive({ is_unpack: true })` -> clears active suitcase and marks closet items available.

### 3.2 Backend & API Client Contract (`packages/api-client/src/suitcase.js`)
```javascript
export const suitcase = {
  getSuitcaseActive: () => client.get('/suitcase/active').then((r) => r.data),
  saveSuitcaseActive: (body) => client.post('/suitcase/active', body).then((r) => r.data),
  deleteSuitcaseActive: (params) => client.delete('/suitcase/active', { params }).then((r) => r.data),
  packSuitcase: (body) => client.post('/suitcase/pack', body).then((r) => r.data),
  approveSuitcase: (body) => client.post('/suitcase/approve', body).then((r) => r.data),
  updateSuitcaseItemPackStatus: (body) => client.post('/suitcase/items/pack-status', body).then((r) => r.data),
  deleteSuitcaseItem: (itemId) => client.delete(`/suitcase/items/${itemId}`).then((r) => r.data),
  enterSuitcaseLocation: (body) => client.post('/suitcase/enter-location', body).then((r) => r.data),
  getSuitcaseArchive: () => client.get('/suitcase/archive').then((r) => r.data),
  deleteSuitcaseArchives: (ids) => client.delete(`/suitcase/archive?ids=${ids.join(',')}`).then((r) => r.data),
  suitcaseChat: (body) => client.post('/suitcase/chat', body).then((r) => r.data),
};
```

### 3.3 Data Structures

#### A. Packing List Item
```typescript
interface PackingListItem {
  id: string;                      // ClosetItem ID or generated UUID
  title: string;                   // Item title / garment description
  category: string;                // e.g. "top", "bottom", "shoes", "accessory"
  checked: boolean;                // Packed status
  is_missing?: boolean;            // Gap item recommended to purchase/pack
  thumbnail_data_url?: string;
  clean_image_url?: string;
  original_image_url?: string;
}
```

#### B. Trip Outfit
```typescript
interface SuitcaseOutfit {
  name: string;
  day?: string;
  date?: string;
  weather?: string;
  items: Array<{
    closet_item_id?: string;
    role: string;
    description: string;
    title?: string;
  }>;
}
```

#### C. Active Suitcase Object
```typescript
interface ActiveSuitcase {
  id?: string;
  destinations: string;
  purpose: string;
  preferred_style: string;
  departure_time: string;
  return_time: string;
  notes?: string;
  status: 'gathering' | 'reviewing' | 'active';
  packing_list: PackingListItem[];
  outfits: SuitcaseOutfit[];
  missing_notes?: string;
  local_fashion_stores?: any[];
  missing_items?: any[];
}
```

---

## 4. Navigation & Routes

From `apps/mobile/src/navigation/types.ts`:
- **Stylist**:
  - `StylistStackParamList`: `{ Stylist: undefined }`
  - In `MainTabsParamList`: `StylistTab: NavigatorScreenParams<StylistStackParamList>`
- **Suitcase**:
  - `MeStackParamList`: `{ Suitcase: undefined, ... }`
  - In `MainTabsParamList`: `MeTab: NavigatorScreenParams<MeStackParamList>`

Export conventions in screens:
- `StylistScreen.tsx`: `export function StylistScreen() { ... }` and `export default StylistScreen;`
- `SuitcaseScreen.tsx`: `export function SuitcaseScreen() { ... }` and `export default SuitcaseScreen;`

---

## 5. Design System & Theming Alignment

Using tokens from `apps/mobile/src/theme/tokens.ts` & `useTheme()`:
- **Colors**:
  - Background: `colors.background` (`hsl(40, 20%, 98%)` light)
  - Cards: `colors.card` (`#ffffff` light, `hsl(240, 8%, 11%)` dark)
  - Accent / Primary CTA: `colors.accent` (`hsl(174, 44%, 33%)` ocean-teal) or `colors.brand` (purple)
  - Danger / Delete: `colors.destructive` (`hsl(0, 72%, 52%)`)
  - Border: `colors.border`
  - Text: `colors.foreground`, `colors.mutedFg`
- **Typography**:
  - Headings: `fonts.display` (`PlayfairDisplay_400Regular`), `fonts.displayBold` (`PlayfairDisplay_700Bold`)
  - Body / Controls: `fonts.body` (`Manrope_400Regular`), `fonts.bodySemiBold` (`Manrope_600SemiBold`), `fonts.bodyBold` (`Manrope_700Bold`)
- **Radii & Spacing**:
  - Buttons & Badges: `radii.md` (10), `radii.full` (9999)
  - Cards: `radii.lg` (20) or `radii.xl` (24)
  - Spacing scales: `spacing[2]` (8), `spacing[3]` (12), `spacing[4]` (16), `spacing[6]` (24)

---

## 6. Implementation Checklist & Verification Strategy

### R4: StylistScreen Checklist
- [ ] Initialize `expo-av` audio recording flow with permission checks.
- [ ] Render conversational message bubbles (User text/voice turn + Stylist response).
- [ ] Display streaming / loading state while recording or waiting for API response.
- [ ] Render horizontal scroll of outfit recommendation cards with garment images, roles, and "Save Outfit" action.
- [ ] Support text message input with Send button alongside microphone button.

### R5: SuitcaseScreen Checklist
- [ ] Check for active suitcase on mount via `api.getSuitcaseActive()`.
- [ ] Implement Gathering form (Destinations, Purpose, Style, Dates, Notes) + "Generate Packing List" button calling `api.packSuitcase`.
- [ ] Implement Reviewing screen with packing checklist and "Approve & Pack" button calling `api.approveSuitcase`.
- [ ] Implement Active trip screen with interactive checkbox toggle (`api.updateSuitcaseItemPackStatus`).
- [ ] Support adding closet items via modal picker (`api.listCloset()`) and deleting items (`api.deleteSuitcaseItem`).
- [ ] Support "Unpack Suitcase" button calling `api.deleteSuitcaseActive({ is_unpack: true })`.

### Verification Commands
```bash
# TypeScript verification (must exit 0)
cd apps/mobile
node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
```
