import { client } from './client.js';

export const avatar = {
  getAvatarParams: () => client.get('/avatar/params').then((r) => r.data),
};
