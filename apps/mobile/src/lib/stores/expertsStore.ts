/**
 * apps/mobile/src/lib/stores/expertsStore.ts
 *
 * Singleton store for verified stylists, experts directory, and fashion campaigns.
 * Provides instant zero-latency rendering, AsyncStorage persistence, and useSyncExternalStore subscription.
 */

import { api } from '@mobile/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect } from 'react';

export interface ExpertItem {
  id: string;
  user_id?: string;
  name?: string;
  display_name: string;
  face_photo_url?: string;
  avatar_url?: string;
  rating?: number;
  reviews_count?: number;
  specialty?: string;
  bio?: string;
  email?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  city?: string;
  country?: string;
  region?: string;
  verified?: boolean;
  professional?: {
    is_professional?: boolean;
    profession?: string;
    approval_status?: string;
    business?: {
      description?: string;
      email?: string;
      phone?: string;
      website?: string;
    };
    services?: Array<{ name: string; price: number; duration_mins?: number }>;
  };
  address?: {
    city?: string;
    country?: string;
  };
  home_location?: {
    city?: string;
    country?: string;
  };
}

export interface CampaignItem {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  brand_name?: string;
  discount_code?: string;
  discount_percent?: number;
  banner_url?: string;
  target_url?: string;
  starts_at?: string;
  expires_at?: string;
  is_active?: boolean;
}

interface ExpertsState {
  experts: ExpertItem[];
  campaigns: CampaignItem[];
  totalExperts: number;
  loading: boolean;
  error: string | null;
  lastSync: number;
}

const STORAGE_KEY = 'dressapp_mobile_experts_cache';
const FRESH_MS = 10 * 60 * 1000; // 10 minutes

let _state: ExpertsState = {
  experts: [],
  campaigns: [],
  totalExperts: 0,
  loading: false,
  error: null,
  lastSync: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function setState(updater: (prev: ExpertsState) => ExpertsState) {
  _state = updater(_state);
  notify();
  // Persist to AsyncStorage asynchronously
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      experts: _state.experts,
      campaigns: _state.campaigns,
      totalExperts: _state.totalExperts,
      lastSync: _state.lastSync,
    })
  ).catch(() => {});
}

// Hydrate from AsyncStorage on startup
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.experts)) {
        _state = {
          ..._state,
          experts: data.experts,
          campaigns: data.campaigns || [],
          totalExperts: data.totalExperts || data.experts.length,
          lastSync: data.lastSync || 0,
        };
        notify();
      }
    }
  } catch {}
})();

function normalizeExpert(p: any): ExpertItem {
  const dName = p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Style Expert';
  const rawPhone = p.phone || p.professional?.business?.phone || '';
  const cleanPhone = typeof rawPhone === 'string' && rawPhone.trim().length > 3 ? rawPhone.trim() : undefined;
  return {
    ...p,
    id: String(p.id || p._id || `expert_${Date.now()}_${Math.random()}`),
    display_name: dName,
    name: dName,
    avatar_url: p.avatar_url || p.face_photo_url || undefined,
    specialty: p.professional?.profession || p.specialty || 'Fashion Stylist',
    bio: p.professional?.business?.description || p.bio || '',
    email: p.professional?.business?.email || p.email || undefined,
    phone: cleanPhone,
    instagram: p.instagram || undefined,
    website: p.professional?.business?.website || p.website || undefined,
    city: p.address?.city || p.home_location?.city || p.city || undefined,
    country: p.address?.country || p.home_location?.country || p.country || undefined,
    verified: p.professional?.approval_status === 'approved' || p.professional?.approval_status === 'self' || Boolean(p.verified),
  };
}

export const expertsStore = {
  getSnapshot(): ExpertsState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isFresh(): boolean {
    return Date.now() - _state.lastSync < FRESH_MS && _state.experts.length > 0;
  },

  async prewarm(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && this.isFresh()) return;
    await Promise.allSettled([
      this.fetchExperts({}, { force: options.force }),
      this.fetchCampaigns(),
    ]);
  },

  async fetchExperts(params: Record<string, any> = {}, { force = false } = {}): Promise<void> {
    const hasFilter = Object.keys(params).length > 0;
    if (!force && !hasFilter && this.isFresh()) {
      return;
    }

    setState((prev) => ({ ...prev, loading: prev.experts.length === 0, error: null }));
    try {
      const data = await api.listProfessionals(params);
      const rawList = Array.isArray(data) ? data : (data?.experts || data?.items || data?.professionals || []);
      const items = rawList.map(normalizeExpert);

      setState((prev) => ({
        ...prev,
        experts: items,
        totalExperts: data?.total || items.length,
        loading: false,
        lastSync: Date.now(),
        error: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Failed to load experts',
      }));
    }
  },

  async fetchCampaigns(): Promise<void> {
    try {
      const data = await api.getCampaignFeed({});
      const rawList = Array.isArray(data) ? data : (data?.campaigns || data?.items || data?.feed || []);
      const items = rawList.map((it: any) => ({ ...it, id: it.id || it._id }));
      setState((prev) => ({ ...prev, campaigns: items }));
    } catch {}
  },

  reset(): void {
    _state = {
      experts: [],
      campaigns: [],
      totalExperts: 0,
      loading: false,
      error: null,
      lastSync: 0,
    };
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useExpertsStore(options: { prewarm?: boolean } = {}) {
  const state = useSyncExternalStore(
    expertsStore.subscribe,
    expertsStore.getSnapshot,
    expertsStore.getSnapshot
  );

  useEffect(() => {
    if (options.prewarm && !expertsStore.isFresh() && !state.loading && state.experts.length === 0) {
      expertsStore.prewarm().catch(() => {});
    }
  }, [options.prewarm, state.loading, state.experts.length]);

  return {
    ...state,
    prewarm: expertsStore.prewarm.bind(expertsStore),
    fetchExperts: expertsStore.fetchExperts.bind(expertsStore),
    fetchCampaigns: expertsStore.fetchCampaigns.bind(expertsStore),
    reset: expertsStore.reset.bind(expertsStore),
  };
}
