import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { useClosetStore } from '@/lib/useClosetStore';
import { DollarSign, Percent, TrendingUp, Shirt, Award, ChevronDown, ChevronUp, Activity, Leaf, ShoppingBag, Droplets, CheckSquare, Square, X, Sparkles, Users, Crown, Upload, CheckCircle2, Share2, Copy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTierLimits } from '@/hooks/useTierLimits';
import OnboardingMigrationModal from '@/components/OnboardingMigrationModal';
import { getGooglePlayAffiliateUrl } from '@/components/InviteFriendsButton';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { labelForColor, canonicalColorKey, labelForMaterial, labelForSubCategory, canonicalMaterialKey, canonicalSubCategoryKey } from '@/lib/taxonomy';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bestImageUrl } from '@/lib/itemImage';
import PrivacyBanner from '../assets/img/inner6.webp';
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';
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
  const { user } = useAuth();
  const { userTier, isFree } = useTierLimits();
  const store = useClosetStore({ prewarm: true });
  const items = useMemo(() => store.items || [], [store.items]);

  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [breakdownType, setBreakdownType] = useState('colors');
  const [chartView, setChartView] = useState('ring');
  const [sustainabilityData, setSustainabilityData] = useState(null);

  const [actionType, setActionType] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [suggestionMode, setSuggestionMode] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const unwornItems = useMemo(() => {
    return items.filter(it => (it.wear_count || 0) === 0);
  }, [items]);

  const closetBonus = user?.closet_capacity_bonus || 0;
  const freeCapacity = Math.min(150, 50 + closetBonus);

  const accountAgeDays = useMemo(() => {
    if (!user?.created_at) return 1;
    const createdMs = new Date(user.created_at).getTime();
    if (Number.isNaN(createdMs)) return 1;
    return Math.max(1, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)) + 1);
  }, [user?.created_at]);

  const onboardingPhaseBadge = useMemo(() => {
    if (items.length === 0 || accountAgeDays <= 7) {
      return t('wardrobeStats.onboarding.phase1Badge', { defaultValue: 'Days 1–7 • Kickoff & First Value' });
    }
    if (items.length < 20 || accountAgeDays <= 30) {
      return t('wardrobeStats.onboarding.phase2Badge', { defaultValue: 'Days 8–30 • Rapid Digitizing' });
    }
    if (items.length < 50 || accountAgeDays <= 60) {
      return t('wardrobeStats.onboarding.phase3Badge', { defaultValue: 'Days 31–60 • Style Adoption' });
    }
    return t('wardrobeStats.onboarding.phase4Badge', { defaultValue: 'Days 61–90 • Value & Circularity' });
  }, [items.length, accountAgeDays, t]);

  const activeSuggestionMode = useMemo(() => {
    if (suggestionMode) return suggestionMode;
    if (items.length === 0) return 'digitize';
    if (items.length < 15) return 'digitize';
    if (isFree && items.length >= 35) return 'invite';
    return 'circular';
  }, [suggestionMode, items.length, isFree]);

  const handleInviteFriends = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    const inviteUrl = user?.id ? `${window.location.origin}/?ref=${user.id}` : `${window.location.origin}/?ref=invite`;
    const playStoreUrl = getGooglePlayAffiliateUrl(user?.id);
    const bodyText = t('profile.inviteBody', { defaultValue: 'Share your personal referral link to invite friends. You both receive bonus AI credits!' });
    const playStoreLabel = t('profile.getOnGooglePlay', { defaultValue: 'Get DressApp on Google Play' });
    const shareMessage = ${bodyText} \n\n: ;
    const payload = {
      title: t('profile.inviteSubject', { defaultValue: 'Join me on DressApp' }),
      text: shareMessage,
      url: inviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(shareMessage);
        toast({
          title: t('profile.inviteFriends', { defaultValue: 'Invite Friends' }),
          description: t('profile.inviteCopied', { defaultValue: 'Referral link copied to clipboard!' }),
        });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareMessage);
          toast({
            title: t('profile.inviteFriends', { defaultValue: 'Invite Friends' }),
            description: t('profile.inviteCopied', { defaultValue: 'Referral link copied to clipboard!' }),
          });
        } catch {
          toast({ title: t('common.error', { defaultValue: 'Error' }), variant: 'destructive' });
        }
      }
    } finally {
      setInviteBusy(false);
    }
  };

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
        const updated = await api.patchItem(id, { marketplace_intent: mode, marketplace_visibility: 'public' });
        if (updated && store.upsert) store.upsert(updated);
      }
      toast({
        title: "Success",
        description: actionType === 'sell' ? "Items listed on Marketplace!" : "Items flagged for donation!",
      });
      setActionType(null);
      setSelectedItemIds([]);
      if (store.prewarm) store.prewarm({ force: true }).catch(() => {});
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to process items", variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };

  useEffect(() => {
    api.getSustainabilityStats()
      .then(data => setSustainabilityData(data))
      .catch(err => console.error("Failed to fetch sustainability stats", err));
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
      <PageHeroBanner image={PrivacyBanner}>
        <div className="relative z-10 w-full">
          <div
            className="
                  px-10 py-20
                 max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]
                "
          >
            <div className="max-w-[520px]">
              <span>{t('stats.category', { defaultValue: 'DressApp Unpacked' })}</span>
              {/* Title */}
              <h1
                className="
                      m-0 mb-0
                      text-[40px] leading-[40px]
                      font-bold
                      tracking-normal
                      text-white
                       max-[767px]:text-[30px]
                max-[480px]:text-[20px]
                max-[480px]:leading-[30px]
                max-[480px]:mb-3
                    "
              >
                {t('stats.title', { defaultValue: 'Wardrobe Insights' })}
              </h1>
              {/* Description */}
              <p
                className="
                      my-5
                      max-w-[450px]
                      text-[14px]
                      leading-6
                      tracking-[0.5px]
                      text-white/60
                      max-[767px]:max-w-full
                      max-[767px]:mt-[15px]
                    "
              >
                {t('stats.description', { defaultValue: 'Analyze your wardrobe value, wear metrics, and dominant style palettes to cultivate conscious wear habits.' })}
              </p>
            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className="bg-accent-beige px-[40px] py-[40px] max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]" data-testid="wardrobe-stats-page">
        <ExploreBackButton />
        <Tabs defaultValue="overview" className="w-full mt-2">
          <TabsList className="inline-flex mb-6 items-center gap-1 rounded-full bg-white p-[5px]">
            <TabsTrigger
              value="overview"
              className="group flex items-center gap-[7px] rounded-full px-[20px] py-[10px] text-[12px] font-bold text-text-brand bg-transparent border-0 transition-all duration-200 whitespace-nowrap hover:text-primary-brand hover:bg-primary-shadow data-[state=active]:bg-primary-brand data-[state=active]:text-white"
              data-testid="wardrobe-stats-tab-overview"
            >
              {t('wardrobeStats.tabOverview', { defaultValue: 'Overview' })}
            </TabsTrigger>
            <TabsTrigger
              value="impact"
              className="group flex items-center gap-[7px] rounded-full px-[20px] py-[10px] text-[12px] font-bold text-text-brand bg-transparent border-0 transition-all duration-200 whitespace-nowrap hover:text-primary-brand hover:bg-primary-shadow data-[state=active]:bg-primary-brand data-[state=active]:text-white"
              data-testid="wardrobe-stats-tab-impact"
            >
              {t('wardrobeStats.tabSustainability', { defaultValue: 'Sustainability Impact' })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6">
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {/* Value Card */}
              <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className='max-[480px]:text-center'>
                    <span className="text-xs text-text-brand block font-semibold">{t('stats.totalValue', { defaultValue: 'Closet Worth' })}</span>
                    <span className="text-[20px] font-bold text-dark-brand" data-testid="stats-total-value">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Utilization Card */}
              <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                    <Percent className="h-6 w-6" />
                  </div>
                  <div className='max-[480px]:text-center'>
                    <span className="text-xs text-text-brand block font-semibold">{t('stats.utilization', { defaultValue: 'Closet Utilization' })}</span>
                    <span className="text-[20px] font-bold text-dark-brand" data-testid="stats-utilization">
                      {utilization}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Active Items Worn */}
              <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className='max-[480px]:text-center'>
                    <span className="text-[10px] md:text-xs text-text-brand block font-semibold">{t('stats.wornRatio', { defaultValue: 'Items Worn' })}</span>
                    <span className="text-[20px] font-bold text-dark-brand" data-testid="stats-items-ratio">
                      {wornItems} / {items.length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Avg CPW */}
              <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className='max-[480px]:text-center'>
                    <span className="text-[10px] md:text-xs text-text-brand block font-semibold">{t('stats.avgCpw', { defaultValue: 'Avg Cost/Wear' })}</span>
                    <span className="text-[20px] font-bold text-dark-brand" data-testid="stats-avg-cpw">
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
                  <Shirt className="h-12 w-12 text-text-brand/60 mx-auto" />
                  <h2 className="font-display text-xl font-bold">{t('stats.emptyStateTitle', { defaultValue: 'No Garments to Analyze' })}</h2>
                  <p className="text-sm text-text-brand max-w-sm mx-auto">
                    {t('stats.emptyStateDesc', { defaultValue: 'Add items to your wardrobe and record wears with your stylist or calendar to see insights.' })}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <Link to="/closet/add">
                      <Button className="rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90 px-6 font-semibold shadow-sm" data-testid="stats-empty-add-item-btn">
                        {t('closet.addNewItem', { defaultValue: 'Add First Item' })}
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsMigrationModalOpen(true)}
                      className="rounded-2xl border-primary-brand text-primary-brand hover:bg-primary-shadow px-6 font-semibold flex items-center gap-2"
                      data-testid="stats-empty-migrate-btn"
                    >
                      <Upload className="h-4 w-4" />
                      {t('wardrobeStats.onboarding.migrateWardrobeBtn', { defaultValue: 'Migrate Wardrobe' })}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Color Breakdown Card */}
                <Card className="rounded-[12px] border border-border bg-white shadow-sm p-5 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h6 className="text-[16px] font-bold text-dark-brand">
                      {breakdownType === 'colors'
                        ? t('stats.colorPalette', { defaultValue: 'Color Palette Breakdown' })
                        : breakdownType === 'materials'
                          ? t('stats.materialsPalette', { defaultValue: 'Materials Breakdown' })
                          : t('stats.categoriesPalette', { defaultValue: 'Subcategories Breakdown' })}
                    </h6>
                    <div className="flex items-center gap-2">
                      <Select value={breakdownType} onValueChange={(val) => { setBreakdownType(val); setIsLegendExpanded(false); }}>
                        <SelectTrigger className="w-[120px] rounded-full h-9">
                          <SelectValue placeholder={t('stats.breakdownType', { defaultValue: 'Breakdown Type' })} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="colors" className="text-xs rounded-lg font-medium">{t('stats.typeColors', { defaultValue: 'Colors' })}</SelectItem>
                          <SelectItem value="materials" className="text-xs rounded-lg font-medium">{t('stats.typeMaterials', { defaultValue: 'Materials' })}</SelectItem>
                          <SelectItem value="categories" className="text-xs rounded-lg font-medium">{t('stats.typeCategories', { defaultValue: 'Categories' })}</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={chartView} onValueChange={(val) => setChartView(val)}>
                        <SelectTrigger className="w-[100px] rounded-full h-9">
                          <SelectValue placeholder={t('stats.chartView', { defaultValue: 'Chart Type' })} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ring" className="text-xs rounded-lg font-medium">{t('stats.viewRing', { defaultValue: 'Ring' })}</SelectItem>
                          <SelectItem value="pie" className="text-xs rounded-lg font-medium">{t('stats.viewPie', { defaultValue: 'Pie' })}</SelectItem>
                          <SelectItem value="bars" className="text-xs rounded-lg font-medium">{t('stats.viewBars', { defaultValue: 'Bars' })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="h-[360px] w-full flex items-center justify-center min-h-0 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
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
                              innerRadius={chartView === 'ring' ? 70 : 0}
                              outerRadius={110}
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
                      <span className="text-xs text-text-brand">{t('stats.noColorData', { defaultValue: 'No color tags specified.' })}</span>
                    )}
                  </div>

                  {colorData.length > 0 && chartView !== 'bars' && (
                    <div className="mt-4 border-t border-border pt-4 flex flex-col items-center">
                      <div
                        className={`w-full flex flex-wrap gap-2 justify-center transition-all duration-300 ease-in-out ${isLegendExpanded ? 'max-h-[1000px] overflow-visible' : 'max-h-16 overflow-hidden'
                          }`}
                        data-testid="color-palette-legend"
                      >
                        {colorData.map((entry, index) => (
                          <div key={index} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-beige text-[10px] font-bold text-text-brand border border-border shadow-sm">
                            <span className="h-2.5 w-2.5 rounded-full border border-border shrink-0" style={{ backgroundColor: entry.fill }} />
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
                <Card className="rounded-[12px] border border-border bg-white shadow-sm p-5 flex flex-col gap-4">
                  <CardHeader className="p-0">
                    <h6 className="text-[16px] font-bold text-dark-brand">{t('stats.costPerWear', { defaultValue: 'Cost-per-Wear Leaderboard' })}</h6>
                  </CardHeader>
                  <div className="h-[360px] w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
                    {topEfficient5.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topEfficient5} margin={{ top: 15, right: 10, left: -25, bottom: 40 }}>
                          <XAxis
                            dataKey="name"
                            tick={{ angle: -45, textAnchor: 'end', fontSize: 9, fill: '#888888' }}
                            height={70}
                            interval={0}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={false}
                          />
                          <YAxis
                            fontSize={9}
                            tickFormatter={(val) => `$${val}`}
                            tick={{ fill: '#888888' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            formatter={(value, name) => [
                              name === 'cpw' ? `$${value}` : value,
                              name === 'cpw' ? 'Cost-per-Wear' : name
                            ]}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #eee' }}
                          />
                          <Bar dataKey="cpw" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center p-3 text-text-brand text-xs font-bold bg-accent-beige rounded-[12px] border border-border">
                          <Award className="h-6 w-6 mx-auto mb-3 text-primary-brand" />
                          <span>{t('stats.noCPWData', { defaultValue: 'Purchase price is required to calculate cost-per-wear stats.' })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>
          <TabsContent value="impact" className="space-y-6">
            {!sustainabilityData ? (
              <div className="flex items-center justify-center py-20 text-text-brand">
                Loading impact data...
              </div>
            ) : (
              <>
                {/* Primary KPI Grid for Impact */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                      <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                        <Percent className="h-6 w-6" />
                      </div>
                      <div className='max-[480px]:text-center'>
                        <span className="text-[10px] md:text-xs text-text-brand block font-semibold">{t('wardrobeStats.sustainability.utilisationTitle', { defaultValue: 'Wardrobe Utilisation' })}</span>
                        <span className="text-[20px] font-bold text-dark-brand">
                          {sustainabilityData.utilisation_pct ?? 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                      <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                        <Leaf className="h-6 w-6" />
                      </div>
                      <div className='max-[480px]:text-center'>
                        <span className="text-[10px] md:text-xs text-text-brand block font-semibold">{t('wardrobeStats.sustainability.carbonTitle', { defaultValue: 'Carbon Tracked' })}</span>
                        <span className="text-[20px] font-bold text-dark-brand">
                          {sustainabilityData.carbon_sum ?? 0} <span className="text-sm text-text-brand font-normal">kg CO₂</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                      <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <div className='max-[480px]:text-center'>
                        <span className="text-[10px] md:text-xs text-text-brand block font-semibold">{t('wardrobeStats.sustainability.intakeManual', { defaultValue: 'Manual Adds' })}</span>
                        <span className="text-[20px] font-bold text-dark-brand">
                          {sustainabilityData.intake_breakdown?.manual ?? 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-[12px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center gap-4 flex-wrap max-[480px]:justify-center">
                      <div className="h-12 w-12 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                        <Droplets className="h-6 w-6" />
                      </div>
                      <div className='max-[480px]:text-center'>
                        <span className="text-[10px] md:text-xs text-text-brand block font-semibold">{t('wardrobeStats.sustainability.intakeReceipt', { defaultValue: 'From Receipts' })}</span>
                        <span className="text-[20px] font-bold text-dark-brand">
                          {sustainabilityData.intake_breakdown?.receipt ?? 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <Card className="rounded-[12px] lg:col-span-2 border border-border bg-white shadow-sm p-5 flex flex-col gap-4">
                    <CardHeader className="p-0">
                      <h6 className="text-[16px] font-bold text-dark-brand">{t('wardrobeStats.sustainability.cpwTrendTitle', { defaultValue: 'Cost-per-wear Trend' })}</h6>
                      <p className="text-[14px] font-semibold text-text-brand">{t('wardrobeStats.sustainability.cpwTrendDesc', { defaultValue: 'Your 6-month closet value efficiency.' })}</p>
                    </CardHeader>
                    <CardContent className="p-5 h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sustainabilityData.cpw_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Card
                    className="rounded-[12px] border border-border shadow-sm p-5 bg-white flex flex-col justify-between text-center overflow-hidden flex-1 min-h-[340px]"
                    data-testid="smart-suggestion-card"
                  >
                    {!actionType ? (
                      <div className="flex flex-col h-full justify-between gap-4">
                        {/* Header: 90-Day Onboarding Phase Badge & Pillar Switcher */}
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-shadow text-primary-brand text-[11px] font-bold mx-auto">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            <span>{onboardingPhaseBadge}</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-1.5" data-testid="smart-suggestion-pills">
                            <button
                              type="button"
                              onClick={() => setSuggestionMode('digitize')}
                              data-testid="smart-pill-digitize"
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                activeSuggestionMode === 'digitize'
                                  ? 'bg-primary-brand text-white shadow-xs'
                                  : 'bg-accent-beige text-text-brand hover:text-dark-brand'
                              }`}
                            >
                              {t('wardrobeStats.onboarding.pillDigitize', { defaultValue: 'Add & Migrate' })}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSuggestionMode('invite')}
                              data-testid="smart-pill-invite"
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                activeSuggestionMode === 'invite'
                                  ? 'bg-primary-brand text-white shadow-xs'
                                  : 'bg-accent-beige text-text-brand hover:text-dark-brand'
                              }`}
                            >
                              {t('wardrobeStats.onboarding.pillInvite', { defaultValue: 'Free Slots (+10)' })}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSuggestionMode('upgrade')}
                              data-testid="smart-pill-upgrade"
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                activeSuggestionMode === 'upgrade'
                                  ? 'bg-primary-brand text-white shadow-xs'
                                  : 'bg-accent-beige text-text-brand hover:text-dark-brand'
                              }`}
                            >
                              {t('wardrobeStats.onboarding.pillUpgrade', { defaultValue: 'Manager Plan' })}
                            </button>
                            {items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSuggestionMode('circular')}
                                data-testid="smart-pill-circular"
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                  activeSuggestionMode === 'circular'
                                    ? 'bg-primary-brand text-white shadow-xs'
                                    : 'bg-accent-beige text-text-brand hover:text-dark-brand'
                                }`}
                              >
                                {t('wardrobeStats.onboarding.pillCircular', { defaultValue: 'Circular Care' })}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mode 1: Digitize & Migrate (Default when 0 items or < 15 items) */}
                        {activeSuggestionMode === 'digitize' && (
                          <div className="flex flex-col flex-1 justify-between gap-4 text-start">
                            <div className="text-center">
                              <Shirt className="h-10 w-10 text-primary-brand mx-auto mb-2 opacity-85" />
                              <h3 className="font-bold text-[18px] mb-1.5 text-dark-brand">
                                {items.length === 0
                                  ? t('wardrobeStats.onboarding.emptyTitle', { defaultValue: 'Kickstart Your Digital Closet' })
                                  : t('wardrobeStats.onboarding.growingTitle', {
                                      count: items.length,
                                      defaultValue: `Keep Building Your Digital Closet (${items.length} items)`,
                                    })}
                              </h3>
                              <p className="text-text-brand text-[13px] font-semibold leading-relaxed">
                                {items.length === 0
                                  ? t('wardrobeStats.onboarding.emptyDesc', {
                                      defaultValue:
                                        'Your closet has 0 items right now. Add your first garments or migrate your wardrobe from another app to unlock AI outfit styling and sustainability insights.',
                                    })
                                  : t('wardrobeStats.onboarding.growingDesc', {
                                      defaultValue:
                                        'Reach 20+ items so your AI Stylist can assemble complete, weather-ready outfits and track accurate Cost-per-Wear trends.',
                                    })}
                              </p>
                            </div>

                            <div className="rounded-[10px] bg-accent-beige/70 border border-border p-3 space-y-1.5 text-start">
                              <span className="text-[11px] font-bold text-primary-brand uppercase tracking-wider block">
                                {t('wardrobeStats.onboarding.tipTitle', { defaultValue: 'Fast Digitizing Tips' })}
                              </span>
                              <ul className="space-y-1 text-[12px] text-dark-brand font-medium list-disc ps-4">
                                <li>
                                  {t('wardrobeStats.onboarding.tip1', {
                                    defaultValue:
                                      'Full-Outfit Snap: Upload one mirror or outfit photo—DressApp automatically splits and tags each garment in a single pass.',
                                  })}
                                </li>
                                <li>
                                  {t('wardrobeStats.onboarding.tip2', {
                                    defaultValue:
                                      'Receipts & Chrome Extension: Import digital shopping receipts or clip items directly from online stores.',
                                  })}
                                </li>
                                <li>
                                  {t('wardrobeStats.onboarding.tip3', {
                                    defaultValue:
                                      '1-Click App Migration: Moving from another wardrobe app? Batch-import your screenshots in seconds.',
                                  })}
                                </li>
                              </ul>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-1">
                              <Button
                                variant="default"
                                onClick={() => navigate('/closet/add')}
                                className="w-full flex-1"
                                data-testid="smart-suggestion-add-items-btn"
                              >
                                <Shirt className="h-4 w-4 me-1.5" />
                                {t('wardrobeStats.onboarding.addFirstItemsBtn', { defaultValue: 'Add Items' })}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setIsMigrationModalOpen(true)}
                                className="w-full flex-1"
                                data-testid="smart-suggestion-migrate-btn"
                              >
                                <Upload className="h-4 w-4 me-1.5" />
                                {t('wardrobeStats.onboarding.migrateWardrobeBtn', { defaultValue: 'Migrate Wardrobe' })}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Mode 2: Free Capacity Expansion via Referral (+10 Slots/Friend) */}
                        {activeSuggestionMode === 'invite' && (
                          <div className="flex flex-col flex-1 justify-between gap-4">
                            <div className="text-center">
                              <Users className="h-10 w-10 text-primary-brand mx-auto mb-2 opacity-85" />
                              <h3 className="font-bold text-[18px] mb-1.5 text-dark-brand">
                                {t('wardrobeStats.onboarding.inviteTitle', { defaultValue: 'Enlarge Your Closet Capacity for Free' })}
                              </h3>
                              <p className="text-text-brand text-[13px] font-semibold leading-relaxed">
                                {t('wardrobeStats.onboarding.inviteDesc', {
                                  defaultValue:
                                    'Invite friends with your personal link! Every friend who joins gives you +10 free closet slots (up to 150 items) plus bonus AI credits for both of you.',
                                })}
                              </p>
                            </div>

                            <div className="rounded-[10px] bg-accent-beige/70 border border-border p-3 space-y-2 text-start">
                              <div className="flex items-center justify-between text-[12px] font-bold text-dark-brand">
                                <span>
                                  {t('wardrobeStats.onboarding.capacityProgress', {
                                    used: items.length,
                                    capacity: freeCapacity,
                                    bonus: closetBonus,
                                    defaultValue: `Free Closet Capacity: ${items.length} / ${freeCapacity} slots (+${closetBonus} bonus slots)`,
                                  })}
                                </span>
                                <span className="text-primary-brand">{Math.min(100, Math.round((items.length / freeCapacity) * 100))}%</span>
                              </div>
                              <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-border">
                                <div
                                  className="h-full bg-primary-brand transition-all duration-300"
                                  style={{ width: `${Math.min(100, (items.length / freeCapacity) * 100)}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-1">
                              <Button
                                variant="default"
                                onClick={handleInviteFriends}
                                disabled={inviteBusy}
                                className="w-full flex-1"
                                data-testid="smart-suggestion-invite-btn"
                              >
                                {typeof navigator !== 'undefined' && navigator.share ? (
                                  <Share2 className="h-4 w-4 me-1.5" />
                                ) : (
                                  <Copy className="h-4 w-4 me-1.5" />
                                )}
                                {t('wardrobeStats.onboarding.inviteBtn', { defaultValue: 'Invite Friends (+10 Slots)' })}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setSuggestionMode('upgrade')}
                                className="w-full flex-1"
                              >
                                <Crown className="h-4 w-4 me-1.5" />
                                {t('wardrobeStats.onboarding.pillUpgrade', { defaultValue: 'Manager Plan' })}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Mode 3: Upgrade to Manager Plan */}
                        {activeSuggestionMode === 'upgrade' && (
                          <div className="flex flex-col flex-1 justify-between gap-4 text-start">
                            <div className="text-center">
                              <Crown className="h-10 w-10 text-primary-brand mx-auto mb-2 opacity-85" />
                              <h3 className="font-bold text-[18px] mb-1.5 text-dark-brand">
                                {t('wardrobeStats.onboarding.upgradeTitle', {
                                  defaultValue: "Unlock DressApp's Full Power with Manager",
                                })}
                              </h3>
                              <p className="text-text-brand text-[13px] font-semibold leading-relaxed">
                                {t('wardrobeStats.onboarding.upgradeDesc', {
                                  defaultValue:
                                    'Upgrade to the Manager plan for unlimited closet capacity, 1-click Wardrobe Migration, unlimited daily AI Stylist requests, and automated Daily Trend-Scout.',
                                })}
                              </p>
                            </div>

                            <div className="rounded-[10px] bg-accent-beige/70 border border-border p-3 space-y-1.5">
                              <div className="flex items-start gap-2 text-[12px] font-semibold text-dark-brand">
                                <CheckCircle2 className="h-4 w-4 text-primary-brand shrink-0 mt-0.5" />
                                <span>
                                  {t('wardrobeStats.onboarding.upgradeBenefit1', {
                                    defaultValue: 'Unlimited garment slots & 1-click Wardrobe Migration',
                                  })}
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-[12px] font-semibold text-dark-brand">
                                <CheckCircle2 className="h-4 w-4 text-primary-brand shrink-0 mt-0.5" />
                                <span>
                                  {t('wardrobeStats.onboarding.upgradeBenefit2', {
                                    defaultValue: 'Priority Gemini 3.5 Flash AI Stylist & Suitcase Planner',
                                  })}
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-[12px] font-semibold text-dark-brand">
                                <CheckCircle2 className="h-4 w-4 text-primary-brand shrink-0 mt-0.5" />
                                <span>
                                  {t('wardrobeStats.onboarding.upgradeBenefit3', {
                                    defaultValue: 'Daily automated outfit suggestions & Trend-Scout feeds',
                                  })}
                                </span>
                              </div>
                            </div>

                            <div className="pt-1">
                              {isFree ? (
                                <Button
                                  variant="default"
                                  onClick={() => navigate('/pricing#tiers')}
                                  className="w-full"
                                  data-testid="smart-suggestion-upgrade-btn"
                                >
                                  <Crown className="h-4 w-4 me-1.5" />
                                  {t('wardrobeStats.onboarding.upgradeBtn', { defaultValue: 'Upgrade to Manager Plan' })}
                                </Button>
                              ) : (
                                <div className="text-center py-2 px-3 rounded-xl bg-primary-shadow text-primary-brand text-xs font-bold">
                                  {t('wardrobeStats.onboarding.activeManagerBadge', {
                                    tier: userTier.toUpperCase(),
                                    defaultValue: `You're on the ${userTier.toUpperCase()} plan — full power unlocked!`,
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mode 4: Circular Care (Sell / Donate Unworn Items when items.length > 0) */}
                        {activeSuggestionMode === 'circular' && (
                          <div className="flex flex-col flex-1 justify-between gap-4">
                            {unwornItems.length > 0 ? (
                              <>
                                <div>
                                  <Shirt className="h-10 w-10 text-primary-brand mx-auto mb-2 opacity-85" />
                                  <h3 className="font-bold text-[18px] mb-1.5 text-dark-brand">
                                    {t('wardrobeStats.sustainability.smartSuggestionTitle', { defaultValue: 'Smart Suggestion' })}
                                  </h3>
                                  <p className="text-text-brand text-[13px] font-semibold leading-relaxed">
                                    {t('wardrobeStats.sustainability.smartSuggestionDesc', {
                                      count: unwornItems.length,
                                      defaultValue: `You have ${unwornItems.length} items that haven't been worn in 90 days. Consider listing them on the Marketplace or donating them to keep your closet sustainable.`,
                                    })}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="default"
                                    onClick={() => {
                                      setActionType('sell');
                                      setSelectedItemIds(unwornItems.map((i) => i.id));
                                    }}
                                    className="w-full"
                                  >
                                    {t('wardrobeStats.sustainability.listMarketplace', { defaultValue: 'List on Marketplace' })}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setActionType('donate');
                                      setSelectedItemIds(unwornItems.map((i) => i.id));
                                    }}
                                    className="w-full"
                                  >
                                    {t('wardrobeStats.sustainability.markDonate', { defaultValue: 'Mark to Donate' })}
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <CheckCircle2 className="h-10 w-10 text-primary-brand mx-auto mb-2 opacity-85" />
                                  <h3 className="font-bold text-[18px] mb-1.5 text-dark-brand">
                                    {t('wardrobeStats.onboarding.allWornTitle', { defaultValue: '100% Active Wardrobe Utilisation!' })}
                                  </h3>
                                  <p className="text-text-brand text-[13px] font-semibold leading-relaxed">
                                    {t('wardrobeStats.onboarding.allWornDesc', {
                                      defaultValue:
                                        'Every item in your closet has been worn! Keep logging wears with your AI Stylist to lower your average Cost-per-Wear.',
                                    })}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="default" onClick={() => navigate('/stylist')} className="w-full">
                                    {t('wardrobeStats.onboarding.addFirstItemsBtn', { defaultValue: 'Add Items' })}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col h-full w-full text-left">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-[20px] mb-2 text-dark-brand">
                            {actionType === 'sell' ? t('wardrobeStats.sustainability.selectToSell', { defaultValue: 'Select items to sell' }) : t('wardrobeStats.sustainability.selectToDonate', { defaultValue: 'Select items to donate' })}
                          </h3>
                          <Button variant="ghost" size="icon" onClick={() => { setActionType(null); setSelectedItemIds([]); }} className="h-8 w-8 text-text-brand hover:bg-primary-shadow rounded-full">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-2 space-y-2 max-h-[220px]">
                          {unwornItems.map((item) => {
                            const isSelected = selectedItemIds.includes(item.id);
                            return (
                              <div key={item.id} className="flex items-center gap-3 bg-white rounded-[12px] p-3 border border-border">
                                <button
                                  onClick={() => toggleSelection(item.id)}
                                  className="text-brand focus:outline-none shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="h-5 w-5 fill-white text-primary-brand" />
                                  ) : (
                                    <Square className="h-5 w-5 text-text-brand" />
                                  )}
                                </button>

                                <img
                                  src={bestImageUrl(item) || 'https://via.placeholder.com/150'}
                                  alt={item.title}
                                  className="h-10 w-10 bg-accent-beige rounded-full object-contain shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => navigate(`/closet/${item.id}`)}
                                />

                                <div className="min-w-0 flex-1">
                                  <div
                                    className="cursor-pointer hover:underline text-dark-brand"
                                    onClick={() => navigate(`/closet/${item.id}`)}
                                  >
                                    <p className="text-[12px] font-semibold truncate">{item.title || t('common.untitled', { defaultValue: 'Untitled' })}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {unwornItems.length === 0 && (
                            <div className="text-center text-text-brand text-sm py-4">{t('wardrobeStats.sustainability.noUnwornItems', { defaultValue: 'No unworn items found.' })}</div>
                          )}
                        </div>

                        <div className="pt-4 mt-auto flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => { setActionType(null); setSelectedItemIds([]); }}
                            className="flex-1 rounded-xl bg-white border-border"
                            disabled={isConfirming}
                          >
                            {t('common.cancel', { defaultValue: 'Cancel' })}
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
        <OnboardingMigrationModal
          isOpen={isMigrationModalOpen}
          onClose={() => setIsMigrationModalOpen(false)}
        />
      </section>
    </>
  );
}
