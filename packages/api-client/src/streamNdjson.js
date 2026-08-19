/**
 * packages/api-client/src/streamNdjson.js
 *
 * Web implementation of NDJSON streaming using ReadableStream.getReader().
 * Metro bundler uses streamNdjson.native.js on iOS/Android automatically.
 *
 * @param {string} path   Path relative to API_BASE
 * @param {object} [options]
 * @param {string} [options.method='POST']
 * @param {object} [options.params]
 * @param {object} [options.body]
 * @param {Function} [options.onLine]
 * @param {AbortSignal} [options.signal]
 * @param {string} options.apiBase   Full API base URL (injected by the caller)
 * @param {string|null} options.token Bearer token
 * @returns {Promise<object|null>}
 */
export async function streamNdjson(path, {
  method = 'POST',
  params,
  body,
  onLine,
  signal,
  apiBase = '',
  token = null,
} = {}) {
  const url = new URL(`${apiBase}${path}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = { Accept: 'text/event-stream, application/x-ndjson' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const resp = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: 'same-origin',
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`stream ${resp.status}: ${resp.statusText || 'no body'}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let last = null;

  try {
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
          } catch {
            console.warn('streamNdjson: skipping malformed line');
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
      } catch { /* ignore */ }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }

  return last;
}

export default streamNdjson;
