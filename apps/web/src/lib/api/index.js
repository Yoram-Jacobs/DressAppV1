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
  calendar, misc, streamNdjson, sync, syncManager,
} from '@dressapp/api-client';

const STORAGE_TOKEN = 'dressapp.token';
const STORAGE_USER  = 'dressapp.user';

const { client, API_BASE, tokenStore, userStore } = createApiClient({
  getToken:  () => { try { return localStorage.getItem(STORAGE_TOKEN) || null; } catch { return null; } },
  setToken:  (t) => { try { localStorage.setItem(STORAGE_TOKEN, t); } catch { /* ignore */ } },
  clearToken: () => { try { localStorage.removeItem(STORAGE_TOKEN); } catch { /* ignore */ } },
  getUser:   () => { try { return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null'); } catch { return null; } },
  setUser:   (u) => { try { localStorage.setItem(STORAGE_USER, JSON.stringify(u)); } catch { /* ignore */ } },
  clearUser: () => { try { localStorage.removeItem(STORAGE_USER); } catch { /* ignore */ } },
  onUnauthorized: () => {
    try {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } catch { /* ignore */ }
  },
  backendUrl: (process.env.REACT_APP_BACKEND_URL || '').trim(),
});

// ============================================================
// Backward-compatible merged `api` object
// (preserves `import { api } from '@/lib/api'` across 46+ files)
// ============================================================
export const api = buildApi();

// ============================================================
// Individual adapters (for focused imports)
// ============================================================
export { auth, users, closet, listings, transactions, stylist, outfits };
export { suitcase, admin, trends, professionals, promotions, pricing, share, avatar };
export { calendar, misc };
export { campaignApi };

// ============================================================
// Shared infrastructure exports (backward compatibility)
// ============================================================
export { client, API_BASE, tokenStore, userStore, streamNdjson, sync, syncManager };

// ============================================================
// Default export: the raw axios client
// ============================================================
export default client;
