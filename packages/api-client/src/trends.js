import { client } from './_singleton.js';

export const trends = {
  // trend-scout
  fashionScoutFeed: (limit = 12, params = {}) =>
    client
      .get('/trends/fashion-scout', {
        params: {
          limit,
          ...(params.language ? { language: params.language } : {}),
          ...(params.country ? { country: params.country } : {}),
        },
      })
      .then((r) => r.data),
  trendsRunNowDev: (force = true) =>
    client.post('/trends/run-now-dev', null, { params: { force } }).then((r) => r.data),
  // Admin-only force refresh
  trendsRefreshAdmin: (force = true, country = null) =>
    client.post('/trends/run-now', null, { params: { force, ...(country ? { country } : {}) } }).then((r) => r.data),
};

