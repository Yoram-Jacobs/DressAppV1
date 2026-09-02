# Investigation Plan: ClosetScreen Filter & Search Audit (Milestone M1 Iteration 2)

## Problem Statement
Challenger 1 identified a critical category filter inclusion leak (`matchesCategory({ category: null }, 'shoes') === true`) due to `syn.includes(rawCat)` where `rawCat = ""` matches any string.
Explorer 2's mission is to conduct a complete forensic audit across all filtering and search predicates in `ClosetScreen.tsx` (`searchQuery`, `tags`, `materials`, `brand`, `color`, `season`, `sub_category`, `item_type`, `group_role`, etc.) to discover all falsy/empty string matching bugs, type safety risks, or edge case failures, and recommend an airtight fix strategy without modifying the source tree.

## Investigation Scope
1. **Category Filtering (`matchesCategory`)**:
   - Empty/falsy/whitespace inputs for `category`, `sub_category`, `item_type`.
   - Reverse substring matching (`syn.includes(rawCat)`) enabling false positive inclusion for short/empty strings.
   - Non-string / object property runtime type safety (`TypeError` on `.toLowerCase()`).
   - Selected category normalization and unknown category handling.

2. **Search Matching (`matchesSearch`)**:
   - Structure of `haystack` vs DressApp's data taxonomy:
     - `item.colors` (array of `{ name, hex, pct }`) vs legacy `item.color`.
     - `item.fabric_materials` (array of `{ name, pct }`) vs legacy `item.material`.
     - `item.season` (array of strings) vs legacy string.
     - Additional user-searchable fields: `pattern`, `dress_code`, `caption`, `notes`.
   - Handling of `item.tags`:
     - Array containing object models `{ name: '...' }` stringifying to `"[object Object]"`.
     - Non-array strings (comma-separated).
     - Falsy or null elements.
   - Multi-word search handling:
     - Single substring match (`haystack.includes(needle)`) vs tokenized all-words matching (`every(token => haystack.includes(token))`).
   - Pure function crash safety when `item` or `query` is null/undefined.

3. **Key Extractor & List Performance**:
   - Unstable keys on missing `item.id` causing re-renders when backend returns MongoDB `_id`.

4. **Card UI Subtitle Metadata Formatting**:
   - Handling missing `item.color` when `item.colors` is present.
   - Guarding against non-string `category` or `brand`.

5. **Deliverables**:
   - Empirical test harness (`test_filters.js`) demonstrating all failure modes.
   - Proposed drop-in replacement snippets for `matchesCategory`, `matchesSearch`, `keyExtractor`, and card metadata.
   - Full 5-Component `handoff.md` with observations, logic chains, caveats, conclusions, and verification methods.
