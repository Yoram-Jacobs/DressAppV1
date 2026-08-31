import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceTagBadge } from '@/components/SourceTagBadge';
import { SwapPickerModal } from '@/components/SwapPickerModal';
import StyleSandbox from '@/components/market/StyleSandbox';
import { labelForSource, labelForIntent } from '@/lib/taxonomy';
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
  X,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { bestImageUrl } from '@/lib/itemImage';
import { useAuth } from '@/lib/auth';
import { PayPalCheckoutButton } from '@/lib/paypal';


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
  const [sandboxOpen, setSandboxOpen] = useState(false);
  // Lightbox state — purely presentational, no API involvement.
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSimilarLoading(true);
    api.getListing(id)
      .then(setListing)
      .catch(() => { toast.error(t('market.listingNotFound')); nav('/market'); })
      .finally(() => setLoading(false));

    api.getSimilarListings(id, { limit: 6 })
      .then((res) => { setSimilar(res.items || []); setSimilarMode(res.mode || null); })
      .catch(() => { /* non-fatal */ })
      .finally(() => setSimilarLoading(false));
  }, [id, nav, t]);

  // Close lightbox with Escape key.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightboxOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

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
      <div className="listingdetail-page">
        <div className="container-fluid">
          <Skeleton className="aspect-[3/4] w-full rounded-[20px]" />
        </div>
      </div>
    );
  }
  if (!listing) return null;

  const fm = listing.financial_metadata || {};
  const isOwner = listing.seller_id === user?.id;
  const mainImage = (listing.images || [])[0];

  return (
    <>
      {/* banner-start */}
      <section className="closet-banner">
        <div className="container-fluid">
          <div className="closet-banner__content">
            <div className="closet-banner__title-row">
              <h1 className="hero-title">Create a Listing</h1>
              <p className="hero-description">Turn your wardrobe into opportunity. List your fashion items for sale, swap, rent, or donation and connect with buyers in your community.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="listingdetail-page">
        <div className="container-fluid">
          <button onClick={() => nav(-1)} className="listingdetail-back">
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t('common.back')}
          </button>
          <div className="row">
            <div className="col-md-4">
              {/* ---------- Image column ---------- */}
              <div className="card listingdetail-card">
                <div className="listingdetail-image-col">
                  <div className="listingdetail-image-card"
                    onClick={() => mainImage && setLightboxOpen(true)}
                    role={mainImage ? 'button' : undefined}
                    tabIndex={mainImage ? 0 : undefined}
                    data-testid="listing-detail-image"
                  >
                    {mainImage ? (
                      <>
                        <img src={mainImage} alt={listing.title} />
                      </>
                    ) : (
                      <div className="listingdetail-noimage">{t('market.noImage')}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-8">
              {/* ---------- Info column ---------- */}
              <div className="listingdetail-info-col">
                <span className="listingdetail-source-span">
                  {listing.mode && listing.mode !== 'sell'
                    ? labelForIntent(
                      listing.mode === 'sell' ? 'for_sale' : listing.mode === 'swap' ? 'swap' : listing.mode === 'donate' ? 'donate' : listing.mode === 'rent' ? 'rent' : listing.mode,
                      t
                    )
                    : labelForSource(listing.source, t)}
                </span>
                <h2 data-testid="listing-detail-title">{listing.title}</h2>
                <div className="listingdetail-views">
                  <Eye className="h-3 w-3 me-1" />{t('market.viewsCount', { count: listing.views || 0 })}
                </div>



                <div className="listingdetail-price" data-testid="listing-detail-price">
                  {fmt(fm.list_price_cents, fm.currency)}
                  {listing.mode === 'rent' && <span className="listingdetail-price-unit"> / {t('common.day', { defaultValue: 'day' })}</span>}
                </div>

                {Number(listing.shipping_fee_cents) > 0 ? (
                  <div className="listingdetail-shipping" data-testid="listing-detail-shipping">
                    <span>+ {fmt(listing.shipping_fee_cents, fm.currency)} shipping</span>
                    <span className="listingdetail-shipping-accent">
                      {t('pages.listingDetail.or_meet_locally_to_skip')}
                    </span>
                  </div>
                ) : (
                  <div className="listingdetail-shipping-free" data-testid="listing-detail-shipping-free">
                    {t('pages.listingDetail.local_pickup_preferred_no_shipping')}
                  </div>
                )}

                <div className="listingdetail-meta" data-testid="listing-detail-meta">
                  {listing.size && (
                    <span className="listingdetail-chip" data-testid="listing-detail-size">
                      {t('addItem.size')}: {listing.size}
                    </span>
                  )}
                  {listing.condition && (
                    <span className="listingdetail-chip" data-testid="listing-detail-condition">
                      {t('addItem.condition')}:{' '}
                      {t(`taxonomy.condition.${listing.condition}`, {
                        defaultValue: String(listing.condition).replace('_', ' '),
                      })}
                    </span>
                  )}
                  {listing.category && (
                    <span className="listingdetail-chip listingdetail-chip-solid" data-testid="listing-detail-category">
                      {t(`taxonomy.categories.${listing.category}`, {
                        defaultValue: listing.category,
                      })}
                    </span>
                  )}
                  {listing.mode && listing.mode !== 'sell' && (
                    <span className="listingdetail-chip" data-testid="listing-detail-mode">
                      {t(`taxonomy.intent.${listing.mode}`, {
                        defaultValue: listing.mode,
                      })}
                    </span>
                  )}
                </div>

                {listing.description && (
                  <p className="listingdetail-description" data-testid="listing-detail-description">
                    {listing.description}
                  </p>
                )}

                {(listing.seller_public?.display_name
                  || listing.seller_public?.location?.city
                  || listing.seller_public?.location?.country) && (
                    <div className="listingdetail-seller" data-testid="listing-detail-seller">
                      {listing.seller_public?.display_name && (
                        <div className="listingdetail-seller-row">
                          <Store className="h-3.5 w-3.5 shrink-0" />
                          <span data-testid="listing-detail-seller-name">
                            {listing.seller_public.display_name}
                          </span>
                        </div>
                      )}
                      {(listing.seller_public?.location?.city
                        || listing.seller_public?.location?.country) && (
                          <div className="listingdetail-seller-row listingdetail-seller-loc" data-testid="listing-detail-seller-location">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {(() => {
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

              <div className="" data-testid="listing-detail-fee-breakdown">
                <div className="listingdetail-fee-label">{t('market.feeBreakdown')}</div>
                <dl className="listingdetail-fee-list">
                  <div className="listingdetail-fee-row">
                    <dt>
                      {listing.mode === 'rent'
                        ? t('market.rentalPriceDay', { defaultValue: 'Daily Tariff' })
                        : t('market.listPrice')}
                    </dt>
                    <dd>{fmt(fm.list_price_cents, fm.currency)}</dd>
                  </div>
                  <div className="listingdetail-fee-row">
                    <dt>{t('market.processingFee')}</dt>
                    <dd>− {fmt(fm.stripe_processing_fee_fixed_cents, fm.currency)} + 2.9%</dd>
                  </div>
                  <div className="listingdetail-fee-row">
                    <dt>{t('market.platformFee')}</dt>
                    <dd></dd>
                  </div>
                  <div className="listingdetail-fee-row listingdetail-fee-total">
                    <dt>{t('market.sellerNet')}</dt>
                    <dd>{fmt(fm.estimated_seller_net_cents, fm.currency)}</dd>
                  </div>
                </dl>
              </div>

              {isOwner ? (
                <div className="listingdetail-owner-actions" data-testid="listing-owner-actions">
                  <button
                    className="listingdetail-remove-btn"
                    disabled={removing}
                    onClick={async () => {
                      if (!window.confirm(
                        t('market.confirmRemoveListing', {
                          defaultValue: `Remove "${listing.title}" from the marketplace? Your closet item stays — only the listing is removed.`,
                        }),
                      )) return;
                      setRemoving(true);
                      try {
                        await api.deleteListing(listing.id);
                        toast.success(t('market.listingRemoved', { defaultValue: 'Removed from marketplace' }));
                        nav('/market');
                      } catch (err) {
                        toast.error(err?.response?.data?.detail || t('market.removeFailed', { defaultValue: 'Could not remove listing' }));
                      } finally {
                        setRemoving(false);
                      }
                    }}
                    data-testid="listing-remove-button"
                  >
                    {removing ? (
                      <>
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        {t('market.removing', { defaultValue: 'Removing…' })}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 me-2" />
                        {t('market.removeListing', { defaultValue: 'Remove from marketplace' })}
                      </>
                    )}
                  </button>
                </div>
              ) : listing.status === 'active' ? (
                <div data-testid="listing-cta-wrapper" className="listingdetail-cta-wrap">
                  {listing.mode === 'swap' ? (
                    <>
                      <button
                        className="listingdetail-cta-btn listingdetail-cta-swap"
                        onClick={() => setSwapOpen(true)}
                        data-testid="listing-swap-button"
                      >
                        <Repeat className="h-4 w-4 me-2" />
                        {t('pages.listingDetail.propose_a_swap')}
                      </button>
                      <div className="listingdetail-cta-hint">
                        {t('pages.listingDetail.well_email_the_lister_a')}
                      </div>
                    </>
                  ) : listing.mode === 'donate' ? (
                    <>
                      {Number(listing.shipping_fee_cents) > 0 ? (
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
                          <div className="listingdetail-cta-hint">
                            {t('pages.listingDetail.donations_are_free_youre_only')}
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            className="listingdetail-cta-btn listingdetail-cta-donate"
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
                                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                {t('components.swapPickerModal.sending')}
                              </>
                            ) : (
                              <>
                                <HeartHandshake className="h-4 w-4 me-2" />
                                {t('pages.listingDetail.claim_this_donation')}
                              </>
                            )}
                          </button>
                          <div className="listingdetail-cta-hint">
                            {t('pages.listingDetail.this_donation_is_free_coordinate')}
                          </div>
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
                      <div className="listingdetail-paypal-disclosure">
                        {t('credits.paypalDisclosure')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="listingdetail-status-notice" data-testid="listing-status-notice">
                  {t('market.statusNotice', { status: listing.status })}
                </div>
              )}

              {listing.status === 'active' && (
                <button
                  onClick={() => setSandboxOpen(true)}
                  className="listingdetail-sandbox-btn"
                  data-testid="listing-style-sandbox-btn"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('market.styleSandboxBtn', { defaultValue: 'Style with my Wardrobe' })}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* ---------- Similar listings ---------- */}
      {(similarLoading || similar.length > 0) && (
        <section className="listingdetail-similar" aria-labelledby="similar-listings-heading" data-testid="listing-similar-section">
          <div className="container-fluid">
            <div className="listingdetail-similar-head">
              <div>
                <div className="listingdetail-similar-eyebrow">
                  {similarMode === 'embedding' ? (
                    <><Sparkles className="h-3 w-3" /> {t('market.similarVisual')}</>
                  ) : similarMode === 'category' ? (
                    <>{t('market.similarPopular')}</>
                  ) : (
                    <>{t('market.similarYouMightLike')}</>
                  )}
                </div>
                <h2 id="similar-listings-heading" className="listingdetail-similar-title">{t('market.similarTitle')}</h2>
              </div>
              <Link to="/market" className="listingdetail-similar-seeall">{t('market.seeAll')}</Link>
            </div>
            {similarLoading ? (
              <div className="listingdetail-similar-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-[16px]" />
                ))}
              </div>
            ) : (
              <div className="listingdetail-similar-grid" data-testid="listing-similar-grid">
                {similar.map((s) => {
                  const sm = s.financial_metadata || {};
                  return (
                    <Link key={s.id} to={`/market/${s.id}`} className="listingdetail-similar-card" data-testid="listing-similar-card">
                      <div className="listingdetail-similar-image">
                        {(s.images || [])[0]
                          ? <img src={s.images[0]} alt={s.title} />
                          : <div className="listingdetail-noimage">{t('market.noImage')}</div>}
                        {typeof s._score === 'number' && (
                          <span className="listingdetail-similar-score" data-testid="listing-similar-score">
                            <Sparkles className="h-2.5 w-2.5" />
                            {Math.round(s._score * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="listingdetail-similar-body">
                        <div className="listingdetail-similar-name">{s.title}</div>
                        <div className="listingdetail-similar-price">{fmt(sm.list_price_cents, sm.currency)}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

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

    </>
  );
}