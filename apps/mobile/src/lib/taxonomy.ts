/**
 * apps/mobile/src/lib/taxonomy.ts
 *
 * Taxonomy label helpers and canonical option constants for DressApp Mobile.
 */

import type { TFunction } from 'i18next';

export const CATEGORY_OPTIONS = [
  'Top',
  'Bottom',
  'Full Body',
  'Outerwear',
  'Footwear',
  'Accessories',
] as const;

export const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Top: ['T-Shirt', 'Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Polo', 'Tank Top', 'Crop Top', 'Vest', 'Knitwear'],
  Bottom: ['Jeans', 'Trousers', 'Pants', 'Shorts', 'Skirt', 'Leggings', 'Sweatpants', 'Cargo Pants'],
  'Full Body': ['Dress', 'Jumpsuit', 'Romper', 'Suit', 'Overall', 'Abaya', 'Kaftan'],
  Outerwear: ['Jacket', 'Coat', 'Blazer', 'Trench', 'Cardigan', 'Parka', 'Windbreaker', 'Puffer', 'Bomber'],
  Footwear: ['Sneakers', 'Boots', 'Loafers', 'Sandals', 'Heels', 'Flats', 'Oxfords', 'Slippers', 'Espadrilles'],
  Accessories: ['Bag', 'Belt', 'Hat', 'Scarf', 'Sunglasses', 'Jewelry', 'Watch', 'Tie', 'Gloves', 'Wallet'],
};

export const COLOR_OPTIONS = [
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#F9FAFB' },
  { name: 'Grey', hex: '#6B7280' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Beige', hex: '#D4B996' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Cream', hex: '#FEF3C7' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Olive', hex: '#556B2F' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gold', hex: '#D97706' },
  { name: 'Silver', hex: '#9CA3AF' },
];

export const SEASON_OPTIONS = ['spring', 'summer', 'autumn', 'winter', 'all'] as const;

export const FORMALITY_OPTIONS = ['casual', 'smart-casual', 'business', 'formal'] as const;

export const GENDER_OPTIONS = ['men', 'women', 'unisex', 'kids'] as const;

export const DRESS_CODE_OPTIONS = [
  'casual',
  'smart-casual',
  'business',
  'formal',
  'athletic',
  'loungewear',
] as const;

export const CONDITION_OPTIONS = ['bad', 'fair', 'good', 'excellent'] as const;

export const QUALITY_OPTIONS = ['budget', 'mid', 'premium', 'luxury'] as const;

export const INTENT_OPTIONS = ['own', 'for_sale', 'donate', 'swap', 'rent'] as const;

export const PATTERN_OPTIONS = [
  'solid',
  'striped',
  'plaid',
  'floral',
  'polka_dot',
  'geometric',
  'animal_print',
  'graphic',
  'tie_dye',
  'abstract',
] as const;

const slug = (value?: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const fallback = (t: TFunction, key: string, raw?: string) => {
  try {
    const out = t(key, { defaultValue: raw ?? '' });
    if (!out || typeof out !== 'string' || out === key || out.includes('returned an object instead of string')) {
      return raw ?? '';
    }
    return out;
  } catch {
    return raw ?? '';
  }
};

export const labelForCategory = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  if (code === 'all' || code === '__all__') return fallback(t, 'taxonomy.categories.all', 'All');
  return fallback(t, `taxonomy.categories.${slug(code)}`, code);
};

export const labelForSubCategory = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.subcategories.${slug(code)}`, code);
};

export const labelForSeason = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.charAt(0).toUpperCase() + code.slice(1);
  return fallback(t, `taxonomy.season.${s}`, capitalized);
};

export const labelForFormality = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.dress_code.${s}`, fallback(t, `taxonomy.formality.${s}`, capitalized));
};

export const labelForDressCode = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.dress_code.${s}`, capitalized);
};

export const labelForCondition = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.condition.${s}`, capitalized);
};

export const labelForQuality = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.quality.${s}`, capitalized);
};

export const labelForIntent = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  let normalized = code.toLowerCase().trim();
  if (normalized === 'keep') normalized = 'own';
  if (normalized === 'sell') normalized = 'for_sale';
  const map: Record<string, string> = {
    own: 'Keep',
    for_sale: 'For sale',
    donate: 'Donate',
    swap: 'Swap',
    rent: 'Rent',
  };
  return fallback(t, `addItem.intent_${normalized}`, fallback(t, `taxonomy.intent.${normalized}`, map[normalized] || code));
};

export const labelForColor = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const colorSlug = slug(code);
  const keySingular = `taxonomy.color.${colorSlug}`;
  const keyPlural = `taxonomy.colors.${colorSlug}`;
  return fallback(t, keySingular, fallback(t, keyPlural, code));
};

export const labelForGender = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.gender.${code}`, code);
};

export const labelForState = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.state.${code}`, code);
};

export const labelForSource = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  if (code === 'all') return fallback(t, 'taxonomy.source.all', 'All sources');
  return fallback(t, `taxonomy.source.${code}`, code);
};

export const labelForRole = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.role.${code}`, code);
};

export const labelForItemType = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  return fallback(t, `taxonomy.subcategories.${slug(code)}`, code);
};

export const labelForPattern = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  const s = slug(code);
  const capitalized = code.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return fallback(t, `taxonomy.pattern.${s}`, capitalized);
};

export const labelForProfession = (code?: string, t?: TFunction): string => {
  if (!code) return '';
  if (!t) return code;
  if (code === 'all' || code === '__all__') return fallback(t, 'closet.filterAll', 'All');
  const s = slug(code);
  const canonicalMap: Record<string, string> = {
    fashion_designer: 'designer',
    personal_stylist: 'stylist',
    fashion_stylist: 'stylist',
    stylist: 'stylist',
    tailor: 'tailor',
    seamstress: 'tailor',
    'tailor_/_seamstress': 'tailor',
    barber: 'barber',
    hair_stylist: 'hair_stylist',
    ai_for_fashion: 'ai_fashion',
    ai_fashion: 'ai_fashion',
    personal_shopper: 'shopper',
    shopper: 'shopper',
    wardrobe_consultant: 'consultant',
    consultant: 'consultant',
    color_analyst: 'color',
    color: 'color',
  };
  const mappedSlug = canonicalMap[s] || s;
  return fallback(
    t,
    `experts.professions.${mappedSlug}`,
    fallback(t, `experts.professions.${s}`, fallback(t, `taxonomy.professions.${s}`, code))
  );
};

export const canonicalSubCategoryKey = (raw?: string): string => {
  if (!raw) return '';
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_א-תа-яё]/g, '');

  if (normalized.includes('sports_bra') || normalized.includes('חזיי_ספורט') || normalized.includes('спортивн_топ') || normalized.includes('спортивн_бра')) return 'sports_bras';
  if (normalized.includes('tracksuit') || normalized.includes('חליפת_ספורט') || normalized.includes('חליפות_ספורט') || normalized.includes('спортивн_костюм')) return 'tracksuits';
  if (normalized.includes('active_jacket') || normalized.includes('זקט_ספורט') || normalized.includes('спортивн_курт')) return 'active_jackets';
  if (normalized.includes('performance_top') || normalized.includes('חולצת_ספורט') || normalized.includes('חולצות_ספורט') || normalized.includes('спортивн_футбол')) return 'performance_tops';
  if (normalized.includes('running_short') || normalized.includes('מכנסי_ריצה') || normalized.includes('бегов_шорт')) return 'running_shorts';
  if (normalized.includes('compression_gear') || normalized.includes('ביגוד_לחץ') || normalized.includes('компрессион')) return 'compression_gear';
  if (normalized.includes('athleisure_dress') || normalized.includes('שמלת_ספורט') || normalized.includes('שמלות_ספורט') || normalized.includes('спортивн_плать')) return 'athleisure_dresses';

  if (normalized.includes('one_piece_swimsuit') || normalized.includes('בגד_ים_שלם') || normalized.includes('בגדי_ים_שלמים') || normalized.includes('слитн_купальник')) return 'one_piece_swimsuits';
  if (normalized.includes('bikini') || normalized.includes('ביקיני') || normalized.includes('бикини') || normalized.includes('раздельн_купальник')) return 'bikinis';
  if (normalized.includes('swim_trunk') || normalized.includes('מכנסי_ים') || normalized.includes('плавк') || normalized.includes('купальн_шорт')) return 'swim_trunks';
  if (normalized.includes('cover_up') || normalized.includes('עליונית_חוף') || normalized.includes('пляжн_накид')) return 'cover_ups';
  if (normalized.includes('rash_guard') || normalized.includes('חולצת_גלישה') || normalized.includes('рашгард')) return 'rash_guards';
  if (normalized.includes('wetsuit') || normalized.includes('חליפת_צלילה') || normalized.includes('гидрокостюм')) return 'wetsuits';
  if (normalized.includes('resort_romper') || normalized.includes('אוברול_נופש') || normalized.includes('курортн_ромпер')) return 'resort_rompers';

  if (normalized.includes('necklace') || normalized.includes('שרשרת') || normalized.includes('שרשראות') || normalized.includes('колье') || normalized.includes('цепочк') || normalized.includes('ожерель')) return 'necklaces';
  if (normalized.includes('earring') || normalized.includes('עגיל') || normalized.includes('серьг') || normalized.includes('сережк')) return 'earrings';
  if (normalized.includes('bracelet') || normalized.includes('bangle') || normalized.includes('צמיד') || normalized.includes('браслет')) return 'bracelets_and_bangles';
  if (normalized.includes('ring') || normalized.includes('טבעת') || normalized.includes('טבעות') || normalized.includes('кольц') || normalized.includes('кольца')) return 'rings';
  if (normalized.includes('brooch') || normalized.includes('pin') || normalized.includes('סיכת_עיטור') || normalized.includes('סיכות_עיטור') || normalized.includes('סיכה') || normalized.includes('סיכות') || normalized.includes('брошь') || normalized.includes('броши') || normalized.includes('значок')) return 'brooches_and_pins';
  if (normalized.includes('watch') || normalized.includes('שעון') || normalized.includes('שעונים') || normalized.includes('часы') || normalized.includes('наручн_час')) return 'watches';
  if (normalized.includes('body_jewelry') || normalized.includes('תכשיט_גוף') || normalized.includes('украшен_для_тел')) return 'body_jewelry';

  if (normalized.includes('bag') || normalized.includes('handbag') || normalized.includes('backpack') || normalized.includes('clutch') || normalized.includes('תיק') || normalized.includes('сумк') || normalized.includes('рюкзак')) return 'bags';
  if (normalized.includes('small_good') || normalized.includes('ארנקים') || normalized.includes('бумажник') || normalized.includes('кошелек')) return 'small_goods';
  if (normalized.includes('headwear') || normalized.includes('hat') || normalized.includes('cap') || normalized.includes('beanie') || normalized.includes('כובע') || normalized.includes('כובעים') || normalized.includes('головн_убор') || normalized.includes('шапк') || normalized.includes('шляп')) return 'headwear';
  if (normalized.includes('belt') || normalized.includes('חגורה') || normalized.includes('חגורות') || normalized.includes('ремень') || normalized.includes('ремни') || normalized.includes('пояс')) return 'belts';
  if (normalized.includes('glove') || normalized.includes('כפפה') || normalized.includes('כפפות') || normalized.includes('перчат') || normalized.includes('варежк')) return 'gloves';
  if (normalized.includes('scarf') || normalized.includes('wrap') || normalized.includes('צעיף') || normalized.includes('צעיפים') || normalized.includes('шарф') || normalized.includes('платок')) return 'scarves_and_wraps';
  if (normalized.includes('sock') || normalized.includes('hosiery') || normalized.includes('tight') || normalized.includes('גרבי') || normalized.includes('גרב') || normalized.includes('колгот')) return 'hosiery_and_socks';

  if (normalized.includes('soles') || normalized.includes('outsole') || normalized.includes('סוליה_חיצונית') || normalized.includes('подошв')) return 'soles_and_outsoles';
  if (normalized.includes('lifts') || normalized.includes('heel_stack') || normalized.includes('עקבים_והגבהה') || normalized.includes('каблук') || normalized.includes('набойк')) return 'heels_and_lifts';
  if (normalized.includes('midsole') || normalized.includes('cushioning') || normalized.includes('סוליית_אמצע') || normalized.includes('промежуточн_подошв')) return 'midsoles_and_cushioning';
  if (normalized.includes('insole') || normalized.includes('footbed') || normalized.includes('רפידה_פנימית') || normalized.includes('стельк')) return 'insoles_and_footbeds';
  if (normalized.includes('lace') || normalized.includes('fastener') || normalized.includes('שרוכים') || normalized.includes('אבזם') || normalized.includes('шнурки') || normalized.includes('застежк')) return 'laces_and_fasteners';
  if (normalized.includes('eyelet') || normalized.includes('grommet') || normalized.includes('לולאות') || normalized.includes('люверс')) return 'eyelets_and_grommets';
  if (normalized.includes('vamp') || normalized.includes('upper') || normalized.includes('חלקי_גפה') || normalized.includes('верх_обуви')) return 'vamps_and_uppers';

  if (normalized.includes('combat_boot') || normalized.includes('boot') || normalized.includes('מגפ') || normalized.includes('ботин') || normalized.includes('сапог')) return 'boots';
  if (normalized.includes('sandal') || normalized.includes('סנדל') || normalized.includes('сандал') || normalized.includes('босоножк')) return 'sandals';
  if (normalized.includes('sneaker') || normalized.includes('runner') || normalized.includes('trainer') || normalized.includes('high_top') || normalized.includes('low_top') || normalized.includes('סניקרס') || normalized.includes('סניקרס') || normalized.includes('ספורט') || normalized.includes('кроссов') || normalized.includes('кеды')) return 'sneakers';
  if (normalized.includes('heel') || normalized.includes('עקב') || normalized.includes('каблук')) return 'heels';
  if (normalized.includes('flat') || normalized.includes('שטוחות') || normalized.includes('балетк')) return 'flats';
  if (normalized.includes('slipper') || normalized.includes('בית') || normalized.includes('тапоч')) return 'slippers';
  if (normalized.includes('oxford') || normalized.includes('dress_shoe') || normalized.includes('loafer') || normalized.includes('אלגנט') || normalized.includes('נעליים') || normalized.includes('נעלי_עור') || normalized.includes('туфли') || normalized.includes('классическ_обув')) return 'dress_shoes';

  if (normalized.includes('overcoat') || normalized.includes('coat') || normalized.includes('parka') || normalized.includes('מעיל') || normalized.includes('пальто') || normalized.includes('плащ')) return 'coats';
  if (normalized.includes('jacket') || normalized.includes('bomber') || normalized.includes('moto') || normalized.includes('זקט') || normalized.includes('куртк')) return 'jackets';
  if (normalized.includes('performance_gear') || normalized.includes('windbreaker') || normalized.includes('ביגוד_טכני') || normalized.includes('ветров')) return 'performance_gear';
  if (normalized.includes('blazer') || normalized.includes('בלייזר') || normalized.includes('пиджак') || normalized.includes('блейзер')) return 'blazers';
  if (normalized.includes('vest') || normalized.includes('gilet') || normalized.includes('ווסט') || normalized.includes('жилет')) return 'vests';
  if (normalized.includes('cape') || normalized.includes('poncho') || normalized.includes('שכמי') || normalized.includes('פונצו') || normalized.includes('пончо')) return 'capes_and_ponchos';
  if (normalized.includes('shrug') || normalized.includes('bolero') || normalized.includes('עליונית_קצרה') || normalized.includes('болеро')) return 'shrugs';

  if (normalized.includes('tailored_shirt') || normalized.includes('button_down') || normalized.includes('oxford_shirt') || normalized.includes('dress_shirt') || normalized.includes('מכופתרת') || normalized.includes('חולצה') || normalized.includes('рубашк') || normalized === 'shirt' || normalized === 'shirts') return 'tailored_shirts';
  if (normalized.includes('knitwear') || normalized.includes('sweater') || normalized.includes('cardigan') || normalized.includes('pullover') || normalized.includes('סריג') || normalized.includes('סוודר') || normalized.includes('трикотаж') || normalized.includes('свитер')) return 'knitwear';
  if (normalized.includes('t_shirt') || normalized.includes('tshirt') || normalized.includes('t-shirt') || normalized.includes('tee') || normalized.includes('חולצת_טי') || normalized.includes('טישירט') || normalized.includes('футболк')) return 't_shirts';
  if (normalized.includes('blouse') || normalized.includes('בלוזה') || normalized.includes('блузк')) return 'blouses';
  if (normalized.includes('tank_top') || normalized.includes('tank') || normalized.includes('camisole') || normalized.includes('גופיי') || normalized.includes('גופיה') || normalized.includes('майк')) return 'tank_tops';
  if (normalized.includes('sweatshirt') || normalized.includes('hoodie') || normalized.includes('fleece') || normalized.includes('סווטשירט') || normalized.includes('קפוצ') || normalized.includes('худи') || normalized.includes('толстовк')) return 'sweatshirts';
  if (normalized.includes('tunic') || normalized.includes('טוניק') || normalized.includes('туник')) return 'tunics';

  if (normalized.includes('shorts') || normalized.includes('short') || normalized.includes('קצרים') || normalized.includes('שורט') || normalized.includes('шорты')) return 'shorts';
  if (normalized.includes('trouser') || normalized.includes('chino') || normalized.includes('pants') || normalized.includes('מכנסי') || normalized.includes('מכנס') || normalized.includes('брюк') || normalized.includes('штаны')) return 'trousers';
  if (normalized.includes('jeans') || normalized.includes('jean') || normalized.includes('denim') || normalized.includes('גינס') || normalized.includes('ג׳ינס') || normalized.includes('джинс')) return 'jeans';
  if (normalized.includes('legging') || normalized.includes('טייץ') || normalized.includes('легинс')) return 'leggings';
  if (normalized.includes('sweatpants') || normalized.includes('jogger') || normalized.includes('אימונית') || normalized.includes('טרניניג') || normalized.includes('джоггер')) return 'sweatpants';
  if (normalized.includes('jumpsuit') || normalized.includes('romper') || normalized.includes('אוברול') || normalized.includes('комбинезон') || normalized.includes('ромпер')) return 'jumpsuits_and_rompers';
  if (normalized.includes('overall') || normalized.includes('dungaree') || normalized.includes('סרבל') || normalized.includes('полукомбинезон')) return 'overalls';

  if (normalized.includes('skirt') || normalized.includes('חצאית') || normalized.includes('חצאיות') || normalized.includes('юбк')) return 'skirts';
  if (normalized.includes('mini_dress') || normalized.includes('מיני') || normalized.includes('מיני_плать')) return 'mini_dresses';
  if (normalized.includes('maxi_dress') || normalized.includes('מקסי') || normalized.includes('макси_плать')) return 'maxi_dresses';
  if (normalized.includes('evening_dress') || normalized.includes('gown') || normalized.includes('שמלת_ערב') || normalized.includes('שמלות_ערב') || normalized.includes('вечерн_плать')) return 'evening_dresses';
  if (normalized.includes('midi_dress') || normalized.includes('cocktail_dress') || normalized.includes('מידי') || normalized.includes('миди_плать')) return 'midi_dresses';
  if (normalized.includes('sundress') || normalized.includes('שמלת_קיץ') || normalized.includes('сарафан')) return 'sundresses';
  if (normalized.includes('wrap_dress') || normalized.includes('מעטפת') || normalized.includes('платье_с_запах')) return 'wrap_dresses';
  if (normalized.includes('dress') || normalized.includes('שמלה') || normalized.includes('плать')) return 'midi_dresses';

  return normalized;
};

export const getTaxonomyMismatches = (itemA: any, itemB: any): string[] => {
  if (!itemA || !itemB) return [];
  const mismatches: string[] = [];

  const normCategory = (cat: string) => {
    const s = String(cat || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'top' || s === 'tops') return 'top';
    if (s === 'bottom' || s === 'bottoms') return 'bottom';
    if (s === 'footwear' || s === 'shoes') return 'footwear';
    if (s === 'accessory' || s === 'accessories') return 'accessories';
    return s;
  };
  const catA = normCategory(itemA.category);
  const catB = normCategory(itemB.category);
  if (catA !== catB) mismatches.push('category');

  const subCatA = canonicalSubCategoryKey(itemA.sub_category);
  const subCatB = canonicalSubCategoryKey(itemB.sub_category);
  if (subCatA !== subCatB) mismatches.push('sub_category');

  const brandA = String(itemA.brand || '').trim().toLowerCase();
  const brandB = String(itemB.brand || '').trim().toLowerCase();
  if (brandA !== brandB) mismatches.push('brand');

  const genderA = String(itemA.gender || '').trim().toLowerCase();
  const genderB = String(itemB.gender || '').trim().toLowerCase();
  if (genderA !== genderB) mismatches.push('gender');

  const dcA = String(itemA.dress_code || '').trim().toLowerCase();
  const dcB = String(itemB.dress_code || '').trim().toLowerCase();
  if (dcA !== dcB) mismatches.push('dress_code');

  const tradA = String(itemA.tradition || '').trim().toLowerCase();
  const tradB = String(itemB.tradition || '').trim().toLowerCase();
  if (tradA !== tradB) mismatches.push('tradition');

  const normSeason = (list: any) => {
    let arr: any[] = [];
    if (Array.isArray(list)) {
      arr = list;
    } else if (typeof list === 'string') {
      arr = list.split(',').map((s) => s.trim());
    } else if (list) {
      arr = [list];
    }
    const sList = arr.map((s) => String(s || '').trim().toLowerCase());
    const hasAll = sList.includes('all') || (
      sList.includes('spring') && sList.includes('summer') && sList.includes('fall') && sList.includes('winter')
    );
    return hasAll ? ['all'] : sList.filter((s) => s && s !== 'all').sort();
  };
  const seasonA = normSeason(itemA.season);
  const seasonB = normSeason(itemB.season);
  if (seasonA.join(',') !== seasonB.join(',')) mismatches.push('season');

  return mismatches;
};


