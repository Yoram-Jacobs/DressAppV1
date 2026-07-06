/**
 * Backend client used by the service worker.
 *
 * The popup and content scripts NEVER call the API directly — they
 * always go through the background SW so the bearer token stays in
 * one place. This also future-proofs us against MV3's
 * service-worker lifecycle (the SW gets a single source of truth
 * for the token).
 *
 * Backend URL discovery order:
 *   1. Persisted ``backend`` value from the auth-handoff — but ONLY
 *      if it shares the eTLD+1 of the build-time default (so a
 *      preview URL stored from yesterday's testing can't override a
 *      production-targeted build).
 *   2. Environment-baked default at build time (``VITE_DRESSAPP_BACKEND``).
 *   3. ``https://dressapp.co`` as a final hard-coded fallback.
 */
const FALLBACK_BACKEND = 'https://dressapp.co';

const defaultStorage = {
  get: async (keys) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return chrome.storage.local.get(keys);
    }
    return {};
  },
  set: async (obj) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set(obj);
    }
  },
  remove: async (keys) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(keys);
    }
  }
};

/** Origin used to open the auth-bridge tab from the popup. Same
 *  resolution order as ``apiBase`` minus the auth-bridge can't
 *  rely on a stored value (no token yet). */
export function authBaseUrl() {
  return import.meta.env.VITE_DRESSAPP_BACKEND || FALLBACK_BACKEND;
}

/**
 * Resolve eTLD+1 (e.g. ``preview.emergentagent.com`` for
 * ``ai-stylist-api.preview.emergentagent.com``; ``dressapp.co`` for
 * ``dressapp.co``). We use this to decide whether a stored
 * ``backend`` is "trusted" — i.e. shares its registrable domain
 * with the build-time default. A preview-URL leftover after a
 * production rebuild fails this check and is ignored.
 */
function _registrableDomain(host) {
  if (!host) return '';
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  // Naive but sufficient for our supported hosts:
  const tail3 = parts.slice(-3).join('.');
  if (/(?:preview\.emergentagent\.com|emergent\.host|emergentagent\.com)$/i.test(tail3)) {
    return tail3;
  }
  return parts.slice(-2).join('.');
}

function _sameRegistrableDomain(a, b) {
  try {
    const da = _registrableDomain(new URL(a).host);
    const db = _registrableDomain(new URL(b).host);
    return !!da && !!db && da.toLowerCase() === db.toLowerCase();
  } catch {
    return false;
  }
}

export async function getBackend(storage = defaultStorage) {
  const baked = authBaseUrl();
  const stored = (await storage.get(['backend'])).backend;
  if (stored && _sameRegistrableDomain(stored, baked)) {
    return stored;
  }
  if (stored) {
    try {
      await storage.remove(['backend', 'token', 'user', 'issued_at']);
    } catch { /* noop */ }
  }
  return baked;
}

export async function getToken(storage = defaultStorage) {
  const stored = await storage.get(['token']);
  return stored.token || null;
}

async function authedFetch(storage, path, init = {}) {
  const backend = await getBackend(storage);
  const token = await getToken(storage);
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${backend}/api/v1${path}`, { ...init, headers });
  if (res.status === 401) {
    await storage.remove(['token']);
    throw new Error('Session expired — please reconnect from the DressApp popup.');
  }
  return res;
}

export async function fetchMe(storage = defaultStorage) {
  const r = await authedFetch(storage, '/users/me');
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function analyzeChart(storage = defaultStorage, payload) {
  const r = await authedFetch(storage, '/sizes/analyze-chart', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`HTTP ${r.status}: ${txt.slice(0, 240)}`);
  }
  return r.json();
}
