import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Calendar,
  MapPin,
  Phone,
  Cake,
  CheckCircle2,
  Crown,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  Loader2,
  UserCheck,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useTierLimits } from '@/hooks/useTierLimits';
import { fetchAndPrepareGoogleProfile } from '@/lib/googleSync';
import {
  ONBOARDING_TOUR_PENDING_KEY,
  ONBOARDING_TOUR_COMPLETED_KEY,
} from '@/lib/onboardingStore';
import { toast } from 'sonner';

const SETUP_BAR_DISMISSED_KEY = 'dressapp.closet_setup_bar_dismissed';

export default function ClosetGuidedTour({
  itemCount = 0,
  onOpenMigration,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, updateUserLocal, refresh } = useAuth();
  const { canAccessMigration } = useTierLimits();

  // Calendar status
  const [calendarConnected, setCalendarConnected] = useState(() =>
    Boolean(
      user?.google_calendar_tokens?.refresh_token ||
        user?.google_calendar_tokens?.access_token ||
        user?.calendar_connected
    )
  );
  const [connectingCalendar, setConnectingCalendar] = useState(false);

  // Setup Bar dismissal
  const [barDismissed, setBarDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SETUP_BAR_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Quick Profile Modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [dob, setDob] = useState(user?.date_of_birth || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState({
    line1: user?.address?.line1 || '',
    city: user?.address?.city || '',
    region: user?.address?.region || '',
    postal_code: user?.address?.postal_code || '',
    country: user?.address?.country || '',
  });

  // Guided Tour state
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  // Keep form synced when user object updates
  useEffect(() => {
    if (!user) return;
    if (user.date_of_birth && !dob) setDob(user.date_of_birth);
    if (user.phone && !phone) setPhone(user.phone);
    if (user.address) {
      setAddress((prev) => ({
        line1: prev.line1 || user.address?.line1 || '',
        city: prev.city || user.address?.city || '',
        region: prev.region || user.address?.region || '',
        postal_code: prev.postal_code || user.address?.postal_code || '',
        country: prev.country || user.address?.country || '',
      }));
    }
  }, [user, dob, phone]);

  // Check calendar connection status once on mount & handle post-OAuth return
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    api
      .calendarStatus()
      .then((res) => {
        if (mounted && res) {
          setCalendarConnected(Boolean(res.connected));
        }
      })
      .catch(() => {});

    // Listen for ?calendar=connected or ?calendar=error from Google OAuth redirect
    const cal = searchParams.get('calendar');
    if (cal === 'connected') {
      setCalendarConnected(true);
      toast.success(t('calendar.connected', { defaultValue: 'Google Calendar connected successfully!' }));
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('calendar');
      setSearchParams(nextParams, { replace: true });
      refresh?.().catch(() => {});
    } else if (cal === 'error') {
      const reason = searchParams.get('reason') || 'unknown_error';
      toast.error(`${t('calendar.connectFailed', { defaultValue: 'Connection failed' })}: ${reason.replaceAll('_', ' ')}`);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('calendar');
      nextParams.delete('reason');
      setSearchParams(nextParams, { replace: true });
    }

    return () => {
      mounted = false;
    };
  }, [user, searchParams, setSearchParams, t, refresh]);

  // Auto-launch tour for newly onboarded users landing in /closet or when triggered via ?tour=1 / custom event
  useEffect(() => {
    const forceTourFromParam = searchParams.get('tour') === '1';
    if (forceTourFromParam) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('tour');
      setSearchParams(nextParams, { replace: true });
      const timer = setTimeout(() => {
        setTourStep(0);
        setTourOpen(true);
        try {
          localStorage.removeItem(ONBOARDING_TOUR_PENDING_KEY);
        } catch {}
      }, 250);
      return () => clearTimeout(timer);
    }

    if (!user) return;
    try {
      const pending = localStorage.getItem(ONBOARDING_TOUR_PENDING_KEY) === 'true';
      const completed = localStorage.getItem(ONBOARDING_TOUR_COMPLETED_KEY) === 'true';
      if (pending || (!completed && itemCount <= 6)) {
        const timer = setTimeout(() => {
          setTourStep(0);
          setTourOpen(true);
          localStorage.removeItem(ONBOARDING_TOUR_PENDING_KEY);
        }, 450);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore storage errors
    }
  }, [user, itemCount, searchParams, setSearchParams]);

  useEffect(() => {
    const onCustomTourLaunch = () => {
      setTourStep(0);
      setTourOpen(true);
      try {
        localStorage.removeItem(ONBOARDING_TOUR_PENDING_KEY);
      } catch {}
    };
    window.addEventListener('dressapp:start-grand-tour', onCustomTourLaunch);
    return () => window.removeEventListener('dressapp:start-grand-tour', onCustomTourLaunch);
  }, []);

  // Profile completion calculation
  const completion = useMemo(() => {
    const bm = user?.body_measurements || user?.measurements || {};
    const hasStyleDna = Boolean(
      (bm.height || bm.height_cm) ||
        (Array.isArray(user?.style_profile?.aesthetics) &&
          user.style_profile.aesthetics.length > 0)
    );
    const hasCalendar = Boolean(calendarConnected);
    const hasDob = Boolean(user?.date_of_birth);
    const hasPhone = Boolean(user?.phone && String(user.phone).trim().length >= 5);
    const hasAddress = Boolean(
      user?.address?.city || user?.address?.line1 || user?.address?.country
    );

    const pillars = [
      { key: 'styleDna', done: hasStyleDna },
      { key: 'calendar', done: hasCalendar },
      { key: 'dob', done: hasDob },
      { key: 'phone', done: hasPhone },
      { key: 'address', done: hasAddress },
    ];
    const doneCount = pillars.filter((p) => p.done).length;
    const pct = Math.round((doneCount / pillars.length) * 100);

    return {
      hasStyleDna,
      hasCalendar,
      hasDob,
      hasPhone,
      hasAddress,
      hasAllPersonalDetails: hasDob && hasPhone && hasAddress,
      doneCount,
      totalCount: pillars.length,
      pct,
      isComplete: doneCount === pillars.length,
    };
  }, [user, calendarConnected]);

  // Tour steps definition
  const steps = useMemo(
    () => [
      {
        id: 'add_clothes',
        selectors: ['[data-testid="closet-add-button"]', '[data-testid="bottom-tab-capture"]'],
        badge: t('closetTour.step1.badge', { defaultValue: 'Step 1 of 4 • Digitize Your Closet' }),
        title: t('closetTour.step1.title', {
          defaultValue: 'Add Your Real Clothes with AI Cutout',
        }),
        description: t('closetTour.step1.desc', {
          defaultValue:
            'Snap a photo or upload from your gallery. DressApp automatically removes the background, detects 12 style attributes, and places each piece in your closet. Free users with 15+ AI reconstruction credits (via AI credit packs) and Manager & Pro members can also use Cluster Upload to photograph a whole shelf, rack, or pile at once!',
        }),
        primaryActionLabel: t('closetTour.step1.actionBtn', {
          defaultValue: 'Add Your First Garment',
        }),
        onPrimaryAction: () => {
          handleCloseTour();
          navigate('/closet/add');
        },
      },
      {
        id: 'stylist_calendar',
        selectors: ['[data-testid="topnav-link-stylist"]', '[data-testid="bottom-tab-stylist"]'],
        badge: t('closetTour.step2.badge', { defaultValue: 'Step 2 of 4 • Daily AI Stylist' }),
        title: t('closetTour.step2.title', {
          defaultValue: 'Weather & Calendar-Aware Outfit Styling',
        }),
        description: t('closetTour.step2.desc', {
          defaultValue:
            'Your AI Stylist dresses your calibrated avatar head-to-toe using your real clothes and Starter Capsule. Connect your Google Calendar so it automatically styles you for upcoming meetings, dinners, workouts, and trips!',
        }),
        primaryActionLabel: calendarConnected
          ? t('closetTour.step2.calendarConnectedBtn', { defaultValue: 'Calendar Connected ✓' })
          : t('closetTour.step2.connectCalendarBtn', {
              defaultValue: 'Connect Google Calendar',
            }),
        primaryActionDisabled: calendarConnected || connectingCalendar,
        onPrimaryAction: () => {
          if (!calendarConnected) {
            handleConnectCalendar();
          }
        },
      },
      {
        id: 'search_and_migration',
        selectors: ['[data-testid="closet-filter-bar"]', '[data-testid="closet-hero-actions"]'],
        badge: t('closetTour.step3.badge', {
          defaultValue: 'Step 3 of 4 • Smart Search & Pro Migration',
        }),
        title: t('closetTour.step3.title', {
          defaultValue: 'Semantic AI Search, Suitcase & Bulk Import',
        }),
        description: canAccessMigration
          ? t('closetTour.step3.descPro', {
              defaultValue:
                'Search your closet in natural language ("navy blazer for a rainy meeting"), pack smart suitcases for trips, or use the Wardrobe Migration Agent to bulk-import 50+ items from Whering, Acloset, Stylebook, or Indyx.',
            })
          : t('closetTour.step3.descFree', {
              defaultValue:
                'Search your closet in natural language ("linen shirt for warm weather") and build smart packing lists. Note: Free accounts use our on-premises Eyes AI (up to 50 closet items). Bulk Wardrobe Migration from other apps is unlocked on Manager & Professional plans.',
            }),
        primaryActionLabel: canAccessMigration
          ? t('closetTour.step3.openMigrationBtn', { defaultValue: 'Open Migration Agent' })
          : t('closetTour.step3.viewProPlansBtn', {
              defaultValue: 'Unlock Pro Migration (50+ Items)',
            }),
        isProAction: !canAccessMigration,
        onPrimaryAction: () => {
          handleCloseTour();
          if (canAccessMigration && typeof onOpenMigration === 'function') {
            onOpenMigration();
          } else {
            navigate('/pricing');
          }
        },
      },
      {
        id: 'profile_powerup',
        selectors: [
          '[data-testid="closet-profile-setup-bar"]',
          '[data-testid="topnav-avatar-button"]',
          '[data-testid="bottom-tab-me"]',
        ],
        badge: t('closetTour.step4.badge', {
          defaultValue: 'Step 4 of 4 • 30-Second Profile Power-Up',
        }),
        title: t('closetTour.step4.title', {
          defaultValue: 'Complete Your Profile for Hyper-Local Styling',
        }),
        description: t('closetTour.step4.desc', {
          defaultValue:
            'Onboarding calibrated your Style DNA & Avatar! Add your Address (for local daily weather forecasts), Date of Birth (for age-calibrated looks), and Phone Number (for Marketplace & Stylist alerts)—or auto-fill them from Google in 1 click.',
        }),
        primaryActionLabel: t('closetTour.step4.completeProfileBtn', {
          defaultValue: 'Complete Profile Now',
        }),
        onPrimaryAction: () => {
          handleCloseTour();
          setProfileModalOpen(true);
        },
      },
    ],
    [t, calendarConnected, connectingCalendar, canAccessMigration, navigate, onOpenMigration]
  );

  // Measure and spotlight the current step's target DOM element
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
      } catch {
        // ignore
      }
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
  }, [tourOpen, tourStep, updateSpotlight]);

  const handleCloseTour = () => {
    setTourOpen(false);
    try {
      localStorage.setItem(ONBOARDING_TOUR_COMPLETED_KEY, 'true');
      localStorage.removeItem(ONBOARDING_TOUR_PENDING_KEY);
    } catch {
      // ignore
    }
  };

  const handleStartTour = () => {
    setTourStep(0);
    setTourOpen(true);
  };

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const res = await api.googleOAuthStart('/closet');
      if (res?.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        toast.error(
          t('closetTour.calendarError', {
            defaultValue: 'Could not start Google Calendar connection.',
          })
        );
      }
    } catch (err) {
      toast.error(
        err?.message ||
          t('closetTour.calendarError', {
            defaultValue: 'Could not start Google Calendar connection.',
          })
      );
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleSyncFromGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await fetchAndPrepareGoogleProfile({
        date_of_birth: dob,
        phone,
        sex: user?.sex || '',
        address,
      });

      const patchData = res?.newForm || res?.patch;
      const hasFields = Boolean(
        patchData?.date_of_birth ||
        patchData?.phone ||
        patchData?.address?.city ||
        patchData?.address?.line1
      );

      if (patchData && hasFields) {
        if (patchData.date_of_birth) setDob(patchData.date_of_birth);
        if (patchData.phone) setPhone(patchData.phone);
        if (patchData.address) {
          setAddress((prev) => ({
            ...prev,
            ...patchData.address,
          }));
        }
        if (res.updated) {
          updateUserLocal?.(res.updated);
        }
        await refresh?.().catch(() => {});
        toast.success(
          t('closetTour.googleSyncedSuccess', {
            defaultValue: 'Synced profile details from your Google account!',
          })
        );
      } else {
        // Request incremental People API consent if no fields were returned
        const consent = await api.googleReConsent(false, '/closet');
        if (consent?.authorization_url) {
          window.location.href = consent.authorization_url;
          return;
        }
        toast.info(
          t('closetTour.googleSyncNoNewFields', {
            defaultValue:
              'No public birthday, phone, or address found on your Google profile. Please fill them in below.',
          })
        );
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (
        detail === 'missing_people_scopes' ||
        detail === 'Google account not connected.' ||
        err?.response?.status === 403 ||
        err?.response?.status === 409
      ) {
        try {
          const consent = await api.googleReConsent(false, '/closet');
          if (consent?.authorization_url) {
            window.location.href = consent.authorization_url;
            return;
          }
        } catch {
          // fall through
        }
      }
      toast.error(
        detail ||
          err?.message ||
          t('closetTour.googleSyncError', {
            defaultValue: 'Could not sync from Google. Please fill in the fields below.',
          })
      );
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleSaveQuickProfile = async (e) => {
    e?.preventDefault?.();
    setSavingProfile(true);
    try {
      const payload = {
        date_of_birth: dob || null,
        phone: phone?.trim() || null,
        address: {
          ...(user?.address || {}),
          line1: address.line1?.trim() || '',
          city: address.city?.trim() || '',
          region: address.region?.trim() || '',
          postal_code: address.postal_code?.trim() || '',
          country: address.country?.trim() || '',
        },
      };
      const updated = await api.patchMe(payload);
      if (updated) {
        updateUserLocal?.(updated);
      }
      await refresh?.().catch(() => {});
      toast.success(
        t('closetTour.profileSavedToast', {
          defaultValue: 'Profile updated! Your AI Stylist now has your full context.',
        })
      );
      setProfileModalOpen(false);
    } catch (err) {
      toast.error(
        err?.message ||
          t('closetTour.profileSaveError', {
            defaultValue: 'Could not save your profile details. Please try again.',
          })
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDismissBar = () => {
    setBarDismissed(true);
    try {
      sessionStorage.setItem(SETUP_BAR_DISMISSED_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const currentTourStep = steps[tourStep] || steps[0];

  // Compute popover card position relative to spotlightRect
  const popoverStyle = useMemo(() => {
    if (typeof window === 'undefined' || !spotlightRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;

    // Mobile view: dock balloon as a clean, responsive bottom or top card
    // guaranteeing zero overlay on the target element and zero horizontal overflow.
    if (isMobile) {
      const cardWidth = Math.max(280, vw - 24);
      const targetMidY = spotlightRect.top + spotlightRect.height / 2;
      const isTargetInTopHalf = targetMidY <= vh * 0.52;

      return {
        left: '12px',
        right: '12px',
        width: `${cardWidth}px`,
        maxWidth: `${cardWidth}px`,
        top: isTargetInTopHalf ? 'auto' : '16px',
        bottom: isTargetInTopHalf ? '16px' : 'auto',
        transform: 'none',
      };
    }

    const cardMaxWidth = Math.min(400, vw - 24);
    const spaceBelow = vh - (spotlightRect.top + spotlightRect.height);
    const cardH = 260;
    const GAP = 16;
    const placeAbove = (spaceBelow < cardH + GAP + 24 && spotlightRect.top >= cardH + GAP) || (spaceBelow < 200 && spotlightRect.top > spaceBelow);

    const top = placeAbove
      ? Math.max(16, spotlightRect.top - cardH - GAP)
      : Math.min(vh - cardH - 14, spotlightRect.top + spotlightRect.height + GAP);

    const centerLeft = spotlightRect.left + spotlightRect.width / 2 - cardMaxWidth / 2;
    const left = Math.max(12, Math.min(vw - cardMaxWidth - 12, centerLeft));

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardMaxWidth}px`,
    };
  }, [spotlightRect]);

  if (!user) return null;

  return (
    <>
      {/* ===================================================================== */}
      {/* PROGRESSIVE PROFILE & CALENDAR SETUP BAR + GUIDED TOUR LAUNCHER       */}
      {/* ===================================================================== */}
      {!completion.isComplete && !barDismissed ? (
        <div
          className="mb-5 rounded-[16px] border border-primary-brand/25 bg-white shadow-xs p-3.5 md:p-4 transition-all"
          data-testid="closet-profile-setup-bar"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Title & Progress Percentage */}
            <div className="flex items-center gap-3 min-w-[220px] flex-1">
              <div className="h-10 w-10 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0 font-bold text-xs">
                {completion.pct}%
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-dark-brand">
                    {t('closetTour.setupBar.title', {
                      defaultValue: 'Finish Your AI Stylist & Profile Setup',
                    })}
                  </h3>
                  <Badge className="bg-primary-brand/10 text-primary-brand border-none text-[11px] font-bold px-2 py-0.5">
                    {t('closetTour.setupBar.stepsCount', {
                      done: completion.doneCount,
                      total: completion.totalCount,
                      defaultValue: `${completion.doneCount}/${completion.totalCount} Complete`,
                    })}
                  </Badge>
                </div>
                <p className="text-xs text-text-brand mt-0.5 line-clamp-1">
                  {t('closetTour.setupBar.subtitle', {
                    defaultValue:
                      'Unlock hyper-local weather styling, schedule-aware outfits, and Marketplace alerts in 30 seconds.',
                  })}
                </p>
              </div>
            </div>

            {/* Right: Interactive Action Chips + Guided Tour Button */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Style DNA (Done) */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {t('closetTour.setupBar.chipStyleDna', {
                    defaultValue: 'Style DNA & Avatar',
                  })}
                </span>
              </span>

              {/* 2. Google Calendar Chip */}
              <button
                type="button"
                onClick={
                  completion.hasCalendar
                    ? () => setProfileModalOpen(true)
                    : handleConnectCalendar
                }
                disabled={connectingCalendar}
                data-testid="closet-setup-calendar-chip"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  completion.hasCalendar
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-primary-shadow text-primary-brand border-primary-brand/30 hover:bg-primary-brand hover:text-white'
                }`}
              >
                {connectingCalendar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : completion.hasCalendar ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {completion.hasCalendar
                    ? t('closetTour.setupBar.chipCalendarDone', {
                        defaultValue: 'Calendar Synced',
                      })
                    : t('closetTour.setupBar.chipCalendarConnect', {
                        defaultValue: '+ Connect Calendar',
                      })}
                </span>
              </button>

              {/* 3. Personal Details (DOB, Phone, Address) Chip */}
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                data-testid="closet-open-quick-profile-btn"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  completion.hasAllPersonalDetails
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                {completion.hasAllPersonalDetails ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                )}
                <span>
                  {completion.hasAllPersonalDetails
                    ? t('closetTour.setupBar.chipProfileDone', {
                        defaultValue: 'Address, Phone & Birthday',
                      })
                    : t('closetTour.setupBar.chipProfileAdd', {
                        defaultValue: '+ Add Address, Phone & Birthday',
                      })}
                </span>
              </button>

              {/* 4. Replay Guided Tour Button */}
              <button
                type="button"
                onClick={handleStartTour}
                data-testid="closet-start-tour-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/70 text-dark-brand hover:bg-secondary border border-border transition-all cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-primary-brand shrink-0" />
                <span>
                  {t('closetTour.setupBar.tourBtn', {
                    defaultValue: 'Guided Tour',
                  })}
                </span>
              </button>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={handleDismissBar}
                aria-label={t('common.dismiss', { defaultValue: 'Dismiss' })}
                data-testid="closet-setup-bar-dismiss"
                className="p-1.5 rounded-full text-text-brand hover:text-dark-brand hover:bg-secondary/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Compact Tour Launcher Pill when Setup Bar is completed or dismissed */
        <div className="mb-3 flex items-center justify-end gap-2">
          {!completion.isComplete && (
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              data-testid="closet-open-quick-profile-compact-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                {t('closetTour.setupBar.completeProfileCompact', {
                  pct: completion.pct,
                  defaultValue: `Complete Profile (${completion.pct}%)`,
                })}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleStartTour}
            data-testid="closet-start-tour-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white text-dark-brand border border-border hover:border-primary-brand hover:text-primary-brand transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-primary-brand shrink-0" />
            <span>
              {t('closetTour.setupBar.tourBtn', {
                defaultValue: 'Guided Tour',
              })}
            </span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4-STEP INTERACTIVE SPOTLIGHT GUIDED TOUR OVERLAY                      */}
      {/* ===================================================================== */}
      {tourOpen && (
        <div
          className="fixed inset-0 z-[120] pointer-events-auto"
          role="dialog"
          aria-modal="true"
          data-testid="closet-guided-tour-overlay"
        >
          {/* Dimmed backdrop when no target rect is found */}
          {!spotlightRect && (
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-[1px] transition-opacity"
              onClick={handleCloseTour}
            />
          )}

          {/* Spotlight Cutout Box with 9999px shadow mask */}
          {spotlightRect && (
            <div
              className="fixed rounded-[14px] pointer-events-none transition-all duration-300 ease-out ring-4 ring-primary-brand ring-offset-2 ring-offset-transparent"
              style={{
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.left}px`,
                width: `${spotlightRect.width}px`,
                height: `${spotlightRect.height}px`,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.68)',
              }}
            />
          )}

          {/* Floating Spotlight Coachmark Card */}
          <div
            style={popoverStyle}
            className="fixed z-[121] bg-white rounded-[20px] border border-border shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
            data-testid={`closet-tour-step-${tourStep + 1}`}
          >
            {/* Header: Step Badge & Close Button */}
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-primary-shadow text-primary-brand border-none px-2.5 py-1 text-[11px] font-bold">
                <Sparkles className="w-3 h-3 me-1 inline" />
                {currentTourStep.badge}
              </Badge>
              <button
                type="button"
                onClick={handleCloseTour}
                aria-label={t('common.close', { defaultValue: 'Close' })}
                data-testid="closet-tour-skip-btn"
                className="text-xs font-semibold text-text-brand hover:text-dark-brand inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-secondary/60"
              >
                <span>{t('closetTour.skipTour', { defaultValue: 'Skip tour' })}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step Title & Explanation */}
            <div className="space-y-1.5 text-start">
              <h3 className="text-base md:text-lg font-bold text-dark-brand leading-snug">
                {currentTourStep.title}
              </h3>
              <p className="text-xs md:text-sm text-text-brand leading-relaxed">
                {currentTourStep.description}
              </p>
            </div>

            {/* Contextual Action Button inside the Tour Card */}
            {currentTourStep.primaryActionLabel && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentTourStep.primaryActionDisabled}
                  onClick={currentTourStep.onPrimaryAction}
                  data-testid="closet-tour-context-action-btn"
                  className={`w-full rounded-full h-9 text-xs font-bold flex items-center justify-center gap-1.5 ${
                    currentTourStep.isProAction
                      ? 'border-amber-500/40 bg-amber-50/80 text-amber-900 hover:bg-amber-100'
                      : 'border-primary-brand/40 bg-primary-shadow/60 text-primary-brand hover:bg-primary-brand hover:text-white'
                  }`}
                >
                  {currentTourStep.isProAction && (
                    <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  )}
                  <span>{currentTourStep.primaryActionLabel}</span>
                </Button>
              </div>
            )}

            {/* Footer: Progress Dots + Back / Next / Finish */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTourStep(idx)}
                    aria-label={`Step ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      idx === tourStep
                        ? 'w-6 bg-primary-brand'
                        : 'w-2 bg-border hover:bg-primary-brand/50'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {tourStep > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTourStep((prev) => Math.max(0, prev - 1))}
                    data-testid="closet-tour-prev-btn"
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
                    onClick={() => setTourStep((prev) => Math.min(steps.length - 1, prev + 1))}
                    data-testid="closet-tour-next-btn"
                    className="rounded-full h-8 px-4 text-xs font-semibold bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)]"
                  >
                    <span>{t('common.next', { defaultValue: 'Next' })}</span>
                    <ArrowRight className="w-3.5 h-3.5 ms-1 rtl:rotate-180" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCloseTour}
                    data-testid="closet-tour-finish-btn"
                    className="rounded-full h-8 px-4 text-xs font-semibold bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)]"
                  >
                    <span>{t('closetTour.finishBtn', { defaultValue: 'Done' })}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* QUICK PROFILE & CALENDAR POWER-UP MODAL                               */}
      {/* ===================================================================== */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent
          className="max-w-lg w-full bg-white rounded-[20px] border border-border p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          data-testid="quick-profile-modal"
        >
          <DialogHeader className="text-start space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-primary-shadow text-primary-brand border-none px-2.5 py-1 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 me-1 inline" />
                {t('closetTour.modal.badge', {
                  pct: completion.pct,
                  defaultValue: `Profile ${completion.pct}% Complete`,
                })}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold text-dark-brand">
              {t('closetTour.modal.title', {
                defaultValue: 'Complete Your Profile in 30 Seconds',
              })}
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm text-text-brand">
              {t('closetTour.modal.subtitle', {
                defaultValue:
                  'These details power local daily weather outfits, age-appropriate styling, calendar event prep, and Marketplace delivery.',
              })}
            </DialogDescription>
          </DialogHeader>

          {/* 1-Click Auto-Fill from Google Account */}
          <div className="rounded-[14px] border border-primary-brand/25 bg-primary-shadow/50 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 flex-1 min-w-[180px] text-start">
              <div className="text-xs font-bold text-dark-brand">
                {t('closetTour.modal.googleSyncTitle', {
                  defaultValue: 'Auto-Fill from Google Account',
                })}
              </div>
              <div className="text-[11px] text-text-brand">
                {t('closetTour.modal.googleSyncSub', {
                  defaultValue:
                    'Import your birthday, phone number, and address from Google in one click.',
                })}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncingGoogle}
              onClick={handleSyncFromGoogle}
              data-testid="quick-profile-google-sync-btn"
              className="rounded-full h-9 px-3.5 text-xs font-bold border border-primary-brand/40 text-primary-brand bg-white hover:!bg-primary-brand hover:!text-white transition-colors shrink-0"
            >
              {syncingGoogle ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 me-1.5" />
              )}
              <span>
                {t('closetTour.modal.googleSyncBtn', {
                  defaultValue: 'Sync from Google',
                })}
              </span>
            </Button>
          </div>

          {/* Google Calendar Sync Row */}
          <div className="rounded-[14px] border border-border bg-secondary/25 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-[180px] text-start">
              <div className="h-9 w-9 rounded-full bg-primary-shadow text-primary-brand flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-dark-brand">
                  {t('closetTour.modal.calendarTitle', {
                    defaultValue: 'Google Calendar Event Styling',
                  })}
                </div>
                <div className="text-[11px] text-text-brand">
                  {t('closetTour.modal.calendarSub', {
                    defaultValue:
                      'Automatically dress for your meetings, weddings, workouts, and flights.',
                  })}
                </div>
              </div>
            </div>
            {completion.hasCalendar ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {t('closetTour.modal.calendarConnected', {
                    defaultValue: 'Connected',
                  })}
                </span>
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={connectingCalendar}
                onClick={handleConnectCalendar}
                data-testid="quick-profile-connect-calendar-btn"
                className="rounded-full h-8 px-3 text-xs font-bold border border-primary-brand/40 text-primary-brand bg-white hover:!bg-primary-brand hover:!text-white transition-colors"
              >
                {connectingCalendar && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin me-1" />
                )}
                <span>
                  {t('closetTour.modal.connectCalendarBtn', {
                    defaultValue: 'Connect Calendar',
                  })}
                </span>
              </Button>
            )}
          </div>

          {/* Explanatory OAuth notice for Google verification */}
          <div className="rounded-[12px] bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {t('closetTour.modal.oauthTip', {
                defaultValue:
                  'Note: When connecting Google Calendar, Google may display an \'Unverified app\' screen. Click \'Advanced\' (מתקדם) then \'Go to DressApp\' (מעבר אל) to approve calendar access.',
              })}
            </span>
          </div>

          {/* Inline Form for DOB, Phone, and Weather/Shipping Address */}
          <form onSubmit={handleSaveQuickProfile} className="space-y-3.5 text-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date of Birth */}
              <div className="space-y-1">
                <Label htmlFor="quick-profile-dob" className="text-xs font-bold flex items-center gap-1.5">
                  <Cake className="w-3.5 h-3.5 text-primary-brand" />
                  <span>
                    {t('closetTour.modal.dobLabel', {
                      defaultValue: 'Date of Birth',
                    })}
                  </span>
                </Label>
                <Input
                  id="quick-profile-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  data-testid="quick-profile-dob-input"
                  className="h-9 text-xs"
                />
                <p className="text-[10px] text-text-brand">
                  {t('closetTour.modal.dobHint', {
                    defaultValue: 'For age-calibrated looks & birthday credit perks.',
                  })}
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <Label htmlFor="quick-profile-phone" className="text-xs font-bold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary-brand" />
                  <span>
                    {t('closetTour.modal.phoneLabel', {
                      defaultValue: 'Mobile Phone',
                    })}
                  </span>
                </Label>
                <Input
                  id="quick-profile-phone"
                  type="tel"
                  placeholder="+1 555 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="quick-profile-phone-input"
                  className="h-9 text-xs"
                />
                <p className="text-[10px] text-text-brand">
                  {t('closetTour.modal.phoneHint', {
                    defaultValue: 'For Marketplace buyer/seller & Stylist alerts.',
                  })}
                </p>
              </div>
            </div>

            {/* City / Address with OpenStreetMap Nominatim Autocomplete */}
            <div className="space-y-1.5">
              <Label htmlFor="quick-profile-city" className="text-xs font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary-brand" />
                <span>
                  {t('closetTour.modal.addressLabel', {
                    defaultValue: 'City & Street Address (Weather & Marketplace)',
                  })}
                </span>
              </Label>
              <AddressAutocomplete
                inputId="quick-profile-city"
                testid="quick-profile-city-input"
                kind="city"
                value={address.city}
                onChange={(val) => setAddress((prev) => ({ ...prev, city: val }))}
                onSelect={(patch) =>
                  setAddress((prev) => ({
                    ...prev,
                    city: patch.city || prev.city,
                    region: patch.region || prev.region,
                    postal_code: patch.postal_code || prev.postal_code,
                    country: patch.country || prev.country,
                    line1: patch.line1 || prev.line1,
                  }))
                }
                placeholder={t('closetTour.modal.cityPlaceholder', {
                  defaultValue: 'Start typing your city (e.g., Tel Aviv, London, New York)...',
                })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Input
                  placeholder={t('closetTour.modal.streetPlaceholder', {
                    defaultValue: 'Street & house number',
                  })}
                  value={address.line1}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, line1: e.target.value }))
                  }
                  data-testid="quick-profile-street-input"
                  className="h-9 text-xs"
                />
                <Input
                  placeholder={t('closetTour.modal.countryPlaceholder', {
                    defaultValue: 'Country',
                  })}
                  value={address.country}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, country: e.target.value }))
                  }
                  data-testid="quick-profile-country-input"
                  className="h-9 text-xs"
                />
              </div>
              <p className="text-[10px] text-text-brand">
                {t('closetTour.modal.addressHint', {
                  defaultValue:
                    'Powers hyper-local daily weather forecasts for your outfits and Marketplace shipping.',
                })}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfileModalOpen(false)}
                className="rounded-full h-9 px-4 text-xs font-semibold"
              >
                {t('common.later', { defaultValue: 'Later' })}
              </Button>
              <Button
                type="submit"
                disabled={savingProfile}
                data-testid="quick-profile-save-btn"
                className="rounded-full h-9 px-5 text-xs font-bold bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)]"
              >
                {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />}
                <span>
                  {t('closetTour.modal.saveBtn', {
                    defaultValue: 'Save & Power Up Stylist',
                  })}
                </span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
