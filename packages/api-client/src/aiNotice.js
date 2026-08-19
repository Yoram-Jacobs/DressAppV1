/**
 * packages/api-client/src/aiNotice.js
 *
 * AI key warning toast — web-only stub in the shared package.
 * On mobile this is a no-op; the mobile app's adapter layer can
 * override this by registering its own error handler via onUnauthorized.
 *
 * The web app's craco/webpack alias resolves '@/lib/aiNotice' to the
 * full implementation in apps/web/src/lib/aiNotice.jsx.
 * On mobile (Metro), this stub is used instead.
 */

export function showAiKeyWarningToast() {
  // No-op on React Native — the warning is surfaced through the
  // standard error handling in the mobile UI layer.
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DressApp] Gemini API key warning triggered');
  }
}
