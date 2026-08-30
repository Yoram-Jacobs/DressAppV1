## 2026-08-17T10:39:48Z
You are the Worker for Milestone M2 (ItemDetailScreen.tsx) in DressApp.
Your working directory is: c:\DressApp_AG\.agents\teamwork_preview_worker_m2
Working root: c:\DressApp_AG

Inputs to read:
- ORIGINAL_REQUEST.md: c:\DressApp_AG\ORIGINAL_REQUEST.md
- PROJECT.md: c:\DressApp_AG\PROJECT.md
- Explorer 1 handoff: c:\DressApp_AG\.agents\explorer_m2_1\handoff.md
- Explorer 2 handoff: c:\DressApp_AG\.agents\explorer_m2_2\handoff.md
- Explorer 3 handoff: c:\DressApp_AG\.agents\explorer_m2_3\handoff.md
- Reference mobile screen: c:\DressApp_AG\apps\mobile\src\screens\closet\ClosetScreen.tsx
- Existing stub to replace: c:\DressApp_AG\apps\mobile\src\screens\closet\ItemDetailScreen.tsx
- Web reference: c:\DressApp_AG\apps\web\src\pages\ItemDetail.jsx
- API module: c:\DressApp_AG\packages\api-client\src\closet.js and apps/mobile/src/lib/api.ts

Your Exclusive Write Ownership:
- You exclusively own and modify: `c:\DressApp_AG\apps\mobile\src\screens\closet\ItemDetailScreen.tsx`.
- Do NOT touch any other source files (forbidden: `backend/`, `inference-server/`, `apps/web/`, `apps/android-twa/`, `packages/`, `apps/mobile/src/navigation/types.ts`).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
1. Implement the complete, production-ready `apps/mobile/src/screens/closet/ItemDetailScreen.tsx`:
   - Replace the stub with a rich, fully typed React Native component (> 3 KB).
   - Read `{ itemId }` route params from `ClosetStackParamList` (`useRoute<RouteProp<ClosetStackParamList, 'ItemDetail'>>()`).
   - Fetch item data via `api.getItem(itemId)` on mount and screen focus (`useFocusEffect`).
   - Render 3:4 portrait hero image container (`aspectRatio: 3 / 4`) with image resolution priority cascade (`resolveItemImageUrl`), overlay badges, and fallback icon on error.
   - Render multi-angle garment views carousel if item has grouped members.
   - Render full taxonomy and garment attributes: Title, Brand, Category, Sub-category, Size, Color/Colors (with hex swatches), Materials/Fabrics (with percentage progress bars), Pattern, Gender, Dress Code, Season badges, Condition, Quality, Wardrobe insights (Times Worn, Cost per Wear), Notes and Tags.
   - Implement prominent destructive Delete Item button (styled with `colors.destructive`) with confirmation `Alert.alert`, calling `api.deleteItem(itemId)`, handling 404/network errors, and popping back to closet (`navigation.goBack()`) on success.
   - Handle loading states, pull-to-refresh (`RefreshControl`), network error state with retry button, and 404 item not found state.
   - Ensure RTL safety (`I18nManager.isRTL`), theme token compliance (`useTheme()`, `@mobile/theme/tokens`), and zero web DOM APIs.
   - Provide dual exports: `export function ItemDetailScreen()` and `export default ItemDetailScreen;`.
2. Verify:
   - Run `node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck` from `apps/mobile/` (must exit 0).
   - Run `yarn build` from `apps/web/` (must exit 0).
   - Check file size of `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` (> 3 KB).
3. Write your completion report to `c:\DressApp_AG\.agents\teamwork_preview_worker_m2\handoff.md`.
4. Send a message to parent when done.
