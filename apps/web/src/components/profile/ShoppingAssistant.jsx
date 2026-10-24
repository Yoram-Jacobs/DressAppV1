import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Sparkles, Globe, Bookmark, Info, Smartphone, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const CHROME_EXTENSION_STORE_URL =
  'https://chromewebstore.google.com/detail/dressapp-shopping-assista/jdhaijhhipacplnjlhmnjaljhfmeoidp';

export function ShoppingAssistant() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderChromeExtensionCard = (highlighted) => (
    <div
      key="chrome-ext"
      className={`space-y-3 rounded-[12px] p-3.5 shadow-xs transition-all ${
        highlighted
          ? 'bg-gradient-to-r from-primary-shadow/60 via-sand/40 to-white border border-primary-brand/30'
          : 'bg-white border border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary-brand text-white flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4" />
          </div>
          <h4 className="font-bold text-[14px] text-dark-brand truncate">
            {t('profile.chromeStoreTitle', { defaultValue: 'Chrome Web Store Extension' })}
          </h4>
        </div>
        <span className="shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-brand/10 text-primary-brand border border-primary-brand/20">
          {t('profile.recommendedDesktop', { defaultValue: 'Recommended for Desktop' })}
        </span>
      </div>
      <p className="text-[12px] text-text-brand font-semibold leading-relaxed text-start" dir="auto">
        {t('profile.chromeStoreDesc', { defaultValue: 'Get the official browser extension for automatic sizing on supported online stores.' })}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <a
          href={CHROME_EXTENSION_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-8 px-3.5 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors"
          data-testid="profile-install-chrome-ext-btn"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          <span>{t('profile.addToChrome', { defaultValue: 'Add to Chrome' })}</span>
        </a>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate('/extension/connect')}
          className="h-8 text-xs font-semibold rounded-lg border-border hover:bg-sand/30 inline-flex items-center gap-1.5"
          data-testid="profile-connect-ext-btn"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary-brand" />
          <span>{t('profile.connectExtension', { defaultValue: 'Connect Extension' })}</span>
        </Button>
      </div>
    </div>
  );

  const renderMobileShareCard = (highlighted) => (
    <div
      key="mobile-share"
      className={`space-y-3 rounded-[12px] p-3.5 shadow-xs transition-all ${
        highlighted
          ? 'bg-gradient-to-r from-primary-shadow/60 via-sand/40 to-white border border-primary-brand/30'
          : 'bg-white border border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary-brand text-white flex items-center justify-center shrink-0">
            <Smartphone className="h-4 w-4" />
          </div>
          <h4 className="font-bold text-[14px] text-dark-brand truncate">
            {t('profile.mobileShareTitle', { defaultValue: 'Mobile Share Sheet & Link Checker' })}
          </h4>
        </div>
        <span className="shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-brand/10 text-primary-brand border border-primary-brand/20">
          {t('profile.mobileReady', { defaultValue: 'Mobile Ready' })}
        </span>
      </div>
      <p className="text-[12px] text-text-brand font-semibold leading-relaxed text-start" dir="auto">
        {t('profile.mobileShareDesc', { defaultValue: 'Shopping on your phone? Tap Share in Safari or Chrome and select DressApp for instant sizing, or paste any garment link directly.' })}
      </p>
      <div className="pt-1">
        <Button
          type="button"
          size="sm"
          onClick={() => navigate('/shopping-assistant')}
          className="bg-primary-brand hover:bg-primary-hover text-white text-xs font-semibold h-8 rounded-lg shadow-xs inline-flex items-center gap-1.5"
          data-testid="profile-open-share-target-btn"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{t('profile.openMobileAssistant', { defaultValue: 'Launch Size Checker' })}</span>
          <ArrowRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );

  const renderBookmarkletCard = () => (
    <div key="bookmarklet" className="space-y-2 rounded-[12px] bg-white border border-border p-3">
      <div className="flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-primary-brand shrink-0" />
        <h4 className="font-bold text-[14px] text-dark-brand">{t('profile.bookmarkletTitle', { defaultValue: 'Universal Bookmarklet' })}</h4>
      </div>
      <p className="text-[12px] text-text-brand font-semibold leading-relaxed text-start" dir="auto">
        {t('profile.bookmarkletDesc', { defaultValue: "Drag the button below to your bookmarks bar. On mobile, add it to your bookmarks and name it 'DressApp Shopping Assistant'. Click it when on any product page." })}
      </p>
      
      {'ontouchstart' in window ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-beige border border-border">
          <Info className="w-4 h-4 text-text-brand shrink-0" />
          <span className="text-[11px] text-text-brand font-semibold text-start" dir="auto">
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
            title={`👗 ${t('profile.bookmarkletBtnName', { defaultValue: 'DressApp Assistant' })}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-brand px-4 py-2 text-[12px] font-semibold text-white shadow hover:bg-primary-hover transition-colors cursor-grab active:cursor-grabbing select-none"
            onClick={(e) => {
              e.preventDefault();
              toast.info(t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." }));
            }}
          >
            <span className="pointer-events-none">👗</span>
            <span className="pointer-events-none">{t('profile.bookmarkletBtnName', { defaultValue: 'DressApp Assistant' })}</span>
          </a>
          <span className="text-[12px] font-semibold text-text-brand italic text-start" dir="auto">
            {t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." }));
          </span>
        </div>
      )}
    </div>
  );

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
        {isDesktop ? (
          <>
            {renderChromeExtensionCard(true)}
            {renderMobileShareCard(false)}
            {renderBookmarkletCard()}
          </>
        ) : (
          <>
            {renderMobileShareCard(true)}
            {renderChromeExtensionCard(false)}
            {renderBookmarkletCard()}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
