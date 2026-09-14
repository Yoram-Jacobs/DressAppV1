import React from 'react';
import { useTranslation } from 'react-i18next';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Sparkles, Globe, Bookmark, Info, ExternalLink } from 'lucide-react';

export function ShoppingAssistant() {
  const { t } = useTranslation();

  return (
    <AccordionItem
      value="shopping-assistant"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(25_90%_95%)] text-[hsl(25_90%_40%)] shrink-0 transition-transform duration-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.shoppingAssistant', { defaultValue: 'Shopping Assistant' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('profile.shoppingAssistantDesc', { defaultValue: 'Integrate size recommendations directly into your shopping browser' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-5 text-start">
        
        {/* Part 1: Chrome Extension Store */}
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-sm">{t('profile.chromeStoreTitle', { defaultValue: 'Chrome Web Store Extension' })}</h4>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('profile.chromeStoreAvailable', { defaultValue: 'Available on Chrome Web Store' })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('profile.chromeStoreDesc', { defaultValue: 'Get the official browser extension for automatic sizing on supported online stores.' })}
          </p>
          <div className="pt-1">
            <a
              href="https://chromewebstore.google.com/detail/dressapp-shopping-assista/jdhaijhhipacplnjlhmnjaljhfmeoidp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('profile.chromeStoreInstall', { defaultValue: 'Add to Chrome' })}
            </a>
          </div>
        </div>

        {/* Part 2: Universal Bookmarklet */}
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-emerald-600" />
            <h4 className="font-semibold text-sm">{t('profile.bookmarkletTitle', { defaultValue: 'Universal Bookmarklet' })}</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('profile.bookmarkletDesc', { defaultValue: "Drag the button below to your bookmarks bar. On mobile, add it to your bookmarks and name it 'DressApp Shopping Assistant'. Click it when on any product page." })}
          </p>
          
          {'ontouchstart' in window ? (
            <div className="pt-2 flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/40">
              <Info className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                {t('profile.mobileDesktopGuide', { defaultValue: 'Wardrobe import is available on the desktop version of DressApp. Please open your account on a desktop browser to continue.' })}
              </span>
            </div>
          ) : (
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <a
                ref={(el) => {
                  if (el) {
                    el.setAttribute('href', "javascript:(function(){if(!document.getElementById('dressapp-mobile-styles')){var s=document.createElement('script');s.src='https://dressapp.co/widget/dressapp-mobile-floater.js?t='+Date.now();document.body.appendChild(s);}})();");
                  }
                }}
                title="DressApp Shopping Assistant"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors cursor-grab"
                onClick={(e) => {
                  e.preventDefault();
                  alert(t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." }));
                }}
              >
                {t('profile.bookmarkletBtn', { defaultValue: 'DressApp Assistant' })}
              </a>
              <span className="text-[11px] text-muted-foreground italic">
                {t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." })}
              </span>
            </div>
          )}
        </div>

      </AccordionContent>
    </AccordionItem>
  );
}
