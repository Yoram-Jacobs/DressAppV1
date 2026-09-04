import { useSyncExternalStore } from 'react';
import { api, campaignApi } from './api';

const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes

let _state = {
  overview: null,
  providersSummary: null,
  llmUsage: null,
  trends: null,
  users: null,
  usersQuery: '',
  usersTotal: 0,
  listings: null,
  listingsStatus: '',
  transactions: null,
  transactionsStatus: '',
  system: null,
  campaigns: null,
  campaignsStatus: 'pending_approval',

  // timestamps
  lastOverviewSync: 0,
  lastProvidersSync: 0,
  lastTrendsSync: 0,
  lastUsersSync: 0,
  lastListingsSync: 0,
  lastTransactionsSync: 0,
  lastSystemSync: 0,
  lastCampaignsSync: 0,

  // loading states
  loadingOverview: false,
  loadingProviders: false,
  loadingTrends: false,
  loadingUsers: false,
  loadingListings: false,
  loadingTransactions: false,
  loadingSystem: false,
  loadingCampaigns: false,
};

const _listeners = new Set();

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  _notify();
}

export const adminStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async loadOverview({ force = false } = {}) {
    const isFresh = _state.overview && (Date.now() - _state.lastOverviewSync < CACHE_LIFETIME);
    if (!force && isFresh) return _state.overview;

    _set({ loadingOverview: true });
    try {
      const data = await api.adminOverview();
      _set({
        overview: data,
        lastOverviewSync: Date.now(),
      });
      return data;
    } finally {
      _set({ loadingOverview: false });
    }
  },

  async loadProviders({ force = false } = {}) {
    const isFresh = _state.providersSummary && _state.llmUsage && (Date.now() - _state.lastProvidersSync < CACHE_LIFETIME);
    if (!force && isFresh) return { summary: _state.providersSummary, usage: _state.llmUsage };

    _set({ loadingProviders: true });
    try {
      const [p, u] = await Promise.all([api.adminProviders(), api.adminLlmUsage()]);
      _set({
        providersSummary: p?.summary || [],
        llmUsage: u,
        lastProvidersSync: Date.now(),
      });
      return { summary: p?.summary || [], usage: u };
    } finally {
      _set({ loadingProviders: false });
    }
  },

  async loadTrends({ force = false } = {}) {
    const isFresh = _state.trends && (Date.now() - _state.lastTrendsSync < CACHE_LIFETIME);
    if (!force && isFresh) return _state.trends;

    _set({ loadingTrends: true });
    try {
      const res = await api.adminTrendScout(30);
      const items = res.items || [];
      _set({
        trends: items,
        lastTrendsSync: Date.now(),
      });
      return items;
    } finally {
      _set({ loadingTrends: false });
    }
  },

  async loadUsers({ q = '', force = false } = {}) {
    const isSameQuery = _state.usersQuery === q;
    const isFresh = _state.users && isSameQuery && (Date.now() - _state.lastUsersSync < CACHE_LIFETIME);
    if (!force && isFresh) return { items: _state.users, total: _state.usersTotal };

    _set({ loadingUsers: true, usersQuery: q });
    try {
      const res = await api.adminUsers({ q: q || undefined, limit: 50 });
      const items = res.items || [];
      const total = res.total || 0;
      _set({
        users: items,
        usersTotal: total,
        lastUsersSync: Date.now(),
      });
      return { items, total };
    } finally {
      _set({ loadingUsers: false });
    }
  },

  async loadListings({ status = '', force = false } = {}) {
    const isSameStatus = _state.listingsStatus === status;
    const isFresh = _state.listings && isSameStatus && (Date.now() - _state.lastListingsSync < CACHE_LIFETIME);
    if (!force && isFresh) return _state.listings;

    _set({ loadingListings: true, listingsStatus: status });
    try {
      const res = await api.adminListings({ status: status || undefined, limit: 100 });
      const items = res.items || [];
      _set({
        listings: items,
        lastListingsSync: Date.now(),
      });
      return items;
    } finally {
      _set({ loadingListings: false });
    }
  },

  async loadTransactions({ status = '', force = false } = {}) {
    const isSameStatus = _state.transactionsStatus === status;
    const isFresh = _state.transactions && isSameStatus && (Date.now() - _state.lastTransactionsSync < CACHE_LIFETIME);
    if (!force && isFresh) return _state.transactions;

    _set({ loadingTransactions: true, transactionsStatus: status });
    try {
      const res = await api.adminTransactions({ status: status || undefined, limit: 100 });
      const items = res.items || [];
      _set({
        transactions: items,
        lastTransactionsSync: Date.now(),
      });
      return items;
    } finally {
      _set({ loadingTransactions: false });
    }
  },

  async loadSystem({ force = false } = {}) {
    const isFresh = _state.system && (Date.now() - _state.lastSystemSync < CACHE_LIFETIME);
    if (!force && isFresh) return _state.system;

    _set({ loadingSystem: true });
    try {
      const data = await api.adminSystem();
      _set({
        system: data,
        lastSystemSync: Date.now(),
      });
      return data;
    } finally {
      _set({ loadingSystem: false });
    }
  },

  async loadCampaigns({ status = 'pending_approval', force = false } = {}) {
    const isSameStatus = _state.campaignsStatus === status;
    const isFresh = _state.campaigns && isSameStatus && (Date.now() - _state.lastCampaignsSync < CACHE_LIFETIME);
    if (!force && isFresh) return _state.campaigns;

    _set({ loadingCampaigns: true, campaignsStatus: status });
    try {
      const res = await campaignApi.adminGetCampaignQueue({ status: status === 'all' ? undefined : status, limit: 100 });
      const items = res.items || [];
      _set({
        campaigns: items,
        lastCampaignsSync: Date.now(),
      });
      return items;
    } finally {
      _set({ loadingCampaigns: false });
    }
  },

  invalidateAll() {
    _set({
      lastOverviewSync: 0,
      lastProvidersSync: 0,
      lastTrendsSync: 0,
      lastUsersSync: 0,
      lastListingsSync: 0,
      lastTransactionsSync: 0,
      lastSystemSync: 0,
      lastCampaignsSync: 0,
    });
  },

  reset() {
    _state = {
      overview: null,
      providersSummary: null,
      llmUsage: null,
      trends: null,
      users: null,
      usersQuery: '',
      usersTotal: 0,
      listings: null,
      listingsStatus: '',
      transactions: null,
      transactionsStatus: '',
      system: null,
      campaigns: null,
      campaignsStatus: 'pending_approval',
      lastOverviewSync: 0,
      lastProvidersSync: 0,
      lastTrendsSync: 0,
      lastUsersSync: 0,
      lastListingsSync: 0,
      lastTransactionsSync: 0,
      lastSystemSync: 0,
      lastCampaignsSync: 0,
      loadingOverview: false,
      loadingProviders: false,
      loadingTrends: false,
      loadingUsers: false,
      loadingListings: false,
      loadingTransactions: false,
      loadingSystem: false,
      loadingCampaigns: false,
    };
    _notify();
  }
};

export function useAdminStore() {
  return useSyncExternalStore(
    adminStore.subscribe,
    adminStore.getSnapshot,
    adminStore.getSnapshot
  );
}
