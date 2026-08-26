/**
 * apps/mobile/src/components/profile/SubscriptionSettings.tsx
 *
 * Membership Tier, AI Credits counter & Billing Actions.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface SubscriptionProps {
  tierName?: string;
  credits?: number;
  onManagePricingPress: () => void;
}

export function SubscriptionSettings({
  tierName = 'Free',
  credits = 1000,
  onManagePricingPress,
}: SubscriptionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const isPro = tierName.toLowerCase() === 'professional';
  const isManager = tierName.toLowerCase() === 'manager';
  const isPaid = isPro || isManager;

  return (
    <View style={styles.container}>
      {/* Tier Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isPaid ? 'rgba(232, 96, 60, 0.08)' : colors.secondary,
            borderColor: isPaid ? 'rgba(232, 96, 60, 0.3)' : colors.border,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.tierInfo}>
            <Text style={[styles.tierSublabel, { color: colors.mutedFg }]}>
              {t('profile.currentMembership', { defaultValue: 'Current Plan' })}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={[styles.tierTitle, { color: colors.foreground }]}>
                {tierName.toUpperCase()}
              </Text>
              {isPaid && (
                <View style={[styles.proBadge, { backgroundColor: '#E8603C' }]}>
                  <Lucide.Crown size={12} color="#FFF" />
                  <Text style={styles.proBadgeText}>VIP</Text>
                </View>
              )}
            </View>
          </View>

          {/* Credits pill */}
          <View style={[styles.creditsPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Lucide.Coins size={14} color={colors.accent} />
            <Text style={[styles.creditsNumber, { color: colors.foreground }]}>
              {credits}
            </Text>
            <Text style={[styles.creditsLabel, { color: colors.mutedFg }]}>
              {t('profile.credits', { defaultValue: 'credits' })}
            </Text>
          </View>
        </View>

        <Text style={[styles.tierDesc, { color: colors.foreground }]}>
          {isPro
            ? t('profile.proBenefits', {
                defaultValue: 'You have full access to unlimited styling, digital product passports & marketplace monetization.',
              })
            : isManager
            ? t('profile.managerBenefits', {
                defaultValue: 'You have unlimited closet items, Trend Scout access and daily automated morning styling.',
              })
            : t('profile.freeBenefits', {
                defaultValue: 'Upgrade to DressApp Club to unlock unlimited items, VIP stylists and daily scheduler.',
              })}
        </Text>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: isPaid ? colors.primary : '#E8603C' },
          ]}
          onPress={onManagePricingPress}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>
            {isPaid
              ? t('profile.managePlanBtn', { defaultValue: 'Manage Plan & Add Credits' })
              : t('profile.upgradeClubBtn', { defaultValue: 'Upgrade to DressApp Club' })}
          </Text>
          <Lucide.ArrowRight size={14} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierInfo: {
    gap: 2,
  },
  tierSublabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xl,
    letterSpacing: 0.5,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  proBadgeText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  creditsNumber: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  creditsLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 2,
  },
  tierDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.lg,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
});
