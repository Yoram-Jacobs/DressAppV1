import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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

// Same visual language as the Transactions page status badges.
function FeatureFlag({ included }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={`text-[11px] gap-1 w-fit mx-auto ${included
          ? 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
          : 'bg-rose-100 text-rose-900 border-rose-200'
        }`}
    >
      {included ? (
        <>
          <CheckCircle2 className="h-3 w-3" />
          {t('pricing.included', { defaultValue: 'Included' })}
        </>
      ) : (
        <>
          <XCircle className="h-3 w-3" />
          {t('pricing.notIncluded', { defaultValue: 'Not included' })}
        </>
      )}
    </Badge>
  );
}

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

  // Rows for the comparison table. Keeping this data-driven (instead of
  // hand-rolled JSX per row like before) makes it trivial to add/remove a
  // feature row without touching markup.
  const COMPARE_ROWS = [
    {
      label: t('pricing.features.closetLimit', { defaultValue: 'Closet Items Capacity' }),
      free: '50',
      manager: t('pricing.unlimited', { defaultValue: 'Unlimited' }),
      professional: t('pricing.unlimited', { defaultValue: 'Unlimited' }),
      type: 'text',
    },
    {
      label: t('pricing.features.dailyLimit', { defaultValue: 'Daily AI operation limit' }),
      free: t('pricing.tenRequests', { defaultValue: '10 requests' }),
      manager: t('pricing.unlimited', { defaultValue: 'Unlimited' }),
      professional: t('pricing.unlimited', { defaultValue: 'Unlimited' }),
      type: 'text',
    },
    {
      label: t('pricing.features.marketplace', { defaultValue: 'Marketplace options' }),
      free: t('pricing.swapDonateOnly', { defaultValue: 'Swap & Donate only' }),
      manager: t('pricing.rentSellIncluded', { defaultValue: 'Rent & Sell included' }),
      professional: t('pricing.rentSellIncluded', { defaultValue: 'Rent & Sell included' }),
      type: 'text',
    },
    {
      label: t('pricing.features.trendScout', { defaultValue: 'Trend Scout access' }),
      free: false,
      manager: true,
      professional: true,
      type: 'flag',
    },
    {
      label: t('pricing.features.scheduler', { defaultValue: 'Schedule & push notifications' }),
      free: false,
      manager: true,
      professional: true,
      type: 'flag',
    },
    {
      label: t('pricing.features.campaigns', { defaultValue: 'Ad Campaigns creation' }),
      free: false,
      manager: false,
      professional: true,
      type: 'flag',
    },
  ];

  return (
    <div id="tiers" className="space-y-4">
      {/* Header section with toggle */}
      <div className="relative p-4 bg-white rounded-full w-fit">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${!isAnnual ? 'text-primary' : 'text-text-brand'}`}>
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
          <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAnnual ? 'text-primary' : 'text-text-brand'}`}>
            {t('pricing.annualBilling', { defaultValue: 'Annual' })}
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(232,96,60,0.10)] text-[rgb(232,96,60)] border border-[rgba(232,96,60,0.20)]">
              {t('pricing.savePercent', { defaultValue: '-20%' })}
            </span>
          </span>
        </div>
      </div>
      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch" data-testid="pricing-tiers-grid">
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
                className={`relative flex flex-col h-full rounded-[20px] shadow-sm overflow-hidden transition-all duration-200 border bg-white ${isPro
                    ? 'border-primary-brand z-10'
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
                <CardHeader className="bg-yellow-shadow p-5">
                  <CardTitle className="text-[20px] font-bold text-primary-brand">
                    {t('pricing.tier.' + tier.name.toLowerCase(), { defaultValue: tier.name })}
                  </CardTitle>
                  <CardDescription className="text-[14px] font-semibold text-text-brand italic">
                    {tier.name.toLowerCase() === 'free' && t('pricing.freeDesc', { defaultValue: 'Perfect for exploring and digitalizing your basic closet.' })}
                    {tier.name.toLowerCase() === 'manager' && t('pricing.managerDesc', { defaultValue: 'Optimal stylist plan with no limitations on garments or AI operations.' })}
                    {tier.name.toLowerCase() === 'professional' && t('pricing.professionalDesc', { defaultValue: 'Unlimited resources with expert-focused campaign creator slots.' })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className='mb-4'>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[20px] text-dark-brand font-bold">{priceStr}</span>
                      <span className="text-[10px] text-text-brand font-semibold">{tier.price > 0 ? (isAnnual ? t('pricing.perYear', { defaultValue: '/yr' }) : t('pricing.perMonth', { defaultValue: '/mo' })) : ''}</span>
                    </div>
                    {subStr && <p className="text-[12px] text-text-brand font-semibold">{subStr}</p>}
                  </div>
                  <ul className="space-y-3 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="h-4 w-4 rounded-full bg-primary-shadow flex items-center justify-center shrink-0">
                          <Check className="h-2.5 w-2.5 text-primary-brand" />
                        </div>
                        <span className='text-text-brand text-[11px] font-semibold'>{getLocalizedFeature(feature)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {isCurrent ? (
                      <Button variant="secondary" className="w-full cursor-not-allowed opacity-80" disabled data-testid={`tier-select-current-${tier.name.toLowerCase()}`}>
                        <CheckCircle2 className="h-4 w-4 text-primary-brand" />
                        {t('pricing.currentPlan', { defaultValue: 'Your Current Plan' })}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(tier.name)}
                        disabled={subBusy}
                        variant={isPro ? 'default' : 'outline'}
                        className={`w-full ${isPro ? 'bg-primary-brand text-white' : 'border-border'
                          }`}
                        data-testid={`tier-select-${tier.name.toLowerCase()}`}
                      >
                        {subBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
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
      {/* Compare Features Table — restyled to match the Transactions page table:
          rounded bordered wrapper, bg-primary-shadow header row, subtle row
          hover, and status-style badges for included/excluded features. */}
      <section className="bg-white p-5 rounded-[12px] shadow-sm border border-border" data-testid="pricing-compare-section">
        <h2 className="text-[20px] font-bold text-dark-brand mb-6 flex items-center gap-2">
          <Sliders className="!h-4 !w-4 text-primary-brand" />
          {t('pricing.featureComparisonHeader', { defaultValue: 'Compare Plan Features' })}
        </h2>
        <div
          className="rounded-[12px] border border-border overflow-hidden overflow-x-auto"
          data-testid="pricing-compare-table"
        >
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-primary-shadow">
                <th className="text-left text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                  {t('pricing.compareFeatureCol', { defaultValue: 'Features' })}
                </th>
                <th className="text-center text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                  {t('pricing.tier.free', { defaultValue: 'Free' })}
                </th>
                <th className="text-center text-[12px] font-bold uppercase tracking-wide text-text-brand px-4 py-3">
                  {t('pricing.tier.manager', { defaultValue: 'Manager' })}
                </th>
                <th className="text-center text-[12px] font-bold uppercase tracking-wide text-primary-brand px-4 py-3">
                  {t('pricing.tier.professional', { defaultValue: 'Professional' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border last:border-0 hover:bg-black/[0.015] transition-colors align-middle"
                  data-testid="pricing-compare-row"
                >
                  <td className="px-4 py-4">
                    <span className="font-bold text-sm text-text-brand">{row.label}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {row.type === 'flag' ? (
                      <FeatureFlag included={row.free} />
                    ) : (
                      <span className="text-sm font-semibold text-text-brand">{row.free}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {row.type === 'flag' ? (
                      <FeatureFlag included={row.manager} />
                    ) : (
                      <span className="text-sm font-semibold text-text-brand">{row.manager}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center bg-primary-shadow/30">
                    {row.type === 'flag' ? (
                      <FeatureFlag included={row.professional} />
                    ) : (
                      <span className="text-sm font-bold text-primary-brand">{row.professional}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
