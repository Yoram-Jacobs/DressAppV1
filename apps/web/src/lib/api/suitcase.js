import { client } from './client.js';

export const suitcase = {
  // --- DressApp Suitcase ---
  getSuitcaseActive: () => client.get('/suitcase/active').then((r) => r.data),
  saveSuitcaseActive: (body) => client.post('/suitcase/active', body).then((r) => r.data),
  deleteSuitcaseActive: (params) => client.delete('/suitcase/active', { params }).then((r) => r.data),
  packSuitcase: (body) => client.post('/suitcase/pack', body).then((r) => r.data),
  approveSuitcase: (body) => client.post('/suitcase/approve', body).then((r) => r.data),
  updateSuitcaseItemPackStatus: (body) => client.post('/suitcase/items/pack-status', body).then((r) => r.data),
  deleteSuitcaseItem: (itemId) => client.delete(`/suitcase/items/${itemId}`).then((r) => r.data),
  enterSuitcaseLocation: (body) => client.post('/suitcase/enter-location', body).then((r) => r.data),
  getSuitcaseArchive: () => client.get('/suitcase/archive').then((r) => r.data),
  deleteSuitcaseArchives: (ids) => client.delete(`/suitcase/archive?ids=${ids.join(',')}`).then((r) => r.data),
  suitcaseChat: (body) => client.post('/suitcase/chat', body).then((r) => r.data),
};
