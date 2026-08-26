/**
 * apps/mobile/src/lib/stores/closetStore.ts
 *
 * Singleton in-memory store for the user's wardrobe/closet.
 * Provides instant zero-latency rendering, optimistic updates, and background syncing.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect } from 'react';

export interface ClosetItem {
  id: string;
  user_id?: string;
  name?: string;
  title?: string;
  caption?: string;
  description?: string;
  brand?: string;
  category?: string;
  sub_category?: string;
  item_type?: string;
  gender?: string;
  dress_code?: string;
  season?: string | string[];
  tradition?: string;
  size?: string;
  color?: string;
  colors?: Array<{ name: string; pct?: number } | string>;
  material?: string;
  fabric?: string;
  fabric_materials?: Array<{ name: string; pct?: number }>;
  pattern?: string;
  state?: string;
  condition?: string;
  quality?: string;
  price?: number;
  original_price?: number;
  price_cents?: number;
  currency?: string;
  source?: string;
  intent?: string;
  marketplace_intent?: string;
  formality?: string;
  cultural_tags?: string[];
  tags?: string[];
  notes?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  cutout_url?: string;
  original_image_url?: string;
  reconstructed_image_url?: string;
  clean_image_url?: string;
  segmented_image_url?: string;
  wear_count?: number;
  worn_count?: number;
  dpp_data?: any;
  group_id?: string | null;
  group_role?: 'host' | 'member' | null;
  group_members?: ClosetItem[];
  created_at?: string;
  updated_at?: string;
}

interface ClosetState {
  items: ClosetItem[];
  total: number;
  loading: boolean;
  error: string | null;
  lastFullSync: number;
}

const STORAGE_KEY = 'dressapp_mobile_closet_cache';
const FRESH_MS = 5 * 60 * 1000; // 5 mins

let _state: ClosetState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
  lastFullSync: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(updater: (prev: ClosetState) => ClosetState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    items: _state.items,
    total: _state.total,
    lastFullSync: _state.lastFullSync,
  })).catch(() => {});
}

// Hydrate from storage on boot
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

export const closetStore = {
  getSnapshot(): ClosetState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastFullSync < FRESH_MS && _state.items.length > 0;
  },

  async prewarm(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh()) return;

    setState((prev) => ({ ...prev, loading: prev.items.length === 0, error: null }));
    try {
      const data = await api.listCloset({ limit: 500 });
      const rawList = Array.isArray(data) ? data : (data?.items || []);
      const items: ClosetItem[] = rawList.map((it: any) => ({
        ...it,
        id: it.id || it._id,
      }));

      setState((prev) => ({
        ...prev,
        items,
        total: items.length,
        loading: false,
        lastFullSync: Date.now(),
        error: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load closet',
      }));
    }
  },

  upsert(item: ClosetItem): void {
    if (!item || !item.id) return;
    setState((prev) => {
      const idx = prev.items.findIndex((x) => x.id === item.id);
      let nextItems: ClosetItem[];
      if (idx >= 0) {
        nextItems = [...prev.items];
        nextItems[idx] = { ...nextItems[idx], ...item };
      } else {
        nextItems = [item, ...prev.items];
      }
      return {
        ...prev,
        items: nextItems,
        total: nextItems.length,
      };
    });
  },

  remove(itemId: string): void {
    if (!itemId) return;
    setState((prev) => {
      const nextItems = prev.items.filter((x) => x.id !== itemId);
      return {
        ...prev,
        items: nextItems,
        total: nextItems.length,
      };
    });
  },

  removeItem(itemId: string): void {
    this.remove(itemId);
  },

  removeMany(itemIds: string[]): void {
    if (!itemIds?.length) return;
    const set = new Set(itemIds);
    setState((prev) => {
      const nextItems = prev.items.filter((x) => !set.has(x.id));
      return {
        ...prev,
        items: nextItems,
        total: nextItems.length,
      };
    });
  },

  /**
   * Delete a single item — optimistic remove + backend API call.
   * Restores the item and re-throws if the API call fails.
   */
  async deleteItem(itemId: string): Promise<void> {
    if (!itemId) return;
    // Snapshot the item before removing so we can restore on error
    const removed = _state.items.find((x) => x.id === itemId);
    this.remove(itemId);
    try {
      await api.deleteItem(itemId);
    } catch (err) {
      // Restore the item to local state on failure
      if (removed) {
        setState((prev) => ({
          ...prev,
          items: [removed, ...prev.items.filter((x) => x.id !== itemId)],
          total: prev.items.length + 1,
        }));
      }
      throw err;
    }
  },

  /**
   * Delete multiple items — optimistic remove + parallel backend API calls.
   * Restores any items whose delete failed and re-throws the first error.
   */
  async deleteManyItems(itemIds: string[]): Promise<void> {
    if (!itemIds?.length) return;
    const set = new Set(itemIds);
    const removed = _state.items.filter((x) => set.has(x.id));
    this.removeMany(itemIds);
    const results = await Promise.allSettled(
      itemIds.map((id) => api.deleteItem(id))
    );
    const failures = results
      .map((r, i) => ({ result: r, id: itemIds[i] }))
      .filter(({ result }) => result.status === 'rejected');
    if (failures.length > 0) {
      // Restore failed items
      const failedIds = new Set(failures.map(({ id }) => id));
      const toRestore = removed.filter((x) => failedIds.has(x.id));
      if (toRestore.length > 0) {
        setState((prev) => ({
          ...prev,
          items: [...toRestore, ...prev.items],
          total: prev.items.length + toRestore.length,
        }));
      }
      const firstError = (failures[0].result as PromiseRejectedResult).reason;
      throw firstError instanceof Error ? firstError : new Error('Failed to delete some items');
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

export function useClosetStore(options: { prewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    closetStore.subscribe,
    closetStore.getSnapshot,
    closetStore.getSnapshot
  );

  useEffect(() => {
    if (options.prewarm && !closetStore.isFresh() && !state.loading && state.items.length === 0) {
      closetStore.prewarm().catch(() => {});
    }
  }, [options.prewarm, state.loading, state.items.length]);

  return {
    ...state,
    prewarm: closetStore.prewarm.bind(closetStore),
    upsert: closetStore.upsert.bind(closetStore),
    remove: closetStore.remove.bind(closetStore),
    removeItem: closetStore.removeItem.bind(closetStore),
    removeMany: closetStore.removeMany.bind(closetStore),
    deleteItem: closetStore.deleteItem.bind(closetStore),
    deleteManyItems: closetStore.deleteManyItems.bind(closetStore),
  };
}
