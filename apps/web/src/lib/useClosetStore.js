/**
 * useClosetStore — thin React adapter over the singleton closet store.
 *
 * Returns a stable snapshot ({items, total, loading, error}) and
 * memoised mutators. Components can render directly from the
 * snapshot or reach back to ``closetStore`` for imperative ops.
 */
import { useSyncExternalStore, useEffect } from 'react';
import { closetStore } from '@/lib/closetStore';
import { useAuth } from '@/lib/auth';

const _subscribe = closetStore.subscribe.bind(closetStore);
const _getSnapshot = closetStore.getSnapshot.bind(closetStore);
const _getItemsSnapshot = closetStore.getItemsSnapshot.bind(closetStore);

export const prewarmCloset = closetStore.prewarm.bind(closetStore);
export const incrementalSyncCloset = closetStore.incrementalSync.bind(closetStore);
export const upsertCloset = closetStore.upsert.bind(closetStore);
export const removeCloset = closetStore.remove.bind(closetStore);
export const replaceAllCloset = closetStore.replaceAll.bind(closetStore);
export const resetClosetStore = closetStore.reset.bind(closetStore);
export const repairHashesCloset = closetStore.repairHashes.bind(closetStore);
export const repairThumbnailsCloset = closetStore.repairThumbnails.bind(closetStore);
export const triggerRepairCloset = closetStore.triggerRepair.bind(closetStore);
export const dismissSaveFailuresCloset = closetStore.dismissSaveFailures.bind(closetStore);

export function useClosetStore({ prewarm = false } = {}) {
  const snap = useSyncExternalStore(
    _subscribe,
    _getSnapshot,
    _getSnapshot,
  );
  const { user } = useAuth();

  useEffect(() => {
    if (!prewarm || !user) return;
    prewarmCloset().catch(() => {});
  }, [prewarm, user]);

  return {
    items: snap.items,
    total: snap.total,
    loading: snap.loading,
    error: snap.error,
    lastFullSync: snap.lastFullSync,
    lastIncSync: snap.lastIncSync,
    lastSaveFailures: snap.lastSaveFailures,
    repairProgress: snap.repairProgress,
    thumbProgress: snap.thumbProgress,
    prewarm: prewarmCloset,
    incrementalSync: incrementalSyncCloset,
    upsert: upsertCloset,
    remove: removeCloset,
    replaceAll: replaceAllCloset,
    reset: resetClosetStore,
    repairHashes: repairHashesCloset,
    repairThumbnails: repairThumbnailsCloset,
    triggerRepair: triggerRepairCloset,
    dismissSaveFailures: dismissSaveFailuresCloset,
  };
}

export function useClosetItems({ prewarm = false } = {}) {
  const items = useSyncExternalStore(
    _subscribe,
    _getItemsSnapshot,
    _getItemsSnapshot,
  );
  
  const { user } = useAuth();

  useEffect(() => {
    if (!prewarm || !user) return;
    prewarmCloset().catch(() => {});
  }, [prewarm, user]);

  return items;
}
