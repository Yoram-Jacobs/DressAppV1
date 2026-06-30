import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save, ImageOff, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useClosetStore } from '@/lib/useClosetStore';
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
const DRESS_CODE_OPTIONS = ['all', 'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear'];

export default function DressMeShuffler({ onSaveSuccess }) {
  const { t } = useTranslation();
  const store = useClosetStore();
  const items = store.items || [];

  const [selectedStyle, setSelectedStyle] = useState('all');
  const [tagInput, setTagInput] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

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
  const [topFocusIdx, setTopFocusIdx] = useState(0);
  const [bottomFocusIdx, setBottomFocusIdx] = useState(0);
  const [shoeFocusIdx, setShoeFocusIdx] = useState(0);

  // Selection tracking (which item has been picked/selected)
  const [topSelectedIdx, setTopSelectedIdx] = useState(null);
  const [bottomSelectedIdx, setBottomSelectedIdx] = useState(null);
  const [shoeSelectedIdx, setShoeSelectedIdx] = useState(null);

  // Active item detail floater
  const [activeFloaterItemId, setActiveFloaterItemId] = useState(null);
  
  const [topApi, setTopApi] = useState(null);
  const [bottomApi, setBottomApi] = useState(null);
  const [shoeApi, setShoeApi] = useState(null);

  const [isSpinning, setIsSpinning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset focus index and scrolls on style/tag filter change
  useEffect(() => {
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
  // We only run scrollTo when a selection index changes to center it.
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

  // Slot machine spin animation
  const handleShuffle = () => {
    if (isSpinning) return;
    if (filteredTops.length === 0 && filteredBottoms.length === 0 && filteredShoes.length === 0) {
      toast.error(t('closet.emptySub'));
      return;
    }
    
    // Clear selection and close floater when starting shuffle
    handleStartScroll();

    setIsSpinning(true);
    let count = 0;
    const totalTicks = 8;
    const intervalTime = 80; // Total spin duration: 640ms (responsive feedback)

    const timer = setInterval(() => {
      if (duplicatedTops.length > 1) {
        const rand = Math.floor(Math.random() * duplicatedTops.length);
        setTopFocusIdx(rand);
        topApi?.scrollTo(rand, true);
      }
      if (duplicatedBottoms.length > 1) {
        const rand = Math.floor(Math.random() * duplicatedBottoms.length);
        setBottomFocusIdx(rand);
        bottomApi?.scrollTo(rand, true);
      }
      if (duplicatedShoes.length > 1) {
        const rand = Math.floor(Math.random() * duplicatedShoes.length);
        setShoeFocusIdx(rand);
        shoeApi?.scrollTo(rand, true);
      }

      count++;
      if (count >= totalTicks) {
        clearInterval(timer);
        setIsSpinning(false);
        toast.success(t('common.success'), { duration: 1500 });
      }
    }, intervalTime);
  };

  const handleSave = async () => {
    // Resolve to focused item in center of the carousels
    const selectedTop = filteredTops.length > 0 ? filteredTops[topFocusIdx % filteredTops.length] : null;
    const selectedBottom = filteredBottoms.length > 0 ? filteredBottoms[bottomFocusIdx % filteredBottoms.length] : null;
    const selectedShoe = filteredShoes.length > 0 ? filteredShoes[shoeFocusIdx % filteredShoes.length] : null;

    const outfitItems = [selectedTop, selectedBottom, selectedShoe].filter(Boolean);
    if (outfitItems.length === 0) {
      toast.error(t('common.error'));
      return;
    }

    // Generate a short, descriptive title
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

  const renderRow = (label, list, focusIdx, selectedIdx, setIdx, setApi, api) => {
    const hasItems = list.length > 0;
    const duplicatedList = getDuplicatedList(list);

    const handleItemClick = (itemIdx, item) => {
      if (itemIdx === focusIdx) {
        // Center item is clicked -> select it and open details floater
        setIdx(itemIdx);
        setActiveFloaterItemId(item.id);
      } else {
        // Side item is clicked -> center it (focused), but do not select it
        api?.scrollTo(itemIdx);
      }
    };

    return (
      <div className="flex flex-col items-center bg-card p-4 rounded-2xl border border-border shadow-sm w-full max-w-sm">
        <span className="caps-label text-xs text-muted-foreground font-medium mb-2">{label}</span>
        <div className="w-full relative px-10">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: true, watchDrag: !isSpinning, dragFree: true }}
            className="w-full"
          >
            <CarouselContent className="-ms-2">
              {hasItems ? (
                duplicatedList.map((item, itemIdx) => {
                  const imageUrl = bestImageUrl(item);
                  const isFocused = itemIdx === focusIdx;
                  const isSelected = itemIdx === selectedIdx;
                  return (
                    <CarouselItem 
                      key={`${item.id}-${itemIdx}`} 
                      className="ps-2 basis-1/3 flex items-center justify-center cursor-pointer"
                      onClick={() => !isSpinning && handleItemClick(itemIdx, item)}
                    >
                      <div className={`relative h-20 w-20 rounded-xl overflow-hidden flex items-center justify-center border transition-all duration-300 select-none ${
                        isFocused 
                          ? "scale-110 opacity-100 shadow-md z-10"
                          : "scale-90 opacity-40 hover:opacity-75 z-0"
                      } ${
                        isSelected
                          ? "border-brand bg-secondary/30"
                          : "border-border/40 bg-secondary/10"
                      }`}>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name || label}
                            className="max-h-full max-w-full object-contain pointer-events-none p-1.5"
                          />
                        ) : (
                          <div className="text-center text-muted-foreground p-1">
                            <ImageOff className="h-5 w-5 mx-auto mb-0.5 opacity-55" />
                            <span className="text-[8px] block truncate px-0.5 max-w-[60px]">
                              {item.name || item.title || t('common.garment', { defaultValue: 'Garment' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </CarouselItem>
                  );
                })
              ) : (
                <CarouselItem className="ps-2 basis-full flex items-center justify-center">
                  <div className="relative h-20 w-20 bg-secondary/30 rounded-xl overflow-hidden flex items-center justify-center border border-border/50 select-none">
                    <div className="text-center p-2 text-muted-foreground/60">
                      <ImageOff className="h-5 w-5 mx-auto mb-0.5 opacity-40" />
                      <span className="text-[9px] block font-medium">{t('common.noResults')}</span>
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
                  className="hidden md:flex absolute start-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 hover:bg-accent hover:text-accent-foreground z-10" 
                  disabled={isSpinning}
                  onClick={() => api?.scrollPrev()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">{t('components.dressMeShuffler.previous_slide', { defaultValue: 'Previous slide' })}</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden md:flex absolute end-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 hover:bg-accent hover:text-accent-foreground z-10" 
                  disabled={isSpinning}
                  onClick={() => api?.scrollNext()}
                >
                  <ChevronRight className="h-4 w-4" />
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
    <div className="flex flex-col items-center gap-6 py-4 w-full">
      <div className="w-full max-w-sm flex items-end gap-3 px-4 mb-2">
        {/* Tag Filter (Autocomplete) */}
        <div className="flex-[1.2] min-w-0 relative">
          <label className="text-[10px] caps-label text-muted-foreground font-semibold block mb-1.5 ps-1 text-start">
            {t('stylist.tagFilterLabel', { defaultValue: 'Tag' })}
          </label>
          <div className="relative">
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
                // Delay blur so click on suggestion registers first
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder={t('stylist.tagFilterPlaceholder', { defaultValue: 'e.g. Work, Gym' })}
              className="rounded-2xl border-border bg-card shadow-sm h-11 text-xs font-medium focus:ring-[hsl(var(--accent))] pe-8 rtl:pe-3 rtl:ps-8"
              disabled={isSpinning}
            />
            {tagInput && (
              <button
                onClick={() => {
                  setTagInput('');
                  setSelectedTag('');
                }}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {showSuggestions && tagSuggestions.length > 0 && (
            <div className="absolute z-20 start-0 end-0 mt-1 max-h-40 overflow-y-auto bg-card border border-border rounded-xl shadow-lg p-1">
              {tagSuggestions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setTagInput(tag);
                    setSelectedTag(tag);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Style Filter */}
        <div className="flex-[0.8] min-w-0">
          <label className="text-[10px] caps-label text-muted-foreground font-semibold block mb-1.5 ps-1 text-start">
            {t('stylist.styleFilterLabel', { defaultValue: 'Style' })}
          </label>
          <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isSpinning}>
            <SelectTrigger className="w-full rounded-2xl border-border bg-card shadow-sm h-11 text-xs font-medium focus:ring-[hsl(var(--accent))]">
              <SelectValue placeholder={t('stylist.selectStyle', { defaultValue: 'Select Style' })} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border bg-card shadow-md">
              {DRESS_CODE_OPTIONS.map((style) => (
                <SelectItem key={style} value={style} className="text-xs focus:bg-accent focus:text-accent-foreground rounded-xl py-2">
                  {style === 'all' 
                    ? t('taxonomy.dress_code.all', { defaultValue: 'All Styles' }) 
                    : labelForDressCode(style, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full items-center">
        {renderRow(labelForRole('top', t), filteredTops, topFocusIdx, topSelectedIdx, setTopSelectedIdx, setTopApi, topApi)}
        {renderRow(labelForRole('bottom', t), filteredBottoms, bottomFocusIdx, bottomSelectedIdx, setBottomSelectedIdx, setBottomApi, bottomApi)}
        {renderRow(labelForRole('shoes', t), filteredShoes, shoeFocusIdx, shoeSelectedIdx, setShoeSelectedIdx, setShoeApi, shoeApi)}
      </div>

      <div className="flex items-center gap-4 mt-2">
        <Button
          onClick={handleShuffle}
          disabled={isSpinning}
          className="rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90 px-6 py-6 shadow-md hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center gap-2 text-sm font-semibold"
        >
          <Sparkles className={`h-4 w-4 ${isSpinning ? 'animate-spin' : ''}`} />
          {t('stylist.refreshScout')}
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || isSpinning || (filteredTops.length === 0 && filteredBottoms.length === 0 && filteredShoes.length === 0)}
          variant="outline"
          className="rounded-2xl px-6 py-6 border-brand/20 hover:bg-accent-lilac/30 text-brand font-semibold flex items-center gap-2 text-sm"
        >
          <Save className="h-4 w-4" />
          {t('common.save')}
        </Button>
      </div>

      <ItemFloater itemId={activeFloaterItemId} onClose={handleCloseFloater} fromOutfits={true} />
    </div>
  );
}
