import { client } from './_singleton.js';

export const trends = {
  // trend-scout
  latestTrends: (per_bucket = 1, params = {}) =>
    client
      .get('/trends/latest', {
        params: {
          per_bucket,
          ...(params.gender ? { gender: params.gender } : {}),
          ...(params.country ? { country: params.country } : {}),
        },
      })
      .then((r) => r.data),
  fashionScoutFeed: (limit = 12, params = {}) =>
    client
      .get('/trends/fashion-scout', {
        params: {
          limit,
          ...(params.gender ? { gender: params.gender } : {}),
          ...(params.language ? { language: params.language } : {}),
          ...(params.country ? { country: params.country } : {}),
        },
      })
      .then((r) => r.data),
  /**
   * @param {boolean} [force]
   * @param {string | null} [gender]
   * @param {string | null} [country]
   */
  trendsRunNowDev: (force = true, gender = null, country = null) =>
    client.post('/trends/run-now-dev', null, { params: { force, ...(gender ? { gender } : {}), ...(country ? { country } : {}) } }).then((r) => r.data),
  // Admin-only force refresh
  /**
   * @param {boolean} [force]
   * @param {string | null} [country]
   * @param {string | null} [gender]
   */
  trendsRefreshAdmin: (force = true, country = null, gender = null) =>
    client.post('/trends/run-now', null, { params: { force, ...(country ? { country } : {}), ...(gender ? { gender } : {}) } }).then((r) => r.data),
  // Personalization settings
  getSettings: () => client.get('/trends/settings').then((r) => r.data),
  updateSettings: (payload) => client.put('/trends/settings', payload).then((r) => r.data),
  connectSocial: (platform_id, username = null) =>
    client.post('/trends/settings/social/connect', { platform_id, username }).then((r) => r.data),
  disconnectSocial: (platform_id) =>
    client.post('/trends/settings/social/disconnect', { platform_id }).then((r) => r.data),
};


