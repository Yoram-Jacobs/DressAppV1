import { client, API_BASE, tokenStore } from './client.js';

/**
 * streamNdjson — open an `application/x-ndjson` POST stream from the
 * backend and invoke ``onLine`` once per JSON object as it arrives.
 *
 * @param {string} path        Path relative to API_BASE, e.g. ``/closet/repair-hashes``.
 * @param {object} [options]
 * @param {string} [options.method='POST']
 * @param {object} [options.params]   Query params (URLSearchParams-compatible).
 * @param {object} [options.body]     JSON body; serialised with JSON.stringify.
 * @param {Function} [options.onLine] ``(obj) => void`` invoked per event.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object|null>} The final parsed event, or null on empty stream.
 */
export async function streamNdjson(path, {
  method = 'POST',
  params,
  body,
  onLine,
  signal,
} = {}) {
  const url = new URL(`${API_BASE}${path}`);
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const headers = {
    'Accept': 'text/event-stream, application/x-ndjson',
  };
  const tok = tokenStore.get();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const resp = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: 'same-origin',
  });

  if (resp.status === 401) {
    tokenStore.clear();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error(`stream 401`);
  }
  if (!resp.ok || !resp.body) {
    throw new Error(`stream ${resp.status}: ${resp.statusText || 'no body'}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let last = null;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl = buf.indexOf('\n');
      while (nl !== -1) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (raw) {
          try {
            const obj = JSON.parse(raw);
            last = obj;
            if (onLine) onLine(obj);
          } catch (parseErr) {
            console.warn('streamNdjson: skipping malformed line', parseErr);
          }
        }
        nl = buf.indexOf('\n');
      }
    }
    const tail = buf.trim();
    if (tail) {
      try {
        const obj = JSON.parse(tail);
        last = obj;
        if (onLine) onLine(obj);
      } catch {
        /* ignore tail parse error */
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  return last;
}

export default client;
