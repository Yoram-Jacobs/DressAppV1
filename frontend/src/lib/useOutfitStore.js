import { useSyncExternalStore, useEffect } from 'react';
import { outfitStore } from '@/lib/outfitStore';
import { useAuth } from '@/lib/auth';

const _subscribe = outfitStore.subscribe.bind(outfitStore);
const _getSnapshot = outfitStore.getSnapshot.bind(outfitStore);
const _getItemsSnapshot = outfitStore.getItemsSnapshot.bind(outfitStore);

export function useOutfitStore({ prewarm = false } = {}) {
  const snap = useSyncExternalStore(
    _subscribe,
    _getSnapshot,
    _getSnapshot,
  );
  const { user } = useAuth();

  useEffect(() => {
    if (!prewarm || !user) return;
    outfitStore.prewarm().catch(() => {});
  }, [prewarm, user]);

  return {
    items: snap.items,
    total: snap.total,
    loading: snap.loading,
    error: snap.error,
    lastFullSync: snap.lastFullSync,
    lastIncSync: snap.lastIncSync,
    prewarm: outfitStore.prewarm.bind(outfitStore),
    incrementalSync: outfitStore.incrementalSync.bind(outfitStore),
    upsert: outfitStore.upsert.bind(outfitStore),
    remove: outfitStore.remove.bind(outfitStore),
    replaceAll: outfitStore.replaceAll.bind(outfitStore),
    reset: outfitStore.reset.bind(outfitStore),
  };
}

export function useOutfitItems() {
  return useSyncExternalStore(
    _subscribe,
    _getItemsSnapshot,
    _getItemsSnapshot,
  );
}
