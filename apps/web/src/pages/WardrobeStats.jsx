import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';
import { useClosetStore } from '@/lib/useClosetStore';
import { DollarSign, Percent, TrendingUp, Shirt, Award, ChevronDown, ChevronUp, Activity, Leaf, ShoppingBag, Droplets, LineChart as ChartIcon, CheckSquare, Square, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { labelForColor, canonicalColorKey, labelForMaterial, labelForSubCategory, canonicalMaterialKey, canonicalSubCategoryKey } from '@/lib/taxonomy';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bestImageUrl } from '@/lib/itemImage';
import WardrobeStatsBanner from "../assets/img/inner6.webp";
import { LayoutGrid } from 'lucide-react';
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
  acrylic: '#4C0519',
  brocade: '#D4AF37',
  burlap: '#654321',
  canvas: '#E0D8C8',
  cashmere: '#E6E6FA',
  chambray: '#B0E0E6',
  chiffon: '#9370DB',
  copper: '#8B4513',
  cotton: '#FFFFF0',
  denim: '#1E90FF',
  leather: '#FFDAB9',
  linen: '#D2B48C',
  mesh: '#E0FFF0',
  nylon: '#1A2530',
  oxblood: '#800020',
  polyester: '#BE185D',
  rayon: '#FB7185',
  ripstop: '#355E3B',
  satin: '#FFDEAD',
  silk: '#FFFDF9',
  spandex: '#FFF1F2',
  suede: '#CD853F',
  velvet: '#4A001F',
  vinyl: '#00FF7F',
  wool: '#F5F2EB',
  other: '#a1a1aa',
};

const getMaterialColor = (key) => {
  return MATERIAL_COLOR_MAP[key] || '#a1a1aa';
};

const SUBCATEGORY_COLOR_MAP = {
  boots: '#4A1505',
  dress_shoes: '#E65C00',
  sandals: '#FAD6BD',
  sneakers: '#FF3300',
  heels: '#800000',
  flats: '#FF9966',
  slippers: '#FFCCB3',
  soles_and_outsoles: '#121214',
  heels_and_lifts: '#3A3A3C',
  midsoles_and_cushioning: '#E5E5EA',
  insoles_and_footbeds: '#AEAEB2',
  laces_and_fasteners: '#8E8E93',
  eyelets_and_grommets: '#F2F2F7',
  vamps_and_uppers: '#636366',
  coats: '#0F1E36',
  jackets: '#2B7FFF',
  performance_gear: '#BCE3FF',
  blazers: '#1D4ED8',
  vests: '#60A5FA',
  capes_and_ponchos: '#1E3A8A',
  shrugs: '#EFF6FF',
  tailored_shirts: '#E0F7FA',
  knitwear: '#2E7D32',
  t_shirts: '#AEEA00',
  blouses: '#4ADE80',
  tank_tops: '#14532D',
  sweatshirts: '#84CC16',
  tunics: '#DCFCE7',
  trousers: '#FBE9E7',
  jeans: '#7B1FA2',
  shorts: '#310A31',
  leggings: '#4A044E',
  sweatpants: '#D946EF',
  jumpsuits_and_rompers: '#A21CAF',
  overalls: '#F5D0FE',
  skirts: '#9D174D',
  mini_dresses: '#F43F5E',
  maxi_dresses: '#FFE4E6',
  evening_dresses: '#4C0519',
  midi_dresses: '#FB7185',
  sundresses: '#FFF1F2',
  wrap_dresses: '#BE185D',
  sports_bras: '#0D9488',
  tracksuits: '#06B6D4',
  active_jackets: '#CCFBF1',
  performance_tops: '#115E59',
  running_shorts: '#22D3EE',
  compression_gear: '#042F2E',
  athleisure_dresses: '#E0F2FE',
  one_piece_swimsuits: '#CA8A04',
  bikinis: '#FACC15',
  swim_trunks: '#FEF08A',
  cover_ups: '#FEFCE8',
  rash_guards: '#854D0E',
  wetsuits: '#451A03',
  resort_rompers: '#EAB308',
  necklaces: '#D4AF37',
  earrings: '#C0C0C0',
  bracelets_and_bangles: '#B76E79',
  rings: '#E5E4E2',
  brooches_and_pins: '#8A9A86',
  watches: '#4B5563',
  body_jewelry: '#1F2937',
  bags: '#78350F',
  small_goods: '#D97706',
  headwear: '#FEF3C7',
  belts: '#451A03',
  gloves: '#F59E0B',
  scarves_and_wraps: '#B45309',
  hosiery_and_socks: '#FFFBEB',
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

const getSubCategoryColor = (canonicalKey, parentCategory) => {
  if (SUBCATEGORY_COLOR_MAP[canonicalKey]) {
    return SUBCATEGORY_COLOR_MAP[canonicalKey];
  }
  const baseHue = CATEGORY_HUES[parentCategory] || 200;
  const hash = hashString(canonicalKey || '');
  const saturation = 65 + (hash % 20); // 65% - 85%
  const lightness = 45 + (hash % 25);  // 45% - 70%
  return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
};



export default function WardrobeStats() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useClosetStore();
  const items = store.items || [];

  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [breakdownType, setBreakdownType] = useState('colors');
  const [chartView, setChartView] = useState('ring');
  const [sustainabilityData, setSustainabilityData] = useState(null);

  const [actionType, setActionType] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const unwornItems = useMemo(() => {
    return items.filter(it => (it.wear_count || 0) === 0);
  }, [items]);

  const toggleSelection = (id) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const [isConfirming, setIsConfirming] = useState(false);
  const handleConfirmAction = async () => {
    if (selectedItemIds.length === 0) return;
    setIsConfirming(true);
    try {
      const mode = actionType === 'sell' ? 'for_sale' : 'donate';
      for (const id of selectedItemIds) {
        await api.put(`/closet/${id}`, { marketplace_intent: mode, marketplace_visibility: 'public' });
      }
      toast({
        title: "Success",
        description: actionType === 'sell' ? "Items listed on Marketplace!" : "Items flagged for donation!",
      });
      setActionType(null);
      setSelectedItemIds([]);
      if (store.fetchItems) store.fetchItems();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to process items", variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };




  useEffect(() => {
    api.get('/closet/stats/sustainability')
      .then(res => setSustainabilityData(res.data))
      .catch(err => console.error("Failed to fetch sustainability stats", err));
  }, []);


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
            const canonicalKey = canonicalMaterialKey(raw);
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
          const canonicalKey = raw ? canonicalMaterialKey(raw) : 'other';
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
        const canonicalKey = raw ? canonicalSubCategoryKey(raw) : 'other';
        const fill = getSubCategoryColor(canonicalKey, parentCategory);
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

  const itemsWithPrice = sortedByEfficiency.length;
  const avgCpw = itemsWithPrice > 0
    ? sortedByEfficiency.reduce((acc, it) => acc + it.cpw, 0) / itemsWithPrice
    : 0;

  const topEfficient5 = sortedByEfficiency.slice(0, 5).map(it => ({
    name: it.name || it.title || t('common.untitled', { defaultValue: 'Untitled' }),
    cpw: parseFloat(it.cpw.toFixed(2)),
    wears: it.wear_count || 0
  }));

  return (
    <>

      {/* Banner Section */}
      <section
        className="relative isolate overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${WardrobeStatsBanner})` }}
      >
        {/* Dark gradient overlay */}
        <div
          className="
            absolute inset-0 -z-0
            bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)]
          "
        />
        <div className="relative z-10 w-full">
          <div
            className="
              px-10 py-20
              max-[991px]:px-[35px] max-[991px]:py-[45px]
              max-[767px]:px-5 max-[767px]:py-[38px]
              max-[480px]:px-4 max-[480px]:py-8
            "
          >
            <div className="max-w-[520px]">
              {/* <span className="caps-label text-white/70 font-bold tracking-wider text-xs">
                {t('stats.category', { defaultValue: 'DressApp Unpacked' })}
              </span> */}
              <h1
                className="
                  m-0 mt-1 mb-0 text-[40px] leading-[40px] font-bold tracking-normal text-white
                  max-[767px]:text-[42px] max-[480px]:text-[35px]
                "
              >
                {t('stats.title', { defaultValue: 'Wardrobe Insights' })}
              </h1>
              <p
                className="
                  my-5 max-w-[450px] text-[14px] leading-6 tracking-[0.5px] text-white/60
                  max-[767px]:max-w-full max-[767px]:mt-[15px]
                "
              >
                {t('stats.description', { defaultValue: 'Analyze your wardrobe value, wear metrics, and dominant style palettes to cultivate conscious wear habits.' })}
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* content-tab-section */}
      <div className="px-[40px] py-[40px] bg-[var(--accent-beige)]" data-testid="wardrobe-stats-page">
        {/* back-button */}
        <ExploreBackButton />
        {/* tabs-section-start */}
        <Tabs defaultValue="overview" className="w-full mt-2">
          <TabsList className="mb-6 bg-white border border-border/50 p-1.5 rounded-full inline-flex gap-1 h-auto shadow-sm">
            <TabsTrigger
              value="overview"
              className="
              rounded-full px-5 py-2.5 flex gap-2 items-center
              text-text-brand font-medium text-[14px]
              data-[state=active]:bg-primary-brand data-[state=active]:text-white
              data-[state=active]:shadow-sm
              transition-all
            "
            >
              <LayoutGrid className="h-4 w-4" />
              {t('wardrobeStats.tabOverview', { defaultValue: 'Overview' })}
            </TabsTrigger>
            <TabsTrigger
              value="impact"
              className="
              rounded-full px-5 py-2.5 flex gap-2 items-center
              text-text-brand font-medium text-[14px]
              data-[state=active]:bg-primary-brand data-[state=active]:text-white
              data-[state=active]:shadow-sm 
              transition-all
            "
            >
              <Leaf className="h-4 w-4" />
              {t('wardrobeStats.tabSustainability', { defaultValue: 'Sustainability Impact' })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6">
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {/* Value Card */}
              <Card className="rounded-[12px] border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
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
              <Card className="rounded-[12px] border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
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
              <Card className="rounded-[12px] border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-orange-100 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] md:text-xs text-muted-foreground block font-medium">{t('stats.wornRatio', { defaultValue: 'Items Worn' })}</span>
                    <span className="text-xl md:text-2xl font-bold font-display text-foreground" data-testid="stats-items-ratio">
                      {wornItems} / {items.length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Avg CPW */}
              <Card className="rounded-[12px] border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-accent-yellow/20 text-accent-yellow flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] md:text-xs text-muted-foreground block font-medium">{t('stats.avgCpw', { defaultValue: 'Avg Cost/Wear' })}</span>
                    <span className="text-xl md:text-2xl font-bold font-display text-foreground" data-testid="stats-avg-cpw">
                      ${avgCpw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <Card className="rounded-[12px] border border-border bg-card shadow-sm p-5 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <CardTitle className="text-[16px] font-semibold  text-dark-brand">
                      {breakdownType === 'colors'
                        ? t('stats.colorPalette', { defaultValue: 'Color Palette Breakdown' })
                        : breakdownType === 'materials'
                          ? t('stats.materialsPalette', { defaultValue: 'Materials Breakdown' })
                          : t('stats.categoriesPalette', { defaultValue: 'Subcategories Breakdown' })}
                    </CardTitle>

                    <div className="flex items-center gap-2">
                      <Select value={breakdownType} onValueChange={(val) => { setBreakdownType(val); setIsLegendExpanded(false); }}>
                        <SelectTrigger className="w-[110px] h-8 rounded-xl text-xs font-semibold bg-secondary/50 border-border/50">
                          <SelectValue placeholder={t('stats.breakdownType', { defaultValue: 'Breakdown Type' })} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50">
                          <SelectItem value="colors" className="text-xs rounded-lg font-medium">{t('stats.typeColors', { defaultValue: 'Colors' })}</SelectItem>
                          <SelectItem value="materials" className="text-xs rounded-lg font-medium">{t('stats.typeMaterials', { defaultValue: 'Materials' })}</SelectItem>
                          <SelectItem value="categories" className="text-xs rounded-lg font-medium">{t('stats.typeCategories', { defaultValue: 'Categories' })}</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={chartView} onValueChange={(val) => setChartView(val)}>
                        <SelectTrigger className="w-[90px] h-8 rounded-xl text-xs font-semibold bg-secondary/50 border-border/50">
                          <SelectValue placeholder={t('stats.chartView', { defaultValue: 'Chart Type' })} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50">
                          <SelectItem value="ring" className="text-xs rounded-lg font-medium">{t('stats.viewRing', { defaultValue: 'Ring' })}</SelectItem>
                          <SelectItem value="pie" className="text-xs rounded-lg font-medium">{t('stats.viewPie', { defaultValue: 'Pie' })}</SelectItem>
                          <SelectItem value="bars" className="text-xs rounded-lg font-medium">{t('stats.viewBars', { defaultValue: 'Bars' })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="h-56 w-full flex items-center justify-center min-h-0">
                    {colorData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        {chartView === 'bars' ? (
                          <BarChart data={colorData} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                            <XAxis
                              dataKey="name"
                              tick={{
                                angle: -90,
                                textAnchor: i18n.dir() === 'rtl' ? 'start' : 'end',
                                fontSize: 9
                              }}
                              height={75}
                              interval={0}
                              stroke="#888888"
                            />
                            <YAxis
                              fontSize={9}
                              stroke="#888888"
                              allowDecimals={false}
                            />
                            <Tooltip />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {colorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <PieChart>
                            <Pie
                              data={colorData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={chartView === 'ring' ? 45 : 0}
                              outerRadius={70}
                              paddingAngle={chartView === 'ring' ? 2 : 0}
                            >
                              {colorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} className="stroke-background stroke-2" />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('stats.noColorData', { defaultValue: 'No color tags specified.' })}</span>
                    )}
                  </div>
                  {colorData.length > 0 && chartView !== 'bars' && (
                    <div className="mt-4 border-t border-border/40 pt-4 flex flex-col items-center">
                      <div
                        className={`w-full flex flex-wrap gap-2 justify-center transition-all duration-300 ease-in-out ${isLegendExpanded ? 'max-h-[1000px] overflow-visible' : 'max-h-16 overflow-hidden'
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
                <Card className="rounded-[12px] border border-border bg-card shadow-sm p-5 flex flex-col justify-between space-y-4">
                  <CardTitle className="text-[16px] font-semibold  text-dark-brand">{t('stats.costPerWear', { defaultValue: 'Cost-per-Wear Leaderboard' })}</CardTitle>
                  <div className="h-[100%] w-full flex items-center justify-center min-h-0 pt-4">
                    {topEfficient5.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topEfficient5} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                          <XAxis
                            dataKey="name"
                            tick={{
                              angle: -45,
                              textAnchor: 'end',
                              fontSize: 9
                            }}
                            height={60}
                            interval={0}
                            stroke="#888888"
                          />
                          <YAxis
                            fontSize={9}
                            stroke="#888888"
                            tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              name === 'cpw' ? `$${value}` : value,
                              name === 'cpw' ? 'Cost-per-Wear' : name
                            ]}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Bar dataKey="cpw" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
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
          </TabsContent>
          <TabsContent value="impact" className="space-y-6">
            {!sustainabilityData ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                Loading impact data...
              </div>
            ) : (
              <>
                {/* Primary KPI Grid for Impact */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-accent-green/20 text-accent-green flex items-center justify-center shrink-0">
                        <Percent className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">{t('wardrobeStats.sustainability.utilisationTitle', { defaultValue: 'Wardrobe Utilisation' })}</span>
                        <span className="text-2xl font-bold font-display text-foreground">
                          {sustainabilityData.utilisation_pct}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <Leaf className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">{t('wardrobeStats.sustainability.carbonTitle', { defaultValue: 'Carbon Tracked' })}</span>
                        <span className="text-2xl font-bold font-display text-foreground">
                          {sustainabilityData.carbon_sum} <span className="text-sm text-muted-foreground font-normal">kg CO₂</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-950/20 text-orange-500 flex items-center justify-center shrink-0">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">{t('wardrobeStats.sustainability.intakeManual', { defaultValue: 'Manual Adds' })}</span>
                        <span className="text-2xl font-bold font-display text-foreground">
                          {sustainabilityData.intake_breakdown.manual}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-950/20 text-blue-500 flex items-center justify-center shrink-0">
                        <Droplets className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">{t('wardrobeStats.sustainability.intakeReceipt', { defaultValue: 'From Receipts' })}</span>
                        <span className="text-2xl font-bold font-display text-foreground">
                          {sustainabilityData.intake_breakdown.receipt}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 rounded-3xl border border-border shadow-sm bg-card p-6">
                    <CardHeader className="p-0 mb-6">
                      <CardTitle className="text-lg font-display">{t('wardrobeStats.sustainability.cpwTrendTitle', { defaultValue: 'Cost-per-wear Trend' })}</CardTitle>
                      <p className="text-sm text-muted-foreground">{t('wardrobeStats.sustainability.cpwTrendDesc', { defaultValue: 'Your 6-month closet value efficiency.' })}</p>
                    </CardHeader>
                    <CardContent className="p-0 h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sustainabilityData.cpw_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCpw" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `$${val}`} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [`$${value}`, 'Avg CPW']}
                          />
                          <Area type="monotone" dataKey="cpw" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorCpw)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-border shadow-sm bg-brand/5 p-6 flex flex-col justify-center text-center overflow-hidden flex-1 min-h-[300px]">
                    {!actionType ? (
                      <>
                        <Shirt className="h-12 w-12 text-brand mx-auto mb-4 opacity-80" />
                        <h3 className="font-display font-bold text-xl mb-2">{t('wardrobeStats.sustainability.smartSuggestionTitle', { defaultValue: 'Smart Suggestion' })}</h3>
                        <p className="text-muted-foreground text-sm mb-6">
                          {t('wardrobeStats.sustainability.smartSuggestionDesc', { count: unwornItems.length, defaultValue: `You have ${unwornItems.length} items that haven't been worn in 90 days. Consider listing them on the Marketplace or donating them to keep your closet sustainable.` })}
                        </p>
                        <div className="flex flex-col gap-2">
                          <Button variant="default" onClick={() => { setActionType('sell'); setSelectedItemIds(unwornItems.map(i => i.id)); }} className="w-full rounded-xl bg-brand text-white">{t('wardrobeStats.sustainability.listMarketplace', { defaultValue: 'List on Marketplace' })}</Button>
                          <Button variant="outline" onClick={() => { setActionType('donate'); setSelectedItemIds(unwornItems.map(i => i.id)); }} className="w-full rounded-xl border-brand/20 text-brand bg-transparent hover:bg-brand/10">{t('wardrobeStats.sustainability.markDonate', { defaultValue: 'Mark to Donate' })}</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col h-full w-full text-left">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-display font-bold text-lg text-brand">
                            {actionType === 'sell' ? t('wardrobeStats.sustainability.selectToSell', { defaultValue: 'Select items to sell' }) : t('wardrobeStats.sustainability.selectToDonate', { defaultValue: 'Select items to donate' })}
                          </h3>
                          <Button variant="ghost" size="icon" onClick={() => { setActionType(null); setSelectedItemIds([]); }} className="h-8 w-8 text-muted-foreground hover:bg-black/5 rounded-full">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-2 space-y-2 max-h-[220px]">
                          {unwornItems.map((item) => {
                            const isSelected = selectedItemIds.includes(item.id);
                            return (
                              <div key={item.id} className="flex items-center gap-3 py-2 bg-white/50 rounded-xl px-3 border border-border/50">
                                <button
                                  onClick={() => toggleSelection(item.id)}
                                  className="text-brand focus:outline-none shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="h-5 w-5 fill-brand/20 text-brand" />
                                  ) : (
                                    <Square className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>

                                <img
                                  src={bestImageUrl(item) || 'https://via.placeholder.com/150'}
                                  alt={item.title}
                                  className="h-10 w-10 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => navigate(`/closet/${item.id}`)}
                                />

                                <div className="min-w-0 flex-1">
                                  <div
                                    className="cursor-pointer hover:underline text-foreground"
                                    onClick={() => navigate(`/closet/${item.id}`)}
                                  >
                                    <p className="text-sm font-medium truncate">{item.title || t('common.untitled', { defaultValue: 'Untitled' })}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {unwornItems.length === 0 && (
                            <div className="text-center text-muted-foreground text-sm py-4">{t('wardrobeStats.sustainability.noUnwornItems', { defaultValue: 'No unworn items found.' })}</div>
                          )}
                        </div>

                        <div className="pt-4 mt-auto border-t border-border/50 flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => { setActionType(null); setSelectedItemIds([]); }}
                            className="flex-1 rounded-xl bg-white border-border"
                            disabled={isConfirming}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleConfirmAction}
                            className="flex-1 rounded-xl bg-brand text-white"
                            disabled={selectedItemIds.length === 0 || isConfirming}
                          >
                            {isConfirming ? t('common.confirming', { defaultValue: 'Confirming...' }) : t('common.confirm', { defaultValue: 'Confirm' })}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}