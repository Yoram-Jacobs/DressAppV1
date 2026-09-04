# Investigation Plan: ClosetScreen Audit & Strategy (Milestone M1 Iteration 2)

## 1. Objectives & Scope
Audit `apps/mobile/src/screens/closet/ClosetScreen.tsx` across four dimensions:
1. **Item Card Rendering**: Aspect ratio, thumbnail fallback cascade, badges (duplicate, polish, marketplace intent, wear count), localization/taxonomy, and image error recovery.
2. **Nullish Safety**: Guarding all item fields (`item.tags`, `item.colors`, `item.attributes`, `item.category`, `item.sub_category`, `item.wear_count`, `item.price_cents`) across filtering, search, rendering, and key extraction.
3. **Empty Filter State Messaging**: Messaging clarity, CTA button actions, and preservation of pull-to-refresh (`RefreshControl`) in empty states.
4. **Performance**: Component memoization (`React.memo`), `FlatList` virtualization parameters, search filtering efficiency, and layout stability.

## 2. Methodology & Evidence Gathering
- **Static Code Analysis**: Examine `ClosetScreen.tsx`, web reference `Closet.jsx`, taxonomy schemas in `@dressapp/i18n`, and API client in `packages/api-client/src/closet.js`.
- **Empirical Edge-Case Simulation**: Test matching algorithms with edge-case payloads (null/undefined fields, mixed array types, malformed objects) via Node.js test harness.
- **Verification Commands**:
  - TypeScript validation: `tsc --noEmit --skipLibCheck`
  - Web build check: `yarn build` in `apps/web/`
  - Execution test harness: `test_audit.mjs`

## 3. Work Breakdown
- [x] Step 1: Initial setup of DISPATCH.md, BRIEFING.md, and progress.md
- [x] Step 2: Code analysis of `ClosetScreen.tsx` vs `Closet.jsx` and Challenger 1 report
- [x] Step 3: Run TypeScript compiler check (`tsc --noEmit`) and verify clean build
- [x] Step 4: Empirical testing of `matchesCategory`, `matchesSearch`, `resolveThumbnailUrl`, and `keyExtractor`
- [x] Step 5: Draft detailed findings across the 4 audit pillars
- [x] Step 6: Formulate concrete recommended fix strategy with precise before/after diffs
- [x] Step 7: Author 5-component `handoff.md` and sync `BRIEFING.md`
- [x] Step 8: Notify parent coordinator
