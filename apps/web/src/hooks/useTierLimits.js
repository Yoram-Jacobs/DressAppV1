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

  const nanoBananaMonthlyLimit =
    user?.nano_banana_monthly?.nano_banana_monthly_limit ??
    user?.ai_configuration?.nano_banana_monthly_limit ??
    100;
  const nanoBananaMonthlyUsed =
    user?.nano_banana_monthly?.nano_banana_monthly_used ??
    user?.ai_configuration?.nano_banana_monthly_used ??
    0;
  const nanoBananaMonthlyRemaining =
    user?.nano_banana_monthly?.nano_banana_monthly_remaining ??
    user?.ai_configuration?.nano_banana_monthly_remaining ??
    Math.max(0, nanoBananaMonthlyLimit - nanoBananaMonthlyUsed);

  const rawBucketCredits = (() => {
    if (typeof user?.total_credits === 'number') return user.total_credits;
    if (typeof user?.ai_credits === 'number') return user.ai_credits;
    if (Array.isArray(user?.credit_buckets)) {
      const now = Date.now();
      return user.credit_buckets.reduce((sum, b) => {
        if (!b || typeof b.amount !== 'number') return sum;
        if (b.type === 'free' && b.expires_at) {
          const exp = Date.parse(b.expires_at);
          if (!Number.isNaN(exp) && now > exp) return sum;
        }
        return sum + b.amount;
      }, 0);
    }
    return Number(user?.ai_configuration?.current_credits || 0);
  })();

  const minClusterCredits = 15;
  const aiReconstructionCredits = isFree
    ? Math.max(0, Math.min(rawBucketCredits, nanoBananaMonthlyRemaining))
    : nanoBananaMonthlyRemaining;
  const canAccessMassUpload = !isFree || aiReconstructionCredits >= minClusterCredits;

  const closetCapacityBonus = user?.closet_capacity_bonus || 0;
  const maxClosetSlots = isFree ? Math.min(150, 50 + closetCapacityBonus) : Infinity;
  const maxAiActionsPerDay = isFree ? 10 : Infinity;

  const onpremCreditsBalance = (() => {
    if (typeof user?.onprem_credits?.onprem_credits_balance === 'number') {
      return user.onprem_credits.onprem_credits_balance;
    }
    if (typeof user?.onprem_credits_balance === 'number') {
      return user.onprem_credits_balance;
    }
    if (typeof user?.ai_configuration?.onprem_credits_balance === 'number') {
      return user.ai_configuration.onprem_credits_balance;
    }
    return isFree ? 10 : Infinity;
  })();

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
    canAccessMassUpload,
    aiReconstructionCredits,
    minClusterCredits,
    nanoBananaMonthlyLimit,
    nanoBananaMonthlyUsed,
    nanoBananaMonthlyRemaining,
    maxClosetSlots,
    maxAiActionsPerDay,
    getUpgradeMessage,
    onpremCreditsBalance,
  };
}
