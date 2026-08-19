import { useSyncExternalStore, useEffect } from 'react';
import { outfitStore } from '@/lib/outfitStore';
import { useAuth } from '@/lib/auth';

const _subscribe = outfitStore.subscribe.bind(outfitStore);
const _getSnapshot = outfitStore.getSnapshot.bind(outfitStore);
const _getItemsSnapshot = outfitStore.getItemsSnapshot.bind(outfitStore);

export const prewarmOutfits = outfitStore.prewarm.bind(outfitStore);
export const incrementalSyncOutfits = outfitStore.incrementalSync.bind(outfitStore);
export const upsertOutfit = outfitStore.upsert.bind(outfitStore);
export const removeOutfit = outfitStore.remove.bind(outfitStore);
export const replaceAllOutfits = outfitStore.replaceAll.bind(outfitStore);
export const resetOutfitStore = outfitStore.reset.bind(outfitStore);

export function useOutfitStore({ prewarm = false } = {}) {
  const snap = useSyncExternalStore(
    _subscribe,
    _getSnapshot,
    _getSnapshot,
  );
  const { user } = useAuth();

  useEffect(() => {
    if (!prewarm || !user) return;
    prewarmOutfits().catch(() => {});
  }, [prewarm, user]);

  return {
    items: snap.items,
    total: snap.total,
    loading: snap.loading,
    error: snap.error,
    lastFullSync: snap.lastFullSync,
    lastIncSync: snap.lastIncSync,
    prewarm: prewarmOutfits,
    incrementalSync: incrementalSyncOutfits,
    upsert: upsertOutfit,
    remove: removeOutfit,
    replaceAll: replaceAllOutfits,
    reset: resetOutfitStore,
  };
}

export function useOutfitItems() {
  return useSyncExternalStore(
    _subscribe,
    _getItemsSnapshot,
    _getItemsSnapshot,
  );
}
