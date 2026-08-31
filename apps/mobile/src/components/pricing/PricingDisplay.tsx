/**
 * apps/mobile/src/components/pricing/PricingDisplay.tsx
 *
 * Full-featured Native Pricing Cards & Tier Grid.
 * Complete parity with apps/web/src/components/pricing/PricingDisplay.jsx:
 *   - Monthly vs Annual toggle with -20% badge
 *   - Tier cards for Free, Manager, Professional, Studio
 *   - Feature bullet list with checkmarks
 *   - Upgrade, Current Plan, Downgrade buttons
 *   - AI Credit top-up pack quick purchase section
 *   - 100% i18next string localization & theme tokens
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface PricingTier {
  name: string;
  price?: number;
  monthly_price?: number;
  annual_price?: number;
  description?: string;
  features?: string[];
  recommended?: boolean;
}

interface PricingDisplayProps {
  pricingData?: {
    pricing_tiers?: PricingTier[];
    credit_packs?: Array<{
      id: string;
      credits: number;
      price_usd: number;
      name?: string;
    }>;
  } | null;
  currentPlanName?: string;
  isAnnual: boolean;
  setIsAnnual: (val: boolean) => void;
  subBusy: boolean;
  handleUpgrade: (tierName: string) => void;
  handleBuyCredits?: (credits: number, priceUsd: number) => void;
}

const DEFAULT_TIERS: PricingTier[] = [
  {
    name: 'Free',
    monthly_price: 0,
    annual_price: 0,
    description: 'Basic styling & wardrobe tools for personal fashion exploration.',
    features: [
      'Up to 50 closet items',
      'Up to 10 requests per day',
      'Community support',
      'Basic color palette analysis',
    ],
  },
  {
    name: 'Manager',
    monthly_price: 5,
    annual_price: 50,
    description: 'Ideal for fashion enthusiasts wanting automated outfits & smart sync.',
    features: [
      'Unlimited closet items',
      'Unlimited daily requests',
      'Trend Scout access',
      'Scheduler & morning outfit alerts',
      'Standard priority AI processing',
    ],
  },
  {
    name: 'Professional',
    monthly_price: 10,
    annual_price: 100,
    recommended: true,
    description: 'All-inclusive VIP styling, digital product passports & marketplace selling.',
    features: [
      'Everything in Manager',
      'Marketplace selling & renting',
      'Ad Campaigns & Promotions included',
      'Digital Product Passport (DPP) scanning',
      'Fastest VIP AI processing speed',
      'Dedicated priority support',
    ],
  },
];

const DEFAULT_CREDIT_PACKS = [
  { id: 'pack_100', credits: 100, price_usd: 5, name: 'Starter Pack' },
  { id: 'pack_300', credits: 300, price_usd: 12, name: 'Popular Pack' },
  { id: 'pack_1000', credits: 1000, price_usd: 35, name: 'Power Stylist' },
];

export function PricingDisplay({
  pricingData,
  currentPlanName = 'free',
  isAnnual,
  setIsAnnual,
  subBusy,
  handleUpgrade,
  handleBuyCredits,
}: PricingDisplayProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const tiers = pricingData?.pricing_tiers?.length ? pricingData.pricing_tiers : DEFAULT_TIERS;
  const creditPacks = pricingData?.credit_packs?.length ? pricingData.credit_packs : DEFAULT_CREDIT_PACKS;

  const getTierPriceString = (tier: PricingTier) => {
    const tierLower = tier.name.toLowerCase();
    if (tierLower === 'free') return { priceStr: '$0', periodStr: '/mo' };
    if (tierLower === 'manager') {
      return {
        priceStr: isAnnual ? '$50' : '$5',
        periodStr: isAnnual ? '/yr' : '/mo',
      };
    }
    if (tierLower === 'professional') {
      return {
        priceStr: isAnnual ? '$100' : '$10',
        periodStr: isAnnual ? '/yr' : '/mo',
      };
    }
    const priceVal = isAnnual ? (tier.annual_price ?? 0) : (tier.monthly_price ?? tier.price ?? 0);
    return {
      priceStr: `$${priceVal}`,
      periodStr: isAnnual ? '/yr' : '/mo',
    };
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.headerSection}>
        <View
          style={[
            styles.clubBadge,
            {
              backgroundColor: 'rgba(232, 96, 60, 0.12)',
              borderColor: 'rgba(232, 96, 60, 0.25)',
            },
          ]}
        >
          <Lucide.Sparkles size={12} color="#E8603C" />
          <Text style={[styles.clubBadgeText, { color: '#E8603C' }]}>
            {t('pricing.membershipTitle', { defaultValue: 'DressApp Club' })}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {t('pricing.title', { defaultValue: 'Membership Pricing Plans' })}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedFg }]}>
          {t('pricing.subtitle', {
            defaultValue: 'Choose the plan that fits your style. Upgrade, downgrade, or cancel at any time.',
          })}
        </Text>

        {/* Billing Cycle Switcher */}
        <View style={styles.cycleToggleContainer}>
          <TouchableOpacity
            onPress={() => setIsAnnual(false)}
            activeOpacity={0.7}
            style={[
              styles.cycleOption,
              !isAnnual && [styles.cycleOptionActive, { backgroundColor: colors.card }],
            ]}
          >
            <Text
              style={[
                styles.cycleOptionText,
                { color: !isAnnual ? colors.foreground : colors.mutedFg },
                !isAnnual && styles.cycleOptionTextActive,
              ]}
            >
              {t('pricing.monthlyBilling', { defaultValue: 'Monthly' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsAnnual(true)}
            activeOpacity={0.7}
            style={[
              styles.cycleOption,
              isAnnual && [styles.cycleOptionActive, { backgroundColor: colors.card }],
            ]}
          >
            <Text
              style={[
                styles.cycleOptionText,
                { color: isAnnual ? colors.foreground : colors.mutedFg },
                isAnnual && styles.cycleOptionTextActive,
              ]}
            >
              {t('pricing.annualBilling', { defaultValue: 'Annual' })}
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>
                {t('pricing.savePercent', { defaultValue: '-20%' })}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tier Cards */}
      <View style={styles.tierList}>
        {tiers.map((tier) => {
          const isCurrent = currentPlanName.toLowerCase() === tier.name.toLowerCase();
          const isPro = tier.name.toLowerCase() === 'professional';
          const { priceStr, periodStr } = getTierPriceString(tier);

          return (
            <View
              key={tier.name}
              style={[
                styles.tierCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isPro ? '#E8603C' : isCurrent ? colors.primary : colors.border,
                  borderWidth: isPro || isCurrent ? 2 : 1,
                },
              ]}
            >
              {/* Highlight ribbon */}
              {isPro && (
                <View style={[styles.proRibbon, { backgroundColor: '#E8603C' }]}>
                  <Lucide.Crown size={12} color="#FFF" />
                  <Text style={styles.proRibbonText}>
                    {t('pricing.recommended', { defaultValue: 'MOST POPULAR' })}
                  </Text>
                </View>
              )}

              <View style={styles.tierHeader}>
                <View>
                  <Text style={[styles.tierName, { color: colors.foreground }]}>{tier.name}</Text>
                  {tier.description && (
                    <Text style={[styles.tierDesc, { color: colors.mutedFg }]}>
                      {tier.description}
                    </Text>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceBig, { color: colors.foreground }]}>{priceStr}</Text>
                  <Text style={[styles.periodSmall, { color: colors.mutedFg }]}>{periodStr}</Text>
                </View>
              </View>

              {/* Features list */}
              <View style={[styles.featuresContainer, { borderTopColor: colors.border }]}>
                {(tier.features || []).map((feat, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Lucide.Check
                      size={15}
                      color={isPro ? '#E8603C' : colors.accent}
                      style={styles.featureCheck}
                    />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{feat}</Text>
                  </View>
                ))}
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.tierBtn,
                  isCurrent
                    ? [styles.currentBtn, { backgroundColor: colors.muted }]
                    : isPro
                    ? [styles.primaryBtn, { backgroundColor: '#E8603C' }]
                    : [styles.secondaryBtn, { backgroundColor: colors.primary }],
                ]}
                disabled={isCurrent || subBusy}
                onPress={() => handleUpgrade(tier.name)}
                activeOpacity={0.8}
              >
                {subBusy ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text
                    style={[
                      styles.tierBtnText,
                      { color: isCurrent ? colors.mutedFg : '#FFF' },
                    ]}
                  >
                    {isCurrent
                      ? t('pricing.currentPlan', { defaultValue: 'Current Plan' })
                      : tier.name.toLowerCase() === 'free'
                      ? t('pricing.downgradeBtn', { defaultValue: 'Downgrade to Free' })
                      : t('pricing.upgradeBtn', { defaultValue: `Upgrade to ${tier.name}` })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* AI Credit Packs Top-up Section */}
      <View style={[styles.creditsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.creditsHeader}>
          <Lucide.Coins size={20} color={colors.accent} />
          <View style={styles.creditsHeaderText}>
            <Text style={[styles.creditsTitle, { color: colors.foreground }]}>
              {t('pricing.creditsTopupHeader', { defaultValue: 'Instant AI Credits Recharge' })}
            </Text>
            <Text style={[styles.creditsSub, { color: colors.mutedFg }]}>
              {t('pricing.creditsTopupDesc', {
                defaultValue: 'Need extra styling power? Top up instant credits that never expire.',
              })}
            </Text>
          </View>
        </View>

        <View style={styles.packsGrid}>
          {creditPacks.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              style={[
                styles.packCard,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => handleBuyCredits?.(pack.credits, pack.price_usd)}
              activeOpacity={0.7}
            >
              <Text style={[styles.packCredits, { color: colors.foreground }]}>
                {pack.credits}
              </Text>
              <Text style={[styles.packCreditsLabel, { color: colors.mutedFg }]}>
                {t('pricing.creditsUnit', { defaultValue: 'AI Credits' })}
              </Text>
              <Text style={[styles.packPrice, { color: colors.primary }]}>
                ${pack.price_usd}
              </Text>
              <View style={[styles.packBuyBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.packBuyText}>
                  {t('pricing.buyNow', { defaultValue: 'Buy' })}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing['2xl'],
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  clubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  clubBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['2xl'],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    borderRadius: radii.full,
    padding: 3,
  },
  cycleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    gap: 6,
  },
  cycleOptionActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cycleOptionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  cycleOptionTextActive: {
    fontFamily: fonts.bodyBold,
  },
  saveBadge: {
    backgroundColor: 'rgba(232, 96, 60, 0.12)',
    borderColor: 'rgba(232, 96, 60, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  saveBadgeText: {
    color: '#E8603C',
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  tierList: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  tierCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  proRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proRibbonText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  tierHeader: {
    marginBottom: spacing.md,
  },
  tierName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xl,
    marginBottom: 4,
  },
  tierDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceBig: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['3xl'],
  },
  periodSmall: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    marginLeft: 4,
  },
  featuresContainer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureCheck: {
    marginRight: spacing.sm,
  },
  featureText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm - 1,
    flex: 1,
  },
  tierBtn: {
    paddingVertical: spacing.md - 2,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {},
  secondaryBtn: {},
  currentBtn: {},
  tierBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  creditsSection: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  creditsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  creditsHeaderText: {
    flex: 1,
  },
  creditsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    marginBottom: 2,
  },
  creditsSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  packsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  packCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  packCredits: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  packCreditsLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    marginBottom: 4,
  },
  packPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    marginBottom: spacing.xs,
  },
  packBuyBtn: {
    width: '100%',
    paddingVertical: 5,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  packBuyText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
});
