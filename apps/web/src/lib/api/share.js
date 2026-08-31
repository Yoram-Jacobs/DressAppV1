import { client } from './client.js';

export const share = {
  // share — mint a read-only snapshot link for an outfit recommendation
  createSharedOutfit: (body) =>
    client.post('/share/outfit', body).then((r) => {
      const data = r.data;
      // Convenience: attach the fully-qualified share URL so callers can
      // drop it straight into `navigator.share`.
      if (data?.id && typeof window !== 'undefined') {
        data.share_url = `${window.location.origin}/shared/${data.id}`;
      }
      return data;
    }),
  getSharedOutfit: (id) =>
    client.get(`/share/outfit/${id}`).then((r) => r.data),
  saveSharedOutfitShareCard: (id, image_b64) =>
    client.post(`/share/outfit/${id}/share-card`, { image_b64 }).then((r) => r.data),
};
