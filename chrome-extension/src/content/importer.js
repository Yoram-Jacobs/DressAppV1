console.log('👗 DressApp Importer content script loaded on', location.href);

// Style injection removed — bookmarklet handles all migration UI

function initImporter() {
  // Floating widget injection disabled — bookmarklet handles migration widget
  return;

  const btn = document.getElementById('dai-btn');
  const status = document.getElementById('dai-status');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.innerText = 'Starting automated screenshot scroller...';

    const getScrollEl = () => {
      const common = ["main", "[class*=scroll]", "[class*=content]", "#root", ".app-container"];
      for (const sel of common) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) {
          const style = window.getComputedStyle(el);
          if (style.overflowY === "auto" || style.overflowY === "scroll") return el;
        }
      }
      const all = document.querySelectorAll("*");
      let best = null, maxScroll = 0;
      for (const el of all) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          const dist = el.scrollHeight - el.clientHeight;
          if (dist > maxScroll) { maxScroll = dist; best = el; }
        }
      }
      return best || document.scrollingElement || document.documentElement || document.body;
    };

    const scrollEl = getScrollEl();
    let screenshots = [];
    let maxScrolls = 35;
    let scrollStep = 350;
    let prevScrollY = -1;

    for (let i = 0; i < maxScrolls; i++) {
      if (scrollEl === window || scrollEl === document.body || scrollEl === document.documentElement) {
        window.scrollTo(0, i * scrollStep);
      } else {
        scrollEl.scrollTop = i * scrollStep;
      }
      await new Promise(r => setTimeout(r, 1000));

      const currentScroll = (scrollEl === window || scrollEl === document.body || scrollEl === document.documentElement) ? window.scrollY : scrollEl.scrollTop;
      if (currentScroll === prevScrollY) {
        break;
      }
      prevScrollY = currentScroll;

      status.innerText = `Capturing view ${i + 1}...`;
      
      // Hide widget before capturing visible tab to keep screenshots clean
      widget.style.display = 'none';
      await new Promise(r => setTimeout(r, 100)); // wait brief frame for layout repaint
      
      try {
        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, resolve);
        });
        if (res && res.ok && res.image_b64) {
          screenshots.push(`data:image/jpeg;base64,${res.image_b64}`);
        } else {
          console.error('Capture failed:', res?.error);
        }
      } catch (e) {
        console.error('Capture message failed:', e);
      } finally {
        // Restore widget
        widget.style.display = 'flex';
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
  // initImporter();
});
urlObserver.observe(document.documentElement, { subtree: true, childList: true });
// initImporter();

// Listen to custom event dispatched by bookmarklet to bypass opener nullification
document.addEventListener('DRESSAPP_BOOKMARKLET_SCREENSHOTS', async (e) => {
  const screenshots = e.detail?.screenshots || [];
  console.log('👗 Importer received bookmarklet screenshots:', screenshots.length);
  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'SEND_SCREENSHOTS_TO_DRESSAPP',
        screenshots
      }, resolve);
    });
    if (res && res.ok) {
      console.log('👗 Successfully routed bookmarklet screenshots via extension to DressApp');
    } else {
      console.error('Failed to route screenshots:', res?.error);
    }
  } catch (err) {
    console.error('Error routing screenshots:', err);
  }
});

