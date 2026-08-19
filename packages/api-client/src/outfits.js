import { client } from './_singleton.js';

export const outfits = {
  // --- AI Stylist Scheduler (Phase Scheduler) ---
  listSavedOutfits: () => client.get('/outfits').then((r) => r.data),
  saveOutfit: (body) => client.post('/outfits', body).then((r) => r.data),
  updateSavedOutfit: (id, body) => client.patch(`/outfits/${id}`, body).then((r) => r.data),
  deleteSavedOutfit: (id) => client.delete(`/outfits/${id}`).then((r) => r.data),
  triggerScheduledProposal: () => client.post('/outfits/proposal/scheduled').then((r) => r.data),
  triggerEventProposal: (body) => client.post('/outfits/proposal/event', body).then((r) => r.data),
  rejectItemSuggestion: (itemId) => client.post('/outfits/reject-item', { item_id: itemId }).then((r) => r.data),

  // --- Web push notifications ---
  listSimulatedNotifications: () => client.get('/outfits/notifications').then((r) => r.data),
  subscribeWebPush: (sub) => client.post('/outfits/webpush/subscribe', sub).then((r) => r.data),
  unsubscribeWebPush: (endpoint) => client.post('/outfits/webpush/unsubscribe', { endpoint }).then((r) => r.data),
  getVapidKey: () => client.get('/outfits/webpush/vapid-key').then((r) => r.data),
};

