import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useLocation as useAppLocation } from '@/lib/location';
import { useTrendScoutStore } from '@/lib/trendScoutStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { TrendScoutSettingsModal } from '@/components/trends/TrendScoutSettingsModal';


const BUCKET_VISUALS = {
  local:                { Icon: Newspaper,  tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  runway:               { Icon: Crown,      tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  street:               { Icon: Footprints, tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  sustainability:       { Icon: Leaf,       tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  influencers:          { Icon: Users,      tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  vintage:              { Icon: Recycle,    tone: 'bg-amber-700/10 text-amber-700 dark:text-amber-300' },
  maintenance_repairs:  { Icon: Wrench,     tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  // Backward-compat aliases
  'ss26-runway':        { Icon: Crown,      tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  second_hand:          { Icon: Recycle,    tone: 'bg-amber-700/10 text-amber-700 dark:text-amber-300' },
  recycling:            { Icon: Wrench,     tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  news_flash:           { Icon: Newspaper,  tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
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
  const visual = BUCKET_VISUALS[canonicalBucket] || DEFAULT_BUCKET_VISUAL;
  const Icon = visual.Icon;
  const hasValidImage = Boolean(card.image_url && !imgError);

  if (hasValidImage) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/30 border-b border-border/40 select-none">
        <img
          src={card.image_url}
          alt={card.headline || card.title || 'Trend Scout'}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-secondary/60 via-secondary/30 to-muted/50 border-b border-border/40 select-none flex flex-col items-center justify-center p-4">
      <div className={`rounded-2xl p-4 ${visual.tone} backdrop-blur-sm shadow-sm transition-transform duration-300 hover:scale-110`}>
        <Icon className="h-10 w-10 stroke-[1.5]" />
      </div>
      <span className="mt-2 text-xs font-medium tracking-wide uppercase text-muted-foreground/80">
        {card.source_name || card.tag || 'Trend Scout'}
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
    trendStore.prewarm({ language, country, gender: selectedGender });
  }, [language, country, selectedGender, isBlocked, trendStore]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await api.trendsRunNowDev(true, selectedGender, country);
      await trendStore.prewarm({ language, country, gender: selectedGender, force: true });
      toast.success(t('stylist.scoutRefreshed', { defaultValue: 'Trend feed refreshed with real-time live data!' }));
    } catch {
      await trendStore.prewarm({ language, country, gender: selectedGender, force: true });
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
          <p className="text-sm text-muted-foreground max-w-sm">
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
    <div className="container-px max-w-6xl mx-auto pt-6 md:pt-10 pb-24" data-testid="trend-scout-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="caps-label text-brand font-bold tracking-wider text-xs">
              {t('home.trendScout', { defaultValue: 'Trend Scout' })}
            </span>
            <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 rounded-full border-brand/30 bg-brand/5 text-brand">
              <MapPin className="h-2.5 w-2.5" />
              {country === 'IL' ? t('trends.israelAnchor', { defaultValue: 'Anchored to Israel 🇮🇱' }) : country}
            </Badge>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-1 text-foreground">
            {t('trends.title', { defaultValue: 'Fashion Trends & Insights' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {t('trends.subtitle', { defaultValue: 'Browse curated style aesthetics, sustainability news, and runway reviews tailored to your ecosystem.' })}
          </p>
        </div>

        {/* Gender Toggle & Refresh button */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-secondary/80 p-1 border border-border">
            <button
              type="button"
              onClick={() => setSelectedGender('female')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedGender === 'female'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('trends.womensFashion', { defaultValue: "Women's Fashion" })}
            </button>
            <button
              type="button"
              onClick={() => setSelectedGender('male')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedGender === 'male'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('trends.mensFashion', { defaultValue: "Men's Fashion" })}
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-xl h-9 px-3 gap-1.5"
            data-testid="trend-scout-refresh-btn"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="text-xs hidden sm:inline">{t('stylist.refreshScout', { defaultValue: 'Refresh' })}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="rounded-xl h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            data-testid="trend-scout-settings-btn"
            title={t('trends.personalizationSettings', { defaultValue: 'Personalization & Social Feeds' })}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {BUCKET_KEYS.map((catKey) => {
          const isActiveTab = activeCategory === catKey;
          const visual = BUCKET_VISUALS[catKey] || DEFAULT_BUCKET_VISUAL;
          const TabIcon = visual.Icon;
          return (
            <button
              key={catKey}
              onClick={() => setActiveCategory(catKey)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                isActiveTab
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                  : 'bg-card text-muted-foreground border-border hover:bg-secondary/60 hover:text-foreground'
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
        <Card className="rounded-2xl border border-dashed border-border py-16 text-center">
          <CardContent className="space-y-4">
            <Sparkles className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="font-display text-xl font-semibold">
              {t('trends.noTrendsTitle', { defaultValue: 'No Trends Found' })}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('trends.noTrendsDesc', { defaultValue: 'We couldn\'t find any active trend cards for this filter. Check back later or trigger a live refresh.' })}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-xl">
              {t('stylist.refreshScout', { defaultValue: 'Refresh Feed' })}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card, i) => {
            const canonicalBucket = card.bucket === 'ss26-runway' ? 'runway'
              : card.bucket === 'second_hand' ? 'vintage'
              : card.bucket === 'recycling' ? 'maintenance_repairs'
              : card.bucket === 'news_flash' ? 'local'
              : card.bucket;

            const localisedBucket = card.bucket
              ? t(`trends.bucket.${card.bucket}`, { defaultValue: t(`trends.bucket.${canonicalBucket}`, { defaultValue: '' }) })
              : '';
            const chip = localisedBucket || card.label || card.tag;
            const headline = card.headline || card.title;
            const body = card.summary || card.body || card.blurb;
            const sourceUrl = card.source_url;
            const sourceName = card.source_name;
            const visual = BUCKET_VISUALS[canonicalBucket] || DEFAULT_BUCKET_VISUAL;
            const BucketIcon = visual.Icon;
            const key = card.id || `${chip || 'trend'}-${headline || i}`;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                data-testid="trend-scout-card"
              >
                <Card className="rounded-2xl shadow-editorial h-full overflow-hidden flex flex-col border border-border/60 hover:shadow-md transition-shadow group">
                  {/* Card Representative Image */}
                  <TrendCardMedia card={card} canonicalBucket={canonicalBucket} />

                  <div className="flex items-center justify-between px-5 py-3 border-b border-border/55 bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full ${visual.tone}`}>
                        <BucketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {chip ? (
                        <div className="caps-label text-foreground/80 truncate text-[11px] font-bold tracking-wider">
                          {chip}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {card.date ? (
                        <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-background/60">
                          {card.date}
                        </span>
                      ) : null}
                      {card.gender && (
                        <Badge variant="secondary" className="text-[9px] uppercase font-semibold">
                          {card.gender === 'male' ? t('trends.men', { defaultValue: 'Men' }) : t('trends.women', { defaultValue: 'Women' })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-5 flex-1 flex flex-col">
                    {headline ? (
                      <h3 className="font-display text-base md:text-lg leading-snug font-semibold text-foreground">
                        {headline}
                      </h3>
                    ) : null}
                    {body ? (
                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-4">
                        {body}
                      </p>
                    ) : null}
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--accent))] hover:underline focus-visible:underline focus-visible:outline-none"
                        data-testid="trend-scout-card-source"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
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

      {/* Floating Back Button */}
      <ExploreBackButton />

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
    </div>
  );
}

