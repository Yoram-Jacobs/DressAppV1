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

let _activeClient = axios.create({ baseURL: '/api/v1', timeout: 180000 });
let _activeApiBase = '/api/v1';

export const tokenStore = {
  get: () => null,
  set: () => {},
  clear: () => {},
};

export const userStore = {
  get: () => null,
  set: () => {},
};

export const API_BASE = '/api/v1';

/**
 * Proxy that delegates all Axios calls to `_activeClient`.
 * This avoids mutating internal Axios properties (like interceptors.handlers)
 * which throws 'TypeError: property is not writable' in Hermes/strict mode.
 */
export const client = new Proxy(
  function (...args) {
    return _activeClient(...args);
  },
  {
    get(target, prop) {
      const val = _activeClient[prop];
      if (typeof val === 'function') {
        return val.bind(_activeClient);
      }
      return val;
    },
    set(target, prop, value) {
      _activeClient[prop] = value;
      return true;
    },
  }
);

/**
 * Called by createApiClient() after building the real axios instance.
 * Sets the active client reference and updates token/user stores.
 */
export function _setSingleton(newClient, newApiBase, newTokenStore, newUserStore) {
  _activeClient = newClient;
  _activeApiBase = newApiBase;
  if (newTokenStore) {
    tokenStore.get = newTokenStore.get;
    tokenStore.set = newTokenStore.set;
    tokenStore.clear = newTokenStore.clear;
  }
  if (newUserStore) {
    userStore.get = newUserStore.get;
    userStore.set = newUserStore.set;
  }
}

