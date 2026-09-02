/**
 * packages/api-client/src/client.js
 *
 * Platform-agnostic axios client factory.
 * Call createApiClient() once at app startup with platform-specific adapters.
 * See _singleton.js for the shared state that domain modules consume.
 */

import axios from 'axios';
import { _setSingleton } from './_singleton.js';

/**
 * @param {object} adapters
 * @param {() => string|null|Promise<string|null>} adapters.getToken
 * @param {(token: string) => void} adapters.setToken
 * @param {() => void} adapters.clearToken
 * @param {() => object|null} [adapters.getUser]
 * @param {(user: object) => void} [adapters.setUser]
 * @param {() => void} [adapters.clearUser]
 * @param {() => void} [adapters.onUnauthorized]
 * @param {string} [adapters.backendUrl]
 * @returns {{ client, API_BASE, tokenStore, userStore }}
 */
export function createApiClient({
  getToken,
  setToken,
  clearToken,
  getUser,
  setUser,
  clearUser,
  onUnauthorized,
  backendUrl = '',
} = {}) {
  const rawUrl = (backendUrl || '').trim();
  const BASE = (rawUrl && !rawUrl.endsWith('://') && rawUrl !== 'https://' && rawUrl !== 'http://')
    ? rawUrl.replace(/\/+$/, '')
    : '';
  const API_BASE = `${BASE}/api/v1`;

  const tokenStore = {
    get: () => (getToken ? (getToken() ?? null) : null),
    set: (t) => setToken?.(t),
    clear: () => {
      const p1 = clearToken?.();
      const p2 = clearUser?.();
      return Promise.all([Promise.resolve(p1), Promise.resolve(p2)]);
    },
  };

  const userStore = {
    get: () => (getUser ? (getUser() ?? null) : null),
    set: (u) => setUser?.(u),
  };

  const client = axios.create({ baseURL: API_BASE, timeout: 180000 });

  client.interceptors.request.use(async (cfg) => {
    let t = tokenStore.get();
    if (t && typeof t.then === 'function') {
      t = await t;
    }
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
  });

  client.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err?.response?.status === 401) {
        tokenStore.clear();
        onUnauthorized?.();
      }
      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'object') {
          err.response.data.detail = detail.message || JSON.stringify(detail);
        }
        const detailStr = String(err.response.data.detail || '');
        if (
          detailStr.includes('GEMINI_API_KEY') ||
          detailStr.includes('Gemini vision unavailable') ||
          detailStr.includes('No GEMINI_API_KEY')
        ) {
          import('./aiNotice.js').then(({ showAiKeyWarningToast }) => showAiKeyWarningToast()).catch(() => {});
        }
      }
      return Promise.reject(err);
    }
  );

  // Wire the singleton so domain modules (auth.js, closet.js, etc.)
  // see the configured client without needing to import it as a parameter.
  _setSingleton(client, API_BASE, tokenStore, userStore);

  return { client, API_BASE, tokenStore, userStore };
}
