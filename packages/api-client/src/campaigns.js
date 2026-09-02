import { client } from './_singleton.js';

/**
 * Experts Campaign Platform API
 */
export const campaignApi = {
  /** Create a new campaign (Expert only) */
  createCampaign: (data) => client.post('/campaigns', data).then((r) => r.data),

  /** Get single campaign detail */
  getCampaign: (id) => client.get(`/campaigns/${id}`).then((r) => r.data),

  /** Update campaign (Draft/Rejected only) */
  updateCampaign: (id, data) => client.patch(`/campaigns/${id}`, data).then((r) => r.data),

  // Submit flow (Phase 1: creates PayPal order)
  submitCampaign: (campaignId) =>
    client.post(`/campaigns/${campaignId}/submit`).then((r) => r.data),

  // Submit flow (Phase 2: capture PayPal order, fires admin alert, moves to pending_approval)
  captureSubmissionOrder: (campaignId, orderId) =>
    client.post(`/campaigns/${campaignId}/submit/capture`, { order_id: orderId }).then((r) => r.data),

  // Extension flow
  extendCampaign: (campaignId, newEndDate) =>
    client.post(`/campaigns/${campaignId}/extend`, { new_end_date: newEndDate }).then((r) => r.data),

  captureExtensionOrder: (campaignId, orderId, newEndDate) =>
    client.post(`/campaigns/${campaignId}/extend/capture`, {
      order_id: orderId,
      new_end_date: newEndDate,
    }).then((r) => r.data),

  // Lifecycle
  pauseCampaign: (campaignId) =>
    client.post(`/campaigns/${campaignId}/pause`).then((r) => r.data),

  resumeCampaign: (campaignId) =>
    client.post(`/campaigns/${campaignId}/resume`).then((r) => r.data),

  deleteCampaign: (campaignId) =>
    client.delete(`/campaigns/${campaignId}`).then((r) => r.data),

  /** Cancel campaign */
  cancelCampaign: (id) => client.delete(`/campaigns/${id}`).then((r) => r.data),

  /** Public campaign feed with geo + sort params */
  getCampaignFeed: (params) => client.get('/campaigns/feed', { params }).then((r) => r.data),

  /** Save / unsave a campaign */
  saveCampaign: (id) => client.post(`/campaigns/${id}/save`).then((r) => r.data),

  /** Increment share counter */
  shareCampaign: (id) => client.post(`/campaigns/${id}/share`).then((r) => r.data),

  /** Report a campaign */
  reportCampaign: (id) => client.post(`/campaigns/${id}/report`).then((r) => r.data),

  /** Track a campaign view impression */
  trackCampaignView: (id) => client.post(`/campaigns/${id}/view`).then((r) => r.data),

  // --- Admin ---
  /** Get campaign approval queue */
  adminGetCampaignQueue: (params) => client.get('/admin/campaigns', { params }).then((r) => r.data),

  /** Approve a campaign */
  adminApproveCampaign: (id) => client.post(`/admin/campaigns/${id}/approve`).then((r) => r.data),

  /** Reject a campaign with a reason */
  adminRejectCampaign: (id, reason) =>
    client.post(`/admin/campaigns/${id}/reject`, { reason }).then((r) => r.data),
};

