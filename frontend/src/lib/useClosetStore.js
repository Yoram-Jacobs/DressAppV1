/**
 * useClosetStore — thin React adapter over the singleton closet store.
 *
 * Returns a stable snapshot ({items, total, loading, error}) and
 * memoised mutators. Components can render directly from the
 * snapshot or reach back to ``closetStore`` for imperative ops.
 *
 * ---
 * useClosetItems() — lean items-only hook
 *
 * Use this wherever a component only needs the ``items`` array and
 * must not re-render on loading spinners, repair-progress ticks, or
 * any other non-items state change.
 *
 * Internally it subscribes to ``closetStore.getItemsSnapshot`` which
 * returns ``_state.items`` directly. Because ``useSyncExternalStore``
 * uses ``Object.is`` to detect changes, this hook re-renders only
 * when the array reference is replaced — i.e. on add, remove, or
 * upsert.  Cross-tab sync is automatic: the ``storage`` event
 * listener in closetStore.js also replaces the array reference, so
 * the ``_notify`` call reaches every tab's subscriber.
 *
 * This is the correct hook for the "Link to Closet Item" picker
 * inside the receipt import flow, where the closet list is an
 * external data source (localStorage + IndexedDB, not component
 * state) and should be immediately consistent across tabs.
 */
import { useSyncExternalStore, useEffect } from 'react';
import { closetStore } from '@/lib/closetStore';
import { useAuth } from '@/lib/auth';

// Stable bound references — created once per module load so that
// useSyncExternalStore receives the exact same function identity on
// every render (required: a new function reference on every render
// would re-subscribe on every render, which causes a flicker loop).
const _subscribe = closetStore.subscribe.bind(closetStore);
const _getSnapshot = closetStore.getSnapshot.bind(closetStore);
const _getItemsSnapshot = closetStore.getItemsSnapshot.bind(closetStore);

export function useClosetStore({ prewarm = false } = {}) {
  const snap = useSyncExternalStore(
    _subscribe,
    _getSnapshot,
    _getSnapshot,   // server snapshot (SSR fallback — identical to client)
  );
  const { user } = useAuth();

  // Optional eager warm-up. Components that mount near the root (App)
  // pass ``prewarm: true`` to fire the initial fetch right after auth
  // resolves — *before* the user navigates to the Closet page.
  useEffect(() => {
    if (!prewarm || !user) return;
    closetStore.prewarm().catch(() => {});
  }, [prewarm, user]);

  return {
    items: snap.items,
    total: snap.total,
    loading: snap.loading,
    error: snap.error,
    lastFullSync: snap.lastFullSync,
    lastIncSync: snap.lastIncSync,
    // Phase Z4 — optimistic save-failure descriptors surfaced by the
    // Closet page as a one-shot warning dialog.
    lastSaveFailures: snap.lastSaveFailures,
    // Phase Z2.3 — streaming hash-repair progress snapshot. Consumers
    // (e.g. the Closet header chip) render directly from this; it
    // updates on every NDJSON line the server streams.
    repairProgress: snap.repairProgress,
    // Phase Z2.6 — streaming thumbnail-repair progress snapshot.
    // Same shape semantics as ``repairProgress``; consumers render
    // an independent chip from this so the two passes can be
    // distinguished visually when they fire back-to-back after
    // prewarm.
    thumbProgress: snap.thumbProgress,
    // Imperative passthroughs so consumers don't need to import the
    // store separately.
    prewarm: closetStore.prewarm.bind(closetStore),
    incrementalSync: closetStore.incrementalSync.bind(closetStore),
    upsert: closetStore.upsert.bind(closetStore),
    remove: closetStore.remove.bind(closetStore),
    replaceAll: closetStore.replaceAll.bind(closetStore),
    reset: closetStore.reset.bind(closetStore),
    repairHashes: closetStore.repairHashes.bind(closetStore),
    repairThumbnails: closetStore.repairThumbnails.bind(closetStore),
    triggerRepair: closetStore.triggerRepair.bind(closetStore),
    dismissSaveFailures: closetStore.dismissSaveFailures.bind(closetStore),
  };
}

/**
 * Lean items-only hook — zero re-renders from loading / repair-progress
 * changes. Use this in any component that only needs the item list.
 *
 * The "Link to Closet Item" picker in the receipt import flow uses this
 * hook so it stays instantly in sync with the Closet page (and other
 * tabs) without re-rendering on unrelated store updates.
 */
export function useClosetItems() {
  return useSyncExternalStore(
    _subscribe,
    _getItemsSnapshot,
    _getItemsSnapshot, // SSR fallback
  );
}
