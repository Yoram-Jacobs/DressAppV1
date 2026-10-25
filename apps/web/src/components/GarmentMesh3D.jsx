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
import {
  buildSilhouetteShell,
  chooseGridResolution,
  resampleAlphaMask,
  extractRowRuns,
  isConsistentView,
  classifyGroupView,
  extractSideProfile,
  synthesizeBackFabricData,
  resolveBottomLength,
} from '@/lib/garmentSilhouette';

// ─── Anatomical Profiles Extracted from Avatar 3D Meshes (Exact Metric Coordinates) ───

export const TORSO_PROFILE_FEMALE = [
  { y: 1.46, rx: 0.125, cz: 0.030, rz: 0.082, rzFront: 0.082, rzBack: 0.075 }, // High collar / neck base
  { y: 1.42, rx: 0.192, cz: 0.015, rz: 0.078, rzFront: 0.078, rzBack: 0.072 }, // Shoulder line / clavicle (zMin=-0.045, zMax=+0.067)
  { y: 1.36, rx: 0.215, cz: 0.020, rz: 0.098, rzFront: 0.098, rzBack: 0.090 }, // Upper chest / scapulae top (zMin=-0.063, zMax=+0.100)
  { y: 1.25, rx: 0.210, cz: 0.052, rz: 0.124, rzFront: 0.126, rzBack: 0.114 }, // Bust peak & scapulae (zMin=-0.057, zMax=+0.170)
  { y: 1.15, rx: 0.174, cz: 0.054, rz: 0.106, rzFront: 0.110, rzBack: 0.094 }, // Under-bust (zMin=-0.028, zMax=+0.155)
  { y: 1.05, rx: 0.142, cz: 0.048, rz: 0.104, rzFront: 0.108, rzBack: 0.096 }, // Natural waist (rx=0.142, zMin=-0.042, zMax=+0.147)
  { y: 0.95, rx: 0.176, cz: 0.024, rz: 0.126, rzFront: 0.126, rzBack: 0.128 }, // Upper hips / glutes (zMin=-0.101, zMax=+0.141)
  { y: 0.82, rx: 0.174, cz: 0.018, rz: 0.120, rzFront: 0.118, rzBack: 0.120 }, // Pelvis / crotch (zMin=-0.100, zMax=+0.121)
  { y: 0.65, rx: 0.205, cz: 0.032, rz: 0.112, rzFront: 0.110, rzBack: 0.105 }, // Upper thigh flare (skirts/dresses)
];

export const TORSO_PROFILE_MALE = [
  { y: 1.52, rx: 0.145, cz: 0.016, rz: 0.088, rzFront: 0.085, rzBack: 0.082 }, // High collar / neck base (zMin=-0.059, zMax=+0.092)
  { y: 1.48, rx: 0.220, cz: 0.008, rz: 0.098, rzFront: 0.096, rzBack: 0.096 }, // Shoulder line / clavicle (zMin=-0.083, zMax=+0.096)
  { y: 1.42, rx: 0.235, cz: 0.013, rz: 0.122, rzFront: 0.124, rzBack: 0.122 }, // Shoulders / upper chest (zMin=-0.110, zMax=+0.135)
  { y: 1.30, rx: 0.215, cz: 0.027, rz: 0.140, rzFront: 0.142, rzBack: 0.138 }, // Chest / pecs peak & scapulae (zMin=-0.113, zMax=+0.168)
  { y: 1.18, rx: 0.178, cz: 0.036, rz: 0.116, rzFront: 0.118, rzBack: 0.112 }, // Rib cage / lumbar taper (zMin=-0.066, zMax=+0.148)
  { y: 1.08, rx: 0.150, cz: 0.038, rz: 0.114, rzFront: 0.118, rzBack: 0.108 }, // Waist (rx=0.150, zMin=-0.062, zMax=+0.149)
  { y: 0.96, rx: 0.180, cz: 0.025, rz: 0.134, rzFront: 0.138, rzBack: 0.132 }, // Upper hips / glutes (zMin=-0.103, zMax=+0.153)
  { y: 0.86, rx: 0.182, cz: 0.020, rz: 0.130, rzFront: 0.132, rzBack: 0.124 }, // Pelvis / crotch (zMin=-0.096, zMax=+0.128)
  { y: 0.70, rx: 0.205, cz: 0.028, rz: 0.120, rzFront: 0.120, rzBack: 0.112 }, // Thigh flare
];

export const LEG_PROFILE_FEMALE = [
  { y: 0.82, cx: 0.100, r: 0.094, cz: 0.024, rzFront: 0.115, rzBack: 0.115 }, // Crotch / upper thigh (zMin=-0.080, zMax=+0.121)
  { y: 0.75, cx: 0.104, r: 0.090, cz: 0.034, rzFront: 0.105, rzBack: 0.098 }, // Upper-mid thigh (zMin=-0.057, zMax=+0.118)
  { y: 0.65, cx: 0.112, r: 0.082, cz: 0.040, rzFront: 0.092, rzBack: 0.088 }, // Mid thigh (zMin=-0.032, zMax=+0.115)
  { y: 0.50, cx: 0.128, r: 0.072, cz: 0.036, rzFront: 0.078, rzBack: 0.076 }, // Knee (zMin=-0.022, zMax=+0.100)
  { y: 0.40, cx: 0.138, r: 0.068, cz: 0.003, rzFront: 0.072, rzBack: 0.076 }, // Back of knee / upper calf (z reaches -0.055)
  { y: 0.30, cx: 0.145, r: 0.064, cz: 0.010, rzFront: 0.066, rzBack: 0.070 }, // Calf (z reaches -0.044)
  { y: 0.20, cx: 0.160, r: 0.052, cz: 0.020, rzFront: 0.052, rzBack: 0.054 }, // Lower calf
  { y: 0.10, cx: 0.165, r: 0.048, cz: 0.035, rzFront: 0.065, rzBack: 0.055 }, // Ankle
];

export const LEG_PROFILE_MALE = [
  { y: 0.86, cx: 0.102, r: 0.096, cz: 0.022, rzFront: 0.125, rzBack: 0.125 }, // Crotch (zMin=-0.096, zMax=+0.128)
  { y: 0.78, cx: 0.105, r: 0.094, cz: 0.032, rzFront: 0.116, rzBack: 0.105 }, // Upper thigh (zMin=-0.053, zMax=+0.128)
  { y: 0.70, cx: 0.108, r: 0.088, cz: 0.036, rzFront: 0.108, rzBack: 0.096 }, // Mid thigh (zMin=-0.046, zMax=+0.124)
  { y: 0.58, cx: 0.118, r: 0.080, cz: 0.022, rzFront: 0.095, rzBack: 0.090 }, // Lower thigh
  { y: 0.50, cx: 0.130, r: 0.076, cz: -0.003, rzFront: 0.085, rzBack: 0.095 }, // Knee (zMin=-0.074, zMax=+0.068)
  { y: 0.40, cx: 0.134, r: 0.072, cz: -0.020, rzFront: 0.075, rzBack: 0.088 }, // Back of knee / upper calf (zMin=-0.083)
  { y: 0.30, cx: 0.138, r: 0.068, cz: -0.024, rzFront: 0.068, rzBack: 0.076 }, // Calf (zMin=-0.074)
  { y: 0.20, cx: 0.146, r: 0.058, cz: -0.022, rzFront: 0.056, rzBack: 0.064 }, // Lower calf (zMin=-0.061)
  { y: 0.10, cx: 0.148, r: 0.054, cz: 0.002, rzFront: 0.068, rzBack: 0.068 }, // Ankle
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
 * Garment-type words in the item NAME ("... cargo pants", "wool overcoat") are far
 * more reliable than a mislabeled category field. Returns a core slot or null.
 */
export function inferRoleFromName(title) {
  const text = String(title || '').toLowerCase();
  if (!text) return null;
  if (/(?:\b(?:overcoat|trench|coat|jacket|blazer|cardigan|parka|windbreaker|bomber|overshirt)\b|מעיל|ז['’]קט|ג['’]קט|בלייזר|קרדיגן)/i.test(text)) return 'outerwear';
  if (/(?:\b(?:dress|gown|jumpsuit|romper|kaftan|caftan|abaya)\b|שמלה|שמלת|אוברול|סרבל)/i.test(text) && !/\bdress\s+(?:shirt|pants|trousers|shoes|socks)\b/i.test(text)) return 'dress';
  if (/(?:\b(?:pants|jeans|trousers|chinos?|cargo|shorts|skirt|leggings|joggers|slacks|sweatpants)\b|מכנס|ג['’]ינס|חצאית|שורטס|טייץ)/i.test(text)) return 'bottom';
  if (/(?:\b(?:t-?shirt|tee|shirt|blouse|sweater|hoodie|sweatshirt|pullover|polo|tank|camisole|jersey)\b|חולצ|סוודר|גופי)/i.test(text)) return 'top';
  return null;
}

/**
 * Normalizes multi-lingual category / role strings into canonical slots.
 * A clear garment type in the title overrides a contradicting top/bottom/outerwear/
 * dress category so pants never render as a top (and vice versa).
 */
export function normalizeGarmentRole(role, category, title) {
  const declared = normalizeDeclaredGarmentRole(role, category, title);
  const inferred = inferRoleFromName(title);
  const CORE = ['top', 'bottom', 'outerwear', 'dress'];
  if (inferred && inferred !== declared && CORE.includes(declared) && CORE.includes(inferred)) {
    return inferred;
  }
  return declared;
}

function normalizeDeclaredGarmentRole(role, category, title) {
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

/** Mean colour, silhouette area and texture busyness of a cut-out canvas. */
function computeCanvasStats(canvas) {
  const S = 48;
  const aspect = canvas.width / Math.max(1, canvas.height);
  const sw = aspect >= 1 ? S : Math.max(8, Math.round(S * aspect));
  const sh = aspect >= 1 ? Math.max(8, Math.round(S / aspect)) : S;
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(canvas, 0, 0, sw, sh);
  const d = cx.getImageData(0, 0, sw, sh).data;
  let r = 0, g = 0, b = 0, n = 0;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  }
  const mean = n ? [r / n, g / n, b / n] : [128, 128, 128];
  const meanLum = lum.length ? lum.reduce((a, v) => a + v, 0) / lum.length : 128;
  const variance = lum.length ? lum.reduce((a, v) => a + (v - meanLum) * (v - meanLum), 0) / lum.length : 0;
  return { mean, area: n / (sw * sh), aspect, stdev: Math.sqrt(variance) };
}

/**
 * Mirrors opaque garment pixels horizontally outward by `padDistance` pixels along each row.
 * Unlike nearest-neighbour smearing, mirror padding preserves the natural fabric grain, weave,
 * texture, and color variations seamlessly across the silhouette flank so side views never smear.
 */
function mirrorPadEdges(canvas, padDistance = 24) {
  try {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;

    for (let y = 0; y < H; y++) {
      const row = y * W;
      const spans = [];
      let inSpan = false;
      let spanStart = 0;
      for (let x = 0; x < W; x++) {
        const a = d[(row + x) * 4 + 3];
        if (a >= 120) {
          if (!inSpan) {
            inSpan = true;
            spanStart = x;
          }
        } else {
          if (inSpan) {
            spans.push([spanStart, x - 1]);
            inSpan = false;
          }
        }
      }
      if (inSpan) {
        spans.push([spanStart, W - 1]);
      }

      for (let s = 0; s < spans.length; s++) {
        const [a, b] = spans[s];
        const spanLen = b - a + 1;
        if (spanLen < 2) continue;

        // Mirror to the left into transparent margin
        const leftLimit = s === 0 ? 0 : Math.floor((spans[s - 1][1] + a) / 2) + 1;
        const padL = Math.min(padDistance, a - leftLimit);
        for (let k = 1; k <= padL; k++) {
          const targetX = a - k;
          const targetO = (row + targetX) * 4;
          if (d[targetO + 3] >= 200) continue;
          const srcX = Math.min(b, a + ((k - 1) % spanLen));
          const srcO = (row + srcX) * 4;
          d[targetO] = d[srcO];
          d[targetO + 1] = d[srcO + 1];
          d[targetO + 2] = d[srcO + 2];
          d[targetO + 3] = 255;
        }

        // Mirror to the right into transparent margin
        const rightLimit = s === spans.length - 1 ? W - 1 : Math.ceil((b + spans[s + 1][0]) / 2) - 1;
        const padR = Math.min(padDistance, rightLimit - b);
        for (let k = 1; k <= padR; k++) {
          const targetX = b + k;
          const targetO = (row + targetX) * 4;
          if (d[targetO + 3] >= 200) continue;
          const srcX = Math.max(a, b - ((k - 1) % spanLen));
          const srcO = (row + srcX) * 4;
          d[targetO] = d[srcO];
          d[targetO + 1] = d[srcO + 1];
          d[targetO + 2] = d[srcO + 2];
          d[targetO + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  } catch (err) {
    console.warn('mirrorPadEdges failed:', err);
  }
}

/**
 * Dilates opaque edge RGB+alpha outward by `passes` pixels and bridges narrow interior
 * scanline pinholes so boundary triangles of the 3D silhouette shell never clip or tear.
 */
function dilateCanvasEdges(canvas, passes = 6) {
  try {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;

    // 1. Solidify semi-opaque garment pixels and bridge tiny interior pinholes (<= 1.8% width)
    // Never bridge across separated pant legs or sleeve gaps!
    const maxGap = Math.max(2, Math.round(W * 0.018));
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let prevX = -1;
      for (let x = 0; x < W; x++) {
        const o = (row + x) * 4;
        if (d[o + 3] >= 80) {
          d[o + 3] = 255;
          if (prevX >= 0 && x - prevX > 1 && x - prevX - 1 <= maxGap) {
            const oL = (row + prevX) * 4;
            const span = x - prevX;
            for (let k = 1; k < span; k++) {
              const t = k / span;
              const oM = (row + prevX + k) * 4;
              d[oM] = Math.round(d[oL] * (1 - t) + d[o] * t);
              d[oM + 1] = Math.round(d[oL + 1] * (1 - t) + d[o + 1] * t);
              d[oM + 2] = Math.round(d[oL + 2] * (1 - t) + d[o + 2] * t);
              d[oM + 3] = 255;
            }
          }
          prevX = x;
        }
      }
    }

    // 1b. Bridge vertical gaps across interior rows in the upper half (e.g. horizontal cuts/creases across chest graphics <= 7% height)
    const maxVertGap = Math.max(4, Math.round(H * 0.07));
    const maxVertBridgeY = Math.round(H * 0.55);
    for (let x = 0; x < W; x++) {
      let prevY = -1;
      for (let y = 0; y < maxVertBridgeY; y++) {
        const o = (y * W + x) * 4;
        if (d[o + 3] >= 128) {
          if (prevY >= 0 && y - prevY > 1 && y - prevY - 1 <= maxVertGap) {
            const oTop = (prevY * W + x) * 4;
            const spanY = y - prevY;
            for (let k = 1; k < spanY; k++) {
              const t = k / spanY;
              const oM = ((prevY + k) * W + x) * 4;
              if (d[oM + 3] < 128) {
                d[oM] = Math.round(d[oTop] * (1 - t) + d[o] * t);
                d[oM + 1] = Math.round(d[oTop + 1] * (1 - t) + d[o + 1] * t);
                d[oM + 2] = Math.round(d[oTop + 2] * (1 - t) + d[o + 2] * t);
                d[oM + 3] = 255;
              }
            }
          }
          prevY = y;
        }
      }
    }

    // 2. Outward 4-neighbour RGB+alpha edge bleed
    for (let pass = 0; pass < passes; pass++) {
      const prev = new Uint8ClampedArray(d);
      for (let y = 0; y < H; y++) {
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const p = row + x;
          const o = p * 4;
          if (prev[o + 3] >= 200) continue;
          let r = 0, g = 0, b = 0, cnt = 0;
          if (x > 0 && prev[o - 1] >= 200) {
            r += prev[o - 4]; g += prev[o - 3]; b += prev[o - 2]; cnt++;
          }
          if (x < W - 1 && prev[o + 7] >= 200) {
            r += prev[o + 4]; g += prev[o + 5]; b += prev[o + 6]; cnt++;
          }
          if (y > 0 && prev[(p - W) * 4 + 3] >= 200) {
            const uo = (p - W) * 4;
            r += prev[uo]; g += prev[uo + 1]; b += prev[uo + 2]; cnt++;
          }
          if (y < H - 1 && prev[(p + W) * 4 + 3] >= 200) {
            const doff = (p + W) * 4;
            r += prev[doff]; g += prev[doff + 1]; b += prev[doff + 2]; cnt++;
          }
          if (cnt > 0) {
            d[o] = Math.round(r / cnt);
            d[o + 1] = Math.round(g / cnt);
            d[o + 2] = Math.round(b / cnt);
            d[o + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);
  } catch {
    // ignore canvas security/read errors in headless mocks
  }
}

/**
 * Synthesizes the clean back fabric canvas from the front garment canvas:
 *   - Preserves base fabric colors, lighting gradients, and repeating patterns
 *     (stripes, plaid, herringbone, houndstooth, knit weave).
 *   - Bridges over center closures (zipper tracks, zipper pulls, button plackets, drawstrings).
 *   - Excludes and inpaints asymmetric breast pockets, pocket flaps, and front logos.
 *   - Excludes and inpaints chest/torso graphic prints, slogans, decals, and artwork.
 *   - Restores authentic high-frequency fabric grain/weave so the back sheet looks
 *     like real woven cloth, not flat blur.
 */
export function synthesizeBackFabricCanvas(frontCanvas) {
  if (!frontCanvas || typeof document === 'undefined') return frontCanvas;
  try {
    const W = frontCanvas.width;
    const H = frontCanvas.height;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(frontCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, W, H);
    synthesizeBackFabricData(imgData.data, W, H);
    ctx.putImageData(imgData, 0, 0);
    return out;
  } catch {
    return frontCanvas;
  }
}

/**
 * Builds the texture for the BACK sheet of a garment, aligned to the front cut-out:
 *   1. Always uses the front garment canvas aligned 1:1 with uvBack === uvFront,
 *      excluding graphics, prints, pockets, zippers, and fine details while preserving
 *      the front garment's texture, colors, and pattern (stripes, plaid, herringbone).
 *   2. When a consistent back photo exists in the item group, lays the mirrored back
 *      photo on top of the silhouette.
 */
export function buildBackTexture({ frontCanvas, backCanvas }) {
  if (!frontCanvas || typeof document === 'undefined') return null;
  const W = frontCanvas.width;
  const H = frontCanvas.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d', { willReadFrequently: true });

  // Synthesize back fabric excluding front-only graphics, prints, pockets, zippers
  const cleanBackCanvas = synthesizeBackFabricCanvas(frontCanvas);
  ctx.drawImage(cleanBackCanvas, 0, 0);

  if (backCanvas) {
    // A back photo is seen from behind: mirror it and align its horizontal opaque spans
    // row-by-row onto the front silhouette so back seams/pockets/yoke match the 3D shell 1:1.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(backCanvas, 0, 0, W, H);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

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

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    return null;
  }
  // Cap the working resolution: keeps flood-fill / mask analysis fast and GPU memory small
  const MAX_SIDE = 1100;
  const downScale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * downScale));
  const h = Math.max(1, Math.round(srcH * downScale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    ctx.drawImage(img, 0, 0, w, h);
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
  let isLightBg = false;
  let bgR = 255, bgG = 255, bgB = 255;
  let bgMask = null;

  if (imgData) {
    const data = imgData.data;

    // Detect solid/white background from 4 image corners
    const cornerOffsets = [
      (2 * w + 2) * 4,
      (2 * w + (w - 3)) * 4,
      ((h - 3) * w + 2) * 4,
      ((h - 3) * w + (w - 3)) * 4,
    ];
    let crSum = 0, cgSum = 0, cbSum = 0, cCount = 0;
    for (const off of cornerOffsets) {
      if (off >= 0 && off < data.length - 4 && data[off + 3] > 40) {
        crSum += data[off];
        cgSum += data[off + 1];
        cbSum += data[off + 2];
        cCount++;
      }
    }
    if (cCount > 0) {
      bgR = crSum / cCount;
      bgG = cgSum / cCount;
      bgB = cbSum / cCount;
      isLightBg = bgR > 215 && bgG > 215 && bgB > 215;
    }

    // Background mask: fully transparent pixels are always background; near-white
    // catalog backdrop is only background when it is connected to the image border
    // (so white shirts / white sneakers keep their own white pixels).
    const isLightPixel = (o) => {
      const r = data[o], g = data[o + 1], b = data[o + 2];
      if (Math.hypot(r - bgR, g - bgG, b - bgB) < 42) return true;
      return r > 235 && g > 235 && b > 235;
    };
    bgMask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      // Treat semi-transparent cutout fringe / ghost shards (< 110 alpha) as background
      if (data[p * 4 + 3] < 110) bgMask[p] = 1;
    }
    if (isLightBg) {
      const stack = new Int32Array(w * h);
      let sp = 0;
      const push = (p) => {
        if (!bgMask[p] && isLightPixel(p * 4)) {
          bgMask[p] = 1;
          stack[sp++] = p;
        }
      };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + (w - 1)); }
      while (sp > 0) {
        const p = stack[--sp];
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) push(p - 1);
        if (x < w - 1) push(p + 1);
        if (y > 0) push(p - w);
        if (y < h - 1) push(p + w);
      }
    }

    // Connected-component island filter: remove detached cutout shards / floating background remnants
    // (any disconnected component smaller than 12% of the main garment component is marked as background).
    try {
      const visited = new Uint8Array(w * h);
      const compQueue = new Int32Array(w * h);
      const components = [];
      let maxCompSize = 0;

      for (let p = 0; p < w * h; p++) {
        if (bgMask[p] || visited[p]) continue;
        visited[p] = 1;
        let head = 0;
        let tail = 0;
        compQueue[tail++] = p;
        while (head < tail) {
          const curr = compQueue[head++];
          const cx = curr % w;
          const cy = (curr - cx) / w;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= w) continue;
              const np = ny * w + nx;
              if (!bgMask[np] && !visited[np]) {
                visited[np] = 1;
                compQueue[tail++] = np;
              }
            }
          }
        }
        if (tail > maxCompSize) maxCompSize = tail;
        components.push(compQueue.slice(0, tail));
      }

      if (components.length > 1 && maxCompSize > 0) {
        const minKeepSize = Math.max(24, Math.floor(maxCompSize * 0.12));
        for (let c = 0; c < components.length; c++) {
          const comp = components[c];
          if (comp.length < minKeepSize) {
            for (let k = 0; k < comp.length; k++) {
              bgMask[comp[k]] = 1;
            }
          }
        }
      }
    } catch {}

    // Strip residual low-saturation light-gray studio border fringes attached to non-gray garments
    try {
      let coreR = 0, coreG = 0, coreB = 0, coreCount = 0;
      const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
      for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8); y += step) {
        for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x += step) {
          const p = y * w + x;
          if (!bgMask[p] && data[p * 4 + 3] >= 200) {
            coreR += data[p * 4];
            coreG += data[p * 4 + 1];
            coreB += data[p * 4 + 2];
            coreCount++;
          }
        }
      }
      if (coreCount > 20) {
        coreR /= coreCount;
        coreG /= coreCount;
        coreB /= coreCount;
        const coreLum = 0.299 * coreR + 0.587 * coreG + 0.114 * coreB;
        const coreChroma = Math.max(coreR, coreG, coreB) - Math.min(coreR, coreG, coreB);
        // Only strip light-gray studio fringes if the core garment itself is not light gray/white
        if (coreLum < 155 || coreChroma > 24) {
          for (let pass = 0; pass < 3; pass++) {
            const toClear = [];
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const p = y * w + x;
                if (bgMask[p]) continue;
                const touchesBg =
                  x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
                  bgMask[p - 1] || bgMask[p + 1] || bgMask[p - w] || bgMask[p + w];
                if (!touchesBg) continue;
                const o = p * 4;
                const r = data[o], g = data[o + 1], b = data[o + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const chroma = Math.max(r, g, b) - Math.min(r, g, b);
                const distCore = Math.hypot(r - coreR, g - coreG, b - coreB);
                if (lum >= 158 && chroma <= 22 && distCore > 42) {
                  toClear.push(p);
                }
              }
            }
            if (!toClear.length) break;
            for (let k = 0; k < toClear.length; k++) bgMask[toClear[k]] = 1;
          }
        }
      }
    } catch {}

    let foundMinX = w, foundMaxX = 0, foundMinY = h, foundMaxY = 0;
    let sumR = 0, sumG = 0, sumB = 0, countDom = 0;

    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const off = row + x * 4;
        if (!bgMask[y * w + x]) {
          if (x < foundMinX) foundMinX = x;
          if (x > foundMaxX) foundMaxX = x;
          if (y < foundMinY) foundMinY = y;
          if (y > foundMaxY) foundMaxY = y;

          // Sample genuine fabric / shoe leather
          sumR += data[off];
          sumG += data[off + 1];
          sumB += data[off + 2];
          countDom++;
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

  // Remove background, detached cutout shards, and studio fringes from the crop (keeps interior whites intact)
  if (imgData && bgMask) {
    try {
      const cImgData = cropCtx.getImageData(0, 0, cropW, cropH);
      const cPx = cImgData.data;
      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          if (bgMask[(minY + cy) * w + (minX + cx)]) {
            cPx[(cy * cropW + cx) * 4 + 3] = 0; // Transparent
          }
        }
      }
      cropCtx.putImageData(cImgData, 0, 0);
    } catch {}
  }

  // Trim the 1-2px semi-transparent halo that cut-outs carry (white catalog fringe)
  try {
    const eImg = cropCtx.getImageData(0, 0, cropW, cropH);
    const eData = eImg.data;
    for (let pass = 0; pass < 2; pass++) {
      const kill = [];
      for (let y = 0; y < cropH; y++) {
        for (let x = 0; x < cropW; x++) {
          const p = y * cropW + x;
          if (eData[p * 4 + 3] === 0) continue;
          const left = x > 0 ? eData[(p - 1) * 4 + 3] : 255;
          const right = x < cropW - 1 ? eData[(p + 1) * 4 + 3] : 255;
          const up = y > 0 ? eData[(p - cropW) * 4 + 3] : 255;
          const down = y < cropH - 1 ? eData[(p + cropW) * 4 + 3] : 255;
          if (Math.min(left, right, up, down) < 96) kill.push(p);
        }
      }
      kill.forEach((p) => { eData[p * 4 + 3] = 0; });
    }
    cropCtx.putImageData(eImg, 0, 0);
  } catch {}

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

  // Gap-free variant for clothing shells:
  // Fills interior holes (armhole cutouts, inner wedges) with smooth dominant fabric color.
  // NO horizontal row-smear to eliminate barcode / zebra stripe distortion!
  let filledTexture = null;
  try {
    const fillData = cropCtx.getImageData(0, 0, cropW, cropH);
    const px = fillData.data;
    const hexColor = dominantColor.replace('#', '');
    const domR = parseInt(hexColor.substring(0, 2), 16) || 35;
    const domG = parseInt(hexColor.substring(2, 4), 16) || 35;
    const domB = parseInt(hexColor.substring(4, 6), 16) || 38;

    const ALPHA_ON = 120;
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
      if (left >= 0 && right > left) {
        // Interior holes between garment parts: fill with clean dominant fabric color
        for (let cx = left; cx <= right; cx++) {
          const o = row + cx * 4;
          if (px[o + 3] < ALPHA_ON) {
            px[o] = domR;
            px[o + 1] = domG;
            px[o + 2] = domB;
            px[o + 3] = 255;
          }
        }
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

  // Silhouette mask (grid resolution) + colour statistics for the silhouette shell builder:
  // Extract from the clean, un-padded cutout BEFORE edge padding so detached shards or
  // padded borders never bloat the 3D silhouette or trigger false leg splits.
  let shellMask = null;
  let canvasStats = null;
  try {
    const sData = cropCtx.getImageData(0, 0, cropW, cropH).data;
    const alpha = new Uint8Array(cropW * cropH);
    for (let p = 0; p < alpha.length; p++) alpha[p] = sData[p * 4 + 3];
    const { nx, ny } = chooseGridResolution(aspect);
    shellMask = {
      mask: resampleAlphaMask(alpha, cropW, cropH, nx, ny),
      runsByRow: extractRowRuns(alpha, cropW, cropH, nx, ny),
      nx,
      ny,
    };
    canvasStats = computeCanvasStats(cropCanvas);

    // Gently mirror-pad edge RGB outward by a few pixels AFTER mask extraction
    // so UV boundary vertices never sample transparent edge pixels.
    mirrorPadEdges(cropCanvas, 4);
    dilateCanvasEdges(cropCanvas, 2);
    texture.needsUpdate = true;
  } catch {
    shellMask = null;
  }

  // Back sheet texture: front garment canvas synthesized to exclude graphics, prints,
  // pockets, zippers, while preserving base fabric colors, lighting, and repeating patterns.
  let backTexture = null;
  try {
    backTexture = buildBackTexture({ frontCanvas: cropCanvas, backCanvas: null });
  } catch {
    backTexture = null;
  }

  const res = {
    texture,
    backTexture,
    opaqueTexture,
    filledTexture,
    dominantColor,
    hasSleeves,
    aspect,
    solidU,
    solidV,
    canvas: cropCanvas,
    shellMask,
    canvasStats,
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

function useGarmentTexture(url, extraUrls = [], patterned = false) {
  const [data, setData] = useState({
    texture: null,
    opaqueTexture: null,
    filledTexture: null,
    dominantColor: '#222226',
    hasSleeves: true,
    aspect: 1.0,
    solidU: 0.5,
    solidV: 0.5,
    backTexture: null,
    backSource: null,
    sideProfile: null,
    ready: false,
    bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
  });
  const extraKey = (extraUrls || []).filter(Boolean).join('|');

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
        solidU: 0.5,
        solidV: 0.5,
        backTexture: null,
        backSource: null,
        sideProfile: null,
        ready: false,
        bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
      });
      return undefined;
    }

    fetchAndCropTexture(url)
      .then(async (res) => {
        if (!mounted || !res) return;
        setData({
          ...res,
          backTexture: res.backTexture || res.texture,
          backSource: 'front-aligned',
          sideProfile: null,
          ready: true,
        });

        // ── Item group: inspect additional POV images for back and side views ──
        if (!res.canvas || !res.shellMask) return;
        let backCanvas = null;
        let sideProfile = null;
        const candidates = extraKey ? extraKey.split('|') : [];
        for (const u of candidates) {
          if (!u || u === url) continue;
          try {
            const other = await fetchAndCropTexture(u);
            if (!other?.canvas) continue;
            const viewRole = classifyGroupView(res.canvasStats, other.canvasStats, u);
            if (!backCanvas && (viewRole === 'back' || isConsistentView(res.canvasStats, other.canvasStats))) {
              backCanvas = other.canvas;
            } else if (!sideProfile && viewRole === 'side' && other.shellMask) {
              sideProfile = extractSideProfile(other.shellMask, other.aspect, res.aspect);
            }
          } catch {
            // ignore unusable view
          }
        }
        if (!mounted) return;
        const backTexture = buildBackTexture({
          frontCanvas: res.canvas,
          backCanvas,
        });
        setData((prev) => (prev.texture === res.texture
          ? {
              ...prev,
              backTexture,
              backSource: backCanvas ? 'photo' : 'front-aligned',
              sideProfile: sideProfile || prev.sideProfile,
            }
          : prev));
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
            backTexture: null,
            backSource: null,
            sideProfile: null,
            ready: true,
            bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1, hasSleeves: true },
          });
        });
      });

    return () => {
      mounted = false;
    };
  }, [url, extraKey, patterned]);

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
  standalone = false,
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

      // Continuous 360° UV projection: front and back views share the same texture and pattern
      // without side-flank UV jumps or tears.
      const uT = uLeft + ((Math.sin(theta) + 1) * 0.5) * (uRight - uLeft);
      uvs.push(Math.max(0.01, Math.min(0.99, uT)), Math.max(0.01, Math.min(0.99, vTex)));
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

  // 2. Left & Right Sleeves (tailored elliptical contours, natural drape in standalone mode)
  if (hasAnySleeve) {
    const sides = [-1, 1]; // Left (-X), Right (+X)
    const nySleeve = Math.max(4, Math.round(10 * Math.min(1.0, sleeveFactor * 1.5)));
    const nxSleeve = 14;

    const yArmStart = isMale ? 1.48 : 1.42;
    const fullYArmEnd = isMale ? 0.96 : 0.90;
    const yArmEnd = yArmStart - sleeveFactor * (yArmStart - fullYArmEnd);

    const xArmStart = isMale ? (standalone ? 0.210 : 0.225) : (standalone ? 0.185 : 0.195);
    const fullXArmEnd = isMale ? (standalone ? 0.225 : 0.280) : (standalone ? 0.200 : 0.255);
    const xArmEnd = xArmStart + sleeveFactor * (fullXArmEnd - xArmStart);

    const fullZArmEnd = standalone ? 0.025 : 0.040;
    const zArmEnd = 0.020 + sleeveFactor * (fullZArmEnd - 0.020);

    // Slim, tailored sleeve radii (eliminates barrel appearance)
    const rArmStart = (standalone ? 0.045 : 0.050) + Math.min(0.010, layerOffset * 0.3);
    const fullRArmEnd = (standalone ? 0.034 : 0.038) + Math.min(0.008, layerOffset * 0.2);
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
        const rx = rArm * 0.84; // Elliptical tailored cross-section
        const rz = rArm * 1.05;

        const vTex = 0.85 - t * (0.85 - vCuff);
        const uCenter = side === -1
          ? 0.20 - t * uCuffOffset
          : 0.80 + t * uCuffOffset;

        for (let j = 0; j <= nxSleeve; j++) {
          const uFrac = j / nxSleeve;
          const theta = -Math.PI + uFrac * 2 * Math.PI;
          const x = xArm + rx * Math.sin(theta);
          const y = yArm;
          const z = zArm + rz * Math.cos(theta);
          verts.push(x, y, z);

          const uArm = uCenter + Math.sin(theta) * 0.09 * Math.min(1.0, sleeveFactor);
          uvs.push(Math.max(0.01, Math.min(0.99, uArm)), Math.max(0.01, Math.min(0.99, vTex)));
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

      const uT = uLeft + ((Math.sin(theta) + 1) * 0.5) * (uRight - uLeft);
      uvs.push(Math.max(0.01, Math.min(0.99, uT)), Math.max(0.01, Math.min(0.99, vTex)));
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

          const uArm = uCenter + ((Math.sin(theta) + 1) * 0.5 - 0.5) * (0.14 * Math.min(1.0, sleeveFactor * 1.3));
          uvs.push(Math.max(0.01, Math.min(0.99, uArm)), Math.max(0.01, Math.min(0.99, vTex)));
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
    const ny = 18;
    const nx = 28;
    const waistSlice = getTorsoSlice(yTop, isMale);
    const rxWaist = (waistSlice ? waistSlice.rx : 0.212) + layerOffset;
    const rzWaist = (waistSlice ? ((waistSlice.rzFront || 0.118) + (waistSlice.rzBack || 0.065)) * 0.5 : 0.0915) + layerOffset;
    const cz = waistSlice ? waistSlice.cz : 0.046;

    for (let i = 0; i <= ny; i++) {
      const vNorm = i / ny;
      const y = yTop - vNorm * (yTop - yHem);

      // Smooth monotonic drape from waistband to hem (avoids hourglass waist indentation)
      const flareRatio = Math.pow(vNorm, 1.15);
      const rx = rxWaist + flareRatio * 0.18;
      const rz = rzWaist + flareRatio * 0.14;

      const vTex = 1.0 - vNorm;

      for (let j = 0; j <= nx; j++) {
        const uFrac = j / nx;
        const theta = -Math.PI + uFrac * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const isFront = Math.cos(theta) >= 0;
        const z = isFront
          ? cz + rz * Math.cos(theta)
          : cz - (rz + 0.010) * Math.abs(Math.cos(theta));
        verts.push(x, y, z);

        // Continuous 360° UV mapping so front and back views share the skirt texture & pattern
        const uT = 0.5 + Math.sin(theta) * 0.42;
        uvs.push(Math.max(0.01, Math.min(0.99, uT)), Math.max(0.01, Math.min(0.99, vTex)));
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
  // Continuous anatomical leg bifurcation from waistband down to hem.
  // Eliminates disjoint pelvis shelf, overhangs, and box-like hip artifacts.
  const yWaist = yTop;
  const yCrotch = isMale ? 0.86 : 0.82;
  const yAnkle = isShorts ? (isMale ? 0.58 : 0.54) : yHem;

  const nyLeg = 18;
  const nxLeg = 18;
  const legSides = [-1, 1]; // Left (-X), Right (+X)

  legSides.forEach((side) => {
    const startIdx = verts.length / 3;

    for (let i = 0; i <= nyLeg; i++) {
      const vNorm = i / nyLeg;
      const y = yWaist - vNorm * (yWaist - yAnkle);
      const isAboveCrotch = y >= yCrotch;

      let cx, cz, rx, rz;
      if (isAboveCrotch) {
        // Upper Pelvis & Waistband: smoothly contours along the hip silhouette
        const tPelvis = (y - yCrotch) / Math.max(0.01, yWaist - yCrotch); // 0 at crotch, 1 at waist
        const sliceTorso = getTorsoSlice(y, isMale);
        const sliceLegCrotch = getLegSlice(yCrotch, isMale);

        const hipRx = sliceTorso.rx + layerOffset;
        const hipRz = sliceTorso.rz + layerOffset;
        const crotchR = sliceLegCrotch.r + layerOffset;

        const centerCrotch = side * sliceLegCrotch.cx;
        const centerWaist = side * (hipRx * 0.48);
        cx = centerCrotch * (1 - tPelvis) + centerWaist * tPelvis;
        rx = Math.abs(side * hipRx - cx);
        rz = crotchR * (1 - tPelvis) + hipRz * tPelvis;
        cz = sliceLegCrotch.cz * (1 - tPelvis) + sliceTorso.cz * tPelvis;
      } else {
        // Below Crotch: natural anatomical leg profile down to hem
        const slice = getLegSlice(y, isMale);
        cx = side * slice.cx;
        cz = slice.cz;
        rx = slice.r + layerOffset;
        rz = rx;
      }

      // vTex runs from 0.98 (waistband) down to 0.02 (hem)
      const vTex = 0.98 - vNorm * 0.94;

      for (let j = 0; j <= nxLeg; j++) {
        const uFrac = j / nxLeg;
        const theta = -Math.PI + uFrac * 2 * Math.PI;

        const isFront = Math.cos(theta) >= 0;
        const x = cx + rx * Math.sin(theta);
        const z = isFront
          ? cz + rz * Math.cos(theta)
          : cz - (rz + 0.008) * Math.abs(Math.cos(theta));
        verts.push(x, y, z);

        const legCenter = side === -1 ? 0.30 : 0.70;
        const legSpan = 0.18;
        const uLeg = legCenter + Math.sin(theta) * (side === -1 ? legSpan : -legSpan);
        uvs.push(
          Math.max(0.02, Math.min(0.98, uLeg)),
          Math.max(0.02, Math.min(0.98, vTex))
        );
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
 * Vertical placement + clearance of a garment shell for each clothing slot,
 * expressed in the avatar's base (un-morphed) metric space.
 */
export function resolveShellFit({
  rawSlot,
  garmentText = '',
  isMale = false,
  hasOuterwear = false,
  garment = null,
  aspect = 0.55,
} = {}) {
  const has = (...words) => words.some((w) => garmentText.includes(w));
  const isStrapless = has('strapless', 'tube', 'bandeau', 'סטרפלס', 'בנדו', 'sans bretelles', 'trägerlos', 'palabra de honor');
  if (rawSlot === 'top') {
    const isCrop = has('crop', 'sports_bra', 'bralette', 'קרופ', 'חזיה');
    const isLongline = has('kurta', 'tunic', 'longline', 'thobe', 'טוניקה');
    let yBottom = isMale ? 0.90 : 0.86;
    if (isCrop) yBottom = isMale ? 1.18 : 1.12;
    if (isLongline) yBottom = isMale ? 0.75 : 0.70;
    const yTop = isStrapless ? (isMale ? 1.34 : 1.30) : (isMale ? 1.52 : 1.44);
    return { yTop, yBottom, layerOffset: hasOuterwear ? 0.016 : 0.022, isSkirt: false, isStrapless };
  }
  if (rawSlot === 'outerwear') {
    const isLong = has('overcoat', 'trench', 'duster', 'מעיל ארוך', 'cardigan', 'קרדיגן', 'coat', 'parka', 'robe');
    const isCrop = has('bolero', 'shrug', 'עליונית קצרה') || (has('jacket') && has('crop'));
    let yBottom = isMale ? 0.88 : 0.84;
    if (isLong) yBottom = isMale ? 0.52 : 0.48;
    if (isCrop) yBottom = isMale ? 1.15 : 1.10;
    return { yTop: isMale ? 1.53 : 1.45, yBottom, layerOffset: isMale ? 0.036 : 0.032, isSkirt: false, isStrapless: false };
  }
  if (rawSlot === 'dress') {
    const isMini = has('mini', 'קצרה');
    const isMaxi = has('maxi', 'gown', 'evening', 'ארוכה', 'מקסי', 'kaftan', 'caftan', 'robe', 'abaya');
    let yBottom = isMale ? 0.55 : 0.50;
    if (isMini) yBottom = isMale ? 0.78 : 0.74;
    if (isMaxi) yBottom = isMale ? 0.16 : 0.12;
    const yTop = isStrapless ? (isMale ? 1.34 : 1.30) : (isMale ? 1.52 : 1.44);
    return { yTop, yBottom, layerOffset: 0.022, isSkirt: false, isStrapless };
  }
  if (rawSlot === 'bottom') {
    const isSkirt = has('skirt', 'חצאית');
    const { lengthType, yBottom } = resolveBottomLength({
      garment,
      garmentText,
      aspect,
      isMale,
      isSkirt,
    });
    return {
      yTop: isMale ? 1.08 : 1.05,
      yBottom,
      layerOffset: 0.018,
      isSkirt,
      isStrapless: false,
      lengthType,
    };
  }
  return null;
}

/**
 * GarmentMesh3D
 *
 * Renders an active outfit piece in the 3D Try-On Dressing Room. Clothing keeps the
 * silhouette of its own photo (sleeves, pant legs, hem) as a front/back shell that is
 * inflated to the avatar's body profile; item-group back views supply the back sheet.
 * Footwear and accessories use dedicated fitted geometry.
 */
export default function GarmentMesh3D({
  garment,
  slot,
  isMale = false,
  visible = true,
  hasOuterwear = false,
  morphInfluences = null,
  footPose = null,
  showAvatar = true,
  standaloneMode = false,
}) {
  const isStandalone = Boolean(!showAvatar);
  const patternLabel = String(garment?.pattern || garment?.rawItem?.pattern || '').toLowerCase().trim();
  const isPatterned = Boolean(patternLabel) && !/^(solid|plain|—|-|none|חלק|אחיד)$/i.test(patternLabel);
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
    shellMask = null,
    backTexture = null,
    sideProfile = null,
    ready: textureReady = false,
  } = useGarmentTexture(garment?.url, garment?.extraViews, isPatterned);

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
        hasSleeves: sleeveStyle.type !== 'sleeveless',
        sleeveFactor: sleeveStyle.factor,
        yTop,
        yBottom,
        layerOffset,
        uSwatch: solidU,
        vSwatch: solidV,
        standalone: isStandalone,
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
        standalone: isStandalone,
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
      else if (isMaxiSkirt) yHem = (isMale ? 0.16 : 0.12) + yShift;
      else if (isSkirt) yHem = (isMale ? 0.48 : 0.44) + yShift;

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
    const morphed = isStandalone
      ? baseGeometry
      : applyAvatarMorphsToGeometry(baseGeometry, morphField, morphInfluences);
    // Footwear follows the heeled foot pose applied to the avatar
    return rawSlot === 'shoes' ? poseGeometry(morphed, footPose) : morphed;
  }, [baseGeometry, morphField, morphInfluences, rawSlot, footPose, isStandalone]);

  // ── Silhouette shell: the garment keeps its own photographed outline ──
  const shellFit = useMemo(
    () => resolveShellFit({ rawSlot, garmentText, isMale, hasOuterwear, garment, aspect }),
    [rawSlot, garmentText, isMale, hasOuterwear, garment, aspect]
  );
  const shell = useMemo(() => {
    if (!visible || !shellFit || !shellMask) return null;
    try {
      const built = buildSilhouetteShell({
        runsByRow: shellMask.runsByRow,
        mask: shellMask.mask,
        nx: shellMask.nx,
        ny: shellMask.ny,
        aspect,
        slot: rawSlot,
        isMale,
        isSkirt: shellFit.isSkirt,
        isStrapless: Boolean(shellFit.isStrapless),
        isStandalone,
        yTop: shellFit.yTop,
        yBottom: shellFit.yBottom,
        layerOffset: shellFit.layerOffset,
        poseSleeves: !isStandalone,
        sideProfile,
        getTorsoSlice,
        getLegSlice,
      });
      return built.ok ? built : null;
    } catch (err) {
      console.warn('Silhouette shell unavailable, using procedural fallback:', err);
      return null;
    }
  }, [visible, shellFit, shellMask, aspect, rawSlot, isMale, isStandalone, sideProfile]);
  const shellGeos = useMemo(() => {
    if (!shell) return null;
    if (isStandalone) {
      return { front: shell.front, back: shell.back };
    }
    return {
      front: applyAvatarMorphsToGeometry(shell.front, morphField, morphInfluences),
      back: applyAvatarMorphsToGeometry(shell.back, morphField, morphInfluences),
    };
  }, [shell, morphField, morphInfluences, isStandalone]);

  const heelGeometry = useMemo(
    () => (rawSlot === 'shoes' && visible ? createHeelGeometry({ isMale, spec: footwearSpec, pose: footPose }) : null),
    [rawSlot, visible, isMale, footwearSpec, footPose]
  );

  if (!visible || !garment) return null;

  const isCoreClothing = ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot);
  // Never flash an untextured (white) body-shaped placeholder while the photo loads
  if (isCoreClothing && !textureReady) return null;

  const renderOrder = rawSlot === 'outerwear' ? 12 : rawSlot === 'dress' ? 11 : rawSlot === 'top' ? 10 : 8;

  if (shellGeos && texture) {
    const shellMaterialProps = {
      color: '#FFFFFF',
      alphaTest: 0.15,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.7,
      alphaToCoverage: false,
    };
    return (
      <>
        <mesh name="garment-front-sheet" geometry={shellGeos.front} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial map={texture} {...shellMaterialProps} />
        </mesh>
        <mesh name="garment-back-sheet" geometry={shellGeos.back} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial map={backTexture || texture} {...shellMaterialProps} />
        </mesh>
      </>
    );
  }

  if (!geometry) return null;

  return (
    <>
    {heelGeometry && (
      <mesh geometry={heelGeometry} castShadow receiveShadow renderOrder={renderOrder}>
        <meshStandardMaterial
          color={dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#18181B'}
          roughness={0.35}
          metalness={0.12}
        />
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
          ? (opaqueTexture || texture)
          : ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot)
            ? (filledTexture || texture)
            : texture) || null}
        color={rawSlot === 'shoes'
          ? (dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#18181B')
          : (texture ? '#FFFFFF' : dominantColor || '#CBD5E1')}
        transparent={!['top', 'outerwear', 'dress', 'bottom', 'shoes'].includes(rawSlot)}
        alphaTest={['top', 'outerwear', 'dress', 'bottom', 'shoes'].includes(rawSlot) ? 0 : 0.02}
        depthWrite={true}
        side={THREE.DoubleSide}
        roughness={rawSlot === 'shoes' ? 0.38 : 0.65}
        metalness={rawSlot === 'shoes' ? 0.10 : 0.04}
        envMapIntensity={rawSlot === 'shoes' ? 1.2 : 0.8}
        polygonOffset={true}
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
    </>
  );
}
