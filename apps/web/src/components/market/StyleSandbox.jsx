import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClosetStore } from '@/lib/useClosetStore';
import { useAuth } from '@/lib/auth';
import { api, outfits as outfitsApi } from '@/lib/api';
import { prewarmOutfits } from '@/lib/useOutfitStore';
import { bestImageUrl } from '@/lib/itemImage';
import { checkListingFit } from '@/lib/fitCompatibility';
import {
  ImageOff,
  Sparkles,
  Check,
  Loader2,
  ArrowLeft,
  BookmarkPlus,
  Palette,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import AvatarViewer from '@/components/AvatarViewer';
import { HarmonyBadge } from '@/components/stylist/HarmonyBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const normCat = (cat) => {
  const s = String(cat || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (
    [
      'top', 'tops', 'shirt', 'shirts', 't_shirt', 'tshirt', 'tshirts',
      'polo', 'sweater', 'sweaters', 'blouse', 'blouses', 'hoodie',
      'tank', 'tank_top', 'tanktop', 'crop_top', 'sweatshirt',
      'cardigan', 'knitwear', 'topwear',
    ].includes(s)
  ) return 'top';
  if (
    [
      'bottom', 'bottoms', 'pants', 'shorts', 'jeans', 'skirt', 'skirts',
      'trousers', 'joggers', 'leggings', 'sweatpants', 'chinos', 'slacks',
      'bottomwear',
    ].includes(s)
  ) return 'bottom';
  if (
    [
      'footwear', 'shoes', 'shoe', 'sneakers', 'sneaker', 'boots', 'boot',
      'sandals', 'sandal', 'heels', 'heel', 'loafers', 'loafer', 'slides',
      'slippers', 'flats',
    ].includes(s)
  ) return 'shoes';
  if (
    [
      'dress', 'dresses', 'jumpsuit', 'jumpsuits', 'suit', 'suits', 'overall',
      'overalls', 'full_body', 'full_body_suit', 'romper', 'gown',
    ].includes(s)
  ) return 'dress';
  if (
    [
      'outerwear', 'jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers',
      'parka', 'overcoat', 'vest',
    ].includes(s)
  ) return 'outerwear';
  if (
    [
      'hat', 'hats', 'cap', 'caps', 'beanie', 'headwear',
    ].includes(s)
  ) return 'headwear';
  return 'accessory';
};

export default function StyleSandbox({ isOpen, onClose, listingItem }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const store = useClosetStore();
  const items = store.items || [];

  const fitCheck = useMemo(() => checkListingFit(listingItem, user, t), [listingItem, user, t]);

  // Categorize local wardrobe items
  const localTops = items.filter(
    (it) => it.category === 'Top' || it.category === 'Outerwear' || it.category === 'Full Body',
  );
  const localBottoms = items.filter((it) => it.category === 'Bottom');
  const localShoes = items.filter((it) => it.category === 'Footwear');

  // Selected sandbox styling combination (manual picks)
  const [selectedTop, setSelectedTop] = useState(null);
  const [selectedBottom, setSelectedBottom] = useState(null);
  const [selectedShoe, setSelectedShoe] = useState(null);

  // View mode: 'sandbox' | 'results'
  const [viewMode, setViewMode] = useState('sandbox');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [outfits, setOutfits] = useState([]);
  const [activeLookIndex, setActiveLookIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLooks, setSavedLooks] = useState(() => new Set());

  // Reset state when opening modal with a new listing item
  useEffect(() => {
    if (isOpen) {
      setViewMode('sandbox');
      setLoading(false);
      setResult(null);
      setOutfits([]);
      setActiveLookIndex(0);
      setSelectedTop(null);
      setSelectedBottom(null);
      setSelectedShoe(null);
      setSavedLooks(new Set());
    }
  }, [isOpen, listingItem?.id]);

  // Auto-fill listing item if category matches
  const listingCategory = listingItem?.category;
  const isListingTop =
    listingCategory === 'Top' ||
    listingCategory === 'Outerwear' ||
    listingCategory === 'Full Body';
  const isListingBottom = listingCategory === 'Bottom';
  const isListingShoe = listingCategory === 'Footwear';

  // Helper to render local item items
  const renderItemSelectorGrid = (list, selected, setSelected) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-8 text-text-brand text-xs border border-dashed border-border rounded-[12px] bg-secondary/10">
          <ImageOff className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
          <span>{t('sandbox.noItemsInCategory', { defaultValue: 'No items in this category.' })}</span>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pe-1">
        {list.map((it) => {
          const isSelected = selected?.id === it.id;
          const imgUrl = bestImageUrl(it);
          return (
            <div
              key={it.id}
              onClick={() => setSelected(isSelected ? null : it)}
              className={`p-2 rounded-[12px] border cursor-pointer flex items-center gap-2 transition-all select-none ${
                isSelected
                  ? 'border-primary-brand bg-primary-shadow'
                  : 'border-border bg-white'
              }`}
            >
              <div className="h-10 w-10 shrink-0 bg-accent-beige rounded-full overflow-hidden flex items-center justify-center border border-border">
                {imgUrl ? (
                  <img src={imgUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImageOff className="h-4 w-4 text-text-brand" />
                )}
              </div>
              <span className="text-[12px] truncate font-semibold text-dark-brand">
                {it.name || it.title || 'Garment'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Trigger Complete The Look pipeline
  const handleCompleteTheLook = async () => {
    setLoading(true);
    try {
      const selectedIds = [selectedTop?.id, selectedBottom?.id, selectedShoe?.id].filter(
        Boolean,
      );
      const data = await api.completeOutfit({
        listingId: listingItem?.id,
        itemIds: selectedIds,
        limit: 3,
      });

      setResult(data);
      const recs = data?.outfit_recommendations || data?.recommendations || [];
      if (recs.length > 0) {
        setOutfits(recs.slice(0, 3));
        setActiveLookIndex(0);
        setViewMode('results');
      } else {
        toast.info(
          t('sandbox.noOutfitsFound', {
            defaultValue: 'Could not generate complete looks. Try selecting other items.',
          }),
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          err?.message ||
          t('common.error', { defaultValue: 'Failed to style outfit.' }),
      );
    } finally {
      setLoading(false);
    }
  };

  // Active outfit recommendation
  const currentLook = outfits[activeLookIndex] || null;

  // Resolve pieces for the active recommendation
  const resolvedItemsList = useMemo(() => {
    if (!currentLook) return [];
    const list = [];
    const seenIds = new Set();

    // 1. Marketplace listing item
    if (listingItem) {
      seenIds.add(listingItem.id);
      list.push({
        id: listingItem.id,
        title: listingItem.title || listingItem.name || 'Marketplace Item',
        role: normCat(listingItem.category),
        category: listingItem.category,
        image_url: bestImageUrl(listingItem),
        is_listing: true,
        price: listingItem.price,
      });
    }

    // 2. Closet items recommended in look
    (currentLook.items || []).forEach((it) => {
      const cid = it.closet_item_id || it.id;
      if (
        it.is_listing ||
        (listingItem && (cid === listingItem.id || it.title === listingItem.title))
      ) {
        return;
      }
      if (cid && seenIds.has(cid)) return;
      if (cid) seenIds.add(cid);

      const ci = items.find((x) => x.id === cid);
      list.push({
        id: cid,
        title: it.title || it.name || it.description || ci?.title || ci?.name || 'Garment',
        role: normCat(it.role || it.category || ci?.category),
        category: ci?.category || it.role,
        image_url: it.image_url || (ci ? bestImageUrl(ci) : null),
        is_listing: false,
      });
    });

    return list;
  }, [currentLook, items, listingItem]);

  // Construct outfit pieces map for AvatarViewer2D
  const currentLookPiecesMap = useMemo(() => {
    if (!currentLook) return {};
    const map = {};

    // Map items from look
    (currentLook.items || []).forEach((it) => {
      const slot = normCat(it.role || it.category);
      const ci = items.find((x) => x.id === it.closet_item_id);
      const img = it.is_listing
        ? bestImageUrl(listingItem) || it.image_url
        : it.image_url || (ci ? bestImageUrl(ci) : null);

      map[slot] = {
        id: it.closet_item_id || it.id || (it.is_listing ? listingItem?.id : null),
        url: img,
        title: it.title || it.name || it.description,
        is_listing: !!it.is_listing,
        role: slot,
      };
    });

    // Ensure the marketplace listingItem is definitely rendered in its slot
    if (listingItem) {
      const listingSlot = normCat(listingItem.category);
      if (!map[listingSlot] || !map[listingSlot].is_listing) {
        map[listingSlot] = {
          id: listingItem.id,
          url: bestImageUrl(listingItem),
          title: listingItem.title || listingItem.name,
          is_listing: true,
          role: listingSlot,
        };
      }
    }

    return map;
  }, [currentLook, items, listingItem]);

  // Extract colors for HarmonyBadge & Color Palette
  const lookColors = useMemo(() => {
    if (!currentLook) return [];
    const res = [];
    if (Array.isArray(currentLook.color_palette) && currentLook.color_palette.length > 0) {
      currentLook.color_palette.forEach((c) => {
        if (c && typeof c === 'string') {
          res.push({ name: c });
        }
      });
    }
    resolvedItemsList.forEach((it) => {
      const ci = items.find((x) => x.id === it.id);
      const colName =
        ci?.color ||
        (Array.isArray(ci?.colors) && ci.colors[0]?.name) ||
        (it.is_listing ? listingItem?.color : null);
      if (colName && !res.some((r) => r.name.toLowerCase() === colName.toLowerCase())) {
        res.push({ name: colName });
      }
    });
    return res;
  }, [currentLook, resolvedItemsList, items, listingItem]);

  // Handle saving the current outfit
  const handleSaveOutfit = async (look) => {
    if (!look) return;
    setIsSaving(true);
    try {
      const garmentsToSave = resolvedItemsList.map((it) => ({
        closet_item_id: it.is_listing ? null : it.id,
        role: it.role || 'item',
        title: it.title,
        image_url: it.image_url || null,
      }));

      const payload = {
        name: look.name || `Look: ${listingItem?.title || 'Market Style'}`,
        description:
          look.why ||
          result?.rationale ||
          t('sandbox.matchingOutfitsDesc', {
            defaultValue: 'AI-curated look incorporating marketplace listing with wardrobe.',
          }),
        source_workflow: 'complete_outfit',
        garments: garmentsToSave,
        usage: {
          date: new Date().toISOString().split('T')[0],
          time: '12:00',
          event_name: look.name || 'Complete The Look',
        },
      };

      const saveFn = api.saveOutfit || outfitsApi?.saveOutfit;
      if (!saveFn) throw new Error('Save outfit API unavailable');
      await saveFn(payload);

      setSavedLooks((prev) => new Set([...prev, look.name || activeLookIndex]));
      prewarmOutfits({ force: true }).catch(() => {});
      toast.success(
        t('sandbox.outfitSavedSuccess', {
          defaultValue: 'Outfit saved to your closet!',
        }),
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          err?.message ||
          t('common.error', { defaultValue: 'Failed to save outfit.' }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isCurrentLookSaved =
    currentLook && (savedLooks.has(currentLook.name) || savedLooks.has(activeLookIndex));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'rounded-[20px] bg-white border border-border overflow-y-auto max-h-[90vh] transition-all duration-200',
          viewMode === 'results' ? '!max-w-2xl lg:!max-w-3xl' : '!max-w-xl',
        )}
      >
        {viewMode === 'sandbox' ? (
          <div>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-dark-brand">
                {t('sandbox.title', { defaultValue: 'Style Sandbox' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-text-brand">
                {t('sandbox.description', {
                  defaultValue:
                    'Mix & match this listing with your closet items to verify style compatibility before buying.',
                })}
              </DialogDescription>
            </DialogHeader>

            {fitCheck.hasMismatch && (
              <div
                className="mt-3 rounded-[12px] border border-amber-300 bg-amber-50/90 dark:bg-amber-950/25 dark:border-amber-800 p-2.5 text-amber-900 dark:text-amber-200 text-xs"
                data-testid="sandbox-fit-warning-banner"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {t('market.fitCheck.bannerTitle', { defaultValue: 'Fit & Proportions Notice' })}: {fitCheck.title}
                    </span>
                    <span className="text-[11.5px] opacity-90 leading-tight block mt-0.5">
                      {fitCheck.reasoning}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              {/* Closet Selection Panel */}
              <div className="flex flex-col justify-between">
                <Tabs defaultValue={isListingTop ? 'bottoms' : 'tops'} className="w-full flex-1">
                  <TabsList className="grid grid-cols-3 w-full bg-accent-beige p-0.5 h-10 rounded-[12px] mb-3 text-dark-brand">
                    <TabsTrigger
                      value="tops"
                      disabled={isListingTop}
                      className="text-[10px] font-semibold"
                    >
                      {t('taxonomy.role.top', { defaultValue: 'Tops' })}
                    </TabsTrigger>
                    <TabsTrigger
                      value="bottoms"
                      disabled={isListingBottom}
                      className="text-[10px] font-semibold"
                    >
                      {t('taxonomy.role.bottom', { defaultValue: 'Bottoms' })}
                    </TabsTrigger>
                    <TabsTrigger
                      value="shoes"
                      disabled={isListingShoe}
                      className="text-[10px] font-semibold"
                    >
                      {t('taxonomy.role.shoes', { defaultValue: 'Shoes' })}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="tops" className="focus-visible:outline-none">
                    {renderItemSelectorGrid(localTops, selectedTop, setSelectedTop)}
                  </TabsContent>
                  <TabsContent value="bottoms" className="focus-visible:outline-none">
                    {renderItemSelectorGrid(localBottoms, selectedBottom, setSelectedBottom)}
                  </TabsContent>
                  <TabsContent value="shoes" className="focus-visible:outline-none">
                    {renderItemSelectorGrid(localShoes, selectedShoe, setSelectedShoe)}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Canvas Outfit Preview Area */}
              <div className="flex flex-col items-center justify-center p-3 bg-primary-shadow rounded-[12px] border border-border relative mt-3">
                <span className="text-[12px] font-bold text-text-brand">
                  {t('sandbox.canvas', { defaultValue: 'Outfit Canvas' })}
                </span>
                <div className="flex items-center gap-2 relative w-full justify-center mt-3">
                  {/* Top Layer */}
                  <div className="relative">
                    {isListingTop ? (
                      <div className="h-24 w-24 bg-card rounded-[12px] border border-primary-brand p-1 flex flex-col items-center justify-center shadow-md relative">
                        <span className="absolute top-0.5 end-1.5 text-[8px] font-bold text-primary-brand uppercase tracking-wider">
                          {t('sandbox.listing', { defaultValue: 'Buy' })}
                        </span>
                        <img
                          src={bestImageUrl(listingItem)}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-24 bg-card rounded-[12px] border border-border p-1 flex items-center justify-center shadow-sm relative">
                        {selectedTop ? (
                          <img
                            src={bestImageUrl(selectedTop)}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-text-brand text-center">
                            {t('sandbox.noTop', { defaultValue: 'Select Top' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Bottom Layer */}
                  <div className="relative">
                    {isListingBottom ? (
                      <div className="h-24 w-24 bg-card rounded-[12px] border border-primary-brand p-1 flex flex-col items-center justify-center shadow-md relative">
                        <span className="absolute top-0.5 end-1.5 text-[8px] font-bold text-primary-brand uppercase tracking-wider">
                          {t('sandbox.listing', { defaultValue: 'Buy' })}
                        </span>
                        <img
                          src={bestImageUrl(listingItem)}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-24 bg-card rounded-[12px] border border-border p-1 flex items-center justify-center shadow-sm relative">
                        {selectedBottom ? (
                          <img
                            src={bestImageUrl(selectedBottom)}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-text-brand text-center">
                            {t('sandbox.noBottom', { defaultValue: 'Select Bottom' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Footwear Layer */}
                  <div className="relative">
                    {isListingShoe ? (
                      <div className="h-24 w-24 bg-card rounded-[12px] border border-primary-brand p-1 flex flex-col items-center justify-center shadow-md relative">
                        <span className="absolute top-0.5 end-1.5 text-[8px] font-bold text-primary-brand uppercase tracking-wider">
                          {t('sandbox.listing', { defaultValue: 'Buy' })}
                        </span>
                        <img
                          src={bestImageUrl(listingItem)}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-24 bg-card rounded-[12px] border border-border p-1 flex items-center justify-center shadow-sm relative">
                        {selectedShoe ? (
                          <img
                            src={bestImageUrl(selectedShoe)}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-text-brand text-center">
                            {t('sandbox.noShoes', { defaultValue: 'Select Shoes' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Complete The Look Action Button */}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Button>
                <Button
                  onClick={handleCompleteTheLook}
                  disabled={loading}
                  className="bg-primary-brand hover:bg-primary-brand/90 text-white font-bold gap-2"
                  data-testid="complete-the-look-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('sandbox.generatingLooks', { defaultValue: 'Styling complete looks...' })}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>{t('sandbox.completeTheLook', { defaultValue: 'Complete The Look' })}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Results View: Up to 3 matching looks overlaid on avatar with metrics & palette */
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-dark-brand flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary-brand" />
                    {t('sandbox.matchingOutfitsTitle', {
                      defaultValue: 'Complete Looks with Your Wardrobe',
                    })}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-text-brand">
                    {t('sandbox.matchingOutfitsDesc', {
                      defaultValue:
                        'AI-curated looks matching this piece with your existing clothes.',
                    })}
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('sandbox')}
                  className="text-xs gap-1 text-text-brand hover:text-dark-brand"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t('sandbox.adjustPieces', { defaultValue: 'Adjust Selection' })}
                </Button>
              </div>
            </DialogHeader>

            {fitCheck.hasMismatch && (
              <div
                className="rounded-[12px] border border-amber-300 bg-amber-50/90 dark:bg-amber-950/25 dark:border-amber-800 p-2.5 text-amber-900 dark:text-amber-200 text-xs"
                data-testid="sandbox-results-fit-warning-banner"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {t('market.fitCheck.bannerTitle', { defaultValue: 'Fit & Proportions Notice' })}: {fitCheck.title}
                    </span>
                    <span className="text-[11.5px] opacity-90 leading-tight block mt-0.5">
                      {fitCheck.reasoning}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Look Selector Tabs/Pills */}
            {outfits.length > 1 && (
              <div className="flex items-center gap-2 p-1 bg-accent-beige rounded-xl">
                {outfits.map((look, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveLookIndex(idx)}
                    className={cn(
                      'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center',
                      activeLookIndex === idx
                        ? 'bg-primary-brand text-white shadow-sm'
                        : 'text-dark-brand hover:bg-white/50',
                    )}
                  >
                    {t('sandbox.lookN', { n: idx + 1, defaultValue: `Look ${idx + 1}` })}
                  </button>
                ))}
              </div>
            )}

            {currentLook && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start mt-2">
                {/* Left Column: 2D Avatar Overlay */}
                <div className="md:col-span-5 flex flex-col items-center">
                  <div className="relative w-full aspect-[4/5] bg-[#eae6df] rounded-2xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
                    <AvatarViewer
                      shapeParams={user?.avatar_shape_params || {}}
                      sex={user?.sex || 'female'}
                      outfitItems={currentLookPiecesMap}
                    />
                    <Badge className="absolute top-2.5 start-2.5 bg-white/95 text-dark-brand border border-border shadow-sm text-[10px] font-bold">
                      {currentLook.name ||
                        t('sandbox.lookN', {
                          n: activeLookIndex + 1,
                          defaultValue: `Look ${activeLookIndex + 1}`,
                        })}
                    </Badge>
                  </div>
                </div>

                {/* Right Column: Reasoning, Metrics, Palette, Pieces */}
                <div className="md:col-span-7 space-y-3.5">
                  {/* Title & Vibe */}
                  <div>
                    <h4 className="text-base font-bold text-dark-brand">
                      {currentLook.name}
                    </h4>
                    {currentLook.metrics?.aesthetic_vibe && (
                      <span className="inline-block text-[11px] font-semibold text-primary-brand bg-primary-shadow px-2 py-0.5 rounded-full mt-1">
                        {currentLook.metrics.aesthetic_vibe}
                      </span>
                    )}
                  </div>

                  {/* Stylist Reasoning */}
                  <div className="rounded-xl bg-accent-beige/40 border border-border p-3 space-y-1">
                    <div className="text-[11px] font-bold text-text-brand uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary-brand" />
                      {t('sandbox.stylistRationale', { defaultValue: 'Stylist Rationale' })}
                    </div>
                    <p className="text-xs text-dark-brand leading-relaxed italic">
                      "{currentLook.why || currentLook.rationale || result?.rationale}"
                    </p>
                  </div>

                  {/* Metrics Grid */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-text-brand uppercase tracking-wider">
                      {t('sandbox.styleMetrics', { defaultValue: 'Style Metrics' })}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-2 text-center">
                        <div className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                          {t('sandbox.harmonyScore', { defaultValue: 'Harmony' })}
                        </div>
                        <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {currentLook.metrics?.harmony_score ?? 95}%
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-xl p-2 text-center">
                        <div className="text-[9px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                          {t('sandbox.wardrobeMatch', { defaultValue: 'Style Match' })}
                        </div>
                        <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                          {currentLook.metrics?.style_match ?? 94}%
                        </div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30 rounded-xl p-2 text-center">
                        <div className="text-[9px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                          {t('sandbox.versatility', { defaultValue: 'Versatility' })}
                        </div>
                        <div className="text-sm font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
                          {currentLook.metrics?.versatility_score ?? 88}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Color Palette & Harmony Badge */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-text-brand uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-primary-brand" />
                      {t('sandbox.colorPalette', { defaultValue: 'Color Palette' })}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(currentLook.color_palette || []).map((color, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-secondary/30 rounded-full px-2 py-0.5 border border-border text-[11px] font-medium text-dark-brand"
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{
                              background:
                                color.startsWith('#') || color.startsWith('rgb')
                                  ? color
                                  : undefined,
                            }}
                            aria-hidden="true"
                          />
                          <span className="capitalize text-[10px]">{color}</span>
                        </div>
                      ))}
                    </div>
                    <HarmonyBadge colors={lookColors} />
                  </div>

                  {/* Outfit Pieces Breakdown */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-text-brand uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary-brand" />
                      {t('sandbox.outfitPieces', { defaultValue: 'Outfit Pieces' })}
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pe-1">
                      {resolvedItemsList.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-secondary/15 border border-border text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0 border border-border">
                              {it.image_url ? (
                                <img
                                  src={it.image_url}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <ImageOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-dark-brand truncate text-[11px]">
                                {it.title}
                              </div>
                              <div className="text-[9px] text-text-brand capitalize">
                                {it.role}
                              </div>
                            </div>
                          </div>
                          {it.is_listing ? (
                            <Badge className="bg-primary-brand text-white text-[9px] font-bold shrink-0">
                              {t('sandbox.listing', { defaultValue: 'Buy' })}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                              {t('sandbox.fromYourCloset', { defaultValue: 'In closet' })}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => setViewMode('sandbox')}
                      className="gap-1.5 text-xs h-9 flex-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t('sandbox.adjustPieces', { defaultValue: 'Adjust Selection' })}
                    </Button>
                    <Button
                      onClick={() => handleSaveOutfit(currentLook)}
                      disabled={isCurrentLookSaved || isSaving}
                      className="gap-2 text-xs font-bold h-9 flex-1 bg-primary-brand hover:bg-primary-brand/90 text-white"
                    >
                      {isCurrentLookSaved ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                          <span>{t('sandbox.outfitSaved', { defaultValue: 'Outfit Saved!' })}</span>
                        </>
                      ) : isSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{t('sandbox.savingOutfit', { defaultValue: 'Saving...' })}</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          <span>{t('sandbox.saveOutfit', { defaultValue: 'Save to My Outfits' })}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
