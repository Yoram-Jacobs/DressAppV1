/**
 * apps/mobile/src/lib/stores/dailySuggestionsStore.ts
 *
 * Singleton store for daily outfit recommendations and morning alert suggestions.
 * Provides instant zero-latency rendering, AsyncStorage persistence, and useSyncExternalStore subscription.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface DailyOutfitSuggestion {
  id: string;
  date: string;
  title: string;
  description?: string;
  weather_summary?: string;
  temperature?: number;
  items: any[];
  harmony_score?: number;
  reasoning?: string;
}

interface DailySuggestionsState {
  suggestion: DailyOutfitSuggestion | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

const STORAGE_KEY = 'dressapp_mobile_daily_suggestions_cache';
const FRESH_MS = 60 * 60 * 1000; // 1 hour

let _state: DailySuggestionsState = {
  suggestion: null,
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

function setState(updater: (prev: DailySuggestionsState) => DailySuggestionsState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      suggestion: _state.suggestion,
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
      if (data && data.suggestion) {
        _state = {
          ..._state,
          suggestion: data.suggestion,
          lastFetch: data.lastFetch || 0,
        };
        notify();
      }
    }
  } catch {}
})();

export const dailySuggestionsStore = {
  getSnapshot(): DailySuggestionsState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastFetch < FRESH_MS && _state.suggestion !== null;
  },

  async prewarm(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh()) {
      return;
    }

    setState((prev) => ({ ...prev, loading: !prev.suggestion, error: null }));
    try {
      const data = await api.plannerScout({ occasion: 'daily' });
      setState((prev) => ({
        ...prev,
        suggestion: data,
        loading: false,
        lastFetch: Date.now(),
        error: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load daily suggestion',
      }));
    }
  },

  reset(): void {
    _state = {
      suggestion: null,
      loading: false,
      error: null,
      lastFetch: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useDailySuggestionsStore() {
  const state = useSyncExternalStore(
    dailySuggestionsStore.subscribe,
    dailySuggestionsStore.getSnapshot,
    dailySuggestionsStore.getSnapshot
  );

  return {
    ...state,
    prewarm: dailySuggestionsStore.prewarm.bind(dailySuggestionsStore),
    reset: dailySuggestionsStore.reset.bind(dailySuggestionsStore),
  };
}
