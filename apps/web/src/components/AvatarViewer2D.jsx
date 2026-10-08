import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { bestImageUrl, resolveMediaUrl } from '@/lib/itemImage';
import { closetStore } from '@/lib/closetStore';
import { useAuth } from '@/lib/auth';
import ImageWithPlaceholder from '@/components/ImageWithPlaceholder';
import DynamicAvatar from '@/components/DynamicAvatar';

// ─── Dynamic Anatomical Topography Helpers ───
export function getBottomTopography(garment) {
  if (!garment) return { classes: 'top-[39%] left-1/2 w-[74%] h-[52.5%] z-[10]', align: 'object-bottom' };
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();

  // 1. Bikini bottom / Swim briefs / Underwear
  if (
    text.includes('bikini') ||
    text.includes('swim_brief') ||
    text.includes('brief') ||
    text.includes('thong') ||
    text.includes('תחתונים') ||
    text.includes('ביקיני') ||
    (text.includes('swim') && text.includes('bottom')) ||
    (text.includes('ים') && text.includes('תחתון'))
  ) {
    return {
      classes: 'top-[44%] left-1/2 w-[56%] h-[17%] z-[10]',
      align: 'object-top'
    };
  }

  // 2. Mini Skirt
  if (
    text.includes('mini_skirt') ||
    (text.includes('skirt') && text.includes('mini')) ||
    text.includes('חצאית מיני') ||
    text.includes('חצאית_מיני')
  ) {
    return {
      classes: 'top-[44%] left-1/2 w-[70%] h-[22%] z-[10]',
      align: 'object-top'
    };
  }

  // 3. Shorts / Swim Trunks / Running Shorts / Boxers
  if (
    text.includes('short') ||
    text.includes('trunk') ||
    text.includes('boxer') ||
    text.includes('שורט') ||
    text.includes('קצרים') ||
    text.includes('מכנסי ים') ||
    text.includes('מכנסי_ים') ||
    text.includes('שמכנסי ריצה')
  ) {
    if (text.includes('bermuda') || text.includes('ברמודה') || text.includes('knee')) {
      return {
        classes: 'top-[44%] left-1/2 w-[66%] h-[30%] z-[10]',
        align: 'object-top'
      };
    }
    return {
      classes: 'top-[44%] left-1/2 w-[66%] h-[24%] z-[10]',
      align: 'object-top'
    };
  }

  // 4. Maxi Skirt
  if (
    text.includes('maxi_skirt') ||
    (text.includes('skirt') && (text.includes('maxi') || text.includes('long'))) ||
    text.includes('חצאית מקסי') ||
    text.includes('חצאית_מקסי') ||
    text.includes('חצאית ארוכה')
  ) {
    return {
      classes: 'top-[40%] left-1/2 w-[78%] h-[51.5%] z-[10]',
      align: 'object-bottom'
    };
  }

  // 5. Midi Skirt / Pencil / Pleated / A-Line / General Skirts
  if (
    text.includes('skirt') ||
    text.includes('חצאית') ||
    text.includes('تنورة') ||
    text.includes('юбк') ||
    text.includes('falda') ||
    text.includes('jupe')
  ) {
    return {
      classes: 'top-[44%] left-1/2 w-[74%] h-[38%] z-[10]',
      align: 'object-top'
    };
  }

  // 6. Cropped / Capri / Culottes / 3/4 Pants
  if (
    text.includes('capri') ||
    text.includes('cropped') ||
    text.includes('culotte') ||
    text.includes('3/4') ||
    text.includes('קפרי') ||
    text.includes('שבע שמיניות')
  ) {
    return {
      classes: 'top-[44%] left-1/2 w-[66%] h-[36%] z-[10]',
      align: 'object-top'
    };
  }

  // 7. Full Pants / Trousers / Jeans / Leggings / Sweatpants (Default)
  // Anchored at object-bottom so cuffs meet the footwear seamlessly without bare shins
  return {
    classes: 'top-[39%] left-1/2 w-[74%] h-[52.5%] z-[10]',
    align: 'object-bottom'
  };
}

export function getDressTopography(garment) {
  if (!garment) return { classes: 'top-[17.5%] left-1/2 w-[82%] h-[58%] z-[20] drop-shadow-lg', align: 'object-top' };
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();

  // 1. One-Piece Swimsuit / Bodysuit / Monokini
  if (
    text.includes('one_piece') ||
    text.includes('swimsuit') ||
    text.includes('bathing_suit') ||
    text.includes('swimwear') ||
    text.includes('monokini') ||
    text.includes('bodysuit') ||
    text.includes('בגד ים שלם') ||
    text.includes('בגד_ים_שלם') ||
    text.includes('בגדי ים שלמים') ||
    text.includes('слитн_купальник') ||
    text.includes('купальник') ||
    (text.includes('בגד ים') && !text.includes('שני חלקים') && !text.includes('ביקיני'))
  ) {
    return {
      classes: 'top-[17.5%] left-1/2 w-[68%] h-[42%] z-[20] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 2. Mini Dress
  if (
    text.includes('mini_dress') ||
    (text.includes('dress') && text.includes('mini')) ||
    text.includes('שמלת מיני') ||
    text.includes('שמלת_מיני') ||
    text.includes('שמלה קצרה')
  ) {
    return {
      classes: 'top-[17.5%] left-1/2 w-[80%] h-[48%] z-[20] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 3. Maxi Dress / Evening Gown
  if (
    text.includes('maxi_dress') ||
    (text.includes('dress') && (text.includes('maxi') || text.includes('long'))) ||
    text.includes('gown') ||
    text.includes('evening_dress') ||
    text.includes('שמלת מקסי') ||
    text.includes('שמלת_מקסי') ||
    text.includes('שמלת ערב') ||
    text.includes('שמלת_ערב') ||
    text.includes('שמלה ארוכה')
  ) {
    return {
      classes: 'top-[17.5%] left-1/2 w-[84%] h-[72%] z-[20] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 4. Midi Dress (Default)
  return {
    classes: 'top-[17.5%] left-1/2 w-[82%] h-[58%] z-[20] drop-shadow-lg',
    align: 'object-top'
  };
}

export function getTopTopography(garment) {
  if (!garment) return { classes: 'top-[17.5%] left-1/2 w-[82%] h-[35%] z-[20]', align: 'object-top' };
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();

  // 1. Crop tops, sports bras, bralettes, bikini tops
  if (
    text.includes('crop') ||
    text.includes('sports_bra') ||
    text.includes('bralette') ||
    text.includes('bikini_top') ||
    text.includes('חזיית ספורט') ||
    text.includes('חזיית_ספורט') ||
    text.includes('קרופ') ||
    text.includes('חולצת בטן') ||
    text.includes('גופיית בטן')
  ) {
    return {
      classes: 'top-[17.5%] left-1/2 w-[78%] h-[22%] z-[20]',
      align: 'object-top'
    };
  }

  // 2. Standard Top (Default)
  return {
    classes: 'top-[17.5%] left-1/2 w-[82%] h-[35%] z-[20]',
    align: 'object-top'
  };
}

export function getOuterwearTopography(garment) {
  if (!garment) return { classes: 'top-[17.0%] left-1/2 w-[86%] h-[46%] z-[30] drop-shadow-lg', align: 'object-top' };
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();

  // 1. Long coats, trench coats, overcoats, dusters, parkas
  if (
    text.includes('overcoat') ||
    text.includes('trench') ||
    text.includes('duster') ||
    text.includes('מעיל ארוך') ||
    text.includes('טרנץ') ||
    text.includes('пальто') ||
    (text.includes('coat') && (text.includes('long') || text.includes('maxi')))
  ) {
    return {
      classes: 'top-[16.5%] left-1/2 w-[88%] h-[63%] z-[30] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 2. Cropped jackets, shrugs, boleros, vests
  if (
    text.includes('bolero') ||
    text.includes('shrug') ||
    text.includes('vest') ||
    text.includes('gilet') ||
    text.includes('עליונית קצרה') ||
    text.includes('וסט') ||
    (text.includes('jacket') && text.includes('crop'))
  ) {
    return {
      classes: 'top-[17.0%] left-1/2 w-[84%] h-[30%] z-[30] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 3. Standard Jacket / Blazer / Cardigan (Default)
  return {
    classes: 'top-[17.0%] left-1/2 w-[86%] h-[46%] z-[30] drop-shadow-lg',
    align: 'object-top'
  };
}

export default function AvatarViewer2D({ shapeParams = {}, measurements: providedMeasurements, skinColor = '#9CA3AF', sex = 'female', outfitItems = {}, onItemClick, bodyPhotoUrl }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const activeBodyPhotoUrl = resolveMediaUrl(bodyPhotoUrl !== undefined ? (bodyPhotoUrl || null) : (user?.body_photo_url || null));
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
      const subCat = String(itemObj?.sub_category || dbItem?.sub_category || '').toLowerCase();
      const itemType = String(itemObj?.item_type || dbItem?.item_type || '').toLowerCase();
      const name = String(itemObj?.name || itemObj?.title || dbItem?.name || dbItem?.title || '').toLowerCase();
      const allText = `${name} ${subCat} ${itemType} ${category || ''}`.toLowerCase();

      const isOnePieceSwim = allText.includes('one_piece') || allText.includes('שלם') || allText.includes('monokini') || allText.includes('bodysuit') || allText.includes('слитн');
      const isSwimBottom = allText.includes('trunk') || allText.includes('מכנסי ים') || allText.includes('מכנסי_ים') || allText.includes('плавк') || (allText.includes('bikini') && !allText.includes('top') && !allText.includes('חזיי'));
      const isSwimTop = (allText.includes('bikini') && (allText.includes('top') || allText.includes('חזיי'))) || allText.includes('rash_guard') || allText.includes('חולצת_גלישה');

      if (category) {
        const cat = String(category).toLowerCase().trim().replace(/\s+/g, '_');
        // Only map category to slot if role is unspecified or generic
        if (!roleName || roleName === 'item' || roleName === 'garment' || roleName === 'clothing') {
          if (cat === 'top' || cat === 'tops') s = 'top';
          else if (cat === 'bottom' || cat === 'bottoms') s = 'bottom';
          else if (cat === 'footwear' || cat === 'shoes') s = 'shoes';
          else if (cat === 'accessories' || cat === 'accessory') s = 'accessory';
          else if (cat === 'headwear' || cat === 'hat') s = 'headwear';
          else if (cat === 'outerwear' || cat === 'jacket') s = 'outerwear';
          else if (cat === 'dress' || cat === 'dresses') s = 'dress';
          else if (cat === 'swimwear' || cat === 'swim') {
            if (isOnePieceSwim) s = 'dress';
            else if (isSwimTop) s = 'top';
            else s = 'bottom';
          }
          else s = cat;
        }
      }
      if (s === 'swimwear' || s === 'swim') {
        if (isOnePieceSwim) s = 'dress';
        else if (isSwimTop) s = 'top';
        else s = 'bottom';
      }
      if (s === 'hat' || s === 'cap') s = 'headwear';
      if (s === 'accessories') s = 'accessory';
      if (s === 'footwear') s = 'shoes';
      if (s === 'belt') s = 'belt';
      if (s === 'glasses' || s === 'sunglasses' || s === 'eyewear') s = 'glasses';

      const isHat = name.includes('hat') || 
                    name.includes('cap') || 
                    name.includes('beanie') || 
                    name.includes('beret') || 
                    name.includes('fedora') || 
                    name.includes('visor') || 
                    name.includes('flat cap') ||
                    name.includes('bonnet') ||
                    name.includes('bucket hat') ||
                    name.includes('helmet') ||
                    name.includes('כובע') ||
                    name.includes('קובע') ||
                    name.includes('ברט') ||
                    name.includes('מצחייה') ||
                    name.includes('קסקט') ||
                    name.includes('قبعة') ||
                    name.includes('طاقية');
      if (isHat && (s === 'accessory' || s === 'accessories')) {
        s = 'headwear';
      }

      const isBelt = name.includes('belt') ||
                     name.includes('waistband') ||
                     name.includes('חגורה') ||
                     name.includes('חגור') ||
                     name.includes('חגורת') ||
                     name.includes('حزام');
      if (isBelt) {
        s = 'belt';
      }

      const isGlasses = name.includes('glasses') || 
                        name.includes('spectacles') || 
                        name.includes('sunglasses') || 
                        name.includes('eyewear') || 
                        name.includes('shades') ||
                        name.includes('משקפיים') ||
                        name.includes('משקפי') ||
                        name.includes('نظارات') ||
                        name.includes('نظارة');
      if (isGlasses && (s === 'accessory' || s === 'accessories')) {
        s = 'glasses';
      }

      const isBag = name.includes('bag') ||
                    name.includes('backpack') ||
                    name.includes('tote') ||
                    name.includes('clutch') ||
                    name.includes('purse') ||
                    name.includes('satchel') ||
                    name.includes('briefcase') ||
                    name.includes('duffel') ||
                    name.includes('תיק') ||
                    name.includes('ארנק') ||
                    name.includes('حقيبة') ||
                    name.includes('شنطة');
      if (isBag && (s === 'accessory' || s === 'accessories')) {
        s = 'bag';
      }

      const isWatch = name.includes('watch') ||
                      name.includes('timepiece') ||
                      name.includes('wrist') ||
                      name.includes('שעון') ||
                      name.includes('שעוני') ||
                      name.includes('צמיד') ||
                      name.includes('צמידי') ||
                      name.includes('ساعة') ||
                      name.includes('سوار');
      if (isWatch && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment')) {
        s = 'watch';
      }

      // Category / Intrinsic role detectors
      const isShoesByName = /\b(shoes?|sneakers?|boots?|sandals?|heels?|loafers?|slippers?|slides?|mules?|oxford\s+shoes?|oxfords|oxford(?!\s+(shirts?|cloth|cotton|button))|clogs?|נעליים|נעלי|סניקרס|מגפיים|מגפי|מגפונים|סנדלים|עקבים|כפכפים|מוקסינים|حذاء|أحذية|صندل|بوت)\b/i.test(name);
      const isBottomByName = /\b(pants?|cargo|trousers?|jeans?|shorts?|skirts?|sweatpants|joggers?|slacks?|chinos?|leggings?|bermuda|culottes?|trunks?|briefs?|מכנסיים|מכנס|מכנסי|ג'ינס|שורטס|חצאית|חצאיות|טייץ|טייטס|טרנינג|בוקסר|תחתונים|בגד ים|מכנסי ים|ביקיני|بنطلون|بنطال|سروال|شورت|تنورة|جينز)\b/i.test(allText) || isSwimBottom;
      const isTopByName = /\b(shirts?|t-shirts?|tees?|blouses?|sweaters?|hoodies?|sweatshirts?|crop\s+tops?|tank(?:\s+tops?)?|polos?|pullovers?|turtlenecks?|camisoles?|rash_guards?|חולצה|חולצת|חולצות|גופייה|גופיה|גופיות|סוודר|סוודרים|קפוצ'ון|סווטשירט|פולו|מכופתרת|סריג|סריגים|חולצת גלישה|قميص|بلوزة|كنزة|هودي)\b/i.test(allText) || isSwimTop;
      const isOuterwearByName = /\b(jackets?|coats?|blazers?|parkas?|trench(?:coats?)?|overcoats?|windbreakers?|puffers?|anoraks?|vests?|ז'קט|ג'קט|מעיל|מעילים|בלייזר|וסט|מקטורן|עליונית|סטرة|جاكيت|معطف|بليزر)\b/i.test(name);
      const isDressByName = /\b(dresses|dress(?!\s+(pants|trousers|shirts?|shoes?|boots?|code|socks|belt|suit))|gowns?|jumpsuits?|rompers?|dungarees?|overalls?|one_piece|swimsuit|שמלה|שמלת|שמלות|אוברול|סרבל|בגד ים שלם|فستان|فساتين|جمبسوت)\b/i.test(allText) || isOnePieceSwim;
      const isAccessoryByName = isHat || isBelt || isGlasses || isBag || isWatch || /\b(scarves|scarf|neckties?|bow\s*ties?|necklaces?|bracelets?|watches?|earrings?|צעיף|צעיפים|עניבה|עניבות|שרשרת|שרשראות|צמיד|צמידים|שעון|שעונים|עגילים|حزام|قبعة|نظارات|حقيبة|وشاح|ساعة|سوار|قلادة)\b/i.test(name) || /\bties?\b(?!\s*dye)/i.test(name);

      // --- Hard Anatomical Safety Guards (All 5 Categories) ---

      // 1. Footwear Safety Guard: Shoes can ONLY render in 'shoes' slot!
      if (isShoesByName && s !== 'shoes') {
        return null;
      }
      if (s === 'shoes' && !isShoesByName && (isTopByName || isBottomByName || isOuterwearByName || isDressByName || isAccessoryByName)) {
        return null;
      }

      // 2. Bottom Safety Guard: Pants/bottoms can NEVER render on torso, feet, head, face, waist, or bag!
      if (isBottomByName && s !== 'bottom') {
        return null;
      }
      if (s === 'bottom' && !isBottomByName && (isTopByName || isShoesByName || isOuterwearByName || isDressByName || isAccessoryByName)) {
        return null;
      }

      // 3. Top Safety Guard: Tops can NEVER render on legs, feet, head, face, waist, or bag!
      if (isTopByName && !isBottomByName && !isShoesByName) {
        if (s === 'bottom' || s === 'shoes' || s === 'headwear' || s === 'glasses' || s === 'belt' || s === 'bag' || s === 'accessory') {
          return null;
        }
      }

      // 4. Outerwear Safety Guard: Outerwear can NEVER render on legs, feet, head, face, waist, or bag!
      if (isOuterwearByName && !isShoesByName && !isBottomByName) {
        if (s === 'bottom' || s === 'shoes' || s === 'headwear' || s === 'glasses' || s === 'belt' || s === 'bag' || s === 'accessory') {
          return null;
        }
      }

      // 5. Full Body / Dress Safety Guard: Dresses can NEVER render on legs, feet, or accessories!
      if (isDressByName) {
        if (s === 'bottom' || s === 'shoes' || s === 'headwear' || s === 'glasses' || s === 'belt' || s === 'bag' || s === 'accessory') {
          return null;
        }
        if (s === 'top') {
          s = 'dress';
        }
      }

      // 6. Accessories Safety Guard: Accessories can NEVER render in clothing or shoe slots!
      if (isAccessoryByName && !isTopByName && !isBottomByName && !isOuterwearByName && !isDressByName && !isShoesByName) {
        if (s === 'top' || s === 'bottom' || s === 'shoes' || s === 'outerwear' || s === 'dress') {
          return null;
        }
      }

      return s;
    };

    Object.entries(outfitItems || {}).forEach(([role, item]) => {
      if (item) {
        const itemId = item.closet_item_id || item.id;
        const closetItem = allClosetItems.find(it => it && it.id === itemId);
        
        let slot = resolveSlot(role, item, closetItem);
        if (!slot) return;

        if (closetItem && closetItem.group_id) {
          const groupItems = allClosetItems.filter(it => it && it.group_id === closetItem.group_id);
          const categories = new Set(groupItems.map(it => String(it.category || '').toLowerCase().trim()));
          
          if (categories.size > 1) {
            groupItems.forEach(gItem => {
              const gSlot = resolveSlot(gItem.category, gItem, gItem);
              res[gSlot] = {
                url: resolveMediaUrl(bestImageUrl(gItem) || gItem.clean_image_url || gItem.image_data_url || gItem.segmented_image_url || gItem.image_url || gItem.original_image_url),
                placeholder: resolveMediaUrl(gItem.placeholder_data_url || null),
                id: gItem.id,
                category: gItem.category || '',
                sub_category: gItem.sub_category || '',
                item_type: gItem.item_type || '',
                name: gItem.name || gItem.title || ''
              };
            });
            return;
          }
        }
 
        res[slot] = {
           url: resolveMediaUrl(bestImageUrl(item) || item.clean_image_url || item.image_data_url || item.segmented_image_url || item.image_url || item.original_image_url || item.url),
           placeholder: resolveMediaUrl(item.placeholder_data_url || item.placeholder || null),
           id: item.closet_item_id || item.id || null,
           category: item.category || closetItem?.category || '',
           sub_category: item.sub_category || closetItem?.sub_category || '',
           item_type: item.item_type || closetItem?.item_type || '',
           name: item.name || item.title || closetItem?.name || closetItem?.title || ''
        };

      }
    });
    return res;
  }, [outfitItems]);

  const bottomTopo = useMemo(() => getBottomTopography(garments.bottom), [garments.bottom]);
  const dressTopo = useMemo(() => getDressTopography(garments.dress), [garments.dress]);
  const topTopo = useMemo(() => getTopTopography(garments.top), [garments.top]);
  const outerwearTopo = useMemo(() => getOuterwearTopography(garments.outerwear), [garments.outerwear]);

  const renderGarment = (roleKey, altText, extraClasses = '', initial = {}, animate = {}, imgAlignClass = 'object-top', objectFitMode = 'contain') => {
    const garment = garments[roleKey];
    if (!garment || !garment.url) return null;
    const clickable = onItemClick && garment.id;
    return (
      <motion.div
        initial={initial}
        animate={animate}
        className={`absolute drop-shadow-md ${extraClasses} ${clickable ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
        onClick={clickable ? (e) => { e.stopPropagation(); onItemClick(garment.id); } : undefined}
      >
        <ImageWithPlaceholder
          src={garment.url}
          placeholder={garment.placeholder}
          alt={altText}
          objectFit={objectFitMode}
          imgClassName={imgAlignClass}
          className="w-full h-full"
        />
      </motion.div>
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center p-0 shadow-inner group">
      {/* 2D Dynamic Bezier SVG Avatar or Real Body Photo Container */}
      <div className="relative h-full aspect-[1/2] flex items-center justify-center transition-all duration-500">
        {activeBodyPhotoUrl ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={activeBodyPhotoUrl}
              alt={t('profile.bodyPhoto', { defaultValue: 'Full-body photo' })}
              className="w-full h-full object-contain rounded-xl drop-shadow-md"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Render Try-On Garments on top of real body photo */}
            {renderGarment('headwear', t('taxonomy.categories.headwear', { defaultValue: 'Headwear' }), 'top-[4.5%] left-1/2 w-[34%] aspect-square z-[50]', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}
            {renderGarment('glasses', t('taxonomy.categories.glasses', { defaultValue: 'Glasses' }), 'top-[15%] left-1/2 w-[18%] h-[4.5%] z-[45]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('accessory', t('taxonomy.categories.accessory', { defaultValue: 'Accessory' }), 'top-[18%] left-1/2 w-[30%] aspect-square z-[35]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-top', 'contain')}
            {garments.dress && garments.dress.url ? (
              renderGarment('dress', t('taxonomy.categories.dress', { defaultValue: 'Dress' }), dressTopo.classes, { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" }, dressTopo.align, 'contain')
            ) : (
              <>
                {renderGarment('top', t('taxonomy.categories.top', { defaultValue: 'Top' }), topTopo.classes, { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.chest / scales.width }, topTopo.align, 'contain')}
                {renderGarment('bottom', t('taxonomy.categories.bottom', { defaultValue: 'Bottom' }), bottomTopo.classes, { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.hips / scales.width }, bottomTopo.align, 'contain')}
              </>
            )}
            {renderGarment('belt', t('taxonomy.categories.belt', { defaultValue: 'Belt' }), 'top-[41%] left-1/2 w-[62%] h-[5%] z-[25]', { opacity: 0, y: 5, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('outerwear', t('taxonomy.categories.outerwear', { defaultValue: 'Outerwear' }), outerwearTopo.classes, { opacity: 0, scale: 0.96, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" }, outerwearTopo.align, 'contain')}
            {renderGarment('shoes', t('taxonomy.categories.shoes', { defaultValue: 'Shoes' }), 'bottom-[0.5%] left-1/2 w-[76%] h-[16%] z-[15]', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}
            {renderGarment('watch', t('taxonomy.sub_category.watch', { defaultValue: 'Watch' }), 'top-[51%] left-[80%] w-[14%] aspect-square z-[35] drop-shadow-md', { opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }, { opacity: 1, scale: 1, x: "-50%", y: "-50%" }, 'object-center', 'contain')}
            {garments.bag && garments.bag.url && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`absolute top-[44%] right-[-5%] w-[40%] h-[30%] z-[35] drop-shadow-md ${onItemClick && garments.bag.id ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
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
            {renderGarment('headwear', t('taxonomy.categories.headwear', { defaultValue: 'Headwear' }), 'top-[4.5%] left-1/2 w-[34%] aspect-square z-[50]', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}
            {renderGarment('glasses', t('taxonomy.categories.glasses', { defaultValue: 'Glasses' }), 'top-[15%] left-1/2 w-[18%] h-[4.5%] z-[45]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('accessory', t('taxonomy.categories.accessory', { defaultValue: 'Accessory' }), 'top-[18%] left-1/2 w-[30%] aspect-square z-[35]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-top', 'contain')}

            {garments.dress && garments.dress.url ? (
              renderGarment('dress', t('taxonomy.categories.dress', { defaultValue: 'Dress' }), dressTopo.classes, { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" }, dressTopo.align, 'contain')
            ) : (
              <>
                {renderGarment('top', t('taxonomy.categories.top', { defaultValue: 'Top' }), topTopo.classes, { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.chest / scales.width }, topTopo.align, 'contain')}
                {renderGarment('bottom', t('taxonomy.categories.bottom', { defaultValue: 'Bottom' }), bottomTopo.classes, { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%", scaleX: scales.hips / scales.width }, bottomTopo.align, 'contain')}
              </>
            )}

            {renderGarment('belt', t('taxonomy.categories.belt', { defaultValue: 'Belt' }), 'top-[41%] left-1/2 w-[62%] h-[5%] z-[25]', { opacity: 0, y: 5, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('outerwear', t('taxonomy.categories.outerwear', { defaultValue: 'Outerwear' }), outerwearTopo.classes, { opacity: 0, scale: 0.96, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" }, outerwearTopo.align, 'contain')}
            {renderGarment('shoes', t('taxonomy.categories.shoes', { defaultValue: 'Shoes' }), 'bottom-[0.5%] left-1/2 w-[76%] h-[16%] z-[15]', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}
            {renderGarment('watch', t('taxonomy.sub_category.watch', { defaultValue: 'Watch' }), 'top-[51%] left-[80%] w-[14%] aspect-square z-[35] drop-shadow-md', { opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }, { opacity: 1, scale: 1, x: "-50%", y: "-50%" }, 'object-center', 'contain')}

            {garments.bag && garments.bag.url && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`absolute top-[44%] right-[-5%] w-[40%] h-[30%] z-[35] drop-shadow-md ${onItemClick && garments.bag.id ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
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

      {/* Floating Layer Quick-Select Bar on the Mannequin (allows inspecting covered underlayers) */}
      {onItemClick && Object.keys(garments).length > 0 && (
        <div className="absolute top-2.5 end-2.5 flex flex-col gap-1 z-40 bg-background/85 backdrop-blur-md p-1 rounded-xl border border-border shadow-md opacity-85 hover:opacity-100 transition-opacity">
          {['headwear', 'outerwear', 'top', 'dress', 'belt', 'bottom', 'shoes', 'bag', 'accessory'].map((slotKey) => {
            const g = garments[slotKey];
            if (!g || !g.id) return null;
            const slotIcons = {
              headwear: '🧢',
              outerwear: '🧥',
              top: '👕',
              dress: '👗',
              belt: '🥋',
              bottom: '👖',
              shoes: '👞',
              bag: '👜',
              accessory: '🕶️'
            };
            return (
              <button
                key={slotKey}
                type="button"
                onClick={(e) => { e.stopPropagation(); onItemClick(g.id); }}
                className="w-7 h-7 flex items-center justify-center text-xs rounded-lg hover:bg-primary-shadow hover:scale-110 active:scale-95 transition-all"
                title={t(`taxonomy.categories.${slotKey}`, { defaultValue: slotKey })}
                aria-label={t(`taxonomy.categories.${slotKey}`, { defaultValue: slotKey })}
              >
                {slotIcons[slotKey] || '👔'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
