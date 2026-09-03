/**
 * apps/mobile/src/lib/stores/userStore.ts
 *
 * Singleton store for the active user's profile, avatar shape parameters,
 * scheduler settings, and credits.
 * Provides instant zero-latency rendering and background syncing.
 */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@mobile/lib/api';

export interface SubscriptionInfo {
  is_active?: boolean;
  tier?: string;
  plan_type?: string;
  expires_at?: string;
  cancelled_at?: string;
  atzmai_subscription_id?: string;
  paypal_subscription_id?: string;
  stripe_subscription_id?: string;
}

export interface UserProfile {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  subscription?: SubscriptionInfo;
  subscription_tier?: string;
  closet_capacity_bonus?: number;
  credits?: number;
  location?: string;
  city?: string;
  country?: string;
  avatar_url?: string | null;
  body_photo_url?: string | null;
  face_photo_url?: string | null;
  skin_tone?: string | null;
  avatar_shape_params?: any;
  scheduler_settings?: {
    enabled: boolean;
    frequency?: string;
    time?: string;
    style_option?: string;
    custom_style?: string;
    weekday?: string;
  };
  [key: string]: any;
}

export function getUserTier(user: UserProfile | null | undefined): string {
  if (!user) return 'free';
  const sub = user.subscription;
  if (sub && sub.is_active && sub.tier && sub.tier !== 'free') {
    return sub.tier.toLowerCase();
  }
  if (user.subscription_tier && user.subscription_tier !== 'free') {
    return user.subscription_tier.toLowerCase();
  }
  return 'free';
}

export function isUserPaid(user: UserProfile | null | undefined): boolean {
  const tier = getUserTier(user);
  return tier === 'manager' || tier === 'professional';
}

interface UserState {
  user: UserProfile | null;
  avatarParams: any | null;
  loading: boolean;
  error: string | null;
  lastSync: number;
}

const STORAGE_KEY = 'dressapp_mobile_user_store_cache';
const FRESH_MS = 5 * 60 * 1000; // 5 minutes

let _state: UserState = {
  user: null,
  avatarParams: null,
  loading: false,
  error: null,
  lastSync: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function setState(updater: (prev: UserState) => UserState) {
  _state = updater(_state);
  notify();
  // Asynchronously persist snapshot to AsyncStorage
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: _state.user,
      avatarParams: _state.avatarParams,
      lastSync: _state.lastSync,
    })
  ).catch(() => {});
}

// Hydrate from AsyncStorage on startup
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && (data.user || data.avatarParams)) {
        _state = {
          ..._state,
          user: data.user || null,
          avatarParams: data.avatarParams || null,
          lastSync: data.lastSync || 0,
        };
        notify();
      }
    }
  } catch {}
})();

export const userStore = {
  getSnapshot(): UserState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastSync < FRESH_MS && _state.user !== null;
  },

  async prewarm(options: { force?: boolean } = {}): Promise<UserState> {
    if (!options.force && this.isFresh()) {
      return _state;
    }

    setState((prev) => ({ ...prev, loading: !prev.user, error: null }));
    try {
      const [meRes, avatarRes] = await Promise.allSettled([
        api.getMe(),
        api.getAvatarParams ? api.getAvatarParams() : Promise.resolve(null),
      ]);

      const user = meRes.status === 'fulfilled' ? meRes.value : _state.user;
      const avatarParams = avatarRes.status === 'fulfilled' ? avatarRes.value : (user?.avatar_shape_params || _state.avatarParams);

      setState((prev) => ({
        ...prev,
        user,
        avatarParams,
        loading: false,
        lastSync: Date.now(),
        error: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load user profile',
      }));
    }
    return _state;
  },

  setUser(user: UserProfile): void {
    setState((prev) => ({
      ...prev,
      user: { ...(prev.user || {}), ...user },
      lastSync: Date.now(),
    }));
  },

  setAvatarParams(avatarParams: any): void {
    setState((prev) => ({
      ...prev,
      avatarParams: { ...(prev.avatarParams || {}), ...avatarParams },
      user: prev.user ? { ...prev.user, avatar_shape_params: avatarParams } : null,
      lastSync: Date.now(),
    }));
  },

  async patchUser(updates: Partial<UserProfile>): Promise<void> {
    const prevUser = _state.user;
    // Optimistic update
    this.setUser({ ...(prevUser || {}), ...updates });
    try {
      const res = await api.patchMe(updates);
      if (res) {
        this.setUser(res);
      }
    } catch (err) {
      // Rollback on failure
      if (prevUser) this.setUser(prevUser);
      throw err;
    }
  },

  reset(): void {
    _state = {
      user: null,
      avatarParams: null,
      loading: false,
      error: null,
      lastSync: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useUserStore() {
  const state = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getSnapshot
  );

  return {
    ...state,
    prewarm: userStore.prewarm.bind(userStore),
    setUser: userStore.setUser.bind(userStore),
    setAvatarParams: userStore.setAvatarParams.bind(userStore),
    patchUser: userStore.patchUser.bind(userStore),
    reset: userStore.reset.bind(userStore),
  };
}
