/**
 * apps/mobile/src/lib/stores/suitcaseStore.ts
 *
 * Suitcase packing assistant state store for DressApp mobile.
 * Parity with apps/web/src/lib/suitcaseStore.js.
 */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

const FRESH_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'dressapp_suitcase_store_state';

export interface SuitcaseItem {
  id?: string;
  name?: string;
  category?: string;
  count?: number;
  packed?: boolean;
  is_packed?: boolean;
  image_url?: string;
  thumbnail_data_url?: string;
  closet_item_id?: string;
  title?: string;
  role?: string;
}

export interface SuitcaseOutfit {
  day?: number;
  occasion?: string;
  items?: SuitcaseItem[];
  harmony_score?: number;
}

export interface PackingData {
  packing_list?: SuitcaseItem[];
  outfits?: SuitcaseOutfit[];
  danger_zones_info?: string;
  cultural_guidelines?: string;
  local_fashion_stores?: any[];
  missing_items?: any[];
}

export interface SuitcaseChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ActiveSuitcase {
  id?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  days?: number;
  purpose?: string;
  status?: string;
  packing_list?: SuitcaseItem[];
  outfits?: SuitcaseOutfit[];
  messages?: SuitcaseChatMessage[];
  missing_notes?: string;
  local_fashion_stores?: any[];
  missing_items?: any[];
  items?: SuitcaseItem[];
}

export interface SuitcaseStoreState {
  activeSuitcase: ActiveSuitcase | null;
  viewState: 'gathering' | 'reviewing' | 'active';
  packingData: PackingData | null;
  messages: SuitcaseChatMessage[];
  archives: any[];
  loading: boolean;
  archiveLoading: boolean;
  error: any | null;
  lastFullSync: number;
}

const defaultWelcomeMessage = (t?: any): SuitcaseChatMessage[] => [
  {
    role: 'assistant',
    text: t
      ? t('suitcase.welcomeChat', {
          defaultValue:
            'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.',
        })
      : 'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.',
  },
];

let _state: SuitcaseStoreState = {
  activeSuitcase: null,
  viewState: 'gathering',
  packingData: null,
  messages: defaultWelcomeMessage(),
  archives: [],
  loading: false,
  archiveLoading: false,
  error: null,
  lastFullSync: 0,
};

const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function _set(patch: Partial<SuitcaseStoreState>) {
  _state = { ..._state, ...patch };
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeSuitcase: _state.activeSuitcase,
      viewState: _state.viewState,
      packingData: _state.packingData,
      messages: _state.messages,
      archives: _state.archives,
      lastFullSync: _state.lastFullSync,
    })
  ).catch(console.warn);
  _notify();
}

// Hydrate from AsyncStorage on startup
AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      _state = {
        ..._state,
        ...parsed,
        loading: false,
        archiveLoading: false,
        error: null,
      };
      _notify();
    } catch {
      /* ignore */
    }
  }
});

export const suitcaseStore = {
  getSnapshot(): SuitcaseStoreState {
    return _state;
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ force = false, t = null }: { force?: boolean; t?: any } = {}) {
    if (!force && _state.loading) return _state;
    if (!force && _state.lastFullSync && Date.now() - _state.lastFullSync < FRESH_MS) {
      return _state;
    }

    const initialMessages =
      _state.messages.length === 0 ? defaultWelcomeMessage(t) : _state.messages;
    _set({ messages: initialMessages, loading: true, archiveLoading: true, error: null });

    try {
      const [activeRes, archiveRes] = await Promise.all([
        (api as any).getSuitcaseActive().catch(() => ({ active: false })),
        (api as any).getSuitcaseArchive().catch(() => []),
      ]);

      const activeSuitcase = activeRes.active ? activeRes.suitcase : null;
      const viewState = activeRes.active ? activeRes.suitcase.status || 'active' : 'gathering';
      const archives = archiveRes || [];
      const messages =
        activeSuitcase && activeSuitcase.messages && activeSuitcase.messages.length > 0
          ? activeSuitcase.messages
          : defaultWelcomeMessage(t);

      let packingData: PackingData | null = null;
      if (activeSuitcase) {
        packingData = {
          packing_list: activeSuitcase.packing_list || activeSuitcase.items || [],
          outfits: activeSuitcase.outfits || [],
          danger_zones_info: activeSuitcase.missing_notes || '',
          cultural_guidelines: activeSuitcase.missing_notes || '',
          local_fashion_stores: activeSuitcase.local_fashion_stores || [],
          missing_items: activeSuitcase.missing_items || [],
        };
      }

      _set({
        activeSuitcase,
        viewState,
        archives,
        messages,
        packingData,
        lastFullSync: Date.now(),
      });
    } catch (err) {
      _set({ error: err });
    } finally {
      _set({ loading: false, archiveLoading: false });
    }
    return _state;
  },

  updateViewState(viewState: 'gathering' | 'reviewing' | 'active') {
    _set({ viewState });
  },

  updateActiveSuitcase(activeSuitcase: ActiveSuitcase | null) {
    let packingData = _state.packingData;
    if (activeSuitcase) {
      packingData = {
        packing_list: activeSuitcase.packing_list || activeSuitcase.items || [],
        outfits: activeSuitcase.outfits || [],
        danger_zones_info: activeSuitcase.missing_notes || '',
        cultural_guidelines: activeSuitcase.missing_notes || '',
        local_fashion_stores: activeSuitcase.local_fashion_stores || [],
        missing_items: activeSuitcase.missing_items || [],
      };
    }
    _set({ activeSuitcase, packingData });
  },

  updatePackingData(packingData: PackingData | null) {
    _set({ packingData });
  },

  updateMessages(messages: SuitcaseChatMessage[]) {
    _set({ messages });
  },

  updateArchives(archives: any[]) {
    _set({ archives });
  },

  reset(t?: any) {
    _set({
      activeSuitcase: null,
      viewState: 'gathering',
      packingData: null,
      messages: defaultWelcomeMessage(t),
      archives: [],
      loading: false,
      archiveLoading: false,
      error: null,
      lastFullSync: 0,
    });
  },
};

export function useSuitcaseStore(): SuitcaseStoreState {
  return useSyncExternalStore(
    suitcaseStore.subscribe,
    suitcaseStore.getSnapshot,
    suitcaseStore.getSnapshot
  );
}
