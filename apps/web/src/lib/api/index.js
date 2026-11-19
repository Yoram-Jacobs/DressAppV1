/**
 * apps/web/src/lib/api/index.js
 *
 * Web adapter for @dressapp/api-client.
 *
 * Injects browser-specific adapters (localStorage token/user storage,
 * window.location redirect on 401) into the platform-agnostic factory.
 * All other web code that imports from '@/lib/api' continues to work
 * unchanged — this file re-exports everything the old module exposed.
 */
import { createApiClient, buildApi } from '@dressapp/api-client';
import { campaignApi } from '@dressapp/api-client';
import {
  auth, users, closet, listings, transactions, stylist, outfits,
  suitcase, admin, trends, professionals, promotions, pricing, share, avatar,
  calendar, misc, streamNdjson, sync,
} from '@dressapp/api-client';

import { getBackendUrl, isPublicPath } from './client.js';
import { createSafeSyncManager } from './syncClient.js';

const STORAGE_TOKEN = 'dressapp.token';
const STORAGE_USER  = 'dressapp.user';

const { client, API_BASE, tokenStore, userStore } = createApiClient({
  getToken:  () => null,
  setToken:  () => {},
  clearToken: () => { try { localStorage.removeItem(STORAGE_TOKEN); } catch { /* ignore */ } },
  getUser:   () => { try { return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null'); } catch { return null; } },
  setUser:   (u) => { try { localStorage.setItem(STORAGE_USER, JSON.stringify(u)); } catch { /* ignore */ } },
  clearUser: () => { try { localStorage.removeItem(STORAGE_USER); } catch { /* ignore */ } },
  onUnauthorized: () => {
    try {
      if (!isPublicPath(window.location.pathname)) {
        window.location.href = '/login';
      }
    } catch { /* ignore */ }
  },
  backendUrl: getBackendUrl(),
});

// ============================================================
// Backward-compatible merged `api` object
// (preserves `import { api } from '@/lib/api'` across 46+ files)
// ============================================================
const callableStylist = (formData, config) => stylist.stylist(formData, config);
Object.assign(callableStylist, stylist);

const syncManager = createSafeSyncManager(client, API_BASE);

export const api = buildApi();
api.outfits = outfits;
api.closet = closet;
api.misc = misc;
api.stylist = callableStylist;
api.trackAdImpression = (id, token) =>
  client
    .post(`/promotions/impression/${encodeURIComponent(id)}`, token ? { token } : {})
    .then((r) => r.data)
    .catch(() => null);
api.trackAdClick = (id, token) =>
  client
    .post(`/promotions/click/${encodeURIComponent(id)}`, token ? { token } : {})
    .then((r) => r.data)
    .catch(() => null);
if (promotions) {
  promotions.trackAdImpression = api.trackAdImpression;
  promotions.trackAdClick = api.trackAdClick;
}

// ============================================================
// Individual adapters (for focused imports)
// ============================================================
export { auth, users, closet, listings, transactions, callableStylist as stylist, outfits };
export { suitcase, admin, trends, professionals, promotions, pricing, share, avatar };
export { calendar, misc };
export { campaignApi };

// ============================================================
// Shared infrastructure exports (backward compatibility)
// ============================================================
export { client, API_BASE, tokenStore, userStore, streamNdjson, sync, syncManager };

// ============================================================
// Default export: the unified api object (with .client and raw verb helpers)
// ============================================================
api.client = client;
api.get = (...args) => client.get(...args);
api.post = (...args) => client.post(...args);
api.put = (...args) => client.put(...args);
api.patch = (...args) => client.patch(...args);
api.delete = (...args) => client.delete(...args);
export default api;
