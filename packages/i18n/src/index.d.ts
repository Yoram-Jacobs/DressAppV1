import i18nBase, { i18n as I18nInstance } from 'i18next';

export interface SupportedLanguage {
  code: string;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[];
export const RTL_LANGUAGES: Set<string>;
export function isRtl(code: string): boolean;

export interface CreateI18nOptions {
  getStoredLang?: () => string | null;
  setStoredLang?: (lang: string) => void;
  defaultLang?: string;
}

export function createI18n(options?: CreateI18nOptions): I18nInstance;

export default i18nBase;
