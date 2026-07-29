import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { 
  Check, 
  Coins, 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Pricing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [pricingData, setPricingData] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAnnual, setIsAnnual] = useState(false);

  // Fetch comprehensive pricing information and quota status on mount
  useEffect(() => {
    const fetchPricingData = async () => {
      try {
        const pricingRes = await api.getPricingInfo();
        setPricingData(pricingRes);
        
        const quotaRes = await api.getQuotaStatus();
        setQuotaStatus(quotaRes);
      } catch (err) {
        console.error('Failed to fetch pricing data:', err);
        setError('Failed to load pricing information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPricingData();
  }, []);

  // Set up polling interval for quota updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const quotaRes = await api.getQuotaStatus();
        setQuotaStatus(quotaRes);
      } catch (err) {
        console.warn('Failed to refresh quota status:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {t('common.loading', { defaultValue: 'Loading pricing plans...' })}
        </p>
      </div>
    );
  }

  if (error || !pricingData) {
    return (
      <div className="max-w-md mx-auto my-12 px-6 py-8 text-center bg-rose-50/50 border border-rose-100 rounded-2xl">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-rose-950 mb-2">{t('common.error', { defaultValue: 'Error' })}</h3>
        <p className="text-sm text-rose-800/80 mb-6">{error || 'Failed to load pricing information.'}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-rose-200 hover:bg-rose-50">
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    );
  }

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

  const currentPlanName = pricingData?.pricing_plan?.plan_type || 'free';

  // Helper to calculate price depending on billing cycle
  const getDisplayPrice = (tier) => {
    if (tier.price === 0) return { priceStr: '$0', subStr: '' };
    const monthlyPrice = tier.price / 100;
    if (isAnnual) {
      const discountedPrice = (monthlyPrice * 0.8).toFixed(2);
      return { 
        priceStr: `$${discountedPrice}`, 
        subStr: t('pricing.billedAnnually', { defaultValue: 'billed annually' }) 
      };
    }
    return { 
      priceStr: `$${monthlyPrice.toFixed(2)}`, 
      subStr: t('pricing.billedMonthly', { defaultValue: 'billed monthly' }) 
    };
  };

  return (
    <div className="relative min-h-screen pb-[calc(env(safe-area-inset-bottom)+88px)] px-4 sm:px-6 max-w-6xl mx-auto overflow-hidden">
      {/* Visual background wash */}
      <div 
        className="absolute top-0 inset-x-0 h-[600px] pointer-events-none opacity-50 dark:opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(900px circle at 15% 10%, rgba(31,111,107,0.14), transparent 55%),
            radial-gradient(700px circle at 85% 5%, rgba(232,96,60,0.10), transparent 50%)
          `
        }}
      />

      {/* Noise overlay on hero section */}
      <div className="absolute top-0 inset-x-0 h-[300px] pointer-events-none opacity-[0.04] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-transparent" />

      {/* Header section */}
      <div className="relative text-center pt-8 pb-10 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-accent/10 text-accent border border-accent/25 mb-4">
          <Sparkles className="h-3 w-3 animate-pulse" />
          {t('pricing.membershipTitle', { defaultValue: 'DressApp Club' })}
        </span>
        <h1 className="text-4xl sm:text-5xl font-display tracking-tight text-primary mb-4">
          {t('pricing.title', { defaultValue: 'Pricing & Credit Plans' })}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-body leading-relaxed">
          {t('pricing.subtitle', { defaultValue: 'Choose the tier that fits your style. Upgrade or top up at any time.' })}
        </p>

        {/* Toggle Switch */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${!isAnnual ? 'text-primary' : 'text-muted-foreground'}`}>
            {t('pricing.monthlyBilling', { defaultValue: 'Monthly' })}
          </span>
          
          <button
            type="button"
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative h-6 w-12 bg-secondary rounded-full border border-border p-0.5 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-colors duration-200"
            data-testid="billing-cycle-toggle"
            aria-label="Toggle billing cycle"
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="h-4 w-4 bg-[hsl(var(--accent))] rounded-full shadow-sm"
              animate={{ x: isAnnual ? 24 : 0 }}
            />
          </button>

          <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAnnual ? 'text-primary' : 'text-muted-foreground'}`}>
            {t('pricing.annualBilling', { defaultValue: 'Annual' })}
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(232,96,60,0.10)] text-[rgb(232,96,60)] border border-[rgba(232,96,60,0.20)]">
              {t('pricing.savePercent', { defaultValue: '-20%' })}
            </span>
          </span>
        </div>
      </div>

      {/* Quota Status Alert Banner */}
      {quotaStatus.status && quotaStatus.status !== 'normal' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
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

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-stretch" data-testid="pricing-tiers-grid">
        {pricingData.pricing_tiers.map((tier, index) => {
          const isPro = tier.name.toLowerCase() === 'pro';
          const isCurrent = currentPlanName.toLowerCase() === tier.name.toLowerCase();
          const { priceStr, subStr } = getDisplayPrice(tier);

          return (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="h-full"
            >
              <Card 
                className={`relative flex flex-col h-full rounded-[calc(var(--radius)+6px)] overflow-hidden transition-all duration-200 border bg-card ${
                  isPro 
                    ? 'border-[hsl(var(--accent))] shadow-[var(--shadow-sm)] md:scale-[1.03] z-10' 
                    : 'border-border'
                }`}
                data-testid={`tier-card-${tier.name.toLowerCase()}`}
              >
                {/* Popular ribbon */}
                {isPro && (
                  <div className="absolute top-4 end-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[rgba(232,96,60,0.12)] text-[rgb(232,96,60)] border border-[rgba(232,96,60,0.25)]">
                      {t('pricing.popular', { defaultValue: 'Most Popular' })}
                    </span>
                  </div>
                )}

                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-display uppercase tracking-wider">{tier.name}</CardTitle>
                  <CardDescription className="text-xs mt-1 min-h-[32px] font-body">
                    {tier.name === 'Free' && t('pricing.freeDesc', { defaultValue: 'Perfect for exploring and digitalizing your basic closet.' })}
                    {tier.name === 'Pro' && t('pricing.proDesc', { defaultValue: 'The optimal stylist experience for true fashion lovers.' })}
                    {tier.name === 'Business' && t('pricing.businessDesc', { defaultValue: 'Ultimate limits and premium branding features for specialists.' })}
                  </CardDescription>
                  
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight font-body">{priceStr}</span>
                    <span className="text-xs text-muted-foreground font-semibold">{tier.price > 0 ? '/mo' : ''}</span>
                  </div>
                  {subStr && <p className="text-[10px] text-muted-foreground mt-0.5">{subStr}</p>}
                </CardHeader>

                <CardContent className="p-6 pt-0 flex-1 flex flex-col">
                  <div className="border-t border-border/80 my-4" />
                  
                  <ul className="space-y-3 flex-1 font-body text-xs text-foreground/90">
                    <li className="flex items-start gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
                      </div>
                      <span>
                        <strong>{tier.credits}</strong> {t('pricing.features.creditsDesc', { defaultValue: 'Credits included' })}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
                      </div>
                      <span>{t('pricing.features.dailyDesc', { defaultValue: 'Daily limit: {{count}} ops', count: tier.ai_daily_limit })}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
                      </div>
                      <span>{t('pricing.features.monthlyDesc', { defaultValue: 'Monthly limit: {{count}} ops', count: tier.ai_monthly_limit })}</span>
                    </li>
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="h-4 w-4 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {isCurrent ? (
                      <Button variant="secondary" className="w-full rounded-xl cursor-not-allowed opacity-80" disabled data-testid={`tier-select-current-${tier.name.toLowerCase()}`}>
                        <CheckCircle2 className="h-4 w-4 me-1.5 text-accent" />
                        {t('pricing.currentPlan', { defaultValue: 'Your Current Plan' })}
                      </Button>
                    ) : (
                      <Link to="/subscription/upgrade" className="w-full">
                        <Button 
                          variant={isPro ? 'default' : 'outline'} 
                          className={`w-full rounded-xl hover:translate-y-[-1px] active:scale-[0.98] transition-all duration-150 ${
                            isPro ? 'bg-primary text-primary-foreground shadow' : 'border-border'
                          }`}
                          data-testid={`tier-select-${tier.name.toLowerCase()}`}
                        >
                          {tier.price > 0 
                            ? t('pricing.upgradePlan', { defaultValue: 'Upgrade Plan' }) 
                            : t('pricing.selectPlan', { defaultValue: 'Select This Plan' })}
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Current Balance Section */}
      <section className="mb-12 relative" data-testid="pricing-balance-section">
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
      <section className="mb-12" data-testid="pricing-usage-section">
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

      {/* Credit Pack Purchases (Swing-tag styling) */}
      <section className="mb-12" data-testid="pricing-credit-packs-section">
        <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-2 flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          {t('pricing.topUpHeader', { defaultValue: 'Purchase Additional Credits' })}
        </h2>
        <p className="text-xs text-muted-foreground font-body mb-8">
          {t('pricing.topUpSub', { defaultValue: 'Paid credit packs never expire and are consumed after monthly credits are depleted.' })}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pricingData.credit_packs.map((pack) => (
            <motion.div
              key={pack.amount}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              {/* Premium Swing Tag Design */}
              <div className="relative bg-card border border-border shadow-[var(--shadow-sm)] p-5 rounded-[calc(var(--radius)+6px)] flex flex-col items-center text-center group overflow-hidden">
                {/* Hanger loop simulator */}
                <div className="absolute top-0 inset-x-0 flex justify-center mt-[-6px]">
                  <div className="h-3 w-3 rounded-full border border-border/80 bg-background" />
                </div>
                
                <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground mt-2 mb-3">
                  {t('pricing.packCategory', { defaultValue: 'AI TOP-UP' })}
                </span>
                
                <h3 className="text-2xl font-bold font-body tracking-tight text-accent">
                  {pack.amount}
                </h3>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-4">
                  {t('pricing.creditsLabel', { defaultValue: 'Credits' })}
                </span>

                <div className="text-xl font-bold font-body text-primary mb-5">
                  ${(pack.price_cents / 100).toFixed(2)}
                </div>

                <Link to={`/pricing/purchase?pack_size=${pack.amount}`} className="w-full">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full text-xs rounded-xl font-semibold border-accent/30 text-accent hover:bg-accent/5 focus-visible:shadow-[var(--shadow-focus)] active:scale-[0.98] transition-all"
                    data-testid={`buy-pack-${pack.amount}`}
                  >
                    {t('pricing.buyNow', { defaultValue: 'Buy Now' })}
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Compare Features Flat Table */}
      <section className="mb-12" data-testid="pricing-compare-section">
        <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-6 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-accent" />
          {t('pricing.featureComparisonHeader', { defaultValue: 'Compare Plan Features' })}
        </h2>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-sm)]">
          <Table>
            <TableHeader className="bg-secondary/40 font-body">
              <TableRow className="border-border">
                <TableHead className="w-[30%] text-xs font-semibold py-4 text-muted-foreground">
                  {t('pricing.compareFeatureCol', { defaultValue: 'Features' })}
                </TableHead>
                <TableHead className="text-center text-xs font-semibold py-4 text-primary">Free</TableHead>
                <TableHead className="text-center text-xs font-semibold py-4 text-accent font-bold">Pro</TableHead>
                <TableHead className="text-center text-xs font-semibold py-4 text-primary">Business</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs font-body divide-y divide-border">
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.credits', { defaultValue: 'AI Credits / Month' })}
                </TableCell>
                <TableCell className="text-center py-3.5">10</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">100</TableCell>
                <TableCell className="text-center py-3.5">300</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.dailyLimit', { defaultValue: 'Daily processing limit' })}
                </TableCell>
                <TableCell className="text-center py-3.5">20</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">200</TableCell>
                <TableCell className="text-center py-3.5">500</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.monthlyLimit', { defaultValue: 'Monthly processing limit' })}
                </TableCell>
                <TableCell className="text-center py-3.5">100</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">1,000</TableCell>
                <TableCell className="text-center py-3.5">3,000</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.uploads', { defaultValue: 'Image uploads capacity' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-muted-foreground">
                  {t('pricing.uploadsTiers.limited', { defaultValue: 'Standard' })}
                </TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">
                  {t('pricing.uploadsTiers.unlimited', { defaultValue: 'Unlimited' })}
                </TableCell>
                <TableCell className="text-center py-3.5 font-semibold">
                  {t('pricing.uploadsTiers.unlimited', { defaultValue: 'Unlimited' })}
                </TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.customApiKey', { defaultValue: 'Custom API key support' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold">✕</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">✓</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold">✓</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.support', { defaultValue: 'Support priority' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-muted-foreground">
                  {t('pricing.supportTiers.community', { defaultValue: 'Community' })}
                </TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">
                  {t('pricing.supportTiers.priority', { defaultValue: 'Priority' })}
                </TableCell>
                <TableCell className="text-center py-3.5 font-semibold">
                  {t('pricing.supportTiers.dedicated', { defaultValue: 'Dedicated' })}
                </TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.branding', { defaultValue: 'Custom branding options' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold">✕</TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold bg-accent/5">✕</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold">✓</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}