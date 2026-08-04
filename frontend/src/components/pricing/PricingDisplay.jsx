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
  "Basic AI operations": "pricing.features.basicOps",
  "Community support": "pricing.features.communitySupport",
  "Advanced AI operations": "pricing.features.advancedOps",
  "Priority support": "pricing.features.prioritySupport",
  "Unlimited uploads": "pricing.features.unlimitedUploads",
  "All Pro features": "pricing.features.allProFeatures",
  "Dedicated support": "pricing.features.dedicatedSupport",
  "API access": "pricing.features.apiAccess",
  "Custom branding": "pricing.features.customBranding"
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
    <div id="tiers" className="space-y-12">
      {/* Header section with toggle */}
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

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch" data-testid="pricing-tiers-grid">
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
                  <CardTitle className="text-xl font-display uppercase tracking-wider">
                    {t('pricing.tier.' + tier.name.toLowerCase(), { defaultValue: tier.name })}
                  </CardTitle>
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
                <TableHead className="text-center text-xs font-semibold py-4 text-accent font-bold">
                  {t('pricing.tier.pro', { defaultValue: 'Pro' })}
                </TableHead>
                <TableHead className="text-center text-xs font-semibold py-4 text-primary">
                  {t('pricing.tier.business', { defaultValue: 'Business' })}
                </TableHead>
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
