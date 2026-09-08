/**
 * apps/mobile/src/lib/stores/marketplaceStore.ts
 *
 * Singleton store for marketplace listings, transactions, and user's active listings.
 * Provides instant zero-latency rendering, AsyncStorage caching, and useSyncExternalStore subscription.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect } from 'react';

export interface ListingItem {
  id: string;
  user_id?: string;
  closet_item_id?: string;
  title: string;
  description?: string;
  price_cents?: number;
  currency?: string;
  listing_type?: 'sale' | 'swap' | 'donate' | 'rent';
  status?: 'active' | 'sold' | 'draft' | 'cancelled';
  condition?: string;
  category?: string;
  brand?: string;
  size?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  seller_name?: string;
  seller_avatar?: string;
  location?: string;
  distance_km?: number;
  created_at?: string;
  source?: string;
  mode?: string;
  is_retail?: boolean;
  financial_metadata?: any;
}

export interface TransactionItem {
  id: string;
  listing_id?: string;
  listing_title?: string;
  buyer_id?: string;
  seller_id?: string;
  title?: string;
  amount_cents?: number;
  currency?: string;
  status?: 'pending' | 'completed' | 'cancelled' | 'shipped';
  created_at?: string;
  role?: 'buyer' | 'seller';
  image_url?: string;
}

interface MarketplaceState {
  browseItems: ListingItem[];
  myListings: ListingItem[];
  transactions: TransactionItem[];
  totalBrowse: number;
  loading: boolean;
  error: string | null;
  lastFetch: number;
  lastTxFetch: number;
}

const STORAGE_KEY = 'dressapp_mobile_marketplace_cache';
const FRESH_MS = 5 * 60 * 1000; // 5 minutes

let _state: MarketplaceState = {
  browseItems: [],
  myListings: [],
  transactions: [],
  totalBrowse: 0,
  loading: false,
  error: null,
  lastFetch: 0,
  lastTxFetch: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function setState(updater: (prev: MarketplaceState) => MarketplaceState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      browseItems: _state.browseItems,
      myListings: _state.myListings,
      transactions: _state.transactions,
      totalBrowse: _state.totalBrowse,
      lastFetch: _state.lastFetch,
      lastTxFetch: _state.lastTxFetch,
    })
  ).catch(() => {});
}

// Hydrate from AsyncStorage on startup
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data) {
        _state = {
          ..._state,
          browseItems: data.browseItems || [],
          myListings: data.myListings || [],
          transactions: data.transactions || [],
          totalBrowse: data.totalBrowse || (data.browseItems ? data.browseItems.length : 0),
          lastFetch: data.lastFetch || 0,
          lastTxFetch: data.lastTxFetch || 0,
        };
        notify();
      }
    }
  } catch {}
})();

function getSafeImageUri(it: any): string | undefined {
  const isSafe = (url: any) =>
    typeof url === 'string' &&
    url.trim().length > 0 &&
    (!url.startsWith('data:image/') || url.length <= 250000);

  if (isSafe(it.thumbnail_data_url)) return it.thumbnail_data_url.trim();
  if (isSafe(it.image_url)) return it.image_url.trim();
  if (Array.isArray(it.images) && it.images.length > 0 && isSafe(it.images[0])) {
    return it.images[0].trim();
  }
  return undefined;
}

function normalizeListing(it: any): ListingItem {
  const safeImg = getSafeImageUri(it);
  return {
    id: String(it.id || it._id || `listing_${Date.now()}_${Math.random()}`),
    user_id: it.seller_id || it.user_id,
    closet_item_id: it.closet_item_id,
    title: String(it.title || 'Untitled'),
    description: String(it.description || ''),
    listing_type: (it.listing_type || it.mode || 'sale') as any,
    status: it.status || 'active',
    condition: it.condition || 'good',
    category: it.category || 'Top',
    brand: it.brand || '',
    size: it.size || '',
    price_cents: typeof it.price_cents === 'number' ? it.price_cents : (it.financial_metadata?.list_price_cents ?? 0),
    currency: it.currency || it.financial_metadata?.currency || 'USD',
    image_url: safeImg,
    thumbnail_data_url: safeImg,
    seller_name: it.seller_name,
    seller_avatar: it.seller_avatar,
    location: typeof it.location === 'string' ? it.location : it.location?.city || '',
    distance_km: typeof it.distance_km === 'number' ? it.distance_km : undefined,
    created_at: it.created_at || '',
    source: it.source || (it.is_retail ? 'Retail' : 'Shared'),
    mode: it.mode || it.listing_type || 'sell',
    is_retail: it.source === 'Retail' || !!it.is_retail,
    financial_metadata: it.financial_metadata,
  };
}

export const marketplaceStore = {
  getSnapshot(): MarketplaceState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastFetch < FRESH_MS && _state.browseItems.length > 0;
  },

  async prewarm(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh()) return;
    await Promise.allSettled([
      this.fetchBrowse({}, { force: options.force }),
      this.fetchTransactions({ force: options.force }),
    ]);
  },

  async fetchBrowse(params: Record<string, any> = {}, { force = false } = {}): Promise<void> {
    const hasFilter = Object.keys(params).length > 0;
    if (!force && !hasFilter && this.isFresh()) {
      return;
    }

    setState((prev) => ({ ...prev, loading: prev.browseItems.length === 0, error: null }));
    try {
      const data = await api.listListings(params);
      const rawList = Array.isArray(data) ? data : (data?.items || data?.listings || []);
      const items = rawList.map(normalizeListing);

      setState((prev) => ({
        ...prev,
        browseItems: items,
        totalBrowse: data?.total || items.length,
        loading: false,
        lastFetch: Date.now(),
        error: null,
      }));
    } catch (err: any) {
      console.warn('Failed to load marketplace listings:', err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load marketplace listings',
      }));
    }
  },

  async fetchMyListings(force = false): Promise<void> {
    try {
      const me = await api.getMe().catch(() => null);
      const sellerId = me?.id || me?._id;
      const params = sellerId ? { seller_id: sellerId } : {};
      const data = await api.listListings(params);
      const rawList = Array.isArray(data) ? data : (data?.items || data?.listings || []);
      const items = rawList.map(normalizeListing);
      setState((prev) => ({ ...prev, myListings: items }));
    } catch (err) {
      console.warn('Failed to load my listings:', err);
    }
  },

  async fetchTransactions({ force = false } = {}): Promise<void> {
    if (!force && Date.now() - _state.lastTxFetch < FRESH_MS && _state.transactions.length > 0) {
      return;
    }
    try {
      const data = await api.listTransactions();
      const rawList = Array.isArray(data) ? data : (data?.transactions || data?.items || []);
      const items = rawList.map((it: any) => ({
        ...it,
        id: it.id || it._id,
        listing_title: it.listing_title || it.title,
      }));
      setState((prev) => ({ ...prev, transactions: items, lastTxFetch: Date.now() }));
    } catch (err) {
      console.warn('Failed to load transactions:', err);
    }
  },

  upsertListing(listing: ListingItem): void {
    setState((prev) => {
      const bIdx = prev.browseItems.findIndex((x) => x.id === listing.id);
      const mIdx = prev.myListings.findIndex((x) => x.id === listing.id);

      const nextBrowse = bIdx >= 0
        ? prev.browseItems.map((x, i) => i === bIdx ? { ...x, ...listing } : x)
        : [listing, ...prev.browseItems];

      const nextMy = mIdx >= 0
        ? prev.myListings.map((x, i) => i === mIdx ? { ...x, ...listing } : x)
        : [listing, ...prev.myListings];

      return {
        ...prev,
        browseItems: nextBrowse,
        myListings: nextMy,
        totalBrowse: nextBrowse.length,
      };
    });
  },

  removeListing(listingId: string): void {
    setState((prev) => ({
      ...prev,
      browseItems: prev.browseItems.filter((x) => x.id !== listingId),
      myListings: prev.myListings.filter((x) => x.id !== listingId),
      totalBrowse: Math.max(0, prev.totalBrowse - 1),
    }));
  },

  reset(): void {
    _state = {
      browseItems: [],
      myListings: [],
      transactions: [],
      totalBrowse: 0,
      loading: false,
      error: null,
      lastFetch: 0,
      lastTxFetch: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useMarketplaceStore(options: { prewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    marketplaceStore.subscribe,
    marketplaceStore.getSnapshot,
    marketplaceStore.getSnapshot
  );

  useEffect(() => {
    if (options.prewarm && !marketplaceStore.isFresh() && !state.loading && state.browseItems.length === 0) {
      marketplaceStore.prewarm().catch(() => {});
    }
  }, [options.prewarm, state.loading, state.browseItems.length]);

  return {
    ...state,
    prewarm: marketplaceStore.prewarm.bind(marketplaceStore),
    fetchBrowse: marketplaceStore.fetchBrowse.bind(marketplaceStore),
    fetchMyListings: marketplaceStore.fetchMyListings.bind(marketplaceStore),
    fetchTransactions: marketplaceStore.fetchTransactions.bind(marketplaceStore),
    upsertListing: marketplaceStore.upsertListing.bind(marketplaceStore),
    removeListing: marketplaceStore.removeListing.bind(marketplaceStore),
    reset: marketplaceStore.reset.bind(marketplaceStore),
  };
}
