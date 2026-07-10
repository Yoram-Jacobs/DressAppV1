import { useSyncExternalStore } from 'react';

/**
 * createSimpleStore — A lightweight, generic pub/sub store for UI state that should
 * survive component unmounts but doesn't need to be persisted to localStorage.
 * Perfect for preserving transient state like chat history or attached files when
 * a user navigates between top-level tabs.
 */

export function createSimpleStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  const getSnapshot = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const set = (updater) => {
    const nextState = typeof updater === 'function' ? updater(state) : updater;
    if (nextState !== state) {
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener());
    }
  };

  const reset = () => {
    state = initialState;
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
  const setter = (updater) => {
    const nextValue = typeof updater === 'function' ? updater(store.getSnapshot()[key]) : updater;
    store.set({ [key]: nextValue });
  };
  return [value, setter];
}
