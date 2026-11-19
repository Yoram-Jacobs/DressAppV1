/**
 * packages/api-client/src/_singleton.js
 *
 * Internal singleton holder. Domain modules (auth.js, closet.js, etc.)
 * import `client`, `tokenStore`, and `API_BASE` from here so they share
 * the same configured instance that was set up by createApiClient().
 *
 * Do NOT import this from outside the package.
 */

import axios from 'axios';

export const _isBrowser = typeof document !== 'undefined' && typeof document.cookie === 'string';
export function _getCsrfCookie() {
  if (!_isBrowser) return null;
  const m = document.cookie.match(/(?:^|;\s*)dressapp_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function _setHeader(headers, name, value) {
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set(name, value);
  } else {
    headers[name] = value;
  }
}

export function _attachCsrfHeader(cfg) {
  const method = (cfg.method || 'get').toUpperCase();
  if (_isBrowser && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = _getCsrfCookie();
    if (csrf) {
      cfg.headers = cfg.headers || {};
      _setHeader(cfg.headers, 'X-CSRF-Token', csrf);
    }
  }
  return cfg;
}

// Mutable holders — overwritten once by createApiClient()
export let client = axios.create({
  baseURL: '/api/v1',
  timeout: 180000,
  withCredentials: _isBrowser,
});
client.interceptors.request.use((cfg) => _attachCsrfHeader(cfg));
export let API_BASE = '/api/v1';
export let tokenStore = {
  get: () => null,
  set: () => {},
  clear: () => {},
};
export let userStore = {
  get: () => null,
  set: () => {},
};

/**
 * Called by createApiClient() after building the real axios instance.
 * Replaces the module-level exports so that domain modules already
 * imported see the configured values.
 */
export function _setSingleton(newClient, newApiBase, newTokenStore, newUserStore) {
  // We can't re-assign `export let` from outside the module in ESM,
  // so we mutate the properties of the singleton objects instead.
  // For `client` (an axios instance) we copy all properties.
  Object.assign(client.defaults, newClient.defaults);
  // Swap interceptors
  client.interceptors.request.handlers = newClient.interceptors.request.handlers;
  client.interceptors.response.handlers = newClient.interceptors.response.handlers;
  API_BASE = newApiBase;
  Object.assign(tokenStore, newTokenStore);
  Object.assign(userStore, newUserStore);
}
