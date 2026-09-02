/**
 * packages/api-client/src/streamNdjson.native.js
 *
 * React Native fallback for NDJSON streaming.
 *
 * Expo's Hermes/JSC `fetch` polyfill does not expose a ReadableStream
 * body that can be read via `getReader()`. This file is the `.native.js`
 * Metro platform extension — it is automatically picked over `streaming.js`
 * when bundled for iOS or Android.
 *
 * Strategy: issue a standard `fetch` POST (no streaming) and emit all
 * parsed events from the response body in a single pass once the request
 * completes. This means the UI will see all events at once rather than
 * progressively, but the API contract (onLine callbacks) is identical.
 *
 * For the Stylist real-time streaming response, a separate WebSocket
 * implementation will be added in Phase 4 to restore progressive updates.
 */

/**
 * @param {string} path   Path relative to API_BASE (e.g. '/closet/repair-hashes')
 * @param {object} [options]
 * @param {string} [options.method='POST']
 * @param {object} [options.params]
 * @param {object} [options.body]
 * @param {Function} [options.onLine]
 * @param {AbortSignal} [options.signal]
 * @param {string} options.apiBase   Full API base URL (injected by the client)
 * @param {string|null} options.token Bearer token (injected by the client)
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
  // Build URL with query params
  let url = `${apiBase}${path}`;
  if (params && typeof params === 'object') {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers = {
    Accept: 'application/x-ndjson, application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const resp = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`stream ${resp.status}: ${resp.statusText || 'error'}`);
  }

  const text = await resp.text();
  const lines = text.split('\n');
  let last = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      last = obj;
      if (onLine) onLine(obj);
    } catch {
      /* skip malformed lines */
    }
  }

  return last;
}

export default streamNdjson;
