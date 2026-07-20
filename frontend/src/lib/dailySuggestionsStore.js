/**
 * dailySuggestionsStore — thread-safe external store for daily & scheduled outfit proposals.
 *
 * Prevents continuous GET re-fetching on navigation returns.
 */
import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

const FRESH_MS = 10 * 60 * 1000; // 10 minutes

let _state = {
  proposals: [],
  calendarConnected: false,
  lastSync: 0,
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

export const dailySuggestionsStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ force = false } = {}) {
    if (!force && _state.lastSync && Date.now() - _state.lastSync < FRESH_MS) {
      return _state;
    }
    _set({ loading: true, error: null });
    try {
      const [proposalsRes, calStatus] = await Promise.allSettled([
        api.listScheduledProposals ? api.listScheduledProposals() : Promise.resolve([]),
        api.calendarStatus ? api.calendarStatus() : Promise.resolve({ connected: false }),
      ]);

      const proposals = proposalsRes.status === 'fulfilled' ? (proposalsRes.value?.proposals || proposalsRes.value || []) : [];
      const calendarConnected = calStatus.status === 'fulfilled' ? !!calStatus.value?.connected : false;

      _set({
        proposals,
        calendarConnected,
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

  setProposals(proposals) {
    _set({ proposals });
  },

  reset() {
    _state = {
      proposals: [],
      calendarConnected: false,
      lastSync: 0,
      loading: false,
      error: null,
    };
    _notify();
  },
};

export function useDailySuggestionsStore() {
  const snap = useSyncExternalStore(
    dailySuggestionsStore.subscribe,
    dailySuggestionsStore.getSnapshot,
    dailySuggestionsStore.getSnapshot,
  );

  return {
    ...snap,
    prewarm: dailySuggestionsStore.prewarm.bind(dailySuggestionsStore),
    setProposals: dailySuggestionsStore.setProposals.bind(dailySuggestionsStore),
  };
}
