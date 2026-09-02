import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save, ImageOff, ChevronLeft, ChevronRight, X, CalendarDays, Loader2, Shirt, Layers, Footprints, ShoppingBag } from 'lucide-react';
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

const DRESS_CODE_OPTIONS = ['all', 'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear'];

export default function DressMeShuffler({ onSaveSuccess, onOpenCalendar }) {
  const { t, i18n } = useTranslation();
  const rawItems = useClosetItems({ prewarm: true });
  const items = (rawItems || []).filter(Boolean);
  const { calendarEvents: cachedCalendarEvents, prewarm: prewarmDaily } = useDailySuggestionsStore();

  const [selectedStyle, setSelectedStyle] = useStoreState(shufflerUIStore, 'selectedStyle');
  const [tagInput, setTagInput] = useStoreState(shufflerUIStore, 'tagInput');
  const [selectedTag, setSelectedTag] = useStoreState(shufflerUIStore, 'selectedTag');
  const [showSuggestions, setShowSuggestions] = useStoreState(shufflerUIStore, 'showSuggestions');

  // New States for Weather, Location, Calendar, Rationale
  const [coords, setCoords] = useStoreState(shufflerUIStore, 'coords');
  const [weather, setWeather] = useStoreState(shufflerUIStore, 'weather');
  const [includeWeather, setIncludeWeather] = useStoreState(shufflerUIStore, 'includeWeather');
  const [includeCalendar, setIncludeCalendar] = useStoreState(shufflerUIStore, 'includeCalendar');
  const [calendarEvents, setCalendarEvents] = useStoreState(shufflerUIStore, 'calendarEvents');
  const [calendarLoading, setCalendarLoading] = useStoreState(shufflerUIStore, 'calendarLoading');
  const [aiRationale, setAiRationale] = useStoreState(shufflerUIStore, 'aiRationale');

  // Switchable Calendar Events Sync (Uses cached store)
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

  // Suggestions filtered by input text
  const tagSuggestions = tagInput
    ? allUniqueTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && t !== selectedTag)
    : allUniqueTags;

  // Categorize items
  const tops = items.filter(it => it.category === 'Top' || it.category === 'Outerwear' || it.category === 'Full Body');
  const bottoms = items.filter(it => it.category === 'Bottom');
  const shoes = items.filter(it => it.category === 'Footwear');

  const filteredTops = tops.filter(it => {
    if (selectedStyle && selectedStyle !== 'all' && it.dress_code !== selectedStyle) return false;
    if (selectedTag && (!Array.isArray(it.tags) || !it.tags.includes(selectedTag))) return false;
    return true;
  });
  const filteredBottoms = bottoms.filter(it => {
    if (selectedStyle && selectedStyle !== 'all' && it.dress_code !== selectedStyle) return false;
    if (selectedTag && (!Array.isArray(it.tags) || !it.tags.includes(selectedTag))) return false;
    return true;
  });
  const filteredShoes = shoes.filter(it => {
    if (selectedStyle && selectedStyle !== 'all' && it.dress_code !== selectedStyle) return false;
    if (selectedTag && (!Array.isArray(it.tags) || !it.tags.includes(selectedTag))) return false;
    return true;
  });

  // List duplication helper to enable Embla infinite loop / scrolling for small datasets
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

  const duplicatedTops = getDuplicatedList(filteredTops);
  const duplicatedBottoms = getDuplicatedList(filteredBottoms);
  const duplicatedShoes = getDuplicatedList(filteredShoes);

  // Focus tracking (which item is currently centered in each row)
  const [topFocusIdx, setTopFocusIdx] = useStoreState(shufflerUIStore, 'topFocusIdx');
  const [bottomFocusIdx, setBottomFocusIdx] = useStoreState(shufflerUIStore, 'bottomFocusIdx');
  const [shoeFocusIdx, setShoeFocusIdx] = useStoreState(shufflerUIStore, 'shoeFocusIdx');

  // Selection tracking (which item has been picked/selected)
  const [topSelectedIdx, setTopSelectedIdx] = useStoreState(shufflerUIStore, 'topSelectedIdx');
  const [bottomSelectedIdx, setBottomSelectedIdx] = useStoreState(shufflerUIStore, 'bottomSelectedIdx');
  const [shoeSelectedIdx, setShoeSelectedIdx] = useStoreState(shufflerUIStore, 'shoeSelectedIdx');

  // Active item detail floater
  const [activeFloaterItemId, setActiveFloaterItemId] = useStoreState(shufflerUIStore, 'activeFloaterItemId');

  const [topApi, setTopApi] = useState(null);
  const [bottomApi, setBottomApi] = useState(null);
  const [shoeApi, setShoeApi] = useState(null);

  const [isSpinning, setIsSpinning] = useStoreState(shufflerUIStore, 'isSpinning');
  const [saving, setSaving] = useStoreState(shufflerUIStore, 'saving');

  const lastFilterRef = useRef({ style: selectedStyle, tag: selectedTag });

  // Reset focus index and scrolls on style/tag filter change
  useEffect(() => {
    const styleChanged = lastFilterRef.current.style !== selectedStyle;
    const tagChanged = lastFilterRef.current.tag !== selectedTag;

    if (styleChanged || tagChanged) {
      setTopFocusIdx(0);
      setBottomFocusIdx(0);
      setShoeFocusIdx(0);
      setTopSelectedIdx(null);
      setBottomSelectedIdx(null);
      setShoeSelectedIdx(null);
      setActiveFloaterItemId(null);

      if (topApi && filteredTops.length > 0) topApi.scrollTo(0, false);
      if (bottomApi && filteredBottoms.length > 0) bottomApi.scrollTo(0, false);
      if (shoeApi && filteredShoes.length > 0) shoeApi.scrollTo(0, false);

      lastFilterRef.current = { style: selectedStyle, tag: selectedTag };
    }
  }, [selectedStyle, selectedTag, topApi, bottomApi, shoeApi, filteredTops.length, filteredBottoms.length, filteredShoes.length]);

  // Sync initial indices when items load
  useEffect(() => {
    if (duplicatedTops.length > 0 && topFocusIdx >= duplicatedTops.length) setTopFocusIdx(0);
    if (duplicatedBottoms.length > 0 && bottomFocusIdx >= duplicatedBottoms.length) setBottomFocusIdx(0);
    if (duplicatedShoes.length > 0 && shoeFocusIdx >= duplicatedShoes.length) setShoeFocusIdx(0);
  }, [duplicatedTops.length, duplicatedBottoms.length, duplicatedShoes.length, topFocusIdx, bottomFocusIdx, shoeFocusIdx]);

  // Global handler to clear selections and close floater when user starts scrolling any carousel
  const handleStartScroll = () => {
    setTopSelectedIdx(null);
    setBottomSelectedIdx(null);
    setShoeSelectedIdx(null);
    setActiveFloaterItemId(null);
  };

  // Sync Carousel API -> State (when user scrolls/swipes)
  useEffect(() => {
    if (!topApi) return;
    const onSelect = () => {
      setTopFocusIdx(topApi.selectedScrollSnap());
    };
    const onPointerUp = () => {
      const engine = topApi.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    topApi.on('select', onSelect);
    topApi.on('scroll', handleStartScroll);
    topApi.on('pointerUp', onPointerUp);
    return () => {
      topApi.off('select', onSelect);
      topApi.off('scroll', handleStartScroll);
      topApi.off('pointerUp', onPointerUp);
    };
  }, [topApi]);

  useEffect(() => {
    if (!bottomApi) return;
    const onSelect = () => {
      setBottomFocusIdx(bottomApi.selectedScrollSnap());
    };
    const onPointerUp = () => {
      const engine = bottomApi.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    bottomApi.on('select', onSelect);
    bottomApi.on('scroll', handleStartScroll);
    bottomApi.on('pointerUp', onPointerUp);
    return () => {
      bottomApi.off('select', onSelect);
      bottomApi.off('scroll', handleStartScroll);
      bottomApi.off('pointerUp', onPointerUp);
    };
  }, [bottomApi]);

  useEffect(() => {
    if (!shoeApi) return;
    const onSelect = () => {
      setShoeFocusIdx(shoeApi.selectedScrollSnap());
    };
    const onPointerUp = () => {
      const engine = shoeApi.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    shoeApi.on('select', onSelect);
    shoeApi.on('scroll', handleStartScroll);
    shoeApi.on('pointerUp', onPointerUp);
    return () => {
      shoeApi.off('select', onSelect);
      shoeApi.off('scroll', handleStartScroll);
      shoeApi.off('pointerUp', onPointerUp);
    };
  }, [shoeApi]);

  // Sync State -> Carousel API (when user triggers selection click or shuffle)
  useEffect(() => {
    if (topApi && duplicatedTops.length > 0 && topSelectedIdx !== null) {
      if (topApi.selectedScrollSnap() !== topSelectedIdx) {
        topApi.scrollTo(topSelectedIdx, isSpinning);
      }
    }
  }, [topSelectedIdx, topApi, duplicatedTops.length, isSpinning]);

  useEffect(() => {
    if (bottomApi && duplicatedBottoms.length > 0 && bottomSelectedIdx !== null) {
      if (bottomApi.selectedScrollSnap() !== bottomSelectedIdx) {
        bottomApi.scrollTo(bottomSelectedIdx, isSpinning);
      }
    }
  }, [bottomSelectedIdx, bottomApi, duplicatedBottoms.length, isSpinning]);

  useEffect(() => {
    if (shoeApi && duplicatedShoes.length > 0 && shoeSelectedIdx !== null) {
      if (shoeApi.selectedScrollSnap() !== shoeSelectedIdx) {
        shoeApi.scrollTo(shoeSelectedIdx, isSpinning);
      }
    }
  }, [shoeSelectedIdx, shoeApi, duplicatedShoes.length, isSpinning]);

  // AI-driven, weather- and calendar-aware shuffler scout
  const handleShuffle = async () => {
    if (isSpinning) return;

    handleStartScroll();
    setIsSpinning(true);
    setAiRationale('');

    let spinCount = 0;
    const spinTimer = setInterval(() => {
      if (duplicatedTops.length > 1) {
        topApi?.scrollTo(Math.floor(Math.random() * duplicatedTops.length), true);
      }
      if (duplicatedBottoms.length > 1) {
        bottomApi?.scrollTo(Math.floor(Math.random() * duplicatedBottoms.length), true);
      }
      if (duplicatedShoes.length > 1) {
        shoeApi?.scrollTo(Math.floor(Math.random() * duplicatedShoes.length), true);
      }
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

      if (res.weather_summary) {
        setWeatherSummary(res.weather_summary);
      }
      if (res.why) {
        setAiRationale(res.why);
      }

      if (res.top_id) {
        let tIdx = filteredTops.findIndex(it => it.id === res.top_id);
        if (tIdx === -1) {
          tIdx = tops.findIndex(it => it.id === res.top_id);
          if (tIdx !== -1) {
            setSelectedStyle('all');
            setSelectedTag('');
            setTagInput('');
          }
        }
        if (tIdx !== -1) {
          setTopFocusIdx(tIdx);
          topApi?.scrollTo(tIdx, true);
        }
      }

      if (res.bottom_id) {
        let bIdx = filteredBottoms.findIndex(it => it.id === res.bottom_id);
        if (bIdx === -1) {
          bIdx = bottoms.findIndex(it => it.id === res.bottom_id);
        }
        if (bIdx !== -1) {
          setBottomFocusIdx(bIdx);
          bottomApi?.scrollTo(bIdx, true);
        }
      }

      if (res.shoes_id) {
        let sIdx = filteredShoes.findIndex(it => it.id === res.shoes_id);
        if (sIdx === -1) {
          sIdx = shoes.findIndex(it => it.id === res.shoes_id);
        }
        if (sIdx !== -1) {
          setShoeFocusIdx(sIdx);
          shoeApi?.scrollTo(sIdx, true);
        }
      }

      toast.success(t('stylist.aiPlannerSuccess', { defaultValue: 'AI Scouting Complete! 1 Credit charged.' }), { duration: 3000 });
    } catch (err) {
      clearInterval(spinTimer);
      console.error('AI Planner Scout failed:', err);
      const detail = err.response?.data?.detail || '';
      if (detail.includes('quota') || detail.includes('exhausted') || err.response?.status === 402) {
        toast.error(t('stylist.quotaExhausted', { defaultValue: 'Quota Exhausted. Please check your credit balance or input your own API Key.' }), { duration: 5000 });
      } else {
        toast.error(err.response?.data?.detail || t('stylist.failedScout', { defaultValue: 'Failed to Scout: ensure you have enough items in closet.' }));
      }
    } finally {
      setIsSpinning(false);
    }
  };

  const handleSave = async () => {
    const selectedTop = filteredTops.length > 0 ? filteredTops[topFocusIdx % filteredTops.length] : null;
    const selectedBottom = filteredBottoms.length > 0 ? filteredBottoms[bottomFocusIdx % filteredBottoms.length] : null;
    const selectedShoe = filteredShoes.length > 0 ? filteredShoes[shoeFocusIdx % filteredShoes.length] : null;

    const outfitItems = [selectedTop, selectedBottom, selectedShoe].filter(Boolean);
    if (outfitItems.length === 0) {
      toast.error(t('common.error'));
      return;
    }

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

      if (colorStr) {
        return `${vibe} ${colorStr} ${season} ${suffix}`;
      } else {
        return `${vibe} ${season} ${suffix}`;
      }
    };

    const generateDescriptiveOutfitDescription = (items, translator) => {
      const titles = items.map(it => it.title || it.name || it.caption).filter(Boolean);
      if (titles.length === 0) return '';
      return translator('stylist.outfitDescriptionPattern', {
        defaultValue: `A carefully styled combination featuring ${titles.join(', ')}. Perfect for a coordinated and comfortable look.`,
        items: titles.join(', ')
      });
    };

    const descriptiveTitle = generateDescriptiveOutfitTitle(outfitItems, t);
    const descriptiveDesc = generateDescriptiveOutfitDescription(outfitItems, t);

    setSaving(true);
    const body = {
      name: descriptiveTitle,
      description: descriptiveDesc,
      source_workflow: 'scheduled',
      prompt: 'shuffled',
      garments: outfitItems.map(it => ({
        closet_item_id: it.id,
        role: it.category === 'Top' || it.category === 'Outerwear' ? 'top' : it.category === 'Bottom' ? 'bottom' : it.category === 'Footwear' ? 'shoes' : 'accessory',
        title: it.name || it.title || ''
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
    setTopSelectedIdx(null);
    setBottomSelectedIdx(null);
    setShoeSelectedIdx(null);
  };

  const rowIcons = {
    top: <Shirt className="shuffler-icon-sm shuffler-icon-accent" />,
    bottom: <Layers className="shuffler-icon-sm shuffler-icon-accent" />,
    shoes: <Footprints className="shuffler-icon-sm shuffler-icon-accent" />,
  };

  const renderRow = (roleKey, label, list, focusIdx, selectedIdx, setIdx, setApi, api) => {
    const hasItems = list.length > 0;
    const duplicatedList = getDuplicatedList(list);

    const handleItemClick = (itemIdx, item) => {
      if (itemIdx === focusIdx) {
        setIdx(itemIdx);
        setActiveFloaterItemId(item.id);
      } else {
        api?.scrollTo(itemIdx);
      }
    };

    return (
      <div className="flex flex-col items-start bg-primary-shadow p-[18px] rounded-[12px] border border-border w-full">
        <div className="flex items-center gap-2 mb-3.5">
          {rowIcons[roleKey]}
          <span className="text-[12.5px] uppercase tracking-[0.06em] text-[#1f2b23] font-extrabold">{label}</span>
        </div>
        <div className="w-full relative px-10">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: true, watchDrag: !isSpinning, dragFree: true, direction: i18n.dir() }}
            className="w-full"
          >
            <CarouselContent className="-ms-2.5">
              {hasItems ? (
                duplicatedList.map((item, itemIdx) => {
                  const imageUrl = bestImageUrl(item);
                  const isFocused = itemIdx === focusIdx;
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

            {hasItems && list.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-8 start-0 rounded-full h-[34px] w-[34px] z-10 bg-white border border-[#ece7de] shadow-[0_2px_6px_rgba(0,0,0,0.06)] text-[#1a1a1a] flex items-center justify-center hover:bg-[#f6f4ef]"
                  disabled={isSpinning}
                  onClick={() => api?.scrollPrev()}
                > 
                  <ChevronLeft className="!h-4 !w-4" />
                  <span className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]">
                    {t('components.dressMeShuffler.previous_slide', { defaultValue: 'Previous slide' })}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-8 end-0 rounded-full h-[34px] w-[34px] z-10 bg-white border border-[#ece7de] shadow-[0_2px_6px_rgba(0,0,0,0.06)] text-[#1a1a1a] flex items-center justify-center hover:bg-[#f6f4ef]"
                  disabled={isSpinning}
                  onClick={() => api?.scrollNext()}
                >
                  <ChevronRight className="!h-4 !w-4" />
                  <span className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]">
                    {t('components.dressMeShuffler.next_slide', { defaultValue: 'Next slide' })}
                  </span>
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
      <div className="md:col-span-1">
        {/* ============ LEFT PANEL: Planner ============ */}
        <div className="bg-white rounded-[20px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary-color)]">
            <Sparkles className="!h-3.5 !w-3.5 text-[var(--primary-color)]" />
            <span>{t('stylist.personalStylist', { defaultValue: 'Personal Stylist' })}</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--dark-color)] mt-2.5 mb-1">
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
            <ChevronRight className="chevron-accent absolute right-4 !h-4 !w-4 text-[var(--primary-color)]" />
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
                <ShoppingBag className="absolute left-[14px] top-[16px] !h-3.5 !w-3.5 text-[var(--primary-color)] pointer-events-none" />
                <Input
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowSuggestions(true);
                    if (!e.target.value) {
                      setSelectedTag('');
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  placeholder={t('stylist.tagFilterPlaceholder', { defaultValue: 'e.g. Work, Gym, Casual' })}
                  className="!pl-[35px]"
                  disabled={isSpinning}
                />
                {tagInput && (
                  <button
                    onClick={() => {
                      setTagInput('');
                      setSelectedTag('');
                    }}
                    className="absolute right-3 text-primary-brand bg-transparent border-none cursor-pointer flex hover:text-[#1a1a1a]"
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
                <SelectTrigger
                >
                  <SelectValue
                    placeholder={t("stylist.selectStyle", {
                      defaultValue: "Select Style",
                    })}
                  />
                </SelectTrigger>

                <SelectContent>
                  {DRESS_CODE_OPTIONS.map((style) => (
                    <SelectItem
                      key={style}
                      value={style}
                      className="
                        text-[12px]
                        rounded-[12px]
                        font-semibold
                        px-2.5
                        py-[9px]
                        text-text-brand
                        hover:bg-primary-brand
                        hover:text-white
                      "
                    >
                      {style === "all"
                        ? t("taxonomy.dress_code.all", {
                          defaultValue: "All Styles",
                        })
                        : labelForDressCode(style, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      <div className="md:col-span-3">
        {/* ============ RIGHT PANEL: Builder ============ */}
        <div className="bg-white rounded-[20px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] p-5 flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary-color)]">
                <Sparkles className="!h-3.5 !w-3.5 text-[var(--primary-color)]" />
                <span>{t('stylist.aiOutfitBuilder', { defaultValue: 'AI Outfit Builder' })}</span>
              </div>
              <h2 className="text-xl font-extrabold text-[var(--dark-color)] mt-2.5 mb-1">
                {t('stylist.createTodaysLook', { defaultValue: "Create today's look" })}
              </h2>
              <p className="mb-5 text-sm text-[var(--text-color)] leading-[22px] font-semibold">
                {t('stylist.swipeOrLetAi', { defaultValue: 'Swipe through your wardrobe or let AI select an outfit.' })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 border border-[#ece7de] rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-[#1a1a1a] bg-white whitespace-nowrap">
              <ShoppingBag className="!h-3.5 !w-3.5" />
              <span>{t('stylist.itemsCount', { defaultValue: `${items.length} items`, count: items.length })}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 w-full">
            {renderRow('top', labelForRole('top', t), filteredTops, topFocusIdx, topSelectedIdx, setTopSelectedIdx, setTopApi, topApi)}
            {renderRow('bottom', labelForRole('bottom', t), filteredBottoms, bottomFocusIdx, bottomSelectedIdx, setBottomSelectedIdx, setBottomApi, bottomApi)}
            {renderRow('shoes', labelForRole('shoes', t), filteredShoes, shoeFocusIdx, shoeSelectedIdx, setShoeSelectedIdx, setShoeApi, shoeApi)}
          </div>

          {aiRationale && (
            <div className="p-[16px_18px] rounded-2xl border border-[#e6dcf5] bg-[#f6f1fb] text-start">
              <span className="text-[13px] font-bold text-[#7c4fd6] flex items-center gap-1.5 mb-1.5 before:content-['✨'] before:text-xs">
                {t('stylist.aiRationale', { defaultValue: "Stylist's Advice" })}
              </span>
              <p className="text-[13.5px] text-[#33302e] font-medium leading-[1.65]">
                {aiRationale}
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 mt-5">
            <Button
              onClick={handleShuffle}
              disabled={isSpinning}
              className=" h-auto
              w-full
                          rounded-full
                          border-0
                          bg-[var(--primary-color)]
                          px-7
                          py-3
                          font-sans
                          text-sm
                          font-medium
                          text-white
                          shadow-none
                          transition-all
                          duration-300
                          hover:-translate-y-0.5
                          hover:bg-[var(--primary-hover)]
                          hover:text-white
                          hover:shadow-[0_10px_30px_rgba(31,92,69,0.22)]">
              <Sparkles className={`!h-3.5 !w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
              {t('stylist.refreshScout', { defaultValue: 'Generate New Outfit' })}
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || isSpinning || (filteredTops.length === 0 && filteredBottoms.length === 0 && filteredShoes.length === 0)}
              variant="outline"
              className="
              w-full
                        h-auto
                        rounded-full
                        border
                        border-black/10
                        bg-white
                        px-7
                        py-3
                        font-sans
                        text-sm
                        font-semibold
                        text-[var(--dark-color)]
                        shadow-none
                        transition-all
                        duration-300
                        hover:-translate-y-0.5
                        hover:bg-white
                        hover:text-[var(--primary-color)]
                        hover:shadow-[var(--shadow-medium)]">
              {t('common.save', { defaultValue: 'Save Outfit' })}
            </Button>
          </div>
        </div>
      </div>
      <ItemFloater itemId={activeFloaterItemId} onClose={handleCloseFloater} fromOutfits={true} />
    </div>
  );
}