import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Save, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClosetStore } from '@/lib/useClosetStore';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { bestImageUrl } from '@/lib/itemImage';
import { labelForRole } from '@/lib/taxonomy';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';

export default function DressMeShuffler() {
  const { t } = useTranslation();
  const store = useClosetStore();
  const items = store.items || [];

  // Categorize items
  const tops = items.filter(it => it.category === 'Top' || it.category === 'Outerwear' || it.category === 'Full Body');
  const bottoms = items.filter(it => it.category === 'Bottom');
  const shoes = items.filter(it => it.category === 'Footwear');

  const [topIdx, setTopIdx] = useState(0);
  const [bottomIdx, setBottomIdx] = useState(0);
  const [shoeIdx, setShoeIdx] = useState(0);
  
  const [topApi, setTopApi] = useState(null);
  const [bottomApi, setBottomApi] = useState(null);
  const [shoeApi, setShoeApi] = useState(null);

  const [isSpinning, setIsSpinning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync initial indices when items load
  useEffect(() => {
    if (tops.length > 0 && topIdx >= tops.length) setTopIdx(0);
    if (bottoms.length > 0 && bottomIdx >= bottoms.length) setBottomIdx(0);
    if (shoes.length > 0 && shoeIdx >= shoes.length) setShoeIdx(0);
  }, [tops.length, bottoms.length, shoes.length, topIdx, bottomIdx, shoeIdx]);

  // Sync Carousel API -> State (when user scrolls/swipes)
  useEffect(() => {
    if (!topApi) return;
    const onPointerUp = () => {
      const engine = topApi.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    topApi.on('pointerUp', onPointerUp);
    return () => {
      topApi.off('pointerUp', onPointerUp);
    };
  }, [topApi]);

  useEffect(() => {
    if (!bottomApi) return;
    const onPointerUp = () => {
      const engine = bottomApi.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    bottomApi.on('pointerUp', onPointerUp);
    return () => {
      bottomApi.off('pointerUp', onPointerUp);
    };
  }, [bottomApi]);

  useEffect(() => {
    if (!shoeApi) return;
    const onPointerUp = () => {
      const engine = shoeApi.internalEngine?.();
      if (engine?.scrollBody) {
        engine.scrollBody.useFriction(0.65).useDuration(20);
      }
    };
    shoeApi.on('pointerUp', onPointerUp);
    return () => {
      shoeApi.off('pointerUp', onPointerUp);
    };
  }, [shoeApi]);

  // Sync State -> Carousel API (when state changes from shuffling or initial load)
  useEffect(() => {
    if (topApi && tops.length > 0) {
      if (topApi.selectedScrollSnap() !== topIdx) {
        topApi.scrollTo(topIdx, isSpinning);
      }
    }
  }, [topIdx, topApi, tops.length, isSpinning]);

  useEffect(() => {
    if (bottomApi && bottoms.length > 0) {
      if (bottomApi.selectedScrollSnap() !== bottomIdx) {
        bottomApi.scrollTo(bottomIdx, isSpinning);
      }
    }
  }, [bottomIdx, bottomApi, bottoms.length, isSpinning]);

  useEffect(() => {
    if (shoeApi && shoes.length > 0) {
      if (shoeApi.selectedScrollSnap() !== shoeIdx) {
        shoeApi.scrollTo(shoeIdx, isSpinning);
      }
    }
  }, [shoeIdx, shoeApi, shoes.length, isSpinning]);

  // Slot machine spin animation
  const handleShuffle = () => {
    if (isSpinning) return;
    if (tops.length === 0 && bottoms.length === 0 && shoes.length === 0) {
      toast.error(t('closet.emptySub'));
      return;
    }
    
    setIsSpinning(true);
    let count = 0;
    const totalTicks = 8;
    const intervalTime = 80; // Total spin duration: 640ms (responsive feedback)

    const timer = setInterval(() => {
      if (tops.length > 1) setTopIdx(Math.floor(Math.random() * tops.length));
      if (bottoms.length > 1) setBottomIdx(Math.floor(Math.random() * bottoms.length));
      if (shoes.length > 1) setShoeIdx(Math.floor(Math.random() * shoes.length));

      count++;
      if (count >= totalTicks) {
        clearInterval(timer);
        setIsSpinning(false);
        toast.success(t('common.success'), { duration: 1500 });
      }
    }, intervalTime);
  };

  const handleSave = async () => {
    const selectedTop = tops[topIdx];
    const selectedBottom = bottoms[bottomIdx];
    const selectedShoe = shoes[shoeIdx];

    const outfitItems = [selectedTop, selectedBottom, selectedShoe].filter(Boolean);
    if (outfitItems.length === 0) {
      toast.error(t('common.error'));
      return;
    }

    setSaving(true);
    const body = {
      name: t('components.outfitCanvas.the_look'),
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
      toast.success(t('addItem.saved'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('addItem.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (label, list, index, setIdx, setApi) => {
    const hasItems = list.length > 0;

    return (
      <div className="flex flex-col items-center bg-card p-4 rounded-2xl border border-border shadow-sm w-full max-w-sm">
        <span className="caps-label text-xs text-muted-foreground font-medium mb-2">{label}</span>
        <div className="w-full relative px-10">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: true, watchDrag: !isSpinning }}
            className="w-full"
          >
            <CarouselContent className="-ml-2">
              {hasItems ? (
                list.map((item, itemIdx) => {
                  const imageUrl = bestImageUrl(item);
                  const isActive = itemIdx === index;
                  return (
                    <CarouselItem 
                      key={item.id} 
                      className="pl-2 basis-1/3 flex items-center justify-center cursor-pointer"
                      onClick={() => !isSpinning && setIdx(itemIdx)}
                    >
                      <div className={`relative h-20 w-20 rounded-xl overflow-hidden flex items-center justify-center border transition-all duration-300 select-none ${
                        isActive 
                          ? "scale-110 border-brand bg-secondary/30 opacity-100 shadow-md z-10"
                          : "scale-90 border-border/40 bg-secondary/10 opacity-40 hover:opacity-75 z-0"
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
                <CarouselItem className="pl-2 basis-full flex items-center justify-center">
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 hover:bg-accent hover:text-accent-foreground z-10" 
                  disabled={isSpinning}
                  onClick={() => setIdx((index - 1 + list.length) % list.length)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous slide</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 hover:bg-accent hover:text-accent-foreground z-10" 
                  disabled={isSpinning}
                  onClick={() => setIdx((index + 1) % list.length)}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next slide</span>
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
      <div className="flex flex-col gap-4 w-full items-center">
        {renderRow(labelForRole('top', t), tops, topIdx, setTopIdx, setTopApi)}
        {renderRow(labelForRole('bottom', t), bottoms, bottomIdx, setBottomIdx, setBottomApi)}
        {renderRow(labelForRole('shoes', t), shoes, shoeIdx, setShoeIdx, setShoeApi)}
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
          disabled={saving || isSpinning || (!tops[topIdx] && !bottoms[bottomIdx] && !shoes[shoeIdx])}
          variant="outline"
          className="rounded-2xl px-6 py-6 border-brand/20 hover:bg-accent-lilac/30 text-brand font-semibold flex items-center gap-2 text-sm"
        >
          <Save className="h-4 w-4" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
