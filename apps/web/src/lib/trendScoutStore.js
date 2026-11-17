/**
 * trendScoutStore — thread-safe external store for Trend Scout cards.
 *
 * Prevents continuous GET re-fetching on navigation returns.
 */
import { useSyncExternalStore, useMemo } from 'react';
import { api } from '@/lib/api';

const FRESH_MS = 15 * 60 * 1000; // 15 minutes cache window
const ERROR_COOLDOWN_MS = 15 * 1000; // 15 seconds cooldown on errors to prevent retry flooding

let _state = {
  cards: [],
  lastSync: 0,
  lastLanguage: null,
  lastCountry: null,
  lastGender: null,
  lastDate: null,
  loading: false,
  loadingKeys: {},
  error: null,
};

const _cacheByKey = new Map();
const _inFlightByKey = new Map();
const _lastErrorByKey = new Map();
const _listeners = new Set();

function _buildCacheKey(language, country, gender) {
  const lang = (language || 'en').toString().split('-')[0].toLowerCase();
  const ctry = (country || '').toString().toUpperCase();
  const gen = (gender || 'all').toString().toLowerCase();
  return `${lang}:${ctry}:${gen}`;
}

function _collectCardsForContext(language, country) {
  const targetPrefix = `${(language || 'en').toString().split('-')[0].toLowerCase()}:${(country || '').toString().toUpperCase()}:`;
  const merged = [];
  const seen = new Set();
  for (const [k, entry] of _cacheByKey.entries()) {
    if (!k.startsWith(targetPrefix)) continue;
    const entryGender = entry.gender && entry.gender !== 'all' ? entry.gender : null;
    for (const card of entry.cards || []) {
      const normalized = entryGender && !card?.gender ? { ...card, gender: entryGender } : card;
      const dedupId = normalized?.id || `${normalized?.gender || ''}:${normalized?.source_url || normalized?.headline || ''}`;
      if (dedupId && seen.has(dedupId)) continue;
      if (dedupId) seen.add(dedupId);
      merged.push(normalized);
    }
  }
  return merged;
}

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  _notify();
}

export const trendScoutStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  isKeyLoading({ language, country, gender } = {}) {
    const key = _buildCacheKey(language, country, gender);
    return Boolean(_state.loadingKeys?.[key]);
  },

  async prewarm({ language, country, gender, force = false } = {}) {
    const key = _buildCacheKey(language, country, gender);
    const existingFlight = _inFlightByKey.get(key);
    if (existingFlight) return existingFlight;

    const lastErrAt = _lastErrorByKey.get(key) || 0;
    if (!force && Date.now() - lastErrAt < ERROR_COOLDOWN_MS) {
      return _state;
    }

    const today = new Date().toISOString().slice(0, 10);
    const cached = _cacheByKey.get(key);
    if (!force && cached && cached.lastDate === today && Date.now() - cached.lastSync < FRESH_MS) {
      _set({
        cards: _collectCardsForContext(language, country),
        lastLanguage: language,
        lastCountry: country,
        lastGender: gender,
        lastDate: today,
        lastSync: cached.lastSync,
        loading: _inFlightByKey.size > 0,
        error: null,
      });
      return _state;
    }

    _set({
      loading: true,
      loadingKeys: { ..._state.loadingKeys, [key]: true },
      error: null,
    });

    const flightPromise = (async () => {
      try {
        const feedParams = { language, country, gender };
        if (force) {
          feedParams._t = Date.now();
        }
        const res = await api.fashionScoutFeed(30, feedParams);
        const rawCards = Array.isArray(res?.cards) ? res.cards : [];
        const cleanCards = rawCards
          .filter((c) => {
            const u = c?.source_url || '';
            return u.startsWith('http') && !u.includes('example.com') && !u.includes('shopisrael.com');
          })
          .map((c) => (gender && !c?.gender ? { ...c, gender } : c));
        const now = Date.now();
        _cacheByKey.set(key, {
          cards: cleanCards,
          lastSync: now,
          lastDate: today,
          language,
          country,
          gender,
        });
        _set({
          cards: _collectCardsForContext(language, country),
          lastLanguage: language,
          lastCountry: country,
          lastGender: gender,
          lastDate: today,
          lastSync: now,
        });
        return _state;
      } catch (err) {
        _lastErrorByKey.set(key, Date.now());
        console.warn('trendScoutStore.prewarm failed:', err);
        _set({ error: err });
        return _state;
      } finally {
        _inFlightByKey.delete(key);
        const nextLoadingKeys = { ..._state.loadingKeys };
        delete nextLoadingKeys[key];
        _set({
          loading: _inFlightByKey.size > 0,
          loadingKeys: nextLoadingKeys,
        });
      }
    })();

    _inFlightByKey.set(key, flightPromise);
    return flightPromise;
  },

  reset() {
    _cacheByKey.clear();
    _inFlightByKey.clear();
    _lastErrorByKey.clear();
    _state = {
      cards: [],
      lastSync: 0,
      lastLanguage: null,
      lastCountry: null,
      lastGender: null,
      lastDate: null,
      loading: false,
      loadingKeys: {},
      error: null,
    };
    _notify();
  },
};

const _subscribe = trendScoutStore.subscribe.bind(trendScoutStore);
const _getSnapshot = trendScoutStore.getSnapshot.bind(trendScoutStore);

export const prewarmTrendScout = trendScoutStore.prewarm.bind(trendScoutStore);

export function useTrendScoutStore() {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);

  return useMemo(
    () => ({
      ...snap,
      prewarm: prewarmTrendScout,
    }),
    [snap],
  );
}

export default trendScoutStore;
