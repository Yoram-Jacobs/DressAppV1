import { client } from './_singleton.js';

export const professionals = {
  // --- Phase U: professionals directory ---
  listProfessionals: (params = {}) =>
    client.get('/professionals', { params }).then((r) => r.data),
  getProfessional: (id) =>
    client.get(`/professionals/${id}`).then((r) => r.data),
};

