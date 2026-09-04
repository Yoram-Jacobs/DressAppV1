import { client } from './_singleton.js';

export const avatar = {
  /** Get shape parameters + measurements + skin_tone + body_photo_url for the current user. */
  getAvatarParams: () => client.get('/avatar/params').then((r) => r.data),

  /**
   * Save avatar profile — delegates to PATCH /users/me.
   * Matches the web AvatarPage.handleSaveProfile() payload exactly.
   */
  saveAvatarProfile: (payload) =>
    client.patch('/users/me', payload).then((r) => r.data),

  /**
   * Upload a full-body reference photo (base64 JPEG, max ~1MB after resize).
   * The server stores it and returns the public URL.
   */
  uploadBodyPhoto: (imageBase64) =>
    client
      .post('/avatar/body-photo', { image_b64: imageBase64 })
      .then((r) => r.data),
};
