import { client } from './_singleton.js';

export const transactions = {
  listTransactions: (params = {}) =>
    client.get('/transactions', { params }).then((r) => r.data),

  // Wave 2 — swap + donate marketplace flows
  proposeSwap: (listingId, offeredItemId) =>
    client
      .post('/transactions/swap', {
        listing_id: listingId,
        offered_item_id: offeredItemId,
      })
      .then((r) => r.data),
  claimDonation: (listingId, handlingFeeCents = 0) =>
    client
      .post('/transactions/donate', {
        listing_id: listingId,
        handling_fee_cents: handlingFeeCents,
      })
      .then((r) => r.data),
  captureDonationShipping: (txId, orderId) =>
    client
      .post(`/transactions/donate/${txId}/capture`, null, {
        params: { order_id: orderId },
      })
      .then((r) => r.data),
  confirmReceipt: (txId) =>
    client
      .post(`/transactions/${txId}/confirm-receipt`)
      .then((r) => r.data),

  // --- Phase 4P: PayPal / credits / marketplace buy ---
  listingBuyCreate: (listingId) =>
    client.post(`/listings/${listingId}/buy`).then((r) => r.data),
  listingBuyCapture: (listingId, orderId) =>
    client
      .post(`/listings/${listingId}/buy/capture`, null, {
        params: { order_id: orderId },
      })
      .then((r) => r.data),
};

