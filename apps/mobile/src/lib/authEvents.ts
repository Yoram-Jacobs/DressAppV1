/**
 * apps/mobile/src/lib/authEvents.ts
 *
 * Simple event emitter for authentication state changes.
 * Used to decouple the API client from the useAuthState hook
 * and avoid circular dependencies.
 */

type AuthListener = (isAuthenticated: boolean) => void;

let _listeners: AuthListener[] = [];

export function emitAuthChange(isAuthenticated: boolean) {
  _listeners.forEach((fn) => fn(isAuthenticated));
}

export function addAuthListener(fn: AuthListener) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
