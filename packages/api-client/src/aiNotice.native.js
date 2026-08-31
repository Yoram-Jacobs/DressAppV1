/**
 * packages/api-client/src/aiNotice.native.js
 *
 * React Native platform-specific override for the AI key warning.
 * Metro picks this file over aiNotice.js on iOS/Android.
 * The warning is a no-op on mobile — error handling is done at the UI layer.
 */
export function showAiKeyWarningToast() {
  // No-op on React Native
  if (__DEV__) {
    console.warn('[DressApp] Gemini API key warning triggered (mobile noop)');
  }
}
