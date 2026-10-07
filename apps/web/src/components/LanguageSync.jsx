import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { isRtl, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import api from '@/lib/api';

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

/**
 * Applies the user's preferred language (or the already-selected i18n language)
 * to i18next, <html lang="..."> and <html dir="rtl|ltr">.
 *
 * Mount this once at the top of the authenticated app shell so every route
 * (including Admin) updates consistently.
 */
export const LanguageSync = () => {
  const { user, updateUserLocal } = useAuth();
  const { i18n } = useTranslation();

  // If the logged-in user has a preferred_language saved in the DB, adopt it
  // on initial session mount unless a local preference has been explicitly chosen.
  useEffect(() => {
    const rawLang = user?.preferred_language;
    const lang = typeof rawLang === 'string' ? rawLang.toLowerCase() : rawLang;
    const current = (i18n.language || 'en').split('-')[0].toLowerCase();

    let storedLang = null;
    try {
      storedLang = localStorage.getItem('dressapp.lang');
      if (storedLang) storedLang = storedLang.toLowerCase();
    } catch { /* ignore */ }

    // If local storage has an active preference that matches current i18n, honor it
    if (storedLang && SUPPORTED_CODES.has(storedLang)) {
      if (current !== storedLang) {
        i18n.changeLanguage(storedLang);
      }
      if (user && lang && lang !== storedLang) {
        api.patchMe({ preferred_language: storedLang })
          .then((updated) => { if (updateUserLocal) updateUserLocal(updated); })
          .catch(() => {});
      }
      return;
    }

    if (lang && SUPPORTED_CODES.has(lang) && current !== lang) {
      i18n.changeLanguage(lang);
      try { localStorage.setItem('dressapp.lang', lang); } catch { /* ignore */ }
    }
  }, [user?.preferred_language, i18n, user, updateUserLocal]);

  // Keep <html lang/dir> in sync with the active i18n language, and sync user.preferred_language to DB.
  useEffect(() => {
    const apply = (lng) => {
      const code = (lng || 'en').split('-')[0].toLowerCase();
      const validCode = SUPPORTED_CODES.has(code) ? code : 'en';
      const html = document.documentElement;
      html.setAttribute('lang', validCode);
      html.setAttribute('dir', isRtl(validCode) ? 'rtl' : 'ltr');
      try { localStorage.setItem('dressapp.lang', validCode); } catch { /* ignore */ }

      if (user && user.preferred_language !== validCode) {
        api.patchMe({ preferred_language: validCode })
          .then((updated) => { if (updateUserLocal) updateUserLocal(updated); })
          .catch(() => {});
      }
    };
    apply(i18n.language);
    i18n.on('languageChanged', apply);
    return () => { i18n.off('languageChanged', apply); };
  }, [i18n, user, updateUserLocal]);

  return null;
};
