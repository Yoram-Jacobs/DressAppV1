console.log('👗 DressApp Importer content script loaded on', location.href);

// Style injection for importer
const style = document.createElement('style');
style.textContent = `
  .dressapp-importer-widget {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999999;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    padding: 16px;
    border-radius: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    width: 240px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.3s ease;
  }
  .dressapp-importer-title {
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #f1f5f9;
  }
  .dressapp-importer-btn {
    background: #6366f1;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .dressapp-importer-btn:hover:not(:disabled) {
    background: #4f46e5;
  }
  .dressapp-importer-btn:disabled {
    background: #475569;
    cursor: not-allowed;
    opacity: 0.8;
  }
  .dressapp-importer-status {
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.4;
  }
`;
document.head.appendChild(style);

function initImporter() {
  const isClosetPage = /pieces|closet|wardrobe|clothes/i.test(location.href);
  console.log('👗 DressApp Importer check - isClosetPage:', isClosetPage, 'body:', !!document.body);
  if (!isClosetPage) return;

  if (!document.body) return;

  if (document.getElementById('dressapp-importer-widget')) return;

  console.log('👗 Injecting DressApp Importer widget...');
  const widget = document.createElement('div');
  widget.id = 'dressapp-importer-widget';
  widget.className = 'dressapp-importer-widget';
  widget.innerHTML = `
    <div class="dressapp-importer-title">👗 DressApp Importer</div>
    <div class="dressapp-importer-status" id="dai-status">Ready to capture and import your competitor wardrobe.</div>
    <button class="dressapp-importer-btn" id="dai-btn">Import Wardrobe</button>
  `;
  document.body.appendChild(widget);

  const btn = document.getElementById('dai-btn');
  const status = document.getElementById('dai-status');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.innerText = 'Starting automated screenshot scroller...';

    let screenshots = [];
    let maxScrolls = 35;
    let scrollStep = 350;
    let prevScrollY = -1;

    for (let i = 0; i < maxScrolls; i++) {
      window.scrollTo(0, i * scrollStep);
      await new Promise(r => setTimeout(r, 1000));

      if (window.scrollY === prevScrollY) {
        break;
      }
      prevScrollY = window.scrollY;

      status.innerText = `Capturing view ${i + 1}...`;
      try {
        // Request background service worker to capture the visible tab
        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, resolve);
        });
        if (res && res.ok && res.image_b64) {
          // Re-attach data prefix
          screenshots.push(`data:image/jpeg;base64,${res.image_b64}`);
        } else {
          console.error('Capture failed:', res?.error);
        }
      } catch (e) {
        console.error('Capture message failed:', e);
      }
    }

    status.innerText = `Sending ${screenshots.length} screenshots to DressApp...`;
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'SEND_SCREENSHOTS_TO_DRESSAPP',
          screenshots
        }, resolve);
      });
      if (res && res.ok) {
        status.innerHTML = '<span style="color:#34d399;font-weight:bold;">✓ Done!</span> Check DressApp tab to finish importing.';
      } else {
        status.innerHTML = `<span style="color:#f87171;font-weight:bold;">Error:</span> ${res?.error || 'DressApp tab not found'}`;
      }
    } catch (e) {
      status.innerHTML = '<span style="color:#f87171;font-weight:bold;">Error:</span> Connection failed';
    }
    btn.disabled = false;
  });
}

// Observe route changes for SPA navigation
const urlObserver = new MutationObserver(() => {
  initImporter();
});
urlObserver.observe(document.documentElement, { subtree: true, childList: true });
initImporter();
