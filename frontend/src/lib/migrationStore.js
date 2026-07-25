/**
 * migrationStore.js — holds pending migration cards from the bookmarklet
 * until AddItem.jsx picks them up and feeds them into the GarmentVision
 * silent 6+ batch photo upload pipeline.
 *
 * Uses the same useSyncExternalStore pattern as workStore / closetStore.
 */

const _listeners = new Set();
let _cards = null;

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* swallow */ }
  });
}

export const migrationStore = {
  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  getSnapshot() {
    return _cards;
  },

  /** Called by MigrationMessageListener when DRESSAPP_MIGRATION_COMPLETE arrives. */
  setCards(cards) {
    _cards = cards;
    _notify();
  },

  /** Called by AddItem.jsx to consume and clear the pending cards. */
  consumeCards() {
    const cards = _cards;
    if (cards && cards.length > 0) {
      _cards = null;
      _notify();
      return cards;
    }
    return null;
  },
};
