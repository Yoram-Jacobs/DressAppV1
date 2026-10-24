import React, { useMemo } from 'react';
import { resolveMediaUrl } from '@/lib/itemImage';
import { cn } from '@/lib/utils';

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
 * Lightweight, zero-WebGL, high-performance outfit layout component.
 * Renders the outfit pieces in a clean, layered studio composition with zero bottleneck.
 */
export default function OutfitPiecePreview({
  outfit,
  outfitItems,
  className = '',
  onItemClick,
}) {
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

  if (totalPlaced === 0) {
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
        'relative w-full h-full overflow-hidden select-none bg-gradient-to-b from-stone-50/70 via-stone-100/60 to-stone-200/50 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-800/80',
        className
      )}
      data-testid="outfit-piece-preview"
    >
      {/* Headwear */}
      {slots.headwear && (
        <div
          className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[32%] h-[15%] z-30 pointer-events-none flex items-center justify-center"
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
          className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[72%] h-[72%] z-10 pointer-events-none flex items-center justify-center"
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
          {/* Top */}
          {slots.top && (
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center',
                slots.bottom
                  ? 'top-[9%] w-[70%] h-[44%] z-15'
                  : 'top-[16%] w-[76%] h-[58%] z-15'
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

          {/* Bottom */}
          {slots.bottom && (
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center',
                slots.top
                  ? 'top-[42%] w-[64%] h-[46%] z-10'
                  : 'top-[22%] w-[72%] h-[62%] z-10'
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
        </>
      )}

      {/* Outerwear (Jackets, Blazers, Coats) */}
      {slots.outerwear && (
        <div
          className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[78%] h-[50%] z-20 pointer-events-none flex items-center justify-center"
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
          className="absolute bottom-[16%] right-[3%] w-[28%] h-[26%] z-25 pointer-events-none flex items-center justify-center"
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
