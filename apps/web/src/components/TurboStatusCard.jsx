import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * TurboStatusCard — Modular dynamic status indicator informing users that
 * they are on the Standard VPS Engine (~30s) and offering a 1-tap pathway
 * to Unlock Instant Turbo speed.
 *
 * @param {'card' | 'inline'} variant - Display mode
 * @param {'upload' | 'stylist' | 'suitcase'} context - Usage context for localized copy & analytics
 * @param {string} className - Additional CSS classes
 */
export function TurboStatusCard({ variant = 'card', context = 'upload', className = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleUnlockTurbo = (e) => {
    e?.stopPropagation?.();
    try {
      api.recordFunnelEvent('turbo_cta_clicked', { context });
    } catch (_) {
      // Ignore background analytics failure
    }
    navigate('/pricing#manager');
  };

  const getContextDesc = () => {
    switch (context) {
      case 'stylist':
        return t('common.standardStylistDesc', {
          defaultValue: 'Standard processing queue. AI Stylist is crafting your look.',
        });
      case 'suitcase':
        return t('common.standardSuitcaseDesc', {
          defaultValue: 'Standard processing queue. Generating curated travel wardrobe.',
        });
      case 'upload':
      default:
        return t('common.standardUploadDesc', {
          defaultValue: 'Standard processing queue. Deep clothing scan in progress.',
        });
    }
  };

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2.5 py-1.5 px-2.5 rounded-[8px] bg-amber-500/10 border border-amber-500/20 text-xs transition-all',
          className
        )}
        data-testid="turbo-status-inline"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-pulse" />
          <span className="font-semibold text-text-brand text-[11px] truncate">
            {t('common.standardEngine', { defaultValue: 'Standard Engine (~30s)' })}
          </span>
        </div>
        <button
          type="button"
          onClick={handleUnlockTurbo}
          className="shrink-0 min-h-[36px] px-2.5 py-1 rounded-[6px] bg-primary-brand text-white font-bold hover:opacity-95 transition-opacity text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
          data-testid="unlock-turbo-btn"
        >
          <Zap className="h-3 w-3 text-amber-300 fill-amber-300 shrink-0" />
          <span className="whitespace-nowrap">
            {t('common.unlockInstantTurbo', { defaultValue: '⚡ Unlock Instant Turbo' })}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full rounded-[12px] border border-amber-500/30 bg-gradient-to-r from-amber-50/70 via-background to-amber-50/40 dark:from-amber-950/20 dark:via-background dark:to-amber-950/10 p-3.5 sm:p-4 shadow-xs transition-all',
        className
      )}
      data-testid="turbo-status-card"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[13px] text-dark-brand">
                {t('common.standardEngine', { defaultValue: 'Standard Engine (~30s)' })}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                {t('pricing.free', { defaultValue: 'Free Plan' })}
              </span>
            </div>
            <p className="text-[11.5px] text-text-brand mt-0.5 leading-snug">
              {getContextDesc()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleUnlockTurbo}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-full bg-primary-brand text-white font-bold hover:opacity-90 active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          data-testid="unlock-turbo-card-btn"
        >
          <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300 shrink-0" />
          <span className="whitespace-nowrap">
            {t('common.unlockInstantTurbo', { defaultValue: '⚡ Unlock Instant Turbo' })}
          </span>
        </button>
      </div>
    </div>
  );
}

export default TurboStatusCard;
