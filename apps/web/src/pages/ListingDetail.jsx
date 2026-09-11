import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SourceTagBadge } from '@/components/SourceTagBadge';
import { SwapPickerModal } from '@/components/SwapPickerModal';
import StyleSandbox from '@/components/market/StyleSandbox';
import {
  ArrowLeft,
  Eye,
  Loader2,
  Sparkles,
  MapPin,
  Store,
  Repeat,
  HeartHandshake,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { bestImageUrl } from '@/lib/itemImage';
import { useAuth } from '@/lib/auth';
import { PayPalCheckoutButton } from '@/lib/paypal';
import PricingBanner from '../assets/img/inner6.webp';
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';

const fmt = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((cents || 0) / 100);

export default function ListingDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState([]);
  const [similarMode, setSimilarMode] = useState(null);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [swapOpen, setSwapOpen] = useState(false);
  const [donateSubmitting, setDonateSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const handleRemoveListing = async () => {
    setRemoving(true);
    try {
      await api.deleteListing(listing.id);
      toast.success(t('market.listingRemoved', { defaultValue: 'Removed from marketplace' }));
      nav('/market');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('market.removeFailed', { defaultValue: 'Could not remove listing' }));
    } finally {
      setRemoving(false);
      setRemoveDialogOpen(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setSimilarLoading(true);
    api.getListing(id)
      .then((data) => {
        setListing(data);
        return api.getSimilarListings(id, { limit: 6 })
          .then((res) => {
            setSimilar(res.items || []);
            setSimilarMode(res.mode || null);
          })
          .catch(() => { /* non-fatal */ })
          .finally(() => setSimilarLoading(false));
      })
      .catch(() => {
        toast.error(t('market.listingNotFound'));
        setSimilarLoading(false);
        nav('/market');
      })
      .finally(() => setLoading(false));
  }, [id, nav, t]);

  const createOrder = async () => {
    const res = await api.listingBuyCreate(id);
    return { order_id: res.order_id, transaction_id: res.transaction_id };
  };

  const captureOrder = async ({ order_id }) => {
    const res = await api.listingBuyCapture(id, order_id);
    return res;
  };

  const onBuySuccess = (res) => {
    toast.success(t('market.purchased'));
    if (res?.transaction?.id) {
      nav(`/transactions#tx-${res.transaction.id}`);
    } else {
      nav('/transactions');
    }
  };

  const onBuyError = (err) => {
    toast.error(err?.response?.data?.detail || t('market.purchaseFailed'));
  };

  if (loading) {
    return (
      <div className="container-px max-w-4xl mx-auto pt-6">
        <Skeleton className="aspect-[3/4] w-full rounded-[calc(var(--radius)+6px)]" />
      </div>
    );
  }
  if (!listing) return null;

  const fm = listing.financial_metadata || {};
  const isOwner = listing.seller_id === user?.id;

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
                {t('listing.title', { defaultValue: 'Listing Details' })}
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
                {t('listing.subtitle', { defaultValue: 'Every purchase here keeps clothing in circulation longer. Buy, swap, or claim — your way of shopping sustainably.' })}
              </p>
            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className="px-[40px] py-[40px] bg-accent-beige">
        <button onClick={() => nav(-1)} className="inline-flex items-center text-[14px] font-bold text-dark-brand mb-5 hover:text-primary-brand">
          <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('common.back')}
        </button>
        <Card className="rounded-[12px] bg-white border border-border shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-6">
              <AspectRatio ratio={4 / 3} className='bg-[#ddd] rounded-[12px]'>
                {bestImageUrl(listing)
                  ? <img src={bestImageUrl(listing)} alt={listing.title} className="w-full h-full object-contain" />
                  : <div className="w-full h-full flex items-center justify-center text-text-brand">{t('market.noImage')}</div>}
              </AspectRatio>
            </div>
            <div className="md:col-span-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-[20px] font-bold text-dark-brand" data-testid="listing-detail-title">{listing.title}</h1>
                  <div className="text-xs text-primary-brand mt-1 font-bold">
                    <Eye className="inline h-3.5 w-3.5 me-1" />{t('market.viewsCount', { count: listing.views || 0 })}
                  </div>
                </div>
                <SourceTagBadge source={listing.source} mode={listing.mode} />
              </div>
              <div className="text-[25px] font-extrabold text-dark-brand my-3" data-testid="listing-detail-price">
                {fmt(fm.list_price_cents, fm.currency)}
                {listing.mode === 'rent' && ` / ${t('common.day', { defaultValue: 'day' })}`}
              </div>
              {/* Wave 3 — shipping fee line. Hidden when 0 (listing is
                  pickup-only). Copy intentionally leans on the
                  environmental ethos when a fee IS present so buyers
                  understand the default and know local pickup is the
                  preferred path. */}
              {Number(listing.shipping_fee_cents) > 0 ? (
                <div
                  className="mt-2 flex items-center gap-2 text-sm text-text-brand"
                  data-testid="listing-detail-shipping"
                >
                  <span>
                    + {fmt(listing.shipping_fee_cents, fm.currency)} {t('market.shipping', { defaultValue: 'shipping' })}
                  </span>
                  <span className="text-priamry-brand font-semibold text-xs">
                    {t('pages.listingDetail.or_meet_locally_to_skip')}
                  </span>
                </div>
              ) : (
                <div
                  className="mt-2 text-xs font-semibold text-primary-brand"
                  data-testid="listing-detail-shipping-free"
                >
                  {t('pages.listingDetail.local_pickup_preferred_no_shipping')}
                </div>
              )}
              {/* Meta badges — always visible so swap/donate listings
                  (which don't surface a price) still convey size and
                  condition at a glance. */}
              <div
                className="flex flex-wrap gap-2 mt-3"
                data-testid="listing-detail-meta"
              >
                {listing.size && (
                  <Badge variant="outline" data-testid="listing-detail-size">
                    {t('addItem.size')}: {listing.size}
                  </Badge>
                )}
                {listing.condition && (
                  <Badge variant="outline" data-testid="listing-detail-condition">
                    {t('addItem.condition')}:{' '}
                    {t(`taxonomy.condition.${listing.condition}`, {
                      defaultValue: String(listing.condition).replace('_', ' '),
                    })}
                  </Badge>
                )}
                {listing.category && (
                  <Badge variant="secondary" data-testid="listing-detail-category">
                    {t(`taxonomy.categories.${listing.category}`, {
                      defaultValue: listing.category,
                    })}
                  </Badge>
                )}
                {listing.mode && listing.mode !== 'sell' && (
                  <Badge
                    variant="outline"
                    data-testid="listing-detail-mode"
                  >
                    {t(`taxonomy.intent.${listing.mode}`, {
                      defaultValue: listing.mode,
                    })}
                  </Badge>
                )}
              </div>
              <div className='border-t border-b border-border py-3 my-5'>
                {listing.description && (
                  <p
                    className="text-[14px] font-semibold text-text-brand mb-3"
                    data-testid="listing-detail-description"
                  >
                    {listing.description}
                  </p>
                )}
                {/* Seller card — name + public location only. Email /
                  phone are deliberately hidden until after a
                  successful transaction (they're sent in the
                  post-sale email). Hydrated by the backend in
                  listing.seller_public with a fallback chain:
                  listing.location → seller.home_location →
                  seller.address. */}
                {(listing.seller_public?.display_name
                  || listing.seller_public?.location?.city
                  || listing.seller_public?.location?.country) && (
                    <div
                      className=""
                      data-testid="listing-detail-seller"
                    >
                      {listing.seller_public?.display_name && (
                        <div className="flex items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-primary-brand shrink-0" />
                          <span className="font-semibold text-[14px] text-text-brand" data-testid="listing-detail-seller-name">
                            {listing.seller_public.display_name}
                          </span>
                        </div>
                      )}
                      {(listing.seller_public?.location?.city
                        || listing.seller_public?.location?.country) && (
                          <div
                            className="flex items-center gap-2"
                            data-testid="listing-detail-seller-location"
                          >
                            <MapPin className="h-3.5 w-3.5 text-primary-brand shrink-0" />
                            <span className="font-semibold text-[14px] text-text-brand">
                              {(() => {
                                // Dedupe city/region — many accounts have the
                                // same value in both (e.g. Berlin + Berlin),
                                // and "Berlin, Berlin, Germany" reads poorly.
                                const { city, region, country } =
                                  listing.seller_public.location || {};
                                const parts = [city];
                                if (region && region !== city) parts.push(region);
                                if (country) parts.push(country);
                                return parts.filter(Boolean).join(', ');
                              })()}
                            </span>
                          </div>
                        )}
                    </div>
                  )}
              </div>
              <div className="my-5" data-testid="listing-detail-fee-breakdown">
                <div className="caps-label text-primary-brand !font-bold !text-[10px]">{t('market.feeBreakdown')}</div>
                <dl className="mt-3 text-sm space-y-2">
                  <div className="flex justify-between text-[14px] font-semibold text-text-brand">
                    <dt className="text-text-brand">
                      {listing.mode === 'rent'
                        ? t('market.rentalPriceDay', { defaultValue: 'Daily Tariff' })
                        : t('market.listPrice')}
                    </dt>
                    <dd>{fmt(fm.list_price_cents, fm.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-[14px] font-semibold text-text-brand"><dt className="text-text-brand">{t('market.processingFee')}</dt><dd>− {fmt(fm.stripe_processing_fee_fixed_cents, fm.currency)} + 2.9%</dd></div>
                  <div className="flex justify-between text-[14px] font-semibold text-text-brand"><dt className="text-text-brand">{t('market.platformFee')} (7%)</dt><dd>− {fmt(fm.platform_fee_cents || Math.round((fm.list_price_cents || 0) * 0.07), fm.currency)}</dd></div>
                  <div className="flex justify-between font-medium border-t border-border pt-2 text-[14px] font-semibold text-text-brand"><dt>{t('market.sellerNet')}</dt><dd>{fmt(fm.estimated_seller_net_cents, fm.currency)}</dd></div>
                </dl>
              </div>
              {isOwner ? (
                <div className="space-y-2" data-testid="listing-owner-actions">
                  {/* Owner-only "Remove from marketplace" CTA */}
                  <Button
                    variant="ghost"
                    className="w-full text-white bg-destructive hover:!text-dark-brand"
                    disabled={removing}
                    onClick={() => setRemoveDialogOpen(true)}
                    data-testid="listing-remove-button"
                  >
                    {removing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('market.removing', { defaultValue: 'Removing…' })}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        {t('market.removeListing', { defaultValue: 'Remove from marketplace' })}
                      </>
                    )}
                  </Button>

                  <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                    <AlertDialogContent data-testid="listing-remove-confirm-dialog">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('market.removeListing', { defaultValue: 'Remove from marketplace' })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('market.confirmRemoveListing', {
                            defaultValue: `Remove "${listing.title}" from the marketplace? Your closet item stays — only the listing is removed.`,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={removing}>
                          {t('common.cancel', { defaultValue: 'Cancel' })}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRemoveListing}
                          disabled={removing}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {removing ? (
                            <>
                              <Loader2 className="h-4 w-4 me-2 animate-spin" />
                              {t('market.removing', { defaultValue: 'Removing…' })}
                            </>
                          ) : (
                            t('common.delete', { defaultValue: 'Delete' })
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : listing.status === 'active' ? (
                <div data-testid="listing-cta-wrapper" className="space-y-3">
                  {/* Mode-aware primary CTA:
                    • sell    → PayPal checkout
                    • swap    → SwapPicker modal
                    • donate  → one-click claim (+ optional handling fee
                                hinted in helper text; PayPal-fee branch
                                ships post-MVP). */}
                  {listing.mode === 'swap' ? (
                    <>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setSwapOpen(true)}
                        data-testid="listing-swap-button"
                      >
                        <Repeat className="h-4 w-4" />
                        {t('pages.listingDetail.propose_a_swap')}
                      </Button>
                      <p className="text-[12px] text-text-brand text-center mt-2 font-semibold italic">
                        {t('pages.listingDetail.well_email_the_lister_a')}
                      </p>
                    </>
                  ) : listing.mode === 'donate' ? (
                    <>
                      {Number(listing.shipping_fee_cents) > 0 ? (
                        // Wave 3 — donation with a shipping fee. Recipient
                        // covers shipping via PayPal. On capture the
                        // backend emails the donor with accept/deny links,
                        // so we can fire-and-forget navigate to the
                        // transactions page after a successful payment.
                        <div data-testid="listing-donate-wrapper">
                          <PayPalCheckoutButton
                            createOrder={async () => {
                              const tx = await api.claimDonation(id, Number(listing.shipping_fee_cents));
                              const orderId = tx?.paypal?.order_id;
                              if (!orderId) {
                                throw new Error('Donation claim did not return a PayPal order.');
                              }
                              return { order_id: orderId, ctx: { tx_id: tx.id } };
                            }}
                            captureOrder={async ({ order_id, ctx }) => {
                              return api.captureDonationShipping(ctx.tx_id, order_id);
                            }}
                            onSuccess={(res) => {
                              toast.success(
                                'Shipping paid. Donor will get an email to confirm the hand-off.',
                              );
                              const txId = res?.transaction?.id;
                              if (txId) nav(`/transactions#tx-${txId}`);
                              else nav('/transactions');
                            }}
                            onError={(err) => {
                              toast.error(
                                err?.response?.data?.detail || 'PayPal payment failed.',
                              );
                            }}
                            amountLabel={`Pay ${fmt(listing.shipping_fee_cents, fm.currency)} shipping`}
                            className="w-full"
                            testId="listing-donate-button"
                          />
                          <p className="text-[12px] text-text-brand text-center mt-2 font-semibold italic">
                            {t('pages.listingDetail.donations_are_free_youre_only')}
                          </p>
                        </div>
                      ) : (
                        // Zero-fee path — keep the original direct-claim UX.
                        <>
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={donateSubmitting}
                            onClick={async () => {
                              setDonateSubmitting(true);
                              try {
                                const tx = await api.claimDonation(id, 0);
                                toast.success(
                                  'Request sent. The donor will get an email to confirm.',
                                );
                                nav(`/transactions#tx-${tx.id}`);
                              } catch (err) {
                                toast.error(
                                  err?.response?.data?.detail
                                  || 'Could not send donation request.',
                                );
                              } finally {
                                setDonateSubmitting(false);
                              }
                            }}
                            data-testid="listing-donate-button"
                          >
                            {donateSubmitting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('components.swapPickerModal.sending')}
                              </>
                            ) : (
                              <>
                                <HeartHandshake className="h-4 w-4" />
                                {t('pages.listingDetail.claim_this_donation')}
                              </>
                            )}
                          </Button>
                           <p className="text-[12px] text-text-brand text-center mt-2 font-semibold italic">
                            {t('pages.listingDetail.this_donation_is_free_coordinate')}
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <div data-testid="listing-buy-wrapper">
                      <PayPalCheckoutButton
                        createOrder={createOrder}
                        captureOrder={captureOrder}
                        onSuccess={onBuySuccess}
                        onError={onBuyError}
                        amountLabel={listing.mode === 'rent'
                          ? t('market.rentFor', {
                            price: fmt(fm.list_price_cents, fm.currency),
                          })
                          : t('market.buyFor', {
                            price: fmt(fm.list_price_cents, fm.currency),
                          })
                        }
                        className="w-full"
                        testId="listing-buy-button"
                      />
                      <p className="text-[12px] text-text-brand text-center mt-2 font-semibold italic">
                        {t('credits.paypalDisclosure')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/60 p-4 text-sm text-text-brand" data-testid="listing-status-notice">
                  {t('market.statusNotice', { status: listing.status })}
                </div>
              )}
              {listing.status === 'active' && (
                <div className="mt-4">
                  <Button
                    onClick={() => setSandboxOpen(true)}
                    className="w-full"
                    data-testid="listing-style-sandbox-btn"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('market.styleSandboxBtn', { defaultValue: 'Style with my Wardrobe' })}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
        {/* Items like this */}
        {(similarLoading || similar.length > 0) && (
          <section className="bg-white p-5 rounded-[12px] shadow-sm border border-border mt-5" aria-labelledby="similar-listings-heading" data-testid="listing-similar-section">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-text-brand font-bold text-[12px] flex items-center gap-1.5">
                  {similarMode === 'embedding' ? (
                    <><Sparkles className="h-3 w-3 text-primary-brand" /> {t('market.similarVisual')}</>
                  ) : similarMode === 'category' ? (
                    <>{t('market.similarPopular')}</>
                  ) : (
                    <>{t('market.similarYouMightLike')}</>
                  )}
                </div>
                <h2 id="similar-listings-heading" className="text-[16px] font-bold text-dark-brand">{t('market.similarTitle')}</h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-lg font-bold">
                <Link to="/market">{t('market.seeAll')}</Link>
              </Button>
            </div>
            {similarLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-[calc(var(--radius)+6px)]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="listing-similar-grid">
                {similar.map((s) => {
                  const sm = s.financial_metadata || {};
                  return (
                    <Link key={s.id} to={`/market/${s.id}`} className="block group" data-testid="listing-similar-card">
                      <Card className="rounded-[12px] overflow-hidden border border-border shadow-sm group-hover:shadow-md transition-shadow">
                        <AspectRatio ratio={3 / 4} className="bg-[#ddd] relative">
                          {bestImageUrl(s)
                            ? <img src={bestImageUrl(s)} alt={s.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-text-brand caps-label">{t('market.noImage')}</div>}

                          {typeof s._score === 'number' && (
                            <Badge variant="outline"
                              className="absolute top-2 end-2 bg-primary-brand text-white text-[10px] border-primary-brand flex items-center gap-1"
                              data-testid="listing-similar-score">
                              <Sparkles className="h-2.5 w-2.5 text-white" />
                              {Math.round(s._score * 100)}%
                            </Badge>
                          )}
                        </AspectRatio>
                        <CardContent className="p-3">
                          <div className="font-bold text-[14px] text-dark-brand truncate">{s.title}</div>
                          <div className="text-[12px] font-semibold text-text-brand mt-0.5">{fmt(sm.list_price_cents, sm.currency)}</div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {/* Swap picker modal — mounted once at the tree root so state is
          preserved while the user browses similar listings. */}
        <SwapPickerModal
          open={swapOpen}
          onOpenChange={setSwapOpen}
          listingId={id}
          listingTitle={listing?.title}
          onSwapCreated={(tx) => {
            if (tx?.id) {
              nav(`/transactions#tx-${tx.id}`);
            } else {
              nav('/transactions');
            }
          }}
        />
        <StyleSandbox
          isOpen={sandboxOpen}
          onClose={() => setSandboxOpen(false)}
          listingItem={listing}
        />
      </section>
    </>
  );
}
