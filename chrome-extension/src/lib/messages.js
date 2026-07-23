// Message-type catalogue shared by every part of the extension.
// Centralised so a typo in a string literal can't silently break
// the SW <-> popup <-> content-script wire.
export const messages = {
  AUTH_STATUS:          'AUTH_STATUS',
  RECEIVE_HANDOFF:      'RECEIVE_HANDOFF',
  CLEAR_AUTH:           'CLEAR_AUTH',
  FETCH_ME:             'FETCH_ME',
  ANALYZE_CHART:        'ANALYZE_CHART',
  CAPTURE_VISIBLE_TAB:  'CAPTURE_VISIBLE_TAB',
  SEND_SCREENSHOTS_TO_DRESSAPP: 'SEND_SCREENSHOTS_TO_DRESSAPP',
};

/** Promise-wrapper around chrome.runtime.sendMessage so callers can
 *  ``await sendToBackground({type, ...})`` instead of dealing with
 *  callbacks. Returns ``{ok:false, error}`` for any failure mode
 *  (no extension context, runtime.lastError, throw inside handler). */
export function sendToBackground(payload) {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(payload, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, error: 'empty response' });
        });
      } catch (e) {
        resolve({ ok: false, error: e?.message || 'sendMessage threw' });
      }
    });
  }

  // If running in a mobile WebView container WITH native bridge, use the native bridge
  if (typeof window !== 'undefined' && (window.ReactNativeWebView || window.webkit?.messageHandlers?.dressapp)) {
    return import('./mobile-bridge.js').then((bridge) => {
      return bridge.sendToNative(payload.type, payload.payload || payload);
    });
  }

  // Running as a Bookmarklet: fulfill locally inside the page context
  return import('./widget-core.js').then(async (core) => {
    const localStore = {
      get: async (keys) => {
        const res = {};
        keys.forEach(k => {
          const val = localStorage.getItem('dressapp_widget_' + k);
          try {
            res[k] = val ? JSON.parse(val) : null;
          } catch {
            res[k] = val;
          }
        });
        return res;
      },
      set: async (obj) => {
        Object.entries(obj).forEach(([k, v]) => {
          localStorage.setItem('dressapp_widget_' + k, typeof v === 'object' ? JSON.stringify(v) : v);
        });
      },
      remove: async (keys) => {
        keys.forEach(k => {
          localStorage.removeItem('dressapp_widget_' + k);
        });
      }
    };

    if (payload.type === messages.RECEIVE_HANDOFF) {
      return core.handleHandoff(localStore, payload.payload || payload);
    }
    if (payload.type === messages.AUTH_STATUS) {
      return core.handleAuthStatus(localStore);
    }
    if (payload.type === messages.CLEAR_AUTH) {
      return core.handleClearAuth(localStore);
    }
    if (payload.type === messages.FETCH_ME) {
      return core.handleFetchMe(localStore);
    }
    if (payload.type === messages.ANALYZE_CHART) {
      return core.handleAnalyze(localStore, payload.payload || payload);
    }
    if (payload.type === messages.CAPTURE_VISIBLE_TAB) {
      return { ok: false, error: 'Screen capture is not supported in bookmarklets' };
    }
    return { ok: false, error: 'Unknown message type' };
  });
}
