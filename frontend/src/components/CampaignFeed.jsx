import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CampaignCard, CampaignCardSkeleton } from '@/components/CampaignCard';
import { campaignApi } from '@/lib/api';
import { useLocation } from '@/lib/location';

/**
 * CampaignFeed — infinite-scroll grid of active campaigns.
 * Geo-aware: reads viewer's country + city from LocationProvider.
 * Sort: newest | nearest | ending_soon | highest_discount
 */
export function CampaignFeed() {
  const { t } = useTranslation();
  const loc = useLocation?.();
  const [sort, setSort] = useState('newest');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const sentinelRef = useRef(null);
  const LIMIT = 12;
  const country = loc?.country_code || loc?.country || undefined;
  const city = loc?.city || undefined;

  const fetchPage = useCallback(
    async (pageSkip, reset = false) => {
      setLoading(true);
      try {
        const res = await campaignApi.getCampaignFeed({
          sort,
          skip: pageSkip,
          limit: LIMIT,
          ...(country ? { country } : {}),
          ...(city ? { city } : {}),
        });
        const newItems = res?.items || [];
        setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
        setTotal(res?.total || 0);
        setSkip(pageSkip + newItems.length);
      } catch (err) {
        console.error('Campaign feed error:', err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [sort, country, city]
  );

  // Reset on sort/location change
  useEffect(() => {
    setItems([]);
    setSkip(0);
    setInitialLoad(true);
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, country, city]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && items.length < total) {
          fetchPage(skip);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [sentinelRef, loading, items.length, total, skip, fetchPage]);

  const SORT_OPTIONS = [
    { value: 'newest', label: t('campaigns.feed.sort.newest') },
    { value: 'ending_soon', label: t('campaigns.feed.sort.endingSoon') },
    { value: 'highest_discount', label: t('campaigns.feed.sort.highestDiscount') },
  ];

  return (
    <div className="space-y-4" data-testid="campaign-feed">
      {/* Sort control */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {total > 0 && t('campaigns.feed.countLabel', { count: total })}
        </p>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger
              className="w-44 rounded-xl"
              data-testid="campaign-feed-sort"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {initialLoad ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="campaign-feed-empty"
        >
          <p className="text-lg font-display">{t('campaigns.feed.empty.title')}</p>
          <p className="text-sm mt-1">{t('campaigns.feed.empty.body')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />

      {/* Loading spinner for subsequent pages */}
      {loading && !initialLoad && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {t('common.loading')}…
        </div>
      )}
    </div>
  );
}
