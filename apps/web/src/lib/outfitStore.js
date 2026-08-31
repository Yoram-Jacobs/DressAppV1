import { api } from '@/lib/api';
import { setItem, getItem } from './idb';

const FRESH_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INCREMENTAL_SYNC_INTERVAL_MS = 30 * 1000;

const LOCAL_STORAGE_KEY = 'dressapp_outfit_store_state';

const _defaultState = {
  items: [],          // canonical list of outfits, sorted by created_at desc
  total: 0,
  lastFullSync: 0,    // epoch ms of the last full fetch
  lastIncSync: 0,     // epoch ms of the last incremental sync
  loading: false,
  error: null,
};

function loadState() {
  if (typeof window === 'undefined') return { ..._defaultState };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ..._defaultState,
        ...parsed,
        loading: false,
        error: null,
      };
    }
  } catch (e) {
    console.error('Failed to load outfit state from localStorage', e);
  }
  return { ..._defaultState };
}

function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      total: state.total,
      lastFullSync: state.lastFullSync,
      lastIncSync: state.lastIncSync,
    }));
  } catch (e) {
    console.error('Failed to save outfit state to localStorage', e);
  }
  
  if (state.items && state.items.length > 0) {
    setItem('outfit_items', state.items.filter(Boolean)).catch(e => console.error('Failed to save outfits to IndexedDB', e));
  } else if (state.items && state.items.length === 0 && state.lastFullSync) {
    setItem('outfit_items', []).catch(e => console.error('Failed to clear outfits from IndexedDB', e));
  }
}

let _state = loadState();

let _idbPromise = typeof window !== 'undefined' ? getItem('outfit_items').then(items => {
  if (items && items.length > 0 && _state.items.length === 0) {
    _state.items = items.filter(Boolean);
    _notify();
  }
}).catch(e => console.error('Failed to load outfits from IndexedDB', e)) : Promise.resolve();

const _listeners = new Set();
const _deletedIds = new Set();

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  saveState(_state);
  _notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LOCAL_STORAGE_KEY) {
      try {
        if (event.newValue === null) {
          _state = { ..._defaultState };
        } else {
          const parsed = JSON.parse(event.newValue);
          _state = {
            ..._state,
            ...parsed,
            loading: _state.loading,
            error: _state.error,
          };
        }
        _notify();
      } catch (e) {
        // ignore
      }
    }
  });
}

function _byCreatedDesc(a, b) {
  const ax = a?.created_at || '';
  const bx = b?.created_at || '';
  return ax < bx ? 1 : ax > bx ? -1 : 0;
}

export const outfitStore = {
  getSnapshot() {
    return _state;
  },

  getItemsSnapshot() {
    return _state.items;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ force = false } = {}) {
    await _idbPromise;
    if (!force && _state.loading) return _state.items;
    if (!force && _state.lastFullSync && Date.now() - _state.lastFullSync < FRESH_MS) {
      if (!(_state.items.length === 0 && _state.total > 0)) {
        return _state.items;
      }
    }
    _set({ loading: true, error: null });
    try {
      const res = await api.listSavedOutfits();
      const rawItems = Array.isArray(res) ? res : (res.outfits || []);
      const next = rawItems.filter(Boolean).filter((it) => !_deletedIds.has(it.id)).sort(_byCreatedDesc);
      const now = Date.now();
      _set({
        items: next,
        total: res.total || next.length,
        lastFullSync: now,
        lastIncSync: now,
      });

      return next;
    } catch (err) {
      _set({ error: err });
      throw err;
    } finally {
      _set({ loading: false });
    }
  },

  async incrementalSync() {
    if (!_state.lastFullSync || _state.items.length === 0) {
      return this.prewarm();
    }
    if (Date.now() - _state.lastIncSync < MIN_INCREMENTAL_SYNC_INTERVAL_MS) {
      return 0;
    }
    try {
      const res = await api.listSavedOutfits();
      const rawItems = Array.isArray(res) ? res : (res.outfits || []);
      const liveItems = rawItems.filter(Boolean).filter((it) => !_deletedIds.has(it.id)).sort(_byCreatedDesc);
      
      const prevIds = new Set(_state.items.map(it => it.id));
      const newIds = new Set(liveItems.map(it => it.id));
      
      let mutations = 0;
      if (prevIds.size !== newIds.size) {
          mutations = Math.abs(prevIds.size - newIds.size);
      } else {
          mutations = 1; 
      }

      _set({
        items: liveItems,
        total: res.total || liveItems.length,
        lastIncSync: Date.now(),
      });
      return mutations;
    } catch (err) {
      console.info('outfit incremental sync failed', err?.message || err);
      return 0;
    }
  },

  upsert(item) {
    if (!item || !item.id) return;
    _deletedIds.delete(item.id);
    const items = (_state.items || []).filter(Boolean);
    const idx = items.findIndex((it) => it.id === item.id);
    let nextItems;
    let nextTotal = _state.total;
    if (idx >= 0) {
      const prev = items[idx];
      const merged = { ...prev, ...item };
      nextItems = [
        ...items.slice(0, idx),
        merged,
        ...items.slice(idx + 1),
      ].sort(_byCreatedDesc);
    } else {
      nextItems = [item, ...items].sort(_byCreatedDesc);
      nextTotal = _state.total + 1;
    }
    _set({ items: nextItems, total: nextTotal });
  },

  remove(itemId) {
    if (!itemId) return;
    _deletedIds.add(itemId);
    const before = _state.items.length;
    const nextItems = (_state.items || []).filter(Boolean).filter((it) => it.id !== itemId);
    if (nextItems.length !== before) {
      _set({
        items: nextItems,
        total: Math.max(0, _state.total - (before - nextItems.length)),
      });
    }
  },

  replaceAll(items, total) {
    const sorted = (items || []).filter(Boolean).slice().sort(_byCreatedDesc);
    const now = Date.now();
    _set({
      items: sorted,
      total: typeof total === 'number' ? total : sorted.length,
      lastFullSync: now,
      lastIncSync: now,
    });
  },

  reset() {
    _set({
      items: [],
      total: 0,
      lastFullSync: 0,
      lastIncSync: 0,
      error: null,
    });
  },
};
