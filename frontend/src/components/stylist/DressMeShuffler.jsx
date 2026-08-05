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
      <div className="shuffler-row-card">
        <div className="shuffler-row-header">
          {rowIcons[roleKey]}
          <span className="shuffler-row-label">{label}</span>
        </div>
        <div className="shuffler-row-carousel-wrap">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: true, watchDrag: !isSpinning, dragFree: true, direction: i18n.dir() }}
            className="shuffler-carousel"
          >
            <CarouselContent className="shuffler-carousel-content">
              {hasItems ? (
                duplicatedList.map((item, itemIdx) => {
                  const imageUrl = bestImageUrl(item);
                  const isFocused = itemIdx === focusIdx;
                  const isSelected = itemIdx === selectedIdx;
                  return (
                    <CarouselItem
                      key={`${item.id}-${itemIdx}`}
                      className="shuffler-carousel-item"
                      onClick={() => !isSpinning && handleItemClick(itemIdx, item)}
                    >
                      <div
                        className={
                          `shuffler-thumb ${isFocused ? 'shuffler-thumb--focused' : 'shuffler-thumb--unfocused'} ${isSelected ? 'shuffler-thumb--selected' : ''}`
                        }
                      >
                        {isSelected && (
                          <span className="shuffler-check-badge">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name || label}
                            className="shuffler-thumb-img"
                            draggable={false}
                          />
                        ) : (
                          <div className="shuffler-thumb-empty">
                            <ImageOff className="shuffler-icon-sm" />
                            <span className="shuffler-thumb-empty-label">
                              {item.name || item.title || t('common.garment', { defaultValue: 'Garment' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </CarouselItem>
                  );
                })
              ) : (
                <CarouselItem className="shuffler-carousel-item shuffler-carousel-item--full">
                  <div className="shuffler-thumb-noresults">
                    <div className="shuffler-thumb-noresults-inner">
                      <ImageOff className="shuffler-icon-sm" />
                      <span className="shuffler-thumb-noresults-label">{t('common.noResults')}</span>
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
                  className="shuffler-nav-btn shuffler-nav-btn--prev"
                  disabled={isSpinning}
                  onClick={() => api?.scrollPrev()}
                >
                  <ChevronLeft className="shuffler-icon-xs" />
                  <span className="shuffler-sr-only">{t('components.dressMeShuffler.previous_slide', { defaultValue: 'Previous slide' })}</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="shuffler-nav-btn shuffler-nav-btn--next"
                  disabled={isSpinning}
                  onClick={() => api?.scrollNext()}
                >
                  <ChevronRight className="shuffler-icon-xs" />
                  <span className="shuffler-sr-only">{t('components.dressMeShuffler.next_slide', { defaultValue: 'Next slide' })}</span>
                </Button>
              </>
            )}
          </Carousel>
        </div>
      </div>
    );
  };

  return (
    <div className="row gx-3 gy-4">
      <div className="col-md-3">
        {/* ============ LEFT PANEL: Planner ============ */}
        <div className="shuffler-planner-card">
          <div className="shuffler-panel-eyebrow">
            <Sparkles className="shuffler-icon-sm shuffler-icon-accent" />
            <span>{t('stylist.personalStylist', { defaultValue: 'Personal Stylist' })}</span>
          </div>
          <h2 className="shuffler-panel-title">{t('stylist.planYourOutfit', { defaultValue: 'Plan Your Outfit' })}</h2>
          <p className="shuffler-panel-subtitle">
            {t('stylist.planYourOutfitDesc', { defaultValue: 'Choose your schedule, style and preferred tag.' })}
          </p>
          <Button variant="outline" onClick={onOpenCalendar} className="shuffler-calendar-btn" data-testid="stylist-open-calendar-btn" disabled={isSpinning}>
            <CalendarDays className="shuffler-icon-sm shuffler-icon-accent" />
            <span>{t('calendar.viewCalendar', { defaultValue: 'View 7-Day Planner' })}</span>
            <ChevronRight className="shuffler-icon-xs shuffler-calendar-chevron" />
          </Button>
          <div className="shuffler-toggle-card">
            <div className="shuffler-toggle-left">
              <CalendarDays className="shuffler-icon-md shuffler-icon-accent"/>
              <div className="shuffler-toggle-text">
                <Label htmlFor="include-calendar" className="shuffler-toggle-label">
                  {t('stylist.todayEvents', { defaultValue: "Today's Agenda" })}
                </Label>
                <span className="shuffler-toggle-sub">
                  {includeCalendar
                    ? t('stylist.calendarSyncOn', { defaultValue: 'Syncing calendar items' })
                    : t('stylist.calendarSyncOff', { defaultValue: 'Toggle to check events' })}
                </span>
              </div>
            </div>
            <Switch id="include-calendar" checked={includeCalendar} onCheckedChange={setIncludeCalendar} disabled={isSpinning}/>
          </div>
          {includeCalendar && (
            <div className="shuffler-agenda">
              <div className="shuffler-agenda-title">
                {t('stylist.todaysAgenda', { defaultValue: "Today's Schedule" })}
              </div>
              {calendarLoading ? (
                <div className="shuffler-agenda-loading">
                  <Loader2 className="shuffler-icon-sm shuffler-icon-accent shuffler-spin" />
                  {t('common.loading')}
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="shuffler-agenda-empty">
                  {t('stylist.noEventsToday', { defaultValue: 'No events scheduled for today.' })}
                </div>
              ) : (
                <div className="shuffler-agenda-list">
                  {calendarEvents.slice(0, 4).map((evt, idx) => (
                    <div key={idx} className="shuffler-agenda-item">
                      <span className="shuffler-agenda-dot" />
                      <span className="shuffler-agenda-name">{evt.summary}</span>
                      {evt.start?.dateTime && (
                        <span className="shuffler-agenda-time">
                          {new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))}
                  {calendarEvents.length > 4 && (
                    <div className="shuffler-agenda-more">
                      {t('stylist.moreEvents', { defaultValue: `+${calendarEvents.length - 4} more events`, count: calendarEvents.length - 4 })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="shuffler-preferences-card">
            <div className="shuffler-preferences-title">
              {t('stylist.outfitPreferences', { defaultValue: 'Outfit Preferences' })}
            </div>
            <div className="shuffler-filter-tag">
              <label className="shuffler-filter-label">
                {t('stylist.tagFilterLabel', { defaultValue: 'Tag' })}
              </label>
              <div className="shuffler-filter-input-wrap">
                <ShoppingBag className="shuffler-input-icon" />
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
                  className="createlisting-input"
                  disabled={isSpinning}
                />
                {tagInput && (
                  <button
                    onClick={() => {
                      setTagInput('');
                      setSelectedTag('');
                    }}
                    className="shuffler-filter-clear">
                    <X className="shuffler-icon-sm" />
                  </button>
                )}
              </div>

              {showSuggestions && tagSuggestions.length > 0 && (
                <div className="shuffler-tag-suggestions">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setTagInput(tag);
                        setSelectedTag(tag);
                        setShowSuggestions(false);
                      }}
                      className="shuffler-tag-suggestion-item"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="shuffler-filter-style">
              <label className="shuffler-filter-label">
                {t('stylist.styleFilterLabel', { defaultValue: 'Style' })}
              </label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isSpinning}>
                <SelectTrigger className="createlisting-select">
                  <SelectValue placeholder={t('stylist.selectStyle', { defaultValue: 'Select Style' })} />
                </SelectTrigger>
                <SelectContent>
                  {DRESS_CODE_OPTIONS.map((style) => (
                    <SelectItem key={style} value={style} className="shuffler-select-item">
                      {style === 'all'
                        ? t('taxonomy.dress_code.all', { defaultValue: 'All Styles' })
                        : labelForDressCode(style, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-9">
        {/* ============ RIGHT PANEL: Builder ============ */}
        <div className="shuffler-builder-card">
          <div className="shuffler-builder-header">
            <div>
              <div className="shuffler-panel-eyebrow">
                <Sparkles className="shuffler-icon-sm shuffler-icon-accent" />
                <span>{t('stylist.aiOutfitBuilder', { defaultValue: 'AI Outfit Builder' })}</span>
              </div>
              <h2 className="shuffler-panel-title">{t('stylist.createTodaysLook', { defaultValue: "Create today's look" })}</h2>
              <p className="shuffler-panel-subtitle">
                {t('stylist.swipeOrLetAi', { defaultValue: 'Swipe through your wardrobe or let AI select an outfit.' })}
              </p>
            </div>
            <div className="shuffler-items-badge">
              <ShoppingBag className="shuffler-icon-sm" />
              <span>{t('stylist.itemsCount', { defaultValue: `${items.length} items`, count: items.length })}</span>
            </div>
          </div>

          <div className="shuffler-rows">
            {renderRow('top', labelForRole('top', t), filteredTops, topFocusIdx, topSelectedIdx, setTopSelectedIdx, setTopApi, topApi)}
            {renderRow('bottom', labelForRole('bottom', t), filteredBottoms, bottomFocusIdx, bottomSelectedIdx, setBottomSelectedIdx, setBottomApi, bottomApi)}
            {renderRow('shoes', labelForRole('shoes', t), filteredShoes, shoeFocusIdx, shoeSelectedIdx, setShoeSelectedIdx, setShoeApi, shoeApi)}
          </div>

          {aiRationale && (
            <div className="shuffler-rationale-card">
              <span className="shuffler-rationale-title">
                {t('stylist.aiRationale', { defaultValue: "Stylist's Advice" })}
              </span>
              <p className="shuffler-rationale-text">
                {aiRationale}
              </p>
            </div>
          )}
          <div className="shuffler-actions">
            <Button
              onClick={handleShuffle}
              disabled={isSpinning}
              className="custm-btn w-100"
            >
              <Sparkles className={`shuffler-icon-sm ${isSpinning ? 'shuffler-spin' : ''}`} />
              {t('stylist.refreshScout', { defaultValue: 'Generate New Outfit' })}
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || isSpinning || (filteredTops.length === 0 && filteredBottoms.length === 0 && filteredShoes.length === 0)}
              variant="outline"
              className="btn-premium-secondary w-100"
            >
              {t('common.save', { defaultValue: 'Save Outfit' })}
            </Button>
          </div>
        </div>
      </div>
      <ItemFloater itemId={activeFloaterItemId} onClose={handleCloseFloater} fromOutfits={true} />
    </div>
  );
}