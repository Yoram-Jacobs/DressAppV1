import React, { useMemo } from 'react';
import { resolveMediaUrl } from '@/lib/itemImage';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { userStore } from '@/lib/api';
import DynamicAvatar from './DynamicAvatar';
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
 * OutfitPiecePreview
 *
 * High-performance outfit card component for Saved Outfits & Daily Suggestions.
 * Renders the canonical 3D DynamicAvatar (using shared WebGL snapshot pooling)
 * at Layer 1 (z-[1]), and overlays the outfit pieces directly on top (z-[10]..z-[50]).
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

  const effectiveShapeParams =
    shapeParams ||
    effectiveProfile?.shape_params ||
    effectiveProfile?.shapeParams ||
    storedUser?.avatar_shape_params ||
    {};

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

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden select-none flex items-center justify-center bg-gradient-to-b from-stone-50/70 via-stone-100/60 to-stone-200/50 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-800/80',
        className
      )}
      data-testid="outfit-piece-preview"
    >
      {/* 200x450 Coordinate Frame: Locks 3D Avatar and All Garments in 1:1 Anatomical Alignment */}
      <div className="relative h-full w-auto aspect-[200/450] max-h-full max-w-full flex items-center justify-center mx-auto select-none">
        
        {/* ─── Layer 1: Canonical 3D Avatar Base (Rendered UNDER all clothing layers at zIndex 1) ─── */}
        {showAvatar && (
          <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <DynamicAvatar
              height={rawMeasurements?.height}
              shoulders={rawMeasurements?.shoulders}
              chest={rawMeasurements?.chest}
              waist={rawMeasurements?.waist}
              hip={rawMeasurements?.hip || rawMeasurements?.hips}
              armLength={rawMeasurements?.armLength || rawMeasurements?.arm_length}
              inseam={rawMeasurements?.inseam}
              footLength={rawMeasurements?.footLength}
              gender={effectiveSex}
              skinColor={effectiveSkinColor}
              hair={rawHair}
              shapeParams={effectiveShapeParams}
              showGuideLines={false}
              interactive={false}
              className="h-full w-auto aspect-[200/450] max-h-full max-w-full mx-auto"
            />
          </div>
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
