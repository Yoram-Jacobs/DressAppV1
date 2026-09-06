import { client, tokenStore } from './client.js';
import { streamNdjson } from './streaming.js';

export const closet = {
  // --- basic CRUD ---
  listCloset: (params = {}) =>
    client.get('/closet', { params }).then((r) => r.data),
  getItem: (id) => client.get(`/closet/${id}`).then((r) => r.data),
  createItem: (body) => client.post('/closet', body).then((r) => r.data),
  patchItem: (id, body) => client.patch(`/closet/${id}`, body).then((r) => r.data),
  updateItem: (id, body) => client.patch(`/closet/${id}`, body).then((r) => r.data),
  deleteItem: (id) => client.delete(`/closet/${id}`).then((r) => r.data),

  // --- streaming hash-repair ---
  /**
   * Streaming hash-repair pass. Opens an NDJSON stream against
   * ``/closet/repair-hashes`` and dispatches each event to ``onEvent``.
   * Resolves with the final ``{type:'done', ...}`` summary.
   */
  repairClosetHashes: ({ dryRun = false, onlyMissing = false, limit = 2000, onEvent, signal } = {}) =>
    streamNdjson('/closet/repair-hashes', {
      method: 'POST',
      params: {
        dry_run: dryRun ? 'true' : 'false',
        only_missing: onlyMissing ? 'true' : 'false',
        limit,
      },
      onLine: onEvent,
      signal,
    }),

  /**
   * Streaming thumbnail-repair pass. Re-derives ``thumbnail_data_url``
   * for stale thumbnails. Resolves with final ``{type:'done', ...}``.
   */
  repairClosetThumbnails: ({ onlyStale = true, limit = 2000, onEvent, signal } = {}) =>
    streamNdjson('/closet/repair-thumbnails', {
      method: 'POST',
      params: {
        only_stale: onlyStale ? 'true' : 'false',
        limit,
      },
      onLine: onEvent,
      signal,
    }),

  // --- streaming analyze (Patch M19 — optional NDJSON) ---
  analyzeItemImage: (body, callbacks) => {
    if (
      !callbacks ||
      (!callbacks.onItem &&
        !callbacks.onDetect &&
        !callbacks.onError &&
        !callbacks.onDone)
    ) {
      return client
        .post('/closet/analyze', body, {
          timeout: 180000,
          transformResponse: [
            (rawData) => {
              if (typeof rawData === 'string') {
                const trimmed = rawData.trim();
                try {
                  return JSON.parse(trimmed);
                } catch {
                  return rawData;
                }
              }
              return rawData;
            },
          ],
        })
        .then((r) => {
          const data = r.data || {};
          if (data && data._status && Number(data._status) >= 400) {
            const err = new Error(data._error || 'Analyze failed');
            err.response = { status: Number(data._status), data: { detail: data._error, ...data } };
            throw err;
          }
          return data;
        });
    }

    const rawBackendUrl = (process.env.REACT_APP_BACKEND_URL || '').trim();
    const baseUrl = (rawBackendUrl && !rawBackendUrl.endsWith('://') && rawBackendUrl !== 'https://' && rawBackendUrl !== 'http://')
      ? rawBackendUrl.replace(/\/+$/, '')
      : '';
    const url = `${baseUrl}/api/v1/closet/analyze`;
    const token = tokenStore.get();
    return (async () => {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream, application/x-ndjson',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          let detail = `HTTP ${resp.status}`;
          try {
            const j = await resp.json();
            detail = j?.detail || j?._error || detail;
          } catch (_e) {
            /* keep generic detail */
          }
          const err = new Error(detail);
          err.response = { status: resp.status, data: { detail } };
          throw err;
        }
        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error('Streaming response body not readable');
        }
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        const emittedItems = [];
        let detectMeta = null;
        let doneCount = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const newlineIdx = buffer.lastIndexOf('\n');
          if (newlineIdx < 0) continue;
          const lines = buffer.slice(0, newlineIdx).split('\n');
          buffer = buffer.slice(newlineIdx + 1);
          for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            let frame;
            try {
              frame = JSON.parse(line);
            } catch (_e) {
              continue;
            }
            switch (frame.type) {
              case 'detect':
                detectMeta = frame;
                callbacks.onDetect?.(frame);
                break;
              case 'item':
                emittedItems[frame.index] = frame;
                callbacks.onItem?.(frame);
                break;
              case 'item_skip':
                callbacks.onItemSkip?.(frame);
                break;
              case 'field':
                callbacks.onField?.(frame);
                break;
              case 'done':
                doneCount = frame.count || 0;
                callbacks.onDone?.(frame);
                break;
              case 'error': {
                const err = new Error(frame.message || 'Analyze failed');
                err.response = {
                  status: frame.status || 503,
                  data: { detail: frame.message, _error: frame.message },
                };
                callbacks.onError?.(frame);
                throw err;
              }
              default:
                break;
            }
          }
        }
        const items = emittedItems.filter(Boolean);
        return {
          items,
          count: doneCount || items.length,
          detect: detectMeta,
        };
      } catch (streamErr) {
        if (streamErr?.response?.data?.detail || streamErr?.response?.data?._error) {
          throw streamErr;
        }
        console.warn('[analyzeItemImage] Stream failed, falling back to standard axios POST:', streamErr);
        // Fallback to standard axios POST
        return client
          .post('/closet/analyze', body, {
            timeout: 180000,
            transformResponse: [
              (rawData) => {
                if (typeof rawData === 'string') {
                  const trimmed = rawData.trim();
                  try {
                    return JSON.parse(trimmed);
                  } catch {
                    return rawData;
                  }
                }
                return rawData;
              },
            ],
          })
          .then((r) => {
            const data = r.data || {};
            if (data && data._status && Number(data._status) >= 400) {
              const err = new Error(data._error || 'Analyze failed');
              err.response = { status: Number(data._status), data: { detail: data._error, ...data } };
              throw err;
            }
            if (data.items_meta) {
              callbacks.onDetect?.({ type: 'detect', items_meta: data.items_meta });
            }
            if (Array.isArray(data.items)) {
              data.items.forEach((it, idx) => {
                callbacks.onItem?.({
                  type: 'item',
                  index: idx,
                  item: it,
                  analysis: it,
                  fields: it,
                });
              });
            } else if (data.analysis) {
              callbacks.onItem?.({
                type: 'item',
                index: 0,
                item: data.analysis,
                analysis: data.analysis,
                fields: data.analysis,
              });
            }
            callbacks.onDone?.(data);
            return data;
          });
      }
    })();
  },

  // --- search & processing ---
  searchCloset: (body) =>
    client.post('/closet/search', body, { timeout: 30000 }).then((r) => r.data),
  polishCrop: (body) =>
    client.post('/closet/polish-crop', body, { timeout: 60000 }).then((r) => r.data),
  groupItems: (body) => client.post('/closet/group', body).then((r) => r.data),
  groupEdit: (hostId, body) =>
    client.post(`/closet/${hostId}/group-edit`, body).then((r) => r.data),

  // --- streaming marketplace backfill ---
  streamMarketplaceBackfill: ({ onEvent, signal } = {}) =>
    streamNdjson('/closet/marketplace/backfill/stream', {
      method: 'POST',
      onLine: onEvent,
      signal,
    }),

  // --- outfit completion ---
  completeOutfit: ({ itemIds, includeMarketplace = false, occasion = null, limit = 6 }) =>
    client
      .post('/closet/complete-outfit', {
        item_ids: itemIds,
        include_marketplace: includeMarketplace,
        occasion: occasion || null,
        limit,
      })
      .then((r) => r.data),

  // --- item image repair & processing ---
  repairItemImage: (itemId, { userHint = null, force = false, preview = false } = {}) =>
    client
      .post(`/closet/${itemId}/repair`, {
        user_hint: userHint || null,
        force,
      }, { params: { preview } })
      .then((r) => r.data),
  cleanItemBackground: (itemId, preview = false) =>
    client.post(`/closet/${itemId}/clean-background`, null, { params: { preview } }).then((r) => r.data),
  reanalyzeItem: (itemId, { fill_empty_only = false } = {}) => {
    const params = fill_empty_only ? { fill_empty_only: true } : {};
    return client
      .post(`/closet/${itemId}/reanalyze`, null, { timeout: 90000, params })
      .then((r) => r.data);
  },
  chatAnalyseItem: (itemId, { message, history = [], fill_empty_only = false } = {}) =>
    client
      .post(`/closet/${itemId}/chat-analyse`, {
        message,
        history,
        fill_empty_only,
      }, { timeout: 90000 })
      .then((r) => r.data),

  // --- image import & processing ---
  fetchImageUrl: (url) =>
    client
      .post('/closet/fetch-image-url', { url }, { timeout: 20000 })
      .then((r) => r.data),
  importDpp: (qrPayload) =>
    client
      .post('/closet/import-dpp', { qr_payload: qrPayload }, { timeout: 30000 })
      .then((r) => r.data),
  parseReceipt: (formData) =>
    client
      .post('/closet/parse-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      .then((r) => r.data),
  extractPdfText: (formData) =>
    client
      .post('/closet/extract-pdf-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      .then((r) => r.data),
  setItemPhoto: (itemId, { imageBase64, imageMime = 'image/jpeg', autoSegment = true, language }) =>
    client
      .post(
        `/closet/${itemId}/photo`,
        {
          image_base64: imageBase64,
          image_mime: imageMime,
          auto_segment: autoSegment,
          ...(language ? { language } : {}),
        },
        { timeout: 120000 },
      )
      .then((r) => r.data),
};

// Re-export streamNdjson for callers that need it directly
export { streamNdjson };
