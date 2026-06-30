import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { Heart, X, Sparkles, ImageOff } from 'lucide-react';
import { useClosetStore } from '@/lib/useClosetStore';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { bestImageUrl } from '@/lib/itemImage';
import { labelForRole } from '@/lib/taxonomy';

export default function OutfitTinderSwiper() {
  const { t } = useTranslation();
  const store = useClosetStore();
  const items = store.items || [];

  // Group items
  const tops = items.filter(it => it.category === 'Top' || it.category === 'Outerwear' || it.category === 'Full Body');
  const bottoms = items.filter(it => it.category === 'Bottom');
  const shoes = items.filter(it => it.category === 'Footwear');

  const [currentOutfit, setCurrentOutfit] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | null
  const [saving, setSaving] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.5, 0.8, 1, 0.8, 0.5]);
  const controls = useAnimation();

  // Generate random outfit
  const generateOutfit = () => {
    if (tops.length === 0 && bottoms.length === 0 && shoes.length === 0) {
      setCurrentOutfit(null);
      return;
    }

    const top = tops.length > 0 ? tops[Math.floor(Math.random() * tops.length)] : null;
    const bottom = bottoms.length > 0 ? bottoms[Math.floor(Math.random() * bottoms.length)] : null;
    const shoe = shoes.length > 0 ? shoes[Math.floor(Math.random() * shoes.length)] : null;

    setCurrentOutfit({
      id: `outfit-${Date.now()}`,
      top,
      bottom,
      shoe,
      name: t('stylist.dailySuggestion')
    });
    setSwipeDirection(null);
  };

  useEffect(() => {
    generateOutfit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handleSwipe = async (direction) => {
    if (!currentOutfit) return;

    if (direction === 'right') {
      setSaving(true);
      const outfitItems = [currentOutfit.top, currentOutfit.bottom, currentOutfit.shoe].filter(Boolean);
      if (outfitItems.length > 0) {
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

        const body = {
          name: descriptiveTitle,
          description: descriptiveDesc,
          source_workflow: 'scheduled',
          prompt: 'tinder_match',
          garments: outfitItems.map(it => ({
            closet_item_id: it.id,
            role: it.category === 'Top' || it.category === 'Outerwear' ? 'top' : it.category === 'Bottom' ? 'bottom' : it.category === 'Footwear' ? 'shoes' : 'accessory',
            title: it.name || it.title || ''
          })),
          usage: {
            date: new Date().toISOString().split('T')[0],
            time: '12:00',
            location: null,
            event_name: 'Swiped Match'
          }
        };
        try {
          await api.saveOutfit(body);
          toast.success(t('addItem.saved'));
        } catch (err) {
          toast.error(t('addItem.saveFailed'));
        } finally {
          setSaving(false);
        }
      }
    } else {
      toast.message(t('addItem.preflight.rowSkip'), { duration: 1000 });
    }

    generateOutfit();
    x.set(0);
  };

  const handleDragEnd = (event, info) => {
    const swipeThreshold = 140;
    if (info.offset.x > swipeThreshold) {
      controls.start({ x: 300, opacity: 0 }).then(() => handleSwipe('right'));
    } else if (info.offset.x < -swipeThreshold) {
      controls.start({ x: -300, opacity: 0 }).then(() => handleSwipe('left'));
    } else {
      controls.start({ x: 0, opacity: 1 });
    }
  };

  const forceSwipe = (direction) => {
    const targetX = direction === 'right' ? 300 : -300;
    controls.start({ x: targetX, opacity: 0 }).then(() => handleSwipe(direction));
  };

  const renderItemThumb = (item, roleName) => {
    if (!item) {
      return (
        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-dashed border-border w-full justify-center text-muted-foreground/60 h-16">
          <ImageOff className="h-4 w-4 opacity-50" />
          <span className="text-[11px] font-medium">{roleName}: {t('itemDetail.noImage')}</span>
        </div>
      );
    }
    const imageUrl = bestImageUrl(item);
    return (
      <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/60 w-full shadow-sm h-16">
        <div className="h-10 w-10 bg-secondary/30 rounded-lg overflow-hidden shrink-0 border border-border flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt={item.name} className="h-full w-full object-contain pointer-events-none" />
          ) : (
            <ImageOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col min-w-0 text-start">
          <span className="text-xs font-semibold truncate text-foreground">{item.name || item.title || 'Garment'}</span>
          <span className="text-[10px] text-muted-foreground caps-label tracking-wider">{roleName}</span>
        </div>
      </div>
    );
  };

  // Monitor motion value to show feedback text overlay
  x.on("change", (latest) => {
    if (latest > 50) setSwipeDirection('right');
    else if (latest < -50) setSwipeDirection('left');
    else setSwipeDirection(null);
  });

  if (!currentOutfit) {
    return (
      <div className="text-center p-8 bg-card border border-border rounded-3xl max-w-sm mx-auto shadow-sm">
        <ImageOff className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
        <h3 className="text-base font-semibold">{t('closet.emptyTitle')}</h3>
        <p className="text-xs text-muted-foreground mt-2">
          {t('closet.emptySub')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4 w-full select-none">
      <div className="relative w-80 h-[360px] flex items-center justify-center">
        {/* Tinder Card Stack */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          style={{ x, rotate, opacity }}
          animate={controls}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="absolute inset-0 bg-accent-lilac/10 border border-brand/15 rounded-3xl shadow-md p-5 flex flex-col justify-between cursor-grab active:cursor-grabbing bg-card z-10"
        >
          {/* Overlay tags based on swipe distance */}
          {swipeDirection === 'right' && (
            <div className="absolute top-6 start-6 rotate-[-12deg] border-4 border-accent-green text-accent-green font-bold text-lg px-3 py-1 rounded-lg uppercase tracking-wider z-20 pointer-events-none">
              {t('common.save')}
            </div>
          )}
          {swipeDirection === 'left' && (
            <div className="absolute top-6 end-6 rotate-[12deg] border-4 border-destructive text-destructive font-bold text-lg px-3 py-1 rounded-lg uppercase tracking-wider z-20 pointer-events-none">
              {t('addItem.preflight.rowSkip')}
            </div>
          )}

          <div className="w-full flex items-center justify-between border-b border-border/55 pb-2 mb-2">
            <span className="font-display text-base text-foreground font-semibold">{currentOutfit.name}</span>
            <span className="text-[10px] caps-label bg-accent-lilac/30 text-brand px-2 py-0.5 rounded-full font-bold">
              {t('stylist.label')}
            </span>
          </div>

          <div className="flex flex-col gap-3 flex-1 justify-center py-2">
            {renderItemThumb(currentOutfit.top, labelForRole('top', t))}
            {renderItemThumb(currentOutfit.bottom, labelForRole('bottom', t))}
            {renderItemThumb(currentOutfit.shoe, labelForRole('shoes', t))}
          </div>
        </motion.div>

        {/* Dummy Card Behind */}
        <div className="absolute inset-0 scale-[0.96] translate-y-3 bg-card border border-border/80 rounded-3xl shadow-sm -z-10" />
      </div>

      {/* Controller Buttons */}
      <div className="flex items-center gap-5 mt-2">
        <Button
          size="icon"
          onClick={() => forceSwipe('left')}
          disabled={saving}
          className="h-14 w-14 rounded-full border-2 border-destructive bg-background text-destructive hover:bg-destructive/10 hover:text-destructive shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <X className="h-6 w-6 stroke-[2.5]" />
        </Button>

        <Button
          size="icon"
          onClick={generateOutfit}
          disabled={saving}
          className="h-11 w-11 rounded-full border border-border bg-background text-muted-foreground hover:bg-secondary shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          onClick={() => forceSwipe('right')}
          disabled={saving}
          className="h-14 w-14 rounded-full border-2 border-accent-green bg-background text-accent-green hover:bg-accent-green/10 hover:text-accent-green shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <Heart className="h-6 w-6 fill-current stroke-[2.2]" />
        </Button>
      </div>
    </div>
  );
}
