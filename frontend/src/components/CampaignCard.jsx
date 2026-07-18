import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Tag, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * CampaignCard — reusable campaign card for the feed grid and ticker.
 *
 * Props:
 *   campaign  — campaign object from the API
 *   className — optional extra classes
 */
export function CampaignCard({ campaign, className }) {
  const { t } = useTranslation();

  if (!campaign) return null;

  const {
    id,
    title,
    business_name,
    cover_image_url,
    short_description,
    discount_pct,
    coupon_code,
    end_date,
    location = {},
    limited_time_offer,
  } = campaign;

  // Days remaining
  let daysLeft = null;
  if (end_date) {
    const diff = Math.ceil(
      (new Date(end_date) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0) daysLeft = diff;
  }

  const locationStr = [location.city, location.country].filter(Boolean).join(', ');

  return (
    <Link to={`/campaigns/${id}`} data-testid={`campaign-card-${id}`}>
      <Card
        className={cn(
          'rounded-[calc(var(--radius)+6px)] shadow-editorial h-full flex flex-col group',
          'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
          className
        )}
      >
        {/* Cover image */}
        <div className="relative w-full aspect-video overflow-hidden rounded-t-[calc(var(--radius)+6px)] bg-secondary">
          {cover_image_url ? (
            <img
              src={cover_image_url}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <Tag className="h-10 w-10 opacity-30" />
            </div>
          )}

          {/* Discount badge */}
          {discount_pct != null && discount_pct > 0 && (
            <div className="absolute top-2 end-2">
              <Badge className="bg-[hsl(var(--accent))] text-white border-0 text-xs font-bold px-2 py-0.5 rounded-full shadow">
                <Percent className="h-2.5 w-2.5 me-0.5" />
                {discount_pct}{t('campaigns.card.off')}
              </Badge>
            </div>
          )}

          {/* Limited time badge */}
          {limited_time_offer && !discount_pct && (
            <div className="absolute top-2 end-2">
              <Badge className="bg-orange-500 text-white border-0 text-xs font-bold px-2 py-0.5 rounded-full shadow">
                {t('campaigns.card.limitedTime')}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-1 flex flex-col gap-2">
          {/* Business */}
          <p className="caps-label text-muted-foreground text-[10px]">{business_name}</p>

          {/* Title */}
          <h3 className="font-display text-base leading-tight line-clamp-2">{title}</h3>

          {/* Short description */}
          {short_description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{short_description}</p>
          )}

          <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
            {/* Location */}
            {locationStr && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {locationStr}
              </span>
            )}

            {/* Expiry */}
            {daysLeft !== null && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium',
                daysLeft <= 3 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                <Clock className="h-3 w-3" />
                {daysLeft === 0
                  ? t('campaigns.card.expirestoday')
                  : t('campaigns.card.expiresInDays', { count: daysLeft })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function CampaignCardSkeleton() {
  return (
    <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial overflow-hidden">
      <Skeleton className="w-full aspect-video" />
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}
