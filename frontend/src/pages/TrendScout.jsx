import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useLocation as useAppLocation } from '@/lib/location';
import { useTrendScoutStore } from '@/lib/trendScoutStore';
import { api } from '@/lib/api';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { Crown } from 'lucide-react';
const PAGE_SIZE = 12; // 3x3 grid per page — chahe to 6/12 kar sakte hain
const FALLBACK_IMAGE =
  'https://i.pinimg.com/736x/17/50/e9/1750e9027cf70bc488293df0f91daa1d.jpg';

export default function TrendScout() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const loc = useAppLocation();
  const trendStore = useTrendScoutStore();

  const language = (user?.preferred_language || i18n.language || 'en')
    .split('-')[0]
    .toLowerCase();
  const country =
    (user?.address?.country_code || user?.home_location?.country_code || '')
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


  // naya data aane par page 1 par reset
  useEffect(() => {
    setPage(1);
  }, [trends]);


  const totalPages = trends ? Math.max(1, Math.ceil(trends.length / PAGE_SIZE)) : 1;

  const paginatedTrends = useMemo(() => {
    if (!trends) return [];
    const start = (page - 1) * PAGE_SIZE;
    return trends.slice(start, start + PAGE_SIZE);
  }, [trends, page]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    document
      .querySelector('.trend-scout-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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
    <>
      {/* banner-start — aapka existing banner code yahi rahega, unchanged */}
      <section className="closet-banner">
        <div className="container-fluid">
          <div className="closet-banner__content">
            <div className="closet-banner__title-row">
              <h1 className="hero-title">
                {t('trends.title', { defaultValue: 'Fashion Trends & Insights' })}
              </h1>
              <p className="hero-description">
                {t('trends.subtitle', {
                  defaultValue:
                    'Browse curated style aesthetics, sustainability news, and runway reviews tailored to your profile.',
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="trend-scout-section" data-testid="trend-scout-page">
        <div className="container-fluid">
          {trends === null ? (
            <div className="trend-card-grid">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="trend-card-skeleton rounded-4" />
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
                  {t('trends.noTrendsDesc', {
                    defaultValue:
                      "We couldn't find any active trend cards. Check back later for curated insights.",
                  })}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="trend-card-grid">
                {paginatedTrends.map((card, i) => {
                  const _prettyBucket = (b) =>
                    (b || '')
                      .replace(/[-_]+/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                  const localisedBucket = card.bucket
                    ? t(`trends.bucket.${card.bucket}`, { defaultValue: '' })
                    : '';
                  const chip =
                    localisedBucket || card.label || _prettyBucket(card.bucket) || card.tag;
                  const headline = card.headline || card.title;
                  const body = card.summary || card.body || card.blurb;
                  const sourceUrl = card.source_url;
                  const image = card.image_url || FALLBACK_IMAGE;
                  const key = card.id || `${chip || 'trend'}-${headline || i}`;

                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      data-testid="trend-scout-card"
                    >
                      <div
                        className="trend-card"
                        style={{ backgroundImage: `url(${image})` }}
                      >
                        <div className="trend-card-content">
                          {chip ? <span className="trend-tag">{chip}</span> : null}
                          {headline ? <h3>{headline}</h3> : null}
                          {body ? <p>{body}</p> : null}
                          {sourceUrl ? (
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="trend-btn"
                              data-testid="trend-scout-card-source"
                            >
                              {t('home.trendReadSource', {
                                defaultValue: 'Read source',
                              })}
                              <i className="bi bi-arrow-right ms-2"></i>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {totalPages > 1 ? (
                <div className="trend-pagination">
                  <button
                    type="button"
                    className="trend-page-btn trend-page-nav"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1;
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`trend-page-btn ${page === p ? 'active' : ''}`}
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="trend-page-btn trend-page-nav"
                    onClick={() => goToPage(page + 1)}
                    disabled={page === totalPages}
                    aria-label="Next page"
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
}