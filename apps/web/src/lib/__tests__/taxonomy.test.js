import { canonicalSubCategoryKey, labelForSubCategory, labelForItemType } from '../taxonomy';

describe('Multilingual Bag and Basket Bag Taxonomy', () => {
  test('resolves canonical subcategories for bags across languages', () => {
    // English
    expect(canonicalSubCategoryKey('Handbag')).toBe('bags');
    expect(canonicalSubCategoryKey('Tote Bag')).toBe('bags');
    expect(canonicalSubCategoryKey('Backpack')).toBe('bags');
    // Hebrew
    expect(canonicalSubCategoryKey('תיק')).toBe('bags');
    expect(canonicalSubCategoryKey('תיק יד')).toBe('bags');
    expect(canonicalSubCategoryKey('תרמיל')).toBe('bags');
    // Arabic
    expect(canonicalSubCategoryKey('حقيبة')).toBe('bags');
    expect(canonicalSubCategoryKey('حقيبة يد')).toBe('bags');
    expect(canonicalSubCategoryKey('شنطة')).toBe('bags');
    // German
    expect(canonicalSubCategoryKey('Handtasche')).toBe('bags');
    expect(canonicalSubCategoryKey('Tasche')).toBe('bags');
    // Spanish
    expect(canonicalSubCategoryKey('Bolso')).toBe('bags');
    expect(canonicalSubCategoryKey('Bolsa')).toBe('bags');
    // French
    expect(canonicalSubCategoryKey('Sac à main')).toBe('bags');
    // Italian
    expect(canonicalSubCategoryKey('Borsa')).toBe('bags');
    // Russian
    expect(canonicalSubCategoryKey('Сумка')).toBe('bags');
    expect(canonicalSubCategoryKey('Рюкзак')).toBe('bags');
    // Hindi
    expect(canonicalSubCategoryKey('बैग')).toBe('bags');
    expect(canonicalSubCategoryKey('थैला')).toBe('bags');
    // Japanese
    expect(canonicalSubCategoryKey('バッグ')).toBe('bags');
    expect(canonicalSubCategoryKey('ハンドバッグ')).toBe('bags');
    // Chinese
    expect(canonicalSubCategoryKey('手提包')).toBe('bags');
    expect(canonicalSubCategoryKey('包')).toBe('bags');
  });

  test('resolves canonical subcategories for basket bags across languages', () => {
    expect(canonicalSubCategoryKey('Basket Bag')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Straw Bag')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('תיק סל קש')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('סל קש')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('حقيبة سلة قش')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('سلة قش')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Korbtasche')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Capazo')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Sac panier')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Borsa a cesto')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Mandtas')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Bolsa de palha')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('Сумка-корзина')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('बास्केट बैग')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('かごバッグ')).toBe('basket_bags');
    expect(canonicalSubCategoryKey('草编包')).toBe('basket_bags');
  });

  test('labelForSubCategory and labelForItemType format keys with i18n t() properly', () => {
    const mockT = (key, opts) => {
      if (key === 'taxonomy.sub_category.basket_bags') return 'Basket Bags';
      if (key === 'taxonomy.item_type.basket_bag') return 'Basket bag';
      if (key === 'taxonomy.item_type.handbag') return 'Handbag';
      return opts?.defaultValue || key;
    };

    expect(labelForSubCategory('Basket Bag', mockT)).toBe('Basket Bags');
    expect(labelForSubCategory('תיק סל קש', mockT)).toBe('Basket Bags');
    expect(labelForItemType('Basket Bag', mockT)).toBe('Basket bag');
    expect(labelForItemType('Handbag', mockT)).toBe('Handbag');
  });

  test('resolves canonical subcategories for cultural garments across languages', () => {
    // Galabiya
    expect(canonicalSubCategoryKey('Galabiya')).toBe('galabiya');
    expect(canonicalSubCategoryKey('גלבייה')).toBe('galabiya');
    expect(canonicalSubCategoryKey('جلابية')).toBe('galabiya');
    expect(canonicalSubCategoryKey('галабея')).toBe('galabiya');

    // Thobe
    expect(canonicalSubCategoryKey('Thobe')).toBe('thobe');
    expect(canonicalSubCategoryKey('תוב')).toBe('thobe');
    expect(canonicalSubCategoryKey('ثوب')).toBe('thobe');
    expect(canonicalSubCategoryKey('كندورة')).toBe('thobe');

    // Abaya & Kaftan
    expect(canonicalSubCategoryKey('Abaya')).toBe('abaya');
    expect(canonicalSubCategoryKey('עבאיה')).toBe('abaya');
    expect(canonicalSubCategoryKey('عباية')).toBe('abaya');
    expect(canonicalSubCategoryKey('Kaftan')).toBe('kaftan');
    expect(canonicalSubCategoryKey('כפתן')).toBe('kaftan');
    expect(canonicalSubCategoryKey('قفطان')).toBe('kaftan');

    // Kurta & Sherwani
    expect(canonicalSubCategoryKey('Kurta')).toBe('kurta');
    expect(canonicalSubCategoryKey('कुर्ता')).toBe('kurta');
    expect(canonicalSubCategoryKey('קורטה')).toBe('kurta');
    expect(canonicalSubCategoryKey('Sherwani')).toBe('sherwani');
    expect(canonicalSubCategoryKey('शेरवानी')).toBe('sherwani');
    expect(canonicalSubCategoryKey('שרוואני')).toBe('sherwani');

    // Sari & Lehenga
    expect(canonicalSubCategoryKey('Sari')).toBe('sari');
    expect(canonicalSubCategoryKey('साड़ी')).toBe('sari');
    expect(canonicalSubCategoryKey('סארי')).toBe('sari');
    expect(canonicalSubCategoryKey('Lehenga')).toBe('lehenga');
    expect(canonicalSubCategoryKey('लेहंगा')).toBe('lehenga');
    expect(canonicalSubCategoryKey('להנגה')).toBe('lehenga');

    // Hanbok, Kimono, Dirndl, Guayabera
    expect(canonicalSubCategoryKey('Hanbok')).toBe('hanbok');
    expect(canonicalSubCategoryKey('한복')).toBe('hanbok');
    expect(canonicalSubCategoryKey('Kimono')).toBe('kimono');
    expect(canonicalSubCategoryKey('着物')).toBe('kimono');
    expect(canonicalSubCategoryKey('Dirndl')).toBe('dirndl');
    expect(canonicalSubCategoryKey('דירנדל')).toBe('dirndl');
    expect(canonicalSubCategoryKey('Guayabera')).toBe('guayabera');
    expect(canonicalSubCategoryKey('גוואיאברה')).toBe('guayabera');

    // Dhoti & Salwar / Sharwal
    expect(canonicalSubCategoryKey('Dhoti')).toBe('dhoti');
    expect(canonicalSubCategoryKey('דהוטי')).toBe('dhoti');
    expect(canonicalSubCategoryKey('Salwar')).toBe('salwar');
    expect(canonicalSubCategoryKey('שרוואל')).toBe('salwar');
    expect(canonicalSubCategoryKey('סלוואר')).toBe('salwar');
    expect(canonicalSubCategoryKey('شروال')).toBe('salwar');
  });

  test('resolves canonical subcategories for traditional headwear across languages', () => {
    // Kippah
    expect(canonicalSubCategoryKey('Kippah')).toBe('kippah');
    expect(canonicalSubCategoryKey('כיפה')).toBe('kippah');
    expect(canonicalSubCategoryKey('كيباه')).toBe('kippah');
    expect(canonicalSubCategoryKey('кипа')).toBe('kippah');

    // Keffiyeh
    expect(canonicalSubCategoryKey('Keffiyeh')).toBe('keffiyeh');
    expect(canonicalSubCategoryKey('כאפייה')).toBe('keffiyeh');
    expect(canonicalSubCategoryKey('كوفية')).toBe('keffiyeh');
    expect(canonicalSubCategoryKey('شماغ')).toBe('keffiyeh');

    // Turban & Hijab
    expect(canonicalSubCategoryKey('Turban')).toBe('turban');
    expect(canonicalSubCategoryKey('טורבן')).toBe('turban');
    expect(canonicalSubCategoryKey('दस्तार')).toBe('turban');
    expect(canonicalSubCategoryKey('Hijab')).toBe('hijab');
    expect(canonicalSubCategoryKey('חיג\'אב')).toBe('hijab');
    expect(canonicalSubCategoryKey('حجاب')).toBe('hijab');

    // Mitpachat, Shtreimel, Tarboush
    expect(canonicalSubCategoryKey('Mitpachat')).toBe('mitpachat');
    expect(canonicalSubCategoryKey('מטפחת')).toBe('mitpachat');
    expect(canonicalSubCategoryKey('Shtreimel')).toBe('shtreimel');
    expect(canonicalSubCategoryKey('שטריימל')).toBe('shtreimel');
    expect(canonicalSubCategoryKey('Tarboush')).toBe('tarboush');
    expect(canonicalSubCategoryKey('תרבוש')).toBe('tarboush');
    expect(canonicalSubCategoryKey('طربوش')).toBe('tarboush');
  });
});
