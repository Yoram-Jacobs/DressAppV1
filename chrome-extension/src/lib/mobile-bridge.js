/**
 * Native WebView Message Bridge for DressApp Floater.
 * Used when running outside the Chrome extension context.
 */

const pendingRequests = new Map();

// Setup global message listener for responses from the native host app
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'DRESSAPP_BRIDGE_RESPONSE' && data.msgId) {
      const pending = pendingRequests.get(data.msgId);
      if (pending) {
        pendingRequests.delete(data.msgId);
        pending.resolve(data.response);
      }
    }
  });
}

/**
 * Sends a message to the native host app via the available WebView interface.
 * Returns a promise that resolves with the response payload.
 */
export function sendToNative(type, payload = {}) {
  return new Promise((resolve) => {
    const msgId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Store resolver callback
    pendingRequests.set(msgId, { resolve });

    const messageData = { type, payload, msgId };

    // 1. React Native WebView
    if (window.ReactNativeWebView?.postMessage) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(messageData));
        return;
      } catch (e) {
        console.error('[DressApp/Bridge] React Native WebView postMessage failed:', e);
      }
    }

    // 2. iOS WKWebView Custom Handler
    if (window.webkit?.messageHandlers?.dressapp?.postMessage) {
      try {
        window.webkit.messageHandlers.dressapp.postMessage(messageData);
        return;
      } catch (e) {
        console.error('[DressApp/Bridge] iOS WKWebView postMessage failed:', e);
      }
    }

    // 3. Fallback: postMessage to window parent/opener (useful for testing/iframes)
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'DRESSAPP_BRIDGE_REQUEST', ...messageData }, '*');
        return;
      } catch (e) {
        console.error('[DressApp/Bridge] Parent postMessage failed:', e);
      }
    }

    // If no native bridge is detected, log and auto-resolve with failure
    console.warn('[DressApp/Bridge] No native message bridge detected.');
    pendingRequests.delete(msgId);
    resolve({ ok: false, error: 'No native bridge detected' });
  });
}
