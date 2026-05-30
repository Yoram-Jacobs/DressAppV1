import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ImageOff, Sparkles } from 'lucide-react';

import { useTranslation } from 'react-i18next';
export default function AvatarViewer2D({ shapeParams = {}, sex = 'female', outfitItems = {} }) {
  const { t } = useTranslation();

  // Normalize params between 0 and 1
  const params = useMemo(() => {
    const defaultParams = {
      tall: 0, short: 0, heavy: 0, thin: 0,
      busty: 0, waist_thick: 0, waist_thin: 0,
      hips_wide: 0, hips_narrow: 0
    };
    return { ...defaultParams, ...shapeParams };
  }, [shapeParams]);

  // Derive scales based on user shape parameters
  const scales = useMemo(() => {
    const heightFactor = 1 + (params.tall * 0.08) - (params.short * 0.08);
    const widthFactor = 1 + (params.heavy * 0.12) - (params.thin * 0.12);
    const chestFactor = 1 + (params.busty * 0.1);
    const waistFactor = 1 + (params.waist_thick * 0.12) - (params.waist_thin * 0.08);
    const hipsFactor = 1 + (params.hips_wide * 0.12) - (params.hips_narrow * 0.08);

    return {
      height: heightFactor,
      width: widthFactor,
      chest: chestFactor,
      waist: waistFactor,
      hips: hipsFactor,
    };
  }, [params]);

  // Determine outfit garment URLs
  const garments = useMemo(() => {
    const res = {};
    Object.entries(outfitItems || {}).forEach(([role, item]) => {
      if (item) {
        // Can be a full ClosetItem or simple `{image_url}` / `{image_data_url}`
        res[role] = item.image_data_url || item.segmented_image_url || item.image_url || item.original_image_url;
      }
    });
    return res;
  }, [outfitItems]);

  return (
    <div className="relative w-full h-[520px] bg-gradient-to-b from-secondary/30 via-secondary/15 to-background border border-border rounded-2xl overflow-hidden flex items-center justify-center p-4 shadow-inner group">
      {/* Dynamic Background Sparkle */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent" />
      
      {/* 2D Vector Avatar Container */}
      <div 
        className="relative w-[280px] h-[480px] flex items-center justify-center transition-all duration-500"
        style={{
          transform: `scale(${scales.width * 0.95}, ${scales.height * 0.95})`,
          transformOrigin: 'bottom center'
        }}
      >
        {/* Silhouette SVG */}
        <svg
          viewBox="0 0 100 200"
          className="w-full h-full text-muted-foreground/20 fill-current drop-shadow-md select-none pointer-events-none"
        >
          {sex === 'male' ? (
            // Male silhouette
            <path d="M50,15 A8,8 0 1,0 50,31 A8,8 0 1,0 50,15 M36,33 C39,33 42,35 50,35 C58,35 61,33 64,33 C70,33 72,38 72,45 C72,55 70,70 68,90 C67,95 64,98 60,98 C58,98 57,94 50,94 C43,94 42,98 40,98 C36,98 33,95 32,90 C30,70 28,55 28,45 C28,38 30,33 36,33 Z M38,98 L37,175 C37,185 34,188 44,188 L46,188 L46,106 L50,106 L54,106 L54,188 L56,188 C66,188 63,185 63,175 L62,98 Z" />
          ) : (
            // Female silhouette with waist indentation and hip curves
            <path d="M50,18 A7.5,7.5 0 1,0 50,33 A7.5,7.5 0 1,0 50,18 M37,35 C41,35 44,37 50,37 C56,37 59,35 63,35 C68,35 70,39 70,45 C70,53 69,63 67,82 C65,90 61,96 58,96 C56,96 55,92 50,92 C45,92 44,96 42,96 C39,96 35,90 33,82 C31,63 30,53 30,45 C30,39 32,35 37,35 Z M38,96 L36,172 C36,182 33,185 43,185 L45,185 L46,104 L50,104 L54,104 L55,185 L57,185 C67,185 64,182 64,172 L62,96 Z" />
          )}

          {/* Guidelines / visual targets */}
          <line x1="15" y1="45" x2="85" y2="45" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1,2" opacity="0.3" />
          <line x1="15" y1="95" x2="85" y2="95" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1,2" opacity="0.3" />
          <line x1="15" y1="175" x2="85" y2="175" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1,2" opacity="0.3" />
        </svg>

        {/* ─── Layered Clothes (Segmented transparent PNG overlays) ─── */}

        {/* 1. Headwear */}
        {garments.headwear && (
          <motion.img
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            src={garments.headwear}
            alt={t('components.avatarViewer2D.headwear', { defaultValue: 'Headwear' })}
            className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[22%] aspect-square object-contain z-30 drop-shadow-md"
          />
        )}

        {/* 2. Accessories / Neckwear */}
        {garments.accessory && (
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={garments.accessory}
            alt={t('taxonomy.categories.accessory', { defaultValue: 'Accessory' })}
            className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[16%] object-contain z-25"
          />
        )}

        {/* 3. Dress (Overrides top/bottom layout) */}
        {garments.dress ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            src={garments.dress}
            alt={t('taxonomy.categories.dress', { defaultValue: 'Dress' })}
            className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[42%] h-[56%] object-contain z-20 drop-shadow-lg"
          />
        ) : (
          <>
            {/* Top (Shirt, Sweater, etc.) */}
            {garments.top && (
              <motion.img
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                src={garments.top}
                alt={t('addItem.categoryPlaceholder', { defaultValue: 'Top' })}
                className="absolute top-[19%] left-1/2 -translate-x-1/2 w-[44%] h-[32%] object-contain z-20 drop-shadow-md"
                style={{
                  transform: `translateX(-50%) scale(${scales.chest / scales.width}, 1)`
                }}
              />
            )}

            {/* Bottom (Pants, Skirt, Jeans) */}
            {garments.bottom && (
              <motion.img
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                src={garments.bottom}
                alt={t('taxonomy.categories.bottom', { defaultValue: 'Bottom' })}
                className="absolute top-[44%] left-1/2 -translate-x-1/2 w-[40%] h-[40%] object-contain z-10 drop-shadow-md"
                style={{
                  transform: `translateX(-50%) scale(${scales.hips / scales.width}, 1)`
                }}
              />
            )}
          </>
        )}

        {/* 4. Outerwear (Jacket, Coat) - Layered on top of top/dress */}
        {garments.outerwear && (
          <motion.img
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            src={garments.outerwear}
            alt={t('taxonomy.categories.outerwear', { defaultValue: 'Outerwear' })}
            className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[48%] h-[35%] object-contain z-22 drop-shadow-lg"
          />
        )}

        {/* 5. Shoes */}
        {garments.shoes && (
          <motion.img
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            src={garments.shoes}
            alt={t('taxonomy.categories.shoes', { defaultValue: 'Shoes' })}
            className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[34%] h-[12%] object-contain z-15 drop-shadow-md"
          />
        )}

        {/* 6. Bag */}
        {garments.bag && (
          <motion.img
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            src={garments.bag}
            alt={t('taxonomy.sub_category.bag', { defaultValue: 'Bag' })}
            className="absolute top-[45%] right-[2%] w-[24%] h-[24%] object-contain z-25 drop-shadow-md"
          />
        )}
      </div>

      {/* Try-on affordance overlay */}
      <div className="absolute bottom-3 right-3 bg-background/80 dark:bg-slate-900/80 backdrop-blur px-2 py-1 rounded-lg border border-border text-[10px] text-muted-foreground flex items-center gap-1 select-none opacity-0 group-hover:opacity-100 transition-opacity">
        <Sparkles className="h-3 w-3 text-[hsl(var(--accent))]" />
        <span>{t('components.avatarViewer2D.virtual_tryon_active', { defaultValue: 'Virtual Try-On Active' })}</span>
      </div>
    </div>
  );
}
