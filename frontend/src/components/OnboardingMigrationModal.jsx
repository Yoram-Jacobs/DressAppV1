import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Loader2,
  ArrowRight,
  Sparkles,
  Globe,
  Search,
  Shirt,
  ExternalLink,
} from 'lucide-react';

const PRESET_APPS = [
  { name: 'Whering', domain: 'app.whering.co.uk', loginUrl: 'https://app.whering.co.uk/login', icon: '👗', defaultItems: 95, defaultOutfits: 2 },
  { name: 'Acloset', domain: 'web.acloset.app', loginUrl: 'https://web.acloset.app/login', icon: '📱', defaultItems: 48, defaultOutfits: 6 },
  { name: 'Stylebook', domain: 'www.stylebookapp.com', loginUrl: 'https://www.stylebookapp.com', icon: '🎨', defaultItems: 65, defaultOutfits: 10 },
  { name: 'Smartli', domain: 'smartli.app', loginUrl: 'https://smartli.app', icon: '⚡', defaultItems: 32, defaultOutfits: 4 },
  { name: 'BeautyAI', domain: 'beautyai.app', loginUrl: 'https://beautyai.app', icon: '💄', defaultItems: 25, defaultOutfits: 3 },
];

export default function OnboardingMigrationModal({ isOpen, onClose, onFlagUpdated }) {
  const { t } = useTranslation();
  const location = useLocation();

  // Kill modal (not process) when user navigates to Closet page
  useEffect(() => {
    if (isOpen && location.pathname === '/closet') {
      onClose();
    }
  }, [isOpen, location.pathname, onClose]);

  // Steps: 'ask' | 'app_search' | 'web_login'
  const [step, setStep] = useState('ask');
  const [appName, setAppName] = useState('Whering');
  const [appDomain, setAppDomain] = useState('app.whering.co.uk');
  const [customLoginUrl, setCustomLoginUrl] = useState('https://app.whering.co.uk/login');
  const [busy, setBusy] = useState(false);

  // Use URL-encoded bookmarklet to prevent syntax and drag issues across all browsers
  const harvesterBookmarkletCode = useMemo(() => {
    const rawJS = `(async () => {
      // Clean up Chrome extension widgets that conflict with migration
      document.querySelectorAll('.dressapp-importer-widget, #dressapp-fab, .dressapp-fab, .dressapp-anchor-btn').forEach(el => el.remove());
      document.querySelectorAll('[data-testid="dressapp-fab"], [data-testid="dressapp-anchor-btn"]').forEach(el => el.remove());
      // Remove any extension-injected styles
      document.querySelectorAll('style').forEach(st => {
        const txt = st.textContent || '';
        if (txt.includes('dressapp-importer-widget') || txt.includes('dressapp-fab') || txt.includes('dressapp-anchor')) st.remove();
      });
      // Tell the extension to suppress its widget while we scan
      window.postMessage({ type: 'DRESSAPP_WIDGET_TOGGLE', enabled: false }, '*');

      // Inject heartbeat animation style
      const s = document.createElement('style');
      s.innerHTML = '@keyframes da-hb { 0% { transform: scale(1); } 14% { transform: scale(1.08); } 28% { transform: scale(1); } 42% { transform: scale(1.12); } 70% { transform: scale(1); } } .da-pulse-badge { animation: da-hb 1.5s infinite ease-in-out; display: inline-block; }';
      document.head.appendChild(s);

      const o = document.createElement('div');
      o.id = 'dressapp-importer-widget';
      o.style.cssText = 'position:fixed;top:20px;left:20px;z-index:999999;background:rgba(15,23,42,0.95);color:white;padding:16px;border-radius:12px;font-family:sans-serif;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.3);width:280px;line-height:1.4;border:1px solid rgba(255,255,255,0.1);';
      o.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;font-size:14px;color:#f1f5f9;"><span class="da-pulse-badge">👗</span> DressApp Agent</div><div id="da-status" style="color:#94a3b8;font-size:11px;"><div style="margin-bottom:8px;color:#cbd5e1;">Choose <b>THIS TAB</b> in the sharing prompt to start.</div><button id="da-start-btn" style="background:#6366f1;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;width:100%;">Share & Start Agent</button></div>';
      document.body.appendChild(o);

      const st = document.getElementById('da-status');
      const btn = document.getElementById('da-start-btn');

      btn.onclick = async () => {
        btn.disabled = true;
        btn.innerText = 'Requesting stream...';
        let stream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, preferCurrentTab: true });
        } catch (e) {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
    } catch (e2) {
            st.innerHTML = '<span style="color:#f87171;">Permission denied: ' + (e2?.message || e?.message || 'unknown') + '</span>';
            setTimeout(() => o.remove(), 4000);
            return;
          }
        }

        const track = stream.getVideoTracks()[0];
        const settings = track ? track.getSettings() : {};
        if (settings.displaySurface && settings.displaySurface !== 'browser') {
          st.innerHTML = '<span style="color:#f87171;">Error: You must select <b>THIS TAB</b> in the sharing prompt. Window or Screen share is not supported as coordinates will not align. Please reload page & try again.</span>';
          if (track) track.stop();
          return;
        }

        st.innerText = 'Connecting stream...';
        const video = document.createElement('video');
        video.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:100px;height:100px;opacity:0.01;pointer-events:none;z-index:-1;';
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        document.body.appendChild(video);
        await video.play();

        // Wait for video to have actual playable frames (readyState >= 3 = HAVE_FUTURE_DATA)
        await new Promise(r => {
          if (video.readyState >= 3) { r(); return; }
          const onReady = () => { video.removeEventListener('canplay', onReady); r(); };
          video.addEventListener('canplay', onReady);
        });
        // Extra settle time for first frame decode
        await new Promise(r => setTimeout(r, 1500));
        // Verify video dimensions are initialized before proceeding
        if (!video.videoWidth || !video.videoHeight) {
          await new Promise(r => setTimeout(r, 2000));
        }

        // Scroll to top of page before starting scan
        const getScrollEl = () => {
          if (window.pageYOffset > 0) return window;
          window.scrollTo(0, 1);
          if (window.pageYOffset > 0) {
            window.scrollTo(0, 0);
            return window;
          }
          const common = ['main', '[class*=scroll]', '[class*=content]', '#root', '.app-container'];
          for (const sel of common) {
            const el = document.querySelector(sel);
            if (el && el.scrollHeight > el.clientHeight) {
              if (el.scrollTop > 0) return el;
              el.scrollTop = 1;
              if (el.scrollTop > 0) {
                el.scrollTop = 0;
                return el;
              }
            }
          }
          return document.scrollingElement || document.documentElement || document.body;
        };

        const scrollEl = getScrollEl();
        // Always start scanning from the top of the page
        if (scrollEl && scrollEl !== window && scrollEl !== document.body && scrollEl !== document.documentElement) {
          scrollEl.scrollTop = 0;
        }
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        await new Promise(r => setTimeout(r, 500));
        let scrollPos = 0;

        // --- Card detection function ---
        // Returns only cards that are FULLY visible in the viewport (no clipping at edges)
        const getVisibleGarmentRects = () => {
          const vpTop = 0;
          const vpBottom = window.innerHeight;

          const rects = [];

          const imgCandidates = Array.from(document.querySelectorAll('img')).filter(img => {
            const imgRect = img.getBoundingClientRect();
            if (imgRect.width < 40 || imgRect.height < 40) return false;
            if (imgRect.bottom < 40 || imgRect.top > window.innerHeight - 20) return false;
            let p = img.parentElement;
            while (p && p !== document.body) {
              const tag = p.tagName.toLowerCase();
              if (tag === 'header' || tag === 'nav' || tag === 'footer') return false;
              p = p.parentElement;
            }
            return true;
          });

          for (const img of imgCandidates) {
            const imgRect = img.getBoundingClientRect();
            let cardEl = null;
            let p = img.parentElement;
            while (p && p !== document.body) {
              const r = p.getBoundingClientRect();
              if (r.width >= 80 && r.width <= 600 && r.height >= 80 && r.height <= 800) {
                const ratio = r.height / r.width;
                if (ratio >= 0.7 && ratio <= 2.5) {
                  cardEl = p;
                  break;
                }
              }
              p = p.parentElement;
            }

            if (cardEl) {
              const r = cardEl.getBoundingClientRect();
              if (imgRect.width < r.width / 2 || imgRect.height < r.height / 2) continue;
              // Only accept fully visible cards (entire card within viewport)
              if (r.top < vpTop || r.bottom > vpBottom) continue;
              rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
            } else {
              const cardW = Math.max(imgRect.width * 1.18, 150);
              const cardH = Math.max(imgRect.height * 1.18, cardW * 1.35);
              if (imgRect.width < cardW / 2 || imgRect.height < cardH / 2) continue;
              const cx = imgRect.left + imgRect.width / 2;
              const cy = imgRect.top + imgRect.height / 2;
              const cardRect = { left: cx - cardW / 2, top: cy - cardH / 2, width: cardW, height: cardH };
              // Only accept fully visible cards
              if (cardRect.top < vpTop || cardRect.top + cardRect.height > vpBottom) continue;
              rects.push(cardRect);
            }
          }

          // Strategy 2: If no <img> cards found, look for card-shaped <div> elements
          if (rects.length === 0) {
            const allEls = document.querySelectorAll('div, li, a, section');
            for (const el of allEls) {
              const r = el.getBoundingClientRect();
              if (r.width < 80 || r.width > 600 || r.height < 80 || r.height > 800) continue;
              if (r.bottom < 40 || r.top > window.innerHeight - 20) continue;
              // Only accept fully visible cards
              if (r.top < vpTop || r.bottom > vpBottom) continue;
              const ratio = r.height / r.width;
              if (ratio < 0.7 || ratio > 2.5) continue;
              const bg = window.getComputedStyle(el).backgroundImage;
              const hasBg = bg && bg !== 'none' && !bg.includes('linear-gradient') && !bg.includes('radial-gradient');
              const hasImg = el.querySelector('img');
              if (!hasBg && !hasImg) continue;
              rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
            }
          }

          // Coordinate-based near-duplicate rejection
          const uniqueRects = [];
          for (const r of rects) {
            const isDup = uniqueRects.some(u =>
              Math.abs(u.left - r.left) < 20 &&
              Math.abs(u.top - r.top) < 20
            );
            if (!isDup) {
              uniqueRects.push(r);
            }
          }

          return uniqueRects;
        };

        // Group cards into rows by Y position (within 30px tolerance)
        const groupIntoRows = (cardRects) => {
          if (cardRects.length === 0) return [];
          const sorted = [...cardRects].sort((a, b) => a.top - b.top);
          const rows = [];
          let currentRow = [sorted[0]];
          for (let i = 1; i < sorted.length; i++) {
            const card = sorted[i];
            const rowCenter = currentRow.reduce((s, c) => s + c.top + c.height / 2, 0) / currentRow.length;
            const cardCenter = card.top + card.height / 2;
            if (Math.abs(cardCenter - rowCenter) < 30) {
              currentRow.push(card);
            } else {
              rows.push(currentRow);
              currentRow = [card];
            }
          }
          rows.push(currentRow);
          return rows;
        };

        // --- Scroll state helpers ---
        const getScrollState = () => {
          return {
            window: window.scrollY || window.pageYOffset,
            doc: document.documentElement.scrollTop,
            body: document.body.scrollTop,
            el: (scrollEl && scrollEl !== window) ? scrollEl.scrollTop : 0
          };
        };

        // ======================================================================
        // PHASE 1: Scan-All-First — autonomous scroll + crop loop
        // ======================================================================
        const harvestedCards = [];
        let noChangeCount = 0;
        let reachedBottom = false;

        const cropCardFromStream = (rect) => {
          try {
            if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

            const vW = video.videoWidth;
            const vH = video.videoHeight;
            const scaleX = vW / window.innerWidth;
            const scaleY = vH / window.innerHeight;

            let srcX = rect.left * scaleX;
            let srcY = rect.top * scaleY;
            let srcW = rect.width * scaleX;
            let srcH = rect.height * scaleY;

            if (srcX < 0) { srcW += srcX; srcX = 0; }
            if (srcY < 0) { srcH += srcY; srcY = 0; }
            if (srcX + srcW > vW) { srcW = vW - srcX; }
            if (srcY + srcH > vH) { srcH = vH - srcY; }

            if (srcW <= 10 || srcH <= 10) return null;

            const outW = Math.round(srcW);
            const outH = Math.round(srcH);

            if (outW <= 10 || outH <= 10) return null;

            const cvs = document.createElement('canvas');
            cvs.width = outW;
            cvs.height = outH;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

            try {
              const imgData = ctx.getImageData(0, 0, outW, outH).data;
              let sumR = 0, sumG = 0, sumB = 0, n = 0;
              for (let i = 0; i < imgData.length; i += 64) {
                sumR += imgData[i]; sumG += imgData[i+1]; sumB += imgData[i+2]; n++;
              }
              if (n > 0) {
                const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
                let variance = 0;
                for (let i = 0; i < imgData.length; i += 64) {
                  variance += (imgData[i] - avgR) ** 2 + (imgData[i+1] - avgG) ** 2 + (imgData[i+2] - avgB) ** 2;
                }
                variance = Math.sqrt(variance / (n * 3));
                if (variance < 2) return null;
              }
      } catch {}

            if (rect.width > rect.height * 5 || rect.height > rect.width * 5) return null;

            return cvs.toDataURL('image/jpeg', 0.85).split(',')[1];
          } catch (_) {
            return null;
          }
        };

        st.innerText = 'Scanning closet page...';

        while (!reachedBottom) {
          // Hide widget for clean capture
          o.style.display = 'none';
          await new Promise(r => setTimeout(r, 300));
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

          // Detect fully visible cards and crop each one
          const cardRects = getVisibleGarmentRects();

          for (const rect of cardRects) {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2 + scrollPos;
            const alreadyHarvested = harvestedCards.some(c =>
              Math.abs(c.cx - cx) < 20 && Math.abs(c.cy - cy) < 20
            );
            if (alreadyHarvested) continue;

            const b64 = cropCardFromStream(rect);
            if (b64) {
              harvestedCards.push({ crop_base64: b64, cx, cy });
              if (harvestedCards.length % 15 === 0 && window.opener) {
                window.opener.postMessage({ type: 'DRESSAPP_MIGRATION_STREAM', cards: harvestedCards.slice(-15).map(c => ({ crop_base64: c.crop_base64 })) }, '*');
              }
            }
          }

          o.style.display = 'block';
          st.innerText = 'Scanning... ' + harvestedCards.length + ' cards found';

          const prevRectCount = cardRects.length;
          const s1 = getScrollState();
          const prevScrollPos = (scrollEl && scrollEl !== window && scrollEl !== document.documentElement && scrollEl !== document.body)
            ? scrollEl.scrollTop
            : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop);

          // Calculate scroll: detect rows, scroll to center the next row
          const rows = groupIntoRows(cardRects);
          let scrollAmount;
          if (rows.length >= 2) {
            // We have at least 2 rows visible — scroll by the height of one row
            const rowHeight = rows[0].reduce((s, c) => s + c.height, 0) / rows[0].length;
            scrollAmount = Math.round(rowHeight);
          } else if (rows.length === 1) {
            // Only one row visible — scroll by the row height + gap
            const rowHeight = rows[0].reduce((s, c) => s + c.height, 0) / rows[0].length;
            scrollAmount = Math.round(rowHeight * 1.2);
          } else {
            // Fallback: scroll by 60% of viewport
            scrollAmount = Math.round((scrollEl && scrollEl !== window && scrollEl.clientHeight) ? scrollEl.clientHeight * 0.6 : window.innerHeight * 0.6);
          }

          const targetScroll = prevScrollPos + scrollAmount;
          if (scrollEl && scrollEl !== window && scrollEl !== document.body && scrollEl !== document.documentElement) {
            scrollEl.scrollTop = targetScroll;
          }
          window.scrollTo(0, targetScroll);
          document.documentElement.scrollTop = targetScroll;
          document.body.scrollTop = targetScroll;

          // Wait for layout to settle
          await new Promise(r => setTimeout(r, 400));
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

          // Center the visible row on screen if possible
          const freshCards = getVisibleGarmentRects();
          const freshRows = groupIntoRows(freshCards);
          if (freshRows.length > 0) {
            const centerRow = freshRows[Math.floor(freshRows.length / 2)];
            const rowTop = Math.min(...centerRow.map(c => c.top));
            const rowBottom = Math.max(...centerRow.map(c => c.top + c.height));
            const rowCenter = (rowTop + rowBottom) / 2;
            const vpCenter = window.innerHeight / 2;
            const centerDelta = Math.round(rowCenter - vpCenter);
            if (Math.abs(centerDelta) > 10) {
              const actualPos = (scrollEl && scrollEl !== window && scrollEl !== document.documentElement && scrollEl !== document.body)
                ? scrollEl.scrollTop
                : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop);
              const centeredScroll = actualPos + centerDelta;
              if (scrollEl && scrollEl !== window && scrollEl !== document.body && scrollEl !== document.documentElement) {
                scrollEl.scrollTop = centeredScroll;
              }
              window.scrollTo(0, centeredScroll);
              document.documentElement.scrollTop = centeredScroll;
              document.body.scrollTop = centeredScroll;
              await new Promise(r => setTimeout(r, 300));
            }
          }

          // Adaptive wait for lazy images
          st.innerText = 'Waiting for lazy images... ' + harvestedCards.length + ' cards';
          const pollStart = Date.now();
          const POLL_TIMEOUT = 12000;
          const POLL_INTERVAL = 600;
          let newRectsFound = false;
          while (Date.now() - pollStart < POLL_TIMEOUT) {
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
            const freshRects = getVisibleGarmentRects();
            if (freshRects.length > prevRectCount) {
              newRectsFound = true;
              st.innerText = 'New images loaded (' + freshRects.length + ' cards visible)... ' + harvestedCards.length + ' captured';
              break;
            }
          }

          let s2 = getScrollState();
          let changed = (s2.window !== s1.window) || (s2.doc !== s1.doc) || (s2.body !== s1.body) || (s2.el !== s1.el);
          const actualScrollPos = (scrollEl && scrollEl !== window && scrollEl !== document.documentElement && scrollEl !== document.body)
            ? scrollEl.scrollTop
            : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop);
          scrollPos = actualScrollPos;

          if (!newRectsFound && !changed) {
            noChangeCount++;
            if (noChangeCount >= 3) {
              break;
            }
            st.innerText = 'No new images (attempt ' + noChangeCount + '/3)... ' + harvestedCards.length + ' cards';
            const retryTarget = actualScrollPos + 200;
            if (scrollEl && scrollEl !== window) scrollEl.scrollTop = retryTarget;
            window.scrollTo(0, retryTarget);
            document.documentElement.scrollTop = retryTarget;
            document.body.scrollTop = retryTarget;
            const retryStart = Date.now();
            while (Date.now() - retryStart < 5000) {
              await new Promise(r => setTimeout(r, 600));
              const freshRects = getVisibleGarmentRects();
              if (freshRects.length > prevRectCount) {
                newRectsFound = true;
                break;
              }
            }
            s2 = getScrollState();
            changed = (s2.window !== s1.window) || (s2.doc !== s1.doc) || (s2.body !== s1.body) || (s2.el !== s1.el);
            const retryScrollPos = (scrollEl && scrollEl !== window && scrollEl !== document.documentElement && scrollEl !== document.body)
              ? scrollEl.scrollTop
              : (window.scrollY || window.pageYOffset || document.documentElement.scrollTop);
            scrollPos = retryScrollPos;
          }

          noChangeCount = newRectsFound ? 0 : noChangeCount;

          const isShort = scrollEl ? (scrollEl.scrollHeight <= scrollEl.clientHeight + 15) : true;
          reachedBottom = (!changed && !newRectsFound && noChangeCount >= 3) || isShort;
        }

        // Stop the media stream
        stream.getTracks().forEach(t => t.stop());
        video.remove();

        // ======================================================================
        // PHASE 1 COMPLETE — Stream remaining cards + signal done
        // ======================================================================
        const totalCaptured = harvestedCards.length;
        st.innerText = 'Scan complete! ' + totalCaptured + ' cards captured. Sending to DressApp...';

        if (window.opener) {
          const remainder = totalCaptured % 15;
          if (remainder > 0) {
            window.opener.postMessage({ type: 'DRESSAPP_MIGRATION_STREAM', cards: harvestedCards.slice(-remainder).map(c => ({ crop_base64: c.crop_base64 })) }, '*');
          }
          window.opener.postMessage({
            type: 'DRESSAPP_MIGRATION_COMPLETE',
            total_cards: totalCaptured,
            app_name: document.title || 'Competitor App'
          }, '*');
        }
        harvestedCards.length = 0;

        // Show green completion badge
        o.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;font-size:14px;color:#f1f5f9;">👗 DressApp Agent</div><div style="color:#10b981;font-weight:bold;font-size:13px;margin-top:8px;margin-bottom:4px;">✓ Scan Complete!</div><div style="color:#cbd5e1;font-size:11px;line-height:1.4;">' + totalCaptured + ' cards captured and sent to DressApp for processing.<br>You can now safely close this window and return to DressApp.</div>';
      };
    })();`;
    return 'javascript:' + encodeURIComponent(rawJS);
  }, []);

  const bookmarkletRef = useRef(null);

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute('href', harvesterBookmarkletCode);
    }
  });

  const targetLoginUrl = useMemo(() => {
    const preset = PRESET_APPS.find((a) => a.name.toLowerCase() === appName.trim().toLowerCase());
    if (preset) return preset.loginUrl;
    if (customLoginUrl && (customLoginUrl.startsWith('http://') || customLoginUrl.startsWith('https://'))) {
      return customLoginUrl;
    }
    return `https://${appDomain}`;
  }, [appName, appDomain, customLoginUrl]);

  const handleNoClick = async () => {
    setBusy(true);
    try {
      await api.updateMigrationFlag({ migration_flag: 'New' });
      toast.success(t('migration.flaggedNew', { defaultValue: 'Welcome to DressApp! Your account is set up.' }));
      if (onFlagUpdated) onFlagUpdated('New');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'An error occurred.' }));
    } finally {
      setBusy(false);
    }
  };

  const handleSelectPreset = (app) => {
    setAppName(app.name);
    setAppDomain(app.domain);
    setCustomLoginUrl(app.loginUrl);
  };

  const handleGoToWebLogin = (e) => {
    e.preventDefault();
    if (!appName.trim()) {
      toast.error(t('migration.appNameRequired', { defaultValue: 'Please enter your previous wardrobe app name.' }));
      return;
    }
    setStep('web_login');
  };

  const handleOpenPopupWindow = async () => {
    // Open the competitor site in a new tab — the bookmarklet handles
    // crop capture and posts results to MigrationMessageListener.
    const win = window.open(targetLoginUrl, '_blank');
    if (win) {
      win.opener = window;
    }
    
    toast.info(t('migration.popupOpened', { appName, defaultValue: `Opened ${appName} tab. Log in, go to your closet, then click the "DressApp Agent" bookmarklet.` }));
    onClose();
  };

  const handleCancelForm = () => {
    setStep('ask');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full bg-background border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden p-6 gap-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* STEP 1: INITIAL CONTEXT QUESTION */}
        {step === 'ask' && (
          <div className="space-y-4 text-center shrink-0">
            <DialogHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 animate-bounce">
                <Shirt className="w-6 h-6 text-primary" />
              </div>
              <DialogTitle className="text-lg md:text-xl font-bold font-display text-foreground text-center">
                {t('migration.welcomeTitle', { defaultValue: 'New to DressApp?' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-center">
                {t('migration.welcomeSub', { defaultValue: 'Would you like to import your wardrobe details and clothes from another platform?' })}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleNoClick}
                disabled={busy}
                className="rounded-xl h-10 font-semibold"
                data-testid="migration-ask-no-btn"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('migration.noStartFresh', { defaultValue: 'No, Start Fresh' })}
              </Button>
              <Button
                type="button"
                onClick={() => setStep('app_search')}
                className="rounded-xl h-10 bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-1 shadow-sm hover:opacity-95"
                data-testid="migration-ask-yes-btn"
              >
                <span>{t('migration.yesImportBtn', { defaultValue: 'Yes, Import Closet' })}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: SEARCH PLATFORM & LOGIN PRESETS */}
        {step === 'app_search' && (
          <form onSubmit={handleGoToWebLogin} className="space-y-4 text-left flex flex-col overflow-hidden shrink-0">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-base md:text-lg font-bold font-display text-foreground">
                {t('migration.selectAppTitle', { defaultValue: 'Select Previous Platform' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t('migration.selectAppSub', { defaultValue: 'Pick an application to import your wardrobe structure, items list, and layouts.' })}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px]">
              {/* Presets List */}
              <div className="grid grid-cols-1 gap-2">
                {PRESET_APPS.map((app) => (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => handleSelectPreset(app)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      appName === app.name
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-card-foreground hover:bg-accent/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{app.icon}</span>
                      <div>
                        <span className="font-bold text-sm block text-foreground">{app.name}</span>
                        <span className="text-[10px] text-muted-foreground block">{app.domain}</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-muted px-2.5 py-1 rounded-full font-mono font-bold text-foreground">
                      ~{app.defaultItems} items
                    </span>
                  </button>
                ))}
              </div>

              {/* App Name Input */}
              <div className="space-y-3 pt-1">
                <div>
                  <Label htmlFor="appNameInput" className="text-xs font-semibold">
                    {t('migration.appNameLabel', { defaultValue: 'Previous App Name / Platform *' })}
                  </Label>
                  <div className="relative mt-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="appNameInput"
                      placeholder={t('migration.searchAppPlaceholder', { defaultValue: 'e.g. Acloset, Stylebook, Whering, Smartli, BeautyAI' })}
                      value={appName}
                      onChange={(e) => {
                        setAppName(e.target.value);
                        const d = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') + '.app';
                        setAppDomain(d);
                        setCustomLoginUrl(`https://${d}`);
                      }}
                      className="rounded-xl pl-9 text-sm h-10"
                      required
                      data-testid="migration-form-appname-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelForm}
                className="rounded-xl h-10"
                data-testid="migration-form-cancel-btn"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="submit"
                className="rounded-xl h-10 bg-primary text-primary-foreground font-medium flex items-center gap-1.5"
                data-testid="migration-form-login-btn"
              >
                <ExternalLink className="w-4 h-4" />
                {t('migration.loginToAppBtn', { appName, defaultValue: `Open ${appName} & Connect` })}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: SCREENSHOT-SCROLLER & GARMENTVISION AI PIPELINE */}
        {step === 'web_login' && (
          <div className="flex flex-col h-full space-y-3 overflow-hidden">
            <DialogHeader className="border-b border-border pb-2.5 shrink-0">
              <DialogTitle className="text-base md:text-lg font-bold font-display flex items-center gap-2 truncate">
                <Sparkles className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                {t('migration.screenshotPipelineTitle', { defaultValue: 'Wardrobe Migration Agent' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {t('migration.screenshotPipelineSub', { defaultValue: 'Agentic closet importer powered by Gemini 2.5 Flash.' })}
              </DialogDescription>
            </DialogHeader>

            {/* Content area */}
            <div className="flex-1 relative bg-muted/20 rounded-xl border border-border overflow-y-auto p-4 min-h-[200px]">
              <div className="flex flex-col text-left space-y-4 py-2">
                <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
                  <Globe className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    {t('migration.connectToAppTitle', { appName, defaultValue: `Connect to ${appName}` })}
                  </h3>
                </div>

                <div className="space-y-3 text-xs text-muted-foreground">
                  <p>
                    {t('migration.bookmarkletInstallInstructions', { appName, defaultValue: `Drag the agent bookmarklet button below to your browser Bookmarks Bar (Ctrl+Shift+B to show the bar):` })}
                  </p>
                  
                  <div className="flex flex-col items-center justify-center p-3 bg-card border border-border rounded-xl gap-2">
                    <a
                      ref={bookmarkletRef}
                      href="#"
                      draggable="true"
                      onClick={(e) => {
                        e.preventDefault();
                        toast.info(t('migration.bookmarkletClickTip', { defaultValue: 'Drag this button to your bookmarks bar. Do not click it directly!' }));
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg cursor-move shadow-sm hover:opacity-90 flex items-center gap-1.5"
                    >
                      <span className="text-base leading-none">👗</span>
                      {t('migration.bookmarkletBtn', { defaultValue: 'DressApp Agent' })}
                    </a>
                    <span className="text-[10px] text-muted-foreground">{t('migration.dragTip', { defaultValue: 'Drag this button to your browser Bookmarks Bar' })}</span>
                  </div>

                  <p>
                    {t('migration.bookmarkletUsageInstructions', { appName, defaultValue: `After installing, click "Import wardrobe" below to initialize. Log in to Whering, go to your closet page, then click the "DressApp Agent" bookmarklet.` })}
                  </p>
                  <div className="mt-2.5 p-3 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20 text-[11px] leading-normal font-medium space-y-1">
                    <div>Tab Sleep Alert: Do not switch tabs inside the competitor window while importing (Chrome will sleep/throttle the scroller).</div>
                    <div>Pro-Tip: Drag the competitor tab out of your browser window into its own window to keep it running in focus while you multitask!</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('migration.garmentVisionReady', { defaultValue: 'Agentic Ingestion Ready' })}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleOpenPopupWindow}
                className="rounded-xl h-8 px-4 bg-primary text-primary-foreground font-bold text-xs inline-flex items-center justify-center gap-1 shadow-sm hover:opacity-95"
                data-testid="migration-weblogin-proceed-btn"
              >
                <span>
                  {t('migration.importWardrobeBtn', { defaultValue: 'Import wardrobe' })}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Bottom Navigation */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('app_search')}
                className="rounded-xl h-8 text-xs"
              >
                {t('common.back', { defaultValue: 'Back' })}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {t('migration.mattingNotice', { defaultValue: 'All assets matting is handled by GarmentVision.' })}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
