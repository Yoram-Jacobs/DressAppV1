import React, { useId, useMemo } from 'react';
import { resolveMediaUrl } from '@/lib/itemImage';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { userStore } from '@/lib/api';
import {
  getFullAvatarAnatomy,
  buildAvatarSvgSilhouettePaths,
  resolveHairProperties,
} from './DynamicAvatar';

/**
 * Normalizes an outfit piece to get its transparent studio image URL.
 */
function getPieceImageUrl(piece) {
  if (!piece) return null;
  const raw =
    piece.cutout_url ||
    piece.reconstruct_image_url ||
    piece.reconstructed_image_url ||
    piece.clean_image_url ||
    piece.segmented_image_url ||
    piece.image_url ||
    piece.thumbnail_data_url ||
    piece.photo_url ||
    null;
  return resolveMediaUrl(raw);
}

/**
 * Resolves a piece's anatomical clothing role (top, bottom, shoes, dress, outerwear, etc.)
 */
function categorizePiece(piece, roleHint = '') {
  if (!piece) return 'accessory';
  const role = String(piece.role || roleHint || '').toLowerCase().trim();
  if (role === 'top' || role === 'upper' || role === 'shirt') return 'top';
  if (role === 'bottom' || role === 'lower' || role === 'pants' || role === 'trousers' || role === 'skirt') return 'bottom';
  if (role === 'shoes' || role === 'shoe' || role === 'footwear') return 'shoes';
  if (role === 'dress' || role === 'dresses' || role === 'full_body' || role === 'one_piece') return 'dress';
  if (role === 'outerwear' || role === 'jacket' || role === 'coat' || role === 'blazer') return 'outerwear';
  if (role === 'headwear' || role === 'hat' || role === 'cap') return 'headwear';
  if (role === 'bag' || role === 'bags') return 'bag';
  if (role === 'belt') return 'belt';

  const category = String(piece.category || '').toLowerCase().trim();
  const subCategory = String(piece.sub_category || '').toLowerCase().trim();
  const title = String(piece.name || piece.title || '').toLowerCase().trim();
  const text = `${category} ${subCategory} ${title}`;

  if (/\b(dresses?|gowns?|jumpsuits?|rompers?|overalls?|one_piece|שמלה|שמלות|אוברול|فستان)\b/i.test(text)) {
    return 'dress';
  }
  if (/\b(jackets?|coats?|blazers?|parkas?|vests?|מעיל|ז'קט|ג'קט|בלייזר|וסט|جاكيت|معطف)\b/i.test(text)) {
    return 'outerwear';
  }
  if (/\b(shoes?|sneakers?|boots?|sandals?|heels?|loafers?|slippers?|נעליים|סניקרס|מגפיים|סנדלים|עקבים|מוקסינים|חذاء|أحذية)\b/i.test(text)) {
    return 'shoes';
  }
  if (/\b(pants?|jeans?|trousers?|shorts?|skirts?|joggers?|sweatpants?|מכנסיים|מכנס|ג'ינס|שורטס|חצאית|טייץ|טרנינג|بنطال|تنورة)\b/i.test(text)) {
    return 'bottom';
  }
  if (/\b(shirts?|tees?|t-shirts?|tops?|blouses?|sweaters?|hoodies?|polos?|חולצה|חולצות|גופייה|סוודר|קפוצ'ון|סריג|قميص|بلوزة|كنزة)\b/i.test(text)) {
    return 'top';
  }
  if (/\b(hats?|caps?|beanies?|berets?|כובע|קסקט|ברט|קובע|קפלוש|טמבל|כיפה|טרבוש|قبعة)\b/i.test(text)) {
    return 'headwear';
  }
  if (/\b(bags?|backpacks?|totes?|purses?|תיק|ארנק|תרמיל|ילקוט|حقيبة|شنطة)\b/i.test(text)) {
    return 'bag';
  }
  if (/\b(belts?|חגורה|חגורות|حزام)\b/i.test(text)) {
    return 'belt';
  }

  return 'accessory';
}

/**
 * Builds a chic cropped hairstyle for male avatar.
 */
function buildMaleHairSvg(anatomy) {
  const { X0, yHeadTop, yChin } = anatomy;
  const headHeight = yChin - yHeadTop;
  const headWidth = headHeight * 0.68;
  return [
    `M ${X0 - headWidth * 0.95},${yHeadTop + headHeight * 0.40}`,
    `C ${X0 - headWidth * 1.02},${yHeadTop + headHeight * 0.12} ${X0 - headWidth * 0.6},${yHeadTop - 5} ${X0},${yHeadTop - 5}`,
    `C ${X0 + headWidth * 0.6},${yHeadTop - 5} ${X0 + headWidth * 1.02},${yHeadTop + headHeight * 0.12} ${X0 + headWidth * 0.95},${yHeadTop + headHeight * 0.40}`,
    `C ${X0 + headWidth * 0.88},${yHeadTop + headHeight * 0.44} ${X0 + headWidth * 0.80},${yHeadTop + headHeight * 0.28} ${X0 + headWidth * 0.52},${yHeadTop + headHeight * 0.22}`,
    `C ${X0 + headWidth * 0.20},${yHeadTop + headHeight * 0.18} ${X0 - headWidth * 0.20},${yHeadTop + headHeight * 0.18} ${X0 - headWidth * 0.52},${yHeadTop + headHeight * 0.22}`,
    `C ${X0 - headWidth * 0.80},${yHeadTop + headHeight * 0.28} ${X0 - headWidth * 0.88},${yHeadTop + headHeight * 0.44} ${X0 - headWidth * 0.95},${yHeadTop + headHeight * 0.40}`,
    `Z`,
  ].join(' ');
}

/**
 * Builds an elegant modern hairstyle for female avatar.
 */
function buildFemaleHairSvg(anatomy) {
  const { X0, yHeadTop, yChin } = anatomy;
  const headHeight = yChin - yHeadTop;
  const headWidth = headHeight * 0.68;
  return [
    `M ${X0 - headWidth * 1.05},${yHeadTop + headHeight * 0.70}`,
    `C ${X0 - headWidth * 1.08},${yHeadTop + headHeight * 0.20} ${X0 - headWidth * 0.70},${yHeadTop - 6} ${X0},${yHeadTop - 6}`,
    `C ${X0 + headWidth * 0.70},${yHeadTop - 6} ${X0 + headWidth * 1.08},${yHeadTop + headHeight * 0.20} ${X0 + headWidth * 1.05},${yHeadTop + headHeight * 0.70}`,
    `C ${X0 + headWidth * 0.90},${yHeadTop + headHeight * 0.80} ${X0 + headWidth * 0.78},${yHeadTop + headHeight * 0.38} ${X0 + headWidth * 0.48},${yHeadTop + headHeight * 0.22}`,
    `C ${X0 + headWidth * 0.15},${yHeadTop + headHeight * 0.16} ${X0 - headWidth * 0.15},${yHeadTop + headHeight * 0.16} ${X0 - headWidth * 0.48},${yHeadTop + headHeight * 0.22}`,
    `C ${X0 - headWidth * 0.78},${yHeadTop + headHeight * 0.38} ${X0 - headWidth * 0.90},${yHeadTop + headHeight * 0.80} ${X0 - headWidth * 1.05},${yHeadTop + headHeight * 0.70}`,
    `Z`,
  ].join(' ');
}

/**
 * Builds modest activewear underwear paths for the studio mannequin.
 */
function buildUnderwearPaths(anatomy, isMale) {
  const { X0, yChest, yWaist, yHip, yCrotch, wChest, wWaist, wHip } = anatomy;

  const topBand = !isMale
    ? [
        `M ${X0 - wChest * 0.88},${yChest - 8}`,
        `C ${X0 - wChest * 0.4},${yChest - 12} ${X0 + wChest * 0.4},${yChest - 12} ${X0 + wChest * 0.88},${yChest - 8}`,
        `C ${X0 + wChest * 0.82},${yChest + 18} ${X0 + wWaist * 0.8},${yWaist - 6} ${X0 + wWaist * 0.75},${yWaist - 4}`,
        `C ${X0 + wWaist * 0.3},${yWaist - 2} ${X0 - wWaist * 0.3},${yWaist - 2} ${X0 - wWaist * 0.75},${yWaist - 4}`,
        `C ${X0 - wWaist * 0.8},${yWaist - 6} ${X0 - wChest * 0.82},${yChest + 18} ${X0 - wChest * 0.88},${yChest - 8}`,
        `Z`,
      ].join(' ')
    : null;

  const yShortsTop = yWaist + (yHip - yWaist) * 0.45;
  const yShortsBottom = yCrotch + 10;
  const shortsPath = [
    `M ${X0 - wHip * 0.92},${yShortsTop}`,
    `C ${X0 - wHip * 0.4},${yShortsTop + 1} ${X0 + wHip * 0.4},${yShortsTop + 1} ${X0 + wHip * 0.92},${yShortsTop}`,
    `C ${X0 + wHip * 0.96},${yShortsTop + (yShortsBottom - yShortsTop) * 0.5} ${X0 + wHip * 0.85},${yShortsBottom - 2} ${X0 + wHip * 0.78},${yShortsBottom}`,
    `C ${X0 + wHip * 0.45},${yShortsBottom + 2} ${X0 + 10},${yShortsBottom - 4} ${X0},${yCrotch + 4}`,
    `C ${X0 - 10},${yShortsBottom - 4} ${X0 - wHip * 0.45},${yShortsBottom + 2} ${X0 - wHip * 0.78},${yShortsBottom}`,
    `C ${X0 - wHip * 0.85},${yShortsBottom - 2} ${X0 - wHip * 0.96},${yShortsTop + (yShortsBottom - yShortsTop) * 0.5} ${X0 - wHip * 0.92},${yShortsTop}`,
    `Z`,
  ].join(' ');

  return { topBand, shortsPath };
}

/**
 * OutfitPiecePreview
 *
 * Lightweight, zero-WebGL, high-performance outfit layout component.
 * Renders the outfit pieces directly fitted onto the user's anatomical mannequin
 * with zero bottleneck, instant rendering, and accurate proportions.
 */
export default function OutfitPiecePreview({
  outfit,
  outfitItems,
  className = '',
  onItemClick,
  sex,
  skinColor,
  measurements,
  hair,
  showAvatar = true,
}) {
  const reactUid = useId();
  const uid = reactUid ? reactUid.replace(/:/g, '') : 'prev';

  // User profile resolution with instant local fallback
  const { user } = useAuth?.() || {};
  const storedUser = user || userStore?.get?.() || {};
  const effectiveProfile = storedUser?.profile || storedUser || {};

  const effectiveSex =
    sex ||
    effectiveProfile?.sex ||
    effectiveProfile?.gender ||
    storedUser?.sex ||
    storedUser?.gender ||
    'female';
  const isMale = String(effectiveSex).toLowerCase() === 'male';

  const rawSkin =
    skinColor ||
    effectiveProfile?.skin_tone ||
    effectiveProfile?.skinColor ||
    storedUser?.skin_tone ||
    '#E0AC69';
  const effectiveSkinColor =
    String(rawSkin).trim().toLowerCase() === '#9ca3af' ? '#E0AC69' : rawSkin;

  const rawMeasurements =
    measurements ||
    effectiveProfile?.body_measurements ||
    effectiveProfile?.measurements ||
    storedUser?.body_measurements ||
    storedUser?.measurements ||
    {};

  const rawHair =
    hair ||
    effectiveProfile?.hair ||
    storedUser?.hair ||
    {};

  const anatomy = useMemo(() => {
    return getFullAvatarAnatomy({
      height: rawMeasurements?.height,
      shoulders: rawMeasurements?.shoulders,
      chest: rawMeasurements?.chest,
      waist: rawMeasurements?.waist,
      hip: rawMeasurements?.hip,
      armLength: rawMeasurements?.armLength,
      inseam: rawMeasurements?.inseam,
      footLength: rawMeasurements?.footLength,
      gender: effectiveSex,
    });
  }, [
    rawMeasurements?.height,
    rawMeasurements?.shoulders,
    rawMeasurements?.chest,
    rawMeasurements?.waist,
    rawMeasurements?.hip,
    rawMeasurements?.armLength,
    rawMeasurements?.inseam,
    rawMeasurements?.footLength,
    effectiveSex,
  ]);

  const svgPaths = useMemo(() => buildAvatarSvgSilhouettePaths(anatomy), [anatomy]);
  const hairProps = useMemo(() => resolveHairProperties(rawHair, isMale), [rawHair, isMale]);
  const hairSvgPath = useMemo(
    () => (isMale ? buildMaleHairSvg(anatomy) : buildFemaleHairSvg(anatomy)),
    [anatomy, isMale]
  );
  const underwearPaths = useMemo(() => buildUnderwearPaths(anatomy, isMale), [anatomy, isMale]);

  // Extract and categorize items into slots
  const slots = useMemo(() => {
    const rawList = [];

    if (outfitItems && typeof outfitItems === 'object') {
      Object.entries(outfitItems).forEach(([key, val]) => {
        if (val) rawList.push({ piece: val, roleHint: key.split('_')[0] });
      });
    } else if (outfit) {
      const garments = Array.isArray(outfit.garments) && outfit.garments.length > 0
        ? outfit.garments
        : (Array.isArray(outfit.items) ? outfit.items : []);
      garments.forEach((g) => {
        if (g) rawList.push({ piece: g, roleHint: g.role || g.category });
      });
    }

    const categorized = {
      headwear: null,
      outerwear: null,
      top: null,
      dress: null,
      bottom: null,
      shoes: null,
      bag: null,
      belt: null,
      others: [],
    };

    rawList.forEach(({ piece, roleHint }) => {
      const slot = categorizePiece(piece, roleHint);
      const url = getPieceImageUrl(piece);
      if (!url) return;

      const itemData = {
        ...piece,
        imageUrl: url,
      };

      if (slot === 'dress') {
        if (!categorized.dress) categorized.dress = itemData;
      } else if (slot === 'top') {
        if (!categorized.top) categorized.top = itemData;
      } else if (slot === 'bottom') {
        if (!categorized.bottom) categorized.bottom = itemData;
      } else if (slot === 'shoes') {
        if (!categorized.shoes) categorized.shoes = itemData;
      } else if (slot === 'outerwear') {
        if (!categorized.outerwear) categorized.outerwear = itemData;
      } else if (slot === 'headwear') {
        if (!categorized.headwear) categorized.headwear = itemData;
      } else if (slot === 'bag') {
        if (!categorized.bag) categorized.bag = itemData;
      } else if (slot === 'belt') {
        if (!categorized.belt) categorized.belt = itemData;
      } else {
        categorized.others.push(itemData);
      }
    });

    return categorized;
  }, [outfit, outfitItems]);

  const hasDress = Boolean(slots.dress);
  const totalPlaced =
    (slots.headwear ? 1 : 0) +
    (slots.outerwear ? 1 : 0) +
    (slots.top ? 1 : 0) +
    (slots.dress ? 1 : 0) +
    (slots.bottom ? 1 : 0) +
    (slots.shoes ? 1 : 0) +
    (slots.bag ? 1 : 0) +
    (slots.belt ? 1 : 0) +
    slots.others.length;

  if (totalPlaced === 0 && !showAvatar) {
    return (
      <div
        className={cn(
          'relative w-full h-full flex items-center justify-center bg-stone-100/80 dark:bg-stone-900/40 text-stone-400 text-xs select-none',
          className
        )}
        data-testid="outfit-piece-preview-empty"
      >
        <span className="text-2xl opacity-40">👔</span>
      </div>
    );
  }

  const activeHairColor = hairProps?.color || (isMale ? '#181412' : '#3B2316');

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden select-none bg-gradient-to-b from-stone-50/70 via-stone-100/60 to-stone-200/50 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-800/80',
        className
      )}
      data-testid="outfit-piece-preview"
    >
      {/* Anatomical Mannequin Avatar Base (Zero-WebGL, Instant 0ms Render) */}
      {showAvatar && (
        <svg
          viewBox="0 0 200 450"
          className="absolute inset-0 w-full h-full pointer-events-none z-[2] select-none"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`mannequin-skin-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={effectiveSkinColor} stopOpacity="0.96" />
              <stop offset="100%" stopColor={effectiveSkinColor} stopOpacity="0.88" />
            </linearGradient>
            <filter id={`mannequin-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Pedestal / ground shadow under feet */}
          <ellipse
            cx={anatomy.X0}
            cy={anatomy.yFeet + 3}
            rx={Math.max(26, anatomy.wHip * 0.85)}
            ry={5}
            fill="rgba(0, 0, 0, 0.08)"
          />

          {/* Left & Right Arms */}
          <g fill={`url(#mannequin-skin-${uid})`} stroke="rgba(0,0,0,0.06)" strokeWidth="0.6">
            <path d={svgPaths.armPathL} />
            <path d={svgPaths.armPathR} />
          </g>

          {/* Torso & Legs Body */}
          <path
            d={svgPaths.bodyPath}
            fill={`url(#mannequin-skin-${uid})`}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="0.6"
          />

          {/* Modest studio undergarments base (matches 3D dressing room modesty activewear) */}
          <g fill="#20242C" opacity="0.92">
            {underwearPaths.topBand && !hasDress && !slots.top && (
              <path d={underwearPaths.topBand} />
            )}
            {underwearPaths.shortsPath && !hasDress && !slots.bottom && (
              <path d={underwearPaths.shortsPath} />
            )}
          </g>

          {/* Neck / Collarbone subtle lines */}
          <path
            d={`M ${anatomy.X0 - anatomy.wNeck * 1.2} ${anatomy.yShoulders + 4} Q ${anatomy.X0} ${anatomy.yShoulders + 9} ${anatomy.X0 + anatomy.wNeck * 1.2} ${anatomy.yShoulders + 4}`}
            fill="none"
            stroke="rgba(0, 0, 0, 0.12)"
            strokeWidth="0.75"
            strokeLinecap="round"
          />

          {/* Head */}
          <path
            d={svgPaths.headPath}
            fill={`url(#mannequin-skin-${uid})`}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="0.6"
          />

          {/* Stylish Hair Silhouette */}
          <path
            d={hairSvgPath}
            fill={activeHairColor}
            opacity="0.94"
          />

          {/* Minimalist Mannequin Eyes and Lips hint */}
          <g stroke="rgba(0, 0, 0, 0.18)" strokeWidth="0.8" strokeLinecap="round" fill="none">
            <line
              x1={anatomy.X0 - 11}
              y1={anatomy.yHeadTop + (anatomy.yChin - anatomy.yHeadTop) * 0.48}
              x2={anatomy.X0 - 4}
              y2={anatomy.yHeadTop + (anatomy.yChin - anatomy.yHeadTop) * 0.48}
            />
            <line
              x1={anatomy.X0 + 4}
              y1={anatomy.yHeadTop + (anatomy.yChin - anatomy.yHeadTop) * 0.48}
              x2={anatomy.X0 + 11}
              y2={anatomy.yHeadTop + (anatomy.yChin - anatomy.yHeadTop) * 0.48}
            />
            <line
              x1={anatomy.X0 - 5}
              y1={anatomy.yHeadTop + (anatomy.yChin - anatomy.yHeadTop) * 0.78}
              x2={anatomy.X0 + 5}
              y2={anatomy.yHeadTop + (anatomy.yChin - anatomy.yHeadTop) * 0.78}
            />
          </g>
        </svg>
      )}

      {/* Headwear */}
      {slots.headwear && (
        <div
          className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[34%] h-[15%] z-30 pointer-events-none flex items-center justify-center"
          title={slots.headwear.title || slots.headwear.name}
        >
          <img
            src={slots.headwear.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.12)] transition-transform duration-200"
          />
        </div>
      )}

      {/* Dress Mode */}
      {hasDress ? (
        <div
          className="absolute top-[11%] left-1/2 -translate-x-1/2 w-[72%] h-[72%] z-15 pointer-events-none flex items-center justify-center"
          title={slots.dress.title || slots.dress.name}
        >
          <img
            src={slots.dress.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.14)] transition-transform duration-200"
          />
        </div>
      ) : (
        <>
          {/* Bottom */}
          {slots.bottom && (
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center z-12',
                slots.top
                  ? 'top-[41%] w-[64%] h-[46%]'
                  : 'top-[41%] w-[64%] h-[48%]'
              )}
              title={slots.bottom.title || slots.bottom.name}
            >
              <img
                src={slots.bottom.imageUrl}
                alt=""
                loading="lazy"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)] transition-transform duration-200"
              />
            </div>
          )}

          {/* Top */}
          {slots.top && (
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center z-16',
                slots.bottom
                  ? 'top-[9%] w-[70%] h-[44%]'
                  : 'top-[10%] w-[70%] h-[46%]'
              )}
              title={slots.top.title || slots.top.name}
            >
              <img
                src={slots.top.imageUrl}
                alt=""
                loading="lazy"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)] transition-transform duration-200"
              />
            </div>
          )}
        </>
      )}

      {/* Outerwear (Jackets, Blazers, Coats) */}
      {slots.outerwear && (
        <div
          className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[78%] h-[50%] z-22 pointer-events-none flex items-center justify-center"
          title={slots.outerwear.title || slots.outerwear.name}
        >
          <img
            src={slots.outerwear.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.16)] transition-transform duration-200"
          />
        </div>
      )}

      {/* Belt */}
      {slots.belt && (
        <div
          className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[56%] h-[6%] z-25 pointer-events-none flex items-center justify-center"
          title={slots.belt.title || slots.belt.name}
        >
          <img
            src={slots.belt.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.14)]"
          />
        </div>
      )}

      {/* Footwear / Shoes */}
      {slots.shoes && (
        <div
          className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[62%] h-[17%] z-20 pointer-events-none flex items-center justify-center"
          title={slots.shoes.title || slots.shoes.name}
        >
          <img
            src={slots.shoes.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.14)] transition-transform duration-200"
          />
        </div>
      )}

      {/* Bag */}
      {slots.bag && (
        <div
          className="absolute bottom-[16%] right-[3%] w-[28%] h-[26%] z-26 pointer-events-none flex items-center justify-center"
          title={slots.bag.title || slots.bag.name}
        >
          <img
            src={slots.bag.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.16)]"
          />
        </div>
      )}

      {/* Single item fallback if neither top/bottom/dress were matched */}
      {!slots.top && !slots.bottom && !slots.dress && !slots.outerwear && slots.others.length > 0 && (
        <div className="absolute inset-0 p-4 flex items-center justify-center pointer-events-none z-10">
          <img
            src={slots.others[0].imageUrl}
            alt=""
            loading="lazy"
            className="max-w-[85%] max-h-[85%] object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.14)]"
          />
        </div>
      )}
    </div>
  );
}
