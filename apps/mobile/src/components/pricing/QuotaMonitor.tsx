/**
 * apps/mobile/src/components/pricing/QuotaMonitor.tsx
 *
 * Native mobile Quota & Processing limits gauge.
 * Parity with apps/web/src/components/pricing/QuotaMonitor.jsx:
 *  - Quota alert banner when limit reached or approaching
 *  - Visual progress bar for daily AI operations
 *  - Full i18next string localization and theme token support
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface QuotaStatus {
  can_proceed?: boolean;
  message?: string;
  daily_limit?: number;
  daily_used?: number;
}

export interface PricingData {
  pricing_plan?: {
    plan_type?: string;
  };
  credits?: {
    ai_daily_used?: number;
    total_credits?: number;
  };
}

interface QuotaMonitorProps {
  quotaStatus?: QuotaStatus;
  pricingData?: PricingData | null;
  onUpgradePress?: () => void;
}

export function QuotaMonitor({ quotaStatus, pricingData, onUpgradePress }: QuotaMonitorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const currentPlan = pricingData?.pricing_plan?.plan_type || 'free';
  const dailyUsed = pricingData?.credits?.ai_daily_used || 0;
  const isFree = currentPlan.toLowerCase() === 'free';
  const canProceed = quotaStatus?.can_proceed !== false;

  const quotaPercent = Math.min(100, Math.max(0, (dailyUsed / 10) * 100));

  return (
    <View style={styles.container}>
      {/* Alert Banner if limit is reached */}
      {!canProceed && (
        <View
          style={[
            styles.alertBanner,
            {
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
            },
          ]}
        >
          <View style={styles.alertHeader}>
            <Lucide.ShieldAlert size={20} color="#EF4444" style={styles.alertIcon} />
            <View style={styles.alertTextContainer}>
              <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
                {t('pricing.alerts.exhausted', { defaultValue: 'Limit Reached' })}
              </Text>
              <Text style={[styles.alertMsg, { color: colors.foreground }]}>
                {quotaStatus?.message ||
                  t('pricing.limitReachedMsg', {
                    defaultValue:
                      'Daily AI operation limit reached. Upgrade your plan to continue styling without limits.',
                  })}
              </Text>
            </View>
          </View>

          {onUpgradePress && (
            <TouchableOpacity
              style={[styles.upgradeBannerBtn, { backgroundColor: colors.destructive }]}
              onPress={onUpgradePress}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeBannerBtnText}>
                {t('pricing.upgradeLinkBtn', { defaultValue: 'Upgrade Plan' })}
              </Text>
              <Lucide.ArrowRight size={14} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Free Tier Daily Quota Progress Bar */}
      {isFree && (
        <View style={[styles.usageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.usageHeader}>
            <View style={styles.usageTitleRow}>
              <Lucide.TrendingUp size={18} color={colors.accent} />
              <Text style={[styles.usageTitle, { color: colors.foreground }]}>
                {t('pricing.usageStatsHeader', { defaultValue: 'Daily Processing Limits' })}
              </Text>
            </View>
            <Text style={[styles.usageCount, { color: colors.primary }]}>
              {dailyUsed} / 10 {t('pricing.requests', { defaultValue: 'requests' })}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${quotaPercent}%`,
                  backgroundColor: quotaPercent >= 100 ? '#EF4444' : colors.accent,
                },
              ]}
            />
          </View>

          <Text style={[styles.usageCaption, { color: colors.mutedFg }]}>
            {t('pricing.freeUsageNotice', {
              defaultValue:
                'Free tier includes up to 10 AI operations per day. Upgrade to Manager or Professional for unlimited access.',
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  alertBanner: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    marginBottom: 2,
  },
  alertMsg: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  upgradeBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: 6,
  },
  upgradeBannerBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  usageCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  usageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  usageCount: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  usageCaption: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    lineHeight: 16,
    marginTop: 4,
  },
});
