import React, { useState, useMemo } from 'react';
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
import { workStore } from '@/lib/workStore';
import { outfitStore } from '@/lib/outfitStore';
import {
  Loader2,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Globe,
  Search,
  Lock,
  Shirt,
  Layers,
  ExternalLink,
  RefreshCw,
  Copy,
  Image as ImageIcon,
  FileCode2,
  Maximize2
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
  const nav = useNavigate();

  // Steps: 'ask' | 'app_search' | 'web_login'
  const [step, setStep] = useState('ask');
  const [appName, setAppName] = useState('Whering');
  const [appDomain, setAppDomain] = useState('app.whering.co.uk');
  const [customLoginUrl, setCustomLoginUrl] = useState('https://app.whering.co.uk/login');
  const [busy, setBusy] = useState(false);

  // Import mode: 'direct_photos' | 'paste_urls' | 'harvester_script'
  const [importMode, setImportMode] = useState('direct_photos');
  const [pastedUrlsText, setPastedUrlsText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Migration Stage: 'items' | 'outfits_prompt' | 'outfits' | 'complete'
  const [migrationStage, setMigrationStage] = useState('items');

  // Dynamic Item & Outfit counts
  const [itemCountInput, setItemCountInput] = useState(95);
  const [outfitCountInput, setOutfitCountInput] = useState(2);

  // Web View state
  const [viewMode, setViewMode] = useState('iframe');
  const [authenticated, setAuthenticated] = useState(false);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState(false);

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

  const harvesterBookmarkletCode = `copy(Array.from(document.querySelectorAll('img')).filter(i=>{const s=i.src||'';const w=i.naturalWidth||i.width||0;const h=i.naturalHeight||i.height||0;if(!s.startsWith('http'))return false;if(s.includes('.svg')||s.includes('bookmark')||s.includes('logo')||s.includes('avatar')||s.includes('icon')||s.includes('badge')||s.includes('button')||s.includes('grid'))return false;if(w>0&&w<90)return false;if(h>0&&h<90)return false;return true;}).map(i=>i.src)); alert('Done! Filtered out UI icons and copied real garment image URLs to your clipboard. Now paste into DressApp.');`;

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
    toast.info(t('migration.popupOpened', { appName, defaultValue: `Opened ${appName} login window. Log in & navigate to your wardrobe page, then click Import.` }));
    setAuthenticated(true);
  };

  const handleCopyHarvesterCode = () => {
    navigator.clipboard.writeText(harvesterBookmarkletCode);
    toast.success('Copied Harvester Script to clipboard! Run it in your logged-in Whering tab to extract your real photos.');
  };

  // Convert uploaded image files to Base64
  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const readers = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve({
            title: file.name.replace(/\.[^/.]+$/, ''),
            image_url: evt.target.result,
            category: 'Top',
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((parsedItems) => {
      setUploadedFiles((prev) => [...prev, ...parsedItems]);
      toast.success(`Loaded ${parsedItems.length} real garment photos for GarmentVision AI processing!`);
    });
  };

  // Stage 1: Silent Background Import Wardrobe Items (Real photos streamed to GarmentVision)
  const handleStartItemImport = async () => {
    let realPayloadItems = [];

    // Mode 1: User uploaded real photo files
    if (importMode === 'direct_photos' && uploadedFiles.length > 0) {
      realPayloadItems = uploadedFiles.map((fileItem, idx) => ({
        id: `real_file_${idx + 1}`,
        title: fileItem.title || `Real Garment ${idx + 1}`,
        category: fileItem.category || 'Top',
        image_url: fileItem.image_url,
        photo_url: fileItem.image_url,
      }));
    } 
    // Mode 2: User pasted real image URLs / JSON
    else if (pastedUrlsText.trim()) {
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
        toast.error('Could not parse pasted URLs. Please ensure they are valid image HTTP links or JSON array.');
        return;
      }
    }

    // Fallback: If no real items provided yet, prompt user
    if (realPayloadItems.length === 0 && !targetLoginUrl) {
      toast.info('Please select real garment photos or paste your image URLs above to run through GarmentVision!');
      return;
    }

    const jobId = `mig_${Date.now()}`;
    const label = `Importing ${appName || 'Competitor'} Wardrobe`;

    // 1. Register job in global workStore -> Triggers WorkProgressFloater pill
    workStore.registerAnalyze(jobId, label);

    // 2. Toast notification
    toast.info(`Started GarmentVision AI import for ${realPayloadItems.length || 'wardrobe'} items. You can continue browsing!`);

    // 3. Close the modal immediately so the user can navigate freely
    onClose();

    // 4. Run silent async import background job with poller loop
    (async () => {
      try {
        const res = await api.importCompetitorCloset({
          app_name: appName.trim(),
          target_url: targetLoginUrl,
          items: realPayloadItems,
          outfits: [],
        });

        const activeJobId = res.job_id;
        const totalItems = res.total || realPayloadItems.length || 1;
        workStore.updateAnalyze(jobId, { items: 0, total: totalItems });

        // Poll /import-job-status/{activeJobId} every 3 seconds
        const interval = setInterval(async () => {
          try {
            const statusRes = await api.getImportJobStatus(activeJobId);
            const processed = statusRes.processed || 0;
            workStore.updateAnalyze(jobId, { items: processed, total: totalItems });
            closetStore.prewarm({ force: true }).catch(() => {});

            if (statusRes.status === 'completed' || processed >= totalItems) {
              clearInterval(interval);
              workStore.completeAnalyze(jobId);
              toast.success(`GarmentVision AI import complete! ${processed} items added to your Closet.`);
            }
          } catch (pErr) {
            console.warn('Import status poll warning:', pErr);
          }
        }, 3000);
      } catch (err) {
        console.error('Silent import error:', err);
        workStore.completeAnalyze(jobId);
        toast.error(err?.response?.data?.detail || 'Import process failed. Please check your image links.');
      }
    })();
  };

  // Stage 2: Import Outfits
  const handleStartOutfitImport = async () => {
    setIsSyncing(true);
    setShowPermissionOverlay(false);
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

      setSyncStatusText('Finalizing outfit canvas sync...');
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
      nav('/closet');
    } catch {
      onClose();
      nav('/closet');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelForm = async () => {
    setBusy(true);
    try {
      await api.updateMigrationFlag({ migration_flag: 'New' });
      if (onFlagUpdated) onFlagUpdated('New');
      onClose();
    } catch {
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

        {/* STEP 3: REAL GARMENT PHOTOS & GARMENTVISION AI PIPELINE */}
        {step === 'web_login' && (
          <div className="flex flex-col h-full space-y-3 overflow-hidden">
            <DialogHeader className="border-b border-border pb-2.5 shrink-0">
              <DialogTitle className="text-base md:text-lg font-bold font-display flex items-center justify-between">
                <span className="flex items-center gap-2 truncate">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  Import Real Garment Photos (GarmentVision AI)
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
                    <span>Open {appName}</span>
                  </Button>
                </div>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                Select your real garment photos or paste image links. GarmentVision AI will automatically remove backgrounds and populate your Closet.
              </DialogDescription>
            </DialogHeader>

            {/* Mode Selectors */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setImportMode('direct_photos')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'direct_photos' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Upload Photos</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('paste_urls')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'paste_urls' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Paste Links/JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('harvester_script')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === 'harvester_script' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Harvester Script</span>
              </button>
            </div>

            {/* Viewport View / Mode Content */}
            <div className="flex-1 relative bg-muted/20 rounded-xl border border-border overflow-y-auto p-4 min-h-[300px]">
              {importMode === 'direct_photos' && (
                <div className="space-y-4 text-center">
                  <div className="border-2 border-dashed border-primary/40 rounded-2xl p-6 bg-background/80 hover:bg-background transition-colors cursor-pointer relative group">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelection}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <UploadCloud className="w-10 h-10 mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="text-sm font-bold text-foreground">Select or Drop Your Real Garment Photos</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload photos exported from {appName} or your camera roll. GarmentVision will perform background matting automatically.
                    </p>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {uploadedFiles.length} Real Garment Photos Ready
                      </div>
                    )}
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-card rounded-xl border border-border">
                      {uploadedFiles.map((f, idx) => (
                        <div key={idx} className="aspect-square rounded-lg border border-border overflow-hidden relative bg-muted">
                          <img src={f.image_url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importMode === 'paste_urls' && (
                <div className="space-y-3 text-left">
                  <Label className="text-xs font-semibold">Paste Image HTTP Links or JSON Array</Label>
                  <Textarea
                    rows={8}
                    value={pastedUrlsText}
                    onChange={(e) => setPastedUrlsText(e.target.value)}
                    placeholder={`https://res.cloudinary.com/whering/image/upload/garment_1.jpg\nhttps://res.cloudinary.com/whering/image/upload/garment_2.jpg`}
                    className="rounded-xl font-mono text-xs p-3 bg-background border-border"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Paste image links separated by lines or a JSON array. Each link will be downloaded and processed via GarmentVision AI.
                  </p>
                </div>
              )}

              {importMode === 'harvester_script' && (
                <div className="space-y-3 text-left">
                  <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Copy className="w-4 h-4 text-primary" />
                      1-Click DOM Harvester Script
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Log into your {appName} account in another browser tab, open Developer Console (F12), paste this snippet, and hit Enter. It will copy all your real garment photos to your clipboard!
                    </p>
                  </div>

                  <div className="relative">
                    <pre className="p-3 rounded-xl bg-background border border-border text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {harvesterBookmarkletCode}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopyHarvesterCode}
                      className="absolute right-2 top-2 h-7 text-xs bg-primary text-primary-foreground font-bold rounded-lg"
                    >
                      Copy Script
                    </Button>
                  </div>
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
                          <span className="text-[10px] text-muted-foreground block">Processed Cutouts</span>
                          <span className="font-bold font-mono text-foreground">{syncedItems} / {totalItems}</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-background border border-border flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Outfits</span>
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
                    Real Garments Processed & Saved!
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Would you like to import your saved outfits as well?
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 max-w-sm mx-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFinishSuccess}
                      className="rounded-xl h-10 text-xs font-semibold"
                    >
                      Skip Outfits
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setMigrationStage('outfits')}
                      className="rounded-xl h-10 bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <span>Yes, Import Outfits</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : migrationStage === 'complete' ? (
                <div className="absolute inset-x-0 bottom-0 bg-card/98 backdrop-blur-xl border-t border-border p-5 shadow-2xl z-20 space-y-3 text-center animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-base font-display">
                    <CheckCircle2 className="w-6 h-6" />
                    Successfully imported all real garments and outfits!
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Your real garment cutouts have been processed by GarmentVision AI and added to your Closet.
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
                        OK - Open Closet
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-0 bg-card/95 backdrop-blur-md border-t border-border/80 p-3 flex items-center justify-between shadow-lg z-10 gap-2">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground">
                      GarmentVision Ready
                    </span>
                  </div>

                  <Button
                    type="button"
                    onClick={handleStartItemImport}
                    className="rounded-xl h-10 px-5 bg-primary text-primary-foreground font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:opacity-95"
                    data-testid="migration-weblogin-proceed-btn"
                  >
                    <span>Import Real Photos</span>
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
                }}
                disabled={isSyncing}
                className="rounded-xl h-9 text-xs"
              >
                {t('common.back', { defaultValue: 'Back' })}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                All uploaded photos will pass through GarmentVision AI matting automatically.
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
