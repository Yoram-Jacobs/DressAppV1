import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, tokenStore, userStore } from './api';
import { API_BASE, getCsrfToken } from './api/client';
import { useUniversalSync } from '../hooks/useUniversalSync';
import { clearAllScrollPositions } from '../components/ScrollRestoration';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => userStore.get());
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef(user?.id ?? null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (prevUserIdRef.current !== nextUserId) {
      prevUserIdRef.current = nextUserId;
      clearAllScrollPositions();
    }
  }, [user?.id]);

  const handleUserUpdated = useCallback((updated) => {
    setUser(updated);
    userStore.set(updated);
  }, []);

  useUniversalSync(user, handleUserUpdated);

  const refresh = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
      userStore.set(me);
      return me;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // Scrub any legacy JWT persisted in localStorage before Wave 2 cookie migration.
    try {
      localStorage.removeItem('dressapp.token');
    } catch {
      /* noop */
    }
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = () => {
    const csrf = getCsrfToken();
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    }).catch(() => {});
    tokenStore.clear();
    clearAllScrollPositions();
    setUser(null);
  };

  const updateUserLocal = (patch) => {
    const next = { ...(user || {}), ...patch };
    setUser(next);
    userStore.set(next);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, refresh, updateUserLocal }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
