import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api/v1`;

const STORAGE_TOKEN = 'dressapp.token';
const STORAGE_USER = 'dressapp.user';

export const tokenStore = {
  get: () => localStorage.getItem(STORAGE_TOKEN) || null,
  set: (t) => localStorage.setItem(STORAGE_TOKEN, t),
  clear: () => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  },
};

export const userStore = {
  get: () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null'); }
    catch { return null; }
  },
  set: (u) => localStorage.setItem(STORAGE_USER, JSON.stringify(u)),
};

export const client = axios.create({ baseURL: API_BASE, timeout: 180000 });

client.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      tokenStore.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    if (err?.response?.data?.detail) {
      const detail = err.response.data.detail;
      if (typeof detail === 'object') {
        err.response.data.detail = detail.message || JSON.stringify(detail);
      }
      const detailStr = String(err.response.data.detail || '');
      if (detailStr.includes('GEMINI_API_KEY') || detailStr.includes('Gemini vision unavailable') || detailStr.includes('No GEMINI_API_KEY')) {
        import('../aiNotice').then(({ showAiKeyWarningToast }) => showAiKeyWarningToast());
      }
    }
    return Promise.reject(err);
  }
);
