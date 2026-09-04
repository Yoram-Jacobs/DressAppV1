# Handoff Report: Milestone M1 — ClosetScreen Investigation

**Agent:** Teamwork Explorer 1 (Milestone M1)  
**Target:** `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Handoff Type:** Hard (Task Complete)  
**Date:** 2026-08-17  

---

## 1. Observation

1. **Mobile Stub:**  
   `apps/mobile/src/screens/closet/ClosetScreen.tsx` (lines 1-18) is currently a minimal 18-line placeholder:
   ```typescript
   export function ClosetScreen() {
     return (
       <View style={styles.container}>
         <Text style={styles.title}>My Closet</Text>
         <Text style={styles.sub}>Coming soon</Text>
       </View>
     );
   }
   ```

2. **Web Implementation (`apps/web/src/pages/Closet.jsx`):**
   - **Category Synonyms (lines 56-63):**
     ```javascript
     const _CATEGORY_SYNONYMS = {
       top:        new Set(['top', 'tops']),
       bottom:     new Set(['bottom', 'bottoms']),
       outerwear:  new Set(['outerwear']),
       shoes:      new Set(['shoes', 'footwear']),
       accessory:  new Set(['accessory', 'accessories']),
       dress:      new Set(['dress', 'dresses', 'full body']),
     };
     ```
   - **Matching Category (lines 65-70):**
     ```javascript
     function _matchesCategory(item, requested) {
       if (!requested || requested === 'all') return true;
       const synonyms = _CATEGORY_SYNONYMS[requested] || new Set([requested]);
       const cat = (item?.category || '').toLowerCase();
       return synonyms.has(cat);
     }
     ```
   - **Matching Search (lines 79-90):**
     ```javascript
     function _matchesSearch(item, q) {
       if (!q) return true;
       const needle = q.trim().toLowerCase();
       if (!needle) return true;
       const haystack = [
         item?.title, item?.name, item?.category, item?.sub_category,
         item?.color, item?.brand, item?.material,
       ].filter(Boolean).join(' ').toLowerCase();
       return haystack.includes(needle);
     }
     ```
   - **Card & Aspect Ratio:** Aspect ratio is 3:4.
   - **Navigation & Routing:** Link to `/closet/:id` (ItemDetail) and button to `/closet/add`.

3. **API Client & Endpoints:**
   - `packages/api-client/src/closet.js` (lines 6-7):
     ```javascript
     listCloset: (params = {}) =>
       client.get('/closet', { params }).then((r) => r.data),
     ```
   - `apps/mobile/src/lib/api.ts` (lines 70-78): exports `api` aggregating all domain adapters.
   - `backend/app/api/v1/closet.py` (lines 2362-2433): `GET /closet` returns `{ items: items, total: total, limit: limit, skip: skip }`. It strips heavy fields and injects a 15 KB `thumbnail_data_url` (JPEG base64 data URL).

4. **Image Resolution Strategy (`apps/web/src/lib/itemImage.js` lines 15-37):**
   - Cascades: `reconstructed_image_url` (if not skipped) → `thumbnail_data_url` → `clean_image_url` → `cutout_url` → `segmented_image_url` → `image_variants` → `original_image_url` → `image_url` → `photo_url`.

5. **Navigation Types (`apps/mobile/src/navigation/types.ts` lines 18-22):**
   ```typescript
   export type ClosetStackParamList = {
     Closet: undefined;
     ItemDetail: { itemId: string };
     ClosetAdd: { source?: 'camera' | 'manual' };
   };
   ```
   `apps/mobile/src/navigation/stacks/ClosetStack.tsx` (line 8):
   ```typescript
   const ClosetScreen = React.lazy(() => import('@mobile/screens/closet/ClosetScreen').then(m => ({ default: m.ClosetScreen })));
   ```

---

## 2. Logic Chain

1. **Contract Alignment:**
   - From Observation 5, `ClosetStack.tsx` imports `ClosetScreen` via `{ default: m.ClosetScreen }`. Therefore, `ClosetScreen.tsx` MUST export `export function ClosetScreen()` as a named export AND `export default ClosetScreen`.
   - From Observation 5, navigating to item details requires `navigation.navigate('ItemDetail', { itemId: item.id })`, and adding an item requires `navigation.navigate('ClosetAdd', { source: 'manual' })`.

2. **Data Fetching & Lifecycle:**
   - From Observation 3, `api.listCloset()` calls `GET /closet` which returns an object `{ items: ClosetItem[], total?: number }` (or array `ClosetItem[]`).
   - Mobile state requires `const [items, setItems] = useState<ClosetItem[]>([])`, `const [loading, setLoading] = useState(true)`, `const [refreshing, setRefreshing] = useState(false)`, and `const [error, setError] = useState<string | null>(null)`.
   - Because items can be created in `ClosetAddScreen` or deleted in `ItemDetailScreen`, using `useFocusEffect` guarantees that when the screen gains focus, the latest closet state is fetched without requiring manual cache invalidation.

3. **Thumbnail Resolution:**
   - From Observations 3 & 4, `GET /closet` provides `thumbnail_data_url` (~15 KB data URL `data:image/jpeg;base64,...`) for fast rendering.
   - React Native's `<Image source={{ uri: resolvedUrl }} />` directly renders base64 data URLs as well as absolute `https://...` URLs.
   - The thumbnail resolver must cascade from `thumbnail_data_url` down to `photo_url`, prepending `BACKEND_URL` if a relative URL is encountered, and returning `null` when no photo exists so a placeholder icon is displayed.

4. **Filtering & Search:**
   - From Observation 2, category filtering is executed in-memory over the fetched snapshot, mapping categories (`top`, `bottom`, `outerwear`, `shoes`, `accessory`, `dress`) against synonyms in `item.category`, `item.sub_category`, and `item.item_type`.
   - Sub-items with `item.group_role === 'member'` are filtered out of the top-level grid so only individual garments or set hosts are displayed.
   - Text search performs case-insensitive substring matching against `title`, `name`, `category`, `sub_category`, `brand`, `color`, `material`, and `tags`.

5. **2-Column Responsive Grid & Design Tokens:**
   - Using `FlatList` with `numColumns={2}` and dynamic column widths `(width - padding * 2 - gap) / 2` with a 3:4 aspect ratio creates a responsive, clean mobile UI.
   - Pull-to-refresh with `RefreshControl` tied to `onRefresh` satisfies requirement R1.
   - Floating Action Button (FAB) anchored at bottom-right provides direct one-tap access to `ClosetAdd`.

---

## 3. Caveats

1. **Sub-features deferred:** Bulk select/delete, drag-to-group sets, and AI photo repair polling are advanced desktop/web features that are omitted from the core mobile loop per `ORIGINAL_REQUEST.md`.
2. **Camera capture:** Live camera and DPP scanning are excluded from ClosetAdd and deferred to Phase 7.
3. **No state persistence library required:** Mobile fetches directly from `api.listCloset()`, which is fast due to backend thumbnail pre-generation (~15 KB per item).

---

## 4. Conclusion

The investigation for Milestone M1 (`ClosetScreen.tsx`) is complete. The exact TypeScript contracts, API integration, thumbnail resolution cascade, synonym-aware filtering, search matching, pull-to-refresh lifecycle, and 2-column grid layout have been fully designed and documented in `plan.md`.

Worker M1 has all necessary specifications to implement `apps/mobile/src/screens/closet/ClosetScreen.tsx` cleanly and safely.

---

## 5. Verification Method

To verify the implementation once written by Worker M1:

1. **TypeScript Typecheck:**
   ```bash
   cd apps/mobile
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   *Expected output:* Exit code `0` with zero diagnostic errors.

2. **Web Regressions Check:**
   ```bash
   cd apps/web
   yarn build
   ```
   *Expected output:* Exit code `0`.

3. **File Size Check:**
   Verify `apps/mobile/src/screens/closet/ClosetScreen.tsx` file size exceeds 3.0 KB.

4. **Forensic Audit:**
   Ensure no files in `backend/`, `apps/web/`, or `apps/mobile/src/navigation/types.ts` were modified.
