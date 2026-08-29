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
  title?: string;
  headline?: string;
  description?: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  is_local?: boolean;
  city?: string;
  country?: string;
  date?: string;
}

interface TrendScoutState {
  cards: TrendCard[];
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

const STORAGE_KEY = 'dressapp_mobile_trend_scout_cache';
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
        };
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

  isFresh(): boolean {
    return Date.now() - _state.lastFetch < FRESH_MS && _state.cards.length > 0;
  },

  async prewarm(options: { language?: string; country?: string | null; gender?: string | null; force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh()) {
      return;
    }

    setState((prev) => ({ ...prev, loading: prev.cards.length === 0, error: null }));
    try {
      const res = await api.fashionScoutFeed(30, {
        language: options.language || 'en',
        country: options.country || undefined,
        gender: options.gender || undefined,
      });
      const rawList = Array.isArray(res?.cards) ? res.cards : (Array.isArray(res) ? res : []);
      const cards = rawList.map((it: any, idx: number) => ({
        ...it,
        id: it.id || `trend-${idx}`,
        title: it.title || it.headline || '',
        description: it.description || it.summary || '',
      }));

      setState((prev) => ({
        ...prev,
        cards,
        loading: false,
        lastFetch: Date.now(),
        error: null,
      }));
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
