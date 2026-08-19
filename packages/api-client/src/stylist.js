import { client } from './_singleton.js';

export const stylist = {
  // stylist — returns raw axios promise for multipart
  stylist: (formData) =>
    client.post('/stylist', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  stylistHistory: (sessionId = null, limit = 200) =>
    client
      .get('/stylist/history', {
        params: sessionId ? { session_id: sessionId, limit } : { limit },
      })
      .then((r) => r.data),
  stylistSessions: () =>
    client.get('/stylist/sessions').then((r) => r.data),
  stylistCreateSession: () =>
    client.post('/stylist/sessions').then((r) => r.data),
  stylistDeleteSession: (sessionId) =>
    client.delete(`/stylist/sessions/${sessionId}`).then((r) => r.data),

  // Phase R — Stylist Power-Up: multi-image outfit composer
  composeOutfit: (formData) =>
    client.post('/stylist/compose-outfit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 240000,
    }).then((r) => r.data),

  // AI Stylist Scheduler (Phase Scheduler)
  plannerScout: (body) => client.post('/stylist/planner-scout', body).then((r) => r.data),
};

