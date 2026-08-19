import { client } from './client.js';

export const admin = {
  adminOverview: () => client.get('/admin/overview').then((r) => r.data),
  adminUsers: (params = {}) => client.get('/admin/users', { params }).then((r) => r.data),
  adminListings: (params = {}) => client.get('/admin/listings', { params }).then((r) => r.data),
  adminTransactions: (params = {}) => client.get('/admin/transactions', { params }).then((r) => r.data),
  adminProviders: () => client.get('/admin/providers').then((r) => r.data),
  adminTrendScout: (limit = 30) =>
    client.get('/admin/trend-scout', { params: { limit } }).then((r) => r.data),
  adminTrendScoutRun: (force = true) =>
    client.post('/admin/trend-scout/run', null, { params: { force } }).then((r) => r.data),
  adminLlmUsage: () => client.get('/admin/llm-usage').then((r) => r.data),
  adminSystem: () => client.get('/admin/system').then((r) => r.data),
  adminPromoteUser: (userId) =>
    client.post(`/admin/users/${userId}/promote`).then((r) => r.data),
  adminDemoteUser: (userId) =>
    client.post(`/admin/users/${userId}/demote`).then((r) => r.data),
  adminSetListingStatus: (listingId, status) =>
    client.post(`/admin/listings/${listingId}/status`, null, { params: { status } }).then((r) => r.data),

  // --- Phase O.3: Eyes provider runtime override ---
  adminEyesStatus: () => client.get('/admin/eyes').then((r) => r.data),
  adminEyesSet: (provider) =>
    client.post('/admin/eyes', { provider: provider ?? null }).then((r) => r.data),
};
