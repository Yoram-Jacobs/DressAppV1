import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Ruler,
  CloudSun,
  Briefcase,
  Globe,
  MapPin,
  Wand2,
  ArrowRightLeft,
  Crown,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { LanguagePicker } from '@/components/LanguagePicker';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import SkinTonePicker from '@/components/SkinTonePicker';
import AvatarViewer from '@/components/AvatarViewer';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { closetStore } from '@/lib/closetStore';
import {
  labelForSubCategory,
  labelForColor,
  labelForMaterial,
} from '@/lib/taxonomy';
import {
  DEFAULT_ONBOARDING_DRAFT,
  getOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
  getStarterCapsuleForUser,
  validateStarterSelection,
  autoSelectStarterCapsule,
  assembleStarterOutfit,
  flushOnboardingDraftToBackend,
} from '@/lib/onboardingStore';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';

const PROGRESS_BY_STEP = {
  1: 20,
  2: 50,
  3: 80,
  4: 95,
};

const AESTHETIC_OPTIONS = [
  { id: 'minimalist', labelKey: 'onboarding.aesthetics.minimalist', defaultLabel: 'Minimalist & Clean' },
  { id: 'smart_casual', labelKey: 'onboarding.aesthetics.smartCasual', defaultLabel: 'Smart-Casual' },
  { id: 'business', labelKey: 'onboarding.aesthetics.business', defaultLabel: 'Business & Tailored Suits' },
  { id: 'traditional', labelKey: 'onboarding.aesthetics.traditional', defaultLabel: 'Cultural & Traditional (Kaftan · Thobe · Kurta)' },
  { id: 'modest', labelKey: 'onboarding.aesthetics.modest', defaultLabel: 'Modest & Flowing (Abaya · Jalabiya · Long Tunics)' },
  { id: 'dresses_skirts', labelKey: 'onboarding.aesthetics.dressesSkirts', defaultLabel: 'Dresses & Midi/Maxi Skirts' },
  { id: 'relaxed', labelKey: 'onboarding.aesthetics.relaxed', defaultLabel: 'Loose & Relaxed Comfort' },
  { id: 'classic', labelKey: 'onboarding.aesthetics.classic', defaultLabel: 'Timeless Classic' },
  { id: 'streetwear', labelKey: 'onboarding.aesthetics.streetwear', defaultLabel: 'Urban & Streetwear' },
];

const PALETTE_OPTIONS = [
  { id: 'neutrals', labelKey: 'onboarding.palettes.neutrals', defaultLabel: 'Warm Neutrals', swatches: ['#F5F2EB', '#D8C8B4', '#8C7A6B', '#2C2623'] },
  { id: 'monochrome', labelKey: 'onboarding.palettes.monochrome', defaultLabel: 'Monochrome & Slate', swatches: ['#FFFFFF', '#9CA3AF', '#4B5563', '#111827'] },
  { id: 'earth_tones', labelKey: 'onboarding.palettes.earthTones', defaultLabel: 'Earth & Olive', swatches: ['#E6D5B8', '#A47551', '#4A5D4E', '#5C3A24'] },
  { id: 'jewel_tones', labelKey: 'onboarding.palettes.jewelTones', defaultLabel: 'Royal & Jewel Tones', swatches: ['#145F37', '#192D73', '#6E1926', '#D4AF37'] },
  { id: 'pastels', labelKey: 'onboarding.palettes.pastels', defaultLabel: 'Soft Pastels', swatches: ['#FDE2E4', '#E2ECE9', '#DFE7FD', '#F0EFEB'] },
];

const CONSERVATIVENESS_OPTIONS = [
  { id: 'low', labelKey: 'onboarding.modesty.low', defaultLabel: 'Open / Contemporary' },
  { id: 'moderate', labelKey: 'onboarding.modesty.moderate', defaultLabel: 'Balanced / Smart' },
  { id: 'high', labelKey: 'onboarding.modesty.high', defaultLabel: 'Modest / Full Coverage' },
];

const OCCUPATION_OPTIONS = [
  { id: 'office_corporate', labelKey: 'onboarding.occupation.office', defaultLabel: 'Executive / Corporate Office' },
  { id: 'tech_creative', labelKey: 'onboarding.occupation.creative', defaultLabel: 'Tech / Creative Studio' },
  { id: 'remote_flexible', labelKey: 'onboarding.occupation.remote', defaultLabel: 'Remote / Hybrid' },
  { id: 'events_ceremonial', labelKey: 'onboarding.occupation.events', defaultLabel: 'Formal Events & Hospitality' },
  { id: 'student', labelKey: 'onboarding.occupation.student', defaultLabel: 'Campus / Student' },
  { id: 'active_onthego', labelKey: 'onboarding.occupation.active', defaultLabel: 'Active / On-the-Go' },
];

const PROFESSION_OPTIONS = [
  { id: 'personal_stylist', labelKey: 'onboarding.pro.personalStylist', defaultLabel: 'Personal Stylist' },
  { id: 'tailor', labelKey: 'onboarding.pro.tailor', defaultLabel: 'Bespoke Tailor' },
  { id: 'fashion_designer', labelKey: 'onboarding.pro.designer', defaultLabel: 'Fashion Designer' },
  { id: 'boutique_owner', labelKey: 'onboarding.pro.boutique', defaultLabel: 'Boutique / Brand Owner' },
  { id: 'image_consultant', labelKey: 'onboarding.pro.consultant', defaultLabel: 'Image Consultant' },
];

function computeFallbackPrediction({ height_cm, weight_kg, waist_cm, foot_length_cm, sex }) {
  const h = Number(height_cm) || 168;
  const w = Number(weight_kg) || 62;
  const wa = Number(waist_cm) || 72;
  const fl = Number(foot_length_cm) || 24.5;
  const isMale = sex === 'male';

  const shoulders = Math.round((isMale ? h * 0.255 : h * 0.232) * 10) / 10;
  const chest = Math.round((wa * (isMale ? 1.18 : 1.22)) * 10) / 10;
  const hip = Math.round((wa * (isMale ? 1.14 : 1.32)) * 10) / 10;
  const sleeve = Math.round((h * 0.36) * 10) / 10;
  const inseam = Math.round((h * 0.45) * 10) / 10;
  const outseam = Math.round((h * 0.61) * 10) / 10;

  let shirt_size = 'M';
  if (chest < 88) shirt_size = 'XS';
  else if (chest < 94) shirt_size = 'S';
  else if (chest < 102) shirt_size = 'M';
  else if (chest < 110) shirt_size = 'L';
  else shirt_size = 'XL';

  const pants_size = isMale ? `${Math.round(wa / 2.54)}W` : shirt_size;
  const shoe_size_us = Math.round(((fl - (isMale ? 18.5 : 17.5)) * 1.2 + 5) * 2) / 2;
  const dress_size = isMale ? 'N/A' : shirt_size;

  return {
    shoulders,
    chest,
    hip,
    sleeve,
    inseam,
    outseam,
    recommended_sizes: {
      shirt_size,
      pants_size,
      shoe_size_us,
      dress_size,
    },
  };
}

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const { user, updateUserLocal, refresh } = useAuth();

  const [draft, setDraft] = useState(() => {
    let saved = getOnboardingDraft();
    if (!saved) {
      saved = { ...DEFAULT_ONBOARDING_DRAFT };
    }
    if (!Array.isArray(saved.starter_item_ids) || saved.starter_item_ids.length === 0) {
      saved.starter_item_ids = autoSelectStarterCapsule(saved);
    }
    if (!saved.predicted_sizes || Object.keys(saved.predicted_sizes).length === 0) {
      saved.predicted_sizes = computeFallbackPrediction({
        ...saved.measurements,
        sex: saved.sex,
      });
    }
    return {
      ...saved,
      preferred_language: (i18n.language || 'en').split('-')[0].toLowerCase(),
    };
  });

  // Sync user's preferred_language or active i18n language into the onboarding draft
  useEffect(() => {
    const userLang = user?.preferred_language?.split('-')[0]?.toLowerCase();
    if (userLang && !localStorage.getItem('dressapp.lang') && i18n.language !== userLang) {
      i18n.changeLanguage(userLang).catch(() => {});
    }
  }, [user?.preferred_language, i18n]);

  useEffect(() => {
    const activeLang = (i18n.language || 'en').split('-')[0].toLowerCase();
    if (draft.preferred_language !== activeLang) {
      setDraft((prev) => saveOnboardingDraft({ preferred_language: activeLang }, prev));
    }
  }, [i18n.language, draft.preferred_language]);

  const [activeCategoryTab, setActiveCategoryTab] = useState('recommended');
  const [predictingFit, setPredictingFit] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState({
    tempC: 22,
    condition: 'Clear & Mild',
    city: null,
  });
  const [savingAuthenticated, setSavingAuthenticated] = useState(false);

  const step = draft.step || 1;
  const progressPct = PROGRESS_BY_STEP[step] || 20;
  const isImperial = draft.unit_system === 'imperial';

  const updateDraft = (patch) => {
    setDraft((prev) => saveOnboardingDraft(patch, prev));
  };

  // Keep starter capsule aligned when user switches sex in Step 1 if they haven't manually customized Step 3 yet
  const handleSexChange = (newSex) => {
    const nextAutoIds = autoSelectStarterCapsule({
      sex: newSex,
      aesthetics: draft.aesthetics,
      conservativeness: draft.conservativeness,
      occupation: draft.occupation,
    });
    const defaultMeas =
      newSex === 'male'
        ? { height_cm: 178, weight_kg: 76, waist_cm: 84, foot_length_cm: 27.0, skin_tone: draft.measurements?.skin_tone || '#E0AC69' }
        : { height_cm: 166, weight_kg: 60, waist_cm: 70, foot_length_cm: 24.0, skin_tone: draft.measurements?.skin_tone || '#E0AC69' };

    updateDraft({
      sex: newSex,
      measurements: defaultMeas,
      starter_item_ids: nextAutoIds,
    });
  };

  // Debounced live AI Fit & Size Passport prediction
  useEffect(() => {
    const m = draft.measurements || {};
    const fallback = computeFallbackPrediction({
      height_cm: m.height_cm,
      weight_kg: m.weight_kg,
      waist_cm: m.waist_cm,
      foot_length_cm: m.foot_length_cm,
      sex: draft.sex,
    });

    if (!draft.predicted_sizes) {
      setDraft((prev) => ({ ...prev, predicted_sizes: fallback }));
    }

    const timer = setTimeout(async () => {
      const predictFn = api.predictMeasurements || api.misc?.predictMeasurements;
      if (!predictFn) return;
      setPredictingFit(true);
      try {
        const res = await predictFn({
          height: Number(m.height_cm) || 168,
          weight: Number(m.weight_kg) || 62,
          waist: Number(m.waist_cm) || 72,
          foot_length: Number(m.foot_length_cm) || 24.5,
          gender: draft.sex === 'male' ? 'male' : 'female',
        });
        if (res && (res.shoulders || res.recommended_sizes)) {
          setDraft((prev) => {
            const next = { ...prev, predicted_sizes: res };
            if (getOnboardingDraft()) {
              return saveOnboardingDraft({ predicted_sizes: res }, prev);
            }
            return next;
          });
        }
      } catch {
        // Keep instant geometric fallback if backend is unreachable
        setDraft((prev) => ({ ...prev, predicted_sizes: prev.predicted_sizes || fallback }));
      } finally {
        setPredictingFit(false);
      }
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.measurements?.height_cm,
    draft.measurements?.weight_kg,
    draft.measurements?.waist_cm,
    draft.measurements?.foot_length_cm,
    draft.sex,
  ]);

  // Fetch local weather on Step 4 (soft fallback if guest or geolocation declined)
  useEffect(() => {
    if (step !== 4) return;
    // Ensure draft is persisted in localStorage before the user clicks the Step 4 Google OAuth button
    saveOnboardingDraft(draft, draft);
    let cancelled = false;
    const fetchWeather = async () => {
      try {
        if (typeof api.getWeather === 'function') {
          const w = await api.getWeather();
          const rawTemp = w?.temp_c ?? w?.temperature_c;
          if (!cancelled && typeof rawTemp === 'number') {
            setWeatherInfo({
              tempC: Math.round(rawTemp),
              condition: w.condition || 'Clear',
              city: w.city || null,
            });
          }
        }
      } catch {
        // Use clean fallback weather for unauthenticated preview
      }
    };
    fetchWeather();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Ranked 24-item gender dataset for Step 3
  const rankedCapsuleItems = useMemo(
    () =>
      getStarterCapsuleForUser({
        sex: draft.sex,
        aesthetics: draft.aesthetics,
        conservativeness: draft.conservativeness,
        occupation: draft.occupation,
      }),
    [draft.sex, draft.aesthetics, draft.conservativeness, draft.occupation]
  );

  const visibleCapsuleItems = useMemo(() => {
    if (activeCategoryTab === 'recommended') {
      return rankedCapsuleItems;
    }
    return rankedCapsuleItems.filter((item) => item.silhouette_group === activeCategoryTab);
  }, [rankedCapsuleItems, activeCategoryTab]);

  const selectionValidation = useMemo(
    () => validateStarterSelection(draft.starter_item_ids),
    [draft.starter_item_ids]
  );

  const assembledOutfit = useMemo(
    () => assembleStarterOutfit(draft.starter_item_ids, weatherInfo.tempC, t),
    [draft.starter_item_ids, weatherInfo.tempC, t]
  );

  const [showStep2Garments, setShowStep2Garments] = useState(true);
  const [showPointCloudMesh, setShowPointCloudMesh] = useState(true);
  const [showStep4Mesh, setShowStep4Mesh] = useState(false);

  const avatarMeasurements = useMemo(() => {
    const m = draft.measurements || {};
    const p = draft.predicted_sizes || {};
    const isMale = draft.sex === 'male';
    return {
      height: Number(m.height_cm) || (isMale ? 178 : 168),
      weight: Number(m.weight_kg) || (isMale ? 76 : 62),
      waist: Number(m.waist_cm) || (isMale ? 82 : 68),
      shoulders: Number(p.shoulders) || (isMale ? 44 : 38),
      chest: Number(p.chest) || (isMale ? 98 : 88),
      hip: Number(p.hip) || (isMale ? 96 : 94),
      inseam: Number(p.inseam) || (isMale ? 82 : 76),
      foot_length: Number(m.foot_length_cm) || (isMale ? 27.0 : 24.5),
      gender: isMale ? 'male' : 'female',
    };
  }, [draft.measurements, draft.predicted_sizes, draft.sex]);

  const toggleAesthetic = (id) => {
    const curr = Array.isArray(draft.aesthetics) ? draft.aesthetics : [];
    const next = curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id];
    if (next.length === 0) return;
    const nextAutoIds = autoSelectStarterCapsule({
      sex: draft.sex,
      aesthetics: next,
      conservativeness: draft.conservativeness,
      occupation: draft.occupation,
    });
    updateDraft({ aesthetics: next, starter_item_ids: nextAutoIds });
  };

  const togglePalette = (id) => {
    const curr = Array.isArray(draft.color_palette) ? draft.color_palette : [];
    const next = curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id];
    if (next.length === 0) return;
    updateDraft({ color_palette: next });
  };

  const toggleStarterItem = (itemId) => {
    const curr = Array.isArray(draft.starter_item_ids) ? draft.starter_item_ids : [];
    const next = curr.includes(itemId)
      ? curr.filter((x) => x !== itemId)
      : [...curr, itemId];
    updateDraft({ starter_item_ids: next });
  };

  const handleAutoSelectStaples = () => {
    const autoIds = autoSelectStarterCapsule({
      sex: draft.sex,
      aesthetics: draft.aesthetics,
      conservativeness: draft.conservativeness,
      occupation: draft.occupation,
    });
    updateDraft({ starter_item_ids: autoIds });
    toast.success(
      t('onboarding.step3.autoSelectedToast', {
        defaultValue: 'Selected 4 harmonious staples tailored to your Style DNA!',
      })
    );
  };

  const formatLength = (cmVal) => {
    const v = Number(cmVal) || 0;
    if (!isImperial) {
      return `${Math.round(v * 10) / 10} ${t('onboarding.units.cm', { defaultValue: 'cm' })}`;
    }
    return `${Math.round((v / 2.54) * 10) / 10} ${t('onboarding.units.in', { defaultValue: 'in' })}`;
  };

  const formatWeight = (kgVal) => {
    const v = Number(kgVal) || 0;
    if (!isImperial) {
      return `${Math.round(v * 10) / 10} ${t('onboarding.units.kg', { defaultValue: 'kg' })}`;
    }
    return `${Math.round(v * 2.20462 * 10) / 10} ${t('onboarding.units.lb', { defaultValue: 'lb' })}`;
  };

  const getItemTitle = (item) =>
    item?.id
      ? t(`onboarding.items.${item.id}`, { defaultValue: item.title || item.name || '' })
      : item?.title || item?.name || '';

  const getLocalizedWeatherCondition = (cond) => {
    const raw = String(cond || 'Clear & Mild').trim();
    const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return t(`onboarding.weather.${key}`, { defaultValue: raw });
  };

  const intendedFrom = location.state?.from?.pathname;
  const oauthNextTarget =
    intendedFrom && intendedFrom !== '/login' && intendedFrom !== '/register' && intendedFrom !== '/onboarding'
      ? intendedFrom
      : '/stylist?onboarded=1';

  const handleAuthenticatedFinish = async () => {
    setSavingAuthenticated(true);
    try {
      const { updatedUser } = await flushOnboardingDraftToBackend({
        api,
        closetStore,
        currentUser: user,
        draft,
        t,
      });
      if (updatedUser) {
        updateUserLocal?.(updatedUser);
      }
      await refresh?.().catch(() => {});
      toast.success(
        t('onboarding.step4.savedSuccess', {
          defaultValue: 'Your Style DNA, AI Size Passport, and Starter Capsule are ready!',
        })
      );
      nav(oauthNextTarget, { replace: true });
    } catch (err) {
      toast.error(
        err?.message ||
          t('onboarding.step4.saveError', {
            defaultValue: 'Could not save your onboarding profile. Please try again.',
          })
      );
    } finally {
      setSavingAuthenticated(false);
    }
  };

  const categoryTabs = useMemo(() => {
    const isFemale = draft.sex !== 'male';
    return [
      {
        id: 'recommended',
        label: t('onboarding.step3.tabs.recommended', { defaultValue: 'Recommended for You' }),
        count: rankedCapsuleItems.length,
      },
      {
        id: 'full_body',
        label: isFemale
          ? t('onboarding.step3.tabs.womenFullBody', { defaultValue: 'Dresses, Kaftans, Jalabiyas & Abayas' })
          : t('onboarding.step3.tabs.menFullBody', { defaultValue: 'Thobes, Kurta Sets & Business Suits' }),
        count: rankedCapsuleItems.filter((i) => i.silhouette_group === 'full_body').length,
      },
      ...(isFemale
        ? [
            {
              id: 'skirts',
              label: t('onboarding.step3.tabs.skirts', { defaultValue: 'Midi, Maxi & Business Skirts' }),
              count: rankedCapsuleItems.filter((i) => i.silhouette_group === 'skirts').length,
            },
          ]
        : []),
      {
        id: 'trousers',
        label: t('onboarding.step3.tabs.trousers', { defaultValue: 'Trousers, Chinos, Loose Pants & Jeans' }),
        count: rankedCapsuleItems.filter((i) => i.silhouette_group === 'trousers').length,
      },
      {
        id: 'tops',
        label: isFemale
          ? t('onboarding.step3.tabs.womenTops', { defaultValue: 'Blouses, Shirts, Loose Tunics & Tees' })
          : t('onboarding.step3.tabs.menTops', { defaultValue: 'Dress Shirts, Kurtas, Guayaberas & Polos' }),
        count: rankedCapsuleItems.filter((i) => i.silhouette_group === 'tops').length,
      },
      {
        id: 'outerwear',
        label: isFemale
          ? t('onboarding.step3.tabs.womenOuterwear', { defaultValue: 'Suit Blazers, Trench Coats & Cardigans' })
          : t('onboarding.step3.tabs.menOuterwear', { defaultValue: 'Suit Jackets, Bandhgalas, Achkans & Coats' }),
        count: rankedCapsuleItems.filter((i) => i.silhouette_group === 'outerwear').length,
      },
      {
        id: 'footwear',
        label: t('onboarding.step3.tabs.footwear', { defaultValue: 'Footwear' }),
        count: rankedCapsuleItems.filter((i) => i.silhouette_group === 'footwear').length,
      },
    ];
  }, [draft.sex, rankedCapsuleItems, t]);

  return (
    <div
      className="min-h-screen bg-accent-beige flex flex-col justify-between p-4 md:p-8"
      data-testid="onboarding-wizard-page"
    >
      {/* Top Header Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4 pb-4">
        <Link to="/home" className="flex items-center gap-2.5 shrink-0">
          <BrandLogo size="md" testId="onboarding-brand-logo" />
        </Link>

        {/* Endowed Progress Bar (20% -> 50% -> 80% -> 95%) */}
        <div className="flex-1 max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs font-semibold text-dark-brand mb-1.5">
            <span>
              {t('onboarding.progress.stepCounter', {
                step,
                total: 4,
                defaultValue: `Step ${step} of 4`,
              })}
            </span>
            <span className="text-primary-brand font-bold" data-testid="onboarding-progress-pct">
              {t('onboarding.progress.percentComplete', {
                pct: progressPct,
                defaultValue: `${progressPct}% Complete`,
              })}
            </span>
          </div>
          <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-border p-0.5">
            <div
              className="h-full bg-primary-brand rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!user && (
            <Link
              to="/login"
              state={location.state}
              onClick={() => clearOnboardingDraft()}
              className="text-xs md:text-sm font-semibold text-dark-brand hover:text-primary-brand underline-offset-4 hover:underline"
              data-testid="onboarding-returning-signin-link"
            >
              {t('onboarding.header.alreadyMember', { defaultValue: 'Returning user? Sign In' })}
            </Link>
          )}
          <LanguagePicker testIdSuffix="onboarding" />
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="max-w-6xl w-full mx-auto flex-1 flex flex-col justify-center py-2">
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 md:p-8">
          {/* ================================================================= */}
          {/* STEP 1: STYLE, SILHOUETTE & LIFESTYLE DNA (20%)                   */}
          {/* ================================================================= */}
          {step === 1 && (
            <div className="space-y-6" data-testid="onboarding-step-1">
              <div className="space-y-1.5">
                <Badge className="bg-accent-beige text-primary-brand border-none px-3 py-1 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 me-1.5 inline" />
                  {t('onboarding.step1.badge', { defaultValue: '60-Second Personal Stylist Setup' })}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-dark-brand">
                  {t('onboarding.step1.title', {
                    defaultValue: 'Tell Your AI Stylist About Your Style & Silhouette DNA',
                  })}
                </h1>
                <p className="text-sm text-text-brand">
                  {t('onboarding.step1.subtitle', {
                    defaultValue:
                      'Select your preferred cuts, modesty level, and daily routine so we can calibrate your avatar and starter wardrobe.',
                  })}
                </p>
              </div>

              {/* 1. Wardrobe Department / Sex */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-brand">
                  {t('onboarding.step1.departmentLabel', { defaultValue: '1. Primary Wardrobe Collection & Avatar Base' })}
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {[
                    {
                      id: 'female',
                      title: t('onboarding.step1.womenCollection', { defaultValue: "Women's Wardrobe" }),
                      desc: t('onboarding.step1.womenDesc', {
                        defaultValue: 'Dresses, Skirts, Trousers, Kaftans, Jalabiyas, Abayas, Suits & Blouses',
                      }),
                    },
                    {
                      id: 'male',
                      title: t('onboarding.step1.menCollection', { defaultValue: "Men's Wardrobe" }),
                      desc: t('onboarding.step1.menDesc', {
                        defaultValue: 'Tailored Suits, Trousers, Chinos, Thobes, Kurtas, Guayaberas & Shirts',
                      }),
                    },
                  ].map((opt) => {
                    const active = draft.sex === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSexChange(opt.id)}
                        data-testid={`onboarding-sex-${opt.id}`}
                        className={`text-start p-3.5 rounded-[16px] border transition-all ${
                          active
                            ? 'border-primary-brand bg-accent-beige ring-2 ring-primary-brand/20'
                            : 'border-border bg-white hover:border-primary-brand/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-dark-brand">{opt.title}</span>
                          {active && <Check className="w-4 h-4 text-primary-brand" />}
                        </div>
                        <p className="text-xs text-text-brand mt-1 line-clamp-2">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Aesthetics & Silhouette Preferences */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-brand">
                  {t('onboarding.step1.aestheticsLabel', {
                    defaultValue: '2. Preferred Silhouettes & Aesthetics (Pick 1 or more)',
                  })}
                </label>
                <div className="flex flex-wrap gap-2">
                  {AESTHETIC_OPTIONS.filter((opt) =>
                    draft.sex === 'male' ? opt.id !== 'dresses_skirts' : true
                  ).map((opt) => {
                    const active = (draft.aesthetics || []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleAesthetic(opt.id)}
                        data-testid={`onboarding-aesthetic-${opt.id}`}
                        className={`px-3.5 py-2 rounded-full text-xs md:text-sm font-semibold border transition-all flex items-center gap-1.5 ${
                          active
                            ? 'bg-primary-brand text-white border-primary-brand shadow-sm'
                            : 'bg-white text-dark-brand border-border hover:border-primary-brand'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Color Palette & Modesty Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-brand">
                    {t('onboarding.step1.paletteLabel', { defaultValue: '3. Favorite Color Palettes' })}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PALETTE_OPTIONS.map((pal) => {
                      const active = (draft.color_palette || []).includes(pal.id);
                      return (
                        <button
                          key={pal.id}
                          type="button"
                          onClick={() => togglePalette(pal.id)}
                          data-testid={`onboarding-palette-${pal.id}`}
                          className={`p-2.5 rounded-[12px] border text-start transition-all flex items-center justify-between gap-2 ${
                            active
                              ? 'border-primary-brand bg-accent-beige ring-1 ring-primary-brand'
                              : 'border-border bg-white hover:border-primary-brand/50'
                          }`}
                        >
                          <span className="text-xs font-semibold text-dark-brand truncate">
                            {t(pal.labelKey, { defaultValue: pal.defaultLabel })}
                          </span>
                          <span className="flex items-center -space-x-1 rtl:space-x-reverse shrink-0">
                            {pal.swatches.map((hex) => (
                              <span
                                key={hex}
                                className="w-4 h-4 rounded-full border border-black/10 inline-block"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-brand">
                      {t('onboarding.step1.modestyLabel', { defaultValue: '4. Coverage & Modesty Preference' })}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CONSERVATIVENESS_OPTIONS.map((opt) => {
                        const active = draft.conservativeness === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              const nextAuto = autoSelectStarterCapsule({
                                sex: draft.sex,
                                aesthetics: draft.aesthetics,
                                conservativeness: opt.id,
                                occupation: draft.occupation,
                              });
                              updateDraft({ conservativeness: opt.id, starter_item_ids: nextAuto });
                            }}
                            data-testid={`onboarding-modesty-${opt.id}`}
                            className={`py-2.5 px-2 rounded-[12px] text-xs font-semibold border text-center transition-all ${
                              active
                                ? 'bg-primary-brand text-white border-primary-brand'
                                : 'bg-white text-dark-brand border-border hover:border-primary-brand'
                            }`}
                          >
                            {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-brand">
                      {t('onboarding.step1.occupationLabel', { defaultValue: '5. Daily Routine / Setting' })}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {OCCUPATION_OPTIONS.map((occ) => {
                        const active = draft.occupation === occ.id;
                        return (
                          <button
                            key={occ.id}
                            type="button"
                            onClick={() => updateDraft({ occupation: occ.id })}
                            data-testid={`onboarding-occupation-${occ.id}`}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              active
                                ? 'bg-dark-brand text-white border-dark-brand'
                                : 'bg-white text-dark-brand border-border hover:border-dark-brand/40'
                            }`}
                          >
                            {t(occ.labelKey, { defaultValue: occ.defaultLabel })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. B2B Fashion Professional Toggle & Sub-Card */}
              <div className="rounded-[16px] border border-border bg-accent-beige/50 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center text-primary-brand shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-dark-brand">
                        {t('onboarding.step1.proToggleTitle', {
                          defaultValue: 'Are you a Professional Stylist, Tailor, or Fashion Designer?',
                        })}
                      </div>
                      <div className="text-xs text-text-brand">
                        {t('onboarding.step1.proToggleSubtitle', {
                          defaultValue:
                            'Get listed in the DressApp Experts Registry and preview your B2B directory card on Step 4.',
                        })}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(draft.is_professional)}
                    onCheckedChange={(checked) =>
                      updateDraft({
                        is_professional: checked,
                        professional: {
                          ...draft.professional,
                          is_professional: checked,
                        },
                      })
                    }
                    data-testid="onboarding-pro-toggle"
                  />
                </div>

                {draft.is_professional && (
                  <div
                    className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3"
                    data-testid="onboarding-pro-subcard"
                  >
                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      {PROFESSION_OPTIONS.map((prof) => {
                        const active = draft.professional?.profession === prof.id;
                        return (
                          <button
                            key={prof.id}
                            type="button"
                            onClick={() =>
                              updateDraft({
                                professional: {
                                  ...draft.professional,
                                  profession: prof.id,
                                },
                              })
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              active
                                ? 'bg-primary-brand text-white border-primary-brand'
                                : 'bg-white text-dark-brand border-border'
                            }`}
                          >
                            {t(prof.labelKey, { defaultValue: prof.defaultLabel })}
                          </button>
                        );
                      })}
                    </div>

                    <Input
                      placeholder={t('onboarding.step1.proBusinessName', {
                        defaultValue: 'Studio / Business Name (e.g. Atelier Noor)',
                      })}
                      value={draft.professional?.business?.name || ''}
                      onChange={(e) =>
                        updateDraft({
                          professional: {
                            ...draft.professional,
                            business: { name: e.target.value },
                          },
                        })
                      }
                      data-testid="onboarding-pro-business-name"
                    />
                    <Input
                      placeholder={t('onboarding.step1.proCity', {
                        defaultValue: 'City & Country (e.g. Milan, Italy / Dubai / Tel Aviv)',
                      })}
                      value={draft.professional?.business?.address || ''}
                      onChange={(e) =>
                        updateDraft({
                          professional: {
                            ...draft.professional,
                            business: { address: e.target.value },
                          },
                        })
                      }
                      data-testid="onboarding-pro-city"
                    />
                    <Input
                      placeholder={t('onboarding.step1.proWebsite', {
                        defaultValue: 'Website or Instagram URL (optional)',
                      })}
                      value={draft.professional?.business?.website || ''}
                      onChange={(e) =>
                        updateDraft({
                          professional: {
                            ...draft.professional,
                            business: { website: e.target.value },
                          },
                        })
                      }
                    />
                    <Input
                      placeholder={t('onboarding.step1.proBio', {
                        defaultValue: 'Specialty tagline (e.g. Executive Wardrobe & Modest Couture)',
                      })}
                      value={draft.professional?.business?.description || ''}
                      onChange={(e) =>
                        updateDraft({
                          professional: {
                            ...draft.professional,
                            business: { description: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: 15-SECOND AI FIT & AVATAR CALIBRATION (50%)               */}
          {/* ================================================================= */}
          {step === 2 && (
            <div className="space-y-6" data-testid="onboarding-step-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <Badge className="bg-accent-beige text-primary-brand border-none px-3 py-1 text-xs font-semibold">
                    <Ruler className="w-3.5 h-3.5 me-1.5 inline" />
                    {t('onboarding.step2.badge', { defaultValue: 'Real-Time Anthropometric AI Fit' })}
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-bold text-dark-brand">
                    {t('onboarding.step2.title', {
                      defaultValue: 'Calibrate Your 3D/2D Avatar & AI Size Passport',
                    })}
                  </h1>
                  <p className="text-sm text-text-brand">
                    {t('onboarding.step2.subtitle', {
                      defaultValue:
                        'Slide 4 quick measurements—our AI instantly predicts your full body proportions and international garment sizes.',
                    })}
                  </p>
                </div>

                {/* Metric / Imperial Unit Toggle */}
                <div className="inline-flex rounded-full border border-border bg-accent-beige p-1">
                  {[
                    {
                      id: 'metric',
                      label: t('onboarding.step2.unitMetric', { defaultValue: 'cm / kg' }),
                    },
                    {
                      id: 'imperial',
                      label: t('onboarding.step2.unitImperial', { defaultValue: 'in / lb' }),
                    },
                  ].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => updateDraft({ unit_system: u.id })}
                      data-testid={`onboarding-unit-${u.id}`}
                      className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                        draft.unit_system === u.id
                          ? 'bg-white text-dark-brand shadow-sm'
                          : 'text-text-brand hover:text-dark-brand'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left Column: 4 Interactive Sliders + Skin Tone */}
                <div className="lg:col-span-6 space-y-4 bg-accent-beige/40 p-5 rounded-[18px] border border-border">
                  {/* Height Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-dark-brand">
                      <span>{t('onboarding.step2.height', { defaultValue: 'Height' })}</span>
                      <span className="text-primary-brand">{formatLength(draft.measurements?.height_cm)}</span>
                    </div>
                    <input
                      type="range"
                      min={140}
                      max={210}
                      step={1}
                      value={draft.measurements?.height_cm || 168}
                      onChange={(e) =>
                        updateDraft({ measurements: { height_cm: Number(e.target.value) } })
                      }
                      className="w-full accent-primary-brand cursor-pointer"
                      data-testid="onboarding-slider-height"
                    />
                  </div>

                  {/* Weight Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-dark-brand">
                      <span>{t('onboarding.step2.weight', { defaultValue: 'Weight' })}</span>
                      <span className="text-primary-brand">{formatWeight(draft.measurements?.weight_kg)}</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={140}
                      step={1}
                      value={draft.measurements?.weight_kg || 62}
                      onChange={(e) =>
                        updateDraft({ measurements: { weight_kg: Number(e.target.value) } })
                      }
                      className="w-full accent-primary-brand cursor-pointer"
                      data-testid="onboarding-slider-weight"
                    />
                  </div>

                  {/* Waist Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-dark-brand">
                      <span>{t('onboarding.step2.waist', { defaultValue: 'Waist Circumference' })}</span>
                      <span className="text-primary-brand">{formatLength(draft.measurements?.waist_cm)}</span>
                    </div>
                    <input
                      type="range"
                      min={55}
                      max={130}
                      step={1}
                      value={draft.measurements?.waist_cm || 72}
                      onChange={(e) =>
                        updateDraft({ measurements: { waist_cm: Number(e.target.value) } })
                      }
                      className="w-full accent-primary-brand cursor-pointer"
                      data-testid="onboarding-slider-waist"
                    />
                  </div>

                  {/* Foot Length Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-dark-brand">
                      <span>{t('onboarding.step2.footLength', { defaultValue: 'Foot Length' })}</span>
                      <span className="text-primary-brand">{formatLength(draft.measurements?.foot_length_cm)}</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={32}
                      step={0.5}
                      value={draft.measurements?.foot_length_cm || 24.5}
                      onChange={(e) =>
                        updateDraft({ measurements: { foot_length_cm: Number(e.target.value) } })
                      }
                      className="w-full accent-primary-brand cursor-pointer"
                      data-testid="onboarding-slider-foot"
                    />
                  </div>

                  {/* Skin Tone Picker */}
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-dark-brand">
                        {t('onboarding.step2.skinTone', { defaultValue: 'Avatar Skin Tone & Color Harmony' })}
                      </div>
                      <div className="text-[11px] text-text-brand">
                        {t('onboarding.step2.skinToneHint', {
                          defaultValue: 'Used to personalize your avatar and complementary color advice',
                        })}
                      </div>
                    </div>
                    <SkinTonePicker
                      value={draft.measurements?.skin_tone || '#E0AC69'}
                      onChange={(color) => updateDraft({ measurements: { skin_tone: color } })}
                    />
                  </div>

                  {/* Live AI Size Passport Readout */}
                  <div
                    className="bg-white rounded-[14px] border border-border p-3.5 space-y-2.5"
                    data-testid="onboarding-size-passport"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-dark-brand flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary-brand" />
                        {t('onboarding.step2.sizePassportTitle', {
                          defaultValue: 'AI-Predicted Proportions & Size Passport',
                        })}
                      </span>
                      {predictingFit && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-brand" />}
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                      {[
                        { label: t('onboarding.step2.shoulders', { defaultValue: 'Shoulders' }), val: formatLength(avatarMeasurements.shoulders) },
                        { label: t('onboarding.step2.chest', { defaultValue: 'Chest' }), val: formatLength(avatarMeasurements.chest) },
                        { label: t('onboarding.step2.hips', { defaultValue: 'Hips' }), val: formatLength(avatarMeasurements.hip) },
                        { label: t('onboarding.step2.inseam', { defaultValue: 'Inseam' }), val: formatLength(avatarMeasurements.inseam) },
                        { label: t('onboarding.step2.topSize', { defaultValue: 'Top Size' }), val: draft.predicted_sizes?.recommended_sizes?.shirt_size || 'M' },
                        { label: t('onboarding.step2.shoeSize', { defaultValue: 'US Shoe' }), val: draft.predicted_sizes?.recommended_sizes?.shoe_size_us || '8' },
                      ].map((metric) => (
                        <div key={metric.label} className="bg-accent-beige/60 rounded-lg p-2">
                          <div className="text-[10px] text-text-brand truncate">{metric.label}</div>
                          <div className="text-xs font-bold text-dark-brand mt-0.5">{metric.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Morphing Avatar + Dynamic Garment & Point-Cloud Fit Mesh */}
                <div className="lg:col-span-6 flex flex-col items-center justify-between bg-accent-beige/30 rounded-[18px] border border-border p-4 min-h-[410px]">
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-brand bg-white px-2.5 py-1 rounded-full border border-border">
                      <Sparkles className="w-3 h-3" />
                      {t('onboarding.step2.liveWarpBadge', {
                        defaultValue: 'Dynamic Point-Cloud Garment Resizing',
                      })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowStep2Garments((v) => !v)}
                        data-testid="onboarding-step2-toggle-garments"
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          showStep2Garments
                            ? 'bg-dark-brand text-white border-dark-brand'
                            : 'bg-white text-dark-brand border-border'
                        }`}
                      >
                        {t('onboarding.step2.fittedGarmentsToggle', {
                          defaultValue: 'Fitted Garments',
                        })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPointCloudMesh((v) => !v)}
                        data-testid="onboarding-step2-toggle-mesh"
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          showPointCloudMesh
                            ? 'bg-primary-brand text-white border-primary-brand'
                            : 'bg-white text-dark-brand border-border'
                        }`}
                      >
                        {t('onboarding.step2.pointCloudMeshToggle', {
                          defaultValue: 'Point-Cloud Mesh',
                        })}
                      </button>
                    </div>
                  </div>

                  <div className="w-full max-w-[240px] aspect-[200/450] mx-auto flex items-center justify-center">
                    <AvatarViewer
                      measurements={avatarMeasurements}
                      sex={draft.sex === 'male' ? 'male' : 'female'}
                      skinColor={draft.measurements?.skin_tone || '#E0AC69'}
                      outfitItems={showStep2Garments ? assembledOutfit.avatarOutfitItems : {}}
                      showPointCloudMesh={showPointCloudMesh}
                      interactive={true}
                    />
                  </div>
                  <p className="text-xs text-text-brand text-center mt-2">
                    {t('onboarding.step2.avatarLiveCaption', {
                      defaultValue:
                        'Both your avatar and fitted garments dynamically warp as you slide your measurements.',
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: CURATED MEN'S & WOMEN'S STATIC ONBOARDING DATASET (80%)   */}
          {/* ================================================================= */}
          {step === 3 && (
            <div className="space-y-5" data-testid="onboarding-step-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-dark-brand">
                    {t('onboarding.step3.title', {
                      defaultValue: 'Seed Your Starter Closet with 4+ Everyday Staples',
                    })}
                  </h1>
                  <p className="text-sm text-text-brand">
                    {t('onboarding.step3.subtitle', {
                      defaultValue:
                        'Pick at least 4 pieces that match items you already own (either 1 Full-Body piece + Footwear, OR 1 Top + 1 Trousers/Skirt + Footwear) so your AI Stylist can build your first complete look immediately.',
                    })}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoSelectStaples}
                  className="shrink-0 gap-1.5 text-xs font-bold border-primary-brand text-primary-brand hover:bg-accent-beige"
                  data-testid="onboarding-auto-select-btn"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {t('onboarding.step3.autoSelectBtn', {
                    defaultValue: 'Auto-Select 4 Staples for My Style',
                  })}
                </Button>
              </div>

              {/* Dual-Path Outfit Readiness Bar */}
              <div
                className={`rounded-[14px] border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                  selectionValidation.isComplete
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-accent-beige/60 border-border text-dark-brand'
                }`}
                data-testid="onboarding-completeness-banner"
              >
                <div className="flex items-center gap-2.5 text-xs md:text-sm font-semibold">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      selectionValidation.isComplete
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-border text-dark-brand'
                    }`}
                  >
                    {selectionValidation.isComplete ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      selectionValidation.totalSelected
                    )}
                  </div>
                  <span>
                    {selectionValidation.isComplete
                      ? t('onboarding.step3.readyMessage', {
                          count: selectionValidation.totalSelected,
                          defaultValue: `Complete head-to-toe outfit unlocked (${selectionValidation.totalSelected} staples selected)!`,
                        })
                      : t('onboarding.step3.incompleteMessage', {
                          count: selectionValidation.totalSelected,
                          defaultValue: `${selectionValidation.totalSelected}/4 selected — Pick at least 4 staples including (Full-Body + Footwear) OR (Top + Trousers/Skirt + Footwear).`,
                        })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <span
                    className={`px-2.5 py-0.5 rounded-full border ${
                      selectionValidation.counts.fullBody > 0 ||
                      (selectionValidation.counts.top > 0 && selectionValidation.counts.bottom > 0)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-text-brand border-border'
                    }`}
                  >
                    {selectionValidation.counts.fullBody > 0
                      ? t('onboarding.step3.pillFullBody', {
                          count: selectionValidation.counts.fullBody,
                          defaultValue: `Full-Body (${selectionValidation.counts.fullBody})`,
                        })
                      : t('onboarding.step3.pillTopBottom', {
                          top: selectionValidation.counts.top,
                          bottom: selectionValidation.counts.bottom,
                          defaultValue: `Top (${selectionValidation.counts.top}) + Bottom (${selectionValidation.counts.bottom})`,
                        })}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border ${
                      selectionValidation.counts.footwear > 0
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-text-brand border-border'
                    }`}
                  >
                    {t('onboarding.step3.pillFootwear', {
                      count: selectionValidation.counts.footwear,
                      defaultValue: `Footwear (${selectionValidation.counts.footwear})`,
                    })}
                  </span>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {categoryTabs.map((tab) => {
                  const active = activeCategoryTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategoryTab(tab.id)}
                      data-testid={`onboarding-tab-${tab.id}`}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                        active
                          ? 'bg-dark-brand text-white border-dark-brand'
                          : 'bg-white text-dark-brand border-border hover:border-dark-brand/50'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  );
                })}
              </div>

              {/* Grid of Cataloged Garment Cards */}
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[420px] overflow-y-auto pr-1"
                data-testid="onboarding-capsule-grid"
              >
                {visibleCapsuleItems.map((item) => {
                  const isSelected = (draft.starter_item_ids || []).includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleStarterItem(item.id)}
                      data-testid={`onboarding-item-${item.id}`}
                      className={`group relative rounded-[16px] border p-2.5 text-start transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary-brand bg-accent-beige/70 ring-2 ring-primary-brand shadow-sm'
                          : 'border-border bg-white hover:border-primary-brand/60'
                      }`}
                    >
                      <div className="relative aspect-square w-full rounded-[12px] bg-[#F8F7F4] overflow-hidden flex items-center justify-center mb-2">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform"
                        />
                        <div
                          className={`absolute top-2 end-2 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-primary-brand border-primary-brand text-white'
                              : 'bg-white/90 border-border text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary-brand truncate">
                          {labelForSubCategory(item.sub_category, t)}
                        </div>
                        <div className="text-xs font-bold text-dark-brand line-clamp-2 leading-snug mt-0.5">
                          {getItemTitle(item)}
                        </div>
                        <div className="text-[10px] text-text-brand truncate mt-1">
                          {labelForColor(item.color, t)} · {labelForMaterial(item.material, t)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Power-User Competitor Migration Notice (Paid Tiers Only) */}
              <div
                className="rounded-[14px] border border-amber-500/30 bg-amber-50/70 p-3 flex flex-wrap items-center justify-between gap-3"
                data-testid="onboarding-migration-pro-badge"
              >
                <div className="flex items-center gap-2.5 text-xs text-dark-brand flex-1 min-w-[220px]">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {t('onboarding.step3.migrationProPrompt', {
                      defaultValue:
                        'Already have a digital closet on Whering, Acloset, Indyx, or Stylebook? Bulk AI wardrobe migration (50+ items) is available on Manager & Professional plans after sign-in.',
                    })}
                  </span>
                </div>
                <Badge className="bg-amber-500/15 text-amber-800 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold shrink-0 inline-flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {t('onboarding.step3.migrationProBadge', {
                      defaultValue: 'Manager / Pro',
                    })}
                  </span>
                </Badge>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: THE "AHA! MOMENT" REVEAL & SIGN-IN (95%)                  */}
          {/* ================================================================= */}
          {step === 4 && (
            <div className="space-y-6" data-testid="onboarding-step-4">
              <div className="space-y-1">
                <Badge className="bg-emerald-100 text-emerald-900 border-none px-3 py-1 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 me-1.5 inline" />
                  {t('onboarding.step4.badge', {
                    defaultValue: 'Your First AI Outfit & Calibrated Avatar Are Ready!',
                  })}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-dark-brand">
                  {t('onboarding.step4.title', {
                    defaultValue: 'Meet Your Personal AI Stylist Look',
                  })}
                </h1>
                <p className="text-sm text-text-brand">
                  {t('onboarding.step4.subtitle', {
                    defaultValue:
                      'We dressed your calibrated avatar in a complete head-to-toe outfit from your Starter Capsule, matched to today’s weather.',
                  })}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Calibrated Avatar Wearing the Complete Starter Outfit */}
                <div className="lg:col-span-6 bg-accent-beige/40 rounded-[20px] border border-border p-5 flex flex-col items-center">
                  {/* Weather & Point-Cloud Fit Header Bar */}
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-border text-xs font-bold text-dark-brand">
                      <CloudSun className="w-4 h-4 text-primary-brand" />
                      <span dir="ltr">{weatherInfo.tempC}°C</span> ·{' '}
                      {getLocalizedWeatherCondition(weatherInfo.condition)}
                      {weatherInfo.city ? ` (${weatherInfo.city})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowStep4Mesh((v) => !v)}
                      data-testid="onboarding-step4-toggle-mesh"
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        showStep4Mesh
                          ? 'bg-primary-brand text-white border-primary-brand shadow-sm'
                          : 'bg-white text-primary-brand border-primary-brand/40 hover:border-primary-brand'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {showStep4Mesh
                        ? t('onboarding.step4.hideMeshBtn', { defaultValue: 'Hide Point-Cloud Mesh' })
                        : t('onboarding.step4.inspectMeshBtn', { defaultValue: 'Inspect Point-Cloud Fit Mesh' })}
                    </button>
                  </div>

                  <div className="w-full max-w-[250px] aspect-[200/450] mx-auto flex items-center justify-center my-1">
                    <AvatarViewer
                      measurements={avatarMeasurements}
                      sex={draft.sex === 'male' ? 'male' : 'female'}
                      skinColor={draft.measurements?.skin_tone || '#E0AC69'}
                      outfitItems={assembledOutfit.avatarOutfitItems}
                      showPointCloudMesh={showStep4Mesh}
                      interactive={true}
                    />
                  </div>

                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-950 text-[11px] font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    {assembledOutfit.mode === 'full_body'
                      ? t('onboarding.step4.fullBodyHarmony', {
                          defaultValue: '100% Custom Proportions Fitted · Full-Body Silhouette',
                        })
                      : t('onboarding.step4.separatesHarmony', {
                          defaultValue: '100% Custom Proportions Fitted · Tailored Separates',
                        })}
                  </div>

                  {/* Assembled Outfit Piece Strip */}
                  <div className="w-full mt-4 pt-3 border-t border-border">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-brand mb-2">
                      {t('onboarding.step4.outfitPiecesTitle', {
                        defaultValue: 'Assembled Head-to-Toe Look',
                      })}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {assembledOutfit.outfitPieces.map((piece) => (
                        <div
                          key={piece.id}
                          className="bg-white rounded-[10px] border border-border p-1.5 flex flex-col items-center text-center"
                        >
                          <img
                            src={piece.image_url}
                            alt={getItemTitle(piece)}
                            className="w-12 h-12 object-contain"
                          />
                          <span className="text-[10px] font-bold text-dark-brand line-clamp-1 mt-1">
                            {getItemTitle(piece)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Style DNA Summary, B2B Card Preview & Google Sign-In CTA */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Style DNA + AI Size Passport Summary Card */}
                  <div className="rounded-[18px] border border-border bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-dark-brand">
                        {t('onboarding.step4.passportCardTitle', {
                          defaultValue: 'Your Personal Style & Fit Passport',
                        })}
                      </h3>
                      <Badge className="bg-primary-brand/10 text-primary-brand border-none text-xs font-bold">
                        {t('onboarding.step4.freeCreditsBadge', {
                          defaultValue: '+5 Free AI Stylist Credits Included',
                        })}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-accent-beige/50 rounded-xl p-2.5">
                        <div className="text-[10px] text-text-brand">
                          {t('onboarding.step2.topSize', { defaultValue: 'Top Size' })}
                        </div>
                        <div className="text-sm font-bold text-dark-brand">
                          {draft.predicted_sizes?.recommended_sizes?.shirt_size || 'M'}
                        </div>
                      </div>
                      <div className="bg-accent-beige/50 rounded-xl p-2.5">
                        <div className="text-[10px] text-text-brand">
                          {t('onboarding.step4.bottomSize', { defaultValue: 'Bottom Size' })}
                        </div>
                        <div className="text-sm font-bold text-dark-brand">
                          {draft.predicted_sizes?.recommended_sizes?.pants_size || 'M'}
                        </div>
                      </div>
                      <div className="bg-accent-beige/50 rounded-xl p-2.5">
                        <div className="text-[10px] text-text-brand">
                          {t('onboarding.step2.shoeSize', { defaultValue: 'US Shoe' })}
                        </div>
                        <div className="text-sm font-bold text-dark-brand">
                          {draft.predicted_sizes?.recommended_sizes?.shoe_size_us || '8'}
                        </div>
                      </div>
                      <div className="bg-accent-beige/50 rounded-xl p-2.5">
                        <div className="text-[10px] text-text-brand">
                          {t('onboarding.step4.seededItems', { defaultValue: 'Starter Closet' })}
                        </div>
                        <div className="text-sm font-bold text-dark-brand">
                          {(draft.starter_item_ids || []).length}{' '}
                          {t('onboarding.step4.itemsLabel', { defaultValue: 'Items' })}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-text-brand flex items-start gap-2 pt-1">
                      <ShieldCheck className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
                      <span>
                        {t('onboarding.step4.starterBadgeNote', {
                          defaultValue:
                            'Your Starter Capsule items work immediately in the AI Stylist and Outfit Canvas. You can snap a real photo of any item later in 1 tap to unlock Marketplace swapping/selling.',
                        })}
                      </span>
                    </p>
                  </div>

                  {/* Conditional B2B Experts Registry Preview Card */}
                  {draft.is_professional && (
                    <div
                      className="rounded-[18px] border-2 border-primary-brand/40 bg-accent-beige/40 p-4 space-y-2"
                      data-testid="onboarding-b2b-preview-card"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-brand flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          {t('onboarding.step4.b2bPreviewBadge', {
                            defaultValue: 'Experts Registry Card Preview',
                          })}
                        </span>
                        <Badge className="bg-white text-dark-brand border border-border text-[10px]">
                          {t(
                            PROFESSION_OPTIONS.find((p) => p.id === draft.professional?.profession)
                              ?.labelKey || 'onboarding.pro.personalStylist',
                            { defaultValue: 'Fashion Professional' }
                          )}
                        </Badge>
                      </div>
                      <div className="font-bold text-base text-dark-brand">
                        {draft.professional?.business?.name ||
                          t('onboarding.step4.b2bDefaultName', { defaultValue: 'Your Fashion Studio' })}
                      </div>
                      {draft.professional?.business?.description && (
                        <p className="text-xs text-text-brand">
                          {draft.professional.business.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-brand pt-1">
                        {draft.professional?.business?.address && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-primary-brand" />
                            {draft.professional.business.address}
                          </span>
                        )}
                        {draft.professional?.business?.website && (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-primary-brand" />
                            {draft.professional.business.website}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Save & Sign-In Box */}
                  <div className="rounded-[20px] border border-border bg-accent-beige p-5 space-y-3">
                    <h3 className="font-bold text-base text-dark-brand">
                      {user
                        ? t('onboarding.step4.authReadyTitle', {
                            defaultValue: 'Save Your Setup & Launch Your AI Stylist',
                          })
                        : t('onboarding.step4.guestReadyTitle', {
                            defaultValue: 'Save Your Avatar, Fit Passport & First Outfit',
                          })}
                    </h3>
                    <p className="text-xs text-text-brand">
                      {user
                        ? t('onboarding.step4.authReadyDesc', {
                            defaultValue:
                              'Click below to seed your Starter Capsule and open your first outfit directly on the AI Stylist Canvas.',
                          })
                        : t('onboarding.step4.guestReadyDesc', {
                            defaultValue:
                              'Continue with Google in 1 click to permanently save your calibrated avatar, measurements, and starter wardrobe.',
                          })}
                    </p>

                    {user ? (
                      <Button
                        type="button"
                        onClick={handleAuthenticatedFinish}
                        disabled={savingAuthenticated}
                        className="w-full py-5 text-sm font-bold"
                        data-testid="onboarding-finish-authenticated-btn"
                      >
                        {savingAuthenticated ? (
                          <Loader2 className="w-4 h-4 animate-spin me-2" />
                        ) : (
                          <Sparkles className="w-4 h-4 me-2" />
                        )}
                        {t('onboarding.step4.openStylistBtn', {
                          defaultValue: 'Save & Open My AI Stylist',
                        })}
                      </Button>
                    ) : (
                      <GoogleAuthButton
                        next={oauthNextTarget}
                        testId="onboarding-google-save-button"
                        className="w-full py-5 text-sm font-bold"
                        label={t('onboarding.step4.saveWithGoogle', {
                          defaultValue: 'Save My Style DNA & Open AI Stylist',
                        })}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Step Navigation Footer */}
          <div className="mt-8 pt-4 border-t border-border flex items-center justify-between gap-4">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => updateDraft({ step: step - 1 })}
                data-testid="onboarding-back-btn"
              >
                <ChevronLeft className="w-4 h-4 me-1 rtl:rotate-180" />
                {t('onboarding.nav.back', { defaultValue: 'Back' })}
              </Button>
            ) : (
              <div />
            )}

            {step < 4 && (
              <Button
                type="button"
                disabled={step === 3 && !selectionValidation.isComplete}
                onClick={() => updateDraft({ step: step + 1 })}
                data-testid="onboarding-next-btn"
              >
                {step === 3
                  ? t('onboarding.nav.revealOutfit', {
                      defaultValue: 'Reveal My First AI Outfit',
                    })
                  : t('onboarding.nav.continue', { defaultValue: 'Continue' })}
                <ChevronRight className="w-4 h-4 ms-1 rtl:rotate-180" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
