# Mobile Foundation & Infrastructure Survey Report

**Agent**: Survey Explorer 3  
**Date**: 2026-08-17  
**Scope**: Mobile Foundation, Design Tokens, API Client Integration, Expo 53 SDK Dependencies, RTL System, and Baseline Verification

---

## Executive Summary

The `apps/mobile` workspace is configured as an **Expo SDK 53** React Native application targeting iOS and Android with Hermes JS engine. It uses a clean layered foundation:
- **Design Tokens**: Centralised tokens in `apps/mobile/src/theme/tokens.ts` bridged from web CSS variables, exposed via `useTheme()` in `apps/mobile/src/theme/index.tsx`.
- **API Client**: Cross-platform `@dressapp/api-client` initialized in `apps/mobile/src/lib/api.ts` with `expo-secure-store` for encrypted auth tokens and automatic 401 navigation resets.
- **Dependencies**: React 19.0.0, React Native 0.79.6, React Navigation 7, React Native Paper 5.13.1, Zod 3.24.4, React Hook Form 7.56.2, Expo AV 15.1.7, and Expo Image Picker 16.1.4 are installed and ready.
- **RTL Support**: Integrated through `@dressapp/i18n` with automatic `I18nManager.forceRTL()` lifecycle management in `apps/mobile/src/lib/rtl.ts`.
- **Baseline Verification**: Mobile TypeScript check (`tsc --noEmit --skipLibCheck`) exits with code 0 on the existing codebase.

---

## 1. Design Tokens & Theme Architecture

### File Locations
- Token definitions: `apps/mobile/src/theme/tokens.ts`
- Theme Context & Hook: `apps/mobile/src/theme/index.tsx`

### 1.1 Palette Structure (`lightColors` & `darkColors`)
Tokens are defined in HSL format matching `apps/web/src/index.css` CSS variables:

| Token Name | Light Theme Value | Dark Theme Value | Purpose / Usage |
|---|---|---|---|
| `background` | `hsl(40, 20%, 98%)` | `hsl(240, 10%, 8%)` | Screen background |
| `foreground` | `hsl(240, 10%, 12%)` | `hsl(40, 20%, 98%)` | Primary text |
| `card` | `hsl(0, 0%, 100%)` | `hsl(240, 8%, 11%)` | Surface / card container |
| `cardForeground` | `hsl(240, 10%, 12%)` | `hsl(40, 20%, 98%)` | Text inside cards |
| `primary` | `hsl(240, 10%, 12%)` | `hsl(40, 20%, 98%)` | Primary interactive elements |
| `primaryFg` | `hsl(40, 20%, 98%)` | `hsl(240, 10%, 12%)` | Text on primary |
| `secondary` | `hsl(40, 15%, 93%)` | `hsl(240, 8%, 16%)` | Secondary container / chips |
| `secondaryFg` | `hsl(240, 10%, 25%)` | `hsl(40, 20%, 85%)` | Text on secondary |
| `muted` | `hsl(240, 5%, 94%)` | `hsl(240, 8%, 16%)` | Subtle background / placeholders |
| `mutedFg` | `hsl(240, 5%, 45%)` | `hsl(240, 5%, 60%)` | Secondary text, captions, subtitles |
| `accent` | `hsl(174, 44%, 33%)` | `hsl(174, 46%, 38%)` | Ocean teal (primary brand accent) |
| `accentFg` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on accent |
| `brand` | `hsl(271, 81%, 56%)` | `hsl(271, 85%, 62%)` | Brand purple |
| `brandFg` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on brand purple |
| `accentGreen` | `hsl(142, 71%, 45%)` | `hsl(142, 60%, 40%)` | Success / active status |
| `accentLilac` | `hsl(270, 60%, 90%)` | `hsl(270, 40%, 25%)` | Highlight / soft badge |
| `destructive` | `hsl(0, 72%, 52%)` | `hsl(0, 70%, 45%)` | Error / delete actions |
| `destructiveFg` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Text on destructive |
| `border` | `hsl(240, 6%, 90%)` | `hsl(240, 8%, 18%)` | Component borders |
| `input` | `hsl(240, 6%, 90%)` | `hsl(240, 8%, 18%)` | Form field borders |
| `ring` | `hsl(271, 81%, 56%)` | `hsl(271, 85%, 62%)` | Focus ring |
| `persimmon` | `hsl(18, 78%, 56%)` | `hsl(18, 75%, 52%)` | Coral / warm accent |
| `seaGlass` | `hsl(170, 30%, 80%)` | `hsl(170, 25%, 35%)` | Muted teal |
| `sand` | `hsl(40, 20%, 90%)` | `hsl(40, 15%, 20%)` | Warm neutral |
| `sidebar` | `hsl(40, 20%, 97%)` | `hsl(240, 10%, 10%)` | Drawer / sidebar bg |
| `sidebarBorder` | `hsl(240, 6%, 88%)` | `hsl(240, 8%, 16%)` | Drawer border |

### 1.1 Typography
- **Font Families (`fonts`)**:
  - Headings / Display: `'PlayfairDisplay_400Regular'`, `'PlayfairDisplay_400Regular_Italic'`, `'PlayfairDisplay_700Bold'`
  - Body / UI: `'Manrope_400Regular'`, `'Manrope_500Medium'`, `'Manrope_600SemiBold'`, `'Manrope_700Bold'`, `'Manrope_800ExtraBold'`
- **Font Sizes (`fontSizes`)**:
  - `xs: 11`, `sm: 13`, `base: 15`, `md: 16`, `lg: 18`, `xl: 20`, `'2xl': 24`, `'3xl': 30`, `'4xl': 36`, `'5xl': 48`
- **Line Heights (`lineHeights`)**:
  - `tight: 1.2`, `snug: 1.35`, `normal: 1.5`, `relaxed: 1.625`

### 1.3 Spacing, Radii & Shadows
- **Spacing (`spacing`)**: Multiples of 4 (with half steps):
  - `0: 0`, `0.5: 2`, `1: 4`, `1.5: 6`, `2: 8`, `2.5: 10`, `3: 12`, `3.5: 14`, `4: 16`, `5: 20`, `6: 24`, `7: 28`, `8: 32`, `9: 36`, `10: 40`, `12: 48`, `14: 56`, `16: 64`, `20: 80`, `24: 96`
- **Border Radii (`radii`)**:
  - `none: 0`, `sm: 8`, `md: 10`, `lg: 20`, `xl: 24`, `'2xl': 28`, `'3xl': 32`, `full: 9999`
- **Shadows (`shadows`)**:
  - `sm`: elevation 1, shadowRadius 2, shadowOpacity 0.05
  - `md`: elevation 4, shadowRadius 8, shadowOpacity 0.08
  - `lg`: elevation 8, shadowRadius 16, shadowOpacity 0.10
- **Animation Durations (`duration`)**:
  - `fast: 150`, `normal: 200`, `slow: 300`, `xslow: 500`

### 1.4 Theme Hook Usage Pattern
```tsx
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';

export function ExampleScreen() {
  const { colors, isDark, toggle } = useTheme();
  // Use in dynamic stylesheet or inline styles:
  const s = makeStyles(colors);
  return <View style={s.container}><Text style={s.text}>Content</Text></View>;
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing[4],
    },
    text: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.foreground,
    },
  });
```

---

## 2. API Integration & Auth Infrastructure

### File Locations
- Mobile Adapter: `apps/mobile/src/lib/api.ts`
- Shared Client Package: `packages/api-client/src/index.js`, `client.js`, `_singleton.js`
- Streaming Native Fallback: `packages/api-client/src/streamNdjson.native.js`

### 2.1 Base URL & Environment Configuration
- Base URL is resolved dynamically:
  `const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co';`
- API prefix: `${BACKEND_URL}/api/v1`
- Request timeout: 180,000ms (3 minutes)

### 2.2 Token & Storage Handling
- **Encrypted Token Storage (`SecureStore`)**:
  - Storage key: `'dressapp.token'`
  - `getToken`: Synchronous read via `SecureStore.getItem(TOKEN_KEY)`
  - `setToken`: Asynchronous write via `SecureStore.setItemAsync(TOKEN_KEY, t)`
  - `clearToken`: Asynchronous removal via `SecureStore.deleteItemAsync(TOKEN_KEY)`
- **User Metadata Storage (`AsyncStorage`)**:
  - Storage key: `'dressapp.user'`
  - `setUser`: Asynchronous JSON write via `AsyncStorage.setItem(USER_KEY, JSON.stringify(u))`
  - `clearUser`: `AsyncStorage.removeItem(USER_KEY)`
- **Auth State Hook (`apps/mobile/src/hooks/useAuthState.ts`)**:
  - Exposes `useAuthState()` returning `{ isAuthenticated: boolean, isLoading: boolean }`
  - Exposes `emitAuthChange(authed: boolean)` event emitter to synchronize login/logout state without reload.
- **Unauthorized Interceptor (401)**:
  - When backend responds with HTTP 401, `tokenStore.clear()` is called and React Navigation resets to `{ name: 'Auth' }` via weak reference `_navigationRef`.

### 2.3 Exposed API Modules & Available Methods
The `api` export in `@mobile/lib/api` merges all endpoints:
```tsx
import { api, closet, stylist, suitcase, outfits } from '@mobile/lib/api';
```

Key method signatures relevant to the 5 target screens:

1. **Closet Module (`packages/api-client/src/closet.js`)**:
   - `listCloset(params?: { category?: string, source?: string, limit?: number, skip?: number }) -> Promise<{ items: ClosetItem[], total?: number }>`
   - `getItem(id: string) -> Promise<ClosetItem>`
   - `createItem(body: object) -> Promise<ClosetItem>`
   - `deleteItem(id: string) -> Promise<{ status: string }>`
   - `patchItem(id: string, body: object) -> Promise<ClosetItem>`
   - `analyzeItemImage(body: object) -> Promise<any>`
2. **Stylist Module (`packages/api-client/src/stylist.js`)**:
   - `stylist(formData: FormData) -> Promise<any>`
   - `stylistHistory(sessionId?: string, limit?: number) -> Promise<any>`
   - `stylistSessions() -> Promise<any>`
   - `stylistCreateSession() -> Promise<any>`
   - `stylistDeleteSession(sessionId: string) -> Promise<any>`
3. **Suitcase Module (`packages/api-client/src/suitcase.js`)**:
   - `getSuitcaseActive() -> Promise<any>`
   - `saveSuitcaseActive(body: object) -> Promise<any>`
   - `deleteSuitcaseActive(params?: object) -> Promise<any>`
   - `packSuitcase(body: object) -> Promise<any>`
   - `updateSuitcaseItemPackStatus(body: object) -> Promise<any>`
   - `deleteSuitcaseItem(itemId: string) -> Promise<any>`
   - `getSuitcaseArchive() -> Promise<any>`
4. **Streaming Utility (`streamNdjson.native.js`)**:
   - Signature: `streamNdjson(path: string, { method?: string, params?: object, body?: object, onLine?: (event: any) => void, signal?: AbortSignal, apiBase?: string, token?: string })`
   - In React Native, `streamNdjson.native.js` parses the full response body as NDJSON and fires `onLine` callbacks synchronously per line, resolving with the final event payload.

---

## 3. Dependencies & Expo 53 Packages

### 3.1 Installed Dependencies (`apps/mobile/package.json`)
The following libraries are installed and ready for immediate import:

| Package | Version | Purpose |
|---|---|---|
| `expo` | `~53.0.0` | Expo SDK 53 Runtime |
| `react` | `19.0.0` | React 19 Engine |
| `react-native` | `0.79.6` | React Native Core |
| `@react-navigation/native` | `^7.1.10` | React Navigation Core |
| `@react-navigation/native-stack` | `^7.3.21` | Native Stack Navigator |
| `@react-navigation/bottom-tabs` | `^7.3.14` | Tab Navigator |
| `react-native-paper` | `^5.13.1` | Material 3 components, Buttons, Inputs, `<Icon />` |
| `@expo/vector-icons` | `^14.1.0` | Ionicons, MaterialCommunityIcons, Feather, etc. |
| `react-hook-form` | `^7.56.2` | Form management hook |
| `zod` | `^3.24.4` | Schema validation |
| `expo-image-picker` | `~16.1.4` | Photo library image picker (`launchImageLibraryAsync`) |
| `expo-av` | `~15.1.7` | Audio recording (`Audio.Recording`) and playback |
| `expo-secure-store` | `~14.2.4` | Encrypted Keychain / Keystore storage |
| `@react-native-async-storage/async-storage` | `2.1.2` | Persistent key-value storage |
| `react-native-safe-area-context` | `5.4.0` | Safe area insets & views |
| `react-native-reanimated` | `~3.17.4` | High-performance animation driver |
| `moti` | `^0.30.0` | Declarative animations |
| `nativewind` / `tailwindcss` | `^4.1.23` / `^3.4.17` | Utility-class styling |
| `expo-font` / `@expo-google-fonts/*` | `~13.3.2` | Playfair Display & Manrope fonts |
| `expo-web-browser` | `~14.2.0` | In-app OAuth authentication sessions |
| `expo-status-bar` | `~2.2.3` | Dynamic status bar styling |
| `expo-updates` | `~0.28.18` | Dynamic app reloading (RTL changes) |

### 3.2 Icon Support & Guidelines
- `react-native-paper` includes built-in `<Icon source="hanger" size={24} color={color} />` (MaterialCommunityIcons mapping).
- `@expo/vector-icons` is bundled and provides `Ionicons`, `Feather`, `MaterialCommunityIcons`, `AntDesign`, `FontAwesome5`.
- **Note on Lucide**: `lucide-react` is installed in web, but for mobile screen implementations, use `react-native-paper` `<Icon />` or `@expo/vector-icons` to avoid bundling web DOM icon components.

### 3.3 List Rendering (`FlatList` vs `@shopify/flash-list`)
- Built-in React Native `FlatList` with `numColumns={2}` is completely compatible, zero-install, and optimal for the 2-column closet grid.
- If `@shopify/flash-list` (v1.7.6) is preferred, it is listed in Expo 53 `bundledNativeModules.json` and can be installed if necessary.

---

## 4. Internationalization & RTL Handling

### 4.1 Supported Languages & Direction
Defined in `packages/i18n/src/index.js`:
- **13 Languages**: `en`, `he` (Hebrew), `ar` (Arabic), `es`, `fr`, `de`, `it`, `pt`, `nl`, `ru`, `zh`, `ja`, `hi`
- **RTL Set**: `he`, `ar` (`isRtl('he') === true`, `isRtl('ar') === true`)

### 4.2 Mobile RTL Lifecycle (`apps/mobile/src/lib/rtl.ts`)
1. On startup, `App.tsx` calls `hydrateLanguage()` which loads persisted language from `AsyncStorage`.
2. If language changes to RTL or LTR:
   - `I18nManager.allowRTL(shouldBeRtl)`
   - `I18nManager.forceRTL(shouldBeRtl)`
   - Full bundle reload triggered via `Updates.reloadAsync()` (native) or logged in dev.

### 4.3 Direction-Aware Styling Rules for Ported Screens
1. Use Flexbox natural alignment:
   - `flexDirection: 'row'` naturally renders right-to-left when `I18nManager.isRTL` is active.
2. Use logical spacing properties:
   - Use `marginStart` / `marginEnd` instead of `marginLeft` / `marginRight`.
   - Use `paddingStart` / `paddingEnd` instead of `paddingLeft` / `paddingRight`.
   - Use `start` / `end` instead of `left` / `right` for absolute positioning.
3. Text alignment:
   - Default text alignment aligns with reading direction.
   - For explicit text alignment: `textAlign: I18nManager.isRTL ? 'right' : 'left'`.
4. Translation hook:
   - `const { t } = useTranslation();`
   - `t('closet.title', 'My Closet')`

---

## 5. Screen Architecture & Navigation Param Lists

Navigation param types are strictly locked in `apps/mobile/src/navigation/types.ts`.

### 5.1 Route Parameter Specifications

#### ClosetStackParamList
```typescript
export type ClosetStackParamList = {
  Closet: undefined;
  ItemDetail: { itemId: string };
  ClosetAdd: { source?: 'camera' | 'manual' };
};
```

#### StylistStackParamList
```typescript
export type StylistStackParamList = {
  Stylist: undefined;
};
```

#### MeStackParamList
```typescript
export type MeStackParamList = {
  Profile: undefined;
  WardrobeStats: undefined;
  Settings: undefined;
  DeleteAccount: undefined;
  Privacy: undefined;
  Terms: undefined;
  Pricing: undefined;
  Suitcase: undefined;
  TrendScout: undefined;
  ExpertsDirectory: undefined;
  Campaigns: undefined;
  CreateCampaign: undefined;
  CampaignDetail: { campaignId: string };
};
```

### 5.2 Navigation Hook Pattern for Target Screens
```typescript
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ClosetStackParamList } from '@mobile/navigation/types';

// In ClosetScreen:
const navigation = useNavigation<NativeStackNavigationProp<ClosetStackParamList, 'Closet'>>();
navigation.navigate('ItemDetail', { itemId: item.id });
navigation.navigate('ClosetAdd', { source: 'manual' });

// In ItemDetailScreen:
const route = useRoute<RouteProp<ClosetStackParamList, 'ItemDetail'>>();
const { itemId } = route.params;
navigation.goBack();
```

---

## 6. Target Screens Implementation Blueprint

| Screen | Target File | Core Interaction Loop | Key Dependencies & APIs |
|---|---|---|---|
| **R1. ClosetScreen** | `apps/mobile/src/screens/closet/ClosetScreen.tsx` | Fetch items via `closet.listCloset()`, render 2-column grid (`FlatList`), category filter bar, pull-to-refresh (`RefreshControl`), tap item → `ItemDetail`, FAB / Add button → `ClosetAdd`. | `closet.listCloset()`, `useTheme()`, `FlatList`, `RefreshControl`, `<Icon />` |
| **R2. ItemDetailScreen** | `apps/mobile/src/screens/closet/ItemDetailScreen.tsx` | Read `itemId` from route params, fetch via `closet.getItem(itemId)`, display image, name, category, color, brand, size, delete action via `closet.deleteItem(itemId)` + `navigation.goBack()`. | `closet.getItem()`, `closet.deleteItem()`, `Alert.alert`, `useTheme()`, `Button` |
| **R3. ClosetAddScreen** | `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` | Photo selection via `expo-image-picker` (`launchImageLibraryAsync`), form validation using `react-hook-form` + `zod`, fields for `name`, `category`, `color`, `brand`, `size`, submit POST to `closet.createItem()`, camera scan placeholder with "Camera scan coming soon". | `expo-image-picker`, `react-hook-form`, `zod`, `closet.createItem()`, `TextInput` |
| **R4. StylistScreen** | `apps/mobile/src/screens/stylist/StylistScreen.tsx` | Mic button with `expo-av` (`Audio.Recording`) for audio capture, submission to `stylist.stylist()`, output text region, horizontal scroll of outfit recommendation cards, camera/try-on placeholder. | `expo-av`, `streamNdjson.native.js`, `stylist`, `ScrollView`, `Card` |
| **R5. SuitcaseScreen** | `apps/mobile/src/screens/me/SuitcaseScreen.tsx` | Trip selector / active trip view via `suitcase.getSuitcaseActive()`, packing checklist with add item dialog/picker from closet and remove item via `suitcase.deleteSuitcaseItem()`, toggle item pack status via `suitcase.updateSuitcaseItemPackStatus()`, save via `suitcase.saveSuitcaseActive()`. | `suitcase`, `closet.listCloset()`, `useTheme()`, `FlatList` |

---

## 7. Baseline Verification Results

### 7.1 Mobile TypeScript Check
- **Command**: `node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck` (executed from `apps/mobile/`)
- **Status**: **PASS (Exit code 0)**
- **Errors**: 0 errors

### 7.2 Web Build Verification
- **Command**: `yarn build` (executed from `apps/web/`)
- **Status**: **PASS (Exit code 0)**

---

## 8. Summary of Actionable Recommendations for Porting Phase

1. **Colors & Styles**: Always import and invoke `const { colors } = useTheme();` and construct styles with `tokens` (`spacing`, `radii`, `fonts`, `fontSizes`).
2. **Icons**: Use `react-native-paper`'s `<Icon source="..." />` or `@expo/vector-icons` for cross-platform vector iconography.
3. **Images**: Use standard React Native `<Image source={{ uri: ... }} />` with `resizeMode="cover"`.
4. **Forms**: Use `useController` or `Controller` from `react-hook-form` with Zod validation schema for `ClosetAddScreen`.
5. **Voice Capture**: Request audio permissions via `Audio.requestPermissionsAsync()` before recording with `Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)`.
6. **No Web APIs**: Avoid all `window`, `document`, `localStorage`, `navigator` references.
7. **Type Safety**: Strictly reference `ClosetStackParamList` and `MeStackParamList` from `@mobile/navigation/types`. Do not modify navigation types.
