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
  { y: 1.05, rx: 0.142, cz: 0.052, rz: 0.095, rzFront: 0.095, rzBack: 0.095 }, // Natural waist (rx=0.142, zMin=-0.042, zMax=+0.147)
  { y: 0.95, rx: 0.168, cz: 0.019, rz: 0.120, rzFront: 0.120, rzBack: 0.120 }, // Upper hips / glutes (zMin=-0.101, zMax=+0.139)
  { y: 0.82, rx: 0.186, cz: 0.014, rz: 0.114, rzFront: 0.114, rzBack: 0.114 }, // Pelvis / crotch (zMin=-0.100, zMax=+0.118)
  { y: 0.65, rx: 0.183, cz: 0.032, rz: 0.105, rzFront: 0.105, rzBack: 0.100 }, // Upper thigh flare (skirts/dresses)
];

export const TORSO_PROFILE_MALE = [
  { y: 1.52, rx: 0.145, cz: 0.016, rz: 0.088, rzFront: 0.085, rzBack: 0.082 }, // High collar / neck base (zMin=-0.059, zMax=+0.092)
  { y: 1.48, rx: 0.220, cz: 0.008, rz: 0.098, rzFront: 0.096, rzBack: 0.096 }, // Shoulder line / clavicle (zMin=-0.083, zMax=+0.096)
  { y: 1.42, rx: 0.235, cz: 0.013, rz: 0.122, rzFront: 0.124, rzBack: 0.122 }, // Shoulders / upper chest (zMin=-0.110, zMax=+0.135)
  { y: 1.30, rx: 0.215, cz: 0.027, rz: 0.140, rzFront: 0.142, rzBack: 0.138 }, // Chest / pecs peak & scapulae (zMin=-0.113, zMax=+0.168)
  { y: 1.18, rx: 0.178, cz: 0.036, rz: 0.116, rzFront: 0.118, rzBack: 0.112 }, // Rib cage / lumbar taper (zMin=-0.066, zMax=+0.148)
  { y: 1.08, rx: 0.148, cz: 0.044, rz: 0.106, rzFront: 0.106, rzBack: 0.106 }, // Waist (rx=0.148, zMin=-0.062, zMax=+0.149)
  { y: 0.96, rx: 0.172, cz: 0.025, rz: 0.128, rzFront: 0.128, rzBack: 0.128 }, // Upper hips / glutes (zMin=-0.103, zMax=+0.153)
  { y: 0.86, rx: 0.184, cz: 0.018, rz: 0.116, rzFront: 0.116, rzBack: 0.116 }, // Pelvis / crotch (zMin=-0.088, zMax=+0.123)
  { y: 0.70, rx: 0.188, cz: 0.028, rz: 0.110, rzFront: 0.110, rzBack: 0.106 }, // Thigh flare
];

export const LEG_PROFILE_FEMALE = [
  { y: 0.82, cx: 0.094, r: 0.092, cz: 0.016, rzFront: 0.102, rzBack: 0.100 }, // Crotch / upper thigh (xmin=0.002, xmax=0.186)
  { y: 0.75, cx: 0.101, r: 0.087, cz: 0.032, rzFront: 0.086, rzBack: 0.086 }, // Upper-mid thigh (xmin=0.014, xmax=0.188)
  { y: 0.65, cx: 0.115, r: 0.068, cz: 0.040, rzFront: 0.074, rzBack: 0.074 }, // Mid thigh (xmin=0.047, xmax=0.183)
  { y: 0.50, cx: 0.129, r: 0.058, cz: 0.036, rzFront: 0.062, rzBack: 0.062 }, // Knee (xmin=0.071, xmax=0.187)
  { y: 0.40, cx: 0.148, r: 0.060, cz: 0.003, rzFront: 0.059, rzBack: 0.059 }, // Back of knee / upper calf (xmin=0.088, xmax=0.208)
  { y: 0.30, cx: 0.155, r: 0.053, cz: 0.010, rzFront: 0.054, rzBack: 0.054 }, // Calf (xmin=0.102, xmax=0.208)
  { y: 0.20, cx: 0.166, r: 0.033, cz: 0.021, rzFront: 0.038, rzBack: 0.038 }, // Lower calf (xmin=0.133, xmax=0.199)
  { y: 0.10, cx: 0.167, r: 0.028, cz: 0.035, rzFront: 0.042, rzBack: 0.042 }, // Ankle (xmin=0.139, xmax=0.195)
];

export const LEG_PROFILE_MALE = [
  { y: 0.86, cx: 0.094, r: 0.090, cz: 0.018, rzFront: 0.114, rzBack: 0.112 }, // Crotch (xmin=0.004, xmax=0.184)
  { y: 0.78, cx: 0.098, r: 0.090, cz: 0.036, rzFront: 0.092, rzBack: 0.092 }, // Upper thigh (xmin=0.008, xmax=0.188)
  { y: 0.70, cx: 0.105, r: 0.082, cz: 0.040, rzFront: 0.086, rzBack: 0.086 }, // Mid thigh (xmin=0.023, xmax=0.187)
  { y: 0.58, cx: 0.115, r: 0.061, cz: 0.029, rzFront: 0.073, rzBack: 0.073 }, // Lower thigh (xmin=0.054, xmax=0.176)
  { y: 0.50, cx: 0.133, r: 0.058, cz: 0.000, rzFront: 0.072, rzBack: 0.072 }, // Knee (xmin=0.075, xmax=0.191)
  { y: 0.40, cx: 0.142, r: 0.066, cz: -0.022, rzFront: 0.062, rzBack: 0.062 }, // Back of knee / upper calf (xmin=0.076, xmax=0.208)
  { y: 0.30, cx: 0.144, r: 0.059, cz: -0.025, rzFront: 0.052, rzBack: 0.052 }, // Calf (xmin=0.085, xmax=0.203)
  { y: 0.20, cx: 0.149, r: 0.036, cz: -0.023, rzFront: 0.039, rzBack: 0.039 }, // Lower calf (xmin=0.113, xmax=0.185)
  { y: 0.10, cx: 0.144, r: 0.034, cz: -0.004, rzFront: 0.050, rzBack: 0.050 }, // Ankle (xmin=0.110, xmax=0.178)
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
  if (/(?:\b(?:wristwatch|smartwatch|watch|timepiece|bracelet|bangle)\b|שעון יד|שעון|צמיד)/i.test(text)) return 'watch';
  if (/(?:\b(?:necktie|bow\s*tie|bowtie|cravat|necklace|pendant|choker)\b|\btie\b(?!\s*(?:dye|front|waist|belt|up|shoe))|עניבה|עניבת|פפיון|שרשרת)/i.test(text)) return 'necktie';
  if (/(?:\b(?:belt)\b|חגורה|חגורת)/i.test(text) && !/\bbelt\s*(?:bag|loop)\b/i.test(text)) return 'belt';
  if (/(?:\b(?:overcoat|trench|coat|jacket|blazer|cardigan|parka|windbreaker|bomber|overshirt)\b|מעיל|ז['’]קט|ג['’]קט|בלייזר|קרדיגן)/i.test(text)) return 'outerwear';
  if (/(?:\b(?:dress|gown|jumpsuit|romper|kaftan|caftan|abaya)\b|שמלה|שמלת|אוברול|סרבל)/i.test(text) && !/\bdress\s+(?:shirt|pants|trousers|shoes|socks|watch)\b/i.test(text)) return 'dress';
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
  const CORE = ['top', 'bottom', 'outerwear', 'dress', 'necktie', 'watch', 'belt'];
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
  if (r === 'watch' || r === 'wristwatch') return 'watch';
  if (r === 'necktie' || r === 'tie' || r === 'necklace' || r === 'scarf') return 'necktie';
  if (r === 'headwear' || r === 'hat') return 'headwear';
  if (r === 'glasses') return 'glasses';
  if (r === 'belt') return 'belt';
  if (r === 'bag') return 'bag';

  // 1b. Specific Accessories (Wristwatch, Necktie, Belt) checked before general tops/outerwear
  if (/(?:\b(?:wristwatch|smartwatch|watch|timepiece|bracelet|bangle)\b|שעון יד|שעון|צמיד|ساعة|montre|uhr|reloj|orologio|часы|手表|腕表|腕時計)/i.test(text)) {
    return 'watch';
  }
  if (/(?:\b(?:necktie|bow\s*tie|bowtie|cravat|necklace|pendant|choker|neck\s*scarf)\b|\btie\b(?!\s*(?:dye|front|waist|belt|up|shoe))|עניבה|עניבת|פפיון|שרשרת|ربطة عنق|قلادة|cravate|collier|krawatte|halskette|corbata|collar|cravatta|collana|галстук|ожерелье|领带|项链|ネクタイ|ネックレス)/i.test(text)) {
    return 'necktie';
  }
  if (/(?:\bbelt\b|חגורה|חגורות|חגור|حزام|cinturón|cinturon|ceinture|gürtel|guertel|cintura|cinto|пояс|ремень|腰带|皮带|ベルト|riem|बेल्ट)/i.test(text) && !/\b(?:trench|coat|jacket|dress|pants|trousers|bag)\b/i.test(text)) {
    return 'belt';
  }

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

// Bounded LRU cache (capped at 16 textures) with automatic VRAM disposal
const MAX_TEXTURE_CACHE_ENTRIES = 16;
const textureCache = new Map();

function setTextureCache(key, entry) {
  if (textureCache.has(key)) {
    textureCache.delete(key);
  } else if (textureCache.size >= MAX_TEXTURE_CACHE_ENTRIES) {
    const oldestKey = textureCache.keys().next().value;
    const oldEntry = textureCache.get(oldestKey);
    if (oldEntry) {
      oldEntry.texture?.dispose?.();
      oldEntry.opaqueTexture?.dispose?.();
      oldEntry.filledTexture?.dispose?.();
      oldEntry.backTexture?.dispose?.();
    }
    textureCache.delete(oldestKey);
  }
  textureCache.set(key, entry);
}

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
    // When a verified back photograph is available from the item group, project it onto
    // the back silhouette in original orientation so authentic asymmetric detailing,
    // rear pockets, embroidery, or text remain un-inverted.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(backCanvas, 0, 0, W, H);
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
  // Cap the working resolution: keeps flood-fill / mask analysis fast, reduces main-thread blocking, and keeps GPU memory small
  const MAX_SIDE = 384;
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

    // Flood-fill inward from exterior background (and image borders) into connected
    // low-saturation light-gray/white studio background pockets attached to non-white garments
    // (e.g. concave pocket indentations along the side of cargo shorts).
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
        // Only strip light-gray/white studio background pockets if the core garment itself is not light gray/white
        if (coreLum < 155 || coreChroma > 24) {
          const isStudioFringe = (p) => {
            const o = p * 4;
            const r = data[o], g = data[o + 1], b = data[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            const distCore = Math.hypot(r - coreR, g - coreG, b - coreB);
            return lum >= 138 && chroma <= 32 && distCore > 42;
          };
          const fQueue = new Int32Array(w * h);
          let fHead = 0;
          let fTail = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const p = y * w + x;
              if (bgMask[p]) continue;
              const touchesBg =
                x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
                bgMask[p - 1] || bgMask[p + 1] || bgMask[p - w] || bgMask[p + w];
              if (touchesBg && isStudioFringe(p)) {
                bgMask[p] = 1;
                fQueue[fTail++] = p;
              }
            }
          }
          while (fHead < fTail) {
            const p = fQueue[fHead++];
            const x = p % w;
            const y = (p - x) / w;
            if (x > 0 && !bgMask[p - 1] && isStudioFringe(p - 1)) {
              bgMask[p - 1] = 1;
              fQueue[fTail++] = p - 1;
            }
            if (x < w - 1 && !bgMask[p + 1] && isStudioFringe(p + 1)) {
              bgMask[p + 1] = 1;
              fQueue[fTail++] = p + 1;
            }
            if (y > 0 && !bgMask[p - w] && isStudioFringe(p - w)) {
              bgMask[p - w] = 1;
              fQueue[fTail++] = p - w;
            }
            if (y < h - 1 && !bgMask[p + w] && isStudioFringe(p + w)) {
              bgMask[p + w] = 1;
              fQueue[fTail++] = p + w;
            }
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
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
  cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  // Read crop pixels ONCE into memory, run background removal, halo trim, and edge despill
  // in a single pass, and write back once (eliminating repeated GPU<->CPU getImageData stalls).
  let cleanCropImgData = null;
  try {
    cleanCropImgData = cropCtx.getImageData(0, 0, cropW, cropH);
    const eData = cleanCropImgData.data;

    // 1. Remove background, detached cutout shards, and studio fringes from the crop (keeps interior whites intact)
    if (imgData && bgMask) {
      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          if (bgMask[(minY + cy) * w + (minX + cx)]) {
            eData[(cy * cropW + cx) * 4 + 3] = 0;
          }
        }
      }
    }

    // 2. Trim the 1-2px semi-transparent halo that cut-outs carry (white catalog fringe)
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
      for (let k = 0; k < kill.length; k++) {
        eData[kill[k] * 4 + 3] = 0;
      }
    }

    // 3. Per-row edge despill & light-fringe trim: compares outer 15% of each span against
    // adjacent interior fabric (15%..28% inward) to strip remaining gray/white cutout rims
    // and replace the outermost 4 edge pixels' RGB with clean local fabric color.
    for (let y = 0; y < cropH; y++) {
      const row = y * cropW;
      let x = 0;
      while (x < cropW) {
        while (x < cropW && eData[(row + x) * 4 + 3] < 110) x++;
        if (x >= cropW) break;
        const a = x;
        while (x < cropW && eData[(row + x) * 4 + 3] >= 110) x++;
        const b = x - 1;
        const span = b - a + 1;
        if (span < 16) continue;

        const d0 = Math.max(3, Math.min(14, Math.floor(span * 0.14)));
        const d1 = Math.max(d0 + 2, Math.min(24, Math.floor(span * 0.28)));

        // Left interior reference
        let lR = 0, lG = 0, lB = 0, lN = 0;
        for (let cx = a + d0; cx <= Math.min(b, a + d1); cx++) {
          const o = (row + cx) * 4;
          if (eData[o + 3] >= 180) {
            lR += eData[o]; lG += eData[o + 1]; lB += eData[o + 2]; lN++;
          }
        }
        // Right interior reference
        let rR = 0, rG = 0, rB = 0, rN = 0;
        for (let cx = Math.max(a, b - d1); cx <= b - d0; cx++) {
          const o = (row + cx) * 4;
          if (eData[o + 3] >= 180) {
            rR += eData[o]; rG += eData[o + 1]; rB += eData[o + 2]; rN++;
          }
        }

        let newA = a;
        if (lN > 0) {
          lR /= lN; lG /= lN; lB /= lN;
          const lLum = 0.299 * lR + 0.587 * lG + 0.114 * lB;
          const lChroma = Math.max(lR, lG, lB) - Math.min(lR, lG, lB);
          for (let cx = a; cx < a + d0; cx++) {
            const o = (row + cx) * 4;
            const r = eData[o], g = eData[o + 1], bl = eData[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
            const ch = Math.max(r, g, bl) - Math.min(r, g, bl);
            if (lum - lLum > 24 && ch <= lChroma + 14) {
              eData[o + 3] = 0;
              newA = cx + 1;
            } else {
              break;
            }
          }
          for (let cx = newA; cx <= Math.min(b, newA + 4); cx++) {
            const o = (row + cx) * 4;
            const lum = 0.299 * eData[o] + 0.587 * eData[o + 1] + 0.114 * eData[o + 2];
            if (lum - lLum > 14) {
              eData[o] = Math.round(lR);
              eData[o + 1] = Math.round(lG);
              eData[o + 2] = Math.round(lB);
            }
          }
        }

        let newB = b;
        if (rN > 0) {
          rR /= rN; rG /= rN; rB /= rN;
          const rLum = 0.299 * rR + 0.587 * rG + 0.114 * rB;
          const rChroma = Math.max(rR, rG, rB) - Math.min(rR, rG, rB);
          for (let cx = b; cx > b - d0; cx--) {
            const o = (row + cx) * 4;
            const r = eData[o], g = eData[o + 1], bl = eData[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
            const ch = Math.max(r, g, bl) - Math.min(r, g, bl);
            if (lum - rLum > 24 && ch <= rChroma + 14) {
              eData[o + 3] = 0;
              newB = cx - 1;
            } else {
              break;
            }
          }
          for (let cx = Math.max(newA, newB - 4); cx <= newB; cx++) {
            const o = (row + cx) * 4;
            const lum = 0.299 * eData[o] + 0.587 * eData[o + 1] + 0.114 * eData[o + 2];
            if (lum - rLum > 14) {
              eData[o] = Math.round(rR);
              eData[o + 1] = Math.round(rG);
              eData[o + 2] = Math.round(rB);
            }
          }
        }
      }
    }

    cropCtx.putImageData(cleanCropImgData, 0, 0);
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
    const layoutData = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, cropW, cropH).data;
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
    let big = runs.filter(([r0, r1]) => r1 - r0 + 1 >= cropW * 0.12);

    // If only one wide run was detected, check if it actually contains a pair of shoes
    // separated by a coverage valley in the middle third of the image
    if (big.length === 1 && (big[0][1] - big[0][0] + 1) >= cropW * 0.45) {
      const [rStart, rEnd] = big[0];
      const midMin = Math.max(rStart + Math.floor((rEnd - rStart) * 0.30), Math.floor(cropW * 0.35));
      const midMax = Math.min(rStart + Math.floor((rEnd - rStart) * 0.70), Math.floor(cropW * 0.65));
      let minCov = Infinity;
      let valleyX = -1;
      for (let cx = midMin; cx <= midMax; cx++) {
        if (colCount[cx] < minCov) {
          minCov = colCount[cx];
          valleyX = cx;
        }
      }
      if (valleyX > 0 && minCov < maxCov * 0.65) {
        big = [
          [rStart, valleyX - 1],
          [valleyX, rEnd],
        ];
      }
    }
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
      const toeUp = true;
      return {
        u0: c0 / cropW,
        u1: (c1 + 1) / cropW,
        v0: 1 - (r1 + 1) / cropH,
        v1: 1 - r0 / cropH,
        toeUp,
      };
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
    const cData = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, cropW, cropH).data;
    let sumOx = 0;
    let sumOy = 0;
    let countO = 0;
    const stride = Math.max(1, Math.floor(Math.min(cropW, cropH) / 64));
    for (let cy = 0; cy < cropH; cy += stride) {
      const row = cy * cropW * 4;
      for (let cx = 0; cx < cropW; cx += stride) {
        if (cData[row + cx * 4 + 3] > 240) {
          sumOx += cx;
          sumOy += cy;
          countO++;
        }
      }
    }
    if (countO > 0) {
      const medX = sumOx / countO;
      const medY = sumOy / countO;
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
    const srcPixels = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, cropW, cropH).data;
    const fillData = new ImageData(new Uint8ClampedArray(srcPixels), cropW, cropH);
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
    fillCanvas.getContext('2d', { willReadFrequently: true }).putImageData(fillData, 0, 0);
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
  const opaqueCtx = opaqueCanvas.getContext('2d', { willReadFrequently: true });
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
    const sData = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, cropW, cropH).data;
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

  setTextureCache(url, res);
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
    const waistOff = Math.min(layerOffset, 0.0018); // <= 2mm physical fabric thickness at waistline
    const rxWaist = (waistSlice ? waistSlice.rx : 0.145) + waistOff;
    const rzFrontWaist = (waistSlice ? (waistSlice.rzFront || waistSlice.rz) : 0.095) + waistOff;
    const rzBackWaist = (waistSlice ? (waistSlice.rzBack || waistSlice.rz) : 0.095) + waistOff;
    const cz = waistSlice ? waistSlice.cz : 0.020;

    for (let i = 0; i <= ny; i++) {
      const vNorm = i / ny;
      const y = yTop - vNorm * (yTop - yHem);
      const bodySlice = getTorsoSlice(Math.max(0.50, y), isMale);

      // Smooth A-line contour anchored to exact waist circumference (<= 2mm thick at waist)
      const flareRatio = Math.pow(vNorm, 1.15);
      const rx = Math.max((bodySlice ? bodySlice.rx : rxWaist) + waistOff, rxWaist + flareRatio * 0.08);
      const rzFront = Math.max((bodySlice ? (bodySlice.rzFront || bodySlice.rz) : rzFrontWaist) + waistOff, rzFrontWaist + flareRatio * 0.05);
      const rzBack = Math.max((bodySlice ? (bodySlice.rzBack || bodySlice.rz) : rzBackWaist) + waistOff, rzBackWaist + flareRatio * 0.05);

      const vTex = 1.0 - vNorm;

      for (let j = 0; j <= nx; j++) {
        const uFrac = j / nx;
        const theta = -Math.PI + uFrac * 2 * Math.PI;
        const x = rx * Math.sin(theta);
        const isFront = Math.cos(theta) >= 0;
        const z = isFront
          ? cz + rzFront * Math.cos(theta)
          : cz - rzBack * Math.abs(Math.cos(theta));
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
  // Strict Waist & Crotch Anchor:
  // 1) Unified 360° pelvis shell from waistband (yWaist) down to crotch line (yCrotch).
  //    Pants can NEVER bifurcate or split higher than the crotch line.
  // 2) Bifurcated left/right leg cylinders exclusively from yCrotch down to yAnkle.
  const yWaist = yTop;
  const yCrotch = isMale ? 0.86 : 0.82;
  const yAnkle = isShorts ? (isMale ? 0.58 : 0.54) : Math.min(yHem, yCrotch - 0.06);

  // 1) Upper Pelvis & Waistband Shell (yWaist -> yCrotch)
  const nyPelvis = 8;
  const nxPelvis = 28;
  const pelvisStartIdx = verts.length / 3;
  const pelvisTexSpan = Math.min(0.42, Math.max(0.22, (yWaist - yCrotch) / Math.max(0.18, yWaist - yAnkle)));

  for (let i = 0; i <= nyPelvis; i++) {
    const tPelvis = i / nyPelvis; // 0 at waist, 1 at crotch
    const y = yWaist - tPelvis * (yWaist - yCrotch);
    const sliceTorso = getTorsoSlice(y, isMale);
    const fitOff = Math.min(layerOffset, 0.0025);
    const rx = sliceTorso.rx + fitOff;
    const rzFront = (sliceTorso.rzFront || sliceTorso.rz) + fitOff;
    const rzBack = (sliceTorso.rzBack || sliceTorso.rz) + fitOff;
    const cz = sliceTorso.cz;
    const vTex = 0.98 - tPelvis * pelvisTexSpan * 0.94;

    for (let j = 0; j <= nxPelvis; j++) {
      const uFrac = j / nxPelvis;
      const theta = -Math.PI + uFrac * 2 * Math.PI;
      const isFront = Math.cos(theta) >= 0;
      const x = rx * Math.sin(theta);
      // Subtle crotch saddle indentation exclusively at the bottom crotch boundary (tPelvis -> 1)
      const centerT = Math.max(0, 1 - Math.abs(Math.sin(theta)) / 0.28);
      const saddlePinch = Math.pow(tPelvis, 2.2) * centerT * 0.018;
      const z = isFront
        ? cz + Math.max(0.02, rzFront - saddlePinch) * Math.cos(theta)
        : cz - Math.max(0.02, rzBack - saddlePinch) * Math.abs(Math.cos(theta));
      verts.push(x, y, z);

      const uTex = 0.5 + 0.46 * Math.sin(theta);
      uvs.push(
        Math.max(0.02, Math.min(0.98, uTex)),
        Math.max(0.02, Math.min(0.98, vTex))
      );
    }
  }

  for (let i = 0; i < nyPelvis; i++) {
    for (let j = 0; j < nxPelvis; j++) {
      const a = pelvisStartIdx + i * (nxPelvis + 1) + j;
      const b = a + 1;
      const c = a + (nxPelvis + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 2) Lower Leg Tubes (yCrotch -> yAnkle, strictly <= yCrotch)
  const nyLeg = 14;
  const nxLeg = 18;
  const legSides = [-1, 1]; // Right (-X), Left (+X)

  legSides.forEach((side) => {
    const startIdx = verts.length / 3;

    for (let i = 0; i <= nyLeg; i++) {
      const vLeg = i / nyLeg;
      const y = yCrotch - vLeg * (yCrotch - yAnkle);
      const slice = getLegSlice(y, isMale);
      const cx = side * slice.cx;
      const cz = slice.cz;
      const fitOff = Math.min(layerOffset, 0.0025);
      const rx = slice.r + fitOff;
      const rzFront = (slice.rzFront || slice.r) + fitOff;
      const rzBack = (slice.rzBack || slice.r) + fitOff;

      const vTex = (0.98 - pelvisTexSpan * 0.94) - vLeg * (1 - pelvisTexSpan) * 0.94;

      for (let j = 0; j <= nxLeg; j++) {
        const uFrac = j / nxLeg;
        const theta = -Math.PI + uFrac * 2 * Math.PI;

        const isFront = Math.cos(theta) >= 0;
        const x = cx + rx * Math.sin(theta);
        const z = isFront
          ? cz + rzFront * Math.cos(theta)
          : cz - rzBack * Math.abs(Math.cos(theta));
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
  ySole = -0.008,
  layerOffset = 0.012,
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

/**
 * Creates 3D accessory geometry mapped directly to its anatomical anchor on the avatar:
 *  - 'watch': Wristwatch / bracelet wrapped around the avatar's LEFT wrist (+X side)
 *             with a raised watch dial/bezel on the dorsal wrist surface.
 *  - 'necktie': Contoured collar band + knot + tapered front blade hanging from the
 *               neckline (y = 1.50 M / 1.44 F) down to the beltline (y = 1.06 M / 1.04 F),
 *               layered cleanly outside the shirt (`layerOffset = 0.029`) and inside jackets.
 *  - 'belt': 360° contoured elliptical strap + raised front buckle around the waistline
 *            (y = 1.08 M / 1.05 F), overlaying tops and bottoms (`layerOffset = 0.026`).
 *  - 'headwear': Contoured crown dome + visor/brim on the head.
 *  - 'glasses': Contoured front frame + nose bridge + side temples resting on the face.
 *  - 'bag': Structured handbag/shoulder bag positioned on the right hip/hand side.
 */
export function createAnatomicalAccessoryGeometry(type, { isMale = false, layerOffset = 0.026 } = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  const baseHeadY = isMale ? 1.70 : 1.62;

  if (type === 'watch') {
    // Avatar's anatomical LEFT wrist is on the +X side:
    // Female wrist at y = 0.900m: cx = +0.228m, cz = +0.044m, rx = 0.031m, rz = 0.031m
    // Male wrist at y = 0.915m:   cx = +0.256m, cz = +0.068m, rx = 0.036m, rz = 0.042m
    const cx = isMale ? 0.256 : 0.228;
    const cy = isMale ? 0.915 : 0.900;
    const cz = isMale ? 0.068 : 0.044;
    const bandHalfH = 0.015;
    const rx = isMale ? 0.042 : 0.036;
    const rz = isMale ? 0.047 : 0.036;
    const ny = 6;
    const nx = 24;

    // 1. 360° Wrist Strap Band
    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const y = cy + bandHalfH - v * (bandHalfH * 2);
      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const x = cx + rx * Math.sin(theta);
        const z = cz + rz * Math.cos(theta);
        verts.push(x, y, z);
        uvs.push(u, 1 - v);
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

    // 2. Raised Watch Case / Bezel on outer/front-lateral wrist surface (theta around +pi/4)
    const caseStartIdx = verts.length / 3;
    const caseAngle = Math.PI * 0.25; // front-outer aspect of left wrist
    const nCaseR = 16;
    const caseRadius = 0.022;
    const caseDepth = 0.008;
    const nxDir = Math.sin(caseAngle);
    const nzDir = Math.cos(caseAngle);
    const txDir = Math.cos(caseAngle);
    const tzDir = -Math.sin(caseAngle);
    const dialCenterX = cx + (rx + caseDepth) * nxDir;
    const dialCenterY = cy;
    const dialCenterZ = cz + (rz + caseDepth) * nzDir;

    // Center vertex of watch face
    verts.push(dialCenterX, dialCenterY, dialCenterZ);
    uvs.push(0.5, 0.5);
    for (let j = 0; j <= nCaseR; j++) {
      const phi = (j / nCaseR) * 2 * Math.PI;
      const localU = Math.cos(phi) * caseRadius;
      const localV = Math.sin(phi) * caseRadius;
      const RimX = dialCenterX + localU * txDir;
      const RimY = dialCenterY + localV;
      const RimZ = dialCenterZ + localU * tzDir;
      verts.push(RimX, RimY, RimZ);
      uvs.push(0.5 + 0.35 * Math.cos(phi), 0.5 + 0.35 * Math.sin(phi));
    }
    for (let j = 1; j <= nCaseR; j++) {
      indices.push(caseStartIdx, caseStartIdx + j, caseStartIdx + j + 1);
    }
  } else if (type === 'necktie') {
    // Contoured 3D Necktie anchored from the neckline down over the sternum to the beltline.
    // Overlays shirt (0.022m) and sits cleanly beneath outerwear (0.038m).
    const tieOffset = Math.max(0.029, layerOffset);
    const yTop = isMale ? 1.50 : 1.44;
    const yKnotBottom = isMale ? 1.44 : 1.385;
    const yTip = isMale ? 1.06 : 1.04;

    // 1. Collar Loop around the neck (yTop -> yKnotBottom)
    const nyCollar = 3;
    const nxCollar = 20;
    const collarStartIdx = verts.length / 3;
    for (let i = 0; i <= nyCollar; i++) {
      const v = i / nyCollar;
      const y = yTop - v * (yTop - yKnotBottom);
      const slice = getTorsoSlice(y, isMale);
      const rx = Math.min(slice.rx, isMale ? 0.082 : 0.068) + tieOffset * 0.7;
      const rz = Math.min(slice.rz, isMale ? 0.078 : 0.066) + tieOffset * 0.7;
      for (let j = 0; j <= nxCollar; j++) {
        const u = j / nxCollar;
        const theta = -Math.PI + u * 2 * Math.PI;
        verts.push(rx * Math.sin(theta), y, slice.cz + rz * Math.cos(theta));
        uvs.push(0.35 + u * 0.30, 0.96 - v * 0.08);
      }
    }
    for (let i = 0; i < nyCollar; i++) {
      for (let j = 0; j < nxCollar; j++) {
        const a = collarStartIdx + i * (nxCollar + 1) + j;
        indices.push(a, a + nxCollar + 1, a + 1, a + 1, a + nxCollar + 1, a + nxCollar + 2);
      }
    }

    // 2. Front Tie Knot & Tapered Blade with Pointed Diamond Tip (yTop -> yTip)
    const nyBlade = 18;
    const nxBlade = 6;
    const bladeStartIdx = verts.length / 3;
    for (let i = 0; i <= nyBlade; i++) {
      const v = i / nyBlade; // 0 at top knot, 1 at bottom tip
      const y = yTop - v * (yTop - yTip);
      const slice = getTorsoSlice(y, isMale);

      // Width profile: knot at top (v < 0.14), narrow neck (v = 0.16), widening blade (v = 0.85), pointed tip (v = 1.0)
      let halfWidth;
      let knotBumpZ = 0;
      if (v < 0.14) {
        const kt = v / 0.14;
        halfWidth = 0.028 - kt * 0.011; // 2.8cm down to 1.7cm at knot base
        knotBumpZ = Math.sin(kt * Math.PI) * 0.009;
      } else if (v < 0.86) {
        const bt = (v - 0.14) / (0.86 - 0.14);
        halfWidth = 0.017 + bt * 0.027; // tapers out to 4.4cm wide blade
      } else {
        const tt = (v - 0.86) / 0.14;
        halfWidth = Math.max(0.002, 0.044 * (1 - tt)); // crisp V-point tip
      }

      const rzFront = (slice.rzFront || slice.rz) + tieOffset + knotBumpZ;
      for (let j = 0; j <= nxBlade; j++) {
        const u = j / nxBlade; // 0..1 across tie width
        const x = (u - 0.5) * 2 * halfWidth;
        // Slight convex bevel across the blade so it has 3D thickness
        const bevelZ = Math.sin(u * Math.PI) * 0.004;
        const z = slice.cz + rzFront + bevelZ;
        verts.push(x, y, z);
        uvs.push(0.32 + u * 0.36, 0.98 - v * 0.94);
      }
    }
    for (let i = 0; i < nyBlade; i++) {
      for (let j = 0; j < nxBlade; j++) {
        const a = bladeStartIdx + i * (nxBlade + 1) + j;
        const b = a + 1;
        const c = a + (nxBlade + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  } else if (type === 'headwear') {
    const ny = 8;
    const nx = 20;
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
    const nxG = 12;
    const nyG = 2;
    for (let i = 0; i <= nyG; i++) {
      const v = i / nyG;
      const y = yEye + 0.024 - v * 0.048;
      for (let j = 0; j <= nxG; j++) {
        const u = j / nxG;
        const x = (u - 0.5) * 0.15;
        const curveZ = 0.138 - Math.pow(Math.abs(u - 0.5) * 2, 1.8) * 0.022;
        verts.push(x, y, curveZ);
        uvs.push(u, 1 - v);
      }
    }
    for (let i = 0; i < nyG; i++) {
      for (let j = 0; j < nxG; j++) {
        const a = i * (nxG + 1) + j;
        indices.push(a, a + nxG + 1, a + 1, a + 1, a + nxG + 1, a + nxG + 2);
      }
    }
  } else if (type === 'bag') {
    // Structured 3D bag carried near right hip/hand (-X side)
    const cx = isMale ? -0.27 : -0.24;
    const cy = isMale ? 0.84 : 0.80;
    const cz = 0.04;
    const hw = 0.055;
    const hh = 0.11;
    const hd = 0.095;
    const nyB = 8;
    const nxB = 20;
    for (let i = 0; i <= nyB; i++) {
      const v = i / nyB;
      const y = cy + hh - v * (hh * 2);
      for (let j = 0; j <= nxB; j++) {
        const u = j / nxB;
        const theta = -Math.PI + u * 2 * Math.PI;
        verts.push(cx + hw * Math.sin(theta), y, cz + hd * Math.cos(theta));
        uvs.push(u, 1 - v);
      }
    }
    for (let i = 0; i < nyB; i++) {
      for (let j = 0; j < nxB; j++) {
        const a = i * (nxB + 1) + j;
        indices.push(a, a + nxB + 1, a + 1, a + 1, a + nxB + 1, a + nxB + 2);
      }
    }
  } else {
    // Belt / Waistline accessory: 360° contoured elliptical strap + front buckle on the waistline
    const yBelt = isMale ? 1.08 : 1.05;
    const beltHalfH = 0.022;
    const slice = getTorsoSlice(yBelt, isMale);
    const beltOffset = Math.max(0.026, layerOffset);
    const rx = slice.rx + beltOffset;
    const rzFront = (slice.rzFront || slice.rz) + beltOffset;
    const rzBack = (slice.rzBack || slice.rz) + beltOffset + 0.006;
    const nyB = 4;
    const nxB = 28;

    for (let i = 0; i <= nyB; i++) {
      const v = i / nyB;
      const y = yBelt + beltHalfH - v * (beltHalfH * 2);
      for (let j = 0; j <= nxB; j++) {
        const u = j / nxB;
        const theta = -Math.PI + u * 2 * Math.PI;
        const isFront = Math.cos(theta) >= 0;
        const x = rx * Math.sin(theta);
        // Subtle front buckle relief at center-front (|sin(theta)| < 0.18)
        const isBuckle = isFront && Math.abs(Math.sin(theta)) < 0.18;
        const buckleBoost = isBuckle ? 0.005 : 0;
        const z = isFront
          ? slice.cz + (rzFront + buckleBoost) * Math.cos(theta)
          : slice.cz - rzBack * Math.abs(Math.cos(theta));
        verts.push(x, y, z);
        uvs.push(u, 1 - v);
      }
    }
    for (let i = 0; i < nyB; i++) {
      for (let j = 0; j < nxB; j++) {
        const a = i * (nxB + 1) + j;
        const b = a + 1;
        const c = a + (nxB + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extracts comprehensive metadata text from a garment and its rawItem so cut,
 * silhouette, length, sleeves, and material properties are always considered.
 */
export function resolveGarmentMetadataText(garment) {
  if (!garment) return '';
  const raw = garment.rawItem || {};
  return [
    garment.sub_category,
    garment.subcategory,
    garment.item_type,
    garment.name,
    garment.title,
    garment.category,
    garment.caption,
    garment.description,
    garment.material,
    garment.fabric,
    garment.fit,
    garment.cut,
    garment.length,
    garment.sleeve_length,
    garment.neckline,
    raw.sub_category,
    raw.subcategory,
    raw.item_type,
    raw.name,
    raw.title,
    raw.category,
    raw.caption,
    raw.description,
    raw.material,
    raw.fabric,
    raw.fit,
    raw.cut,
    raw.length,
    raw.sleeve_length,
    raw.neckline,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Resolves consistent PBR material surface attributes (roughness, metalness, envMapIntensity)
 * from the garment metadata so fabric sheen and texture match across all 3D views.
 */
export function resolveMaterialPBRProps(garmentText = '', rawSlot = 'top') {
  const has = (...words) => words.some((w) => garmentText.includes(w));
  if (rawSlot === 'watch' || has('gold', 'silver', 'metallic', 'metal', 'stainless', 'זהב', 'כסף', 'מתכת')) {
    return { roughness: 0.25, metalness: 0.72, envMapIntensity: 1.35 };
  }
  if (has('patent', 'latex', 'vinyl', 'לקה', 'ויניל')) {
    return { roughness: 0.18, metalness: 0.15, envMapIntensity: 1.3 };
  }
  if (has('leather', 'faux leather', 'suede', 'עור', 'זמש')) {
    return { roughness: 0.42, metalness: 0.08, envMapIntensity: 1.05 };
  }
  if (has('silk', 'satin', 'velvet', 'chiffon', 'organza', 'משי', 'סאטן', 'קטיפה', 'שיפון') || rawSlot === 'necktie') {
    return { roughness: 0.38, metalness: 0.06, envMapIntensity: 1.0 };
  }
  if (has('denim', 'jeans', 'canvas', 'corduroy', 'ג׳ינס', "ג'ינס", 'דנים', 'קורדורוי')) {
    return { roughness: 0.86, metalness: 0.01, envMapIntensity: 0.55 };
  }
  if (has('wool', 'knit', 'cashmere', 'fleece', 'sweater', 'צמר', 'סריג', 'קשמיר', 'פליז')) {
    return { roughness: 0.88, metalness: 0.01, envMapIntensity: 0.50 };
  }
  if (rawSlot === 'shoes' || rawSlot === 'belt' || rawSlot === 'bag') {
    return { roughness: 0.38, metalness: 0.10, envMapIntensity: 1.15 };
  }
  return { roughness: 0.76, metalness: 0.02, envMapIntensity: 0.72 };
}

/**
 * Returns the physical layering renderOrder for each garment slot:
 * bottom (6) < top (8) < dress (9) < belt (10) < necktie (11) < outerwear (12) < shoes (14) < watch/accessory (15)
 */
export function resolveGarmentRenderOrder(rawSlot) {
  switch (rawSlot) {
    case 'bottom':
      return 6;
    case 'top':
      return 8;
    case 'dress':
      return 9;
    case 'belt':
      return 10;
    case 'necktie':
      return 11;
    case 'outerwear':
      return 12;
    case 'shoes':
      return 14;
    case 'watch':
    case 'glasses':
    case 'headwear':
    case 'bag':
    case 'accessory':
      return 15;
    default:
      return 10;
  }
}

/**
 * Resolves realistic physical fabric thickness in meters (0.2 mm to 3.0 mm = 0.0002m to 0.0030m).
 * Overlaid tops (sweaters, sweatshirts, hoodies, cardigans) and outerwear (jackets, coats, blazers)
 * are thicker (2.2 mm - 3.0 mm), while skirts, trousers, shirts, and silk blouses are 0.4 mm - 1.8 mm.
 */
export function resolveFabricThickness(fullText = '', rawSlot = 'top', isSkirt = false) {
  const has = (...words) => words.some((w) => fullText.includes(w));
  if (rawSlot === 'outerwear' || has('coat', 'overcoat', 'trench', 'parka', 'puffer', 'blazer', 'jacket', 'מעיל', "ז'קט", 'בלייזר')) {
    return has('heavy', 'puffer', 'winter', 'wool', 'fur', 'פוך', 'צמר') ? 0.0030 : 0.0027;
  }
  if (has('sweater', 'sweatshirt', 'hoodie', 'cardigan', 'fleece', 'knit', 'jumper', 'pullover', 'סוודר', 'סווטשירט', "קפוצ'ון", 'קרדיגן', 'סריג', 'פליז')) {
    return 0.0024;
  }
  if (rawSlot === 'bottom') {
    if (isSkirt) {
      if (has('silk', 'satin', 'chiffon', 'שיפון', 'משי', 'סאטן')) return 0.0008;
      return 0.0016; // <= 2.0 mm on the waistline
    }
    if (has('denim', 'jeans', 'cargo', 'corduroy', "ג'ינס", 'דגמ"ח')) return 0.0018;
    if (has('linen', 'silk', 'פשתן', 'משי')) return 0.0010;
    return 0.0015;
  }
  if (has('silk', 'chiffon', 'satin', 'lace', 'mesh', 'sheer', 'organza', 'משי', 'שיפון', 'סאטן', 'תחרה')) {
    return 0.0005;
  }
  if (has('linen', 'viscose', 'rayon', 'camisole', 'tank', 'גופיה', 'פשתן')) {
    return 0.0008;
  }
  if (rawSlot === 'dress') {
    if (has('velvet', 'knit', 'wool', 'קטיפה', 'סריג')) return 0.0020;
    return 0.0014;
  }
  // Standard T-shirt, polo, button-up shirt, blouse: ~1.2 mm
  return 0.0012;
}

/**
 * Vertical placement + clearance of a garment shell for each clothing slot,
 * expressed in the avatar's base (un-morphed) metric space.
 * Enforces strict physical layering offsets and realistic fabric thickness (0.2 mm to 3.0 mm).
 */
export function resolveShellFit({
  rawSlot,
  garmentText = '',
  isMale = false,
  hasOuterwear = false,
  garment = null,
  aspect = 0.55,
} = {}) {
  const fullText = `${garmentText} ${resolveGarmentMetadataText(garment)}`.toLowerCase();
  const has = (...words) => words.some((w) => fullText.includes(w));
  const isStrapless = has('strapless', 'tube', 'bandeau', 'סטרפלס', 'בנדו', 'sans bretelles', 'trägerlos', 'palabra de honor');
  const isWideOrLoose = has('wide', 'loose', 'baggy', 'oversized', 'hip-hop', 'hip hop', 'cargo', 'relaxed', 'boyfriend', 'flair', 'flare', 'palazzo', 'ball gown', 'רחב', 'רפוי', 'אוברסייז');
  if (rawSlot === 'top') {
    const isCrop = has('crop', 'sports_bra', 'bralette', 'קרופ', 'חזיה');
    const isLongline = has('kurta', 'tunic', 'longline', 'thobe', 'טוניקה');
    let yBottom = isMale ? 0.90 : 0.86;
    if (isCrop) yBottom = isMale ? 1.18 : 1.12;
    if (isLongline) yBottom = isMale ? 0.75 : 0.70;
    const yTop = isStrapless ? (isMale ? 1.34 : 1.30) : (isMale ? 1.52 : 1.44);
    const fabricThickness = resolveFabricThickness(fullText, 'top', false);
    // Shirt/top always clears bottom (0.016m) and sits cleanly under necktie (0.029m) & outerwear (0.035m+)
    return { yTop, yBottom, layerOffset: 0.022, fabricThickness, isSkirt: false, isStrapless, isWideOrLoose };
  }
  if (rawSlot === 'outerwear') {
    const isLong = has('overcoat', 'trench', 'duster', 'מעיל ארוך', 'cardigan', 'קרדיגן', 'coat', 'parka', 'robe');
    const isCrop = has('bolero', 'shrug', 'עליונית קצרה') || (has('jacket') && has('crop'));
    let yBottom = isMale ? 0.88 : 0.84;
    if (isLong) yBottom = isMale ? 0.52 : 0.48;
    if (isCrop) yBottom = isMale ? 1.15 : 1.10;
    const fabricThickness = resolveFabricThickness(fullText, 'outerwear', false);
    return { yTop: isMale ? 1.53 : 1.45, yBottom, layerOffset: isMale ? 0.038 : 0.035, fabricThickness, isSkirt: false, isStrapless: false, isWideOrLoose };
  }
  if (rawSlot === 'dress') {
    const isMini = has('mini', 'קצרה');
    const isMaxi = has('maxi', 'gown', 'evening', 'ארוכה', 'מקסי', 'kaftan', 'caftan', 'robe', 'abaya');
    let yBottom = isMale ? 0.55 : 0.50;
    if (isMini) yBottom = isMale ? 0.78 : 0.74;
    if (isMaxi) yBottom = isMale ? 0.16 : 0.12;
    const yTop = isStrapless ? (isMale ? 1.34 : 1.30) : (isMale ? 1.52 : 1.44);
    const fabricThickness = resolveFabricThickness(fullText, 'dress', false);
    return { yTop, yBottom, layerOffset: 0.023, fabricThickness, isSkirt: false, isStrapless, isWideOrLoose };
  }
  if (rawSlot === 'bottom') {
    const isSkirt = has('skirt', 'חצאית');
    const { lengthType, yBottom } = resolveBottomLength({
      garment,
      garmentText: fullText,
      aspect,
      isMale,
      isSkirt,
    });
    const fabricThickness = resolveFabricThickness(fullText, 'bottom', isSkirt);
    return {
      yTop: isMale ? 1.08 : 1.05,
      yBottom,
      layerOffset: isSkirt ? 0.014 : 0.0025,
      fabricThickness,
      isSkirt,
      isStrapless: false,
      isWideOrLoose,
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
  bypassSilhouette = false,
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

  const metadataText = useMemo(() => resolveGarmentMetadataText(garment), [garment]);
  const rawSlot = normalizeGarmentRole(
    slot || garment?.slot,
    garment?.category || garment?.rawItem?.category,
    metadataText || garment?.name || garment?.title || garment?.sub_category || garment?.item_type
  );
  const garmentText = metadataText;
  const pbrProps = useMemo(() => resolveMaterialPBRProps(garmentText, rawSlot), [garmentText, rawSlot]);
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

      const layerOffset = 0.022 + rxShift;

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

      // Layered cleanly outside tops and neckties with generous clearance
      const layerOffset = (isMale ? 0.038 : 0.035) + rxShift;

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
        layerOffset: 0.023 + rxShift,
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
        layerOffset: 0.016 + rxShift,
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

    // 6. ACCESSORIES (watch, necktie, belt, headwear, glasses, bag)
    const accessoryLayerOffset = rawSlot === 'necktie' ? 0.029 : rawSlot === 'belt' ? 0.026 : 0.042;
    return createAnatomicalAccessoryGeometry(rawSlot, { isMale, layerOffset: accessoryLayerOffset });
  }, [visible, rawSlot, garmentText, isMale, hasOuterwear, autoHasSleeves, aspect, solidU, solidV, footwearSpec, shoeLayout, isStandalone]);

  const geometry = useMemo(() => {
    const morphed = isStandalone
      ? baseGeometry
      : applyAvatarMorphsToGeometry(baseGeometry, morphField, morphInfluences, {
          includeArms: rawSlot === 'watch',
        });
    // Footwear follows the heeled foot pose applied to the avatar
    return rawSlot === 'shoes' ? poseGeometry(morphed, footPose) : morphed;
  }, [baseGeometry, morphField, morphInfluences, rawSlot, footPose, isStandalone]);

  // ── Silhouette shell: the garment keeps its own photographed outline ──
  const shellFit = useMemo(
    () => resolveShellFit({ rawSlot, garmentText, isMale, hasOuterwear, garment, aspect }),
    [rawSlot, garmentText, isMale, hasOuterwear, garment, aspect]
  );
  const shell = useMemo(() => {
    if (!visible || !shellFit || !shellMask || bypassSilhouette) return null;
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
        isWideOrLoose: Boolean(shellFit.isWideOrLoose),
        isStandalone,
        yTop: shellFit.yTop,
        yBottom: shellFit.yBottom,
        layerOffset: shellFit.layerOffset,
        fabricThickness: shellFit.fabricThickness,
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
    const minClearance = Number.isFinite(shellFit?.fabricThickness)
      ? shellFit.fabricThickness
      : (rawSlot === 'bottom' ? 0.0018 : 0.0020);
    return {
      front: applyAvatarMorphsToGeometry(shell.front, morphField, morphInfluences, {
        sheetSide: 'front',
        minClearance,
      }),
      back: applyAvatarMorphsToGeometry(shell.back, morphField, morphInfluences, {
        sheetSide: 'back',
        minClearance,
      }),
    };
  }, [shell, shellFit, morphField, morphInfluences, isStandalone]);

  const heelGeometry = useMemo(
    () => (rawSlot === 'shoes' && visible ? createHeelGeometry({ isMale, spec: footwearSpec, pose: footPose }) : null),
    [rawSlot, visible, isMale, footwearSpec, footPose]
  );

  // VRAM cleanup: dispose transient morphed and generated geometries on unmount / recompute
  useEffect(() => {
    return () => {
      if (baseGeometry) baseGeometry.dispose?.();
      if (geometry && geometry !== baseGeometry) geometry.dispose?.();
      if (shell) {
        shell.front?.dispose?.();
        shell.back?.dispose?.();
      }
      if (shellGeos) {
        if (shellGeos.front && shellGeos.front !== shell?.front) shellGeos.front.dispose?.();
        if (shellGeos.back && shellGeos.back !== shell?.back) shellGeos.back.dispose?.();
      }
      if (heelGeometry) heelGeometry.dispose?.();
    };
  }, [baseGeometry, geometry, shell, shellGeos, heelGeometry]);

  if (!visible || !garment) return null;

  const isCoreClothing = ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot);
  // Never flash an untextured (white) body-shaped placeholder while the photo loads
  if (isCoreClothing && !textureReady) return null;

  const renderOrder = resolveGarmentRenderOrder(rawSlot);

  if (shellGeos && texture) {
    const shellMaterialProps = {
      color: '#FFFFFF',
      alphaTest: 0.02,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      roughness: pbrProps.roughness,
      metalness: pbrProps.metalness,
      envMapIntensity: pbrProps.envMapIntensity,
      alphaToCoverage: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
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

  const isOpaqueSlot = ['top', 'outerwear', 'dress', 'bottom', 'shoes', 'belt', 'necktie', 'watch'].includes(rawSlot);

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
          : ['top', 'outerwear', 'dress', 'bottom', 'belt', 'necktie', 'watch'].includes(rawSlot)
            ? (filledTexture || opaqueTexture || texture)
            : texture) || null}
        color={rawSlot === 'shoes'
          ? ((opaqueTexture || texture) ? '#FFFFFF' : (dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#94A3B8'))
          : (texture ? '#FFFFFF' : dominantColor || '#CBD5E1')}
        transparent={!isOpaqueSlot}
        alphaTest={isOpaqueSlot ? 0 : 0.02}
        depthWrite={true}
        side={THREE.DoubleSide}
        roughness={pbrProps.roughness}
        metalness={pbrProps.metalness}
        envMapIntensity={pbrProps.envMapIntensity}
        polygonOffset={true}
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
    </>
  );
}
