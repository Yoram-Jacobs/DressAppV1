import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
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

  const currentPlan = pricingData?.pricing_plan?.plan_type || 'free';
  const dailyUsed = pricingData?.credits?.ai_daily_used || 0;
  const isFree = currentPlan === 'free';

  // Determine display state based on quota status
  let quotaVariant = 'success';
  let quotaTitle = t('pricing.alerts.all_set', { defaultValue: 'All Set' });
  let needsUpgradeLink = false;

  if (!quotaStatus.can_proceed) {
    quotaVariant = 'danger';
    quotaTitle = t('pricing.alerts.exhausted', { defaultValue: 'Limit Reached' });
    needsUpgradeLink = true;
  }

  return (
    <div className="space-y-6">
      {/* Quota Status Alert Banner */}
      {!quotaStatus.can_proceed && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-rose-50/70 border-rose-100 text-rose-950 dark:bg-rose-950/20 dark:border-rose-950/40 dark:text-rose-200"
        >
          <div className="flex gap-3">
            <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0 text-rose-600" />
            <div>
              <h4 className="text-sm font-bold">{quotaTitle}</h4>
              <p className="text-xs opacity-90 mt-1">{quotaStatus.message || t('pricing.limitReachedMsg', { defaultValue: 'Daily AI operation limit of 10 requests reached. Please upgrade to continue.' })}</p>
            </div>
          </div>
          {needsUpgradeLink && (
            <a href="#tiers" className="shrink-0 w-full sm:w-auto">
              <Button size="sm" variant="destructive" className="w-full text-xs rounded-xl">
                {t('pricing.upgradeLinkBtn', { defaultValue: 'Upgrade Plan' })}
                <ArrowRight className="h-3 w-3 ms-1" />
              </Button>
            </a>
          )}
        </motion.div>
      )}

      {/* Usage Statistics */}
      {isFree && (
        <section data-testid="pricing-usage-section">
          <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            {t('pricing.usageStatsHeader', { defaultValue: 'Daily Processing Limits' })}
          </h2>

          <Card className="rounded-[calc(var(--radius)+6px)] border-border bg-card shadow-[var(--shadow-sm)] p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-baseline mb-2 text-xs font-body font-semibold">
                <span className="text-muted-foreground">{t('pricing.dailyUsed', { defaultValue: 'Daily limit used' })}</span>
                <span className="text-primary">{dailyUsed} / 10 requests</span>
              </div>
              <Progress 
                value={Math.min(100, (dailyUsed / 10) * 100)} 
                className="h-2 rounded-full"
                indicatorClassName="bg-[hsl(var(--accent))]"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('pricing.freeUsageNotice', { defaultValue: 'As a member of the Free tier, you can perform up to 10 AI operations per day. Upgrade to Manager or Professional for unlimited access.' })}
              </p>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
