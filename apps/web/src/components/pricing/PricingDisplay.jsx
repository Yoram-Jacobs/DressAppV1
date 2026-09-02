import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Check, 
  CheckCircle2,
  Loader2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const featureKeys = {
  "Up to 50 closet items": "pricing.features.closetLimitFree",
  "Up to 10 requests per day": "pricing.features.dailyLimitFree",
  "Community support": "pricing.features.communitySupport",
  "Unlimited closet items": "pricing.features.unlimitedCloset",
  "Unlimited daily requests": "pricing.features.unlimitedOps",
  "Marketplace selling & renting": "pricing.features.marketplaceAccess",
  "Trend Scout": "pricing.features.trendScout",
  "Scheduler & push notifications": "pricing.features.schedulerAccess",
  "Priority support": "pricing.features.prioritySupport",
  "Ad Campaigns included": "pricing.features.campaignsAccess",
  "Dedicated support": "pricing.features.dedicatedSupport"
};

export function PricingDisplay({ 
  pricingData, 
  currentPlanName, 
  isAnnual, 
  setIsAnnual, 
  subBusy, 
  handleUpgrade 
}) {
  const { t } = useTranslation();

  const getLocalizedFeature = (feature) => {
    const key = featureKeys[feature];
    return key ? t(key, { defaultValue: feature }) : feature;
  };

  const getDisplayPrice = (tier) => {
    if (tier.name.toLowerCase() === 'free') return { priceStr: '$0', subStr: '' };
    if (tier.name.toLowerCase() === 'manager') {
      return { 
        priceStr: isAnnual ? '$50' : '$5', 
        subStr: isAnnual 
          ? t('pricing.billedAnnually', { price: '50', defaultValue: 'billed annually ($50)' }) 
          : t('pricing.billedMonthly', { price: '5', defaultValue: 'billed monthly ($5)' }) 
      };
    }
    if (tier.name.toLowerCase() === 'professional') {
      return { 
        priceStr: isAnnual ? '$100' : '$10', 
        subStr: isAnnual 
          ? t('pricing.billedAnnually', { price: '100', defaultValue: 'billed annually ($100)' }) 
          : t('pricing.billedMonthly', { price: '10', defaultValue: 'billed monthly ($10)' }) 
      };
    }
    return { priceStr: '$0', subStr: '' };
  };

  return (
    <div id="tiers" className="space-y-12">
      {/* Header section with toggle */}
      <div className="relative text-center pt-8 pb-10 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-accent/10 text-accent border border-accent/25 mb-4">
          <Sparkles className="h-3 w-3 animate-pulse" />
          {t('pricing.membershipTitle', { defaultValue: 'DressApp Club' })}
        </span>
        <h1 className="text-4xl sm:text-5xl font-display tracking-tight text-primary mb-4">
          {t('pricing.title', { defaultValue: 'Membership Pricing Plans' })}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-body leading-relaxed">
          {t('pricing.subtitle', { defaultValue: 'Choose the plan that fits your style. Upgrade, downgrade, or cancel at any time.' })}
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

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch" data-testid="pricing-tiers-grid">
        {pricingData.pricing_tiers.map((tier, index) => {
          const isPro = tier.name.toLowerCase() === 'professional';
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
                  <CardTitle className="text-xl font-display uppercase tracking-wider">
                    {t('pricing.tier.' + tier.name.toLowerCase(), { defaultValue: tier.name })}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 min-h-[32px] font-body">
                    {tier.name.toLowerCase() === 'free' && t('pricing.freeDesc', { defaultValue: 'Perfect for exploring and digitalizing your basic closet.' })}
                    {tier.name.toLowerCase() === 'manager' && t('pricing.managerDesc', { defaultValue: 'Optimal stylist plan with no limitations on garments or AI operations.' })}
                    {tier.name.toLowerCase() === 'professional' && t('pricing.professionalDesc', { defaultValue: 'Unlimited resources with expert-focused campaign creator slots.' })}
                  </CardDescription>
                  
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight font-body">{priceStr}</span>
                    <span className="text-xs text-muted-foreground font-semibold">{tier.price > 0 ? (isAnnual ? t('pricing.perYear', { defaultValue: '/yr' }) : t('pricing.perMonth', { defaultValue: '/mo' })) : ''}</span>
                  </div>
                  {subStr && <p className="text-[10px] text-muted-foreground mt-0.5">{subStr}</p>}
                </CardHeader>

                <CardContent className="p-6 pt-0 flex-1 flex flex-col">
                  <div className="border-t border-border/80 my-4" />
                  
                  <ul className="space-y-3 flex-1 font-body text-xs text-foreground/90">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="h-4 w-4 rounded-full bg-[hsl(var(--accent))]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
                        </div>
                        <span>{getLocalizedFeature(feature)}</span>
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
                      <Button
                        onClick={() => handleUpgrade(tier.name)}
                        disabled={subBusy}
                        variant={isPro ? 'default' : 'outline'}
                        className={`w-full rounded-xl hover:translate-y-[-1px] active:scale-[0.98] transition-all duration-150 ${
                          isPro ? 'bg-primary text-primary-foreground shadow' : 'border-border'
                        }`}
                        data-testid={`tier-select-${tier.name.toLowerCase()}`}
                      >
                        {subBusy ? (
                          <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                        ) : (
                          <>
                            {tier.price > 0
                              ? t('pricing.upgradePlan', { defaultValue: 'Upgrade Plan' })
                              : t('pricing.selectPlan', { defaultValue: 'Select This Plan' })}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Compare Features Flat Table */}
      <section data-testid="pricing-compare-section">
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
                <TableHead className="text-center text-xs font-semibold py-4 text-primary">
                  {t('pricing.tier.free', { defaultValue: 'Free' })}
                </TableHead>
                <TableHead className="text-center text-xs font-semibold py-4 text-primary">
                  {t('pricing.tier.manager', { defaultValue: 'Manager' })}
                </TableHead>
                <TableHead className="text-center text-xs font-semibold py-4 text-accent font-bold">
                  {t('pricing.tier.professional', { defaultValue: 'Professional' })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs font-body divide-y divide-border">
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.closetLimit', { defaultValue: 'Closet Items Capacity' })}
                </TableCell>
                <TableCell className="text-center py-3.5">50</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-primary">{t('pricing.unlimited', { defaultValue: 'Unlimited' })}</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">{t('pricing.unlimited', { defaultValue: 'Unlimited' })}</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.dailyLimit', { defaultValue: 'Daily AI operation limit' })}
                </TableCell>
                <TableCell className="text-center py-3.5">{t('pricing.tenRequests', { defaultValue: '10 requests' })}</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-primary">{t('pricing.unlimited', { defaultValue: 'Unlimited' })}</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">{t('pricing.unlimited', { defaultValue: 'Unlimited' })}</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.marketplace', { defaultValue: 'Marketplace options' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-muted-foreground">{t('pricing.swapDonateOnly', { defaultValue: 'Swap & Donate only' })}</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-primary">{t('pricing.rentSellIncluded', { defaultValue: 'Rent & Sell included' })}</TableCell>
                <TableCell className="text-center py-3.5 font-semibold text-accent bg-accent/5">{t('pricing.rentSellIncluded', { defaultValue: 'Rent & Sell included' })}</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.trendScout', { defaultValue: 'Trend Scout access' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold">✕</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold">✓</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold bg-accent/5">✓</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.scheduler', { defaultValue: 'Schedule & push notifications' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold">✕</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold">✓</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold bg-accent/5">✓</TableCell>
              </TableRow>
              <TableRow className="border-border/60">
                <TableCell className="font-semibold py-3.5 text-muted-foreground">
                  {t('pricing.features.campaigns', { defaultValue: 'Ad Campaigns creation' })}
                </TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold">✕</TableCell>
                <TableCell className="text-center py-3.5 text-rose-500 font-bold">✕</TableCell>
                <TableCell className="text-center py-3.5 text-accent font-bold bg-accent/5">✓</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
