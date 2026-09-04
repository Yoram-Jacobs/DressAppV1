/**
 * apps/mobile/src/lib/stores/outfitStore.ts
 *
 * Singleton store for the user's saved outfits and looks.
 * Provides instant zero-latency rendering, optimistic updates, and background syncing.
 * Parity with apps/web/src/lib/outfitStore.js.
 */

import { useSyncExternalStore, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@mobile/lib/api';

export interface SavedOutfitItem {
  id?: string;
  closet_item_id?: string;
  title?: string;
  name?: string;
  role?: string;
  category?: string;
  sub_category?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  color?: string;
  colors?: any[];
  [key: string]: any;
}

export interface SavedOutfit {
  id: string;
  _id?: string;
  user_id?: string;
  name?: string;
  title?: string;
  description?: string;
  occasion?: string;
  style?: string;
  matching_grade?: number;
  harmony_grade?: number;
  total_value?: number;
  times_worn?: number;
  date?: string;
  created_at?: string;
  updated_at?: string;
  usage?: {
    date?: string;
    times_worn?: number;
  };
  garments?: SavedOutfitItem[];
  items?: SavedOutfitItem[];
  palette?: Array<{ name: string; hex?: string }>;
  [key: string]: any;
}

interface OutfitState {
  items: SavedOutfit[];
  total: number;
  loading: boolean;
  error: string | null;
  lastFullSync: number;
}

const STORAGE_KEY = 'dressapp_mobile_outfits_cache';
const FRESH_MS = 5 * 60 * 1000; // 5 minutes

const _byCreatedDesc = (a: SavedOutfit, b: SavedOutfit) => {
  const ax = a?.created_at || a?.date || '';
  const bx = b?.created_at || b?.date || '';
  return ax < bx ? 1 : ax > bx ? -1 : 0;
};

let _state: OutfitState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
  lastFullSync: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function setState(updater: (prev: OutfitState) => OutfitState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      items: _state.items,
      total: _state.total,
      lastFullSync: _state.lastFullSync,
    })
  ).catch(() => {});
}

// Hydrate from AsyncStorage on startup
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.items)) {
        _state = {
          ..._state,
          items: data.items,
          total: data.total || data.items.length,
          lastFullSync: data.lastFullSync || 0,
        };
        notify();
      }
    }
  } catch {}
})();

export const outfitStore = {
  getSnapshot(): OutfitState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastFullSync < FRESH_MS && _state.items.length > 0;
  },

  async prewarm(options: { force?: boolean } = {}): Promise<SavedOutfit[]> {
    if (!options.force && this.isFresh()) {
      return _state.items;
    }

    setState((prev) => ({ ...prev, loading: prev.items.length === 0, error: null }));
    try {
      const res = await api.listSavedOutfits();
      const rawList = Array.isArray(res) ? res : (res?.outfits || []);
      const items: SavedOutfit[] = rawList
        .filter(Boolean)
        .map((it: any) => ({
          ...it,
          id: String(it.id || it._id || `outfit_${Date.now()}_${Math.random()}`),
        }))
        .sort(_byCreatedDesc);

      setState((prev) => ({
        ...prev,
        items,
        total: res?.total || items.length,
        loading: false,
        lastFullSync: Date.now(),
        error: null,
      }));
      return items;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load saved outfits',
      }));
      return _state.items;
    }
  },

  upsert(outfit: SavedOutfit): void {
    if (!outfit || !outfit.id) return;
    setState((prev) => {
      const idx = prev.items.findIndex((x) => x.id === outfit.id);
      let nextItems: SavedOutfit[];
      if (idx >= 0) {
        nextItems = [...prev.items];
        nextItems[idx] = { ...nextItems[idx], ...outfit };
      } else {
        nextItems = [outfit, ...prev.items];
      }
      nextItems.sort(_byCreatedDesc);
      return {
        ...prev,
        items: nextItems,
        total: nextItems.length,
      };
    });
  },

  remove(outfitId: string): void {
    if (!outfitId) return;
    setState((prev) => {
      const nextItems = prev.items.filter((x) => x.id !== outfitId);
      return {
        ...prev,
        items: nextItems,
        total: nextItems.length,
      };
    });
  },

  async deleteSavedOutfit(outfitId: string): Promise<void> {
    if (!outfitId) return;
    const removed = _state.items.find((x) => x.id === outfitId);
    // Optimistic remove
    this.remove(outfitId);
    try {
      await api.deleteSavedOutfit(outfitId);
    } catch (err) {
      // Rollback on failure
      if (removed) {
        setState((prev) => ({
          ...prev,
          items: [removed, ...prev.items].sort(_byCreatedDesc),
          total: prev.items.length + 1,
        }));
      }
      throw err;
    }
  },

  reset(): void {
    _state = {
      items: [],
      total: 0,
      loading: false,
      error: null,
      lastFullSync: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useOutfitStore(options: { prewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    outfitStore.subscribe,
    outfitStore.getSnapshot,
    outfitStore.getSnapshot
  );

  useEffect(() => {
    if (options.prewarm && !outfitStore.isFresh() && !state.loading && state.items.length === 0) {
      outfitStore.prewarm().catch(() => {});
    }
  }, [options.prewarm, state.loading, state.items.length]);

  return {
    ...state,
    prewarm: outfitStore.prewarm.bind(outfitStore),
    upsert: outfitStore.upsert.bind(outfitStore),
    remove: outfitStore.remove.bind(outfitStore),
    deleteSavedOutfit: outfitStore.deleteSavedOutfit.bind(outfitStore),
    reset: outfitStore.reset.bind(outfitStore),
  };
}
