import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useClosetStore } from '@/lib/useClosetStore';
import { DollarSign, Percent, TrendingUp, Shirt, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { labelForColor, canonicalColorKey, labelForMaterial, labelForSubCategory } from '@/lib/taxonomy';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLOR_HEX_MAP = {
  white: '#f8fafc',
  black: '#18181b',
  grey: '#71717a',
  light_grey: '#d3d3d3',
  burgundy: '#800020',
  brown: '#a52a2a',
  blue: '#2563eb',
  light_blue: '#add8e6',
  navy: '#000080',
  charcoal_grey: '#36454f',
  green: '#16a34a',
  olive: '#808000',
  yellow: '#eab308',
  orange: '#f97316',
  pink: '#ffc0cb',
  purple: '#800080',
  terracotta_brown: '#e2725b',
  beige: '#f5f5dc',
  cream: '#fffdd0',
  champagne_gold: '#f7e7ce',
  red: '#ef4444',
};

const W3C_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond',
  'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgrey', 'darkgreen',
  'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite',
  'gold', 'goldenrod', 'gray', 'grey', 'green', 'greenyellow', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory',
  'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgrey', 'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen',
  'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen',
  'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum',
  'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown',
  'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke',
  'yellow', 'yellowgreen'
]);

const getFillColor = (canonicalKey) => {
  if (COLOR_HEX_MAP[canonicalKey]) {
    return COLOR_HEX_MAP[canonicalKey];
  }
  const clean = canonicalKey.replace(/_/g, '');
  if (W3C_COLORS.has(clean)) {
    return clean;
  }
  return '#a1a1aa'; // default fallback for unknown colors
};

const MATERIAL_COLOR_MAP = {
  // Fallbacks & broad categories
  cotton: '#e2e8f0',
  wool: '#78350f',
  silk: '#fbcfe8',
  linen: '#f5f5dc',
  leather: '#18181b',
  denim: '#1d4ed8',
  polyester: '#a855f7',
  nylon: '#3b82f6',
  cashmere: '#fda4af',
  viscose: '#10b981',
  elastane: '#64748b',
  spandex: '#64748b',
  velvet: '#4c1d95',
  satin: '#fef08a',
  twill: '#451a03',
  fleece: '#06b6d4',

  // Natural fibers
  raw_cotton: '#F9F6EE',
  flax_linen: '#FAF0E6',
  mulberry_silk: '#FFF8F0',
  tussah_silk: '#E6D7C3',
  hemp_canvas: '#E0D8C8',
  ramie_white: '#FDFBF7',
  jute_burlap: '#A8977E',

  // Luxury wools & hairs
  cashmere_cream: '#EAE3D2',
  merino_off_white: '#F5F2EB',
  camel_hair: '#C19A6B',
  alpaca_fawn: '#8E7661',
  mohair_silver: '#D1D5DB',
  angora_cloud: '#FAF9F6',
  vicuna: '#B87A3A',

  // Leather & skins
  vachetta_leather: '#E3C39D',
  saddle_tan: '#A0522D',
  cordovan: '#4A1525',
  nappa_black: '#1A1A1A',
  suede_taupe: '#B3A79A',
  nubuck_olive: '#556B2F',
  patent_gloss_black: '#0B0B0C',

  // Utility & synthetic fabrics
  raw_denim_blue: '#1A2E40',
  chambray_light: '#A3C1AD',
  ballistic_nylon: '#242526',
  neoprene_scuba: '#111215',
  ripstop_khaki: '#C3B091',
  tyvek_white: '#FFFFFF',
  tarp_vinyl: '#0D5C3A',

  // Specialty & eveningwear textiles
  velvet_maroon: '#500614',
  satin_champagne: '#ECCBB4',
  tulle_illusion: '#F3EBE3',
  organza_blush: '#FFECE6',
  brocade_antique_gold: '#CCA43B',
  lame_silver: '#E6E8EA',
  sequined_onyx: '#0F0F10',

  other: '#a1a1aa',
};

const getMaterialColor = (key) => {
  return MATERIAL_COLOR_MAP[key] || '#a1a1aa';
};

const CATEGORY_HUES = {
  tops: 140,
  bottoms: 210,
  outerwear: 35,
  shoes: 340,
  footwear: 340,
  dresses: 280,
  full_body: 280,
  accessories: 80,
  underwear: 180,
};

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

const getSubCategoryColor = (parentCategory, subCategory) => {
  const baseHue = CATEGORY_HUES[parentCategory] || 200;
  const hash = hashString(subCategory || '');
  const saturation = 65 + (hash % 20); // 65% - 85%
  const lightness = 45 + (hash % 25);  // 45% - 70%
  return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
};

const slug = (value) =>
  String(value || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[\s\/\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');


export default function WardrobeStats() {
  const { t } = useTranslation();
  const store = useClosetStore();
  const items = store.items || [];
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [breakdownType, setBreakdownType] = useState('colors');

  // Sync closet items if store is empty or needs refresh
  useEffect(() => {
    if (store.fetchItems) {
      store.fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalValue = items.reduce((acc, it) => acc + (it.price_cents || 0), 0) / 100;
  const wornItems = items.filter(it => (it.wear_count || 0) > 0).length;
  const utilization = items.length > 0 ? Math.round((wornItems / items.length) * 100) : 0;

  // Calculate Selected Breakdown Distribution (Colors, Materials, or Categories)
  let colorData = [];
  
  if (breakdownType === 'colors') {
    const colorMap = {};
    items.forEach(it => {
      let rawColor = it.color || '';
      if (!rawColor && it.colors && it.colors.length > 0) {
        const first = it.colors[0];
        rawColor = typeof first === 'string' ? first : (first?.name || '');
      }
      rawColor = rawColor || 'Other';
      const raw = rawColor.trim();

      // Translate the color using our labelForColor helper
      const localized = rawColor === 'Other' ? t('common.unknownColor', { defaultValue: 'Other' }) : labelForColor(raw, t);
      
      if (!colorMap[localized]) {
        const canonicalKey = rawColor === 'Other' ? 'other' : canonicalColorKey(raw);
        const fill = getFillColor(canonicalKey);

        colorMap[localized] = {
          name: localized,
          value: 0,
          fill: fill
        };
      }
      colorMap[localized].value += 1;
    });
    colorData = Object.values(colorMap).sort((a, b) => b.value - a.value);
  } else if (breakdownType === 'materials') {
    const materialMap = {};
    items.forEach(it => {
      const fabric_materials = it.fabric_materials || [];
      if (Array.isArray(fabric_materials) && fabric_materials.length > 0) {
        fabric_materials.forEach(mat => {
          if (!mat || !mat.name) return;
          const raw = mat.name.trim();
          const pct = Number(mat.pct) || 0;
          const weight = pct / 100;
          
          const localized = labelForMaterial(raw, t);
          if (!materialMap[localized]) {
            const canonicalKey = slug(raw);
            const fill = getMaterialColor(canonicalKey);
            materialMap[localized] = {
              name: localized,
              value: 0,
              fill: fill
            };
          }
          materialMap[localized].value += weight;
        });
      } else {
        const rawMat = it.material || '';
        const raw = rawMat.trim();
        const localized = raw ? labelForMaterial(raw, t) : t('stats.unknownMaterial', { defaultValue: 'Other' });
        
        if (!materialMap[localized]) {
          const canonicalKey = raw ? slug(raw) : 'other';
          const fill = getMaterialColor(canonicalKey);
          materialMap[localized] = {
            name: localized,
            value: 0,
            fill: fill
          };
        }
        materialMap[localized].value += 1;
      }
    });
    
    colorData = Object.values(materialMap)
      .map(entry => ({
        ...entry,
        value: Number(entry.value.toFixed(1))
      }))
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value);
  } else if (breakdownType === 'categories') {
    const categoryMap = {};
    items.forEach(it => {
      const rawSub = it.sub_category || '';
      const raw = rawSub.trim();
      const localized = raw ? labelForSubCategory(raw, t) : t('stats.unknownSubcategory', { defaultValue: 'Other' });
      
      if (!categoryMap[localized]) {
        const parentCategory = it.category || 'other';
        const fill = getSubCategoryColor(parentCategory, raw);
        categoryMap[localized] = {
          name: localized,
          value: 0,
          fill: fill
        };
      }
      categoryMap[localized].value += 1;
    });
    colorData = Object.values(categoryMap).sort((a, b) => b.value - a.value);
  }

  // Cost-per-Wear calculations
  const sortedByEfficiency = [...items]
    .filter(it => it.price_cents > 0)
    .map(it => ({
      ...it,
      cpw: (it.price_cents / 100) / (it.wear_count || 1)
    }))
    .sort((a, b) => a.cpw - b.cpw);

  const topEfficient = sortedByEfficiency.slice(0, 3);
  const bottomEfficient = [...sortedByEfficiency].reverse().slice(0, 3);

  return (
    <div className="container-px max-w-4xl mx-auto pt-6 pb-16 space-y-8" data-testid="wardrobe-stats-page">
      {/* Header */}
      <div className="flex flex-col">
        <span className="caps-label text-brand font-bold tracking-wider text-xs">{t('stats.category', { defaultValue: 'DressApp Unpacked' })}</span>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1 text-foreground">{t('stats.title', { defaultValue: 'Wardrobe Insights' })}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          {t('stats.description', { defaultValue: 'Analyze your wardrobe value, wear metrics, and dominant style palettes to cultivate conscious wear habits.' })}
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Value Card */}
        <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-accent-lilac/30 text-brand flex items-center justify-center shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">{t('stats.totalValue', { defaultValue: 'Closet Worth' })}</span>
              <span className="text-2xl font-bold font-display text-foreground" data-testid="stats-total-value">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Utilization Card */}
        <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-accent-green/10 text-accent-green flex items-center justify-center shrink-0">
              <Percent className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">{t('stats.utilization', { defaultValue: 'Closet Utilization' })}</span>
              <span className="text-2xl font-bold font-display text-foreground" data-testid="stats-utilization">
                {utilization}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Active Items Worn */}
        <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">{t('stats.wornRatio', { defaultValue: 'Items Worn' })}</span>
              <span className="text-2xl font-bold font-display text-foreground" data-testid="stats-items-ratio">
                {wornItems} / {items.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Leaderboard Section */}
      {items.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-border py-16 text-center">
          <CardContent className="space-y-4">
            <Shirt className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="font-display text-xl font-bold">{t('stats.emptyStateTitle', { defaultValue: 'No Garments to Analyze' })}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('stats.emptyStateDesc', { defaultValue: 'Add items to your wardrobe and record wears with your stylist or calendar to see insights.' })}
            </p>
            <div className="pt-2">
              <Link to="/closet/add">
                <Button className="rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90 px-6 font-semibold shadow-sm">
                  {t('closet.addNewItem', { defaultValue: 'Add First Item' })}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Color Breakdown Card */}
          <Card className="rounded-3xl border border-border bg-card shadow-sm p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <CardTitle className="text-base font-semibold font-display text-foreground">
                {breakdownType === 'colors' 
                  ? t('stats.colorPalette', { defaultValue: 'Color Palette Breakdown' })
                  : breakdownType === 'materials'
                  ? t('stats.materialsPalette', { defaultValue: 'Materials Breakdown' })
                  : t('stats.categoriesPalette', { defaultValue: 'Subcategories Breakdown' })}
              </CardTitle>
              
              <Select value={breakdownType} onValueChange={(val) => { setBreakdownType(val); setIsLegendExpanded(false); }}>
                <SelectTrigger className="w-[140px] h-8 rounded-xl text-xs font-semibold bg-secondary/50 border-border/50">
                  <SelectValue placeholder={t('stats.breakdownType', { defaultValue: 'Breakdown Type' })} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  <SelectItem value="colors" className="text-xs rounded-lg font-medium">{t('stats.typeColors', { defaultValue: 'Colors' })}</SelectItem>
                  <SelectItem value="materials" className="text-xs rounded-lg font-medium">{t('stats.typeMaterials', { defaultValue: 'Materials' })}</SelectItem>
                  <SelectItem value="categories" className="text-xs rounded-lg font-medium">{t('stats.typeCategories', { defaultValue: 'Categories' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-56 w-full flex items-center justify-center min-h-0">
              {colorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={colorData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {colorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} className="stroke-background stroke-2" />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-muted-foreground">{t('stats.noColorData', { defaultValue: 'No color tags specified.' })}</span>
              )}
            </div>
            {colorData.length > 0 && (
              <div className="mt-4 border-t border-border/40 pt-4 flex flex-col items-center">
                <div 
                  className={`w-full flex flex-wrap gap-2 justify-center transition-all duration-300 ease-in-out ${
                    isLegendExpanded ? 'max-h-[1000px] overflow-visible' : 'max-h-16 overflow-hidden'
                  }`}
                  data-testid="color-palette-legend"
                >
                  {colorData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/35 text-[10px] font-semibold text-foreground/80 border border-border/50 shadow-sm transition-transform hover:scale-[1.03]">
                      <span className="h-2.5 w-2.5 rounded-full border border-border/40 shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span>{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
                
                {colorData.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 h-7 text-xs text-brand hover:text-brand/80 font-semibold flex items-center gap-1 rounded-xl transition-all"
                    onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                  >
                    {isLegendExpanded ? (
                      <>
                        {t('stats.showLess', { defaultValue: 'Show Less' })}
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        {t('stats.showAllColors', { defaultValue: 'Show All Colors' })}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Cost-per-Wear Card */}
          <Card className="rounded-3xl border border-border bg-card shadow-sm p-6 flex flex-col justify-between space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-semibold font-display text-foreground">{t('stats.costPerWear', { defaultValue: 'Cost-per-Wear Leaderboard' })}</CardTitle>
            </CardHeader>

            <div className="space-y-6 flex-1 justify-center flex flex-col">
              {sortedByEfficiency.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-accent-green caps-label block tracking-wider">{t('stats.mostEfficient', { defaultValue: 'Most Wear-Efficient' })}:</span>
                    {topEfficient.map(it => (
                      <div key={it.id} className="flex justify-between items-center text-xs py-2 border-b border-border/40 hover:bg-muted/30 px-1 rounded-lg transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          {it.image_url && (
                            <img src={it.segmented_image_url || it.image_url} alt="" className="h-6 w-6 rounded object-contain shrink-0 bg-secondary/50" />
                          )}
                          <span className="truncate font-medium text-foreground">{it.name || it.title || 'Untitled'}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">${it.cpw.toFixed(2)}/wear</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-destructive caps-label block tracking-wider">{t('stats.leastEfficient', { defaultValue: 'Least Wear-Efficient' })}:</span>
                    {bottomEfficient.map(it => (
                      <div key={it.id} className="flex justify-between items-center text-xs py-2 border-b border-border/40 hover:bg-muted/30 px-1 rounded-lg transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          {it.image_url && (
                            <img src={it.segmented_image_url || it.image_url} alt="" className="h-6 w-6 rounded object-contain shrink-0 bg-secondary/50" />
                          )}
                          <span className="truncate font-medium text-foreground">{it.name || it.title || 'Untitled'}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">${it.cpw.toFixed(2)}/wear</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-muted-foreground text-xs bg-secondary/30 rounded-2xl border border-dashed border-border/50">
                  <Award className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <span>{t('stats.noCPWData', { defaultValue: 'Purchase price is required to calculate cost-per-wear stats.' })}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      <ExploreBackButton />
    </div>
  );
}
