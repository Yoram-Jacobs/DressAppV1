import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArchiveX,
  Ban,
  Eye,
  Pencil,
  SendHorizonal,
  Trash2,
  Settings,
  Pause as PauseCircle,
  Play as PlayCircle,
  CreditCard,
  Loader2,
  ExternalLink,
  DollarSign,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { campaignApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampaignSettingsSheet } from '@/components/CampaignSettingsSheet';
import PricingBanner from "../assets/img/inner6.webp";
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';
const STATUS_CONFIG = {
  draft: {
    label: 'campaigns.status.draft',
    className: 'bg-secondary text-text-brand',
    Icon: Pencil,
  },
  pending_approval: {
    label: 'campaigns.status.pendingApproval',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Icon: Clock,
  },
  approved: {
    label: 'campaigns.status.approved',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Icon: CheckCircle2,
  },
  active: {
    label: 'campaigns.status.active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'campaigns.status.rejected',
    className: 'bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
  paused: {
    label: 'campaigns.status.paused',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Icon: PauseCircle,
  },
  expired: {
    label: 'campaigns.status.expired',
    className: 'bg-secondary text-text-brand',
    Icon: ArchiveX,
  },
  cancelled: {
    label: 'campaigns.status.cancelled',
    className: 'bg-secondary text-text-brand',
    Icon: Ban,
  },
};

export default function MyCampaigns() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCampaign, setSettingsCampaign] = useState(null);

  const [paypalOpen, setPaypalOpen] = useState(false);
  const [paypalOrder, setPaypalOrder] = useState(null);
  const [paypalRequired, setPaypalRequired] = useState(false);
  const [submitPhase, setSubmitPhase] = useState('idle');
  const [submittingCampaignId, setSubmittingCampaignId] = useState(null);

  const [billingOpen, setBillingOpen] = useState(false);
  const [selectedBillingCampaign, setSelectedBillingCampaign] = useState(null);

  const isExpert = user?.professional?.is_professional;

  // useEffect(() => {
  //   if (!isExpert) return;
  //   campaignApi
  //     .listMyCampaigns({ limit: 50 })
  //     .then((res) => setCampaigns(res.items || []))
  //     .catch(() => {})
  //     .finally(() => setLoading(false));
  // }, [isExpert]);
  useEffect(() => {
    if (!isExpert) return;
    // TEMPORARY: listMyCampaigns not implemented yet
    setCampaigns([
      {
        id: '1',
        title: 'Summer Sale Campaign',
        business_name: 'My Business',
        category: 'Restaurant',
        status: 'active',
        discount_pct: 20,
        end_date: '2026-12-31',
        analytics: { views: 150 },
        billing: {
          payment_status: 'paid',
          total_fee_cents: 3000,
          total_days: 30,
        },
      },
      {
        id: '2',
        title: 'Winter Promo',
        business_name: 'My Business',
        category: 'Retail',
        status: 'draft',
        discount_pct: 10,
        analytics: { views: 0 },
      },
    ]);
    setLoading(false);
  }, [isExpert]);
  const handleSubmit = async (id) => {
    // Check PayPal connection client-side
    const hasPayPal = !!(user?.paypal_receiver_email);
    if (!hasPayPal) {
      setPaypalRequired(true);
      return;
    }

    setSubmittingCampaignId(id);
    setSubmitPhase('creating_order');
    setActionId(id);
    try {
      const res = await campaignApi.submitCampaign(id); // returns {order_id, fee_cents, approve_url}
      setPaypalOrder(res);
      if (res.approve_url) {
        window.open(res.approve_url, '_blank');
      }
      setPaypalOpen(true);
      setSubmitPhase('awaiting_payment');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'paypal_not_connected') {
        setPaypalRequired(true);
      } else {
        toast.error(err?.response?.data?.detail || t('campaigns.mine.submitError'));
      }
      setSubmitPhase('idle');
    } finally {
      setActionId(null);
    }
  };

  const handlePayPalCapture = async () => {
    if (!paypalOrder?.order_id || !submittingCampaignId) return;
    setSubmitPhase('capturing');
    try {
      await campaignApi.captureSubmissionOrder(submittingCampaignId, paypalOrder.order_id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === submittingCampaignId ? { ...c, status: 'pending_approval' } : c))
      );
      toast.success(t('campaigns.mine.submitSuccess'));
      setPaypalOpen(false);
      setPaypalOrder(null);
      setSubmittingCampaignId(null);
      setSubmitPhase('done');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.mine.submitError'));
      setSubmitPhase('idle');
    }
  };

  const handleCancel = async (id) => {
    setActionId(id);
    try {
      await campaignApi.cancelCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'cancelled' } : c))
      );
      toast.success(t('campaigns.mine.cancelSuccess'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.mine.cancelError'));
    } finally {
      setActionId(null);
    }
  };

  const handleCampaignUpdated = useCallback((updated) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  }, []);

  if (!isExpert) {
    return (
      <div className="container-px max-w-xl mx-auto pt-16 text-center">
        <h1 className="font-display text-2xl">{t('campaigns.create.notExpert')}</h1>
        <Button className="mt-6" onClick={() => navigate('/me')}>
          {t('campaigns.create.goToProfile')}
        </Button>
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
                  max-[991px]:px-[15px] max-[991px]:py-[30px]
                max-[767px]:px-[15px] max-[767px]:py-[30px]
                max-[480px]:px-[15px] max-[480px]:py-[30px]
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
                      max-[767px]:text-[30px]
                    max-[480px]:text-[20px]
                    max-[480px]:leading-[30px]
                    "
              >
                {t('campaigns.mine.title')}
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
                {t("campaigns.create.subtitle")}
              </p>
              <Button
                asChild
                className="!gap-1"
                data-testid="my-campaigns-create-btn"
              >
                <Link to="/campaigns/create">
                  <Plus className="h-4 w-4" />
                  {t('campaigns.mine.createNew')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className="px-[40px] py-[40px] bg-accent-beige max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]">

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-white rounded-[12px] border border-border shadow-sm" data-testid="my-campaigns-empty">
            <CardContent className="p-12 text-center">
              <Tag className="h-9 w-9 mx-auto text-primary-brand mb-3" />
              <h3 className="text-[20px] text-dark-brand font-bold">{t('campaigns.mine.empty.title')}</h3>
              <p className="text-[14px] text-text-brand font-semibold max-w-sm mx-auto">
                {t('campaigns.mine.empty.body')}
              </p>
              <Button asChild className="mt-3 rounded-xl">
                <Link to="/campaigns/create">{t('campaigns.mine.createFirst')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
              const Icon = cfg.Icon;
              const busy = actionId === c.id;

              return (
                <Card
                  key={c.id}
                  className="bg-white rounded-[12px] border border-border shadow-sm"
                  data-testid={`my-campaign-${c.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[14px] truncate">{c.title}</h3>
                          <Badge
                          variant="outline"
                            className={cn(
                              'rounded-full text-[10px] border-0 flex items-center gap-1',
                              cfg.className
                            )}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {t(cfg.label)}
                          </Badge>
                        </div>
                        <p className="text-[12px] text-text-brand font-semibold mt-0.5">
                          {c.business_name} · {c.category}
                        </p>
                        {c.rejection_reason && (
                          <div className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{c.rejection_reason}</span>
                          </div>
                        )}
                        <div className="mt-0.5 flex gap-4 text-[12px] font-semibold text-text-brand">
                          {c.discount_pct > 0 && <span>{c.discount_pct}% OFF</span>}
                          {c.end_date && (
                            <span>
                              {t('campaigns.detail.until')}: {c.end_date}
                            </span>
                          )}
                          <span>
                            {t('campaigns.detail.views')}: {c.analytics?.views || 0}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className=""
                          onClick={() => { setSettingsCampaign(c); setSettingsOpen(true); }}
                          data-testid={`my-campaign-settings-${c.id}`}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className=""
                          asChild
                          data-testid={`my-campaign-view-${c.id}`}
                        >
                          <Link to={`/campaigns/${c.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                            {t('common.open')}
                          </Link>
                        </Button>

                        {['draft', 'rejected'].includes(c.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className=""
                            asChild
                            data-testid={`my-campaign-edit-${c.id}`}
                          >
                            <Link to={`/campaigns/create?edit=${c.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                              {t('common.edit', { defaultValue: 'Edit' })}
                            </Link>
                          </Button>
                        )}

                        {['draft', 'rejected'].includes(c.status) && (
                          <Button
                            size="sm"
                            className=""
                            onClick={() => handleSubmit(c.id)}
                            disabled={busy}
                            data-testid={`my-campaign-submit-${c.id}`}
                          >
                            <SendHorizonal className="h-3.5 w-3.5" />
                            {t('campaigns.mine.submit')}
                          </Button>
                        )}

                        {c.billing && (
                          <Button
                            size="sm"
                            className=""
                            onClick={() => { setSelectedBillingCampaign(c); setBillingOpen(true); }}
                            data-testid={`my-campaign-billing-${c.id}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {t('campaigns.billing.reportTitle', { defaultValue: 'Billings' })}
                          </Button>
                        )}

                        {['draft', 'rejected'].includes(c.status) && (
                          <Button
                            size="sm"
                            className="rounded-xl text-white bg-destructive hover:!bg-destructive/90"
                            onClick={() => handleCancel(c.id)}
                            disabled={busy}
                            data-testid={`my-campaign-cancel-${c.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('campaigns.mine.cancel')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
      <CampaignSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        campaign={settingsCampaign}
        onUpdated={handleCampaignUpdated}
      />
      {/* PayPal connection required Dialog */}
      <Dialog open={paypalRequired} onOpenChange={setPaypalRequired}>
        <DialogContent data-testid="paypal-required-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[hsl(var(--accent))]" />
              {t('campaigns.billing.paypalRequired')}
            </DialogTitle>
            <DialogDescription>{t('campaigns.billing.paypalRequiredBody')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-center">
            <span className="text-2xl font-bold text-[hsl(var(--accent))]">$1.00</span>
            <span className="text-text-brand ml-1 text-xs">USD / campaign / day</span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaypalRequired(false)}>
              {t('common.cancel')}
            </Button>
            <Button asChild>
              <a href="/me?tab=payment" target="_blank">
                <ExternalLink className="h-4 w-4 me-1" />
                {t('campaigns.billing.connectPayPal')}
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* PayPal Checkout Dialog */}
      <Dialog open={paypalOpen} onOpenChange={(open) => { setPaypalOpen(open); if (!open) setSubmitPhase('idle'); }}>
        <DialogContent data-testid="paypal-checkout-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#003087]" />
              {t('campaigns.billing.checkoutTitle', { defaultValue: 'Campaign Payment' })}
            </DialogTitle>
            <DialogDescription>
              {t('campaigns.billing.checkoutDesc', { defaultValue: 'Please complete the payment for your campaign fee.' })}
            </DialogDescription>
          </DialogHeader>

          {paypalOrder && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <div className="text-2xl font-bold text-[#003087]">
                  ${(paypalOrder.fee_cents / 100).toFixed(2)} USD
                </div>
                <div className="text-xs text-text-brand mt-1">
                  {t('campaigns.billing.totalDays', { defaultValue: 'Total period' })}: {paypalOrder.total_days} {t('campaigns.billing.daysCount', { count: paypalOrder.total_days, defaultValue: 'days' })}
                </div>
              </div>

              <Button
                className="w-full rounded-xl bg-[#FFC439] hover:bg-[#F5BA30] text-[#003087] font-bold"
                onClick={handlePayPalCapture}
                disabled={submitPhase === 'capturing'}
                data-testid="paypal-capture-btn"
              >
                {submitPhase === 'capturing' && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                PayPal — {t('campaigns.billing.confirmPayment')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Billings Report Dialog */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent data-testid="billing-report-dialog" className="max-w-md">
          <DialogTitle>
            {t('campaigns.billing.reportTitle', { defaultValue: 'Billings Report' })}
          </DialogTitle>
          <DialogDescription>
            {t('campaigns.billing.reportDesc', { defaultValue: 'Statement of charges for campaign' })}: <strong>{selectedBillingCampaign?.title}</strong>
          </DialogDescription>
          {selectedBillingCampaign?.billing && (
            <div className="space-y-4">
              <div className="border border-border rounded-[12px] p-3 bg-primary-shadow space-y-2 text-[12px] font-semibold">
                <div className="flex justify-between">
                  <span className="text-text-brand">{t('campaigns.billing.paymentStatus', { defaultValue: 'Payment Status' })}</span>
                  <Badge variant="outline" className={cn(
                    "capitalize",
                    selectedBillingCampaign.billing.payment_status === 'paid'
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30"
                  )}>
                    {selectedBillingCampaign.billing.payment_status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-brand">{t('campaigns.billing.totalCharged', { defaultValue: 'Total Fee' })}</span>
                  <span className="font-semibold">${(selectedBillingCampaign.billing.total_fee_cents / 100).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-brand">{t('campaigns.billing.totalDays', { defaultValue: 'Total Period' })}</span>
                  <span>{selectedBillingCampaign.billing.total_days} {t('campaigns.billing.daysCount', { count: selectedBillingCampaign.billing.total_days, defaultValue: 'days' })}</span>
                </div>
                {selectedBillingCampaign.billing.paid_at && (
                  <div className="flex justify-between">
                    <span className="text-text-brand">{t('campaigns.billing.paidAt', { defaultValue: 'Payment Date' })}</span>
                    <span>{new Date(selectedBillingCampaign.billing.paid_at).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedBillingCampaign.billing.paypal_capture_id && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text-brand">{t('campaigns.billing.captureId', { defaultValue: 'Capture ID' })}</span>
                    <span className="truncate max-w-[180px]">{selectedBillingCampaign.billing.paypal_capture_id}</span>
                  </div>
                )}
                {selectedBillingCampaign.billing.payer_email && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-brand">{t('campaigns.billing.payerEmail', { defaultValue: 'Payer PayPal Email' })}</span>
                    <span>{selectedBillingCampaign.billing.payer_email}</span>
                  </div>
                )}
              </div>
              {/* Extension History */}
              {selectedBillingCampaign.billing.extension_history && selectedBillingCampaign.billing.extension_history.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs caps-label text-text-brand">{t('campaigns.billing.extensions', { defaultValue: 'Extension Transactions' })}</h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {selectedBillingCampaign.billing.extension_history.map((ext, idx) => (
                      <div key={idx} className="border border-border/60 rounded-lg p-2.5 bg-background text-xs space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span>+{ext.extra_days} {t('campaigns.billing.daysCount', { count: ext.extra_days, defaultValue: 'days' })}</span>
                          <span>${(ext.extra_fee_cents / 100).toFixed(2)} USD</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-text-brand">
                          <span>{new Date(ext.extended_at).toLocaleDateString()}</span>
                          <span className="font-mono truncate max-w-[120px]">{ext.paypal_capture_id || 'captured'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Pause Log / Period */}
              {selectedBillingCampaign.billing.paused_periods && selectedBillingCampaign.billing.paused_periods.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs caps-label text-text-brand">{t('campaigns.billing.pausePeriods', { defaultValue: 'Paused History' })}</h4>
                  <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                    {selectedBillingCampaign.billing.paused_periods.map((p, idx) => (
                      <div key={idx} className="border border-border rounded-[12px] p-3 bg-primary-shadow text-xs flex justify-between text-text-brand">
                        <span>{new Date(p.paused_at).toLocaleDateString()} - {p.resumed_at ? new Date(p.resumed_at).toLocaleDateString() : t('campaigns.status.paused', { defaultValue: 'Paused' })}</span>
                        <span>{p.days_paused !== null ? `${p.days_paused} d` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button className="rounded-xl w-full" onClick={() => setBillingOpen(false)}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
