/**
 * Multilingual fashion & style synonyms for search across tags, categories, and attributes.
 * Bridges Hebrew <-> English (and other common synonyms) so users searching in any language
 * match items tagged or titled in either language.
 */

export const FASHION_SYNONYMS: Record<string, string[]> = {
  // Work / Business / Formal
  work: ["work", "workwear", "office", "business", "business casual", "smart casual", "formal", "עבודה", "משרד", "מחויט"],
  workwear: ["work", "workwear", "office", "business", "tradesmen", "utility", "עבודה", "משרד"],
  office: ["work", "workwear", "office", "business", "smart casual", "formal", "עבודה", "משרד"],
  business: ["work", "business", "business casual", "smart casual", "formal", "office", "עבודה", "עסקים", "מחויט"],
  "business casual": ["business", "business casual", "smart casual", "work", "office", "עבודה", "משרד"],
  "smart casual": ["smart casual", "business casual", "business", "work", "office", "elegant", "אלגנטי", "עבודה"],
  formal: ["formal", "elegant", "smart casual", "suit", "blazer", "אלגנטי", "רשמי", "חגיגי", "חליפה"],
  elegant: ["formal", "elegant", "smart casual", "אלגנטי", "חגיגי"],
  עבודה: ["עבודה", "work", "workwear", "office", "business", "business casual", "smart casual", "tradesmen", "utility"],
  משרד: ["משרד", "office", "work", "business", "smart casual", "עבודה"],
  אלגנטי: ["אלגנטי", "elegant", "formal", "smart casual", "suit", "חגיגי", "ערב"],
  מחויט: ["מחויט", "tailored", "suit", "formal", "business", "trousers"],
  רשמי: ["רשמי", "formal", "suit", "elegant"],

  // Casual / Everyday
  casual: ["casual", "everyday", "daily", "relaxed", "streetwear", "tee", "t-shirt", "יומיום", "יומיומי", "קז'ואל", "פשוט"],
  everyday: ["casual", "everyday", "daily", "יומיום", "יומיומי", "קז'ואל"],
  daily: ["casual", "everyday", "daily", "יומיום", "יומיומי"],
  יומיום: ["יומיום", "יומיומי", "קז'ואל", "casual", "everyday", "daily"],
  יומיומי: ["יומיום", "יומיומי", "קז'ואל", "casual", "everyday", "daily"],
  "קז'ואל": ["קז'ואל", "casual", "everyday", "יומיום", "יומיומי"],
  streetwear: ["streetwear", "urban", "casual", "hoodie", "graphic"],

  // Sport / Active / Workout / Gym
  sport: ["sport", "sports", "athletic", "workout", "gym", "activewear", "performance", "training", "running", "fitness", "ספורט", "כושר", "אימון"],
  sports: ["sport", "sports", "athletic", "workout", "gym", "activewear", "performance", "training", "running", "fitness", "ספורט", "כושר", "אימון"],
  athletic: ["sport", "sports", "athletic", "workout", "gym", "activewear", "performance", "ספורט", "כושר"],
  workout: ["workout", "gym", "athletic", "sport", "fitness", "training", "אימון", "כושר", "ספורט"],
  gym: ["gym", "workout", "athletic", "sport", "fitness", "חדר כושר", "אימון", "ספורט"],
  fitness: ["fitness", "gym", "workout", "athletic", "sport", "כושר", "אימון"],
  running: ["running", "runners", "athletic", "sport", "ריצה", "ספורט"],
  ספורט: ["ספורט", "sport", "sports", "athletic", "workout", "gym", "activewear", "fitness", "כושר", "אימון"],
  אימון: ["אימון", "workout", "gym", "athletic", "sport", "fitness", "כושר", "ספורט"],
  כושר: ["כושר", "fitness", "gym", "workout", "athletic", "sport", "אימון", "ספורט"],

  // Seasons & Weather
  summer: ["summer", "pool", "beach", "swim", "swimwear", "hot", "sun", "קיץ", "ים", "בריכה"],
  beach: ["beach", "pool", "swim", "swimwear", "summer", "ים", "חוף", "בריכה"],
  קיץ: ["קיץ", "summer", "beach", "pool", "swim", "swimwear", "ים", "בריכה", "חוף"],
  winter: ["winter", "cold", "snow", "warm", "coat", "jacket", "sweater", "חורף", "קר"],
  חורף: ["חורף", "winter", "cold", "coat", "jacket", "sweater", "warm", "קר"],
  spring: ["spring", "floral", "light", "אביב"],
  אביב: ["אביב", "spring", "light"],
  autumn: ["autumn", "fall", "סתיו"],
  fall: ["fall", "autumn", "סתיו"],
  סתיו: ["סתיו", "autumn", "fall"],

  // Garment Types & Categories
  shirt: ["shirt", "t-shirt", "tee", "top", "blouse", "polo", "button", "חולצה", "טי שירט", "פולו", "מכופתרת"],
  "t-shirt": ["t-shirt", "tshirt", "tee", "shirt", "top", "חולצה", "טי שירט"],
  tee: ["t-shirt", "tee", "shirt", "top", "חולצה"],
  top: ["top", "shirt", "t-shirt", "tee", "blouse", "sweater", "tank", "חולצה", "טופ"],
  blouse: ["blouse", "shirt", "top", "חולצה"],
  polo: ["polo", "shirt", "top", "פולו", "חולצת פולו"],
  חולצה: ["חולצה", "shirt", "t-shirt", "tee", "top", "blouse", "polo", "טי שירט", "מכופתרת"],
  "טי שירט": ["טי שירט", "t-shirt", "tee", "shirt", "חולצה"],
  מכופתרת: ["מכופתרת", "button", "dress shirt", "collared", "shirt"],

  pants: ["pants", "trousers", "shorts", "jeans", "chinos", "cargo", "slacks", "bottom", "מכנסיים", "מכנס", "ג'ינס", "שורטס"],
  trousers: ["pants", "trousers", "chinos", "slacks", "bottom", "מכנסיים"],
  shorts: ["shorts", "cargo shorts", "short", "שורטס", "מכנסיים קצרים", "קצרים"],
  jeans: ["jeans", "denim", "ג'ינס", "דנים"],
  denim: ["denim", "jeans", "ג'ינס", "דנים"],
  cargo: ["cargo", "tactical", "utility", "multi-pocket", "דגמ\"ח", "דגמח"],
  מכנסיים: ["מכנסיים", "pants", "trousers", "jeans", "shorts", "bottom", "מכנס", "ג'ינס"],
  "מכנסיים קצרים": ["מכנסיים קצרים", "shorts", "קצרים", "שורטס"],
  קצרים: ["shorts", "קצרים", "מכנסיים קצרים", "שורטס"],
  "ג'ינס": ["ג'ינס", "jeans", "denim"],
  "דגמ\"ח": ["דגמ\"ח", "דגמח", "cargo", "tactical", "utility"],
  דגמח: ["דגמח", "דגמ\"ח", "cargo", "tactical", "utility"],

  dress: ["dress", "dresses", "gown", "one-piece", "שמלה", "שמלות"],
  שמלה: ["שמלה", "dress", "dresses", "gown", "שמלות"],
  skirt: ["skirt", "חצאית"],
  חצאית: ["חצאית", "skirt"],

  shoes: ["shoes", "shoe", "sneakers", "boots", "sandals", "footwear", "loafer", "נעליים", "נעל", "סניקרס", "מגפיים", "סנדלים"],
  sneakers: ["sneakers", "shoes", "athletic", "runners", "סניקרס", "נעלי ספורט", "נעליים"],
  boots: ["boots", "boot", "shoes", "מגפיים", "מגף"],
  sandals: ["sandals", "sandal", "slides", "סנדלים", "סנדל", "כפכפים"],
  נעליים: ["נעליים", "shoes", "shoe", "sneakers", "boots", "sandals", "footwear", "סניקרס", "נעל"],
  סניקרס: ["סניקרס", "sneakers", "shoes", "נעלי ספורט", "נעליים"],
  מגפיים: ["מגפיים", "boots", "נעליים", "מגף"],
  סנדלים: ["סנדלים", "sandals", "shoes"],

  jacket: ["jacket", "coat", "blazer", "outerwear", "windbreaker", "ג'קט", "ז'קט", "מעיל", "בלייזר"],
  blazer: ["blazer", "suit", "jacket", "בלייזר", "חליפה", "ג'קט"],
  suit: ["suit", "blazer", "tuxedo", "tailored", "חליפה", "בלייזר", "מחויט"],
  coat: ["coat", "jacket", "parka", "trench", "overcoat", "מעיל"],
  "ז'קט": ["ז'קט", "ג'קט", "jacket", "coat", "blazer", "מעיל"],
  "ג'קט": ["ג'קט", "ז'קט", "jacket", "coat", "blazer", "מעיל"],
  מעיל: ["מעיל", "coat", "jacket", "parka", "outerwear"],
  חליפה: ["חליפה", "suit", "blazer", "tailored", "מחויט"],
  בלייזר: ["בלייזר", "blazer", "jacket", "suit"],

  // Colors
  black: ["black", "שחור", "שחורה"],
  white: ["white", "לבן", "לבנה"],
  blue: ["blue", "navy", "כחול", "כחולה", "נייבי"],
  navy: ["navy", "blue", "נייבי", "כחול"],
  green: ["green", "olive", "ירוק", "ירוקה", "זית"],
  red: ["red", "burgundy", "אדום", "אדומה", "בורדו"],
  gray: ["gray", "grey", "charcoal", "אפור", "אפורה"],
  grey: ["gray", "grey", "charcoal", "אפור", "אפורה"],
  brown: ["brown", "khaki", "tan", "חום", "חומה", "חאקי"],
  khaki: ["khaki", "beige", "tan", "חאקי", "בז'"],
  שחור: ["שחור", "black"],
  לבן: ["לבן", "white"],
  כחול: ["כחול", "blue", "navy"],
  אפור: ["אפור", "gray", "grey"],
  חאקי: ["חאקי", "khaki", "beige"],
};

/**
 * Given a raw search query, returns an array of normalized search terms
 * including exact query, constituent words, and their fashion synonyms.
 */
export function getSearchNeedles(query?: string | null): string[] {
  if (!query) return [];
  let q = String(query).trim().toLowerCase();
  if (q.startsWith("#")) q = q.slice(1).trim();
  if (!q) return [];

  const set = new Set<string>([q]);

  if (FASHION_SYNONYMS[q]) {
    FASHION_SYNONYMS[q].forEach((s) => set.add(s.toLowerCase()));
  }

  const words = q.split(/[\s,;+]+/).filter(Boolean);
  for (const w of words) {
    set.add(w);
    if (FASHION_SYNONYMS[w]) {
      FASHION_SYNONYMS[w].forEach((s) => set.add(s.toLowerCase()));
    }
  }

  return Array.from(set);
}
