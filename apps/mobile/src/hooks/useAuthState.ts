/**
 * apps/mobile/src/hooks/useAuthState.ts
 *
 * Auth state hook. Reads the token from SecureStore on mount
 * to determine if the user is authenticated.
 * Subscribes to auth events for login/logout updates.
 */
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { addAuthListener } from '../lib/authEvents';
import { TOKEN_KEY } from '../lib/api';

export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function checkToken() {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!cancelled) setIsAuthenticated(!!token);
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    checkToken();

    const unsubscribe = addAuthListener((authed: boolean) => {
      if (!cancelled) setIsAuthenticated(authed);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { isAuthenticated, isLoading };
}
