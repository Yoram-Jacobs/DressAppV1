import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Footprints,
  Layers,
  Palette,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Shirt,
  ShoppingBag,
  Sliders,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { closetStore } from '@/lib/closetStore';
import { useAuth } from '@/lib/auth';
import { userStore } from '@/lib/api';
import { resolveEffectiveGarmentUrl } from '@/lib/itemImage';
import DressingRoomCanvas from './DressingRoomCanvas';
import useDressingRoomStore, {
  preloadDressingRoomAsset,
  resolveDefaultTemplateGlbForSlot,
  SLOT_DEFAULT_LAYERS,
  STARTER_GARMENT_CATALOG,
} from './useDressingRoomStore';

const EMPTY_CLOSET_SNAPSHOT = Object.freeze({ items: [] });
const subscribeCloset = (cb) =>
  typeof closetStore?.subscribe === 'function' ? closetStore.subscribe(cb) : () => {};
const getClosetSnapshot = () =>
  typeof closetStore?.getSnapshot === 'function'
    ? closetStore.getSnapshot()
    : EMPTY_CLOSET_SNAPSHOT;

function mapClosetCategoryToSlot(item) {
  const cat = String(
    item?.category || item?.sub_category || item?.subcategory || item?.item_type || ''
  ).toLowerCase();
  if (/(?:shoe|boot|sneaker|heel|loafer|sandal|footwear|נעל|מגפ|סניקר)/.test(cat)) {
    return 'shoes';
  }
  if (/(?:outerwear|jacket|blazer|coat|cardigan|trench|ז׳קט|ג׳קט|מעיל|בלייזר)/.test(cat)) {
    return 'outerwear';
  }
  if (/(?:bottom|pant|trouser|jean|chino|short|skirt|מכנס|ג׳ינס|חצאית|שורט)/.test(cat)) {
    return 'bottom';
  }
  if (/(?:accessor|belt|watch|bag|hat|scarf|tie|glass|חגור|שעון|תיק|כובע|צעיף)/.test(cat)) {
    return 'accessories';
  }
  return 'top';
}

/**
 * Signature Boutique 3D Dressing Room View (`DressingRoomView`)
 *
 * Restores DressApp's signature boutique studio view:
 *  - Full-bleed 3D viewport with alabaster dais, gold rim ring, and soft floor cyclorama
 *  - Floating top-left 360° interaction & drag hint pill
 *  - Floating top-right collapsible Outfit Layers drawer (thumbnails, slot names, eye toggles)
 *  - Floating bottom pill toolbar: Full Body, Upper Body, Lower Body, Side view, Back view,
 *    3D Tailored / Photo Fit, Garment Only / Show Avatar, 360° Rotate turnaround, and Reset View
 *  - Floating collapsible Wardrobe Rack & Body Morphs panel (preserving all data-testid attributes)
 */
export function DressingRoomView({
  initialOutfit = null,
  profile: propProfile = null,
  className = '',
}) {
  const { t } = useTranslation();
  const { user } = useAuth?.() || {};
  const closetSnap = useSyncExternalStore(
    subscribeCloset,
    getClosetSnapshot,
    () => EMPTY_CLOSET_SNAPSHOT
  );

  const avatarGender = useDressingRoomStore((s) => s.avatarGender);
  const bodyMetrics = useDressingRoomStore((s) => s.bodyMetrics);
  const activeOutfit = useDressingRoomStore((s) => s.activeOutfit);
  const cameraPreset = useDressingRoomStore((s) => s.cameraPreset);

  const setAvatarGender = useDressingRoomStore((s) => s.setAvatarGender);
  const updateBodyMetric = useDressingRoomStore((s) => s.updateBodyMetric);
  const resetBodyMetrics = useDressingRoomStore((s) => s.resetBodyMetrics);
  const hydrateFromProfile = useDressingRoomStore((s) => s.hydrateFromProfile);
  const toggleGarmentSlot = useDressingRoomStore((s) => s.toggleGarmentSlot);
  const unslotGarment = useDressingRoomStore((s) => s.unslotGarment);
  const swapGarmentTexture = useDressingRoomStore((s) => s.swapGarmentTexture);
  const clearOutfit = useDressingRoomStore((s) => s.clearOutfit);
  const setCameraPreset = useDressingRoomStore((s) => s.setCameraPreset);
  const syncFromAppOutfit = useDressingRoomStore((s) => s.syncFromAppOutfit);

  const [slotFilter, setSlotFilter] = useState('all');
  const [autoRotate, setAutoRotate] = useState(false);
  const [meshMode, setMeshMode] = useState('photo');
  const [showAvatar, setShowAvatar] = useState(true);
  const [showLayersDrawer, setShowLayersDrawer] = useState(true);
  const [showControlDrawer, setShowControlDrawer] = useState(true);
  const [activeTab, setActiveTab] = useState('rack'); // 'rack' | 'morphs'
  const [hiddenSlots, setHiddenSlots] = useState({});

  const effectiveProfile = useMemo(() => {
    return propProfile || user || userStore?.get?.() || null;
  }, [propProfile, user]);

  useEffect(() => {
    if (effectiveProfile) {
      hydrateFromProfile(effectiveProfile);
    }
    if (initialOutfit && typeof initialOutfit === 'object') {
      syncFromAppOutfit(initialOutfit, effectiveProfile?.gender);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rackItems = useMemo(() => {
    const starterList = STARTER_GARMENT_CATALOG[avatarGender] || STARTER_GARMENT_CATALOG.female;
    const userClosetItems = Array.isArray(closetSnap?.items) ? closetSnap.items : [];

    const mappedCloset = userClosetItems
      .slice(0, 18)
      .map((raw) => {
        const texUrl =
          resolveEffectiveGarmentUrl(raw) || raw?.clean_image_url || raw?.image_url || raw?.url;
        if (!texUrl) return null;
        const slot = mapClosetCategoryToSlot(raw);
        return {
          id: String(raw.id || raw._id),
          slot,
          name: raw.name || raw.title || raw.sub_category || slot,
          glbUrl: resolveDefaultTemplateGlbForSlot(slot, avatarGender, raw),
          textureUrl: texUrl,
          altTextureUrls: Array.isArray(raw.view_urls) ? raw.view_urls : [],
          layer: SLOT_DEFAULT_LAYERS[slot] ?? 1,
        };
      })
      .filter(Boolean);

    return [...mappedCloset, ...starterList];
  }, [avatarGender, closetSnap]);

  useEffect(() => {
    rackItems.slice(0, 8).forEach((item) => {
      preloadDressingRoomAsset(item.glbUrl);
    });
  }, [rackItems]);

  const filteredRackItems = useMemo(() => {
    if (slotFilter === 'all') return rackItems;
    return rackItems.filter((it) => it.slot === slotFilter);
  }, [rackItems, slotFilter]);

  const isItemSlotted = (item) => {
    if (!item) return false;
    if (item.slot === 'accessories') {
      return (activeOutfit.accessories || []).some((acc) => acc.id === item.id);
    }
    return activeOutfit[item.slot]?.id === item.id;
  };

  const activeCount = useMemo(() => {
    let count = 0;
    if (activeOutfit.top) count += 1;
    if (activeOutfit.bottom) count += 1;
    if (activeOutfit.outerwear) count += 1;
    if (activeOutfit.shoes) count += 1;
    count += (activeOutfit.accessories || []).length;
    return count;
  }, [activeOutfit]);

  const slottedGarmentList = useMemo(() => {
    const list = [];
    if (activeOutfit.top) list.push({ ...activeOutfit.top, slot: 'top' });
    if (activeOutfit.bottom) list.push({ ...activeOutfit.bottom, slot: 'bottom' });
    if (activeOutfit.outerwear) list.push({ ...activeOutfit.outerwear, slot: 'outerwear' });
    if (activeOutfit.shoes) list.push({ ...activeOutfit.shoes, slot: 'shoes' });
    (activeOutfit.accessories || []).forEach((acc, i) => {
      list.push({ ...acc, slot: `accessory-${i}` });
    });
    return list;
  }, [activeOutfit]);

  const toggleSlotVisibility = (slotKey) => {
    setHiddenSlots((prev) => ({
      ...prev,
      [slotKey]: !prev[slotKey],
    }));
  };

  const metricSliders = useMemo(
    () => [
      {
        key: 'chest_circ',
        label: t('dressing_room_3d.metric_chest_circ', { defaultValue: 'Chest Circumference' }),
      },
      {
        key: 'waist_circ',
        label: t('dressing_room_3d.metric_waist_circ', { defaultValue: 'Waist Circumference' }),
      },
      {
        key: 'hip_circ',
        label: t('dressing_room_3d.metric_hip_circ', { defaultValue: 'Hip Circumference' }),
      },
      {
        key: 'inseam',
        label: t('dressing_room_3d.metric_inseam', { defaultValue: 'Inseam Length' }),
      },
    ],
    [t]
  );

  const slotTabs = useMemo(
    () => [
      { id: 'all', label: t('dressing_room_3d.filter_all', { defaultValue: 'All' }) },
      { id: 'top', label: t('dressing_room_3d.slots.top', { defaultValue: 'Top' }) },
      { id: 'bottom', label: t('dressing_room_3d.slots.bottom', { defaultValue: 'Bottom' }) },
      { id: 'outerwear', label: t('dressing_room_3d.slots.outerwear', { defaultValue: 'Outerwear' }) },
      { id: 'shoes', label: t('dressing_room_3d.slots.shoes', { defaultValue: 'Shoes' }) },
      { id: 'accessories', label: t('dressing_room_3d.slots.accessory', { defaultValue: 'Accessories' }) },
    ],
    [t]
  );

  const handleResetCamera = () => {
    setAutoRotate(false);
    setCameraPreset('full');
  };

  return (
    <div
      className={`relative w-full h-[calc(100vh-2rem)] min-h-[640px] bg-[#FAF7F2] text-[#1C2024] rounded-2xl overflow-hidden border border-[#E5DFD5] shadow-2xl select-none ${className}`}
      style={{ position: 'relative', width: '100%', height: 'calc(100vh - 2rem)', minHeight: 640 }}
      data-testid="dressing-room-view"
    >
      {/* ─── Full-Bleed 3D Viewport ─── */}
      <div className="absolute inset-0 w-full h-full">
        <DressingRoomCanvas
          autoRotate={autoRotate}
          onUserInteraction={() => setAutoRotate(false)}
        />
      </div>

      {/* ─── Floating Top-Left 360° Drag & Interaction Hint ─── */}
      <div className="absolute top-4 start-4 z-20 flex items-center gap-2 pointer-events-none">
        <span className="text-[11px] font-medium text-[#4B5563] bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#E5DFD5] shadow-sm flex items-center gap-1.5">
          <RotateCw className="w-3.5 h-3.5 text-amber-600" />
          {t('dressing_room_3d.drag_hint', { defaultValue: 'Drag to rotate 360° • Scroll / pinch to zoom' })}
        </span>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#E5DFD5] shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-[#1F2937]">
            {t('dressing_room_3d.title', { defaultValue: '3D Try-On Studio' })}
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200"
          >
            {t('dressing_room_3d.r3f_badge', { defaultValue: 'R3F Live Morph' })}
          </Badge>
        </div>
      </div>

      {/* ─── Floating Top-Left Drawer Toggle Bar ─── */}
      <div className="absolute top-14 start-4 z-20 flex items-center gap-1.5 pointer-events-auto">
        <Button
          type="button"
          size="sm"
          variant={showControlDrawer && activeTab === 'rack' ? 'default' : 'secondary'}
          onClick={() => {
            if (showControlDrawer && activeTab === 'rack') {
              setShowControlDrawer(false);
            } else {
              setShowControlDrawer(true);
              setActiveTab('rack');
            }
          }}
          className={`h-8 text-xs font-semibold rounded-xl px-3 flex items-center gap-1.5 shadow-sm transition-all ${
            showControlDrawer && activeTab === 'rack'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white/90 text-[#374151] hover:bg-[#F5F2EB] border border-[#E5DFD5]'
          }`}
          data-testid="toggle-rack-tab-btn"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{t('dressing_room_3d.garment_rack', { defaultValue: 'Garment Rack' })}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#F3EFE8] text-[#4B5563]">
            {rackItems.length}
          </Badge>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={showControlDrawer && activeTab === 'morphs' ? 'default' : 'secondary'}
          onClick={() => {
            if (showControlDrawer && activeTab === 'morphs') {
              setShowControlDrawer(false);
            } else {
              setShowControlDrawer(true);
              setActiveTab('morphs');
            }
          }}
          className={`h-8 text-xs font-semibold rounded-xl px-3 flex items-center gap-1.5 shadow-sm transition-all ${
            showControlDrawer && activeTab === 'morphs'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white/90 text-[#374151] hover:bg-[#F5F2EB] border border-[#E5DFD5]'
          }`}
          data-testid="toggle-morphs-tab-btn"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{t('dressing_room_3d.body_morphs', { defaultValue: 'Adjust Fit' })}</span>
        </Button>
      </div>

      {/* ─── Floating Left Control Drawer (Rack & Morphs) ─── */}
      {showControlDrawer && (
        <aside
          className="absolute top-24 start-4 z-20 w-72 sm:w-80 max-h-[calc(100vh-160px)] flex flex-col bg-white/92 backdrop-blur-md rounded-2xl border border-[#E5DFD5] shadow-xl overflow-hidden transition-all pointer-events-auto"
          data-testid="dressing-room-sidebar"
        >
          {/* Header with Tab switcher */}
          <div className="flex items-center justify-between p-2.5 border-b border-[#EAE3D6] bg-white/60">
            <div className="flex items-center gap-1 bg-[#F5F2EB] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('rack')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'rack'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{t('dressing_room_3d.garment_rack', { defaultValue: 'Rack' })}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('morphs')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'morphs'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{t('dressing_room_3d.body_morphs', { defaultValue: 'Fit & Morphs' })}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowControlDrawer(false)}
              className="p-1 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F2EB] transition-colors"
              aria-label="Close drawer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* TAB 1: GARMENT RACK */}
          <div className={activeTab === 'rack' ? 'p-3 flex-1 flex flex-col gap-2.5 overflow-hidden' : 'hidden'}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#6B7280]">
                  {t('dressing_room_3d.select_item_hint', { defaultValue: 'Tap garment to try on / remove' })}
                </span>
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearOutfit}
                    data-testid="clear-outfit-btn"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('dressing_room_3d.clear_all', { defaultValue: 'Clear' })}</span>
                  </button>
                )}
              </div>

              {/* Slot Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {slotTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSlotFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider shrink-0 transition-all ${
                      slotFilter === tab.id
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-[#F5F2EB] text-[#4B5563] hover:text-[#111827]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Rack Items List */}
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pe-1 scrollbar-thin scrollbar-thumb-[#D8D0C5]">
                {filteredRackItems.map((item) => {
                  const slotted = isItemSlotted(item);
                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        slotted
                          ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                          : 'bg-[#FAF8F5] border-[#E8E1D5] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-white border border-[#E5DFD5] flex items-center justify-center overflow-hidden shrink-0">
                            {item.textureUrl ? (
                              <img
                                src={item.textureUrl}
                                alt={item.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Shirt className="w-5 h-5 text-[#9CA3AF]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate leading-tight text-[#1F2937]">
                              {item.name}
                            </p>
                            <span className="text-[9px] uppercase tracking-wider text-amber-700 font-medium">
                              {item.slot} • Layer {item.layer}
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant={slotted ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => toggleGarmentSlot(item)}
                          data-testid={`slot-action-${item.id}`}
                          className={`h-7 px-2.5 text-[11px] rounded-lg font-semibold shrink-0 transition-all ${
                            slotted
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          {slotted
                            ? t('dressing_room_3d.remove_slot', { defaultValue: 'Remove' })
                            : t('dressing_room_3d.wear_slot', { defaultValue: 'Wear' })}
                        </Button>
                      </div>

                      {/* Swatch color / alternate textures */}
                      {slotted && Array.isArray(item.altTextureUrls) && item.altTextureUrls.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1 border-t border-[#EAE3D6]/70">
                          <Palette className="w-3 h-3 text-[#6B7280] shrink-0" />
                          <span className="text-[10px] text-[#6B7280]">Swatches:</span>
                          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                            {item.altTextureUrls.map((texUrl, idx) => (
                              <button
                                key={`${item.id}-tex-${idx}`}
                                type="button"
                                onClick={() => swapGarmentTexture(item.slot, texUrl)}
                                data-testid={`swap-texture-${item.id}-${idx}`}
                                className="w-5 h-5 rounded-md border border-[#DDD5C7] overflow-hidden shrink-0 hover:scale-110 transition-transform"
                                title={`Swatch ${idx + 1}`}
                              >
                                <img src={texUrl} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          {/* TAB 2: MORPHS & FIT */}
          <div className={activeTab === 'morphs' ? 'p-3 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[50vh]' : 'hidden'}>
              {/* Gender selector */}
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE3D6]">
                <div className="flex items-center gap-1.5 bg-[#EFEAE0] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAvatarGender('female')}
                    data-testid="gender-female-btn"
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      avatarGender === 'female'
                        ? 'bg-white text-[#111827] shadow-sm'
                        : 'text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    {t('dressing_room_3d.gender_female', { defaultValue: 'Female' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarGender('male')}
                    data-testid="gender-male-btn"
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      avatarGender === 'male'
                        ? 'bg-white text-[#111827] shadow-sm'
                        : 'text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    {t('dressing_room_3d.gender_male', { defaultValue: 'Male' })}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetBodyMetrics}
                  data-testid="reset-body-metrics-btn"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280] hover:text-[#111827]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('dressing_room_3d.reset_metrics', { defaultValue: 'Reset' })}</span>
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-2.5">
                {metricSliders.map(({ key, label }) => {
                  const val = Number(bodyMetrics?.[key] ?? 0.5);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label
                          htmlFor={`morph-slider-${key}`}
                          className="font-medium text-[#374151]"
                        >
                          {label}
                        </label>
                        <span
                          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#EFEAE0] text-[#1F2937]"
                          data-testid={`morph-value-${key}`}
                        >
                          {val.toFixed(2)}
                        </span>
                      </div>
                      <input
                        id={`morph-slider-${key}`}
                        data-testid={`morph-slider-${key}`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={val}
                        onChange={(e) => updateBodyMetric(key, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#E5DFD5] rounded-lg appearance-none cursor-pointer accent-amber-600"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
        </aside>
      )}

      {/* ─── Floating Top-Right Outfit Layers Drawer ─── */}
      <aside
        className={`absolute top-4 end-4 z-20 transition-all duration-300 flex flex-col pointer-events-auto ${
          showLayersDrawer ? 'w-64 sm:w-72 max-h-[calc(100%-100px)]' : 'w-auto'
        }`}
      >
        <div className="bg-white/92 backdrop-blur-md rounded-2xl border border-[#E5DFD5] shadow-xl p-3 flex flex-col gap-2.5 overflow-hidden">
          <div className="flex items-center justify-between pb-1 border-b border-[#EAE3D6]">
            <button
              type="button"
              onClick={() => setShowLayersDrawer((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-bold text-[#1F2937] hover:text-amber-700 transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-amber-600" />
              {showLayersDrawer && (
                <>
                  <span>{t('dressing_room_3d.garments', { defaultValue: 'Outfit Layers' })}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-[#F3EFE8] text-[#4B5563] border-[#E5DFD5]"
                    data-testid="active-slot-count"
                  >
                    {activeCount}
                  </Badge>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowLayersDrawer((prev) => !prev)}
              className="p-1 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F5F2EB] transition-colors"
              aria-label={t('dressing_room_3d.garments', { defaultValue: 'Outfit Layers' })}
            >
              {showLayersDrawer ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {showLayersDrawer && (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[46vh] pe-1 scrollbar-thin scrollbar-thumb-[#D8D0C5]">
              {slottedGarmentList.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#9CA3AF]">
                  {t('dressing_room_3d.no_active_garments', { defaultValue: 'No garments currently worn.' })}
                </div>
              ) : (
                slottedGarmentList.map((g) => {
                  const isVisible = !hiddenSlots[g.slot];
                  return (
                    <div
                      key={`rack-${g.slot}-${g.id}`}
                      className={`group flex items-center justify-between p-2 rounded-xl transition-all border select-none ${
                        isVisible
                          ? 'bg-[#FAF8F5] border-[#E8E1D5] text-[#1F2937]'
                          : 'bg-[#F5F2EB]/50 border-[#E8E1D5]/40 text-[#9CA3AF] opacity-60'
                      }`}
                      data-testid={`rack-item-${g.slot}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-white border border-[#E5DFD5] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                          {g.textureUrl ? (
                            <img
                              src={g.textureUrl}
                              alt={g.name || g.slot}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Shirt className="w-4 h-4 text-[#9CA3AF]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold truncate leading-tight">
                            {g.name || g.slot}
                          </p>
                          <span className="text-[9px] uppercase tracking-wider text-amber-700 font-medium">
                            {g.slot} • L{g.layer}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleSlotVisibility(g.slot)}
                          className="h-7 w-7 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#EFEAE0]"
                          title={isVisible ? 'Hide layer' : 'Show layer'}
                        >
                          {isVisible ? (
                            <Eye className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => unslotGarment(g.slot)}
                          className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          title="Remove item"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ─── Floating Bottom Camera Toolbar (Signature DressApp Creamy Design) ─── */}
      <div className="absolute bottom-3 sm:bottom-5 inset-x-0 z-20 flex justify-center pointer-events-none px-2 sm:px-4">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 p-1.5 px-2 bg-white/92 backdrop-blur-md rounded-2xl border border-[#E5DFD5] shadow-xl max-w-[calc(100vw-1rem)] sm:max-w-none overflow-x-auto scrollbar-none">
          {/* Full Body */}
          <Button
            variant={cameraPreset === 'full' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setAutoRotate(false);
              setCameraPreset('full');
            }}
            data-testid="camera-preset-full"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              cameraPreset === 'full'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.full_body', { defaultValue: 'Full Body' })}</span>
          </Button>

          {/* Upper Body / Front */}
          <Button
            variant={cameraPreset === 'front' || cameraPreset === 'upper' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setAutoRotate(false);
              setCameraPreset('front');
            }}
            data-testid="camera-preset-front"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              cameraPreset === 'front' || cameraPreset === 'upper'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}
          >
            <Shirt className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.upper_body', { defaultValue: 'Upper Body' })}</span>
          </Button>

          {/* Lower Body / Footwear */}
          <Button
            variant={cameraPreset === 'shoes' || cameraPreset === 'lower' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setAutoRotate(false);
              setCameraPreset('shoes');
            }}
            data-testid="camera-preset-shoes"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              cameraPreset === 'shoes' || cameraPreset === 'lower'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.camera_footwear', { defaultValue: 'Footwear' })}
          >
            <Footprints className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.camera_footwear', { defaultValue: 'Footwear' })}</span>
          </Button>

          {/* Face / Close-up */}
          <Button
            variant={cameraPreset === 'close_up' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setAutoRotate(false);
              setCameraPreset('close_up');
            }}
            data-testid="camera-preset-close_up"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              cameraPreset === 'close_up'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.camera_face', { defaultValue: 'Face' })}
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.camera_face', { defaultValue: 'Face' })}</span>
          </Button>

          {/* Side view */}
          <Button
            variant={cameraPreset === 'side' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setAutoRotate(false);
              setCameraPreset('side');
            }}
            data-testid="camera-side-btn"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              cameraPreset === 'side'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.side_view', { defaultValue: 'Side view' })}
          >
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.side_view', { defaultValue: 'Side view' })}</span>
          </Button>

          {/* Back view */}
          <Button
            variant={cameraPreset === 'back' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setAutoRotate(false);
              setCameraPreset('back');
            }}
            data-testid="camera-back-btn"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              cameraPreset === 'back'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.back_view', { defaultValue: 'Back view' })}
          >
            <RotateCw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.back_view', { defaultValue: 'Back view' })}</span>
          </Button>

          <div className="h-4 w-px bg-[#E5DFD5] mx-1 shrink-0" />

          {/* Toggle Photo Cutout vs 3D Tailored Mesh */}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setMeshMode((prev) => (prev === 'photo' ? 'tailored' : 'photo'))}
            data-testid="toggle-mesh-mode-btn"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              meshMode === 'tailored'
                ? 'bg-amber-700 hover:bg-amber-800 text-white shadow-md'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
            }`}
            title={
              meshMode === 'tailored'
                ? '3D Tailored Active. Click for Photo Cutout.'
                : 'Photo Cutout Active. Click for 3D Tailored.'
            }
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {meshMode === 'tailored'
                ? t('dressing_room_3d.mesh_tailored', { defaultValue: '3D Tailored' })
                : t('dressing_room_3d.mesh_photo', { defaultValue: 'Photo Fit' })}
            </span>
          </Button>

          <div className="h-4 w-px bg-[#E5DFD5] mx-1 shrink-0" />

          {/* Toggle Avatar / Garment-Only view */}
          <Button
            type="button"
            variant={!showAvatar ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowAvatar((prev) => !prev)}
            data-testid="toggle-avatar-btn"
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              !showAvatar
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={showAvatar ? 'View Garment Only' : 'Show Avatar'}
          >
            <User className={`w-3.5 h-3.5 shrink-0 ${!showAvatar ? 'opacity-80' : 'text-amber-600'}`} />
            <span className="hidden sm:inline">
              {showAvatar
                ? t('dressing_room_3d.garment_only', { defaultValue: 'Garment Only' })
                : t('dressing_room_3d.show_avatar', { defaultValue: 'Show Avatar' })}
            </span>
          </Button>

          <div className="h-4 w-px bg-[#E5DFD5] mx-1 shrink-0" />

          {/* 360° Auto-Rotate */}
          <Button
            variant={autoRotate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`text-xs font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 h-8 flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all ${
              autoRotate
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-[#374151] hover:text-[#111827] hover:bg-[#F5F2EB]'
            }`}
            title={t('dressing_room_3d.auto_rotate', { defaultValue: '360° Rotate' })}
          >
            <RotateCw className={`w-3.5 h-3.5 shrink-0 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('dressing_room_3d.auto_rotate', { defaultValue: '360° Rotate' })}</span>
          </Button>

          {/* Reset View */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetCamera}
            className="text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:bg-[#F5F2EB] rounded-xl px-2.5 py-1.5 h-8 flex items-center gap-1 shrink-0 whitespace-nowrap"
            title={t('dressing_room_3d.reset_view', { defaultValue: 'Reset View' })}
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
            <span className="hidden sm:inline">{t('dressing_room_3d.reset_view', { defaultValue: 'Reset' })}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DressingRoomView;
