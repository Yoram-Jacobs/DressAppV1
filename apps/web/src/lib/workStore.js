/**
 * workStore.js — cross-page work tracker for The Eyes.
 *
 * Patch M20 (May 2026)
 * --------------------
 * The Closet page's local polling loop has a known weakness — when the
 * user navigates away from the page, the React component unmounts and
 * polling stops, so any matte / reconstruction BackgroundTask that
 * completes while the user is elsewhere never updates the local
 * cache. Result: the "Polishing photo…" badge sticks around on the
 * very last in-progress card the next time the user lands on Closet,
 * even though the backend has long since finished.
 *
 * This module owns a single global poller that runs at the App.jsx
 * level so it survives navigation. It also tracks active /analyze
 * jobs so the floating progress pill (``WorkProgressFloater``) can
 * tell the user something is happening even after they leave
 * AddItem.jsx mid-batch.
 *
 * The store is intentionally tiny — useSyncExternalStore pattern, no
 * Zustand / Redux — to keep cold-start fast and avoid pulling another
 * dep into the bundle.
 */

import { api } from '@/lib/api';
import { closetStore } from '@/lib/closetStore';

const POLL_INTERVAL_MS = 3000;
const MIN_POLL_GAP_MS = 2500;
// Hard ceiling: stop polling for any single item after this. Prevents
// a wedged BackgroundTask from keeping the poller alive forever.
const ITEM_POLL_TIMEOUT_MS = 45 * 1000; // 45 seconds (rembg/grouping takes 2-5s)

const _timedOutIds = new Set();
let _isPolling = false;
let _lastPollTime = 0;

const _listeners = new Set();
let _state = {
  analyzeJobs: {},
  polishPendingIds: new Set(),
  polishBatchTotal: 0,
  polishBatchCompleted: 0,
  _polishStartedAt: {},
  _onBatchDoneSubscribers: new Set(),
};

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* swallow listener errors */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  _notify();
}

let _pollerHandle = null;

/** Helper to determine if an item still has active background work pending. */
function _isItemPending(item) {
  if (!item || !item.id) return false;
  // Clean matte pending: only pending if clean_image_status is 'pending' AND clean_image_url is not yet present
  const isCleanPending = item.clean_image_status === 'pending' && !item.clean_image_url;
  // Group analysis pending: only pending if explicitly 'pending'
  const isGroupPending = item.group_analysis_status === 'pending';
  // Reconstruction: only pending if item explicitly needs reconstruction,
  // clean cutout is not yet available, and reconstruction is actively in-flight.
  const reconStatus = item.reconstruction_metadata?.status;
  const isReconPending = Boolean(
    item.needs_reconstruction &&
    !item.clean_image_url &&
    !item.reconstructed_image_url &&
    (reconStatus === 'pending' || reconStatus === 'in_progress')
  );
  return isCleanPending || isGroupPending || isReconPending;
}

/** Patch pending items in the local closet cache when polish tracking ends. */
function _syncClosetPolishTerminal(id, status) {
  try {
    const live = (closetStore.getSnapshot().items || []).find((it) => it && it.id === id);
    if (!live || (live.clean_image_status !== 'pending' && live.group_analysis_status !== 'pending')) return;
    closetStore.upsert({ 
      ...live, 
      clean_image_status: live.clean_image_status === 'pending' ? status : live.clean_image_status,
      group_analysis_status: live.group_analysis_status === 'pending' ? status : live.group_analysis_status
    });
  } catch { /* swallow */ }
}

async function _pollOnce() {
  if (_isPolling) return;
  const now = Date.now();
  if (now - _lastPollTime < MIN_POLL_GAP_MS) return;

  // ── Polish job polling ──
  const pendingIds = Array.from(_state.polishPendingIds);
  if (pendingIds.length === 0) {
    _maybeStopPoller();
    return;
  }

  _isPolling = true;
  _lastPollTime = Date.now();

  try {
    // Prune items that have been pending longer than the timeout —
    // their BackgroundTask is presumed wedged. We accept whatever
    // state the local store has and let the user pull-to-refresh
    // manually if it ever recovers.
    const timedOut = pendingIds.filter(
      (id) => now - (_state._polishStartedAt[id] || 0) > ITEM_POLL_TIMEOUT_MS,
    );
    if (timedOut.length) {
      const next = new Set(_state.polishPendingIds);
      const nextStartedAt = { ..._state._polishStartedAt };
      for (const id of timedOut) {
        next.delete(id);
        delete nextStartedAt[id];
        _timedOutIds.add(id);
        _syncClosetPolishTerminal(id, 'failed');
      }
      _set({
        polishPendingIds: next,
        _polishStartedAt: nextStartedAt,
        polishBatchCompleted: _state.polishBatchCompleted + timedOut.length,
      });
      if (next.size === 0) _onBatchDrained();
      _maybeStopPoller();
      return;
    }

    // GET each pending item. We swallow per-item errors so a transient
    // 5xx on one item doesn't kill the rest.
    const results = await Promise.all(
      pendingIds.map((id) => api.getItem(id).catch(() => null)),
    );

    let drained = false;
    const nextSet = new Set(_state.polishPendingIds);
    const nextStartedAt = { ..._state._polishStartedAt };
    let newlyCompleted = 0;

    const liveItems = closetStore.getSnapshot().items || [];
    const liveMap = new Map(liveItems.map((it) => [it?.id, it]));

    for (let i = 0; i < pendingIds.length; i += 1) {
      const id = pendingIds[i];
      const item = results[i];
      if (!item || !item.id) {
        // GET failed (404 / network) — stop tracking so the floater
        // and per-card badge don't spin forever on phantom ids.
        nextSet.delete(id);
        delete nextStartedAt[id];
        _timedOutIds.add(id);
        _syncClosetPolishTerminal(id, 'failed');
        newlyCompleted += 1;
        continue;
      }

      // Only push into closetStore if item data actually changed to avoid
      // re-render loops and local storage churn.
      const live = liveMap.get(id);
      const hasChanged = !live ||
        live.clean_image_status !== item.clean_image_status ||
        live.clean_image_url !== item.clean_image_url ||
        live.group_analysis_status !== item.group_analysis_status ||
        live.reconstructed_image_url !== item.reconstructed_image_url ||
        live.updated_at !== item.updated_at;

      if (hasChanged) {
        try {
          closetStore.upsert(item);
        } catch { /* swallow */ }
      }

      if (!_isItemPending(item)) {
        nextSet.delete(item.id);
        delete nextStartedAt[item.id];
        newlyCompleted += 1;
      }
    }

    if (newlyCompleted > 0) {
      drained = nextSet.size === 0;
      _set({
        polishPendingIds: nextSet,
        _polishStartedAt: nextStartedAt,
        polishBatchCompleted: _state.polishBatchCompleted + newlyCompleted,
      });
    }
    if (drained) _onBatchDrained();
    _maybeStopPoller();
  } finally {
    _isPolling = false;
  }
}

function _onBatchDrained() {
  // Capture the batch totals BEFORE we reset them so subscribers can
  // include the count in their UX ("3 items polished").
  const finalTotal = _state.polishBatchTotal;
  const finalCompleted = _state.polishBatchCompleted;
  // Reset counters so the next ``registerPolishItems`` call starts
  // a fresh batch label.
  _set({
    polishBatchTotal: 0,
    polishBatchCompleted: 0,
  });
  _state._onBatchDoneSubscribers.forEach((fn) => {
    try { fn({ total: finalTotal, completed: finalCompleted }); }
    catch { /* swallow */ }
  });
}

function _ensurePollerRunning() {
  if (_pollerHandle != null) return;
  _pollerHandle = setInterval(() => {
    _pollOnce().catch(() => { /* swallow */ });
  }, POLL_INTERVAL_MS);
}

function _maybeStopPoller() {
  if (_state.polishPendingIds.size === 0 && _pollerHandle != null) {
    clearInterval(_pollerHandle);
    _pollerHandle = null;
  }
}

export const workStore = {
  getSnapshot() { return _state; },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /**
   * Mark an /analyze job as started. ``id`` is the frontend card id
   * (the same one AddItem.jsx uses to track in-flight uploads), so
   * the floater can render "Analyzing 3 photos" by counting keys.
   * ``total`` is the expected item count from the streaming DETECT
   * frame; it's bumped to N once the frame arrives via
   * :meth:`updateAnalyze`.
   */
  registerAnalyze(id, label = null) {
    if (!id) return;
    _set({
      analyzeJobs: {
        ..._state.analyzeJobs,
        [id]: {
          id,
          label,
          startedAt: Date.now(),
          items: 0,
          total: 0,
        },
      },
    });
  },

  /**
   * Update progress for an in-flight analyze job. Called by the
   * streaming consumer in AddItem.jsx as DETECT / ITEM frames arrive.
   */
  updateAnalyze(id, patch) {
    if (!id || !_state.analyzeJobs[id]) return;
    _set({
      analyzeJobs: {
        ..._state.analyzeJobs,
        [id]: { ..._state.analyzeJobs[id], ...patch },
      },
    });
  },

  /**
   * Mark an analyze job as finished. We keep the entry in state for
   * a moment so the floater can show a brief "✓ Done" before
   * disappearing; the cleanup tick removes it.
   */
  completeAnalyze(id) {
    if (!id) return;
    const next = { ..._state.analyzeJobs };
    delete next[id];
    _set({ analyzeJobs: next });
  },

  /**
   * Register a batch of newly-saved items that have a deferred
   * matte / reconstruction BackgroundTask running. The global
   * poller will GET each one every POLL_INTERVAL_MS until the
   * backend flips ``clean_image_status`` out of "pending".
   *
   * ``items`` is the array returned from the /closet save calls;
   * we accept either the bare ids or full item docs.
   */
  registerPolishItems(items) {
    const ids = (items || [])
      .map((x) => (typeof x === 'string' ? x : x?.id))
      .filter(Boolean);
    if (ids.length === 0) return;

    const liveItems = closetStore.getSnapshot().items || [];
    const liveMap = new Map(liveItems.map((it) => [it?.id, it]));

    const nextSet = new Set(_state.polishPendingIds);
    const nextStartedAt = { ..._state._polishStartedAt };
    const now = Date.now();
    let added = 0;

    for (const id of ids) {
      if (_timedOutIds.has(id)) continue;
      const live = liveMap.get(id);
      if (live && !_isItemPending(live)) {
        // Item is already completely ready — no need to poll!
        continue;
      }
      if (!nextSet.has(id)) {
        nextSet.add(id);
        nextStartedAt[id] = now;
        added += 1;
      }
    }
    if (added > 0) {
      _set({
        polishPendingIds: nextSet,
        _polishStartedAt: nextStartedAt,
        polishBatchTotal: _state.polishBatchTotal + added,
      });
    }

    if (nextSet.size > 0) {
      _ensurePollerRunning();
      const canKickImmediate = added > 0 && !_isPolling && (Date.now() - _lastPollTime >= MIN_POLL_GAP_MS);
      if (canKickImmediate) {
        _pollOnce().catch(() => { /* swallow */ });
      }
    }
  },

  /**
   * Subscribe to "batch fully drained" signals. The callback is
   * invoked with ``{ total, completed }`` exactly once per polish
   * batch. Used by App.jsx to fire the toast.
   */
  onBatchDone(fn) {
    if (!fn) return () => {};
    _state._onBatchDoneSubscribers.add(fn);
    return () => _state._onBatchDoneSubscribers.delete(fn);
  },

  /** Test / triage hook — drops everything and stops the poller. */
  reset() {
    if (_pollerHandle != null) {
      clearInterval(_pollerHandle);
      _pollerHandle = null;
    }
    _isPolling = false;
    _lastPollTime = 0;
    _timedOutIds.clear();
    _state = {
      analyzeJobs: {},
      polishPendingIds: new Set(),
      polishBatchTotal: 0,
      polishBatchCompleted: 0,
      _polishStartedAt: {},
      _onBatchDoneSubscribers: _state._onBatchDoneSubscribers,
    };
    _notify();
  },

  // Internal — exposed for testing the polling loop directly.
  _pollOnce,
  _maybeStopPoller,
};
