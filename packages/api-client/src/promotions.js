import { client } from './_singleton.js';

export const promotions = {
  // --- Phase U: ad campaigns ---
  listMyAdCampaigns: () =>
    client.get('/promotions/campaigns').then((r) => r.data),
  createAdCampaign: (body) =>
    client.post('/promotions/campaigns', body).then((r) => r.data),
  patchAdCampaign: (id, body) =>
    client.patch(`/promotions/campaigns/${id}`, body).then((r) => r.data),
  deleteAdCampaign: (id) =>
    client.delete(`/promotions/campaigns/${id}`).then((r) => r.data),

  // --- Ad ticker & tracking ---
  adTicker: (params = {}) =>
    client.get('/promotions/ticker', { params }).then((r) => r.data),
  trackAdImpression: (id) =>
    client.post(`/promotions/impression/${id}`).then((r) => r.data).catch(() => null),
  trackAdClick: (id) =>
    client.post(`/promotions/click/${id}`).then((r) => r.data).catch(() => null),
};

