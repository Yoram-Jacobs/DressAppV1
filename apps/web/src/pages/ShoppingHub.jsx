import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingFloater } from '@/components/ShoppingFloater';
import {
  Search,
  Star,
  Smartphone,
  Globe,
  Sparkles,
  ArrowLeft,
  X,
  ShieldCheck,
  Ruler,
  Lock,
} from 'lucide-react';

const CURATED_PLATFORMS = [
  // Fast Fashion
  {
    id: 'zara',
    name: 'Zara',
    category: 'fast_fashion',
    domain: 'zara.com',
    url: 'https://www.zara.com',
    appScheme: 'zara://',
    color: '#000000',
    logoText: 'ZARA',
  },
  {
    id: 'hm',
    name: 'H&M',
    category: 'fast_fashion',
    domain: 'hm.com',
    url: 'https://www2.hm.com',
    appScheme: 'hm://',
    color: '#e50010',
    logoText: 'H&M',
  },
  {
    id: 'mango',
    name: 'Mango',
    category: 'fast_fashion',
    domain: 'mango.com',
    url: 'https://shop.mango.com',
    appScheme: 'mango://',
    color: '#111111',
    logoText: 'MANGO',
  },
  {
    id: 'pullandbear',
    name: 'Pull & Bear',
    category: 'fast_fashion',
    domain: 'pullandbear.com',
    url: 'https://www.pullandbear.com',
    appScheme: 'pullandbear://',
    color: '#1e293b',
    logoText: 'P&B',
  },
  {
    id: 'bershka',
    name: 'Bershka',
    category: 'fast_fashion',
    domain: 'bershka.com',
    url: 'https://www.bershka.com',
    appScheme: 'bershka://',
    color: '#0f172a',
    logoText: 'BSK',
  },
  {
    id: 'stradivarius',
    name: 'Stradivarius',
    category: 'fast_fashion',
    domain: 'stradivarius.com',
    url: 'https://www.stradivarius.com',
    appScheme: 'stradivarius://',
    color: '#2d3748',
    logoText: 'STR',
  },

  // Marketplaces
  {
    id: 'asos',
    name: 'ASOS',
    category: 'marketplaces',
    domain: 'asos.com',
    url: 'https://www.asos.com',
    appScheme: 'asos://',
    color: '#2d2d2d',
    logoText: 'asos',
  },
  {
    id: 'shein',
    name: 'SHEIN',
    category: 'marketplaces',
    domain: 'shein.com',
    url: 'https://www.shein.com',
    appScheme: 'shein://',
    color: '#000000',
    logoText: 'SHEIN',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress',
    category: 'marketplaces',
    domain: 'aliexpress.com',
    url: 'https://www.aliexpress.com',
    appScheme: 'aliexpress://',
    color: '#e62e04',
    logoText: 'Ali',
  },
  {
    id: 'amazon_fashion',
    name: 'Amazon Fashion',
    category: 'marketplaces',
    domain: 'amazon.com',
    url: 'https://www.amazon.com/fashion',
    appScheme: 'amazon://',
    color: '#ff9900',
    logoText: 'AMZN',
  },
  {
    id: 'zalando',
    name: 'Zalando',
    category: 'marketplaces',
    domain: 'zalando.com',
    url: 'https://www.zalando.com',
    appScheme: 'zalando://',
    color: '#ff6900',
    logoText: 'ZAL',
  },

  // Contemporary & Luxury
  {
    id: 'cos',
    name: 'COS',
    category: 'contemporary',
    domain: 'cos.com',
    url: 'https://www.cos.com',
    appScheme: 'cos://',
    color: '#1a202c',
    logoText: 'COS',
  },
  {
    id: 'massimodutti',
    name: 'Massimo Dutti',
    category: 'contemporary',
    domain: 'massimodutti.com',
    url: 'https://www.massimodutti.com',
    appScheme: 'massimodutti://',
    color: '#1e293b',
    logoText: 'MD',
  },
  {
    id: 'farfetch',
    name: 'Farfetch',
    category: 'contemporary',
    domain: 'farfetch.com',
    url: 'https://www.farfetch.com',
    appScheme: 'farfetch://',
    color: '#000000',
    logoText: 'FF',
  },
  {
    id: 'aritzia',
    name: 'Aritzia',
    category: 'contemporary',
    domain: 'aritzia.com',
    url: 'https://www.aritzia.com',
    appScheme: 'aritzia://',
    color: '#334155',
    logoText: 'ARZ',
  },
  {
    id: 'nordstrom',
    name: 'Nordstrom',
    category: 'contemporary',
    domain: 'nordstrom.com',
    url: 'https://www.nordstrom.com',
    appScheme: 'nordstrom://',
    color: '#0f172a',
    logoText: 'ND',
  },

  // Sportswear & Streetwear
  {
    id: 'nike',
    name: 'Nike',
    category: 'sportswear',
    domain: 'nike.com',
    url: 'https://www.nike.com',
    appScheme: 'nike://',
    color: '#111827',
    logoText: 'NIKE',
  },
  {
    id: 'adidas',
    name: 'Adidas',
    category: 'sportswear',
    domain: 'adidas.com',
    url: 'https://www.adidas.com',
    appScheme: 'adidas://',
    color: '#000000',
    logoText: 'ADI',
  },
  {
    id: 'uniqlo',
    name: 'Uniqlo',
    category: 'sportswear',
    domain: 'uniqlo.com',
    url: 'https://www.uniqlo.com',
    appScheme: 'uniqlo://',
    color: '#ef4444',
    logoText: 'UQ',
  },
  {
    id: 'urbanoutfitters',
    name: 'Urban Outfitters',
    category: 'sportswear',
    domain: 'urbanoutfitters.com',
    url: 'https://www.urbanoutfitters.com',
    appScheme: 'urbanoutfitters://',
    color: '#3b82f6',
    logoText: 'UO',
  },
];

const DEFAULT_SAVED_IDS = ['zara', 'asos', 'hm', 'shein'];

export default function ShoppingHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Saved / Pinned stores (like Cashback.co.il)
  const [savedStoreIds, setSavedStoreIds] = useState(() => {
    try {
      const raw = localStorage.getItem('dressapp.saved_shopping_stores');
      return raw ? JSON.parse(raw) : DEFAULT_SAVED_IDS;
    } catch {
      return DEFAULT_SAVED_IDS;
    }
  });

  const toggleSaveStore = (storeId) => {
    setSavedStoreIds((prev) => {
      const next = prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId];
      try {
        localStorage.setItem('dressapp.saved_shopping_stores', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // In-App Shopping Browser state
  const [activeBrowserStore, setActiveBrowserStore] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);

  // Auto-launch if store query param present
  useEffect(() => {
    const storeParam = searchParams.get('store');
    if (storeParam) {
      const target = CURATED_PLATFORMS.find(
        (p) => p.id === storeParam.toLowerCase() || p.name.toLowerCase() === storeParam.toLowerCase()
      );
      if (target) {
        launchStore(target);
      }
    }
  }, [searchParams]);

  // Launch store in In-App Shopping Browser
  const launchStore = (store) => {
    setActiveBrowserStore(store);
    setIframeError(false);
  };

  // Launch store in native app / external browser
  const launchNativeApp = (store) => {
    if (store.appScheme) {
      window.location.href = store.appScheme;
      setTimeout(() => {
        // Fallback to web link if native app doesn't open
        window.open(store.url, '_blank', 'noopener,noreferrer');
      }, 1200);
    } else {
      window.open(store.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Filtered platforms
  const filteredPlatforms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURATED_PLATFORMS.filter((p) => {
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [query, selectedCategory]);

  // Saved stores resolved objects
  const savedStores = useMemo(() => {
    return savedStoreIds
      .map((id) => CURATED_PLATFORMS.find((p) => p.id === id))
      .filter(Boolean);
  }, [savedStoreIds]);

  const measurements = user?.body_measurements || {};
  const hasMeasurements = Object.keys(measurements).length > 0;

  // ═════════════════════════════════════════════════════════════════
  // MODE 1: IN-APP SHOPPING BROWSER (When a store is launched)
  // ═════════════════════════════════════════════════════════════════
  if (activeBrowserStore) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
        {/* Browser Top Navigation Bar */}
        <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between shadow-md shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBrowserStore(null)}
              className="text-white/80 hover:text-white hover:bg-slate-800 h-8 px-2"
              title={t('common.close', { defaultValue: 'Exit Browser' })}
            >
              <ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />
              <span className="text-xs font-semibold">{t('shoppingHub.hub', { defaultValue: 'Hub' })}</span>
            </Button>
            <div className="h-4 w-px bg-slate-700 mx-1" />
            <div className="flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0"
                style={{ backgroundColor: activeBrowserStore.color || '#0ea5e9' }}
              >
                {activeBrowserStore.logoText?.slice(0, 2) || 'S'}
              </span>
              <span className="font-bold text-xs truncate max-w-[120px] sm:max-w-[200px]">
                {activeBrowserStore.name}
              </span>
            </div>
          </div>

          {/* Secure URL Badge */}
          <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span className="truncate max-w-[220px]">{activeBrowserStore.domain}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => launchNativeApp(activeBrowserStore)}
              className="text-sky-400 hover:text-sky-300 hover:bg-slate-800 h-8 px-2 text-xs"
              title={t('shoppingHub.openInApp', { defaultValue: 'Open in Store App' })}
            >
              <Smartphone className="w-3.5 h-3.5 me-1" />
              <span className="hidden md:inline">{t('shoppingHub.storeApp', { defaultValue: 'Store App' })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAssistantModalOpen(true)}
              className="bg-primary-brand text-white hover:bg-primary-hover h-8 px-2.5 text-xs font-semibold rounded-lg ms-1"
            >
              <Sparkles className="w-3.5 h-3.5 me-1" />
              <span>{t('shoppingHub.sizeGuide', { defaultValue: 'Size Assistant' })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBrowserStore(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0 ms-1 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Embedded Web View */}
        <div className="flex-1 relative bg-sand/30 overflow-hidden">
          {!iframeError ? (
            <iframe
              src={activeBrowserStore.url}
              title={activeBrowserStore.name}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onError={() => setIframeError(true)}
            />
          ) : null}

          {/* Anti-Frame Fallback Card (when store policy headers block embedding) */}
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-sand/80 backdrop-blur-xs">
              <Card className="max-w-md w-full rounded-2xl border border-border bg-white shadow-xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-dark-brand">
                    {t('shoppingHub.frameProtectedTitle', {
                      store: activeBrowserStore.name,
                      defaultValue: `${activeBrowserStore.name} shields direct in-frame browsing`,
                    })}
                  </h3>
                  <p className="text-xs text-text-brand mt-1.5 leading-relaxed">
                    {t('shoppingHub.frameProtectedDesc', {
                      defaultValue: 'Major retailers protect checkout frames. You can launch their native app or browser with 1 tap, and check your size with the DressApp Assistant!',
                    })}
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    onClick={() => launchNativeApp(activeBrowserStore)}
                    className="w-full bg-primary-brand hover:bg-primary-hover text-white font-semibold text-xs h-10 shadow-xs"
                  >
                    <Smartphone className="w-4 h-4 me-1.5" />
                    {t('shoppingHub.openStoreDirect', {
                      store: activeBrowserStore.name,
                      defaultValue: `Open ${activeBrowserStore.name} App / Web`,
                    })}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/shopping-assistant')}
                    className="w-full border-border text-xs h-10 font-medium"
                  >
                    <Sparkles className="w-4 h-4 me-1.5 text-primary-brand" />
                    {t('shoppingHub.pasteProductLink', { defaultValue: 'Check Any Garment Link' })}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* The Movable / Draggable Shopping Assistant Floater */}
          <ShoppingFloater onClick={() => setAssistantModalOpen(true)} />
        </div>

        {/* Assistant Bottom Sheet / Modal */}
        {assistantModalOpen && (
          <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <Card className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-border bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {activeBrowserStore.name} Size Assistant
                    </h4>
                    <span className="text-[11px] text-slate-300 block">
                      {hasMeasurements
                        ? `Chest: ${measurements.chest || '--'}cm · Waist: ${measurements.waist || '--'}cm`
                        : 'No profile measurements saved'}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAssistantModalOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-slate-700 h-8 w-8 p-0 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="rounded-xl p-3 bg-secondary/50 border border-border text-xs text-dark-brand space-y-1">
                  <span className="font-bold block text-primary-brand">
                    {t('shoppingHub.howToMatch', { defaultValue: 'How to Get Your Size:' })}
                  </span>
                  <p className="text-text-brand leading-relaxed">
                    {t('shoppingHub.howToMatchDesc', {
                      defaultValue: '1. Browse any garment in this store.\n2. Tap the tape roller floater or share the link.\n3. DressApp matches the brand size chart against your physical measurements!',
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-dark-brand block">
                    {t('shoppingHub.checkGarmentUrl', { defaultValue: 'Have a specific garment link?' })}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setAssistantModalOpen(false);
                        navigate('/shopping-assistant');
                      }}
                      className="w-full bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-10"
                    >
                      <Sparkles className="w-4 h-4 me-1.5" />
                      {t('shoppingHub.launchUrlChecker', { defaultValue: 'Open Full Size Scanner' })}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // MODE 2: MAIN SHOPPING HUB (Platforms Directory & Saved Stores)
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-sand pb-16 pt-4 px-4 sm:px-6 max-w-4xl mx-auto" data-testid="shopping-hub-container">
      {/* Header Banner */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-text-brand hover:text-dark-brand -ms-2"
        >
          <ArrowLeft className="w-4 h-4 me-1.5 rtl:rotate-180" />
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
        <Link to="/me">
          <Badge variant="outline" className="bg-white/80 border-border text-xs gap-1.5 py-1 hover:bg-secondary">
            <Ruler className="w-3.5 h-3.5 text-primary-brand" />
            <span>
              {hasMeasurements
                ? t('shoppingHub.measurementsReady', { defaultValue: 'Measurements Active' })
                : t('shoppingHub.addMeasurements', { defaultValue: 'Add Measurements' })}
            </span>
          </Badge>
        </Link>
      </div>

      {/* Hero Card */}
      <Card className="rounded-[16px] border border-border bg-white shadow-sm overflow-hidden mb-6">
        <div className="p-5 bg-gradient-to-r from-primary-shadow/60 via-sand/40 to-white border-b border-border">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-primary-brand text-white flex items-center justify-center shrink-0 shadow-sm">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-dark-brand leading-tight">
                {t('shoppingHub.title', { defaultValue: 'DressApp Shopping Hub' })}
              </h1>
              <p className="text-xs text-text-brand mt-1">
                {t('shoppingHub.subtitle', {
                  defaultValue: 'Shop your favorite fashion platforms with real-time size recommendations matching your body measurements.',
                })}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-5 space-y-5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('shoppingHub.searchPlaceholder', {
                defaultValue: 'Search Zara, ASOS, H&M, SHEIN, Nike, or enter any store URL...',
              })}
              className="ps-10 pe-10 h-11 bg-sand/30 border-border text-xs rounded-xl"
              data-testid="shopping-hub-search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-dark-brand p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* SAVED PLATFORMS SECTION (Cashback.co.il style)                */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-dark-brand">
                  {t('shoppingHub.savedPlatforms', { defaultValue: 'Saved Platforms' })}
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {savedStores.length} {t('shoppingHub.pinned', { defaultValue: 'pinned' })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {savedStores.map((store) => (
                <div
                  key={store.id}
                  className="rounded-xl border border-border bg-white p-3 shadow-xs hover:shadow-md hover:border-primary-brand/40 transition-all group flex flex-col justify-between"
                  data-testid={`saved-store-${store.id}`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-xs"
                      style={{ backgroundColor: store.color || '#0ea5e9' }}
                    >
                      {store.logoText || store.name.slice(0, 2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleSaveStore(store.id)}
                      className="text-amber-500 hover:text-amber-600 p-1"
                      title={t('shoppingHub.unpin', { defaultValue: 'Unpin' })}
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <h4 className="font-bold text-xs text-dark-brand truncate">{store.name}</h4>
                    <span className="text-[10px] text-muted-foreground block truncate">{store.domain}</span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => launchStore(store)}
                      className="w-full bg-primary-brand hover:bg-primary-hover text-white text-[11px] font-semibold h-7 rounded-lg shadow-xs"
                    >
                      <Sparkles className="w-3 h-3 me-1" />
                      {t('shoppingHub.shop', { defaultValue: 'Shop' })}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* DIRECTORY & CATEGORIES                                        */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: t('shoppingHub.catAll', { defaultValue: 'All Stores' }) },
            { id: 'fast_fashion', label: t('shoppingHub.catFastFashion', { defaultValue: 'Fast Fashion' }) },
            { id: 'marketplaces', label: t('shoppingHub.catMarketplaces', { defaultValue: 'Marketplaces' }) },
            { id: 'contemporary', label: t('shoppingHub.catContemporary', { defaultValue: 'Contemporary & Luxury' }) },
            { id: 'sportswear', label: t('shoppingHub.catSportswear', { defaultValue: 'Sportswear' }) },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                selectedCategory === cat.id
                  ? 'bg-primary-brand text-white border-primary-brand shadow-xs'
                  : 'bg-white text-dark-brand border-border hover:bg-secondary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Store Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredPlatforms.map((store) => {
            const isSaved = savedStoreIds.includes(store.id);
            return (
              <div
                key={store.id}
                className="rounded-xl border border-border bg-white p-4 shadow-xs hover:shadow-md hover:border-primary-brand/30 transition-all flex items-center justify-between gap-3"
                data-testid={`platform-card-${store.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: store.color || '#0ea5e9' }}
                  >
                    {store.logoText || store.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm text-dark-brand truncate">{store.name}</h4>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground uppercase font-semibold">
                        {store.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <span className="text-xs text-text-brand block truncate mt-0.5">{store.domain}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleSaveStore(store.id)}
                    className="p-2 text-muted-foreground hover:text-amber-500 rounded-lg hover:bg-secondary transition-colors"
                    title={isSaved ? 'Remove from saved' : 'Save platform'}
                  >
                    <Star className={`w-4 h-4 ${isSaved ? 'text-amber-500 fill-amber-500' : ''}`} />
                  </button>

                  <Button
                    size="sm"
                    onClick={() => launchStore(store)}
                    className="bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-8 px-3 rounded-lg shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 me-1" />
                    {t('shoppingHub.launch', { defaultValue: 'Launch' })}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom URL Card if no exact matches or user typed a search */}
        {query && filteredPlatforms.length === 0 && (
          <Card className="rounded-xl border border-border bg-white p-5 text-center space-y-3">
            <Globe className="w-8 h-8 text-primary-brand mx-auto opacity-80" />
            <div>
              <h4 className="font-bold text-sm text-dark-brand">
                {t('shoppingHub.customStoreTitle', { defaultValue: 'Shop on Custom Platform' })}
              </h4>
              <p className="text-xs text-text-brand mt-1">
                {t('shoppingHub.customStoreDesc', {
                  defaultValue: 'Open any website with the DressApp Sizing Assistant active.',
                })}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() =>
                  launchStore({
                    id: 'custom_' + Date.now(),
                    name: query,
                    domain: query.replace(/^https?:\/\//, '').split('/')[0],
                    url: query.startsWith('http') ? query : `https://${query}`,
                    color: '#0f172a',
                    logoText: query.slice(0, 2).toUpperCase(),
                    category: 'custom',
                  })
                }
                className="bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-9 px-4"
              >
                <Sparkles className="w-3.5 h-3.5 me-1.5" />
                {t('shoppingHub.launchCustom', { defaultValue: 'Launch Assistant on This Store' })}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Floating Measurement Tape Roller for quick size check anywhere */}
      <ShoppingFloater onClick={() => navigate('/shopping-assistant')} />
    </div>
  );
}
