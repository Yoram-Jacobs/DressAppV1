import { client } from './client.js';

export const auth = {
  register: (body) => client.post('/auth/register', body).then((r) => r.data),
  login: (body) => client.post('/auth/login', body).then((r) => r.data),
  devBypass: () => client.post('/auth/dev-bypass').then((r) => r.data),

  /** Resolve the Google OAuth start URL for the *sign-in / sign-up* flow.
   * Returns ``{ authorization_url }``. The caller is expected to do a
   * full-page redirect to that URL (popup-less PKCE-style flow).
   */
  googleLoginStart: ({ withCalendar = false, next = null } = {}) => {
    const params = new URLSearchParams();
    if (withCalendar) params.set('with_calendar', 'true');
    if (next) params.set('next', next);
    const qs = params.toString();
    return client
      .get(`/auth/google/login/start${qs ? `?${qs}` : ''}`)
      .then((r) => r.data);
  },

  googleOAuthStart: () => client.get('/auth/google/start').then((r) => r.data),
  googleOAuthDisconnect: () =>
    client.post('/auth/google/disconnect').then((r) => r.data),
  googleReConsent: (withCalendar = false) =>
    client.get('/auth/google/re-consent', { params: { with_calendar: withCalendar } }).then((r) => r.data),
  googleSyncProfile: () =>
    client.post('/auth/google/sync-profile').then((r) => r.data),
};
