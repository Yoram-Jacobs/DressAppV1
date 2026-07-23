/**
 * MV3 service worker — the extension's brain.
 *
 * Responsibilities:
 *  * Handle the auth handoff message from the dressapp.co
 *    auth-bridge content script and persist the token in
 *    chrome.storage.local.
 *  * Answer popup / content-script queries about auth status,
 *    user profile, and chart analysis by delegating to widget-core.
 *  * Cache the user profile for 5 minutes to spare the backend
 *    on rapid popup opens.
 */
import { messages } from '@/lib/messages.js';
import * as widgetCore from '@/lib/widget-core.js';

const chromeStorage = {
  get: async (keys) => chrome.storage.local.get(keys),
  set: async (obj) => chrome.storage.local.set(obj),
  remove: async (keys) => chrome.storage.local.remove(keys)
};

async function handleCaptureVisibleTab(sender) {
  try {
    const windowId = sender?.tab?.windowId;
    const dataUrl = await chrome.tabs.captureVisibleTab(
      windowId,
      { format: 'jpeg', quality: 70 },
    );
    if (typeof dataUrl !== 'string') {
      return { ok: false, error: 'captureVisibleTab returned no data' };
    }
    const i = dataUrl.indexOf(',');
    return { ok: true, image_b64: i >= 0 ? dataUrl.slice(i + 1) : dataUrl };
  } catch (e) {
    const msg = e?.message || 'captureVisibleTab failed';
    return {
      ok: false,
      error: msg,
      needs_permission:
        /<all_urls>|activeTab|cannot access|no host permission|MAY_BE_REMOTELY_HOSTED/i
          .test(msg),
    };
  }
}

async function handleSendScreenshotsToDressApp(msg) {
  try {
    const tabs = await chrome.tabs.query({ url: [
      '*://localhost/*',
      '*://127.0.0.1/*',
      '*://dressapp.co/*',
      '*://*.dressapp.co/*'
    ] });
    if (tabs.length === 0) {
      return { ok: false, error: 'DressApp tab not open' };
    }
    const screenshots = msg.screenshots || [];
    await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'DRESSAPP_MIGRATION_SCREENSHOTS',
      screenshots: screenshots
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to send screenshots' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    [messages.RECEIVE_HANDOFF]:     () => widgetCore.handleHandoff(chromeStorage, msg.payload || msg),
    [messages.AUTH_STATUS]:         () => widgetCore.handleAuthStatus(chromeStorage),
    [messages.CLEAR_AUTH]:          () => widgetCore.handleClearAuth(chromeStorage),
    [messages.FETCH_ME]:            () => widgetCore.handleFetchMe(chromeStorage),
    [messages.ANALYZE_CHART]:       () => widgetCore.handleAnalyze(chromeStorage, msg.payload),
    [messages.CAPTURE_VISIBLE_TAB]: () => handleCaptureVisibleTab(sender),
    [messages.SEND_SCREENSHOTS_TO_DRESSAPP]: () => handleSendScreenshotsToDressApp(msg),
  };
  const handler = handlers[msg?.type];
  if (!handler) {
    try {
      sendResponse({ ok: false, error: `unknown message type ${msg?.type}` });
    } catch (_) {}
    return false;
  }
  handler()
    .then((res) => {
      try {
        sendResponse(res);
      } catch (_) {}
    })
    .catch((e) => {
      try {
        sendResponse({ ok: false, error: e?.message || 'handler threw' });
      } catch (_) {}
    });
  return true;
});

if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'DRESSAPP_EXT_TOKEN') {
      try {
        sendResponse({ ok: false, error: 'unsupported external message' });
      } catch (_) {}
      return false;
    }
    widgetCore.handleHandoff(chromeStorage, msg)
      .then((res) => {
        try {
          sendResponse(res);
        } catch (_) {}
      })
      .catch((e) => {
        try {
          sendResponse({ ok: false, error: e?.message || 'handoff threw' });
        } catch (_) {}
      });
    return true;
  });
}
