import i18nBase from 'i18next';
import { initReactI18next } from 'react-i18next';

// ---------------------------------------------------------------------------
// Language metadata — single source of truth for web and mobile.
// ---------------------------------------------------------------------------
export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English',     englishName: 'English',             dir: 'ltr' },
  { code: 'he', nativeName: 'עברית',      englishName: 'Hebrew',              dir: 'rtl' },
  { code: 'ar', nativeName: 'العربية',    englishName: 'Arabic',              dir: 'rtl' },
  { code: 'es', nativeName: 'Español',     englishName: 'Spanish',             dir: 'ltr' },
  { code: 'fr', nativeName: 'Français',    englishName: 'French',              dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch',     englishName: 'German',              dir: 'ltr' },
  { code: 'it', nativeName: 'Italiano',    englishName: 'Italian',             dir: 'ltr' },
  { code: 'pt', nativeName: 'Português',   englishName: 'Portuguese',          dir: 'ltr' },
  { code: 'nl', nativeName: 'Nederlands',  englishName: 'Dutch',               dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский',     englishName: 'Russian',             dir: 'ltr' },
  { code: 'zh', nativeName: '中文（简体）', englishName: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'ja', nativeName: '日本語',      englishName: 'Japanese',            dir: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी',     englishName: 'Hindi',               dir: 'ltr' },
];

export const RTL_LANGUAGES = new Set(
  SUPPORTED_LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code)
);

/** Returns true if the given language code is RTL. */
export const isRtl = (code) => RTL_LANGUAGES.has(code);

// ---------------------------------------------------------------------------
// Locale JSON bundles — plain ESM imports without assertions.
// Both webpack 5 (CRA/craco) and Metro resolve JSON via their built-in loaders.
// The 'assert { type: json }' syntax is NOT needed and breaks CRA's Babel.
// ---------------------------------------------------------------------------
import en from '../locales/en.json';
import he from '../locales/he.json';
import ar from '../locales/ar.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import it from '../locales/it.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';
import hi from '../locales/hi.json';
import nl from '../locales/nl.json';

const resources = {
  en: { translation: en },
  he: { translation: he },
  ar: { translation: ar },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  ru: { translation: ru },
  zh: { translation: zh },
  ja: { translation: ja },
  hi: { translation: hi },
  nl: { translation: nl },
};

// ---------------------------------------------------------------------------
// Platform-agnostic factory.
//
// Call once at app startup with platform-specific persistence callbacks:
//
//   Web:
//     createI18n({
//       getStoredLang: () => localStorage.getItem('dressapp.lang'),
//       setStoredLang: (l) => localStorage.setItem('dressapp.lang', l),
//     })
//
//   Mobile (React Native):
//     createI18n({
//       getStoredLang: () => /* synchronously read from MMKV or persisted cache */,
//       setStoredLang: (l) => AsyncStorage.setItem('dressapp.lang', l),
//     })
//
// Returns the initialized i18next instance.
// ---------------------------------------------------------------------------

/**
 * @param {object} [options]
 * @param {() => string|null} [options.getStoredLang]  Synchronously returns persisted lang code or null.
 * @param {(lang: string) => void} [options.setStoredLang]  Persists the lang code when the user changes language.
 * @param {string} [options.defaultLang='en']
 * @returns {import('i18next').i18n}
 */
export function createI18n({ getStoredLang, setStoredLang, defaultLang = 'en' } = {}) {
  function pickInitialLanguage() {
    try {
      const stored = getStoredLang?.();
      if (stored && typeof stored === 'string') {
        const storedLower = stored.toLowerCase();
        if (resources[storedLower]) return storedLower;
      }
      // navigator.language is available on web and Hermes/JSC in RN (returns device locale)
      const nav = (typeof navigator !== 'undefined' ? navigator?.language : '') || '';
      const base = nav.split('-')[0].toLowerCase();
      if (base && resources[base]) return base;
    } catch {
      /* ignore */
    }
    return defaultLang;
  }

  const i18n = i18nBase.createInstance();

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: pickInitialLanguage(),
      fallbackLng: 'en',
      defaultNS: 'translation',
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      react: { useSuspense: false },
    });

  // If a persistence adapter was provided, write back on language change
  if (setStoredLang) {
    i18n.on('languageChanged', (lng) => {
      try { setStoredLang(lng); } catch { /* ignore */ }
    });
  }

  return i18n;
}

// ---------------------------------------------------------------------------
// Re-export the underlying i18next namespace so callers can use
// `import i18n from '@dressapp/i18n'` for direct access if needed.
// ---------------------------------------------------------------------------
export default i18nBase;
