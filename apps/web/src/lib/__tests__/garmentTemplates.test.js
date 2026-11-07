import {
  AVAILABLE_TEMPLATES,
  CANONICAL_TEMPLATES,
  getTemplateGlbUrl,
  resolveGarmentTemplate,
} from '../garmentTemplates';

describe('Canonical 3D Garment & Accessory Templates Catalog', () => {
  it('contains all canonical GLB template archetypes', () => {
    expect(AVAILABLE_TEMPLATES.length).toBeGreaterThanOrEqual(19);
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

  it('contains dedicated Blender avatar-reproduced canonical basemeshes', () => {
    expect(CANONICAL_TEMPLATES).toContain('top_tshirt');
    expect(CANONICAL_TEMPLATES).toContain('top_tunic');
    expect(CANONICAL_TEMPLATES).toContain('top_longsleeve');
    expect(CANONICAL_TEMPLATES).toContain('top_outerwear_jacket');
    expect(CANONICAL_TEMPLATES).toContain('bottom_trousers');
    expect(CANONICAL_TEMPLATES).toContain('bottom_shorts');
    expect(CANONICAL_TEMPLATES).toContain('bottom_skirt');
    expect(CANONICAL_TEMPLATES).toContain('dress');
    expect(CANONICAL_TEMPLATES).toContain('shoes_sneakers');
    expect(CANONICAL_TEMPLATES).toContain('shoes_boots');
    expect(CANONICAL_TEMPLATES).toContain('accessory_belt');
    expect(CANONICAL_TEMPLATES).toContain('accessory_hat');
    expect(CANONICAL_TEMPLATES).toContain('accessory_glasses');
    expect(CANONICAL_TEMPLATES).toContain('accessory_crossbody_bag');
  });

  it('correctly maps template IDs to static and gender-tailored GLB asset URLs', () => {
    expect(getTemplateGlbUrl('trench_coat')).toBe('/models/templates/trench_coat.glb?v=canon16');
    expect(getTemplateGlbUrl('kaftan')).toBe('/models/templates/kaftan.glb?v=canon16');
    expect(getTemplateGlbUrl('singlet')).toBe('/models/templates/singlet.glb?v=canon16');
    expect(getTemplateGlbUrl('tshirt', false)).toBe('/models/templates/female/top_tshirt.glb?v=canon16');
    expect(getTemplateGlbUrl('tshirt', true)).toBe('/models/templates/male/top_tshirt.glb?v=canon16');
    expect(getTemplateGlbUrl('pants', false)).toBe('/models/templates/female/bottom_trousers.glb?v=canon16');
    expect(getTemplateGlbUrl('pants', true)).toBe('/models/templates/male/bottom_trousers.glb?v=canon16');
    expect(getTemplateGlbUrl('invalid_template')).toBeNull();
  });

  it('resolves outerwear archetypes: trench coat, cardigan, blazer, kaftan/galabiye', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Classic Trench Coat' })).toBe('trench_coat');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Wool Cardigan' })).toBe('cardigan');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Tailored Blazer Suit' })).toBe('jacket_blazer');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Silk Kaftan Dress' })).toBe('kaftan');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Puffer Jacket', aspect: 0.95 })).toBe('top_outerwear_jacket');
  });

  it('resolves top archetypes: singlet, t-shirt, shirt, hoodie', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Athletic Tank Top' })).toBe('singlet');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Graphic Tee T-Shirt' })).toBe('tshirt');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Button Down Dress Shirt' })).toBe('shirt');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Fleece Pullover Hoodie' })).toBe('hoodie');
  });

  it('resolves bottom archetypes: pants, shorts, bermuda, skirts', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Denim Jeans Pants' })).toBe('pants');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Athletic Running Shorts' })).toBe('shorts');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Knee-length Bermuda Cargo' })).toBe('bermuda');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Pencil Skirt' })).toBe('skirt_pencil');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'A-Line Flowy Skirt' })).toBe('skirt_aline');
  });

  it('resolves accessory archetypes: cap, fedora, handbag, crossbody, belt', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'headwear', garmentText: 'Baseball Cap' })).toBe('hat_cap');
    expect(resolveGarmentTemplate({ rawSlot: 'headwear', garmentText: 'Wool Fedora Hat' })).toBe('hat_fedora');
    expect(resolveGarmentTemplate({ rawSlot: 'bag', garmentText: 'Leather Tote Handbag' })).toBe('bag_handbag');
    expect(resolveGarmentTemplate({ rawSlot: 'bag', garmentText: 'Crossbody Shoulder Bag' })).toBe('bag_crossbody');
    expect(resolveGarmentTemplate({ rawSlot: 'belt', garmentText: 'Classic Leather Belt' })).toBe('belt');
  });
});
