import { client } from './_singleton.js';

export const auth = {
  register: (body) => client.post('/auth/register', body).then((r) => r.data),
  login: (body) => client.post('/auth/login', body).then((r) => r.data),
  devBypass: () => client.post('/auth/dev-bypass').then((r) => r.data),

  /** Resolve the Google OAuth start URL for the *sign-in / sign-up* flow.
   * Returns ``{ authorization_url }``. The caller is expected to do a
   * full-page redirect to that URL (popup-less PKCE-style flow).
   * Pass ``mobile: true`` from native clients so the backend redirects
   * to ``dressapp://auth/callback`` instead of the web ``/auth/callback``.
   * @param {{ withCalendar?: boolean, next?: string | null, mobile?: boolean, returnUrl?: string | null, ref?: string | null }} [options]
   */
  googleLoginStart: ({ withCalendar = false, next = '', mobile = false, returnUrl = '', ref = '' } = {}) => {
    const params = new URLSearchParams();
    if (withCalendar) params.set('with_calendar', 'true');
    if (next) params.set('next', next);
    if (mobile) params.set('mobile', '1');
    if (returnUrl) params.set('return_url', returnUrl);
    if (ref) params.set('ref', ref);
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

