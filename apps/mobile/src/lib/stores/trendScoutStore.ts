/**
 * apps/mobile/src/lib/stores/trendScoutStore.ts
 *
 * Singleton store for daily curated fashion trends & runway feeds.
 * Provides instant zero-latency rendering, AsyncStorage persistence, and useSyncExternalStore subscription.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect } from 'react';
import { toCountryCode } from '@mobile/lib/country';

export interface TrendCard {
  id: string;
  bucket?: string;
  category?: string;
  label?: string;
  tag?: string;
  title?: string;
  headline?: string;
  description?: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  gender?: string;
  is_local?: boolean;
  city?: string;
  country?: string;
  country_code?: string;
  date?: string;
}

interface TrendScoutState {
  cards: TrendCard[];
  loading: boolean;
  loadingKeys?: Record<string, boolean>;
  error: string | null;
  lastFetch: number;
}

const STORAGE_KEY = 'dressapp_mobile_trend_scout_cache_v3';
const FRESH_MS = 30 * 60 * 1000; // 30 minutes

const _cacheByKey = new Map<string, { cards: TrendCard[]; lastFetch: number; cachedDate: string; gender?: string }>();
const _inFlightByKey = new Map<string, Promise<void>>();

function buildCacheKey(language?: string | null, country?: string | null, gender?: string | null): string {
  const lang = (language || 'en').toString().split('-')[0].toLowerCase();
  const ctry = country ? toCountryCode(country) : '';
  const gen = (gender || 'all').toString().toLowerCase();
  return `${lang}:${ctry}:${gen}`;
}

function collectCardsForContext(language?: string | null, country?: string | null): TrendCard[] {
  const targetPrefix = `${(language || 'en').toString().split('-')[0].toLowerCase()}:${country ? toCountryCode(country) : ''}:`;
  const merged: TrendCard[] = [];
  const seen = new Set<string>();
  for (const [k, entry] of _cacheByKey.entries()) {
    if (!k.startsWith(targetPrefix)) continue;
    const entryGender = entry.gender && entry.gender !== 'all' ? entry.gender : undefined;
    for (const c of entry.cards) {
      const normalized = entryGender && !c.gender ? { ...c, gender: entryGender } : c;
      const dedupId = normalized.id || `${normalized.gender || ''}:${normalized.source_url || normalized.headline || ''}`;
      if (dedupId && seen.has(dedupId)) continue;
      if (dedupId) seen.add(dedupId);
      merged.push(normalized);
    }
  }
  return merged;
}

let _state: TrendScoutState = {
  cards: [],
  loading: false,
  loadingKeys: {},
  error: null,
  lastFetch: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function setState(updater: (prev: TrendScoutState) => TrendScoutState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      cards: _state.cards,
      lastFetch: _state.lastFetch,
      cachedGender: (_state as any).cachedGender,
      cachedLanguage: (_state as any).cachedLanguage,
      cachedDate: (_state as any).cachedDate,
    })
  ).catch(() => {});
}

// Hydrate from AsyncStorage on startup
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.cards)) {
        _state = {
          ..._state,
          cards: data.cards,
          lastFetch: data.lastFetch || 0,
          cachedGender: data.cachedGender,
          cachedLanguage: data.cachedLanguage,
          cachedDate: data.cachedDate,
        } as any;
        notify();
      }
    }
  } catch {}
})();

export const trendScoutStore = {
  getSnapshot(): TrendScoutState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(gender?: string | null, language?: string | null, country?: string | null): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const key = buildCacheKey(language, country, gender);
    const cached = _cacheByKey.get(key);
    if (cached) {
      return cached.cachedDate === today && Date.now() - cached.lastFetch < FRESH_MS && cached.cards.length > 0;
    }
    const timeFresh = Date.now() - _state.lastFetch < FRESH_MS && _state.cards.length > 0;
    const genderMatch = !gender || (_state as any).cachedGender === gender;
    const langMatch = !language || (_state as any).cachedLanguage === language;
    const dayMatch = (_state as any).cachedDate === today;
    return timeFresh && genderMatch && langMatch && dayMatch;
  },

  async prewarm(options: { language?: string; country?: string | null; gender?: string | null; force?: boolean } = {}): Promise<void> {
    const key = buildCacheKey(options.language, options.country, options.gender);
    const existingFlight = _inFlightByKey.get(key);
    if (existingFlight) {
      return existingFlight;
    }

    if (!options.force && this.isFresh(options.gender, options.language, options.country)) {
      const merged = collectCardsForContext(options.language, options.country);
      if (merged.length > 0) {
        setState((prev) => ({
          ...prev,
          cards: merged,
          error: null,
        }));
      }
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setState((prev) => ({
      ...prev,
      loading: true,
      loadingKeys: { ...(prev.loadingKeys || {}), [key]: true },
      error: null,
    }));

    const flight = (async () => {
      try {
        const feedParams: any = {
          language: options.language || 'en',
          country: options.country ? toCountryCode(options.country) : undefined,
          gender: options.gender || undefined,
        };
        if (options.force) {
          feedParams._t = Date.now();
        }
        const res = await api.fashionScoutFeed(30, feedParams);
        const rawList = Array.isArray(res?.cards) ? res.cards : (Array.isArray(res) ? res : []);
        const seenUrls = new Set<string>();
        const seenImgs = new Set<string>();
        const cards = rawList
          .filter((it: any) => {
            const u = (it?.source_url || '').trim().toLowerCase();
            const img = (it?.image_url || '').trim().toLowerCase();
            if (!u.startsWith('http') || u.includes('example.com') || u.includes('shopisrael.com')) {
              return false;
            }
            if (seenUrls.has(u)) return false;
            seenUrls.add(u);
            if (img && seenImgs.has(img)) return false;
            if (img) seenImgs.add(img);
            return true;
          })
          .map((it: any, idx: number) => {
            const rawImg = it.image_url || '';
            const isBroken = rawImg.includes('ynet-pic1.ynet.co.il') || rawImg.includes('example.com') || rawImg.includes('photo-1617127365659-c47fa864d8bc') || !rawImg.startsWith('http');
            return {
              ...it,
              id: it.id || `trend-${idx}`,
              gender: it.gender || options.gender || undefined,
              title: it.title || it.headline || '',
              description: it.description || it.summary || '',
              image_url: isBroken ? undefined : it.image_url,
            };
          });

        const now = Date.now();
        _cacheByKey.set(key, {
          cards,
          lastFetch: now,
          cachedDate: today,
          gender: options.gender || undefined,
        });
        const mergedCards = collectCardsForContext(options.language, options.country);
        setState((prev) => ({
          ...prev,
          cards: mergedCards.length > 0 ? mergedCards : cards,
          lastFetch: now,
          cachedGender: options.gender || undefined,
          cachedLanguage: options.language || 'en',
          cachedDate: today,
          error: null,
        } as any));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err?.message || 'Failed to load trends',
        }));
      } finally {
        _inFlightByKey.delete(key);
        setState((prev) => {
          const nextLoadingKeys = { ...(prev.loadingKeys || {}) };
          delete nextLoadingKeys[key];
          return {
            ...prev,
            loading: _inFlightByKey.size > 0,
            loadingKeys: nextLoadingKeys,
          };
        });
      }
    })();

    _inFlightByKey.set(key, flight);
    return flight;
  },

  reset(): void {
    _cacheByKey.clear();
    _inFlightByKey.clear();
    _state = {
      cards: [],
      loading: false,
      loadingKeys: {},
      error: null,
      lastFetch: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useTrendScoutStore(options: { prewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    trendScoutStore.subscribe,
    trendScoutStore.getSnapshot,
    trendScoutStore.getSnapshot
  );

  useEffect(() => {
    if (options.prewarm && !trendScoutStore.isFresh() && !state.loading && state.cards.length === 0) {
      trendScoutStore.prewarm().catch(() => {});
    }
  }, [options.prewarm, state.loading, state.cards.length]);

  return {
    ...state,
    prewarm: trendScoutStore.prewarm.bind(trendScoutStore),
    reset: trendScoutStore.reset.bind(trendScoutStore),
  };
}
