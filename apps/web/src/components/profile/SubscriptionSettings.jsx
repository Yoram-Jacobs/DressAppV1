import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useClosetStore } from '@/lib/useClosetStore';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Loader2, Sparkles as Zap } from 'lucide-react';

export function SubscriptionSettings() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const { total: closetCount } = useClosetStore();
  const [busy, setBusy] = useState(false);

  const sub = user?.subscription || {};
  const isActive = sub.is_active || false;
  const planType = sub.plan_type || 'free';
  const tier = sub.tier || 'free';
  const expiresAt = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '';

  const userTier = (isActive && planType !== 'free') ? tier : 'free';
  const capacity = userTier === 'free' ? Math.min(200, 50 + (user?.closet_capacity_bonus || 0)) : 999999;

  const handleUpgrade = async (type) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.createSubscription({
        plan_type: type,
        return_url: `${window.location.origin}/me?sub_status=success`,
        cancel_url: `${window.location.origin}/me?sub_status=cancel`,
      });
      if (res.approve_url) {
        window.location.href = res.approve_url;
      } else {
        toast.error(t('profile.failedToInitiatePayment', { defaultValue: 'Failed to initiate subscription payment.' }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail?.message || t('profile.errorCreatingSubscription', { defaultValue: 'Error creating subscription' }));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (busy) return;
    if (!window.confirm(t('profile.cancelConfirm', { defaultValue: 'Are you sure you want to cancel your subscription? You will lose premium features.' }))) return;
    setBusy(true);
    try {
      await api.cancelSubscription();
      toast.success(t('profile.cancelSuccess', { defaultValue: 'Subscription cancelled successfully.' }));
      await refresh();
    } catch (err) {
      toast.error(t('profile.cancelFailed', { defaultValue: 'Failed to cancel subscription.' }));
    } finally {
      setBusy(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const subStatus = searchParams.get('sub_status');
    const token = searchParams.get('token');
    if (subStatus === 'success' && token) {
      const capture = async () => {
        setBusy(true);
        try {
          await api.captureSubscription(token);
          toast.success(t('profile.captureSuccess', { defaultValue: 'Subscription activated successfully! Welcome to DressApp Pro.' }));
          await refresh();
          searchParams.delete('sub_status');
          searchParams.delete('token');
          setSearchParams(searchParams);
        } catch (err) {
          toast.error(t('profile.captureFailed', { defaultValue: 'Error activating subscription.' }));
        } finally {
          setBusy(false);
        }
      };
      capture();
    } else if (subStatus === 'cancel') {
      toast.info(t('profile.checkoutCancelled', { defaultValue: 'Subscription checkout cancelled.' }));
      searchParams.delete('sub_status');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, refresh]);

  return (
    <AccordionItem
      value="subscription"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(47_95%_90%)] text-[hsl(47_95%_40%)] dark:bg-[hsl(47_30%_18%)] dark:text-[hsl(47_95%_70%)] shrink-0 transition-transform duration-200">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.subscription', { defaultValue: 'Subscription & Limits' })}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {userTier !== 'free'
                ? t('profile.subActiveSummary', { defaultValue: 'Active: {{plan}} plan (Expires: {{date}})', plan: userTier.toUpperCase(), date: expiresAt })
                : t('profile.subFreeSummary', { defaultValue: 'Free Plan: {{count}} / {{capacity}} items used', count: closetCount, capacity: capacity })
              }
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-4 pt-3 pb-0 mt-3">
        {userTier !== 'free' ? (
          <div className="space-y-3 text-start">
            <div className="p-4 rounded-[12px] border border-[hsl(47_95%_80%)] bg-[hsl(47_95%_97%)] dark:bg-[hsl(47_30%_12%)] dark:border-[hsl(47_30%_25%)] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-dark-brand text-[14px] flex items-center gap-1.5 mb-1">
                  <Crown className="h-4 w-4 text-[hsl(47_95%_50%)]" /> {t('profile.planTitle', { defaultValue: 'DressApp {{tier}} ({{plan}})', tier: userTier.toUpperCase(), plan: planType.toUpperCase() })}
                </h4>
                <p className="text-xs text-text-brand font-semibold">
                  {t('profile.renewalDate', { defaultValue: 'Renewal date: {{date}}', date: expiresAt })}
                </p>
              </div>
              <Badge className="bg-[hsl(47_95%_45%)] text-white hover:!bg-dark-brand dark:bg-[hsl(47_95%_35%)]">{t('profile.statusActive', { defaultValue: 'Active' })}</Badge>
            </div>
            <p className="text-[12px] text-text-brand font-semibold italic">
              {userTier === 'professional'
                ? t('profile.professionalPlanBenefits', { defaultValue: 'You have unlimited closet slots, unlimited daily requests, full marketplace access, and active ad campaign management.' })
                : t('profile.managerPlanBenefits', { defaultValue: 'You have unlimited closet slots, unlimited daily requests, and full marketplace access.' })}
            </p>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-xl"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('profile.cancelSubBtn', { defaultValue: 'Cancel Subscription' })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-start">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-dark-brand font-medium mb-1">
                <span>{t('profile.closetCapacity', { defaultValue: 'Closet Capacity' })}</span>
                <span>{t('profile.closetCapacityItems', { defaultValue: '{{count}} / {{capacity}} items', count: closetCount, capacity: capacity })}</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, (closetCount / capacity) * 100)}%` }}
                />
              </div>
              {closetCount >= capacity && (
                <p className="text-xs text-destructive font-medium mt-1">
                  {t('profile.closetLimitWarning', { defaultValue: 'You have reached your closet limit. Upgrade to add more garments!' })}
                </p>
              )}
            </div>
            <Separator className="my-2" />
            <div className="flex flex-col gap-4 pt-1">
              <Link
                to="/pricing#tiers"
                className="flex-1 flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-secondary/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div className="text-start">
                    <span className="font-semibold text-sm block text-dark-brand">
                      {t('profile.selectYourPlan', { defaultValue: 'Select your plan' })}
                    </span>
                    <span className="text-xs text-text-brand block mt-0.5">
                      {t('profile.selectYourPlanDesc', { defaultValue: 'Choose a monthly or annual subscription tier.' })}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand flex items-center gap-1 whitespace-nowrap">
                  {t('profile.viewTiers', { defaultValue: 'View Plans' })} &rarr;
                </span>
              </Link>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
