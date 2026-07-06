import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import de from '../locales/de.json';
import he from '../locales/he.json';

const resources = {
  en: { translation: en },
  de: { translation: de },
  he: { translation: he }
};

// Check for stored preferred language or default browser lang
export async function detectLanguage() {
  // 1. Check Chrome Storage (Extension popup/content)
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(['preferred_language']);
      if (stored.preferred_language && resources[stored.preferred_language.toLowerCase()]) {
        return stored.preferred_language.toLowerCase();
      }
      const userState = await chrome.storage.local.get(['user']);
      if (userState.user?.preferred_language && resources[userState.user.preferred_language.toLowerCase()]) {
        return userState.user.preferred_language.toLowerCase();
      }
    }
  } catch (_) {}

  // 2. Check localStorage (Mobile/Webview context)
  try {
    const local = localStorage.getItem('dressapp.lang') || localStorage.getItem('dressapp_preferred_language');
    if (local && resources[local.toLowerCase()]) {
      return local.toLowerCase();
    }
  } catch (_) {}
  
  // 3. Fallback to Browser Navigator Language
  try {
    const nav = (navigator?.language || '').split('-')[0].toLowerCase();
    if (resources[nav]) return nav;
  } catch (_) {}

  return 'en';
}

export const isRtl = (code) => {
  const c = (code || '').toLowerCase();
  return c === 'he' || c === 'ar';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default start lang, updated dynamically below
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    react: { useSuspense: false }
  });

// Detect and apply language dynamically
void detectLanguage().then((lang) => {
  if (i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
});

export default i18n;
