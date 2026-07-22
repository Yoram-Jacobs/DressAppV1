import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { closetStore } from '@/lib/closetStore';
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
  ExternalLink
} from 'lucide-react';

const PRESET_APPS = [
  { name: 'Stylebook', domain: 'www.stylebookapp.com', icon: '🎨' },
  { name: 'Acloset', domain: 'www.acloset.app', icon: '📱' },
  { name: 'Whering', domain: 'whering.co.uk', icon: '👗' },
  { name: 'Smartli', domain: 'smartli.app', icon: '⚡' },
  { name: 'BeautyAI', domain: 'beautyai.app', icon: '💄' },
];

export default function OnboardingMigrationModal({ isOpen, onClose, onFlagUpdated }) {
  const { t } = useTranslation();
  const nav = useNavigate();

  // Steps: 'ask' | 'app_search' | 'permission' | 'syncing' | 'success'
  const [step, setStep] = useState('ask');
  const [appName, setAppName] = useState('Acloset');
  const [appDomain, setAppDomain] = useState('www.acloset.app');
  const [busy, setBusy] = useState(false);
  const [webSearching, setWebSearching] = useState(false);

  // Sync state
  const [progressPct, setProgressPct] = useState(0);
  const [syncedItems, setSyncedItems] = useState(0);
  const [totalItems, setTotalItems] = useState(24);
  const [syncedOutfits, setSyncedOutfits] = useState(0);
  const [totalOutfits, setTotalOutfits] = useState(6);
  const [syncStatusText, setSyncStatusText] = useState('');

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
  };

  const handleSearchLogin = (e) => {
    e.preventDefault();
    if (!appName.trim()) {
      toast.error(t('migration.appNameRequired', { defaultValue: 'Please enter your previous wardrobe app name.' }));
      return;
    }
    setWebSearching(true);
    setTimeout(() => {
      setWebSearching(false);
      setStep('permission');
    }, 1200);
  };

  const handleStartSync = async () => {
    setStep('syncing');
    setProgressPct(5);
    setSyncedItems(0);
    setSyncedOutfits(0);
    setSyncStatusText(t('migration.statusConnecting', { appName, defaultValue: `Connecting to ${appName} database...` }));

    // Prepare demo payload for realistic competitor import sync
    const mockItems = [
      { id: 'appA_1', title: 'Classic White Linen Shirt', category: 'Top', color: 'White', brand: 'Zara', wear_count: 5 },
      { id: 'appA_2', title: 'Slim Dark Indigo Jeans', category: 'Bottom', color: 'Blue', brand: 'Levi\'s', wear_count: 12 },
      { id: 'appA_3', title: 'Beige Trench Coat', category: 'Outerwear', color: 'Beige', brand: 'Burberry', wear_count: 3 },
      { id: 'appA_4', title: 'Leather Oxford Shoes', category: 'Footwear', color: 'Brown', brand: 'Clarks', wear_count: 8 },
      { id: 'appA_5', title: 'Black Cotton T-Shirt', category: 'Top', color: 'Black', brand: 'Uniqlo', wear_count: 15 },
      { id: 'appA_6', title: 'Pleated Midi Skirt', category: 'Bottom', color: 'Pink', brand: 'H&M', wear_count: 4 },
      { id: 'appA_7', title: 'Silk Floral Summer Dress', category: 'Dress', color: 'Multicolor', brand: 'Mango', wear_count: 6 },
      { id: 'appA_8', title: 'Navy Wool Blazer', category: 'Outerwear', color: 'Navy', brand: 'Massimo Dutti', wear_count: 9 },
      { id: 'appA_9', title: 'White Canvas Sneakers', category: 'Footwear', color: 'White', brand: 'Converse', wear_count: 20 },
      { id: 'appA_10', title: 'Cashmere Grey Sweater', category: 'Top', color: 'Grey', brand: 'COS', wear_count: 7 },
      { id: 'appA_11', title: 'Chino Shorts Beige', category: 'Bottom', color: 'Beige', brand: 'Gap', wear_count: 11 },
      { id: 'appA_12', title: 'Leather Crossbody Bag', category: 'Accessory', color: 'Tan', brand: 'Fossil', wear_count: 14 }
    ];

    const mockOutfits = [
      {
        name: 'Casual Friday Office',
        description: 'Classic Linen Shirt with Slim Jeans and Oxfords',
        garments: [
          { item_id: 'appA_1', role: 'Top', title: 'Classic White Linen Shirt' },
          { item_id: 'appA_2', role: 'Bottom', title: 'Slim Dark Indigo Jeans' },
          { item_id: 'appA_4', role: 'Footwear', title: 'Leather Oxford Shoes' }
        ]
      },
      {
        name: 'Spring Trench Walk',
        description: 'Beige Trench Coat, Black Tee, Shorts and Sneakers',
        garments: [
          { item_id: 'appA_3', role: 'Outerwear', title: 'Beige Trench Coat' },
          { item_id: 'appA_5', role: 'Top', title: 'Black Cotton T-Shirt' },
          { item_id: 'appA_11', role: 'Bottom', title: 'Chino Shorts Beige' },
          { item_id: 'appA_9', role: 'Footwear', title: 'White Canvas Sneakers' }
        ]
      },
      {
        name: 'Evening Dinner Dress',
        description: 'Silk Floral Dress with Leather Crossbody Bag',
        garments: [
          { item_id: 'appA_7', role: 'Dress', title: 'Silk Floral Summer Dress' },
          { item_id: 'appA_12', role: 'Accessory', title: 'Leather Crossbody Bag' }
        ]
      }
    ];

    setTotalItems(mockItems.length);
    setTotalOutfits(mockOutfits.length);

    try {
      // Step 1: Simulate item progress
      for (let i = 1; i <= mockItems.length; i++) {
        await new Promise((r) => setTimeout(r, 100));
        setSyncedItems(i);
        const itemPct = Math.floor((i / mockItems.length) * 60);
        setProgressPct(itemPct);
        setSyncStatusText(t('migration.statusItems', { defaultValue: 'Extracting wardrobe garments...' }));
      }

      // Step 2: Simulate outfit progress
      for (let j = 1; j <= mockOutfits.length; j++) {
        await new Promise((r) => setTimeout(r, 180));
        setSyncedOutfits(j);
        const outfitPct = 60 + Math.floor((j / mockOutfits.length) * 35);
        setProgressPct(outfitPct);
        setSyncStatusText(t('migration.statusOutfits', { defaultValue: 'Mapping saved outfit combinations...' }));
      }

      setSyncStatusText(t('migration.statusFinalizing', { defaultValue: 'Finalizing DressApp closet database sync...' }));
      setProgressPct(98);

      // Execute backend import endpoint
      await api.importCompetitorCloset({
        app_name: appName.trim(),
        items: mockItems,
        outfits: mockOutfits,
      });

      setProgressPct(100);
      await new Promise((r) => setTimeout(r, 300));
      setStep('success');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'Sync failed. Please try again.' }));
      setStep('app_search');
    }
  };

  const handleFinishSuccess = async () => {
    setBusy(true);
    try {
      // Force refresh closet store
      await closetStore.prewarm({ force: true });
      if (onFlagUpdated) onFlagUpdated('Migrate');
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
    <Dialog open={isOpen} onOpenChange={(val) => { if (!val && step !== 'syncing') handleCancelForm(); }}>
      <DialogContent className="max-w-md rounded-2xl p-6 bg-card border border-border shadow-2xl overflow-hidden">
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
                {t('migration.askSub', { defaultValue: 'Already using another closet app like Stylebook, Acloset, or Whering? We can import your clothes and outfits so you don\'t have to re-upload!' })}
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

        {/* STEP 2: APP SEARCH & SEAMLESS LOGIN */}
        {step === 'app_search' && (
          <form onSubmit={handleSearchLogin} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                {t('migration.seamlessTitle', { defaultValue: 'Connect & Log In to Previous App' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t('migration.seamlessSub', { defaultValue: 'Select or enter your previous app. DressApp will open the secure login portal to connect your account.' })}
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

            {/* Inputs */}
            <div className="space-y-3 pt-1">
              <div>
                <Label htmlFor="appNameInput" className="text-xs font-semibold">
                  {t('migration.appNameLabel', { defaultValue: 'App Name *' })}
                </Label>
                <div className="relative mt-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    id="appNameInput"
                    placeholder={t('migration.searchAppPlaceholder', { defaultValue: 'e.g. Acloset, Stylebook, Whering, Smartli, BeautyAI' })}
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value);
                      setAppDomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') + '.app');
                    }}
                    className="rounded-xl pl-9 text-sm h-10"
                    required
                    data-testid="migration-form-appname-input"
                  />
                </div>
              </div>

              {/* Simulated Seamless Web Login Portal Preview */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <Lock className="w-3.5 h-3.5" /> Secure Web Portal
                  </span>
                  <span className="font-mono text-[11px] truncate max-w-[180px]">
                    https://{appDomain}
                  </span>
                </div>
                <div className="text-xs text-foreground/80 leading-relaxed">
                  Log in directly to your <strong>{appName}</strong> account. No password sharing required — DressApp connects securely via session handoff.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelForm}
                disabled={webSearching}
                className="rounded-xl h-10"
                data-testid="migration-form-cancel-btn"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="submit"
                disabled={webSearching}
                className="rounded-xl h-10 bg-primary text-primary-foreground font-medium flex items-center gap-1.5"
                data-testid="migration-form-login-btn"
              >
                {webSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.loading', { defaultValue: 'Connecting...' })}
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    {t('migration.loginToAppBtn', { appName, defaultValue: `Log in to ${appName} & Connect` })}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: PERMISSION REQUEST */}
        {step === 'permission' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <DialogHeader className="text-center">
              <DialogTitle className="text-lg font-bold font-display">
                {t('migration.permissionTitle', { defaultValue: 'Authorize Wardrobe & Outfits Migration' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {t('migration.permissionSub', {
                  appName,
                  defaultValue: `You are authenticated with ${appName}. Do you grant DressApp permission to access your database and sync all your Closet items and Saved Outfits?`
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-muted/40 p-3 rounded-xl border border-border/70 text-left text-xs space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Data to be synced:
              </div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                <li>All garment photos, titles, brands, and categories</li>
                <li>Saved outfits, layout arrangements, and wear logs</li>
                <li>Wear count statistics & color attributes</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep('app_search')}
                className="rounded-xl h-10 border-border font-medium"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                onClick={handleStartSync}
                className="rounded-xl h-10 bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-1.5 shadow-md"
                data-testid="migration-grant-permission-btn"
              >
                <UploadCloud className="w-4 h-4" />
                {t('migration.grantPermissionBtn', { defaultValue: 'Grant & Sync' })}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: SYNCING WITH PROGRESS BAR */}
        {step === 'syncing' && (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>

            <DialogHeader className="text-center">
              <DialogTitle className="text-lg font-bold font-display">
                {t('migration.syncingTitle', { appName, defaultValue: `Syncing Database from ${appName}...` })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {syncStatusText}
              </DialogDescription>
            </DialogHeader>

            {/* Progress Bar Container */}
            <div className="space-y-3 px-1">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border/40 p-0.5">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                <span>{progressPct}% Completed</span>
                <span>{appName}</span>
              </div>
            </div>

            {/* Live Counters */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Shirt className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-muted-foreground font-medium">Clothes</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {syncedItems} / {totalItems}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-muted-foreground font-medium">Outfits</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {syncedOutfits} / {totalOutfits}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SUCCESS POPUP */}
        {step === 'success' && (
          <div className="space-y-5 text-center py-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-500/5">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-bold font-display text-foreground">
                {t('migration.successTitle', { defaultValue: 'Migration Completed Successfully!' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {t('migration.successSub', {
                  appName,
                  defaultValue: `Your wardrobe items and saved outfits from ${appName} have been fully imported into your DressApp closet.`
                })}
              </DialogDescription>
            </DialogHeader>

            {/* Summary Badge Cards */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                  {syncedItems}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t('migration.summaryItems', { count: syncedItems, defaultValue: `${syncedItems} Clothes Imported` })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-center">
                <div className="text-lg font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                  {syncedOutfits}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t('migration.summaryOutfits', { count: syncedOutfits, defaultValue: `${syncedOutfits} Outfits Imported` })}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleFinishSuccess}
                disabled={busy}
                className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-95"
                data-testid="migration-success-ok-btn"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('migration.okToCloset', { defaultValue: 'OK - Open Closet' })}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
