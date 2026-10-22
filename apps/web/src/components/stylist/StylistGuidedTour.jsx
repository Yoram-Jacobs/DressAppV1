import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Compass,
  Shirt,
  CalendarDays,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  STYLIST_TOUR_PENDING_KEY,
  STYLIST_TOUR_COMPLETED_KEY,
} from '@/lib/onboardingStore';

export default function StylistGuidedTour() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const cardRef = React.useRef(null);
  const [measuredCardHeight, setMeasuredCardHeight] = useState(260);

  useEffect(() => {
    if (cardRef.current) {
      const h = cardRef.current.offsetHeight;
      if (h > 0 && Math.abs(h - measuredCardHeight) > 4) {
        setMeasuredCardHeight(h);
      }
    }
  }, [tourStep, tourOpen, measuredCardHeight]);

  const popoverStyle = useMemo(() => {
    if (typeof window === 'undefined' || !spotlightRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 450px)',
      };
    }

    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const cardWidth = Math.min(450, vw - 24);
    const cardH = measuredCardHeight || 260;
    const GAP = 16;

    const spaceBelow = vh - (spotlightRect.top + spotlightRect.height);
    const spaceAbove = spotlightRect.top;

    // Position above target if space below is insufficient, ensuring zero overlay
    const placeAbove =
      (spaceBelow < cardH + GAP + 24 && spaceAbove >= cardH + GAP) ||
      (spaceBelow < 200 && spaceAbove > spaceBelow);

    let top;
    if (placeAbove) {
      top = Math.max(12, spotlightRect.top - cardH - GAP);
    } else {
      top = Math.min(vh - cardH - 12, spotlightRect.top + spotlightRect.height + GAP);
    }

    let left;
    if (spotlightRect.width < 500) {
      const targetCenter = spotlightRect.left + spotlightRect.width / 2;
      const idealLeft = targetCenter - cardWidth / 2;
      left = Math.max(12, Math.min(vw - cardWidth - 12, idealLeft));
    } else {
      left = Math.max(12, (vw - cardWidth) / 2);
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      transform: 'none',
    };
  }, [spotlightRect, measuredCardHeight]);

  // Tour steps definition
  const steps = useMemo(
    () => [
      {
        id: 'carousels',
        selectors: [
          '[data-testid="shuffler-carousels-container"]',
          '.md\\:col-span-3 .flex-col.gap-3\\.5',
        ],
        badge: t('stylistTour.step1.badge', {
          defaultValue: 'Step 1 of 4 • Your Starter Capsule',
        }),
        title: t('stylistTour.step1.title', {
          defaultValue: 'Mix & Match Separates',
        }),
        description: t('stylistTour.step1.desc', {
          defaultValue:
            'Your starter garments are organized into Tops, Bottoms, and Shoes rows. Swipe or click the arrows to browse and test different combinations fitted to your personal proportions.',
        }),
        icon: Shirt,
      },
      {
        id: 'shuffle',
        selectors: ['[data-testid="shuffler-generate-btn"]'],
        badge: t('stylistTour.step2.badge', {
          defaultValue: 'Step 2 of 4 • AI One-Click Shuffle',
        }),
        title: t('stylistTour.step2.title', {
          defaultValue: 'Instant AI Outfit Generation',
        }),
        description: t('stylistTour.step2.desc', {
          defaultValue:
            'Click "Generate New Outfit" anytime. DressApp evaluates color theory, seasonality, and your body proportions to harmonize a complete outfit in seconds.',
        }),
        icon: Sparkles,
      },
      {
        id: 'planner',
        selectors: [
          '[data-testid="shuffler-planner-sidebar"]',
          '[data-testid="stylist-open-calendar-btn"]',
        ],
        badge: t('stylistTour.step3.badge', {
          defaultValue: 'Step 3 of 4 • Schedule & Agenda Sync',
        }),
        title: t('stylistTour.step3.title', {
          defaultValue: 'Dress for Your Actual Day',
        }),
        description: t('stylistTour.step3.desc', {
          defaultValue:
            'Toggle "Today\'s Agenda" to match outfits to your Google Calendar meetings, or choose an occasion (Work, Casual, Party, Gym) for tailored dress codes.',
        }),
        icon: CalendarDays,
      },
      {
        id: 'save',
        selectors: ['[data-testid="shuffler-save-btn"]'],
        badge: t('stylistTour.step4.badge', {
          defaultValue: 'Step 4 of 4 • Save & Explore',
        }),
        title: t('stylistTour.step4.title', {
          defaultValue: 'Save Outfits & Visit Your Closet',
        }),
        description: t('stylistTour.step4.desc', {
          defaultValue:
            'Love an outfit? Click "Save Outfit" to add it to your Lookbook. Whenever you are ready to photograph and add your real clothes, head over to your Closet!',
        }),
        icon: ShoppingBag,
        primaryActionLabel: t('stylistTour.step4.closetBtn', {
          defaultValue: 'Explore My Closet',
        }),
        onPrimaryAction: () => {
          handleCloseTour();
          navigate('/closet');
        },
      },
    ],
    [t, navigate]
  );

  // Auto-launch tour when landing with ?onboarded=1, ?tour=1, or when pending flag exists
  useEffect(() => {
    const isOnboarded = searchParams.get('onboarded') === '1';
    const isTour = searchParams.get('tour') === '1';

    let isPending = false;
    let isCompleted = false;
    try {
      isPending = localStorage.getItem(STYLIST_TOUR_PENDING_KEY) === 'true';
      isCompleted = localStorage.getItem(STYLIST_TOUR_COMPLETED_KEY) === 'true';
    } catch {}

    if (isOnboarded || isTour || isPending || !isCompleted) {
      const nextParams = new URLSearchParams(searchParams);
      let changed = false;
      if (nextParams.has('onboarded')) {
        nextParams.delete('onboarded');
        changed = true;
      }
      if (nextParams.has('tour')) {
        nextParams.delete('tour');
        changed = true;
      }
      if (changed) {
        setSearchParams(nextParams, { replace: true });
      }

      const timer = setTimeout(() => {
        setTourStep(0);
        setTourOpen(true);
        try {
          localStorage.removeItem(STYLIST_TOUR_PENDING_KEY);
        } catch {}
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Listen for custom trigger events (e.g. from Help Menu or profile shortcuts)
  useEffect(() => {
    const handleStartEvent = () => {
      setTourStep(0);
      setTourOpen(true);
    };

    window.addEventListener('dressapp:start-stylist-tour', handleStartEvent);
    return () => {
      window.removeEventListener('dressapp:start-stylist-tour', handleStartEvent);
    };
  }, []);

  // Update spotlight rect when step changes
  const updateSpotlight = useCallback(() => {
    if (!tourOpen) return;
    const current = steps[tourStep];
    if (!current) return;

    let targetEl = null;
    for (const sel of current.selectors || []) {
      const candidate = document.querySelector(sel);
      if (candidate) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          targetEl = candidate;
          break;
        }
      }
    }

    if (!targetEl) {
      setSpotlightRect(null);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const inViewport =
      rect.top >= 60 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - 60;

    if (!inViewport) {
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }

    const freshRect = targetEl.getBoundingClientRect();
    setSpotlightRect({
      top: Math.max(8, freshRect.top - 6),
      left: Math.max(8, freshRect.left - 6),
      width: freshRect.width + 12,
      height: freshRect.height + 12,
    });
  }, [tourOpen, tourStep, steps]);

  useEffect(() => {
    if (!tourOpen) return;
    updateSpotlight();
    const timer = setTimeout(updateSpotlight, 280);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [tourOpen, updateSpotlight]);

  // Keyboard navigation
  useEffect(() => {
    if (!tourOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseTour();
      } else if (e.key === 'ArrowRight') {
        setTourStep((prev) => Math.min(steps.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setTourStep((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tourOpen, steps.length]);

  const handleCloseTour = () => {
    setTourOpen(false);
    try {
      localStorage.setItem(STYLIST_TOUR_COMPLETED_KEY, 'true');
      localStorage.removeItem(STYLIST_TOUR_PENDING_KEY);
    } catch {}
  };

  if (!tourOpen) return null;

  const currentStep = steps[tourStep] || steps[0];
  const StepIcon = currentStep.icon || Sparkles;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-auto select-none"
      data-testid="stylist-guided-tour-overlay"
    >
      {/* Dimmed backdrop with cutout spotlight */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onClick={handleCloseTour}
        aria-hidden="true"
      >
        <defs>
          <mask id="stylist-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#stylist-spotlight-mask)"
        />
      </svg>

      {/* Spotlight pulse outline around target */}
      {spotlightRect && (
        <div
          className="fixed pointer-events-none rounded-2xl border-2 border-primary-brand/80 shadow-[0_0_0_4px_rgba(47,110,81,0.25)] transition-all duration-300 animate-pulse"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Floating Tour Guide Dialog Card */}
      <div
        ref={cardRef}
        className="fixed z-50 transition-all duration-300 pointer-events-auto"
        style={popoverStyle}
      >
        <div className="bg-white/95 dark:bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-5 md:p-6 shadow-[0_16px_48px_rgba(20,30,25,0.22)] space-y-4">
          {/* Header Badge & Close */}
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border-primary-brand/40 bg-primary-shadow text-primary-brand flex items-center gap-1.5"
            >
              <StepIcon className="w-3.5 h-3.5 text-primary-brand" />
              <span>{currentStep.badge}</span>
            </Badge>

            <button
              type="button"
              onClick={handleCloseTour}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={t('closetTour.skipTour', { defaultValue: 'Skip tour' })}
              aria-label={t('closetTour.skipTour', { defaultValue: 'Skip tour' })}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5 text-start">
            <h3 className="text-base md:text-lg font-bold text-dark-brand leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs md:text-sm text-text-brand leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Optional Action Button */}
          {currentStep.primaryActionLabel && (
            <div className="pt-1">
              <Button
                type="button"
                onClick={currentStep.onPrimaryAction}
                data-testid="stylist-tour-action-btn"
                className="w-full rounded-full h-9 text-xs font-bold flex items-center justify-center gap-1.5 bg-primary-brand text-white hover:bg-primary-hover shadow-sm"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{currentStep.primaryActionLabel}</span>
              </Button>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            {/* Progress Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTourStep(idx)}
                  aria-label={`Step ${idx + 1}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === tourStep
                      ? 'w-6 bg-primary-brand'
                      : 'w-2 bg-border hover:bg-primary-brand/50'
                  }`}
                />
              ))}
            </div>

            {/* Back / Next / Finish Buttons */}
            <div className="flex items-center gap-2">
              {tourStep > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTourStep((prev) => Math.max(0, prev - 1))}
                  data-testid="stylist-tour-prev-btn"
                  className="rounded-full h-8 px-3 text-xs font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5 me-1 rtl:rotate-180" />
                  {t('common.back', { defaultValue: 'Back' })}
                </Button>
              )}

              {tourStep < steps.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setTourStep((prev) => Math.min(steps.length - 1, prev + 1))
                  }
                  data-testid="stylist-tour-next-btn"
                  className="rounded-full h-8 px-4 text-xs font-semibold bg-primary-brand text-white hover:bg-primary-hover shadow-sm"
                >
                  <span>{t('common.next', { defaultValue: 'Next' })}</span>
                  <ArrowRight className="w-3.5 h-3.5 ms-1 rtl:rotate-180" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCloseTour}
                  data-testid="stylist-tour-finish-btn"
                  className="rounded-full h-8 px-4 text-xs font-semibold bg-primary-brand text-white hover:bg-primary-hover shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                  <span>{t('closetTour.finishBtn', { defaultValue: 'Done' })}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
