import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Crown,
  Footprints,
  Leaf,
  Users,
  Recycle,
  Newspaper,
  Wrench,
  ExternalLink,
  MapPin,
  RefreshCw,
  Loader2,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation as useAppLocation } from "@/lib/location";
import { useTrendScoutStore, prewarmTrendScout } from "@/lib/trendScoutStore";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ExploreBackButton } from "@/components/ExploreBackButton";
import { TrendScoutSettingsModal } from "@/components/trends/TrendScoutSettingsModal";
import PricingBanner from '../assets/img/inner6.webp';
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';

const BUCKET_VISUALS = {
  local: { Icon: Newspaper, tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  runway: { Icon: Crown, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  street: { Icon: Footprints, tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  sustainability: { Icon: Leaf, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  influencers: { Icon: Users, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  vintage: { Icon: Recycle, tone: 'bg-amber-700/10 text-amber-700 dark:text-amber-300' },
  maintenance_repairs: { Icon: Wrench, tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  // Backward-compat aliases
  'ss26-runway': { Icon: Crown, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  second_hand: { Icon: Recycle, tone: 'bg-amber-700/10 text-amber-700 dark:text-amber-300' },
  recycling: { Icon: Wrench, tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  news_flash: { Icon: Newspaper, tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
};
const DEFAULT_BUCKET_VISUAL = { Icon: Sparkles, tone: 'bg-secondary/60 text-foreground' };

const BUCKET_KEYS = [
  'all',
  'local',
  'runway',
  'street',
  'sustainability',
  'influencers',
  'vintage',
  'maintenance_repairs',
];

function TrendCardMedia({ card, canonicalBucket }) {
  const [imgError, setImgError] = useState(false);
  const [proxyAttempted, setProxyAttempted] = useState(false);
  const visual = BUCKET_VISUALS[canonicalBucket] || DEFAULT_BUCKET_VISUAL;
  const Icon = visual?.Icon || Sparkles;
  const rawImageUrl = typeof card?.image_url === 'string' ? card.image_url.trim() : '';
  const imageUrl = proxyAttempted
    ? `/api/v1/trends/image-proxy?url=${encodeURIComponent(rawImageUrl)}`
    : rawImageUrl;
  const hasValidImage = Boolean(rawImageUrl && !imgError && rawImageUrl.startsWith('http'));

  if (hasValidImage) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#ddd] border-b border-border select-none">
        <img
          src={imageUrl}
          alt={typeof card.headline === 'string' ? card.headline : (typeof card.title === 'string' ? card.title : 'Trend Scout')}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (!proxyAttempted && rawImageUrl) {
              setProxyAttempted(true);
            } else {
              setImgError(true);
            }
          }}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
    );
  }

  const tagLabel = typeof card?.source_name === 'string'
    ? card.source_name
    : (typeof card?.tag === 'string' ? card.tag : 'Trend Scout');

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-[#dddddd69] select-none flex flex-col items-center justify-center p-4">
      <div className={`rounded-full p-4 ${visual?.tone || DEFAULT_BUCKET_VISUAL.tone}  shadow-sm transition-transform duration-300 hover:scale-110`}>
        <Icon className="h-10 w-10 stroke-[1.5]" />
      </div>
      <span className="mt-2 text-[12px] font-bold tracking-wide uppercase text-text-brand truncate max-w-[85%] text-center">
        {tagLabel}
      </span>
    </div>
  );
}

export default function TrendScout() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const loc = useAppLocation();
  const trendStore = useTrendScoutStore();
  const userSex = (user?.sex || user?.gender || 'female').toLowerCase();
  const initialGender = userSex === 'male' ? 'male' : 'female';
  const [selectedGender, setSelectedGender] = useState(initialGender);
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const language = (user?.preferred_language || i18n.language || 'en')
    .split('-')[0]
    .toLowerCase();
  const country =
    (user?.address?.country_code || user?.home_location?.country_code || loc?.countryCode || 'IL')
      .toString()
      .toUpperCase();
  const sub = user?.subscription || {};
  const isActive = sub.is_active || false;
  const planType = sub.plan_type || 'free';
  const tier = sub.tier || 'free';
  const userTier = (isActive && planType !== 'free') ? tier : 'free';
  const isBlocked = userTier === 'free';
  // Resolve trends from global store
  const allCards = trendStore.cards || [];
  useEffect(() => {
    if (isBlocked) return;
    prewarmTrendScout({ language, country, gender: selectedGender });
  }, [language, country, selectedGender, isBlocked]);
  const handleGenderSwitch = async (newGender) => {
    if (newGender === selectedGender) return;
    setSelectedGender(newGender);
    // Prewarm feed immediately for the newly selected gender
    prewarmTrendScout({ language, country, gender: newGender });

    // Check if the selected gender already has cards
    const existingCount = (trendStore.cards || []).filter((c) => c.gender === newGender).length;
    if (existingCount < 4) {
      // Fire on-demand crawling strictly for the 7 buckets of this selected gender
      try {
        await api.trendsRunNowDev(false, newGender, country);
        await prewarmTrendScout({ language, country, gender: newGender, force: true });
      } catch (err) {
        console.warn('[TrendScout] On-demand gender crawl error:', err);
      }
    }
  };
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await api.trendsRunNowDev(true, selectedGender, country);
      await prewarmTrendScout({ language, country, gender: selectedGender, force: true });
      toast.success(t('stylist.scoutRefreshed', { defaultValue: 'Trend feed refreshed with real-time live data!' }));
    } catch {
      await prewarmTrendScout({ language, country, gender: selectedGender, force: true });
    } finally {
      setRefreshing(false);
    }
  };
  const filteredCards = useMemo(() => {
    let list = allCards;
    if (selectedGender) {
      list = list.filter((c) => !c.gender || c.gender === selectedGender);
    }
    if (activeCategory !== 'all') {
      const targetSlug = activeCategory;
      list = list.filter((c) => {
        const b = c.bucket;
        if (b === targetSlug) return true;
        if (targetSlug === 'runway' && b === 'ss26-runway') return true;
        if (targetSlug === 'vintage' && b === 'second_hand') return true;
        if (targetSlug === 'maintenance_repairs' && b === 'recycling') return true;
        if (targetSlug === 'local' && b === 'news_flash') return true;
        return false;
      });
    }
    return list;
  }, [allCards, selectedGender, activeCategory]);
  if (isBlocked) {
    return (
      <div className="container-px max-w-2xl mx-auto pt-16 pb-24 text-center">
        <div className="p-8 rounded-3xl border border-border bg-card shadow-lg space-y-6 flex flex-col items-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500">
            <Crown className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {t('trends.lockedTitle', { defaultValue: 'Trend Scout is Premium' })}
          </h2>
          <p className="text-sm text-text-brand max-w-sm">
            {t('trends.lockedDesc', { defaultValue: 'Trend Scout is only available on Manager or Professional plans. Upgrade your plan to get daily curated style feeds, sustainability news, and runway highlights.' })}
          </p>
          <div className="flex gap-4 w-full justify-center">
            <ExploreBackButton />
            <Link to="/pricing">
              <Button className="rounded-xl px-6 bg-primary text-primary-foreground hover:translate-y-[-1px] transition-all">
                {t('pricing.upgradeLinkBtn', { defaultValue: 'Upgrade Plan' })}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      {/* Banner Section */}
      <PageHeroBanner image={PricingBanner}>
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
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[12px] text-white uppercase font-semibold tracking-wider">
                  {t('home.trendScout', { defaultValue: 'Trend Scout' })}
                </span>
                <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 rounded-full border-yellow-border text-yellow-brand">
                  <MapPin className="h-2.5 w-2.5" />
                  {country === 'IL' ? t('trends.israelAnchor', { defaultValue: 'Anchored to Israel 🇮🇱' }) : country}
                </Badge>
              </div>
              {/* Title */}
              <h1
                className="
                      m-0 mb-0
                      text-[40px] leading-[40px]
                      font-bold
                      tracking-normal
                      text-white
                      max-[767px]:text-[42px]
                      max-[480px]:text-[35px]
                    "
              >
                {t('trends.title', { defaultValue: 'Fashion Trends & Insights' })}
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
                {t('trends.subtitle', { defaultValue: 'Browse curated style aesthetics, sustainability news, and runway reviews tailored to your ecosystem.' })}
              </p>
            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className="px-[40px] py-[40px] bg-accent-beige" data-testid="trend-scout-page">
        <ExploreBackButton />
        {/* Gender Toggle & Refresh button */}
        <div className="flex items-center gap-3 justify-between mb-5">
          <div className="inline-flex rounded-full bg-white p-1 border border-border">
            <button
              type="button"
              onClick={() => handleGenderSwitch('female')}
              className={`flex items-center gap-1.5 px-6 py-3 rounded-full text-[12px] font-semibold transition-all ${selectedGender === 'female'
                  ? 'bg-primary-brand text-white shadow-sm'
                  : 'bg-transparent text-text-brand hover:text-primary-brand'
                }`}
            >
              {t('trends.womensFashion', { defaultValue: "Women's Fashion" })}
            </button>
            <button
              type="button"
              onClick={() => handleGenderSwitch('male')}
              className={`flex items-center gap-1.5 px-6 py-3 rounded-full text-[12px] font-semibold transition-all ${selectedGender === 'male'
                  ? 'bg-primary-brand text-white shadow-sm'
                  : 'bg-transparent text-text-brand hover:text-primary-brand'
                }`}
            >
              {t('trends.mensFashion', { defaultValue: "Men's Fashion" })}
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="!gap-1"
              data-testid="trend-scout-refresh-btn"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="!h-3 !w-3" />
              )}
              <span className="text-xs hidden sm:inline">{t('stylist.refreshScout', { defaultValue: 'Refresh' })}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl h-9 w-9 p-0 bg-white border border-border text-text-brand hover:text-primary-brand"
              data-testid="trend-scout-settings-btn"
              title={t('trends.personalizationSettings', { defaultValue: 'Personalization & Social Feeds' })}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-8 no-scrollbar">
          {BUCKET_KEYS.map((catKey) => {
            const isActiveTab = activeCategory === catKey;
            const visual = BUCKET_VISUALS[catKey] || DEFAULT_BUCKET_VISUAL;
            const TabIcon = visual.Icon;
            return (
              <button
                key={catKey}
                onClick={() => setActiveCategory(catKey)}
                className={`inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all border ${isActiveTab
                  ? 'bg-primary-brand text-white border-primary-brand shadow-sm'
                  : 'bg-white text-text-brand border-border hover:text-primary-brand'
                  }`}
              >
                {catKey !== 'all' && <TabIcon className="h-3.5 w-3.5" />}
                {t(`trends.bucket.${catKey}`, {
                  defaultValue: catKey === 'all'
                    ? 'All'
                    : catKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                })}
              </button>
            );
          })}
        </div>
        {/* Feed Grid */}
        {trendStore.loading && !filteredCards.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <Card className="rounded-[12px] border border-border bg-white shadow-sm py-16 text-center">
            <CardContent className="space-y-3">
              <Sparkles className="h-12 w-12 text-primary-brand mx-auto" />
              <h2 className="text-[20px] text-dark-brand font-bold">
                {t('trends.noTrendsTitle', { defaultValue: 'No Trends Found' })}
              </h2>
              <p className="text-[14px] text-text-brand font-semibold max-w-sm mx-auto">
                {t('trends.noTrendsDesc', { defaultValue: 'We couldn\'t find any active trend cards for this filter. Check back later or trigger a live refresh.' })}
              </p>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-xl">
                {t('stylist.refreshScout', { defaultValue: 'Refresh Feed' })}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCards.map((card, i) => {
              const rawBucket = typeof card?.bucket === 'string' ? card.bucket : '';
              const canonicalBucket = rawBucket === 'ss26-runway' ? 'runway'
                : rawBucket === 'second_hand' ? 'vintage'
                  : rawBucket === 'recycling' ? 'maintenance_repairs'
                    : rawBucket === 'news_flash' ? 'local'
                      : rawBucket;

              const localisedBucket = rawBucket
                ? t(`trends.bucket.${rawBucket}`, { defaultValue: t(`trends.bucket.${canonicalBucket}`, { defaultValue: '' }) })
                : '';
              const rawChip = localisedBucket || card?.label || card?.tag || '';
              const chip = typeof rawChip === 'string' ? rawChip : String(rawChip || '');
              const rawHeadline = card?.headline || card?.title || '';
              const headline = typeof rawHeadline === 'string' ? rawHeadline : String(rawHeadline || '');
              const rawBody = card?.summary || card?.body || card?.blurb || '';
              const body = typeof rawBody === 'string' ? rawBody : String(rawBody || '');
              const sourceUrl = typeof card?.source_url === 'string' && card.source_url.startsWith('http') ? card.source_url : null;
              const sourceName = typeof card?.source_name === 'string' ? card.source_name : null;
              const visual = BUCKET_VISUALS[canonicalBucket] || DEFAULT_BUCKET_VISUAL;
              const BucketIcon = visual?.Icon || Sparkles;
              const key = card?.id || `${chip || 'trend'}-${headline || i}`;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  data-testid="trend-scout-card"
                >
                  <Card className="rounded-[12px] bg-white shadow-sm h-full overflow-hidden flex flex-col border border-border hover:shadow-md transition-shadow group">
                    {/* Card Representative Image */}
                    <TrendCardMedia card={card} canonicalBucket={canonicalBucket} />
                    <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full ${visual?.tone || DEFAULT_BUCKET_VISUAL.tone}`}>
                          <BucketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        {chip ? (
                          <div className="caps-label text-text-brand truncate text-[11px] font-bold tracking-wider">
                            {chip}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {card?.date ? (
                          <span className="text-[10px] text-text-brand font-medium">{String(card.date)}</span>
                        ) : null}
                        {card?.gender && (
                          <Badge className="text-[9px] uppercase font-semibold bg-primary-brand text-white">
                            {card.gender === 'male' ? t('trends.men', { defaultValue: 'Men' }) : t('trends.women', { defaultValue: 'Women' })}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-3 flex-1 flex flex-col">
                      {headline ? (
                        <h3 className="text-[14px] font-bold text-dark-brand">
                          {headline}
                        </h3>
                      ) : null}
                      {body ? (
                        <p className="text-[12px] mt-2 font-semibold text-text-brand leading-relaxed line-clamp-4">
                          {body}
                        </p>
                      ) : null}
                      {sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[12px] text-primary-brand hover:underline focus-visible:underline focus-visible:outline-none"
                          data-testid="trend-scout-card-source"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {sourceName
                              ? t('home.trendReadAt', { source: sourceName, defaultValue: `Read at ${sourceName}` })
                              : t('home.trendReadSource', { defaultValue: 'Read source' })}
                          </span>
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
        {/* Settings Modal */}
        <TrendScoutSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onRefreshTriggered={async () => {
            await trendStore.prewarm({ language, country, gender: selectedGender, force: true });
          }}
          selectedGender={selectedGender}
          country={country}
        />
      </section>
    </>
  );
}