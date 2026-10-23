import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { buildAvatarMorphField, applyAvatarMorphsToGeometry } from '@/lib/avatarMorphField';
import { MALE_GLB_URL, FEMALE_GLB_URL } from './AvatarMesh3D';

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

  const res = {
    texture,
    dominantColor,
    hasSleeves,
    aspect,
    solidU,
    solidV,
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
    dominantColor: '#222226',
    hasSleeves: true,
    solidU: 0.5,
    solidV: 0.5,
    bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
  });

  useEffect(() => {
    let mounted = true;
    if (!url) {
      setData({
        texture: null,
        dominantColor: '#222226',
        hasSleeves: true,
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
            dominantColor: '#222226',
            hasSleeves: true,
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

// ─── 3D Parametric Body-Wrapping Geometry Builders ───

/**
 * Creates 3D Top or Outerwear geometry with anatomically contoured torso shell
 * wrapping seamlessly 360° around the avatar's body AND left/right sleeve shells.
 */
export function createAnatomicalTopGeometry({
  isMale = false,
  hasSleeves = true,
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
      uLeft = hasSleeves ? 0.20 : 0.05;
      uRight = hasSleeves ? 0.80 : 0.95;
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

  // 2. Left & Right Sleeves (following avatar's A-pose arm trajectory in 3D seamlessly from shoulder cap)
  if (hasSleeves) {
    const sides = [-1, 1]; // Left (-X), Right (+X)
    const nySleeve = 10;
    const nxSleeve = 14;

    const yArmStart = isMale ? 1.48 : 1.42;
    const yArmEnd = isMale ? 0.96 : 0.90;
    const xArmStart = isMale ? 0.225 : 0.195;
    const xArmEnd = isMale ? 0.280 : 0.255;

    sides.forEach((side) => {
      const startIdx = verts.length / 3;

      for (let i = 0; i <= nySleeve; i++) {
        const t = i / nySleeve;
        const yArm = yArmStart - t * (yArmStart - yArmEnd);
        const xArm = side * (xArmStart + t * (xArmEnd - xArmStart));
        const zArm = 0.020 + t * (0.040 - 0.020);
        const rArm = (0.060 - t * (0.060 - 0.042)) + layerOffset;

        // Sleeve UV runs from shoulder seam (0.85) down to cuff (0.15)
        const vTex = 0.85 - t * (0.85 - 0.15);
        const uCenter = side === -1
          ? 0.23 - t * (0.23 - 0.08)
          : 0.77 + t * (0.92 - 0.77);

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rArm * Math.sin(theta);
          const y = yArm;
          const z = zArm + rArm * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          if (isFront) {
            const uArm = uCenter + ((Math.sin(theta) + 1) * 0.5 - 0.5) * 0.14;
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
  if (hasSleeves) {
    const sides = [-1, 1];
    const nySleeve = 10;
    const nxSleeve = 12;

    const yArmStart = isMale ? 1.48 : 1.42;
    const yArmEnd = isMale ? 0.96 : 0.90;
    const xArmStart = isMale ? 0.225 : 0.195;
    const xArmEnd = isMale ? 0.280 : 0.255;

    sides.forEach((side) => {
      const startIdx = verts.length / 3;

      for (let i = 0; i <= nySleeve; i++) {
        const t = i / nySleeve;
        const yArm = yArmStart - t * (yArmStart - yArmEnd);
        const xArm = side * (xArmStart + t * (xArmEnd - xArmStart));
        const zArm = 0.020 + t * (0.040 - 0.020);
        const rArm = (0.060 - t * (0.060 - 0.042)) + layerOffset;
        const vTex = 0.85 - t * (0.85 - 0.20);
        const uCenter = side === -1
          ? 0.23 - t * (0.23 - 0.08)
          : 0.77 + t * (0.92 - 0.77);

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rArm * Math.sin(theta);
          const y = yArm;
          const z = zArm + rArm * Math.cos(theta);
          verts.push(x, y, z);

          const isFront = Math.cos(theta) >= 0;
          if (isFront) {
            const uArm = uCenter + ((Math.sin(theta) + 1) * 0.5 - 0.5) * 0.14;
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
// ─── OpenTryOn True 3D Volumetric Mesh Component ───
function True3DGarmentMesh({ modelUrl, visible = true, renderOrder = 10 }) {
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material = node.material.clone();
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  if (!visible || !clonedScene) return null;

  return <primitive object={clonedScene} renderOrder={renderOrder} />;
}

export default function GarmentMesh3D({
  garment,
  slot,
  isMale = false,
  visible = true,
  hasOuterwear = false,
  morphInfluences = null,
}) {
  const {
    texture,
    dominantColor,
    hasSleeves: autoHasSleeves,
    solidU = 0.5,
    solidV = 0.5,
  } = useGarmentTexture(garment?.url);

  const rawSlot = normalizeGarmentRole(
    slot || garment?.slot,
    garment?.category,
    garment?.name || garment?.title || garment?.sub_category || garment?.item_type
  );
  const garmentText = `${garment?.sub_category || ''} ${garment?.item_type || ''} ${garment?.name || ''} ${garment?.category || ''}`.toLowerCase();

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
      const isSleeveless = garmentText.includes('sleeveless') || garmentText.includes('tank') || garmentText.includes('vest') || garmentText.includes('גופיה') || garmentText.includes('גופייה') || garmentText.includes('וסט') || !autoHasSleeves;

      // High collar at 1.47 (F) / 1.53 (M), shoulder seam overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.53 : 1.47) + yShift;
      let yBottom = (isMale ? 0.90 : 0.86) + yShift;
      if (isCrop) yBottom = (isMale ? 1.18 : 1.12) + yShift;
      if (isLongline) yBottom = (isMale ? 0.75 : 0.70) + yShift;

      const layerOffset = (hasOuterwear ? 0.016 : 0.022) + rxShift;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: !isSleeveless,
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
      const isSleeveless = garmentText.includes('vest') || garmentText.includes('waistcoat') || garmentText.includes('וסט') || !autoHasSleeves;

      // Outerwear collar stands at 1.48 (F) / 1.54 (M), shoulder line overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.54 : 1.48) + yShift;
      let yBottom = (isMale ? 0.88 : 0.84) + yShift;
      if (isLongCoat) yBottom = (isMale ? 0.52 : 0.48) + yShift;
      if (isCropJacket) yBottom = (isMale ? 1.15 : 1.10) + yShift;

      // Layered cleanly outside tops with generous clearance
      const layerOffset = (isMale ? 0.038 : 0.034) + rxShift;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: !isSleeveless,
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
      const hasSleeves = autoHasSleeves && (garmentText.includes('long sleeve') || garmentText.includes('sleeve') || garmentText.includes('שרוול'));

      // Dress bodice top overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.53 : 1.47) + yShift;
      let yBottom = (isMale ? 0.55 : 0.50) + yShift; // Default midi/knee
      if (isMini) yBottom = (isMale ? 0.78 : 0.74) + yShift;
      if (isMaxi) yBottom = (isMale ? 0.16 : 0.12) + yShift;

      return createAnatomicalDressGeometry({
        isMale,
        hasSleeves,
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
      return createAnatomicalFootwearGeometry({
        isMale,
        yTop: (isMale ? 0.098 : 0.095) + yShift * 0.1,
        ySole: -0.006,
        layerOffset: 0.010,
      });
    }

    // 6. ACCESSORIES
    return createAnatomicalAccessoryGeometry(rawSlot, { isMale });
  }, [visible, rawSlot, garmentText, isMale, hasOuterwear, autoHasSleeves, solidU, solidV]);

  const geometry = useMemo(
    () => applyAvatarMorphsToGeometry(baseGeometry, morphField, morphInfluences),
    [baseGeometry, morphField, morphInfluences]
  );

  const model3dUrl = garment?.model_3d_url || garment?.glb_url || garment?.mesh_3d;
  if (model3dUrl && visible) {
    const renderOrder = rawSlot === 'outerwear' ? 12 : rawSlot === 'dress' ? 11 : rawSlot === 'top' ? 10 : 8;
    return <True3DGarmentMesh modelUrl={model3dUrl} visible={visible} renderOrder={renderOrder} />;
  }

  if (!visible || !garment || !geometry) return null;

  const renderOrder = rawSlot === 'outerwear' ? 12 : rawSlot === 'dress' ? 11 : rawSlot === 'top' ? 10 : 8;

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      renderOrder={renderOrder}
    >
      <meshStandardMaterial
        map={texture || null}
        color={texture ? '#FFFFFF' : dominantColor || '#CBD5E1'}
        transparent={true}
        alphaTest={0.02}
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
  );
}
