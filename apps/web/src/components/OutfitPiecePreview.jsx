import React, { useId, useMemo, useState, useEffect } from 'react';
import { resolveMediaUrl } from '@/lib/itemImage';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { userStore } from '@/lib/api';
import {
  getFullAvatarAnatomy,
  buildAvatarSvgSilhouettePaths,
  resolveHairProperties,
  computeMorphInfluences,
  getCachedSnapshot,
  snapshotSubscribers,
} from './DynamicAvatar';
import {
  getTopTopography,
  getBottomTopography,
  getOuterwearTopography,
  getDressTopography,
} from './AvatarViewer2D';

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
 * OutfitPiecePreview
 *
 * Lightweight, zero-WebGL, high-performance outfit layout component.
 * Renders the outfit pieces directly overlaying the avatar (at z-[10] through z-[50]),
 * with the avatar positioned underneath at z-[1], matching the live studio layout.
 */
export default function OutfitPiecePreview({
  outfit,
  outfitItems,
  className = '',
  onItemClick,
  sex,
  skinColor,
  measurements,
  shapeParams,
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

  const rawHair = useMemo(() => {
    return hair || effectiveProfile?.hair || storedUser?.hair || {};
  }, [hair, effectiveProfile?.hair, storedUser?.hair]);

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

  const morphInfluences = useMemo(
    () =>
      computeMorphInfluences({
        height: rawMeasurements?.height,
        shoulders: rawMeasurements?.shoulders,
        chest: rawMeasurements?.chest,
        waist: rawMeasurements?.waist,
        hip: rawMeasurements?.hip,
        armLength: rawMeasurements?.armLength,
        inseam: rawMeasurements?.inseam,
        footLength: rawMeasurements?.footLength,
        isMale,
        shapeParams,
        hair: rawHair,
      }),
    [rawMeasurements, isMale, shapeParams, rawHair]
  );

  const avatarSignature = useMemo(() => {
    const morphKey = Object.entries(morphInfluences)
      .map(([k, v]) => `${k}:${Number(v || 0).toFixed(2)}`)
      .join('|');
    return `v6_prop_${isMale ? 'M' : 'F'}_${effectiveSkinColor}_${hairProps.color}_${hairProps.roughness}_${Number(rawMeasurements?.height) || 170}_${morphKey}`;
  }, [isMale, effectiveSkinColor, hairProps.color, hairProps.roughness, rawMeasurements?.height, morphInfluences]);

  const [snapshotUrl, setSnapshotUrl] = useState(() => getCachedSnapshot(avatarSignature));

  useEffect(() => {
    const cached = getCachedSnapshot(avatarSignature);
    if (cached) {
      setSnapshotUrl(cached);
    }
    const handleSnapshot = (sig, dataUrl) => {
      if (sig === avatarSignature) {
        setSnapshotUrl(dataUrl);
      }
    };
    snapshotSubscribers.add(handleSnapshot);
    return () => {
      snapshotSubscribers.delete(handleSnapshot);
    };
  }, [avatarSignature]);

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

  const hasOuterwear = Boolean(slots.outerwear && slots.outerwear.imageUrl);
  const bottomTopo = useMemo(() => getBottomTopography(slots.bottom), [slots.bottom]);
  const dressTopo = useMemo(() => getDressTopography(slots.dress), [slots.dress]);
  const topTopo = useMemo(() => getTopTopography(slots.top, hasOuterwear), [slots.top, hasOuterwear]);
  const outerwearTopo = useMemo(() => getOuterwearTopography(slots.outerwear), [slots.outerwear]);

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
        'relative w-full h-full overflow-hidden select-none flex items-center justify-center bg-gradient-to-b from-stone-50/70 via-stone-100/60 to-stone-200/50 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-800/80',
        className
      )}
      data-testid="outfit-piece-preview"
    >
      {/* 200x450 Coordinate Frame: Locks Avatar and All Garments in 1:1 Anatomical Alignment */}
      <div className="relative h-full w-auto aspect-[200/450] max-h-full max-w-full flex items-center justify-center mx-auto select-none">
        
        {/* ─── Layer 1: Avatar Base (Rendered UNDER all clothing layers at zIndex 1) ─── */}
        {showAvatar && (
          snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 1 }}
            />
          ) : (
            <svg
              viewBox="0 0 200 450"
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              style={{ zIndex: 1 }}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`mannequin-skin-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={effectiveSkinColor} stopOpacity="0.96" />
                  <stop offset="100%" stopColor={effectiveSkinColor} stopOpacity="0.88" />
                </linearGradient>
              </defs>

              {/* Pedestal shadow under feet */}
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

              {/* Modest studio undergarments base */}
              <path
                d={`M ${anatomy.X0 - anatomy.wHip * 0.9},${anatomy.yWaist + (anatomy.yHip - anatomy.yWaist) * 0.45} C ${anatomy.X0} ${anatomy.yWaist + (anatomy.yHip - anatomy.yWaist) * 0.45} ${anatomy.X0} ${anatomy.yWaist + (anatomy.yHip - anatomy.yWaist) * 0.45} ${anatomy.X0 + anatomy.wHip * 0.9},${anatomy.yWaist + (anatomy.yHip - anatomy.yWaist) * 0.45} L ${anatomy.X0 + anatomy.wHip * 0.78},${anatomy.yCrotch + 10} C ${anatomy.X0} ${anatomy.yCrotch + 4} ${anatomy.X0} ${anatomy.yCrotch + 4} ${anatomy.X0 - anatomy.wHip * 0.78},${anatomy.yCrotch + 10} Z`}
                fill="#20242C"
                opacity="0.85"
              />

              {/* Neck / Collarbone line */}
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

              {/* Stylish Hair */}
              <path
                d={hairSvgPath}
                fill={activeHairColor}
                opacity="0.94"
              />
            </svg>
          )
        )}

        {/* ─── Layer 2: Garments OVERLAYING the Avatar (zIndex 10 - 50) ─── */}

        {/* Bottom (Pants, Skirts, Shorts) -> zIndex 10 */}
        {slots.bottom && !hasDress && (
          <div
            className={cn(
              'absolute -translate-x-1/2 pointer-events-none flex items-center justify-center',
              bottomTopo.classes
            )}
            style={{ zIndex: 10 }}
            title={slots.bottom.title || slots.bottom.name}
          >
            <img
              src={slots.bottom.imageUrl}
              alt=""
              loading="lazy"
              className={cn(
                'w-full h-full filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)] transition-transform duration-200',
                bottomTopo.align || 'object-bottom',
                'object-contain'
              )}
            />
          </div>
        )}

        {/* Footwear / Shoes -> zIndex 15 */}
        {slots.shoes && (
          <div
            className="absolute bottom-[0.5%] left-1/2 -translate-x-1/2 w-[76%] h-[16%] pointer-events-none flex items-center justify-center"
            style={{ zIndex: 15 }}
            title={slots.shoes.title || slots.shoes.name}
          >
            <img
              src={slots.shoes.imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-contain object-bottom filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.14)] transition-transform duration-200"
            />
          </div>
        )}

        {/* Dress Mode -> zIndex 20 */}
        {hasDress && (
          <div
            className={cn(
              'absolute -translate-x-1/2 pointer-events-none flex items-center justify-center',
              dressTopo.classes
            )}
            style={{ zIndex: 20 }}
            title={slots.dress.title || slots.dress.name}
          >
            <img
              src={slots.dress.imageUrl}
              alt=""
              loading="lazy"
              className={cn(
                'w-full h-full filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.14)] transition-transform duration-200',
                dressTopo.align || 'object-top',
                'object-contain'
              )}
            />
          </div>
        )}

        {/* Top (Shirts, Tees, Blouses, Sweaters) -> zIndex 20 */}
        {slots.top && !hasDress && (
          <div
            className={cn(
              'absolute -translate-x-1/2 pointer-events-none flex items-center justify-center',
              topTopo.classes
            )}
            style={{ zIndex: 20 }}
            title={slots.top.title || slots.top.name}
          >
            <img
              src={slots.top.imageUrl}
              alt=""
              loading="lazy"
              className={cn(
                'w-full h-full filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)] transition-transform duration-200',
                topTopo.align || 'object-top',
                'object-contain'
              )}
            />
          </div>
        )}

        {/* Belt -> zIndex 25 */}
        {slots.belt && (
          <div
            className="absolute top-[41%] left-1/2 -translate-x-1/2 w-[62%] h-[5%] pointer-events-none flex items-center justify-center"
            style={{ zIndex: 25 }}
            title={slots.belt.title || slots.belt.name}
          >
            <img
              src={slots.belt.imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-contain object-center filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.14)]"
            />
          </div>
        )}

        {/* Outerwear (Jackets, Blazers, Coats, Cardigans) -> zIndex 30 */}
        {slots.outerwear && (
          <div
            className={cn(
              'absolute -translate-x-1/2 pointer-events-none flex items-center justify-center',
              outerwearTopo.classes
            )}
            style={{ zIndex: 30 }}
            title={slots.outerwear.title || slots.outerwear.name}
          >
            <img
              src={slots.outerwear.imageUrl}
              alt=""
              loading="lazy"
              className={cn(
                'w-full h-full filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.16)] transition-transform duration-200',
                outerwearTopo.align || 'object-top',
                'object-contain'
              )}
            />
          </div>
        )}

        {/* Bag -> zIndex 35 */}
        {slots.bag && (
          <div
            className="absolute top-[44%] right-[-6%] w-[38%] h-[30%] pointer-events-none flex items-center justify-center"
            style={{ zIndex: 35 }}
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

        {/* Headwear -> zIndex 50 */}
        {slots.headwear && (
          <div
            className="absolute top-[3.5%] left-1/2 -translate-x-1/2 w-[34%] aspect-square pointer-events-none flex items-center justify-center"
            style={{ zIndex: 50 }}
            title={slots.headwear.title || slots.headwear.name}
          >
            <img
              src={slots.headwear.imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-contain object-bottom filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.12)] transition-transform duration-200"
            />
          </div>
        )}

        {/* Fallback for unclassified single items */}
        {!slots.top && !slots.bottom && !slots.dress && !slots.outerwear && slots.others.length > 0 && (
          <div
            className="absolute inset-0 p-4 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 20 }}
          >
            <img
              src={slots.others[0].imageUrl}
              alt=""
              loading="lazy"
              className="max-w-[85%] max-h-[85%] object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.14)]"
            />
          </div>
        )}

      </div>
    </div>
  );
}
