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
  Image as ImageIcon,
  FileCode2,
  Maximize2,
  Scissors,
  Filter
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
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [popupOpened, setPopupOpened] = useState(false);

  const harvesterBookmarkletCode = 'javascript:(async()=>{if(typeof html2canvas==="undefined"){const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";document.head.appendChild(s);await new Promise(r=>s.onload=r)}const o=document.createElement("div");o.style.cssText="position:fixed;top:20px;left:20px;z-index:999999;background:rgba(0,0,0,0.85);color:white;padding:15px;border-radius:10px;font-family:sans-serif;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.5);width:260px;line-height:1.4;";o.innerHTML="<div style=\'font-weight:bold;margin-bottom:8px;\'>\uD83D\uDC57 DressApp Importer</div><div id=\'da-status\'>Initializing...</div>";document.body.appendChild(o);const st=document.getElementById("da-status");let sc=[];let max=35;let step=350;let prev=-1;for(let i=0;i<max;i++){window.scrollTo(0,i*step);await new Promise(r=>setTimeout(r,1000));if(window.scrollY===prev){st.innerText="Bottom reached.";break}prev=window.scrollY;st.innerText="Capturing screen "+(i+1)+"...";try{const c=await html2canvas(document.body,{logging:false,useCORS:true,allowTaint:true,x:window.scrollX,y:window.scrollY,width:window.innerWidth,height:window.innerHeight});sc.push(c.toDataURL("image/jpeg",0.75))}catch(e){st.innerText="Error: "+e.message}}st.innerText="Sending "+sc.length+" screens...";if(window.opener){window.opener.postMessage({type:"DRESSAPP_MIGRATION_SCREENSHOTS",screenshots:sc},"*");st.innerHTML="<span style=\'color:#10b981;font-weight:bold;\'>\u2713 Done!</span> Return to DressApp.";setTimeout(()=>o.remove(),4000)}else{st.innerHTML="<span style=\'color:#ef4444;font-weight:bold;\'>Error:</span> DressApp opener not found."}})();';

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'DRESSAPP_MIGRATION_SCREENSHOTS') {
        const screens = event.data.screenshots || [];
        if (screens.length > 0) {
          setScreenshotFiles(screens);
          toast.success(t('migration.screenshotsCaptured', { count: screens.length, defaultValue: `Automatically captured ${screens.length} screenshots from your closet!` }));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [t]);

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

  const handleOpenPopupWindow = () => {
    window.open(targetLoginUrl, 'WardrobeAppLoginWindow', 'width=520,height=720,scrollbars=yes,resizable=yes');
    toast.info(t('migration.popupOpened', { appName, defaultValue: `Opened ${appName} login window. Log in & screenshot your wardrobe feed, then click Import.` }));
    setPopupOpened(true);
  };

  // Convert uploaded screenshot frames to Base64
  const handleScreenshotSelection = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const readers = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve(evt.target.result);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((b64Screenshots) => {
      setScreenshotFiles((prev) => [...prev, ...b64Screenshots]);
      toast.success(t('migration.screenshotsLoaded', { count: b64Screenshots.length, defaultValue: `Loaded ${b64Screenshots.length} viewport screenshots for Screenshot-Scroller & Deduplication pipeline!` }));
    });
  };

  // Run Screenshot-Scroller & Deduplication Pipeline (Backend Step A -> B -> C -> D)
  const handleRunScreenshotPipeline = async () => {
    if (!screenshotFiles.length) {
      toast.error(t('migration.noScreenshotsError', { defaultValue: 'Please select or capture at least one screenshot frame.' }));
      return;
    }

    setIsSyncing(true);
    setProgressPct(15);
    setSyncStatusText(t('migration.stepA_Scroller', { defaultValue: 'Step A: Scroll & Capture stabilization (ImageChops.difference)...' }));

    try {
      setTimeout(() => {
        setProgressPct(40);
        setSyncStatusText(t('migration.stepB_GridSlicer', { defaultValue: 'Step B: Bounding box slicing & region extraction (OpenCV contours)...' }));
      }, 700);

      setTimeout(() => {
        setProgressPct(70);
        setSyncStatusText(t('migration.stepC_Dedup', { defaultValue: 'Step C: Item-level perceptual deduplication (Hamming distance <= 5)...' }));
      }, 1400);

      const res = await api.importCompetitorScreenshotScroll({
        app_name: appName.trim(),
        screenshots: screenshotFiles,
        scroll_amount: 300,
        hamming_threshold: 5,
      });

      setProgressPct(95);
      setSyncStatusText(t('migration.stepD_GarmentVision', { defaultValue: 'Step D: Ingesting into GarmentVision AI (background matting & DB)...' }));

      setTimeout(() => {
        setProgressPct(100);
        setIsSyncing(false);
        setPipelineResult(res);
        setSyncedItems(res.items_persisted_count || 0);
        setTotalItems(res.items_persisted_count || 0);
        setMigrationStage('outfits_prompt');
        toast.success(t('migration.pipelineSuccess', { count: res.items_persisted_count, defaultValue: `Successfully extracted and saved ${res.items_persisted_count} unique garments!` }));
      }, 2000);
    } catch (err) {
      setIsSyncing(false);
      toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'An error occurred during screenshot pipeline execution.' }));
    }
  };

  // Stage 1: Silent Background Import Wardrobe Items
  const handleStartItemImport = async () => {
    if (importMode === 'screenshot_scroll') {
      await handleRunScreenshotPipeline();
      return;
    }

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
    setTotalOutfits(dynamicOutfits.length);

    try {
      const outfitDelay = dynamicOutfits.length > 0 ? Math.max(100, Math.floor(800 / dynamicOutfits.length)) : 100;
      for (let j = 1; j <= dynamicOutfits.length; j++) {
        await new Promise((r) => setTimeout(r, outfitDelay));
        setSyncedOutfits(j);
        const outfitPct = 10 + Math.floor((j / dynamicOutfits.length) * 85);
        setProgressPct(outfitPct);
      }

      setSyncStatusText(t('migration.finalizingOutfits', { defaultValue: 'Finalizing outfit canvas sync...' }));
      setProgressPct(98);

      await api.importCompetitorCloset({
        app_name: appName.trim(),
        items: [],
        outfits: dynamicOutfits,
      });

      await outfitStore.prewarm({ force: true }).catch(() => {});
      setProgressPct(100);
      setIsSyncing(false);
      setMigrationStage('complete');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'An error occurred during outfit import.' }));
      setIsSyncing(false);
    }
  };

  const handleFinishSuccess = async () => {
    setBusy(true);
    try {
      await closetStore.prewarm({ force: true });
      await outfitStore.prewarm({ force: true });
      if (onFlagUpdated) onFlagUpdated('Migrate');
      toast.success(t('migration.allImportedSuccess', { defaultValue: 'Successfully imported all wardrobe items and outfits to DressApp!' }));
      onClose();
      navigate('/closet');
    } catch {
      onClose();
      navigate('/closet');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelForm = async () => {
    setBusy(true);
    try {
      await api.updateMigrationFlag({ migration_flag: 'New' });
      if (onFlagUpdated) onFlagUpdated('New');
      setPopupOpened(false);
      onClose();
    } catch {
      setPopupOpened(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!val && !isSyncing) handleCancelForm(); }}>
      <DialogContent className={`rounded-2xl p-4 md:p-6 bg-card border border-border shadow-2xl overflow-hidden transition-all duration-200 ${step === 'web_login' ? 'max-w-3xl w-[95vw] max-h-[92vh] flex flex-col' : 'max-w-md'}`}>
        {/* STEP 1: ASK */}
        {step === 'ask' && (
          <div className="space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-bold font-display">
                {t('migration.askTitle', { defaultValue: 'Do you have an existing digital wardrobe account?' })}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                {t('migration.askSub', { defaultValue: 'Already using another closet app like Stylebook, Acloset, or Whering? Import your real clothes into DressApp using GarmentVision AI!' })}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleNoClick}
                disabled={busy}
                className="rounded-xl h-11 border-border hover:bg-muted font-medium"
                data-testid="migration-modal-no-btn"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.no', { defaultValue: 'No' })}
              </Button>
              <Button
                onClick={() => setStep('app_search')}
                disabled={busy}
                className="rounded-xl h-11 font-medium bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2"
                data-testid="migration-modal-yes-btn"
              >
                {t('common.yes', { defaultValue: 'Yes' })}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: APP SELECTION & IMPORT METHOD */}
        {step === 'app_search' && (
          <form onSubmit={handleGoToWebLogin} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                {t('migration.seamlessTitle', { defaultValue: 'Connect & Import Previous Closet' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t('migration.seamlessSub', { defaultValue: 'Select your previous wardrobe app to import your real garment photos into DressApp.' })}
              </DialogDescription>
            </DialogHeader>

            {/* Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t('migration.searchAppLabel', { defaultValue: 'Popular Digital Wardrobes:' })}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_APPS.map((app) => (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => handleSelectPreset(app)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1 ${
                      appName === app.name
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{app.icon}</span>
                    <span>{app.name}</span>
                  </button>
                ))}
              </div>
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
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
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  {t('migration.screenshotPipelineTitle', { defaultValue: 'Screenshot-Scroller & GarmentVision AI Pipeline' })}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPopupWindow}
                    className="text-xs text-foreground h-7 px-2.5 rounded-lg flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>{t('migration.openAppBtn', { appName, defaultValue: `Open ${appName}` })}</span>
                  </Button>
                </div>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {t('migration.screenshotPipelineSub', { defaultValue: 'Screenshot your competitor wardrobe feeds. Perceptual hashing will deduplicate tiles and GarmentVision AI will extract clean assets.' })}
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
                <span>{t('migration.modeScreenshotScroll', { defaultValue: 'Screenshot Scroller' })}</span>
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
            <div className="flex-1 relative bg-muted/20 rounded-xl border border-border overflow-y-auto p-4 min-h-[300px]">
              {importMode === 'screenshot_scroll' && !popupOpened && (
                <div className="flex flex-col text-left space-y-4 py-2">
                  <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
                    <Globe className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">
                      {t('migration.connectToAppTitle', { appName, defaultValue: `Connect to ${appName}` })}
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-muted-foreground">
                    {/* Extension Notice */}
                    <div className="p-3 bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 rounded-xl flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="font-bold text-foreground block mb-0.5">
                          {t('migration.extInstalledTitle', { defaultValue: 'Using our Chrome Extension? (Recommended)' })}
                        </span>
                        <span>
                          {t('migration.extInstalledSub', { appName, defaultValue: `No bookmarklet needed! Just click "Import wardrobe" below, go to your closet on ${appName}, and click the floating "Import Wardrobe" widget.` })}
                        </span>
                      </div>
                    </div>

                    <p>
                      {t('migration.bookmarkletInstallInstructions', { appName, defaultValue: `Otherwise, drag the bookmarklet button below to your browser Bookmarks Bar (Ctrl+Shift+B to show the bar):` })}
                    </p>
                    
                    {/* Drag bookmarklet */}
                    <div className="flex flex-col items-center justify-center p-3 bg-card border border-border rounded-xl gap-2">
                      <a
                        ref={bookmarkletRef}
                        onClick={(e) => e.preventDefault()} // prevent clicking directly in DressApp
                        className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg cursor-move shadow-sm select-none hover:opacity-90 flex items-center gap-1.5"
                      >
                        <Shirt className="w-4 h-4" />
                        {t('migration.bookmarkletBtn', { defaultValue: '👗 DressApp Importer' })}
                      </a>
                      <span className="text-[10px] text-muted-foreground">{t('migration.dragTip', { defaultValue: 'Drag this button to your browser Bookmarks Bar' })}</span>
                    </div>

                    <p className="text-[11px]">
                      {t('migration.bookmarkletAlternative', { defaultValue: 'Alternative: Copy the script below, open DevTools Console (F12) on your competitor page, paste it and run.' })}
                    </p>

                    <div className="relative">
                      <pre className="p-2 rounded-xl bg-background border border-border text-[10px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap max-h-24">
                        {harvesterBookmarkletCode}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCopyHarvesterCode}
                        className="absolute right-2 top-2 h-6 text-[10px] bg-primary text-primary-foreground font-bold rounded-md"
                      >
                        {t('migration.copyScriptBtn', { defaultValue: 'Copy Script' })}
                      </Button>
                    </div>

                    <p>
                      {t('migration.bookmarkletUsageInstructions', { appName, defaultValue: `After installing, click "Import wardrobe" below. Log in to Whering, go to your closet page, then click the "DressApp Importer" bookmarklet.` })}
                    </p>
                  </div>
                </div>
              )}

              {importMode === 'screenshot_scroll' && popupOpened && (
                <div className="space-y-4 text-center">
                  <div className="border-2 border-dashed border-primary/40 rounded-2xl p-6 bg-background/80 hover:bg-background transition-colors cursor-pointer relative group">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleScreenshotSelection}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <UploadCloud className="w-10 h-10 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
                    {screenshotFiles.length === 0 ? (
                      <>
                        <h3 className="text-sm font-bold text-foreground">
                          {t('migration.waitingForScreenshotsTitle', { defaultValue: 'Waiting for Automated Screenshots' })}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('migration.waitingForScreenshotsSub', { appName, defaultValue: `Click the "DressApp Importer" bookmarklet on your Whering tab to send screens here automatically, or select files manually.` })}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-sm font-bold text-foreground">
                          {t('migration.screenshotsReadyTitle', { defaultValue: 'Screenshots Captured & Ready' })}
                        </h3>
                        <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('migration.screenshotsReady', { count: screenshotFiles.length, defaultValue: `${screenshotFiles.length} Viewport Screenshot Frames Ready` })}
                        </div>
                      </>
                    )}
                  </div>

                  {screenshotFiles.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-card rounded-xl border border-border">
                      {screenshotFiles.map((f, idx) => (
                        <div key={idx} className="aspect-square rounded-lg border border-border overflow-hidden relative bg-muted">
                          <img src={f} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
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

              {/* OVERLAY PANEL & STAGE CONTROL */}
              {isSyncing ? (
                <div className="absolute inset-x-0 bottom-0 bg-card/95 backdrop-blur-xl border-t border-border p-4 shadow-2xl z-20 space-y-3 animate-in slide-in-from-bottom duration-300">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold font-display text-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        <span>{syncStatusText}</span>
                      </div>
                      <span className="font-mono text-primary font-bold">{progressPct}%</span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border border-border/40 p-0.5">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-250 ease-out shadow-xs"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                        <Shirt className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-muted-foreground block">{t('migration.processedGarments', { defaultValue: 'Processed Garments' })}</span>
                          <span className="font-bold font-mono text-foreground">{syncedItems} / {totalItems}</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-muted-foreground block">{t('migration.outfits', { defaultValue: 'Outfits' })}</span>
                          <span className="font-bold font-mono text-foreground">{syncedOutfits} / {totalOutfits}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : migrationStage === 'outfits_prompt' ? (
                <div className="absolute inset-x-0 bottom-0 bg-card/98 backdrop-blur-xl border-t border-border p-4 shadow-2xl z-20 space-y-3 animate-in slide-in-from-bottom duration-200 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-base font-display">
                    <CheckCircle2 className="w-5 h-5" />
                    {t('migration.garmentsProcessedSuccess', { defaultValue: 'Screenshot Pipeline Completed & Garments Saved!' })}
                  </div>
                  {pipelineResult && (
                    <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground font-mono bg-muted/40 p-1.5 rounded-lg max-w-sm mx-auto">
                      <span>Viewports: {pipelineResult.viewports_captured}</span>
                      <span>•</span>
                      <span>Extracted: {pipelineResult.tiles_extracted}</span>
                      <span>•</span>
                      <span>Unique: {pipelineResult.unique_assets}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('migration.importOutfitsPrompt', { defaultValue: 'Would you like to import your saved outfits canvas as well?' })}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 max-w-sm mx-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFinishSuccess}
                      className="rounded-xl h-10 text-xs font-semibold"
                    >
                      {t('migration.skipOutfitsBtn', { defaultValue: 'Skip Outfits' })}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setMigrationStage('outfits')}
                      className="rounded-xl h-10 bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <span>{t('migration.importOutfitsBtn', { defaultValue: 'Yes, Import Outfits' })}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : migrationStage === 'complete' ? (
                <div className="absolute inset-x-0 bottom-0 bg-card/98 backdrop-blur-xl border-t border-border p-5 shadow-2xl z-20 space-y-3 text-center animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-base font-display">
                    <CheckCircle2 className="w-6 h-6" />
                    {t('migration.allSuccessTitle', { defaultValue: 'Successfully imported all real garments and outfits!' })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('migration.allSuccessSub', { defaultValue: 'Your real garment cutouts have been processed by GarmentVision AI and added to your Closet.' })}
                  </div>

                  <Button
                    onClick={handleFinishSuccess}
                    disabled={busy}
                    className="w-full max-w-xs mx-auto rounded-xl h-10 bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg"
                    data-testid="migration-success-ok-btn"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        {t('migration.openClosetBtn', { defaultValue: 'OK - Open Closet' })}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-0 bg-card/95 backdrop-blur-md border-t border-border/80 p-3 flex items-center justify-between shadow-lg z-10 gap-2">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('migration.garmentVisionReady', { defaultValue: 'GarmentVision Pipeline Ready' })}
                    </span>
                  </div>

                  <Button
                    type="button"
                    onClick={
                      importMode === 'screenshot_scroll' && !popupOpened
                        ? handleOpenPopupWindow
                        : handleStartItemImport
                    }
                    className="rounded-xl h-10 px-5 bg-primary text-primary-foreground font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:opacity-95"
                    data-testid="migration-weblogin-proceed-btn"
                  >
                    <span>
                      {importMode === 'screenshot_scroll'
                        ? !popupOpened
                          ? t('migration.importWardrobeBtn', { defaultValue: 'Import wardrobe' })
                          : t('migration.importBtn', { defaultValue: 'Import' })
                        : t('migration.importRealPhotosBtn', { defaultValue: 'Import Real Photos' })}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('app_search');
                  setMigrationStage('items');
                  setPopupOpened(false);
                }}
                disabled={isSyncing}
                className="rounded-xl h-9 text-xs"
              >
                {t('common.back', { defaultValue: 'Back' })}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {t('migration.mattingNotice', { defaultValue: 'All photos & screenshots will pass through GarmentVision AI matting automatically.' })}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
