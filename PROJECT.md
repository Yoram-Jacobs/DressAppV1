# Project: DressApp Mobile Screen Porting (Web -> Expo 53 React Native)

## Architecture
- **Framework**: Expo 53 / React Native 0.76+ / TypeScript (.tsx only)
- **Monorepo**: Turborepo containing `apps/web/`, `apps/mobile/`, `packages/api-client/`, etc.
- **Design Tokens**: `apps/mobile/src/theme/tokens.ts` accessed via `useTheme()` from `@mobile/theme`.
- **API Client**: `packages/api-client/src/index.js` exposed via `@mobile/lib/api`. Native streaming handled via `streamNdjson.native.js`.
- **Navigation**: React Navigation Native Stack (`ClosetStackParamList`, `StylistStackParamList`, `MeStackParamList`) in `apps/mobile/src/navigation/types.ts`.
- **RTL Support**: `I18nManager.isRTL` compatible layout with proper start/end alignment.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Closet Grid & Fetching | Fetch closet items via `api.listCloset()`, render 2-column `FlatList` with pull-to-refresh (`RefreshControl`), empty/loading states | M1 | R1 / Closet.jsx |
| 2 | Closet Category Filtering | Horizontal category filter chips (`All`, `Tops`, `Bottoms`, `Outerwear`, `Shoes`, `Accessories`, `Dresses`) with client-side category matching | M1 | R1 / Closet.jsx |
| 3 | Closet Navigation | Tap item card to navigate to `ItemDetail` (`itemId`); Floating Action Button (FAB) or Header button to navigate to `ClosetAdd` | M1 | R1 / Closet.jsx |
| 4 | Item Detail View | Read `{ itemId }` route params from `ClosetStackParamList`, fetch item via `api.getItem(itemId)`, display 3:4 image hero and taxonomy attributes (name, category, color, brand, size) | M2 | R2 / ItemDetail.jsx |
| 5 | Item Deletion | Delete button with confirmation `Alert.alert`, calls `api.deleteItem(itemId)`, navigates back on success | M2 | R2 / ItemDetail.jsx |
| 6 | Manual Add Item Form | Form with fields for name, category, color, brand, size using `react-hook-form` + `zod` schema validation | M3 | R3 / AddItem.jsx |
| 7 | Image Picker (Photo Library) | Gallery picker using `expo-image-picker` (`launchImageLibraryAsync`), preview selected image, upload payload | M3 | R3 / AddItem.jsx |
| 8 | Add Item Submit & Placeholder | Submit item to `api.createItem()` (or multipart upload), show "Camera scan coming soon" banner/placeholder for live camera/DPP scanner | M3 | R3 / AddItem.jsx |
| 9 | Stylist Voice Recording | Microphone button using `expo-av` (`Audio.Recording`), record audio, state machine (idle, recording, transcribing/processing) | M4 | R4 / Stylist.jsx |
| 10 | Stylist Streaming Response | Stream conversational advice using `packages/api-client/src/streamNdjson.native.js` / `api.stylist()`, display streaming text output | M4 | R4 / Stylist.jsx |
| 11 | Stylist Outfit Cards | Horizontal card carousel displaying recommended outfit items (image, title, closet match, save outfit action) | M4 | R4 / Stylist.jsx |
| 12 | Suitcase Trip Management | Create/select trip with destination, purpose, preferred style, travel dates; switch between Gathering, Reviewing, and Active modes | M5 | R5 / Suitcase.jsx |
| 13 | Suitcase Packing List | AI packing proposal generation via `api.packSuitcase()`, approve trip via `api.approveSuitcase()`, interactive checklist with `api.updateSuitcaseItemPackStatus()` | M5 | R5 / Suitcase.jsx |
| 14 | Suitcase Item Add/Remove | Add closet items to suitcase packing list, remove items via `api.deleteSuitcaseItem()`, unpack trip via `api.deleteSuitcaseActive()` | M5 | R5 / Suitcase.jsx |
| 15 | Verification & Integrity Check | TypeScript compilation exit 0, Web build exit 0, all files > 3 KB, zero backend/web modifications, strict forensic audit | M6 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | ClosetScreen | Port `apps/mobile/src/screens/closet/ClosetScreen.tsx` (Features 1, 2, 3) | Survey | DONE |
| M2 | ItemDetailScreen | Port `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` (Features 4, 5) | M1 | DONE |
| M3 | ClosetAddScreen | Port `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` (Features 6, 7, 8) | M1 | IN_PROGRESS |
| M4 | StylistScreen | Port `apps/mobile/src/screens/stylist/StylistScreen.tsx` (Features 9, 10, 11) | Survey | PLANNED |
| M5 | SuitcaseScreen | Port `apps/mobile/src/screens/me/SuitcaseScreen.tsx` (Features 12, 13, 14) | Survey | PLANNED |
| M6 | Final Verification | Full suite verification (`tsc`, web build, file size, forensic audit) (Feature 15) | M1-M5 | PLANNED |

## Interface Contracts
### ClosetStack ↔ ClosetScreen / ItemDetailScreen / ClosetAddScreen
- Route: `Closet` (no params)
- Route: `ItemDetail` with params `{ itemId: string }`
- Route: `ClosetAdd` (no params or `{ source?: 'camera' | 'manual' }`)
- Export format: Named export `export function ClosetScreen()`, `export function ItemDetailScreen()`, `export function ClosetAddScreen()` and default exports for lazy loader compatibility.

### StylistStack ↔ StylistScreen
- Route: `Stylist` (no params)
- Export format: Named export `export function StylistScreen()` and default export.

### MeStack ↔ SuitcaseScreen
- Route: `Suitcase` (no params)
- Export format: Named export `export function SuitcaseScreen()` and default export.

## Code Layout
- `apps/mobile/src/screens/closet/ClosetScreen.tsx` (Owned by M1 Worker) - COMPLETED (41.3 KB)
- `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` (Owned by M2 Worker) - COMPLETED (56.5 KB)
- `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` (Owned by M3 Worker)
- `apps/mobile/src/screens/stylist/StylistScreen.tsx` (Owned by M4 Worker)
- `apps/mobile/src/screens/me/SuitcaseScreen.tsx` (Owned by M5 Worker)
