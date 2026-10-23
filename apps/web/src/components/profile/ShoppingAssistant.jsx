import React from 'react';
import { useTranslation } from 'react-i18next';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Sparkles, Globe, Bookmark, Info, Smartphone, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ShoppingAssistant() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AccordionItem
      value="shopping-assistant"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
    >
       <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
            <div className="p-2.5 rounded-xl bg-[hsl(25_90%_95%)] text-[hsl(25_90%_40%)] shrink-0 transition-transform duration-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
             {t('profile.shoppingAssistant', { defaultValue: 'Shopping Assistant' })}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
            {t('profile.shoppingAssistantDesc', { defaultValue: 'Integrate size recommendations directly into your shopping browser' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        
        {/* Part 1: Mobile Share Sheet (Approach 2) */}
        <div className="space-y-3 rounded-[12px] bg-gradient-to-r from-primary-shadow/60 via-sand/40 to-white border border-primary-brand/30 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary-brand text-white flex items-center justify-center shrink-0">
                <Smartphone className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-[14px] text-dark-brand">
                {t('profile.mobileShareTitle', { defaultValue: 'Mobile Share Sheet & Link Checker' })}
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-brand/10 text-primary-brand border border-primary-brand/20">
              {t('common.recommended', { defaultValue: 'Mobile Ready' })}
            </span>
          </div>
          <p className="text-[12px] text-text-brand font-semibold leading-relaxed">
            {t('profile.mobileShareDesc', { defaultValue: 'Shopping on your phone? Tap Share in Safari or Chrome and select DressApp for instant sizing, or paste any garment link directly.' })}
          </p>
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => navigate('/shopping-assistant')}
              className="bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-8 rounded-lg shadow-xs"
              data-testid="profile-open-share-target-btn"
            >
              <Sparkles className="w-3.5 h-3.5 me-1.5" />
              {t('profile.openMobileAssistant', { defaultValue: 'Launch Size Checker' })}
              <ArrowRight className="w-3 h-3 ms-1.5 rtl:rotate-180" />
            </Button>
          </div>
        </div>

        {/* Part 2: Chrome Extension Store Placeholder */}
        <div className="space-y-2 rounded-[12px] bg-white border border-border p-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-brand" />
            <h4 className="font-bold text-[14px] text-dark-brand">{t('profile.chromeStoreTitle', { defaultValue: 'Chrome Web Store Extension' })}</h4>
          </div>
          <p className="text-[12px] text-text-brand font-semibold">
            {t('profile.chromeStoreDesc', { defaultValue: 'Get the official browser extension for automatic sizing on supported online stores.' })}
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-muted text-text-brand border">
              {t('profile.chromeStoreComingSoon', { defaultValue: 'Coming Soon to the Chrome Web Store' })}
            </span>
          </div>
        </div>

        {/* Part 3: Universal Bookmarklet */}
        <div className="space-y-2 rounded-[12px] bg-white border border-border p-3">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary-brand" />
            <h4 className="font-bold text-[14px] text-dark-brand">{t('profile.bookmarkletTitle', { defaultValue: 'Universal Bookmarklet' })}</h4>
          </div>
          <p className="text-[12px] text-text-brand font-semibold">
            {t('profile.bookmarkletDesc', { defaultValue: "Drag the button below to your bookmarks bar. On mobile, add it to your bookmarks and name it 'DressApp Shopping Assistant'. Click it when on any product page." })}
          </p>
          
          {'ontouchstart' in window ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-beige border border-border">
              <Info className="w-4 h-4 text-text-brand shrink-0" />
              <span className="text-[11px] text-text-brand font-semibold">
                {t('profile.mobileDesktopGuide', { defaultValue: 'Wardrobe import is available on the desktop version of DressApp. Please open your account on a desktop browser to continue.' })}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <a
                ref={(el) => {
                  if (el) {
                    el.setAttribute('href', "javascript:(function(){if(!document.getElementById('dressapp-mobile-styles')){var s=document.createElement('script');s.src='https://dressapp.co/widget/dressapp-mobile-floater.js?t='+Date.now();document.body.appendChild(s);}})();");
                  }
                }}
                title={`👗 ${t('profile.bookmarkletBtn', { defaultValue: 'DressApp Assistant' })}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-brand px-4 py-2 text-[12px] font-semibold text-white shadow hover:bg-primary-hover transition-colors cursor-grab active:cursor-grabbing select-none"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info(t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." }));
                }}
              >
                <span className="pointer-events-none">👗</span>
                <span className="pointer-events-none">{t('profile.bookmarkletBtn', { defaultValue: 'DressApp Assistant' })}</span>
              </a>
              <span className="text-[12px] font-semibold text-text-brand italic">
                {t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." })}
              </span>
            </div>
          )}
        </div>

      </AccordionContent>
    </AccordionItem>
  );
}
