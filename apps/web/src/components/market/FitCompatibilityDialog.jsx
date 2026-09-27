import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, User, Tag, HelpCircle } from 'lucide-react';

export default function FitCompatibilityDialog({
  open,
  onOpenChange,
  onProceed,
  fitCheck,
  listing,
}) {
  const { t } = useTranslation();

  if (!fitCheck) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-[20px] bg-white border border-border p-6 shadow-xl" data-testid="fit-compatibility-dialog">
        <AlertDialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-bold text-dark-brand leading-tight">
                {t('market.fitCheck.dialogTitle', { defaultValue: 'Fit & Size Compatibility Notice' })}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-text-brand mt-0.5">
                {t('market.fitCheck.dialogSubtitle', {
                  defaultValue: 'The item details differ from your saved wardrobe profile.',
                })}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div className="p-3 rounded-[12px] bg-secondary/15 border border-border">
            <span className="text-[11px] font-bold text-text-brand block mb-1 uppercase tracking-wider">
              {t('market.fitCheck.itemListing', { defaultValue: 'Marketplace Item' })}
            </span>
            <div className="space-y-1 font-semibold text-dark-brand">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary-brand shrink-0" />
                <span>{t('addItem.size')}: <strong className="font-extrabold">{fitCheck.listingSize}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary-brand shrink-0" />
                <span>{t('addItem.gender')}: {fitCheck.listingGenderText}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-[12px] bg-primary-shadow/60 border border-primary-brand/30">
            <span className="text-[11px] font-bold text-primary-brand block mb-1 uppercase tracking-wider">
              {t('market.fitCheck.yourProfile', { defaultValue: 'Your Profile' })}
            </span>
            <div className="space-y-1 font-semibold text-dark-brand">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary-brand shrink-0" />
                <span>{t('addItem.size')}: <strong className="font-extrabold">{fitCheck.userSize}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary-brand shrink-0" />
                <span>{t('addItem.gender')}: {fitCheck.userGenderText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Reasoning points */}
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {fitCheck.reasoningPoints?.map((pt, idx) => (
            <div
              key={idx}
              className="p-3 rounded-[12px] bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs"
            >
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>{pt.title}</span>
              </div>
              <p className="leading-relaxed text-[11.5px] opacity-90">{pt.text}</p>
            </div>
          ))}
          {(!fitCheck.reasoningPoints || fitCheck.reasoningPoints.length === 0) && fitCheck.reasoning && (
            <div className="p-3 rounded-[12px] bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              {fitCheck.reasoning}
            </div>
          )}
        </div>

        <AlertDialogFooter className="mt-5 flex gap-2 sm:justify-end">
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            className="rounded-[10px] text-xs font-semibold"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              if (onProceed) onProceed();
            }}
            className="bg-primary-brand hover:bg-primary-brand/90 text-white rounded-[10px] text-xs font-bold gap-1.5"
            data-testid="proceed-fit-sandbox-btn"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('market.fitCheck.proceedAnyway', { defaultValue: 'Style Anyway' })}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
