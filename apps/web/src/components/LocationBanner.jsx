import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation as useAppLocation } from '@/lib/location';
import { useLocation as useRouteLocation } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Soft, once-per-device rationale banner that we surface on Stylist,
 * Marketplace and Home. Matches the UX pattern of a native mobile app's
 * first-run permission prompt. The actual browser permission dialog is
 * triggered only after the user taps "Use my location".
 */
export function LocationBanner() {
  const { t } = useTranslation();
  const { pathname } = useRouteLocation();
  const { request, dismissPrompt, shouldPrompt, permissionState } =
    useAppLocation();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const onRelevantSurface =
    pathname.startsWith('/stylist') ||
    pathname.startsWith('/market') ||
    pathname === '/home' ||
    pathname === '/';
  const visible =
    onRelevantSurface && !dismissed && shouldPrompt() && permissionState !== 'denied';

  const handleAllow = async () => {
    setBusy(true);
    try {
      await request();
      setDismissed(true);
      toast.success(t('location.granted'));
    } catch (err) {
      if (err?.code === 1) {
        toast.error(t('location.denied'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    dismissPrompt();
    setDismissed(true);
  };

  return (
  <AnimatePresence initial={false}>
  {visible ? (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="absolute top-[64px]
        p-[56px]
        -translate-x-1/2
        z-[9]
        w-[calc(100%-2rem)]
        max-w-[790px]
        max-[480px]:p-[20px]  max-[480px]:w-full"
      data-testid="location-banner"
    >
      <div className="relative rounded-[12px] border border-border bg-white p-3 md:p-4 flex items-start gap-3 shadow-md">
        <span className="h-9 w-9 rounded-full bg-primary-shadow flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-primary-brand" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] text-dark-brand">
            {t('location.title')}
          </div>

          <p className="font-semibold text-[12px] text-text-brand">
            {t('location.rationale')}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleAllow}
              disabled={busy}
              className="rounded-xl"
              data-testid="location-banner-allow-btn"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t('location.allow')
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDismiss}
              className=""
              data-testid="location-banner-dismiss-btn"
            >
              {t('location.notNow')}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('common.close')}
          className="h-7 w-7 rounded-full bg-primary-shadow flex items-center justify-center"
          data-testid="location-banner-close-btn"
        >
          <X className="h-4 w-4 text-primary-brand hover:text-dark-brand" />
        </button>
      </div>
    </motion.div>
  ) : null}
</AnimatePresence>
  );
}
