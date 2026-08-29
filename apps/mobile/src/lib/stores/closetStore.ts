/**
 * apps/mobile/src/lib/stores/closetStore.ts
 *
 * Singleton store layer re-exporting and bridging to the deep closetRepository.
 */

import { useSyncExternalStore, useEffect } from 'react';
import {
  ClosetItem,
  WardrobeSummary,
  closetRepo,
  useCloset,
} from '@mobile/lib/repositories/closetRepository';

export type { ClosetItem, WardrobeSummary };
export { closetRepo, useCloset };

export type ClosetState = ReturnType<typeof closetRepo.getSnapshot>;

export interface ClosetStoreState extends ClosetState {
  prewarm: (options?: { force?: boolean }) => Promise<void>;
  upsert: (item: ClosetItem) => Promise<ClosetItem> | void;
  remove: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  removeMany: (itemIds: string[]) => void;
  deleteItem: (itemId: string) => Promise<void>;
  deleteMany: (itemIds: string[]) => Promise<void>;
  deleteManyItems: (itemIds: string[]) => Promise<void>;
  reset: () => void;
  getSummary: () => WardrobeSummary;
}

export const closetStore = {
  getSnapshot() {
    return closetRepo.getSnapshot();
  },

  subscribe(listener: () => void) {
    return closetRepo.subscribe(listener);
  },

  isFresh() {
    return closetRepo.isFresh();
  },

  prewarm(options: { force?: boolean } = {}) {
    return closetRepo.refresh(options);
  },

  upsert(item: ClosetItem) {
    return closetRepo.saveItem(item as any);
  },

  remove(itemId: string) {
    return closetRepo.deleteItem(itemId);
  },

  removeItem(itemId: string) {
    return closetRepo.deleteItem(itemId);
  },

  removeMany(itemIds: string[]) {
    return closetRepo.deleteMany(itemIds);
  },

  deleteItem(itemId: string) {
    return closetRepo.deleteItem(itemId);
  },

  deleteMany(itemIds: string[]) {
    return closetRepo.deleteMany(itemIds);
  },

  deleteManyItems(itemIds: string[]) {
    return closetRepo.deleteMany(itemIds);
  },

  reset() {
    return closetRepo.reset();
  },

  getSummary() {
    return closetRepo.getSummary();
  },
};

export function useClosetStore<T = ClosetStoreState>(
  selectorOrOptions?: ((state: ClosetStoreState) => T) | { prewarm?: boolean }
): T {
  const isOptions = typeof selectorOrOptions === 'object' && selectorOrOptions !== null;
  const shouldPrewarm = isOptions && selectorOrOptions.prewarm !== false;
  const selector = typeof selectorOrOptions === 'function' ? selectorOrOptions : undefined;

  useEffect(() => {
    if (shouldPrewarm && !closetRepo.isFresh()) {
      closetRepo.refresh().catch(() => {});
    }
  }, [shouldPrewarm]);

  const state = useSyncExternalStore(
    closetStore.subscribe,
    closetStore.getSnapshot,
    closetStore.getSnapshot
  );

  const full: ClosetStoreState = {
    ...state,
    prewarm: (opts) => closetStore.prewarm(opts),
    upsert: (it) => closetStore.upsert(it),
    remove: (id) => closetStore.remove(id),
    removeItem: (id) => closetStore.removeItem(id),
    removeMany: (ids) => closetStore.removeMany(ids),
    deleteItem: (id) => closetStore.deleteItem(id),
    deleteMany: (ids) => closetStore.deleteMany(ids),
    deleteManyItems: (ids) => closetStore.deleteManyItems(ids),
    reset: () => closetStore.reset(),
    getSummary: () => closetStore.getSummary(),
  };

  return selector ? selector(full) : (full as unknown as T);
}