/**
 * apps/web/src/lib/i18n.js
 *
 * Thin web adapter around @dressapp/i18n.
 * Injects localStorage-backed persistence callbacks so the shared
 * factory doesn't reference browser APIs directly.
 *
 * All other web code that imports from '@/lib/i18n' continues to work
 * unchanged — this file re-exports everything the old module exposed.
 */
import { createI18n, SUPPORTED_LANGUAGES, RTL_LANGUAGES, isRtl } from '@dressapp/i18n';

const i18n = createI18n({
  getStoredLang: () => {
    try { return localStorage.getItem('dressapp.lang'); } catch { return null; }
  },
  setStoredLang: (lang) => {
    try { localStorage.setItem('dressapp.lang', lang); } catch { /* ignore */ }
  },
});

// Keep <html lang/dir> in sync with the active i18n language.
// (LanguageSync.jsx also does this via useEffect — this handles the
//  initial paint before React mounts.)
if (typeof document !== 'undefined') {
  const apply = (lng) => {
    const code = lng?.split('-')[0] || 'en';
    document.documentElement.setAttribute('lang', code);
    document.documentElement.setAttribute('dir', isRtl(code) ? 'rtl' : 'ltr');
  };
  apply(i18n.language);
  i18n.on('languageChanged', apply);
}

export { SUPPORTED_LANGUAGES, RTL_LANGUAGES, isRtl };
export default i18n;
