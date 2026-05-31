/**
 * Taxonomy label helpers.
 *
 * The backend stores stable English codes for category / dress_code / gender /
 * season / state / condition / quality / pattern / formality / intent / source,
 * and `role` for stylist recommendation items. This module converts those
 * codes into display labels honoring the active i18next locale, with a safe
 * fallback that keeps the original code if we don't have a translation yet.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   <SelectItem value="top">{labelForCategory('top', t)}</SelectItem>
 */

/**
 * Normalize a taxonomy code into the key shape we use in locale files.
 *
 * Category labels in the DB/API often arrive capitalized (e.g. "Top",
 * "Full Body", "Accessories"). We map them to lowercase with underscore
 * separators so JSON keys stay predictable.
 */
const slug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const fallback = (t, key, raw) => {
  const out = t(key, { defaultValue: raw ?? '' });
  // i18next will return the key itself when nothing matches — degrade to raw.
  if (!out || out === key) return raw ?? '';
  return out;
};

export const labelForCategory = (code, t) => {
  if (!code) return '';
  if (code === 'all') return fallback(t, 'taxonomy.categories.all', 'All');
  const key = `taxonomy.categories.${slug(code)}`;
  return fallback(t, key, code);
};

export const labelForDressCode = (code, t) => {
  if (!code) return '';
  // Keep the original code (e.g. "smart-casual") so JSON keys match.
  const key = `taxonomy.dress_code.${code}`;
  return fallback(t, key, code);
};

export const labelForGender = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.gender.${code}`;
  return fallback(t, key, code);
};

export const labelForSeason = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.season.${code}`;
  return fallback(t, key, code);
};

export const labelForState = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.state.${code}`;
  return fallback(t, key, code);
};

export const labelForCondition = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.condition.${code}`;
  return fallback(t, key, code);
};

export const labelForQuality = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.quality.${code}`;
  return fallback(t, key, code);
};

export const labelForPattern = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.pattern.${code}`;
  return fallback(t, key, code);
};

export const labelForFormality = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.formality.${code}`;
  return fallback(t, key, code);
};

export const labelForIntent = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.intent.${code}`;
  return fallback(t, key, code);
};

export const labelForSource = (code, t) => {
  if (!code) return '';
  if (code === 'all') return fallback(t, 'taxonomy.source.all', 'All sources');
  // Source codes in the DB are capitalized: Private | Shared | Retail.
  const key = `taxonomy.source.${code}`;
  return fallback(t, key, code);
};

export const labelForRole = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.role.${code}`;
  return fallback(t, key, code);
};

const CANONICAL_COLORS = {
  // English
  'white': 'white',
  'black': 'black',
  'grey': 'grey',
  'gray': 'grey',
  'light_grey': 'light_grey',
  'light_gray': 'light_grey',
  'burgundy': 'burgundy',
  'bordeaux': 'burgundy',
  'brown': 'brown',
  'blue': 'blue',
  'light_blue': 'light_blue',
  'navy': 'navy',
  'navy_blue': 'navy',
  'dark_blue': 'navy',
  'dark_blue_gray': 'charcoal_grey',
  'blue_gray': 'charcoal_grey',
  'charcoal': 'charcoal_grey',
  'charcoal_grey': 'charcoal_grey',
  'charcoal_gray': 'charcoal_grey',
  'green': 'green',
  'olive': 'olive',
  'olive_green': 'olive',
  'yellow': 'yellow',
  'orange': 'orange',
  'pink': 'pink',
  'purple': 'purple',
  'terracotta': 'terracotta_brown',
  'terracotta_brown': 'terracotta_brown',
  'beige': 'beige',
  'cream': 'cream',
  'champagne_gold': 'champagne_gold',
  'champagne': 'champagne_gold',
  'gold': 'champagne_gold',
  'red': 'red',
  'dark_grey': 'charcoal_grey',
  'dark_gray': 'charcoal_grey',
  'turquoise': 'light_blue',
  'silver': 'light_grey',
  'bronze': 'brown',
  'mustard': 'yellow',
  'peach': 'orange',
  'lilac': 'purple',
  'lavender': 'purple',
  'khaki': 'beige',
  'coral': 'orange',
  'fuchsia': 'pink',
  'magenta': 'pink',
  'plum': 'purple',
  'teal': 'blue',
  'indigo': 'navy',
  'maroon': 'burgundy',
  
  // Hebrew
  'לבן': 'white',
  'שחור': 'black',
  'אפור': 'grey',
  'אפור_בהיר': 'light_grey',
  'בורדו': 'burgundy',
  'חום': 'brown',
  'כחول': 'blue',
  'כחול': 'blue',
  'תכלת': 'light_blue',
  'כחול_כהה': 'navy',
  'כחול_אפור_כהה': 'charcoal_grey',
  'ירוק': 'green',
  'ירוק_זית': 'olive',
  'צהוב': 'yellow',
  'כתום': 'orange',
  'ורוד': 'pink',
  'סגول': 'purple',
  'חום_חמרה': 'terracotta_brown',
  'טראקוטה': 'terracotta_brown',
  'בז\'': 'beige',
  'בז': 'beige',
  'קרם': 'cream',
  'זהב': 'champagne_gold',
  'שמפניה': 'champagne_gold',
  'אדום': 'red',
  'אפור_כהה': 'charcoal_grey',
  'אפור_עכבר': 'charcoal_grey',
  'טורקיז': 'light_blue',
  'כסף': 'light_grey',
  'ברונزه': 'brown',
  'חרדל': 'yellow',
  'אפרסק': 'orange',
  'לילך': 'purple',
  'לבנדر': 'purple',
  'קאكي': 'beige',
  'קורل': 'orange',
  'פוקסיה': 'pink',
  'מגنتة': 'pink',
  'מגנטה': 'pink',
  'שזיף': 'purple',
  'כחول_ירקרק': 'blue',
  'כחול_ירקרק': 'blue',
  'אינדיגו': 'navy',
  'חום_ערמוני': 'burgundy',

  // Russian
  'белый': 'white',
  'черный': 'black',
  'чёрный': 'black',
  'серый': 'grey',
  'светло_серый': 'light_grey',
  'бордовый': 'burgundy',
  'бордо': 'burgundy',
  'коричневый': 'brown',
  'синий': 'blue',
  'голубой': 'light_blue',
  'темно_синий': 'navy',
  'зеленый': 'green',
  'зелёный': 'green',
  'оливковый': 'olive',
  'желтый': 'yellow',
  'жёлтый': 'yellow',
  'оранжевый': 'orange',
  'розовый': 'pink',
  'фиолетовый': 'purple',
  'терракотовый': 'terracotta_brown',
  'бежевый': 'beige',
  'кремовый': 'cream',
  'золотой': 'champagne_gold',
  'шампань': 'champagne_gold',
  'красный': 'red',

  // Arabic
  'احمر': 'red',
  'أحمر': 'red',

  // French
  'rouge': 'red',

  // Spanish
  'rojo': 'red',

  // German
  'rot': 'red',

  // Italian
  'rosso': 'red',

  // Portuguese
  'vermelho': 'red',

  // Hindi
  'लाल': 'red',

  // Japanese
  '赤': 'red',

  // Chinese
  '红': 'red',
  '红色': 'red'
};

export const canonicalColorKey = (code) => {
  if (!code) return '';
  const normalized = String(code)
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_א-תа-яё]/g, '');
  return CANONICAL_COLORS[normalized] || slug(code);
};

export const labelForColor = (code, t) => {
  if (!code) return '';
  const key = `taxonomy.color.${canonicalColorKey(code)}`;
  return fallback(t, key, code);
};

/**
 * Sub-category / item-type labels.
 *
 * Backend stores these as free-form English text (e.g., "Pants", "Shorts",
 * "Oxford shirt"). We normalize to a slug and look up a localized label; if
 * we don't have a translation we return the raw value unchanged so non-
 * dictionary garments (e.g., brand-specific nomenclature) still render.
 */
const itemSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

export const canonicalSubCategoryKey = (raw) => {
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
  if (normalized.includes('sneaker') || normalized.includes('runner') || normalized.includes('trainer') || normalized.includes('high_top') || normalized.includes('low_top') || normalized.includes('סниקרס') || normalized.includes('ספורט') || normalized.includes('кроссов') || normalized.includes('кеды')) return 'sneakers';
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

  if (normalized.includes('tailored_shirt') || normalized.includes('button_down') || normalized.includes('oxford_shirt') || normalized.includes('dress_shirt') || normalized.includes('מכופתרת') || normalized.includes('חולצה') || normalized.includes('рубашк')) return 'tailored_shirts';
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
  if (normalized.includes('mini_dress') || normalized.includes('מיני') || normalized.includes('мини_плать')) return 'mini_dresses';
  if (normalized.includes('maxi_dress') || normalized.includes('מקסי') || normalized.includes('макси_плать')) return 'maxi_dresses';
  if (normalized.includes('evening_dress') || normalized.includes('gown') || normalized.includes('שמלת_ערב') || normalized.includes('שמלות_ערב') || normalized.includes('вечерн_плать')) return 'evening_dresses';
  if (normalized.includes('midi_dress') || normalized.includes('cocktail_dress') || normalized.includes('מידי') || normalized.includes('миди_плать')) return 'midi_dresses';
  if (normalized.includes('sundress') || normalized.includes('שמלת_קיץ') || normalized.includes('сарафан')) return 'sundresses';
  if (normalized.includes('wrap_dress') || normalized.includes('מעטפת') || normalized.includes('платье_с_запах')) return 'wrap_dresses';
  if (normalized.includes('dress') || normalized.includes('שמלה') || normalized.includes('плать')) return 'midi_dresses';

  return normalized;
};

export const labelForSubCategory = (raw, t) => {
  if (!raw) return '';
  const canonical = canonicalSubCategoryKey(raw);
  if (canonical === 'other') {
    return t('stats.unknownSubcategory', { defaultValue: 'Other' });
  }
  const key = `taxonomy.sub_category.${canonical}`;
  return fallback(t, key, raw);
};

export const labelForItemType = (raw, t) => {
  if (!raw) return '';
  const slug = itemSlug(raw);
  if (!slug) return raw;
  const key = `taxonomy.item_type.${slug}`;
  return fallback(t, key, raw);
};

export const canonicalMaterialKey = (raw) => {
  if (!raw) return '';
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_א-תа-яё]/g, '');

  if (normalized === 'acrylic') return 'acrylic';
  if (normalized === 'brocade') return 'brocade';
  if (normalized === 'burlap') return 'burlap';
  if (normalized === 'canvas') return 'canvas';
  if (normalized === 'cashmere') return 'cashmere';
  if (normalized === 'chambray') return 'chambray';
  if (normalized === 'chiffon') return 'chiffon';
  if (normalized === 'copper') return 'copper';
  if (normalized === 'cotton') return 'cotton';
  if (normalized === 'denim') return 'denim';
  if (normalized === 'leather') return 'leather';
  if (normalized === 'linen') return 'linen';
  if (normalized === 'mesh') return 'mesh';
  if (normalized === 'nylon') return 'nylon';
  if (normalized === 'oxblood') return 'oxblood';
  if (normalized === 'polyester') return 'polyester';
  if (normalized === 'rayon') return 'rayon';
  if (normalized === 'ripstop') return 'ripstop';
  if (normalized === 'satin') return 'satin';
  if (normalized === 'silk') return 'silk';
  if (normalized === 'spandex') return 'spandex';
  if (normalized === 'suede') return 'suede';
  if (normalized === 'velvet') return 'velvet';
  if (normalized === 'vinyl') return 'vinyl';
  if (normalized === 'wool') return 'wool';

  if (normalized.includes('cotton') || normalized.includes('כותנה') || normalized.includes('хлопок')) return 'cotton';
  if (normalized.includes('linen') || normalized.includes('פשתן') || normalized.includes('лен') || normalized.includes('лён')) return 'linen';
  
  if (normalized.includes('burlap') || normalized.includes('jute') || normalized.includes('יוטה') || normalized.includes('джут') || normalized.includes('мешковина')) return 'burlap';
  if (normalized.includes('canvas') || normalized.includes('קנבס') || normalized.includes('холст') || normalized.includes('канвас')) return 'canvas';
  
  if (normalized.includes('satin') || normalized.includes('סאטן') || normalized.includes('атлас')) return 'satin';
  if (normalized.includes('brocade') || normalized.includes('זהב') || normalized.includes('gold') || normalized.includes('פייטים') || normalized.includes('sequins') || normalized.includes('парча') || normalized.includes('блестки')) return 'brocade';
  if (normalized.includes('copper') || normalized.includes('metal') || normalized.includes('נחושת') || normalized.includes('מתכת') || normalized.includes('סיבים_מתכתיים') || normalized.includes('медь') || normalized.includes('металл')) return 'copper';
  
  if (normalized.includes('cashmere') || normalized.includes('קשמיר') || normalized.includes('кашемир')) return 'cashmere';
  if (normalized.includes('chiffon') || normalized.includes('שיפון') || normalized.includes('טול') || normalized.includes('tulle') || normalized.includes('шифон') || normalized.includes('тюль')) return 'chiffon';
  if (normalized.includes('velvet') || normalized.includes('קטיפה') || normalized.includes('barhat') || normalized.includes('бархат')) return 'velvet';
  
  if (normalized.includes('suede') || normalized.includes('זמש') || normalized.includes('замша')) return 'suede';
  if (normalized.includes('leather') || normalized.includes('עור') || normalized.includes('cowhide') || normalized.includes('кожа')) {
    if (normalized.includes('oxblood') || normalized.includes('cordovan') || normalized.includes('בורדו')) return 'oxblood';
    return 'leather';
  }
  
  if (normalized.includes('chambray') || normalized.includes('שמברה')) return 'chambray';
  if (normalized.includes('denim') || normalized.includes('דנים') || normalized.includes('ג\'ינס') || normalized.includes('גינס') || normalized.includes('jeans')) return 'denim';
  if (normalized.includes('nylon') || normalized.includes('ניילון') || normalized.includes('нейлон')) return 'nylon';
  
  if (normalized.includes('mesh') || normalized.includes('רשת') || normalized.includes('сетка')) return 'mesh';
  if (normalized.includes('polyester') || normalized.includes('פוליאסטר') || normalized.includes('полиэстер')) return 'polyester';
  if (normalized.includes('rayon') || normalized.includes('viscose') || normalized.includes('ויסקוזה') || normalized.includes('ראיון') || normalized.includes('вискоза') || normalized.includes('район')) return 'rayon';
  if (normalized.includes('spandex') || normalized.includes('elastane') || normalized.includes('lycra') || normalized.includes('אלסטן') || normalized.includes('ספנדקס') || normalized.includes('לייקרה') || normalized.includes('эластан') || normalized.includes('лайкра')) return 'spandex';
  if (normalized.includes('acrylic') || normalized.includes('אקריליק') || normalized.includes('акрил')) return 'acrylic';
  
  if (normalized.includes('vinyl') || normalized.includes('tarp') || normalized.includes('rubber') || normalized.includes('ויניל') || normalized.includes('ברזנט') || normalized.includes('גומי') || normalized.includes('резина')) return 'vinyl';
  if (normalized.includes('ripstop') || normalized.includes('ריפסטופ')) return 'ripstop';
  
  if (normalized.includes('wool') || normalized.includes('צמר') || normalized.includes('флис') || normalized.includes('твил') || normalized.includes('шерсть') || normalized.includes('פליז') || normalized.includes('טוויל') || normalized.includes('קצף') || normalized.includes('foam')) return 'wool';
  if (normalized.includes('silk') || normalized.includes('משי') || normalized.includes('шелк') || normalized.includes('шёлк')) return 'silk';

  if (normalized.includes('בד') || normalized.includes('ткань') || normalized.includes('fabric')) return 'other';

  return normalized;
};

export const labelForMaterial = (raw, t) => {
  if (!raw) return '';
  const canonical = canonicalMaterialKey(raw);
  if (canonical === 'other') {
    return t('stats.unknownMaterial', { defaultValue: 'Other' });
  }
  const key = `taxonomy.material.${canonical}`;
  return fallback(t, key, raw);
};

/** Generic helper to map an array of codes into translated Select-ready objects. */
export const makeLabeledOptions = (codes, labelFn, t) =>
  (codes || []).map((code) => ({ value: code, label: labelFn(code, t) }));
