chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'DRESSAPP_MIGRATION_SCREENSHOTS') {
    window.postMessage(msg, '*');
  }
});
