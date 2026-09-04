# Plan: Milestone M1 — ClosetScreen Architecture & Implementation Specification

**Target File:** `apps/mobile/src/screens/closet/ClosetScreen.tsx`  
**Author:** Explorer 2 (Milestone M1 — ClosetScreen UI/UX & Grid Architecture)  
**Date:** 2026-08-17  
**Status:** READY FOR IMPLEMENTATION (Read-only Investigation)

---

## 1. Executive Overview & Scope

The objective of Milestone M1 is to replace the compile-safe stub in `apps/mobile/src/screens/closet/ClosetScreen.tsx` with a fully featured, production-ready React Native screen porting the core interaction loop from `apps/web/src/pages/Closet.jsx`.

### Core Interaction Loop (Scope)
1. **Data Ingestion**: Fetch wardrobe items via `api.listCloset()` on mount and during pull-to-refresh (`RefreshControl`).
2. **2-Column Responsive Grid**: Render garments in a high-performance 2-column `FlatList` with 3:4 aspect ratio cards.
3. **Category Filtering Bar**: Horizontal pill/chip filter bar (`All`, `Tops`, `Bottoms`, `Outerwear`, `Shoes`, `Accessories`, `Dresses`) with synonym-aware client-side filtering.
4. **Item Card Design**: Standardized card layout with image resolution fallback cascade, title, category/color subtext, duplicate badges, and wear counts.
5. **Navigation Hooks**:
   - Tapping an item card navigates to `ItemDetail` (`itemId: item.id`).
   - Floating Action Button (FAB) and header action navigate to `ClosetAdd` (`source: 'manual'`).
6. **State Handling**: Loading skeletons (2-column placeholder grid), empty state with CTA, error state with retry.
7. **RTL & Design System**: 100% compliant with `@mobile/theme/tokens` (`useTheme()`) and RTL-safe layout using logical properties (`start`, `end`).

---

## 2. Component Hierarchy & Layout Structure

```text
SafeAreaView (edges=['top', 'left', 'right'])
 └── View [Root Container - colors.background]
      ├── Header Component
      │    ├── Title ('Your closet' / t('closet.title'))
      │    ├── Total Count Badge ('(12)' / t('closet.total'))
      │    └── Quick Actions / Search Bar (optional text query filter)
      │
      ├── Category Filter Bar (Horizontal ScrollView)
      │    └── Filter Chips: [ All | Tops | Bottoms | Outerwear | Shoes | Accessories | Dresses ]
      │
      ├── Main Content Area
      │    ├── [Loading State]: 2-Column Skeleton Grid (6-8 cards)
      │    ├── [Empty State]: Empty Illustration / Icon + Message + "Add First Item" CTA
      │    ├── [Error State]: Error Icon + Failure Notice + Retry Button
      │    └── [Grid State]: FlatList (numColumns={2})
      │         ├── RefreshControl (tintColor=colors.accent)
      │         └── Item Card (2 per row):
      │              ├── 3:4 Aspect Ratio Container (colors.secondary)
      │              │    ├── Garment Image (resolved via fallback chain)
      │              │    ├── Duplicate Star Badge (top/end overlay)
      │              │    └── Status Badge (bottom/start overlay)
      │              └── Card Content Body (padding: spacing[3])
      │                   ├── Item Title (fonts.bodySemiBold, numberOfLines=1)
      │                   ├── Category & Color / Brand (fonts.body, numberOfLines=1)
      │                   └── Wear Count Badge (if item.wear_count > 0)
      │
      └── Floating Action Button (FAB)
           ├── Fixed at bottom-end (bottom: spacing[6], end: spacing[4])
           ├── Plus Icon / Add Garment
           └── onPress -> navigation.navigate('ClosetAdd', { source: 'manual' })
```

---

## 3. Data Flow, State Model & API Contract

### 3.1 State Schema
```typescript
interface ClosetScreenState {
  items: ClosetItem[];           // Full list fetched from API
  loading: boolean;              // Initial mount loading state
  refreshing: boolean;           // Pull-to-refresh state
  selectedCategory: string;      // Active filter category (default: 'all')
  searchQuery: string;           // Optional search text input
  error: string | null;          // API fetch error message if any
}
```

### 3.2 API Integration
- **Method**: `api.listCloset()` (`packages/api-client/src/closet.js:6`)
- **Data Normalization**:
  ```typescript
  const fetchItems = async () => {
    try {
      setError(null);
      const res = await api.listCloset();
      const list = Array.isArray(res) ? res : res?.items || [];
      // Exclude group role 'member' items if multi-view grouping is active (matching web logic)
      const visibleItems = list.filter((it: any) => it && it.group_role !== 'member');
      setItems(visibleItems);
    } catch (err: any) {
      setError(err?.message || 'Failed to load closet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  ```

### 3.3 Best Image Resolution Strategy
Garments in DressApp undergo background matting, cutout segmentation, and thumbnail caching. The mobile renderer must inspect image properties in decreasing fidelity:
```typescript
export function resolveItemImage(item: any): string | null {
  if (!item) return null;
  return (
    item.thumbnail_data_url ||
    item.reconstructed_image_url ||
    item.clean_image_url ||
    item.cutout_url ||
    item.segmented_image_url ||
    item.original_image_url ||
    item.image_url ||
    item.photo_url ||
    null
  );
}
```

---

## 4. Category Filtering & Synonym Logic

To maintain exact behavioral parity with `apps/web/src/pages/Closet.jsx` and backend query matching:

```typescript
export const CATEGORIES = [
  { id: 'all', labelKey: 'common.all', defaultLabel: 'All', icon: 'view-grid-outline' },
  { id: 'top', labelKey: 'taxonomy.categories.top', defaultLabel: 'Tops', icon: 'tshirt-crew-outline' },
  { id: 'bottom', labelKey: 'taxonomy.categories.bottom', defaultLabel: 'Bottoms', icon: 'hanger' },
  { id: 'outerwear', labelKey: 'taxonomy.categories.outerwear', defaultLabel: 'Outerwear', icon: 'coat-rack' },
  { id: 'shoes', labelKey: 'taxonomy.categories.shoes', defaultLabel: 'Shoes', icon: 'shoe-heel' },
  { id: 'accessory', labelKey: 'taxonomy.categories.accessories', defaultLabel: 'Accessories', icon: 'bag-personal-outline' },
  { id: 'dress', labelKey: 'taxonomy.categories.dress', defaultLabel: 'Dresses', icon: 'tag-outline' },
];

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  top: ['top', 'tops', 'shirt', 't-shirt', 'blouse'],
  bottom: ['bottom', 'bottoms', 'pants', 'trousers', 'jeans', 'skirt', 'shorts'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'hoodie', 'cardigan'],
  shoes: ['shoes', 'footwear', 'sneakers', 'boots', 'heels', 'sandals'],
  accessory: ['accessory', 'accessories', 'bag', 'hat', 'belt', 'jewelry', 'scarf'],
  dress: ['dress', 'dresses', 'full body', 'jumpsuit', 'suit'],
};

export function matchesCategory(item: any, category: string): boolean {
  if (!category || category === 'all') return true;
  const synonyms = CATEGORY_SYNONYMS[category] || [category];
  const itemCat = String(item?.category || '').trim().toLowerCase();
  return synonyms.some((syn) => itemCat.includes(syn) || syn.includes(itemCat));
}

export function matchesSearch(item: any, query: string): boolean {
  if (!query || !query.trim()) return true;
  const needle = query.trim().toLowerCase();
  const haystack = [
    item?.title,
    item?.name,
    item?.category,
    item?.sub_category,
    item?.color,
    item?.brand,
    item?.material,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(needle);
}
```

---

## 5. Design Tokens & Styling Specification

All styling must reference `@mobile/theme/tokens` and `useTheme()`.

### 5.1 Color Mapping
| UI Component | Token Binding | Light Mode Value | Dark Mode Value |
|---|---|---|---|
| Screen Background | `colors.background` | `hsl(40, 20%, 98%)` | `hsl(240, 10%, 8%)` |
| Primary Text / Title | `colors.foreground` | `hsl(240, 10%, 12%)` | `hsl(40, 20%, 98%)` |
| Secondary / Subtitle | `colors.mutedFg` | `hsl(240, 5%, 45%)` | `hsl(240, 5%, 60%)` |
| Item Card Surface | `colors.card` | `hsl(0, 0%, 100%)` | `hsl(240, 8%, 11%)` |
| Card Border | `colors.border` | `hsl(240, 6%, 90%)` | `hsl(240, 8%, 18%)` |
| Image Thumbnail Background | `colors.secondary` | `hsl(40, 15%, 93%)` | `hsl(240, 8%, 16%)` |
| Active Filter Chip BG | `colors.primary` | `hsl(240, 10%, 12%)` | `hsl(40, 20%, 98%)` |
| Active Filter Chip FG | `colors.primaryFg` | `hsl(40, 20%, 98%)` | `hsl(240, 10%, 12%)` |
| Inactive Filter Chip BG | `colors.card` | `hsl(0, 0%, 100%)` | `hsl(240, 8%, 11%)` |
| Accent / FAB Background | `colors.accent` | `hsl(174, 44%, 33%)` | `hsl(174, 46%, 38%)` |
| FAB Icon Foreground | `colors.accentFg` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` |
| Duplicate Badge | `colors.destructive` | `hsl(0, 72%, 52%)` | `hsl(0, 70%, 45%)` |

### 5.2 Typography & Radii
- **Header Title**: `fontFamily: fonts.displayBold`, `fontSize: fontSizes['3xl']` (30px)
- **Item Title**: `fontFamily: fonts.bodySemiBold`, `fontSize: fontSizes.sm` (13px)
- **Item Subtitle**: `fontFamily: fonts.body`, `fontSize: fontSizes.xs` (11px)
- **Chip Label**: `fontFamily: fonts.bodyMedium`, `fontSize: fontSizes.xs` (11px)
- **Card Radius**: `borderRadius: radii.lg` (20px)
- **Chip Radius**: `borderRadius: radii.full` (9999px)
- **FAB Radius**: `borderRadius: 28` (Circle)

### 5.3 2-Column Grid Layout Calculation
```typescript
const CARD_GAP = spacing[3]; // 12px
const CONTAINER_PADDING = spacing[4]; // 16px

// FlatList config
<FlatList
  data={filteredItems}
  keyExtractor={(item) => item.id}
  numColumns={2}
  columnWrapperStyle={{
    gap: CARD_GAP,
    paddingHorizontal: CONTAINER_PADDING,
    marginBottom: CARD_GAP,
  }}
  contentContainerStyle={{
    paddingTop: spacing[2],
    paddingBottom: 100, // accommodate bottom tab bar & FAB
  }}
  renderItem={({ item }) => (
    <ClosetItemCard
      item={item}
      onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
      colors={colors}
      t={t}
    />
  )}
/>
```

---

## 6. RTL (Right-to-Left) Compliance Guide

1. **Directional Padding & Positioning**:
   - Use `paddingStart` and `paddingEnd` instead of `paddingLeft` / `paddingRight`.
   - Use `marginStart` and `marginEnd` instead of `marginLeft` / `marginRight`.
   - Position badges using `top` and `end` (or `start`).
   - Position FAB with `bottom: spacing[6]`, `end: spacing[4]`.
2. **Text Alignment**:
   - Use `textAlign: 'left'` or natural start alignment. Do not hardcode right-alignment for LTR.
3. **Horizontal Category Bar**:
   - `ScrollView horizontal showsHorizontalScrollIndicator={false}` automatically handles layout direction based on system RTL.
4. **Icons**:
   - Chevron / arrow icons should mirror if directional. Plus, search, hanger, camera icons do not require flipping.

---

## 7. Implementation Blueprint for Worker

The worker agent should assemble `ClosetScreen.tsx` with these key subcomponents:

### 1. Imports
```typescript
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Icon } from 'react-native-paper';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { ClosetStackParamList } from '@mobile/navigation/types';
```

### 2. Header & Search Subcomponent
- Header with title `t('closet.title', 'Your closet')`, subtitle `t('closet.subtitle')`, and total badge `(${filteredItems.length})`.
- Collapsible or sleek search bar with search icon, clear button, and placeholder `t('closet.searchPlaceholder', 'Search your closet')`.

### 3. Filter Chips Subcomponent
- Horizontal list of pills with active indicator styling.
- Tapping toggles or switches category.

### 4. ClosetItemCard Subcomponent
- `flex: 1` width.
- 3:4 aspect ratio container with image and fallback placeholder.
- Badges: duplicate star (`item.is_duplicate`), source badge (`item.source === 'Shared'` or `item.marketplace_intent`).
- Info container: Title, category · color, wear count.

### 5. Skeleton Loading Grid Subcomponent
- Render 6 skeleton cards (2x3) with muted backgrounds and shimmer effect.

### 6. Empty State Subcomponent
- Large icon / circular container.
- Title: `t('closet.emptyTitle', 'No items yet')`.
- Subtitle: `t('closet.emptySub', 'Add your first piece to start styling.')`.
- CTA Button: `t('closet.addItem', 'Add Item')` -> `navigation.navigate('ClosetAdd', { source: 'manual' })`.

### 7. Floating Action Button (FAB) Subcomponent
- Circular elevated button with plus icon.

---

## 8. Acceptance & Verification Protocol

1. **Static Typing**:
   ```bash
   node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck
   ```
   Must exit **code 0** without any type errors.
2. **Web Build Safety**:
   ```bash
   yarn build (in apps/web/)
   ```
   Must exit **code 0** (zero regressions to shared packages or web app).
3. **File Size**:
   `apps/mobile/src/screens/closet/ClosetScreen.tsx` must be > 3 KB.
4. **Behavioral Audit**:
   - FlatList renders 2 columns with pull-to-refresh.
   - Category filter filters items in real time.
   - Tap navigates to `ItemDetail`.
   - FAB navigates to `ClosetAdd`.
   - RTL mode correctly mirrors FAB and chip alignments.
