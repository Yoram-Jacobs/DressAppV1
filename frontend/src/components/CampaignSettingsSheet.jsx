import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  CalendarRange,
  Pause,
  Play,
  Trash2,
  AlertTriangle,
  DollarSign,
  Loader2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { campaignApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * CampaignSettingsSheet
 *
 * Slide-over for expert campaign lifecycle management:
 * - Extend campaign (creates PayPal order, expert completes SDK flow)
 * - Pause / Resume
 * - Delete (no refund for active campaigns)
 *
 * Props:
 *   open: boolean
 *   onOpenChange: (open: boolean) => void
 *   campaign: ExpertCampaign object
 *   onUpdated: (updatedCampaign: object) => void  — called after any mutation
 */
export function CampaignSettingsSheet({ open, onOpenChange, campaign, onUpdated }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Extend state
  const [newEndDate, setNewEndDate] = useState('');
  const [extendOrder, setExtendOrder] = useState(null); // {order_id, extra_days, extra_fee_cents, new_end_date}
  const [extendLoading, setExtendLoading] = useState(false);

  // Pause / Resume state
  const [pauseLoading, setPauseLoading] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (!campaign) return null;

  const isActive = campaign.status === 'active';
  const isPaused = campaign.status === 'paused';
  const isApproved = campaign.status === 'approved';
  const canExtend = isActive || isPaused || isApproved;
  const canDelete = !['expired', 'cancelled'].includes(campaign.status);

  // --- Extend ---
  const handleExtendCreate = async () => {
    if (!newEndDate) return;
    setExtendLoading(true);
    try {
      const res = await campaignApi.extendCampaign(campaign.id, newEndDate);
      setExtendOrder(res);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.settings.extendError'));
    } finally {
      setExtendLoading(false);
    }
  };

  const handleExtendCapture = async () => {
    if (!extendOrder) return;
    setExtendLoading(true);
    try {
      // In a real integration this would go through the PayPal JS SDK.
      // For mock/dev mode (order_id starts with MOCK-) we capture directly.
      const res = await campaignApi.captureExtensionOrder(
        campaign.id,
        extendOrder.order_id,
        extendOrder.new_end_date,
      );
      toast.success(t('campaigns.settings.extendSuccess'));
      onUpdated?.({ ...campaign, end_date: res.new_end_date });
      setExtendOrder(null);
      setNewEndDate('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.settings.extendError'));
    } finally {
      setExtendLoading(false);
    }
  };

  // --- Pause ---
  const handlePause = async () => {
    setPauseLoading(true);
    try {
      await campaignApi.pauseCampaign(campaign.id);
      toast.success(t('campaigns.settings.pauseSuccess'));
      onUpdated?.({ ...campaign, status: 'paused' });
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.settings.pauseError'));
    } finally {
      setPauseLoading(false);
    }
  };

  // --- Resume ---
  const handleResume = async () => {
    setPauseLoading(true);
    try {
      const res = await campaignApi.resumeCampaign(campaign.id);
      toast.success(t('campaigns.settings.resumeSuccess'));
      onUpdated?.({ ...campaign, status: 'active', end_date: res.end_date });
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.settings.resumeError'));
    } finally {
      setPauseLoading(false);
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await campaignApi.deleteCampaign(campaign.id);
      toast.success(t('campaigns.settings.deleteSuccess'));
      onUpdated?.({ ...campaign, status: 'cancelled' });
      setDeleteOpen(false);
      onOpenChange(false);
      navigate('/campaigns/mine');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('campaigns.settings.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Fee preview for extension
  const extraDays = (() => {
    if (!newEndDate || !campaign.end_date) return 0;
    try {
      const curr = new Date(campaign.end_date);
      const next = new Date(newEndDate);
      return Math.max(0, Math.round((next - curr) / 86400000));
    } catch {
      return 0;
    }
  })();
  const extraFeeDollars = (extraDays * 1).toFixed(2);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2 font-display text-xl">
              <Settings className="h-5 w-5" />
              {t('campaigns.settings.title')}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{campaign.title}</p>
          </SheetHeader>

          <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-10rem)] pb-4">
            {/* --- Extend --- */}
            {canExtend && (
              <section data-testid="campaign-settings-extend">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarRange className="h-4 w-4 text-[hsl(var(--accent))]" />
                  <h3 className="font-semibold text-sm">{t('campaigns.settings.extend')}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('campaigns.billing.feePerDay')} · {t('campaigns.settings.extendAutoApproved')}
                </p>

                {!extendOrder ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="new-end-date" className="text-xs">
                        {t('campaigns.settings.newEndDate')}
                      </Label>
                      <Input
                        id="new-end-date"
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        min={campaign.end_date || new Date().toISOString().split('T')[0]}
                        className="mt-1"
                        data-testid="extend-new-end-date"
                      />
                    </div>
                    {extraDays > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="flex items-center gap-1 text-[hsl(var(--accent))] font-semibold">
                          <DollarSign className="h-3.5 w-3.5" />
                          {t('campaigns.settings.extendFeePreview', {
                            fee: `$${extraFeeDollars}`,
                            days: extraDays,
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('campaigns.billing.feeNote')}
                        </p>
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full rounded-xl"
                      onClick={handleExtendCreate}
                      disabled={!newEndDate || extraDays <= 0 || extendLoading}
                      data-testid="extend-submit-btn"
                    >
                      {extendLoading && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
                      {t('campaigns.settings.extendPay', {
                        fee: extraDays > 0 ? `$${extraFeeDollars}` : '',
                      })}
                    </Button>
                  </div>
                ) : (
                  // PayPal capture step (mock/dev: capture immediately)
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-3 text-sm">
                      <p className="font-semibold">
                        {t('campaigns.billing.extensionFee')}:{' '}
                        <span className="text-[hsl(var(--accent))]">
                          ${(extendOrder.extra_fee_cents / 100).toFixed(2)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        +{extendOrder.extra_days} {t('campaigns.settings.days')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full rounded-xl bg-[#FFC439] hover:bg-[#F5BA30] text-[#003087] font-bold"
                      onClick={handleExtendCapture}
                      disabled={extendLoading}
                      data-testid="extend-paypal-capture-btn"
                    >
                      {extendLoading && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
                      PayPal — {t('campaigns.billing.confirmPayment')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => { setExtendOrder(null); setNewEndDate(''); }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                )}
              </section>
            )}

            {canExtend && <Separator />}

            {/* --- Pause / Resume --- */}
            {(isActive || isPaused) && (
              <section data-testid="campaign-settings-pause">
                <div className="flex items-center gap-2 mb-3">
                  {isActive ? (
                    <Pause className="h-4 w-4 text-orange-500" />
                  ) : (
                    <Play className="h-4 w-4 text-green-500" />
                  )}
                  <h3 className="font-semibold text-sm">
                    {isActive ? t('campaigns.settings.pause') : t('campaigns.settings.resume')}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {isActive
                    ? t('campaigns.settings.pauseNote')
                    : t('campaigns.settings.resumeNote')}
                </p>
                {isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50"
                    onClick={handlePause}
                    disabled={pauseLoading}
                    data-testid="pause-campaign-btn"
                  >
                    {pauseLoading && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
                    <Pause className="h-3.5 w-3.5 me-1" />
                    {t('campaigns.settings.pause')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={handleResume}
                    disabled={pauseLoading}
                    data-testid="resume-campaign-btn"
                  >
                    {pauseLoading && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
                    <Play className="h-3.5 w-3.5 me-1" />
                    {t('campaigns.settings.resume')}
                  </Button>
                )}
              </section>
            )}

            {(isActive || isPaused) && canDelete && <Separator />}

            {/* --- Delete --- */}
            {canDelete && (
              <section data-testid="campaign-settings-delete">
                <div className="flex items-center gap-2 mb-3">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-sm text-destructive">
                    {t('campaigns.settings.delete')}
                  </h3>
                </div>
                {isActive && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 mb-3">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{t('campaigns.settings.deleteWarning')}</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteOpen(true)}
                  data-testid="delete-campaign-btn"
                >
                  <Trash2 className="h-3.5 w-3.5 me-1" />
                  {t('campaigns.settings.delete')}
                </Button>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid="delete-campaign-dialog">
          <DialogHeader>
            <DialogTitle>{t('campaigns.settings.delete')}</DialogTitle>
            <DialogDescription>
              {isActive
                ? t('campaigns.settings.deleteWarning')
                : t('campaigns.settings.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">&ldquo;{campaign.title}&rdquo;</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
              data-testid="delete-campaign-confirm-btn"
            >
              {deleteLoading && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {t('campaigns.settings.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
