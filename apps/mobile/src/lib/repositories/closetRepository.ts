/**
 * apps/mobile/src/lib/repositories/closetRepository.ts
 *
 * Deep module: Mobile Closet Repository & Offline-First Cache.
 *
 * Encapsulates offline AsyncStorage hydration, optimistic mutations,
 * automatic rollback on network failure, SWR background revalidation,
 * and zero-latency slot summary calculations.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect, useCallback, useMemo } from 'react';

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
  placeholder_data_url?: string;
  cutout_url?: string;
  original_image_url?: string;
  reconstructed_image_url?: string;
  clean_image_url?: string;
  segmented_image_url?: string;
  image_quality_status?: string;
  reconstruction_metadata?: any;
  preferred_image_view?: string;
  wear_count?: number;
  worn_count?: number;
  dpp_data?: any;
  group_id?: string | null;
  group_role?: 'host' | 'member' | null;
  group_members?: ClosetItem[];
  created_at?: string;
  updated_at?: string;
}

export interface WardrobeSummary {
  total: number;
  tops: number;
  bottoms: number;
  shoes: number;
  dresses: number;
  outerwear: number;
  accessories: number;
}

interface ClosetRepoState {
  items: ClosetItem[];
  total: number;
  loading: boolean;
  error: string | null;
  lastFullSync: number;
}

const STORAGE_KEY = 'dressapp_mobile_closet_cache';
const FRESH_MS = 5 * 60 * 1000; // 5 minutes SWR threshold

let _state: ClosetRepoState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
  lastFullSync: 0,
};

let _inFlightSync: Promise<void> | null = null;
const listeners = new Set<() => void>();

let _reconstructionPollTimer: any = null;

function checkPendingReconstructions() {
  const pending = _state.items.some(
    (it) =>
      !it.reconstructed_image_url &&
      (it.image_quality_status === 'needs_reconstruction' ||
        it.image_quality_status === 'needs_completion' ||
        (it as any).reconstruction_metadata?.deferred)
  );

  if (pending && !_reconstructionPollTimer) {
    _reconstructionPollTimer = setInterval(async () => {
      const stillPending = _state.items.some(
        (it) =>
          !it.reconstructed_image_url &&
          (it.image_quality_status === 'needs_reconstruction' ||
            it.image_quality_status === 'needs_completion' ||
            (it as any).reconstruction_metadata?.deferred)
      );

      if (!stillPending) {
        clearInterval(_reconstructionPollTimer);
        _reconstructionPollTimer = null;
        return;
      }

      try {
        await closetRepo.refresh({ force: true });
      } catch {}
    }, 3000);
  } else if (!pending && _reconstructionPollTimer) {
    clearInterval(_reconstructionPollTimer);
    _reconstructionPollTimer = null;
  }
}

function notify() {
  listeners.forEach((l) => l());
  checkPendingReconstructions();
}

function setState(updater: (prev: ClosetRepoState) => ClosetRepoState) {
  _state = updater(_state);
  notify();
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      items: _state.items,
      total: _state.total,
      lastFullSync: _state.lastFullSync,
    })
  ).catch(() => {});
}

// Hydrate from storage immediately on module load
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

function normalizeCategorySlot(cat: any): keyof Omit<WardrobeSummary, 'total'> {
  const s = String(cat || '').trim().toLowerCase().replace(' ', '_').replace('-', '_');
  if (['top', 'tops', 'shirt', 'shirts', 't_shirt', 'tshirt', 'sweater', 'blouse', 'hoodie', 'cardigan'].includes(s)) {
    return 'tops';
  }
  if (['bottom', 'bottoms', 'pants', 'shorts', 'jeans', 'skirt', 'skirts', 'trousers', 'joggers'].includes(s)) {
    return 'bottoms';
  }
  if (['footwear', 'shoes', 'shoe', 'sneakers', 'sneaker', 'boots', 'sandals', 'heels', 'loafers'].includes(s)) {
    return 'shoes';
  }
  if (['dress', 'dresses', 'jumpsuit', 'suit', 'overall', 'romper', 'gown'].includes(s)) {
    return 'dresses';
  }
  if (['outerwear', 'jacket', 'jackets', 'coat', 'coats', 'blazer', 'parka', 'trench', 'vest'].includes(s)) {
    return 'outerwear';
  }
  return 'accessories';
}

export const closetRepo = {
  getSnapshot(): ClosetRepoState {
    return _state;
  },

  getItems(): ClosetItem[] {
    return _state.items;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastFullSync < FRESH_MS;
  },

  getSummary(): WardrobeSummary {
    const summary: WardrobeSummary = {
      total: _state.items.length,
      tops: 0,
      bottoms: 0,
      shoes: 0,
      dresses: 0,
      outerwear: 0,
      accessories: 0,
    };
    for (const item of _state.items) {
      const slot = normalizeCategorySlot(item.category);
      summary[slot] += 1;
    }
    return summary;
  },

  async refresh(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh()) return;
    if (_inFlightSync) return _inFlightSync;

    const shouldShowLoading = _state.items.length === 0 && _state.lastFullSync === 0;
    if (shouldShowLoading) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    _inFlightSync = (async () => {
      try {
        const data = await api.listCloset({ limit: 500 });
        const rawList = Array.isArray(data) ? data : data?.items || [];
        const items: ClosetItem[] = rawList.map((it: any) => ({
          ...it,
          id: String(it.id || it._id),
        }));

        setState((prev) => ({
          ...prev,
          items,
          total: data?.total ?? items.length,
          loading: false,
          lastFullSync: Date.now(),
          error: null,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Failed to sync wardrobe',
        }));
      } finally {
        _inFlightSync = null;
      }
    })();

    return _inFlightSync;
  },

  upsert(item: ClosetItem): void {
    if (!item || !item.id) return;
    setState((prev) => {
      const items = prev.items || [];
      const idx = items.findIndex((x) => x.id === item.id);
      let nextItems: ClosetItem[];
      if (idx >= 0) {
        const prevItem = items[idx];
        const merged = { ...prevItem, ...item };
        nextItems = [...items];
        nextItems[idx] = merged;
      } else {
        nextItems = [item, ...items];
      }
      return { ...prev, items: nextItems, total: nextItems.length };
    });
  },

  async saveItem(patch: Partial<ClosetItem> & { id: string }): Promise<ClosetItem> {
    if (!patch.id) throw new Error('Item ID is required');

    // 1. Snapshot previous item for rollback
    const prevItem = _state.items.find((x) => x.id === patch.id);
    const optimisticUpdated: ClosetItem = prevItem
      ? { ...prevItem, ...patch, updated_at: new Date().toISOString() }
      : ({ ...patch, updated_at: new Date().toISOString() } as ClosetItem);

    // 2. Optimistic local update
    setState((prev) => {
      const idx = prev.items.findIndex((x) => x.id === patch.id);
      const nextItems = idx >= 0 ? [...prev.items] : [optimisticUpdated, ...prev.items];
      if (idx >= 0) nextItems[idx] = optimisticUpdated;
      return { ...prev, items: nextItems, total: nextItems.length };
    });

    // 3. Network write with sanitized payload to avoid Pydantic extra='forbid' 422 errors
    const ALLOWED_PATCH_KEYS = new Set([
      'source', 'group_id', 'group_role', 'name', 'title', 'caption',
      'category', 'sub_category', 'item_type', 'brand', 'gender', 'dress_code',
      'season', 'tradition', 'size', 'color', 'colors', 'material', 'fabric_materials',
      'pattern', 'state', 'condition', 'quality', 'repair_advice', 'price_cents',
      'currency', 'marketplace_intent', 'formality', 'cultural_tags', 'tags',
      'wear_count', 'last_worn_at', 'notes', 'reconstructed_image_url',
      'reconstruction_metadata', 'clean_image_url', 'clean_image_status', 'clear_reconstruction',
      'preferred_image_view'
    ]);
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (ALLOWED_PATCH_KEYS.has(k) && v !== undefined) {
        sanitized[k] = v;
      }
    }

    try {
      const res = await api.patchItem(patch.id, sanitized);
      const confirmed: ClosetItem = { ...optimisticUpdated, ...(res || {}) };
      setState((prev) => {
        const idx = prev.items.findIndex((x) => x.id === patch.id);
        if (idx >= 0) {
          const nextItems = [...prev.items];
          nextItems[idx] = confirmed;
          return { ...prev, items: nextItems };
        }
        return prev;
      });
      return confirmed;
    } catch (err) {
      if (prevItem) {
        setState((prev) => {
          const idx = prev.items.findIndex((x) => x.id === patch.id);
          if (idx >= 0) {
            const nextItems = [...prev.items];
            nextItems[idx] = prevItem;
            return { ...prev, items: nextItems };
          }
          return prev;
        });
      }
      throw err;
    }
  },

  async deleteItem(itemId: string): Promise<void> {
    if (!itemId) return;
    const removed = _state.items.find((x) => x.id === itemId);

    // 1. Optimistic remove
    setState((prev) => {
      const nextItems = prev.items.filter((x) => x.id !== itemId);
      return { ...prev, items: nextItems, total: nextItems.length };
    });

    // 2. Network write with rollback on error
    try {
      await api.deleteItem(itemId);
    } catch (err) {
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

  async deleteMany(itemIds: string[]): Promise<void> {
    if (!itemIds?.length) return;
    const set = new Set(itemIds);
    const removedItems = _state.items.filter((x) => set.has(x.id));

    // 1. Optimistic remove
    setState((prev) => {
      const nextItems = prev.items.filter((x) => !set.has(x.id));
      return { ...prev, items: nextItems, total: nextItems.length };
    });

    // 2. Network writes with partial rollback
    try {
      const results = await Promise.allSettled(itemIds.map((id) => api.deleteItem(id)));
      const failedIds = new Set<string>();
      results.forEach((res, i) => {
        if (res.status === 'rejected') failedIds.add(itemIds[i]);
      });
      if (failedIds.size > 0) {
        const toRestore = removedItems.filter((x) => failedIds.has(x.id));
        setState((prev) => ({
          ...prev,
          items: [...toRestore, ...prev.items],
          total: prev.items.length + toRestore.length,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        items: [...removedItems, ...prev.items],
        total: prev.items.length + removedItems.length,
      }));
      throw err;
    }
  },

  reset(): void {
    setState(() => ({
      items: [],
      total: 0,
      loading: false,
      error: null,
      lastFullSync: 0,
    }));
  },
};

/**
 * Standard React hook for zero-latency closet data and actions.
 */
export function useCloset(options: { autoPrewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    closetRepo.subscribe,
    closetRepo.getSnapshot,
    closetRepo.getSnapshot
  );

  useEffect(() => {
    if (options.autoPrewarm !== false && !closetRepo.isFresh()) {
      closetRepo.refresh().catch(() => {});
    }
  }, [options.autoPrewarm]);

  const refresh = useCallback((opts?: { force?: boolean }) => closetRepo.refresh(opts), []);
  const saveItem = useCallback((p: Partial<ClosetItem> & { id: string }) => closetRepo.saveItem(p), []);
  const deleteItem = useCallback((id: string) => closetRepo.deleteItem(id), []);
  const deleteMany = useCallback((ids: string[]) => closetRepo.deleteMany(ids), []);
  const summary = useMemo(() => closetRepo.getSummary(), [state.items]);

  return {
    items: state.items,
    total: state.total,
    loading: state.loading,
    error: state.error,
    summary,
    refresh,
    saveItem,
    deleteItem,
    deleteMany,
  };
}