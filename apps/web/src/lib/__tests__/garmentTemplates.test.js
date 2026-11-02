import {
  AVAILABLE_TEMPLATES,
  CANONICAL_TEMPLATES,
  getTemplateGlbUrl,
  resolveGarmentTemplate,
} from '../garmentTemplates';

describe('Canonical 3D Garment & Accessory Templates Catalog', () => {
  it('contains all 19 canonical GLB template archetypes', () => {
    expect(AVAILABLE_TEMPLATES).toHaveLength(19);
    expect(AVAILABLE_TEMPLATES).toContain('singlet');
    expect(AVAILABLE_TEMPLATES).toContain('tshirt');
    expect(AVAILABLE_TEMPLATES).toContain('shirt');
    expect(AVAILABLE_TEMPLATES).toContain('hoodie');
    expect(AVAILABLE_TEMPLATES).toContain('trench_coat');
    expect(AVAILABLE_TEMPLATES).toContain('cardigan');
    expect(AVAILABLE_TEMPLATES).toContain('jacket_blazer');
    expect(AVAILABLE_TEMPLATES).toContain('kaftan');
    expect(AVAILABLE_TEMPLATES).toContain('pants');
    expect(AVAILABLE_TEMPLATES).toContain('shorts');
    expect(AVAILABLE_TEMPLATES).toContain('bermuda');
    expect(AVAILABLE_TEMPLATES).toContain('skirt_aline');
    expect(AVAILABLE_TEMPLATES).toContain('skirt_pencil');
    expect(AVAILABLE_TEMPLATES).toContain('dress');
    expect(AVAILABLE_TEMPLATES).toContain('hat_cap');
    expect(AVAILABLE_TEMPLATES).toContain('hat_fedora');
    expect(AVAILABLE_TEMPLATES).toContain('bag_handbag');
    expect(AVAILABLE_TEMPLATES).toContain('bag_crossbody');
    expect(AVAILABLE_TEMPLATES).toContain('belt');
  });

  it('contains all 12 dedicated Blender avatar-reproduced canonical basemeshes', () => {
    expect(CANONICAL_TEMPLATES).toHaveLength(12);
    expect(CANONICAL_TEMPLATES).toEqual([
      'top_tshirt',
      'top_longsleeve',
      'top_outerwear_jacket',
      'bottom_trousers',
      'bottom_shorts',
      'bottom_skirt',
      'shoes_sneakers',
      'shoes_boots',
      'accessory_belt',
      'accessory_hat',
      'accessory_glasses',
      'accessory_crossbody_bag',
    ]);
  });

  it('correctly maps template IDs to static and gender-tailored GLB asset URLs', () => {
    expect(getTemplateGlbUrl('trench_coat')).toBe('/models/templates/trench_coat.glb');
    expect(getTemplateGlbUrl('kaftan')).toBe('/models/templates/kaftan.glb');
    expect(getTemplateGlbUrl('singlet')).toBe('/models/templates/singlet.glb');
    expect(getTemplateGlbUrl('tshirt', false)).toBe('/models/templates/female/top_tshirt.glb?v=canon2');
    expect(getTemplateGlbUrl('tshirt', true)).toBe('/models/templates/male/top_tshirt.glb?v=canon2');
    expect(getTemplateGlbUrl('pants', false)).toBe('/models/templates/female/bottom_trousers.glb?v=canon2');
    expect(getTemplateGlbUrl('pants', true)).toBe('/models/templates/male/bottom_trousers.glb?v=canon2');
    expect(getTemplateGlbUrl('invalid_template')).toBeNull();
  });

  it('resolves outerwear archetypes: trench coat, cardigan, blazer, kaftan/galabiye', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: "מעיל טרנץ' קלאסי בגוון שמנת עם חגורה" }))
      .toBe('trench_coat');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'קרדיגן שחור ארוך וצנוע בגזרה פתוחה' }))
      .toBe('cardigan');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'בלייזר מחויט שחור עם כפתורים' }))
      .toBe('jacket_blazer');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'גלבייה רקומה מכותנה מסורתית' }))
      .toBe('kaftan');
    expect(resolveGarmentTemplate({ rawSlot: 'dress', garmentText: 'כפתן מרוקאי ארוך ונשפך' }))
      .toBe('kaftan');
  });

  it('resolves top archetypes: singlet, t-shirt, shirt, hoodie', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'גופיית סבא מבד ריב כותנה לבנה' }))
      .toBe('singlet');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'חולצת טי שירט שחורה מחוייטת צמודה' }))
      .toBe('tshirt');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'חולצה מכופתרת לבנה אלגנטית' }))
      .toBe('shirt');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'קפוצ\'ון ספורטיבי עם כיס קנגורו' }))
      .toBe('hoodie');
  });

  it('resolves bottom archetypes: pants, shorts, bermuda, skirts', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'מכנסי ג\'ינס כחולים קלאסיים' }))
      .toBe('pants');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'שורטס ג\'ינס קצרים' }))
      .toBe('shorts');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'ברמודה דגמ"ח עד הברך' }))
      .toBe('bermuda');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'חצאית ג\'ינס פליסה באינדיגו' }))
      .toBe('skirt_aline');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'חצאית עיפרון מחויטת צמודה' }))
      .toBe('skirt_pencil');
  });

  it('resolves accessory archetypes: cap, fedora, handbag, crossbody, belt', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'headwear', garmentText: 'כובע קסקט מצחייה ספורטיבי' }))
      .toBe('hat_cap');
    expect(resolveGarmentTemplate({ rawSlot: 'headwear', garmentText: 'כובע פדורה רחב שוליים' }))
      .toBe('hat_fedora');
    expect(resolveGarmentTemplate({ rawSlot: 'bag', garmentText: 'תיק יד מעור אלגנטי' }))
      .toBe('bag_handbag');
    expect(resolveGarmentTemplate({ rawSlot: 'bag', garmentText: 'תיק צד קרוסבודי שחור' }))
      .toBe('bag_crossbody');
    expect(resolveGarmentTemplate({ rawSlot: 'belt', garmentText: 'חגורת עור חומה עם אבזם' }))
      .toBe('belt');
  });
});
