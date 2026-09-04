/**
 * trendScoutStore — thread-safe external store for Trend Scout cards.
 *
 * Prevents continuous GET re-fetching on navigation returns.
 */
import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

const FRESH_MS = 15 * 60 * 1000; // 15 minutes cache window

let _state = {
  cards: [],
  lastSync: 0,
  lastLanguage: null,
  lastCountry: null,
  lastGender: null,
  loading: false,
  error: null,
};

const _listeners = new Set();

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  _notify();
}

export const trendScoutStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ language, country, gender, force = false } = {}) {
    const isSameParams = _state.lastLanguage === language && _state.lastCountry === country && _state.lastGender === gender;
    if (!force && isSameParams && _state.lastSync && Date.now() - _state.lastSync < FRESH_MS) {
      return _state;
    }
    _set({ loading: true, error: null });
    try {
      const res = await api.fashionScoutFeed(50, { language, country, gender });
      _set({
        cards: res?.cards || [],
        lastLanguage: language,
        lastCountry: country,
        lastGender: gender,
        lastSync: Date.now(),
      });
      return _state;
    } catch (err) {
      _set({ error: err });
      return _state;
    } finally {
      _set({ loading: false });
    }
  },

  reset() {
    _state = {
      cards: [],
      lastSync: 0,
      lastLanguage: null,
      lastCountry: null,
      lastGender: null,
      loading: false,
      error: null,
    };
    _notify();
  },
};

const _subscribe = trendScoutStore.subscribe.bind(trendScoutStore);
const _getSnapshot = trendScoutStore.getSnapshot.bind(trendScoutStore);

export const prewarmTrendScout = trendScoutStore.prewarm.bind(trendScoutStore);

export function useTrendScoutStore() {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);

  return {
    ...snap,
    prewarm: prewarmTrendScout,
  };
}
export default trendScoutStore;
