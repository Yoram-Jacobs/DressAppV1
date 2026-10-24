import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTierLimits } from '@/hooks/useTierLimits';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MigrationFloater } from '@/components/MigrationFloater';
import { toast } from 'sonner';
import {
  Search,
  Star,
  Smartphone,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  X,
  ShieldCheck,
  Shirt,
  Lock,
  ExternalLink,
  Info,
  CheckCircle2,
  Loader2,
  ImagePlus,
  Video,
  Trash2,
  Crown,
} from 'lucide-react';

const CURATED_MIGRATION_PLATFORMS = [
  {
    id: 'whering',
    name: 'Whering',
    domain: 'app.whering.co.uk',
    url: 'https://app.whering.co.uk/login',
    appScheme: 'whering://',
    color: '#ec4899',
    icon: '👗',
    defaultItems: 95,
  },
  {
    id: 'acloset',
    name: 'Acloset',
    domain: 'web.acloset.app',
    url: 'https://web.acloset.app/login',
    appScheme: 'acloset://',
    color: '#6366f1',
    icon: '📱',
    defaultItems: 48,
  },
  {
    id: 'stylebook',
    name: 'Stylebook',
    domain: 'www.stylebookapp.com',
    url: 'https://www.stylebookapp.com',
    appScheme: 'stylebook://',
    color: '#8b5cf6',
    icon: '🎨',
    defaultItems: 65,
  },
  {
    id: 'smartli',
    name: 'Smartli',
    domain: 'smartli.app',
    url: 'https://smartli.app',
    appScheme: 'smartli://',
    color: '#f59e0b',
    icon: '⚡',
    defaultItems: 32,
  },
  {
    id: 'indyx',
    name: 'Indyx',
    domain: 'myindyx.com',
    url: 'https://www.myindyx.com',
    appScheme: 'indyx://',
    color: '#10b981',
    icon: '✨',
    defaultItems: 60,
  },
  {
    id: 'beautyai',
    name: 'BeautyAI',
    domain: 'beautyai.app',
    url: 'https://beautyai.app',
    appScheme: 'beautyai://',
    color: '#f43f5e',
    icon: '💄',
    defaultItems: 25,
  },
];

async function fileImageToBase64Jpeg(file, maxDim = 1080) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (Math.max(w, h) > maxDim) {
          const r = maxDim / Math.max(w, h);
          w = Math.max(1, Math.round(w * r));
          h = Math.max(1, Math.round(h * r));
        }
        const cvs = document.createElement('canvas');
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = cvs.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function extractVideoFramesInBrowser(file, intervalSec = 0.8, maxFrames = 30, maxDim = 1080) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const frames = [];
    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore
      }
    };

    video.onloadedmetadata = async () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 15;
      let w = video.videoWidth || 720;
      let h = video.videoHeight || 1280;
      if (Math.max(w, h) > maxDim) {
        const r = maxDim / Math.max(w, h);
        w = Math.max(1, Math.round(w * r));
        h = Math.max(1, Math.round(h * r));
      }
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');

      const step = Math.max(intervalSec, duration / maxFrames);
      for (let t = 0.1; t < duration && frames.length < maxFrames; t += step) {
        await new Promise((resSeek) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resSeek();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = Math.min(t, duration - 0.05);
        });
        try {
          ctx.drawImage(video, 0, 0, w, h);
          frames.push(cvs.toDataURL('image/jpeg', 0.84));
        } catch {
          // ignore frame error
        }
      }
      cleanup();
      resolve(frames);
    };

    video.onerror = () => {
      cleanup();
      resolve([]);
    };
  });
}

export default function MigrationHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canAccessMigration } = useTierLimits();

  // Search query & state
  const [query, setQuery] = useState('');
  const [activeBrowserApp, setActiveBrowserApp] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  // Harvesting & Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');
  const [harvestedItems, setHarvestedItems] = useState([]);
  const [migrationComplete, setMigrationComplete] = useState(false);

  // Media (Screenshots & Video) Fallback State
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'media'
  const [uploadedFrames, setUploadedFrames] = useState([]);
  const [parsingMedia, setParsingMedia] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef(null);

  // Saved platforms in localStorage
  const [savedPlatformIds, setSavedPlatformIds] = useState(() => {
    try {
      const stored = localStorage.getItem('dressapp_saved_migration_platforms');
      if (stored) return JSON.parse(stored);
    } catch {}
    return ['whering', 'acloset'];
  });

  const toggleSavePlatform = (id) => {
    setSavedPlatformIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      try {
        localStorage.setItem('dressapp_saved_migration_platforms', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const launchApp = useCallback((app) => {
    if (!canAccessMigration) {
      navigate('/pricing');
      return;
    }
    setActiveBrowserApp(app);
    setIframeError(false);
    setMigrationComplete(false);
    setHarvestedItems([]);
    setScanStatusText('');
  }, [canAccessMigration, navigate]);

  // URL query pre-selection: /migration?app=whering
  useEffect(() => {
    const appParam = searchParams.get('app');
    if (appParam) {
      const match = CURATED_MIGRATION_PLATFORMS.find(
        (p) => p.id === appParam.toLowerCase() || p.name.toLowerCase() === appParam.toLowerCase()
      );
      if (match) {
        launchApp(match);
      }
    }
  }, [searchParams, launchApp]);

  const handleLaunchCustomUrl = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    let targetUrl = query.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    let parsedDomain = 'custom-app';
    try {
      parsedDomain = new URL(targetUrl).hostname;
    } catch {}

    const customApp = {
      id: `custom_${Date.now()}`,
      name: parsedDomain.replace('www.', '').split('.')[0].toUpperCase(),
      domain: parsedDomain,
      url: targetUrl,
      color: '#6366f1',
      icon: '✨',
      defaultItems: 50,
    };

    launchApp(customApp);
  };

  const launchNativeApp = (app) => {
    if (app.appScheme) {
      window.location.href = app.appScheme;
      setTimeout(() => {
        window.open(app.url, '_blank', 'noopener,noreferrer');
      }, 1500);
    } else {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Filtered platforms
  const filteredPlatforms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURATED_MIGRATION_PLATFORMS.filter((p) => {
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Saved platforms resolved
  const savedPlatforms = useMemo(() => {
    return savedPlatformIds
      .map((id) => CURATED_MIGRATION_PLATFORMS.find((p) => p.id === id))
      .filter(Boolean);
  }, [savedPlatformIds]);

  // Execute Live Migration via Tab Screen Capture or DOM Scanning
  const handleStartLiveMigration = async () => {
    if (!activeBrowserApp) return;
    setIsScanning(true);
    setScanStatusText(t('migrationHub.scanningWardrobe', { defaultValue: 'Scanning wardrobe grid...' }));

    const appTitle = activeBrowserApp.name || 'Competitor Wardrobe';

    const uploadBatch = async (batch) => {
      if (!batch.length) return;
      try {
        const res = await api.saveMigrationCrops({
          app_name: appTitle,
          cards: batch.map((c) => ({
            crop_base64: c.crop_base64,
            image_url: c.image_url,
            title: c.title || '',
          })),
        });
        return res?.items_saved || batch.length;
      } catch (err) {
        console.warn('[MigrationHub] Batch upload error:', err);
        return batch.length;
      }
    };

    try {
      // 1. Try Screen Capture / Tab Stream if available
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        let stream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },
            preferCurrentTab: true,
          });
        } catch {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
        }

        const track = stream.getVideoTracks()[0];
        const video = document.createElement('video');
        video.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:100px;height:100px;opacity:0.01;pointer-events:none;z-index:-1;';
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        document.body.appendChild(video);
        await video.play();

        await new Promise((r) => setTimeout(r, 1200));

        const vW = video.videoWidth || 1280;
        const vH = video.videoHeight || 720;
        const cardW = Math.round(vW * 0.28);
        const cardH = Math.round(cardW * 1.35);

        // Capture multiple grid crops across 4 scroll passes
        let totalHarvested = 0;
        for (let pass = 0; pass < 4; pass++) {
          setScanStatusText(
            t('migrationHub.harvestingCount', {
              count: totalHarvested,
              defaultValue: `Harvesting items... (${totalHarvested} cards found)`,
            })
          );

          // Sample card regions from viewport
          const batch = [];
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              const srcX = Math.round(vW * 0.1 + col * (cardW * 1.05));
              const srcY = Math.round(vH * 0.15 + row * (cardH * 1.05));
              if (srcX + cardW > vW || srcY + cardH > vH) continue;

              const cvs = document.createElement('canvas');
              cvs.width = cardW;
              cvs.height = cardH;
              const ctx = cvs.getContext('2d');
              ctx.drawImage(video, srcX, srcY, cardW, cardH, 0, 0, cardW, cardH);
              const b64 = cvs.toDataURL('image/jpeg', 0.85).split(',')[1];
              if (b64) {
                batch.push({ crop_base64: b64, title: `${appTitle} Item ${totalHarvested + batch.length + 1}` });
              }
            }
          }

          if (batch.length > 0) {
            await uploadBatch(batch);
            totalHarvested += batch.length;
            setHarvestedItems((prev) => [...prev, ...batch]);
          }

          await new Promise((r) => setTimeout(r, 800));
        }

        track.stop();
        video.remove();

        setMigrationComplete(true);
        setIsScanning(false);
        setScanStatusText(
          t('migrationHub.migrationComplete', {
            count: totalHarvested,
            defaultValue: `✓ ${totalHarvested} items migrated to your DressApp closet!`,
          })
        );

        try {
          const bc = new BroadcastChannel('dressapp_migration');
          bc.postMessage({
            type: 'DRESSAPP_MIGRATION_COMPLETE',
            total_cards: totalHarvested,
            app_name: appTitle,
          });
        } catch {}

        toast.success(
          t('migrationHub.migrationComplete', {
            count: totalHarvested,
            defaultValue: `✓ ${totalHarvested} items migrated to your DressApp closet!`,
          })
        );
        return;
      }

      // 2. Fallback if getDisplayMedia is unavailable: Guide user to Screenshots tab
      toast.info(
        t('migration.screenshotsInstructions', {
          appName: appTitle,
          defaultValue: `Please upload screenshots of your ${appTitle} wardrobe grid.`,
        })
      );
      setActiveTab('media');
    } catch (err) {
      toast.error(err?.message || t('common.errorOccurred', { defaultValue: 'An error occurred.' }));
    } finally {
      setIsScanning(false);
    }
  };

  // Media Picker Handler (Screenshots & Video)
  const handleSelectScreenshotsOrVideo = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setParsingMedia(true);
    try {
      const extracted = [];
      for (const file of files) {
        if (file.type.startsWith('video/')) {
          const vFrames = await extractVideoFramesInBrowser(file, 0.8, 30, 1080);
          extracted.push(...vFrames);
        } else if (file.type.startsWith('image/')) {
          const b64 = await fileImageToBase64Jpeg(file, 1080);
          if (b64) extracted.push(b64);
        }
      }
      if (extracted.length > 0) {
        setUploadedFrames((prev) => [...prev, ...extracted].slice(0, 40));
        toast.success(
          t('migration.framesReadyBadge', {
            count: extracted.length,
            defaultValue: `${extracted.length} closet frames ready to slice`,
          })
        );
      }
    } catch {
      toast.error(t('common.errorOccurred', { defaultValue: 'An error occurred.' }));
    } finally {
      setParsingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleUploadMediaMigration = async () => {
    if (!uploadedFrames.length || !activeBrowserApp) return;
    setUploadingMedia(true);
    try {
      const res = await api.uploadMigrationScreenshots({
        app_name: activeBrowserApp.name || 'Competitor Wardrobe',
        frames_base64: uploadedFrames,
      });
      const savedCount = res?.items_saved ?? uploadedFrames.length;
      await api.updateMigrationFlag({ migration_flag: 'Migrated' }).catch(() => {});
      toast.success(
        t('migration.screenshotsImportedSuccess', {
          count: savedCount,
          appName: activeBrowserApp.name,
          defaultValue: `Imported ${savedCount} garments from ${activeBrowserApp.name}! AI analysis is running in the background.`,
        })
      );
      setUploadedFrames([]);
      setAgentModalOpen(false);
      navigate('/closet');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'An error occurred.' }));
    } finally {
      setUploadingMedia(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════
  // MODE 1: IN-APP COMPETITOR BROWSER VIEW (When an app is launched)
  // ═════════════════════════════════════════════════════════════════
  if (activeBrowserApp) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
        {/* Browser Top Navigation Bar */}
        <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between shadow-md shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBrowserApp(null)}
              className="text-white/80 hover:text-white hover:bg-slate-800 h-8 px-2"
              title={t('common.close', { defaultValue: 'Exit Browser' })}
            >
              <ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />
              <span className="text-xs font-semibold">{t('shoppingHub.hub', { defaultValue: 'Hub' })}</span>
            </Button>
            <div className="h-4 w-px bg-slate-700 mx-1" />
            <div className="flex items-center gap-1.5">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black text-white shrink-0"
                style={{ backgroundColor: activeBrowserApp.color || '#6366f1' }}
              >
                {activeBrowserApp.icon || '👗'}
              </span>
              <span className="font-bold text-xs truncate max-w-[120px] sm:max-w-[200px]">
                {activeBrowserApp.name}
              </span>
            </div>
          </div>

          {/* Secure URL Badge */}
          <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span className="truncate max-w-[220px]">{activeBrowserApp.domain}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(activeBrowserApp.url, '_blank', 'noopener,noreferrer')}
              className="text-amber-400 hover:text-amber-300 hover:bg-slate-800 h-8 px-2.5 text-xs font-semibold"
              title={t('migrationHub.openInBrowser', { defaultValue: 'Open in new tab to sign in or bypass pop-ups' })}
            >
              <ExternalLink className="w-3.5 h-3.5 me-1" />
              <span className="hidden sm:inline">{t('migrationHub.openFullSite', { defaultValue: 'Open in Tab' })}</span>
            </Button>
            {activeBrowserApp.appScheme && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => launchNativeApp(activeBrowserApp)}
                className="text-sky-400 hover:text-sky-300 hover:bg-slate-800 h-8 px-2 text-xs"
                title={t('migrationHub.storeApp', { defaultValue: 'Open in Native App' })}
              >
                <Smartphone className="w-3.5 h-3.5 me-1" />
                <span className="hidden md:inline">{t('migrationHub.storeApp', { defaultValue: 'Native App' })}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAgentModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 px-3 text-xs font-semibold rounded-lg ms-1 shadow-sm"
              data-testid="migration-open-agent-topbar-btn"
            >
              <Sparkles className="w-3.5 h-3.5 me-1 text-amber-300" />
              <span>{t('migrationHub.migrateWardrobe', { defaultValue: 'Migrate Wardrobe' })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBrowserApp(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0 ms-1 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Notice Banner with Step-by-Step Instructions */}
        <div className="bg-amber-500/15 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-900 bg-amber-50 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span className="truncate">
              {t('migrationHub.loginNotice', {
                appName: activeBrowserApp.name,
                defaultValue: "1. Sign in • 2. Close all pop-up screens • 3. Go to your wardrobe grid • 4. Tap the DressApp Agent icon to migrate!",
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.open(activeBrowserApp.url, '_blank', 'noopener,noreferrer')}
            className="font-bold underline hover:no-underline shrink-0 ms-2 text-amber-800 flex items-center gap-1"
          >
            <span>{t('migrationHub.openDirectTab', { defaultValue: 'Open in Tab ↗' })}</span>
          </button>
        </div>

        {/* Embedded Web View */}
        <div className="flex-1 relative bg-sand/30 overflow-hidden">
          {!iframeError ? (
            <iframe
              src={activeBrowserApp.url}
              title={activeBrowserApp.name}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation allow-downloads"
              onError={() => setIframeError(true)}
            />
          ) : null}

          {/* Anti-Frame Fallback Card */}
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-sand/80 backdrop-blur-xs">
              <Card className="max-w-md w-full rounded-2xl border border-border bg-white shadow-xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-dark-brand">
                    {t('migrationHub.frameProtectedTitle', {
                      name: activeBrowserApp.name,
                      defaultValue: `${activeBrowserApp.name} shields direct in-frame browsing`,
                    })}
                  </h3>
                  <p className="text-xs text-text-brand mt-1.5 leading-relaxed">
                    {t('migrationHub.frameProtectedDesc', {
                      defaultValue: 'Some wardrobe platforms protect in-frame embedding. You can open their web app in a new tab or batch-upload closet screenshots with 1 tap!',
                    })}
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    onClick={() => window.open(activeBrowserApp.url, '_blank', 'noopener,noreferrer')}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4 me-1.5" />
                    {t('migrationHub.openExternalTab', {
                      name: activeBrowserApp.name,
                      defaultValue: `Open ${activeBrowserApp.name} in New Tab ↗`,
                    })}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAgentModalOpen(true);
                      setActiveTab('media');
                    }}
                    className="w-full border-border text-xs h-10 font-medium"
                  >
                    <ImagePlus className="w-4 h-4 me-1.5 text-indigo-600" />
                    {t('migrationHub.uploadMediaFallback', { defaultValue: 'Upload Screenshots / Video' })}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* The Movable / Draggable DressApp Migration Agent Floater */}
          <MigrationFloater
            onClick={() => setAgentModalOpen(true)}
            isScanning={isScanning}
          />
        </div>

        {/* Migration Agent Bottom Sheet / Modal */}
        {agentModalOpen && (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Sheet Header */}
              <div className="p-4 border-b border-border bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
                    <Shirt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>{t('migrationHub.agentSheetTitle', { name: activeBrowserApp.name, defaultValue: `${activeBrowserApp.name} Wardrobe Migration Agent` })}</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    </h4>
                    <span className="text-[11px] text-slate-300 block">
                      {t('migrationHub.agentSheetDesc', {
                        defaultValue: 'Scans your visible clothes, removes backgrounds, tags items, and saves them to your DressApp closet.',
                      })}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAgentModalOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-slate-800 h-8 w-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Mode Tabs */}
              <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('agent')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'agent'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('migrationHub.liveAgentScanTab', { defaultValue: 'Live Grid Migration' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('media')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'media'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{t('migration.modeScreenshotsTab', { defaultValue: 'Screenshots / Video' })}</span>
                </button>
              </div>

              {/* Sheet Content */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {activeTab === 'agent' ? (
                  <div className="space-y-4 text-start">
                    {/* Checklist */}
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                      <div className="text-[12px] font-bold text-indigo-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>{t('migrationHub.checklistTitle', { defaultValue: 'Pre-Migration Checklist' })}</span>
                      </div>
                      <ul className="text-[11px] text-indigo-900 space-y-1 ps-5 list-disc font-medium">
                        <li>{t('migrationHub.checkLogin', { name: activeBrowserApp.name, defaultValue: `Logged in to ${activeBrowserApp.name}` })}</li>
                        <li>{t('migrationHub.checkPopups', { defaultValue: 'All pop-up screens, modals & cookies closed' })}</li>
                        <li>{t('migrationHub.checkGrid', { defaultValue: 'Wardrobe / closet grid visible on screen' })}</li>
                      </ul>
                    </div>

                    {/* Progress / Status Display */}
                    {isScanning && (
                      <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-center animate-pulse">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                        <div className="text-xs font-bold">{scanStatusText}</div>
                        <div className="text-[11px] text-slate-300">
                          {t('migration.tabSleepAlert', { defaultValue: 'Please keep this window visible while items are migrating.' })}
                        </div>
                      </div>
                    )}

                    {/* Harvested Thumbnails Reel */}
                    {harvestedItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-dark-brand">
                          <span>{t('migrationHub.harvestedBadge', { count: harvestedItems.length, defaultValue: `${harvestedItems.length} items captured` })}</span>
                          <span className="text-emerald-600 font-semibold">✓ Syncing to Closet</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                          {harvestedItems.slice(-10).map((item, idx) => (
                            <img
                              key={idx}
                              src={item.crop_base64 ? `data:image/jpeg;base64,${item.crop_base64}` : item.image_url}
                              alt="Garment card"
                              className="w-14 h-18 object-cover rounded-lg border border-border shadow-xs shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed State */}
                    {migrationComplete && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-bold text-emerald-950">
                          {t('migrationHub.migrationComplete', {
                            count: harvestedItems.length,
                            defaultValue: `✓ ${harvestedItems.length} items migrated to your DressApp closet!`,
                          })}
                        </div>
                        <Button
                          onClick={() => {
                            setAgentModalOpen(false);
                            navigate('/closet');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
                        >
                          <Shirt className="w-3.5 h-3.5 me-1.5" />
                          <span>{t('migrationHub.openClosetBtn', { defaultValue: 'Open My Closet' })}</span>
                        </Button>
                      </div>
                    )}

                    {/* Start Action Button */}
                    {!migrationComplete && (
                      <Button
                        type="button"
                        disabled={isScanning}
                        onClick={handleStartLiveMigration}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-11 rounded-xl shadow-sm flex items-center justify-center gap-2"
                        data-testid="migration-start-harvest-btn"
                      >
                        {isScanning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('migrationHub.scanningWardrobe', { defaultValue: 'Scanning wardrobe grid...' })}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>{t('migrationHub.startMigrationBtn', { defaultValue: 'Start Wardrobe Migration' })}</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  /* MEDIA (SCREENSHOTS / VIDEO) TAB */
                  <div className="space-y-4 text-start">
                    <p className="text-xs text-text-brand leading-relaxed">
                      {t('migration.screenshotsInstructions', {
                        appName: activeBrowserApp.name,
                        defaultValue: `Take screenshots of your ${activeBrowserApp.name} closet grid (or record your screen while scrolling through your closet) and upload them below.`,
                      })}
                    </p>

                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleSelectScreenshotsOrVideo}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-indigo-200 rounded-xl gap-2 text-center">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <ImagePlus className="w-6 h-6" />
                        <Video className="w-6 h-6" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={parsingMedia || uploadingMedia}
                        onClick={() => mediaInputRef.current?.click()}
                        className="rounded-full text-xs h-9 font-bold border-indigo-300 text-indigo-700"
                      >
                        {parsingMedia ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
                            <span>{t('migration.extractingFrames', { defaultValue: 'Extracting frames...' })}</span>
                          </>
                        ) : (
                          <span>{t('migration.selectScreenshotsOrVideoBtn', { defaultValue: 'Select Screenshots or Video' })}</span>
                        )}
                      </Button>
                      <span className="text-[10px] text-text-brand">
                        {t('migration.screenshotsSupportHint', { defaultValue: 'Works on iOS & Android with any wardrobe app (PNG, JPG, MP4, MOV)' })}
                      </span>
                    </div>

                    {uploadedFrames.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-dark-brand">
                          <span>
                            {t('migration.framesReadyBadge', {
                              count: uploadedFrames.length,
                              defaultValue: `${uploadedFrames.length} closet frames ready to slice`,
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setUploadedFrames([])}
                            className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold hover:underline"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t('common.clear', { defaultValue: 'Clear' })}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {uploadedFrames.slice(0, 10).map((src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt="Frame"
                              className="w-14 h-20 object-cover rounded-lg border border-border shrink-0"
                            />
                          ))}
                        </div>
                        <Button
                          type="button"
                          disabled={uploadingMedia}
                          onClick={handleUploadMediaMigration}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-10 rounded-xl"
                        >
                          {uploadingMedia ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
                              <span>{t('migration.slicingAndImporting', { defaultValue: 'Slicing & Importing...' })}</span>
                            </>
                          ) : (
                            <>
                              <span>{t('migration.sliceAndImportBtn', { defaultValue: 'Slice & Import Closet' })}</span>
                              <ArrowRight className="w-3.5 h-3.5 ms-1.5 rtl:rotate-180" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // MODE 2: MIGRATION HUB SELECTION & DIRECTORY (Initial View)
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-sand/30 pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white px-4 pt-8 pb-10">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to="/closet"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                <span>{t('nav.closet', { defaultValue: 'Closet' })}</span>
              </Link>
            </div>
            {!canAccessMigration && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold">
                <Crown className="w-3 h-3 me-1 text-amber-300" />
                <span>{t('onboarding.step3.migrationProBadge', { defaultValue: 'Manager / Pro' })}</span>
              </Badge>
            )}
          </div>

          <div className="space-y-1.5 text-start">
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <Shirt className="w-7 h-7 text-indigo-400" />
              <span>{t('migrationHub.title', { defaultValue: 'Wardrobe Migration Hub' })}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {t('migrationHub.subtitle', {
                defaultValue:
                  'Connect your previous wardrobe app, close pop-ups, browse to your closet grid, and let the DressApp Agent migrate your clothes.',
              })}
            </p>
          </div>

          {/* Search & URL Input */}
          <form onSubmit={handleLaunchCustomUrl} className="relative pt-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder={t('migrationHub.searchPlaceholder', {
                  defaultValue: 'Search wardrobe app or enter web URL (e.g., Whering, Acloset, Stylebook)...',
                })}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 ps-10 pe-24 bg-white/10 backdrop-blur-md border-white/20 text-white placeholder:text-slate-400 rounded-xl text-xs focus:bg-white/15 transition-all"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1.5 rtl:right-auto rtl:left-1.5 h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <span>{t('common.open', { defaultValue: 'Connect' })}</span>
                <ArrowRight className="w-3.5 h-3.5 ms-1 rtl:rotate-180" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-6">
        {/* Saved / Frequent Platforms */}
        {savedPlatforms.length > 0 && (
          <div className="space-y-2.5 text-start">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-dark-brand">
                {t('migrationHub.savedPlatforms', { defaultValue: 'Your Wardrobe Platforms' })}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {savedPlatforms.map((platform) => (
                <Card
                  key={platform.id}
                  className="rounded-xl border border-border bg-white p-3 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{platform.icon}</span>
                      <div className="text-start">
                        <span className="font-bold text-xs text-dark-brand block">{platform.name}</span>
                        <span className="text-[10px] text-text-brand truncate block max-w-[100px]">{platform.domain}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSavePlatform(platform.id)}
                      className="text-amber-500 hover:text-slate-400"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                    </button>
                  </div>

                  <div className="pt-3 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => launchApp(platform)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold h-7 rounded-lg shadow-xs"
                    >
                      <Sparkles className="w-3 h-3 me-1 text-amber-300" />
                      {t('migrationHub.connectAndMonitor', { defaultValue: 'Connect' })}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(platform.url, '_blank', 'noopener,noreferrer')}
                      className="h-7 px-2 border-border text-[11px] text-muted-foreground hover:text-dark-brand"
                      title={t('migrationHub.openInBrowser', { defaultValue: 'Open in new tab' })}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Curated Platforms Directory */}
        <div className="space-y-3 text-start">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xs uppercase tracking-wider text-dark-brand">
              {t('migrationHub.curatedPlatforms', { defaultValue: 'Supported Competitor Platforms' })}
            </h2>
            <span className="text-[11px] text-text-brand font-medium">
              {filteredPlatforms.length} {t('common.apps', { defaultValue: 'platforms' })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredPlatforms.map((platform) => {
              const isSaved = savedPlatformIds.includes(platform.id);
              return (
                <Card
                  key={platform.id}
                  className="rounded-xl border border-border bg-white p-3.5 hover:shadow-sm hover:border-indigo-300 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{platform.icon}</span>
                    <div className="min-w-0 text-start">
                      <span className="font-bold text-xs text-dark-brand block truncate">{platform.name}</span>
                      <span className="text-[11px] text-text-brand truncate block">{platform.domain}</span>
                      <span className="text-[10px] text-indigo-600 font-semibold mt-0.5 block">
                        ~{platform.defaultItems} {t('common.items', { defaultValue: 'items' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleSavePlatform(platform.id)}
                      className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-50 transition-colors"
                      title={isSaved ? 'Remove from favorites' : 'Save to favorites'}
                    >
                      <Star className={`w-4 h-4 ${isSaved ? 'text-amber-500 fill-amber-500' : ''}`} />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(platform.url, '_blank', 'noopener,noreferrer')}
                      className="h-8 px-2 border-border text-xs text-muted-foreground hover:text-dark-brand"
                      title={t('migrationHub.openInBrowser', { defaultValue: 'Open in new tab' })}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => launchApp(platform)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-8 px-3 rounded-lg shadow-xs"
                      data-testid={`migration-connect-${platform.id}-btn`}
                    >
                      <Sparkles className="w-3 h-3 me-1 text-amber-300" />
                      <span>{t('migrationHub.connectAndMonitor', { defaultValue: 'Connect' })}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Media Upload Callout */}
        <Card className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 p-4 text-start">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-indigo-600" />
                <span>{t('migrationHub.quickScreenshots', { defaultValue: 'Batch Upload Screenshots & Video' })}</span>
              </div>
              <p className="text-[11px] text-indigo-900 leading-relaxed">
                {t('migrationHub.quickScreenshotsDesc', {
                  defaultValue: 'Prefer uploading from camera roll? Select screenshots or screen recording of your closet.',
                })}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (filteredPlatforms.length > 0) {
                  launchApp(filteredPlatforms[0]);
                  setTimeout(() => {
                    setAgentModalOpen(true);
                    setActiveTab('media');
                  }, 100);
                }
              }}
              className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold h-9 px-4 rounded-xl shrink-0"
            >
              <ImagePlus className="w-3.5 h-3.5 me-1.5" />
              <span>{t('migration.modeScreenshotsTab', { defaultValue: 'Screenshots / Video' })}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
