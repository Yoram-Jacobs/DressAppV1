import React from 'react';
import { toast } from 'sonner';
import i18n from 'i18next';
import { Sparkles, ArrowRight } from 'lucide-react';

export function showAiKeyWarningToast(navigate) {
  const t = i18n.t.bind(i18n);
  toast.error(
    <div className="flex flex-col gap-2 text-start p-1">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
        <span>{t('aiNotice.geminiKeyRequired', { defaultValue: 'Gemini AI Key or Plan Required' })}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('aiNotice.geminiKeyDescription', { defaultValue: "To use DressApp's Gemini AI features (AI Stylist, GarmentVision, Image Editing, Reconstruction), please configure your Gemini API Key in your Profile settings." })}
      </p>
      <button
        onClick={() => {
          toast.dismiss('gemini-key-warning');
          if (navigate) {
            navigate('/profile?open=ai-config');
          } else {
            window.location.href = '/profile?open=ai-config';
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline self-start mt-1 cursor-pointer"
      >
        <span>{t('aiNotice.configureKey', { defaultValue: 'Configure API Key in Profile' })}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>,
    { duration: 10000, id: 'gemini-key-warning' }
  );
}
