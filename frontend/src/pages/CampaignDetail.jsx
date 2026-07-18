import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Mail,
  MessageSquare,
  Share2,
  Bookmark,
  BookmarkCheck,
  Flag,
  Tag,
  Clock,
  Percent,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { campaignApi, api } from '@/lib/api';
import { toast } from 'sonner';

export default function CampaignDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [expert, setExpert] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    campaignApi
      .getCampaign(id)
      .then((data) => {
        if (!cancelled) {
          setCampaign(data);
          setSaved((data.saved_by || []).includes(user?.id));
          // Track view
          campaignApi.trackCampaignView(id).catch(() => {});

          if (data.expert_id) {
            api.getProfessional(data.expert_id)
              .then((prof) => {
                if (!cancelled) setExpert(prof);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => !cancelled && navigate('/experts?tab=campaigns'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, user?.id, navigate]);

  const handleSave = async () => {
    if (!user) { toast.error(t('common.pleaseLogin', { defaultValue: 'Please log in first' })); return; }
    const res = await campaignApi.saveCampaign(id);
    setSaved(res.saved);
    toast.success(res.saved ? t('campaigns.detail.saved') : t('campaigns.detail.unsaved'));
  };

  const handleShare = async () => {
    campaignApi.shareCampaign(id).catch(() => {});
    if (navigator.share) {
      await navigator.share({ title: campaign?.title, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      toast.success(t('campaigns.detail.linkCopied'));
    }
  };

  const handleReport = async () => {
    if (!user) return;
    setReporting(true);
    await campaignApi.reportCampaign(id).catch(() => {});
    setReporting(false);
    toast.success(t('campaigns.detail.reported'));
  };

  if (loading) {
    return (
      <div className="container-px max-w-3xl mx-auto pt-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!campaign) return null;

  const {
    title,
    business_name,
    short_description,
    long_description,
    cover_image_url,
    gallery_images = [],
    discount_pct,
    coupon_code,
    sale_type,
    limited_time_offer,
    start_date,
    end_date,
    location = {},
    category,
    analytics = {},
  } = campaign;

  const allImages = [
    ...(cover_image_url ? [cover_image_url] : []),
    ...gallery_images,
  ];

  // Days left
  let daysLeft = null;
  if (end_date) {
    const diff = Math.ceil((new Date(end_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff >= 0) daysLeft = diff;
  }

  const locationStr = [location.city, location.country].filter(Boolean).join(', ');
  const expertPhone =
    expert?.professional?.business?.phone && expert.professional.business.phone.trim().length > 3
      ? expert.professional.business.phone.trim()
      : expert?.phone
      ? expert.phone.trim()
      : null;
  const lat = location.lat;
  const lon = location.lon;
  // Google Maps: directions link + embed (no API key needed for basic embed)
  const mapsUrl = lat && lon
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : locationStr
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationStr)}`
    : null;
  const googleMapsEmbed = lat && lon
    ? `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`
    : locationStr
    ? `https://maps.google.com/maps?q=${encodeURIComponent(locationStr)}&output=embed`
    : null;

  return (
    <div className="min-h-full">
      <div className="container-px max-w-3xl mx-auto pt-6 pb-24">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          data-testid="campaign-detail-back"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>

        {/* Hero gallery */}
        {allImages.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden bg-secondary mb-6 aspect-video shadow-editorial">
            <img
              src={allImages[galleryIdx]}
              alt={title}
              className="h-full w-full object-cover"
              data-testid="campaign-detail-hero"
            />
            {allImages.length > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === galleryIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                    aria-label={t('campaigns.detail.galleryDot', { index: i + 1 })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <p className="caps-label text-muted-foreground">{business_name}</p>
            <h1 className="font-display text-2xl sm:text-3xl mt-1">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {category && (
                <Badge variant="outline" className="rounded-full text-xs">
                  <Tag className="h-2.5 w-2.5 me-1" />{category}
                </Badge>
              )}

              {expertPhone && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-7 px-3"
                  data-testid="campaign-expert-phone"
                >
                  <a href={`tel:${expertPhone}`}>
                    <Phone className="h-3 w-3 me-1" />
                    {t('experts.callNow', { defaultValue: 'Phone' })}
                  </a>
                </Button>
              )}

              {expert?.professional?.business?.email && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-7 px-3"
                  data-testid="campaign-expert-email"
                >
                  <a href={`mailto:${expert.professional.business.email}`}>
                    <Mail className="h-3 w-3 me-1" />
                    {t('experts.sendEmail', { defaultValue: 'Email' })}
                  </a>
                </Button>
              )}

              {expert?.professional?.business?.website && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-7 px-3"
                  data-testid="campaign-expert-website"
                >
                  <a
                    href={expert.professional.business.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-3 w-3 me-1" />
                    {t('experts.visitWebsite', { defaultValue: 'Website' })}
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleSave}
              data-testid="campaign-detail-save"
              aria-label={saved ? t('campaigns.detail.unsave') : t('campaigns.detail.save')}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleShare}
              data-testid="campaign-detail-share"
              aria-label={t('campaigns.detail.share')}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Promotion highlight */}
        {(discount_pct || coupon_code || limited_time_offer) && (
          <Card className="rounded-2xl shadow-editorial mb-4 border-[hsl(var(--accent))]/30">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              {discount_pct > 0 && (
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-[hsl(var(--accent))]" />
                  <span className="font-display text-xl font-bold text-[hsl(var(--accent))]">
                    {discount_pct}% {t('campaigns.card.off')}
                  </span>
                </div>
              )}
              {coupon_code && (
                <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">{t('campaigns.detail.coupon')}:</span>
                  <span className="font-mono font-bold tracking-widest text-sm">{coupon_code}</span>
                </div>
              )}
              {limited_time_offer && (
                <Badge className="bg-orange-500 text-white border-0">
                  {t('campaigns.card.limitedTime')}
                </Badge>
              )}
              {daysLeft !== null && (
                <div className={`flex items-center gap-1 text-sm ${daysLeft <= 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  <Clock className="h-4 w-4" />
                  {daysLeft === 0
                    ? t('campaigns.card.expirestoday')
                    : t('campaigns.card.expiresInDays', { count: daysLeft })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <div className="space-y-2 mb-6">
          <p className="text-base text-foreground leading-relaxed">{short_description}</p>
          {long_description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {long_description}
            </p>
          )}
        </div>

        {/* Dates */}
        {(start_date || end_date) && (
          <div className="flex gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
            {start_date && (
              <span>{t('campaigns.detail.from')}: <strong className="text-foreground">{start_date}</strong></span>
            )}
            {end_date && (
              <span>{t('campaigns.detail.until')}: <strong className="text-foreground">{end_date}</strong></span>
            )}
          </div>
        )}

        {/* Map + Location */}
        <Card className="rounded-2xl shadow-editorial mb-6 overflow-hidden">
          {googleMapsEmbed && (
            <iframe
              src={googleMapsEmbed}
              title={t('campaigns.detail.mapTitle')}
              className="w-full h-48 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              data-testid="campaign-detail-map"
            />
          )}
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{locationStr || t('campaigns.detail.locationUnknown')}</span>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--accent))] hover:underline"
                data-testid="campaign-detail-directions"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('campaigns.detail.getDirections')}
              </a>
            )}
          </CardContent>
        </Card>

        {/* Analytics strip (views, saves, shares) */}
        <div className="flex gap-6 text-xs text-muted-foreground mb-6">
          <span>{analytics.views || 0} {t('campaigns.detail.views')}</span>
          <span>{analytics.saves || 0} {t('campaigns.detail.saves')}</span>
          <span>{analytics.shares || 0} {t('campaigns.detail.shares')}</span>
        </div>

        {/* Report */}
        <button
          onClick={handleReport}
          disabled={reporting}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          data-testid="campaign-detail-report"
        >
          <Flag className="h-3 w-3" />
          {t('campaigns.detail.report')}
        </button>
      </div>
    </div>
  );
}
