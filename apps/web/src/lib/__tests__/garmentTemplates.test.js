import {
  AVAILABLE_TEMPLATES,
  CANONICAL_TEMPLATE_MAP,
  TEMPLATE_CACHE_VERSION,
  getTemplateGlbUrl,
  resolveGarmentTemplate,
} from '../garmentTemplates';

describe('Canonical 3D Garment & Accessory Templates Catalog', () => {
  it('contains all canonical GLB template archetypes', () => {
    expect(AVAILABLE_TEMPLATES.length).toBeGreaterThanOrEqual(19);
    expect(AVAILABLE_TEMPLATES).toContain('singlet');
    expect(AVAILABLE_TEMPLATES).toContain('top_tshirt');
    expect(AVAILABLE_TEMPLATES).toContain('shirt');
    expect(AVAILABLE_TEMPLATES).toContain('hoodie');
    expect(AVAILABLE_TEMPLATES).toContain('trench_coat');
    expect(AVAILABLE_TEMPLATES).toContain('cardigan');
    expect(AVAILABLE_TEMPLATES).toContain('jacket_blazer');
    expect(AVAILABLE_TEMPLATES).toContain('kaftan');
    expect(AVAILABLE_TEMPLATES).toContain('bottom_trousers');
    expect(AVAILABLE_TEMPLATES).toContain('bottom_shorts');
    expect(AVAILABLE_TEMPLATES).toContain('bermuda');
    expect(AVAILABLE_TEMPLATES).toContain('bottom_skirt');
    expect(AVAILABLE_TEMPLATES).toContain('skirt_pencil');
    expect(AVAILABLE_TEMPLATES).toContain('dress');
    expect(AVAILABLE_TEMPLATES).toContain('shoes_boots');
    expect(AVAILABLE_TEMPLATES).toContain('shoes_sneakers');
  });

  it('contains dedicated Blender avatar-reproduced canonical basemeshes', () => {
    expect(CANONICAL_TEMPLATE_MAP.tshirt).toBe('top_tshirt');
    expect(CANONICAL_TEMPLATE_MAP.top_strapless).toBe('strapless_torso');
    expect(CANONICAL_TEMPLATE_MAP.top_tunic).toBe('top_tunic');
    expect(CANONICAL_TEMPLATE_MAP.top_longsleeve).toBe('top_longsleeve');
    expect(CANONICAL_TEMPLATE_MAP.jacket).toBe('top_outerwear_jacket');
    expect(CANONICAL_TEMPLATE_MAP.pants).toBe('bottom_trousers');
    expect(CANONICAL_TEMPLATE_MAP.shorts).toBe('bottom_shorts');
    expect(CANONICAL_TEMPLATE_MAP.skirt).toBe('bottom_skirt');
    expect(CANONICAL_TEMPLATE_MAP.dress).toBe('dress');
    expect(CANONICAL_TEMPLATE_MAP.dress_strapless).toBe('dress_strapless');
    expect(CANONICAL_TEMPLATE_MAP.sneakers).toBe('shoes_sneakers');
    expect(CANONICAL_TEMPLATE_MAP.boots).toBe('shoes_boots');
  });

  it('correctly maps template IDs to static and gender-tailored GLB asset URLs', () => {
    const v = TEMPLATE_CACHE_VERSION;
    expect(getTemplateGlbUrl('trench_coat')).toBe(`/models/templates/female/trench_coat.glb?v=${v}`);
    expect(getTemplateGlbUrl('kaftan')).toBe(`/models/templates/female/kaftan.glb?v=${v}`);
    expect(getTemplateGlbUrl('singlet')).toBe(`/models/templates/female/singlet.glb?v=${v}`);
    expect(getTemplateGlbUrl('tshirt', false)).toBe(`/models/templates/female/top_tshirt.glb?v=${v}`);
    expect(getTemplateGlbUrl('tshirt', true)).toBe(`/models/templates/male/top_tshirt.glb?v=${v}`);
    expect(getTemplateGlbUrl('pants', false)).toBe(`/models/templates/female/bottom_trousers.glb?v=${v}`);
    expect(getTemplateGlbUrl('pants', true)).toBe(`/models/templates/male/bottom_trousers.glb?v=${v}`);
    expect(getTemplateGlbUrl('invalid_template')).toBeNull();
  });

  it('resolves outerwear archetypes: trench coat, cardigan, blazer, kaftan/galabiye', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Classic Trench Coat' })).toBe('trench_coat');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Wool Cardigan' })).toBe('cardigan');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Tailored Blazer Suit' })).toBe('jacket_blazer');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Silk Kaftan Dress' })).toBe('kaftan');
    expect(resolveGarmentTemplate({ rawSlot: 'outerwear', garmentText: 'Puffer Jacket', aspect: 0.95 })).toBe('top_outerwear_jacket');
  });

  it('resolves dress archetypes: standard dress vs strapless dress', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'dress', garmentText: 'שמלת מידי סטרפלס מכווצת בגוון בז בהיר' })).toBe('dress_strapless');
    expect(resolveGarmentTemplate({ rawSlot: 'dress', garmentText: 'Strapless Evening Gown' })).toBe('dress_strapless');
    expect(resolveGarmentTemplate({ rawSlot: 'dress', garmentText: 'Tube Midi Dress' })).toBe('dress_strapless');
    expect(resolveGarmentTemplate({ rawSlot: 'dress', garmentText: 'Floral Summer Dress' })).toBe('dress');
  });

  it('resolves top archetypes: strapless/corset, singlet/tank, t-shirt, shirt, hoodie', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'חולצת קורסט קטיפה בורדו' })).toBe('corset');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Strapless Tube Top' })).toBe('top_strapless');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Bandeau Bustier Top' })).toBe('bandeau');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Lace Bustier Top' })).toBe('bustier');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'מחוך סטרפלס אלגנטי' })).toBe('corset');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Athletic Tank Top' })).toBe('tank');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Camisole Spaghetti Strap Top' })).toBe('singlet');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Graphic Tee T-Shirt' })).toBe('top_tshirt');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Button Down Dress Shirt' })).toBe('shirt');
    expect(resolveGarmentTemplate({ rawSlot: 'top', garmentText: 'Fleece Pullover Hoodie' })).toBe('hoodie');
  });

  it('resolves bottom archetypes: pants, shorts, bermuda, skirts', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Denim Jeans Pants' })).toBe('bottom_trousers');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Athletic Running Shorts' })).toBe('bottom_shorts');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Knee-length Bermuda Cargo' })).toBe('bermuda');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'Pencil Skirt' })).toBe('skirt_pencil');
    expect(resolveGarmentTemplate({ rawSlot: 'bottom', garmentText: 'A-Line Flowy Skirt' })).toBe('bottom_skirt');
  });

  it('routes accessory and footwear slots to parametric/procedural builders (returns null)', () => {
    expect(resolveGarmentTemplate({ rawSlot: 'headwear', garmentText: 'Baseball Cap' })).toBeNull();
    expect(resolveGarmentTemplate({ rawSlot: 'headwear', garmentText: 'Wool Fedora Hat' })).toBeNull();
    expect(resolveGarmentTemplate({ rawSlot: 'bag', garmentText: 'Leather Tote Handbag' })).toBeNull();
    expect(resolveGarmentTemplate({ rawSlot: 'bag', garmentText: 'Crossbody Shoulder Bag' })).toBeNull();
    expect(resolveGarmentTemplate({ rawSlot: 'belt', garmentText: 'Classic Leather Belt' })).toBeNull();
  });
});
