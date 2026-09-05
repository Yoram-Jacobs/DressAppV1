/**
 * apps/mobile/src/lib/stores/trendScoutStore.ts
 *
 * Singleton store for daily curated fashion trends & runway feeds.
 * Provides instant zero-latency rendering, AsyncStorage persistence, and useSyncExternalStore subscription.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect } from 'react';

export interface TrendCard {
  id: string;
  bucket?: string;
  category?: string;
  label?: string;
  tag?: string;
  title?: string;
  headline?: string;
  description?: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  gender?: string;
  is_local?: boolean;
  city?: string;
  country?: string;
  country_code?: string;
  date?: string;
}

interface TrendScoutState {
  cards: TrendCard[];
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

const STORAGE_KEY = 'dressapp_mobile_trend_scout_cache_v3';
const FRESH_MS = 30 * 60 * 1000; // 30 minutes

let _state: TrendScoutState = {
  cards: [],
  loading: false,
  error: null,
  lastFetch: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function setState(updater: (prev: TrendScoutState) => TrendScoutState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      cards: _state.cards,
      lastFetch: _state.lastFetch,
      cachedGender: (_state as any).cachedGender,
      cachedLanguage: (_state as any).cachedLanguage,
    })
  ).catch(() => {});
}

// Hydrate from AsyncStorage on startup
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.cards)) {
        _state = {
          ..._state,
          cards: data.cards,
          lastFetch: data.lastFetch || 0,
          cachedGender: data.cachedGender,
          cachedLanguage: data.cachedLanguage,
        } as any;
        notify();
      }
    }
  } catch {}
})();

export const trendScoutStore = {
  getSnapshot(): TrendScoutState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(gender?: string | null, language?: string | null): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const timeFresh = Date.now() - _state.lastFetch < FRESH_MS && _state.cards.length > 0;
    const genderMatch = !gender || (_state as any).cachedGender === gender;
    const langMatch = !language || (_state as any).cachedLanguage === language;
    const dayMatch = (_state as any).cachedDate === today;
    return timeFresh && genderMatch && langMatch && dayMatch;
  },

  async prewarm(options: { language?: string; country?: string | null; gender?: string | null; force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh(options.gender, options.language)) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setState((prev) => ({ ...prev, loading: prev.cards.length === 0, error: null }));
    try {
      const res = await api.fashionScoutFeed(15, {
        language: options.language || 'en',
        country: options.country || undefined,
        gender: options.gender || undefined,
      });
      const rawList = Array.isArray(res?.cards) ? res.cards : (Array.isArray(res) ? res : []);
      const cards = rawList
        .filter((it: any) => {
          const u = it?.source_url || '';
          return u.startsWith('http') && !u.includes('example.com') && !u.includes('shopisrael.com');
        })
        .map((it: any, idx: number) => {
          const rawImg = it.image_url || '';
          const isBroken = rawImg.includes('ynet-pic1.ynet.co.il') || rawImg.includes('example.com') || !rawImg.startsWith('http');
          return {
            ...it,
            id: it.id || `trend-${idx}`,
            title: it.title || it.headline || '',
            description: it.description || it.summary || '',
            image_url: isBroken ? undefined : it.image_url,
          };
        });

      setState((prev) => ({
        ...prev,
        cards,
        loading: false,
        lastFetch: Date.now(),
        cachedGender: options.gender || undefined,
        cachedLanguage: options.language || 'en',
        cachedDate: today,
        error: null,
      } as any));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load trends',
      }));
    }
  },

  reset(): void {
    _state = {
      cards: [],
      loading: false,
      error: null,
      lastFetch: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useTrendScoutStore(options: { prewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    trendScoutStore.subscribe,
    trendScoutStore.getSnapshot,
    trendScoutStore.getSnapshot
  );

  useEffect(() => {
    if (options.prewarm && !trendScoutStore.isFresh() && !state.loading && state.cards.length === 0) {
      trendScoutStore.prewarm().catch(() => {});
    }
  }, [options.prewarm, state.loading, state.cards.length]);

  return {
    ...state,
    prewarm: trendScoutStore.prewarm.bind(trendScoutStore),
    reset: trendScoutStore.reset.bind(trendScoutStore),
  };
}
