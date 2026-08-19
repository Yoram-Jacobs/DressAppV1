import { client } from './_singleton.js';

export const users = {
  getMe: () => client.get('/users/me').then((r) => r.data),
  patchMe: (body) => client.patch('/users/me', body).then((r) => r.data),
  updateMigrationFlag: (body) => client.patch('/users/migration-flag', body).then((r) => r.data),
  saveMigrationCrops: (body) => client.post('/closet/migration/save-crops', body, { timeout: 120000 }).then((r) => r.data),
  deleteAccount: (body) => client.post('/users/me/delete', body).then((r) => r.data),
};

