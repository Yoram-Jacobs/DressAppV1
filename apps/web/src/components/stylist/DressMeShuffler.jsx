import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Save,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
  Loader2,
  Shirt,
  Layers,
  Footprints,
  ShoppingBag,
  Watch,
  Lock,
  Eye,
  Check,
  Ban,
  Sparkle
} from 'lucide-react';
import { useStoreState } from '@/lib/createSimpleStore';
import { shufflerUIStore } from '@/lib/shufflerUIStore';
import { useClosetItems } from '@/lib/useClosetStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { bestImageUrl } from '@/lib/itemImage';
import { labelForRole, labelForDressCode } from '@/lib/taxonomy';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import { ItemFloater } from '@/components/stylist/ItemFloater';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDailySuggestionsStore } from '@/lib/dailySuggestionsStore';
import { useAuth } from '@/lib/auth';
import AvatarViewer from '@/components/AvatarViewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DRESS_CODE_OPTIONS = ['all', 'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear'];

export function detectAccessoryRole(item) {
  if (!item) return 'accessory';
  const text = `${item.name || ''} ${item.title || ''} ${item.sub_category || ''} ${item.item_type || ''} ${item.category || ''}`.toLowerCase();
  
  if (/\b(watch|watches|smartwatch|wristwatch|timepiece|bracelet|bangle)\b/i.test(text) || /(?:שעון|שעון יד|צמיד|סמארטוואטש|ساعة|سوار)/i.test(text)) {
    return 'watch';
  }
  if (/\b(hat|hats|cap|caps|beanie|beret|fedora|visor|turban|kippah|headband|bandana|mitpachat)\b/i.test(text) || /(?:כובע|קסקט|ברט|כיפה|מצחייה|סרט ראש|קשת|טורבן|מטפחת|קובע|قبعة|طاقية)/i.test(text)) {
    return 'headwear';
  }
  if (/\b(glasses|sunglasses|spectacles|eyewear|shades)\b/i.test(text) || /(?:משקפיים|משקפי שמש|משקפי_שמש|משקפי ראייה|نظارات|نظارة)/i.test(text)) {
    return 'glasses';
  }
  if (/\b(earring|earrings|ear stud|ear cuff|hoops)\b/i.test(text) || /(?:עגילים|עגיל|עגילי|أقراط|حلق)/i.test(text)) {
    return 'earrings';
  }
  if (/\b(scarf|scarves|shawl|pashmina|wrap|necktie|tie|necklace|choker|pendant)\b/i.test(text) || /(?:צעיף|צעיפים|עניבה|עניבות|שרשרת|שרשראות|קולר|תליון|وشاح|ربطة)/i.test(text)) {
    return 'scarf';
  }
  if (/\b(belt|belts|waistband|sash)\b/i.test(text) || /(?:חגורה|אבזם|חגור|חגורות|حزام)/i.test(text)) {
    return 'belt';
  }
  if (/\b(glove|gloves|mitten|mittens)\b/i.test(text) || /(?:כפפות|כפפה|כפפות עור|قفازات)/i.test(text)) {
    return 'gloves';
  }
  if (/\b(bag|bags|tote|purse|backpack|clutch|satchel|crossbody)\b/i.test(text) || /(?:תיק|תיקים|ארנק|ארנקים|תרמיל|ילקוט|حقيبة|شنطة)/i.test(text)) {
    return 'bag';
  }
  return 'accessory';
}

export default function DressMeShuffler({ onSaveSuccess, onOpenCalendar }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const rawItems = useClosetItems({ prewarm: true });
  const items = (rawItems || []).filter(Boolean);
  const { calendarEvents: cachedCalendarEvents, prewarm: prewarmDaily } = useDailySuggestionsStore();

  const [selectedStyle, setSelectedStyle] = useStoreState(shufflerUIStore, 'selectedStyle');
  const [tagInput, setTagInput] = useStoreState(shufflerUIStore, 'tagInput');
  const [selectedTag, setSelectedTag] = useStoreState(shufflerUIStore, 'selectedTag');
  const [showSuggestions, setShowSuggestions] = useStoreState(shufflerUIStore, 'showSuggestions');

  // Weather, Location, Calendar, Rationale
  const [coords] = useStoreState(shufflerUIStore, 'coords');
  const [, setWeather] = useStoreState(shufflerUIStore, 'weather');
  const [includeCalendar, setIncludeCalendar] = useStoreState(shufflerUIStore, 'includeCalendar');
  const [calendarEvents, setCalendarEvents] = useStoreState(shufflerUIStore, 'calendarEvents');
  const [calendarLoading, setCalendarLoading] = useStoreState(shufflerUIStore, 'calendarLoading');
  const [aiRationale, setAiRationale] = useStoreState(shufflerUIStore, 'aiRationale');

  // Multi-Carousel Focus & Selection States
  const [outerwearFocusIdx, setOuterwearFocusIdx] = useStoreState(shufflerUIStore, 'outerwearFocusIdx');
  const [topFocusIdx, setTopFocusIdx] = useStoreState(shufflerUIStore, 'topFocusIdx');
  const [fullBodyFocusIdx, setFullBodyFocusIdx] = useStoreState(shufflerUIStore, 'fullBodyFocusIdx');
  const [bottomFocusIdx, setBottomFocusIdx] = useStoreState(shufflerUIStore, 'bottomFocusIdx');
  const [shoeFocusIdx, setShoeFocusIdx] = useStoreState(shufflerUIStore, 'shoeFocusIdx');
  const [accessoryFocusIdx, setAccessoryFocusIdx] = useStoreState(shufflerUIStore, 'accessoryFocusIdx');

  const [outerwearSelectedIdx, setOuterwearSelectedIdx] = useStoreState(shufflerUIStore, 'outerwearSelectedIdx');
  const [topSelectedIdx, setTopSelectedIdx] = useStoreState(shufflerUIStore, 'topSelectedIdx');
  const [fullBodySelectedIdx, setFullBodySelectedIdx] = useStoreState(shufflerUIStore, 'fullBodySelectedIdx');
  const [bottomSelectedIdx, setBottomSelectedIdx] = useStoreState(shufflerUIStore, 'bottomSelectedIdx');
  const [shoeSelectedIdx, setShoeSelectedIdx] = useStoreState(shufflerUIStore, 'shoeSelectedIdx');
  const [accessorySelectedIdx, setAccessorySelectedIdx] = useStoreState(shufflerUIStore, 'accessorySelectedIdx');

  // Outfit Composition Modes
  const [isFullBodyMode, setIsFullBodyMode] = useStoreState(shufflerUIStore, 'isFullBodyMode');
  const [includeOuterwear, setIncludeOuterwear] = useStoreState(shufflerUIStore, 'includeOuterwear');
  const [includeAccessory, setIncludeAccessory] = useStoreState(shufflerUIStore, 'includeAccessory');

  // Active item detail floater & Avatar Modal
  const [activeFloaterItemId, setActiveFloaterItemId] = useStoreState(shufflerUIStore, 'activeFloaterItemId');
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  // Carousel APIs
  const [outerwearApi, setOuterwearApi] = useState(null);
  const [topApi, setTopApi] = useState(null);
  const [fullBodyApi, setFullBodyApi] = useState(null);
  const [bottomApi, setBottomApi] = useState(null);
  const [shoeApi, setShoeApi] = useState(null);
  const [accessoryApi, setAccessoryApi] = useState(null);

  const [isSpinning, setIsSpinning] = useStoreState(shufflerUIStore, 'isSpinning');
  const [saving, setSaving] = useStoreState(shufflerUIStore, 'saving');

  // Switchable Calendar Events Sync
  useEffect(() => {
    if (includeCalendar) {
      if (cachedCalendarEvents && cachedCalendarEvents.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayEvents = cachedCalendarEvents.filter(e => {
          const start = e.start?.dateTime || e.start?.date || '';
          return start.startsWith(todayStr);
        });
        setCalendarEvents(todayEvents);
      } else {
        setCalendarLoading(true);
        prewarmDaily().then(snap => {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayEvents = (snap.calendarEvents || []).filter(e => {
            const start = e.start?.dateTime || e.start?.date || '';
            return start.startsWith(todayStr);
          });
          setCalendarEvents(todayEvents);
        }).finally(() => {
          setCalendarLoading(false);
        });
      }
    } else {
      setCalendarEvents([]);
    }
  }, [includeCalendar, cachedCalendarEvents, prewarmDaily, setCalendarEvents, setCalendarLoading]);

  // Extract all unique tags
  const allUniqueTags = Array.from(
    new Set(items.flatMap(it => Array.isArray(it.tags) ? it.tags : []))
  ).filter(Boolean);

  const tagSuggestions = tagInput
    ? allUniqueTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && t !== selectedTag)
    : allUniqueTags;

  // 1. Outwear, full-body, and accessories need their own carousels
  const isMatchCategory = (it, catList) => {
    if (!it || !it.category) return false;
    const c = String(it.category).toLowerCase().trim().replace(/[-_]/g, ' ');
    return catList.some(target => c === target.toLowerCase());
  };

  const outerwears = items.filter(it => isMatchCategory(it, ['outerwear', 'jacket', 'coat', 'blazer', 'cardigan']));
  const fullBodies = items.filter(it => isMatchCategory(it, ['full body', 'dress', 'dresses', 'one piece', 'sari', 'saree', 'jumpsuit', 'kaftan', 'abaya']));
  const tops = items.filter(it => isMatchCategory(it, ['top', 'tops']) && !isMatchCategory(it, ['outerwear', 'full body', 'dress']));
  const bottoms = items.filter(it => isMatchCategory(it, ['bottom', 'bottoms']));
  const shoes = items.filter(it => isMatchCategory(it, ['footwear', 'shoes', 'shoe']));
  const accessories = items.filter(it => isMatchCategory(it, ['accessories', 'accessory', 'headwear', 'jewelry', 'belt', 'watch', 'hat', 'glasses']));

  const filterByPrefs = (list) => list.filter(it => {
    if (selectedStyle && selectedStyle !== 'all' && it.dress_code !== selectedStyle) return false;
    if (selectedTag && (!Array.isArray(it.tags) || !it.tags.includes(selectedTag))) return false;
    return true;
  });

  const filteredOuterwears = filterByPrefs(outerwears);
  const filteredFullBodies = filterByPrefs(fullBodies);
  const filteredTops = filterByPrefs(tops);
  const filteredBottoms = filterByPrefs(bottoms);
  const filteredShoes = filterByPrefs(shoes);
  const filteredAccessories = filterByPrefs(accessories);

  // Duplication helper for Embla infinite loops
  const getDuplicatedList = (list) => {
    if (!list || list.length === 0) return [];
    if (list.length >= 12) return list;
    const repeatCount = Math.ceil(12 / list.length);
    const duplicated = [];
    for (let i = 0; i < repeatCount; i++) {
      duplicated.push(...list);
    }
    return duplicated;
  };

  const duplicatedOuterwears = getDuplicatedList(filteredOuterwears);
  const duplicatedFullBodies = getDuplicatedList(filteredFullBodies);
  const duplicatedTops = getDuplicatedList(filteredTops);
  const duplicatedBottoms = getDuplicatedList(filteredBottoms);
  const duplicatedShoes = getDuplicatedList(filteredShoes);
  const duplicatedAccessories = getDuplicatedList(filteredAccessories);

  const lastFilterRef = useRef({ style: selectedStyle, tag: selectedTag });

  // Reset focus index and scrolls on style/tag filter change
  useEffect(() => {
    const styleChanged = lastFilterRef.current.style !== selectedStyle;
    const tagChanged = lastFilterRef.current.tag !== selectedTag;

    if (styleChanged || tagChanged) {
      setOuterwearFocusIdx(0);
      setTopFocusIdx(0);
      setFullBodyFocusIdx(0);
      setBottomFocusIdx(0);
      setShoeFocusIdx(0);
      setAccessoryFocusIdx(0);

      setOuterwearSelectedIdx(null);
      setTopSelectedIdx(null);
      setFullBodySelectedIdx(null);
      setBottomSelectedIdx(null);
      setShoeSelectedIdx(null);
      setAccessorySelectedIdx(null);
      setActiveFloaterItemId(null);

      if (outerwearApi && filteredOuterwears.length > 0) outerwearApi.scrollTo(0, false);
      if (topApi && filteredTops.length > 0) topApi.scrollTo(0, false);
      if (fullBodyApi && filteredFullBodies.length > 0) fullBodyApi.scrollTo(0, false);
      if (bottomApi && filteredBottoms.length > 0) bottomApi.scrollTo(0, false);
      if (shoeApi && filteredShoes.length > 0) shoeApi.scrollTo(0, false);
      if (accessoryApi && filteredAccessories.length > 0) accessoryApi.scrollTo(0, false);

      lastFilterRef.current = { style: selectedStyle, tag: selectedTag };
    }
  }, [
    selectedStyle, selectedTag,
    outerwearApi, topApi, fullBodyApi, bottomApi, shoeApi, accessoryApi,
    filteredOuterwears.length, filteredTops.length, filteredFullBodies.length,
    filteredBottoms.length, filteredShoes.length, filteredAccessories.length
  ]);

  // Global handler to clear selections and close floater when scrolling
  const handleStartScroll = () => {
    setOuterwearSelectedIdx(null);
    setTopSelectedIdx(null);
    setFullBodySelectedIdx(null);
    setBottomSelectedIdx(null);
    setShoeSelectedIdx(null);
    setAccessorySelectedIdx(null);
    setActiveFloaterItemId(null);
  };

  // Bind Carousel API listeners
  const setupCarouselListeners = (api, setFocusIdx, onSelectExtra) => {
    if (!api) return;
    const onSelect = () => {
      setFocusIdx(api.selectedScrollSnap());
      if (onSelectExtra) onSelectExtra();
    };
    const onPointerUp = () => {
      const engine = api.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    api.on('select', onSelect);
    api.on('scroll', handleStartScroll);
    api.on('pointerUp', onPointerUp);
    return () => {
      api.off('select', onSelect);
      api.off('scroll', handleStartScroll);
      api.off('pointerUp', onPointerUp);
    };
  };

  // Outerwear listeners
  useEffect(() => setupCarouselListeners(outerwearApi, setOuterwearFocusIdx, () => setIncludeOuterwear(true)), [outerwearApi]);

  // Full Body listeners (activates full body mode, restricts bottoms)
  useEffect(() => setupCarouselListeners(fullBodyApi, setFullBodyFocusIdx, () => setIsFullBodyMode(true)), [fullBodyApi]);

  // Top listeners (activates separates mode, restricts full body)
  useEffect(() => setupCarouselListeners(topApi, setTopFocusIdx, () => setIsFullBodyMode(false)), [topApi]);

  // Bottom listeners (activates separates mode, restricts full body)
  useEffect(() => setupCarouselListeners(bottomApi, setBottomFocusIdx, () => setIsFullBodyMode(false)), [bottomApi]);

  // Shoes listeners
  useEffect(() => setupCarouselListeners(shoeApi, setShoeFocusIdx), [shoeApi]);

  // Accessories listeners
  useEffect(() => setupCarouselListeners(accessoryApi, setAccessoryFocusIdx, () => setIncludeAccessory(true)), [accessoryApi]);

  // Sync State -> Carousel API scrollTo
  useEffect(() => {
    if (outerwearApi && duplicatedOuterwears.length > 0 && outerwearSelectedIdx !== null) {
      if (outerwearApi.selectedScrollSnap() !== outerwearSelectedIdx) outerwearApi.scrollTo(outerwearSelectedIdx, isSpinning);
    }
  }, [outerwearSelectedIdx, outerwearApi, duplicatedOuterwears.length, isSpinning]);

  useEffect(() => {
    if (topApi && duplicatedTops.length > 0 && topSelectedIdx !== null) {
      if (topApi.selectedScrollSnap() !== topSelectedIdx) topApi.scrollTo(topSelectedIdx, isSpinning);
    }
  }, [topSelectedIdx, topApi, duplicatedTops.length, isSpinning]);

  useEffect(() => {
    if (fullBodyApi && duplicatedFullBodies.length > 0 && fullBodySelectedIdx !== null) {
      if (fullBodyApi.selectedScrollSnap() !== fullBodySelectedIdx) fullBodyApi.scrollTo(fullBodySelectedIdx, isSpinning);
    }
  }, [fullBodySelectedIdx, fullBodyApi, duplicatedFullBodies.length, isSpinning]);

  useEffect(() => {
    if (bottomApi && duplicatedBottoms.length > 0 && bottomSelectedIdx !== null) {
      if (bottomApi.selectedScrollSnap() !== bottomSelectedIdx) bottomApi.scrollTo(bottomSelectedIdx, isSpinning);
    }
  }, [bottomSelectedIdx, bottomApi, duplicatedBottoms.length, isSpinning]);

  useEffect(() => {
    if (shoeApi && duplicatedShoes.length > 0 && shoeSelectedIdx !== null) {
      if (shoeApi.selectedScrollSnap() !== shoeSelectedIdx) shoeApi.scrollTo(shoeSelectedIdx, isSpinning);
    }
  }, [shoeSelectedIdx, shoeApi, duplicatedShoes.length, isSpinning]);

  useEffect(() => {
    if (accessoryApi && duplicatedAccessories.length > 0 && accessorySelectedIdx !== null) {
      if (accessoryApi.selectedScrollSnap() !== accessorySelectedIdx) accessoryApi.scrollTo(accessorySelectedIdx, isSpinning);
    }
  }, [accessorySelectedIdx, accessoryApi, duplicatedAccessories.length, isSpinning]);

  // AI Planner Scout
  const handleShuffle = async () => {
    if (isSpinning) return;

    handleStartScroll();
    setIsSpinning(true);
    setAiRationale('');

    let spinCount = 0;
    const spinTimer = setInterval(() => {
      if (duplicatedOuterwears.length > 1) outerwearApi?.scrollTo(Math.floor(Math.random() * duplicatedOuterwears.length), true);
      if (duplicatedTops.length > 1) topApi?.scrollTo(Math.floor(Math.random() * duplicatedTops.length), true);
      if (duplicatedFullBodies.length > 1) fullBodyApi?.scrollTo(Math.floor(Math.random() * duplicatedFullBodies.length), true);
      if (duplicatedBottoms.length > 1) bottomApi?.scrollTo(Math.floor(Math.random() * duplicatedBottoms.length), true);
      if (duplicatedShoes.length > 1) shoeApi?.scrollTo(Math.floor(Math.random() * duplicatedShoes.length), true);
      if (duplicatedAccessories.length > 1) accessoryApi?.scrollTo(Math.floor(Math.random() * duplicatedAccessories.length), true);
      spinCount++;
    }, 120);

    try {
      const payload = {
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        dress_code: selectedStyle,
        tag: selectedTag || null,
        include_calendar: includeCalendar,
      };

      const res = await api.plannerScout(payload);
      clearInterval(spinTimer);

      if (res.weather_summary) setWeather(res.weather_summary);
      if (res.why) setAiRationale(res.why);

      // Handle Full Body vs Separates
      if (res.full_body_id) {
        setIsFullBodyMode(true);
        let fbIdx = filteredFullBodies.findIndex(it => it.id === res.full_body_id);
        if (fbIdx === -1) fbIdx = fullBodies.findIndex(it => it.id === res.full_body_id);
        if (fbIdx !== -1) {
          setFullBodyFocusIdx(fbIdx);
          fullBodyApi?.scrollTo(fbIdx, true);
        }
      } else {
        setIsFullBodyMode(false);
        if (res.top_id) {
          let tIdx = filteredTops.findIndex(it => it.id === res.top_id);
          if (tIdx === -1) tIdx = tops.findIndex(it => it.id === res.top_id);
          if (tIdx !== -1) {
            setTopFocusIdx(tIdx);
            topApi?.scrollTo(tIdx, true);
          }
        }
        if (res.bottom_id) {
          let bIdx = filteredBottoms.findIndex(it => it.id === res.bottom_id);
          if (bIdx === -1) bIdx = bottoms.findIndex(it => it.id === res.bottom_id);
          if (bIdx !== -1) {
            setBottomFocusIdx(bIdx);
            bottomApi?.scrollTo(bIdx, true);
          }
        }
      }

      if (res.outerwear_id) {
        setIncludeOuterwear(true);
        let oIdx = filteredOuterwears.findIndex(it => it.id === res.outerwear_id);
        if (oIdx === -1) oIdx = outerwears.findIndex(it => it.id === res.outerwear_id);
        if (oIdx !== -1) {
          setOuterwearFocusIdx(oIdx);
          outerwearApi?.scrollTo(oIdx, true);
        }
      }

      if (res.shoes_id) {
        let sIdx = filteredShoes.findIndex(it => it.id === res.shoes_id);
        if (sIdx === -1) sIdx = shoes.findIndex(it => it.id === res.shoes_id);
        if (sIdx !== -1) {
          setShoeFocusIdx(sIdx);
          shoeApi?.scrollTo(sIdx, true);
        }
      }

      if (res.accessory_id) {
        setIncludeAccessory(true);
        let aIdx = filteredAccessories.findIndex(it => it.id === res.accessory_id);
        if (aIdx === -1) aIdx = accessories.findIndex(it => it.id === res.accessory_id);
        if (aIdx !== -1) {
          setAccessoryFocusIdx(aIdx);
          accessoryApi?.scrollTo(aIdx, true);
        }
      }

      toast.success(t('stylist.aiPlannerSuccess', { defaultValue: 'AI Scouting Complete! 1 Credit charged.' }), { duration: 3000 });
    } catch (err) {
      clearInterval(spinTimer);
      console.error('AI Planner Scout failed:', err);
      const detail = err.response?.data?.detail;
      const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail || '');
      if (detailStr.toLowerCase().includes('quota') || detailStr.toLowerCase().includes('exhausted') || detailStr.toLowerCase().includes('limit') || err.response?.status === 402) {
        toast.error(t('common.upgradeToUse', {
          feature: t('common.features.moreAiActions', { defaultValue: 'more AI actions' }),
          defaultValue: 'Upgrade your plan to use more AI actions'
        }), { duration: 5000 });
      } else {
        toast.error(err.response?.data?.detail || t('stylist.failedScout', { defaultValue: 'Failed to Scout: ensure you have enough items in closet.' }));
      }
    } finally {
      setIsSpinning(false);
    }
  };

  // Compile active outfit pieces for save & preview
  const currentOutfitPieces = useMemo(() => {
    const list = [];

    // Outerwear (overlaid over tops/dresses)
    if (includeOuterwear && filteredOuterwears.length > 0) {
      const it = filteredOuterwears[outerwearFocusIdx % filteredOuterwears.length];
      if (it) list.push({ item: it, role: 'outerwear', roleKey: 'outerwear' });
    }

    // 2. Full Body vs Separates
    if (isFullBodyMode) {
      if (filteredFullBodies.length > 0) {
        const it = filteredFullBodies[fullBodyFocusIdx % filteredFullBodies.length];
        if (it) list.push({ item: it, role: 'dress', roleKey: 'dress' });
      }
    } else {
      if (filteredTops.length > 0) {
        const it = filteredTops[topFocusIdx % filteredTops.length];
        if (it) list.push({ item: it, role: 'top', roleKey: 'top' });
      }
      if (filteredBottoms.length > 0) {
        const it = filteredBottoms[bottomFocusIdx % filteredBottoms.length];
        if (it) list.push({ item: it, role: 'bottom', roleKey: 'bottom' });
      }
    }

    // Shoes
    if (filteredShoes.length > 0) {
      const it = filteredShoes[shoeFocusIdx % filteredShoes.length];
      if (it) list.push({ item: it, role: 'shoes', roleKey: 'shoes' });
    }

    // 4. Accessories (specific anatomical role: watch, headwear, glasses, belt, etc.)
    if (includeAccessory && filteredAccessories.length > 0) {
      const it = filteredAccessories[accessoryFocusIdx % filteredAccessories.length];
      if (it) {
        const role = detectAccessoryRole(it);
        list.push({ item: it, role, roleKey: role });
      }
    }

    return list;
  }, [
    includeOuterwear, filteredOuterwears, outerwearFocusIdx,
    isFullBodyMode, filteredFullBodies, fullBodyFocusIdx,
    filteredTops, topFocusIdx,
    filteredBottoms, bottomFocusIdx,
    filteredShoes, shoeFocusIdx,
    includeAccessory, filteredAccessories, accessoryFocusIdx
  ]);

  // Construct AvatarViewer map
  const avatarPiecesMap = useMemo(() => {
    const map = {};
    currentOutfitPieces.forEach(({ item, roleKey }) => {
      map[roleKey] = {
        ...item,
        role: roleKey,
        image_url: bestImageUrl(item),
        clean_image_url: item.clean_image_url || bestImageUrl(item),
      };
    });
    return map;
  }, [currentOutfitPieces]);

  // Save Outfit
  const handleSave = async () => {
    if (currentOutfitPieces.length === 0) {
      toast.error(t('common.error'));
      return;
    }

    const rawItemsList = currentOutfitPieces.map(g => g.item);

    const generateDescriptiveOutfitTitle = (items, translator) => {
      const colorList = items
        .map(it => {
          if (typeof it.color === 'string') return it.color;
          if (Array.isArray(it.colors) && it.colors.length > 0) {
            return typeof it.colors[0] === 'object' ? it.colors[0].name : it.colors[0];
          }
          return null;
        })
        .filter(Boolean)
        .map(c => c.toLowerCase());

      const uniqueColors = Array.from(new Set(colorList)).map(c => {
        const key = `color.${c}`;
        const localized = translator(key, { defaultValue: c });
        return localized.charAt(0).toUpperCase() + localized.slice(1);
      });

      let colorStr = '';
      if (uniqueColors.length === 1) {
        colorStr = uniqueColors[0];
      } else if (uniqueColors.length === 2) {
        colorStr = `${uniqueColors[0]} & ${uniqueColors[1]}`;
      } else if (uniqueColors.length > 2) {
        colorStr = `${uniqueColors.slice(0, 2).join(' & ')}`;
      }

      const types = items.map(it => (it.item_type || it.title || '').toLowerCase());
      let vibe = translator('stylist.vibe.casual', { defaultValue: 'Casual' });
      let season = translator('stylist.season.daily', { defaultValue: 'Daily' });

      if (types.some(t => t.includes('hoodie') || t.includes('sweatpants') || t.includes('sneaker') || t.includes('sport'))) {
        vibe = translator('stylist.vibe.sporty', { defaultValue: 'Sporty' });
      } else if (types.some(t => t.includes('suit') || t.includes('blazer') || t.includes('dress shirt') || t.includes('formal'))) {
        vibe = translator('stylist.vibe.formal', { defaultValue: 'Formal' });
      } else if (types.some(t => t.includes('jeans') || t.includes('denim') || t.includes('jacket'))) {
        vibe = translator('stylist.vibe.classic', { defaultValue: 'Classic' });
      }

      if (types.some(t => t.includes('shorts') || t.includes('t-shirt') || t.includes('sandal') || t.includes('swim'))) {
        season = translator('stylist.season.summer', { defaultValue: 'Summer' });
      } else if (types.some(t => t.includes('coat') || t.includes('sweater') || t.includes('wool') || t.includes('heavy'))) {
        season = translator('stylist.season.winter', { defaultValue: 'Winter' });
      }

      const suffix = vibe === 'Sporty'
        ? translator('stylist.suffix.workout', { defaultValue: 'Workout' })
        : vibe === 'Formal'
          ? translator('stylist.suffix.attire', { defaultValue: 'Attire' })
          : translator('stylist.suffix.hangout', { defaultValue: 'Hangout' });

      return colorStr ? `${vibe} ${colorStr} ${season} ${suffix}` : `${vibe} ${season} ${suffix}`;
    };

    const generateDescriptiveOutfitDescription = (items, translator) => {
      const titles = items.map(it => it.title || it.name || it.caption).filter(Boolean);
      if (titles.length === 0) return '';
      return translator('stylist.outfitDescriptionPattern', {
        defaultValue: `A carefully styled combination featuring ${titles.join(', ')}. Perfect for a coordinated and comfortable look.`,
        items: titles.join(', ')
      });
    };

    const descriptiveTitle = generateDescriptiveOutfitTitle(rawItemsList, t);
    const descriptiveDesc = generateDescriptiveOutfitDescription(rawItemsList, t);

    setSaving(true);
    const body = {
      name: descriptiveTitle,
      description: descriptiveDesc,
      source_workflow: 'scheduled',
      prompt: 'shuffled',
      garments: currentOutfitPieces.map(({ item, role }) => ({
        closet_item_id: item.id,
        role: role,
        title: item.name || item.title || ''
      })),
      usage: {
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        location: null,
        event_name: t('stylist.shuffledLook', { defaultValue: 'Shuffled Look' })
      }
    };

    try {
      await api.saveOutfit(body);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved to your diary!' }));
      if (typeof onSaveSuccess === 'function') {
        onSaveSuccess();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseFloater = () => {
    setActiveFloaterItemId(null);
    setOuterwearSelectedIdx(null);
    setTopSelectedIdx(null);
    setFullBodySelectedIdx(null);
    setBottomSelectedIdx(null);
    setShoeSelectedIdx(null);
    setAccessorySelectedIdx(null);
  };

  const rowIcons = {
    outerwear: <Layers className="shuffler-icon-sm shuffler-icon-accent" />,
    top: <Shirt className="shuffler-icon-sm shuffler-icon-accent" />,
    full_body: <Sparkle className="shuffler-icon-sm shuffler-icon-accent" />,
    bottom: <Layers className="shuffler-icon-sm shuffler-icon-accent" />,
    shoes: <Footprints className="shuffler-icon-sm shuffler-icon-accent" />,
    accessories: <Watch className="shuffler-icon-sm shuffler-icon-accent" />,
  };

  const renderRow = (roleKey, label, list, focusIdx, selectedIdx, setIdx, setApi, api, options = {}) => {
    const hasItems = list.length > 0;
    const duplicatedList = getDuplicatedList(list);
    const {
      isRestricted = false,
      restrictionLabel = '',
      onUnlock = null,
      isOptional = false,
      isIncluded = true,
      onToggleInclude = null,
    } = options;

    const handleItemClick = (itemIdx, item) => {
      if (isRestricted && onUnlock) {
        onUnlock();
      }
      if (isOptional && !isIncluded && onToggleInclude) {
        onToggleInclude(true);
      }
      if (itemIdx === focusIdx) {
        setIdx(itemIdx);
        setActiveFloaterItemId(item.id);
      } else {
        api?.scrollTo(itemIdx);
      }
    };

    return (
      <div className={`flex flex-col items-start p-[18px] rounded-[14px] border transition-all duration-200 w-full ${
        isRestricted
          ? 'bg-amber-50/40 border-amber-200/60'
          : isOptional && !isIncluded
            ? 'bg-muted/30 border-dashed border-border opacity-75'
            : 'bg-primary-shadow border-border'
      }`}>
        <div className="flex items-center justify-between w-full mb-3.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {rowIcons[roleKey]}
            <span className="text-[13px] text-dark-brand font-extrabold">{label}</span>
            {hasItems && (
              <span className="text-[11px] text-muted-foreground font-semibold px-2 py-0.5 rounded-full bg-black/5">
                {list.length}
              </span>
            )}
          </div>

          {/* Restriction banner or Optional switch */}
          {isRestricted ? (
            <div className="flex items-center gap-2 ms-auto">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                <Lock className="h-3 w-3 shrink-0" />
                {restrictionLabel}
              </span>
              {onUnlock && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onUnlock}
                  className="h-7 text-xs px-2.5 rounded-full border-amber-400 bg-white hover:bg-amber-50 text-amber-900"
                >
                  {t('stylist.activateSection', { defaultValue: 'Switch to this' })}
                </Button>
              )}
            </div>
          ) : isOptional ? (
            <div className="flex items-center gap-2 ms-auto">
              <span className="text-xs font-medium text-text-brand select-none cursor-pointer" onClick={() => onToggleInclude?.(!isIncluded)}>
                {isIncluded ? t('common.enabled', { defaultValue: 'Included' }) : t('common.optional', { defaultValue: 'Optional' })}
              </span>
              <Switch
                checked={isIncluded}
                onCheckedChange={onToggleInclude}
                disabled={isSpinning || !hasItems}
              />
            </div>
          ) : null}
        </div>

        <div className={`w-full relative px-10 max-[480px]:px-0 transition-opacity duration-200 ${
          isRestricted ? 'opacity-35 pointer-events-none' : isOptional && !isIncluded ? 'opacity-40' : 'opacity-100'
        }`}>
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: true, watchDrag: !isSpinning && !isRestricted, dragFree: true, direction: i18n.dir() }}
            className="w-full"
          >
            <CarouselContent className="-ms-2.5">
              {hasItems ? (
                duplicatedList.map((item, itemIdx) => {
                  const imageUrl = bestImageUrl(item);
                  const isFocused = itemIdx === focusIdx && !isRestricted && (!isOptional || isIncluded);
                  const isSelected = itemIdx === selectedIdx;
                  return (
                    <CarouselItem
                      key={`${item.id}-${itemIdx}`}
                      className="ps-2.5 basis-1/5 max-[700px]:basis-1/3 flex items-center justify-center cursor-pointer"
                      onClick={() => !isSpinning && handleItemClick(itemIdx, item)}
                    >
                      <div
                        className={`relative h-[92px] w-[92px] rounded-[12px] overflow-hidden flex items-center justify-center border-[1.5px] transition-all duration-250 ease-in-out select-none bg-white
                    ${isFocused
                            ? 'scale-108 opacity-100 border-[#2f6e51] shadow-[0_4px_12px_rgba(0,0,0,0.06)] z-10'
                            : 'scale-92 opacity-55 z-0 hover:opacity-85'}
                    ${isSelected ? '!border-[#2f6e51] !shadow-[0_4px_14px_rgba(47,110,81,0.16)]' : ''}`}
                      >
                        {isSelected && (
                          <span className="absolute top-[5px] right-[5px] w-5 h-5 rounded-full bg-[#2f6e51] flex items-center justify-center z-[5] shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name || label}
                            className="max-h-full max-w-full object-contain pointer-events-none p-2.5"
                            draggable={false}
                          />
                        ) : (
                          <div className="text-center text-[#b5b1a7] p-1">
                            <ImageOff className="!h-3.5 !w-3.5 mx-auto" />
                            <span className="text-[8px] block whitespace-nowrap overflow-hidden text-ellipsis px-0.5 max-w-[60px] mx-auto">
                              {item.name || item.title || t('common.garment', { defaultValue: 'Garment' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </CarouselItem>
                  );
                })
              ) : (
                <CarouselItem className="ps-2.5 basis-full flex items-center justify-center cursor-pointer">
                  <div className="relative h-[92px] w-[92px] bg-accent-beige rounded-[12px] overflow-hidden flex items-center justify-center border-[1.5px] border-dashed border-[#d8d4cb] select-none">
                    <div className="text-center p-2 text-[#b5b1a7]">
                      <ImageOff className="!h-3.5 !w-3.5 mx-auto" />
                      <span className="text-[9px] block font-semibold">{t('common.noResults')}</span>
                    </div>
                  </div>
                </CarouselItem>
              )}
            </CarouselContent>

            {hasItems && list.length > 1 && !isRestricted && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-8 start-0 rounded-full h-[34px] w-[34px] z-10 bg-white border border-[#ece7de] shadow-[0_2px_6px_rgba(0,0,0,0.06)] text-[#1a1a1a] flex items-center justify-center hover:bg-[#f6f4ef]"
                  disabled={isSpinning}
                  onClick={() => api?.scrollPrev()}
                > 
                  <ChevronLeft className="!h-4 !w-4" />
                  <span className="sr-only">{t('components.dressMeShuffler.previous_slide', { defaultValue: 'Previous slide' })}</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-8 end-0 rounded-full h-[34px] w-[34px] z-10 bg-white border border-[#ece7de] shadow-[0_2px_6px_rgba(0,0,0,0.06)] text-[#1a1a1a] flex items-center justify-center hover:bg-[#f6f4ef]"
                  disabled={isSpinning}
                  onClick={() => api?.scrollNext()}
                >
                  <ChevronRight className="!h-4 !w-4" />
                  <span className="sr-only">{t('components.dressMeShuffler.next_slide', { defaultValue: 'Next slide' })}</span>
                </Button>
              </>
            )}
          </Carousel>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* ============ LEFT PANEL: Planner ============ */}
      <div className="md:col-span-1">
        <div
          className="bg-white rounded-[20px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] p-5"
          data-testid="shuffler-planner-sidebar"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary-color)]">
            <Sparkles className="!h-3.5 !w-3.5 text-[var(--primary-color)]" />
            <span>{t('stylist.personalStylist', { defaultValue: 'Personal Stylist' })}</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--dark-color)] mt-2.5 mb-1 max-[480px]:text-[16px]">
            {t('stylist.planYourOutfit', { defaultValue: 'Plan Your Outfit' })}
          </h2>
          <p className="mb-5 text-sm text-[var(--text-color)] leading-[22px] font-semibold">
            {t('stylist.planYourOutfitDesc', { defaultValue: 'Choose your schedule, style and preferred tag.' })}
          </p>

          <Button
            variant="outline"
            onClick={onOpenCalendar}
            className="relative rounded-[12px] flex items-center justify-center !gap-2.5 w-full h-[52px] !border !border-[var(--primary-color)] font-semibold text-[14px] text-[var(--primary-color)] bg-white !transition-none !duration-0 mb-5 !shadow-none hover:text-[var(--dark-color)] hover:!border-[var(--dark-color)] [&:hover_.chevron-accent]:text-[var(--dark-color)] [&:hover_.icon-accent]:text-[var(--dark-color)]"
            data-testid="stylist-open-calendar-btn"
            disabled={isSpinning}
          >
            <CalendarDays className="icon-accent !h-4 !w-4 text-[var(--primary-color)]" />
            <span>{t('calendar.viewCalendar', { defaultValue: 'View 7-Day Planner' })}</span>
            <ChevronRight className="chevron-accent absolute end-4 !h-4 !w-4 text-[var(--primary-color)]" />
          </Button>

          <div className="flex items-center justify-between p-[15px_20px] rounded-[12px] bg-primary-shadow border border-border w-full mb-5">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="!h-[25px] !w-[25px] text-[var(--primary-color)]" />
              <div className="text-start">
                <Label htmlFor="include-calendar" className="text-[13px] mb-0 font-bold block cursor-pointer select-none text-[var(--dark-color)]">
                  {t('stylist.todayEvents', { defaultValue: "Today's Agenda" })}
                </Label>
                <span className="text-[10px] text-[var(--text-color)] block">
                  {includeCalendar
                    ? t('stylist.calendarSyncOn', { defaultValue: 'Syncing calendar items' })
                    : t('stylist.calendarSyncOff', { defaultValue: 'Toggle to check events' })}
                </span>
              </div>
            </div>
            <Switch id="include-calendar" checked={includeCalendar} onCheckedChange={setIncludeCalendar} disabled={isSpinning} />
          </div>

          {includeCalendar && (
            <div className="w-full rounded-[14px] border border-[#ccc] bg-white p-[15px_20px] flex flex-col gap-2.5 text-start mb-[15px] animate-[shufflerFadeIn_0.2s_ease-out]">
              <div className="text-[10px] font-extrabold text-[#666] uppercase tracking-[0.08em]">
                {t('stylist.todaysAgenda', { defaultValue: "Today's Schedule" })}
              </div>
              {calendarLoading ? (
                <div className="text-[12.5px] text-[#9a9a92] py-1 flex items-center gap-2">
                  <Loader2 className="!h-3.5 !w-3.5 text-[var(--primary-color)] animate-spin" />
                  {t('common.loading')}
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="text-sm text-[#666] italic">
                  {t('stylist.noEventsToday', { defaultValue: 'No events scheduled for today.' })}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {calendarEvents.slice(0, 4).map((evt, idx) => (
                    <div key={idx} className="text-[13px] flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2f6e51] flex-shrink-0" />
                      <span className="font-semibold text-[#1a1a1a] whitespace-nowrap overflow-hidden text-ellipsis">{evt.summary}</span>
                      {evt.start?.dateTime && (
                        <span className="text-[11.5px] text-[#9a9a92] ms-auto font-medium">
                          {new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))}
                  {calendarEvents.length > 4 && (
                    <div className="text-xs text-[#9a9a92] ps-4">
                      {t('stylist.moreEvents', { defaultValue: `+${calendarEvents.length - 4} more events`, count: calendarEvents.length - 4 })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3.5">
            <div className="text-base font-extrabold text-[var(--dark-color)]">
              {t('stylist.outfitPreferences', { defaultValue: 'Outfit Preferences' })}
            </div>
            <div className="relative">
              <label className="text-[14px] font-semibold text-text-brand mb-[15px] block leading-none">
                {t('stylist.tagFilterLabel', { defaultValue: 'Tag' })}
              </label>
              <div className="relative flex items-center">
                <ShoppingBag className="absolute start-[14px] top-[16px] !h-3.5 !w-3.5 text-[var(--primary-color)] pointer-events-none" />
                <Input
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowSuggestions(true);
                    if (!e.target.value) setSelectedTag('');
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={t('stylist.tagFilterPlaceholder', { defaultValue: 'e.g. Work, Gym, Casual' })}
                  className="!ps-[35px]"
                  disabled={isSpinning}
                />
                {tagInput && (
                  <button
                    onClick={() => {
                      setTagInput('');
                      setSelectedTag('');
                    }}
                    className="absolute end-3 text-primary-brand bg-transparent border-none cursor-pointer flex hover:text-[#1a1a1a]"
                  >
                    <X className="!h-3.5 !w-3.5" />
                  </button>
                )}
              </div>

              {showSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute z-20 inset-x-0 max-h-[170px] overflow-y-auto bg-white border border-[#ece7de] rounded-[12px] shadow-[0_10px_24px_rgba(0,0,0,0.08)] p-1.5">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setTagInput(tag);
                        setSelectedTag(tag);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-start px-3 py-[9px] text-[12.5px] text-[#1a1a1a] bg-transparent border-none rounded-lg cursor-pointer transition-colors duration-150 hover:bg-[#f0f7f3] hover:text-[#2f6e51]"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-[14px] font-semibold text-text-brand mb-[15px] block leading-none">
                {t('stylist.styleFilterLabel', { defaultValue: 'Style' })}
              </label>
              <Select
                value={selectedStyle}
                onValueChange={setSelectedStyle}
                disabled={isSpinning}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("stylist.selectStyle", { defaultValue: "Select Style" })} />
                </SelectTrigger>
                <SelectContent>
                  {DRESS_CODE_OPTIONS.map((style) => (
                    <SelectItem
                      key={style}
                      value={style}
                      className="text-[12px] rounded-[12px] font-semibold px-2.5 py-[9px] text-text-brand hover:bg-primary-brand hover:text-white"
                    >
                      {style === "all" ? t("taxonomy.dress_code.all", { defaultValue: "All Styles" }) : labelForDressCode(style, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT PANEL: 6 Dedicated Carousels ============ */}
      <div className="md:col-span-3">
        <div className="bg-white rounded-[20px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] p-5 flex flex-col">
          <div className="flex items-start justify-between gap-4 flex-wrap max-[480px]:gap-2 mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary-color)]">
                <Sparkles className="!h-3.5 !w-3.5 text-[var(--primary-color)]" />
                <span>{t('stylist.aiOutfitBuilder', { defaultValue: 'AI Outfit Builder' })}</span>
              </div>
              <h2 className="text-xl font-extrabold text-[var(--dark-color)] mt-2.5 mb-1 max-[480px]:text-[16px]">
                {t('stylist.createTodaysLook', { defaultValue: "Create today's look" })}
              </h2>
              <p className="text-sm text-[var(--text-color)] leading-[22px] font-semibold max-[480px]:mb-2">
                {t('stylist.swipeOrLetAi', { defaultValue: 'Swipe through your wardrobe or let AI select an outfit.' })}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAvatarPreviewOpen(true)}
                className="rounded-full px-3.5 py-1.5 text-xs font-bold border-primary-brand text-primary-brand hover:bg-primary-brand hover:text-white transition-colors"
              >
                <Eye className="h-3.5 w-3.5 me-1" />
                {t('stylist.tryOnAvatar', { defaultValue: 'Try on Avatar' })}
              </Button>
              <div className="flex items-center gap-1.5 border border-[#ece7de] rounded-full px-3.5 py-1.5 text-[12px] font-bold text-[#1a1a1a] bg-white whitespace-nowrap">
                <ShoppingBag className="!h-3.5 !w-3.5" />
                <span>{t('stylist.itemsCount', { defaultValue: `${items.length} items`, count: items.length })}</span>
              </div>
            </div>
          </div>

          {/* Mode Switch Pills */}
          <div className="flex items-center gap-2 mb-4 p-1 bg-muted/30 rounded-xl w-fit border border-border">
            <button
              type="button"
              onClick={() => setIsFullBodyMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isFullBodyMode
                  ? 'bg-white text-dark-brand shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shirt className="h-3.5 w-3.5" />
              <span>{t('stylist.modeSeparates', { defaultValue: 'Separates (Top & Bottom)' })}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullBodyMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isFullBodyMode
                  ? 'bg-white text-dark-brand shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkle className="h-3.5 w-3.5" />
              <span>{t('stylist.modeFullBody', { defaultValue: 'Full Body (Dress / Jumpsuit / Sari)' })}</span>
            </button>
          </div>

          {/* 6 Carousels */}
          <div className="flex flex-col gap-3.5 w-full" data-testid="shuffler-carousels-container">
            {/* 1. Outerwear Carousel */}
            {renderRow(
              'outerwear',
              labelForRole('outerwear', t),
              filteredOuterwears,
              outerwearFocusIdx,
              outerwearSelectedIdx,
              setOuterwearSelectedIdx,
              setOuterwearApi,
              outerwearApi,
              {
                isOptional: true,
                isIncluded: includeOuterwear,
                onToggleInclude: setIncludeOuterwear,
              }
            )}

            {/* 2. Full Body Carousel */}
            {renderRow(
              'full_body',
              t('taxonomy.categories.full_body', { defaultValue: 'Full Body' }),
              filteredFullBodies,
              fullBodyFocusIdx,
              fullBodySelectedIdx,
              setFullBodySelectedIdx,
              setFullBodyApi,
              fullBodyApi,
              {
                isRestricted: !isFullBodyMode,
                restrictionLabel: t('stylist.restrictedBySeparates', { defaultValue: 'Disabled for Top & Bottom separates' }),
                onUnlock: () => setIsFullBodyMode(true),
              }
            )}

            {/* 3. Top Carousel */}
            {renderRow(
              'top',
              labelForRole('top', t),
              filteredTops,
              topFocusIdx,
              topSelectedIdx,
              setTopSelectedIdx,
              setTopApi,
              topApi,
              {
                isRestricted: isFullBodyMode,
                restrictionLabel: t('stylist.restrictedByFullBody', { defaultValue: 'Disabled for Full-Body looks' }),
                onUnlock: () => setIsFullBodyMode(false),
              }
            )}

            {/* 4. Bottom Carousel */}
            {renderRow(
              'bottom',
              labelForRole('bottom', t),
              filteredBottoms,
              bottomFocusIdx,
              bottomSelectedIdx,
              setBottomSelectedIdx,
              setBottomApi,
              bottomApi,
              {
                isRestricted: isFullBodyMode,
                restrictionLabel: t('stylist.restrictedByFullBody', { defaultValue: 'Disabled for Full-Body looks' }),
                onUnlock: () => setIsFullBodyMode(false),
              }
            )}

            {/* 5. Shoes Carousel */}
            {renderRow(
              'shoes',
              labelForRole('shoes', t),
              filteredShoes,
              shoeFocusIdx,
              shoeSelectedIdx,
              setShoeSelectedIdx,
              setShoeApi,
              shoeApi
            )}

            {/* 6. Accessories Carousel */}
            {renderRow(
              'accessories',
              labelForRole('accessory', t),
              filteredAccessories,
              accessoryFocusIdx,
              accessorySelectedIdx,
              setAccessorySelectedIdx,
              setAccessoryApi,
              accessoryApi,
              {
                isOptional: true,
                isIncluded: includeAccessory,
                onToggleInclude: setIncludeAccessory,
              }
            )}
          </div>

          {aiRationale && (
            <div className="p-[16px_18px] rounded-2xl border border-accent/20 bg-accent/5 text-start mt-4">
              <span className="text-[13px] font-bold text-accent flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                {t('stylist.aiRationale', { defaultValue: "Stylist's Advice" })}
              </span>
              <p className="text-[13.5px] text-foreground font-medium leading-[1.65]">
                {aiRationale}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-5">
            <Button
              onClick={handleShuffle}
              disabled={isSpinning}
              data-testid="shuffler-generate-btn"
              className="h-auto w-full rounded-full border-0 bg-[var(--primary-color)] px-7 py-3 font-sans text-sm font-medium text-white shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--primary-hover)] hover:text-white hover:shadow-[0_10px_30px_rgba(31,92,69,0.22)]"
            >
              <Sparkles className={`!h-3.5 !w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
              {t('stylist.refreshScout', { defaultValue: 'Generate New Outfit' })}
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || isSpinning || currentOutfitPieces.length === 0}
              variant="outline"
              data-testid="shuffler-save-btn"
              className="w-full h-auto rounded-full border border-black/10 bg-white px-7 py-3 font-sans text-sm font-semibold text-[var(--dark-color)] shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-[var(--primary-color)] hover:shadow-[var(--shadow-medium)]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Save className="h-4 w-4 me-2" />}
              {t('common.save', { defaultValue: 'Save Outfit' })}
            </Button>
          </div>
        </div>
      </div>

      {/* Item Detail Floater */}
      <ItemFloater itemId={activeFloaterItemId} onClose={handleCloseFloater} fromOutfits={true} />

      {/* Live Avatar Try-On Modal */}
      <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-dark-brand flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-brand" />
              {t('stylist.tryOnAvatar', { defaultValue: 'Try on Avatar' })}
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-[4/5] bg-[#ece7de]/30 rounded-xl overflow-hidden border border-border my-2 flex items-center justify-center">
            <AvatarViewer
              shapeParams={user?.avatar_shape_params || {}}
              measurements={user?.body_measurements || user?.measurements}
              skinColor={user?.skin_tone}
              sex={user?.sex || 'female'}
              outfitItems={avatarPiecesMap}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center py-1">
            {currentOutfitPieces.map(({ item, roleKey }, idx) => (
              <span key={idx} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted border border-border text-foreground flex items-center gap-1">
                <span className="capitalize text-muted-foreground">{roleKey}:</span>
                <span className="truncate max-w-[120px]">{item.title || item.name}</span>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              onClick={() => {
                setAvatarPreviewOpen(false);
                handleSave();
              }}
              className="w-full rounded-full"
            >
              <Save className="h-4 w-4 me-1.5" />
              {t('common.save', { defaultValue: 'Save Outfit' })}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAvatarPreviewOpen(false)}
              className="rounded-full px-5"
            >
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
