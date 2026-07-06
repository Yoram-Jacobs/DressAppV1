import { fetchMe, analyzeChart } from './api.js';

const ME_TTL_MS = 5 * 60 * 1000;
let meCache = null;

export async function handleHandoff(storage, payload) {
  if (!payload || payload.type !== 'DRESSAPP_EXT_TOKEN') return { ok: false, error: 'wrong type' };
  if (typeof payload.token !== 'string' || payload.token.length < 16) return { ok: false, error: 'bad token' };
  if (typeof payload.backend !== 'string' || !/^https?:\/\//.test(payload.backend)) return { ok: false, error: 'bad backend url' };

  await storage.set({
    token:    payload.token,
    user:     payload.user || null,
    backend:  payload.backend,
    issued_at: payload.issued_at || new Date().toISOString(),
  });
  meCache = null;
  return { ok: true };
}

export async function handleAuthStatus(storage) {
  const s = await storage.get(['token', 'user', 'issued_at', 'backend']);
  return {
    ok: true,
    token: s.token || null,
    user: s.user || null,
    issued_at: s.issued_at || null,
    backend: s.backend || null,
  };
}

export async function handleClearAuth(storage) {
  await storage.remove(['token', 'user', 'issued_at', 'backend']);
  meCache = null;
  return { ok: true };
}

export async function handleFetchMe(storage) {
  if (meCache && (Date.now() - meCache.ts) < ME_TTL_MS) {
    return { ok: true, user: meCache.user, cached: true };
  }
  try {
    const user = await fetchMe(storage);
    meCache = { ts: Date.now(), user };
    await storage.set({ user });
    return { ok: true, user };
  } catch (e) {
    return { ok: false, error: e?.message || 'fetch /me failed' };
  }
}

export async function handleAnalyze(storage, payload) {
  try {
    const result = await analyzeChart(storage, payload);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e?.message || 'analyze failed' };
  }
}
