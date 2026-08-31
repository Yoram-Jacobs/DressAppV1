/**
 * apps/mobile/src/lib/i18n.ts
 *
 * Mobile adapter for @dressapp/i18n.
 * Reads the persisted language from AsyncStorage and wires it into
 * the platform-agnostic createI18n() factory.
 *
 * NOTE: AsyncStorage reads are async, so the first render always
 * starts with the fallback language ('en'). After the language
 * is loaded, the i18n instance switches and triggers a re-render
 * via react-i18next.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createI18n, SUPPORTED_LANGUAGES, RTL_LANGUAGES, isRtl } from '@dressapp/i18n';
import { applyRtl } from './rtl';

const LANG_KEY = 'dressapp.lang';

const i18n = createI18n({
  getStoredLang: () => null, // Async read handled below — start with system default
  setStoredLang: (lang) => {
    AsyncStorage.setItem(LANG_KEY, lang).catch(console.warn);
  },
});

// After boot: restore the persisted language and apply RTL if needed.
// This runs once during app startup (called from App.tsx).
export async function hydrateLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    const targetLang = stored || 'he';
    if (targetLang !== i18n.language) {
      await i18n.changeLanguage(targetLang);
      await applyRtl(targetLang);
    }
  } catch {
    // ignore
  }
}

export { SUPPORTED_LANGUAGES, RTL_LANGUAGES, isRtl };
export default i18n;
