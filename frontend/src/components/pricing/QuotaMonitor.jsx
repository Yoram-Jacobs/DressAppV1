import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Coins, 
  TrendingUp, 
  ShieldAlert, 
  ArrowRight,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export function QuotaMonitor({ quotaStatus, pricingData }) {
  const { t } = useTranslation();

  // Determine display state based on quota status
  let quotaVariant = 'success';
  let quotaTitle = t('pricing.alerts.all_set', { defaultValue: 'All Set' });
  let needsPurchaseLink = false;

  switch (quotaStatus.status) {
    case 'soft_warning':
      quotaVariant = 'warning';
      quotaTitle = t('pricing.alerts.soft_warning', { defaultValue: 'Running Low' });
      needsPurchaseLink = true;
      break;
    case 'hard_limit':
      quotaVariant = 'danger';
      quotaTitle = t('pricing.alerts.hard_limit', { defaultValue: 'Credits Exhausted' });
      needsPurchaseLink = true;
      break;
    case 'exhausted':
      quotaVariant = 'danger';
      quotaTitle = t('pricing.alerts.exhausted', { defaultValue: 'No Credits' });
      needsPurchaseLink = true;
      break;
  }

  return (
    <div className="space-y-12">
      {/* Quota Status Alert Banner */}
      {quotaStatus.status && quotaStatus.status !== 'normal' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            quotaVariant === 'danger' 
              ? 'bg-rose-50/70 border-rose-100 text-rose-950 dark:bg-rose-950/20 dark:border-rose-950/40 dark:text-rose-200' 
              : 'bg-amber-50/70 border-amber-100 text-amber-950 dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-200'
          }`}
        >
          <div className="flex gap-3">
            <ShieldAlert className={`h-5 w-5 mt-0.5 shrink-0 ${quotaVariant === 'danger' ? 'text-rose-600' : 'text-amber-600'}`} />
            <div>
              <h4 className="text-sm font-bold">{quotaTitle}</h4>
              <p className="text-xs opacity-90 mt-1">{quotaStatus.message}</p>
            </div>
          </div>
          {needsPurchaseLink && (
            <Link to="/pricing/purchase" className="shrink-0 w-full sm:w-auto" data-testid="pricing-alert-purchase-link">
              <Button size="sm" variant={quotaVariant === 'danger' ? 'destructive' : 'default'} className="w-full text-xs rounded-xl">
                {t('pricing.buyCreditsLink', { defaultValue: 'Top Up Credits' })}
                <ArrowRight className="h-3 w-3 ms-1" />
              </Button>
            </Link>
          )}
        </motion.div>
      )}

      {/* Current Balance Section */}
      <section className="relative" data-testid="pricing-balance-section">
        <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-6 flex items-center gap-2">
          <Coins className="h-5 w-5 text-accent" />
          {t('pricing.currentBalanceHeader', { defaultValue: 'Your Current Credits Balance' })}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free bucket */}
          <Card className="rounded-[calc(var(--radius)+6px)] border-border bg-card shadow-[var(--shadow-sm)]">
            <CardHeader className="p-5 pb-2">
              <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider mb-2">
                {t('pricing.freeCredits', { defaultValue: 'Free Credits' })}
              </Badge>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-body">{(pricingData.credits.free_credits_available || 0).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-muted-foreground font-body leading-relaxed min-h-[60px] flex flex-col justify-between">
              <p>{t('pricing.freeCreditsDesc', { defaultValue: 'Reset monthly based on plan tier. Expire in 30 days.' })}</p>
              {pricingData.credits.free_credits_expired > 0 && (
                <span className="text-amber-600 font-semibold mt-2 block">
                  ⚠️ {pricingData.credits.free_credits_expired.toLocaleString()} {t('pricing.expired', { defaultValue: 'expired' })}
                </span>
              )}
            </CardContent>
          </Card>

          {/* Paid bucket */}
          <Card className="rounded-[calc(var(--radius)+6px)] border-border bg-card shadow-[var(--shadow-sm)]">
            <CardHeader className="p-5 pb-2">
              <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider mb-2 border-accent/35 bg-accent/5 text-accent">
                {t('pricing.paidCredits', { defaultValue: 'Paid Credits' })}
              </Badge>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-body">{pricingData.credits.paid_credits.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-muted-foreground font-body leading-relaxed min-h-[60px]">
              <p>{t('pricing.paidCreditsDesc', { defaultValue: 'Bought in credit packs. These never expire and are consumed after monthly credits are exhausted.' })}</p>
            </CardContent>
          </Card>

          {/* Total Usable Card */}
          <Card className="rounded-[calc(var(--radius)+6px)] border-accent/20 bg-accent/5 shadow-md flex flex-col justify-between">
            <CardHeader className="p-5 pb-2">
              <span className="text-[10px] uppercase tracking-wider text-accent font-semibold block mb-2">
                {t('pricing.totalCredits', { defaultValue: 'Total Usable Credits' })}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold font-body text-accent">{pricingData.credits.total_credits.toLocaleString()}</span>
                <span className="text-xs text-accent font-semibold">credits</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0 flex justify-between items-center text-xs border-t border-accent/10 mt-4">
              <span className="text-muted-foreground font-body">{t('pricing.statusLabel', { defaultValue: 'Account Status:' })}</span>
              <span className="inline-flex items-center gap-1 font-bold text-accent">
                <Check className="h-3 w-3" />
                {quotaStatus.can_proceed 
                  ? t('pricing.readyToUse', { defaultValue: 'Ready to use' }) 
                  : t('pricing.requiresAction', { defaultValue: 'Action required' })}
              </span>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Usage Statistics */}
      <section data-testid="pricing-usage-section">
        <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" />
          {t('pricing.usageStatsHeader', { defaultValue: 'Credit Usage & Processing Limits' })}
        </h2>

        <Card className="rounded-[calc(var(--radius)+6px)] border-border bg-card shadow-[var(--shadow-sm)] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Monthly Progress */}
            <div>
              <div className="flex justify-between items-baseline mb-2 text-xs font-body font-semibold">
                <span className="text-muted-foreground">{t('pricing.monthlyUsed', { defaultValue: 'Monthly limit used' })}</span>
                <span className="text-primary">{pricingData.credits.ai_monthly_used} / {pricingData.credits.ai_monthly_limit} ops</span>
              </div>
              <Progress 
                value={Math.min(100, (pricingData.credits.ai_monthly_used / pricingData.credits.ai_monthly_limit) * 100)} 
                className="h-2 rounded-full"
                indicatorClassName="bg-[hsl(var(--accent))]"
              />
            </div>

            {/* Daily Progress */}
            <div>
              <div className="flex justify-between items-baseline mb-2 text-xs font-body font-semibold">
                <span className="text-muted-foreground">{t('pricing.dailyUsed', { defaultValue: 'Daily limit used' })}</span>
                <span className="text-primary">{pricingData.credits.ai_daily_used} / {pricingData.credits.ai_daily_limit} ops</span>
              </div>
              <Progress 
                value={Math.min(100, (pricingData.credits.ai_daily_used / pricingData.credits.ai_daily_limit) * 100)} 
                className="h-2 rounded-full"
                indicatorClassName="bg-[hsl(var(--accent))]"
              />
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
