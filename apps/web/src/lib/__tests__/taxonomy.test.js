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
});
