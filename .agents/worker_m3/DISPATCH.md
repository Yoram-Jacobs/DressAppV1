# DISPATCH

## 2026-08-17T10:56:19Z

You are the Worker for Milestone M3 (ClosetAddScreen).
Your working directory is: c:\DressApp_AG\.agents\worker_m3
Read ORIGINAL_REQUEST.md at c:\DressApp_AG\ORIGINAL_REQUEST.md before doing anything.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Ownership:
You EXCLUSIVELY own: `apps/mobile/src/screens/closet/ClosetAddScreen.tsx`.
Do NOT modify `backend/`, `inference-server/`, `apps/web/`, `apps/android-twa/`, `packages/`, or `apps/mobile/src/navigation/types.ts`.

Task:
Implement the complete, production-grade `apps/mobile/src/screens/closet/ClosetAddScreen.tsx` in TypeScript (replacing the stub).
Review the explorer reports in `c:\DressApp_AG\.agents\explorer_m3_1\handoff.md`, `c:\DressApp_AG\.agents\explorer_m3_2\handoff.md`, and `c:\DressApp_AG\.agents\explorer_m3_3\handoff.md`.

Key Requirements:
1. Core manual entry form:
   - Image picker via `expo-image-picker` (`launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.8, base64: true })`).
   - Image preview card (3:4 portrait aspect ratio) with change / remove photo buttons.
   - Form fields for `title` (or `name`), `category` (chips/selector for canonical 7: Top, Bottom, Outerwear, Full Body, Footwear, Accessories, Underwear), `color` (or canonical color chips + text input), `brand`, `size`, `notes`, `marketplace_intent`.
   - Form validation with `react-hook-form` + `zod` schema.
   - Submit button that calls `api.createItem(payload)` with loading indicator (`ActivityIndicator`).
   - On success: show success feedback and navigate back via `navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Closet')`.
   - On error: handle errors gracefully (e.g. 402 quota exceeded, 400 bad data, network error) with `Alert.alert`.
2. "Camera scan coming soon" placeholder:
   - For camera route source (`route.params?.source === 'camera'`) or a top segment tab, display a clean "Camera scan coming soon" banner/card (Phase 7).
3. Design tokens & styling:
   - Use `useTheme()` from `@mobile/theme` and `StyleSheet.create()`.
   - Full RTL support with `I18nManager.isRTL` or start/end layout tokens.
   - Keyboard handling with `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`) and `ScrollView` (`keyboardShouldPersistTaps="handled"`).
   - Export both named `export function ClosetAddScreen()` and default export `export default ClosetAddScreen;`.
4. Verification:
   - Run `node ..\..\node_modules\typescript\bin\tsc --noEmit --skipLibCheck` in `apps/mobile/` to verify exit code 0.
   - Ensure the file size is > 3 KB.
