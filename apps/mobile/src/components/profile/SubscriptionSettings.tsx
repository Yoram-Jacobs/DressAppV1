/**
 * apps/mobile/src/components/profile/SubscriptionSettings.tsx
 *
 * Subscription & Limits Management Component — 100% parity with Web SubscriptionSettings.jsx.
 * Displays active plan details, renewal date, cancel action, closet capacity progress, and referral perks.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { SubscriptionInfo } from '@mobile/lib/stores/userStore';

interface SubscriptionProps {
  subscription?: SubscriptionInfo;
  tierName?: string;
  closetCount?: number;
  closetBonus?: number;
  userId?: string;
  onManagePricingPress: () => void;
  onRefreshProfile?: () => Promise<void>;
}

export function SubscriptionSettings({
  subscription,
  tierName = 'Free',
  closetCount = 0,
  closetBonus = 0,
  userId = '',
  onManagePricingPress,
  onRefreshProfile,
}: SubscriptionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

  const isActive = Boolean(subscription?.is_active);
  const effectiveTier = (isActive && subscription?.tier && subscription.tier !== 'free')
    ? subscription.tier.toLowerCase()
    : (tierName ? tierName.toLowerCase() : 'free');

  const isPro = effectiveTier === 'professional';
  const isManager = effectiveTier === 'manager';
  const isPaid = isActive && (isPro || isManager);
  const planType = subscription?.plan_type || 'monthly';

  // Closet capacity limits
  const maxBonus = 150; // 50 base + 150 bonus = 200 max
  const effectiveBonus = Math.min(closetBonus, maxBonus);
  const maxCapacity = 50 + effectiveBonus;
  const capacityPct = Math.min(100, Math.round((closetCount / maxCapacity) * 100));
  const isCapacityFull = closetCount >= maxCapacity;

  // Format expiration/renewal date
  const formatExpiresAt = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const expiresFormatted = formatExpiresAt(subscription?.expires_at);

  const handleCancelSubscription = () => {
    Alert.alert(
      t('profile.cancelSubscriptionTitle', { defaultValue: 'Cancel Subscription' }),
      t('profile.cancelSubscriptionConfirm', {
        defaultValue: 'Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'No, Keep Plan' }), style: 'cancel' },
        {
          text: t('profile.confirmCancelBtn', { defaultValue: 'Yes, Cancel Plan' }),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await (api as any).cancelSubscription?.();
              Alert.alert(
                t('common.success', { defaultValue: 'Success' }),
                t('profile.cancelSuccessMsg', { defaultValue: 'Your subscription has been cancelled.' })
              );
              if (onRefreshProfile) {
                await onRefreshProfile();
              }
            } catch (err: any) {
              Alert.alert(
                t('common.error', { defaultValue: 'Error' }),
                err?.message || t('profile.cancelErrorMsg', { defaultValue: 'Failed to cancel subscription.' })
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleCopyReferral = async () => {
    const inviteUrl = `https://dressapp.co/register?ref=${userId || ''}`;
    try {
      Clipboard.setString(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      Alert.alert(
        t('common.copied', { defaultValue: 'Copied!' }),
        t('profile.referralCopiedMsg', { defaultValue: 'Invite link copied to clipboard.' })
      );
    } catch {
      // Fallback to native share
      try {
        await Share.share({
          message: t('profile.shareInviteText', {
            defaultValue: 'Join DressApp to organize your closet and get AI outfits: {{url}}',
            url: inviteUrl,
          }),
        });
      } catch {}
    }
  };

  return (
    <View style={styles.container}>
      {isPaid ? (
        /* ── ACTIVE PAID PLAN SECTION (FRAMELESS) ─────────────────── */
        <View style={styles.paidContent}>
          {/* Header Row */}
          <View style={styles.planHeaderRow}>
            <View style={styles.planTitleGroup}>
              <View style={styles.crownCircle}>
                <Lucide.Crown size={16} color="#EAB308" />
              </View>
              <Text style={[styles.planMainTitle, { color: colors.foreground }]}>
                {`DressApp ${effectiveTier.toUpperCase()} (${planType.toUpperCase()})`}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>
                {t('profile.activeStatus', { defaultValue: 'Active' })}
              </Text>
            </View>
          </View>

          {/* Renewal Date */}
          {Boolean(expiresFormatted) && (
            <View style={styles.renewalRow}>
              <Lucide.Calendar size={13} color={colors.mutedFg} />
              <Text style={[styles.renewalText, { color: colors.mutedFg }]}>
                {t('profile.renewalDate', { defaultValue: 'Renewal date: {{date}}', date: expiresFormatted })}
              </Text>
            </View>
          )}

          {/* Plan Feature Summary */}
          <Text style={[styles.planDescription, { color: colors.foreground }]}>
            {isPro
              ? t('profile.proFeatureDesc', {
                  defaultValue: 'You have unlimited closet slots, unlimited daily requests, full marketplace access, and active ad campaign management.',
                })
              : t('profile.managerFeatureDesc', {
                  defaultValue: 'You have unlimited closet slots, unlimited daily requests, and full marketplace access.',
                })}
          </Text>

          {/* Action Row */}
          <View style={styles.paidActionRow}>
            <TouchableOpacity
              style={[styles.manageBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={onManagePricingPress}
              activeOpacity={0.8}
            >
              <Text style={[styles.manageBtnText, { color: colors.foreground }]}>
                {t('profile.viewAllPlans', { defaultValue: 'View All Plans' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: '#EF4444' }]}
              onPress={handleCancelSubscription}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Lucide.XCircle size={13} color="#EF4444" />
                  <Text style={styles.cancelBtnText}>
                    {t('profile.cancelSubscription', { defaultValue: 'Cancel Subscription' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── FREE TIER CAPACITY & UPGRADE CARDS ───────────────────── */
        <View style={styles.freeContainer}>
          {/* 1. Closet Capacity Progress */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.capacityHeader}>
              <View style={styles.capacityTitleRow}>
                <Lucide.Shirt size={16} color={colors.accent} />
                <Text style={[styles.capacityTitle, { color: colors.foreground }]}>
                  {t('profile.closetCapacity', { defaultValue: 'Closet Capacity' })}
                </Text>
              </View>
              <Text
                style={[
                  styles.capacityNumbers,
                  { color: isCapacityFull ? '#EF4444' : colors.foreground },
                ]}
              >
                {`${closetCount} / ${maxCapacity} ${t('profile.items', { defaultValue: 'items' })}`}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.secondary }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, capacityPct)}%`,
                    backgroundColor: isCapacityFull ? '#EF4444' : capacityPct > 80 ? '#F59E0B' : colors.accent,
                  },
                ]}
              />
            </View>

            {isCapacityFull && (
              <View style={styles.warningBox}>
                <Lucide.AlertCircle size={14} color="#EF4444" />
                <Text style={styles.warningText}>
                  {t('profile.closetLimitWarning', {
                    defaultValue: 'You have reached your free closet capacity limit. Upgrade to add more garments.',
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* 2. Upgrade to Manager or Pro Card */}
          <View style={[styles.card, styles.upgradeCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
            <View style={styles.upgradeHeader}>
              <View style={[styles.crownCircle, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                <Lucide.Crown size={18} color="#EAB308" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.upgradeTitle, { color: colors.foreground }]}>
                  {t('profile.upgradeToProTitle', { defaultValue: 'Upgrade to Manager or Professional' })}
                </Text>
                <Text style={[styles.upgradeSub, { color: colors.mutedFg }]}>
                  {t('profile.upgradeToProSub', { defaultValue: 'Unlock unlimited closet storage, Trend Scout feeds, and priority AI styling.' })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.upgradeActionBtn, { backgroundColor: colors.accent }]}
              onPress={onManagePricingPress}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeActionBtnText}>
                {t('profile.selectPlanBtn', { defaultValue: 'Choose Membership Plan' })}
              </Text>
              <Lucide.ArrowRight size={15} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* 3. Viral Referral Slots Expansion */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.referralHeader}>
              <Lucide.Users size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.referralTitle, { color: colors.foreground }]}>
                  {t('profile.referralTitle', { defaultValue: 'Invite Friends for +10 Slots' })}
                </Text>
                <Text style={[styles.referralDesc, { color: colors.mutedFg }]}>
                  {t('profile.referralDesc', {
                    defaultValue: 'Get +10 bonus closet slots for every friend who joins via your invite link (up to 200 items max).',
                  })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.copyRefBtn,
                { backgroundColor: copied ? '#22C55E' : colors.secondary, borderColor: colors.border },
              ]}
              onPress={handleCopyReferral}
              activeOpacity={0.8}
            >
              {copied ? (
                <>
                  <Lucide.Check size={14} color="#FFF" />
                  <Text style={[styles.copyRefText, { color: '#FFF' }]}>
                    {t('common.copied', { defaultValue: 'Copied!' })}
                  </Text>
                </>
              ) : (
                <>
                  <Lucide.Copy size={14} color={colors.foreground} />
                  <Text style={[styles.copyRefText, { color: colors.foreground }]}>
                    {t('profile.copyReferralBtn', { defaultValue: 'Copy Referral Link' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  paidContent: {
    paddingVertical: spacing[1],
    gap: spacing[3],
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
    paddingRight: spacing[2],
  },
  crownCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planMainTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.sm + 1,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor: '#EAB308',
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  activeBadgeText: {
    color: '#000',
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  renewalText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  planDescription: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.5,
  },
  paidActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  manageBtn: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  manageBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  freeContainer: {
    gap: spacing[3],
  },
  card: {
    padding: spacing[3.5],
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing[2.5],
    ...shadows.sm,
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capacityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  capacityTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  capacityNumbers: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  progressBarBg: {
    height: 8,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  warningText: {
    color: '#EF4444',
    fontFamily: fonts.body,
    fontSize: 11,
    flex: 1,
  },
  upgradeCard: {
    borderWidth: 1.5,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2.5],
  },
  upgradeTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.sm + 1,
  },
  upgradeSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    lineHeight: 16,
    marginTop: 2,
  },
  upgradeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    gap: 6,
    marginTop: spacing[1],
  },
  upgradeActionBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  referralTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  referralDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    lineHeight: 16,
    marginTop: 2,
  },
  copyRefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 6,
  },
  copyRefText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
