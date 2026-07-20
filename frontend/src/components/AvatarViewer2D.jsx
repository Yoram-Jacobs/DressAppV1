import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { bestImageUrl } from '@/lib/itemImage';
import { closetStore } from '@/lib/closetStore';
import { useAuth } from '@/lib/auth';
import ImageWithPlaceholder from '@/components/ImageWithPlaceholder';
import DynamicAvatar from '@/components/DynamicAvatar';

export default function AvatarViewer2D({ shapeParams = {}, measurements: providedMeasurements, skinColor = '#9CA3AF', sex = 'female', outfitItems = {}, onItemClick, bodyPhotoUrl }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const activeBodyPhotoUrl = bodyPhotoUrl || user?.body_photo_url || null;
  const activeSkinColor = skinColor !== '#9CA3AF' ? skinColor : (user?.skin_tone || '#9CA3AF');

  // Normalize params between 0 and 1
  const params = useMemo(() => {
    const defaultParams = {
      tall: 0, short: 0, heavy: 0, thin: 0,
      busty: 0, waist_thick: 0, waist_thin: 0,
      hips_wide: 0, hips_narrow: 0
    };
    return { ...defaultParams, ...shapeParams };
  }, [shapeParams]);

  // Derive cm measurements for DynamicAvatar
  const computedMeasurements = useMemo(() => {
    const isMale = String(sex).toLowerCase() === 'male';
    const baseH = isMale ? 178 : 168;
    const baseSh = isMale ? 44 : 38;
    const baseCh = isMale ? 98 : 88;
    const baseW = isMale ? 82 : 68;
    const baseHip = isMale ? 96 : 94;

    const tall = params.tall || 0;
    const short = params.short || 0;
    const heavy = params.heavy || 0;
    const thin = params.thin || 0;

    const pm = providedMeasurements || {};

    return {
      height: Number(pm.height || pm.length) || (baseH + (tall * 15) - (short * 15)),
      shoulders: Number(pm.shoulders || pm.shoulder) || (baseSh + (heavy * 4) - (thin * 3)),
      chest: Number(pm.chest || pm.bust) || (baseCh + ((params.busty || 0) * 10) + (heavy * 8) - (thin * 6)),
      waist: Number(pm.waist) || (baseW + ((params.waist_thick || 0) * 10) - ((params.waist_thin || 0) * 8) + (heavy * 6)),
      hip: Number(pm.hips || pm.hip) || (baseHip + ((params.hips_wide || 0) * 10) - ((params.hips_narrow || 0) * 8) + (heavy * 6)),
      armLength: Number(pm.arm_length || pm.armLength) || ((isMale ? 64 : 58) + (tall * 5) - (short * 5)),
      inseam: Number(pm.inseam || pm.leg_length) || ((isMale ? 82 : 76) + (tall * 8) - (short * 8)),
      gender: isMale ? 'male' : 'female'
    };
  }, [providedMeasurements, params, sex]);

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

    const resolveSlot = (roleName, itemObj, dbItem) => {
      let s = roleName;
      const category = dbItem?.category || itemObj?.category;
      if (category) {
        const cat = String(category).toLowerCase().trim().replace(/\s+/g, '_');
        if (cat === 'top' || cat === 'tops') s = 'top';
        else if (cat === 'bottom' || cat === 'bottoms') s = 'bottom';
        else if (cat === 'footwear' || cat === 'shoes') s = 'shoes';
        else if (cat === 'accessories' || cat === 'accessory') s = 'accessory';
        else if (cat === 'headwear' || cat === 'hat') s = 'headwear';
        else if (cat === 'outerwear' || cat === 'jacket') s = 'outerwear';
        else if (cat === 'dress' || cat === 'dresses') s = 'dress';
        else s = cat;
      }
      if (s === 'hat' || s === 'cap') s = 'headwear';
      if (s === 'accessories') s = 'accessory';
      if (s === 'footwear') s = 'shoes';
      if (s === 'belt') s = 'belt';
      if (s === 'glasses' || s === 'sunglasses' || s === 'eyewear') s = 'glasses';

      const name = String(itemObj?.name || itemObj?.title || dbItem?.name || dbItem?.title || '').toLowerCase();
      const isHat = name.includes('hat') || 
                    name.includes('cap') || 
                    name.includes('beanie') || 
                    name.includes('beret') || 
                    name.includes('fedora') || 
                    name.includes('visor') || 
                    name.includes('flat cap') ||
                    name.includes('bonnet') ||
                    name.includes('bucket hat') ||
                    name.includes('helmet');
      if (isHat && (s === 'accessory' || s === 'accessories')) {
        return 'headwear';
      }

      const isBelt = name.includes('belt');
      if (isBelt) {
        return 'belt';
      }

      const isGlasses = name.includes('glasses') || 
                        name.includes('spectacles') || 
                        name.includes('sunglasses') || 
                        name.includes('eyewear') || 
                        name.includes('shades');
      if (isGlasses && (s === 'accessory' || s === 'accessories')) {
        return 'glasses';
      }
      return s;
    };

    Object.entries(outfitItems || {}).forEach(([role, item]) => {
      if (item) {
        const itemId = item.closet_item_id || item.id;
        const closetItem = allClosetItems.find(it => it && it.id === itemId);
        
        let slot = resolveSlot(role, item, closetItem);

        if (closetItem && closetItem.group_id) {
          const groupItems = allClosetItems.filter(it => it && it.group_id === closetItem.group_id);
          const categories = new Set(groupItems.map(it => String(it.category || '').toLowerCase().trim()));
          
          if (categories.size > 1) {
            groupItems.forEach(gItem => {
              const gSlot = resolveSlot(gItem.category, gItem, gItem);
              res[gSlot] = {
                url: bestImageUrl(gItem) || gItem.image_data_url || gItem.segmented_image_url || gItem.image_url || gItem.original_image_url,
                placeholder: gItem.placeholder_data_url || null,
                id: gItem.id
              };
            });
            return;
          }
        }
 
        res[slot] = {
           url: bestImageUrl(item) || item.image_data_url || item.segmented_image_url || item.image_url || item.original_image_url || item.url,
           placeholder: item.placeholder_data_url || item.placeholder || null,
           id: item.closet_item_id || item.id || null
        };
      }
    });
    return res;
  }, [outfitItems]);

  const renderGarment = (roleKey, altText, extraClasses = '', initial = {}, animate = {}) => {
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
          alt={altText}
          objectFit="contain"
          className="w-full h-full object-top"
        />
      </motion.div>
    );
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-secondary/30 via-secondary/15 to-background overflow-hidden flex items-center justify-center p-0 shadow-inner group">
      {/* Dynamic Background Sparkle */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent" />
      
      {/* 2D Dynamic Bezier SVG Avatar or Real Body Photo Container */}
      <div 
        className="relative h-full aspect-[1/2] flex items-center justify-center transition-all duration-500"
      >
        {activeBodyPhotoUrl ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={activeBodyPhotoUrl}
              alt={t('profile.bodyPhoto', { defaultValue: 'Full-body photo' })}
              className="w-full h-full object-contain rounded-xl drop-shadow-md"
            />
            {/* Render Try-On Garments on top of real body photo */}
            {renderGarment('headwear', t('taxonomy.categories.headwear', { defaultValue: 'Headwear' }), 'top-[1%] left-1/2 w-[34%] aspect-square z-30', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}
            {renderGarment('glasses', t('taxonomy.categories.glasses', { defaultValue: 'Glasses' }), 'top-[11.5%] left-1/2 w-[18%] h-[4.5%] z-28', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" })}
            {renderGarment('accessory', t('taxonomy.categories.accessory', { defaultValue: 'Accessory' }), 'top-[14%] left-1/2 w-[30%] aspect-square z-25', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" })}
            {garments.dress && garments.dress.url ? (
              renderGarment('dress', t('taxonomy.categories.dress', { defaultValue: 'Dress' }), 'top-[15.5%] left-1/2 w-[65%] h-[65%] z-20 drop-shadow-lg', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" })
            ) : (
              <>
                {renderGarment('top', t('taxonomy.categories.top', { defaultValue: 'Top' }), 'top-[15.5%] left-1/2 w-[64%] h-[30%] z-20', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.chest / scales.width })}
                {renderGarment('bottom', t('taxonomy.categories.bottom', { defaultValue: 'Bottom' }), 'top-[40%] left-1/2 w-[60%] h-[45%] z-10', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.hips / scales.width })}
              </>
            )}
            {renderGarment('belt', t('taxonomy.categories.belt', { defaultValue: 'Belt' }), 'top-[40%] left-1/2 w-[60%] h-[4%] z-21', { opacity: 0, y: 5, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}
            {renderGarment('outerwear', t('taxonomy.categories.outerwear', { defaultValue: 'Outerwear' }), 'top-[15.5%] left-1/2 w-[72%] h-[40%] z-22 drop-shadow-lg', { opacity: 0, scale: 0.96, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" })}
            {renderGarment('shoes', t('taxonomy.categories.shoes', { defaultValue: 'Shoes' }), 'bottom-[2%] left-1/2 w-[44%] h-[12%] z-15', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}
          </div>
        ) : (
          <DynamicAvatar
            height={computedMeasurements.height}
            shoulders={computedMeasurements.shoulders}
            chest={computedMeasurements.chest}
            waist={computedMeasurements.waist}
            hip={computedMeasurements.hip || computedMeasurements.hips}
            armLength={computedMeasurements.armLength || computedMeasurements.arm_length}
            inseam={computedMeasurements.inseam}
            gender={computedMeasurements.gender || sex}
            skinColor={activeSkinColor}
            showGuideLines={false}
            className="w-full h-full"
          >
            {/* ─── Layered Clothes (Segmented transparent PNG overlays) ─── */}
            {renderGarment('headwear', t('taxonomy.categories.headwear', { defaultValue: 'Headwear' }), 'top-[1%] left-1/2 w-[34%] aspect-square z-30', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}
            {renderGarment('glasses', t('taxonomy.categories.glasses', { defaultValue: 'Glasses' }), 'top-[11.5%] left-1/2 w-[18%] h-[4.5%] z-28', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" })}
            {renderGarment('accessory', t('taxonomy.categories.accessory', { defaultValue: 'Accessory' }), 'top-[14%] left-1/2 w-[30%] aspect-square z-25', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" })}

            {garments.dress && garments.dress.url ? (
              renderGarment('dress', t('taxonomy.categories.dress', { defaultValue: 'Dress' }), 'top-[15.5%] left-1/2 w-[65%] h-[65%] z-20 drop-shadow-lg', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" })
            ) : (
              <>
                {renderGarment('top', t('taxonomy.categories.top', { defaultValue: 'Top' }), 'top-[15.5%] left-1/2 w-[64%] h-[30%] z-20', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.chest / scales.width })}
                {renderGarment('bottom', t('taxonomy.categories.bottom', { defaultValue: 'Bottom' }), 'top-[40%] left-1/2 w-[60%] h-[45%] z-10', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.hips / scales.width })}
              </>
            )}

            {renderGarment('belt', t('taxonomy.categories.belt', { defaultValue: 'Belt' }), 'top-[40%] left-1/2 w-[60%] h-[4%] z-21', { opacity: 0, y: 5, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}
            {renderGarment('outerwear', t('taxonomy.categories.outerwear', { defaultValue: 'Outerwear' }), 'top-[15.5%] left-1/2 w-[72%] h-[40%] z-22 drop-shadow-lg', { opacity: 0, scale: 0.96, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" })}
            {renderGarment('shoes', t('taxonomy.categories.shoes', { defaultValue: 'Shoes' }), 'bottom-[2%] left-1/2 w-[44%] h-[12%] z-15', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" })}

            {garments.bag && garments.bag.url && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`absolute top-[40%] right-[-5%] w-[40%] h-[30%] z-25 drop-shadow-md ${onItemClick && garments.bag.id ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
                onClick={onItemClick && garments.bag.id ? (e) => { e.stopPropagation(); onItemClick(garments.bag.id); } : undefined}
              >
                <ImageWithPlaceholder
                  src={garments.bag.url}
                  placeholder={garments.bag.placeholder}
                  alt={t('taxonomy.sub_category.bag', { defaultValue: 'Bag' })}
                  objectFit="contain"
                  className="w-full h-full"
                />
              </motion.div>
            )}
          </DynamicAvatar>
        )}
      </div>
    </div>
  );
}
