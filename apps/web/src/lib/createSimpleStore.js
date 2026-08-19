import { useSyncExternalStore, useCallback } from 'react';

/**
 * createSimpleStore — A lightweight, generic pub/sub store for UI state.
 * Can optionally persist specific keys to localStorage across sessions/tabs.
 */

export function createSimpleStore(initialState, options = {}) {
  const { storageKey = null, persistKeys = null, deserialize = null } = options;
  let state = { ...initialState };

  if (storageKey && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        let parsed = JSON.parse(raw);
        if (deserialize) {
          parsed = deserialize(parsed);
        }
        state = { ...state, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load store state from localStorage:', e);
    }
  }

  const listeners = new Set();
  const getSnapshot = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    if (storageKey && typeof window !== 'undefined') {
      const handleStorage = (e) => {
        if (e.key === storageKey && e.newValue) {
          try {
            let parsed = JSON.parse(e.newValue);
            if (deserialize) parsed = deserialize(parsed);
            state = { ...state, ...parsed };
            listener();
          } catch (err) {
            console.error('Failed to parse storage event:', err);
          }
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
      };
    }
    return () => listeners.delete(listener);
  };

  const saveToStorage = () => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      let toSave = { ...state };
      if (persistKeys) {
        toSave = {};
        for (const k of persistKeys) {
          if (k in state) toSave[k] = state[k];
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save store state to localStorage:', e);
    }
  };

  const set = (updater) => {
    const nextState = typeof updater === 'function' ? updater(state) : updater;
    if (nextState && typeof nextState === 'object') {
      let hasChanges = false;
      for (const k in nextState) {
        if (state[k] !== nextState[k]) {
          hasChanges = true;
          break;
        }
      }
      if (hasChanges) {
        state = { ...state, ...nextState };
        saveToStorage();
        listeners.forEach((listener) => listener());
      }
    }
  };

  const reset = () => {
    state = { ...initialState };
    saveToStorage();
    listeners.forEach((listener) => listener());
  };

  return { getSnapshot, subscribe, set, reset };
}

export function useSimpleStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useStoreState(store, key) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const value = state[key];
  
  const setter = useCallback((updater) => {
    const nextValue = typeof updater === 'function' ? updater(store.getSnapshot()[key]) : updater;
    store.set({ [key]: nextValue });
  }, [store, key]);
  
  return [value, setter];
}
