import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useTierLimits } from '@/hooks/useTierLimits';
import { Sparkles, Shirt, ArrowRight, Crown } from 'lucide-react';

const PRESET_APPS = [
  { name: 'Whering', domain: 'app.whering.co.uk', loginUrl: 'https://app.whering.co.uk/login', icon: '👗', count: 95 },
  { name: 'Acloset', domain: 'web.acloset.app', loginUrl: 'https://web.acloset.app/login', icon: '📱', count: 48 },
  { name: 'Stylebook', domain: 'www.stylebookapp.com', loginUrl: 'https://www.stylebookapp.com', icon: '🎨', count: 65 },
  { name: 'Smartli', domain: 'smartli.app', loginUrl: 'https://smartli.app', icon: '⚡', count: 32 },
  { name: 'Indyx', domain: 'myindyx.com', loginUrl: 'https://www.myindyx.com', icon: '✨', count: 60 },
];

export function ImportWardrobeSection({ onSelectAppForMigration }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canAccessMigration } = useTierLimits();

  const handleStartImport = (app) => {
    if (!canAccessMigration) {
      navigate('/pricing');
      return;
    }
    if (app && app.name) {
      navigate(`/migration?app=${encodeURIComponent(app.name)}`);
      return;
    }
    if (onSelectAppForMigration) {
      onSelectAppForMigration(app);
    } else {
      navigate('/migration');
    }
  };

  return (
    <AccordionItem
      value="import-wardrobe"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
      data-testid="profile-import-wardrobe-accordion"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-primary-shadow text-primary-brand shrink-0 transition-transform duration-200">
            <Shirt className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold flex items-center gap-1.5 text-dark-brand">
              <span>{t('profile.importWardrobeTitle', { defaultValue: 'Import Wardrobe From Other Apps' })}</span>
              {!canAccessMigration && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-500/30">
                  <Crown className="h-3 w-3 text-amber-600" />
                  <span>{t('onboarding.step3.migrationProBadge', { defaultValue: 'Manager / Pro' })}</span>
                </span>
              )}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.importWardrobeDesc', { defaultValue: 'Migrate your existing catalog seamlessly from Whering, Acloset, Stylebook, and other digital wardrobe apps.' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3 text-start">
        {!canAccessMigration && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-[12px] bg-primary-shadow border border-border">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
              <div>
                <div className="text-[12px] font-bold text-dark-brand">
                  {t('common.upgradeToUse', { feature: t('common.features.migration') })}
                </div>
                <div className="text-[11px] text-text-brand font-medium">
                  {t('migration.upgradePrompt', { defaultValue: 'Wardrobe migration from other apps is available on Manager and Professional plans.' })}
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate('/pricing')}
              className="rounded-full text-[11px] h-8 px-3 font-bold shrink-0"
            >
              {t('common.upgrade', { defaultValue: 'Upgrade' })}
            </Button>
          </div>
        )}

        <div className="p-3 rounded-[12px] bg-primary-shadow/60 border border-primary-brand/30 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="text-[12px] font-bold text-dark-brand">
              {t('profile.supportedPlatforms', { defaultValue: 'Supported Wardrobe Platforms' })}
            </div>
            <p className="text-[11px] text-text-brand font-medium leading-relaxed">
              {t('migration.screenshotsSupportHint', { defaultValue: 'Works on iOS & Android with any wardrobe app (PNG, JPG, MP4, MOV)' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESET_APPS.map((app) => (
            <button
              key={app.name}
              type="button"
              onClick={() => handleStartImport(app)}
              className="flex items-center justify-between p-2.5 rounded-[10px] border border-border bg-white hover:border-primary-brand hover:bg-primary-shadow transition-all text-start"
              data-testid={`profile-import-app-${app.name.toLowerCase()}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">{app.icon}</span>
                <div className="min-w-0">
                  <span className="text-[12px] font-bold text-dark-brand block truncate">{app.name}</span>
                  <span className="text-[10.5px] text-text-brand font-semibold block truncate">
                    {t('migration.itemsCountLabel', { count: app.count, defaultValue: `${app.count}+ items` })}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-primary-brand shrink-0 rtl:rotate-180" />
            </button>
          ))}
        </div>

        <div className="pt-2">
          <Button
            type="button"
            onClick={() => handleStartImport(null)}
            className="w-full bg-primary-brand hover:bg-primary-hover text-white text-xs font-bold h-9 rounded-xl shadow-xs flex items-center justify-center gap-1.5"
            data-testid="profile-open-migration-hub-btn"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t('migrationHub.openHubBtn', { defaultValue: 'Open Wardrobe Migration Hub' })}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
