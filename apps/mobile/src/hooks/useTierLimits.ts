import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useUserStore, getUserTier } from '@mobile/lib/stores';

export function useTierLimits() {
  const { user } = useUserStore();
  const { t } = useTranslation();

  const rawTier = getUserTier(user);
  let userTier: 'free' | 'manager' | 'professional' = 'free';
  if (rawTier === 'pro' || rawTier === 'manager') {
    userTier = 'manager';
  } else if (rawTier === 'business' || rawTier === 'professional') {
    userTier = 'professional';
  }

  const isFree = userTier === 'free';
  const isManager = userTier === 'manager';
  const isProfessional = userTier === 'professional';

  const canCreateCampaign = isProfessional;
  const canAccessTrendScout = !isFree;
  const canAccessScheduler = !isFree;
  const canAccessMigration = !isFree;

  const closetCapacityBonus = user?.closet_capacity_bonus || 0;
  const maxClosetSlots = isFree ? Math.min(150, 50 + closetCapacityBonus) : Infinity;
  const maxAiActionsPerDay = isFree ? 10 : Infinity;

  const getUpgradeMessage = (featureText: string, isProOnly: boolean = false): string => {
    if (isProOnly) {
      return t('common.upgradeToUsePro', {
        feature: featureText,
        defaultValue: `Upgrade to Professional to use ${featureText}`,
      });
    }
    return t('common.upgradeToUse', {
      feature: featureText,
      defaultValue: `Upgrade your plan to use ${featureText}`,
    });
  };

  const showUpgradeAlert = (
    featureText: string,
    isProOnly: boolean = false,
    onUpgrade?: () => void
  ) => {
    Alert.alert(
      t('common.upgradeRequired', { defaultValue: 'Upgrade Required' }),
      getUpgradeMessage(featureText, isProOnly),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.upgrade', { defaultValue: 'Upgrade' }),
          onPress: onUpgrade,
        },
      ]
    );
  };

  return {
    userTier,
    isFree,
    isManager,
    isProfessional,
    canCreateCampaign,
    canAccessTrendScout,
    canAccessScheduler,
    canAccessMigration,
    maxClosetSlots,
    maxAiActionsPerDay,
    getUpgradeMessage,
    showUpgradeAlert,
  };
}
