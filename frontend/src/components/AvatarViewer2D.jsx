import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ImageOff, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { bestImageUrl } from '@/lib/itemImage';
import { closetStore } from '@/lib/closetStore';
import ImageWithPlaceholder from '@/components/ImageWithPlaceholder';

export default function AvatarViewer2D({ shapeParams = {}, sex = 'female', outfitItems = {}, onItemClick }) {
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

  // Determine outfit garment URLs and IDs
  const garments = useMemo(() => {
    const res = {};
    const allClosetItems = (closetStore.getSnapshot().items || []).filter(Boolean);

    Object.entries(outfitItems || {}).forEach(([role, item]) => {
      if (item) {
        // Resolve item from closetStore to see if it is part of a set
        const itemId = item.closet_item_id || item.id;
        const closetItem = allClosetItems.find(it => it && it.id === itemId);
        
        // Map slot using the closet item's actual category if available, falling back to the assigned role
        let slot = role;
        if (closetItem && closetItem.category) {
          const cat = String(closetItem.category).toLowerCase().trim().replace(/\s+/g, '_');
          if (cat === 'top' || cat === 'tops') slot = 'top';
          else if (cat === 'bottom' || cat === 'bottoms') slot = 'bottom';
          else if (cat === 'footwear' || cat === 'shoes') slot = 'shoes';
          else if (cat === 'accessories' || cat === 'accessory') slot = 'accessory';
          else if (cat === 'headwear' || cat === 'hat') slot = 'headwear';
          else if (cat === 'outerwear' || cat === 'jacket') slot = 'outerwear';
          else if (cat === 'dress' || cat === 'dresses') slot = 'dress';
          else slot = cat; // fallback to whatever it is
        }
        
        // Additional fallbacks for common LLM generated roles that don't match our avatar slots perfectly
        if (slot === 'hat' || slot === 'cap') slot = 'headwear';
        if (slot === 'accessories') slot = 'accessory';
        if (slot === 'footwear') slot = 'shoes';

        if (closetItem && closetItem.group_id) {
          // Find all items in this group
          const groupItems = allClosetItems.filter(it => it && it.group_id === closetItem.group_id);
          // Check if it's a set (multiple categories)
          const categories = new Set(groupItems.map(it => String(it.category || '').toLowerCase().trim()));
          
          if (categories.size > 1) {
            // It's a set! Map each group item to its correct category
            groupItems.forEach(gItem => {
              const cat = String(gItem.category || '').toLowerCase().trim().replace(/\s+/g, '_');
              let gSlot = cat;
              if (cat === 'top' || cat === 'tops') gSlot = 'top';
              else if (cat === 'bottom' || cat === 'bottoms') gSlot = 'bottom';
              else if (cat === 'footwear' || cat === 'shoes') gSlot = 'shoes';
              else if (cat === 'accessories' || cat === 'accessory') gSlot = 'accessory';
              else if (cat === 'headwear' || cat === 'hat') gSlot = 'headwear';
              else if (cat === 'outerwear' || cat === 'jacket') gSlot = 'outerwear';
              else if (cat === 'dress' || cat === 'dresses') gSlot = 'dress';
              
              res[gSlot] = {
                url: bestImageUrl(gItem) || gItem.image_data_url || gItem.segmented_image_url || gItem.image_url || gItem.original_image_url,
                placeholder: gItem.placeholder_data_url || null,
                id: gItem.id
              };
            });
            return; // Skip the default mapping since we mapped the whole set
          }
        }
 
        // Default mapping if not a set (or if we are just mapping the single item)
        res[slot] = {
           url: bestImageUrl(item) || item.image_data_url || item.segmented_image_url || item.image_url || item.original_image_url || item.url,
           placeholder: item.placeholder_data_url || item.placeholder || null,
           id: item.closet_item_id || item.id || null
        };
      }
    });
    return res;
  }, [outfitItems]);

  const renderGarment = (roleKey, fallbackAlt, extraClasses = '', initial = {}, animate = {}) => {
    const garment = garments[roleKey];
    if (!garment || !garment.url) return null;
    const clickable = onItemClick && garment.id;
    return (
      <motion.div
        initial={initial}
        animate={animate}
        className={`absolute drop-shadow-md ${extraClasses} ${clickable ? 'cursor-pointer hover:scale-[1.02] transition-transform z-50' : 'pointer-events-none'}`}
        onClick={clickable ? (e) => { e.stopPropagation(); onItemClick(garment.id); } : undefined}
      >
        <ImageWithPlaceholder
          src={garment.url}
          placeholder={garment.placeholder}
          alt={t(`taxonomy.categories.${roleKey}`, { defaultValue: fallbackAlt })}
          objectFit="contain"
          className="w-full h-full"
        />
      </motion.div>
    );
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-secondary/30 via-secondary/15 to-background overflow-hidden flex items-center justify-center p-0 shadow-inner group">
      {/* Dynamic Background Sparkle */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent" />
      
      {/* 2D Vector Avatar Container */}
      <div 
        className="relative h-full aspect-[1/2] flex items-center justify-center transition-all duration-500"
        style={{
          transform: `scale(${scales.width}, ${scales.height})`,
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
        {renderGarment('headwear', 'Headwear', 'top-0 left-1/2 w-[40%] aspect-square z-30', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}

        {/* 2. Accessories / Neckwear */}
        {renderGarment('accessory', 'Accessory', 'top-[14%] left-1/2 w-[35%] z-25', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" })}

        {/* 3. Dress (Overrides top/bottom layout) */}
        {garments.dress && garments.dress.url ? (
          renderGarment('dress', 'Dress', 'top-[16%] left-1/2 w-[75%] h-[60%] z-20 drop-shadow-lg', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" })
        ) : (
          <>
            {/* Top (Shirt, Sweater, etc.) */}
            {renderGarment('top', 'Top', 'top-[17%] left-1/2 w-[78%] h-[38%] z-20', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.chest / scales.width })}

            {/* Bottom (Pants, Skirt, Jeans) */}
            {renderGarment('bottom', 'Bottom', 'top-[42%] left-1/2 w-[72%] h-[48%] z-10', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.hips / scales.width })}
          </>
        )}

        {/* 4. Outerwear (Jacket, Coat) - Layered on top of top/dress */}
        {renderGarment('outerwear', 'Outerwear', 'top-[16%] left-1/2 w-[85%] h-[45%] z-22 drop-shadow-lg', { opacity: 0, scale: 0.96, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" })}

        {/* 5. Shoes */}
        {renderGarment('shoes', 'Shoes', 'bottom-0 left-1/2 w-[50%] h-[15%] z-15', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}

        {/* 6. Bag */}
        {garments.bag && (
          <motion.img
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            src={garments.bag}
            alt={t('taxonomy.sub_category.bag', { defaultValue: 'Bag' })}
            className="absolute top-[40%] right-[-5%] w-[40%] h-[30%] object-contain z-25 drop-shadow-md"
          />
        )}
      </div>

    </div>
  );
}
