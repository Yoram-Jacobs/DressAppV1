/**
 * apps/mobile/src/lib/api.ts
 *
 * Mobile adapter for @dressapp/api-client.
 *
 * Injects expo-secure-store (token) and AsyncStorage (user prefs)
 * into the platform-agnostic createApiClient() factory.
 * Replaces window.location redirect with React Navigation reset.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient, buildApi } from '@dressapp/api-client';
import type { NavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '@mobile/navigation/types';
import { emitAuthChange } from './authEvents';

const TOKEN_KEY = 'dressapp.token';
const USER_KEY  = 'dressapp.user';

// Weak ref to the navigation container — set by RootNavigator on mount.
let _navigationRef: NavigationContainerRef<RootStackParamList> | null = null;

export function setNavigationRef(ref: NavigationContainerRef<RootStackParamList>): void {
  _navigationRef = ref;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co';

const { client, API_BASE, tokenStore, userStore } = createApiClient({
  // ── Token storage (SecureStore — encrypted Keychain/Keystore) ──────────
  getToken: () => {
    // SecureStore.getItem is synchronous on iOS (Keychain access)
    // and synchronous-ish on Android (SharedPreferences + Keystore).
    try { return SecureStore.getItem(TOKEN_KEY) ?? null; } catch { return null; }
  },
  setToken: (t: string) => {
    // Await the write to avoid race conditions on initial load
    return SecureStore.setItemAsync(TOKEN_KEY, t);
  },
  clearToken: () => {
    return SecureStore.deleteItemAsync(TOKEN_KEY).then(() => {
      emitAuthChange(false);
    });
  },

  // ── User preferences (AsyncStorage — not encrypted, user metadata) ─────
  getUser: () => {
    // Synchronous-style read isn't available from AsyncStorage.
    // Return null here; screens that need user data use useUser() hook instead.
    return null;
  },
  setUser: (u: object) => {
    AsyncStorage.setItem(USER_KEY, JSON.stringify(u)).catch(console.warn);
  },
  clearUser: () => {
    AsyncStorage.removeItem(USER_KEY).catch(console.warn);
  },

  // ── 401 unauthorised → navigate to Auth stack ─────────────────────────
  onUnauthorized: () => {
    emitAuthChange(false);
    if (_navigationRef?.isReady()) {
      _navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] })
      );
    }
  },

  backendUrl: BACKEND_URL,
});

export const api = buildApi();
export { client, API_BASE, tokenStore, userStore };

// Re-export individual adapters for focused screen imports
export {
  auth, users, closet, listings, transactions, stylist, outfits,
  suitcase, trends, professionals, promotions, pricing, share, avatar,
  calendar, misc, campaignApi,
} from '@dressapp/api-client';
