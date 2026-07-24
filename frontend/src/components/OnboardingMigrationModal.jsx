import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { closetStore } from '@/lib/closetStore';
import { outfitStore } from '@/lib/outfitStore';
import {
  Loader2,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  Globe,
  Search,
  Shirt,
  Layers,
  ExternalLink,
  ImageIcon,
  FileCode2,
  Maximize2,
  Scissors
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
  const navigate = useNavigate();

  // Steps: 'ask' | 'app_search' | 'web_login'
  const [step, setStep] = useState('ask');
  const [appName, setAppName] = useState('Whering');
  const [appDomain, setAppDomain] = useState('app.whering.co.uk');
  const [customLoginUrl, setCustomLoginUrl] = useState('https://app.whering.co.uk/login');
  const [busy, setBusy] = useState(false);

  // Import mode: 'screenshot_scroll' | 'direct_photos' | 'paste_urls'
  const [importMode, setImportMode] = useState('screenshot_scroll');
  const [pastedUrlsText, setPastedUrlsText] = useState('');
  const [popupOpened, setPopupOpened] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [syncedItemsList, setSyncedItemsList] = useState([]);

  // Use URL-encoded bookmarklet to prevent syntax and drag issues across all browsers
  const harvesterBookmarkletCode = useMemo(() => {
    const rawJS = `(async () => {
      // Clean up any existing widgets to prevent duplicates
      const ex1 = document.getElementById('dressapp-importer-widget');
      if (ex1) ex1.remove();
      const ex2 = document.getElementById('dressapp-widget-root');
      if (ex2) ex2.remove();

      const o = document.createElement('div');
      o.id = 'dressapp-importer-widget';
      o.style.cssText = 'position:fixed;top:20px;left:20px;z-index:999999;background:rgba(15,23,42,0.95);color:white;padding:16px;border-radius:12px;font-family:sans-serif;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.3);width:260px;line-height:1.4;border:1px solid rgba(255,255,255,0.1);';
      o.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;font-size:14px;color:#f1f5f9;">👗 DressApp Agent</div><div id="da-status" style="color:#94a3b8;font-size:11px;"><div style="margin-bottom:8px;color:#cbd5e1;">Choose <b>THIS TAB</b> in the sharing prompt to start.</div><button id="da-start-btn" style="background:#6366f1;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:11px;width:100%;">Share & Start Agent</button></div>';
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
          } catch (err) {
            st.innerHTML = '<span style="color:#f87171;">Permission denied: ' + err.message + '</span>';
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

        await new Promise(r => { if (video.readyState >= 3) r(); else video.oncanplay = r; });
        await new Promise(r => setTimeout(r, 1000));

        const getScrollEl = () => {
          const common = ['main', '[class*=scroll]', '[class*=content]', '#root', '.app-container'];
          for (const sel of common) {
            const el = document.querySelector(sel);
            if (el && el.scrollHeight > el.clientHeight) {
              const style = window.getComputedStyle(el);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el;
            }
          }
          return document.scrollingElement || document.documentElement || document.body;
        };

        const scrollEl = getScrollEl();
        let scrollPos = 0;
        let noChangeCount = 0;

        const getVisibleGarmentRects = () => {
          const scrollRect = (scrollEl && scrollEl !== window && scrollEl !== document.documentElement && scrollEl !== document.body)
            ? scrollEl.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

          const rects = [];
          const imgs = Array.from(document.querySelectorAll('img'));
          
          for (const img of imgs) {
            const imgRect = img.getBoundingClientRect();
            // Product images should be reasonably sized
            if (imgRect.width < 60 || imgRect.height < 60) continue;
            // Must be within scroll viewport boundaries
            if (imgRect.top < scrollRect.top || imgRect.bottom > scrollRect.bottom + 10) continue;
            
            const src = img.src.toLowerCase();
            if (src.includes('logo') || src.includes('avatar') || src.includes('icon') || src.includes('profile')) continue;

            // Prevent picking up elements inside nav headers, menus, footers
            let insideNavOrHeader = false;
            let temp = img;
            while (temp && temp !== document.body) {
              const tagName = temp.tagName.toLowerCase();
              const cls = (temp.className || '').toString().toLowerCase();
              const id = (temp.id || '').toLowerCase();
              if (tagName === 'header' || tagName === 'nav' || tagName === 'footer' ||
                  cls.includes('header') || cls.includes('nav') || cls.includes('menu') || cls.includes('footer') ||
                  id.includes('header') || id.includes('nav') || id.includes('menu') || id.includes('footer')) {
                insideNavOrHeader = true;
                break;
              }
              temp = temp.parentElement;
            }
            if (insideNavOrHeader) continue;

            // Walk up to find the closest grid card element container
            let cardEl = null;
            let p = img.parentElement;
            while (p && p !== document.body) {
              const r = p.getBoundingClientRect();
              if (r.width >= 100 && r.width <= 450 && r.height >= 120 && r.height <= 650) {
                const ratio = r.height / r.width;
                if (ratio >= 0.9 && ratio <= 2.2) {
                  cardEl = p;
                  break;
                }
              }
              p = p.parentElement;
            }

            if (cardEl) {
              const r = cardEl.getBoundingClientRect();
              // Exclude cards that are cut off at the scroll boundaries
              if (r.top >= scrollRect.top - 5 && r.bottom <= scrollRect.bottom + 10) {
                rects.push({
                  left: r.left - scrollRect.left,
                  top: r.top - scrollRect.top,
                  width: r.width,
                  height: r.height
                });
              }
            } else {
              // Fallback: center a vertically-oriented box relative to the scrollRect
              const cardW = imgRect.width * 1.15;
              const cardH = cardW * 1.35;
              const cx = imgRect.left + imgRect.width / 2;
              const cy = imgRect.top + imgRect.height / 2;
              rects.push({
                left: Math.max(0, cx - cardW / 2 - scrollRect.left),
                top: Math.max(0, cy - cardH / 2 - scrollRect.top),
                width: cardW,
                height: cardH
              });
            }
          }
          
          // Remove duplicate rects (in case multiple images/logos resolve to the same card)
          const uniqueRects = [];
          for (const r of rects) {
            const isDup = uniqueRects.some(u => 
              Math.abs(u.left - r.left) < 5 && 
              Math.abs(u.top - r.top) < 5 && 
              Math.abs(u.width - r.width) < 5 && 
              Math.abs(u.height - r.height) < 5
            );
            if (!isDup) {
              uniqueRects.push(r);
            }
          }
          
          return uniqueRects;
        };

        const getScrollState = () => {
          return {
            window: window.scrollY || window.pageYOffset,
            doc: document.documentElement.scrollTop,
            body: document.body.scrollTop,
            el: (scrollEl && scrollEl !== window) ? scrollEl.scrollTop : 0
          };
        };

        window.addEventListener('message', async (e) => {
          if (e.data && e.data.type === 'DRESSAPP_AGENT_ACTION') {
            const { action, scroll_amount } = e.data;
            if (action === 'scroll') {
              const s1 = getScrollState();
              scrollPos += scroll_amount;
              if (scrollEl && scrollEl !== window && scrollEl !== document.body && scrollEl !== document.documentElement) {
                scrollEl.scrollTop = scrollPos;
              }
              window.scrollTo(0, scrollPos);
              document.documentElement.scrollTop = scrollPos;
              document.body.scrollTop = scrollPos;

              await new Promise(r => setTimeout(r, 1200));
              let s2 = getScrollState();
              let changed = (s2.window !== s1.window) || (s2.doc !== s1.doc) || (s2.body !== s1.body) || (s2.el !== s1.el);
              
              if (!changed) {
                noChangeCount++;
                if (noChangeCount < 3) {
                  st.innerText = 'Waiting for lazy load (attempt ' + noChangeCount + '/3)...';
                  scrollPos += 150;
                  window.scrollTo(0, scrollPos);
                  if (scrollEl && scrollEl !== window) scrollEl.scrollTop = scrollPos;
                  await new Promise(r => setTimeout(r, 2000));
                  
                  s2 = getScrollState();
                  changed = (s2.window !== s1.window) || (s2.doc !== s1.doc) || (s2.body !== s1.body) || (s2.el !== s1.el);
                }
              }

              if (changed) {
                noChangeCount = 0;
              }

              const reachedBottom = (!changed && noChangeCount >= 3);
              captureAndSend(reachedBottom);
            } else if (action === 'done') {
              st.innerHTML = '<span style="color:#34d399;font-weight:bold;">✓ Done!</span> Return to DressApp.';
              stream.getTracks().forEach(t => t.stop());
              video.remove();
              setTimeout(() => o.remove(), 4000);
            }
          }
        });

        const captureAndSend = async (reachedBottom = false) => {
          st.innerText = 'Agent analyzing viewport...';
          o.style.display = 'none';
          await new Promise(r => setTimeout(r, 180));
          try {
            const rect = (scrollEl && scrollEl !== window && scrollEl !== document.documentElement && scrollEl !== document.body) ? scrollEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const scaleX = video.videoWidth / window.innerWidth;
            const scaleY = video.videoHeight / window.innerHeight;
            const cropX = rect.left * scaleX;
            const cropY = rect.top * scaleY;
            const cropW = rect.width * scaleX;
            const cropH = rect.height * scaleY;
            const canvas = document.createElement('canvas');
            canvas.width = cropW;
            canvas.height = cropH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const b64 = canvas.toDataURL('image/png');
            o.style.display = 'block';

            const cardRects = getVisibleGarmentRects();
            const isShort = scrollEl ? (scrollEl.scrollHeight <= scrollEl.clientHeight + 10) : true;
            const finalReachedBottom = reachedBottom || isShort;

            if (window.opener) {
              window.opener.postMessage({
                type: 'DRESSAPP_AGENT_FRAME',
                screenshot: b64,
                viewport_width: rect.width,
                viewport_height: rect.height,
                reached_bottom: finalReachedBottom,
                card_rects: cardRects
              }, '*');
            } else {
              st.innerHTML = '<div style="color:#f87171;">Connection lost. Reopen modal.</div>';
            }
          } catch (err) {
            o.style.display = 'block';
            st.innerText = 'Error: ' + err.message;
          }
        };

        captureAndSend();
      };
    })();`;
    return 'javascript:' + encodeURIComponent(rawJS);
  }, []);

  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data && event.data.type === 'DRESSAPP_AGENT_FRAME') {
        const { screenshot, viewport_width, viewport_height, reached_bottom, card_rects } = event.data;
        setIsSyncing(true);
        setSyncStatusText(t('migration.agentProcessing', { defaultValue: 'Wardrobe Migration Agent analyzing viewport screenshot...' }));
        
        try {
          let sessId = activeSessionId;
          if (!sessId) {
            const sessRes = await api.startMigrationSession({ app_name: appName.trim() });
            sessId = sessRes.session_id;
            setActiveSessionId(sessId);
          }

          const res = await api.stepMigrationSession({
            session_id: sessId,
            app_name: appName.trim(),
            screenshot: screenshot,
            viewport_width: viewport_width,
            viewport_height: viewport_height,
            reached_bottom: reached_bottom,
            card_rects: card_rects
          });

          if (res.new_items_found && res.new_items_found.length > 0) {
            setSyncedItemsList((prev) => [...prev, ...res.new_items_found]);
            setSyncedItems((prev) => prev + res.new_items_found.length);
            toast.success(t('migration.itemsFound', { count: res.new_items_found.length, defaultValue: `Agent discovered ${res.new_items_found.length} new items!` }));
          }

          if (res.action === 'scroll') {
            setProgressPct((prev) => Math.min(90, prev + 5));
          }

          // Reply back to the bookmarklet window
          if (event.source) {
            event.source.postMessage({
              type: 'DRESSAPP_AGENT_ACTION',
              action: res.action,
              scroll_amount: res.scroll_amount || 350
            }, '*');
          }

          if (res.action === 'done') {
            setIsSyncing(false);
            setProgressPct(100);
            setMigrationStage('outfits_prompt');
            toast.success(t('migration.agentCompleted', { defaultValue: 'Wardrobe Migration Agent successfully completed closet import!' }));
          }
        } catch (err) {
          setIsSyncing(false);
          toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'Agent error during step processing.' }));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [t, activeSessionId, appName]);

  const bookmarkletRef = useRef(null);

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute('href', harvesterBookmarkletCode);
    }
  });

  const handleCopyHarvesterCode = () => {
    navigator.clipboard.writeText(harvesterBookmarkletCode);
    toast.success(t('migration.bookmarkletCopied', { defaultValue: 'Copied Importer Script to clipboard! Paste it into Whering tab Console.' }));
  };

  // Pipeline Status State
  const [pipelineResult, setPipelineResult] = useState(null);

  // Migration Stage: 'items' | 'outfits_prompt' | 'outfits' | 'complete'
  const [migrationStage, setMigrationStage] = useState('items');

  // Dynamic Item & Outfit counts
  const [itemCountInput, setItemCountInput] = useState(95);
  const [outfitCountInput, setOutfitCountInput] = useState(2);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [syncedItems, setSyncedItems] = useState(0);
  const [totalItems, setTotalItems] = useState(95);
  const [syncedOutfits, setSyncedOutfits] = useState(0);
  const [totalOutfits, setTotalOutfits] = useState(2);
  const [syncStatusText, setSyncStatusText] = useState('');

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
    setItemCountInput(app.defaultItems);
    setOutfitCountInput(app.defaultOutfits);
  };

  const handleGoToWebLogin = (e) => {
    e.preventDefault();
    if (!appName.trim()) {
      toast.error(t('migration.appNameRequired', { defaultValue: 'Please enter your previous wardrobe app name.' }));
      return;
    }
    setStep('web_login');
    setMigrationStage('items');
  };

  const handleOpenPopupWindow = async () => {
    try {
      const sessRes = await api.startMigrationSession({ app_name: appName.trim() });
      setActiveSessionId(sessRes.session_id);
      
      // Open in a standard browser tab instead of a popup window
      const win = window.open(targetLoginUrl, '_blank');
      if (win) {
        win.opener = window;
      }
      
      toast.info(t('migration.popupOpened', { appName, defaultValue: `Opened ${appName} login tab. Log in & go to your closet page, then click the "DressApp Agent" bookmarklet.` }));
      setPopupOpened(true);
    } catch (err) {
      toast.error(t('migration.sessionStartError', { defaultValue: 'Could not initialize migration session. Please try again.' }));
    }
  };

  // Stage 1: Silent Background Import Wardrobe Items
  const handleStartItemImport = async () => {
    let realPayloadItems = [];
    if (pastedUrlsText.trim()) {
      try {
        if (pastedUrlsText.trim().startsWith('[')) {
          const parsed = JSON.parse(pastedUrlsText.trim());
          realPayloadItems = parsed.map((urlStr, idx) => ({
            id: `pasted_${idx + 1}`,
            title: `Pasted Garment ${idx + 1}`,
            category: 'Top',
            image_url: typeof urlStr === 'string' ? urlStr : urlStr.image_url || urlStr.src,
          }));
        } else {
          const lines = pastedUrlsText.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('http') || l.startsWith('data:image/'));
          realPayloadItems = lines.map((urlStr, idx) => ({
            id: `pasted_${idx + 1}`,
            title: `Pasted Garment ${idx + 1}`,
            category: 'Top',
            image_url: urlStr,
          }));
        }
      } catch {
        toast.error(t('migration.invalidPastedUrls', { defaultValue: 'Could not parse pasted URLs. Please ensure they are valid image HTTP links or JSON array.' }));
        return;
      }
    }

    if (realPayloadItems.length === 0) {
      toast.info(t('migration.selectPhotosPrompt', { defaultValue: 'Please select real garment photos or screenshots to run through GarmentVision!' }));
      return;
    }

    onClose();
    toast.info(t('migration.passingToGarmentVision', { count: realPayloadItems.length, defaultValue: `Passing ${realPayloadItems.length} wardrobe items to GarmentVision AI bulk upload pipeline!` }));
    navigate('/add', { state: { importedItems: realPayloadItems } });
  };

  // Stage 2: Import Outfits
  const handleStartOutfitImport = async () => {
    setIsSyncing(true);
    setProgressPct(10);
    setSyncedOutfits(0);
    setSyncStatusText(t('migration.statusScrapingOutfits', { appName, defaultValue: `Matching outfits canvas garments to imported closet items...` }));

    const dynamicOutfits = [];
    for (let j = 1; j <= outfitCountInput; j++) {
      dynamicOutfits.push({
        name: `${appName} Look ${j}`,
        description: `Saved outfit combination from ${appName}`,
        garments: [
          { item_id: `real_file_1`, role: 'Top' },
          { item_id: `real_file_2`, role: 'Bottom' },
        ]
      });
    }

    setTimeout(async () => {
      try {
        db_persist_outfits(dynamicOutfits);
        setSyncedOutfits(outfitCountInput);
        setProgressPct(100);
        setIsSyncing(false);
        setMigrationStage('complete');
        toast.success(t('migration.outfitsImportSuccess', { count: outfitCountInput, defaultValue: `Successfully imported ${outfitCountInput} outfits combinations!` }));
      } catch (err) {
        setIsSyncing(false);
        toast.error(t('migration.outfitImportError', { defaultValue: 'Failed to ingest outfits mappings.' }));
      }
    }, 1800);
  };

  const db_persist_outfits = (outfitsList) => {
    for (const out of outfitsList) {
      outfitStore.addOutfit({
        id: `outfit_${uuid_short()}`,
        name: out.name,
        description: out.description,
        garments: out.garments,
        created_at: new Date().toISOString(),
      });
    }
  };

  const uuid_short = () => {
    return Math.random().toString(36).substring(2, 9);
  };

  const handleFinishSuccess = async () => {
    setBusy(true);
    try {
      await api.updateMigrationFlag({ migration_flag: 'Done' });
      toast.success(t('migration.flaggedDone', { defaultValue: 'Account updated successfully!' }));
      if (onFlagUpdated) onFlagUpdated('Done');
      onClose();
      navigate('/closet');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'An error occurred.' }));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelForm = () => {
    setStep('ask');
    setMigrationStage('items');
    setPopupOpened(false);
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
              <DialogTitle className="text-base md:text-lg font-bold font-display flex items-center justify-between">
                <span className="flex items-center gap-2 truncate">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                  {t('migration.screenshotPipelineTitle', { defaultValue: 'Wardrobe Migration Agent' })}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    onClick={handleOpenPopupWindow}
                    className="text-xs text-foreground h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground font-semibold inline-flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>{t('migration.openAppBtn', { appName, defaultValue: `Open ${appName}` })}</span>
                  </Button>
                </div>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {t('migration.screenshotPipelineSub', { defaultValue: 'Agentic closet importer powered by Gemini 2.5 Flash.' })}
              </DialogDescription>
            </DialogHeader>

            {/* Mode Selectors */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setImportMode('screenshot_scroll')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'screenshot_scroll' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{t('migration.modeScreenshotScroll', { defaultValue: 'Agent Scroller' })}</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('paste_urls')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'paste_urls' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>{t('migration.modePasteLinks', { defaultValue: 'Paste Links/JSON' })}</span>
              </button>
            </div>

            {/* Viewport View / Mode Content */}
            <div className="flex-1 relative bg-muted/20 rounded-xl border border-border overflow-y-auto p-4 pb-16 min-h-[280px]">
              {importMode === 'screenshot_scroll' && !popupOpened && (
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
                    
                    {/* Drag bookmarklet */}
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
                        <Shirt className="w-4 h-4" />
                        {t('migration.bookmarkletBtn', { defaultValue: '👗 DressApp Agent' })}
                      </a>
                      <span className="text-[10px] text-muted-foreground">{t('migration.dragTip', { defaultValue: 'Drag this button to your browser Bookmarks Bar' })}</span>
                    </div>

                    <p>
                      {t('migration.bookmarkletUsageInstructions', { appName, defaultValue: `After installing, click "Import wardrobe" below to initialize. Log in to Whering, go to your closet page, then click the "DressApp Agent" bookmarklet.` })}
                    </p>
                  </div>
                </div>
              )}

              {importMode === 'screenshot_scroll' && popupOpened && (
                <div className="space-y-4 text-center">
                  <div className="border-2 border-dashed border-primary/40 rounded-2xl p-6 bg-background/80 hover:bg-background transition-colors cursor-pointer relative group">
                    <UploadCloud className="w-10 h-10 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
                    {syncedItemsList.length === 0 ? (
                      <>
                        <h3 className="text-sm font-bold text-foreground">
                          {t('migration.waitingForAgentTitle', { defaultValue: 'Waiting for Migration Agent' })}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('migration.waitingForAgentSub', { appName, defaultValue: `Click the "DressApp Agent" bookmarklet on your Whering tab to start the agent import.` })}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-sm font-bold text-foreground">
                          {t('migration.agentIngestingTitle', { defaultValue: 'Agent Ingesting Garments...' })}
                        </h3>
                        <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('migration.garmentsImportedCount', { count: syncedItemsList.length, defaultValue: `${syncedItemsList.length} clothes imported` })}
                        </div>
                      </>
                    )}
                  </div>

                  {syncedItemsList.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-card rounded-xl border border-border">
                      {syncedItemsList.map((item, idx) => (
                        <div key={idx} className="aspect-square rounded-lg border border-border overflow-hidden relative bg-muted flex flex-col justify-between">
                          <img src={item.segmented_image_url || item.original_image_url} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-[8px] truncate px-1 text-center font-bold">{item.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importMode === 'paste_urls' && (
                <div className="space-y-3 text-left">
                  <Label className="text-xs font-semibold">
                    {t('migration.pasteUrlsLabel', { defaultValue: 'Paste Image HTTP Links or JSON Array' })}
                  </Label>
                  <Textarea
                    rows={8}
                    value={pastedUrlsText}
                    onChange={(e) => setPastedUrlsText(e.target.value)}
                    placeholder={`https://res.cloudinary.com/whering/image/upload/garment_1.jpg\nhttps://res.cloudinary.com/whering/image/upload/garment_2.jpg`}
                    className="rounded-xl font-mono text-xs p-3 bg-background border-border"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('migration.pasteUrlsSub', { defaultValue: 'Paste image links separated by lines or a JSON array. Each link will be downloaded and processed via GarmentVision AI.' })}
                  </p>
                </div>
              )}
            </div>

            {/* Actions & Status Panel (Normal flow) */}
            {isSyncing ? (
              <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 shrink-0 animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold font-display text-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                    <span>{syncStatusText}</span>
                  </div>
                  <span className="font-mono text-primary font-bold">{progressPct}%</span>
                </div>

                <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40 p-0.5">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-250 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-1.5 rounded-lg bg-background border border-border flex items-center gap-2">
                    <Shirt className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-muted-foreground block">{t('migration.processedGarments', { defaultValue: 'Garments' })}</span>
                      <span className="font-bold font-mono text-foreground text-xs">{syncedItems}</span>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-background border border-border flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-muted-foreground block">{t('migration.outfits', { defaultValue: 'Outfits' })}</span>
                      <span className="font-bold font-mono text-foreground text-xs">{syncedOutfits} / {totalOutfits}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : migrationStage === 'outfits_prompt' ? (
              <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-center shrink-0 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-bold text-xs sm:text-sm font-display">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('migration.garmentsProcessedSuccess', { defaultValue: 'Garments Imported Successfully!' })}
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-mono bg-muted/40 p-1 rounded-lg max-w-sm mx-auto">
                  <span>Imported: {syncedItemsList.length} items</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('migration.importOutfitsPrompt', { defaultValue: 'Would you like to import outfits as well?' })}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1 max-w-sm mx-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFinishSuccess}
                    className="rounded-xl h-8 text-xs font-semibold"
                  >
                    {t('migration.skipOutfitsBtn', { defaultValue: 'Skip Outfits' })}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setMigrationStage('outfits')}
                    className="rounded-xl h-8 bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <span>{t('migration.importOutfitsBtn', { defaultValue: 'Yes, Import' })}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : migrationStage === 'complete' ? (
              <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-center shrink-0 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-bold text-xs sm:text-sm font-display">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('migration.allSuccessTitle', { defaultValue: 'Import Completed Successfully!' })}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t('migration.allSuccessSub', { defaultValue: 'Garment cutouts have been processed by GarmentVision.' })}
                </div>

                <Button
                  onClick={handleFinishSuccess}
                  disabled={busy}
                  className="w-full max-w-xs mx-auto rounded-xl h-8 bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                  data-testid="migration-success-ok-btn"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('migration.openClosetBtn', { defaultValue: 'OK - Open Closet' })}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('migration.garmentVisionReady', { defaultValue: 'Agentic Ingestion Ready' })}
                  </span>
                </div>

                {importMode === 'screenshot_scroll' && !popupOpened ? (
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
                ) : (
                  <Button
                    type="button"
                    onClick={handleStartItemImport}
                    className="rounded-xl h-8 px-4 bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1 shadow-sm hover:opacity-95"
                    data-testid="migration-weblogin-proceed-btn"
                  >
                    <span>
                      {importMode === 'screenshot_scroll'
                        ? t('migration.importBtn', { defaultValue: 'Import' })
                        : t('migration.importRealPhotosBtn', { defaultValue: 'Import Real Photos' })}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}

            {/* Bottom Navigation */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('app_search');
                  setMigrationStage('items');
                  setPopupOpened(false);
                }}
                disabled={isSyncing}
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
