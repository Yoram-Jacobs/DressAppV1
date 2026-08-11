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
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useLocation as useAppLocation } from '@/lib/location';
import { useTrendScoutStore } from '@/lib/trendScoutStore';
import { api } from '@/lib/api';
import { ExploreBackButton } from '@/components/ExploreBackButton';

const BUCKET_VISUALS = {
  'ss26-runway':  { Icon: Crown,      tone: 'bg-secondary/60' },
  street:         { Icon: Footprints, tone: 'bg-secondary/60' },
  sustainability: { Icon: Leaf,       tone: 'bg-secondary/60' },
  influencers:    { Icon: Users,      tone: 'bg-secondary/60' },
  second_hand:    { Icon: Recycle,    tone: 'bg-secondary/60' },
  recycling:      { Icon: Recycle,    tone: 'bg-secondary/60' },
  news_flash:     { Icon: Newspaper,  tone: 'bg-secondary/60' },
};
const DEFAULT_BUCKET_VISUAL = { Icon: Sparkles, tone: 'bg-secondary/60' };

export default function TrendScout() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const loc = useAppLocation();
  const trendStore = useTrendScoutStore();

  const language = (user?.preferred_language || i18n.language || 'en')
    .split('-')[0]
    .toLowerCase();
  const country =
    (loc?.country_code || user?.home_location?.country_code || '')
      .toString()
      .toUpperCase() || null;

  const sub = user?.subscription || {};
  const isActive = sub.is_active || false;
  const planType = sub.plan_type || 'free';
  const tier = sub.tier || 'free';
  
  const userTier = (isActive && planType !== 'free') ? tier : 'free';
  const isBlocked = userTier === 'free';

  // Resolve trends from global store
  const trends = trendStore.loading && !trendStore.cards.length
    ? null
    : (trendStore.cards || []);

  useEffect(() => {
    if (isBlocked) return;
    trendStore.prewarm({ language, country });
  }, [language, country, isBlocked, trendStore]);

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
      <div className="flex flex-col mb-8">
        <span className="caps-label text-brand font-bold tracking-wider text-xs">
          {t('home.trendScout', { defaultValue: 'Trend Scout' })}
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1 text-foreground">
          {t('trends.title', { defaultValue: 'Fashion Trends & Insights' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          {t('trends.subtitle', { defaultValue: 'Browse curated style aesthetics, sustainability news, and runway reviews tailored to your profile.' })}
        </p>
      </div>

      {/* Feed Grid */}
      {trends === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border py-16 text-center">
          <CardContent className="space-y-4">
            <Sparkles className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="font-display text-xl font-semibold">
              {t('trends.noTrendsTitle', { defaultValue: 'No Trends Found' })}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('trends.noTrendsDesc', { defaultValue: 'We couldn\'t find any active trend cards. Check back later for curated insights.' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trends.map((card, i) => {
            const _prettyBucket = (b) =>
              (b || '')
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());
            const localisedBucket = card.bucket
              ? t(`trends.bucket.${card.bucket}`, { defaultValue: '' })
              : '';
            const chip =
              localisedBucket ||
              card.label ||
              _prettyBucket(card.bucket) ||
              card.tag;
            const headline = card.headline || card.title;
            const body = card.summary || card.body || card.blurb;
            const sourceUrl = card.source_url;
            const sourceName = card.source_name;
            const visual = BUCKET_VISUALS[card.bucket] || DEFAULT_BUCKET_VISUAL;
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
                <Card className="rounded-2xl shadow-editorial h-full overflow-hidden flex flex-col border border-border/60 hover:shadow-md transition-shadow">
                  <div className={`flex items-center gap-2 px-5 py-3 border-b border-border/55 ${visual.tone}`}>
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-card border border-border text-[hsl(var(--accent))]">
                      <BucketIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {chip ? (
                      <div className="caps-label text-foreground/80 truncate text-[10px] font-semibold tracking-wider">
                        {chip}
                      </div>
                    ) : null}
                  </div>
                  <CardContent className="p-5 flex-1 flex flex-col">
                    {headline ? (
                      <h3 className="font-display text-lg leading-tight font-semibold text-foreground">
                        {headline}
                      </h3>
                    ) : null}
                    {body ? (
                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
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
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
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
    </div>
  );
}
