import { useMemo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { bestImageUrl, resolveMediaUrl } from '@/lib/itemImage';
import { closetStore } from '@/lib/closetStore';
import { useAuth } from '@/lib/auth';
import ImageWithPlaceholder from '@/components/ImageWithPlaceholder';
import DynamicAvatar, {
  getAvatarGeometry,
  getFullAvatarAnatomy,
  getDefaultAvatarAnatomy,
  warpDefaultAvatarPoint,
} from '@/components/DynamicAvatar';

const DressingRoom3D = lazy(() => import('./DressingRoom3D'));
import {
  ONBOARDING_DATASET_BY_ID,
  ONBOARDING_STATIC_DATASET,
} from '@/lib/onboardingDataset';
import {
  fitClosetGarmentToDefaultAvatar,
  extractBodyPhotoAnatomy,
} from '@/lib/closetGarmentFitter';

const FITTED_AVATAR_SLOTS = new Set(['dress', 'top', 'bottom', 'outerwear', 'shoes']);

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

export function isStraplessGarment(garment) {
  if (!garment) return false;
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();
  return (
    text.includes('strapless') ||
    text.includes('tube_top') ||
    text.includes('tube top') ||
    text.includes('tube_dress') ||
    text.includes('tube dress') ||
    text.includes('bandeau') ||
    text.includes('סטרפלס') ||
    text.includes('חולצת_צינור') ||
    text.includes('חולצת צינור') ||
    text.includes('שמלת_צינור') ||
    text.includes('שמלת צינור') ||
    text.includes('בנדו') ||
    text.includes('بدון حمالات') ||
    text.includes('سترابلس') ||
    text.includes('без бретелей') ||
    text.includes('trägerlos') ||
    text.includes('sin tirantes') ||
    text.includes('sans bretelles')
  );
}

export function getDressTopography(garment) {
  if (!garment) return { classes: 'top-[17.0%] left-1/2 w-[82%] h-[64%] z-[20] drop-shadow-lg', align: 'object-top' };
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();

  // Strapless dresses / jumpsuits anchored lower at bust line (strapless garments excluded from shoulder anchor)
  if (isStraplessGarment(garment)) {
    return {
      classes: 'top-[30%] left-1/2 w-[80%] h-[60%] z-[20] drop-shadow-lg',
      align: 'object-top'
    };
  }

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
      classes: 'top-[17.0%] left-1/2 w-[80%] h-[48%] z-[20] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 3. Maxi Dress / Evening Gown / Full-body Jumpsuit / Galabia / Thobe / Kaftan
  if (
    text.includes('maxi_dress') ||
    (text.includes('dress') && (text.includes('maxi') || text.includes('long'))) ||
    text.includes('gown') ||
    text.includes('evening_dress') ||
    text.includes('jumpsuit') ||
    text.includes('אוברול') ||
    text.includes('גלבייה') ||
    text.includes('galabiya') ||
    text.includes('galabia') ||
    text.includes('jalabiya') ||
    text.includes('thobe') ||
    text.includes('kandura') ||
    text.includes('dishdasha') ||
    text.includes('abaya') ||
    text.includes('saree') ||
    text.includes('sari') ||
    text.includes('kurta set') ||
    text.includes('kurta pyjama') ||
    text.includes('business suit') ||
    text.includes('three-piece suit') ||
    text.includes('kaftan') ||
    text.includes('caftan') ||
    text.includes('שמלת מקסי') ||
    text.includes('שמלת_מקסי') ||
    text.includes('שמלת ערב') ||
    text.includes('שמלת_ערב') ||
    text.includes('שמלה ארוכה')
  ) {
    return {
      classes: 'top-[17.0%] left-1/2 w-[84%] h-[74%] z-[20] drop-shadow-lg',
      align: 'object-top'
    };
  }

  // 4. Midi Dress (Default)
  return {
    classes: 'top-[17.0%] left-1/2 w-[82%] h-[64%] z-[20] drop-shadow-lg',
    align: 'object-top'
  };
}

export function getTopTopography(garment, hasOuterwear = false) {
  if (!garment) {
    return {
      classes: hasOuterwear
        ? 'top-[17.5%] left-1/2 w-[72%] h-[38%] z-[20]'
        : 'top-[17.5%] left-1/2 w-[82%] h-[38%] z-[20]',
      align: 'object-top'
    };
  }
  const text = `${garment.sub_category || ''} ${garment.item_type || ''} ${garment.name || ''} ${garment.category || ''}`.toLowerCase();

  // Strapless top anchored at chest/bust line (strapless garments excluded from shoulder anchor)
  if (isStraplessGarment(garment)) {
    return {
      classes: hasOuterwear
        ? 'top-[30%] left-1/2 w-[68%] h-[20%] z-[20]'
        : 'top-[30%] left-1/2 w-[72%] h-[20%] z-[20]',
      align: 'object-top'
    };
  }

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
      classes: hasOuterwear
        ? 'top-[17.5%] left-1/2 w-[68%] h-[24%] z-[20]'
        : 'top-[17.5%] left-1/2 w-[76%] h-[24%] z-[20]',
      align: 'object-top'
    };
  }

  // 2. Longline tops, Kurtas, Tunics, Galabiyas, Thobes, Kaftans
  if (
    text.includes('kurta') ||
    text.includes('tunic') ||
    text.includes('longline') ||
    text.includes('קפטאן') ||
    text.includes('גלבייה') ||
    text.includes('טוניקה') ||
    text.includes('thobe') ||
    text.includes('ת\'וב') ||
    (text.includes('long') && (text.includes('shirt') || text.includes('top')))
  ) {
    return {
      classes: hasOuterwear
        ? 'top-[17.5%] left-1/2 w-[74%] h-[50%] z-[20]'
        : 'top-[17.5%] left-1/2 w-[84%] h-[52%] z-[20]',
      align: 'object-top'
    };
  }

  // 3. Vests / Waistcoats
  if (
    text.includes('vest') ||
    text.includes('waistcoat') ||
    text.includes('וסט') ||
    text.includes('gilet')
  ) {
    return {
      classes: hasOuterwear
        ? 'top-[17.5%] left-1/2 w-[72%] h-[34%] z-[20]'
        : 'top-[17.5%] left-1/2 w-[76%] h-[34%] z-[20]',
      align: 'object-top'
    };
  }

  // 4. Standard Top (Default: shirts, t-shirts, sweaters, hoodies, polos)
  // Anchored to shoulders at top-[17.5%]. When outerwear is worn, snug width to 72%
  return {
    classes: hasOuterwear
      ? 'top-[17.5%] left-1/2 w-[72%] h-[38%] z-[20]'
      : 'top-[17.5%] left-1/2 w-[82%] h-[38%] z-[20]',
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

  // 2. Cropped jackets, shrugs, boleros
  if (
    text.includes('bolero') ||
    text.includes('shrug') ||
    text.includes('עליונית קצרה') ||
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

// ─── Garment Shoulder Line Detection & Metrics Calculation ───
export function calculateGarmentShoulderLine(alphaArray, w, h) {
  let topY = -1;
  let bottomY = -1;
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      if (alphaArray[rowOffset + x] > 20) {
        if (topY === -1) topY = y;
        bottomY = y;
        break;
      }
    }
  }

  if (topY === -1) {
    return { shoulderYRatio: 0.13, shoulderCenterXRatio: 0.50, shoulderWidthRatio: 0.60 };
  }

  const garmentH = bottomY - topY + 1;
  const maxScanY = Math.min(bottomY, topY + Math.floor(garmentH * 0.42));

  const yIndices = [];
  const lefts = [];
  const rights = [];
  const widths = [];
  const centers = [];

  for (let y = topY; y < maxScanY; y++) {
    let minX = -1;
    let maxX = -1;
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      if (alphaArray[rowOffset + x] > 20) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX !== -1) {
      yIndices.push(y - topY);
      lefts.push(minX);
      rights.push(maxX);
      widths.push(maxX - minX + 1);
      centers.push((minX + maxX) / 2);
    }
  }

  const n = widths.length;
  if (n < 10) {
    return { shoulderYRatio: 0.13, shoulderCenterXRatio: 0.50, shoulderWidthRatio: 0.60 };
  }

  // Moving average smoothing (kernel size 5)
  const k = Math.max(3, Math.min(9, Math.floor(n / 8) | 1));
  const halfK = Math.floor(k / 2);
  const smoothW = new Float64Array(n);
  const smoothLeft = new Float64Array(n);
  const smoothRight = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let sumW = 0, sumL = 0, sumR = 0, count = 0;
    for (let j = Math.max(0, i - halfK); j <= Math.min(n - 1, i + halfK); j++) {
      sumW += widths[j];
      sumL += lefts[j];
      sumR += rights[j];
      count++;
    }
    smoothW[i] = sumW / count;
    smoothLeft[i] = sumL / count;
    smoothRight[i] = sumR / count;
  }

  // Check sleeveless peak in upper 25% (shoulder strap tips before armhole cutaways)
  const upper25Len = Math.min(n, Math.floor(garmentH * 0.25));
  let peakIdx = 0;
  let maxW = -1;
  for (let i = 0; i < upper25Len; i++) {
    if (smoothW[i] > maxW) {
      maxW = smoothW[i];
      peakIdx = i;
    }
  }

  let isSleeveless = false;
  if (peakIdx > 5 && peakIdx < upper25Len - 3) {
    if (smoothW[peakIdx] > smoothW[peakIdx + 3] + 2) {
      isSleeveless = true;
    }
  }

  let chosenIdx = peakIdx;
  if (!isSleeveless) {
    // Sleeved: find elbow where rate of left/right expansion flattens into shoulder/arm drop
    const slopeSum = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      const dL = Math.abs(smoothLeft[i + 1] - smoothLeft[i - 1]) / 2;
      const dR = Math.abs(smoothRight[i + 1] - smoothRight[i - 1]) / 2;
      slopeSum[i] = dL + dR;
    }

    const minIdx = Math.max(2, Math.min(Math.floor(garmentH * 0.06), n - 5));
    const maxIdx = Math.max(minIdx + 2, Math.min(Math.floor(garmentH * 0.22), n - 2));

    let minSlope = Infinity;
    for (let i = minIdx; i <= maxIdx; i++) {
      if (slopeSum[i] < minSlope) {
        minSlope = slopeSum[i];
        chosenIdx = i;
      }
    }
  }

  const shoulderY = yIndices[chosenIdx];
  const shoulderW = widths[chosenIdx];
  const shoulderCx = centers[chosenIdx];

  return {
    shoulderY,
    shoulderYRatio: Math.max(0.04, Math.min(0.24, shoulderY / garmentH)),
    shoulderCx,
    shoulderCenterXRatio: Math.max(0.35, Math.min(0.65, shoulderCx / w)),
    shoulderW,
    shoulderWidthRatio: Math.max(0.35, Math.min(0.85, shoulderW / w))
  };
}

// In-memory cache for dynamically trimmed garment data URLs and detected shoulder landmarks
const trimmedImageCache = new Map();
const trimmedImageMetricsCache = new Map();

function AutoTrimmedGarmentImage({
  src,
  placeholder,
  alt,
  objectFitMode = 'contain',
  imgAlignClass = 'object-top',
  onMetricsReady
}) {
  const [activeSrc, setActiveSrc] = useState(() => (src && trimmedImageCache.has(src) ? trimmedImageCache.get(src) : src));

  useEffect(() => {
    if (!src || typeof src !== 'string' || src.startsWith('data:image/svg')) {
      setActiveSrc(src);
      return;
    }

    if (trimmedImageCache.has(src)) {
      setActiveSrc(trimmedImageCache.get(src));
      if (onMetricsReady && trimmedImageMetricsCache.has(src)) {
        onMetricsReady(trimmedImageMetricsCache.get(src));
      }
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          if (isMounted) setActiveSrc(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minX = w, minY = h, maxX = 0, maxY = 0;
        let hasAlpha = false;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3];
            if (a > 20) {
              hasAlpha = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!hasAlpha) {
          trimmedImageCache.set(src, src);
          if (isMounted) setActiveSrc(src);
          return;
        }

        const cropW = Math.max(1, maxX - minX + 1);
        const cropH = Math.max(1, maxY - minY + 1);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

        // Analyze alpha channel on cropped garment to calculate shoulder line
        const croppedImgData = cropCtx.getImageData(0, 0, cropW, cropH);
        const croppedData = croppedImgData.data;
        const croppedAlpha = new Uint8ClampedArray(cropW * cropH);
        for (let i = 0; i < cropW * cropH; i++) {
          croppedAlpha[i] = croppedData[i * 4 + 3];
        }

        const shoulderMetrics = calculateGarmentShoulderLine(croppedAlpha, cropW, cropH);
        const fullMetrics = {
          ...shoulderMetrics,
          aspectRatio: cropW / cropH,
          naturalWidth: cropW,
          naturalHeight: cropH
        };
        trimmedImageMetricsCache.set(src, fullMetrics);
        if (onMetricsReady) onMetricsReady(fullMetrics);

        // If no significant padding (padding <= 3px on all sides), keep original url
        if (minX <= 3 && minY <= 3 && maxX >= w - 4 && maxY >= h - 4) {
          trimmedImageCache.set(src, src);
          if (isMounted) setActiveSrc(src);
          return;
        }

        const resultDataUrl = cropCanvas.toDataURL('image/png');
        trimmedImageCache.set(src, resultDataUrl);
        if (isMounted) setActiveSrc(resultDataUrl);
      } catch {
        // Fallback to src on any canvas/CORS error
        trimmedImageCache.set(src, src);
        if (isMounted) setActiveSrc(src);
      }
    };

    img.onerror = () => {
      if (isMounted) setActiveSrc(src);
    };

    img.src = src;

    return () => {
      isMounted = false;
    };
  }, [src, onMetricsReady]);

  return (
    <ImageWithPlaceholder
      src={activeSrc}
      placeholder={placeholder}
      alt={alt}
      objectFit={objectFitMode}
      imgClassName={imgAlignClass}
      className="w-full h-full"
    />
  );
}

const loadedOnboardingImageCache = new Map();

export function resolveOnboardingAvatarFit(garment) {
  if (!garment) return null;
  if (garment.id && ONBOARDING_DATASET_BY_ID[garment.id]?.avatar_fit) {
    return ONBOARDING_DATASET_BY_ID[garment.id].avatar_fit;
  }
  const urlStr = String(garment.url || garment.image_url || '');
  const match = urlStr.match(/\/assets\/onboarding\/([a-z0-9_]+)\.(?:png|jpg)/i);
  if (match && match[1]) {
    const baseId = match[1].replace(/_cutout$/i, '');
    if (ONBOARDING_DATASET_BY_ID[baseId]?.avatar_fit) {
      return ONBOARDING_DATASET_BY_ID[baseId].avatar_fit;
    }
  }
  const cleanUrl = urlStr.split('?')[0];
  const byTitle = ONBOARDING_STATIC_DATASET.find(
    (it) =>
      String(it.image_url || '').split('?')[0] === cleanUrl ||
      (garment.name && it.name === garment.name)
  );
  if (byTitle?.avatar_fit) {
    return byTitle.avatar_fit;
  }
  if (garment.avatar_fit && garment.avatar_fit.default_viewbox) {
    return garment.avatar_fit;
  }
  return null;
}

function resolveEffectiveGarmentUrl(garment) {
  if (garment?.avatar_overlay_url) {
    return garment.avatar_overlay_url;
  }
  const rawUrl = String(garment?.url || garment?.image_url || '');
  if (!rawUrl) return '';
  if (garment?.id && ONBOARDING_DATASET_BY_ID[garment.id]) {
    return (
      ONBOARDING_DATASET_BY_ID[garment.id].avatar_overlay_url ||
      ONBOARDING_DATASET_BY_ID[garment.id].image_url
    );
  }
  const match = rawUrl.match(/\/assets\/onboarding\/([a-z0-9_]+)\.(?:png|jpg)/i);
  if (match && match[1]) {
    const baseId = match[1].replace(/_cutout$/i, '');
    if (ONBOARDING_DATASET_BY_ID[baseId]) {
      return (
        ONBOARDING_DATASET_BY_ID[baseId].avatar_overlay_url ||
        ONBOARDING_DATASET_BY_ID[baseId].image_url
      );
    }
  }
  return rawUrl;
}

/**
 * Dynamically warps a pre-fitted onboarding garment OR any closet garment (fitted
 * via the Hybrid Real-Photo Alpha-Contour + Cubic-Bezier Reconstruction engine)
 * across 56 horizontal anatomical slices in `DynamicAvatar`'s `0 0 200 450` SVG
 * space so collar, shoulders, chest, waist, hips, knees, ankles, and feet resize
 * independently to hug the live avatar.
 */
function FittedGarmentLayer({
  garment,
  avatarFit,
  liveAnatomy,
  roleKey,
  clickable = false,
  onClick,
  zIndexClass = 'z-[20]',
  altText = 'Garment',
}) {
  const canvasRef = useRef(null);
  const effectiveUrl = useMemo(() => resolveEffectiveGarmentUrl(garment), [garment]);
  const [loadedImg, setLoadedImg] = useState(
    () => (effectiveUrl && loadedOnboardingImageCache.get(effectiveUrl)) || null
  );
  const [imgDone, setImgDone] = useState(
    () => Boolean(effectiveUrl && loadedOnboardingImageCache.has(effectiveUrl))
  );

  const defaultSex = useMemo(
    () => avatarFit?.default_sex || (liveAnatomy?.isMale ? 'male' : 'female'),
    [avatarFit?.default_sex, liveAnatomy?.isMale]
  );

  const defaultAnatomy = useMemo(
    () => getDefaultAvatarAnatomy(defaultSex),
    [defaultSex]
  );

  useEffect(() => {
    let mounted = true;
    const src = effectiveUrl;
    if (!src) {
      setImgDone(true);
      return;
    }
    if (loadedOnboardingImageCache.has(src)) {
      setLoadedImg(loadedOnboardingImageCache.get(src));
      setImgDone(true);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedOnboardingImageCache.set(src, img);
      if (mounted) {
        setLoadedImg(img);
        setImgDone(true);
      }
    };
    img.onerror = () => {
      if (mounted) {
        setLoadedImg(null);
        setImgDone(true);
      }
    };
    img.src = src;
    return () => {
      mounted = false;
    };
  }, [effectiveUrl]);

  const dynamicClosetFit = useMemo(() => {
    if (avatarFit?.default_viewbox) return null;
    if (!loadedImg && !imgDone) return null;
    return fitClosetGarmentToDefaultAvatar(garment, loadedImg, roleKey, defaultSex);
  }, [avatarFit, garment, loadedImg, imgDone, roleKey, defaultSex]);

  const activeAvatarFit = avatarFit?.default_viewbox
    ? avatarFit
    : dynamicClosetFit?.avatarFit || null;

  const activeImageSource = avatarFit?.default_viewbox
    ? loadedImg
    : dynamicClosetFit?.imageSource || loadedImg;

  const layerEaseMultiplier = useMemo(() => {
    if (roleKey === 'outerwear') return 1.02;
    return 1.0;
  }, [roleKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImageSource || !activeAvatarFit?.default_viewbox) return;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const SCALE = 3; // 600 x 1350 supersampled canvas for 200 x 450 SVG viewBox
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vb = activeAvatarFit.default_viewbox;
    const natW = activeImageSource.naturalWidth || activeImageSource.width || 1;
    const natH = activeImageSource.naturalHeight || activeImageSource.height || 1;
    const SLICES = 56;

    for (let i = 0; i < SLICES; i++) {
      const t0 = i / SLICES;
      const t1 = (i + 1) / SLICES;

      const sy = t0 * natH;
      const sh = Math.max(1, (t1 - t0) * natH);

      const y0Top = vb.y + t0 * vb.height;
      const y0Bot = vb.y + t1 * vb.height;
      const y0Mid = 0.5 * (y0Top + y0Bot);

      const pTop = warpDefaultAvatarPoint(100, y0Top, defaultAnatomy, liveAnatomy);
      const pBot = warpDefaultAvatarPoint(100, y0Bot, defaultAnatomy, liveAnatomy);

      let yWidthAnchor = y0Mid;
      if (activeAvatarFit.fit_mode === 'photo_contour') {
        if (
          roleKey === 'top' ||
          roleKey === 'outerwear' ||
          roleKey === 'dress' ||
          roleKey === 'full_body'
        ) {
          yWidthAnchor = Math.min(y0Mid, defaultAnatomy.yShoulders);
        } else if (roleKey === 'bottom') {
          yWidthAnchor = Math.min(y0Mid, defaultAnatomy.yHip);
        }
      }

      const pLeft = warpDefaultAvatarPoint(vb.x, yWidthAnchor, defaultAnatomy, liveAnatomy);
      const pRight = warpDefaultAvatarPoint(
        vb.x + vb.width,
        yWidthAnchor,
        defaultAnatomy,
        liveAnatomy
      );

      const anchorCenter = pLeft.centerX ?? 100;
      const sliceCenter = pTop.centerX ?? anchorCenter;
      const halfSpanL = (anchorCenter - pLeft.x) * layerEaseMultiplier;
      const halfSpanR = (pRight.x - anchorCenter) * layerEaseMultiplier;

      const xLeftLive = sliceCenter - halfSpanL;
      const widthLive = halfSpanL + halfSpanR;
      const yTopLive = pTop.y;
      const heightLive = Math.max(0.4, pBot.y - pTop.y);

      const dx = xLeftLive * SCALE;
      const dy = yTopLive * SCALE;
      const dw = widthLive * SCALE;
      const dh = heightLive * SCALE + 0.85; // sub-pixel overlap prevents slice seams

      ctx.drawImage(activeImageSource, 0, sy, natW, sh, dx, dy, dw, dh);
    }
  }, [activeImageSource, activeAvatarFit, defaultAnatomy, liveAnatomy, layerEaseMultiplier, roleKey]);

  const fallbackBox = useMemo(() => {
    const vb = activeAvatarFit?.default_viewbox || { x: 55, y: 75, width: 90, height: 150 };
    const tl = warpDefaultAvatarPoint(vb.x, vb.y, defaultAnatomy, liveAnatomy);
    const br = warpDefaultAvatarPoint(
      vb.x + vb.width,
      vb.y + vb.height,
      defaultAnatomy,
      liveAnatomy
    );
    return {
      x: tl.x,
      y: tl.y,
      width: Math.max(10, br.x - tl.x),
      height: Math.max(10, br.y - tl.y),
    };
  }, [activeAvatarFit, defaultAnatomy, liveAnatomy]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className={`absolute inset-0 w-full h-full drop-shadow-md ${zIndexClass} ${
        clickable ? 'cursor-pointer' : 'pointer-events-none'
      }`}
      onClick={clickable ? onClick : undefined}
      data-testid={`fitted-garment-layer-${roleKey}`}
      data-fit-mode={activeAvatarFit?.fit_mode || 'onboarding_prefitted'}
    >
      <svg
        viewBox="0 0 200 450"
        className="w-full h-full overflow-visible"
        style={{ maxHeight: '100%' }}
      >
        {!activeImageSource && effectiveUrl && (
          <image
            href={effectiveUrl}
            x={fallbackBox.x}
            y={fallbackBox.y}
            width={fallbackBox.width}
            height={fallbackBox.height}
            preserveAspectRatio="none"
          />
        )}
        <foreignObject x="0" y="0" width="200" height="450">
          <canvas
            ref={canvasRef}
            width={600}
            height={1350}
            aria-label={altText}
            style={{ width: '200px', height: '450px', display: 'block' }}
          />
        </foreignObject>
      </svg>
    </motion.div>
  );
}

/**
 * Interactive 2D Point-Cloud Fit Mesh overlay that visualizes the anatomical
 * vertices, triangulated mesh edges, and proportion scaling rings over the
 * avatar and fitted garments in real time.
 */
function PointCloudMeshOverlay({ garments = {}, liveAnatomy }) {
  const defaultSex = liveAnatomy?.isMale ? 'male' : 'female';
  const defaultBodyAnatomy = useMemo(
    () => getDefaultAvatarAnatomy(defaultSex),
    [defaultSex]
  );

  const warpedGarmentMeshes = useMemo(() => {
    const slots = ['dress', 'top', 'bottom', 'outerwear', 'shoes'];
    const list = [];

    slots.forEach((slot) => {
      const g = garments[slot];
      if (!g || (!g.url && !g.image_url)) return;
      const effUrl = resolveEffectiveGarmentUrl(g);
      const fit =
        resolveOnboardingAvatarFit(g) ||
        fitClosetGarmentToDefaultAvatar(
          g,
          loadedOnboardingImageCache.get(effUrl) || null,
          slot,
          defaultSex
        )?.avatarFit;
      const pc = fit?.point_cloud;
      if (!pc || !Array.isArray(pc.vertices) || pc.vertices.length === 0) return;

      const defAnat = getDefaultAvatarAnatomy(fit.default_sex || defaultSex);
      const easeMult = slot === 'outerwear' ? 1.02 : 1.0;

      const vertices = pc.vertices.map((v) => {
        const wVert = warpDefaultAvatarPoint(v.svg_x, v.svg_y, defAnat, liveAnatomy);
        let yWidthAnchor = v.svg_y;
        if (fit.fit_mode === 'photo_contour') {
          if (slot === 'top' || slot === 'outerwear' || slot === 'dress' || slot === 'full_body') {
            yWidthAnchor = Math.min(v.svg_y, defAnat.yShoulders);
          } else if (slot === 'bottom') {
            yWidthAnchor = Math.min(v.svg_y, defAnat.yHip);
          }
        }
        const wHoriz = warpDefaultAvatarPoint(v.svg_x, yWidthAnchor, defAnat, liveAnatomy);
        const anchorCx = wHoriz.centerX ?? 100;
        const sliceCx = wVert.centerX ?? anchorCx;
        const xAdj = sliceCx + (wHoriz.x - anchorCx) * easeMult;
        return {
          ...v,
          wx: xAdj,
          wy: wVert.y,
          scaleX: wHoriz.scaleX,
          scaleY: wVert.scaleY,
        };
      });

      list.push({
        slot,
        vertices,
        triangles: pc.triangles || [],
      });
    });

    // If no garment with a point-cloud is currently worn, generate a live anatomical body mesh
    if (list.length === 0 && liveAnatomy) {
      const yLevels = [
        { y0: defaultBodyAnatomy.yShoulders, w0: defaultBodyAnatomy.wShoulders, zone: 'shoulders' },
        { y0: defaultBodyAnatomy.yChest, w0: defaultBodyAnatomy.wChest, zone: 'chest' },
        { y0: (defaultBodyAnatomy.yChest + defaultBodyAnatomy.yWaist) * 0.5, w0: (defaultBodyAnatomy.wChest + defaultBodyAnatomy.wWaist) * 0.5, zone: 'torso' },
        { y0: defaultBodyAnatomy.yWaist, w0: defaultBodyAnatomy.wWaist, zone: 'waist' },
        { y0: defaultBodyAnatomy.yHip, w0: defaultBodyAnatomy.wHip, zone: 'hips' },
        { y0: defaultBodyAnatomy.yCrotch, w0: defaultBodyAnatomy.wHip * 0.88, zone: 'crotch' },
        { y0: defaultBodyAnatomy.yKnees, w0: defaultBodyAnatomy.wOuterKnee, zone: 'knees' },
        { y0: defaultBodyAnatomy.yAnkles, w0: defaultBodyAnatomy.wOuterAnkle, zone: 'ankles' },
      ];
      const cols = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
      const vertices = [];
      const grid = [];

      yLevels.forEach((lvl, rIdx) => {
        const rowIds = [];
        cols.forEach((cFrac, cIdx) => {
          const x0 = 100 + cFrac * lvl.w0;
          const w = warpDefaultAvatarPoint(x0, lvl.y0, defaultBodyAnatomy, liveAnatomy);
          const idx = vertices.length;
          vertices.push({
            wx: w.x,
            wy: w.y,
            zone: lvl.zone,
            is_edge: cIdx === 0 || cIdx === cols.length - 1,
            is_center: cIdx === 3,
            scaleX: w.scaleX,
          });
          rowIds.push(idx);
        });
        grid.push(rowIds);
      });

      const triangles = [];
      for (let r = 0; r < grid.length - 1; r++) {
        for (let c = 0; c < cols.length - 1; c++) {
          triangles.push([grid[r][c], grid[r][c + 1], grid[r + 1][c]]);
          triangles.push([grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]]);
        }
      }
      list.push({ slot: 'body', vertices, triangles });
    }

    return list;
  }, [garments, liveAnatomy, defaultSex, defaultBodyAnatomy]);

  const anatomyRings = useMemo(() => {
    if (!liveAnatomy || !defaultBodyAnatomy) return [];
    return [
      {
        id: 'shoulders',
        label: 'SH',
        y: liveAnatomy.yShoulders,
        w: liveAnatomy.wShoulders + 2.5,
        ratio: liveAnatomy.wShoulders / Math.max(1, defaultBodyAnatomy.wShoulders),
      },
      {
        id: 'chest',
        label: 'CH',
        y: liveAnatomy.yChest,
        w: liveAnatomy.wChest + 2.5,
        ratio: liveAnatomy.wChest / Math.max(1, defaultBodyAnatomy.wChest),
      },
      {
        id: 'waist',
        label: 'WA',
        y: liveAnatomy.yWaist,
        w: liveAnatomy.wWaist + 2.5,
        ratio: liveAnatomy.wWaist / Math.max(1, defaultBodyAnatomy.wWaist),
      },
      {
        id: 'hips',
        label: 'HP',
        y: liveAnatomy.yHip,
        w: liveAnatomy.wHip + 2.8,
        ratio: liveAnatomy.wHip / Math.max(1, defaultBodyAnatomy.wHip),
      },
      {
        id: 'knees',
        label: 'KN',
        y: liveAnatomy.yKnees,
        w: liveAnatomy.wOuterKnee + 2.5,
        ratio: liveAnatomy.wOuterKnee / Math.max(1, defaultBodyAnatomy.wOuterKnee),
      },
    ];
  }, [liveAnatomy, defaultBodyAnatomy]);

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none z-[45]"
      data-testid="avatar-point-cloud-mesh-overlay"
    >
      <svg
        viewBox="0 0 200 450"
        className="w-full h-full overflow-visible"
        style={{ maxHeight: '100%' }}
      >
        <defs>
          <linearGradient id="pointCloudMeshStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.72" />
            <stop offset="50%" stopColor="#A7F3D0" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Triangulated Point-Cloud Wireframe & Nodes */}
        {warpedGarmentMeshes.map((mesh) => (
          <g key={mesh.slot}>
            {mesh.triangles.map((tri, idx) => {
              const a = mesh.vertices[tri[0]];
              const b = mesh.vertices[tri[1]];
              const c = mesh.vertices[tri[2]];
              if (!a || !b || !c) return null;
              return (
                <polygon
                  key={`${mesh.slot}-tri-${idx}`}
                  points={`${a.wx.toFixed(1)},${a.wy.toFixed(1)} ${b.wx.toFixed(1)},${b.wy.toFixed(1)} ${c.wx.toFixed(1)},${c.wy.toFixed(1)}`}
                  fill="rgba(56, 189, 248, 0.04)"
                  stroke="url(#pointCloudMeshStroke)"
                  strokeWidth="0.42"
                />
              );
            })}

            {mesh.vertices.map((v, idx) => (
              <circle
                key={`${mesh.slot}-pt-${idx}`}
                cx={v.wx}
                cy={v.wy}
                r={v.is_edge ? 1.35 : v.is_center ? 1.15 : 0.85}
                fill={v.is_edge ? '#F59E0B' : v.is_center ? '#34D399' : '#38BDF8'}
                fillOpacity={v.is_edge ? 0.95 : 0.82}
              />
            ))}
          </g>
        ))}

        {/* Anatomical Resizing Calibration Rings */}
        {anatomyRings.map((ring) => {
          const cx =
            typeof liveAnatomy?.centerXAtY === 'function'
              ? liveAnatomy.centerXAtY(ring.y)
              : 100;
          const xL = cx - ring.w;
          const xR = cx + ring.w;
          const pctStr = `${Math.round(ring.ratio * 100)}%`;
          return (
            <g key={ring.id}>
              <path
                d={`M ${xL.toFixed(1)},${ring.y.toFixed(1)} Q ${cx.toFixed(1)},${(ring.y + 3.5).toFixed(1)} ${xR.toFixed(1)},${ring.y.toFixed(1)}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="0.75"
                strokeDasharray="2,1.5"
              />
              <circle cx={xL} cy={ring.y} r="1.6" fill="#38BDF8" />
              <circle cx={xR} cy={ring.y} r="1.6" fill="#38BDF8" />
              <rect
                x={xR + 2.5}
                y={ring.y - 4.2}
                width="22"
                height="8.2"
                rx="2.5"
                fill="#0F172A"
                fillOpacity="0.82"
              />
              <text
                x={xR + 13.5}
                y={ring.y + 1.5}
                textAnchor="middle"
                fill="#38BDF8"
                fontSize="4.6"
                fontWeight="700"
              >
                {ring.label} {pctStr}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AvatarViewer2D({
  shapeParams = {},
  measurements: providedMeasurements,
  skinColor,
  hair,
  sex = 'female',
  outfitItems = {},
  onItemClick,
  bodyPhotoUrl,
  showPointCloudMesh = false,
  interactive = false,
  enable3DTryOn = true,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isDressingRoomOpen, setIsDressingRoomOpen] = useState(false);

  const activeBodyPhotoUrl = resolveMediaUrl(bodyPhotoUrl !== undefined ? (bodyPhotoUrl || null) : (user?.body_photo_url || null));
  const rawSkinColor = (skinColor && skinColor.toLowerCase() !== '#9ca3af') ? skinColor : (user?.skin_tone || '#E0AC69');
  const activeSkinColor = rawSkinColor.toLowerCase() === '#9ca3af' ? '#E0AC69' : rawSkinColor;
  const activeHair = hair !== undefined ? hair : (user?.hair || {});

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
    const baseFoot = isMale ? 27.0 : 24.5;

    const tall = params.tall || 0;
    const short = params.short || 0;
    const heavy = params.heavy || 0;
    const thin = params.thin || 0;

    const pm = providedMeasurements || (!Object.values(params).some((v) => Number(v) > 0) ? (user?.body_measurements || user?.measurements || {}) : {});

    return {
      height: Number(pm.height || pm.height_cm || pm.length) || (baseH + (tall * 15) - (short * 15)),
      shoulders: Number(pm.shoulders || pm.shoulders_cm || pm.shoulder) || (baseSh + (heavy * 4) - (thin * 3)),
      chest: Number(pm.chest || pm.chest_cm || pm.bust) || (baseCh + ((params.busty || 0) * 10) + (heavy * 8) - (thin * 6)),
      waist: Number(pm.waist || pm.waist_cm) || (baseW + ((params.waist_thick || 0) * 10) - ((params.waist_thin || 0) * 8) + (heavy * 6)),
      hip: Number(pm.hips || pm.hip || pm.hips_cm) || (baseHip + ((params.hips_wide || 0) * 10) - ((params.hips_narrow || 0) * 8) + (heavy * 6)),
      armLength: Number(pm.arm_length || pm.armLength || pm.sleeve) || ((isMale ? 64 : 58) + (tall * 5) - (short * 5)),
      inseam: Number(pm.inseam || pm.inseam_cm || pm.leg_length) || ((isMale ? 82 : 76) + (tall * 8) - (short * 8)),
      footLength: Number(pm.foot_length || pm.footLength || pm.foot_length_cm) || baseFoot,
      gender: isMale ? 'male' : 'female'
    };
  }, [providedMeasurements, user, params, sex]);

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
      let s = String(roleName || '').toLowerCase().trim();
      if (s === 'upper' || s === 'shirt') s = 'top';
      if (s === 'pants' || s === 'trousers' || s === 'skirt' || s === 'lower') s = 'bottom';
      if (s === 'shoe' || s === 'footwear') s = 'shoes';
      if (s === 'full_body' || s === 'one_piece' || s === 'dresses') s = 'dress';
      if (s === 'jacket' || s === 'coat') s = 'outerwear';

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
          else if (cat === 'dress' || cat === 'dresses' || cat === 'full_body') s = 'dress';
          else if (cat === 'swimwear' || cat === 'swim') {
            if (isOnePieceSwim) s = 'dress';
            else if (isSwimTop) s = 'top';
            else s = 'bottom';
          }
          else s = cat;
        }
      }
      if (s === 'full_body') s = 'dress';
      if (s === 'swimwear' || s === 'swim') {
        if (isOnePieceSwim) s = 'dress';
        else if (isSwimTop) s = 'top';
        else s = 'bottom';
      }
      if (s === 'hat' || s === 'cap') s = 'headwear';
      if (s === 'accessories') s = 'accessory';
      if (s === 'footwear') s = 'shoes';
      if (s === 'belt' || s === 'belts') s = 'belt';
      if (s === 'glasses' || s === 'sunglasses' || s === 'eyewear') s = 'glasses';
      if (s === 'earrings' || s === 'earring') s = 'earrings';
      if (s === 'scarf' || s === 'scarves' || s === 'neckwear' || s === 'tie' || s === 'necklace' || s === 'necklaces') s = 'scarf';
      if (s === 'watch' || s === 'watches') s = 'watch';
      if (s === 'gloves' || s === 'glove' || s === 'mittens') s = 'gloves';
      if (s === 'bag' || s === 'bags') s = 'bag';

      const isHat = /\b(hats?|caps?|beanies?|berets?|fedoras?|visors?|flat\s+caps?|bonnets?|bucket\s+hats?|helmets?|turbans?|kippahs?|yarmulkes?|yamulkas?|keffiyehs?|kaffias?|shemaghs?|ghutras?|agals?|hijabs?|niqabs?|tarbooshes?|fezes?|fez|shtreimels?|sombreros?|panamas?|headbands?|bandanas?|mitpachat)\b/i.test(allText) ||
                    /(?:כובע|קובע|ברט|מצחייה|קסקט|טורבן|כיפה|כיפות|יארמולקה|כפייה|כאפייה|שמאג|עגאל|עקאל|חיג['’]אב|חג['’]אב|תרבוש|שטריימל|סומבררו|כומתה|פדורה|בנדנה|מטפחת|סודרא|קשת|סרט ראש|قبعة|طاقية|كوفية|شماغ|عقال|عمامة|طربوش|حجاب|نقاب)/i.test(allText);

      const isBelt = /\b(belts?|waistbands?|sashes?|cummerbunds?)\b/i.test(allText) ||
                     /(?:חגורה|חגור|חגורות|אבזם|אבזמי|חזאם|حزام|أحزمة|ceintures?|gürtel|cinture?|cinturón|cintos?|ремень|ремни|пояс|腰带|皮带|ベルト)/i.test(allText);

      const isGlasses = /\b(glasses|sunglasses|spectacles|eyewear|shades|goggles)\b/i.test(allText) ||
                        /(?:משקפיים|משקפי|משקפי שמש|משקפי_שמש|משקפי ראייה|نظارات|نظارة|نظارات شمسية)/i.test(allText);

      const isEarrings = /\b(earrings?|ear\s*studs?|ear\s*cuffs?|hoops?)\b/i.test(allText) ||
                         /(?:עגילים|עגיל|עגילי|أقراط|حلق|boucles?\s+d['’]oreilles?|ohrringe?|orecchini|pendientes|brincos?|серьги|серьга|耳环|耳圈|ピアス|झुमके)/i.test(allText);

      const isScarf = /\b(scarves|scarf|foulards?|wraps?|shawls?|pashminas?|stoles?|neckties?|bow\s*ties?|ascots?|cravats?|necklaces?|chokers?|pendants?)\b/i.test(allText) ||
                      /(?:צעיף|צעיפים|עניבה|עניבות|פפיון|של|עליונית צעיף|שרשרת|שרשראות|קולר|תליון|ושاح|ربطة\s*عنق|كرافات|قلادة|عقد|طوق|écharpes?|cravates?|schal|krawatte|sciarpa|bufanda|corbata|cachecol|шарф|галстук|колье|ожерелье|围巾|领带|项链|スカーフ|ネクタイ)/i.test(allText) ||
                      /\bties?\b(?!\s*dye)/i.test(allText);

      const isWatch = /\b(watch(?:es)?|timepieces?|smartwatch(?:es)?|wristwatches?|bracelets?|bangles?|wristbands?|cuffs?)\b/i.test(allText) ||
                      /(?:שעון|שעונים|שעון\s*יד|צמיד|צמידים|סמארטוואטש|ساعة|ساعات|ساعة\s*يد|سوار|أساور|montres?|bracelets?|uhr(?:en)?|armband|orologi?o?|reloj(?:es)?|relógio|часы|браслет|手表|腕表|手镯|手链|腕時計|ブレスレット)/i.test(allText);

      const isGloves = /\b(gloves?|mittens?|gauntlets?)\b/i.test(allText) ||
                       /(?:כפפות|כפפה|כפפות עור|قفازات|قفاز|gants?|handschuhe?|guanti|guantes?|luvas?|перчатки|варежки|手套|手袋)/i.test(allText);

      const isBag = /\b(bags?|backpacks?|totes?|clutches?|purses?|satchels?|briefcases?|duffels?|cross-?body|shoulder\s*bags?)\b/i.test(allText) ||
                    /(?:תיק|תיקים|ארנק|ארנקים|תרמיל|תרמילים|ילקוט|حقيبة|حقائب|شنطة|شنط|sacs?|taschen?|borse?|bolsos?|bolsas?|сумка|сумки|рюкзак|包|背包|手提包|バッグ|リュック)/i.test(allText);

      if (isHat && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'headwear';
      if (isBelt && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'belt';
      if (isGlasses && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'glasses';
      if (isEarrings && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'earrings';
      if (isScarf && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'scarf';
      if (isWatch && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'watch';
      if (isGloves && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'gloves';
      if (isBag && (s === 'accessory' || s === 'accessories' || !s || s === 'item' || s === 'garment' || s === 'other')) s = 'bag';

      // Category / Intrinsic role detectors
      const isShoesByName = /\b(shoes?|sneakers?|boots?|sandals?|heels?|loafers?|slippers?|slides?|mules?|oxford\s+shoes?|oxfords|oxford(?!\s+(shirts?|cloth|cotton|button))|clogs?)\b/i.test(allText) ||
                            /(?:נעליים|נעלי|סניקרס|מגפיים|מגפי|מגפונים|סנדלים|עקבים|כפכפים|מוקסינים|حذاء|أحذية|صندل|بوت)/i.test(allText);
      const isBottomByName = ((/\b(pants?|cargo(?!\s+pocket)|trousers?|jeans?|shorts\b|short\s+pants\b|shorts?(?![\s-_]*(?:sleeves?|sleeved|arm|curt[ao]s?))|skirts?|sweatpants|joggers?|slacks?|chinos?|leggings?|bermuda|culottes?|trunks?|briefs?)\b/i.test(allText) ||
                             /(?:מכנסיים|מכנס|מכנסי|ג'ינס|שורטס|חצאית|חצאיות|טייץ|טייטס|טרנינג|בוקסר|תחתונים|בגד ים|מכנסי ים|ביקיני|בןטלון|بنطال|سروال|شورت|تنورة|جينز)/i.test(allText) || isSwimBottom) && !/\b(?:short[-_\s]*sleeves?|shortsleeve|חולצה|חולצת|shirt|tee|t-shirt|kurta\s+set|jalabiya|business\s+suit)\b/i.test(allText));
      const isTopByName = /\b(shirts?|t-shirts?|tees?|blouses?|sweaters?|hoodies?|sweatshirts?|crop\s+tops?|tank(?:\s+tops?)?|polos?|pullovers?|turtlenecks?|camisoles?|rash_guards?|kurtas?(?!\s+set)|kurtis?|tunics?|guayaberas?|tops?)\b/i.test(allText) ||
                          /(?:חולצה|חולצת|חולצות|גופייה|גופיה|גופיות|סוודר|סוודרים|קפוצ'ון|סווטשירט|פולו|מכופתרת|סריג|סריגים|טוניקה|קורטה|חולצת גלישה|قميص|بلوزة|كنزة|هودي|تونيك)/i.test(allText) || isSwimTop;
      const isOuterwearByName = /\b(jackets?|coats?|blazers?|parkas?|trench(?:coats?)?|overcoats?|windbreakers?|puffers?|anoraks?|vests?|waistcoats?|achkans?|sherwanis?|bandhgalas?)\b/i.test(allText) ||
                                /(?:ז'קט|ג'קט|מעיל|מעילים|בלייזר|וסט|מקטורן|עליונית|סטרה|עליוניות|جاكيت|معطف|بليزر)/i.test(allText);
      const isDressByName = /\b(dresses|dress(?!\s+(pants|trousers|shirts?|shoes?|boots?|code|socks|belt|suit))|gowns?|jumpsuits?|rompers?|dungarees?|overalls?|one_piece|swimsuit|abayas?|kaftans?|caftans?|galabiyas?|jalabiyas?|sarees?|saris?|thobes?|kanduras?|dishdashas?|kurta\s+sets?|business\s+suits?|three[-_\s]*piece\s+suits?)\b/i.test(allText) ||
                            /(?:שמלה|שמלת|שמלות|אוברול|סרבל|בגד ים שלם|בגד_ים_שלם|גלבייה|עבאיה|כפתן|סארי|ת'וב|فستان|فساتين|جمبسوت|عباية|قفطان|جلابية|ثوب)/i.test(allText) || isOnePieceSwim;
      const isAccessoryByName = isHat || isBelt || isGlasses || isBag || isWatch || isEarrings || isScarf || isGloves;

      // --- Hard Anatomical Safety Guards (All 5 Categories) ---

      // 1. Footwear Safety Guard: Shoes can ONLY render in 'shoes' slot!
      if (isShoesByName && s !== 'shoes') {
        return null;
      }
      if (s === 'shoes' && !isShoesByName && (isTopByName || isBottomByName || isOuterwearByName || isDressByName || isAccessoryByName)) {
        return null;
      }

      // 2. Bottom Safety Guard: Pants/bottoms can NEVER render on torso, feet, head, face, waist, or bag!
      if (isBottomByName && !isTopByName && s !== 'bottom') {
        return null;
      }
      if (s === 'bottom' && !isBottomByName && (isTopByName || isShoesByName || isOuterwearByName || isDressByName || isAccessoryByName)) {
        return null;
      }

      // 3. Top Safety Guard: Tops can NEVER render on legs, feet, head, face, waist, or bag!
      if (isTopByName && !isBottomByName && !isShoesByName) {
        if (s === 'bottom' || s === 'shoes' || s === 'headwear' || s === 'glasses' || s === 'belt' || s === 'bag' || s === 'accessory' || s === 'earrings' || s === 'scarf' || s === 'watch' || s === 'gloves') {
          return null;
        }
      }

      // 4. Outerwear Safety Guard: Outerwear can NEVER render on legs, feet, head, face, waist, or bag!
      if (isOuterwearByName && !isShoesByName && !isBottomByName) {
        if (s === 'bottom' || s === 'shoes' || s === 'headwear' || s === 'glasses' || s === 'belt' || s === 'bag' || s === 'accessory' || s === 'earrings' || s === 'scarf' || s === 'watch' || s === 'gloves') {
          return null;
        }
      }

      // 5. Full Body / Dress Safety Guard: Dresses can NEVER render on legs, feet, or accessories!
      if (isDressByName) {
        if (s === 'bottom' || s === 'shoes' || s === 'headwear' || s === 'glasses' || s === 'belt' || s === 'bag' || s === 'accessory' || s === 'earrings' || s === 'scarf' || s === 'watch' || s === 'gloves') {
          return null;
        }
        if (s === 'top' && !isTopByName) {
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

    const rawItems = Array.isArray(outfitItems)
      ? outfitItems.map((item, idx) => [`item_${idx}`, item])
      : Object.entries(outfitItems || {});

    rawItems.forEach(([roleKey, item]) => {
      if (item) {
        const itemId = item.closet_item_id || item.id || item._id;
        const closetItem = allClosetItems.find(it => it && (it.id === itemId || it._id === itemId));
        const effectiveRole = item.role || (roleKey && roleKey.includes('_') ? roleKey.split('_')[0] : roleKey);
        
        let slot = resolveSlot(effectiveRole, item, closetItem);
        if (!slot) return;

        if (closetItem && closetItem.group_id) {
          const groupItems = allClosetItems.filter(it => it && it.group_id === closetItem.group_id);
          const categories = new Set(groupItems.map(it => String(it.category || '').toLowerCase().trim()));
          
          if (categories.size > 1) {
            groupItems.forEach(gItem => {
              const gSlot = resolveSlot(gItem.category, gItem, gItem);
              if (gSlot) {
                res[gSlot] = {
                  url: resolveMediaUrl(bestImageUrl(gItem) || gItem.clean_image_url || gItem.reconstructed_image_url || gItem.image_data_url || gItem.segmented_image_url || gItem.image_url || gItem.original_image_url),
                  placeholder: resolveMediaUrl(gItem.placeholder_data_url || null),
                  id: gItem.id || gItem._id,
                  category: gItem.category || '',
                  sub_category: gItem.sub_category || '',
                  item_type: gItem.item_type || '',
                  name: gItem.name || gItem.title || '',
                  color: gItem.color || '',
                  hex_color: gItem.hex_color || '',
                  colors: gItem.colors || null,
                  pattern: gItem.pattern || '',
                  material: gItem.material || '',
                  avatar_fit: gItem.avatar_fit || null,
                };
              }
            });
            return;
          }
        }
 
        const garmentUrl = resolveMediaUrl(
          bestImageUrl(closetItem) ||
          bestImageUrl(item) ||
          item.url ||
          item.clean_image_url ||
          item.reconstructed_image_url ||
          item.image_url ||
          item.image_data_url ||
          item.segmented_image_url ||
          item.original_image_url ||
          closetItem?.clean_image_url ||
          closetItem?.reconstructed_image_url ||
          closetItem?.image_url ||
          closetItem?.original_image_url
        );

        res[slot] = {
           url: garmentUrl,
           placeholder: resolveMediaUrl(item.placeholder_data_url || item.placeholder || closetItem?.placeholder_data_url || null),
           id: item.closet_item_id || item.id || closetItem?.id || closetItem?._id || null,
           category: item.category || closetItem?.category || '',
           sub_category: item.sub_category || closetItem?.sub_category || '',
           item_type: item.item_type || closetItem?.item_type || '',
           name: item.name || item.title || closetItem?.name || closetItem?.title || '',
           color: item.color || closetItem?.color || '',
           hex_color: item.hex_color || closetItem?.hex_color || '',
           colors: item.colors || closetItem?.colors || null,
           pattern: item.pattern || closetItem?.pattern || '',
           material: item.material || closetItem?.material || '',
           avatar_fit: item.avatar_fit || closetItem?.avatar_fit || null,
        };

      }
    });
    return res;
  }, [outfitItems]);

  const hasOuterwear = Boolean(garments.outerwear && garments.outerwear.url);
  const bottomTopo = useMemo(() => getBottomTopography(garments.bottom), [garments.bottom]);
  const dressTopo = useMemo(() => getDressTopography(garments.dress), [garments.dress]);
  const topTopo = useMemo(() => getTopTopography(garments.top, hasOuterwear), [garments.top, hasOuterwear]);
  const outerwearTopo = useMemo(() => getOuterwearTopography(garments.outerwear), [garments.outerwear]);

  const baseLiveAnatomy = useMemo(() => {
    return getFullAvatarAnatomy({
      height: computedMeasurements.height,
      shoulders: computedMeasurements.shoulders,
      chest: computedMeasurements.chest,
      waist: computedMeasurements.waist,
      hip: computedMeasurements.hip || computedMeasurements.hips,
      armLength: computedMeasurements.armLength || computedMeasurements.arm_length,
      inseam: computedMeasurements.inseam,
      footLength: computedMeasurements.footLength,
      gender: computedMeasurements.gender || sex,
    });
  }, [computedMeasurements, sex]);

  const [loadedBodyPhotoImg, setLoadedBodyPhotoImg] = useState(
    () => (activeBodyPhotoUrl && loadedOnboardingImageCache.get(activeBodyPhotoUrl)) || null
  );
  const [bodyPhotoError, setBodyPhotoError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setBodyPhotoError(false);
    if (!activeBodyPhotoUrl) {
      setLoadedBodyPhotoImg(null);
      return;
    }
    if (loadedOnboardingImageCache.has(activeBodyPhotoUrl)) {
      setLoadedBodyPhotoImg(loadedOnboardingImageCache.get(activeBodyPhotoUrl));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedOnboardingImageCache.set(activeBodyPhotoUrl, img);
      if (mounted) {
        setLoadedBodyPhotoImg(img);
        setBodyPhotoError(false);
      }
    };
    img.onerror = () => {
      if (mounted) {
        setLoadedBodyPhotoImg(null);
        setBodyPhotoError(true);
      }
    };
    img.src = activeBodyPhotoUrl;
    return () => {
      mounted = false;
    };
  }, [activeBodyPhotoUrl]);

  const liveAnatomy = useMemo(() => {
    if (!activeBodyPhotoUrl || !loadedBodyPhotoImg) return baseLiveAnatomy;
    return extractBodyPhotoAnatomy(
      loadedBodyPhotoImg,
      baseLiveAnatomy,
      computedMeasurements.gender || sex
    );
  }, [activeBodyPhotoUrl, loadedBodyPhotoImg, baseLiveAnatomy, computedMeasurements.gender, sex]);

  const avatarGeometry = useMemo(() => {
    if (activeBodyPhotoUrl && liveAnatomy?.isPhotoExtracted) {
      return {
        yShoulders: liveAnatomy.yShoulders,
        wShoulders: liveAnatomy.wShoulders,
        shoulderYPercent: liveAnatomy.shoulderYPercent,
        shoulderWidthPercent: liveAnatomy.shoulderWidthPercent,
        isMale: liveAnatomy.isMale,
      };
    }
    return getAvatarGeometry({
      height: computedMeasurements.height,
      shoulders: computedMeasurements.shoulders,
      gender: computedMeasurements.gender || sex
    });
  }, [activeBodyPhotoUrl, liveAnatomy, computedMeasurements.height, computedMeasurements.shoulders, computedMeasurements.gender, sex]);

  const [garmentMetrics, setGarmentMetrics] = useState({});

  const handleMetricsReady = useCallback((slot, m) => {
    setGarmentMetrics(prev => {
      if (prev[slot] && prev[slot].shoulderYRatio === m.shoulderYRatio && prev[slot].aspectRatio === m.aspectRatio) {
        return prev;
      }
      return { ...prev, [slot]: m };
    });
  }, []);

  const renderGarment = (roleKey, altText, extraClasses = '', initial = {}, animate = {}, imgAlignClass = 'object-top', objectFitMode = 'contain') => {
    const garment = garments[roleKey];
    if (!garment || (!garment.url && !FITTED_AVATAR_SLOTS.has(roleKey))) return null;
    const clickable = onItemClick && garment.id;

    // 1. All Clothing & Footwear Slots on 2D Avatar AND Real Full-Body Photo Avatar:
    //    Uses pre-fitted onboarding `avatar_fit` when present, or dynamically fits
    //    any user closet item via `fitClosetGarmentToDefaultAvatar` (Hybrid Real-Photo
    //    Alpha-Contour Warping + Cubic-Bezier Silhouette & Fabric Texture Reconstruction)
    //    followed by 56-slice anatomical warping to `liveAnatomy` (either parametric
    //    measurements or full-body photo extracted anatomy).
    const onboardingFit = resolveOnboardingAvatarFit(garment);
    if ((onboardingFit && onboardingFit.default_viewbox) || FITTED_AVATAR_SLOTS.has(roleKey)) {
      const zMatch = extraClasses.match(/\bz-\[\d+\]/);
      const zIndexClass = zMatch ? zMatch[0] : (roleKey === 'outerwear' ? 'z-[30]' : roleKey === 'bottom' ? 'z-[10]' : roleKey === 'shoes' ? 'z-[15]' : 'z-[20]');
      return (
        <FittedGarmentLayer
          key={`fitted-${roleKey}-${garment.id || garment.url || garment.name}`}
          garment={garment}
          avatarFit={onboardingFit}
          liveAnatomy={liveAnatomy}
          roleKey={roleKey}
          hasOuterwear={hasOuterwear}
          clickable={Boolean(clickable)}
          onClick={clickable ? (e) => { e.stopPropagation(); onItemClick(garment.id); } : undefined}
          zIndexClass={zIndexClass}
          altText={altText}
        />
      );
    }

    // 2. Accessories Overlay (headwear, glasses, earrings, scarf, belt, watch, gloves, etc.)
    const garmentText = `${garment.name || ''} ${garment.sub_category || ''} ${garment.item_type || ''} ${garment.category || ''}`;
    const isStrapless = /\b(strapless|tube\s*top|bandeau|off[\s-_]*shoulder)\b/i.test(garmentText);
    const isShoulderAnchored = (roleKey === 'top' || roleKey === 'outerwear' || roleKey === 'dress') && !isStrapless;

    let dynamicStyle = undefined;
    let effectiveInitial = initial;
    let effectiveAnimate = animate;
    let effectiveClasses = extraClasses;

    if (isShoulderAnchored) {
      const defaultMetrics = {
        top: { shoulderYRatio: 0.13, shoulderCenterXRatio: 0.50, shoulderWidthRatio: 0.60, aspectRatio: 1.25 },
        outerwear: { shoulderYRatio: 0.136, shoulderCenterXRatio: 0.50, shoulderWidthRatio: 0.51, aspectRatio: 1.45 },
        dress: { shoulderYRatio: 0.12, shoulderCenterXRatio: 0.50, shoulderWidthRatio: 0.58, aspectRatio: 0.85 }
      };

      const m = garmentMetrics[roleKey] || trimmedImageMetricsCache.get(garment.url) || defaultMetrics[roleKey] || defaultMetrics.top;

      // Outerwear drapes slightly wider (1.09x) over underlayers (1.03x)
      const spanMultiplier = roleKey === 'outerwear' ? 1.09 : 1.03;
      const targetSpan = avatarGeometry.shoulderWidthPercent * spanMultiplier;

      // Rendered width based on shoulder span (clamped between 52% and 96%)
      const renderedWidth = Math.max(52, Math.min(96, targetSpan / Math.max(0.3, m.shoulderWidthRatio)));

      // In aspect-[1/2] container, H_rendered = W_rendered / aspectRatio * 0.5
      const renderedHeight = (renderedWidth / Math.max(0.35, m.aspectRatio)) * 0.5;

      // Shoulder offset in % of container height
      const shoulderOffsetY = m.shoulderYRatio * renderedHeight;

      // Align garment shoulder line with avatar shoulder line:
      const dynamicTop = avatarGeometry.shoulderYPercent - shoulderOffsetY;

      // Shoulder horizontal center offset:
      const translateX = -m.shoulderCenterXRatio * 100;

      dynamicStyle = {
        top: `${dynamicTop.toFixed(2)}%`,
        left: '50%',
        width: `${renderedWidth.toFixed(2)}%`,
        height: `${renderedHeight.toFixed(2)}%`
      };

      // Strip hard-coded top-*, left-*, w-*, h-* classes, keep z-index and shadows
      effectiveClasses = extraClasses
        .replace(/\btop-\[[^\]]+\]/g, '')
        .replace(/\bleft-\S+/g, '')
        .replace(/\bw-\[[^\]]+\]/g, '')
        .replace(/\bh-\[[^\]]+\]/g, '')
        .trim();

      effectiveInitial = {
        ...initial,
        x: `${translateX.toFixed(2)}%`
      };
      effectiveAnimate = {
        ...animate,
        x: `${translateX.toFixed(2)}%`
      };
    } else if (liveAnatomy) {
      const H = liveAnatomy.viewBoxHeight || 450;
      const W = 200;
      const headH = Math.max(24, (liveAnatomy.yChin || 100) - (liveAnatomy.yHeadTop || 52));
      const cx = typeof liveAnatomy.centerXAtY === 'function' ? liveAnatomy.centerXAtY(liveAnatomy.yWaist) : (liveAnatomy.X0 || 100);
      const leftPct = `${((cx / W) * 100).toFixed(2)}%`;

      if (roleKey === 'headwear') {
        const crownBottomY = (liveAnatomy.yHeadTop || 52) + headH * 0.42;
        const boxH = 18;
        dynamicStyle = {
          top: `${(((crownBottomY / H) * 100) - boxH).toFixed(2)}%`,
          left: leftPct,
          width: '32%',
          height: `${boxH}%`,
        };
      } else if (roleKey === 'glasses') {
        const yEyes = (liveAnatomy.yHeadTop || 52) + headH * 0.48;
        const boxH = 4.6;
        dynamicStyle = {
          top: `${(((yEyes / H) * 100) - boxH * 0.5).toFixed(2)}%`,
          left: leftPct,
          width: '19%',
          height: `${boxH}%`,
        };
      } else if (roleKey === 'earrings') {
        const yEars = (liveAnatomy.yHeadTop || 52) + headH * 0.58;
        const boxH = 6.5;
        dynamicStyle = {
          top: `${(((yEars / H) * 100) - boxH * 0.35).toFixed(2)}%`,
          left: leftPct,
          width: '24%',
          height: `${boxH}%`,
        };
      } else if (roleKey === 'scarf' || roleKey === 'accessory') {
        const yNeckTop = (liveAnatomy.yChin || 100) - 2.0;
        dynamicStyle = {
          top: `${((yNeckTop / H) * 100).toFixed(2)}%`,
          left: leftPct,
          width: roleKey === 'scarf' ? '32%' : '28%',
          height: roleKey === 'scarf' ? '19%' : '15%',
        };
      } else if (roleKey === 'belt') {
        const yBelt = (liveAnatomy.yWaist || 182) + ((liveAnatomy.yHip || 226) - (liveAnatomy.yWaist || 182)) * 0.18;
        const wBeltPct = Math.max(30, Math.min(56, (((liveAnatomy.wWaist || 28) * 2 + 7) / W) * 100));
        dynamicStyle = {
          top: `${(((yBelt / H) * 100) - 2.2).toFixed(2)}%`,
          left: leftPct,
          width: `${wBeltPct.toFixed(2)}%`,
          height: '4.6%',
        };
      } else if (roleKey === 'watch') {
        const yWr = liveAnatomy.yWrist || 231;
        const xWr = cx + 0.5 * ((liveAnatomy.wWristIn || 48) + (liveAnatomy.wWristOut || 58));
        dynamicStyle = {
          top: `${((yWr / H) * 100).toFixed(2)}%`,
          left: `${((xWr / W) * 100).toFixed(2)}%`,
          width: '11.5%',
        };
      } else if (roleKey === 'gloves') {
        const yWr = (liveAnatomy.yWrist || 231) - 2.0;
        const yHand = (liveAnatomy.yHandTip || 258) + 4.0;
        const wGlovesPct = Math.max(54, Math.min(76, (((liveAnatomy.wWristOut || 58) * 2 + 10) / W) * 100));
        dynamicStyle = {
          top: `${((yWr / H) * 100).toFixed(2)}%`,
          left: leftPct,
          width: `${wGlovesPct.toFixed(2)}%`,
          height: `${Math.max(6.5, ((yHand - yWr) / H) * 100).toFixed(2)}%`,
        };
      }

      if (dynamicStyle) {
        effectiveClasses = extraClasses
          .replace(/\btop-\[[^\]]+\]/g, '')
          .replace(/\bleft-\S+/g, '')
          .replace(/\bw-\[[^\]]+\]/g, '')
          .replace(/\bh-\[[^\]]+\]/g, '')
          .trim();
      }
    }

    return (
      <motion.div
        initial={effectiveInitial}
        animate={effectiveAnimate}
        style={dynamicStyle}
        className={`absolute drop-shadow-md ${effectiveClasses} ${clickable ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
        onClick={clickable ? (e) => { e.stopPropagation(); onItemClick(garment.id); } : undefined}
      >
        <AutoTrimmedGarmentImage
          src={garment.url}
          placeholder={garment.placeholder}
          alt={altText}
          objectFitMode={objectFitMode}
          imgAlignClass={imgAlignClass}
          onMetricsReady={(metrics) => handleMetricsReady(roleKey, metrics)}
        />
      </motion.div>
    );
  };

  return (
    <div className="relative w-full h-full max-h-full overflow-hidden flex items-center justify-center p-0 shadow-inner group">
      {/* 2D Dynamic Bezier SVG Avatar or Real Body Photo Container */}
      <div className="relative w-full h-full aspect-[200/450] max-h-full max-w-full flex items-center justify-center transition-all duration-500">
        {activeBodyPhotoUrl && !bodyPhotoError ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={activeBodyPhotoUrl}
              alt={t('profile.bodyPhoto', { defaultValue: 'Full-body photo' })}
              className="w-full h-full object-contain rounded-xl drop-shadow-md"
              onError={() => { setBodyPhotoError(true); }}
            />
            {/* Render Try-On Garments & Accessories on top of real body photo */}
            {renderGarment('headwear', t('taxonomy.categories.headwear', { defaultValue: 'Headwear' }), 'top-[3.5%] left-1/2 w-[34%] aspect-square z-[50]', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}
            {renderGarment('glasses', t('taxonomy.categories.glasses', { defaultValue: 'Glasses' }), 'top-[14%] left-1/2 w-[20%] h-[5%] z-[48]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('earrings', t('taxonomy.sub_category.earrings', { defaultValue: 'Earrings' }), 'top-[15%] left-1/2 w-[34%] h-[7.5%] z-[46]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('scarf', t('taxonomy.sub_category.scarves_and_wraps', { defaultValue: 'Scarf' }), 'top-[17.0%] left-1/2 w-[32%] h-[20%] z-[36]', { opacity: 0, y: -5, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-top', 'contain')}
            {renderGarment('accessory', t('taxonomy.categories.accessory', { defaultValue: 'Accessory' }), 'top-[17.5%] left-1/2 w-[30%] aspect-square z-[35]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-top', 'contain')}

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
            {renderGarment('gloves', t('taxonomy.sub_category.gloves', { defaultValue: 'Gloves' }), 'top-[52%] left-1/2 w-[62%] h-[11%] z-[35] drop-shadow-md', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('watch', t('taxonomy.sub_category.watches', { defaultValue: 'Watch' }), 'top-[51.5%] left-[72%] w-[13%] aspect-square z-[38] drop-shadow-md', { opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }, { opacity: 1, scale: 1, x: "-50%", y: "-50%" }, 'object-center', 'contain')}
            {renderGarment('shoes', t('taxonomy.categories.shoes', { defaultValue: 'Shoes' }), 'bottom-[0.5%] left-1/2 w-[76%] h-[16%] z-[15]', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}

            {garments.bag && garments.bag.url && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`absolute top-[44%] right-[-6%] w-[38%] h-[30%] z-[35] drop-shadow-md ${onItemClick && garments.bag.id ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
                onClick={onItemClick && garments.bag.id ? (e) => { e.stopPropagation(); onItemClick(garments.bag.id); } : undefined}
              >
                <AutoTrimmedGarmentImage
                  src={garments.bag.url}
                  placeholder={garments.bag.placeholder}
                  alt={t('taxonomy.sub_category.bag', { defaultValue: 'Bag' })}
                  objectFitMode="contain"
                />
              </motion.div>
            )}

            {showPointCloudMesh && (
              <PointCloudMeshOverlay
                garments={garments}
                liveAnatomy={liveAnatomy}
              />
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
            footLength={computedMeasurements.footLength}
            gender={computedMeasurements.gender || sex}
            skinColor={activeSkinColor}
            hair={activeHair}
            shapeParams={params}
            showGuideLines={false}
            interactive={interactive}
            className="w-full h-full"
          >
            {/* ─── Layered Clothes & Accessories (Segmented transparent PNG overlays) ─── */}
            {renderGarment('headwear', t('taxonomy.categories.headwear', { defaultValue: 'Headwear' }), 'top-[3.5%] left-1/2 w-[34%] aspect-square z-[50]', { opacity: 0, y: -10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}
            {renderGarment('glasses', t('taxonomy.categories.glasses', { defaultValue: 'Glasses' }), 'top-[14%] left-1/2 w-[20%] h-[5%] z-[48]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('earrings', t('taxonomy.sub_category.earrings', { defaultValue: 'Earrings' }), 'top-[15%] left-1/2 w-[34%] h-[7.5%] z-[46]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('scarf', t('taxonomy.sub_category.scarves_and_wraps', { defaultValue: 'Scarf' }), 'top-[17.0%] left-1/2 w-[32%] h-[20%] z-[36]', { opacity: 0, y: -5, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-top', 'contain')}
            {renderGarment('accessory', t('taxonomy.categories.accessory', { defaultValue: 'Accessory' }), 'top-[17.5%] left-1/2 w-[30%] aspect-square z-[35]', { opacity: 0, x: "-50%" }, { opacity: 1, x: "-50%" }, 'object-top', 'contain')}

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
            {renderGarment('gloves', t('taxonomy.sub_category.gloves', { defaultValue: 'Gloves' }), 'top-[52%] left-1/2 w-[62%] h-[11%] z-[35] drop-shadow-md', { opacity: 0, scale: 0.95, x: "-50%" }, { opacity: 1, scale: 1, x: "-50%" }, 'object-center', 'contain')}
            {renderGarment('watch', t('taxonomy.sub_category.watches', { defaultValue: 'Watch' }), 'top-[51.5%] left-[72%] w-[13%] aspect-square z-[38] drop-shadow-md', { opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }, { opacity: 1, scale: 1, x: "-50%", y: "-50%" }, 'object-center', 'contain')}
            {renderGarment('shoes', t('taxonomy.categories.shoes', { defaultValue: 'Shoes' }), 'bottom-[0.5%] left-1/2 w-[76%] h-[16%] z-[15]', { opacity: 0, y: 10, x: "-50%" }, { opacity: 1, y: 0, x: "-50%" }, 'object-bottom', 'contain')}

            {garments.bag && garments.bag.url && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`absolute top-[44%] right-[-6%] w-[38%] h-[30%] z-[35] drop-shadow-md ${onItemClick && garments.bag.id ? 'cursor-pointer hover:scale-[1.02] transition-transform' : 'pointer-events-none'}`}
                onClick={onItemClick && garments.bag.id ? (e) => { e.stopPropagation(); onItemClick(garments.bag.id); } : undefined}
              >
                <AutoTrimmedGarmentImage
                  src={garments.bag.url}
                  placeholder={garments.bag.placeholder}
                  alt={t('taxonomy.sub_category.bag', { defaultValue: 'Bag' })}
                  objectFitMode="contain"
                />
              </motion.div>
            )}

            {showPointCloudMesh && (
              <PointCloudMeshOverlay
                garments={garments}
                liveAnatomy={liveAnatomy}
              />
            )}
          </DynamicAvatar>
        )}
      </div>

      {/* Floating Layer Quick-Select Bar on the Mannequin (allows inspecting covered underlayers) */}
      {onItemClick && Object.keys(garments).length > 0 && (
        <div className="absolute top-2.5 end-2.5 flex flex-col gap-1 z-40 bg-background/85 backdrop-blur-md p-1 rounded-xl border border-border shadow-md opacity-85 hover:opacity-100 transition-opacity">
          {['headwear', 'glasses', 'earrings', 'scarf', 'outerwear', 'top', 'dress', 'belt', 'watch', 'gloves', 'bottom', 'shoes', 'bag', 'accessory'].map((slotKey) => {
            const g = garments[slotKey];
            if (!g || !g.id) return null;
            const slotIcons = {
              headwear: '🧢',
              glasses: '🕶️',
              earrings: '💎',
              scarf: '🧣',
              outerwear: '🧥',
              top: '👕',
              dress: '👗',
              belt: '🥋',
              watch: '⌚',
              gloves: '🧤',
              bottom: '👖',
              shoes: '👞',
              bag: '👜',
              accessory: '✨'
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

      {/* 3D Try-On Studio Trigger (visible when interactive is enabled) */}
      {interactive && enable3DTryOn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDressingRoomOpen(true);
          }}
          className="absolute bottom-2.5 end-2.5 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-slate-900/85 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700/60 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={t('dressing_room_3d.open_button', { defaultValue: '3D Try-On' })}
          aria-label={t('dressing_room_3d.open_button', { defaultValue: '3D Try-On' })}
          data-testid="open-dressing-room-3d-btn"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary-brand animate-pulse" />
          <span>{t('dressing_room_3d.open_button', { defaultValue: '3D Try-On' })}</span>
        </button>
      )}

      {/* Interactive 3D Try-On Dressing Room Modal */}
      {isDressingRoomOpen && (
        <Suspense fallback={null}>
          <DressingRoom3D
            open={isDressingRoomOpen}
            onOpenChange={setIsDressingRoomOpen}
            outfitItems={garments}
            measurements={computedMeasurements}
            sex={sex}
            skinColor={activeSkinColor}
            hair={activeHair}
            shapeParams={params}
          />
        </Suspense>
      )}
    </div>
  );
}

