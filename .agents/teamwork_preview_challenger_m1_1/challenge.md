# Adversarial Challenge Report: ClosetScreen (Milestone M1)

**Target**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Challenger**: Challenger 1 (critic, specialist)  
**Overall Risk Assessment**: HIGH (Verdict: **REQUEST_CHANGES**)  

---

## Executive Summary

We conducted a thorough empirical stress-test of `ClosetScreen.tsx`, including TypeScript type checking, web build verification, and edge-case execution via Node.js harnesses. 

While TypeScript check (`tsc --noEmit --skipLibCheck`) and web build (`yarn build`) both passed with exit code 0, and the file size (36.1 KB) exceeds the 3 KB threshold, we identified a **critical logic bug in category filtering** when items have `null`, `undefined`, or empty string categories.

---

## Challenge Findings

### [High] Challenge 1: Category Filter Inclusion Leak on Null/Undefined/Empty Categories

- **File**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`
- **Lines**: 174–190 (`matchesCategory`)
- **Assumption Challenged**: `matchesCategory` assumes `syn.includes(rawCat)` is a safe substring search when `item.category` is falsy or empty.
- **Attack Scenario**:
  When an item has `category: null`, `category: undefined`, or `category: ""`, `rawCat` is initialized to `""`.
  In JavaScript, `syn.includes("")` evaluates to `true` for every synonym string in `CATEGORY_SYNONYMS`.
  As a result, un-categorized or newly added items without a set category match **every** category filter. When the user taps "Shoes", "Outerwear", or "Dresses", items with `category: null` are erroneously displayed.
- **Empirical Proof**:
  ```javascript
  const itemWithNoCategory = { id: '1', title: 'Mystery Item', category: null };
  console.log(matchesCategory(itemWithNoCategory, 'shoes'));     // Outputs: true (BUG)
  console.log(matchesCategory(itemWithNoCategory, 'outerwear')); // Outputs: true (BUG)
  console.log(matchesCategory(itemWithNoCategory, 'dress'));     // Outputs: true (BUG)
  ```
- **Blast Radius**: Core requirement R1 ("support filtering by at least one dimension") is corrupted; filtered views show unrelated items.
- **Mitigation / Suggested Fix**:
  Guard each string comparison so that `includes` is only evaluated when the field is non-empty:
  ```typescript
  export function matchesCategory(item: ClosetItem, selectedCategory: string): boolean {
    if (!selectedCategory || selectedCategory === 'all') return true;

    const rawCat = (item.category || '').toLowerCase().trim();
    const rawSub = (item.sub_category || '').toLowerCase().trim();
    const rawItemType = (item.item_type || '').toLowerCase().trim();

    const synonyms = CATEGORY_SYNONYMS[selectedCategory] || [selectedCategory.toLowerCase()];

    return synonyms.some(
      (syn) =>
        (Boolean(rawCat) && (rawCat.includes(syn) || syn.includes(rawCat))) ||
        (Boolean(rawSub) && (rawSub.includes(syn) || syn.includes(rawSub))) ||
        (Boolean(rawItemType) && (rawItemType.includes(syn) || syn.includes(rawItemType)))
    );
  }
  ```

---

### [Low] Challenge 2: MongoDB `_id` Key Fallback in `keyExtractor`

- **File**: `apps/mobile/src/screens/closet/ClosetScreen.tsx`
- **Line**: 345
- **Observation**: `keyExtractor` uses `(item: ClosetItem) => item.id || Math.random().toString()`.
- **Attack Scenario**: If raw items from backend endpoints return MongoDB `_id` instead of normalized `id`, `Math.random().toString()` generates a new key per render, causing unneeded re-mounts and losing image error states in FlatList.
- **Mitigation**: Update to `(item: ClosetItem) => item.id || (item as any)._id || Math.random().toString()`.

---

## Stress Test Results

| Scenario / Test Case | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| TypeScript Typecheck (`tsc --noEmit --skipLibCheck`) | Exits with code 0 | Exits with code 0 | PASS |
| Web Build Check (`yarn build` in `apps/web/`) | Exits with code 0 | Exits with code 0 | PASS |
| File size check (> 3 KB) | File size > 3072 bytes | 36,127 bytes (36.1 KB) | PASS |
| `matchesCategory({ category: null }, 'shoes')` | `false` | `true` | **FAIL** |
| `matchesCategory({ category: 'shoes' }, 'shoes')` | `true` | `true` | PASS |
| `matchesCategory({ category: 'shoes' }, 'top')` | `false` | `false` | PASS |
| `matchesSearch({ tags: ['summer'] }, 'summer')` | `true` | `true` | PASS |
| `matchesSearch({ title: null }, 'shirt')` | `false` | `false` | PASS |
| `resolveThumbnailUrl(null)` | `null` | `null` | PASS |
| `resolveThumbnailUrl({ image_url: '/img.png' })` | `https://dressapp.co/img.png` | `https://dressapp.co/img.png` | PASS |
| `resolveThumbnailUrl({ photo_url: '  ' })` | `null` | `null` | PASS |
| Offline storage fallback on network failure | Fallback to cached items | Loads from AsyncStorage cache | PASS |
| RTL layout compliance | Start/End alignment used | `start`/`end` and RTL text alignment used | PASS |

---

## Verdict

**REQUEST_CHANGES** due to Challenge 1 (`matchesCategory` inclusion leak on null/empty category fields).
