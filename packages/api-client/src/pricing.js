import { client } from './_singleton.js';

export const pricing = {
  // --- PayPal / credits / subscription ---
  paypalConfig: () => client.get('/paypal/config').then((r) => r.data),
  creditsBalance: (currency = 'USD') =>
    client.get('/credits/balance', { params: { currency } }).then((r) => r.data),
  creditsTopupCreate: (body) =>
    client.post('/credits/topup', body).then((r) => r.data),
  creditsTopupCapture: (topupId) =>
    client.post(`/credits/topup/${topupId}/capture`).then((r) => r.data),
  createSubscription: (body) =>
    client.post('/paypal/subscribe', body).then((r) => r.data),
  captureSubscription: (subId) =>
    client.post(`/paypal/subscribe/capture/${subId}`).then((r) => r.data),
  cancelSubscription: () =>
    client.post('/paypal/subscribe/cancel').then((r) => r.data),
  getPricingInfo: () =>
    client.get('/pricing/info').then((r) => r.data),
  getQuotaStatus: () =>
    client.get('/quota/status').then((r) => r.data),
  aiCreditsPurchase: (body) =>
    client.post('/ai-credits/purchase', body).then((r) => r.data),
  aiCreditsCapture: (purchaseId) =>
    client.post(`/ai-credits/purchase/${purchaseId}/capture`).then((r) => r.data),
};

