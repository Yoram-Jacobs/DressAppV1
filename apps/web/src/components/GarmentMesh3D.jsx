import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { buildAvatarMorphField, applyAvatarMorphsToGeometry } from '@/lib/avatarMorphField';
import { MALE_GLB_URL, FEMALE_GLB_URL } from './AvatarMesh3D';
import {
  resolveFootwearSpec,
  createFittedFootwearGeometry,
  createHeelGeometry,
  poseGeometry,
} from '@/lib/footwearFit';

// ─── Anatomical Profiles Extracted from Avatar 3D Meshes (Exact Metric Coordinates) ───

export const TORSO_PROFILE_FEMALE = [
  { y: 1.46, rx: 0.130, cz: 0.025, rz: 0.090 }, // High collar / neck base
  { y: 1.42, rx: 0.195, cz: 0.030, rz: 0.115 }, // Shoulder line / clavicle (overlays avatar shoulder line)
  { y: 1.36, rx: 0.235, cz: 0.038, rz: 0.138 }, // Upper chest
  { y: 1.25, rx: 0.238, cz: 0.055, rz: 0.162 }, // Bust peak (front Z reaches +0.217, back reaches -0.102)
  { y: 1.15, rx: 0.222, cz: 0.048, rz: 0.145 }, // Under-bust
  { y: 1.05, rx: 0.212, cz: 0.040, rz: 0.138 }, // Natural waist
  { y: 0.95, rx: 0.226, cz: 0.030, rz: 0.148 }, // Upper hips / glutes
  { y: 0.84, rx: 0.230, cz: 0.025, rz: 0.145 }, // Pelvis / crotch
  { y: 0.65, rx: 0.245, cz: 0.025, rz: 0.155 }, // Upper thigh flare (for skirts/dresses)
];

export const TORSO_PROFILE_MALE = [
  { y: 1.52, rx: 0.145, cz: 0.025, rz: 0.100 }, // High collar / neck base
  { y: 1.48, rx: 0.225, cz: 0.028, rz: 0.125 }, // Shoulder line / clavicle (overlays avatar shoulder line)
  { y: 1.42, rx: 0.260, cz: 0.025, rz: 0.155 }, // Shoulders / upper chest
  { y: 1.30, rx: 0.250, cz: 0.040, rz: 0.165 }, // Chest / pecs peak
  { y: 1.18, rx: 0.240, cz: 0.042, rz: 0.152 }, // Rib cage
  { y: 1.08, rx: 0.235, cz: 0.040, rz: 0.145 }, // Waist
  { y: 0.96, rx: 0.245, cz: 0.035, rz: 0.160 }, // Upper hips / glutes
  { y: 0.86, rx: 0.250, cz: 0.030, rz: 0.160 }, // Pelvis / crotch
  { y: 0.70, rx: 0.245, cz: 0.025, rz: 0.155 }, // Thigh flare
];

export const LEG_PROFILE_FEMALE = [
  { y: 0.82, cx: 0.105, r: 0.095, cz: 0.040 }, // Crotch / upper thigh
  { y: 0.65, cx: 0.112, r: 0.082, cz: 0.042 }, // Mid thigh
  { y: 0.50, cx: 0.128, r: 0.070, cz: 0.038 }, // Knee
  { y: 0.35, cx: 0.151, r: 0.065, cz: 0.020 }, // Calf
  { y: 0.20, cx: 0.165, r: 0.048, cz: 0.025 }, // Lower calf
  { y: 0.10, cx: 0.165, r: 0.046, cz: 0.042 }, // Ankle
];

export const LEG_PROFILE_MALE = [
  { y: 0.86, cx: 0.105, r: 0.100, cz: 0.045 }, // Crotch
  { y: 0.70, cx: 0.118, r: 0.088, cz: 0.035 }, // Mid thigh
  { y: 0.50, cx: 0.130, r: 0.076, cz: 0.022 }, // Knee
  { y: 0.30, cx: 0.142, r: 0.068, cz: 0.012 }, // Calf
  { y: 0.10, cx: 0.155, r: 0.052, cz: 0.010 }, // Ankle
];

/**
 * Piecewise linear interpolation across anatomical depth & contour profiles.
 */
function interpolateProfile(profile, y) {
  if (y >= profile[0].y) return { ...profile[0] };
  const last = profile[profile.length - 1];
  if (y <= last.y) return { ...last };

  for (let i = 0; i < profile.length - 1; i++) {
    const p1 = profile[i];
    const p2 = profile[i + 1];
    if (y <= p1.y && y >= p2.y) {
      const t = (p1.y - y) / (p1.y - p2.y);
      const res = {};
      Object.keys(p1).forEach((key) => {
        if (key === 'y') res.y = y;
        else res[key] = p1[key] * (1 - t) + p2[key] * t;
      });
      return res;
    }
  }
  return { ...last };
}

export function getTorsoSlice(y, isMale) {
  const profile = isMale ? TORSO_PROFILE_MALE : TORSO_PROFILE_FEMALE;
  return interpolateProfile(profile, y);
}

export function getLegSlice(y, isMale) {
  const profile = isMale ? LEG_PROFILE_MALE : LEG_PROFILE_FEMALE;
  return interpolateProfile(profile, y);
}

/**
 * Normalizes multi-lingual category / role strings into canonical slots.
 */
export function normalizeGarmentRole(role, category, title) {
  const text = (String(role || '') + ' ' + String(category || '') + ' ' + String(title || '')).toLowerCase().trim();
  if (!text) return 'accessory';

  // 1. Direct slot match
  const r = String(role || '').toLowerCase().trim();
  if (r === 'outerwear' || r === 'coat' || r === 'jacket') return 'outerwear';
  if (r === 'dress' || r === 'full_body' || r === 'one_piece') return 'dress';
  if (r === 'bottom' || r === 'pants' || r === 'skirt' || r === 'shorts') return 'bottom';
  if (r === 'top' || r === 'shirt') return 'top';
  if (r === 'shoes' || r === 'footwear') return 'shoes';
  if (r === 'headwear' || r === 'hat') return 'headwear';
  if (r === 'glasses') return 'glasses';
  if (r === 'belt') return 'belt';
  if (r === 'bag') return 'bag';

  // 2. Multi-lingual Outerwear (checked BEFORE general tops/bottoms)
  if (/(?:outerwear|jacket|coat|blazer|cardigan|parka|overcoat|trench|windbreaker|bomber|shrug|bolero|מעיל|ז['’]קט|ג['’]קט|בלייזר|עליונית|קרדיגן|וסט|ملابس خارجية|معطف|سترة|جاكيت|بليزر|كارديجان|ropa de abrigo|cazadora|chaleco|vêtements d['’]extérieur|vêtement d['’]extérieur|veste|manteau|gilet|outdoor-bekleidung|oberbekleidung|jacke|mantel|weste|capispalla|giacca|cappotto|casacos e jaquetas|agasalho|jaqueta|casaco|cardigã|верхняя одежда|куртка|пальто|пиджак|блейзер|кардиган|外套|大衣|夹克|西装|开衫|アウター|コート|ブレザー|カーディガン|buitenmode|आउटरवियर|जैकेट|कोट|ब्लेज़र)/i.test(text)) {
    return 'outerwear';
  }

  // 3. Multi-lingual Dress & Full Body (including cultural attire)
  if (/(?:dress|gown|jumpsuit|romper|overall|one_piece|full_body|abaya|kaftan|caftan|thobe|achkan|saree|sari|lehenga|anarkali|kurti|kimono|hanbok|שמלה|שמלת|שמלות|אוברול|סרבל|חלוק|גלבייה|חלק שלם|עבאיה|כפתן|סארי|תוב|قطعة كاملة|فستان|جمبسوت|عباية|قفطان|ثوب|جلابية|cuerpo entero|vestido|mono|corps entier|robe|combinaison|ganzkörper|kleid|completi e abiti|abito|tuta|corpo inteiro|macacão|полный образ|плать|комбинезон|连体|套装|连衣裙|裙装|ワンピース|ドレス|オールインワン|volledig lichaam|jurk|फुल बॉडी|साड़ी|लहंगा)/i.test(text)) {
    return 'dress';
  }

  // 4. Multi-lingual Bottoms (pants, jeans, skirts, shorts, leggings)
  if (/(?:bottom|bottoms|pants|jeans|trousers|shorts?|skirt|leggings|sweatpants|joggers|slacks|chino|חלק תחתון|תחתון|מכנסיים|מכנס|חצאית|חצאיות|ג['’]ינס|שורטס|טייץ|דגמ["״]ח|ברמודה|قطعة سفلية|الطبقة السفلية|بنطال|بنطلون|تنورة|شورت|جينز|inferior|parte inferior|pantalón|pantalones|falda|vaqueros|bas|pantalon|jupe|jean|unterteil|unterschicht|hose|rock|pantaloni|gonna|partes de baixo|calça|calças|saia|низ|брюки|штаны|юбка|шорты|джинсы|下装|下层|裤子|长裤|短裤|裙子|半身裙|牛仔裤|ボトムス|ズボン|スカート|onderkleding|बॉटम्स|पतलून|पेंट|सलवार|पायजामा|जींस)/i.test(text)) {
    return 'bottom';
  }

  // 5. Multi-lingual Tops (shirts, blouses, sweaters, hoodies, tees, polos, tanks, camisoles, knitwear)
  if (/(?:top|tops|shirt|blouse|sweater|hoodie|tee|t-shirt|polo|tank|crop|sweatshirt|pullover|camisole|jersey|tunic|kurta|חלק עליון|עליון|חולצה|חולצת|חולצות|בלוזה|סוודר|סוודרים|סווטשירט|קפוצ['’]ון|גופייה|גופיה|גופיות|טוניקה|قطعة علوية|الطبقة العلوية|قميص|بلوزة|كنزة|سويتر|توب|superior|parte superior|camisa|blusa|suéter|sueter|camiseta|haut|chemise|chemisier|pull|oberteil|oberschicht|hemd|bluse|maglia|camicia|camicetta|maglione|partes de cima|верх|рубашка|блузка|свитер|футболка|топ|джемпер|толстовка|худи|上装|顶层|上衣|衬衫|卫衣|毛衣|t恤|トップス|シャツ|ブラウス|セーター|bovenkleding|टॉप्स|टॉप|कुर्ता|शर्ट|ब्लाउज|टी-शर्ट|स्वेटर)/i.test(text)) {
    return 'top';
  }

  // 6. Multi-lingual Footwear / Shoes
  if (/(?:shoes?|footwear|sneakers?|boots?|sandals?|loafers?|heels?|flats?|slippers?|pumps?|clogs?|espadrilles?|הנעלה|נעליים|נעלי|מגפיים|מגפי|סנדלים|מוקסינים|עקבים|קבקבים|أحذية|حذاء|صندل|جزمة|calzado|zapatos|botas|sandalias|zapatillas|chaussure|chaussures|bottes|schuhwerk|schuhe|stiefel|sneaker|scarpe|calzature|stivali|calçados|sapatos|обувь|ботинки|туфли|кроссовки|сапоги|сандалии|鞋履|鞋子|运动鞋|靴子|凉鞋|シューズ|靴|スニーカー|ブーツ|サンダル|schoenen|जूते|सैंडल|चप्पल)/i.test(text)) {
    return 'shoes';
  }

  // 7. Multi-lingual Headwear
  if (/(?:hat|cap|headwear|beanie|beret|turban|hijab|fedora|panama|sombrero|bonnet|כובע|כיפה|ברט|כיסויי ראש|מטפחת|טורבן|أغطية الرأس|غطاء رأس|قبعة|sombreros|gorro|chapeaux|chapeau|bonnet|kopfbedeckung|mütze|hut|copricapo|cappello|chapéus|chapéu|головной убор|шапка|шляпа|кепка|头饰|帽子|キャップ|hoofddeksels|hoed|pet|हेडवियर|टोपी)/i.test(text)) {
    return 'headwear';
  }

  // 8. Multi-lingual Glasses
  if (/(?:glasses|sunglasses|eyewear|spectacles|משקפיים|משקפי|משקפי שמש|نظارات|anteojos|gafas|lunettes|gläser|brille|occhiali|copos|óculos|очки|眼镜|墨镜|眼鏡|サングラス|bril|चश्मा)/i.test(text)) {
    return 'glasses';
  }

  // 9. Multi-lingual Belt
  if (/(?:belt|חגורה|חגורות|חגור|حزام|cinturón|cinturon|ceinture|gürtel|guertel|cintura|cinto|пояс|ремень|腰带|皮带|ベルト|riem|बेल्ट)/i.test(text)) {
    return 'belt';
  }

  // 10. Multi-lingual Bag / Purse
  if (/(?:bag|purse|tote|backpack|handbag|clutch|satchel|crossbody|תיק|ארנק|תיק יד|תרמיל|حقيبة|شنطة|bolso|mochila|sac|tasche|borsa|bolsa|сумка|рюкзак|包|手袋|背包|バッグ|鞄|tas|बैग|पर्स)/i.test(text)) {
    return 'bag';
  }

  return 'accessory';
}

/**
 * Backward compatibility helper for unit tests.
 */
export function extractImageAlphaBounds(img) {
  if (!img) return { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true };
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  return { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: (w / h) > 0.80 };
}

// ─── High-Fidelity Garment Texture Loader with In-Memory Alpha Tight-Cropping ───

const textureCache = new Map();

async function fetchAndCropTexture(url) {
  if (!url || typeof document === 'undefined') return null;
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  let img;
  let objectUrlToRevoke = null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    objectUrlToRevoke = objectUrl;
    img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image decode failed'));
      i.src = objectUrl;
    });
  } catch {
    img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
  }

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    ctx.drawImage(img, 0, 0);
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }

  let imgData = null;
  try {
    imgData = ctx.getImageData(0, 0, w, h);
  } catch {
    imgData = null;
  }

  let minX = 0, maxX = w - 1, minY = 0, maxY = h - 1;
  let dominantColor = '#222226';

  if (imgData) {
    const data = imgData.data;
    let foundMinX = w, foundMaxX = 0, foundMinY = h, foundMaxY = 0;
    let sumR = 0, sumG = 0, sumB = 0, countDom = 0;

    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const a = data[row + x * 4 + 3];
        if (a > 20) {
          if (x < foundMinX) foundMinX = x;
          if (x > foundMaxX) foundMaxX = x;
          if (y < foundMinY) foundMinY = y;
          if (y > foundMaxY) foundMaxY = y;

          // Sample center fabric
          if (x > w * 0.35 && x < w * 0.65 && y > h * 0.25 && y < h * 0.75) {
            sumR += data[row + x * 4];
            sumG += data[row + x * 4 + 1];
            sumB += data[row + x * 4 + 2];
            countDom++;
          }
        }
      }
    }

    if (foundMaxX > foundMinX && foundMaxY > foundMinY) {
      minX = foundMinX;
      maxX = foundMaxX;
      minY = foundMinY;
      maxY = foundMaxY;
    }

    if (countDom > 0) {
      const r = Math.round(sumR / countDom).toString(16).padStart(2, '0');
      const g = Math.round(sumG / countDom).toString(16).padStart(2, '0');
      const b = Math.round(sumB / countDom).toString(16).padStart(2, '0');
      dominantColor = `#${r}${g}${b}`;
    }
  }

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const texture = new THREE.CanvasTexture(cropCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const aspect = cropW / cropH;
  const hasSleeves = aspect > 0.80;

  let solidU = 0.5;
  let solidV = 0.5;
  // Footwear photo layout: locate each shoe silhouette (column runs of opaque pixels)
  // so every foot samples only inside its own shoe in the photo.
  const shoeLayout = { mode: aspect > 1.25 ? 'side' : 'top', toeLeft: true, boxes: null, box: null };
  try {
    const layoutData = cropCtx.getImageData(0, 0, cropW, cropH).data;
    const isOpaque = (o) => {
      const nearWhite = layoutData[o] > 238 && layoutData[o + 1] > 238 && layoutData[o + 2] > 238;
      return layoutData[o + 3] > 40 && !nearWhite;
    };
    const colCount = new Array(cropW).fill(0);
    for (let cy = 0; cy < cropH; cy++) {
      const row = cy * cropW * 4;
      for (let cx = 0; cx < cropW; cx++) {
        if (isOpaque(row + cx * 4)) colCount[cx]++;
      }
    }
    const maxCov = Math.max(1, ...colCount);
    const runs = [];
    let runStart = -1;
    for (let cx = 0; cx <= cropW; cx++) {
      const on = cx < cropW && colCount[cx] > maxCov * 0.06;
      if (on && runStart < 0) runStart = cx;
      if (!on && runStart >= 0) {
        runs.push([runStart, cx - 1]);
        runStart = -1;
      }
    }
    // Merge tiny runs into neighbours, keep the substantial ones
    const big = runs.filter(([r0, r1]) => r1 - r0 + 1 >= cropW * 0.12);
    const boxFor = ([c0, c1]) => {
      let r0 = cropH;
      let r1 = -1;
      for (let cy = 0; cy < cropH; cy++) {
        const row = cy * cropW * 4;
        for (let cx = c0; cx <= c1; cx++) {
          if (isOpaque(row + cx * 4)) {
            if (cy < r0) r0 = cy;
            if (cy > r1) r1 = cy;
            break;
          }
        }
      }
      if (r1 < 0) { r0 = 0; r1 = cropH - 1; }
      // Texture v runs bottom (0) -> top (1)
      return { u0: c0 / cropW, u1: (c1 + 1) / cropW, v0: 1 - (r1 + 1) / cropH, v1: 1 - r0 / cropH };
    };
    if (big.length >= 2) {
      const sorted = big.sort((p1, p2) => (p2[1] - p2[0]) - (p1[1] - p1[0])).slice(0, 2).sort((p1, p2) => p1[0] - p2[0]);
      shoeLayout.mode = 'pair';
      shoeLayout.boxes = sorted.map(boxFor);
    } else {
      const run = big[0] || [0, cropW - 1];
      const box = boxFor(run);
      shoeLayout.box = box;
      const bw = (box.u1 - box.u0) * cropW;
      const bh = (box.v1 - box.v0) * cropH;
      shoeLayout.mode = bw / Math.max(1, bh) > 1.25 ? 'side' : 'top';
      if (shoeLayout.mode === 'side') {
        // The toe end of a side-view shoe is the lower end
        const quarter = Math.max(1, Math.floor((run[1] - run[0] + 1) * 0.25));
        let leftH = 0;
        let rightH = 0;
        for (let k = 0; k < quarter; k++) {
          leftH += colCount[run[0] + k];
          rightH += colCount[run[1] - k];
        }
        shoeLayout.toeLeft = leftH < rightH;
      }
    }
  } catch {
    // Keep default layout
  }

  try {
    const cropImgData = cropCtx.getImageData(0, 0, cropW, cropH);
    const cData = cropImgData.data;
    const opaqueXs = [];
    const opaqueYs = [];
    for (let cy = 0; cy < cropH; cy++) {
      const row = cy * cropW * 4;
      for (let cx = 0; cx < cropW; cx++) {
        if (cData[row + cx * 4 + 3] > 240) {
          opaqueXs.push(cx);
          opaqueYs.push(cy);
        }
      }
    }
    if (opaqueXs.length > 0) {
      opaqueXs.sort((a, b) => a - b);
      opaqueYs.sort((a, b) => a - b);
      const medX = opaqueXs[Math.floor(opaqueXs.length / 2)];
      const medY = opaqueYs[Math.floor(opaqueYs.length / 2)];
      solidU = Math.max(0.02, Math.min(0.98, medX / cropW));
      solidV = Math.max(0.02, Math.min(0.98, 1.0 - (medY / cropH)));
    }
  } catch {
    solidU = 0.5;
    solidV = 0.5;
  }

  // Gap-free variant for clothing shells: on every row that contains fabric, fill
  // transparent holes between the garment's outer edges (e.g. the wedge between a
  // sleeve and the body in flat-lay photos) and extend the edge colour outward, so
  // flank and side-seam samples never land on see-through background. Rows with no
  // fabric at all (above a strapless neckline, etc.) stay transparent.
  let filledTexture = null;
  try {
    const fillData = cropCtx.getImageData(0, 0, cropW, cropH);
    const px = fillData.data;
    const pad = Math.max(2, Math.round(cropW * 0.14));
    const ALPHA_ON = 128;
    for (let cy = 0; cy < cropH; cy++) {
      const row = cy * cropW * 4;
      let left = -1;
      let right = -1;
      for (let cx = 0; cx < cropW; cx++) {
        if (px[row + cx * 4 + 3] >= ALPHA_ON) {
          if (left < 0) left = cx;
          right = cx;
        }
      }
      if (left < 0) continue;
      // Interior holes: carry the last opaque colour across
      let lastO = row + left * 4;
      for (let cx = left; cx <= right; cx++) {
        const o = row + cx * 4;
        if (px[o + 3] >= ALPHA_ON) {
          lastO = o;
        } else {
          px[o] = px[lastO]; px[o + 1] = px[lastO + 1]; px[o + 2] = px[lastO + 2]; px[o + 3] = 255;
        }
      }
      // Outward edge extension
      const lo = row + left * 4;
      for (let cx = Math.max(0, left - pad); cx < left; cx++) {
        const o = row + cx * 4;
        px[o] = px[lo]; px[o + 1] = px[lo + 1]; px[o + 2] = px[lo + 2]; px[o + 3] = 255;
      }
      const ro = row + right * 4;
      for (let cx = right + 1; cx <= Math.min(cropW - 1, right + pad); cx++) {
        const o = row + cx * 4;
        px[o] = px[ro]; px[o + 1] = px[ro + 1]; px[o + 2] = px[ro + 2]; px[o + 3] = 255;
      }
    }
    const fillCanvas = document.createElement('canvas');
    fillCanvas.width = cropW;
    fillCanvas.height = cropH;
    fillCanvas.getContext('2d').putImageData(fillData, 0, 0);
    filledTexture = new THREE.CanvasTexture(fillCanvas);
    filledTexture.colorSpace = THREE.SRGBColorSpace;
    filledTexture.wrapS = THREE.ClampToEdgeWrapping;
    filledTexture.wrapT = THREE.ClampToEdgeWrapping;
    filledTexture.generateMipmaps = true;
    filledTexture.minFilter = THREE.LinearMipmapLinearFilter;
    filledTexture.magFilter = THREE.LinearFilter;
    filledTexture.needsUpdate = true;
  } catch {
    filledTexture = null;
  }

  // Opaque variant (transparent pixels filled with the dominant fabric colour)
  const opaqueCanvas = document.createElement('canvas');
  opaqueCanvas.width = cropW;
  opaqueCanvas.height = cropH;
  const opaqueCtx = opaqueCanvas.getContext('2d');
  opaqueCtx.fillStyle = dominantColor;
  opaqueCtx.fillRect(0, 0, cropW, cropH);
  opaqueCtx.drawImage(cropCanvas, 0, 0);
  const opaqueTexture = new THREE.CanvasTexture(opaqueCanvas);
  opaqueTexture.colorSpace = THREE.SRGBColorSpace;
  opaqueTexture.wrapS = THREE.ClampToEdgeWrapping;
  opaqueTexture.wrapT = THREE.ClampToEdgeWrapping;
  opaqueTexture.needsUpdate = true;

  const res = {
    texture,
    opaqueTexture,
    filledTexture,
    dominantColor,
    hasSleeves,
    aspect,
    solidU,
    solidV,
    shoeLayout: { ...shoeLayout, solidU, solidV },
    bounds: {
      uMin: 0,
      uMax: 1,
      vMin: 0,
      vMax: 1,
      hasSleeves,
    },
  };

  textureCache.set(url, res);
  return res;
}

function useGarmentTexture(url) {
  const [data, setData] = useState({
    texture: null,
    opaqueTexture: null,
    filledTexture: null,
    dominantColor: '#222226',
    hasSleeves: true,
    aspect: 1.0,
    solidU: 0.5,
    solidV: 0.5,
    bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
  });

  useEffect(() => {
    let mounted = true;
    if (!url) {
      setData({
        texture: null,
        opaqueTexture: null,
        filledTexture: null,
        dominantColor: '#222226',
        hasSleeves: true,
        aspect: 1.0,
        bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
      });
      return;
    }

    fetchAndCropTexture(url)
      .then((res) => {
        if (mounted && res) setData(res);
      })
      .catch(() => {
        // Fallback standard texture loader
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(url, (tex) => {
          if (!mounted) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          setData({
            texture: tex,
            opaqueTexture: tex,
            filledTexture: tex,
            dominantColor: '#222226',
            hasSleeves: true,
            aspect: 1.0,
            solidU: 0.5,
            solidV: 0.5,
            bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
          });
        });
      });

    return () => {
      mounted = false;
    };
  }, [url]);

  return data;
}

// ─── Sleeve Classification & Length Resolution ───

/**
 * Detects sleeve style and relative arm-coverage factor (0.0 = sleeveless, 1.0 = wrist)
 * using garment taxonomy, multilingual name/description tokens, slot role, and silhouette aspect ratio.
 */
export function detectSleeveStyle({ garmentText = '', rawSlot = '', aspect = 1.0 } = {}) {
  const text = (garmentText || '').toLowerCase();

  // 1. Explicit sleeveless keywords (highest precedence)
  const isExplicitSleeveless =
    text.includes('sleeveless') ||
    text.includes('tank') ||
    text.includes('vest') ||
    text.includes('tube') ||
    text.includes('camisole') ||
    text.includes('halter') ||
    text.includes('strapless') ||
    text.includes('גופי') ||
    text.includes('גופיה') ||
    text.includes('גופייה') ||
    text.includes('גופיית') ||
    text.includes('וסט') ||
    text.includes('סטרפלס') ||
    text.includes('ללא שרוולים') ||
    text.includes('sin mangas') ||
    text.includes('sans manches') ||
    text.includes('ärmellos') ||
    text.includes('بدון أكمام');

  if (isExplicitSleeveless) {
    return { type: 'sleeveless', factor: 0.0 };
  }

  // 2. Cap sleeve keywords
  const isCapSleeve =
    text.includes('cap sleeve') ||
    text.includes('cap-sleeve') ||
    text.includes('שרוול כנף') ||
    text.includes('שרוול קפון');

  if (isCapSleeve) {
    return { type: 'cap', factor: 0.18 };
  }

  // 3. Short sleeve / T-shirt / polo keywords
  const isShortSleeve =
    text.includes('t-shirt') ||
    text.includes('tshirt') ||
    text.includes('t shirt') ||
    text.includes('tee') ||
    text.includes('polo') ||
    text.includes('short sleeve') ||
    text.includes('short-sleeve') ||
    text.includes('short_sleeve') ||
    text.includes('חולצת טריקו') ||
    text.includes('חולצת טי') ||
    text.includes('טישרט') ||
    text.includes('שרוול קצר') ||
    text.includes('שרוולים קצרים') ||
    text.includes('חולצה קצרה') ||
    text.includes('manga corta') ||
    text.includes('manches courtes') ||
    text.includes('kurzarm') ||
    text.includes('نصف كم') ||
    text.includes('أكمام قصيرة');

  if (isShortSleeve) {
    return { type: 'short', factor: 0.36 };
  }

  // 4. Three-quarter sleeve keywords
  const isThreeQuarter =
    text.includes('3/4') ||
    text.includes('three-quarter') ||
    text.includes('three quarter') ||
    text.includes('שרוול 3/4') ||
    text.includes('שרוול שלושת רבעי');

  if (isThreeQuarter) {
    return { type: 'three_quarter', factor: 0.65 };
  }

  // 5. Long sleeve keywords / Outerwear / Knitwear
  const isExplicitLong =
    rawSlot === 'outerwear' ||
    text.includes('long sleeve') ||
    text.includes('long-sleeve') ||
    text.includes('long_sleeve') ||
    text.includes('sweater') ||
    text.includes('pullover') ||
    text.includes('cardigan') ||
    text.includes('blazer') ||
    text.includes('coat') ||
    text.includes('jacket') ||
    text.includes('hoodie') ||
    text.includes('sweatshirt') ||
    text.includes('סוודר') ||
    text.includes('בלייזר') ||
    text.includes("ג'קט") ||
    text.includes("ז'קט") ||
    text.includes('מעיל') ||
    text.includes('קרדיגן') ||
    text.includes("קפוצ'ון") ||
    text.includes('שרוול ארוך') ||
    text.includes('שרוולים ארוכים') ||
    text.includes('manga larga') ||
    text.includes('manches longues') ||
    text.includes('langarm') ||
    text.includes('كم طويل');

  if (isExplicitLong) {
    return { type: 'long', factor: 1.0 };
  }

  // 6. Silhouette aspect ratio fallback
  if (aspect < 0.78) {
    return { type: 'sleeveless', factor: 0.0 };
  } else if (aspect < 1.20) {
    return { type: 'short', factor: 0.36 };
  } else {
    return { type: 'long', factor: 1.0 };
  }
}

// ─── 3D Parametric Body-Wrapping Geometry Builders ───

/**
 * Creates 3D Top or Outerwear geometry with anatomically contoured torso shell
 * wrapping seamlessly 360° around the avatar's body AND left/right sleeve shells.
 */
export function createAnatomicalTopGeometry({
  isMale = false,
  hasSleeves = true,
  sleeveFactor = 1.0,
  yTop = isMale ? 1.53 : 1.47,
  yBottom = isMale ? 0.88 : 0.84,
  layerOffset = 0.015,
  uSwatch = 0.50,
  vSwatch = 0.50,
} = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  // 1. Torso Shell (wrapping 360° continuously around collar, chest, waist, and hips)
  const ny = 20;
  const nx = 28;
  const yShoulder = isMale ? 1.48 : 1.42;
  const hasAnySleeve = hasSleeves && sleeveFactor > 0.05;

  for (let i = 0; i <= ny; i++) {
    const vNorm = i / ny;
    const y = yTop - vNorm * (yTop - yBottom);
    const slice = getTorsoSlice(y, isMale);

    const rx = slice.rx + layerOffset;
    const rz = slice.rz + layerOffset;
    const cz = slice.cz;

    // vTex runs from 0.98 (collar) to 0.02 (bottom hem)
    const vTex = 0.98 - vNorm * 0.94;

    // Anatomical trapezoid UV mapping: collar to shoulder flare
    let uLeft, uRight;
    if (y >= yShoulder) {
      const tNeck = (y - yShoulder) / Math.max(0.01, yTop - yShoulder);
      uLeft = 0.22 + tNeck * (0.41 - 0.22);
      uRight = 0.78 - tNeck * (0.78 - 0.59);
    } else {
      uLeft = hasAnySleeve ? 0.20 : 0.05;
      uRight = hasAnySleeve ? 0.80 : 0.95;
    }

    for (let j = 0; j <= nx; j++) {
      const uFrac = j / nx;
      // theta: -PI (back center) -> -PI/2 (left flank) -> 0 (front center) -> +PI/2 (right flank) -> +PI (back center)
      const theta = -Math.PI + uFrac * 2 * Math.PI;

      const x = rx * Math.sin(theta);
      const isFront = Math.cos(theta) >= 0;

      // Anatomical bust / chest projection guaranteeing zero penetration
      const bustFactor = Math.max(0, Math.cos(theta * 1.5));
      const bustBulge = (y >= 1.15 && y <= 1.32 && !isMale) ? 0.022 * bustFactor : 0.0;
      const z = isFront
        ? cz + (rz + bustBulge) * Math.cos(theta)
        : cz - (rz + 0.012) * Math.abs(Math.cos(theta));
      verts.push(x, y, z);

      if (isFront) {
        const flankFrac = Math.abs(Math.sin(theta));
        if (flankFrac > 0.82) {
          // Flank boundary: seamless solid fabric swatch transitioning into back
          uvs.push(
            Math.max(0.01, Math.min(0.99, uSwatch + Math.sin(theta) * 0.02)),
            Math.max(0.01, Math.min(0.99, vSwatch))
          );
        } else {
          // Front photo projection
          const uT = uLeft + ((Math.sin(theta) / 0.82 + 1) * 0.5) * (uRight - uLeft);
          uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
        }
      } else {
        // Back of jacket/shirt: seamless matching fabric (guaranteed 100% opaque)
        const backSpread = Math.sin(theta) * 0.04;
        uvs.push(
          Math.max(0.01, Math.min(0.99, uSwatch + backSpread)),
          Math.max(0.01, Math.min(0.99, vSwatch))
        );
      }
    }
  }

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2. Left & Right Sleeves (following avatar arm trajectory parameterized by sleeveFactor: short, 3/4, or long)
  if (hasAnySleeve) {
    const sides = [-1, 1]; // Left (-X), Right (+X)
    const nySleeve = Math.max(4, Math.round(10 * Math.min(1.0, sleeveFactor * 1.5)));
    const nxSleeve = 14;

    const yArmStart = isMale ? 1.48 : 1.42;
    const fullYArmEnd = isMale ? 0.96 : 0.90;
    const yArmEnd = yArmStart - sleeveFactor * (yArmStart - fullYArmEnd);

    const xArmStart = isMale ? 0.225 : 0.195;
    const fullXArmEnd = isMale ? 0.280 : 0.255;
    const xArmEnd = xArmStart + sleeveFactor * (fullXArmEnd - xArmStart);

    const fullZArmEnd = 0.040;
    const zArmEnd = 0.020 + sleeveFactor * (fullZArmEnd - 0.020);

    const rArmStart = 0.060 + layerOffset;
    const fullRArmEnd = 0.042 + layerOffset;
    const rArmEnd = rArmStart - sleeveFactor * (rArmStart - fullRArmEnd);

    // Sleeve UV runs from shoulder seam (0.85) down to cuff in the 2D photo
    const vCuff = 0.85 - sleeveFactor * (0.85 - 0.15);
    const uCuffOffset = sleeveFactor * (0.23 - 0.08);

    sides.forEach((side) => {
      const startIdx = verts.length / 3;

      for (let i = 0; i <= nySleeve; i++) {
        const t = i / nySleeve;
        const yArm = yArmStart - t * (yArmStart - yArmEnd);
        const xArm = side * (xArmStart + t * (xArmEnd - xArmStart));
        const zArm = 0.020 + t * (zArmEnd - 0.020);
        const rArm = rArmStart - t * (rArmStart - rArmEnd);

        const vTex = 0.85 - t * (0.85 - vCuff);
        const uCenter = side === -1
          ? 0.23 - t * uCuffOffset
          : 0.77 + t * uCuffOffset;

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rArm * Math.sin(theta);
          const y = yArm;
          const z = zArm + rArm * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          if (isFront) {
            const uArm = uCenter + ((Math.sin(theta) + 1) * 0.5 - 0.5) * (0.14 * Math.min(1.0, sleeveFactor * 1.3));
            uvs.push(Math.max(0.01, Math.min(0.99, uArm)), Math.max(0.01, Math.min(0.99, vTex)));
          } else {
            uvs.push(
              Math.max(0.01, Math.min(0.99, uSwatch)),
              Math.max(0.01, Math.min(0.99, vSwatch))
            );
          }
        }
      }

      for (let i = 0; i < nySleeve; i++) {
        for (let j = 0; j < nxSleeve; j++) {
          const a = startIdx + i * (nxSleeve + 1) + j;
          const b = a + 1;
          const c = a + (nxSleeve + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    });
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export const createAnatomicalTorsoGeometry = (opts) => createAnatomicalTopGeometry(opts);

/**
 * Creates 3D Dress geometry combining a contoured bodice and a flared lower skirt shell
 * that wraps around the avatar's body in 3D down past the knees.
 */
export function createAnatomicalDressGeometry({
  isMale = false,
  hasSleeves = false,
  sleeveFactor = 1.0,
  yTop = isMale ? 1.53 : 1.47,
  yBottom = 0.50,
  layerOffset = 0.018,
  uSwatch = 0.50,
  vSwatch = 0.50,
} = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  // 1. Bodice & Flared Skirt 360° Shell
  const ny = 22;
  const nx = 26;
  const yShoulder = isMale ? 1.48 : 1.42;

  for (let i = 0; i <= ny; i++) {
    const vNorm = i / ny;
    const y = yTop - vNorm * (yTop - yBottom);
    const slice = getTorsoSlice(Math.max(0.84, y), isMale);

    let rx = slice.rx + layerOffset;
    let rz = slice.rz + layerOffset;
    const cz = slice.cz;

    // Flare skirt naturally below hips (y < 0.84)
    if (y < 0.84) {
      const flareRatio = Math.pow((0.84 - y) / (0.84 - yBottom), 1.15);
      rx += flareRatio * 0.14;
      rz += flareRatio * 0.10;
    }

    const vTex = 0.98 - vNorm * 0.94;

    let uLeft, uRight;
    if (y >= yShoulder) {
      const tNeck = (y - yShoulder) / Math.max(0.01, yTop - yShoulder);
      uLeft = 0.12 + tNeck * (0.35 - 0.12);
      uRight = 0.88 - tNeck * (0.88 - 0.65);
    } else {
      uLeft = hasSleeves ? 0.20 : 0.05;
      uRight = hasSleeves ? 0.80 : 0.95;
    }

    for (let j = 0; j <= nx; j++) {
      const uFrac = j / nx;
      const theta = -Math.PI + uFrac * 2 * Math.PI;

      const x = rx * Math.sin(theta);
      const isFront = Math.cos(theta) >= 0;

      // Anatomical bust / chest projection
      const bustFactor = Math.max(0, Math.cos(theta * 1.5));
      const bustBulge = (y >= 1.15 && y <= 1.32 && !isMale) ? 0.022 * bustFactor : 0.0;
      const z = isFront
        ? cz + (rz + bustBulge) * Math.cos(theta)
        : cz - (rz + 0.012) * Math.abs(Math.cos(theta));
      verts.push(x, y, z);

      if (isFront) {
        const flankFrac = Math.abs(Math.sin(theta));
        if (flankFrac > 0.82) {
          uvs.push(
            Math.max(0.01, Math.min(0.99, uSwatch + Math.sin(theta) * 0.02)),
            Math.max(0.01, Math.min(0.99, vSwatch))
          );
        } else {
          const uT = uLeft + ((Math.sin(theta) / 0.82 + 1) * 0.5) * (uRight - uLeft);
          uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
        }
      } else {
        const backSpread = Math.sin(theta) * 0.04;
        uvs.push(
          Math.max(0.01, Math.min(0.99, uSwatch + backSpread)),
          Math.max(0.01, Math.min(0.99, vSwatch))
        );
      }
    }
  }

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2. Dress Sleeves (if dress has sleeves)
  const hasAnyDressSleeve = hasSleeves && sleeveFactor > 0.05;
  if (hasAnyDressSleeve) {
    const sides = [-1, 1];
    const nySleeve = Math.max(4, Math.round(10 * Math.min(1.0, sleeveFactor * 1.5)));
    const nxSleeve = 12;

    const yArmStart = isMale ? 1.48 : 1.42;
    const fullYArmEnd = isMale ? 0.96 : 0.90;
    const yArmEnd = yArmStart - sleeveFactor * (yArmStart - fullYArmEnd);

    const xArmStart = isMale ? 0.225 : 0.195;
    const fullXArmEnd = isMale ? 0.280 : 0.255;
    const xArmEnd = xArmStart + sleeveFactor * (fullXArmEnd - xArmStart);

    const fullZArmEnd = 0.040;
    const zArmEnd = 0.020 + sleeveFactor * (fullZArmEnd - 0.020);

    const rArmStart = 0.060 + layerOffset;
    const fullRArmEnd = 0.042 + layerOffset;
    const rArmEnd = rArmStart - sleeveFactor * (rArmStart - fullRArmEnd);

    const vCuff = 0.85 - sleeveFactor * (0.85 - 0.20);
    const uCuffOffset = sleeveFactor * (0.23 - 0.08);

    sides.forEach((side) => {
      const startIdx = verts.length / 3;

      for (let i = 0; i <= nySleeve; i++) {
        const t = i / nySleeve;
        const yArm = yArmStart - t * (yArmStart - yArmEnd);
        const xArm = side * (xArmStart + t * (xArmEnd - xArmStart));
        const zArm = 0.020 + t * (zArmEnd - 0.020);
        const rArm = rArmStart - t * (rArmStart - rArmEnd);
        const vTex = 0.85 - t * (0.85 - vCuff);
        const uCenter = side === -1
          ? 0.23 - t * uCuffOffset
          : 0.77 + t * uCuffOffset;

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rArm * Math.sin(theta);
          const y = yArm;
          const z = zArm + rArm * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          if (isFront) {
            const uArm = uCenter + ((Math.sin(theta) + 1) * 0.5 - 0.5) * (0.14 * Math.min(1.0, sleeveFactor * 1.3));
            uvs.push(Math.max(0.01, Math.min(0.99, uArm)), Math.max(0.01, Math.min(0.99, vTex)));
          } else {
            uvs.push(
              Math.max(0.01, Math.min(0.99, uSwatch)),
              Math.max(0.01, Math.min(0.99, vSwatch))
            );
          }
        }
      }

      for (let i = 0; i < nySleeve; i++) {
        for (let j = 0; j < nxSleeve; j++) {
          const a = startIdx + i * (nxSleeve + 1) + j;
          const b = a + 1;
          const c = a + (nxSleeve + 1);
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    });
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createAnatomicalBottomGeometry({
  isMale = false,
  isSkirt = false,
  isShorts = false,
  yTop = 1.05,
  yHem = 0.10,
  layerOffset = 0.014,
  uSwatch = 0.50,
  vSwatch = 0.50,
} = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  // A. SKIRT MODE
  if (isSkirt) {
    const ny = 16;
    const nx = 24;
    for (let i = 0; i <= ny; i++) {
      const vNorm = i / ny;
      const y = yTop - vNorm * (yTop - yHem);
      const slice = getTorsoSlice(Math.max(0.84, y), isMale);

      let rx = slice.rx + layerOffset;
      let rz = slice.rz + layerOffset;
      const cz = slice.cz;

      if (y < 0.84) {
        const flareRatio = Math.pow((0.84 - y) / (0.84 - yHem), 1.2);
        rx += flareRatio * 0.14;
        rz += flareRatio * 0.10;
      }

      const vTex = 1.0 - vNorm;

      for (let j = 0; j <= nx; j++) {
        const uFrac = j / nx;
        const theta = -Math.PI + uFrac * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const isFront = Math.cos(theta) >= 0;
        const z = isFront
          ? cz + rz * Math.cos(theta)
          : cz - (rz + 0.012) * Math.abs(Math.cos(theta));
        verts.push(x, y, z);

        if (isFront) {
          const uT = (Math.sin(theta) + 1) * 0.5;
          uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
        } else {
          uvs.push(
            Math.max(0.01, Math.min(0.99, uSwatch)),
            Math.max(0.01, Math.min(0.99, vSwatch))
          );
        }
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // B. PANTS / JEANS / TROUSERS / SHORTS MODE
  const yWaist = yTop;
  const yCrotch = isMale ? 0.86 : 0.82;
  const yAnkle = isShorts ? (isMale ? 0.58 : 0.54) : yHem;

  // 1. Pelvis & Waistband Section
  const nyPelvis = 6;
  const nxPelvis = 24;

  for (let i = 0; i <= nyPelvis; i++) {
    const vPelvis = i / nyPelvis;
    const y = yWaist - vPelvis * (yWaist - yCrotch);
    const slice = getTorsoSlice(y, isMale);

    const rx = slice.rx + layerOffset;
    const rz = slice.rz + layerOffset;
    const cz = slice.cz;
    const vTex = 1.0 - vPelvis * ((yWaist - yCrotch) / (yWaist - yAnkle));

    for (let j = 0; j <= nxPelvis; j++) {
      const uFrac = j / nxPelvis;
      const theta = -Math.PI + uFrac * 2 * Math.PI;
      const x = rx * Math.sin(theta);
      const isFront = Math.cos(theta) >= 0;
      const z = isFront
        ? cz + rz * Math.cos(theta)
        : cz - (rz + 0.012) * Math.abs(Math.cos(theta));
      verts.push(x, y, z);

      if (isFront) {
        const uT = (Math.sin(theta) + 1) * 0.5;
        uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
      } else {
        uvs.push(
          Math.max(0.01, Math.min(0.99, uSwatch)),
          Math.max(0.01, Math.min(0.99, vSwatch))
        );
      }
    }
  }

  for (let i = 0; i < nyPelvis; i++) {
    for (let j = 0; j < nxPelvis; j++) {
      const a = i * (nxPelvis + 1) + j;
      const b = a + 1;
      const c = a + (nxPelvis + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2. Left & Right 3D Leg Shells
  const nyLeg = 14;
  const nxLeg = 16;
  const legSides = [-1, 1]; // Left (-X), Right (+X)

  legSides.forEach((side) => {
    const startIdx = verts.length / 3;

    for (let i = 0; i <= nyLeg; i++) {
      const vLeg = i / nyLeg;
      const y = yCrotch - vLeg * (yCrotch - yAnkle);
      const slice = getLegSlice(y, isMale);

      const cx = side * slice.cx;
      const cz = slice.cz;
      const r = slice.r + layerOffset;
      const vTex = 1.0 - (((yWaist - yCrotch) + vLeg * (yCrotch - yAnkle)) / (yWaist - yAnkle));

      for (let j = 0; j <= nxLeg; j++) {
        const uFrac = j / nxLeg;
        const theta = -Math.PI + uFrac * 2 * Math.PI;
        const x = cx + r * Math.sin(theta);
        const isFront = Math.cos(theta) >= 0;
        const z = isFront
          ? cz + r * Math.cos(theta)
          : cz - (r + 0.008) * Math.abs(Math.cos(theta));
        verts.push(x, y, z);

        if (isFront) {
          // Left leg: u in [0.05, 0.48]; Right leg: u in [0.52, 0.95]
          const uLeg = side === -1
            ? 0.05 + ((Math.sin(theta) + 1) * 0.5) * 0.43
            : 0.52 + ((Math.sin(theta) + 1) * 0.5) * 0.43;
          uvs.push(Math.max(0, Math.min(1, uLeg)), Math.max(0, Math.min(1, vTex)));
        } else {
          uvs.push(
            Math.max(0.01, Math.min(0.99, uSwatch)),
            Math.max(0.01, Math.min(0.99, vSwatch))
          );
        }
      }
    }

    for (let i = 0; i < nyLeg; i++) {
      for (let j = 0; j < nxLeg; j++) {
        const a = startIdx + i * (nxLeg + 1) + j;
        const b = a + 1;
        const c = a + (nxLeg + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  });

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates 3D footwear geometry mapping directly over avatar feet stance.
 */
export function createAnatomicalFootwearGeometry({
  isMale = false,
  yTop = 0.095,
  ySole = -0.006,
  layerOffset = 0.010,
} = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const footCenterX = isMale ? 0.158 : 0.178;
  const footSides = [-footCenterX, footCenterX];
  const ny = 6;
  const nx = 16;

  footSides.forEach((cx, idx) => {
    const startIdx = verts.length / 3;

    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = yTop - v * (yTop - ySole);

      // Ankle collar down to toe/sole center and radii
      const cz = isMale
        ? 0.025 + v * (0.065 - 0.025)
        : 0.045 + v * (0.113 - 0.045);
      const rx = (isMale ? 0.052 : 0.046) + v * 0.014 + layerOffset;
      const rz = (isMale ? 0.090 : 0.082) + v * 0.055 + layerOffset;
      const vTex = 1.0 - v;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = cx + rx * Math.sin(theta);
        const z = cz + rz * Math.cos(theta);
        verts.push(x, y, z);

        const uT = idx === 0
          ? 0.02 + ((Math.sin(theta) + 1) * 0.5) * 0.46
          : 0.52 + ((Math.sin(theta) + 1) * 0.5) * 0.46;
        uvs.push(Math.max(0, Math.min(1, uT)), Math.max(0, Math.min(1, vTex)));
      }
    }

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = startIdx + i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  });

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createAnatomicalAccessoryGeometry(type, { isMale = false } = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const baseHeadY = isMale ? 1.70 : 1.62;

  if (type === 'headwear') {
    const ny = 8;
    const nx = 18;
    const rHead = 0.125;
    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const phi = v * (Math.PI * 0.45);
      const y = baseHeadY + rHead * Math.cos(phi);
      const r = rHead * Math.sin(phi) + 0.02;

      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        verts.push(r * Math.sin(theta), y, 0.04 + r * Math.cos(theta));
        uvs.push(u, 1 - v);
      }
    }
    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
  } else if (type === 'glasses') {
    const yEye = isMale ? 1.62 : 1.56;
    verts.push(-0.075, yEye - 0.025, 0.138, 0.075, yEye - 0.025, 0.138, 0.075, yEye + 0.025, 0.138, -0.075, yEye + 0.025, 0.138);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(0, 1, 2, 0, 2, 3);
  } else {
    // Belt / general torso accessory
    const yBelt = isMale ? 1.08 : 1.05;
    verts.push(-0.19, yBelt - 0.03, 0.145, 0.19, yBelt - 0.03, 0.145, 0.19, yBelt + 0.03, 0.145, -0.19, yBelt + 0.03, 0.145);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(0, 1, 2, 0, 2, 3);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * GarmentMesh3D
 * 
 * Renders an active outfit piece in the 3D Try-On Dressing Room with authentic 3D depth,
 * anatomical body-contoured drape around chest, shoulders, waist, and sleeves,
 * contact shadows, and physical studio materials.
 */
export default function GarmentMesh3D({
  garment,
  slot,
  isMale = false,
  visible = true,
  hasOuterwear = false,
  morphInfluences = null,
  footPose = null,
}) {
  const {
    texture,
    opaqueTexture = null,
    filledTexture = null,
    dominantColor,
    hasSleeves: autoHasSleeves,
    aspect = 1.0,
    solidU = 0.5,
    solidV = 0.5,
    shoeLayout = null,
  } = useGarmentTexture(garment?.url);

  const rawSlot = normalizeGarmentRole(
    slot || garment?.slot,
    garment?.category,
    garment?.name || garment?.title || garment?.sub_category || garment?.item_type
  );
  const garmentText = `${garment?.sub_category || ''} ${garment?.item_type || ''} ${garment?.name || ''} ${garment?.category || ''}`.toLowerCase();
  const footwearSpec = useMemo(
    () => (rawSlot === 'shoes' ? resolveFootwearSpec(garment) : null),
    [rawSlot, garment]
  );

  // Avatar morph field: lets garments inherit the exact body deformation
  // (height, leg length, bust, shoulders...) applied to the avatar mesh.
  const { scene: avatarScene } = useGLTF(isMale ? MALE_GLB_URL : FEMALE_GLB_URL);
  const morphField = useMemo(() => buildAvatarMorphField(avatarScene), [avatarScene]);

  // Build the appropriate 3D geometry matching this slot and garment type
  // (authored in the avatar's base, un-morphed coordinate space)
  const baseGeometry = useMemo(() => {
    if (!visible) return null;

    // Morph-driven reshaping is applied afterwards via the avatar morph field
    const yShift = 0;
    const rxShift = 0;

    // 1. TOP
    if (rawSlot === 'top') {
      const isCrop = garmentText.includes('crop') || garmentText.includes('sports_bra') || garmentText.includes('bralette') || garmentText.includes('קרופ') || garmentText.includes('חזיה');
      const isLongline = garmentText.includes('kurta') || garmentText.includes('tunic') || garmentText.includes('longline') || garmentText.includes('thobe') || garmentText.includes('טוניקה');
      const sleeveStyle = detectSleeveStyle({ garmentText, rawSlot: 'top', aspect });

      // High collar at 1.47 (F) / 1.53 (M), shoulder seam overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.53 : 1.47) + yShift;
      let yBottom = (isMale ? 0.90 : 0.86) + yShift;
      if (isCrop) yBottom = (isMale ? 1.18 : 1.12) + yShift;
      if (isLongline) yBottom = (isMale ? 0.75 : 0.70) + yShift;

      const layerOffset = (hasOuterwear ? 0.016 : 0.022) + rxShift;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: sleeveStyle.type !== 'sleeveless' && autoHasSleeves,
        sleeveFactor: sleeveStyle.factor,
        yTop,
        yBottom,
        layerOffset,
        uSwatch: solidU,
        vSwatch: solidV,
      });
    }

    // 2. OUTERWEAR (Blazers, Suits, Coats, Jackets, Cardigans)
    if (rawSlot === 'outerwear') {
      const isLongCoat = garmentText.includes('overcoat') || garmentText.includes('trench') || garmentText.includes('duster') || garmentText.includes('מעיל ארוך') || garmentText.includes('cardigan') || garmentText.includes('קרדיגן');
      const isCropJacket = garmentText.includes('bolero') || garmentText.includes('shrug') || garmentText.includes('עליונית קצרה') || (garmentText.includes('jacket') && garmentText.includes('crop'));
      const sleeveStyle = detectSleeveStyle({ garmentText, rawSlot: 'outerwear', aspect });

      // Outerwear collar stands at 1.48 (F) / 1.54 (M), shoulder line overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.54 : 1.48) + yShift;
      let yBottom = (isMale ? 0.88 : 0.84) + yShift;
      if (isLongCoat) yBottom = (isMale ? 0.52 : 0.48) + yShift;
      if (isCropJacket) yBottom = (isMale ? 1.15 : 1.10) + yShift;

      // Layered cleanly outside tops with generous clearance
      const layerOffset = (isMale ? 0.038 : 0.034) + rxShift;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: sleeveStyle.type !== 'sleeveless',
        sleeveFactor: sleeveStyle.factor,
        yTop,
        yBottom,
        layerOffset,
        uSwatch: solidU,
        vSwatch: solidV,
      });
    }

    // 3. DRESS
    if (rawSlot === 'dress') {
      const isMini = garmentText.includes('mini') || garmentText.includes('קצרה');
      const isMaxi = garmentText.includes('maxi') || garmentText.includes('gown') || garmentText.includes('evening') || garmentText.includes('ארוכה') || garmentText.includes('מקסי');
      const sleeveStyle = detectSleeveStyle({ garmentText, rawSlot: 'dress', aspect });
      const hasDressSleeves = autoHasSleeves && (garmentText.includes('sleeve') || garmentText.includes('שרוול') || sleeveStyle.factor > 0);

      // Dress bodice top overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.53 : 1.47) + yShift;
      let yBottom = (isMale ? 0.55 : 0.50) + yShift; // Default midi/knee
      if (isMini) yBottom = (isMale ? 0.78 : 0.74) + yShift;
      if (isMaxi) yBottom = (isMale ? 0.16 : 0.12) + yShift;

      return createAnatomicalDressGeometry({
        isMale,
        hasSleeves: hasDressSleeves && sleeveStyle.type !== 'sleeveless',
        sleeveFactor: sleeveStyle.factor,
        yTop,
        yBottom,
        layerOffset: 0.022 + rxShift,
        uSwatch: solidU,
        vSwatch: solidV,
      });
    }

    // 4. BOTTOM
    if (rawSlot === 'bottom') {
      const isSkirt = garmentText.includes('skirt') || garmentText.includes('חצאית');
      const isShorts = garmentText.includes('shorts') || garmentText.includes('ברמודה') || garmentText.includes('קצרים') || garmentText.includes('שורטס');
      const isMiniSkirt = isSkirt && (garmentText.includes('mini') || garmentText.includes('קצרה'));
      const isMaxiSkirt = isSkirt && (garmentText.includes('maxi') || garmentText.includes('ארוכה') || garmentText.includes('מקסי'));

      let yHem = (isMale ? 0.11 : 0.10) + yShift;
      if (isMiniSkirt) yHem = (isMale ? 0.76 : 0.72) + yShift;
      if (isMaxiSkirt) yHem = (isMale ? 0.16 : 0.12) + yShift;

      return createAnatomicalBottomGeometry({
        isMale,
        isSkirt,
        isShorts,
        yTop: (isMale ? 1.08 : 1.05) + yShift,
        yHem,
        layerOffset: 0.018 + rxShift,
        uSwatch: solidU,
        vSwatch: solidV,
      });
    }

    // 5. SHOES
    if (rawSlot === 'shoes') {
      return createFittedFootwearGeometry({
        isMale,
        spec: footwearSpec,
        layout: shoeLayout,
      });
    }

    // 6. ACCESSORIES
    return createAnatomicalAccessoryGeometry(rawSlot, { isMale });
  }, [visible, rawSlot, garmentText, isMale, hasOuterwear, autoHasSleeves, solidU, solidV, footwearSpec, shoeLayout]);

  const geometry = useMemo(() => {
    const morphed = applyAvatarMorphsToGeometry(baseGeometry, morphField, morphInfluences);
    // Footwear follows the heeled foot pose applied to the avatar
    return rawSlot === 'shoes' ? poseGeometry(morphed, footPose) : morphed;
  }, [baseGeometry, morphField, morphInfluences, rawSlot, footPose]);

  const heelGeometry = useMemo(
    () => (rawSlot === 'shoes' && visible ? createHeelGeometry({ isMale, spec: footwearSpec, pose: footPose }) : null),
    [rawSlot, visible, isMale, footwearSpec, footPose]
  );

  if (!visible || !garment || !geometry) return null;

  const renderOrder = rawSlot === 'outerwear' ? 12 : rawSlot === 'dress' ? 11 : rawSlot === 'top' ? 10 : 8;

  return (
    <>
    {heelGeometry && (
      <mesh geometry={heelGeometry} castShadow receiveShadow renderOrder={renderOrder}>
        <meshStandardMaterial color={dominantColor || '#1F1F22'} roughness={0.45} metalness={0.08} />
      </mesh>
    )}
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      renderOrder={renderOrder}
    >
      <meshStandardMaterial
        map={(rawSlot === 'shoes'
          ? opaqueTexture || texture
          : ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot)
            ? filledTexture || texture
            : texture) || null}
        color={texture ? '#FFFFFF' : dominantColor || '#CBD5E1'}
        transparent={rawSlot !== 'shoes'}
        alphaTest={rawSlot === 'shoes' ? 0 : 0.02}
        depthWrite={true}
        side={THREE.DoubleSide}
        roughness={0.65}
        metalness={0.04}
        envMapIntensity={0.8}
        polygonOffset={true}
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
    </>
  );
}
