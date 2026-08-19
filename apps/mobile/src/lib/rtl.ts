/**
 * apps/mobile/src/lib/rtl.ts
 *
 * RTL management for DressApp mobile.
 *
 * React Native requires I18nManager.forceRTL() + a full JS bundle reload
 * for the layout direction change to take effect. This module handles that
 * lifecycle gracefully.
 *
 * Usage:
 *   import { applyRtl, getCurrentRtl } from '@mobile/lib/rtl';
 *
 *   // On app boot (read persisted language from AsyncStorage):
 *   const lang = await AsyncStorage.getItem('dressapp.lang') ?? 'en';
 *   await applyRtl(lang);  // noop if already correct
 *
 *   // On language change (called from SettingsScreen):
 *   await applyRtl(selectedLang);  // will reload if direction changes
 */

import { I18nManager, Platform } from 'react-native';
import { RTL_LANGUAGES } from '@dressapp/i18n';

/** Returns true if RTL is currently active in the JS environment. */
export function getCurrentRtl(): boolean {
  return I18nManager.isRTL;
}

/**
 * Applies RTL/LTR layout for the given language code.
 *
 * If the direction must change, calls I18nManager.forceRTL() and then
 * triggers a full reload via expo-updates. On web/dev, logs a warning
 * instead of reloading.
 *
 * @param languageCode e.g. 'he', 'ar', 'en'
 */
export async function applyRtl(languageCode: string): Promise<void> {
  const shouldBeRtl = RTL_LANGUAGES.has(languageCode);

  if (I18nManager.isRTL === shouldBeRtl) {
    // Direction is already correct — noop
    return;
  }

  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);

  // expo-updates is only available in native builds, not in web or Expo Go
  try {
    // Dynamic import so metro doesn't bundle expo-updates unnecessarily
    // in environments where it's not available (e.g. bare web).
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
  } catch (err) {
    if (__DEV__) {
      console.warn(
        `[RTL] Language changed to "${languageCode}" (RTL=${shouldBeRtl}). ` +
        'Restart the app to apply the new layout direction. ' +
        `(expo-updates not available: ${err})`
      );
    }
  }
}

/**
 * Synchronously initialise RTL without reloading.
 * Call this on the very first render, before any components mount,
 * using the persisted language from a synchronous store (e.g. MMKV).
 *
 * If you read the language asynchronously (AsyncStorage), use applyRtl()
 * instead and accept that the first render may be LTR.
 */
export function initRtlSync(languageCode: string): void {
  const shouldBeRtl = RTL_LANGUAGES.has(languageCode);
  I18nManager.allowRTL(shouldBeRtl);
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.forceRTL(shouldBeRtl);
  }
}
