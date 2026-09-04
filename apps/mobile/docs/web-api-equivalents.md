# Web API → React Native Equivalents

Reference for DressApp screen porters. Updated as phases progress.

## Storage

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `localStorage.getItem/setItem` (token) | `expo-secure-store` `getItem` / `setItemAsync` | Ph 0 | Encrypted; synchronous read available on iOS |
| `localStorage` (user prefs, lang) | `@react-native-async-storage/async-storage` | Ph 0 | Async only; not encrypted |
| `sessionStorage` | In-memory React state | Ph 3 | No persistence needed |

## Navigation / Routing

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `window.location.href = '/login'` (401) | `CommonActions.reset({ routes: [{ name: 'Auth' }] })` | Ph 0 | Wired in `src/lib/api.ts` `onUnauthorized` |
| `window.location.href = url` (OAuth) | `expo-auth-session` + `expo-web-browser` | Ph 3 | PKCE flow; opens in-app browser |
| `react-router-dom` `useNavigate` | `useNavigation()` from `@react-navigation/native` | Ph 3 | Typed via `RootStackParamList` |
| `<Link to="...">` | `navigation.navigate(...)` | Ph 3 | — |
| `useParams()` | `useRoute<RouteType>().params` | Ph 3 | — |

## Browser APIs

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `document.visibilityState` / `visibilitychange` event | `AppState` from `react-native` | Ph 4 | `AppState.addEventListener('change', handler)` |
| `document.documentElement dir` (RTL) | `I18nManager.forceRTL()` + `expo-updates` reload | Ph 2 | See `src/lib/rtl.ts` |
| `navigator.language` | `expo-localization` `getLocales()` | Ph 2 | `Localization.getLocales()[0].languageCode` |
| `navigator.mediaDevices.getUserMedia` (camera) | `react-native-vision-camera` | Ph 7 | — |
| `navigator.serviceWorker` (Web Push) | `expo-notifications` | Deferred | Backend endpoint change needed |
| `window.atob` / `btoa` (base64) | `Buffer.from(str, 'base64')` or `expo-crypto` | Ph 0 | Hermes includes `Buffer` via polyfill |
| `window.open(url)` | `Linking.openURL(url)` from `react-native` | Ph 3 | — |
| `window.print()` | N/A | — | Omit on mobile |
| `window.scrollTo()` | `scrollViewRef.current.scrollTo()` | Ph 4 | Via `ScrollView` ref |

## Network / Streaming

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `ReadableStream.getReader()` (NDJSON) | `streamNdjson.native.js` polling fallback | Ph 0 | Metro picks `.native.js` automatically |
| Server-Sent Events (SSE) | Polling or WebSocket (Phase 4+) | Ph 4 | Stylist voice streaming |
| `fetch` with streaming body | Not supported on Hermes | — | Use the native fallback |

## UI / Styling

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| Tailwind CSS (web) | NativeWind v4 | Ph 2 | Same class names; uses `tailwind.config.js` |
| Radix UI primitives | `react-native-paper` | Ph 2 | Buttons, TextInput, Modal, FAB, etc. |
| Framer Motion | `react-native-reanimated` + `moti` | Ph 2 | `MotiView`, `useAnimatedStyle` |
| `@radix-ui/react-dialog` | `react-native-paper` `Portal` + `Modal` | Ph 3 | — |
| `@radix-ui/react-select` | `react-native-paper` `Menu` + `TouchableRipple` | Ph 4 | — |
| Google Fonts (CSS `@import`) | `expo-font` + `@expo-google-fonts/*` | Ph 2 | Loaded in `App.tsx` via `useFonts` |

## Media / Camera

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `<input type="file">` (image upload) | `expo-image-picker` | Ph 4 | `launchImageLibraryAsync` |
| `getUserMedia` (live camera) | `react-native-vision-camera` | Ph 7 | — |
| `html5-qrcode` (QR scanning) | `react-native-vision-camera` + ML Kit | Ph 7 | — |
| Web Speech API (voice input) | `expo-av` (audio recording → STT) | Ph 4 | Backend handles STT |

## Auth

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `window.location.href = authUrl` (Google OAuth) | `WebBrowser.openAuthSessionAsync(url, scheme)` | Ph 3 | `expo-web-browser` |
| OAuth callback via URL bar | Deep link `dressapp://auth/callback` | Ph 3 | Handled by `AuthCallbackScreen` |

## Payments / Commerce

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `@paypal/react-paypal-js` | `WebBrowser.openBrowserAsync('https://dressapp.co/pricing')` | Ph 6 | Mobile v1: redirect to web |

## Notifications

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `PushManager.subscribe` (VAPID) | `expo-notifications` `getExpoPushTokenAsync()` | Deferred | Backend endpoint needs updating |
| `ServiceWorkerRegistration` | N/A on native | — | Replaced by Expo notifications |

## 3D / Avatar

| Web API | RN/Expo Equivalent | Phase | Notes |
|---------|-------------------|-------|-------|
| `@react-three/fiber` (web) | `@react-three/fiber` native + `expo-gl` | Ph 7 | Deferred — complex port |
| `drei` helpers | `@react-three/drei` native subset | Ph 7 | — |

---

## File Resolution: `.native.js` Extension

Metro bundler automatically prefers files with the `.native.js` extension over `.js` when bundling for iOS/Android. This is how platform-specific implementations are selected:

```
packages/api-client/src/streamNdjson.js         ← used by webpack (web)
packages/api-client/src/streamNdjson.native.js  ← used by Metro (iOS/Android)
```

No configuration needed — Metro picks `.native.js` automatically.

---

_Last updated: Phase 0 + Phase 1A/1B + Phase 2 scaffold_
