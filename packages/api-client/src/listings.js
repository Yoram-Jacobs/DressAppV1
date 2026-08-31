import { client } from './_singleton.js';
import { streamNdjson } from './streaming.js';

export const listings = {
  listListings: (params = {}) =>
    client.get('/listings', { params }).then((r) => r.data),

  /**
   * Streaming variant of ``GET /listings`` — same filters, but
   * each listing arrives on its own NDJSON line.
   */
  streamListings: ({ params = {}, onEvent, signal } = {}) =>
    streamNdjson('/listings/stream', {
      method: 'GET',
      params,
      onLine: onEvent,
      signal,
    }),

  feePreview: (cents) =>
    client
      .get('/listings/fee-preview', { params: { list_price_cents: cents } })
      .then((r) => r.data),
  getListing: (id) => client.get(`/listings/${id}`).then((r) => r.data),
  getSimilarListings: (id, params = {}) =>
    client.get(`/listings/${id}/similar`, { params }).then((r) => r.data),
  createListing: (body) => client.post('/listings', body).then((r) => r.data),
  deleteListing: (id) => client.delete(`/listings/${id}`).then((r) => r.data),
};

