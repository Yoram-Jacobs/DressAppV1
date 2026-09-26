import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';

export function useTierLimits() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const sub = user?.subscription || {};
  const isActive = Boolean(sub.is_active);
  const planType = sub.plan_type || 'free';
  const tier = (sub.tier || 'free').toLowerCase();
  const isTester = Boolean(sub.is_tester || planType === 'tester' || user?.roles?.includes('tester'));
  const isAdmin = Boolean(user?.roles?.includes('admin'));

  let userTier = 'free';
  if (isTester || isAdmin) {
    userTier = 'professional';
  } else if (isActive && planType !== 'free') {
    if (['pro', 'manager'].includes(tier)) {
      userTier = 'manager';
    } else if (['business', 'professional'].includes(tier)) {
      userTier = 'professional';
    }
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

  const getUpgradeMessage = (featureText, isProOnly = false) => {
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

  return {
    userTier,
    isFree,
    isManager,
    isProfessional,
    isTester,
    isAdmin,
    canCreateCampaign,
    canAccessTrendScout,
    canAccessScheduler,
    canAccessMigration,
    maxClosetSlots,
    maxAiActionsPerDay,
    getUpgradeMessage,
  };
}
