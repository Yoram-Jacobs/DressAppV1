import React, { useMemo, useState, useEffect, Suspense } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { mergeBufferGeometries, mergeVertices } from 'three-stdlib';
import { buildAvatarMorphField, applyAvatarMorphsToGeometry } from '@/lib/avatarMorphField';
import { MALE_GLB_URL, FEMALE_GLB_URL } from './AvatarMesh3D';
import {
  resolveFootwearSpec,
  createFittedFootwearGeometry,
  createHeelGeometry,
  poseGeometry,
} from '@/lib/footwearFitting';
import {
  resolveGarmentTemplate,
  getTemplateGlbUrl,
  AVAILABLE_TEMPLATES,
} from '@/lib/garmentTemplatesCatalog';
import {
  analyzeGarmentFit,
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
  { y: 1.46, rx: 0.058, cz: 0.020, rz: 0.056, rzFront: 0.056, rzBack: 0.056 }, // Snug crew collar / neck base (prevents exposed shoulders)
  { y: 1.42, rx: 0.190, cz: 0.015, rz: 0.078, rzFront: 0.082, rzBack: 0.072 }, // Shoulder line / clavicle (zMin=-0.045, zMax=+0.067)
  { y: 1.36, rx: 0.212, cz: 0.020, rz: 0.104, rzFront: 0.112, rzBack: 0.090 }, // Upper chest / scapulae top (zMin=-0.063, zMax=+0.100)
  { y: 1.25, rx: 0.202, cz: 0.052, rz: 0.126, rzFront: 0.132, rzBack: 0.112 }, // Bust peak & scapulae (zMin=-0.057, zMax=+0.170)
  { y: 1.15, rx: 0.172, cz: 0.054, rz: 0.116, rzFront: 0.124, rzBack: 0.094 }, // Under-bust (zMin=-0.028, zMax=+0.165)
  { y: 1.05, rx: 0.148, cz: 0.052, rz: 0.110, rzFront: 0.116, rzBack: 0.095 }, // Natural waist / belly (rx=0.148, natural proportion)
  { y: 0.95, rx: 0.172, cz: 0.024, rz: 0.128, rzFront: 0.138, rzBack: 0.120 }, // Upper hips / lower belly (zMin=-0.101, zMax=+0.151)
  { y: 0.82, rx: 0.186, cz: 0.016, rz: 0.118, rzFront: 0.124, rzBack: 0.114 }, // Pelvis / crotch (exact outer alignment with leg rx=0.186)
  { y: 0.65, rx: 0.186, cz: 0.032, rz: 0.108, rzFront: 0.112, rzBack: 0.100 }, // Upper thigh flare (skirts/dresses)
];

export const TORSO_PROFILE_MALE = [
  { y: 1.52, rx: 0.068, cz: 0.016, rz: 0.065, rzFront: 0.065, rzBack: 0.065 }, // Snug crew collar / neck base (prevents exposed shoulders)
  { y: 1.48, rx: 0.210, cz: 0.010, rz: 0.092, rzFront: 0.092, rzBack: 0.090 }, // Shoulder line / clavicle (covers clavicles completely)
  { y: 1.42, rx: 0.232, cz: 0.013, rz: 0.115, rzFront: 0.118, rzBack: 0.112 }, // Shoulders / upper chest (aligned with avatar acromion)
  { y: 1.30, rx: 0.214, cz: 0.027, rz: 0.130, rzFront: 0.132, rzBack: 0.128 }, // Chest / pecs peak & scapulae
  { y: 1.18, rx: 0.176, cz: 0.036, rz: 0.116, rzFront: 0.118, rzBack: 0.112 }, // Rib cage / lumbar taper
  { y: 1.08, rx: 0.154, cz: 0.044, rz: 0.106, rzFront: 0.106, rzBack: 0.106 }, // Natural waist (no pinched corset waist)
  { y: 0.96, rx: 0.172, cz: 0.025, rz: 0.128, rzFront: 0.128, rzBack: 0.128 }, // Upper hips / glutes
  { y: 0.86, rx: 0.184, cz: 0.018, rz: 0.116, rzFront: 0.116, rzBack: 0.116 }, // Pelvis / crotch (exact outer alignment with leg cx+r=0.184)
  { y: 0.70, rx: 0.188, cz: 0.028, rz: 0.110, rzFront: 0.110, rzBack: 0.106 }, // Thigh flare
];

export const LEG_PROFILE_FEMALE = [
  { y: 0.82, cx: 0.094, r: 0.092, cz: 0.016, rzFront: 0.102, rzBack: 0.100 }, // Crotch / upper thigh (cx+r=0.186 matches pelvis rx)
  { y: 0.75, cx: 0.101, r: 0.087, cz: 0.024, rzFront: 0.086, rzBack: 0.086 }, // Upper-mid thigh (smooth cz gradient)
  { y: 0.65, cx: 0.115, r: 0.068, cz: 0.032, rzFront: 0.074, rzBack: 0.074 }, // Mid thigh (xmin=0.047, xmax=0.183)
  { y: 0.50, cx: 0.129, r: 0.058, cz: 0.028, rzFront: 0.062, rzBack: 0.062 }, // Knee (xmin=0.071, xmax=0.187)
  { y: 0.40, cx: 0.148, r: 0.060, cz: 0.003, rzFront: 0.059, rzBack: 0.059 }, // Back of knee / upper calf (xmin=0.088, xmax=0.208)
  { y: 0.30, cx: 0.155, r: 0.053, cz: 0.010, rzFront: 0.054, rzBack: 0.054 }, // Calf (xmin=0.102, xmax=0.208)
  { y: 0.20, cx: 0.166, r: 0.033, cz: 0.021, rzFront: 0.038, rzBack: 0.038 }, // Lower calf (xmin=0.133, xmax=0.199)
  { y: 0.10, cx: 0.167, r: 0.028, cz: 0.035, rzFront: 0.042, rzBack: 0.042 }, // Ankle (xmin=0.139, xmax=0.195)
];

export const LEG_PROFILE_MALE = [
  { y: 0.86, cx: 0.094, r: 0.090, cz: 0.018, rzFront: 0.114, rzBack: 0.112 }, // Crotch (cx+r=0.184 matches pelvis rx)
  { y: 0.78, cx: 0.098, r: 0.090, cz: 0.024, rzFront: 0.096, rzBack: 0.096 }, // Upper thigh (smooth cz gradient, no forward ledge)
  { y: 0.70, cx: 0.105, r: 0.082, cz: 0.028, rzFront: 0.086, rzBack: 0.086 }, // Mid thigh (smooth lateral curve)
  { y: 0.58, cx: 0.115, r: 0.061, cz: 0.024, rzFront: 0.073, rzBack: 0.073 }, // Lower thigh (xmin=0.054, xmax=0.176)
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
  // 1. Wearable core apparel (outerwear, dress, bottom, top, shoes) takes precedence
  // over accessory details (e.g. "מעיל טרנץ' עם חגורה", "belted trench coat", "dress with tie", "pants with belt").
  if (/(?:\b(?:overcoat|trench|coat|jacket|blazer|cardigan|parka|windbreaker|bomber|overshirt)\b|מעיל|ז['’׳]קט|ג['’׳]קט|טרנץ['’׳]?|בלייזר|קרדיגן)/i.test(text)) return 'outerwear';
  if (/(?:\b(?:dress|gown|jumpsuit|romper|kaftan|caftan|abaya)\b|שמלה|שמלת|אוברול|סרבל)/i.test(text) && !/\bdress\s+(?:shirt|pants|trousers|shoes|socks|watch)\b/i.test(text)) return 'dress';
  if (/(?:\b(?:pants|jeans|trousers|chinos?|cargo|shorts|skirt|leggings|joggers|slacks|sweatpants)\b|מכנס|ג['’]ינס|חצאית|שורטס|טייץ)/i.test(text)) return 'bottom';
  if (/(?:\b(?:t-?shirt|tee|shirt|blouse|sweater|hoodie|sweatshirt|pullover|polo|tank|camisole|jersey)\b|חולצ|סוודר|גופי)/i.test(text)) return 'top';
  if (/(?:\b(?:shoes?|footwear|sneakers?|boots?|sandals?|loafers?|heels?|flats?)\b|הנעלה|נעליים|נעלי|מגפיים|מגפי|סנדלים)/i.test(text)) return 'shoes';
  if (/(?:\b(?:hat|cap|headwear|beanie|beret)\b|כובע|כיפה|ברט)/i.test(text)) return 'headwear';
  if (/(?:\b(?:glasses|sunglasses|eyewear)\b|משקפיים|משקפי)/i.test(text)) return 'glasses';
  if (/(?:\b(?:bag|purse|tote|backpack|handbag|satchel|crossbody)\b|תיק|ארנק)/i.test(text)) return 'bag';
  if (/(?:\b(?:wristwatch|smartwatch|watch|timepiece|bracelet|bangle)\b|שעון יד|שעון|צמיד)/i.test(text)) return 'watch';
  if (/(?:\b(?:necktie|bow\s*tie|bowtie|cravat|necklace|pendant|choker)\b|\btie\b(?!\s*(?:dye|front|waist|belt|up|shoe))|עניבה|עניבת|פפיון|שרשרת)/i.test(text)) return 'necktie';
  if (/(?:\b(?:belt)\b|חגורה|חגורת)/i.test(text) && !/\bbelt\s*(?:bag|loop)\b/i.test(text)) {
    if (/(?:trench|coat|jacket|blazer|dress|pants|trousers|shirt|מעיל|טרנץ|שמלה|מכנס|חולצה)/i.test(text)) return null;
    return 'belt';
  }
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
  const hasCoreClothingKeywords = /(?:outerwear|jacket|coat|blazer|cardigan|parka|overcoat|trench|windbreaker|bomber|shrug|bolero|מעיל|ז['’]קט|ג['’]קט|בלייזר|עליונית|קרדיגן|dress|gown|jumpsuit|romper|שמלה|שמלת|pants|jeans|trousers|shorts?|skirt|leggings|מכנסיים|מכנס|חצאית|שורטס|חולצה|חולצת|top|shirt|blouse|sweater|hoodie|tee)/i.test(text);
  if (/(?:\bbelt\b|חגורה|חגורות|חגור|حزام|cinturón|cinturon|ceinture|gürtel|guertel|cintura|cinto|пояс|ремень|腰带|皮带|ベルト|riem|बेल्ट)/i.test(text) && !hasCoreClothingKeywords) {
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
          const srcX = Math.min(a + 2, a + (k - 1));
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
          const srcX = Math.max(b - 2, b - (k - 1));
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
export function synthesizeBackFabricCanvas(frontCanvas, dominantColor = '#CBD5E1') {
  if (!frontCanvas || typeof document === 'undefined') return frontCanvas;
  const W = frontCanvas.width;
  const H = frontCanvas.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  try {
    ctx.drawImage(frontCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, W, H);
    synthesizeBackFabricData(imgData.data, W, H);
    ctx.putImageData(imgData, 0, 0);
    return out;
  } catch {
    ctx.fillStyle = dominantColor;
    ctx.fillRect(0, 0, W, H);
    return out;
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
/**
 * Fills transparent canvas margins with clean edge fabric (sampling 2px inside seam)
 * and smoothly bridges interior underarm gaps. NEVER mirrors interior graphics!
 */
export function fillTransparentCanvasMargins(canvas, dominantColor = '#FFFFFF', patterned = false) {
  if (!canvas || typeof document === 'undefined') return;
  try {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, W, H);
    const px = imgData.data;

    const hexColor = (dominantColor || '#CBD5E1').replace('#', '');
    const domR = parseInt(hexColor.substring(0, 2), 16) || 200;
    const domG = parseInt(hexColor.substring(2, 4), 16) || 200;
    const domB = parseInt(hexColor.substring(4, 6), 16) || 200;
    const domLum = 0.299 * domR + 0.587 * domG + 0.114 * domB;

    const sanitizeEdgeSample = (r, g, b) => {
      if (domLum >= 165) return [r, g, b];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const ch = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > Math.max(160, domLum + 35) && ch <= 35) return [domR, domG, domB];
      return [r, g, b];
    };

    const ALPHA_ON = 120;
    // Pre-clean any residual white/light-gray studio shadow rim adjacent to transparent gaps/margins
    // on solid non-light garments so sleeve-to-torso slits and bottom hems never retain bright jagged outlines!
    if (domLum < 165) {
      // Seed trapped opaque white studio backdrop slits between sleeves & torso (flanks / lower hem)
      if (domLum < 140) {
        for (let cy = 0; cy < H; cy++) {
          const row = cy * W;
          for (let cx = 0; cx < W; cx++) {
            if (cx >= W * 0.28 && cx <= W * 0.72 && cy <= H * 0.78) continue;
            const o = (row + cx) * 4;
            if (px[o + 3] < ALPHA_ON) continue;
            const r = px[o], g = px[o + 1], b = px[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const ch = Math.max(r, g, b) - Math.min(r, g, b);
            if (lum > Math.max(200, domLum + 115) && ch <= 25) {
              px[o + 3] = 0;
            }
          }
        }
      }
      for (let pass = 0; pass < 28; pass++) {
        const toClear = [];
        for (let cy = 0; cy < H; cy++) {
          const row = cy * W;
          for (let cx = 0; cx < W; cx++) {
            const p = row + cx;
            const o = p * 4;
            if (px[o + 3] < ALPHA_ON) continue;
            const nearTrans =
              cx <= 1 || cx >= W - 2 || cy <= 1 || cy >= H - 2 ||
              px[(p - 1) * 4 + 3] < ALPHA_ON ||
              px[(p + 1) * 4 + 3] < ALPHA_ON ||
              px[(p - W) * 4 + 3] < ALPHA_ON ||
              px[(p + W) * 4 + 3] < ALPHA_ON;
            if (!nearTrans) continue;
            const r = px[o], g = px[o + 1], b = px[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const ch = Math.max(r, g, b) - Math.min(r, g, b);
            if (lum > domLum + 36 && ch <= 35) {
              toClear.push(o + 3);
            }
          }
        }
        if (toClear.length === 0) break;
        for (let k = 0; k < toClear.length; k++) px[toClear[k]] = 0;
      }
    }
    for (let cy = 0; cy < H; cy++) {
      const row = cy * W * 4;
      let left = -1;
      let right = -1;
      for (let cx = 0; cx < W; cx++) {
        if (px[row + cx * 4 + 3] >= ALPHA_ON) {
          if (left < 0) left = cx;
          right = cx;
        }
      }
      if (left >= 0 && right >= left) {
        const leftSample = Math.min(right, left + 5);
        const rightSample = Math.max(left, right - 5);
        const lOff = row + leftSample * 4;
        const rOff = row + rightSample * 4;
        const [lR, lG, lB] = px[lOff + 3] >= ALPHA_ON
          ? sanitizeEdgeSample(px[lOff], px[lOff + 1], px[lOff + 2])
          : [domR, domG, domB];
        const [rR, rG, rB] = px[rOff + 3] >= ALPHA_ON
          ? sanitizeEdgeSample(px[rOff], px[rOff + 1], px[rOff + 2])
          : [domR, domG, domB];

        for (let cx = 0; cx < W; cx++) {
          const o = row + cx * 4;
          if (px[o + 3] < ALPHA_ON) {
            if (cx < left) {
              const noise = ((cx * 13 + cy * 7) % 3) - 1;
              px[o] = Math.max(0, Math.min(255, lR + noise));
              px[o + 1] = Math.max(0, Math.min(255, lG + noise));
              px[o + 2] = Math.max(0, Math.min(255, lB + noise));
              px[o + 3] = 255;
            } else if (cx > right) {
              const noise = ((cx * 13 + cy * 7) % 3) - 1;
              px[o] = Math.max(0, Math.min(255, rR + noise));
              px[o + 1] = Math.max(0, Math.min(255, rG + noise));
              px[o + 2] = Math.max(0, Math.min(255, rB + noise));
              px[o + 3] = 255;
            } else {
              let gL = cx - 1;
              while (gL > left && px[row + gL * 4 + 3] < ALPHA_ON) gL--;
              let gR = cx + 1;
              while (gR < right && px[row + gR * 4 + 3] < ALPHA_ON) gR++;
              const gapWidth = gR - gL - 1;
              const isNeckKeyhole =
                cy < H * 0.28 &&
                gapWidth >= Math.max(6, Math.floor(W * 0.06)) &&
                gL >= W * 0.25 &&
                gR <= W * 0.75;
              if (isNeckKeyhole) {
                px[o + 3] = 0;
              } else {
                const sampleInset = Math.min(10, Math.max(5, Math.floor(gapWidth * 0.16)));
                const sL = Math.max(left, gL - sampleInset);
                const sR = Math.min(right, gR + sampleInset);
                const oGL = row + sL * 4;
                const oGR = row + sR * 4;
                const tGap = (cx - gL) / Math.max(1, gR - gL);

                const [colLR, colLG, colLB] = px[oGL + 3] >= ALPHA_ON
                  ? sanitizeEdgeSample(px[oGL], px[oGL + 1], px[oGL + 2])
                  : [domR, domG, domB];
                const [colRR, colRG, colRB] = px[oGR + 3] >= ALPHA_ON
                  ? sanitizeEdgeSample(px[oGR], px[oGR + 1], px[oGR + 2])
                  : [domR, domG, domB];

                const baseR = colLR * (1 - tGap) + colRR * tGap;
                const baseG = colLG * (1 - tGap) + colRG * tGap;
                const baseB = colLB * (1 - tGap) + colRB * tGap;

                const grainSampleX = (cx % 2 === 0) ? sL : sR;
                const oGrain = row + grainSampleX * 4;
                const midRefR = (colLR + colRR) * 0.5;
                const midRefG = (colLG + colRG) * 0.5;
                const midRefB = (colLB + colRB) * 0.5;
                const [grR, grG, grB] = px[oGrain + 3] >= ALPHA_ON
                  ? sanitizeEdgeSample(px[oGrain], px[oGrain + 1], px[oGrain + 2])
                  : [midRefR, midRefG, midRefB];
                const grainDeltaR = (grR - midRefR) * 0.45;
                const grainDeltaG = (grG - midRefG) * 0.45;
                const grainDeltaB = (grB - midRefB) * 0.45;

                px[o] = Math.max(0, Math.min(255, Math.round(baseR + grainDeltaR)));
                px[o + 1] = Math.max(0, Math.min(255, Math.round(baseG + grainDeltaG)));
                px[o + 2] = Math.max(0, Math.min(255, Math.round(baseB + grainDeltaB)));
                px[o + 3] = 255;
              }
            }
          }
        }
      } else {
        for (let cx = 0; cx < W; cx++) {
          const o = row + cx * 4;
          px[o] = domR;
          px[o + 1] = domG;
          px[o + 2] = domB;
          px[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('fillTransparentCanvasMargins failed:', err);
  }
}

export function buildBackTexture({ frontCanvas, backCanvas, dominantColor = '#FFFFFF' }) {
  if (!frontCanvas || typeof document === 'undefined') return null;
  const W = frontCanvas.width;
  const H = frontCanvas.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d', { willReadFrequently: true });

  if (backCanvas) {
    // When a verified back photograph is available from the item group, render the back
    // photograph directly onto the back sheet so its authentic neckline/keyhole and pattern
    // are preserved without front-photo bleed-through.
    ctx.drawImage(backCanvas, 0, 0, W, H);
  } else {
    // Synthesize back fabric excluding front-only graphics, prints, pockets, zippers
    const cleanBackCanvas = synthesizeBackFabricCanvas(frontCanvas, dominantColor);
    ctx.drawImage(cleanBackCanvas, 0, 0);
  }
  // Fill transparent margins of the back canvas with clean edge fabric so UV boundaries never sample transparency
  fillTransparentCanvasMargins(out, dominantColor);

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

async function fetchAndCropTexture(url, patterned = false) {
  if (!url || typeof document === 'undefined') return null;
  const cacheKey = `${url}::${patterned ? 'pat' : 'sol'}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
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
  let dominantColor = '#CBD5E1';
  let isLightBg = false;
  let bgR = 255, bgG = 255, bgB = 255;
  let bgMask = null;

  let isMultiTonePattern = false;
  if (imgData) {
    const data = imgData.data;

    // Check if the image already has a transparent cutout border (e.g. rembg PNG)
    let transparentBorderCount = 0;
    let borderTotal = 0;
    for (let x = 0; x < w; x++) {
      borderTotal += 2;
      if (data[(x) * 4 + 3] < 40) transparentBorderCount++;
      if (data[((h - 1) * w + x) * 4 + 3] < 40) transparentBorderCount++;
    }
    for (let y = 1; y < h - 1; y++) {
      borderTotal += 2;
      if (data[(y * w) * 4 + 3] < 40) transparentBorderCount++;
      if (data[(y * w + (w - 1)) * 4 + 3] < 40) transparentBorderCount++;
    }
    const alreadyCutout = borderTotal > 0 && (transparentBorderCount / borderTotal) > 0.25;

    // Detect solid/white background from 4 image corners only when not already a transparent cutout
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
    if (cCount > 0 && !alreadyCutout) {
      bgR = crSum / cCount;
      bgG = cgSum / cCount;
      bgB = cbSum / cCount;
      isLightBg = bgR > 220 && bgG > 220 && bgB > 220;
    }

    // Background mask: fully transparent pixels are always background; near-white
    // catalog backdrop is only background when it is connected to the image border
    // and closely matches the studio backdrop (so cream/white zebra stripes or white shirts stay intact).
    const isLightPixel = (o) => {
      const r = data[o], g = data[o + 1], b = data[o + 2];
      if (Math.hypot(r - bgR, g - bgG, b - bgB) < 22 && r > 238 && g > 238 && b > 238) return true;
      return r > 246 && g > 246 && b > 246;
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

    // Connected-component island filter: remove tiny detached border shards / floating dust
    // while keeping all garment pattern components (e.g. zebra stripes, color blocks).
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
        const minKeepSize = Math.max(16, Math.floor(maxCompSize * 0.015));
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

    // Measure interior luminance distribution to distinguish solid dark garments
    // from high-contrast multi-tone patterns (zebra print, black/white stripes, checks, florals).
    try {
      let coreR = 0, coreG = 0, coreB = 0, coreCount = 0;
      let sumLum = 0, sumLumSq = 0, lightCount = 0, darkCount = 0;
      const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
      for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8); y += step) {
        for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x += step) {
          const p = y * w + x;
          if (!bgMask[p] && data[p * 4 + 3] >= 200) {
            const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            coreR += r;
            coreG += g;
            coreB += b;
            sumLum += lum;
            sumLumSq += lum * lum;
            if (lum >= 175) lightCount++;
            if (lum <= 95) darkCount++;
            coreCount++;
          }
        }
      }
      if (coreCount > 20) {
        coreR /= coreCount;
        coreG /= coreCount;
        coreB /= coreCount;
        const coreLum = sumLum / coreCount;
        const lightCoreFrac = lightCount / coreCount;
        const darkCoreFrac = darkCount / coreCount;

        // Count alternating light<->dark fabric transitions per interior scanline so solid dark blazers
        // or leather boots with a single neck-label/collar pocket NEVER misclassify as zebra/patterned fabric!
        let totalTransitions = 0;
        let scannedRows = 0;
        const rowStride = Math.max(2, Math.floor((h * 0.5) / 18));
        for (let ry = Math.floor(h * 0.28); ry < Math.floor(h * 0.78); ry += rowStride) {
          let prevTone = 0;
          let rowTrans = 0;
          let rowOpaque = 0;
          for (let rx = Math.floor(w * 0.22); rx < Math.floor(w * 0.78); rx += 2) {
            const rp = ry * w + rx;
            if (!bgMask[rp] && data[rp * 4 + 3] >= 200) {
              rowOpaque++;
              const rLum = 0.299 * data[rp * 4] + 0.587 * data[rp * 4 + 1] + 0.114 * data[rp * 4 + 2];
              const tone = rLum >= 165 ? 1 : (rLum <= 105 ? -1 : 0);
              if (tone !== 0) {
                if (prevTone !== 0 && tone !== prevTone) rowTrans++;
                prevTone = tone;
              }
            }
          }
          if (rowOpaque >= 12) {
            totalTransitions += rowTrans;
            scannedRows++;
          }
        }
        const altTransitionsPerRow = scannedRows > 0 ? (totalTransitions / scannedRows) : 0;

        isMultiTonePattern =
          Boolean(patterned) ||
          (altTransitionsPerRow >= 3.2 && lightCoreFrac >= 0.14 && darkCoreFrac >= 0.14);

        const coreChroma = Math.max(coreR, coreG, coreB) - Math.min(coreR, coreG, coreB);
        // Strip light-gray/white studio background pockets & cast drop-shadows on solid non-white garments
        // (NEVER on zebra print, striped, or multi-tone patterned garments where white is part of the fabric!)
        if (!isMultiTonePattern && (coreLum < 180 || coreChroma > 24)) {
          const isStudioFringe = (p) => {
            const o = p * 4;
            const r = data[o], g = data[o + 1], b = data[o + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            const distCore = Math.hypot(r - coreR, g - coreG, b - coreB);
            return (
              (lum >= 200 && chroma <= 36 && distCore > 44) ||
              (lum >= Math.max(106, coreLum + 36) && chroma <= 30 && distCore > 40)
            );
          };
          const fQueue = new Int32Array(w * h);
          let fHead = 0;
          let fTail = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const p = y * w + x;
              if (bgMask[p]) continue;
              let touchesBg = x <= 1 || x >= w - 2 || y <= 1 || y >= h - 2;
              if (!touchesBg) {
                for (let dy = -2; dy <= 2 && !touchesBg; dy++) {
                  const ny = y + dy;
                  if (ny < 0 || ny >= h) continue;
                  for (let dx = -2; dx <= 2; dx++) {
                    const nx = x + dx;
                    if (nx >= 0 && nx < w && bgMask[ny * w + nx]) {
                      touchesBg = true;
                      break;
                    }
                  }
                }
              }
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
            for (let dy = -1; dy <= 1; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                const np = ny * w + nx;
                if (!bgMask[np] && isStudioFringe(np)) {
                  bgMask[np] = 1;
                  fQueue[fTail++] = np;
                }
              }
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
    // Skip for multi-tone/high-contrast patterns (zebra print, bold stripes, plaid) where
    // an outer white stripe next to an inner black stripe is part of the pattern, not a studio rim!
    if (!isMultiTonePattern) {
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

      // 3b. Per-column vertical bottom & top drop-shadow despill:
      // Studio catalog cutouts (e.g. blazers, shirts) often retain a soft gray cast shadow
      // hanging beneath the bottom hem and sleeve cuffs, which horizontal row-despill cannot see.
      for (let x = 0; x < cropW; x++) {
        let y = 0;
        while (y < cropH) {
          while (y < cropH && eData[(y * cropW + x) * 4 + 3] < 110) y++;
          if (y >= cropH) break;
          const aY = y;
          while (y < cropH && eData[(y * cropW + x) * 4 + 3] >= 110) y++;
          const bY = y - 1;
          const spanY = bY - aY + 1;
          if (spanY < 16) continue;

          const d0Y = Math.max(3, Math.min(16, Math.floor(spanY * 0.14)));
          const d1Y = Math.max(d0Y + 2, Math.min(28, Math.floor(spanY * 0.28)));

          // Top interior reference
          let tR = 0, tG = 0, tB = 0, tN = 0;
          for (let cy = aY + d0Y; cy <= Math.min(bY, aY + d1Y); cy++) {
            const o = (cy * cropW + x) * 4;
            if (eData[o + 3] >= 180) {
              tR += eData[o]; tG += eData[o + 1]; tB += eData[o + 2]; tN++;
            }
          }
          // Bottom interior reference
          let bR = 0, bG = 0, bB = 0, bN = 0;
          for (let cy = Math.max(aY, bY - d1Y); cy <= bY - d0Y; cy++) {
            const o = (cy * cropW + x) * 4;
            if (eData[o + 3] >= 180) {
              bR += eData[o]; bG += eData[o + 1]; bB += eData[o + 2]; bN++;
            }
          }

          let newAY = aY;
          if (tN > 0) {
            tR /= tN; tG /= tN; tB /= tN;
            const tLum = 0.299 * tR + 0.587 * tG + 0.114 * tB;
            const tChroma = Math.max(tR, tG, tB) - Math.min(tR, tG, tB);
            for (let cy = aY; cy < aY + d0Y; cy++) {
              const o = (cy * cropW + x) * 4;
              const r = eData[o], g = eData[o + 1], bl = eData[o + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
              const ch = Math.max(r, g, bl) - Math.min(r, g, bl);
              if (lum - tLum > 22 && ch <= tChroma + 14) {
                eData[o + 3] = 0;
                newAY = cy + 1;
              } else {
                break;
              }
            }
            for (let cy = newAY; cy <= Math.min(bY, newAY + 3); cy++) {
              const o = (cy * cropW + x) * 4;
              const lum = 0.299 * eData[o] + 0.587 * eData[o + 1] + 0.114 * eData[o + 2];
              if (lum - tLum > 14) {
                eData[o] = Math.round(tR);
                eData[o + 1] = Math.round(tG);
                eData[o + 2] = Math.round(tB);
              }
            }
          }

          let newBY = bY;
          if (bN > 0) {
            bR /= bN; bG /= bN; bB /= bN;
            const bLum = 0.299 * bR + 0.587 * bG + 0.114 * bB;
            const bChroma = Math.max(bR, bG, bB) - Math.min(bR, bG, bB);
            for (let cy = bY; cy > bY - d0Y; cy--) {
              const o = (cy * cropW + x) * 4;
              const r = eData[o], g = eData[o + 1], bl = eData[o + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
              const ch = Math.max(r, g, bl) - Math.min(r, g, bl);
              if (lum - bLum > 22 && ch <= bChroma + 14) {
                eData[o + 3] = 0;
                newBY = cy - 1;
              } else {
                break;
              }
            }
            for (let cy = Math.max(newAY, newBY - 4); cy <= newBY; cy++) {
              const o = (cy * cropW + x) * 4;
              const lum = 0.299 * eData[o] + 0.587 * eData[o + 1] + 0.114 * eData[o + 2];
              if (lum - bLum > 14) {
                eData[o] = Math.round(bR);
                eData[o + 1] = Math.round(bG);
                eData[o + 2] = Math.round(bB);
              }
            }
          }
        }
      }
    }

    // 4. Tight post-despill bounding box trim so cleared drop-shadow bands never leave empty bottom/side stripes
    cropCtx.putImageData(cleanCropImgData, 0, 0);
    let tightMinX = cropW, tightMaxX = -1, tightMinY = cropH, tightMaxY = -1;
    for (let cy = 0; cy < cropH; cy++) {
      for (let cx = 0; cx < cropW; cx++) {
        if (eData[(cy * cropW + cx) * 4 + 3] >= 120) {
          if (cx < tightMinX) tightMinX = cx;
          if (cx > tightMaxX) tightMaxX = cx;
          if (cy < tightMinY) tightMinY = cy;
          if (cy > tightMaxY) tightMaxY = cy;
        }
      }
    }
    if (
      tightMaxX > tightMinX &&
      tightMaxY > tightMinY &&
      (tightMinX > 0 || tightMinY > 0 || tightMaxX < cropW - 1 || tightMaxY < cropH - 1)
    ) {
      const tw = tightMaxX - tightMinX + 1;
      const th = tightMaxY - tightMinY + 1;
      const tmp = document.createElement('canvas');
      tmp.width = tw;
      tmp.height = th;
      tmp.getContext('2d').drawImage(cropCanvas, tightMinX, tightMinY, tw, th, 0, 0, tw, th);
      cropCanvas.width = tw;
      cropCanvas.height = th;
      cropCtx.drawImage(tmp, 0, 0);
      cleanCropImgData = cropCtx.getImageData(0, 0, tw, th);
    }
  } catch {}

  const finalCropW = cropCanvas.width;
  const finalCropH = cropCanvas.height;

  const texture = new THREE.CanvasTexture(cropCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const aspect = finalCropW / finalCropH;
  const hasSleeves = aspect > 0.80;

  let solidU = 0.5;
  let solidV = 0.5;
  // Footwear photo layout: locate each shoe silhouette (column runs of opaque pixels)
  // so every foot samples only inside its own shoe in the photo.
  const effW = finalCropW;
  const effH = finalCropH;
  const shoeLayout = { mode: aspect > 1.25 ? 'side' : 'top', toeLeft: true, boxes: null, box: null };
  try {
    const layoutData = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, effW, effH).data;
    const isOpaque = (o) => {
      const nearWhite = layoutData[o] > 238 && layoutData[o + 1] > 238 && layoutData[o + 2] > 238;
      return layoutData[o + 3] > 40 && !nearWhite;
    };
    const colCount = new Array(effW).fill(0);
    for (let cy = 0; cy < effH; cy++) {
      const row = cy * effW * 4;
      for (let cx = 0; cx < effW; cx++) {
        if (isOpaque(row + cx * 4)) colCount[cx]++;
      }
    }
    const maxCov = Math.max(1, ...colCount);
    const runs = [];
    let runStart = -1;
    for (let cx = 0; cx <= effW; cx++) {
      const on = cx < effW && colCount[cx] > maxCov * 0.06;
      if (on && runStart < 0) runStart = cx;
      if (!on && runStart >= 0) {
        runs.push([runStart, cx - 1]);
        runStart = -1;
      }
    }
    // Merge tiny runs into neighbours, keep the substantial ones
    let big = runs.filter(([r0, r1]) => r1 - r0 + 1 >= effW * 0.12);

    // If only one wide run was detected, check if it actually contains a pair of shoes
    // separated by a coverage valley in the middle third of the image
    if (big.length === 1 && (big[0][1] - big[0][0] + 1) >= effW * 0.45) {
      const [rStart, rEnd] = big[0];
      const midMin = Math.max(rStart + Math.floor((rEnd - rStart) * 0.30), Math.floor(effW * 0.35));
      const midMax = Math.min(rStart + Math.floor((rEnd - rStart) * 0.70), Math.floor(effW * 0.65));
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
      let r0 = effH;
      let r1 = -1;
      const rowWidths = new Array(effH).fill(0);
      for (let cy = 0; cy < effH; cy++) {
        const row = cy * effW * 4;
        let minX = effW;
        let maxX = -1;
        for (let cx = c0; cx <= c1; cx++) {
          if (isOpaque(row + cx * 4)) {
            if (cy < r0) r0 = cy;
            if (cy > r1) r1 = cy;
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
          }
        }
        if (maxX >= minX) rowWidths[cy] = maxX - minX + 1;
      }
      if (r1 < 0) { r0 = 0; r1 = effH - 1; }
      const bh = Math.max(1, r1 - r0 + 1);
      // Compare forefoot vs heel width: the ball of the foot is wider than the heel.
      let upperW = 0;
      let upperN = 0;
      let lowerW = 0;
      let lowerN = 0;
      for (let cy = r0 + Math.floor(bh * 0.16); cy <= r0 + Math.floor(bh * 0.44); cy++) {
        if (rowWidths[cy] > 0) { upperW += rowWidths[cy]; upperN++; }
      }
      for (let cy = r0 + Math.floor(bh * 0.56); cy <= r0 + Math.floor(bh * 0.84); cy++) {
        if (rowWidths[cy] > 0) { lowerW += rowWidths[cy]; lowerN++; }
      }
      const avgUpper = upperN > 0 ? upperW / upperN : 0;
      const avgLower = lowerN > 0 ? lowerW / lowerN : 0;
      const toeUp = avgUpper >= avgLower * 0.96;
      return {
        u0: c0 / effW,
        u1: (c1 + 1) / effW,
        v0: 1 - (r1 + 1) / effH,
        v1: 1 - r0 / effH,
        toeUp,
      };
    };
    if (big.length >= 2) {
      const sorted = big.sort((p1, p2) => (p2[1] - p2[0]) - (p1[1] - p1[0])).slice(0, 2).sort((p1, p2) => p1[0] - p2[0]);
      shoeLayout.mode = 'pair';
      shoeLayout.boxes = sorted.map(boxFor);
    } else {
      const run = big[0] || [0, effW - 1];
      const box = boxFor(run);
      shoeLayout.box = box;
      const bw = (box.u1 - box.u0) * effW;
      const bh = (box.v1 - box.v0) * effH;
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

    // Analyze top-down shoe box for T-strap / thong center strap & closed heel cup
    const refBox = shoeLayout.boxes?.[0] || shoeLayout.box;
    if (refBox && (shoeLayout.mode === 'pair' || shoeLayout.mode === 'top')) {
      const bx0 = Math.floor(refBox.u0 * effW);
      const bx1 = Math.min(effW - 1, Math.ceil(refBox.u1 * effW) - 1);
      const by0 = Math.floor((1 - refBox.v1) * effH);
      const by1 = Math.min(effH - 1, Math.ceil((1 - refBox.v0) * effH) - 1);
      const bw = Math.max(1, bx1 - bx0 + 1);
      const bh = Math.max(1, by1 - by0 + 1);
      const toeUp = refBox.toeUp !== false;
      const sampleMean = (xA, xB, yA, yB) => {
        let sr = 0, sg = 0, sb = 0, cnt = 0;
        const xStart = bx0 + Math.floor(bw * xA);
        const xEnd = bx0 + Math.floor(bw * xB);
        const yStart = by0 + Math.floor(bh * yA);
        const yEnd = by0 + Math.floor(bh * yB);
        for (let cy = yStart; cy <= yEnd; cy += 2) {
          const row = cy * effW * 4;
          for (let cx = xStart; cx <= xEnd; cx += 2) {
            const o = row + cx * 4;
            if (isOpaque(o)) {
              sr += layoutData[o];
              sg += layoutData[o + 1];
              sb += layoutData[o + 2];
              cnt++;
            }
          }
        }
        return cnt > 0 ? [sr / cnt, sg / cnt, sb / cnt, cnt] : null;
      };
      const foreY0 = toeUp ? 0.18 : 0.55;
      const foreY1 = toeUp ? 0.45 : 0.82;
      const centerCol = sampleMean(0.45, 0.55, foreY0, foreY1);
      const leftBed = sampleMean(0.22, 0.34, foreY0, foreY1);
      const rightBed = sampleMean(0.66, 0.78, foreY0, foreY1);
      if (centerCol && leftBed && rightBed) {
        const bedR = 0.5 * (leftBed[0] + rightBed[0]);
        const bedG = 0.5 * (leftBed[1] + rightBed[1]);
        const bedB = 0.5 * (leftBed[2] + rightBed[2]);
        const centerDiff = Math.hypot(centerCol[0] - bedR, centerCol[1] - bedG, centerCol[2] - bedB);
        const sideDiff = Math.hypot(leftBed[0] - rightBed[0], leftBed[1] - rightBed[1], leftBed[2] - rightBed[2]);
        if (centerDiff > 16 && centerDiff > sideDiff * 1.4) {
          shoeLayout.sandalStyle = 'tstrap';
        }
      }
      const heelY0 = toeUp ? 0.78 : 0.04;
      const heelY1 = toeUp ? 0.94 : 0.20;
      const heelRimL = sampleMean(0.16, 0.28, heelY0, heelY1);
      const heelRimR = sampleMean(0.72, 0.84, heelY0, heelY1);
      const heelIn = sampleMean(0.40, 0.60, heelY0, heelY1);
      if (heelRimL && heelRimR && heelIn) {
        const rimLum = 0.5 * ((heelRimL[0] + heelRimL[1] + heelRimL[2]) + (heelRimR[0] + heelRimR[1] + heelRimR[2])) / 3;
        const inLum = (heelIn[0] + heelIn[1] + heelIn[2]) / 3;
        if (Math.abs(rimLum - inLum) > 12) {
          shoeLayout.hasHeelCup = true;
        }
      }
    }
  } catch {
    // Keep default layout
  }

  try {
    const cData = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, effW, effH).data;
    let sumOx = 0;
    let sumOy = 0;
    let countO = 0;
    const stride = Math.max(1, Math.floor(Math.min(effW, effH) / 64));
    for (let cy = 0; cy < effH; cy += stride) {
      const row = cy * effW * 4;
      for (let cx = 0; cx < effW; cx += stride) {
        if (cData[row + cx * 4 + 3] > 240) {
          sumOx += cx;
          sumOy += cy;
          countO++;
        }
      }
    }
    if (countO > 0) {
      let bestX = Math.round(sumOx / countO);
      let bestY = Math.round(sumOy / countO);
      const checkIdx = (Math.min(effH - 1, Math.max(0, bestY)) * effW + Math.min(effW - 1, Math.max(0, bestX))) * 4;
      if (cData[checkIdx + 3] <= 240) {
        // Centroid landed in an empty gap (e.g. between a pair of shoes or inside a neckline):
        // snap to the center of the first detected shoe box or nearest genuinely interior opaque pixel.
        if (shoeLayout.boxes?.length) {
          const b0 = shoeLayout.boxes[0];
          bestX = Math.round(((b0.u0 + b0.u1) * 0.5) * effW);
          bestY = Math.round((1.0 - (b0.v0 + b0.v1) * 0.5) * effH);
        } else {
          let bestDist = Infinity;
          for (let cy = 4; cy < effH - 4; cy += stride) {
            const row = cy * effW * 4;
            for (let cx = 4; cx < effW - 4; cx += stride) {
              if (cData[row + cx * 4 + 3] > 245) {
                const d2 = (cx - bestX) * (cx - bestX) + (cy - bestY) * (cy - bestY);
                if (d2 < bestDist) {
                  bestDist = d2;
                  bestX = cx;
                  bestY = cy;
                }
              }
            }
          }
        }
      }
      solidU = Math.max(0.02, Math.min(0.98, bestX / effW));
      solidV = Math.max(0.02, Math.min(0.98, 1.0 - (bestY / effH)));
    }
  } catch {
    solidU = 0.5;
    solidV = 0.5;
  }

  // Back sheet texture: synthesize FIRST from the pristine un-padded cropCanvas
  // so margins are genuinely transparent and flank analysis never samples filled margin bands!
  let backTexture = null;
  try {
    backTexture = buildBackTexture({ frontCanvas: cropCanvas, backCanvas: null, dominantColor });
  } catch {
    backTexture = null;
  }

  // Gap-free variant for clothing shells:
  // Fills interior holes (armhole cutouts, inner wedges) and transparent margins
  // with clean edge fabric color and weave noise. NEVER mirrors interior graphics into margins!
  let filledTexture = null;
  let fillCanvas = null;
  try {
    fillCanvas = document.createElement('canvas');
    fillCanvas.width = effW;
    fillCanvas.height = effH;
    const fctx = fillCanvas.getContext('2d', { willReadFrequently: true });
    fctx.drawImage(cropCanvas, 0, 0);
    fillTransparentCanvasMargins(fillCanvas, dominantColor, isMultiTonePattern);

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

  // Opaque variant (transparent pixels filled seamlessly with edge leather/fabric colour)
  const opaqueCanvas = document.createElement('canvas');
  opaqueCanvas.width = effW;
  opaqueCanvas.height = effH;
  const opaqueCtx = opaqueCanvas.getContext('2d', { willReadFrequently: true });
  opaqueCtx.drawImage(cropCanvas, 0, 0);
  fillTransparentCanvasMargins(opaqueCanvas, dominantColor, isMultiTonePattern);
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
    const sData = cleanCropImgData ? cleanCropImgData.data : cropCtx.getImageData(0, 0, effW, effH).data;
    const alpha = new Uint8Array(effW * effH);
    for (let p = 0; p < alpha.length; p++) alpha[p] = sData[p * 4 + 3];

    const { nx, ny } = chooseGridResolution(aspect);
    shellMask = {
      mask: resampleAlphaMask(alpha, effW, effH, nx, ny),
      runsByRow: extractRowRuns(alpha, effW, effH, nx, ny),
      nx,
      ny,
    };
    canvasStats = computeCanvasStats(cropCanvas);

    // Gently mirror-pad edge RGB outward by a few pixels AFTER mask & backTexture extraction
    // so UV boundary vertices never sample transparent edge pixels.
    mirrorPadEdges(cropCanvas, 4);
    dilateCanvasEdges(cropCanvas, 2);
    texture.needsUpdate = true;
  } catch {
    shellMask = null;
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
    fillCanvas: fillCanvas || cropCanvas,
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

  setTextureCache(cacheKey, res);
  return res;
}

function useGarmentTexture(url, extraUrls = [], patterned = false) {
  const [data, setData] = useState({
    texture: null,
    opaqueTexture: null,
    filledTexture: null,
    dominantColor: '#CBD5E1',
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
        dominantColor: '#CBD5E1',
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
      return undefined;
    }

    fetchAndCropTexture(url, patterned)
      .then(async (res) => {
        if (!mounted) return;
        if (!res) throw new Error('fetchAndCropTexture returned null');
        setData({
          ...res,
          backTexture: res.backTexture || null,
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
            const other = await fetchAndCropTexture(u, patterned);
            if (!other?.canvas) continue;
            const viewRole = classifyGroupView(res.canvasStats, other.canvasStats, u);
            if (!backCanvas && (viewRole === 'back' || isConsistentView(res.canvasStats, other.canvasStats))) {
              backCanvas = other.fillCanvas || other.canvas;
            } else if (!sideProfile && viewRole === 'side' && other.shellMask) {
              sideProfile = extractSideProfile(other.shellMask, other.aspect, res.aspect);
            }
          } catch {
            // ignore unusable view
          }
        }
        if (!mounted) return;
        if (!backCanvas && !sideProfile) return;
        const nextBackTexture = backCanvas
          ? buildBackTexture({
              frontCanvas: res.canvas,
              backCanvas,
              dominantColor: res.dominantColor,
            })
          : null;
        setData((prev) => (prev.texture === res.texture
          ? {
              ...prev,
              backTexture: nextBackTexture || prev.backTexture,
              backSource: backCanvas ? 'photo' : prev.backSource,
              sideProfile: sideProfile || prev.sideProfile,
            }
          : prev));
      })
      .catch(() => {
        // Fallback standard texture loader
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(
          url,
          (tex) => {
            if (!mounted) return;
            tex.colorSpace = THREE.SRGBColorSpace;
            setData({
              texture: tex,
              opaqueTexture: tex,
              filledTexture: tex,
              dominantColor: '#CBD5E1',
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
          },
          undefined,
          (err) => {
            if (!mounted) return;
            console.warn('[useGarmentTexture] TextureLoader fallback failed for', url, err);
            setData((prev) => ({
              ...prev,
              ready: true,
              texture: null,
            }));
          }
        );
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
    text.includes('corset') ||
    text.includes('bustier') ||
    text.includes('bandeau') ||
    text.includes('sweetheart') ||
    text.includes('גופי') ||
    text.includes('גופיה') ||
    text.includes('גופייה') ||
    text.includes('גופית') ||
    text.includes('וסט') ||
    text.includes('סטרפלס') ||
    text.includes('קורסט') ||
    text.includes('מחוך') ||
    text.includes('בוסטייה') ||
    text.includes('בנדו') ||
    text.includes('טיוב') ||
    text.includes('ללא שרוולים') ||
    text.includes('sin mangas') ||
    text.includes('sans manches') ||
    text.includes('ärmellos') ||
    text.includes('بدון أكمام');

  if (isExplicitSleeveless) {
    return { type: 'sleeveless', factor: 0.0 };
  }

  // 1b. Explicit short sleeve / T-shirt / polo keywords (prioritize before generic shirt)
  const isExplicitShort =
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

  const hasExplicitLongTokens =
    text.includes('long sleeve') ||
    text.includes('long-sleeve') ||
    text.includes('long_sleeve') ||
    text.includes('long-sleeved') ||
    text.includes('long sleeved') ||
    text.includes('long_sleeved') ||
    text.includes('longsleeve') ||
    text.includes('שרוול ארוך') ||
    text.includes('שרוולים ארוכים') ||
    text.includes('manga larga') ||
    text.includes('manches longues') ||
    text.includes('langarm') ||
    text.includes('كم طويل');

  if (isExplicitShort && !hasExplicitLongTokens) {
    return { type: 'short', factor: 0.50 };
  }

  // 2. Long sleeve keywords / Outerwear / Knitwear (higher precedence than generic category keywords)
  const isExplicitLong =
    rawSlot === 'outerwear' ||
    hasExplicitLongTokens ||
    text.includes('sweater') ||
    text.includes('pullover') ||
    text.includes('cardigan') ||
    text.includes('blazer') ||
    text.includes('coat') ||
    text.includes('jacket') ||
    text.includes('hoodie') ||
    text.includes('sweatshirt') ||
    (!text.includes('short') && !text.includes('polo') && !text.includes('פולו') && !text.includes('קצר') && !text.includes('cort') && !text.includes('kurz') && (
      text.includes('button-down') ||
      text.includes('button down') ||
      text.includes('button-up') ||
      text.includes('button up') ||
      text.includes('oxford') ||
      text.includes('blouse') ||
      text.includes('מכופתרת') ||
      text.includes('חולצה מכופתרת') ||
      text.includes('חולצה אלגנטית')
    )) ||
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

  // 3. Three-quarter sleeve keywords
  const isThreeQuarter =
    text.includes('3/4') ||
    text.includes('three-quarter') ||
    text.includes('three quarter') ||
    text.includes('שרוול 3/4') ||
    text.includes('שרוול שלושת רבעי');

  if (isThreeQuarter) {
    return { type: 'three_quarter', factor: 0.65 };
  }

  // 4. Cap sleeve keywords
  const isCapSleeve =
    text.includes('cap sleeve') ||
    text.includes('cap-sleeve') ||
    text.includes('שרוול כנף') ||
    text.includes('שרוול קפון');

  if (isCapSleeve) {
    return { type: 'cap', factor: 0.18 };
  }

  // 5. Short sleeve / T-shirt / polo keywords
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
    return { type: 'short', factor: 0.50 };
  }

  // 6. Silhouette aspect ratio fallback
  if (aspect < 0.78) {
    return { type: 'sleeveless', factor: 0.0 };
  } else if (aspect < 1.20) {
    return { type: 'short', factor: 0.50 };
  } else {
    return { type: 'long', factor: 1.0 };
  }
}

// ─── Neckline & Collar Style Resolution ───

/**
 * Detects neckline / collar style from garment text, attributes, and slot.
 * Supported types:
 *  - 'strapless': Strapless, tube, corset, bustier, sweetheart, bandeau
 *  - 'v_neck': V-neck, plunging neck
 *  - 'scoop': Scoop neck, low round neck, U-neck
 *  - 'square': Square neck
 *  - 'boat_neck': Boatneck, off-shoulder, bateau, bardot
 *  - 'halter': Halter neck
 *  - 'high_neck': Turtleneck, mock neck, funnel neck, roll neck
 *  - 'collared': Collared shirt, button-down, polo, mandarin
 *  - 'crew_neck': Round crew neck
 *  - 'standard': Default
 */
export function detectNecklineStyle({ garmentText = '', garment = null } = {}) {
  const metaText = garment ? resolveGarmentMetadataText(garment) : '';
  const text = `${garmentText} ${metaText} ${garment?.neckline || ''}`.toLowerCase();

  // 1. Strapless / Tube / Corset / Bustier / Sweetheart
  if (/(?:strapless|tube|bandeau|corset|bustier|sweetheart|סטרפלס|בנדו|קורסט|מחוך|בוסטייה|טיוב|sans bretelles|trägerlos|palabra de honor|بدון حمالات|كورسيه)/i.test(text)) {
    return 'strapless';
  }
  // 2. V-Neck / Plunge
  if (/(?:v[-_\s]?neck|vneck|plunge|פתח וי|מחשוף וי|צווארון וי|v-ausschnitt|col en v|cuello en v)/i.test(text)) {
    return 'v_neck';
  }
  // 3. Scoop Neck / U-Neck / Low Plunging Round (excludes standard crew neck)
  if (/(?:scoop|u[-_\s]?neck|low round|מחשוף עגול עמוק|מחשוף עגול נמוך|צווארון עגול נמוך|decollete|décolleté)/i.test(text)) {
    return 'scoop';
  }
  // 4. Square Neck
  if (/(?:square[-_\s]?neck|square neck|צווארון מרובע|מחשוף מרובע)/i.test(text)) {
    return 'square';
  }
  // 5. Boat Neck / Bateau / Off-Shoulder / Bardot
  if (/(?:boat[-_\s]?neck|boatneck|bateau|off[-_\s]?shoulder|bardot|כתפיים חשופות|צווארון סירה)/i.test(text)) {
    return 'boat_neck';
  }
  // 6. Halter Neck
  if (/(?:halter|קולר|צווארון קולר)/i.test(text)) {
    return 'halter';
  }
  // 7. Turtleneck / High Neck / Mock Neck / Roll Neck
  if (/(?:turtleneck|mock[-_\s]?neck|high[-_\s]?neck|roll neck|funnel|גולף|צווארון גולף|צווארון גבוה)/i.test(text)) {
    return 'high_neck';
  }
  // 8. Crew Neck / Standard Round Neck (checked before generic collared so 'צווארון עגול' never matches 'collared')
  if (/(?:crew[-_\s]?neck|crewneck|round[-_\s]?neck|tee|t-?shirt|טי שירט|טי-שירט|חולצת טי|טישירט|צווארון עגול|פתח עגול|מחשוף עגול|טריקו)/i.test(text)) {
    return 'crew_neck';
  }
  // 9. Collared / Button-down / Polo / Shirt Collar
  if (/(?:button|collared|shirt collar|polo|mandarin|צווארון|מכופתרת|פולו|סיני)/i.test(text)) {
    return 'collared';
  }
  return 'crew_neck';
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
  isTucked = false,
} = {}) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];

  // 1. Torso Shell (wrapping 360° continuously around collar, chest, waist, and hips)
  const ny = 20;
  const nx = 28;
  const yShoulder = isMale ? 1.48 : 1.42;
  const yWaistTop = isMale ? 1.06 : 1.02;
  const effBottom = isTucked ? (isMale ? 1.010 : 0.980) : yBottom;
  const hasAnySleeve = hasSleeves && sleeveFactor > 0.05;

  for (let i = 0; i <= ny; i++) {
    const vNorm = i / ny;
    const y = yTop - vNorm * (yTop - effBottom);
    const slice = getTorsoSlice(y, isMale);

    const effOffset = isTucked && y <= yWaistTop ? 0.004 : layerOffset;
    const uTuck = (isTucked && y <= yWaistTop) ? Math.min(1.0, Math.max(0.0, (yWaistTop - y) / Math.max(0.01, yWaistTop - effBottom))) : 0;
    const scaleRad = 1.0 - (isTucked ? 0.025 * uTuck : 0);
    const rx = (slice.rx + effOffset) * scaleRad;
    const rz = (slice.rz + effOffset) * scaleRad;
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

      // Anatomical bust / chest & belly projection guaranteeing zero penetration
      const bustFactor = Math.max(0, Math.cos(theta * 1.3));
      const bustBulge = (y >= 1.12 && y <= 1.34 && !isMale) ? 0.026 * bustFactor : 0.0;
      const frontCos = Math.pow(Math.max(0, Math.cos(theta)), 0.65);
      const rzFrontEff = ((slice.rzFront || rz) + effOffset) * (uTuck > 0 ? (1.0 - 0.03 * uTuck) : 1.0);
      const rzBackEff = ((slice.rzBack || rz) + effOffset) * (uTuck > 0 ? (1.0 - 0.03 * uTuck) : 1.0);
      const z = isFront
        ? cz + (rzFrontEff + bustBulge) * frontCos
        : cz - (rzBackEff + 0.012) * Math.abs(Math.cos(theta));
      verts.push(x, y, z);

      // Continuous 360° UV projection: front and back views share the same texture and pattern
      // without side-flank UV jumps or tears.
      const uT = uLeft + ((Math.sin(theta) + 1) * 0.5) * (uRight - uLeft);
      uvs.push(Math.max(0.01, Math.min(0.99, uT)), Math.max(0.01, Math.min(0.99, vTex)));
    }
  }

  const frontIndices = [];
  const backIndices = [];

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      const uFracMid = (j + 0.5) / nx;
      const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
      if (Math.cos(thetaMid) >= 0) {
        frontIndices.push(a, c, b, b, c, d);
      } else {
        backIndices.push(a, c, b, b, c, d);
      }
    }
  }

  // 2. Left & Right Sleeves (tailored elliptical contours, continuous shoulder-armscye bridge)
  if (hasAnySleeve) {
    const sides = [-1, 1]; // Left (-X), Right (+X)
    const nySleeve = Math.max(5, Math.round(10 * Math.min(1.0, sleeveFactor * 1.5)));
    const nxSleeve = 16;

    const yArmStart = isMale ? 1.45 : 1.40;
    const fullYArmEnd = isMale ? 1.069 : 0.956;
    const yArmEnd = yArmStart - sleeveFactor * (yArmStart - fullYArmEnd);

    // Seamless shoulder-to-armscye bridge with ZERO void or gap:
    const shoulderRx = (isMale ? 0.205 : 0.185) + layerOffset * 0.4;
    const xArmStart = shoulderRx - 0.005;
    const fullXArmEnd = isMale ? 0.355 : 0.325;
    const xArmEnd = xArmStart + sleeveFactor * (fullXArmEnd - xArmStart);

    const fullZArmEnd = isMale ? 0.012 : 0.009;
    const zArmEnd = 0.020 + sleeveFactor * (fullZArmEnd - 0.020);

    // Slim, tailored sleeve radii (eliminates barrel appearance)
    const rArmStart = 0.054 + Math.min(0.010, layerOffset * 0.3);
    const fullRArmEnd = 0.038 + Math.min(0.008, layerOffset * 0.2);
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
        const rx = rArm * 0.88; // Elliptical tailored cross-section
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
          const uFracMid = (j + 0.5) / nxSleeve;
          const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
          if (Math.cos(thetaMid) >= 0) {
            frontIndices.push(a, c, b, b, c, d);
          } else {
            backIndices.push(a, c, b, b, c, d);
          }
        }
      }

      // Manifold cuff end-cap (sealed cap vertex at cuff center)
      const cuffCenterIdx = verts.length / 3;
      const yCuffCenter = yArmEnd;
      const xCuffCenter = side * xArmEnd;
      const zCuffCenter = zArmEnd;
      verts.push(xCuffCenter, yCuffCenter, zCuffCenter);
      uvs.push(side === 1 ? 0.85 : 0.15, vCuff);

      const cuffRingStart = startIdx + nySleeve * (nxSleeve + 1);
      for (let j = 0; j < nxSleeve; j++) {
        const v0 = cuffRingStart + j;
        const v1 = cuffRingStart + j + 1;
        const uFracMid = (j + 0.5) / nxSleeve;
        const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
        if (Math.cos(thetaMid) >= 0) {
          frontIndices.push(v0, v1, cuffCenterIdx);
        } else {
          backIndices.push(v0, v1, cuffCenterIdx);
        }
      }
    });
  }

  const allIndices = [...frontIndices, ...backIndices];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(allIndices), 1));
  geo.clearGroups();
  geo.addGroup(0, frontIndices.length, 0);
  geo.addGroup(frontIndices.length, backIndices.length, 1);
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

      // Anatomical bust / chest & belly projection
      const bustFactor = Math.max(0, Math.cos(theta * 1.3));
      const bustBulge = (y >= 1.12 && y <= 1.34 && !isMale) ? 0.026 * bustFactor : 0.0;
      const frontCos = Math.pow(Math.max(0, Math.cos(theta)), 0.65);
      const rzFrontEff = (slice.rzFront || rz) + layerOffset;
      const rzBackEff = (slice.rzBack || rz) + layerOffset;
      const z = isFront
        ? cz + (rzFrontEff + bustBulge) * frontCos
        : cz - (rzBackEff + 0.012) * Math.abs(Math.cos(theta));
      verts.push(x, y, z);

      const uT = uLeft + ((Math.sin(theta) + 1) * 0.5) * (uRight - uLeft);
      uvs.push(Math.max(0.01, Math.min(0.99, uT)), Math.max(0.01, Math.min(0.99, vTex)));
    }
  }

  const frontIndices = [];
  const backIndices = [];

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      const uFracMid = (j + 0.5) / nx;
      const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
      if (Math.cos(thetaMid) >= 0) {
        frontIndices.push(a, c, b, b, c, d);
      } else {
        backIndices.push(a, c, b, b, c, d);
      }
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

    const shoulderRx = (isMale ? 0.195 : 0.170) + layerOffset * 0.4;
    const xArmStart = shoulderRx + 0.015;
    const fullXArmEnd = isMale ? 0.355 : 0.325;
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
          const uFracMid = (j + 0.5) / nxSleeve;
          const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
          if (Math.cos(thetaMid) >= 0) {
            frontIndices.push(a, c, b, b, c, d);
          } else {
            backIndices.push(a, c, b, b, c, d);
          }
        }
      }
    });
  }

  const allIndices = [...frontIndices, ...backIndices];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(allIndices), 1));
  geo.clearGroups();
  geo.addGroup(0, frontIndices.length, 0);
  geo.addGroup(frontIndices.length, backIndices.length, 1);
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

    const frontIndices = [];
    const backIndices = [];

    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        const uFracMid = (j + 0.5) / nx;
        const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
        if (Math.cos(thetaMid) >= 0) {
          frontIndices.push(a, c, b, b, c, d);
        } else {
          backIndices.push(a, c, b, b, c, d);
        }
      }
    }

    const allIndices = [...frontIndices, ...backIndices];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(allIndices), 1));
    geo.clearGroups();
    geo.addGroup(0, frontIndices.length, 0);
    geo.addGroup(frontIndices.length, backIndices.length, 1);
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
    const legTopSlice = getLegSlice(yCrotch, isMale);
    const fitOff = Math.max(0.0055, Math.min(layerOffset, 0.012));

    // Smooth convergence across lower pelvis (tPelvis >= 0.65) to match leg top ring
    // Eliminates any lateral or front/back step between pelvis and legs at all viewing angles.
    const legOuterEdge = legTopSlice.cx + legTopSlice.r + fitOff;
    const tBlend = Math.max(0, Math.min(1, (tPelvis - 0.65) / 0.35));
    const sBlend = tBlend * tBlend * (3 - 2 * tBlend);

    const rx = (1 - sBlend) * (sliceTorso.rx + fitOff) + sBlend * legOuterEdge;
    const cz = (1 - sBlend) * sliceTorso.cz + sBlend * legTopSlice.cz;
    const rzFront = (1 - sBlend) * ((sliceTorso.rzFront || sliceTorso.rz) + fitOff) + sBlend * (legTopSlice.rzFront + fitOff);
    const rzBack = (1 - sBlend) * ((sliceTorso.rzBack || sliceTorso.rz) + fitOff) + sBlend * (legTopSlice.rzBack + fitOff);
    const vTex = 0.98 - tPelvis * pelvisTexSpan * 0.94;

    for (let j = 0; j <= nxPelvis; j++) {
      const uFrac = j / nxPelvis;
      const theta = -Math.PI + uFrac * 2 * Math.PI;
      const isFront = Math.cos(theta) >= 0;
      const x = rx * Math.sin(theta);
      // Subtle crotch saddle indentation exclusively at the bottom crotch boundary (tPelvis -> 1)
      const centerT = Math.max(0, 1 - Math.abs(Math.sin(theta)) / 0.28);
      const saddlePinch = Math.pow(tPelvis, 2.5) * centerT * 0.008;
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

  const frontIndices = [];
  const backIndices = [];

  for (let i = 0; i < nyPelvis; i++) {
    for (let j = 0; j < nxPelvis; j++) {
      const a = pelvisStartIdx + i * (nxPelvis + 1) + j;
      const b = a + 1;
      const c = a + (nxPelvis + 1);
      const d = c + 1;
      const uFracMid = (j + 0.5) / nxPelvis;
      const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
      if (Math.cos(thetaMid) >= 0) {
        frontIndices.push(a, c, b, b, c, d);
      } else {
        backIndices.push(a, c, b, b, c, d);
      }
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
      const fitOff = Math.max(0.0055, Math.min(layerOffset, 0.012));
      const minAnkleRx = isShorts ? 0 : 0.048;
      const minAnkleRz = isShorts ? 0 : 0.054;
      const rx = Math.max(minAnkleRx, slice.r + fitOff);
      const rzFront = Math.max(minAnkleRz, (slice.rzFront || slice.r) + fitOff);
      const rzBack = Math.max(minAnkleRz, (slice.rzBack || slice.r) + fitOff);

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
        const uFracMid = (j + 0.5) / nxLeg;
        const thetaMid = -Math.PI + uFracMid * 2 * Math.PI;
        if (Math.cos(thetaMid) >= 0) {
          frontIndices.push(a, c, b, b, c, d);
        } else {
          backIndices.push(a, c, b, b, c, d);
        }
      }
    }
  });

  const allIndices = [...frontIndices, ...backIndices];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(allIndices), 1));
  geo.clearGroups();
  geo.addGroup(0, frontIndices.length, 0);
  geo.addGroup(frontIndices.length, backIndices.length, 1);
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
 * Complete 9-Layer Collision Protocol Radial Offsets (in meters):
 *  - Layer 0 (Avatar Body): 0.000m
 *  - Layer 1 (Undergarments / Base Tops / Socks): +0.003m (3mm)
 *  - Layer 2 (Footwear - Low Shoes / Sneakers): +0.004m (4mm)
 *  - Layer 3 (Bottoms - Trousers / Jeans / Skirts): +0.007m (7mm)
 *  - Layer 4 (Mid-Layers - Sweaters / Untucked Shirts): +0.010m (10mm)
 *  - Layer 5 (Waist Accessories - Belts / Sashes): +0.011m (11mm; +0.002m over active bottom)
 *  - Layer 6 (Footwear - Mid & High-Shaft Boots): +0.013m (13mm above legs/bottoms)
 *  - Layer 7 (Outerwear - Cardigans / Jackets / Coats): +0.016m (16mm)
 *  - Layer 8 (Outer Accessories - Scarves / Shawls / Crossbody Straps): +0.019m (19mm)
 */
export const LAYER_COLLISION_OFFSETS = Object.freeze({
  avatar_body: 0.000,
  undergarment: 0.003,
  base_top: 0.003,
  socks: 0.003,
  low_shoes: 0.004,
  bottom: 0.007,
  mid_layer: 0.010,
  belt: 0.011,
  belt_over_bottom: 0.002,
  boots: 0.013,
  outerwear: 0.016,
  outer_accessory: 0.019,
  bag_strap_delta: 0.003,
});

/**
 * Creates 3D accessory geometry mapped directly to its anatomical anchor on the avatar:
 *  - 'watch': Wristwatch / bracelet wrapped around the avatar's LEFT wrist (+X side)
 *             with a raised watch dial/bezel on the dorsal wrist surface.
 *  - 'necktie': Contoured collar band + knot + tapered front blade hanging from the
 *               neckline (y = 1.50 M / 1.44 F) down to the beltline (y = 1.06 M / 1.04 F),
 *               or outer scarf/shawl at Layer 8 (+0.019m) over outerwear.
 *  - 'belt': 360° contoured elliptical strap (`deformWeight = 1.0`) + flat rigid front buckle
 *            (`deformWeight = 0.0`) around the waistline (y = 1.08 M / 1.05 F), dynamically
 *            wrapping active bottom (`+0.002m` over Layer 3) or bare avatar/dress (`+0.011m`).
 *  - 'headwear': Rigid crown dome + visor/brim on the head (`deformWeight = 0.0`).
 *  - 'glasses': Rigid front frame + nose bridge + side temples resting on the face (`deformWeight = 0.0`).
 *  - 'bag': Rigid handbag/shoulder bag body (`deformWeight = 0.0`) + conforming shoulder/crossbody
 *           strap (`deformWeight = 1.0`) wrapped `+0.003m` over the outermost active torso layer.
 */
export function createAnatomicalAccessoryGeometry(
  type,
  {
    isMale = false,
    layerOffset = LAYER_COLLISION_OFFSETS.belt,
    hasBottom = false,
    hasOuterwear = false,
    garmentText = '',
  } = {}
) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];
  const indices = [];
  const deformWeights = [];

  const baseHeadY = isMale ? 1.70 : 1.62;

  if (type === 'watch') {
    // Avatar's anatomical LEFT wrist (+X side) in canonical A-pose:
    // Female wrist (arm t=0.70): center = (+0.362, 0.969, +0.008), forearm axis = (0.422, -0.906, 0.047)
    // Male wrist   (arm t=0.70): center = (+0.415, 1.047, +0.016), forearm axis = (0.434, -0.899, 0.062)
    const cx = isMale ? 0.415 : 0.362;
    const cy = isMale ? 1.047 : 0.969;
    const cz = isMale ? 0.016 : 0.008;
    const ax = isMale ? 0.434 : 0.422;
    const ay = isMale ? -0.899 : -0.906;
    const az = isMale ? 0.062 : 0.047;
    const aLen = Math.hypot(ax, ay, az) || 1;
    const uX = ax / aLen, uY = ay / aLen, uZ = az / aLen;

    // Orthonormal frame perpendicular to the angled forearm:
    // n1 points anterior-dorsal (+Z), n2 = u x n1 points lateral-radial (+X/+Y)
    let d1X = -uZ, d1Y = 0, d1Z = uX; // roughly +Z? Wait: uX > 0, so (0,0,1) Gram-Schmidt:
    // Project world +Z (0, 0, 1) perpendicular to u:
    d1X = -uZ * uX;
    d1Y = -uZ * uY;
    d1Z = 1 - uZ * uZ;
    const d1L = Math.hypot(d1X, d1Y, d1Z) || 1;
    const n1X = d1X / d1L, n1Y = d1Y / d1L, n1Z = d1Z / d1L;
    // n2 = u x n1
    const n2X = uY * n1Z - uZ * n1Y;
    const n2Y = uZ * n1X - uX * n1Z;
    const n2Z = uX * n1Y - uY * n1X;

    const bandHalfW = 0.012;
    const r1 = isMale ? 0.041 : 0.036; // dorsal-palmar wrist clearance radius
    const r2 = isMale ? 0.045 : 0.040; // radial-ulnar wrist clearance radius
    const ny = 6;
    const nx = 28;

    // 1. 360° Contoured Wrist Strap Band perpendicular to forearm axis (deformable = 1.0)
    for (let i = 0; i <= ny; i++) {
      const v = i / ny;
      const s = (0.5 - v) * 2 * bandHalfW;
      const ringCx = cx + s * uX;
      const ringCy = cy + s * uY;
      const ringCz = cz + s * uZ;
      for (let j = 0; j <= nx; j++) {
        const u = j / nx;
        const theta = -Math.PI + u * 2 * Math.PI;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const px = ringCx + r1 * cosT * n1X + r2 * sinT * n2X;
        const py = ringCy + r1 * cosT * n1Y + r2 * sinT * n2Y;
        const pz = ringCz + r1 * cosT * n1Z + r2 * sinT * n2Z;
        verts.push(px, py, pz);
        uvs.push(u, 1 - v);
        deformWeights.push(1.0);
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

    // 2. 3D Raised Watch Case Wall + Dial Face on anterior-outer wrist surface (rigid case = 0.0)
    const caseAngle = Math.PI * 0.18; // faces cleanly toward front-3/4 camera
    const dirX = Math.cos(caseAngle) * n1X + Math.sin(caseAngle) * n2X;
    const dirY = Math.cos(caseAngle) * n1Y + Math.sin(caseAngle) * n2Y;
    const dirZ = Math.cos(caseAngle) * n1Z + Math.sin(caseAngle) * n2Z;
    const tanX = -Math.sin(caseAngle) * n1X + Math.cos(caseAngle) * n2X;
    const tanY = -Math.sin(caseAngle) * n1Y + Math.cos(caseAngle) * n2Y;
    const tanZ = -Math.sin(caseAngle) * n1Z + Math.cos(caseAngle) * n2Z;

    const baseR = isMale ? 0.042 : 0.037;
    const caseDepth = 0.0085;
    const caseRadius = isMale ? 0.023 : 0.020;
    const nCaseR = 20;

    // Bezel side wall connecting strap surface to raised dial face
    const wallStartIdx = verts.length / 3;
    for (let ring = 0; ring <= 1; ring++) {
      const h = baseR + ring * caseDepth;
      const bx = cx + h * dirX;
      const by = cy + h * dirY;
      const bz = cz + h * dirZ;
      for (let j = 0; j <= nCaseR; j++) {
        const phi = (j / nCaseR) * 2 * Math.PI;
        const cP = Math.cos(phi) * caseRadius;
        const sP = Math.sin(phi) * caseRadius;
        verts.push(
          bx + cP * tanX + sP * uX,
          by + cP * tanY + sP * uY,
          bz + cP * tanZ + sP * uZ
        );
        uvs.push(0.5 + 0.42 * Math.cos(phi), 0.5 + 0.42 * Math.sin(phi));
        deformWeights.push(0.0);
      }
    }
    for (let j = 0; j < nCaseR; j++) {
      const a = wallStartIdx + j;
      const b = a + 1;
      const c = a + (nCaseR + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }

    // Raised Watch Dial Face Cap
    const dialStartIdx = verts.length / 3;
    const dialX = cx + (baseR + caseDepth) * dirX;
    const dialY = cy + (baseR + caseDepth) * dirY;
    const dialZ = cz + (baseR + caseDepth) * dirZ;
    verts.push(dialX, dialY, dialZ);
    uvs.push(0.5, 0.5);
    deformWeights.push(0.0);
    for (let j = 0; j <= nCaseR; j++) {
      const phi = (j / nCaseR) * 2 * Math.PI;
      const cP = Math.cos(phi) * caseRadius;
      const sP = Math.sin(phi) * caseRadius;
      verts.push(
        dialX + cP * tanX + sP * uX,
        dialY + cP * tanY + sP * uY,
        dialZ + cP * tanZ + sP * uZ
      );
      uvs.push(0.5 + 0.38 * Math.cos(phi), 0.5 + 0.38 * Math.sin(phi));
      deformWeights.push(0.0);
    }
    for (let j = 1; j <= nCaseR; j++) {
      indices.push(dialStartIdx, dialStartIdx + j, dialStartIdx + j + 1);
    }
  } else if (type === 'necktie' || type === 'scarf') {
    // Contoured 3D Necktie or Outer Scarf/Shawl (Layer 8: +0.019m over jackets and collars)
    const isScarf = type === 'scarf' || /(?:scarf|shawl|wrap|stole|pashmina|צעיף|שאל|מטפחת)/i.test(garmentText);
    const tieOffset = isScarf
      ? Math.max(LAYER_COLLISION_OFFSETS.outer_accessory, layerOffset)
      : Math.max(LAYER_COLLISION_OFFSETS.mid_layer + 0.002, layerOffset);
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
      const rx = Math.min(slice.rx, isMale ? 0.082 : 0.068) + tieOffset;
      const rz = Math.min(slice.rz, isMale ? 0.078 : 0.066) + tieOffset;
      for (let j = 0; j <= nxCollar; j++) {
        const u = j / nxCollar;
        const theta = -Math.PI + u * 2 * Math.PI;
        verts.push(rx * Math.sin(theta), y, slice.cz + rz * Math.cos(theta));
        uvs.push(0.35 + u * 0.30, 0.96 - v * 0.08);
        deformWeights.push(1.0);
      }
    }
    for (let i = 0; i < nyCollar; i++) {
      for (let j = 0; j < nxCollar; j++) {
        const a = collarStartIdx + i * (nxCollar + 1) + j;
        indices.push(a, a + nxCollar + 1, a + 1, a + 1, a + nxCollar + 1, a + nxCollar + 2);
      }
    }

    // 2. Front Tie Knot / Scarf Drape Blade (yTop -> yTip)
    const nyBlade = 18;
    const nxBlade = 6;
    const bladeStartIdx = verts.length / 3;
    for (let i = 0; i <= nyBlade; i++) {
      const v = i / nyBlade; // 0 at top knot, 1 at bottom tip
      const y = yTop - v * (yTop - yTip);
      const slice = getTorsoSlice(y, isMale);

      let halfWidth;
      let knotBumpZ = 0;
      if (isScarf) {
        halfWidth = 0.065 + Math.sin(v * Math.PI) * 0.020;
        knotBumpZ = 0.006;
      } else if (v < 0.14) {
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
        const bevelZ = Math.sin(u * Math.PI) * 0.004;
        const z = slice.cz + rzFront + bevelZ;
        verts.push(x, y, z);
        uvs.push(0.32 + u * 0.36, 0.98 - v * 0.94);
        deformWeights.push(1.0);
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
    // Rigid Anchor Transformation: fixed scale offset on Head crown with zero shrinkwrap deformation
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
        deformWeights.push(0.0);
      }
    }
    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * (nx + 1) + j;
        indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
  } else if (type === 'glasses') {
    // Rigid Anchor Transformation: positioned at nose bridge and temples with zero vertex displacement
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
        deformWeights.push(0.0);
      }
    }
    for (let i = 0; i < nyG; i++) {
      for (let j = 0; j < nxG; j++) {
        const a = i * (nxG + 1) + j;
        indices.push(a, a + nxG + 1, a + 1, a + 1, a + nxG + 1, a + nxG + 2);
      }
    }
  } else if (type === 'bag') {
    // 1. Rigid Bag_Body (`deformWeight = 0.0`) near right hip/hand (-X side)
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
        deformWeights.push(0.0);
      }
    }
    for (let i = 0; i < nyB; i++) {
      for (let j = 0; j < nxB; j++) {
        const a = i * (nxB + 1) + j;
        indices.push(a, a + nxB + 1, a + 1, a + 1, a + nxB + 1, a + nxB + 2);
      }
    }

    // 2. Conforming Strap (`deformWeight = 1.0`) for crossbody / shoulder / backpack bags:
    // Shrinkwraps against outermost active torso layer (Outerwear +0.016m or Mid-Layer +0.010m) + 0.003m
    const hasStrap = /(?:crossbody|shoulder|messenger|satchel|tote|backpack|תיק צד|תיק כתף|תרמיל|גב)/i.test(garmentText);
    if (hasStrap) {
      const strapStartIdx = verts.length / 3;
      const baseTorsoLayer = hasOuterwear
        ? LAYER_COLLISION_OFFSETS.outerwear
        : LAYER_COLLISION_OFFSETS.mid_layer;
      const strapOffset = baseTorsoLayer + LAYER_COLLISION_OFFSETS.bag_strap_delta;
      const yShoulder = isMale ? 1.46 : 1.40;
      const yBagTop = cy + hh;
      const nyS = 14;
      const nxS = 2;
      const strapHalfW = 0.012;
      for (let i = 0; i <= nyS; i++) {
        const v = i / nyS;
        const y = yShoulder - v * (yShoulder - yBagTop);
        const slice = getTorsoSlice(y, isMale);
        const xCenter = (isMale ? 0.11 : 0.09) * (1 - v) + cx * v;
        const rzFront = (slice.rzFront || slice.rz) + strapOffset;
        for (let j = 0; j <= nxS; j++) {
          const u = j / nxS;
          const x = xCenter + (u - 0.5) * 2 * strapHalfW;
          const z = slice.cz + rzFront;
          verts.push(x, y, z);
          uvs.push(0.45 + u * 0.1, 0.95 - v * 0.4);
          deformWeights.push(1.0);
        }
      }
      for (let i = 0; i < nyS; i++) {
        for (let j = 0; j < nxS; j++) {
          const a = strapStartIdx + i * (nxS + 1) + j;
          indices.push(a, a + nxS + 1, a + 1, a + 1, a + nxS + 1, a + nxS + 2);
        }
      }
    }
  } else {
    // Belt / Waistline accessory (Layer 5):
    // Dynamic Parent Target: if an active bottom exists, wraps bottom_garment_obj (+0.007m + 0.002m = +0.009m);
    // if worn over bare avatar/dress, wraps avatar_body at +0.011m.
    // Buckle Protection Group: Belt_Strap (deformWeight = 1.0) vs Belt_Buckle (deformWeight = 0.0, flat Z plane).
    const yBelt = isMale ? 1.08 : 1.05;
    const beltHalfH = 0.022;
    const slice = getTorsoSlice(yBelt, isMale);
    const beltOffset = hasBottom
      ? LAYER_COLLISION_OFFSETS.bottom + LAYER_COLLISION_OFFSETS.belt_over_bottom + 0.0015
      : Math.max(LAYER_COLLISION_OFFSETS.belt, layerOffset);
    const rx = slice.rx + beltOffset;
    const rzFront = (slice.rzFront || slice.rz) + beltOffset;
    const rzBack = (slice.rzBack || slice.rz) + beltOffset + 0.004;
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
        // Buckle Protection Group at center-front (|sin(theta)| < 0.18): flat undeformed plane
        const isBuckle = isFront && Math.abs(Math.sin(theta)) < 0.18;
        const z = isBuckle
          ? slice.cz + rzFront + 0.004
          : isFront
            ? slice.cz + rzFront * Math.cos(theta)
            : slice.cz - rzBack * Math.abs(Math.cos(theta));
        verts.push(x, y, z);
        uvs.push(u, 1 - v);
        deformWeights.push(isBuckle ? 0.0 : 1.0);
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
  geo.setAttribute('deformWeight', new THREE.Float32BufferAttribute(deformWeights, 1));
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
 * Returns the physical layering renderOrder for each garment slot according to the
 * 9-Layer Collision Protocol:
 *  - Layer 1 (Undergarments / Base Tops tucked into bottoms): 6
 *  - Layer 2 (Low Shoes / Sneakers): 5
 *  - Layer 3 (Bottoms - Trousers / Jeans / Skirts): 8
 *  - Layer 4 (Dresses): 9
 *  - Layer 5 (Waist Accessories - Belts / Sashes): 10
 *  - Necktie (under outerwear): 11
 *  - Layer 6 (Mid & High-Shaft Boots): 12
 *  - Layer 7 (Outerwear - Cardigans / Jackets / Coats): 14
 *  - Layer 8 (Outer Accessories - Scarves / Shawls / Bags / Headwear / Glasses / Watch): 16
 */
export function resolveGarmentRenderOrder(rawSlot, garmentText = '', isTucked = false) {
  switch (rawSlot) {
    case 'shoes':
      return /(?:boot|chelsea|מגפיים|מגפי)/i.test(garmentText) ? 12 : 5;
    case 'bottom':
      return 7;
    case 'top':
      return isTucked ? 5 : 8;
    case 'dress':
      return 9;
    case 'belt':
      return 10;
    case 'necktie':
      return /(?:scarf|shawl|wrap|stole|pashmina|צעיף|שאל|מטפחת)/i.test(garmentText) ? 16 : 11;
    case 'outerwear':
      return 14;
    case 'scarf':
    case 'watch':
    case 'glasses':
    case 'headwear':
    case 'bag':
    case 'accessory':
      return 16;
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
 * Enforces the 9-Layer Collision Protocol radial offsets and realistic fabric thickness (0.2 mm to 3.0 mm).
 */
export function resolveShellFit({
  rawSlot,
  garmentText = '',
  isMale = false,
  hasOuterwear = false,
  hasBottom = false,
  garment = null,
  aspect = 0.55,
} = {}) {
  const fullText = `${garmentText} ${resolveGarmentMetadataText(garment)}`.toLowerCase();
  const has = (...words) => words.some((w) => fullText.includes(w));
  const isStrapless = has(
    'strapless', 'tube', 'bandeau', 'corset', 'bustier', 'sweetheart',
    'סטרפלס', 'בנדו', 'קורסט', 'מחוך', 'בוסטייה', 'טיוב',
    'sans bretelles', 'trägerlos', 'korsett', 'palabra de honor', 'corse', 'corsé',
    'بدון حمالات', 'كورسيه', 'مشد'
  );
  const isWideOrLoose = has('wide', 'loose', 'baggy', 'oversized', 'hip-hop', 'hip hop', 'cargo', 'relaxed', 'boyfriend', 'flair', 'flare', 'palazzo', 'ball gown', 'רחב', 'רפוי', 'אוברסייז');
  if (rawSlot === 'top') {
    const isCrop = has('crop', 'sports_bra', 'bralette', 'קרופ', 'חזיה');
    const isLongline = has('kurta', 'tunic', 'longline', 'thobe', 'טוניקה');
    const isExplicitOuterwear = has('coat', 'overcoat', 'trench', 'jacket', 'blazer', 'parka', 'puffer', 'מעיל', "ז'קט", 'בלייזר');
    const isTuckable = !isExplicitOuterwear;
    const isTucked = hasBottom && isTuckable;
    // Standard untucked T-shirts / shirts end cleanly at the upper hip (0.96 M / 0.92 F), never thigh-length
    let yBottom = isMale ? 0.96 : 0.92;
    if (isCrop) yBottom = isMale ? 1.18 : 1.12;
    if (isLongline) yBottom = isMale ? 0.75 : 0.70;
    const yTop = isStrapless ? (isMale ? 1.34 : 1.30) : (isMale ? 1.52 : 1.44);
    const fabricThickness = resolveFabricThickness(fullText, 'top', false);
    // Layer 1 (+0.003m) when tucked into bottom or worn under outerwear; Layer 4 (+0.010m) when worn as outer mid-layer
    const layerOffset = (hasOuterwear || isTucked)
      ? LAYER_COLLISION_OFFSETS.base_top
      : LAYER_COLLISION_OFFSETS.mid_layer;
    return { yTop, yBottom, layerOffset, fabricThickness, isSkirt: false, isStrapless, isWideOrLoose, isTucked };
  }
  if (rawSlot === 'outerwear') {
    const isMaxi = has('maxi', 'מקסי', 'ankle', 'קרסול', 'floor', 'עד הרצפה', 'דאסטר', 'duster');
    const isCrop = has('bolero', 'shrug', 'עליונית קצרה', 'קרופ', 'crop') || (has('jacket', 'זקט', 'גקט') && has('crop', 'קרופ', 'קצר', 'קצרה'));
    const hasLongCoatKeyword = has(
      'overcoat', 'trench', 'trenchcoat', 'duster', 'cardigan', 'coat', 'parka', 'robe', 'raincoat', 'mac', 'peacoat', 'kimono',
      'מעיל', 'טרנץ', 'קרדיגן', 'חלוק', 'קימונו', 'מעיל גשם', 'מעיל רוח', 'מעיל פוך', 'מעיל צמר', 'מעיל חורף',
      'manteau', 'mantel', 'cappotto', 'abrigo', 'пальто', 'плащ', 'ארוך', 'ארוכה', 'long coat', 'long blazer', 'long jacket'
    );
    const isStandardBlazerOrJacket =
      !hasLongCoatKeyword &&
      has(
        'bomber', 'biker', 'בומבר', 'אופנוענים', 'short jacket',
        'blazer', 'suit jacket', 'sport coat', 'tuxedo', 'בלייזר', 'מקטורן',
        'jacket', 'זקט', 'גקט', "ז'קט", "ג'קט", 'ג׳קט', 'ז׳קט', 'vest', 'waistcoat', 'ווסט', 'אפודה'
      );
    const isLong = isMaxi || (!isCrop && !isStandardBlazerOrJacket && (hasLongCoatKeyword || aspect <= 0.88));
    let yBottom = isMale ? 0.89 : 0.85;
    if (isMaxi) yBottom = isMale ? 0.22 : 0.18;
    else if (isLong) yBottom = isMale ? 0.52 : 0.48;
    else if (isCrop) yBottom = isMale ? 1.15 : 1.10;
    const fabricThickness = resolveFabricThickness(fullText, 'outerwear', false);
    // Layer 7 (+0.016m): worn strictly outside bottoms (+0.007m) and mid-layers (+0.010m)
    return {
      yTop: isMale ? 1.53 : 1.45,
      yBottom,
      layerOffset: LAYER_COLLISION_OFFSETS.outerwear,
      fabricThickness,
      isSkirt: false,
      isStrapless: false,
      isWideOrLoose: true,
    };
  }
  if (rawSlot === 'dress') {
    const isMini = has('mini', 'קצרה');
    const isMaxi = has('maxi', 'gown', 'evening', 'ארוכה', 'מקסי', 'kaftan', 'caftan', 'robe', 'abaya');
    let yBottom = isMale ? 0.55 : 0.50;
    if (isMini) yBottom = isMale ? 0.78 : 0.74;
    if (isMaxi) yBottom = isMale ? 0.16 : 0.12;
    const yTop = isStrapless ? (isMale ? 1.34 : 1.30) : (isMale ? 1.52 : 1.44);
    const fabricThickness = resolveFabricThickness(fullText, 'dress', false);
    return {
      yTop,
      yBottom,
      layerOffset: LAYER_COLLISION_OFFSETS.mid_layer,
      fabricThickness,
      isSkirt: false,
      isStrapless,
      isWideOrLoose,
    };
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
      layerOffset: LAYER_COLLISION_OFFSETS.bottom,
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
/**
 * Renders a canonical 3D GLB garment archetype model with custom fabric texture,
 * avatar morph-field compliance, and physical layering order.
 */
class GarmentTemplateErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('[GarmentTemplate] Error loading 3D template, falling back to procedural mesh:', error?.message);
    if (this.props.url) {
      try {
        useGLTF.clear?.(this.props.url);
      } catch (_) {}
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function GarmentTemplateMeshInner({
  templateId,
  url,
  texture,
  backTexture,
  dominantColor,
  pbrProps,
  renderOrder,
  morphField,
  morphInfluences,
  rawSlot,
  garmentText = '',
  isMale = false,
  hasBottom = false,
  hasOuterwear = false,
  layerOffset = 0,
  extraLayerOffset = 0,
  shellFit = null,
  fitProfile = null,
  fallbackGeometry = null,
  heelGeometry = null,
}) {
  const gltf = useGLTF(url, '/draco/');

  const geometry = useMemo(() => {
    // Tuck state is needed by the ease, hem, tuck, AND radial-clearance passes below, so it must live at
    // function scope (a block-scoped declaration here crashed every top/dress template with
    // "ReferenceError: shouldTuck is not defined" and silently fell back to the procedural mesh).
    const isTuckableTop = rawSlot === 'top' &&
      !['jacket', 'top_outerwear_jacket', 'coat', 'trench_coat', 'cardigan', 'jacket_blazer'].includes(templateId) &&
      !/(?:overcoat|trench|jacket|blazer|coat|מעיל|ז['’]קט|ג['’]קט|בלייזר)/i.test(garmentText);
    const shouldTuck = isTuckableTop && hasBottom;
    let geo = null;
    if (gltf?.scene) {
      const meshes = [];
      gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          meshes.push(child.geometry.clone());
        }
      });
      if (meshes.length === 1) {
        geo = meshes[0];
      } else if (meshes.length > 1) {
        try {
          meshes.forEach((g) => {
            if (!g.attributes.uv && g.attributes.position) {
              g.computeBoundingBox();
              const bb = g.boundingBox;
              const dx = Math.max(1e-4, bb.max.x - bb.min.x);
              const dy = Math.max(1e-4, bb.max.y - bb.min.y);
              const uvs = new Float32Array(g.attributes.position.count * 2);
              for (let i = 0; i < g.attributes.position.count; i++) {
                uvs[i * 2] = (g.attributes.position.getX(i) - bb.min.x) / dx;
                uvs[i * 2 + 1] = (g.attributes.position.getY(i) - bb.min.y) / dy;
              }
              g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            }
          });
          geo = mergeBufferGeometries(meshes, false);
        } catch (err) {
          console.warn('[GarmentTemplate] mergeBufferGeometries fallback to primary mesh:', err);
          geo = meshes[0];
        }
      }
    }
    if (!geo && fallbackGeometry) {
      geo = fallbackGeometry;
    }
    if (!geo) return null;
    try {
      geo = mergeVertices(geo, 0.0006);
    } catch (e) {
      // proceed if mergeVertices is unavailable
    }
    if (['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot)) {
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      if (pos) {
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        if (bb) {
          // Canonical templates retain their continuous, welded, pre-tailored Blender geometry,
          // and apply anchor-locked radial & lateral ease below the anatomical anchor based on fitProfile:
          //   • Tops / Outerwear / Dresses: anchored strictly at the shoulders & neckline (tDrop = 0 at shoulders).
          //   • Bottoms: anchored strictly at the waistline (tDrop = 0 at waist).
          const fitMode = fitProfile?.fit || 'regular';
          const preDrapedLooseTemplates = ['hoodie', 'cardigan', 'coat', 'trench_coat', 'kaftan', 'top_tunic', 'bermuda'];
          const isPreDrapedLoose = preDrapedLooseTemplates.includes(templateId);
          if (fitMode !== 'regular' && !(isPreDrapedLoose && fitMode === 'loose')) {
            // Canonical templates already sit at exact draped cloth clearance;
            // only apply gentle additional ease for loose/oversized/flared fits and never shrink < 1.0 into the avatar skin.
            const rawW = Number.isFinite(fitProfile?.templateWidthScale) ? fitProfile.templateWidthScale : 1.0;
            const rawD = Number.isFinite(fitProfile?.templateDepthScale) ? fitProfile.templateDepthScale : 1.0;
            const wScale = Math.max(1.0, 1.0 + (rawW - 1.0) * (isPreDrapedLoose ? 0.35 : 0.65));
            const dScale = Math.max(1.0, 1.0 + (rawD - 1.0) * (isPreDrapedLoose ? 0.35 : 0.65));
            const yShoulderAnchor = isMale ? 1.48 : 1.42;
            const yWaistAnchor = isMale ? 1.08 : 1.05;
            const yCrotch = isMale ? 0.86 : 0.82;
            const isBottomSlot = rawSlot === 'bottom';
            const isSkirtSlot = Boolean(shellFit?.isSkirt);

            for (let i = 0; i < pos.count; i++) {
              let x = pos.getX(i);
              const y = pos.getY(i);
              let z = pos.getZ(i);

              if (isBottomSlot) {
                // Bottoms: locked 100% at the waistline (y >= yWaistAnchor - 0.03)
                const tDrop = Math.max(0, Math.min(1, (yWaistAnchor - 0.03 - y) / 0.16));
                const sDrop = tDrop * tDrop * (3 - 2 * tDrop);
                if (sDrop > 0) {
                  const slice = getTorsoSlice(Math.max(0.5, y), isMale);
                  const cz = slice.cz || 0;
                  if (isSkirtSlot || y >= yCrotch) {
                    const flareAdd = fitMode === 'flared' ? Math.max(0, yCrotch - y) * (fitProfile?.flareRate || 0.28) : 0;
                    x = x * (1 + (wScale - 1) * sDrop) + Math.sign(x) * flareAdd * sDrop;
                    z = cz + (z - cz) * (1 + (dScale - 1) * sDrop) + Math.sign(z - cz) * flareAdd * 0.5 * sDrop;
                  } else {
                    // Pant / short legs: scale radially around each leg's anatomical center while preserving inner-crotch clearance
                    const legSlice = getLegSlice(y, isMale);
                    const side = x < 0 ? -1 : 1;
                    const legCx = side * legSlice.cx;
                    const dxLeg = x - legCx;
                    const isInnerThigh = side * dxLeg < 0 && y > yCrotch - 0.10;
                    const effWScale = isInnerThigh ? Math.min(1.02, wScale) : wScale;
                    const flareLeg = fitMode === 'flared' ? Math.max(0, 0.50 - y) * (fitProfile?.flareRate || 0.22) : 0;
                    x = legCx + dxLeg * (1 + (effWScale - 1) * sDrop) + (isInnerThigh ? 0 : side * flareLeg * sDrop);
                    z = legSlice.cz + (z - legSlice.cz) * (1 + (dScale - 1) * sDrop);
                  }
                  pos.setXYZ(i, x, y, z);
                }
              } else {
                // Tops / Outerwear / Full-Body: locked 100% at the shoulders & neckline (y >= yShoulderAnchor - 0.03)
                const tDrop = Math.max(0, Math.min(1, (yShoulderAnchor - 0.03 - y) / 0.22));
                const sDrop = tDrop * tDrop * (3 - 2 * tDrop);
                if (sDrop > 0) {
                  const slice = getTorsoSlice(Math.max(0.5, y), isMale);
                  const cz = slice.cz || 0;
                  // Anatomical armpit separation plane between torso ribcage and upper arm / sleeve
                  const xArmpitSplit = isMale
                    ? (0.180 + Math.max(0, 1.28 - y) * 0.42)
                    : (0.150 + Math.max(0, 1.20 - y) * 0.40);
                  const isSleeveVertex = Math.abs(x) > xArmpitSplit;
                  if (isSleeveVertex) {
                    // Sleeve vertices preserve their pre-tailored Blender inner-arm clearance (never pushed into the bicep),
                    // while outer-arm X and Z depth expand radially around the true 3D arm axis (armCx, armCz).
                    const side = x < 0 ? -1 : 1;
                    const armCx = isMale
                      ? (y >= 1.26 ? Math.max(0.215, 0.284 - (y - 1.26) * 0.95) : 0.284 + (1.26 - y) * 0.580)
                      : (y >= 1.22 ? Math.max(0.165, 0.211 - (y - 1.22) * 1.10) : 0.211 + (1.22 - y) * 0.628);
                    const armCz = isMale ? 0.004 : 0.008;
                    const yWrist = isMale ? 0.975 : 0.895;
                    // Taper sleeve ease to 0 at the wrist cuff so the wrist cuff stays tight & snug
                    const tCuff = Math.max(0, Math.min(1, (y - (yWrist + 0.035)) / 0.08));
                    const rScaleSleeve = 1.0 + (fitMode === 'oversized' ? 0.10 : (fitMode === 'loose' ? 0.05 : 0)) * tCuff;
                    const dxArm = x - side * armCx;
                    const dzArm = z - armCz;
                    if (side * dxArm > 0) {
                      x = side * armCx + dxArm * (1 + (rScaleSleeve - 1) * sDrop);
                    }
                    if (z >= armCz) {
                      z = armCz + dzArm * (1 + (rScaleSleeve - 1) * sDrop);
                    }
                  } else {
                    const isAlreadyFlaredTemplate = templateId === 'trench_coat' || templateId === 'kaftan';
                    const flareAdd = (!shouldTuck && fitMode === 'flared' && !isAlreadyFlaredTemplate)
                      ? Math.max(0, yWaistAnchor - y) * (fitProfile?.flareRate || 0.28)
                      : 0;
                    // Smoothly taper lateral torso X-scaling near the armpit boundary so torso wall never crowds inner sleeve
                    const tTorsoX = Math.max(0, Math.min(1, (xArmpitSplit - Math.abs(x)) / 0.035));
                    const sTorsoX = tTorsoX * tTorsoX * (3 - 2 * tTorsoX);
                    const yArmpitTop = isMale ? 1.32 : 1.26;
                    const yArmpitBot = isMale ? 1.18 : 1.14;
                    const tArmpitY = y < yArmpitTop ? Math.max(0, Math.min(1, (yArmpitBot + 0.04 - y) / 0.12)) : 0;
                    const sArmpitY = tArmpitY * tArmpitY * (3 - 2 * tArmpitY);
                    const sLat = sDrop * sTorsoX * sArmpitY;
                    const sDep = sDrop * sTorsoX;
                    const effW = shouldTuck && y < yWaistAnchor ? 1.0 : wScale;
                    const effD = shouldTuck && y < yWaistAnchor ? 1.0 : dScale;
                    x = x * (1 + (effW - 1) * sLat) + Math.sign(x) * flareAdd * sLat;
                    z = cz + (z - cz) * (1 + (effD - 1) * sDep) + Math.sign(z - cz) * flareAdd * 0.45 * sDep;
                  }
                  pos.setXYZ(i, x, y, z);
                }
              }
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            geo.computeBoundingBox();
          }

// (shouldTuck already defined above for ease and tucking)

          // Dynamic vertical hem scaling across dress, bottom, untucked top, and outerwear:
          // Keeps shoulders, necklines, sleeves, waistbands, and bifurcated pelvis 100% locked while matching shellFit.yBottom.
          if (Number.isFinite(shellFit?.yBottom)) {
            if (rawSlot === 'dress') {
              const yHipAnchor = isMale ? 0.90 : 0.88;
              const curHemY = geo.boundingBox.min.y;
              const targetHemY = Math.max(0.14, Math.min(0.78, shellFit.yBottom));
              const curSkirtSpan = Math.max(0.08, yHipAnchor - curHemY);
              const targetSkirtSpan = Math.max(0.08, yHipAnchor - targetHemY);
              if (Math.abs(targetHemY - curHemY) > 0.015) {
                const skirtScaleY = targetSkirtSpan / curSkirtSpan;
                for (let i = 0; i < pos.count; i++) {
                  const y = pos.getY(i);
                  if (y < yHipAnchor) {
                    pos.setY(i, yHipAnchor - (yHipAnchor - y) * skirtScaleY);
                  }
                }
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            } else if (rawSlot === 'bottom') {
              const isSkirtBottom = Boolean(shellFit?.isSkirt);
              const yLock = isSkirtBottom ? (isMale ? 1.02 : 0.98) : (isMale ? 0.81 : 0.78);
              const curHemY = geo.boundingBox.min.y;
              const maxAllowedHem = isSkirtBottom ? 0.80 : 0.65;
              const targetHemY = Math.max(0.10, Math.min(maxAllowedHem, shellFit.yBottom));
              if (curHemY < yLock - 0.03 && Math.abs(targetHemY - curHemY) > 0.015) {
                if (isSkirtBottom) {
                  const scaleY = Math.max(0.05, yLock - targetHemY) / Math.max(0.05, yLock - curHemY);
                  for (let i = 0; i < pos.count; i++) {
                    const y = pos.getY(i);
                    if (y < yLock) {
                      pos.setY(i, yLock - (yLock - y) * scaleY);
                    }
                  }
                } else {
                  // For pants / trousers:
                  // Shortening (capris, cropped chinos, ankle pants) MUST only scale below the knee (y < yKneeAnchor)!
                  // Anchoring at the knee keeps the knee and thigh 100% locked to the avatar's anatomy,
                  // completely eliminating knee caps bursting through shifted trousers!
                  const yKneeAnchor = isMale ? 0.48 : 0.44;
                  if (curHemY < yKneeAnchor - 0.02) {
                    const effTargetHemY = Math.min(yKneeAnchor - 0.02, Math.max(curHemY, targetHemY));
                    const scaleY = Math.max(0.05, yKneeAnchor - effTargetHemY) / Math.max(0.05, yKneeAnchor - curHemY);
                    for (let i = 0; i < pos.count; i++) {
                      const y = pos.getY(i);
                      if (y < yKneeAnchor) {
                        pos.setY(i, yKneeAnchor - (yKneeAnchor - y) * scaleY);
                      }
                    }
                  }
                }
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            } else if ((rawSlot === 'top' && !shouldTuck) || rawSlot === 'outerwear') {
              const yTorsoLock = isMale ? 1.16 : 1.08;
              const xSleeveGap = isMale ? 0.238 : 0.206;
              let curTorsoHemY = Infinity;
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                if (y < yTorsoLock && Math.abs(x) <= xSleeveGap && y < curTorsoHemY) {
                  curTorsoHemY = y;
                }
              }
              const minAllowed = rawSlot === 'outerwear' ? 0.18 : 0.68;
              const maxAllowed = yTorsoLock - 0.04;
              const targetHemY = Math.max(minAllowed, Math.min(maxAllowed, shellFit.yBottom));
              if (Number.isFinite(curTorsoHemY) && curTorsoHemY < yTorsoLock - 0.03 && Math.abs(targetHemY - curTorsoHemY) > 0.015) {
                const scaleY = Math.max(0.04, yTorsoLock - targetHemY) / Math.max(0.04, yTorsoLock - curTorsoHemY);
                for (let i = 0; i < pos.count; i++) {
                  const x = pos.getX(i);
                  const y = pos.getY(i);
                  if (y < yTorsoLock && Math.abs(x) <= xSleeveGap) {
                    pos.setY(i, yTorsoLock - (yTorsoLock - y) * scaleY);
                  }
                }
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            }
          }

          // Sleeve Hem & Cuff Boundary Protection:
          // Preserve authentic 3D rounded cuffs authored in canonical GLB basemeshes.
          // Clamp sleeve UVs away from outer texture margins to eliminate hallucinated white border stripes.
          const longSleeveTemplates = ['hoodie', 'top_outerwear_jacket', 'jacket', 'jacket_blazer', 'cardigan', 'coat', 'trench_coat', 'top_longsleeve', 'shirt', 'longsleeve', 'kaftan'];
          const isLongSleeveGarment = longSleeveTemplates.includes(templateId) || (['top', 'outerwear', 'dress'].includes(rawSlot) && detectSleeveStyle({ garmentText }).type === 'long');
          if (isLongSleeveGarment && pos && uv) {
            const xCuffThresh = isMale ? 0.28 : 0.24;
            const yCuffMax = isMale ? 1.08 : 1.00;
            let uvsModified = false;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const vOrig = uv.getY(i);
              // Inset vertical UV slightly away from bottom/top 2.5% canvas margin to avoid drop-shadow lines
              if (vOrig < 0.028) {
                uv.setY(i, 0.028);
                uvsModified = true;
              } else if (vOrig > 0.982) {
                uv.setY(i, 0.982);
                uvsModified = true;
              }
              if (y < yCuffMax && Math.abs(x) > xCuffThresh) {
                const u = uv.getX(i);
                // Clamp away from outer margin where white canvas padding or fringe resides
                if (u > 0.88) {
                  uv.setX(i, 0.86);
                  uvsModified = true;
                } else if (u < 0.12) {
                  uv.setX(i, 0.14);
                  uvsModified = true;
                }
              }
            }
            if (uvsModified) {
              uv.needsUpdate = true;
            }
          }

          // Dynamic Collar & Neckline Tailoring:
          // Adapts template collar geometry to match the authentic garment neckline (strapless, V-neck, scoop, square, boat neck),
          // ensuring crew necks are NOT forced on non-crew garments.
          const isCoreTop = ['top', 'outerwear', 'dress'].includes(rawSlot);
          if (isCoreTop && pos) {
            const necklineType = detectNecklineStyle({ garmentText });
            const isDedicatedStrapless = templateId === 'top_strapless' || templateId === 'dress_strapless';
            const isStraplessTop = !isDedicatedStrapless && (shellFit?.isStrapless || necklineType === 'strapless');

            if (isStraplessTop) {
              // Smooth anatomical strapless contouring for fallback templates without dedicated strapless basemesh.
              // Strictly preserves waist, hips, and skirt volume below yTorsoMin (y < 1.05),
              // eliminating cubic box outlines and skirt squashing.
              const yBustMax = isMale ? 1.34 : 1.28;
              const yTorsoMin = isMale ? 1.30 : 1.24;
              const xArmMax = isMale ? 0.180 : 0.155;
              let straplessModified = false;
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);

                // Smooth sweetheart bustline contouring: clavicle/neck vertices conform to curved bust profile
                if (y > yBustMax) {
                  const dip = (z > 0.02 && Math.abs(x) < 0.06) ? 0.015 * (1 - Math.abs(x) / 0.06) : 0;
                  pos.setY(i, yBustMax - dip);
                  straplessModified = true;
                }
                // Upper arm & shoulder trimming: ONLY above waist/hip level (y >= yTorsoMin), NEVER on skirts or pants!
                if (y >= yTorsoMin && Math.abs(x) > xArmMax) {
                  pos.setX(i, Math.sign(x) * xArmMax);
                  straplessModified = true;
                }
              }
              if (straplessModified) {
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            } else if (necklineType === 'v_neck') {
              // V-Neck: smoothly contour front center neck vertices into an authentic V dip
              let neckModified = false;
              const yNeckBase = isMale ? 1.48 : 1.42;
              const yVDip = isMale ? 1.40 : 1.34;
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                if (z > 0.005 && y > yVDip && Math.abs(x) < 0.09) {
                  const targetY = yVDip + Math.abs(x) * ((yNeckBase - yVDip) / 0.09);
                  if (y > targetY) {
                    pos.setY(i, targetY);
                    neckModified = true;
                  }
                }
              }
              if (neckModified) {
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            } else if (necklineType === 'scoop') {
              // Scoop Neck: round curved dip leaving clavicles and upper chest open
              let neckModified = false;
              const yScoopDip = isMale ? 1.42 : 1.36;
              const yNeckBase = isMale ? 1.48 : 1.42;
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                if (z > 0.005 && y > yScoopDip && Math.abs(x) < 0.08) {
                  const tAcross = Math.abs(x) / 0.08;
                  const targetY = yScoopDip + (tAcross * tAcross) * (yNeckBase - yScoopDip);
                  if (y > targetY) {
                    pos.setY(i, targetY);
                    neckModified = true;
                  }
                }
              }
              if (neckModified) {
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            } else if (necklineType === 'square') {
              // Square Neck: horizontal dip across the chest
              let neckModified = false;
              const ySquareDip = isMale ? 1.42 : 1.36;
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                if (z > 0.005 && y > ySquareDip && Math.abs(x) < 0.075) {
                  pos.setY(i, ySquareDip);
                  neckModified = true;
                }
              }
              if (neckModified) {
                pos.needsUpdate = true;
                geo.computeVertexNormals();
                geo.computeBoundingBox();
              }
            }
          }

          // Dynamic Waistband & Pelvis Tucking:
          // When worn with a bottom garment, always tuck base tops (shirts, t-shirts, blouses, singlets, tanks)
          // into the bottom garment's waistband and pelvis, eliminating merging and z-fighting.
          if (shouldTuck && pos) {
            const yTuckStart = isMale ? 1.085 : 1.045;
            const yTuckFull = isMale ? 1.050 : 1.015;
            const yHemMin = isMale ? 0.960 : 0.935;
            const xSleeveGap = isMale ? 0.238 : 0.206;
            const czDefault = isMale ? 0.025 : 0.035;
            let tuckModified = false;

            for (let i = 0; i < pos.count; i++) {
              let x = pos.getX(i);
              let y = pos.getY(i);
              let z = pos.getZ(i);

              // Tucking envelope: smoothly compress torso fabric inward starting at yTuckStart.
              // Above yTuckStart (or outside xSleeveGap on sleeves), leaves 100% untucked so
              // long sleeves and the upper torso retain their natural anatomical position!
              // Below yTuckStart on the torso, pulls fabric strictly inside bottom waistband and clamps hem above pelvis/crotch.
              if (y <= yTuckStart && Math.abs(x) <= xSleeveGap) {
                const u = Math.min(1.0, Math.max(0.0, (yTuckStart - y) / Math.max(0.01, yTuckStart - yTuckFull)));
                const tTuck = u * u * (3 - 2 * u);

                // Terminate tucked top cleanly inside waistband/pelvis, never bleeding into thighs or skirt bottom
                if (y < yHemMin) {
                  y = yHemMin + (y - yHemMin) * 0.08;
                }

                const slice = getTorsoSlice(Math.max(0.85, y), isMale);
                const cz = slice.cz || czDefault;
                const rxLimit = (slice.rx || 0.145) + 0.0035;
                const rzFrontLimit = (slice.rzFront || slice.rz || 0.105) + 0.0035;
                const rzBackLimit = (slice.rzBack || slice.rz || 0.105) + 0.0035;

                // Radial compression inside bottom garment
                const currentRx = Math.abs(x);
                if (currentRx > rxLimit) {
                  const targetX = Math.sign(x) * (rxLimit + (currentRx - rxLimit) * 0.15);
                  x = (1 - tTuck) * x + tTuck * targetX;
                } else {
                  x = x * (1 - 0.10 * tTuck);
                }

                const isFront = z >= cz;
                const currentRz = Math.abs(z - cz);
                const rzLimit = isFront ? rzFrontLimit : rzBackLimit;
                if (currentRz > rzLimit) {
                  const targetZ = cz + Math.sign(z - cz) * (rzLimit + (currentRz - rzLimit) * 0.15);
                  z = (1 - tTuck) * z + tTuck * targetZ;
                } else {
                  z = cz + (z - cz) * (1 - (isFront ? 0.16 : 0.24) * tTuck);
                }

                pos.setXYZ(i, x, y, z);
                tuckModified = true;
              }
            }
            if (tuckModified) {
              pos.needsUpdate = true;
              geo.computeVertexNormals();
              geo.computeBoundingBox();
            }
          }

          // Preserve authored GLB UVs when they span full garment space; generate planar [0.04..0.96] UVs
          // if template geometry lacks UVs or carries narrow body-atlas UVs (< 0.55 span).
          let needsPlanarUv = !uv;
          if (uv && uv.count > 0) {
            let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
            for (let i = 0; i < uv.count; i++) {
              const uVal = uv.getX(i);
              const vVal = uv.getY(i);
              if (uVal < uMin) uMin = uVal;
              if (uVal > uMax) uMax = uVal;
              if (vVal < vMin) vMin = vVal;
              if (vVal > vMax) vMax = vVal;
            }
            if ((uMax - uMin) < 0.55 || (vMax - vMin) < 0.55) {
              needsPlanarUv = true;
            }
          }
          if (needsPlanarUv) {
            geo.computeBoundingBox();
            const bbUpdated = geo.boundingBox;
            const dx = Math.max(1e-4, bbUpdated.max.x - bbUpdated.min.x);
            const dy = Math.max(1e-4, bbUpdated.max.y - bbUpdated.min.y);
            const fallbackUvs = new Float32Array(pos.count * 2);
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              fallbackUvs[i * 2] = 0.04 + 0.92 * Math.max(0, Math.min(1, (x - bbUpdated.min.x) / dx));
              fallbackUvs[i * 2] = Math.max(0.03, Math.min(0.97, fallbackUvs[i * 2]));
              fallbackUvs[i * 2 + 1] = 0.04 + 0.92 * Math.max(0, Math.min(1, (y - bbUpdated.min.y) / dy));
            }
            geo.setAttribute('uv', new THREE.BufferAttribute(fallbackUvs, 2));
          }
        }
      }
    }
    if (morphField && morphInfluences && Object.keys(morphInfluences).length > 0) {
      try {
        const sleeveStyle = detectSleeveStyle({ garmentText, rawSlot });
        const hasSleeves = sleeveStyle.type !== 'sleeveless';
        const includeArmsForSlot = ['top', 'outerwear', 'dress'].includes(rawSlot) ? hasSleeves : rawSlot === 'watch';
        geo = applyAvatarMorphsToGeometry(geo, morphField, morphInfluences, {
          minClearance: layerOffset + extraLayerOffset,
          includeArms: includeArmsForSlot,
          exactLowerBody: rawSlot === 'shoes' || (rawSlot === 'bottom' && !shellFit?.isSkirt),
        });
      } catch (e) {
        // proceed with base geo
      }
    }

    // Outward radial clearance from anatomical centerline (preserves both inner & outer walls of solidified GLBs)
    // Ensures outerwear (blazers, coats, jackets) always clears inner tops AND trousers/skirts without z-fighting!
    const isInnerTopUnderOuterwear = rawSlot === 'top' && hasOuterwear;
    const isUntuckedTopOverBottom = rawSlot === 'top' && hasBottom && !hasOuterwear && !shouldTuck && !/(?:\btuck|bodysuit|בגד גוף\b)/i.test(garmentText);
    const baseSlotBoost = rawSlot === 'outerwear'
      ? (hasBottom ? 0.0175 : 0.0085)
      : (isUntuckedTopOverBottom ? 0.0085 : (rawSlot === 'top' ? 0.0020 : 0));
    const radialBoost = baseSlotBoost + (Number.isFinite(extraLayerOffset) ? extraLayerOffset : 0);
    if (geo && geo.attributes?.position && Math.abs(radialBoost) > 1e-5) {
      const pos = geo.attributes.position;
      const yCrotch = isMale ? 0.86 : 0.82;
      const isBottomSlot = rawSlot === 'bottom';
      const isSkirtSlot = Boolean(shellFit?.isSkirt);
      const isCoreTopSlot = ['top', 'outerwear', 'dress'].includes(rawSlot);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        let cx = 0;
        let cz = 0;
        let allowInnerX = true;
        let localBoost = radialBoost;
        if (isBottomSlot && !isSkirtSlot && y < yCrotch) {
          const legSlice = getLegSlice(y, isMale);
          const side = x < 0 ? -1 : 1;
          cx = side * legSlice.cx;
          cz = legSlice.cz;
          if (side * (x - cx) < 0 && y > yCrotch - 0.12) allowInnerX = false;
        } else if (isCoreTopSlot) {
          const xArmpitSplit = isMale
            ? (0.180 + Math.max(0, 1.28 - y) * 0.42)
            : (0.150 + Math.max(0, 1.20 - y) * 0.40);
          const tArm = Math.max(0, Math.min(1, (Math.abs(x) - (xArmpitSplit - 0.025)) / 0.050));
          const wArm = tArm * tArm * (3 - 2 * tArm);
          const side = x < 0 ? -1 : 1;
          const armCx = isMale
            ? (y >= 1.26 ? Math.max(0.215, 0.284 - (y - 1.26) * 0.95) : 0.284 + (1.26 - y) * 0.580)
            : (y >= 1.22 ? Math.max(0.165, 0.211 - (y - 1.22) * 1.10) : 0.211 + (1.22 - y) * 0.628);
          const armCz = isMale ? 0.004 : 0.008;
          const sleeveBoost = (rawSlot === 'outerwear' ? 0.0080 : 0.0025) +
            (Number.isFinite(extraLayerOffset) ? extraLayerOffset : 0);

          const torsoCz = getTorsoSlice(Math.max(0.5, y), isMale).cz || 0;
          const yTuckThresh = isMale ? 1.085 : 1.045;
          let torsoBoost;
          if (rawSlot === 'outerwear') {
            const hipWeight = Math.max(0, Math.min(1, (1.24 - y) / 0.16));
            torsoBoost = 0.0075 + (radialBoost - 0.0075) * hipWeight;
          } else if (shouldTuck && y <= yTuckThresh) {
            // Tucked waist/hem gently compresses to stay inside trousers waistband without penetrating skin
            const tTuck = Math.min(1.0, Math.max(0.0, (yTuckThresh - y) / 0.07));
            torsoBoost = (0.0025 * (1.0 - tTuck) + 0.0008 * tTuck) + (Number.isFinite(extraLayerOffset) ? extraLayerOffset : 0);
          } else if (isUntuckedTopOverBottom) {
            const hipWeight = Math.max(0, Math.min(1, (1.24 - y) / 0.16));
            torsoBoost = 0.0025 + (radialBoost - 0.0025) * hipWeight;
          } else {
            torsoBoost = 0.0025 + (Number.isFinite(extraLayerOffset) ? extraLayerOffset : 0);
          }

          cx = (1 - wArm) * 0 + wArm * (side * armCx);
          cz = (1 - wArm) * torsoCz + wArm * armCz;
          localBoost = (1 - wArm) * torsoBoost + wArm * sleeveBoost;
          if (wArm > 0.5 && side * (x - (side * armCx)) < 0) {
            allowInnerX = false;
          }
        } else {
          cz = getTorsoSlice(Math.max(0.5, y), isMale).cz || 0;
        }
        const dx = x - cx;
        const dz = z - cz;
        const r = Math.hypot(dx, dz);
        if (r > 1e-4) {
          const pushX = allowInnerX ? (dx / r) * localBoost : 0;
          const pushZ = (dz / r) * localBoost;
          pos.setXYZ(i, x + pushX, y, z + pushZ);
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // Split geometry faces into front and back spatial groups around the anatomical cross-section centerline cz(y),
    // keeping both walls of solidified GLB templates paired on the correct anterior (+Z) or posterior (-Z) half.
    if (geo && geo.index) {
      const pos = geo.attributes.position;
      const idx = geo.index.array;
      const frontTriangles = [];
      const backTriangles = [];
      const pA = new THREE.Vector3();
      const pB = new THREE.Vector3();
      const pC = new THREE.Vector3();
      const yCrotch = isMale ? 0.86 : 0.82;
      const isBottomBifurcated = rawSlot === 'bottom' && !shellFit?.isSkirt;
      const isCoreTopSlot = ['top', 'outerwear', 'dress'].includes(rawSlot);

      for (let i = 0; i < idx.length; i += 3) {
        const i0 = idx[i], i1 = idx[i + 1], i2 = idx[i + 2];
        pA.fromBufferAttribute(pos, i0);
        pB.fromBufferAttribute(pos, i1);
        pC.fromBufferAttribute(pos, i2);
        const midX = (pA.x + pB.x + pC.x) / 3;
        const midY = (pA.y + pB.y + pC.y) / 3;
        const midZ = (pA.z + pB.z + pC.z) / 3;
        let splitZ = 0.005;
        if (isBottomBifurcated && midY < yCrotch) {
          splitZ = getLegSlice(midY, isMale).cz || 0;
        } else if (isCoreTopSlot) {
          const xArmpitSplit = isMale
            ? (0.180 + Math.max(0, 1.28 - midY) * 0.42)
            : (0.150 + Math.max(0, 1.20 - midY) * 0.40);
          splitZ = Math.abs(midX) > xArmpitSplit
            ? (isMale ? 0.004 : 0.008)
            : (getTorsoSlice(Math.max(0.5, midY), isMale).cz || 0);
        } else if (['bottom', 'belt'].includes(rawSlot)) {
          splitZ = getTorsoSlice(Math.max(0.5, midY), isMale).cz || 0;
        }
        if (midZ < splitZ) {
          backTriangles.push(i0, i1, i2);
        } else {
          frontTriangles.push(i0, i1, i2);
        }
      }
      if (backTriangles.length > 0) {
        const newIdx = new (idx.constructor)(frontTriangles.length + backTriangles.length);
        newIdx.set(frontTriangles, 0);
        newIdx.set(backTriangles, frontTriangles.length);
        geo.setIndex(new THREE.BufferAttribute(newIdx, 1));
        geo.clearGroups();
        geo.addGroup(0, frontTriangles.length, 0);
        geo.addGroup(frontTriangles.length, backTriangles.length, 1);
      } else {
        geo.clearGroups();
        geo.addGroup(0, idx.length, 0);
      }
    }

    return geo;
  }, [gltf, fallbackGeometry, morphField, morphInfluences, layerOffset, extraLayerOffset, rawSlot, garmentText, isMale, hasBottom, hasOuterwear, shellFit, fitProfile, templateId, texture]);

  const materials = useMemo(() => {
    const hasFrontTex = Boolean(texture);
    const hasBackTex = Boolean(backTexture);
    const fallbackCol = dominantColor && dominantColor !== '#ffffff' && dominantColor !== '#222226' && dominantColor !== '#18181B' ? dominantColor : '#CBD5E1';
    const isCoreClothing = ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot);
    const baseProps = {
      roughness: pbrProps?.roughness ?? 0.70,
      metalness: pbrProps?.metalness ?? 0.05,
      side: THREE.DoubleSide,
      transparent: !isCoreClothing,
      alphaTest: isCoreClothing ? 0 : 0.15,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (rawSlot === 'top' && hasBottom ? 1 : -1))),
      polygonOffsetUnits: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (rawSlot === 'top' && hasBottom ? 1 : -1))),
    };
    const frontMat = new THREE.MeshStandardMaterial({
      ...baseProps,
      color: hasFrontTex ? '#FFFFFF' : fallbackCol,
      map: texture || null,
    });
    const backMat = new THREE.MeshStandardMaterial({
      ...baseProps,
      color: hasBackTex ? '#FFFFFF' : fallbackCol,
      map: backTexture || null,
    });
    return [frontMat, backMat];
  }, [texture, backTexture, dominantColor, pbrProps, rawSlot]);

  useEffect(() => {
    return () => {
      if (geometry && geometry !== fallbackGeometry) {
        geometry.dispose?.();
      }
      materials.forEach((m) => m?.dispose?.());
    };
  }, [geometry, fallbackGeometry, materials]);

  if (!geometry) return null;

  return (
    <>
      {!['shoes_boots', 'shoes_sneakers', 'boots', 'sneakers'].includes(templateId) && heelGeometry && (
        <mesh geometry={heelGeometry} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial
            color={dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#1e293b'}
            roughness={0.35}
            metalness={0.12}
          />
        </mesh>
      )}
      <mesh
        name={`garment-template-${templateId}`}
        geometry={geometry}
        material={materials}
        castShadow
        receiveShadow
        renderOrder={renderOrder}
      />
    </>
  );
}

export function GarmentTemplateMesh(props) {
  const {
    templateId,
    isMale = false,
    fallbackNode = null,
  } = props;
  const url = getTemplateGlbUrl(templateId, isMale);

  if (!url) return fallbackNode;

  return (
    <GarmentTemplateErrorBoundary key={url} url={url} fallback={fallbackNode}>
      <Suspense fallback={fallbackNode}>
        <GarmentTemplateMeshInner {...props} url={url} />
      </Suspense>
    </GarmentTemplateErrorBoundary>
  );
}

export function GarmentMeshCore({
  garment,
  slot,
  isMale = false,
  visible = true,
  hasOuterwear = false,
  hasBottom = false,
  hasTop = false,
  morphInfluences = null,
  footPose = null,
  showAvatar = true,
  standaloneMode = false,
  bypassSilhouette = false,
  morphField = null,
  extraLayerOffset = 0,
  renderOrderOffset = 0,
}) {
  const isStandalone = Boolean(!showAvatar || standaloneMode);
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

  // ── Silhouette shell fit: resolve early so base geometry and templates can safely use shellFit parameters ──
  const shellFit = useMemo(
    () => resolveShellFit({ rawSlot, garmentText, isMale, hasOuterwear, hasBottom, garment, aspect }),
    [rawSlot, garmentText, isMale, hasOuterwear, hasBottom, garment, aspect]
  );
  const fitProfile = useMemo(
    () => analyzeGarmentFit({
      garment,
      rawSlot,
      garmentText,
      shellMask,
      isSkirt: Boolean(shellFit?.isSkirt),
    }),
    [garment, rawSlot, garmentText, shellMask, shellFit]
  );

  // Build the appropriate 3D geometry matching this slot and garment type
  // (authored in the avatar's base, un-morphed coordinate space)
  const baseGeometry = useMemo(() => {
    if (!visible) return null;

    // Morph-driven reshaping is applied afterwards via the avatar morph field
    const yShift = 0;
    const rxShift = Number.isFinite(extraLayerOffset) ? extraLayerOffset : 0;

    // 1. TOP
    if (rawSlot === 'top') {
      const isCrop = garmentText.includes('crop') || garmentText.includes('sports_bra') || garmentText.includes('bralette') || garmentText.includes('קרופ') || garmentText.includes('חזיה');
      const isLongline = garmentText.includes('kurta') || garmentText.includes('tunic') || garmentText.includes('longline') || garmentText.includes('thobe') || garmentText.includes('טוניקה');
      const sleeveStyle = detectSleeveStyle({ garmentText, rawSlot: 'top', aspect });
      const necklineStyle = detectNecklineStyle({ garmentText, garment });
      const isStraplessTop = shellFit?.isStrapless || necklineStyle === 'strapless';

      let yTopBase = isMale ? 1.52 : 1.46;
      if (isStraplessTop) {
        yTopBase = isMale ? 1.34 : 1.28;
      } else if (necklineStyle === 'v_neck' || necklineStyle === 'scoop') {
        yTopBase = isMale ? 1.44 : 1.38;
      } else if (necklineStyle === 'high_neck') {
        yTopBase = isMale ? 1.54 : 1.48;
      } else if (necklineStyle === 'crew_neck' || necklineStyle === 'collared' || necklineStyle === 'standard') {
        yTopBase = isMale ? 1.52 : 1.46;
      }
      const yTop = yTopBase + yShift;
      let yBottom = (isMale ? 0.96 : 0.92) + yShift;
      if (isCrop) yBottom = (isMale ? 1.18 : 1.12) + yShift;
      if (isLongline) yBottom = (isMale ? 0.75 : 0.70) + yShift;

      const isExplicitOuterwear = /(?:coat|overcoat|trench|jacket|blazer|parka|puffer|מעיל|ז['’]קט|ג['’]קט|בלייזר)/i.test(garmentText);
      const isTuckable = !isExplicitOuterwear;
      const isTucked = hasBottom && isTuckable;
      const layerOffset = ((hasOuterwear || isTucked) ? LAYER_COLLISION_OFFSETS.base_top : LAYER_COLLISION_OFFSETS.mid_layer) + rxShift;

      return createAnatomicalTopGeometry({
        isMale,
        hasSleeves: !hasOuterwear && !isStraplessTop && sleeveStyle.type !== 'sleeveless',
        sleeveFactor: hasOuterwear || isStraplessTop ? 0 : sleeveStyle.factor,
        yTop,
        yBottom,
        layerOffset,
        uSwatch: solidU,
        vSwatch: solidV,
        standalone: isStandalone,
        isTucked,
      });
    }

    // 2. OUTERWEAR (Blazers, Suits, Coats, Jackets, Cardigans)
    if (rawSlot === 'outerwear') {
      const isMaxi = garmentText.includes('maxi') || garmentText.includes('מקסי') || garmentText.includes('ankle') || garmentText.includes('קרסול') || garmentText.includes('duster');
      const isCropJacket = garmentText.includes('bolero') || garmentText.includes('shrug') || garmentText.includes('עליונית קצרה') || garmentText.includes('קרופ') || (garmentText.includes('jacket') && garmentText.includes('crop'));
      const isExplicitCoatKeyword = (
        garmentText.includes('overcoat') || garmentText.includes('trench') || garmentText.includes('trenchcoat') ||
        garmentText.includes('duster') || garmentText.includes('coat') || garmentText.includes('parka') ||
        garmentText.includes('raincoat') || garmentText.includes('mac') || garmentText.includes('robe') ||
        garmentText.includes('מעיל') || garmentText.includes('טרנץ') || garmentText.includes('חלוק') ||
        garmentText.includes('manteau') || garmentText.includes('mantel') || garmentText.includes('cappotto') ||
        garmentText.includes('abrigo') || garmentText.includes('пальто') || garmentText.includes('плащ')
      );
      const isStandardBlazerOrJacket = !isExplicitCoatKeyword && (
        garmentText.includes('blazer') || garmentText.includes('suit') || garmentText.includes('jacket') ||
        garmentText.includes('bomber') || garmentText.includes('biker') || garmentText.includes('denim') ||
        garmentText.includes('windbreaker') || garmentText.includes('vest') || garmentText.includes('gilet') ||
        garmentText.includes('בלייזר') || garmentText.includes('חליפה') || garmentText.includes('ז\'קט') ||
        garmentText.includes('ז׳קט') || garmentText.includes('ג\'קט') || garmentText.includes('ג׳קט') ||
        garmentText.includes('בומבר') || garmentText.includes('וסט') || garmentText.includes('אפודה')
      );
      const isExplicitShortJacket = (garmentText.includes('bomber') || garmentText.includes('biker') || garmentText.includes('בומבר') || garmentText.includes('קצר') || garmentText.includes('קצרה')) && !isExplicitCoatKeyword;
      const isLongCoat = isMaxi || (!isCropJacket && !isExplicitShortJacket && !isStandardBlazerOrJacket && (
        isExplicitCoatKeyword || (garmentText.includes('cardigan') && (garmentText.includes('long') || garmentText.includes('ארוך') || garmentText.includes('ארוכה'))) || aspect <= 0.88
      ));
      const sleeveStyle = detectSleeveStyle({ garmentText, rawSlot: 'outerwear', aspect });

      // Outerwear collar stands at 1.48 (F) / 1.54 (M), shoulder line overlays avatar shoulder line at 1.42 (F) / 1.48 (M)
      const yTop = (isMale ? 1.54 : 1.48) + yShift;
      let yBottom = (isMale ? 0.89 : 0.85) + yShift;
      if (isMaxi) yBottom = (isMale ? 0.22 : 0.18) + yShift;
      else if (isLongCoat) yBottom = (isMale ? 0.52 : 0.48) + yShift;
      else if (isCropJacket) yBottom = (isMale ? 1.15 : 1.10) + yShift;

      // Layer 7 (+0.016m): layered cleanly outside tops and bottoms
      const layerOffset = LAYER_COLLISION_OFFSETS.outerwear + rxShift;

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
        layerOffset: LAYER_COLLISION_OFFSETS.mid_layer + rxShift,
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
        layerOffset: LAYER_COLLISION_OFFSETS.bottom + rxShift,
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

    // 6. ACCESSORIES (watch, necktie/scarf, belt, headwear, glasses, bag)
    const accessoryLayerOffset =
      rawSlot === 'necktie'
        ? LAYER_COLLISION_OFFSETS.outer_accessory
        : rawSlot === 'belt'
          ? LAYER_COLLISION_OFFSETS.belt
          : LAYER_COLLISION_OFFSETS.outer_accessory;
    return createAnatomicalAccessoryGeometry(rawSlot, {
      isMale,
      layerOffset: accessoryLayerOffset + rxShift,
      hasBottom,
      hasOuterwear,
      garmentText,
    });
  }, [visible, rawSlot, garmentText, isMale, hasOuterwear, hasBottom, autoHasSleeves, aspect, solidU, solidV, footwearSpec, shoeLayout, isStandalone, shellFit, garment, extraLayerOffset]);

  const geometry = useMemo(() => {
    const isRigidAccessory = rawSlot === 'headwear' || rawSlot === 'glasses';
    const morphed = isStandalone
      ? baseGeometry
      : applyAvatarMorphsToGeometry(baseGeometry, morphField, morphInfluences, {
          includeArms: rawSlot === 'watch',
          rigidAnchor: isRigidAccessory,
          exactLowerBody: rawSlot === 'shoes' || (rawSlot === 'bottom' && !shellFit?.isSkirt),
        });
    // Footwear follows the heeled foot pose applied to the avatar
    return rawSlot === 'shoes' ? poseGeometry(morphed, footPose) : morphed;
  }, [baseGeometry, morphField, morphInfluences, rawSlot, footPose, isStandalone]);

  // ── Silhouette shell: the garment keeps its own photographed outline ──
  const shell = useMemo(() => {
    if (!visible || !shellFit || !shellMask || bypassSilhouette) return null;
    try {
      const built = buildSilhouetteShell({
        fitProfile,
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
        layerOffset: (shellFit.layerOffset || 0) + (Number.isFinite(extraLayerOffset) ? extraLayerOffset : 0),
        fabricThickness: shellFit.fabricThickness,
        poseSleeves: false,
        hasOuterwear,
        sideProfile,
        getTorsoSlice,
        getLegSlice,
      });
      return built.ok ? built : null;
    } catch (err) {
      console.warn('Silhouette shell unavailable, using procedural fallback:', err);
      return null;
    }
  }, [visible, shellFit, fitProfile, shellMask, aspect, rawSlot, isMale, isStandalone, hasOuterwear, sideProfile, bypassSilhouette, extraLayerOffset]);
  const shellGeos = useMemo(() => {
    if (!shell) return null;
    if (isStandalone) {
      return { front: shell.front, back: shell.back };
    }
    const minClearance = Number.isFinite(shellFit?.fabricThickness)
      ? shellFit.fabricThickness
      : (rawSlot === 'bottom' ? 0.0018 : 0.0020);
    const isTopOrOuter = ['top', 'outerwear'].includes(rawSlot);
    const isDressWithSleeves = rawSlot === 'dress' && autoHasSleeves;
    const includeArmsInShell = (isTopOrOuter && autoHasSleeves) || isDressWithSleeves;
    return {
      front: applyAvatarMorphsToGeometry(shell.front, morphField, morphInfluences, {
        sheetSide: 'front',
        minClearance,
        includeArms: includeArmsInShell,
      }),
      back: applyAvatarMorphsToGeometry(shell.back, morphField, morphInfluences, {
        sheetSide: 'back',
        minClearance,
        includeArms: includeArmsInShell,
      }),
    };
  }, [shell, shellFit, morphField, morphInfluences, isStandalone, rawSlot, autoHasSleeves]);

  const heelGeometry = useMemo(
    () => (rawSlot === 'shoes' && visible && footwearSpec && footwearSpec.heelHeight >= 0.02
      ? createHeelGeometry({ isMale, spec: footwearSpec, pose: footPose })
      : null),
    [rawSlot, visible, isMale, footwearSpec, footPose]
  );

  const matchedTemplateId = useMemo(() => {
    return resolveGarmentTemplate({
      rawSlot,
      garmentText,
      aspect,
      slot: slot || garment?.slot,
      category: garment?.category || garment?.rawItem?.category,
    });
  }, [rawSlot, garmentText, aspect, slot, garment]);

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

  const isTuckableTop = rawSlot === 'top' &&
    !['jacket', 'top_outerwear_jacket', 'coat', 'trench_coat', 'cardigan', 'jacket_blazer'].includes(matchedTemplateId) &&
    !/(?:overcoat|trench|jacket|blazer|coat|מעיל|ז['’]קט|ג['’]קט|בלייזר)/i.test(garmentText);
  const shouldTuck = isTuckableTop && hasBottom;
  const isOpaqueSlot = ['top', 'outerwear', 'dress', 'bottom', 'shoes', 'belt', 'necktie', 'watch'].includes(rawSlot);

  const fallbackMaterials = useMemo(() => {
    const fallbackCol = dominantColor && dominantColor !== '#ffffff' && dominantColor !== '#222226' && dominantColor !== '#18181B' ? dominantColor : '#CBD5E1';
    const isCoreClothing = ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot);
    const baseProps = {
      roughness: pbrProps.roughness,
      metalness: pbrProps.metalness,
      envMapIntensity: pbrProps.envMapIntensity,
      side: THREE.DoubleSide,
      transparent: !isCoreClothing && !isOpaqueSlot,
      alphaTest: isOpaqueSlot ? 0 : 0.02,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (shouldTuck ? -1 : -2))),
      polygonOffsetUnits: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (shouldTuck ? -1 : -2))),
    };
    const frontMap = (rawSlot === 'shoes'
      ? (filledTexture || opaqueTexture || texture)
      : ['top', 'outerwear', 'dress', 'bottom', 'belt', 'necktie', 'watch'].includes(rawSlot)
        ? (filledTexture || opaqueTexture || texture)
        : texture) || null;
    const frontCol = rawSlot === 'shoes'
      ? ((opaqueTexture || texture) ? '#FFFFFF' : (dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#94A3B8'))
      : (texture ? '#FFFFFF' : dominantColor || '#CBD5E1');

    const frontMat = new THREE.MeshStandardMaterial({
      ...baseProps,
      color: frontCol,
      map: frontMap,
    });
    const backMat = new THREE.MeshStandardMaterial({
      ...baseProps,
      color: rawSlot === 'shoes'
        ? frontCol
        : (backTexture ? '#FFFFFF' : fallbackCol),
      map: (rawSlot === 'shoes' ? frontMap : backTexture) || null,
    });
    return [frontMat, backMat];
  }, [filledTexture, opaqueTexture, texture, backTexture, dominantColor, pbrProps, rawSlot, isOpaqueSlot, shouldTuck]);

  useEffect(() => {
    return () => {
      fallbackMaterials.forEach((m) => m?.dispose?.());
    };
  }, [fallbackMaterials]);

  if (!visible || !garment) return null;

  const isAccessory = ['belt', 'glasses', 'watch', 'headwear', 'bag', 'jewelry', 'necktie', 'scarf', 'accessory'].includes(rawSlot);
  const isClothing = ['top', 'outerwear', 'dress', 'bottom'].includes(rawSlot);
  const isCoreClothing = isClothing;
  // Never render untextured solid black/opaque meshes before the garment texture is loaded,
  // unless a matched 3D template exists (which renders safely with dominantColor fallback).
  if (!textureReady && !matchedTemplateId && !isAccessory) return null;
  if (!isAccessory && !isClothing && !texture && !filledTexture && !opaqueTexture) return null;

  const renderOrder = resolveGarmentRenderOrder(rawSlot, garmentText, shouldTuck) + (Number.isFinite(renderOrderOffset) ? renderOrderOffset * 0.1 : 0);

  const fallbackProceduralMesh = geometry ? (
    <>
      {heelGeometry && (
        <mesh geometry={heelGeometry} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial
            color={dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#1e293b'}
            roughness={0.35}
            metalness={0.12}
          />
        </mesh>
      )}
      <mesh
        geometry={geometry}
        material={geometry?.groups?.length > 1 ? fallbackMaterials : fallbackMaterials[0]}
        castShadow
        receiveShadow
        renderOrder={renderOrder}
      />
    </>
  ) : null;

  // 1. Dedicated Canonical 3D Templates (Reproduced from Avatar Body via Blender):
  //    Rendered in 3D Tailored mode (default) and whenever a canonical 3D template matches,
  //    so garments wrap smoothly around the avatar with full 3D continuous volume (no flat razor-blade sheets).
  if (matchedTemplateId && (!shellGeos || bypassSilhouette)) {
    return (
      <GarmentTemplateMesh
        templateId={matchedTemplateId}
        texture={filledTexture || opaqueTexture || texture}
        backTexture={backTexture}
        dominantColor={dominantColor}
        pbrProps={pbrProps}
        renderOrder={renderOrder}
        morphField={morphField}
        morphInfluences={morphInfluences}
        rawSlot={rawSlot}
        garmentText={garmentText}
        isMale={isMale}
        hasBottom={hasBottom}
        hasOuterwear={hasOuterwear}
        layerOffset={shellFit?.layerOffset || 0}
        extraLayerOffset={extraLayerOffset}
        shellFit={shellFit}
        fitProfile={fitProfile}
        fallbackGeometry={geometry}
        heelGeometry={heelGeometry}
        fallbackNode={fallbackProceduralMesh}
      />
    );
  }

  // 2. Photo Cutout Silhouette Shell (when user explicitly selects photo cutout mode)
  if (isCoreClothing && shellGeos && texture && !bypassSilhouette) {
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
      polygonOffsetFactor: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (rawSlot === 'top' && hasBottom ? 1 : -1))),
      polygonOffsetUnits: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (rawSlot === 'top' && hasBottom ? 1 : -1))),
    };
    return (
      <>
        <mesh name="garment-front-sheet" geometry={shellGeos.front} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial map={texture} {...shellMaterialProps} />
        </mesh>
        <mesh name="garment-back-sheet" geometry={shellGeos.back} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial map={backTexture || null} color={backTexture ? '#FFFFFF' : (dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#CBD5E1')} {...shellMaterialProps} />
        </mesh>
      </>
    );
  }

  if (matchedTemplateId) {
    return (
      <GarmentTemplateMesh
        templateId={matchedTemplateId}
        texture={filledTexture || opaqueTexture || texture}
        backTexture={backTexture}
        dominantColor={dominantColor}
        pbrProps={pbrProps}
        renderOrder={renderOrder}
        morphField={morphField}
        morphInfluences={morphInfluences}
        rawSlot={rawSlot}
        garmentText={garmentText}
        isMale={isMale}
        hasBottom={hasBottom}
        hasOuterwear={hasOuterwear}
        layerOffset={shellFit?.layerOffset || 0}
        extraLayerOffset={extraLayerOffset}
        shellFit={shellFit}
        fitProfile={fitProfile}
        fallbackGeometry={geometry}
        heelGeometry={heelGeometry}
        fallbackNode={fallbackProceduralMesh}
      />
    );
  }

  // 3. Fallback to silhouette shell if available
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
      polygonOffsetFactor: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (rawSlot === 'top' && hasBottom ? 1 : -1))),
      polygonOffsetUnits: rawSlot === 'outerwear' ? -7 : (rawSlot === 'belt' ? -5 : (rawSlot === 'bottom' ? -4 : (rawSlot === 'top' && hasBottom ? 1 : -1))),
    };
    return (
      <>
        <mesh name="garment-front-sheet" geometry={shellGeos.front} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial map={texture} {...shellMaterialProps} />
        </mesh>
        <mesh name="garment-back-sheet" geometry={shellGeos.back} castShadow receiveShadow renderOrder={renderOrder}>
          <meshStandardMaterial map={backTexture || null} color={backTexture ? '#FFFFFF' : (dominantColor && dominantColor !== '#ffffff' ? dominantColor : '#CBD5E1')} {...shellMaterialProps} />
        </mesh>
      </>
    );
  }

  return fallbackProceduralMesh;
}


function StandaloneGarmentMesh(props) {
  // In standalone mode (Zara 3D garment studio), the human avatar is hidden.
  // Avoid loading the 18 MB avatar GLB over the network; garments render directly from their template/cutout.
  return <GarmentMeshCore {...props} morphField={null} />;
}

function AvatarFittedGarmentMesh(props) {
  // Only download & build the 18 MB avatar morph field when the avatar is actually shown
  const { scene: avatarScene } = useGLTF(props.isMale ? MALE_GLB_URL : FEMALE_GLB_URL, '/draco/');
  const morphField = useMemo(() => buildAvatarMorphField(avatarScene), [avatarScene]);
  return <GarmentMeshCore {...props} morphField={morphField} />;
}

export default function GarmentMesh3D(props) {
  const isStandalone = Boolean(props.standaloneMode || !props.showAvatar);
  if (isStandalone) {
    return <StandaloneGarmentMesh {...props} />;
  }
  return <AvatarFittedGarmentMesh {...props} />;
}
