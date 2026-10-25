import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingFloater } from '@/components/ShoppingFloater';
import {
  Search,
  Star,
  Globe,
  Sparkles,
  ArrowLeft,
  X,
  Ruler,
  ExternalLink,
  Info,
  Camera,
  Loader2,
} from 'lucide-react';

const CURATED_PLATFORMS = [
  // Fast Fashion (Frame-protected by major fashion retailers)
  {
    id: 'zara',
    name: 'Zara',
    category: 'fast_fashion',
    domain: 'zara.com',
    url: 'https://www.zara.com',
    appScheme: 'zara://',
    color: '#000000',
    logoText: 'ZARA',
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: false, // Allows iframe embedding with escape-hatch toolbar
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
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
    isFrameProtected: true,
  },
];

const DEFAULT_SAVED_IDS = ['zara', 'asos', 'hm', 'shein'];

function isUrlString(str) {
  if (!str) return false;
  const s = str.trim();
  return (
    /^https?:\/\//i.test(s) ||
    /^www\./i.test(s) ||
    /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(s)
  );
}

function normalizeUrl(str) {
  let s = str.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = 'https://' + s;
  }
  return s;
}

function isProductUrl(url) {
  return (
    /product|item|garment|\/p\/|\.html|\/pd\/|\/dp\/|detail/i.test(url) ||
    url.split('/').length > 4
  );
}

function getBrandFitTip(brandId, t) {
  const tips = {
    zara: t('shoppingHub.tips.zara', {
      defaultValue:
        'Zara tailoring is European slim cut. If between sizes on tops or blazers, consider sizing up.',
    }),
    shein: t('shoppingHub.tips.shein', {
      defaultValue:
        'SHEIN sizing varies by sub-brand. MOTF runs true-to-size, while Dazy runs very petite.',
    }),
    mango: t('shoppingHub.tips.mango', {
      defaultValue:
        'Mango runs true-to-size with clean European lines and structured silhouettes.',
    }),
    hm: t('shoppingHub.tips.hm', {
      defaultValue:
        'H&M basic tops run true-to-size; oversized lines are styled loose.',
    }),
    asos: t('shoppingHub.tips.asos', {
      defaultValue:
        'ASOS Design runs standard. Check dedicated filters for Tall, Petite, or Curve cuts.',
    }),
    nike: t('shoppingHub.tips.nike', {
      defaultValue:
        'Nike footwear runs approx. 0.5 size snug. Consider half a size up for running and basketball.',
    }),
    adidas: t('shoppingHub.tips.adidas', {
      defaultValue:
        'Adidas shoes and apparel run true to standard international sizing.',
    }),
    aliexpress: t('shoppingHub.tips.aliexpress', {
      defaultValue:
        'Asian sizing standard. Items typically run 1 to 2 sizes smaller than US/EU sizing.',
    }),
    uniqlo: t('shoppingHub.tips.uniqlo', {
      defaultValue:
        'Uniqlo cuts are relaxed and comfortable. True to standard Japanese/international sizing.',
    }),
  };
  return (
    tips[brandId] ||
    t('shoppingHub.tips.default', {
      defaultValue:
        'Standard international sizing matching your physical body measurements.',
    })
  );
}

function calculateBrandSizes(brandId, user) {
  const bm = user?.body_measurements || {};
  const sex = user?.sex || 'unisex';

  // 1. Tops / Shirts
  let topSize = bm.shirt_size || '';
  if (!topSize && bm.chest) {
    const c = parseFloat(bm.chest);
    if (sex === 'female') {
      if (c < 82) topSize = 'XS (34)';
      else if (c < 88) topSize = 'S (36)';
      else if (c < 94) topSize = 'M (38)';
      else if (c < 102) topSize = 'L (40)';
      else if (c < 110) topSize = 'XL (42)';
      else topSize = 'XXL (44)';
    } else {
      if (c < 90) topSize = 'XS (46)';
      else if (c < 96) topSize = 'S (48)';
      else if (c < 104) topSize = 'M (50)';
      else if (c < 112) topSize = 'L (52)';
      else if (c < 120) topSize = 'XL (54)';
      else topSize = 'XXL (56)';
    }
  }

  // 2. Bottoms / Pants
  let bottomSize = bm.pants_size || '';
  if (!bottomSize && bm.waist) {
    const w = parseFloat(bm.waist);
    if (sex === 'female') {
      if (w < 64) bottomSize = '32 (XXS)';
      else if (w < 68) bottomSize = '34 (XS)';
      else if (w < 74) bottomSize = '36 (S)';
      else if (w < 80) bottomSize = '38 (M)';
      else if (w < 86) bottomSize = '40 (L)';
      else if (w < 94) bottomSize = '42 (XL)';
      else bottomSize = '44 (XXL)';
    } else {
      if (w < 76) bottomSize = '28-29 (XS)';
      else if (w < 82) bottomSize = '30-31 (S)';
      else if (w < 88) bottomSize = '32-33 (M)';
      else if (w < 94) bottomSize = '34-35 (L)';
      else if (w < 100) bottomSize = '36-38 (XL)';
      else bottomSize = '40+ (XXL)';
    }
  }

  // 3. Shoes
  let shoeSize = bm.shoe_size || '';
  if (!shoeSize && bm.foot_length) {
    const fl = parseFloat(bm.foot_length);
    const eu = Math.round((fl + 1.5) * 1.5);
    shoeSize = `${eu} EU`;
  }

  const hasCustomMeasurements = Boolean(
    bm.chest ||
      bm.waist ||
      bm.foot_length ||
      bm.shirt_size ||
      bm.pants_size ||
      bm.shoe_size
  );

  return {
    topSize: topSize || 'M',
    bottomSize: bottomSize || '38',
    shoeSize: shoeSize || '41 EU',
    hasCustomMeasurements,
    chest: bm.chest,
    waist: bm.waist,
    hip: bm.hip,
    footLength: bm.foot_length,
  };
}

export default function ShoppingHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Saved / Pinned stores
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

  // Active in-app shopping state
  const [activeBrowserStore, setActiveBrowserStore] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [iframeError, setIframeError] = useState(false);
  const [forceIframe, setForceIframe] = useState(false);
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);

  // Garment URL analyzer state in Assisted Mode
  const [garmentUrl, setGarmentUrl] = useState('');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Launch store in In-App Shopping
  const launchStore = useCallback((store, overrideUrl = null) => {
    setActiveBrowserStore(store);
    const targetUrl = overrideUrl || store.url;
    setCurrentUrl(targetUrl);
    setIframeError(false);
    setForceIframe(false);
    setGarmentUrl('');
    setAnalysisResult(null);
  }, []);

  // Auto-launch if store query param present
  useEffect(() => {
    const storeParam = searchParams.get('store');
    if (storeParam) {
      const target = CURATED_PLATFORMS.find(
        (p) =>
          p.id === storeParam.toLowerCase() ||
          p.name.toLowerCase() === storeParam.toLowerCase()
      );
      if (target) {
        launchStore(target);
      }
    }
  }, [searchParams, launchStore]);

  // Analyze single garment URL via api.misc.analyzeUrl
  const analyzeProductLink = async (targetUrl) => {
    if (!targetUrl) return;
    setAnalyzingUrl(true);
    setAnalysisResult(null);
    try {
      const data = await api.misc.analyzeUrl({
        url: targetUrl,
        user_preferred_units: user?.profile?.preferred_units || 'cm',
      });
      setAnalysisResult(data);
      toast.success(
        t('shoppingHub.analysisSuccess', { defaultValue: 'Garment analyzed successfully!' })
      );
    } catch (err) {
      console.error('[ShoppingHub] analyzeUrl failed:', err);
      toast.error(
        t('shoppingHub.analysisFailed', {
          defaultValue:
            'Could not auto-fetch size chart for this link. You can upload a size chart screenshot.',
        })
      );
    } finally {
      setAnalyzingUrl(false);
    }
  };

  const handleGarmentUrlSubmit = (e) => {
    e?.preventDefault();
    if (garmentUrl.trim()) {
      analyzeProductLink(garmentUrl.trim());
    }
  };

  const handleAddressBarSubmit = () => {
    if (!currentUrl.trim()) return;
    const cleanUrl = normalizeUrl(currentUrl);
    setCurrentUrl(cleanUrl);

    if (isProductUrl(cleanUrl)) {
      setGarmentUrl(cleanUrl);
      analyzeProductLink(cleanUrl);
    }
  };

  // Directory search / URL submit
  const handleSearchOrUrlSubmit = (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    if (isUrlString(q)) {
      const fullUrl = normalizeUrl(q);
      try {
        const urlObj = new URL(fullUrl);
        const host = urlObj.hostname.replace(/^www\./, '').toLowerCase();

        // Check if matches curated store
        const matchedPlatform = CURATED_PLATFORMS.find(
          (p) => p.domain.toLowerCase() === host || host.includes(p.domain.toLowerCase())
        );

        if (matchedPlatform) {
          if (isProductUrl(fullUrl)) {
            setActiveBrowserStore(matchedPlatform);
            setGarmentUrl(fullUrl);
            setCurrentUrl(fullUrl);
            analyzeProductLink(fullUrl);
          } else {
            launchStore(matchedPlatform, fullUrl);
          }
          return;
        }

        // Custom URL
        const customStore = {
          id: 'custom_' + Date.now(),
          name: host,
          domain: host,
          url: fullUrl,
          color: '#0f172a',
          logoText: host.slice(0, 2).toUpperCase(),
          category: 'custom',
          isFrameProtected: false,
        };
        launchStore(customStore, fullUrl);
        return;
      } catch (err) {
        console.warn('URL parsing error:', err);
      }
    }

    // Exact name match
    const exactMatch = CURATED_PLATFORMS.find(
      (p) => p.name.toLowerCase() === q.toLowerCase()
    );
    if (exactMatch) {
      launchStore(exactMatch);
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

  // Active store brand sizing recommendations
  const brandSizes = useMemo(() => {
    if (!activeBrowserStore) return null;
    return calculateBrandSizes(activeBrowserStore.id, user);
  }, [activeBrowserStore, user]);

  // Determine if Assisted Mode applies (Frame protected or iframe load failure)
  const isAssistedMode = Boolean(
    activeBrowserStore &&
      ((activeBrowserStore.isFrameProtected && !forceIframe) || iframeError)
  );

  // ═════════════════════════════════════════════════════════════════
  // MODE 1: IN-APP SHOPPING BROWSER / ASSISTED SHOPPING MODE
  // ═════════════════════════════════════════════════════════════════
  if (activeBrowserStore) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
        {/* Responsive, Un-truncated Mobile Top Navigation Bar */}
        <div className="bg-slate-900 text-white px-2.5 sm:px-4 py-2 flex items-center justify-between shadow-md shrink-0 border-b border-slate-800 gap-1.5">
          {/* Left: Hub back button & Store identifier */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBrowserStore(null)}
              className="text-white/80 hover:text-white hover:bg-slate-800 h-9 px-2 shrink-0"
              title={t('common.close', { defaultValue: 'Exit Browser' })}
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span className="text-xs font-semibold ms-1 hidden xs:inline">
                {t('shoppingHub.hub', { defaultValue: 'Hub' })}
              </span>
            </Button>
            <div className="h-4 w-px bg-slate-700 mx-0.5" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-xs"
                style={{ backgroundColor: activeBrowserStore.color || '#0ea5e9' }}
              >
                {activeBrowserStore.logoText?.slice(0, 2) || 'S'}
              </span>
              <span className="font-bold text-xs truncate max-w-[70px] xs:max-w-[110px] sm:max-w-[180px]">
                {activeBrowserStore.name}
              </span>
            </div>
          </div>

          {/* Right: Actions with 44x44 pt minimum touch targets and shrink-0 Size Assistant */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Open in Tab - compact on mobile, full on sm */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(currentUrl || activeBrowserStore.url, '_blank', 'noopener,noreferrer')
              }
              className="text-amber-400 hover:text-amber-300 hover:bg-slate-800 h-9 w-9 sm:w-auto sm:px-2.5 p-0 flex items-center justify-center text-xs font-semibold rounded-lg"
              title={t('shoppingHub.openInBrowser', {
                defaultValue: 'Open in new tab to sign in or bypass pop-ups',
              })}
            >
              <ExternalLink className="w-4 h-4 sm:me-1.5 shrink-0" />
              <span className="hidden sm:inline">
                {t('shoppingHub.openFullSite', { defaultValue: 'Open in Tab' })}
              </span>
            </Button>

            {/* Size Assistant button - ALWAYS shrink-0, NEVER truncated! */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAssistantModalOpen(true)}
              className="shrink-0 bg-primary-brand text-white hover:bg-primary-hover h-9 px-2.5 sm:px-3 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">
                {t('shoppingHub.sizeGuide', { defaultValue: 'Size Assistant' })}
              </span>
            </Button>

            {/* Exit/Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBrowserStore(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 p-0 rounded-full shrink-0 flex items-center justify-center"
              title={t('common.close', { defaultValue: 'Close' })}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Interactive In-Browser Address Bar */}
        <div className="bg-slate-800 px-3 py-1.5 flex items-center gap-2 border-b border-slate-700 shrink-0">
          <div className="relative flex-1">
            <Globe className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              dir="ltr"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddressBarSubmit();
                }
              }}
              placeholder={t('shoppingHub.addressBarPlaceholder', {
                defaultValue: 'Enter or paste product URL...',
              })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg ps-8 pe-3 py-1.5 focus:outline-none focus:border-primary-brand"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddressBarSubmit}
            className="h-8 px-3 bg-primary-brand hover:bg-primary-hover text-white text-xs font-bold rounded-lg shrink-0"
          >
            {t('shoppingHub.go', { defaultValue: 'Go' })}
          </Button>
        </div>

        {/* Responsive Quick Notice Banner for Pop-ups, Promos & External Tabs */}
        {!isAssistedMode && (
          <div className="bg-amber-500/15 border-b border-amber-500/20 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 bg-amber-50 shrink-0">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span className="leading-snug">
                {activeBrowserStore.id === 'aliexpress'
                  ? t('shoppingHub.aliexpressNotice', {
                      defaultValue:
                        "AliExpress welcome pop-up blocking the screen? Tap 'Open in Clean Tab ↗' or use your Size Assistant button directly above!",
                    })
                  : t('shoppingHub.loginNotice', {
                      defaultValue:
                        "Need to sign in or encountering a pop-up? Tap 'Open in Tab' to shop directly with your saved store account.",
                    })}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                window.open(currentUrl || activeBrowserStore.url, '_blank', 'noopener,noreferrer')
              }
              className="font-bold underline hover:no-underline shrink-0 text-amber-800 flex items-center gap-1 self-end sm:self-center"
            >
              <span>
                {activeBrowserStore.id === 'aliexpress'
                  ? t('shoppingHub.openInCleanTab', { defaultValue: 'Open in Clean Tab ↗' })
                  : t('shoppingHub.openDirectTab', { defaultValue: 'Open in Tab ↗' })}
              </span>
            </button>
          </div>
        )}

        {/* CONTENT AREA: EITHER ASSISTED SHOPPING VIEW OR IN-APP FRAME */}
        {isAssistedMode ? (
          /* ═══════════════════════════════════════════════════════════════
             ASSISTED SHOPPING VIEW (For Frame-Protected Stores: Zara, Shein, Mango)
             ═══════════════════════════════════════════════════════════════ */
          <div className="flex-1 overflow-y-auto bg-sand/40 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Companion Mode Explanation Banner */}
              <div className="rounded-2xl bg-amber-500/15 border border-amber-500/25 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold leading-relaxed">
                    {t('shoppingHub.companionBanner', {
                      store: activeBrowserStore.name,
                      defaultValue: `Companion Mode: ${activeBrowserStore.name} shields direct in-frame browsing and mobile apps can't show web overlays. Keep DressApp open to check sizes anytime!`,
                    })}
                  </p>
                </div>
              </div>

              {/* Personalized Brand Sizing Card */}
              <Card className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-gradient-to-r from-primary-shadow/60 via-sand/40 to-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary-brand text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-dark-brand">
                        {t('shoppingHub.brandSizeGuide', {
                          store: activeBrowserStore.name,
                          defaultValue: `${activeBrowserStore.name} Personalized Size Guide`,
                        })}
                      </h3>
                      <span className="text-[11px] text-muted-foreground block">
                        {hasMeasurements
                          ? t('shoppingHub.basedOnMeasurements', {
                              defaultValue: 'Based on your saved profile measurements',
                            })
                          : t('shoppingHub.noMeasurementsSaved', {
                              defaultValue: 'Default estimates (add measurements in Profile)',
                            })}
                      </span>
                    </div>
                  </div>
                </div>

                <CardContent className="p-4 space-y-4">
                  {/* Recommended Sizes 3-Column Grid */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-xl border border-border/80 bg-sand/20 p-3 space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground block truncate">
                        {t('shoppingHub.topSize', { defaultValue: 'Top / Shirt' })}
                      </span>
                      <span className="text-base font-black text-primary-brand block">
                        {brandSizes?.topSize || 'M'}
                      </span>
                      {brandSizes?.chest && (
                        <span className="text-[10px] text-muted-foreground block">
                          {brandSizes.chest}cm
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/80 bg-sand/20 p-3 space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground block truncate">
                        {t('shoppingHub.bottomSize', { defaultValue: 'Bottoms / Pants' })}
                      </span>
                      <span className="text-base font-black text-primary-brand block">
                        {brandSizes?.bottomSize || '38'}
                      </span>
                      {brandSizes?.waist && (
                        <span className="text-[10px] text-muted-foreground block">
                          {brandSizes.waist}cm
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/80 bg-sand/20 p-3 space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground block truncate">
                        {t('shoppingHub.shoeSize', { defaultValue: 'Footwear' })}
                      </span>
                      <span className="text-base font-black text-primary-brand block">
                        {brandSizes?.shoeSize || '41 EU'}
                      </span>
                      {brandSizes?.footLength && (
                        <span className="text-[10px] text-muted-foreground block">
                          {brandSizes.footLength}cm
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Brand Fit Tip */}
                  <div className="rounded-xl bg-secondary/50 border border-border p-3 flex items-start gap-2 text-xs">
                    <Sparkles className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-dark-brand block mb-0.5">
                        {t('shoppingHub.fitTip', { defaultValue: 'Brand Fit Advice' })}
                      </span>
                      <p className="text-text-brand leading-relaxed">
                        {getBrandFitTip(activeBrowserStore.id, t)}
                      </p>
                    </div>
                  </div>

                  {/* 1-Tap Launch Button */}
                  <div className="pt-1">
                    <Button
                      size="lg"
                      onClick={() =>
                        window.open(activeBrowserStore.url, '_blank', 'noopener,noreferrer')
                      }
                      className="w-full bg-primary-brand hover:bg-primary-hover text-white text-xs font-bold h-11 rounded-xl shadow-xs flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>
                        {t('shoppingHub.openStoreWeb', {
                          store: activeBrowserStore.name,
                          defaultValue: `Open ${activeBrowserStore.name} in Browser ↗`,
                        })}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Instant Garment Link Sizing Checker */}
              <Card className="rounded-2xl border border-border bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-brand" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-dark-brand">
                    {t('shoppingHub.checkSpecificGarment', {
                      defaultValue: 'Check Specific Garment Fit',
                    })}
                  </h4>
                </div>

                <form onSubmit={handleGarmentUrlSubmit} className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      dir="ltr"
                      value={garmentUrl}
                      onChange={(e) => setGarmentUrl(e.target.value)}
                      placeholder={t('shoppingHub.pasteStoreLink', {
                        store: activeBrowserStore.name,
                        defaultValue: `Paste product link from ${activeBrowserStore.name}...`,
                      })}
                      className="h-10 text-xs bg-sand/30 border-border rounded-xl"
                    />
                    <Button
                      type="submit"
                      disabled={analyzingUrl || !garmentUrl.trim()}
                      className="h-10 px-4 bg-primary-brand hover:bg-primary-hover text-white text-xs font-bold rounded-xl shrink-0"
                    >
                      {analyzingUrl ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t('shoppingHub.analyzeGarment', { defaultValue: 'Check Size' })
                      )}
                    </Button>
                  </div>
                </form>

                {/* Analysis Result */}
                {analysisResult && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 truncate">
                        {analysisResult.product?.title ||
                          analysisResult.item?.name ||
                          activeBrowserStore.name}
                      </span>
                      <Badge className="bg-emerald-600 text-white font-bold text-xs">
                        {analysisResult.recommendation?.recommended_size ||
                          analysisResult.recommended_size ||
                          'Size M'}
                      </Badge>
                    </div>
                    {analysisResult.recommendation?.fit_summary && (
                      <p className="text-emerald-800 leading-relaxed">
                        {analysisResult.recommendation.fit_summary}
                      </p>
                    )}
                  </div>
                )}

                {/* Fallbacks */}
                <div className="pt-1 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/shopping-assistant')}
                    className="text-xs text-primary-brand hover:text-primary-hover p-0 h-auto font-semibold flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>
                      {t('shoppingHub.uploadScreenshot', {
                        defaultValue: 'Or upload size chart screenshot ↗',
                      })}
                    </span>
                  </Button>

                  {activeBrowserStore.isFrameProtected && (
                    <button
                      type="button"
                      onClick={() => setForceIframe(true)}
                      className="text-[11px] text-muted-foreground hover:text-dark-brand underline"
                    >
                      {t('shoppingHub.tryInAppFrame', {
                        defaultValue: 'Try in-app frame anyway',
                      })}
                    </button>
                  )}
                </div>
              </Card>
            </div>
            {/* Movable floater inside assisted view */}
            <ShoppingFloater onClick={() => setAssistantModalOpen(true)} />
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════
             IN-APP BROWSER (For Frameable Stores e.g. AliExpress or Custom URLs)
             ═══════════════════════════════════════════════════════════════ */
          <div className="flex-1 relative bg-sand/30 overflow-hidden">
            <iframe
              src={currentUrl || activeBrowserStore.url}
              title={activeBrowserStore.name}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation allow-downloads"
              onError={() => setIframeError(true)}
            />

            {/* Draggable tape measure floater over iframe */}
            <ShoppingFloater onClick={() => setAssistantModalOpen(true)} />
          </div>
        )}

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
                      {activeBrowserStore.name} {t('shoppingHub.sizeGuide', { defaultValue: 'Size Assistant' })}
                    </h4>
                    <span className="text-[11px] text-slate-300 block">
                      {hasMeasurements
                        ? `Chest: ${measurements.chest || '--'}cm · Waist: ${measurements.waist || '--'}cm`
                        : t('shoppingHub.noMeasurementsSaved', { defaultValue: 'No profile measurements saved' })}
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
                {/* Brand Sizes Card inside Modal */}
                {brandSizes && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-border bg-sand/30 p-2.5">
                      <span className="text-[10px] text-muted-foreground block">
                        {t('shoppingHub.topSize', { defaultValue: 'Top / Shirt' })}
                      </span>
                      <span className="text-sm font-black text-primary-brand block">
                        {brandSizes.topSize}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-sand/30 p-2.5">
                      <span className="text-[10px] text-muted-foreground block">
                        {t('shoppingHub.bottomSize', { defaultValue: 'Bottoms / Pants' })}
                      </span>
                      <span className="text-sm font-black text-primary-brand block">
                        {brandSizes.bottomSize}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-sand/30 p-2.5">
                      <span className="text-[10px] text-muted-foreground block">
                        {t('shoppingHub.shoeSize', { defaultValue: 'Footwear' })}
                      </span>
                      <span className="text-sm font-black text-primary-brand block">
                        {brandSizes.shoeSize}
                      </span>
                    </div>
                  </div>
                )}

                <div className="rounded-xl p-3 bg-secondary/50 border border-border text-xs text-dark-brand space-y-1">
                  <span className="font-bold block text-primary-brand">
                    {t('shoppingHub.howToMatch', { defaultValue: 'How to Get Your Size:' })}
                  </span>
                  <p className="text-text-brand leading-relaxed">
                    {t('shoppingHub.howToMatchDesc', {
                      defaultValue:
                        '1. Browse any garment in this store.\n2. Tap the tape roller floater or share the link.\n3. DressApp matches the brand size chart against your physical measurements!',
                    })}
                  </p>
                </div>

                <form onSubmit={handleGarmentUrlSubmit} className="space-y-2">
                  <label className="text-xs font-semibold text-dark-brand block">
                    {t('shoppingHub.checkGarmentUrl', {
                      defaultValue: 'Check a Specific Garment:',
                    })}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      dir="ltr"
                      value={garmentUrl}
                      onChange={(e) => setGarmentUrl(e.target.value)}
                      placeholder={t('shoppingHub.pasteStoreLink', {
                        store: activeBrowserStore.name,
                        defaultValue: `Paste product link from ${activeBrowserStore.name}...`,
                      })}
                      className="h-10 text-xs bg-sand/30 border-border rounded-xl"
                    />
                    <Button
                      type="submit"
                      disabled={analyzingUrl || !garmentUrl.trim()}
                      className="h-10 px-4 bg-primary-brand hover:bg-primary-hover text-white text-xs font-bold rounded-xl shrink-0"
                    >
                      {analyzingUrl ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t('shoppingHub.analyzeGarment', { defaultValue: 'Check Size' })
                      )}
                    </Button>
                  </div>
                </form>

                {analysisResult && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 truncate">
                        {analysisResult.product?.title ||
                          analysisResult.item?.name ||
                          activeBrowserStore.name}
                      </span>
                      <Badge className="bg-emerald-600 text-white font-bold text-xs">
                        {analysisResult.recommendation?.recommended_size ||
                          analysisResult.recommended_size ||
                          'Size M'}
                      </Badge>
                    </div>
                    {(analysisResult.recommendation?.reasoning ||
                      analysisResult.recommendation?.fit_summary) && (
                      <p className="text-emerald-800 leading-relaxed">
                        {analysisResult.recommendation.reasoning ||
                          analysisResult.recommendation.fit_summary}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setAssistantModalOpen(false);
                    navigate('/shopping-assistant');
                  }}
                  className="w-full border-border text-dark-brand hover:bg-secondary text-xs font-semibold h-10 rounded-xl"
                >
                  <Camera className="w-4 h-4 me-1.5 text-primary-brand" />
                  {t('shoppingHub.launchUrlChecker', {
                    defaultValue: 'Open Size Chart Image Scanner',
                  })}
                </Button>
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
    <div
      className="min-h-screen bg-sand pb-16 pt-4 px-4 sm:px-6 max-w-4xl mx-auto"
      data-testid="shopping-hub-container"
    >
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
          <Badge
            variant="outline"
            className="bg-white/80 border-border text-xs gap-1.5 py-1 hover:bg-secondary"
          >
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
              <h1 className="font-bold text-lg text-dark-brand leading-tight" dir="auto">
                {t('shoppingHub.title', { defaultValue: 'DressApp Shopping Hub' })}
              </h1>
              <p className="text-xs text-text-brand mt-1" dir="auto">
                {t('shoppingHub.subtitle', {
                  defaultValue:
                    'Shop your favorite fashion platforms with real-time size recommendations matching your body measurements.',
                })}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-5 space-y-5">
          {/* Active Search & URL Form with Go Button */}
          <form onSubmit={handleSearchOrUrlSubmit} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                dir="auto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('shoppingHub.searchPlaceholder', {
                  defaultValue:
                    'Search Zara, ASOS, H&M, or paste any store / product URL...',
                })}
                className="ps-10 pe-10 h-11 bg-sand/30 border-border text-xs rounded-xl text-start"
                data-testid="shopping-hub-search"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-dark-brand p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              className="h-11 px-4 bg-primary-brand hover:bg-primary-hover text-white text-xs font-bold rounded-xl shrink-0"
              data-testid="shopping-hub-go-btn"
            >
              {isUrlString(query)
                ? t('shoppingHub.open', { defaultValue: 'Open' })
                : t('common.search', { defaultValue: 'Search' })}
            </Button>
          </form>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* SAVED PLATFORMS SECTION (Cashback.co.il style)                */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h3
                  className="font-bold text-xs uppercase tracking-wider text-dark-brand"
                  dir="auto"
                >
                  {t('shoppingHub.savedPlatforms', { defaultValue: 'Saved Platforms' })}
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground" dir="auto">
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
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {store.domain}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => launchStore(store)}
                      className="flex-1 bg-primary-brand hover:bg-primary-hover text-white text-[11px] font-semibold h-7 rounded-lg shadow-xs"
                    >
                      <Sparkles className="w-3 h-3 me-1" />
                      {t('shoppingHub.shop', { defaultValue: 'Shop' })}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(store.url, '_blank', 'noopener,noreferrer')}
                      className="h-7 px-2 border-border text-[11px] text-muted-foreground hover:text-dark-brand"
                      title={t('shoppingHub.openExternal', { defaultValue: 'Open in new tab' })}
                    >
                      <ExternalLink className="w-3 h-3" />
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
            {
              id: 'fast_fashion',
              label: t('shoppingHub.catFastFashion', { defaultValue: 'Fast Fashion' }),
            },
            {
              id: 'marketplaces',
              label: t('shoppingHub.catMarketplaces', { defaultValue: 'Marketplaces' }),
            },
            {
              id: 'contemporary',
              label: t('shoppingHub.catContemporary', {
                defaultValue: 'Contemporary & Luxury',
              }),
            },
            {
              id: 'sportswear',
              label: t('shoppingHub.catSportswear', { defaultValue: 'Sportswear' }),
            },
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
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-border text-muted-foreground uppercase font-semibold"
                        dir="auto"
                      >
                        {store.category === 'fast_fashion'
                          ? t('shoppingHub.catFastFashion', { defaultValue: 'Fast Fashion' })
                          : store.category === 'marketplaces'
                          ? t('shoppingHub.catMarketplaces', { defaultValue: 'Marketplaces' })
                          : store.category === 'contemporary'
                          ? t('shoppingHub.catContemporary', {
                              defaultValue: 'Contemporary & Luxury',
                            })
                          : store.category === 'sportswear'
                          ? t('shoppingHub.catSportswear', { defaultValue: 'Sportswear' })
                          : store.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <span
                      className="text-xs text-text-brand block truncate mt-0.5"
                      dir="ltr"
                    >
                      {store.domain}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleSaveStore(store.id)}
                    className="p-2 text-muted-foreground hover:text-amber-500 rounded-lg hover:bg-secondary transition-colors"
                    title={
                      isSaved
                        ? t('shoppingHub.unpin', { defaultValue: 'Remove from saved' })
                        : t('shoppingHub.pin', { defaultValue: 'Save platform' })
                    }
                  >
                    <Star
                      className={`w-4 h-4 ${isSaved ? 'text-amber-500 fill-amber-500' : ''}`}
                    />
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(store.url, '_blank', 'noopener,noreferrer')}
                    className="h-8 px-2.5 border-border text-xs text-muted-foreground hover:text-dark-brand"
                    title={t('shoppingHub.openExternal', { defaultValue: 'Open in new tab' })}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
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
                {t('shoppingHub.customStoreTitle', {
                  defaultValue: 'Shop on Custom Platform',
                })}
              </h4>
              <p className="text-xs text-text-brand mt-1">
                {t('shoppingHub.customStoreDesc', {
                  defaultValue:
                    'Open any website with the DressApp Sizing Assistant active.',
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
                    isFrameProtected: false,
                  })
                }
                className="bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-9 px-4"
              >
                <Sparkles className="w-3.5 h-3.5 me-1.5" />
                {t('shoppingHub.launchCustom', {
                  defaultValue: 'Launch Assistant on This Store',
                })}
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
